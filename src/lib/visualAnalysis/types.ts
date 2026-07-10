export type ProviderFailureKind =
  | "providerRateLimited"
  | "providerQuotaExceeded"
  | "providerUnavailable"
  | "providerInvalidArgument"
  | "providerAuthenticationRequired"
  | "providerAuthorizationDenied"
  | "providerGenerationError"
  | "providerInternalError";

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


export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSystem: "normalized";
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
  boundingBox?: BoundingBox;
}

export interface VisibleText {
  text: string;
  confidence: number;
  locationHint?: string;
  language?: string;
  boundingBox?: BoundingBox;
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

export interface ImageAnalysisStatus {
  success: boolean;
  error?: string;
  failureKind?: ProviderFailureKind | string;
}

export interface ImageAssetMetadata {
  assetId?: string;
  title?: string;
  category?: string;
  sourceKind?: "publicSample" | "driveFile" | "manualUpload" | string;
  fileId?: string;
  sampleId?: string;
  sourceProvider?: string;
  sourcePageUrl?: string;
  licenseKind?: string;
  licenseName?: string;
  attributionText?: string;
}

export interface ImageTechnicalMetadata {
  mimeType?: string;
  originalDimensions?: {
    width: number;
    height: number;
  };
  processedDimensions?: {
    width: number;
    height: number;
  };
  originalByteLength?: number;
  processedByteLength?: number;
  base64Length?: number;
  inputFormat?: string;
  outputFormat?: string;
  resized?: boolean;
  recompressed?: boolean;
  reencoded?: boolean;
  quality?: number;
  analysisSizingPolicy?: string;
  analysisTargetLongEdge?: number;
  analysisTargetBytes?: number;
  analysisHardCapBytes?: number;
  analysisSizeReductionRatio?: number;
  targetExceededButAccepted?: boolean;
  hardCapExceeded?: boolean;
  minQualityReached?: boolean;
  providerSafeMimeType?: boolean;
}

export interface ImageAnalysisDiagnostics {
  input?: any;
  parse?: any;
  normalization?: any;
  generation?: any;
  response?: any;
  retry?: any;
}

export interface VisualAnalysisEvaluation {
  expectedMetadata?: any;
  comparison?: any;
  qualityStatus?: string;
  qualityScore?: number;
  qualityIssues?: any[]; // To allow both strings and detailed objects as per JSON schema
  reviewStatus?: string;
  reviewReasons?: string[];
  reviewNotes?: string[];
}

export interface ImageAnalysisRecord {
  schemaVersion: "image-analysis-record.v0.1.0";
  status: ImageAnalysisStatus;
  assetMetadata: ImageAssetMetadata;
  technicalMetadata?: ImageTechnicalMetadata;
  visualAnalysis?: VisualAnalysisResultV2;
  analysisRun?: any; // VisualAnalysisRunMetadata
  evaluation?: VisualAnalysisEvaluation;
  diagnostics?: ImageAnalysisDiagnostics;
}
