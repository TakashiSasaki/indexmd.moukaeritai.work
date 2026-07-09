import { buildBatchAnalysisBundleForChat as buildBatchAnalysisBundle } from './src/lib/visualAnalysis/publicSamples/reportBuilder.ts';

const summary = buildBatchAnalysisBundle({
    jobStatus: 'COMPLETED',
    isComplete: true,
    completedCount: 1,
    pendingCount: 0,
    processedCount: 1,
    startedAt: 'now',
    completedAt: 'now',
    durationMs: 100,
    runId: '123',
    timestamp: 'now',
    modelName: 'model',
    jsonMode: 'true',
    total: 1,
    successCount: 1,
    failureCount: 0,
    validCount: 1,
    validLowQualityCount: 0,
    invalidJsonCount: 0,
    expectedComparisonPassCount: 0,
    expectedComparisonWarningCount: 0,
    expectedComparisonFailCount: 1,
    reviewPassCount: 0,
    reviewNeedsReviewCount: 0,
    reviewFailCount: 0,
    items: [
      {
        sampleId: '1',
        title: '1',
        success: true,
        record: { evaluation: { qualityStatus: 'valid', expectedMetadata: { imageKind: 'photo' } }, visualAnalysis: { visualInfo: { imageKind: 'photo' } } } as any,
        comparison: { overallStatus: 'fail' } as any,
        failureKind: undefined
      }
    ]
  } as any);

console.log("suspiciousAllComparisonFail:", summary.comparisonRecordConsistency.suspiciousAllComparisonFail);
