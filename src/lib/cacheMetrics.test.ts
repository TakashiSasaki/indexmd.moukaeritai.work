import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { 
  initCacheMetrics, 
  resetCacheMetrics, 
  recordCacheHit, 
  recordCacheMiss, 
  recordCacheWrite, 
  recordCacheBypass, 
  recordCacheError, 
  getCacheMetricsResponse 
} from './cacheMetrics';

describe('cacheMetrics', () => {
  beforeEach(() => {
    resetCacheMetrics();
    initCacheMetrics(['testCache']);
  });

  test('initializes correctly', async () => {
    const response = await getCacheMetricsResponse({ testCache: './non-existent-dir-for-test' });
    const cache = response.caches['testCache'];
    assert.ok(cache !== undefined);
    assert.strictEqual(cache.hits, 0);
    assert.strictEqual(cache.misses, 0);
    assert.strictEqual(cache.writes, 0);
    assert.strictEqual(cache.bypasses, 0);
    assert.strictEqual(cache.errors, 0);
    assert.strictEqual(cache.hitRate, 0);
    assert.strictEqual(cache.entryCount, 0);
    assert.strictEqual(cache.totalBytes, 0);
  });

  test('records hits and calculates hit rate', async () => {
    recordCacheHit('testCache');
    recordCacheHit('testCache');
    recordCacheMiss('testCache');
    
    const response = await getCacheMetricsResponse({ testCache: './non-existent-dir-for-test' });
    const cache = response.caches['testCache'];
    
    assert.strictEqual(cache.hits, 2);
    assert.strictEqual(cache.misses, 1);
    assert.strictEqual(cache.hitRate, 2/3);
    assert.ok(cache.lastHitAt !== null);
    assert.ok(cache.lastMissAt !== null);
  });

  test('records writes, bypasses, errors', async () => {
    recordCacheWrite('testCache');
    recordCacheBypass('testCache');
    recordCacheError('testCache');
    recordCacheError('testCache');
    
    const response = await getCacheMetricsResponse({ testCache: './non-existent-dir-for-test' });
    const cache = response.caches['testCache'];
    
    assert.strictEqual(cache.writes, 1);
    assert.strictEqual(cache.bypasses, 1);
    assert.strictEqual(cache.errors, 2);
    assert.ok(cache.lastWriteAt !== null);
  });

  test('resets metrics correctly', async () => {
    recordCacheHit('testCache');
    recordCacheWrite('testCache');
    
    resetCacheMetrics();
    
    const response = await getCacheMetricsResponse({ testCache: './non-existent-dir-for-test' });
    const cache = response.caches['testCache'];
    
    assert.strictEqual(cache.hits, 0);
    assert.strictEqual(cache.writes, 0);
    assert.strictEqual(cache.lastHitAt, null);
  });

  test('uptime formatting and process info', async () => {
    const response = await getCacheMetricsResponse({});
    assert.ok(response.uptimeHuman !== undefined);
    assert.ok(response.process.pid !== undefined);
    assert.ok(response.process.nodeVersion !== undefined);
  });

  test('inventory helper handles non-existing directories safely', async () => {
    const response = await getCacheMetricsResponse({ testCache: './non-existent-dir-for-test-123' });
    const cache = response.caches['testCache'];
    assert.strictEqual(cache.entryCount, 0);
    assert.strictEqual(cache.totalBytes, 0);
  });

  test('inventory helper handles empty directories', async () => {
    const tmpDir = './tmp-empty-cache';
    try {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
      const response = await getCacheMetricsResponse({ testCache: tmpDir });
      assert.strictEqual(response.caches['testCache'].entryCount, 0);
    } finally {
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
    }
  });

  test('inventory helper does not expose file contents', async () => {
    const tmpDir = './tmp-cache-content';
    try {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
      fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'secret cache data');
      const response = await getCacheMetricsResponse({ testCache: tmpDir });
      const cache = response.caches['testCache'];
      assert.strictEqual(cache.entryCount, 1);
      assert.ok(cache.totalBytes > 0);
      // Ensure no raw content in the response
      assert.strictEqual(JSON.stringify(response).includes('secret cache data'), false);
    } finally {
      if (fs.existsSync(tmpDir)) {
        fs.unlinkSync(path.join(tmpDir, 'test.txt'));
        fs.rmdirSync(tmpDir);
      }
    }
  });
});
