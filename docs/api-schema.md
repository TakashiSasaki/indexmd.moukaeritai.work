# API Schema Documentation

This document describes the request and response schemas for the primary API endpoints implemented in the `indexmd` server. These endpoints support Google Drive traversal, AI index generation, metadata workbench experiments, public visual samples analysis, and server cache observability.

---

## 📂 Summary of Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/health` | Service health status. |
| **GET** | `/api/validation-history` | List local validation audit logs (MIME types, models used, success/failure). |
| **GET** | `/api/experiment-history` | Fetch AI Summary Test experiment history (schema validation, warnings, repairs). |
| **POST** | `/api/experiment-history/clear` | Clear local experiment history records. |
| **GET** | `/api/drive/user` | Fetch current user info from Google API (using token). |
| **POST** | `/api/drive/scan` | Directory listing supporting incremental scan caching and PageToken auto-recovery. |
| **POST** | `/api/drive/clear-scan-cache` | Clear folder scan cache files from server disk. |
| **POST** | `/api/drive/clear-cache` | Clear document snippets and AI summaries cache files. |
| **POST** | `/api/drive/generate-index-step` | Formulate a single-folder `index.md` file using the AI Hybrid-Merge mechanism. |
| **GET** | `/api/drive/index-preflight/lookup` | Find existing `index.md` and check its status. |
| **GET** | `/api/drive/index-preflight/content` | Read existing raw `index.md` content for dry-run merges. |
| **POST** | `/api/drive/debug/generate-file-summary` | Generate a structured/unstructured summary for a single Drive file (workbench). |
| **POST** | `/api/drive/debug/generate-manual-summary` | Generate summary and run validations for manually entered text. |
| **GET** | `/api/visual/health` | Check visual model capability and Gemini/Gemma provider family. |
| **GET** | `/api/visual/public-samples` | List registered visual samples (landscapes, screenshots, documents). |
| **GET** | `/api/visual/public-samples/:sampleId/image` | Serve public sample images (supports variant thumbnails and full rasterization). |
| **POST** | `/api/visual/public-samples/analyze` | Perform experimental visual analysis on a public sample using Gemini/Gemma models. |
| **POST** | `/api/drive/debug/analyze-image` | Custom image upload analysis endpoint. |
| **GET** | `/api/cache/stats` | Retrieve cache metrics, entry counts, oldest/newest file ages, and process stats. |
| **POST** | `/api/cache/stats/reset` | Clear in-memory cache hit/miss counters (does not delete disk files). |

---

## 📡 Core Endpoint Specifications

### 1. `POST /api/drive/scan`
Traverses Google Drive folders, returns immediately sub-nested folders, and handles caching.

*   **Headers Required**:
    *   `x-google-drive-token`: `<OAuth_access_token>`
*   **Request Body**:
    ```json
    {
      "parentFolderId": "string (optional, e.g. 'root')",
      "nextPageToken": "string (optional)",
      "pageSize": "number (optional, default: 100)",
      "lastTraversedAt": "string (optional, ISO 8601)",
      "scanMode": "string (optional, e.g. 'flat', 'progressive')",
      "bypassCache": "boolean (optional, default: false)",
      "cacheScope": "string (optional)"
    }
    ```
*   **Success Response** (200 OK):
    ```json
    {
      "files": [
        {
          "id": "string",
          "name": "string",
          "mimeType": "string",
          "parents": ["string"],
          "modifiedTime": "string (ISO 8601)",
          "shortcutDetails": {
            "targetId": "string",
            "targetMimeType": "string"
          }
        }
      ],
      "nextPageToken": "string | null",
      "cached": "boolean",
      "pageTokenRecovered": "boolean (optional, if automatic PageToken recovery was triggered)"
    }
    ```
*   **Error Response** (401 Unauthorized / 400 Bad Request / 500 Internal Error):
    ```json
    {
      "error": "string"
    }
    ```

---

### 2. `POST /api/drive/generate-index-step`
Coordinates the bottom-up folder AI summarization and writes/patches the `index.md` file in Google Drive under the Hybrid-Merge mechanism.

*   **Headers Required**:
    *   `x-google-drive-token`: `<OAuth_access_token>`
*   **Request Body**:
    ```json
    {
      "folderId": "string (required)",
      "folderName": "string (required)",
      "config": {
        "rate_limit_delay_ms": "number (optional, default: 500)",
        "gemini_model": "string (optional, default: 'gemini-2.5-flash')"
      },
      "subdirsWithSummaries": [
        {
          "id": "string",
          "summary": "string (optional)"
        }
      ]
    }
    ```
*   **Success Response** (200 OK):
    *   *If folder contains items*:
        ```json
        {
          "success": true,
          "indexFileId": "string (the Drive ID of index.md)",
          "aiSummary": "string (the AI-generated summary of this directory)",
          "filesGenerated": "number (count of files processed)",
          "subdirsGenerated": "number (count of subfolders processed)"
        }
        ```
    *   *If folder is empty (skipped as per rules)*:
        ```json
        {
          "success": true,
          "message": "Folder is empty, skipped AI summarization as per rules.",
          "skipped": true,
          "files": [],
          "subdirectories": []
        }
        ```
*   **Error Response** (400 Bad Request / 500 Internal Error):
    ```json
    {
      "error": "string"
    }
    ```

---

### 3. `POST /api/drive/debug/generate-file-summary`
Used in the AI Summary Test workbench to analyze a single Google Drive file and generate structured JSON matching Summary Analysis Schema v1.2.0-draft.2.

*   **Headers Required**:
    *   `x-google-drive-token`: `<OAuth_access_token>`
*   **Request Body**:
    ```json
    {
      "fileId": "string (required)",
      "modelName": "string (optional, default: 'gemini-3.5-flash')",
      "temperature": "number (optional, default: 0)",
      "topP": "number (optional, default: 0)",
      "topK": "number (optional, default: 0)",
      "customInstruction": "string (optional)",
      "outputMode": "string (optional, 'structured' | 'text', default: 'text')",
      "jsonMode": "string (optional, 'prompt_only' | 'native_schema')",
      "includeRequestPreview": "boolean (optional, default: false)"
    }
    ```
*   **Success Response** (200 OK):
    ```json
    {
      "success": "boolean",
      "outputMode": "string ('structured' | 'text')",
      "metadata": {
        "id": "string",
        "name": "string",
        "mimeType": "string",
        "size": "string | number",
        "modifiedTime": "string (ISO 8601)"
      },
      "contentSampleSnippet": "string (truncated excerpt used as input, sanitized of private content in caches)",
      "summary": "string (present if outputMode is 'text')",
      "structured": "object (conforming to Summary Analysis Schema, present if outputMode is 'structured')",
      "validationErrors": "string[] (present if outputMode is 'structured')",
      "parseSuccess": "boolean (present if outputMode is 'structured')",
      "validationSuccess": "boolean (present if outputMode is 'structured')",
      "repairApplied": "boolean (optional, indicates if local schema repair was triggered)",
      "repairFallbackUsed": "boolean (optional, indicates if a backup parse/regular-expression fallback was invoked)",
      "requestPreview": {
        "model": "string",
        "outputMode": "string",
        "systemInstruction": "string (sanitized in cache)",
        "taskPrompt": "string (sanitized in cache)",
        "responseMimeType": "string (optional)",
        "responseSchema": "object (optional)",
        "effectiveStructuredExecutionMode": "string ('nativeSchema' | 'promptedJson')"
      }
    }
    ```
*   **Error Response** (400 Bad Request / 500 Internal Error):
    ```json
    {
      "error": "string",
      "providerError": {
        "statusCode": "number (optional)",
        "providerStatus": "string (optional)",
        "rawMessageSummary": "string (optional)"
      }
    }
    ```

---

### 4. `POST /api/drive/debug/generate-manual-summary`
Generates summaries and validates schema fields on raw manual text entered in the workbench scratchpad.

*   **Request Body**:
    ```json
    {
      "text": "string (required)",
      "inputLabel": "string (optional, used as label in history)",
      "modelName": "string (optional, default: 'gemini-3.5-flash')",
      "customInstruction": "string (optional)",
      "outputMode": "string (optional, 'structured' | 'text', default: 'text')",
      "jsonMode": "string (optional, 'prompt_only' | 'native_schema')",
      "includeRequestPreview": "boolean (optional, default: false)"
    }
    ```
*   **Success Response** (200 OK):
    *   Identical in structure to `POST /api/drive/debug/generate-file-summary` success payload, but with metadata hardcoded as:
        ```json
        {
          "metadata": { "name": "Manual Text Input", "mimeType": "text/plain" }
        }
        ```

---

### 5. `GET /api/visual/public-samples`
Returns a list of public images and synthetic documents registered in the system for visual indexing testing.

*   **Success Response** (200 OK):
    ```json
    [
      {
        "id": "string (e.g. 'starry-night')",
        "title": "string",
        "category": "string (e.g. 'landscape', 'document')",
        "expectedImageKind": "string (e.g. 'landscapePhoto', 'receiptPhoto')",
        "expectedElementCategories": ["string"],
        "expectedVisibleElementLabels": ["string"],
        "thumbnailRoute": "string (URL to fetch image thumbnail)",
        "licenseKind": "string",
        "licenseName": "string",
        "attributionText": "string",
        "sourcePageUrl": "string",
        "sourceProvider": "string ('wikimedia' | 'localFixture')",
        "sourceKind": "string ('external' | 'synthetic')",
        "isSynthetic": "boolean"
      }
    ]
    ```

---

### 6. `POST /api/visual/public-samples/analyze`
Dispatches a visual analysis on a public sample to extract visual features, elements, and text according to the Visual Analysis Schema (`v0.2.0-draft.1`).

*   **Request Body**:
    ```json
    {
      "sampleId": "string (required)",
      "modelName": "string (optional, default: 'gemini-3.5-flash')",
      "jsonMode": "string (optional, 'prompt_only' | 'native_schema')",
      "customInstruction": "string (optional)",
      "includeRequestPreview": "boolean (optional, default: false)"
    }
    ```
*   **Success Response** (200 OK):
    ```json
    {
      "success": true,
      "visualAnalysis": {
        "schemaVersion": "visual-analysis.v0.2.0-draft.1",
        "summary": {
          "caption": "string",
          "description": "string"
        },
        "visualInfo": {
          "imageKind": "string (e.g. 'landscapePhoto')",
          "imageKindConfidence": "number (0.0 to 1.0)",
          "sceneDescription": "string",
          "sceneContext": {
            "environment": "string ('indoor' | 'outdoor' | 'semiOutdoor' | 'unknown')",
            "cover": "string ('covered' | 'uncovered' | 'partiallyCovered' | 'unknown')",
            "weather": "string ('sunny' | 'cloudy' | 'rainy' | 'snowy' | 'foggy' | 'unknown')",
            "lighting": "string ('directSunlight' | 'shade' | 'artificialLight' | 'mixedLight' | 'lowLight' | 'unknown')",
            "accessibility": "string ('public' | 'private' | 'restricted' | 'commercial' | 'industrial' | 'residential' | 'unknown')",
            "roadwayContext": "string ('onRoad' | 'nearRoad' | 'offRoad' | 'insideBuilding' | 'unknown')",
            "placeType": "string",
            "description": "string",
            "confidence": "number (0.0 to 1.0)"
          },
          "visibleElements": [
            {
              "label": "string",
              "category": "string (e.g. 'landscapeElement', 'product')",
              "primary": "boolean (optional)",
              "count": "number (optional)",
              "attributes": ["string"],
              "stateContext": {
                "containment": "string",
                "exposure": "string",
                "placement": "string",
                "usage": "string",
                "interaction": "string",
                "condition": "string",
                "role": "string",
                "description": "string",
                "confidence": "number (0.0 to 1.0)"
              },
              "confidence": "number (0.0 to 1.0)",
              "evidence": "string (optional)",
              "locationHint": "string (optional)",
              "boundingBox": {
                "ymin": "number",
                "xmin": "number",
                "ymax": "number",
                "xmax": "number"
              } // optional
            }
          ],
          "visibleText": [
            {
              "text": "string",
              "confidence": "number (0.0 to 1.0)",
              "locationHint": "string (optional)",
              "boundingBox": {
                "ymin": "number",
                "xmin": "number",
                "ymax": "number",
                "xmax": "number"
              } // optional,
              "language": "string (optional)"
            }
          ],
          "uncertainties": ["string"]
        },
        "indexing": {
          "keywords": [
            {
              "value": "string",
              "confidence": "number (0.0 to 1.0)",
              "importance": "number (0.0 to 1.0)"
            }
          ]
        },
        "quality": {
          "confidence": "number (0.0 to 1.0)",
          "issues": ["string"]
        }
      },
      "analysisRun": {
        "model": "string",
        "promptVersion": "string",
        "systemInstructionVersion": "string",
        "schemaVersion": "string",
        "parameters": {
          "temperature": "number",
          "topP": "number",
          "topK": "number"
        }
      },
      "usedModelName": "string (backwards compatibility field)",
      "providerFamily": "string (backwards compatibility field, e.g. 'gemini', 'gemma')",
      "comparisonResult": {
        "isImageKindExact": "boolean",
        "detectedElementCategoriesMatched": ["string"],
        "detectedElementCategoriesDiverged": ["string"],
        "evaluationState": "string ('Exact' | 'Acceptable' | 'Diverged')"
      },
      "qualityGate": {
        "passed": "boolean",
        "criticalFailures": ["string"],
        "warnings": ["string"]
      },
      "parseDiagnostics": {
        "attempts": [
          {
            "method": "string",
            "success": "boolean",
            "error": "string (optional)",
            "outputLength": "number"
          }
        ],
        "preview": "string"
      },
      "diagnostics": {
        "inputImageSizeWarning": "string (optional)"
      }
    }
    ```

---

### 7. `GET /api/cache/stats`
Exposes the server runtime cache metrics and filesystem metadata. No raw file contents or PII are exposed.

*   **Success Response** (200 OK):
    ```json
    {
      "process": {
        "uptimeSeconds": "number",
        "pid": "number",
        "nodeEnv": "string",
        "heapUsedBytes": "number",
        "heapTotalBytes": "number"
      },
      "caches": {
        "scan": {
          "enabled": true,
          "policyVersion": null,
          "hits": "number",
          "misses": "number",
          "writes": "number",
          "bypasses": "number",
          "errors": "number",
          "entryCount": "number",
          "diskSizeBytes": "number",
          "oldestFileAgeSeconds": "number | null",
          "newestFileAgeSeconds": "number | null"
        },
        "snippets": {
          "enabled": "boolean",
          "policyVersion": null,
          "hits": "number",
          "misses": "number",
          "writes": "number",
          "bypasses": "number",
          "errors": "number",
          "entryCount": "number",
          "diskSizeBytes": "number",
          "oldestFileAgeSeconds": "number | null",
          "newestFileAgeSeconds": "number | null"
        },
        "summaries": {
          "enabled": true,
          "policyVersion": null,
          "hits": "number",
          "misses": "number",
          "writes": "number",
          "bypasses": "number",
          "errors": "number",
          "entryCount": "number",
          "diskSizeBytes": "number",
          "oldestFileAgeSeconds": "number | null",
          "newestFileAgeSeconds": "number | null"
        },
        "experimentHistory": {
          "enabled": true,
          "policyVersion": null,
          "hits": "number",
          "misses": "number",
          "writes": "number",
          "bypasses": "number",
          "errors": "number",
          "entryCount": "number",
          "diskSizeBytes": "number",
          "oldestFileAgeSeconds": "number | null",
          "newestFileAgeSeconds": "number | null"
        },
        "publicSampleImages": {
          "enabled": true,
          "policyVersion": "string (current policy version)",
          "hits": "number",
          "misses": "number",
          "writes": "number",
          "bypasses": "number",
          "errors": "number",
          "entryCount": "number",
          "diskSizeBytes": "number",
          "oldestFileAgeSeconds": "number | null",
          "newestFileAgeSeconds": "number | null"
        }
      }
    }
    ```

---

## 🔄 Batch Checkpoint & Resumption Policy

To manage and resume multi-sample visual analysis batches reliably in the front-end (avoiding memory limits and data inconsistency), the system follows a strict state coordination protocol.

### 1. Checkpoint to Batch Result Relationship
*   **The Checkpoint (`PublicSampleBatchCheckpoint`)** acts as a durable, transaction-safe snapshot in `localStorage` tracking current execution progress, API logs, and partial/failed item diagnostics.
*   **The Batch Result / Summary (`PublicSampleBatchRunSummary`)** is only generated upon complete execution or clean termination of all target samples, forming the final persistent report of the batch.
*   **Failures-Only Reports** are subset summaries focused strictly on elements that did not achieve positive verification. Their generation relies directly on the failed sample references cataloged in the checkpoint.

### 2. Consistency & In-App Inconsistency Prevention Policies
To ensure the resumed batch does not enter a broken or inconsistent state, the following rules are enforced:

*   **Fingerprint Matching Validation**: 
    Before resuming any batch, the system computes and validates a cryptographic/hash-based `runFingerprint` consisting of `modelName`, `jsonMode`, `customInstructionHash`, and `targetSampleIdsHash`. If any configuration changes (e.g., the user selects a different model or changes instructions), the checkpoint is marked as incompatible, prompting the user to either discard it or proceed under original constraints.
*   **Isolated Redos**:
    *   **Resume Pending Only**: Skips already completed samples (both success and fail) and strictly executes remaining `pendingSampleIds`.
    *   **Resume Failed Only**: Preserves successfully evaluated items in the checkpoint, resets `failedSampleIds` and items with `success: false`, and places them back into the execution queue to attempt re-generation/re-evaluation under identical model parameters.
    *   **Resume Failed + Pending**: Combines remaining pendings and resets failed items, allowing a fully comprehensive recovery.
*   **Capacity Strategic Shrunk (Local Storage Guard)**:
    Before storing to browser `localStorage`, raw large prompt payloads and full server responses are stripped or compressed using `shrinkCheckpointForLocalStorage` to stay safely below the 5MB browser quota.
*   **Write Atomicity**:
    Checkpoint state is saved atomically immediately *after* each sample API response is received, ensuring a browser crash or network loss never causes progress loss of previous elements.


---

## 🛠 Experimental Server-Side Job API Contract (Implemented)

As the second stride toward migrating visual analysis batches from client-side `localStorage` to a server-side robust job system, the following experimental API endpoints and structures have been implemented. The job models (`VisualBatchJob`, `VisualBatchJobItem`, `VisualBatchJobEvent`) track state in a disk-backed JSON store (`cache/visual-batch-jobs/*.json`).

### Endpoints

#### `POST /api/visual/batch-jobs`
Creates a new batch job on the server.
*   **Request Body**:
    ```json
    {
      "modelName": "gemini-2.5-pro",
      "jsonMode": "json_object",
      "customInstruction": "string (optional)",
      "targetSampleIds": ["string"]
    }
    ```
*   **Response**: `201 Created` with the newly generated `VisualBatchJob`.

#### `GET /api/visual/batch-jobs`
Retrieves a list of recent batch jobs.
*   **Response**: `200 OK` with an array of `VisualBatchJob` summaries (excluding full `items` payload for size).

#### `GET /api/visual/batch-jobs/:jobId`
Retrieves the current state and status of a specific batch job, including its items and diagnostic details.
*   **Response**: `200 OK` with `VisualBatchJob` object.

#### `GET /api/visual/batch-jobs/:jobId/items`
Retrieves the job items. Supports `?view=compact` (default) and `?view=full`.
- `view=compact`: Omits heavy payload fields like `record`, `responseRaw`, and diagnostics.
- `view=full`: Includes `record`, `responseRaw`, `diagnostics`, and `comparison`.

#### `GET /api/visual/batch-jobs/:jobId/reports/summary`
Retrieves the text summary report.

#### `GET /api/visual/batch-jobs/:jobId/reports/diagnostic`
Retrieves the diagnostic text report.

#### `GET /api/visual/batch-jobs/:jobId/reports/failures`
Retrieves a JSON report of failed items.

#### `GET /api/visual/batch-jobs/:jobId/reports/full`
Retrieves the full batch JSON report. This report includes `item.record` for all successful samples. `executionPrivate` and `customInstruction` are stripped out for safety.

#### `POST /api/visual/batch-jobs/:jobId/actions:resume`
Instructs the server to resume a paused or interrupted batch job.
*   **Request Body**:
    ```json
    {
      "includeFailed": "boolean",
      "onlyFailed": "boolean"
    }
    ```

#### `POST /api/visual/batch-jobs/:jobId/cancel`
Instructs the server to cancel a running batch job.

### Model Definitions

The `VisualBatchJob` defines the durable state of a batch run, which will be eventually persisted to Firestore or another database.
The `VisualBatchJobEvent` tracks lifecycle events such as `jobQueued`, `jobStarted`, `sampleStarted`, and `jobCompleted` for audit logs and progress tracking. `VisualBatchJobItem` holds the specific outcomes of individual sample processing, including parsed outputs and diagnostic metrics. 

Currently, `batchCheckpoint.ts` uses the `VisualBatchJobEvent` schema to standardize local event tracking and includes `lastHeartbeatAt` and `lastCheckpointSavedAt` to enable heartbeat monitoring in the UI.


### Architecture and Limitations
- **Job Store**: Currently uses a disk-backed JSON store in `cache/visual-batch-jobs/`.
- **Heartbeat**: 
  - *Client-side checkpoint heartbeat*: indicates the browser tab is alive.
  - *Server-side heartbeat*: indicates the server job runner last updated the state.
- **Data Persistence**: In Google Cloud Run or AI Studio preview, local disk may be wiped upon instance restart.
- **Future TODOs**: Migrate to Firestore for durable job state and Cloud Tasks / Pub/Sub for distributed workers.
