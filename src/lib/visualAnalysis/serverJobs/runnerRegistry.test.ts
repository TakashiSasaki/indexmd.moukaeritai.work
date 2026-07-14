import test from 'node:test';
import assert from 'node:assert/strict';
import { RunnerRegistry, RunnerCompletionResult } from './runnerRegistry';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('active wait returns completion promise', async () => {
  const registry = new RunnerRegistry();
  const d = deferred<RunnerCompletionResult>();
  registry.set('job1', { startedAt: 'now', completionPromise: d.promise });

  const waitPromise = registry.waitForJob('job1');
  d.resolve({ jobId: 'job1', finalStatus: 'completed' });
  const result = await waitPromise;
  assert.strictEqual(result.finalStatus, 'completed');
});

test('already-settled wait returns settled completion', async () => {
  const registry = new RunnerRegistry();
  const d = deferred<RunnerCompletionResult>();
  registry.set('job2', { startedAt: 'now', completionPromise: d.promise });

  d.resolve({ jobId: 'job2', finalStatus: 'failed' });
  await d.promise; // Ensure it resolves
  // yield loop
  await new Promise(r => setTimeout(r, 0));

  registry.delete('job2'); // Removing active runner

  const waitPromise = registry.waitForJob('job2');
  const result = await waitPromise;
  assert.strictEqual(result.finalStatus, 'failed');
});

test('unknown job returns explicit error', async () => {
  const registry = new RunnerRegistry();
  await assert.rejects(registry.waitForJob('job3'), /Unknown job: job3/);
});

test('duplicate completion does not duplicate FIFO order', async () => {
  const registry = new RunnerRegistry();
  const d1 = deferred<RunnerCompletionResult>();
  registry.set('job4', { startedAt: 'now', completionPromise: d1.promise });
  d1.resolve({ jobId: 'job4', finalStatus: 'completed' });

  await new Promise(r => setTimeout(r, 0));

  // Simulate setting it again
  const d2 = deferred<RunnerCompletionResult>();
  registry.set('job4', { startedAt: 'now', completionPromise: d2.promise });
  d2.resolve({ jobId: 'job4', finalStatus: 'completed2' });

  await new Promise(r => setTimeout(r, 0));

  const settledResultsQueue = (registry as any).settledKeysQueue;
  assert.strictEqual(settledResultsQueue.filter((k: string) => k === 'job4').length, 1);

  const result = await registry.waitForJob('job4');
  assert.strictEqual(result.finalStatus, 'completed2');
});

test('FIFO eviction happens at 129 entries', async () => {
  const registry = new RunnerRegistry();

  for (let i = 1; i <= 129; i++) {
    const d = deferred<RunnerCompletionResult>();
    registry.set(`job${i}`, { startedAt: 'now', completionPromise: d.promise });
    d.resolve({ jobId: `job${i}`, finalStatus: 'completed' });
    await d.promise; // wait for each one to settle in registry before creating the next to guarantee strictly ordered FIFO execution
    await new Promise(r => setTimeout(r, 0));
    registry.delete(`job${i}`); // It is removed from activeRunners once completed
  }

  // wait for settled promises to finish being added to internal queue
  await new Promise(r => setTimeout(r, 100));

  // job1 should be evicted
  await assert.rejects(registry.waitForJob('job1'), /Unknown job: job1/);

  // job2 should still exist
  const res = await registry.waitForJob('job2');
  assert.strictEqual(res.jobId, 'job2');
});