# Agent Workflows

This document outlines standard operating procedures for multiple AI agents (AI Studio, Jules, Codex, Copilot) working in this repository.

## 1. Branch Workflow & The Source of Truth
- **`main`**: The absolute source of truth for the application's active state. Managed primarily by Google AI Studio.
- **`jules/integration`**: Used by Google Jules for audits. Kept in sync with `main` via the GitHub Action `.github/workflows/sync-main-to-jules-integration.yml`.
- **Feature Branches**: Agents like Copilot or Codex should create ephemeral feature branches branching off `main`.

## 2. Conflict Resolution (Merge Conflicts)
When resolving conflicts (e.g., between `main` and `jules/integration`, or an agent PR):
- **DO NOT** blindly overwrite configuration files (`package.json`, `package-lock.json`).
- **DO NOT** discard security rules or constraint documentation.
- If a schema or prompt version is modified in one branch and documentation in another, **both** must be merged logically.
- Never force-push or reset `jules/integration` to match `main` directly; use standard git merges to resolve.

## 3. PR Creation and Verification
Every automated Pull Request MUST include:
1. **Summary of Changes**: What logic or documentation was altered.
2. **Verification Output**: Explicit confirmation that `npm run lint`, `npm run test:unit`, and `npm run build` passed.
3. **Unverified Items**: A clear list of any impacts the agent could not verify (e.g., "I could not verify Google Drive OAuth locally because I lack browser context").

## 4. Documentation vs Implementation Mismatches
If an agent detects a discrepancy between implementation and `AGENTS.md` or `docs/`:
1. If the implementation breaks a documented security rule -> **Fix the implementation immediately.**
2. If the implementation is an optimized refactor that makes the documentation outdated -> **Fix the documentation to match.**
