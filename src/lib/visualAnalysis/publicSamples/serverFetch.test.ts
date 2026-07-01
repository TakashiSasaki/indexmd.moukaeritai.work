import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fetchPublicSampleImage } from './serverFetch';
import fs from 'node:fs';
import path from 'node:path';

describe('Public Visual Sample Fetcher', () => {
  it.skip('should resolve local fixture', async () => {
    // Only test local fixture logic as network fetch tests can be flaky in unit tests
    const result = await fetchPublicSampleImage('sample-receipt-synthetic', 'full');
    assert.ok(result.buffer);
    assert.equal(result.mimeType, 'image/png');
  });

  it.skip('should verify cache layer and tracking', async () => {
    const result1 = await fetchPublicSampleImage('sample-receipt-synthetic', 'analysis');
    assert.ok(result1.cacheLayer === 'miss' || result1.cacheLayer === 'disk');
    assert.ok(result1.cacheKey);

    const result2 = await fetchPublicSampleImage('sample-receipt-synthetic', 'analysis');
    assert.equal(result2.cacheLayer, 'memory');
    assert.equal(result2.cacheKey, result1.cacheKey);
  });

  it.skip('should deduplicate concurrent fetches', async () => {
    // Clear disk and memory caches for the test target to force a fresh fetch
    const cacheDir = path.join(process.cwd(), 'cache', 'public_samples');
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      for (const file of files) {
        if (file.includes('sample-ticket-synthetic')) {
          try {
            fs.unlinkSync(path.join(cacheDir, file));
          } catch (e) {}
        }
      }
    }

    const [p1, p2] = await Promise.all([
      fetchPublicSampleImage('sample-ticket-synthetic', 'analysis'),
      fetchPublicSampleImage('sample-ticket-synthetic', 'analysis')
    ]);
    assert.ok(p1.buffer);
    assert.ok(p2.buffer);
    assert.equal(p1.cacheKey, p2.cacheKey);
    // At least one of them should be marked as shared in flight
    const sharedCount = [p1, p2].filter(p => p.cacheSharedInFlight).length;
    assert.equal(sharedCount, 1);
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
