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
      computerScience: ["softwareEngineering"]
    },
    confidence: 0.95,
    warnings: []
  };
  assert.ok(validateSummaryAnalysisResult(validObj));
});

test("validateSummaryAnalysisResult fails on missing required field", () => {
  const invalidObj = {
    oneLineSummary: "テストです。",
    detailedSummary: "これはテストのための詳細な要約です。"
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj));
});

test("validateSummaryAnalysisResult fails on invalid documentIntent", () => {
  const invalidObj = {
    oneLineSummary: "テストです。",
    detailedSummary: "詳細",
    title: "",
    inferredTitle: "",
    documentTypes: ["note"],
    documentIntent: "invalid_intent", // invalid
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

