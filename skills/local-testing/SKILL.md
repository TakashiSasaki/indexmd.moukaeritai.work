---
name: local-testing
description: Guidelines for testing internal API endpoints and Gemini SDK features locally using standalone scripts.
---

# Local Testing Skill

This skill provides guidelines for testing backend API endpoints and Gemini SDK behaviors without relying on the full UI or browser environment.

## Context
During development, you often need to verify if an API endpoint (e.g., in `server.ts`) is returning the correct JSON, or if a specific Gemini SDK feature (e.g., `mediaResolution`, `webp` support) behaves as expected. Instead of guessing or debugging through the React frontend, it is much faster and more reliable to create and run standalone TypeScript scripts.

## Guidelines

1. **Standalone Test Scripts**: 
   - Create a temporary script (e.g., `test-api.ts` or `test-feature.ts`) in the project root.
   - Use `node-fetch` for hitting local endpoints (`http://localhost:3000/api/...`).
   - Use `@google/genai` to test model capabilities directly.

2. **Execution**:
   - Run the script using `npx tsx <script-name>.ts`.
   - Ensure the server is running (if testing endpoints).

3. **API Testing Boilerplate**:
   ```typescript
   import fetch from 'node-fetch';
   
   async function run() {
     const url = 'http://localhost:3000/api/your-endpoint';
     const res = await fetch(url, {
       method: 'POST', // or GET
       headers: {
         'Content-Type': 'application/json',
         'Authorization': 'Bearer test' // if required
       },
       body: JSON.stringify({ /* payload */ })
     });
     
     console.log("Status:", res.status);
     const text = await res.text();
     try {
       const data = JSON.parse(text);
       console.log(JSON.stringify(data, null, 2));
     } catch (e) {
       console.error("Parse Error. Raw response was:");
       console.error(text);
     }
   }
   run();
   ```

4. **Cleanup**:
   - Always delete the test scripts (`test-*.ts`) using the file deletion tool after you have finished debugging, to keep the workspace clean.
