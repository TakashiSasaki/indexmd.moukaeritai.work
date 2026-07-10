import fs from 'fs';

let content = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

content = content.replace(
  /import \{ GoogleGenAI \} from "@google\/genai";/,
  `import { GoogleGenAI } from "@google/genai";\nimport { ProviderFailureKind } from "./visualAnalysis/types";`
);

content = content.replace(
  /providerFailureKind\?: "providerRateLimited" \| "providerQuotaExceeded" \| "providerUnavailable" \| "providerInvalidArgument" \| "providerAuthenticationRequired" \| "providerAuthorizationDenied" \| "providerGenerationError" \| "providerInternalError";/g,
  "providerFailureKind?: ProviderFailureKind;"
);

content = content.replace(
  /providerFailureKind: "providerRateLimited" \| "providerQuotaExceeded" \| "providerUnavailable" \| "providerInvalidArgument" \| "providerAuthenticationRequired" \| "providerAuthorizationDenied" \| "providerGenerationError" \| "providerInternalError";/g,
  "providerFailureKind: ProviderFailureKind;"
);

content = content.replace(
  /let providerFailureKind: "providerRateLimited" \| "providerQuotaExceeded" \| "providerUnavailable" \| "providerInvalidArgument" \| "providerAuthenticationRequired" \| "providerAuthorizationDenied" \| "providerGenerationError" \| "providerInternalError" = "providerGenerationError";/g,
  "let providerFailureKind: ProviderFailureKind = \"providerGenerationError\";"
);

fs.writeFileSync('src/lib/gemini.ts', content);
