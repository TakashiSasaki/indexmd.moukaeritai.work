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
    "byteLength": 2048,
    "mimeType": "application/pdf"
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
