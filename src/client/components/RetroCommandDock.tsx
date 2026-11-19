import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApprovalDecision,
  ApprovalRequestPayload,
  CloudProviderId,
  DiffFileChange,
  ExecutionMode,
  GeminiModelInfo,
  LocalAgentConfig,
  OfficeEmployee,
  PromptModelId,
  PromptProvider,
  PromptStreamEvent,
  ProviderModelInfo,
  SwarmRoleAssignment,
  ThinkingLevel,
} from '../../shared/types';
import { playMentionChime, playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';
import { loadStoredCustomBaseUrl } from './SettingsModal';

export interface DockModelOption {
  id: PromptModelId;
  label: string;
  provider?: PromptProvider;
  customBaseUrl?: string;
  localBaseUrl?: string;
  ollamaBaseUrl?: string;
}

export const CLOUD_PROVIDER_ORDER: CloudProviderId[] = [
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'deepseek',
  'groq',
  'xai',
  'mistral',
  'copilot',
  'custom',
];

export const PROVIDER_BADGES: Record<PromptProvider, { icon: string; label: string }> = {
  gemini: { icon: '✨', label: 'Gemini' },
  openai: { icon: '⚡', label: 'OpenAI' },
  anthropic: { icon: '🧠', label: 'Anthropic' },
  openrouter: { icon: '🌐', label: 'OpenRouter' },
  deepseek: { icon: '🐋', label: 'DeepSeek' },
  groq: { icon: '⚡', label: 'Groq' },
  xai: { icon: '✖', label: 'xAI' },
  mistral: { icon: '🌬', label: 'Mistral' },
  copilot: { icon: '🐙', label: 'Copilot' },
  custom: { icon: '🔧', label: 'Custom' },
  ollama: { icon: '🦙', label: 'Ollama' },
  lmstudio: { icon: '💻', label: 'LM Studio' },
};

export const SWARM_ROLES = ['Architect', 'Coder Core', 'Coder UI', 'Analyst', 'Verifier'] as const;

export function buildDefaultSwarmProfile(
  availableModels: DockModelOption[] = [],
): SwarmRoleAssignment[] {
  const defaultModel = availableModels[0]?.id ?? '';
  return SWARM_ROLES.map((role) => ({
    role,
    model: defaultModel,
    level: 'medium' as ThinkingLevel,
  }));
}

export function getProjectSwarmStorageKey(floorId?: string | null): string {
  return `swarm_plaza_project_swarm_${floorId || 'default'}`;
}

export function loadProjectSwarmProfile(
  floorId: string | null | undefined,
  availableModels: DockModelOption[] = [],
): SwarmRoleAssignment[] {
  const fallback = buildDefaultSwarmProfile(availableModels);
  try {
    const raw = localStorage.getItem(getProjectSwarmStorageKey(floorId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    const valid = parsed.filter(
      (item): item is SwarmRoleAssignment =>
        Boolean(item && typeof item.role === 'string' && item.role.trim().length > 0),
    );
    if (valid.length === 0) return fallback;
    return valid.map((item) => {
      const validLevel: ThinkingLevel =
        item.level === 'low' || item.level === 'medium' || item.level === 'high'
          ? item.level
          : 'medium';
      const candidateModel =
        typeof item.model === 'string' && item.model.length > 0
          ? item.model
          : (availableModels[0]?.id ?? '');
      return { role: item.role.trim(), model: candidateModel, level: validLevel };
    });
  } catch {
    return fallback;
  }
}

export function saveProjectSwarmProfile(
  floorId: string | null | undefined,
  profile: SwarmRoleAssignment[],
): void {
  try {
    localStorage.setItem(getProjectSwarmStorageKey(floorId), JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
}

export function formatOllamaModelLabel(agent: Pick<LocalAgentConfig, 'name' | 'model'> & { provider?: LocalAgentConfig['provider'] }): string {
  const provider = agent.provider ?? 'ollama';
  const badge = PROVIDER_BADGES[provider];
  const cleanName = agent.name.trim();
  const cleanModel = agent.model.trim();
  if (!cleanName || cleanName.toLowerCase().includes(cleanModel.toLowerCase())) {
    return `${badge.icon} ${cleanModel} (${badge.label})`;
  }
  return `${badge.icon} ${cleanName} (${badge.label})`;
}

export function formatProviderModelLabel(
  provider: PromptProvider,
  displayName: string,
): string {
  const badge = PROVIDER_BADGES[provider];
  const trimmed = displayName.trim();
  const suffixPattern = new RegExp(`\\(${badge.label}\\)$`, 'i');
  const withSuffix = suffixPattern.test(trimmed) ? trimmed : `${trimmed} (${badge.label})`;
  return withSuffix.startsWith(badge.icon) ? withSuffix : `${badge.icon} ${withSuffix}`;
}

export function buildDockModelOptions(
  localAgents: LocalAgentConfig[] = [],
  providerModelsOrGemini: Partial<Record<CloudProviderId, ProviderModelInfo[]>> | GeminiModelInfo[] = {},
  customBaseUrl: string = loadStoredCustomBaseUrl(),
): DockModelOption[] {
  const providerModelsMap: Partial<Record<CloudProviderId, ProviderModelInfo[]>> = Array.isArray(
    providerModelsOrGemini,
  )
    ? {
        gemini: providerModelsOrGemini.map((m) => ({
          id: m.id,
          displayName: m.displayName || m.id,
          provider: 'gemini',
        })),
      }
    : providerModelsOrGemini;

  const dynamicCloudOptions: DockModelOption[] = [];
  for (const provider of CLOUD_PROVIDER_ORDER) {
    const models = providerModelsMap[provider] ?? [];
    for (const m of models) {
      const id = m.id.startsWith(`${provider}:`) ? m.id : `${provider}:${m.id}`;
      dynamicCloudOptions.push({
        id: id as PromptModelId,
        label: formatProviderModelLabel(provider, m.displayName || m.id),
        provider,
        ...(provider === 'custom' && customBaseUrl ? { customBaseUrl } : {}),
      });
    }
  }

  const dynamicLocalOptions: DockModelOption[] = localAgents
    .filter((agent) => agent.enabled)
    .map((agent) => {
      const localProvider = agent.provider || 'ollama';
      return {
        id: `${localProvider}:${agent.model}` as PromptModelId,
        label: formatOllamaModelLabel(agent),
        provider: localProvider,
        localBaseUrl: agent.baseUrl,
        ollamaBaseUrl: localProvider === 'ollama' ? agent.baseUrl : undefined,
      };
    });
  return [...dynamicCloudOptions, ...dynamicLocalOptions];
}

export function resolvePromptProvider(
  model: PromptModelId,
  localAgents: LocalAgentConfig[] = [],
  customBaseUrl: string = loadStoredCustomBaseUrl(),
): {
  provider: PromptProvider;
  customBaseUrl?: string;
  localBaseUrl?: string;
  ollamaBaseUrl?: string;
} {
  const matched = localAgents.find(
    (a) => a.enabled && (`${a.provider}:${a.model}` === model || a.model === model),
  );
  if (matched) {
    return {
      provider: matched.provider,
      localBaseUrl: matched.baseUrl,
      ollamaBaseUrl: matched.provider === 'ollama' ? matched.baseUrl : undefined,
    };
  }
  const prefixes: PromptProvider[] = [
    'gemini',
    'openai',
    'anthropic',
    'openrouter',
    'deepseek',
    'groq',
    'xai',
    'mistral',
    'copilot',
    'custom',
    'ollama',
    'lmstudio',
  ];
  for (const p of prefixes) {
    if (model.startsWith(`${p}:`)) {
      if (p === 'ollama') {
        return { provider: 'ollama', localBaseUrl: 'http://localhost:11434', ollamaBaseUrl: 'http://localhost:11434' };
      }
      if (p === 'lmstudio') {
        return { provider: 'lmstudio', localBaseUrl: 'http://localhost:1234' };
      }
      if (p === 'custom') {
        return {
          provider: 'custom',
          ...(customBaseUrl.trim() ? { customBaseUrl: customBaseUrl.trim() } : {}),
        };
      }
      return { provider: p };
    }
  }
  if (model === 'qwen2.5-coder:14b') {
    return { provider: 'ollama', localBaseUrl: 'http://localhost:11434', ollamaBaseUrl: 'http://localhost:11434' };
  }
  return { provider: 'gemini' };
}

export const DEFAULT_DOCK_MODEL: PromptModelId = '';

export const DOCK_MODE_OPTIONS: ExecutionMode[] = ['turbo', 'safe', 'eco-swarm'];

export const STATIC_MENTION_ROLES: Array<{ id: string; badge: string }> = [
  { id: 'coordinator', badge: 'BOSS' },
  { id: 'coder-lead', badge: 'LEAD' },
  { id: 'coder-rapid', badge: 'RAPID' },
  { id: 'flash-ops', badge: 'OPS' },
  { id: 'local-gpu', badge: 'OLLAMA' },
];

export interface SlashCommandOption {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommandOption[] = [
  { command: '/swarm', description: 'Coordinate multi-agent swarm task' },
  { command: '/grill-me', description: 'Interactive design & edge-case interview' },
  { command: '/review', description: 'Review current diff & code quality' },
  { command: '/compact', description: 'Summarize & compact session context' },
  { command: '/clear', description: 'Clear terminal output & diffs' },
];

export interface AutocompleteTrigger {
  kind: '@' | '/';
  query: string;
  startIndex: number;
}

export interface MentionSuggestion {
  id: string;
  label: string;
  badge: string;
}

export function detectAutocompleteTrigger(
  text: string,
  cursorPos: number,
): AutocompleteTrigger | null {
  const head = text.slice(0, Math.max(0, cursorPos));
  const match = /(^|\s)([@/])([a-zA-Z0-9_.-]*)$/.exec(head);
  if (!match) return null;
  const symbol = match[2] as '@' | '/';
  const query = match[3] ?? '';
  const startIndex = head.length - query.length - 1;
  return { kind: symbol, query, startIndex };
}

export function filterMentionSuggestions(
  query: string,
  employees: Array<Pick<OfficeEmployee, 'id' | 'name' | 'roleTitle'>> = [],
  localAgents: LocalAgentConfig[] = [],
): MentionSuggestion[] {
  const q = query.trim().toLowerCase();
  const seen = new Set<string>();
  const items: MentionSuggestion[] = [];

  for (const emp of employees) {
    const cleanName = emp.name.replace(/^@/, '');
    const key = cleanName.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: cleanName,
      label: `@${cleanName}`,
      badge: emp.roleTitle.toUpperCase(),
    });
  }

  for (const agent of localAgents) {
    if (!agent.enabled) continue;
    const cleanMention = agent.mention.replace(/^@/, '');
    const key = cleanMention.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: cleanMention,
      label: `@${cleanMention}`,
      badge: `OLLAMA · ${agent.model}`,
    });
  }

  for (const role of STATIC_MENTION_ROLES) {
    const key = role.id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: role.id,
      label: `@${role.id}`,
      badge: role.badge,
    });
  }

  if (!q) return items;
  return items.filter(
    (item) =>
      item.id.toLowerCase().includes(q) || item.badge.toLowerCase().includes(q),
  );
}

export function filterSlashSuggestions(query: string): SlashCommandOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.command.slice(1).toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q),
  );
}

export function resolveOrchestration(
  promptText: string,
  explicit?: 'single' | 'swarm',
): 'single' | 'swarm' {
  if (explicit) return explicit;
  return promptText.trim().startsWith('/swarm') ? 'swarm' : 'single';
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_.-]+)/g);
  if (!matches) return [];
  const unique = new Set<string>();
  for (const m of matches) {
    unique.add(m.slice(1));
  }
  return Array.from(unique);
}

export interface DockLogLine {
  id: string;
  kind: PromptStreamEvent['type'];
  text: string;
  runId?: string;
}

export function appendPromptStreamLog(
  prev: DockLogLine[],
  kind: PromptStreamEvent['type'],
  text: string,
  runId?: string,
): DockLogLine[] {
  if (!text) return prev;
  if (kind === 'chunk' && prev.length > 0) {
    const last = prev[prev.length - 1];
    if (last.kind === 'chunk' && (runId === undefined || last.runId === undefined || last.runId === runId)) {
      const updated: DockLogLine = {
        ...last,
        text: `${last.text}${text}`,
        runId: runId ?? last.runId,
      };
      return [...prev.slice(0, -1), updated];
    }
  }
  const next = [
    ...prev,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      text,
      runId,
    },
  ];
  return next.length > 200 ? next.slice(next.length - 200) : next;
}

export function formatStreamEventLog(
  ev: PromptStreamEvent,
): { kind: PromptStreamEvent['type']; text: string } | null {
  if (ev.type === 'status' && ev.text) {
    return { kind: 'status', text: `[STATUS] ${ev.text}` };
  }
  if (ev.type === 'chunk' && ev.text) {
    return { kind: 'chunk', text: ev.text };
  }
  if (ev.type === 'file' && ev.file) {
    return { kind: 'file', text: `[FILE] ${ev.file}` };
  }
  if (ev.type === 'tool_call') {
    const tool = ev.toolName || 'tool';
    const icon =
      tool === 'edit_file' || tool === 'write_file'
        ? '✏️'
        : tool === 'run_command'
          ? '⚡'
          : '🔧';
    const prefix = ev.agentId ? `[${ev.agentId}] ` : '';
    const detail = ev.text ? ` — ${ev.text}` : '';
    return { kind: 'tool_call', text: `${prefix}${icon} ${tool}${detail}` };
  }
  if (ev.type === 'tool_result') {
    const toolPart = ev.toolName ? `[${ev.toolName}] ` : '';
    return { kind: 'tool_result', text: `↳ ${toolPart}${ev.text || 'ok'}` };
  }
  if (ev.type === 'board') {
    if (ev.boardMessage) {
      const mentionsPart = ev.boardMessage.mentions?.length
        ? ` → ${ev.boardMessage.mentions.map((m) => `@${m}`).join(', ')}`
        : '';
      return {
        kind: 'board',
        text: `💬 @${ev.boardMessage.agent}${mentionsPart}: ${ev.boardMessage.text}`,
      };
    }
    return ev.text ? { kind: 'board', text: `💬 ${ev.text}` } : null;
  }
  if (ev.type === 'approval_request') {
    if (ev.approval) {
      return {
        kind: 'approval_request',
        text: `🛡️ [${ev.approval.role}] ${ev.approval.toolName}: ${ev.approval.summary}`,
      };
    }
    return ev.text ? { kind: 'approval_request', text: `🛡️ ${ev.text}` } : null;
  }
  if (ev.type === 'approval_resolved') {
    return ev.text ? { kind: 'approval_resolved', text: `🔓 ${ev.text}` } : null;
  }
  if (ev.type === 'error' && ev.text) {
    return { kind: 'error', text: `[ERR] ${ev.text}` };
  }
  if (ev.type === 'done' && ev.text) {
    return { kind: 'done', text: `[DONE] ${ev.text}` };
  }
  return null;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface RetroCommandDockProps {
  activeFloorId?: string | null;
  employees?: OfficeEmployee[];
  localAgents?: LocalAgentConfig[];
  providerModels?: Partial<Record<CloudProviderId, ProviderModelInfo[]>>;
  workspace?: string;
}

export const RetroCommandDock: React.FC<RetroCommandDockProps> = ({
  activeFloorId,
  employees = [],
  localAgents = [],
  providerModels = {},
  workspace,
}) => {
  const { t, locale } = useI18n();
  const [minimized, setMinimized] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [swarmConfigOpen, setSwarmConfigOpen] = useState(false);
  const [newRoleDraft, setNewRoleDraft] = useState('');
  const [promptText, setPromptText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedAcIndex, setSelectedAcIndex] = useState(0);
  const [model, setModel] = useState<PromptModelId>(DEFAULT_DOCK_MODEL);
  const [mode, setMode] = useState<ExecutionMode>('turbo');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showAttachInput, setShowAttachInput] = useState(false);
  const [attachDraft, setAttachDraft] = useState('');
  const [runStatus, setRunStatus] = useState<'running' | 'idle' | 'stopped' | 'error'>('idle');
  const [logs, setLogs] = useState<DockLogLine[]>([]);
  const [diffs, setDiffs] = useState<DiffFileChange[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequestPayload[]>([]);
  const [submittingApprovalId, setSubmittingApprovalId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const appendLog = (kind: PromptStreamEvent['type'], text: string, runId?: string) => {
    if (!text) return;
    setLogs((prev) => appendPromptStreamLog(prev, kind, text, runId));
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(120, Math.max(36, el.scrollHeight))}px`;
  }, [promptText, minimized]);

  // Auto-scroll drawer logs
  useEffect(() => {
    if (drawerOpen) {
      logsEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [logs, drawerOpen]);

  // Hydrate initial prompt state & subscribe to SSE /api/stream
  useEffect(() => {
    let cancelled = false;
    fetch('/api/prompt/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.status) setRunStatus(data.status);
        if (Array.isArray(data.diffs)) setDiffs(data.diffs);
        if (Array.isArray(data.logs) && data.logs.length > 0) {
          setLogs(
            data.logs.slice(-80).map((line: string, idx: number) => ({
              id: `init-${idx}`,
              kind: 'chunk' as const,
              text: line,
            })),
          );
        }
      })
      .catch(() => {});

    if (typeof EventSource === 'undefined') return undefined;
    const es = new EventSource('/api/stream');
    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as PromptStreamEvent;
        if (ev.status) setRunStatus(ev.status);
        const formatted = formatStreamEventLog(ev);
        if (formatted) {
          appendLog(formatted.kind, formatted.text, ev.runId);
        }
        if (ev.type === 'diff' && Array.isArray(ev.diffs)) {
          setDiffs(ev.diffs);
          setDrawerOpen(true);
        } else if (ev.type === 'error') {
          setDrawerOpen(true);
        } else if (ev.type === 'approval_request' && ev.approval) {
          const approval = ev.approval;
          setPendingApprovals((prev) =>
            prev.some((a) => a.approvalId === approval.approvalId) ? prev : [...prev, approval],
          );
          setDrawerOpen(true);
        } else if (ev.type === 'approval_resolved') {
          setPendingApprovals((prev) => {
            if (ev.approval?.approvalId) {
              return prev.filter((a) => a.approvalId !== ev.approval!.approvalId);
            }
            if (ev.runId) {
              return prev.filter((a) => a.runId !== ev.runId);
            }
            return prev.slice(1);
          });
          setSubmittingApprovalId(null);
        } else if (ev.type === 'done') {
          setRunStatus(ev.status ?? 'idle');
        }
      } catch {
        // ignore malformed heartbeat/comment
      }
    };

    const activeApproval = pendingApprovals[0] ?? null;

  return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  const trigger = useMemo(
    () => detectAutocompleteTrigger(promptText, cursorPos),
    [promptText, cursorPos],
  );

  const modelOptions = useMemo(
    () => buildDockModelOptions(localAgents, providerModels),
    [localAgents, providerModels],
  );

  const [swarmProfile, setSwarmProfile] = useState<SwarmRoleAssignment[]>(() =>
    loadProjectSwarmProfile(activeFloorId, modelOptions),
  );

  useEffect(() => {
    setSwarmProfile(loadProjectSwarmProfile(activeFloorId, modelOptions));
  }, [activeFloorId, modelOptions]);

  useEffect(() => {
    if (modelOptions.length === 0) {
      if (model !== '') setModel('');
      return;
    }
    if (!modelOptions.some((opt) => opt.id === model)) {
      setModel(modelOptions[0].id);
    }
  }, [modelOptions, model]);

  const acItems = useMemo(() => {
    if (!trigger) return [];
    if (trigger.kind === '@') {
      return filterMentionSuggestions(trigger.query, employees, localAgents).map((item) => ({
        key: item.id,
        insert: `${item.label} `,
        title: item.label,
        meta: item.badge,
      }));
    }
    return filterSlashSuggestions(trigger.query).map((item) => ({
      key: item.command,
      insert: `${item.command} `,
      title: item.command,
      meta: item.description,
    }));
  }, [trigger, employees, localAgents]);

  useEffect(() => {
    setSelectedAcIndex(0);
  }, [trigger?.kind, trigger?.query]);

  const applyAutocomplete = (insertText: string) => {
    if (!trigger) return;
    const before = promptText.slice(0, trigger.startIndex);
    const after = promptText.slice(cursorPos);
    const nextText = `${before}${insertText}${after}`;
    const nextCursor = before.length + insertText.length;
    setPromptText(nextText);
    setCursorPos(nextCursor);
    if (trigger.kind === '@') {
      playMentionChime();
    } else {
      playSelectBlip();
    }
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleSubmit = async (explicitOrchestration?: 'single' | 'swarm') => {
    const trimmed = promptText.trim();
    if (!trimmed) return;

    if (trimmed === '/clear') {
      playSelectBlip();
      setLogs([]);
      setDiffs([]);
      setPromptText('');
      setNotice(null);
      return;
    }

    const orchestration = resolveOrchestration(trimmed, explicitOrchestration);
    playMentionChime();
    setDrawerOpen(true);
    setNotice(null);
    setRunStatus('running');
    appendLog('status', `> [${orchestration.toUpperCase()}] ${trimmed}`);

    const mentions = extractMentions(trimmed);
    const storedCustomBaseUrl = loadStoredCustomBaseUrl();
    const { provider, customBaseUrl, localBaseUrl, ollamaBaseUrl } = resolvePromptProvider(
      model,
      localAgents,
      storedCustomBaseUrl,
    );
    const effectiveCustomBaseUrl = customBaseUrl || storedCustomBaseUrl || undefined;
    const localBaseUrls: Record<string, string> = {};
    if (orchestration === 'swarm') {
      for (const agent of localAgents) {
        if (!agent.enabled || !agent.baseUrl) continue;
        localBaseUrls[`${agent.provider}:${agent.model}`] = agent.baseUrl;
        localBaseUrls[agent.model] = agent.baseUrl;
      }
    }
    setPromptText('');

    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          model,
          mode,
          orchestration,
          swarmProfile: orchestration === 'swarm' ? swarmProfile : undefined,
          mentions,
          provider,
          customBaseUrl: effectiveCustomBaseUrl,
          localBaseUrl,
          localBaseUrls: Object.keys(localBaseUrls).length > 0 ? localBaseUrls : undefined,
          ollamaBaseUrl,
          workspace,
          attachments,
          floorId: activeFloorId ?? undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setRunStatus('error');
        appendLog('error', errBody.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      setRunStatus('error');
      appendLog('error', err instanceof Error ? err.message : 'Request failed');
    }
  };

  const handleStop = async () => {
    playSelectBlip();
    try {
      await fetch('/api/prompt/stop', { method: 'POST' });
      setRunStatus('stopped');
      appendLog('status', '[STOPPED]');
    } catch {
      // ignore
    }
  };

  const handleDiffDecision = async (filePath: string, decision: 'accept' | 'reject') => {
    playSelectBlip();
    try {
      const res = await fetch('/api/diff/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, decision }),
      });
      if (res.ok) {
        setDiffs((prev) =>
          prev.map((d) =>
            d.path === filePath
              ? { ...d, status: decision === 'accept' ? 'accepted' : 'rejected' }
              : d,
          ),
        );
      }
    } catch {
      // ignore
    }
  };

  const handleApprovalDecision = async (approvalId: string, decision: ApprovalDecision) => {
    playSelectBlip();
    setSubmittingApprovalId(approvalId);
    try {
      const res = await fetch('/api/prompt/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, decision }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        appendLog('error', errBody.error || `Approval failed (HTTP ${res.status})`);
        setSubmittingApprovalId(null);
      }
    } catch (err) {
      appendLog('error', err instanceof Error ? err.message : 'Approval request failed');
      setSubmittingApprovalId(null);
    }
  };

  const handleToggleVoice = () => {
    playSelectBlip();
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Ctor) {
      setNotice(t.dock.micUnsupported);
      setDrawerOpen(true);
      appendLog('error', t.dock.micUnsupported);
      return;
    }
    const rec = new Ctor();
    rec.lang = locale === 'tr' ? 'tr-TR' : 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setPromptText((prev) => (prev ? `${prev.trimEnd()} ${transcript}` : transcript));
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setNotice(t.dock.micListening);
    setListening(true);
    rec.start();
  };

  const addAttachment = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setAttachments((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setAttachDraft('');
    setShowAttachInput(false);
    playSelectBlip();
  };

  const statusLedClass =
    runStatus === 'running'
      ? 'green pulse'
      : runStatus === 'error'
        ? 'amber'
        : 'dim';

  const statusLabel =
    runStatus === 'running'
      ? t.dock.statusRunning
      : runStatus === 'error'
        ? t.dock.statusError
        : runStatus === 'stopped'
          ? t.dock.statusStopped
          : t.dock.statusIdle;

  const activeApproval = pendingApprovals[0] ?? null;

  return (
    <section
      className={`retro-dock-wrap${minimized ? ' minimized' : ''}`}
      aria-label={t.dock.title}
    >
      <div className="retro-dock-inner">
        {!minimized && drawerOpen && (
        <div className="retro-dock-drawer">
          <div className="retro-dock-drawer-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`led-dot ${statusLedClass}`} />
              <span
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 8,
                  color: 'var(--accent-cyan)',
                }}
              >
                {statusLabel}
              </span>
              {notice && (
                <span style={{ fontSize: 10, color: 'var(--accent-amber)' }}>
                  {notice}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="pixel-btn"
                style={{ fontSize: 8, padding: '2px 6px' }}
                onClick={() => {
                  playSelectBlip();
                  setLogs([]);
                  setDiffs([]);
                }}
              >
                {t.dock.clearLogs}
              </button>
              <button
                type="button"
                className="pixel-btn"
                style={{ fontSize: 8, padding: '2px 6px' }}
                onClick={() => {
                  playSelectBlip();
                  setDrawerOpen(false);
                }}
              >
                {t.dock.drawerHide}
              </button>
            </div>
          </div>

          <div className="retro-dock-logs">
            {logs.length === 0 ? (
              <span style={{ color: 'var(--text-dim)' }}>{t.dock.noLogs}</span>
            ) : (
              logs.map((line) => (
                <div key={line.id} className={`retro-dock-log-line ${line.kind}`}>
                  {line.text}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          {activeApproval && (
            <div className="retro-dock-approval-card" role="alertdialog" aria-label={t.dock.approvalTitle}>
              <div className="retro-dock-approval-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#ffd147' }}>
                    {t.dock.approvalTitle}
                  </span>
                  <span className="pixel-badge" style={{ fontSize: 9, color: '#3be87a' }}>
                    {activeApproval.role}
                  </span>
                  <span className="pixel-badge" style={{ fontSize: 9, color: '#7ee7ff' }}>
                    {activeApproval.toolName}
                  </span>
                </div>
                {pendingApprovals.length > 1 && (
                  <span className="pixel-badge" style={{ fontSize: 8, color: '#ffd147' }}>
                    {t.dock.approvalPendingCount.replace('{n}', String(pendingApprovals.length - 1))}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#eef4ff' }}>{activeApproval.summary}</div>
              {activeApproval.diffPreview && (
                <pre className="retro-dock-approval-diff">{activeApproval.diffPreview}</pre>
              )}
              <div className="retro-dock-approval-actions">
                <button
                  type="button"
                  className="pixel-btn active"
                  style={{ fontSize: 9, padding: '4px 10px' }}
                  disabled={submittingApprovalId === activeApproval.approvalId}
                  onClick={() => void handleApprovalDecision(activeApproval.approvalId, 'allow_once')}
                >
                  {t.dock.approvalAllowOnce}
                </button>
                <button
                  type="button"
                  className="pixel-btn cyan"
                  style={{ fontSize: 9, padding: '4px 10px' }}
                  disabled={submittingApprovalId === activeApproval.approvalId}
                  onClick={() => void handleApprovalDecision(activeApproval.approvalId, 'allow_session')}
                >
                  {t.dock.approvalAllowSession}
                </button>
                <button
                  type="button"
                  className="pixel-btn danger"
                  style={{ fontSize: 9, padding: '4px 10px' }}
                  disabled={submittingApprovalId === activeApproval.approvalId}
                  onClick={() => void handleApprovalDecision(activeApproval.approvalId, 'deny')}
                >
                  {t.dock.approvalDeny}
                </button>
              </div>
            </div>
          )}

          {diffs.length > 0 && (
            <div className="retro-dock-diffs">
              <div
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 8,
                  color: 'var(--accent-amber)',
                }}
              >
                {t.dock.diffsTitle} ({diffs.length})
              </div>
              {diffs.map((diff) => (
                <div key={diff.path} className="retro-dock-diff-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {diff.path}
                    </span>
                    <span style={{ color: 'var(--accent-green)' }}>+{diff.added}</span>
                    <span style={{ color: 'var(--accent-red)' }}>-{diff.removed}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {diff.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          className="pixel-btn cyan"
                          style={{ fontSize: 8, padding: '2px 6px' }}
                          onClick={() => handleDiffDecision(diff.path, 'accept')}
                        >
                          {t.dock.accept}
                        </button>
                        <button
                          type="button"
                          className="pixel-btn danger"
                          style={{ fontSize: 8, padding: '2px 6px' }}
                          onClick={() => handleDiffDecision(diff.path, 'reject')}
                        >
                          {t.dock.reject}
                        </button>
                      </>
                    ) : (
                      <span
                        className="pixel-badge"
                        style={{
                          fontSize: 8,
                          color:
                            diff.status === 'accepted'
                              ? 'var(--accent-green)'
                              : 'var(--accent-red)',
                        }}
                      >
                        {diff.status === 'accepted' ? t.dock.accepted : t.dock.rejected}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="retro-dock-panel">
        <div className="retro-dock-header">
          <div className="retro-dock-title">
            <span className={`led-dot ${statusLedClass}`} />
            <span>{t.dock.title}</span>
            <span className="pixel-badge" style={{ fontSize: 8 }}>
              {statusLabel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!minimized && (
              <button
                type="button"
                className={`pixel-btn${drawerOpen ? ' cyan' : ''}`}
                style={{ fontSize: 8, padding: '3px 8px' }}
                onClick={() => {
                  playSelectBlip();
                  setDrawerOpen((prev) => !prev);
                }}
              >
                {drawerOpen ? t.dock.drawerHide : t.dock.drawerShow}
                {diffs.length > 0 ? ` (${diffs.length})` : ''}
              </button>
            )}
            <button
              type="button"
              className="pixel-btn"
              style={{ fontSize: 8, padding: '3px 8px' }}
              onClick={() => {
                playSelectBlip();
                setMinimized((prev) => !prev);
              }}
            >
              {minimized ? t.dock.expand : t.dock.minimize}
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            {attachments.length > 0 && (
              <div className="retro-dock-chips">
                {attachments.map((att) => (
                  <span key={att} className="retro-dock-chip">
                    <span>📎 {att}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${att}`}
                      onClick={() => {
                        playSelectBlip();
                        setAttachments((prev) => prev.filter((item) => item !== att));
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {showAttachInput && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="text"
                  value={attachDraft}
                  onChange={(e) => setAttachDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAttachment(attachDraft);
                    } else if (e.key === 'Escape') {
                      setShowAttachInput(false);
                    }
                  }}
                  placeholder={t.dock.attachPrompt}
                  className="retro-dock-select"
                  style={{ flex: 1, maxWidth: 'none', cursor: 'text' }}
                  autoFocus
                />
                <button
                  type="button"
                  className="pixel-btn cyan"
                  style={{ fontSize: 8, padding: '5px 8px' }}
                  onClick={() => addAttachment(attachDraft)}
                >
                  {t.dock.attach}
                </button>
                <button
                  type="button"
                  className="pixel-btn"
                  style={{ fontSize: 8, padding: '5px 8px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  📁
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    for (const f of files) {
                      addAttachment(f.name);
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            )}

            <div className="retro-dock-input-box">
              {trigger && acItems.length > 0 && (
                <div className="retro-dock-autocomplete" role="listbox">
                  <div className="retro-dock-ac-head">
                    {trigger.kind === '@' ? t.dock.mentionsHeader : t.dock.commandsHeader}
                  </div>
                  {acItems.map((item, idx) => (
                    <button
                      key={item.key}
                      type="button"
                      role="option"
                      aria-selected={idx === selectedAcIndex}
                      className={`retro-dock-ac-item${idx === selectedAcIndex ? ' selected' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyAutocomplete(item.insert);
                      }}
                    >
                      <span>{item.title}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                        {item.meta}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                className="retro-dock-textarea"
                rows={1}
                value={promptText}
                placeholder={t.dock.placeholder}
                onChange={(e) => {
                  setPromptText(e.target.value);
                  setCursorPos(e.target.selectionStart ?? e.target.value.length);
                }}
                onClick={(e) => {
                  setCursorPos(e.currentTarget.selectionStart ?? promptText.length);
                }}
                onKeyUp={(e) => {
                  setCursorPos(e.currentTarget.selectionStart ?? promptText.length);
                }}
                onKeyDown={(e) => {
                  if (trigger && acItems.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedAcIndex((i) => (i + 1) % acItems.length);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedAcIndex((i) => (i - 1 + acItems.length) % acItems.length);
                      return;
                    }
                    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                      e.preventDefault();
                      const chosen = acItems[selectedAcIndex] ?? acItems[0];
                      if (chosen) applyAutocomplete(chosen.insert);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setCursorPos(0);
                      return;
                    }
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (runStatus !== 'running') {
                      void handleSubmit();
                    }
                  }
                }}
              />
            </div>

            <div className="retro-dock-controls">
              <div className="retro-dock-controls-group">
                <button
                  type="button"
                  className="pixel-btn"
                  style={{ fontSize: 10, padding: '4px 9px' }}
                  title={t.dock.attach}
                  onClick={() => {
                    playSelectBlip();
                    setShowAttachInput((prev) => !prev);
                  }}
                >
                  +
                </button>

                <select
                  aria-label="Model"
                  className="retro-dock-select"
                  value={model}
                  onChange={(e) => {
                    playSelectBlip();
                    setModel(e.target.value as PromptModelId);
                  }}
                >
                  {modelOptions.length === 0 ? (
                    <option value="" disabled>
                      {t.dock.noModelsHint}
                    </option>
                  ) : (
                    modelOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="retro-dock-controls-group">
                <select
                  aria-label="Execution Mode"
                  className="retro-dock-select"
                  value={mode}
                  onChange={(e) => {
                    playSelectBlip();
                    setMode(e.target.value as ExecutionMode);
                  }}
                >
                  <option value="turbo">{t.dock.modeTurbo}</option>
                  <option value="safe">{t.dock.modeSafe}</option>
                  <option value="eco-swarm">{t.dock.modeEco}</option>
                </select>

                <button
                  type="button"
                  className={`pixel-btn${listening ? ' gold' : ''}`}
                  style={{ fontSize: 10, padding: '4px 9px' }}
                  title={t.dock.micTitle}
                  onClick={handleToggleVoice}
                >
                  🎤
                </button>

                {runStatus === 'running' ? (
                  <button
                    type="button"
                    className="pixel-btn danger"
                    style={{ fontSize: 9, padding: '5px 12px' }}
                    onClick={() => void handleStop()}
                  >
                    ■ {t.dock.stop}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="pixel-btn"
                      style={{ fontSize: 9, padding: '5px 10px' }}
                      title={t.dock.enterSingleTitle}
                      onClick={() => void handleSubmit('single')}
                    >
                      {t.dock.enterSingle}
                    </button>
                    <div className="retro-dock-split">
                      <button
                        type="button"
                        className="pixel-btn cyan"
                        style={{ fontSize: 9, padding: '5px 10px' }}
                        title={t.dock.runSwarmTitle}
                        onClick={() => void handleSubmit('swarm')}
                      >
                        ▶ {t.dock.send}
                      </button>
                      <button
                        type="button"
                        className={`pixel-btn cyan${swarmConfigOpen ? ' active' : ''}`}
                        style={{ fontSize: 10, padding: '5px 8px' }}
                        title={t.dock.swarmConfigTitle}
                        aria-label={t.dock.swarmConfigTitle}
                        onClick={() => {
                          playSelectBlip();
                          setSwarmConfigOpen((prev) => !prev);
                        }}
                      >
                        ⚙
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {swarmConfigOpen && (
              <div className="retro-dock-swarm-popover">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#ffd147' }}>
                    {t.dock.swarmConfigTitle}
                  </span>
                  <button
                    type="button"
                    className="pixel-btn"
                    style={{ fontSize: 8, padding: '2px 6px' }}
                    onClick={() => {
                      playSelectBlip();
                      setSwarmConfigOpen(false);
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.dock.swarmConfigHint}</div>
                <div className="retro-dock-swarm-grid" style={{ fontSize: 9, color: 'var(--accent-cyan)', fontFamily: 'var(--font-pixel)' }}>
                  <span>{t.dock.swarmRoleHeader}</span>
                  <span>{t.dock.swarmModelHeader}</span>
                  <span>{t.dock.swarmLevelHeader}</span>
                  <span />
                </div>
                {swarmProfile.map((entry) => (
                  <div key={entry.role} className="retro-dock-swarm-grid">
                    <span style={{ fontSize: 11, color: '#3be87a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.role}
                    </span>
                    <select
                      aria-label={`${entry.role} model`}
                      className="retro-dock-select"
                      style={{ maxWidth: 'none', width: '100%' }}
                      value={entry.model}
                      onChange={(e) => {
                        playSelectBlip();
                        const next = swarmProfile.map((r) =>
                          r.role === entry.role ? { ...r, model: e.target.value } : r,
                        );
                        setSwarmProfile(next);
                        saveProjectSwarmProfile(activeFloorId, next);
                      }}
                    >
                      {modelOptions.length === 0 ? (
                        <option value="">{t.dock.noModelsHint}</option>
                      ) : (
                        modelOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))
                      )}
                    </select>
                    <select
                      aria-label={`${entry.role} level`}
                      className="retro-dock-select"
                      value={entry.level}
                      onChange={(e) => {
                        playSelectBlip();
                        const next = swarmProfile.map((r) =>
                          r.role === entry.role
                            ? { ...r, level: e.target.value as ThinkingLevel }
                            : r,
                        );
                        setSwarmProfile(next);
                        saveProjectSwarmProfile(activeFloorId, next);
                      }}
                    >
                      <option value="low">{t.dock.levelLow}</option>
                      <option value="medium">{t.dock.levelMedium}</option>
                      <option value="high">{t.dock.levelHigh}</option>
                    </select>
                    <button
                      type="button"
                      className="pixel-btn danger"
                      style={{ fontSize: 8, padding: '3px 5px' }}
                      disabled={swarmProfile.length <= 1}
                      onClick={() => {
                        playSelectBlip();
                        const next = swarmProfile.filter((r) => r.role !== entry.role);
                        setSwarmProfile(next);
                        saveProjectSwarmProfile(activeFloorId, next);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border-dark)', paddingTop: 6 }}>
                  {(['Coder Fast', 'Researcher', 'Docs'] as const).map((presetRole) => (
                    <button
                      key={presetRole}
                      type="button"
                      className="pixel-btn"
                      style={{ fontSize: 8, padding: '3px 6px' }}
                      disabled={swarmProfile.some(
                        (r) => r.role.toLowerCase() === presetRole.toLowerCase(),
                      )}
                      onClick={() => {
                        playSelectBlip();
                        const next: SwarmRoleAssignment[] = [
                          ...swarmProfile,
                          { role: presetRole, model: modelOptions[0]?.id ?? '', level: 'medium' },
                        ];
                        setSwarmProfile(next);
                        saveProjectSwarmProfile(activeFloorId, next);
                      }}
                    >
                      + {presetRole}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={newRoleDraft}
                    onChange={(e) => setNewRoleDraft(e.target.value)}
                    placeholder={t.dock.addRolePlaceholder}
                    className="retro-dock-select"
                    style={{ flex: 1, minWidth: 130, maxWidth: 'none', cursor: 'text' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const clean = newRoleDraft.trim();
                        if (!clean || swarmProfile.some((r) => r.role.toLowerCase() === clean.toLowerCase())) return;
                        playSelectBlip();
                        const next: SwarmRoleAssignment[] = [
                          ...swarmProfile,
                          { role: clean, model: modelOptions[0]?.id ?? '', level: 'medium' },
                        ];
                        setSwarmProfile(next);
                        saveProjectSwarmProfile(activeFloorId, next);
                        setNewRoleDraft('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="pixel-btn active"
                    style={{ fontSize: 8, padding: '4px 8px' }}
                    disabled={
                      !newRoleDraft.trim() ||
                      swarmProfile.some(
                        (r) => r.role.toLowerCase() === newRoleDraft.trim().toLowerCase(),
                      )
                    }
                    onClick={() => {
                      const clean = newRoleDraft.trim();
                      if (!clean) return;
                      playSelectBlip();
                      const next: SwarmRoleAssignment[] = [
                        ...swarmProfile,
                        { role: clean, model: modelOptions[0]?.id ?? '', level: 'medium' },
                      ];
                      setSwarmProfile(next);
                      saveProjectSwarmProfile(activeFloorId, next);
                      setNewRoleDraft('');
                    }}
                  >
                    {t.dock.addRoleBtn}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </section>
  );
};
