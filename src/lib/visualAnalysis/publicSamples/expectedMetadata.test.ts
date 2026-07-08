import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildPublicSampleExpectedMetadata } from './expectedMetadata';

describe('buildPublicSampleExpectedMetadata', () => {
  it('should map all expected and optional fields correctly from a sample', () => {
    const sample: any = {
      id: "sample-1",
      expectedImageKind: "documentPhoto",
      acceptableImageKinds: ["handwrittenNote"],
      expectedElementCategories: ["textRegion"],
      expectedElementCategoryAlternatives: { textRegion: ["signage"] },
      expectedVisibleElementLabels: ["Header"],
      expectedVisibleElementLabelAliases: { "Header": ["Title"] },
      expectedVisibleText: ["Receipt"],
      expectedNotes: ["Requires medium or high resolution"],
      optionalElementCategories: ["logo"],
      optionalVisibleElementLabels: ["Watermark"],
      optionalVisibleElementLabelAliases: { "Watermark": ["Stamp"] },
      optionalVisibleText: ["Copy"]
    };

    const metadata = buildPublicSampleExpectedMetadata(sample);

    assert.strictEqual(metadata.imageKind, "documentPhoto");
    assert.deepStrictEqual(metadata.acceptableImageKinds, ["handwrittenNote"]);
    assert.deepStrictEqual(metadata.elementCategories, ["textRegion"]);
    assert.deepStrictEqual(metadata.elementCategoryAlternatives, { textRegion: ["signage"] });
    assert.deepStrictEqual(metadata.visibleElementLabels, ["Header"]);
    assert.deepStrictEqual(metadata.visibleElementLabelAliases, { "Header": ["Title"] });
    assert.deepStrictEqual(metadata.visibleText, ["Receipt"]);
    assert.deepStrictEqual(metadata.notes, ["Requires medium or high resolution"]);
    assert.deepStrictEqual(metadata.optionalElementCategories, ["logo"]);
    assert.deepStrictEqual(metadata.optionalVisibleElementLabels, ["Watermark"]);
    assert.deepStrictEqual(metadata.optionalVisibleElementLabelAliases, { "Watermark": ["Stamp"] });
    assert.deepStrictEqual(metadata.optionalVisibleText, ["Copy"]);
  });

  it('should handle undefined optional fields gracefully', () => {
    const sample: any = {
      expectedImageKind: "naturalPhoto"
    };

    const metadata = buildPublicSampleExpectedMetadata(sample);

    assert.strictEqual(metadata.imageKind, "naturalPhoto");
    assert.strictEqual(metadata.acceptableImageKinds, undefined);
    assert.strictEqual(metadata.elementCategories, undefined);
    assert.strictEqual(metadata.optionalElementCategories, undefined);
  });
});
