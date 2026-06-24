export interface Directory {
  drive_id: string; // Google Drive folder ID
  name: string; // Folder name
  path: string; // Absolute path from root (e.g., "/My Folder/Subfolder")
  depth: number; // Hierarchical level (root = 0, subfolders are 1, 2, ...)
  index_status: "pending" | "processing" | "indexed" | "error";
  last_traversed_at: string | null;
  last_updated_at: string | null;
  parent_id: string | null;
  next_page_token?: string | null;
  ai_summary?: string;
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

export interface ValidationRecord {
  id: string;
  timestamp: string;
  status: "success" | "error";
  fileName: string;
  mimeType: string;
  model: string;
  details?: string;
}

export interface ModelPricing {
  freeTier: boolean;
  inputPrice: string; // e.g. "$1.50 / 1M tokens"
  outputPrice: string; // e.g. "$9.00 / 1M tokens"
}

export interface ModelInfo {
  id: string;
  apiIdentifier: string;
  label: string;
  description: string;
  primary?: boolean;
  pricing: ModelPricing;
  modalities: string[]; // e.g. ["text", "image", "audio", "video", "pdf"]
  knowledgeCutOff?: string;
  releaseDate?: string;
}

export interface AppConfig {
  rate_limit_delay_ms: number;
  max_logs_count: number;
  logs_cleanup_threshold: number;
  gemini_model: string;
}
