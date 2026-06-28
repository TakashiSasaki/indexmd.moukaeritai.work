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
    const summaryWithComp: PublicSampleBatchRunSummary = {
      ...mockSummary,
      items: [
        {
          sampleId: "success-sample",
          title: "Success",
          success: true,
          qualityStatus: "valid",
          comparison: {
            imageKind: { expected: "naturalPhoto", detected: "naturalPhoto", status: "exact" },
            categories: { matched: ["logo"], acceptable: [], missing: [], extra: [], matches: [] },
            labels: { matched: ["sunflower"], acceptable: [], missing: [], extra: [], matches: [] },
            visibleText: { matched: [], missing: [] },
            overallStatus: "pass",
            reasons: [],
            reviewStatus: "pass",
            reviewReasons: [],
            reviewNotes: ["excellent match"],
            coverage: {
              categories: { expectedTotal: 1, covered: 1, missing: 0, ratio: 1.0 },
              labels: { expectedTotal: 1, covered: 1, missing: 0, ratio: 1.0 },
              visibleText: { expectedTotal: 0, covered: 0, missing: 0, ratio: 1.0 },
              overall: { expectedTotal: 2, covered: 2, missing: 0, ratio: 1.0 }
            }
          } as any
        }
      ]
    };

    const summaryReport = buildBatchSummaryReportForChat(summaryWithComp);
    assert.strictEqual(summaryReport.reportKind, "visualAnalysisPublicSampleBatchSummary");
    assert.ok(summaryReport.artifactIntegrity);
    assert.strictEqual(summaryReport.artifactIntegrity.artifactKind, "summary");
    assert.strictEqual(summaryReport.artifactIntegrity.endSentinel, "END_OF_VISUAL_ANALYSIS_BATCH_SUMMARY");
    
    const successItem = summaryReport.items[0];
    assert.strictEqual(successItem.parseDiagnostics, undefined);
    assert.strictEqual(successItem.detected, undefined);
    assert.ok(successItem.coverage);
    assert.strictEqual(successItem.coverageOverall, 1.0);
    assert.deepEqual(successItem.reviewNotes, ["excellent match"]);
  });

  test('buildFullItemReport should generate a full item report', () => {
    const item = mockSummary.items[0];
    const itemReport = buildFullItemReport(item);
    assert.strictEqual(itemReport.reportKind, "visualAnalysisPublicSampleItemReport");
    assert.ok(itemReport.artifactIntegrity);
    assert.strictEqual(itemReport.artifactIntegrity.artifactKind, "item");
    assert.strictEqual(itemReport.artifactIntegrity.endSentinel, "END_OF_VISUAL_ANALYSIS_ITEM_REPORT");
  });

  test('should keep parse, generation, and API response summaries non-overlapping', () => {
    const mixedSummary: PublicSampleBatchRunSummary = {
      runId: "run-mixed",
      timestamp: "2026-06-28",
      modelName: "test-model",
      jsonMode: "standard",
      total: 3,
      successCount: 0,
      failureCount: 3,
      validCount: 0,
      validLowQualityCount: 0,
      invalidJsonCount: 1,
      expectedComparisonPassCount: 0,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 0,
      items: [
        {
          sampleId: "parse-fail",
          title: "Parse Fail",
          success: false,
          failureKind: "jsonParseError",
          error: "JSON error"
        },
        {
          sampleId: "api-fail",
          title: "API Fail",
          success: false,
          failureKind: "apiError",
          responseDiagnostics: {
            status: 500,
            contentType: "text/html",
            bodyLength: 200,
            bodyPreview: "Internal Error"
          } as any
        },
        {
          sampleId: "provider-fail",
          title: "Provider Fail",
          success: false,
          failureKind: "generationError",
          generationDiagnostics: {
            providerStatus: "RESOURCE_EXHAUSTED",
            statusCode: 429
          }
        }
      ]
    };

    const report = buildBatchReportForChat(mixedSummary);
    
    // Assert non-overlapping counts
    assert.strictEqual(report.parseFailureSummary.total, 1);
    assert.strictEqual(report.parseFailureSummary.samples[0].sampleId, "parse-fail");

    assert.strictEqual(report.apiResponseFailureSummary.total, 1);
    assert.strictEqual(report.apiResponseFailureSummary.samples[0].sampleId, "api-fail");

    assert.strictEqual(report.generationFailureSummary.total, 1);
    assert.strictEqual(report.generationFailureSummary.largestInputs.length, 0); // No input size diag provided
  });

  test('should compile mediaResolution diagnostics correctly', () => {
    const summaryWithMedia: PublicSampleBatchRunSummary = {
      runId: "run-media",
      timestamp: "2026-06-28",
      modelName: "test-model",
      jsonMode: "standard",
      total: 1,
      successCount: 1,
      failureCount: 0,
      validCount: 1,
      validLowQualityCount: 0,
      invalidJsonCount: 0,
      expectedComparisonPassCount: 0,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 0,
      items: [
        {
          sampleId: "sample-media",
          title: "Media",
          success: true,
          analysisRun: {
            metadata: {
              runId: "run-1",
              timestamp: "2026-06-28",
              model: { name: "gemini-1.5-pro", providerFamily: "gemini" },
              generationConfig: {
                mediaResolutionRequested: "HIGH",
                mediaResolutionConfigured: true,
                mediaResolutionProviderAccepted: true,
                mediaResolutionApplied: true,
                mediaResolutionFallbackUsed: false
              }
            } as any
          }
        }
      ]
    };

    const report = buildBatchReportForChat(summaryWithMedia);
    assert.strictEqual(report.inputSizeSummary.mediaResolution.highRequested, 1);
    assert.strictEqual(report.inputSizeSummary.mediaResolution.mediumRequested, 0);
    assert.strictEqual(report.inputSizeSummary.mediaResolution.configured, 1);
    assert.strictEqual(report.inputSizeSummary.mediaResolution.providerAccepted, 1);
    assert.strictEqual(report.inputSizeSummary.mediaResolution.applied, 1);
    assert.strictEqual(report.inputSizeSummary.mediaResolution.fallbackUsed, 0);
  });

  test('should aggregate cache diagnostics and verify sharedInFlight does not inflate other counts', () => {
    const summaryWithCache: PublicSampleBatchRunSummary = {
      runId: "run-cache",
      timestamp: "2026-06-28",
      modelName: "test-model",
      jsonMode: "standard",
      total: 6,
      successCount: 6,
      failureCount: 0,
      validCount: 6,
      validLowQualityCount: 0,
      invalidJsonCount: 0,
      expectedComparisonPassCount: 0,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 0,
      items: [
        {
          sampleId: "s1",
          title: "S1",
          success: true,
          inputDiagnostics: {
            sourceKind: "publicSample",
            sampleId: "s1",
            mimeType: "image/png",
            byteLength: 100,
            cacheLayer: "memory"
          }
        },
        {
          sampleId: "s2",
          title: "S2",
          success: true,
          inputDiagnostics: {
            sourceKind: "publicSample",
            sampleId: "s2",
            mimeType: "image/png",
            byteLength: 100,
            cacheLayer: "disk"
          }
        },
        {
          sampleId: "s3",
          title: "S3",
          success: true,
          inputDiagnostics: {
            sourceKind: "publicSample",
            sampleId: "s3",
            mimeType: "image/png",
            byteLength: 100,
            cacheLayer: "miss",
            cacheStored: true
          }
        },
        {
          sampleId: "s4",
          title: "S4",
          success: true,
          inputDiagnostics: {
            sourceKind: "publicSample",
            sampleId: "s4",
            mimeType: "image/png",
            byteLength: 100,
            cacheLayer: "miss",
            cacheStored: true,
            cacheSharedInFlight: true
          }
        },
        {
          sampleId: "s5",
          title: "S5",
          success: true,
          inputDiagnostics: {
            sourceKind: "publicSample",
            sampleId: "s5",
            mimeType: "image/png",
            byteLength: 100,
            cacheLayer: "miss",
            cacheReadError: "read failed"
          }
        },
        {
          sampleId: "s6",
          title: "S6",
          success: true,
          inputDiagnostics: {
            sourceKind: "publicSample",
            sampleId: "s6",
            mimeType: "image/png",
            byteLength: 100,
            cacheLayer: "miss",
            cacheWriteError: "write failed"
          }
        }
      ]
    };

    const report = buildBatchReportForChat(summaryWithCache);
    const cacheReport = report.inputSizeSummary.cache;
    
    assert.strictEqual(cacheReport.memoryHits, 1);
    assert.strictEqual(cacheReport.diskHits, 1);
    
    // s3, s5, s6 should count as misses (s4 is sharedInFlight and exclusive)
    assert.strictEqual(cacheReport.misses, 3);
    
    // s3 should count as stored (s4 is sharedInFlight and exclusive)
    assert.strictEqual(cacheReport.stored, 1);
    
    // s4 is sharedInFlight
    assert.strictEqual(cacheReport.sharedInFlight, 1);
    
    // read and write errors
    assert.strictEqual(cacheReport.readErrors, 1);
    assert.strictEqual(cacheReport.writeErrors, 1);
  });
});
