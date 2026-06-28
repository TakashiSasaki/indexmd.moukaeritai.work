import { VISUAL_ANALYSIS_SCHEMA } from "./schema";

export function buildGeminiVisualAnalysisResponseSchema(): any {
  const schema = JSON.parse(JSON.stringify(VISUAL_ANALYSIS_SCHEMA));

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
  // We already removed schemaVersion which used const, but we can do a deep clean if needed.
  // Currently, the canonical schema only has const on schemaVersion, but we can be thorough:
  const removeConst = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(removeConst);
    } else {
      if ('const' in obj) {
        // Just convert const to an enum with one element
        obj.enum = [obj.const];
        delete obj.const;
      }
      for (const key of Object.keys(obj)) {
        removeConst(obj[key]);
      }
    }
  };
  removeConst(schema);

  return schema;
}

export const GEMINI_VISUAL_ANALYSIS_RESPONSE_SCHEMA = buildGeminiVisualAnalysisResponseSchema();
