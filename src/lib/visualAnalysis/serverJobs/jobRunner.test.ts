import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startVisualBatchJob, classifyJobQuotaInterruption } from './jobRunner';
import { RunnerRegistry } from './runnerRegistry';
import { jobStore } from './jobStore';
import { jobToSummary } from './jobAdapters';
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
    const filePath = path.join(process.cwd(), 'cache', 'visual-batch-jobs', `${jobId}.json`);
  fs.rmSync(filePath, { force: true });
}

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
    runnerRegistry: new RunnerRegistry(),
    analyzeFn,
    getSampleMetadata: async (sampleId) => ({ id: sampleId, title: sampleId }),
  });

  // Since execution is sequential, calls will first reach 1 with sample-A
  while (calls.length < 1) await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['sample-A']);

  // Resolve sample-A to allow sequential execution to proceed to sample-B
  responses.get('sample-A')!.resolve({
    status: 200,
    body: {
      success: true,
      record: {
        evaluation: { qualityStatus: 'valid' },
      },
    },
  });

  // Now execution proceeds to sample-B, so calls reaches 2
  while (calls.length < 2) await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['sample-A', 'sample-B']);

  // Resolve sample-B with a daily quota exhaustion block
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

  await runner;

  const blockedJob = jobStore.getJob(jobId)! as VisualBatchJob & { blockedSampleIds?: string[] };
  // Since sample-B returned daily quota block, the job is blockedByQuota and blockedReason is preserved
  assert.equal(blockedJob.status, 'blockedByQuota');
  assert.equal(blockedJob.blockedReason, 'blockedByQuota');
  assert.deepEqual(calls, ['sample-A', 'sample-B']);
  assert.ok(blockedJob.completedSampleIds.includes('sample-A'));
  assert.equal(blockedJob.items.find(item => item.sampleId === 'sample-A')?.status, 'succeeded');
  assert.equal(blockedJob.items.find(item => item.sampleId === 'sample-B')?.status, 'blockedByQuota');
  assert.deepEqual(blockedJob.pendingSampleIds.sort(), ['sample-B', 'sample-C', 'sample-D']);
  assert.deepEqual(blockedJob.blockedSampleIds?.sort(), ['sample-B']);

  // Resume processing with a second runner
  const secondRunner = startVisualBatchJob(jobId, {
    runnerRegistry: new RunnerRegistry(),
    analyzeFn,
    getSampleMetadata: async (sampleId) => ({ id: sampleId, title: sampleId }),
  });

  // Second runner will start processing sample-B again
  while (calls.length < 3) await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['sample-A', 'sample-B', 'sample-B']);

  // Resolve the retried sample-B successfully
  responses.get('sample-B')!.resolve({
    status: 200,
    body: {
      success: true,
      record: {
        evaluation: { qualityStatus: 'valid' },
      },
    },
  });

  // Sequential execution proceeds to sample-C
  while (calls.length < 4) await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['sample-A', 'sample-B', 'sample-B', 'sample-C']);

  // Block sample-C with daily quota block again
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

  await secondRunner;

  cleanupJob(jobId);
});

function makeJob(jobId: string, sampleIds = ['sample-transient']): VisualBatchJob {
  return {
    jobId,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    modelName: 'gemini-test',
    jsonMode: 'prompt_only',
    customInstructionPreview: '',
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

  assert.strictEqual(result.isQuotaOrRateLimit, true);
  assert.strictEqual(result.action, 'blockedByQuota');
});

test('startVisualBatchJob persists transient throttle pause state without daily quota block', async () => {
  const jobId = `job-runner-transient-${Date.now()}`;
  const jobPath = path.join(process.cwd(), 'cache', 'visual-batch-jobs', `${jobId}.json`);
  jobStore.createJob(makeJob(jobId));

  let calls = 0;
  await startVisualBatchJob(jobId, {
    runnerRegistry: new RunnerRegistry(),
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
  assert.strictEqual(persisted.status, 'pausedForRateLimit');
  assert.strictEqual(persisted.pauseReason, 'pausedForRateLimit');
  assert.strictEqual(persisted.blockedReason, undefined);
  assert.deepStrictEqual(persisted.affectedSampleIds, ['sample-transient']);
  assert.deepStrictEqual(persisted.attemptState, { attempt: 2, maxAttempts: 2, retryExhausted: true });
  assert.ok(persisted.resumeAfter);
  assert.strictEqual(persisted.items[0]?.status, 'pausedForRateLimit');
  assert.strictEqual(persisted.items[0]?.failureKind, 'providerRateLimited');
  assert.strictEqual(persisted.items[0]?.error, 'per-minute throttle');
  assert.strictEqual(persisted.items[0]?.pauseReason, 'pausedForRateLimit');
  assert.strictEqual(persisted.items[0]?.blockedReason, undefined);
  assert.deepStrictEqual(persisted.items[0]?.affectedSampleIds, ['sample-transient']);
  assert.deepStrictEqual(persisted.items[0]?.attemptState, { attempt: 2, maxAttempts: 2, retryExhausted: true });

  const summary = jobToSummary(persisted);
  assert.strictEqual(summary.items[0]?.failureKind, 'providerRateLimited');
  assert.strictEqual(summary.items[0]?.error, 'per-minute throttle');
  assert.strictEqual(summary.items[0]?.pauseReason, 'pausedForRateLimit');
  assert.deepStrictEqual(summary.items[0]?.attemptState, { attempt: 2, maxAttempts: 2, retryExhausted: true });

  fs.rmSync(jobPath, { force: true });
});

test('startVisualBatchJob transition running -> pausedForProviderUnavailable on HTTP 503', async () => {
  const jobId = `job-runner-unav-${Date.now()}`;
  const jobPath = path.join(process.cwd(), 'cache', 'visual-batch-jobs', `${jobId}.json`);
  jobStore.createJob(makeJob(jobId));

  let calls = 0;
  await startVisualBatchJob(jobId, {
    runnerRegistry: new RunnerRegistry(),
    getSampleMetadata: async (sampleId: string) => ({ id: sampleId, title: 'Unavailable sample' }),
    analyzeFn: async () => {
      calls += 1;
      return {
        status: 503,
        body: {
          success: false,
          error: 'service unavailable',
          failureKind: 'providerUnavailable',
          generationDiagnostics: {
            statusCode: 503,
            providerStatus: 'UNAVAILABLE',
            providerFailureKind: 'providerUnavailable'
          },
        },
      };
    },
  });

  const persisted = JSON.parse(fs.readFileSync(jobPath, 'utf-8')) as VisualBatchJob;
  assert.strictEqual(calls, 1);
  assert.strictEqual(persisted.status, 'pausedForProviderUnavailable');
  assert.strictEqual(persisted.pauseReason, 'pausedForProviderUnavailable');
  assert.deepStrictEqual(persisted.affectedSampleIds, ['sample-transient']);

  fs.rmSync(jobPath, { force: true });
});

