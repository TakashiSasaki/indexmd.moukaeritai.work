# Security & Data Safety

This document outlines the strict security invariants required for the `indexmd` project. **Agents must never relax these constraints.**

## 1. Google Drive API Safety
- **Read/Write Scope**: The app requests advanced Drive scopes, but operations are strictly limited by logic.
- **NO DELETION**: The application MUST NOT delete any Google Drive files or folders.
- **INDEX.MD ONLY**: The application may only create or modify `index.md` files. Modifying other user files is strictly prohibited.
- **NO FULL DRIVE SCANNING**: Never run unconditional full Drive-wide indexing against a real user account. Use targeted folder traversal.

## 2. Authentication & Token Security
- **OAuth Tokens**: Google Drive access tokens must be stored in `sessionStorage` on the frontend, never `localStorage`.
- **Refresh Tokens**: Do NOT request, handle, or store OAuth refresh tokens.
- **Logging**: Never log OAuth tokens, Firebase tokens, authorization codes, API keys, or raw API URLs.
- **Secrets in Source**: Never commit `.env` files, API keys, or private JSON credential files to the repository.

## 3. Data Privacy & Logging
- **User Content**: Do not log, persist, or cache raw user document contents, image bytes, model outputs, or prompts containing user data.
- **Fixtures**: Do not use private real user documents or uncurated arbitrary public URLs as committed test fixtures. Use synthetic data (e.g., `sample-receipt-synthetic`) or explicitly licensed public domain images.
- **Cache Commits**: Do not commit the `cache/` directory or `validation_history.json` containing live user data.

## 4. Firestore Security Rules
- **Rule Strictness**: Do not loosen `firestore.rules`.
- **Database ID**: The database ID must remain `indexmd-db`. Do not revert to `(default)`.
- **User Isolation**: Ensure users can only read/write paths under `users/{userId}/...`.

## 5. Automated Agent Constraints
- Agents performing automated tests or previews must not execute destructive or broad read operations against live Google Drive or Firestore endpoints. Ensure tests are fully mocked.
