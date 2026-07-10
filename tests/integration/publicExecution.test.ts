import { test } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "../../src/app";
import { FakeProviderTransport } from "../../src/lib/visualAnalysis/fakeProviderTransport";
import { defaultSampleResolver } from "../../src/lib/visualAnalysis/preflight";
import { jobStore } from "../../src/lib/visualAnalysis/serverJobs/jobStore";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

test("Isolated Public Execution Integration", async (t) => {
  const fakeTransport = new FakeProviderTransport();
  const { app } = createApp({
    providerTransport: fakeTransport,
    sampleResolver: defaultSampleResolver,
    jobStore: jobStore
  });

  await t.test("Can execute batch jobs safely through the fake transport and characterize prompt", async () => {
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
  });
});
