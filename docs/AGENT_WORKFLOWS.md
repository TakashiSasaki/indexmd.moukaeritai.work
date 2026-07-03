# Agent Workflows & Conflict Resolution

This document specifies how multiple AI agents interact within this repository.

## Branch Strategy
1. **`main`**: The Source of Truth. Managed by Google AI Studio.
2. **`jules/integration`**: Managed by Google Jules for audits and docs. Kept in sync with `main`.
3. **Agent feature branches**: Temporary branches spawned by Copilot/Codex for PRs.

## Conflict Resolution Policy
When merging `main` into `jules/integration` or handling Copilot PRs:
- **Do not overwrite `AGENTS.md`** with generic templates.
- **Do not discard `package-lock.json`** blindly. If lock conflicts exist, run `npm install` locally/in CI to regenerate securely.
- **Safety Constraints win**: If `main` introduces a relaxed security rule, the conflict resolution must enforce the strict rule from `jules/integration`.
- **Documentation**: If docs and code conflict, favor the code's behavior for immediate fixing, but create a task/report in the PR body indicating the discrepancy.

## PR Summary Requirements for Agents
Any PR created by Codex or Copilot must include:
1. **Verification Performed**: (e.g., "Ran `npm run test:unit`, 100% pass.")
2. **Untested Areas**: (e.g., "Did not test Google OAuth pop-up manually because I am a headless agent.")
3. **Safety Checklist**: Confirm no Drive files are deleted, no tokens logged.
