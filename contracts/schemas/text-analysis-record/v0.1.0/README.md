# Text Analysis Record Contract v0.1.0

- **Contract Name**: Text Analysis Record Envelope
- **Version**: v0.1.0
- **Status**: **RC** (Release Candidate)
- **Purpose**: An envelope schema wrapping a `summaryAnalysis` metadata block with extensive processing context, including asset tracking metadata, technical specs (word counts, OCR usage, page counts), execution telemetry, validation schemas, system prompts, quality scores, evaluation statuses, and error diagnostics.
- **Primary Producer**: The full-stack indexer's text processing and indexing pipeline.
- **Primary Consumers**: Downstream indexing logs, system health dashboards, database sync monitors, and developer diagnostic utilities.
- **Related App Docs**: `docs/api-schema.md`

---

## Files

- **Schema File**: [schema.json](schema.json)
- **Example Files**:
  - [examples/minimal.json](examples/minimal.json): A simple, successful text analysis record envelope containing metadata and evaluation scores.
  - [examples/failure.json](examples/failure.json): A detailed failure envelope illustrating structured diagnostic fields when a document analysis task fails.

---

## Compatibility and Lifecycle Policies

- **Breaking Change Policy**: This contract version `v0.1.0` is marked as **RC** (Release Candidate). No breaking changes will be made to this specific folder or its files unless exceptional circumstances arise during final integration testing. Any schema additions, removals, or required structural adjustments will require a bump to `v0.2.0` or a separate path namespace.
- **Compatibility Notes**: Backwards compatibility is guaranteed for all clients consuming `v0.1.0`. Optional fields may be added if they do not cause client parsing exceptions, but no required fields will be added.

---

## ⚠️ Known Limitations

1. **Nested Schema Openness**: The `summaryAnalysis` field is currently represented as an open object (`"additionalProperties": true`) in this envelope schema. Consumers **SHOULD** validate the nested value separately against the canonical summary analysis schema located at:
   - `contracts/schemas/summary-analysis/v1.2.0-draft.2/schema.json`
   
   A future contract version may replace this with a strict `$ref` once multi-file schema resolution is fully standardized across all our downstream validation tooling.
