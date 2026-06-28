import { test } from 'node:test';
import assert from 'node:assert';
import { stringifyJsonArtifact, fnv1a32 } from './artifactUtils';

test('artifactUtils tests', async (t) => {
  await t.test('should correctly stringify and hash a simple object', () => {
    const obj = { hello: "world" };
    const res = stringifyJsonArtifact(obj);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.charLength > 0, true);
    assert.strictEqual(res.byteLength > 0, true);
    assert.ok(res.hash);
    assert.ok(res.text.includes("hello"));
  });

  await t.test('should fail gracefully on circular references', () => {
    const circular: any = {};
    circular.self = circular;
    const res = stringifyJsonArtifact(circular);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error);
    assert.strictEqual(res.text, "");
  });

  await t.test('fnv1a32 matches expectations', () => {
    const h1 = fnv1a32("test");
    const h2 = fnv1a32("test");
    const h3 = fnv1a32("different");
    assert.strictEqual(h1, h2);
    assert.notStrictEqual(h1, h3);
    assert.strictEqual(h1.length, 8);
  });
});
