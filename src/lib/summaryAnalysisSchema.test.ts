import { test } from "node:test";
import assert from "node:assert";
import { validateSummaryAnalysisResult } from "./summaryAnalysisSchema.js";

test("validateSummaryAnalysisResult passes valid object", () => {
  const validObj = {
    oneLineSummary: "テストです。",
    detailedSummary: "これはテストのための詳細な要約です。",
    keywords: ["test", "hello"],
    urls: ["https://example.com"],
    namedEntities: {
      people: ["Yamada"],
      organizations: ["Example Inc"],
      places: ["Tokyo"],
      products: ["Applet"],
      projects: ["Project X"]
    },
    documentType: "text",
    language: "ja",
    confidence: 0.95
  };
  assert.ok(validateSummaryAnalysisResult(validObj));
});

test("validateSummaryAnalysisResult fails on missing required field", () => {
  const invalidObj = {
    oneLineSummary: "テストです。",
    detailedSummary: "これはテストのための詳細な要約です。",
    keywords: ["test", "hello"],
    urls: ["https://example.com"],
    namedEntities: {
      people: ["Yamada"],
      organizations: ["Example Inc"],
      places: ["Tokyo"],
      products: ["Applet"],
      projects: ["Project X"]
    },
    documentType: "text",
    language: "ja"
    // confidence missing
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj));
});

test("validateSummaryAnalysisResult fails on invalid namedEntities shape", () => {
  const invalidObj = {
    oneLineSummary: "テストです。",
    detailedSummary: "これはテスト",
    keywords: [],
    urls: [],
    namedEntities: {
      people: [],
      organizations: [],
      places: [],
      // products and projects missing
    },
    documentType: "text",
    language: "ja",
    confidence: 1.0
  };
  assert.ok(!validateSummaryAnalysisResult(invalidObj));
});
