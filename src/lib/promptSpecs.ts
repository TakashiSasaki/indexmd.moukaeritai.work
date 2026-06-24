export const PROMPT_SPEC_VERSION = "1.0.0";
export const SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION = "1.1.0-draft.1";
export const SUMMARY_ANALYSIS_PROMPT_VERSION = "1.1.0-draft.1";

export function buildSummaryDebugSystemInstruction(): string {
  return `You are an expert document analyzer. 
Analyze the provided document based on the metadata and content.
Requirements:
1. Always output your analysis in Japanese.
2. Only extract named entities, parties, resource references, dates, or monetary amounts if they are explicitly present in the content. Do not invent facts or hallucinate details.
3. Your 'oneLineSummary' must be concise and suitable for injection into an index.md file.
4. Use the schema exactly. Do not output markdown fences. Do not include explanatory text outside JSON.
5. Use 'documentTypes' for content-level document types. Do not put MIME/media format into 'documentTypes'.
6. Use 'resourceReferences' instead of urls.
7. Use 'primaryLanguage' and 'languages', not language.
8. Use 'subjectAreas' for academic/domain classification. Omit empty subject-area keys. Keep 'subjectAreas' as {} when no domain applies.
9. Note the distinction: 'topics' are broad free-text themes, 'keywords' are search terms, and 'subjectAreas' is a controlled taxonomy classification.`;
}

export function buildStructuredSummaryTaskPrompt(input: DebugTextFileInput | DebugBinaryFileInput, customInstruction?: string): string {
  const instructionPart = customInstruction ? `\nユーザー追加指示:\n${customInstruction}` : "";
  let contentPart = "";
  if ('contentSample' in input) {
    contentPart = `\n\nファイル内容:\n${input.contentSample}`;
  }

  return `このファイルを詳細に分析し、指定されたJSON構造で結果を出力してください。${instructionPart}
  
ファイル名: ${input.name}
MIMEタイプ: ${input.mimeType}${contentPart}`;
}

export interface FileSummaryInput {
  name: string;
  mimeType: string;
  size: number;
  contentSample: string;
}

export function buildFileSummaryPrompt(input: FileSummaryInput): string {
  return `Based on the metadata and optional content sample of this file, provide a 1-sentence Japanese description of what it contains. Avoid technical jargon.
FileName: ${input.name}
MimeType: ${input.mimeType}
Size: ${input.size} bytes
ContentSample: ${input.contentSample || "No content available"}`;
}

export interface FolderSummaryInput {
  folderName: string;
  subdirs: Array<{ name: string; summary?: string }>;
  fileSummariesList: string[];
}

export function buildFolderSummaryPrompt(input: FolderSummaryInput): string {
  return `You are a professional documentation archivist for Google Drive. Summarize the contents and main theme of this directory named "${input.folderName}" based on its items list, individual item descriptions, and pre-computed subfolder summaries.
Write a concise overview in Japanese (3-4 sentences maximum). Do not mention placeholder indicators like "Auto backup", give real structure summary in a natural human way.

Folder: "${input.folderName}"
Subdirectories with their pre-scanned subfolder summaries (cascade propagation):
${input.subdirs.length > 0 ? input.subdirs.map(d => `- ${d.name}/ ${d.summary ? `(Subfolder AI Summary: ${d.summary})` : ""}`).join("\n") : "(No subdirectories)"}

Files inside with brief details:
${input.fileSummariesList.length > 0 ? input.fileSummariesList.join("\n") : "(No files)"}`;
}

export interface DebugTextFileInput {
  name: string;
  mimeType: string;
  contentSample: string;
}

export function buildDebugTextFileSummaryPrompt(input: DebugTextFileInput, customInstruction?: string): string {
  const instruction = customInstruction || `以下のファイル内容（最大5万文字のスニペット）を分析し、主な内容の要約を日本語で出力してください。`;
  return `${instruction}
    
ファイル名: ${input.name}
MIMEタイプ: ${input.mimeType}

ファイル内容:
${input.contentSample}`;
}

export interface DebugBinaryFileInput {
  name: string;
  mimeType: string;
}

export function buildDebugBinaryFileSummaryPrompt(input: DebugBinaryFileInput, customInstruction?: string): string {
  const instruction = customInstruction || `以下のファイル内容を分析し、何が記載・描写されているか要約してください。日本語で出力してください。`;
  return `${instruction}
           
ファイル名: ${input.name}
MIMEタイプ: ${input.mimeType}`;
}
