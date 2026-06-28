import { VisualAnalysisResultV1, VisualAnalysisResultV2 } from "./types";
import { VISUAL_ANALYSIS_SCHEMA_VERSION } from "./schema";
import { GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_NAME, GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_VERSION } from "./providerSchema";
import { VISUAL_ANALYSIS_PROMPT_VERSION, VISUAL_ANALYSIS_SYSTEM_INSTRUCTION_VERSION } from "./prompts";

export const VISUAL_ANALYSIS_GENERATION_CONFIG = {
  temperature: 0.2,
  topP: 0.95,
  topK: 40
} as const;

export interface VisualJsonRecoveryMetadata {
  localRecoveryEnabled: boolean;
  retryStrategy: "none" | "sameRequestOnce";
  retryCount: number;
  finalParseMode?: "direct" | "fenceStripped" | "extractedObject";
}

export interface VisualAnalysisRunMetadata {
  runId: string;
  timestamp: string;

  model: {
    name: string;
    providerFamily: "gemini" | "gemma" | string;
    visualRecommendation?: string;
  };

  execution: {
    outputMode: "structured";
    structuredExecutionMode: "nativeSchema" | "promptedJson" | string;
    jsonMode?: "prompt_only" | "native_schema" | string;
    customSchemaUsed: boolean;
    requestPreviewIncluded: boolean;
    jsonRecovery?: VisualJsonRecoveryMetadata;
  };

  schema: {
    resultSchemaVersion: "visual-analysis.v0.2.0-draft.1" | string;
    providerResponseSchemaName?: string;
    providerResponseSchemaVersion?: string;
    providerResponseSchemaDerivedFrom?: string;
    customSchemaUsed: boolean;
  };

  prompt: {
    visualPromptVersion: string;
    systemInstructionVersion: string;
    customInstructionUsed: boolean;
  };

  generationConfig: {
    temperature: number;
    topP: number;
    topK: number;
    mediaResolutionRequested?: string;
    mediaResolutionApplied?: boolean;
    mediaResolutionReason?: string;
    mediaResolutionProviderField?: string;
  };

  input: {
    sourceKind: "publicSample" | "driveFile";
    sampleId?: string;
    fileId?: string;
    mimeType?: string;
    byteLength?: number;
    base64Length?: number;
  };
}

export function buildVisualAnalysisRunMetadata(params: {
  targetModel: string;
  providerFamily: string;
  visualRecommendation?: string;
  mode: string;
  jsonMode?: string;
  customInstructionUsed: boolean;
  customSchemaUsed: boolean;
  requestPreviewIncluded: boolean;
  sourceKind: "publicSample" | "driveFile";
  sampleId?: string;
  fileId?: string;
  mimeType?: string;
  byteLength?: number;
  base64Length?: number;
  mediaResolutionRequested?: string;
  mediaResolutionApplied?: boolean;
  mediaResolutionReason?: string;
  mediaResolutionProviderField?: string;
}): VisualAnalysisRunMetadata {
  return {
    runId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    model: {
      name: params.targetModel,
      providerFamily: params.providerFamily,
      visualRecommendation: params.visualRecommendation,
    },
    execution: {
      outputMode: "structured",
      structuredExecutionMode: params.mode,
      jsonMode: params.jsonMode,
      customSchemaUsed: params.customSchemaUsed,
      requestPreviewIncluded: params.requestPreviewIncluded,
    },
    schema: {
      resultSchemaVersion: params.customSchemaUsed ? "custom" : VISUAL_ANALYSIS_SCHEMA_VERSION,
      ...(params.mode === "nativeSchema" && !params.customSchemaUsed ? {
        providerResponseSchemaName: GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_NAME,
        providerResponseSchemaVersion: GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_VERSION,
        providerResponseSchemaDerivedFrom: VISUAL_ANALYSIS_SCHEMA_VERSION
      } : {}),
      customSchemaUsed: params.customSchemaUsed,
    },
    prompt: {
      visualPromptVersion: VISUAL_ANALYSIS_PROMPT_VERSION,
      systemInstructionVersion: VISUAL_ANALYSIS_SYSTEM_INSTRUCTION_VERSION,
      customInstructionUsed: params.customInstructionUsed,
    },
    generationConfig: {
      temperature: VISUAL_ANALYSIS_GENERATION_CONFIG.temperature,
      topP: VISUAL_ANALYSIS_GENERATION_CONFIG.topP,
      topK: VISUAL_ANALYSIS_GENERATION_CONFIG.topK,
      mediaResolutionRequested: params.mediaResolutionRequested,
      mediaResolutionApplied: params.mediaResolutionApplied,
      mediaResolutionReason: params.mediaResolutionReason,
      mediaResolutionProviderField: params.mediaResolutionProviderField
    },
    input: {
      sourceKind: params.sourceKind,
      sampleId: params.sampleId,
      fileId: params.fileId,
      mimeType: params.mimeType,
      byteLength: params.byteLength,
      base64Length: params.base64Length,
    }
  };
}

export interface VisualAnalysisResponse {
  visualAnalysis: VisualAnalysisResultV1 | VisualAnalysisResultV2;
  analysisRun?: VisualAnalysisRunMetadata;

  // Legacy fields for backward compatibility
  usedModelName?: string;
  providerFamily?: string;
  effectiveStructuredExecutionMode?: string;
  quality?: any;
  requestPreview?: any;
}
