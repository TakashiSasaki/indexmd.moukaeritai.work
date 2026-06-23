export interface Directory {
  drive_id: string; // Google Drive folder ID
  path: string; // Absolute path from root (e.g., "/My Folder/Subfolder")
  depth: number; // Hierarchical level (root = 0, subfolders are 1, 2, ...)
  sync_status: "pending" | "scanning" | "scanned" | "error";
  index_status: "pending" | "processing" | "indexed" | "error";
  last_traversed_at: string | null;
  last_updated_at: string | null;
  parent_id: string | null;
  next_page_token?: string | null;
  ai_summary?: string;
  files_count?: number;
  subdirectories_count?: number;
}

export interface SyncState {
  nextPageToken: string | null;
  sync_status: "idle" | "running" | "paused" | "error";
  last_traversed_at: string | null;
}

export interface DriveLog {
  id?: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
  details?: string;
}

export interface AppConfig {
  rate_limit_delay_ms: number;
  max_logs_count: number;
  logs_cleanup_threshold: number;
  max_concurrent_tasks: number;
  retry_delay_ms: number;
  gemini_model: string;
}
