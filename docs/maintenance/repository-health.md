# Repository Health Maintenance Playbook

This document is the canonical maintenance instruction set for repository health work in `TakashiSasaki/indexmd.moukaeritai.work`.

Use this for recurring maintenance lanes, health-check passes, and small corrective changes that keep the repository coherent while feature development continues.

## Scope

Repository health maintenance is not feature development. Its purpose is to detect and safely repair drift across code, documentation, agent instructions, schemas, reports, cache observability, developer pages, tests, and workflow documentation.

Maintenance agents may make small, localized, non-destructive corrections. They must not make destructive changes or semantic product changes without an explicit feature task.

## Required startup sequence

1. Read `AGENTS.md`.
2. Read this document.
3. If available in the current agent environment, read `skills/repository-health-maintenance/SKILL.md`.
4. Inspect the latest `main` branch before drawing conclusions.
5. Identify safe fixes versus items that require human confirmation.
6. Run the required validation commands before proposing a commit, unless an exact blocker is documented.

## Non-negotiable safety constraints

- Do not delete Google Drive files, folders, or generated `index.md` files.
- Do not run full Drive-wide indexing.
- Do not loosen Firestore security rules.
- Do not re-add or migrate to the Firestore `(default)` database.
- Do not store refresh tokens anywhere.
- Do not store Drive access tokens in localStorage.
- Do not log OAuth tokens, Gemini API keys, Authorization headers, or API URLs containing credentials.
- Do not commit `cache/` contents.
- Do not commit real private user documents as fixtures.
- Do not commit raw model output, raw request previews, private document text, access tokens, API keys, or service account credentials.
- Do not remove `.github/workflows/sync-main-to-jules-integration.yml` as unused or deprecated.
- Do not reset or force-push `jules/integration`.
- Do not create files in the same directory whose names differ only by case.
- Do not change schema semantics as part of routine maintenance.

## Standard validation commands

Run these before committing maintenance changes:

```bash
npm run lint
npm run test:unit
npm run build
npm run validate:public-samples:images
```

If a command cannot be run, report the exact blocker and do not claim the repository is fully validated.

## Maintenance inventory

Check at least the following files and areas when relevant:

- `AGENTS.md`
- `README.md`
- `package.json`
- `docs/branch-workflow.md`
- `docs/maintenance/repository-health.md`
- `.github/workflows/sync-main-to-jules-integration.yml`
- `server.ts`
- `src/components/DriveDashboard.tsx`
- `src/components/CacheStatsTab.tsx`
- `src/lib/cacheMetrics.ts`
- `src/lib/visualAnalysis/`
- `src/lib/visualAnalysis/publicSamples/`
- `schemas/`
- `scripts/`
- `skills/`

## Health checks

### 1. Documentation freshness

Check that README and docs describe the current application, not only the original AI Studio template. At minimum, documentation should stay aligned with:

- Google Drive index generation and `index.md` hybrid merge behavior;
- Firestore usage and `indexmd-db` constraints;
- Gemini API usage and provider retry behavior;
- Visual Analysis public sample tooling when it is part of the current development surface;
- cache/runtime observability;
- local setup and environment variables;
- actual package scripts.

Safe fixes:
- correct outdated package versions;
- update script lists;
- add missing links to existing docs;
- clarify setup instructions.

Do not invent deployment procedures or infrastructure details that are not present in the codebase.

### 2. AGENTS.md consistency

Check AGENTS.md against the current repository state:

- React/Vite/Tailwind/package versions;
- package scripts;
- current backend SDK and error handling;
- cache families and cache safety rules;
- branch workflow constraints;
- local skills references;
- required validation commands;
- hard safety constraints.

AGENTS.md should remain concise enough to be read at the start of every coding task. Put long maintenance procedures in this document, not directly in AGENTS.md.

### 3. Branch workflow protection

Check that `AGENTS.md`, `docs/branch-workflow.md`, and `.github/workflows/sync-main-to-jules-integration.yml` agree on these points:

- `main` is the source-of-truth branch for Google AI Studio.
- `jules/integration` is the Jules integration branch.
- the sync workflow is repository-operation infrastructure, not application runtime code.
- `jules/integration` must not be reset or force-pushed.
- `automation/sync-main-to-jules-integration` is the conflict isolation branch where force-push may be allowed.

Do not remove branch workflow documentation or workflow files as dead code.

### 4. Schema, provider schema, prompts, and validator consistency

Check that schema-related sources agree:

- `schemas/*.schema.json` version constants;
- `src/lib/visualAnalysis/schema.ts` exports;
- provider schema files;
- canonicalizer and normalizer behavior;
- validator expectations;
- prompt instructions;
- quality gate assumptions;
- report builders and comparison artifacts;
- tests and fixtures.

If a schema version changes, all code paths that reference the version must be aligned. Routine maintenance may repair references, tests, docs, and changelog drift. It must not change schema semantics without a separate feature task.

### 5. API contract consistency

Check server endpoints against frontend consumers and tests. Pay attention to:

- `/api/cache/stats`;
- `/api/cache/stats/reset`;
- Drive scan and cache endpoints;
- Visual Analysis analyze endpoints;
- public sample image endpoints;
- report export builders;
- comparison artifact generation.

For each endpoint, verify that the response shape expected by the UI and tests still matches the server output. Preserve backward-compatible fallbacks for old artifacts where reports or comparisons may load older localStorage data.

### 6. Cache observability consistency

Check alignment across `cacheMetrics.ts`, `server.ts`, `CacheStatsTab.tsx`, public sample fetching, and Visual Analysis reports.

Server-side cache families that should be visible in global cache stats:

- `scan`
- `snippets`
- `summaries`
- `experimentHistory`
- `publicSampleImages`

Metrics and metadata to preserve where applicable:

- hits;
- misses;
- writes;
- bypasses;
- errors;
- shared in-flight events;
- last hit time;
- last miss time;
- last write time;
- enabled/disabled status;
- policy version;
- filesystem entry count;
- total cache bytes;
- oldest/newest mtime.

CacheStatsTab must not display cached file contents, private data, tokens, raw model output, or raw request previews.

Check that metric reset is not described as deleting cache files. If file clearing is available elsewhere, explain the difference between stats reset and cache file clearing.

### 7. Public sample image cache consistency

Check `src/lib/visualAnalysis/publicSamples/serverFetch.ts` and related reports for:

- memory cache behavior;
- disk cache behavior;
- in-flight fetch sharing;
- cache policy version;
- local synthetic fixture handling;
- external image host allowlist;
- cache read/write error handling;
- input diagnostics propagation;
- `inputSizeSummary.cache` aggregation.

Shared in-flight requests must not inflate underlying miss/write counts in batch reports. They may have their own `sharedInFlight` counter.

### 8. Provider retry and quota taxonomy

Check `src/lib/gemini.ts`, `generationFailureHelper.ts`, `reportBuilder.ts`, and `comparisonReport.ts` for consistent provider failure classification.

Important categories:

- `providerRateLimited`
- `providerQuotaExceeded`
- `providerUnavailable`
- `providerInvalidArgument`
- `providerGenerationError`
- transport/client `rateLimited`
- `networkError`
- `jsonParseError`
- `schemaValidationError`
- `apiError`
- `nonJsonResponse`
- `invalidJsonResponse`
- `startupHtml`

Provider quota/rate-limit failures must not be collapsed into generic `generationError` in summaries. Reports should also support legacy artifacts where only diagnostics indicate provider quota, such as:

- `generationDiagnostics.statusCode === 429`;
- `generationDiagnostics.providerStatus === "RESOURCE_EXHAUSTED"`;
- `generationDiagnostics.providerStatus === "QUOTA_EXCEEDED"`;
- `generationDiagnostics.providerFailureKind`;
- `generationDiagnostics.quotaExceeded === true`;
- `generationDiagnostics.rateLimited === true`.

Retry diagnostics must remain compact and must not include secrets, raw private prompts, full private inputs, or credentials.

### 9. Failure summary non-overlap

Check that report summaries are non-overlapping:

- network failures;
- transport/API response failures;
- transport rate limits;
- provider quota/rate limits;
- model parse failures;
- schema validation failures;
- provider generation failures.

A single failed item should not be counted in multiple top-level failure summaries unless a report explicitly documents a secondary diagnostic count.

### 10. Public sample and Visual Analysis regression health

Run `npm run validate:public-samples:images`. Check that:

- registry entries point to available public URLs or local fixtures;
- local fixtures exist and are safe/synthetic;
- expected metadata remains conservative;
- alias expansion does not hide model-specific misses;
- report artifact integrity sentinels are present;
- comparison artifacts detect `native_schema` and `prompt_only` runs;
- compact past batch runs remain backward-compatible.

### 11. Privacy and repository hygiene

Check for accidental inclusion of:

- `cache/` contents;
- `.env` or `.env.local`;
- service account keys;
- OAuth tokens;
- Drive access tokens;
- Gemini API keys;
- private user documents;
- raw model output;
- request previews;
- generated reports containing private data.

If a sensitive file is detected, stop and report it. Do not quote secrets in the report.

### 12. Package and dependency health

Check that:

- `package.json` scripts match docs and AGENTS.md;
- runtime dependencies are not incorrectly placed in devDependencies;
- unused dependencies are not accumulating;
- required types are available;
- build tooling versions are reflected in docs when mentioned;
- lockfile state is consistent if a lockfile exists.

Do not perform broad dependency upgrades as routine maintenance unless explicitly requested.

### 13. Type, build, and test health

Run the standard validation commands. Classify failures as:

- type error;
- unit test failure;
- schema/public sample validation failure;
- build/bundling failure;
- dependency/environment failure;
- runtime integration blocker.

Make safe localized fixes when possible. If the fix requires a design decision, report and stop.

### 14. Case sensitivity and path hygiene

Check for:

- files in the same directory that differ only by case;
- import paths whose casing differs from the actual filename;
- Windows/macOS/Linux path assumptions;
- hard-coded separators where `path.join` should be used.

### 15. Dead code and stale references

Detect references to:

- missing files;
- old endpoints;
- old model names;
- old schema versions;
- old UI tabs;
- deleted scripts;
- obsolete docs.

Do not delete branch workflow or integration infrastructure merely because it is not used by application runtime code.

### 16. Developer page freshness

Check developer-facing pages and diagnostics such as:

- CacheStatsTab;
- Drive debugger surfaces;
- Visual Analysis experiment UI;
- batch report export UI;
- comparison export UI.

Verify that labels and explanations match current runtime behavior. Observability notes should remain accurate, especially around cache lifetime, stats reset, file clearing, and privacy.

## Safe fix policy

Safe to fix during maintenance:

- documentation drift;
- outdated script lists;
- stale file references;
- version string mismatches where the correct source is obvious;
- non-breaking report fallback classification;
- test fixture coverage;
- UI label clarification;
- missing docs links;
- validation command alignment;
- case-sensitive import path mistakes.

Do not fix without explicit confirmation:

- schema semantic changes;
- prompt semantic changes that affect model output contract;
- destructive Drive/Firestore changes;
- security rule changes;
- dependency major upgrades;
- branch history rewrites;
- cache file deletion UI that changes operational behavior;
- broad refactors unrelated to the maintenance finding.

## Expected output from a maintenance pass

Report:

- files inspected;
- checks performed;
- drift detected;
- fixes applied;
- items intentionally not fixed and why;
- commands run and their results;
- remaining risks;
- recommended next maintenance priority;
- proposed commit message.

Suggested commit message format:

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
