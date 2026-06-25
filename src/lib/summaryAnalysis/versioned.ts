import { 
  validateSummaryAnalysisV12, 
  getSummaryAnalysisV12ValidationErrors 
} from "./validate";
import { 
  normalizeSummaryAnalysisV12 
} from "./normalize";

export const SCHEMA_VERSION_V12 = "1.2.0-draft.2";

export function isSummaryAnalysisV12Draft2(value: any): boolean {
  return true; // Abolished legacy schema, everything is v12 draft.2 now
}

export function getStructuredSummaryDisplaySummary(value: any): string {
  return getStructuredSummaryDisplaySummaryV12(value);
}

export function getStructuredSummaryDisplaySummaryV12(value: any): string {
  if (!value) return "";
  return value.summary?.oneLine || value.summary?.detailed || value.titleInfo?.displayTitle?.value || "";
}

export function getStructuredSummaryDisplayTitleV12(value: any): string {
  if (!value) return "";
  return value.titleInfo?.displayTitle?.value || "";
}

export function getStructuredSummaryTopicLabelsV12(value: any): string[] {
  if (!value || !value.subjectAreas || !Array.isArray(value.subjectAreas.domains)) return [];
  const labels: string[] = [];
  for (const dom of value.subjectAreas.domains) {
    if (dom.labels && Array.isArray(dom.labels)) {
      for (const lbl of dom.labels) {
        if (lbl.kind === "topic" && lbl.label) {
          labels.push(lbl.label);
        }
      }
    }
  }
  return labels;
}

export function getStructuredSummaryKeywordLabelsV12(value: any): string[] {
  if (!value || !value.indexing || !Array.isArray(value.indexing.keywords)) return [];
  return value.indexing.keywords.map((kw: any) => kw.value).filter(Boolean);
}
