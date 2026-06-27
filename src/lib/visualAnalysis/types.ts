import { 
  ImageKind, 
  VisibleElementCategory,
  SceneContextEnvironment,
  SceneContextCover,
  SceneContextWeather,
  SceneContextLighting,
  SceneContextAccessibility,
  SceneContextRoadway,
  StateContextContainment,
  StateContextExposure,
  StateContextPlacement,
  StateContextUsage,
  StateContextInteraction,
  StateContextCondition
} from './vocabularies';

export interface SceneContext {
  environment?: SceneContextEnvironment;
  cover?: SceneContextCover;
  weather?: SceneContextWeather;
  lighting?: SceneContextLighting;
  accessibility?: SceneContextAccessibility;
  roadwayContext?: SceneContextRoadway;
  placeType?: string;
  description?: string;
  confidence?: number;
}

export interface ElementStateContext {
  containment?: StateContextContainment;
  exposure?: StateContextExposure;
  placement?: StateContextPlacement;
  usage?: StateContextUsage;
  interaction?: StateContextInteraction;
  condition?: StateContextCondition;
  role?: string;
  description?: string;
  confidence?: number;
}

export interface VisibleElement {
  label: string;
  category: VisibleElementCategory;
  primary?: boolean;
  count?: number;
  attributes?: string[];
  stateContext?: ElementStateContext;
  confidence: number;
  evidence?: string;
  locationHint?: string;
}

export interface VisibleText {
  text: string;
  confidence: number;
  locationHint?: string;
  language?: string;
}

export interface VisualAnalysisResultV1 {
  schemaVersion: "visual-analysis.v0.1.0-draft.1";
  summary: {
    caption: string;
    description: string;
  };
  visualInfo: {
    imageKind: ImageKind;
    imageKindConfidence: number;
    sceneDescription: string;
    visibleElements: VisibleElement[];
    visibleText: VisibleText[];
    uncertainties: string[];
  };
  indexing: {
    keywords: Array<{
      value: string;
      confidence: number;
      importance: number;
    }>;
  };
  quality: {
    confidence: number;
    issues: string[];
  };
}

export interface VisualAnalysisResultV2 {
  schemaVersion: "visual-analysis.v0.2.0-draft.1";
  summary: {
    caption: string;
    description: string;
  };
  visualInfo: {
    imageKind: ImageKind;
    imageKindConfidence: number;
    sceneDescription: string;
    sceneContext?: SceneContext;
    visibleElements: VisibleElement[];
    visibleText: VisibleText[];
    uncertainties: string[];
  };
  indexing: {
    keywords: Array<{
      value: string;
      confidence: number;
      importance: number;
    }>;
  };
  quality: {
    confidence: number;
    issues: string[];
  };
}
