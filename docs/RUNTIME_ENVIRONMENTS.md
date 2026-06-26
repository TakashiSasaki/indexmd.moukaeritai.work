# Runtime Environments

This document details the differences between the various environments in which `indexmd` is executed, developed, or audited. Because multiple AI coding agents interact with this codebase, understanding these constraints is critical.

## 1. Google AI Studio (Development)
- **Role**: Primary visual development and interactive preview environment.
- **Source of Truth**: Modifies the `main` branch.
- **Constraints**:
  - HMR (Hot Module Replacement) is disabled (`DISABLE_HMR=true`) to save CPU and prevent flickering during agent edits.
  - Previews, iframes, and OAuth popups must be handled with care due to COOP/COEP headers.
  - **Environment Variables**: Managed via AI Studio UI, not always present in `.env`.

## 2. Google Jules (Audit & Integration)
- **Role**: Periodic audits, documentation updates, and automated codebase corrections.
- **Branch**: Operates on `jules/integration`.
- **Sync**: Kept up-to-date with `main` via `.github/workflows/sync-main-to-jules-integration.yml`.
- **Constraints**:
  - Cannot test OAuth flows interactively.
  - Relies entirely on static checks (`npm run lint`, `npm run test:unit`, `npm run build`).
  - Must state reasons if a test cannot be executed during an automated run.

## 3. OpenAI Codex & GitHub Copilot (Assisted Editing)
- **Role**: Ad-hoc code editing, PR creation, review, and merge conflict resolution via GitHub or IDE.
- **Branch**: Generates ephemeral feature branches or conflict-resolution PR branches.
- **Constraints**:
  - Agents may lack the local `node_modules` setup initially. They must use static verification or run `npm install` first.
  - Must not blindly overwrite schemas, prompt versions, or lockfiles during conflict resolution.

## 4. Google Cloud Run (Production Execution)
- **Role**: The final deployment target for the application.
- **Port Binding**: The HTTP server must bind to `0.0.0.0` and respect `process.env.PORT`.
- **Build Process**: `npm run build` runs Vite for frontend assets and `esbuild` for the backend, creating `dist/server.cjs`.
- **Filesystem Constraints (CRITICAL)**:
  - The local filesystem is **ephemeral**.
  - Directories like `cache/`, `src/data/validation_history.json`, and `src/data/experiment_history.json` will be wiped between cold starts.
  - Instance concurrency means multiple instances will NOT share local JSON caches.
  - Do NOT rely on local JSON files for persistent state; use Firestore for all critical state.
- **Network Constraints**: Cold starts may delay initial API calls.

## 5. Local Development
- **Role**: Human developer testing.
- **Execution**: Uses `npm run dev` (powered by `tsx server.ts`).
- **Filesystem**: Caches (`cache/`) and history files persist on disk and can be inspected for debugging.

## 6. GitHub Actions (CI)
- **Role**: Continuous integration and branch synchronization.
- **Constraints**:
  - Tests must pass without access to real Google Drive or Firebase instances. All unit tests (`npm run test:unit`) must use mocks.
