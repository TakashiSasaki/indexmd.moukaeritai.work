import { useRef, useEffect } from "react";

export interface RenderTrackerOptions {
  maxRendersPerInterval?: number; // Maximum allowed renders within the interval (default: 5)
  intervalMs?: number; // Time window in milliseconds (default: 300ms)
  onViolation?: (componentName: string, renderCount: number, timePassedMs: number) => void;
}

/**
 * Custom hook to track component rendering behavior at runtime (Proposal B).
 * Safely alerts, logs, or triggers callbacks when a component is caught in an infinite/cascading re-render loop.
 */
export function useRenderTracker(componentName: string, options: RenderTrackerOptions = {}) {
  const { maxRendersPerInterval = 5, intervalMs = 300, onViolation } = options;

  // Use refs to avoid triggering updates of our own (rendering tracking should be side-effect free)
  const renderHistoryRef = useRef<number[]>([]);

  // Synchronously record the current render timestamp
  const now = Date.now();
  renderHistoryRef.current.push(now);

  // Prune old timestamps outside our intervalMs window
  const cutoff = now - intervalMs;
  renderHistoryRef.current = renderHistoryRef.current.filter((timestamp) => timestamp > cutoff);

  const currentCount = renderHistoryRef.current.length;

  if (currentCount > maxRendersPerInterval) {
    const oldestTimestamp = renderHistoryRef.current[0];
    const timePassedMs = now - oldestTimestamp;

    if (onViolation) {
      onViolation(componentName, currentCount, timePassedMs);
    } else {
      console.warn(
        `🚨 [PERFORMANCE ALERT] Component '${componentName}' rendered ${currentCount} times in ${timePassedMs}ms! This exceeds the safe threshold of ${maxRendersPerInterval} renders per ${intervalMs}ms. Please check for state-update loops, un-memoized callbacks, or incorrect useEffect dependencies.`
      );
    }
  }

  // Use useEffect to log mounts and cleanups
  useEffect(() => {
    return () => {
      // Clean up ref on unmount
      renderHistoryRef.current = [];
    };
  }, []);

  return currentCount;
}

/**
 * Coalescing utility to batch multiple rapid individual state updates or callbacks (Proposal B).
 * Instead of triggering a re-render for every single update, it buffers updates
 * and flushes them together, improving Time-to-Interactive.
 */
export function createUpdateCoalescer<T>(
  callback: (updates: T[]) => void,
  delayMs: number = 50
): (update: T) => void {
  let buffer: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  return (update: T) => {
    buffer.push(update);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      const currentBuffer = [...buffer];
      buffer = [];
      timeoutId = null;
      callback(currentBuffer);
    }, delayMs);
  };
}
