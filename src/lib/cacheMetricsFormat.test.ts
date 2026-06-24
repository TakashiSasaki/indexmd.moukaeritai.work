import test, { describe } from 'node:test';
import assert from 'node:assert';
import { formatBytes, formatDate } from './cacheMetricsFormat';

describe('cacheMetricsFormat', () => {
  test('formatBytes handles 0 bytes', () => {
    assert.strictEqual(formatBytes(0), '0 B');
  });

  test('formatBytes handles bytes', () => {
    assert.strictEqual(formatBytes(500), '500 B');
  });

  test('formatBytes handles KB', () => {
    assert.strictEqual(formatBytes(1024), '1 KB');
    assert.strictEqual(formatBytes(1500), '1.46 KB');
  });

  test('formatBytes handles MB', () => {
    assert.strictEqual(formatBytes(1024 * 1024), '1 MB');
    assert.strictEqual(formatBytes(1024 * 1024 * 2.5), '2.5 MB');
  });

  test('formatDate handles null', () => {
    assert.strictEqual(formatDate(null), '-');
  });

  test('formatDate formats valid date', () => {
    const d = new Date('2026-06-24T12:00:00Z');
    const expected = d.toLocaleString();
    assert.strictEqual(formatDate('2026-06-24T12:00:00Z'), expected);
  });
});
