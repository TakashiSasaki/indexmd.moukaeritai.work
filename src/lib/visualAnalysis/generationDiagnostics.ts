export interface GenerationAttemptDiagnostic {
  attempt: number;
  modelName: string;
  statusCode?: number;
  providerStatus?: string;
  retryable?: boolean;
  errorMessageSummary?: string;
}

export interface GenerationDiagnostics {
  failureKind: "generationError";
  stage: "modelGenerateContent";
  modelName: string;
  providerFamily?: string;
  statusCode?: number;
  providerStatus?: string;
  rawMessageSummary?: string;
  retryable?: boolean;
  apiRetryCount?: number;
  attemptedModels?: string[];
  attempts?: GenerationAttemptDiagnostic[];
}
