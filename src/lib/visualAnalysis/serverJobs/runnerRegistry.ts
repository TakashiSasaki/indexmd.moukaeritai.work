export interface RunnerCompletionResult {
  jobId: string;
  finalStatus: string;
}

export class RunnerRegistry {
  private activeRunners = new Map<string, { startedAt: string; abortController?: AbortController; completionPromise?: Promise<RunnerCompletionResult> }>();

  isActive(jobId: string): boolean {
    return this.activeRunners.has(jobId);
  }

  set(jobId: string, data: { startedAt: string; abortController?: AbortController; completionPromise?: Promise<RunnerCompletionResult> }) {
    this.activeRunners.set(jobId, data);
  }

  async waitForJob(jobId: string): Promise<RunnerCompletionResult | undefined> {
    const runner = this.activeRunners.get(jobId);
    if (!runner?.completionPromise) {
      return undefined;
    }
    return runner.completionPromise;
  }

  get(jobId: string) {
    return this.activeRunners.get(jobId);
  }

  delete(jobId: string) {
    this.activeRunners.delete(jobId);
  }

  abort(jobId: string) {
    const runner = this.activeRunners.get(jobId);
    if (runner?.abortController) {
      runner.abortController.abort();
    }
  }

  abortAndDelete(jobId: string) {
    this.abort(jobId);
    this.delete(jobId);
  }
}
