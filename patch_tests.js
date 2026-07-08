const fs = require('fs');

function patchReportBuilderTests() {
  const file = 'src/lib/visualAnalysis/publicSamples/reportBuilder.test.ts';
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes("import { test")) {
    content = "import { test, describe } from 'node:test';\nimport assert from 'node:assert';\nimport { buildBatchSummaryReportForChat } from './reportBuilder';\n" + content;
    fs.writeFileSync(file, content);
  }
}

function patchQualityGateTests() {
  const file = 'src/lib/visualAnalysis/qualityGate.test.ts';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/usedModelName/g, "modelName");
  
  if (!content.includes("import { test")) {
    content = "import { test, describe } from 'node:test';\nimport assert from 'node:assert';\n" + content;
  }
  fs.writeFileSync(file, content);
}

patchReportBuilderTests();
patchQualityGateTests();
