import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildPersistedDirectoryMaps,
  addDriveFilesToPathResolutionMap,
  shouldSkipExistingFolder,
  buildTraversalQueue,
  applyTraversedTimestampToMaps
} from './scanTraversal';

describe('scanTraversal', () => {
  it('Drive API response nodes added to pathResolutionMap are not considered persisted', () => {
    const { persistedDirsMap, pathResolutionMap } = buildPersistedDirectoryMaps([]);
    addDriveFilesToPathResolutionMap(pathResolutionMap, [{ id: '123', name: 'New Folder', parents: ['root'] }]);

    assert.strictEqual(pathResolutionMap.has('123'), true);
    assert.strictEqual(persistedDirsMap.has('123'), false);
  });

  it('skipExistingFolders skips only IDs present in persistedDirsMap', () => {
    const { persistedDirsMap, pathResolutionMap } = buildPersistedDirectoryMaps([{
      drive_id: 'existing1', name: 'Existing', parents: [], parent_id: null, depth: 1, path: '/Existing', last_traversed_at: null, next_page_token: null
    }]);

    addDriveFilesToPathResolutionMap(pathResolutionMap, [{ id: 'new1', name: 'New Folder' }]);

    assert.strictEqual(shouldSkipExistingFolder(persistedDirsMap, 'new1', true), false);
    assert.strictEqual(shouldSkipExistingFolder(persistedDirsMap, 'existing1', true), true);
  });

  it('newly fetched but not persisted folder is written/discovered when skipExistingFolders is true', () => {
    const persistedDirsMap = new Map();
    assert.strictEqual(shouldSkipExistingFolder(persistedDirsMap, 'new1', true), false);
  });

  it('existing persisted folder is skipped when skipExistingFolders is true', () => {
    const persistedDirsMap = new Map([['existing1', {} as any]]);
    assert.strictEqual(shouldSkipExistingFolder(persistedDirsMap, 'existing1', true), true);
  });

  it('ignored-folder deletion checks use persisted state, not temporary path-resolution state', () => {
    const { persistedDirsMap, pathResolutionMap } = buildPersistedDirectoryMaps([]);
    addDriveFilesToPathResolutionMap(pathResolutionMap, [{ id: 'ignore_me', name: 'Ignored' }]);

    assert.strictEqual(persistedDirsMap.has('ignore_me'), false);
  });

  it('traversal queue sorts null last_traversed_at before timestamped folders', () => {
    const { persistedDirsMap } = buildPersistedDirectoryMaps([
      { drive_id: 'folder1', name: 'F1', parents: [], parent_id: null, depth: 1, path: '/F1', last_traversed_at: '2024-01-01T00:00:00Z', next_page_token: null },
      { drive_id: 'folder2', name: 'F2', parents: [], parent_id: null, depth: 1, path: '/F2', last_traversed_at: null, next_page_token: null },
    ]);

    const queue = buildTraversalQueue(persistedDirsMap, { root_next_page_token: null, root_last_traversed_at: '2024-01-02T00:00:00Z' });
    
    assert.strictEqual(queue[0].drive_id, 'folder2');
    assert.strictEqual(queue[1].drive_id, 'folder1');
    assert.strictEqual(queue[2].drive_id, 'root');
  });

  it('root uses root-specific state rather than a directory document', () => {
    const { persistedDirsMap } = buildPersistedDirectoryMaps([]);
    const queue = buildTraversalQueue(persistedDirsMap, { root_next_page_token: 'token123', root_last_traversed_at: '2024-01-01T00:00:00Z' });

    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].drive_id, 'root');
    assert.strictEqual(queue[0].next_page_token, 'token123');
    assert.strictEqual(queue[0].last_traversed_at, '2024-01-01T00:00:00Z');
  });

  it('active folder receives last_traversed_at update even when zero children are returned', () => {
    const { persistedDirsMap, pathResolutionMap } = buildPersistedDirectoryMaps([
      { drive_id: 'folder1', name: 'F1', parents: [], parent_id: null, depth: 1, path: '/F1', last_traversed_at: null, next_page_token: null },
    ]);

    applyTraversedTimestampToMaps(persistedDirsMap, pathResolutionMap, 'folder1', '2024-01-01T00:00:00Z', null);
    
    assert.strictEqual(persistedDirsMap.get('folder1')?.last_traversed_at, '2024-01-01T00:00:00Z');
    assert.strictEqual(persistedDirsMap.get('folder1')?.next_page_token, null);
  });

  it('active folder receives last_traversed_at update even when all children are skipped', () => {
    const { persistedDirsMap, pathResolutionMap } = buildPersistedDirectoryMaps([
      { drive_id: 'folder1', name: 'F1', parents: [], parent_id: null, depth: 1, path: '/F1', last_traversed_at: null, next_page_token: null },
    ]);

    applyTraversedTimestampToMaps(persistedDirsMap, pathResolutionMap, 'folder1', '2024-01-01T00:00:00Z', null);
    
    assert.strictEqual(persistedDirsMap.get('folder1')?.last_traversed_at, '2024-01-01T00:00:00Z');
  });

  it('active folder receives next_page_token when continuation exists', () => {
    const { persistedDirsMap, pathResolutionMap } = buildPersistedDirectoryMaps([
      { drive_id: 'folder1', name: 'F1', parents: [], parent_id: null, depth: 1, path: '/F1', last_traversed_at: null, next_page_token: null },
    ]);

    applyTraversedTimestampToMaps(persistedDirsMap, pathResolutionMap, 'folder1', '2024-01-01T00:00:00Z', 'nextPageToken123');
    
    assert.strictEqual(persistedDirsMap.get('folder1')?.next_page_token, 'nextPageToken123');
  });

  it('when next_page_token is null, the folder no longer qualifies as unscanned in the next queue build', () => {
    const { persistedDirsMap, pathResolutionMap } = buildPersistedDirectoryMaps([
      { drive_id: 'folder1', name: 'F1', parents: [], parent_id: null, depth: 1, path: '/F1', last_traversed_at: null, next_page_token: null },
    ]);

    applyTraversedTimestampToMaps(persistedDirsMap, pathResolutionMap, 'folder1', '2024-01-01T00:00:00Z', null);
    
    const queue = buildTraversalQueue(persistedDirsMap, { root_next_page_token: null, root_last_traversed_at: null });
    
    assert.strictEqual(queue[0].drive_id, 'root');
    assert.strictEqual(queue[1].drive_id, 'folder1');
    assert.ok(queue[1].last_traversed_at);
  });

  it('local maps are updated immediately after traversal timestamp write', () => {
    const { persistedDirsMap, pathResolutionMap } = buildPersistedDirectoryMaps([
      { drive_id: 'folder1', name: 'F1', parents: [], parent_id: null, depth: 1, path: '/F1', last_traversed_at: null, next_page_token: null },
    ]);

    applyTraversedTimestampToMaps(persistedDirsMap, pathResolutionMap, 'folder1', '2024-01-01T00:00:00Z', null);
    
    assert.strictEqual(persistedDirsMap.get('folder1')?.last_traversed_at, '2024-01-01T00:00:00Z');
    assert.strictEqual(pathResolutionMap.get('folder1')?.last_traversed_at, '2024-01-01T00:00:00Z');
  });
});
