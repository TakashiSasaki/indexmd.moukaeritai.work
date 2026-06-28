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
}

export interface SafeFetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  failureKind?: "nonJsonResponse" | "invalidJsonResponse" | "networkError" | string;
  responseDiagnostics?: ResponseDiagnostics;
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

    const trimmedText = text.trim();
    const looksLikeJson =
      contentType.includes("application/json") ||
      trimmedText.startsWith("{") ||
      trimmedText.startsWith("[");

    const diagnostics: ResponseDiagnostics = {
      status: res.status,
      statusText: res.statusText,
      url: res.url || url,
      contentType,
      bodyLength,
      bodyPreview,
      looksLikeHtml,
      htmlTitle,
    };

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
