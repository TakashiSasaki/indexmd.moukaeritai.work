import { jobStore } from './jobStore';
import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';
import { evaluateSampleComparison } from '../publicSamples/compare';

export const activeRunners = new Map<string, { startedAt: string; abortController?: AbortController }>();

export function isRunnerActive(jobId: string) {
  return activeRunners.has(jobId);
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

  for (const sampleId of job.targetSampleIds) {
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
    if (currentJob?.status === 'canceled' || currentJob?.status === 'paused') {
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
      const failureKind = finalData?.failureKind;
      const generationDiagnostics =
        finalData?.record?.diagnostics?.generation ??
        finalData?.generationDiagnostics;

      const providerStatus = generationDiagnostics?.providerStatus;
      const isQuotaError = 
        failureKind === 'providerQuotaExceeded' || 
        failureKind === 'providerRateLimited' ||
        failureKind === 'rateLimited' ||
        providerStatus === 'RESOURCE_EXHAUSTED' ||
        providerStatus === 'QUOTA_EXCEEDED' ||
        res?.status === 429;
      
      const attemptCompletedAt = new Date();
      const attemptDurationMs = attemptCompletedAt.getTime() - attemptStartedAtDate.getTime();

      if (isQuotaError && attempt < maxAttemptsPerSample) {
        // We will retry
        let delayMs = 60_000;
        const retryAfterStr = finalData?.responseDiagnostics?.headers?.['retry-after'];
        if (retryAfterStr) {
          const parsed = parseInt(retryAfterStr, 10);
          if (!isNaN(parsed) && parsed > 0) {
             delayMs = parsed * 1000;
          }
        }
        // Cap delay to 5 minutes
        if (delayMs > 5 * 60_000) delayMs = 5 * 60_000;

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
          nextRetryAt
        });
        
        item.nextRetryAt = nextRetryAt;

        jobStore.updateJob(jobId, {
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
        break;
      }
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
      item = {
        ...item,
        status: 'failed',
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
      counters.failureCount++;
      counters.reviewFailCount++;
      counters.expectedComparisonFailCount++;
      if (item.failureKind === 'jsonParseError' || item.failureKind === 'schemaValidationError') {
        counters.invalidJsonCount++;
      }
      
      const failedSampleIds = [...(jobStore.getJob(jobId)?.failedSampleIds || []), sampleId];
      const pendingSampleIds = (jobStore.getJob(jobId)?.pendingSampleIds || []).filter(id => id !== sampleId);
      
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
    }
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
