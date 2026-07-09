import fs from 'fs';
import path from 'path';

console.log('=== Running Contract Mirror Verification ===');

const pairs = [
  {
    contract: 'contracts/schemas/summary-analysis/v1.2.0-draft.2/schema.json',
    mirror: 'schemas/summary-analysis.v1.2.0-draft.2.schema.json',
    label: 'Summary Analysis v1.2.0-draft.2'
  },
  {
    contract: 'contracts/schemas/text-analysis-record/v0.1.0/schema.json',
    mirror: 'schemas/text-analysis-record.v0.1.0.schema.json',
    label: 'Text Analysis Record v0.1.0'
  },
  {
    contract: 'contracts/schemas/visual-analysis/v0.2.0-draft.1/schema.json',
    mirror: 'schemas/visual-analysis.v0.2.0-draft.1.schema.json',
    label: 'Visual Analysis v0.2.0-draft.1'
  },
  {
    contract: 'contracts/schemas/image-analysis-record/v0.1.0/schema.json',
    mirror: 'schemas/image-analysis-record.v0.1.0.schema.json',
    label: 'Image Analysis Record v0.1.0'
  }
];

function sortAndNormalize(obj, isTopLevel = true) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sortAndNormalize(item, false));
  }
  const keys = Object.keys(obj).sort();
  const normalized = {};
  for (const key of keys) {
    if (isTopLevel && ['$id', 'title', 'description', 'x-contract-id', 'x-contract-version', 'x-contract-status', '$schema'].includes(key)) {
      continue;
    }
    normalized[key] = sortAndNormalize(obj[key], false);
  }
  return normalized;
}

let hasErrors = false;

for (const pair of pairs) {
  const contractPath = path.join(process.cwd(), pair.contract);
  const mirrorPath = path.join(process.cwd(), pair.mirror);

  if (!fs.existsSync(contractPath)) {
    console.error(`❌ Contract file does not exist: ${pair.contract}`);
    hasErrors = true;
    continue;
  }
  if (!fs.existsSync(mirrorPath)) {
    console.error(`❌ Mirror file does not exist: ${pair.mirror}`);
    hasErrors = true;
    continue;
  }

  let contractJson, mirrorJson;
  try {
    contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  } catch (err) {
    console.error(`❌ Failed to parse contract JSON: ${pair.contract} - ${err.message}`);
    hasErrors = true;
    continue;
  }

  try {
    mirrorJson = JSON.parse(fs.readFileSync(mirrorPath, 'utf8'));
  } catch (err) {
    console.error(`❌ Failed to parse mirror JSON: ${pair.mirror} - ${err.message}`);
    hasErrors = true;
    continue;
  }

  const normalizedContract = sortAndNormalize(contractJson, true);
  const normalizedMirror = sortAndNormalize(mirrorJson, true);

  const contractStr = JSON.stringify(normalizedContract, null, 2);
  const mirrorStr = JSON.stringify(normalizedMirror, null, 2);

  if (contractStr !== mirrorStr) {
    console.error(`❌ Mismatch detected for [${pair.label}]!`);
    console.error(`Contract: ${pair.contract}`);
    console.error(`Mirror: ${pair.mirror}`);
    
    // Simple structural diff display (keys comparison)
    const contractKeys = Object.keys(normalizedContract);
    const mirrorKeys = Object.keys(normalizedMirror);
    console.error(`Contract top-level keys:`, contractKeys);
    console.error(`Mirror top-level keys:`, mirrorKeys);
    
    hasErrors = true;
  } else {
    console.log(`[OK] Mirror verified: [${pair.label}] is structurally synchronized.`);
  }
}

if (hasErrors) {
  console.error('\n❌ Verification failed. Contract and mirror schemas have structural drift.');
  process.exit(1);
} else {
  console.log('\n✨ All contract mirrors successfully verified! No structural drift detected. ✨');
}
