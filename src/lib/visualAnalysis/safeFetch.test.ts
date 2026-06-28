import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeFetch, safeFetchWithRetry } from './safeFetch';

// Mock the global fetch
const globalFetchMock = vi.fn();
vi.stubGlobal('fetch', globalFetchMock);

describe('safeFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('classifies Starting Server HTML as transient startup HTML', async () => {
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '<html><head><title>Starting Server...</title></head><body>Please wait while your application starts...</body></html>',
    });

    const result = await safeFetch('http://localhost/api/visual/health');

    expect(result.success).toBe(false);
    expect(result.failureKind).toBe('nonJsonResponse');
    expect(result.responseDiagnostics?.looksLikeHtml).toBe(true);
    expect(result.responseDiagnostics?.htmlTitle).toBe('Starting Server...');
    expect(result.responseDiagnostics?.isTransientStartupHtml).toBe(true);
    expect(result.responseDiagnostics?.transientReason).toBe('startingServerHtml');
  });

  it('does not classify unrelated HTML as transient', async () => {
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '<html><head><title>Welcome</title></head><body>Hello world</body></html>',
    });

    const result = await safeFetch('http://localhost/api/visual/health');

    expect(result.success).toBe(false);
    expect(result.failureKind).toBe('nonJsonResponse');
    expect(result.responseDiagnostics?.looksLikeHtml).toBe(true);
    expect(result.responseDiagnostics?.htmlTitle).toBe('Welcome');
    expect(result.responseDiagnostics?.isTransientStartupHtml).toBe(false);
  });

  it('parses valid JSON response', async () => {
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '{"ok":true}',
    });

    const result = await safeFetch('http://localhost/api/visual/health');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
    expect(result.responseDiagnostics?.looksLikeHtml).toBe(false);
  });

  it('returns invalidJsonResponse on bad JSON', async () => {
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '{"ok":true,}',
    });

    const result = await safeFetch('http://localhost/api/visual/health');

    expect(result.success).toBe(false);
    expect(result.failureKind).toBe('invalidJsonResponse');
    expect(result.responseDiagnostics?.parseErrorMessage).toBeDefined();
  });
});

describe('safeFetchWithRetry', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retries on transient startup HTML and succeeds', async () => {
    // First attempt: Starting Server HTML
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/html' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '<html><head><title>Starting Server...</title></head><body></body></html>',
    });
    
    // Second attempt: Success JSON
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '{"ok":true}',
    });

    const result = await safeFetchWithRetry('http://localhost/api/visual/health', undefined, {
      maxAttempts: 3,
      delaysMs: [10],
      retryStartupHtml: true
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
    expect(result.retryDiagnostics?.attempts).toBe(2);
    expect(result.retryDiagnostics?.retried).toBe(true);
    expect(result.retryDiagnostics?.events.length).toBe(1);
    expect(result.retryDiagnostics?.events[0].htmlTitle).toBe('Starting Server...');
  });

  it('exhausts retries on persistent transient startup HTML', async () => {
    for (let i = 0; i < 3; i++) {
      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/html' }),
        url: 'http://localhost/api/visual/health',
        text: async () => '<html><head><title>Starting Server...</title></head><body></body></html>',
      });
    }

    const result = await safeFetchWithRetry('http://localhost/api/visual/health', undefined, {
      maxAttempts: 3,
      delaysMs: [10, 10],
      retryStartupHtml: true
    });

    expect(result.success).toBe(false);
    expect(result.failureKind).toBe('nonJsonResponse');
    expect(result.retryDiagnostics?.attempts).toBe(3);
    expect(result.retryDiagnostics?.retried).toBe(true);
    expect(result.retryDiagnostics?.events.length).toBe(2);
  });

  it('does not retry on unrelated HTML', async () => {
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/html' }),
      url: 'http://localhost/api/visual/health',
      text: async () => '<html><head><title>Not Found</title></head><body></body></html>',
    });

    const result = await safeFetchWithRetry('http://localhost/api/visual/health', undefined, {
      maxAttempts: 3,
      delaysMs: [10, 10],
      retryStartupHtml: true
    });

    expect(result.success).toBe(false);
    expect(result.failureKind).toBe('nonJsonResponse');
    expect(result.retryDiagnostics?.attempts).toBe(1);
    expect(result.retryDiagnostics?.retried).toBe(false);
  });
});
