# Text Analysis Record Contract v0.1.0

Status: **Stable**

## Purpose
An envelope schema wrapping a `summaryAnalysis` metadata block with extensive processing context, including asset tracking metadata, technical specs (word counts, OCR usage, page counts), execution telemetry, validation schemas, system prompts, quality scores, evaluation statuses, and error diagnostics.

## Primary Producer
The full-stack indexer's text processing pipeline.

## Primary Consumers
Downstream indexing logs, system health dashboards, database sync monitors, and developer diagnostic utilities.

## Schema File
- `schema.json`

## Examples
- `examples/minimal.json`
- `examples/failure.json`

## Related App Docs
- `docs/api-schema.md`
