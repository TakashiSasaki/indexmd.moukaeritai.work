/**
 * Utility functions for the SummaryDebugger component.
 * Kept in a separate pure file to avoid Node.js test runner issues with Vite raw imports.
 */

export function canGenerateSummary(
  inputMode: 'drive' | 'manual',
  fileId: string,
  manualText: string,
  loading: boolean
): boolean {
  if (loading) return false;
  if (inputMode === 'drive') return !!fileId.trim();
  return !!manualText.trim();
}
