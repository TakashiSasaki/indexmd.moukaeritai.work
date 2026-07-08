const fs = require('fs');

const f1 = 'src/lib/visualAnalysis/publicSamples/reportBuilder.test.ts';
let c1 = fs.readFileSync(f1, 'utf8');
if (!c1.includes("import { test, describe }")) {
  fs.writeFileSync(f1, "import { test, describe } from 'node:test';\nimport assert from 'node:assert';\nimport { buildBatchSummaryReportForChat } from './reportBuilder';\n" + c1);
} else if (!c1.includes("import { buildBatchSummaryReportForChat }")) {
  fs.writeFileSync(f1, "import { buildBatchSummaryReportForChat } from './reportBuilder';\n" + c1);
}

const f2 = 'src/lib/visualAnalysis/qualityGate.test.ts';
let c2 = fs.readFileSync(f2, 'utf8');
if (!c2.includes("import { test, describe }")) {
  fs.writeFileSync(f2, "import { test, describe } from 'node:test';\nimport assert from 'node:assert';\n" + c2);
}

