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
  const extra: string[] = [...detectedCategories];

  const expectedElementCategories = sample.expectedElementCategories || sample.elementCategories || [];
  const expectedElementCategoryAlternatives = sample.expectedElementCategoryAlternatives || sample.elementCategoryAlternatives;

  for (const expected of expectedElementCategories) {
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

export function compareExpectedLabels(sample: any, detectedLabels: string[]): {
  exact: string[];
  acceptable: string[];
  missing: string[];
  extra: string[];
} {
  const exact: string[] = [];
  const acceptable: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [...detectedLabels.map(l => l.toLowerCase())];
  const expectedLabels = sample.expectedVisibleElementLabels || sample.visibleElementLabels || [];
  const expectedVisibleElementLabelAliases = sample.expectedVisibleElementLabelAliases || sample.visibleElementLabelAliases;

  for (const expected of expectedLabels) {
    const expectedLower = expected.toLowerCase();
    const idx = extra.indexOf(expectedLower);
    if (idx !== -1) {
      exact.push(expected);
      extra.splice(idx, 1);
      continue;
    }

    let foundAlternative = false;
    if (expectedVisibleElementLabelAliases && expectedVisibleElementLabelAliases[expected]) {
      for (const alt of expectedVisibleElementLabelAliases[expected]) {
        const altLower = alt.toLowerCase();
        
        // Find if any extra label contains this alias or matches it
        const altIdx = extra.findIndex(e => e === altLower || e.includes(altLower));
        
        if (altIdx !== -1) {
          acceptable.push(extra[altIdx]);
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
    exact: string[];
    acceptable: string[];
    missing: string[];
    extra: string[];
  };
  labels: {
    exact: string[];
    acceptable: string[];
    missing: string[];
    extra: string[];
  };
  visibleText: {
    matched: string[];
    missing: string[];
  };
  overallStatus: "pass" | "warning" | "fail";
}

export function evaluateSampleComparison(sample: PublicVisualSample, result: any): PublicSampleComparisonSummary {
  const vi = result.visualAnalysis?.visualInfo;
  
  const expectedImageKind = sample.expectedImageKind || (sample as any).imageKind;
  const kindDetected = vi?.imageKind;
  const kindResult = compareExpectedImageKind(sample, kindDetected);
  
  const detectedCategories = vi?.visibleElements?.map((el: any) => el.category) || [];
  const categoriesResult = compareExpectedCategories(sample, detectedCategories);
  
  const detectedLabels = vi?.visibleElements?.map((el: any) => el.label) || [];
  const labelsResult = compareExpectedLabels(sample, detectedLabels);
  
  const detectedText = vi?.visibleText?.map((txt: any) => typeof txt === 'string' ? txt : txt?.text || "") || [];
  const visibleTextResult = compareExpectedVisibleText(sample, detectedText);
  
  let overallStatus: "pass" | "warning" | "fail" = "pass";
  if (kindResult.status === "diverged" || visibleTextResult.missing.length > 0) {
    overallStatus = "fail";
  } else if (kindResult.status === "acceptable" || categoriesResult.missing.length > 0 || labelsResult.missing.length > 0) {
    overallStatus = "warning";
  }

  return {
    imageKind: {
      expected: expectedImageKind,
      detected: kindDetected,
      status: kindResult.status,
      details: kindResult.details
    },
    categories: {
      exact: categoriesResult.exact,
      acceptable: categoriesResult.acceptable,
      missing: categoriesResult.missing,
      extra: categoriesResult.extra
    },
    labels: {
      exact: labelsResult.exact,
      acceptable: labelsResult.acceptable,
      missing: labelsResult.missing,
      extra: labelsResult.extra
    },
    visibleText: {
      matched: visibleTextResult.matched,
      missing: visibleTextResult.missing
    },
    overallStatus
  };
}
