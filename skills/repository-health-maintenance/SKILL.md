---
name: repository-health-maintenance
description: Repository health maintenance workflow for keeping docs, agent instructions, schemas, runtime contracts, cache observability, and tests aligned.
---

# Repository Health Maintenance Skill

Use this skill when asked to run a recurring or one-off repository health maintenance pass for `TakashiSasaki/indexmd.moukaeritai.work`.

This skill is a lightweight agent wrapper. The canonical detailed instruction set is `docs/maintenance/repository-health.md`.

## Required reading order

1. Read `AGENTS.md`.
2. Read `docs/maintenance/repository-health.md`.
3. Read this file.
4. Inspect the latest target branch, normally `main`.

## Mission

Keep the repository coherent while feature development continues. Detect and safely repair drift across:

- README, docs, AGENTS.md, and developer pages;
- package scripts and validation commands;
- schema, provider schema, prompts, validators, canonicalizers, and tests;
- server endpoint contracts and frontend consumers;
- CacheStatsTab, cache metrics, public sample image cache, and report summaries;
- provider quota/rate-limit taxonomy and legacy artifact fallback handling;
- branch workflow documentation and protected automation;
- privacy, token safety, fixture safety, and repository hygiene;
- case-sensitive paths and cross-platform path assumptions.

## Safety boundary

You may make small, localized, non-destructive maintenance fixes.

Do not perform these actions as part of routine maintenance:

- delete Google Drive files, folders, or generated `index.md` files;
- run full Drive-wide indexing;
- loosen Firestore security rules;
- change schema semantics;
- change model output contract semantics;
- store or log tokens/API keys/private document content;
- commit `cache/` contents or private fixtures;
- remove branch synchronization workflow files as unused;
- reset or force-push `jules/integration`;
- perform broad dependency upgrades;
- introduce cache TTL/expiration unless explicitly requested.

## Standard workflow

1. Identify the maintenance scope.
2. Check the repository health playbook for applicable items.
3. Inspect current code and docs before assuming drift.
4. Categorize findings:
   - safe to fix now;
   - needs human decision;
   - blocked by environment/runtime access;
   - out of scope for maintenance.
5. Apply safe fixes only.
6. Run validation commands.
7. Report findings, fixes, blockers, and proposed commit message.

## Required validation commands

Run these before proposing a commit whenever possible:

```bash
npm run lint
npm run test:unit
npm run build
npm run validate:public-samples:images
```

If any command cannot be run, state the exact blocker and do not claim full validation.

## High-priority checks

### Documentation and agent instruction drift

- Compare `README.md`, `AGENTS.md`, and docs against `package.json`, `server.ts`, and current source layout.
- Keep `AGENTS.md` concise and current.
- Put long recurring procedures in `docs/maintenance/repository-health.md`, not directly in `AGENTS.md`.

### Schema and Visual Analysis drift

- Verify schema version strings and imports.
- Check schema/provider schema/canonicalizer/validator/prompt/report/test consistency.
- Preserve backward compatibility for old localStorage/report artifacts when possible.

### Cache observability drift

- Verify that `scan`, `snippets`, `summaries`, `experimentHistory`, and `publicSampleImages` are represented in global cache stats.
- Verify CacheStatsTab displays hit/miss/write/bypass/error/shared/entry/size/last activity/policy/enabled state where applicable.
- Do not display cache contents.

### Provider quota taxonomy drift

- Verify `providerRateLimited` and `providerQuotaExceeded` remain distinct from generic `generationError`.
- Verify reports and comparisons support both new top-level failure kinds and legacy diagnostics-only artifacts.
- Keep retry diagnostics compact and secret-free.

### Branch workflow protection

- Protect `.github/workflows/sync-main-to-jules-integration.yml`.
- Keep `docs/branch-workflow.md` and `AGENTS.md` aligned.
- Never force-push or reset `jules/integration`.

## Reporting template

Use this structure in the final maintenance report:

```text
Repository health maintenance report

Scope:
- ...

Files inspected:
- ...

Findings:
- ...

Fixes applied:
- ...

Not fixed / needs decision:
- ...

Validation:
- npm run lint: ...
- npm run test:unit: ...
- npm run build: ...
- npm run validate:public-samples:images: ...

Remaining risks:
- ...

Suggested commit message:
...
```

## Default commit message

```text
chore(repo): maintain repository health checks
```

Optional body:

```text
- align agent instructions, docs, scripts, and runtime contracts
- verify schema, prompt, validator, and report consistency
- preserve cache and provider quota observability contracts
- keep branch workflow and safety constraints up to date
- run lint, unit tests, build, and public sample validation
```
