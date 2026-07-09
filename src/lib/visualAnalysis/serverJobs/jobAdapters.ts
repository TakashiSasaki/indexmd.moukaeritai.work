import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';

export function jobToSummary(job: VisualBatchJob) {
  // convert job items to PublicSampleBatchRunItem
  const items = job.items.map(item => ({
    sampleId: item.sampleId,
    title: item.title || item.sampleId,
    success: item.status === 'succeeded',
    record: item.record,
    responseDiagnostics: item.responseDiagnostics,
    retryDiagnostics: item.retryDiagnostics,
    error: item.error,
    failureKind: item.failureKind,
  })) as any[];

  return {
    runId: job.jobId,
    timestamp: job.createdAt,
    modelName: job.modelName,
    jsonMode: job.jsonMode,
    total: job.counters.total,
    successCount: job.counters.successCount,
    failureCount: job.counters.failureCount,
    validCount: job.counters.validCount,
    validLowQualityCount: job.counters.validLowQualityCount,
    invalidJsonCount: job.counters.invalidJsonCount,
    expectedComparisonPassCount: job.counters.expectedComparisonPassCount,
    expectedComparisonWarningCount: job.counters.expectedComparisonWarningCount,
    expectedComparisonFailCount: job.counters.expectedComparisonFailCount,
    reviewPassCount: job.counters.reviewPassCount,
    reviewNeedsReviewCount: job.counters.reviewNeedsReviewCount,
    reviewFailCount: job.counters.reviewFailCount,
    items
  };
}
