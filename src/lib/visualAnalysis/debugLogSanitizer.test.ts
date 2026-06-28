import { test, describe } from 'node:test';
import assert from 'node:assert';
import { sanitizeDebugResponseForLocalStorage } from './debugLogSanitizer';

describe('sanitizeDebugResponseForLocalStorage', () => {
  test('should redact rawOutputPreview in drive mode if option is false', () => {
    const input = {
      parseDiagnostics: { rawOutputPreview: "secret data" },
      analysisRun: { execution: { jsonRecovery: { rawOutputPreview: "secret data" } } }
    };
    const result = sanitizeDebugResponseForLocalStorage('drive', input, { storeRawOutputPreviewInDrive: false });
    assert.strictEqual(result.parseDiagnostics.rawOutputPreview, "[redacted for Drive debug log]");
    assert.strictEqual(result.analysisRun.execution.jsonRecovery.rawOutputPreview, "[redacted for Drive debug log]");
  });

  test('should NOT redact rawOutputPreview in drive mode if option is true', () => {
    const input = { parseDiagnostics: { rawOutputPreview: "secret data" } };
    const result = sanitizeDebugResponseForLocalStorage('drive', input, { storeRawOutputPreviewInDrive: true });
    assert.strictEqual(result.parseDiagnostics.rawOutputPreview, "secret data");
  });

  test('should NOT redact in public mode regardless of option', () => {
    const input = { parseDiagnostics: { rawOutputPreview: "public data" } };
    const result = sanitizeDebugResponseForLocalStorage('public', input, { storeRawOutputPreviewInDrive: false });
    assert.strictEqual(result.parseDiagnostics.rawOutputPreview, "public data");
  });
});
