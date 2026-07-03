# Folder Scan State Machine

## Concept
The Google Drive folder crawler orchestrates changes via a Hybrid Discovery and Traversal model. It manages progress persistently via Firestore to prevent exhaustive recrawls and minimize Google Drive API quotas.

## Scan Modes
1. **Flat Discovery Scan (`crawlMode: flat`)**:
   - Queries `q = mimeType = 'application/vnd.google-apps.folder'` sorted by `modifiedTime desc`.
   - Used to detect newly created or recently modified folders globally.
   - Folders fetched in this phase are mapped into `pathResolutionMap` immediately, but ONLY committed to `persistedDirsMap` and Firestore if they aren't skipped by existing skip-rules.
   
2. **Progressive Traversal Scan (`crawlMode: progressive`)**:
   - Focuses heavily on a single `activeScanFolder`.
   - Queries the children of the active folder explicitly.
   - Designed to deep-crawl folder hierarchies that haven't been fully mapped by Flat Scan.

## Queueing Strategy
- Traversal prioritizes folders based on `last_traversed_at` in ascending order.
- Null `last_traversed_at` folders (Unscanned) take maximum priority.
- The Root folder (`Drive ID: "root"`) manages its timestamp independently at the global `root_last_traversed_at` state.

## State Mutability
- `persistedDirsMap`: Represents folders actively saved in the database.
- `pathResolutionMap`: Includes temporary fetched records to properly calculate `depth` and `path` variables in-flight before being permanently persisted.
- A progressive traversal safely clears its "Unscanned" status (assigning a `last_traversed_at` timestamp) regardless of whether children were discovered, thereby removing it from the immediate queue loop to prevent endless cycles.

## Metrics & Progress
- **crawlStats.discovered**: This metric strictly counts the number of newly written or explicitly updated child folder records in Firestore. It is *not* a count of how many times an `activeScanFolder` has been traversed.
- If a progress bar is displayed based on limits, it reflects `crawlStats.discovered` (the volume of new/updated metadata) versus the user-defined scan limit.
