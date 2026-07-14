# Intent Verification and Classification

## Applied Unchanged (from main)
The following files and components were applied unchanged from `main`, preserving their architecture and new features (like dependency injection, schema compiler, preflight, etc.):
- `src/app.ts` and `server.ts` separation and setup
- `src/lib/visualAnalysis/preflight.ts` & `.test.ts`
- `src/lib/visualAnalysis/schemaCompiler.ts` & `.test.ts`
- `src/lib/visualAnalysis/providerTransport.ts` & `.test.ts`
- `src/lib/visualAnalysis/serverJobs/runnerRegistry.ts`
- `src/lib/visualAnalysis/serverJobs/localJobBackup.ts`
- `src/lib/visualAnalysis/canonicalize.ts`
- `src/lib/visualAnalysis/runMetadata.ts`
- `src/lib/visualAnalysis/types.ts`
- CI workflow (`.github/workflows/ci.yml`)

## Applied with Semantic Adaptation
The following files had conflicts or semantic overlaps and were adapted to retain the current `codex` implementations where they represented newer/fixed capabilities, while accepting `main`'s architectural structures:
- `src/components/ImageExperiment.tsx`
- `src/lib/visualAnalysis/serverJobs/jobRunner.ts`
- `src/lib/visualAnalysis/serverJobs/jobRunner.test.ts`
- `src/lib/visualAnalysis/publicSamples/batchTypes.ts`
- `src/lib/visualAnalysis/analysisBundleRetrieval.test.ts`
- `src/lib/gemini.ts`
- `src/lib/runtime/geminiKeyInfo.ts` and `.test.ts`

## Preserved Unchanged (Codex-only)
The following files were preserved as they appear in `codex` without interference from `main`, representing Codex-only fixes (like image sizing, false-positive comparator tweaks, report builder logic, prompt updates, and bundle retrieval core logic):
- `src/lib/visualAnalysis/analysisBundleRetrieval.ts`
- `src/lib/visualAnalysis/imagePayloadSizing.ts` & `.test.ts`
- `src/lib/visualAnalysis/publicSamples/compare.ts` & `.test.ts`
- `src/lib/visualAnalysis/publicSamples/reportBuilder.ts` & `.test.ts`
- `src/lib/visualAnalysis/publicSamples/semanticFixes.test.ts`
- `src/lib/visualAnalysis/prompts.ts`
- `src/lib/visualAnalysis/qualityGate.ts`

## Intentionally Superseded
- `src/lib/visualAnalysis/providerSchema.ts` (replaced by schemaCompiler from `main`)
- `final_test.txt`, `test_log.txt`, and other scratch files were intentionally omitted/deleted.
