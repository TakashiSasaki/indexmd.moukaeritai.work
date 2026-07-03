<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# indexmd (Drive Indexer)

`indexmd` is a high-performance, full-stack document categorization and indexing tool for Google Drive. It uses Gemini AI to analyze directories and generate structured `index.md` files while safely preserving manual user notes.

## Multi-Agent Development Environment
This repository is co-developed by humans and multiple AI agents.
- **Google AI Studio** is the primary UI/UX development environment and writes to `main`.
- **Google Jules** runs periodic audits, infrastructure updates, and documentation syncing on `jules/integration`.
- **OpenAI Codex** and **GitHub Copilot** provide automated PRs, code reviews, and conflict resolution.
- **Please refer to `AGENTS.md` and the `docs/` directory** to understand the agent-neutral repository contract and safe operation boundaries.

## Architecture Overview
- **Frontend**: React 18, Vite, Tailwind CSS, acting as an SPA/PWA.
- **Backend**: Node.js Express server acting as a secure proxy for Gemini and Google Drive API.
- **Storage**: Firestore (`indexmd-db`) for metadata sync.
- **Cloud Run Ready**: Designed for stateless deployment. Secrets must be injected via environment variables.

## Running Locally

**Prerequisites:** Node.js (v18+)

1. Install dependencies:
   `npm install`
2. Set up environment variables:
   Copy `.env.example` to `.env.local` and add your `GEMINI_API_KEY`.
3. Start the development server (runs both Vite frontend and Express backend via tsx):
   `npm run dev`

## Building & Production (Cloud Run)
The application builds into a static frontend and a bundled Node.js backend.
1. Build the application:
   `npm run build`
2. Start the production server:
   `npm run start`
*Note for Cloud Run:* The Express server listens on `0.0.0.0` and respects `process.env.PORT`.

## Testing
Always run tests before committing:
- Unit Tests: `npm run test:unit`
- Static Analysis: `npm run lint`

## Security & PWA
- **Tokens**: Drive access tokens are kept short-lived in memory/sessionStorage. Refresh tokens are NOT stored.
- **PWA**: The app is installable, featuring a Service Worker that caches static assets but excludes API/Firebase traffic. See `docs/` for SEO/PWA strategy.
