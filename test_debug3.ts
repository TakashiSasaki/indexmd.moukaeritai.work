import { buildBatchAnalysisBundleForChat as buildBatchAnalysisBundle, validateBatchRunInvariants } from './src/lib/visualAnalysis/publicSamples/reportBuilder.ts';

const summary = buildBatchAnalysisBundle({
    jobStatus: 'COMPLETED',
    isComplete: true,
    completedCount: 2,
    pendingCount: 0,
    processedCount: 2,
    startedAt: 'now',
    completedAt: 'now',
    durationMs: 100,
    runId: '123',
    timestamp: 'now',
    modelName: 'model',
    jsonMode: 'true',
    total: 2,
    successCount: 1,
    failureCount: 1,
    validCount: 1,
    validLowQualityCount: 0,
    invalidJsonCount: 0,
    expectedComparisonPassCount: 0,
    expectedComparisonWarningCount: 1,
    expectedComparisonFailCount: 1, // logic in reportBuilder test is to add generation failure to this count
    reviewPassCount: 0,
    reviewNeedsReviewCount: 0,
    reviewFailCount: 0,
    items: [
      {
        sampleId: '1',
        title: '1',
        success: true,
        record: { evaluation: { qualityStatus: 'valid', expectedMetadata: { imageKind: 'photo' } }, visualAnalysis: { visualInfo: { imageKind: 'photo' } } } as any,
        comparison: { overallStatus: 'warning' } as any,
        failureKind: undefined
      },
      {
        sampleId: '2',
        title: '2',
        success: false,
        failureKind: 'providerGenerationError',
        error: 'fail'
      }
    ]
  } as any);

const inv = validateBatchRunInvariants(summary as any);
console.log(JSON.stringify(inv, null, 2));
