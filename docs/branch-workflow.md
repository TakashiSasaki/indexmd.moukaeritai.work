# Branch Synchronization Workflow

This document defines the repository's branch synchronization policy.

## Default branch

The canonical integration and default branch is:

`indexmd.moukaeritai.work`

Repository automation may write directly to this branch for the synchronization workflow described below.

## Source branches

The following branches may contain work produced by external tools or coding agents:

- `main`
- `chatgpt`
- `jules`
- `codex`

These branches are synchronization sources. Automation does not merge the default branch back into them.

## One-way synchronization

The only branch synchronization workflow is:

`.github/workflows/sync-to-default.yml`

Its direction is strictly:

```text
main ───────┐
chatgpt ────┤
jules ──────┼──> indexmd.moukaeritai.work
codex ──────┘
```

The workflow runs after a push to one of the source branches and can also be invoked manually with `workflow_dispatch`.

For each run it:

1. checks out the latest `indexmd.moukaeritai.work` branch;
2. fetches the selected source branch;
3. performs a normal non-force merge of the source into the default branch;
4. pushes the resulting merge to `indexmd.moukaeritai.work` when the merge succeeds;
5. exits without a push when the default branch already contains the source changes.

## Conflict policy

If Git reports a merge conflict, automation:

- aborts the merge;
- fails the workflow run;
- does not create a pull request;
- does not create or force-update an automation branch;
- does not reset or force-push any branch.

Conflicts must be resolved manually and the synchronization workflow can then be rerun.

## Removed automation

The former bidirectional automation has been removed:

- automatic synchronization from `main` into `chatgpt`, `jules`, and `codex`;
- automatic pull-request creation from agent branches into `main`;
- conflict pull-request creation and automation-owned conflict branches.

Pull requests may still be created manually when review is desired, but no workflow creates them automatically.

## Permissions and token

The synchronization workflow requests only:

```yaml
permissions:
  contents: write
```

It uses `SYNC_TOKEN` when configured and otherwise uses the repository-provided `github.token`.

## Safety rules

- Synchronization is always toward `indexmd.moukaeritai.work`.
- Do not add reverse synchronization from the default branch to source branches.
- Do not add automatic pull-request creation to the synchronization workflow.
- Do not use `git reset --hard` or force-push for synchronization.
- A conflict must remain visible as a failed workflow run until manually resolved.
- Preserve Firestore security rules and never commit Google Drive access tokens, refresh tokens, Gemini API keys, or credential-bearing URLs.
