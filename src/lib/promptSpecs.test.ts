import { test } from "node:test";
import assert from "node:assert";
import { 
  buildFileSummaryPrompt, 
  buildFolderSummaryPrompt, 
  buildDebugTextFileSummaryPrompt, 
  buildDebugBinaryFileSummaryPrompt,
  buildSummaryDebugSystemInstruction,
  buildStructuredSummaryTaskPrompt
} from "./promptSpecs.js";

test("buildFileSummaryPrompt constructs valid prompt", () => {
  const result = buildFileSummaryPrompt({
    name: "test.txt",
    mimeType: "text/plain",
    size: 1024,
    contentSample: "Hello world"
  });

  assert.ok(result.includes("test.txt"));
  assert.ok(result.includes("text/plain"));
  assert.ok(result.includes("1024"));
  assert.ok(result.includes("Hello world"));
  assert.ok(result.includes("Japanese"));
  assert.ok(result.includes("1-sentence"));
  assert.ok(!result.includes("undefined"));
  assert.ok(!result.includes("null"));
});

test("buildFolderSummaryPrompt constructs valid prompt", () => {
  const result = buildFolderSummaryPrompt({
    folderName: "My Docs",
    subdirs: [{ name: "Sub1", summary: "Sub1 Summary" }],
    fileSummariesList: ["- **file1.txt**: summary1"]
  });

  assert.ok(result.includes("My Docs"));
  assert.ok(result.includes("Sub1/ (Subfolder AI Summary: Sub1 Summary)"));
  assert.ok(result.includes("- **file1.txt**: summary1"));
  assert.ok(result.includes("Japanese"));
  assert.ok(result.includes("3-4 sentences"));
  assert.ok(!result.includes("undefined"));
  assert.ok(!result.includes("null"));
});

test("buildFolderSummaryPrompt handles empty files and subdirs", () => {
  const result = buildFolderSummaryPrompt({
    folderName: "Empty Dir",
    subdirs: [],
    fileSummariesList: []
  });

  assert.ok(result.includes("Empty Dir"));
  assert.ok(result.includes("(No subdirectories)"));
  assert.ok(result.includes("(No files)"));
});

test("buildDebugTextFileSummaryPrompt constructs valid prompt", () => {
  const result = buildDebugTextFileSummaryPrompt({
    name: "data.csv",
    mimeType: "text/csv",
    contentSample: "a,b,c"
  });

  assert.ok(result.includes("data.csv"));
  assert.ok(result.includes("text/csv"));
  assert.ok(result.includes("a,b,c"));
  assert.ok(result.includes("日本語で"));
  assert.ok(result.includes("要約"));
  assert.ok(!result.includes("undefined"));
});

test("buildDebugBinaryFileSummaryPrompt constructs valid prompt", () => {
  const result = buildDebugBinaryFileSummaryPrompt({
    name: "image.png",
    mimeType: "image/png"
  });

  assert.ok(result.includes("image.png"));
  assert.ok(result.includes("image/png"));
  assert.ok(result.includes("日本語で"));
  assert.ok(result.includes("要約"));
  assert.ok(!result.includes("undefined"));
});

test("buildSummaryDebugSystemInstruction returns correct string", () => {
  const result = buildSummaryDebugSystemInstruction();
  assert.ok(result.includes("Japanese"));
  assert.ok(result.includes("oneLineSummary"));
});

test("buildStructuredSummaryTaskPrompt constructs valid prompt with custom instruction", () => {
  const result = buildStructuredSummaryTaskPrompt({
    name: "test.md",
    mimeType: "text/markdown",
    contentSample: "# Hello\nworld"
  }, "Important text");

  assert.ok(result.includes("test.md"));
  assert.ok(result.includes("text/markdown"));
  assert.ok(result.includes("# Hello\nworld"));
  assert.ok(result.includes("Important text"));
  assert.ok(result.includes("JSON"));
  assert.ok(!result.includes("undefined"));
  assert.ok(!result.includes("null"));
});

test("buildStructuredSummaryTaskPrompt constructs valid prompt without custom instruction", () => {
  const result = buildStructuredSummaryTaskPrompt({
    name: "test.md",
    mimeType: "text/markdown",
    contentSample: "# Hello\nworld"
  });

  assert.ok(result.includes("test.md"));
  assert.ok(result.includes("text/markdown"));
  assert.ok(result.includes("# Hello\nworld"));
  assert.ok(!result.includes("ユーザー追加指示"));
  assert.ok(result.includes("JSON"));
  assert.ok(!result.includes("undefined"));
  assert.ok(!result.includes("null"));
});
