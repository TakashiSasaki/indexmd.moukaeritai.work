import { PublicSampleBatchRunItem, PublicSampleBatchRunSummary } from './batchTypes';
import { fnv1a32 } from './artifactUtils';

export interface PublicSampleBatchCheckpoint {
  checkpointVersion: "public-sample-batch-checkpoint.v0.1.0";
  runId: string;
  createdAt: string;
  updatedAt: string;
  status: "running" | "paused" | "failed" | "completed";
  modelName: string;
  jsonMode: string;
  customInstructionHash: string;
  customInstructionPreview?: string;
  targetSampleIds: string[];
  completedSampleIds: string[];
  pendingSampleIds: string[];
  failedSampleIds: string[];
  items: PublicSampleBatchRunItem[];
  counters: {
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
  runFingerprint: {
    modelName: string;
    jsonMode: string;
    customInstructionHash: string;
    targetSampleIdsHash: string;
    sampleRegistryHash?: string;
    resultSchemaVersion?: string;
    providerSchemaVersion?: string;
    analysisImagePolicyVersion?: string;
  };
}

export const CHECKPOINT_LOCAL_STORAGE_KEY = 'image_experiment_active_batch_checkpoint';

export function loadActiveBatchCheckpoint(): PublicSampleBatchCheckpoint | null {
  try {
    const data = localStorage.getItem(CHECKPOINT_LOCAL_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as PublicSampleBatchCheckpoint;
  } catch (e) {
    console.error("Failed to load active batch checkpoint", e);
    return null;
  }
}

export function saveActiveBatchCheckpoint(checkpoint: PublicSampleBatchCheckpoint): boolean {
  try {
    const shrunk = shrinkCheckpointForLocalStorage(checkpoint);
    const json = JSON.stringify(shrunk);
    
    // Check byte size
    const byteSize = new Blob([json]).size;
    if (byteSize > 1024 * 1024) {
      console.warn(`[BatchCheckpoint] Checkpoint size is large: ${(byteSize / 1024).toFixed(2)} KB`);
    }
    
    localStorage.setItem(CHECKPOINT_LOCAL_STORAGE_KEY, json);
    return true;
  } catch (e) {
    console.error("Failed to save active batch checkpoint. LocalStorage quota may be exceeded.", e);
    return false;
  }
}

export function clearActiveBatchCheckpoint() {
  try {
    localStorage.removeItem(CHECKPOINT_LOCAL_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear active batch checkpoint", e);
  }
}

export function shrinkCheckpointForLocalStorage(checkpoint: PublicSampleBatchCheckpoint): PublicSampleBatchCheckpoint {
  // Create a deep copy for safe modification
  const copy = JSON.parse(JSON.stringify(checkpoint)) as PublicSampleBatchCheckpoint;
  
  copy.items = copy.items.map(item => {
    // Remove large fields
    if (item.responseRaw) {
      delete item.responseRaw.rawOutput;
      delete item.responseRaw.rawOutputPreview;
      delete item.responseRaw.requestPreview;
      if (item.responseRaw.analysisRun?.execution?.jsonRecovery) {
        delete (item.responseRaw.analysisRun.execution.jsonRecovery as any).rawOutputPreview;
      }
    }
    if (item.analysisRun?.execution?.jsonRecovery) {
      delete (item.analysisRun.execution.jsonRecovery as any).rawOutputPreview;
    }
    if (item.parseDiagnostics) {
      delete (item.parseDiagnostics as any).rawOutputPreview;
    }
    return item;
  });
  
  return copy;
}

export function buildTargetSampleIdsHash(sampleIds: string[]): string {
  // simple hash for now
  return String(fnv1a32(sampleIds.slice().sort().join(',')));
}

export function isCheckpointCompatible(
  checkpoint: PublicSampleBatchCheckpoint,
  currentSettings: {
    modelName: string;
    jsonMode: string;
    customInstructionHash: string;
    availableSampleIds: string[];
    selectedSampleIds?: string[];
  }
): boolean {
  const baseMatch = (
    checkpoint.modelName === currentSettings.modelName &&
    checkpoint.jsonMode === currentSettings.jsonMode &&
    checkpoint.customInstructionHash === currentSettings.customInstructionHash
  );
  if (!baseMatch) return false;

  // Checkbox independence: We no longer invalidate the checkpoint when selectedSampleIds changes.
  // The checkpoint remains compatible as long as its target samples are available in the system.
  return checkpoint.targetSampleIds.every(id => currentSettings.availableSampleIds.includes(id));
}

export function rebuildBatchSummaryFromCheckpoint(checkpoint: PublicSampleBatchCheckpoint): PublicSampleBatchRunSummary {
  return {
    runId: checkpoint.runId,
    timestamp: checkpoint.createdAt,
    modelName: checkpoint.modelName,
    jsonMode: checkpoint.jsonMode,
    total: checkpoint.targetSampleIds.length,
    successCount: checkpoint.counters.successCount,
    failureCount: checkpoint.counters.failureCount,
    validCount: checkpoint.counters.validCount,
    validLowQualityCount: checkpoint.counters.validLowQualityCount,
    invalidJsonCount: checkpoint.counters.invalidJsonCount,
    expectedComparisonPassCount: checkpoint.counters.expectedComparisonPassCount,
    expectedComparisonWarningCount: checkpoint.counters.expectedComparisonWarningCount,
    expectedComparisonFailCount: checkpoint.counters.expectedComparisonFailCount,
    reviewPassCount: checkpoint.counters.reviewPassCount,
    reviewNeedsReviewCount: checkpoint.counters.reviewNeedsReviewCount,
    reviewFailCount: checkpoint.counters.reviewFailCount,
    items: checkpoint.items
  };
}
