import test, { describe } from "node:test";
import assert from "node:assert";
import {
  buildFileSummaryMetadata,
  getFileSummaryDocPath,
  isPersistableStructuredSummary,
  sanitizeSummaryMetadataForFirestore,
} from "./summaryMetadata";
import { SUMMARY_ANALYSIS_SCHEMA_VERSION } from "./summaryAnalysisSchema";
import { SUMMARY_ANALYSIS_PROMPT_VERSION, SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION } from "./promptSpecs";

describe("summaryMetadata", () => {
  const validStructured = {
    oneLineSummary: "This is a one-line summary.",
    detailedSummary: "This is a very detailed summary analysis of the document.",
    title: "Document Title",
    inferredTitle: "Document Title Inferred",
    documentTypes: ["note"],
    documentIntent: "inform",
    topics: ["test"],
    keywords: ["doc"],
    namedEntities: [{ name: "Acme Corp", type: "organization" }],
    resourceReferences: [{ uri: "https://example.com" }],
    primaryLanguage: "Japanese",
    languages: ["Japanese"],
    temporalReferences: [{ date: "2026-06-24", role: "created", raw: "June 2026" }],
    parties: [{ name: "Takashi", role: "author", kind: "person" }],
    monetaryAmounts: [{ amount: 100, currency: "USD", role: "total", raw: "$100" }],
    subjectAreas: { computerScience: ["algorithms"] },
    confidence: 0.95,
    warnings: [],
  };

  test("builds metadata from valid structured response", () => {
    const input = {
      fileId: "file-123",
      fileName: "test_doc.pdf",
      mimeType: "application/pdf",
      modifiedTime: "2026-06-24T12:00:00Z",
      model: "gemini-2.5-pro",
      structured: validStructured,
      validationErrors: [],
      parseSuccess: true,
      validationSuccess: true,
      source: "ai-summary-test" as const,
      cacheKey: "cache-key-abc",
    };

    const metadata = buildFileSummaryMetadata(input);

    assert.strictEqual(metadata.fileId, "file-123");
    assert.strictEqual(metadata.fileName, "test_doc.pdf");
    assert.strictEqual(metadata.mimeType, "application/pdf");
    assert.strictEqual(metadata.modifiedTime, "2026-06-24T12:00:00Z");
    assert.strictEqual(metadata.schemaVersion, SUMMARY_ANALYSIS_SCHEMA_VERSION);
    assert.strictEqual(metadata.promptVersion, SUMMARY_ANALYSIS_PROMPT_VERSION);
    assert.strictEqual(metadata.systemInstructionVersion, SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION);
    assert.strictEqual(metadata.model, "gemini-2.5-pro");
    assert.strictEqual(metadata.outputMode, "structured");
    assert.strictEqual(metadata.summary, "This is a one-line summary.");
    assert.deepStrictEqual(metadata.structured, validStructured);
    assert.deepStrictEqual(metadata.validationErrors, []);
    assert.strictEqual(metadata.parseSuccess, true);
    assert.strictEqual(metadata.validationSuccess, true);
    assert.ok(metadata.generatedAt);
    assert.strictEqual(metadata.source, "ai-summary-test");
    assert.strictEqual(metadata.cacheKey, "cache-key-abc");
  });

  test("handles missing fileName/mimeType safely", () => {
    const input = {
      fileId: "file-456",
      model: "gemini-2.5-pro",
      structured: validStructured,
      validationErrors: [],
      parseSuccess: true,
      validationSuccess: true,
      source: "drive-debugger" as const,
    };

    const metadata = buildFileSummaryMetadata(input);
    assert.strictEqual(metadata.fileId, "file-456");
    assert.strictEqual(metadata.fileName, undefined);
    assert.strictEqual(metadata.mimeType, undefined);
    assert.strictEqual(metadata.modifiedTime, undefined);
    assert.strictEqual(metadata.cacheKey, undefined);
  });

  test("getFileSummaryDocPath creates stable Firestore path under user scoped uid", () => {
    const path = getFileSummaryDocPath("user-abc", "file-123");
    assert.strictEqual(path, "users/user-abc/file_summaries/file-123");
  });

  test("getFileSummaryDocPath rejects empty or invalid inputs to prevent path poisoning", () => {
    assert.throws(() => getFileSummaryDocPath("", "file-123"));
    assert.throws(() => getFileSummaryDocPath("user-abc", ""));
    assert.throws(() => getFileSummaryDocPath("  ", "file-123"));
    assert.throws(() => getFileSummaryDocPath("user-abc", "  "));
  });

  test("isPersistableStructuredSummary works correctly", () => {
    const validMetadata = {
      fileId: "file-123",
      parseSuccess: true,
      validationSuccess: true,
      structured: validStructured,
    };

    assert.strictEqual(isPersistableStructuredSummary(validMetadata), true);

    assert.strictEqual(isPersistableStructuredSummary(null), false);
    assert.strictEqual(isPersistableStructuredSummary({ ...validMetadata, fileId: "" }), false);
    assert.strictEqual(isPersistableStructuredSummary({ ...validMetadata, parseSuccess: false }), false);
    assert.strictEqual(isPersistableStructuredSummary({ ...validMetadata, validationSuccess: false }), false);
    assert.strictEqual(isPersistableStructuredSummary({ ...validMetadata, structured: undefined }), false);
  });

  test("sanitizes undefined fields recursively", () => {
    const input = {
      a: 1,
      b: undefined,
      c: {
        d: "hello",
        e: undefined,
        f: [1, undefined, 3],
      },
    };

    const expected = {
      a: 1,
      c: {
        d: "hello",
        f: [1, null, 3],
      },
    };

    const result = sanitizeSummaryMetadataForFirestore(input);
    assert.deepStrictEqual(result, expected);
  });

  test("preserves nested structures correctly (subjectAreas, resourceReferences, parties)", () => {
    const input = {
      subjectAreas: { computerScience: ["ai", "algorithms"] },
      parties: [{ name: "John", role: "author", kind: "person" }],
      resourceReferences: [{ uri: "https://example.com", raw: "Example site" }],
    };

    const result = sanitizeSummaryMetadataForFirestore(input);
    assert.deepStrictEqual(result, input);
  });
});
