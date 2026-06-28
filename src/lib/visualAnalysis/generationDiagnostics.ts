export interface GenerationAttemptDiagnostic {
  attempt: number;
  modelName: string;
  statusCode?: number;
  providerStatus?: string;
  retryable?: boolean;
  errorMessageSummary?: string;
  delayMs?: number;
  retryAfterMs?: number;
  retryReason?: string;
  providerFailureKind?: string;
}

export interface GenerationDiagnostics {
  failureKind: "generationError" | "providerRateLimited" | "providerQuotaExceeded";
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
  providerFailureKind?: "providerRateLimited" | "providerQuotaExceeded" | "providerUnavailable" | "providerInvalidArgument" | "providerGenerationError";
  quotaExceeded?: boolean;
  rateLimited?: boolean;
  retryAfterMs?: number;
  retryAfterReason?: string;
}
