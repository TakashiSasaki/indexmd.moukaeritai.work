import { test } from 'node:test';
import assert from 'node:assert';
import { buildGeminiVisualAnalysisResponseSchema } from './providerSchema';
import { VISUAL_ANALYSIS_SCHEMA } from './schema';

test('buildGeminiVisualAnalysisResponseSchema removes schemaVersion and const', () => {
  const providerSchema = buildGeminiVisualAnalysisResponseSchema();
  
  // Should not have schemaVersion
  assert.strictEqual(providerSchema.properties?.schemaVersion, undefined);
  assert.ok(!providerSchema.required?.includes('schemaVersion'));
  
  // Top level fields removed
  assert.strictEqual(providerSchema.$schema, undefined);
  assert.strictEqual(providerSchema.title, undefined);
  
  // Original schema is not mutated
  assert.ok(VISUAL_ANALYSIS_SCHEMA.properties?.schemaVersion !== undefined);
  assert.ok(VISUAL_ANALYSIS_SCHEMA.required?.includes('schemaVersion'));
  assert.ok(VISUAL_ANALYSIS_SCHEMA.$schema !== undefined);
});
