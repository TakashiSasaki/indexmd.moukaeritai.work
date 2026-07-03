import { 
  collection, 
  getDocs, 
  doc, 
  writeBatch, 
  setDoc,
  Firestore 
} from "firebase/firestore";
import { 
  CrawlStats, 
  DirectoryMetadata, 
  ScanCallbacks,
  LogType 
} from "./types";

// Helper to resolve path and depth
export function resolvePathAndDepthHelper(
  folderId: string, 
  pathMap: Map<string, any>
): { path: string; depth: number } {
  let currentId = folderId;
  let pathParts: string[] = [];
  let depth = 0;
  let visited = new Set<string>();

  while (currentId && currentId !== "root" && !visited.has(currentId)) {
    visited.add(currentId);
    const info = pathMap.get(currentId);
    if (!info) break;

    pathParts.unshift(info.name);
    depth++;
    currentId = info.parent_id || info.parents?.[0] || null;
  }

  return {
    path: "/" + pathParts.join("/"),
    depth: depth
  };
}

export function isIgnoredFolderName(name: string, ignoredList: string[]): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return ignoredList.some(ig => {
    const target = ig.toLowerCase().trim();
    if (!target) return false;
    return n === target || n.includes(target);
  });
}

export function isIgnoredPath(path: string, ignoredList: string[]): boolean {
  if (!path) return false;
  const p = path.toLowerCase();
  return ignoredList.some(ig => {
    const target = ig.toLowerCase().trim();
    if (!target) return false;
    return p.includes(target);
  });
}

export async function runScanJob(
  userId: string,
  token: string,
  db: Firestore,
  config: any,
  options: {
    forceReset: boolean;
    scanLimit: number;
    skipExistingFolders: boolean;
    ignoredFolderNames: string[];
    nextPageToken: string | null;
    lastGlobalSyncAt: string | null;
    rootLastTraversedAt: string | null;
    rootNextPageToken: string | null;
  },
  callbacks: ScanCallbacks,
  crawlActiveRef: { current: boolean }
) {
  const { 
    forceReset, 
    scanLimit, 
    skipExistingFolders, 
    ignoredFolderNames,
    nextPageToken,
    lastGlobalSyncAt,
    rootLastTraversedAt,
    rootNextPageToken
  } = options;

  const { onAddLog, setCrawlStats, setIsCrawlActive, setCrawlMode, setActiveScanFolder, onSessionExpiry } = callbacks;

  const getDriveAuthHeaders = (t: string) => ({
    "Authorization": `Bearer ${t}`
  });

  const saveSyncStateToDb = async (
    token: string | null, 
    status: string, 
    baseline: string | null, 
    isFullSync: boolean,
    rootNextToken: string | null = null,
    rootLastTraversed: string | null = null
  ) => {
    try {
      const stateRef = doc(db, "users", userId, "state", "global_sync");
      const updateData: any = {
        last_sync_status: status,
        updated_at: new Date().toISOString()
      };
      if (token !== undefined) updateData.next_page_token = token;
      if (baseline !== undefined) updateData.last_global_sync_at = baseline;
      if (isFullSync) updateData.last_full_sync_at = new Date().toISOString();
      if (rootNextToken !== null) updateData.root_next_page_token = rootNextToken;
      if (rootLastTraversed !== null) updateData.root_last_traversed_at = rootLastTraversed;

      await setDoc(stateRef, updateData, { merge: true });
    } catch (e) {
      console.error("Failed to save sync state:", e);
    }
  };

  let currentToken = forceReset ? null : nextPageToken;
  let baselineTime = forceReset ? null : lastGlobalSyncAt;
  let localRootLastTraversedAt = forceReset ? null : rootLastTraversedAt;
  let localRootNextPageToken = forceReset ? null : rootNextPageToken;
  
  await saveSyncStateToDb(currentToken, "running", baselineTime, false);

  let persistedDirsMap = new Map<string, any>();
  let pathResolutionMap = new Map<string, any>();

  if (!forceReset) {
    try {
      onAddLog("info", "Firestoreから最新のディレクトリ一覧を同期中...");
      const freshSnap = await getDocs(collection(db, "users", userId, "directories"));
      freshSnap.forEach(docSnap => {
        const d = docSnap.data();
        const obj = {
          drive_id: docSnap.id,
          name: d.name || "",
          parents: d.parent_id ? [d.parent_id] : [],
          parent_id: d.parent_id || null,
          depth: d.depth || 1,
          path: d.path || "",
          last_traversed_at: d.last_traversed_at || null,
          next_page_token: d.next_page_token || null,
          index_status: d.index_status || "pending"
        };
        persistedDirsMap.set(docSnap.id, obj);
        pathResolutionMap.set(docSnap.id, obj);
      });
      onAddLog("info", `Firestoreから ${persistedDirsMap.size} 件のディレクトリ情報を読み込みました。`);
    } catch (e: any) {
      onAddLog("warn", "Firestoreからの同期に失敗しました:", e.message || e);
    }
  }

  let scannedCount = 0;
  let page = 1;
  let resilientCrawlMode = false;
  let activeOldestFolder: any = null;
  let folderToken: string | null = null;

  try {
    while (crawlActiveRef.current) {
      if (scanLimit > 0 && scannedCount >= scanLimit) {
        onAddLog("success", `🎯 指定されたスキャン上限（${scanLimit}件）に達したため終了します。`);
        break;
      }

      if (!resilientCrawlMode) {
        setCrawlMode("flat");
        setActiveScanFolder(null);
        onAddLog("info", `Google Drive API走査中 (フラット): ページ ${page}...`);
        
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
            pageSize: scanLimit > 0 ? Math.min(scanLimit, 100) : 100,
            cacheScope: userId
          })
        });

        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpiry?.();
            throw new Error(`【401】トークン失効。`);
          }
          onAddLog("warn", `フェッチエラーにつきプログレッシブ走査に切り替えます。`);
          resilientCrawlMode = true;
          currentToken = null;
          continue;
        }

        const data = await response.json();
        const filesReceived = data.files || [];
        
        if (data.cached) {
          callbacks.setLastCacheHit(true);
          callbacks.setTotalCacheHits(prev => prev + 1);
        } else {
          callbacks.setLastCacheHit(false);
          callbacks.setTotalCacheMisses(prev => prev + 1);
        }
        
        filesReceived.forEach((file: any) => {
          let resolvedId = file.id;
          if (file.mimeType === "application/vnd.google-apps.shortcut" && file.shortcutDetails) {
            resolvedId = file.shortcutDetails.targetId;
          }
          pathResolutionMap.set(resolvedId, {
            drive_id: resolvedId,
            name: file.name,
            parents: file.parents || []
          });
        });

        const resolvePathAndDepth = (folderId: string) => resolvePathAndDepthHelper(folderId, pathResolutionMap);

        let batch = writeBatch(db);
        let batchWriteCount = 0;

        for (const file of filesReceived) {
          if (!crawlActiveRef.current) break;
          
          let resolvedId = file.id;
          if (file.mimeType === "application/vnd.google-apps.shortcut" && file.shortcutDetails) {
            resolvedId = file.shortcutDetails.targetId;
          }

          const { path: resolvedFullPath } = resolvePathAndDepth(resolvedId);
          const isNameIgnored = isIgnoredFolderName(file.name, ignoredFolderNames);
          const isPathIgnored = isIgnoredPath(resolvedFullPath, ignoredFolderNames);

          if (isNameIgnored || isPathIgnored) {
            if (isNameIgnored) setCrawlStats(prev => ({ ...prev, ignored: prev.ignored + 1 }));
            if (persistedDirsMap.has(resolvedId)) {
              setCrawlStats(prev => ({ ...prev, removed: prev.removed + 1 }));
              batch.delete(doc(db, "users", userId, "directories", resolvedId));
              batchWriteCount++;
            }
            continue;
          }

          if (scanLimit > 0 && scannedCount >= scanLimit) break;
          const parentId = file.parents?.[0] || null;
          const { path: fullPath, depth: computedDepth } = resolvePathAndDepth(resolvedId);

          callbacks.setCurrentTaskId(resolvedId);
          callbacks.setCurrentTaskName(file.name);
          callbacks.setCurrentTaskPath(fullPath);

          const existingDir = persistedDirsMap.get(resolvedId);
          if (skipExistingFolders && existingDir) {
            setCrawlStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
            continue;
          }

          const flatUpdateData: any = {
            drive_id: resolvedId,
            name: file.name,
            path: fullPath || `/${file.name}`,
            depth: computedDepth || 1,
            index_status: existingDir?.index_status || "pending",
            parent_id: parentId,
            last_traversed_at: existingDir?.last_traversed_at || null,
            last_updated_at: existingDir?.last_updated_at || null
          };

          batch.set(doc(db, "users", userId, "directories", resolvedId), flatUpdateData, { merge: true });
          batchWriteCount++;
          scannedCount++;
          setCrawlStats(prev => ({ ...prev, discovered: prev.discovered + 1 }));

          const savedFolder = { ...flatUpdateData, parents: file.parents || [] };
          persistedDirsMap.set(resolvedId, savedFolder);
          pathResolutionMap.set(resolvedId, savedFolder);

          if (batchWriteCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            batchWriteCount = 0;
          }
        }

        if (batchWriteCount > 0) await batch.commit();
        currentToken = data.nextPageToken || null;
        
        if (!currentToken) {
          resilientCrawlMode = true;
          const now = new Date().toISOString();
          baselineTime = now;
          await saveSyncStateToDb(null, "running", now, false);
        } else {
          await saveSyncStateToDb(currentToken, "running", baselineTime, false);
          page++;
        }
      } else {
        // Progressive Mode
        setCrawlMode("progressive");
        if (scanLimit > 0 && scannedCount >= scanLimit) break;

        if (!activeOldestFolder) {
          const candidates: any[] = [];
          persistedDirsMap.forEach((val, key) => {
            candidates.push({ ...val, drive_id: key });
          });

          candidates.push({
            drive_id: "root",
            path: "/",
            name: "マイドライブ",
            depth: 0,
            last_traversed_at: localRootLastTraversedAt || null,
            next_page_token: localRootNextPageToken || null
          });

          candidates.sort((a, b) => {
            if (!a.last_traversed_at && !b.last_traversed_at) return (a.path || "").localeCompare(b.path || "");
            if (!a.last_traversed_at) return -1;
            if (!b.last_traversed_at) return 1;
            return new Date(a.last_traversed_at).getTime() - new Date(b.last_traversed_at).getTime();
          });

          activeOldestFolder = candidates[0];
          folderToken = activeOldestFolder.next_page_token || null;
          setActiveScanFolder({ drive_id: activeOldestFolder.drive_id, name: activeOldestFolder.name, path: activeOldestFolder.path });
        }

        const response = await fetch("/api/drive/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getDriveAuthHeaders(token) },
          body: JSON.stringify({
            parentFolderId: activeOldestFolder.drive_id,
            nextPageToken: folderToken,
            pageSize: 50,
            scanMode: "progressive-scan",
            cacheScope: userId
          })
        });

        if (!response.ok) {
          if (response.status === 401) {
            onSessionExpiry?.();
            throw new Error("401");
          }
          throw new Error("API Fail");
        }

        const data = await response.json();
        const subdirsReceived = data.files || [];
        
        let folderBatch = writeBatch(db);
        let folderBatchCount = 0;
        const parentCleanPath = activeOldestFolder.path === "/" ? "" : activeOldestFolder.path;

        for (const file of subdirsReceived) {
          if (!crawlActiveRef.current) break;
          let resolvedId = file.id;
          if (file.mimeType === "application/vnd.google-apps.shortcut" && file.shortcutDetails) {
            resolvedId = file.shortcutDetails.targetId;
          }

          const fullPath = `${parentCleanPath}/${file.name}`;
          const isNameIgnored = isIgnoredFolderName(file.name, ignoredFolderNames);
          const isPathIgnored = isIgnoredPath(fullPath, ignoredFolderNames);

          if (isNameIgnored || isPathIgnored) {
            if (isNameIgnored) setCrawlStats(prev => ({ ...prev, ignored: prev.ignored + 1 }));
            if (persistedDirsMap.has(resolvedId)) {
              setCrawlStats(prev => ({ ...prev, removed: prev.removed + 1 }));
              folderBatch.delete(doc(db, "users", userId, "directories", resolvedId));
              folderBatchCount++;
            }
            continue;
          }

          const existingDir = persistedDirsMap.get(resolvedId);
          if (skipExistingFolders && existingDir) {
            setCrawlStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
            continue;
          }

          const progressiveUpdateData: any = {
            drive_id: resolvedId,
            name: file.name,
            path: fullPath,
            depth: activeOldestFolder.depth + 1,
            index_status: existingDir?.index_status || "pending",
            parent_id: activeOldestFolder.drive_id,
            last_traversed_at: existingDir?.last_traversed_at || null,
            last_updated_at: existingDir?.last_updated_at || null
          };

          folderBatch.set(doc(db, "users", userId, "directories", resolvedId), progressiveUpdateData, { merge: true });
          folderBatchCount++;
          scannedCount++;
          setCrawlStats(prev => ({ ...prev, discovered: prev.discovered + 1 }));

          const savedFolder = { ...progressiveUpdateData, parents: [activeOldestFolder.drive_id] };
          persistedDirsMap.set(resolvedId, savedFolder);
          pathResolutionMap.set(resolvedId, savedFolder);

          if (folderBatchCount >= 450) {
            await folderBatch.commit();
            folderBatch = writeBatch(db);
            folderBatchCount = 0;
          }
        }

        if (folderBatchCount > 0) await folderBatch.commit();
        folderToken = data.nextPageToken || null;
        const finishedTime = new Date().toISOString();

        if (activeOldestFolder.drive_id === "root") {
          localRootNextPageToken = folderToken;
          localRootLastTraversedAt = finishedTime;
          await saveSyncStateToDb(currentToken, "running", baselineTime, false, localRootNextPageToken, localRootLastTraversedAt);
        } else {
          await setDoc(doc(db, "users", userId, "directories", activeOldestFolder.drive_id), {
            last_traversed_at: finishedTime,
            next_page_token: folderToken
          }, { merge: true });

          const existing = persistedDirsMap.get(activeOldestFolder.drive_id);
          if (existing) {
            existing.last_traversed_at = finishedTime;
            existing.next_page_token = folderToken;
          }
        }

        activeOldestFolder = null;
        setActiveScanFolder(null);
      }

      await new Promise(r => setTimeout(r, config.rate_limit_delay_ms));
    }

    if (!crawlActiveRef.current) {
      await saveSyncStateToDb(currentToken, "idle", baselineTime, false);
      return;
    }

    const completionTime = new Date().toISOString();
    await saveSyncStateToDb(null, "idle", completionTime, true);
    onAddLog("success", `ドライブ走査完了。新たに ${scannedCount} 件同期されました。`);

  } catch (err: any) {
    onAddLog("error", "走査エラー:", err.message || err);
    if (!err.message?.includes("401")) {
      await saveSyncStateToDb(currentToken, "error", baselineTime, false);
    }
  } finally {
    setIsCrawlActive(false);
    setCrawlMode(null);
    setActiveScanFolder(null);
  }
}
