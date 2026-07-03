# indexmd Agent Instructions & Context

This repository may be edited by multiple coding agents, including but not limited to Google Jules, OpenAI Codex, GitHub Copilot, and Google AI Studio assisted editing. Treat this file as an agent-neutral repository contract. Do not assume agent-specific memory, prior chat context, local setup, or hidden project knowledge. Work only from repository files and explicitly supplied task context.

## 🎯 Core Mission
Build a high-performance, cost-effective Google Drive indexer that generates/updates `index.md` files in every directory with AI-generated summaries.

## 🤖 Agent Roles & Capabilities
This project expects multi-agent intervention. All agents must abide by this contract.
- **Google Jules**: Executes periodic audits, updates docs/SEO/Cloud Run settings, and fixes code. Uses `jules/integration` branch. Must not relax safety constraints. If tests are skipped, the reason must be explicitly stated.
- **OpenAI Codex**: May intervene from local, cloud, CLI, or IDE environments. Must not assume local setup. Must NOT execute dangerous commands (e.g., deleting Drive files, loosening Firestore rules, committing tokens/cache/private fixtures).
- **GitHub Copilot**: Operates on GitHub (PRs, conflict resolution, code reviews). See `.github/copilot-instructions.md`. Work in small increments. Do not overwrite lockfiles, schemas, or migrations during conflict resolution. Must document test results and untested items in PR summaries.
- **Google AI Studio**: `main` is the source-of-truth branch. Changes from AI Studio will be synced via GitHub Actions. Be aware of environment differences between AI Studio (preview) and Cloud Run.

## 🛠 Tech Stack
- **Frontend**: React 18 (Vite), Tailwind CSS, Lucide icons.
- **Backend**: Node.js (Express), `@google/genai` (Gemini SDK).
- **Storage**: 
  - **Firestore**: Tracks directory traversal state and metadata. Project ID `moukaeritaid`, Database ID `indexmd-db`.
  - **Local Filesystem**: `src/data/validation_history.json` tracks processing success/fails.

## ⚠️ Critical Logic Constraints (Maintain at all costs)
1. **Firestore Write Optimization**: Do NOT perform unconditional `set` operations. Batch updates (max 450). Preserve `last_traversed_at` to avoid infinite rescans.
2. **Gemini Fallback Engine**: Use `generateContentWithRetry` with fallback chains. Audit logs must record the *actually used* model.
3. **Hybrid-Merge**: `index.md` files contain User Notes and Auto-Generated sections (marked by `<!-- AUTO_GENERATED_START -->` / `END`). **NEVER OVERWRITE USER NOTES.**
4. **Error Management**: Mute benign errors (401 Expiry, Fallbacks, transient disconnects) in the UI.

## 🌿 Branch workflow for Google AI Studio and Jules

`main` is the source-of-truth branch used by Google AI Studio. Do not rename it.

`jules/integration` is the integration branch used by Jules. The workflow
`.github/workflows/sync-main-to-jules-integration.yml` keeps it up to date with
`main`.

Do not remove this workflow as unused or deprecated. It is repository-operation
infrastructure, not application runtime code.

The workflow may merge `main` into `jules/integration`, but must never reset or
force-push `jules/integration`. If a merge conflict occurs, it opens or updates a
PR from `automation/sync-main-to-jules-integration` into `jules/integration`.

## 🔒 Hard Safety Constraints
- **File System Case Sensitivity**: Do NOT create multiple files in the same directory differing only by case.
- **Drive Safety**: Do NOT delete Google Drive files, folders, or generated `index.md` files. Do NOT run full Drive-wide indexing.
- **Data Safety**: Firestore database ID is `indexmd-db`. Do not loosen security rules or re-add `(default)`.
- **Auth Safety**: Do NOT store refresh tokens anywhere. Do NOT store Drive access tokens in localStorage. Do NOT log OAuth tokens or API URLs.
- **File Safety**: Do NOT commit `cache/` contents. Do NOT use real private user documents as fixtures.
- **Quality Safety**: Always run `npm run lint`, `npm run test:unit`, and `npm run build` before committing. If tests fail to run, explicitly state why.

## 🌿 Branch Workflow & Conflict Resolution
- `main` is the source-of-truth branch from AI Studio.
- `jules/integration` is synced from `main` via `.github/workflows/sync-main-to-jules-integration.yml`.
- If a conflict occurs between `main` and `jules/integration`, a PR from `automation/sync-main-to-jules-integration` is opened.
- In case of conflict, `main` takes precedence for AI Studio UI features, but document structure and safety constraints from `jules/integration` must not be overwritten. Do not carelessly overwrite `package-lock.json`, schemas, or `AGENTS.md`.

## 📂 Documentation Pointers
For detailed environment specs, operations, security, and agent workflows, see the `docs/` directory.

## 🎨 Design Rules & Project Structure
- **Typography**: Primary font is `Inter`. Display/Headings use `Space Grotesk` or `Outfit`.
- **Theme**: High-contrast light theme (`#F8FAFC` background) with Indigo (`#4F46E5`) as the primary brand color.
- **Tone**: Professional, tool-oriented, and humble.
- `src/components/DriveDashboard.tsx`: The heart of the application. Contains the scan orchestration, Firestore sync logic, and drive API calls.
- `server.ts`: Handles secure Gemini requests, Drive API proxying (to keep tokens secret), and history persistence.
- **Firestore Collections**:
  - `users/{userId}/state/global_sync`: Tracks global sync tokens.
  - `users/{userId}/directories/{directoryId}`: Stores metadata for each directory.

## 🛠 Local Agent Skills (Workspace Local)
In addition to the standard system skills, this project defines **workspace-local skills** in the `skills/` directory at the project root.
- When performing repetitive or complex tasks (e.g., testing local API endpoints or SDK features), check the `skills/` directory for established local conventions and boilerplate scripts.
- For example, `skills/local-testing/SKILL.md` contains the standard workflow for spinning up standalone TypeScript testing scripts (like `test-analyze.ts`) to verify `server.ts` endpoints or Gemini models.
