# SEO & PWA Strategy

## PWA Strategy
- `manifest.json` defines a standalone PWA.
- Service Worker (`sw.js`) caches static app shell elements.
- Never cache API endpoints, Firestore traffic, or Google API responses.

## SEO Strategy
- Use canonical URLs (`https://indexmd.moukaeritai.work/`).
- `robots.txt` blocks `/dashboard` and debug routes.
- `sitemap.xml` exposes the public landing page only.
