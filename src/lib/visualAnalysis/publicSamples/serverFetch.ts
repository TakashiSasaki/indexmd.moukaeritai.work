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

export async function fetchPublicSampleImage(sampleId: string, variant: "preview" | "thumbnail" | "full"): Promise<FetchSampleResult> {
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

    return { buffer, mimeType };
  }

  return fetchExternalImage(urlToFetch, 0);
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'indexmd-image-experiment/1.0',
        'Accept': 'image/*'
      },
      redirect: 'manual', // handle redirect manually to check host
      signal: controller.signal as any
    });

    if (res.status >= 300 && res.status < 400 && res.headers.has('location')) {
      const location = res.headers.get('location');
      if (!location) throw new Error('Redirect with no location');

      const nextUrl = new URL(location, url).toString();
      return fetchExternalImage(nextUrl, redirectCount + 1);
    }

    if (!res.ok) {
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

  } finally {
    clearTimeout(timeout);
  }
}
