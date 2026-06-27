import { VisualAnalysisResultV1, VisualAnalysisResultV2 } from './types';
import { 
  IMAGE_KINDS, 
  VISIBLE_ELEMENT_CATEGORIES,
  SCENE_CONTEXT_ENVIRONMENTS,
  SCENE_CONTEXT_COVERS,
  SCENE_CONTEXT_WEATHERS,
  SCENE_CONTEXT_LIGHTINGS,
  SCENE_CONTEXT_ACCESSIBILITIES,
  SCENE_CONTEXT_ROADWAYS,
  STATE_CONTEXT_CONTAINMENTS,
  STATE_CONTEXT_EXPOSURES,
  STATE_CONTEXT_PLACEMENTS,
  STATE_CONTEXT_USAGES,
  STATE_CONTEXT_INTERACTIONS,
  STATE_CONTEXT_CONDITIONS
} from './vocabularies';

export function validateVisualAnalysis(result: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!result || typeof result !== 'object') {
    return { isValid: false, errors: ["Root must be an object"] };
  }

  if (result.schemaVersion !== "visual-analysis.v0.1.0-draft.1" && result.schemaVersion !== "visual-analysis.v0.2.0-draft.1") {
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

    if (result.visualInfo.sceneContext !== undefined) {
      if (typeof result.visualInfo.sceneContext !== 'object') {
        errors.push("sceneContext must be an object");
      } else {
        const sc = result.visualInfo.sceneContext;
        if (sc.environment !== undefined && !SCENE_CONTEXT_ENVIRONMENTS.includes(sc.environment)) errors.push(`Invalid sceneContext.environment: ${sc.environment}`);
        if (sc.cover !== undefined && !SCENE_CONTEXT_COVERS.includes(sc.cover)) errors.push(`Invalid sceneContext.cover: ${sc.cover}`);
        if (sc.weather !== undefined && !SCENE_CONTEXT_WEATHERS.includes(sc.weather)) errors.push(`Invalid sceneContext.weather: ${sc.weather}`);
        if (sc.lighting !== undefined && !SCENE_CONTEXT_LIGHTINGS.includes(sc.lighting)) errors.push(`Invalid sceneContext.lighting: ${sc.lighting}`);
        if (sc.accessibility !== undefined && !SCENE_CONTEXT_ACCESSIBILITIES.includes(sc.accessibility)) errors.push(`Invalid sceneContext.accessibility: ${sc.accessibility}`);
        if (sc.roadwayContext !== undefined && !SCENE_CONTEXT_ROADWAYS.includes(sc.roadwayContext)) errors.push(`Invalid sceneContext.roadwayContext: ${sc.roadwayContext}`);
        if (sc.confidence !== undefined && (typeof sc.confidence !== 'number' || sc.confidence < 0 || sc.confidence > 1)) errors.push("Invalid sceneContext.confidence (must be 0-1)");
      }
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
        
        if (el.stateContext !== undefined) {
          if (typeof el.stateContext !== 'object') {
            errors.push(`stateContext for element ${i} must be an object`);
          } else {
            const st = el.stateContext;
            if (st.containment !== undefined && !STATE_CONTEXT_CONTAINMENTS.includes(st.containment)) errors.push(`Invalid stateContext.containment for element ${i}: ${st.containment}`);
            if (st.exposure !== undefined && !STATE_CONTEXT_EXPOSURES.includes(st.exposure)) errors.push(`Invalid stateContext.exposure for element ${i}: ${st.exposure}`);
            if (st.placement !== undefined && !STATE_CONTEXT_PLACEMENTS.includes(st.placement)) errors.push(`Invalid stateContext.placement for element ${i}: ${st.placement}`);
            if (st.usage !== undefined && !STATE_CONTEXT_USAGES.includes(st.usage)) errors.push(`Invalid stateContext.usage for element ${i}: ${st.usage}`);
            if (st.interaction !== undefined && !STATE_CONTEXT_INTERACTIONS.includes(st.interaction)) errors.push(`Invalid stateContext.interaction for element ${i}: ${st.interaction}`);
            if (st.condition !== undefined && !STATE_CONTEXT_CONDITIONS.includes(st.condition)) errors.push(`Invalid stateContext.condition for element ${i}: ${st.condition}`);
            if (st.confidence !== undefined && (typeof st.confidence !== 'number' || st.confidence < 0 || st.confidence > 1)) errors.push(`Invalid stateContext.confidence for element ${i} (must be 0-1)`);
          }
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
