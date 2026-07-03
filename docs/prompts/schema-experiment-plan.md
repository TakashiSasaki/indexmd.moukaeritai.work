# Schema 1.1.0-draft.1 Experiment Plan

This document outlines the manual testing procedure to validate the `1.1.0-draft.1` structured summary schema using the AI Summary Test tab.

## Objective
Validate that the `1.1.0-draft.1` schema effectively extracts granular information from various document types without hallucination, and observe how different models (e.g., gemini-3.5-flash, gemini-3.1-pro-preview) handle the complex enum constraints and nested objects.

## Target Document Types for Testing
1. **Business Meeting Notes**: To test `parties` (author, attendees), `temporalReferences` (eventDate), `documentTypes` (meetingNotes), and `topics`.
2. **Invoice/Receipt**: To test `monetaryAmounts` (total, tax), `parties` (payer, payee, seller), and `temporalReferences` (issued, due).
3. **Academic Paper / Technical Spec**: To test `subjectAreas` (e.g., computerScience: softwareEngineering), `documentTypes` (academicPaper, specification), `namedEntities` (artifacts, initiatives).
4. **Source Code Snippet**: To test `documentTypes` (sourceCode), `primaryLanguage` (programming language vs natural language handling), and `keywords`.
5. **Casual Note / Bookmark**: To test fallback behavior and empty states (e.g., empty `subjectAreas`, `monetaryAmounts`, `temporalReferences`).

## Procedure
1. Navigate to the **AI Summary Test** tab in the local application.
2. Ensure **Structured JSON (New Schema)** is selected.
3. Use the **Manual Text Input** or **File Input** to provide samples from the target categories.
4. For each test, record:
   - **Model Used**: (e.g., gemini-3.5-flash)
   - **Parse Success**: Did the JSON parse and validate against the schema successfully?
   - **Hallucination Check**: Were any extracted `namedEntities`, `temporalReferences`, or `monetaryAmounts` NOT present in the source text?
   - **Enum Adherence**: Did the model use valid enums for `documentTypes`, `documentIntent`, `subjectAreas`, etc., without validation failure?
   - **Omission**: Did the model successfully omit keys for empty `subjectAreas`?

## Observations (To be filled during testing)
- *Draft 1 validation showed...*
