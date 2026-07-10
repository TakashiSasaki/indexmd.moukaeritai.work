export interface SchemaCompilationResult {
  schema: any;
  compilerName: string;
  compilerVersion: string;
}

export class SchemaCompilationError extends Error {
  constructor(
    public path: string,
    message: string
  ) {
    super(`Schema compilation failed at ${path || "root"}: ${message}`);
    this.name = "SchemaCompilationError";
    Object.setPrototypeOf(this, SchemaCompilationError.prototype);
  }
}

const ALLOWED_KEYS = new Set([
  "type", "properties", "items", "required", "description", "enum", "format", "nullable"
]);

const REJECTED_KEYWORDS = [
  "oneOf", "allOf", "not", "$ref", "dependencies", "patternProperties", "propertyNames"
];

export function compileProviderSchema(sourceSchema: any): SchemaCompilationResult {
  const compilerName = "RecursiveAllowlistCompiler";
  const compilerVersion = "1.1.0";
  
  if (!sourceSchema) {
    throw new SchemaCompilationError("", "Schema is required");
  }

  const compiled = compileNode(sourceSchema, "", true);

  // Assertion
  assertNoForbiddenKeys(compiled, "", true);

  return {
    schema: compiled,
    compilerName,
    compilerVersion
  };
}

function compileNode(node: any, path: string, isSchemaNode: boolean): any {
  if (node === null || typeof node !== 'object') {
    return node;
  }
  
  if (Array.isArray(node)) {
    return node.map((item: any, idx: number) => compileNode(item, `${path}[${idx}]`, isSchemaNode));
  }

  // Reject constraint-modifying keywords first
  if (isSchemaNode) {
    for (const key of Object.keys(node)) {
      if (REJECTED_KEYWORDS.includes(key)) {
        throw new SchemaCompilationError(path, `unsupported keyword '${key}' is not allowed`);
      }
    }
  }

  // Handle anyOf first
  if (isSchemaNode && node.anyOf) {
    if (!Array.isArray(node.anyOf)) {
      throw new SchemaCompilationError(path, "anyOf must be an array");
    }
    const hasNull = node.anyOf.some((sub: any) => sub && (sub.type === "null" || (Array.isArray(sub.type) && sub.type.includes("null"))));
    const nonNullOptions = node.anyOf.filter((sub: any) => sub && sub.type !== "null" && !(Array.isArray(sub.type) && sub.type.length === 1 && sub.type[0] === "null"));
    
    if (nonNullOptions.length > 1) {
      throw new SchemaCompilationError(path, "multi-branch non-null 'anyOf' is not supported");
    }

    if (nonNullOptions.length === 1) {
      const baseCompiled = compileNode(nonNullOptions[0], path, isSchemaNode);
      if (hasNull) {
        baseCompiled.nullable = true;
      }
      return baseCompiled;
    } else if (hasNull) {
      return { type: "STRING", nullable: true };
    }
  }

  // Handle required constraint check
  if (isSchemaNode && node.required !== undefined) {
    if (!Array.isArray(node.required)) {
      throw new SchemaCompilationError(path, "required must be an array");
    }
    if (node.required.some((r: any) => typeof r !== 'string')) {
      throw new SchemaCompilationError(path, "required array must contain only strings");
    }
    if (node.type !== undefined) {
      const typeVal = Array.isArray(node.type) ? node.type[0] : node.type;
      if (typeof typeVal === "string" && typeVal.toUpperCase() !== "OBJECT") {
        throw new SchemaCompilationError(path, "required constraints are only supported on OBJECT type nodes");
      }
    }
  }

  const result: any = {};

  // Handle mixed-typed definitions (array type)
  let targetType = node.type;
  let isNullable = node.nullable;
  if (isSchemaNode && Array.isArray(targetType)) {
    const hasNull = targetType.some(t => t && t.toLowerCase() === "null");
    const nonNullTypes = targetType.filter(t => t && t.toLowerCase() !== "null");
    if (hasNull) {
      isNullable = true;
    }
    if (nonNullTypes.length > 1) {
      throw new SchemaCompilationError(path, "multi-type arrays are not supported");
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
  if (isSchemaNode && targetItems !== undefined) {
    if (Array.isArray(targetItems)) {
      if (targetItems.length > 1) {
        throw new SchemaCompilationError(path, "heterogeneous tuple 'items' is not supported");
      }
      targetItems = targetItems[0];
    }
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
         result["items"] = compileNode(targetItems, `${path}.items`, true);
         continue;
      }
      if (key === "nullable" && isNullable !== undefined) {
         result["nullable"] = isNullable;
         continue;
      }

      if (ALLOWED_KEYS.has(key)) {
         if (key === "properties") {
             const compiledProps: any = {};
             for (const [propName, propSchema] of Object.entries(value || {})) {
                 compiledProps[propName] = compileNode(propSchema, path ? `${path}.${propName}` : propName, true);
             }
             result["properties"] = compiledProps;
         } else {
             result[key] = compileNode(value, path, true);
         }
      }
    } else {
      // In properties dictionary, keys are property names, values are schema nodes
      if (key.startsWith("x-")) continue; // still ignore x- prefix for property names, just in case
      result[key] = compileNode(value, path, true);
    }
  }

  // Ensure type, items, and nullable are injected if they were overridden/normalized but missing from key iteration
  if (isSchemaNode) {
    if (targetType !== undefined && result["type"] === undefined) {
      result["type"] = targetType;
    }
    if (targetItems !== undefined && result["items"] === undefined) {
      result["items"] = compileNode(targetItems, `${path}.items`, true);
    }
    if (isNullable !== undefined && result["nullable"] === undefined) {
      result["nullable"] = isNullable;
    }
  }

  return result;
}

export function assertNoForbiddenKeys(schema: any, pathOrIsSchemaNode: string | boolean, isSchemaNodeOverride?: boolean) {
  let path = "";
  let isSchemaNode = true;
  if (typeof pathOrIsSchemaNode === "boolean") {
    isSchemaNode = pathOrIsSchemaNode;
  } else {
    path = pathOrIsSchemaNode || "";
    isSchemaNode = isSchemaNodeOverride !== false;
  }

  if (schema === null || typeof schema !== 'object') {
    return;
  }

  if (Array.isArray(schema)) {
    schema.forEach((item: any, idx: number) => assertNoForbiddenKeys(item, `${path}[${idx}]`, isSchemaNode));
    return;
  }

  for (const [key, value] of Object.entries(schema)) {
    if (isSchemaNode) {
      if (!ALLOWED_KEYS.has(key)) {
        throw new SchemaCompilationError(path, `Forbidden key found in compiled schema: ${key}`);
      }
      if (key === "properties") {
        for (const [propName, propSchema] of Object.entries(value || {})) {
            assertNoForbiddenKeys(propSchema, path ? `${path}.${propName}` : propName, true);
        }
      } else {
        assertNoForbiddenKeys(value, path, true);
      }
    } else {
      assertNoForbiddenKeys(value, path, true);
    }
  }
}
