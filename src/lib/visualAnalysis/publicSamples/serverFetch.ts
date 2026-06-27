import { getPublicSampleById } from './registry';
import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_HOSTS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org"
];

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;

export interface FetchSampleResult {
  buffer: Buffer;
  mimeType: string;
}

const inMemoryCache = new Map<string, FetchSampleResult>();
const CACHE_DIR = path.join('/tmp', 'indexmd_sample_cache');

// Ensure cache directory exists
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[serverFetch] Failed to create cache directory:', e);
}

function getCacheKey(sampleId: string, variant: string): string {
  return `${sampleId}_${variant}`;
}

function readFromDiskCache(sampleId: string, variant: string): FetchSampleResult | null {
  const cacheKey = getCacheKey(sampleId, variant);
  const binPath = path.join(CACHE_DIR, `${cacheKey}.bin`);
  const mimePath = path.join(CACHE_DIR, `${cacheKey}.mime`);

  if (fs.existsSync(binPath) && fs.existsSync(mimePath)) {
    try {
      const buffer = fs.readFileSync(binPath);
      const mimeType = fs.readFileSync(mimePath, 'utf8').trim();
      return { buffer, mimeType };
    } catch (e) {
      console.warn(`[serverFetch] Failed to read disk cache for ${cacheKey}:`, e);
    }
  }
  return null;
}

function writeToDiskCache(sampleId: string, variant: string, result: FetchSampleResult): void {
  const cacheKey = getCacheKey(sampleId, variant);
  const binPath = path.join(CACHE_DIR, `${cacheKey}.bin`);
  const mimePath = path.join(CACHE_DIR, `${cacheKey}.mime`);

  try {
    fs.writeFileSync(binPath, result.buffer);
    fs.writeFileSync(mimePath, result.mimeType, 'utf8');
  } catch (e) {
    console.warn(`[serverFetch] Failed to write disk cache for ${cacheKey}:`, e);
  }
}

export async function fetchPublicSampleImage(sampleId: string, variant: "preview" | "thumbnail" | "full"): Promise<FetchSampleResult> {
  const cacheKey = getCacheKey(sampleId, variant);

  // 1. Try In-Memory Cache
  if (inMemoryCache.has(cacheKey)) {
    return inMemoryCache.get(cacheKey)!;
  }

  // 2. Try Disk Cache
  const diskCached = readFromDiskCache(sampleId, variant);
  if (diskCached) {
    inMemoryCache.set(cacheKey, diskCached);
    return diskCached;
  }

  const sample = getPublicSampleById(sampleId);
  if (!sample) {
    throw new Error(`Sample not found: ${sampleId}`);
  }

  const urlToFetch = variant === "thumbnail" ? (sample.source.thumbnailUrl || sample.source.imageUrl) : sample.source.imageUrl;
  if (!urlToFetch) {
    throw new Error(`No image URL available for variant: ${variant}`);
  }

  // Handle local synthetic fixtures
  if (urlToFetch.startsWith('/visual-samples/')) {
    // Read from public directory
    const publicPath = path.join(process.cwd(), 'public', urlToFetch);
    const resolvedPath = path.resolve(publicPath);
    const publicDir = path.resolve(path.join(process.cwd(), 'public', 'visual-samples'));

    // Prevent directory traversal
    if (!resolvedPath.startsWith(publicDir)) {
       throw new Error('Access denied to local file');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error('Local fixture not found');
    }
    const buffer = fs.readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    let mimeType = 'image/svg+xml';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';

    const result = { buffer, mimeType };
    inMemoryCache.set(cacheKey, result);
    return result;
  }

  const result = await fetchExternalImage(urlToFetch, 0);

  // 3. Populate Caches
  inMemoryCache.set(cacheKey, result);
  writeToDiskCache(sampleId, variant, result);

  return result;
}

async function fetchExternalImage(url: string, redirectCount: number): Promise<FetchSampleResult> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error('Too many redirects');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    throw new Error('Invalid URL');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS is allowed');
  }

  if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
    throw new Error(`Host not allowed: ${parsedUrl.hostname}`);
  }

  let retries = 3;
  let delayMs = 1500;
  let lastStatus = 0;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'indexmd-image-experiment/1.2 (takashi316@gmail.com; https://github.com/takashi316/indexmd)',
          'Accept': 'image/*'
        },
        redirect: 'manual', // handle redirect manually to check host
        signal: controller.signal as any
      });

      lastStatus = res.status;

      if (res.status === 429) {
        console.warn(`[serverFetch] Wikimedia rate-limit (429) for ${url}. Retrying in ${delayMs}ms... (Attempt ${i + 1}/${retries})`);
        clearTimeout(timeout);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }

      if (res.status >= 300 && res.status < 400 && res.headers.has('location')) {
        clearTimeout(timeout);
        const location = res.headers.get('location');
        if (!location) throw new Error('Redirect with no location');

        const nextUrl = new URL(location, url).toString();
        return fetchExternalImage(nextUrl, redirectCount + 1);
      }

      if (!res.ok) {
        if (res.status === 404 || res.status === 403 || res.status === 401) {
          const err: any = new Error(`Fetch failed with status: ${res.status}`);
          err.noRetry = true;
          throw err;
        }
        throw new Error(`Fetch failed with status: ${res.status}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE_BYTES) {
        throw new Error('Image too large');
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
        throw new Error('Image too large after download');
      }

      return {
        buffer,
        mimeType: contentType
      };

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[serverFetch] Request timed out for ${url}.`);
      }
      if (i === retries - 1 || err.noRetry) {
        throw err;
      }
      console.warn(`[serverFetch] Network/Fetch error for ${url}. Retrying in ${delayMs}ms...`, err.message);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Fetch failed with status: ${lastStatus}`);
}
