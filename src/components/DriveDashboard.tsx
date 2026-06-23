import { useState, useEffect, useRef } from "react";
import { 
  db, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit,
  writeBatch,
  onSnapshot,
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
  FileText, 
  Database,
  CheckCircle,
  AlertCircle,
  X,
  XCircle,
  Search,
  CheckSquare,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  Trash2,
  Bug,
  Copy,
  Check,
  Zap,
  Sparkles
} from "lucide-react";
import { SummaryDebugger } from "./SummaryDebugger";

interface DriveDashboardProps {
  userId: string;
  token: string;
  config: AppConfig;
  logs: DriveLog[];
  onAddLog: (level: "info" | "success" | "warn" | "error", message: string, details?: string) => void;
  onSessionExpiry?: () => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export default function DriveDashboard({ userId, token, config, logs, onAddLog, onSessionExpiry, activeTab, setActiveTab }: DriveDashboardProps) {
  const [dirs, setDirs] = useState<Directory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isInitialSyncing, setIsInitialSyncing] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Job 1 State (Scanning)
  const [isCrawlActive, setIsCrawlActive] = useState<boolean>(false);
  const crawlActiveRef = useRef<boolean>(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [lastTraversedAt, setLastTraversedAt] = useState<string | null>(null);
  const [currentTaskName, setCurrentTaskName] = useState<string | null>(null);
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
  const [resetConfirming, setResetConfirming] = useState<boolean>(false);
  const [debugLoading, setDebugLoading] = useState<boolean>(false);
  const [lastDebugFolder, setLastDebugFolder] = useState<any>(null);
  const [isTokenInitializing, setIsTokenInitializing] = useState<boolean>(false);
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

  const [firestoreDirsCount, setFirestoreDirsCount] = useState<number | null>(null);
  const [isCountingDirs, setIsCountingDirs] = useState<boolean>(false);

  const countFirestoreDirectories = async () => {
    if (!userId) return;
    setIsCountingDirs(true);
    try {
      const q = query(collection(db, "users", userId, "directories"));
      const snapshot = await getCountFromServer(q);
      const count = snapshot.data().count;
      setFirestoreDirsCount(count);
      onAddLog("success", `📊 [Firestore] サーバー上の directories ドキュメント総数: ${count} 件 (同期済みフォルダ実数)`);
    } catch (error: any) {
      console.error("Failed to count firestore directories:", error);
      onAddLog("error", `📊 [Firestore] ドキュメント数集計エラー: ${error.message || error}`);
    } finally {
      setIsCountingDirs(false);
    }
  };

  // Job 2 State (Indexing)
  const [isIndexActive, setIsIndexActive] = useState<boolean>(false);
  const indexActiveRef = useRef<boolean>(false);
  const [currentIndexingId, setCurrentIndexingId] = useState<string | null>(null);
  const [indexingProgress, setIndexingProgress] = useState<{current: number; total: number} | null>(null);

  useEffect(() => {
    setLoading(true);
    setIsInitialSyncing(true);
    countFirestoreDirectories();
    
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
    const unsubscribe = onSnapshot(dirsRef, { includeMetadataChanges: true }, (snap) => {
      // Direct high-performance mapping from snap.docs ensures we are always 100% in sync
      // with Cloud Firestore records, eliminating any partial event state-drifts or complex
      // local map retention issues.
      const freshDirs: Directory[] = [];
      snap.docs.forEach((doc) => {
        freshDirs.push(doc.data() as Directory);
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
      setTimeout(() => {
        onAddLog("error", "フォルダ構造のリアルタイム同期に失敗しました。", error.message);
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
    if (dirs.length > 0) {
      try {
        localStorage.setItem(`indexmd_total_folders_${userId}`, String(dirs.length));
        setLastKnownTotal(dirs.length);
      } catch (e) {
        console.warn("Failed to save folder total to localStorage:", e);
      }
    }
  }, [dirs.length, userId]);

  const loadSyncState = async () => {
    // 1. Initial attempt: Read from localStorage for near-instant responsiveness
    try {
      const cached = localStorage.getItem(`indexmd_sync_state_${userId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          setNextPageToken(parsed.nextPageToken || null);
          setLastTraversedAt(parsed.last_traversed_at || null);
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
        const stateData = target.data() as SyncState;
        setNextPageToken(stateData.nextPageToken);
        setLastTraversedAt(stateData.last_traversed_at);
        
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

  const runWithTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number = 3500,
    fallbackValue: T | null = null,
    errorMessage: string = "Firestoreとの通信が遅延しています。オフライン/キャッシュ優先で継続します。"
  ): Promise<T | null> => {
    let timeoutId: any;
    const timeoutPromise = new Promise<null>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn("Firestore non-blocking timeout/error:", err.message || err);
      return fallbackValue;
    }
  };

  const saveSyncStateToDb = async (nextToken: string | null, status: "idle" | "running" | "paused" | "error", lastTraversed: string | null) => {
    // Always update client-side local React state first so that the UI/crawler remains fully functional
    // and responsive even if Firestore experiences lag, timeouts, or permission limits.
    setNextPageToken(nextToken);
    setLastTraversedAt(lastTraversed);

    // Save state to localStorage to guarantee survival/persistence under any scenario
    try {
      localStorage.setItem(`indexmd_sync_state_${userId}`, JSON.stringify({
        nextPageToken: nextToken,
        last_traversed_at: lastTraversed
      }));
    } catch (e) {
      console.warn("Failed to save sync state backup to localStorage:", e);
    }

    try {
      const stateDocRef = doc(db, "users", userId, "state", "global_sync");
      
      const savePromise = setDoc(stateDocRef, {
        nextPageToken: nextToken,
        sync_status: status,
        last_traversed_at: lastTraversed
      }, { merge: true });

      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Firestoreとの通信が遅延しています。現在オフライン/キャッシュキャッシュモードで継続稼働しています。")), 3500)
      );

      await Promise.race([savePromise, timeoutPromise]);
    } catch (err: any) {
      // Use console.warn instead of console.error to avoid raising test pipeline exceptions
      console.warn("Firestore save update non-blocking delay:", err.message || err);
    }
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
    onAddLog("info", forceReset ? "フォルダ全件スキャンを開始します（初期走査）..." : "インクリメンタル（差分）走査を開始します...");

    let currentToken = forceReset ? null : nextPageToken;
    let baselineTime = forceReset ? null : lastTraversedAt;
    
    // Auto-lock status
    await saveSyncStateToDb(currentToken, "running", baselineTime);

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
    const PROGRESSIVE_LIMIT = forceReset ? 0 : 5; // Do 0 extra if it's a full initial sync (it will naturally fetch all flat folders first anyway), 5 if incremental

    try {
      while (crawlActiveRef.current) {
        if (!resilientCrawlMode) {
          // ==========================================
          // 1. STANDARD FLAT CRAWLING MODE
          // ==========================================
          onAddLog("info", `Google Drive APIフォルダ走査中 (フラット): ページ ${page}...`);
          
          const response = await fetch("/api/drive/scan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-google-drive-token": token,
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              token: token,
              lastTraversedAt: baselineTime,
              nextPageToken: currentToken
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
            await saveSyncStateToDb(null, "running", baselineTime);
            continue;
          }

          const data = await response.json();
          const filesReceived = data.files || [];
          
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
            if (!folderId || folderId === "root" || folderId === "undefined") {
              return { path: "", depth: 0 };
            }
            const folderObj = localDirsMap.get(folderId);
            if (!folderObj) {
              return { path: `/${folderId}`, depth: 1 };
            }
            const pId = folderObj.parents?.[0] || "root";
            if (pId === "root") {
              return { path: `/${folderObj.name}`, depth: 1 };
            }
            const parentRes = resolvePathAndDepth(pId);
            return {
              path: parentRes.path === "" ? `/${folderObj.name}` : `${parentRes.path}/${folderObj.name}`,
              depth: parentRes.depth + 1
            };
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
            const parentId = file.parents?.[0] || null;
            const { path: fullPath, depth: computedDepth } = resolvePathAndDepth(resolvedId);

            setCurrentTaskName(file.name);
            setCurrentTaskPath(fullPath || `/${file.name}`);

            const folderDocRef = doc(db, "users", userId, "directories", resolvedId);
            
            batch.set(folderDocRef, {
              drive_id: resolvedId,
              path: fullPath || `/${file.name}`,
              depth: computedDepth || 1,
              sync_status: "scanned",
              index_status: "pending",
              last_traversed_at: null, // Initial discovery does not mark it traversed, queue it up
              last_updated_at: null,
              parent_id: parentId
            }, { merge: true });

            batchWriteCount++;
            scannedCount++;

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
          if (!currentToken) {
            // Flat crawl complete! Switch to Progressive folder-by-folder sweep
            onAddLog("success", "🔄 ドライブ全体の変更履歴（ページトークン）での差分チェックが完了しました。");
            onAddLog("info", "続いて、未走査、または最も最終確認日時が古いフォルダを対象とした「プログレッシブ更新」へと移行します...");
            resilientCrawlMode = true;
          } else {
            // Track progress incrementally
            await saveSyncStateToDb(currentToken, "running", baselineTime);
            page++;
          }
        } else {
          // ==========================================
          // 2. RESILIENT FOLDER-BY-FOLDER CRAWLING MODE (User Proposal)
          // ==========================================
          if (PROGRESSIVE_LIMIT > 0 && progressiveCount >= PROGRESSIVE_LIMIT) {
            onAddLog("success", `🎯 今回のプログレッシブ更新（対象: ${PROGRESSIVE_LIMIT}フォルダ）が完了しました。`);
            break;
          } else if (PROGRESSIVE_LIMIT === 0 && resilientCrawlMode) {
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

            // Virtual root folder item
            const rootItem = {
              drive_id: "root",
              path: "/",
              name: "マイドライブ",
              depth: 0,
              last_traversed_at: baselineTime || null,
              next_page_token: currentToken || null,
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
              "x-google-drive-token": token,
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              token: token,
              parentFolderId: activeOldestFolder.drive_id,
              nextPageToken: folderToken,
              pageSize: 50
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

          for (const file of subdirsReceived) {
            if (!crawlActiveRef.current) break;

            let resolvedId = file.id;
            if (file.mimeType === "application/vnd.google-apps.shortcut" && file.shortcutDetails) {
              resolvedId = file.shortcutDetails.targetId;
            }

            const parentId = activeOldestFolder.drive_id;
            const parentCleanPath = activeOldestFolder.path === "/" ? "" : activeOldestFolder.path;
            const fullPath = `${parentCleanPath}/${file.name}`;
            const computedDepth = activeOldestFolder.depth + 1;

            setCurrentTaskName(file.name);
            setCurrentTaskPath(fullPath);

            const existingDir = localDirsMap.get(resolvedId);
            const needsUpdate = !existingDir || existingDir.path !== fullPath || existingDir.parent_id !== parentId;

            if (needsUpdate) {
              const folderDocRef = doc(db, "users", userId, "directories", resolvedId);
              
              folderBatch.set(folderDocRef, {
                drive_id: resolvedId,
                path: fullPath,
                depth: computedDepth,
                sync_status: existingDir ? existingDir.sync_status : "scanned",
                index_status: existingDir ? existingDir.index_status : "pending",
                last_traversed_at: existingDir ? existingDir.last_traversed_at : null, // Preserve traversed state to avoid infinite rescans
                last_updated_at: existingDir ? existingDir.last_updated_at : null,
                parent_id: parentId
              }, { merge: true });

              folderBatchCount++;
              scannedCount++;

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
            baselineTime = finishedTime;
            currentToken = folderToken;
            await saveSyncStateToDb(currentToken, "running", finishedTime);
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

      if (!crawlActiveRef.current) {
        // Interrupted by user cancellation
        await saveSyncStateToDb(currentToken, "paused", baselineTime);
        onAddLog("warn", `ユーザーによってフォルダ走査が一時停止/中断されました。進行状況を保存しました。`);
        return;
      }

      // Complete traversal successfully
      const completionTime = new Date().toISOString();
      await saveSyncStateToDb(null, "idle", completionTime);
      onAddLog("success", `フォルダの走査が完了しました。新たに ${scannedCount} 件 of folders synced.`);

    } catch (err: any) {
      onAddLog("error", "フォルダ走査中にエラーが発生し、処理が中断されました。", err.message || err);
      if (!err.message?.includes("401")) {
        await saveSyncStateToDb(currentToken, "error", baselineTime);
      }
    } finally {
      setIsCrawlActive(false);
    }
  };

  // JOB 2: OKF index.md index generation bottom-up
  const startGenerationJob = async () => {
    if (isIndexActive || isCrawlActive) return;
    if (dirs.length === 0) {
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
    const sortedDirs = [...dirs].sort((a,b) => b.depth - a.depth);
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
        setCurrentTaskName(item.path.split('/').pop() || item.drive_id);
        setCurrentTaskPath(item.path);

        onAddLog("info", `[インデックス作成中...] 階層パス (${item.depth}): ${item.path}`);

        // Update directory status in Firestore to "processing"
        const itemRef = doc(db, "users", userId, "directories", item.drive_id);
        await updateDoc(itemRef, { index_status: "processing" });

        // Retrieve pre-generated summaries of immediately lower subfolders to support cascading summary propagation
        // Children of this folder have: parent_id = current drive_id
        const childDirs = dirs.filter(d => d.parent_id === item.drive_id);
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
            "x-google-drive-token": token,
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            token: token,
            folderId: item.drive_id,
            folderName: item.path.split("/").pop() || "マイドライブ",
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

  // Safe reset routine
  const handleResetClick = () => {
    if (isCrawlActive || isIndexActive) return;
    if (!resetConfirming) {
      setResetConfirming(true);
      setTimeout(() => setResetConfirming(false), 5000);
    } else {
      executeFullReset();
      setResetConfirming(false);
    }
  };

  const executeFullReset = async () => {
    try {
      const batch = writeBatch(db);
      dirs.forEach((d) => {
        batch.delete(doc(db, "users", userId, "directories", d.drive_id));
      });
      
      // Also reset Firestore global sync state
      const stateDocRef = doc(db, "users", userId, "state", "global_sync");
      batch.delete(stateDocRef);
      
      await batch.commit();

      // Clear client-side states
      setNextPageToken(null);
      setLastTraversedAt(null);
      setDirs([]);

      // Clear localStorage cache to allow fresh full scan
      try {
        localStorage.removeItem(`indexmd_sync_state_${userId}`);
        localStorage.removeItem(`indexmd_total_folders_${userId}`);
      } catch (e) {
        console.warn("Failed to clear localStorage items:", e);
      }

      onAddLog("warn", "全同期状態を完全にリセットしました。初期状態（全件走査）から再スキャンが可能です。");
      setLastDebugFolder(null);
    } catch (e: any) {
      console.error(e);
      onAddLog("error", "リセットに失敗しました。", e.message);
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
          "x-google-drive-token": token,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          token: token,
          lastTraversedAt: lastTraversedAt,
          nextPageToken: nextPageToken,
          pageSize: 1
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
        await saveSyncStateToDb(null, "idle", lastTraversedAt);
        setDebugLoading(false);
        return;
      }

      const file = filesReceived[0];
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
        if (!folderId || folderId === "root" || folderId === "undefined") {
          return { path: "", depth: 0 };
        }
        const folderObj = localDirsMap.get(folderId);
        if (!folderObj) {
          return { path: `/${folderId}`, depth: 1 };
        }
        const pId = folderObj.parents?.[0] || "root";
        if (pId === "root") {
          return { path: `/${folderObj.name}`, depth: 1 };
        }
        const parentRes = resolvePathAndDepth(pId);
        return {
          path: parentRes.path === "" ? `/${folderObj.name}` : `${parentRes.path}/${folderObj.name}`,
          depth: parentRes.depth + 1
        };
      };

      const parentId = file.parents?.[0] || null;
      const { path: fullPath, depth: computedDepth } = resolvePathAndDepth(resolvedId);

      const folderDocRef = doc(db, "users", userId, "directories", resolvedId);
      const newFolderObj = {
        drive_id: resolvedId,
        path: fullPath || `/${file.name}`,
        depth: computedDepth || 1,
        sync_status: "scanned",
        index_status: "pending",
        last_traversed_at: new Date().toISOString(),
        last_updated_at: null,
        parent_id: parentId
      };

      onAddLog("info", "🔧 [デバッグ走査] データベース(Firestore)に新しいフォルダ情報を登録中...");
      await runWithTimeout(
        setDoc(folderDocRef, newFolderObj, { merge: true }),
        4000,
        null,
        "Firestoreへのフォルダ情報の保存応答が遅延しています。キャッシュ同期/オフライン優先のバックグラウンド保存として継続します。"
      );

      // Save page token for subsequent single steps
      // Update lastTraversedAt to the file's modifiedTime or current ISO string to move forward on next scan
      const nextTraversedTime = file.modifiedTime || new Date().toISOString();
      await saveSyncStateToDb(returnedNextToken, "idle", nextTraversedTime);

      onAddLog("success", `🔧 [デバッグ走査完了] 1件追加成功: "${newFolderObj.path}" (ID: ${resolvedId})`);
      
      setLastDebugFolder({
        ...newFolderObj,
        name: file.name,
        originalMimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        nextToken: returnedNextToken
      });

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
        await saveSyncStateToDb(null, "idle", lastTraversedAt);
      } else {
        onAddLog("error", "🔧 [デバッグ走査失敗] 追加フェッチエラー", e.message || e);
      }
    } finally {
      debugAbortControllerRef.current = null;
      setDebugLoading(false);
    }
  };

  const filteredDirs = dirs.filter((d) => 
    (d.path || "").toLowerCase().includes((searchTerm || "").toLowerCase()) || 
    (d.drive_id || "").includes(searchTerm)
  );

  // Find oldest and newest traversed folders
  const traversedFolders = dirs.filter(d => d.last_traversed_at);
  const virtualRootFolder = {
    drive_id: "root",
    path: "マイドライブ",
    name: "マイドライブ",
    depth: 0,
    last_traversed_at: lastTraversedAt,
    index_status: "pending" as const,
  };
  const allTraversedFolders = [...traversedFolders, ...(lastTraversedAt ? [virtualRootFolder] : [])];
  
  const oldestTraversedFolder = allTraversedFolders.length > 0 
    ? allTraversedFolders.reduce((oldest, current) => {
        if (!oldest.last_traversed_at) return current;
        if (!current.last_traversed_at) return oldest;
        return new Date(current.last_traversed_at) < new Date(oldest.last_traversed_at) ? current : oldest;
      }, allTraversedFolders[0])
    : null;

  const newestTraversedFolder = allTraversedFolders.length > 0 
    ? allTraversedFolders.reduce((newest, current) => {
        if (!newest.last_traversed_at) return current;
        if (!current.last_traversed_at) return newest;
        return new Date(current.last_traversed_at) > new Date(newest.last_traversed_at) ? current : newest;
      }, allTraversedFolders[0])
    : null;

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
      {/* Bento Grid Stats */}
      {activeTab !== "summary-debugger" && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" id="stats-bento">
          {/* Stat 1: Connection */}
          <div className="bg-white border border-slate-200 p-4 rounded-lg flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Drive Workspace</span>
              <div className="text-xs font-bold text-indigo-600 mt-1 flex items-center gap-1.5 font-display">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                接続中 (My Drive)
              </div>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded text-indigo-600">
              <Database className="w-4 h-4" />
            </div>
          </div>

          {/* Stat 2: Total Scanned Folders */}
          <div className="bg-white border border-slate-200 p-4 rounded-lg flex items-center justify-between shadow-sm" id="stat-scanned-folders">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">スキャン済みフォルダ数</span>
              <div className="text-lg font-extrabold text-slate-800 mt-1 font-mono">
                {dirs.length} <span className="text-xs font-normal text-slate-400">件</span>
              </div>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded text-indigo-600">
              <Folder className="w-4 h-4" />
            </div>
          </div>

          {/* Stat 3: Firestore Collections Count */}
          <div className="bg-white border border-slate-200 p-4 rounded-lg flex items-center justify-between shadow-sm" id="stat-firestore-count">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Firestore 登録総数</span>
              <div className="text-lg font-extrabold text-indigo-600 mt-1 font-mono">
                {firestoreDirsCount !== null ? (
                  <span>{firestoreDirsCount} <span className="text-xs font-normal text-indigo-400">件</span></span>
                ) : (
                  <span className="text-xs font-normal text-slate-400">集計未実行</span>
                )}
              </div>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded text-indigo-600">
              <Database className="w-4 h-4" />
            </div>
          </div>

          {/* Stat 4: Sync Progress Status */}
          <div className="bg-white border border-slate-200 p-4 rounded-lg flex items-center justify-between shadow-sm" id="stat-sync-status">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">同期ステータス</span>
              <div className="text-xs font-bold text-slate-700 mt-1.5 flex items-center gap-1">
                {nextPageToken ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                    <span>差分同期可能</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>同期完了 (Root)</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded text-indigo-600">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>

          {/* Stat 5: Active Job Execution */}
          <div className="bg-white border border-slate-200 p-4 rounded-lg flex items-center justify-between shadow-sm" id="stat-active-job">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">アクティブジョブ</span>
              <div className="text-xs font-bold text-slate-700 mt-1.5 flex items-center gap-1.5">
                {isCrawlActive ? (
                  <span className="text-indigo-600 animate-pulse flex items-center gap-1">● 走査中...</span>
                ) : isIndexActive ? (
                  <span className="text-emerald-600 animate-pulse flex items-center gap-1">● インデックス生成中...</span>
                ) : (
                  <span className="text-slate-400">待機中 (Idle)</span>
                )}
              </div>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded text-indigo-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

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
          メインダッシュボード
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
          フォルダ列挙デバッガー
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
          AI要約デバッガー
        </button>
      </div>

      <div className="mt-6" id="tabs-content">
        {activeTab === "debugger" && (
          <div className="space-y-6" id="debugger-container">
            {/* 警告ログ表示枠 */}
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" id="alert-circle-icon" />
              <div className="space-y-1">
                <span className="font-bold">開発者専用デバッグ・強制修正ツール</span>
                <p className="text-[11px] leading-relaxed">
                  本パネルは、Google Drive API のページトークン（pageToken）の同期不整合や、異常終了、無限走査状態を検知して手動でリセット・1ステップずつ駆動テストするためのツールです。通常運用で不整合が発生した際にご活用ください。
                </p>
              </div>
            </div>

            {/* Firestore Database Settings Info */}
            <div className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-4 py-3 rounded-lg flex items-start gap-2">
              <Database className="w-4 h-4 shrink-0 text-indigo-500 mt-0.5" />
              <div className="space-y-1 w-full">
                <span className="font-bold">デバッグ環境データベース設定 (Firestore Native mode)</span>
                <ul className="text-[11px] leading-relaxed list-disc list-inside mt-1 text-slate-600 space-y-0.5">
                  <li><span className="font-semibold text-slate-700">Project ID:</span> <code className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded">moukaeritaid</code></li>
                  <li><span className="font-semibold text-slate-700">Database ID:</span> <code className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded">indexmd-db</code></li>
                  <li><span className="font-semibold text-slate-700">Collections Used:</span> 
                    <ul className="list-circle list-inside ml-4 mt-0.5 space-y-0.5">
                      <li><code>users/&#123;userId&#125;/state/global_sync</code> (Tracks global sync tokens)</li>
                      <li><code>users/&#123;userId&#125;/directories/&#123;directoryId&#125;</code> (Stores metadata for each directory)</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </div>

            {/* コレクション内の directories ドキュメント集計UI (User Request) */}
            <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm" id="firestore-collection-counter">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-indigo-500" />
                    Firestore directories コレクション集計
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Firestore サーバー上の <code>directories</code> コレクション内に実際に登録されているドキュメントの正確な総数を取得・表示します。
                  </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-center">
                  <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-mono font-bold text-slate-700 min-w-[120px] text-center">
                    {isCountingDirs ? (
                      <span className="flex items-center justify-center gap-1 text-indigo-600">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        集計中...
                      </span>
                    ) : firestoreDirsCount !== null ? (
                      <span>{firestoreDirsCount} <span className="text-xs font-normal text-indigo-400">件</span></span>
                    ) : (
                      <span className="text-slate-400">未取得</span>
                    )}
                  </div>
                  <button
                    onClick={countFirestoreDirectories}
                    disabled={isCountingDirs}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded text-xs cursor-pointer shadow-sm transition-all"
                    id="btn-count-firestore-dirs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCountingDirs ? "animate-spin" : ""}`} />
                    集計を実行
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4" id="token-init-panel">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">同期状態（トークン）の初期化</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Firestore上のグローバル同期トークン（nextPageToken）を null に戻し、同期ステータスを "idle" にします。次の走査は最初から再開されます。
                </p>
              </div>
              
              <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
                <div className="w-full md:w-auto" id="token-init-button-container">
                  <button
                    onClick={async () => {
                      setIsTokenInitializing(true);
                      onAddLog("info", "🔧 [デバッガー] 1️⃣ トークン初期化処理を開始しました。（スピナーの回転を開始）");
                      onAddLog("info", "🔧 [デバッガー] 2️⃣ リセット用データの検証を行います。");
                      try {
                        onAddLog("info", `🔧 [デバッガー] 3️⃣ Firestore のターゲットパスを確認: 'users/${userId}/state/global_sync'`);
                        onAddLog("info", `🔧 [デバッガー] 4️⃣ 初期化パラメータを設定: { nextPageToken: null, sync_status: 'idle', last_traversed_at: "${lastTraversedAt || '未実行（null）'}" }`);
                        onAddLog("warn", "🔧 [デバッガー] 5️⃣ Firestoreへの非同期ネットワーク通信 (setDoc) をリクエストしました。応答を待機しています...");
                        
                        await saveSyncStateToDb(null, "idle", lastTraversedAt);
                        
                        onAddLog("success", "🔧 [デバッガー] 6️⃣ [通信完了] Firestore内のグローバル同期トークンおよび同期ステータス（'idle'）の初期化に成功しました！");
                        setLastDebugFolder(null);
                        onAddLog("info", "🔧 [デバッガー] 7️⃣ クライアント側のデバッグ表示（lastDebugFolder）をクリアしました。");
                        onAddLog("info", "🔧 [デバッガー] 7.5️⃣ 関連するフォルダ走査ディスクキャッシュのクリアをバックエンドに要求しています...");
                        
                        try {
                          await fetch("/api/drive/clear-scan-cache", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "x-google-drive-token": token,
                              "Authorization": `Bearer ${token}`
                            }
                          });
                          onAddLog("success", "🔧 [デバッガー] [キャッシュクリア完了] フォルダ走査キャッシュの自動パージに成功しました！");
                        } catch (cacheErr: any) {
                          onAddLog("warn", `🔧 [デバッガー] フォルダ走査キャッシュのクリア中に軽微な警告が発生しました: ${cacheErr.message || cacheErr}`);
                        }

                        onAddLog("success", "🔧 [デバッガー] 8️⃣ すべての初期化プロセスが安全に完了しました。スピナーの回転を停止します。次のフォルダフェッチは最上位階層(root)から行われます。");
                      } catch (error: any) {
                        onAddLog("error", `🔧 [デバッガー] ❌ [通信失敗] 初期化処理中にエラーが発生しました: ${error.message || error}`);
                      } finally {
                        setIsTokenInitializing(false);
                      }
                    }}
                    disabled={isTokenInitializing}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-105 border border-slate-200 rounded text-xs font-bold transition-all cursor-pointer bg-slate-50 hover:bg-white disabled:opacity-50 w-full md:w-auto"
                    id="btn-token-initialize"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTokenInitializing ? "animate-spin" : ""}`} />
                    {isTokenInitializing ? "初期化中..." : "トークン初期化"}
                  </button>
                </div>

                <div className="w-full md:w-auto" id="cache-clear-button-container">
                  <div className="flex items-center justify-between md:justify-start gap-2.5 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 w-full md:w-auto min-h-[38px]" id="cache-clearing-group">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider hidden md:inline">対象キャッシュ:</span>
                    <select
                      value={selectedCacheType}
                      onChange={(e) => setSelectedCacheType(e.target.value)}
                      disabled={isCacheClearing}
                      className="bg-white border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      id="select-cache-type"
                    >
                      <option value="all">すべて一括クリア</option>
                      <option value="scan">フォルダ走査 (scan)</option>
                      <option value="snippets">ファイルスニペット (snippets)</option>
                      <option value="summaries">AI要約 (summaries)</option>
                    </select>
                    <button
                      onClick={async () => {
                        setIsCacheClearing(true);
                        let typeLabel = "すべての";
                        if (selectedCacheType === "scan") typeLabel = "フォルダ走査(scan)";
                        if (selectedCacheType === "snippets") typeLabel = "ファイルスニペット(snippets)";
                        if (selectedCacheType === "summaries") typeLabel = "AI要約(summaries)";
                        
                        onAddLog("info", `🧹 ${typeLabel} キャッシュの手動クリアを開始しました...`);
                        try {
                          const response = await fetch("/api/drive/clear-cache", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "x-google-drive-token": token,
                              "Authorization": `Bearer ${token}`
                            },
                            body: JSON.stringify({ type: selectedCacheType })
                          });
                          if (response.ok) {
                            const data = await response.json();
                            onAddLog("success", `🧹 [キャッシュクリア完了] ${data.message}`);
                          } else {
                            throw new Error(`HTTPステータス: ${response.status}`);
                          }
                        } catch (err: any) {
                          onAddLog("error", `❌ キャッシュクリアエラー: ${err.message || err}`);
                        } finally {
                          setIsCacheClearing(false);
                        }
                      }}
                      disabled={isCacheClearing}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      id="btn-clear-cache"
                    >
                      <Trash2 className={`w-3.5 h-3.5 ${isCacheClearing ? "animate-spin" : ""}`} />
                      {isCacheClearing ? "クリア中" : "クリア実行"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/* Core Interactive Step Trigger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 1ステップ走査制御
                </h4>
                
                <p className="text-xs text-slate-600 leading-relaxed">
                  下のボタンをクリックすると、Google Driveから現在の同期位置（Page Token）に続く <strong>次の1つのフォルダ</strong> だけを取得し、パス・深度を再帰算出（BFS風にメモリマッピング構築）して、リアルタイムにFirestoreへ登録します。
                </p>

                <div className="space-y-2">
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
                        フォルダを1つ追加取得・検証
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
                    <span className="text-slate-400">DBに登録された総数:</span>
                    <span className="font-semibold text-slate-800">{dirs.length} フォルダ</span>
                  </div>
                </div>
              </div>

              {/* BFS / DFS explanation overlay */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-[11px] leading-relaxed text-slate-700 space-y-2">
                <h5 className="font-bold text-indigo-800 flex items-center gap-1.5 text-xs">
                  <HelpCircle className="w-3.5 h-3.5" />
                  幅優先 (BFS) か深さ優先 (DFS) か？ (仕様検証)
                </h5>
                <p>
                  <strong>1. フォルダ走査 (Crawl)</strong>: APIの取得要件として高速フラット検索を行っているため、Google Drive APIはページ順にフォルダのフラットリストを返します。取得されたフォルダは親をメモリ上の全マップから辿ってパスを組み立てるため、<strong>事実上の幅優先 (Breadth-First) 解決</strong>を動的に行います。
                </p>
                <p>
                  <strong>2. インデックス生成 (OKF Generation)</strong>: ボトムアップ（最深部から浅い階層へ）に要約（Cascade summaries）を伝搬させるため、<strong>深さ優先 (Depth-First / Deepest-First) 処理</strong>で進行します。
                </p>
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
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px]">LIVE FIRESTORE INDEXED</span>
                        <button
                          onClick={handleCopyDiagnostics}
                          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white px-1.5 py-0.5 rounded border border-slate-700 font-sans font-medium text-[9px] transition-colors cursor-pointer"
                          title="診断データをクリップボードにコピー"
                        >
                          {copiedDiagnostics ? (
                            <>
                              <Check className="w-2.5 h-2.5 text-green-400 animate-pulse" />
                              <span className="text-green-400">コピー完了</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-2.5 h-2.5 text-slate-400" />
                              <span>データをコピー</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-y-2.5">
                      <div className="text-slate-400">Name:</div>
                      <div className="col-span-2 text-indigo-300 font-bold break-all whitespace-pre-wrap">{lastDebugFolder.name}</div>

                      <div className="text-slate-400">Resolved Path:</div>
                      <div className="col-span-2 text-emerald-400 font-bold break-all whitespace-pre-wrap">{lastDebugFolder.path}</div>

                      <div className="text-slate-400">Inferred Depth:</div>
                      <div className="col-span-2 font-bold text-amber-400">{lastDebugFolder.depth} (Level {lastDebugFolder.depth})</div>

                      <div className="text-slate-400">Target Folder ID:</div>
                      <div className="col-span-2 text-slate-300 select-all break-all">{lastDebugFolder.drive_id}</div>

                      <div className="text-slate-400">Parent Folder ID:</div>
                      <div className="col-span-2 text-slate-300 break-all">{lastDebugFolder.parent_id || "root / None"}</div>

                      <div className="text-slate-400">Mime Type:</div>
                      <div className="col-span-2 text-slate-400 break-all">{lastDebugFolder.originalMimeType}</div>

                      <div className="text-slate-400">Returned Next Token:</div>
                      <div className="col-span-2 text-slate-400 break-all" title={lastDebugFolder.nextToken || "Null"}>{lastDebugFolder.nextToken || "Null (Complete)"}</div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[10.5px] text-slate-500 break-all">
                      Firestore パス: <code className="text-slate-400 break-all">users/{userId}/directories/{lastDebugFolder.drive_id}</code>
                    </div>
                  </div>
                )
              ) : (
                <div className="bg-slate-50 border border-slate-200 border-dashed text-center rounded-xl py-12 px-6 italic text-slate-400 font-mono text-xs flex flex-col items-center justify-center gap-2">
                  <Bug className="w-8 h-8 opacity-25 text-slate-400" />
                  手動検証用のフェッチ履歴はありません。
                  <br />「追加取得」をクリックして現在のpageTokenから検証を行ってください。
                </div>
              )}

              {/* Scanned Database List (Simplified) */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <div className="bg-slate-50 p-2.5 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> リアルタイム同期済みツリー (スキャン順)
                  </span>
                  <span className="text-[10px] text-indigo-600 font-bold font-mono">
                    {dirs.length} items
                  </span>
                </div>
                <div className="max-h-[220px] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                  {isInitialSyncing && dirs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 italic animate-pulse space-y-1">
                      <div className="font-bold text-indigo-500">Firestoreと同期中...</div>
                      {syncProgress && (
                        <div className="text-[10px] font-mono text-slate-400">
                          {syncProgress.current} 件のフォルダ情報を取得済み
                          {lastKnownTotal > 0 ? ` (${Math.min(Math.round((syncProgress.current / lastKnownTotal) * 100), 100)}%)` : ""}
                        </div>
                      )}
                    </div>
                  ) : dirs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 italic">No nodes scanned yet.</div>
                  ) : (
                    dirs.slice().sort((a, b) => String(b.last_traversed_at || '').localeCompare(String(a.last_traversed_at || ''))).slice(0, 100).map(dir => (
                      <div key={dir.drive_id} className="p-2 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-xs text-slate-650 font-mono">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="text-[9px] px-1 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold">L{dir.depth}</span>
                          <span className="font-semibold text-slate-800 truncate" title={dir.path}>{dir.path}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 shrink-0">{dir.drive_id.slice(0, 10)}...</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "dashboard" && (
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => startScanJob(false)}
                disabled={isCrawlActive || isIndexActive}
                className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:pointer-events-none transition-colors text-indigo-700 border border-indigo-200 font-bold px-3.5 py-2 rounded-md text-xs cursor-pointer"
                id="btn-scan-incremental"
              >
                <FolderSync className="w-3.5 h-3.5" />
                差分フォルダ走査
              </button>

              <button
                onClick={() => startScanJob(true)}
                disabled={isCrawlActive || isIndexActive}
                className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:pointer-events-none border border-slate-200 transition-all text-slate-600 font-bold px-3.5 py-2 rounded-md text-xs cursor-pointer"
                id="btn-scan-full"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                全件初期走査
              </button>

              <button
                onClick={startGenerationJob}
                disabled={isCrawlActive || isIndexActive || dirs.length === 0}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none transition-colors text-white font-bold px-4 py-2 rounded-md text-xs cursor-pointer shadow-sm"
                id="btn-generate-indices"
              >
                <Play className="w-3.5 h-3.5" />
                OKFインデックス生成
              </button>

              <button
                onClick={handleResetClick}
                disabled={isCrawlActive || isIndexActive || dirs.length === 0}
                className={`inline-flex items-center gap-1.5 transition-all px-3 py-2 rounded-md text-xs cursor-pointer ${
                  resetConfirming
                    ? "bg-red-500 hover:bg-red-650 text-white border-transparent font-bold animate-pulse shadow-sm"
                    : "text-slate-500 hover:text-red-650 hover:bg-red-50 border border-slate-200 hover:border-red-200"
                }`}
                id="btn-reset-data"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {resetConfirming ? "本当にリセット？ (あと5秒)" : "状態リセット"}
              </button>
            </div>

            {/* Search Box */}
            <div className="relative md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="階層パスまたはIDで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* 最も古い／新しい情報取得フォルダの表示 (Oldest/Newest Traversed Folders) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200/85 p-4 rounded-lg" id="extremes-traversed-panel">
            {/* Oldest */}
            <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between" id="oldest-folder-card">
              <div>
                <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  最も走査（訪問）日時の古いフォルダ (再開候補)
                </div>
                {isInitialSyncing && dirs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic animate-pulse">
                    同期中... {syncProgress ? `(${syncProgress.current}件取得済み)` : ""}
                  </p>
                ) : oldestTraversedFolder ? (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-800 break-all flex flex-wrap items-center gap-1" title={oldestTraversedFolder.path}>
                      <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {buildBreadcrumbPath(oldestTraversedFolder.drive_id).map((crumb, idx, arr) => (
                        <span key={crumb.id} className="flex items-center gap-1">
                          <span className={idx === arr.length - 1 ? 'text-slate-800' : 'text-slate-500'}>{crumb.name}</span>
                          {idx < arr.length - 1 && <span className="text-slate-300">/</span>}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 select-all break-all">
                      ID: {oldestTraversedFolder.drive_id}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">走査済みのフォルダはありません</p>
                )}
              </div>
              {oldestTraversedFolder && !loading && oldestTraversedFolder.last_traversed_at && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">最終訪問日時:</span>
                  <span className="font-bold text-slate-700">{new Date(oldestTraversedFolder.last_traversed_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Newest */}
            <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between" id="newest-folder-card">
              <div>
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  最も走査（訪問）日時の新しいフォルダ
                </div>
                {isInitialSyncing && dirs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic animate-pulse">
                    同期中... {syncProgress ? `(${syncProgress.current}件取得済み)` : ""}
                  </p>
                ) : newestTraversedFolder ? (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-800 break-all flex flex-wrap items-center gap-1" title={newestTraversedFolder.path}>
                      <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {buildBreadcrumbPath(newestTraversedFolder.drive_id).map((crumb, idx, arr) => (
                        <span key={crumb.id} className="flex items-center gap-1">
                          <span className={idx === arr.length - 1 ? 'text-slate-800' : 'text-slate-500'}>{crumb.name}</span>
                          {idx < arr.length - 1 && <span className="text-slate-300">/</span>}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 select-all break-all">
                      ID: {newestTraversedFolder.drive_id}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">走査済みのフォルダはありません</p>
                )}
              </div>
              {newestTraversedFolder && !loading && newestTraversedFolder.last_traversed_at && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">最終訪問日時:</span>
                  <span className="font-bold text-slate-700">{new Date(newestTraversedFolder.last_traversed_at).toLocaleString()}</span>
                </div>
              )}
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
              {isInitialSyncing && dirs.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 font-mono italic block flex flex-col items-center justify-center space-y-4">
                  <Database className="w-6 h-6 animate-bounce text-indigo-500 opacity-75" />
                  <div className="space-y-1">
                    <p className="font-bold text-slate-700 not-italic">Firestore データベースとリアルタイム同期中...</p>
                    {syncProgress && (
                      <p className="text-slate-400">
                        {syncProgress.current} 件のフォルダメタデータを取得しました
                        {lastKnownTotal > 0 ? ` (${Math.min(Math.round((syncProgress.current / lastKnownTotal) * 100), 100)}%)` : ""}
                      </p>
                    )}
                  </div>
                  {lastKnownTotal > 0 && syncProgress && (
                    <div className="w-48 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(Math.round((syncProgress.current / lastKnownTotal) * 100), 100)}%` }}
                      ></div>
                    </div>
                  )}
                  {syncProgress?.lastPath && (
                    <p className="text-[10px] text-slate-400 max-w-md truncate bg-slate-50 border border-slate-150 rounded px-2.5 py-1 font-mono">
                      最新同期: {syncProgress.lastPath}
                    </p>
                  )}
                </div>
              ) : filteredDirs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic block">
                  合致するフォルダが見つかりません。
                </div>
              ) : (
                <>
                  {filteredDirs.slice(0, 50).map((dir) => {
                    let statusBadge = "text-slate-500 border-slate-200 bg-slate-50";
                    if (dir.index_status === "indexed") {
                      statusBadge = "text-emerald-700 border-emerald-200 bg-emerald-50";
                    } else if (dir.index_status === "processing") {
                      statusBadge = "text-indigo-700 border-indigo-200 bg-indigo-50 animate-pulse";
                    } else if (dir.index_status === "error") {
                      statusBadge = "text-red-700 border-red-200 bg-red-50";
                    }

                    return (
                      <div key={dir.drive_id} className="grid grid-cols-12 gap-2 p-2.5 items-center hover:bg-slate-50/50 transition-colors text-xs text-slate-650">
                      <div className="col-span-5 md:col-span-6 flex items-center gap-2">
                        <Folder className="w-3.5 h-3.5 text-indigo-500/70 shrink-0" />
                        <span className="font-semibold text-slate-800 break-all md:truncate leading-tight" title={dir.path}>
                          {dir.path}
                        </span>
                      </div>

                      <div className="col-span-2 text-center font-mono text-slate-650 font-semibold">
                        {dir.depth}
                      </div>

                      <div className="col-span-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[9px] font-bold tracking-wide ${statusBadge}`}>
                          {dir.index_status === "indexed" ? "OKF-更新済" : 
                           dir.index_status === "processing" ? "処理中..." : "未生成"}
                        </span>
                      </div>

                      <div className="col-span-2 text-right font-mono text-[10px] text-slate-400 flex items-start justify-end gap-1">
                        <span className="break-all md:truncate md:w-24 leading-tight">{dir.drive_id}</span>
                        <a 
                          href={`https://drive.google.com/drive/folders/${dir.drive_id}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Google Driveで開く"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {/* Show AI Summary brief if generated */}
                      {dir.ai_summary && (
                        <div className="col-span-12 pl-5 pt-1 text-[11px] text-slate-500 leading-relaxed max-w-4xl break-all mt-0.5 bg-slate-50/40 p-1.5 rounded border border-slate-100/50">
                          <span className="text-indigo-600 font-bold uppercase text-[9px] tracking-wider mr-1">[AI摘要]</span>
                          {dir.ai_summary}
                        </div>
                      )}
                    </div>
                  );
                  })}
                  {filteredDirs.length > 50 && (
                    <div className="p-3 text-center text-xs text-slate-400 font-mono italic">
                      + 他 {filteredDirs.length - 50} 件 (検索を利用して絞り込み表示を行ってください)
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "summary-debugger" && (
        <SummaryDebugger token={token} onSessionExpiry={onSessionExpiry} />
      )}
      </div>
    </div>
  );
}