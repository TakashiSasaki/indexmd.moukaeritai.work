import { useState, useEffect, useRef, useMemo } from "react";
import { 
  auth,
  db, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  limit,
  writeBatch,
  onSnapshot,
  firestoreDatabaseId,
  firebaseProjectId,
  getDoc,
  serverTimestamp,
  getCountFromServer
} from "../lib/firebase";
import { Directory, SyncState, DriveLog, AppConfig } from "../types";
import { writeLog } from "../lib/logger";
import { 
  CloudRain, 
  FolderSync, 
  Play, 
  Pause, 
  RefreshCw, 
  Layers, 
  Folder, 
  FolderX,
  FileText, 
  Database,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  XCircle,
  Search,
  CheckSquare,
  HelpCircle,
  SlidersHorizontal,
  EyeOff,
  ChevronRight,
  ExternalLink,
  Trash2,
  Bug,
  ChevronDown,
  Copy,
  LinkIcon,
  List,
  LogOut,
  FastForward,
  Check,
  Zap,
  Sparkles,
  ShieldAlert,
  Terminal,
  Settings,
  ListFilter,
  ClipboardCopy
} from "lucide-react";
import DriveLogs from "./DriveLogs";
import { SummaryDebugger } from "./SummaryDebugger";
import { motion } from "motion/react";
import { getDriveAuthHeaders } from "../lib/driveToken";
import { 
  isIgnoredFolderName, 
  isIgnoredPath, 
  shouldIgnoreDirectory, 
  selectIgnoredDirectoryIdsForPrune 
} from "../lib/ignoreRules";
import { resolvePathAndDepth as resolvePathAndDepthHelper } from "../lib/driveTree";
import { runWithExplicitResult as runWithExplicitResultHelper } from "../lib/firestoreResult";

interface DriveDashboardProps {
  userId: string;
  token: string;
  config: AppConfig;
  logs: DriveLog[];
  onAddLog: (level: "info" | "success" | "warn" | "error", message: string, details?: string) => void;
  onClearLogs: () => void;
  onSessionExpiry?: () => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export default function DriveDashboard({ userId, token, config, logs, onAddLog, onClearLogs, onSessionExpiry, activeTab, setActiveTab }: DriveDashboardProps) {
  const [dirs, setDirs] = useState<Directory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isInitialSyncing, setIsInitialSyncing] = useState<boolean>(true);
  
  // Job 1 State (Scanning)
  const [isCrawlActive, setIsCrawlActive] = useState<boolean>(false);
  const crawlActiveRef = useRef<boolean>(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [rootNextPageToken, setRootNextPageToken] = useState<string | null>(null);
  const [lastGlobalSyncAt, setLastGlobalSyncAt] = useState<string | null>(null);
  const [rootLastTraversedAt, setRootLastTraversedAt] = useState<string | null>(null);
  const [currentTaskName, setCurrentTaskName] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentTaskPath, setCurrentTaskPath] = useState<string | null>(null);

  // Debugger specific states
  const debugAbortControllerRef = useRef<AbortController | null>(null);
  const isManualCancelRef = useRef<boolean>(false);
  const cancelDebugScan = () => {
    if (debugAbortControllerRef.current) {
      isManualCancelRef.current = true;
      debugAbortControllerRef.current.abort();
      onAddLog("warn", "🔧 [デバッグ走査中断] ユーザーによって1ステップ走査リクエストが手動でキャンセルされました。");
    }
  };
  const [debugLoading, setDebugLoading] = useState<boolean>(false);
  const [lastDebugFolder, setLastDebugFolder] = useState<any>(null);
  const [isTokenInitializing, setIsTokenInitializing] = useState<boolean>(false);
  const [debugPageSize, setDebugPageSize] = useState<number>(1);
  const [showDebugSettings, setShowDebugSettings] = useState<boolean>(false);
  const [isCacheClearing, setIsCacheClearing] = useState<boolean>(false);
  const [selectedCacheType, setSelectedCacheType] = useState<string>("all");
  const [copiedDiagnostics, setCopiedDiagnostics] = useState<boolean>(false);
  const [lastCacheHit, setLastCacheHit] = useState<boolean | null>(null);
  const [totalCacheHits, setTotalCacheHits] = useState<number>(0);
  const [totalCacheMisses, setTotalCacheMisses] = useState<number>(0);
  const [lastKnownTotal, setLastKnownTotal] = useState<number>(() => {
    try {
      const val = localStorage.getItem(`indexmd_total_folders_${userId}`);
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [syncProgress, setSyncProgress] = useState<{ current: number; lastPath: string } | null>(null);
  const [isFullySynced, setIsFullySynced] = useState<boolean>(true);
  const [ignoredFolderNames, setIgnoredFolderNames] = useState<string[]>([]);
  const [crawlStats, setCrawlStats] = useState<{ discovered: number; skipped: number; ignored: number; removed: number }>({ discovered: 0, skipped: 0, ignored: 0, removed: 0 });
  const [skipExistingFolders, setSkipExistingFolders] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem(`indexmd_skip_existing_${userId}`);
      return val ? val === "true" : true;
    } catch {
      return true;
    }
  });

  // Filtered directories based on user-defined ignored names
  const filteredDirs = useMemo(() => {
    return dirs.filter(d => !shouldIgnoreDirectory({ name: d.name, path: d.path }, ignoredFolderNames));
  }, [dirs, ignoredFolderNames]);

  const [scanLimit, setScanLimit] = useState<number>(() => {
    try {
      const val = localStorage.getItem(`indexmd_scan_limit_${userId}`);
      return val ? parseInt(val, 10) : 100;
    } catch {
      return 100;
    }
  });

  useEffect(() => {
    if (userId) {
      localStorage.setItem(`indexmd_scan_limit_${userId}`, scanLimit.toString());
    }
  }, [scanLimit, userId]);

  useEffect(() => {
    if (userId) {
      localStorage.setItem(`indexmd_skip_existing_${userId}`, skipExistingFolders.toString());
    }
  }, [skipExistingFolders, userId]);

  const [debugSaveStatus, setDebugSaveStatus] = useState<"pending" | "confirmed" | "timeout" | "failed" | null>(null);
  const [isCountingDirectories, setIsCountingDirectories] = useState<boolean>(false);
  const [showIgnoreSettings, setShowIgnoreSettings] = useState<boolean>(false);
  const [newIgnoreName, setNewIgnoreName] = useState<string>("");
  const [isSavingIgnore, setIsSavingIgnore] = useState<boolean>(false);
  const [isDiagnosingPermissions, setIsDiagnosingPermissions] = useState<boolean>(false);
  const [firestoreDirCount, setFirestoreDirCount] = useState<number | null>(null);
  const [lastDirCountAt, setLastDirCountAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const [permissionAuditResult, setPermissionAuditResult] = useState<{
    status: "success" | "warn" | "error" | null;
    timestamp: string | null;
    message: string | null;
  } | null>(null);

  const diagnoseFirestorePermission = async () => {
    if (!userId) {
      onAddLog("error", "❌ [権限診断] ユーザーIDが取得できません。ログイン状態を確認してください。");
      setPermissionAuditResult({
        status: "error",
        timestamp: new Date().toLocaleTimeString(),
        message: "ユーザーIDが取得できません。ログイン状態を確認してください。"
      });
      return;
    }

    setIsDiagnosingPermissions(true);
    setPermissionAuditResult(null);
    const testPath = `users/${userId}/state/diagnostics`;
    const testDocRef = doc(db, "users", userId, "state", "diagnostics");
    const timestamp = new Date().toISOString();
    
    onAddLog("info", `🔍 [権限診断] Firestore (DB: ${firestoreDatabaseId}) へのアクセス権をテスト中...`);
    onAddLog("info", `🔍 [権限診断] ターゲットパス: ${testPath}`);
    onAddLog("info", `🔍 [権限診断] Auth UID: ${userId}`);

    try {
      // 1. Write Test
      onAddLog("info", "🔍 [権限診断] 書き込みテストを開始...");
      const writeResult = await runWithExplicitResult(
        setDoc(testDocRef, { 
          last_test_at: timestamp, 
          uid: userId,
          db_id: firestoreDatabaseId
        }, { merge: true }),
        5000
      );

      let writeStatus: "success" | "warn" = "success";
      if (writeResult.status === "failed") {
        if (writeResult.error.includes("permission") || writeResult.error.includes("denied")) {
          throw new Error(`Permission Denied: ${writeResult.error}`);
        } else {
          throw new Error(`Write failed: ${writeResult.error}`);
        }
      } else if (writeResult.status === "timeout") {
        onAddLog("warn", "⚠️ [権限診断] 書き込み未確認: Firestore保存の応答がタイムアウトしました。オフライン保存として継続されている可能性があります。");
        writeStatus = "warn";
      } else {
        onAddLog("success", "✅ [権限診断] 書き込み確認済み: Firestoreへの保存に応答がありました。");
      }

      // 2. Read Test
      onAddLog("info", "🔍 [権限診断] 読み取りテストを開始...");
      const snap = await getDoc(testDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.last_test_at === timestamp) {
          onAddLog("success", "✅ [権限診断] 読み取り確認済み: 保存したデータを正しく取得できました。");
          setPermissionAuditResult({
            status: writeStatus,
            timestamp: new Date().toLocaleTimeString(),
            message: `診断完了: 読み書き共に正常です。\n${writeResult.status === "timeout" ? "(書き込み時にタイムアウトが発生しましたが、オフラインキャッシュには保存されました)" : ""}`
          });
        } else {
          onAddLog("warn", `⚠️ [権限診断] 読み取り結果不一致: 保存した時間(${timestamp})と取得した時間(${data.last_test_at})が異なります。`);
          setPermissionAuditResult({
            status: "warn",
            timestamp: new Date().toLocaleTimeString(),
            message: "読み取り結果不一致: データの整合性が取れません。古いデータが返された可能性があります。"
          });
        }
      } else {
        onAddLog("warn", "⚠️ [権限診断] 読み取り未確認: ドキュメントが存在しません。書き込みがまだ反映されていない可能性があります。");
        setPermissionAuditResult({
          status: "warn",
          timestamp: new Date().toLocaleTimeString(),
          message: "読み取り未確認: 書き込み直後にデータが見つかりませんでした。反映に時間がかかっているか、書き込みに失敗している可能性があります。"
        });
      }
    } catch (error: any) {
      const msg = error.message || String(error);
      let status: "error" = "error";
      let displayMsg = `診断中にエラーが発生しました: ${msg}`;

      if (msg.includes("permission") || msg.includes("denied") || msg.includes("Missing or insufficient permissions")) {
        onAddLog("error", `❌ [権限診断] 権限エラー (Permission Denied): データベース「${firestoreDatabaseId}」のセキュリティルールによって拒否されました。`);
        onAddLog("error", `❌ [権限診断] セキュリティルール (firestore.rules) が「indexmd-db」データベースにデプロイされているか確認してください。`);
        displayMsg = `権限エラー: セキュリティルールによってアクセスが拒否されました。ルールが「${firestoreDatabaseId}」データベースにデプロイされているか確認してください。`;
      } else {
        onAddLog("error", `❌ [権限診断] 診断中にエラーが発生しました: ${msg}`);
      }
      
      setPermissionAuditResult({
        status: "error",
        timestamp: new Date().toLocaleTimeString(),
        message: displayMsg
      });
      console.error("Diagnostic failure:", error);
    } finally {
      setIsDiagnosingPermissions(false);
    }
  };

  const countFirestoreDirectories = async () => {
    if (!userId) return;
    setIsCountingDirectories(true);
    onAddLog("info", "📊 [Firestore統計] フォルダ数のカウントを開始しました...");
    try {
      const q = collection(db, "users", userId, "directories");
      const snapshot = await getCountFromServer(q);
      const count = snapshot.data().count;
      setFirestoreDirCount(count);
      setLastDirCountAt(new Date());
      onAddLog("success", `📊 [Firestore統計] カウント完了: ${count} 件のフォルダが同期されています。`);
    } catch (error: any) {
      onAddLog("error", `❌ [Firestore統計] カウント中にエラーが発生しました: ${error.message || error}`);
    } finally {
      setIsCountingDirectories(false);
    }
  };

  const getRelativeTime = (date: Date | null): string => {
    if (!date) return "未取得";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}秒前`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    return date.toLocaleTimeString();
  };

  // Job 2 State (Indexing)
  const [isIndexActive, setIsIndexActive] = useState<boolean>(false);
  const indexActiveRef = useRef<boolean>(false);
  const [currentIndexingId, setCurrentIndexingId] = useState<string | null>(null);
  const [indexingProgress, setIndexingProgress] = useState<{current: number; total: number} | null>(null);

  useEffect(() => {
    setLoading(true);
    setIsInitialSyncing(true);
    
    setTimeout(() => {
      onAddLog("info", "Firestore データベースに接続しています。フォルダ構造のリアルタイム同期を開始しました...");
    }, 0);
    
    // Fallback timer to prevent getting stuck in "Syncing..." loading state
    const fallbackTimer = setTimeout(() => {
      setLoading((prevLoading) => {
        if (prevLoading) {
          setTimeout(() => {
            onAddLog("warn", "Firestoreからのリアルタイム応答が遅延しています。オフライン状態、またはフォルダが未登録の可能性があります。走査機能およびUIの操作を有効化します。");
          }, 0);
          setIsInitialSyncing(false);
          return false;
        }
        return prevLoading;
      });
    }, 4000);

    const dirsRef = collection(db, "users", userId, "directories");
    
    // Auth state verification log
    const currentUser = auth.currentUser;
    onAddLog("info", `[Firestore初期化] 同期リスナーを開始します。UID: ${userId}, AuthUID: ${currentUser?.uid || 'null'}, DB: ${firestoreDatabaseId}`);
    
    if (currentUser && currentUser.uid !== userId) {
      onAddLog("error", `❌ [Firestore初期化] ユーザーID不一致を検出しました。Path UID: ${userId}, Auth UID: ${currentUser.uid}`);
    }

    const unsubscribe = onSnapshot(dirsRef, { includeMetadataChanges: true }, (snap) => {
      // Direct high-performance mapping from snap.docs ensures we are always 100% in sync
      // with Cloud Firestore records, eliminating any partial event state-drifts or complex
      // local map retention issues.
      const freshDirs: Directory[] = [];
      snap.docs.forEach((doc) => {
        const data = doc.data();
        freshDirs.push({
          ...data,
          drive_id: doc.id || data.drive_id
        } as Directory);
      });
      
      setDirs(freshDirs);
      
      const isCache = snap.metadata.fromCache;
      const count = freshDirs.length;
      
      // Compute last processed folder path based on last traversed/updated time
      const sortedByUpdate = freshDirs.slice().sort((a, b) => {
        const timeA = a.last_traversed_at || a.last_updated_at || '';
        const timeB = b.last_traversed_at || b.last_updated_at || '';
        return String(timeB).localeCompare(String(timeA));
      });
      const lastProcessedPath = sortedByUpdate[0]?.path || "";
      
      setSyncProgress({ current: count, lastPath: lastProcessedPath });
      
      setTimeout(() => {
        if (isCache) {
          onAddLog("info", `[データベース同期進捗] キャッシュ同期中: ${count} 件のフォルダ情報を読み込みました。 (最新フォルダ: ${lastProcessedPath || "なし"})`);
        } else {
          onAddLog("success", `[データベース同期完了] Firestore サーバーと完全に同期しました。登録フォルダ件数: ${count} 件`);
          if (lastProcessedPath) {
            onAddLog("info", `[最新同期フォルダ] 最終同期パス: ${lastProcessedPath}`);
          }
        }
      }, 0);
      
      // Prevent "No folders" display during initial network sync latency
      if (!isCache) {
        clearTimeout(fallbackTimer);
        setLoading(false);
        setIsInitialSyncing(false);
      } else if (count > 0) {
        clearTimeout(fallbackTimer);
        setLoading(false);
        setIsInitialSyncing(false);
      } // If cache is empty and fromCache is true, we let the fallbackTimer or the next snapshot resolve it
      
    }, (error) => {
      clearTimeout(fallbackTimer);
      console.error("Failed to listen to directory updates:", error);
      const msg = error.message || String(error);
      setTimeout(() => {
        if (msg.includes("permission") || msg.includes("denied")) {
          onAddLog("error", `❌ [Firestore同期エラー] 権限がありません (Missing Permissions)`);
          onAddLog("error", `🔍 DB: ${firestoreDatabaseId}, Path: users/${userId}/directories, Auth UID: ${userId}`);
          onAddLog("error", `💡 セキュリティルールが「${firestoreDatabaseId}」データベースにデプロイされているか確認してください。`);
        } else {
          onAddLog("error", "フォルダ構造のリアルタイム同期に失敗しました。", msg);
        }
      }, 0);
      setLoading(false);
      setIsInitialSyncing(false);
    });

    loadSyncState();

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
      crawlActiveRef.current = false;
      indexActiveRef.current = false;
    };
  }, [userId]);

  useEffect(() => {
    if (filteredDirs.length > 0) {
      try {
        localStorage.setItem(`indexmd_total_folders_${userId}`, String(filteredDirs.length));
        setLastKnownTotal(filteredDirs.length);
      } catch (e) {
        console.warn("Failed to save folder total to localStorage:", e);
      }
    }
  }, [filteredDirs.length, userId]);

  const loadSyncState = async () => {
    // 1. Initial attempt: Read from localStorage for near-instant responsiveness
    try {
      const cached = localStorage.getItem(`indexmd_sync_state_${userId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          setNextPageToken(parsed.nextPageToken || null);
          setLastGlobalSyncAt(parsed.last_traversed_at || null);
          setIsFullySynced(parsed.is_fully_synced !== false);
          if (parsed.skip_existing !== undefined) setSkipExistingFolders(parsed.skip_existing);
        }
      }
    } catch (e) {
      console.warn("Failed to load initial sync state from localStorage:", e);
    }

    // 2. Secondary attempt: Fetch from Firestore to sync any cross-device progress
    try {
      const snap = await getDocs(collection(db, "users", userId, "state"));
      const target = snap.docs.find(d => d.id === "global_sync");
      if (target) {
        const stateData = target.data() as any;
        setNextPageToken(stateData.nextPageToken || null);
        setLastGlobalSyncAt(stateData.last_traversed_at || null);
        setIsFullySynced(stateData.is_fully_synced !== false);
        setIgnoredFolderNames(stateData.ignored_folder_names || []);
        if (stateData.skip_existing !== undefined) setSkipExistingFolders(stateData.skip_existing);
        setRootLastTraversedAt(stateData.root_last_traversed_at || null);
        setRootNextPageToken(stateData.root_next_page_token || null);
        
        // Backup the fresh Firestore state to localStorage
        try {
          localStorage.setItem(`indexmd_sync_state_${userId}`, JSON.stringify({
            nextPageToken: stateData.nextPageToken,
            last_traversed_at: stateData.last_traversed_at
          }));
        } catch (e) {
          console.warn("Failed to backup sync state to localStorage:", e);
        }
      }
    } catch (e: any) {
      console.warn("Sync state fetch from Firestore delayed or offline:", e.message || e);
    }
  };

  type FirestoreResult = 
    | { status: "confirmed" }
    | { status: "timeout" }
    | { status: "failed", error: string };

  const runWithExplicitResult = async (
    promise: Promise<void>,
    timeoutMs: number = 3500
  ): Promise<FirestoreResult> => {
    return runWithExplicitResultHelper(promise, timeoutMs);
  };

  const saveSyncStateToDb = async (
    nextToken: string | null, 
    status: "idle" | "running" | "paused" | "error", 
    lastSyncAt: string | null,
    isComplete: boolean = false,
    rootToken: string | null = null,
    rootTraversed: string | null = null,
    overrideIgnoredList: string[] | null = null,
    overrideSkipExisting: boolean | null = null
  ) => {
    // Always update client-side local React state first
    setNextPageToken(nextToken);
    setLastGlobalSyncAt(lastSyncAt);
    setIsFullySynced(isComplete);
    if (rootToken !== null) setRootNextPageToken(rootToken);
    if (rootTraversed !== null) setRootLastTraversedAt(rootTraversed);
    if (overrideIgnoredList !== null) setIgnoredFolderNames(overrideIgnoredList);
    if (overrideSkipExisting !== null) setSkipExistingFolders(overrideSkipExisting);

    // Save state to localStorage
    try {
      localStorage.setItem(`indexmd_sync_state_${userId}`, JSON.stringify({
        nextPageToken: nextToken,
        last_traversed_at: lastSyncAt,
        is_fully_synced: isComplete,
        ignored_folder_names: overrideIgnoredList ?? ignoredFolderNames,
        skip_existing: overrideSkipExisting ?? skipExistingFolders,
        root_next_page_token: rootToken ?? rootNextPageToken,
        root_last_traversed_at: rootTraversed ?? rootLastTraversedAt
      }));
    } catch (e) {
      console.warn("Failed to save sync state backup to localStorage:", e);
    }

    try {
      const stateDocRef = doc(db, "users", userId, "state", "global_sync");
      
      const savePromise = setDoc(stateDocRef, {
        nextPageToken: nextToken,
        sync_status: status,
        last_traversed_at: lastSyncAt,
        is_fully_synced: isComplete,
        ignored_folder_names: overrideIgnoredList ?? ignoredFolderNames,
        skip_existing: overrideSkipExisting ?? skipExistingFolders,
        root_next_page_token: rootToken ?? rootNextPageToken,
        root_last_traversed_at: rootTraversed ?? rootLastTraversedAt,
        updated_at: serverTimestamp()
      }, { merge: true });

      const result = await runWithExplicitResult(savePromise, 3500);
      if (result.status === "failed") {
        if (result.error.includes("permission") || result.error.includes("denied")) {
          onAddLog("error", `⚠️ [Firestore保存エラー] 同期情報の保存権限がありません (Missing Permissions)`);
          onAddLog("error", `🔍 DB: ${firestoreDatabaseId}, Path: users/${userId}/state/global_sync`);
        } else {
          console.warn("Firestore save update non-blocking error/delay:", result.error);
        }
      } else if (result.status === "timeout") {
        console.warn("Firestore save update timeout. Operating in cache mode.");
      }
    } catch (syncErr: any) {
       console.warn("Firestore save synchronous error:", syncErr);
    }
  };

  const handleAddIgnore = async () => {
    if (!newIgnoreName.trim() || ignoredFolderNames.length >= 10) return;
    const nameToAdd = newIgnoreName.trim();
    if (ignoredFolderNames.includes(nameToAdd)) {
      setNewIgnoreName("");
      return;
    }

    setIsSavingIgnore(true);
    const newList = [...ignoredFolderNames, nameToAdd];
    await saveSyncStateToDb(nextPageToken, "idle", lastGlobalSyncAt, isFullySynced, null, null, newList);
    setNewIgnoreName("");
    setIsSavingIgnore(false);
    onAddLog("info", `「${nameToAdd}」を無視リストに追加しました。次回スキャンから除外されます。`);
  };

  const handleRemoveIgnore = async (nameToRemove: string) => {
    setIsSavingIgnore(true);
    const newList = ignoredFolderNames.filter(n => n !== nameToRemove);
    await saveSyncStateToDb(nextPageToken, "idle", lastGlobalSyncAt, isFullySynced, null, null, newList);
    setIsSavingIgnore(false);
    onAddLog("info", `「${nameToRemove}」を無視リストから削除しました。`);
  };

  const handleToggleSkipExisting = async (checked: boolean) => {
    await saveSyncStateToDb(nextPageToken, "idle", lastGlobalSyncAt, isFullySynced, null, null, null, checked);
    onAddLog("info", checked ? "✅ 登録済みフォルダのスキップ設定を有効にしました。" : "ℹ️ 登録済みフォルダのスキップ設定を無効にしました。");
  };

  // JOB 1: Traverse and Scan Folders
  const startScanJob = async (forceReset: boolean = false) => {
    if (isCrawlActive || isIndexActive) return;
    if (!token) {
      onAddLog("error", "Google認証トークンが見つかりません。アクティブセッションをリセットします。");
      onSessionExpiry?.();
      return;
    }
    setIsCrawlActive(true);
    crawlActiveRef.current = true;
    setCrawlStats({ discovered: 0, skipped: 0, ignored: 0, removed: 0 });
    onAddLog("info", forceReset ? "フォルダ全件スキャンを開始します（初期走査）..." : "インクリメンタル（差分）走査を開始します...");

    let currentToken = forceReset ? null : nextPageToken;
    let baselineTime = forceReset ? null : lastGlobalSyncAt;
    let localRootLastTraversedAt = forceReset ? null : rootLastTraversedAt;
    let localRootNextPageToken = forceReset ? null : rootNextPageToken;
    
    // Auto-lock status
    await saveSyncStateToDb(currentToken, "running", baselineTime, false);

    // Build unique directories mapping to quickly resolve depths & paths
    let localDirsMap = new Map<string, any>();
    if (!forceReset) {
      dirs.forEach(d => {
        localDirsMap.set(d.drive_id, {
          drive_id: d.drive_id,
          name: (d.path || "").split("/").pop() || d.drive_id,
          parents: d.parent_id ? [d.parent_id] : [],
          depth: d.depth || 1,
          path: d.path,
          last_traversed_at: d.last_traversed_at || null,
          next_page_token: d.next_page_token || null
        });
      });
    }

    let scannedCount = 0;
    let page = 1;

    // Resilient crawler state
    let resilientCrawlMode = false;
    let activeOldestFolder: any = null;
    let folderToken: string | null = null;
    let progressiveCount = 0;
    
    try {
      while (crawlActiveRef.current) {
        // Global limit check
        if (scanLimit > 0 && scannedCount >= scanLimit) {
          onAddLog("success", `🎯 指定されたスキャン上限（${scanLimit}件）に達したため、処理を終了します。`);
          break;
        }

        if (!resilientCrawlMode) {
          // ==========================================
          // 1. STANDARD FLAT CRAWLING MODE
          // ==========================================
          onAddLog("info", `Google Drive APIフォルダ走査中 (フラット): ページ ${page}...`);
          
          const response = await fetch("/api/drive/scan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getDriveAuthHeaders(token)
            },
            body: JSON.stringify({
              lastTraversedAt: baselineTime,
              nextPageToken: currentToken,
              scanMode: "flat-scan",
              pageSize: scanLimit > 0 ? scanLimit : 100,
              cacheScope: userId
            })
          });

          if (!response.ok) {
            const detail = await response.text();
            if (response.status === 401) {
              onSessionExpiry?.();
              throw new Error(`【401 エラー】 Google API アクセストークンが無効または期限切れです。再ログインが必要です。`);
            }
            
            onAddLog("warn", `フェッチエラーが発生したか、保存されたページトークン（Page Token）が無効です（ステータス: ${response.status}）。\n最も古い走査履歴を持つフォルダを起点とした「プログレッシブ走査」に自動切り替えして続行します...`);
            resilientCrawlMode = true;
            currentToken = null;
            await saveSyncStateToDb(null, "running", baselineTime, false);
            continue;
          }

          const data = await response.json();
          const filesReceived = data.files || [];
          
          if (data.pageTokenRecovered) {
            onAddLog("warn", "⚠️ Google Drive APIから無効なページトークンが返却されましたが、サーバー側で自動的にトークンをリセットしてリカバリしました。処理を続行します。");
          }

          if (data.cached) {
            setLastCacheHit(true);
            setTotalCacheHits(prev => prev + 1);
            onAddLog("success", "⚡️ [キャッシュヒット] ディスクキャッシュよりフォルダ走査結果を瞬時に読み込みました。");
          } else {
            setLastCacheHit(false);
            setTotalCacheMisses(prev => prev + 1);
          }
          
          // Populate temp directory mapping with new files
          filesReceived.forEach((file: any) => {
            let resolvedId = file.id;
            if (file.mimeType === "application/vnd.google-apps.shortcut" && file.shortcutDetails) {
              resolvedId = file.shortcutDetails.targetId;
            }
            localDirsMap.set(resolvedId, {
              drive_id: resolvedId,
              name: file.name,
              parents: file.parents || []
            });
          });

          // Compute path recursion helper
          const resolvePathAndDepth = (folderId: string): { path: string; depth: number } => {
            return resolvePathAndDepthHelper(folderId, localDirsMap);
          };

          // Write batch metadata directly to Firestore
          let batch = writeBatch(db);
          let batchWriteCount = 0;

          for (const file of filesReceived) {
            if (!crawlActiveRef.current) break;
            
            let resolvedId = file.id;
            if (file.mimeType === "application/vnd.google-apps.shortcut" && file.shortcutDetails) {
              resolvedId = file.shortcutDetails.targetId;
            }

            // Ignored folder check
            const { path: resolvedFullPath } = resolvePathAndDepth(resolvedId); // 変数名変更
            const isNameIgnored = isIgnoredFolderName(file.name, ignoredFolderNames);
            const isPathIgnored = isIgnoredPath(resolvedFullPath, ignoredFolderNames);

            if (isNameIgnored || isPathIgnored) {
              if (isNameIgnored) {
                setCrawlStats(prev => ({ ...prev, ignored: prev.ignored + 1 }));
              }
              const existsInDb = dirs.some(d => d.drive_id === resolvedId);
              if (existsInDb) {
                onAddLog("info", `🚫 無視設定パスに一致するため「${file.name}」をDBから除外/削除しました。`);
                setCrawlStats(prev => ({ ...prev, removed: prev.removed + 1 }));
                const folderDocRef = doc(db, "users", userId, "directories", resolvedId);
                batch.delete(folderDocRef);
                batchWriteCount++;
                
                if (batchWriteCount === 450) {
                  await batch.commit();
                  batch = writeBatch(db);
                  batchWriteCount = 0;
                }
              } else if (isNameIgnored) {
                onAddLog("info", `🚫 無視設定に一致するため「${file.name}」の追加をスキップ（無視）しました。`);
              }
              continue;
            }

            // Per-folder limit check
            if (scanLimit > 0 && scannedCount >= scanLimit) break;
            const parentId = file.parents?.[0] || null;
            const { path: fullPath, depth: computedDepth } = resolvePathAndDepth(resolvedId);

            setCurrentTaskId(resolvedId);
            setCurrentTaskName(file.name);
            setCurrentTaskPath(fullPath || `/${file.name}`);

            if (skipExistingFolders && dirs.some(d => d.drive_id === resolvedId)) {
              onAddLog("info", `⏩ すでに登録済みのフォルダ「${file.name}」をスキップしました。`);
              setCrawlStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
              continue;
            }

            const folderDocRef = doc(db, "users", userId, "directories", resolvedId);
            
            batch.set(folderDocRef, {
              drive_id: resolvedId,
              name: file.name,
              path: fullPath || `/${file.name}`,
              depth: computedDepth || 1,
              index_status: "pending",
              last_traversed_at: null,
              last_updated_at: null,
              parent_id: parentId
            }, { merge: true });

            batchWriteCount++;
            scannedCount++;
            setCrawlStats(prev => ({ ...prev, discovered: prev.discovered + 1 }));

            if (batchWriteCount === 450) {
              await batch.commit();
              batch = writeBatch(db);
              batchWriteCount = 0;
            }
          }

          if (batchWriteCount > 0) {
            await batch.commit();
          }

          currentToken = data.nextPageToken || null;
          if (currentToken) {
            onAddLog("info", `📄 継続ページトークンを取得しました: ${currentToken.substring(0, 8)}...`);
          }
          
          if (!currentToken) {
            // Flat crawl complete! Switch to Progressive folder-by-folder sweep
            onAddLog("success", "🔄 ドライブ全体の変更履歴（ページトークン）での差分チェックが完了しました。");
            onAddLog("info", "続いて、未走査、または最も最終確認日時が古いフォルダを対象とした「プログレッシブ更新」へと移行します...");
            resilientCrawlMode = true;
            
            // Mark global consistency check as completed now
            const now = new Date().toISOString();
            baselineTime = now;
            await saveSyncStateToDb(null, "running", now, false);
          } else {
            // Track progress incrementally
            await saveSyncStateToDb(currentToken, "running", baselineTime, false);
            page++;
          }
        } else {
          // ==========================================
          // 2. RESILIENT FOLDER-BY-FOLDER CRAWLING MODE (User Proposal)
          // ==========================================
          // Progressive mode doesn't need its own separate count check here if we have the global one above, 
          // but if we want to be specific:
          if (scanLimit > 0 && scannedCount >= scanLimit) {
            break;
          } else if (scanLimit === 0 && resilientCrawlMode && forceReset) {
             // In full reset mode, we just stop after flat crawl is done.
             break;
          }

          if (!activeOldestFolder) {
            // Re-fetch existing directories from memory map to evaluate oldest traversed folder candidate
            const currentDirsList: any[] = [];
            localDirsMap.forEach((val, key) => {
              currentDirsList.push({
                drive_id: key,
                name: val.name || key,
                path: val.path || `/${val.name}`,
                depth: val.depth || 1,
                last_traversed_at: val.last_traversed_at || null,
                next_page_token: val.next_page_token || null,
                parent_id: val.parents?.[0] || null
              });
            });

            // Virtual root folder item - use root-specific timestamps and tokens
            const rootItem = {
              drive_id: "root",
              path: "/",
              name: "マイドライブ",
              depth: 0,
              last_traversed_at: localRootLastTraversedAt || null,
              next_page_token: localRootNextPageToken || null,
              parent_id: null
            };

            const candidates = [rootItem, ...currentDirsList];
            // Sort by last_traversed_at ascending (nulls/empty strings first)
            candidates.sort((a, b) => {
              if (!a.last_traversed_at && !b.last_traversed_at) return 0;
              if (!a.last_traversed_at) return -1;
              if (!b.last_traversed_at) return 1;
              return new Date(a.last_traversed_at).getTime() - new Date(b.last_traversed_at).getTime();
            });

            activeOldestFolder = candidates[0];
            folderToken = activeOldestFolder.next_page_token || null;
            onAddLog("info", `[プログレッシブ走査] 起点として最も走査日時が古い（または未走査の）フォルダを選択しました: "${activeOldestFolder.name}" (${activeOldestFolder.path})`);
          }

          onAddLog("info", `[プログレッシブ走査] フォルダ「${activeOldestFolder.name}」の直下のサブフォルダをフェッチ中...`);

          const response = await fetch("/api/drive/scan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getDriveAuthHeaders(token)
            },
            body: JSON.stringify({
              parentFolderId: activeOldestFolder.drive_id,
              nextPageToken: folderToken,
              pageSize: 50,
              scanMode: "progressive-scan",
              cacheScope: userId
            })
          });

          if (!response.ok) {
            const detail = await response.text();
            if (response.status === 401) {
              onSessionExpiry?.();
              throw new Error(`【401 エラー】 Google API アクセストークンが無効または期限切れです。再ログインが必要です。`);
            }
            throw new Error(`[プログレッシブ走査失敗] Google APIエラー: ${response.status} - ${detail}`);
          }

          const data = await response.json();
          const subdirsReceived = data.files || [];

          if (data.cached) {
            setLastCacheHit(true);
            setTotalCacheHits(prev => prev + 1);
            onAddLog("success", "⚡️ [キャッシュヒット] ディスクキャッシュよりプログレッシブ走査結果を瞬時に読み込みました。");
          } else {
            setLastCacheHit(false);
            setTotalCacheMisses(prev => prev + 1);
          }

          let folderBatch = writeBatch(db);
          let folderBatchCount = 0;
          const parentCleanPath = activeOldestFolder.path === "/" ? "" : activeOldestFolder.path;

          for (const file of subdirsReceived) {
            if (!crawlActiveRef.current) break;

            let resolvedId = file.id;
            if (file.mimeType === "application/vnd.google-apps.shortcut" && file.shortcutDetails) {
              resolvedId = file.shortcutDetails.targetId;
            }

            // Ignored folder check
            const pathForCheck = `${parentCleanPath}/${file.name}`;
            const isNameIgnored = isIgnoredFolderName(file.name, ignoredFolderNames);
            const isPathIgnored = isIgnoredPath(pathForCheck, ignoredFolderNames);

            if (isNameIgnored || isPathIgnored) {
              if (isNameIgnored) {
                setCrawlStats(prev => ({ ...prev, ignored: prev.ignored + 1 }));
              }
              const existsInDb = localDirsMap.has(resolvedId);
              if (existsInDb) {
                onAddLog("info", `🚫 無視設定パスに一致するため「${file.name}」をDBから除外/削除しました。`);
                setCrawlStats(prev => ({ ...prev, removed: prev.removed + 1 }));
                const folderDocRef = doc(db, "users", userId, "directories", resolvedId);
                folderBatch.delete(folderDocRef);
                folderBatchCount++;

                if (folderBatchCount === 450) {
                  await folderBatch.commit();
                  folderBatch = writeBatch(db);
                  folderBatchCount = 0;
                }
              } else if (isNameIgnored) {
                onAddLog("info", `🚫 無視設定に一致するため「${file.name}」の追加をスキップ（無視）しました。`);
              }
              continue;
            }

            // Per-folder limit check
            if (scanLimit > 0 && scannedCount >= scanLimit) break;

            const parentId = activeOldestFolder.drive_id;
            const fullPath = `${parentCleanPath}/${file.name}`;
            const computedDepth = activeOldestFolder.depth + 1;

            setCurrentTaskId(resolvedId);
            setCurrentTaskName(file.name);
            setCurrentTaskPath(fullPath);

            const existingDir = localDirsMap.get(resolvedId);
            
            if (skipExistingFolders && existingDir) {
              onAddLog("info", `⏩ すでに登録済みのフォルダ「${file.name}」をスキップしました。`);
              setCrawlStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
              continue;
            }

            const needsUpdate = !existingDir || existingDir.path !== fullPath || existingDir.parent_id !== parentId;

            if (needsUpdate) {
              const folderDocRef = doc(db, "users", userId, "directories", resolvedId);
              
              folderBatch.set(folderDocRef, {
                drive_id: resolvedId,
                name: file.name,
                path: fullPath,
                depth: computedDepth,
                index_status: (existingDir?.index_status) ?? "pending",
                last_traversed_at: existingDir?.last_traversed_at ?? null,
                last_updated_at: existingDir?.last_updated_at ?? null,
                parent_id: parentId
              }, { merge: true });

              folderBatchCount++;
              scannedCount++;
              setCrawlStats(prev => ({ ...prev, discovered: prev.discovered + 1 }));

              if (folderBatchCount === 450) {
                await folderBatch.commit();
                folderBatch = writeBatch(db);
                folderBatchCount = 0;
              }
            }

            localDirsMap.set(resolvedId, {
              ...existingDir,
              drive_id: resolvedId,
              name: file.name,
              parents: [parentId],
              parent_id: parentId,
              depth: computedDepth,
              path: fullPath,
              last_traversed_at: existingDir ? existingDir.last_traversed_at : null
            });
          }

          if (folderBatchCount > 0) {
            await folderBatch.commit();
          }

          folderToken = data.nextPageToken || null;
          const finishedTime = new Date().toISOString();

          // Immediately update traversed_at and next_page_token so this folder is put at the back of the queue (Round Robin)
          if (activeOldestFolder.drive_id === "root") {
            localRootNextPageToken = folderToken;
            localRootLastTraversedAt = finishedTime;
            await saveSyncStateToDb(currentToken, "running", baselineTime, false, localRootNextPageToken, localRootLastTraversedAt);
          } else {
            const parentFolderRef = doc(db, "users", userId, "directories", activeOldestFolder.drive_id);
            await setDoc(parentFolderRef, {
              last_traversed_at: finishedTime,
              next_page_token: folderToken
            }, { merge: true });

            const existingInMap = localDirsMap.get(activeOldestFolder.drive_id);
            if (existingInMap) {
              existingInMap.last_traversed_at = finishedTime;
              existingInMap.next_page_token = folderToken;
            }
          }

          if (!folderToken) {
            // Finished crawling all pages of subfolders of this activeOldestFolder!
            onAddLog("success", `[プログレッシブ走査完了] フォルダ「${activeOldestFolder.name}」の全走査が完了しました。`);
          } else {
            onAddLog("info", `[プログレッシブ走査継続] フォルダ「${activeOldestFolder.name}」の一部のページ走査が完了しました。順次他のフォルダを先に走査します...`);
          }
          
          progressiveCount++;
          // Set activeOldestFolder to null so the next loop cycle picks the next oldest candidate (Round Robin)
          activeOldestFolder = null;
        }

        // Delay between iterations to conform with rate limits
        await new Promise(r => setTimeout(r, config.rate_limit_delay_ms));
      }

      const reachedLimit = scanLimit > 0 && scannedCount >= scanLimit;

      if (!crawlActiveRef.current || reachedLimit) {
        // Interrupted by user cancellation or reached limit
        await saveSyncStateToDb(currentToken, "idle", baselineTime, false);
        if (reachedLimit) {
          // Already logged success in the loop
        } else {
          onAddLog("warn", `ユーザーによってフォルダ走査が一時停止/中断されました。進行状況を保存しました。`);
        }
        return;
      }

      // Complete traversal successfully
      const completionTime = new Date().toISOString();
      await saveSyncStateToDb(null, "idle", completionTime, true);
      onAddLog("success", `ドライブ全体の走査（変更履歴の同期）が完了しました。新たに ${scannedCount} 件のフォルダが同期されました。`);

    } catch (err: any) {
      onAddLog("error", "フォルダ走査中にエラーが発生し、処理が中断されました。", err.message || err);
      if (!err.message?.includes("401")) {
        await saveSyncStateToDb(currentToken, "error", baselineTime, false);
      }
    } finally {
      setIsCrawlActive(false);
    }
  };

  // JOB 2: OKF index.md index generation bottom-up
  const startGenerationJob = async () => {
    if (isIndexActive || isCrawlActive) return;
    if (filteredDirs.length === 0) {
      onAddLog("warn", "インデックスを生成するためのフォルダデータがありません。先に走査を実行してください。");
      return;
    }
    if (!token) {
      onAddLog("error", "Google認証トークンが見つかりません。アクティブセッションをリセットします。");
      onSessionExpiry?.();
      return;
    }

    setIsIndexActive(true);
    indexActiveRef.current = true;
    onAddLog("info", "ボトムアップ型（階層順）のOKF index.md 生成プロセスを起動中...");

    // Sort folders by depth decending (bottom-up: deep folders first)
    const sortedDirs = [...filteredDirs].sort((a,b) => b.depth - a.depth);
    setIndexingProgress({ current: 0, total: sortedDirs.length });

    let successCount = 0;
    let skipCount = 0;

    try {
      for (let i = 0; i < sortedDirs.length; i++) {
        if (!indexActiveRef.current) {
          onAddLog("warn", "ユーザーによってインデックス作成処理が中断されました。");
          break;
        }
        
        const item = sortedDirs[i];
        setCurrentIndexingId(item.drive_id);
        setIndexingProgress({ current: i + 1, total: sortedDirs.length });
        setCurrentTaskName((item.path || "").split('/').pop() || item.drive_id);
        setCurrentTaskPath(item.path);

        onAddLog("info", `[インデックス作成中...] 階層パス (${item.depth}): ${item.path}`);

        // Update directory status in Firestore to "processing"
        const itemRef = doc(db, "users", userId, "directories", item.drive_id);
        await updateDoc(itemRef, { index_status: "processing" });

        // Retrieve pre-generated summaries of immediately lower subfolders to support cascading summary propagation
        // Children of this folder have: parent_id = current drive_id
        const childDirs = filteredDirs.filter(d => d.parent_id === item.drive_id);
        const subdirsWithSummaries = childDirs.map(child => ({
          id: child.drive_id,
          name: (child.path || "").split("/").pop() || "",
          summary: child.ai_summary || "要約未生成"
        }));

        // Request individual step summary & index md builder
        const response = await fetch("/api/drive/generate-index-step", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getDriveAuthHeaders(token)
          },
          body: JSON.stringify({
            folderId: item.drive_id,
            folderName: (item.path || "").split("/").pop() || "マイドライブ",
            config: config,
            subdirsWithSummaries
          })
        });

        if (!response.ok) {
          const errMsg = await response.text();
          if (response.status === 401) {
            onSessionExpiry?.();
            throw new Error(`【401 エラー】 Google API アクセストークンが無効または期限切れです。再ログインが必要です。`);
          }
          throw new Error(`インデックス生成処理に失敗しました。対象: ${item.path} - ${errMsg}`);
        }

        const data = await response.json();
        
        if (data.skipped) {
          // Folder empty, marked as indexed but summary skipped
          await updateDoc(itemRef, {
            index_status: "indexed",
            ai_summary: "(空フォルダのため概要スキップ)",
            last_updated_at: new Date().toISOString()
          });
          onAddLog("info", `空のフォルダをスキップしました: ${item.path}`);
          skipCount++;
        } else {
          // Core update
          await updateDoc(itemRef, {
            index_status: "indexed",
            ai_summary: data.aiSummary || "",
            last_updated_at: new Date().toISOString()
          });
          onAddLog("success", `[完了] ${item.path} の index.md ファイルを生成・配置しました。`);
          successCount++;
        }

        // Apply rate interval delay
        await new Promise(r => setTimeout(r, config.rate_limit_delay_ms));
      }

      onAddLog("success", `すべてのインデックス処理が成功しました。生成完了: ${successCount} 件, スキップ: ${skipCount} 件。`);

    } catch (err: any) {
      onAddLog("error", "インデックス作成処理が中断されました。中断箇所よりリカバリを必要とします。", err.message || err);
      if (currentIndexingId && !err.message?.includes("401")) {
        try {
          await updateDoc(doc(db, "users", userId, "directories", currentIndexingId), {
            index_status: "error"
          });
        } catch (updateErr) {
          console.error("Failed to update index status to error", updateErr);
        }
      }
    } finally {
      setIsIndexActive(false);
      setCurrentIndexingId(null);
      setIndexingProgress(null);
    }
  };

  const handleCopyDiagnostics = async () => {
    if (!lastDebugFolder) return;
    
    let textToCopy = "";
    if (lastDebugFolder.empty) {
      textToCopy = "フォルダは全て取得しきり、終端に達しています。";
    } else {
      textToCopy = `[最新の取得フォルダ診断データ]
Name: ${lastDebugFolder.name}
Resolved Path: ${lastDebugFolder.path}
Inferred Depth: ${lastDebugFolder.depth} (Level ${lastDebugFolder.depth})
Target Folder ID: ${lastDebugFolder.drive_id}
Parent Folder ID: ${lastDebugFolder.parent_id || "root / None"}
Mime Type: ${lastDebugFolder.originalMimeType}
Returned Next Token: ${lastDebugFolder.nextToken || "Null (Complete)"}
Firestore Path: users/${userId}/directories/${lastDebugFolder.drive_id}`;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedDiagnostics(true);
      setTimeout(() => setCopiedDiagnostics(false), 2000);
    } catch (err) {
      console.error("Failed to copy diagnostic data: ", err);
    }
  };

  // Debug Routine: fetch exactly 1 folder from Drive API
  const fetchSingleFolderDebug = async () => {
    if (isCrawlActive || isIndexActive) {
      onAddLog("warn", "⚠️ [警告] 走査またはインデックス作成がすでに実行中です。デバッグ走査を行う前に停止してください。");
      return;
    }
    if (!token) {
      onAddLog("error", "Google認証トークンが見つかりません。アクティブセッションをリセットします。");
      onSessionExpiry?.();
      return;
    }
    setDebugLoading(true);
    isManualCancelRef.current = false;
    onAddLog("info", "🔧 [デバッグ走査] Google Drive APIへ1ステップリクエストを送信しました。レスポンスを待機しています（15秒タイムアウト制限設定）...");

    // Setup heartbeat updates to give user progress and visibility
    let elapsedTime = 0;
    const heartbeatTimer = setInterval(() => {
      elapsedTime += 2;
      if (elapsedTime < 15) {
        onAddLog("info", `🔧 [デバッグ走査] レスポンス待機中... (${elapsedTime}秒経過)`);
      }
    }, 2000);

    const controller = new AbortController();
    debugAbortControllerRef.current = controller;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      // Build unique directories mapping to resolve path & depth
      let localDirsMap = new Map<string, any>();
      dirs.forEach((d) => {
        localDirsMap.set(d.drive_id, {
          drive_id: d.drive_id,
          name: (d.path || "").split("/").pop() || d.drive_id,
          parents: d.parent_id ? [d.parent_id] : []
        });
      });

      const response = await fetch("/api/drive/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDriveAuthHeaders(token)
        },
        body: JSON.stringify({
          lastTraversedAt: lastGlobalSyncAt,
          nextPageToken: nextPageToken,
          pageSize: debugPageSize,
          scanMode: "debug-step",
          bypassCache: true,
          cacheScope: userId
        }),
        signal: controller.signal
      });

      // Clear timers immediately once request finishes
      clearTimeout(timeoutId);
      clearInterval(heartbeatTimer);
      debugAbortControllerRef.current = null;

      if (!response.ok) {
        const detail = await response.text();
        if (response.status === 401) {
          onSessionExpiry?.();
          throw new Error(`【401 エラー】 Google API アクセストークンが無効または期限切れです。再ログインが必要です。`);
        }
        throw new Error(`Google API同期エラー: ${response.status} - ${detail}`);
      }

      const data = await response.json();
      const filesReceived = data.files || [];
      const returnedNextToken = data.nextPageToken || null;

      if (data.pageTokenRecovered) {
        onAddLog("warn", "⚠️ Google Drive APIから無効なページトークンが返却されましたが、サーバー側で自動的にトークンをリセットしてリカバリしました。処理を続行します。");
      }

      if (data.cached) {
        setLastCacheHit(true);
        setTotalCacheHits(prev => prev + 1);
        onAddLog("success", "⚡️ [キャッシュヒット] [デバッグ走査] ディスクキャッシュより結果を読み込みました。");
      } else {
        setLastCacheHit(false);
        setTotalCacheMisses(prev => prev + 1);
      }

      if (filesReceived.length === 0) {
        onAddLog("warn", "🔧 [デバッグ走査] 対象フォルダが見つかりませんでした (すべてのフォルダが同期済み、または該当なし)。");
        setLastDebugFolder({ empty: true });
        await saveSyncStateToDb(null, "idle", lastGlobalSyncAt, isFullySynced);
        setDebugLoading(false);
        return;
      }

      onAddLog("success", `🔧 [デバッグ走査] Google Drive APIから${filesReceived.length}件のフォルダ情報を取得しました。`);

      onAddLog("info", "🔧 [デバッグ走査] Firestoreへフォルダ情報の保存を開始します...");
      setDebugSaveStatus("pending");

      try {
        const batch = writeBatch(db);
        let validFoldersCount = 0;
        let lastProcessedFile: any = null;
        let lastFolderObj: any = null;

        for (const file of filesReceived) {
          let resolvedId = file.id;
          if (file.mimeType === "application/vnd.google-apps.shortcut" && file.shortcutDetails) {
            resolvedId = file.shortcutDetails.targetId;
          }

          // Add to local mapping for resolving tree depth paths
          localDirsMap.set(resolvedId, {
            drive_id: resolvedId,
            name: file.name,
            parents: file.parents || []
          });

          const resolvePathAndDepth = (folderId: string): { path: string; depth: number } => {
            return resolvePathAndDepthHelper(folderId, localDirsMap);
          };

          const parentId = file.parents?.[0] || null;
          const { path: fullPath, depth: computedDepth } = resolvePathAndDepth(resolvedId);

          const folderDocRef = doc(db, "users", userId, "directories", resolvedId);
          const newFolderObj = {
            drive_id: resolvedId,
            name: file.name,
            path: fullPath || `/${file.name}`,
            depth: computedDepth || 1,
            index_status: "pending",
            last_traversed_at: new Date().toISOString(),
            last_updated_at: null,
            parent_id: parentId
          };

          batch.set(folderDocRef, newFolderObj, { merge: true });
          validFoldersCount++;
          lastProcessedFile = file;
          lastFolderObj = newFolderObj;
        }

        if (validFoldersCount > 0) {
          const result = await runWithExplicitResult(batch.commit(), 10000);

          if (result.status === "failed") {
            setDebugSaveStatus("failed");
            onAddLog("error", `❌ [デバッグ走査] Firestore保存に失敗しました。取得したフォルダ情報は永続化されていません。: ${result.error}`);
          } else if (result.status === "timeout") {
            setDebugSaveStatus("timeout");
            onAddLog("warn", "⚠️ [デバッグ走査] Firestore保存確認がタイムアウトしました。取得結果は画面に表示していますが、永続化は未確認です。");
          } else {
            setDebugSaveStatus("confirmed");
            onAddLog("success", `🔧 [デバッグ走査] Firestore保存確認済み (${validFoldersCount}件): 最終処理フォルダ "${lastFolderObj?.path}"`);
          }
        } else {
            setDebugSaveStatus("confirmed");
        }
      } catch (saveErr: any) {
        setDebugSaveStatus("failed");
        onAddLog("error", `❌ [デバッグ走査] Firestore保存に例外が発生しました。: ${saveErr.message || saveErr}`);
      }

      // Page token persistence with more error info
      try {
        const nextTraversedTime = filesReceived[filesReceived.length - 1].modifiedTime || new Date().toISOString();
        await saveSyncStateToDb(returnedNextToken, "idle", nextTraversedTime, false);
      } catch (tokenErr: any) {
        const msg = tokenErr.message || String(tokenErr);
        if (msg.includes("permission") || msg.includes("denied")) {
          onAddLog("error", `❌ [デバッグ走査] 同期トークンの保存権限がありません (DB: ${firestoreDatabaseId}, Path: users/${userId}/state/global_sync)`);
        }
      }

      if (filesReceived.length > 0) {
        const file = filesReceived[filesReceived.length - 1];
        let resolvedId = file.id;
        if (file.mimeType === "application/vnd.google-apps.shortcut" && file.shortcutDetails) {
          resolvedId = file.shortcutDetails.targetId;
        }
        const { path: fullPath, depth: computedDepth } = resolvePathAndDepthHelper(resolvedId, localDirsMap);
        
        setLastDebugFolder({
          drive_id: resolvedId,
          name: file.name,
          path: fullPath || `/${file.name}`,
          depth: computedDepth || 1,
          index_status: "pending",
          last_traversed_at: new Date().toISOString(),
          last_updated_at: null,
          parent_id: file.parents?.[0] || null,
          originalMimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          nextToken: returnedNextToken
        });
      }

    } catch (e: any) {
      clearTimeout(timeoutId);
      clearInterval(heartbeatTimer);
      debugAbortControllerRef.current = null;
      console.error(e);
      if (isManualCancelRef.current) {
        // Manual interruption is already logged inside cancelDebugScan. No need to double log.
      } else if (e.name === "AbortError" || e.message?.includes("aborted")) {
        onAddLog("error", "🔧 [デバッグ走査タイムアウト] Google Drive APIの応答が15秒以内にありませんでした。処理を中断します。再度お試しください。");
      } else if (e.message?.includes("pageToken") && (e.message?.includes("Invalid") || e.message?.includes("invalid"))) {
        onAddLog("warn", "⚠️ Google Drive APIから無効なページトークン(pageToken)が検出されました。走査位置を自動修正（pageToken=null）しました。もう一度「1ステップ走査」ボタンをクリックすると、最新の変更点から再スキャンが開始されます。");
        await saveSyncStateToDb(null, "idle", lastGlobalSyncAt, false);
      } else {
        onAddLog("error", "🔧 [デバッグ走査失敗] 追加フェッチエラー", e.message || e);
      }
    } finally {
      debugAbortControllerRef.current = null;
      setDebugLoading(false);
    }
  };

  // Find oldest and newest traversed folders
  const allFoldersForStats = [
    ...filteredDirs,
    {
      drive_id: "root",
      name: "マイドライブ (Root)",
      path: "/",
      depth: 0,
      last_traversed_at: rootLastTraversedAt,
      next_page_token: rootNextPageToken,
      index_status: "pending" as const,
    }
  ];
  
  // Calculate the queue FIRST with deterministic tie-breaking (Oldest first)
  const traversalQueue = allFoldersForStats.length > 0
    ? [...allFoldersForStats].sort((a, b) => {
        // Null/undefined last_traversed_at comes first (highest priority)
        if (!a.last_traversed_at && !b.last_traversed_at) {
          return (a.path || "").localeCompare(b.path || "");
        }
        if (!a.last_traversed_at) return -1;
        if (!b.last_traversed_at) return 1;
        
        const timeA = new Date(a.last_traversed_at).getTime();
        const timeB = new Date(b.last_traversed_at).getTime();
        
        if (timeA === timeB) {
          return (a.path || "").localeCompare(b.path || "");
        }
        return timeA - timeB;
      })
    : [];

  const buildBreadcrumbPath = (dirId: string): { id: string, name: string }[] => {
    let currentId: string | null = dirId;
    const breadcrumb: { id: string, name: string }[] = [];
    
    const visited = new Set<string>();
    
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const dir = dirs.find(d => d.drive_id === currentId);
      if (dir) {
        const pathStr = dir.path || "";
        const parts = pathStr.replace(/\/$/, '').split('/');
        const dirName = parts.length > 0 && parts[parts.length - 1] ? parts[parts.length - 1] : currentId;
        breadcrumb.unshift({ id: dir.drive_id, name: dirName || currentId });
        currentId = dir.parent_id;
      } else {
        breadcrumb.unshift({ id: currentId, name: currentId === "root" ? "マイドライブ" : "..." });
        break;
      }
    }
    
    return breadcrumb;
  };

  const handleStopProcessing = () => {
    if (isCrawlActive) {
      crawlActiveRef.current = false;
      setIsCrawlActive(false);
      onAddLog("warn", "ユーザーによってフォルダ走査処理のキャンセルが要求されました。直ちに安全に停止します。");
    }
    if (isIndexActive) {
      indexActiveRef.current = false;
      setIsIndexActive(false);
      onAddLog("warn", "ユーザーによってインデックス生成のキャンセルが要求されました。プロセスを安全に中断します。");
    }
  };

  return (
    <div className="space-y-6">
      {/* Bento Grid Stats - Removed as requested */}
      {/* (Next item in list follows) */}

      {/* View Mode Tabs */}
      <div className="flex border-b border-slate-200" id="tabs-navigation">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "dashboard"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600 bg-transparent"
          }`}
          id="btn-tab-dashboard"
        >
          <Folder className="w-4 h-4" />
          フォルダスキャンテスト
        </button>
        <button
          onClick={() => setActiveTab("debugger")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "debugger"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600 bg-transparent"
          }`}
          id="btn-tab-debugger"
        >
          <Bug className="w-4 h-4" />
          フォルダ情報取得テスト
        </button>
        <button
          onClick={() => setActiveTab("summary-debugger")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "summary-debugger"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600 bg-transparent"
          }`}
          id="btn-tab-summary-debugger"
        >
          <Sparkles className="w-4 h-4" />
          AI要約テスト
        </button>
        <button
          onClick={() => setActiveTab("firestore-test")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "firestore-test"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600 bg-transparent"
          }`}
          id="btn-tab-firestore-test"
        >
          <Database className="w-4 h-4" />
          Firestoreテスト
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "logs"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600 bg-transparent"
          }`}
          id="btn-tab-logs"
        >
          <Terminal className="w-4 h-4" />
          システムログ
        </button>
      </div>

      <div className="mt-6" id="tabs-content">
        {activeTab === "dashboard" && (
          <div className="space-y-6" id="dashboard-container">
            {/* Action Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => startScanJob(false)}
                  disabled={isCrawlActive || isIndexActive}
                  className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none transition-colors text-white font-bold px-4 py-2 rounded-md text-[10px] sm:text-xs cursor-pointer shadow-sm w-full sm:w-auto"
                  id="btn-scan-incremental"
                >
                  <FolderSync className="w-3.5 h-3.5" />
                  スキャン
                </button>

                <div className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md shadow-sm h-full group hover:bg-white transition-colors w-full sm:w-auto">
                  <SlidersHorizontal className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter shrink-0">上限:</span>
                  <select 
                    value={scanLimit} 
                    onChange={(e) => setScanLimit(Number(e.target.value))}
                    disabled={isCrawlActive || isIndexActive}
                    className="text-[10px] sm:text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer disabled:opacity-50 pr-1"
                  >
                    <option value={1}>1件</option>
                    <option value={5}>5件</option>
                    <option value={100}>100件</option>
                    <option value={500}>500件</option>
                    <option value={1000}>1000件</option>
                    <option value={0}>無制限</option>
                  </select>
                </div>

                <button
                  onClick={() => setShowIgnoreSettings(!showIgnoreSettings)}
                  className={`flex items-center justify-center gap-2 px-3 py-2 border rounded-md shadow-sm transition-all text-[10px] sm:text-xs font-bold w-full sm:w-auto ${
                    showIgnoreSettings 
                    ? "bg-slate-700 text-white border-slate-700" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                  title="無視するフォルダを設定"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  設定
                  {ignoredFolderNames.length > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 bg-indigo-500 text-[10px] text-white rounded-full">
                      {ignoredFolderNames.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={startGenerationJob}
                  disabled={isCrawlActive || isIndexActive || filteredDirs.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none transition-colors text-white font-bold px-4 py-2 rounded-md text-[10px] sm:text-xs cursor-pointer shadow-sm w-full sm:w-auto"
                  id="btn-generate-indices"
                >
                  <Play className="w-3.5 h-3.5" />
                  インデックス
                </button>
              </div>
            </div>

            {/* Configuration Panels */}
            {showIgnoreSettings && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-700">
                    <EyeOff className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">無視するフォルダ名 (最大10個)</h3>
                  </div>
                  <button 
                    onClick={() => setShowIgnoreSettings(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                  ここで指定した名前と完全に一致するフォルダは、スキャン対象から除外されます。
                  (例: <code className="bg-slate-200 px-1 rounded">node_modules</code>, <code className="bg-slate-200 px-1 rounded">.git</code> など)
                </p>

                <div className="space-y-3">
                  {/* Skip existing folders option */}
                  <div className="flex items-center gap-3 bg-white border border-slate-200 rounded p-3 mb-4">
                    <input 
                      type="checkbox"
                      id="skip-existing-folders"
                      checked={skipExistingFolders}
                      onChange={(e) => handleToggleSkipExisting(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="skip-existing-folders" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      登録済みのフォルダをスキップする (高速化)
                    </label>
                  </div>

                  {/* Add Input */}
                  {ignoredFolderNames.length < 10 && (
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={newIgnoreName}
                        onChange={(e) => setNewIgnoreName(e.target.value)}
                        placeholder="フォルダ名を入力..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newIgnoreName.trim()) {
                            handleAddIgnore();
                          }
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <button 
                        onClick={handleAddIgnore}
                        disabled={!newIgnoreName.trim() || isSavingIgnore}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        追加
                      </button>
                    </div>
                  )}

                  {/* List */}
                  <div className="flex flex-wrap gap-2">
                    {ignoredFolderNames.length === 0 ? (
                      <span className="text-[10px] text-slate-400 italic">登録されているフォルダ名はありません</span>
                    ) : (
                      ignoredFolderNames.map((name) => (
                        <div 
                          key={name}
                          className="flex items-center gap-1.5 bg-white border border-slate-200 pl-2.5 pr-1.5 py-1 rounded-full group hover:border-red-200 transition-colors shadow-sm"
                        >
                          <span className="text-xs font-medium text-slate-700">{name}</span>
                          <button 
                            onClick={() => handleRemoveIgnore(name)}
                            disabled={isSavingIgnore}
                            className="p-0.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {isCrawlActive && (
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg mb-4 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      Google Drive API 走査中...
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded border border-slate-100 shadow-sm" title="新規/更新">
                      <Database className="w-2.5 h-2.5 text-indigo-500" />
                      <span className="text-[10px] font-mono font-bold text-slate-700">{crawlStats.discovered} {scanLimit > 0 ? `/ ${scanLimit}` : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 shadow-sm" title="既存スキップ">
                      <FastForward className="w-2.5 h-2.5 text-amber-500" />
                      <span className="text-[10px] font-mono font-bold text-amber-700">{crawlStats.skipped}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shadow-sm" title="設定による無視">
                      <EyeOff className="w-2.5 h-2.5 text-slate-500" />
                      <span className="text-[10px] font-mono font-bold text-slate-700">{crawlStats.ignored}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 shadow-sm" title="DBから削除">
                      <FolderX className="w-2.5 h-2.5 text-rose-500" />
                      <span className="text-[10px] font-mono font-bold text-rose-700">{crawlStats.removed}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full h-1 bg-indigo-100 rounded-full overflow-hidden mb-2 relative">
                  {scanLimit > 0 ? (
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((crawlStats.discovered / scanLimit) * 100))}%` }}
                    />
                  ) : (
                    <div 
                      className="h-full bg-indigo-400/50 absolute inset-0 animate-pulse"
                    />
                  )}
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 bg-white/50 px-2 py-1.5 rounded border border-slate-100/50">
                    <div className="shrink-0 w-4 h-4 rounded-sm bg-indigo-100 flex items-center justify-center">
                      <Folder className="w-2.5 h-2.5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-700 truncate">{currentTaskName || "待機中..."}</span>
                        <span className="text-[8px] font-mono text-slate-400 shrink-0 select-all">{currentTaskId}</span>
                      </div>
                      <div className="text-[9px] font-mono text-slate-500 truncate mt-0.5">
                        <span className="text-slate-300 mr-1">Path:</span>{currentTaskPath || "/"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isIndexActive && indexingProgress && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg mb-4 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      OKF インデックス生成中...
                    </span>
                  </div>
                  <div className="text-[10px] font-mono font-bold text-emerald-600">
                    {indexingProgress.current} / {indexingProgress.total}
                  </div>
                </div>
                <div className="w-full h-1 bg-emerald-100 rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.round((indexingProgress.current / (indexingProgress.total || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded border border-emerald-100/50">
                  <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-[9px] font-mono text-emerald-600 truncate flex-1">
                    {currentTaskName}
                  </span>
                </div>
              </div>
            )}

            {/* Next Scan Strategy Panel */}
            <div className="space-y-3 bg-slate-50 border border-slate-200/85 p-4 rounded-lg" id="extremes-traversed-panel">
              <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider mb-2">
                <Zap className="w-3.5 h-3.5 text-indigo-500" />
                次回のスキャン開始予定
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Priority 1: Page Token */}
                <div className={`p-3 rounded-lg border transition-all ${nextPageToken ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/20' : 'bg-white border-slate-200 opacity-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-amber-700 uppercase">優先 1: 継続トークン</span>
                    {nextPageToken && <CheckCircle className="w-3 h-3 text-amber-500" />}
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 leading-relaxed">
                    {nextPageToken ? (
                      <div className="space-y-1">
                        <p>前回の走査の続きから再開します。</p>
                        <code className="block p-1 bg-white border border-amber-100 rounded text-[9px] font-mono truncate select-all">{nextPageToken}</code>
                      </div>
                    ) : (
                      <p className="italic text-slate-400">現在、継続トークンはありません</p>
                    )}
                  </div>
                </div>

                {/* Priority 2: Unvisited */}
                {(() => {
                  const unvisited = traversalQueue.find(f => !f.last_traversed_at);
                  const isActive = !nextPageToken && unvisited;
                  return (
                    <div className={`p-3 rounded-lg border transition-all ${isActive ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' : 'bg-white border-slate-200 opacity-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase">優先 2: 未走査フォルダ</span>
                        {isActive && <CheckCircle className="w-3 h-3 text-indigo-500" />}
                      </div>
                      <div className="text-[11px] font-medium text-slate-600 leading-relaxed">
                        {unvisited ? (
                          <div className="space-y-1">
                            <p>発見済みで未訪問のフォルダから開始します。</p>
                            <div className="flex items-center gap-1 text-indigo-600 font-bold truncate">
                              <Folder className="w-3 h-3" />
                              <span className="truncate">{unvisited.name || unvisited.path}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="italic text-slate-400">未走査のフォルダはありません</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Priority 3: Oldest */}
                {(() => {
                  const oldest = traversalQueue.find(f => f.last_traversed_at);
                  const isActive = !nextPageToken && !traversalQueue.find(f => !f.last_traversed_at) && oldest;
                  return (
                    <div className={`p-3 rounded-lg border transition-all ${isActive ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-500/20' : 'bg-white border-slate-200 opacity-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">優先 3: 最古の訪問済み</span>
                        {isActive && <CheckCircle className="w-3 h-3 text-slate-500" />}
                      </div>
                      <div className="text-[11px] font-medium text-slate-600 leading-relaxed">
                        {oldest ? (
                          <div className="space-y-1">
                            <p>最後に訪問してから最も時間が経過したフォルダを再訪します。</p>
                            <div className="flex items-center gap-1 text-slate-700 font-bold truncate">
                              <Folder className="w-3 h-3" />
                              <span className="truncate">{oldest.name || oldest.path}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="italic text-slate-400">訪問済みのフォルダはありません</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Directory Structure Tree / List Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-inner">
              <div className="grid grid-cols-12 gap-2 bg-slate-50 p-2.5 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <div className="col-span-5 md:col-span-6">フォルダ階層 (Path)</div>
                <div className="col-span-2 text-center">階層 (Depth)</div>
                <div className="col-span-3 text-center">インデックス状態</div>
                <div className="col-span-2 text-right">フォルダID</div>
              </div>

              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto custom-scrollbar">
                {isInitialSyncing && filteredDirs.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-500 font-mono italic block flex flex-col items-center justify-center space-y-4">
                    <Database className="w-6 h-6 animate-bounce text-indigo-500 opacity-75" />
                    <div className="space-y-1">
                      <p className="font-bold text-slate-700 not-italic">Firestore データベースとリアルタイム同期中...</p>
                      {syncProgress && (
                        <p className="text-slate-400">
                          {syncProgress.current} 件のフォルダメタデータを取得済み
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  filteredDirs.length === 0 ? (
                    <div className="p-20 text-center space-y-3">
                      <div className="inline-flex p-3 bg-slate-50 rounded-full text-slate-300">
                        <Folder className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-slate-400 font-medium italic">フォルダが見つかりません</p>
                    </div>
                  ) : (
                    filteredDirs.slice(0, 100).map((dir) => (
                      <div key={dir.drive_id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-50 transition-colors group">
                        <div className="col-span-5 md:col-span-6 flex items-center gap-2.5 overflow-hidden">
                          <div className="shrink-0 w-8 h-8 rounded bg-slate-50 flex items-center justify-center group-hover:bg-white transition-colors">
                            <Folder className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-bold text-slate-700 truncate" title={dir.path}>
                              {dir.name || (dir.path === "/" ? "マイドライブ" : (dir.path || "").split('/').pop())}
                            </span>
                            <span className="text-[9px] text-slate-400 truncate font-mono" title={dir.path}>{dir.path}</span>
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                            L{dir.depth}
                          </span>
                        </div>
                        <div className="col-span-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                              dir.index_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              dir.index_status === 'processing' ? 'bg-indigo-100 text-indigo-700 animate-pulse' :
                              'bg-slate-100 text-slate-50'
                            }`}>
                              {dir.index_status}
                            </span>
                          </div>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-[9px] font-mono text-slate-300 select-all" title={dir.drive_id}>
                            {(dir.drive_id || "").slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "debugger" && (
          <div className="space-y-6" id="debugger-container">
            {/* Core Interactive Step Trigger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 1ステップ走査制御
                </h4>
                
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <p className="text-xs text-slate-600 leading-relaxed sm:max-w-[75%]">
                    下のボタンをクリックすると、Google Driveから現在の同期位置（Page Token）に続く <strong>次の{debugPageSize}つのフォルダ</strong> を取得し、パス・深度を再帰算出（BFS風にメモリマッピング構築）して、リアルタイムにFirestoreへ登録します。
                  </p>
                  <button
                    onClick={() => setShowDebugSettings(!showDebugSettings)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 border rounded shadow-sm transition-all text-[10px] font-bold shrink-0 ${
                      showDebugSettings 
                      ? "bg-slate-700 text-white border-slate-700" 
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                    title="取得設定"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    設定
                  </button>
                </div>

                {showDebugSettings && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="bg-slate-100 border border-slate-200 rounded-lg p-3 mb-2 overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <ListFilter className="w-3.5 h-3.5 text-slate-500" />
                        <h3 className="text-[10px] font-bold uppercase tracking-wider">最大取得件数</h3>
                      </div>
                      <select
                        value={debugPageSize}
                        onChange={(e) => setDebugPageSize(Number(e.target.value))}
                        className="bg-white border border-slate-300 text-slate-800 text-[10px] font-bold rounded px-2 py-1 outline-none cursor-pointer"
                        disabled={debugLoading}
                      >
                        <option value={1}>1件 (ステップ)</option>
                        <option value={5}>5件</option>
                        <option value={10}>10件</option>
                        <option value={50}>50件</option>
                        <option value={100}>100件</option>
                        <option value={250}>250件</option>
                        <option value={500}>500件</option>
                        <option value={1000}>1000件 (最大)</option>
                      </select>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2 pt-2">
                  <button
                    onClick={fetchSingleFolderDebug}
                    disabled={debugLoading || isCrawlActive || isIndexActive}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg text-xs cursor-pointer shadow-sm transition-all animate-pulse"
                    id="btn-single-fetch-debug"
                    style={debugLoading ? { animationDuration: '1.5s' } : { animation: 'none' }}
                  >
                    {debugLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        APIリクエスト中...
                      </>
                    ) : (
                      <>
                        <Bug className="w-4 h-4" />
                        フォルダを{debugPageSize}件取得・検証
                      </>
                    )}
                  </button>

                  {debugLoading && (
                    <button
                      onClick={cancelDebugScan}
                      className="w-full flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 font-bold py-2.5 px-4 rounded-lg text-xs cursor-pointer transition-all shadow-sm animate-bounce"
                      style={{ animationDuration: '2s' }}
                    >
                      <XCircle className="w-4 h-4 text-red-500" />
                      1ステップ走査リクエストを中断・キャンセル
                    </button>
                  )}
                </div>

                {/* Tracking stats */}
                <div className="border-t border-slate-200 pt-3 mt-1 space-y-2 font-mono text-[11px] text-slate-600">
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-slate-400 shrink-0">現在のPage Token:</span>
                    <span className="truncate max-w-[180px] font-semibold text-slate-800 bg-slate-200/60 px-1 py-0.5 rounded text-[10px]" title={nextPageToken || "Beginning / Root"}>
                      {nextPageToken ? nextPageToken : "None (順次ルートから)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">有効なフォルダ総数:</span>
                    <span className="font-semibold text-slate-800">{filteredDirs.length} フォルダ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-[9px]">DB登録総数 (無視込):</span>
                    <span className="text-slate-500 text-[9px]">{dirs.length}</span>
                  </div>
                </div>
              </div>


            </div>

            {/* Diagnostic readout */}
            <div className="lg:col-span-7 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                最新の取得フォルダ診断データ
              </h4>

              {lastDebugFolder ? (
                lastDebugFolder.empty ? (
                  <div className="bg-slate-50 border border-slate-200 text-center rounded-xl p-8 italic text-slate-400 font-mono text-xs relative">
                    <div>フォルダは全て取得しきり、終端に達しています。</div>
                    <button
                      onClick={handleCopyDiagnostics}
                      className="absolute top-2 right-2 flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-500 hover:text-indigo-600 px-2 py-0.5 rounded border border-slate-200 font-sans font-semibold text-[9px] transition-all cursor-pointer shadow-sm"
                      title="診断データをクリップボードにコピー"
                    >
                      {copiedDiagnostics ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-green-600 animate-pulse" />
                          <span className="text-green-650">コピー完了</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-2.5 h-2.5 text-slate-450" />
                          <span>ログコピー</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-900 text-slate-200 rounded-xl p-5 border border-slate-800 font-mono text-xs space-y-3 shadow-md">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
                      <span>Diagnostic Readout</span>
                      <div className="flex items-center gap-2">
                        {debugSaveStatus === "confirmed" && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" /> 保存確認済み
                          </span>
                        )}
                        {debugSaveStatus === "pending" && (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[8px] flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> 保存待機中 (Timeout候補)
                          </span>
                        )}
                        {debugSaveStatus === "timeout" && (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded text-[8px] flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> タイムアウト
                          </span>
                        )}
                        {debugSaveStatus === "failed" && (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded text-[8px] flex items-center gap-1">
                            <XCircle className="w-2.5 h-2.5" /> 保存失敗
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 overflow-hidden">
                      <div className="flex items-center justify-between text-slate-500 text-[10px]">
                        <span>DisplayName</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-indigo-400 font-bold truncate max-w-[200px]">{lastDebugFolder.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[10px]">
                        <span>Resolved Path</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-300 truncate max-w-[200px]">{lastDebugFolder.path}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[10px]">
                        <span>Computed Depth</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-amber-500 font-bold">Level {lastDebugFolder.depth}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[10px]">
                        <span>Next Page Token</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-400 truncate max-w-[150px]">{lastDebugFolder.nextToken || "Null (Complete)"}</span>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-12 text-center space-y-3">
                  <div className="inline-flex p-3 bg-white rounded-full text-slate-300 border border-slate-100 shadow-sm">
                    <Bug className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">診断データ未取得</p>
                    <p className="text-[10px] text-slate-400 italic">「フォルダを1つ追加取得・検証」ボタンをクリックしてテストを開始してください</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {activeTab === "firestore-test" && (
        <div className="space-y-6" id="firestore-test-container">
          
          {/* Smoke Test Checklist Panel */}
          <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-lg shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider mb-2">
              <Check className="w-4 h-4" />
              Smoke Test Checklist
            </div>
            <div className="text-[11px] text-indigo-900 leading-relaxed space-y-2">
              <p>この環境が正常に動作するかを確認するスモークテストの手順です。</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><strong>Firestore権限チェック:</strong> 下部の「Firestoreへのアクセス権を診断」ボタンを押し、緑色の「成功」が出るか確認します（失敗時はルール適用漏れの可能性があります）。</li>
                <li><strong>Drive APIテスト:</strong> 「フォルダ情報取得テスト」タブへ移動し、「1ステップ走査」を実行します。システムログタブで1件のみ処理され、キャッシュバイパスが機能しているか確認してください。</li>
                <li><strong>境界走査テスト:</strong> ダッシュボードタブに戻り、設定の「スキャン上限数」を小規模（例: 5件）に設定し、同期を実行。上限でピタリと止まるか確認します。</li>
                <li><strong>ルーティングテスト:</strong> 現在のURLでブラウザをリロード（F5）し、同じタブが維持されるか確認します。</li>
              </ul>
              <p className="font-bold text-indigo-800 mt-2">※ このテスト中はGoogle Driveのファイル削除や自動要約生成を実行しないでください。</p>
            </div>
            
            <div className="mt-4 p-3 bg-white border border-indigo-100 rounded-md shadow-inner text-[10px] font-mono text-slate-600 whitespace-pre overflow-x-auto relative group">
              <button
                onClick={() => {
                  const text = `### Smoke Test Record
**Date/Time:** ${new Date().toISOString().slice(0, 16).replace('T', ' ')}
**Commit SHA:** (Fill in)
**Environment:** (Local Dev | Local Prod Build | Deployed)
**Node Version:** (Fill in)
**Firebase Project ID:** ${firebaseProjectId}
**Firestore Database ID:** ${firestoreDatabaseId || 'indexmd-db'}
**Authenticated UID:** ${userId ? userId.slice(0, 6) + '...' : 'Unknown'}

**Results:**
- **Firestore Diagnostic:** [ confirmed | timeout | failed ]
- **One-Step Debug Scan:** [ empty | confirmed | timeout | failed ]
- **Bounded Scan Limit:** (e.g. 5)
- **Bounded Scan Result:** [ Pass | Fail ]
- **Route Refresh (Dashboard/Debugger):** [ Pass | Fail ]
- **Cache Observation:** [ Hit observed | Miss observed ]
- **Page Token Recovery:** [ Not triggered naturally | Recovered successfully ]

**Blockers / Notes:**
(Any errors, exceptions, or unexpected behaviors)`;
                  navigator.clipboard.writeText(text);
                }}
                className="absolute top-2 right-2 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="テンプレートをコピー"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
              </button>
              {`### Smoke Test Record
**Date/Time:** YYYY-MM-DD HH:MM
**Commit SHA:** (Fill in)
**Environment:** (Local Dev | Local Prod Build | Deployed)
**Node Version:** (Fill in)
**Firebase Project ID:** ${firebaseProjectId}
**Firestore Database ID:** ${firestoreDatabaseId || 'indexmd-db'}
**Authenticated UID:** ${userId ? userId.slice(0, 6) + '...' : 'Unknown'}

... (コピーボタンでテンプレート全体を取得できます)`}
            </div>
          </div>

          {/* Connection Info Panel */}
          <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm space-y-4" id="stat-connection-info">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider mb-2">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              接続構成情報 (Dynamic Config)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">GCP Project ID</div>
                <div className="text-xs font-mono text-slate-700 break-all select-all">{firebaseProjectId}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Firebase Project</div>
                <div className="text-xs font-mono text-slate-700 break-all select-all">{firebaseProjectId}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Firestore Database</div>
                <div className="text-xs font-mono text-slate-700 break-all select-all">{firestoreDatabaseId}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Collection Paths</div>
                <div className="text-[9px] font-mono text-slate-500 leading-tight">
                  • users/&#123;uid&#125;/directories<br />
                  • users/&#123;uid&#125;/state/global_sync
                </div>
              </div>
            </div>
          </div>

          {/* Firestore Directories Count Stat Panel */}
          <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm space-y-4" id="stat-firestore-count">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Firestore 同期済み件数</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Firestore内の <code>directories</code> コレクションに保存されているドキュメントの総数をカウントします。<br />
                  <span className="text-indigo-500/80 font-bold">※ この操作はサーバサイドのカウントクエリ（課金対象）を実行します。手動でのみ実行可能です。</span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-indigo-600 font-mono">
                    {firestoreDirCount !== null ? firestoreDirCount.toLocaleString() : "---"}
                    <span className="text-xs font-normal text-indigo-400 ml-1">件</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    取得日時: {lastDirCountAt ? `${lastDirCountAt.toLocaleTimeString()} (${getRelativeTime(lastDirCountAt)})` : "未取得"}
                  </div>
                </div>
                <button
                  onClick={countFirestoreDirectories}
                  disabled={isCountingDirectories}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold rounded text-xs transition-all cursor-pointer border border-slate-200"
                  id="btn-count-directories"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCountingDirectories ? "animate-spin" : ""}`} />
                  {isCountingDirectories ? "カウント中..." : "件数を更新"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4" id="token-init-panel">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">nextPageToken</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Firestore上のグローバル同期トークン（nextPageToken）を null に戻し、同期ステータスを "idle" にします。次の走査は最初から再開されます。
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
              {nextPageToken && (
                <div className="px-2 py-1 bg-amber-50 border border-amber-100 rounded text-[9px] font-mono text-amber-700 max-w-[150px] truncate" title={nextPageToken}>
                  TOKEN: {nextPageToken}
                </div>
              )}
              <div className="w-full md:w-auto" id="token-init-button-container">
                <button
                  onClick={async () => {
                    if (!confirm("本当にトークンをリセットしますか？この操作は取り消せません。")) return;
                    setIsTokenInitializing(true);
                    onAddLog("info", "🔧 [同期テスト] 1️⃣ nextPageToken削除処理を開始しました。");
                    try {
                      await saveSyncStateToDb(null, "idle", lastGlobalSyncAt, false);
                      onAddLog("success", "🔧 [同期テスト] 2️⃣ Firestore内のグローバル同期トークンを削除しました。");
                      setLastDebugFolder(null);
                      
                      try {
                        await fetch("/api/drive/clear-scan-cache", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            ...getDriveAuthHeaders(token)
                          }
                        });
                      } catch (e) {}

                      onAddLog("success", "🔧 [同期テスト] 3️⃣ 初期化プロセス完了。");
                    } catch (error: any) {
                      onAddLog("error", `🔧 [同期テスト] ❌ エラー: ${error.message || error}`);
                    } finally {
                      setIsTokenInitializing(false);
                    }
                  }}
                  disabled={isTokenInitializing || !nextPageToken}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold rounded text-xs transition-all cursor-pointer border border-slate-200 w-full md:w-auto"
                  id="btn-token-initialize"
                >
                  <Trash2 className={`w-3.5 h-3.5 ${isTokenInitializing ? "animate-spin" : ""}`} />
                  {isTokenInitializing ? "削除中..." : "nextPageToken削除"}
                </button>
              </div>
            </div>
          </div>

          {/* Firestore Permission Diagnosis */}
          <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm space-y-4" id="firestore-permission-panel">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Firestore 権限診断</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  現在の認証ユーザーが指定されたデータベースとパスに対して適切な読み書き権限を持っているか検証します。
                </p>
              </div>
              <button
                onClick={diagnoseFirestorePermission}
                disabled={isDiagnosingPermissions}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded text-xs transition-all cursor-pointer shadow-sm min-w-[160px]"
                id="btn-diagnose-permission"
              >
                {isDiagnosingPermissions ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
                Firestore権限を診断
              </button>
            </div>

            {/* Diagnostic Results Summary */}
            {permissionAuditResult && (
              <div className={`mt-3 p-3 rounded border text-[11px] font-medium animate-in fade-in slide-in-from-top-1 duration-300 ${
                permissionAuditResult.status === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-800" :
                permissionAuditResult.status === "warn" ? "bg-amber-50 border-amber-100 text-amber-800" :
                "bg-red-50 border-red-100 text-red-800"
              }`} id="diagnostic-result-summary">
                <div className="flex items-center gap-2 mb-1">
                  {permissionAuditResult.status === "success" ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  ) : permissionAuditResult.status === "warn" ? (
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                  )}
                  <span className="font-bold">診断結果 ({permissionAuditResult.timestamp})</span>
                </div>
                <p className="ml-5.5 leading-relaxed whitespace-pre-wrap">{permissionAuditResult.message}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "summary-debugger" && (
        <SummaryDebugger token={token} onSessionExpiry={onSessionExpiry} />
      )}

      {activeTab === "logs" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          <DriveLogs logs={logs} onClearLogs={onClearLogs} />
        </div>
      )}
      </div>
    </div>
  );
}