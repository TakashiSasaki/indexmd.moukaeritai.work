import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isCheckpointCompatible,
  shrinkCheckpointForLocalStorage,
  rebuildBatchSummaryFromCheckpoint,
  PublicSampleBatchCheckpoint
} from './batchCheckpoint';
import { PublicSampleBatchRunItem } from './batchTypes';

describe('Public Sample Batch Checkpoint', () => {
  const dummyItem: PublicSampleBatchRunItem = {
    sampleId: 'sample-1',
    title: 'sample-1',
    success: true,
    responseRaw: {
      rawOutput: '{"test": 1}',
      rawOutputPreview: 'previewText',
      requestPreview: { some: 'preview' },
      analysisRun: {
        execution: {
          jsonRecovery: {
            rawOutputPreview: 'recoveryPreview'
          }
        }
      }
    },
    analysisRun: {
      metadata: {
        runId: 'abc',
        timestamp: '2026-06-28',
        model: { name: 'gemini-3.5-flash', providerFamily: 'gemini' },
        execution: { jsonMode: 'json', structuredExecutionMode: 'native' }
      } as any,
      execution: {
        jsonRecovery: {
          rawOutputPreview: 'otherRecoveryPreview'
        }
      } as any
    },
    parseDiagnostics: {
      rawOutputPreview: 'diagPreview'
    } as any
  };

  const dummyCheckpoint: PublicSampleBatchCheckpoint = {
    checkpointVersion: "public-sample-batch-checkpoint.v0.1.0",
    runId: 'run-123',
    createdAt: '2026-06-28T00:00:00Z',
    updatedAt: '2026-06-28T00:00:00Z',
    status: 'running',
    modelName: 'gemini-3.5-flash',
    jsonMode: 'native_schema',
    customInstructionHash: 'hash-abc',
    customInstructionPreview: 'test instruction',
    targetSampleIds: ['sample-1', 'sample-2'],
    completedSampleIds: ['sample-1'],
    pendingSampleIds: ['sample-2'],
    failedSampleIds: [],
    items: [dummyItem],
    counters: {
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
      reviewFailCount: 0
    },
    runFingerprint: {
      modelName: 'gemini-3.5-flash',
      jsonMode: 'native_schema',
      customInstructionHash: 'hash-abc',
      targetSampleIdsHash: 'ids-hash'
    }
  };

  it('isCheckpointCompatible matches compatible settings', () => {
    const currentSettings = {
      modelName: 'gemini-3.5-flash',
      jsonMode: 'native_schema',
      customInstructionHash: 'hash-abc',
      availableSampleIds: ['sample-1', 'sample-2', 'sample-3']
    };

    assert.strictEqual(isCheckpointCompatible(dummyCheckpoint, currentSettings), true);
  });

  it('isCheckpointCompatible ignores changes in selected UI checkboxes', () => {
    const currentSettingsWithSelected = {
      modelName: 'gemini-3.5-flash',
      jsonMode: 'native_schema',
      customInstructionHash: 'hash-abc',
      availableSampleIds: ['sample-1', 'sample-2', 'sample-3'],
      selectedSampleIds: ['sample-1'] // only one checked, checkpoint still compatible!
    };

    assert.strictEqual(isCheckpointCompatible(dummyCheckpoint, currentSettingsWithSelected), true);
  });

  it('isCheckpointCompatible fails on different model or jsonMode', () => {
    const differentModel = {
      modelName: 'gemma-4-26b',
      jsonMode: 'native_schema',
      customInstructionHash: 'hash-abc',
      availableSampleIds: ['sample-1', 'sample-2']
    };
    assert.strictEqual(isCheckpointCompatible(dummyCheckpoint, differentModel), false);

    const differentJsonMode = {
      modelName: 'gemini-3.5-flash',
      jsonMode: 'prompted_json',
      customInstructionHash: 'hash-abc',
      availableSampleIds: ['sample-1', 'sample-2']
    };
    assert.strictEqual(isCheckpointCompatible(dummyCheckpoint, differentJsonMode), false);
  });

  it('isCheckpointCompatible fails if target sample is missing from available samples', () => {
    const missingSamples = {
      modelName: 'gemini-3.5-flash',
      jsonMode: 'native_schema',
      customInstructionHash: 'hash-abc',
      availableSampleIds: ['sample-1'] // sample-2 is missing!
    };
    assert.strictEqual(isCheckpointCompatible(dummyCheckpoint, missingSamples), false);
  });

  it('shrinkCheckpointForLocalStorage successfully removes heavy raw output fields', () => {
    const shrunk = shrinkCheckpointForLocalStorage(dummyCheckpoint);
    const firstItem = shrunk.items[0];

    assert.strictEqual(firstItem.responseRaw?.rawOutput, undefined);
    assert.strictEqual(firstItem.responseRaw?.rawOutputPreview, undefined);
    assert.strictEqual(firstItem.responseRaw?.requestPreview, undefined);
    assert.strictEqual(firstItem.responseRaw?.analysisRun?.execution?.jsonRecovery?.rawOutputPreview, undefined);
    assert.strictEqual((firstItem.analysisRun?.execution?.jsonRecovery as any)?.rawOutputPreview, undefined);
    assert.strictEqual((firstItem.parseDiagnostics as any)?.rawOutputPreview, undefined);

    // Confirm original was not mutated
    assert.strictEqual(dummyCheckpoint.items[0].responseRaw?.rawOutput, '{"test": 1}');
  });

  it('rebuildBatchSummaryFromCheckpoint reconstructs batch summary object', () => {
    const summary = rebuildBatchSummaryFromCheckpoint(dummyCheckpoint);
    assert.strictEqual(summary.runId, 'run-123');
    assert.strictEqual(summary.modelName, 'gemini-3.5-flash');
    assert.strictEqual(summary.total, 2);
    assert.strictEqual(summary.items.length, 1);
  });
});
