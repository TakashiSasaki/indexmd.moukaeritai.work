import { ProviderError } from "../gemini";
import { GenerationDiagnostics } from "./generationDiagnostics";
import { VisualAnalysisRunMetadata } from "./runMetadata";

export function buildGenerationFailureResponse(args: {
  err: any;
  targetModel: string;
  providerFamily: string;
  runMetadata: VisualAnalysisRunMetadata;
  outputMode?: "structured" | "markdown";
  requestPreview?: any;
  sampleMetadata?: any;
  expectedMetadata?: any;
  inputDiagnostics?: any;
}) {
  const { err, targetModel, providerFamily, runMetadata, outputMode, requestPreview, sampleMetadata, expectedMetadata, inputDiagnostics } = args;

  let failureKind: "generationError" | "providerRateLimited" | "providerQuotaExceeded" = "generationError";

  if (err instanceof ProviderError) {
    if (err.providerFailureKind === "providerRateLimited") {
      failureKind = "providerRateLimited";
    } else if (err.providerFailureKind === "providerQuotaExceeded") {
      failureKind = "providerQuotaExceeded";
    }
  }

  const diagnostics: GenerationDiagnostics = {
    failureKind,
    stage: "modelGenerateContent",
    modelName: targetModel,
    providerFamily,
  };

  if (err instanceof ProviderError) {
    diagnostics.statusCode = err.statusCode;
    diagnostics.providerStatus = err.providerStatus;
    diagnostics.rawMessageSummary = err.rawMessageSummary;
    diagnostics.retryable = err.retryable;
    diagnostics.apiRetryCount = err.apiRetryCount;
    diagnostics.attemptedModels = err.attemptedModels;
    diagnostics.attempts = err.attempts;
    diagnostics.providerFailureKind = err.providerFailureKind;
    diagnostics.quotaExceeded = err.quotaExceeded;
    diagnostics.rateLimited = err.rateLimited;
    diagnostics.retryAfterMs = err.retryAfterMs;
    diagnostics.retryAfterReason = err.retryAfterReason;
    diagnostics.retryPolicy = err.retryPolicy;
    diagnostics.notRetriedReason = err.notRetriedReason;
    diagnostics.errorName = err.errorName;
    diagnostics.causeName = err.causeName;
    diagnostics.causeMessageSummary = err.causeMessageSummary;
    diagnostics.causeCode = err.causeCode;
    diagnostics.causeErrno = err.causeErrno;
    diagnostics.causeSyscall = err.causeSyscall;
    diagnostics.causeHostname = err.causeHostname;
  } else if (err instanceof Error) {
    diagnostics.errorName = err.name;
    if ((err as any).cause) {
      diagnostics.causeName = (err as any).cause.name || "Error";
      diagnostics.causeMessageSummary = String((err as any).cause.message || (err as any).cause).substring(0, 500);
      diagnostics.causeCode = (err as any).cause.code;
    }
    diagnostics.rawMessageSummary = err.message.substring(0, 1000);
  } else {
    try {
      diagnostics.rawMessageSummary = JSON.stringify(err).substring(0, 1000);
    } catch {
      diagnostics.rawMessageSummary = "Unknown error";
    }
  }


  const record = {
    schemaVersion: "image-analysis-record.v0.1.0",
    status: {
      success: false,
      error: err?.message || "Generate content failed",
      failureKind
    },
    assetMetadata: sampleMetadata ? {
      assetId: sampleMetadata.id,
      title: sampleMetadata.title,
      category: sampleMetadata.category,
      sourceKind: runMetadata.input?.sourceKind || "publicSample",
      sampleId: sampleMetadata.id,
      sourceProvider: "publicSamples",
      sourcePageUrl: sampleMetadata.sourcePageUrl,
      licenseKind: sampleMetadata.licenseKind,
      licenseName: sampleMetadata.licenseName,
      attributionText: sampleMetadata.attributionText
    } : {
      sourceKind: runMetadata.input?.sourceKind
    },
    technicalMetadata: {
      mimeType: runMetadata.input?.mimeType,
      originalByteLength: inputDiagnostics?.originalByteLength,
      processedByteLength: runMetadata.input?.byteLength,
      base64Length: runMetadata.input?.base64Length,
      inputFormat: inputDiagnostics?.inputFormat,
      outputFormat: inputDiagnostics?.outputFormat,
      resized: inputDiagnostics?.resized,
      recompressed: inputDiagnostics?.recompressed,
      reencoded: inputDiagnostics?.reencoded,
      quality: inputDiagnostics?.quality,
      analysisSizingPolicy: inputDiagnostics?.analysisSizingPolicy,
      analysisTargetLongEdge: inputDiagnostics?.analysisTargetLongEdge,
      analysisTargetBytes: inputDiagnostics?.analysisTargetBytes,
      analysisHardCapBytes: inputDiagnostics?.analysisHardCapBytes,
      analysisSizeReductionRatio: inputDiagnostics?.analysisSizeReductionRatio,
      targetExceededButAccepted: inputDiagnostics?.targetExceededButAccepted,
      hardCapExceeded: inputDiagnostics?.hardCapExceeded,
      minQualityReached: inputDiagnostics?.minQualityReached,
      providerSafeMimeType: inputDiagnostics?.providerSafeMimeType,
      originalDimensions: inputDiagnostics?.originalDimensions,
      processedDimensions: inputDiagnostics?.dimensions
    },
    analysisRun: runMetadata,
    evaluation: expectedMetadata ? {
      expectedMetadata
    } : undefined,
    diagnostics: {
      input: {
        sourceKind: runMetadata.input?.sourceKind,
        sampleId: runMetadata.input?.sampleId,
        fileId: runMetadata.input?.fileId,
        mimeType: runMetadata.input?.mimeType,
        byteLength: runMetadata.input?.byteLength,
        base64Length: runMetadata.input?.base64Length,
        ...(inputDiagnostics || {})
      },
      generation: diagnostics
    }
  };

  const response: any = {
    record,
    success: false,
    error: err?.message || "Generate content failed",
    failureKind,
  };






  if (requestPreview) response.requestPreview = requestPreview;

  // Drive API endpoint expects `metadata` instead of sampleMetadata
  if (!sampleMetadata && !expectedMetadata && !outputMode) {
     // this looks like we need to handle drive metadata specifically if requested
  }

  return response;
}
