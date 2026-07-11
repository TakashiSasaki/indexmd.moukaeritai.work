import { test } from 'node:test';
import assert from 'node:assert';
import { compileProviderSchema, assertNoForbiddenKeys } from './schemaCompiler';
import { VISUAL_ANALYSIS_SCHEMA } from './schema';

test('Schema Compiler', async (t) => {
  await t.test('compiles toy schema successfully', () => {
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
    assert.strictEqual(result.compilerVersion, "1.2.0");

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

  await t.test('tests actual VISUAL_ANALYSIS_SCHEMA compilation', () => {
    // 1. The current canonical schema compiles
    const sourceSchemaCopy = JSON.parse(JSON.stringify(VISUAL_ANALYSIS_SCHEMA));
    const result = compileProviderSchema(VISUAL_ANALYSIS_SCHEMA);

    assert.ok(result.schema);
    assert.strictEqual(result.compilerName, "RecursiveAllowlistCompiler");
    assert.strictEqual(result.compilerVersion, "1.2.0");

    // 2. Source schema is unchanged (no mutation)
    assert.deepStrictEqual(VISUAL_ANALYSIS_SCHEMA, sourceSchemaCopy);

    // 3. Output is deterministic
    const secondResult = compileProviderSchema(VISUAL_ANALYSIS_SCHEMA);
    assert.deepStrictEqual(result.schema, secondResult.schema);

    // 4. No forbidden keys remain
    assert.strictEqual(result.schema.$schema, undefined);
    assert.strictEqual(result.schema.$id, undefined);
    assert.strictEqual(result.schema.title, undefined);
    assert.strictEqual(result.schema.contractStatus, undefined);

    // Recursive check for "x-" keys
    const traverseAndCheck = (node: any) => {
      if (!node || typeof node !== 'object') return;
      for (const key of Object.keys(node)) {
        assert.ok(!key.startsWith("x-"), `x- prefixed key found: ${key}`);
        traverseAndCheck(node[key]);
      }
    };
    traverseAndCheck(result.schema);

    // 5. All required properties survive
    assert.strictEqual(result.schema.type, "OBJECT");
    assert.ok(Array.isArray(result.schema.required));
    assert.ok(result.schema.required.includes("schemaVersion"));
    assert.ok(result.schema.required.includes("summary"));
    assert.ok(result.schema.required.includes("visualInfo"));

    // 6. Nested arrays and objects survive
    assert.strictEqual(result.schema.properties.visualInfo.type, "OBJECT");
    assert.strictEqual(result.schema.properties.visualInfo.properties.visibleElements.type, "ARRAY");
    assert.strictEqual(result.schema.properties.visualInfo.properties.visibleElements.items.type, "OBJECT");

    // 7. Nullable forms are correct (sceneContext is not nullable but rather optional in canonical schema)
    assert.strictEqual(result.schema.properties.visualInfo.properties.sceneContext.nullable, undefined);
  });

  await t.test('unsafe composition fails compilation locally', () => {
    // oneOf fails
    assert.throws(() => {
      compileProviderSchema({
        type: "object",
        properties: {
          foo: {
            oneOf: [{ type: "string" }, { type: "number" }]
          }
        }
      });
    }, /unsupported keyword 'oneOf'/);

    // allOf fails
    assert.throws(() => {
      compileProviderSchema({
        type: "object",
        properties: {
          foo: {
            allOf: [{ type: "string" }]
          }
        }
      });
    }, /unsupported keyword 'allOf'/);

    // $ref fails
    assert.throws(() => {
      compileProviderSchema({
        type: "object",
        properties: {
          foo: {
            $ref: "#/definitions/Foo"
          }
        }
      });
    }, /unsupported keyword '\$ref'/);

    // heterogeneous tuple items fails
    assert.throws(() => {
      compileProviderSchema({
        type: "object",
        properties: {
          foo: {
            type: "array",
            items: [{ type: "string" }, { type: "number" }]
          }
        }
      });
    }, /heterogeneous tuple 'items'/);

    // multi-branch anyOf fails
    assert.throws(() => {
      compileProviderSchema({
        type: "object",
        properties: {
          foo: {
            anyOf: [{ type: "string" }, { type: "number" }]
          }
        }
      });
    }, /multi-branch non-null 'anyOf'/);

    // unknown types fail
    assert.throws(() => {
      compileProviderSchema({
        type: "object",
        properties: {
          foo: { type: "super-string" }
        }
      });
    }, /unknown type name/);

    // empty tuple items fail
    assert.throws(() => {
      compileProviderSchema({
        type: "object",
        properties: {
          foo: { type: "array", items: [] }
        }
      });
    }, /empty tuple items/);

    // required not in properties fails
    assert.throws(() => {
      compileProviderSchema({
        type: "object",
        properties: {
          foo: { type: "string" }
        },
        required: ["bar"]
      });
    }, /required property 'bar' is not present in properties/);

    // null-only anyOf fails
    assert.throws(() => {
      compileProviderSchema({
        type: "object",
        properties: {
          foo: { anyOf: [{ type: "null" }] }
        }
      });
    }, /null-only anyOf/);

    // semantics-changing pattern constraint fails
    assert.throws(() => {
      compileProviderSchema({
        type: "object",
        properties: {
          foo: { type: "string", pattern: "^[a-z]+$" }
        }
      });
    }, /unsupported keyword 'pattern'/);
  });
});
