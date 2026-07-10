export interface SchemaCompilationResult {
  schema: any;
  compilerName: string;
  compilerVersion: string;
}

const ALLOWED_KEYS = new Set([
  "type", "properties", "items", "required", "description", "enum", "format", "nullable"
]);

export function compileProviderSchema(sourceSchema: any): SchemaCompilationResult {
  const compilerName = "RecursiveAllowlistCompiler";
  const compilerVersion = "1.0.0";
  
  if (!sourceSchema) {
    throw new Error("Schema is required");
  }

  const compiled = compileNode(sourceSchema, true);

  // Assertion
  assertNoForbiddenKeys(compiled, true);

  return {
    schema: compiled,
    compilerName,
    compilerVersion
  };
}

function compileNode(node: any, isSchemaNode: boolean): any {
  if (node === null || typeof node !== 'object') {
    return node;
  }
  
  if (Array.isArray(node)) {
    return node.map((item: any) => compileNode(item, isSchemaNode));
  }

  const result: any = {};

  for (const [key, value] of Object.entries(node)) {
    if (isSchemaNode) {
      if (key === "const") {
         // Convert const to enum
         result["enum"] = [value];
         continue;
      }
      
      if (ALLOWED_KEYS.has(key)) {
         if (key === "properties") {
             result[key] = compileNode(value, false);
         } else {
             result[key] = compileNode(value, true);
         }
      }
    } else {
      // In properties dictionary, keys are property names, values are schema nodes
      if (key.startsWith("x-")) continue; // still ignore x- prefix for property names, just in case
      result[key] = compileNode(value, true);
    }
  }

  return result;
}

export function assertNoForbiddenKeys(schema: any, isSchemaNode: boolean) {
  if (schema === null || typeof schema !== 'object') {
    return;
  }

  if (Array.isArray(schema)) {
    schema.forEach((item: any) => assertNoForbiddenKeys(item, isSchemaNode));
    return;
  }

  for (const [key, value] of Object.entries(schema)) {
    if (isSchemaNode) {
      if (!ALLOWED_KEYS.has(key)) {
        throw new Error(`Forbidden key found in compiled schema: ${key}`);
      }
      if (key === "properties") {
        assertNoForbiddenKeys(value, false);
      } else {
        assertNoForbiddenKeys(value, true);
      }
    } else {
      assertNoForbiddenKeys(value, true);
    }
  }
}
