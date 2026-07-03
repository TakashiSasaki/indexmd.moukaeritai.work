import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateStructuredSummaryQuality } from './qualityGate';
import { SummaryAnalysisResultV12 } from './types';

describe('evaluateStructuredSummaryQuality', () => {
  const baseValidOutput: SummaryAnalysisResultV12 = {
    summary: {
      oneLine: "これはサンプルの有効なドキュメントの1行サマリーです。",
      detailed: "これは詳細な説明です。複数段落を想定しています。"
    },
    titleInfo: {
      explicitTitle: { value: "ドキュメントタイトル", source: "documentHeading" as any },
      fileNameTitle: { value: "test.pdf", isGeneric: false },
      inferredTitle: "推測されたタイトル",
      displayTitle: { value: "選択されたタイトル", source: "explicitTitle" as any, reason: "理由" }
    },
    documentKindInfo: {
      vocabularyVersion: "1.0.0-draft.1",
      kinds: [{ kind: "dataset", confidence: 0.9, reason: "データテーブルであるため" }]
    },
    fileFormatInfo: { mimeType: "text/csv", extension: "csv" },
    subjectAreas: {
      vocabularyVersion: "1.0.0-draft.1",
      domains: [{
        domain: "technology",
        confidence: 0.95,
        reason: "技術的な内容を含むため",
        labels: [{ label: "プログラミング", kind: "field", confidence: 0.9, source: "controlledVocabulary" }]
      }]
    },
    languageInfo: { primary: "ja", detected: ["ja"] },
    indexing: {
      keywords: [
        { value: "テスト", source: "body", confidence: 0.9, importance: 0.8 }
      ],
      namedEntities: [],
      resourceReferences: []
    },
    extractedFacts: { temporalReferences: [], parties: [], monetaryAmounts: [] },
    quality: { confidence: 0.9, warnings: [] }
  };

  it('valid Gemini-like output with dataset and non-empty subjectAreas -> status valid', () => {
    const report = evaluateStructuredSummaryQuality(baseValidOutput, {
      modelName: "gemini-3.5-flash",
      providerFamily: "gemini",
      effectiveStructuredExecutionMode: "nativeSchema"
    });
    assert.strictEqual(report.status, "valid");
    assert.strictEqual(report.score, 100);
    assert.strictEqual(report.recommendedForPersistence, true);
    assert.strictEqual(report.recommendedForIndexMdCandidate, true);
  });

  it('valid output with fallback unknown-only document kind -> status validLowQuality', () => {
    const lowQualityOutput: SummaryAnalysisResultV12 = {
      ...baseValidOutput,
      documentKindInfo: {
        vocabularyVersion: "1.0.0-draft.1",
        kinds: [{ kind: "unknown", confidence: 0.5, reason: "不明" }]
      }
    };
    const report = evaluateStructuredSummaryQuality(lowQualityOutput);
    assert.strictEqual(report.status, "validLowQuality");
    assert.ok(report.score < 100);
    assert.strictEqual(report.recommendedForPersistence, true);
    assert.strictEqual(report.recommendedForIndexMdCandidate, false);
    assert.ok(report.issues.some(iss => iss.code === "UNKNOWN_DOCUMENT_KIND"));
  });

  it('valid output with empty subjectAreas -> status validLowQuality', () => {
    const lowQualityOutput: SummaryAnalysisResultV12 = {
      ...baseValidOutput,
      subjectAreas: {
        vocabularyVersion: "1.0.0-draft.1",
        domains: []
      }
    };
    const report = evaluateStructuredSummaryQuality(lowQualityOutput);
    assert.strictEqual(report.status, "validLowQuality");
    assert.ok(report.score < 100);
    assert.ok(report.issues.some(iss => iss.code === "EMPTY_SUBJECT_AREAS"));
  });

  it('valid Gemma promptedJson output is flagged correctly', () => {
    const report = evaluateStructuredSummaryQuality(baseValidOutput, {
      modelName: "gemma-2-9b-it",
      providerFamily: "gemma",
      effectiveStructuredExecutionMode: "promptedJson"
    });
    // It is valid but scores lower due to experimental model and prompted JSON mode
    assert.strictEqual(report.status, "valid"); // schema-valid, no severe functional warnings
    assert.strictEqual(report.score, 80); // 100 - 10 (experimental) - 10 (prompted JSON)
    assert.strictEqual(report.experimentalModel, true);
  });

  it('invalid output (missing core summaries) -> status invalid', () => {
    const invalidOutput: SummaryAnalysisResultV12 = {
      ...baseValidOutput,
      summary: { oneLine: "", detailed: "" }
    };
    const report = evaluateStructuredSummaryQuality(invalidOutput);
    assert.strictEqual(report.status, "invalid");
    assert.strictEqual(report.recommendedForPersistence, false);
    assert.strictEqual(report.recommendedForIndexMdCandidate, false);
    assert.ok(report.issues.some(iss => iss.severity === "blocking"));
  });

  it('null output -> status invalid', () => {
    const report = evaluateStructuredSummaryQuality(null);
    assert.strictEqual(report.status, "invalid");
    assert.strictEqual(report.recommendedForPersistence, false);
  });

  it('quality report does not leak raw text, prompts, content preview, or tokens', () => {
    const report = evaluateStructuredSummaryQuality(baseValidOutput, {
      modelName: "gemini-3.5-flash",
      providerFamily: "gemini",
      effectiveStructuredExecutionMode: "nativeSchema",
      warnings: ["Some internal warning"]
    });
    const serialized = JSON.stringify(report);
    assert.ok(!serialized.includes("rawText"));
    assert.ok(!serialized.includes("prompt"));
    assert.ok(!serialized.includes("content"));
    assert.ok(!serialized.includes("token"));
  });
});
