const fs = require('fs');
const file = 'src/lib/visualAnalysis/publicSamples/reportBuilder.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/generationDiagnostics: \{\n\s*mediaResolution: "MEDIUM"\n\s*\}/g, 'analysisRun: { metadata: { generationConfig: { mediaResolutionRequested: "MEDIUM" } } }');

fs.writeFileSync(file, content);
