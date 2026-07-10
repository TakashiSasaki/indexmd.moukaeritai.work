import crypto from "crypto";

export interface GeminiKeyInfo {
  configured: boolean;
  source: "GEMINI_API_KEY";
  maskedKey?: string;
  fingerprint?: string;
  fingerprintAlgorithm?: "sha256";
}

export function getGeminiKeyInfo(apiKey: string | undefined): GeminiKeyInfo {
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    return {
      configured: false,
      source: "GEMINI_API_KEY"
    };
  }

  const trimmedKey = apiKey.trim();
  const fingerprint = crypto.createHash("sha256").update(trimmedKey).digest("hex").slice(0, 12);

  let maskedKey = "configured";
  if (trimmedKey.length >= 16) {
    maskedKey = `${trimmedKey.slice(0, 4)}…${trimmedKey.slice(-4)}`;
  }

  return {
    configured: true,
    source: "GEMINI_API_KEY",
    maskedKey,
    fingerprint,
    fingerprintAlgorithm: "sha256"
  };
}
