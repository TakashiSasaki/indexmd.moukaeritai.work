import { describe, it, assert } from 'vitest';
import { PublicVisualSample } from './types';
import { 
  compareExpectedImageKind, 
  compareExpectedCategories, 
  compareExpectedLabels, 
  compareExpectedVisibleText 
} from './compare';

describe('Public Sample Comparison Helpers', () => {
  const dummySample: PublicVisualSample = {
    id: "test",
    title: "Test",
    category: "mixed",
    expectedImageKind: "documentPhoto",
    expectedElementCategories: ["document", "textRegion"],
    expectedElementCategoryAlternatives: {
      "document": ["handwrittenNote", "book"]
    },
    expectedVisibleElementLabels: ["paper", "text"],
    expectedVisibleElementLabelAliases: {
      "paper": ["sheet", "page"]
    },
    expectedVisibleText: ["CONFIDENTIAL", "123"],
    source: {
      provider: "test",
      licenseKind: "publicDomain",
      licenseName: "PD",
      requiresAttribution: false
    }
  };

  it('compareExpectedImageKind - exact match', () => {
    const res = compareExpectedImageKind(dummySample, "documentPhoto");
    assert.strictEqual(res.status, "exact");
  });

  it('compareExpectedImageKind - acceptable match', () => {
    const res = compareExpectedImageKind(dummySample, "handwrittenNote");
    assert.strictEqual(res.status, "acceptable");
  });

  it('compareExpectedImageKind - diverged', () => {
    const res = compareExpectedImageKind(dummySample, "landscapePhoto");
    assert.strictEqual(res.status, "diverged");
  });

  it('compareExpectedCategories - exact and extra', () => {
    const detected = ["document", "textRegion", "tool"];
    const res = compareExpectedCategories(dummySample, detected);
    assert.deepEqual(res.exact, ["document", "textRegion"]);
    assert.deepEqual(res.missing, []);
    assert.deepEqual(res.extra, ["tool"]);
  });

  it('compareExpectedCategories - acceptable and missing', () => {
    const detected = ["handwrittenNote"];
    const res = compareExpectedCategories(dummySample, detected);
    assert.deepEqual(res.exact, []);
    assert.deepEqual(res.acceptable, ["handwrittenNote"]);
    assert.deepEqual(res.missing, ["textRegion"]);
    assert.deepEqual(res.extra, []);
  });

  it('compareExpectedLabels - exact, acceptable, missing', () => {
    const detected = ["text", "page", "pen"];
    const res = compareExpectedLabels(dummySample, detected);
    assert.deepEqual(res.exact, ["text"]);
    assert.deepEqual(res.acceptable, ["page"]); // matched via alias
    assert.deepEqual(res.missing, []); // paper was matched via page alias
    assert.deepEqual(res.extra, ["pen"]);
  });

  it('compareExpectedVisibleText - matched and missing', () => {
    const detected = ["Confidential report", "date"];
    const res = compareExpectedVisibleText(dummySample, detected);
    assert.deepEqual(res.matched, ["CONFIDENTIAL"]);
    assert.deepEqual(res.missing, ["123"]);
  });
});
