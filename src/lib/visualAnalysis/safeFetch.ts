export interface ResponseDiagnostics {
  status: number;
  statusText: string;
  url: string;
  contentType: string;
  bodyLength: number;
  bodyPreview: string;
  looksLikeHtml: boolean;
  htmlTitle?: string;
  parseErrorMessage?: string;
  isTransientStartupHtml?: boolean;
  transientReason?: string;
  retryAfterSeconds?: number;
}

export interface SafeFetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  failureKind?: "nonJsonResponse" | "invalidJsonResponse" | "networkError" | string;
  responseDiagnostics?: ResponseDiagnostics;
}

export interface SafeFetchRetryEvent {
  attempt: number;
  nextAttempt?: number;
  delayMs: number;
  failureKind?: string;
  error?: string;
  htmlTitle?: string;
  status?: number;
  contentType?: string;
  responseDiagnostics?: ResponseDiagnostics;
}

export interface SafeFetchRetryDiagnostics {
  attempts: number;
  retried: boolean;
  events: SafeFetchRetryEvent[];
  finalFailureKind?: string;
}

export interface SafeFetchRetryOptions {
  maxAttempts?: number;
  delaysMs?: number[];
  retryNetworkError?: boolean;
  retryStartupHtml?: boolean;
  retryHttpStatuses?: number[];
  onRetry?: (event: SafeFetchRetryEvent) => void;
}

export interface SafeFetchResultWithRetry<T> extends SafeFetchResult<T> {
  retryDiagnostics?: SafeFetchRetryDiagnostics;
}

function truncateMiddle(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const half = Math.floor((maxLength - 100) / 2);
  const start = text.slice(0, half);
  const end = text.slice(-half);
  return `${start}\n\n... [TRUNCATED MIDDLE (original length: ${text.length} chars)] ...\n\n${end}`;
}

export async function safeFetch<T>(
  url: string,
  options?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "text/plain";
    const text = await res.text();

    const bodyLength = text.length;
    const bodyPreview = truncateMiddle(text, 4000);

    const looksLikeHtml =
      contentType.includes("html") ||
      text.trim().toLowerCase().startsWith("<!doctype") ||
      text.trim().toLowerCase().startsWith("<html") ||
      text.trim().includes("</html>");

    let htmlTitle: string | undefined;
    if (looksLikeHtml) {
      const match = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (match) {
        htmlTitle = match[1].trim();
      }
    }

    const isTransientStartupHtml = looksLikeHtml && (
      htmlTitle === "Starting Server..." ||
      text.includes("Please wait while your application starts")
    );
    let transientReason: string | undefined;
    if (isTransientStartupHtml) {
      transientReason = "startingServerHtml";
    }

    const trimmedText = text.trim();
    const looksLikeJson =
      contentType.includes("application/json") ||
      trimmedText.startsWith("{") ||
      trimmedText.startsWith("[");

    const retryAfterHeader = res.headers.get("retry-after");
    let retryAfterSeconds: number | undefined;
    if (retryAfterHeader) {
      const parsed = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsed)) {
        retryAfterSeconds = parsed;
      } else {
        const dateParsed = Date.parse(retryAfterHeader);
        if (!isNaN(dateParsed)) {
          retryAfterSeconds = Math.max(0, Math.ceil((dateParsed - Date.parse(new Date().toUTCString())) / 1000));
        }
      }
    }

    const diagnostics: ResponseDiagnostics = {
      status: res.status,
      statusText: res.statusText,
      url: res.url || url,
      contentType,
      bodyLength,
      bodyPreview,
      looksLikeHtml,
      htmlTitle,
      isTransientStartupHtml,
      transientReason,
      retryAfterSeconds,
    };

    if (res.status === 429) {
      return {
        success: false,
        failureKind: "rateLimited",
        error: `HTTP 429 Too Many Requests: ${res.statusText}`,
        responseDiagnostics: diagnostics,
      };
    }

    if (!looksLikeJson) {
      return {
        success: false,
        failureKind: "nonJsonResponse",
        error: `Expected JSON response but received ${contentType} with status ${res.status}`,
        responseDiagnostics: diagnostics,
      };
    }

    try {
      const data = JSON.parse(text);
      if (!res.ok) {
        // If the server returned a JSON error response (e.g. { error: "..." })
        return {
          success: false,
          data,
          error: data.error || `HTTP ${res.status}: ${res.statusText}`,
          failureKind: data.failureKind || "apiError",
          responseDiagnostics: diagnostics,
        };
      }
      return {
        success: true,
        data,
        responseDiagnostics: diagnostics,
      };
    } catch (parseErr: any) {
      diagnostics.parseErrorMessage = parseErr.message;
      return {
        success: false,
        failureKind: "invalidJsonResponse",
        error: `Failed to parse response as JSON: ${parseErr.message}`,
        responseDiagnostics: diagnostics,
      };
    }
  } catch (networkErr: any) {
    return {
      success: false,
      failureKind: "networkError",
      error: `Network error: ${networkErr.message}`,
    };
  }
}

export async function safeFetchWithRetry<T>(
  url: string,
  options?: RequestInit,
  retryOptions?: SafeFetchRetryOptions
): Promise<SafeFetchResultWithRetry<T>> {
  const maxAttempts = retryOptions?.maxAttempts ?? 4;
  const delaysMs = retryOptions?.delaysMs ?? [5000, 10000, 20000];
  const retryStartupHtml = retryOptions?.retryStartupHtml ?? true;
  const retryNetworkError = retryOptions?.retryNetworkError ?? true;
  const retryHttpStatuses = retryOptions?.retryHttpStatuses ?? [];

  const events: SafeFetchRetryEvent[] = [];
  let attempt = 1;

  while (true) {
    const result = await safeFetch<T>(url, options);

    let shouldRetry = false;
    if (!result.success) {
      if (retryStartupHtml && result.responseDiagnostics?.isTransientStartupHtml) {
        shouldRetry = true;
      } else if (retryNetworkError && result.failureKind === "networkError") {
        shouldRetry = true;
      } else if (result.responseDiagnostics?.status && retryHttpStatuses.includes(result.responseDiagnostics.status)) {
        shouldRetry = true;
      }
    }

    if (!shouldRetry || attempt >= maxAttempts) {
      return {
        ...result,
        retryDiagnostics: {
          attempts: attempt,
          retried: attempt > 1,
          events,
          finalFailureKind: result.success ? undefined : result.failureKind
        }
      };
    }

    const delayMs = result.responseDiagnostics?.retryAfterSeconds
      ? result.responseDiagnostics.retryAfterSeconds * 1000
      : (delaysMs[attempt - 1] || delaysMs[delaysMs.length - 1] || 5000);
    
    const event: SafeFetchRetryEvent = {
      attempt,
      nextAttempt: attempt + 1,
      delayMs,
      failureKind: result.failureKind,
      error: result.error,
      htmlTitle: result.responseDiagnostics?.htmlTitle,
      status: result.responseDiagnostics?.status,
      contentType: result.responseDiagnostics?.contentType,
      responseDiagnostics: result.responseDiagnostics,
    };
    
    events.push(event);
    
    if (retryOptions?.onRetry) {
      retryOptions.onRetry(event);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    attempt++;
  }
}
