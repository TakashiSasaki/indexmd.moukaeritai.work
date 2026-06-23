import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { parseOffice } from "officeparser";

dotenv.config();

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
const PORT = 3000;

// Apply JSON parsing middleware
app.use(express.json());

// Lazy-initialized Gemini SDK clients mapping apiVersion to client
let _clients: Record<string, any> = {};
function getGeminiClient(modelName: string) {
  const apiVersion = modelName.includes('-preview') || modelName.includes('-experimental') || modelName.includes('beta') 
    ? 'v1beta' 
    : 'v1';

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

/**
 * Helper to call Gemini with exponential backoff for 503/429 errors
 */
async function generateContentWithRetry(modelName: string, contents: any, maxRetries = 2) {
  const client = getGeminiClient(modelName);
  let lastError: any = null;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(contents);
      const response = await result.response;
      return response;
    } catch (err: any) {
      lastError = err;
      const statusCode = err.status || (err.response?.status);
      const isRetryable = statusCode === 503 || statusCode === 429 || 
                         err.message?.includes("503") || err.message?.includes("429") ||
                         err.message?.includes("high demand");
                         
      if (isRetryable && i < maxRetries) {
        const delay = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
        console.log(`Gemini API retryable error (${statusCode || 'unknown'}). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
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

  const { lastTraversedAt, nextPageToken, pageSize, parentFolderId } = req.body;
  const targetPageSize = pageSize || 100;

  try {
    // We only fetch folders, or folders that are shortcuts
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

    const response = await fetchGoogleDrive(url, token);
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({ error: err.message || "Drive scan failed" });
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
        const aiClient = getGeminiClient(geminiModel);
        const filePrompt = `Based on the metadata and optional content sample of this file, provide a 1-sentence Japanese description of what it contains. Avoid technical jargon.
FileName: ${file.name}
MimeType: ${file.mimeType}
Size: ${file.size} bytes
ContentSample: ${contentSample || "No content available"}`;
        
        const aiRes = await aiClient.models.generateContent({
          model: geminiModel,
          contents: filePrompt,
        });

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
      const aiClient = getGeminiClient(geminiModel);
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

      const combinedAiRes = await aiClient.models.generateContent({
        model: geminiModel,
        contents: combinedPrompt,
      });

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
    let mergedContent = "";
    if (currentFileContent.trim()) {
      const startIdx = currentFileContent.indexOf(autoGenStartMarker);
      const endIdx = currentFileContent.indexOf(autoGenEndMarker);

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const preSection = currentFileContent.substring(0, startIdx);
        const postSection = currentFileContent.substring(endIdx + autoGenEndMarker.length);
        mergedContent = preSection + autoGenStartMarker + autoGenSectionContent + autoGenEndMarker + postSection;
      } else {
        // Markers missing in existing file, append at the end as instructed
        mergedContent = currentFileContent.trim() + "\n\n" + autoGenStartMarker + autoGenSectionContent + autoGenEndMarker;
      }
    } else {
      // Complete brand new file
      mergedContent = `# ${folderName}

<!-- USER_NOTES_START -->
<!-- ここに自由なメモを追記してください。このエリアは自動更新で保護されます。 -->
<!-- USER_NOTES_END -->

${autoGenStartMarker}${autoGenSectionContent}${autoGenEndMarker}`;
    }

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

  const { fileId, modelName } = req.body;
  if (!fileId) {
    return res.status(400).json({ error: "fileId is required" });
  }

  const targetModel = modelName || "gemini-3.5-flash"; // default fallback if empty

  try {
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
    
    if (isReadable) {
      if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
         // For PDF and Images, we can pass them as inlineData
         try {
           const fileRes = await fetchGoogleDrive(contentUrl, token);
           const arrBuffer = await fileRes.arrayBuffer();
           const base64Data = Buffer.from(arrBuffer).toString("base64");
           
           // Query Gemini with binary part directly
           const aiClient = getGeminiClient(targetModel);
           const filePrompt = `以下のファイル内容を分析し、何が記載・描写されているか要約してください。日本語で出力してください。
           
ファイル名: ${fileMeta.name}
MIMEタイプ: ${fileMeta.mimeType}`;
           
           const aiRes = await aiClient.models.generateContent({
             model: targetModel,
             contents: {
               parts: [
                 { inlineData: { data: base64Data, mimeType: mimeType } },
                 { text: filePrompt }
               ]
             }
           });
           
           const summary = aiRes.text?.trim() || "No summary generated";
           
           return res.json({
             success: true,
             metadata: fileMeta,
             summary: summary,
             contentSampleSnippet: `(${mimeType.split('/')[0].toUpperCase()} binary data was passed directly to the model)`
           });
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
         } catch(e: any) {
           console.error("Office parsing error:", e);
           fullText = `Office parsing failed: ${e.message}`;
         }
      } else {
        const contentRes = await fetchGoogleDrive(contentUrl, token);
        fullText = await contentRes.text();
      }
    } else {
      fullText = "This file type is not natively extractable as text in this debug tool.";
    }

    // 3. Query Model for standard text
    const contentSample = fullText.substring(0, 100000); // 100k chars max
    const aiClient = getGeminiClient(targetModel);
    const filePrompt = `以下のファイル内容（最大10万文字のスニペット）を分析し、主な内容の要約を日本語で出力してください。
    
ファイル名: ${fileMeta.name}
MIMEタイプ: ${fileMeta.mimeType}

ファイル内容:
${contentSample}`;

    const aiRes = await aiClient.models.generateContent({
      model: targetModel,
      contents: filePrompt,
    });

    const summary = aiRes.text?.trim() || "No summary generated";

    res.json({
      success: true,
      metadata: fileMeta,
      summary: summary,
      contentSampleSnippet: contentSample.substring(0, 200) + (contentSample.length > 200 ? "..." : "")
    });
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

    const statusCode = (err.status || err.response?.status) === 503 ? 503 : 500;
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
