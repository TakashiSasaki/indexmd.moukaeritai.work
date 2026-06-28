import { describe, it } from "node:test";
import assert from "node:assert";
import { 
  isProviderRateLimitFailure, 
  isProviderQuotaFailure,
  isProviderGenerationFailure
} from "./reportBuilder";
import { PublicSampleBatchRunItem } from "./batchTypes";

describe("Visual Analysis Report Classification Helpers", () => {
  it("should classify legacy rate limit failures correctly", () => {
    const legacyItem: any = {
      success: false,
      failureKind: "generationError",
      generationDiagnostics: {
        statusCode: 429,
        providerStatus: "RESOURCE_EXHAUSTED"
      }
    };

    assert.strictEqual(isProviderRateLimitFailure(legacyItem), true, "Should be rate limit via status 429");
    assert.strictEqual(isProviderQuotaFailure(legacyItem), true, "Should also be quota failure via status code/status");
    assert.strictEqual(isProviderGenerationFailure(legacyItem), false, "Should NOT be generic generation failure");
  });

  it("should classify explicit providerRateLimited failure", () => {
    const item: any = {
      success: false,
      failureKind: "providerRateLimited"
    };

    assert.strictEqual(isProviderRateLimitFailure(item), true);
    assert.strictEqual(isProviderGenerationFailure(item), false);
  });

  it("should classify legacy quota failure correctly", () => {
    const legacyItem: any = {
      success: false,
      failureKind: "generationError",
      generationDiagnostics: {
        statusCode: 403,
        providerStatus: "QUOTA_EXCEEDED"
      }
    };

    assert.strictEqual(isProviderRateLimitFailure(legacyItem), false);
    assert.strictEqual(isProviderQuotaFailure(legacyItem), true);
    assert.strictEqual(isProviderGenerationFailure(legacyItem), false);
  });

  it("should classify generic generation failure", () => {
    const item: any = {
      success: false,
      failureKind: "generationError",
      generationDiagnostics: {
        statusCode: 500,
        providerStatus: "INTERNAL"
      }
    };

    assert.strictEqual(isProviderRateLimitFailure(item), false);
    assert.strictEqual(isProviderQuotaFailure(item), false);
    assert.strictEqual(isProviderGenerationFailure(item), true);
  });

  it("should handle rateLimited: true fallback", () => {
    const item: any = {
      success: false,
      failureKind: "generationError",
      generationDiagnostics: {
        rateLimited: true
      }
    };
    assert.strictEqual(isProviderRateLimitFailure(item), true);
  });

  it("should handle quotaExceeded: true fallback", () => {
    const item: any = {
      success: false,
      failureKind: "generationError",
      generationDiagnostics: {
        quotaExceeded: true
      }
    };
    assert.strictEqual(isProviderQuotaFailure(item), true);
  });
});
