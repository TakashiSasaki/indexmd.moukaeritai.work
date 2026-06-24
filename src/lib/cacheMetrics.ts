import fsPromises from 'fs/promises';
import path from 'path';

export interface CacheTypeMetrics {
  hits: number;
  misses: number;
  writes: number;
  bypasses: number;
  errors: number;
  lastHitAt: string | null;
  lastMissAt: string | null;
  lastWriteAt: string | null;
}

export interface CacheInventory {
  entryCount: number;
  totalBytes: number;
  oldestMtime: string | null;
  newestMtime: string | null;
}

export interface CacheMetricsResponse {
  serverStartedAt: string;
  now: string;
  uptimeMs: number;
  uptimeHuman: string;
  process: {
    pid: number;
    nodeVersion: string;
    platform: string;
    memoryUsage: NodeJS.MemoryUsage;
  };
  caches: Record<string, CacheTypeMetrics & CacheInventory & { hitRate: number }>;
}

const serverStartedAt = new Date();

let metrics: Record<string, CacheTypeMetrics> = {};

const defaultMetrics = (): CacheTypeMetrics => ({
  hits: 0,
  misses: 0,
  writes: 0,
  bypasses: 0,
  errors: 0,
  lastHitAt: null,
  lastMissAt: null,
  lastWriteAt: null,
});

export function initCacheMetrics(types: string[]) {
  types.forEach(type => {
    if (!metrics[type]) metrics[type] = defaultMetrics();
  });
}

export function resetCacheMetrics() {
  for (const type of Object.keys(metrics)) {
    metrics[type] = defaultMetrics();
  }
}

export function recordCacheHit(type: string) {
  if (!metrics[type]) metrics[type] = defaultMetrics();
  metrics[type].hits++;
  metrics[type].lastHitAt = new Date().toISOString();
}

export function recordCacheMiss(type: string) {
  if (!metrics[type]) metrics[type] = defaultMetrics();
  metrics[type].misses++;
  metrics[type].lastMissAt = new Date().toISOString();
}

export function recordCacheWrite(type: string) {
  if (!metrics[type]) metrics[type] = defaultMetrics();
  metrics[type].writes++;
  metrics[type].lastWriteAt = new Date().toISOString();
}

export function recordCacheBypass(type: string) {
  if (!metrics[type]) metrics[type] = defaultMetrics();
  metrics[type].bypasses++;
}

export function recordCacheError(type: string) {
  if (!metrics[type]) metrics[type] = defaultMetrics();
  metrics[type].errors++;
}

function calculateHitRate(hits: number, misses: number): number {
  const total = hits + misses;
  if (total === 0) return 0;
  return hits / total;
}

export async function getCacheInventory(dirPath: string): Promise<CacheInventory> {
  const inventory: CacheInventory = {
    entryCount: 0,
    totalBytes: 0,
    oldestMtime: null,
    newestMtime: null,
  };

  try {
    const files = await fsPromises.readdir(dirPath);
    for (const file of files) {
      if (file === '.gitkeep') continue; // ignore .gitkeep
      
      const filePath = path.join(dirPath, file);
      try {
        const stats = await fsPromises.stat(filePath);
        if (stats.isFile()) {
          inventory.entryCount++;
          inventory.totalBytes += stats.size;
          
          const mtime = stats.mtime;
          if (!inventory.oldestMtime || mtime < new Date(inventory.oldestMtime)) {
            inventory.oldestMtime = mtime.toISOString();
          }
          if (!inventory.newestMtime || mtime > new Date(inventory.newestMtime)) {
            inventory.newestMtime = mtime.toISOString();
          }
        }
      } catch (err) {
        // ignore individual file stat errors
      }
    }
  } catch (err) {
    // Directory might not exist yet
  }

  return inventory;
}

function formatUptime(uptimeMs: number): string {
  const totalSeconds = Math.floor(uptimeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

export async function getCacheMetricsResponse(cacheDirs: Record<string, string>): Promise<CacheMetricsResponse> {
  const now = new Date();
  const uptimeMs = now.getTime() - serverStartedAt.getTime();
  
  const response: CacheMetricsResponse = {
    serverStartedAt: serverStartedAt.toISOString(),
    now: now.toISOString(),
    uptimeMs,
    uptimeHuman: formatUptime(uptimeMs),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
    },
    caches: {}
  };

  for (const [type, dirPath] of Object.entries(cacheDirs)) {
    if (!metrics[type]) metrics[type] = defaultMetrics();
    
    const inventory = await getCacheInventory(dirPath);
    const typeMetrics = metrics[type];
    
    response.caches[type] = {
      ...typeMetrics,
      ...inventory,
      hitRate: calculateHitRate(typeMetrics.hits, typeMetrics.misses)
    };
  }

  return response;
}
