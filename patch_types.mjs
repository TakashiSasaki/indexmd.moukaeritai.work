import fs from 'fs';

let content = fs.readFileSync('src/lib/visualAnalysis/types.ts', 'utf-8');

const typeDef = `export type ProviderFailureKind =
  | "providerRateLimited"
  | "providerQuotaExceeded"
  | "providerUnavailable"
  | "providerInvalidArgument"
  | "providerAuthenticationRequired"
  | "providerAuthorizationDenied"
  | "providerGenerationError"
  | "providerInternalError";\n\n`;

content = typeDef + content;
content = content.replace("failureKind?: string;", "failureKind?: ProviderFailureKind | string;");

fs.writeFileSync('src/lib/visualAnalysis/types.ts', content);
