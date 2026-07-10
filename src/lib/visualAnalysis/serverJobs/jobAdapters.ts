import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';

export function jobToSummary(job: VisualBatchJob) {
  // convert job items to PublicSampleBatchRunItem
  const items = job.items.map(item => ({
    sampleId: item.sampleId,
    title: item.title || item.sampleId,
    success: item.status === 'succeeded',
    comparison: item.comparison,
    error: item.error,
    failureKind: item.failureKind,
    record: item.record,
    attempts: item.attempts,
    retryHistory: item.retryHistory,
    nextRetryAt: item.nextRetryAt,
    retryExhausted: item.retryExhausted,
    resumeAfter: item.resumeAfter,
    pauseReason: item.pauseReason,
    blockedReason: item.blockedReason,
    affectedSampleIds: item.affectedSampleIds,
    attemptState: item.attemptState,
  })) as any[];

  return {
    jobStatus: job.status,
    completedCount: job.counters.successCount + job.counters.failureCount,
    pendingCount: Math.max(job.counters.total - (job.counters.successCount + job.counters.failureCount), 0),
    processedCount: job.counters.successCount + job.counters.failureCount,
    isComplete: job.status === 'completed' || job.status === 'canceled' || job.status === 'failed',
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    durationMs: job.durationMs,
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
