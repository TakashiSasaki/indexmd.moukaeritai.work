# Repository Operations

This document covers the operational lifecycle, CI/CD, and deployment of `indexmd`.

## 1. Branch Synchronization
- **Workflow:** `.github/workflows/sync-main-to-jules-integration.yml`
- **Purpose:** Automatically merges changes from `main` (Google AI Studio) into `jules/integration` (Google Jules working branch).
- **Conflict Handling:** If a merge conflict occurs, the workflow will automatically create a Pull Request from an ephemeral `automation/sync...` branch. Agents or humans must resolve these conflicts manually following the policies in `docs/AGENT_WORKFLOWS.md`.

## 2. CI/CD & Testing
- Before creating a PR or pushing to `main`, run the standard verification suite:
  ```bash
  npm run lint
  npm run test:unit
  npm run build
  ```
- **Note:** CI environments usually lack `GEMINI_API_KEY` and Google Drive credentials. Tests must be designed to execute successfully without real external networks (using mocks) or safely bypass network logic.

## 3. Cloud Run Deployment
The application builds a combined frontend and backend for deployment.

- **Build Process:**
  `npm run build` runs Vite to build the React frontend into `dist/` and esbuild to bundle `server.ts` into `dist/server.cjs`.
- **Execution:**
  `npm run start` executes `dist/server.cjs`. The server serves the static frontend from `dist/` and mounts the API on `/api/`.
- **Port:** The Express server dynamically binds to `process.env.PORT`.
- **Stateless Warning:** Cloud Run instances can scale to zero and have ephemeral filesystems. Any data written to `cache/` or `src/data/` locally will be lost on container shutdown.

## 4. Incident Response
- If AI models start failing consistently (e.g., HTTP 503 from Gemini), rely on the fallback chain in `server.ts`.
- Check `src/data/validation_history.json` (in local environments) to audit model fallback behavior.
