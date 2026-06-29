# Operations & Deployment

This document covers operational procedures, branch management, and deployments.

## Branch Strategy
- `main`: Source of truth, used by Google AI Studio.
- `jules/integration`: Background auditing and automated fixes.
- `automation/sync-main-to-jules-integration`: Automation branch for resolving conflicts between `main` and Jules.
- Feature branches: Created off `main` (or `jules/integration`) for specific tasks.

## CI/CD
- GitHub Actions are used to synchronize branches (e.g., `.github/workflows/sync-main-to-jules-integration.yml`).
- Tests should run on PRs targeting `main` or `jules/integration`.

## Deployment to Cloud Run
- **Build**: Run `npm run build` to generate `dist/server.cjs` and frontend assets.
- **Start**: Run `npm run start` (which executes `node dist/server.cjs`).
- **Environment Variables**:
  - `PORT`: Automatically provided by Cloud Run.
  - `GEMINI_API_KEY`: Must be securely injected via Secret Manager.
- **Networking**: The Express server must listen on `0.0.0.0`.

## Incident Response
- If Cloud Run fails due to memory or timeouts during heavy indexing, verify that batching and chunking logic in Firestore traversal is operating correctly.
