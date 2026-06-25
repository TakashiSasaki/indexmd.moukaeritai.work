import { test } from 'node:test';
import assert from 'node:assert';
import { isIgnoredFolderName, isIgnoredPath } from './scanner.js';

test('isIgnoredFolderName', () => {
  assert.strictEqual(isIgnoredFolderName('node_modules', ['node_modules', '.git']), true);
  assert.strictEqual(isIgnoredFolderName('src', ['node_modules', '.git']), false);
});

test('isIgnoredPath', () => {
  assert.strictEqual(isIgnoredPath('/project/node_modules/abc', ['node_modules']), true);
  assert.strictEqual(isIgnoredPath('/project/src', ['node_modules']), false);
});

test('traversal queue sorting logic', () => {
  const candidates = [
    { drive_id: 'a', last_traversed_at: '2026-01-02T00:00:00Z', path: '/a' },
    { drive_id: 'b', last_traversed_at: null, path: '/b' },
    { drive_id: 'c', last_traversed_at: '2026-01-01T00:00:00Z', path: '/c' },
    { drive_id: 'd', last_traversed_at: null, path: '/a/d' },
  ];

  candidates.sort((a, b) => {
    if (!a.last_traversed_at && !b.last_traversed_at) return (a.path || "").localeCompare(b.path || "");
    if (!a.last_traversed_at) return -1;
    if (!b.last_traversed_at) return 1;
    return new Date(a.last_traversed_at).getTime() - new Date(b.last_traversed_at).getTime();
  });

  // nulls first, then sorted by path. "/a/d" < "/b"
  assert.strictEqual(candidates[0].drive_id, 'd');
  assert.strictEqual(candidates[1].drive_id, 'b');
  // then oldest first. 'c' is Jan 01, 'a' is Jan 02
  assert.strictEqual(candidates[2].drive_id, 'c');
  assert.strictEqual(candidates[3].drive_id, 'a');
});
