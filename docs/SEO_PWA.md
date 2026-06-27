# SEO and Progressive Web App (PWA) Guidelines

This document outlines the current state and guidelines for maintaining the SEO and PWA features of `indexmd`.

## SEO (Search Engine Optimization)

The application is a Single Page Application (SPA) using React. To ensure proper indexing by search engines:

1. **Meta Tags**: The `index.html` includes essential SEO tags:
   - `title` and `meta name="description"` describing the application's value proposition.
   - `canonical` link pointing to `https://indexmd.moukaeritai.work/`.
   - Open Graph (`og:*`) and Twitter Card (`twitter:*`) meta tags for social media sharing.
2. **Robots and Sitemap**:
   - `public/robots.txt` allows indexing of the root (`/`) but explicitly disallows internal app routes (e.g., `/dashboard`, `/debugger`) to prevent sensitive or non-functional pages from appearing in search results.
   - `public/sitemap.xml` lists only the public-facing root URL.
3. **Future Considerations**:
   - As an SPA, the initial HTML is thin. If SEO performance is critical, consider implementing Server-Side Rendering (SSR) or pre-rendering for the landing page.
   - Ensure the landing page content is readable even if JavaScript fails to load.

## PWA (Progressive Web App)

The application is configured to be installable and provides basic offline capabilities.

1. **Manifest**: `public/manifest.json` defines the app's identity, colors, and icons for installation on devices.
2. **Service Worker (`public/sw.js`)**:
   - **Caching Strategy**: Implements a `Stale-while-revalidate` strategy for static assets (HTML, JS, CSS, icons) and a `Network-first` strategy for navigation requests.
   - **Exclusions (Critical)**: The Service Worker is explicitly programmed to **NEVER** cache:
     - API endpoints (`/api/*`).
     - Google APIs (`googleapis.com`).
     - Firestore network requests.
   - This ensures sensitive user data, OAuth tokens, and Drive contents are never stored in the Service Worker cache.
3. **Offline Behavior**:
   - The app shell can load offline.
   - However, core features (Drive API, Firestore, Gemini API) require an active internet connection. Ensure the UI degrades gracefully and informs the user when they are offline.
4. **Maintenance**:
   - When adding new static assets, consider if they need to be added to the `ASSETS_TO_CACHE` list in `sw.js`.
   - Ensure the `CACHE_NAME` is updated when breaking changes occur to force clients to download the latest assets.
