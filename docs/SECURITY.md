# Security and Data Safety

This document defines the strict safety constraints for `indexmd`. All developers and AI agents must adhere to these rules without exception.

## 1. Google Drive API Safety
- **No Deletions**: Do not implement any logic that deletes files, folders, or generated `index.md` files from a user's Google Drive.
- **Scope Limitation**: Read/Write operations are strictly limited to generating and updating `index.md` files and reading metadata/images for summarization.
- **No Full Scans**: Do not execute full Drive-wide indexing (e.g., scanning the entire Drive synchronously). Operations must be scoped to specific directories and respect `last_traversed_at` to minimize API calls.
- **No Real User Testing**: Never use real private user documents or URLs as test fixtures. Use synthetic data or explicitly licensed public domain images.

## 2. Authentication and Token Safety
- **No Refresh Tokens**: Do NOT request, store, or log Google OAuth refresh tokens.
- **Storage Location**: Drive access tokens must be stored in `sessionStorage` on the frontend. They must **never** be stored in `localStorage` or persisted to disk.
- **No Token Logging**: Never log OAuth tokens, Drive access tokens, authorization codes, or raw API URLs containing sensitive parameters.
- **Server Proxy**: Drive API calls that require tokens must be proxied through the backend (`server.ts`) so that raw data and URLs are not exposed unnecessarily.

## 3. Database Safety (Firestore)
- **Target Database**: All operations must target the `indexmd-db` database. Do not use `(default)`.
- **Security Rules**: Firestore security rules (`firestore.rules`) protect user data by ensuring users can only read/write their own paths. **Never** loosen these rules or bypass them in code.
- **Write Optimization**: Unconditional write operations (`set`) are forbidden. Always verify if the data has changed before executing a write to prevent unnecessary billing costs.

## 4. File and Cache Safety
- **No Sensitive Commits**: Do NOT commit the `cache/` directory, validation history containing real user data, `.env` files, or any private fixtures to version control.
- **Cloud Run Ephemerality**: In Cloud Run, the local filesystem is ephemeral. Do not assume local files will persist or be shared across instances. Do not log secrets to local files.
- **Service Worker Limits**: The frontend Service Worker must **never** cache API responses, OAuth tokens, Drive file contents, or user-specific metadata.

## 5. Automated Agent Constraints
- Agents (Jules, Codex, Copilot) must never modify this file to weaken these constraints.
- Automated conflict resolution must preserve these safety rules.
