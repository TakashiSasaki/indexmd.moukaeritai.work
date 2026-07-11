export class RunnerRegistry {
  private activeRunners = new Map<string, { startedAt: string; abortController?: AbortController }>();

  isActive(jobId: string): boolean {
    return this.activeRunners.has(jobId);
  }

  set(jobId: string, data: { startedAt: string; abortController?: AbortController }) {
    this.activeRunners.set(jobId, data);
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
