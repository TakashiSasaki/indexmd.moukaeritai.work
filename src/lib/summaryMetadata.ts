import { SUMMARY_ANALYSIS_SCHEMA_VERSION } from "./summaryAnalysisSchema";
import { SUMMARY_ANALYSIS_PROMPT_VERSION, SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION } from "./promptSpecs";
import { SummaryAnalysisResult } from "../types";

export interface FileSummaryMetadata {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  modifiedTime?: string;
  parentId?: string;
  schemaVersion: string;
  promptVersion: string;
  systemInstructionVersion: string;
  model: string;
  outputMode: "structured";
  summary: string;
  structured: SummaryAnalysisResult;
  validationErrors: string[];
  parseSuccess: boolean;
  validationSuccess: boolean;
  generatedAt: string;
  source: "ai-summary-test" | "drive-debugger" | "future-indexing";
  cacheKey?: string;
}

export interface BuildFileSummaryMetadataInput {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  modifiedTime?: string;
  parentId?: string;
  model: string;
  structured: SummaryAnalysisResult;
  validationErrors: string[];
  parseSuccess: boolean;
  validationSuccess: boolean;
  source: "ai-summary-test" | "drive-debugger" | "future-indexing";
  cacheKey?: string;
  generatedAt?: string;
}

export function buildFileSummaryMetadata(input: BuildFileSummaryMetadataInput): FileSummaryMetadata {
  // Use oneLineSummary as default summary, fallback to detailedSummary, then empty string
  const summaryText = input.structured?.oneLineSummary || input.structured?.detailedSummary || "";

  return {
    fileId: input.fileId,
    fileName: input.fileName || undefined,
    mimeType: input.mimeType || undefined,
    modifiedTime: input.modifiedTime || undefined,
    parentId: input.parentId || undefined,
    schemaVersion: SUMMARY_ANALYSIS_SCHEMA_VERSION,
    promptVersion: SUMMARY_ANALYSIS_PROMPT_VERSION,
    systemInstructionVersion: SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION,
    model: input.model,
    outputMode: "structured",
    summary: summaryText,
    structured: input.structured,
    validationErrors: input.validationErrors || [],
    parseSuccess: !!input.parseSuccess,
    validationSuccess: !!input.validationSuccess,
    generatedAt: input.generatedAt || new Date().toISOString(),
    source: input.source,
    cacheKey: input.cacheKey || undefined,
  };
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
  return !!(
    typeof metadata.fileId === "string" &&
    metadata.fileId.trim() !== "" &&
    !!metadata.parseSuccess &&
    !!metadata.validationSuccess &&
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

  // Check required fields existence and basic types
  if (
    !savedMetadata.fileId ||
    typeof savedMetadata.fileId !== "string" ||
    savedMetadata.fileId.trim() === "" ||
    !savedMetadata.schemaVersion ||
    typeof savedMetadata.schemaVersion !== "string" ||
    !savedMetadata.promptVersion ||
    typeof savedMetadata.promptVersion !== "string" ||
    !savedMetadata.systemInstructionVersion ||
    typeof savedMetadata.systemInstructionVersion !== "string" ||
    !savedMetadata.model ||
    typeof savedMetadata.model !== "string" ||
    savedMetadata.outputMode !== "structured" ||
    savedMetadata.summary === undefined ||
    !savedMetadata.structured ||
    typeof savedMetadata.structured !== "object" ||
    !savedMetadata.generatedAt ||
    !savedMetadata.source
  ) {
    return "invalid";
  }

  // Check validation status
  if (!savedMetadata.parseSuccess || !savedMetadata.validationSuccess) {
    return "invalid";
  }

  // Schema version mismatch
  if (savedMetadata.schemaVersion !== currentSchemaVersion) {
    return "stale-schema";
  }

  // Prompt or system instruction mismatch
  if (
    savedMetadata.promptVersion !== currentPromptVersion ||
    savedMetadata.systemInstructionVersion !== currentSystemInstructionVersion
  ) {
    return "stale-prompt";
  }

  // File modifiedTime mismatch (when available on both sides)
  if (
    currentFileModifiedTime &&
    savedMetadata.modifiedTime &&
    savedMetadata.modifiedTime !== currentFileModifiedTime
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

  // Check required fields existence and basic types
  if (
    !savedMetadata.fileId ||
    typeof savedMetadata.fileId !== "string" ||
    savedMetadata.fileId.trim() === "" ||
    !savedMetadata.schemaVersion ||
    typeof savedMetadata.schemaVersion !== "string" ||
    !savedMetadata.promptVersion ||
    typeof savedMetadata.promptVersion !== "string" ||
    !savedMetadata.systemInstructionVersion ||
    typeof savedMetadata.systemInstructionVersion !== "string" ||
    !savedMetadata.model ||
    typeof savedMetadata.model !== "string" ||
    savedMetadata.outputMode !== "structured" ||
    savedMetadata.summary === undefined ||
    !savedMetadata.structured ||
    typeof savedMetadata.structured !== "object" ||
    !savedMetadata.generatedAt ||
    !savedMetadata.source
  ) {
    reasons.push("必須フィールドが不足しているか、無効なデータ形式です。");
    return reasons; // Return early because other checks might crash if fields are missing
  }

  // Check validation status
  if (!savedMetadata.parseSuccess) {
    reasons.push("JSON構造のパース処理に失敗しています。");
  }
  if (!savedMetadata.validationSuccess) {
    reasons.push("スキーマのバリデーションに失敗しています。");
  }

  // Schema version mismatch
  if (savedMetadata.schemaVersion !== currentSchemaVersion) {
    reasons.push(`スキーマバージョン不一致 (保存: ${savedMetadata.schemaVersion} / 現在: ${currentSchemaVersion})`);
  }

  // Prompt or system instruction mismatch
  if (savedMetadata.promptVersion !== currentPromptVersion) {
    reasons.push(`分析プロンプトバージョン不一致 (保存: ${savedMetadata.promptVersion} / 現在: ${currentPromptVersion})`);
  }
  if (savedMetadata.systemInstructionVersion !== currentSystemInstructionVersion) {
    reasons.push(`システム指示バージョン不一致 (保存: ${savedMetadata.systemInstructionVersion} / 現在: ${currentSystemInstructionVersion})`);
  }

  // File modifiedTime mismatch
  if (
    currentFileModifiedTime &&
    savedMetadata.modifiedTime &&
    savedMetadata.modifiedTime !== currentFileModifiedTime
  ) {
    reasons.push(`Driveファイル更新検知 (保存された更新日時: ${new Date(savedMetadata.modifiedTime).toLocaleString()} / 最新の更新日時: ${new Date(currentFileModifiedTime).toLocaleString()})`);
  }

  return reasons;
}

