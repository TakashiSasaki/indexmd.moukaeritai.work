import { SCHEMA_VERSION_V12 } from "./schema";
import { getSummaryAnalysisV12ValidationErrors } from "./validate";
import { normalizeAndRepairSummaryAnalysisV12 } from "./repair";
import { SummaryAnalysisResultV12 } from "./types";
import { generateContentWithRetry } from "../gemini";
import { getModelCapability } from "../modelCapabilities";
import { evaluateStructuredSummaryQuality } from "./qualityGate";

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
  failureKind?: "providerError" | "emptyStructuredOutput" | "jsonParseError" | "schemaValidationError" | "controlledVocabularyValidationError" | "repairFallbackFailed";
  emptyStructuredOutput?: boolean;
  underGeneratedStructuredOutput?: boolean;
  effectiveStructuredExecutionMode?: string;
  supportsNativeResponseSchema?: boolean;
  providerFamily?: string;
  responseSchemaEnabled?: boolean;
  qualityStatus?: "valid" | "validWithRepair" | "validLowQuality" | "invalid";
  qualityScore?: number;
  qualityIssues?: any[];
  recommendedForPersistence?: boolean;
  recommendedForIndexMdCandidate?: boolean;
  experimentalModel?: boolean;
}> {
  const cap = getModelCapability(targetModel);
  const result: any = {
    schemaVersion: SCHEMA_VERSION_V12,
    rawText: summaryText,
    effectiveStructuredExecutionMode: configOption?.effectiveStructuredExecutionMode || cap.structuredExecutionMode,
    supportsNativeResponseSchema: configOption?.supportsNativeResponseSchema !== undefined ? configOption.supportsNativeResponseSchema : cap.supportsNativeResponseSchema,
    providerFamily: configOption?.providerFamily || cap.providerFamily,
    responseSchemaEnabled: configOption?.responseSchemaEnabled !== undefined ? configOption.responseSchemaEnabled : (cap.structuredExecutionMode === "nativeSchema")
  };

  const trimmed = (summaryText || "").trim();
  if (!trimmed) {
    result.structuredParseFailed = true;
    result.error = "JSON parse failed: Empty output";
    result.failureKind = "jsonParseError";
    return result;
  }

  try {
    const cleanJson = trimmed.replace(/^```(json)?\s*/i, "").replace(/```$/i, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (e: any) {
      result.structuredParseFailed = true;
      result.error = "JSON parse failed: " + e.message;
      result.failureKind = "jsonParseError";
      return result;
    }

    if (configOption?.extractedCustomSchema) {
      result.structured = parsed;
      result.summary = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
      result.validationErrors = [];
      result.warnings = ["Used custom extracted JSON schema."];
      result.qualityStatus = "excellent";
      result.qualityScore = 100;
      result.qualityIssues = [];
      return result;
    }

    // Detect Empty Structured Output
    const rootSections = [
      "summary", "titleInfo", "documentKindInfo", "fileFormatInfo", 
      "subjectAreas", "languageInfo", "indexing", "extractedFacts", "quality"
    ];
    const hasNoSections = !parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0 || rootSections.every(sec => !(sec in parsed));
    if (hasNoSections) {
      result.error = "Structured output was empty or under-generated";
      result.failureKind = "emptyStructuredOutput";
      result.emptyStructuredOutput = true;
      result.structuredParseFailed = false;
      return result;
    }

    let { repaired: normalized, warnings } = normalizeAndRepairSummaryAnalysisV12(parsed);

    // Detect Under-Generated Structured Output
    const hasOneLine = !!(normalized?.summary?.oneLine && normalized.summary.oneLine.trim());
    const hasDetailed = !!(normalized?.summary?.detailed && normalized.summary.detailed.trim());
    const hasDisplayTitle = !!(normalized?.titleInfo?.displayTitle?.value && normalized.titleInfo.displayTitle.value.trim());
    const hasInferredTitle = !!(normalized?.titleInfo?.inferredTitle && normalized.titleInfo.inferredTitle.trim());
    const presentSections = rootSections.filter(sec => sec in parsed);
    const mostMissing = presentSections.length <= 2;

    const isUnderGenerated = (!hasOneLine && !hasDetailed) || (!hasDisplayTitle && !hasInferredTitle) || mostMissing;
    if (isUnderGenerated) {
      result.error = "Structured output was empty or under-generated";
      result.failureKind = "underGeneratedStructuredOutput";
      result.underGeneratedStructuredOutput = true;
      result.structuredParseFailed = false;
      return result;
    }

    let validationErrors = getSummaryAnalysisV12ValidationErrors(normalized);
    let repairFallbackUsed = false;

    if (validationErrors.length > 0) {
      const hasVocabError = validationErrors.some((err: any) => err.path?.includes("controlledVocabulary"));
      result.failureKind = hasVocabError ? "controlledVocabularyValidationError" : "schemaValidationError";

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
          result.failureKind = "repairFallbackFailed";
        }
      } catch (e: any) {
        warnings = [...warnings, `Repair-only LLM fallback failed to parse as JSON: ${e.message}`];
        result.failureKind = "repairFallbackFailed";
      }
    }

    if (validationErrors.length === 0) {
      result.structured = normalized;
      result.summary = normalized.summary?.oneLine || normalized.summary?.detailed || normalized.titleInfo?.displayTitle?.value || "No summary generated";
      result.repairApplied = warnings.length > 0;
      result.repairFallbackUsed = repairFallbackUsed;
      if (warnings.length > 0) result.warnings = warnings;

      // Evaluate Quality
      const qualityReport = evaluateStructuredSummaryQuality(normalized, {
        modelName: targetModel,
        providerFamily: result.providerFamily,
        effectiveStructuredExecutionMode: result.effectiveStructuredExecutionMode,
        supportsNativeResponseSchema: result.supportsNativeResponseSchema,
        responseSchemaEnabled: result.responseSchemaEnabled,
        repairApplied: result.repairApplied,
        repairFallbackUsed: result.repairFallbackUsed,
        warnings: result.warnings
      });

      result.qualityStatus = qualityReport.status;
      result.qualityScore = qualityReport.score;
      result.qualityIssues = qualityReport.issues;
      result.recommendedForPersistence = qualityReport.recommendedForPersistence;
      result.recommendedForIndexMdCandidate = qualityReport.recommendedForIndexMdCandidate;
      result.experimentalModel = qualityReport.experimentalModel;

      if (qualityReport.status === "invalid") {
        result.structuredParseFailed = true;
        result.error = "Structured output failed quality gate requirements: " + qualityReport.issues.map(i => i.message).join(", ");
        result.validationErrors = qualityReport.issues.map(iss => ({
          path: "qualityGate",
          message: iss.message,
          keyword: iss.code
        }));
      }
    } else {
      result.structuredParseFailed = true;
      result.error = "Structured output validation failed";
      result.validationErrors = validationErrors;
      if (warnings.length > 0) result.warnings = warnings;
    }
  } catch (e: any) {
    result.structuredParseFailed = true;
    result.error = "JSON parse failed: " + e.message;
    result.failureKind = "jsonParseError";
  }

  return result;
}
