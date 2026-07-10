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
  jobRevision?: number;
  jobStatusAtBackup?: string;
  processedAtBackup?: number;
  terminalDateAtBackup?: string;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  length: number;
}

let activeStorage: StorageAdapter | null = null;

export function getStorage(): StorageAdapter | null {
  if (activeStorage) return activeStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function setStorageAdapter(adapter: StorageAdapter | null) {
  activeStorage = adapter;
}

export function buildLocalJobBackupMetadata(job: any, options?: { savedAt?: string }): LocalJobBackup {
  let success = 0;
  let failure = 0;
  let total = 0;
  let processed = 0;

  if (job.counters && typeof job.counters.successCount === 'number') {
    success = job.counters.successCount;
    failure = job.counters.failureCount || 0;
    total = job.counters.total || job.targetSampleIds?.length || 0;
    processed = success + failure;
  } else if (job.items && Array.isArray(job.items)) {
    success = job.items.filter((i: any) => i.status === 'succeeded' || i.status === 'success').length;
    failure = job.items.filter((i: any) => i.status === 'failed' || i.status === 'error' || i.status === 'failure').length;
    total = job.counters?.total || job.targetSampleIds?.length || 0;
    processed = success + failure;
  } else {
    total = job.targetSampleIds?.length || 0;
  }

  const status = job.status || 'unknown';
  const completedAt = job.completedAt;
  const canceledAt = job.canceledAt;
  const terminalDate = completedAt || canceledAt || '';

  return {
    jobId: job.jobId,
    status: status,
    modelName: job.modelName || job.model || 'unknown',
    jsonMode: job.jsonMode || 'json_object',
    createdAt: job.createdAt || new Date().toISOString(),
    startedAt: job.startedAt,
    completedAt: completedAt,
    canceledAt: canceledAt,
    counters: {
      total,
      processed,
      success,
      failure
    },
    processedCount: processed,
    total: total,
    savedAt: options?.savedAt || new Date().toISOString(),
    bundleStored: false,
    jobRevision: job.revision,
    jobStatusAtBackup: status,
    processedAtBackup: processed,
    terminalDateAtBackup: terminalDate
  };
}

export function sanitizeBundle(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string' && obj.toLowerCase().startsWith('bearer ')) {
      return '[REDACTED]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeBundle(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitiveKey =
      lowerKey === 'executionprivate' ||
      lowerKey === 'authorization' ||
      lowerKey === 'proxyauthorization' ||
      lowerKey === 'apikey' ||
      lowerKey === 'accesstoken' ||
      lowerKey === 'refreshtoken' ||
      lowerKey === 'idtoken' ||
      lowerKey === 'credential' ||
      lowerKey === 'credentials' ||
      lowerKey === 'cookie' ||
      lowerKey === 'setcookie' ||
      lowerKey === 'requestheaders' ||
      lowerKey === 'headers' ||
      lowerKey === 'requestpreview' ||
      lowerKey === 'rawrequest' ||
      lowerKey === 'rawrequestbody' ||
      lowerKey === 'rawresponse' ||
      lowerKey === 'responseraw' ||
      lowerKey === 'rawoutputpreview';

    if (isSensitiveKey) {
      continue;
    }
    sanitized[key] = sanitizeBundle(value);
  }
  return sanitized;
}

export function saveLocalJobBackup(job: any, bundle?: any) {
  const storage = getStorage();
  if (!storage) return false;

  const backup = buildLocalJobBackupMetadata(job);

  if (!bundle) {
    // If saving metadata only, try to preserve any existing bundle
    try {
      const key = `${LOCAL_STORAGE_KEY_PREFIX}${job.jobId}`;
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
    let safeBundle;
    try {
      safeBundle = sanitizeBundle(bundle);
    } catch (e) {
      backup.notStoredReason = 'sanitizationError';
    }

    if (safeBundle) {
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
  }

  try {
    const key = `${LOCAL_STORAGE_KEY_PREFIX}${job.jobId}`;
    storage.setItem(key, JSON.stringify(backup));
    enforceMaxBackups();
    return true;
  } catch (e) {
    console.warn('Failed to save local job backup', e);

    if (backup.bundleStored) {
      backup.bundleStored = false;
      delete backup.bundle;
      backup.notStoredReason = 'localStorageQuotaOrSizeLimit';
      try {
        const key = `${LOCAL_STORAGE_KEY_PREFIX}${job.jobId}`;
        storage.setItem(key, JSON.stringify(backup));
        return true;
      } catch (e2) {
        console.warn('Failed to save even metadata backup', e2);
      }
    }
    return false;
  }
}

export function listLocalJobBackups(): LocalJobBackup[] {
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
  const storage = getStorage();
  if (!storage) return null;

  const key = `${LOCAL_STORAGE_KEY_PREFIX}${jobId}`;
  try {
    const value = storage.getItem(key);
    if (value) {
      return JSON.parse(value) as LocalJobBackup;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function removeLocalJobBackup(jobId: string) {
  const storage = getStorage();
  if (!storage) return;
  const key = `${LOCAL_STORAGE_KEY_PREFIX}${jobId}`;
  storage.removeItem(key);
}

function enforceMaxBackups() {
  const storage = getStorage();
  if (!storage) return;

  const backups = listLocalJobBackups();
  if (backups.length > MAX_BACKUPS) {
    const toRemove = backups.slice(MAX_BACKUPS);
    for (const b of toRemove) {
      removeLocalJobBackup(b.jobId);
    }
  }
}
