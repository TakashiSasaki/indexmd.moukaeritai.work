# indexmd (Drive Indexer)

Google Drive Folder recursion indexer generating OKF-compliant `index.md` files with AI summaries.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

## 🤖 Multi-Agent Project Context

**IMPORTANT FOR DEVELOPERS AND AGENTS:**
This project is developed in Google AI Studio and actively maintained by a combination of human developers and autonomous coding agents (Google Jules, OpenAI Codex, GitHub Copilot).

Before making changes, all agents **must** read the agent-neutral repository contract: [`AGENTS.md`](AGENTS.md). It outlines critical constraints on Google Drive file manipulation, Firestore optimization, and multi-agent conflict resolution.

## 🌟 Project Overview

`indexmd` is a React + Vite + Node.js (Express) application designed to crawl a user's Google Drive, analyzing folders bottom-up (Cascade Summary) using the Gemini AI API, and generating a highly structured `index.md` file in each directory.

Key Features:
- **Hybrid-Merge Strategy**: Protects human-written notes within `index.md` while updating AI-generated sections.
- **Incremental Scanning**: Only rescans directories that have been modified.
- **Multi-Environment Ready**: Designed for Google AI Studio development, local testing, and Google Cloud Run deployment.

## 🏗 Architecture

- **Frontend**: React 18 SPA built with Vite. Includes a Drive dashboard for monitoring scan progress and verifying output.
- **Backend**: Node.js Express server (`server.ts`). Handles AI requests (Gemini) securely and proxies Drive API calls to avoid exposing tokens.
- **Database**: Firestore (`indexmd-db`) to store folder traversal states and avoid redundant processing.
- **Detailed Docs**: See `docs/ARCHITECTURE.md`.

## 🚀 Environments & Running the App

### 1. Google AI Studio (Source of Truth)
The project is primarily developed in AI Studio. The `main` branch is the source of truth.
- Set `GEMINI_API_KEY` in AI Studio secrets.
- HMR is disabled by default via `DISABLE_HMR=true` to prevent flickering during agent edits.

### 2. Local Development
**Prerequisites:** Node.js v22+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set environment variables in `.env.local`:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key
   # Other necessary vars
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### 3. Cloud Run (Production)
The production environment uses the pre-built dist folder.
1. Build the project:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm run start
   ```
Ensure Cloud Run provides the port via `process.env.PORT` and the server listens on `0.0.0.0`.

See `docs/RUNTIME_ENVIRONMENTS.md` for more details.

## 🛡️ Security

Google Drive API access is strictly limited to reading metadata, reading images, and writing to `index.md` files. **Never** attempt to delete files or run full-drive destructive operations.
See `docs/SECURITY.md` for comprehensive security and authentication guidelines.

## 🔎 PWA & SEO

This app is configured as a Progressive Web App (PWA) with basic offline caching for static assets. It uses a Service Worker, `manifest.json`, and optimized meta tags for SEO. API requests and Drive data are strictly excluded from the cache.
See `docs/SEO_PWA.md`.

## 🧪 Testing

Unit tests run in isolation without network calls. Tests verify schema validations, fallback behaviors, and UI logic.
```bash
npm run test:unit
```
Before committing, always ensure `npm run lint` and `npm run test:unit` pass.

## 📚 Documentation Index
- [AGENTS.md](AGENTS.md): Core agent rules.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): System design.
- [docs/SECURITY.md](docs/SECURITY.md): Data safety policies.
- [docs/RUNTIME_ENVIRONMENTS.md](docs/RUNTIME_ENVIRONMENTS.md): Environment differences.
- [docs/AGENT_WORKFLOWS.md](docs/AGENT_WORKFLOWS.md): PR and conflict strategies.
- [docs/SEO_PWA.md](docs/SEO_PWA.md): Web visibility and offline support.
- [docs/OPERATIONS.md](docs/OPERATIONS.md): CI/CD and deployment operations.
