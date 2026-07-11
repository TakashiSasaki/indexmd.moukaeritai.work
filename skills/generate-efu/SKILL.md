# EFU Generator

---
name: generate-efu
description: Generates an index.efu file containing a list of all files in the repository, compatible with the 'Everything' search tool.
---

## Overview
This skill generates a file index for the current project in the EFU (Everything File List) CSV format. This allows users to quickly search the repository files using the Everything search utility.

## When to use
- When the user asks to update the file index.
- Periodically to ensure `index.efu` is up to date.

## Instructions
1. Run the generation script:
   `npm run generate:efu`
2. The `index.efu` file will be updated in the repository root.
3. Inform the user that the file has been generated/updated.
