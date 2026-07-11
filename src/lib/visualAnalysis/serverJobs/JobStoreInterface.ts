import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';

export interface JobStore {
  getJob(jobId: string): VisualBatchJob | undefined;
  listJobs(): VisualBatchJob[];
  createJob(job: VisualBatchJob): void;
  updateJob(jobId: string, updates: Partial<VisualBatchJob>): void;
  appendItem(jobId: string, item: VisualBatchJobItem): void;
  cancelJob(jobId: string): void;
}
