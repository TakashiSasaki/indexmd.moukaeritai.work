import Ajv from "ajv";
import { SUMMARY_ANALYSIS_SCHEMA_V12 } from "./schema";
import {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_VOCABULARY_VERSION,
  SUBJECT_DOMAINS,
  SUBJECT_DOMAIN_VOCABULARY_VERSION,
  SUBJECT_LABEL_KINDS,
  KEYWORD_SOURCES,
  TEMPORAL_ROLE_CATEGORIES,
  PARTY_KINDS,
  PARTY_ROLE_CATEGORIES,
  MONETARY_ROLE_CATEGORIES
} from "./vocabularies";

// Initialize Ajv with standard configuration
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validateSchema = ajv.compile(SUMMARY_ANALYSIS_SCHEMA_V12);

/**
 * Validates a Summary Analysis v1.2 result against JSON Schema and custom vocabularies/rules.
 * Returns an array of string error descriptions. Empty array means validation passed.
 */
export function getSummaryAnalysisV12ValidationErrors(value: any): string[] {
  const errors: string[] = [];

  if (!value || typeof value !== "object") {
    errors.push("Value is not an object");
    return errors;
  }

  // 1. Structural Schema Validation using Ajv
  const valid = validateSchema(value);
  if (!valid && validateSchema.errors) {
    for (const err of validateSchema.errors) {
      const path = err.instancePath || "";
      errors.push(`Schema error at ${path}: ${err.message}`);
    }
  }

  // If there are structural errors, we might fail fast for nested custom checks,
  // but let's run them defensively by using optional chaining/guards.

  // 2. Summary Validation
  if (value.summary && typeof value.summary === "object") {
    if (typeof value.summary.oneLine !== "string" || value.summary.oneLine.trim() === "") {
      errors.push("summary.oneLine must be a non-empty string");
    }
    if (typeof value.summary.detailed !== "string") {
      errors.push("summary.detailed must be a string");
    }
  }

  // 3. Title Info Validation
  if (value.titleInfo && typeof value.titleInfo === "object") {
    const { explicitTitle, fileNameTitle, inferredTitle, displayTitle } = value.titleInfo;

    if (explicitTitle !== null && typeof explicitTitle === "object") {
      if (typeof explicitTitle.value !== "string" || explicitTitle.value.trim() === "") {
        errors.push("titleInfo.explicitTitle.value must be a non-empty string");
      }
      if (!["embeddedMetadata", "documentHeading"].includes(explicitTitle.source)) {
        errors.push(`titleInfo.explicitTitle.source is invalid: ${explicitTitle.source}`);
      }
    }

    if (fileNameTitle !== null && typeof fileNameTitle === "object") {
      if (typeof fileNameTitle.value !== "string" || fileNameTitle.value.trim() === "") {
        errors.push("titleInfo.fileNameTitle.value must be a non-empty string");
      }
      if (fileNameTitle.isGeneric === true) {
        if (typeof fileNameTitle.genericReason !== "string" || fileNameTitle.genericReason.trim() === "") {
          errors.push("titleInfo.fileNameTitle.genericReason is required when isGeneric is true");
        }
      }
    }

    if (typeof inferredTitle !== "string") {
      errors.push("titleInfo.inferredTitle must be a string");
    }

    if (displayTitle && typeof displayTitle === "object") {
      const source = displayTitle.source;
      const displayVal = displayTitle.value;

      if (typeof displayVal !== "string" || displayVal.trim() === "") {
        errors.push("titleInfo.displayTitle.value must be a non-empty string");
      }

      // Display title source consistency checks
      if (source === "explicitTitle" && explicitTitle === null) {
        errors.push("titleInfo.displayTitle.source is 'explicitTitle' but explicitTitle is null");
      }
      if (source === "fileNameTitle" && fileNameTitle === null) {
        errors.push("titleInfo.displayTitle.source is 'fileNameTitle' but fileNameTitle is null");
      }
      if (source === "inferredTitle" && (typeof inferredTitle !== "string" || inferredTitle.trim() === "")) {
        errors.push("titleInfo.displayTitle.source is 'inferredTitle' but inferredTitle is empty");
      }
    }
  }

  // 4. Document Kind Info Validation
  if (value.documentKindInfo && typeof value.documentKindInfo === "object") {
    const { vocabularyVersion, kinds } = value.documentKindInfo;

    if (vocabularyVersion !== DOCUMENT_KIND_VOCABULARY_VERSION) {
      errors.push(`documentKindInfo.vocabularyVersion must be exactly "${DOCUMENT_KIND_VOCABULARY_VERSION}"`);
    }

    if (Array.isArray(kinds)) {
      if (kinds.length > 5) {
        errors.push("documentKindInfo.kinds array must not contain more than 5 elements");
      }

      const kindValues = kinds.map((k) => k?.kind);
      const hasUnknown = kindValues.includes("unknown");

      if (hasUnknown && kinds.length > 1) {
        errors.push("If documentKindInfo contains 'unknown' kind, it must be the only kind in the array");
      }

      for (const k of kinds) {
        if (!k || typeof k !== "object") continue;
        const { kind, confidence, reason } = k;

        if (typeof kind !== "string" || !DOCUMENT_KINDS.includes(kind)) {
          errors.push(`Invalid document kind value: "${kind}"`);
        }

        if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
          errors.push(`confidence in documentKindInfo must be a number between 0 and 1, got ${confidence}`);
        }

        if (typeof reason !== "string") {
          errors.push("documentKindInfo kinds reason must be a string");
        }
      }
    }
  }

  // 5. File Format Info Validation
  if (value.fileFormatInfo && typeof value.fileFormatInfo === "object") {
    const { mimeType, extension } = value.fileFormatInfo;
    if (mimeType !== null && typeof mimeType !== "string") {
      errors.push("fileFormatInfo.mimeType must be a string or null");
    }
    if (extension !== null && typeof extension !== "string") {
      errors.push("fileFormatInfo.extension must be a string or null");
    }
  }

  // 6. Subject Areas Validation
  if (value.subjectAreas && typeof value.subjectAreas === "object") {
    const { vocabularyVersion, domains } = value.subjectAreas;

    if (vocabularyVersion !== SUBJECT_DOMAIN_VOCABULARY_VERSION) {
      errors.push(`subjectAreas.vocabularyVersion must be exactly "${SUBJECT_DOMAIN_VOCABULARY_VERSION}"`);
    }

    if (Array.isArray(domains)) {
      if (domains.length > 5) {
        errors.push("subjectAreas.domains array must not contain more than 5 elements");
      }

      const domainValues = domains.map((d) => d?.domain);
      const hasUnknownDomain = domainValues.includes("unknown");

      if (hasUnknownDomain && domains.length > 1) {
        errors.push("If subjectAreas contains 'unknown' domain, it must be the only domain in the array");
      }

      for (const d of domains) {
        if (!d || typeof d !== "object") continue;
        const { domain, confidence, reason, labels } = d;

        if (typeof domain !== "string" || !SUBJECT_DOMAINS.includes(domain)) {
          errors.push(`Invalid subject domain value: "${domain}"`);
        }

        if (domain === "other") {
          if (!Array.isArray(labels) || labels.length === 0) {
            errors.push("If domain is 'other', it requires at least one concrete subject label");
          }
        }

        if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
          errors.push(`confidence in subjectAreas domain must be a number between 0 and 1, got ${confidence}`);
        }

        if (typeof reason !== "string") {
          errors.push("subjectAreas domains reason must be a string");
        }

        if (Array.isArray(labels)) {
          for (const l of labels) {
            if (!l || typeof l !== "object") continue;
            const { label, kind, confidence: labelConfidence, source, language, script, reason, evidenceKeywords } = l;

            if (typeof label !== "string" || label.trim() === "") {
              errors.push("Subject label must be a non-empty string");
            }

            if (typeof kind !== "string" || !SUBJECT_LABEL_KINDS.includes(kind)) {
              errors.push(`Invalid subject label kind: "${kind}"`);
            }

            if (typeof labelConfidence !== "number" || !Number.isFinite(labelConfidence) || labelConfidence < 0 || labelConfidence > 1) {
              errors.push(`Subject label confidence must be between 0 and 1, got ${labelConfidence}`);
            }

            if (typeof source !== "string" || !["surface", "inferred", "controlledVocabulary"].includes(source)) {
              errors.push(`Invalid subject label source: "${source}"`);
            }

            if (language !== undefined && typeof language !== "string") {
              errors.push("Subject label language must be a string");
            }

            if (script !== undefined && typeof script !== "string") {
              errors.push("Subject label script must be a string");
            }

            if (reason !== undefined && typeof reason !== "string") {
              errors.push("Subject label reason must be a string");
            }

            if (evidenceKeywords !== undefined) {
              if (!Array.isArray(evidenceKeywords) || !evidenceKeywords.every((ek: any) => typeof ek === "string")) {
                errors.push("Subject label evidenceKeywords must be an array of strings");
              }
            }
          }
        }
      }
    }
  }

  // 7. Language Info Validation
  if (value.languageInfo && typeof value.languageInfo === "object") {
    const { primary, detected } = value.languageInfo;
    if (typeof primary !== "string" || primary.trim() === "") {
      errors.push("languageInfo.primary must be a non-empty string");
    }
    if (Array.isArray(detected)) {
      if (typeof primary === "string" && primary.trim() !== "" && !detected.includes(primary)) {
        // languageInfo.detected should contain languageInfo.primary where feasible
        errors.push(`languageInfo.detected array should include the primary language "${primary}"`);
      }
    }
  }

  // 8. Indexing Validation
  if (value.indexing && typeof value.indexing === "object") {
    if ("topics" in value.indexing) {
      errors.push("indexing.topics is deprecated and no longer supported");
    }

    const { keywords, resourceReferences } = value.indexing;

    if (Array.isArray(keywords)) {
      for (const kw of keywords) {
        if (typeof kw === "string") {
          errors.push("Keyword term must be an object, string not allowed");
          continue;
        }
        if (!kw || typeof kw !== "object") {
          errors.push("Keyword term must be an object");
          continue;
        }
        const { value: kwVal, source, confidence, importance, language, script, normalizedValue, searchVariants } = kw;

        if (typeof kwVal !== "string" || kwVal.trim() === "") {
          errors.push("Keyword value must be a non-empty string");
        }

        if (typeof source !== "string" || !KEYWORD_SOURCES.includes(source)) {
          errors.push(`Invalid keyword source: "${source}"`);
        }

        if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
          errors.push(`Keyword confidence must be between 0 and 1, got ${confidence}`);
        }

        if (importance !== undefined) {
          if (typeof importance !== "number" || !Number.isFinite(importance) || importance < 0 || importance > 1) {
            errors.push(`Keyword importance must be between 0 and 1, got ${importance}`);
          }
        }

        if (language !== undefined && language !== null && typeof language !== "string") {
          errors.push("Keyword language must be a string or null");
        }

        if (script !== undefined && typeof script !== "string") {
          errors.push("Keyword script must be a string");
        }

        if (normalizedValue !== undefined && typeof normalizedValue !== "string") {
          errors.push("Keyword normalizedValue must be a string");
        }

        if (searchVariants !== undefined) {
          if (Array.isArray(searchVariants)) {
            for (const sv of searchVariants) {
              if (!sv || typeof sv !== "object") {
                errors.push("Search variant must be an object");
                continue;
              }
              const { value: svVal, relation, confidence: svConfidence, language: svLang, script: svScript } = sv;

              if (typeof svVal !== "string" || svVal.trim() === "") {
                errors.push("Search variant value must be a non-empty string");
              }

              if (typeof relation !== "string" || !["synonym", "acronym", "translation", "transliteration", "stem", "misspelling"].includes(relation)) {
                errors.push(`Invalid search variant relation: "${relation}"`);
              }

              if (typeof svConfidence !== "number" || !Number.isFinite(svConfidence) || svConfidence < 0 || svConfidence > 1) {
                errors.push(`Search variant confidence must be between 0 and 1, got ${svConfidence}`);
              }

              if (svLang !== undefined && svLang !== null && typeof svLang !== "string") {
                errors.push("Search variant language must be a string or null");
              }

              if (svScript !== undefined && typeof svScript !== "string") {
                errors.push("Search variant script must be a string");
              }
            }
          } else {
            errors.push("Keyword searchVariants must be an array");
          }
        }
      }
    } else {
      errors.push("indexing.keywords must be an array");
    }

    if (Array.isArray(resourceReferences)) {
      for (const rr of resourceReferences) {
        if (!rr || typeof rr !== "object") continue;
        if (rr.raw !== undefined && typeof rr.raw === "string") {
          if (rr.raw.length > 240) {
            errors.push("resourceReference raw field exceeds maximum length of 240 characters");
          }
        }
      }
    }
  }

  // 9. Extracted Facts Validation
  if (value.extractedFacts && typeof value.extractedFacts === "object") {
    const { temporalReferences, parties, monetaryAmounts } = value.extractedFacts;

    if (Array.isArray(temporalReferences)) {
      for (const tr of temporalReferences) {
        if (!tr || typeof tr !== "object") continue;
        const { roleCategory, confidence, raw } = tr;

        if (typeof roleCategory !== "string" || !TEMPORAL_ROLE_CATEGORIES.includes(roleCategory)) {
          errors.push(`Invalid temporal roleCategory value: "${roleCategory}"`);
        }

        if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
          errors.push(`temporalReference confidence must be between 0 and 1, got ${confidence}`);
        }

        if (raw !== undefined && typeof raw === "string") {
          if (raw.length > 240) {
            errors.push("temporalReference raw field exceeds maximum length of 240 characters");
          }
        }
      }
    }

    if (Array.isArray(parties)) {
      for (const p of parties) {
        if (!p || typeof p !== "object") continue;
        const { kind, roles } = p;

        if (typeof kind !== "string" || !PARTY_KINDS.includes(kind)) {
          errors.push(`Invalid party kind value: "${kind}"`);
        }

        if (Array.isArray(roles)) {
          for (const r of roles) {
            if (!r || typeof r !== "object") continue;
            const { roleCategory, confidence } = r;

            if (typeof roleCategory !== "string" || !PARTY_ROLE_CATEGORIES.includes(roleCategory)) {
              errors.push(`Invalid party roleCategory value: "${roleCategory}"`);
            }

            if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
              errors.push(`party role confidence must be between 0 and 1, got ${confidence}`);
            }
          }
        }
      }
    }

    if (Array.isArray(monetaryAmounts)) {
      for (const ma of monetaryAmounts) {
        if (!ma || typeof ma !== "object") continue;
        const { roleCategory, confidence, raw } = ma;

        if (typeof roleCategory !== "string" || !MONETARY_ROLE_CATEGORIES.includes(roleCategory)) {
          errors.push(`Invalid monetary roleCategory value: "${roleCategory}"`);
        }

        if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
          errors.push(`monetaryAmount confidence must be between 0 and 1, got ${confidence}`);
        }

        if (raw !== undefined && typeof raw === "string") {
          if (raw.length > 240) {
            errors.push("monetaryAmount raw field exceeds maximum length of 240 characters");
          }
        }
      }
    }
  }

  // 10. Quality Validation
  if (value.quality && typeof value.quality === "object") {
    const { confidence, warnings } = value.quality;
    if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      errors.push(`quality.confidence must be a number between 0 and 1, got ${confidence}`);
    }
    if (warnings !== undefined && !Array.isArray(warnings)) {
      errors.push("quality.warnings must be an array of strings");
    }
  }

  return errors;
}

/**
 * Validates a Summary Analysis v1.2 result against JSON Schema and custom rules.
 * Returns true if valid, false otherwise.
 */
export function validateSummaryAnalysisV12(value: any): boolean {
  return getSummaryAnalysisV12ValidationErrors(value).length === 0;
}
