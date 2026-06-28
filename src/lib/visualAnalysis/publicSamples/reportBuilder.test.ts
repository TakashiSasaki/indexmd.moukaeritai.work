import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildBatchReportForChat, buildFailuresOnlyReport } from './reportBuilder';
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

  test('buildFailuresOnlyReport should include only failures', () => {
    const report = buildFailuresOnlyReport(mockSummary);
    assert.strictEqual(report.totalFailures, 1);
    assert.strictEqual(report.items.length, 1);
    assert.strictEqual(report.items[0].sampleId, "fail-sample");
  });
});
