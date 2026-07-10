const fs = require('fs');

// Fix 1: Update the selected job after override refreshes
// Fix 3: Pass the backup bundle as the download payload in correct order
let iePath = 'src/components/ImageExperiment.tsx';
let ieContent = fs.readFileSync(iePath, 'utf8');

const ieTarget1 = `      if (targetJobId === serverJobId) {
        setServerJobStatus(data.job);
        setServerJobComputedState(data.computedState ?? null);
        setServerJobItemsPreview(data.itemsPreview ?? []);
      } else {
        // If refreshing a non-selected job, we just fetch it to save backup
      }`;
const ieRep1 = `      if (targetJobId === serverJobId || overrideJobId) {
        setServerJobStatus(data.job);
        setServerJobComputedState(data.computedState ?? null);
        setServerJobItemsPreview(data.itemsPreview ?? []);
      } else {
        // If refreshing a non-selected job, we just fetch it to save backup
      }`;
ieContent = ieContent.replace(ieTarget1, ieRep1);

const ieTarget3 = `downloadJsonArtifact(\`visual-analysis-analysis-bundle-\${jobId}.json\`, JSON.stringify(backup.bundle, null, 2));`;
const ieRep3 = `downloadJsonArtifact(JSON.stringify(backup.bundle, null, 2), \`visual-analysis-analysis-bundle-\${jobId}.json\`);`;
ieContent = ieContent.replace(ieTarget3, ieRep3);

fs.writeFileSync(iePath, ieContent);

// Fix 2: Preserve stored bundles until replacement succeeds
let ljbPath = 'src/lib/visualAnalysis/serverJobs/localJobBackup.ts';
let ljbContent = fs.readFileSync(ljbPath, 'utf8');

const ljbTarget = `  const backup = buildLocalJobBackupMetadata(job);

  if (bundle) {`;
const ljbRep = `  const backup = buildLocalJobBackupMetadata(job);

  if (bundle) {`;

// Let's rewrite the logic inside saveLocalJobBackup to preserve existing bundle if we didn't pass one but the existing backup has one
// Wait, if I fetch the existing backup metadata BEFORE we replace it...
