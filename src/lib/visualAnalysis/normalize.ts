import { VisualAnalysisResultV1, VisibleElement, VisibleText } from './types';
import { IMAGE_KINDS, VISIBLE_ELEMENT_CATEGORIES, ImageKind, VisibleElementCategory } from './vocabularies';

function clamp(val: any, min: number = 0, max: number = 1): number {
  if (typeof val !== 'number' || isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function trimStr(val: any): string {
  if (typeof val !== 'string') return "";
  return val.trim();
}

export function normalizeVisualAnalysis(result: any): any {
  if (!result || typeof result !== 'object') return result;

  const normalized = { ...result };

  // Set default schemaVersion if missing or invalid to ensure robustness
  normalized.schemaVersion = result.schemaVersion || "visual-analysis.v0.1.0-draft.1";

  // Summary
  if (!normalized.summary || typeof normalized.summary !== 'object') {
    normalized.summary = { caption: "", description: "" };
  } else {
    normalized.summary.caption = trimStr(normalized.summary.caption);
    normalized.summary.description = trimStr(normalized.summary.description);
  }

  // VisualInfo
  if (!normalized.visualInfo || typeof normalized.visualInfo !== 'object') {
    normalized.visualInfo = {
      imageKind: "unknown",
      imageKindConfidence: 0,
      sceneDescription: "",
      visibleElements: [],
      visibleText: [],
      uncertainties: []
    };
  } else {
    const vi = normalized.visualInfo;
    
    if (!vi.imageKind || !IMAGE_KINDS.includes(vi.imageKind)) {
      vi.imageKind = "unknown";
    }
    vi.imageKindConfidence = clamp(vi.imageKindConfidence);
    vi.sceneDescription = trimStr(vi.sceneDescription);

    if (Array.isArray(vi.visibleElements)) {
      vi.visibleElements = vi.visibleElements.map((el: any) => {
        if (!el || typeof el !== 'object') return null;
        const cat = el.category;
        const validCat = VISIBLE_ELEMENT_CATEGORIES.includes(cat) ? cat : "unknown";
        return {
          label: trimStr(el.label),
          category: validCat,
          primary: !!el.primary,
          count: typeof el.count === 'number' ? Math.max(0, el.count) : undefined,
          attributes: Array.isArray(el.attributes) ? el.attributes.map(trimStr).filter(s => s.length > 0) : [],
          confidence: clamp(el.confidence),
          evidence: trimStr(el.evidence) || undefined,
          locationHint: trimStr(el.locationHint) || undefined
        };
      }).filter((el: any) => el !== null && el.label.length > 0);
    } else {
      vi.visibleElements = [];
    }

    if (Array.isArray(vi.visibleText)) {
      vi.visibleText = vi.visibleText.map((txt: any) => {
        if (!txt || typeof txt !== 'object') return null;
        return {
          text: trimStr(txt.text),
          confidence: clamp(txt.confidence),
          locationHint: trimStr(txt.locationHint) || undefined,
          language: trimStr(txt.language) || undefined
        };
      }).filter((txt: any) => txt !== null && (txt.text.length > 0 || txt.confidence > 0));
    } else {
      vi.visibleText = [];
    }

    if (!Array.isArray(vi.uncertainties)) {
      vi.uncertainties = [];
    } else {
      vi.uncertainties = vi.uncertainties.map(trimStr).filter(s => s.length > 0);
    }
  }

  // Indexing
  if (!normalized.indexing || typeof normalized.indexing !== 'object') {
    normalized.indexing = { keywords: [] };
  } else if (!Array.isArray(normalized.indexing.keywords)) {
    normalized.indexing.keywords = [];
  } else {
    normalized.indexing.keywords = normalized.indexing.keywords.map((kw: any) => {
      if (!kw || typeof kw !== 'object') return null;
      return {
        value: trimStr(kw.value),
        confidence: clamp(kw.confidence),
        importance: clamp(kw.importance)
      };
    }).filter((kw: any) => kw !== null && kw.value.length > 0);
  }

  // Quality
  if (!normalized.quality || typeof normalized.quality !== 'object') {
    normalized.quality = { confidence: 0, issues: [] };
  } else {
    normalized.quality.confidence = clamp(normalized.quality.confidence);
    if (!Array.isArray(normalized.quality.issues)) {
      normalized.quality.issues = [];
    } else {
      normalized.quality.issues = normalized.quality.issues.map(trimStr).filter(s => s.length > 0);
    }
  }

  return normalized;
}
