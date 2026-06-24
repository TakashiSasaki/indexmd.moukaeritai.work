export const SUMMARY_ANALYSIS_SCHEMA_VERSION = "1.0.0";

export const SUMMARY_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    oneLineSummary: { type: "string", description: "1-sentence Japanese description suitable for index.md" },
    detailedSummary: { type: "string", description: "Detailed summary in Japanese" },
    keywords: { type: "array", items: { type: "string" }, description: "Important keywords extracted from the document" },
    urls: { type: "array", items: { type: "string" }, description: "URLs explicitly present in the document" },
    namedEntities: {
      type: "object",
      properties: {
        people: { type: "array", items: { type: "string" } },
        organizations: { type: "array", items: { type: "string" } },
        places: { type: "array", items: { type: "string" } },
        products: { type: "array", items: { type: "string" } },
        projects: { type: "array", items: { type: "string" } }
      },
      required: ["people", "organizations", "places", "products", "projects"]
    },
    documentType: { type: "string", description: "Estimated document type (e.g., meeting notes, invoice, code, image)" },
    language: { type: "string", description: "Primary language of the document" },
    confidence: { type: "number", description: "Confidence score from 0.0 to 1.0" }
  },
  required: [
    "oneLineSummary", 
    "detailedSummary", 
    "keywords", 
    "urls", 
    "namedEntities", 
    "documentType", 
    "language", 
    "confidence"
  ]
};

export function validateSummaryAnalysisResult(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  
  if (typeof value.oneLineSummary !== "string") return false;
  if (typeof value.detailedSummary !== "string") return false;
  if (!Array.isArray(value.keywords)) return false;
  if (!Array.isArray(value.urls)) return false;
  
  const ne = value.namedEntities;
  if (!ne || typeof ne !== "object") return false;
  if (!Array.isArray(ne.people) || !Array.isArray(ne.organizations) || 
      !Array.isArray(ne.places) || !Array.isArray(ne.products) || 
      !Array.isArray(ne.projects)) {
    return false;
  }

  if (typeof value.documentType !== "string") return false;
  if (typeof value.language !== "string") return false;
  if (typeof value.confidence !== "number") return false;

  return true;
}
