# GitHub Copilot Instructions for indexmd

This repository is maintained by multiple AI agents (Google AI Studio, Jules, Codex, and you, Copilot).

**CRITICAL INSTRUCTION**: You MUST read the [Agent-Neutral Repository Contract (`AGENTS.md`)](../AGENTS.md) in the root of the repository before suggesting, reviewing, or committing any code changes.

## Copilot Specific Guidelines:
1. **Scope Limit**: Keep PRs small and focused.
2. **Conflict Resolution**: Do NOT blindly overwrite `package.json`, `package-lock.json`, schemas, or `docs/` files during merge conflict resolutions. If a conflict occurs, `main` is generally the source of truth for features, but `jules/integration` may contain important system-level fixes.
3. **Verification Output**: When generating PR descriptions or summaries, explicitly state what you have verified (e.g., `npm run test:unit`) and clearly list any unverified items.
4. **Docs Segregation**: Avoid massive logic refactors if you were only tasked with updating documentation. Keep code and doc fixes as separate PRs if possible.
5. **No Hallucinations**: Do not assume local testing environment setup; always use the repository files and scripts (e.g., `skills/`) as the basis for test commands.
