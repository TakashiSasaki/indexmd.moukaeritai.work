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

  it('should warn on document photo with no text', () => {
    const result: any = {
      summary: { caption: "Test" },
      visualInfo: { imageKind: "documentPhoto", visibleElements: [{category: "document"}], visibleText: [] },
      quality: { confidence: 0.9 }
    };
    const rep = evaluateVisualAnalysisQuality(result);
    assert.ok(rep.issues.some(i => i.code === "NO_VISIBLE_TEXT_IN_DOCUMENT"));
  });
});
