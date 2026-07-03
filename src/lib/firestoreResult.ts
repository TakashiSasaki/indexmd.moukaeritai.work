/**
 * Pure helper module for executing Firestore promises with explicit result classification and strict timeouts.
 */

export type FirestoreResult = 
  | { status: "confirmed" }
  | { status: "timeout" }
  | { status: "failed"; error: string };

/**
 * Runs a promise with a strict timeout, returning an explicit classification
 * of 'confirmed', 'timeout', or 'failed'.
 */
export async function runWithExplicitResult(
  promise: Promise<any>,
  timeoutMs: number = 3500
): Promise<FirestoreResult> {
  let timeoutId: any;
  const timeoutPromise = new Promise<{ status: "timeout" }>((resolve) => {
    timeoutId = setTimeout(() => resolve({ status: "timeout" as const }), timeoutMs);
  });

  try {
    const result = await Promise.race([
      promise.then(() => ({ status: "confirmed" as const })),
      timeoutPromise
    ]);
    clearTimeout(timeoutId);
    return result;
  } catch (err: any) {
    clearTimeout(timeoutId);
    return { status: "failed" as const, error: err.message || String(err) };
  }
}
