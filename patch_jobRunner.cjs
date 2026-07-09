const fs = require('fs');
let content = fs.readFileSync('src/lib/visualAnalysis/serverJobs/jobRunner.ts', 'utf8');

content = content.replace(
  /counters\.failureCount\+\+;\s*counters\.reviewFailCount\+\+;/,
  `counters.failureCount++;\n      counters.reviewFailCount++;\n      counters.expectedComparisonFailCount++;`
);

fs.writeFileSync('src/lib/visualAnalysis/serverJobs/jobRunner.ts', content);
