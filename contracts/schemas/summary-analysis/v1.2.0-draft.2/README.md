# Summary Analysis Contract v1.2.0-draft.2

Status: **Draft**

## Purpose
Defines the schema for AI-structured metadata summaries extracted from text-based or OCR-processed documents. It captures high-level executive summaries, title derivations, document classifications, formats, file structures, keywords, and subject area domains with precision confidence metrics.

## Primary Producer
The primary document analysis engine running Gemini models.

## Primary Consumers
Directory indexing generators (creating `index.md`), dashboard search filters, and cataloging utilities.

## Schema File
- `schema.json`

## Examples
- `examples/minimal.json`
- `examples/japanese-mixed.json`

## Related App Docs
- `docs/DATA_STRATEGY.md`
