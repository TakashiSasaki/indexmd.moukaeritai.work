# Visual Analysis Schema (Experimental)

## Overview

The Visual Analysis Schema (`visual-analysis.v0.2.0-draft.1`) is an experimental schema designed for "visual indexing metadata extraction". This is fundamentally different from standard document summarization. The goal is to accurately classify visual data (such as landscapes, products, documents, and screenshots) and extract meaningful elements and readable text for indexing.

## What's new in v0.2.0-draft.1
- **sceneContext**: Added to `visualInfo` to capture overall environmental factors (indoor/outdoor, weather, lighting, cover).
- **stateContext**: Added to each `visibleElement` to capture object condition, containment, usage, placement, and interaction.
- **Natural Language Descriptions**: Both contexts allow for `description` text to handle nuances that don't fit strict enums.
- **Context Normalization**: If `sceneContext` or `stateContext` only contains "unknown" enums and lacks descriptive text, the normalizer will automatically remove the context to reduce noise.

*Note: Precision bounding boxes, object relationship graphs, complex OCR structural extraction (block/line/word), and detailed receipt/screenshot schemas are reserved for future work.*

## Why `visibleElements` Instead of `visibleObjects`?
We specifically use `visibleElements` rather than `visibleObjects`. This distinction is crucial because many images (like landscapes) contain scene components that are not strictly "objects" (e.g., sky, terrain, water bodies, weather phenomena). The term "elements" is more inclusive of both discrete objects and continuous scene components.

## Data Structure

### `visualInfo.imageKind`
A controlled vocabulary defining the type of image.
- **Valid Kinds**: `landscapePhoto`, `naturalPhoto`, `productPhoto`, `packageImage`, `documentPhoto`, `receiptPhoto`, `screenshot`, `diagram`, `chartOrTable`, `handwrittenNote`, `whiteboardPhoto`, `mixed`, `unknown`.
- **Confidence**: `imageKindConfidence` (0.0 to 1.0) must be provided.

### `visualInfo.visibleElements[].category`
A controlled vocabulary for elements detected in the scene.
- **Human/Living**: `person`, `animal`, `plant`, `food`
- **Utility/Manufactured**: `product`, `productPackage`, `document`, `building`, `vehicle`, `furniture`, `container`, `tool`, `clothing`, `symbol`
- **Digital**: `screen`, `uiElement`
- **Natural/Scenic**: `landscapeElement`, `weatherOrSky`, `waterBody`, `terrain`, `roadOrPath`
- **Text/Structural**: `signage`, `textRegion`, `chart`, `table`
- **Fallback**: `unknown`
- **Constraints**: Each element must have a `label`, `category`, and `confidence` (0.0 to 1.0). 
- **Optional Attributes**: 
    - `primary`: Boolean indicating if this is the focal point.
    - `count`: Number of items.
    - `attributes`: Array of strings describing properties (e.g., colors, textures).
    - `evidence`: Text explaining why the model made this classification.
    - `locationHint`: Description of where the element is in the image (e.g., "top-left", "center background").

### `visualInfo.visibleText`
For extracting readable text present in the image.
- **Properties**: `text`, `confidence` (0.0 to 1.0), `language` (ISO 639-1).
- **Optional**: `locationHint` for spatial context of the text region.
- **Usage**: Critical for document photos, receipts, screenshots, and signage.

## Specific Image Guidelines

- **Landscapes:** Prioritizes extracting landscape elements (sky, mountains, water, vegetation, weather).
- **Product Photos:** Prioritizes the product itself, packaging, visible brand text, and background objects.
- **Document Photos & Handwriting:** Prioritizes visible text extraction, document layouts, stamps, signatures, tables, and QR codes.
- **Screenshots:** Prioritizes UI elements, visible messages, buttons, tabs, and error states.

## Relationship to Summary Analysis
Visual Information is treated as an independent indexing channel compared to the `Summary Analysis` schema. The visual schema does not use the extensive document-centric metadata of Summary Analysis (e.g., document kind, parties, monetary amounts).

## Consistency Guidelines (v0.2.1-rc.1)

To improve output reliability and consistency between fields, the following rules are enforced by prompts and normalized:

- **Scene Context Strictness**: `sceneContext` is optional. For isolated product photos, close-up scans, screenshots, or images with no discernible background environment, `sceneContext` should be omitted. The normalizer automatically removes weak or over-inferred `sceneContext` (e.g., guessing "indoor" just because an object has a white background).
- **Visible Text Evidence**: Any readable text in the image must be placed in `visibleText`. If short text (e.g., alphanumeric codes, short words) is used as an indexing keyword or mentioned in the summary, it should correspond to an entry in `visibleText` (unless noted in `uncertainties`). Cross-field consistency checks emit warnings if this is violated.
- **Visual Attributes**: When descriptions or captions mention clear visual properties (such as color, material, shape, or condition like "blue wooden pencil"), these properties must be explicitly listed in `visibleElements[].attributes`.

## Current Experimental Status
This schema is currently in `v0.2.1-rc.1`. It operates exclusively in the "画像解析実験" (Image Experiment) tab to ensure it does not destabilize the existing `Summary Analysis v1.2.0-draft.2` flow. No visual data or raw image bytes are persisted in this phase.

## Visual Analysis Experiment Provenance (analysisRun)

To maintain tracking of how visual analyses are generated, the response includes an `analysisRun` provenance metadata object. 

**Important Principles:**
- `visualAnalysis` ONLY contains the structured results concerning the image content.
- `analysisRun` represents the execution conditions (model name, parameters, schema version, and prompt version).
- Generation parameters (temperature, topK, topP) are currently recorded as fixed constants and are NOT modifiable from the UI.
- `analysisRun` is treated as a top-level property of the API response, independent from the core `visualAnalysis` object.
- Legacy top-level response properties (e.g., `usedModelName`, `providerFamily`) are retained for backwards compatibility, but `analysisRun` is the canonical source of provenance data.

## Testing with Public Samples (Matrix Calibration)
The schema is validated against a curated **Public Visual Sample Matrix**. This covers landscapes, people, objects, and synthetic documents to ensure the model responds with well-formed `visibleElements` and `visibleText` arrays across diverse input types.

**Public Sample Matrix Calibration:**
- Expected metadata for public samples is used for regression evaluation, not strict schema validation.
- `expectedVisibleText` focuses on short, important text visible in the image to verify OCR extraction.
- We support `expectedElementCategoryAlternatives` and `expectedVisibleElementLabelAliases` to handle vocabulary coarseness and model expression variations.
- Expected comparison results (Exact, Acceptable, Diverged) act as a secondary quality check separated from the core `qualityGate`.
