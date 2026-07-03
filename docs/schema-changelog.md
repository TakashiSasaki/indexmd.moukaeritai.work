# Summary Analysis Schema Changelog

## Unreleased
- Type: structural schema, prompt refinement, and strict execution modes
- **Changes**:
  - Implemented model-aware structured output configurations (`nativeSchema` for Gemini vs `promptedJson` for Gemma).
  - Fixed `processStructuredSummaryOutput` to reliably detect `emptyStructuredOutput` and `underGeneratedStructuredOutput` using correct draft.2 root sections.
  - Hardened metadata caching and experiment history logging to explicitly strip `rawFullText`, `rawOutput`, `rawPrompt`, `requestPreview`, `systemInstruction` and `customInstruction`.
  - Suppressed no-op warning logs in `repairSummaryAnalysisV12ControlledVocabularies` and aggregated temporal role warnings.
  - Added rigorous unit tests for model capabilities, prompt assertions, server utility methods, and repair functions.

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
