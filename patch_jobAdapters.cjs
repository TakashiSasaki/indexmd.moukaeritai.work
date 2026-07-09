const fs = require('fs');
let content = fs.readFileSync('src/lib/visualAnalysis/serverJobs/jobAdapters.ts', 'utf8');

content = content.replace(
  /return \{/,
  `return {
    jobStatus: job.status,
    completedCount: job.counters.successCount,
    pendingCount: job.targetSampleIds.length - job.counters.successCount - job.counters.failureCount,
    processedCount: job.counters.successCount + job.counters.failureCount,
    isComplete: job.status === 'completed' || job.status === 'canceled' || job.status === 'failed',
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    durationMs: job.durationMs,`
);

fs.writeFileSync('src/lib/visualAnalysis/serverJobs/jobAdapters.ts', content);
