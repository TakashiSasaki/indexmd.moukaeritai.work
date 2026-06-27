# Copilot Instructions for indexmd

This repository is maintained by humans and multiple AI agents. GitHub Copilot operates alongside Google AI Studio, Google Jules, and OpenAI Codex.

**CRITICAL: You MUST read `AGENTS.md` before making any changes. It is the agent-neutral repository contract.**

## Copilot-Specific Rules

1. **Atomic Changes**: Keep PRs and branch changes small. Focus only on the specific issue at hand. Do not attempt large-scale refactors unless explicitly instructed.
2. **Conflict Resolution**: When resolving merge conflicts (e.g., between `main` and `jules/integration`), **never** discard security rules, schema definitions, or documentation updates blindly. Always preserve logic constraints from `AGENTS.md`.
3. **Testing**: Before submitting a PR or pushing code, ensure you've verified the changes. Do not introduce regressions.
4. **Documentation**: If your change affects architecture or environments, update the corresponding file in `docs/` (e.g., `docs/RUNTIME_ENVIRONMENTS.md`), but do not duplicate rules from `AGENTS.md`.
5. **PR Descriptions**: In PR descriptions, clearly state what was verified and what remains unverified (e.g., "Verified unit tests passed. Cloud Run deployment unverified.").

Refer to `AGENTS.md` for the core safety constraints regarding Google Drive, Firestore, and authentication.
