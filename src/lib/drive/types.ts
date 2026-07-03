export interface CrawlStats {
  discovered: number;
  skipped: number;
  ignored: number;
  removed: number;
}

export interface DirectoryMetadata {
  drive_id: string;
  name: string;
  path: string;
  depth: number;
  parent_id: string | null;
  last_traversed_at: string | null;
  next_page_token: string | null;
  index_status: "pending" | "processing" | "indexed" | "error";
  ai_summary?: string;
  last_updated_at?: string | null;
}

export type LogType = "info" | "success" | "warn" | "error";

export interface ScanCallbacks {
  onAddLog: (type: LogType, message: string, detail?: any) => void;
  setIsCrawlActive: (active: boolean) => void;
  setCrawlMode: (mode: "flat" | "progressive" | null) => void;
  setActiveScanFolder: (folder: { drive_id: string; name: string; path: string } | null) => void;
  setCrawlStats: (update: (prev: CrawlStats) => CrawlStats) => void;
  onSessionExpiry?: () => void;
  setCurrentTaskId: (id: string | null) => void;
  setCurrentTaskName: (name: string | null) => void;
  setCurrentTaskPath: (path: string | null) => void;
  setLastCacheHit: (hit: boolean) => void;
  setTotalCacheHits: (update: (prev: number) => number) => void;
  setTotalCacheMisses: (update: (prev: number) => number) => void;
}
