import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeVisualAnalysis } from './normalize';

describe('normalizeVisualAnalysis', () => {
  it('should preserve valid fields and populate defaults for missing ones', () => {
    const raw = {
      visualInfo: {
        imageKind: "productPhoto",
        visibleElements: [
          { label: "Phone", category: "product", confidence: 0.9 }
        ]
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.visualInfo.imageKind, "productPhoto");
    assert.strictEqual(norm.visualInfo.visibleElements[0].category, "product");
    assert.deepEqual(norm.visualInfo.visibleText, []);
    assert.deepEqual(norm.visualInfo.uncertainties, []);
  });

  it('should fallback unknown image kind to "unknown"', () => {
    const raw = {
      visualInfo: {
        imageKind: "unsupportedKind"
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.visualInfo.imageKind, "unknown");
  });

  it('should auto-populate missing schemaVersion with the draft version', () => {
    const raw = {};
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.schemaVersion, "visual-analysis.v0.2.0-draft.1");
  });

  it('should fallback unknown category to "unknown"', () => {
    const raw = {
      visualInfo: {
        visibleElements: [
          { label: "Weird Object", category: "weirdCategory", confidence: 0.5 }
        ]
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.visualInfo.visibleElements[0].category, "unknown");
  });

  it('should remove unknown-only sceneContext', () => {
    const raw = {
      visualInfo: {
        sceneContext: {
          environment: "unknown",
          lighting: "unknown",
          confidence: 0.9
        }
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.visualInfo.sceneContext, undefined);
  });

  it('should keep sceneContext if it has description', () => {
    const raw = {
      visualInfo: {
        sceneContext: {
          environment: "unknown",
          description: "Dark alleyway"
        }
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.visualInfo.sceneContext?.description, "Dark alleyway");
  });

  it('should remove unknown-only stateContext and preserve missing primary flag', () => {
    const raw = {
      visualInfo: {
        visibleElements: [
          { 
            label: "Box", 
            category: "container",
            confidence: 0.9,
            stateContext: {
              containment: "unknown",
              placement: "unknown"
            }
          }
        ]
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.visualInfo.visibleElements[0].stateContext, undefined);
    assert.strictEqual('primary' in norm.visualInfo.visibleElements[0], false);
  });

  it('should preserve true primary flag', () => {
    const raw = {
      visualInfo: {
        visibleElements: [
          { label: "Box", category: "container", confidence: 0.9, primary: true }
        ]
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.visualInfo.visibleElements[0].primary, true);
  });
});
