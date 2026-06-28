import { getPublicSampleById } from './registry';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

const ALLOWED_HOSTS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org"
];

const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
const proxyAgent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

if (proxyAgent) {
  console.log(`[serverFetch] Proxy detected and configured: ${PROXY_URL}`);
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;

export interface FetchSampleResult {
  buffer: Buffer;
  mimeType: string;
}

const inMemoryCache = new Map<string, FetchSampleResult>();
const CACHE_DIR = path.join(process.cwd(), 'cache', 'public_samples');

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

export async function fetchPublicSampleImage(sampleId: string, variant: "preview" | "thumbnail" | "full" | "analysis"): Promise<FetchSampleResult> {
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

  let urlToFetch = (variant === "thumbnail" || variant === "preview" || variant === "analysis") 
    ? (sample.source.thumbnailUrl || sample.source.imageUrl) 
    : sample.source.imageUrl;
  if (!urlToFetch) {
    throw new Error(`No image URL available for variant: ${variant}`);
  }

  // Rewrite Wikimedia 640px restricted thumbnails to standard sizes (120px for thumbnail, 500px for preview)
  if (urlToFetch.includes('upload.wikimedia.org') && urlToFetch.includes('/640px-')) {
    if (variant === "thumbnail") {
      urlToFetch = urlToFetch.replace('/640px-', '/120px-');
    } else if (variant === "preview") {
      urlToFetch = urlToFetch.replace('/640px-', '/500px-');
    } else if (variant === "analysis") {
      // Keep 640px as it is known to exist and provides good enough resolution for Gemini (approx 640x...)
      // Do nothing, keep original 640px thumbnail.
    }
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

  let result: FetchSampleResult;
  try {
    result = await fetchExternalImage(urlToFetch, 0);
  } catch (err: any) {
    if (variant !== "full" && urlToFetch !== sample.source.imageUrl && sample.source.imageUrl) {
      console.warn(`[serverFetch] Failed to fetch variant ${variant} from ${urlToFetch}. Falling back to original imageUrl: ${sample.source.imageUrl}`, err);
      result = await fetchExternalImage(sample.source.imageUrl, 0);
    } else {
      throw err;
    }
  }

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
    try {
      const result = await new Promise<FetchSampleResult>((resolve, reject) => {
        const options: https.RequestOptions = {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || undefined,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': 'IndexMDImageExperiment/1.2 (takashi316@gmail.com)',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Host': parsedUrl.hostname
          },
          timeout: FETCH_TIMEOUT_MS,
          ...(proxyAgent ? { agent: proxyAgent } : {})
        };

        const req = https.get(options, (res) => {
          lastStatus = res.statusCode || 0;

          // Handle Redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume(); // Consume response data to free up socket
            const location = res.headers.location;
            const nextUrl = new URL(location, url).toString();
            resolve(fetchExternalImage(nextUrl, redirectCount + 1));
            return;
          }

          // Handle 429 Rate Limit
          if (res.statusCode === 429) {
            res.resume();
            const err: any = new Error('Rate limit');
            err.status = 429;
            reject(err);
            return;
          }

          // Handle other errors
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
              console.warn(`[serverFetch] Request to ${url} failed with status: ${res.statusCode}. Headers:`, JSON.stringify(res.headers), `Body:`, body);
              const err: any = new Error(`Fetch failed with status: ${res.statusCode}`);
              if (res.statusCode && res.statusCode >= 400 && res.statusCode < 500 && res.statusCode !== 429) {
                err.noRetry = true;
              }
              reject(err);
            });
            return;
          }

          const contentType = res.headers['content-type'];
          if (!contentType || !contentType.startsWith('image/')) {
            res.resume();
            const err: any = new Error(`Invalid content type: ${contentType}`);
            err.noRetry = true;
            reject(err);
            return;
          }

          const contentLength = res.headers['content-length'];
          if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE_BYTES) {
            res.resume();
            const err: any = new Error('Image too large');
            err.noRetry = true;
            reject(err);
            return;
          }

          const chunks: Buffer[] = [];
          let downloadedBytes = 0;

          res.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            if (downloadedBytes > MAX_IMAGE_SIZE_BYTES) {
              req.destroy(new Error('Image too large'));
              return;
            }
            chunks.push(chunk);
          });

          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              buffer,
              mimeType: contentType
            });
          });
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.on('timeout', () => {
          req.destroy(new Error('Request timeout'));
        });
      });

      return result;

    } catch (err: any) {
      if (err.status === 429) {
        console.warn(`[serverFetch] Wikimedia rate-limit (429) for ${url}. Retrying in ${delayMs}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }
      if (i === retries - 1 || err.noRetry) {
        throw err;
      }
      console.warn(`[serverFetch] Network/Fetch error for ${url}. Retrying in ${delayMs}ms...`, err.message);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  throw new Error(`Fetch failed with status: ${lastStatus}`);
}
