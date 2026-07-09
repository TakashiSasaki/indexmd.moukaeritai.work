import test from 'node:test';
import assert from 'node:assert';
import { jobToSummary } from './jobAdapters';
import { VisualBatchJob } from '../publicSamples/batchTypes';

test('jobToSummary handles partial running job', () => {
  const job: VisualBatchJob = {
    jobId: 'job-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'running',
    modelName: 'gemini-3.5-flash',
    jsonMode: 'prompt_only',
    customInstructionPreview: '',
    targetSampleIds: ['1', '2', '3'],
        completedSampleIds: ['1'],
    failedSampleIds: [],
    pendingSampleIds: ['2', '3'],
    counters: {
      total: 3,
      successCount: 1,
      failureCount: 0,
      validCount: 1,
      validLowQualityCount: 0,
      invalidJsonCount: 0,
      expectedComparisonPassCount: 0,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 0,
      reviewPassCount: 0,
      reviewNeedsReviewCount: 0,
      reviewFailCount: 0
    },
    items: [
      {
        sampleId: '1',
        title: 'sample 1',
        status: 'succeeded',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        attempts: 1,
        record: {} as any
      }
    ]
  };

  const summary = jobToSummary(job);
  assert.strictEqual(summary.isComplete, false);
  assert.strictEqual(summary.completedCount, 1);
  assert.strictEqual(summary.pendingCount, 2);
  assert.strictEqual(summary.processedCount, 1);
  assert.strictEqual(summary.total, 3);
  assert.strictEqual(summary.items.length, 1);
});

test('jobToSummary handles canceled job', () => {
  const job: VisualBatchJob = {
    jobId: 'job-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'canceled',
    modelName: 'gemini-3.5-flash',
    jsonMode: 'prompt_only',
    customInstructionPreview: '',
    targetSampleIds: ['1', '2', '3'],
        completedSampleIds: ['1'],
    failedSampleIds: [],
    pendingSampleIds: ['2', '3'],
    counters: {
      total: 3,
      successCount: 1,
      failureCount: 0,
      validCount: 1,
      validLowQualityCount: 0,
      invalidJsonCount: 0,
      expectedComparisonPassCount: 0,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 0,
      reviewPassCount: 0,
      reviewNeedsReviewCount: 0,
      reviewFailCount: 0
    },
    items: [
      {
        sampleId: '1',
        title: 'sample 1',
        status: 'succeeded',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        attempts: 1,
        record: {} as any
      }
    ]
  };

  const summary = jobToSummary(job);
  assert.strictEqual(summary.isComplete, true);
  assert.strictEqual(summary.completedCount, 1);
  assert.strictEqual(summary.pendingCount, 2);
  assert.strictEqual(summary.processedCount, 1);
  assert.strictEqual(summary.total, 3);
  assert.strictEqual(summary.items.length, 1);
});
