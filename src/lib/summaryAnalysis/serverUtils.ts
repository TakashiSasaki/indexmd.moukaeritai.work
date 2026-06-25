import { SCHEMA_VERSION_V12 } from "./schema";
import { getSummaryAnalysisV12ValidationErrors } from "./validate";
import { normalizeAndRepairSummaryAnalysisV12 } from "./repair";
import { SummaryAnalysisResultV12 } from "./types";
import { generateContentWithRetry } from "../gemini";

async function repairOutputWithLLM(
  targetModel: string,
  candidateJson: string,
  validationErrors: any[],
  configOption: any
): Promise<string> {
  const repairPrompt = `
You are a deterministic JSON repair agent.
The following JSON failed strict schema and vocabulary validation.
Fix ONLY the invalid schema fields and controlled vocabulary fields mentioned in the validation errors.
DO NOT invent new facts. DO NOT add raw private content.
PRESERVE ALL EXISTING FACTS exactly as they are.
DO NOT use markdown fences (e.g. \`\`\`json).
RETURN ONLY JSON.

Validation Errors:
${JSON.stringify(validationErrors, null, 2)}

Candidate JSON:
${candidateJson}
  `.trim();

  const repairConfig = {
    ...configOption,
    responseSchema: undefined, 
    systemInstruction: undefined
  };

  const aiRes = await generateContentWithRetry(targetModel, [{ text: repairPrompt }], 2, repairConfig);
  const text = aiRes.text?.trim() || "{}";
  return text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
}

export async function processStructuredSummaryOutput(
  summaryText: string,
  targetModel: string,
  configOption: any
): Promise<{
  structured?: SummaryAnalysisResultV12;
  schemaVersion: string;
  summary?: string;
  warnings?: string[];
  validationErrors?: any[];
  error?: string;
  structuredParseFailed?: boolean;
  repairApplied?: boolean;
  repairFallbackUsed?: boolean;
  rawText: string;
}> {
  const result: any = {
    schemaVersion: SCHEMA_VERSION_V12,
    rawText: summaryText
  };

  try {
    const parsed = JSON.parse(summaryText);
    let { repaired: normalized, warnings } = normalizeAndRepairSummaryAnalysisV12(parsed);
    let validationErrors = getSummaryAnalysisV12ValidationErrors(normalized);
    let repairFallbackUsed = false;

    if (validationErrors.length > 0) {
      const repairedText = await repairOutputWithLLM(targetModel, summaryText, validationErrors, configOption);
      try {
        const repairedParsed = JSON.parse(repairedText);
        const repairResult = normalizeAndRepairSummaryAnalysisV12(repairedParsed);
        const newValidationErrors = getSummaryAnalysisV12ValidationErrors(repairResult.repaired);
        
        if (newValidationErrors.length === 0) {
          normalized = repairResult.repaired;
          validationErrors = [];
          warnings = [...warnings, ...repairResult.warnings, "Resolved validation errors using repair-only LLM fallback."];
          repairFallbackUsed = true;
        } else {
          validationErrors = newValidationErrors;
          warnings = [...warnings, "Repair-only LLM fallback also failed validation."];
        }
      } catch (e: any) {
        warnings = [...warnings, `Repair-only LLM fallback failed to parse as JSON: ${e.message}`];
      }
    }

    if (validationErrors.length === 0) {
      result.structured = normalized;
      result.summary = normalized.summary?.oneLine || normalized.summary?.detailed || normalized.titleInfo?.displayTitle?.value || "No summary generated";
      result.repairApplied = warnings.length > 0;
      result.repairFallbackUsed = repairFallbackUsed;
      if (warnings.length > 0) result.warnings = warnings;
    } else {
      result.structuredParseFailed = true;
      result.error = "Structured output validation failed";
      result.validationErrors = validationErrors;
      if (warnings.length > 0) result.warnings = warnings;
    }
  } catch (e: any) {
    result.structuredParseFailed = true;
    result.error = "JSON parse failed: " + e.message;
  }

  return result;
}
