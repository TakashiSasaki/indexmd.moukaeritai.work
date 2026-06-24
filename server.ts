import express from "express";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { parseOffice } from "officeparser";
import crypto from "crypto";
import { buildScanCacheKeyParts } from "./src/lib/scanCache";
import { mergeIndexMd } from "./src/lib/indexMdMerge";

dotenv.config();

const CACHE_DIR = path.join(process.cwd(), "cache", "snippets");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const SUMMARIES_CACHE_DIR = path.join(process.cwd(), "cache", "summaries");
if (!fs.existsSync(SUMMARIES_CACHE_DIR)) {
  fs.mkdirSync(SUMMARIES_CACHE_DIR, { recursive: true });
}

const SCAN_CACHE_DIR = path.join(process.cwd(), "cache", "scan");
if (!fs.existsSync(SCAN_CACHE_DIR)) {
  fs.mkdirSync(SCAN_CACHE_DIR, { recursive: true });
}

function getScanCacheKey(
  parentFolderId: string | undefined, 
  nextPageToken: string | undefined, 
  lastTraversedAt: string | undefined,
  pageSize: number | undefined,
  scanMode: string | undefined,
  cacheScope: string | undefined
): string {
  const parts = buildScanCacheKeyParts(parentFolderId, nextPageToken, lastTraversedAt, pageSize, scanMode, cacheScope);
  return crypto.createHash("md5").update(parts.normalizedString).digest("hex") + ".json";
}

async function getCachedScan(key: string): Promise<any | null> {
  const filePath = path.join(SCAN_CACHE_DIR, key);
  try {
    const content = await fsPromises.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

async function setCachedScan(key: string, data: any): Promise<void> {
  const filePath = path.join(SCAN_CACHE_DIR, key);
  await fsPromises.writeFile(filePath, JSON.stringify(data), "utf-8");
}

async function getCachedSnippet(fileId: string): Promise<string | null> {
  const filePath = path.join(CACHE_DIR, `${fileId}.txt`);
  try {
    return await fsPromises.readFile(filePath, "utf-8");
  } catch (err) {
    return null;
  }
}

async function setCachedSnippet(fileId: string, content: string): Promise<void> {
  const filePath = path.join(CACHE_DIR, `${fileId}.txt`);
  await fsPromises.writeFile(filePath, content, "utf-8");
}

async function getCachedSummary(key: string): Promise<any | null> {
  const filePath = path.join(SUMMARIES_CACHE_DIR, key);
  try {
    const content = await fsPromises.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

async function setCachedSummary(key: string, content: any): Promise<void> {
  const filePath = path.join(SUMMARIES_CACHE_DIR, key);
  await fsPromises.writeFile(filePath, JSON.stringify(content), "utf-8");
}

const HISTORY_PATH = path.join(process.cwd(), "src/data/validation_history.json");

function saveToHistory(entry: {
  status: "success" | "error";
  fileName: string;
  mimeType: string;
  model: string;
  details?: string;
}) {
  try {
    let history = [];
    if (fs.existsSync(HISTORY_PATH)) {
      const content = fs.readFileSync(HISTORY_PATH, "utf-8");
      try {
        history = JSON.parse(content);
      } catch (e) {
        history = [];
      }
    }
    
    // Ensure we have an array
    if (!Array.isArray(history)) history = [];

    const newEntry = {
      id: `auto-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    
    history.unshift(newEntry);
    
    // Limit history size to 100 entries to avoid massive files
    if (history.length > 100) {
      history = history.slice(0, 100);
    }

    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
    return newEntry;
  } catch (e) {
    console.error("Failed to save history:", e);
    return null;
  }
}
const app = express();
const PORT = 3000;

// Apply JSON parsing middleware
app.use(express.json());

// Lazy-initialized Gemini SDK clients mapping apiVersion to client
let _clients: Record<string, any> = {};
function getGeminiClient(modelName: string) {
  // Always use v1beta for newer models (3.5, gemma, preview) as many are not in v1 yet
  const apiVersion = 'v1beta';

  if (!_clients[apiVersion]) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    _clients[apiVersion] = new GoogleGenAI({ 
      apiKey: key,
      httpOptions: {
        apiVersion: apiVersion,
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return _clients[apiVersion];
}

const MODEL_FALLBACKS: Record<string, string> = {
  "gemini-3.5-pro": "gemini-3.1-pro-preview",
  "gemini-3.5-flash": "gemini-2.5-flash",
  "gemini-2.5-flash-lite-preview-09-2025": "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite": "gemini-3.1-flash-lite",
  "gemini-2.5-flash": "gemini-3.1-flash-lite"
};

/**
 * Helper to call Gemini with exponential backoff for 503/429 errors
 * with automatic fallback to alternative resilient models on both 404 (Not Found)
 * and 429 (Resource Exhausted / Quota Exceeded) errors.
 */
async function generateContentWithRetry(
  modelName: string, 
  contents: any, 
  maxRetries = 4, 
  configOption?: { temperature?: number; topP?: number; topK?: number }
) {
  let currentModel = modelName;
  let client = getGeminiClient(currentModel);
  let lastError: any = null;
  const attemptedModels = new Set<string>([currentModel]);
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const callParams: any = {
        model: currentModel,
        contents: contents
      };
      
      if (configOption) {
        callParams.config = {};
        if (typeof configOption.temperature === "number" && configOption.temperature !== 0) {
          callParams.config.temperature = configOption.temperature;
        }
        if (typeof configOption.topP === "number" && configOption.topP !== 0) {
          callParams.config.topP = configOption.topP;
        }
        if (typeof configOption.topK === "number" && configOption.topK !== 0) {
          callParams.config.topK = configOption.topK;
        }
      }

      const response = await client.models.generateContent(callParams);
      return response;
    } catch (err: any) {
      lastError = err;
      let statusCode = err.status || (err.response?.status) || (err.error?.code);
      if (!statusCode && err.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error && parsed.error.code) {
             statusCode = parsed.error.code;
          }
        } catch(e) {}
      }
      
      const rawMessage = err.message || "";
      const errorBody = err.response?.error || err.error || {};
      const isQuotaExceeded = statusCode === 429 && (
        rawMessage.includes("RESOURCE_EXHAUSTED") || 
        rawMessage.includes("quota") || 
        rawMessage.includes("Quota exceeded") ||
        errorBody.status === "RESOURCE_EXHAUSTED" ||
        rawMessage.includes("exceeded your current quota")
      );

      const isNotFound = statusCode === 404 || rawMessage.includes("404") || rawMessage.includes("NOT_FOUND");

      if (isNotFound || isQuotaExceeded) {
        let fallback = MODEL_FALLBACKS[currentModel];
        if (!fallback) {
          if (currentModel.includes("pro")) {
            fallback = "gemini-3.1-pro-preview";
          } else if (currentModel === "gemini-2.5-flash" || currentModel === "gemini-3.5-flash") {
            fallback = "gemini-3.1-flash-lite";
          } else {
            fallback = "gemini-2.5-flash-lite";
          }
        }
        
        if (fallback && !attemptedModels.has(fallback)) {
          // console.log(`Model ${currentModel} failed (isNotFound: ${isNotFound}, isQuotaExceeded: ${isQuotaExceeded}). Falling back to alternative model: ${fallback}...`);
          attemptedModels.add(fallback);
          currentModel = fallback;
          client = getGeminiClient(currentModel);
          continue; 
        } else {
          // If the fallback has already been tried, inspect remaining pool items
          const modelPool = [
            "gemini-3.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-flash-latest"
          ];
          const nextUntried = modelPool.find(m => !attemptedModels.has(m));
          if (nextUntried) {
            console.log(`All primary fallbacks exhausted. Trying untried model from pool: ${nextUntried}...`);
            attemptedModels.add(nextUntried);
            currentModel = nextUntried;
            client = getGeminiClient(currentModel);
            continue;
          }
        }
      }

      const isRetryable = statusCode === 503 || statusCode === 429 || statusCode === 500 || 
                         rawMessage.includes("503") || rawMessage.includes("429") ||
                         rawMessage.includes("high demand") || rawMessage.includes("Internal error");
                         
      if (isRetryable && i < maxRetries) {
        const delay = Math.pow(2, i + 1) * 1500 + Math.random() * 1000;
        console.log(`Gemini API retryable status (${statusCode || 'unknown'}). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }
  throw lastError;
}

// 1. Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API to fetch history
app.get("/api/validation-history", (req, res) => {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      const content = fs.readFileSync(HISTORY_PATH, "utf-8");
      return res.json(JSON.parse(content));
    }
    res.json([]);
  } catch (e) {
    res.status(500).json({ error: "Failed to read history" });
  }
});

// Helper: safe fetch with error details
async function fetchGoogleDrive(url: string, token: string, options: RequestInit = {}) {
  const mergedOptions = {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      ...(options.headers || {}),
    }
  };
  const res = await fetch(url, mergedOptions);
  if (!res.ok) {
    const textStatus = await res.text().catch(() => "");
    const err = new Error(`Google API returned status ${res.status}: ${textStatus || res.statusText}`) as any;
    err.status = res.status;
    throw err;
  }
  return res;
}

// Helper: extract Google Drive OAuth token from multiple request locations to handle reverse proxies correctly
function extractToken(req: express.Request): string | null {
  // 1. Check custom headers
  let token = req.headers["x-google-drive-token"] as string;
  if (!token && req.headers["X-Google-Drive-Token"]) {
    token = req.headers["X-Google-Drive-Token"] as string;
  }
  
  // 2. Check standard Authorization header
  if (!token && req.headers["authorization"]) {
    const authHeader = req.headers["authorization"] as string;
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else {
      token = authHeader;
    }
  }

  // 3. Check query parameters
  if (!token && req.query && req.query.token) {
    token = req.query.token as string;
  }

  // 4. Check body params (if parsed as JSON)
  if (!token && req.body && req.body.token) {
    token = req.body.token as string;
  }

  if (token) {
    const cleaned = token.trim();
    if (cleaned && cleaned !== "null" && cleaned !== "undefined" && cleaned !== "null_token") {
      return cleaned;
    }
  }
  return null;
}

// 2. Fetch User Profile from Google API (validate token)
app.get("/api/drive/user", async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing x-google-drive-token header" });
    return;
  }
  try {
    const response = await fetchGoogleDrive("https://www.googleapis.com/oauth2/v2/userinfo", token);
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(401).json({ error: err.message || "Failed to validate token with Google User Info" });
  }
});

// 3. Drive lists directories endpoint (Supports incremental scans, full lists, and step-by-step debug scans)
// q: 'root' in parents, modifiedTime > datetime, mimeType='application/vnd.google-apps.folder', trashed=false
app.post("/api/drive/scan", async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing x-google-drive-token header" });
    return;
  }

  const { lastTraversedAt, nextPageToken, pageSize, parentFolderId, scanMode, bypassCache, cacheScope } = req.body;
  const targetPageSize = pageSize || 100;
  const cacheKey = getScanCacheKey(parentFolderId, nextPageToken, lastTraversedAt, targetPageSize, scanMode, cacheScope);

  try {
    // 1. Try reading from disk cache
    if (!bypassCache) {
      const cachedData = await getCachedScan(cacheKey);
      if (cachedData) {
        console.log(`[Cache Hit] mode=${scanMode || "none"} scope=${cacheScope || "none"} key=${cacheKey.substring(0, 8)}... Serving scan result from disk cache.`);
        res.json({ ...cachedData, cached: true });
        return;
      }
    } else {
      console.log(`[Cache Bypass] mode=${scanMode || "none"} skip disk cache read.`);
    }

    // 2. Fetch from Google API on cache miss
    let q = "(mimeType = 'application/vnd.google-apps.folder' or (mimeType = 'application/vnd.google-apps.shortcut' and shortcutDetails.targetMimeType = 'application/vnd.google-apps.folder')) and trashed = false";
    
    if (parentFolderId) {
      q = `'${parentFolderId}' in parents and ${q}`;
    } else if (lastTraversedAt) {
      q += ` and modifiedTime > '${lastTraversedAt}'`;
    }

    const fields = "nextPageToken,files(id,name,mimeType,parents,modifiedTime,shortcutDetails)";
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=${targetPageSize}`;
    if (nextPageToken) {
      url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
    }

    console.log(`[Cache Miss] Fetching scan result from Google Drive API`);
    const response = await fetchGoogleDrive(url, token);
    const data = await response.json();

    // 3. Save to disk cache if it's a successful response (has no error key)
    if (!bypassCache && data && !data.error) {
      await setCachedScan(cacheKey, data);
    }

    res.json({ ...data, cached: false });
  } catch (err: any) {
    // If the pageToken is stale, expired, or invalid, Google Drive API returns status 400 with 'pageToken' in the error details.
    // We can auto-recover by retrying the request without the pageToken to fetch page 1 fresh.
    if (err.status === 400 && nextPageToken && err.message && err.message.includes("pageToken")) {
      console.warn(`[PageToken Recovery] Stale/invalid pageToken detected for folder ${parentFolderId || "root"}. Auto-recovering by requesting page 1 fresh...`);
      try {
        let q = "(mimeType = 'application/vnd.google-apps.folder' or (mimeType = 'application/vnd.google-apps.shortcut' and shortcutDetails.targetMimeType = 'application/vnd.google-apps.folder')) and trashed = false";
        if (parentFolderId) {
          q = `'${parentFolderId}' in parents and ${q}`;
        } else if (lastTraversedAt) {
          q += ` and modifiedTime > '${lastTraversedAt}'`;
        }

        const fields = "nextPageToken,files(id,name,mimeType,parents,modifiedTime,shortcutDetails)";
        const urlWithoutToken = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=${targetPageSize}`;
        
        console.log(`[PageToken Recovery] Re-fetching page 1 from Google Drive API without pageToken`);
        const recoveryResponse = await fetchGoogleDrive(urlWithoutToken, token);
        const recoveryData = await recoveryResponse.json();

        // Save to disk cache under the original key so subsequent scans can hit it
        if (!bypassCache && recoveryData && !recoveryData.error) {
          await setCachedScan(cacheKey, recoveryData);
        }

        res.json({ ...recoveryData, cached: false, pageTokenRecovered: true });
        return;
      } catch (recoveryErr: any) {
        console.error(`[PageToken Recovery Failed]`, recoveryErr);
      }
    }

    const statusCode = err.status || 500;
    res.status(statusCode).json({ error: err.message || "Drive scan failed" });
  }
});

// Endpoint to manually or programmatically clear the folder scan disk cache
app.post("/api/drive/clear-scan-cache", async (req, res) => {
  try {
    const files = await fsPromises.readdir(SCAN_CACHE_DIR);
    for (const file of files) {
      await fsPromises.unlink(path.join(SCAN_CACHE_DIR, file));
    }
    console.log("[Cache Reset] Cleared all folder scan files from disk cache.");
    res.json({ success: true, message: "Folder scan cache cleared successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to clear scan cache" });
  }
});

// Endpoint to manually clear specific or all caches individually
app.post("/api/drive/clear-cache", async (req, res) => {
  const { type } = req.body; // "scan" | "snippets" | "summaries" | "all"
  try {
    const clearDir = async (dirPath: string) => {
      if (!fs.existsSync(dirPath)) return;
      const files = await fsPromises.readdir(dirPath);
      for (const file of files) {
        await fsPromises.unlink(path.join(dirPath, file));
      }
    };

    const clearedTypes: string[] = [];

    if (type === "scan" || type === "all" || !type) {
      await clearDir(SCAN_CACHE_DIR);
      clearedTypes.push("フォルダ走査結果(scan)");
    }
    if (type === "snippets" || type === "all") {
      await clearDir(CACHE_DIR);
      clearedTypes.push("ファイルテキストスニペット(snippets)");
    }
    if (type === "summaries" || type === "all") {
      await clearDir(SUMMARIES_CACHE_DIR);
      clearedTypes.push("AI要約(summaries)");
    }

    console.log(`[Cache Reset] Cleared caches: ${clearedTypes.join(", ")}`);
    res.json({ success: true, message: `${clearedTypes.join(", ")} キャッシュが正常にクリアされました。` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to clear cache" });
  }
});

// 4. Detailed file cataloguing and single folder index generator
app.post("/api/drive/generate-index-step", async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing x-google-drive-token" });
    return;
  }

  const { folderId, folderName, config, subdirsWithSummaries } = req.body;
  if (!folderId || !folderName) {
    res.status(400).json({ error: "folderId and folderName are required params." });
    return;
  }

  const rateDelay = config?.rate_limit_delay_ms || 500;
  const geminiModel = config?.gemini_model || "gemini-2.5-flash";

  try {
    // Step 1: List all files and folders immediately under this folder
    const listQ = `'${folderId}' in parents and trashed = false`;
    const listFields = "files(id,name,mimeType,size,webViewLink,shortcutDetails)";
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQ)}&fields=${encodeURIComponent(listFields)}&pageSize=1000`;
    
    const listRes = await fetchGoogleDrive(listUrl, token);
    const listData = await listRes.json();
    const items = listData.files || [];

    if (items.length === 0) {
      res.json({
        success: true,
        message: "Folder is empty, skipped AI summarization as per rules.",
        skipped: true,
        files: [],
        subdirectories: []
      });
      return;
    }

    // Separate folders and files while resolving shortcuts
    const files: any[] = [];
    const subdirs: any[] = [];

    for (const item of items) {
      let resolvedMimeType = item.mimeType;
      let resolvedId = item.id;
      
      if (item.mimeType === "application/vnd.google-apps.shortcut" && item.shortcutDetails) {
        resolvedMimeType = item.shortcutDetails.targetMimeType;
        resolvedId = item.shortcutDetails.targetId;
      }

      const itemInfo = {
        id: item.id,
        resolvedId,
        name: item.name,
        mimeType: resolvedMimeType,
        size: item.size || 0,
        webViewLink: item.webViewLink || `https://drive.google.com/open?id=${item.id}`
      };

      if (resolvedMimeType === "application/vnd.google-apps.folder") {
        subdirs.push(itemInfo);
      } else {
        files.push(itemInfo);
      }
    }

    // Step 2: Individual file summaries processing
    const fileSummariesList: string[] = [];
    
    // We parse up to a maximum to prevent exceeding limits
    const filesSubset = files.slice(0, 15);
    for (const file of filesSubset) {
      let contentSample = "";
      
      // Attempt to load text content of readable files for richer AI context
      const isReadable = [
        "text/plain", "text/markdown", "application/json", "text/csv", "text/html", "application/xml"
      ].includes(file.mimeType);

      const isGoogleDoc = [
        "application/vnd.google-apps.document",
        "application/vnd.google-apps.spreadsheet",
        "application/vnd.google-apps.presentation"
      ].includes(file.mimeType);

      if (isReadable || isGoogleDoc) {
        try {
          let contentUrl = `https://www.googleapis.com/drive/v3/files/${file.resolvedId}?alt=media`;
          if (file.mimeType === "application/vnd.google-apps.document") {
            contentUrl = `https://www.googleapis.com/drive/v3/files/${file.resolvedId}/export?mimeType=text/plain`;
          } else if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
            contentUrl = `https://www.googleapis.com/drive/v3/files/${file.resolvedId}/export?mimeType=text/csv`;
          } else if (file.mimeType === "application/vnd.google-apps.presentation") {
            contentUrl = `https://www.googleapis.com/drive/v3/files/${file.resolvedId}/export?mimeType=text/plain`;
          }

          const contentRes = await fetchGoogleDrive(contentUrl, token);
          const fullText = await contentRes.text();
          contentSample = fullText.substring(0, 1500); // Take first 1500 chars to avoid token inflation
        } catch (downloadErr) {
          // Fallback to name-only summary
          contentSample = "";
        }
      }

      // Query Gemini for single file summary
      try {
        const filePrompt = `Based on the metadata and optional content sample of this file, provide a 1-sentence Japanese description of what it contains. Avoid technical jargon.
FileName: ${file.name}
MimeType: ${file.mimeType}
Size: ${file.size} bytes
ContentSample: ${contentSample || "No content available"}`;
        
        const aiRes = await generateContentWithRetry(geminiModel, filePrompt);

        const singleSummary = aiRes.text?.trim() || "ファイルの記述がありません。";
        fileSummariesList.push(`- **${file.name}**: ${singleSummary}`);
      } catch (aiErr: any) {
        fileSummariesList.push(`- **${file.name}**: (名前情報から構成)`);
      }

      // Inject custom rate pacing
      await new Promise(resolve => setTimeout(resolve, rateDelay));
    }

    // Capture remaining files (beyond the subset limit)
    if (files.length > 15) {
      files.slice(15).forEach(f => {
        fileSummariesList.push(`- **${f.name}**: その他追加資料`);
      });
    }

    // Step 3: Combine into a single Directory Summary
    let folderSummary = "";
    try {
      const combinedPrompt = `You are a professional documentation archivist for Google Drive. Summarize the contents and main theme of this directory named "${folderName}" based on its items list, individual item descriptions, and pre-computed subfolder summaries.
Write a concise overview in Japanese (3-4 sentences maximum). Do not mention placeholder indicators like "Auto backup", give real structure summary in a natural human way.

Folder: "${folderName}"
Subdirectories with their pre-scanned subfolder summaries (cascade propagation):
${subdirs.map(d => {
  const match = subdirsWithSummaries?.find((s: any) => s.id === d.id);
  return `- ${d.name}/ ${match ? `(Subfolder AI Summary: ${match.summary})` : ""}`;
}).join("\n") || "(No subdirectories)"}

Files inside with brief details:
${fileSummariesList.join("\n") || "(No files)"}`;

      const combinedAiRes = await generateContentWithRetry(geminiModel, combinedPrompt);

      folderSummary = combinedAiRes.text?.trim() || `フォルダ「${folderName}」のコンテンツの概要です。`;
    } catch (summaryErr: any) {
      folderSummary = `フォルダ「${folderName}」の自動AI要約です。ファイルを安全に検出し、インデックスしました。`;
    }

    // Step 4: Seek index.md in the folder to see if target already exists (Seeding Hybrid-merge rules)
    const indexCheckQ = `'${folderId}' in parents and name = 'index.md' and trashed = false`;
    const indexCheckUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(indexCheckQ)}&fields=files(id,name)`;
    const indexCheckRes = await fetchGoogleDrive(indexCheckUrl, token);
    const indexCheckData = await indexCheckRes.json();
    const existingIndexFile = indexCheckData.files?.[0];

    let currentFileContent = "";
    let existingIndexId = existingIndexFile?.id || null;

    if (existingIndexId) {
      try {
        const fetchContentUrl = `https://www.googleapis.com/drive/v3/files/${existingIndexId}?alt=media`;
        const contentRes = await fetchGoogleDrive(fetchContentUrl, token);
        currentFileContent = await contentRes.text();
      } catch (fetchContentErr) {
        currentFileContent = "";
      }
    }

    // Prepare OKF sections
    const nowIso = new Date().toISOString();
    const autoGenStartMarker = "<!-- AUTO_GENERATED_START -->";
    const autoGenEndMarker = "<!-- AUTO_GENERATED_END -->";

    // Subdirectories list with Google Drive links
    const mdSubdirsText = subdirs.map(sub => {
      // Create relative path preview and point direct Web link or custom layout
      return `- [${sub.name}/](${sub.webViewLink})`;
    }).join("\n");

    // Files list with individual descriptions
    const mdFilesText = files.map(file => {
      return `- [${file.name}](${file.webViewLink})`;
    }).join("\n");

    const autoGenSectionContent = `
## AI Summary (生成日時: ${nowIso})
${folderSummary}

## Files
${mdFilesText || "*このディレクトリには直接配置されたファイルが存在しません。*"}

## Subdirectories
${mdSubdirsText || "*このディレクトリにはサブディレクトリがありません。*"}
`;

    // Process Hybrid Merge
    const mergedContent = mergeIndexMd(currentFileContent, folderName, autoGenSectionContent);

    // Step 5: Save/Update in Google Drive
    if (existingIndexId) {
      // Perform PATCH update
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingIndexId}?uploadType=media`;
      await fetchGoogleDrive(updateUrl, token, {
        method: "PATCH",
        headers: { "Content-Type": "text/markdown" },
        body: mergedContent
      });
    } else {
      // Create new file
      // 1. Create Metadata
      const createMetaUrl = "https://www.googleapis.com/drive/v3/files";
      const createMetaRes = await fetchGoogleDrive(createMetaUrl, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "index.md",
          mimeType: "text/markdown",
          parents: [folderId]
        })
      });
      const createdFileInfo = await createMetaRes.json();
      existingIndexId = createdFileInfo.id;

      // 2. Upload media
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingIndexId}?uploadType=media`;
      await fetchGoogleDrive(updateUrl, token, {
        method: "PATCH",
        headers: { "Content-Type": "text/markdown" },
        body: mergedContent
      });
    }

    res.json({
      success: true,
      indexFileId: existingIndexId,
      aiSummary: folderSummary,
      filesGenerated: files.length,
      subdirsGenerated: subdirs.length
    });

  } catch (err: any) {
    console.error("Index generation error:", err);
    const statusCode = err.status || 500;
    res.status(statusCode).json({ error: err.message || "Failed to generate index files." });
  }
});

app.get("/api/drive/debug/sample-files", async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing x-google-drive-token header" });
    return;
  }

  const mimeTypes = [
    { type: "application/pdf", name: "PDF" },
    { type: "application/vnd.google-apps.document", name: "Google ドキュメント" },
    { type: "application/vnd.google-apps.spreadsheet", name: "Google スプレッドシート" },
    { type: "application/vnd.google-apps.presentation", name: "Google スライド" },
    { type: "text/plain", name: "プレーンテキスト" },
    { type: "text/markdown", name: "Markdown" },
    { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name: "MS Word" },
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "MS Excel" },
    { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", name: "MS PowerPoint" },
    { type: "application/json", name: "JSON" },
    { type: "text/csv", name: "CSV" },
    { type: "image/jpeg", name: "画像 (JPEG)" },
    { type: "image/png", name: "画像 (PNG)" }
  ];

  try {
    const results = [];
    for (const mime of mimeTypes) {
      const q = `mimeType = '${mime.type}' and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=1`;
      const driveRes = await fetchGoogleDrive(url, token);
      const data = await driveRes.json();
      
      if (data.files && data.files.length > 0) {
        results.push({
          category: mime.name,
          file: data.files[0]
        });
      }
    }
    res.json({ samples: results });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post("/api/drive/debug/generate-file-summary", async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing x-google-drive-token header" });
    return;
  }

  const { fileId, modelName, temperature, topP, topK } = req.body;
  if (!fileId) {
    return res.status(400).json({ error: "fileId is required" });
  }

  const targetModel = modelName || "gemini-3.5-flash"; // default fallback if empty
  const temp = temperature || 0;
  const tP = topP || 0;
  const tK = topK || 0;
  
  // Sanitize model name so it is safe to use in a filename (e.g. replacing 'models/gemini-...' with 'models_gemini-...')
  const safeModel = targetModel.replace(/[^a-zA-Z0-9_-]/g, "_");
  const cacheKey = `${fileId}__${safeModel}__${temp}__${tP}__${tK}.json`;

  try {
    // 0. Check cache
    const cachedSummary = await getCachedSummary(cacheKey);
    if (cachedSummary) return res.json(cachedSummary);

    // 1. Get file metadata
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`;
    const metaRes = await fetchGoogleDrive(metaUrl, token);
    const fileMeta = await metaRes.json();
    
    // 2. Export / Download content
    const mimeType = fileMeta.mimeType || "";
    let contentUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    let isReadable = false;

    if (mimeType === "application/vnd.google-apps.document") {
      contentUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
      isReadable = true;
    } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
      contentUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
      isReadable = true;
    } else if (mimeType === "application/vnd.google-apps.presentation") {
      contentUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
      isReadable = true;
    } else if (mimeType === "application/pdf") {
      // For PDF, we can try alt=media download but standard full-text decode might need a library. 
      // We will attempt raw download and Gemini multimodal if that model supports it. But Gemma might need raw text.
      // We'll pass text to Gemini/Gemma. Raw PDF binary string isn't readable text directly.
      isReadable = true;
    } else if (["text/plain", "text/markdown", "application/json", "text/csv"].includes(mimeType)) {
      isReadable = true;
    } else if (mimeType.startsWith("application/vnd.openxmlformats-officedocument")) {
      isReadable = true;
    } else if (mimeType.startsWith("image/")) {
      isReadable = true;
    }

    let fullText = "";
    
    // Check if we can use cached text snippet
    const cachedSnippet = await getCachedSnippet(fileId);
    if (cachedSnippet) {
      fullText = cachedSnippet;
    } else if (isReadable) {
      if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
         // ... (Binary data, don't cache as text snippet)
         try {
           const fileRes = await fetchGoogleDrive(contentUrl, token);
           const arrBuffer = await fileRes.arrayBuffer();
           const base64Data = Buffer.from(arrBuffer).toString("base64");
           
           // Query Gemini with binary part directly
           const filePrompt = `以下のファイル内容を分析し、何が記載・描写されているか要約してください。日本語で出力してください。
           
ファイル名: ${fileMeta.name}
MIMEタイプ: ${fileMeta.mimeType}`;

           const aiRes = await generateContentWithRetry(targetModel, [
             { inlineData: { data: base64Data, mimeType: mimeType } },
             { text: filePrompt }
           ], 4, { temperature: temp, topP: tP, topK: tK });
           
           const summary = aiRes.text?.trim() || "No summary generated";
           
           const result = {
             success: true,
             metadata: fileMeta,
             summary: summary,
             contentSampleSnippet: `(${mimeType.split('/')[0].toUpperCase()} binary data was passed directly to the model)`
           };

           await setCachedSummary(cacheKey, result);
           return res.json(result);
         } catch(e: any) {
           return res.status(500).json({ error: `${mimeType.startsWith('image') ? 'Image' : 'PDF'} generation failed: ${e.message}` });
         }
      } else if (mimeType.startsWith("application/vnd.openxmlformats-officedocument")) {
         try {
           const officeRes = await fetchGoogleDrive(contentUrl, token);
           const arrBuffer = await officeRes.arrayBuffer();
           // officeparser.parseOffice returns the text directly as a string if no callback is provided
           const parsedText = await parseOffice(Buffer.from(arrBuffer));
           if (typeof parsedText === 'string') {
             fullText = parsedText;
           } else if (parsedText && typeof parsedText === 'object') {
             fullText = (parsedText as any).text || JSON.stringify(parsedText);
           } else {
             fullText = String(parsedText);
           }
           await setCachedSnippet(fileId, fullText);
         } catch(e: any) {
           console.error("Office parsing error:", e);
           fullText = `Office parsing failed: ${e.message}`;
         }
      } else {
        const contentRes = await fetchGoogleDrive(contentUrl, token);
        fullText = await contentRes.text();
        await setCachedSnippet(fileId, fullText);
      }
    } else {
      fullText = "This file type is not natively extractable as text in this debug tool.";
    }

    // 3. Query Model for standard text
    const contentSample = fullText.substring(0, 50000); // 50k chars max to avoid 500 error on gemma models
    const filePrompt = `以下のファイル内容（最大5万文字のスニペット）を分析し、主な内容の要約を日本語で出力してください。
    
ファイル名: ${fileMeta.name}
MIMEタイプ: ${fileMeta.mimeType}

ファイル内容:
${contentSample}`;

    const aiRes = await generateContentWithRetry(targetModel, filePrompt, 4, { temperature: temp, topP: tP, topK: tK });

    const summary = aiRes.text?.trim() || "No summary generated";

    const result = {
      success: true,
      metadata: fileMeta,
      summary: summary,
      contentSampleSnippet: contentSample.substring(0, 200) + (contentSample.length > 200 ? "..." : "")
    };

    await setCachedSummary(cacheKey, result);
    
    res.json(result);
  } catch (err: any) {
    console.error("Debug file summary error:", err);
    let errorMessage = "要約の生成に失敗しました。";
    
    // Attempt meta fetch if it failed late
    let failName = "Unknown File";
    let failMime = "unknown";
    try {
      const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`;
      const metaRes = await fetchGoogleDrive(metaUrl, token);
      const fileMeta = await metaRes.json();
      failName = fileMeta.name;
      failMime = fileMeta.mimeType;
    } catch(e) {}
    
    // Extract message from ApiError or standard Error
    const rawMessage = err.message || "";
    const errorBody = err.response?.error || err.error || {};
    
    if (rawMessage.includes("503") || rawMessage.includes("high demand") || errorBody.code === 503) {
      errorMessage = "選択したモデルが混み合っています (503)。しばらく待ってから再試行するか、別のモデル（gemini-3.1-flash-lite など）をお試しください。";
    } else if (rawMessage.includes("API key not valid")) {
      errorMessage = "Gemini APIキーが無効です。設定をご確認ください。";
    } else if (rawMessage.includes("RESOURCE_EXHAUSTED") || rawMessage.includes("quota") || errorBody.status === "RESOURCE_EXHAUSTED") {
      errorMessage = "Gemini APIの利用制限（リクエスト過多・クォータ不足）に達しました。時間を置いてください。";
    } else if (rawMessage.includes("SAFETY")) {
      errorMessage = "安全性のフィルタリングにより要約を生成できませんでした。";
    } else {
      errorMessage = err.message || "Failed to generate file summary.";
    }

    const rawStatus = err.status || err.response?.status;
    const statusCode = rawStatus ? Number(rawStatus) : 500;
    res.status(statusCode).json({ error: errorMessage });
  }
});


// 5. Mount Vite middleware for serving frontend SPA assets or dev server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback handling
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Drive Indexer Backend] Running on http://localhost:${PORT}`);
  });
}

startServer();
