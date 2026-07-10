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
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;

  sampleId: string;
  title: string;
  success: boolean;

  record?: ImageAnalysisRecord;
  comparison?: PublicSampleComparisonSummary;

  attempts?: number;
  retryHistory?: Array<{
    attempt: number;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    failureKind?: string;
    error?: string;
    delayBeforeNextAttemptMs?: number;
    nextRetryAt?: string;
    quotaClassification?: string;
    retryAfterReason?: string;
  }>;
  nextRetryAt?: string;
  retryExhausted?: boolean;
  resumeAfter?: string;
  pauseReason?: "pausedForRateLimit";
  blockedReason?: "blockedByQuota";
  affectedSampleIds?: string[];
  attemptState?: any;

  error?: string;
  failureKind?: string;
  
  responseDiagnostics?: ResponseDiagnostics;
  retryDiagnostics?: SafeFetchRetryDiagnostics;
}

export interface PublicSampleBatchRunSummary {
  bundleSchemaVersion?: string;
  jobId?: string;
  jobRevision?: number;
  jobStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  canceledAt?: string;
  isTerminal?: boolean;
  pendingSampleIds?: string[];
  blockedSampleIds?: string[];
  blockedCount?: number;
  blockedReason?: string;
  resumeAfter?: string;
  completedCount?: number;
  pendingCount?: number;
  processedCount?: number;
  isComplete?: boolean;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
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
  | "canceling"
  | "paused"
  | "pausedForRateLimit"
  | "blockedByQuota"
  | "blockedByConfigurationError"
  | "partiallyCompleted"
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
  | "canceled"
  | "blockedByQuota"
  | "blockedByConfigurationError"
  | "deferred"
  | "pausedForRateLimit";

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
    | "jobCancelRequested"
    | "jobCanceled"
    | "sampleRetryScheduled"
    | "sampleRetryStarted"
    | "quotaBackoffWaiting"
    | "quotaCircuitBreakerTripped"
    | "sampleRetryExhausted"
    | "jobFailed"
    | "jobBlockedByQuota"
    | "jobBlockedByConfigurationError"
    | "jobCompleted"
    | "jobForceCanceled"
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
  durationMs?: number;
  attempts?: number;
  retryHistory?: Array<{
    attempt: number;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    failureKind?: string;
    error?: string;
    delayBeforeNextAttemptMs?: number;
    nextRetryAt?: string;
    quotaClassification?: string;
    retryAfterReason?: string;
  }>;
  nextRetryAt?: string;
  retryExhausted?: boolean;
  resumeAfter?: string;
  pauseReason?: "pausedForRateLimit";
  blockedReason?: "blockedByQuota";
  affectedSampleIds?: string[];
  attemptState?: any;
  error?: string;
  failureKind?: string;
  
  record?: ImageAnalysisRecord;
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
  durationMs?: number;

  modelName: string;
  jsonMode: string;
  customInstructionHash?: string;
  customInstructionPreview?: string;
  executionPrivate?: { customInstruction?: string; };

  runFingerprint?: {
    modelName: string;
    jsonMode: string;
    customInstructionHash?: string;
    targetSampleIdsHash: string;
  };

  cancelRequestedAt?: string;
  cancelReason?: string;

  targetSampleIds: string[];
  completedSampleIds: string[];
  pendingSampleIds: string[];
  failedSampleIds: string[];
  blockedSampleIds?: string[];
  revision?: number;
  blockedReason?: string;
  resumeAfter?: string;

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
  pauseReason?: "pausedForRateLimit";
  affectedSampleIds?: string[];
  attemptState?: any;

  items: VisualBatchJobItem[];
}

export interface PublicSampleBatchAnalysisBundleReport {
  reportKind: "visualAnalysisPublicSampleBatchAnalysisBundle";
  generatedAt: string;
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
  reviewPassCount: number;
  reviewNeedsReviewCount: number;
  reviewFailCount: number;
  counterConsistency: any;
  comparisonCoverage: any;
  comparisonRecordConsistency: any;
  invariants: any;
  generationFailureSummary: any;
  apiResponseFailureSummary: any;
  parseFailureSummary: any;
  networkFailureSummary: any;
  validationFailureSummary: any;
  rateLimitSummary: any;
  providerQuotaSummary: any;
  inputSizeSummary: any;
  textHeavyEvaluation: any;
  analysisGuidance: {
    intendedUse: string;
    recommendedFirstChecks: string[];
    fullJsonPolicy: string;
    summaryPolicy: string;
    failuresPolicy: string;
  };
  failures: {
    totalFailures: number;
    items: any[];
  };
  items: any[];
  artifactIntegrity: {
    artifactKind: string;
    itemCount: number;
    firstSampleId: string;
    lastSampleId: string;
    endSentinel: string;
  };
}
