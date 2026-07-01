import { 
  doc, 
  updateDoc,
  Firestore 
} from "firebase/firestore";
import { 
  DirectoryMetadata, 
  ScanCallbacks
} from "./types";

export interface IndexerCallbacks extends ScanCallbacks {
  setIsIndexActive: (active: boolean) => void;
  setIndexingProgress: (progress: { current: number; total: number }) => void;
  setCurrentIndexingId: (id: string | null) => void;
}

export async function runIndexingJob(
  userId: string,
  token: string,
  db: Firestore,
  config: any,
  directories: DirectoryMetadata[],
  callbacks: IndexerCallbacks,
  indexActiveRef: { current: boolean }
) {
  const { onAddLog, setIsIndexActive, setIndexingProgress, setCurrentIndexingId, onSessionExpiry } = callbacks;

  const getDriveAuthHeaders = (t: string) => ({
    "Authorization": `Bearer ${t}`
  });

  setIsIndexActive(true);
  onAddLog("info", "ボトムアップ型 index.md 生成プロセスを起動中...");

  // Sort folders by depth decending (bottom-up)
  const sortedDirs = [...directories].sort((a, b) => b.depth - a.depth);
  setIndexingProgress({ current: 0, total: sortedDirs.length });

  // Pre-calculate hash map of child directories by parent_id to avoid O(N) lookup in loop
  const childrenByParent = new Map<string, any[]>();
  for (const d of directories) {
    if (d.parent_id) {
      if (!childrenByParent.has(d.parent_id)) {
        childrenByParent.set(d.parent_id, []);
      }
      childrenByParent.get(d.parent_id)!.push(d);
    }
  }

  let successCount = 0;
  let skipCount = 0;

  try {
    for (let i = 0; i < sortedDirs.length; i++) {
      if (!indexActiveRef.current) {
        onAddLog("warn", "インデックス作成処理が中断されました。");
        break;
      }
      
      const item = sortedDirs[i];
      setCurrentIndexingId(item.drive_id);
      setIndexingProgress({ current: i + 1, total: sortedDirs.length });
      callbacks.setCurrentTaskName((item.path || "").split('/').pop() || item.drive_id);
      callbacks.setCurrentTaskPath(item.path);

      onAddLog("info", `[インデックス作成中] 階層パス (${item.depth}): ${item.path}`);

      const itemRef = doc(db, "users", userId, "directories", item.drive_id);
      await updateDoc(itemRef, { index_status: "processing" });

      // Children summaries
      const childDirs = childrenByParent.get(item.drive_id) || [];
      const subdirsWithSummaries = childDirs.map(child => ({
        id: child.drive_id,
        name: (child.path || "").split("/").pop() || "",
        summary: child.ai_summary || "要約未生成"
      }));

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
        if (response.status === 401) {
          onSessionExpiry?.();
          throw new Error("401");
        }
        throw new Error(`生成失敗: ${item.path}`);
      }

      const data = await response.json();
      
      if (data.skipped) {
        await updateDoc(itemRef, {
          index_status: "indexed",
          ai_summary: "(空フォルダのため概要スキップ)",
          last_updated_at: new Date().toISOString()
        });
        skipCount++;
      } else {
        await updateDoc(itemRef, {
          index_status: "indexed",
          ai_summary: data.aiSummary || "",
          last_updated_at: new Date().toISOString()
        });
        onAddLog("success", `[完了] ${item.path} の index.md を生成しました。`);
        successCount++;
      }

      await new Promise(r => setTimeout(r, config.rate_limit_delay_ms));
    }

    onAddLog("success", `インデックス処理成功。完了: ${successCount}, スキップ: ${skipCount}`);

  } catch (err: any) {
    onAddLog("error", "インデックス作成中断:", err.message || err);
  } finally {
    setIsIndexActive(false);
  }
}
