# Image Experiment Tab

## Purpose
The "画像解析実験" (Image Experiment) tab provides a sandboxed environment to test the extraction of visual indexing metadata using the `visual-analysis.v0.1.0-draft.1` schema.

## Features
- **Drive Image Selection:** Input a Google Drive file ID to analyze any image file in your Drive.
- **Model Selection:** Supports testing against multiple models. Gemini Flash class is **Recommended**. Gemma is **Experimental** and not recommended for vision.
- **Request Preview (Opt-in):** Debugging information including system instructions and prompts is only returned if explicitly requested via the "リクエストプレビュー" checkbox.
- **Quality Gates:** Evaluates the generated visual metadata (e.g., warning if a landscape photo has no landscape elements, or if a document photo has no extracted text).
- **Immediate Debug Output:** Displays the generated caption, scene description, visible elements (including attributes, evidence, and location hints), visible text, and quality scores in a structured UI.

## Privacy & Persistence Constraints
- **No Raw Byte Persistence:** The image bytes fetched from Google Drive are sent directly to the model and are NEVER saved or cached on the server.
- **No Drive Writes:** The image experiment tab does not modify any files on Google Drive and does not write or update `index.md` files.
- **No Output Persistence:** The raw model output and prompt payloads are never persisted.
- **Limited Diagnostic Info:** On JSON parse failure, only the length of the raw output (`rawOutputLength`) and the error message are returned; the actual raw model output is stripped to prevent accidental PII leakage.
- **Normalized JSON:** The displayed JSON is the **Normalized and Validated** output, not the raw text from the model.

## Usage
1. Navigate to the `画像解析実験` tab.
2. Enter the Google Drive file ID of an image (e.g., `.jpg`, `.png`).
3. Select the target model.
4. Click `解析実行` to view the parsed visual indexing metadata and quality report.
