import { describe, it } from "node:test";
import assert from "node:assert";
import {
  extractProviderErrorDetails,
  classifyProviderFailureKind,
  extractRetryDelay,
  ProviderError
} from "./gemini";

describe("Gemini Error Classification and Parsing", () => {
  it("should classify standard HTTP 429 as providerRateLimited", () => {
    const err = {
      status: 429,
      message: "Resource has been exhausted"
    };

    const details = extractProviderErrorDetails(err);
    assert.strictEqual(details.statusCode, 429);
    assert.strictEqual(details.providerStatus, "UNKNOWN");

    const classification = classifyProviderFailureKind(details.statusCode, details.providerStatus, details.rawMessage);
    assert.strictEqual(classification.providerFailureKind, "providerRateLimited");
    assert.strictEqual(classification.quotaExceeded, false);
    assert.strictEqual(classification.rateLimited, true);
  });

  it("should classify RESOURCE_EXHAUSTED with 429 as providerRateLimited", () => {
    const err = {
      status: 429,
      message: '{"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": "Quota exceeded"}}'
    };

    const details = extractProviderErrorDetails(err);
    assert.strictEqual(details.statusCode, 429);
    assert.strictEqual(details.providerStatus, "RESOURCE_EXHAUSTED");

    const classification = classifyProviderFailureKind(details.statusCode, details.providerStatus, details.rawMessage);
    assert.strictEqual(classification.providerFailureKind, "providerRateLimited");
    assert.strictEqual(classification.quotaExceeded, true);
    assert.strictEqual(classification.rateLimited, true);
  });

  it("should classify RESOURCE_EXHAUSTED without 429 as providerQuotaExceeded", () => {
    const err = {
      status: 403,
      message: '{"error": {"code": 403, "status": "RESOURCE_EXHAUSTED", "message": "Daily limit exceeded"}}'
    };

    const details = extractProviderErrorDetails(err);
    assert.strictEqual(details.statusCode, 403);
    assert.strictEqual(details.providerStatus, "RESOURCE_EXHAUSTED");

    const classification = classifyProviderFailureKind(details.statusCode, details.providerStatus, details.rawMessage);
    assert.strictEqual(classification.providerFailureKind, "providerQuotaExceeded");
    assert.strictEqual(classification.quotaExceeded, true);
    assert.strictEqual(classification.rateLimited, false);
  });

  it("should classify QUOTA_EXCEEDED message as quotaExceeded", () => {
    const err = {
      status: 403,
      message: "Quota exceeded for project"
    };

    const details = extractProviderErrorDetails(err);
    const classification = classifyProviderFailureKind(details.statusCode, details.providerStatus, details.rawMessage);
    assert.strictEqual(classification.providerFailureKind, "providerQuotaExceeded");
    assert.strictEqual(classification.quotaExceeded, true);
  });

  it("should classify rate limit keywords as rateLimited/quotaExceeded", () => {
    const err1 = { status: 400, message: "this request hit a rate limit" };
    const details1 = extractProviderErrorDetails(err1);
    const classification1 = classifyProviderFailureKind(details1.statusCode, details1.providerStatus, details1.rawMessage);
    assert.strictEqual(classification1.quotaExceeded, true);

    const err2 = { status: 400, message: "this request hit a rate_limit" };
    const details2 = extractProviderErrorDetails(err2);
    const classification2 = classifyProviderFailureKind(details2.statusCode, details2.providerStatus, details2.rawMessage);
    assert.strictEqual(classification2.quotaExceeded, true);
  });

  it("should classify UNAVAILABLE and INVALID_ARGUMENT correctly", () => {
    const err1 = { status: 503, message: "Service is currently unavailable" };
    const details1 = extractProviderErrorDetails(err1);
    const classification1 = classifyProviderFailureKind(details1.statusCode, details1.providerStatus, details1.rawMessage);
    assert.strictEqual(classification1.providerFailureKind, "providerUnavailable");

    const err2 = { status: 400, message: "invalid argument passed" };
    const details2 = extractProviderErrorDetails(err2);
    const classification2 = classifyProviderFailureKind(details2.statusCode, details2.providerStatus, details2.rawMessage);
    assert.strictEqual(classification2.providerFailureKind, "providerInvalidArgument");
  });

  it("should extract RetryInfo from details arrays", () => {
    const err = {
      error: {
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.RetryInfo",
            "retryDelay": "30s"
          }
        ]
      }
    };

    const delay = extractRetryDelay(err, "");
    assert.strictEqual(delay.retryAfterMs, 30000);
    assert.strictEqual(delay.retryAfterReason, "google.rpc.RetryInfo");
  });

  it("should extract RetryInfo from parsed message JSON", () => {
    const messageJson = JSON.stringify({
      error: {
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.RetryInfo",
            "retryDelay": { "seconds": 1.5, "nanos": 0 }
          }
        ]
      }
    });

    const delay = extractRetryDelay({}, messageJson);
    assert.strictEqual(delay.retryAfterMs, 1500);
    assert.strictEqual(delay.retryAfterReason, "google.rpc.RetryInfo (object)");
  });

  it("should extract retry-after from plain header object and Headers.get()", () => {
    const errHeaders = {
      response: {
        headers: {
          "retry-after": "120"
        }
      }
    };

    const delay1 = extractRetryDelay(errHeaders, "");
    assert.strictEqual(delay1.retryAfterMs, 120000);
    assert.strictEqual(delay1.retryAfterReason, "HTTP retry-after header");

    const getHeaders = {
      response: {
        headers: {
          get: (key: string) => {
            if (key.toLowerCase() === "retry-after") {
              return "45";
            }
            return null;
          }
        }
      }
    };

    const delay2 = extractRetryDelay(getHeaders, "");
    assert.strictEqual(delay2.retryAfterMs, 45000);
    assert.strictEqual(delay2.retryAfterReason, "HTTP retry-after header");
  });

  it("should cap retryAfterMs at 5 minutes", () => {
    const err = {
      response: {
        headers: {
          "retry-after": "600" // 10 minutes
        }
      }
    };

    const delay = extractRetryDelay(err, "");
    assert.strictEqual(delay.retryAfterMs, 300000); // capped at 5 mins
    assert.strictEqual(delay.retryAfterReason, "HTTP retry-after header (capped)");
  });

  it("should instantiate ProviderError with correct properties", () => {
    const err = new ProviderError("Simulated Failure", 429, "RESOURCE_EXHAUSTED", "Message block");
    err.providerFailureKind = "providerRateLimited";
    err.quotaExceeded = true;
    err.rateLimited = true;
    err.retryAfterMs = 4500;
    err.retryAfterReason = "google.rpc.RetryInfo";

    assert.strictEqual(err.statusCode, 429);
    assert.strictEqual(err.providerStatus, "RESOURCE_EXHAUSTED");
    assert.strictEqual(err.rawMessageSummary, "Message block");
    assert.strictEqual(err.providerFailureKind, "providerRateLimited");
    assert.strictEqual(err.quotaExceeded, true);
    assert.strictEqual(err.rateLimited, true);
    assert.strictEqual(err.retryAfterMs, 4500);
    assert.strictEqual(err.retryAfterReason, "google.rpc.RetryInfo");
  });
});
