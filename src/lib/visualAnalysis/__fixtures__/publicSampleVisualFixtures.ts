import { VisualAnalysisResultV1 } from '../types';

export const landscapeFixture: VisualAnalysisResultV1 = {
  schemaVersion: "visual-analysis.v0.1.0-draft.1",
  summary: { caption: "A valley", description: "Yosemite valley" },
  visualInfo: {
    imageKind: "landscapePhoto",
    imageKindConfidence: 0.99,
    sceneDescription: "A beautiful valley with mountains and trees",
    visibleElements: [
      { label: "sky", category: "weatherOrSky", confidence: 0.99 },
      { label: "mountain", category: "terrain", confidence: 0.95 },
      { label: "trees", category: "plant", confidence: 0.9 }
    ],
    visibleText: [],
    uncertainties: []
  },
  indexing: { keywords: [{ value: "valley", confidence: 0.9, importance: 0.8 }] },
  quality: { confidence: 0.9, issues: [] }
};

export const receiptFixture: VisualAnalysisResultV1 = {
  schemaVersion: "visual-analysis.v0.1.0-draft.1",
  summary: { caption: "Receipt", description: "Synthetic receipt" },
  visualInfo: {
    imageKind: "receiptPhoto",
    imageKindConfidence: 0.99,
    sceneDescription: "A printed receipt from Synthetic Market",
    visibleElements: [
      { label: "receipt", category: "document", confidence: 0.99 },
      { label: "prices", category: "textRegion", confidence: 0.95 }
    ],
    visibleText: [
      { text: "SYNTHETIC MARKET", confidence: 0.99 },
      { text: "TOTAL $7.37", confidence: 0.99 }
    ],
    uncertainties: []
  },
  indexing: { keywords: [{ value: "receipt", confidence: 0.9, importance: 0.8 }] },
  quality: { confidence: 0.9, issues: [] }
};

export const documentNoTextFixture: VisualAnalysisResultV1 = {
  schemaVersion: "visual-analysis.v0.1.0-draft.1",
  summary: { caption: "Blank document", description: "A blank document" },
  visualInfo: {
    imageKind: "documentPhoto",
    imageKindConfidence: 0.99,
    sceneDescription: "A blank white document",
    visibleElements: [
      { label: "paper", category: "document", confidence: 0.99 }
    ],
    visibleText: [],
    uncertainties: []
  },
  indexing: { keywords: [{ value: "document", confidence: 0.9, importance: 0.8 }] },
  quality: { confidence: 0.5, issues: ["Document image with no extracted text"] }
};
