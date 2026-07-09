# Internal Runtime Schemas Directory (`/schemas`)

> ⚠️ **Important Notice**: This directory `/schemas` acts as a **runtime mirror** for internal validation engines and legacy backwards-compatibility. It **must not** be used by external applications or downstream services as an integration endpoint.

---

## 🗺️ Architectural Separation

The canonical, versioned data exchange contract specifications are located inside:
- **Canonical Boundary**: `contracts/`

While the schemas in this `/schemas/` directory are currently preserved to prevent breaking runtime imports and Firestore validation logic within the server and client codebase, they will eventually be migrated directly to read from `/contracts/`.

### Guidelines
1. **Source of Truth**: All schema edits, new version definitions, and documentation updates **MUST** occur in `contracts/`.
2. **Runtime Mirroring**: Any schema changes propagated under `contracts/` may be manually mirrored here to keep existing runtime validators green.
3. **Do Not Delete**: Do not delete this `/schemas` directory or its JSON files in the current stride, as internal runtime imports still reference these flat paths.
4. **Future Work**: Future refactoring will migrate all internal code validators to point directly to versioned structures under `/contracts/`.
