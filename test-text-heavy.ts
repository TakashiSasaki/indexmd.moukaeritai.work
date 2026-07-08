export function buildTextHeavyEvaluationSummary(items: any[]) {
  let expectedVisibleTextTotal = 0;
  let visibleTextCovered = 0;
  let textMissing = 0;
  let itemsWithTextExpectation = 0;
  
  for (const item of items) {
    const coverage = item.comparison?.coverage?.visibleText;
    if (coverage && coverage.expectedTotal > 0) {
      itemsWithTextExpectation++;
      expectedVisibleTextTotal += coverage.expectedTotal;
      visibleTextCovered += coverage.covered;
      textMissing += coverage.missing;
    }
  }

  const ratio = expectedVisibleTextTotal > 0 ? parseFloat((visibleTextCovered / expectedVisibleTextTotal).toFixed(2)) : 1.0;

  return {
    itemsWithTextExpectation,
    expectedVisibleTextTotal,
    visibleTextCovered,
    textMissing,
    ratio,
    mediaResolutionRequested: items[0]?.generationDiagnostics?.mediaResolution || "unknown"
  };
}
