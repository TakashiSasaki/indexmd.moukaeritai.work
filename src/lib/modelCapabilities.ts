/**
 * Model Capabilities Registry
 * 
 * Defines how different AI models interact with structured output.
 * 
 * - Gemini Models (gemini-*): Use `nativeSchema` (structuredExecutionMode). 
 *   They support passing a JSON schema natively to the API (`responseSchema`), 
 *   ensuring strict conformity to the requested structure.
 * 
 * - Gemma Models (gemma-*): Use `promptedJson`.
 *   They do NOT reliably support the native `responseSchema` property.
 *   Passing `responseSchema` to a Gemma model often causes generation failures
 *   or severe hallucinations. Therefore, Gemma models must be prompted to output
 *   JSON via text instructions, and we parse the raw output block.
 */
export type StructuredExecutionMode = "nativeSchema" | "promptedJson" | "textOnly";

export interface ModelCapability {
  modelNamePattern: RegExp;
  providerFamily: "google-gemini" | "google-gemma" | "unknown";
  structuredExecutionMode: StructuredExecutionMode;
  supportsNativeResponseSchema: boolean;
  supportsPromptedJson: boolean;
  preferredStructuredFallbacks?: string[];
  notes?: string;
}

const REGISTRY: ModelCapability[] = [
  {
    modelNamePattern: /gemini.*(?:flash|pro)/i,
    providerFamily: "google-gemini",
    structuredExecutionMode: "nativeSchema",
    supportsNativeResponseSchema: true,
    supportsPromptedJson: true,
    preferredStructuredFallbacks: ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"],
  },
  {
    modelNamePattern: /gemma/i,
    providerFamily: "google-gemma",
    structuredExecutionMode: "promptedJson",
    supportsNativeResponseSchema: false,
    supportsPromptedJson: true,
    preferredStructuredFallbacks: ["gemini-3.1-flash-lite"],
    notes: "Gemma models fail with native responseSchema, use prompted JSON"
  }
];

export function getModelCapability(modelName: string): ModelCapability {
  for (const cap of REGISTRY) {
    if (cap.modelNamePattern.test(modelName)) {
      return cap;
    }
  }
  return {
    modelNamePattern: /.*/,
    providerFamily: "unknown",
    structuredExecutionMode: "promptedJson",
    supportsNativeResponseSchema: false,
    supportsPromptedJson: true,
    preferredStructuredFallbacks: ["gemini-3.1-flash-lite"]
  };
}

export function shouldUseNativeResponseSchema(modelName: string): boolean {
  return getModelCapability(modelName).supportsNativeResponseSchema;
}

export function getStructuredExecutionMode(modelName: string): StructuredExecutionMode {
  return getModelCapability(modelName).structuredExecutionMode;
}

export type VisualModelRecommendation = "recommended" | "experimental" | "unsupported" | "discontinued";
export type ModelExecutionPolicy = "supported" | "experimental" | "unsupported" | "discontinued" | "historical-read-only";

export function getModelExecutionPolicy(modelName: string): ModelExecutionPolicy {
  if (!modelName) return "unsupported";
  const nameLower = modelName.toLowerCase();
  
  if (nameLower.includes("gemini-1.5") || nameLower === "gemini-flash-latest") {
    return "discontinued";
  }
  
  if (
    nameLower === "gemini-3.5-flash" || 
    nameLower === "gemini-3.5-pro" || 
    nameLower === "gemini-3.1-pro-preview" || 
    nameLower === "gemini-3.1-flash-lite" || 
    nameLower === "gemini-2.5-pro" || 
    nameLower === "gemini-2.5-flash" || 
    nameLower === "gemini-2.5-flash-lite" || 
    nameLower === "gemini-2.5-flash-lite-preview-09-2025"
  ) {
    return "supported";
  }
  
  if (
    nameLower === "gemini-3-flash-preview" || 
    nameLower.includes("gemma")
  ) {
    return "experimental";
  }
  
  return "unsupported";
}

export function validateModelExecution(modelName: string): { allowed: boolean; error?: "modelDiscontinued" | "modelUnsupported" } {
  const policy = getModelExecutionPolicy(modelName);
  if (policy === "discontinued" || policy === "historical-read-only") {
    return { allowed: false, error: "modelDiscontinued" };
  }
  if (policy === "unsupported") {
    return { allowed: false, error: "modelUnsupported" };
  }
  return { allowed: true };
}

export function getVisualModelCapability(modelName: string): { recommendation: VisualModelRecommendation; providerFamily: string } {
  const cap = getModelCapability(modelName);
  const policy = getModelExecutionPolicy(modelName);
  
  let recommendation: VisualModelRecommendation = "unsupported";
  if (policy === "supported") recommendation = "recommended";
  else if (policy === "experimental") recommendation = "experimental";
  else if (policy === "discontinued" || policy === "historical-read-only") recommendation = "discontinued";
  
  let providerFamily = "unknown";
  if (cap.providerFamily === "google-gemini") providerFamily = "gemini";
  else if (cap.providerFamily === "google-gemma") providerFamily = "gemma";
  
  return { recommendation, providerFamily };
}

