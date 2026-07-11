import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('Importing modules should not create directories or files', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indexmd-test-'));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);

    // Import the modules
    await import('../../src/app.ts');
    await import('../../src/lib/visualAnalysis/publicSamples/serverFetch.ts');
    await import('../../src/lib/visualAnalysis/serverJobs/jobStore.ts');
    await import('../../src/lib/visualAnalysis/serverJobs/jobRunner.ts');
    await import('../../tests/support/FakeProviderTransport.ts');

    const files = fs.readdirSync(tmpDir);
    assert.deepStrictEqual(files, [], 'Temporary directory should remain empty after imports');

  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
