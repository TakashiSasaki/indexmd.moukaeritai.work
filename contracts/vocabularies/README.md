# Governed Vocabularies & Taxonomies

This directory contains versioned, machine-readable JSON structures defining the governed taxonomies, lists of terms, and allowed enum values for the `indexmd` project.

Downstream consumers, processing workers, and validation engines use these JSON files as the canonical "single source of truth" for classifying indices, subjects, and text structures.

---

## 📂 Vocabularies Inventory

### 1. `document-kinds`
- **Specification File**: `document-kinds.v1.0.0-draft.1.json`
- **Purpose**: Defines distinct classifications for documents (e.g., `note`, `report`, `specification`, `meetingNotes`, `taskList`, etc.).
- **Primary Use**: Used by text summary extraction to assign a single dominant "document kind" to index structures.

### 2. `extraction-role-categories`
- **Specification File**: `extraction-role-categories.v1.0.0-draft.1.json`
- **Purpose**: High-level categorization of elements extracted during vision analysis (e.g., `primary`, `supporting`, `decorative`, `branding`, `utility`).
- **Primary Use**: Visual indexing record classifications.

### 3. `keyword-sources`
- **Specification File**: `keyword-sources.v1.0.0-draft.1.json`
- **Purpose**: Tracks how a specific index keyword was obtained (e.g., `ai-generated`, `user-annotated`, `inherited`, `ocr-extracted`).
- **Primary Use**: Distinguishing confidence and lineage of index metadata.

### 4. `subject-domains`
- **Specification File**: `subject-domains.v1.0.0-draft.1.json`
- **Purpose**: General knowledge classification domains (e.g., `engineering`, `productDesign`, `medical`, `geography`, `finance`).
- **Primary Use**: High-level semantic tagging.

### 5. `subject-label-kinds`
- **Specification File**: `subject-label-kinds.v1.0.0-draft.1.json`
- **Purpose**: Classifications for individual visual bounding box findings (e.g., `textBlock`, `diagram`, `signature`, `logo`, `artifact`).
- **Primary Use**: Ground-truth validation and layout analysis.

---

## 🛠 File Structure & Validation

Each vocabulary file must adhere to the following schema:

```json
{
  "vocabularyId": "string (unique identifier matching filename prefix)",
  "version": "string (semantic version matching suffix)",
  "terms": [
    {
      "value": "string (camelCase canonical code value)",
      "description": "string (detailed description of what this term covers)",
      "deprecated": "boolean",
      "aliases": ["array of alternative string values"]
    }
  ]
}
```

These rules are enforced automatically by `npm run validate:contracts`.
