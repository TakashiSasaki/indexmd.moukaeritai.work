import { test } from "node:test";
import assert from "node:assert";
import { SUMMARY_ANALYSIS_SCHEMA_V12 } from "./schema.js";
import {
  DOCUMENT_KINDS,
  DOCUMENT_KINDS_JSON,
  SUBJECT_DOMAINS,
  SUBJECT_DOMAINS_JSON,
  SUBJECT_LABEL_KINDS,
  SUBJECT_LABEL_KINDS_JSON,
  TEMPORAL_ROLE_CATEGORIES,
  PARTY_KINDS,
  PARTY_ROLE_CATEGORIES,
  MONETARY_ROLE_CATEGORIES,
  EXTRACTION_ROLE_CATEGORIES_JSON
} from "./vocabularies.js";
import { getSummaryAnalysisV12ValidationErrors, validateSummaryAnalysisV12 } from "./validate.js";
import { normalizeSummaryAnalysisV12 } from "./normalize.js";
import {
  minimalExample,
  japaneseMixedExample
} from "./examples.js";

// Helper to get a valid base v1.2 object for mutation testing
function getValidV12Base(): any {
  return {
    summary: {
      oneLine: "This is a one line summary of the document.",
      detailed: "This is a detailed summary of the document contents."
    },
    titleInfo: {
      explicitTitle: null,
      fileNameTitle: {
        value: "file.pdf",
        isGeneric: false
      },
      inferredTitle: "Inferred Document Title",
      displayTitle: {
        value: "Inferred Document Title",
        source: "inferredTitle",
        reason: "Chose inferred title because explicit title is not available."
      }
    },
    documentKindInfo: {
      vocabularyVersion: "1.0.0-draft.1",
      kinds: [
        {
          kind: "report",
          confidence: 0.9,
          reason: "Contains standard report structure."
        }
      ]
    },
    fileFormatInfo: {
      mimeType: "application/pdf",
      extension: "pdf"
    },
    subjectAreas: {
      vocabularyVersion: "1.0.0-draft.1",
      domains: [
        {
          domain: "computerScience",
          confidence: 0.95,
          reason: "Discusses software systems.",
          labels: [
            {
              label: "TypeScript",
              kind: "topic",
              confidence: 0.9,
              source: "controlledVocabulary"
            }
          ]
        }
      ]
    },
    languageInfo: {
      primary: "en",
      detected: ["en"]
    },
    indexing: {
      keywords: [
        {
          value: "testing",
          source: "body",
          confidence: 0.95,
          importance: 0.9,
          language: "en",
          script: "Latn",
          normalizedValue: "testing",
          searchVariants: [
            {
              value: "test",
              relation: "stem",
              language: "en",
              script: "Latn",
              confidence: 0.99
            }
          ]
        },
        {
          value: "validation",
          source: "heading",
          confidence: 0.95,
          importance: 0.85,
          searchVariants: []
        }
      ],
      namedEntities: [
        {
          name: "Blue Co.",
          type: "organization"
        }
      ],
      resourceReferences: [
        {
          uri: "https://example.com/spec",
          label: "Spec link",
          raw: "Page 4"
        }
      ]
    },
    extractedFacts: {
      temporalReferences: [
        {
          value: "2026-06-25",
          normalizedDate: "2026-06-25",
          role: "effective",
          roleCategory: "validity",
          raw: "Effective Date",
          confidence: 0.95
        }
      ],
      parties: [
        {
          name: "John Doe",
          kind: "person",
          roles: [
            {
              role: "author",
              roleCategory: "authorship",
              confidence: 0.9
            }
          ]
        }
      ],
      monetaryAmounts: [
        {
          amount: 50.0,
          currency: "USD",
          role: "total",
          roleCategory: "payment",
          raw: "$50",
          confidence: 0.95
        }
      ]
    },
    quality: {
      confidence: 0.9,
      warnings: []
    }
  };
}

// 1. JSON Schema Loading Tests
test("v1.2: JSON Schema is loaded and parses correctly", () => {
  assert.ok(SUMMARY_ANALYSIS_SCHEMA_V12);
  assert.strictEqual(SUMMARY_ANALYSIS_SCHEMA_V12.title, "Summary Analysis Schema v1.2.0-draft.2");
});

// 2. Vocabulary Sync Tests
test("v1.2: TypeScript vocabulary constants match JSON sources", () => {
  // Document kinds vocabulary
  assert.strictEqual(DOCUMENT_KINDS.length, DOCUMENT_KINDS_JSON.terms.length);
  assert.deepStrictEqual(DOCUMENT_KINDS, DOCUMENT_KINDS_JSON.terms.map((t: any) => t.value));

  // Subject domains vocabulary
  assert.strictEqual(SUBJECT_DOMAINS.length, SUBJECT_DOMAINS_JSON.terms.length);
  assert.deepStrictEqual(SUBJECT_DOMAINS, SUBJECT_DOMAINS_JSON.terms.map((t: any) => t.value));

  // Subject label kinds vocabulary
  assert.strictEqual(SUBJECT_LABEL_KINDS.length, SUBJECT_LABEL_KINDS_JSON.terms.length);
  assert.deepStrictEqual(SUBJECT_LABEL_KINDS, SUBJECT_LABEL_KINDS_JSON.terms.map((t: any) => t.value));

  // Role categories vocabulary
  assert.deepStrictEqual(TEMPORAL_ROLE_CATEGORIES, EXTRACTION_ROLE_CATEGORIES_JSON.temporalRoleCategories.map((t: any) => t.value));
  assert.deepStrictEqual(PARTY_KINDS, EXTRACTION_ROLE_CATEGORIES_JSON.partyKinds.map((t: any) => t.value));
  assert.deepStrictEqual(PARTY_ROLE_CATEGORIES, EXTRACTION_ROLE_CATEGORIES_JSON.partyRoleCategories.map((t: any) => t.value));
  assert.deepStrictEqual(MONETARY_ROLE_CATEGORIES, EXTRACTION_ROLE_CATEGORIES_JSON.monetaryRoleCategories.map((t: any) => t.value));
});

// 3. Synthetic Example Validation Tests
test("v1.2: all synthetic examples pass schema and custom validations", () => {
  assert.ok(validateSummaryAnalysisV12(minimalExample), `Minimal example failed: ${getSummaryAnalysisV12ValidationErrors(minimalExample).join(", ")}`);
  assert.ok(validateSummaryAnalysisV12(japaneseMixedExample), `Japanese mixed example failed: ${getSummaryAnalysisV12ValidationErrors(japaneseMixedExample).join(", ")}`);
});

// 4. Semantic Rules & Validator Mutation Tests
test("v1.2: validation fails on invalid document kind vocabulary values", () => {
  const obj = getValidV12Base();
  obj.documentKindInfo.kinds[0].kind = "not_a_valid_kind";
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes('Invalid document kind value')));
});

test("v1.2: validation enforces that 'unknown' kind is used alone", () => {
  const obj = getValidV12Base();
  obj.documentKindInfo.kinds = [
    { kind: "unknown", confidence: 1.0, reason: "dunno" },
    { kind: "report", confidence: 0.5, reason: "maybe report" }
  ];
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes("If documentKindInfo contains 'unknown' kind, it must be the only kind")));
});

test("v1.2: validation enforces that 'unknown' subject domain is used alone", () => {
  const obj = getValidV12Base();
  obj.subjectAreas.domains = [
    { domain: "unknown", confidence: 1.0, reason: "unknown domain", labels: [] },
    { domain: "computerScience", confidence: 0.5, reason: "maybe computerScience", labels: [] }
  ];
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes("If subjectAreas contains 'unknown' domain, it must be the only domain")));
});

test("v1.2: validation enforces that 'other' subject domain has at least one label", () => {
  const obj = getValidV12Base();
  obj.subjectAreas.domains = [
    { domain: "other", confidence: 0.9, reason: "custom stuff", labels: [] }
  ];
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes("If domain is 'other', it requires at least one concrete subject label")));
});

test("v1.2: validation checks displayTitle source consistency", () => {
  const obj = getValidV12Base();
  obj.titleInfo.explicitTitle = null;
  obj.titleInfo.displayTitle.source = "explicitTitle";
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes("displayTitle.source is 'explicitTitle' but explicitTitle is null")));
});

test("v1.2: validation enforces generic fileNameTitle has a reason", () => {
  const obj = getValidV12Base();
  obj.titleInfo.fileNameTitle = {
    value: "scan.pdf",
    isGeneric: true
    // missing genericReason
  };
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes("genericReason is required when isGeneric is true")));
});

test("v1.2: validation checks roles categories vocabulary compliance", () => {
  const obj = getValidV12Base();
  obj.extractedFacts.temporalReferences[0].roleCategory = "invalid_category";
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes("Invalid temporal roleCategory value")));
});

test("v1.2: validation checks raw field limits (maximum 240 characters)", () => {
  const obj = getValidV12Base();
  obj.extractedFacts.temporalReferences[0].raw = "A".repeat(241);
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes("raw field exceeds maximum length of 240 characters")));
});

// 5. Normalizer Tests
test("v1.2: normalizer trims strings and trims optional candidates cleanly", () => {
  const rawObj = getValidV12Base();
  rawObj.summary.oneLine = "  A trimmed line.  ";
  rawObj.titleInfo.inferredTitle = "   Inferred Title   ";
  
  const norm = normalizeSummaryAnalysisV12(rawObj);
  assert.strictEqual(norm.summary.oneLine, "A trimmed line.");
  assert.strictEqual(norm.titleInfo.inferredTitle, "Inferred Title");
});

test("v1.2: normalizer caps document kinds and subject domains array length to 5", () => {
  const rawObj = getValidV12Base();
  rawObj.documentKindInfo.kinds = [
    { kind: "note", confidence: 0.9, reason: "1" },
    { kind: "report", confidence: 0.9, reason: "2" },
    { kind: "specification", confidence: 0.9, reason: "3" },
    { kind: "manual", confidence: 0.9, reason: "4" },
    { kind: "academicPaper", confidence: 0.9, reason: "5" },
    { kind: "abstract", confidence: 0.9, reason: "6" }
  ];
  
  const norm = normalizeSummaryAnalysisV12(rawObj);
  assert.strictEqual(norm.documentKindInfo.kinds.length, 5);
  assert.strictEqual(norm.documentKindInfo.kinds[4].kind, "academicPaper");
});

test("v1.2: normalizer truncates excessive raw fields (length > 240) deterministically", () => {
  const rawObj = getValidV12Base();
  const longRaw = "B".repeat(300);
  rawObj.extractedFacts.temporalReferences[0].raw = longRaw;
  
  const norm = normalizeSummaryAnalysisV12(rawObj);
  const rawResult = norm.extractedFacts.temporalReferences[0].raw;
  assert.ok(rawResult);
  assert.strictEqual(rawResult.length, 240);
  assert.strictEqual(rawResult, "B".repeat(240));
});

test("v1.2: normalizer detects and redacts security sensitive credentials", () => {
  const rawObj = getValidV12Base();
  // 1. Google API Key pattern
  rawObj.extractedFacts.temporalReferences[0].raw = "Key AIzaSyDf83jsdhfksjdfhksjdfksjdfksjdfsk";
  // 2. OAuth access token ya29
  rawObj.extractedFacts.monetaryAmounts[0].raw = "ya29.a0AfB_byDsfksjfksjfsjflksjflksfjlksjfksjfdkl";

  const norm = normalizeSummaryAnalysisV12(rawObj);
  assert.strictEqual(norm.extractedFacts.temporalReferences[0].raw, "[REDACTED_SECURITY_SENSITIVE_STRING]");
  assert.strictEqual(norm.extractedFacts.monetaryAmounts[0].raw, "[REDACTED_SECURITY_SENSITIVE_STRING]");
});

// v1.2.0-draft.2 specific validation and normalization tests
test("v1.2: validation explicitly rejects objects containing indexing.topics", () => {
  const obj = getValidV12Base();
  obj.indexing.topics = ["some", "deprecated", "topics"];
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes("indexing.topics is deprecated")));
});

test("v1.2: validation explicitly rejects string items in indexing.keywords", () => {
  const obj = getValidV12Base();
  obj.indexing.keywords = ["just-a-string-keyword"];
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes("Keyword term must be an object")));
});

test("v1.2: validation rejects invalid keyword sources like legacy surface or inferred", () => {
  const obj = getValidV12Base();
  obj.indexing.keywords[0].source = "surface"; // Deprecated/invalid in validation
  assert.ok(!validateSummaryAnalysisV12(obj));
  const errors = getSummaryAnalysisV12ValidationErrors(obj);
  assert.ok(errors.some((e) => e.includes("Invalid keyword source")));
});

test("v1.2: normalizer maps legacy keyword sources to valid draft.2 provenance sources", () => {
  const obj = getValidV12Base();
  // We put legacy sources
  obj.indexing.keywords[0].source = "surface";
  obj.indexing.keywords[1].source = "inferred";

  const norm = normalizeSummaryAnalysisV12(obj);
  assert.strictEqual(norm.indexing.keywords[0].source, "body");
  assert.strictEqual(norm.indexing.keywords[1].source, "other");
});

test("v1.2: normalizer performs stable deduplication by composite key and merges search variants", () => {
  const obj = getValidV12Base();
  // Add duplicate keyword entries with different casing or same composite key but different search variants
  obj.indexing.keywords = [
    {
      value: "API",
      source: "heading",
      confidence: 0.9,
      language: "en",
      script: "Latn",
      searchVariants: [{ value: "application programming interface", relation: "synonym", confidence: 0.9 }]
    },
    {
      value: "api",
      source: "body",
      confidence: 0.8,
      language: "en",
      script: "Latn",
      searchVariants: [{ value: "REST API", relation: "synonym", confidence: 0.85 }]
    }
  ];

  const norm = normalizeSummaryAnalysisV12(obj);
  // Should stably keep the first, but merge searchVariants
  assert.strictEqual(norm.indexing.keywords.length, 1);
  assert.strictEqual(norm.indexing.keywords[0].value, "API");
  assert.strictEqual(norm.indexing.keywords[0].source, "heading"); // preserves first's properties
  assert.strictEqual(norm.indexing.keywords[0].searchVariants.length, 2);
  assert.strictEqual(norm.indexing.keywords[0].searchVariants[0].value, "application programming interface");
  assert.strictEqual(norm.indexing.keywords[0].searchVariants[1].value, "REST API");
});

