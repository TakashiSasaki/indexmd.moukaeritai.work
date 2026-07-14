export type ModelLifecycleClass =
  | "stable"
  | "preview"
  | "rolling-alias"
  | "experimental"
  | "discontinued"
  | "historical-read-only"
  | "unsupported";

export type ProviderFamily = "google-gemini" | "google-gemma" | "unknown";
export type StructuredExecutionMode = "nativeSchema" | "promptedJson" | "textOnly";

export interface ModelCapability {
  canonicalModelId: string;
  providerFamily: ProviderFamily;
  lifecycleClass: ModelLifecycleClass;
  executionAllowed: boolean;
  historicalReadingAllowed: boolean;
  supportsNativeResponseSchema: boolean;
  supportsPromptedJson: boolean;
  preferredUiLabel: string;
  replacementModel?: string;
  deprecationNote?: string;
}

export const MODEL_REGISTRY: Record<string, ModelCapability> = {
  "gemini-3.5-flash": {
    canonicalModelId: "gemini-3.5-flash",
    providerFamily: "google-gemini",
    lifecycleClass: "stable",
    executionAllowed: true,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: true,
    supportsPromptedJson: true,
    preferredUiLabel: "Gemini 3.5 Flash",
  },
  "gemini-2.5-flash": {
    canonicalModelId: "gemini-2.5-flash",
    providerFamily: "google-gemini",
    lifecycleClass: "stable",
    executionAllowed: true,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: true,
    supportsPromptedJson: true,
    preferredUiLabel: "Gemini 2.5 Flash",
  },
  "gemini-3.1-flash-lite": {
    canonicalModelId: "gemini-3.1-flash-lite",
    providerFamily: "google-gemini",
    lifecycleClass: "stable",
    executionAllowed: true,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: true,
    supportsPromptedJson: true,
    preferredUiLabel: "Gemini 3.1 Flash Lite",
  },
  "gemini-2.5-flash-lite": {
    canonicalModelId: "gemini-2.5-flash-lite",
    providerFamily: "google-gemini",
    lifecycleClass: "stable",
    executionAllowed: true,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: true,
    supportsPromptedJson: true,
    preferredUiLabel: "Gemini 2.5 Flash Lite",
  },
  "gemini-3.1-pro-preview": {
    canonicalModelId: "gemini-3.1-pro-preview",
    providerFamily: "google-gemini",
    lifecycleClass: "preview",
    executionAllowed: true,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: true,
    supportsPromptedJson: true,
    preferredUiLabel: "Gemini 3.1 Pro (Preview)",
  },
  "gemini-flash-latest": {
    canonicalModelId: "gemini-flash-latest",
    providerFamily: "google-gemini",
    lifecycleClass: "rolling-alias",
    executionAllowed: true,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: true,
    supportsPromptedJson: true,
    preferredUiLabel: "Gemini Flash Latest (Rolling)",
  },
  "gemini-1.5-pro": {
    canonicalModelId: "gemini-1.5-pro",
    providerFamily: "google-gemini",
    lifecycleClass: "discontinued",
    executionAllowed: false,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: true,
    supportsPromptedJson: true,
    preferredUiLabel: "Gemini 1.5 Pro (Discontinued)",
    replacementModel: "gemini-3.5-flash",
    deprecationNote: "Gemini 1.5 Pro is discontinued. Use Gemini 3.5 Flash or newer."
  },
  "gemini-1.5-flash": {
    canonicalModelId: "gemini-1.5-flash",
    providerFamily: "google-gemini",
    lifecycleClass: "discontinued",
    executionAllowed: false,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: true,
    supportsPromptedJson: true,
    preferredUiLabel: "Gemini 1.5 Flash (Discontinued)",
    replacementModel: "gemini-3.5-flash",
    deprecationNote: "Gemini 1.5 Flash is discontinued. Use Gemini 3.5 Flash or newer."
  },
  "gemma-4-31b-it": {
    canonicalModelId: "gemma-4-31b-it",
    providerFamily: "google-gemma",
    lifecycleClass: "experimental",
    executionAllowed: true,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: false,
    supportsPromptedJson: true,
    preferredUiLabel: "Gemma 4 31B IT",
  },
  "gemma-4-9b-it": {
    canonicalModelId: "gemma-4-9b-it",
    providerFamily: "google-gemma",
    lifecycleClass: "experimental",
    executionAllowed: true,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: false,
    supportsPromptedJson: true,
    preferredUiLabel: "Gemma 4 9B IT",
  }
};

export function getModelCapability(modelName: string): ModelCapability {
  const cap = MODEL_REGISTRY[modelName];
  if (cap) {
    return cap;
  }

  const nameLower = modelName.toLowerCase();
  const isGemini15 = nameLower.startsWith("gemini-1.5-") || nameLower === "gemini-1.5-pro-latest" || nameLower === "gemini-1.5-flash-preview";
  const isGemma = nameLower.includes("gemma");
  const isGemini = nameLower.includes("gemini");

  if (isGemini15) {
    return {
      canonicalModelId: modelName,
      providerFamily: "google-gemini",
      lifecycleClass: "discontinued",
      executionAllowed: false,
      historicalReadingAllowed: true,
      supportsNativeResponseSchema: true,
      supportsPromptedJson: true,
      preferredUiLabel: `${modelName} (Discontinued)`,
      deprecationNote: "This model version is discontinued."
    };
  }

  return {
    canonicalModelId: modelName,
    providerFamily: isGemini ? "google-gemini" : isGemma ? "google-gemma" : "unknown",
    lifecycleClass: "unsupported",
    executionAllowed: false,
    historicalReadingAllowed: true,
    supportsNativeResponseSchema: isGemini,
    supportsPromptedJson: true,
    preferredUiLabel: modelName,
  };
}

export function shouldUseNativeResponseSchema(modelName: string): boolean {
  return getModelCapability(modelName).supportsNativeResponseSchema;
}

export function getStructuredExecutionMode(modelName: string): StructuredExecutionMode {
  return getModelCapability(modelName).supportsNativeResponseSchema ? "nativeSchema" : "promptedJson";
}

export type VisualModelRecommendation = "recommended" | "experimental" | "unsupported";

export function getVisualModelCapability(modelName: string): { recommendation: VisualModelRecommendation; providerFamily: string } {
  const cap = getModelCapability(modelName);

  if (!cap.executionAllowed) {
      return { recommendation: "unsupported", providerFamily: cap.providerFamily === "unknown" ? "unknown" : cap.providerFamily === "google-gemma" ? "gemma" : "gemini" };
  }

  if (modelName.toLowerCase().includes("flash")) {
    return { recommendation: "recommended", providerFamily: "gemini" };
  }

  if (cap.providerFamily === "google-gemma") {
    return { recommendation: "experimental", providerFamily: "gemma" };
  }

  if (cap.providerFamily === "google-gemini") {
    return { recommendation: "experimental", providerFamily: "gemini" };
  }
  return { recommendation: "unsupported", providerFamily: "unknown" };
}

export function getExecutableModels(): ModelCapability[] {
  return Object.values(MODEL_REGISTRY).filter(m => m.executionAllowed);
}

export function getModelRegistry(): Record<string, ModelCapability> {
  return MODEL_REGISTRY;
}
