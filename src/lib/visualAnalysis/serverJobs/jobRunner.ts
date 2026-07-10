import { jobStore } from './jobStore';
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

  if (quotaClassification === 'dailyQuotaExhausted') {
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
    action: failureKind === 'providerQuotaExceeded' && status !== 429 ? 'blockedByQuota' : 'pausedForRateLimit',
    retryAfterMs,
    retryAfterReason,
    quotaClassification,
  };
}

export const activeRunners = new Map<string, { startedAt: string; abortController?: AbortController }>();

export function isRunnerActive(jobId: string) {
  return activeRunners.has(jobId);
}

function isQuotaErrorResponse(res: any, finalData: any) {
  const failureKind = finalData?.failureKind;
  const generationDiagnostics =
    finalData?.record?.diagnostics?.generation ??
    finalData?.generationDiagnostics;

  const providerStatus = generationDiagnostics?.providerStatus;
  return failureKind === 'providerQuotaExceeded' || 
    failureKind === 'providerRateLimited' ||
    failureKind === 'rateLimited' ||
    generationDiagnostics?.providerFailureKind === 'providerQuotaExceeded' ||
    generationDiagnostics?.providerFailureKind === 'providerRateLimited' ||
    providerStatus === 'RESOURCE_EXHAUSTED' ||
    providerStatus === 'QUOTA_EXCEEDED' ||
    res?.status === 429;
}

function isHardQuotaBlock(finalData: any) {
  const generationDiagnostics =
    finalData?.record?.diagnostics?.generation ??
    finalData?.generationDiagnostics;
  const responseDiagnostics = finalData?.responseDiagnostics;
  const retryAfter = responseDiagnostics?.headers?.['retry-after'] ?? responseDiagnostics?.headers?.['Retry-After'];
  const quotaScope = String(
    finalData?.quotaScope ??
    generationDiagnostics?.quotaScope ??
    generationDiagnostics?.quotaLimitScope ??
    generationDiagnostics?.quota?.scope ??
    generationDiagnostics?.quota?.limitScope ??
    ''
  ).toLowerCase();
  const message = String(finalData?.error ?? generationDiagnostics?.message ?? '').toLowerCase();

  const providerFailureKind = generationDiagnostics?.providerFailureKind;
  const hasQuotaDiagnostics =
    finalData?.failureKind === 'providerQuotaExceeded' ||
    providerFailureKind === 'providerQuotaExceeded' ||
    generationDiagnostics?.quotaExceeded === true ||
    generationDiagnostics?.providerStatus === 'RESOURCE_EXHAUSTED' ||
    generationDiagnostics?.providerStatus === 'QUOTA_EXCEEDED' ||
    generationDiagnostics?.quotaClassification === 'dailyQuotaExhausted';

  return hasQuotaDiagnostics && (
    finalData?.retryable === false ||
    generationDiagnostics?.retryable === false ||
    quotaScope.includes('day') ||
    quotaScope.includes('daily') ||
    message.includes('daily') ||
    message.includes('per day') ||
    message.includes('day quota') ||
    retryAfter === 'daily'
  );
}

export async function startVisualBatchJob(
  jobId: string, 
  deps: {
    analyzeFn: (options: any) => Promise<{status: number, body: any}>,
    getSampleMetadata: (sampleId: string) => Promise<any>
  }
) {
  const { analyzeFn, getSampleMetadata } = deps;
  if (activeRunners.has(jobId)) {
    console.warn(`Runner for job ${jobId} is already active.`);
    return;
  }

  const job = jobStore.getJob(jobId);
  if (!job) return;

  const abortController = new AbortController();
  activeRunners.set(jobId, { startedAt: new Date().toISOString(), abortController });

  const maxConcurrentSamples = 2;
  let hardQuotaBlocked = false;
  let hardQuotaError: string | undefined;
  let hardQuotaFailureKind: string | undefined;
  let hardQuotaResumeAfter: string | undefined;

  const isProcessed = (currentJob: VisualBatchJob, sampleId: string) =>
    currentJob.completedSampleIds.includes(sampleId) ||
    currentJob.failedSampleIds.includes(sampleId) ||
    currentJob.items.some(item => item.sampleId === sampleId && item.status === 'succeeded');

  const blockRemainingSamples = (currentJob: VisualBatchJob) => {
    const blockedSampleIds = currentJob.targetSampleIds.filter(sampleId => !isProcessed(currentJob, sampleId));
    jobStore.updateJob(jobId, {
      status: 'blockedByQuota',
      pendingSampleIds: blockedSampleIds,
      blockedSampleIds,
      blockedReason: 'Provider daily/project/model quota exhausted',
      resumeAfter: hardQuotaResumeAfter,
      lastError: hardQuotaError,
      lastFailureKind: hardQuotaFailureKind,
      lastEvent: {
        type: 'jobBlockedByQuota',
        timestamp: new Date().toISOString(),
        message: 'Job blocked by provider daily quota exhaustion',
        failureKind: hardQuotaFailureKind,
        error: hardQuotaError
      }
    });
  };

  const processSample = async (sampleId: string, baseJob: VisualBatchJob) => {
    const currentBeforeStart = jobStore.getJob(jobId);
    if (!currentBeforeStart || hardQuotaBlocked || isProcessed(currentBeforeStart, sampleId)) return;
    if (currentBeforeStart.status === 'canceling' || currentBeforeStart.cancelRequestedAt) {
      jobStore.updateJob(jobId, {
        status: 'canceled',
        canceledAt: new Date().toISOString(),
        lastEvent: {
          type: 'jobCanceled',
          timestamp: new Date().toISOString(),
          message: 'Job canceled before starting next sample'
        }
      });
      return;
    }
    if (currentBeforeStart.status === 'canceled' || currentBeforeStart.status === 'paused' || currentBeforeStart.status === 'pausedForRateLimit') return;

    let sampleTitle = sampleId;
    let sampleMeta = null;
    try {
      sampleMeta = await getSampleMetadata(sampleId);
      if (sampleMeta && sampleMeta.title) sampleTitle = sampleMeta.title;
    } catch (e) {
      console.warn(`Could not fetch metadata for sample ${sampleId}`, e);
    }

    if (hardQuotaBlocked) return;

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
      attempts: 1,
      retryHistory: []
    };

    let success = false;
    let comparison: any = undefined;
    let finalData: any = null;
    let executionError: string | null = null;
    let res: any = null;
    const attemptStartedAtDate = new Date();

    try {
      jobStore.updateJob(jobId, {
        lastEvent: {
          type: 'apiRequestStarted',
          timestamp: new Date().toISOString(),
          sampleId: sampleId,
          message: `Sending API request for ${sampleTitle}`
        }
      });

      res = await analyzeFn({
        sampleId,
        modelName: baseJob.modelName,
        jsonMode: baseJob.jsonMode,
        customInstruction: baseJob.executionPrivate?.customInstruction || baseJob.customInstructionPreview,
        providerRetryPolicy: {
          maxAttempts: 2,
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

    if (success && sampleMeta) {
      const record = finalData?.record;
      comparison = evaluateSampleComparison(sampleMeta, {
        record,
        visualAnalysis: record?.visualAnalysis,
        expectedMetadata: record?.evaluation?.expectedMetadata
      });
    }

    const quotaError = !success && isQuotaErrorResponse(res, finalData);
    const hardQuotaErrorForSample = quotaError && isHardQuotaBlock(finalData);
    if (hardQuotaErrorForSample) {
      hardQuotaBlocked = true;
      hardQuotaError = finalData?.error;
      hardQuotaFailureKind = finalData?.failureKind;
      const generationDiagnostics =
        finalData?.record?.diagnostics?.generation ??
        finalData?.generationDiagnostics;
      hardQuotaResumeAfter = generationDiagnostics?.retryAfterMs
        ? new Date(Date.now() + generationDiagnostics.retryAfterMs).toISOString()
        : undefined;
    }

    if (!success) {
      const quotaInterruption = classifyJobQuotaInterruption(finalData, res?.status);
      const attemptCompletedAt = new Date();
      const resumeAfter = quotaInterruption.retryAfterMs
        ? new Date(Date.now() + Math.min(quotaInterruption.retryAfterMs, SHORT_RETRY_DELAY_MS)).toISOString()
        : undefined;
      const attemptState = { attempt: 1, maxAttempts: 2, retryExhausted: true };
      item.retryExhausted = true;
      item.resumeAfter = resumeAfter;
      item.affectedSampleIds = [sampleId];
      item.attemptState = attemptState;
      if (quotaInterruption.action === 'blockedByQuota') {
        item.blockedReason = 'blockedByQuota';
      } else if (quotaInterruption.action === 'pausedForRateLimit') {
        item.pauseReason = 'pausedForRateLimit';
      }
      item.retryHistory = item.retryHistory || [];
      item.retryHistory.push({
        attempt: 1,
        startedAt: attemptStartedAtDate.toISOString(),
        completedAt: attemptCompletedAt.toISOString(),
        durationMs: attemptCompletedAt.getTime() - attemptStartedAtDate.getTime(),
        failureKind: finalData?.failureKind,
        error: finalData?.error,
        nextRetryAt: resumeAfter,
        quotaClassification: quotaInterruption.quotaClassification,
        retryAfterReason: quotaInterruption.retryAfterReason,
      });

      if (quotaInterruption.action === 'pausedForRateLimit') {
        const itemCompletedAtDate = new Date();
        const itemDurationMs = itemCompletedAtDate.getTime() - itemStartedAtDate.getTime();
        item = {
          ...item,
          status: 'failed',
          completedAt: itemCompletedAtDate.toISOString(),
          durationMs: itemDurationMs,
          error: finalData?.error || executionError,
          failureKind: finalData?.failureKind || 'providerRateLimited',
          record: finalData?.record,
        };
        const latestJob = jobStore.getJob(jobId) || baseJob;
        const counters = { ...latestJob.counters, total: baseJob.targetSampleIds.length };
        counters.failureCount++;
        counters.reviewFailCount++;
        counters.expectedComparisonFailCount++;
        if (item.failureKind === 'jsonParseError' || item.failureKind === 'schemaValidationError') counters.invalidJsonCount++;
        const failedSampleIds = Array.from(new Set([...latestJob.failedSampleIds, sampleId]));
        const pendingSampleIds = latestJob.pendingSampleIds.filter(id => id !== sampleId);
        jobStore.appendItem(jobId, item);
        jobStore.updateJob(jobId, {
          status: 'paused',
          failedSampleIds,
          pendingSampleIds,
          counters,
          resumeAfter,
          pauseReason: 'pausedForRateLimit',
          blockedReason: undefined,
          affectedSampleIds: [sampleId],
          attemptState,
          lastEvent: {
            type: 'jobPaused',
            timestamp: new Date().toISOString(),
            sampleId,
            message: `Rate limit pause scheduled for ${sampleTitle}`,
          },
          lastError: item.error,
          lastFailureKind: item.failureKind,
          lastHeartbeatAt: new Date().toISOString(),
        });
        return;
      }
    }

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
      const latestJob = jobStore.getJob(jobId) || baseJob;
      const counters = { ...latestJob.counters, total: baseJob.targetSampleIds.length };
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
      const completedSampleIds = Array.from(new Set([...latestJob.completedSampleIds, sampleId]));
      const pendingSampleIds = latestJob.pendingSampleIds.filter(id => id !== sampleId);
      jobStore.appendItem(jobId, item);
      jobStore.updateJob(jobId, {
        completedSampleIds,
        pendingSampleIds,
        counters,
        lastEvent: {
          type: 'sampleSucceeded',
          timestamp: new Date().toISOString(),
          sampleId: sampleId,
          message: `Sample ${sampleTitle} succeeded`
        },
        lastHeartbeatAt: new Date().toISOString()
      });
      return;
    }

    item = {
      ...item,
      status: 'failed',
      completedAt: itemCompletedAtDate.toISOString(),
      durationMs: itemDurationMs,
      error: finalData?.error || executionError,
      failureKind: finalData?.failureKind || 'executionError',
      record: finalData?.record
    };
    const latestJob = jobStore.getJob(jobId) || baseJob;
    const counters = { ...latestJob.counters, total: baseJob.targetSampleIds.length };
    counters.failureCount++;
    counters.reviewFailCount++;
    counters.expectedComparisonFailCount++;
    if (item.failureKind === 'jsonParseError' || item.failureKind === 'schemaValidationError') counters.invalidJsonCount++;
    const failedSampleIds = Array.from(new Set([...latestJob.failedSampleIds, sampleId]));
    const pendingSampleIds = latestJob.pendingSampleIds.filter(id => id !== sampleId);
    jobStore.appendItem(jobId, item);
    jobStore.updateJob(jobId, {
      failedSampleIds,
      pendingSampleIds,
      counters,
      lastEvent: {
        type: 'sampleFailed',
        timestamp: new Date().toISOString(),
        sampleId: sampleId,
        message: `Sample ${sampleTitle} failed: ${item.error || item.failureKind}`
      },
      lastError: item.error,
      lastFailureKind: item.failureKind,
      lastHeartbeatAt: new Date().toISOString()
    });
  };

  try {
    jobStore.updateJob(jobId, { 
      status: 'running', 
      startedAt: new Date().toISOString(),
      resumeAfter: undefined,
      pauseReason: undefined,
      blockedReason: undefined,
      affectedSampleIds: undefined,
      attemptState: undefined,
      lastEvent: {
        type: 'jobStarted',
        timestamp: new Date().toISOString(),
        message: `Job ${jobId} started`
      }
    });

    const queue = job.targetSampleIds.filter(sampleId => !isProcessed(job, sampleId));
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(maxConcurrentSamples, queue.length) }, async () => {
      while (nextIndex < queue.length && !hardQuotaBlocked) {
        const sampleId = queue[nextIndex++];
        await processSample(sampleId, job);
      }
    });

    await Promise.all(workers);

    const finalJobBeforeStatus = jobStore.getJob(jobId);
    if (hardQuotaBlocked && finalJobBeforeStatus) {
      blockRemainingSamples(finalJobBeforeStatus);
    }

    const finalJob = jobStore.getJob(jobId);
    if (finalJob) {
      const nowStr = new Date().toISOString();
      const nowTime = new Date().getTime();
      const startTime = finalJob.startedAt ? new Date(finalJob.startedAt).getTime() : nowTime;

      if (finalJob.status === 'running') {
        const completedAt = nowStr;
        const durationMs = nowTime - startTime;
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
        const completedAt = finalJob.canceledAt || nowStr;
        const durationMs = new Date(completedAt).getTime() - startTime;
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
