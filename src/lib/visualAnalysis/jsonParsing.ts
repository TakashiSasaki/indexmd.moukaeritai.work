export interface VisualJsonParseAttempt {
  requestAttempt?: number;
  mode: "direct" | "fenceStripped" | "extractedObject" | "retryFailed";
  success: boolean;
  errorMessage?: string;
}

export interface VisualJsonParseDiagnostics {
  failureKind?: "jsonParseError";
  rawOutputLength: number;
  rawOutputPreview: string;
  parseErrorMessage?: string;
  attempts: VisualJsonParseAttempt[];
}

export type VisualJsonParseResult =
  | {
      ok: true;
      parsed: any;
      parseMode: "direct" | "fenceStripped" | "extractedObject";
      diagnostics: VisualJsonParseDiagnostics;
    }
  | {
      ok: false;
      diagnostics: VisualJsonParseDiagnostics;
    };

function truncateForPreview(text: string, maxLength: number = 2000): string {
  if (text.length <= maxLength) return text;
  const half = Math.floor(maxLength / 2) - 20;
  return text.substring(0, half) + "\n\n... [TRUNCATED] ...\n\n" + text.substring(text.length - half);
}

function extractBalancedObject(text: string): string | null {
  const startIdx = text.indexOf('{');
  if (startIdx === -1) return null;

  let braceCount = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;

      if (braceCount === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx !== -1) {
    return text.substring(startIdx, endIdx + 1);
  }
  
  return null;
}

export function parseModelJsonOutput(outputText: string, requestAttempt: number = 1): VisualJsonParseResult {
  const attempts: VisualJsonParseAttempt[] = [];
  const rawOutputPreview = truncateForPreview(outputText);
  const rawOutputLength = outputText.length;

  let parseErrorMessage: string | undefined;

  // 1. Direct parse
  try {
    const parsed = JSON.parse(outputText);
    attempts.push({ requestAttempt, mode: "direct", success: true });
    return {
      ok: true,
      parsed,
      parseMode: "direct",
      diagnostics: {
        rawOutputLength,
        rawOutputPreview,
        attempts
      }
    };
  } catch (e: any) {
    parseErrorMessage = e.message;
    attempts.push({ requestAttempt, mode: "direct", success: false, errorMessage: e.message });
  }

  // 2. Fence stripped
  const cleaned = outputText.replace(/^```(json)?|```$/gm, '').trim();
  if (cleaned !== outputText.trim()) {
    try {
      const parsed = JSON.parse(cleaned);
      attempts.push({ requestAttempt, mode: "fenceStripped", success: true });
      return {
        ok: true,
        parsed,
        parseMode: "fenceStripped",
        diagnostics: {
          rawOutputLength,
          rawOutputPreview,
          attempts
        }
      };
    } catch (e: any) {
      parseErrorMessage = e.message;
      attempts.push({ requestAttempt, mode: "fenceStripped", success: false, errorMessage: e.message });
    }
  }

  // 3. Balanced object extraction
  const extracted = extractBalancedObject(outputText);
  if (extracted && extracted !== cleaned && extracted !== outputText.trim()) {
    try {
      const parsed = JSON.parse(extracted);
      attempts.push({ requestAttempt, mode: "extractedObject", success: true });
      return {
        ok: true,
        parsed,
        parseMode: "extractedObject",
        diagnostics: {
          rawOutputLength,
          rawOutputPreview,
          attempts
        }
      };
    } catch (e: any) {
      parseErrorMessage = e.message;
      attempts.push({ requestAttempt, mode: "extractedObject", success: false, errorMessage: e.message });
    }
  }

  return {
    ok: false,
    diagnostics: {
      failureKind: "jsonParseError",
      rawOutputLength,
      rawOutputPreview,
      parseErrorMessage,
      attempts
    }
  };
}
