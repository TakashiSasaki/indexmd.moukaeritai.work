# Schema Documentation

## Current Status
Current Version: `v1.1.0-draft.1` (Experimental/Draft)

## Field Details & Distinctions
- **topics vs keywords vs subjectAreas**:
  - `topics`: High-level conceptual themes.
  - `keywords`: Specific search terms or important words.
  - `subjectAreas`: Strict domain classification for academic or specific fields mapped to detailed sub-domain enums.
- **namedEntities vs parties**:
  - `namedEntities`: Explicit proper nouns (e.g. people, organizations, locations).
  - `parties`: Entities with document-level roles (e.g., author, recipient, issuer) regardless of whether they are a named entity.
- **resourceReferences**: Replaces the old `urls` field to enforce standard URI handling (including DOIs).
- **primaryLanguage vs languages**:
  - `primaryLanguage`: The main language of the document.
  - `languages`: An array of all languages present.
- **Document Type vs MIME Type**: `documentTypes` classifies the *content* intent (e.g., invoice, note, academicPaper), whereas MIME Type classifies the *file format* (e.g., application/pdf).
- **confidence**: This is the model's self-reported confidence score, *not* a factual guarantee of accuracy.
- **warnings**: Used by the model to flag OCR/image ambiguity, uncertain classifications, or illegible parts.

## Metadata Persistence & Tracking (v1.2.0)
- **parentId**: Tracks the direct Google Drive parent folder ID. Used to group file-level summaries and map them into the correct directory for read-only `index.md` generation previews.
- **getSummaryMetadataStatus() Evaluation**:
  - `current`: All versions match; no file drift.
  - `stale-schema`: Schema version mismatch.
  - `stale-prompt`: Prompt or system instruction mismatch.
  - `stale-file`: The file's Drive `modifiedTime` is newer than the saved generation timestamp.
  - `invalid`: The saved document fails structure validation.

## Known Limitations
- AI may hallucinate named entities if not strictly instructed.
- Structured JSON extraction may fail for extremely long documents due to context windows.
