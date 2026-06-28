import { test } from 'node:test';
import assert from 'node:assert';
import { canonicalizeVisualAnalysisProviderOutput } from './canonicalize';
import { VISUAL_ANALYSIS_SCHEMA_VERSION } from './schema';

test('canonicalize sets schemaVersion to canonical version and creates diagnostics', () => {
  const providerOutput = {
    schemaVersion: "1.0",
    visualInfo: { imageKind: "naturalPhoto" }
  };
  
  const result = canonicalizeVisualAnalysisProviderOutput(providerOutput);
  
  assert.strictEqual(result.result.schemaVersion, VISUAL_ANALYSIS_SCHEMA_VERSION);
  assert.strictEqual(result.diagnostics.canonicalSchemaVersionApplied, true);
  assert.strictEqual(result.diagnostics.originalSchemaVersion, "1.0");
  assert.strictEqual(result.diagnostics.correctedSchemaVersion, VISUAL_ANALYSIS_SCHEMA_VERSION);
});

test('canonicalize does not warn when schemaVersion is already canonical', () => {
  const providerOutput = {
    schemaVersion: VISUAL_ANALYSIS_SCHEMA_VERSION,
    visualInfo: { imageKind: "naturalPhoto" }
  };
  
  const result = canonicalizeVisualAnalysisProviderOutput(providerOutput);
  
  assert.strictEqual(result.result.schemaVersion, VISUAL_ANALYSIS_SCHEMA_VERSION);
  assert.strictEqual(result.diagnostics.canonicalSchemaVersionApplied, false);
});
