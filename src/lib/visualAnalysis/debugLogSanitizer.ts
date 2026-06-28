export function sanitizeDebugResponseForLocalStorage(
  mode: 'drive' | 'public',
  response: any,
  options: { storeRawOutputPreviewInDrive: boolean }
): any {
  if (!response) return response;
  
  const sanitized = JSON.parse(JSON.stringify(response));
  
  if (mode === 'drive' && !options.storeRawOutputPreviewInDrive) {
    if (sanitized.parseDiagnostics && typeof sanitized.parseDiagnostics.rawOutputPreview === 'string') {
      sanitized.parseDiagnostics.rawOutputPreview = "[redacted for Drive debug log]";
    }
    if (sanitized.analysisRun?.execution?.jsonRecovery?.rawOutputPreview) {
      sanitized.analysisRun.execution.jsonRecovery.rawOutputPreview = "[redacted for Drive debug log]";
    }
  }
  
  return sanitized;
}
