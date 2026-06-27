# Agent Workflows & Collaboration

Because `indexmd` is edited by humans, Google AI Studio, Google Jules, OpenAI Codex, and GitHub Copilot, strict workflow procedures must be followed to avoid destructive interference.

## Branch Strategy & Source of Truth

1. **`main`**: The absolute source of truth. Google AI Studio edits directly on this branch.
2. **`jules/integration`**: The branch used by Google Jules for audits and refactors.
3. **`automation/sync-main-to-jules-integration`**: An ephemeral branch managed by GitHub Actions that attempts to merge `main` into `jules/integration`.
4. **Feature Branches**: Copilot or Codex should create ephemeral feature branches off `main` or `jules/integration` for specific tasks, submitting Pull Requests.

## Merge Conflict Resolution (Crucial for Copilot/Codex)

When `main` receives an edit from AI Studio, the CI action will attempt to merge it into `jules/integration`. If a conflict occurs, a PR is opened.

When resolving these conflicts:
1. **Never reset or force-push `jules/integration` to match `main` exactly.**
2. **Never discard security constraints.** If AI Studio adds a feature but Jules has tightened security on that code path, merge the feature *into* the secure code path.
3. **Do not overwrite `AGENTS.md` blindly.** Maintain its role as the agent-neutral contract.
4. **Package Files:** Ensure both `package.json` and `package-lock.json` are synced correctly. Do not accept one without the other.

## PR and Review Process

1. **Small PRs**: Agents must keep PRs scoped to a single logical change.
2. **Description Requirements**: Every PR created by an agent must include:
   - What the change does.
   - What tests were run (e.g., `npm run test:unit`, `npm run build`).
   - Any unverified aspects (e.g., "UI appearance not visually verified", "Cloud Run deployment unverified").
3. **Review**: Other agents or humans reviewing the PR must check against the `AGENTS.md` constraints before approving.

## Documentation vs Implementation Conflicts

If an agent notices a discrepancy between the implementation and the documentation (e.g., `AGENTS.md` or files in `docs/`):
1. Prioritize user intent and explicit instructions.
2. If it's an unintentional regression in code, fix the code.
3. If it's a deliberate architectural change, update the documentation to match the new reality.
4. **Never** loosen safety constraints documented in `AGENTS.md` or `docs/SECURITY.md` just because the code bypassed them. Fix the code instead.
