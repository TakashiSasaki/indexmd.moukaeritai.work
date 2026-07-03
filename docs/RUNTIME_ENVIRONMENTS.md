# Runtime & Development Environments

This project runs across several distinct environments. Coding agents and human developers must understand these differences.

## 1. Google AI Studio
- **Role**: Primary UI/UX development and testing environment.
- **Branch**: Operates primarily on `main`.
- **Characteristics**: Uses an iframe/preview environment. Be aware of Cross-Origin Opener Policy (COOP) and pop-up blocking issues during Google OAuth.

## 2. Google Jules (Integration)
- **Role**: Periodic auditing, security enforcement, doc generation, and sync.
- **Branch**: `jules/integration`.
- **Characteristics**: Runs automated scripts. May lack full `npm install` access in fast-audit modes. Needs robust static analysis capabilities.

## 3. OpenAI Codex & GitHub Copilot
- **Role**: PR generation, review, and conflict resolution.
- **Characteristics**: Operates statelessly. Cannot test Drive UI manually. Must rely entirely on `npm run test:unit` and `npm run lint`. Must read `AGENTS.md` and `.github/copilot-instructions.md`.

## 4. Local Development
- **Role**: Core logical development.
- **Execution**: `npm run dev` (Vite + Express via TSX).
- **Network**: Typically `localhost:3000` and `localhost:5173`. Has full filesystem access.

## 5. Google Cloud Run (Production)
- **Role**: Scalable, public-facing deployment.
- **Execution**: `node dist/server.cjs`
- **Constraints**:
  - Stateless compute. Ephemeral filesystem (do not use `cache/` for permanent storage).
  - Must listen on `0.0.0.0` and respect `process.env.PORT`.
  - Cold starts apply. Timeout limits apply (ensure Gemini fallbacks are fast or Drive batching is optimized).
  - Environment variables (`GEMINI_API_KEY`) must be injected via Google Secret Manager or Cloud Run env vars. Never read `.env.local` in production.
