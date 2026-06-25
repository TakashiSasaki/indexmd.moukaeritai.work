import { 
  validateSummaryAnalysisResult as validateLegacy, 
  getSummaryAnalysisValidationErrors as getLegacyErrors, 
  normalizeSummaryAnalysisResult as normalizeLegacy 
} from "../summaryAnalysisSchema";
import { 
  validateSummaryAnalysisV12, 
  getSummaryAnalysisV12ValidationErrors 
} from "./validate";
import { 
  normalizeSummaryAnalysisV12 
} from "./normalize";

export const SCHEMA_VERSION_V11 = "1.1.0-draft.1";
export const SCHEMA_VERSION_V12_DRAFT2 = "1.2.0-draft.2";
export const SCHEMA_VERSION_V12 = SCHEMA_VERSION_V12_DRAFT2;

export function isSummaryAnalysisV12Draft2(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  return (
    (value.schemaVersion === SCHEMA_VERSION_V12_DRAFT2) ||
    (value.summary && typeof value.summary === "object" && ("oneLine" in value.summary || "detailed" in value.summary))
  );
}

export function isLegacySummaryAnalysis(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  return (
    (value.schemaVersion === SCHEMA_VERSION_V11) ||
    ("oneLineSummary" in value)
  );
}

export function normalizeStructuredSummaryByVersion(value: any, version?: string): any {
  if (version === SCHEMA_VERSION_V12_DRAFT2 || (!version && isSummaryAnalysisV12Draft2(value))) {
    return normalizeSummaryAnalysisV12(value);
  }
  return normalizeLegacy(value);
}

export function validateStructuredSummaryByVersion(value: any, version?: string): boolean {
  if (version === SCHEMA_VERSION_V12_DRAFT2 || (!version && isSummaryAnalysisV12Draft2(value))) {
    return validateSummaryAnalysisV12(value);
  }
  return validateLegacy(value);
}

export function getStructuredSummaryValidationErrorsByVersion(value: any, version?: string): string[] {
  if (version === SCHEMA_VERSION_V12_DRAFT2 || (!version && isSummaryAnalysisV12Draft2(value))) {
    return getSummaryAnalysisV12ValidationErrors(value);
  }
  return getLegacyErrors(value);
}

export function getStructuredSummaryDisplaySummary(value: any, version?: string): string {
  if (!value) return "";
  if (version === SCHEMA_VERSION_V12_DRAFT2 || (!version && isSummaryAnalysisV12Draft2(value))) {
    return value.summary?.oneLine || value.summary?.detailed || value.titleInfo?.displayTitle?.value || "";
  }
  return value.oneLineSummary || value.detailedSummary || "";
}
