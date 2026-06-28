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
- `artworkPhoto` (for paintings, pottery illustrations, or decorative art)
- `artifactPhoto` (for museum exhibits, archaeological pottery, or historical objects)

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
The UI provides an Expected vs Detected comparison. Expected metadata is qualitative and manually curated to serve as a baseline, not a strict ground truth, but **it must reflect the actual source image**. The expected labels and categories represent a realistic regression expectation, not an ideal or fictional scenario. The primary goal is ensuring the common visual schema structure remains robust across radically different image types.

### Regression Review vs Formal Benchmark
The public sample matrix acts as a regression review utility to safeguard against core logic regressions, rather than a formal, strict competitive machine-learning benchmark. The evaluations and parameters are calibrated to facilitate human-in-the-loop review.

---

## Batch Regression Artifacts (JSON Output Types)

During batch evaluation, four different JSON artifacts are generated to help optimize model review, diagnostic depth, and sharing limits:

1. **ChatGPT Summary**:
   - **Purpose**: Extremely lightweight summary optimized for quick sharing with ChatGPT or other models.
   - **Included Content**: `sampleId`, `title`, `success`, `qualityStatus`, `reviewStatus`, expected and detected `imageKind`, calculated coverage metrics, and lists of missing categories, labels, and visible text.
   - **Excluded Content**: Raw API response bodies (`responseRaw`), detailed visual element attributes, raw model parser diagnostics, and response body previews.
   - **Recommended Flow**: This is the default artifact copied to paste into model chats.

2. **ChatGPT Diagnostic**:
   - **Purpose**: High-fidelity diagnostics used when a test is failing or needs manual review, but reasons aren't obvious from the summary alone.
   - **Included Content**: Curated expected metadata, detailed `comparisonSummary`, detected elements, extracted text keywords, input and parser diagnostics.
   - **Excluded Content**: Successful items have their massive raw body previews omitted to keep the token size reasonable.

3. **Failures Only JSON**:
   - **Purpose**: Instantly isolate only the samples that encountered critical failures (e.g., API failures, JSON parse errors, structural invalidations).
   - **Value**: If all tests pass, this artifact is virtually empty. When failure emerges, this snippet can be pasted into ChatGPT to immediately pinpoint structural or provider-side issues.

4. **Full Batch JSON**:
   - **Purpose**: Comprehensive historical archive containing all execution runs, raw API outputs, and complete comparisons.
   - **Action**: Due to its immense size, this should be downloaded (via the recommended "Download" action) rather than copied, preventing truncation or clipboard crashes.

### Copy Integrity Verification (endSentinel)
All generated JSON artifacts are appended with an `artifactIntegrity.endSentinel` field (e.g., `"END_OF_VISUAL_ANALYSIS_BATCH_SUMMARY"`). When copy-pasting into chat interfaces, users can quickly check the very bottom of their prompt: if the sentinel is visible, the snippet was pasted completely. If missing, the text was truncated due to interface limits.

---

## Calibrated Review & Coverage Schema

To reduce false-positive review alerts (where minor surrounding or background elements would mark the entire run as failing or needing review), the evaluation engine separates expected metadata into **Required** and **Optional** sections and uses a **strict coverage-based reviewStatus calibrator**.

### Required vs Optional Expected Metadata
1. **Required Expected Metadata**:
   - Includes essential, core elements of the image (e.g., the primary subject, main category, and must-match text).
   - Only required expectations affect `coverage` ratios, metric evaluations, and the core `reviewStatus`.
   - If any required elements are missing, the `reviewStatus` will be marked as `"needsReview"` or `"fail"`.
2. **Optional Expected Metadata**:
   - Includes secondary elements, minor surrounding details, or background objects (e.g., sky elements in a plant photo, or decorative vase surfaces).
   - These are evaluated for diagnostics but **do not block** `reviewStatus`.
   - Matched optional elements are highlighted in `reviewNotes` as positive signals.
   - Missing optional elements do not affect the main `coverage` ratios.

### Coverage Metric Schema
Every comparison generates a detailed, multi-dimensional `coverage` structure based on required expectations:
```json
"coverage": {
  "categories": { "expectedTotal": 1, "covered": 1, "missing": 0, "ratio": 1.0 },
  "labels": { "expectedTotal": 5, "covered": 4, "missing": 1, "ratio": 0.8 },
  "visibleText": { "expectedTotal": 0, "covered": 0, "missing": 0, "ratio": 1.0 },
  "overall": { "expectedTotal": 6, "covered": 5, "missing": 1, "ratio": 0.83 }
}
```
*Note*: `covered` includes both exact matches and acceptable/alias matches of required expectations.

### Human-in-the-Loop Review Statuses
- **reviewStatus**: The high-level actionability indicator for developers.
  - `"fail"`: Generated immediately if required **visibleText** is missing (`visibleText.ratio < 1.0`).
  - `"needsReview"`: Generated if image classification diverges (`imageKind` status is `"diverged"`), required category coverage is low (`categories.ratio < 0.8`), or required label coverage is critically low (`labels.ratio < 0.6`).
  - `"pass"`: Generated if image classification matches (exact/acceptable) AND:
    - **Rule A**: Required category coverage is perfect (`1.0`) and required label coverage is high (`>= 0.75`).
    - **Rule B**: Required category coverage is acceptable (`>= 0.8`) and required label coverage is acceptable (`>= 0.6`).
- **reviewReasons**: Non-empty ONLY when `reviewStatus` is `"needsReview"` or `"fail"`. It states the exact required expectation violations.
- **reviewNotes**: Supplementary warnings, optional matched signals, and helpful notes compiled for developers to inspect minor drift without being spammed with failure flags.

---

### Known Coverage Gaps
- **Mixed Content**: The `sample-mixed-1` originally expected to test mixed content but represents antique furniture.
  - **Status**: We have successfully introduced a new local synthetic mixed sample (`sample-mixed-scene-synthetic`) representing a modern desk setup with a journal, coffee cup, phone, and sticky note. This restores full test coverage for the `mixed` image kind and mixed-scene taxonomies.
