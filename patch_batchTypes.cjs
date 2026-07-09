const fs = require('fs');
let content = fs.readFileSync('src/lib/visualAnalysis/publicSamples/batchTypes.ts', 'utf8');
content = content.replace(
  /export interface PublicSampleBatchRunSummary \{/,
  `export interface PublicSampleBatchRunSummary {
  jobStatus?: string;
  completedCount?: number;
  pendingCount?: number;
  processedCount?: number;
  isComplete?: boolean;`
);
fs.writeFileSync('src/lib/visualAnalysis/publicSamples/batchTypes.ts', content);
