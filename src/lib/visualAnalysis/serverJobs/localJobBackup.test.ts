import test from 'node:test';
import assert from 'node:assert';
import {
  buildLocalJobBackupMetadata,
  sanitizeBundle,
  saveLocalJobBackup,
  listLocalJobBackups,
  getLocalJobBackup,
  removeLocalJobBackup,
  setStorageAdapter,
  StorageAdapter
} from './localJobBackup';

class MockStorage implements StorageAdapter {
  store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) || null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
  key(index: number) { return Array.from(this.store.keys())[index] || null; }
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
}

test('localJobBackup tests', async (t) => {
  let storage: MockStorage;

  t.beforeEach(() => {
    storage = new MockStorage();
    setStorageAdapter(storage);
  });

  await t.test('buildLocalJobBackupMetadata handles full job counters', () => {
    const job = {
      jobId: 'job1',
      status: 'completed',
      modelName: 'test-model',
      counters: { successCount: 5, failureCount: 2, total: 10 },
      targetSampleIds: new Array(10)
    };
    const meta = buildLocalJobBackupMetadata(job);
    assert.strictEqual(meta.counters.success, 5);
    assert.strictEqual(meta.counters.failure, 2);
    assert.strictEqual(meta.counters.processed, 7);
    assert.strictEqual(meta.counters.total, 10);
    assert.strictEqual(meta.sourceRevision, 'job1_completed_7_');
  });

  await t.test('buildLocalJobBackupMetadata handles list summary fallback (canonical items)', () => {
    const job = {
      jobId: 'job2',
      status: 'failed',
      items: [
        { status: 'succeeded' },
        { status: 'failed' },
        { status: 'succeeded' }
      ],
      targetSampleIds: new Array(5)
    };
    const meta = buildLocalJobBackupMetadata(job);
    assert.strictEqual(meta.counters.success, 2);
    assert.strictEqual(meta.counters.failure, 1);
    assert.strictEqual(meta.counters.processed, 3);
    assert.strictEqual(meta.counters.total, 5);
  });

  await t.test('buildLocalJobBackupMetadata handles legacy items', () => {
    const job = {
      jobId: 'job3',
      status: 'running',
      items: [
        { status: 'success' },
        { status: 'error' },
        { status: 'failure' }
      ]
    };
    const meta = buildLocalJobBackupMetadata(job);
    assert.strictEqual(meta.counters.success, 1);
    assert.strictEqual(meta.counters.failure, 2);
    assert.strictEqual(meta.counters.processed, 3);
  });

  await t.test('sanitizeBundle strips sensitive keys and bearers', () => {
    const bundle = {
      normalKey: 'value',
      executionPrivate: { secret: 123 },
      authorization: 'Bearer token123',
      nested: {
        apiKey: 'secretKey',
        cookie: 'session=1'
      },
      array: [
        { headers: { authorization: 'Bearer token456' } },
        'Bearer leaked'
      ]
    };
    const safe = sanitizeBundle(bundle);
    assert.strictEqual(safe.normalKey, 'value');
    assert.strictEqual(safe.executionPrivate, undefined);
    assert.strictEqual(safe.authorization, undefined);
    assert.strictEqual(safe.nested.apiKey, undefined);
    assert.strictEqual(safe.nested.cookie, undefined);
    assert.strictEqual(safe.array[0].headers, undefined);
    assert.strictEqual(safe.array[1], '[REDACTED]');
  });

  await t.test('saveLocalJobBackup stores bundle if small', () => {
    const job = { jobId: 'test-small', status: 'completed' };
    const bundle = { data: 'hello' };
    const saved = saveLocalJobBackup(job, bundle);
    assert.strictEqual(saved, true);
    const backup = getLocalJobBackup('test-small');
    assert.strictEqual(backup?.bundleStored, true);
    assert.deepStrictEqual(backup?.bundle, bundle);
  });

  await t.test('saveLocalJobBackup evicts oldest when > MAX_BACKUPS', async (t2) => {
    for (let i = 0; i < 15; i++) {
      saveLocalJobBackup({ jobId: `job-${i}`, status: 'completed' });
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const backups = listLocalJobBackups();
    assert.strictEqual(backups.length, 10);
    const ids = backups.map(b => b.jobId);
    assert.ok(ids.includes('job-14'));
    assert.ok(!ids.includes('job-0'));
  });

  await t.test('malformed stored JSON does not throw', () => {
    storage.setItem('visual_analysis_server_job_backup_bad', '{ bad json');
    saveLocalJobBackup({ jobId: 'good' });
    const list = listLocalJobBackups();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].jobId, 'good');

    const get = getLocalJobBackup('bad');
    assert.strictEqual(get, null);
  });
});
