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

  // Handle anyOf first
  if (isSchemaNode && node.anyOf && Array.isArray(node.anyOf)) {
    const hasNull = node.anyOf.some((sub: any) => sub && (sub.type === "null" || (Array.isArray(sub.type) && sub.type.includes("null"))));
    const nonNullOptions = node.anyOf.filter((sub: any) => sub && sub.type !== "null" && !(Array.isArray(sub.type) && sub.type.length === 1 && sub.type[0] === "null"));
    
    if (nonNullOptions.length > 0) {
      const baseCompiled = compileNode(nonNullOptions[0], isSchemaNode);
      if (hasNull) {
        baseCompiled.nullable = true;
      }
      return baseCompiled;
    } else if (hasNull) {
      return { type: "STRING", nullable: true };
    }
  }

  const result: any = {};

  // Handle mixed-typed definitions (array type)
  let targetType = node.type;
  let isNullable = node.nullable;
  if (isSchemaNode && Array.isArray(targetType)) {
    const hasNull = targetType.includes("null") || targetType.includes("NULL");
    const nonNullTypes = targetType.filter(t => t && t.toLowerCase() !== "null");
    if (hasNull) {
      isNullable = true;
    }
    targetType = nonNullTypes.length > 0 ? nonNullTypes[0] : "string";
  }

  // Normalize type to uppercase
  if (isSchemaNode && typeof targetType === "string") {
    const t = targetType.toUpperCase();
    if (["OBJECT", "ARRAY", "STRING", "NUMBER", "INTEGER", "BOOLEAN", "NULL"].includes(t)) {
      targetType = t;
    }
  }

  // Handle array items
  let targetItems = node.items;
  if (isSchemaNode && Array.isArray(targetItems)) {
    targetItems = targetItems[0];
  }

  for (const [key, value] of Object.entries(node)) {
    if (isSchemaNode) {
      if (key === "const") {
         // Convert const to enum
         result["enum"] = [value];
         continue;
      }
      
      // If we are overriding type, items or nullable
      if (key === "type" && targetType !== undefined) {
         result["type"] = targetType;
         continue;
      }
      if (key === "items" && targetItems !== undefined) {
         result["items"] = compileNode(targetItems, true);
         continue;
      }
      if (key === "nullable" && isNullable !== undefined) {
         result["nullable"] = isNullable;
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

  // Ensure type, items, and nullable are injected if they were overridden/normalized but missing from key iteration
  if (isSchemaNode) {
    if (targetType !== undefined && result["type"] === undefined) {
      result["type"] = targetType;
    }
    if (targetItems !== undefined && result["items"] === undefined) {
      result["items"] = compileNode(targetItems, true);
    }
    if (isNullable !== undefined && result["nullable"] === undefined) {
      result["nullable"] = isNullable;
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
