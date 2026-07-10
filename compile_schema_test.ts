export function compileProviderSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(compileProviderSchema);

  const out: any = {};
  
  if (schema.type !== undefined) {
    if (typeof schema.type === "string") {
      out.type = schema.type.toUpperCase();
    } else {
      out.type = schema.type;
    }
  }

  if (schema.description !== undefined) out.description = schema.description;
  if (schema.enum !== undefined) out.enum = schema.enum;
  if (schema.required !== undefined) out.required = schema.required;
  if (schema.nullable !== undefined) out.nullable = schema.nullable;
  
  if (schema.const !== undefined) {
    out.enum = [schema.const];
  }

  if (schema.properties && typeof schema.properties === "object") {
    out.properties = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      out.properties[key] = compileProviderSchema(val);
    }
  }

  if (schema.items) {
    out.items = compileProviderSchema(schema.items);
  }

  // Handle any$refs or other supported constructs if needed.
  // We only keep the explicitly allowed keys.
  return out;
}
