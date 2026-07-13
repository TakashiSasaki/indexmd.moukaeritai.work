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
import { installNetworkGuard } from "../support/NetworkGuard";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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

  await t.test("standalone public route analysis uses injected dependencies", async () => {
    fakeTransport.queuedResponses.push({
      status: 200,
      data: {
        schemaVersion: "visual-analysis.v0.2.0-draft.1",
        summary: {
          caption: "standalone success",
          description: "desc"
        },
        visualInfo: {
          imageKind: "naturalPhoto",
          imageKindConfidence: 0.99,
          sceneDescription: "A deterministic standalone route test image.",
          visibleElements: [],
          visibleText: [],
          uncertainties: []
        },
        indexing: {
          keywords: [
            {
              value: "standalone",
              confidence: 0.99,
              importance: 1
            }
          ]
        },
        quality: {
          confidence: 0.99,
          issues: []
        }
      }
    });

    const res = await request(app)
      .post("/api/visual/public-samples/analyze")
      .send({
        sampleId: "sample-landscape-1",
        modelName: "gemini-2.5-flash",
        jsonMode: "native_schema"
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.record.visualAnalysis.summary.caption, "standalone success");

    const reqPayload = fakeTransport.requests[fakeTransport.requestCount - 1];
    assert.strictEqual(reqPayload.model, "gemini-2.5-flash");

    fakeTransport.requests.length = 0;
    fakeTransport.requestCount = 0;
  });

  await t.test("Can execute batch jobs safely through the fake transport and characterize prompt", async () => {
    const CACHE_JOBS_DIR = path.join(process.cwd(), 'cache', 'visual-batch-jobs');
    const initialFiles = fs.existsSync(CACHE_JOBS_DIR) ? fs.readdirSync(CACHE_JOBS_DIR).filter(f => f.endsWith('.json')).length : 0;
    fakeTransport.queuedResponses.push({
      status: 200,
      data: {
        schemaVersion: "visual-analysis.v0.2.0-draft.1",
        summary: { caption: "success", description: "desc" },
        visualInfo: {
          imageKind: "naturalPhoto",
          imageKindConfidence: 0.99,
          sceneDescription: "A test image.",
          visibleElements: [],
          visibleText: [],
          uncertainties: []
        },
        indexing: {
          keywords: [
            { value: "test", confidence: 0.99, importance: 1 }
          ]
        },
        quality: {
          confidence: 0.99,
          issues: []
        }
      }
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

    // Wait for deterministic completion
    const completionPromise = registry.waitForJob(jobId);
    if (completionPromise) {
      await completionPromise;
    }

    const finalStatusRes = await request(app).get(`/api/visual/batch-jobs/${jobId}`);
    // Allow runner state to persist fully
    await new Promise(r => setTimeout(r, 10));
    // Wait up to 2 seconds for runner to finish
    let retries = 20;
    while (retries-- > 0) {
      const res = await request(app).get(`/api/visual/batch-jobs/${jobId}`);
      if (res.body.job?.status === "completed" || res.body.job?.status === "failed" || res.body.job?.status === "canceled") break;
      await new Promise(r => setTimeout(r, 100));
    }
    const finalPollRes = await request(app).get(`/api/visual/batch-jobs/${jobId}`);
    assert.strictEqual(finalPollRes.body.job?.status, "completed");

    // Check prompt characterization
    assert.strictEqual(fakeTransport.requestCount, 1);
    const reqPayload = fakeTransport.requests[0];
    
    assert.strictEqual(reqPayload.model, "gemini-2.5-flash");
    assert.strictEqual(reqPayload.mimeType, "image/jpeg");
    assert.strictEqual(reqPayload.sampleId, "sample-landscape-1");
    // Ensure unsafe values are stripped
    assert.strictEqual(reqPayload.systemInstruction, undefined);
    assert.strictEqual(reqPayload.sample?.data, undefined);

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

    // Helper to test multiple invalid cases
    const verifyPreflightError = async (payload: any) => {
      const res = await request(app).post("/api/visual/batch-jobs").send(payload);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(JSON.stringify(store.getJob(jobId)), activeJobJsonBefore);
      assert.strictEqual(fakeTransport.requestCount, reqCountBefore);
    };

    // 2. Submit invalid preflight (discontinued model)
    await verifyPreflightError({
      modelName: "gemini-1.5-pro", // Discontinued
      targetSampleIds: ["sample-landscape-1"],
      jsonMode: "native_schema",
    });

    // 3. Unknown model
    await verifyPreflightError({
      modelName: "gemini-unknown-123",
      targetSampleIds: ["sample-landscape-1"],
      jsonMode: "native_schema",
    });

    // 4. Unknown sample ID
    await verifyPreflightError({
      modelName: "gemini-2.5-flash",
      targetSampleIds: ["sample-unknown-123"],
      jsonMode: "native_schema",
    });

    // 5. Duplicate sample ID
    await verifyPreflightError({
      modelName: "gemini-2.5-flash",
      targetSampleIds: ["sample-landscape-1", "sample-landscape-1"],
      jsonMode: "native_schema",
    });

    // 6. Invalid execution mode
    await verifyPreflightError({
      modelName: "gemini-2.5-flash",
      targetSampleIds: ["sample-landscape-1"],
      jsonMode: "invalid_mode",
    });
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
