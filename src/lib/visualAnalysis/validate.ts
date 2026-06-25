import { VisualAnalysisResultV1 } from './types';
import { IMAGE_KINDS, VISIBLE_ELEMENT_CATEGORIES } from './vocabularies';

export function validateVisualAnalysis(result: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!result || typeof result !== 'object') {
    return { isValid: false, errors: ["Root must be an object"] };
  }

  if (result.schemaVersion !== "visual-analysis.v0.1.0-draft.1") {
    errors.push("Invalid or missing schemaVersion");
  }

  if (!result.summary || typeof result.summary !== 'object') {
    errors.push("Missing summary object");
  } else {
    if (typeof result.summary.caption !== 'string' || result.summary.caption.trim() === '') {
      errors.push("Missing or empty summary.caption");
    }
  }

  if (!result.visualInfo || typeof result.visualInfo !== 'object') {
    errors.push("Missing visualInfo object");
  } else {
    if (!IMAGE_KINDS.includes(result.visualInfo.imageKind)) {
      errors.push(`Invalid imageKind: ${result.visualInfo.imageKind}`);
    }
    
    if (typeof result.visualInfo.imageKindConfidence !== 'number' || result.visualInfo.imageKindConfidence < 0 || result.visualInfo.imageKindConfidence > 1) {
      errors.push("Invalid imageKindConfidence");
    }

    if (!Array.isArray(result.visualInfo.visibleElements)) {
      errors.push("visibleElements must be an array");
    } else {
      for (const el of result.visualInfo.visibleElements) {
        if (!VISIBLE_ELEMENT_CATEGORIES.includes(el.category)) {
          errors.push(`Invalid visibleElement category: ${el.category}`);
        }
      }
    }

    if (!Array.isArray(result.visualInfo.visibleText)) {
      errors.push("visibleText must be an array");
    }
  }
  
  if (!result.quality || typeof result.quality !== 'object') {
    errors.push("Missing quality object");
  } else if (typeof result.quality.confidence !== 'number' || result.quality.confidence < 0 || result.quality.confidence > 1) {
    errors.push("Invalid quality.confidence");
  }

  return { isValid: errors.length === 0, errors };
}
