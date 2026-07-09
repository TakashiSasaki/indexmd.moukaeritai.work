const fs = require('fs');
let content = fs.readFileSync('src/lib/visualAnalysis/publicSamples/reportBuilder.ts', 'utf8');

content = content.replace(
  /const report = \{/,
  `const generationFailureCount = normalizedItems.filter(i => !i.success).length;
  const comparisonOnlyFailCount = normalizedItems.filter(i => i.success && i.comparison?.overallStatus === 'fail').length;
  const notComparableCount = normalizedItems.filter(i => i.success && !i.comparison).length;

  const report = {`
);

content = content.replace(
  /invalidJsonCount: batchSummary\.invalidJsonCount,/,
  `invalidJsonCount: batchSummary.invalidJsonCount,
    generationFailureCount,
    comparisonOnlyFailCount,
    notComparableCount,
    jobStatus: batchSummary.jobStatus,
    isComplete: batchSummary.isComplete,
    completedCount: batchSummary.completedCount,
    pendingCount: batchSummary.pendingCount,
    processedCount: batchSummary.processedCount,`
);

fs.writeFileSync('src/lib/visualAnalysis/publicSamples/reportBuilder.ts', content);
