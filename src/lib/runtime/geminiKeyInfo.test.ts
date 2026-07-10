import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getGeminiKeyInfo } from "./geminiKeyInfo";

describe("getGeminiKeyInfo", () => {
  test("returns not configured for undefined", () => {
    const result = getGeminiKeyInfo(undefined);
    assert.deepEqual(result, {
      isConfigured: false,
      envVarName: "GEMINI_API_KEY"
    });
  });

  test("returns not configured for empty string", () => {
    const result = getGeminiKeyInfo("");
    assert.deepEqual(result, {
      isConfigured: false,
      envVarName: "GEMINI_API_KEY"
    });
  });

  test("returns not configured for whitespace only", () => {
    const result = getGeminiKeyInfo("   ");
    assert.deepEqual(result, {
      isConfigured: false,
      envVarName: "GEMINI_API_KEY"
    });
  });

  test("returns configured with mask and fingerprint for normal key", () => {
    const key = "AIzaSyFakeKeyThatIsLongEnough123";
    const result = getGeminiKeyInfo(key);
    assert.equal(result.isConfigured, true);
    assert.equal(result.envVarName, "GEMINI_API_KEY");
    assert.equal(result.maskedKey, "AIza…h123");
    assert.equal(result.fingerprint?.length, 12);
    assert.equal(result.fingerprintAlgorithm, "sha256");
    assert.equal(result.fingerprint, "8cc61bfb1c1e");
  });

  test("returns configured with generic mask for short key", () => {
    const key = "ShortKey123";
    const result = getGeminiKeyInfo(key);
    assert.equal(result.isConfigured, true);
    assert.equal(result.maskedKey, "configured");
    assert.equal(result.fingerprint?.length, 12);
  });

  test("fingerprint is deterministic", () => {
    const key = "AIzaSyFakeKeyThatIsLongEnough123";
    const result1 = getGeminiKeyInfo(key);
    const result2 = getGeminiKeyInfo(key);
    assert.equal(result1.fingerprint, result2.fingerprint);
  });

  test("different keys produce different fingerprints", () => {
    const key1 = "AIzaSyFakeKeyThatIsLongEnough123";
    const key2 = "AIzaSyFakeKeyThatIsLongEnough124";
    const result1 = getGeminiKeyInfo(key1);
    const result2 = getGeminiKeyInfo(key2);
    assert.notEqual(result1.fingerprint, result2.fingerprint);
  });

  test("helper does not expose raw key", () => {
    const key = "AIzaSyFakeKeyThatIsLongEnough123";
    const result = getGeminiKeyInfo(key);
    assert.ok(!JSON.stringify(result).includes(key));
  });
});
