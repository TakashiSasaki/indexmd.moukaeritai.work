---
name: apply-patch
description: Guide and standard workflow for applying GitHub patches/diffs in the AI Studio sandboxed workspace, handling network restrictions, verification, and repo safety.
---

# Apply Patch Skill

Use this skill when asked to apply a patch or pull request (e.g., from a GitHub URL like `https://patch-diff.githubusercontent.com/raw/.../pull/<PR>.patch` or `*.diff`).

This skill ensures you can successfully fetch, validate, apply, verify, and document patch application safely even within sandboxed environments.

## Context & Network Limitations

In the AI Studio environment, the `read_url_content` tool has a strict allowlist. Attempting to fetch a `.patch` or `.diff` URL directly via `read_url_content` will fail with an error:
`Encountered error in step execution: error executing cascade step: CORTEX_STEP_TYPE_READ_URL_CONTENT: URL ... is not allowed by the allowlist`

### 💡 The Workaround
To bypass this limitation, use the `run_command` tool to execute `curl` or `wget`. The underlying sandbox's shell has outbound network access and can successfully fetch the patch or diff files.

---

## Required Workflow

### Step 1: Initialize Git (If needed)
If the workspace is not a git repository, initialize a temporary one. This allows you to track modifications, roll back safely if a patch fails to apply, and run standard validation.
```bash
git init
git config user.name "temp"
git config user.email "temp@temp.com"
git add .
git commit -m "initial state before patch"
```

### Step 2: Download the Patch/Diff
Fetch the patch or diff file using `curl` and write it to a temporary file (e.g., `pull_<id>.diff`). 
*Tip*: Prefer using `.diff` over `.patch` as it applies more cleanly with standard git tools without looking for author mail headers.
```bash
curl -s -L "https://patch-diff.githubusercontent.com/raw/.../pull/<PR>.diff" > pull_temp.diff
```

### Step 3: Pre-apply Check
Verify if the patch/diff applies cleanly to the workspace without making actual changes:
```bash
git apply --check pull_temp.diff
```
*If this fails*: Look at the error outputs (stating which files did not apply). If there is partial drift, do not force-apply. Instead, read the `.diff` content using `view_file` on the downloaded file and make surgical edits using `edit_file` or `multi_edit_file` manually.

### Step 4: Apply the Diff
Apply the clean-verified patch/diff:
```bash
git apply pull_temp.diff
```

### Step 5: Clean Up Temporary Files
Never leave temporary `.patch` or `.diff` files in the workspace. Delete them immediately after applying using the file deletion tool:
- `delete_file` with target path `/pull_temp.diff`

### Step 6: Verify Workspace Integrity
Verify that the patch did not introduce compilation, lint, or test failures. You must run the project's standard verification scripts before completing the task.
```bash
npm run lint
npm run test:unit
npm run build
```

### Step 7: Finalize Git State
Commit the changes locally to keep git history clean, using a concise English commit message detailing the applied patch.
```bash
git add -A
git commit -m "Apply PR <id> patch: <brief description of changes>"
```

---

## Safety Constraints

- **Do NOT** commit raw model output, credentials, or private files.
- **Do NOT** leave `.patch` or `.diff` files in the root folder.
- **Always** run lints and tests to verify success after applying the patch.
- **If conflict occurs**: Manually view the failing hunks inside `pull_temp.diff` and apply them surgically using `edit_file`. Do not ignore failures or force broken builds.
