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

  it('should not warn on NO_PRODUCT_ELEMENTS if tool element is in product photo', () => {
    const result: any = {
      summary: { caption: "Pencil", description: "Desc" },
      visualInfo: { imageKind: "productPhoto", visibleElements: [{category: "tool"}], visibleText: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(!rep.issues.some(i => i.code === "NO_PRODUCT_ELEMENTS"));
  });

  it('should not warn on NO_PRODUCT_ELEMENTS if furniture element is in product photo', () => {
    const result: any = {
      summary: { caption: "Chair", description: "Desc" },
      visualInfo: { imageKind: "productPhoto", visibleElements: [{category: "furniture"}], visibleText: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(!rep.issues.some(i => i.code === "NO_PRODUCT_ELEMENTS"));
  });

  it('should not warn on NO_PRODUCT_ELEMENTS if productPackage element is in packageImage', () => {
    const result: any = {
      summary: { caption: "Box", description: "Desc" },
      visualInfo: { imageKind: "packageImage", visibleElements: [{category: "productPackage"}], visibleText: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(!rep.issues.some(i => i.code === "NO_PRODUCT_ELEMENTS"));
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

  it('should info on possible visible text missing', () => {
    const result: any = {
      summary: { caption: "USB-C", description: "Desc" },
      visualInfo: { imageKind: "productPhoto", visibleElements: [{category: "product"}], visibleText: [] },
      indexing: { keywords: [{value: "USB-C"}] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(rep.issues.some(i => i.code === "POSSIBLE_VISIBLE_TEXT_MISSING"));
  });

  it('should not warn on possible visible text missing if visible text is present', () => {
    const result: any = {
      summary: { caption: "USB-C", description: "Desc" },
      visualInfo: { imageKind: "productPhoto", visibleElements: [{category: "product"}], visibleText: [{text: "USB-C"}] },
      indexing: { keywords: [{value: "USB-C"}] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(!rep.issues.some(i => i.code === "POSSIBLE_VISIBLE_TEXT_MISSING"));
  });

  it('should info on possible attributes missing for products', () => {
    const result: any = {
      summary: { caption: "Test", description: "A blue wooden pencil" },
      visualInfo: { 
        imageKind: "productPhoto", 
        visibleElements: [{category: "product", attributes: []}], 
        visibleText: [] 
      },
      indexing: { keywords: [{value: "pencil"}] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(rep.issues.some(i => i.code === "POSSIBLE_ATTRIBUTES_MISSING"));
  });

  it('should not info on missing attributes for non-products', () => {
    const result: any = {
      summary: { caption: "Test", description: "A blue wooden sign" },
      visualInfo: { 
        imageKind: "landscapePhoto", 
        visibleElements: [{category: "signage", attributes: []}, {category: "terrain"}], 
        visibleText: [] 
      },
      indexing: { keywords: [{value: "sign"}] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(!rep.issues.some(i => i.code === "POSSIBLE_ATTRIBUTES_MISSING"));
  });
});
