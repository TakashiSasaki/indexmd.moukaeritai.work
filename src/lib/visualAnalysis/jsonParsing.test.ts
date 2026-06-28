import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseModelJsonOutput } from './jsonParsing';

describe('parseModelJsonOutput', () => {
  it('should parse valid JSON directly', () => {
    const json = '{"key":"value"}';
    const result = parseModelJsonOutput(json);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.parseMode, 'direct');
      assert.deepEqual(result.parsed, { key: 'value' });
      assert.strictEqual(result.diagnostics.attempts.length, 1);
    }
  });

  it('should parse fenced JSON', () => {
    const json = '```json\n{"key":"value"}\n```';
    const result = parseModelJsonOutput(json);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.parseMode, 'fenceStripped');
      assert.deepEqual(result.parsed, { key: 'value' });
      assert.strictEqual(result.diagnostics.attempts.length, 2);
    }
  });

  it('should parse extracted object JSON', () => {
    const json = 'Here is the JSON: {"key": "value", "nested": {"a": 1}} Hope this helps.';
    const result = parseModelJsonOutput(json);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.parseMode, 'extractedObject');
      assert.deepEqual(result.parsed, { key: 'value', nested: { a: 1 } });
      assert.strictEqual(result.diagnostics.attempts.length, 2);
    }
  });

  it('should fail on malformed JSON', () => {
    const json = '{"key": "value"'; // missing closing brace
    const result = parseModelJsonOutput(json);
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.diagnostics.failureKind, 'jsonParseError');
      assert.ok(result.diagnostics.attempts.length > 0);
    }
  });

  it('should correctly handle braces inside strings when extracting', () => {
    const json = 'Some text {"key": "this { is } a string", "other": 1} more text';
    const result = parseModelJsonOutput(json);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.parseMode, 'extractedObject');
      assert.deepEqual(result.parsed, { key: 'this { is } a string', other: 1 });
    }
  });
});
