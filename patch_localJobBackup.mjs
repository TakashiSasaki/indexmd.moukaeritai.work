import fs from 'fs';

let content = fs.readFileSync('src/lib/visualAnalysis/serverJobs/localJobBackup.ts', 'utf-8');

// 1. Add LOCAL_STORAGE_BUNDLE_KEY_PREFIX
content = content.replace(
  "const LOCAL_STORAGE_KEY_PREFIX = 'visual_analysis_server_job_backup_';",
  "const LOCAL_STORAGE_KEY_PREFIX = 'visual_analysis_server_job_backup_';\nconst LOCAL_STORAGE_BUNDLE_KEY_PREFIX = 'visual_analysis_server_job_bundle_';"
);

// 2. Modify saveLocalJobBackup
content = content.replace(
  /export function saveLocalJobBackup[\s\S]*?export function listLocalJobBackups/g,
  `export function saveLocalJobBackup(job: any, bundle?: any) {
  const storage = getStorage();
  if (!storage) return false;

  const backup = buildLocalJobBackupMetadata(job);
  const metadataKey = \`\${LOCAL_STORAGE_KEY_PREFIX}\${job.jobId}\`;
  const bundleKey = \`\${LOCAL_STORAGE_BUNDLE_KEY_PREFIX}\${job.jobId}\`;

  if (!bundle) {
    try {
      const existing = storage.getItem(metadataKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed && parsed.bundleStored) {
          backup.bundleStored = true;
          // check if bundle is still inline (migration case)
          if (parsed.bundle) {
            storage.setItem(bundleKey, JSON.stringify(parsed.bundle));
          }
        }
      }
    } catch (e) { }
  }

  if (bundle) {
    let safeBundle;
    try { safeBundle = sanitizeBundle(bundle); } catch (e) { backup.notStoredReason = 'sanitizationError'; }
    if (safeBundle) {
      try {
        const bundleStr = JSON.stringify(safeBundle);
        if (bundleStr.length <= MAX_BUNDLE_SIZE_BYTES) {
           backup.bundleStored = true;
           storage.setItem(bundleKey, bundleStr);
        } else {
           backup.notStoredReason = 'localStorageQuotaOrSizeLimit';
        }
      } catch (e) { backup.notStoredReason = 'serializationError'; }
    }
  }

  try {
    storage.setItem(metadataKey, JSON.stringify(backup));
    enforceMaxBackups();
    return true;
  } catch (e) {
    console.warn('Failed to save local job backup', e);
    if (backup.bundleStored) {
      backup.bundleStored = false;
      storage.removeItem(bundleKey);
      backup.notStoredReason = 'localStorageQuotaOrSizeLimit';
      try { storage.setItem(metadataKey, JSON.stringify(backup)); return true; } catch (e2) {}
    }
    return false;
  }
}

export function listLocalJobBackups`
);

// 3. Modify listLocalJobBackups to handle migration
content = content.replace(
  /export function listLocalJobBackups[\s\S]*?export function getLocalJobBackup/g,
  `export function listLocalJobBackups(): LocalJobBackup[] {
  const storage = getStorage();
  if (!storage) return [];

  const backups: LocalJobBackup[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX)) {
      try {
        const value = storage.getItem(key);
        if (value) {
          const backup = JSON.parse(value) as LocalJobBackup;
          if (backup && backup.jobId) {
             const { bundle, ...meta } = backup;
             if (bundle) {
               // Migrate inline bundle to separate key
               try {
                 storage.setItem(\`\${LOCAL_STORAGE_BUNDLE_KEY_PREFIX}\${backup.jobId}\`, JSON.stringify(bundle));
                 storage.setItem(key, JSON.stringify(meta));
               } catch (e) { }
             }
             backups.push(meta);
          }
        }
      } catch (e) { }
    }
  }
  return backups.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

export function getLocalJobBackup`
);

// 4. Modify getLocalJobBackup to fetch bundle from separate key or fallback to inline
content = content.replace(
  /export function getLocalJobBackup[\s\S]*?export function removeLocalJobBackup/g,
  `export function getLocalJobBackup(jobId: string): LocalJobBackup | null {
  const storage = getStorage();
  if (!storage) return null;

  const key = \`\${LOCAL_STORAGE_KEY_PREFIX}\${jobId}\`;
  const bundleKey = \`\${LOCAL_STORAGE_BUNDLE_KEY_PREFIX}\${jobId}\`;
  try {
    const value = storage.getItem(key);
    if (value) {
      const parsed = JSON.parse(value) as LocalJobBackup;
      if (parsed.bundleStored && !parsed.bundle) {
         const bundleStr = storage.getItem(bundleKey);
         if (bundleStr) {
           parsed.bundle = JSON.parse(bundleStr);
         }
      }
      return parsed;
    }
  } catch (e) { }
  return null;
}

export function removeLocalJobBackup`
);

// 5. Modify removeLocalJobBackup to remove both
content = content.replace(
  /export function removeLocalJobBackup\(jobId: string\) \{[\s\S]*?function enforceMaxBackups/g,
  `export function removeLocalJobBackup(jobId: string) {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(\`\${LOCAL_STORAGE_KEY_PREFIX}\${jobId}\`);
  storage.removeItem(\`\${LOCAL_STORAGE_BUNDLE_KEY_PREFIX}\${jobId}\`);
}

function enforceMaxBackups`
);

fs.writeFileSync('src/lib/visualAnalysis/serverJobs/localJobBackup.ts', content);
