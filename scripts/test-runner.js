import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function findTests(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findTests(filePath, fileList);
    } else if (file.endsWith('.test.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const argsList = process.argv.slice(2);
const isCoverage = argsList.includes('--coverage');
const category = argsList.find(a => !a.startsWith('--')) || 'unit';

let testFiles = [];

if (category === 'unit' || category === 'all') {
  testFiles.push(...findTests(path.join(process.cwd(), 'src')));
  testFiles.push(...findTests(path.join(process.cwd(), 'tests', 'unit')));
}
if (category === 'integration' || category === 'all') {
  testFiles.push(...findTests(path.join(process.cwd(), 'tests', 'integration')));
}
if (category === 'architecture' || category === 'all') {
  testFiles.push(...findTests(path.join(process.cwd(), 'tests', 'architecture')));
}

testFiles = testFiles.sort();

if (testFiles.length === 0) {
  console.error(`No tests found for category: ${category}`);
  process.exit(1);
}

const args = ['--import', 'tsx'];
if (isCoverage || process.env.COVERAGE === '1') {
  args.push('--experimental-test-coverage');
}
args.push('--test', ...testFiles);

const result = spawnSync('node', args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
