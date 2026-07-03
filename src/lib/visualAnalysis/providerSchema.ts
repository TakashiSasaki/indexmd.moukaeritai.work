import { VISUAL_ANALYSIS_SCHEMA } from "./schema";

export const GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_NAME = "gemini-visual-analysis-response-schema";
export const GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA_VERSION = "provider-adapter.v0.1.0";

export function buildGeminiVisualAnalysisResponseSchema(canonicalSchema: any): any {
  const schema = JSON.parse(JSON.stringify(canonicalSchema));

  // Remove top-level schema properties that might confuse Gemini API
  delete schema.$schema;
  delete schema.$id;
  delete schema.title;

  // Remove schemaVersion from properties and required
  if (schema.properties && schema.properties.schemaVersion) {
    delete schema.properties.schemaVersion;
  }
  
  if (Array.isArray(schema.required)) {
    schema.required = schema.required.filter((r: string) => r !== "schemaVersion");
  }

  // Remove const since some providers don't like it in response schema
  const removeConstAndAdditional = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(removeConstAndAdditional);
    } else {
      if ('const' in obj) {
        // Just convert const to an enum with one element
        obj.enum = [obj.const];
        delete obj.const;
      }
      if ('additionalProperties' in obj) {
        delete obj.additionalProperties;
      }
      for (const key of Object.keys(obj)) {
        removeConstAndAdditional(obj[key]);
      }
    }
  };
  removeConstAndAdditional(schema);

  return schema;
}

export const GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA = buildGeminiVisualAnalysisResponseSchema(VISUAL_ANALYSIS_SCHEMA);
