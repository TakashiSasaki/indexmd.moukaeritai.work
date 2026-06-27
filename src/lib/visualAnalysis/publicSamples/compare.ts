import { PublicVisualSample } from './types';
import { VisualAnalysisResultV1, VisualAnalysisResultV2 } from '../types';

export interface ComparisonResult {
  status: "exact" | "acceptable" | "diverged";
  details?: string;
}

export function compareExpectedImageKind(sample: PublicVisualSample, detectedKind?: string): ComparisonResult {
  if (!detectedKind) return { status: "diverged", details: "No image kind detected." };
  
  if (detectedKind === sample.expectedImageKind) {
    return { status: "exact" };
  }
  
  // Some acceptable overlaps
  if (sample.expectedImageKind === 'productPhoto' && detectedKind === 'packageImage') return { status: "acceptable" };
  if (sample.expectedImageKind === 'documentPhoto' && detectedKind === 'handwrittenNote') return { status: "acceptable" };
  if (sample.expectedImageKind === 'documentPhoto' && detectedKind === 'receiptPhoto') return { status: "acceptable" };

  return { status: "diverged", details: `Expected ${sample.expectedImageKind}, got ${detectedKind}` };
}

export function compareExpectedCategories(sample: PublicVisualSample, detectedCategories: string[]): {
  exact: string[];
  acceptable: string[];
  missing: string[];
  extra: string[];
} {
  const exact: string[] = [];
  const acceptable: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [...detectedCategories];

  for (const expected of sample.expectedElementCategories) {
    const idx = extra.indexOf(expected);
    if (idx !== -1) {
      exact.push(expected);
      extra.splice(idx, 1);
      continue;
    }

    let foundAlternative = false;
    if (sample.expectedElementCategoryAlternatives && sample.expectedElementCategoryAlternatives[expected]) {
      for (const alt of sample.expectedElementCategoryAlternatives[expected]) {
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

export function compareExpectedLabels(sample: PublicVisualSample, detectedLabels: string[]): {
  exact: string[];
  acceptable: string[];
  missing: string[];
  extra: string[];
} {
  const exact: string[] = [];
  const acceptable: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [...detectedLabels.map(l => l.toLowerCase())];
  const expectedLabels = sample.expectedVisibleElementLabels || [];

  for (const expected of expectedLabels) {
    const expectedLower = expected.toLowerCase();
    const idx = extra.indexOf(expectedLower);
    if (idx !== -1) {
      exact.push(expected);
      extra.splice(idx, 1);
      continue;
    }

    let foundAlternative = false;
    if (sample.expectedVisibleElementLabelAliases && sample.expectedVisibleElementLabelAliases[expected]) {
      for (const alt of sample.expectedVisibleElementLabelAliases[expected]) {
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

export function compareExpectedVisibleText(sample: PublicVisualSample, detectedText: string[]): {
  matched: string[];
  missing: string[];
} {
  const matched: string[] = [];
  const missing: string[] = [];
  const expectedText = sample.expectedVisibleText || [];
  
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
