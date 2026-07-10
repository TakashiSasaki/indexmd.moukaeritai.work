import { jobStore } from './jobStore';
import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';
import { evaluateSampleComparison } from '../publicSamples/compare';

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
    generationDiagnostics?.providerStatus === 'QUOTA_EXCEEDED';

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
    if (currentBeforeStart.status === 'canceled' || currentBeforeStart.status === 'paused') return;

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
    }

    if (!success) {
      const attemptCompletedAt = new Date();
      item.retryExhausted = true;
      item.retryHistory = item.retryHistory || [];
      item.retryHistory.push({
        attempt: 1,
        startedAt: attemptStartedAtDate.toISOString(),
        completedAt: attemptCompletedAt.toISOString(),
        durationMs: attemptCompletedAt.getTime() - attemptStartedAtDate.getTime(),
        failureKind: finalData?.failureKind,
        error: finalData?.error
      });
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
      let completedAt = finalJob.completedAt;
      let durationMs = finalJob.durationMs;
      const nowStr = new Date().toISOString();
      const nowTime = new Date().getTime();
      const startTime = finalJob.startedAt ? new Date(finalJob.startedAt).getTime() : nowTime;
      
      if (finalJob.status === 'running') {
        completedAt = nowStr;
        durationMs = nowTime - startTime;
        jobStore.updateJob(jobId, {
          status: 'completed',
          completedAt,
          durationMs,
          lastEvent: {
            type: 'jobCompleted',
            timestamp: nowStr,
            message: `Job ${jobId} completed`
          }
        });
      } else if (finalJob.status === 'canceled' && !finalJob.durationMs) {
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
