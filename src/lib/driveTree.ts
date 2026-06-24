/**
 * Pure helper module for resolving Google Drive folder path and tree depth recursively.
 */

export interface DriveFolderInfo {
  name: string;
  parents?: string[];
}

/**
 * Recursively resolves the full path and tree depth of a given folder ID.
 * Features built-in cycle protection.
 */
export function resolvePathAndDepth(
  folderId: string | null | undefined,
  folderMap: Map<string, DriveFolderInfo>,
  visited: Set<string> = new Set<string>()
): { path: string; depth: number } {
  if (!folderId || folderId === "root" || folderId === "undefined") {
    return { path: "", depth: 0 };
  }

  if (visited.has(folderId)) {
    // Cycle protection! Prevent infinite recursion and return a clean indicator.
    return { path: "/CYCLE_DETECTED", depth: 0 };
  }

  const folderObj = folderMap.get(folderId);
  if (!folderObj) {
    // Missing parent fallback
    return { path: `/${folderId}`, depth: 1 };
  }

  const pId = folderObj.parents?.[0] || "root";
  if (pId === "root") {
    return { path: `/${folderObj.name}`, depth: 1 };
  }

  visited.add(folderId);
  const parentRes = resolvePathAndDepth(pId, folderMap, visited);
  visited.delete(folderId);

  if (parentRes.path === "/CYCLE_DETECTED") {
    return { path: `/CYCLE_DETECTED/${folderObj.name}`, depth: 1 };
  }

  return {
    path: parentRes.path === "" ? `/${folderObj.name}` : `${parentRes.path}/${folderObj.name}`,
    depth: parentRes.depth + 1
  };
}
