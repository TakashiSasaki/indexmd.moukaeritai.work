# GitHub Copilot Instructions for indexmd

This repository is maintained by multiple agents and humans. To ensure consistency and safety, GitHub Copilot must adhere to the following rules:

1.  **Read AGENTS.md First:** Before proposing any code changes, PRs, or resolving conflicts, you **MUST** read the root `AGENTS.md` file. It is the agent-neutral repository contract and the ultimate source of truth for all rules.
2.  **Small Scopes:** Keep PRs and code modifications small and focused. Do not attempt sweeping architectural refactors unless explicitly instructed.
3.  **Do Not Force-Push `main`:** The `main` branch is the source-of-truth branch used by Google AI Studio. You must never rename, reset, or force-push `main`.
4.  **Preserve Constraints:** When resolving merge conflicts or refactoring, do not accidentally delete or relax constraints defined in `AGENTS.md`, schema definitions, package lockfiles, or security rules.
5.  **Validation Reporting:** When generating PR descriptions or summaries, clearly state what was verified (e.g., tests passed, linted) and explicitly list any unverified items or manual testing required by a human.
6.  **No Private Data:** Never commit tokens, credentials, cache directories (`cache/`), or private user data.
