# Summary Analysis Contract v1.2.0-draft.2

- **Contract Name**: Summary Analysis Schema
- **Version**: v1.2.0-draft.2
- **Status**: **Draft** (Actively calibrating under evaluation)
- **Purpose**: Defines the schema for AI-structured metadata summaries extracted from text-based or OCR-processed documents. It captures high-level executive summaries, title derivations, document classifications, formats, file structures, keywords, and subject area domains with precision confidence metrics.
- **Primary Producer**: The primary document analysis engine running Gemini models.
- **Primary Consumers**: Directory indexing generators (creating `index.md`), dashboard search filters, database synchronizers, and cataloging utilities.
- **Related App Docs**: `docs/DATA_STRATEGY.md`

---

## Files

- **Schema File**: [schema.json](schema.json)
- **Example Files**:
  - [examples/minimal.json](examples/minimal.json): A simple, clean, and concise English record.
  - [examples/japanese-mixed.json](examples/japanese-mixed.json): A realistic bilingual (English/Japanese) example reflecting multi-lingual index capabilities.

---

## Compatibility and Lifecycle Policies

- **Breaking Change Policy**: This contract is currently in a **Draft** status. While we aim to maintain stability, breaking changes are permitted during active validation. All breaking changes will be documented clearly in the contract's `CHANGELOG.md`.
- **Compatibility Notes**: Downstream parsers must expect optional properties to be added or modified safely. We recommend lenient parsing policies (e.g., ignoring unknown fields) to maintain compatibility.

---

## ⚠️ Known Limitations

1. **Title Length Constraints**: The `derivedTitle` field is designed for concise title representations. Implementations are advised to truncate titles to under 128 characters to avoid layout breaks in visual index dashboards.
2. **Subject Area Domain Overlap**: A document may span multiple domains defined in `subject-domains.json`. In this draft version, the array of `subjectAreas` lacks formal priority weight indicators. Consumers must treat list order as the default order of relevance.
