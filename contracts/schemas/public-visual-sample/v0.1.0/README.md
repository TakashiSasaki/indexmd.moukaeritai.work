# Public Visual Sample Contracts v0.1.0

Status: **RC** (Release Candidate)

This directory defines the public visual sample contracts used for vision-model evaluation, regression tracking, validation calibration, and batch diagnostics.

## Contracts Overview

1. **`public-sample.schema.json`**: Schema defining the structure of a public evaluation sample setup in our regression test suite.
2. **`expected-metadata.schema.json`**: Schema representing the expected target metadata, which serves as a target model prediction validation target.
3. **`batch-summary.schema.json`**: (Historical/Advanced) Defines the summary output structure of batch evaluation execution, reporting global diagnostic rates and accuracy metrics.
4. **`batch-diagnostic.schema.json`**: (Historical/Advanced) Schema detailing run-level performance telemetry, caching parameters, and file reduction details.
5. **`batch-analysis-bundle.schema.json`**: Recommended single-file artifact for ChatGPT-assisted analysis of visual public sample batch regressions.

Note: `batch-summary.schema.json` and `batch-diagnostic.schema.json` are historical/advanced contracts. The Analysis Bundle JSON is the recommended artifact.

## ⚠️ Key Operational Assumptions

External integrators and developers modifying the evaluation suite must keep the following design constraints in mind:

- **Regression Sentinel, Not Absolute Ground Truth**: The `expected-metadata` structure serves as a *regression evaluation baseline*, not a strict, flawless biological ground truth benchmark. It is designed to capture model drift, regression in key elements, and OCR accuracy drops.
- **Sample-Specific Calibration**: The field `acceptableImageKinds` specifies sample-specific calibration rules. For example, a stylized sketch may be classified as either a `diagram`, a `handwrittenNote`, or an `artworkPhoto` depending on model variations.
- **OCR Sentinel**: The `expectedVisibleText` lists serve as regression OCR sentinels. A major drop in detecting these specific textual nodes indicates parsing or vision resolution regression.
- **Comparison & Validation Health Diagnostics**: Metrics and assertions like `comparisonCoverage`, `comparisonRecordConsistency`, and standard schema invariants serve as *report health diagnostics* validating that the evaluation harness itself is running correctly and producing consistent records.
