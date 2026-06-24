import { test } from "node:test";
import assert from "node:assert";
import {
  isIgnoredFolderName,
  isIgnoredPath,
  shouldIgnoreDirectory,
  selectIgnoredDirectoryIdsForPrune
} from "./ignoreRules.js";

test("ignoreRules helper behaves correctly", () => {
  const ignored = ["node_modules", "temp"];

  // 1. isIgnoredFolderName tests
  assert.strictEqual(isIgnoredFolderName("node_modules", ignored), true);
  assert.strictEqual(isIgnoredFolderName("pkg", ignored), false);
  assert.strictEqual(isIgnoredFolderName("", ignored), false);
  assert.strictEqual(isIgnoredFolderName(undefined, ignored), false);

  // 2. isIgnoredPath tests
  assert.strictEqual(isIgnoredPath("/project/node_modules", ignored), true);
  assert.strictEqual(isIgnoredPath("/project/node_modules/pkg", ignored), true);
  assert.strictEqual(isIgnoredPath("/project/temp/files", ignored), true);
  assert.strictEqual(isIgnoredPath("/project/my-node_modules-backup", ignored), false); // must not match partially
  assert.strictEqual(isIgnoredPath("", ignored), false);
  assert.strictEqual(isIgnoredPath(null, ignored), false);

  // 3. shouldIgnoreDirectory tests
  assert.strictEqual(shouldIgnoreDirectory({ name: "pkg", path: "/project/node_modules/pkg" }, ignored), true);
  assert.strictEqual(shouldIgnoreDirectory({ name: "node_modules", path: "/project" }, ignored), true);
  assert.strictEqual(shouldIgnoreDirectory({ name: "src", path: "/project/src" }, ignored), false);

  // 4. empty ignore list matches nothing
  assert.strictEqual(isIgnoredFolderName("node_modules", []), false);
  assert.strictEqual(isIgnoredPath("/project/node_modules", []), false);
  assert.strictEqual(shouldIgnoreDirectory({ name: "node_modules", path: "/project/node_modules" }, []), false);

  // 5. selectIgnoredDirectoryIdsForPrune tests
  const sampleDirs = [
    { drive_id: "id1", name: "node_modules", path: "/project/node_modules" },
    { drive_id: "id2", name: "src", path: "/project/src" },
    { drive_id: "id3", name: "pkg", path: "/project/node_modules/pkg" },
    { drive_id: "id4", name: "temp-dir", path: "/project/temp/subdir" }
  ];
  const pruned = selectIgnoredDirectoryIdsForPrune(sampleDirs, ignored);
  assert.deepStrictEqual(pruned, ["id1", "id3", "id4"]);
});
