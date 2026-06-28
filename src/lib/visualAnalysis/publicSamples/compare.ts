import { PublicVisualSample } from './types';
import { VisualAnalysisResultV1, VisualAnalysisResultV2 } from '../types';

export interface ComparisonResult {
  status: "exact" | "acceptable" | "diverged";
  details?: string;
}

export function compareExpectedImageKind(sample: any, detectedKind?: string): ComparisonResult {
  const expectedImageKind = sample.expectedImageKind || sample.imageKind;
  if (!detectedKind) return { status: "diverged", details: "No image kind detected." };
  
  if (detectedKind === expectedImageKind) {
    return { status: "exact" };
  }
  
  // Some acceptable overlaps
  if (expectedImageKind === 'productPhoto' && detectedKind === 'packageImage') return { status: "acceptable" };
  if (expectedImageKind === 'documentPhoto' && detectedKind === 'handwrittenNote') return { status: "acceptable" };
  if (expectedImageKind === 'documentPhoto' && detectedKind === 'receiptPhoto') return { status: "acceptable" };

  return { status: "diverged", details: `Expected ${expectedImageKind}, got ${detectedKind}` };
}

export function compareExpectedCategories(sample: any, detectedCategories: string[]): {
  exact: string[];
  acceptable: string[];
  missing: string[];
  extra: string[];
  matches?: Array<{
    expected: string;
    detected: string;
    status: "exact" | "acceptable";
    method: "exact" | "softEquivalence" | "alias";
  }>;
} {
  const exact: string[] = [];
  const acceptable: string[] = [];
  const missing: string[] = [];
  const matches: Array<{
    expected: string;
    detected: string;
    status: "exact" | "acceptable";
    method: "exact" | "softEquivalence" | "alias";
  }> = [];

  const expectedElementCategories = sample.expectedElementCategories || sample.elementCategories || [];
  const expectedElementCategoryAlternatives = sample.expectedElementCategoryAlternatives || sample.elementCategoryAlternatives;

  // Track remaining detected categories and their consumption state
  interface CategoryCandidate {
    name: string;
    consumed: boolean;
  }

  const detectedCandidates: CategoryCandidate[] = detectedCategories.map(c => ({
    name: c,
    consumed: false
  }));

  // Phase 1: Exact matches
  const unresolvedExpected: string[] = [];

  for (const expected of expectedElementCategories) {
    const matchCand = detectedCandidates.find(c => !c.consumed && c.name === expected);
    if (matchCand) {
      matchCand.consumed = true;
      exact.push(expected);
      matches.push({
        expected,
        detected: matchCand.name,
        status: "exact",
        method: "exact"
      });
    } else {
      unresolvedExpected.push(expected);
    }
  }

  // Phase 2: Soft equivalence / alternatives
  for (const expected of unresolvedExpected) {
    let foundMatch = false;

    // Check landscapeElement soft equivalence
    if (expected === "landscapeElement") {
      const landscapeEquivalents = ["terrain", "plant", "waterBody", "weatherOrSky", "roadOrPath"];
      for (const eq of landscapeEquivalents) {
        const matchCand = detectedCandidates.find(c => !c.consumed && c.name === eq);
        if (matchCand) {
          matchCand.consumed = true;
          acceptable.push(expected);
          matches.push({
            expected,
            detected: matchCand.name,
            status: "acceptable",
            method: "softEquivalence"
          });
          foundMatch = true;
          break;
        }
      }
      if (foundMatch) continue;
    }

    // Check custom alternatives
    const alternatives = expectedElementCategoryAlternatives?.[expected] || [];
    for (const alt of alternatives) {
      const matchCand = detectedCandidates.find(c => !c.consumed && c.name === alt);
      if (matchCand) {
        matchCand.consumed = true;
        acceptable.push(expected);
        matches.push({
          expected,
          detected: matchCand.name,
          status: "acceptable",
          method: "alias"
        });
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      missing.push(expected);
    }
  }

  const extra = Array.from(new Set(detectedCandidates.filter(c => !c.consumed).map(c => c.name)));

  return { exact, acceptable, missing, extra, matches };
}

export function compareExpectedLabels(
  sample: any, 
  detectedLabels: string[], 
  detectedKeywords: string[] = []
): {
  exact: string[];
  acceptable: string[];
  missing: string[];
  extra: string[];
  matches: Array<{
    expected: string;
    detected: string;
    status: "exact" | "acceptable";
    method: "exact" | "alias" | "substring" | "tokenOverlap" | "keyword";
    source?: "visibleElementLabel" | "keyword";
  }>;
} {
  const exact: string[] = [];
  const acceptable: string[] = [];
  const missing: string[] = [];
  const matches: Array<{
    expected: string;
    detected: string;
    status: "exact" | "acceptable";
    method: "exact" | "alias" | "substring" | "tokenOverlap" | "keyword";
    source?: "visibleElementLabel" | "keyword";
  }> = [];

  const expectedLabels = sample.expectedVisibleElementLabels || sample.visibleElementLabels || [];
  const expectedVisibleElementLabelAliases = sample.expectedVisibleElementLabelAliases || sample.visibleElementLabelAliases;

  function cleanAndNormalize(text: string): string {
    let val = text.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
    val = val.replace(/\s+/g, " ").trim();
    return val;
  }

  function normalizeWord(word: string): string {
    let w = word.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    if (w.endsWith('s') && w.length > 3) {
      if (w.endsWith('ves')) {
        w = w.slice(0, -3) + 'f';
      } else if (w.endsWith('ies')) {
        w = w.slice(0, -3) + 'y';
      } else {
        w = w.slice(0, -1);
      }
    }
    return w;
  }

  interface LabelCandidate {
    original: string;
    normalized: string;
    tokens: string[];
    consumed: boolean;
  }

  interface KeywordCandidate {
    original: string;
    normalized: string;
    tokens: string[];
  }

  const labelCandidates: LabelCandidate[] = detectedLabels.map(l => {
    const norm = cleanAndNormalize(l);
    return {
      original: l,
      normalized: norm,
      tokens: norm.split(" ").map(normalizeWord).filter(t => t.length > 2),
      consumed: false
    };
  });

  const keywordCandidates: KeywordCandidate[] = detectedKeywords.map(k => {
    const norm = cleanAndNormalize(k);
    return {
      original: k,
      normalized: norm,
      tokens: norm.split(" ").map(normalizeWord).filter(t => t.length > 2)
    };
  });

  function isAcceptableLabelMatch(
    expectedNorm: string,
    expectedTokens: string[],
    candidateNorm: string,
    candidateTokens: string[]
  ): { matched: boolean; method: "substring" | "tokenOverlap" } | null {
    if (expectedNorm.length > 2 && candidateNorm.length > 2) {
      const escapedExpected = expectedNorm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex1 = new RegExp(`\\b${escapedExpected}\\b`);
      if (regex1.test(candidateNorm)) {
        return { matched: true, method: "substring" };
      }
      
      const escapedCandidate = candidateNorm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex2 = new RegExp(`\\b${escapedCandidate}\\b`);
      if (regex2.test(expectedNorm)) {
        return { matched: true, method: "substring" };
      }
    }

    if (expectedTokens.length > 0 && candidateTokens.length > 0) {
      const overlap = expectedTokens.some(et => candidateTokens.includes(et));
      if (overlap) {
        return { matched: true, method: "tokenOverlap" };
      }
    }

    return null;
  }

  // Phase 1: Exact matches for expected labels
  const unresolvedExpected: Array<{
    original: string;
    normalized: string;
    tokens: string[];
  }> = [];

  for (const expected of expectedLabels) {
    const expectedNorm = cleanAndNormalize(expected);
    const expectedTokens = expectedNorm.split(" ").map(normalizeWord).filter(t => t.length > 2);

    const exactMatchCandidate = labelCandidates.find(
      c => !c.consumed && c.normalized === expectedNorm
    );

    if (exactMatchCandidate) {
      exactMatchCandidate.consumed = true;
      exact.push(expected);
      matches.push({
        expected,
        detected: exactMatchCandidate.original,
        status: "exact",
        method: "exact",
        source: "visibleElementLabel"
      });
    } else {
      unresolvedExpected.push({
        original: expected,
        normalized: expectedNorm,
        tokens: expectedTokens
      });
    }
  }

  // Phase 2: Alias matches for remaining expected labels
  const stillUnresolved: typeof unresolvedExpected = [];

  for (const item of unresolvedExpected) {
    let foundAlias = false;
    const aliases = expectedVisibleElementLabelAliases?.[item.original] || [];

    for (const alias of aliases) {
      const aliasNorm = cleanAndNormalize(alias);
      const aliasMatchCandidate = labelCandidates.find(
        c => !c.consumed && c.normalized === aliasNorm
      );

      if (aliasMatchCandidate) {
        aliasMatchCandidate.consumed = true;
        acceptable.push(item.original);
        matches.push({
          expected: item.original,
          detected: aliasMatchCandidate.original,
          status: "acceptable",
          method: "alias",
          source: "visibleElementLabel"
        });
        foundAlias = true;
        break;
      }
    }

    if (!foundAlias) {
      stillUnresolved.push(item);
    }
  }

  // Phase 3: Substring / Token Overlap matching on Label Candidates
  const unresolvedAfterLabelMatching: typeof unresolvedExpected = [];

  for (const item of stillUnresolved) {
    let foundMatch = false;

    for (const cand of labelCandidates) {
      if (cand.consumed) continue;

      const matchRes = isAcceptableLabelMatch(
        item.normalized,
        item.tokens,
        cand.normalized,
        cand.tokens
      );

      if (matchRes) {
        cand.consumed = true;
        acceptable.push(item.original);
        matches.push({
          expected: item.original,
          detected: cand.original,
          status: "acceptable",
          method: matchRes.method,
          source: "visibleElementLabel"
        });
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      unresolvedAfterLabelMatching.push(item);
    }
  }

  // Phase 4: Keyword matching on Keyword Candidates
  for (const item of unresolvedAfterLabelMatching) {
    let foundMatch = false;

    for (const cand of keywordCandidates) {
      const matchRes = isAcceptableLabelMatch(
        item.normalized,
        item.tokens,
        cand.normalized,
        cand.tokens
      );

      if (matchRes) {
        acceptable.push(item.original);
        matches.push({
          expected: item.original,
          detected: cand.original,
          status: "acceptable",
          method: "keyword",
          source: "keyword"
        });
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      missing.push(item.original);
    }
  }

  const extra = labelCandidates
    .filter(c => !c.consumed)
    .map(c => c.original);

  return { exact, acceptable, missing, extra, matches };
}

export function compareExpectedVisibleText(sample: any, detectedText: string[]): {
  matched: string[];
  missing: string[];
} {
  const matched: string[] = [];
  const missing: string[] = [];
  const expectedText = sample.expectedVisibleText || sample.visibleText || [];
  
  const allDetected = detectedText.join(" ").toLowerCase();

  for (const expected of expectedText) {
    if (allDetected.includes(expected.toLowerCase())) {
      matched.push(expected);
    } else {
      missing.push(expected);
    }
  }

  return { matched, missing };
}

export interface PublicSampleComparisonSummary {
  imageKind: {
    expected: string;
    detected?: string;
    status: "exact" | "acceptable" | "diverged";
    details?: string;
  };
  categories: {
    matched: string[];
    acceptable: string[];
    missing: string[];
    extra: string[];
    matches?: Array<{
      expected: string;
      detected: string;
      status: "exact" | "acceptable";
      method: "exact" | "softEquivalence" | "alias";
    }>;
  };
  labels: {
    matched: string[];
    acceptable: string[];
    missing: string[];
    extra: string[];
    matches?: Array<{
      expected: string;
      detected: string;
      status: "exact" | "acceptable";
      method: "exact" | "alias" | "substring" | "tokenOverlap" | "keyword";
      source?: "visibleElementLabel" | "keyword";
    }>;
  };
  visibleText: {
    matched: string[];
    missing: string[];
    extra?: string[];
  };
  overallStatus: "pass" | "warning" | "fail";
  reasons: string[];
  reviewStatus: "pass" | "needsReview" | "fail";
  reviewReasons: string[];
}

export function evaluateSampleComparison(sample: PublicVisualSample, result: any): PublicSampleComparisonSummary {
  const vi = result.visualAnalysis?.visualInfo;
  
  const expectedImageKind = sample.expectedImageKind || (sample as any).imageKind;
  const kindDetected = vi?.imageKind;
  const kindResult = compareExpectedImageKind(sample, kindDetected);
  
  const detectedCategories = vi?.visibleElements?.map((el: any) => el.category) || [];
  const categoriesResult = compareExpectedCategories(sample, detectedCategories);
  
  const detectedLabels = vi?.visibleElements?.map((el: any) => el.label) || [];
  const detectedKeywords = result.visualAnalysis?.indexing?.keywords?.map((kw: any) => typeof kw === 'string' ? kw : kw?.value || "") || [];
  const labelsResult = compareExpectedLabels(sample, detectedLabels, detectedKeywords);
  
  const detectedText = vi?.visibleText?.map((txt: any) => typeof txt === 'string' ? txt : txt?.text || "") || [];
  const visibleTextResult = compareExpectedVisibleText(sample, detectedText);
  
  let overallStatus: "pass" | "warning" | "fail" = "pass";
  const reasons: string[] = [];

  if (kindResult.status === "diverged") {
    overallStatus = "fail";
    reasons.push(`imageKind diverged: expected ${expectedImageKind}, detected ${kindDetected}`);
  } else if (kindResult.status === "acceptable") {
    reasons.push(`imageKind acceptable: expected ${expectedImageKind}, detected ${kindDetected}`);
  }

  if (visibleTextResult.missing.length > 0) {
    overallStatus = "fail";
    visibleTextResult.missing.forEach(txt => reasons.push(`missing expected visible text: ${txt}`));
  }

  if (categoriesResult.missing.length > 0) {
    if (overallStatus === "pass") overallStatus = "warning";
    categoriesResult.missing.forEach(cat => reasons.push(`missing expected category: ${cat}`));
  }

  if (labelsResult.missing.length > 0) {
    if (overallStatus === "pass") overallStatus = "warning";
    labelsResult.missing.forEach(label => reasons.push(`missing expected label: ${label}`));
  }

  let reviewStatus: "pass" | "needsReview" | "fail" = "pass";
  const reviewReasons: string[] = [];

  if (kindResult.status === "diverged") {
    reviewStatus = "needsReview";
    reviewReasons.push(`imageKind diverged: expected ${expectedImageKind}, detected ${kindDetected}`);
  } else if (kindResult.status === "acceptable") {
    reviewReasons.push(`imageKind acceptable: expected ${expectedImageKind}, detected ${kindDetected}`);
  }

  if (categoriesResult.missing.length > 0) {
    if (reviewStatus === "pass") {
      reviewStatus = "needsReview";
    }
    categoriesResult.missing.forEach(cat => reviewReasons.push(`missing expected category: ${cat}`));
  }

  if (labelsResult.missing.length > 0) {
    if (reviewStatus === "pass") {
      reviewStatus = "needsReview";
    }
    labelsResult.missing.forEach(label => reviewReasons.push(`missing expected label: ${label}`));
  }

  if (visibleTextResult.missing.length > 0) {
    reviewStatus = "fail";
    visibleTextResult.missing.forEach(txt => reviewReasons.push(`missing expected visible text: ${txt}`));
  }

  return {
    imageKind: {
      expected: expectedImageKind,
      detected: kindDetected,
      status: kindResult.status,
      details: kindResult.details
    },
    categories: {
      matched: categoriesResult.exact,
      acceptable: categoriesResult.acceptable,
      missing: categoriesResult.missing,
      extra: categoriesResult.extra,
      matches: categoriesResult.matches
    },
    labels: {
      matched: labelsResult.exact,
      acceptable: labelsResult.acceptable,
      missing: labelsResult.missing,
      extra: labelsResult.extra,
      matches: labelsResult.matches
    },
    visibleText: {
      matched: visibleTextResult.matched,
      missing: visibleTextResult.missing
    },
    overallStatus,
    reasons,
    reviewStatus,
    reviewReasons
  };
}
