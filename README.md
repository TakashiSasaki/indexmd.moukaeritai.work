<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# indexmd

`indexmd` is a high-performance, cost-effective Google Drive folder recursion indexer. It generates OKF-compliant `index.md` files containing AI-generated summaries and internal directory links using the Gemini API. It uses a Hybrid-Merge mechanism to protect manual user notes within those files.

**⚠️ Multi-Agent Environment**
This repository is actively developed and maintained by multiple AI coding agents, including Google AI Studio, Google Jules, OpenAI Codex, and GitHub Copilot.
- All human and agent contributors **MUST** read `AGENTS.md` before proposing or making changes.
- Detailed architecture, security, and operational constraints are located in the `docs/` directory.

## Getting Started (Local Development)

**Prerequisites:** Node.js (v18+)

1. **Install dependencies:**
   `npm install`
2. **Environment Variables:**
   Copy `.env.example` to `.env.local` and configure your API keys:
   `GEMINI_API_KEY=your_gemini_api_key`
3. **Run the local development server:**
   `npm run dev`

## Verification & Testing

Before submitting any Pull Request, you must run the following checks. See `docs/AGENT_WORKFLOWS.md` for agent-specific instructions.

- Lint: `npm run lint`
- Test: `npm run test:unit`
- Build: `npm run build`

## Cloud Run Deployment (Production)

The application is designed to be deployed to Google Cloud Run.
- **Build**: `npm run build` generates the backend server at `dist/server.cjs` and frontend assets.
- **Run**: `npm run start` starts the Express server, which dynamically binds to `process.env.PORT` on host `0.0.0.0`.
- See `docs/RUNTIME_ENVIRONMENTS.md` and `docs/OPERATIONS.md` for specific Cloud Run constraints regarding ephemeral storage and cold starts.

## Documentation Reference
- `AGENTS.md`: The Agent-neutral repository contract (Read First)
- `docs/ARCHITECTURE.md`: Core system design and data flows.
- `docs/SECURITY.md`: Strict rules regarding Google Drive scopes, Firestore rules, and token safety.
- `docs/SEO_PWA.md`: Guidelines for the Service Worker, robots.txt, and sitemap.
