import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildBatchComparisonReportForChat } from './comparisonReport';
import { PublicSampleBatchRunSummary } from './batchTypes';

describe('Public Sample Batch Comparison Report', () => {
  it('should build a structured comparison report from multiple batch run summaries', () => {
    const runNative: PublicSampleBatchRunSummary = {
      runId: 'run-native-123',
      timestamp: '2026-06-28T00:00:00Z',
      modelName: 'gemini-3.5-flash',
      jsonMode: 'native_schema',
      total: 2,
      successCount: 2,
      failureCount: 0,
      validCount: 2,
      validLowQualityCount: 0,
      invalidJsonCount: 0,
      expectedComparisonPassCount: 2,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 0,
      reviewPassCount: 2,
      reviewNeedsReviewCount: 0,
      reviewFailCount: 0,
      items: [
        {
          sampleId: 'sample-1',
          title: 'Sample 1',
          success: true,
          qualityStatus: 'pass',
          qualityScore: 1.0,
          comparison: {
            reviewStatus: 'pass',
            overallStatus: 'pass'
          } as any,
          responseRaw: {
            sampleMetadata: { category: 'charts' }
          }
        },
        {
          sampleId: 'sample-2',
          title: 'Sample 2',
          success: true,
          qualityStatus: 'pass',
          qualityScore: 1.0,
          comparison: {
            reviewStatus: 'pass',
            overallStatus: 'pass'
          } as any,
          responseRaw: {
            sampleMetadata: { category: 'tables' }
          }
        }
      ]
    };

    const runPrompted: PublicSampleBatchRunSummary = {
      runId: 'run-prompted-456',
      timestamp: '2026-06-28T00:01:00Z',
      modelName: 'gemini-3.5-flash',
      jsonMode: 'prompted_json',
      total: 2,
      successCount: 1,
      failureCount: 1,
      validCount: 1,
      validLowQualityCount: 0,
      invalidJsonCount: 1,
      expectedComparisonPassCount: 1,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 1,
      reviewPassCount: 1,
      reviewNeedsReviewCount: 0,
      reviewFailCount: 1,
      items: [
        {
          sampleId: 'sample-1',
          title: 'Sample 1',
          success: true,
          qualityStatus: 'pass',
          qualityScore: 0.9,
          comparison: {
            reviewStatus: 'pass',
            overallStatus: 'pass'
          } as any,
          responseRaw: {
            sampleMetadata: { category: 'charts' },
            analysisRun: {
              execution: {
                jsonRecovery: {
                  localRepairAttempted: true,
                  localRepairSucceeded: true
                }
              }
            }
          }
        },
        {
          sampleId: 'sample-2',
          title: 'Sample 2',
          success: false,
          failureKind: 'jsonParseError',
          error: 'SyntaxError',
          responseRaw: {
            sampleMetadata: { category: 'tables' }
          }
        }
      ]
    };

    const report = buildBatchComparisonReportForChat([runNative, runPrompted]);

    assert.strictEqual(report.reportKind, 'visualAnalysisPublicSampleBatchComparison');
    assert.strictEqual(report.comparedRuns.length, 2);
    
    // Check Native Schema vs Prompted JSON deltas
    assert.ok(report.aggregateDelta);
    const delta = report.aggregateDelta.nativeSchemaVsPromptedJson;
    assert.ok(delta);
    assert.strictEqual(delta.successDelta, 1); // 2 - 1 = 1
    assert.strictEqual(delta.invalidJsonDelta, -1); // 0 - 1 = -1
    assert.strictEqual(delta.reviewPassDelta, 1); // 2 - 1 = 1
    assert.strictEqual(delta.parseFailureDelta, -1); // 0 - 1 = -1

    // Check per-sample details
    assert.strictEqual(report.perSampleComparison.length, 2);
    const s1Comp = report.perSampleComparison.find(c => c.sampleId === 'sample-1');
    assert.ok(s1Comp);
    assert.strictEqual(s1Comp.category, 'charts');
    assert.strictEqual(s1Comp.byRun['run-native-123'].success, true);
    assert.strictEqual(s1Comp.byRun['run-prompted-456'].success, true);
    assert.strictEqual(s1Comp.byRun['run-prompted-456'].jsonRecoveryUsed, true);

    const s2Comp = report.perSampleComparison.find(c => c.sampleId === 'sample-2');
    assert.ok(s2Comp);
    assert.strictEqual(s2Comp.category, 'tables');
    assert.strictEqual(s2Comp.byRun['run-native-123'].success, true);
    assert.strictEqual(s2Comp.byRun['run-prompted-456'].success, false);
    assert.strictEqual(s2Comp.byRun['run-prompted-456'].parseFailure, true);

    // Diagnostics aggregates
    assert.strictEqual(report.diagnosticNotes.promptRecoveryUsedCount, 1);
    assert.strictEqual(report.diagnosticNotes.apiFailureCount, 0); // parse failure doesn't increment API failure
  });

  it('should support compact past run format and map category / jsonMode correctly', () => {
    const compactNative: PublicSampleBatchRunSummary = {
      runId: 'run-compact-native',
      timestamp: '2026-06-28T02:00:00Z',
      modelName: 'gemini-3.5-flash',
      jsonMode: 'native_schema',
      total: 1,
      successCount: 1,
      failureCount: 0,
      validCount: 1,
      validLowQualityCount: 0,
      invalidJsonCount: 0,
      expectedComparisonPassCount: 1,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 0,
      items: [
        {
          sampleId: 'sample-landscape-1', // maps to 'landscape' category in registry
          title: 'Yosemite Valley',
          success: true,
          category: 'landscape',
          execution: {
            modelName: 'gemini-3.5-flash',
            providerFamily: 'gemini',
            structuredExecutionMode: 'nativeSchema',
            jsonMode: 'native_schema'
          }
        }
      ]
    };

    const compactPrompted: PublicSampleBatchRunSummary = {
      runId: 'run-compact-prompted',
      timestamp: '2026-06-28T02:05:00Z',
      modelName: 'gemini-3.5-flash',
      jsonMode: 'prompt_only', // prompt_only mode
      total: 1,
      successCount: 0,
      failureCount: 1,
      validCount: 0,
      validLowQualityCount: 0,
      invalidJsonCount: 1,
      expectedComparisonPassCount: 0,
      expectedComparisonWarningCount: 0,
      expectedComparisonFailCount: 1,
      items: [
        {
          sampleId: 'sample-landscape-1',
          title: 'Yosemite Valley',
          success: false,
          failureKind: 'schemaValidationError', // schema validation taxonomy
          execution: {
            modelName: 'gemini-3.5-flash',
            providerFamily: 'gemini',
            structuredExecutionMode: 'promptedJson',
            jsonMode: 'prompt_only',
            jsonRecovery: {
              schemaValidationRecoveryAttempted: true,
              schemaValidationRetryCount: 1,
              schemaValidationRetryParseSucceeded: true,
              schemaValidationRetryValidationErrors: ["some-error"]
            }
          }
        }
      ]
    };

    const report = buildBatchComparisonReportForChat([compactNative, compactPrompted]);

    assert.strictEqual(report.reportKind, 'visualAnalysisPublicSampleBatchComparison');
    assert.strictEqual(report.comparedRuns.length, 2);

    // Verify delta works with native_schema and prompt_only
    assert.ok(report.aggregateDelta);
    const delta = report.aggregateDelta.nativeSchemaVsPromptedJson;
    assert.ok(delta);
    assert.strictEqual(delta.successDelta, 1);

    // Verify category was correctly resolved to 'landscape' from item or fallback
    const sLandscapeComp = report.perSampleComparison.find(c => c.sampleId === 'sample-landscape-1');
    assert.ok(sLandscapeComp);
    assert.strictEqual(sLandscapeComp.category, 'landscape');

    // Verify recovery and schema-validation details
    const runPromptedData = sLandscapeComp.byRun['run-compact-prompted'];
    assert.strictEqual(runPromptedData.success, false);
    assert.strictEqual(runPromptedData.schemaValidationRecoveryUsed, true);
    assert.strictEqual(runPromptedData.taxonomyCategory, 'validation');
  });
});
