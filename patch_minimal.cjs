const fs = require('fs');
let content = fs.readFileSync('contracts/schemas/public-visual-sample/v0.1.0/examples/batch-analysis-bundle.minimal.json', 'utf8');

const json = JSON.parse(content);
json.counterConsistency = {
  expectedComparison: { consistent: true },
  review: { consistent: true }
};
json.comparisonCoverage = {
  expectedMetadataVsRecordConsistency: { consistent: true }
};
json.comparisonRecordConsistency = {
  allValid: true
};
json.invariants = {
  valid: true
};
json.analysisGuidance = {
  message: "Use this artifact to diagnose test failures."
};

fs.writeFileSync('contracts/schemas/public-visual-sample/v0.1.0/examples/batch-analysis-bundle.minimal.json', JSON.stringify(json, null, 2));
