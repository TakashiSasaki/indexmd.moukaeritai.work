import { PublicVisualSample } from "./types";

export function buildPublicSampleExpectedMetadata(sample: PublicVisualSample) {
  return {
    imageKind: sample.expectedImageKind,
    acceptableImageKinds: sample.acceptableImageKinds,
    elementCategories: sample.expectedElementCategories,
    elementCategoryAlternatives: sample.expectedElementCategoryAlternatives,
    visibleElementLabels: sample.expectedVisibleElementLabels,
    visibleElementLabelAliases: sample.expectedVisibleElementLabelAliases,
    visibleText: sample.expectedVisibleText,
    notes: sample.expectedNotes,
    optionalElementCategories: sample.optionalElementCategories,
    optionalVisibleElementLabels: sample.optionalVisibleElementLabels,
    optionalVisibleElementLabelAliases: sample.optionalVisibleElementLabelAliases,
    optionalVisibleText: sample.optionalVisibleText
  };
}
