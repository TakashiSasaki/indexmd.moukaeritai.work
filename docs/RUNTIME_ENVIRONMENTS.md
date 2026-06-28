# Runtime Environments

This document details the different environments where the `indexmd` application and its code are executed, edited, and deployed.

## 1. Google AI Studio (Development Environment)
- **Role**: Primary UI/UX and feature development environment.
- **Entry Point**: `npm run dev` (Vite + `tsx server.ts`).
- **Caveats**:
  - HMR (Hot Module Replacement) might be disabled via `DISABLE_HMR` to prevent flickering.
  - Preview iframes impose strict Cross-Origin Opener Policy (COOP) and Cross-Origin Embedder Policy (COEP) constraints.
  - Benign errors (like OAuth popups failing in iframes) are muted in `src/main.tsx` to prevent console spam.
  - Uses `main` branch as the Source of Truth.

## 2. Google Cloud Run (Production Execution)
- **Role**: Where the final application is hosted and serves real users.
- **Entry Point**: `npm run start` -> `node dist/server.cjs`.
- **Caveats**:
  - **Networking**: The Express server must listen on `0.0.0.0` and respect `process.env.PORT`.
  - **Ephemeral Filesystem**: Any files written to disk (e.g., in `cache/` or `validation_history.json`) will be lost when the instance scales down or restarts. Do not rely on local JSON for persistent data.
  - **Secrets**: `GEMINI_API_KEY` is injected securely via Cloud Run environment variables (Secret Manager). Never commit secrets.

## 3. Google Jules (Automated Auditing)
- **Role**: Background AI agent performing periodic health checks, architecture audits, and documentation alignment.
- **Branch**: Operates primarily on `jules/integration`.
- **Caveats**:
  - Executes `npm run lint` and `npm run test:unit`.
  - Must not loosen security constraints.

## 4. OpenAI Codex & GitHub Copilot (Code Assistance)
- **Role**: Ad-hoc code editing, PR reviews, and conflict resolution.
- **Caveats**:
  - Operates locally or in cloud IDEs.
  - Must run tests (`npm run test:unit`) before proposing changes.
  - Must explicitly state what was verified and what was not in PRs.

## 5. Local Development
- **Role**: Human or agent debugging.
- **Entry Point**: `npm run dev`.
- **Caveats**: Requires `.env.local` to be properly configured with valid Gemini keys. Can run standalone testing scripts from `skills/`.
