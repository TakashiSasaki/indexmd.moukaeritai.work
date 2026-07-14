const fs = require('fs');

let content = fs.readFileSync('src/lib/visualAnalysis/serverJobs/jobRunner.ts', 'utf8');

// src/lib/visualAnalysis/serverJobs/jobRunner.ts(353,15): error TS2322: Type '"providerUnavailableWaiting"' is not assignable to type '"jobCreated" | "jobQueued" | "jobStarted" | "healthCheckStarted" | "healthCheckPassed" | "healthCheckFailed" | "sampleStarted" | "apiRequestStarted" | "apiResponseReceived" | ... 21 more ... | "batchCompleted"'.

content = content.replace(
  `type: 'providerUnavailableWaiting'`,
  `type: 'quotaBackoffWaiting'` // using an existing event type string from batchTypes.ts
);

fs.writeFileSync('src/lib/visualAnalysis/serverJobs/jobRunner.ts', content);
