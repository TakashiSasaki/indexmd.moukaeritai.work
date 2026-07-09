import Ajv from "ajv";
import { TEXT_ANALYSIS_RECORD_SCHEMA_V01 } from "./recordSchema.js";
import { validateSummaryAnalysisV12, getSummaryAnalysisV12ValidationErrors } from "./validate.js";

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat("date-time", {
  type: "string",
  validate: (str: string) => !isNaN(Date.parse(str))
});
const validateSchema = ajv.compile(TEXT_ANALYSIS_RECORD_SCHEMA_V01);

export function getTextAnalysisRecordValidationErrors(value: any): string[] {
  const errors: string[] = [];

  if (!value || typeof value !== "object") {
    errors.push("Value is not an object");
    return errors;
  }

  const valid = validateSchema(value);
  if (!valid && validateSchema.errors) {
    for (const err of validateSchema.errors) {
      const path = err.instancePath || "";
      errors.push(`Schema error at ${path}: ${err.message}`);
    }
  }

  if (value.schemaVersion !== "text-analysis-record.v0.1.0") {
    errors.push(`schemaVersion must be text-analysis-record.v0.1.0`);
  }

  const status = value.status;
  if (status && typeof status === "object") {
    if (status.success === true) {
      if (!value.summaryAnalysis) {
        errors.push("summaryAnalysis is required when status.success is true");
      }
    } else {
      if (!status.error && !status.failureKind) {
        errors.push("status.error or status.failureKind is required when status.success is false");
      }
    }
  }

  if (value.summaryAnalysis) {
    const summaryErrors = getSummaryAnalysisV12ValidationErrors(value.summaryAnalysis);
    for (const err of summaryErrors) {
      errors.push(`summaryAnalysis error: ${err}`);
    }
  }
  
  // executionPrivate or customInstruction should not leak directly into run
  if (value.analysisRun && typeof value.analysisRun === "object") {
    if (value.analysisRun.prompt && (value.analysisRun.prompt as any).customInstruction) {
      errors.push("analysisRun.prompt should not contain raw customInstruction text");
    }
    if ((value.analysisRun as any).executionPrivate) {
      errors.push("analysisRun should not contain executionPrivate");
    }
  }

  return errors;
}

export function validateTextAnalysisRecord(value: any): boolean {
  return getTextAnalysisRecordValidationErrors(value).length === 0;
}
