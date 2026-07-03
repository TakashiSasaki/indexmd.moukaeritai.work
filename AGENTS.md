# indexmd Agent Instructions & Context

This file provides critical context and constraints for AI coding agents working on the `indexmd` project. **Read this before making any logic changes.**

## 🎯 Core Mission
Build a high-performance, cost-effective Google Drive indexer that generates/updates `index.md` files in every directory with AI-generated summaries. The project also contains Visual Analysis experiments, public sample diagnostics, cache observability, and developer tooling used to validate indexing-related AI workflows.

## 🛠 Tech Stack
- **Frontend**: React 19 (Vite), Tailwind CSS, Lucide icons.
- **Backend**: Node.js (Express), `@google/genai` (Gemini SDK).
- **Build/Test Tooling**: TypeScript, Vite, esbuild, Node test runner via `tsx`, Playwright available for browser-oriented checks.
- **Storage**:
  - **Firestore**: Tracks directory traversal state and metadata.
    - **Project ID**: `moukaeritaid`
    - **Database ID**: `indexmd-db` (Native mode)
    - **Collections**:
      - `users/{userId}/state/global_sync`: Tracks global sync tokens.
      - `users/{userId}/directories/{directoryId}`: Stores metadata for each directory.
  - **Local Filesystem Runtime State**:
    - `src/data/validation_history.json`: Tracks processing success/fail history.
    - `cache/scan`: Folder scan result cache.
    - `cache/snippets`: Optional Drive content snippet cache, controlled by `ENABLE_DRIVE_CONTENT_CACHE`.
    - `cache/summaries`: AI summary cache.
    - `cache/experiment-history`: Experiment history cache.
    - `cache/public_samples`: Visual Analysis public sample image cache.
- **APIs**: Google Drive API and Gemini API. Keep OAuth tokens and API keys out of logs, localStorage, fixtures, reports, and commits.

## ⚠️ Critical Logic Constraints (Maintain at all costs)

### 1. Firestore Write Optimization (Billing Awareness)
- **Do NOT** perform unconditional `set` operations. Always check if data has changed (path, depth, parent_id) BEFORE writing to Firestore.
- **Batch Processing**: Use `writeBatch` for bulk directory updates (limit 450 per batch).
- **Rescan Avoidance**: Preserve `last_traversed_at` during path updates to prevent infinite rescans of unchanged folders.

### 2. Gemini Provider Resilience (`server.ts`, `src/lib/gemini.ts`)
- **Resilient Generation**: The backend uses `generateContentWithRetry` for model calls and retry/fallback handling.
- **Quota/Rate-Limit Taxonomy**: Preserve distinct handling for provider quota/rate-limit failures such as `providerRateLimited` and `providerQuotaExceeded`. Do not collapse them into generic `generationError` in reports.
- **Retry Diagnostics**: Keep retry diagnostics compact and secret-free. Do not log tokens, prompts containing private content, raw private documents, or API keys.
- **Audit Logs**: When a fallback occurs, the actually used model must be recorded in history/diagnostics where applicable.

### 3. File Protection Mechanism (Hybrid-Merge)
- `index.md` files are split into two zones:
  - **User Notes**: Manual content written by humans. **NEVER OVERWRITE THIS**.
  - **Auto-Generated**: Wrapped in `<!-- AUTO_GENERATED_START -->` and `<!-- AUTO_GENERATED_END -->`.
- When updating, only the block inside the markers is replaced.

### 4. Error Management (`src/main.tsx`)
- Benign errors (401 expiry, model fallback warnings, Firestore temporary disconnects) are muted in the UI to prevent cluttering the user experience during transient network/API issues.
- Do not mute blocking data-loss, schema, provider quota, or cache integrity problems in developer diagnostics.

## 🎨 Design Rules
- **Typography**: Primary font is `Inter`. Display/headings may use `Space Grotesk` or `Outfit` for a tool-oriented technical feel.
- **Theme**: High-contrast light theme (`#F8FAFC` background) with Indigo (`#4F46E5`) as the primary brand color.
- **Tone**: Professional, tool-oriented, and humble. Avoid dramatic "AI" naming (e.g., call it "Summarizer", not "Neural Insight Core").

## 📂 Project Structure Note
- `src/components/DriveDashboard.tsx`: Main application dashboard for scan orchestration, Firestore sync, Drive operations, and developer-facing control surfaces.
- `server.ts`: Backend API surface for secure Gemini requests, Drive API proxying, cache statistics, public sample image serving, and history persistence.
- `src/components/CacheStatsTab.tsx`: Server runtime/cache observability UI. It must not display cached file contents, secrets, tokens, or raw private data.
- `src/lib/cacheMetrics.ts`: Server-side process-local cache metrics and filesystem inventory helpers.
- `src/lib/visualAnalysis/`: Visual Analysis schema, provider schema, canonicalization, validation, prompts, model output parsing, and provider failure handling.
- `src/lib/visualAnalysis/publicSamples/`: Public sample registry, sample fetching, batch report builders, comparison artifacts, and image validation.
- `schemas/`: JSON schemas used by runtime validators and prompts.
- `docs/maintenance/repository-health.md`: Canonical repository health maintenance instructions.
- `skills/`: Workspace-local agent skills.

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

See `docs/branch-workflow.md` for the detailed operational contract.

## 🧹 Maintenance Lane (Repository Health)

For repository health maintenance tasks, read and follow `docs/maintenance/repository-health.md` before making changes. If the agent supports workspace-local skills, also read `skills/repository-health-maintenance/SKILL.md`.

Maintenance tasks should check and, when safe, repair drift across:
- documentation, README, AGENTS.md, and developer-facing pages;
- schema, provider schema, prompts, validators, canonicalizers, and tests;
- server endpoint contracts and frontend consumers;
- cache metrics, CacheStatsTab, public sample image cache, and report summaries;
- provider quota/rate-limit taxonomy and legacy artifact fallback classification;
- branch workflow documentation and protected automation;
- privacy, token safety, fixture safety, and repository hygiene;
- package scripts, dependency placement, case-sensitive paths, and validation commands.

Safe maintenance changes include documentation corrections, non-breaking fallback handling, test fixture updates, command list alignment, UI label clarification, and validation/script consistency fixes. Do not perform destructive Drive/Firestore operations, schema semantic changes, security-rule loosening, force-push/reset operations, or workflow deletion as part of routine maintenance.

## 🔒 Hard Safety Constraints
- **File System Case Sensitivity**: Do NOT create multiple files in the same directory that differ only by uppercase/lowercase letters (e.g., `testing.md` vs `TESTING.md`). This causes conflicts on case-insensitive file systems like Windows.
- **Drive Safety**: Do NOT delete Google Drive files, folders, or generated `index.md` files. Do NOT run full Drive-wide indexing.
- **Data Safety**: Firestore database ID is `indexmd-db`. Do not loosen security rules or re-add `(default)`.
- **Auth Safety**: Do NOT store refresh tokens anywhere. Do NOT store Drive access tokens in localStorage. Do NOT log OAuth tokens, Gemini API keys, API URLs containing credentials, or Authorization headers.
- **File Safety**: Do NOT commit `cache/` contents. Do NOT use real private user documents as fixtures.
- **Report Safety**: Do NOT commit raw model output, request previews, private document text, tokens, or API keys in exported artifacts or fixtures.
- **Quality Safety**: Before committing, run `npm run lint`, `npm run test:unit`, `npm run build`, and `npm run validate:public-samples:images` unless the task explicitly documents why a command cannot be run. Use latest schema/prompt versions and keep schema-related docs/tests aligned.

## 🛠 Local Agent Skills (Workspace Local)
In addition to the standard system skills, this project defines **workspace-local skills** in the `skills/` directory at the project root.
- When performing repetitive or complex tasks (e.g., testing local API endpoints or SDK features), check the `skills/` directory for established local conventions and boilerplate scripts.
- For local endpoint and Gemini SDK verification, see `skills/local-testing/SKILL.md`.
- For repository health maintenance, see `skills/repository-health-maintenance/SKILL.md` and the canonical instructions in `docs/maintenance/repository-health.md`.
