# Testing Guide

## Where Unit Tests Live
Unit tests live alongside the files they test in the `src/` directory, named as `*.test.ts`.

## No-Network Test Policy
Tests in this project are strictly isolated. No real network calls are permitted. Ensure tests use isolated helper test structures, mocked responses, or purely logic-based tests.

## Running Unit Tests
Execute the pure unit tests via:
`npm run test:unit`

## Why Drive/Firebase/Gemini are Mocked or Avoided
To keep the unit tests fast, deterministic, and safe (prevent accidental mutations to real Google Drive or Firestore data), we do not run integration tests against the live instances of Drive, Firebase, or Gemini during unit testing.

## How to Test Schema Changes
When you add or update properties in schema validators (e.g., in `src/lib/summaryAnalysisSchema.ts`), add explicit test cases passing and failing those new constraints in `src/lib/summaryAnalysisSchema.test.ts`. Always verify normalization functions and missing required fields edge cases.
