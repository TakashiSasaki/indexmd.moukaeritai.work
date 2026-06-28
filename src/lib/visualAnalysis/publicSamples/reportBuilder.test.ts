import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildBatchReportForChat, buildFailuresOnlyReport, buildBatchSummaryReportForChat, buildBatchDiagnosticReportForChat, buildFullItemReport } from './reportBuilder';
import { PublicSampleBatchRunSummary } from './batchTypes';

describe('buildBatchReportForChat', () => {
  const mockSummary: PublicSampleBatchRunSummary = {
    runId: "run1",
    timestamp: "2024-01-01",
    modelName: "test-model",
    jsonMode: "standard",
    retryOnInvalidJson: false,
    total: 2,
    successCount: 1,
    failureCount: 1,
    validCount: 1,
    validLowQualityCount: 0,
    invalidJsonCount: 1,
    expectedComparisonPassCount: 1,
    expectedComparisonWarningCount: 0,
    expectedComparisonFailCount: 0,
    items: [
      {
        sampleId: "success-sample",
        title: "Success",
        success: true,
        qualityStatus: "valid",
        responseRaw: {
           sampleMetadata: { category: "test" },
           requestPreview: { raw: "hidden" }
        },
        parseDiagnostics: {
           rawOutputPreview: "hidden",
           attempts: []
        }
      },
      {
        sampleId: "fail-sample",
        title: "Fail",
        success: false,
        failureKind: "jsonParseError",
        error: "Parse failed"
      }
    ]
  };

  test('should exclude requestPreview and rawOutputPreview from chat report', () => {
    const report = buildBatchReportForChat(mockSummary);
    assert.strictEqual(report.total, 2);
    assert.strictEqual(report.items.length, 2);
    
    const successItem = report.items[0];
    assert.strictEqual((successItem as any).requestPreview, undefined);
    assert.strictEqual((successItem as any).parseDiagnostics.rawOutputPreview, undefined);
    assert.strictEqual((successItem as any).category, "test");
    
    const failItem = report.items[1];
    assert.strictEqual(failItem.error, "Parse failed");
    assert.strictEqual(failItem.failureKind, "jsonParseError");
  });

  test('should extract detected fields from responseRaw.visualAnalysis', () => {
    const summaryWithVisual: PublicSampleBatchRunSummary = {
      ...mockSummary,
      items: [
        {
          sampleId: "success-sample",
          title: "Success",
          success: true,
          responseRaw: {
            visualAnalysis: {
              visualInfo: {
                imageKind: "productPhoto",
                imageKindConfidence: 0.95,
                visibleElements: [{ label: "logo", category: "brand" }],
                visibleText: ["BrandX"]
              },
              indexing: {
                keywords: ["kw1"]
              }
            }
          }
        }
      ]
    };
    const report = buildBatchReportForChat(summaryWithVisual);
    const item = report.items[0];
    assert.ok(item.detected);
    assert.strictEqual(item.detected.imageKind, "productPhoto");
    assert.strictEqual(item.detected.imageKindConfidence, 0.95);
    assert.deepEqual(item.detected.visibleElements, [{ label: "logo", category: "brand", confidence: undefined, attributes: undefined }]);
    assert.deepEqual(item.detected.visibleText, [{ text: "BrandX", confidence: undefined, locationHint: undefined, language: undefined }]);
    assert.deepEqual(item.detected.keywords, [{ value: "kw1", confidence: undefined, importance: undefined }]);
  });

  test('should handle legacy analysisRun.metadata fallback', () => {
    const summaryLegacy: PublicSampleBatchRunSummary = {
      ...mockSummary,
      items: [
        {
          sampleId: "legacy-sample",
          title: "Legacy",
          success: true,
          analysisRun: {
            metadata: {
              model: { name: "legacy-model", providerFamily: "gemini" },
              execution: { structuredExecutionMode: "jsonSchema", jsonMode: true }
            }
          }
        }
      ]
    };
    const report = buildBatchReportForChat(summaryLegacy);
    const item = report.items[0];
    assert.ok(item.execution);
    assert.strictEqual(item.execution.modelName, "legacy-model");
    assert.strictEqual(item.execution.providerFamily, "gemini");
    assert.strictEqual(item.execution.structuredExecutionMode, "jsonSchema");
  });

  test('should include execution and inputDiagnostics for generation failures', () => {
    const summaryFailure: PublicSampleBatchRunSummary = {
      ...mockSummary,
      items: [
        {
          sampleId: "failed-sample",
          title: "Failed",
          success: false,
          analysisRun: {
            model: { name: "failed-model", providerFamily: "gemini" },
            execution: { structuredExecutionMode: "jsonSchema", jsonMode: true }
          },
          inputDiagnostics: {
            sourceKind: "publicSample",
            sampleId: "failed-sample",
            mimeType: "image/png",
            byteLength: 1000,
            base64Length: 1334
          }
        }
      ]
    };
    const report = buildBatchReportForChat(summaryFailure);
    const item = report.items[0];
    assert.ok(item.execution);
    assert.strictEqual(item.execution.modelName, "failed-model");
    assert.strictEqual(item.execution.providerFamily, "gemini");
    assert.ok(item.inputDiagnostics);
    assert.strictEqual(item.inputDiagnostics.mimeType, "image/png");
    assert.strictEqual(item.inputDiagnostics.byteLength, 1000);
  });

  test('buildFailuresOnlyReport should include only failures', () => {
    const report = buildFailuresOnlyReport(mockSummary);
    assert.strictEqual(report.totalFailures, 1);
    assert.strictEqual(report.items.length, 1);
    assert.strictEqual(report.items[0].sampleId, "fail-sample");
    assert.ok(report.artifactIntegrity);
    assert.strictEqual(report.artifactIntegrity.endSentinel, "END_OF_VISUAL_ANALYSIS_FAILURES_ONLY");
  });

  test('should include artifactIntegrity endSentinel in report', () => {
    const report = buildBatchReportForChat(mockSummary);
    assert.ok(report.artifactIntegrity);
    assert.strictEqual(report.artifactIntegrity.artifactKind, "diagnostic");
    assert.strictEqual(report.artifactIntegrity.endSentinel, "END_OF_VISUAL_ANALYSIS_BATCH_DIAGNOSTIC");
  });

  test('buildBatchSummaryReportForChat should generate a small summary report', () => {
    const summaryReport = buildBatchSummaryReportForChat(mockSummary);
    assert.strictEqual(summaryReport.reportKind, "visualAnalysisPublicSampleBatchSummary");
    assert.ok(summaryReport.artifactIntegrity);
    assert.strictEqual(summaryReport.artifactIntegrity.artifactKind, "summary");
    assert.strictEqual(summaryReport.artifactIntegrity.endSentinel, "END_OF_VISUAL_ANALYSIS_BATCH_SUMMARY");
    
    const successItem = summaryReport.items[0];
    assert.strictEqual(successItem.parseDiagnostics, undefined);
    assert.strictEqual(successItem.detected, undefined);
  });

  test('buildFullItemReport should generate a full item report', () => {
    const item = mockSummary.items[0];
    const itemReport = buildFullItemReport(item);
    assert.strictEqual(itemReport.reportKind, "visualAnalysisPublicSampleItemReport");
    assert.ok(itemReport.artifactIntegrity);
    assert.strictEqual(itemReport.artifactIntegrity.artifactKind, "item");
    assert.strictEqual(itemReport.artifactIntegrity.endSentinel, "END_OF_VISUAL_ANALYSIS_ITEM_REPORT");
  });
});
