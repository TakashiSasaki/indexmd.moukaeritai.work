import { SummaryAnalysisResultV12 } from "./types";

export interface TextAnalysisStatus {
  success: boolean;
  error?: string;
  failureKind?: string;
}

export interface TextAssetMetadata {
  assetId?: string;
  fileId?: string;
  name?: string;
  title?: string;
  sourceKind?: "googleDrive" | "publicSample" | "upload" | "local" | "unknown";
  path?: string;
  mimeType?: string | null;
  extension?: string | null;
  sourceProvider?: string;
  sourceUrl?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface TextTechnicalMetadata {
  mimeType?: string | null;
  extension?: string | null;
  byteLength?: number;
  encoding?: string;
  originalTextLength?: number;
  extractedTextLength?: number;
  contentSampleLength?: number;
  truncated?: boolean;
  truncationLimit?: number;
  textExtractionMethod?: string;
  ocrUsed?: boolean;
  pageCount?: number;
  lineCount?: number;
}

export interface TextAnalysisRunMetadata {
  runId: string;
  timestamp: string; // ISO format
  model: {
    name: string;
    providerFamily?: string;
    structuredRecommendation?: string;
  };
  execution: {
    outputMode?: string;
    structuredExecutionMode?: string;
    jsonMode?: string;
    customSchemaUsed?: boolean;
    responseSchemaEnabled?: boolean;
    repairApplied?: boolean;
    repairFallbackUsed?: boolean;
  };
  schema: {
    resultSchemaVersion: string;
    recordSchemaVersion: string;
  };
  prompt: {
    summaryPromptVersion?: string;
    systemInstructionVersion?: string;
    customInstructionUsed?: boolean;
  };
  input?: {
    sourceKind?: string;
    fileId?: string;
    mimeType?: string | null;
    byteLength?: number;
    contentSampleLength?: number;
  };
}

export interface TextAnalysisQualityIssue {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
}

export interface TextAnalysisEvaluation {
  qualityStatus?: "valid" | "validWithRepair" | "validLowQuality" | "invalid";
  qualityScore?: number;
  qualityIssues?: TextAnalysisQualityIssue[];
  recommendedForPersistence?: boolean;
  recommendedForIndexMdCandidate?: boolean;
  experimentalModel?: boolean;
  reviewStatus?: string;
  reviewReasons?: string[];
  reviewNotes?: string[];
}

export interface TextAnalysisDiagnostics {
  input?: unknown;
  extraction?: unknown;
  generation?: unknown;
  response?: unknown;
  parse?: unknown;
  normalization?: unknown;
  repair?: unknown;
  validation?: unknown;
  retry?: unknown;
}

export interface TextAnalysisRecord {
  schemaVersion: "text-analysis-record.v0.1.0";
  status: TextAnalysisStatus;
  assetMetadata: TextAssetMetadata;
  technicalMetadata?: TextTechnicalMetadata;
  summaryAnalysis?: SummaryAnalysisResultV12;
  analysisRun?: TextAnalysisRunMetadata;
  evaluation?: TextAnalysisEvaluation;
  diagnostics?: TextAnalysisDiagnostics;
}
