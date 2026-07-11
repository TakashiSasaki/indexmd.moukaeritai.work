import { test } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "../../src/app";
import { FakeProviderTransport } from "../support/FakeProviderTransport";
import { defaultSampleResolver } from "../../src/lib/visualAnalysis/preflight";
import { RunnerRegistry } from "../../src/lib/visualAnalysis/serverJobs/runnerRegistry";
import { InMemoryJobStore } from "../../src/lib/visualAnalysis/serverJobs/InMemoryJobStore";
import { fakeImageFetcher } from "../support/FakeImageFetcher.js";
import { FakeSampleResolver } from "../support/FakeSampleResolver.js";
import fs from "fs";
import path from "path";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function installNetworkGuard() {
  const originalFetch = global.fetch;
  global.fetch = async (url: string | URL | Request) => {
    throw new Error(`[NetworkGuard] Unexpected network request to ${url}`);
  };
  return () => {
    global.fetch = originalFetch;
  };
}

test("Isolated Public Execution Integration", async (t) => {
  const cleanupNetworkGuard = installNetworkGuard();

  t.after(() => {
    cleanupNetworkGuard();
  });

  const fakeTransport = new FakeProviderTransport();
  const mockClock = { now: () => new Date() };
  const store = new InMemoryJobStore(mockClock);
  const registry = new RunnerRegistry();
  const { app } = createApp({
    providerTransport: fakeTransport,
    sampleResolver: new FakeSampleResolver(),
    jobStore: store,
    runnerRegistry: registry,
    clock: mockClock,
    imageFetcher: fakeImageFetcher as any,
  });

  await t.test("Can execute batch jobs safely through the fake transport and characterize prompt", async () => {
    const CACHE_JOBS_DIR = path.join(process.cwd(), 'cache', 'visual-batch-jobs');
    const initialFiles = fs.existsSync(CACHE_JOBS_DIR) ? fs.readdirSync(CACHE_JOBS_DIR).filter(f => f.endsWith('.json')).length : 0;
    fakeTransport.queuedResponses.push({
      status: 200,
      data: { schemaVersion: "visual-analysis.v0.2.0-draft.1", summary: { caption: "success", description: "desc" } }
    });

    const res = await request(app)
      .post("/api/visual/batch-jobs")
      .send({
        modelName: "gemini-2.5-flash",
        targetSampleIds: ["sample-landscape-1"],
        jsonMode: "native_schema",
        customInstruction: "Special rules apply"
      });

    assert.strictEqual(res.status, 201);
    const jobId = res.body.job.jobId;
    assert.ok(jobId);

    // Poll until complete
    let jobStatus = "queued";
    for (let i = 0; i < 20; i++) {
      const statusRes = await request(app).get(`/api/visual/batch-jobs/${jobId}`);
      if (statusRes.status === 200) {
        jobStatus = statusRes.body.job?.status;
      } else {
        console.error("status error", statusRes.status, statusRes.body);
      }
      if (jobStatus === "completed" || jobStatus === "failed") break;
      await delay(100);
    }

    assert.strictEqual(jobStatus, "completed");

    // Check prompt characterization
    assert.strictEqual(fakeTransport.requestCount, 1);
    const reqPayload = fakeTransport.requests[0];
    
    assert.ok(reqPayload.systemInstruction.includes("User Instruction: Special rules apply"));
    assert.strictEqual(reqPayload.preparedExecution.canonicalModelId, "gemini-2.5-flash");
    assert.strictEqual(reqPayload.sample.data, "[SANITIZED_BINARY_DATA]");

    const finalFiles = fs.existsSync(CACHE_JOBS_DIR) ? fs.readdirSync(CACHE_JOBS_DIR).filter(f => f.endsWith('.json')).length : 0;
    assert.strictEqual(finalFiles, initialFiles, "Integration tests should not create files under cache/visual-batch-jobs");
  });

  await t.test("Invalid preflight leaves job byte-for-byte unchanged", async () => {
    // 1. Create a dummy active job manually in the store
    const jobId = "preflight-test-job";
    store.createJob({
      jobId,
      status: "running",
      createdAt: mockClock.now().toISOString(),
      updatedAt: mockClock.now().toISOString(),
      modelName: "gemini-test",
      jsonMode: "prompt_only",
      customInstructionPreview: "",
      targetSampleIds: ["sample-landscape-1"],
      completedSampleIds: [],
      failedSampleIds: [],
      pendingSampleIds: ["sample-landscape-1"],
      counters: { total: 1, successCount: 0, failureCount: 0, validCount: 0, validLowQualityCount: 0, invalidJsonCount: 0, expectedComparisonPassCount: 0, expectedComparisonWarningCount: 0, expectedComparisonFailCount: 0, reviewPassCount: 0, reviewNeedsReviewCount: 0, reviewFailCount: 0 },
      items: [],
      revision: 1
    });

    const activeJobJsonBefore = JSON.stringify(store.getJob(jobId));

    const reqCountBefore = fakeTransport.requestCount;

    // 2. Submit invalid preflight (discontinued model)
    const res = await request(app)
      .post("/api/visual/batch-jobs")
      .send({
        modelName: "gemini-1.5-pro", // Discontinued
        targetSampleIds: ["sample-landscape-1"],
        jsonMode: "native_schema",
      });

    assert.strictEqual(res.status, 400);

    // 3. Verify it's byte-for-byte identical
    const activeJobJsonAfter = JSON.stringify(store.getJob(jobId));
    assert.strictEqual(activeJobJsonAfter, activeJobJsonBefore);

    // 4. Verify no provider request was made
    assert.strictEqual(fakeTransport.requestCount, reqCountBefore);
  });

  await t.test("two apps do not share stores or runner registries", async () => {
    const store2 = new InMemoryJobStore(mockClock);
    const registry2 = new RunnerRegistry();
    const app2 = createApp({
      providerTransport: fakeTransport,
      sampleResolver: new FakeSampleResolver(),
      jobStore: store2,
      runnerRegistry: registry2,
      clock: mockClock,
      imageFetcher: fakeImageFetcher as any,
    }).app;

    store2.createJob({
      jobId: 'app2-only-job',
      status: 'queued',
      createdAt: mockClock.now().toISOString(),
      updatedAt: mockClock.now().toISOString(),
      modelName: 'gemini-test',
      jsonMode: 'prompt_only',
      customInstructionPreview: '',
      targetSampleIds: [],
      completedSampleIds: [],
      failedSampleIds: [],
      pendingSampleIds: [],
      counters: { total: 0, successCount: 0, failureCount: 0, validCount: 0, validLowQualityCount: 0, invalidJsonCount: 0, expectedComparisonPassCount: 0, expectedComparisonWarningCount: 0, expectedComparisonFailCount: 0, reviewPassCount: 0, reviewNeedsReviewCount: 0, reviewFailCount: 0 },
      items: [],
    });

    assert.ok(store2.getJob('app2-only-job'));
    assert.strictEqual(store.getJob('app2-only-job'), undefined);

    // Using identical job ID shouldn't collide
    store.createJob({
      jobId: 'app2-only-job',
      status: 'completed',
      createdAt: mockClock.now().toISOString(),
      updatedAt: mockClock.now().toISOString(),
      modelName: 'gemini-test',
      jsonMode: 'prompt_only',
      customInstructionPreview: '',
      targetSampleIds: [],
      completedSampleIds: [],
      failedSampleIds: [],
      pendingSampleIds: [],
      counters: { total: 0, successCount: 0, failureCount: 0, validCount: 0, validLowQualityCount: 0, invalidJsonCount: 0, expectedComparisonPassCount: 0, expectedComparisonWarningCount: 0, expectedComparisonFailCount: 0, reviewPassCount: 0, reviewNeedsReviewCount: 0, reviewFailCount: 0 },
      items: [],
    });

    assert.strictEqual(store2.getJob('app2-only-job')?.status, 'queued');
    assert.strictEqual(store.getJob('app2-only-job')?.status, 'completed');
  });
});
