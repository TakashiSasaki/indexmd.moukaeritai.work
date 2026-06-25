import { SummaryAnalysisResultV12 } from "./types";

/**
 * Trims a string. Returns empty string if undefined/null.
 */
function trimStr(val: any): string {
  if (typeof val !== "string") return "";
  return val.trim();
}

/**
 * Normalizes an optional string. Returns null if empty/null, otherwise trimmed.
 */
function normalizeOptionalStr(val: any): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Deduplicates and trims string arrays, filtering out empty strings.
 */
function dedupArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  const cleaned = arr
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item !== "");
  return Array.from(new Set(cleaned));
}

/**
 * Detects if a string resembles a sensitive credential, token, password, or key.
 */
function isSensitiveToken(val: string): boolean {
  const clean = val.trim();
  // Match Google/Gemini API keys (AIzaSy...)
  if (/AIzaSy[A-Za-z0-9_-]{32,40}/.test(clean)) return true;
  // Match Google OAuth access tokens (ya29...)
  if (/ya29\.[A-Za-z0-9_-]+/.test(clean)) return true;
  // Match generic bearer headers
  if (/^(bearer|token)\s+/i.test(clean)) return true;
  // Match likely credentials / secrets
  if (/(?:access_token|refresh_token|client_secret|api_key|private_key|token=)/i.test(clean)) return true;
  return false;
}

/**
 * Normalizes an optional raw field: trims, truncates to 240 chars,
 * and redacts if it contains sensitive tokens/credentials.
 */
function normalizeRawField(val: any): string | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (trimmed === "") return undefined;

  if (isSensitiveToken(trimmed)) {
    return "[REDACTED_SECURITY_SENSITIVE_STRING]";
  }

  // Truncate to maximum of 240 characters
  return trimmed.length > 240 ? trimmed.slice(0, 240) : trimmed;
}

/**
 * Conservatively normalizes a Summary Analysis v1.2 result.
 * Keeps output deterministic and deeply cloned.
 */
export function normalizeSummaryAnalysisV12(value: any): SummaryAnalysisResultV12 {
  if (!value || typeof value !== "object") {
    throw new Error("Input to normalizer must be an object");
  }

  // Deep clone and conservative rebuild
  const result: any = {};

  // 1. Summary
  result.summary = {
    oneLine: trimStr(value.summary?.oneLine),
    detailed: trimStr(value.summary?.detailed)
  };

  // 2. Title Info
  const tInfo = value.titleInfo || {};
  let normExplicit: any = null;
  if (tInfo.explicitTitle) {
    const expVal = trimStr(tInfo.explicitTitle.value);
    if (expVal !== "") {
      normExplicit = {
        value: expVal,
        source: tInfo.explicitTitle.source || "documentHeading"
      };
    }
  }

  let normFile: any = null;
  if (tInfo.fileNameTitle) {
    normFile = {
      value: trimStr(tInfo.fileNameTitle.value),
      isGeneric: !!tInfo.fileNameTitle.isGeneric
    };
    if (tInfo.fileNameTitle.isGeneric && tInfo.fileNameTitle.genericReason) {
      normFile.genericReason = trimStr(tInfo.fileNameTitle.genericReason);
    }
  }

  result.titleInfo = {
    explicitTitle: normExplicit,
    fileNameTitle: normFile,
    inferredTitle: trimStr(tInfo.inferredTitle),
    displayTitle: {
      value: trimStr(tInfo.displayTitle?.value),
      source: tInfo.displayTitle?.source || "inferredTitle",
      reason: trimStr(tInfo.displayTitle?.reason)
    }
  };

  // 3. Document Kind Info
  const dkInfo = value.documentKindInfo || {};
  const kinds = Array.isArray(dkInfo.kinds) ? dkInfo.kinds : [];
  result.documentKindInfo = {
    vocabularyVersion: trimStr(dkInfo.vocabularyVersion) || "1.0.0-draft.1",
    kinds: kinds
      .slice(0, 5) // Cap at 5 elements
      .map((k: any) => {
        if (!k || typeof k !== "object") return null;
        return {
          kind: trimStr(k.kind),
          confidence: typeof k.confidence === "number" ? Math.min(1, Math.max(0, k.confidence)) : 0,
          reason: trimStr(k.reason)
        };
      })
      .filter((k: any) => k !== null && k.kind !== "")
  };

  // 4. File Format Info
  const ffInfo = value.fileFormatInfo || {};
  result.fileFormatInfo = {
    mimeType: normalizeOptionalStr(ffInfo.mimeType),
    extension: normalizeOptionalStr(ffInfo.extension)
  };

  // 5. Subject Areas Info
  const saInfo = value.subjectAreas || {};
  const domains = Array.isArray(saInfo.domains) ? saInfo.domains : [];
  result.subjectAreas = {
    vocabularyVersion: trimStr(saInfo.vocabularyVersion) || "1.0.0-draft.1",
    domains: domains
      .slice(0, 5) // Cap at 5 elements
      .map((d: any) => {
        if (!d || typeof d !== "object") return null;
        const labels = Array.isArray(d.labels) ? d.labels : [];
        return {
          domain: trimStr(d.domain),
          confidence: typeof d.confidence === "number" ? Math.min(1, Math.max(0, d.confidence)) : 0,
          reason: trimStr(d.reason),
          labels: labels
            .map((l: any) => {
              if (!l || typeof l !== "object") return null;
              const normLabel: any = {
                label: trimStr(l.label),
                kind: trimStr(l.kind),
                confidence: typeof l.confidence === "number" ? Math.min(1, Math.max(0, l.confidence)) : 0,
                source: trimStr(l.source) || "controlledVocabulary"
              };
              const lang = trimStr(l.language);
              if (lang !== "") normLabel.language = lang;
              const scr = trimStr(l.script);
              if (scr !== "") normLabel.script = scr;
              const reas = trimStr(l.reason);
              if (reas !== "") normLabel.reason = reas;
              if (Array.isArray(l.evidenceKeywords)) {
                normLabel.evidenceKeywords = l.evidenceKeywords
                  .map((ek: any) => trimStr(ek))
                  .filter((ek: string) => ek !== "");
              }
              return normLabel;
            })
            .filter((l: any) => l !== null && l.label !== "")
        };
      })
      .filter((d: any) => d !== null && d.domain !== "")
  };

  // 6. Language Info
  const langInfo = value.languageInfo || {};
  result.languageInfo = {
    primary: trimStr(langInfo.primary),
    detected: dedupArray(langInfo.detected)
  };

  // Ensure primary is present in detected
  if (result.languageInfo.primary !== "" && !result.languageInfo.detected.includes(result.languageInfo.primary)) {
    result.languageInfo.detected.unshift(result.languageInfo.primary);
  }

  // 7. Indexing
  const idxInfo = value.indexing || {};
  const nEntities = Array.isArray(idxInfo.namedEntities) ? idxInfo.namedEntities : [];
  const rRefs = Array.isArray(idxInfo.resourceReferences) ? idxInfo.resourceReferences : [];
  const rawKeywords = Array.isArray(idxInfo.keywords) ? idxInfo.keywords : [];

  // Re-map and normalize keywords
  const normalizedKeywords = rawKeywords
    .map((kw: any) => {
      if (!kw || typeof kw !== "object") return null;
      const val = trimStr(kw.value);
      if (val === "") return null;

      const normKw: any = {
        value: val,
        source: trimStr(kw.source) || "surface",
        confidence: typeof kw.confidence === "number" ? Math.min(1, Math.max(0, kw.confidence)) : 0,
        importance: typeof kw.importance === "number" ? Math.min(1, Math.max(0, kw.importance)) : 0,
        searchVariants: Array.isArray(kw.searchVariants)
          ? kw.searchVariants
              .map((sv: any) => {
                if (!sv || typeof sv !== "object") return null;
                const svVal = trimStr(sv.value);
                if (svVal === "") return null;
                const normSv: any = {
                  value: svVal,
                  kind: trimStr(sv.kind) || "synonym",
                  confidence: typeof sv.confidence === "number" ? Math.min(1, Math.max(0, sv.confidence)) : 0
                };
                const svLang = trimStr(sv.language);
                if (svLang !== "") normSv.language = svLang;
                const svScr = trimStr(sv.script);
                if (svScr !== "") normSv.script = svScr;
                return normSv;
              })
              .filter((sv: any) => sv !== null)
          : []
      };

      const lang = trimStr(kw.language);
      if (lang !== "") normKw.language = lang;
      const scr = trimStr(kw.script);
      if (scr !== "") normKw.script = scr;
      const normVal = trimStr(kw.normalizedValue);
      if (normVal !== "") normKw.normalizedValue = normVal;

      return normKw;
    })
    .filter((kw: any) => kw !== null);

  // Deduplicate keywords by value
  const uniqueKwMap = new Map<string, any>();
  for (const kw of normalizedKeywords) {
    if (!uniqueKwMap.has(kw.value)) {
      uniqueKwMap.set(kw.value, kw);
    }
  }
  const dedupedKeywords = Array.from(uniqueKwMap.values());

  result.indexing = {
    keywords: dedupedKeywords,
    namedEntities: nEntities
      .map((ne: any) => {
        if (!ne || typeof ne !== "object") return null;
        return {
          name: trimStr(ne.name),
          type: ne.type || "unclassified"
        };
      })
      .filter((ne: any) => ne !== null && ne.name !== ""),
    resourceReferences: rRefs
      .map((rr: any) => {
        if (!rr || typeof rr !== "object") return null;
        const normRef: any = {
          uri: trimStr(rr.uri)
        };
        if (rr.label !== undefined) normRef.label = trimStr(rr.label);
        const normRaw = normalizeRawField(rr.raw);
        if (normRaw !== undefined) normRef.raw = normRaw;
        return normRef;
      })
      .filter((rr: any) => rr !== null && rr.uri !== "")
  };

  // 8. Extracted Facts
  const efInfo = value.extractedFacts || {};
  const tRefs = Array.isArray(efInfo.temporalReferences) ? efInfo.temporalReferences : [];
  const parties = Array.isArray(efInfo.parties) ? efInfo.parties : [];
  const mAmounts = Array.isArray(efInfo.monetaryAmounts) ? efInfo.monetaryAmounts : [];

  result.extractedFacts = {
    temporalReferences: tRefs
      .map((tr: any) => {
        if (!tr || typeof tr !== "object") return null;
        const normTr: any = {
          value: trimStr(tr.value),
          role: trimStr(tr.role),
          roleCategory: trimStr(tr.roleCategory) || "unknown",
          confidence: typeof tr.confidence === "number" ? Math.min(1, Math.max(0, tr.confidence)) : 0
        };
        const normDate = trimStr(tr.normalizedDate);
        if (normDate !== "") normTr.normalizedDate = normDate;
        const normRaw = normalizeRawField(tr.raw);
        if (normRaw !== undefined) normTr.raw = normRaw;
        return normTr;
      })
      .filter((tr: any) => tr !== null && tr.value !== ""),

    parties: parties
      .map((p: any) => {
        if (!p || typeof p !== "object") return null;
        const roles = Array.isArray(p.roles) ? p.roles : [];
        return {
          name: trimStr(p.name),
          kind: trimStr(p.kind) || "unknown",
          roles: roles
            .map((r: any) => {
              if (!r || typeof r !== "object") return null;
              return {
                role: trimStr(r.role),
                roleCategory: trimStr(r.roleCategory) || "unknown",
                confidence: typeof r.confidence === "number" ? Math.min(1, Math.max(0, r.confidence)) : 0
              };
            })
            .filter((r: any) => r !== null && r.role !== "")
        };
      })
      .filter((p: any) => p !== null && p.name !== ""),

    monetaryAmounts: mAmounts
      .map((ma: any) => {
        if (!ma || typeof ma !== "object") return null;
        const normMa: any = {
          amount: typeof ma.amount === "number" && Number.isFinite(ma.amount) ? ma.amount : 0,
          currency: trimStr(ma.currency) || "USD",
          role: trimStr(ma.role),
          roleCategory: trimStr(ma.roleCategory) || "unknown",
          confidence: typeof ma.confidence === "number" ? Math.min(1, Math.max(0, ma.confidence)) : 0
        };
        const normRaw = normalizeRawField(ma.raw);
        if (normRaw !== undefined) normMa.raw = normRaw;
        return normMa;
      })
      .filter((ma: any) => ma !== null)
  };

  // 9. Quality
  const qInfo = value.quality || {};
  result.quality = {
    confidence: typeof qInfo.confidence === "number" ? Math.min(1, Math.max(0, qInfo.confidence)) : 0,
    warnings: Array.isArray(qInfo.warnings) ? qInfo.warnings.map((w: any) => trimStr(w)).filter((w: string) => w !== "") : []
  };

  return result;
}
