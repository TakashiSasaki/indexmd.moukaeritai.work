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

  it('should remove false primary flag', () => {
    const raw = {
      visualInfo: {
        visibleElements: [
          { label: "Box", category: "container", confidence: 0.9, primary: false }
        ]
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual('primary' in norm.visualInfo.visibleElements[0], false);
  });

  it('should remove weak scene context for isolated images', () => {
    const raw = {
      visualInfo: {
        imageKind: "productPhoto",
        sceneContext: {
          environment: "indoor",
          lighting: "unknown"
        }
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.visualInfo.sceneContext, undefined);
  });

  it('should preserve strong scene context for isolated images', () => {
    const raw = {
      visualInfo: {
        imageKind: "productPhoto",
        sceneContext: {
          environment: "indoor",
          placeType: "store shelf"
        }
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.visualInfo.sceneContext.placeType, "store shelf");
  });

  it('should preserve weak scene context for landscape images', () => {
    const raw = {
      visualInfo: {
        imageKind: "landscapePhoto",
        sceneContext: {
          environment: "outdoor"
        }
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.strictEqual(norm.visualInfo.sceneContext.environment, "outdoor");
  });

  it('should rescue string entry in visibleText', () => {
    const raw = {
      visualInfo: {
        visibleText: ["HB", " A4 ", "", null]
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.deepEqual(norm.visualInfo.visibleText, [
      { text: "HB", confidence: 1 },
      { text: "A4", confidence: 1 }
    ]);
  });

  it('should fill default confidence for object entry in visibleText', () => {
    const raw = {
      visualInfo: {
        visibleText: [{ text: "XL" }]
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    assert.deepEqual(norm.visualInfo.visibleText, [
      { text: "XL", confidence: 1, locationHint: undefined, language: undefined }
    ]);
  });

  it('should rescue non-enum free text into stateContext description', () => {
    const raw = {
      visualInfo: {
        visibleElements: [
          {
            label: "Pencil",
            category: "tool",
            stateContext: {
              placement: "lying horizontally on a flat surface", // non-enum
              containment: "boxed", // valid enum
              usage: "unknown" // ignored
            }
          }
        ]
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    const st = norm.visualInfo.visibleElements[0].stateContext;
    assert.strictEqual(st?.containment, "boxed");
    assert.strictEqual(st?.placement, undefined);
    assert.strictEqual(st?.description, "placement: lying horizontally on a flat surface");
  });

  it('should append non-enum free text to existing stateContext description', () => {
    const raw = {
      visualInfo: {
        visibleElements: [
          {
            label: "Pencil",
            category: "tool",
            stateContext: {
              placement: "lying horizontally", 
              description: "It is red"
            }
          }
        ]
      }
    };
    const norm = normalizeVisualAnalysis(raw);
    const st = norm.visualInfo.visibleElements[0].stateContext;
    assert.strictEqual(st?.description, "It is red; placement: lying horizontally");
  });
});
