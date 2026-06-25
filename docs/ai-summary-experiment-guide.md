# AI Summary Test Workbench & Schema Evaluation Guide

## Overview
The **AI Summary Test** tab is a safe, isolated workbench designed to evaluate the latest summary schema version (currently `v1.2.0-draft.2` structural schema and prompt version) without affecting Google Drive `index.md` files or Firestore data. All legacy schemas have been abolished.

## Features
- **Drive Input Mode**: Fetch and parse text/binary documents from Google Drive for testing.
- **Manual Input Mode**: Paste synthetic or real text directly for immediate evaluation without requiring a Drive file.
- **Structured vs. Free-text**: Test both strict JSON schema generation and free-form `oneLineSummary` generation.
- **Detailed Validation**: See inline schema validation errors in real-time when the model output fails to match the required structure.

## Experiment History & Safety Constraints
- **Cache Location**: Experiment runs are logged to `cache/experiment-history/experiment_history.json`. This directory is `.gitignore`d to prevent accidental leakage of sensitive test data.
- **No Raw Output Persistence**: By default, raw text outputs from the model are **not** persisted to disk to minimize PII exposure risks. Only normalized structured JSON, schema metadata, error traces, and execution timestamps are saved.
- **Live Debugging**: Raw model output is visible immediately in the UI result panel after generation, allowing developers to inspect formatting or hallucination issues.

## Testing Procedures
1. **Manual Input Tests**:
   - Switch to "Manual Text" mode.
   - Enter synthetic test strings (e.g., invoices, academic papers).
   - Press Generate.
   - Verify validation errors or successful normalization in the result view.
2. **History Inspection**:
   - Expand the "Experiment History" accordion.
   - Refresh to see past runs.
   - Click "表示" to load previous structured results and validation errors (raw output will be marked as not persisted).
3. **Draft Schema Iteration**:
   - Edit `src/lib/summaryAnalysis/schema.ts` and `src/lib/promptSpecs.ts`.
   - Update version numbers (e.g., `v1.2.0-draft.3`).
   - Run tests (`npm run test:unit`) before manual UI validation.
