# Security and Data Safety Policies

This document outlines the strict security and data safety boundaries for the `indexmd` project. All agents and developers must adhere to these rules to protect user data and maintain application integrity.

## 1. Google Drive API Usage
- **Read-Only Default:** Outside of explicitly generating or updating the `index.md` file within a directory, the Google Drive API must be treated as read-only.
- **No Deletions:** Never issue DELETE requests to the Drive API for user folders, files, or even the generated `index.md` files.
- **No Full-Drive Scans:** Do not execute unconstrained, Drive-wide searches or indexing operations. Always constrain queries to specific parent folders or use narrow search criteria.

## 2. Authentication & Token Handling
- **Token Storage:** Drive access tokens MUST be stored in `sessionStorage`, never in `localStorage` or permanent storage.
- **No Refresh Tokens:** The application must never request or store offline access (refresh tokens).
- **No Logging:** Never log OAuth tokens, raw Drive access tokens, API authorization headers, or full Google API URLs containing tokens to the console or server logs.

## 3. Data Persistence & Caching
- **User Data in Logs:** Never log raw user document text, generated summaries, or raw model output to generic server logs.
- **Service Worker Cache:** The PWA Service Worker (`sw.js`) MUST NOT cache API responses, Drive file contents, or OAuth tokens. It should only cache the static app shell.
- **No Private Fixtures:** Do not use real user data or private documents as test fixtures. Use synthetic data or explicitly public domain assets for tests.

## 4. Firestore Security
- **Target DB:** The application strictly targets the `indexmd-db` database. Do not revert connections to the `(default)` database.
- **Security Rules:** Do not relax Firestore security rules (`firestore.rules`). Any changes to rules require explicit human review.

## 5. File Protection (Hybrid Merge)
- When updating `index.md`, the backend must strictly preserve any content outside of the `<!-- AUTO_GENERATED_START -->` and `<!-- AUTO_GENERATED_END -->` markers. Never overwrite manual user notes.
