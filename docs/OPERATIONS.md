# Operations Guide

## CI/CD and Branching
- `main` is the AI Studio source-of-truth branch.
- `jules/integration` is used by Jules for audits and docs. The sync workflow automatically merges `main` into `jules/integration`.
- For other changes, create a feature branch and submit a PR to `main`.

## Deployment (Cloud Run)
- Cloud Run requires the app to listen on `0.0.0.0`.
- The port is dynamically injected via `process.env.PORT`.
- Environment variables (like `GEMINI_API_KEY`) must be configured securely in Cloud Run or Secret Manager.
