import type {
  SwarmBoardMessage,
  SwarmMentionEdge,
  SwarmTaskNode,
  SwarmTaskStatus,
} from '../../shared/types.js';

export interface SwarmBoardPostInput {
  from: string;
  to?: string;
  text: string;
  artifacts?: string[];
  kind?: string;
}

export interface SwarmBoardEntry extends SwarmBoardMessage {
  to?: string;
  artifacts?: string[];
}

export interface SwarmPlanTask {
  id: string;
  role: string;
  title: string;
  ownedFiles: string[];
  dependsOn: string[];
}

export interface SwarmTaskInput {
  id: string;
  title: string;
  role?: string;
  ownerName?: string;
  ownerRole?: string;
  ownerAgentId?: string;
  parentTaskId?: string;
  ownedFiles?: string[];
  dependsOn?: string[];
  dependsOnTaskIds?: string[];
  handoffTargetNames?: string[];
  status?: SwarmTaskStatus;
  verifiedKeyword?: string;
  evidenceBadges?: string[];
  durationSec?: number;
}

export interface WhiteboardSnapshot {
  messages: SwarmBoardMessage[];
  edges: SwarmMentionEdge[];
  taskNodes: SwarmTaskNode[];
}

export function normalizeSwarmFilePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .trim()
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '');
}

export function normalizeRoleKey(role: string): string {
  return role.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '-');
}

function matchesOwnedPattern(normalizedFile: string, rawPattern: string): boolean {
  const pattern = normalizeSwarmFilePath(rawPattern);
  if (!pattern || pattern === '*' || pattern === '**' || pattern === '**/*') {
    return true;
  }
  if (normalizedFile === pattern) {
    return true;
  }
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return normalizedFile === prefix || normalizedFile.startsWith(`${prefix}/`);
  }
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return normalizedFile === prefix || normalizedFile.startsWith(`${prefix}/`);
  }
  if (pattern.endsWith('/')) {
    return normalizedFile.startsWith(pattern);
  }
  // Glob pattern support (e.g., *.ts or src/**/*.tsx)
  if (pattern.includes('*')) {
    const regexSource =
      '^' +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '___DOUBLE_STAR___')
        .replace(/\*/g, '[^/]*')
        .replace(/___DOUBLE_STAR___/g, '.*') +
      '$';
    return new RegExp(regexSource).test(normalizedFile);
  }
  // Directory prefix match (e.g. ownedFiles: ['src/client'])
  if (normalizedFile.startsWith(`${pattern}/`)) {
    return true;
  }
  return false;
}

/**
 * FileLockManager prevents concurrent agents from corrupting the same file
 * and enforces task-level file ownership rules.
 */
export class FileLockManager {
  private readonly locks = new Map<string, string>();

  public acquire(filePath: string, ownerRole: string): boolean {
    const key = normalizeSwarmFilePath(filePath);
    const normalizedOwner = normalizeRoleKey(ownerRole);
    if (!key || !normalizedOwner) return false;

    const currentOwner = this.locks.get(key);
    if (currentOwner && currentOwner !== normalizedOwner) {
      return false;
    }
    this.locks.set(key, normalizedOwner);
    return true;
  }

  public release(filePath: string, ownerRole: string): boolean {
    const key = normalizeSwarmFilePath(filePath);
    const normalizedOwner = normalizeRoleKey(ownerRole);
    const currentOwner = this.locks.get(key);
    if (currentOwner === normalizedOwner) {
      this.locks.delete(key);
      return true;
    }
    return false;
  }

  public releaseAll(ownerRole: string): number {
    const normalizedOwner = normalizeRoleKey(ownerRole);
    let released = 0;
    for (const [file, holder] of this.locks.entries()) {
      if (holder === normalizedOwner) {
        this.locks.delete(file);
        released += 1;
      }
    }
    return released;
  }

  public clearAll(): void {
    this.locks.clear();
  }

  public getLockOwner(filePath: string): string | undefined {
    return this.locks.get(normalizeSwarmFilePath(filePath));
  }

  public getActiveLocks(): Record<string, string> {
    return Object.fromEntries(this.locks.entries());
  }

  public checkOwnership(
    filePath: string,
    ownerRole: string,
    ownedFiles?: string[],
  ): boolean {
    return this.getOwnershipViolation(filePath, ownerRole, ownedFiles) === null;
  }

  public getOwnershipViolation(
    filePath: string,
    ownerRole: string,
    ownedFiles?: string[],
  ): string | null {
    const key = normalizeSwarmFilePath(filePath);
    const normalizedOwner = normalizeRoleKey(ownerRole);

    const holder = this.locks.get(key);
    if (holder && holder !== normalizedOwner) {
      return `File "${key}" is currently locked by another role (@${holder}).`;
    }

    if (Array.isArray(ownedFiles) && ownedFiles.length > 0) {
      const allowed = ownedFiles.some((pattern) => matchesOwnedPattern(key, pattern));
      if (!allowed) {
        return `Role @${normalizedOwner} does not own "${key}". Allowed files: [${ownedFiles.join(', ')}].`;
      }
    }

    return null;
  }
}

/**
 * SwarmBoard manages inter-agent messages, @mention edges, and DAG task status
 * for both agent context sharing and the 2.5D Office Whiteboard snapshot.
 */
export class SwarmBoard {
  private messages: SwarmBoardEntry[] = [];
  private tasks = new Map<string, SwarmTaskNode>();
  private nextSeq = 1;

  public postMessage(input: SwarmBoardPostInput): SwarmBoardEntry {
    const from = input.from.trim().replace(/^@+/, '') || 'agent';
    const cleanTo = input.to ? input.to.trim().replace(/^@+/, '') : undefined;
    const mentionSet = new Set<string>();

    if (cleanTo) {
      mentionSet.add(cleanTo);
    }

    const regex = /@([a-zA-Z0-9_-]+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(input.text)) !== null) {
      if (match[1]) {
        mentionSet.add(match[1]);
      }
    }

    const mentions = Array.from(mentionSet);
    const entry: SwarmBoardEntry = {
      seq: this.nextSeq++,
      agent: from,
      to: cleanTo,
      text: input.text,
      time: new Date().toISOString(),
      kind: input.kind ?? 'message',
      mentions: mentions.length > 0 ? mentions : undefined,
      artifacts:
        input.artifacts && input.artifacts.length > 0 ? [...input.artifacts] : undefined,
    };

    this.messages.push(entry);
    return { ...entry };
  }

  public readMessages(sinceSeq?: number): SwarmBoardEntry[] {
    if (typeof sinceSeq === 'number') {
      return this.messages.filter((m) => m.seq > sinceSeq).map((m) => ({ ...m }));
    }
    return this.messages.map((m) => ({ ...m }));
  }

  public setTasks(tasks: SwarmTaskInput[]): SwarmTaskNode[] {
    this.tasks.clear();
    const now = new Date().toISOString();

    for (const item of tasks) {
      const roleName = item.ownerRole ?? item.role ?? item.ownerName ?? 'worker';
      const ownerName = item.ownerName ?? item.role ?? roleName;
      const dependsOnTaskIds = item.dependsOnTaskIds ?? item.dependsOn ?? [];
      const evidenceBadges = item.evidenceBadges
        ? [...item.evidenceBadges]
        : item.ownedFiles && item.ownedFiles.length > 0
          ? item.ownedFiles.map((f) => `file:${f}`)
          : [];

      const node: SwarmTaskNode = {
        id: item.id,
        title: item.title,
        ownerAgentId: item.ownerAgentId ?? normalizeRoleKey(ownerName),
        ownerName,
        ownerRole: roleName,
        parentTaskId: item.parentTaskId,
        dependsOnTaskIds: [...dependsOnTaskIds],
        handoffTargetNames: item.handoffTargetNames ? [...item.handoffTargetNames] : [],
        status: item.status ?? 'pending',
        verifiedKeyword: item.verifiedKeyword,
        evidenceBadges,
        updatedAt: now,
        durationSec: item.durationSec,
      };
      this.tasks.set(node.id, node);
    }

    return Array.from(this.tasks.values()).map((t) => ({ ...t }));
  }

  public updateTaskStatus(
    taskId: string,
    status: SwarmTaskStatus,
    extra?: {
      verifiedKeyword?: string;
      evidenceBadges?: string[];
      durationSec?: number;
    },
  ): SwarmTaskNode | undefined {
    const existing = this.tasks.get(taskId);
    if (!existing) return undefined;

    existing.status = status;
    existing.updatedAt = new Date().toISOString();
    if (extra?.verifiedKeyword !== undefined) {
      existing.verifiedKeyword = extra.verifiedKeyword;
    }
    if (extra?.evidenceBadges !== undefined) {
      existing.evidenceBadges = [...extra.evidenceBadges];
    }
    if (extra?.durationSec !== undefined) {
      existing.durationSec = extra.durationSec;
    }

    return { ...existing };
  }

  public getTasks(): SwarmTaskNode[] {
    return Array.from(this.tasks.values()).map((t) => ({ ...t }));
  }

  public getCompactSummary(maxMessages = 8, maxChars = 2400): string {
    const parts: string[] = [];

    if (this.tasks.size > 0) {
      const taskLines = Array.from(this.tasks.values()).map(
        (t) =>
          `- [${t.status.toUpperCase()}] ${t.id} (${t.ownerName}): ${t.title}` +
          (t.dependsOnTaskIds.length > 0 ? ` [dependsOn: ${t.dependsOnTaskIds.join(', ')}]` : ''),
      );
      parts.push(`Tasks:\n${taskLines.join('\n')}`);
    }

    const recent = this.messages.slice(-Math.max(1, maxMessages));
    if (recent.length > 0) {
      const msgLines = recent.map((m) => {
        const target = m.to ? ` -> @${m.to}` : '';
        const artifactsNote =
          m.artifacts && m.artifacts.length > 0 ? ` [files: ${m.artifacts.join(', ')}]` : '';
        const snippet = m.text.length > 260 ? `${m.text.slice(0, 257)}...` : m.text;
        return `#${m.seq} @${m.agent}${target}: ${snippet}${artifactsNote}`;
      });
      parts.push(`Board Messages:\n${msgLines.join('\n')}`);
    }

    const combined = parts.join('\n\n');
    if (combined.length <= maxChars) {
      return combined;
    }
    return combined.slice(-maxChars);
  }

  public toWhiteboardSnapshot(): WhiteboardSnapshot {
    const edgeMap = new Map<string, SwarmMentionEdge>();

    for (const msg of this.messages) {
      const targets = new Set<string>();
      if (msg.to) targets.add(msg.to);
      if (msg.mentions) {
        for (const m of msg.mentions) {
          targets.add(m);
        }
      }
      for (const to of targets) {
        if (!to || to === msg.agent) continue;
        const key = `${msg.agent}-->${to}`;
        const existing = edgeMap.get(key);
        if (existing) {
          existing.count += 1;
          existing.lastSeq = msg.seq;
          existing.lastTime = msg.time;
        } else {
          edgeMap.set(key, {
            from: msg.agent,
            to,
            count: 1,
            lastSeq: msg.seq,
            lastTime: msg.time,
          });
        }
      }
    }

    return {
      messages: this.messages.map((m) => ({ ...m })),
      edges: Array.from(edgeMap.values()),
      taskNodes: Array.from(this.tasks.values()).map((t) => ({ ...t })),
    };
  }
}
