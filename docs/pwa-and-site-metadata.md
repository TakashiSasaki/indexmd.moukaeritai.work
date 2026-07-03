# PWA and Site Metadata

## SEO & Open Graph
- Canonical URL is maintained strictly as `https://indexmd.moukaeritai.work/`.
- OG and Twitter Card metadata are included in `index.html` to provide high-quality link previews.
- The `og-image.png` is generated from `icon.svg` using Sharp during development/build time if necessary.

## Sitemap & Robots
- `sitemap.xml` contains ONLY the `/` root canonical endpoint. No authenticated or internal routes (like `/dashboard`) are exposed.
- `robots.txt` explicitly disallows `/dashboard`, `/debugger`, and other protected utility endpoints while allowing `/`.

## Progressive Web App (PWA)
- The app utilizes a `manifest.json` configured as a standalone display PWA.
- The manifest includes an explicit `id: "/"` and `scope: "/"`.
- Both maskable and standard PNG icons (192x192, 512x512) are mapped in `manifest.json` for rich installation.

## Service Worker Caching Strategy
- The Service Worker (`public/sw.js`) provides app-shell caching (HTML, JS, CSS, Icons).
- **Strict Exclusions**:
  - `*googleapis.com*` (Google APIs)
  - `*firestore*` (Firebase)
  - `/api/*` (Internal server APIs)
- The Service Worker employs a Network-First strategy with an offline fallback for navigation requests. Stale-while-revalidate is used for static assets.
- Registration occurs securely in `src/main.tsx` only during production (`import.meta.env.PROD`).
