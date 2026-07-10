import { test } from 'node:test';
import assert from 'node:assert';
import { preflightVisualExecution, PreflightError } from './preflight';

test('Preflight Visual Execution', async (t) => {
  await t.test('accepts valid request', () => {
    const result = preflightVisualExecution({
      modelId: 'gemini-3.5-flash',
      executionMode: 'native_schema',
      sampleIds: ['sample1'],
    });

    assert.strictEqual(result.resolvedExecutionMode, 'nativeSchema');
    assert.strictEqual(result.providerFamily, 'google-gemini');
    assert.ok(result.compiledProviderSchema);
    assert.strictEqual(result.schemaCompilerName, 'RecursiveAllowlistCompiler');
  });

  await t.test('rejects discontinued model', () => {
    try {
      preflightVisualExecution({
        modelId: 'gemini-1.5-pro',
        executionMode: 'native_schema',
        sampleIds: ['sample1'],
      });
      assert.fail("Should have thrown PreflightError");
    } catch (err: any) {
      assert.ok(err instanceof PreflightError);
      assert.strictEqual(err.errorType, 'modelDiscontinued');
      assert.match(err.message, /is discontinued/);
    }
  });

  await t.test('rejects mode mismatch', () => {
    try {
      preflightVisualExecution({
        modelId: 'gemma-4-31b-it',
        executionMode: 'native_schema',
        sampleIds: ['sample1'],
      });
      assert.fail("Should have thrown PreflightError");
    } catch (err: any) {
      assert.ok(err instanceof PreflightError);
      assert.strictEqual(err.errorType, 'executionModeUnsupported');
      assert.match(err.message, /does not support native schema execution/);
    }
  });

  await t.test('rejects duplicate sample selection', () => {
    try {
      preflightVisualExecution({
        modelId: 'gemini-3.5-flash',
        executionMode: 'native_schema',
        sampleIds: ['sample1', 'sample1'],
      });
      assert.fail("Should have thrown PreflightError");
    } catch (err: any) {
      assert.ok(err instanceof PreflightError);
      assert.strictEqual(err.errorType, 'duplicateSampleSelection');
    }
  });

  await t.test('rejects too many samples', () => {
    try {
      preflightVisualExecution({
        modelId: 'gemini-3.5-flash',
        executionMode: 'native_schema',
        sampleIds: Array.from({ length: 51 }, (_, i) => `sample-${i + 1}`),
      });
      assert.fail("Should have thrown PreflightError");
    } catch (err: any) {
      assert.ok(err instanceof PreflightError);
      assert.strictEqual(err.errorType, 'sampleLimitExceeded');
    }
  });

  await t.test('rejects unsupported media resolution', () => {
    try {
      preflightVisualExecution({
        modelId: 'gemma-4-31b-it',
        executionMode: 'prompt_only',
        sampleIds: ['sample1'],
        mediaResolution: 'high',
      });
      assert.fail("Should have thrown PreflightError");
    } catch (err: any) {
      assert.ok(err instanceof PreflightError);
      assert.strictEqual(err.errorType, 'mediaResolutionUnsupported');
    }
  });
});
