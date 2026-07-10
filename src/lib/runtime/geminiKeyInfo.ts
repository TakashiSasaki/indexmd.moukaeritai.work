function buildKeyFingerprint(value: string): string {
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b1;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    hashA ^= code;
    hashA = Math.imul(hashA, 0x01000193) >>> 0;
    hashB ^= code + 17;
    hashB = Math.imul(hashB, 0x85ebca6b) >>> 0;
  }
  return `${hashA.toString(16).padStart(8, "0")}${hashB.toString(16).padStart(8, "0")}`.slice(0, 12);
}

export interface GeminiKeyInfo {
  configured: boolean;
  source: "GEMINI_API_KEY";
  maskedKey?: string;
  fingerprint?: string;
  fingerprintAlgorithm?: "derivedHex";
}

export function getGeminiKeyInfo(apiKey: string | undefined): GeminiKeyInfo {
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    return {
      configured: false,
      source: "GEMINI_API_KEY"
    };
  }

  const trimmedKey = apiKey.trim();
  const fingerprint = buildKeyFingerprint(trimmedKey);

  let maskedKey = "configured";
  if (trimmedKey.length >= 16) {
    maskedKey = `${trimmedKey.slice(0, 4)}…${trimmedKey.slice(-4)}`;
  }

  return {
    configured: true,
    source: "GEMINI_API_KEY",
    maskedKey,
    fingerprint,
    fingerprintAlgorithm: "derivedHex"
  };
}
