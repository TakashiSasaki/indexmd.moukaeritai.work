import { JobStore } from './JobStoreInterface';
import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';

export interface Clock {
  now(): Date;
}

export class InMemoryJobStore implements JobStore {
  private jobs: Map<string, VisualBatchJob> = new Map();
  private clock: Clock;

  constructor(clock: Clock, initialJobs: VisualBatchJob[] = []) {
    this.clock = clock;
    for (const job of initialJobs) {
      this.jobs.set(job.jobId, JSON.parse(JSON.stringify(job)));
    }
  }

  public getJob(jobId: string): VisualBatchJob | undefined {
    const job = this.jobs.get(jobId);
    return job ? JSON.parse(JSON.stringify(job)) : undefined;
  }

  public listJobs(): VisualBatchJob[] {
    return Array.from(this.jobs.values())
      .map(job => JSON.parse(JSON.stringify(job)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public createJob(job: VisualBatchJob): void {
    this.jobs.set(job.jobId, JSON.parse(JSON.stringify(job)));
  }

  public updateJob(jobId: string, updates: Partial<VisualBatchJob>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const updated = {
      ...job,
      ...updates,
      updatedAt: this.clock.now().toISOString(),
      revision: (job.revision || 0) + 1
    };

    this.jobs.set(jobId, JSON.parse(JSON.stringify(updated)));
  }

  public appendItem(jobId: string, item: VisualBatchJobItem): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const index = job.items.findIndex(i => i.sampleId === item.sampleId);
    if (index >= 0) {
      job.items[index] = JSON.parse(JSON.stringify(item));
    } else {
      job.items.push(JSON.parse(JSON.stringify(item)));
    }

    job.updatedAt = this.clock.now().toISOString();
    job.revision = (job.revision || 0) + 1;
    this.jobs.set(jobId, job);
  }

  public cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'running' || job.status === 'queued')) {
      const nowStr = this.clock.now().toISOString();
      const updated = {
        ...job,
        status: 'canceled' as const,
        canceledAt: nowStr,
        updatedAt: nowStr,
        revision: (job.revision || 0) + 1,
        lastEvent: {
          type: 'jobCanceled' as const,
          timestamp: nowStr,
          message: 'Job canceled by user request'
        }
      };
      this.jobs.set(jobId, JSON.parse(JSON.stringify(updated)));
    }
  }

  public clear(): void {
    this.jobs.clear();
  }
}
