import { VISUAL_ANALYSIS_SCHEMA_VERSION } from "./schema";
import { normalizeVisualAnalysis } from "./normalize";

import { GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_NAME, GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_VERSION } from "./providerSchema";

export interface CanonicalizationContext {
  providerFamily?: string;
  modelName?: string;
  structuredExecutionMode?: string;
  jsonMode?: string;
}

export interface CanonicalizationDiagnostics {
  canonicalSchemaVersionApplied: boolean;
  originalSchemaVersion?: string;
  correctedSchemaVersion?: string;
  providerFamily?: string;
  modelName?: string;
  structuredExecutionMode?: string;
  jsonMode?: string;
  providerSchemaName?: string;
  providerSchemaVersion?: string;
  changes: Array<{ path: string; action: string; from?: any; to?: any }>;
}

export interface CanonicalizationResult {
  result: any;
  diagnostics: CanonicalizationDiagnostics;
}

export function canonicalizeVisualAnalysisProviderOutput(
  providerOutput: any,
  context?: CanonicalizationContext
): CanonicalizationResult {
  const diagnostics: CanonicalizationDiagnostics = {
    canonicalSchemaVersionApplied: false,
    providerFamily: context?.providerFamily,
    modelName: context?.modelName,
    structuredExecutionMode: context?.structuredExecutionMode,
    jsonMode: context?.jsonMode,
    changes: []
  };

  if (context?.structuredExecutionMode === "nativeSchema") {
    diagnostics.providerSchemaName = GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_NAME;
    diagnostics.providerSchemaVersion = GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_VERSION;
  }

  if (!providerOutput || typeof providerOutput !== 'object') {
    return { result: providerOutput, diagnostics };
  }

  // Use the existing normalizer to handle semantic cleanups, nulls, clamps
  const normalized = normalizeVisualAnalysis(providerOutput);

  // Enforce the canonical schema version regardless of what the provider returned
  const originalSchemaVersion = providerOutput.schemaVersion;
  if (originalSchemaVersion !== VISUAL_ANALYSIS_SCHEMA_VERSION) {
    diagnostics.canonicalSchemaVersionApplied = true;
    diagnostics.originalSchemaVersion = originalSchemaVersion;
    diagnostics.correctedSchemaVersion = VISUAL_ANALYSIS_SCHEMA_VERSION;
    diagnostics.changes.push({
      path: "schemaVersion",
      action: "setCanonicalVersion",
      from: originalSchemaVersion,
      to: VISUAL_ANALYSIS_SCHEMA_VERSION
    });
    
    normalized.schemaVersion = VISUAL_ANALYSIS_SCHEMA_VERSION;
  }

  return { result: normalized, diagnostics };
}
