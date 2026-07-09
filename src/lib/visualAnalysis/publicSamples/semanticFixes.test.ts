import test from 'node:test';
import assert from 'node:assert';
import { jobToSummary } from '../serverJobs/jobAdapters';
import { 
  buildBatchAnalysisBundleForChat as buildBatchAnalysisBundle, 
  validateBatchRunInvariants,
  buildComparisonCoverage,
  buildInputSizeSummary
} from './reportBuilder';
import { ProviderGenerationRetryPolicy } from '../../gemini';

test('jobToSummary semantics for 1 success 1 fail', () => {
  const summary = jobToSummary({
    jobId: '123',
    createdAt: 'now',
    startedAt: 'now',
    completedAt: 'now',
    durationMs: 100,
    modelName: 'model',
    status: 'completed',
    targetSampleIds: ['1', '2'],
    jsonMode: 'true',
    counters: {
      total: 2,
      successCount: 1,
      failureCount: 1,
      validCount: 1,
      validLowQualityCount: 0,
      invalidJsonCount: 0,
      expectedComparisonPassCount: 0,
      expectedComparisonWarningCount: 1,
      expectedComparisonFailCount: 0,
      reviewPassCount: 0,
      reviewNeedsReviewCount: 0,
      reviewFailCount: 0,
    },
    items: [
      { sampleId: '1', status: 'succeeded', comparison: { overallStatus: 'warning' } as any },
      { sampleId: '2', status: 'failed', failureKind: 'providerGenerationError', error: 'fail' }
    ]
  });

  assert.strictEqual(summary.processedCount, 2);
  assert.strictEqual(summary.completedCount, 2);
  assert.strictEqual(summary.pendingCount, 0);
  assert.strictEqual(summary.isComplete, true);
});

test('suspiciousAllComparisonFail is false for 1 success (warning) and 1 failure', () => {
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
  });

  assert.strictEqual(summary.comparisonRecordConsistency.suspiciousAllComparisonFail, false);
});

test('suspiciousAllComparisonFail is true only when all successful items fail', () => {
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
  });

  assert.strictEqual(summary.comparisonRecordConsistency.suspiciousAllComparisonFail, true);
});

test('gemini 500 INTERNAL with retryInternalErrors: false', async () => {
  const geminiModule = await import('../../gemini.ts');
  const realAi = geminiModule.getGeminiClient("model");
  const originalGenerateContent = realAi.models.generateContent;
  
  realAi.models.generateContent = async () => {
    const err = new Error("Internal Server Error") as any;
    err.status = 500;
    throw err;
  };
  
  try {
    await geminiModule.generateContentWithRetry("model", "prompt", 3, { retryPolicy: { retryInternalErrors: false, maxAttempts: 3, baseDelayMs: 10 } });
    assert.fail("Should throw");
  } catch (e: any) {
    realAi.models.generateContent = originalGenerateContent;
    assert.strictEqual(e.statusCode, 500);
    assert.strictEqual(e.retryable, false);
    assert.strictEqual(e.attempts.length, 1);
    assert.strictEqual(e.notRetriedReason, "retryInternalErrors=false");
  }
});

test('comparison coverage scoping excludes generation failures from missing comparison counts', () => {
  const cov = buildComparisonCoverage([
    {
      sampleId: '1',
      title: '1',
      success: true,
      record: { evaluation: { expectedMetadata: { imageKind: 'photo' } } } as any,
      comparison: { overallStatus: 'pass' } as any
    },
    {
      sampleId: '2',
      title: '2',
      success: false,
      record: { evaluation: { expectedMetadata: { imageKind: 'photo' } } } as any,
    }
  ]);

  assert.strictEqual(cov.allItemsWithExpectedMetadata, 2);
  assert.strictEqual(cov.comparableItemsWithExpectedMetadata, 1);
  assert.strictEqual(cov.itemsWithComparison, 1);
  assert.strictEqual(cov.comparisonMissingCount, 0);
  assert.strictEqual(cov.consistent, true);
});

test('expanded image input appears in expansion metrics', () => {
  const sizes = buildInputSizeSummary([
    {
      sampleId: '1',
      title: '1',
      success: true,
      record: { diagnostics: { input: { originalByteLength: 1000, processedByteLength: 2500 } } } as any
    }
  ]);
  assert.strictEqual(sizes.imageExpansionMetrics.bytesIncreasedInputs, 1);
  assert.strictEqual(sizes.imageExpansionMetrics.totalBytesIncreased, 1500);
  assert.strictEqual(sizes.imageExpansionMetrics.largestExpandedInputs.length, 1);
});
