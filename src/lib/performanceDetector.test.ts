import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { analyzePerformanceAntiPatterns } from "./performanceStaticAnalyzer.js";
import { createUpdateCoalescer } from "./performanceRuntimeTracker.js";

// Helper function to recursively find all .ts and .tsx files in a directory
function findFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      // Exclude large external or built directories
      if (
        file === "node_modules" ||
        file === "dist" ||
        file === ".git" ||
        file === "cache" ||
        file === "coverage"
      ) {
        continue;
      }
      findFiles(filePath, fileList);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

test("Proposal A: Static Performance Analyzer detects known anti-patterns", () => {
  // Test Case 1: includeMetadataChanges without bypass
  const badMetadataCode = `
    const unsubscribe = onSnapshot(docRef, { includeMetadataChanges: true }, (doc) => {
      console.log(doc.data());
    });
  `;
  const issues1 = analyzePerformanceAntiPatterns(badMetadataCode, "test-file-1.tsx");
  assert.ok(issues1.length > 0);
  assert.strictEqual(issues1[0].ruleId, "NO_METADATA_CHANGES_UNGUARDED");

  // Test Case 2: includeMetadataChanges with bypass comment
  const cleanMetadataCode = `
    // perf-bypass: Need real-time local cache update confirmation for UI indicators
    const unsubscribe = onSnapshot(docRef, { includeMetadataChanges: true }, (doc) => {
      console.log(doc.data());
    });
  `;
  const issues2 = analyzePerformanceAntiPatterns(cleanMetadataCode, "test-file-2.tsx");
  assert.strictEqual(issues2.length, 0);

  // Test Case 3: Missing cleanup returned in useEffect with onSnapshot
  const missingCleanupCode = `
    useEffect(() => {
      onSnapshot(collectionRef, (snap) => {
        setCount(snap.size);
      });
    }, [userId]);
  `;
  const issues3 = analyzePerformanceAntiPatterns(missingCleanupCode, "test-file-3.tsx");
  assert.ok(issues3.length > 0);
  assert.strictEqual(issues3[0].ruleId, "ONSNAPSHOT_CLEANUP_CHECK");

  // Test Case 4: Inline literal objects in useEffect dependencies list
  const inlineLiteralCode = `
    useEffect(() => {
      fetchData();
    }, [userId, {}]);
  `;
  const issues4 = analyzePerformanceAntiPatterns(inlineLiteralCode, "test-file-4.tsx");
  assert.ok(issues4.length > 0);
  assert.strictEqual(issues4[0].ruleId, "USEEFFECT_DEPENDENCY_LITERAL_OBJECT");
});

test("Proposal B: Runtime Coalescer correctly batches rapid updates", (t, done) => {
  const receivedUpdates: string[][] = [];
  
  // Set up the update coalescer with a small delay
  const processBatch = (batch: string[]) => {
    receivedUpdates.push(batch);
  };
  
  const pushUpdate = createUpdateCoalescer<string>(processBatch, 10);
  
  // Trigger three rapid updates
  pushUpdate("Update 1");
  pushUpdate("Update 2");
  pushUpdate("Update 3");
  
  // Check immediately before the timeout - it should be empty (buffered)
  assert.strictEqual(receivedUpdates.length, 0);
  
  // Wait for the coalescing delay to pass and verify batch delivery
  setTimeout(() => {
    try {
      assert.strictEqual(receivedUpdates.length, 1, "Should deliver exactly 1 batch of coalesced updates.");
      assert.deepStrictEqual(receivedUpdates[0], ["Update 1", "Update 2", "Update 3"], "The batch must contain all elements.");
      done();
    } catch (err) {
      done(err as Error);
    }
  }, 25);
});

test("Continuous Integration: Workspace-wide Performance & Leak Audit", () => {
  const workspaceRoot = process.cwd();
  const srcDir = path.join(workspaceRoot, "src");
  
  if (!fs.existsSync(srcDir)) {
    console.log("⚠️ Skipping workspace-wide performance audit as 'src' directory was not found in " + workspaceRoot);
    return;
  }

  const allFiles = findFiles(srcDir);
  const allIssues: any[] = [];

  for (const filePath of allFiles) {
    const relativePath = path.relative(workspaceRoot, filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const fileIssues = analyzePerformanceAntiPatterns(content, relativePath);
    if (fileIssues.length > 0) {
      allIssues.push(...fileIssues);
    }
  }

  if (allIssues.length > 0) {
    console.log("\n⚠️ [Performance Static Analysis Report]");
    allIssues.forEach((issue) => {
      console.log(`[${issue.type.toUpperCase()}] ${issue.filePath}:${issue.line} (${issue.ruleId})`);
      console.log(`  Message: ${issue.message}`);
      console.log(`  Code:    ${issue.snippet}`);
      console.log("-".repeat(80));
    });
  }

  // We enforce that no CRITICAL 'error' level performance issues exist in the main source tree.
  const criticalErrors = allIssues.filter((i) => i.type === "error");
  assert.strictEqual(
    criticalErrors.length,
    0,
    `Found ${criticalErrors.length} critical performance issues/leaks! Please fix them to preserve application scalability.`
  );
});
