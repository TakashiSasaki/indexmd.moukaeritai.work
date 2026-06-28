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
    // 1. imageKind exact, category coverage 1.0, label coverage 1.0, visibleText expected 0 => reviewStatus pass
    const samplePass = {
      expectedImageKind: "naturalPhoto",
      expectedElementCategories: ["logo"],
      expectedVisibleElementLabels: ["sunflower", "leaves", "valley", "lake"], // 4 labels
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
            { category: "logo", label: "lake" } // 4 matched, 0 missing => 100% coverage
          ],
          visibleText: []
        }
      }
    };

    const summaryPass = evaluateSampleComparison(samplePass, resultPass);
    assert.strictEqual(summaryPass.reviewStatus, 'pass');
    assert.ok(summaryPass.coverage);
    assert.strictEqual(summaryPass.coverage.categories.ratio, 1.0);
    assert.strictEqual(summaryPass.coverage.labels.ratio, 1.0);
    assert.deepEqual(summaryPass.reviewReasons, []);

    // 2. imageKind exact, category coverage 1.0, label coverage 0.8 => should be needsReview under strict rules
    const sampleNeedsReviewLabel = {
      expectedImageKind: "naturalPhoto",
      expectedElementCategories: ["logo"],
      expectedVisibleElementLabels: ["sunflower", "leaves", "valley", "lake", "cloud"], // 5 labels
      expectedVisibleText: []
    } as any;

    const resultNeedsReviewLabel = {
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

    const summaryNeedsReviewLabel = evaluateSampleComparison(sampleNeedsReviewLabel, resultNeedsReviewLabel);
    assert.strictEqual(summaryNeedsReviewLabel.reviewStatus, 'needsReview');
    assert.ok(summaryNeedsReviewLabel.reviewReasons.some(r => r.includes("missing expected label: cloud")));

    // 3. visibleText missing => reviewStatus fail
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

    // 4. imageKind diverged => reviewStatus needsReview
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
  });

  test('should handle required vs optional expected metadata properly', () => {
    const sample = {
      id: "sample-optional-test",
      expectedImageKind: "naturalPhoto",
      expectedElementCategories: ["plant"],
      expectedVisibleElementLabels: ["sunflower"],
      expectedVisibleText: [],
      optionalElementCategories: ["weatherOrSky"],
      optionalVisibleElementLabels: ["sky"],
      optionalVisibleText: ["gorgeous sky"]
    } as any;

    // Case 1: required met, optional missing => reviewStatus: pass
    const result1 = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "naturalPhoto",
          visibleElements: [{ category: "plant", label: "sunflower" }]
        }
      }
    };
    const summary1 = evaluateSampleComparison(sample, result1);
    assert.strictEqual(summary1.reviewStatus, 'pass');
    assert.strictEqual(summary1.coverage?.labels.ratio, 1.0); // required is 100%
    assert.ok(summary1.optional);
    assert.strictEqual(summary1.optional.labels?.missing.includes("sky"), true);
    assert.strictEqual(summary1.optional.visibleText?.missing.includes("gorgeous sky"), true);

    // Case 2: required met, optional also met => reviewStatus: pass, matches populated in reviewNotes/optional matches
    const result2 = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "naturalPhoto",
          visibleElements: [
            { category: "plant", label: "sunflower" },
            { category: "weatherOrSky", label: "sky" }
          ],
          visibleText: ["gorgeous sky"]
        }
      }
    };
    const summary2 = evaluateSampleComparison(sample, result2);
    assert.strictEqual(summary2.reviewStatus, 'pass');
    assert.strictEqual(summary2.optional?.labels?.matched.includes("sky"), true);
    assert.strictEqual(summary2.optional?.visibleText?.matched.includes("gorgeous sky"), true);
    assert.ok(summary2.reviewNotes.some(n => n.includes("optional visible text matched: gorgeous sky")));

    // Case 3: required missing, optional met => reviewStatus: needsReview
    const result3 = {
      visualAnalysis: {
        visualInfo: {
          imageKind: "naturalPhoto",
          visibleElements: [
            { category: "weatherOrSky", label: "sky" }
          ],
          visibleText: ["gorgeous sky"]
        }
      }
    };
    const summary3 = evaluateSampleComparison(sample, result3);
    assert.strictEqual(summary3.reviewStatus, 'needsReview'); // sunflower missing!
    assert.ok(summary3.reviewReasons.some(r => r.includes("missing expected label: sunflower")));
  });
});
