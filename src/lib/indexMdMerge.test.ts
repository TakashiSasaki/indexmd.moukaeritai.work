import { test } from "node:test";
import assert from "node:assert";
import { mergeIndexMd, AUTO_GENERATED_START, AUTO_GENERATED_END } from "./indexMdMerge.js";

test("mergeIndexMd hybrid-merges content correctly", () => {
  const folderName = "My Folder";
  const aiContent = "\n## AI Summary\nThis is a cool summary\n";

  // 1. new file creation (no user notes / empty content)
  const resNew = mergeIndexMd("", folderName, aiContent);
  assert.ok(resNew.includes(`# ${folderName}`));
  assert.ok(resNew.includes("USER_NOTES_START"));
  assert.ok(resNew.includes(AUTO_GENERATED_START + aiContent + AUTO_GENERATED_END));

  // 2. replacing content between markers, preserving notes
  const existingWithNotes = `# ${folderName}
# My User Note Here
${AUTO_GENERATED_START}
Old AI content
${AUTO_GENERATED_END}
Footer note`;
  const resReplace = mergeIndexMd(existingWithNotes, folderName, aiContent);
  assert.ok(resReplace.includes("# My User Note Here"));
  assert.ok(resReplace.includes("Footer note"));
  assert.ok(resReplace.includes(AUTO_GENERATED_START + aiContent + AUTO_GENERATED_END));
  assert.ok(!resReplace.includes("Old AI content"));

  // 3. appending auto-generated block when markers are missing
  const legacyFile = `# ${folderName}
Some handwritten notes without markers.`;
  const resMissingMarkers = mergeIndexMd(legacyFile, folderName, aiContent);
  assert.ok(resMissingMarkers.startsWith(legacyFile));
  assert.ok(resMissingMarkers.endsWith(AUTO_GENERATED_START + aiContent + AUTO_GENERATED_END));

  // 4. appending auto-generated block when markers are malformed (end before start)
  const malformedFile = `# ${folderName}
${AUTO_GENERATED_END}
Some handwritten notes.
${AUTO_GENERATED_START}
More notes.`;
  const resMalformed = mergeIndexMd(malformedFile, folderName, aiContent);
  assert.ok(resMalformed.includes("Some handwritten notes."));
  assert.ok(resMalformed.endsWith(AUTO_GENERATED_START + aiContent + AUTO_GENERATED_END));

  // 5. Handles only whitespaces
  const resWhitespaces = mergeIndexMd("   \n  \t ", folderName, aiContent);
  assert.ok(resWhitespaces.includes(`# ${folderName}`));
  assert.ok(resWhitespaces.includes("USER_NOTES_START"));
  assert.ok(resWhitespaces.includes(AUTO_GENERATED_START + aiContent + AUTO_GENERATED_END));

  // 6. Multiple manual sections untouched
  const multiManual = `Before
${AUTO_GENERATED_START}
Old
${AUTO_GENERATED_END}
After
More After`;
  const resMulti = mergeIndexMd(multiManual, folderName, aiContent);
  assert.ok(resMulti.includes("Before\n"));
  assert.ok(resMulti.includes("\nAfter\nMore After"));
  assert.ok(resMulti.includes(AUTO_GENERATED_START + aiContent + AUTO_GENERATED_END));
});
