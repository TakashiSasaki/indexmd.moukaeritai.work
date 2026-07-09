# API Exchange Contracts v0.1.0

- **Contract Name**: Public Visual Sample API Exchange Contracts
- **Version**: v0.1.0
- **Status**: **RC** (Release Candidate)
- **Purpose**: Defines public schema contracts for the system's external web API endpoints. This enables programmatic integration for regression testing, quality evaluation, and automated diagnostic workflows.
- **Primary Producer**: `indexmd` backend server (`server.ts`)
- **Primary Consumers**: Front-end workbench dashboard, downstream regression-run CLI tools, and external CI/CD analytics collectors.
- **Related App Docs**: `docs/api-schema.md`

---

## Endpoints and Schemas

### 1. GET `/api/visual/public-samples`
- **Purpose**: Retrieve the list of all configured public evaluation samples with their expected metadata for regression testing.
- **Schema File**: [visual-public-samples-list.response.schema.json](visual-public-samples-list.response.schema.json)
- **Example File**: [examples/visual-public-samples-list.response.minimal.json](examples/visual-public-samples-list.response.minimal.json)

### 2. POST `/api/visual/public-samples/analyze`
- **Purpose**: Run visual indexing and regression analysis on a specific public visual sample.
- **Request Schema File**: [visual-public-samples-analyze.request.schema.json](visual-public-samples-analyze.request.schema.json)
- **Request Example File**: [examples/visual-public-samples-analyze.request.minimal.json](examples/visual-public-samples-analyze.request.minimal.json)
- **Response Schema File**: [visual-public-samples-analyze.response.schema.json](visual-public-samples-analyze.response.schema.json)
- **Response Example Files**: 
  - [examples/visual-public-samples-analyze.response.success.json](examples/visual-public-samples-analyze.response.success.json)
  - [examples/visual-public-samples-analyze.response.failure.json](examples/visual-public-samples-analyze.response.failure.json)

---

## Key Design Principles & Guidelines

- **Envelope Consistency**: The response contains a top-level `success` flag indicating execution status, and a structured `record` matching `image-analysis-record.v0.1.0`.
- **Diagnostics Separation**: Operational diagnostics, retry traces, and system-specific inputs are placed within the `record.diagnostics` block, preventing contamination of visual metadata schema boundaries.

---

## Compatibility and Lifecycle Policies

- **Breaking Change Policy**: This contract version `v0.1.0` is marked as **Stable**. No breaking changes will be made to this specific folder or its files. Any schema additions, removals, or required structural adjustments will require a bump to `v0.2.0` or a separate path namespace.
- **Compatibility Notes**: Backwards compatibility is guaranteed for all clients consuming `v0.1.0`. Optional fields may be added if they do not cause client parsing exceptions, but no required fields will be added.

---

## ⚠️ Known Limitations

1. **Envelope Open Validation**: The `record` field in `visual-public-samples-analyze.response.schema.json` is declared as a plain JSON object. To preserve decoupling and avoid complex, slow multi-file JSON schema compilation on simple clients, the response schema does not inline or compile reference resolvers for `image-analysis-record`.
2. **Validation Instruction**: Integrators **MUST** validate the nested `record` object separately against the canonical image analysis record schema located at:
   - `contracts/schemas/image-analysis-record/v0.1.0/schema.json`
