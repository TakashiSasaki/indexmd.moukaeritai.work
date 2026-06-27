import { IMAGE_KINDS, VISIBLE_ELEMENT_CATEGORIES } from './vocabularies';

export const VISUAL_ANALYSIS_PROMPT_VERSION = "visual-analysis-prompt.v0.2.1-rc.1";
export const VISUAL_ANALYSIS_SYSTEM_INSTRUCTION_VERSION = "visual-analysis-system.v0.2.1-rc.1";

export function buildVisualAnalysisSystemInstruction(): string {
  return `You are an expert visual indexing and metadata extraction assistant.
Your task is to analyze an image (landscape photo, product photo, document photo, screenshot, diagram, chart, handwritten note, or mixed) and extract visual indexing metadata.
This is not an ordinary document summarization task. Focus on visible elements, scene descriptions, and extractable text.

Return a valid JSON object matching the requested schema. Do NOT wrap in markdown blocks. Do NOT return empty "{}".
Use the exact controlled vocabulary values provided.`;
}

export function buildVisualAnalysisTaskPrompt(isPromptedJson: boolean = false): string {
  let prompt = `Analyze the provided image and extract visual metadata.
You must always classify the "imageKind" and enumerate "visibleElements".

### Guidelines by Image Kind:
- Landscape Photo: List scene elements such as sky, mountains, water, vegetation, roads, buildings, weather.
- Document Photo: Prioritize visible text, document layout, stamps, signatures, QR codes, tables.
- Screenshot: Prioritize UI elements, visible messages, buttons, tabs, error states.
- Product/Package Photo: Prioritize product, package, labels, visible brand text, background objects.

### Extracting Visible Text:
- Extract readable text into "visibleText".
- Any readable text visible in the image must be placed in "visibleText", even if it is also useful as a keyword.
- Do not mention visible text such as labels, marks, UI text, receipt totals, or short inscriptions in summary/description/keywords unless it is also represented in "visibleText", unless it is explicitly unreadable and listed in "uncertainties".

### Visible Elements & State Context:
- Use "visibleElements" for objects AND scene components (like sky, terrain).
- Provide a clear label, category, and confidence.
- Put clear visual properties such as color, material, shape, texture, visible condition, and obvious state into "visibleElements[].attributes".
- Do not leave attributes empty when the summary/description mentions clear visual attributes of an element.
- Use "stateContext" within visible elements to describe how objects are situated (e.g., containment, placement, usage, interaction, condition).
- ONLY include "stateContext" if you can determine at least one useful attribute or description. Do not include an empty stateContext full of "unknown".
- Use "unknown" for individual fields only when other fields in the context are useful.

### Scene Context (Optional):
- ONLY populate "sceneContext" if the image provides enough context to determine environmental factors (indoor/outdoor, weather, lighting, etc.).
- Do not guess the scene for close-up document scans, screenshots, or isolated product images with no background.
- Do not output a sceneContext filled only with "unknown".

### People Safety Guidelines:
- If the image contains people, do not identify people.
- Do not infer real names, identity, ethnicity, nationality, religion, health status, emotion, socioeconomic status, or other sensitive attributes.
- Describe only visible non-sensitive elements such as person count, clothing, pose, activity context, and surrounding objects.
- Do not classify a real person as a public figure or named individual.
- For public sample people images, focus on visual indexing metadata only.

### Uncertainties:
- Do not overclaim. If unsure about an element or text, list it under uncertainties.
`;

  if (isPromptedJson) {
    prompt += `\n### JSON Output Structure
You MUST output ONLY a valid JSON object.
Root keys must be:
- "schemaVersion": "visual-analysis.v0.2.0-draft.1"
- "summary": { "caption": "string", "description": "string" }
- "visualInfo": { "imageKind": "string", "imageKindConfidence": number, "sceneDescription": "string", "sceneContext": { "environment": "indoor|outdoor|unknown", "lighting": "string" }, "visibleElements": [{ "label": "string", "category": "string", "confidence": number, "attributes": ["string"], "stateContext": { "placement": "string", "usage": "string" } }], "visibleText": [...], "uncertainties": ["string"] }
- "indexing": { "keywords": [{ "value": "string", "confidence": number, "importance": number }] }
- "quality": { "confidence": number, "issues": ["string"] }

"sceneContext" is optional; omit it for isolated product photos, screenshots, scans, close-up documents, or images with no visible surrounding environment.
"stateContext" is optional; include it only when containment/placement/usage/condition/interaction is visually supported.

"imageKind" MUST be one of: ${IMAGE_KINDS.join(", ")}.
"visibleElements[].category" MUST be one of: ${VISIBLE_ELEMENT_CATEGORIES.join(", ")}.
`;
  }
  return prompt;
}
