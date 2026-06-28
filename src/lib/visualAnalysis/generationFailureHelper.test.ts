import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildGenerationFailureResponse } from './generationFailureHelper';
import { ProviderError } from '../gemini';

describe('buildGenerationFailureResponse', () => {
  const mockRunMetadata = {
    execution: {
      modelName: "test-model",
      providerFamily: "gemini",
      jsonRecovery: {
        localRecoveryEnabled: false
      }
    },
    schema: { version: "v0.1" },
    prompt: { version: "v0.1" }
  };

  test('should handle ProviderError correctly', () => {
    const err = new ProviderError("test error", 401, "UNAUTHENTICATED", "Raw message 123");
    err.attemptedModels = ["test-model"];
    err.retryable = false;
    err.apiRetryCount = 0;
    
    const response = buildGenerationFailureResponse({
      err,
      targetModel: "test-model",
      providerFamily: "gemini",
      runMetadata: mockRunMetadata as any
    });

    assert.strictEqual(response.success, false);
    assert.strictEqual(response.failureKind, "generationError");
    assert.strictEqual(response.generationDiagnostics.statusCode, 401);
    assert.strictEqual(response.generationDiagnostics.providerStatus, "UNAUTHENTICATED");
    assert.strictEqual(response.generationDiagnostics.rawMessageSummary, "Raw message 123");
    assert.strictEqual(response.generationDiagnostics.retryable, false);
    assert.deepEqual(response.generationDiagnostics.attemptedModels, ["test-model"]);
  });

  test('should map providerRateLimited ProviderError correctly', () => {
    const err = new ProviderError("Rate limit exceeded", 429, "RESOURCE_EXHAUSTED", "Quota exceeded");
    err.providerFailureKind = "providerRateLimited";
    err.rateLimited = true;
    
    const response = buildGenerationFailureResponse({
      err,
      targetModel: "test-model",
      providerFamily: "gemini",
      runMetadata: mockRunMetadata as any
    });

    assert.strictEqual(response.success, false);
    assert.strictEqual(response.failureKind, "providerRateLimited");
    assert.strictEqual(response.generationDiagnostics.providerFailureKind, "providerRateLimited");
    assert.strictEqual(response.generationDiagnostics.rateLimited, true);
  });

  test('should map providerQuotaExceeded ProviderError correctly', () => {
    const err = new ProviderError("Quota limit reached", 403, "RESOURCE_EXHAUSTED", "RESOURCE_EXHAUSTED");
    err.providerFailureKind = "providerQuotaExceeded";
    err.quotaExceeded = true;
    
    const response = buildGenerationFailureResponse({
      err,
      targetModel: "test-model",
      providerFamily: "gemini",
      runMetadata: mockRunMetadata as any
    });

    assert.strictEqual(response.success, false);
    assert.strictEqual(response.failureKind, "providerQuotaExceeded");
    assert.strictEqual(response.generationDiagnostics.providerFailureKind, "providerQuotaExceeded");
    assert.strictEqual(response.generationDiagnostics.quotaExceeded, true);
  });

  test('should handle generic Error', () => {
    const err = new Error("Generic error message");
    
    const response = buildGenerationFailureResponse({
      err,
      targetModel: "test-model",
      providerFamily: "gemini",
      runMetadata: mockRunMetadata as any
    });

    assert.strictEqual(response.success, false);
    assert.strictEqual(response.failureKind, "generationError");
    assert.strictEqual(response.generationDiagnostics.rawMessageSummary, "Generic error message");
  });

  test('should handle string error', () => {
    const response = buildGenerationFailureResponse({
      err: "Just a string",
      targetModel: "test-model",
      providerFamily: "gemini",
      runMetadata: mockRunMetadata as any
    });

    assert.strictEqual(response.success, false);
    assert.strictEqual(response.failureKind, "generationError");
    assert.strictEqual(response.generationDiagnostics.rawMessageSummary, "\"Just a string\"");
  });

  test('should include metadata blocks', () => {
    const err = new Error("Test");
    
    const response = buildGenerationFailureResponse({
      err,
      targetModel: "test-model",
      providerFamily: "gemini",
      runMetadata: mockRunMetadata as any,
      sampleMetadata: { id: "1" },
      expectedMetadata: { kind: "photo" },
      requestPreview: { prompt: "hello" }
    });

    assert.deepEqual(response.sampleMetadata, { id: "1" });
    assert.deepEqual(response.expectedMetadata, { kind: "photo" });
    assert.deepEqual(response.requestPreview, { prompt: "hello" });
  });

  test('should unify analysisRun with runMetadata', () => {
    const err = new Error("Test");
    const response = buildGenerationFailureResponse({
      err,
      targetModel: "test-model",
      providerFamily: "gemini",
      runMetadata: mockRunMetadata as any
    });
    assert.deepEqual(response.analysisRun, mockRunMetadata);
  });
});
