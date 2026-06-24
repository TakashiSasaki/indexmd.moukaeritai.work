# AI Summary Prompts & Format Specification

This document defines the prompt text and output formats used by the Drive Indexer to generate `index.md` files and summary texts.

**Prompt Spec Version:** `1.0.0`
**Format Version:** `1.0.0`

---

## 1. File Summary Prompt
**Purpose:** Generate a 1-sentence Japanese description for individual files based on their metadata and optionally extracted text snippet.

**Expected Language:** Japanese
**Expected Length:** 1 sentence

**Variables:**
- `name`: File name
- `mimeType`: MIME type
- `size`: Size in bytes
- `contentSample`: Up to 1500 chars of text, or fallback string.

**Template:**
```
Based on the metadata and optional content sample of this file, provide a 1-sentence Japanese description of what it contains. Avoid technical jargon.
FileName: ${input.name}
MimeType: ${input.mimeType}
Size: ${input.size} bytes
ContentSample: ${input.contentSample || "No content available"}
```

---

## 2. Folder Summary Prompt
**Purpose:** Generate a 3-4 sentence overview of an entire directory based on the individual file summaries and subfolder summaries it contains.

**Expected Language:** Japanese
**Expected Length:** 3-4 sentences maximum

**Variables:**
- `folderName`: The directory's name.
- `subdirs`: List of child directory names and their pre-computed AI summaries (if any).
- `fileSummariesList`: List of 1-sentence summaries for the files directly inside this folder.

**Limitations:** Might fail to provide a deep summary if the folder contains hundreds of files or extremely dense sub-summaries, due to token limits. It attempts to weave a structural narrative.

**Template:**
```
You are a professional documentation archivist for Google Drive. Summarize the contents and main theme of this directory named "${input.folderName}" based on its items list, individual item descriptions, and pre-computed subfolder summaries.
Write a concise overview in Japanese (3-4 sentences maximum). Do not mention placeholder indicators like "Auto backup", give real structure summary in a natural human way.

Folder: "${input.folderName}"
Subdirectories with their pre-scanned subfolder summaries (cascade propagation):
${input.subdirs.map(d => `- ${d.name}/ ${d.summary ? `(Subfolder AI Summary: ${d.summary})` : ""}`).join("\n") || "(No subdirectories)"}

Files inside with brief details:
${input.fileSummariesList.join("\n") || "(No files)"}
```

---

## 3. Debug Text File Summary Prompt
**Purpose:** Generate a summary of up to a 50,000 character text snippet in the File Debug view.

**Expected Language:** Japanese

**Template:**
```
以下のファイル内容（最大5万文字のスニペット）を分析し、主な内容の要約を日本語で出力してください。
    
ファイル名: ${input.name}
MIMEタイプ: ${input.mimeType}

ファイル内容:
${input.contentSample}
```

---

## 4. Debug Binary File Summary Prompt
**Purpose:** Directly ask Gemini to analyze an image or PDF passed via the native multimodal binary payload in the File Debug view.

**Expected Language:** Japanese

**Template:**
```
以下のファイル内容を分析し、何が記載・描写されているか要約してください。日本語で出力してください。
           
ファイル名: ${input.name}
MIMEタイプ: ${input.mimeType}
```

---

## 5. `index.md` Generated Format Specification

The generated `index.md` has two primary zones:
1. **User Notes** (Protected) - Any text outside the auto-generated markers is considered human-authored and will **never** be overwritten.
2. **Auto-Generated Zone** - Text between `<!-- AUTO_GENERATED_START -->` and `<!-- AUTO_GENERATED_END -->`.

**Current Auto-Generated Block Format:**
```markdown
## AI Summary (生成日時: ${input.nowIso})
${input.folderSummary}

## Files
${input.mdFilesText || "*このディレクトリには直接配置されたファイルが存在しません。*"}

## Subdirectories
${input.mdSubdirsText || "*このディレクトリにはサブディレクトリがありません。*"}

<!-- formatVersion: ${INDEX_MD_FORMAT_VERSION}, promptSpecVersion: ${PROMPT_SPEC_VERSION} -->
```

**Marker Contract:**
The hybrid-merge process requires exact matching of the start and end HTML comments. The server will isolate that section, replace it entirely, and stitch it back with the user notes intact.
