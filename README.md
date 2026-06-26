<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# indexmd (Drive Indexer)

**indexmd** is a high-performance, cost-effective Google Drive folder recursion indexer. It generates and securely updates `index.md` files in your Google Drive directories with AI-generated summaries powered by Google Gemini.

## 🤖 Multi-Agent Development Environment

This repository is actively developed and audited by multiple AI coding agents:
- **Google AI Studio**: Primary visual development and execution environment.
- **Google Jules**: Conducts periodic audits, documentation updates, and integration tests.
- **OpenAI Codex & GitHub Copilot**: Performs ad-hoc code edits, PR reviews, and merge conflict resolution.

**For AI Agents:** Please read `AGENTS.md` before making any logic changes. It serves as the agent-neutral repository contract for this project. See the `docs/` directory for detailed workflows, security, and environment documentation.

## 🏗 Architecture Overview

- **Frontend**: React 18 (Vite), Tailwind CSS, Lucide icons.
- **Backend**: Node.js (Express), `@google/genai` (Gemini SDK) via `server.ts`.
- **Storage**:
  - **Firestore**: Tracks directory traversal state and metadata (Database ID: `indexmd-db`).
  - **Local Filesystem**: Tracks processing success/fails and acts as an ephemeral cache for file snippets.
- **APIs**: Google Drive API (requires advanced scope for file manipulation).

## 🚀 Running the Project

### Prerequisites
- Node.js (v22 or later recommended)
- A Google Cloud Project with the Drive API and Firestore enabled
- A Gemini API Key

### 1. Setup

Clone the repository and install dependencies:
```bash
npm install
```

### 2. Environment Variables

Create a `.env` (or `.env.local`) file based on `.env.example` (if it exists) or configure the following:
```
GEMINI_API_KEY=your_gemini_api_key
```
*(Note: Firebase configurations are typically loaded via `firebase-applet-config.json` or environment injection depending on the runtime.)*

### 3. Local Development

To run the full stack (Frontend + Backend proxy) locally:
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

### 4. Testing & Verification

All agents and human contributors must run these checks before committing:

```bash
# Type checking
npm run lint

# Isolated Unit Tests (No network required)
npm run test:unit

# Build for production
npm run build
```

### 5. Production (Cloud Run)

This app is designed to be deployed to Google Cloud Run.
- **Build**: `npm run build` compiles the frontend via Vite and bundles the backend via esbuild into `dist/server.cjs`.
- **Start**: `npm run start` (or `node dist/server.cjs`)
- **Port Constraints**: The server respects the `PORT` environment variable and binds to `0.0.0.0` to comply with Cloud Run requirements.
- **Ephemeral Filesystem**: The `cache/` directory is ephemeral in Cloud Run. Data persistence relies entirely on Firestore and the target Google Drive.

## 📚 Documentation
Please review the `docs/` folder for specific guidelines on:
- **Agent Workflows**: `docs/AGENT_WORKFLOWS.md`
- **Environments**: `docs/RUNTIME_ENVIRONMENTS.md`
- **Security & Data**: `docs/SECURITY.md`
- **SEO & PWA**: `docs/SEO_PWA.md`
