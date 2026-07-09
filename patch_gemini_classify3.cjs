const fs = require('fs');
let content = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const replacement = `if (isTransientTransport) {
    providerFailureKind = "providerUnavailable";
  } else if (statusCode === 503 || statusCode === 504 || providerStatus === "UNAVAILABLE" || upperMsgStr.includes("UNAVAILABLE")) {
    providerFailureKind = "providerUnavailable";
  }`;

content = content.replace(
  /if \(statusCode === 503 \|\| statusCode === 504 \|\| providerStatus === "UNAVAILABLE" \|\| upperMsgStr\.includes\("UNAVAILABLE"\)\) \{\s*providerFailureKind = "providerUnavailable";\s*\}/,
  replacement
);
// Also remove the redeclared `const upperMsgStr = rawMessage.toUpperCase();`
content = content.replace(/const upperMsgStr = rawMessage\.toUpperCase\(\);\s*const isQuotaStatus/, 'const isQuotaStatus');

fs.writeFileSync('src/lib/gemini.ts', content);
