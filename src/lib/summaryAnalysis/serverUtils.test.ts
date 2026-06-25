import { test } from "node:test";
import assert from "node:assert";
import { processStructuredSummaryOutput } from "./serverUtils.js";

test("processStructuredSummaryOutput handles empty structured output '{}'", async () => {
  const result = await processStructuredSummaryOutput("{}", "gemini-3.5-flash", {});
  assert.strictEqual(result.error, "Structured output was empty or under-generated");
  assert.strictEqual(result.failureKind, "emptyStructuredOutput");
  assert.strictEqual(result.emptyStructuredOutput, true);
  assert.strictEqual(result.structuredParseFailed, false);
});

test("processStructuredSummaryOutput handles empty string with parse error", async () => {
  const result = await processStructuredSummaryOutput("  ", "gemini-3.5-flash", {});
  assert.strictEqual(result.structuredParseFailed, true);
  assert.ok(result.error?.includes("JSON parse failed"));
  assert.strictEqual(result.failureKind, "jsonParseError");
});

test("processStructuredSummaryOutput handles object with missing most root sections", async () => {
  const result = await processStructuredSummaryOutput(JSON.stringify({ summary: { oneLine: "Hello" } }), "gemini-3.5-flash", {});
  assert.strictEqual(result.error, "Structured output was empty or under-generated");
  assert.strictEqual(result.failureKind, "underGeneratedStructuredOutput");
  assert.strictEqual(result.underGeneratedStructuredOutput, true);
  assert.strictEqual(result.structuredParseFailed, false);
});
