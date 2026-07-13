# Stride Verification Requirements

This skill ensures that all changes made in a stride are properly verified, preventing false-green CI builds and claim-to-diff mismatches. It acts as an integration and completion quality gate for AI agents working in this repository.

## 1. Acceptance Traceability
When starting a milestone, create an acceptance matrix and update it before claiming completion. Every requirement must be mapped to:
* Production code location (file and symbol).
* Positive test case.
* Negative or boundary test case.
* Exact execution command used to verify the test locally and in CI.

## 2. Test Discovery Audit
Ensure all newly added tests are actually being run.
* Discover all test files (\`.test.ts\`, \`.test.tsx\`).
* Identify the script that invokes them (e.g. \`test:unit\`, \`test:components\`).
* Confirm that \`test:all\` aggregates all execution commands and that CI (e.g., \`ci.yml\`) runs them successfully.

## 3. Claim-to-Diff Verification
Before writing a PR description or completion report, verify your work:
* List every claimed feature.
* Identify the exact changed production file.
* Identify the exact changed test.
* Reject unsupported claims. Do not claim features that are not explicitly present in the git diff.

## 4. Deterministic Async Testing
When writing asynchronous tests (like retry flows or timeouts), ensure you use deterministic testing techniques:
* Use fake clocks (e.g., manual time advancement).
* Use explicit lifecycle barriers and deferred promises.
* DO NOT use real \`sleep\`, \`setTimeout\`, or \`setImmediate\` for state synchronization.
* DO NOT use polling loops.

## 5. False-Green Prevention
Always provide proof that tests were run and passed. Verify package scripts are correctly wired to test runners and are successfully triggered in CI workflows.
