import { VisualAnalysisResultV1 } from './types';

export type VisualQualityStatus = "valid" | "validLowQuality" | "invalid";

export interface VisualQualityReport {
  status: VisualQualityStatus;
  score: number;
  issues: { code: string; message: string; severity: "info" | "warning" | "blocking" }[];
  experimentalModel: boolean;
}

export function evaluateVisualAnalysisQuality(
  result: VisualAnalysisResultV1 | null, 
  context?: { modelName?: string; providerFamily?: string; effectiveStructuredExecutionMode?: string }
): VisualQualityReport {
  if (!result) {
    return { status: "invalid", score: 0, issues: [{ code: "NULL_RESULT", message: "Result is null", severity: "blocking" }], experimentalModel: false };
  }

  const issues: VisualQualityReport["issues"] = [];
  let score = 100;
  
  const isExperimental = context?.providerFamily !== "gemini" || context?.effectiveStructuredExecutionMode === "promptedJson";

  if (isExperimental) {
    score -= 10;
    issues.push({ code: "EXPERIMENTAL_MODEL", message: "Experimental model or prompted JSON mode used for visual analysis.", severity: "info" });
  }

  if (result.visualInfo?.imageKind === "unknown") {
    score -= 10;
    issues.push({ code: "UNKNOWN_KIND", message: "Image kind could not be determined.", severity: "warning" });
  }

  if (!result.visualInfo?.visibleElements || result.visualInfo.visibleElements.length === 0) {
    score -= 20;
    issues.push({ code: "NO_VISIBLE_ELEMENTS", message: "No visible elements detected.", severity: "warning" });
  }

  if (result.visualInfo?.imageKind === "documentPhoto" || result.visualInfo?.imageKind === "screenshot") {
    if (!result.visualInfo.visibleText || result.visualInfo.visibleText.length === 0) {
      score -= 20;
      issues.push({ code: "NO_VISIBLE_TEXT_IN_DOCUMENT", message: "Document/Screenshot image contains no extracted visible text.", severity: "warning" });
    }
  }
  
  if (result.visualInfo?.imageKind === "landscapePhoto") {
    const hasLandscapeElements = result.visualInfo?.visibleElements?.some(el => 
      ["landscapeElement", "weatherOrSky", "waterBody", "terrain"].includes(el.category)
    );
    if (!hasLandscapeElements) {
      score -= 15;
      issues.push({ code: "NO_LANDSCAPE_ELEMENTS", message: "Landscape photo lacks landscape elements.", severity: "warning" });
    }
  }

  if (result.quality?.confidence < 0.6) {
    score -= (0.6 - result.quality.confidence) * 100;
    issues.push({ code: "LOW_CONFIDENCE", message: "Low overall confidence reported by model.", severity: "warning" });
  }
  
  if (!result.summary?.caption || result.summary.caption.trim() === "") {
    issues.push({ code: "NO_CAPTION", message: "Missing caption.", severity: "blocking" });
    score -= 50;
  }

  let status: VisualQualityStatus = "valid";
  if (issues.some(iss => iss.severity === "blocking")) {
    status = "invalid";
  } else if (score < 80) {
    status = "validLowQuality";
  }

  return {
    status,
    score: Math.max(0, Math.round(score)),
    issues,
    experimentalModel: isExperimental
  };
}
