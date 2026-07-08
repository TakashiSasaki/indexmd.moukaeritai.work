import {
  TextAnalysisRecord,
  TextAnalysisStatus,
  TextAnalysisDiagnostics
} from "./recordTypes.js";

export function buildTextAnalysisRecordFromStructuredSummaryResult(args: {
  result: any; // Result from processStructuredSummaryOutput
  input: {
    name?: string;
    fileId?: string;
    mimeType?: string | null;
    extension?: string | null;
    byteLength?: number;
    contentSampleLength?: number;
    sourceKind?: "googleDrive" | "publicSample" | "upload" | "local" | "unknown";
  };
  run: {
    runId: string;
    timestamp: string;
    modelName: string;
    providerFamily?: string;
    structuredExecutionMode?: string;
    jsonMode?: string;
    promptVersion?: string;
    systemInstructionVersion?: string;
    customInstructionUsed?: boolean;
    outputMode?: string;
    customSchemaUsed?: boolean;
    responseSchemaEnabled?: boolean;
    repairApplied?: boolean;
    repairFallbackUsed?: boolean;
  };
  diagnostics?: TextAnalysisDiagnostics;
}): TextAnalysisRecord {
  const { result, input, run, diagnostics } = args;

  const isSuccess = !result.structuredParseFailed && !result.error && !!result.structured;

  const status: TextAnalysisStatus = {
    success: isSuccess,
  };

  if (!isSuccess) {
    status.error = result.error || "Unknown error";
    status.failureKind = result.failureKind || "unknown";
  }

  const record: TextAnalysisRecord = {
    schemaVersion: "text-analysis-record.v0.1.0",
    status,
    assetMetadata: {
      name: input.name,
      fileId: input.fileId,
      mimeType: input.mimeType,
      extension: input.extension,
      sourceKind: input.sourceKind,
    },
    technicalMetadata: {
      mimeType: input.mimeType,
      extension: input.extension,
      byteLength: input.byteLength,
      contentSampleLength: input.contentSampleLength,
    },
    analysisRun: {
      runId: run.runId,
      timestamp: run.timestamp,
      model: {
        name: run.modelName,
        providerFamily: run.providerFamily || result.providerFamily,
      },
      execution: {
        outputMode: run.outputMode || "structured",
        structuredExecutionMode: run.structuredExecutionMode || result.effectiveStructuredExecutionMode,
        jsonMode: run.jsonMode,
        customSchemaUsed: run.customSchemaUsed,
        responseSchemaEnabled: run.responseSchemaEnabled !== undefined ? run.responseSchemaEnabled : result.responseSchemaEnabled,
        repairApplied: result.repairApplied,
        repairFallbackUsed: result.repairFallbackUsed,
      },
      schema: {
        resultSchemaVersion: result.schemaVersion,
        recordSchemaVersion: "text-analysis-record.v0.1.0",
      },
      prompt: {
        summaryPromptVersion: run.promptVersion,
        systemInstructionVersion: run.systemInstructionVersion,
        customInstructionUsed: run.customInstructionUsed,
      },
      input: {
        sourceKind: input.sourceKind,
        fileId: input.fileId,
        mimeType: input.mimeType,
        byteLength: input.byteLength,
        contentSampleLength: input.contentSampleLength,
      },
    },
  };

  if (isSuccess && result.structured) {
    record.summaryAnalysis = result.structured;
  }

  if (result.qualityStatus) {
    record.evaluation = {
      qualityStatus: result.qualityStatus === "excellent" ? "valid" : result.qualityStatus, // Fallback normalization just in case
      qualityScore: result.qualityScore,
      qualityIssues: result.qualityIssues,
      recommendedForPersistence: result.recommendedForPersistence,
      recommendedForIndexMdCandidate: result.recommendedForIndexMdCandidate,
      experimentalModel: result.experimentalModel,
    };
  }

  const combinedDiagnostics: TextAnalysisDiagnostics = {
    ...diagnostics,
  };

  if (result.warnings && result.warnings.length > 0) {
    combinedDiagnostics.validation = { warnings: result.warnings };
  }
  if (result.validationErrors && result.validationErrors.length > 0) {
    combinedDiagnostics.validation = {
      ...(combinedDiagnostics.validation as any),
      errors: result.validationErrors,
    };
  }
  if (!isSuccess && result.rawText) {
    combinedDiagnostics.response = { rawTextLength: result.rawText.length };
  }

  record.diagnostics = combinedDiagnostics;

  return record;
}
