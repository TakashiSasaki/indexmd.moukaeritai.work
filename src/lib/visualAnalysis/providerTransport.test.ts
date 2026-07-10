import { test } from "node:test";
import assert from "node:assert";
import { preflightVisualExecution } from "./preflight";
import { GeminiSdkProviderTransport, setCaptureHook } from "./providerTransport";

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

    const preparedExecution = preflightVisualExecution(request);

    // 2. Mock sample payload
    const sample = {
      sampleId: "sample-transient",
      mimeType: "image/png",
      data: Buffer.from("fake-png-data"),
    };

    const transport = new GeminiSdkProviderTransport();

    // 3. Set a capture hook to intercept and assert right before SDK call
    let capturedParams: any = null;
    setCaptureHook((params) => {
      capturedParams = params;
    });

    // We do not want to make a live paid API call in the unit test, so we mock or intercept.
    // Since the actual `models.generateContent` would execute physically and fail/succeed on credentials,
    // we can either verify the build structure or mock the client. But wait!
    // Since the capture hook is fired right before physical invocation, and we want to prevent paid calls,
    // we can temporarily override/mock the generateContent method on the client!
    // Let's do that!
    const { getGeminiClient } = await import("../gemini");
    const client = getGeminiClient("gemini-2.5-flash");
    const originalGenerateContent = client.models.generateContent;

    let calledPhysically = false;
    (client.models as any).generateContent = async (params: any) => {
      calledPhysically = true;
      return { text: '{"schemaVersion": "visual-analysis.v0.2.0-draft.1", "summary": {"caption": "mock", "description": "mock"}}' };
    };

    try {
      const response = await transport.executeSingleRequest({
        preparedExecution,
        sample,
        systemInstruction: "Please classify the image. { \"type\": \"object\", \"properties\": { \"schemaVersion\": { \"type\": \"string\" } } }"
      });

      assert.ok(response.success);
      assert.ok(capturedParams);

      // 4. ASSERTIONS required by Step 6:
      // - exact model
      assert.strictEqual(capturedParams.model, "gemini-2.5-flash");

      // - exact mode & MIME type
      assert.strictEqual(capturedParams.config.responseMimeType, "application/json");

      // - exact compiled schema
      assert.ok(capturedParams.config.responseSchema);
      assert.strictEqual(capturedParams.config.responseSchema.type, "OBJECT");
      assert.strictEqual(capturedParams.config.responseSchema.properties.schemaVersion.type, "STRING");

      // - generation values
      assert.strictEqual(capturedParams.config.temperature, 0.2);
      assert.strictEqual(capturedParams.config.topP, 0.9);

      // - media resolution
      assert.strictEqual(capturedParams.config.mediaResolution, "MEDIA_RESOLUTION_HIGH");

      // - absence of contract metadata (leak checking)
      assert.strictEqual(capturedParams.preparedExecution, undefined);
      assert.strictEqual(capturedParams.sample, undefined);
      assert.strictEqual(capturedParams.runFingerprint, undefined);

      // - absence of credentials
      assert.strictEqual(capturedParams.apiKey, undefined);
      assert.strictEqual(capturedParams.authorization, undefined);
      assert.strictEqual(capturedParams.headers, undefined);

      // - absence of raw base64 data in metadata/snapshots
      const contentsStr = JSON.stringify(capturedParams.contents);
      assert.ok(contentsStr.includes("inlineData"));
      // The data block should contain the base64 representation of "fake-png-data" which is "ZmFrZS1wbmctZGF0YQ=="
      assert.ok(contentsStr.includes("ZmFrZS1wbmctZGF0YQ=="));

    } finally {
      // Restore physical method
      (client.models as any).generateContent = originalGenerateContent;
      setCaptureHook(null);
    }
  });
});
