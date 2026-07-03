# Drive Access Token Lifecycle

## Current Milestone

The current implementation focuses on hardening the short-lived Google Drive access token lifecycle. We strictly use **sessionStorage** and in-memory React state to manage the token.

### Key Policies:
- **No `localStorage`**: The `drive_access_token` is no longer persisted across sessions via `localStorage` to avoid using stale or vulnerable long-lived tokens.
- **Session-bound**: Tokens are stored in `sessionStorage` with explicit `acquiredAt` and `expiresAt` metadata.
- **Conservative Expiry**: By default, we assume tokens expire 50 minutes after acquisition (leaving a 10-minute buffer for Google's standard 60-minute expiry).
- **Transport via Headers**: Tokens are sent via the `Authorization: Bearer <token>` header (and temporarily `x-google-drive-token` for compatibility). URL query parameters for tokens have been removed and **must not be used** as a fallback. Body token transport is deprecated and flagged with a `TODO(deprecated)` comment.
- **Re-authentication UX**: If a token expires (or a 401/403 is encountered), the app clears the token state but preserves Firebase authentication. A dedicated "Drive Access Required" re-authentication screen is shown instead of forcing a full application logout.

## Future Milestones
- **No Refresh Token Support Yet**: The current milestone does **not** implement refresh-token persistence. 
- **Server-side OAuth Token Store**: In a future milestone, we plan to implement a secure, server-side OAuth token store (e.g., in Firestore) that can securely store refresh tokens and automatically mint new access tokens without requiring manual user re-authentication.
