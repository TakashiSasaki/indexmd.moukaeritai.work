# Security & Safety Constraints

This document details the absolute safety rules for the `indexmd` repository. **No coding agent may write code that violates these rules without explicit user consent.**

## 1. Google Drive API Operations (Strictly Additive)
- **Never Delete**: The system MUST NOT delete any Google Drive files, folders, or generated `index.md` files.
- **Never Overwrite User Notes**: `index.md` updates use a Hybrid-Merge strategy. Everything outside the `<!-- AUTO_GENERATED_START -->` markers must be preserved perfectly.
- **No Full Drive Indexing**: Do NOT run automatic recursive indexing from the Drive root (`root`). Indexing must be user-initiated on specific sub-folders.

## 2. Token & Auth Management
- **Access Tokens**: Drive Access Tokens must be stored in memory or `sessionStorage` ONLY. Never `localStorage`.
- **Refresh Tokens**: The application MUST NOT store or request persistent Refresh Tokens.
- **Logging**: Never `console.log` or persist OAuth tokens, Auth Codes, raw Drive metadata, or raw File Content/Images.

## 3. Firestore Rules
- **Database ID**: The system strictly uses the `indexmd-db` database. Do not attempt to use `(default)`.
- **Security Rules**: Do NOT loosen Firestore security rules to simplify testing. Use proper Auth mocks instead.

## 4. File system and Cache safety
- **Artifacts**: Do NOT commit contents of the `cache/` directory.
- **Fixtures**: Do NOT use real user Drive documents as mock fixtures for tests. Only use synthetic data or explicitly licensed public domain/CC0 images.
