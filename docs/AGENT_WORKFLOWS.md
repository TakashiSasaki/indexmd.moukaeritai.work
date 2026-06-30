# Agent Workflows

This document outlines the standard operating procedures for multiple AI coding agents (Jules, Codex, Copilot, etc.) interacting with this repository.

## Branching Policy
- `main`: Source of truth, managed primarily via Google AI Studio. **Never force-push or reset.**
- `jules/integration`: The integration branch for Jules. It receives syncs from `main`.
- `automation/sync-main-to-jules-integration`: Ephemeral branch used by GitHub Actions to stage merge conflicts between `main` and `jules/integration`.
- **Agent Branches**: Copilot or Codex should create feature branches (e.g., `feature/agent-xyz`) branching off `main` or `jules/integration` depending on the task context.

## Merge Conflict Resolution
When agents encounter merge conflicts (especially on `sync-main-to-jules-integration`):
1. **Never** blindly accept source or target if it means deleting security rules, schema definitions, or `AGENTS.md` constraints.
2. If `package.json` and `package-lock.json` are in conflict, regenerate the lockfile cleanly (`npm install`) rather than manually interleaving JSON lines.
3. If documentation (README, AGENTS.md) conflicts with implementation, assume `AGENTS.md` is the policy, but update the implementation to match the policy (or ask a human).
4. Do not commit build artifacts (`dist/`), caches (`cache/`), or private testing fixtures to resolve conflicts.

## Validation & PR Reporting
When an agent submits a Pull Request or completes a task:
1. **Run Verification:** Attempt to run `npm run lint` and `npm run test:unit`.
2. **Report Status:** The PR description or commit summary MUST include the results of the verification.
3. **Unverified Items:** If a test cannot be run (e.g., due to missing API keys in the agent's sandbox), explicitly state: "Tests not executed due to lack of environment credentials. Human verification required."

## Documentation vs. Code Changes
Agents should separate sweeping documentation updates from functional code changes. If fixing a bug, only update documentation immediately relevant to that bug. Leave broad audits for dedicated audit tasks (usually handled by Jules).
