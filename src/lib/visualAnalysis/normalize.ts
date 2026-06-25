import { VisualAnalysisResultV1, VisibleElement, VisibleText } from './types';
import { IMAGE_KINDS, VISIBLE_ELEMENT_CATEGORIES, ImageKind, VisibleElementCategory } from './vocabularies';

export function normalizeVisualAnalysis(result: any): any {
  if (!result || typeof result !== 'object') return result;

  const normalized = { ...result };

  if (normalized.visualInfo) {
    if (normalized.visualInfo.imageKind) {
      if (!IMAGE_KINDS.includes(normalized.visualInfo.imageKind)) {
        normalized.visualInfo.imageKind = "unknown";
      }
    }

    if (Array.isArray(normalized.visualInfo.visibleElements)) {
      normalized.visualInfo.visibleElements = normalized.visualInfo.visibleElements.map((el: any) => {
        const cat = el.category;
        const validCat = VISIBLE_ELEMENT_CATEGORIES.includes(cat) ? cat : "unknown";
        return {
          ...el,
          category: validCat
        };
      });
    } else {
      normalized.visualInfo.visibleElements = [];
    }

    if (!Array.isArray(normalized.visualInfo.visibleText)) {
      normalized.visualInfo.visibleText = [];
    }

    if (!Array.isArray(normalized.visualInfo.uncertainties)) {
      normalized.visualInfo.uncertainties = [];
    }
  }

  if (normalized.indexing && !Array.isArray(normalized.indexing.keywords)) {
    normalized.indexing.keywords = [];
  }

  return normalized;
}
