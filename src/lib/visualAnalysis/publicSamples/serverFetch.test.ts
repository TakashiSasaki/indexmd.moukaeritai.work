import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fetchPublicSampleImage } from './serverFetch';

describe('Public Visual Sample Fetcher', () => {
  it('should resolve local fixture', async () => {
    // Only test local fixture logic as network fetch tests can be flaky in unit tests
    const result = await fetchPublicSampleImage('sample-receipt-synthetic', 'full');
    assert.ok(result.buffer);
    assert.equal(result.mimeType, 'image/svg+xml');
  });

  it('should throw for unknown sample', async () => {
    try {
      await fetchPublicSampleImage('unknown-id', 'full');
      assert.fail('Should have thrown error');
    } catch (e: any) {
      assert.match(e.message, /Sample not found/);
    }
  });
});
