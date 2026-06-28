import { VISUAL_ANALYSIS_SCHEMA_VERSION } from "./schema";
import { normalizeVisualAnalysis } from "./normalize";

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
    changes: []
  };

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
