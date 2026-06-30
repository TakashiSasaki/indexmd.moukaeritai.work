# Runtime Environments

This document details the distinct environments where `indexmd` is developed, audited, and deployed. Because multiple agents and deployment targets are involved, understanding these constraints is critical.

## 1. Google AI Studio (Development)
- **Role:** Primary development environment and source of truth for the `main` branch.
- **Constraints:**
  - `main` branch must never be force-pushed or renamed.
  - Be cautious of AI Studio specific features (e.g., iframe execution, OAuth popup constraints, COOP headers).
  - Ensure that changes made to work in AI Studio do not break the Cloud Run production build.

## 2. Google Jules (Audit / Integration)
- **Role:** Runs periodic audits, documentation updates, and schema migrations against `jules/integration`.
- **Constraints:**
  - Jules runs in a sandbox. It does not have access to live user Google Drive data or real OAuth tokens.
  - Do not introduce logic that relies on Jules maintaining long-term state across sessions outside of repository commits.

## 3. OpenAI Codex & GitHub Copilot (Dynamic Intervention)
- **Role:** Ad-hoc code editing, PR generation, and conflict resolution from local CLI or Cloud IDEs.
- **Constraints:**
  - Ensure commands are environment-agnostic (e.g., use cross-platform node scripts instead of raw bash where possible).
  - Agents might not be able to install dependencies if `package.json` is severely broken; always provide fallback static analysis paths.

## 4. Local Development
- **Role:** Standard human (or local agent) testing environment.
- **Commands:** `npm run dev` (starts tsx server)
- **Constraints:**
  - Relies on `.env.local` for `GEMINI_API_KEY`.
  - Can safely use local disk for `cache/` and `src/data/validation_history.json`.

## 5. Google Cloud Run (Production)
- **Role:** Final deployment target serving the public application.
- **Constraints:**
  - **Port Binding:** The Express server MUST listen on `process.env.PORT` (or default to 3000) and bind to `0.0.0.0`.
  - **Ephemeral Filesystem:** The disk is ephemeral. Local caches (`cache/`) and history (`src/data/validation_history.json`) will not persist across container restarts or scale-outs. Do not rely on them for core business logic in production.
  - **Environment Variables:** Secrets (`GEMINI_API_KEY`) are injected via the environment. Do not commit them.
  - **Cold Starts:** Be aware of initialization delays; ensure static assets (from `dist/`) are served efficiently.

## 6. GitHub Actions / CI
- **Role:** Automated testing and branch synchronization.
- **Constraints:**
  - Environment variables (like Drive tokens) are mocked or missing. Tests must pass in a hermetic environment.
