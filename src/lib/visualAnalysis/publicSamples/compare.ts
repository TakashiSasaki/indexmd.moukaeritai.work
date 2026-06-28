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
} {
  const exact: string[] = [];
  const acceptable: string[] = [];
  const missing: string[] = [];
  const uniqueDetected = Array.from(new Set(detectedCategories));
  const extra: string[] = [...uniqueDetected];

  const expectedElementCategories = sample.expectedElementCategories || sample.elementCategories || [];
  const expectedElementCategoryAlternatives = sample.expectedElementCategoryAlternatives || sample.elementCategoryAlternatives;

  for (const expected of expectedElementCategories) {
    // Check landscapeElement soft equivalence
    if (expected === "landscapeElement") {
      const landscapeEquivalents = ["terrain", "plant", "waterBody", "weatherOrSky", "roadOrPath"];
      let foundEq = false;
      for (const eq of landscapeEquivalents) {
        const eqIdx = extra.indexOf(eq);
        if (eqIdx !== -1) {
          acceptable.push(eq);
          extra.splice(eqIdx, 1);
          foundEq = true;
          break;
        }
      }
      if (foundEq) continue;
    }

    const idx = extra.indexOf(expected);
    if (idx !== -1) {
      exact.push(expected);
      extra.splice(idx, 1);
      continue;
    }

    let foundAlternative = false;
    if (expectedElementCategoryAlternatives && expectedElementCategoryAlternatives[expected]) {
      for (const alt of expectedElementCategoryAlternatives[expected]) {
        const altIdx = extra.indexOf(alt);
        if (altIdx !== -1) {
          acceptable.push(alt); // found an acceptable alternative
          extra.splice(altIdx, 1);
          foundAlternative = true;
          break;
        }
      }
    }

    if (!foundAlternative) {
      missing.push(expected);
    }
  }

  return { exact, acceptable, missing, extra };
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
  }> = [];

  const extra = [...detectedLabels.map(l => l.toLowerCase())];
  const expectedLabels = sample.expectedVisibleElementLabels || sample.visibleElementLabels || [];
  const expectedVisibleElementLabelAliases = sample.expectedVisibleElementLabelAliases || sample.visibleElementLabelAliases;

  function normalizeWord(word: string): string {
    let w = word.trim().toLowerCase();
    if (w.endsWith('s') && w.length > 3) {
      w = w.slice(0, -1);
    }
    return w;
  }

  function hasTokenOverlap(expected: string, detected: string): boolean {
    const expTokens = expected.toLowerCase().split(/\s+/).map(normalizeWord).filter(Boolean);
    const detTokens = detected.toLowerCase().split(/\s+/).map(normalizeWord).filter(Boolean);
    return expTokens.some(t1 => detTokens.some(t2 => t1 === t2 || t1.includes(t2) || t2.includes(t1)));
  }

  for (const expected of expectedLabels) {
    const expectedLower = expected.toLowerCase();

    // 1. Exact Match
    const exactIdx = extra.indexOf(expectedLower);
    if (exactIdx !== -1) {
      exact.push(expected);
      const originalDetected = detectedLabels[exactIdx] || expectedLower;
      matches.push({
        expected,
        detected: originalDetected,
        status: "exact",
        method: "exact"
      });
      extra.splice(exactIdx, 1);
      continue;
    }

    let foundMatch = false;

    // 2. Alias Match
    if (expectedVisibleElementLabelAliases && expectedVisibleElementLabelAliases[expected]) {
      for (const alt of expectedVisibleElementLabelAliases[expected]) {
        const altLower = alt.toLowerCase();
        const altIdx = extra.findIndex(e => e === altLower || e.includes(altLower));
        if (altIdx !== -1) {
          const originalDetected = detectedLabels[altIdx] || extra[altIdx];
          acceptable.push(originalDetected);
          matches.push({
            expected,
            detected: originalDetected,
            status: "acceptable",
            method: "alias"
          });
          extra.splice(altIdx, 1);
          foundMatch = true;
          break;
        }
      }
    }
    if (foundMatch) continue;

    // 3. Substring Match
    const subIdx = extra.findIndex(e => {
      const normE = normalizeWord(e);
      const normExp = normalizeWord(expectedLower);
      return normE === normExp || normE.includes(normExp) || normExp.includes(normE) || e.includes(expectedLower) || expectedLower.includes(e);
    });
    if (subIdx !== -1) {
      const originalDetected = detectedLabels[subIdx] || extra[subIdx];
      acceptable.push(originalDetected);
      matches.push({
        expected,
        detected: originalDetected,
        status: "acceptable",
        method: "substring"
      });
      extra.splice(subIdx, 1);
      continue;
    }

    // 4. Token Overlap Match
    const tokIdx = extra.findIndex(e => hasTokenOverlap(expectedLower, e));
    if (tokIdx !== -1) {
      const originalDetected = detectedLabels[tokIdx] || extra[tokIdx];
      acceptable.push(originalDetected);
      matches.push({
        expected,
        detected: originalDetected,
        status: "acceptable",
        method: "tokenOverlap"
      });
      extra.splice(tokIdx, 1);
      continue;
    }

    // 5. Keyword Match
    const kwIdx = detectedKeywords.findIndex(kw => {
      const kwLower = kw.toLowerCase();
      const normKw = normalizeWord(kwLower);
      const normExp = normalizeWord(expectedLower);
      return normKw === normExp || normKw.includes(normExp) || normExp.includes(normKw) || kwLower.includes(expectedLower) || expectedLower.includes(kwLower) || hasTokenOverlap(expectedLower, kwLower);
    });
    if (kwIdx !== -1) {
      const matchedKw = detectedKeywords[kwIdx];
      acceptable.push(matchedKw);
      matches.push({
        expected,
        detected: matchedKw,
        status: "acceptable",
        method: "keyword"
      });
      continue;
    }

    missing.push(expected);
  }

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
      extra: categoriesResult.extra
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
