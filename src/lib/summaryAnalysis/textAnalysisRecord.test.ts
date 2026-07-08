import { describe, test } from "node:test";
import assert from "node:assert";
import { getTextAnalysisRecordValidationErrors, validateTextAnalysisRecord } from "./recordValidate.js";
import { TextAnalysisRecord } from "./recordTypes.js";
import { SUMMARY_ANALYSIS_SCHEMA_V12 } from "./schema.js";
import { processStructuredSummaryOutput } from "./serverUtils.js";
import { buildTextAnalysisRecordFromStructuredSummaryResult } from "./recordBuilder.js";

describe("TextAnalysisRecord validation", () => {
  test("minimal successful TextAnalysisRecord validates", () => {
    const record: any = {
      schemaVersion: "text-analysis-record.v0.1.0",
      status: { success: true },
      assetMetadata: { name: "test.txt", sourceKind: "googleDrive" },
      summaryAnalysis: {
        summary: { oneLine: "A test", detailed: "A detailed test" },
        titleInfo: { explicitTitle: null, fileNameTitle: null, inferredTitle: "Test", displayTitle: { value: "Test", source: "inferredTitle", reason: "" } },
        documentKindInfo: { vocabularyVersion: "1.0.0-draft.1", kinds: [{ kind: "unknown", confidence: 1, reason: "" }] },
        fileFormatInfo: { mimeType: "text/plain", extension: "txt" },
        subjectAreas: { vocabularyVersion: "1.0.0-draft.1", domains: [{ domain: "unknown", confidence: 1, reason: "", labels: [] }] },
        languageInfo: { primary: "en", detected: ["en"] },
        indexing: { keywords: [], namedEntities: [], resourceReferences: [] },
        extractedFacts: { temporalReferences: [], parties: [], monetaryAmounts: [] },
        quality: { confidence: 1, warnings: [] }
      }
    };
    const errors = getTextAnalysisRecordValidationErrors(record);
    assert.deepStrictEqual(errors, [], `Expected no errors, got: ${errors.join(", ")}`);
  });

  test("record.schemaVersion must be text-analysis-record.v0.1.0", () => {
    const record: any = {
      schemaVersion: "wrong-version",
      status: { success: false, error: "fail", failureKind: "unknown" },
      assetMetadata: {}
    };
    const errors = getTextAnalysisRecordValidationErrors(record);
    assert.ok(errors.some(e => e.includes("schemaVersion must be text-analysis-record.v0.1.0")));
  });

  test("success=true with summaryAnalysis validates", () => {
    // Already tested above, but let's test missing summaryAnalysis
    const record: any = {
      schemaVersion: "text-analysis-record.v0.1.0",
      status: { success: true },
      assetMetadata: { name: "test.txt" }
    };
    const errors = getTextAnalysisRecordValidationErrors(record);
    assert.ok(errors.some(e => e.includes("summaryAnalysis is required")));
  });

  test("failure record without summaryAnalysis validates if error/failureKind exists", () => {
    const record: any = {
      schemaVersion: "text-analysis-record.v0.1.0",
      status: { success: false, failureKind: "jsonParseError" },
      assetMetadata: { name: "test.txt" }
    };
    const errors = getTextAnalysisRecordValidationErrors(record);
    assert.deepStrictEqual(errors, []);
  });

  test("summaryAnalysis が不正な場合 record validation が失敗する", () => {
    const record: any = {
      schemaVersion: "text-analysis-record.v0.1.0",
      status: { success: true },
      assetMetadata: { name: "test.txt" },
      summaryAnalysis: {
        summary: { oneLine: "", detailed: "A detailed test" } // invalid oneLine
      }
    };
    const errors = getTextAnalysisRecordValidationErrors(record);
    assert.ok(errors.some(e => e.includes("summary.oneLine must be a non-empty string")));
  });

  test("subject label language=null が validation で許容される", () => {
    const record: any = {
      schemaVersion: "text-analysis-record.v0.1.0",
      status: { success: true },
      assetMetadata: { name: "test.txt", sourceKind: "googleDrive" },
      summaryAnalysis: {
        summary: { oneLine: "A test", detailed: "A detailed test" },
        titleInfo: { explicitTitle: null, fileNameTitle: null, inferredTitle: "Test", displayTitle: { value: "Test", source: "inferredTitle", reason: "" } },
        documentKindInfo: { vocabularyVersion: "1.0.0-draft.1", kinds: [{ kind: "unknown", confidence: 1, reason: "" }] },
        fileFormatInfo: { mimeType: "text/plain", extension: "txt" },
        subjectAreas: { vocabularyVersion: "1.0.0-draft.1", domains: [{ domain: "other", confidence: 1, reason: "", labels: [{
          label: "Test Label", kind: "topic", confidence: 1, source: "inferred", language: null
        }] }] },
        languageInfo: { primary: "en", detected: ["en"] },
        indexing: { keywords: [], namedEntities: [], resourceReferences: [] },
        extractedFacts: { temporalReferences: [], parties: [], monetaryAmounts: [] },
        quality: { confidence: 1, warnings: [] }
      }
    };
    const errors = getTextAnalysisRecordValidationErrors(record);
    assert.deepStrictEqual(errors, []);
  });

  test("record に executionPrivate/customInstruction raw text が入らない", () => {
    const record: any = {
      schemaVersion: "text-analysis-record.v0.1.0",
      status: { success: false, failureKind: "unknown" },
      assetMetadata: {},
      analysisRun: {
        prompt: { customInstruction: "secret text" },
        executionPrivate: { someData: 1 }
      }
    };
    const errors = getTextAnalysisRecordValidationErrors(record);
    assert.ok(errors.some(e => e.includes("analysisRun.prompt should not contain raw customInstruction text")));
    assert.ok(errors.some(e => e.includes("analysisRun should not contain executionPrivate")));
  });

  test("underGeneratedStructuredOutput が failureKind として型・record に入る", async () => {
    const result = await processStructuredSummaryOutput(JSON.stringify({ summary: {} }), "gemini-3.5-flash", {});
    const record = buildTextAnalysisRecordFromStructuredSummaryResult({
      result,
      input: { name: "test" },
      run: { runId: "1", timestamp: "2026", modelName: "gemini", promptVersion: "v1" }
    });
    assert.strictEqual(record.status.success, false);
    assert.strictEqual(record.status.failureKind, "underGeneratedStructuredOutput");
  });

  test("qualityStatus に型外の excellent が出ない", async () => {
    const result = await processStructuredSummaryOutput("{}", "gemini-3.5-flash", { extractedCustomSchema: { summary: "test" }});
    const record = buildTextAnalysisRecordFromStructuredSummaryResult({
      result,
      input: { name: "test" },
      run: { runId: "1", timestamp: "2026", modelName: "gemini", promptVersion: "v1" }
    });
    // excellent was mapped to valid in builder, or changed to valid in processStructuredSummaryOutput
    assert.strictEqual(record.evaluation?.qualityStatus, "valid");
  });
});
