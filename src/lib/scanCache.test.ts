import { test } from "node:test";
import assert from "node:assert";
import { buildScanCacheKeyParts } from "./scanCache.js";

test("buildScanCacheKeyParts normalizes and produces correct outputs", () => {
  // same input yields same key / string
  const res1 = buildScanCacheKeyParts("folder123", "token123", "2026-06-24", 50, "flat-scan", "user123");
  const res2 = buildScanCacheKeyParts("folder123", "token123", "2026-06-24", 50, "flat-scan", "user123");
  assert.strictEqual(res1.normalizedString, res2.normalizedString);
  assert.strictEqual(res1.normalizedString, "p_folder123_t_token123_l_2026-06-24_s_50_m_flat-scan_c_user123");

  // different pageSize yields different normalized strings
  const resDiffPageSize = buildScanCacheKeyParts("folder123", "token123", "2026-06-24", 100, "flat-scan", "user123");
  assert.notStrictEqual(res1.normalizedString, resDiffPageSize.normalizedString);

  // different scanMode yields different normalized strings
  const resDiffScanMode = buildScanCacheKeyParts("folder123", "token123", "2026-06-24", 50, "progressive-scan", "user123");
  assert.notStrictEqual(res1.normalizedString, resDiffScanMode.normalizedString);

  // different cacheScope yields different normalized strings
  const resDiffCacheScope = buildScanCacheKeyParts("folder123", "token123", "2026-06-24", 50, "flat-scan", "user456");
  assert.notStrictEqual(res1.normalizedString, resDiffCacheScope.normalizedString);

  // missing values normalize deterministically
  const resMissing = buildScanCacheKeyParts(undefined, undefined, undefined, undefined, undefined, undefined);
  assert.strictEqual(resMissing.normalizedString, "p_root_t_none_l_none_s_100_m_none_c_none");

  // verifies that OAuth tokens (like 'ya29.xxxx') are not accidentally in the key string
  assert.ok(!res1.normalizedString.includes("ya29."));
});
