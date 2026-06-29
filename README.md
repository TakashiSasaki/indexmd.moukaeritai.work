<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# indexmd (Google Drive Indexer)

**indexmd** is a high-performance, cost-effective Google Drive folder recursion indexer. It generates and updates `index.md` files in every directory with AI-generated summaries, using Google Gemini and Google Drive API.

View your app in AI Studio: https://ai.studio/apps/141a147a-54eb-4619-a0bf-76fc3c46afc4

## 🤖 Multi-Agent Development
This project is built and maintained by multiple AI coding agents, including Google Jules, OpenAI Codex, and GitHub Copilot, originating from Google AI Studio. **If you are an agent, read `AGENTS.md` before making any changes.**

## 🏗 Architecture & Environments
This application is designed to run in multiple environments:
- **Google AI Studio**: Development entry point.
- **Local Development**: Standard local Node environment.
- **Google Cloud Run**: Target production environment.

**Key Cloud Run Considerations:**
- The backend `server.ts` respects `process.env.PORT` and listens on `0.0.0.0`.
- Do not assume local file storage is persistent (use Firestore).
- Run `npm run build` followed by `npm start` for production deployment.

## 🚀 Getting Started

**Prerequisites:** Node.js (v18+ recommended)

### Setup & Local Execution

1. Install dependencies:
   `npm install`
2. Configure Environment:
   Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key. Make sure `firebase-applet-config.json` is present.
3. Run Development Server:
   `npm run dev`

### Scripts
- `npm run dev` : Start local dev server (React + Vite + Express).
- `npm run build` : Build production assets (`dist/`).
- `npm run start` : Start production server (Cloud Run mode).
- `npm run lint` : Run TypeScript type checking.
- `npm run test:unit` : Run isolated unit tests.

## 📚 Documentation
For detailed information on workflows, security, and environments, refer to:
- [`AGENTS.md`](./AGENTS.md): Core agent rules and repository contract.
- [`docs/RUNTIME_ENVIRONMENTS.md`](./docs/RUNTIME_ENVIRONMENTS.md): Environment differences.
- [`docs/AGENT_WORKFLOWS.md`](./docs/AGENT_WORKFLOWS.md): Workflow guidelines.
- [`docs/OPERATIONS.md`](./docs/OPERATIONS.md): CI/CD and deployment.
- [`docs/SECURITY.md`](./docs/SECURITY.md): Security constraints.
- [`docs/SEO_PWA.md`](./docs/SEO_PWA.md): SEO and PWA details.
