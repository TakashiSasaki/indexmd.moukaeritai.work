# SEO and PWA Configuration

This document outlines the current state and policies for Search Engine Optimization (SEO) and Progressive Web App (PWA) features for `indexmd`.

## SEO Policy
- **Metadata:** `index.html` contains canonical URLs, Open Graph (OG) tags, and Twitter Card metadata pointing to `https://indexmd.moukaeritai.work/`.
- **`robots.txt`:** Allows crawling of the public landing page but strictly disallows internal app routes (`/dashboard`, `/debugger`, etc.) to prevent indexing of authenticated views.
- **`sitemap.xml`:** Exists at `public/sitemap.xml` and currently only indexes the root path (`/`). Do not add internal app routes to the sitemap.
- **Agent Note:** When adding new public landing pages, update the sitemap and metadata. Ensure SPA rendering does not break bot crawlers (consider static rendering if necessary in the future).

## PWA (Progressive Web App) Policy
- **Manifest:** `public/manifest.json` defines the application name, colors, and icons for installation.
- **Service Worker (`sw.js`):**
  - **Caching Strategy:** Uses a network-first strategy for navigation and stale-while-revalidate for static assets (HTML, JS, CSS, icons).
  - **Security Constraint:** The Service Worker is explicitly programmed to **IGNORE** all requests to `/api/`, `googleapis.com`, and `firestore`. **Never** update `sw.js` to cache API responses, user Drive data, or authentication tokens.
- **Offline Capabilities:** Currently provides basic offline caching for the app shell. Full offline functionality for the Drive Indexer is not implemented as it requires live API access.
