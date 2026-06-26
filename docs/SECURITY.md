# Security & Data Safety Guidelines

This document centralizes the critical security rules that all AI coding agents must obey.

## 1. Google Drive Protection
- **No Deletions**: Never write logic that deletes files or folders in Google Drive.
- **No Destructive Overwrites**: Generated `index.md` files are merged using a hybrid-merge strategy. The manual "User Notes" section must NEVER be overwritten.
- **No Unbounded Crawling**: Full Drive-wide indexing is prohibited. Scans are initiated per-folder by the user.

## 2. Token & Authentication Safety
- **No Refresh Tokens**: Do not request or store Google Drive refresh tokens.
- **Storage**: Drive Access Tokens must be kept in `sessionStorage` or memory. Never use `localStorage` for tokens.
- **Logging**: Never log OAuth tokens, API URLs containing tokens, or raw Drive metadata to the console or files.

## 3. Database Security
- **Firestore DB**: The database ID must remain explicitly set to `indexmd-db` (do not revert to `(default)`).
- **Rules**: Do not modify Firestore Security Rules (`firestore.rules`) to bypass validation.

## 4. Privacy & Caching
- **Ephemeral Cache**: The `cache/` directory contains sensitive file snippets and summaries. It must NOT be committed to git (`.gitignore` enforces this).
- **Service Worker**: The frontend Service Worker must NOT cache API responses, Firestore queries, or Google Drive metadata/files.
- **Fixtures**: Do NOT use real user documents as test fixtures. Use synthetic data or licensed public domain assets.
