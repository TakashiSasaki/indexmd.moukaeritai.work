import test, { describe } from "node:test";
import assert from "node:assert";
import {
  buildFileSummaryMetadata,
  getFileSummaryDocPath,
  isPersistableStructuredSummary,
  sanitizeSummaryMetadataForFirestore,
  getSummaryMetadataStatus,
  getSummaryMetadataStatusReasons,
} from "./summaryMetadata";
import { SCHEMA_VERSION_V12 } from "./summaryAnalysis/schema";
import { SUMMARY_ANALYSIS_PROMPT_VERSION, SUMMARY_DEBUG_SYSTEM_INSTRUCTION_VERSION } from "./promptSpecs";

describe("summaryMetadata", () => {
  const validStructured = {
    summary: {
      oneLine: "This is a one-line summary.",
      detailed: "This is a very detailed summary analysis of the document.",
    },
    titleInfo: {
      displayTitle: {
        value: "Document Title",
        source: "title",
        reason: "Matched main title",
      },
      inferredTitle: "Document Title Inferred",
    },
    documentKindInfo: {
      kinds: [{ kind: "note", confidence: 0.95 }],
    },
    fileFormatInfo: {
      format: "pdf",
    },
    subjectAreas: {
      domains: [
        {
          domain: "computerScience",
          confidence: 0.9,
          labels: [{ label: "algorithms", kind: "topic" }],
        },
      ],
    },
    indexing: {
      keywords: [{ value: "doc", source: "title" }],
      namedEntities: [{ name: "Acme Corp", type: "organization" }],
      resourceReferences: [{ uri: "https://example.com", raw: "https://example.com" }],
    },
    languageInfo: {
      primary: "Japanese",
      detected: ["Japanese"],
    },
    extractedFacts: {
      temporalReferences: [{ date: "2026-06-24", role: "created", raw: "June 2026" }],
      parties: [{ name: "Takashi", role: "author", kind: "person" }],
      monetaryAmounts: [{ amount: 100, currency: "USD", role: "total", raw: "$100" }],
    },
    quality: {
      confidence: 0.95,
      warnings: [],
    },
  };

  test("builds metadata from valid structured response", () => {
    const input = {
      fileId: "file-123",
      fileName: "test_doc.pdf",
      mimeType: "application/pdf",
      modifiedTime: "2026-06-24T12:00:00Z",
      model: "gemini-2.5-pro",
      structured: validStructured as any,
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
    assert.strictEqual(metadata.schemaVersion, SCHEMA_VERSION_V12);
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
      structured: validStructured as any,
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

  describe("getSummaryMetadataStatus", () => {
    const baseSaved = {
      fileId: "file-123",
      parseSuccess: true,
      validationSuccess: true,
      schemaVersion: SCHEMA_VERSION_V12,
      promptVersion: "1.2.0-draft.2",
      systemInstructionVersion: "1.2.0-draft.2",
      modifiedTime: "2026-06-24T12:00:00Z",
      model: "gemini-2.5-pro",
      outputMode: "structured" as const,
      summary: "This is a summary text.",
      structured: validStructured,
      generatedAt: "2026-06-24T12:00:00Z",
      source: "ai-summary-test" as const,
    };

    test("returns missing if savedMetadata is null or undefined", () => {
      const status = getSummaryMetadataStatus({
        savedMetadata: null,
        currentSchemaVersion: SCHEMA_VERSION_V12,
        currentPromptVersion: "1.2.0-draft.2",
        currentSystemInstructionVersion: "1.2.0-draft.2",
      });
      assert.strictEqual(status, "missing");
    });

    test("returns invalid if fileId is empty or parsing failed or required fields are missing", () => {
      const status1 = getSummaryMetadataStatus({
        savedMetadata: { ...baseSaved, fileId: "" },
        currentSchemaVersion: SCHEMA_VERSION_V12,
        currentPromptVersion: "1.2.0-draft.2",
        currentSystemInstructionVersion: "1.2.0-draft.2",
      });
      assert.strictEqual(status1, "invalid");

      const status2 = getSummaryMetadataStatus({
        savedMetadata: { ...baseSaved, parseSuccess: false },
        currentSchemaVersion: SCHEMA_VERSION_V12,
        currentPromptVersion: "1.2.0-draft.2",
        currentSystemInstructionVersion: "1.2.0-draft.2",
      });
      assert.strictEqual(status2, "invalid");

      const status3 = getSummaryMetadataStatus({
        savedMetadata: { ...baseSaved, validationSuccess: false },
        currentSchemaVersion: SCHEMA_VERSION_V12,
        currentPromptVersion: "1.2.0-draft.2",
        currentSystemInstructionVersion: "1.2.0-draft.2",
      });
      assert.strictEqual(status3, "invalid");

      // Test missing required fields
      const status4 = getSummaryMetadataStatus({
        savedMetadata: { 
          fileId: "file-123"
        },
        currentSchemaVersion: SCHEMA_VERSION_V12,
        currentPromptVersion: "1.2.0-draft.2",
        currentSystemInstructionVersion: "1.2.0-draft.2",
      });
      assert.strictEqual(status4, "invalid");
    });

    test("returns stale-schema on schema mismatch", () => {
      const status = getSummaryMetadataStatus({
        savedMetadata: baseSaved,
        currentSchemaVersion: "other-version",
        currentPromptVersion: "1.2.0-draft.2",
        currentSystemInstructionVersion: "1.2.0-draft.2",
      });
      assert.strictEqual(status, "stale-schema");
    });

    test("returns stale-prompt on prompt or system instruction mismatch", () => {
      const status1 = getSummaryMetadataStatus({
        savedMetadata: baseSaved,
        currentSchemaVersion: SCHEMA_VERSION_V12,
        currentPromptVersion: "1.2.0",
        currentSystemInstructionVersion: "1.2.0-draft.2",
      });
      assert.strictEqual(status1, "stale-prompt");

      const status2 = getSummaryMetadataStatus({
        savedMetadata: baseSaved,
        currentSchemaVersion: SCHEMA_VERSION_V12,
        currentPromptVersion: "1.2.0-draft.2",
        currentSystemInstructionVersion: "1.2.0",
      });
      assert.strictEqual(status2, "stale-prompt");
    });

    test("returns stale-file on file modifiedTime mismatch", () => {
      const status = getSummaryMetadataStatus({
        savedMetadata: baseSaved,
        currentSchemaVersion: SCHEMA_VERSION_V12,
        currentPromptVersion: "1.2.0-draft.2",
        currentSystemInstructionVersion: "1.2.0-draft.2",
        currentFileModifiedTime: "2026-06-25T00:00:00Z", // newer file modification
      });
      assert.strictEqual(status, "stale-file");
    });

    test("returns current when all matches perfectly", () => {
      const status = getSummaryMetadataStatus({
        savedMetadata: baseSaved,
        currentSchemaVersion: SCHEMA_VERSION_V12,
        currentPromptVersion: "1.2.0-draft.2",
        currentSystemInstructionVersion: "1.2.0-draft.2",
        currentFileModifiedTime: "2026-06-24T12:00:00Z",
      });
      assert.strictEqual(status, "current");
    });

    describe("getSummaryMetadataStatusReasons", () => {
      test("identifies missing data reason", () => {
        const reasons = getSummaryMetadataStatusReasons({
          savedMetadata: null,
          currentSchemaVersion: SCHEMA_VERSION_V12,
          currentPromptVersion: "1.2.0-draft.2",
          currentSystemInstructionVersion: "1.2.0-draft.2",
        });
        assert.deepStrictEqual(reasons, ["要約データが存在しません"]);
      });

      test("identifies incomplete fields reason", () => {
        const reasons = getSummaryMetadataStatusReasons({
          savedMetadata: { fileId: "file-123" },
          currentSchemaVersion: SCHEMA_VERSION_V12,
          currentPromptVersion: "1.2.0-draft.2",
          currentSystemInstructionVersion: "1.2.0-draft.2",
        });
        assert.ok(reasons[0].includes("必須フィールドが不足"));
      });

      test("identifies mismatch reasons", () => {
        const reasons = getSummaryMetadataStatusReasons({
          savedMetadata: {
            ...baseSaved,
            schemaVersion: "old-schema",
            promptVersion: "old-prompt",
          },
          currentSchemaVersion: "new-schema",
          currentPromptVersion: "new-prompt",
          currentSystemInstructionVersion: "1.2.0-draft.2",
          currentFileModifiedTime: "2026-06-25T00:00:00Z", // modified time mismatch
        });

        const reasonsStr = reasons.join(" | ");
        assert.ok(reasonsStr.includes("スキーマバージョン不一致"));
        assert.ok(reasonsStr.includes("分析プロンプトバージョン不一致"));
        assert.ok(reasonsStr.includes("Driveファイル更新検知"));
      });
    });
  });
});
