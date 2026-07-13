import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';
import { JobStore } from './JobStoreInterface';
import { evaluateSampleComparison } from '../publicSamples/compare';

const SHORT_RETRY_DELAY_MS = 5 * 60_000;
const DEFAULT_RATE_LIMIT_PAUSE_MS = 60_000;

function getHeaderValue(headers: any, name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) || headers.get(name.toLowerCase()) || undefined;
  return headers[name] || headers[name.toLowerCase()];
}

function extractRetryDelayMs(finalData: any, clockNow: number): { retryAfterMs?: number; retryAfterReason?: string } {
  const generationDiagnostics = finalData?.record?.diagnostics?.generation ?? finalData?.generationDiagnostics;
  if (typeof generationDiagnostics?.retryAfterMs === 'number') {
    return { retryAfterMs: generationDiagnostics.retryAfterMs, retryAfterReason: generationDiagnostics.retryAfterReason };
  }

  const retryAfterStr = getHeaderValue(finalData?.responseDiagnostics?.headers, 'retry-after');
  if (retryAfterStr) {
    const parsed = parseFloat(retryAfterStr);
    if (!Number.isNaN(parsed) && parsed > 0) return { retryAfterMs: parsed * 1000, retryAfterReason: 'HTTP retry-after header' };
    const dateDelay = Date.parse(retryAfterStr) - clockNow;
    if (!Number.isNaN(dateDelay) && dateDelay > 0) return { retryAfterMs: dateDelay, retryAfterReason: 'HTTP retry-after date header' };
  }

  return {};
}

export function classifyJobQuotaInterruption(finalData: any, status?: number, clock?: { now: () => Date }): {
  isQuotaOrRateLimit: boolean;
  action?: 'blockedByQuota' | 'pausedForRateLimit';
  retryAfterMs?: number;
  retryAfterReason?: string;
  quotaClassification?: string;
} {
  const currentClock = clock || { now: () => new Date() };
  const generationDiagnostics = finalData?.record?.diagnostics?.generation ?? finalData?.generationDiagnostics;
  const quotaClassification = finalData?.quotaClassification ?? generationDiagnostics?.quotaClassification;
  const providerStatus = generationDiagnostics?.providerStatus;
  const failureKind = finalData?.failureKind;
  const { retryAfterMs, retryAfterReason } = extractRetryDelayMs(finalData, currentClock.now().getTime());

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

export function classifyProviderAvailability(finalData: any, status?: number, clock?: { now: () => Date }): {
  isUnavailable: boolean;
  retryAfterMs?: number;
} {
  const currentClock = clock || { now: () => new Date() };
  const generationDiagnostics = finalData?.record?.diagnostics?.generation ?? finalData?.generationDiagnostics;
  const providerStatus = generationDiagnostics?.providerStatus;
  const failureKind = finalData?.failureKind || generationDiagnostics?.providerFailureKind;
  
  const isUnav =
    status === 502 ||
    status === 503 ||
    status === 504 ||
    providerStatus === 'UNAVAILABLE' ||
    failureKind === 'providerUnavailable' ||
    generationDiagnostics?.message?.includes?.("transport-unavailable");
    
  if (isUnav) {
    let retryMs = 5000; // 5 seconds fixed default
    const extractedRetryAfter = extractRetryDelayMs(finalData, currentClock.now().getTime()).retryAfterMs;
    if (extractedRetryAfter !== undefined) {
      retryMs = Math.min(extractedRetryAfter, 30_000); // honor Retry-After up to 30 seconds
    }
    return { isUnavailable: true, retryAfterMs: retryMs };
  }
  return { isUnavailable: false };
}



export interface RunnerCompletionResult {
  jobId: string;
  finalStatus: string;
}

export interface RunnerHandle {
  completion: Promise<RunnerCompletionResult>;
  abort: () => void;
}

export function startVisualBatchJob(
  jobId: string, 
  deps: {
    analyzeFn: (options: any, abortSignal?: AbortSignal) => Promise<{status: number, body: any}>,
    getSampleMetadata: (sampleId: string) => Promise<any>,
    jobStore: JobStore,
    clock?: { now: () => Date },
    runnerRegistry: import('./runnerRegistry').RunnerRegistry,
    scheduler?: { sleep: (ms: number) => Promise<void> }
  }
): RunnerHandle {
  const { analyzeFn, getSampleMetadata } = deps;
  const store = deps.jobStore;
  const clock = deps.clock || { now: () => new Date() };

  const abortController = new AbortController();

  const completionPromise = (async (): Promise<RunnerCompletionResult> => {
    if (deps.runnerRegistry.isActive(jobId)) {
      console.warn(`Runner for job ${jobId} is already active.`);
      return { jobId, finalStatus: store.getJob(jobId)?.status || 'unknown' };
    }

    const job = store.getJob(jobId);
    if (!job) return { jobId, finalStatus: 'unknown' };

    try {
    store.updateJob(jobId, { 
    status: 'running', 
    startedAt: clock.now().toISOString(),
    lastEvent: {
      type: 'jobStarted',
      timestamp: clock.now().toISOString(),
      message: `Job ${jobId} started`
    }
  });

  const alreadyDone = new Set([...(job.completedSampleIds || []), ...(job.failedSampleIds || [])]);
  for (const sampleId of job.targetSampleIds) {
    if (alreadyDone.has(sampleId)) continue;
    // Check if canceled
    const currentJob = store.getJob(jobId);
    if (currentJob?.status === 'canceling' || currentJob?.cancelRequestedAt) {
      store.updateJob(jobId, {
        status: 'canceled',
        canceledAt: clock.now().toISOString(),
        lastEvent: {
          type: 'jobCanceled',
          timestamp: clock.now().toISOString(),
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

    store.updateJob(jobId, {
      currentSampleId: sampleId,
      currentSampleTitle: sampleTitle,
      lastEvent: {
        type: 'sampleStarted',
        timestamp: clock.now().toISOString(),
        sampleId: sampleId,
        message: `Processing sample ${sampleTitle}`
      },
      lastHeartbeatAt: clock.now().toISOString()
    });

    const itemStartedAtDate = clock.now();
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
      const attemptStartedAtDate = clock.now();

      // Check if canceled during retry wait
      const currentJobForCancel = store.getJob(jobId);
      if (currentJobForCancel?.status === 'canceling' || currentJobForCancel?.cancelRequestedAt) {
        break;
      }

      store.updateJob(jobId, {
        lastEvent: {
          type: attempt > 1 ? 'sampleRetryStarted' : 'apiRequestStarted',
          timestamp: clock.now().toISOString(),
          sampleId: sampleId,
          message: attempt > 1 ? `Retrying API request for ${sampleTitle} (Attempt ${attempt}/${maxAttemptsPerSample})` : `Sending API request for ${sampleTitle}`
        }
      });

      if (abortController.signal.aborted) {
        success = false;
        break;
      }

      let res: any = null;
      try {
        res = await analyzeFn({
          sampleId,
          modelName: job.modelName,
          jsonMode: job.jsonMode,
          customInstruction: job.executionPrivate?.customInstruction || job.customInstructionPreview
        }, abortController.signal);

        if (abortController.signal.aborted) {
          success = false;
          break;
        }

        store.updateJob(jobId, {
          lastEvent: {
            type: 'apiResponseReceived',
            timestamp: clock.now().toISOString(),
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

        // Remove pending sample earlier to ensure tests that check queue wait see it empty on completion
        store.updateJob(jobId, {
          pendingSampleIds: (store.getJob(jobId)?.pendingSampleIds || []).filter(id => id !== sampleId)
        });

        break; // Success!
      }

      // Check if we should retry
      const isConfigurationFailure = finalData?.failureKind === "providerInvalidArgument" || res?.status === 400 || finalData?.error?.includes("schema");
      if (isConfigurationFailure) {
        item.status = "failed";
        item.error = finalData?.error || "Configuration Error";
        item.failureKind = "providerInvalidArgument";
        store.appendItem(jobId, item);
        store.updateJob(jobId, {
          status: "failed",
          lastError: item.error,
          lastFailureKind: item.failureKind,
          lastEvent: {
            type: "jobFailed",
            timestamp: clock.now().toISOString(),
            message: `Job failed due to deterministic configuration error on ${sampleTitle}`
          }
        });
        break;
      }

      const providerUnav = classifyProviderAvailability(finalData, res?.status, clock);
      const attemptCompletedAt = clock.now();
      const attemptDurationMs = attemptCompletedAt.getTime() - attemptStartedAtDate.getTime();

      if (providerUnav.isUnavailable) {
        if (attempt < maxAttemptsPerSample) {
          // Retry exactly once
          let delayMs = providerUnav.retryAfterMs ?? 5000; // 5 seconds default
          if (delayMs > 30000) delayMs = 30000; // Cap at 30 seconds

          const nextRetryAtDate = new Date(clock.now().getTime() + delayMs);
          const nextRetryAt = nextRetryAtDate.toISOString();

          item.retryHistory = item.retryHistory || [];
          item.retryHistory.push({
            attempt,
            startedAt: attemptStartedAtDate.toISOString(),
            completedAt: attemptCompletedAt.toISOString(),
            durationMs: attemptDurationMs,
            failureKind: finalData?.failureKind || 'providerUnavailable',
            error: finalData?.error || 'Provider Unavailable',
            delayBeforeNextAttemptMs: delayMs,
            nextRetryAt,
          });

          item.nextRetryAt = nextRetryAt;
          item.attemptState = { attempt, maxAttempts: maxAttemptsPerSample, retryExhausted: false };

          store.updateJob(jobId, {
            lastEvent: {
              type: 'quotaBackoffWaiting',
              timestamp: clock.now().toISOString(),
              sampleId: sampleId,
              message: `Provider unavailable for ${sampleTitle}. Waiting ${Math.round(delayMs/1000)}s before retry.`
            },
            lastHeartbeatAt: clock.now().toISOString()
          });

          if (deps.scheduler) {
            await deps.scheduler.sleep(delayMs);
          } else {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          if (abortController.signal.aborted) {
             success = false;
             break;
          }
          continue; // Retry
        } else {
          // Retry exhausted for unavailable
          item.retryExhausted = true;
          item.retryHistory = item.retryHistory || [];
          item.retryHistory.push({
            attempt,
            startedAt: attemptStartedAtDate.toISOString(),
            completedAt: attemptCompletedAt.toISOString(),
            durationMs: attemptDurationMs,
            failureKind: finalData?.failureKind || 'providerUnavailable',
            error: finalData?.error || 'Provider Unavailable',
          });

          const resumeAfter = new Date(clock.now().getTime() + (providerUnav.retryAfterMs ?? 5 * 60_000)).toISOString();
          item.status = 'pausedForProviderUnavailable';
          item.error = finalData?.error || "Provider Unavailable";
          item.failureKind = finalData?.failureKind || 'providerUnavailable';
          item.resumeAfter = resumeAfter;
          item.pauseReason = 'pausedForProviderUnavailable';
          item.affectedSampleIds = [sampleId];
          item.attemptState = { attempt, maxAttempts: maxAttemptsPerSample, retryExhausted: true };
          if (finalData?.record) item.record = finalData.record;

          store.appendItem(jobId, item);
          store.updateJob(jobId, {
            status: 'pausedForProviderUnavailable',
            resumeAfter,
            pauseReason: 'pausedForProviderUnavailable',
            affectedSampleIds: [sampleId],
            attemptState: item.attemptState,
            lastEvent: {
              type: 'jobPaused',
              timestamp: clock.now().toISOString(),
              sampleId,
              message: `Provider unavailable retry exhausted while processing ${sampleTitle}. Pausing job.`
            },
            lastFailureKind: item.failureKind,
            lastError: item.error,
            lastHeartbeatAt: clock.now().toISOString()
          });
          break;
        }
      }

      const quotaInterruption = classifyJobQuotaInterruption(finalData, res?.status);
      const isQuotaError = quotaInterruption.isQuotaOrRateLimit;

      if (abortController.signal.aborted) {
        success = false;
        break;
      }

      if (quotaInterruption.action === 'blockedByQuota') {
        const resumeAfter = new Date(clock.now().getTime() + (quotaInterruption.retryAfterMs ?? 24 * 60 * 60_000)).toISOString();
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
        store.appendItem(jobId, item);
        store.updateJob(jobId, {
          status: 'blockedByQuota',
          resumeAfter,
          blockedReason: 'blockedByQuota',
          affectedSampleIds: [sampleId],
          blockedSampleIds: Array.from(new Set([...(store.getJob(jobId)?.blockedSampleIds || []), sampleId])),
          attemptState: item.attemptState,
          lastEvent: { type: 'jobPaused', timestamp: clock.now().toISOString(), sampleId, message: `Daily quota exhausted while processing ${sampleTitle}` },
          lastFailureKind: finalData?.failureKind,
          lastError: finalData?.error,
          lastHeartbeatAt: clock.now().toISOString()
        });
        break;
      }

      if (isQuotaError && attempt < maxAttemptsPerSample) {
        // We will retry bounded transient 429/rate-limit responses, but daily quota exhaustion pauses the job.
        let delayMs = quotaInterruption.retryAfterMs ?? DEFAULT_RATE_LIMIT_PAUSE_MS;
        if (delayMs > SHORT_RETRY_DELAY_MS) delayMs = SHORT_RETRY_DELAY_MS;

        const nextRetryAtDate = new Date(clock.now().getTime() + delayMs);
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

        store.updateJob(jobId, {
          resumeAfter: nextRetryAt,
          pauseReason: 'pausedForRateLimit',
          affectedSampleIds: [sampleId],
          attemptState: item.attemptState,
          lastEvent: {
            type: 'quotaBackoffWaiting',
            timestamp: clock.now().toISOString(),
            sampleId: sampleId,
            message: `Quota/Rate limit hit for ${sampleTitle}. Waiting ${Math.round(delayMs/1000)}s before retry.`
          },
          lastHeartbeatAt: clock.now().toISOString()
        });

        // Sleep
        if (deps.scheduler) {
          await deps.scheduler.sleep(delayMs);
        } else {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        if (abortController.signal.aborted) {
           success = false;
           break;
        }
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
               const resumeAfter = new Date(clock.now().getTime() + delayMs).toISOString();
               item.status = 'pausedForRateLimit';
               item.error = finalData?.error;
               item.failureKind = finalData?.failureKind || 'providerRateLimited';
               item.resumeAfter = resumeAfter;
               item.pauseReason = 'pausedForRateLimit';
               item.affectedSampleIds = [sampleId];
               item.attemptState = { attempt, maxAttempts: maxAttemptsPerSample, retryExhausted: true };
               store.appendItem(jobId, item);
               store.updateJob(jobId, {
                 status: 'pausedForRateLimit',
                 resumeAfter,
                 pauseReason: 'pausedForRateLimit',
                 affectedSampleIds: [sampleId],
                 attemptState: item.attemptState,
                 lastEvent: { type: 'jobPaused', timestamp: clock.now().toISOString(), sampleId, message: `Rate limit pause scheduled for ${sampleTitle}` },
                 lastFailureKind: finalData?.failureKind,
                 lastError: finalData?.error,
                 lastHeartbeatAt: clock.now().toISOString()
               });
             } else {
               store.updateJob(jobId, {
                 lastEvent: {
                   type: 'sampleRetryExhausted',
                   timestamp: clock.now().toISOString(),
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

    const jobAfterItem = store.getJob(jobId);
    const pausedAfterQuotaOrRateLimit = jobAfterItem?.status === 'blockedByQuota' || jobAfterItem?.status === 'pausedForRateLimit' || jobAfterItem?.status === 'pausedForProviderUnavailable';
    if (pausedAfterQuotaOrRateLimit) {
      break;
    }

    // Now record the final result of the item
    const itemCompletedAtDate = clock.now();
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
      
      const counters = { ...(store.getJob(jobId)?.counters || job.counters) };
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
      
      const completedSampleIds = [...(store.getJob(jobId)?.completedSampleIds || []), sampleId];
      const pendingSampleIds = (store.getJob(jobId)?.pendingSampleIds || []).filter(id => id !== sampleId);
      
      store.appendItem(jobId, item);
      store.updateJob(jobId, {
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
          timestamp: clock.now().toISOString(),
          sampleId: sampleId,
          message: `Sample ${sampleTitle} succeeded`
        },
        lastHeartbeatAt: clock.now().toISOString()
      });
    } else {
      // Failed
      const latestForFailure = store.getJob(jobId);
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
      
      const counters = { ...(store.getJob(jobId)?.counters || job.counters) };
      counters.total = job.targetSampleIds.length;
      if (!isBlockedItem) {
        counters.failureCount++;
      }
      if (item.failureKind === 'jsonParseError' || item.failureKind === 'schemaValidationError') {
        counters.invalidJsonCount++;
      }
      
      const failedSampleIds = isBlockedItem ? (store.getJob(jobId)?.failedSampleIds || []) : [...(store.getJob(jobId)?.failedSampleIds || []), sampleId];
      const blockedSampleIds = isBlockedItem ? Array.from(new Set([...(store.getJob(jobId)?.blockedSampleIds || []), sampleId])) : (store.getJob(jobId)?.blockedSampleIds || []);
      const pendingSampleIds = (store.getJob(jobId)?.pendingSampleIds || []).filter(id => id !== sampleId);
      
      store.appendItem(jobId, item);
      store.updateJob(jobId, {
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
          timestamp: clock.now().toISOString(),
          sampleId: sampleId,
          message: isBlockedItem ? `Sample ${sampleTitle} blocked by provider quota` : `Sample ${sampleTitle} failed: ${item.error || item.failureKind}`
        },
        lastError: item.error,
        lastFailureKind: item.failureKind,
        lastHeartbeatAt: clock.now().toISOString()
      });
    }
  }

  const finalJob = store.getJob(jobId);
  if (finalJob) {
    let completedAt = finalJob.completedAt;
    let durationMs = finalJob.durationMs;
    const nowStr = clock.now().toISOString();
    const nowTime = clock.now().getTime();
    const startTime = finalJob.startedAt ? new Date(finalJob.startedAt).getTime() : nowTime;
    
    if (finalJob.status === 'blockedByQuota' || finalJob.status === 'pausedForRateLimit' || finalJob.status === 'pausedForProviderUnavailable') {
       const processed = new Set([...(finalJob.completedSampleIds || []), ...(finalJob.failedSampleIds || [])]);
       const remaining = finalJob.targetSampleIds.filter(id => !processed.has(id));
       store.updateJob(jobId, {
         pendingSampleIds: remaining,
         blockedSampleIds: Array.from(new Set([...(finalJob.blockedSampleIds || [])])),
         lastEvent: finalJob.lastEvent
       });
    } else if (finalJob.status === 'running') {
       if (abortController.signal.aborted) {
          // If aborted, we shouldn't mark it as completed
          store.updateJob(jobId, {
            status: 'canceled',
            canceledAt: nowStr,
            durationMs: nowTime - startTime,
            lastEvent: {
              type: 'jobCanceled',
              timestamp: nowStr,
              message: 'Job canceled via abort signal'
            }
          });
       } else {
         completedAt = nowStr;
         durationMs = nowTime - startTime;
         const processed = (finalJob.completedSampleIds?.length || 0) + (finalJob.failedSampleIds?.length || 0);
         store.updateJob(jobId, {
           status: processed < finalJob.targetSampleIds.length ? 'partiallyCompleted' : 'completed',
           completedAt,
           durationMs,
           lastEvent: {
             type: 'jobCompleted',
             timestamp: nowStr,
             message: `Job ${jobId} completed`
           }
         });
       }
    } else if (finalJob.status === 'canceled' && !finalJob.durationMs) {
       // if it was canceled during the loop
       completedAt = finalJob.canceledAt || nowStr;
       durationMs = new Date(completedAt).getTime() - startTime;
       store.updateJob(jobId, { durationMs });
    }
  }
  } finally {
    const latest = store.getJob(jobId);
    if (latest && latest.status === 'canceling') {
       const now = clock.now();
       const startMs = latest.startedAt ? new Date(latest.startedAt).getTime() : new Date(latest.createdAt).getTime();
       store.updateJob(jobId, {
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
    deps.runnerRegistry.delete(jobId);
      return { jobId, finalStatus: store.getJob(jobId)?.status || 'unknown' };
  }
  })();

  deps.runnerRegistry.set(jobId, { startedAt: clock.now().toISOString(), abortController, completionPromise });

  return {
    completion: completionPromise,
    abort: () => abortController.abort()
  };
}
