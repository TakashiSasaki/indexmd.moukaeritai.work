const fs = require('fs');

const path = 'server.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace new GeminiSdkProviderTransport() in server.ts
// Wait, I didn't see `GeminiSdkProviderTransport` instantiated in server.ts when I ran `cat src/app.ts`, wait, `server.ts` IS at the root.

content = content.replace(
  `import { GeminiSdkProviderTransport } from "./src/lib/visualAnalysis/providerTransport";`,
  `import { GeminiSdkProviderTransport } from "./src/lib/visualAnalysis/providerTransport";`
);

fs.writeFileSync(path, content);
