# Summary Analysis Schema v1.2.0 - Design Rationale

This document describes the key architectural decisions and engineering rationales behind the Summary Analysis Schema v1.2.0-draft.1 design.

---

## 💡 Key Architectural Pillars

### 1. JSON Schema as the Source of Truth
We treat the JSON Schema document as the authoritative specification of the metadata format. 
* **Rationale**: This schema must be **exchange-oriented**, capable of being utilized in external applications, web indexers, or separate pipeline modules written in other languages (such as Python or Rust) without being locked into the TypeScript AST or TypeScript-specific comment strings.

### 2. Separation of Vocabulary from Structural Schema
Static JSON Schema enum lists (e.g., listing all 22 document kinds or 19 subject domains directly inside the schema properties) make the schema brittle and expensive to update.
* **Rationale**: Under v1.2, vocabulary definitions are separated into their own JSON files with custom versions (e.g. `document-kinds.v1.0.0-draft.1.json`). The schema references a simple string type, and a separate semantic validation layer verifies term compliance. This allows hot-swapping or minor-version updating vocabularies without needing to modify or break the core exchange schema structure.

### 3. Comprehensive Title Resolution Heuristics
A document can have multiple competing titles (e.g., metadata titles, visible headings, file names).
* **Rationale**: The `titleInfo` section records all potential title candidates:
  * `explicitTitle`: The literal title inside headings or embedded metadata.
  * `fileNameTitle`: The file's name, specifically checking if the name is a low-information placeholder (e.g. `Document1.docx`) via the `isGeneric` property.
  * `inferredTitle`: The AI's comprehensive understanding of what the document represents.
  The chosen `displayTitle` stores the selected option and the reasoning behind that selection, providing complete observability into title resolution.

### 4. File Format vs. Document Kind Separation
MIME type formats (PDF, DOCX, MD) are purely physical representations, whereas document kinds (Invoice, Manual, Academic Paper) are cognitive types.
* **Rationale**: Mixing them (e.g., making 'PDF' a document kind) leads to logical confusion. v1.2 separates `fileFormatInfo` (MIME/extension) and `documentKindInfo` (cognitive category) into individual, decoupled sections.

### 5. Faceted Subject Areas (Controlled Domains + Open Labels)
Standard library classification systems like Universal Decimal Classification (UDC), Dewey Decimal Classification (DDC), or Library of Congress Classification (LCC) are far too rigid and formal for personal, business, or mixed technical files.
* **Rationale**: v1.2 introduces a hybrid approach:
  * Controlled high-level domains (e.g., `computerScience`, `medicine`, `finance`) categorizing broad subject pillars.
  * Open-vocabulary, AI-generated labels (e.g., `React hooks`, `Orthopedics`, `MRI scan`) nested under domain nodes to capture high-fidelity specifics.
  * If no domain matches, the controlled domain can be set to `other`, requiring at least one concrete open-vocabulary label to justify the classification.

### 6. Topics vs. Keywords
* **Topics**: Represent coarse, abstract, conceptual classifications answering “What is this document about?” (e.g., `cloud-consulting`).
* **Keywords**: Represent high-fidelity, precise search tags or terms retrieved directly or normalized from the content, answering “What specific terms will help searchers find this document again?” (e.g., `INV-2026-904`).

### 7. Extracted Facts: Role Categories + Open Roles
We replace rigid role enums with a hierarchical Category + Open Role design:
* **Rationale**: Instead of a small, fixed list of roles, temporal references, parties, and monetary values are assigned an open role string (e.g., `billingPeriodEnd`, `payer`, `discountTotal`) alongside a controlled, standard category (e.g., `validity`, `payment`, `discount`). This gives the language model maximum semantic expression while ensuring the system can group facts under high-level categories for unified indexing.

### 8. Hard Privacy & Token Constraints
To guarantee data safety and prevent security leaks:
* **Constraint**: Raw source-text snippets captured inside `raw` fields are strictly limited to **240 characters**.
* **Constraint**: Any string containing tokens, OAuth codes, access keys, or API credentials is automatically redacted to `[REDACTED_SECURITY_SENSITIVE_STRING]` during normalization, preventing any sensitive information from leaking into persistent stores.
