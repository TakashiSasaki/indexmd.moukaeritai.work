# Contracts Changelog

All notable changes to the versioned data exchange contracts, schemas, API payload structures, and vocabularies will be documented in this file.

---

## [Unreleased]

### Added
- Established top-level versioned `contracts/` directory for stable, externally referenceable integration contracts.
- Added versioned contract directory and canonical schema for `summary-analysis/v1.2.0-draft.2`.
- Added versioned contract directory and canonical schema for `text-analysis-record/v0.1.0`.
- Added versioned contract directory and canonical schema for `visual-analysis/v0.2.0-draft.1`.
- Added versioned contract directory and canonical schema for `image-analysis-record/v0.1.0`.
- Added public visual sample evaluation schemas (`public-sample.schema.json`, `expected-metadata.schema.json`, `batch-summary.schema.json`, and `batch-diagnostic.schema.json`) under `public-visual-sample/v0.1.0`.
- Added API exchange payload schemas for the public visual sample analysis routes (`api/v0.1.0`).
- Created standardized `README.md` files for each contract version to explain purpose, producers, consumers, and compatibility profiles.
- Integrated canonical example payloads (minimal, full, success, and failure cases) for all key contracts under their respective `examples/` directories.
- Copied shared vocabularies to `contracts/vocabularies/` to serve as a unified source of truth for governed enums.
- Added contract consistency checker script (`scripts/validate-contracts.mjs`) and wired it into `npm run validate:contracts`.
- Implemented recursive deep nested contract validation in `scripts/validate-contracts.mjs` to ensure envelope payload files (such as `image-analysis-record` and `text-analysis-record`) and API response structures are thoroughly validated against inner nested schemas (like `visual-analysis` and `summary-analysis`).

### Changed
- Refined metadata on all schemas to include `$id`, `x-contract-id`, `x-contract-version`, and `x-contract-status` attributes to facilitate automated cataloging.
- Confirmed the absolute removal of legacy flat properties and `responseRaw` from the standard schema paths of all new contracts, fully enforcing the nested `record`-centric design contract.
- Aligned all canonical example JSON files with their respective schemas and inner schemas, correcting structural issues (such as `visibleElements` placement inside `visualInfo`) and correcting `sceneContext.lighting` enum values in `image-analysis-record` and API success examples.
- Enriched `text-analysis-record` minimal examples to fully satisfy the `summary-analysis` required properties, avoiding empty mock placeholders.
