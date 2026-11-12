import os from 'node:os';
import path from 'node:path';

export const AGY_DATA_DIR =
  process.env.AGY_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity');

export const CURRENT_WORKSPACE = process.env.AGY_WORKSPACE || process.cwd();

export const PORT = Number(process.env.PORT || 3210);

/**
 * Normalize a filesystem path to forward slashes without a trailing slash
 * (except root '/' or drive root 'c:/').
 */
export function normalizeWorkspacePath(inputPath: string): string {
  if (!inputPath) return '';
  let normalized = inputPath.replace(/\\/g, '/').trim();
  while (normalized.length > 1 && normalized.endsWith('/')) {
    if (/^[a-zA-Z]:\/$/.test(normalized)) break;
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Normalize a workspace path for case-insensitive comparison across Windows/POSIX.
 */
export function normalizeWorkspaceKey(inputPath: string): string {
  return normalizeWorkspacePath(inputPath).toLowerCase();
}
