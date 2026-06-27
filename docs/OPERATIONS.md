# Operations and CI/CD

This document describes the operational workflows, continuous integration, and deployment procedures for the `indexmd` project.

## GitHub Actions Workflows

The repository uses GitHub Actions for automation.

### Sync `main` to `jules/integration`
- **File**: `.github/workflows/sync-main-to-jules-integration.yml`
- **Trigger**: Push to `main` branch.
- **Purpose**: Automatically keeps the `jules/integration` branch (used by the Google Jules agent) up to date with the `main` branch (used by Google AI Studio).
- **Conflict Handling**:
  - If a clean merge is possible, it merges and pushes automatically.
  - If a merge conflict occurs, it creates a new branch (`automation/sync-main-to-jules-integration`) representing the latest `main` state and opens a Pull Request against `jules/integration`.
  - This PR must be resolved manually by a human or an agent (like GitHub Copilot), ensuring that safety constraints and the `AGENTS.md` contract are preserved.

## Deployment

The application is designed to be deployed to Google Cloud Run.

### Prerequisites for Cloud Run
1. **Containerization**: The app is built and packaged. `server.ts` is bundled using `esbuild` into `dist/server.cjs`, and the Vite frontend is built into the `dist` folder.
2. **Environment Variables**: Sensitive information like `GEMINI_API_KEY` must be configured in Google Cloud Secret Manager and exposed as environment variables to the Cloud Run service.

### Deployment Steps (Manual/CLI)
Currently, deployment is assumed to be handled manually or via a separate deployment pipeline not yet codified in GitHub Actions.
1. Build the application: `npm run build`
2. Deploy using the `gcloud` CLI, pointing to the built artifacts and ensuring the container listens on the port defined by the `PORT` environment variable.

## Production Monitoring and Logs

- **Cloud Run Logs**: Application logs (from `console.log` and `console.error`) are automatically captured by Google Cloud Logging.
- **Error Tracking**: Currently relies on standard logs.
- **Caution**: As per the Security guidelines, **never** log sensitive information like OAuth tokens or raw user data. Ensure error handling sanitizes output before logging.
