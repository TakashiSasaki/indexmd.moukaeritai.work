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

export interface SampleResolver {
  hasSample(sampleId: string): boolean;
  isExternalDescriptor(sampleId: string): boolean;
}

export class DefaultSampleResolver implements SampleResolver {
  private registeredIds = new Set(PUBLIC_VISUAL_SAMPLES.map(s => s.id));
  private allowedPrefixes = ["drive-", "file-", "manual-", "external-", "test-", "mock-", "sample-", "sample"];

  hasSample(sampleId: string): boolean {
    return this.registeredIds.has(sampleId);
  }

  isExternalDescriptor(sampleId: string): boolean {
    return this.allowedPrefixes.some(p => sampleId.startsWith(p)) && sampleId.length > 6;
  }
}

let activeSampleResolver: SampleResolver = new DefaultSampleResolver();

export function setSampleResolver(resolver: SampleResolver) {
  activeSampleResolver = resolver;
}

export function getSampleResolver(): SampleResolver {
  return activeSampleResolver;
}

function validateSampleIdExistence(sampleId: string): boolean {
  if (activeSampleResolver.hasSample(sampleId)) {
    return true;
  }
  if (activeSampleResolver.isExternalDescriptor(sampleId)) {
    return true;
  }
  return false;
}

export interface PreflightRequest {
  modelId: string;
  executionMode: string;
  sampleIds: string[];
  systemInstruction?: string;
  customSchema?: any;
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

export interface PreparedVisualExecution {
  readonly canonicalModelId: string;
  readonly lifecycleMetadata: {
    readonly lifecycleClass: string;
    readonly executionAllowed: boolean;
    readonly deprecationNote?: string;
    readonly preferredUiLabel: string;
  };
  readonly providerFamily: string;
  readonly resolvedExecutionMode: StructuredExecutionMode;
  readonly compiledProviderSchema: any;
  readonly schemaCompilerName: string;
  readonly schemaCompilerVersion: string;
  readonly customSchemaUsed: boolean;
  readonly customSchemaIdentity?: string;
  readonly generationConfiguration: {
    readonly maxOutputTokens?: number;
    readonly temperature?: number;
    readonly topP?: number;
    readonly topK?: number;
  };
  readonly mediaResolutionConfiguration: {
    readonly requested?: string;
    readonly configured: boolean;
  };
  readonly retryPolicy: {
    readonly maxAttempts: number;
    readonly initialDelayMs: number;
  };
  readonly normalizedSampleIdentities: readonly string[];
  readonly instructionHash?: string;
  readonly sampleSelectionHash: string;
  readonly schemaHash: string;
  readonly runFingerprint: {
    readonly modelId: string;
    readonly executionMode: string;
    readonly sampleIdsCount: number;
    readonly schemaCompiler: string;
    readonly instructionHash?: string;
    readonly sampleSelectionHash: string;
    readonly schemaHash: string;
  };
}

export function stableHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function extractJsonSchemaFromText(text: string): any {
  if (!text) return null;
  let startIdx = -1;
  while ((startIdx = text.indexOf("{", startIdx + 1)) !== -1) {
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === "{") {
        depth++;
      } else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx !== -1) {
      const potentialJson = text.substring(startIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(potentialJson);
        if (parsed && typeof parsed === "object" && (parsed.type || parsed.properties || parsed.items)) {
          return parsed;
        }
      } catch (e) {
        // keep searching
      }
    }
  }
  return null;
}

export function preflightVisualExecution(
  request: PreflightRequest,
  options?: { sampleResolver?: SampleResolver }
): PreparedVisualExecution {
  const originalResolver = getSampleResolver();
  if (options?.sampleResolver) {
    setSampleResolver(options.sampleResolver);
  }
  try {
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
  let customSchemaUsed = false;
  let customSchemaIdentity: string | undefined;

  if (resolvedExecutionMode === "nativeSchema") {
    try {
      let schemaToCompile = request.customSchema;
      if (!schemaToCompile && request.systemInstruction) {
        schemaToCompile = extractJsonSchemaFromText(request.systemInstruction);
      }

      if (schemaToCompile) {
        customSchemaUsed = true;
        const compilationResult = compileProviderSchema(schemaToCompile);
        compiledProviderSchema = compilationResult.schema;
        schemaCompilerName = compilationResult.compilerName;
        schemaCompilerVersion = compilationResult.compilerVersion;
        customSchemaIdentity = `custom-${stableHash(JSON.stringify(schemaToCompile))}`;
      } else {
        const compilationResult = compileProviderSchema(VISUAL_ANALYSIS_SCHEMA);
        compiledProviderSchema = compilationResult.schema;
        schemaCompilerName = compilationResult.compilerName;
        schemaCompilerVersion = compilationResult.compilerVersion;
      }
    } catch (err: any) {
      throw new PreflightError("schemaCompilationFailed", `Provider schema compilation failed: ${err.message}`);
    }
  }

  const safeGenerationConfiguration = {
    maxOutputTokens: request.maxOutputTokens ?? 8192,
    temperature: request.temperature ?? 0.1,
    topP: request.topP,
    topK: request.topK,
  };

  const mediaResolutionConfiguration = {
    requested: request.mediaResolution,
    configured: !!request.mediaResolution,
  };

  const sortedSampleIds = request.sampleIds.slice().sort();
  const sampleSelectionHash = stableHash(sortedSampleIds.join(","));
  const schemaHash = stableHash(JSON.stringify(compiledProviderSchema || {}));
  const instructionHash = request.systemInstruction ? stableHash(request.systemInstruction) : undefined;

  const runFingerprint = {
    modelId: modelPolicy.canonicalModelId,
    executionMode: resolvedExecutionMode,
    sampleIdsCount: request.sampleIds.length,
    schemaCompiler: `${schemaCompilerName}@${schemaCompilerVersion}`,
    instructionHash,
    sampleSelectionHash,
    schemaHash,
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
      customSchemaUsed,
      customSchemaIdentity,
      generationConfiguration: safeGenerationConfiguration,
      mediaResolutionConfiguration,
      retryPolicy: {
        maxAttempts,
        initialDelayMs,
      },
      normalizedSampleIdentities: request.sampleIds,
      instructionHash,
      sampleSelectionHash,
      schemaHash,
      runFingerprint,
    };
  } finally {
    if (options?.sampleResolver) {
      setSampleResolver(originalResolver);
    }
  }
}
