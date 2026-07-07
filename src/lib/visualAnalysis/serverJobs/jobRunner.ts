import { jobStore } from './jobStore';
import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';
import { evaluateSampleComparison } from '../publicSamples/compare';

export async function startVisualBatchJob(
  jobId: string, 
  deps: {
    analyzeFn: (options: any) => Promise<{status: number, body: any}>,
    getSampleMetadata: (sampleId: string) => Promise<any>
  }
) {
  const { analyzeFn, getSampleMetadata } = deps;
  const job = jobStore.getJob(jobId);
  if (!job) return;

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

    let item: VisualBatchJobItem = {
      sampleId,
      title: sampleTitle,
      status: 'running',
      startedAt: new Date().toISOString()
    };

    try {
      jobStore.updateJob(jobId, {
        lastEvent: {
          type: 'apiRequestStarted',
          timestamp: new Date().toISOString(),
          sampleId: sampleId,
          message: `Sending API request for ${sampleTitle}`
        }
      });

      const res = await analyzeFn({
        sampleId,
        modelName: job.modelName,
        jsonMode: job.jsonMode,
        customInstruction: job.executionPrivate?.customInstruction || job.customInstructionPreview,
      });

      jobStore.updateJob(jobId, {
        lastEvent: {
          type: 'apiResponseReceived',
          timestamp: new Date().toISOString(),
          sampleId: sampleId,
          message: `Received API response for ${sampleTitle} (status: ${res.status})`
        }
      });

      const data = res.body;
      const success = res.status === 200 && data.success !== false;

      let comparison = undefined;
      if (success && sampleMeta) {
        comparison = evaluateSampleComparison(sampleMeta, data);
      }

      item = {
        ...item,
        status: success ? 'succeeded' : 'failed',
        completedAt: new Date().toISOString(),
        error: data.error,
        failureKind: data.failureKind,
        qualityStatus: data.qualityStatus,
        qualityScore: data.qualityScore,
        qualityIssues: data.qualityIssues,
        record: data.record || data, // Try to store record from response
        responseRaw: data, 
        responseDiagnostics: data.responseDiagnostics,
        retryDiagnostics: data.retryDiagnostics,
        generationDiagnostics: data.generationDiagnostics,
        parseDiagnostics: data.parseDiagnostics,
        normalizationDiagnostics: data.normalizationDiagnostics,
        inputDiagnostics: data.inputDiagnostics,
        comparison: comparison
      };

      // update counters
      const counters = { ...(jobStore.getJob(jobId)?.counters || job.counters) };
      counters.total = job.targetSampleIds.length;
      if (success) {
        counters.successCount++;
        if (data.qualityStatus === 'valid') counters.validCount++;
        if (data.qualityStatus === 'validLowQuality') counters.validLowQualityCount++;
        
        if (comparison) {
          if (comparison.overallStatus === 'pass') counters.expectedComparisonPassCount++;
          if (comparison.overallStatus === 'warning') counters.expectedComparisonWarningCount++;
          if (comparison.overallStatus === 'fail') counters.expectedComparisonFailCount++;
          
          if (comparison.reviewStatus === 'pass') counters.reviewPassCount++;
          if (comparison.reviewStatus === 'needs_review') counters.reviewNeedsReviewCount++;
          if (comparison.reviewStatus === 'fail') counters.reviewFailCount++;
        }
      } else {
        counters.failureCount++;
        counters.reviewFailCount++; // Treat failures as review failures too
        if (data.failureKind === 'jsonParseError' || data.failureKind === 'schemaValidationError') {
          counters.invalidJsonCount++;
        }
      }

      const completedSampleIds = [...(jobStore.getJob(jobId)?.completedSampleIds || []), sampleId];
      const pendingSampleIds = (jobStore.getJob(jobId)?.pendingSampleIds || []).filter(id => id !== sampleId);
      const failedSampleIds = success ? (jobStore.getJob(jobId)?.failedSampleIds || []) : [...(jobStore.getJob(jobId)?.failedSampleIds || []), sampleId];

      jobStore.appendItem(jobId, item);
      jobStore.updateJob(jobId, {
        completedSampleIds,
        pendingSampleIds,
        failedSampleIds,
        counters,
        lastEvent: {
          type: success ? 'sampleSucceeded' : 'sampleFailed',
          timestamp: new Date().toISOString(),
          sampleId: sampleId,
          message: `Sample ${sampleTitle} ${success ? 'succeeded' : 'failed'}`
        },
        lastError: success ? undefined : data.error,
        lastFailureKind: success ? undefined : data.failureKind,
        lastHeartbeatAt: new Date().toISOString()
      });

    } catch (e: any) {
      item.status = 'failed';
      item.error = e.message;
      item.failureKind = 'executionError';
      item.completedAt = new Date().toISOString();

      const counters = { ...(jobStore.getJob(jobId)?.counters || job.counters) };
      counters.failureCount++;
      counters.reviewFailCount++;
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
          message: `Sample ${sampleTitle} failed with execution error: ${e.message}`
        },
        lastError: e.message,
        lastFailureKind: 'executionError',
        lastHeartbeatAt: new Date().toISOString()
      });
    }
  }

  const finalJob = jobStore.getJob(jobId);
  if (finalJob && finalJob.status === 'running') {
    jobStore.updateJob(jobId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      lastEvent: {
        type: 'jobCompleted',
        timestamp: new Date().toISOString(),
        message: `Job ${jobId} completed`
      }
    });
  }
}
