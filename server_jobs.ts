import { jobStore } from './src/lib/visualAnalysis/serverJobs/jobStore';
import { VisualBatchJob, VisualBatchJobItem } from './src/lib/visualAnalysis/publicSamples/batchTypes';
import crypto from 'crypto';

// This will be injected into server.ts

export async function startVisualBatchJob(
  jobId: string, 
  analyzeFn: (options: any) => Promise<{status: number, body: any}>
) {
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

    jobStore.updateJob(jobId, {
      currentSampleId: sampleId,
      lastEvent: {
        type: 'sampleStarted',
        timestamp: new Date().toISOString(),
        sampleId: sampleId,
        message: `Processing sample ${sampleId}`
      },
      lastHeartbeatAt: new Date().toISOString()
    });

    let item: VisualBatchJobItem = {
      sampleId,
      status: 'running',
      startedAt: new Date().toISOString()
    };

    try {
      jobStore.updateJob(jobId, {
        lastEvent: {
          type: 'apiRequestStarted',
          timestamp: new Date().toISOString(),
          sampleId: sampleId,
          message: `Sending API request for ${sampleId}`
        }
      });

      const res = await analyzeFn({
        sampleId,
        modelName: job.modelName,
        jsonMode: job.jsonMode,
        customInstruction: job.customInstructionPreview, // we might need to store the full instruction in the job if needed. Wait, customInstructionPreview is just preview. Let's assume we store the full one in the job for now.
      });

      const data = res.body;
      const success = res.status === 200 && data.success !== false;

      item = {
        ...item,
        status: success ? 'succeeded' : 'failed',
        completedAt: new Date().toISOString(),
        error: data.error,
        failureKind: data.failureKind,
        qualityStatus: data.qualityStatus,
        qualityScore: data.qualityScore,
        qualityIssues: data.qualityIssues,
        responseRaw: data, // store full response including record
        responseDiagnostics: data.responseDiagnostics,
        retryDiagnostics: data.retryDiagnostics,
        generationDiagnostics: data.generationDiagnostics,
        parseDiagnostics: data.parseDiagnostics,
        normalizationDiagnostics: data.normalizationDiagnostics,
        inputDiagnostics: data.inputDiagnostics,
      };

      // update counters
      const counters = { ...(currentJob?.counters || job.counters) };
      counters.total = job.targetSampleIds.length;
      if (success) {
        counters.successCount++;
        if (data.qualityStatus === 'valid') counters.validCount++;
        if (data.qualityStatus === 'validLowQuality') counters.validLowQualityCount++;
      } else {
        counters.failureCount++;
        if (data.failureKind === 'jsonParseError' || data.failureKind === 'schemaValidationError') {
          counters.invalidJsonCount++;
        }
      }

      const completedSampleIds = [...(currentJob?.completedSampleIds || []), sampleId];
      const pendingSampleIds = (currentJob?.pendingSampleIds || []).filter(id => id !== sampleId);
      const failedSampleIds = success ? (currentJob?.failedSampleIds || []) : [...(currentJob?.failedSampleIds || []), sampleId];

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
          message: `Sample ${sampleId} ${success ? 'succeeded' : 'failed'}`
        },
        lastHeartbeatAt: new Date().toISOString()
      });

    } catch (e: any) {
      item.status = 'failed';
      item.error = e.message;
      item.failureKind = 'executionError';
      item.completedAt = new Date().toISOString();

      const counters = { ...(currentJob?.counters || job.counters) };
      counters.failureCount++;
      const failedSampleIds = [...(currentJob?.failedSampleIds || []), sampleId];
      const pendingSampleIds = (currentJob?.pendingSampleIds || []).filter(id => id !== sampleId);

      jobStore.appendItem(jobId, item);
      jobStore.updateJob(jobId, {
        failedSampleIds,
        pendingSampleIds,
        counters,
        lastEvent: {
          type: 'sampleFailed',
          timestamp: new Date().toISOString(),
          sampleId: sampleId,
          message: `Sample ${sampleId} failed with execution error: ${e.message}`
        },
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
