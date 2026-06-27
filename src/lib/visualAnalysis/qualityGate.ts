import { VisualAnalysisResultV1, VisualAnalysisResultV2 } from './types';

export type VisualQualityStatus = "valid" | "validLowQuality" | "invalid";

export interface VisualQualityReport {
  status: VisualQualityStatus;
  score: number;
  issues: { code: string; message: string; severity: "info" | "warning" | "blocking" }[];
  experimentalModel: boolean;
}

export function evaluateVisualAnalysisQuality(
  result: VisualAnalysisResultV1 | VisualAnalysisResultV2 | null, 
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

  const vi = result.visualInfo;
  const elements = vi?.visibleElements || [];
  const text = vi?.visibleText || [];

  if (vi?.imageKind === "unknown") {
    score -= 15;
    issues.push({ code: "UNKNOWN_KIND", message: "Image kind is classified as unknown.", severity: "warning" });
  }

  // specific to V2
  if ('sceneContext' in vi && vi.sceneContext) {
    if (vi.sceneContext.confidence !== undefined && vi.sceneContext.confidence < 0.4) {
      score -= 5;
      issues.push({ code: "LOW_CONFIDENCE_SCENE_CONTEXT", message: "Scene context has low confidence.", severity: "info" });
    }
  }

  elements.forEach((el, index) => {
    if (el.stateContext && el.stateContext.confidence !== undefined && el.stateContext.confidence < 0.4) {
      score -= 2;
      issues.push({ code: "LOW_CONFIDENCE_STATE_CONTEXT", message: `Element ${index} (${el.label}) state context has low confidence.`, severity: "info" });
    }
  });

  // Specific kind vs category checks
  if (vi?.imageKind === "landscapePhoto" || vi?.imageKind === "naturalPhoto") {
    const hasLandscape = elements.some(el => 
      ['landscapeElement', 'weatherOrSky', 'waterBody', 'terrain', 'roadOrPath', 'plant', 'animal'].includes(el.category)
    );
    if (!hasLandscape) {
      score -= 20;
      issues.push({ code: "NO_LANDSCAPE_ELEMENTS", message: "Landscape photo lacks expected landscape/natural elements.", severity: "warning" });
    }
  }

  if (vi?.imageKind === "productPhoto" || vi?.imageKind === "packageImage") {
    const hasProduct = elements.some(el => ['product', 'productPackage'].includes(el.category));
    if (!hasProduct) {
      score -= 20;
      issues.push({ code: "NO_PRODUCT_ELEMENTS", message: "Product photo lacks product or package elements.", severity: "warning" });
    }
  }

  if (vi?.imageKind === "screenshot") {
    const hasUI = elements.some(el => ['screen', 'uiElement'].includes(el.category));
    if (!hasUI) {
      score -= 20;
      issues.push({ code: "NO_UI_ELEMENTS", message: "Screenshot lacks UI or screen elements.", severity: "warning" });
    }
  }

  if (vi?.imageKind === "chartOrTable" || vi?.imageKind === "diagram") {
    const hasVisualStructure = elements.some(el => ['chart', 'table', 'symbol'].includes(el.category));
    if (!hasVisualStructure) {
      score -= 15;
      issues.push({ code: "NO_STRUCTURAL_ELEMENTS", message: "Chart/Diagram lacks structural categories (chart, table, symbol).", severity: "warning" });
    }
  }

  if (["documentPhoto", "receiptPhoto", "handwrittenNote", "whiteboardPhoto"].includes(vi?.imageKind || "")) {
    const hasTextOrDoc = elements.some(el => ['document', 'textRegion', 'signage'].includes(el.category)) || text.length > 0;
    if (!hasTextOrDoc) {
      score -= 25;
      issues.push({ code: "NO_VISIBLE_TEXT_IN_DOCUMENT", message: "Document-like photo has no visible text or text regions.", severity: "warning" });
    }
  }

  if (elements.length > 0 && elements.every(el => el.confidence < 0.4)) {
    score -= 10;
    issues.push({ code: "LOW_CONFIDENCE_ELEMENTS", message: "All visible elements have low confidence.", severity: "warning" });
  }

  if (text.length > 0 && text.every(txt => txt.confidence < 0.4)) {
    score -= 10;
    issues.push({ code: "LOW_CONFIDENCE_TEXT", message: "All extracted text has low confidence.", severity: "warning" });
  }

  const caption = result.summary?.caption || "";
  const description = result.summary?.description || "";
  if (caption.trim() === "") {
    issues.push({ code: "NO_CAPTION", message: "Missing caption.", severity: "blocking" });
    score -= 50;
  } else if (caption.length < 10) {
    score -= 5;
    issues.push({ code: "SHORT_CAPTION", message: "Caption is very short.", severity: "info" });
  }

  if (description.trim() === "") {
    issues.push({ code: "NO_DESCRIPTION", message: "Missing description.", severity: "blocking" });
    score -= 50;
  }

  if (result.quality?.confidence < 0.6) {
    score -= (0.6 - result.quality.confidence) * 50;
    issues.push({ code: "LOW_OVERALL_CONFIDENCE", message: "Low overall confidence reported by model.", severity: "warning" });
  }

  const keywords = result.indexing?.keywords || [];
  if (keywords.length === 0) {
    score -= 5;
    issues.push({ code: "MISSING_KEYWORDS", message: "No indexing keywords generated.", severity: "info" });
  }

  // Cross-field consistency checks
  // A. Check if visible text seems to be missing
  if (text.length === 0) {
    const textLikeRegex = /^[A-Z0-9][A-Z0-9\-\$£€¥\.\,]{1,15}$/;
    const hasTextLikeKeyword = keywords.some(kw => textLikeRegex.test(kw.value));
    
    // Also check caption/description for obvious UI or label tokens (all caps)
    const hasTextLikeMention = textLikeRegex.test(caption) || textLikeRegex.test(description);

    if (hasTextLikeKeyword || hasTextLikeMention) {
      score -= 5;
      issues.push({ 
        code: "POSSIBLE_VISIBLE_TEXT_MISSING", 
        message: "Keywords or summary contain text-like tokens (e.g., alphanumeric codes, short uppercase words) but visibleText is empty.", 
        severity: "info" 
      });
    }
  }

  // B. Check if visible text is completely ignored by keywords (for short text)
  if (text.length > 0) {
    const allKeywordStr = keywords.map(k => k.value.toLowerCase()).join(' ');
    const unindexedText = text.filter(t => t.text.length < 20 && t.text.length > 1 && !allKeywordStr.includes(t.text.toLowerCase()));
    if (unindexedText.length > 0) {
      // Don't deduct score, just info
      issues.push({
        code: "VISIBLE_TEXT_NOT_INDEXED",
        message: "Some short visible text does not appear in indexing keywords.",
        severity: "info"
      });
    }
  }

  // C. Product attributes check
  if (vi?.imageKind === "productPhoto" || vi?.imageKind === "packageImage") {
    const hasEmptyAttributes = elements.some(el => (el.category === 'product' || el.category === 'productPackage') && (!el.attributes || el.attributes.length === 0));
    if (hasEmptyAttributes) {
      const attributeWords = ["blue", "red", "green", "yellow", "white", "black", "wooden", "metal", "plastic", "sharpened", "round", "rectangular", "damaged", "wet", "clean", "dirty", "glass", "paper"];
      const textToSearch = (caption + " " + description).toLowerCase();
      const mentionsAttribute = attributeWords.some(w => textToSearch.includes(w));
      
      if (mentionsAttribute) {
        score -= 2;
        issues.push({
          code: "POSSIBLE_ATTRIBUTES_MISSING",
          message: "Description mentions visual properties (e.g., color, material, shape) but product element attributes are empty.",
          severity: "info"
        });
      }
    }
  }

  let status: VisualQualityStatus = "valid";
  if (issues.some(iss => iss.severity === "blocking")) {
    status = "invalid";
  } else if (score < 75) {
    status = "validLowQuality";
  }

  return {
    status,
    score: Math.max(0, Math.round(score)),
    issues,
    experimentalModel: isExperimental
  };
}
