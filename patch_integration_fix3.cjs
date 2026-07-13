const fs = require('fs');

let content = fs.readFileSync('tests/integration/publicExecution.test.ts', 'utf8');

// The integration test had an issue: `Expected values to be strictly equal: + undefined - 'completed'`

content = content.replace(
  `// Allow runner state to persist fully
    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(finalStatusRes.body.job?.status, "completed");`,
  `// Wait up to 2 seconds for runner to finish
    let retries = 20;
    while (retries-- > 0) {
      const res = await request(app).get(\`/api/visual/batch-jobs/\${jobId}\`);
      if (res.body.job?.status === "completed" || res.body.job?.status === "failed" || res.body.job?.status === "canceled") break;
      await new Promise(r => setTimeout(r, 100));
    }
    const finalPollRes = await request(app).get(\`/api/visual/batch-jobs/\${jobId}\`);
    assert.strictEqual(finalPollRes.body.job?.status, "completed");`
);

// We should also replace the previous `if (finalStatusRes.body.job?.status !== "completed") {`
content = content.replace(
  `if (finalStatusRes.body.job?.status !== "completed") {
      console.log('Got response body:', finalStatusRes.body);
    }
    assert.strictEqual(finalStatusRes.body.job?.status, "completed");`,
  `// Wait up to 2 seconds for runner to finish
    let retries = 20;
    while (retries-- > 0) {
      const res = await request(app).get(\`/api/visual/batch-jobs/\${jobId}\`);
      if (res.body.job?.status === "completed" || res.body.job?.status === "failed" || res.body.job?.status === "canceled") break;
      await new Promise(r => setTimeout(r, 100));
    }
    const finalPollRes = await request(app).get(\`/api/visual/batch-jobs/\${jobId}\`);
    assert.strictEqual(finalPollRes.body.job?.status, "completed");`
);

fs.writeFileSync('tests/integration/publicExecution.test.ts', content);
