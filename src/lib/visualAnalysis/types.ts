import { ImageKind, VisibleElementCategory } from './vocabularies';

export interface VisibleElement {
  label: string;
  category: VisibleElementCategory;
  primary?: boolean;
  count?: number;
  attributes?: string[];
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
