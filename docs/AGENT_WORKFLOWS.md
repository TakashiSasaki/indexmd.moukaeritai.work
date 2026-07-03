# Agent Workflows

This document outlines the standard operating procedures for any coding agent (Jules, Codex, Copilot) interacting with this repository.

## 1. Context Acquisition
- **Start Here**: Always begin by reading `AGENTS.md`. It is the central repository contract.
- **Do Not Assume**: Never rely on memory from previous chats, external project context, or typical standard setups. Read the current configuration files (`package.json`, `vite.config.ts`, etc.).

## 2. Modification Rules
- **Scope**: Keep changes as isolated as possible to prevent complex merge conflicts between different agents and humans.
- **Code vs. Docs**: If you discover a contradiction between documentation and code, the documentation (`AGENTS.md`, `docs/`) takes precedence for intended design, though the code dictates current behavior. Document the discrepancy and ask the user for clarification before applying heavy refactors.

## 3. Pre-Commit Verification
- **Static Analysis**: Always run `npm run lint`.
- **Unit Testing**: Always run `npm run test:unit`. Ensure test fixtures do not rely on private user data or live Google Drive endpoints.
- **Build Verification**: Always run `npm run build` to ensure the application compiles.
- **Reporting**: If an agent cannot run a test (e.g., due to missing dependencies in a sandbox), it MUST state this explicitly in the PR description or final message (e.g., "Tested statically, but unit tests were not run due to environment constraints").

## 4. Conflict Resolution Strategy
- **jules/integration vs main**: When resolving conflicts on `jules/integration` after a sync from `main`, use standard `git merge`. Do not force push.
- **Protect Critical Files**: When auto-resolving conflicts, never overwrite:
  - `package-lock.json` (prefer `npm install` to resolve).
  - Firestore security rules (`firestore.rules`).
  - `AGENTS.md` (manual human review preferred if conflicts are severe).
- **No Artifacts**: Never commit `cache/`, `dist/`, or `.env` files during conflict resolution.
