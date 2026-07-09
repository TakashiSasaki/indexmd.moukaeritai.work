import fs from 'fs';
import path from 'path';

console.log('=== Running Schema Mirror Verification (Anti-Reintroduction Guard) ===\n');

const rootDir = process.cwd();

// 1. Check if schemas/ folder exists at the root
const schemasDir = path.join(rootDir, 'schemas');
if (fs.existsSync(schemasDir)) {
  console.error('❌ FAILURE: Root-level "schemas/" directory still exists!');
  console.error('All runtime schemas must be located under "contracts/schemas/" to avoid duplicate schema maintenance.');
  process.exit(1);
}
console.log('[OK] Root-level "schemas/" directory does not exist.');

// 2. Scan code files for raw "schemas/" references (ignoring "contracts/schemas/")
const filesToScan = [];
const walkDir = (dir) => {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.next', 'cache'].includes(file)) continue;
      walkDir(fullPath);
    } else {
      const ext = path.extname(file);
      if (['.ts', '.tsx', '.js', '.mjs', '.json'].includes(ext) || file === 'package.json') {
        // Do not scan this script itself or MANIFEST.json or package-lock.json or patch.diff or contracts directory schemas
        if (
          fullPath.includes('verifyNoSchemaMirror') ||
          fullPath.includes('validate-contracts') ||
          file === 'package-lock.json' ||
          file === 'patch.diff' ||
          fullPath.includes('contracts/')
        ) {
          continue;
        }
        filesToScan.push(fullPath);
      }
    }
  }
};

walkDir(rootDir);

let violations = 0;

for (const file of filesToScan) {
  const content = fs.readFileSync(file, 'utf8');
  
  // Find all instances of "schemas/" that do not have "contracts/" immediately before them
  const regex = /([^a-zA-Z0-9_/]|^)schemas\//g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const matchStr = match[0];
    const index = match.index;
    
    // Check if it's "contracts/schemas/"
    const contextStart = Math.max(0, index - 15);
    const precedingText = content.substring(contextStart, index + matchStr.length);
    if (precedingText.includes('contracts/schemas/')) {
      continue;
    }
    
    // Find line number
    const lines = content.substring(0, index).split('\n');
    const lineNum = lines.length;
    
    console.error(`❌ Violation in ${path.relative(rootDir, file)}:${lineNum}`);
    console.error(`   Found invalid reference: "... ${precedingText.trim()} ..."`);
    violations++;
  }
}

if (violations > 0) {
  console.error(`\n❌ Found ${violations} invalid "schemas/" reference(s). All references must point to "contracts/schemas/" or "contracts/vocabularies/".`);
  process.exit(1);
}

console.log('[OK] No invalid root-level "schemas/" references found in code files.');
console.log('\n✨ Schema Mirror Verification Successful! ✨');
