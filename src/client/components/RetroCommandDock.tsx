import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  DiffFileChange,
  ExecutionMode,
  LocalAgentConfig,
  OfficeEmployee,
  PromptModelId,
  PromptStreamEvent,
} from '../../shared/types';
import { playMentionChime, playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

export interface DockModelOption {
  id: PromptModelId;
  label: string;
  provider?: 'gemini' | 'ollama';
  ollamaBaseUrl?: string;
}

export const GEMINI_MODEL_OPTIONS: DockModelOption[] = [
  { id: 'gemini-4-carbon-medium', label: 'Gemini 4 Carbon (Medium)', provider: 'gemini' },
  { id: 'gemini-4-argon-medium', label: 'Gemini 4 Argon (Medium)', provider: 'gemini' },
  { id: 'gemini-4-hydrogen-medium', label: 'Gemini 4 Hydrogen (Medium)', provider: 'gemini' },
  { id: 'gemini-3.8-flash-fast', label: 'Gemini 3.8 Flash (Fast)', provider: 'gemini' },
];

export const DOCK_MODEL_OPTIONS: DockModelOption[] = [
  ...GEMINI_MODEL_OPTIONS,
  {
    id: 'qwen2.5-coder:14b',
    label: 'Local Qwen 2.5 Coder 14B (RX 7800 XT - Ollama)',
    provider: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
  },
];

export function buildDockModelOptions(localAgents: LocalAgentConfig[] = []): DockModelOption[] {
  const dynamicLocalOptions: DockModelOption[] = localAgents
    .filter((agent) => agent.enabled)
    .map((agent) => ({
      id: `ollama:${agent.model}` as PromptModelId,
      label: `🦙 ${agent.name} (${agent.model})`,
      provider: 'ollama',
      ollamaBaseUrl: agent.baseUrl,
    }));
  return [...GEMINI_MODEL_OPTIONS, ...dynamicLocalOptions];
}

export function resolvePromptProvider(
  model: PromptModelId,
  localAgents: LocalAgentConfig[] = [],
): { provider: 'gemini' | 'ollama'; ollamaBaseUrl?: string } {
  const matched = localAgents.find(
    (a) => a.enabled && (`ollama:${a.model}` === model || a.model === model),
  );
  if (matched) {
    return { provider: 'ollama', ollamaBaseUrl: matched.baseUrl };
  }
  if (model.startsWith('ollama:') || model === 'qwen2.5-coder:14b') {
    return { provider: 'ollama', ollamaBaseUrl: 'http://localhost:11434' };
  }
  return { provider: 'gemini' };
}

export const DEFAULT_DOCK_MODEL: PromptModelId = 'gemini-4-hydrogen-medium';

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

interface LogLine {
  id: string;
  kind: PromptStreamEvent['type'];
  text: string;
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
  workspace?: string;
}

export const RetroCommandDock: React.FC<RetroCommandDockProps> = ({
  activeFloorId,
  employees = [],
  localAgents = [],
  workspace,
}) => {
  const { t, locale } = useI18n();
  const [minimized, setMinimized] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedAcIndex, setSelectedAcIndex] = useState(0);
  const [model, setModel] = useState<PromptModelId>(DEFAULT_DOCK_MODEL);
  const [mode, setMode] = useState<ExecutionMode>('turbo');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showAttachInput, setShowAttachInput] = useState(false);
  const [attachDraft, setAttachDraft] = useState('');
  const [runStatus, setRunStatus] = useState<'running' | 'idle' | 'stopped' | 'error'>('idle');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [diffs, setDiffs] = useState<DiffFileChange[]>([]);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const appendLog = (kind: PromptStreamEvent['type'], text: string) => {
    if (!text) return;
    setLogs((prev) => {
      const next = [
        ...prev,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, text },
      ];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
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
        if (ev.type === 'status' && ev.text) {
          appendLog('status', `[STATUS] ${ev.text}`);
        } else if (ev.type === 'chunk' && ev.text) {
          appendLog('chunk', ev.text);
        } else if (ev.type === 'file' && ev.file) {
          appendLog('file', `[FILE] ${ev.file}`);
        } else if (ev.type === 'diff' && Array.isArray(ev.diffs)) {
          setDiffs(ev.diffs);
          setDrawerOpen(true);
        } else if (ev.type === 'error' && ev.text) {
          appendLog('error', `[ERR] ${ev.text}`);
          setDrawerOpen(true);
        } else if (ev.type === 'done') {
          setRunStatus(ev.status ?? 'idle');
          if (ev.text) appendLog('done', `[DONE] ${ev.text}`);
        }
      } catch {
        // ignore malformed heartbeat/comment
      }
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  const trigger = useMemo(
    () => detectAutocompleteTrigger(promptText, cursorPos),
    [promptText, cursorPos],
  );

  const modelOptions = useMemo(() => buildDockModelOptions(localAgents), [localAgents]);

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
    const { provider, ollamaBaseUrl } = resolvePromptProvider(model, localAgents);
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
          mentions,
          provider,
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

  if (hidden) {
    return (
      <button
        type="button"
        className="pixel-btn cyan retro-dock-reopen-btn"
        style={{ fontSize: 9, padding: '6px 12px' }}
        onClick={() => {
          playSelectBlip();
          setHidden(false);
        }}
      >
        {t.dock.openDock}
      </button>
    );
  }

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
            <button
              type="button"
              className="pixel-btn"
              style={{ fontSize: 8, padding: '3px 8px' }}
              onClick={() => {
                playSelectBlip();
                setHidden(true);
              }}
            >
              {t.dock.hideDock}
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
                  {modelOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                  {localAgents.length === 0 && (
                    <option value="" disabled>
                      {t.dock.noLocalAgentsHint}
                    </option>
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
                    <button
                      type="button"
                      className="pixel-btn cyan"
                      style={{ fontSize: 9, padding: '5px 12px' }}
                      title={t.dock.runSwarmTitle}
                      onClick={() => void handleSubmit('swarm')}
                    >
                      ▶ {t.dock.send}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </section>
  );
};
