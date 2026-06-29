# SEO & Progressive Web App (PWA)

Details regarding the search engine optimization and offline capabilities of the app.

## Progressive Web App (PWA)
- **Manifest**: Located in `public/manifest.json`. Defines the app's installable shell.
- **Service Worker (`public/sw.js`)**:
  - Caches static assets (HTML, JS, CSS, icons) using stale-while-revalidate for fast loading and offline shell access.
  - **CRITICAL CONSTRAINT**: The Service Worker MUST NOT cache API responses, OAuth tokens, Drive file content, or data from Google APIs (`*googleapis.com*`, `*firestore*`).
  - Network-first strategy is used for navigation requests to ensure fresh content.
- **Offline Behavior**: The app shell should load offline. Network-dependent operations (API, Drive) should fail gracefully with clear UI feedback.

## Search Engine Optimization (SEO)
- **Robots.txt**: Located in `public/robots.txt`. Allows indexing of the public landing page while explicitly disallowing private routes (e.g., `/dashboard`, `/debugger`).
- **Sitemap**: Located in `public/sitemap.xml`. Only includes public-facing URLs.
- **Metadata**: Title and meta descriptions in `index.html` must accurately reflect the tool's purpose. Open Graph and Twitter Card images should be kept up to date for social sharing.
