import os from 'node:os';
import path from 'node:path';

export const AGY_DATA_DIR =
  process.env.AGY_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity');

export const CURRENT_WORKSPACE = process.env.AGY_WORKSPACE || process.cwd();

export function resolveDefaultPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.ANTIGRAVITY_SIDECAR_WEB_PORT || env.PORT || '3210';
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
    return parsed;
  }
  return 3210;
}

export const PORT = resolveDefaultPort();

export const BIND_HOST = process.env.HOST || '127.0.0.1';

export function resolveSidecarToken(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.ANTIGRAVITY_SIDECAR_UI_TOKEN ||
    env.ANTIGRAVITY_SIDECAR_AUTH_TOKEN ||
    env.ANTIGRAVITY_SIDECAR_WEB_TOKEN ||
    ''
  );
}

export const GO_HOME_MINUTES = Number(process.env.AGY_GO_HOME_MINUTES || 8);

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
