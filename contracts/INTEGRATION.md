# Data Exchange Contract Integration Guide

This integration guide provides external application developers, downstream consumers, and integration agents with best practices for consuming versioned JSON Schemas, API payloads, and vocabularies from this repository.

---

## 🗺️ Key Integration Principles

### 1. Bind to Explicit Version Paths
External consumers **MUST** always reference schemas and examples using explicit semantic version paths (e.g., `contracts/schemas/summary-analysis/v1.2.0-draft.2/schema.json` or its stable `$id` URL). 
* Do not attempt to bind to generic, mutable paths.
* There are no automated "latest" endpoints, preventing unexpected upstream updates from breaking your systems.

### 2. Never Import from `src/` or `/schemas`
* Code under `/src/` contains transient, volatile runtime implementations (such as fallback recovery logic and database connectors) subject to continuous change.
* Files in `/schemas` are internal runtime compatibility mirrors. Do not import or copy from them.
* Only import schemas and vocabularies residing under `/contracts/`.

### 3. Handle Envelopes and Nested Payloads Separately
To maintain clean separation of concerns and allow rapid evolution of modular sub-schemas (e.g., separating pure vision analysis schemas from server tracking details), our larger contract schemas utilize a nested pattern rather than single giant definitions.
* The API response or file record acts as an **Envelope Schema**.
* The core AI extraction data resides inside a nested open-ended object (e.g., `record.visualAnalysis` or `record.summaryAnalysis`).
* You should perform multi-stage parsing and validation rather than a single coupled pass.

---

## 🚦 Recommended Validation Workflow

When consuming payload data from the indexer (for example, receiving an image analysis report via the API), we recommend the following validation order to ensure error isolation and robust fallback handling:

```
┌───────────────────────────────────────────────┐
│  1. Validate API Response Envelope            │
│     (contracts/api/v0.1.0/...)                │
└───────────────────────┬───────────────────────┘
                        │
                        ▼ (Extract record payload)
┌───────────────────────────────────────────────┐
│  2. Validate Envelope Record                  │
│     (image-analysis-record or                 │
│      text-analysis-record)                    │
└───────────────────────┬───────────────────────┘
                        │
                        ▼ (Extract inner visual/summary)
┌───────────────────────────────────────────────┐
│  3. Validate Core AI Extraction               │
│     (visual-analysis or                       │
│      summary-analysis)                        │
└───────────────────────┬───────────────────────┘
                        │
                        ▼ (Optionally validate enums)
┌───────────────────────────────────────────────┐
│  4. Validate Governed Vocabularies            │
│     (contracts/vocabularies/...)              │
└───────────────────────────────────────────────┘
```

1. **Step 1 (API Response Level)**: Validate the high-level HTTP response structure against the appropriate API contract (e.g., `visual-public-samples-analyze.response.schema.json`).
2. **Step 2 (Envelope Level)**: Extract the `record` from the response, and validate it against the envelope contract (e.g., `image-analysis-record.v0.1.0.schema.json`). This ensures all processing telemetry, file sizes, execution timing, and OCR coverage scores are syntactically sound.
3. **Step 3 (Core Payload Level)**: Extract the nested payload (e.g., `record.visualAnalysis` or `record.summaryAnalysis`) and validate it against its canonical schema (e.g., `visual-analysis.v0.2.0-draft.1.schema.json` or `summary-analysis.v1.2.0-draft.2.schema.json`).
4. **Step 4 (Vocabulary Level)**: If your application requires strict vocabulary filtering, cross-check individual keys (such as `imageKind` or `category`) against term definitions stored inside `contracts/vocabularies/`.

---

## 🚦 Stability Levels & Lifecycle Policy

Each contract declares its lifecycle phase in the `x-contract-status` field at its root:

* **`draft`**: Active design and calibration phase. Schemas may evolve and change structurally to fit model updates.
* **`rc` (Release Candidate)**: Feature-complete and undergoing integration testing. Breaking changes are avoided and only introduced under exceptional circumstances.
* **`stable`**: Production-ready. Absolutely **no breaking changes** are permitted. Any structural adjustment requires a new version path (e.g., bumping from `v0.1.0` to `v0.2.0`).
* **`deprecated`**: Superseded by a newer contract but preserved for historical backwards-compatibility.

### Breaking Change Definition
A change is considered breaking if it:
* Renames or deletes an existing property.
* Changes the data type of an existing property.
* Adds a new **required** property at the top-level or in a nested structure without defaults.
* Constrains an existing property's format, enum list, or validation range.

---

## ⚠️ Key Structural Notes

### 🚫 No `responseRaw` Property
Legacy models and early prototype endpoints included a mutable `responseRaw` field that contained unparsed, unvalidated JSON strings directly from the model. 
* To guarantee deterministic parsing, **`responseRaw` does not exist in any normal contracts**.
* All exchange data is cleanly validated, sanitized, and stored inside the structured `record` payload.

---

## 🤖 Programmatic Consumption & Automation

To support fully automated continuous integration, we provide developer-focused resources to discover and test your implementation programmatically.

### 1. Parsing the Manifest (`MANIFEST.json`)
You can programmatically parse `contracts/MANIFEST.json` to fetch the complete registry of contracts.
The schema is stable and provides exact relative paths to:
- `schema`: The JSON schema file.
- `readme`: Accompanying integration documentation.
- `examples`: Curated valid payloads.
- `nestedContracts`: Dependencies on other sub-schemas, listing the field and target contract.

### 2. Testing Compliance with Conformance Test Vectors (`conformance/`)
Before deploying an integration, we recommend writing automated tests in your codebase that run your parser against our conformance vectors:
- **`conformance/<contract>/<version>/valid/`**: These files represent completely compliant data payloads. Your parser **MUST** swallow, parse, and process these successfully.
- **`conformance/<contract>/<version>/invalid/`**: These files represent invalid payloads containing schema-breaking violations. Your parser or validator **MUST** reject these, and fail gracefully with validation diagnostics rather than crashing.
