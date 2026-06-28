import { PublicSampleBatchRunSummary, PublicSampleBatchRunItem } from './batchTypes';
import { stringifyJsonArtifact } from './artifactUtils';
import { PUBLIC_VISUAL_SAMPLES } from './registry';
import {
  isNetworkFailure,
  isRateLimitFailure,
  isTransportOrResponseFailure,
  isModelParseFailure,
  isSchemaValidationFailure,
  getItemExecutionMetadata
} from './reportBuilder';

export function getItemJsonRecovery(item: any) {
  const exec = getItemExecutionMetadata(item);
  return exec.jsonRecovery;
}

export function getItemFailureTaxonomy(item: PublicSampleBatchRunItem): string {
  if (item.success) return "success";
  if (isRateLimitFailure(item)) return "rateLimit";
  if (isNetworkFailure(item)) return "network";
  if (isTransportOrResponseFailure(item)) return "transport";
  if (isModelParseFailure(item)) return "parse";
  if (isSchemaValidationFailure(item)) return "validation";
  return "generation";
}

export interface VisualAnalysisPublicSampleBatchComparison {
  reportKind: "visualAnalysisPublicSampleBatchComparison";
  generatedAt: string;
  comparedRuns: Array<{
    runId: string;
    modelName: string;
    jsonMode: string;
    total: number;
    successCount: number;
    failureCount: number;
    invalidJsonCount: number;
    reviewPassCount: number;
    reviewNeedsReviewCount: number;
    reviewFailCount: number;
  }>;
  perSampleComparison: Array<{
    sampleId: string;
    title: string;
    category: string;
    byRun: Record<string, {
      success: boolean;
      failureKind?: string;
      qualityStatus?: string;
      qualityScore?: number;
      reviewStatus?: string;
      expectedComparisonStatus?: string;
      parseFailure?: boolean;
      validationFailure?: boolean;
      rateLimited?: boolean;
      networkFailure?: boolean;
      schemaValidationRecoveryUsed?: boolean;
      jsonRecoveryUsed?: boolean;
      schemaVersionCorrected?: boolean;
      taxonomyCategory?: string;
    }>;
  }>;
  aggregateDelta?: {
    nativeSchemaVsPromptedJson?: {
      successDelta: number;
      invalidJsonDelta: number;
      reviewPassDelta: number;
      reviewFailDelta: number;
      parseFailureDelta: number;
    };
  };
  diagnosticNotes: {
    promptRecoveryUsedCount: number;
    apiFailureCount: number;
    networkFailureCount?: number;
    rateLimitCount?: number;
    parseFailureCount?: number;
    validationFailureCount?: number;
    generationFailureCount: number;
    mediaResolutionFallbackCount: number;
  };
  artifactIntegrity: {
    generatedAt: string;
    runCount: number;
    hash: string;
    endSentinel: "END_OF_VISUAL_ANALYSIS_BATCH_COMPARISON";
  };
}

export function buildBatchComparisonReportForChat(runs: PublicSampleBatchRunSummary[]): VisualAnalysisPublicSampleBatchComparison {
  const generatedAt = new Date().toISOString();
  
  // 1. Gather compared runs summary
  const comparedRuns = runs.map(run => {
    return {
      runId: run.runId,
      modelName: run.modelName,
      jsonMode: run.jsonMode,
      total: run.total,
      successCount: run.successCount,
      failureCount: run.failureCount,
      invalidJsonCount: run.invalidJsonCount,
      reviewPassCount: run.reviewPassCount ?? 0,
      reviewNeedsReviewCount: run.reviewNeedsReviewCount ?? 0,
      reviewFailCount: run.reviewFailCount ?? 0
    };
  });

  // 2. Gather unique samples
  const allSampleIdsSet = new Set<string>();
  const sampleMetadataMap = new Map<string, { title: string; category: string }>();

  for (const run of runs) {
    for (const item of run.items) {
      allSampleIdsSet.add(item.sampleId);
      if (!sampleMetadataMap.has(item.sampleId)) {
        const matchedSample = PUBLIC_VISUAL_SAMPLES.find(s => s.id === item.sampleId);
        const category = item.category ||
                         matchedSample?.category ||
                         (item.responseRaw?.sampleMetadata as any)?.category || 
                         (item.comparison as any)?.category || 
                         "unknown";
        sampleMetadataMap.set(item.sampleId, {
          title: item.title,
          category
        });
      }
    }
  }

  const sampleIds = Array.from(allSampleIdsSet).sort();

  // 3. Build per-sample comparison mapping
  const perSampleComparison = sampleIds.map(sampleId => {
    const meta = sampleMetadataMap.get(sampleId) || { title: sampleId, category: "unknown" };
    const byRun: Record<string, any> = {};

    for (const run of runs) {
      const item = run.items.find(it => it.sampleId === sampleId);
      if (item) {
        const exec = getItemExecutionMetadata(item);
        const jsonRecovery = exec.jsonRecovery;
        const localRepairAttempted = jsonRecovery?.localRepairAttempted ?? false;
        const modelRetryAttempted = jsonRecovery?.modelRetryAttempted ?? false;
        const retryCount = jsonRecovery?.retryCount ?? 0;
        const jsonRecoveryUsed = localRepairAttempted || modelRetryAttempted || retryCount > 0;

        const normDiag = item.normalizationDiagnostics ?? item.responseRaw?.normalizationDiagnostics ?? item.analysisRun?.normalizationDiagnostics;
        const schemaVersionCorrected = normDiag?.schemaVersionCorrected ?? false;

        const taxonomyCategory = getItemFailureTaxonomy(item);
        const schemaValidationRecoveryUsed = !!(
          jsonRecovery?.schemaValidationRecoveryAttempted || 
          (jsonRecovery?.schemaValidationRetryCount && jsonRecovery.schemaValidationRetryCount > 0)
        );

        byRun[run.runId] = {
          success: item.success,
          failureKind: item.failureKind,
          qualityStatus: item.qualityStatus,
          qualityScore: item.qualityScore,
          reviewStatus: item.comparison?.reviewStatus,
          expectedComparisonStatus: item.comparison?.overallStatus,
          parseFailure: isModelParseFailure(item),
          validationFailure: isSchemaValidationFailure(item),
          rateLimited: isRateLimitFailure(item),
          networkFailure: isNetworkFailure(item),
          schemaValidationRecoveryUsed,
          jsonRecoveryUsed,
          schemaVersionCorrected,
          taxonomyCategory
        };
      }
    }

    return {
      sampleId,
      title: meta.title,
      category: meta.category,
      byRun
    };
  });

  // 4. Calculate aggregate deltas if native_schema and prompted_json are both present
  let aggregateDelta: VisualAnalysisPublicSampleBatchComparison["aggregateDelta"] = undefined;
  
  const nativeRun = runs.find(r => 
    r.jsonMode === 'native_schema' || 
    r.jsonMode === 'nativeSchema' || 
    r.items.some(it => {
      const exec = getItemExecutionMetadata(it);
      return exec.structuredExecutionMode === 'nativeSchema' || exec.jsonMode === 'native_schema';
    })
  );
  
  const promptedRun = runs.find(r => 
    r.jsonMode === 'prompted_json' || 
    r.jsonMode === 'prompt_only' || 
    r.jsonMode === 'promptedJson' ||
    r.items.some(it => {
      const exec = getItemExecutionMetadata(it);
      return exec.structuredExecutionMode === 'promptedJson' || exec.jsonMode === 'prompt_only' || exec.jsonMode === 'prompted_json';
    })
  );

  if (nativeRun && promptedRun) {
    const nativeParseFailures = nativeRun.items.filter(isModelParseFailure).length;
    const promptedParseFailures = promptedRun.items.filter(isModelParseFailure).length;

    aggregateDelta = {
      nativeSchemaVsPromptedJson: {
        successDelta: nativeRun.successCount - promptedRun.successCount,
        invalidJsonDelta: nativeRun.invalidJsonCount - promptedRun.invalidJsonCount,
        reviewPassDelta: (nativeRun.reviewPassCount ?? 0) - (promptedRun.reviewPassCount ?? 0),
        reviewFailDelta: (nativeRun.reviewFailCount ?? 0) - (promptedRun.reviewFailCount ?? 0),
        parseFailureDelta: nativeParseFailures - promptedParseFailures
      }
    };
  }

  // 5. Build diagnostics aggregates
  let promptRecoveryUsedCount = 0;
  let apiFailureCount = 0;
  let networkFailureCount = 0;
  let rateLimitCount = 0;
  let parseFailureCount = 0;
  let validationFailureCount = 0;
  let generationFailureCount = 0;
  let mediaResolutionFallbackCount = 0;

  for (const run of runs) {
    for (const item of run.items) {
      // Prompt recovery
      const jsonRecovery = getItemJsonRecovery(item);
      if (
        jsonRecovery?.localRepairAttempted || 
        jsonRecovery?.modelRetryAttempted || 
        (jsonRecovery?.retryCount ?? 0) > 0 ||
        jsonRecovery?.schemaValidationRecoveryAttempted
      ) {
        promptRecoveryUsedCount++;
      }

      // Detailed failure taxonomy aggregates
      if (!item.success) {
        if (isRateLimitFailure(item)) {
          rateLimitCount++;
        } else if (isNetworkFailure(item)) {
          networkFailureCount++;
        } else if (isTransportOrResponseFailure(item)) {
          apiFailureCount++;
        } else if (isModelParseFailure(item)) {
          parseFailureCount++;
        } else if (isSchemaValidationFailure(item)) {
          validationFailureCount++;
        } else {
          generationFailureCount++;
        }
      }

      // Media resolution fallback
      const runMeta = item.analysisRun?.metadata ?? item.analysisRun;
      if (runMeta?.generationConfig?.mediaResolutionFallbackUsed) {
        mediaResolutionFallbackCount++;
      }
    }
  }

  const diagnosticNotes = {
    promptRecoveryUsedCount,
    apiFailureCount,
    networkFailureCount,
    rateLimitCount,
    parseFailureCount,
    validationFailureCount,
    generationFailureCount,
    mediaResolutionFallbackCount
  };

  // 6. Calculate artifact integrity hash
  const partialReport = {
    reportKind: "visualAnalysisPublicSampleBatchComparison" as const,
    generatedAt,
    comparedRuns,
    perSampleComparison,
    aggregateDelta,
    diagnosticNotes
  };

  const artifactStr = stringifyJsonArtifact(partialReport);

  return {
    ...partialReport,
    artifactIntegrity: {
      generatedAt,
      runCount: runs.length,
      hash: artifactStr.hash,
      endSentinel: "END_OF_VISUAL_ANALYSIS_BATCH_COMPARISON" as const
    }
  };
}
