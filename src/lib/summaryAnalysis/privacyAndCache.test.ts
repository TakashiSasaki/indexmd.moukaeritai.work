import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { 
  sanitizeResultForResponse, 
  sanitizeResultForCache, 
  sanitizeResultForHistory,
  isDriveContentCacheEnabled
} from '../privacyAndCache';

describe('Privacy and Cache Sanitization', () => {
  const mockRawResult = {
    success: true,
    outputMode: "structured",
    summary: {
      oneLine: "サマリーです",
      detailed: "詳細サマリー"
    },
    rawText: "This is the extremely sensitive full file content including passwords or PII.",
    rawPrompt: "System: You are an expert analyzer. Task: Analyze this document...",
    taskPrompt: "Analyze this document...",
    systemInstruction: "System instruction instruction...",
    customInstruction: "My secret user instruction",
    rawOutput: "{\n  \"summary\": ...\n}",
    requestPreview: {
      model: "gemini-3.5-flash",
      taskPrompt: "Analyze this document..."
    },
    contentSampleSnippet: "Snippet preview of content..."
  };

  it('sanitizeResultForCache removes unsafe fields (rawText, requestPreview, systemInstruction, taskPrompt, contentSampleSnippet)', () => {
    const sanitized = sanitizeResultForCache(mockRawResult);
    
    // Kept fields
    assert.strictEqual(sanitized.success, true);
    assert.deepEqual(sanitized.summary, mockRawResult.summary);
    
    // Removed fields
    assert.strictEqual(sanitized.rawText, undefined);
    assert.strictEqual(sanitized.rawPrompt, undefined);
    assert.strictEqual(sanitized.taskPrompt, undefined);
    assert.strictEqual(sanitized.systemInstruction, undefined);
    assert.strictEqual(sanitized.customInstruction, undefined);
    assert.strictEqual(sanitized.rawOutput, undefined);
    assert.strictEqual(sanitized.requestPreview, undefined);
    assert.strictEqual(sanitized.contentSampleSnippet, undefined);
  });

  it('sanitizeResultForHistory removes unsafe fields', () => {
    const sanitized = sanitizeResultForHistory(mockRawResult);
    
    // Kept fields
    assert.strictEqual(sanitized.success, true);
    assert.deepEqual(sanitized.summary, mockRawResult.summary);
    
    // Removed fields
    assert.strictEqual(sanitized.rawText, undefined);
    assert.strictEqual(sanitized.rawPrompt, undefined);
    assert.strictEqual(sanitized.taskPrompt, undefined);
    assert.strictEqual(sanitized.systemInstruction, undefined);
    assert.strictEqual(sanitized.customInstruction, undefined);
    assert.strictEqual(sanitized.rawOutput, undefined);
    assert.strictEqual(sanitized.requestPreview, undefined);
    assert.strictEqual(sanitized.contentSampleSnippet, undefined);
  });

  it('sanitizeResultForResponse removes rawText but can include requestPreview', () => {
    const sanitized = sanitizeResultForResponse(mockRawResult);
    
    // Kept fields
    assert.strictEqual(sanitized.success, true);
    assert.deepEqual(sanitized.summary, mockRawResult.summary);
    assert.deepEqual(sanitized.requestPreview, mockRawResult.requestPreview);
    
    // Removed fields
    assert.strictEqual(sanitized.rawText, undefined);
  });

  describe('isDriveContentCacheEnabled snippet cache checks', () => {
    const originalEnv = process.env.ENABLE_DRIVE_CONTENT_CACHE;

    afterEach(() => {
      process.env.ENABLE_DRIVE_CONTENT_CACHE = originalEnv;
    });

    it('returns false when ENABLE_DRIVE_CONTENT_CACHE is unset or not true', () => {
      delete process.env.ENABLE_DRIVE_CONTENT_CACHE;
      assert.strictEqual(isDriveContentCacheEnabled(), false);

      process.env.ENABLE_DRIVE_CONTENT_CACHE = "false";
      assert.strictEqual(isDriveContentCacheEnabled(), false);
    });

    it('returns true when ENABLE_DRIVE_CONTENT_CACHE is true', () => {
      process.env.ENABLE_DRIVE_CONTENT_CACHE = "true";
      assert.strictEqual(isDriveContentCacheEnabled(), true);
    });
  });
});
