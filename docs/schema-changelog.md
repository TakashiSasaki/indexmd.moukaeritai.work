# Summary Analysis Schema Changelog

## Unreleased
- Type: record-centered contract consolidation, legacy fallback normalization, rigorous report invariants, and expectation calibration
- **Changes**:
  - Calibrated public visual sample expectations for stable regression review.
  - Added sample-specific `acceptableImageKinds` for taxonomy boundary cases:
    - `receiptPhoto` expected with `documentPhoto` acceptable for the synthetic receipt fixture.
    - `packageImage` expected with `productPhoto` acceptable for package/product photos.
    - `chartOrTable` expected with `screenshot` / `documentPhoto` acceptable for synthetic chart/table fixtures.
    - `landscapePhoto` expected with `naturalPhoto` acceptable for outdoor street-scene boundary cases.
  - Moved non-core expectations to optional fields where appropriate (e.g. `text`, `items` in synthetic receipt, `gate` in synthetic ticket, and `building` in Tokyo neon street signs).
  - Preserved required visibleText sentinels, especially `TICKET` in `sample-ticket-synthetic`, so OCR regressions remain strict failures.
  - Added registry tests for focus sample calibration.
  - Added comparison tests proving `acceptableImageKinds` only softens imageKind mismatch when explicitly configured.
  - Deprecated and removed legacy flat compatibility fields and `responseRaw` references across `compare.ts`, `reportBuilder.ts`, and frontend components.
  - Implemented `normalizeLegacyBatchRunItem` helper on the backend to safely bridge old `responseRaw` data into compliant `record` containers.
  - Refactored all evaluation diagnostics and metadata extraction helpers in `reportBuilder.ts` (`getItemQualityStatus`, `getItemExecutionMetadata`, etc.) to operate strictly on the `item.record` object.
  - Refactored frontend component `ImageExperiment.tsx` to read telemetry from `item.record.diagnostics.generation` rather than old flat fields.
  - Expanded `validateBatchRunInvariants` with comprehensive structural validations:
    - Verifies comparison coverage consistency.
    - Asserts that all successful items containing expected metadata must have associated comparison objects.
    - Validates that comparison `reviewStatus` falls strictly within the set `["pass", "needsReview", "fail"]`.
    - Detects discrepancies where `expectedMetadata.visibleText` exists but `comparison.coverage.visibleText` is omitted.
    - Validates batch-level size consistency by detecting records with positive `technicalMetadata.processedByteLength` when the batch-level `inputSizeSummary.totalProcessedBytes` is zero.
  - Updated unit test suite (`reportBuilder.test.ts`) with modern, record-centric fixtures covering all new invariants, isolation of legacy tests, and normalization behavior.

## v1.2.0-draft.2
- Type: structural schema and prompt refinement
- **Changes**:
  - Legacy schemas (`v1.1.0` and older) are fully abolished and no longer supported. No migration logic remains.
  - Replaced the vocabulary JSON definitions with their draft.2 versions (or draft.1 if unversioned but logically updated).
  - Merged and removed `indexing.topics`.
  - Defined rigid keyword sources (`heading`, `body`, `metadata`, `other`) and enforced keyword `searchVariants` deduplication.
  - Refined the extraction roles and subject label schemas for robustness.
  - Enforced strict deterministic `shouldSkipFirestoreSummaryWrite` hash equivalence (ignoring external DB fetches).

## v1.2.0-draft.1
- Type: major structural schema and vocabulary refinement
- **Repository Artifacts**:
  - Established `/schemas/summary-analysis.v1.2.0-draft.1.schema.json` as the JSON Schema source of truth.
  - Divided vocabularies into modular versioned files under `/schemas/vocabularies/` (kinds, domains, subject label kinds, extraction roles).
- **Structural Overhaul**:
  - Replaced flat `oneLineSummary` and `detailedSummary` with structured `summary.oneLine` and `summary.detailed`.
  - Added robust `titleInfo` modeling multi-source heuristics (`explicitTitle`, `fileNameTitle`, `inferredTitle`, and selected `displayTitle`).
  - Separated cognitive `documentKindInfo` from representation `fileFormatInfo`.
  - Introduced hierarchical `subjectAreas` utilizing controlled domains mapped to open-vocabulary AI-generated labels.
  - Designed `extractedFacts` using Role Category + Open Role configurations for temporal, party, and monetary entities.
- **Privacy & Safety**:
  - Hard-capped `raw` fields to 240 characters and added automated redactors for credential-like or secret-bearing patterns.

## v1.2.0
- Type: metadata & persistence structure change
- **Workbench Persistence**:
  - Introduced the optional `parentId` field inside `FileSummaryMetadata` to group saved file summaries by directory in Firestore.
  - Implemented the `getSummaryMetadataStatus` function, checking for stale-schema, stale-prompt, stale-file, current, or invalid statuses.
  - Formulated a read-only local `index.md` Markdown generation template on the client side using saved Firestore metadata.

## v1.1.0-draft.2
- Type: prompt-only change
- **Prompt Adjustments**:
  - Emphasized that `namedEntities` are explicit proper nouns and `parties` are entities with document-level roles (e.g., author, sender).
  - Enforced DOI normalization for `resourceReferences[].uri` (e.g., `https://doi.org/...`).
  - Instructed the model to use `warnings` for OCR/image ambiguity or uncertain classifications.
  - Added strict instruction not to quote long source passages in summaries.

## v1.1.0-draft.1
- Type: structural schema change and validator change
- **Structural Overhaul**:
  - Introduced fine-grained fields: `documentTypes`, `documentIntent`, `namedEntities`, `resourceReferences`, `primaryLanguage`, `languages`, `temporalReferences`, `parties`, `monetaryAmounts`, `subjectAreas`, `confidence`, and `warnings`.
  - Deprecated legacy `documentType` and `urls` fields.
- **Validation**: Added strict array and type checking for the new arrays and enums.

## v1.0.0
- Type: structural schema change
- Initial schema with `oneLineSummary`, `detailedSummary`, `title`, `documentType`, `urls`, and `language`.

### Text Analysis Record v0.1.0
- **Status:** Active
- **Release:** 2026-07-08
- **Major Changes:**
  - Introduced `TextAnalysisRecord` envelope schema for text indexing.
  - Aligned with `ImageAnalysisRecord` architecture (assetMetadata, technicalMetadata, analysisRun, evaluation, diagnostics).
  - Maintained `summary-analysis.v1.2.0-draft.2` unmodified as the inner `summaryAnalysis` payload.
  - Added strict JSON validation and TypeScript types.
  - Enforced `"additionalProperties": false` across root and nested schema blocks to harden telemetry consistency.
  - Integrated full failure coverage inside catch handlers for `/api/drive/debug/generate-file-summary` and `/api/drive/debug/generate-manual-summary`, ensuring `buildFailedTextAnalysisRecord` constructs standard-compliant envelopes for provider/generation failures.
  - Completed rich `technicalMetadata` reporting, tracking exact extraction variables (`originalTextLength`, `extractedTextLength`, `contentSampleLength`, `textExtractionMethod`, `truncated`, `truncationLimit`, `ocrUsed`).

## `visual-analysis-record.v0.1.0` metadata sync

**Date**: 2026-07-08

**Changes**:
- `expectedMetadata` in `POST /api/visual/public-samples/analyze` now includes `acceptableImageKinds`, `optionalElementCategories`, `optionalVisibleElementLabels`, `optionalVisibleElementLabelAliases`, and `optionalVisibleText`.
- Client-side `ImageExperiment`'s `Run Selected` correctly honors `acceptableImageKinds` and optional expectations to align strictly with server-side batch evaluations.
- `textHeavyEvaluation` in `reportBuilder.ts` now produces a detailed `samples` array structure, mapping `visibleTextCovered` and `mediaResolutionRequested`.
- Separated `EXPERIMENTAL_MODEL` and `PROMPTED_JSON_MODE` explicitly in quality diagnostics.

## `visual-analysis-record.v0.2.1-rc.1` (API Compatibility and Testing)

**Date**: 2026-07-08

**Changes**:
- Deprecated and explicitly removed all legacy flat compatibility fields (`expectedImageKind`, `acceptableImageKinds`, etc.) from the `GET /api/visual/public-samples` response enforcing the new canonical `expectedMetadata` schema exclusively.
- Integrated `expectedMetadata` mapping directly on the backend to provide clean, robust structure matching client-side analysis run requirements.
- Strengthened unit test coverage across `compare.test.ts` (for metrics summarization and optional expectations), `qualityGate.test.ts` (for model-specific logic and text-heavy diagnostics), and added `expectedMetadata.test.ts` to validate helper mappings.


## Canonical Hard Delete Update
- Removed flat duplicate properties in `GET /api/visual/public-samples` explicitly, resolving compatibility lag.
- `expectedNotes` is now array `string[]` uniformly.
