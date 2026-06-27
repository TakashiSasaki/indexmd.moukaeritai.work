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
      
      if (Object.values(normalizedSc).every(v => v === undefined)) {
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
          stateContext = {
            containment: st.containment ? (STATE_CONTEXT_CONTAINMENTS.includes(st.containment) ? st.containment : "unknown") : undefined,
            exposure: st.exposure ? (STATE_CONTEXT_EXPOSURES.includes(st.exposure) ? st.exposure : "unknown") : undefined,
            placement: st.placement ? (STATE_CONTEXT_PLACEMENTS.includes(st.placement) ? st.placement : "unknown") : undefined,
            usage: st.usage ? (STATE_CONTEXT_USAGES.includes(st.usage) ? st.usage : "unknown") : undefined,
            interaction: st.interaction ? (STATE_CONTEXT_INTERACTIONS.includes(st.interaction) ? st.interaction : "unknown") : undefined,
            condition: st.condition ? (STATE_CONTEXT_CONDITIONS.includes(st.condition) ? st.condition : "unknown") : undefined,
            role: st.role ? trimStr(st.role) || undefined : undefined,
            description: st.description ? trimStr(st.description) || undefined : undefined,
            confidence: typeof st.confidence === 'number' ? clamp(st.confidence) : undefined
          };
          
          // Remove if completely empty
          if (Object.values(stateContext).every(v => v === undefined)) {
            stateContext = undefined;
          }
        }

        return {
          label: trimStr(el.label),
          category: validCat,
          primary: !!el.primary,
          count: typeof el.count === 'number' ? Math.max(0, el.count) : undefined,
          attributes: Array.isArray(el.attributes) ? el.attributes.map(trimStr).filter(s => s.length > 0) : [],
          stateContext,
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
