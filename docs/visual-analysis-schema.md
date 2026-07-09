# Visual Analysis Schema (Experimental)

## Overview

The Visual Analysis Schema (`visual-analysis.v0.2.0-draft.1`) is an experimental schema designed for "visual indexing metadata extraction". This is fundamentally different from standard document summarization. The canonical schema is defined in the external data exchange contract directory at:
- **Contract Schema**: `contracts/schemas/visual-analysis/v0.2.0-draft.1/schema.json`

The goal is to accurately classify visual data (such as landscapes, products, documents, and screenshots) and extract meaningful elements and readable text for indexing.

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
- **Valid Kinds**: `landscapePhoto`, `naturalPhoto`, `productPhoto`, `packageImage`, `documentPhoto`, `receiptPhoto`, `screenshot`, `diagram`, `chartOrTable`, `handwrittenNote`, `whiteboardPhoto`, `mapImage`, `medicalImage`, `spacePhoto`, `foodPhoto`, `mixed`, `unknown`.
- **Confidence**: `imageKindConfidence` (0.0 to 1.0) must be provided.

### `visualInfo.visibleElements[].category`
A controlled vocabulary for elements detected in the scene.
- **Human/Living**: `person`, `animal`, `plant`, `food`
- **Utility/Manufactured**: `product`, `productPackage`, `document`, `building`, `vehicle`, `furniture`, `container`, `tool`, `clothing`, `symbol`
- **Digital**: `screen`, `uiElement`
- **Natural/Scenic**: `landscapeElement`, `weatherOrSky`, `waterBody`, `terrain`, `roadOrPath`
- **Text/Structural**: `signage`, `textRegion`, `chart`, `table`
- **Medical/Health**: `medical`, `bodyPart`
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

To maintain tracking of how visual analyses are generated, the response includes an `analysisRun` provenance metadata object nested inside the canonical `record` (`record.analysisRun`).

**Important Principles:**
- `visualAnalysis` ONLY contains the structured results concerning the image content.
- `analysisRun` represents the execution conditions (model name, parameters, schema version, and prompt version).
- Generation parameters (temperature, topK, topP) are currently recorded as fixed constants and are NOT modifiable from the UI.
- `analysisRun` is nested inside the canonical `ImageAnalysisRecord` object (`record.analysisRun`), maintaining a strict single-source-of-truth structure.
- Legacy duplicate top-level fields (e.g., `sampleMetadata`, `analysisRun`, `qualityStatus`, `qualityScore`, `qualityIssues`, `usedModelName`, `providerFamily`) and `responseRaw` have been completely removed from API responses, batch summary items, and reports. All UI components and report builders rely exclusively on the nested `record` object.

## Testing with Public Samples (Matrix Calibration)
The schema is validated against a curated **Public Visual Sample Matrix**. This covers landscapes, people, objects, and synthetic documents to ensure the model responds with well-formed `visibleElements` and `visibleText` arrays across diverse input types.

**Public Sample Matrix Calibration:**
- Expected metadata for public samples is used for regression evaluation, not strict schema validation.
- `expectedVisibleText` focuses on short, important text visible in the image to verify OCR extraction.
- We support `expectedElementCategoryAlternatives` and `expectedVisibleElementLabelAliases` to handle vocabulary coarseness and model expression variations.
- Expected comparison results (Exact, Acceptable, Diverged) act as a secondary quality check separated from the core `qualityGate`.

## Robust Execution RC (JSON Parsing & Recovery)
Prompted JSON models (such as Gemma) may occasionally return output that contains valid data but fails strict `JSON.parse()` due to markdown fencing or conversational prose surrounding the JSON object.

To improve reliability without losing execution provenance:
- **Local Recovery (Always On):** The system attempts direct parsing, followed by markdown fence stripping, and finally balanced JSON object extraction.
- **Diagnostics Logging:** All parse attempts, lengths, and truncated previews are logged in `parseDiagnostics`.
- **Parse Failure is Execution Failure:** A JSON parsing failure is caught *before* the schema `qualityGate` is run, returning an execution error (`failureKind: "jsonParseError"`). The raw full text is never persisted to database logs; only a truncated preview is kept.
- **Model Retry (Opt-in):** A fallback or repair retry is *not* implemented by default. However, users can opt-in to a single "same request" retry (`retryOnInvalidJson`). If enabled, and parsing fails, the same prompt and image are dispatched exactly once more. Fallback model retry and repair-prompting are explicitly out of scope for this milestone.

## Failure Taxonomy

Visual Analysis differentiates between structural failures and quality warnings:

- **`generationError`**: The model API call failed before returning any content. This can be caused by quota limits, authentication errors, provider outages, or unsupported image formats. Look at `generationDiagnostics` for status codes and retry history.
- **`jsonParseError`**: The model executed successfully and returned text, but the text could not be parsed as valid JSON (even after markdown extraction). Look at `parseDiagnostics` for the raw output preview.
- **Schema Validation Failure**: The JSON was parsed successfully, but the resulting object failed to validate against the Zod schema. (Typically handled as a system error in the current milestone).
- **Quality Warnings (`qualityIssues`)**: The schema was valid, but the content triggered domain-specific quality rules. This does not fail the execution (`success: true`), but provides warnings to the user.
    - `EXPERIMENTAL_MODEL`: The model used is known to be experimental or unsupported for production visual analysis, or is a non-Gemini provider.
    - `PROMPTED_JSON_MODE`: The execution relied on raw text generation with JSON instructions instead of native structured outputs.
    - `VISIBLE_TEXT_NOT_INDEXED`: Important visible text does not appear in the indexing keywords.
    - `VISIBLE_TEXT_PRESENT_BUT_NOT_KEYWORD`: Visible text is present but not in keywords (likely noise, info-only).

---

## 📈 Calibration & Evaluation Metrics

To enable rich evaluation and comparison reporting of model runs against expected visual metadata, the system implements the following additional fields and concepts:

### 1. `reviewStatus`
A calibrated evaluation metric calculated by comparing the model's detected elements against expected metadata. It provides an operational judgment of the run:
- **`pass`**: The detected image kind, element categories, labels, and visible text perfectly match the expected criteria.
- **`needsReview`**: The image kind is acceptable but diverged from the exact expected kind, or some expected element categories or labels are missing but crucial text is extracted.
- **`fail`**: Crucial expected visible text is missing entirely.

### 2. `counterConsistency`
A diagnostic metric built into reports to double-check that summarized metrics (like pass/warning/fail tallies) are mathematically consistent with the individual sample outcomes. It returns a nested object:
- **`expectedComparison`**: Compares declared comparison statuses against recomputed individual item statuses, verifying consistency.
- **`review`**: Compares declared review statuses against recomputed individual item review statuses, verifying consistency.

### 3. `acceptableImageKinds`
An array of alternative, acceptable image kind classifications defined in the expected metadata. If the model classifies the image as one of these acceptable alternatives, the image kind check is graded as `acceptable` rather than `diverged`, allowing `reviewStatus` to pass if all other criteria are met.

### 4. `Optional Expectations`
Additional metadata fields (e.g., `optionalVisibleText`, `optionalVisibleElementLabels`) representing visual components that may or may not be visible depending on lighting, focus, or resolution. Matching optional expectations generates matching notes but does not penalize the model if they are missed.

### 5. `textHeavyEvaluation`
An aggregation block used in batch summary reports to measure OCR extraction performance on text-heavy public samples. It tracks:
- **`itemsWithTextExpectation`**: Count of samples requiring visible text extraction.
- **`visibleTextCovered` & `textMissing`**: Total characters or tokens successfully matched vs missed.
- **`ratio`**: Overall visible text matching ratio across the batch.
- **`possibleResolutionLimitedCount`**: Count of items where visible text was missed and the model requested a low/medium resolution instead of `HIGH`, helping diagnose resolution bottlenecks.

---

## 📦 Analysis Bundle JSON Schema

The `Analysis Bundle` (`visualAnalysisPublicSampleBatchAnalysisBundle`) is the recommended single-file artifact for ChatGPT-assisted batch regression analysis. It aggregates high-level metrics, detailed failure taxonomies, and compact individual item metrics while omitting heavy raw payloads.

### Key Fields:
- **`reportKind`**: `"visualAnalysisPublicSampleBatchAnalysisBundle"`.
- **`analysisGuidance`**: Intended use guidelines, recommended first checks, and archival policies.
- **`counterConsistency`**: Recomputed vs declared verification metrics.
- **`failures`**: Embedded array of compact item metrics (`failures.items`) specifically representing runs where `success` is `false` or quality/review status is `invalid` / `fail`.
- **`items`**: Full collection of run records represented in an ultra-compact schema (omitting `responseRaw` and successful `bodyPreview`) to protect token windows.


### Historical Artifacts Note
Full/Summary/Diagnostic/Failures are no longer required for ordinary ChatGPT analysis.
Server-side report endpoint is `/api/visual/batch-jobs/:jobId/reports/analysis-bundle`.
Analysis Bundle is now represented in `contracts/schemas/public-visual-sample/v0.1.0/batch-analysis-bundle.schema.json`.
`responseRaw`/`requestPreview`/`rawOutputPreview` are excluded from Analysis Bundle.
