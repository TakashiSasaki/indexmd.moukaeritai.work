import { test } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";

test("Architecture checks", async (t) => {
  await t.test("createApp() creates a new Express app", () => {
    const appTs = fs.readFileSync("src/app.ts", "utf8");
    assert.ok(appTs.includes("const app = express();"), "createApp should instantiate express()");
    assert.ok(!appTs.match(/export const app = express\(\);/), "Should not export a global express app");
  });

  await t.test("no production sample-ID test prefixes", () => {
    const preflightTs = fs.readFileSync("src/lib/visualAnalysis/preflight.ts", "utf8");
    assert.ok(!preflightTs.includes('"test-"'), "test- prefix should be removed");
    assert.ok(!preflightTs.includes('"mock-"'), "mock- prefix should be removed");
    assert.ok(!preflightTs.includes('"sample-"'), "sample- prefix should be removed");
  });

  await t.test("preflight does not mutate a global resolver", () => {
    const preflightTs = fs.readFileSync("src/lib/visualAnalysis/preflight.ts", "utf8");
    assert.ok(!preflightTs.includes("activeSampleResolver ="), "Global resolver mutation is banned");
    assert.ok(!preflightTs.includes("setSampleResolver("), "setSampleResolver is banned");
  });

  await t.test("runner does not mutate a global job store", () => {
    const runnerTs = fs.readFileSync("src/lib/visualAnalysis/serverJobs/jobRunner.ts", "utf8");
    assert.ok(!runnerTs.includes("jobStore = deps.jobStore"), "Global jobStore mutation is banned in runner");
  });

  await t.test("production routes do not directly instantiate Gemini transport", () => {
    const appTs = fs.readFileSync("src/app.ts", "utf8");
    assert.ok(!appTs.includes("new GeminiSdkProviderTransport()"), "Routes should use injected transport");
  });

  await t.test("request descriptions cannot contain inlineData.data", () => {
    const fakeTs = fs.readFileSync("src/lib/visualAnalysis/fakeProviderTransport.ts", "utf8");
    assert.ok(fakeTs.includes("[SANITIZED_BINARY_DATA]"), "Fake transport should sanitize binary data");
  });

  await t.test("batch preflight precedes destructive cancellation", () => {
    const appTs = fs.readFileSync("src/app.ts", "utf8");
    const preflightIdx = appTs.indexOf("preflightVisualExecution(");
    const cancelIdx = appTs.indexOf("activeJobs = store.listJobs().filter(");
    assert.ok(preflightIdx !== -1 && cancelIdx !== -1, "Both preflight and cancellation should exist");
    assert.ok(preflightIdx < cancelIdx, "Preflight must precede job cancellation");
  });

  await t.test("no tracked scratch/test-output files", () => {
    assert.ok(!fs.existsSync("test_output.txt"), "test_output.txt should not exist");
  });
});
