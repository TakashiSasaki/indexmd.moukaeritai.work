import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Component tests are executed by standard scripts and CI', () => {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkgContent = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgContent);

  // Assert "test:components" exists
  assert.ok(pkg.scripts['test:components'], 'Missing test:components in package.json');
  assert.ok(pkg.scripts['test:components'].includes('vitest'), 'test:components should invoke vitest');

  // Assert component test runner executes in test:all
  const runnerPath = path.join(process.cwd(), 'scripts', 'test-runner.js');
  const runnerContent = fs.readFileSync(runnerPath, 'utf8');
  assert.ok(runnerContent.includes('test:components'), 'test-runner.js must invoke test:components');

  // Assert CI step exists
  const ciPath = path.join(process.cwd(), '.github', 'workflows', 'ci.yml');
  const ciContent = fs.readFileSync(ciPath, 'utf8');
  assert.ok(ciContent.includes('Run Component Tests'), 'CI must have Run Component Tests step');
  assert.ok(ciContent.includes('npm run test:components'), 'CI must execute npm run test:components');

  // Mechanical discoverability
  const vitestConfig = path.join(process.cwd(), 'vitest.config.ts');
  const vitestConfigContent = fs.readFileSync(vitestConfig, 'utf8');
  assert.ok(vitestConfigContent.includes('.test.tsx'), 'Vitest config must cover .test.tsx');
});
