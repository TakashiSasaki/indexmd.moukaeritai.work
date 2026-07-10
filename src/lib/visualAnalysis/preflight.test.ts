import { test } from 'node:test';
import assert from 'node:assert';
import { preflightVisualExecution } from './preflight';

test('Preflight Visual Execution', async (t) => {
  await t.test('accepts valid request', () => {
    const result = preflightVisualExecution({
      modelId: 'gemini-3.5-flash',
      executionMode: 'native_schema',
      sampleIds: ['sample1'],
    });

    assert.strictEqual(result.resolvedExecutionMode, 'nativeSchema');
    assert.strictEqual(result.resolvedProviderFamily, 'google-gemini');
    assert.ok(result.compiledProviderSchema);
    assert.strictEqual(result.schemaCompilerName, 'RecursiveAllowlistCompiler');
  });

  await t.test('rejects discontinued model', () => {
    assert.throws(() => {
      preflightVisualExecution({
        modelId: 'gemini-1.5-pro',
        executionMode: 'native_schema',
        sampleIds: ['sample1'],
      });
    }, /not allowed for new execution/);
  });

  await t.test('rejects mode mismatch', () => {
    assert.throws(() => {
      preflightVisualExecution({
        modelId: 'gemma-4-31b-it',
        executionMode: 'native_schema',
        sampleIds: ['sample1'],
      });
    }, /does not support native schema execution/);
  });
});
