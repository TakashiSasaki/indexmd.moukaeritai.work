# Public Visual Sample Matrix

This project uses a curated public visual sample matrix to evaluate the visual schema extraction logic across diverse image categories, while avoiding the privacy, security, and stability risks of user-provided images or real-world private data.

## License Policy
- We include images that are **Public Domain**, **CC0**, **CC BY**, or **CC BY-SA**.
- Images with NonCommercial (NC) or NoDerivatives (ND) clauses are strictly excluded from the default sample set to avoid complex licensing overlaps.
- Attribution text is displayed and clearly required for CC BY and CC BY-SA licenses.

## Categories
The matrix covers the following image kinds representing typical indexing tasks:
- `landscape`
- `person` (subject to strict prompt safety guidelines)
- `animal`
- `plant`
- `interior`
- `furniture`
- `stationery`
- `bookshelf`
- `receipt` (synthetic)
- `ticket` (synthetic)
- `screenshotLike`
- `chartOrTable`
- `documentLike`
- `mixed`

## Architecture & Server-Side Proxy
To ensure safe CORS handling, image bytes are not fetched directly by the browser from external URLs. Instead:
- The UI calls `/api/visual/public-samples/:sampleId/image`.
- A server-side safe fetcher downloads the image strictly from an allowlisted host (e.g., `upload.wikimedia.org`).
- The fetcher performs validation for timeouts, redirect limits, max-size (10MB), and Content-Type matching (`image/*`).
- Image bytes are streamed from memory to the client. They are **never persisted** on disk.

## Synthetic Fixtures
For highly sensitive categories like `receipt` and `ticket`, we use local synthetic SVG assets rather than real internet images. This prevents accidental exposure of personal data, barcodes, order numbers, or tracking serials.

## People Image Safety
When analyzing an image of a person, the model is strictly instructed:
- Do not identify the person.
- Do not infer identity, ethnicity, nationality, health, or emotions.
- Focus purely on visible elements for indexing (e.g., person count, clothing items, pose, and background context).

## Verification & Comparison
The UI provides an Expected vs Detected comparison. Expected metadata is qualitative and manually curated to serve as a baseline, not a strict ground truth. The primary goal is ensuring the common visual schema structure remains robust across radically different image types.
