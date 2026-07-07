# Data Logic & Storage Strategy - indexmd

This document defines the storage architecture, data models, privacy controls, and cache mechanisms used in the `indexmd` project. It serves as the primary schema map to trace relationships across JSON Schemas, TypeScript declarations, Firestore persistence layers, and API exchange schemas.

---

## 🗺️ Schema Map & Data Lifecycle

The application operates across distinct, strictly bounded schema layers:

```
                  [ Google Drive API / Filesystem ]
                                 │
                     (MIME Type / Raw Content)
                                 │
                                 ▼
                     [ Gemini / Gemma Models ]
                                 │
         (Structured Outputs / Controlled Vocabularies)
                                 │
                                 ▼
                    [ Validation & Sanitization ]
            (schemas/ & src/lib/privacyAndCache.ts)
             ┌───────────────────┴───────────────────┐
             ▼                                       ▼
    [ AI Summary Indexing ]                [ Visual Analysis Experiment ]
  Summary Analysis Schema v1.2            Visual Analysis Schema v0.2
 (schemas/summary-analysis.v1.2.0)       (schemas/visual-analysis.v0.2.0)
             │                                       │
             ▼                                       ▼
  [ Firestore Persistence ]                [ Transient Evaluation Only ]
 (users/{uid}/file_summaries/)             (Omitted from DB, rendered in
 (users/{uid}/directories/)                "画像解析実験" tab workbench)
             │
             ▼
   [ read-only index.md ]
     (Client-side preview)
```

1.  **Summary Analysis Schema (v1.2.0-draft.2)**: Established as the **Source of Truth** for document indexing. Governed by `/schemas/summary-analysis.v1.2.0-draft.2.schema.json`. Instantiated inside Firestore as `FileSummaryMetadata` documents.
2.  **Visual Analysis Schema (v0.2.0-draft.1)**: Experimental layout for visual indexing and OCR analysis. Governed by `/schemas/visual-analysis.v0.2.0-draft.1.schema.json`. Kept completely transient during this phase; no raw visual data or image bytes are stored in the database.
3.  **Local Cache Layers**: `.gitignore`d folder caches at `cache/` to speed up operations and respect provider rate/quota limits.
4.  **Audit Logs**: Structured histories kept locally or written to Firestore under strict privacy filters.

---

## 💾 1. Firestore Persistence Schema (`users/{userId}`)

The Firestore schema represents the durable state of the application. It is designed for maximum query performance and cost efficiency, avoiding redundant scans and billing charges.

All paths are scoped under:
```
users/{userId}
```

---

### Collection: `directories/`
Tracks the directory structure of Google Drive, traversal progress, and status for bottom-up indexing.

*   **Path**: `users/{userId}/directories/{directoryId}`
*   **Document ID**: Unique Google Drive Folder ID (`directoryId` or `drive_id`).
*   **Properties**:

| Field Name | Firestore Type | TS Type / Value | Description |
| :--- | :--- | :--- | :--- |
| `drive_id` | `string` | `string` | **Required.** The unique Google Drive Folder ID (matches Document ID). |
| `name` | `string` | `string` | **Required.** Human-readable directory name. |
| `path` | `string` | `string` | **Required.** Breadcrumb path from root (e.g., `/My Folder/Subfolder`). |
| `depth` | `integer` | `number` | **Required.** Folder level depth (Root = `0`, nested are `1, 2, ...`). |
| `index_status` | `string` | `"pending" \| "processing" \| "indexed" \| "error"` | **Required.** Current status of directory's indexing process. |
| `last_traversed_at` | `string` | `string \| null` | **Nullable.** ISO 8601 timestamp of last traversal scan. If null, forces rescan. |
| `last_updated_at` | `string` | `string \| null` | **Nullable.** ISO 8601 timestamp of last indexing modification. |
| `parent_id` | `string` | `string \| null` | **Nullable.** Drive ID of parent folder. Null for root. |
| `ai_summary` | `string` | `string (optional)` | Generated folder-level AI summary. |

*   *Note on Alignments*: This collection utilizes **`index_status`** instead of `sync_status` to represent folder indexing state. `sync_status` is reserved exclusively for global traversal loop states.

---

### Collection: `file_summaries/`
Stores durable AI-generated structured analysis results and execution provenance metadata for each processed Google Drive file.

*   **Path**: `users/{userId}/file_summaries/{fileId}`
*   **Document ID**: Unique Google Drive File ID (`fileId`).
*   **Properties**:

| Field Name | Firestore Type | TS Type / Value | Description |
| :--- | :--- | :--- | :--- |
| `fileId` | `string` | `string` | **Required.** Unique Google Drive file ID. |
| `fileName` | `string` | `string (optional)` | The file's name. |
| `mimeType` | `string` | `string (optional)` | Google Drive MIME type. |
| `modifiedTime` | `string` | `string (optional)` | ISO 8601 timestamp of the file's last modified time in Drive. |
| `parentId` | `string` | `string (optional)` | Google Drive ID of parent folder containing this file. |
| `schemaVersion` | `string` | `string` | **Required.** Active Summary Analysis Schema version (e.g. `1.2.0-draft.2`). |
| `promptVersion` | `string` | `string` | **Required.** Active prompt template version (e.g. `2026-07-07`). |
| `systemInstructionVersion` | `string` | `string` | **Required.** Active system instruction version (e.g. `1.2.0-draft.2`). |
| `model` | `string` | `string` | **Required.** Precise model ID used to generate the summary (e.g. `gemini-2.5-flash`). |
| `outputMode` | `string` | `"structured"` | **Required.** Structured extraction indicator. |
| `summary` | `string` | `string` | **Required.** Compact short one-line description. |
| `structured` | `map` | `SummaryAnalysisResultV12` | **Required.** Validated structured fields nested map matching the active JSON schema. |
| `validationErrors` | `array` | `string[]` | Validation error diagnostics if any schema requirements failed. |
| `parseSuccess` | `boolean` | `boolean` | **Required.** True if model JSON string parsing succeeded. |
| `validationSuccess` | `boolean` | `boolean` | **Required.** True if parsed object conformed to active schema. |
| `generatedAt` | `string` | `string` | **Required.** ISO 8601 timestamp when summary was built. |
| `source` | `string` | `"ai-summary-test" \| "drive-debugger" \| "future-indexing"` | **Required.** The client component or runner source. |
| `cacheKey` | `string` | `string (optional)` | Associated cache key on server disk. |
| `normalizedPayloadHash` | `string` | `string (optional)` | Deterministic hash used to evaluate payload changes for write-skipping. |

---

### Collection: `state/`
Holds user-specific session trackers, global traverse configurations, and diagnostic records.

#### Document: `users/{userId}/state/global_sync`
Tracks the global state of incremental Drive scans, page-tokens, and folder traversal loops.

*   **Properties**:

| Field Name | Firestore Type | TS Type | Description |
| :--- | :--- | :--- | :--- |
| `nextPageToken` | `string` | `string \| null` | **CamelCase.** Google Drive API next page token. Null if page 1 or fully completed. |
| `sync_status` | `string` | `"idle" \| "running" \| "paused" \| "error"` | **Snake_case.** Current status of the traversal runner. |
| `last_traversed_at` | `string` | `string \| null` | **Snake_case.** ISO 8601 timestamp of last processed traversal scan step. |
| `is_fully_synced` | `boolean` | `boolean` | **Snake_case.** True if no more pages or un-traversed folders remain. |
| `ignored_folder_names` | `array` | `string[]` | **Snake_case.** Array of foldernames skipped by search filters. |
| `skip_existing` | `boolean` | `boolean` | **Snake_case.** True if already processed folders are ignored. |
| `root_next_page_token` | `string` | `string \| null` | **Snake_case.** Base next page token for root folder listing. |
| `root_last_traversed_at`| `string` | `string \| null` | **Snake_case.** ISO 8601 timestamp of root folder traversal. |
| `updated_at` | `timestamp` | `FieldValue` | **Snake_case.** Server timestamp of the latest state sync. |

*   *Note on Naming Conventions*: This document utilizes a **camelCase** property `nextPageToken` for direct mapping with Google API payloads, while utilizing **snake_case** for other orchestration settings (e.g., `sync_status`, `is_fully_synced`, `ignored_folder_names`, etc.).

#### Document: `users/{userId}/state/config`
Saves user-configured system preferences for rate limiting, models, and JSON formats.

*   **Properties**:

| Field Name | Firestore Type | TS Type | Description |
| :--- | :--- | :--- | :--- |
| `rate_limit_delay_ms` | `integer` | `number` | Time delay (ms) between consecutive AI requests. |
| `max_logs_count` | `integer` | `number` | Upper bounds of locally retained in-memory diagnostic logs. |
| `logs_cleanup_threshold`| `integer` | `number` | Count of logs left after a cleanup cycle triggers. |
| `gemini_model` | `string` | `string` | Active Gemini/Gemma model identifier (e.g. `gemini-2.5-flash`). |
| `json_mode` | `string` | `"prompt_only" \| "native_schema"` | Enforces schema constraints via prompt instruction or native model schemas. |

#### Document: `users/{userId}/state/diagnostics`
Test-target record used strictly during write permissions audits to confirm user-authenticated write validity.

*   **Properties**:
    *   `last_test_at`: `string` (ISO timestamp).
    *   `uid`: `string` (Authenticated user ID).
    *   `db_id`: `string` (Native Firestore database ID).

---

### Collection: `logs/`
Optional high-watermark logs collection. *Note: Under active cost-efficiency rules, the application defaults to in-memory local logging state in the client to eliminate Firestore write billing noise.*

---

## 🔒 2. Privacy, Sanitization & Redaction Rules

To comply with zero-trust token safety rules, avoid commits of personal identifiers (PII), and enforce repository hygiene, **no private document data, raw prompts, or credentials may be stored inside durable caches or logs**.

### Redacted and Excluded Fields
When compiling summaries for local file caching (`cache/summaries/`), local experiment history files (`cache/experiment-history/experiment_history.json`), or public reports, the system **MUST** strip:

*   **`rawText`**: Entire raw extracted plain text.
*   **`rawOutput`**: Raw, unparsed markdown/string output returned by the model.
*   **`rawPrompt` / `taskPrompt`**: Complete text prompt dispatched to the API.
*   **`systemInstruction` / `customInstruction`**: Complete instruction sets.
*   **`contentSampleSnippet`**: Truncated input snippet.
*   **`requestPreview`**: Complete raw request configuration parameters.

This logic is enforced programmatically in:
*   `src/lib/privacyAndCache.ts` (`sanitizeResultForCache`, `sanitizeResultForHistory`)
*   `server.ts` API route dispatchers.

---

## 🏎️ 3. Cache Layers & Metrics Structure (`cache/`)

Filesystem caching prevents redundant API invocations, respects Wikimedia/Google Drive quota limits, and enables detailed developer-facing observability. All cache files are ignored in `.gitignore` and reside under `/cache`.

### Cache Inventory

| Cache Name | Storage Location | Key Generation | Cache File Content |
| :--- | :--- | :--- | :--- |
| **`scan`** | `cache/scan/` | MD5 of parent ID, nextPageToken, traversal timestamp, page size, and scope. | Raw JSON from Google Drive folder listing. |
| **`snippets`** | `cache/snippets/` | Google Drive File ID (`{fileId}.txt`). | Raw extracted plain text (if `ENABLE_DRIVE_CONTENT_CACHE=true`). |
| **`summaries`** | `cache/summaries/` | Unique hash of fileId, modelName, parameters, and modifiedTime. | Sanitized `FileSummaryMetadata` JSON. |
| **`experimentHistory`** | `cache/experiment-history/` | Single file: `experiment_history.json`. | Array of sanitized `ExperimentHistoryRecord` objects. |
| **`publicSampleImages`**| `cache/public_samples/` | Unique sample ID. | Local cache of public image binaries. |

### Cache Metrics Endpoint (`GET /api/cache/stats`)
Server-side cache statistics are collected in-memory inside the active process via `src/lib/cacheMetrics.ts`. The metrics structure records:
*   `hits`: Cache lookups found on disk.
*   `misses`: Cache lookups not found.
*   `writes`: Successful writes to disk cache.
*   `bypasses`: Explicit bypass requests.
*   `errors`: File I/O or parsing errors.
*   `entryCount`: Total files stored in folder on disk.
*   `diskSizeBytes`: Total folder size on disk.
*   `oldestFileAgeSeconds` / `newestFileAgeSeconds`: Calculated ages of cached files to evaluate staleness.

---

## 🌿 4. Firestore Cost-Efficiency Write Optimizations

To operate securely within free tiers and maintain extreme cost efficiency:
*   **Hash Equivalence Check**: Before sending a write to Firestore for `file_summaries`, `src/lib/summaryMetadata.ts` computes a deterministic cyrb53 hash of sorted canonical fields (`normalizedPayloadHash`). If the existing record has the same hash, the write is completely bypassed (`shouldSkipFirestoreSummaryWrite`).
*   **Preservation of Scan Timing**: If a folder path is updated but already exists with an `indexed` status, we maintain the original `last_traversed_at` timestamp. This prevents triggering infinite, costly crawl cascades.
*   **Batch Operations**: Large traversal listings are written in unified batches (`writeBatch`, capped at 450 items per write) to compress write counts.
