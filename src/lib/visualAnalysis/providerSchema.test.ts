import { test } from 'node:test';
import assert from 'node:assert';
import { buildGeminiVisualAnalysisResponseSchema, GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_NAME, GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_VERSION } from './providerSchema';
import { VISUAL_ANALYSIS_SCHEMA } from './schema';

test('buildGeminiVisualAnalysisResponseSchema removes schemaVersion, const, additionalProperties and leaves canonical schema intact', () => {
  const providerSchema = buildGeminiVisualAnalysisResponseSchema(VISUAL_ANALYSIS_SCHEMA);
  
  // Should have metadata exported
  assert.ok(GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_NAME);
  assert.ok(GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_VERSION);

  // Should not have schemaVersion
  assert.strictEqual(providerSchema.properties?.schemaVersion, undefined);
  assert.ok(!providerSchema.required?.includes('schemaVersion'));
  
  // Top level fields removed
  assert.strictEqual(providerSchema.$schema, undefined);
  assert.strictEqual(providerSchema.title, undefined);
  assert.strictEqual(providerSchema.$id, undefined);
  
  // Original schema is not mutated
  assert.ok(VISUAL_ANALYSIS_SCHEMA.properties?.schemaVersion !== undefined);
  assert.ok(VISUAL_ANALYSIS_SCHEMA.required?.includes('schemaVersion'));
  assert.ok(VISUAL_ANALYSIS_SCHEMA.$schema !== undefined);

  // Original schema and provider schema are different objects
  assert.notStrictEqual(providerSchema, VISUAL_ANALYSIS_SCHEMA);
});
