import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { jobStore } from './jobStore';
import { classifyJobQuotaInterruption, startVisualBatchJob } from './jobRunner';
import { VisualBatchJob } from '../publicSamples/batchTypes';

function makeJob(jobId: string, sampleIds = ['sample-transient']): VisualBatchJob {
  return {
    jobId,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    modelName: 'gemini-test',
    jsonMode: 'prompt_only',
    targetSampleIds: sampleIds,
    completedSampleIds: [],
    pendingSampleIds: [...sampleIds],
    failedSampleIds: [],
    counters: {
      total: sampleIds.length,
      successCount: 0,
      failureCount: 0,
      validCount: 0,
      validLowQualityCount: 0,
      invalidJsonCount: 0,
      expectedComparisonPassCount: 0,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 0,
      reviewPassCount: 0,
      reviewNeedsReviewCount: 0,
      reviewFailCount: 0,
    },
    items: [],
  };
}

test('classifyJobQuotaInterruption treats explicit daily quota as blocked quota', () => {
  const result = classifyJobQuotaInterruption({
    success: false,
    failureKind: 'providerQuotaExceeded',
    generationDiagnostics: {
      statusCode: 429,
      providerStatus: 'RESOURCE_EXHAUSTED',
      quotaClassification: 'dailyQuotaExhausted',
    },
  }, 429);

  assert.strictEqual(result.isQuotaOrRateLimit, true);
  assert.strictEqual(result.action, 'blockedByQuota');
});

test('classifyJobQuotaInterruption treats short RetryInfo throttles as rate-limit pauses', () => {
  const result = classifyJobQuotaInterruption({
    success: false,
    failureKind: 'providerRateLimited',
    generationDiagnostics: {
      statusCode: 429,
      providerStatus: 'RESOURCE_EXHAUSTED',
      retryAfterMs: 1_000,
      retryAfterReason: 'google.rpc.RetryInfo',
    },
  }, 429);

  assert.strictEqual(result.isQuotaOrRateLimit, true);
  assert.strictEqual(result.action, 'pausedForRateLimit');
});

test('startVisualBatchJob persists transient throttle pause state without daily quota block', async () => {
  const jobId = `job-runner-transient-${Date.now()}`;
  const jobPath = path.join(process.cwd(), 'cache', 'visual-batch-jobs', `${jobId}.json`);
  jobStore.createJob(makeJob(jobId));

  let calls = 0;
  await startVisualBatchJob(jobId, {
    getSampleMetadata: async (sampleId: string) => ({ id: sampleId, title: 'Transient throttle sample' }),
    analyzeFn: async () => {
      calls += 1;
      return {
        status: 429,
        body: {
          success: false,
          error: 'per-minute throttle',
          failureKind: 'providerRateLimited',
          generationDiagnostics: {
            statusCode: 429,
            providerStatus: 'RESOURCE_EXHAUSTED',
            quotaClassification: 'transientThrottle',
            retryAfterMs: 1,
            retryAfterReason: 'google.rpc.RetryInfo',
          },
        },
      };
    },
  });

  const persisted = JSON.parse(fs.readFileSync(jobPath, 'utf-8')) as VisualBatchJob;
  assert.strictEqual(calls, 2);
  assert.strictEqual(persisted.status, 'paused');
  assert.strictEqual(persisted.pauseReason, 'pausedForRateLimit');
  assert.strictEqual(persisted.blockedReason, undefined);
  assert.deepStrictEqual(persisted.affectedSampleIds, ['sample-transient']);
  assert.deepStrictEqual(persisted.attemptState, { attempt: 2, maxAttempts: 2, retryExhausted: true });
  assert.ok(persisted.resumeAfter);
  assert.strictEqual(persisted.items[0]?.pauseReason, 'pausedForRateLimit');
  assert.strictEqual(persisted.items[0]?.blockedReason, undefined);
  assert.deepStrictEqual(persisted.items[0]?.affectedSampleIds, ['sample-transient']);
  assert.deepStrictEqual(persisted.items[0]?.attemptState, { attempt: 2, maxAttempts: 2, retryExhausted: true });

  fs.rmSync(jobPath, { force: true });
});
