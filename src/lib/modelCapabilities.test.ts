import { test } from 'node:test';
import assert from 'node:assert';
import { getModelCapability, shouldUseNativeResponseSchema, getStructuredExecutionMode, getExecutableModels } from './modelCapabilities';

test('Model Capabilities Registry', async (t) => {
  await t.test('gemini-3.5-flash uses nativeSchema', () => {
    assert.strictEqual(getStructuredExecutionMode('gemini-3.5-flash'), 'nativeSchema');
    assert.strictEqual(shouldUseNativeResponseSchema('gemini-3.5-flash'), true);
  });

  await t.test('gemini-2.5-flash uses nativeSchema', () => {
    assert.strictEqual(getStructuredExecutionMode('gemini-2.5-flash'), 'nativeSchema');
  });

  await t.test('gemini-3.1-flash-lite uses nativeSchema', () => {
    assert.strictEqual(getStructuredExecutionMode('gemini-3.1-flash-lite'), 'nativeSchema');
  });

  await t.test('gemini-3.1-pro-preview uses nativeSchema', () => {
    assert.strictEqual(getStructuredExecutionMode('gemini-3.1-pro-preview'), 'nativeSchema');
  });

  await t.test('gemini-flash-latest uses nativeSchema', () => {
    assert.strictEqual(getStructuredExecutionMode('gemini-flash-latest'), 'nativeSchema');
  });

  await t.test('gemma-4-31b-it uses promptedJson', () => {
    assert.strictEqual(getStructuredExecutionMode('gemma-4-31b-it'), 'promptedJson');
    assert.strictEqual(shouldUseNativeResponseSchema('gemma-4-31b-it'), false);
  });

  await t.test('unknown model uses promptedJson and is not executable', () => {
    const cap = getModelCapability('unknown-model-xyz');
    assert.strictEqual(cap.executionAllowed, false);
    assert.strictEqual(getStructuredExecutionMode('unknown-model-xyz'), 'promptedJson');
    assert.strictEqual(shouldUseNativeResponseSchema('unknown-model-xyz'), false);
  });

  await t.test('Gemini 1.5 models are discontinued and not executable', () => {
    const proCap = getModelCapability('gemini-1.5-pro');
    const proLatestCap = getModelCapability('gemini-1.5-pro-latest');
    const flashCap = getModelCapability('gemini-1.5-flash');
    const flashPreviewCap = getModelCapability('gemini-1.5-flash-preview');

    assert.strictEqual(proCap.executionAllowed, false);
    assert.strictEqual(proCap.lifecycleClass, 'discontinued');

    assert.strictEqual(proLatestCap.executionAllowed, false);
    assert.strictEqual(proLatestCap.lifecycleClass, 'discontinued');

    assert.strictEqual(flashCap.executionAllowed, false);
    assert.strictEqual(flashCap.lifecycleClass, 'discontinued');

    assert.strictEqual(flashPreviewCap.executionAllowed, false);
    assert.strictEqual(flashPreviewCap.lifecycleClass, 'discontinued');
  });

  await t.test('architecture: executable model IDs are unique and not duplicated in registry', () => {
    const models = getExecutableModels();
    const ids = models.map(m => m.canonicalModelId);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, `Duplicate executable model IDs found: ${ids.filter((item, index) => ids.indexOf(item) !== index)}`);
  });
});
