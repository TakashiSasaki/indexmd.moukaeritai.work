import { PublicSampleBatchRunSummary, PublicSampleBatchRunItem } from './batchTypes';
import { stringifyJsonArtifact } from './artifactUtils';

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
      jsonRecoveryUsed?: boolean;
      schemaVersionCorrected?: boolean;
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
        const category = (item.responseRaw?.sampleMetadata as any)?.category || (item.comparison as any)?.category || "unknown";
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
        const execution = item.analysisRun?.execution ?? item.responseRaw?.analysisRun?.execution;
        const jsonRecovery = execution?.jsonRecovery;
        const localRepairAttempted = jsonRecovery?.localRepairAttempted ?? false;
        const modelRetryAttempted = jsonRecovery?.modelRetryAttempted ?? false;
        const retryCount = jsonRecovery?.retryCount ?? 0;
        const jsonRecoveryUsed = localRepairAttempted || modelRetryAttempted || retryCount > 0;

        const normDiag = item.normalizationDiagnostics ?? item.responseRaw?.normalizationDiagnostics ?? item.analysisRun?.normalizationDiagnostics;
        const schemaVersionCorrected = normDiag?.schemaVersionCorrected ?? false;

        byRun[run.runId] = {
          success: item.success,
          failureKind: item.failureKind,
          qualityStatus: item.qualityStatus,
          qualityScore: item.qualityScore,
          reviewStatus: item.comparison?.reviewStatus,
          expectedComparisonStatus: item.comparison?.overallStatus,
          parseFailure: item.failureKind === 'jsonParseError',
          jsonRecoveryUsed,
          schemaVersionCorrected
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
  const nativeRun = runs.find(r => r.jsonMode === 'native_schema');
  const promptedRun = runs.find(r => r.jsonMode === 'prompted_json');

  if (nativeRun && promptedRun) {
    const nativeParseFailures = nativeRun.items.filter(it => it.failureKind === 'jsonParseError').length;
    const promptedParseFailures = promptedRun.items.filter(it => it.failureKind === 'jsonParseError').length;

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
  let generationFailureCount = 0;
  let mediaResolutionFallbackCount = 0;

  for (const run of runs) {
    for (const item of run.items) {
      // Prompt recovery
      const execution = item.analysisRun?.execution ?? item.responseRaw?.analysisRun?.execution;
      const jsonRecovery = execution?.jsonRecovery;
      if (jsonRecovery?.localRepairAttempted || jsonRecovery?.modelRetryAttempted || (jsonRecovery?.retryCount ?? 0) > 0) {
        promptRecoveryUsedCount++;
      }

      // API failure
      if (!item.success) {
        if (item.failureKind === 'apiError' || item.responseDiagnostics) {
          apiFailureCount++;
        } else if (item.failureKind === 'jsonParseError') {
          // not counted as API failure or generation exception
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
