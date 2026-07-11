import assert from 'node:assert/strict';
import { describe, test, afterEach } from 'node:test';
import { fetchAndValidateAnalysisBundle, AnalysisBundleRetrievalError } from './analysisBundleRetrieval';

const originalFetch = globalThis.fetch;
const jobId = 'job-123';
function bundle(overrides: any = {}) { return { reportKind: 'visualAnalysisPublicSampleBatchAnalysisBundle', bundleSchemaVersion: '0.2.0', job: { jobId }, total: 1, items: [], ...overrides }; }
function mock(status: number, body: string, headers: Record<string,string> = {'content-type':'application/json'}, url = `/api/visual/batch-jobs/${jobId}/reports/analysis-bundle`, redirected = false) {
  globalThis.fetch = async () => {
    const response = new Response(body, { status, headers });
    Object.defineProperty(response, 'url', { configurable: true, value: url });
    Object.defineProperty(response, 'redirected', { configurable: true, value: redirected });
    return response as any;
  };
}
afterEach(() => { globalThis.fetch = originalFetch; });

test('valid current Analysis Bundle retrieval succeeds', async () => {
  mock(200, JSON.stringify(bundle()));
  const res = await fetchAndValidateAnalysisBundle(jobId);
  assert.equal(res.metadata.schemaVersion, '0.2.0');
  assert.equal(res.bundle.job.jobId, jobId);
});

test('supported legacy Analysis Bundle retrieval succeeds', async () => {
  mock(200, JSON.stringify(bundle({ bundleSchemaVersion: '0.1.0' })));
  assert.equal((await fetchAndValidateAnalysisBundle(jobId)).metadata.schemaVersion, '0.1.0');
});

for (const [name, status, body, contentType, kind] of [
  ['AI Studio cookie-check HTML', 200, '<html><title>Cookie check</title>Google AI Studio cookie</html>', 'text/html', 'aiStudioCookieCheck'],
  ['generic HTML', 200, '<!doctype html><html>login</html>', 'text/html', 'unexpectedHtmlResponse'],
  ['malformed JSON', 200, '{bad', 'application/json', 'malformedJson'],
  ['unrelated valid JSON', 200, '{"ok":true}', 'application/json', 'unrelatedJson'],
  ['unsupported bundle version', 200, JSON.stringify(bundle({ bundleSchemaVersion: '9.9.9' })), 'application/json', 'unsupportedBundleVersion'],
  ['job ID mismatch', 200, JSON.stringify(bundle({ job: { jobId: 'other' } })), 'application/json', 'jobIdMismatch'],
  ['HTTP 401', 401, '{}', 'application/json', 'authenticationRequired'],
  ['HTTP 403', 403, '{}', 'application/json', 'authorizationDenied'],
  ['HTTP 404', 404, '{}', 'application/json', 'jobNotFound'],
  ['HTTP 500', 500, '{}', 'application/json', 'serverFailure'],
] as const) {
  test(`${name} is rejected`, async () => {
    mock(status, body, {'content-type': contentType});
    await assert.rejects(fetchAndValidateAnalysisBundle(jobId), (e: any) => e instanceof AnalysisBundleRetrievalError && e.kind === kind);
  });
}

test('cross-origin redirect is rejected', async () => {
  mock(200, JSON.stringify(bundle()), {'content-type':'application/json'}, 'https://evil.example/cookie', true);
  await assert.rejects(fetchAndValidateAnalysisBundle(jobId), (e: any) => e.kind === 'unsafeRedirect');
});

import { ANALYSIS_BUNDLE_V01 } from './__fixtures__/analysisBundleFixtures';
import { validateAnalysisBundleObject } from './analysisBundleRetrieval';

test('Analysis Bundle Fixtures', () => {
    const validated = validateAnalysisBundleObject(ANALYSIS_BUNDLE_V01, "test-job-v0.1");
    assert.equal(validated.schemaVersion, "0.1.0");
    assert.equal(validated.jobId, "test-job-v0.1");
});
