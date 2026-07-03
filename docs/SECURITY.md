# Security Guidelines

## Hard Constraints
- **Drive Safety**: Never delete Google Drive files or run full-drive indexing.
- **Data Safety**: Do not loosen Firestore security rules (`indexmd-db`).
- **Auth Safety**: Never store refresh tokens. Do not store Drive access tokens in localStorage. Do not log tokens or API URLs.
- **File Safety**: Never commit `cache/` or use private documents as test fixtures.
