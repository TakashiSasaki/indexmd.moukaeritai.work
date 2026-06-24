import { test } from "node:test";
import assert from "node:assert";
import { validateSummaryAnalysisResult, normalizeSummaryAnalysisResult } from "./summaryAnalysisSchema.js";

test("validateSummaryAnalysisResult passes valid object", () => {
  const validObj = {
    oneLineSummary: "テストです。",
    detailedSummary: "これはテストのための詳細な要約です。",
    title: "テスト仕様書",
    inferredTitle: "",
    documentTypes: ["specification"],
    documentIntent: "specify",
    topics: ["テスト"],
    keywords: ["test", "hello"],
    namedEntities: [
      { name: "Yamada", type: "person" },
      { name: "Project X", type: "initiative" }
    ],
    resourceReferences: [
      { uri: "https://example.com" }
    ],
    primaryLanguage: "ja",
    languages: ["ja", "en"],
    temporalReferences: [
      { date: "2023-01-01", role: "created", raw: "2023年1月1日" }
    ],
    parties: [
      { name: "Yamada", role: "author", kind: "person" }
    ],
    monetaryAmounts: [
      { amount: 1000, currency: "JPY", role: "total", raw: "1,000円" }
    ],
    subjectAreas: {
      computerScience: ["softwareEngineering"],
      mathematics: ["categoryTheory", "topology"]
    },
    confidence: 0.95,
    warnings: []
  };
  assert.ok(validateSummaryAnalysisResult(validObj));
});

test("validateSummaryAnalysisResult fails on old v1.0-like object", () => {
  const oldObj = {
    oneLineSummary: "テストです。",
    detailedSummary: "詳細",
    title: "",
    documentType: "specification", // v1.0 format
    urls: ["https://example.com"], // v1.0 format
    language: "ja" // v1.0 format
  };
  assert.ok(!validateSummaryAnalysisResult(oldObj));
});

test("validateSummaryAnalysisResult fails on invalid documentTypes", () => {
  const invalidObj = {
    ...getValidBase(),
    documentTypes: ["unknown_type"]
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj));
});

function getValidBase() {
  return {
    oneLineSummary: "テストです。",
    detailedSummary: "詳細",
    title: "",
    inferredTitle: "",
    documentTypes: ["note"],
    documentIntent: "inform",
    topics: [],
    keywords: [],
    namedEntities: [],
    resourceReferences: [],
    primaryLanguage: "ja",
    languages: ["ja"],
    temporalReferences: [],
    parties: [],
    monetaryAmounts: [],
    subjectAreas: {},
    confidence: 0.9,
    warnings: []
  };
}

test("validateSummaryAnalysisResult fails on missing required field", () => {
  const invalidObj = {
    oneLineSummary: "テストです。",
    detailedSummary: "これはテストのための詳細な要約です。"
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj));
});

test("validateSummaryAnalysisResult fails on invalid documentIntent", () => {
  const invalidObj = {
    ...getValidBase(),
    documentIntent: "invalid_intent"
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj));
});

test("validateSummaryAnalysisResult fails on invalid namedEntities[].type", () => {
  const invalidObj = {
    ...getValidBase(),
    namedEntities: [{ name: "test", type: "invalid_type" }]
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj));
});

test("validateSummaryAnalysisResult fails on invalid parties[].role or kind", () => {
  const invalidObj1 = {
    ...getValidBase(),
    parties: [{ name: "test", role: "invalid_role", kind: "person" }]
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj1));

  const invalidObj2 = {
    ...getValidBase(),
    parties: [{ name: "test", role: "author", kind: "invalid_kind" }]
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj2));
});

test("validateSummaryAnalysisResult fails on resourceReferences[].uri without scheme", () => {
  const invalidObj = {
    ...getValidBase(),
    resourceReferences: [{ uri: "example.com" }] // Missing http:// or similar
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj));
});

test("validateSummaryAnalysisResult fails on unknown subjectAreas key", () => {
  const invalidObj = {
    ...getValidBase(),
    subjectAreas: {
      unknownDomain: ["some_topic"]
    }
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj));
});

test("validateSummaryAnalysisResult fails on invalid confidence", () => {
  const invalidObj1 = {
    ...getValidBase(),
    confidence: -0.1
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj1));

  const invalidObj2 = {
    ...getValidBase(),
    confidence: 1.1
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj2));

  const invalidObj3 = {
    ...getValidBase(),
    confidence: NaN
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj3));
});

test("validateSummaryAnalysisResult fails on empty documentTypes or unknown with others", () => {
  const invalidObj1 = { ...getValidBase(), documentTypes: [] };
  assert.ok(!validateSummaryAnalysisResult(invalidObj1));

  const invalidObj2 = { ...getValidBase(), documentTypes: ["unknown", "report"] };
  assert.ok(!validateSummaryAnalysisResult(invalidObj2));
});

test("validateSummaryAnalysisResult fails on blank names or raw strings", () => {
  const invalidObj1 = { ...getValidBase(), namedEntities: [{ name: " ", type: "person" }] };
  assert.ok(!validateSummaryAnalysisResult(invalidObj1));

  const invalidObj2 = { ...getValidBase(), parties: [{ name: "", role: "author", kind: "person" }] };
  assert.ok(!validateSummaryAnalysisResult(invalidObj2));

  const invalidObj3 = { ...getValidBase(), temporalReferences: [{ date: "2026", role: "publication_date", raw: "  " }] };
  assert.ok(!validateSummaryAnalysisResult(invalidObj3));
});

test("validateSummaryAnalysisResult passes multi-language and warnings", () => {
  const validObj = {
    ...getValidBase(),
    languages: ["ja", "en"],
    warnings: ["Some part was illegible"]
  };
  assert.ok(validateSummaryAnalysisResult(validObj));

  const invalidObj = {
    ...getValidBase(),
    warnings: [123] // Not a string
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj));
});

test("normalizeSummaryAnalysisResult normalizes fields", () => {
  const rawObj = {
    oneLineSummary: " テスト ",
    detailedSummary: "詳細 ",
    title: "",
    inferredTitle: "",
    documentTypes: ["note", "note"],
    documentIntent: "inform",
    topics: ["a", "", "a"],
    keywords: [],
    namedEntities: [],
    resourceReferences: [{ uri: "http://example.com ", raw: "" }],
    primaryLanguage: "ja",
    languages: ["ja"],
    temporalReferences: [],
    parties: [],
    monetaryAmounts: [],
    subjectAreas: {
      mathematics: ["algebra", "algebra"],
      physics: [] // empty should be removed
    },
    confidence: 0.9,
    warnings: []
  };

  const normalized = normalizeSummaryAnalysisResult(rawObj);
  assert.strictEqual(normalized.oneLineSummary, "テスト");
  assert.deepStrictEqual(normalized.documentTypes, ["note"]);
  assert.deepStrictEqual(normalized.topics, ["a"]);
  assert.strictEqual(normalized.resourceReferences[0].uri, "http://example.com");
  assert.strictEqual(normalized.resourceReferences[0].raw, undefined);
  assert.deepStrictEqual(normalized.subjectAreas.mathematics, ["algebra"]);
  assert.strictEqual(normalized.subjectAreas.physics, undefined);
});

