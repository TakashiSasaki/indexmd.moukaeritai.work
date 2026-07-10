import { createHash } from "node:crypto";

function buildKeyFingerprint(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .toLowerCase()
    .slice(0, 12);
}

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

  const fingerprint = buildKeyFingerprint(apiKey);

  let maskedKey = "configured";
  if (apiKey.length >= 16) {
    maskedKey = `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
  }

  return {
    configured: true,
    source: "GEMINI_API_KEY",
    maskedKey,
    fingerprint,
    fingerprintAlgorithm: "sha256"
  };
}

