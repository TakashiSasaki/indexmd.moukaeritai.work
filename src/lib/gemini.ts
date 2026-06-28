import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export function getGeminiClient(modelName: string) {
  return ai;
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

  constructor(message: string, statusCode?: number, providerStatus?: string, rawMessageSummary?: string) {
    super(message);
    this.name = "ProviderError";
    this.statusCode = statusCode;
    this.providerStatus = providerStatus;
    this.rawMessageSummary = rawMessageSummary;
  }
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
  }
) {
  let currentModel = modelName;
  let client = getGeminiClient(currentModel);
  let lastError: any = null;
  const attemptedModels = new Set<string>([currentModel]);
  const attempts: any[] = [];
  
  for (let i = 0; i <= maxRetries; i++) {
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
      let statusCode = err.status || err.response?.status || err.error?.code;
      if (!statusCode && err.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error?.code) {
             statusCode = parsed.error.code;
          }
        } catch(e) {}
      }

      const rawMessage = err.message || "";
      const errorBody = err.response?.error || err.error || {};
      let providerStatus = errorBody.status || "UNKNOWN";
      
      if (providerStatus === "UNKNOWN" && err.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error?.status) {
            providerStatus = parsed.error.status;
          } else if (parsed.error?.code && typeof parsed.error.code === 'string') {
            providerStatus = parsed.error.code;
          }
        } catch(e) {}
      }
      
      if (providerStatus === "UNKNOWN" && err.message) {
        const upperMsg = err.message.toUpperCase();
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
      
      let providerFailureKind: "providerRateLimited" | "providerQuotaExceeded" | "providerUnavailable" | "providerInvalidArgument" | "providerGenerationError" = "providerGenerationError";
      let quotaExceeded = false;
      let rateLimited = false;

      if (statusCode === 429) {
        rateLimited = true;
        providerFailureKind = "providerRateLimited";
      }

      const upperMsgStr = rawMessage.toUpperCase();
      if (providerStatus === "RESOURCE_EXHAUSTED" || providerStatus === "QUOTA_EXCEEDED" || 
          upperMsgStr.includes("RESOURCE_EXHAUSTED") || 
          upperMsgStr.includes("QUOTA") || 
          upperMsgStr.includes("RATE LIMIT") || 
          upperMsgStr.includes("RATE_LIMIT")) {
        quotaExceeded = true;
        if (statusCode === 429) {
          providerFailureKind = "providerRateLimited";
        } else {
          providerFailureKind = "providerQuotaExceeded";
        }
      }

      if (statusCode === 503 || statusCode === 504 || providerStatus === "UNAVAILABLE" || upperMsgStr.includes("UNAVAILABLE")) {
        providerFailureKind = "providerUnavailable";
      }

      if (statusCode === 400 || providerStatus === "INVALID_ARGUMENT" || upperMsgStr.includes("INVALID_ARGUMENT")) {
        providerFailureKind = "providerInvalidArgument";
      }

      let retryAfterMs: number | undefined = undefined;
      let retryAfterReason: string | undefined = undefined;

      // 1. Try to find RetryInfo in error details (JSON)
      if (rawMessage) {
        try {
          const parsed = JSON.parse(rawMessage);
          if (parsed.error?.details && Array.isArray(parsed.error.details)) {
            for (const detail of parsed.error.details) {
              if (detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo" || detail.retryDelay) {
                const delayStr = detail.retryDelay; // e.g. "1.5s" or "30s"
                if (typeof delayStr === "string" && delayStr.endsWith("s")) {
                  const secs = parseFloat(delayStr.slice(0, -1));
                  if (!isNaN(secs)) {
                    retryAfterMs = secs * 1000;
                    retryAfterReason = "google.rpc.RetryInfo";
                  }
                }
              }
            }
          }
        } catch(e) {}
      }

      // 2. Try HTTP headers
      const retryAfterHeader = err.response?.headers?.["retry-after"] || (err.response?.headers && typeof err.response.headers.get === "function" && err.response.headers.get("retry-after"));
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

      const isQuotaExceeded = statusCode === 429 || quotaExceeded;
      const isNotFound = statusCode === 404;
      const isRetryable = statusCode === 503 || statusCode === 429 || statusCode === 500 || quotaExceeded;

      let delayMs = Math.pow(2, i + 1) * 1500 + Math.random() * 1000;
      if (isRetryable && retryAfterMs !== undefined && retryAfterMs > 0) {
        delayMs = retryAfterMs;
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
        providerFailureKind
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
      
      // Fallback logic for 500 errors with native schema
      if (statusCode === 500 && configOption?.responseSchema) {
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
      
      if (isRetryable && i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      break;
    }
  }
  throw lastError;
}
