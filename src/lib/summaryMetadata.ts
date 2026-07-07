import { SCHEMA_VERSION_V12 } from "./summaryAnalysis/schema";
import { SUMMARY_ANALYSIS_PROMPT_VERSION, SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION } from "./promptSpecs";
import { SummaryAnalysisResultV12 } from "./summaryAnalysis/types";

export interface FileSummaryMetadata {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  modified_time?: string;
  parent_id?: string;
  schema_version: string;
  prompt_version: string;
  system_instruction_version: string;
  model: string;
  output_mode: "structured";
  summary: string;
  structured: SummaryAnalysisResultV12;
  validation_errors: string[];
  parse_success: boolean;
  validation_success: boolean;
  generated_at: string;
  source: "ai-summary-test" | "drive-debugger" | "future-indexing";
  cache_key?: string;
  normalized_payload_hash?: string;
}

export interface BuildFileSummaryMetadataInput {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  modifiedTime?: string;
  parentId?: string;
  model: string;
  structured: SummaryAnalysisResultV12;
  validationErrors: string[];
  parseSuccess: boolean;
  validationSuccess: boolean;
  source: "ai-summary-test" | "drive-debugger" | "future-indexing";
  cacheKey?: string;
  generatedAt?: string;
  schemaVersion?: string;
  promptVersion?: string;
  systemInstructionVersion?: string;
}

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const sorted: any = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334903);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

export function buildCanonicalSummaryPayload(metadataOrStructured: any): any {
  if (!metadataOrStructured || typeof metadataOrStructured !== "object") return null;
  const structured = metadataOrStructured.structured && typeof metadataOrStructured.structured === "object"
    ? metadataOrStructured.structured
    : metadataOrStructured;
  return sortObjectKeys(structured);
}

export function buildNormalizedPayloadHash(value: unknown): string {
  const canonical = buildCanonicalSummaryPayload(value);
  if (!canonical) return "";
  const serialized = JSON.stringify(canonical);
  return cyrb53(serialized);
}

export function shouldSkipFirestoreSummaryWrite(existingMetadata: any, nextMetadata: any): boolean {
  if (!existingMetadata || !nextMetadata) return false;
  const hash1 = existingMetadata.normalized_payload_hash || existingMetadata.normalizedPayloadHash;
  const hash2 = nextMetadata.normalized_payload_hash || nextMetadata.normalizedPayloadHash;
  if (!hash1 || !hash2) return false;
  return hash1 === hash2;
}

export function buildFileSummaryMetadata(input: BuildFileSummaryMetadataInput): FileSummaryMetadata {
  const schemaVersion = input.schemaVersion || SCHEMA_VERSION_V12;
  const promptVersion = input.promptVersion || SUMMARY_ANALYSIS_PROMPT_VERSION;
  const systemInstructionVersion = input.systemInstructionVersion || SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION;

  const struct = (input.structured || {}) as Partial<SummaryAnalysisResultV12>;
  const summaryText = struct.summary?.oneLine || struct.summary?.detailed || struct.titleInfo?.displayTitle?.value || "";

  const metadata: FileSummaryMetadata = {
    file_id: input.fileId,
    file_name: input.fileName || undefined,
    mime_type: input.mimeType || undefined,
    modified_time: input.modifiedTime || undefined,
    parent_id: input.parentId || undefined,
    schema_version: schemaVersion,
    prompt_version: promptVersion,
    system_instruction_version: systemInstructionVersion,
    model: input.model,
    output_mode: "structured",
    summary: summaryText,
    structured: input.structured,
    validation_errors: input.validationErrors || [],
    parse_success: !!input.parseSuccess,
    validation_success: !!input.validationSuccess,
    generated_at: input.generatedAt || new Date().toISOString(),
    source: input.source,
    cache_key: input.cacheKey || undefined,
  };

  const hash = buildNormalizedPayloadHash(input.structured);
  if (hash) {
    metadata.normalized_payload_hash = hash;
  }

  return metadata;
}

export function getFileSummaryDocPath(userId: string, fileId: string): string {
  // Check if either is empty/invalid to prevent path poisoning or bad writes
  if (!userId || !fileId || userId.trim() === "" || fileId.trim() === "") {
    throw new Error("Invalid userId or fileId for path generation");
  }
  return `users/${userId}/file_summaries/${fileId}`;
}

export function isPersistableStructuredSummary(metadata: any): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const fileIdVal = metadata.file_id || metadata.fileId;
  const parseSuccessVal = metadata.parse_success !== undefined ? metadata.parse_success : metadata.parseSuccess;
  const validationSuccessVal = metadata.validation_success !== undefined ? metadata.validation_success : metadata.validationSuccess;
  return !!(
    typeof fileIdVal === "string" &&
    fileIdVal.trim() !== "" &&
    !!parseSuccessVal &&
    !!validationSuccessVal &&
    metadata.structured &&
    typeof metadata.structured === "object"
  );
}

/**
 * Recursively cleans and sanitizes an object for Firestore.
 * It deletes undefined values or replaces them with null, ensuring types are stable.
 */
export function sanitizeSummaryMetadataForFirestore(metadata: any): any {
  if (metadata === undefined) {
    return null;
  }
  if (metadata === null) {
    return null;
  }
  if (Array.isArray(metadata)) {
    return metadata.map(item => sanitizeSummaryMetadataForFirestore(item));
  }
  if (typeof metadata === "object") {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(metadata)) {
      if (val !== undefined) {
        sanitized[key] = sanitizeSummaryMetadataForFirestore(val);
      }
    }
    return sanitized;
  }
  return metadata;
}

export interface SummaryMetadataStatusInput {
  savedMetadata?: any;
  currentSchemaVersion: string;
  currentPromptVersion: string;
  currentSystemInstructionVersion: string;
  currentFileModifiedTime?: string;
}

export function getSummaryMetadataStatus(
  input: SummaryMetadataStatusInput
): "missing" | "current" | "stale-schema" | "stale-prompt" | "stale-file" | "invalid" {
  const {
    savedMetadata,
    currentSchemaVersion,
    currentPromptVersion,
    currentSystemInstructionVersion,
    currentFileModifiedTime,
  } = input;

  if (!savedMetadata) {
    return "missing";
  }

  const fileIdVal = savedMetadata.file_id || savedMetadata.fileId;
  const schemaVersionVal = savedMetadata.schema_version || savedMetadata.schemaVersion;
  const promptVersionVal = savedMetadata.prompt_version || savedMetadata.promptVersion;
  const systemInstructionVersionVal = savedMetadata.system_instruction_version || savedMetadata.systemInstructionVersion;
  const outputModeVal = savedMetadata.output_mode || savedMetadata.outputMode;
  const generatedAtVal = savedMetadata.generated_at || savedMetadata.generatedAt;
  const parseSuccessVal = savedMetadata.parse_success !== undefined ? savedMetadata.parse_success : savedMetadata.parseSuccess;
  const validationSuccessVal = savedMetadata.validation_success !== undefined ? savedMetadata.validation_success : savedMetadata.validationSuccess;
  const modifiedTimeVal = savedMetadata.modified_time || savedMetadata.modifiedTime;

  // Check required fields existence and basic types
  if (
    !fileIdVal ||
    typeof fileIdVal !== "string" ||
    fileIdVal.trim() === "" ||
    !schemaVersionVal ||
    typeof schemaVersionVal !== "string" ||
    !promptVersionVal ||
    typeof promptVersionVal !== "string" ||
    !systemInstructionVersionVal ||
    typeof systemInstructionVersionVal !== "string" ||
    !savedMetadata.model ||
    typeof savedMetadata.model !== "string" ||
    outputModeVal !== "structured" ||
    savedMetadata.summary === undefined ||
    !savedMetadata.structured ||
    typeof savedMetadata.structured !== "object" ||
    !generatedAtVal ||
    !savedMetadata.source
  ) {
    return "invalid";
  }

  // Check validation status
  if (!parseSuccessVal || !validationSuccessVal) {
    return "invalid";
  }

  // Schema version mismatch
  if (schemaVersionVal !== currentSchemaVersion) {
    return "stale-schema";
  }

  // Prompt or system instruction mismatch
  if (
    promptVersionVal !== currentPromptVersion ||
    systemInstructionVersionVal !== currentSystemInstructionVersion
  ) {
    return "stale-prompt";
  }

  // File modifiedTime mismatch (when available on both sides)
  if (
    currentFileModifiedTime &&
    modifiedTimeVal &&
    modifiedTimeVal !== currentFileModifiedTime
  ) {
    return "stale-file";
  }

  return "current";
}

export function getSummaryMetadataStatusReasons(
  input: SummaryMetadataStatusInput
): string[] {
  const {
    savedMetadata,
    currentSchemaVersion,
    currentPromptVersion,
    currentSystemInstructionVersion,
    currentFileModifiedTime,
  } = input;

  if (!savedMetadata) {
    return ["要約データが存在しません"];
  }

  const reasons: string[] = [];

  const fileIdVal = savedMetadata.file_id || savedMetadata.fileId;
  const schemaVersionVal = savedMetadata.schema_version || savedMetadata.schemaVersion;
  const promptVersionVal = savedMetadata.prompt_version || savedMetadata.promptVersion;
  const systemInstructionVersionVal = savedMetadata.system_instruction_version || savedMetadata.systemInstructionVersion;
  const outputModeVal = savedMetadata.output_mode || savedMetadata.outputMode;
  const generatedAtVal = savedMetadata.generated_at || savedMetadata.generatedAt;
  const parseSuccessVal = savedMetadata.parse_success !== undefined ? savedMetadata.parse_success : savedMetadata.parseSuccess;
  const validationSuccessVal = savedMetadata.validation_success !== undefined ? savedMetadata.validation_success : savedMetadata.validationSuccess;
  const modifiedTimeVal = savedMetadata.modified_time || savedMetadata.modifiedTime;

  // Check required fields existence and basic types
  if (
    !fileIdVal ||
    typeof fileIdVal !== "string" ||
    fileIdVal.trim() === "" ||
    !schemaVersionVal ||
    typeof schemaVersionVal !== "string" ||
    !promptVersionVal ||
    typeof promptVersionVal !== "string" ||
    !systemInstructionVersionVal ||
    typeof systemInstructionVersionVal !== "string" ||
    !savedMetadata.model ||
    typeof savedMetadata.model !== "string" ||
    outputModeVal !== "structured" ||
    savedMetadata.summary === undefined ||
    !savedMetadata.structured ||
    typeof savedMetadata.structured !== "object" ||
    !generatedAtVal ||
    !savedMetadata.source
  ) {
    reasons.push("必須フィールドが不足しているか、無効なデータ形式です。");
    return reasons; // Return early because other checks might crash if fields are missing
  }

  // Check validation status
  if (!parseSuccessVal) {
    reasons.push("JSON構造のパース処理に失敗しています。");
  }
  if (!validationSuccessVal) {
    reasons.push("スキーマのバリデーションに失敗しています。");
  }

  // Schema version mismatch
  if (schemaVersionVal !== currentSchemaVersion) {
    reasons.push(`スキーマバージョン不一致 (保存: ${schemaVersionVal} / 現在: ${currentSchemaVersion})`);
  }

  // Prompt or system instruction mismatch
  if (promptVersionVal !== currentPromptVersion) {
    reasons.push(`分析プロンプトバージョン不一致 (保存: ${promptVersionVal} / 現在: ${currentPromptVersion})`);
  }
  if (systemInstructionVersionVal !== currentSystemInstructionVersion) {
    reasons.push(`システム指示バージョン不一致 (保存: ${systemInstructionVersionVal} / 現在: ${currentSystemInstructionVersion})`);
  }

  // File modifiedTime mismatch
  if (
    currentFileModifiedTime &&
    modifiedTimeVal &&
    modifiedTimeVal !== currentFileModifiedTime
  ) {
    reasons.push(`Driveファイル更新検知 (保存された更新日時: ${new Date(modifiedTimeVal).toLocaleString()} / 最新の更新日時: ${new Date(currentFileModifiedTime).toLocaleString()})`);
  }

  return reasons;
}

