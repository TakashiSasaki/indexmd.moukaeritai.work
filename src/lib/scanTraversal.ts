export interface ScanDirectory {
  drive_id: string;
  name: string;
  parents: string[];
  parent_id: string | null;
  depth: number;
  path: string;
  last_traversed_at: string | null;
  next_page_token: string | null;
  index_status?: string;
  last_updated_at?: string;
}

export function buildPersistedDirectoryMaps(dirs: ScanDirectory[]): {
  persistedDirsMap: Map<string, ScanDirectory>;
  pathResolutionMap: Map<string, ScanDirectory>;
} {
  const persistedDirsMap = new Map<string, ScanDirectory>();
  const pathResolutionMap = new Map<string, ScanDirectory>();

  dirs.forEach(d => {
    const obj = {
      drive_id: d.drive_id,
      name: d.name || (d.path || "").split("/").pop() || d.drive_id,
      parents: d.parents || (d.parent_id ? [d.parent_id] : []),
      parent_id: d.parent_id || null,
      depth: d.depth || 1,
      path: d.path,
      last_traversed_at: d.last_traversed_at || null,
      next_page_token: d.next_page_token || null,
      index_status: d.index_status || "pending"
    };
    persistedDirsMap.set(d.drive_id, obj);
    pathResolutionMap.set(d.drive_id, obj);
  });

  return { persistedDirsMap, pathResolutionMap };
}

export function addDriveFilesToPathResolutionMap(
  pathResolutionMap: Map<string, ScanDirectory>,
  files: any[],
  parentDriveId?: string
) {
  files.forEach((file: any) => {
    let resolvedId = file.id;
    if (file.mimeType === "application/vnd.google-apps.shortcut" && file.shortcutDetails) {
      resolvedId = file.shortcutDetails.targetId;
    }
    pathResolutionMap.set(resolvedId, {
      drive_id: resolvedId,
      name: file.name,
      parents: file.parents || (parentDriveId ? [parentDriveId] : []),
      parent_id: parentDriveId || (file.parents?.[0]) || null,
      depth: 1, // Will be computed properly when resolved
      path: `/${file.name}`,
      last_traversed_at: null,
      next_page_token: null
    });
  });
}

export function shouldSkipExistingFolder(
  persistedDirsMap: Map<string, ScanDirectory>,
  resolvedId: string,
  skipExistingFolders: boolean
): boolean {
  if (!skipExistingFolders) return false;
  return persistedDirsMap.has(resolvedId);
}

export function buildTraversalQueue(
  persistedDirsMap: Map<string, ScanDirectory>,
  rootState: { root_next_page_token: string | null; root_last_traversed_at: string | null }
): ScanDirectory[] {
  const currentDirsList: ScanDirectory[] = [];
  persistedDirsMap.forEach((val, key) => {
    currentDirsList.push(val);
  });

  const rootItem: ScanDirectory = {
    drive_id: "root",
    name: "マイドライブ (Root)",
    parents: [],
    parent_id: null,
    depth: 0,
    path: "/",
    last_traversed_at: rootState.root_last_traversed_at || null,
    next_page_token: rootState.root_next_page_token || null
  };

  const candidates = [rootItem, ...currentDirsList];

  // Sort by last_traversed_at ascending (nulls/empty strings first)
  candidates.sort((a, b) => {
    if (!a.last_traversed_at && !b.last_traversed_at) {
      return (a.path || "").localeCompare(b.path || "");
    }
    if (!a.last_traversed_at) return -1;
    if (!b.last_traversed_at) return 1;
    return new Date(a.last_traversed_at).getTime() - new Date(b.last_traversed_at).getTime();
  });

  return candidates;
}

export function selectNextTraversalTarget(queue: ScanDirectory[]): ScanDirectory | null {
  return queue.length > 0 ? queue[0] : null;
}

export function applyTraversedTimestampToMaps(
  persistedDirsMap: Map<string, ScanDirectory>,
  pathResolutionMap: Map<string, ScanDirectory>,
  folderId: string,
  timestamp: string | null,
  nextPageToken: string | null
) {
  const existingInMap = persistedDirsMap.get(folderId);
  if (existingInMap) {
    existingInMap.last_traversed_at = timestamp;
    existingInMap.next_page_token = nextPageToken;
  }
  const existingInResMap = pathResolutionMap.get(folderId);
  if (existingInResMap) {
    existingInResMap.last_traversed_at = timestamp;
    existingInResMap.next_page_token = nextPageToken;
  }
}
