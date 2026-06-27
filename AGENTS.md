# indexmd Agent-Neutral Repository Contract

> **IMPORTANT**: This repository may be edited by multiple coding agents, including but not limited to Google Jules, OpenAI Codex, GitHub Copilot, and Google AI Studio assisted editing. Treat this file as an agent-neutral repository contract. Do not assume agent-specific memory, prior chat context, local setup, or hidden project knowledge. Work only from repository files and explicitly supplied task context.

This file provides critical context and constraints for all AI coding agents and human developers working on the `indexmd` project. **Read this before making any logic changes.**

## 🎯 Core Mission

Build a high-performance, cost-effective Google Drive indexer that generates/updates `index.md` files in every directory with AI-generated summaries.

## 🛠 Tech Stack

- **Frontend**: React 18 (Vite), Tailwind CSS, Lucide icons.
- **Backend**: Node.js (Express), `@google/genai` (Gemini SDK).
- **Storage**:
  - **Firestore**: Tracks directory traversal state and metadata.
    - **Project ID**: `moukaeritaid`
    - **Database ID**: `indexmd-db` (Native mode)
    - **Collections**: `users/{userId}/state/global_sync`, `users/{userId}/directories/{directoryId}`
  - **Local Filesystem**: `src/data/validation_history.json` tracks processing success/fails.
- **APIs**: Google Drive API (Advanced scope required for file manipulation).

## 🤖 Multi-Agent Environment & Roles

This repository is maintained by humans and multiple AI agents. Agents must not conflict with one another and must abide by this contract.

- **Google AI Studio**: The primary development environment and source of truth (`main` branch). Beware of iframe/COOP constraints.
- **Google Jules**: Performs periodic audits and repository maintenance on `jules/integration`. Do not assume Jules can safely bypass tests or security rules.
- **OpenAI Codex**: May intervene from CLI, cloud, or local IDEs. Do not assume Codex has local credentials; static verification is key.
- **GitHub Copilot**: Creates PRs, reviews, and resolves merge conflicts. It must make atomic changes and never overwrite this contract or safety constraints during conflict resolution.

See [docs/RUNTIME_ENVIRONMENTS.md](docs/RUNTIME_ENVIRONMENTS.md) and [docs/AGENT_WORKFLOWS.md](docs/AGENT_WORKFLOWS.md) for detailed operational differences.

## ⚔️ Conflict Resolution Strategy

When multiple agents edit the same files:
1. **Source of Truth**: `main` is the AI Studio source of truth. `jules/integration` tracks `main` via automation.
2. **Never Drop Constraints**: Merge conflicts must be resolved by preserving security rules, schemas, and this `AGENTS.md` file. Do not blindly overwrite them.
3. **Artifacts**: Do not commit build artifacts (`dist/`), caches (`cache/`), or private fixtures.
4. **Verification**: Always run `npm run lint`, `npm run test:unit`, and `npm run build` after resolving conflicts. If tests cannot be run, document the reason in the PR or commit.

## ⚠️ Critical Logic Constraints (Maintain at all costs)

### 1. Firestore Write Optimization (Billing Awareness)
- **Do NOT** perform unconditional `set` operations. Always check if data has changed (path, depth, parent_id) BEFORE writing to Firestore.
- **Batch Processing**: Use `writeBatch` for bulk directory updates (limit 450 per batch).

### 2. File Protection Mechanism (Hybrid-Merge)
- `index.md` files are split into two zones.
  - **User Notes**: Manual content written by humans. **NEVER OVERWRITE THIS**.
  - **Auto-Generated**: Wrapped in `<!-- AUTO_GENERATED_START -->` and `<!-- AUTO_GENERATED_END -->`. Only this block is replaced.

### 3. Safety Constraints (Strict)
- **Drive Safety**: Do NOT delete Google Drive files, folders, or generated `index.md` files. Do NOT run full Drive-wide indexing outside of intended scopes.
- **Data Safety**: Firestore database ID is `indexmd-db`. Do not loosen security rules or re-add `(default)`.
- **Auth Safety**: Do NOT store refresh tokens anywhere. Do NOT store Drive access tokens in localStorage (use sessionStorage). Do NOT log OAuth tokens or API URLs.
- **Security Docs**: See [docs/SECURITY.md](docs/SECURITY.md) for exhaustive security policies.

## 📚 Documentation Reference

To maintain clarity and modularity, consult the following documents based on your task:
- [README.md](README.md): Entry point for developers and agents.
- [.github/copilot-instructions.md](.github/copilot-instructions.md): Specific constraints for GitHub Copilot.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): Architecture and component responsibilities.
- [docs/RUNTIME_ENVIRONMENTS.md](docs/RUNTIME_ENVIRONMENTS.md): Differences between AI Studio, Cloud Run, Local, etc.
- [docs/AGENT_WORKFLOWS.md](docs/AGENT_WORKFLOWS.md): Standard operating procedures for agents.
- [docs/SECURITY.md](docs/SECURITY.md): Security, OAuth, and data safety.
- [docs/SEO_PWA.md](docs/SEO_PWA.md): SEO and PWA configurations.
- [docs/OPERATIONS.md](docs/OPERATIONS.md): CI/CD and deployments.
