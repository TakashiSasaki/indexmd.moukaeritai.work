# Stride Acceptance Matrix

| Requirement | Production Code Location | Positive Test | Negative or Boundary Test | Command that Executes the Test | Status |
| --- | --- | --- | --- | --- | --- |
| Provider-unavailable runner-owned retry max 2 | `jobRunner.ts` | `jobRunner.test.ts` (Table-Driven Retry Matrix) | `jobRunner.test.ts` (transition running -> pausedForProviderUnavailable on HTTP 503) | `npm run test:unit` | Complete |
| Retryable conditions (502, 503, 504, etc) | `jobRunner.ts` | `jobRunner.test.ts` (Table-Driven Retry Matrix) | `jobRunner.test.ts` (Table-Driven Retry Matrix - 400 INVALID_ARGUMENT) | `npm run test:unit` | Complete |
| AbortSignal cancellation propagation | `jobRunner.ts`, `app.ts`, `providerTransport.ts` | `jobRunner.test.ts` (cancels execution when abort is called), `providerTransport.test.ts` (includes abort signal if provided) | `jobRunner.test.ts` (cancels execution when abort is called) | `npm run test:unit` | Complete |
| Remove `providerRetryPolicy` | `jobRunner.ts`, `app.ts` | Manual inspection / unit tests passing | `npm run test:unit` | `npm run test:unit` | Complete |
| Constrain Gemini SDK retry behavior | `gemini.ts`, `providerTransport.ts` | `providerTransport.ts` documentation added | `gemini.test.ts` (no longer needed to verify SDK config inside app since app delegates to transport exactly once) | `npm run test:unit` | Complete |
| Extract deterministic `buildGeminiGenerateContentParams` | `providerTransport.ts` | `providerTransport.test.ts` (builds basic structure with base64 string) | `providerTransport.test.ts` (contains no secrets or global job state) | `npm run test:unit` | Complete |
| Deterministic retry delay parsing | `gemini.ts`, `jobRunner.ts` | `gemini.test.ts` (extracts RetryInfo without Date.now calls), `jobRunner.test.ts` | `gemini.test.ts` | `npm run test:unit` | Complete |
| `RunnerRegistry` lifecycle semantics (FIFO 128 max) | `runnerRegistry.ts` | `runnerRegistry.test.ts` (active wait returns completion promise) | `runnerRegistry.test.ts` (FIFO eviction happens at 129 entries, unknown job returns explicit error) | `npm run test:unit` | Complete |
| Application dependencies resolution inside `createApp` | `app.ts` | `architecture.test.ts` (production routes do not directly instantiate Gemini transport) | `publicExecution.test.ts` (standalone public route analysis uses injected dependencies) | `npm run test:architecture`, `npm run test:integration` | Complete |
| Replace loose async tests with deterministic harness | `jobRunner.test.ts` | `jobRunner.test.ts` | `jobRunner.test.ts` | `npm run test:unit` | Complete |
| Add `test:components` script & run in `test:all` & CI | `package.json`, `ci.yml`, `scripts/test-runner.js` | `package.json` inspection | `ci.yml` inspection | `npm run test:components`, `npm run test:all` | Complete |
| Add project-specific verification skill in `AGENTS.md` | `skills/stride-verification/SKILL.md`, `AGENTS.md` | Manual Verification | Manual Verification | N/A | Complete |
| Prevent false-green CI & claim-to-diff mismatch | `AGENTS.md`, `skills/` | Manual Verification | Manual Verification | N/A | Complete |
