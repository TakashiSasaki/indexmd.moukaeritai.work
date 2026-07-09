const fs = require('fs');
let content = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const replacement = `export function classifyProviderFailureKind(
  statusCode: number | undefined,
  providerStatus: string,
  rawMessage: string
): {
  providerFailureKind: "providerRateLimited" | "providerQuotaExceeded" | "providerUnavailable" | "providerInvalidArgument" | "providerGenerationError";
  quotaExceeded: boolean;
  rateLimited: boolean;
} {
  let providerFailureKind: "providerRateLimited" | "providerQuotaExceeded" | "providerUnavailable" | "providerInvalidArgument" | "providerGenerationError" = "providerGenerationError";
  let quotaExceeded = false;
  let rateLimited = false;

  const upperMsgStr = rawMessage.toUpperCase();
  const isTransientTransport = upperMsgStr.includes("ECONNRESET") || 
                               upperMsgStr.includes("ETIMEDOUT") || 
                               upperMsgStr.includes("EAI_AGAIN") || 
                               upperMsgStr.includes("UND_ERR_CONNECT_TIMEOUT") || 
                               upperMsgStr.includes("UND_ERR_HEADERS_TIMEOUT") || 
                               upperMsgStr.includes("FETCH FAILED");

  if (statusCode === 429) {`;

content = content.replace(
  /export function classifyProviderFailureKind\([\s\S]*?if \(statusCode === 429\) \{/,
  replacement
);

fs.writeFileSync('src/lib/gemini.ts', content);
