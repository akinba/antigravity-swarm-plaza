import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type DatabaseSyncOptions } from 'node:sqlite';
import { normalizeWorkspacePath } from './config.js';

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
    const stmt = db.prepare(`
      SELECT
        conversation_id,
        title,
        preview,
        step_count,
        last_modified_time,
        workspace_uris,
        status,
        source,
        project_id,
        agent_name,
        parent_conversation_id,
        nesting_depth,
        not_fully_idle,
        killed,
        last_user_input_time
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

/**
 * Resolve each conversation's effective workspacePath and companyName by walking up
 * parent_conversation_id (and any extra parent-child links discovered on disk) with
 * a cycle guard so child/branched workers inherit their root ancestor's project floor.
 */
export function resolveConversationWorkspaces(
  rows: ConversationSummaryRow[],
  extraParentLinks?: Map<string, string>,
): Map<string, ResolvedWorkspaceInfo> {
  const rowMap = new Map<string, ConversationSummaryRow>();
  for (const row of rows) {
    if (row.conversation_id) {
      rowMap.set(row.conversation_id, row);
    }
  }

  const resolved = new Map<string, ResolvedWorkspaceInfo>();

  for (const row of rows) {
    const convId = row.conversation_id;
    const visited = new Set<string>();
    let currentId: string | null = convId;
    let rootId = convId;

    while (currentId && !visited.has(currentId) && visited.size < 25) {
      visited.add(currentId);
      rootId = currentId;

      const currentRow = rowMap.get(currentId);
      const dbParent: string | null = currentRow?.parent_conversation_id?.trim() || null;
      const diskParent: string | null = extraParentLinks?.get(currentId)?.trim() || null;
      const nextParent: string | null = dbParent || diskParent;

      if (!nextParent || visited.has(nextParent)) {
        break;
      }
      currentId = nextParent;
    }

    const rootRow = rowMap.get(rootId) || row;
    const rootUris = parseWorkspaceUris(rootRow.workspace_uris);
    const isOutside = rootRow.project_id === 'outside-of-project';

    if (rootUris.length === 0 || isOutside) {
      resolved.set(convId, {
        workspacePath: '',
        companyName: 'Global Freelance Lobby',
        isLobby: true,
        rootConversationId: rootId,
      });
    } else {
      const workspacePath = rootUris[0];
      resolved.set(convId, {
        workspacePath,
        companyName: getCompanyNameFromPath(workspacePath),
        isLobby: false,
        rootConversationId: rootId,
      });
    }
  }

  return resolved;
}
