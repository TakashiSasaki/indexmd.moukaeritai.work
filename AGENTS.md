# indexmd Agent Instructions & Context

This file provides critical context and constraints for AI coding agents working on the `indexmd` project. **Read this before making any logic changes.**

## 🎯 Core Mission
Build a high-performance, cost-effective Google Drive indexer that generates/updates `index.md` files in every directory with AI-generated summaries.

## 🛠 Tech Stack
- **Frontend**: React 18 (Vite), Tailwind CSS, Lucide icons.
- **Backend**: Node.js (Express), `@google/genai` (Gemini SDK).
- **Storage**: 
  - **Firestore**: Tracks directory traversal state and metadata.
    - **Project ID**: `moukaeritaid`
    - **Database ID**: `indexmd-db` (Native mode)
    - **Collections**:
      - `users/{userId}/state/global_sync`: Tracks global sync tokens.
      - `users/{userId}/directories/{directoryId}`: Stores metadata for each directory.
  - **Local Filesystem**:
    - `src/data/validation_history.json` tracks processing success/fails.
    - `cache/experiment-history/experiment_history.json` tracks local experiment history (previously in `src/data/experiment_history.json`).
- **APIs**: Google Drive API (Advanced scope required for file manipulation).

## ⚠️ Critical Logic Constraints (Maintain at all costs)

### 1. Firestore Write Optimization (Billing Awareness)
- **Do NOT** perform unconditional `set` operations. Always check if data has changed (path, depth, parent_id) BEFORE writing to Firestore.
- **Batch Processing**: Use `writeBatch` for bulk directory updates (limit 450 per batch).
- **Rescan Avoidance**: Preserve `last_traversed_at` during path updates to prevent infinite rescans of unchanged folders.

### 2. The Gemini Fallback Engine (`server.ts`)
- **Resilient Generation**: The backend uses `generateContentWithRetry` which implements fallback chains (e.g., `gemini-3.5-pro` -> `gemini-3.1-pro-preview`).
- **Audit Logs**: When a fallback occurs, the *actually used* model must be recorded in `src/data/validation_history.json`.

### 3. File Protection Mechanism (Hybrid-Merge)
- `index.md` files are split into two zones:
  - **User Notes**: Manual content written by humans. **NEVER OVERWRITE THIS**.
  - **Auto-Generated**: Wrapped in `<!-- AUTO_GENERATED_START -->` and `<!-- AUTO_GENERATED_END -->`.
- When updating, only the block inside the markers is replaced.

### 4. Error Management (`src/main.tsx`)
- Benign errors (401 Expiry, Model Fallback warnings, Firestore temporary disconnects) are **muted** in the UI to prevent cluttering the user experience during transient network/API issues.

### 5. Testing & Debugging
- **Manual Input Test**: The application supports a "Manual Input Test" feature (accessible in `SummaryDebugger.tsx` and via `/api/drive/debug/generate-manual-summary`) to evaluate the schema and test models without requiring real Google Drive files.

## 🎨 Design Rules
- **Typography**: Primary font is `Inter`. Display/Headings use `Space Grotesk` or `Outfit` for a tech-focused feel.
- **Theme**: High-contrast light theme (`#F8FAFC` background) with Indigo (`#4F46E5`) as the primary brand color.
- **Tone**: Professional, tool-oriented, and humble. Avoid dramatic "AI" naming (e.g., call it "Summarizer", not "Neural Insight Core").

## 📂 Project Structure Note
- `src/components/DriveDashboard.tsx`: The heart of the application. Contains the scan orchestration, Firestore sync logic, and drive API calls.
- `server.ts`: Handles secure Gemini requests, Drive API proxying (to keep tokens secret), and history persistence.

## 🌿 Branch workflow for Google AI Studio and Jules

`main` is the source-of-truth branch used by Google AI Studio. Do not rename it.

`jules/integration` is the integration branch used by Jules. The workflow
`.github/workflows/sync-main-to-jules-integration.yml` keeps it up to date with
`main`.

Do not remove this workflow as unused or deprecated. It is repository-operation
infrastructure, not application runtime code.

The workflow may merge `main` into `jules/integration`, but must never reset or
force-push `jules/integration`. If a merge conflict occurs, it opens or updates a
PR from `automation/sync-main-to-jules-integration` into `jules/integration`.

## 🔒 Hard Safety Constraints
- **Drive Safety**: Do NOT delete Google Drive files, folders, or generated `index.md` files. Do NOT run full Drive-wide indexing.
- **Data Safety**: Firestore database ID is `indexmd-db`. Do not loosen security rules or re-add `(default)`.
- **Auth Safety**: Do NOT store refresh tokens anywhere. Do NOT store Drive access tokens in localStorage. Do NOT log OAuth tokens or API URLs.
- **File Safety**: Do NOT commit `cache/` contents. Do NOT use real private user documents as fixtures.
- **Quality Safety**: Always run `npm run lint`, `npm run test:unit`, and `npm run build` before committing. Use latest schema/prompt versions and keep schema changelogs updated.
