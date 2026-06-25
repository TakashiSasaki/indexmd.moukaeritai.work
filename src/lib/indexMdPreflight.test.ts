import test, { describe } from "node:test";
import assert from "node:assert";
import { runIndexMdPreflight } from "./indexMdPreflight";

describe("indexMdPreflight pure helper", () => {
  const generatedMarkdown = "<!-- AUTO_GENERATED_START -->\nNew Block\n<!-- AUTO_GENERATED_END -->";

  test("returns missing-index when no candidates", () => {
    const result = runIndexMdPreflight({
      candidates: [],
      existingMarkdown: null,
      generatedMarkdown,
    });
    assert.strictEqual(result.status, "missing-index");
    assert.strictEqual(result.canProceedToFutureWrite, true);
    assert.strictEqual(result.mergedMarkdown, generatedMarkdown);
  });

  test("returns multiple-index-candidates when multiple files match", () => {
    const result = runIndexMdPreflight({
      candidates: [
        { fileId: "1", fileName: "index.md" },
        { fileId: "2", fileName: "index.md" },
      ],
      existingMarkdown: null,
      generatedMarkdown,
    });
    assert.strictEqual(result.status, "multiple-index-candidates");
    assert.strictEqual(result.canProceedToFutureWrite, false);
  });

  test("returns read-error if single candidate but existingMarkdown is null", () => {
    const result = runIndexMdPreflight({
      candidates: [{ fileId: "1", fileName: "index.md" }],
      existingMarkdown: null,
      generatedMarkdown,
    });
    assert.strictEqual(result.status, "read-error");
    assert.strictEqual(result.canProceedToFutureWrite, false);
  });

  test("returns merge-ready when successfully replaced existing block", () => {
    const existingMarkdown = "Header\n<!-- AUTO_GENERATED_START -->\nOld\n<!-- AUTO_GENERATED_END -->\nFooter";
    const result = runIndexMdPreflight({
      candidates: [{ fileId: "1", fileName: "index.md" }],
      existingMarkdown,
      generatedMarkdown,
    });
    assert.strictEqual(result.status, "merge-ready");
    assert.strictEqual(result.canProceedToFutureWrite, true);
    assert.strictEqual(result.mergeStatus, "replaced-existing-block");
    assert.ok(result.mergedMarkdown?.includes("New Block"));
    assert.ok(result.mergedMarkdown?.includes("Header"));
    assert.ok(result.mergedMarkdown?.includes("Footer"));
  });

  test("returns merge-blocked if missing markers and not allowing append", () => {
    const existingMarkdown = "Header\nFooter";
    const result = runIndexMdPreflight({
      candidates: [{ fileId: "1", fileName: "index.md" }],
      existingMarkdown,
      generatedMarkdown,
      allowAppendIfMissing: false,
    });
    assert.strictEqual(result.status, "merge-blocked");
    assert.strictEqual(result.canProceedToFutureWrite, false);
    assert.strictEqual(result.mergeStatus, "missing-start-marker");
  });

  test("returns merge-ready if missing markers but allowing append", () => {
    const existingMarkdown = "Header\nFooter";
    const result = runIndexMdPreflight({
      candidates: [{ fileId: "1", fileName: "index.md" }],
      existingMarkdown,
      generatedMarkdown,
      allowAppendIfMissing: true,
    });
    assert.strictEqual(result.status, "merge-ready");
    assert.strictEqual(result.canProceedToFutureWrite, true);
    assert.strictEqual(result.mergeStatus, "appended-new-block");
    assert.ok(result.mergedMarkdown?.includes(generatedMarkdown));
  });
});
