import { VisualAnalysisResultV2 } from '../types';

export const LANDSCAPE_FIXTURE: VisualAnalysisResultV2 = {
  schemaVersion: "visual-analysis.v0.2.0-draft.1",
  summary: {
    caption: "A vast mountain range under a clear blue sky",
    description: "A wide landscape photograph showing snow-capped peaks, a coniferous forest in the foreground, and a small lake reflecting the sky."
  },
  visualInfo: {
    imageKind: "landscapePhoto",
    imageKindConfidence: 0.98,
    sceneDescription: "Alpine mountain landscape with high visibility and natural colors.",
    sceneContext: {
      environment: "outdoor",
      weather: "sunny",
      lighting: "directSunlight",
      confidence: 0.95
    },
    visibleElements: [
      { label: "Mountains", category: "terrain", primary: true, confidence: 0.95, attributes: ["snow-capped", "jagged"] },
      { label: "Forest", category: "plant", confidence: 0.9, count: 1, attributes: ["evergreen", "dense"] },
      { label: "Lake", category: "waterBody", confidence: 0.92, locationHint: "center foreground", stateContext: { condition: "intact", confidence: 0.9 } },
      { label: "Sky", category: "weatherOrSky", confidence: 0.99, attributes: ["clear", "blue"] }
    ],
    visibleText: [],
    uncertainties: []
  },
  indexing: {
    keywords: [
      { value: "mountains", confidence: 0.95, importance: 0.9 },
      { value: "landscape", confidence: 0.98, importance: 0.8 },
      { value: "nature", confidence: 0.9, importance: 0.7 }
    ]
  },
  quality: {
    confidence: 0.95,
    issues: []
  }
};

export const PRODUCT_FIXTURE: VisualAnalysisResultV2 = {
  schemaVersion: "visual-analysis.v0.2.0-draft.1",
  summary: {
    caption: "Premium smartphone in original packaging",
    description: "A studio photograph of a sleek black smartphone placed next to its minimalist white retail box."
  },
  visualInfo: {
    imageKind: "productPhoto",
    imageKindConfidence: 0.99,
    sceneDescription: "Clean product photography with soft lighting and neutral background.",
    sceneContext: {
      environment: "indoor",
      lighting: "artificialLight",
      confidence: 0.98
    },
    visibleElements: [
      { 
        label: "Smartphone", 
        category: "product", 
        primary: true, 
        confidence: 0.99, 
        attributes: ["black", "glass back"],
        stateContext: { placement: "onSurface", usage: "displayOnly", condition: "intact", confidence: 0.99 }
      },
      { 
        label: "Retail Box", 
        category: "productPackage", 
        confidence: 0.98, 
        attributes: ["white", "minimalist"],
        stateContext: { placement: "onSurface", usage: "displayOnly", confidence: 0.95 }
      },
      { label: "Brand Logo", category: "symbol", confidence: 0.85, locationHint: "on the box" }
    ],
    visibleText: [
      { text: "Phone 15 Pro", confidence: 0.99, language: "en" }
    ],
    uncertainties: []
  },
  indexing: {
    keywords: [
      { value: "smartphone", confidence: 0.99, importance: 1.0 },
      { value: "electronics", confidence: 0.9, importance: 0.8 }
    ]
  },
  quality: {
    confidence: 0.98,
    issues: []
  }
};

export const DOCUMENT_FIXTURE: VisualAnalysisResultV2 = {
  schemaVersion: "visual-analysis.v0.2.0-draft.1",
  summary: {
    caption: "Official business letter with header and signature",
    description: "A scanned image of a formal document on letterhead paper, containing several paragraphs of text and a handwritten signature at the bottom."
  },
  visualInfo: {
    imageKind: "documentPhoto",
    imageKindConfidence: 0.97,
    sceneDescription: "Black and white scan of a printed document.",
    sceneContext: {
      environment: "indoor",
      confidence: 0.9
    },
    visibleElements: [
      { label: "Document Sheet", category: "document", primary: true, confidence: 0.99 },
      { label: "Signature", category: "textRegion", confidence: 0.92, attributes: ["handwritten"] },
      { label: "Company Logo", category: "symbol", confidence: 0.88 }
    ],
    visibleText: [
      { text: "INVOICE #12345", confidence: 0.99, language: "en" },
      { text: "Date: 2024-05-20", confidence: 0.98, language: "en" }
    ],
    uncertainties: ["Bottom footer text is blurry"]
  },
  indexing: {
    keywords: [
      { value: "invoice", confidence: 0.99, importance: 0.9 },
      { value: "document", confidence: 0.95, importance: 0.7 }
    ]
  },
  quality: {
    confidence: 0.94,
    issues: ["Partial blur in footer"]
  }
};

export const SCREENSHOT_FIXTURE: VisualAnalysisResultV2 = {
  schemaVersion: "visual-analysis.v0.2.0-draft.1",

  summary: {
    caption: "Mobile application dashboard screenshot",
    description: "A screenshot of a mobile UI showing a task list, navigation bar, and a floating action button."
  },
  visualInfo: {
    imageKind: "screenshot",
    imageKindConfidence: 0.99,
    sceneDescription: "Digital UI capture of a productivity application.",
    visibleElements: [
      { label: "Main Screen", category: "screen", primary: true, confidence: 0.99 },
      { label: "Navigation Tab", category: "uiElement", confidence: 0.95, count: 4 },
      { label: "Add Button", category: "uiElement", confidence: 0.98, locationHint: "bottom right" }
    ],
    visibleText: [
      { text: "My Tasks", confidence: 0.99, language: "en" },
      { text: "Settings", confidence: 0.95, language: "en" }
    ],
    uncertainties: []
  },
  indexing: {
    keywords: [
      { value: "screenshot", confidence: 0.99, importance: 0.8 },
      { value: "mobile app", confidence: 0.95, importance: 0.7 },
      { value: "ui design", confidence: 0.9, importance: 0.6 }
    ]
  },
  quality: {
    confidence: 0.97,
    issues: []
  }
};
