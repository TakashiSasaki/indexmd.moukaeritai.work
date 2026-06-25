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
