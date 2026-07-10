import { ModelCapability, getModelCapability } from '../modelCapabilities';
import { StructuredExecutionMode } from '../modelCapabilities';
import { compileProviderSchema, SchemaCompilationResult } from './schemaCompiler';
import { VISUAL_ANALYSIS_SCHEMA } from './schema';

export interface PreflightRequest {
  modelId: string;
  executionMode: string;
  sampleIds: string[];
  systemInstruction?: string;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface GenerationConfiguration {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface PreparedExecution {
  normalizedModelPolicy: ModelCapability;
  resolvedProviderFamily: string;
  resolvedExecutionMode: StructuredExecutionMode;
  compiledProviderSchema: any;
  schemaCompilerName: string;
  schemaCompilerVersion: string;
  safeGenerationConfiguration: GenerationConfiguration;
  runFingerprintInputs: {
    modelId: string;
    executionMode: string;
    sampleIdsCount: number;
    schemaCompiler: string;
  };
}

export function preflightVisualExecution(request: PreflightRequest): PreparedExecution {
  if (!request.sampleIds || request.sampleIds.length === 0) {
    throw new Error("No sample IDs provided");
  }

  const modelPolicy = getModelCapability(request.modelId);
  
  if (!modelPolicy.executionAllowed) {
    throw new Error(`Model ${request.modelId} is not allowed for new execution. ${modelPolicy.deprecationNote || ""}`.trim());
  }

  let resolvedExecutionMode: StructuredExecutionMode;
  if (request.executionMode === "native_schema") {
    if (!modelPolicy.supportsNativeResponseSchema) {
      throw new Error(`Model ${request.modelId} does not support native schema execution`);
    }
    resolvedExecutionMode = "nativeSchema";
  } else if (request.executionMode === "prompt_only" || request.executionMode === "promptedJson") {
    if (!modelPolicy.supportsPromptedJson) {
      throw new Error(`Model ${request.modelId} does not support prompted JSON execution`);
    }
    resolvedExecutionMode = "promptedJson";
  } else {
    throw new Error(`Unknown execution mode: ${request.executionMode}`);
  }

  if (request.systemInstruction && request.systemInstruction.length > 32000) {
    throw new Error("System instruction exceeds 32000 characters");
  }

  // Compile provider schema
  let compiledProviderSchema: any = null;
  let schemaCompilerName = "None";
  let schemaCompilerVersion = "0.0.0";

  if (resolvedExecutionMode === "nativeSchema") {
     const compilationResult = compileProviderSchema(VISUAL_ANALYSIS_SCHEMA);
     compiledProviderSchema = compilationResult.schema;
     schemaCompilerName = compilationResult.compilerName;
     schemaCompilerVersion = compilationResult.compilerVersion;
  }

  const safeGenerationConfiguration: GenerationConfiguration = {
    maxOutputTokens: request.maxOutputTokens ?? 8192,
    temperature: request.temperature ?? 0.1,
    topP: request.topP,
    topK: request.topK,
  };

  return {
    normalizedModelPolicy: modelPolicy,
    resolvedProviderFamily: modelPolicy.providerFamily,
    resolvedExecutionMode,
    compiledProviderSchema,
    schemaCompilerName,
    schemaCompilerVersion,
    safeGenerationConfiguration,
    runFingerprintInputs: {
      modelId: modelPolicy.canonicalModelId,
      executionMode: resolvedExecutionMode,
      sampleIdsCount: request.sampleIds.length,
      schemaCompiler: `${schemaCompilerName}@${schemaCompilerVersion}`
    }
  };
}
