import { test } from "node:test";
import assert from "node:assert";
import { preflightVisualExecution } from "./preflight";
import { FakeProviderTransport } from "./fakeProviderTransport";

test("Provider Transport - exact pre-SDK assertion", async (t) => {
  await t.test("asserts exact parameters are built and sanitized without metadata leaking", async () => {
    // 1. Arrange a prepared execution via preflight
    const request = {
      modelId: "gemini-2.5-flash",
      executionMode: "native_schema",
      sampleIds: ["sample-transient"],
      systemInstruction: "Please classify the image.",
      maxOutputTokens: 2048,
      temperature: 0.2,
      topP: 0.9,
      mediaResolution: "high",
    };

    // Need to use defaultSampleResolver since we removed test- prefixes
    // Wait, preflight uses defaultSampleResolver by default. But it only accepts real samples.
    // If "sample-transient" is not registered, preflight will throw!
    // We must pass a custom resolver here to allow "sample-transient".
    const mockResolver = {
      hasSample: () => true,
      isExternalDescriptor: () => false
    };

    const preparedExecution = preflightVisualExecution(request, { sampleResolver: mockResolver });

    // 2. Mock sample payload
    const sample = {
      sampleId: "sample-transient",
      mimeType: "image/png",
      data: Buffer.from("fake-png-data"),
    };

    const transport = new FakeProviderTransport();
    transport.queuedResponses.push({
      status: 200,
      data: { schemaVersion: "visual-analysis.v0.2.0-draft.1", summary: { caption: "mock", description: "mock" } }
    });

    const response = await transport.executeSingleRequest({
      preparedExecution,
      sample,
      systemInstruction: "Please classify the image."
    });

    assert.ok(response.success);
    assert.strictEqual(transport.requests.length, 1);
    const capturedReq = transport.requests[0];

    assert.strictEqual(capturedReq.preparedExecution.canonicalModelId, "gemini-2.5-flash");
    assert.strictEqual(capturedReq.preparedExecution.generationConfiguration.temperature, 0.2);
    assert.strictEqual(capturedReq.preparedExecution.generationConfiguration.topP, 0.9);
    assert.strictEqual(capturedReq.preparedExecution.mediaResolutionConfiguration.requested, "high");

    // - absence of raw base64 data in metadata/snapshots
    assert.strictEqual(capturedReq.sample.data, "[SANITIZED_BINARY_DATA]");
  });
});
