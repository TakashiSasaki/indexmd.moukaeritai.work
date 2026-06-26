# SEO & Progressive Web App (PWA) Guidelines

This document details the configuration for SEO and PWA capabilities.

## 1. SEO Configuration
- **Canonical URL**: Maintained strictly as `https://indexmd.moukaeritai.work/`.
- **Meta Tags**: Open Graph (OG) and Twitter Card metadata are defined in `index.html`. They rely on `og-image.png`.
- **Crawling Rules**:
  - `robots.txt` explicitly allows the root landing page `/` while disallowing internal routes like `/dashboard` or `/debugger`.
  - `sitemap.xml` contains ONLY the `/` root URL to prevent indexing of authenticated states.
- **Future Enhancements**: Consider adding `SoftwareApplication` or `WebApplication` structured JSON-LD data to `index.html`.

## 2. PWA (Progressive Web App) Strategy
- **Manifest**: Located at `public/manifest.json`. Defines the app as a `standalone` experience with theme color `#4F46E5`. It provides maskable and standard icons (192x192, 512x512).
- **Service Worker (`public/sw.js`)**:
  - Caches only the App Shell (`/`, `index.html`, `manifest.json`, and icons).
  - Uses a **Network-First** strategy for navigation, falling back to the cached `index.html` when offline.
  - Excludes ALL external APIs (`googleapis.com`), Firebase (`firestore`), and local backend APIs (`/api/*`) from being cached to prevent accidental offline data leakage or stale tokens.
  - Registration occurs via Vite production build logic (`src/main.tsx`).
