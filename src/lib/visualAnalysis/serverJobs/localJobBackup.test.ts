import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeForLocalJobBackup } from './localJobBackup';

describe('local job backup sanitizer', () => {
  it('deep-copies and removes credential-like keys and string secrets', () => {
    const input: any = {
      ok: 'https://example.test/path?x=1&api_key=secret&y=2',
      nested: {
        authorization: 'Bearer abc.def',
        providerMessage: 'request used Bearer token-value and url ?access_token=secret',
        rawMessageSummary: 'raw provider json',
        child: [{ cookie: 'a=b' }, { value: 'safe' }]
      }
    };
    const output = sanitizeForLocalJobBackup(input);
    assert.notStrictEqual(output, input);
    assert.strictEqual(input.nested.authorization, 'Bearer abc.def');
    assert.strictEqual(output.nested.authorization, undefined);
    assert.strictEqual(output.nested.rawMessageSummary, undefined);
    assert.strictEqual(output.nested.child[0].cookie, undefined);
    assert.match(output.ok, /api_key=\[REDACTED\]/);
    assert.match(output.nested.providerMessage, /\[REDACTED_BEARER\]/);
    assert.match(output.nested.providerMessage, /access_token=\[REDACTED\]/);
  });
});
