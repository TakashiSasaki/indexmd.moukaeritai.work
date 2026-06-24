import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert';
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
});
