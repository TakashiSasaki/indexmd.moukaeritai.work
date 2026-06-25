import { test } from "node:test";
import assert from "node:assert";
import { runWithExplicitResult } from "./firestoreResult.js";

test("runWithExplicitResult classifies promise outcomes correctly", async () => {
  // 1. resolved promise returns confirmed
  const fastPromise = Promise.resolve();
  const res1 = await runWithExplicitResult(fastPromise, 100);
  assert.deepStrictEqual(res1, { status: "confirmed" });

  // 2. slow promise returns timeout
  const slowPromise = new Promise<void>((resolve) => setTimeout(resolve, 200));
  const res2 = await runWithExplicitResult(slowPromise, 50);
  assert.deepStrictEqual(res2, { status: "timeout" });

  // 2b. extremely short timeout returns timeout without waiting excessively
  const startTime = Date.now();
  // Using an empty promise that never resolves avoids lingering setTimeout handles
  const verySlowPromise = new Promise<void>(() => {});
  const resVeryShortTimeout = await runWithExplicitResult(verySlowPromise, 1);
  const duration = Date.now() - startTime;
  assert.deepStrictEqual(resVeryShortTimeout, { status: "timeout" });
  assert.ok(duration < 1000, `Took too long: ${duration}ms`);

  // 3. rejected promise returns failed
  const rejectedPromise = Promise.reject(new Error("Database write error"));
  const res3 = await runWithExplicitResult(rejectedPromise, 100);
  assert.strictEqual(res3.status, "failed");
  assert.strictEqual((res3 as any).error, "Database write error");

  // 4. permission denied rejection returns failed, not timeout
  const permissionDeniedPromise = Promise.reject(new Error("Missing or insufficient permissions"));
  const res4 = await runWithExplicitResult(permissionDeniedPromise, 100);
  assert.strictEqual(res4.status, "failed");
  assert.strictEqual((res4 as any).error, "Missing or insufficient permissions");
});
