const fs = require('fs');
let content = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const replacement = `export function extractProviderErrorDetails(err: any): {
  statusCode?: number;
  providerStatus: string;
  rawMessage: string;
} {
  let statusCode = err?.status || err?.response?.status || err?.error?.code;
  let rawMessage = err?.message || "";
  
  if (err?.cause) {
    const cause = err.cause;
    rawMessage += \` | cause: \${cause.name || 'Error'}: \${cause.message || ''}\`;
    if (cause.code) rawMessage += \` (code: \${cause.code})\`;
    if (cause.errno) rawMessage += \` (errno: \${cause.errno})\`;
    if (cause.syscall) rawMessage += \` (syscall: \${cause.syscall})\`;
    if (cause.hostname) rawMessage += \` (host: \${cause.hostname})\`;
  }

  if (!statusCode && rawMessage) {`;

content = content.replace(
  /export function extractProviderErrorDetails\(err: any\): \{\s*statusCode\?: number;\s*providerStatus: string;\s*rawMessage: string;\s*\} \{\s*let statusCode = err\?\.status \|\| err\?\.response\?\.status \|\| err\?\.error\?\.code;\s*const rawMessage = err\?\.message \|\| "";\s*if \(!statusCode && rawMessage\) \{/,
  replacement
);

fs.writeFileSync('src/lib/gemini.ts', content);
