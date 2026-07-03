# SEO & PWA Constraints

This document details the configuration for Search Engine Optimization (SEO) and Progressive Web App (PWA) functionality.

## 1. SEO Configuration
- **`robots.txt`**:
  - Must explicitly `Allow: /` for the public landing page.
  - Must explicitly `Disallow` all internal, authenticated, or debugging routes (e.g., `/dashboard`, `/debugger`, `/logs`).
- **`sitemap.xml`**:
  - Should only index the public landing page and public marketing resources.
  - Do not include dynamic routes or user-specific paths.
- **Metadata**:
  - Ensure `index.html` contains appropriate Open Graph tags, canonical URLs matching the production domain (`indexmd.moukaeritai.work`), and accurate descriptions.

## 2. Progressive Web App (PWA) / Service Worker
- **Scope**: The Service Worker (`sw.js`) is intended solely for offline availability of the application shell (HTML, CSS, JS, static icons).
- **Caching Policy (CRITICAL)**:
  - The Service Worker MUST NOT cache API responses (`/api/*`).
  - The Service Worker MUST NOT cache Google Drive API responses (`*googleapis.com*`).
  - The Service Worker MUST NOT cache Firestore responses (`*firestore*`).
  - The Service Worker MUST NOT cache OAuth tokens or user-specific data.
- **Updates**: Use stale-while-revalidate for static assets, but ensure the cache name/version is updated correctly to prevent clients from being stuck on old bundles.

## 3. Cloud Run Compatibility
- Ensure static assets (manifest, icons, sw.js) are correctly served by the backend Express server when deployed to Cloud Run, as Vite's dev server will not be running.
