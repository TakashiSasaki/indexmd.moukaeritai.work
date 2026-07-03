export interface VisualJsonParseAttempt {
  requestAttempt?: number;
  mode: "direct" | "fenceStripped" | "extractedObject" | "retryFailed" | "localRepair";
  success: boolean;
  errorMessage?: string;
  repairKinds?: string[];
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
      parseMode: "direct" | "fenceStripped" | "extractedObject" | "localRepair";
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

export function simpleJsonRepair(text: string): string {
  let repaired = text.trim();
  
  // Remove markdown fences if present
  repaired = repaired.replace(/^```(json)?|```$/gm, '').trim();

  // Remove trailing junk (often from truncated/bad generation like '}  issues: []')
  // We can try extracting the outermost matched braces if there's junk at the end
  const extracted = extractBalancedObject(repaired);
  if (extracted) {
    repaired = extracted;
  }

  // Common syntax error 1: dangling commas before closing bracket/brace
  repaired = repaired.replace(/,\s*([\]}])/g, '$1');

  // Common syntax error 2: unescaped control characters like newlines within strings.
  // This is a bit tricky with simple regex, but we can try to escape unescaped literal newlines
  // We'll skip complex unescaped newline fixing for now to avoid corrupting valid json strings that might happen to match our naive regex, 
  // since JSON-only retry will catch it anyway.

  return repaired;
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
  
  // 4. Local Repair (dangling commas, etc.)
  const repaired = simpleJsonRepair(outputText);
  if (repaired !== extracted && repaired !== cleaned && repaired !== outputText.trim()) {
    try {
      const parsed = JSON.parse(repaired);
      attempts.push({ requestAttempt, mode: "localRepair", success: true, repairKinds: ["danglingCommaOrFences"] });
      return {
        ok: true,
        parsed,
        parseMode: "localRepair",
        diagnostics: {
          rawOutputLength,
          rawOutputPreview,
          attempts
        }
      };
    } catch (e: any) {
      parseErrorMessage = e.message;
      attempts.push({ requestAttempt, mode: "localRepair", success: false, errorMessage: e.message, repairKinds: ["danglingCommaOrFences"] });
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
