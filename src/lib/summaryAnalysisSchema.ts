export const SUMMARY_ANALYSIS_SCHEMA_VERSION = "1.1.0-draft.1";

// This is an experimental schema intended for AI Summary Test validation,
// not a final stable schema.

export const DOCUMENT_TYPES = [
  "note", "report", "specification", "manual", "academicPaper", "abstract",
  "summary", "receipt", "invoice", "contract", "cancellationNotice",
  "applicationForm", "certificate", "bookmark", "correspondence",
  "meetingNotes", "taskList", "sourceCode", "dataset", "log", "config", "unknown"
];

export const DOCUMENT_INTENTS = [
  "inform", "record", "request", "apply", "cancel", "confirm",
  "pay", "claim", "report", "explain", "specify", "summarize", "bookmark", "unknown"
];

export const NAMED_ENTITY_TYPES = [
  "person", "organization", "location", "artifact", "initiative", "unclassified"
];

export const TEMPORAL_REFERENCE_ROLES = [
  "created", "updated", "issued", "submitted", "due", "effective",
  "expires", "eventDate", "published", "accessed", "unknown"
];

export const PARTY_ROLES = [
  "author", "issuer", "recipient", "applicant", "approver", "payer",
  "payee", "seller", "buyer", "contractParty", "publisher", "unknown"
];

export const PARTY_KINDS = [
  "person", "organization", "unknown"
];

export const MONETARY_AMOUNT_ROLES = [
  "total", "subtotal", "tax", "fee", "discount", "unitPrice", "unknown"
];

export const SUBJECT_AREAS_MAP: Record<string, string[]> = {
  mathematics: ["analysis", "algebra", "foundations", "logic", "categoryTheory", "topology", "geometry", "numberTheory", "probability", "statistics", "appliedMathematics", "other"],
  physics: ["classicalMechanics", "quantumMechanics", "relativity", "statisticalMechanics", "thermodynamics", "electromagnetism", "condensedMatter", "particlePhysics", "astrophysics", "other"],
  biology: ["molecularBiology", "genetics", "cellBiology", "ecology", "evolution", "neuroscience", "physiology", "bioinformatics", "other"],
  computerScience: ["algorithms", "programmingLanguages", "softwareEngineering", "databases", "ai", "machineLearning", "networks", "security", "humanComputerInteraction", "formalMethods", "other"],
  socialSciences: ["sociology", "economics", "politicalScience", "anthropology", "psychology", "education", "law", "other"],
  humanities: ["philosophy", "history", "linguistics", "literature", "religiousStudies", "artHistory", "ethics", "other"],
  engineering: ["electricalEngineering", "mechanicalEngineering", "civilEngineering", "chemicalEngineering", "systemsEngineering", "materialsEngineering", "other"]
};

export const SUMMARY_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    oneLineSummary: { type: "string" },
    detailedSummary: { type: "string" },
    title: { type: "string" },
    inferredTitle: { type: "string" },
    documentTypes: { type: "array", items: { type: "string", enum: DOCUMENT_TYPES } },
    documentIntent: { type: "string", enum: DOCUMENT_INTENTS },
    topics: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    namedEntities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: NAMED_ENTITY_TYPES }
        },
        required: ["name", "type"]
      }
    },
    resourceReferences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          uri: { type: "string" },
          raw: { type: "string" }
        },
        required: ["uri"]
      }
    },
    primaryLanguage: { type: "string" },
    languages: { type: "array", items: { type: "string" } },
    temporalReferences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          role: { type: "string", enum: TEMPORAL_REFERENCE_ROLES },
          raw: { type: "string" }
        },
        required: ["date", "role", "raw"]
      }
    },
    parties: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string", enum: PARTY_ROLES },
          kind: { type: "string", enum: PARTY_KINDS }
        },
        required: ["name", "role", "kind"]
      }
    },
    monetaryAmounts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
          role: { type: "string", enum: MONETARY_AMOUNT_ROLES },
          raw: { type: "string" }
        },
        required: ["amount", "currency", "role", "raw"]
      }
    },
    subjectAreas: {
      type: "object",
      properties: {
        mathematics: { type: "array", items: { type: "string", enum: SUBJECT_AREAS_MAP.mathematics } },
        physics: { type: "array", items: { type: "string", enum: SUBJECT_AREAS_MAP.physics } },
        biology: { type: "array", items: { type: "string", enum: SUBJECT_AREAS_MAP.biology } },
        computerScience: { type: "array", items: { type: "string", enum: SUBJECT_AREAS_MAP.computerScience } },
        socialSciences: { type: "array", items: { type: "string", enum: SUBJECT_AREAS_MAP.socialSciences } },
        humanities: { type: "array", items: { type: "string", enum: SUBJECT_AREAS_MAP.humanities } },
        engineering: { type: "array", items: { type: "string", enum: SUBJECT_AREAS_MAP.engineering } }
      }
    },
    confidence: { type: "number" },
    warnings: { type: "array", items: { type: "string" } }
  },
  required: [
    "oneLineSummary", 
    "detailedSummary", 
    "title", 
    "inferredTitle", 
    "documentTypes", 
    "documentIntent", 
    "topics", 
    "keywords", 
    "namedEntities", 
    "resourceReferences", 
    "primaryLanguage", 
    "languages", 
    "temporalReferences", 
    "parties", 
    "monetaryAmounts", 
    "subjectAreas", 
    "confidence", 
    "warnings"
  ]
};

export function normalizeSummaryAnalysisResult(value: any): any {
  if (!value || typeof value !== "object") return value;

  const result = { ...value };

  // Helper to deduplicate string arrays
  const dedup = (arr: any) => {
    if (!Array.isArray(arr)) return arr;
    return Array.from(new Set(arr.filter(x => typeof x === "string" && x.trim() !== "").map(x => x.trim())));
  };

  if (typeof result.oneLineSummary === "string") result.oneLineSummary = result.oneLineSummary.trim();
  if (typeof result.detailedSummary === "string") result.detailedSummary = result.detailedSummary.trim();
  if (typeof result.title === "string") result.title = result.title.trim();
  if (typeof result.inferredTitle === "string") result.inferredTitle = result.inferredTitle.trim();
  if (typeof result.documentIntent === "string") result.documentIntent = result.documentIntent.trim();
  if (typeof result.primaryLanguage === "string") result.primaryLanguage = result.primaryLanguage.trim();

  if (Array.isArray(result.documentTypes)) result.documentTypes = dedup(result.documentTypes);
  if (Array.isArray(result.topics)) result.topics = dedup(result.topics);
  if (Array.isArray(result.keywords)) result.keywords = dedup(result.keywords);
  if (Array.isArray(result.languages)) result.languages = dedup(result.languages);
  if (Array.isArray(result.warnings)) result.warnings = dedup(result.warnings);

  if (Array.isArray(result.resourceReferences)) {
    result.resourceReferences = result.resourceReferences.map((r: any) => {
      if (!r || typeof r !== "object") return r;
      const cleanR = { ...r };
      if (typeof cleanR.uri === "string") cleanR.uri = cleanR.uri.trim();
      if (typeof cleanR.raw === "string") cleanR.raw = cleanR.raw.trim();
      if (cleanR.raw === "") delete cleanR.raw;
      return cleanR;
    });
  }

  if (result.subjectAreas && typeof result.subjectAreas === "object") {
    const cleanSA: Record<string, string[]> = {};
    for (const key of Object.keys(result.subjectAreas)) {
      if (SUBJECT_AREAS_MAP[key]) {
        const arr = dedup(result.subjectAreas[key]);
        if (arr.length > 0) {
          cleanSA[key] = arr;
        }
      }
    }
    result.subjectAreas = cleanSA;
  } else {
    result.subjectAreas = {};
  }

  return result;
}

export function getSummaryAnalysisValidationErrors(value: any): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object") {
    errors.push("Result is not an object");
    return errors;
  }
  
  if (typeof value.oneLineSummary !== "string" || value.oneLineSummary.trim() === "") errors.push("oneLineSummary must be a non-empty string");
  if (typeof value.detailedSummary !== "string") errors.push("detailedSummary must be a string");
  if (typeof value.title !== "string") errors.push("title must be a string");
  if (typeof value.inferredTitle !== "string") errors.push("inferredTitle must be a string");
  if (typeof value.documentIntent !== "string" || !DOCUMENT_INTENTS.includes(value.documentIntent)) errors.push(`documentIntent is invalid: ${value.documentIntent}`);
  if (typeof value.primaryLanguage !== "string" || value.primaryLanguage.trim() === "") errors.push("primaryLanguage must be a non-empty string");
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) errors.push("confidence must be a number between 0 and 1");

  if (!Array.isArray(value.documentTypes) || value.documentTypes.length === 0) {
    errors.push("documentTypes must be a non-empty array");
  } else {
    for (const dt of value.documentTypes) {
      if (typeof dt !== "string" || !DOCUMENT_TYPES.includes(dt)) errors.push(`Invalid documentType: ${dt}`);
    }
    if (value.documentTypes.includes("unknown") && value.documentTypes.length > 1) {
      errors.push("If documentTypes contains 'unknown', it must be the only value");
    }
  }

  if (!Array.isArray(value.topics)) errors.push("topics must be an array");
  else {
    for (const t of value.topics) if (typeof t !== "string") errors.push("Topic items must be strings");
  }

  if (!Array.isArray(value.keywords)) errors.push("keywords must be an array");
  else {
    for (const k of value.keywords) if (typeof k !== "string") errors.push("Keyword items must be strings");
  }

  if (!Array.isArray(value.languages)) errors.push("languages must be an array");
  else {
    for (const l of value.languages) if (typeof l !== "string") errors.push("Language items must be strings");
  }

  if (!Array.isArray(value.warnings)) errors.push("warnings must be an array");
  else {
    for (const w of value.warnings) if (typeof w !== "string") errors.push("Warning items must be strings");
  }

  if (!Array.isArray(value.namedEntities)) errors.push("namedEntities must be an array");
  else {
    for (const ne of value.namedEntities) {
      if (!ne || typeof ne !== "object") errors.push("namedEntities item must be an object");
      else {
        if (typeof ne.name !== "string" || ne.name.trim() === "") errors.push("namedEntity name must be a non-empty string");
        if (typeof ne.type !== "string" || !NAMED_ENTITY_TYPES.includes(ne.type)) errors.push(`namedEntity type invalid: ${ne.type}`);
      }
    }
  }

  const uriRegex = /^[A-Za-z][A-Za-z0-9+.-]*:/;
  if (!Array.isArray(value.resourceReferences)) errors.push("resourceReferences must be an array");
  else {
    for (const rr of value.resourceReferences) {
      if (!rr || typeof rr !== "object") errors.push("resourceReferences item must be an object");
      else {
        if (typeof rr.uri !== "string" || rr.uri.trim() === "" || !uriRegex.test(rr.uri)) errors.push(`resourceReference uri invalid: ${rr.uri}`);
        if (rr.raw !== undefined && typeof rr.raw !== "string") errors.push("resourceReference raw must be a string if provided");
      }
    }
  }

  if (!Array.isArray(value.temporalReferences)) errors.push("temporalReferences must be an array");
  else {
    for (const tr of value.temporalReferences) {
      if (!tr || typeof tr !== "object") errors.push("temporalReferences item must be an object");
      else {
        if (typeof tr.date !== "string") errors.push("temporalReference date must be a string");
        if (typeof tr.role !== "string" || !TEMPORAL_REFERENCE_ROLES.includes(tr.role)) errors.push(`temporalReference role invalid: ${tr.role}`);
        if (typeof tr.raw !== "string" || tr.raw.trim() === "") errors.push("temporalReference raw must be a non-empty string");
      }
    }
  }

  if (!Array.isArray(value.parties)) errors.push("parties must be an array");
  else {
    for (const pt of value.parties) {
      if (!pt || typeof pt !== "object") errors.push("parties item must be an object");
      else {
        if (typeof pt.name !== "string" || pt.name.trim() === "") errors.push("party name must be a non-empty string");
        if (typeof pt.role !== "string" || !PARTY_ROLES.includes(pt.role)) errors.push(`party role invalid: ${pt.role}`);
        if (typeof pt.kind !== "string" || !PARTY_KINDS.includes(pt.kind)) errors.push(`party kind invalid: ${pt.kind}`);
      }
    }
  }

  if (!Array.isArray(value.monetaryAmounts)) errors.push("monetaryAmounts must be an array");
  else {
    for (const ma of value.monetaryAmounts) {
      if (!ma || typeof ma !== "object") errors.push("monetaryAmounts item must be an object");
      else {
        if (typeof ma.amount !== "number" || !Number.isFinite(ma.amount)) errors.push("monetaryAmount amount must be a finite number");
        if (typeof ma.currency !== "string") errors.push("monetaryAmount currency must be a string");
        if (typeof ma.role !== "string" || !MONETARY_AMOUNT_ROLES.includes(ma.role)) errors.push(`monetaryAmount role invalid: ${ma.role}`);
        if (typeof ma.raw !== "string" || ma.raw.trim() === "") errors.push("monetaryAmount raw must be a non-empty string");
      }
    }
  }

  if (!value.subjectAreas || typeof value.subjectAreas !== "object") errors.push("subjectAreas must be an object");
  else {
    for (const key of Object.keys(value.subjectAreas)) {
      if (!SUBJECT_AREAS_MAP[key]) errors.push(`subjectAreas unknown domain: ${key}`);
      else {
        const arr = value.subjectAreas[key];
        if (!Array.isArray(arr) || arr.length === 0) errors.push(`subjectAreas domain ${key} must have a non-empty array`);
        else {
          for (const item of arr) {
            if (typeof item !== "string" || !SUBJECT_AREAS_MAP[key].includes(item)) errors.push(`subjectAreas invalid topic in ${key}: ${item}`);
          }
        }
      }
    }
  }

  return errors;
}

export function validateSummaryAnalysisResult(value: any): boolean {
  return getSummaryAnalysisValidationErrors(value).length === 0;
}
