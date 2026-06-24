import { test } from "node:test";
import assert from "node:assert";
import { resolvePathAndDepth, DriveFolderInfo } from "./driveTree.js";

test("resolvePathAndDepth resolves paths and depths correctly", () => {
  const folderMap = new Map<string, DriveFolderInfo>();
  folderMap.set("folder1", { name: "Documents", parents: ["root"] });
  folderMap.set("folder2", { name: "Project", parents: ["folder1"] });
  folderMap.set("folder3", { name: "Source", parents: ["folder2"] });

  // 1. root / undefined returns depth 0 and empty path
  const rootRes = resolvePathAndDepth("root", folderMap);
  assert.strictEqual(rootRes.depth, 0);
  assert.strictEqual(rootRes.path, "");

  const undefRes = resolvePathAndDepth(undefined, folderMap);
  assert.strictEqual(undefRes.depth, 0);
  assert.strictEqual(undefRes.path, "");

  // 2. direct child depth/path
  const directRes = resolvePathAndDepth("folder1", folderMap);
  assert.strictEqual(directRes.depth, 1);
  assert.strictEqual(directRes.path, "/Documents");

  // 3. nested child depth/path
  const nestedRes = resolvePathAndDepth("folder3", folderMap);
  assert.strictEqual(nestedRes.depth, 3);
  assert.strictEqual(nestedRes.path, "/Documents/Project/Source");

  // 4. missing parent fallback
  const missingRes = resolvePathAndDepth("nonexistent", folderMap);
  assert.strictEqual(missingRes.depth, 1);
  assert.strictEqual(missingRes.path, "/nonexistent");

  // If a parent of folder3 is missing from the map, it should fallback nicely
  const partiallyMissingMap = new Map<string, DriveFolderInfo>();
  partiallyMissingMap.set("folder3", { name: "Source", parents: ["folder_missing"] });
  const partialRes = resolvePathAndDepth("folder3", partiallyMissingMap);
  assert.strictEqual(partialRes.depth, 2);
  assert.strictEqual(partialRes.path, "/folder_missing/Source");

  // 5. cycle protection
  const cyclicMap = new Map<string, DriveFolderInfo>();
  cyclicMap.set("folderA", { name: "A", parents: ["folderB"] });
  cyclicMap.set("folderB", { name: "B", parents: ["folderA"] });

  const cyclicRes = resolvePathAndDepth("folderA", cyclicMap);
  assert.strictEqual(cyclicRes.path, "/CYCLE_DETECTED/B/A");
});
