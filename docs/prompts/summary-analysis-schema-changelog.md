# Summary Analysis Schema Changelog

## [1.1.0-draft.1]
**Status:** Experimental / Draft

This draft introduces a significantly more detailed and rigorous extraction schema for structured summary analysis.

### Added
- **title**: Explicitly provided title.
- **inferredTitle**: Inferred title if explicit title is missing.
- **documentTypes**: Array of content-level document types (e.g., `note`, `report`, `specification`) from a restricted enum, instead of a free-form `documentType` string.
- **documentIntent**: The overarching intent of the document (e.g., `inform`, `request`, `summarize`) from a restricted enum.
- **topics**: High-level conceptual themes (array of strings).
- **primaryLanguage**: String representing the main language.
- **languages**: Array of all languages present in the document.
- **temporalReferences**: Detailed temporal entities with `date`, `role` (e.g., `created`, `due`), and `raw` string.
- **parties**: People or organizations involved, with `role` (e.g., `author`, `recipient`) and `kind`.
- **monetaryAmounts**: Extracted monetary amounts with `amount`, `currency`, `role` (e.g., `total`, `tax`), and `raw` string.
- **subjectAreas**: Strict domain classification for academic or specific fields (e.g., `mathematics`, `computerScience`), mapping to detailed sub-domain enums.
- **warnings**: Array of strings for model-generated warnings or notes.
- **resourceReferences**: Replaces `urls`. Includes `uri` and `raw` string.

### Changed
- **namedEntities**: Changed from an object of arrays (`people`, `organizations`, etc.) to an array of objects with `name` and `type` (e.g., `person`, `organization`, `artifact`).
- **keywords**: Explicitly differentiated from `topics` and `subjectAreas`. Keywords are search terms.

### Removed
- **urls**: Replaced by `resourceReferences`.
- **documentType**: Replaced by `documentTypes` (array).
- **language**: Replaced by `primaryLanguage` and `languages`.

## [1.0.0]
**Status:** Stable
- Initial version of the structured output schema. Includes `oneLineSummary`, `detailedSummary`, `keywords`, `urls`, `namedEntities` (object format), `documentType` (string), `language`, and `confidence`.
