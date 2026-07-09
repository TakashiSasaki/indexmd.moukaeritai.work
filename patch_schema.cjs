const fs = require('fs');
let schema = JSON.parse(fs.readFileSync('contracts/schemas/public-visual-sample/v0.1.0/batch-analysis-bundle.schema.json', 'utf8'));

schema.properties.counterConsistency = { type: 'object', additionalProperties: true };
schema.properties.comparisonCoverage = { type: 'object', additionalProperties: true };
schema.properties.comparisonRecordConsistency = { type: 'object', additionalProperties: true };
schema.properties.invariants = { type: 'object', additionalProperties: true };
schema.properties.analysisGuidance = { type: 'object', additionalProperties: true };

fs.writeFileSync('contracts/schemas/public-visual-sample/v0.1.0/batch-analysis-bundle.schema.json', JSON.stringify(schema, null, 2));
