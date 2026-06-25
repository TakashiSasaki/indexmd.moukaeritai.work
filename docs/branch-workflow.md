# Branch Synchronization Workflow (`main` &leftrightarrow; `jules/integration`)

This document outlines the operational design, roles, and validation procedures for the automated branch synchronization system in the `indexmd` repository.

---

## 🌿 Architectural Roles of Branches

1. **`main` (Source of Truth)**
   - Owned and operated directly by **Google AI Studio** and associated automated code agents.
   - All browser-based prompt generations, edits, and deployments are written and pushed directly to `main`.
   - **Never rename or delete this branch.**

2. **`jules/integration` (Jules Workspace & Integration Target)**
   - Owned and operated by **Jules** for localized development, external merges, and full-stack integration tests.
   - Automatically synchronized from `main` to ensure Jules' changes always build on top of Google AI Studio's latest generations.
   - **Important Constraint**: This branch is **never** reset or force-pushed by automation, preserving Jules' unpushed history.

3. **`automation/sync-main-to-jules-integration` (Conflict Isolation Branch)**
   - Owned by the synchronization runner.
   - Used exclusively to build conflict pull requests into `jules/integration` when automatic direct merging fails.
   - **Force-pushes are permitted on this branch only.**

---

## 🔄 Automatic Sync Mechanism

The automation runs on GitHub Actions, defined in:
`.github/workflows/sync-main-to-jules-integration.yml`

### 1. Trigger Conditions
- Triggers on every `push` directly to `main`.
- Can be run manually via `workflow_dispatch`.

### 2. Execution Flow

```
                Push to 'main' / Manual Dispatch
                              │
                    Fetch latest history
                              │
                Is 'jules/integration' absent?
                    ├── Yes ──> Create from 'main' & exit
                    └── No
                              │
               Switch to 'jules/integration'
                              │
              Attempt 'git merge origin/main'
                    ├── Success (Clean Merge)
                    │        ├── Push to 'jules/integration'
                    │        └── Close any open conflict PR (if present)
                    │
                    └── Failure (Merge Conflict)
                             ├── Abort merge ('git merge --abort')
                             ├── Switch to 'automation/sync-main-to-jules-integration' from 'main'
                             ├── Force-push to remote conflict branch
                             └── Open or update PR targeting 'jules/integration'
```

### 3. Permissions & Tokens
- By default, uses the built-in repository `github.token` with explicit write permissions:
  ```yaml
  permissions:
    contents: write
    pull-requests: write
  ```
- If advanced repository restrictions (e.g., branch protections) block the default `GITHUB_TOKEN`, a repository secret named **`SYNC_TOKEN`** (a Personal Access Token with minimal `repo` scopes) should be configured. The workflow automatically falls back to `SYNC_TOKEN` when defined.

---

## ⚠️ Merging and Conflict Resolution Guidelines

If the sync workflow triggers a **Merge Conflict PR**:
1. Do **not** attempt to merge the conflict branch via GitHub's standard merge button unless you are confident it won't introduce regressive code.
2. The recommended approach is to check out `jules/integration` locally, merge `main`, resolve conflicts locally, test, and push directly to `jules/integration`:
   ```bash
   git checkout jules/integration
   git pull origin jules/integration
   git merge origin/main
   # [Resolve conflicts manually in your editor]
   # [Verify with local test suite]
   npm run lint
   npm run test:unit
   npm run build
   # [Commit and Push]
   git commit -am "merge: resolve conflicts with main"
   git push origin jules/integration
   ```
3. Once pushed, the next automated sync run will detect that `jules/integration` is up to date and will automatically **close** the stale conflict PR and delete the temporary automation branch.

---

## 🔒 Hard Safeguards & Restrictions

- **Never** alter or delete the `.github/workflows/sync-main-to-jules-integration.yml` file under the assumption that it is "unused" or "deprecated".
- **Never** use `git reset --hard` or `git push --force` on the `jules/integration` branch from the automation script.
- Maintain the Firestore security rules and database setup (`indexmd-db`). Never restore default relational configurations unless explicitly instructed.
- Never store Google Drive access or refresh tokens in local storage or repository logs.
