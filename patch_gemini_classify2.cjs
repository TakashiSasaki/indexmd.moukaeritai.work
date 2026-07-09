const fs = require('fs');
let content = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const replacement = `if (isTransientTransport) {
    providerFailureKind = "providerUnavailable";
  } else if (statusCode === 503 || statusCode === 504 || providerStatus === "UNAVAILABLE") {
    providerFailureKind = "providerUnavailable";
  }`;

content = content.replace(
  /if \(statusCode === 503 \|\| statusCode === 504 \|\| providerStatus === "UNAVAILABLE"\) \{\s*providerFailureKind = "providerUnavailable";\s*\}/,
  replacement
);

fs.writeFileSync('src/lib/gemini.ts', content);
