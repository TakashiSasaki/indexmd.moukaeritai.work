import { VisualAnalysisResultV1, VisualAnalysisResultV2, VisibleElement, VisibleText } from './types';
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
  STATE_CONTEXT_CONDITIONS,
  ImageKind, 
  VisibleElementCategory 
} from './vocabularies';

function clamp(val: any, min: number = 0, max: number = 1): number {
  if (typeof val !== 'number' || isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function trimStr(val: any): string {
  if (typeof val !== 'string') return "";
  return val.trim();
}

function isWeakSceneContextForImageKind(imageKind: string, sc: any): boolean {
  const isolatedKinds = ["productPhoto", "packageImage", "documentPhoto", "receiptPhoto", "handwrittenNote", "screenshot", "chartOrTable", "diagram"];
  if (!isolatedKinds.includes(imageKind)) return false;

  const hasPlaceType = !!sc.placeType;
  const hasDesc = !!sc.description;
  const hasWeather = sc.weather && sc.weather !== 'unknown';
  const hasOutdoor = sc.environment === 'outdoor' || sc.environment === 'semiOutdoor' || sc.environment === 'underwater';
  const hasRoadway = sc.roadwayContext && sc.roadwayContext !== 'unknown';
  const hasCover = sc.cover && sc.cover !== 'unknown';
  const hasStrongLighting = sc.lighting && sc.lighting !== 'unknown';

  if (hasPlaceType || hasDesc || hasWeather || hasOutdoor || hasRoadway || hasCover || hasStrongLighting) {
    return false;
  }
  
  return true;
}

export function normalizeVisualAnalysis(result: any): any {
  if (!result || typeof result !== 'object') return result;

  const normalized = { ...result };

  // Set default schemaVersion if missing or invalid to ensure robustness
  normalized.schemaVersion = result.schemaVersion || "visual-analysis.v0.2.0-draft.1";

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

    if (vi.sceneContext && typeof vi.sceneContext === 'object') {
      const sc = vi.sceneContext;
      const normalizedSc = {
        environment: sc.environment ? (SCENE_CONTEXT_ENVIRONMENTS.includes(sc.environment) ? sc.environment : "unknown") : undefined,
        cover: sc.cover ? (SCENE_CONTEXT_COVERS.includes(sc.cover) ? sc.cover : "unknown") : undefined,
        weather: sc.weather ? (SCENE_CONTEXT_WEATHERS.includes(sc.weather) ? sc.weather : "unknown") : undefined,
        lighting: sc.lighting ? (SCENE_CONTEXT_LIGHTINGS.includes(sc.lighting) ? sc.lighting : "unknown") : undefined,
        accessibility: sc.accessibility ? (SCENE_CONTEXT_ACCESSIBILITIES.includes(sc.accessibility) ? sc.accessibility : "unknown") : undefined,
        roadwayContext: sc.roadwayContext ? (SCENE_CONTEXT_ROADWAYS.includes(sc.roadwayContext) ? sc.roadwayContext : "unknown") : undefined,
        placeType: sc.placeType ? trimStr(sc.placeType) || undefined : undefined,
        description: sc.description ? trimStr(sc.description) || undefined : undefined,
        confidence: typeof sc.confidence === 'number' ? clamp(sc.confidence) : undefined
      };
      
      const hasUsefulEnum = ['environment', 'cover', 'weather', 'lighting', 'accessibility', 'roadwayContext']
        .some(k => (normalizedSc as any)[k] !== undefined && (normalizedSc as any)[k] !== 'unknown');
      const hasText = !!normalizedSc.placeType || !!normalizedSc.description;
      
      const isWeak = isWeakSceneContextForImageKind(vi.imageKind, normalizedSc);
      
      if ((!hasUsefulEnum && !hasText) || isWeak) {
        delete vi.sceneContext;
      } else {
        vi.sceneContext = normalizedSc;
      }
    } else {
      delete vi.sceneContext;
    }

    if (Array.isArray(vi.visibleElements)) {
      vi.visibleElements = vi.visibleElements.map((el: any) => {
        if (!el || typeof el !== 'object') return null;
        const cat = el.category;
        const validCat = VISIBLE_ELEMENT_CATEGORIES.includes(cat) ? cat : "unknown";
        
        let stateContext = undefined;
        if (el.stateContext && typeof el.stateContext === 'object') {
          const st = el.stateContext;
          let description = st.description ? trimStr(st.description) : "";
          
          const processEnum = (val: any, validValues: readonly string[], fieldName: string) => {
            if (!val || typeof val !== 'string') return undefined;
            if (validValues.includes(val as any)) return val;
            const trimmed = trimStr(val);
            if (trimmed && trimmed !== 'unknown') {
              if (description) {
                description += `; ${fieldName}: ${trimmed}`;
              } else {
                description = `${fieldName}: ${trimmed}`;
              }
            }
            return undefined; // Or "unknown", but undefined is cleaner if it's invalid
          };

          const containment = processEnum(st.containment, STATE_CONTEXT_CONTAINMENTS, 'containment');
          const exposure = processEnum(st.exposure, STATE_CONTEXT_EXPOSURES, 'exposure');
          const placement = processEnum(st.placement, STATE_CONTEXT_PLACEMENTS, 'placement');
          const usage = processEnum(st.usage, STATE_CONTEXT_USAGES, 'usage');
          const interaction = processEnum(st.interaction, STATE_CONTEXT_INTERACTIONS, 'interaction');
          const condition = processEnum(st.condition, STATE_CONTEXT_CONDITIONS, 'condition');

          stateContext = {
            containment,
            exposure,
            placement,
            usage,
            interaction,
            condition,
            role: st.role ? trimStr(st.role) || undefined : undefined,
            description: description || undefined,
            confidence: typeof st.confidence === 'number' ? clamp(st.confidence) : undefined
          };
          
          const hasUsefulEnum = ['containment', 'exposure', 'placement', 'usage', 'interaction', 'condition']
            .some(k => (stateContext as any)[k] !== undefined && (stateContext as any)[k] !== 'unknown');
          const hasText = !!stateContext.role || !!stateContext.description;
          
          // Remove if completely empty or unknown-only
          if (!hasUsefulEnum && !hasText) {
            stateContext = undefined;
          }
        }

        const normalizedEl: any = {
          label: trimStr(el.label),
          category: validCat,
          count: typeof el.count === 'number' ? Math.max(0, el.count) : undefined,
          attributes: Array.isArray(el.attributes) ? el.attributes.map(trimStr).filter((s: string) => s.length > 0) : [],
          stateContext,
          confidence: clamp(el.confidence),
          evidence: trimStr(el.evidence) || undefined,
          locationHint: trimStr(el.locationHint) || undefined
        };
        
        if (el.primary === true) {
          normalizedEl.primary = true;
        }
        
        return normalizedEl;
      }).filter((el: any) => el !== null && el.label.length > 0);
    } else {
      vi.visibleElements = [];
    }

    if (Array.isArray(vi.visibleText)) {
      vi.visibleText = vi.visibleText.map((txt: any) => {
        if (!txt) return null;
        if (typeof txt === 'string') {
          const text = trimStr(txt);
          return text ? { text, confidence: 1 } : null;
        }
        if (typeof txt !== 'object') return null;
        return {
          text: trimStr(txt.text),
          confidence: typeof txt.confidence === 'number' ? clamp(txt.confidence) : 1,
          locationHint: trimStr(txt.locationHint) || undefined,
          language: trimStr(txt.language) || undefined
        };
      }).filter((txt: any) => txt !== null && txt.text.length > 0);
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
