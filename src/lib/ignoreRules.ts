/**
 * Pure helpers for checking ignored folders and paths.
 */

/**
 * Checks if a folder name itself is ignored.
 */
export function isIgnoredFolderName(name: string | null | undefined, ignoredNames: string[]): boolean {
  if (!name || !ignoredNames || ignoredNames.length === 0) return false;
  return ignoredNames.includes(name);
}

/**
 * Checks if a path contains any ignored folder segments.
 * Matching is exact for path segments.
 */
export function isIgnoredPath(path: string | null | undefined, ignoredNames: string[]): boolean {
  if (!path || !ignoredNames || ignoredNames.length === 0) return false;
  const segments = path.split("/");
  return segments.some(segment => ignoredNames.includes(segment));
}

/**
 * Determines if a directory should be ignored based on its name or path.
 */
export function shouldIgnoreDirectory(
  dir: { name: string | null | undefined; path: string | null | undefined },
  ignoredNames: string[]
): boolean {
  if (!ignoredNames || ignoredNames.length === 0) return false;
  return (
    isIgnoredFolderName(dir.name, ignoredNames) ||
    isIgnoredPath(dir.path, ignoredNames)
  );
}

/**
 * Identifies directory IDs from a list that are ignored (either name or path segment is ignored),
 * which can then be used for pruning from Firestore metadata.
 */
export function selectIgnoredDirectoryIdsForPrune(
  dirs: Array<{ drive_id: string; name: string; path: string }>,
  ignoredNames: string[]
): string[] {
  if (!ignoredNames || ignoredNames.length === 0) return [];
  return dirs
    .filter(dir => shouldIgnoreDirectory(dir, ignoredNames))
    .map(dir => dir.drive_id);
}
