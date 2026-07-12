import { test, describe } from 'node:test';
import assert from 'node:assert';
import { InMemoryJobStore } from '../../../src/lib/visualAnalysis/serverJobs/InMemoryJobStore';
import { VisualBatchJob, VisualBatchJobItem } from '../../../src/lib/visualAnalysis/publicSamples/batchTypes';

class FixedClock {
  private timestamp: number;
  constructor(initial: number) {
    this.timestamp = initial;
  }
  now() {
    return new Date(this.timestamp);
  }
  advance(ms: number) {
    this.timestamp += ms;
  }
}

describe('InMemoryJobStore', () => {
  const defaultJob: VisualBatchJob = {
    jobId: 'job-1',
    status: 'queued',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    modelName: 'gemini-test',
    jsonMode: 'native_schema',
    targetSampleIds: [],
    completedSampleIds: [],
    failedSampleIds: [],
    pendingSampleIds: [],
    items: [],
    counters: { total: 0, successCount: 0, failureCount: 0, validCount: 0, validLowQualityCount: 0, invalidJsonCount: 0, expectedComparisonPassCount: 0, expectedComparisonWarningCount: 0, expectedComparisonFailCount: 0, reviewPassCount: 0, reviewNeedsReviewCount: 0, reviewFailCount: 0 },
    revision: 1
  };

  test('initial jobs are preserved', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store = new InMemoryJobStore(clock, [defaultJob]);
    assert.deepStrictEqual(store.getJob('job-1'), defaultJob);
  });

  test('create and get', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store = new InMemoryJobStore(clock);
    store.createJob(defaultJob);
    assert.deepStrictEqual(store.getJob('job-1'), defaultJob);
  });

  test('defensive copy on read', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store = new InMemoryJobStore(clock, [defaultJob]);
    const fetched = store.getJob('job-1');
    assert.ok(fetched);
    fetched.status = 'completed';

    const secondFetch = store.getJob('job-1');
    assert.strictEqual(secondFetch?.status, 'queued');
  });

  test('defensive copy on initial input', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const input = { ...defaultJob };
    const store = new InMemoryJobStore(clock, [input]);
    input.status = 'completed';

    assert.strictEqual(store.getJob('job-1')?.status, 'queued');
  });

  test('list ordering', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store = new InMemoryJobStore(clock, [
      { ...defaultJob, jobId: 'job-1', createdAt: '2025-01-01T00:00:00.000Z' },
      { ...defaultJob, jobId: 'job-2', createdAt: '2025-01-02T00:00:00.000Z' },
      { ...defaultJob, jobId: 'job-3', createdAt: '2024-12-31T00:00:00.000Z' }
    ]);

    const list = store.listJobs();
    assert.strictEqual(list.length, 3);
    assert.strictEqual(list[0].jobId, 'job-2');
    assert.strictEqual(list[1].jobId, 'job-1');
    assert.strictEqual(list[2].jobId, 'job-3');
  });

  test('update timestamp and revision increment', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store = new InMemoryJobStore(clock, [defaultJob]);

    clock.advance(1000); // 1 second later
    store.updateJob('job-1', { status: 'running' });

    const updated = store.getJob('job-1');
    assert.ok(updated);
    assert.strictEqual(updated.status, 'running');
    assert.strictEqual(updated.updatedAt, '2025-01-01T00:00:01.000Z');
    assert.strictEqual(updated.revision, 2);
  });

  test('insert item', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store = new InMemoryJobStore(clock, [defaultJob]);

    const item: VisualBatchJobItem = {
      sampleId: 'sample-1',
      status: 'pending'
    };

    clock.advance(1000);
    store.appendItem('job-1', item);

    const job = store.getJob('job-1');
    assert.ok(job);
    assert.strictEqual(job.items.length, 1);
    assert.strictEqual(job.items[0].sampleId, 'sample-1');
    assert.strictEqual(job.updatedAt, '2025-01-01T00:00:01.000Z');
    assert.strictEqual(job.revision, 2);
  });

  test('replace item by sample ID', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store = new InMemoryJobStore(clock, [
      {
        ...defaultJob,
        items: [{ sampleId: 'sample-1', status: 'pending' }]
      }
    ]);

    const updatedItem: VisualBatchJobItem = {
      sampleId: 'sample-1',
      status: 'succeeded',
      record: { run: {} } as any
    };

    clock.advance(1000);
    store.appendItem('job-1', updatedItem);

    const job = store.getJob('job-1');
    assert.ok(job);
    assert.strictEqual(job.items.length, 1);
    assert.strictEqual(job.items[0].status, 'succeeded');
  });

  test('cancel queued job', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store = new InMemoryJobStore(clock, [defaultJob]);

    clock.advance(1000);
    store.cancelJob('job-1');

    const job = store.getJob('job-1');
    assert.ok(job);
    assert.strictEqual(job.status, 'canceled');
    assert.strictEqual(job.canceledAt, '2025-01-01T00:00:01.000Z');
    assert.strictEqual(job.updatedAt, '2025-01-01T00:00:01.000Z');
    assert.strictEqual(job.revision, 2);
  });

  test('cancel running job', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store = new InMemoryJobStore(clock, [{ ...defaultJob, status: 'running' }]);

    clock.advance(1000);
    store.cancelJob('job-1');

    const job = store.getJob('job-1');
    assert.ok(job);
    assert.strictEqual(job.status, 'canceled');
  });

  test('no-op cancellation for terminal jobs', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const terminalStatuses: ('completed' | 'failed' | 'canceled')[] = ['completed', 'failed', 'canceled'];

    for (const status of terminalStatuses) {
      const store = new InMemoryJobStore(clock, [{ ...defaultJob, status }]);
      clock.advance(1000);
      store.cancelJob('job-1');

      const job = store.getJob('job-1');
      assert.ok(job);
      assert.strictEqual(job.status, status);
      assert.strictEqual(job.updatedAt, '2025-01-01T00:00:00.000Z'); // No update
      assert.strictEqual(job.revision, 1); // No revision increment
    }
  });

  test('clear', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store = new InMemoryJobStore(clock, [defaultJob]);
    store.clear();
    assert.strictEqual(store.getJob('job-1'), undefined);
    assert.strictEqual(store.listJobs().length, 0);
  });

  test('complete isolation between two instances', () => {
    const clock = new FixedClock(Date.parse('2025-01-01T00:00:00.000Z'));
    const store1 = new InMemoryJobStore(clock, [defaultJob]);
    const store2 = new InMemoryJobStore(clock);

    assert.ok(store1.getJob('job-1'));
    assert.strictEqual(store2.getJob('job-1'), undefined);

    store2.createJob({ ...defaultJob, jobId: 'job-2' });

    assert.strictEqual(store1.getJob('job-2'), undefined);
    assert.ok(store2.getJob('job-2'));
  });
});
