import fs from 'fs';
import path from 'path';
import { VisualBatchJob, VisualBatchJobItem } from '../publicSamples/batchTypes';

const JOBS_DIR = path.join(process.cwd(), 'cache', 'visual-batch-jobs');

export class JobStore {
  private jobs: Map<string, VisualBatchJob> = new Map();
  private initialized = false;

  private ensureDir() {
    if (!fs.existsSync(JOBS_DIR)) {
      fs.mkdirSync(JOBS_DIR, { recursive: true });
    }
  }

  private loadJobsFromDisk() {
    this.ensureDir();
    const files = fs.readdirSync(JOBS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(JOBS_DIR, file), 'utf-8');
          if (content.trim() === '') continue;
          const job = JSON.parse(content) as VisualBatchJob;
          if (job && job.jobId) {
            this.jobs.set(job.jobId, job);
          }
        } catch (e) {
          console.error(`Failed to load job from ${file}`, e);
          // Don't crash server on bad JSON
        }
      }
    }
    this.initialized = true;
  }

  private persistJob(job: VisualBatchJob) {
    this.ensureDir();
    try {
      const filePath = path.join(JOBS_DIR, `${job.jobId}.json`);
      const tempPath = filePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(job, null, 2), 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (e) {
      console.error(`Failed to persist job ${job.jobId}`, e);
    }
  }

  public getJob(jobId: string): VisualBatchJob | undefined {
    if (!this.initialized) this.loadJobsFromDisk();
    return this.jobs.get(jobId);
  }

  public listJobs(): VisualBatchJob[] {
    if (!this.initialized) this.loadJobsFromDisk();
    return Array.from(this.jobs.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public createJob(job: VisualBatchJob) {
    if (!this.initialized) this.loadJobsFromDisk();
    this.jobs.set(job.jobId, job);
    this.persistJob(job);
  }

  public updateJob(jobId: string, updates: Partial<VisualBatchJob>) {
    if (!this.initialized) this.loadJobsFromDisk();
    const job = this.jobs.get(jobId);
    if (!job) return;
    const updated = { ...job, ...updates, updatedAt: new Date().toISOString(), revision: (job.revision || 0) + 1 };
    this.jobs.set(jobId, updated);
    this.persistJob(updated);
  }

  public appendItem(jobId: string, item: VisualBatchJobItem) {
    if (!this.initialized) this.loadJobsFromDisk();
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    const index = job.items.findIndex(i => i.sampleId === item.sampleId);
    if (index >= 0) {
      job.items[index] = item;
    } else {
      job.items.push(item);
    }
    
    job.updatedAt = new Date().toISOString();
    job.revision = (job.revision || 0) + 1;
    this.persistJob(job);
  }

  public cancelJob(jobId: string) {
    const job = this.getJob(jobId);
    if (job && (job.status === 'running' || job.status === 'queued')) {
      this.updateJob(jobId, { 
        status: 'canceled',
        canceledAt: new Date().toISOString(),
        lastEvent: {
          type: 'jobCanceled',
          timestamp: new Date().toISOString(),
          message: 'Job canceled by user request'
        }
      });
    }
  }
}

export const jobStore = new JobStore();
