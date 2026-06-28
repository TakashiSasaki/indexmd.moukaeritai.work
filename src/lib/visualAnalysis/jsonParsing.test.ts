import { describe, it, expect } from 'vitest';
import { parseModelJsonOutput } from './jsonParsing';

describe('parseModelJsonOutput', () => {
  it('should parse valid JSON directly', () => {
    const json = '{"key":"value"}';
    const result = parseModelJsonOutput(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parseMode).toBe('direct');
      expect(result.parsed).toEqual({ key: 'value' });
      expect(result.diagnostics.attempts.length).toBe(1);
    }
  });

  it('should parse fenced JSON', () => {
    const json = '```json\n{"key":"value"}\n```';
    const result = parseModelJsonOutput(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parseMode).toBe('fenceStripped');
      expect(result.parsed).toEqual({ key: 'value' });
      expect(result.diagnostics.attempts.length).toBe(2);
    }
  });

  it('should parse extracted object JSON', () => {
    const json = 'Here is the JSON: {"key": "value", "nested": {"a": 1}} Hope this helps.';
    const result = parseModelJsonOutput(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parseMode).toBe('extractedObject');
      expect(result.parsed).toEqual({ key: 'value', nested: { a: 1 } });
      expect(result.diagnostics.attempts.length).toBe(2); // direct failed, stripped same as direct, extracted passed
    }
  });

  it('should fail on malformed JSON', () => {
    const json = '{"key": "value"'; // missing closing brace
    const result = parseModelJsonOutput(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.failureKind).toBe('jsonParseError');
      expect(result.diagnostics.attempts.length).toBeGreaterThan(0);
    }
  });

  it('should correctly handle braces inside strings when extracting', () => {
    const json = 'Some text {"key": "this { is } a string", "other": 1} more text';
    const result = parseModelJsonOutput(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parseMode).toBe('extractedObject');
      expect(result.parsed).toEqual({ key: 'this { is } a string', other: 1 });
    }
  });
});
