/**
 * Non-cryptographic FNV-1a 32-bit hash implementation.
 */
export function fnv1a32(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export interface JsonArtifactResult {
  text: string;
  charLength: number;
  byteLength: number;
  hash: string;
  valid: boolean;
  error?: string;
}

/**
 * Safely stringifies an object to JSON, calculates character length,
 * UTF-8 byte length, and a simple verification hash. Self-validates using JSON.parse.
 */
export function stringifyJsonArtifact(value: unknown): JsonArtifactResult {
  try {
    const text = JSON.stringify(value, null, 2);
    if (text === undefined) {
      return {
        text: "",
        charLength: 0,
        byteLength: 0,
        hash: "",
        valid: false,
        error: "JSON.stringify returned undefined"
      };
    }

    // Verify validity by parsing back
    JSON.parse(text);

    const charLength = text.length;
    let byteLength = 0;
    try {
      byteLength = new TextEncoder().encode(text).length;
    } catch (e) {
      // Fallback for environments without TextEncoder
      byteLength = charLength;
    }

    const hash = fnv1a32(text);

    return {
      text,
      charLength,
      byteLength,
      hash,
      valid: true
    };
  } catch (err: any) {
    return {
      text: "",
      charLength: 0,
      byteLength: 0,
      hash: "",
      valid: false,
      error: err?.message || String(err)
    };
  }
}

/**
 * Triggers a browser download of the given value as a JSON file.
 */
export function downloadJsonArtifact(value: unknown, filename: string): JsonArtifactResult {
  const artifact = stringifyJsonArtifact(value);
  if (!artifact.valid) {
    throw new Error(`Failed to generate valid JSON download: ${artifact.error}`);
  }

  const blob = new Blob([artifact.text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return artifact;
}
