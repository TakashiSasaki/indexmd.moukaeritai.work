# Image Experiment Tab

## Purpose
The "画像解析実験" (Image Experiment) tab provides a sandboxed environment to test the extraction of visual indexing metadata using the `visual-analysis.v0.1.0-draft.1` schema.

## Features
- **Drive Image Selection:** Input a Google Drive file ID to analyze any image file in your Drive.
- **Model Selection:** Supports testing against multiple models (Gemini 3.5 Flash, Gemini Flash Latest, Gemma 4 31B IT).
- **Quality Gates:** Evaluates the generated visual metadata (e.g., warning if a landscape photo has no landscape elements, or if a document photo has no extracted text).
- **Immediate Debug Output:** Displays the generated caption, scene description, visible elements, visible text, and quality scores in a structured UI.

## Privacy & Persistence Constraints
- **No Raw Byte Persistence:** The image bytes fetched from Google Drive are sent directly to the model and are NEVER saved or cached on the server.
- **No Drive Writes:** The image experiment tab does not modify any files on Google Drive and does not write or update `index.md` files.
- **No Output Persistence:** The raw model output, prompt payloads, and request previews are only served back to the client for immediate debugging. They are not stored in the Firebase database or local server cache.

## Usage
1. Navigate to the `画像解析実験` tab.
2. Enter the Google Drive file ID of an image (e.g., `.jpg`, `.png`).
3. Select the target model.
4. Click `解析実行` to view the parsed visual indexing metadata and quality report.
