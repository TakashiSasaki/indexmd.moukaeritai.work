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

  const diagnostics: GenerationDiagnostics = {
    failureKind: "generationError",
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
  } else if (err instanceof Error) {
    diagnostics.rawMessageSummary = err.message.substring(0, 1000);
  } else {
    try {
      diagnostics.rawMessageSummary = JSON.stringify(err).substring(0, 1000);
    } catch {
      diagnostics.rawMessageSummary = "Unknown error";
    }
  }

  const response: any = {
    success: false,
    error: err?.message || "Generate content failed",
    failureKind: "generationError",
    analysisRun: runMetadata,
    generationDiagnostics: diagnostics
  };

  if (runMetadata.input || inputDiagnostics) {
    response.inputDiagnostics = {
      sourceKind: runMetadata.input?.sourceKind,
      sampleId: runMetadata.input?.sampleId,
      fileId: runMetadata.input?.fileId,
      mimeType: runMetadata.input?.mimeType,
      byteLength: runMetadata.input?.byteLength,
      base64Length: runMetadata.input?.base64Length,
      ...(inputDiagnostics || {})
    };
  }

  if (outputMode) response.outputMode = outputMode;
  if (sampleMetadata) response.sampleMetadata = sampleMetadata;
  if (expectedMetadata) response.expectedMetadata = expectedMetadata;
  if (requestPreview) response.requestPreview = requestPreview;

  // Drive API endpoint expects `metadata` instead of sampleMetadata
  if (!sampleMetadata && !expectedMetadata && !outputMode) {
     // this looks like we need to handle drive metadata specifically if requested
  }

  return response;
}
