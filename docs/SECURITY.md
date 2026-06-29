# Security & Privacy Constraints

These rules are strictly enforced to protect user data and maintain service integrity.

## Google Drive API
- **Read-Only**: The app must never delete, create, overwrite, or update any Google Drive files, EXCEPT for managing its own generated `index.md` files.
- **No Full Scans**: Do not run full Drive-wide indexing against real user accounts.
- **Safety Markers**: Only update content within the `<!-- AUTO_GENERATED_START -->` and `<!-- AUTO_GENERATED_END -->` markers in `index.md`. Never touch manual user notes.

## Authentication & Tokens
- **Token Storage**:
  - Store Google Drive access tokens in `sessionStorage` only. NEVER `localStorage`.
  - NEVER store refresh tokens anywhere.
- **Logging**:
  - NEVER log OAuth tokens, Firebase tokens, or Drive access tokens.
  - NEVER log raw API URLs that contain sensitive parameters.
  - NEVER log or persist raw user document text, image bytes, or generated model summaries in plain text logs.

## Firestore
- **Database ID**: Must remain `indexmd-db`. Do not revert to `(default)`.
- **Security Rules**: Do not relax `firestore.rules`.
- **Optimization**: Do not perform unconditional `set` operations; always check if data has changed before writing to prevent unexpected billing spikes.

## Testing & Fixtures
- **Private Data**: Do not use real user documents, real user images, or arbitrary public URLs as committed test fixtures.
- **Mocks**: Tests must be isolated and use mocks for Gemini, Drive, and Firestore.
