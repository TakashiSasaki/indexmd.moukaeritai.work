# index.md Hybrid-Merge Specification

This document defines the behavior of the Hybrid-Merge engine used for updating `index.md` files while preserving human-authored content.

## Core Logic

The engine uses specific HTML comments as "fences" to identify the AI-generated block.

### Markers
- `<!-- AUTO_GENERATED_START -->`: The beginning of the AI block.
- `<!-- AUTO_GENERATED_END -->`: The end of the AI block.

### Rules
1. **Preservation**: All content outside these markers is considered "User Notes" and MUST NOT be modified or deleted.
2. **Replacement**: If both markers exist, the content between them is replaced by the new AI generation.
3. **Appending**: If markers are missing and `allowAppendIfMissing` is true, the AI block is appended to the end of the file.
4. **Safety**: If markers are malformed (e.g., end before start), the operation is blocked to prevent data loss.

## Drive-connected Preflight

Before any write operation, a read-only preflight is performed:
1. **Lookup**: Search only the direct children of the target folder for a file named exactly `index.md`.
2. **Read**: Fetch the text content of the identified candidate.
3. **Dry-run**: Run the Hybrid-Merge logic in memory and report results (readiness, changes, diagnostics).
4. **Validation**: Confirm that user content is preserved and the resulting markdown is valid.

## UI Implementation
The "Saved Summaries Browser" contains a "Drive-connected read-only preflight" workbench that allows developers to verify these rules against real Drive files without writing any data.
