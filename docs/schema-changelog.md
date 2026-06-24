# Summary Analysis Schema Changelog

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
