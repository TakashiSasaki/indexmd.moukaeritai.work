import { ImageAnalysisRecord } from '../types';
import { PublicSampleComparisonSummary } from './compare';
import { ResponseDiagnostics, SafeFetchRetryDiagnostics } from '../safeFetch';
import { ImageProcessingDiagnostics } from '../imagePayloadSizing';

export interface PublicSampleInputDiagnostics extends Partial<ImageProcessingDiagnostics> {
  sourceKind?: "publicSample" | "driveFile" | string;
  sampleId?: string;
  mimeType?: string;
  byteLength?: number;
  base64Length?: number;
  imageVariant?: string;
  analysisSourceUrlKind?: string;
  inputSizeWarning?: string;
  cacheLayer?: "memory" | "disk" | "miss";
  cacheKey?: string;
  cachePolicyVersion?: string;
  cacheStored?: boolean;
  cacheReadError?: string;
  cacheWriteError?: string;
  cacheSharedInFlight?: boolean;
}

export interface PublicSampleBatchRunItem {
  sampleId: string;
  title: string;
  success: boolean;
  record?: ImageAnalysisRecord;
  qualityStatus?: string;
  qualityScore?: number;
  qualityIssues?: any[];
  analysisRun?: any;
  parseDiagnostics?: any;
  comparison?: PublicSampleComparisonSummary;
  error?: string;
  failureKind?: string;
  generationDiagnostics?: any;
  inputDiagnostics?: PublicSampleInputDiagnostics;
  normalizationDiagnostics?: any;
  
  responseRaw?: any;
  responseDiagnostics?: ResponseDiagnostics;
  retryDiagnostics?: SafeFetchRetryDiagnostics;
  category?: string;
  execution?: any;
  taxonomyCategory?: string;
}

export interface PublicSampleBatchRunSummary {
  runId: string;
  timestamp: string;
  modelName: string;
  jsonMode: string;
  total: number;
  successCount: number;
  failureCount: number;
  validCount: number;
  validLowQualityCount: number;
  invalidJsonCount: number;
  expectedComparisonPassCount: number;
  expectedComparisonWarningCount: number;
  expectedComparisonFailCount: number;
  reviewPassCount?: number;
  reviewNeedsReviewCount?: number;
  reviewFailCount?: number;
  providerQuotaSummary?: any;
  rateLimitSummary?: any;
  items: PublicSampleBatchRunItem[];
}

export type VisualBatchJobStatus =
  | "queued"
  | "running"
  | "paused"
  | "interrupted"
  | "failed"
  | "completed"
  | "canceled";

export type VisualBatchJobItemStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "canceled";

export interface VisualBatchJobEvent {
  type:
    | "jobCreated"
    | "jobQueued"
    | "jobStarted"
    | "healthCheckStarted"
    | "healthCheckPassed"
    | "healthCheckFailed"
    | "sampleStarted"
    | "apiRequestStarted"
    | "apiResponseReceived"
    | "sampleSucceeded"
    | "sampleFailed"
    | "checkpointSaved"
    | "checkpointSaveFailed"
    | "jobPaused"
    | "jobInterrupted"
    | "jobFailed"
    | "jobCompleted"
    | "jobCanceled"
    // 既存のイベント名との互換性
    | "batchStarted"
    | "sampleCompleted"
    | "batchInterrupted"
    | "batchFailed"
    | "batchCompleted";

  timestamp: string;
  sampleId?: string;
  sampleTitle?: string;
  message?: string;
  failureKind?: string;
  error?: string;
}

export interface VisualBatchJobItem {
  sampleId: string;
  title?: string;
  status: VisualBatchJobItemStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  failureKind?: string;

  qualityStatus?: string;
  qualityScore?: number;
  qualityIssues?: any[];

  
  record?: ImageAnalysisRecord;
  responseRaw?: any;
  responseDiagnostics?: any;
  retryDiagnostics?: any;
  generationDiagnostics?: any;
  parseDiagnostics?: any;
  normalizationDiagnostics?: any;
  inputDiagnostics?: any;
  comparison?: any;
}

export interface VisualBatchJob {
  jobId: string;
  runId?: string;
  status: VisualBatchJobStatus;

  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;

  modelName: string;
  jsonMode: string;
  customInstructionHash?: string;
  customInstructionPreview?: string;
  executionPrivate?: { customInstruction?: string; };

  targetSampleIds: string[];
  completedSampleIds: string[];
  pendingSampleIds: string[];
  failedSampleIds: string[];

  currentSampleId?: string;
  currentSampleTitle?: string;

  counters: {
    total: number;
    successCount: number;
    failureCount: number;
    validCount: number;
    validLowQualityCount: number;
    invalidJsonCount: number;
    expectedComparisonPassCount: number;
    expectedComparisonWarningCount: number;
    expectedComparisonFailCount: number;
    reviewPassCount: number;
    reviewNeedsReviewCount: number;
    reviewFailCount: number;
  };

  lastEvent?: VisualBatchJobEvent;
  lastHeartbeatAt?: string;
  lastCheckpointSavedAt?: string;
  lastError?: string;
  lastFailureKind?: string;

  items: VisualBatchJobItem[];
}
