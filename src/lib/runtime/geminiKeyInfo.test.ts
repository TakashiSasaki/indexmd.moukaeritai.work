import test, { describe } from "node:test";
import assert from "node:assert";
import { getGeminiKeyInfo } from "./geminiKeyInfo";

describe("getGeminiKeyInfo", () => {
  test("returns not configured for undefined", () => {
    const result = getGeminiKeyInfo(undefined);
    assert.equal(result.configured, false);
    assert.equal(result.source, "GEMINI_API_KEY");
  });

  test("returns not configured for empty string", () => {
    const result = getGeminiKeyInfo("");
    assert.equal(result.configured, false);
  });

  test("returns not configured for whitespace only", () => {
    const result = getGeminiKeyInfo("   ");
    assert.equal(result.configured, false);
  });

  test("returns configured with mask and fingerprint for normal key", () => {
    const key = "AIzaSyFakeKeyThatIsLongEnough123";
    const result = getGeminiKeyInfo(key);
    assert.equal(result.configured, true);
    assert.equal(result.source, "GEMINI_API_KEY");
    assert.equal(result.maskedKey, "AIza…h123");
    assert.equal(result.fingerprint?.length, 12);
    assert.equal(result.fingerprintAlgorithm, "sha256");
    assert.equal(result.fingerprint, "42189b7de5ae");
  });

  test("returns configured with generic mask for short key", () => {
    const key = "ShortKey123";
    const result = getGeminiKeyInfo(key);
    assert.equal(result.configured, true);
    assert.equal(result.maskedKey, "configured");
    assert.equal(result.fingerprint?.length, 12);
  });

  test("fingerprint is deterministic", () => {
    const key = "TheSameKey123456789";
    const result1 = getGeminiKeyInfo(key);
    const result2 = getGeminiKeyInfo(key);
    assert.equal(result1.fingerprint, result2.fingerprint);
  });

  test("different keys produce different fingerprints", () => {
    const result1 = getGeminiKeyInfo("KeyOne1234567890");
    const result2 = getGeminiKeyInfo("KeyTwo1234567890");
    assert.notEqual(result1.fingerprint, result2.fingerprint);
  });

  test("helper does not expose raw key", () => {
    const key = "SensitiveKey123456789";
    const result = getGeminiKeyInfo(key);
    const json = JSON.stringify(result);
    assert.equal(json.includes(key), false);
  });
});
