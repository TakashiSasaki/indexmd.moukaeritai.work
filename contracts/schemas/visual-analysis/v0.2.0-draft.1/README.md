# Visual Analysis Contract v0.2.0-draft.1

Status: **Draft**

## Purpose
Defines the inner schema produced by the computer vision analysis engine. It contains image-observable/inferable visual information only (e.g. image kinds, environment context, detected categories, detailed visible element labels, and recognized OCR text blocks) without operational metadata.

## Primary Producer
Image analysis vision pipeline powered by multimodal Gemini models.

## Primary Consumers
`ImageAnalysisRecord` visual analysis field, public sample regression evaluation harness, and visual catalog tools.

## Schema File
- `schema.json`

## Examples
- `examples/minimal.json`
- `examples/full.json`

## Related App Docs
- `docs/visual-analysis-schema.md`
