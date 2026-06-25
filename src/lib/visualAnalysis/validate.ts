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
    if (typeof result.summary.description !== 'string' || result.summary.description.trim() === '') {
      errors.push("Missing or empty summary.description");
    }
  }

  if (!result.visualInfo || typeof result.visualInfo !== 'object') {
    errors.push("Missing visualInfo object");
  } else {
    if (!IMAGE_KINDS.includes(result.visualInfo.imageKind)) {
      errors.push(`Invalid imageKind: ${result.visualInfo.imageKind}`);
    }
    
    if (typeof result.visualInfo.imageKindConfidence !== 'number' || result.visualInfo.imageKindConfidence < 0 || result.visualInfo.imageKindConfidence > 1) {
      errors.push("Invalid imageKindConfidence (must be 0-1)");
    }

    if (typeof result.visualInfo.sceneDescription !== 'string' || result.visualInfo.sceneDescription.trim() === '') {
      errors.push("Missing or empty sceneDescription");
    }

    if (!Array.isArray(result.visualInfo.visibleElements)) {
      errors.push("visibleElements must be an array");
    } else {
      for (let i = 0; i < result.visualInfo.visibleElements.length; i++) {
        const el = result.visualInfo.visibleElements[i];
        if (typeof el.label !== 'string' || el.label.trim() === '') {
          errors.push(`Visible element ${i} missing label`);
        }
        if (!VISIBLE_ELEMENT_CATEGORIES.includes(el.category)) {
          errors.push(`Invalid category for element ${i}: ${el.category}`);
        }
        if (typeof el.confidence !== 'number' || el.confidence < 0 || el.confidence > 1) {
          errors.push(`Invalid confidence for element ${i}`);
        }
      }
    }

    if (!Array.isArray(result.visualInfo.visibleText)) {
      errors.push("visibleText must be an array");
    } else {
      for (let i = 0; i < result.visualInfo.visibleText.length; i++) {
        const txt = result.visualInfo.visibleText[i];
        if (typeof txt.text !== 'string' || txt.text.trim() === '') {
          errors.push(`Visible text ${i} missing content`);
        }
        if (typeof txt.confidence !== 'number' || txt.confidence < 0 || txt.confidence > 1) {
          errors.push(`Invalid confidence for text ${i}`);
        }
      }
    }
  }

  if (!result.indexing || typeof result.indexing !== 'object') {
    errors.push("Missing indexing object");
  } else if (!Array.isArray(result.indexing.keywords)) {
    errors.push("keywords must be an array");
  } else {
    for (let i = 0; i < result.indexing.keywords.length; i++) {
      const kw = result.indexing.keywords[i];
      if (typeof kw.value !== 'string' || kw.value.trim() === '') {
        errors.push(`Keyword ${i} missing value`);
      }
      if (typeof kw.confidence !== 'number' || kw.confidence < 0 || kw.confidence > 1) {
        errors.push(`Invalid confidence for keyword ${i}`);
      }
      if (typeof kw.importance !== 'number' || kw.importance < 0 || kw.importance > 1) {
        errors.push(`Invalid importance for keyword ${i}`);
      }
    }
  }
  
  if (!result.quality || typeof result.quality !== 'object') {
    errors.push("Missing quality object");
  } else {
    if (typeof result.quality.confidence !== 'number' || result.quality.confidence < 0 || result.quality.confidence > 1) {
      errors.push("Invalid quality.confidence (must be 0-1)");
    }
    if (!Array.isArray(result.quality.issues)) {
      errors.push("quality.issues must be an array");
    }
  }

  return { isValid: errors.length === 0, errors };
}
