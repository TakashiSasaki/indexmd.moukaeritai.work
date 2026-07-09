const fs = require('fs');
let content = fs.readFileSync('src/components/ImageExperiment.tsx', 'utf8');

content = content.replace(
  /failureCount\+\+;\s*reviewFailCount\+\+;\s*newStatuses\[sample\.id\] = "failure";/g,
  `failureCount++;
                reviewFailCount++;
                expectedComparisonFailCount++;
                newStatuses[sample.id] = "failure";`
);

fs.writeFileSync('src/components/ImageExperiment.tsx', content);
