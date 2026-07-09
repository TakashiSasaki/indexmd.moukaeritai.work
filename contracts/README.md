# indexmd Versioned Data Exchange Contracts

This directory contains the externally referenceable data exchange contracts, JSON schemas, vocabularies, and example payloads for the `indexmd` project. 

These specifications allow external applications and downstream tools (such as search indexes, document processing pipelines, or metadata sync agents) to safely integrate with the indexer's inputs and outputs without coupling to internal application code or database-specific persistence models.

---

## 🎯 Purpose and Architectural Boundary

Unlike the `src/` directory, which represents volatile, runtime-bound implementation details, the `contracts/` directory defines the immutable, versioned interfaces of the application.

```
                    ┌─────────────────────────────────────┐
                    │       External Integrators          │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼ (Requires stable paths)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  contracts/  (Public Architectural Boundary)                         │
 │                                                                      │
 │  ├── schemas/      <- Pure JSON Schemas with metadata ($id, etc.)    │
 │  ├── vocabularies/ <- Governed vocabularies (e.g. document kinds)    │
 │  └── api/          <- API Exchange structures                        │
 └─────────────────────────────────────┬────────────────────────────────┘
                                       │
                                       ▼ (Read by validators)
 ┌─────────────────────────────────────┴────────────────────────────────┐
 │  src/ & server.ts (App-Internal Logic & Database Models)             │
 └──────────────────────────────────────────────────────────────────────┘
```

### Key Rules for Integrations
1. **Never import from `src/`**: External tools **MUST NOT** import internal TypeScript types or helper modules from `src/`. They should compile their own types directly from these versioned JSON Schemas.
2. **Immutable Versioned Paths**: Once a version folder under `contracts/` is marked `stable`, its contents are **immutable**. Corrections must be released as a new version.
3. **Avoid "Latest" Symlinks**: There is no generic `latest` or `current` path. External applications must bind to explicit semantic versions (e.g., `v1.2.0-draft.2`) to avoid runtime breaking changes.
4. **Canonical Source Only**: `contracts/` is the canonical schema and contract source. Runtime code, docs, tests, and validators read canonical schemas directly from `contracts/`. Root-level `schemas/` must not be reintroduced. Use `npm run validate:contracts` for contract validation, and use `npm run verify:no-schema-mirror` to prevent accidental root-level schema mirror reintroduction.

---

## 🚦 Stability Levels

To communicate readiness and support lifecycle, each contract is assigned a stability level in its metadata (`x-contract-status`):

| Status | Description | Breaking Changes Permitted? |
| :--- | :--- | :--- |
| **Draft** | Experimental or actively calibrating. Subject to refinement. | Yes, with changelog notification. |
| **RC** | Release Candidate. Feature complete, awaiting final validation. | Exceptional circumstances only. |
| **Stable** | Production-ready and fully supported. | **No**. Must release a new version for breaking edits. |
| **Deprecated** | Superceded by a newer contract. Subject to eventual retirement. | No. Retained for historical compatibility. |

---

## 📂 Contracts Inventory and Classification

Our architecture maintains a strict distinction between external data exchange contracts, internal app logic, and database persistence layouts:

### A. External Data Exchange Contracts (Stored under `contracts/`)
These represent the canonical models for system-to-system interchange.
- **`summary-analysis/`**: Canonical schema for text-derived AI structured summaries. [Status: **Draft** (v1.2.0-draft.2)]
- **`text-analysis-record/`**: Envelope wrapping text summaries with execution diagnostics, input details, and quality evaluations. [Status: **RC** (v0.1.0)]
- **`visual-analysis/`**: Pure computer vision schema capturing element categories, visible labels, context, and textual OCR information. [Status: **Draft** (v0.2.0-draft.1)]
- **`image-analysis-record/`**: Envelope wrapping visual analysis output with resizing policies, technical metadata, quality status, and diagnostics. [Status: **RC** (v0.1.0)]
- **`public-visual-sample/`**: Regression evaluation schemas (expected metadata, batch summaries, batch diagnostics). [Status: **RC** (v0.1.0)]
- **`api/`**: Payload specifications for standard API exchange routes (endpoints request/response shapes). [Status: **RC** (v0.1.0)]
- **`vocabularies/`**: Governed term lists (e.g. `document-kinds`, `subject-domains`, `keyword-sources`). [Status: Stable]

### B. App-Internal Implementations (Kept in `src/` or `docs/` - NOT in `contracts/`)
- Runtime parsing, fallback repair logic, and model execution retry handlers (`src/lib/visualAnalysis/`).
- Developer-oriented workflow instructions and diagnostic commands (`docs/maintenance/`).
- Local filesystem state tracking (such as `validation_history.json`).

### C. Firestore Persistence Structures (Kept in `docs/DATA_STRATEGY.md`)
- Detailed layout of Firestore collections and document partitions (`users/{userId}/directories/{directoryId}`). These are private storage schemas and are not exposed directly as external exchange contracts.

### D. Legacy / Deprecated Artifacts (Excluded from `contracts/`)
- **`visual-analysis.v0.1.0-draft.1`**: Superceded by `v0.2.0-draft.1`.
- **`summary-analysis.v1.2.0-draft.1`**: Superceded by `v1.2.0-draft.2`.
- **`responseRaw`**: The legacy API property that wrapped raw API outputs. Completely removed from the normal paths.

---

## 🛠 Directory Structure of `contracts/`

```
contracts/
  ├── README.md             <- This entry point file
  ├── CHANGELOG.md          <- Contract history logs
  ├── VERSIONING.md         <- Detailed lifecycle, versioning, and promotion policy
  ├── INTEGRATION.md        <- Integration guidelines for downstream consumers
  ├── MANIFEST.json         <- Machine-readable contract catalog
  │
  ├── conformance/          <- Strict conformance test vectors (valid / invalid)
  │   ├── api/
  │   ├── image-analysis-record/
  │   └── visual-analysis/
  │
  ├── schemas/              <- Versioned schemas
  │   ├── summary-analysis/
  │   │   └── v1.2.0-draft.2/
  │   │       ├── schema.json
  │   │       ├── README.md
  │   │       └── examples/
  │   │
  │   ├── text-analysis-record/
  │   │   └── v0.1.0/
  │   │       ├── schema.json
  │   │       ├── README.md
  │   │       └── examples/
  │   │
  │   ├── visual-analysis/
  │   │   └── v0.2.0-draft.1/
  │   │       ├── schema.json
  │   │       ├── README.md
  │   │       └── examples/
  │   │
  │   ├── image-analysis-record/
  │   │   └── v0.1.0/
  │   │       ├── schema.json
  │   │       ├── README.md
  │   │       └── examples/
  │   │
  │   └── public-visual-sample/
  │       └── v0.1.0/
  │           ├── public-sample.schema.json
  │           ├── expected-metadata.schema.json
  │           ├── batch-summary.schema.json
  │           ├── batch-diagnostic.schema.json
  │           ├── README.md
  │           └── examples/
  │
  ├── api/
  │   └── v0.1.0/
  │       ├── README.md
  │       ├── visual-public-samples-list.response.schema.json
  │       ├── visual-public-samples-analyze.request.schema.json
  │       ├── visual-public-samples-analyze.response.schema.json
  │       └── examples/
  │
  └── vocabularies/         <- Governed taxonomies and enums
      ├── document-kinds.v1.0.0-draft.1.json
      ├── extraction-role-categories.v1.0.0-draft.1.json
      ├── keyword-sources.v1.0.0-draft.1.json
      ├── subject-domains.v1.0.0-draft.1.json
      └── subject-label-kinds.v1.0.0-draft.1.json
```

---

## 🧭 Navigating Contract Artifacts

To facilitate automated ingestion and ensure high-fidelity implementation, we provide three new core resources:

1. **`MANIFEST.json` (Machine-Readable Catalog)**: A central registry that maps all available schemas, API paths, and vocabularies. Downstream automation pipelines can load this manifest to dynamically locate canonical schema files, associated documentation, and test examples without scanning directories.
2. **`VERSIONING.md` (Detailed Lifecycle & Promotion Policy)**: Defines our semantic versioning policies, constraints for breaking vs. non-breaking changes, stable version immutability, and pre-release checklists.
3. **`conformance/` (Validator Test Vectors)**: Contains strict valid (expected to pass) and invalid (expected to fail) payloads for our schemas. External tooling developers can run these vectors against their parsing engines to verify compliance with the `indexmd` specification.

---

## ⚡ Schema Verification and Validation

All JSON Schemas and example payloads are verified continuously.

### 1. Contract Structure and Examples Validation
To run contract checks (verifying JSON syntax, required metadata fields, example compliance, and deep nested envelope validation):

```bash
npm run validate:contracts
```

This validation ensures:
1. Every `.json` schema/payload is syntactically correct.
2. Every version folder has a non-empty, informative `README.md`.
3. Every main schema file contains correct metadata (`x-contract-id`, `x-contract-version`, `x-contract-status`, and stable `$id`).
4. Example payloads are fully valid against their associated schemas.
5. **Deep Nested Validation**: Inside envelope schemas (such as `image-analysis-record` and `text-analysis-record`) and API responses, nested payloads (like `visual-analysis` and `summary-analysis`) are validated recursively against their canonical inner schemas to guarantee that examples do not diverge from their respective definitions.

### 2. Anti-Mirror Guard
To verify that no root-level `/schemas` directory or code references to it have been reintroduced:

```bash
npm run verify:no-schema-mirror
```

This verification prevents the accidental recreation of redundant runtime schema mirrors outside of `contracts/schemas/`.
