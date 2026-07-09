# Contract Versioning and Lifecycle Policy

This document defines the semantic versioning policy, schema stability lifecycle, breaking change rules, promotion conditions, and release procedures for the `indexmd` data exchange contracts package.

---

## 🚦 Schema Stability Levels

To support continuous evolution of metadata structures while providing strong stability guarantees for external consumers, contracts transition through four defined lifecycle phases. Each schema declares its current phase via the `x-contract-status` property.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    draft     │ ──> │      rc      │ ──> │    stable    │ ──> │  deprecated  │
│              │     │  (Release    │     │ (Production  │     │  (Superseded)│
│ (Iterative)  │     │  Candidate)  │     │   Immutable) │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### 1. `draft`
* **Purpose**: Active design, exploration, and live-calibration of emerging patterns (e.g., vision-model structured output extraction).
* **Breaking Changes**: Permitted at any time without version bumps.
* **Binding Advice**: External consumers should use draft contracts with caution, as structure can shift between commits.

### 2. `rc` (Release Candidate)
* **Purpose**: Feature-complete structures undergoing integration testing with live systems and early adopters.
* **Breaking Changes**: Avoided and only introduced under exceptional circumstances if a critical integration bug or performance blocker is identified.
* **Binding Advice**: Recommended for testing environments and early staging integration.

### 3. `stable`
* **Purpose**: Production-grade contract.
* **Breaking Changes**: Strictly **forbidden**. The version folder becomes **read-only and immutable** (except for safe, additive documentation or comment adjustments).
* **Binding Advice**: Safe for production environments. Any breaking structural adjustment requires a new path namespace and major/minor version folder bump (e.g., creating `v0.2.0` or `v1.3.0`).

### 4. `deprecated`
* **Purpose**: Superseded by a newer contract version.
* **Breaking Changes**: Forbidden. The contract remains active and frozen to support existing clients during their migration window.
* **Binding Advice**: Consumers should migrate to the active replacement version as soon as possible.

---

## 🔁 Promotion Conditions and Rules

```
[draft] ──(Feature Complete)──> [rc] ──(Production Ready & Drift-Checked)──> [stable]
```

1. **`draft` -> `rc`**:
   - The contract has been tested with real model outputs (via public-sample evaluation harnesses).
   - All properties are fully typed and all governed vocabulary terms are established.
   - Example files are present and validate correctly against the schema.
2. **`rc` -> `stable`**:
   - At least 30 days of production-like execution with zero integration failures or schema-related exceptions.
   - The contract matches the `/schemas` runtime compatibility mirror perfectly.
   - All client integrations have confirmed successful deserialization.

---

## ⚡ Breaking vs. Non-Breaking Changes

Our versioning policy adheres to standard semantic schema evolution rules.

### 🔴 Breaking Changes (Requires Folder / Version Path Bump)
A structural alteration is considered breaking if it forces existing parsers to fail. Examples include:
* **Renaming** or **removing** an existing property.
* **Changing the data type** of an existing property (e.g., changing string to array).
* Adding a **new required property** at any level without a default value.
* **Tightening enums** (removing valid options) or constraining valid string/number validation patterns (e.g., adding a tighter regex pattern or strict maximum).
* Restructuring the outer envelope or shifting nested payload boundaries.

### 🟢 Non-Breaking Changes (Safe to apply inline to `draft` and `rc` folders)
Additive, backward-compatible alterations that do not cause parser failures. Examples include:
* Adding a **new optional property** with appropriate description metadata.
* Adjusting or correcting text descriptions, titles, comments, or annotations.
* Expanding enum definitions with **new additive values** (as long as downstream consumers utilize lenient enum handling or ignore unknown values).
* Fixing formatting, typos, or adding new canonical JSON example files.
* Appending new terms to governed lists inside `contracts/vocabularies/`.

---

## 🔒 Immutability and Maintenance Policy

Once a contract reaches `stable` status:
* **No code-breaking modifications**: Under no circumstances can properties be modified, deleted, or redefined.
* **Safe fixes**: Only corrections to markdown READMEs, comments, or descriptions that do not alter the parsed AST/JSON Schema structure are allowed.
* **Drift Avoidance**: Structural identity between the immutable canonical contract and the internal runtime mirrors in `/schemas` must be verified continuously.

---

## 📋 Pre-Release Checklist

Before promoting any contract or releasing a contract version, developers and integration systems must execute the following workflow:

1. **Check Local Schema Structure**: Run AJV compilation and validate all canonical examples:
   ```bash
   npm run validate:contracts
   ```
2. **Drift Verification**: Confirm that runtime compatibility mirrors in `/schemas` match the contract definitions exactly:
   ```bash
   npm run verify:contract-mirrors
   ```
3. **Run Production Build**: Confirm that the client and server build succeeds:
   ```bash
   npm run build
   ```
4. **Ensure Syntax Health**: Run codebase linter:
   ```bash
   npm run lint
   ```
5. **Run Unit Tests**: Ensure all parser and validator logic passes:
   ```bash
   npm run test:unit
   ```
6. **Validate Public Sample Images**: Validate regression evaluation datasets:
   ```bash
   npm run validate:public-samples:images
   ```

---

## 💡 External Consumer Guidance

* **Explicit Over Dynamic**: Always bind your parsers to explicit semantic paths under `contracts/` (e.g., `contracts/schemas/text-analysis-record/v0.1.0/schema.json`).
* **Avoid Aliasing**: This project does not employ dynamic `latest` or `current` symlinks. This ensures your systems will never experience silent, breaking contract shifts.
* **Lenient Parsing**: Program your deserializers to ignore unknown fields (lenient parsing/additional properties allowed) so that additive, non-breaking contract updates can be introduced upstream without requiring immediate client-side redeployment.
