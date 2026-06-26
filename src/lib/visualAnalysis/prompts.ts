import { IMAGE_KINDS, VISIBLE_ELEMENT_CATEGORIES } from './vocabularies';

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
- If text is present but unreadable, note it in "uncertainties".

### Visible Elements:
- Use "visibleElements" for objects AND scene components (like sky, terrain).
- Provide a clear label, category, and confidence.

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
- "schemaVersion": "visual-analysis.v0.1.0-draft.1"
- "summary": { "caption": "string", "description": "string" }
- "visualInfo": { "imageKind": "string", "imageKindConfidence": number, "sceneDescription": "string", "visibleElements": [...], "visibleText": [...], "uncertainties": ["string"] }
- "indexing": { "keywords": [{ "value": "string", "confidence": number, "importance": number }] }
- "quality": { "confidence": number, "issues": ["string"] }

"imageKind" MUST be one of: ${IMAGE_KINDS.join(", ")}.
"visibleElements[].category" MUST be one of: ${VISIBLE_ELEMENT_CATEGORIES.join(", ")}.
`;
  }
  return prompt;
}
