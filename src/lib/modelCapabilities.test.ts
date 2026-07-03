import { test } from 'node:test';
import assert from 'node:assert';
import { getModelCapability, shouldUseNativeResponseSchema, getStructuredExecutionMode } from './modelCapabilities';

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

  await t.test('unknown model uses promptedJson', () => {
    assert.strictEqual(getStructuredExecutionMode('unknown-model-xyz'), 'promptedJson');
    assert.strictEqual(shouldUseNativeResponseSchema('unknown-model-xyz'), false);
  });
});
