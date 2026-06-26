# GitHub Copilot Repository Instructions

Welcome to the `indexmd` project. This repository is maintained by a multi-agent environment (Google AI Studio, Google Jules, OpenAI Codex, and GitHub Copilot).

To ensure consistency and safety, **you MUST read `AGENTS.md` before making any logic changes or opening a PR.**

## Core Directives for Copilot:
1. **Agent-Neutral Contract**: Treat `AGENTS.md` as the ultimate source of truth for architectural constraints and safety rules.
2. **Small PRs**: When generating pull requests, keep changes scoped and small.
3. **Conflict Resolution**: If resolving merge conflicts between `main` and `jules/integration`, do **not** blindly overwrite `package-lock.json`, schema versions, or security rules.
4. **Verification**: Before concluding your work, ensure you (or the human developer) run `npm run lint`, `npm run test:unit`, and `npm run build`. Document any untested changes in your PR description.
5. **No Destructive Operations**: Never write code that deletes Google Drive files, exposes OAuth tokens, or alters the default `indexmd-db` Firestore database ID.

*For detailed environment setup, see `docs/RUNTIME_ENVIRONMENTS.md`.*
