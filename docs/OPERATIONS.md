# Operations & Deployment

This document covers the CI/CD pipeline, branching strategies, and operational deployment procedures.

## 1. Branch Strategy
- **`main`**: The primary source of truth, actively developed via Google AI Studio.
- **`jules/integration`**: The branch used by Google Jules for audits, refactors, and maintaining cross-agent standards.
- **`automation/sync-main-to-jules-integration`**: The fallback branch used by GitHub Actions if `main` cannot be cleanly fast-forwarded into `jules/integration`.

## 2. CI/CD (GitHub Actions)
- **Sync Workflow**: `.github/workflows/sync-main-to-jules-integration.yml` automatically triggers on pushes to `main`. It attempts to merge `main` into `jules/integration`. If conflicts occur, it opens a PR. Do NOT delete or disable this workflow.

## 3. Cloud Run Deployment
- **Build Artifacts**: The deployment uses `npm run build` which generates `dist/server.cjs` and the static frontend assets.
- **Execution**: The container must start using `npm run start` (`node dist/server.cjs`).
- **Networking Requirements**:
  - The server must read `process.env.PORT`.
  - The server must bind to host `0.0.0.0` (not `localhost` or `127.0.0.1`).
- **Environment Variables**: `GEMINI_API_KEY` and Firebase client configurations must be supplied to the container environment at runtime.

## 4. Disaster Recovery & Incident Response
- If the sync workflow breaks, a human or agent must manually merge `main` into `jules/integration` resolving conflicts while respecting `AGENTS.md` constraints.
- If Cloud Run instances fail health checks, verify that `PORT` binding is correct and that the application is not crashing on startup due to missing environment variables or filesystem write errors.
