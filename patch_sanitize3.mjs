import fs from 'fs';

let content = fs.readFileSync('src/lib/visualAnalysis/serverJobs/localJobBackup.ts', 'utf-8');

content = content.replace(
  /export function sanitizeBundle\(obj: any\): any \{[\s\S]*?if \(Array\.isArray\(obj\)\) \{/,
  `export function sanitizeBundle(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      if (obj.toLowerCase().startsWith('bearer ')) return '[REDACTED]';
      if (/AIzaSy[a-zA-Z0-9_-]{33}/.test(obj)) return '[REDACTED_API_KEY]';
      if (/(ya29|1\\/\\/[0-9a-zA-Z_-]+)/.test(obj)) return '[REDACTED_OAUTH_TOKEN]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {`
);

fs.writeFileSync('src/lib/visualAnalysis/serverJobs/localJobBackup.ts', content);
