import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildBatchSummaryReportForChat } from './reportBuilder';
import { describe, it } from "node:test";
import { 
  isProviderRateLimitFailure, 
  isProviderQuotaFailure,
  isProviderGenerationFailure
} from "./reportBuilder";
import { PublicSampleBatchRunItem } from "./batchTypes";

describe("Visual Analysis Report Classification Helpers", () => {
  it("should classify legacy rate limit failures correctly", () => {
    const legacyItem: any = {
      success: false,
      failureKind: "generationError",
      generationDiagnostics: {
        statusCode: 429,
        providerStatus: "RESOURCE_EXHAUSTED"
      }
    };

    assert.strictEqual(isProviderRateLimitFailure(legacyItem), true, "Should be rate limit via status 429");
    assert.strictEqual(isProviderQuotaFailure(legacyItem), true, "Should also be quota failure via status code/status");
    assert.strictEqual(isProviderGenerationFailure(legacyItem), false, "Should NOT be generic generation failure");
  });

  it("should classify explicit providerRateLimited failure", () => {
    const item: any = {
      success: false,
      failureKind: "providerRateLimited"
    };

    assert.strictEqual(isProviderRateLimitFailure(item), true);
    assert.strictEqual(isProviderGenerationFailure(item), false);
  });

  it("should classify legacy quota failure correctly", () => {
    const legacyItem: any = {
      success: false,
      failureKind: "generationError",
      generationDiagnostics: {
        statusCode: 403,
        providerStatus: "QUOTA_EXCEEDED"
      }
    };

    assert.strictEqual(isProviderRateLimitFailure(legacyItem), false);
    assert.strictEqual(isProviderQuotaFailure(legacyItem), true);
    assert.strictEqual(isProviderGenerationFailure(legacyItem), false);
  });

  it("should classify generic generation failure", () => {
    const item: any = {
      success: false,
      failureKind: "generationError",
      generationDiagnostics: {
        statusCode: 500,
        providerStatus: "INTERNAL"
      }
    };

    assert.strictEqual(isProviderRateLimitFailure(item), false);
    assert.strictEqual(isProviderQuotaFailure(item), false);
    assert.strictEqual(isProviderGenerationFailure(item), true);
  });

  it("should handle rateLimited: true fallback", () => {
    const item: any = {
      success: false,
      failureKind: "generationError",
      generationDiagnostics: {
        rateLimited: true
      }
    };
    assert.strictEqual(isProviderRateLimitFailure(item), true);
  });

  it("should handle quotaExceeded: true fallback", () => {
    const item: any = {
      success: false,
      failureKind: "generationError",
      generationDiagnostics: {
        quotaExceeded: true
      }
    };
    assert.strictEqual(isProviderQuotaFailure(item), true);
  });
});

describe('counterConsistency and textHeavyEvaluation in reportBuilder', () => {
  test('buildBatchSummaryReportForChat includes counterConsistency and textHeavyEvaluation', () => {
    const dummyBatchSummary = {
      modelName: "gemini-3.5-flash",
      jsonMode: "native_schema",
      total: 1,
      successCount: 1,
      failureCount: 0,
      validCount: 1,
      validLowQualityCount: 0,
      invalidJsonCount: 0,
      expectedComparisonPassCount: 1,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 0,
      reviewPassCount: 1,
      reviewNeedsReviewCount: 0,
      reviewFailCount: 0,
      items: [
        {
          sampleId: "test-1",
          success: true,
          comparison: {
            overallStatus: "pass",
            reviewStatus: "pass",
            coverage: {
              visibleText: { expectedTotal: 10, covered: 5, missing: 5, ratio: 0.5 }
            }
          },
          analysisRun: { metadata: { generationConfig: { mediaResolutionRequested: "MEDIUM" } } }
        }
      ]
    } as any;

    const report = buildBatchSummaryReportForChat(dummyBatchSummary);
    assert.strictEqual(report.counterConsistency, true);
    assert.ok(report.textHeavyEvaluation);
    assert.strictEqual(report.textHeavyEvaluation.itemsWithTextExpectation, 1);
    assert.strictEqual(report.textHeavyEvaluation.visibleTextCovered, 5);
    assert.strictEqual(report.textHeavyEvaluation.ratio, 0.5);
    assert.strictEqual(report.textHeavyEvaluation.mediaResolution.mediumRequested, 1);
  });

  test('counterConsistency detects mismatch in review status counts', () => {
    const dummyBatchSummary = {
      total: 1,
      reviewPassCount: 0, // Declared 0 pass
      reviewNeedsReviewCount: 0,
      reviewFailCount: 0,
      items: [
        {
          sampleId: "test-1",
          success: true,
          comparison: {
            reviewStatus: "pass" // Actually 1 pass
          }
        }
      ]
    } as any;

    const report = buildBatchSummaryReportForChat(dummyBatchSummary);
    assert.strictEqual(report.counterConsistency, false);
  });
});
