# API Exchange Contracts v0.1.0

Status: **Stable**

This folder defines public schema contracts for our API endpoints, enabling external systems and integration workers to communicate with the indexer programmatically.

## Endpoints and Schemas

### 1. GET `/api/visual/public-samples`
- **Purpose**: Retrieve the list of all configured public evaluation samples with their expected metadata for regression testing.
- **Response Schema**: `visual-public-samples-list.response.schema.json`

### 2. POST `/api/visual/public-samples/analyze`
- **Purpose**: Run visual indexing and regression analysis on a specific public visual sample.
- **Request Schema**: `visual-public-samples-analyze.request.schema.json`
- **Response Schema**: `visual-public-samples-analyze.response.schema.json`

## Examples
- `examples/visual-public-samples-analyze.success.json`
- `examples/visual-public-samples-analyze.failure.json`

## Key Response Guidelines
- **Envelope Consistency**: The response contains a top-level `success` flag indicating execution status, and a structured `record` matching `image-analysis-record.v0.1.0`.
- **Diagnostics Separation**: Operational diagnostics and system-specific inputs are placed within the `record.diagnostics` block, preventing contamination of visual metadata schema boundaries.
