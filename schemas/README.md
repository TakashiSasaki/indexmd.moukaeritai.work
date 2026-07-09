# Internal Runtime Schemas Directory (`/schemas`)

> ⚠️ **Important Notice**: This directory `/schemas` acts as a **runtime mirror** for internal validation engines and legacy backwards-compatibility. It **must not** be used by external applications or downstream services as an integration endpoint.

---

## 🗺️ Architectural Separation

The canonical, versioned data exchange contract specifications are located inside:
- **Canonical Boundary**: `contracts/`

While the schemas in this `/schemas/` directory are currently preserved to prevent breaking runtime imports and Firestore validation logic within the server and client codebase, they will eventually be migrated directly to read from `/contracts/`.

### Guidelines
1. **Source of Truth**: All schema edits, new version definitions, and documentation updates **MUST** occur inside `contracts/`. The `contracts/` directory is the canonical source-of-truth.
2. **Runtime Mirroring & Drift Verification**:
   - The old script `scripts/copyContracts.ts` (which previously copied from `/schemas` to `/contracts`) has been **permanently deleted** to eliminate the risk of accidentally overwriting canonical contracts with older runtime mirrors.
   - Alignment between `contracts/` and their respective mirrors in `/schemas` is verified continuously by running:
     ```bash
     npm run verify:contract-mirrors
     ```
   - This prevents silent structural drift between live runtime validation logic and external contracts.
3. **Do Not Delete**: Do not delete this `/schemas` directory or its JSON files in the current stride, as internal runtime imports and application validation paths still reference these files.
4. **Future Work**: Future refactoring will migrate all internal codebase imports and validators to point directly to versioned structures under `/contracts/`.
