export const IMAGE_KINDS = [
  "landscapePhoto",
  "naturalPhoto",
  "productPhoto",
  "packageImage",
  "documentPhoto",
  "receiptPhoto",
  "screenshot",
  "diagram",
  "chartOrTable",
  "handwrittenNote",
  "whiteboardPhoto",
  "mixed",
  "unknown"
] as const;

export type ImageKind = typeof IMAGE_KINDS[number];

export const VISIBLE_ELEMENT_CATEGORIES = [
  "person",
  "animal",
  "plant",
  "food",
  "product",
  "productPackage",
  "document",
  "screen",
  "uiElement",
  "building",
  "vehicle",
  "furniture",
  "container",
  "tool",
  "clothing",
  "landscapeElement",
  "weatherOrSky",
  "waterBody",
  "terrain",
  "roadOrPath",
  "signage",
  "textRegion",
  "chart",
  "table",
  "symbol",
  "unknown"
] as const;

export type VisibleElementCategory = typeof VISIBLE_ELEMENT_CATEGORIES[number];
