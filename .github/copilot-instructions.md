# GitHub Copilot Instructions for indexmd

1. **Read AGENTS.md**: You must read `AGENTS.md` at the repository root before making changes. It is the agent-neutral repository contract that defines hard safety constraints and architectural rules.
2. **Work Incrementally**: Keep PRs small and focused.
3. **No Destructive Operations**: Do not delete Drive files or generated `index.md` files. Do not commit private data, tokens, or cache.
4. **Conflict Resolution**: Be extremely careful during merge conflicts. Do not silently discard updates to `AGENTS.md`, `package.json`, lockfiles, schemas, migrations, or safety constraints.
5. **PR Summaries**: You must explicitly state in the PR description what tests and validations you ran. If you skipped verification, clearly list the untested items and the reason why.
