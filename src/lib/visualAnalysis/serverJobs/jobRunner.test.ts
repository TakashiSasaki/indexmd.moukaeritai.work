import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { classifyJobQuotaInterruption, startVisualBatchJob, activeRunners } from './jobRunner';
import { jobToSummary } from './jobAdapters';
import { jobStore } from './jobStore';
import { VisualBatchJob } from '../publicSamples/batchTypes';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createJob(jobId: string): VisualBatchJob {
  const now = new Date().toISOString();
  return {
    jobId,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    modelName: 'gemini-test',
    jsonMode: 'prompt_only',
    customInstructionPreview: '',
    targetSampleIds: ['sample-A', 'sample-B', 'sample-C', 'sample-D'],
    completedSampleIds: [],
    failedSampleIds: [],
    pendingSampleIds: ['sample-A', 'sample-B', 'sample-C', 'sample-D'],
    counters: {
      total: 4,
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

function cleanupJob(jobId: string) {
  activeRunners.delete(jobId);
  const filePath = path.join(process.cwd(), 'cache', 'visual-batch-jobs', `${jobId}.json`);
  fs.rmSync(filePath, { force: true });
}

function createSingleSampleJob(jobId: string, sampleIds = ['sample-transient']): VisualBatchJob {
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

  assert.equal(result.isQuotaOrRateLimit, true);
  assert.equal(result.action, 'blockedByQuota');
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

  assert.equal(result.isQuotaOrRateLimit, true);
  assert.equal(result.action, 'pausedForRateLimit');
});

test('classifyJobQuotaInterruption treats capped RetryInfo as quota block', () => {
  const result = classifyJobQuotaInterruption({
    success: false,
    failureKind: 'providerRateLimited',
    generationDiagnostics: {
      statusCode: 429,
      providerStatus: 'RESOURCE_EXHAUSTED',
      retryAfterMs: 300_000,
      retryAfterReason: 'google.rpc.RetryInfo (capped)',
    },
  }, 429);

  assert.equal(result.isQuotaOrRateLimit, true);
  assert.equal(result.action, 'blockedByQuota');
});

test('startVisualBatchJob blocks dispatch after daily quota while preserving in-flight success and pending samples', async () => {
  const jobId = `job-runner-quota-${Date.now()}`;
  cleanupJob(jobId);
  jobStore.createJob(createJob(jobId));

  const calls: string[] = [];
  const responses = new Map<string, ReturnType<typeof deferred<{ status: number; body: any }>>>();
  const analyzeFn = (options: { sampleId: string }) => {
    calls.push(options.sampleId);
    const gate = deferred<{ status: number; body: any }>();
    responses.set(options.sampleId, gate);
    return gate.promise;
  };

  const runner = startVisualBatchJob(jobId, {
    analyzeFn,
    getSampleMetadata: async (sampleId) => ({ id: sampleId, title: sampleId }),
  });

  while (calls.length < 2) await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['sample-A', 'sample-B']);

  responses.get('sample-B')!.resolve({
    status: 429,
    body: {
      success: false,
      error: 'Daily provider quota exhausted',
      failureKind: 'providerRateLimited',
      generationDiagnostics: {
        providerStatus: 'RESOURCE_EXHAUSTED',
        providerFailureKind: 'providerRateLimited',
        quotaExceeded: true,
        quotaScope: 'daily',
        retryable: false,
      },
    },
  });

  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['sample-A', 'sample-B']);

  responses.get('sample-A')!.resolve({
    status: 200,
    body: {
      success: true,
      record: {
        evaluation: { qualityStatus: 'valid' },
      },
    },
  });

  await runner;

  const blockedJob = jobStore.getJob(jobId)! as VisualBatchJob & { blockedSampleIds?: string[] };
  assert.equal(blockedJob.status, 'blockedByQuota');
  assert.deepEqual(calls, ['sample-A', 'sample-B']);
  assert.ok(blockedJob.completedSampleIds.includes('sample-A'));
  assert.equal(blockedJob.items.find(item => item.sampleId === 'sample-A')?.status, 'succeeded');
  assert.equal(blockedJob.items.find(item => item.sampleId === 'sample-B')?.failureKind, 'providerRateLimited');
  assert.deepEqual(blockedJob.pendingSampleIds.sort(), ['sample-C', 'sample-D']);
  assert.deepEqual(blockedJob.blockedSampleIds?.sort(), ['sample-C', 'sample-D']);

  const secondRunner = startVisualBatchJob(jobId, {
    analyzeFn,
    getSampleMetadata: async (sampleId) => ({ id: sampleId, title: sampleId }),
  });

  while (calls.length < 4) await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['sample-A', 'sample-B', 'sample-C', 'sample-D']);
  assert.equal(calls.filter(sampleId => sampleId === 'sample-A').length, 1);

  responses.get('sample-C')!.resolve({
    status: 429,
    body: {
      success: false,
      error: 'Daily provider quota exhausted',
      failureKind: 'providerRateLimited',
      generationDiagnostics: {
        providerStatus: 'RESOURCE_EXHAUSTED',
        providerFailureKind: 'providerRateLimited',
        quotaExceeded: true,
        quotaScope: 'daily',
        retryable: false,
      },
    },
  });
  responses.get('sample-D')!.resolve({
    status: 429,
    body: {
      success: false,
      error: 'Daily provider quota exhausted',
      failureKind: 'providerRateLimited',
      generationDiagnostics: {
        providerStatus: 'RESOURCE_EXHAUSTED',
        providerFailureKind: 'providerRateLimited',
        quotaExceeded: true,
        quotaScope: 'daily',
        retryable: false,
      },
    },
  });

  await secondRunner;

  cleanupJob(jobId);
});

test('startVisualBatchJob persists transient throttle pause metadata without quota block state', async () => {
  const jobId = `job-runner-transient-${Date.now()}`;
  cleanupJob(jobId);
  jobStore.createJob(createSingleSampleJob(jobId));

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
            retryAfterMs: 1_000,
            retryAfterReason: 'google.rpc.RetryInfo',
          },
        },
      };
    },
  });

  const persisted = jobStore.getJob(jobId)!;
  assert.equal(calls, 1);
  assert.equal(persisted.status, 'paused');
  assert.equal(persisted.pauseReason, 'pausedForRateLimit');
  assert.equal(persisted.blockedReason, undefined);
  assert.deepEqual(persisted.affectedSampleIds, ['sample-transient']);
  assert.deepEqual(persisted.attemptState, { attempt: 1, maxAttempts: 2, retryExhausted: true });
  assert.ok(persisted.resumeAfter);
  assert.equal(persisted.items[0]?.status, 'failed');
  assert.equal(persisted.items[0]?.failureKind, 'providerRateLimited');
  assert.equal(persisted.items[0]?.error, 'per-minute throttle');
  assert.equal(persisted.items[0]?.pauseReason, 'pausedForRateLimit');
  assert.equal(persisted.items[0]?.blockedReason, undefined);
  assert.deepEqual(persisted.items[0]?.affectedSampleIds, ['sample-transient']);
  assert.deepEqual(persisted.items[0]?.attemptState, { attempt: 1, maxAttempts: 2, retryExhausted: true });

  const summary = jobToSummary(persisted);
  assert.equal(summary.items[0]?.failureKind, 'providerRateLimited');
  assert.equal(summary.items[0]?.error, 'per-minute throttle');
  assert.equal(summary.items[0]?.pauseReason, 'pausedForRateLimit');
  assert.deepEqual(summary.items[0]?.attemptState, { attempt: 1, maxAttempts: 2, retryExhausted: true });

  cleanupJob(jobId);
});
