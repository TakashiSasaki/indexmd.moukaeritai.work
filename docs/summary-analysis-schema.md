# Summary Analysis Schema v1.2.0-Draft.2

This document specifies the Summary Analysis Schema v1.2.0-draft.2, a repository-level, exchange-oriented schema artifact designed for single-file metadata extraction.

## 🎯 JSON Schema as Source of Truth
The schema's formal definition resides exclusively in:
`/schemas/summary-analysis.v1.2.0-draft.2.schema.json`

**TypeScript interfaces, comments, and helper functions are downstream consumers.** The JSON Schema document itself must be treated as the ultimate reference of correctness for any data exchange.

---

## 🏗 High-Level Structure
An extraction result under v1.2 conforms to the following root-level sections:

```json
{
  "summary": "SummaryInfo",
  "titleInfo": "TitleInfo",
  "documentKindInfo": "DocumentKindInfo",
  "fileFormatInfo": "FileFormatInfo",
  "subjectAreas": "SubjectAreasInfo",
  "languageInfo": "LanguageInfo",
  "indexing": "IndexingInfo",
  "extractedFacts": "ExtractedFacts",
  "quality": "ExtractionQuality"
}
```

### 1. Summary Section
Moves away from flat keys (`oneLineSummary`, `detailedSummary`) to a unified `summary` namespace:
- `oneLine`: A concise, single-sentence overview suited for file explorer tables or directory listings. Must be a non-empty string.
- `detailed`: A deeper, multi-paragraph content summary.

### 2. Title Section (`titleInfo`)
Consolidates diverse title heuristics into a single, multi-faceted record:
- `explicitTitle`: A title explicitly defined in document headings or embedded metadata (MIME tags, PDF title fields). Nullable.
- `fileNameTitle`: A candidate derived directly from the filename, noting if the filename is generic (e.g. `document.pdf`) and the reason. Nullable.
- `inferredTitle`: An AI-inferred title based on general document comprehension.
- `displayTitle`: The final, chosen title to represent the document, tracking its source and selecting reason.

### 3. Document Kind Section (`documentKindInfo`)
Captures cognitive document categories rather than standard MIME types.
- Governed by the `document-kinds` vocabulary (`v1.0.0-draft.1`).
- Custom validation ensures unknown kind is used alone.
- Supports up to 5 kinds.

### 4. File Format Section (`fileFormatInfo`)
Isolates representation layer details (MIME type and file extensions) cleanly from cognitive types.

### 5. Subject Areas Section (`subjectAreas`)
Implements a multi-faceted, semantic classification system using controlled subject domains combined with open-vocabulary AI-generated labels:
- Governed by the `subject-domains` vocabulary (`v1.0.0-draft.1`).
- Labels are classified under specific categories like `field`, `topic`, `method`, `application`, etc. This represents the primary locus of *inferred semantic aboutness* in the schema.
- If domain is `other`, at least one concrete label is required.

### 6. Language Section (`languageInfo`)
Records primary language and lists all detected secondary languages.

### 7. Indexing Section (`indexing`)
Optimizes files for vector and token search:
- **Removal of `topics`**: `indexing.topics` has been removed in draft.2 to eliminate semantic duplication. Inferred topical aboutness is now modeled purely in `subjectAreas.domains[].labels[]` with `kind = "topic"`.
- **Linguistic Keywords**: `indexing.keywords` are rich search-term objects with:
  - `value`: Non-empty keyword string.
  - `language`: Optional BCP 47 language tag (represented as string or null).
  - `script`: Optional ISO 15924 script code.
  - `source`: Provenance-oriented source of the keyword (`body`, `heading`, `title`, `filename`, `embeddedMetadata`, `authorProvided`, `identifier`, `other`, `unknown`). Surface-level terms are derived here, separating literal derivation from inferred conceptual categories.
  - `confidence`: Level of extraction/categorization (0.0 to 1.0).
  - `importance`: Optional significance level (0.0 to 1.0).
  - `normalizedValue`: Optional normalized canonical keyword representation.
  - `searchVariants`: Optional array of alternative search phrases or terms, where each variant uses a `relation` classification (`synonym`, `acronym`, `translation`, `transliteration`, `stem`, `misspelling`) rather than `kind`.
- `namedEntities`: Recognized actors, organizations, locations, and initiatives.
- `resourceReferences`: Referenced URLs, links, and documents.

### 8. Extracted Facts Section (`extractedFacts`)
Models deep references, temporal boundaries, and billing/financial transactions:
- `temporalReferences`: Timeline events categorized by lifecycle roles (e.g., deadlines, validity ranges).
- `parties`: Involved actors, groups, or systems with distinct role categories.
- `monetaryAmounts`: Financial figures (subtotals, tax, discount) linked with controlled role categories.

### 9. Quality Section (`quality`)
Provides extraction feedback (warnings, safety alerts, and confidence percentages).

---

## 🛡 Validation & Normalization Responsibilities
Validation and normalization are handled by clean utility layers:

1. **Structural Validation (JSON Schema)**: Ensures types, required sections, string constraints, and nesting structures match the JSON Schema document exactly. Done via `ajv` in `src/lib/summaryAnalysis/validate.ts`.
2. **Semantic & Vocabulary Validation (Custom Validator)**: Validates actual string vocabularies, version numbers, generic filename reasons, unique "unknown" requirements, display title consistency, and strict limits on raw text sizes (maximum 240 characters) to preserve privacy. Additionally rejects legacy `indexing.topics` fields or string keywords.
3. **Idempotent Normalizer**: Handles conversion of older draft.1 objects to draft.2, mappings of legacy sources (`surface` -> `body`, etc.), stable deduplication of keywords by composite key (`value` + `language` + `script`) with search variant merging, and security redaction of API keys and credentials.

---

## 🚀 Scope of Current Milestone
This milestone hardens the Summary Analysis Schema v1.2.0-draft.2 as a repository-level, exchange-oriented schema artifact. It establishes the JSON Schema, typescript loader/validation skeleton, normalizer, comprehensive unit testing, and markdown documentation. It is explicitly decoupled from the live AI extraction flow to ensure safe integration in the subsequent phase.
