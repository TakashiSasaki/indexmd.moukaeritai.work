# GitHub Copilot Instructions

You are interacting with the `indexmd` project. This project uses multiple coding agents, including Google AI Studio, Google Jules, and OpenAI Codex.

**CRITICAL: You MUST read the `AGENTS.md` file in the root directory before proposing any changes.**
`AGENTS.md` serves as the agent-neutral repository contract.

When making PRs or resolving merge conflicts:
- Do NOT delete or weaken security constraints.
- Do NOT overwrite schema changes blindly.
- Do NOT alter Firestore `databaseId` rules.
- Do NOT assume the local file system is persistent (Cloud Run target).
- Explicitly state in PR descriptions whether changes were tested or untested. If untested, state the reason.
- Keep your changes scoped only to what is requested.
