import { CacheMetricsResponse } from './cacheMetrics';

export interface CacheSummary {
  totalHits: number;
  totalMisses: number;
  totalEntries: number;
  totalBytes: number;
  totalErrors: number;
  overallHitRate: number;
}

export function summarizeCacheStats(stats: CacheMetricsResponse): CacheSummary {
  let totalHits = 0;
  let totalMisses = 0;
  let totalEntries = 0;
  let totalBytes = 0;
  let totalErrors = 0;

  for (const key of Object.keys(stats.caches)) {
    const c = stats.caches[key];
    totalHits += c.hits;
    totalMisses += c.misses;
    totalEntries += c.entryCount;
    totalBytes += c.totalBytes;
    totalErrors += c.errors;
  }

  const overallHitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

  return {
    totalHits,
    totalMisses,
    totalEntries,
    totalBytes,
    totalErrors,
    overallHitRate,
  };
}

export function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%';
}
