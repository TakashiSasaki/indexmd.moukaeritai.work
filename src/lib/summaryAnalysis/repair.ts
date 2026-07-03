import { SummaryAnalysisResultV12 } from "./types";
import { 
  DOCUMENT_KIND_VOCABULARY_VERSION, 
  SUBJECT_DOMAIN_VOCABULARY_VERSION,
  KEYWORD_SOURCE_VOCABULARY_VERSION,
  DOCUMENT_KINDS,
  SUBJECT_DOMAINS,
  SUBJECT_LABEL_KINDS,
  PARTY_ROLE_CATEGORIES,
  TEMPORAL_ROLE_CATEGORIES,
  MONETARY_ROLE_CATEGORIES,
  KEYWORD_SOURCES
} from "./vocabularies";
import { normalizeSummaryAnalysisV12 } from "./normalize";

export function repairSummaryAnalysisV12ControlledVocabularies(value: SummaryAnalysisResultV12): {
  repaired: SummaryAnalysisResultV12;
  warnings: string[];
} {
  const result = JSON.parse(JSON.stringify(value)) as SummaryAnalysisResultV12;
  const warnings: string[] = [];

  // 1. Repair documentKindInfo
  if (result.documentKindInfo) {
    if (result.documentKindInfo.vocabularyVersion !== DOCUMENT_KIND_VOCABULARY_VERSION) {
      warnings.push(`Repaired documentKindInfo.vocabularyVersion from "${result.documentKindInfo.vocabularyVersion}" to "${DOCUMENT_KIND_VOCABULARY_VERSION}".`);
      result.documentKindInfo.vocabularyVersion = DOCUMENT_KIND_VOCABULARY_VERSION;
    }

    if (Array.isArray(result.documentKindInfo.kinds)) {
      result.documentKindInfo.kinds.forEach(k => {
        const orig = k.kind;
        const normalizedKind = orig.toLowerCase().replace(/[^a-z]/g, "");
        if (["spreadsheet", "sheet", "googlesheet", "googlesheets", "table", "tabulardata", "csv", "tsv", "json", "xml"].includes(normalizedKind)) {
          k.kind = "dataset";
          warnings.push(`Repaired document kind "${orig}" to "dataset".`);
        } else if (!DOCUMENT_KINDS.includes(k.kind)) {
          k.kind = "unknown";
          warnings.push(`Repaired invalid document kind "${orig}" to "unknown".`);
        }
      });

      // After repairing kinds, if "unknown" appears with any other kind, remove "unknown" if other valid kinds exist.
      if (result.documentKindInfo.kinds.length > 1) {
        const hasKnown = result.documentKindInfo.kinds.some(k => k.kind !== "unknown");
        if (hasKnown) {
          const originalCount = result.documentKindInfo.kinds.length;
          result.documentKindInfo.kinds = result.documentKindInfo.kinds.filter(k => k.kind !== "unknown");
          if (result.documentKindInfo.kinds.length < originalCount) {
            warnings.push(`Removed "unknown" document kind because other valid kinds were present.`);
          }
        }
      }
      
      // Ensure "documentKindInfo.kinds" is non-empty
      if (result.documentKindInfo.kinds.length === 0) {
        result.documentKindInfo.kinds = [{ kind: "unknown", confidence: 0.5, reason: "Fallback because kinds array was empty" }];
        warnings.push(`Added fallback "unknown" document kind because the list was empty.`);
      }
    }
  }

  // 2. Repair subjectAreas
  if (result.subjectAreas) {
    if (result.subjectAreas.vocabularyVersion !== SUBJECT_DOMAIN_VOCABULARY_VERSION) {
      warnings.push(`Repaired subjectAreas.vocabularyVersion from "${result.subjectAreas.vocabularyVersion}" to "${SUBJECT_DOMAIN_VOCABULARY_VERSION}".`);
      result.subjectAreas.vocabularyVersion = SUBJECT_DOMAIN_VOCABULARY_VERSION;
    }

    if (Array.isArray(result.subjectAreas.domains)) {
      result.subjectAreas.domains.forEach(d => {
        const orig = d.domain;
        const normalized = orig.toLowerCase().replace(/[^a-z]/g, "");
        
        if (["computingandinternet", "internet", "web", "technology"].includes(normalized)) {
          if (d.domain !== "technology") {
            d.domain = "technology";
            warnings.push(`Repaired subject domain "${orig}" to "technology".`);
          }
        } else if (["computerscience", "computing"].includes(normalized)) {
          if (d.domain !== "computerScience") {
            d.domain = "computerScience";
            warnings.push(`Repaired subject domain "${orig}" to "computerScience".`);
          }
        } else if (["cultureandentertainment", "entertainment", "artsandculture"].includes(normalized)) {
          if (d.domain !== "artsAndCulture") {
            d.domain = "artsAndCulture";
            warnings.push(`Repaired subject domain "${orig}" to "artsAndCulture".`);
          }
        } else if (normalized === "personal") {
          if (d.domain !== "personal") {
            d.domain = "personal";
            warnings.push(`Repaired subject domain "${orig}" to "personal".`);
          }
        } else if (normalized === "business") {
          if (d.domain !== "business") {
            d.domain = "business";
            warnings.push(`Repaired subject domain "${orig}" to "business".`);
          }
        } else if (normalized === "finance") {
          if (d.domain !== "finance") {
            d.domain = "finance";
            warnings.push(`Repaired subject domain "${orig}" to "finance".`);
          }
        } else if (normalized === "education") {
          if (d.domain !== "education") {
            d.domain = "education";
            warnings.push(`Repaired subject domain "${orig}" to "education".`);
          }
        } else if (!SUBJECT_DOMAINS.includes(d.domain)) {
          d.domain = "other";
          d.labels = d.labels || [];
          d.labels.push({ label: orig, kind: "other", confidence: 0.5, source: "inferred" });
          warnings.push(`Repaired invalid subject domain "${orig}" to "other" (preserved as label).`);
        }

        // For invalid subject domains mapped to "other", ensure "labels" has at least one concrete label.
        if (d.domain === "other" && (!d.labels || d.labels.length === 0)) {
           d.labels = [{ label: "General", kind: "other", confidence: 0.3, source: "inferred" }];
           warnings.push(`Added fallback label to "other" subject domain.`);
        }

        if (Array.isArray(d.labels)) {
          d.labels.forEach(l => {
            const origKind = l.kind;
            const normKind = origKind.toLowerCase();
            if (["service", "platform", "tool", "software"].includes(normKind)) {
              l.kind = "product";
              warnings.push(`Repaired subject label kind "${origKind}" to "product".`);
            } else if (["genre", "theme", "category"].includes(normKind)) {
              l.kind = "topic";
              warnings.push(`Repaired subject label kind "${origKind}" to "topic".`);
            } else if (!SUBJECT_LABEL_KINDS.includes(l.kind)) {
              l.kind = "other";
              warnings.push(`Repaired invalid subject label kind "${origKind}" to "other".`);
            }

            // Ensure label source is one of "surface", "inferred", "controlledVocabulary".
            if (!["surface", "inferred", "controlledVocabulary"].includes(l.source || "")) {
               const oldSource = l.source || "empty";
               l.source = "inferred";
               warnings.push(`Repaired invalid subject label source "${oldSource}" to "inferred".`);
            }
          });
        }
      });
    }
  }

  // 3. Repair keyword sources
  if (result.indexing && Array.isArray(result.indexing.keywords)) {
    result.indexing.keywords.forEach(k => {
      const origSource = k.source || "";
      const normSource = origSource.toLowerCase();

      if (["metadata", "meta"].includes(normSource)) {
        k.source = "embeddedMetadata";
        warnings.push(`Repaired keyword source "${origSource}" to "embeddedMetadata".`);
      } else if (["user", "author"].includes(normSource)) {
        k.source = "authorProvided";
        warnings.push(`Repaired keyword source "${origSource}" to "authorProvided".`);
      } else if (["url", "uri"].includes(normSource)) {
        k.source = "identifier";
        warnings.push(`Repaired keyword source "${origSource}" to "identifier".`);
      } else if (!KEYWORD_SOURCES.includes(k.source)) {
        k.source = "unknown";
        warnings.push(`Repaired invalid keyword source "${origSource}" to "unknown".`);
      }
    });
  }

  // 6. Repair party role category aliases
  if (Array.isArray(result.extractedFacts?.parties)) {
    result.extractedFacts.parties.forEach(p => {
      if (Array.isArray(p.roles)) {
        p.roles.forEach(r => {
          const origCategory = r.roleCategory;
          const normCat = origCategory ? origCategory.toLowerCase() : "";
          if (["transaction", "sponsor", "sponsorship", "buyer", "seller"].includes(normCat)) {
            r.roleCategory = "commerce";
            warnings.push(`Repaired party role category "${origCategory}" to "commerce".`);
          } else if (["payer", "payee"].includes(normCat)) {
            r.roleCategory = "payment";
            warnings.push(`Repaired party role category "${origCategory}" to "payment".`);
          } else if (origCategory && !PARTY_ROLE_CATEGORIES.includes(r.roleCategory!)) {
             r.roleCategory = "other";
             warnings.push(`Repaired invalid party role category "${origCategory}" to "other".`);
          }
        });
      }
    });
  }

  // 7. Repair temporal role category quality
  let temporalRepairCount = 0;
  if (Array.isArray(result.extractedFacts?.temporalReferences)) {
    result.extractedFacts.temporalReferences.forEach(t => {
      if (t.role) {
        const normRole = t.role.toLowerCase();
        if (["publishedat", "publicationdate", "publisheddate", "postedat"].includes(normRole)) {
          if (t.roleCategory !== "publication") {
            t.roleCategory = "publication";
            temporalRepairCount++;
          }
        }
      }
      if (t.roleCategory && !TEMPORAL_ROLE_CATEGORIES.includes(t.roleCategory)) {
        const old = t.roleCategory;
        t.roleCategory = "other";
        warnings.push(`Repaired invalid temporal role category "${old}" to "other".`);
      }
    });
  }
  if (temporalRepairCount > 0) {
    if (temporalRepairCount === 1) {
      warnings.push(`Repaired 1 temporal role category to "publication" based on publishedAt-like roles.`);
    } else {
      warnings.push(`Repaired ${temporalRepairCount} temporal role categories to "publication" based on publishedAt-like roles.`);
    }
  }

  // 8. Repair monetary role categories
  if (Array.isArray(result.extractedFacts?.monetaryAmounts)) {
    result.extractedFacts.monetaryAmounts.forEach(m => {
       const origCategory = m.roleCategory;
       const normCat = origCategory ? origCategory.toLowerCase() : "";

       if (["transaction", "purchase"].includes(normCat)) {
         m.roleCategory = "payment";
         warnings.push(`Repaired monetary role category "${origCategory}" to "payment".`);
       } else if (["cost"].includes(normCat)) {
         m.roleCategory = "price";
         warnings.push(`Repaired monetary role category "${origCategory}" to "price".`);
       } else if (["charge"].includes(normCat)) {
         m.roleCategory = "fee";
         warnings.push(`Repaired monetary role category "${origCategory}" to "fee".`);
       } else if (origCategory && !MONETARY_ROLE_CATEGORIES.includes(m.roleCategory!)) {
         m.roleCategory = "other";
         warnings.push(`Repaired invalid monetary role category "${origCategory}" to "other".`);
       }
    });
  }

  return { repaired: result, warnings };
}

export function normalizeAndRepairSummaryAnalysisV12(value: unknown): {
  repaired: SummaryAnalysisResultV12;
  warnings: string[];
} {
  const normalized = normalizeSummaryAnalysisV12(value);
  return repairSummaryAnalysisV12ControlledVocabularies(normalized);
}
