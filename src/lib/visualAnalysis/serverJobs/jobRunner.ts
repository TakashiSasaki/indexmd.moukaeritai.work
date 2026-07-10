import { jobStore as defaultJobStore } from './jobStore';
let jobStore = defaultJobStore;
import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';
import { evaluateSampleComparison } from '../publicSamples/compare';

const SHORT_RETRY_DELAY_MS = 5 * 60_000;
const DEFAULT_RATE_LIMIT_PAUSE_MS = 60_000;

function getHeaderValue(headers: any, name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) || headers.get(name.toLowerCase()) || undefined;
  return headers[name] || headers[name.toLowerCase()];
}

function extractRetryDelayMs(finalData: any): { retryAfterMs?: number; retryAfterReason?: string } {
  const generationDiagnostics = finalData?.record?.diagnostics?.generation ?? finalData?.generationDiagnostics;
  if (typeof generationDiagnostics?.retryAfterMs === 'number') {
    return { retryAfterMs: generationDiagnostics.retryAfterMs, retryAfterReason: generationDiagnostics.retryAfterReason };
  }

  const retryAfterStr = getHeaderValue(finalData?.responseDiagnostics?.headers, 'retry-after');
  if (retryAfterStr) {
    const parsed = parseFloat(retryAfterStr);
    if (!Number.isNaN(parsed) && parsed > 0) return { retryAfterMs: parsed * 1000, retryAfterReason: 'HTTP retry-after header' };
    const dateDelay = Date.parse(retryAfterStr) - Date.now();
    if (!Number.isNaN(dateDelay) && dateDelay > 0) return { retryAfterMs: dateDelay, retryAfterReason: 'HTTP retry-after date header' };
  }

  return {};
}

export function classifyJobQuotaInterruption(finalData: any, status?: number): {
  isQuotaOrRateLimit: boolean;
  action?: 'blockedByQuota' | 'pausedForRateLimit';
  retryAfterMs?: number;
  retryAfterReason?: string;
  quotaClassification?: string;
} {
  const generationDiagnostics = finalData?.record?.diagnostics?.generation ?? finalData?.generationDiagnostics;
  const quotaClassification = finalData?.quotaClassification ?? generationDiagnostics?.quotaClassification;
  const providerStatus = generationDiagnostics?.providerStatus;
  const failureKind = finalData?.failureKind;
  const { retryAfterMs, retryAfterReason } = extractRetryDelayMs(finalData);

  const isDailyExhausted =
    quotaClassification === 'dailyQuotaExhausted' ||
    generationDiagnostics?.quotaScope === 'daily' ||
    generationDiagnostics?.providerFailureKind === 'providerQuotaExceeded' ||
    String(generationDiagnostics?.quotaId || '').toLowerCase().includes('perday') ||
    String(generationDiagnostics?.quotaMetric || '').toLowerCase().includes('free_tier_requests');

  if (isDailyExhausted) {
    return { isQuotaOrRateLimit: true, action: 'blockedByQuota', retryAfterMs, retryAfterReason, quotaClassification };
  }

  const hasCappedRetryInfo = retryAfterReason?.includes('RetryInfo') && retryAfterReason.includes('capped');

  if (hasCappedRetryInfo) {
    return { isQuotaOrRateLimit: true, action: 'blockedByQuota', retryAfterMs, retryAfterReason, quotaClassification };
  }

  if (
    quotaClassification === 'transientThrottle' ||
    (retryAfterReason?.includes('RetryInfo') && retryAfterMs !== undefined && retryAfterMs <= SHORT_RETRY_DELAY_MS)
  ) {
    return { isQuotaOrRateLimit: true, action: 'pausedForRateLimit', retryAfterMs, retryAfterReason, quotaClassification };
  }

  const genericQuotaOrRateLimit =
    failureKind === 'providerQuotaExceeded' ||
    failureKind === 'providerRateLimited' ||
    failureKind === 'rateLimited' ||
    providerStatus === 'RESOURCE_EXHAUSTED' ||
    providerStatus === 'QUOTA_EXCEEDED' ||
    status === 429;

  if (!genericQuotaOrRateLimit) return { isQuotaOrRateLimit: false };

  return {
    isQuotaOrRateLimit: true,
    action: (failureKind === 'providerQuotaExceeded' && status !== 429) || isDailyExhausted ? 'blockedByQuota' : 'pausedForRateLimit',
    retryAfterMs,
    retryAfterReason,
    quotaClassification
  };
}

export function classifyProviderAvailability(finalData: any, status?: number): {
  isUnavailable: boolean;
  retryAfterMs?: number;
} {
  const generationDiagnostics = finalData?.record?.diagnostics?.generation ?? finalData?.generationDiagnostics;
  const providerStatus = generationDiagnostics?.providerStatus;
  const failureKind = finalData?.failureKind || generationDiagnostics?.providerFailureKind;
  
  const isUnav =
    status === 503 ||
    status === 504 ||
    providerStatus === 'UNAVAILABLE' ||
    failureKind === 'providerUnavailable' ||
    failureKind === 'providerUnavailable';
    
  if (isUnav) {
    return { isUnavailable: true, retryAfterMs: 5 * 60 * 1000 }; // 5 minutes default
  }
  return { isUnavailable: false };
}

export const activeRunners = new Map<string, { startedAt: string; abortController?: AbortController }>();

export function isRunnerActive(jobId: string) {
  return activeRunners.has(jobId);
}

export async function startVisualBatchJob(
  jobId: string, 
  deps: {
    analyzeFn: (options: any) => Promise<{status: number, body: any}>,
    getSampleMetadata: (sampleId: string) => Promise<any>,
    jobStore?: any
  }
) {
  const { analyzeFn, getSampleMetadata } = deps;
  if (deps.jobStore) {
    jobStore = deps.jobStore;
  }
  if (activeRunners.has(jobId)) {
    console.warn(`Runner for job ${jobId} is already active.`);
    return;
  }

  const job = jobStore.getJob(jobId);
  if (!job) return;

  const abortController = new AbortController();
  activeRunners.set(jobId, { startedAt: new Date().toISOString(), abortController });

  try {
    jobStore.updateJob(jobId, { 
    status: 'running', 
    startedAt: new Date().toISOString(),
    lastEvent: {
      type: 'jobStarted',
      timestamp: new Date().toISOString(),
      message: `Job ${jobId} started`
    }
  });

  const alreadyDone = new Set([...(job.completedSampleIds || []), ...(job.failedSampleIds || [])]);
  for (const sampleId of job.targetSampleIds) {
    if (alreadyDone.has(sampleId)) continue;
    // Check if canceled
    const currentJob = jobStore.getJob(jobId);
    if (currentJob?.status === 'canceling' || currentJob?.cancelRequestedAt) {
      jobStore.updateJob(jobId, {
        status: 'canceled',
        canceledAt: new Date().toISOString(),
        lastEvent: {
          type: 'jobCanceled',
          timestamp: new Date().toISOString(),
          message: 'Job canceled before starting next sample'
        }
      });
      break;
    }
    if (currentJob?.status === 'canceled' || currentJob?.status === 'paused' || currentJob?.status === 'pausedForRateLimit' || currentJob?.status === 'blockedByQuota' || currentJob?.status === 'pausedForProviderUnavailable') {
      break;
    }

    let sampleTitle = sampleId;
    let sampleMeta = null;
    try {
      sampleMeta = await getSampleMetadata(sampleId);
      if (sampleMeta && sampleMeta.title) sampleTitle = sampleMeta.title;
    } catch (e) {
      console.warn(`Could not fetch metadata for sample ${sampleId}`, e);
    }

    jobStore.updateJob(jobId, {
      currentSampleId: sampleId,
      currentSampleTitle: sampleTitle,
      lastEvent: {
        type: 'sampleStarted',
        timestamp: new Date().toISOString(),
        sampleId: sampleId,
        message: `Processing sample ${sampleTitle}`
      },
      lastHeartbeatAt: new Date().toISOString()
    });

    const itemStartedAtDate = new Date();
    let item: VisualBatchJobItem = {
      sampleId,
      title: sampleTitle,
      status: 'running',
      startedAt: itemStartedAtDate.toISOString(),
      attempts: 0,
      retryHistory: []
    };

    let attempt = 0;
    const maxAttemptsPerSample = 2;
    let success = false;
    let retryExhausted = false;
    let comparison: any = undefined;
    let finalData: any = null;
    let executionError: string | null = null;

    while (attempt < maxAttemptsPerSample && !success) {
      attempt++;
      item.attempts = attempt;
      const attemptStartedAtDate = new Date();

      // Check if canceled during retry wait
      const currentJobForCancel = jobStore.getJob(jobId);
      if (currentJobForCancel?.status === 'canceling' || currentJobForCancel?.cancelRequestedAt) {
        break;
      }

      jobStore.updateJob(jobId, {
        lastEvent: {
          type: attempt > 1 ? 'sampleRetryStarted' : 'apiRequestStarted',
          timestamp: new Date().toISOString(),
          sampleId: sampleId,
          message: attempt > 1 ? `Retrying API request for ${sampleTitle} (Attempt ${attempt}/${maxAttemptsPerSample})` : `Sending API request for ${sampleTitle}`
        }
      });

      let res: any = null;
      try {
        res = await analyzeFn({
          sampleId,
          modelName: job.modelName,
          jsonMode: job.jsonMode,
          customInstruction: job.executionPrivate?.customInstruction || job.customInstructionPreview,
          providerRetryPolicy: {
            maxAttempts: 1,
            retryInternalErrors: false,
            retryQuotaOrRateLimit: true,
            retryUnavailable: true,
            retryInvalidArgument: false,
          }
        });

        jobStore.updateJob(jobId, {
          lastEvent: {
            type: 'apiResponseReceived',
            timestamp: new Date().toISOString(),
            sampleId: sampleId,
            message: `Received API response for ${sampleTitle} (status: ${res.status})`
          }
        });

        finalData = res.body;
        success = res.status === 200 && finalData.success !== false;
      } catch (e: any) {
        success = false;
        executionError = e.message;
        finalData = {
          success: false,
          error: e.message,
          failureKind: 'executionError'
        };
      }

      if (success) {
        if (sampleMeta) {
          const record = finalData?.record;
          comparison = evaluateSampleComparison(sampleMeta, {
            record,
            visualAnalysis: record?.visualAnalysis,
            expectedMetadata: record?.evaluation?.expectedMetadata
          });
        }
        break; // Success!
      }

      // Check if we should retry
      const isConfigurationFailure = finalData?.failureKind === "providerInvalidArgument" || res?.status === 400 || finalData?.error?.includes("schema");
      if (isConfigurationFailure) {
        item.status = "failed";
        item.error = finalData?.error || "Configuration Error";
        item.failureKind = "providerInvalidArgument";
        jobStore.appendItem(jobId, item);
        jobStore.updateJob(jobId, {
          status: "failed",
          lastError: item.error,
          lastFailureKind: item.failureKind,
          lastEvent: {
            type: "jobFailed",
            timestamp: new Date().toISOString(),
            message: `Job failed due to deterministic configuration error on ${sampleTitle}`
          }
        });
        break;
      }

      const providerUnav = classifyProviderAvailability(finalData, res?.status);
      if (providerUnav.isUnavailable) {
        const delayMs = providerUnav.retryAfterMs ?? 5 * 60_000;
        const resumeAfter = new Date(Date.now() + delayMs).toISOString();
        item.status = 'pausedForProviderUnavailable';
        item.error = finalData?.error || "Provider Unavailable";
        item.failureKind = finalData?.failureKind || 'providerUnavailable';
        item.resumeAfter = resumeAfter;
        item.pauseReason = 'pausedForProviderUnavailable';
        item.affectedSampleIds = [sampleId];
        item.attemptState = { attempt, maxAttempts: maxAttemptsPerSample, retryExhausted: false };
        if (finalData?.record) item.record = finalData.record;
        
        jobStore.appendItem(jobId, item);
        jobStore.updateJob(jobId, {
          status: 'pausedForProviderUnavailable',
          resumeAfter,
          pauseReason: 'pausedForProviderUnavailable',
          affectedSampleIds: [sampleId],
          attemptState: item.attemptState,
          lastEvent: {
            type: 'jobPaused',
            timestamp: new Date().toISOString(),
            sampleId,
            message: `Provider unavailable while processing ${sampleTitle}. Pausing job.`
          },
          lastFailureKind: item.failureKind,
          lastError: item.error,
          lastHeartbeatAt: new Date().toISOString()
        });
        break;
      }

      const quotaInterruption = classifyJobQuotaInterruption(finalData, res?.status);
      const isQuotaError = quotaInterruption.isQuotaOrRateLimit;
      
      const attemptCompletedAt = new Date();
      const attemptDurationMs = attemptCompletedAt.getTime() - attemptStartedAtDate.getTime();

      if (quotaInterruption.action === 'blockedByQuota') {
        const resumeAfter = new Date(Date.now() + (quotaInterruption.retryAfterMs ?? 24 * 60 * 60_000)).toISOString();
        item.status = 'blockedByQuota';
        item.error = finalData?.error;
        item.failureKind = finalData?.failureKind || 'providerQuotaExceeded';
        if (finalData?.record) item.record = finalData.record;
        item.blockedReason = 'blockedByQuota';
        item.resumeAfter = resumeAfter;
        item.affectedSampleIds = [sampleId];
        item.attemptState = { attempt, maxAttempts: maxAttemptsPerSample, retryExhausted: false };
        item.retryHistory = item.retryHistory || [];
        item.retryHistory.push({
          attempt,
          startedAt: attemptStartedAtDate.toISOString(),
          completedAt: attemptCompletedAt.toISOString(),
          durationMs: attemptDurationMs,
          failureKind: finalData?.failureKind,
          error: finalData?.error,
          nextRetryAt: resumeAfter,
          quotaClassification: quotaInterruption.quotaClassification,
          retryAfterReason: quotaInterruption.retryAfterReason
        });
        jobStore.appendItem(jobId, item);
        jobStore.updateJob(jobId, {
          status: 'blockedByQuota',
          resumeAfter,
          blockedReason: 'blockedByQuota',
          affectedSampleIds: [sampleId],
          blockedSampleIds: Array.from(new Set([...(jobStore.getJob(jobId)?.blockedSampleIds || []), sampleId])),
          attemptState: item.attemptState,
          lastEvent: { type: 'jobPaused', timestamp: new Date().toISOString(), sampleId, message: `Daily quota exhausted while processing ${sampleTitle}` },
          lastFailureKind: finalData?.failureKind,
          lastError: finalData?.error,
          lastHeartbeatAt: new Date().toISOString()
        });
        break;
      }

      if (isQuotaError && attempt < maxAttemptsPerSample) {
        // We will retry bounded transient 429/rate-limit responses, but daily quota exhaustion pauses the job.
        let delayMs = quotaInterruption.retryAfterMs ?? DEFAULT_RATE_LIMIT_PAUSE_MS;
        if (delayMs > SHORT_RETRY_DELAY_MS) delayMs = SHORT_RETRY_DELAY_MS;

        const nextRetryAtDate = new Date(Date.now() + delayMs);
        const nextRetryAt = nextRetryAtDate.toISOString();

        item.retryHistory = item.retryHistory || [];
        item.retryHistory.push({
          attempt,
          startedAt: attemptStartedAtDate.toISOString(),
          completedAt: attemptCompletedAt.toISOString(),
          durationMs: attemptDurationMs,
          failureKind: finalData?.failureKind,
          error: finalData?.error,
          delayBeforeNextAttemptMs: delayMs,
          nextRetryAt,
          quotaClassification: quotaInterruption.quotaClassification,
          retryAfterReason: quotaInterruption.retryAfterReason
        });
        
        item.nextRetryAt = nextRetryAt;
        item.resumeAfter = nextRetryAt;
        item.pauseReason = 'pausedForRateLimit';
        item.affectedSampleIds = [sampleId];
        item.attemptState = { attempt, maxAttempts: maxAttemptsPerSample, retryExhausted: false };

        jobStore.updateJob(jobId, {
          resumeAfter: nextRetryAt,
          pauseReason: 'pausedForRateLimit',
          affectedSampleIds: [sampleId],
          attemptState: item.attemptState,
          lastEvent: {
            type: 'quotaBackoffWaiting',
            timestamp: new Date().toISOString(),
            sampleId: sampleId,
            message: `Quota/Rate limit hit for ${sampleTitle}. Waiting ${Math.round(delayMs/1000)}s before retry.`
          },
          lastHeartbeatAt: new Date().toISOString()
        });

        // Sleep
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // Not a quota error, or exhausted attempts
        if (!success) {
           retryExhausted = attempt >= maxAttemptsPerSample;
           item.retryExhausted = retryExhausted;
           item.retryHistory = item.retryHistory || [];
           item.retryHistory.push({
             attempt,
             startedAt: attemptStartedAtDate.toISOString(),
             completedAt: attemptCompletedAt.toISOString(),
             durationMs: attemptDurationMs,
             failureKind: finalData?.failureKind,
             error: finalData?.error
           });
           if (retryExhausted) {
             if (isQuotaError && quotaInterruption.action === 'pausedForRateLimit') {
               const delayMs = Math.min(quotaInterruption.retryAfterMs ?? DEFAULT_RATE_LIMIT_PAUSE_MS, SHORT_RETRY_DELAY_MS);
               const resumeAfter = new Date(Date.now() + delayMs).toISOString();
               item.status = 'pausedForRateLimit';
               item.error = finalData?.error;
               item.failureKind = finalData?.failureKind || 'providerRateLimited';
               item.resumeAfter = resumeAfter;
               item.pauseReason = 'pausedForRateLimit';
               item.affectedSampleIds = [sampleId];
               item.attemptState = { attempt, maxAttempts: maxAttemptsPerSample, retryExhausted: true };
               jobStore.appendItem(jobId, item);
               jobStore.updateJob(jobId, {
                 status: 'pausedForRateLimit',
                 resumeAfter,
                 pauseReason: 'pausedForRateLimit',
                 affectedSampleIds: [sampleId],
                 attemptState: item.attemptState,
                 lastEvent: { type: 'jobPaused', timestamp: new Date().toISOString(), sampleId, message: `Rate limit pause scheduled for ${sampleTitle}` },
                 lastFailureKind: finalData?.failureKind,
                 lastError: finalData?.error,
                 lastHeartbeatAt: new Date().toISOString()
               });
             } else {
               jobStore.updateJob(jobId, {
                 lastEvent: {
                   type: 'sampleRetryExhausted',
                   timestamp: new Date().toISOString(),
                   sampleId: sampleId,
                   message: `Retry exhausted for ${sampleTitle}`
                 }
               });
             }
           }
        }
        break;
      }
    }

    const jobAfterItem = jobStore.getJob(jobId);
    const pausedAfterQuotaOrRateLimit = jobAfterItem?.status === 'blockedByQuota' || jobAfterItem?.status === 'pausedForRateLimit' || jobAfterItem?.status === 'pausedForProviderUnavailable';
    if (pausedAfterQuotaOrRateLimit) {
      break;
    }

    // Now record the final result of the item
    const itemCompletedAtDate = new Date();
    const itemDurationMs = itemCompletedAtDate.getTime() - itemStartedAtDate.getTime();
    
    if (success && finalData) {
      const record = finalData.record;
      item = {
        ...item,
        status: 'succeeded',
        completedAt: itemCompletedAtDate.toISOString(),
        durationMs: itemDurationMs,
        error: finalData.error,
        failureKind: finalData.failureKind,
        record,
        comparison: comparison
      };
      
      const counters = { ...(jobStore.getJob(jobId)?.counters || job.counters) };
      counters.total = job.targetSampleIds.length;
      counters.successCount++;
      const qStatus = record?.evaluation?.qualityStatus || finalData.qualityStatus;
      if (qStatus === 'valid') counters.validCount++;
      if (qStatus === 'validLowQuality') counters.validLowQualityCount++;
      if (comparison) {
        if (comparison.overallStatus === 'pass') counters.expectedComparisonPassCount++;
        if (comparison.overallStatus === 'warning') counters.expectedComparisonWarningCount++;
        if (comparison.overallStatus === 'fail') counters.expectedComparisonFailCount++;
        if (comparison.reviewStatus === 'pass') counters.reviewPassCount++;
        if (comparison.reviewStatus === 'needsReview') counters.reviewNeedsReviewCount++;
        if (comparison.reviewStatus === 'fail') counters.reviewFailCount++;
      }
      
      const completedSampleIds = [...(jobStore.getJob(jobId)?.completedSampleIds || []), sampleId];
      const pendingSampleIds = (jobStore.getJob(jobId)?.pendingSampleIds || []).filter(id => id !== sampleId);
      
      jobStore.appendItem(jobId, item);
      jobStore.updateJob(jobId, {
        completedSampleIds,
        pendingSampleIds,
        counters,
        resumeAfter: undefined,
        pauseReason: undefined,
        blockedReason: undefined,
        affectedSampleIds: undefined,
        attemptState: undefined,
        lastEvent: {
          type: 'sampleSucceeded',
          timestamp: new Date().toISOString(),
          sampleId: sampleId,
          message: `Sample ${sampleTitle} succeeded`
        },
        lastHeartbeatAt: new Date().toISOString()
      });
    } else {
      // Failed
      const latestForFailure = jobStore.getJob(jobId);
      const generationDiagnostics =
        finalData?.record?.diagnostics?.generation ??
        finalData?.generationDiagnostics;
      const isBlockedItem = latestForFailure?.status === 'blockedByQuota' ||
        generationDiagnostics?.quotaClassification === 'dailyQuotaExhausted' ||
        generationDiagnostics?.providerFailureKind === 'providerQuotaExceeded';
      item = {
        ...item,
        status: isBlockedItem ? 'blockedByQuota' : 'failed',
        completedAt: itemCompletedAtDate.toISOString(),
        durationMs: itemDurationMs,
        error: finalData?.error || executionError,
        failureKind: finalData?.failureKind || 'executionError'
      };

      if (finalData) {
        item.record = finalData.record;
      }
      
      const counters = { ...(jobStore.getJob(jobId)?.counters || job.counters) };
      counters.total = job.targetSampleIds.length;
      if (!isBlockedItem) {
        counters.failureCount++;
      }
      if (item.failureKind === 'jsonParseError' || item.failureKind === 'schemaValidationError') {
        counters.invalidJsonCount++;
      }
      
      const failedSampleIds = isBlockedItem ? (jobStore.getJob(jobId)?.failedSampleIds || []) : [...(jobStore.getJob(jobId)?.failedSampleIds || []), sampleId];
      const blockedSampleIds = isBlockedItem ? Array.from(new Set([...(jobStore.getJob(jobId)?.blockedSampleIds || []), sampleId])) : (jobStore.getJob(jobId)?.blockedSampleIds || []);
      const pendingSampleIds = (jobStore.getJob(jobId)?.pendingSampleIds || []).filter(id => id !== sampleId);
      
      jobStore.appendItem(jobId, item);
      jobStore.updateJob(jobId, {
        failedSampleIds,
        blockedSampleIds,
        pendingSampleIds,
        counters,
        resumeAfter: undefined,
        pauseReason: undefined,
        blockedReason: undefined,
        affectedSampleIds: undefined,
        attemptState: undefined,
        lastEvent: {
          type: isBlockedItem ? 'quotaCircuitBreakerTripped' : 'sampleFailed',
          timestamp: new Date().toISOString(),
          sampleId: sampleId,
          message: isBlockedItem ? `Sample ${sampleTitle} blocked by provider quota` : `Sample ${sampleTitle} failed: ${item.error || item.failureKind}`
        },
        lastError: item.error,
        lastFailureKind: item.failureKind,
        lastHeartbeatAt: new Date().toISOString()
      });
    }
  }

  const finalJob = jobStore.getJob(jobId);
  if (finalJob) {
    let completedAt = finalJob.completedAt;
    let durationMs = finalJob.durationMs;
    const nowStr = new Date().toISOString();
    const nowTime = new Date().getTime();
    const startTime = finalJob.startedAt ? new Date(finalJob.startedAt).getTime() : nowTime;
    
    if (finalJob.status === 'blockedByQuota' || finalJob.status === 'pausedForRateLimit' || finalJob.status === 'pausedForProviderUnavailable') {
       const processed = new Set([...(finalJob.completedSampleIds || []), ...(finalJob.failedSampleIds || [])]);
       const remaining = finalJob.targetSampleIds.filter(id => !processed.has(id));
       jobStore.updateJob(jobId, {
         pendingSampleIds: remaining,
         blockedSampleIds: Array.from(new Set([...(finalJob.blockedSampleIds || [])])),
         lastEvent: finalJob.lastEvent
       });
    } else if (finalJob.status === 'running') {
       completedAt = nowStr;
       durationMs = nowTime - startTime;
       const processed = (finalJob.completedSampleIds?.length || 0) + (finalJob.failedSampleIds?.length || 0);
       jobStore.updateJob(jobId, {
         status: processed < finalJob.targetSampleIds.length ? 'partiallyCompleted' : 'completed',
         completedAt,
         durationMs,
         lastEvent: {
           type: 'jobCompleted',
           timestamp: nowStr,
           message: `Job ${jobId} completed`
         }
       });
    } else if (finalJob.status === 'canceled' && !finalJob.durationMs) {
       // if it was canceled during the loop
       completedAt = finalJob.canceledAt || nowStr;
       durationMs = new Date(completedAt).getTime() - startTime;
       jobStore.updateJob(jobId, { durationMs });
    }
  }
  } finally {
    const latest = jobStore.getJob(jobId);
    if (latest && latest.status === 'canceling') {
       const now = new Date();
       const startMs = latest.startedAt ? new Date(latest.startedAt).getTime() : new Date(latest.createdAt).getTime();
       jobStore.updateJob(jobId, {
         status: 'canceled',
         canceledAt: now.toISOString(),
         durationMs: Math.max(0, now.getTime() - startMs),
         lastEvent: {
           type: 'jobCanceled',
           timestamp: now.toISOString(),
           message: 'Job canceled after runner cleanup'
         }
       });
    }
    activeRunners.delete(jobId);
  }
}
