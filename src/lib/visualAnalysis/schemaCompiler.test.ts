import { test } from 'node:test';
import assert from 'node:assert';
import { compileProviderSchema, assertNoForbiddenKeys } from './schemaCompiler';

test('Schema Compiler', async (t) => {
  await t.test('compiles canonical schema', () => {
    const input = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Test",
      type: "object",
      properties: {
        foo: {
          type: "string",
          const: "bar",
          "x-custom": true
        }
      },
      additionalProperties: false
    };

    const result = compileProviderSchema(input);
    assert.strictEqual(result.compilerName, "RecursiveAllowlistCompiler");
    console.log(JSON.stringify(result.schema, null, 2));

    
    // Check forbidden keys
    assert.strictEqual(result.schema.$schema, undefined);
    assert.strictEqual(result.schema.title, undefined);
    assert.strictEqual(result.schema.additionalProperties, undefined);
    
    // Check allowed keys
    assert.strictEqual(result.schema.type, "object");
    assert.strictEqual(result.schema.properties.foo.type, "string");
    
    // Check const conversion
    assert.deepStrictEqual(result.schema.properties.foo.enum, ["bar"]);
    assert.strictEqual(result.schema.properties.foo.const, undefined);
    
    // Check x- keys
    assert.strictEqual(result.schema.properties.foo["x-custom"], undefined);
    
    // Assertion utility
    assertNoForbiddenKeys(result.schema, true);
  });

  await t.test('assertNoForbiddenKeys throws on bad keys', () => {
    assert.throws(() => {
      assertNoForbiddenKeys({ type: "object", badKey: true }, true);
    });
  });
});
