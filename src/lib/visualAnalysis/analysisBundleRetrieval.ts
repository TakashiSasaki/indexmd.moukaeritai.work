export const SUPPORTED_ANALYSIS_BUNDLE_VERSIONS = ["0.1.0", "0.2.0"] as const;

export type AnalysisBundleRetrievalErrorKind =
  | "networkFailure" | "authenticationRequired" | "authorizationDenied" | "aiStudioCookieCheck"
  | "unexpectedHtmlResponse" | "malformedJson" | "unrelatedJson" | "unsupportedBundleVersion"
  | "invalidBundleStructure" | "jobIdMismatch" | "jobNotFound" | "serverFailure" | "unsafeRedirect";

export class AnalysisBundleRetrievalError extends Error {
  constructor(public kind: AnalysisBundleRetrievalErrorKind, message: string, public metadata: Record<string, unknown> = {}) {
    super(message);
    this.name = "AnalysisBundleRetrievalError";
  }
}

export interface ValidatedAnalysisBundle {
  bundle: any;
  jsonText: string;
  metadata: { status: number; contentType: string; redirected: boolean; finalPath: string; finalOrigin: string; schemaVersion: string; jobId: string };
}

function safeUrlParts(url: string): { origin: string; pathname: string } {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.href : "http://localhost");
    return { origin: u.origin, pathname: u.pathname };
  } catch {
    return { origin: "", pathname: "" };
  }
}

function isHtml(contentType: string, text: string) {
  const trimmed = text.slice(0, 256).trim().toLowerCase();
  return contentType.includes("text/html") || trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html") || trimmed.includes("<title>");
}

function isAiStudioCookieCheck(text: string) {
  const lower = text.slice(0, 4096).toLowerCase();
  return lower.includes("cookie check") || (lower.includes("google ai studio") && lower.includes("cookie"));
}

export function validateAnalysisBundleObject(bundle: any, requestedJobId: string) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new AnalysisBundleRetrievalError("unrelatedJson", "Response JSON is not an Analysis Bundle object.");
  }
  if (bundle.reportKind !== "visualAnalysisPublicSampleBatchAnalysisBundle") {
    throw new AnalysisBundleRetrievalError("unrelatedJson", "Response JSON is not a visual analysis bundle.");
  }
  const schemaVersion = bundle.bundleSchemaVersion;
  if (!SUPPORTED_ANALYSIS_BUNDLE_VERSIONS.includes(schemaVersion)) {
    throw new AnalysisBundleRetrievalError("unsupportedBundleVersion", "Unsupported Analysis Bundle schema version.", { schemaVersion });
  }
  if (!bundle.job || typeof bundle.job !== "object" || !Array.isArray(bundle.items) || typeof bundle.total !== "number") {
    throw new AnalysisBundleRetrievalError("invalidBundleStructure", "Analysis Bundle is missing required structural fields.", { schemaVersion });
  }
  if (bundle.job.jobId !== requestedJobId) {
    throw new AnalysisBundleRetrievalError("jobIdMismatch", "Analysis Bundle job ID does not match the requested job.", { requestedJobId, bundleJobId: bundle.job.jobId });
  }
  return { schemaVersion, jobId: bundle.job.jobId };
}

export async function fetchAndValidateAnalysisBundle(jobId: string, init?: RequestInit): Promise<ValidatedAnalysisBundle> {
  const endpoint = `/api/visual/batch-jobs/${encodeURIComponent(jobId)}/reports/analysis-bundle`;
  let response: Response;
  try {
    response = await fetch(endpoint, { credentials: "same-origin", redirect: "follow", ...init });
  } catch (e) {
    throw new AnalysisBundleRetrievalError("networkFailure", "Could not fetch the Analysis Bundle.");
  }
  const contentType = response.headers.get("content-type") || "";
  const final = safeUrlParts(response.url || endpoint);
  const expected = safeUrlParts(endpoint);
  const current = safeUrlParts(typeof window !== "undefined" ? window.location.href : endpoint);
  const expectedOrigin = expected.origin || current.origin;
  if (response.redirected && final.origin && expectedOrigin && final.origin !== expectedOrigin) {
    throw new AnalysisBundleRetrievalError("unsafeRedirect", "Analysis Bundle request redirected to an unsafe origin.", { status: response.status, finalOrigin: final.origin, finalPath: final.pathname });
  }
  if (response.redirected && final.pathname && !final.pathname.includes(`/api/visual/batch-jobs/${jobId}/reports/analysis-bundle`)) {
    throw new AnalysisBundleRetrievalError("unsafeRedirect", "Analysis Bundle request redirected away from the bundle endpoint.", { status: response.status, finalPath: final.pathname });
  }
  const text = await response.text();
  if (isAiStudioCookieCheck(text)) throw new AnalysisBundleRetrievalError("aiStudioCookieCheck", "Google AI Studio returned a cookie-check page instead of JSON.", { status: response.status });
  if (isHtml(contentType, text)) throw new AnalysisBundleRetrievalError("unexpectedHtmlResponse", "Server returned HTML instead of Analysis Bundle JSON.", { status: response.status });
  if (response.status === 401) throw new AnalysisBundleRetrievalError("authenticationRequired", "Authentication is required to retrieve this Analysis Bundle.", { status: response.status });
  if (response.status === 403) throw new AnalysisBundleRetrievalError("authorizationDenied", "You are not authorized to retrieve this Analysis Bundle.", { status: response.status });
  if (response.status === 404) throw new AnalysisBundleRetrievalError("jobNotFound", "Analysis Bundle job was not found.", { status: response.status });
  if (response.status >= 500) throw new AnalysisBundleRetrievalError("serverFailure", "Server failed while retrieving the Analysis Bundle.", { status: response.status });
  if (!response.ok) throw new AnalysisBundleRetrievalError("serverFailure", "Analysis Bundle request failed.", { status: response.status });
  let bundle: any;
  try { bundle = JSON.parse(text); } catch { throw new AnalysisBundleRetrievalError("malformedJson", "Analysis Bundle response was not valid JSON.", { status: response.status }); }
  const { schemaVersion, jobId: bundleJobId } = validateAnalysisBundleObject(bundle, jobId);
  return { bundle, jsonText: JSON.stringify(bundle, null, 2), metadata: { status: response.status, contentType, redirected: response.redirected, finalOrigin: final.origin, finalPath: final.pathname, schemaVersion, jobId: bundleJobId } };
}

export function formatAnalysisBundleRetrievalError(error: unknown): string {
  if (error instanceof AnalysisBundleRetrievalError) return `${error.message} (${error.kind})`;
  return "Could not retrieve a valid Analysis Bundle.";
}

export function sanitizedAnalysisBundleFilename(jobId: string) {
  return `visual-analysis-analysis-bundle-${jobId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`;
}
