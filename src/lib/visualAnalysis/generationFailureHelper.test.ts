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
    assert.strictEqual(response.record.diagnostics.generation.statusCode, 401);
    assert.strictEqual(response.record.diagnostics.generation.providerStatus, "UNAUTHENTICATED");
    assert.strictEqual(response.record.diagnostics.generation.rawMessageSummary, "Raw message 123");
    assert.strictEqual(response.record.diagnostics.generation.retryable, false);
    assert.deepEqual(response.record.diagnostics.generation.attemptedModels, ["test-model"]);
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
    assert.strictEqual(response.record.diagnostics.generation.providerFailureKind, "providerRateLimited");
    assert.strictEqual(response.record.diagnostics.generation.rateLimited, true);
  });

  test('should map providerQuotaExceeded ProviderError correctly', () => {
    const err = new ProviderError("Quota limit reached", 403, "RESOURCE_EXHAUSTED", "RESOURCE_EXHAUSTED");
    err.providerFailureKind = "providerQuotaExceeded";
    err.quotaExceeded = true;
    err.quotaMetric = "generativelanguage.googleapis.com/generate_content_free_tier_requests";
    err.quotaId = "GenerateRequestsPerDayPerProjectPerModel-FreeTier";
    err.quotaValue = "20";
    err.quotaDimensions = { model: "gemini-test", location: "global" };
    err.quotaClassification = "dailyQuotaExhausted";
    err.errorFingerprint = "quota-fingerprint";
    
    const response = buildGenerationFailureResponse({
      err,
      targetModel: "test-model",
      providerFamily: "gemini",
      runMetadata: mockRunMetadata as any
    });

    assert.strictEqual(response.success, false);
    assert.strictEqual(response.failureKind, "providerQuotaExceeded");
    assert.strictEqual(response.record.diagnostics.generation.providerFailureKind, "providerQuotaExceeded");
    assert.strictEqual(response.record.diagnostics.generation.quotaExceeded, true);
    assert.strictEqual(response.record.diagnostics.generation.quotaMetric, "generativelanguage.googleapis.com/generate_content_free_tier_requests");
    assert.strictEqual(response.record.diagnostics.generation.quotaId, "GenerateRequestsPerDayPerProjectPerModel-FreeTier");
    assert.strictEqual(response.record.diagnostics.generation.quotaValue, "20");
    assert.deepEqual(response.record.diagnostics.generation.quotaDimensions, { model: "gemini-test", location: "global" });
    assert.strictEqual(response.record.diagnostics.generation.quotaClassification, "dailyQuotaExhausted");
    assert.strictEqual(response.record.diagnostics.generation.errorFingerprint, "quota-fingerprint");
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
    assert.strictEqual(response.record.diagnostics.generation.rawMessageSummary, "Generic error message");
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
    assert.strictEqual(response.record.diagnostics.generation.rawMessageSummary, "\"Just a string\"");
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

    assert.strictEqual(response.record.assetMetadata.assetId, "1");
    assert.deepEqual(response.record.evaluation.expectedMetadata, { kind: "photo" });
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
    assert.deepEqual(response.record.analysisRun, mockRunMetadata);
  });
});
