import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { optimizeImageForAnalysis } from './imagePayloadSizing';

test('provider-safe JPEG below caps preserves original bytes', async () => {
  const input = await sharp({ create: { width: 64, height: 64, channels: 3, background: 'red' } }).jpeg({ quality: 90 }).toBuffer();
  const out = await optimizeImageForAnalysis(input, 'default');
  assert.equal(out.mimeType, 'image/jpeg');
  assert.equal(out.buffer.equals(input), true);
  assert.equal(out.diagnostics.recompressed, false);
  assert.equal(out.diagnostics.reencoded, false);
});

test('provider-safe PNG below caps preserves original bytes', async () => {
  const input = await sharp({ create: { width: 64, height: 64, channels: 4, background: 'blue' } }).png().toBuffer();
  const out = await optimizeImageForAnalysis(input, 'default');
  assert.equal(out.mimeType, 'image/png');
  assert.equal(out.buffer.equals(input), true);
  assert.equal(out.diagnostics.recompressed, false);
  assert.equal(out.diagnostics.analysisMaxLongEdge, out.diagnostics.analysisTargetLongEdge);
});
