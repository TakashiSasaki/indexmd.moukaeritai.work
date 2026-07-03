# Runtime Environments

This document details the distinct environments where the `indexmd` application and its associated multi-agent lifecycle operate.

## 1. Cloud Run (Production)
- **Networking**: The Express backend must dynamically bind to `process.env.PORT` and listen on `0.0.0.0`.
- **Filesystem**: The filesystem is ephemeral. Local writes (e.g., to `validation_history.json` or `cache/`) will be lost upon instance shutdown and are subject to race conditions under concurrent requests. Do not rely on them for persistent application state.
- **Environment Variables**: Secrets like `GEMINI_API_KEY` are injected via Secret Manager or Cloud Run ENV config, not committed to the repository.
- **Concurrency & Cold Starts**: Application must tolerate Cloud Run cold starts and respect request timeouts.

## 2. Google AI Studio (Development)
- **Source of Truth**: Works directly off the `main` branch.
- **Constraints**: Be mindful of preview iframes, OAuth popup blocking (COOP/COEP headers), and HMR (Hot Module Replacement) behavior specific to the AI Studio preview environment.
- **Differentiation**: Actions that work in the AI Studio preview might fail in Cloud Run due to CORS, origin restrictions, or port binding.

## 3. Google Jules (Audit & Maintenance)
- **Purpose**: Runs periodic audits and repository maintenance.
- **Branch**: Operates on `jules/integration` and creates ephemeral branches.
- **Execution**: Can run headless static analysis (`npm run lint`, `npm run test:unit`) and execute code transformations.

## 4. OpenAI Codex / GitHub Copilot (Ad-hoc Edits)
- **Execution**: May operate via local CLI, IDE extensions, or cloud-based sandbox environments.
- **Limitations**: Might not always have the ability to run `npm install` or execute dynamic tests if system dependencies are missing.
- **Safety**: Automated sandbox tests must not mutate real Google Drive user data.

## 5. Local Development
- **Setup**: Requires manual `.env.local` configuration for `GEMINI_API_KEY` and Firebase config.
- **Execution**: Run via `npm run dev`. Development uses a fixed port (e.g., 3000) mapped to `localhost`.

## 6. CI (GitHub Actions)
- **Environment**: Ephemeral Linux runners.
- **Tasks**: Automated branch syncing (`sync-main-to-jules-integration`), static type checking, and unit testing. Secrets are not available to unverified PRs.
