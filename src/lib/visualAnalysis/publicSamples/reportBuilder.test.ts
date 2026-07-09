import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  buildBatchAnalysisBundleForChat,
  buildTextHeavyEvaluationSummary,
  isProviderRateLimitFailure, 
  isProviderQuotaFailure,
  isProviderGenerationFailure,
  validateBatchRunInvariants,
  normalizeLegacyBatchRunItem,
  buildComparisonRecordConsistency
} from './reportBuilder';

describe("Visual Analysis Report Classification Helpers", () => {
  it("should classify rate limit failures correctly using record-centric diagnostics", () => {
    const recordItem: any = {
      success: false,
      failureKind: "generationError",
      record: {
        diagnostics: {
          generation: {
            statusCode: 429,
            providerStatus: "RESOURCE_EXHAUSTED"
          }
        }
      }
    };

    assert.strictEqual(isProviderRateLimitFailure(recordItem), true, "Should be rate limit via status 429");
    assert.strictEqual(isProviderQuotaFailure(recordItem), true, "Should also be quota failure via status code/status");
    assert.strictEqual(isProviderGenerationFailure(recordItem), false, "Should NOT be generic generation failure");
  });

  it("should classify explicit providerRateLimited failure", () => {
    const item: any = {
      success: false,
      failureKind: "providerRateLimited"
    };

    assert.strictEqual(isProviderRateLimitFailure(item), true);
    assert.strictEqual(isProviderGenerationFailure(item), false);
  });
});

describe('Record-centric counterConsistency and textHeavyEvaluation in reportBuilder', () => {
  it('buildBatchAnalysisBundleForChat includes counterConsistency, textHeavyEvaluation, and comparisonCoverage', () => {
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
          record: {
            assetMetadata: { id: "test-1", title: "Test Title", category: "test-cat", licenseName: "Apache-2.0" },
            evaluation: {
              qualityStatus: "valid",
              expectedMetadata: {
                imageKind: "diagram",
                visibleText: [{ text: "Hello", locationHint: "center", language: "en" }]
              }
            },
            analysisRun: {
              model: { name: "gemini-3.5-flash", providerFamily: "gemini" },
              execution: {
                modelName: "gemini-3.5-flash",
                providerFamily: "gemini",
                structuredExecutionMode: "json",
                jsonMode: "native"
              }
            }
          },
          comparison: {
            overallStatus: "pass",
            reviewStatus: "pass",
            coverage: {
              visibleText: { expectedTotal: 10, covered: 5, missing: 5, ratio: 0.5 }
            }
          }
        }
      ]
    } as any;

    const report = buildBatchAnalysisBundleForChat(dummyBatchSummary);
    assert.strictEqual(report.counterConsistency.expectedComparison.consistent, true);
    assert.strictEqual(report.counterConsistency.review.consistent, true);
    assert.ok(report.textHeavyEvaluation);
    assert.strictEqual(report.textHeavyEvaluation.itemsWithTextExpectation, 1);
    assert.strictEqual(report.textHeavyEvaluation.visibleTextCovered, 5);
    assert.strictEqual(report.textHeavyEvaluation.ratio, 0.5);
    assert.ok(report.comparisonCoverage);
    assert.strictEqual(report.comparisonCoverage.consistent, true);
    assert.strictEqual(report.comparisonCoverage.itemsWithExpectedMetadata, 1);
    assert.strictEqual(report.comparisonCoverage.itemsWithComparison, 1);
  });
});

describe('validateBatchRunInvariants (Record-centric & Strict Invariants)', () => {
  it('should pass on valid record-centric data', () => {
    const validBatchSummary = {
      modelName: "gemini-2.5-flash",
      jsonMode: "native_schema",
      total: 1,
      successCount: 1,
      items: [
        {
          sampleId: "sample-1",
          success: true,
          record: {
            assetMetadata: { id: "sample-1", title: "Sample 1" },
            evaluation: {
              expectedMetadata: {
                imageKind: "diagram",
                visibleText: [{ text: "test" }]
              }
            }
          },
          comparison: {
            overallStatus: "pass",
            reviewStatus: "pass",
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

  it('should detect missing comparison object for success items with expectedMetadata', () => {
    const invalidBatchSummary = {
      modelName: "gemini-2.5-flash",
      jsonMode: "native_schema",
      total: 1,
      successCount: 1,
      items: [
        {
          sampleId: "sample-1",
          success: true,
          record: {
            evaluation: {
              expectedMetadata: {
                imageKind: "diagram"
              }
            }
          }
          // comparison is missing
        }
      ]
    } as any;

    const result = validateBatchRunInvariants(invalidBatchSummary);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(issue => issue.includes("missing comparison object") || issue.includes("comparisons missing")));
  });

  it('should detect invalid comparison reviewStatus', () => {
    const invalidBatchSummary = {
      modelName: "gemini-2.5-flash",
      jsonMode: "native_schema",
      total: 1,
      items: [
        {
          sampleId: "sample-1",
          success: true,
          record: {
            evaluation: {
              expectedMetadata: { imageKind: "diagram" }
            }
          },
          comparison: {
            overallStatus: "pass",
            reviewStatus: "invalid_review_status", // must be pass, needsReview, fail
            coverage: {
              visibleText: { expectedTotal: 5, covered: 5, missing: 0, ratio: 1.0 }
            }
          }
        }
      ]
    } as any;

    const result = validateBatchRunInvariants(invalidBatchSummary);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(issue => issue.includes("comparison reviewStatus is invalid")));
  });

  it('should detect expectedMetadata.visibleText exists but comparison.coverage.visibleText is missing', () => {
    const invalidBatchSummary = {
      modelName: "gemini-2.5-flash",
      jsonMode: "native_schema",
      total: 1,
      items: [
        {
          sampleId: "sample-1",
          success: true,
          record: {
            evaluation: {
              expectedMetadata: {
                imageKind: "diagram",
                visibleText: [{ text: "Hello" }]
              }
            }
          },
          comparison: {
            overallStatus: "pass",
            reviewStatus: "pass",
            coverage: {
              // visibleText missing
            }
          }
        }
      ]
    } as any;

    const result = validateBatchRunInvariants(invalidBatchSummary);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(issue => issue.includes("expectedMetadata.visibleText exists but comparison.coverage.visibleText is missing")));
  });

  it('should detect record.technicalMetadata.processedByteLength exists but totalProcessedBytes is 0 at batch level', () => {
    const invalidBatchSummary = {
      modelName: "gemini-2.5-flash",
      jsonMode: "native_schema",
      total: 1,
      items: [
        {
          sampleId: "sample-1",
          success: true,
          record: {
            technicalMetadata: {
              processedByteLength: 1000 // exists
            }
          },
          comparison: {
            overallStatus: "pass",
            reviewStatus: "pass",
            coverage: {
              visibleText: { expectedTotal: 5, covered: 5, missing: 0, ratio: 1.0 }
            }
          }
          // inputDiagnostics is missing or processedByteLength is 0
        }
      ]
    } as any;

    const result = validateBatchRunInvariants(invalidBatchSummary);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(issue => issue.includes("Some records have technicalMetadata.processedByteLength, but batch-level inputSizeSummary.totalProcessedBytes is 0")));
  });
});

describe("Legacy reportBuilder fallbacks and normalization", () => {
  it("normalizeLegacyBatchRunItem should successfully reconstruct record structure from responseRaw", () => {
    const legacyItem: any = {
      sampleId: "legacy-1",
      title: "Legacy Title",
      success: true,
      responseRaw: {
        qualityStatus: "valid",
        qualityScore: 95,
        sampleMetadata: {
          id: "legacy-1",
          title: "Legacy Title",
          category: "legacy-cat",
          licenseName: "MIT"
        },
        expectedMetadata: {
          imageKind: "screenshot"
        },
        analysisRun: {
          usedModelName: "legacy-model",
          providerFamily: "legacy-provider"
        }
      }
    };

    const normalized = normalizeLegacyBatchRunItem(legacyItem);
    assert.ok(normalized.record);
    assert.strictEqual(normalized.record.assetMetadata?.category, "legacy-cat");
    assert.strictEqual(normalized.record.evaluation?.qualityStatus, "valid");
    assert.strictEqual(normalized.record.evaluation?.qualityScore, 95);
    assert.strictEqual(normalized.record.evaluation?.expectedMetadata?.imageKind, "screenshot");
  });
});

describe("Comparison Record Consistency and Invariants", () => {
  it("should evaluate comparison consistency successfully", () => {
    const items: any[] = [
      {
        sampleId: "s-1",
        title: "S1",
        success: true,
        record: {
          evaluation: {
            qualityStatus: "valid",
            expectedMetadata: {
              imageKind: "landscapePhoto",
              elementCategories: ["plant"],
              visibleText: ["flower"]
            }
          },
          visualAnalysis: {
            visualInfo: {
              imageKind: "landscapePhoto",
              visibleElements: [{ category: "plant" }],
              visibleText: [{ text: "beautiful flower" }]
            }
          }
        },
        comparison: {
          imageKind: { detected: "landscapePhoto", status: "exact" },
          categories: { matched: ["plant"] },
          visibleText: { matched: ["flower"] },
          overallStatus: "pass"
        }
      }
    ];

    const consistency = buildComparisonRecordConsistency(items);
    assert.strictEqual(consistency.consistent, true);
    assert.strictEqual(consistency.itemsWithRecordVisualAnalysis, 1);
    assert.strictEqual(consistency.itemsWithImageKindMismatch, 0);
  });

  it("should detect suspicious all comparison fail invariant", () => {
    const items: any[] = [
      {
        sampleId: "s-1",
        title: "S1",
        success: true,
        record: {
          evaluation: {
            qualityStatus: "valid",
            expectedMetadata: {
              imageKind: "landscapePhoto"
            }
          },
          visualAnalysis: {
            visualInfo: {
              imageKind: "landscapePhoto"
            }
          }
        },
        comparison: {
          imageKind: { detected: "landscapePhoto", status: "exact" },
          overallStatus: "fail" // explicitly failed comparison
        }
      }
    ];

    const consistency = buildComparisonRecordConsistency(items);
    assert.strictEqual(consistency.suspiciousAllComparisonFail, true);

    const batchSummary: any = {
      modelName: "test-model",
      jsonMode: "prompted_json",
      total: 1,
      successCount: 1,
      failureCount: 0,
      validCount: 1,
      items
    };

    const result = validateBatchRunInvariants(batchSummary);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(issue => issue.includes("Suspicious run: all 1 successful items with visual analysis failed in comparison.")));
  });
});
