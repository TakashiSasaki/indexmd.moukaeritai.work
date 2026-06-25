# Saved Metadata Workbench & Verification Guide

This document defines the architecture, data structures, and usage guidelines for the **Saved Summaries Browser** and the read-only **`index.md` Preview** system, acting as a highly stable verification workbench before any real Google Drive write operations are introduced.

---

## 📂 Firestore Path Specification

All saved file-level summary metadata documents are securely scoped under individual authenticated users:

```
users/{userId}/file_summaries/{fileId}
```

- `{userId}`: Authenticated Google User ID.
- `{fileId}`: Google Drive Unique File ID.

---

## 💾 Schema Fields

Each metadata document in the `file_summaries` collection conforms strictly to the `FileSummaryMetadata` TypeScript interface:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `fileId` | `string` | **Required.** The unique Google Drive file identifier. |
| `fileName` | `string (optional)` | The cached human-readable filename on Google Drive. |
| `mimeType` | `string (optional)` | The file's MIME type (e.g., `application/pdf`). |
| `modifiedTime` | `string (optional)` | The ISO timestamp of the file's last modification on Google Drive. |
| `parentId` | `string (optional)` | The Google Drive Folder ID containing this file. |
| `schemaVersion` | `string` | **Required.** Version of the structured JSON schema used to analyze. |
| `promptVersion` | `string` | **Required.** Version of the prompt template used for model instruction. |
| `systemInstructionVersion` | `string` | **Required.** Version of the system instructions provided to the model. |
| `model` | `string` | **Required.** The precise model used to generate this summary (e.g., `gemini-2.5-pro`). |
| `outputMode` | `"structured"` | **Required.** Must be `"structured"`. |
| `summary` | `string` | **Required.** Fallback short summary of the document. |
| `structured` | `SummaryAnalysisResult` | **Required.** The fully validated, parsed JSON object containing structured analysis fields (e.g. `oneLineSummary`, `topics`, `keywords`, `documentTypes`, `subjectAreas`, etc.). |
| `validationErrors` | `string[]` | Array of schema validation error messages, if any. |
| `parseSuccess` | `boolean` | **Required.** Indicates if the model's raw string was successfully parsed as JSON. |
| `validationSuccess` | `boolean` | **Required.** Indicates if the parsed object conforms strictly to the validation schema. |
| `generatedAt` | `string` | **Required.** ISO 8601 timestamp when the summary was generated. |
| `source` | `"ai-summary-test"` | **Required.** Identifies the runner or module that initiated generation. |

---

## 🔒 Security & Omitted Fields

To maintain strict data security and comply with zero-trust credentials rules, **saved summaries MUST NEVER store any of the following fields**:

- **No Raw Model Output**: The raw unstructured text from Gemini is parsed, extracted, and discarded. Only structured fields are kept.
- **No Raw File Content / Snippets**: Unprocessed file contents used during model reasoning are never persisted.
- **No Manual Input Text**: Hand-entered text analyzed in scratchpad/manual mode is completely excluded.
- **No Credentials or Tokens**: Access tokens, refresh tokens, auth codes, and API keys are completely stripped and omitted.
- **No Raw Endpoint URLs / API Metadata**: No raw Google API URLs, page tokens, or raw page request metadata are recorded.

Verification of these rules is covered by pure automated unit tests in `savedSummaryBrowser.test.ts`.

---

## 🏷️ Metadata Status Meanings

The workbench analyzes saved metadata against the currently running application configuration using `getSummaryMetadataStatus` and outputs one of six highly specific statuses:

1. **`missing`**: No saved summary exists for the given file in Firestore.
2. **`current`**: The saved summary is valid, matches the current schema, current prompt, and current system instruction versions, and is not older than the Drive file.
3. **`stale-schema`**: The summary's `schemaVersion` does not match the active `SUMMARY_ANALYSIS_SCHEMA_VERSION` in the codebase.
4. **`stale-prompt`**: Either the `promptVersion` or `systemInstructionVersion` does not match the codebase's active definitions, requiring regeneration to align with updated instructions.
5. **`stale-file`**: The file's `modifiedTime` on Google Drive is newer than the saved summary's `modifiedTime`, indicating the document has changed.
6. **`invalid`**: The record is malformed, missing required fields, or failed parsing/validation (`parseSuccess: false` or `validationSuccess: false`).

The `getSummaryMetadataStatusReasons` helper dynamically compiles descriptive user-facing warnings for non-current entries.

---

## 🛠 Features

1. **Metadata Inspector**: Examine JSON metadata (ID, version, prompt info) for each folder.
2. **Read-only Index Preview**: See how the `index.md` would look with the saved metadata.
3. **Hybrid Merge (Dry-run)**:
   - **Manual Mode**: Paste existing markdown to test user-content preservation.
   - **Drive-connected Preflight**: 
     - Automatically finds `index.md` in the folder on Google Drive.
     - Fetches content read-only.
     - Runs a dry-run merge and reports write-readiness status.
     - **Safety**: No data is written to Drive or Firestore during this process.

---

## 🚦 Preflight Statuses

The workbench analyzes the Drive state and the generated preview to output a preflight result:

- `merge-ready`: Successfully matched markers or appended. Ready for future writes.
- `missing-index`: No existing file. Future write will create a new one.
- `multiple-index-candidates`: Multiple `index.md` files found. Automatic merge blocked for safety.
- `read-error`: File found but could not be read as text.
- `merge-blocked`: Existing file found but markers are missing (and append is disabled) or malformed.

---

## 📄 Read-Only `index.md` Preview Behavior

The workbench includes a fully isolated visual previewer for directories:

- **Strict Client-Side Generation**: Markdown is computed dynamically on-the-fly in memory using only the metadata currently loaded in the client-side state.
- **Zero Drive Modifying Activity**: Preview generation **never** triggers Google Drive writes, file updates, file creations, or deletions.
- **No Firestore Mutation**: No data is updated in Firestore during preview rendering.
- **Clear Read-Only Labels**: The UI prominently features warnings indicating `"読込専用デモ (Read-Only / Preview)"` and `"Driveには書き込みません"`.
- **Graceful Error Handling**: Fallbacks are applied if files in a folder are stale, invalid, or missing optional fields (e.g. unknown types are styled as `"不明"`, empty subject areas are noted as `"なし"`).

---

## 🚫 Excluded Operations in This Phase

To avoid accidental corruption of files and keep the workbench focused on verification and audit quality:

- **No Delete Controls**: No delete buttons or Firestore record purging UI is implemented.
- **No Bulk Operations**: No mass regeneration, mass saving, or mass copying controls are present.
- **No Drive Writes**: No "Save to Drive" or "Write index.md to Folder" buttons exist in this milestone.

---

## 🚀 Expected Next Milestone

Once the workbench verification achieves perfect confidence across developers, the next step involves implementing the hybrid-merge writing module:
1. Fetching existing `index.md` files from targeted folders.
2. Isolating User-authored notes outside of the Auto-generated boundaries.
3. Writing the updated hybrid markdown containing the merged summaries back to the target Drive folder under user consent.
