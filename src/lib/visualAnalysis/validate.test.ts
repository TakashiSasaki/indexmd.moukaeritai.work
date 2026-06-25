import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateVisualAnalysis } from './validate';

describe('validateVisualAnalysis', () => {
  it('should fail on missing schemaVersion', () => {
    const res = validateVisualAnalysis({});
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.includes("Invalid or missing schemaVersion"));
  });

  it('should validate a correct result', () => {
    const result = {
      schemaVersion: "visual-analysis.v0.1.0-draft.1",
      summary: { caption: "Test", description: "Desc" },
      visualInfo: {
        imageKind: "landscapePhoto",
        imageKindConfidence: 0.9,
        sceneDescription: "Test scene",
        visibleElements: [
          { label: "Sky", category: "weatherOrSky", confidence: 0.9 }
        ],
        visibleText: [],
        uncertainties: []
      },
      indexing: {
        keywords: []
      },
      quality: {
        confidence: 0.8,
        issues: []
      }
    };
    const res = validateVisualAnalysis(result);
    assert.strictEqual(res.isValid, true);
  });

  it('should fail on invalid confidence values', () => {
    const result: any = {
      schemaVersion: "visual-analysis.v0.1.0-draft.1",
      summary: { caption: "Test", description: "Desc" },
      visualInfo: {
        imageKind: "landscapePhoto",
        imageKindConfidence: 1.5, // Invalid
        sceneDescription: "Test scene",
        visibleElements: [
          { label: "Sky", category: "weatherOrSky", confidence: -0.1 } // Invalid
        ],
        visibleText: [],
        uncertainties: []
      },
      indexing: { keywords: [] },
      quality: { confidence: 0.8, issues: [] }
    };
    const res = validateVisualAnalysis(result);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes("confidence")));
  });

  it('should fail on missing required summary fields', () => {
    const result: any = {
      schemaVersion: "visual-analysis.v0.1.0-draft.1",
      summary: { caption: " " }, // Empty caption
      visualInfo: {
        imageKind: "landscapePhoto",
        imageKindConfidence: 0.9,
        sceneDescription: "Test",
        visibleElements: [],
        visibleText: [],
        uncertainties: []
      },
      indexing: { keywords: [] },
      quality: { confidence: 0.8, issues: [] }
    };
    const res = validateVisualAnalysis(result);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes("summary.caption")));
  });
});
