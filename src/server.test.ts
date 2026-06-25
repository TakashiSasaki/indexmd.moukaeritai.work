import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';

// Mock global fetch
const originalFetch = global.fetch;

describe('Analyze Image Endpoint', () => {
  let app: any;

  after(() => {
    global.fetch = originalFetch;
  });

  it('should return 401 if Authorization header is missing', async () => {
    process.env.NODE_ENV = 'test';
    const serverModule = await import('../server');
    app = serverModule.app;

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
    global.fetch = async (url: string) => {
      if (url.includes('alt=media')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new ArrayBuffer(8)
        } as any;
      }
      if (url.includes('googleapis.com/drive/v3/files/123')) {
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
