const fs = require('fs');
let content = fs.readFileSync('src/components/ImageExperiment.tsx', 'utf8');

content = content.replace(
  /failureCount\+\+;\s*reviewFailCount\+\+;/,
  `failureCount++;\n          reviewFailCount++;\n          expectedComparisonFailCount++;`
);

fs.writeFileSync('src/components/ImageExperiment.tsx', content);
