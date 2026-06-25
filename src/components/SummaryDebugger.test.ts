import test from 'node:test';
import assert from 'node:assert';
import { canGenerateSummary } from './SummaryDebugger';

test("canGenerateSummary evaluates correctly", () => {
  assert.strictEqual(canGenerateSummary("drive", "123", "", false), true);
  assert.strictEqual(canGenerateSummary("drive", "  ", "", false), false);
  assert.strictEqual(canGenerateSummary("drive", "123", "", true), false);

  assert.strictEqual(canGenerateSummary("manual", "", "Hello", false), true);
  assert.strictEqual(canGenerateSummary("manual", "", "  ", false), false);
  assert.strictEqual(canGenerateSummary("manual", "", "Hello", true), false);
});
