const fs = require('fs');

let ljbPath = 'src/lib/visualAnalysis/serverJobs/localJobBackup.ts';
let ljbContent = fs.readFileSync(ljbPath, 'utf8');

const toReplace = `  const backup = buildLocalJobBackupMetadata(job);

  if (bundle) {
    let safeBundle;`;

const replacement = `  const backup = buildLocalJobBackupMetadata(job);

  if (!bundle) {
    // If saving metadata only, try to preserve any existing bundle
    try {
      const key = \`\${LOCAL_STORAGE_KEY_PREFIX}\${job.jobId}\`;
      const existing = storage.getItem(key);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed && parsed.bundleStored && parsed.bundle) {
          backup.bundleStored = true;
          backup.bundle = parsed.bundle;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (bundle) {
    let safeBundle;`;

ljbContent = ljbContent.replace(toReplace, replacement);
fs.writeFileSync(ljbPath, ljbContent);
