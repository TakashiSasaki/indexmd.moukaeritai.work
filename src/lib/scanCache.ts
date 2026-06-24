/**
 * Pure helper module for scan cache normalization and key generation.
 * Avoids direct node-specific imports at the top level to prevent bundling issues on the client.
 */

import { PROMPT_SPEC_VERSION } from "./promptSpecs";
import { INDEX_MD_FORMAT_VERSION } from "./indexMdFormat";

export interface ScanCacheParts {
  parentFolderId: string;
  nextPageToken: string;
  lastTraversedAt: string;
  pageSize: number;
  scanMode: string;
  cacheScope: string;
  promptSpecVersion: string;
  formatVersion: string;
  normalizedString: string;
}

/**
 * Normalizes input arguments for scan cache keys.
 */
export function buildScanCacheKeyParts(
  parentFolderId: string | undefined,
  nextPageToken: string | undefined,
  lastTraversedAt: string | undefined,
  pageSize: number | undefined,
  scanMode: string | undefined,
  cacheScope: string | undefined
): ScanCacheParts {
  const pId = parentFolderId || "root";
  const token = nextPageToken || "none";
  const traversed = lastTraversedAt || "none";
  const size = pageSize || 100;
  const mode = scanMode || "none";
  const scope = cacheScope || "none";
  const promptVer = PROMPT_SPEC_VERSION.replace(/\./g, '_');
  const formatVer = INDEX_MD_FORMAT_VERSION.replace(/\./g, '_');

  const normalizedString = `p_${pId}_t_${token}_l_${traversed}_s_${size}_m_${mode}_c_${scope}_pv_${promptVer}_fv_${formatVer}`;

  return {
    parentFolderId: pId,
    nextPageToken: token,
    lastTraversedAt: traversed,
    pageSize: size,
    scanMode: mode,
    cacheScope: scope,
    promptSpecVersion: PROMPT_SPEC_VERSION,
    formatVersion: INDEX_MD_FORMAT_VERSION,
    normalizedString
  };
}
