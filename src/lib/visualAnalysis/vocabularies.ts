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
  "artworkPhoto",
  "artifactPhoto",
  "mapImage",
  "medicalImage",
  "spacePhoto",
  "foodPhoto",
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
  "medical",
  "bodyPart",
  "unknown"
] as const;

export type VisibleElementCategory = typeof VISIBLE_ELEMENT_CATEGORIES[number];

export const SCENE_CONTEXT_ENVIRONMENTS = ["indoor", "outdoor", "semiOutdoor", "unknown"] as const;
export type SceneContextEnvironment = typeof SCENE_CONTEXT_ENVIRONMENTS[number];

export const SCENE_CONTEXT_COVERS = ["covered", "uncovered", "partiallyCovered", "unknown"] as const;
export type SceneContextCover = typeof SCENE_CONTEXT_COVERS[number];

export const SCENE_CONTEXT_WEATHERS = ["sunny", "cloudy", "rainy", "snowy", "foggy", "unknown"] as const;
export type SceneContextWeather = typeof SCENE_CONTEXT_WEATHERS[number];

export const SCENE_CONTEXT_LIGHTINGS = ["directSunlight", "shade", "artificialLight", "mixedLight", "lowLight", "unknown"] as const;
export type SceneContextLighting = typeof SCENE_CONTEXT_LIGHTINGS[number];

export const SCENE_CONTEXT_ACCESSIBILITIES = ["public", "private", "restricted", "commercial", "industrial", "residential", "unknown"] as const;
export type SceneContextAccessibility = typeof SCENE_CONTEXT_ACCESSIBILITIES[number];

export const SCENE_CONTEXT_ROADWAYS = ["onRoad", "nearRoad", "offRoad", "insideBuilding", "unknown"] as const;
export type SceneContextRoadway = typeof SCENE_CONTEXT_ROADWAYS[number];

export const STATE_CONTEXT_CONTAINMENTS = ["contained", "cased", "packaged", "boxed", "bagged", "uncontained", "unknown"] as const;
export type StateContextContainment = typeof STATE_CONTEXT_CONTAINMENTS[number];

export const STATE_CONTEXT_EXPOSURES = ["exposed", "covered", "protected", "partiallyExposed", "unknown"] as const;
export type StateContextExposure = typeof STATE_CONTEXT_EXPOSURES[number];

export const STATE_CONTEXT_PLACEMENTS = ["onSurface", "hanging", "stacked", "mounted", "shelved", "stored", "scattered", "discarded", "unknown"] as const;
export type StateContextPlacement = typeof STATE_CONTEXT_PLACEMENTS[number];

export const STATE_CONTEXT_USAGES = ["inUse", "readyToUse", "displayOnly", "storedNotInUse", "abandoned", "partOfActivity", "unknown"] as const;
export type StateContextUsage = typeof STATE_CONTEXT_USAGES[number];

export const STATE_CONTEXT_INTERACTIONS = ["heldByPerson", "usedByPerson", "wornByPerson", "unattended", "insideContainer", "onSurface", "nearOtherObjects", "unknown"] as const;
export type StateContextInteraction = typeof STATE_CONTEXT_INTERACTIONS[number];

export const STATE_CONTEXT_CONDITIONS = ["dry", "wet", "clean", "dirty", "damaged", "intact", "open", "closed", "unknown"] as const;
export type StateContextCondition = typeof STATE_CONTEXT_CONDITIONS[number];