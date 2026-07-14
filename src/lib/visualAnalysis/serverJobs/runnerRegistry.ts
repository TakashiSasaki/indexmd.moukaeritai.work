export interface RunnerCompletionResult {
  jobId: string;
  finalStatus: string;
}

export class RunnerRegistry {
  private activeRunners = new Map<string, { startedAt: string; abortController?: AbortController; completionPromise?: Promise<RunnerCompletionResult> }>();
  private settledResults = new Map<string, RunnerCompletionResult>();
  private settledKeysQueue: string[] = [];
  private static readonly MAX_SETTLED_RESULTS = 128;

  isActive(jobId: string): boolean {
    return this.activeRunners.has(jobId);
  }

  set(jobId: string, data: { startedAt: string; abortController?: AbortController; completionPromise?: Promise<RunnerCompletionResult> }) {
    if (data.completionPromise) {
      data.completionPromise.then((result) => {
        this.addSettledResult(jobId, result);
      }).catch((error) => {
        this.addSettledResult(jobId, { jobId, finalStatus: 'error' });
      });
    }
    this.activeRunners.set(jobId, data);
  }

  private addSettledResult(jobId: string, result: RunnerCompletionResult) {
    if (!this.settledResults.has(jobId)) {
      this.settledKeysQueue.push(jobId);
    }
    this.settledResults.set(jobId, result);

    // Evict oldest if exceeding limit
    if (this.settledKeysQueue.length > RunnerRegistry.MAX_SETTLED_RESULTS) {
      const evictedKey = this.settledKeysQueue.shift();
      if (evictedKey) {
        this.settledResults.delete(evictedKey);
      }
    }
  }

  async waitForJob(jobId: string): Promise<RunnerCompletionResult> {
    if (this.settledResults.has(jobId)) {
      return this.settledResults.get(jobId)!;
    }

    const runner = this.activeRunners.get(jobId);
    if (runner?.completionPromise) {
      return runner.completionPromise;
    }

    throw new Error(`Unknown job: ${jobId}`);
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
