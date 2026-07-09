# Image Analysis Record Contract v0.1.0

- **Contract Name**: Image Analysis Record Envelope
- **Version**: v0.1.0
- **Status**: **RC** (Release Candidate)
- **Purpose**: An envelope schema wrapping the pure `visualAnalysis` output with resizing and recompression policies, technical file metadata (byte lengths, dimensions), execution records, verification schemas, prompts, evaluation metrics, review statuses, and step-by-step diagnostic reports.
- **Primary Producer**: The full-stack indexer's image processing and pipeline handler.
- **Primary Consumers**: Regression dashboards, storage synchronization tools, external indexing consumers, and system observability tabs.
- **Related App Docs**: `docs/visual-analysis-schema.md`

---

## Files

- **Schema File**: [schema.json](schema.json)
- **Example Files**:
  - [examples/minimal.json](examples/minimal.json): A simple, clean, and successful image analysis record envelope.
  - [examples/failure.json](examples/failure.json): A realistic example of an image analysis run that failed due to a provider-level error (such as a timeout or rate limit), illustrating the system's resilience taxonomies.

---

## Compatibility and Lifecycle Policies

- **Breaking Change Policy**: This contract version `v0.1.0` is marked as **RC** (Release Candidate). No breaking changes will be made to this specific folder or its files unless exceptional circumstances arise during final integration testing. Any schema additions, removals, or required structural adjustments will require a bump to `v0.2.0` or a separate path namespace.
- **Compatibility Notes**: Backwards compatibility is guaranteed for all clients consuming `v0.1.0`. Optional fields may be added if they do not cause client parsing exceptions, but no required fields will be added.

---

## ⚠️ Known Limitations

1. **Nested Schema Openness**: The `visualAnalysis` field is currently represented as an open object (`"additionalProperties": true`) in this envelope schema. Consumers **SHOULD** validate the nested value separately against the canonical visual analysis schema located at:
   - `contracts/schemas/visual-analysis/v0.2.0-draft.1/schema.json`
   
   A future contract version may replace this with a strict `$ref` once multi-file schema resolution is fully standardized across all our downstream validation tooling.
