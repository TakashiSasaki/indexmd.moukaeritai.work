import {
  TextAnalysisRecord,
  TextAnalysisStatus,
  TextAnalysisDiagnostics,
  TextAnalysisFailureKind,
  TextAssetMetadata,
  TextTechnicalMetadata,
  TextAnalysisRunMetadata
} from "./recordTypes.js";

export function buildTextAnalysisRecordFromStructuredSummaryResult(args: {
  result: any; // Result from processStructuredSummaryOutput
  input: {
    name?: string;
    fileId?: string;
    mimeType?: string | null;
    extension?: string | null;
    byteLength?: number;
    originalTextLength?: number;
    extractedTextLength?: number;
    contentSampleLength?: number;
    truncated?: boolean;
    truncationLimit?: number;
    textExtractionMethod?: string;
    ocrUsed?: boolean;
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
      originalTextLength: input.originalTextLength,
      extractedTextLength: input.extractedTextLength,
      contentSampleLength: input.contentSampleLength,
      truncated: input.truncated,
      truncationLimit: input.truncationLimit,
      textExtractionMethod: input.textExtractionMethod,
      ocrUsed: input.ocrUsed,
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
        resultSchemaVersion: result.schemaVersion || "summary-analysis.v1.2.0-draft.2",
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
      qualityStatus: result.qualityStatus === "excellent" ? "valid" : result.qualityStatus,
      qualityScore: result.qualityScore,
      qualityIssues: result.qualityIssues,
      recommendedForPersistence: result.recommendedForPersistence,
      recommendedForIndexMdCandidate: result.recommendedForIndexMdCandidate,
      experimentalModel: result.experimentalModel,
    };
  }

  const combinedDiagnostics: TextAnalysisDiagnostics = {
    input: {
      sourceKind: input.sourceKind,
      fileId: input.fileId,
      name: input.name,
      mimeType: input.mimeType,
      byteLength: input.byteLength,
      contentSampleLength: input.contentSampleLength,
      truncated: input.truncated,
      textExtractionMethod: input.textExtractionMethod,
    },
    generation: {
      modelName: run.modelName,
      providerFamily: run.providerFamily || result.providerFamily,
      failureKind: result.failureKind,
      statusCode: result.statusCode,
      providerStatus: result.providerStatus,
      retryable: result.retryable,
      apiRetryCount: result.apiRetryCount,
      attemptedModels: result.attemptedModels,
    },
    response: {
      rawTextLength: result.rawText ? result.rawText.length : undefined,
    },
    parse: {
      error: result.structuredParseFailed ? "JSON parse failed" : undefined,
    },
    validation: {
      errors: result.validationErrors && result.validationErrors.length > 0 ? result.validationErrors : undefined,
      warnings: result.warnings && result.warnings.length > 0 ? result.warnings : undefined,
    },
    repair: {
      repairApplied: result.repairApplied,
      repairFallbackUsed: result.repairFallbackUsed,
    },
    ...diagnostics,
  };

  record.diagnostics = combinedDiagnostics;

  return record;
}

export function buildFailedTextAnalysisRecord(args: {
  failureKind: TextAnalysisFailureKind;
  error: string;
  input: {
    name?: string;
    fileId?: string;
    mimeType?: string | null;
    extension?: string | null;
    byteLength?: number;
    originalTextLength?: number;
    extractedTextLength?: number;
    contentSampleLength?: number;
    truncated?: boolean;
    truncationLimit?: number;
    textExtractionMethod?: string;
    ocrUsed?: boolean;
    sourceKind?: "googleDrive" | "publicSample" | "upload" | "local" | "unknown";
  };
  run: {
    runId: string;
    timestamp: string;
    modelName: string;
    providerFamily?: string;
    promptVersion?: string;
    systemInstructionVersion?: string;
    customInstructionUsed?: boolean;
    outputMode?: string;
    customSchemaUsed?: boolean;
    responseSchemaEnabled?: boolean;
  };
  technicalMetadata?: TextTechnicalMetadata;
  diagnostics?: TextAnalysisDiagnostics;
}): TextAnalysisRecord {
  const { failureKind, error, input, run, technicalMetadata, diagnostics } = args;

  const status: TextAnalysisStatus = {
    success: false,
    error,
    failureKind,
  };

  const assetMetadata: TextAssetMetadata = {
    name: input.name,
    fileId: input.fileId,
    mimeType: input.mimeType,
    extension: input.extension,
    sourceKind: input.sourceKind,
  };

  const finalTechnical: TextTechnicalMetadata = {
    mimeType: input.mimeType,
    extension: input.extension,
    byteLength: input.byteLength,
    originalTextLength: input.originalTextLength,
    extractedTextLength: input.extractedTextLength,
    contentSampleLength: input.contentSampleLength,
    truncated: input.truncated,
    truncationLimit: input.truncationLimit,
    textExtractionMethod: input.textExtractionMethod,
    ocrUsed: input.ocrUsed,
    ...technicalMetadata
  };

  const analysisRun: TextAnalysisRunMetadata = {
    runId: run.runId,
    timestamp: run.timestamp,
    model: {
      name: run.modelName,
      providerFamily: run.providerFamily,
    },
    execution: {
      outputMode: run.outputMode || "structured",
      customSchemaUsed: run.customSchemaUsed,
      responseSchemaEnabled: run.responseSchemaEnabled,
    },
    schema: {
      resultSchemaVersion: "summary-analysis.v1.2.0-draft.2",
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
  };

  const combinedDiagnostics: TextAnalysisDiagnostics = {
    input: {
      sourceKind: input.sourceKind,
      fileId: input.fileId,
      name: input.name,
      mimeType: input.mimeType,
      byteLength: input.byteLength,
      contentSampleLength: input.contentSampleLength,
      truncated: input.truncated,
      textExtractionMethod: input.textExtractionMethod,
    },
    generation: {
      modelName: run.modelName,
      providerFamily: run.providerFamily,
      failureKind,
    },
    ...diagnostics,
  };

  const record: TextAnalysisRecord = {
    schemaVersion: "text-analysis-record.v0.1.0",
    status,
    assetMetadata,
    technicalMetadata: finalTechnical,
    analysisRun,
    diagnostics: combinedDiagnostics
  };

  return record;
}
