const LOCAL_STORAGE_KEY_PREFIX = 'visual_analysis_server_job_backup_';
const MAX_BACKUPS = 10;
const MAX_BUNDLE_SIZE_BYTES = 4.5 * 1024 * 1024; // 4.5 MB, leaving some room for overhead

export interface LocalJobBackup {
  jobId: string;
  status: string;
  modelName: string;
  jsonMode: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;
  counters: {
    total: number;
    processed: number;
    success: number;
    failure: number;
  };
  processedCount: number;
  total: number;
  savedAt: string;
  bundleStored: boolean;
  notStoredReason?: string;
  bundle?: any;
  bundleRevision?: number;
}

const SECRET_KEY_PATTERN = /(authorization|proxy-authorization|cookie|set-cookie|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|credential|request[-_ ]?headers|request[-_ ]?preview|raw[-_ ]?request|raw[-_ ]?response|bodyPreview|rawMessageSummary|errorMessageSummary)/i;
const SECRET_VALUE_PATTERN = /(Bearer\s+[A-Za-z0-9._~+/=-]+)|([?&](key|api_key|access_token|refresh_token|id_token|token|credential|signature)=)[^&\s]+/gi;

export function sanitizeForLocalJobBackup(value: any): any {
  if (Array.isArray(value)) return value.map(v => sanitizeForLocalJobBackup(v));
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) continue;
      out[key] = sanitizeForLocalJobBackup(child);
    }
    return out;
  }
  if (typeof value === 'string') {
    return value.replace(SECRET_VALUE_PATTERN, (_match, bearer, queryPrefix) => bearer ? '[REDACTED_BEARER]' : `${queryPrefix}[REDACTED]`);
  }
  return value;
}

export function saveLocalJobBackup(job: any, bundle?: any) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  const backup: LocalJobBackup = {
    jobId: job.jobId,
    status: job.status,
    modelName: job.modelName || job.model,
    jsonMode: job.jsonMode || 'json_object',
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    canceledAt: job.canceledAt,
    counters: job.counters || {
       total: job.targetSampleIds?.length || 0,
       processed: job.items?.length || 0,
       success: job.items?.filter((i: any) => i.status === 'success').length || 0,
       failure: job.items?.filter((i: any) => i.status === 'error').length || 0
    },
    processedCount: job.counters?.processed || job.items?.length || 0,
    total: job.counters?.total || job.targetSampleIds?.length || 0,
    savedAt: new Date().toISOString(),
    bundleStored: false
  };
  backup.bundleRevision = job.revision ?? bundle?.job?.revision;

  if (bundle) {
    const safeBundle = sanitizeForLocalJobBackup(bundle);

    // Check size limit
    try {
      const bundleStr = JSON.stringify(safeBundle);
      if (bundleStr.length <= MAX_BUNDLE_SIZE_BYTES) {
         backup.bundleStored = true;
         backup.bundle = safeBundle;
      } else {
         backup.notStoredReason = 'localStorageQuotaOrSizeLimit';
      }
    } catch (e) {
      backup.notStoredReason = 'serializationError';
    }
  }

  try {
    const key = `${LOCAL_STORAGE_KEY_PREFIX}${job.jobId}`;
    localStorage.setItem(key, JSON.stringify(backup));
    enforceMaxBackups();
    return true;
  } catch (e) {
    console.warn('Failed to save local job backup', e);

    // If it was a quota error with a bundle, try saving just metadata
    if (backup.bundleStored) {
      backup.bundleStored = false;
      delete backup.bundle;
      backup.notStoredReason = 'localStorageQuotaOrSizeLimit';
      try {
        const key = `${LOCAL_STORAGE_KEY_PREFIX}${job.jobId}`;
        localStorage.setItem(key, JSON.stringify(backup));
        return true;
      } catch (e2) {
        console.warn('Failed to save even metadata backup', e2);
      }
    }
    return false;
  }
}

export function listLocalJobBackups(): LocalJobBackup[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  const backups: LocalJobBackup[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX)) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          const backup = JSON.parse(value) as LocalJobBackup;
          if (backup && backup.jobId) {
             // Return without full bundle in list for performance
             const { bundle, ...meta } = backup;
             backups.push(meta);
          }
        }
      } catch (e) {
        // ignore malformed
      }
    }
  }

  return backups.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

export function getLocalJobBackup(jobId: string): LocalJobBackup | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const key = `${LOCAL_STORAGE_KEY_PREFIX}${jobId}`;
  try {
    const value = localStorage.getItem(key);
    if (value) {
      return JSON.parse(value) as LocalJobBackup;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function removeLocalJobBackup(jobId: string) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  const key = `${LOCAL_STORAGE_KEY_PREFIX}${jobId}`;
  localStorage.removeItem(key);
}

function enforceMaxBackups() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const backups = listLocalJobBackups();
  if (backups.length > MAX_BACKUPS) {
    const toRemove = backups.slice(MAX_BACKUPS);
    for (const b of toRemove) {
      removeLocalJobBackup(b.jobId);
    }
  }
}
