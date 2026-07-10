import fs from 'fs';

let content = fs.readFileSync('src/lib/visualAnalysis/serverJobs/localJobBackup.ts', 'utf-8');

content = content.replace(
  /if \(typeof obj === 'string' && obj\.toLowerCase\(\)\.startsWith\('bearer '\)\) {/,
  "if (typeof obj === 'string') {\n      if (obj.toLowerCase().startsWith('bearer ')) return '[REDACTED]';\n      if (/AIzaSy[a-zA-Z0-9_-]{33}/.test(obj)) return '[REDACTED_API_KEY]';\n      if (/(ya29|1\\\\/\\\\/[0-9a-zA-Z_-]+)/.test(obj)) return '[REDACTED_OAUTH_TOKEN]';\n    }"
);

fs.writeFileSync('src/lib/visualAnalysis/serverJobs/localJobBackup.ts', content);
