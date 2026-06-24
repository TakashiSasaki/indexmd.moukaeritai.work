<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/141a147a-54eb-4619-a0bf-76fc3c46afc4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Commands
- `npm run dev`: Start dev server.
- `npm run build`: Build production assets.
- `npm start`: Start production server.
- `npm run lint`: Run TypeScript checks.
- `npm run test:unit`: Run Node.js native test runner tests.

## Known Gaps
- Missing tests for complete Drive token lifecycle state (refresh, missing token utility tests).
