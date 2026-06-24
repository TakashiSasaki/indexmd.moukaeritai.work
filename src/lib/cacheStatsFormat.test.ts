import test, { describe } from 'node:test';
import assert from 'node:assert';
import { summarizeCacheStats, formatPercent } from './cacheStatsFormat';
import { CacheMetricsResponse } from './cacheMetrics';

describe('cacheStatsFormat', () => {
  test('summarizeCacheStats calculates totals correctly', () => {
    const mockStats: CacheMetricsResponse = {
      now: '2026-06-24T00:01:00.000Z',
      uptimeMs: 3600000,
      uptimeHuman: '1h',
      serverStartedAt: '2026-06-24T00:00:00.000Z',
      process: {
        pid: 123,
        nodeVersion: 'v20.0.0',
        platform: 'linux',
        memoryUsage: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }
      },
      caches: {
        cacheA: {
          hits: 10,
          misses: 5,
          writes: 5,
          bypasses: 0,
          errors: 1,
          hitRate: 10 / 15,
          lastHitAt: null,
          lastMissAt: null,
          lastWriteAt: null,
          entryCount: 2,
          totalBytes: 1024,
          oldestMtime: null,
          newestMtime: null
        },
        cacheB: {
          hits: 20,
          misses: 5,
          writes: 10,
          bypasses: 0,
          errors: 0,
          hitRate: 20 / 25,
          lastHitAt: null,
          lastMissAt: null,
          lastWriteAt: null,
          entryCount: 3,
          totalBytes: 2048,
          oldestMtime: null,
          newestMtime: null
        }
      }
    };

    const summary = summarizeCacheStats(mockStats);
    assert.strictEqual(summary.totalHits, 30);
    assert.strictEqual(summary.totalMisses, 10);
    assert.strictEqual(summary.totalEntries, 5);
    assert.strictEqual(summary.totalBytes, 3072);
    assert.strictEqual(summary.totalErrors, 1);
    assert.strictEqual(summary.overallHitRate, 30 / 40);
  });

  test('summarizeCacheStats handles zero denominator for hit rate', () => {
    const mockStats: CacheMetricsResponse = {
      now: '2026-06-24T00:01:00.000Z',
      uptimeMs: 3600000,
      uptimeHuman: '1h',
      serverStartedAt: '2026-06-24T00:00:00.000Z',
      process: {
        pid: 123,
        nodeVersion: 'v20.0.0',
        platform: 'linux',
        memoryUsage: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }
      },
      caches: {
        emptyCache: {
          hits: 0,
          misses: 0,
          writes: 0,
          bypasses: 0,
          errors: 0,
          hitRate: 0,
          lastHitAt: null,
          lastMissAt: null,
          lastWriteAt: null,
          entryCount: 0,
          totalBytes: 0,
          oldestMtime: null,
          newestMtime: null
        }
      }
    };
    const summary = summarizeCacheStats(mockStats);
    assert.strictEqual(summary.overallHitRate, 0);
  });

  test('formatPercent works', () => {
    assert.strictEqual(formatPercent(0), '0.0%');
    assert.strictEqual(formatPercent(0.5123), '51.2%');
    assert.strictEqual(formatPercent(1), '100.0%');
  });
});
