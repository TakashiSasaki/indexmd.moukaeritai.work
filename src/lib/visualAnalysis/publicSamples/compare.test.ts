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
    assert.strictEqual(sunMatch.method, "substring");

    const leavesMatch = matches.find(m => m.expected === "leaves");
    assert.ok(leavesMatch);
    assert.strictEqual(leavesMatch.method, "substring");

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
    assert.deepEqual(summary.categories.acceptable, ["landscapeElement"]);
    assert.deepEqual(summary.categories.missing, ["logo"]);
    // weatherOrSky is extra, but only listed once due to deduplication
    assert.deepEqual(summary.categories.extra, ["weatherOrSky"]);
  });

  test('should compute correct coverage metrics and calibrated reviewStatus', () => {
    // 1. imageKind exact, category coverage 1.0, label coverage 0.8, visibleText expected 0 => reviewStatus pass
    const samplePass = {
      expectedImageKind: "naturalPhoto",
      expectedElementCategories: ["logo"],
      expectedVisibleElementLabels: ["sunflower", "leaves", "valley", "lake", "cloud"], // 5 labels
      expectedVisibleText: []
    } as any;

    const resultPass = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "naturalPhoto",
          visibleElements: [
            { category: "logo", label: "sunflower" },
            { category: "logo", label: "leaves" },
            { category: "logo", label: "valley" },
            { category: "logo", label: "lake" } // 4 matched, 1 missing => 80% coverage
          ],
          visibleText: []
        }
      }
    };

    const summaryPass = evaluateSampleComparison(samplePass, resultPass);
    assert.strictEqual(summaryPass.reviewStatus, 'pass');
    assert.ok(summaryPass.coverage);
    assert.strictEqual(summaryPass.coverage.categories.ratio, 1.0);
    assert.strictEqual(summaryPass.coverage.labels.ratio, 0.8);
    assert.deepEqual(summaryPass.reviewReasons, []);
    assert.ok(summaryPass.reviewNotes.some(n => n.includes("missing expected label: cloud")));

    // 2. visibleText missing => reviewStatus fail
    const sampleFailText = {
      expectedImageKind: "naturalPhoto",
      expectedVisibleText: ["Important Text"]
    } as any;

    const resultFailText = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "naturalPhoto",
          visibleText: []
        }
      }
    };

    const summaryFailText = evaluateSampleComparison(sampleFailText, resultFailText);
    assert.strictEqual(summaryFailText.reviewStatus, 'fail');
    assert.ok(summaryFailText.reviewReasons.some(r => r.includes("missing expected visible text")));

    // 3. imageKind diverged => reviewStatus needsReview
    const sampleDiverged = {
      expectedImageKind: "naturalPhoto"
    } as any;

    const resultDiverged = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "productPhoto"
        }
      }
    };

    const summaryDiverged = evaluateSampleComparison(sampleDiverged, resultDiverged);
    assert.strictEqual(summaryDiverged.reviewStatus, 'needsReview');
    assert.ok(summaryDiverged.reviewReasons.some(r => r.includes("imageKind diverged")));

    // 4. label coverage too low => reviewStatus needsReview
    const sampleLowLabel = {
      expectedImageKind: "naturalPhoto",
      expectedVisibleElementLabels: ["sunflower", "leaves", "valley", "lake", "cloud"] // 5 labels
    } as any;

    const resultLowLabel = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "naturalPhoto",
          visibleElements: [
            { label: "sunflower" },
            { label: "leaves" } // 2 matched, 3 missing => 40% label coverage
          ]
        }
      }
    };

    const summaryLowLabel = evaluateSampleComparison(sampleLowLabel, resultLowLabel);
    assert.strictEqual(summaryLowLabel.reviewStatus, 'needsReview');
    assert.ok(summaryLowLabel.reviewReasons.some(r => r.includes("label coverage low")));
  });
});
