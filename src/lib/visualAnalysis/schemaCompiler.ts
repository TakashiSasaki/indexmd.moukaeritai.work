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

// ENFORCEMENT-NEUTRAL CONSTRAINTS (Intentionally dropped because they are enforcement-neutral for Gemini provider schemas)
// - "additionalProperties": Gemini native schema does not enforce strict property exclusion.
// - "minimum" / "maximum": Numeric range constraints are ignored by the Gemini provider.
// - "minLength" / "maxLength": String length bounds are ignored by the Gemini provider.
const DROPPED_KEYWORDS = [
  "additionalProperties", "minimum", "maximum", "minLength", "maxLength"
];

// SEMANTICS-CHANGING UNSUPPORTED CONSTRAINTS (Strictly rejected because they change structural contract verification)
const REJECTED_KEYWORDS = [
  "oneOf", "allOf", "not", "$ref", "dependencies", "patternProperties", "propertyNames",
  "pattern", "minItems", "maxItems", "uniqueItems"
];

export function compileProviderSchema(sourceSchema: any): SchemaCompilationResult {
  const compilerName = "RecursiveAllowlistCompiler";
  const compilerVersion = "1.2.0";
  
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
    if (node.anyOf.length === 0) {
      throw new SchemaCompilationError(path, "anyOf array must not be empty");
    }
    const hasNull = node.anyOf.some((sub: any) => sub && (sub.type === "null" || (Array.isArray(sub.type) && sub.type.includes("null"))));
    const nonNullOptions = node.anyOf.filter((sub: any) => sub && sub.type !== "null" && !(Array.isArray(sub.type) && sub.type.length === 1 && sub.type[0] === "null"));
    
    if (nonNullOptions.length === 0) {
      throw new SchemaCompilationError(path, "null-only anyOf is unsupported and semantics-changing");
    }
    if (nonNullOptions.length > 1) {
      throw new SchemaCompilationError(path, "multi-branch non-null 'anyOf' is not supported");
    }

    if (nonNullOptions.length === 1) {
      const baseCompiled = compileNode(nonNullOptions[0], path, isSchemaNode);
      if (hasNull) {
        baseCompiled.nullable = true;
      }
      return baseCompiled;
    }
  }

  // Handle required constraint check and verification
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
    const props = node.properties || {};
    for (const reqName of node.required) {
      if (props[reqName] === undefined) {
        throw new SchemaCompilationError(path, `required property '${reqName}' is not present in properties`);
      }
    }
  }

  // Handle unknown type names
  if (isSchemaNode && node.type !== undefined) {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    const validTypes = new Set(["OBJECT", "ARRAY", "STRING", "NUMBER", "INTEGER", "BOOLEAN", "NULL"]);
    for (const t of types) {
      if (typeof t !== "string") {
        throw new SchemaCompilationError(path, "type must be a string or an array of strings");
      }
      if (!validTypes.has(t.toUpperCase())) {
        throw new SchemaCompilationError(path, `unknown type name: ${t}`);
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
      if (targetItems.length === 0) {
        throw new SchemaCompilationError(path, "empty tuple items are unsupported and semantics-changing");
      }
      if (targetItems.length > 1) {
        throw new SchemaCompilationError(path, "heterogeneous tuple 'items' is not supported");
      }
      targetItems = targetItems[0];
    }
  }

  // Build properties deterministically
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
             const sortedKeys = Object.keys(value || {}).sort();
             for (const propName of sortedKeys) {
                 const propSchema = (value as any)[propName];
                 compiledProps[propName] = compileNode(propSchema, path ? `${path}.${propName}` : propName, true);
             }
             result["properties"] = compiledProps;
         } else if (key === "required") {
             result["required"] = (value as string[]).slice().sort();
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
