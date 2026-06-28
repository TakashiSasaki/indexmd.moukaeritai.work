import { test, describe } from 'node:test';
import assert from 'node:assert';
import { evaluateSampleComparison } from './compare';

describe('evaluateSampleComparison', () => {
  test('should pass for exact match', () => {
    const sample = {
      id: "test-1",
      expectedImageKind: "productPhoto",
      expectedVisibleText: ["BrandX"],
      expectedElementCategories: ["logo"]
    } as any;
    
    const result = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "productPhoto",
          visibleElements: [{ category: "logo", label: "Logo" }],
          visibleText: [{ text: "BrandX", confidence: 1 }]
        }
      }
    };
    
    const summary = evaluateSampleComparison(sample, result);
    assert.strictEqual(summary.overallStatus, 'pass');
    assert.strictEqual(summary.imageKind.status, 'exact');
    assert.deepEqual(summary.categories.matched, ['logo']);
    assert.deepEqual(summary.visibleText.matched, ['BrandX']);
  });

  test('should fail if expected text is missing', () => {
    const sample = {
      expectedImageKind: "productPhoto",
      expectedVisibleText: ["MissingText"]
    } as any;
    
    const result = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "productPhoto",
          visibleText: [{ text: "OtherText" }]
        }
      }
    };
    
    const summary = evaluateSampleComparison(sample, result);
    assert.strictEqual(summary.overallStatus, 'fail');
    assert.deepEqual(summary.visibleText.missing, ['MissingText']);
  });

  test('should warn if category missing', () => {
    const sample = {
      expectedImageKind: "productPhoto",
      expectedElementCategories: ["logo"]
    } as any;
    
    const result = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "productPhoto",
          visibleElements: []
        }
      }
    };
    
    const summary = evaluateSampleComparison(sample, result);
    assert.strictEqual(summary.overallStatus, 'warning');
    assert.deepEqual(summary.categories.missing, ['logo']);
  });

  test('should determine correct reviewStatus', () => {
    // imageKind exact + no missing => pass
    const samplePass = {
      expectedImageKind: "productPhoto",
      expectedVisibleText: ["BrandX"],
      expectedVisibleElementLabels: ["logo"]
    } as any;
    const resultPass = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "productPhoto",
          visibleElements: [{ label: "logo" }],
          visibleText: ["BrandX"]
        }
      }
    };
    const summaryPass = evaluateSampleComparison(samplePass, resultPass);
    assert.strictEqual(summaryPass.reviewStatus, 'pass');

    // label missing => needsReview
    const sampleLabelMissing = {
      expectedImageKind: "productPhoto",
      expectedVisibleElementLabels: ["logo"]
    } as any;
    const resultLabelMissing = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "productPhoto",
          visibleElements: []
        }
      }
    };
    const summaryLabelMissing = evaluateSampleComparison(sampleLabelMissing, resultLabelMissing);
    assert.strictEqual(summaryLabelMissing.reviewStatus, 'needsReview');

    // visibleText missing => fail
    const sampleTextMissing = {
      expectedImageKind: "productPhoto",
      expectedVisibleText: ["BrandX"]
    } as any;
    const resultTextMissing = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "productPhoto",
          visibleText: []
        }
      }
    };
    const summaryTextMissing = evaluateSampleComparison(sampleTextMissing, resultTextMissing);
    assert.strictEqual(summaryTextMissing.reviewStatus, 'fail');
  });

  test('should support flexible matching rules and populate matches', () => {
    const sample = {
      expectedImageKind: "naturalPhoto",
      expectedVisibleElementLabels: ["cat", "sunflower", "leaves", "valley"]
    } as any;

    const result = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "naturalPhoto",
          visibleElements: [
            { label: "tabby cat" },
            { label: "sunflower head" },
            { label: "sunflower leaves" }
          ]
        },
        indexing: {
          keywords: ["valley"]
        }
      }
    };

    const summary = evaluateSampleComparison(sample, result);
    assert.strictEqual(summary.labels.missing.length, 0); // All matched!
    assert.strictEqual(summary.labels.acceptable.length, 4);

    const matches = summary.labels.matches;
    assert.ok(matches);
    assert.strictEqual(matches.length, 4);

    const catMatch = matches.find(m => m.expected === "cat");
    assert.ok(catMatch);
    assert.strictEqual(catMatch.method, "substring");
    assert.strictEqual(catMatch.detected, "tabby cat");

    const sunMatch = matches.find(m => m.expected === "sunflower");
    assert.ok(sunMatch);
    assert.strictEqual(catMatch.method, "substring");

    const leavesMatch = matches.find(m => m.expected === "leaves");
    assert.ok(leavesMatch);
    assert.strictEqual(leavesMatch.method, "tokenOverlap");

    const valleyMatch = matches.find(m => m.expected === "valley");
    assert.ok(valleyMatch);
    assert.strictEqual(valleyMatch.method, "keyword");
  });

  test('should support landscapeElement category soft equivalence and category deduplication', () => {
    const sample = {
      expectedImageKind: "naturalPhoto",
      expectedElementCategories: ["landscapeElement", "logo"]
    } as any;

    const result = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "naturalPhoto",
          visibleElements: [
            { category: "terrain" },
            { category: "weatherOrSky" },
            { category: "weatherOrSky" } // Duplicate
          ]
        }
      }
    };

    const summary = evaluateSampleComparison(sample, result);
    // landscapeElement matches terrain
    assert.deepEqual(summary.categories.matched, []);
    assert.deepEqual(summary.categories.acceptable, ["terrain"]);
    assert.deepEqual(summary.categories.missing, ["logo"]);
    // weatherOrSky is extra, but only listed once due to deduplication
    assert.deepEqual(summary.categories.extra, ["weatherOrSky"]);
  });
});
