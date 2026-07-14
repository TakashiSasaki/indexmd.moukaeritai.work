import { ProviderGenerationRetryPolicy } from "../gemini";

export interface GenerationAttemptDiagnostic {
  attempt: number;
  modelName: string;
  statusCode?: number;
  providerStatus?: string;
  retryable?: boolean;
  errorMessageSummary?: string;
  errorName?: string;
  causeName?: string;
  causeMessageSummary?: string;
  causeCode?: string;
  causeErrno?: string;
  causeSyscall?: string;
  causeHostname?: string;
  durationMs?: number;
  delayMs?: number;
  retryAfterMs?: number;
  retryReason?: string;
  providerFailureKind?: string;
  quotaMetric?: string;
  quotaId?: string;
  quotaValue?: string | number;
  quotaDimensions?: Record<string, string>;
  quotaClassification?: string;
  errorFingerprint?: string;
  notRetriedReason?: string;
}

export interface GenerationDiagnostics {
  failureKind:
    | "generationError"
    | "providerRateLimited"
    | "providerQuotaExceeded"
    | "providerUnavailable"
    | "providerInvalidArgument"
    | "jsonParseError"
    | "schemaValidationError"
    | "executionError";
  stage: "modelGenerateContent";
  modelName: string;
  providerFamily?: string;
  statusCode?: number;
  providerStatus?: string;
  rawMessageSummary?: string;
  errorName?: string;
  causeName?: string;
  causeMessageSummary?: string;
  causeCode?: string;
  causeErrno?: string;
  causeSyscall?: string;
  causeHostname?: string;
  durationMs?: number;
  retryable?: boolean;
  apiRetryCount?: number;
  attemptedModels?: string[];
  attempts?: GenerationAttemptDiagnostic[];
  providerFailureKind?: "providerRateLimited" | "providerQuotaExceeded" | "providerUnavailable" | "providerInvalidArgument" | "providerAuthenticationRequired" | "providerAuthorizationDenied" | "providerGenerationError" | "providerInternalError";
  quotaExceeded?: boolean;
  rateLimited?: boolean;
  retryAfterMs?: number;
  retryAfterReason?: string;
  quotaMetric?: string;
  quotaId?: string;
  quotaValue?: string | number;
  quotaDimensions?: Record<string, string>;
  quotaClassification?: string;
  errorFingerprint?: string;
  retryPolicy?: ProviderGenerationRetryPolicy;
  notRetriedReason?: string;
}
