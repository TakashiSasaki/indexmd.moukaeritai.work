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
    assert.ok(!runnerTs.includes("let jobStore = defaultJobStore"), "Should not fall back to default singleton in runner module");
    assert.ok(!runnerTs.includes("import { jobStore as defaultJobStore"), "Runner should not import production jobStore singleton directly");
  });

  await t.test("integration tests do not import production job store singleton", () => {
    const files = fs.readdirSync("tests/integration");
    for (const file of files) {
      if (file.endsWith(".ts")) {
        const content = fs.readFileSync(path.join("tests/integration", file), "utf8");
        assert.ok(!content.includes("import { jobStore } from"), "Integration tests should not import production jobStore directly");
      }
    }
  });

  await t.test("integration tests do not import production network clients directly", () => {
    const files = fs.readdirSync("tests/integration");
    for (const file of files) {
      if (file.endsWith(".ts")) {
        const content = fs.readFileSync(path.join("tests/integration", file), "utf8");
        assert.ok(!content.includes("import { GeminiSdkProviderTransport }"), "Integration tests should not import GeminiSdkProviderTransport directly");
        assert.ok(!content.includes("from '@google/genai'"), "Integration tests should not import @google/genai directly");
      }
    }
  });

  await t.test("production routes do not directly instantiate Gemini transport", () => {
    const appTs = fs.readFileSync("src/app.ts", "utf8");
    assert.ok(!appTs.includes("new GeminiSdkProviderTransport()"), "Routes should use injected transport");
  });

  await t.test("request descriptions cannot contain inlineData.data", () => {
    const fakeTs = fs.readFileSync("tests/support/FakeProviderTransport.ts", "utf8");
    assert.ok(!fakeTs.includes("this.requests.push(safeReq)"), "Fake transport should not push entire request");
    assert.ok(fakeTs.includes("req.sample?.mimeType"), "Fake transport should extract specific safe keys instead of cloning");
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
