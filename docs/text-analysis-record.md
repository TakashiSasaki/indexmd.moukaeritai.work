# Text Analysis Record v0.1.0

This document specifies the `TextAnalysisRecord`, an outer envelope schema that encompasses file asset metadata, processing telemetry, extraction diagnostics, and semantic analysis data (`SummaryAnalysisResultV12`) for document intelligence tasks.

## 🎯 Separation of Concerns

`SummaryAnalysisResultV12` represents the **document-derived semantic payload** (what the document is about, what facts it contains).

`TextAnalysisRecord` provides the **asset, technical, execution, evaluation, and diagnostics envelope** (what file was processed, how it was processed, whether the processing succeeded, and quality evaluation).

This aligns the text indexing processing pipeline with the visual analysis pipeline structure (`ImageAnalysisRecord`).

### Structure Mapping to ImageAnalysisRecord

| Visual Pipeline (`ImageAnalysisRecord`) | Text Pipeline (`TextAnalysisRecord`) | Notes |
|---|---|---|
| `visualAnalysis` | `summaryAnalysis` | The core AI-generated semantic payload |
| `assetMetadata` | `assetMetadata` | Basic file/storage metadata |
| `technicalMetadata` | `technicalMetadata` | Format, size, length, encoding, parsing info |
| `analysisRun` | `analysisRun` | Telemetry about the Gemini SDK call (model, prompt version) |
| `evaluation` | `evaluation` | Quality gate evaluation and scoring |
| `diagnostics` | `diagnostics` | Debugging data (parsing errors, validation errors, retries) |

## 🏗 High-Level Structure

```json
{
  "schemaVersion": "text-analysis-record.v0.1.0",
  "status": {
    "success": true,
    "error": null,
    "failureKind": null
  },
  "assetMetadata": {
    "fileId": "123456",
    "name": "project_notes.pdf",
    "sourceKind": "googleDrive"
  },
  "technicalMetadata": {
    "mimeType": "application/pdf",
    "extension": "pdf",
    "byteLength": 2048,
    "originalTextLength": 1024,
    "extractedTextLength": 1024,
    "contentSampleLength": 200,
    "truncated": false,
    "truncationLimit": 50000,
    "textExtractionMethod": "binaryInlineModelInput",
    "ocrUsed": false
  },
  "summaryAnalysis": {
    // ... SummaryAnalysisResultV12 ...
  },
  "analysisRun": {
    // ... Telemetry ...
  },
  "evaluation": {
    "qualityStatus": "valid",
    "qualityScore": 100
  },
  "diagnostics": {
    // ... Debug info ...
  }
}
```

## 🛡️ Schema Strictness and Validation

To prevent model drift and ensure consistent telemetry structures, the JSON Schema is strictly configured with:
- `"additionalProperties": false` across the root object and all standard structural nested objects (`status`, `assetMetadata`, `technicalMetadata`, `analysisRun`, and `evaluation`).
- `"summaryAnalysis"` and `"diagnostics"` allow arbitrary extensions to accommodate specific semantic payload shapes or platform-specific runtime metadata.

## ❌ Structured Error/Failure Telemetry

If an operation fails, the endpoint returns `status.success = false` along with a standardized `status.failureKind`. This allows clients to reliably categorize errors:

- **`providerError`**: Provider-level API failures (e.g., rate limits, invalid API keys, temporary 503s). When this occurs, a valid `TextAnalysisRecord` is still generated with `status.success = false`, `status.failureKind = "providerError"`, and `summaryAnalysis` is omitted.
- **`emptyStructuredOutput`**: The model output was completely empty.
- **`jsonParseError`**: Output was generated but failed initial JSON parsing.
- **`schemaValidationError`**: Output was parsed but failed structural JSON schema validation constraints.
- **`controlledVocabularyValidationError`**: Schema structural checks passed, but the values did not respect the controlled vocabulary bounds (e.g. invalid document kind or subject domain labels). This uses exact string matching of known validation error messages.
- **`repairFallbackFailed`**: A repair fallback attempt was made but it also failed.
- **`underGeneratedStructuredOutput`**: The model completed successfully but produced incomplete/under-generated output structures.
- **`qualityGateFailed`**: Output parsed and passed basic validation, but failed the quality evaluation metrics.
- **`unknown`**: Unclassified generic model or pipeline errors.

## 🕵️ Data Safety in Diagnostics

To ensure data privacy and prevent secrets from leaking into the `TextAnalysisRecord` envelope:
- Raw full text from the source document is **NEVER** stored in `technicalMetadata` or `diagnostics`.
- The raw `customInstruction` (which might contain user-defined secrets or specific private rules) is **NEVER** stored in `analysisRun` or `diagnostics`.
- `diagnostics.input` and `diagnostics.generation` only contain high-level metadata (byte lengths, extraction methods, status codes, retry counts).

## 🔄 Migration and Compatibility

During the transition phase, legacy API responses (like those returned by `/api/drive/debug/generate-file-summary`) will return the flat legacy fields alongside the new `record` property.

```json
{
  "success": true,
  "structured": { ... },
  "qualityStatus": "valid",
  // ... (Legacy flat fields) ...
  "record": {
    "schemaVersion": "text-analysis-record.v0.1.0",
    "status": { ... },
    "summaryAnalysis": { ... },
    // ...
  }
}
```
