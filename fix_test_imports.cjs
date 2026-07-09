const fs = require('fs');
const files = ['src/lib/visualAnalysis/publicSamples/reportBuilder.test.ts', 'src/lib/visualAnalysis/qualityGate.test.ts'];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // Remove all matching lines
  const lines = content.split('\n');
  const seenImports = new Set();
  const newLines = [];
  for (const line of lines) {
    if (line.includes("import { describe }")) {
       if (!seenImports.has('describe')) {
           seenImports.add('describe');
           newLines.push(line);
       }
    } else if (line.includes("import { test }")) {
       if (!seenImports.has('test')) {
           seenImports.add('test');
           newLines.push(line);
       }
    } else if (line.includes("import { test, describe }")) {
      if (!seenImports.has('test_describe')) {
        seenImports.add('test_describe');
        newLines.push(line);
      }
    } else if (line.startsWith("import assert")) {
      if (!seenImports.has('assert')) {
        seenImports.add('assert');
        newLines.push(line);
      }
    } else {
      newLines.push(line);
    }
  }
  fs.writeFileSync(file, newLines.join('\n'));
}
