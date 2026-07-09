# Contract Conformance Test Vectors

This directory contains strict conformance test vectors used to validate third-party parser, validator, or SDK implementations against our schema contracts.

---

## 📂 Directory Structure

```
contracts/conformance/
├── README.md
├── visual-analysis/
│   └── v0.2.0-draft.1/
│       ├── valid/
│       │   └── minimal.json
│       └── invalid/
│           └── missing-summary.json
├── image-analysis-record/
│   └── v0.1.0/
│       ├── valid/
│       │   └── minimal.json
│       └── invalid/
│           └── invalid-nested-visual-analysis.json
└── api/
    └── v0.1.0/
        ├── valid/
        │   └── visual-public-samples-analyze.response.success.json
        └── invalid/
            └── visual-public-samples-analyze.response.missing-record.json
```

---

## 🚦 Conformance Vector Categories

We divide conformance vectors into two strict categories to ensure validators can verify both positive and negative validation paths.

### 1. `valid/` (Expected to Pass)
* **Rule**: Must comply 100% with the corresponding JSON Schema version.
* **Test Expectation**: The validator compiles the schema, parses the file, and returns `isValid: true` without errors.

### 2. `invalid/` (Expected to Fail)
* **Rule**: Deliberately breaks one or more strict schema requirements.
* **Test Expectation**: The validator parses the file and returns `isValid: false` with specific error paths.
* **Invalidity Rationales**:
  * `visual-analysis/v0.2.0-draft.1/invalid/missing-summary.json`: Violates the required schema property constraint by omitting the `summary` block entirely.
  * `image-analysis-record/v0.1.0/invalid/invalid-nested-visual-analysis.json`: Breaks the nested contract relationship constraint by providing an invalid value for `visualAnalysis` (field typed incorrectly as string instead of object).
  * `api/v0.1.0/invalid/visual-public-samples-analyze.response.missing-record.json`: Fails the API response envelope requirements when `success: true` is asserted but the required `record` object is completely missing.
