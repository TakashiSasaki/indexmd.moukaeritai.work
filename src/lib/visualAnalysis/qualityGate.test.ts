import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateVisualAnalysisQuality } from './qualityGate';

describe('evaluateVisualAnalysisQuality', () => {
  it('should mark experimental models', () => {
    const result: any = {
      summary: { caption: "Test" },
      visualInfo: { imageKind: "landscapePhoto", visibleElements: [{category: "terrain"}], visibleText: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result, { providerFamily: "gemma" });
    assert.strictEqual(rep.experimentalModel, true);
  });

  it('should warn on unknown kind', () => {
    const result: any = {
      summary: { caption: "Test" },
      visualInfo: { imageKind: "unknown", visibleElements: [{category: "person"}], visibleText: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(rep.issues.some(i => i.code === "UNKNOWN_KIND"));
  });

  it('should warn on no landscape elements in landscape photo', () => {
    const result: any = {
      summary: { caption: "Test" },
      visualInfo: { imageKind: "landscapePhoto", visibleElements: [{category: "person"}], visibleText: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(rep.issues.some(i => i.code === "NO_LANDSCAPE_ELEMENTS"));
  });

  it('should mark invalid on missing description', () => {
    const result: any = {
      summary: { caption: "Test", description: "" },
      visualInfo: { imageKind: "landscapePhoto", visibleElements: [{category: "terrain"}], visibleText: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.strictEqual(rep.status, "invalid");
    assert.ok(rep.issues.some(i => i.code === "NO_DESCRIPTION"));
  });

  it('should penalize short caption', () => {
    const result: any = {
      summary: { caption: "Short", description: "A proper long description for the test." },
      visualInfo: { imageKind: "landscapePhoto", visibleElements: [{category: "terrain"}], visibleText: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(rep.issues.some(i => i.code === "SHORT_CAPTION"));
    assert.ok(rep.score < 100);
  });

  it('should warn on no product elements in product photo', () => {
    const result: any = {
      summary: { caption: "Product", description: "Desc" },
      visualInfo: { imageKind: "productPhoto", visibleElements: [{category: "person"}], visibleText: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(rep.issues.some(i => i.code === "NO_PRODUCT_ELEMENTS"));
  });

  it('should warn on missing keywords', () => {
    const result: any = {
      summary: { caption: "Test", description: "Desc" },
      visualInfo: { imageKind: "landscapePhoto", visibleElements: [{category: "terrain"}], visibleText: [] },
      indexing: { keywords: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(rep.issues.some(i => i.code === "MISSING_KEYWORDS"));
  });
});
