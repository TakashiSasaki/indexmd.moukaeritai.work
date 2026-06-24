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

export interface ExperimentHistoryRecord {
  id: string;
  timestamp: string;
  inputKind: "driveFile" | "manualText";
  inputLabel: string; // safe input label
  fileMetadata?: {
    name: string;
    mimeType: string;
    modifiedTime?: string;
  };
  model: string;
  outputMode: "text" | "structured";
  schemaVersion?: string;
  promptVersion?: string; // we can store this if needed
  parseSuccess?: boolean;
  validationSuccess?: boolean;
  structuredResult?: any;
  rawOutput?: string;
  error?: string;
  validationErrors?: string[];
  warnings?: string[];
  manualTextHash?: string; // Only if we want to store it
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

export interface NamedEntity {
  name: string;
  type: string;
}

export interface ResourceReference {
  uri: string;
  raw?: string;
}

export interface TemporalReference {
  date: string;
  role: string;
  raw: string;
}

export interface Party {
  name: string;
  role: string;
  kind: string;
}

export interface MonetaryAmount {
  amount: number;
  currency: string;
  role: string;
  raw: string;
}

export interface SubjectAreas {
  mathematics?: string[];
  physics?: string[];
  biology?: string[];
  computerScience?: string[];
  socialSciences?: string[];
  humanities?: string[];
  engineering?: string[];
}

export interface SummaryAnalysisResult {
  oneLineSummary: string;
  detailedSummary: string;
  title: string;
  inferredTitle: string;
  documentTypes: string[];
  documentIntent: string;
  topics: string[];
  keywords: string[];
  namedEntities: NamedEntity[];
  resourceReferences: ResourceReference[];
  primaryLanguage: string;
  languages: string[];
  temporalReferences: TemporalReference[];
  parties: Party[];
  monetaryAmounts: MonetaryAmount[];
  subjectAreas: SubjectAreas;
  confidence: number;
  warnings: string[];
}
