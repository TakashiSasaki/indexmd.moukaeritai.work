import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Apply JSON parsing middleware
app.use(express.json());

// Lazy-initialized Gemini SDK client to prevent startup crashes when API key is missing
let _ai: any = null;
function getGeminiClient() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

// 1. Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
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
        const aiClient = getGeminiClient();
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
      const aiClient = getGeminiClient();
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
