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
        "expectedMetadata": {
          "imageKind": "string",
          "acceptableImageKinds": ["string"],
          "elementCategories": ["string"],
          "elementCategoryAlternatives": { "string": ["string"] },
          "visibleElementLabels": ["string"],
          "visibleElementLabelAliases": { "string": ["string"] },
          "visibleText": ["string"],
          "notes": ["string"],
          "optionalElementCategories": ["string"],
          "optionalVisibleElementLabels": ["string"],
          "optionalVisibleElementLabelAliases": { "string": ["string"] },
          "optionalVisibleText": ["string"]
        },
        "source": {
          "provider": "string",
          "kind": "string",
          "licenseKind": "string",
          "licenseName": "string",
          "attributionText": "string",
          "pageUrl": "string",
          "isSynthetic": "boolean"
        },
        "thumbnailRoute": "string (URL to fetch image thumbnail)"
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
      "record": {
        "schemaVersion": "image-analysis-record.v0.1.0",
        "status": {
          "success": true
        },
        "assetMetadata": {
           "assetId": "string",
           "sourceProvider": "publicSamples"
        },
        "technicalMetadata": {
           "mimeType": "image/jpeg",
           "originalByteLength": 12345
        },
        "visualAnalysis": {
          "schemaVersion": "visual-analysis.v0.2.0-draft.1",
          "summary": {},
          "visualInfo": {}
        },
        "analysisRun": {
          "metadata": {},
          "execution": {}
        },
        "evaluation": {
          "expectedMetadata": {},
          "qualityStatus": "excellent",
          "qualityScore": 100,
          "qualityIssues": []
        },
        "diagnostics": {
          "input": {},
          "parse": {},
          "generation": {},
          "normalization": {}
        }
      },
      "requestPreview": {}
    }
    ```

*   **Notes**:
    *   The API returns a canonical `ImageAnalysisRecord` shape for all responses (success, generation failure, parse failure, or schema validation failure).
    *   `record.visualAnalysis` contains the actual extracted visual content.
    *   `record.evaluation.expectedMetadata` contains the benchmark ground-truth expectations.
    *   `record.evaluation` contains the quality gate evaluation (`qualityStatus`, `qualityScore`, `qualityIssues`).
    *   `record.diagnostics` contains telemetry for `input`, `parse`, `generation`, and `normalization` stages.
    *   `record.assetMetadata` contains license and sample source metadata.
    *   `record.technicalMetadata` contains image sizing and MIME metadata.