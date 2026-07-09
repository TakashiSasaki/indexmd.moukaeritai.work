import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  buildBatchSummaryReportForChat, 
  buildBatchDiagnosticReportForChat,
  buildTextHeavyEvaluationSummary,
  isProviderRateLimitFailure, 
  isProviderQuotaFailure,
  isProviderGenerationFailure,
  validateBatchRunInvariants
} from './reportBuilder';

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
  it('buildBatchSummaryReportForChat includes counterConsistency and textHeavyEvaluation', () => {
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
    assert.strictEqual(report.counterConsistency.expectedComparison.consistent, true);
    assert.strictEqual(report.counterConsistency.review.consistent, true);
    assert.ok(report.textHeavyEvaluation);
    assert.strictEqual(report.textHeavyEvaluation.itemsWithTextExpectation, 1);
    assert.strictEqual(report.textHeavyEvaluation.visibleTextCovered, 5);
    assert.strictEqual(report.textHeavyEvaluation.ratio, 0.5);
    assert.strictEqual(report.textHeavyEvaluation.mediaResolution.mediumRequested, 1);
  });

  it('counterConsistency detects mismatch in review status counts', () => {
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
    assert.strictEqual(report.counterConsistency.review.consistent, false);
    assert.deepStrictEqual(report.counterConsistency.review.declared, {
      pass: 0,
      needsReview: 0,
      fail: 0
    });
    assert.deepStrictEqual(report.counterConsistency.review.recomputed, {
      pass: 1,
      needsReview: 0,
      fail: 0
    });
  });

  it('buildBatchDiagnosticReportForChat includes counterConsistency.expectedComparison and review', () => {
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
            reviewStatus: "pass"
          }
        }
      ]
    } as any;

    const report = buildBatchDiagnosticReportForChat(dummyBatchSummary);
    assert.ok(report.counterConsistency.expectedComparison);
    assert.ok(report.counterConsistency.review);
    assert.strictEqual(report.counterConsistency.expectedComparison.consistent, true);
    assert.strictEqual(report.counterConsistency.review.consistent, true);
  });

  it('reviewNeedsReviewCount is recomputed from comparison.reviewStatus === "needsReview"', () => {
    const dummyBatchSummary = {
      total: 1,
      reviewPassCount: 0,
      reviewNeedsReviewCount: 1,
      reviewFailCount: 0,
      items: [
        {
          sampleId: "test-1",
          success: true,
          comparison: {
            reviewStatus: "needsReview"
          }
        }
      ]
    } as any;

    const report = buildBatchSummaryReportForChat(dummyBatchSummary);
    assert.strictEqual(report.counterConsistency.review.consistent, true);
    assert.strictEqual(report.counterConsistency.review.recomputed.needsReview, 1);
  });

  it('reviewStatus === "needs_review" is not counted as current needsReview', () => {
    const dummyBatchSummary = {
      total: 1,
      reviewPassCount: 0,
      reviewNeedsReviewCount: 0,
      reviewFailCount: 0,
      items: [
        {
          sampleId: "test-1",
          success: true,
          comparison: {
            reviewStatus: "needs_review" // Old typo
          }
        }
      ]
    } as any;

    const report = buildBatchSummaryReportForChat(dummyBatchSummary);
    // It shouldn't be counted as needsReview since we only match "needsReview"
    assert.strictEqual(report.counterConsistency.review.recomputed.needsReview, 0);
  });

  it('textHeavyEvaluation aggregates visibleText coverage', () => {
    const items = [
      {
        sampleId: "s1",
        comparison: {
          coverage: {
            visibleText: { expectedTotal: 5, covered: 4, missing: 1, ratio: 0.8 }
          }
        },
        analysisRun: { metadata: { generationConfig: { mediaResolutionRequested: "HIGH" } } }
      },
      {
        sampleId: "s2",
        comparison: {
          coverage: {
            visibleText: { expectedTotal: 5, covered: 2, missing: 3, ratio: 0.4 }
          }
        },
        analysisRun: { metadata: { generationConfig: { mediaResolutionRequested: "MEDIUM" } } }
      }
    ];

    const evaluation = buildTextHeavyEvaluationSummary(items);
    assert.strictEqual(evaluation.itemsWithTextExpectation, 2);
    assert.strictEqual(evaluation.expectedVisibleTextTotal, 10);
    assert.strictEqual(evaluation.visibleTextCovered, 6);
    assert.strictEqual(evaluation.textMissing, 4);
    assert.strictEqual(evaluation.ratio, 0.6);
  });

  it('textHeavyEvaluation reads mediaResolutionRequested from alternative structures in analysisRun', () => {
    const items = [
      {
        sampleId: "s1",
        comparison: {
          coverage: {
            visibleText: { expectedTotal: 1, covered: 1, missing: 0, ratio: 1 }
          }
        },
        record: { analysisRun: { generationConfig: { mediaResolutionRequested: "HIGH" } } }
      },
      {
        sampleId: "s2",
        comparison: {
          coverage: {
            visibleText: { expectedTotal: 1, covered: 1, missing: 0, ratio: 1 }
          }
        },
        record: { analysisRun: { metadata: { generationConfig: { mediaResolutionRequested: "MEDIUM" } } } }
      }
    ];

    const evaluation = buildTextHeavyEvaluationSummary(items as any);
    assert.strictEqual(evaluation.mediaResolution.highRequested, 1);
    assert.strictEqual(evaluation.mediaResolution.mediumRequested, 1);
  });

  it('textHeavyEvaluation marks possibleResolutionLimited when visibleText missing and mediaResolutionRequested is not HIGH', () => {
    const items = [
      {
        sampleId: "s1",
        comparison: {
          coverage: {
            visibleText: { expectedTotal: 5, covered: 2, missing: 3, ratio: 0.4 }
          }
        },
        analysisRun: { generationConfig: { mediaResolutionRequested: "MEDIUM" } } // Not HIGH
      }
    ];

    const evaluation = buildTextHeavyEvaluationSummary(items);
    assert.strictEqual(evaluation.possibleResolutionLimitedCount, 1);
    assert.strictEqual(evaluation.samples[0].possibleResolutionLimited, true);
  });
});

describe('validateBatchRunInvariants', () => {
  it('should pass on valid batch summary data', () => {
    const validBatchSummary = {
      modelName: "gemini-2.5-flash",
      jsonMode: "native_schema",
      total: 1,
      successCount: 1,
      items: [
        {
          sampleId: "sample-1",
          success: true,
          comparison: {
            overallStatus: "pass",
            coverage: {
              visibleText: { expectedTotal: 10, covered: 8, missing: 2, ratio: 0.8 }
            }
          }
        }
      ]
    } as any;

    const result = validateBatchRunInvariants(validBatchSummary);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.issues.length, 0);
  });

  it('should detect missing comparison object for success items', () => {
    const invalidBatchSummary = {
      modelName: "gemini-2.5-flash",
      jsonMode: "native_schema",
      total: 1,
      successCount: 1,
      items: [
        {
          sampleId: "sample-1",
          success: true
          // comparison is missing
        }
      ]
    } as any;

    const result = validateBatchRunInvariants(invalidBatchSummary);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(issue => issue.includes("missing a comparison object")));
  });

  it('should detect invalid overallStatus', () => {
    const invalidBatchSummary = {
      modelName: "gemini-2.5-flash",
      jsonMode: "native_schema",
      total: 1,
      items: [
        {
          sampleId: "sample-1",
          success: true,
          comparison: {
            overallStatus: "invalid_status",
            coverage: {
              visibleText: { expectedTotal: 5, covered: 5, missing: 0, ratio: 1.0 }
            }
          }
        }
      ]
    } as any;

    const result = validateBatchRunInvariants(invalidBatchSummary);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(issue => issue.includes("comparison overallStatus is invalid")));
  });

  it('should detect mismatch in visibleText expectedTotal and covered + missing', () => {
    const invalidBatchSummary = {
      modelName: "gemini-2.5-flash",
      jsonMode: "native_schema",
      total: 1,
      items: [
        {
          sampleId: "sample-1",
          success: true,
          comparison: {
            overallStatus: "pass",
            coverage: {
              visibleText: { expectedTotal: 10, covered: 5, missing: 4, ratio: 0.5 } // 5 + 4 = 9 !== 10
            }
          }
        }
      ]
    } as any;

    const result = validateBatchRunInvariants(invalidBatchSummary);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(issue => issue.includes("expectedTotal (10) does not match covered (5) + missing (4)")));
  });
});
