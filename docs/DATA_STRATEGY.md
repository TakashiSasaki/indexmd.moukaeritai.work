# Data Logic & Logic Strategy - indexmd

## 1. Firestore Schema (`users/{uid}`)
The database stores state to ensure sync across sessions without re-scanning thousands of folders.

### `directories/` Collection
- **`drive_id`**: PK, the Google Drive unique ID.
- **`parent_id`**: The Drive ID of the parent folder.
- **`path`**: Full breadcrumb path (e.g., `Mydrive/Project A/Assets`).
- **`sync_status`**: [`scanned`, `processing`, `indexed`].
- **`last_traversed_at`**: ISO Timestamp. If `null`, it forces a rescan.
- **`depth`**: Integer. Used to order processing from deepest (Bottom-Up).

## 2. Firestore Write Optimization (Cost Efficiency)
To minimize Cloud Firestore costs and stay within free tiers:
- **Change Detection**: We fetch local state once and only issue `batch.set` or `batch.update` if the new scan result differs from stored state.
- **Preservation Logic**: If a folder's `path` is updated but it was already `indexed`, we maintain the `last_traversed_at` field to prevent a redundant AI generation cycle.

## 3. index.md Protection Mechanism
The core of the "Hybrid-Merge" logic:
- The system reads the whole `index.md` if it exists.
- It looks for `<!-- AUTO_GENERATED_START -->` and `<!-- AUTO_GENERATED_END -->` markers.
- If they exist, it preserves everything *outside* the markers (the "User Section").
- If they don't exist, it appends the AI section to the bottom of the existing content.
- This ensures users can add manual notes to any folder without fear of deletion.

## 4. History Logging

### 4.1 Production Logs (`src/data/validation_history.json`)
A local JSON audit log for the developer/user to monitor:
- Timestamp of successful processing.
- The specific Gemini model used (handling fallbacks).
- MIME types and file names processed.
- Truncated to 100 entries to prevent oversized payloads.

### 4.2 Cache Layers (`cache/`)
The `cache/` directory is `.gitignore`d to prevent accidental commits of private data. It contains:
- `cache/snippets/`: Raw text snippets extracted from documents.
- `cache/summaries/`: Generated AI summaries.
- `cache/scan/`: Scanned Drive folder metadata.

### 4.3 Experiment History (`cache/experiment-history/experiment_history.json`)
Used for AI Summary Test workbench:
- Stores experimental runs of draft schemas (e.g., `v1.1.0-draft.1`).
- Saved in the ignored `cache/` directory to prevent accidental commits of private data.
- **Privacy/Safety Constraints**: Raw model output texts are NOT persisted by default. Only normalized structured JSON, validation diagnostics, schema versions, and metadata are saved.
- Provides detailed validation errors for structured schema tests without retaining PII in raw text.
