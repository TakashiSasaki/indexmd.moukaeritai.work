# Image Analysis Record Contract v0.1.0

Status: **Stable**

## Purpose
An envelope schema wrapping `visualAnalysis` output with resizing and recompression policies, technical file metadata (byte lengths, dimensions), execution records, verification schemas, prompts, evaluation metrics, review statuses, and step-by-step diagnostic reports.

## Primary Producer
The full-stack indexer's image processing and pipeline.

## Primary Consumers
Regression dashboards, storage sincronization tools, external indexing consumers, and system observability tabs.

## Schema File
- `schema.json`

## Examples
- `examples/minimal.json`
- `examples/failure.json`

## Related App Docs
- `docs/visual-analysis-schema.md`
