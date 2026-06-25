import { SummaryAnalysisResultV12 } from "./types";
import { 
  DOCUMENT_KIND_VOCABULARY_VERSION, 
  SUBJECT_DOMAIN_VOCABULARY_VERSION,
  DOCUMENT_KINDS,
  SUBJECT_DOMAINS,
  SUBJECT_LABEL_KINDS,
  PARTY_ROLE_CATEGORIES,
  TEMPORAL_ROLE_CATEGORIES
} from "./vocabularies";
import { normalizeSummaryAnalysisV12 } from "./normalize";

export function repairSummaryAnalysisV12ControlledVocabularies(value: SummaryAnalysisResultV12): {
  repaired: SummaryAnalysisResultV12;
  warnings: string[];
} {
  const result = JSON.parse(JSON.stringify(value)) as SummaryAnalysisResultV12;
  const warnings: string[] = [];

  // 1. Repair documentKindInfo.vocabularyVersion
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
    }
  }

  // 2. Repair subjectAreas.vocabularyVersion
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
          d.domain = "technology";
          warnings.push(`Repaired subject domain "${orig}" to "technology".`);
        } else if (["computerscience", "computing"].includes(normalized)) {
          d.domain = "computerScience";
          warnings.push(`Repaired subject domain "${orig}" to "computerScience".`);
        } else if (["cultureandentertainment", "entertainment", "artsandculture"].includes(normalized)) {
          d.domain = "artsAndCulture";
          warnings.push(`Repaired subject domain "${orig}" to "artsAndCulture".`);
        } else if (normalized === "personal") {
          d.domain = "personal";
          warnings.push(`Repaired subject domain "${orig}" to "personal".`);
        } else if (normalized === "business") {
          d.domain = "business";
          warnings.push(`Repaired subject domain "${orig}" to "business".`);
        } else if (normalized === "finance") {
          d.domain = "finance";
          warnings.push(`Repaired subject domain "${orig}" to "finance".`);
        } else if (normalized === "education") {
          d.domain = "education";
          warnings.push(`Repaired subject domain "${orig}" to "education".`);
        } else if (!SUBJECT_DOMAINS.includes(d.domain)) {
          // If a domain is still invalid: map to "other" when the original string is a plausible concrete domain label.
          // use "unknown" only when the domain cannot be inferred.
          // Since we can't do complex NLP, we'll map to "other" and preserve original as a label.
          d.domain = "other";
          d.labels = d.labels || [];
          d.labels.push({ label: orig, kind: "other", confidence: 0.5, source: "inferred" });
          warnings.push(`Repaired invalid subject domain "${orig}" to "other" (preserved as label).`);
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
          });
        }
      });
    }
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
  if (Array.isArray(result.extractedFacts?.temporalReferences)) {
    result.extractedFacts.temporalReferences.forEach(t => {
      if (t.role) {
        const normRole = t.role.toLowerCase();
        if (["publishedat", "publicationdate", "publisheddate", "postedat"].includes(normRole)) {
          if (t.roleCategory !== "publication") {
            const old = t.roleCategory || "none";
            t.roleCategory = "publication";
            warnings.push(`Repaired temporal role category "${old}" to "publication" based on role "${t.role}".`);
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

  return { repaired: result, warnings };
}

export function normalizeAndRepairSummaryAnalysisV12(value: unknown): {
  repaired: SummaryAnalysisResultV12;
  warnings: string[];
} {
  const normalized = normalizeSummaryAnalysisV12(value);
  return repairSummaryAnalysisV12ControlledVocabularies(normalized);
}
