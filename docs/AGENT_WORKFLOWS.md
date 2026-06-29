# Agent Workflows

Guidelines for AI Coding Agents working on this repository.

## Verification
- Agents MUST run `npm run lint` and `npm run test:unit` before proposing changes.
- If dependencies cannot be installed or tests cannot be run, this MUST be explicitly stated in the PR description or summary, along with the reason.
- Static verification should be used as a fallback.

## Merge Conflict Resolution
- When resolving conflicts (especially between `main` and `jules/integration`):
  1. Do NOT blindly accept automated git merges for sensitive files (`AGENTS.md`, `package.json`, `schema/*`, `docs/*`).
  2. The agent-neutral repository contract (`AGENTS.md`) is the source of truth for constraints.
  3. Keep `package.json` and `package-lock.json` in sync.
  4. Ensure schema and prompt migrations are fully merged, not overwritten.

## Pull Requests
- PR Descriptions must include:
  - What was changed and why.
  - Verification performed (e.g., "Ran unit tests").
  - Any untested areas.
- Keep PRs small and scoped to a single logical change.

## Code vs Documentation
- If an agent discovers a conflict between implementation and documentation, investigate the original intent before changing either.
- Documentation updates (like `AGENTS.md`) should ideally be separated from functional code changes to ease review.
