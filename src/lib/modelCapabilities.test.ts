import { test } from 'node:test';
import assert from 'node:assert';
import { getModelCapability, shouldUseNativeResponseSchema, getStructuredExecutionMode, getModelExecutionPolicy, validateModelExecution } from './modelCapabilities';

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

  await t.test('model execution policy classification', () => {
    assert.strictEqual(getModelExecutionPolicy('gemini-3.5-flash'), 'supported');
    assert.strictEqual(getModelExecutionPolicy('gemini-3.1-flash-lite'), 'supported');
    assert.strictEqual(getModelExecutionPolicy('gemini-1.5-flash'), 'discontinued');
    assert.strictEqual(getModelExecutionPolicy('gemini-1.5-pro'), 'discontinued');
    assert.strictEqual(getModelExecutionPolicy('gemini-flash-latest'), 'discontinued');
    assert.strictEqual(getModelExecutionPolicy('gemini-3-flash-preview'), 'experimental');
    assert.strictEqual(getModelExecutionPolicy('gemma-4-31b-it'), 'experimental');
    assert.strictEqual(getModelExecutionPolicy('unknown-model'), 'unsupported');
  });

  await t.test('validateModelExecution validation behavior', () => {
    assert.deepStrictEqual(validateModelExecution('gemini-3.5-flash'), { allowed: true });
    assert.deepStrictEqual(validateModelExecution('gemini-1.5-flash'), { allowed: false, error: 'modelDiscontinued' });
    assert.deepStrictEqual(validateModelExecution('gemini-flash-latest'), { allowed: false, error: 'modelDiscontinued' });
    assert.deepStrictEqual(validateModelExecution('unknown-model'), { allowed: false, error: 'modelUnsupported' });
  });
});

