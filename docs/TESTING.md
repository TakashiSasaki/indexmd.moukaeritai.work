# indexmd Testing Guide

This document describes the testing strategy and commands for the indexmd project. The focus is on fast, deterministic unit testing using the native Node.js test runner.

## Core Testing Principles

1. **No Network**: Tests must not rely on active internet connections, real Firebase instances, real Google Drive APIs, or real Gemini model calls.
2. **Deterministic Output**: Use mocked dates and stable identifiers in tests to prevent flakiness.
3. **No Private Data**: Do not use real user data, private Google Drive file contents, or real access tokens in fixtures.
4. **Lightweight Execution**: The test suite should remain extremely fast. Avoid heavy browser or E2E tests unless explicitly required and siloed.

## Running Tests

### Unit Tests
To run the full unit test suite:
```bash
npm run test:unit
```
This executes all `*.test.ts` files inside `src/` using `node --import tsx --test`.

### Code Coverage
To run the unit tests and generate a coverage report:
```bash
npm run test:coverage
```
This uses Node's native `--experimental-test-coverage` flag. Note: we do not enforce strict coverage thresholds, but you should strive to cover new helpers and logic.

## Adding Tests

### Where to Put Tests
Tests should be placed alongside the module they test, ending in `.test.ts`. For example:
- `src/lib/driveToken.ts`
- `src/lib/driveToken.test.ts`

### Testing Schema and Prompts
When modifying `summaryAnalysisSchema.ts` or `promptSpecs.ts`, ensure that all edge cases (e.g., malformed objects, unexpected missing fields, or empty strings) are verified. Use synthetic objects for schema validation tests.

### Test Fixtures
If complex fixtures are needed (e.g., for `summaryAnalysisSchema`), place them inside `src/lib/__fixtures__/` as TypeScript exports. This ensures compatibility with the `tsx` loader and avoids the need for special JSON/raw loaders that might break Node's native runner.

Example:
```typescript
// src/lib/__fixtures__/my-fixture.ts
export const myFixture = {
  // synthetic test data
};
```

## Manual Validation

After unit tests pass, always perform manual validation for UI-related changes:
- Verify that navigation tabs change correctly between Mobile and Desktop views.
- Ensure that the Cache / Runtime stats tab updates correctly without writing to Drive.
- Check that resetting cache metrics works correctly and updates the UI.
- Verify that AI Summary test functionality handles fixtures and manual inputs correctly.
