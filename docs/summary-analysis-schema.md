# Summary Analysis Schema v1.2.0-Draft.1

This document specifies the Summary Analysis Schema v1.2.0-draft.1, a repository-level, exchange-oriented schema artifact designed for single-file metadata extraction.

## 🎯 JSON Schema as Source of Truth
The schema's formal definition resides exclusively in:
`/schemas/summary-analysis.v1.2.0-draft.1.schema.json`

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
Implements a multi-faceted classification system using controlled subject domains combined with open-vocabulary AI-generated labels:
- Governed by the `subject-domains` vocabulary (`v1.0.0-draft.1`).
- Labels can fall under specific categories like `field`, `topic`, `method`, `application`, etc.
- If domain is `other`, at least one concrete label is required.

### 6. Language Section (`languageInfo`)
Records primary language and lists all detected secondary languages.

### 7. Indexing Section (`indexing`)
Optimizes files for vector and token search:
- `topics`: Coarse thematic categories.
- `keywords`: Fine-grained search terms or literal phrases.
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

## 🛡 Validation Responsibilities
Validation of a Summary Analysis document is divided into two layers:

1. **Structural Validation (JSON Schema)**: Ensures types, required sections, string constraints, and nesting structures match the JSON Schema. Done via `ajv`.
2. **Semantic Validation (Custom Validator)**: Validates actual string vocabularies, version numbers, generic filename reasons, unique "unknown" requirements, display title consistency, and strict limits on raw text sizes (maximum 240 characters) to preserve privacy. Done via `src/lib/summaryAnalysis/validate.ts`.
