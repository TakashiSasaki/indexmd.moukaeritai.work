# System Architecture - indexmd

## 1. High-Level Overview
`indexmd` is a full-stack document categorization and indexing tool for Google Drive. It operates on a "Cascade Summary" principle, where deep-level directory summaries are bubbled up to parent directories to create a meaningful hierarchical index.

## 2. Component Stack

### Frontend (SPA)
- **Framework**: React 18 + Vite.
- **State Management**: React Hooks + Firestore for global sync state.
- **Communication**: REST API calls to the local Express server for heavy lifting (Gemini, Drive manipulation).

### Backend (Express)
- **Role**: Secure proxy for Gemini API and Google Drive API.
- **Environment**: Node.js environment with native TypeScript support via `tsx`.
- **Gemini Engine**: Custom retry wrapper with exponential backoff and model fallback chains to ensure 99.9% generation success even during quota constraints.

## 3. Data Flow
1. **Discovery**: Client scans Google Drive using the access token.
2. **Metadata Sync**: Metadata (structure, depth, path) is mirrored to Firestore only when changes are detected.
3. **Queueing**: The system traverses directories from bottom-to-top.
4. **Acquisition**: Server reads file snippets and existing `index.md` content from a specific folder.
5. **Synthesis**: Gemini generates a summary of the folder based on file names and child folder summaries.
6. **Commit**: Server updates the `index.md` file using a non-destructive merge strategy.

## 4. Resiliency & Reliability
- **Model Fallbacks**: If `gemini-3.5-pro` fails (Quota/Not Found), it automatically attempts `gemini-3.1-pro-preview`.
- **Muted Errors**: The system suppresses benign environment-related errors (WebSocket, benign 401s, etc.) in the console to maintain a clean production environment.
- **Atomic Batches**: Firestore updates happen in logical batches of 450 items to stay within transaction limits and optimize billing.
