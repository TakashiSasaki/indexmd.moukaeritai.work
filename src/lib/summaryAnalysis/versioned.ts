export function getStructuredSummaryDisplaySummary(value: any): string {
  if (!value) return "";
  return value.summary?.oneLine || value.summary?.detailed || value.titleInfo?.displayTitle?.value || "";
}

export function getStructuredSummaryDisplayTitle(value: any): string {
  if (!value) return "";
  return value.titleInfo?.displayTitle?.value || "";
}

export function getStructuredSummaryTopicLabels(value: any): string[] {
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

export function getStructuredSummaryKeywordLabels(value: any): string[] {
  if (!value || !value.indexing || !Array.isArray(value.indexing.keywords)) return [];
  return value.indexing.keywords.map((kw: any) => kw.value).filter(Boolean);
}
