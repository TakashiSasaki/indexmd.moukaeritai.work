import { test } from "node:test";
import assert from "node:assert";
import { processStructuredSummaryOutput } from "./serverUtils.js";

test("processStructuredSummaryOutput handles empty structured output '{}'", async () => {
  const result = await processStructuredSummaryOutput("{}", "gemini-3.5-flash", {});
  assert.strictEqual(result.error, "Structured output was empty or under-generated");
  assert.strictEqual(result.failureKind, "emptyStructuredOutput");
  assert.strictEqual(result.emptyStructuredOutput, true);
  assert.strictEqual(result.structuredParseFailed, false);
});

test("processStructuredSummaryOutput handles empty string with parse error", async () => {
  const result = await processStructuredSummaryOutput("  ", "gemini-3.5-flash", {});
  assert.strictEqual(result.structuredParseFailed, true);
  assert.ok(result.error?.includes("JSON parse failed"));
  assert.strictEqual(result.failureKind, "jsonParseError");
});

test("processStructuredSummaryOutput handles object with missing most root sections", async () => {
  const result = await processStructuredSummaryOutput(JSON.stringify({ summary: {} }), "gemini-3.5-flash", {});
  assert.strictEqual(result.error, "Structured output was empty or under-generated");
  assert.strictEqual(result.failureKind, "underGeneratedStructuredOutput");
  assert.strictEqual(result.underGeneratedStructuredOutput, true);
  assert.strictEqual(result.structuredParseFailed, false);
});

test("processStructuredSummaryOutput full valid draft.2 object is not underGeneratedStructuredOutput", async () => {
  const validOutput = {
    summary: {
      oneLine: "This is a single sentence summary.",
      detailed: "This is a detailed summary.",
      confidence: 0.95
    },
    titleInfo: {
      explicitTitle: null,
      fileNameTitle: { value: "file.pdf", isGeneric: false },
      inferredTitle: "Inferred Document Title",
      displayTitle: { value: "Inferred Document Title", source: "inferredTitle", reason: "Chose inferred title because explicit title is not available." }
    },
    documentKindInfo: {
      vocabularyVersion: "1.0.0-draft.1",
      kinds: [{ kind: "report", confidence: 0.9, reason: "Contains standard report structure." }]
    },
    fileFormatInfo: { mimeType: "application/pdf", extension: "pdf" },
    subjectAreas: {
      vocabularyVersion: "1.0.0-draft.1",
      domains: [{ domain: "computerScience", confidence: 0.95, reason: "Discusses software systems.", labels: [{ label: "TypeScript", kind: "topic", confidence: 0.9, source: "controlledVocabulary" }] }]
    },
    languageInfo: { primary: "en", detected: ["en"] },
    indexing: {
      keywords: [{ value: "testing", source: "body", confidence: 0.95, importance: 0.9, language: "en", script: "Latn", normalizedValue: "testing", searchVariants: [{ value: "test", relation: "stem", language: "en", script: "Latn", confidence: 0.99 }] }, { value: "validation", source: "heading", confidence: 0.95, importance: 0.85, searchVariants: [] }],
      namedEntities: [{ name: "Blue Co.", type: "organization" }],
      resourceReferences: [{ uri: "https://example.com/spec", label: "Spec link", raw: "Page 4" }]
    },
    extractedFacts: {
      temporalReferences: [{ value: "2026-06-25", normalizedDate: "2026-06-25", role: "effective", roleCategory: "validity", raw: "Effective Date", confidence: 0.95 }],
      parties: [{ name: "John Doe", kind: "person", roles: [{ role: "author", roleCategory: "authorship", confidence: 0.9 }] }],
      monetaryAmounts: [{ amount: 50.0, currency: "USD", role: "total", roleCategory: "payment", raw: "$50", confidence: 0.95 }]
    },
    quality: { confidence: 0.9, warnings: [] }
  };
  const result = await processStructuredSummaryOutput(JSON.stringify(validOutput), "gemini-3.5-flash", {});
  assert.strictEqual(result.failureKind, undefined);
  assert.strictEqual(result.emptyStructuredOutput, undefined);
  assert.strictEqual(result.underGeneratedStructuredOutput, undefined);
  assert.strictEqual(!!result.structuredParseFailed, false);
});

test("processStructuredSummaryOutput Gemma-style '{}' does not call repair-only LLM as a normal validation repair case", async () => {
  const result = await processStructuredSummaryOutput("{}", "gemma-4-31b-it", {});
  assert.strictEqual(result.failureKind, "emptyStructuredOutput");
  assert.strictEqual(result.repairFallbackUsed, undefined);
});
