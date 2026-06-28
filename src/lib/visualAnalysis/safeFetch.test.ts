import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { safeFetch, safeFetchWithRetry } from './safeFetch';

describe('safeFetch', () => {
  it('classifies Starting Server HTML as transient startup HTML', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '<html><head><title>Starting Server...</title></head><body>Please wait while your application starts...</body></html>',
    }));

    const result = await safeFetch('http://localhost/api/visual/health');

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.failureKind, 'nonJsonResponse');
    assert.strictEqual(result.responseDiagnostics?.looksLikeHtml, true);
    assert.strictEqual(result.responseDiagnostics?.htmlTitle, 'Starting Server...');
    assert.strictEqual(result.responseDiagnostics?.isTransientStartupHtml, true);
    assert.strictEqual(result.responseDiagnostics?.transientReason, 'startingServerHtml');
  });

  it('does not classify unrelated HTML as transient', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '<html><head><title>Welcome</title></head><body>Hello world</body></html>',
    }));

    const result = await safeFetch('http://localhost/api/visual/health');

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.failureKind, 'nonJsonResponse');
    assert.strictEqual(result.responseDiagnostics?.looksLikeHtml, true);
    assert.strictEqual(result.responseDiagnostics?.htmlTitle, 'Welcome');
    assert.strictEqual(result.responseDiagnostics?.isTransientStartupHtml, false);
  });

  it('parses valid JSON response', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '{"ok":true}',
    }));

    const result = await safeFetch('http://localhost/api/visual/health');

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.data, { ok: true });
    assert.strictEqual(result.responseDiagnostics?.looksLikeHtml, false);
  });

  it('returns invalidJsonResponse on bad JSON', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '{"ok":true,}',
    }));

    const result = await safeFetch('http://localhost/api/visual/health');

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.failureKind, 'invalidJsonResponse');
    assert.ok(result.responseDiagnostics?.parseErrorMessage);
  });
});

describe('safeFetchWithRetry', () => {
  it('retries on transient startup HTML and succeeds', async (t) => {
    let callCount = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'text/html' }),
          url: 'http://localhost/api/visual/health',
          text: async () => '<html><head><title>Starting Server...</title></head><body></body></html>',
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        url: 'http://localhost/api/visual/health',
        text: async () => '{"ok":true}',
      };
    });

    const result = await safeFetchWithRetry('http://localhost/api/visual/health', undefined, {
      maxAttempts: 3,
      delaysMs: [10],
      retryStartupHtml: true
    });

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.data, { ok: true });
    assert.strictEqual(result.retryDiagnostics?.attempts, 2);
    assert.strictEqual(result.retryDiagnostics?.retried, true);
    assert.strictEqual(result.retryDiagnostics?.events.length, 1);
    assert.strictEqual(result.retryDiagnostics?.events[0].htmlTitle, 'Starting Server...');
  });

  it('exhausts retries on persistent transient startup HTML', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/html' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '<html><head><title>Starting Server...</title></head><body></body></html>',
    }));

    const result = await safeFetchWithRetry('http://localhost/api/visual/health', undefined, {
      maxAttempts: 3,
      delaysMs: [10, 10],
      retryStartupHtml: true
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.failureKind, 'nonJsonResponse');
    assert.strictEqual(result.retryDiagnostics?.attempts, 3);
    assert.strictEqual(result.retryDiagnostics?.retried, true);
    assert.strictEqual(result.retryDiagnostics?.events.length, 2);
  });

  it('does not retry on unrelated HTML', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/html' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '<html><head><title>Not Found</title></head><body></body></html>',
    }));

    const result = await safeFetchWithRetry('http://localhost/api/visual/health', undefined, {
      maxAttempts: 3,
      delaysMs: [10, 10],
      retryStartupHtml: true
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.failureKind, 'nonJsonResponse');
    assert.strictEqual(result.retryDiagnostics?.attempts, 1);
    assert.strictEqual(result.retryDiagnostics?.retried, false);
  });
});
