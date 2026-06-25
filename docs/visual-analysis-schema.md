# Visual Analysis Schema (Experimental)

## Overview

The Visual Analysis Schema (`visual-analysis.v0.1.0-draft.1`) is an experimental schema designed for "visual indexing metadata extraction". This is fundamentally different from standard document summarization. The goal is to accurately classify visual data (such as landscapes, products, documents, and screenshots) and extract meaningful elements and readable text for indexing.

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
- **Constraints**: Each element must have a `label`, `category`, and `confidence` (0.0 to 1.0). `attributes` and `count` are optional.

### `visualInfo.visibleText`
For extracting readable text present in the image.
- **Properties**: `text`, `confidence` (0.0 to 1.0), `language` (ISO 639-1).
- **Usage**: Critical for document photos, receipts, screenshots, and signage.

## Specific Image Guidelines

- **Landscapes:** Prioritizes extracting landscape elements (sky, mountains, water, vegetation, weather).
- **Product Photos:** Prioritizes the product itself, packaging, visible brand text, and background objects.
- **Document Photos & Handwriting:** Prioritizes visible text extraction, document layouts, stamps, signatures, tables, and QR codes.
- **Screenshots:** Prioritizes UI elements, visible messages, buttons, tabs, and error states.

## Relationship to Summary Analysis
Visual Information is treated as an independent indexing channel compared to the `Summary Analysis` schema. The visual schema does not use the extensive document-centric metadata of Summary Analysis (e.g., document kind, parties, monetary amounts).

## Current Experimental Status
This schema is currently in `v0.1.0-draft.1`. It operates exclusively in the "画像解析実験" (Image Experiment) tab to ensure it does not destabilize the existing `Summary Analysis v1.2.0-draft.2` flow. No visual data or raw image bytes are persisted in this phase.
