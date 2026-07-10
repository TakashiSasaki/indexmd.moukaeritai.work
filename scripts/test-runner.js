import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function findTests(dir, fileList = []) {
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

const testFiles = findTests(path.join(process.cwd(), 'src')).sort();

const args = ['--import', 'tsx'];
if (process.env.COVERAGE === '1') {
  args.push('--experimental-test-coverage');
}
args.push('--test', ...testFiles);

const result = spawnSync('node', args, { stdio: 'inherit' });

process.exit(result.status ?? 1);
