import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";

test("Repository Hygiene: No temporary, patch, or scratch files at root", () => {
  const rootDir = process.cwd();
  const files = fs.readdirSync(rootDir);

  const prohibitedPatterns = [
    /^final_test\.txt$/,
    /^test_log\.txt$/,
    /^test_output\.txt$/,
    /^test_out\d*\.txt$/,
    /^patch_.*\.mjs$/,
    /^patch_.*\.sh$/,
    /^fix_server\.(js|py)$/,
    /^migrate\.js$/,
    /^new_job_id\.txt$/,
    /^test_debug.*$/,
    /^test-analyze\.ts$/,
    /^test-media-resolution\.ts$/,
    /^test-text-heavy\.ts$/,
    /^test_health\.ts$/,
    /^wait.*\.sh$/
  ];

  const violations: string[] = [];

  for (const file of files) {
    for (const pattern of prohibitedPatterns) {
      if (pattern.test(file)) {
        violations.push(file);
      }
    }
  }

  assert.strictEqual(
    violations.length,
    0,
    `Found prohibited scratch/temporary/patch files in root: ${violations.join(", ")}`
  );
});
