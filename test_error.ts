import { extractProviderErrorDetails, classifyProviderFailureKind } from './src/lib/gemini';
let e = new TypeError("fetch failed");
(e as any).cause = { code: 'ECONNRESET', syscall: 'read' };
const details = extractProviderErrorDetails(e);
console.log("details", details);
console.log("classification", classifyProviderFailureKind(details.statusCode, details.providerStatus, details.rawMessage));
