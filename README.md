<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# indexmd (Drive Indexer)

`indexmd` is a high-performance, cost-effective Google Drive folder recursion indexer. It generates and maintains `index.md` files in every directory by combining explicit user notes with AI-generated folder and file summaries (using Google's Gemini models).

View the latest development version in AI Studio: https://ai.studio/apps/141a147a-54eb-4619-a0bf-76fc3c46afc4

## 🤖 Multi-Agent Environment Note

**This repository is maintained collaboratively by human developers and multiple AI coding agents.**

- The project is actively developed using **Google AI Studio**.
- **Google Jules** runs periodic audits and integration tasks (primarily on the `jules/integration` branch).
- **OpenAI Codex** and **GitHub Copilot** may intervene dynamically to handle PRs, conflict resolution, and code modifications.
- **For all agents:** Please read the agent-neutral repository contract in `AGENTS.md` before making any logic changes or proposing architectural shifts. Consult the `docs/` directory for detailed guidelines.

## 🏗 Architecture Overview

- **Frontend:** React 18 (Vite), Tailwind CSS, Lucide icons.
- **Backend:** Node.js (Express), `@google/genai` (Gemini SDK) for AI generation and secure Drive API proxying.
- **Storage:**
  - Firebase Firestore (`indexmd-db` Native mode) for traversal state and sync logic.
  - Google Drive API (Advanced Scope) for reading files and writing `index.md` files.

## 🚀 Running Locally

**Prerequisites:** Node.js (v18+)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up environment variables:
   Copy `.env.example` to `.env.local` (or `.env`) and add your Gemini API Key and other configuration.
   ```bash
   cp .env.example .env.local
   # Edit .env.local to set GEMINI_API_KEY
   ```
3. Run the development server (Backend + Vite Frontend):
   ```bash
   npm run dev
   ```

## ☁️ Cloud Run Production Deployment

The application is designed to be deployed to Google Cloud Run.

- **Port Binding:** The backend respects `process.env.PORT` and binds to `0.0.0.0`.
- **Statelessness:** Cloud Run file systems are ephemeral. Do not rely on local `cache/` or `history` files across requests or container instances.
- **Build & Start:**
  ```bash
  npm run build
  npm run start
  ```
- **Environment Variables:** Secrets like `GEMINI_API_KEY` must be injected via Cloud Secret Manager or Cloud Run environment variables, *never* committed to the repository.

## 🧪 Testing and Validation

Before committing, ensure you run the validation suite:

- **Linting:** `npm run lint`
- **Unit Tests:** `npm run test:unit`
- **Build Verification:** `npm run build`

*Note: Some image extraction tests (`serverFetch.test.ts`) currently have known failures due to binary format incompatibilities in the testing environment.*

## 📚 Documentation

For detailed guidelines, environment specifics, and operational procedures, refer to the following documents:

- `AGENTS.md`: The primary agent contract and ruleset.
- `docs/RUNTIME_ENVIRONMENTS.md`: Differences between AI Studio, Cloud Run, Local, and Agent execution environments.
- `docs/AGENT_WORKFLOWS.md`: Branching, PR, and validation rules for multiple agents.
- `docs/SECURITY.md`: Auth, Drive API scopes, and data safety constraints.
- `docs/OPERATIONS.md`: CI/CD, syncing `main`, and Cloud Run deployment.
- `docs/SEO_PWA.md`: SEO configuration and Service Worker caching policies.
