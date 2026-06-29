# Runtime Environments

This document details the various environments where the `indexmd` application and its coding agents run.

## 1. Google AI Studio (Development Entry Point)
- **Role**: Primary UI for humans building the app.
- **Branch**: Operates directly on the `main` branch.
- **Constraints**:
  - Requires specific handling of HMR (Hot Module Replacement) and file watching to prevent agent edit loops.
  - OAuth popups and previews may behave differently due to iframe/COOP constraints.
  - Environment variables must be injected into the Studio configuration.

## 2. Google Jules (Audit & Fix)
- **Role**: Periodic background agent performing repository audits, dependency updates, and automated fixes.
- **Branch**: Operates on `jules/integration`.
- **Constraints**:
  - Cannot rely on a human to perform interactive OAuth flows.
  - Fixes must be pushed to `jules/integration` and synchronized with `main` via `.github/workflows/sync-main-to-jules-integration.yml`.

## 3. OpenAI Codex (Ad-hoc Edits)
- **Role**: General purpose coding agent for local or cloud environments.
- **Constraints**:
  - Needs clear, environment-agnostic instructions.
  - Must not commit local caches, tokens, or private fixtures.
  - Must rely on static verification if dependencies cannot be installed.

## 4. GitHub Copilot (PRs & Review)
- **Role**: Assists in GitHub PR creation, reviews, and merge conflict resolution.
- **Constraints**:
  - Guided by `.github/copilot-instructions.md`.
  - Must respect `AGENTS.md` during conflict resolution (no blind schema/docs overwrites).

## 5. Google Cloud Run (Production Target)
- **Role**: Production runtime for the Node.js backend.
- **Constraints**:
  - **Networking**: Backend MUST listen on `0.0.0.0` and bind to `process.env.PORT` (not a hardcoded 3000).
  - **Storage**: Ephemeral file system. Local caches (`cache/`, `validation_history.json`) are NOT shared across instances and disappear on restart. Persistent state MUST use Firestore.
  - **Lifecycle**: Subject to cold starts and request timeouts. Background indexing tasks must be chunked and state saved to Firestore to survive timeouts.
  - **Secrets**: `GEMINI_API_KEY` injected via Cloud Run env vars / Secret Manager. Never commit to repo.

## 6. Local Development / CI
- **Role**: Standard human or agent workflow (`npm run dev`, `npm run test:unit`).
- **Constraints**:
  - Local `cache/` and `.env.local` files must be git-ignored.
  - CI environment does not have access to real Drive API tokens; tests must mock `gemini` and `googleapis`.
