# Copilot Instructions

This project is a multi-agent coding environment (Google Jules, OpenAI Codex, GitHub Copilot, Google AI Studio).

**CRITICAL: You MUST read `AGENTS.md` before making any changes.** It is the primary, agent-neutral source of truth for this repository. Do not rely on internal chat history or default knowledge.

## Copilot-Specific Rules
1. **Branching & PRs**:
   - Keep changes scoped and minimal to avoid massive merge conflicts.
   - Do NOT commit directly to `main` or `jules/integration`.
   - When creating a PR or generating a summary, clearly list what was statically verified, what was tested dynamically, and what remains unverified (e.g., "Tested build, but Cloud Run deployment unverified").
2. **Conflict Resolution**:
   - When resolving merge conflicts, never override `AGENTS.md`, schemas, `package-lock.json`, or security rules without explicit user instruction.
   - Do not commit cache files (`cache/`), local fixtures, or secrets.
3. **Documentation Sync**:
   - If you modify code that impacts architecture, deployment, or environment behavior, prompt the user to update the corresponding files in `docs/` and/or `README.md`.
