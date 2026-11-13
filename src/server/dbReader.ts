import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type DatabaseSyncOptions } from 'node:sqlite';
import { normalizeWorkspaceKey, normalizeWorkspacePath } from './config.js';

export interface ConversationSummaryRow {
  conversation_id: string;
  title: string | null;
  preview: string | null;
  step_count: number;
  last_modified_time: string | number | null;
  workspace_uris: string | null;
  status: string | null;
  source: string | null;
  project_id: string | null;
  agent_name: string | null;
  parent_conversation_id: string | null;
  nesting_depth: number | null;
  not_fully_idle: number | null;
  killed: number | null;
  last_user_input_time: string | number | null;
}

export interface ResolvedWorkspaceInfo {
  workspacePath: string;
  companyName: string;
  isLobby: boolean;
  rootConversationId: string;
}

/**
 * Decode a single file:// URI into a normalized forward-slash filesystem path.
 */
export function parseWorkspaceUri(rawUri: string): string {
  if (!rawUri || typeof rawUri !== 'string') return '';
  let decoded = rawUri.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep raw if malformed percent encoding
  }

  if (decoded.startsWith('file:///')) {
    const rest = decoded.slice('file:///'.length);
    // Windows drive letter like d:/Antigravity/Swarm-Dasboard
    if (/^[a-zA-Z]:/.test(rest)) {
      return normalizeWorkspacePath(rest);
    }
    // POSIX absolute path like /home/user/project
    return normalizeWorkspacePath('/' + rest);
  }

  if (decoded.startsWith('file://')) {
    return normalizeWorkspacePath(decoded.slice('file://'.length));
  }

  return normalizeWorkspacePath(decoded);
}

/**
 * Parse a JSON array string of workspace URIs (or single URI string) into normalized paths.
 */
export function parseWorkspaceUris(rawWorkspaceUris: string | null | undefined): string[] {
  if (!rawWorkspaceUris) return [];
  const trimmed = rawWorkspaceUris.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map(parseWorkspaceUri)
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  if (trimmed.startsWith('file://') || /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('/')) {
    const single = parseWorkspaceUri(trimmed);
    return single ? [single] : [];
  }
  return [];
}

/**
 * Extract a display company name from a normalized workspace path.
 */
export function getCompanyNameFromPath(workspacePath: string): string {
  if (!workspacePath) return 'Global Freelance Lobby';
  const base = path.posix.basename(normalizeWorkspacePath(workspacePath));
  return base || workspacePath;
}

export interface ProjectNamesMap {
  byId: Map<string, string>;
  byWorkspaceKey: Map<string, string>;
}

/**
 * Scan `<parent_of_agyDataDir>/config/projects/*.json` read-only to map
 * user-renamed Antigravity project display names by project ID and workspace URI.
 */
export function loadProjectNames(agyDataDir: string): ProjectNamesMap {
  const byId = new Map<string, string>();
  const byWorkspaceKey = new Map<string, string>();
  const projectsDir = path.resolve(agyDataDir, '..', 'config', 'projects');

  if (!fs.existsSync(projectsDir)) {
    return { byId, byWorkspaceKey };
  }

  let files: string[];
  try {
    files = fs.readdirSync(projectsDir);
  } catch {
    return { byId, byWorkspaceKey };
  }

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = fs.readFileSync(path.join(projectsDir, file), 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
      if (!name) continue;

      if (typeof parsed.id === 'string' && parsed.id.trim()) {
        byId.set(parsed.id.trim(), name);
      }

      const projectResources = parsed.projectResources as
        | { resources?: Array<{ folderUri?: unknown }> }
        | undefined;
      if (Array.isArray(projectResources?.resources)) {
        for (const res of projectResources.resources) {
          if (typeof res?.folderUri === 'string' && res.folderUri.trim()) {
            const decoded = parseWorkspaceUri(res.folderUri);
            if (decoded) {
              byWorkspaceKey.set(normalizeWorkspaceKey(decoded), name);
            }
          }
        }
      }
    } catch {
      // Skip malformed project JSON
    }
  }

  return { byId, byWorkspaceKey };
}

/**
 * Open conversation_summaries.db strictly read-only and return all rows.
 * Returns [] if the DB file does not exist or cannot be read.
 */
export function readConversationSummaries(agyDataDir: string): ConversationSummaryRow[] {
  const dbPath = path.join(agyDataDir, 'conversation_summaries.db');
  if (!fs.existsSync(dbPath)) {
    return [];
  }

  const uri = 'file:' + dbPath.replace(/\\/g, '/') + '?mode=ro';
  let db: DatabaseSync | null = null;
  try {
    const opts = { uri: true, readOnly: true } as unknown as DatabaseSyncOptions;
    db = new DatabaseSync(uri, opts);

    const tableInfo = db
      .prepare('PRAGMA table_info(conversation_summaries)')
      .all() as Array<{ name: string }>;
    const cols = new Set(tableInfo.map((c) => c.name));
    if (cols.size === 0 || !cols.has('conversation_id')) {
      return [];
    }

    const optCol = (name: string) => (cols.has(name) ? name : `NULL AS ${name}`);
    const stmt = db.prepare(`
      SELECT
        conversation_id,
        ${optCol('title')},
        ${optCol('preview')},
        ${cols.has('step_count') ? 'step_count' : '0 AS step_count'},
        ${optCol('last_modified_time')},
        ${optCol('workspace_uris')},
        ${optCol('status')},
        ${optCol('source')},
        ${optCol('project_id')},
        ${optCol('agent_name')},
        ${optCol('parent_conversation_id')},
        ${optCol('nesting_depth')},
        ${optCol('not_fully_idle')},
        ${optCol('killed')},
        ${optCol('last_user_input_time')}
      FROM conversation_summaries
    `);
    const rows = stmt.all() as unknown as ConversationSummaryRow[];
    return rows.map((row) => ({
      ...row,
      step_count: Number(row.step_count || 0),
    }));
  } catch {
    return [];
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

const transcriptWorkspaceMemo = new Map<string, string | null>();

const EXCLUDED_PATH_SEGMENTS = ['.gemini', 'appdata', 'windows', 'program files'];

function isAllowedWorkspaceCandidate(candidatePath: string): boolean {
  const lower = candidatePath.toLowerCase();
  return !EXCLUDED_PATH_SEGMENTS.some(
    (seg) => lower.includes(`/${seg}/`) || lower.endsWith(`/${seg}`),
  );
}

/**
 * Inspect the first 8192 bytes of a root conversation's transcript.jsonl for an
 * explicit workspace path reference like `@[d:\Antigravity\hex-weather]` or `file:///...`.
 */
function inferWorkspaceFromTranscriptHead(agyDataDir: string, convId: string): string | null {
  const cacheKey = `${agyDataDir}::${convId}`;
  if (transcriptWorkspaceMemo.has(cacheKey)) {
    return transcriptWorkspaceMemo.get(cacheKey) ?? null;
  }

  const transcriptPath = path.join(
    agyDataDir,
    'brain',
    convId,
    '.system_generated',
    'logs',
    'transcript.jsonl',
  );

  let result: string | null = null;
  let fd: number | null = null;
  try {
    if (fs.existsSync(transcriptPath)) {
      const buf = Buffer.allocUnsafe(8192);
      fd = fs.openSync(transcriptPath, 'r');
      const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
      const head = buf.toString('utf8', 0, bytesRead);

      const candidates: string[] = [];
      const atMentionRegex = /@\[([A-Za-z]:[\\/][^\]\r\n"']+)]/g;
      let match: RegExpExecArray | null;
      while ((match = atMentionRegex.exec(head)) !== null) {
        candidates.push(match[1].replace(/\\/g, '/'));
      }

      const fileUriRegex = /file:\/\/\/([A-Za-z]%3A\/[^\s"'\]]+)/gi;
      while ((match = fileUriRegex.exec(head)) !== null) {
        try {
          candidates.push(decodeURIComponent(match[1]).replace(/\\/g, '/'));
        } catch {
          // Ignore malformed URI
        }
      }

      for (const rawCandidate of candidates) {
        const normalized = normalizeWorkspacePath(rawCandidate);
        if (!normalized || !isAllowedWorkspaceCandidate(normalized)) continue;
        if (!fs.existsSync(normalized)) continue;
        try {
          const stat = fs.statSync(normalized);
          const dirPath = stat.isFile()
            ? normalizeWorkspacePath(path.dirname(normalized))
            : normalized;
          if (dirPath && isAllowedWorkspaceCandidate(dirPath)) {
            result = dirPath;
            break;
          }
        } catch {
          // Ignore stat errors
        }
      }
    }
  } catch {
    result = null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close errors
      }
    }
  }

  transcriptWorkspaceMemo.set(cacheKey, result);
  return result;
}

export interface ResolveWorkspaceOptions {
  agyDataDir?: string;
  swarmConvIds?: Set<string>;
}

/**
 * Resolve each conversation's effective workspacePath and companyName by walking up
 * parent_conversation_id (and any extra parent-child links discovered on disk) with
 * a cycle guard so child/branched workers inherit their root ancestor's project floor.
 */
export function resolveConversationWorkspaces(
  rows: ConversationSummaryRow[],
  extraParentLinks?: Map<string, string>,
  options?: ResolveWorkspaceOptions,
): Map<string, ResolvedWorkspaceInfo> {
  const rowMap = new Map<string, ConversationSummaryRow>();
  const hasChildren = new Set<string>();

  for (const row of rows) {
    if (row.conversation_id) {
      rowMap.set(row.conversation_id, row);
    }
    const parentId = row.parent_conversation_id?.trim();
    if (parentId) {
      hasChildren.add(parentId);
    }
  }
  if (extraParentLinks) {
    for (const parentId of extraParentLinks.values()) {
      if (parentId?.trim()) {
        hasChildren.add(parentId.trim());
      }
    }
  }

  const projectNames = options?.agyDataDir
    ? loadProjectNames(options.agyDataDir)
    : { byId: new Map<string, string>(), byWorkspaceKey: new Map<string, string>() };

  const resolveDisplayCompanyName = (
    rootRow: ConversationSummaryRow,
    workspacePath: string,
    fallbackName: string,
  ): string => {
    const byId = rootRow.project_id ? projectNames.byId.get(rootRow.project_id) : undefined;
    if (byId) return byId;
    const byWs = workspacePath
      ? projectNames.byWorkspaceKey.get(normalizeWorkspaceKey(workspacePath))
      : undefined;
    if (byWs) return byWs;
    return fallbackName;
  };

  const resolved = new Map<string, ResolvedWorkspaceInfo>();

  for (const row of rows) {
    const convId = row.conversation_id;
    const visited = new Set<string>();
    let currentId: string | null = convId;
    let rootId = convId;
    let cycleDetected = false;

    while (currentId && !visited.has(currentId) && visited.size < 25) {
      visited.add(currentId);
      rootId = currentId;

      const currentRow = rowMap.get(currentId);
      const dbParent: string | null = currentRow?.parent_conversation_id?.trim() || null;
      const diskParent: string | null = extraParentLinks?.get(currentId)?.trim() || null;
      const nextParent: string | null = dbParent || diskParent;

      if (!nextParent) {
        break;
      }
      if (visited.has(nextParent)) {
        cycleDetected = true;
        break;
      }
      currentId = nextParent;
    }

    const rootRow = rowMap.get(rootId) || row;
    const rootUris = parseWorkspaceUris(rootRow.workspace_uris);
    const isOutside = rootRow.project_id === 'outside-of-project';

    if (cycleDetected && rootUris.length === 0) {
      resolved.set(convId, {
        workspacePath: '',
        companyName: 'Global Freelance Lobby',
        isLobby: true,
        rootConversationId: rootId,
      });
      continue;
    }

    if (rootUris.length > 0 && !isOutside) {
      const workspacePath = rootUris[0];
      resolved.set(convId, {
        workspacePath,
        companyName: resolveDisplayCompanyName(
          rootRow,
          workspacePath,
          getCompanyNameFromPath(workspacePath),
        ),
        isLobby: false,
        rootConversationId: rootId,
      });
      continue;
    }

    // Root has empty workspace_uris or project_id === 'outside-of-project'
    const inferredPath =
      rootUris.length === 0 && options?.agyDataDir
        ? inferWorkspaceFromTranscriptHead(options.agyDataDir, rootId)
        : null;

    if (inferredPath) {
      const baseName = getCompanyNameFromPath(inferredPath);
      const rootTitle = rootRow.title?.trim();
      const fallback =
        rootTitle && rootTitle.toLowerCase() === baseName.toLowerCase() ? rootTitle : baseName;
      resolved.set(convId, {
        workspacePath: inferredPath,
        companyName: resolveDisplayCompanyName(rootRow, inferredPath, fallback),
        isLobby: false,
        rootConversationId: rootId,
      });
      continue;
    }

    const rootTitle = rootRow.title?.trim();
    const isSubstantialRoot =
      Number(rootRow.step_count || 0) >= 15 ||
      hasChildren.has(rootId) ||
      Boolean(options?.swarmConvIds?.has(rootId));

    if (rootTitle && isSubstantialRoot) {
      resolved.set(convId, {
        workspacePath: `conversation://${rootId}`,
        companyName: resolveDisplayCompanyName(rootRow, '', rootTitle),
        isLobby: false,
        rootConversationId: rootId,
      });
      continue;
    }

    resolved.set(convId, {
      workspacePath: '',
      companyName: 'Global Freelance Lobby',
      isLobby: true,
      rootConversationId: rootId,
    });
  }

  return resolved;
}
