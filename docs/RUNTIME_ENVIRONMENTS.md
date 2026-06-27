# Runtime Environments

This document details the differences across the various runtime and execution environments where `indexmd` operates.

## 1. Google AI Studio (Source of Truth)
- **Branch:** `main`
- **Execution:** Web-based IDE with an integrated preview.
- **Constraints:**
  - HMR (Hot Module Replacement) is disabled (`DISABLE_HMR=true` in `vite.config.ts`) to prevent UI flickering during agent edits.
  - The app runs inside an iframe. Beware of Cross-Origin Opener Policy (COOP) and Cross-Origin Embedder Policy (COEP) which might block OAuth popups.
  - Users authenticate via Google OAuth popup; if blocked, they must use "Open in new tab".
- **Secrets:** Environment variables like `GEMINI_API_KEY` are managed via AI Studio secrets, not committed files.

## 2. Cloud Run (Production)
- **Execution:** Serverless containerized environment running `dist/server.cjs`.
- **Constraints:**
  - **Port Binding:** The server *must* listen on `0.0.0.0` and respect `process.env.PORT`. Local fixed ports (e.g., `3000`) will fail.
  - **Stateless Filesystem:** The local disk is ephemeral. Caches (`cache/`, validation history) do not persist across instances or restarts.
  - **Concurrency:** Multiple instances may run simultaneously. Avoid concurrent write collisions to local JSON files if used for temporary buffering.
  - **Build:** Relies on `npm run build` which produces minified frontend assets and a bundled Node backend.

## 3. Local Development
- **Execution:** Developer's local machine.
- **Commands:** `npm run dev` (uses `tsx` for TypeScript execution without pre-building).
- **Constraints:**
  - Requires `.env.local` for API keys.
  - HMR is enabled.
  - Full filesystem access; caches persist locally.

## 4. Google Jules (Audit Environment)
- **Branch:** `jules/integration`
- **Execution:** Automated scheduled agent environment.
- **Constraints:**
  - Jules may not have access to runtime environment variables like `GEMINI_API_KEY` for live tests.
  - Static verification (linting, unit tests without network calls) is crucial.
  - Must respect `AGENTS.md` and never commit broken code or weaken security rules.

## 5. OpenAI Codex / CLI Agents
- **Execution:** Local CLI or Cloud-based SSH/Sandbox.
- **Constraints:**
  - May lack actual browser access for OAuth verification.
  - Must rely on automated unit tests (`npm run test:unit`) to verify logic.
  - Do not assume `npm install` has been run; if missing packages occur, run it explicitly.

## 6. GitHub Actions (CI)
- **Execution:** Automated runners for PRs and branch syncing.
- **Constraints:**
  - `.github/workflows/sync-main-to-jules-integration.yml` synchronizes AI Studio edits to the Jules branch.
  - Secrets like `SYNC_TOKEN` are managed via GitHub Secrets.
  - Tests run in a headless environment.
