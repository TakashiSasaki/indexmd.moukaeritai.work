import { describe, it, after, before } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from './app';
import { FakeProviderTransport } from './lib/visualAnalysis/fakeProviderTransport';
import { defaultSampleResolver } from './lib/visualAnalysis/preflight';
import { jobStore } from './lib/visualAnalysis/serverJobs/jobStore';

// Mock global fetch
const originalFetch = global.fetch;

describe('Analyze Image Endpoint', () => {
  let app: any;

  before(() => {
    process.env.NODE_ENV = 'test';
    const fakeTransport = new FakeProviderTransport();
    const result = createApp({
      providerTransport: fakeTransport,
      sampleResolver: defaultSampleResolver,
      jobStore: jobStore
    });
    app = result.app;
  });

  after(() => {
    global.fetch = originalFetch;
  });

  it('should return 401 if Authorization header is missing', async () => {
    const res = await request(app)
      .post('/api/drive/debug/analyze-image')
      .send({ fileId: '123' });
    
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Missing Authorization header');
  });

  it('should return 400 if fileId is missing', async () => {
    const res = await request(app)
      .post('/api/drive/debug/analyze-image')
      .set('Authorization', 'Bearer mock-token')
      .send({});
    
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'fileId is required');
  });

  it('should return 400 if model is unsupported', async () => {
    // Mock fetch for metadata and media
    global.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('alt=media')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new ArrayBuffer(8)
        } as any;
      }
      if (urlStr.includes('googleapis.com/drive/v3/files/123')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: '123', name: 'test.jpg', mimeType: 'image/jpeg' })
        } as any;
      }
      return { ok: false, status: 404 } as any;
    };

    const res = await request(app)
      .post('/api/drive/debug/analyze-image')
      .set('Authorization', 'Bearer mock-token')
      .send({ fileId: '123', modelName: 'unsupported-model' });
    
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('not supported'));
  });
});

describe('Batch Jobs Model Gating', () => {
  let app: any;

  before(() => {
    process.env.NODE_ENV = 'test';
    const fakeTransport = new FakeProviderTransport();
    const result = createApp({
      providerTransport: fakeTransport,
      sampleResolver: defaultSampleResolver,
      jobStore: jobStore
    });
    app = result.app;
  });

  it('should reject execution-disallowed models and return structured failure classification', async () => {
    const res = await request(app)
      .post('/api/visual/batch-jobs')
      .send({
        modelName: 'gemini-1.5-pro',
        targetSampleIds: ['sample-landscape-1'],
        jsonMode: 'native_schema'
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.errorType, 'modelDiscontinued');
    assert.strictEqual(res.body.jobId, undefined);
  });
});
