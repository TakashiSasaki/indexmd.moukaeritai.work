# Operations & CI/CD

This document describes how the `indexmd` application is tested, built, and deployed.

## 1. CI pipeline (GitHub Actions)
- Any push to `main` should ideally trigger a build and test workflow.
- **Sync Action**: `.github/workflows/sync-main-to-jules-integration.yml` ensures that edits made in Google AI Studio (`main`) propagate to the `jules/integration` branch so that Jules has the latest code to audit.

## 2. Build Process
Run `npm run build`. This executes two steps:
1. `vite build`: Compiles the React frontend into static assets in `dist/`.
2. `esbuild server.ts`: Bundles the Express backend into `dist/server.cjs`.

## 3. Deployment (Cloud Run)
When deploying to Google Cloud Run:
- The container must expose the port specified by the `PORT` environment variable.
- The `dist/` directory must be served statically.
- Ensure environment variables (`GEMINI_API_KEY`, `APP_URL`) are configured in the Cloud Run service.

## 4. Monitoring & Error Handling
- The UI mutes transient network errors (WebSocket drops, 401 expiries) to prevent user panic.
- `src/data/validation_history.json` logs backend model fallback history (Note: Ephemeral in Cloud Run).
