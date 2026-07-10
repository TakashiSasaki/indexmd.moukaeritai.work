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
    assert.strictEqual(result.schema.type, "OBJECT");
    assert.strictEqual(result.schema.properties.foo.type, "STRING");
    
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

  await t.test('compiles anyOf with null option', () => {
    const input = {
      type: "object",
      properties: {
        description: {
          anyOf: [
            { type: "string" },
            { type: "null" }
          ]
        }
      }
    };

    const result = compileProviderSchema(input);
    assert.strictEqual(result.schema.properties.description.type, "STRING");
    assert.strictEqual(result.schema.properties.description.nullable, true);
  });

  await t.test('compiles mixed-typed array definition', () => {
    const input = {
      type: "object",
      properties: {
        age: {
          type: ["integer", "null"]
        }
      }
    };

    const result = compileProviderSchema(input);
    assert.strictEqual(result.schema.properties.age.type, "INTEGER");
    assert.strictEqual(result.schema.properties.age.nullable, true);
  });

  await t.test('compiles array with items list', () => {
    const input = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: [
            { type: "string" }
          ]
        }
      }
    };

    const result = compileProviderSchema(input);
    assert.strictEqual(result.schema.properties.tags.type, "ARRAY");
    assert.strictEqual(result.schema.properties.tags.items.type, "STRING");
  });
});
