/**
 * Saved Summaries Browser helper functions.
 */

export function sortSavedSummariesByGeneratedAt(summaries: any[]): any[] {
  return [...summaries].sort((a, b) => {
    const dateA = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
    const dateB = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
    
    // Fallback if Date parsing fails (NaN check)
    const timeA = isNaN(dateA) ? 0 : dateA;
    const timeB = isNaN(dateB) ? 0 : dateB;
    
    return timeB - timeA; // Descending order
  });
}

export function filterSavedSummaries(
  summaries: any[],
  searchTerm: string,
  statusFilter: string,
  typeFilter: string,
  subjectAreaFilter: string = "all"
): any[] {
  return summaries.filter(item => {
    // 1. Text Search Filter (fileName, summary, model)
    if (searchTerm && searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const name = (item.fileName || "").toLowerCase();
      const sum = (item.summary || "").toLowerCase();
      const mdl = (item.model || "").toLowerCase();
      
      if (!name.includes(term) && !sum.includes(term) && !mdl.includes(term)) {
        return false;
      }
    }

    // 2. Status Filter
    if (statusFilter && statusFilter !== "all") {
      if (item.computedStatus !== statusFilter) {
        return false;
      }
    }

    // 3. Document Type Filter
    if (typeFilter && typeFilter !== "all") {
      const docTypes = item.structured?.documentTypes || [];
      if (!docTypes.includes(typeFilter)) {
        return false;
      }
    }

    // 4. Subject Area Filter (if simple)
    if (subjectAreaFilter && subjectAreaFilter !== "all") {
      const subjectAreas = item.structured?.subjectAreas || {};
      const subjectKeys = Object.keys(subjectAreas);
      if (!subjectKeys.includes(subjectAreaFilter)) {
        return false;
      }
    }

    return true;
  });
}

export function summarizeSubjectAreas(subjectAreas: any): string {
  if (!subjectAreas || typeof subjectAreas !== "object") return "なし";
  
  const entries = Object.entries(subjectAreas)
    .filter(([_, list]) => Array.isArray(list) && list.length > 0)
    .map(([key, list]) => {
      const items = (list as string[]).join(", ");
      return `${key}: [${items}]`;
    });
    
  return entries.length > 0 ? entries.join(" | ") : "なし";
}

export function getDocumentTypeOptions(summaries: any[]): string[] {
  const typesSet = new Set<string>();
  summaries.forEach(s => {
    const docTypes = s.structured?.documentTypes;
    if (Array.isArray(docTypes)) {
      docTypes.forEach((t: any) => {
        if (typeof t === "string" && t.trim() !== "") {
          typesSet.add(t.trim());
        }
      });
    }
  });
  return Array.from(typesSet).sort();
}

export function getSubjectAreaOptions(summaries: any[]): string[] {
  const subjectsSet = new Set<string>();
  summaries.forEach(s => {
    const subjectAreas = s.structured?.subjectAreas;
    if (subjectAreas && typeof subjectAreas === "object") {
      Object.keys(subjectAreas).forEach(k => {
        if (k.trim() !== "") {
          subjectsSet.add(k.trim());
        }
      });
    }
  });
  return Array.from(subjectsSet).sort();
}

/**
 * Sanitizes a saved summary object before copying to clipboard or exporting,
 * ensuring no tokens, secrets, raw outputs, or raw contents are included.
 */
export function sanitizeSavedSummaryForClipboard(summary: any): any {
  if (!summary || typeof summary !== "object") return {};
  
  // Make a shallow clone and explicitly omit sensitive keys
  const {
    // Exclude security & raw output fields
    rawOutput,
    rawContent,
    accessToken,
    refreshToken,
    token,
    authCode,
    api_key,
    apiKey,
    
    // Also omit internal react state IDs if applicable
    id,
    
    ...safeFields
  } = summary;

  // Let's also verify inside structured to make sure there are no accidental nested raw fields
  if (safeFields.structured && typeof safeFields.structured === "object") {
    const { rawOutput: nestedRaw, ...safeStructured } = safeFields.structured;
    safeFields.structured = safeStructured;
  }

  return safeFields;
}
