import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export function getGeminiClient(modelName: string) {
  return ai;
}

export interface ProviderGenerationRetryPolicy {
  maxAttempts?: number;
  retryInternalErrors?: boolean;
  retryQuotaOrRateLimit?: boolean;
  retryUnavailable?: boolean;
  retryInvalidArgument?: boolean;
  baseDelayMs?: number;
  maxDelayMs?: number;
  respectRetryAfter?: boolean;
}

export class ProviderError extends Error {
  statusCode?: number;
  providerStatus?: string;
  rawMessageSummary?: string;
  attemptedModels?: string[];
  attempts?: any[];
  retryable?: boolean;
  apiRetryCount?: number;
  providerFailureKind?: "providerRateLimited" | "providerQuotaExceeded" | "providerUnavailable" | "providerInvalidArgument" | "providerGenerationError";
  quotaExceeded?: boolean;
  rateLimited?: boolean;
  retryAfterMs?: number;
  retryAfterReason?: string;
  quotaMetric?: string;
  quotaId?: string;
  quotaValue?: string | number;
  quotaDimensions?: Record<string, string>;
  quotaClassification?: "transientThrottle" | "dailyQuotaExhausted" | "providerUnavailable" | "generic429" | "unknown";
  errorFingerprint?: string;
  retryPolicy?: ProviderGenerationRetryPolicy;
  notRetriedReason?: string;
  errorName?: string;
  causeName?: string;
  causeMessageSummary?: string;
  causeCode?: string;
  causeErrno?: string;
  causeSyscall?: string;
  causeHostname?: string;
  constructor(message: string, statusCode?: number, providerStatus?: string, rawMessageSummary?: string) {
    super(message);
    this.name = "ProviderError";
    this.statusCode = statusCode;
    this.providerStatus = providerStatus;
    this.rawMessageSummary = rawMessageSummary;
  }
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function collectGoogleRpcDetails(err: any, rawMessage = ""): any[] {
  const details: any[] = [];
  const add = (value: any) => {
    if (Array.isArray(value)) details.push(...value.filter(Boolean));
  };
  add(err?.response?.error?.details);
  add(err?.error?.details);
  add(err?.details);
  if (rawMessage) {
    try {
      const parsed = JSON.parse(rawMessage);
      add(parsed?.error?.details);
      add(parsed?.details);
    } catch {}
  }
  return details;
}

export function parseGoogleRpcDurationMs(duration: unknown): number | undefined {
  if (typeof duration === "string") {
    const trimmed = duration.trim();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)(s|ms)$/);
    if (!match) return undefined;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value < 0) return undefined;
    const ms = match[2] === "s" ? value * 1000 : value;
    return ms > 0 && ms < 1 ? 1 : Math.ceil(ms);
  }
  if (duration && typeof duration === "object") {
    const seconds = Number((duration as any).seconds ?? 0);
    const nanos = Number((duration as any).nanos ?? 0);
    if (!Number.isFinite(seconds) || !Number.isFinite(nanos) || seconds < 0 || nanos < 0) return undefined;
    const ms = seconds * 1000 + nanos / 1e6;
    return ms > 0 && ms < 1 ? 1 : Math.ceil(ms);
  }
  return undefined;
}

export function extractStructuredProviderError(err: any): {
  statusCode?: number;
  providerStatus: string;
  rawMessage: string;
  providerFailureKind: ProviderError["providerFailureKind"];
  quotaExceeded: boolean;
  rateLimited: boolean;
  quotaMetric?: string;
  quotaId?: string;
  quotaValue?: string | number;
  quotaDimensions?: Record<string, string>;
  retryAfterMs?: number;
  retryAfterReason?: string;
  quotaClassification: "transientThrottle" | "dailyQuotaExhausted" | "providerUnavailable" | "generic429" | "unknown";
  errorFingerprint: string;
} {
  const { statusCode, providerStatus, rawMessage } = extractProviderErrorDetails(err);
  const details = collectGoogleRpcDetails(err, rawMessage);
  let quotaMetric: string | undefined;
  let quotaId: string | undefined;
  let quotaValue: string | number | undefined;
  const quotaDimensions: Record<string, string> = {};
  let retryAfterMs: number | undefined;
  let retryAfterReason: string | undefined;

  for (const detail of details) {
    const type = detail?.["@type"] || detail?.type;
    if (type === "type.googleapis.com/google.rpc.RetryInfo" || detail?.retryDelay) {
      const parsed = parseGoogleRpcDurationMs(detail.retryDelay);
      if (parsed !== undefined) {
        retryAfterMs = parsed;
        retryAfterReason = "google.rpc.RetryInfo";
      }
    }
    if (type === "type.googleapis.com/google.rpc.QuotaFailure" || Array.isArray(detail?.violations)) {
      for (const violation of detail.violations || []) {
        quotaMetric ||= violation.quotaMetric || violation.metric;
        quotaId ||= violation.quotaId || violation.quota_id;
        quotaValue ||= violation.quotaValue || violation.quota_value;
        const dims = violation.quotaDimensions || violation.dimensions || {};
        for (const [key, value] of Object.entries(dims)) {
          if (["model", "location", "quota_location", "service"].includes(key) && typeof value === "string") {
            quotaDimensions[key] = value;
          }
        }
      }
    }
  }

  const retry = extractRetryDelay(err, rawMessage);
  retryAfterMs ??= retry.retryAfterMs;
  retryAfterReason ??= retry.retryAfterReason;

  const base = classifyProviderFailureKind(statusCode, providerStatus, rawMessage);
  const quotaText = `${quotaMetric || ""} ${quotaId || ""} ${rawMessage}`.toLowerCase();
  let quotaClassification: "transientThrottle" | "dailyQuotaExhausted" | "providerUnavailable" | "generic429" | "unknown" = "unknown";
  if (base.providerFailureKind === "providerUnavailable") quotaClassification = "providerUnavailable";
  else if (quotaText.includes("perday") || quotaText.includes("per_day") || quotaText.includes("daily") || quotaText.includes("free_tier_requests")) quotaClassification = "dailyQuotaExhausted";
  else if (quotaMetric || quotaId) quotaClassification = "transientThrottle";
  else if (statusCode === 429) quotaClassification = "generic429";

  const providerFailureKind = quotaClassification === "dailyQuotaExhausted" ? "providerQuotaExceeded" : base.providerFailureKind;
  const fingerprint = stableHash(JSON.stringify({ statusCode, providerStatus, providerFailureKind, quotaMetric, quotaId, quotaValue, quotaDimensions }));
  return {
    statusCode,
    providerStatus,
    rawMessage,
    providerFailureKind,
    quotaExceeded: base.quotaExceeded || quotaClassification === "dailyQuotaExhausted",
    rateLimited: base.rateLimited || statusCode === 429,
    quotaMetric,
    quotaId,
    quotaValue,
    quotaDimensions: Object.keys(quotaDimensions).length ? quotaDimensions : undefined,
    retryAfterMs,
    retryAfterReason,
    quotaClassification,
    errorFingerprint: fingerprint,
  };
}

export function extractProviderErrorDetails(err: any): {
  statusCode?: number;
  providerStatus: string;
  rawMessage: string;
} {
  let statusCode = err?.status || err?.response?.status || err?.error?.code;
  let rawMessage = err?.message || "";
  
  if (err?.cause) {
    const cause = err.cause;
    rawMessage += ` | cause: ${cause.name || 'Error'}: ${cause.message || ''}`;
    if (cause.code) rawMessage += ` (code: ${cause.code})`;
    if (cause.errno) rawMessage += ` (errno: ${cause.errno})`;
    if (cause.syscall) rawMessage += ` (syscall: ${cause.syscall})`;
    if (cause.hostname) rawMessage += ` (host: ${cause.hostname})`;
  }

  if (!statusCode && rawMessage) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.error?.code) {
        statusCode = parsed.error.code;
      }
    } catch (e) {}
  }

  const errorBody = err?.response?.error || err?.error || {};
  let providerStatus = errorBody.status || "UNKNOWN";

  if (providerStatus === "UNKNOWN" && rawMessage) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.error?.status) {
        providerStatus = parsed.error.status;
      } else if (parsed.error?.code && typeof parsed.error.code === "string") {
        providerStatus = parsed.error.code;
      }
    } catch (e) {}
  }

  if (providerStatus === "UNKNOWN" && rawMessage) {
    const upperMsg = rawMessage.toUpperCase();
    if (upperMsg.includes("INVALID_ARGUMENT")) {
      providerStatus = "INVALID_ARGUMENT";
    } else if (upperMsg.includes("RESOURCE_EXHAUSTED")) {
      providerStatus = "RESOURCE_EXHAUSTED";
    } else if (upperMsg.includes("PERMISSION_DENIED")) {
      providerStatus = "PERMISSION_DENIED";
    } else if (upperMsg.includes("UNAUTHENTICATED")) {
      providerStatus = "UNAUTHENTICATED";
    } else if (upperMsg.includes("QUOTA_EXCEEDED")) {
      providerStatus = "RESOURCE_EXHAUSTED";
    }
  }

  return { statusCode, providerStatus, rawMessage };
}

export function classifyProviderFailureKind(
  statusCode: number | undefined,
  providerStatus: string,
  rawMessage: string
): {
  providerFailureKind: "providerRateLimited" | "providerQuotaExceeded" | "providerUnavailable" | "providerInvalidArgument" | "providerGenerationError";
  quotaExceeded: boolean;
  rateLimited: boolean;
} {
  let providerFailureKind: "providerRateLimited" | "providerQuotaExceeded" | "providerUnavailable" | "providerInvalidArgument" | "providerGenerationError" = "providerGenerationError";
  let quotaExceeded = false;
  let rateLimited = false;

  const upperMsgStr = rawMessage.toUpperCase();
  const isTransientTransport = upperMsgStr.includes("ECONNRESET") || 
                               upperMsgStr.includes("ETIMEDOUT") || 
                               upperMsgStr.includes("EAI_AGAIN") || 
                               upperMsgStr.includes("UND_ERR_CONNECT_TIMEOUT") || 
                               upperMsgStr.includes("UND_ERR_HEADERS_TIMEOUT") || 
                               upperMsgStr.includes("FETCH FAILED");

  if (statusCode === 429) {
    rateLimited = true;
    providerFailureKind = "providerRateLimited";
  }

  const isQuotaStatus = providerStatus === "RESOURCE_EXHAUSTED" || 
                        providerStatus === "QUOTA_EXCEEDED" || 
                        upperMsgStr.includes("RESOURCE_EXHAUSTED") || 
                        upperMsgStr.includes("QUOTA") || 
                        upperMsgStr.includes("RATE LIMIT") || 
                        upperMsgStr.includes("RATE_LIMIT") ||
                        upperMsgStr.includes("QUOTA_EXCEEDED");

  if (isQuotaStatus) {
    quotaExceeded = true;
    if (statusCode === 429) {
      providerFailureKind = "providerRateLimited";
    } else {
      providerFailureKind = "providerQuotaExceeded";
    }
  }

  if (isTransientTransport) {
    providerFailureKind = "providerUnavailable";
  } else if (statusCode === 503 || statusCode === 504 || providerStatus === "UNAVAILABLE" || upperMsgStr.includes("UNAVAILABLE")) {
    providerFailureKind = "providerUnavailable";
  }

  if (statusCode === 400 || providerStatus === "INVALID_ARGUMENT" || upperMsgStr.includes("INVALID_ARGUMENT")) {
    providerFailureKind = "providerInvalidArgument";
  }

  return { providerFailureKind, quotaExceeded, rateLimited };
}

export function extractRetryDelay(err: any, rawMessage: string): { retryAfterMs?: number; retryAfterReason?: string } {
  let retryAfterMs: number | undefined = undefined;
  let retryAfterReason: string | undefined = undefined;

  const tryExtractFromDetails = (details: any[]) => {
    if (!Array.isArray(details)) return;
    for (const detail of details) {
      if (detail && (detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo" || detail.retryDelay)) {
        const delay = detail.retryDelay;
        if (typeof delay === "string") {
          const parsed = parseGoogleRpcDurationMs(delay);
          if (parsed !== undefined) {
            retryAfterMs = parsed;
            retryAfterReason = "google.rpc.RetryInfo";
          }
        } else if (delay && typeof delay === "object") {
          const parsed = parseGoogleRpcDurationMs(delay);
          if (parsed !== undefined) {
            retryAfterMs = parsed;
            retryAfterReason = "google.rpc.RetryInfo (object)";
          }
        }
      }
    }
  };

  // 1. Try parsing response details or nested error details
  if (err?.response?.error?.details) {
    tryExtractFromDetails(err.response.error.details);
  }
  if (!retryAfterMs && err?.error?.details) {
    tryExtractFromDetails(err.error.details);
  }

  // 2. Try parsing stringified details in rawMessage
  if (!retryAfterMs && rawMessage) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.error?.details) {
        tryExtractFromDetails(parsed.error.details);
      }
    } catch (e) {}
  }

  // 3. Try HTTP headers (err.response?.headers)
  if (!retryAfterMs && err?.response?.headers) {
    let retryAfterHeader: string | null = null;
    if (typeof err.response.headers.get === "function") {
      retryAfterHeader = err.response.headers.get("retry-after") || err.response.headers.get("Retry-After");
    } else {
      retryAfterHeader = err.response.headers["retry-after"] || err.response.headers["Retry-After"];
    }

    if (retryAfterHeader) {
      const secs = parseFloat(retryAfterHeader);
      if (!isNaN(secs)) {
        retryAfterMs = secs * 1000;
        retryAfterReason = "HTTP retry-after header";
      } else {
        const ms = Date.parse(retryAfterHeader) - Date.now();
        if (!isNaN(ms) && ms > 0) {
          retryAfterMs = ms;
          retryAfterReason = "HTTP retry-after date header";
        }
      }
    }
  }

  // Cap retryAfterMs at 5 minutes (300,000 ms) as interactive batch fallback safety
  if (retryAfterMs !== undefined && retryAfterMs > 300000) {
    retryAfterMs = 300000;
    retryAfterReason = (retryAfterReason || "") + " (capped)";
  }

  return { retryAfterMs, retryAfterReason };
}

export async function generateContentWithRetry(
  modelName: string, 
  contents: any, 
  maxRetries = 4, 
  configOption?: { 
    temperature?: number; 
    topP?: number; 
    topK?: number; 
    systemInstruction?: string; 
    responseMimeType?: string; 
    responseSchema?: any; 
    mediaResolution?: string;
    retryPolicy?: ProviderGenerationRetryPolicy;
  }
) {
  let currentModel = modelName;
  let client = getGeminiClient(currentModel);
  let lastError: any = null;
  const attemptedModels = new Set<string>([currentModel]);
  const attempts: any[] = [];
  
  const policy = configOption?.retryPolicy;
  let resolvedMaxAttempts = maxRetries + 1;
  if (policy && typeof policy.maxAttempts === "number") {
    resolvedMaxAttempts = policy.maxAttempts;
  }
  if (resolvedMaxAttempts < 1) {
    resolvedMaxAttempts = 1;
  }
  
  for (let i = 0; i < resolvedMaxAttempts; i++) {
    try {
      const callParams: any = {
        model: currentModel,
        contents: contents
      };
      
      if (configOption) {
        callParams.config = {};
        if (typeof configOption.temperature === "number" && configOption.temperature !== 0) {
          callParams.config.temperature = configOption.temperature;
        }
        if (typeof configOption.topP === "number" && configOption.topP !== 0) {
          callParams.config.topP = configOption.topP;
        }
        if (typeof configOption.topK === "number" && configOption.topK !== 0) {
          callParams.config.topK = configOption.topK;
        }
        if (configOption.systemInstruction) {
          callParams.config.systemInstruction = configOption.systemInstruction;
        }
        if (configOption.responseMimeType) {
          callParams.config.responseMimeType = configOption.responseMimeType;
        }
        if (configOption.responseSchema) {
          callParams.config.responseSchema = configOption.responseSchema;
        }
        if (configOption.mediaResolution) {
          const mapping: Record<string, any> = {
            "high": "MEDIA_RESOLUTION_HIGH",
            "medium": "MEDIA_RESOLUTION_MEDIUM",
            "low": "MEDIA_RESOLUTION_LOW"
          };
          const mapped = mapping[configOption.mediaResolution.toLowerCase()];
          if (mapped) {
            callParams.config.mediaResolution = mapped;
          } else {
            // pass as is, maybe it's already MEDIA_RESOLUTION_HIGH
            callParams.config.mediaResolution = configOption.mediaResolution as any;
          }
        }
      }

      return await client.models.generateContent(callParams);
    } catch (err: any) {
      const structuredError = extractStructuredProviderError(err);
      const { statusCode, providerStatus, rawMessage, providerFailureKind, quotaExceeded, rateLimited, retryAfterMs, retryAfterReason } = structuredError;

      const isQuotaExceeded = statusCode === 429 || quotaExceeded || rateLimited;
      const isNotFound = statusCode === 404;

      // Determine retry eligibility based on policy
      let isRetryable = false;
      const isQuota = statusCode === 429 || quotaExceeded || rateLimited || providerFailureKind === "providerRateLimited" || providerFailureKind === "providerQuotaExceeded";
      const isInternal = statusCode === 500 || providerStatus === "INTERNAL" || providerFailureKind === "providerGenerationError";
      const isUnavailable = statusCode === 503 || statusCode === 504 || providerStatus === "UNAVAILABLE" || providerFailureKind === "providerUnavailable";
      const isInvalidArgument = statusCode === 400 || providerStatus === "INVALID_ARGUMENT" || providerFailureKind === "providerInvalidArgument";

      let notRetriedReason: string | undefined;
      if (policy) {
        if (isQuota) {
          isRetryable = policy.retryQuotaOrRateLimit !== false;
          if (!isRetryable) notRetriedReason = "retryQuotaOrRateLimit=false";
        } else if (isInternal) {
          isRetryable = policy.retryInternalErrors === true;
          if (!isRetryable) notRetriedReason = "retryInternalErrors=false";
        } else if (isUnavailable) {
          isRetryable = policy.retryUnavailable !== false;
          if (!isRetryable) notRetriedReason = "retryUnavailable=false";
        } else if (isInvalidArgument) {
          isRetryable = policy.retryInvalidArgument === true;
          if (!isRetryable) notRetriedReason = "retryInvalidArgument=false";
        } else {
          isRetryable = statusCode === 503 || statusCode === 429 || quotaExceeded;
          if (!isRetryable) notRetriedReason = "nonRetryableProviderStatus";
        }
      } else {
        if (isInternal) {
          isRetryable = false;
          notRetriedReason = "retryInternalErrors=false";
        } else if (isQuota || isUnavailable || statusCode === 503 || statusCode === 429 || quotaExceeded) {
          isRetryable = true;
        } else {
          isRetryable = false;
          if (isInvalidArgument) notRetriedReason = "retryInvalidArgument=false";
          else notRetriedReason = "nonRetryableProviderStatus";
        }
      }
      
      if (i >= resolvedMaxAttempts - 1 && isRetryable) {
        notRetriedReason = "maxAttemptsReached";
      }

      let delayMs;
      const baseDelay = policy?.baseDelayMs ?? 1500;
      const maxDelay = policy?.maxDelayMs ?? 300000;

      delayMs = Math.pow(2, i + 1) * baseDelay + Math.random() * 1000;
      
      const respectAfter = policy ? (policy.respectRetryAfter !== false) : true;
      if (isRetryable && respectAfter && retryAfterMs !== undefined && retryAfterMs > 0) {
        delayMs = retryAfterMs;
      }

      if (delayMs > maxDelay) {
        delayMs = maxDelay;
      }

      attempts.push({
        attempt: attempts.length + 1,
        modelName: currentModel,
        statusCode,
        providerStatus,
        retryable: isRetryable,
        errorMessageSummary: rawMessage.substring(0, 500),
        delayMs: isRetryable ? delayMs : undefined,
        retryAfterMs,
        retryReason: retryAfterReason,
        providerFailureKind,
        quotaClassification: structuredError.quotaClassification,
        quotaMetric: structuredError.quotaMetric,
        quotaId: structuredError.quotaId,
        quotaValue: structuredError.quotaValue,
        quotaDimensions: structuredError.quotaDimensions,
        errorFingerprint: structuredError.errorFingerprint,
        notRetriedReason
      });
      
      lastError = new ProviderError(
        `Generate content failed for model ${currentModel}`,
        statusCode,
        providerStatus,
        rawMessage.substring(0, 1000)
      );
      lastError.attemptedModels = Array.from(attemptedModels);
      lastError.attempts = attempts;
      lastError.retryable = isRetryable;
      lastError.apiRetryCount = i;
      lastError.providerFailureKind = providerFailureKind;
      lastError.quotaExceeded = quotaExceeded;
      lastError.rateLimited = rateLimited;
      lastError.retryAfterMs = retryAfterMs;
      lastError.retryAfterReason = retryAfterReason;
      lastError.quotaMetric = structuredError.quotaMetric;
      lastError.quotaId = structuredError.quotaId;
      lastError.quotaValue = structuredError.quotaValue;
      lastError.quotaDimensions = structuredError.quotaDimensions;
      lastError.quotaClassification = structuredError.quotaClassification;
      lastError.errorFingerprint = structuredError.errorFingerprint;
      lastError.retryPolicy = policy;
      lastError.notRetriedReason = notRetriedReason;
      
      // Fallback logic for 500 errors with native schema
      if (isRetryable && statusCode === 500 && configOption?.responseSchema) {
        configOption = { ...configOption };
        delete configOption.responseSchema;
        delete configOption.responseMimeType;
        configOption.systemInstruction = (configOption.systemInstruction || "") + 
          "\n\nCRITICAL INSTRUCTION: You MUST return ONLY a valid JSON object. Do NOT wrap the JSON in Markdown formatting (e.g. ```json). Just the raw JSON object.";
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      // Model Fallback logic
      const fallbackModels: Record<string, string> = {
        "gemini-3.5-pro": "gemini-3.1-pro-preview",
        "gemini-3.1-pro-preview": "gemini-3.5-flash",
      };

      if ((isNotFound || isQuotaExceeded) && fallbackModels[currentModel] && !attemptedModels.has(fallbackModels[currentModel])) {
        currentModel = fallbackModels[currentModel];
        attemptedModels.add(currentModel);
        client = getGeminiClient(currentModel);
        // Do not log noisy fallback messages or raw tokens
        i--; // Don't count this as a full retry
        continue;
      }
      
      if (isRetryable && i < resolvedMaxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      break;
    }
  }
  throw lastError;
}
