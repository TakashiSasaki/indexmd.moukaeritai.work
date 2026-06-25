export function sanitizeResultForResponse(result: any): any {
  if (result.outputMode === "structured") {
    const sanitized = { ...result };
    delete sanitized.rawText;
    return sanitized;
  }
  return result;
}

export function sanitizeResultForCache(result: any): any {
  const sanitized = { ...result };
  delete sanitized.requestPreview;
  delete sanitized.contentSampleSnippet;
  delete sanitized.rawText;
  delete sanitized.rawPrompt;
  delete sanitized.taskPrompt;
  delete sanitized.systemInstruction;
  delete sanitized.customInstruction;
  delete sanitized.rawOutput;
  return sanitized;
}

export function sanitizeResultForHistory(result: any): any {
  const sanitized = { ...result };
  delete sanitized.requestPreview;
  delete sanitized.contentSampleSnippet;
  delete sanitized.rawText;
  delete sanitized.rawPrompt;
  delete sanitized.taskPrompt;
  delete sanitized.systemInstruction;
  delete sanitized.customInstruction;
  delete sanitized.rawOutput;
  return sanitized;
}

export function isDriveContentCacheEnabled(): boolean {
  return process.env.ENABLE_DRIVE_CONTENT_CACHE === "true";
}
