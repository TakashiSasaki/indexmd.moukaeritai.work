# indexmd (Drive Indexer)

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

A high-performance, cost-effective Google Drive folder recursion indexer that generates OKF-compliant `index.md` files with AI summaries.

## 🤖 Multi-Agent Development
This project is actively developed and audited by multiple AI coding agents:
- **Google AI Studio**: Primary development environment. The `main` branch is the source of truth.
- **Google Jules**: Executes periodic audits and fixes on the `jules/integration` branch.
- **OpenAI Codex & GitHub Copilot**: Performs ad-hoc code edits, reviews, and PR resolution.
*Agents must read the [Agent-Neutral Repository Contract (AGENTS.md)](AGENTS.md) and refer to `docs/` before making changes.*

## 🚀 Environment Overview
- **Development**: Created in Google AI Studio.
- **Production**: Designed to be deployed as a Google Cloud Run service.
*For detailed environment caveats, refer to `docs/RUNTIME_ENVIRONMENTS.md`.*

## 💻 Run Locally

**Prerequisites:** Node.js (v20+ recommended).

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the environment variables. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` to include your `GEMINI_API_KEY` and `APP_URL`.
3. Run the app:
   ```bash
   npm run dev
   ```

## 🛠 Testing & Building
- **Lint**: `npm run lint`
- **Unit Tests**: `npm run test:unit`
- **Build**: `npm run build`
- **Start (Production mode)**: `npm run start`

## 🔒 Security & Architecture
- **Authentication**: Requires Google Drive Advanced Scope. Access tokens are kept strictly in `sessionStorage`.
- **Database**: Uses Firestore (Database ID: `indexmd-db`).
- **AI**: Uses Gemini SDK with robust model fallbacks.
*For detailed security constraints, read `docs/SECURITY.md`.*
