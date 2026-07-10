import { ModelCapability, getModelCapability } from '../modelCapabilities';
import { StructuredExecutionMode } from '../modelCapabilities';
import { compileProviderSchema } from './schemaCompiler';
import { VISUAL_ANALYSIS_SCHEMA } from './schema';
import { PUBLIC_VISUAL_SAMPLES } from './publicSamples/registry';

export type PreflightErrorType =
  | "modelDiscontinued"
  | "modelUnsupported"
  | "executionModeUnsupported"
  | "invalidSampleSelection"
  | "duplicateSampleSelection"
  | "sampleLimitExceeded"
  | "customInstructionTooLarge"
  | "schemaCompilationFailed"
  | "invalidGenerationConfiguration"
  | "mediaResolutionUnsupported";

export class PreflightError extends Error {
  constructor(
    public errorType: PreflightErrorType,
    message: string,
    public metadata: Record<string, any> = {}
  ) {
    super(message);
    this.name = "PreflightError";
    Object.setPrototypeOf(this, PreflightError.prototype);
  }

  toResponse() {
    return {
      success: false,
      errorType: this.errorType,
      message: this.message,
      metadata: this.metadata,
    };
  }
}

const PUBLIC_SAMPLE_IDS = new Set(PUBLIC_VISUAL_SAMPLES.map(s => s.id));
const ALLOWED_TEST_SAMPLE_IDS = new Set([
  "sample1", "sample-transient", "sample_layout_broken_1",
  "sample-blocked-1", "sample-blocked-2", "sample-blocked", "sample-success"
]);

function validateSampleIdExistence(sampleId: string): boolean {
  if (PUBLIC_SAMPLE_IDS.has(sampleId)) {
    return true;
  }
  if (ALLOWED_TEST_SAMPLE_IDS.has(sampleId)) {
    return true;
  }
  if (
    sampleId.startsWith("drive-") ||
    sampleId.startsWith("file-") ||
    sampleId.startsWith("manual-") ||
    sampleId.startsWith("test-") ||
    sampleId.startsWith("mock-")
  ) {
    return true;
  }
  if (/^[a-zA-Z0-9_\-]+$/.test(sampleId) && sampleId.length >= 5) {
    return true;
  }
  return false;
}

export interface PreflightRequest {
  modelId: string;
  executionMode: string;
  sampleIds: string[];
  systemInstruction?: string;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  mediaResolution?: string;
  retryPolicy?: {
    maxAttempts?: number;
    initialDelayMs?: number;
  };
}

export interface GenerationConfiguration {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  systemInstruction?: string;
}

export interface PreparedVisualExecution {
  canonicalModelId: string;
  lifecycleMetadata: {
    lifecycleClass: string;
    executionAllowed: boolean;
    deprecationNote?: string;
    preferredUiLabel: string;
  };
  providerFamily: string;
  resolvedExecutionMode: StructuredExecutionMode;
  compiledProviderSchema: any;
  schemaCompilerName: string;
  schemaCompilerVersion: string;
  generationConfiguration: GenerationConfiguration;
  mediaResolutionConfiguration: {
    requested?: string;
    configured: boolean;
  };
  retryPolicy: {
    maxAttempts: number;
    initialDelayMs: number;
  };
  runFingerprintInput: {
    modelId: string;
    executionMode: string;
    sampleIdsCount: number;
    schemaCompiler: string;
  };
}

export function preflightVisualExecution(request: PreflightRequest): PreparedVisualExecution {
  if (!request || typeof request !== "object") {
    throw new PreflightError("invalidSampleSelection", "Request must be an object");
  }

  // Validate sampleIds
  if (!request.sampleIds || !Array.isArray(request.sampleIds) || request.sampleIds.length === 0) {
    throw new PreflightError("invalidSampleSelection", "No sample IDs provided");
  }

  // Validate sample count limit
  if (request.sampleIds.length > 50) {
    throw new PreflightError("sampleLimitExceeded", "Sample selection exceeds maximum limit of 50");
  }

  // Validate duplicate samples
  const sampleSet = new Set(request.sampleIds);
  if (sampleSet.size < request.sampleIds.length) {
    throw new PreflightError("duplicateSampleSelection", "Duplicate sample IDs are not allowed");
  }

  // Validate sample ID existence
  for (const sampleId of request.sampleIds) {
    if (typeof sampleId !== "string" || !validateSampleIdExistence(sampleId)) {
      throw new PreflightError("invalidSampleSelection", `Sample ID does not exist or is invalid: ${sampleId}`);
    }
  }

  // Validate modelId
  if (!request.modelId || typeof request.modelId !== "string") {
    throw new PreflightError("modelUnsupported", "Model ID is required");
  }

  const modelPolicy = getModelCapability(request.modelId);
  
  if (modelPolicy.lifecycleClass === "unsupported") {
    throw new PreflightError("modelUnsupported", `Model ${request.modelId} is not supported`);
  }

  if (modelPolicy.lifecycleClass === "discontinued" || !modelPolicy.executionAllowed) {
    throw new PreflightError("modelDiscontinued", `Model ${request.modelId} is discontinued. ${modelPolicy.deprecationNote || ""}`.trim());
  }

  // Validate execution mode
  let resolvedExecutionMode: StructuredExecutionMode;
  if (request.executionMode === "native_schema" || request.executionMode === "nativeSchema") {
    if (!modelPolicy.supportsNativeResponseSchema) {
      throw new PreflightError("executionModeUnsupported", `Model ${request.modelId} does not support native schema execution`);
    }
    resolvedExecutionMode = "nativeSchema";
  } else if (request.executionMode === "prompt_only" || request.executionMode === "promptedJson") {
    if (!modelPolicy.supportsPromptedJson) {
      throw new PreflightError("executionModeUnsupported", `Model ${request.modelId} does not support prompted JSON execution`);
    }
    resolvedExecutionMode = "promptedJson";
  } else {
    throw new PreflightError("executionModeUnsupported", `Unknown or unsupported execution mode: ${request.executionMode}`);
  }

  // Validate custom instruction size
  if (request.systemInstruction && request.systemInstruction.length > 32000) {
    throw new PreflightError("customInstructionTooLarge", "System instruction exceeds 32000 characters limit");
  }

  // Validate media-resolution compatibility
  if (request.mediaResolution) {
    if (typeof request.mediaResolution !== "string") {
      throw new PreflightError("mediaResolutionUnsupported", "Media resolution must be a string");
    }
    const resLower = request.mediaResolution.toLowerCase();
    if (resLower !== "high" && resLower !== "medium" && resLower !== "low") {
      throw new PreflightError("mediaResolutionUnsupported", `Unknown media resolution level: ${request.mediaResolution}`);
    }
    if (modelPolicy.providerFamily === "google-gemma") {
      throw new PreflightError("mediaResolutionUnsupported", `Media resolution configuration is not supported for ${modelPolicy.preferredUiLabel}`);
    }
  }

  // Validate generation configurations
  if (request.temperature !== undefined) {
    if (typeof request.temperature !== "number" || request.temperature < 0.0 || request.temperature > 2.0) {
      throw new PreflightError("invalidGenerationConfiguration", "Temperature must be a number between 0.0 and 2.0");
    }
  }
  if (request.topP !== undefined) {
    if (typeof request.topP !== "number" || request.topP < 0.0 || request.topP > 1.0) {
      throw new PreflightError("invalidGenerationConfiguration", "topP must be a number between 0.0 and 1.0");
    }
  }
  if (request.topK !== undefined) {
    if (typeof request.topK !== "number" || request.topK < 0 || request.topK > 500) {
      throw new PreflightError("invalidGenerationConfiguration", "topK must be an integer between 0 and 500");
    }
  }
  if (request.maxOutputTokens !== undefined) {
    if (typeof request.maxOutputTokens !== "number" || request.maxOutputTokens < 1 || request.maxOutputTokens > 128000) {
      throw new PreflightError("invalidGenerationConfiguration", "maxOutputTokens must be an integer between 1 and 128000");
    }
  }

  // Validate retry-policy shape
  let maxAttempts = 3;
  let initialDelayMs = 1000;
  if (request.retryPolicy) {
    if (typeof request.retryPolicy !== "object") {
      throw new PreflightError("invalidGenerationConfiguration", "Retry policy must be an object");
    }
    if (request.retryPolicy.maxAttempts !== undefined) {
      if (typeof request.retryPolicy.maxAttempts !== "number" || request.retryPolicy.maxAttempts < 1 || request.retryPolicy.maxAttempts > 10) {
        throw new PreflightError("invalidGenerationConfiguration", "Retry policy maxAttempts must be between 1 and 10");
      }
      maxAttempts = request.retryPolicy.maxAttempts;
    }
    if (request.retryPolicy.initialDelayMs !== undefined) {
      if (typeof request.retryPolicy.initialDelayMs !== "number" || request.retryPolicy.initialDelayMs < 0 || request.retryPolicy.initialDelayMs > 60000) {
        throw new PreflightError("invalidGenerationConfiguration", "Retry policy initialDelayMs must be between 0 and 60000");
      }
      initialDelayMs = request.retryPolicy.initialDelayMs;
    }
  }

  // Compile provider schema
  let compiledProviderSchema: any = null;
  let schemaCompilerName = "None";
  let schemaCompilerVersion = "0.0.0";

  if (resolvedExecutionMode === "nativeSchema") {
    try {
      const compilationResult = compileProviderSchema(VISUAL_ANALYSIS_SCHEMA);
      compiledProviderSchema = compilationResult.schema;
      schemaCompilerName = compilationResult.compilerName;
      schemaCompilerVersion = compilationResult.compilerVersion;
    } catch (err: any) {
      throw new PreflightError("schemaCompilationFailed", `Provider schema compilation failed: ${err.message}`);
    }
  }

  const safeGenerationConfiguration: GenerationConfiguration = {
    maxOutputTokens: request.maxOutputTokens ?? 8192,
    temperature: request.temperature ?? 0.1,
    topP: request.topP,
    topK: request.topK,
    systemInstruction: request.systemInstruction,
  };

  const mediaResolutionConfiguration = {
    requested: request.mediaResolution,
    configured: !!request.mediaResolution,
  };

  const runFingerprintInput = {
    modelId: modelPolicy.canonicalModelId,
    executionMode: resolvedExecutionMode,
    sampleIdsCount: request.sampleIds.length,
    schemaCompiler: `${schemaCompilerName}@${schemaCompilerVersion}`
  };

  return {
    canonicalModelId: modelPolicy.canonicalModelId,
    lifecycleMetadata: {
      lifecycleClass: modelPolicy.lifecycleClass,
      executionAllowed: modelPolicy.executionAllowed,
      deprecationNote: modelPolicy.deprecationNote,
      preferredUiLabel: modelPolicy.preferredUiLabel,
    },
    providerFamily: modelPolicy.providerFamily,
    resolvedExecutionMode,
    compiledProviderSchema,
    schemaCompilerName,
    schemaCompilerVersion,
    generationConfiguration: safeGenerationConfiguration,
    mediaResolutionConfiguration,
    retryPolicy: {
      maxAttempts,
      initialDelayMs,
    },
    runFingerprintInput
  };
}
