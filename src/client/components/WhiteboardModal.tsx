import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  AgentResourceUsage,
  FloorEventKind,
  OfficeEmployee,
  SwarmBoardMessage,
  SwarmMentionEdge,
  SwarmTaskNode,
  SwarmTaskStatus,
} from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { drawEmployeePortrait, UNIFORM_COLORS } from '../engine/pixelSprites';
import { useI18n } from '../i18n/translations';
import { WorkflowDiagramSvg } from './WorkflowDiagramSvg';

interface WhiteboardModalProps {
  companyName: string;
  swarmTitle?: string;
  messages: SwarmBoardMessage[];
  swarmEdges?: SwarmMentionEdge[];
  taskNodes?: SwarmTaskNode[];
  employees?: OfficeEmployee[];
  recentlyLeftEmployees?: OfficeEmployee[];
  agentResources?: AgentResourceUsage[];
  activeEventKind?: FloorEventKind | null;
  initialTab?: 'feed' | 'personnel' | 'workflow' | 'tasks' | 'gantt';
  onSelectEmployee?: (employee: OfficeEmployee) => void;
  onClose: () => void;
}

function formatCompactTokens(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return String(val);
}

const EmployeePortraitCanvas = React.memo<{
  employee: OfficeEmployee;
  activeEventKind?: FloorEventKind | null;
  size?: number;
}>(
  ({ employee, activeEventKind, size = 64 }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawEmployeePortrait(ctx, employee, size, activeEventKind ?? null);
    }, [employee, activeEventKind, size]);

    return (
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          imageRendering: 'pixelated',
          background: '#111625',
          border: '2px solid #2b3554',
          flexShrink: 0,
        }}
      />
    );
  },
  (prev, next) =>
    prev.size === next.size &&
    prev.activeEventKind === next.activeEventKind &&
    prev.employee.id === next.employee.id &&
    prev.employee.name === next.employee.name &&
    prev.employee.gender === next.employee.gender &&
    prev.employee.isCoordinator === next.employee.isCoordinator &&
    prev.employee.modelFamily === next.employee.modelFamily &&
    prev.employee.swarmRole === next.employee.swarmRole &&
    prev.employee.activity === next.employee.activity &&
    prev.employee.status === next.employee.status,
);

type WorkPhase = 'coding' | 'analysis' | 'testing' | 'coord' | 'break';

const PHASE_STYLES: Record<WorkPhase, { color: string; bg: string; border: string; icon: string }> = {
  coding: { color: '#00e5ff', bg: 'rgba(0, 229, 255, 0.16)', border: '#0097a7', icon: '💻' },
  analysis: { color: '#b388ff', bg: 'rgba(179, 136, 255, 0.16)', border: '#6c49b8', icon: '🔍' },
  testing: { color: '#00e676', bg: 'rgba(0, 230, 118, 0.16)', border: '#1b8a4b', icon: '🧪' },
  coord: { color: '#ffd54f', bg: 'rgba(255, 213, 79, 0.16)', border: '#9c7818', icon: '📊' },
  break: { color: '#78909c', bg: 'rgba(120, 144, 156, 0.16)', border: '#4b5d66', icon: '☕' },
};

function classifyWorkPhase(text: string, emp?: OfficeEmployee, agentName?: string): WorkPhase {
  const lower = text.toLowerCase();
  const actor = (agentName || emp?.name || '').toLowerCase();

  if (
    emp &&
    (emp.activity === 'coffee' ||
      emp.activity === 'gaming' ||
      emp.activity === 'lounging' ||
      emp.activity === 'sleeping' ||
      emp.activity === 'watercooler')
  ) {
    return 'break';
  }

  // 1. Agent role / identity priority
  if (actor === 'coordinator' || actor === 'boss' || actor === 'chief-architect' || emp?.isCoordinator) {
    return 'coord';
  }
  if (
    actor === 'analyst-grill' ||
    actor === 'expert-architect' ||
    /(keşif raporu|discovery report|grill|audit)/i.test(lower)
  ) {
    return 'analysis';
  }
  if (actor === 'verifier-qa') {
    return 'testing';
  }
  if (actor === 'coder-core' || actor === 'coder-ui' || actor === 'character-designer') {
    return 'coding';
  }

  // 2. Fallback keyword classification for generic agents
  if (/(test|pass|exit 0|typecheck|verify|doğrula|screenshot|preview)/i.test(lower)) {
    return 'testing';
  }
  if (/(analiz|analy|inspect|investigat|keşif|read|review|check|incele)/i.test(lower)) {
    return 'analysis';
  }
  if (/(plan|wave|assign|görev|brief|present|sunum|stage|commit|push)/i.test(lower)) {
    return 'coord';
  }
  if (
    /(edit|implement|build|fix|add|ekle|kod|refactor|modal|sprite|canvas|ts|tsx|css)/i.test(lower) ||
    emp?.status === 'working'
  ) {
    return 'coding';
  }
  return emp?.status === 'waiting' || emp?.status === 'idle' ? 'break' : 'coding';
}

function summarizeSnippet(text: string, maxLen = 72): string {
  const cleaned = text.replace(/@[a-zA-Z0-9_-]+/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '...';
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned;
}

function formatDateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimeHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

function parseBoardTimestamp(
  rawTime: string,
  fallbackIndex = 0,
): { dateKey: string; timeLabel: string; epochMs: number } {
  const trimmed = (rawTime || '').trim();

  // Local "YYYY-MM-DD HH:MM(:SS)"
  const localMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (localMatch) {
    const [, datePart, hhmm, ss] = localMatch;
    const parsed = new Date(`${datePart}T${hhmm}:${ss ?? '00'}`);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        dateKey: datePart,
        timeLabel: hhmm,
        epochMs: parsed.getTime(),
      };
    }
  }

  // ISO timestamp e.g. "2026-11-13T23:28:37.608824600Z"
  if (trimmed.includes('T')) {
    // Trim sub-millisecond fractional digits if >3 digits for strict JS engines
    const normalized = trimmed.replace(/(\.\d{3})\d+(Z|[+-]\d{2}:\d{2})?$/, '$1$2');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        dateKey: formatDateKeyLocal(parsed),
        timeLabel: formatTimeHHMM(parsed),
        epochMs: parsed.getTime(),
      };
    }
  }

  // Short "HH:MM(:SS)" fallback (e.g. Demo mode)
  const today = new Date();
  const shortMatch = trimmed.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (shortMatch) {
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      Number(shortMatch[1]),
      Number(shortMatch[2]),
      Number(shortMatch[3] ?? '0'),
    );
    return {
      dateKey: formatDateKeyLocal(d),
      timeLabel: `${shortMatch[1]}:${shortMatch[2]}`,
      epochMs: d.getTime(),
    };
  }

  const fallbackDate = new Date(today.getTime() + fallbackIndex * 60_000);
  return {
    dateKey: formatDateKeyLocal(fallbackDate),
    timeLabel: formatTimeHHMM(fallbackDate),
    epochMs: fallbackDate.getTime(),
  };
}

function renderMessageText(text: string): React.ReactNode {
  const parts = text.split(/(@[a-zA-Z0-9_-]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span key={idx} className="mention-chip">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function deriveEdgesFromMessages(messages: SwarmBoardMessage[]): SwarmMentionEdge[] {
  const map = new Map<string, SwarmMentionEdge>();
  for (const msg of messages) {
    const mentions = msg.mentions?.length
      ? msg.mentions
      : Array.from(new Set((msg.text.match(/@([a-zA-Z0-9_-]+)/g) ?? []).map((m) => m.slice(1))));
    for (const target of mentions) {
      if (!target || target === msg.agent) continue;
      const key = `${msg.agent}->${target}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (msg.seq >= existing.lastSeq) {
          existing.lastSeq = msg.seq;
          existing.lastTime = msg.time;
        }
      } else {
        map.set(key, {
          from: msg.agent,
          to: target,
          count: 1,
          lastSeq: msg.seq,
          lastTime: msg.time,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count || b.lastSeq - a.lastSeq);
}

function getMaxSeq(messages: SwarmBoardMessage[]): number {
  let max = 0;
  for (const m of messages) {
    if (m.seq > max) max = m.seq;
  }
  return max;
}

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({
  companyName,
  swarmTitle,
  messages,
  swarmEdges,
  taskNodes = [],
  employees: activeEmployees = [],
  recentlyLeftEmployees = [],
  agentResources = [],
  activeEventKind = null,
  initialTab = 'feed',
  onSelectEmployee,
  onClose,
}) => {
  const { t, locale } = useI18n();
  const normalizedInitialTab: 'feed' | 'personnel' | 'workflow' =
    initialTab === 'tasks' || initialTab === 'gantt' ? 'workflow' : initialTab;
  const [activeTab, setActiveTab] = useState<'feed' | 'personnel' | 'workflow'>(normalizedInitialTab);
  const [selectedGanttBlock, setSelectedGanttBlock] = useState<{
    agentName: string;
    phase: WorkPhase;
    time: string;
    detail: string;
  } | null>(null);
  const [ganttTopToBottom, setGanttTopToBottom] = useState(false);
  const [highlightedLink, setHighlightedLink] = useState<{ from: string; to: string } | null>(null);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string | null>(null);
  const [topologyCollapsed, setTopologyCollapsed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined'
        ? window.localStorage.getItem('swarm_plaza_topology_collapsed') === 'true'
        : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('swarm_plaza_topology_collapsed', String(topologyCollapsed));
      }
    } catch {
      // ignore storage errors
    }
  }, [topologyCollapsed]);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimerRef = useRef<number | null>(null);
  const [isLiveFollow, setIsLiveFollow] = useState(true);
  const isLiveFollowRef = useRef(true);
  const initialMaxSeqRef = useRef<number>(getMaxSeq(messages));
  const pausedMaxSeqRef = useRef<number>(getMaxSeq(messages));

  useEffect(() => {
    isLiveFollowRef.current = isLiveFollow;
  }, [isLiveFollow]);

  useEffect(() => {
    const maxSeq = getMaxSeq(messages);
    initialMaxSeqRef.current = maxSeq;
    pausedMaxSeqRef.current = maxSeq;
    isLiveFollowRef.current = true;
    setIsLiveFollow(true);
    // Reset only when switching floors/companies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  const scrollToLatest = useCallback((smooth = false) => {
    const el = feedRef.current;
    if (!el) return;

    if (scrollTimerRef.current !== null) {
      window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }

    isProgrammaticScrollRef.current = true;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }

    requestAnimationFrame(() => {
      if (!smooth && feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
      scrollTimerRef.current = window.setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        scrollTimerRef.current = null;
      }, smooth ? 650 : 80);
    });
  }, []);

  useLayoutEffect(() => {
    if (activeTab === 'feed' && isLiveFollow) {
      scrollToLatest(false);
    }
  }, [activeTab, isLiveFollow, messages, scrollToLatest]);

  const handleFeedScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (isProgrammaticScrollRef.current) {
      if (dist <= 20) {
        isProgrammaticScrollRef.current = false;
        if (scrollTimerRef.current !== null) {
          window.clearTimeout(scrollTimerRef.current);
          scrollTimerRef.current = null;
        }
      }
      return;
    }
    if (dist > 48 && isLiveFollowRef.current) {
      pausedMaxSeqRef.current = getMaxSeq(messages);
      isLiveFollowRef.current = false;
      setIsLiveFollow(false);
    } else if (dist <= 20 && !isLiveFollowRef.current) {
      isLiveFollowRef.current = true;
      setIsLiveFollow(true);
    }
  }, [messages]);

  const handleJumpToLive = useCallback(() => {
    playSelectBlip();
    setActiveTab('feed');
    isLiveFollowRef.current = true;
    setIsLiveFollow(true);
    requestAnimationFrame(() => {
      scrollToLatest(true);
    });
  }, [scrollToLatest]);

  const unreadCount = useMemo(() => {
    if (isLiveFollow) return 0;
    let count = 0;
    for (const msg of messages) {
      if (msg.seq > pausedMaxSeqRef.current) count += 1;
    }
    return count;
  }, [isLiveFollow, messages]);

  const employees = useMemo(() => {
    const activeIds = new Set(activeEmployees.map((e) => e.id));
    return [...activeEmployees, ...recentlyLeftEmployees.filter((e) => !activeIds.has(e.id))];
  }, [activeEmployees, recentlyLeftEmployees]);

  const validSceneAgents = useMemo(() => {
    if (!employees || employees.length === 0) return null;
    const set = new Set<string>(['coordinator', 'all']);
    for (const emp of employees) {
      if (emp.name) set.add(emp.name.toLowerCase());
      if (emp.isCoordinator) set.add('coordinator');
    }
    return set;
  }, [employees]);

  const edges = useMemo(() => {
    const raw =
      swarmEdges && swarmEdges.length > 0
        ? [...swarmEdges]
        : deriveEdgesFromMessages(messages);
    const filtered = validSceneAgents
      ? raw.filter(
          (e) =>
            e.from.toLowerCase() !== e.to.toLowerCase() &&
            validSceneAgents.has(e.from.toLowerCase()) &&
            validSceneAgents.has(e.to.toLowerCase()),
        )
      : raw.filter((e) => e.from.toLowerCase() !== e.to.toLowerCase());
    return filtered.sort((a, b) => b.count - a.count || b.lastSeq - a.lastSeq);
  }, [swarmEdges, messages, validSceneAgents]);

  const filteredTaskNodes = useMemo(() => {
    if (!validSceneAgents) return taskNodes;
    return taskNodes.map((node) => ({
      ...node,
      handoffTargetNames: node.handoffTargetNames.filter(
        (target) =>
          target.toLowerCase() !== node.ownerName.toLowerCase() &&
          validSceneAgents.has(target.toLowerCase()),
      ),
    }));
  }, [taskNodes, validSceneAgents]);

  const graphNodes = useMemo(() => {
    const names = new Set<string>();
    for (const e of edges) {
      names.add(e.from);
      names.add(e.to);
    }
    const list = Array.from(names);
    const cx = 320;
    const cy = 140;
    const rx = list.length > 7 ? 245 : 225;
    const ry = list.length > 7 ? 105 : 96;
    return list.map((name, idx) => {
      const angle = (idx / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
      const radialScale = list.length >= 8 && idx % 2 === 1 ? 0.86 : 1;
      return {
        name,
        x: list.length === 1 ? cx : Math.round(cx + Math.cos(angle) * rx * radialScale),
        y: list.length === 1 ? cy : Math.round(cy + Math.sin(angle) * ry * radialScale),
      };
    });
  }, [edges]);

  const nodePosMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of graphNodes) m.set(n.name, { x: n.x, y: n.y });
    return m;
  }, [graphNodes]);

  return (
    <div className="pixel-modal-backdrop" onClick={onClose}>
      <div
        className="pixel-panel pixel-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 14, gap: 10 }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            borderBottom: '2px solid #0a0c14',
            paddingBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="pixel-title" style={{ fontSize: 11, color: '#ffd147' }}>
              {t.whiteboardModal.title}
            </span>
            <span className="pixel-badge" style={{ color: '#3cd8ff' }}>
              {companyName}
            </span>
            {swarmTitle && (
              <span className="pixel-badge" style={{ color: '#e2d1ff' }}>
                {swarmTitle}
              </span>
            )}
            <button
              type="button"
              className="pixel-badge"
              onClick={handleJumpToLive}
              style={{
                color: '#3be87a',
                cursor: 'pointer',
                border: '1px solid #2b6b45',
                background: '#14231d',
                fontFamily: 'inherit',
              }}
            >
              ● {messages.length} {t.whiteboardModal.messagesCount}
            </button>
            <span className="pixel-badge" style={{ color: '#b07cff' }}>
              ⇄ {edges.length} {t.whiteboardModal.edgesCount}
            </span>
          </div>

          <button
            type="button"
            className="pixel-btn danger"
            onClick={() => {
              playSelectBlip();
              onClose();
            }}
          >
            {t.whiteboardModal.close}
          </button>
        </div>

        {/* Tabs */}
        <div className="pixel-tabs">
          <button
            type="button"
            className={`pixel-tab ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => {
              playSelectBlip();
              setActiveTab('feed');
            }}
          >
            {t.whiteboardModal.tabFeed} ({messages.length})
          </button>
          <button
            type="button"
            className={`pixel-tab ${activeTab === 'personnel' ? 'active' : ''}`}
            onClick={() => {
              playSelectBlip();
              setActiveTab('personnel');
            }}
          >
            {t.whiteboardModal.personnelTab} ({activeEmployees.length})
          </button>
          <button
            type="button"
            className={`pixel-tab ${activeTab === 'workflow' ? 'active' : ''}`}
            onClick={() => {
              playSelectBlip();
              setActiveTab('workflow');
            }}
          >
            {t.whiteboardModal.workflowGanttTab} ({edges.length})
          </button>
          <button
            type="button"
            className={`pixel-btn ${isLiveFollow ? 'active' : 'primary'}`}
            onClick={handleJumpToLive}
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              padding: '4px 10px',
              color: isLiveFollow ? '#3be87a' : '#ffd147',
              borderColor: isLiveFollow ? '#3be87a' : '#ffd147',
              background: isLiveFollow ? '#13281d' : '#252116',
            }}
          >
            {isLiveFollow
              ? t.whiteboardModal.liveActive
              : `${t.whiteboardModal.jumpToLive}${
                  unreadCount > 0 ? ` (+${unreadCount} ${t.whiteboardModal.newMessagesSuffix})` : ''
                }`}
          </button>
        </div>

        {activeTab === 'feed' && (
          /* Messages Feed */
          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 280,
              maxHeight: 460,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              ref={feedRef}
              onScroll={handleFeedScroll}
              className="pixel-panel-inset"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {messages.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 20, textAlign: 'center' }}>
                  {t.whiteboardModal.empty}
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={`${msg.seq}-${msg.time}`}
                    style={{
                      padding: '8px 10px',
                      background: '#171c2b',
                      border: '1px solid #2d3654',
                      borderLeft:
                        msg.seq > initialMaxSeqRef.current ? '3px solid #3be87a' : '1px solid #2d3654',
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="pixel-badge" style={{ color: '#ffd147' }}>
                          #{msg.seq}
                        </span>
                        <span
                          className="pixel-badge"
                          style={{
                            color: msg.agent === 'coordinator' ? '#ffd147' : '#3cd8ff',
                            background: '#222940',
                          }}
                        >
                          {msg.agent === 'coordinator' ? '★ BOSS' : msg.agent}
                        </span>
                        {msg.kind && (
                          <span className="pixel-badge" style={{ color: '#9aa7c7' }}>
                            {msg.kind}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{msg.time}</span>
                    </div>
                    <div style={{ color: '#eef2fc', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {renderMessageText(msg.text)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {activeTab === 'feed' && !isLiveFollow && messages.length > 0 && (
              <button
                type="button"
                className="pixel-btn primary"
                onClick={handleJumpToLive}
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 5,
                  fontSize: 10,
                  padding: '5px 12px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.55)',
                  borderColor: '#ffd147',
                  color: '#ffd147',
                  background: '#1c2235',
                }}
              >
                {t.whiteboardModal.jumpToLive}
                {unreadCount > 0 ? ` (+${unreadCount} ${t.whiteboardModal.newMessagesSuffix})` : ''}
              </button>
            )}
          </div>
        )}

        {activeTab === 'personnel' && (
          <div
            className="pixel-panel-inset"
            style={{
              padding: 12,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              maxHeight: 480,
            }}
          >
            {(() => {
              const totalEstTokens = agentResources.reduce(
                (sum, r) => sum + r.estimatedTokens,
                0,
              );
              const totalEstCost = agentResources.reduce(
                (sum, r) => sum + r.estimatedCostUsd,
                0,
              );
              const workingCount = employees.filter((e) => e.status === 'working').length;
              return (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                      padding: '8px 10px',
                      background: '#131929',
                      border: '2px solid #2b3554',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="pixel-badge" style={{ color: '#3cd8ff' }}>
                        👥 {employees.length}
                      </span>
                      <span className="pixel-badge" style={{ color: '#3be87a' }}>
                        ⚡ {workingCount} {t.statuses.working}
                      </span>
                      <span className="pixel-badge" style={{ color: '#ffd147' }}>
                        ~{formatCompactTokens(totalEstTokens)} {t.analyticsModal.tokensUnit}
                      </span>
                      <span
                        className="pixel-badge"
                        style={{ color: '#ffd147', background: '#262113', borderColor: '#786221' }}
                      >
                        ~${totalEstCost.toFixed(4)} (~Est.)
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      {t.analyticsModal.estimatedDisclaimer}
                    </span>
                  </div>

                  {employees.length === 0 ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-dim)',
                        padding: 16,
                        textAlign: 'center',
                      }}
                    >
                      {t.whiteboardModal.noTasksYet}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {employees.map((emp) => {
                        const uniform = UNIFORM_COLORS[emp.modelFamily] || UNIFORM_COLORS.other;
                        const resource = agentResources.find(
                          (r) =>
                            r.agentId === emp.id ||
                            r.agentName.toLowerCase() === emp.name.toLowerCase(),
                        );
                        const estTokens =
                          resource?.estimatedTokens ??
                          emp.inputTokens + emp.cacheReadTokens + emp.outputTokens;
                        const estCost = resource?.estimatedCostUsd ?? 0;
                        const sharePct =
                          totalEstTokens > 0
                            ? Math.min(100, Math.round((estTokens / totalEstTokens) * 100))
                            : 0;
                        const assignedTask = filteredTaskNodes.find(
                          (n) => n.ownerName.toLowerCase() === emp.name.toLowerCase(),
                        );
                        const hpScore = emp.health?.hpScore ?? 100;
                        const successPct = emp.health?.successRatePct ?? 100;
                        const hpColor =
                          hpScore >= 70 ? '#3be87a' : hpScore >= 40 ? '#ffbe3b' : '#ff5666';
                        const statusColor =
                          emp.status === 'working'
                            ? '#3be87a'
                            : emp.status === 'error'
                              ? '#ff5666'
                              : '#ffbe3b';

                        return (
                          <div
                            key={emp.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '76px minmax(200px, 1.4fr) minmax(200px, 1fr)',
                              gap: 12,
                              padding: 10,
                              background: '#171c2b',
                              border: `2px solid ${emp.isCoordinator ? '#786221' : '#2d3654'}`,
                              alignItems: 'center',
                              opacity: emp.leftAt ? 0.6 : 1,
                            }}
                          >
                            {/* Left: Illustrated Pixel Portrait */}
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <EmployeePortraitCanvas
                                employee={emp}
                                activeEventKind={activeEventKind}
                              />
                              <span
                                className="pixel-title"
                                style={{ fontSize: 9, color: '#ffd147' }}
                              >
                                LV {emp.level}
                              </span>
                              <span
                                className="pixel-badge"
                                style={{
                                  fontSize: 9,
                                  color: statusColor,
                                  borderColor: statusColor,
                                }}
                              >
                                {t.statuses[emp.status]}
                              </span>
                              {emp.leftAt && (() => {
                                const mins = Math.max(
                                  0,
                                  Math.floor((Date.now() - (Date.parse(emp.leftAt) || Date.now())) / 60000),
                                );
                                return (
                                  <span
                                    className="pixel-badge"
                                    style={{ fontSize: 8, color: '#9aa7c7', borderColor: '#3b496b', textAlign: 'center' }}
                                  >
                                    {mins < 1
                                      ? t.whiteboardModal.offDutyJustNow
                                      : t.whiteboardModal.offDutyBadge.replace('{n}', String(mins))}
                                  </span>
                                );
                              })()}
                            </div>

                            {/* Middle: Identity, Model & Current Task */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  className="pixel-title"
                                  style={{ fontSize: 11, color: '#f4f6fc' }}
                                >
                                  {emp.name}
                                </span>
                                {emp.isCoordinator && (
                                  <span
                                    className="pixel-badge"
                                    style={{ color: '#ffd147', borderColor: '#ffd147' }}
                                  >
                                    ★ {t.rpgModal.coordinatorBadge}
                                  </span>
                                )}
                                <span className="pixel-badge" style={{ color: '#9aa7c7' }}>
                                  {emp.roleTitle}
                                </span>
                                <span className="pixel-badge" style={{ color: '#3cd8ff' }}>
                                  {t.zones[emp.zone]}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  flexWrap: 'wrap',
                                  fontSize: 11,
                                }}
                              >
                                <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                                  {t.whiteboardModal.modelLabel}:
                                </span>
                                <span
                                  className="pixel-badge"
                                  style={{
                                    background: uniform.dark,
                                    color: uniform.trim,
                                    borderColor: uniform.trim,
                                  }}
                                >
                                  {resource?.modelName ?? emp.modelId}
                                </span>
                                {emp.health?.isVerifiedOutput && (() => {
                                  const rawLabel =
                                    emp.health.verifiedLabel || t.rpgModal.verifiedBadgeLabel;
                                  const displayLabel = rawLabel.trim().startsWith('✅')
                                    ? rawLabel.trim()
                                    : `✅ ${rawLabel}`;
                                  return (
                                    <span
                                      className="pixel-badge"
                                      style={{
                                        color: '#3be87a',
                                        background: '#13281d',
                                        borderColor: '#2d7a4f',
                                      }}
                                    >
                                      {displayLabel}
                                    </span>
                                  );
                                })()}
                              </div>

                              <div style={{ fontSize: 11, color: '#dce6ff', lineHeight: 1.35 }}>
                                <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                                  {t.whiteboardModal.roleAndTask}:{' '}
                                </span>
                                <strong style={{ color: '#3cd8ff' }}>
                                  {t.activities[emp.activity]}
                                </strong>
                                {(emp.speechBubble || assignedTask?.title) && (
                                  <div
                                    style={{
                                      marginTop: 3,
                                      color: '#b8c5e3',
                                      fontSize: 11,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                    }}
                                  >
                                    {assignedTask?.title || emp.speechBubble}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right: Credit/Tokens & Health HP */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 6,
                                  fontSize: 11,
                                }}
                              >
                                <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                                  {t.whiteboardModal.creditUsageLabel}
                                </span>
                                <span
                                  className="pixel-badge"
                                  style={{
                                    color: '#ffd147',
                                    background: '#262113',
                                    borderColor: '#786221',
                                    fontWeight: 700,
                                  }}
                                >
                                  ~${estCost.toFixed(4)}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: 10,
                                  color: '#9aa7c7',
                                }}
                              >
                                <span>
                                  ~{formatCompactTokens(estTokens)} {t.analyticsModal.tokensUnit}
                                </span>
                                <span>{sharePct}%</span>
                              </div>
                              <div className="pixel-bar-track" style={{ height: 8 }}>
                                <div
                                  className="pixel-bar-fill"
                                  style={{ width: `${sharePct}%`, background: '#3cd8ff' }}
                                />
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: 10,
                                  marginTop: 2,
                                }}
                              >
                                <span style={{ color: hpColor, fontWeight: 700 }}>
                                  HP {hpScore}/100 (%{successPct})
                                </span>
                                <span style={{ color: 'var(--text-dim)' }}>
                                  {t.rpgModal.steps}: {emp.stepCount}
                                </span>
                              </div>
                              <div className="pixel-bar-track" style={{ height: 8 }}>
                                <div
                                  className="pixel-bar-fill"
                                  style={{ width: `${hpScore}%`, background: hpColor }}
                                />
                              </div>

                              {onSelectEmployee && (
                                <button
                                  type="button"
                                  className="pixel-btn cyan"
                                  style={{ fontSize: 10, padding: '4px 8px', marginTop: 2 }}
                                  onClick={() => {
                                    playSelectBlip();
                                    onSelectEmployee(emp);
                                  }}
                                >
                                  {t.whiteboardModal.inspectProfile}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {activeTab === 'workflow' && (
          <div
            className="pixel-panel-inset"
            style={{
              padding: 10,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: '72vh',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {(() => {
              const phaseLabels: Record<WorkPhase, string> = {
                coding: t.whiteboardModal.ganttLegendCoding,
                analysis: t.whiteboardModal.ganttLegendAnalysis,
                testing: t.whiteboardModal.ganttLegendTesting,
                coord: t.whiteboardModal.ganttLegendCoord,
                break: t.whiteboardModal.ganttLegendBreak,
              };
              const shortPhaseLabels: Record<WorkPhase, string> =
                locale === 'tr'
                  ? {
                      coding: '💻 Kod',
                      analysis: '🔍 Analiz',
                      testing: '🧪 Test',
                      coord: '📊 Plan',
                      break: '☕ Mola',
                    }
                  : {
                      coding: '💻 Code',
                      analysis: '🔍 Analyze',
                      testing: '🧪 Test',
                      coord: '📊 Plan',
                      break: '☕ Break',
                    };

              interface GanttColumn {
                key: string;
                name: string;
                emp?: OfficeEmployee;
              }

              interface VerticalSlot {
                id: string;
                seq: number;
                dateKey: string;
                timeLabel: string;
                agentIdx: number;
                agentName: string;
                phase: WorkPhase;
                targets: string[];
                detail: string;
              }

              const orderedMsgs = [...messages].sort((a, b) => a.seq - b.seq);
              const recentMsgs = orderedMsgs.slice(-80);

              const ganttColumns: GanttColumn[] = employees.map((emp) => ({
                key: emp.id,
                name: emp.name,
                emp,
              }));

              const findColumnIndex = (agentName: string): number => {
                const low = agentName.toLowerCase();
                return ganttColumns.findIndex(
                  (col) =>
                    col.name.toLowerCase() === low ||
                    (col.emp?.isCoordinator && low === 'coordinator'),
                );
              };

              for (const m of recentMsgs) {
                const low = m.agent.toLowerCase().trim();
                if (
                  /^task-\d+$/i.test(low) ||
                  low === 'system' ||
                  low === 'all' ||
                  /^[0-9a-f]{8}-/i.test(low)
                ) {
                  continue;
                }
                if (findColumnIndex(m.agent) < 0) {
                  ganttColumns.push({
                    key: `extra-${low}`,
                    name: m.agent,
                  });
                }
              }

              const gridCols = `74px repeat(${Math.max(1, ganttColumns.length)}, minmax(0, 1fr))`;
              const slots: VerticalSlot[] = [];

              recentMsgs.forEach((m, idx) => {
                const ts = parseBoardTimestamp(m.time, idx);
                const agentIdx = findColumnIndex(m.agent);
                if (agentIdx < 0) return;
                const col = ganttColumns[agentIdx];
                const phase = classifyWorkPhase(m.text, undefined, m.agent);
                const detail = summarizeSnippet(m.text, 110);
                const rawMentions = m.mentions?.length
                  ? m.mentions
                  : Array.from(
                      new Set((m.text.match(/@([a-zA-Z0-9_-]+)/g) ?? []).map((s) => s.slice(1))),
                    );
                const targets = rawMentions.filter(
                  (tName) => tName && tName.toLowerCase() !== m.agent.toLowerCase(),
                );
                slots.push({
                  id: `vslot-${m.seq}-${idx}`,
                  seq: m.seq,
                  dateKey: ts.dateKey,
                  timeLabel: ts.timeLabel,
                  agentIdx,
                  agentName: col.name,
                  phase,
                  targets,
                  detail,
                });
              });

              // Group slots by real dateKey (newest date block first)
              const dateMap = new Map<string, VerticalSlot[]>();
              for (const s of slots) {
                const list = dateMap.get(s.dateKey) ?? [];
                list.push(s);
                dateMap.set(s.dateKey, list);
              }
              const dateBlocks = Array.from(dateMap.entries()).sort((a, b) =>
                b[0].localeCompare(a[0]),
              );

              const latestSlot = slots[slots.length - 1];
              const activeDetail =
                selectedGanttBlock ??
                (latestSlot
                  ? {
                      agentName: latestSlot.agentName,
                      phase: latestSlot.phase,
                      time: latestSlot.timeLabel,
                      detail: latestSlot.detail,
                    }
                  : null);

              return (
                <>
                  {/* Header, Legend & Direction Toggle */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      flexWrap: 'wrap',
                      padding: '6px 8px',
                      background: '#131929',
                      border: '2px solid #2b3554',
                    }}
                  >
                    <span className="pixel-title" style={{ fontSize: 10, color: '#ffd147' }}>
                      {t.whiteboardModal.ganttTitle}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      {(Object.keys(PHASE_STYLES) as WorkPhase[]).map((phase) => {
                        const st = PHASE_STYLES[phase];
                        return (
                          <span
                            key={phase}
                            className="pixel-badge"
                            style={{
                              color: st.color,
                              background: st.bg,
                              borderColor: st.border,
                              fontSize: 9,
                            }}
                          >
                            {phaseLabels[phase]}
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        className="pixel-btn"
                        style={{ fontSize: 9, padding: '2px 7px' }}
                        onClick={() => {
                          playSelectBlip();
                          setGanttTopToBottom((v) => !v);
                        }}
                      >
                        {ganttTopToBottom
                          ? locale === 'tr'
                            ? '⬇️ Yukarıdan Aşağı'
                            : '⬇️ Top ➔ Bottom'
                          : locale === 'tr'
                            ? '⬆️ Aşağıdan Yukarı'
                            : '⬆️ Bottom ➔ Top'}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Topology Container */}
                  <div
                    style={{
                      border: '1px solid #2b3554',
                      background: '#0d1019',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '5px 8px',
                        background: '#131929',
                        borderBottom: topologyCollapsed ? 'none' : '1px solid #232b44',
                      }}
                    >
                      <span
                        className="pixel-title"
                        style={{
                          fontSize: 8,
                          color: '#3cd8ff',
                          letterSpacing: 0.4,
                        }}
                      >
                        🧭 {locale === 'tr' ? 'CANLI SWARM İŞ AKIŞI TOPOLOJİSİ' : 'LIVE SWARM WORKFLOW TOPOLOGY'} •{' '}
                        {ganttColumns.length} {locale === 'tr' ? 'Ajan' : 'Agents'} •{' '}
                        {edges.length} {locale === 'tr' ? 'Bağlantı' : 'Links'}
                      </span>
                      <button
                        type="button"
                        className="pixel-badge"
                        onClick={() => {
                          playSelectBlip();
                          setTopologyCollapsed((prev) => !prev);
                        }}
                        style={{
                          cursor: 'pointer',
                          color: topologyCollapsed ? '#3be87a' : '#ffd147',
                          background: '#171c2b',
                          borderColor: topologyCollapsed ? '#2d7a4f' : '#786221',
                          fontSize: 9,
                          fontFamily: 'inherit',
                          padding: '2px 7px',
                        }}
                      >
                        {topologyCollapsed
                          ? t.whiteboardModal.expandTopology
                          : t.whiteboardModal.minimizeTopology}
                      </button>
                    </div>

                    {!topologyCollapsed && (
                      <WorkflowDiagramSvg
                        edges={edges}
                        employees={employees}
                        messages={messages}
                        taskNodes={filteredTaskNodes}
                        selectedAgent={selectedAgentFilter}
                        selectedEdge={highlightedLink}
                        onSelectAgent={(name) => {
                          playSelectBlip();
                          setSelectedAgentFilter(name);
                          setHighlightedLink(null);
                        }}
                        onSelectEdge={(edge) => {
                          playSelectBlip();
                          setHighlightedLink(edge);
                          setSelectedAgentFilter(null);
                        }}
                      />
                    )}
                  </div>

                  {/* Active Filter Indicator */}
                  {(selectedAgentFilter || highlightedLink) && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '5px 8px',
                        background: '#162033',
                        border: '1px solid #3cd8ff',
                        fontSize: 10,
                      }}
                    >
                      <span style={{ color: '#dce6ff', fontFamily: 'monospace' }}>
                        {selectedAgentFilter ? (
                          <>
                            <span style={{ color: '#3cd8ff' }}>@{selectedAgentFilter}</span>
                          </>
                        ) : highlightedLink ? (
                          <>
                            <span style={{ color: '#3cd8ff' }}>@{highlightedLink.from}</span>
                            <span style={{ color: '#ffd147', margin: '0 4px' }}>➔</span>
                            <span style={{ color: '#b07cff' }}>@{highlightedLink.to}</span>
                          </>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        className="pixel-badge"
                        onClick={() => {
                          playSelectBlip();
                          setSelectedAgentFilter(null);
                          setHighlightedLink(null);
                        }}
                        style={{
                          cursor: 'pointer',
                          color: '#ffd147',
                          background: '#262113',
                          borderColor: '#786221',
                          fontSize: 9,
                          fontFamily: 'inherit',
                        }}
                      >
                        ✕ {t.whiteboardModal.clearFilter}
                      </button>
                    </div>
                  )}

                  {ganttColumns.length === 0 || dateBlocks.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 16, textAlign: 'center' }}>
                      {t.whiteboardModal.noTasksYet}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: '2px solid #2b3554',
                        background: '#111625',
                        width: '100%',
                        boxSizing: 'border-box',
                        flex: 1,
                        minHeight: topologyCollapsed ? 320 : 220,
                        maxHeight: topologyCollapsed ? 520 : 360,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        overscrollBehavior: 'contain',
                      }}
                    >
                      {/* Sticky Horizontal Agent Column Headers */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: gridCols,
                          background: '#131929',
                          borderBottom: '2px solid #2b3554',
                          position: 'sticky',
                          top: 0,
                          zIndex: 3,
                        }}
                      >
                        <div
                          style={{
                            padding: '6px 4px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRight: '1px solid #232b44',
                            fontSize: 9,
                            color: '#3cd8ff',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            textAlign: 'center',
                          }}
                        >
                          <span>{ganttTopToBottom ? '⬇️' : '⬆️'}</span>
                          <span>HH:MM</span>
                        </div>

                        {ganttColumns.map((col) => {
                          const emp = col.emp;
                          const statusColor = !emp
                            ? '#9aa7c7'
                            : emp.status === 'working'
                              ? '#3be87a'
                              : emp.status === 'error'
                                ? '#ff5666'
                                : '#ffbe3b';
                          return (
                            <div
                              key={`vhdr-${col.key}`}
                              style={{
                                padding: '6px 4px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 3,
                                borderRight: '1px solid #232b44',
                                minWidth: 0,
                              }}
                            >
                              {emp ? (
                                <EmployeePortraitCanvas
                                  employee={emp}
                                  activeEventKind={activeEventKind}
                                  size={28}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#1b2236',
                                    border: '2px solid #3b496b',
                                    fontSize: 12,
                                  }}
                                >
                                  🤖
                                </div>
                              )}
                              <span
                                className="pixel-title"
                                style={{
                                  fontSize: 8,
                                  color: '#f4f6fc',
                                  maxWidth: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={col.name}
                              >
                                {col.name}
                              </span>
                              <span style={{ fontSize: 8, color: statusColor }}>
                                ● {emp ? t.statuses[emp.status] : 'LOG'}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Date Blocks + Vertical Time Rows */}
                      {dateBlocks.map(([dateKey, blockSlots]) => {
                        const baseRows = ganttTopToBottom
                          ? blockSlots
                          : [...blockSlots].reverse();
                        const orderedRows = baseRows.filter((slot) => {
                          if (selectedAgentFilter) {
                            const af = selectedAgentFilter.toLowerCase();
                            return (
                              slot.agentName.toLowerCase() === af ||
                              slot.targets.some((tg) => tg.toLowerCase() === af)
                            );
                          }
                          if (highlightedLink) {
                            const fl = highlightedLink.from.toLowerCase();
                            const tl = highlightedLink.to.toLowerCase();
                            return (
                              slot.agentName.toLowerCase() === fl ||
                              slot.agentName.toLowerCase() === tl ||
                              slot.targets.some((tg) => tg.toLowerCase() === fl || tg.toLowerCase() === tl)
                            );
                          }
                          return true;
                        });
                        if (orderedRows.length === 0) return null;

                        return (
                          <div key={dateKey}>
                            {/* Full-width Date Separator */}
                            <div
                              style={{
                                padding: '4px 8px',
                                background: '#162033',
                                borderBottom: '1px solid #28648a',
                                borderTop: '1px solid #232b44',
                                fontSize: 10,
                                color: '#3cd8ff',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                              }}
                            >
                              📅 {dateKey}
                            </div>

                            {orderedRows.map((slot, rIdx) => {
                              const prevSlot = orderedRows[rIdx - 1];
                              const nextSlot = orderedRows[rIdx + 1];
                              const isLatestRow = ganttTopToBottom
                                ? rIdx === orderedRows.length - 1
                                : rIdx === 0;

                              return (
                                <div
                                  key={slot.id}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: gridCols,
                                    borderBottom: '1px solid rgba(35, 43, 68, 0.65)',
                                    minHeight: 30,
                                    alignItems: 'stretch',
                                  }}
                                >
                                  {/* Left Y-axis HH:MM cell */}
                                  <div
                                    style={{
                                      padding: '4px 6px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 3,
                                      borderRight: '1px solid #232b44',
                                      fontSize: 10,
                                      fontFamily: 'monospace',
                                      color: isLatestRow ? '#3be87a' : '#ffd147',
                                      fontWeight: isLatestRow ? 700 : 400,
                                      background: '#131826',
                                    }}
                                  >
                                    <span>{slot.timeLabel}</span>
                                    {isLatestRow && <span>●</span>}
                                  </div>

                                  {/* Agent Vertical Columns */}
                                  {ganttColumns.map((col, aIdx) => {
                                    const emp = col.emp;
                                    const isActiveHere = slot.agentIdx === aIdx;
                                    const isWaitingNow =
                                      isLatestRow &&
                                      !isActiveHere &&
                                      Boolean(emp && (emp.status === 'waiting' || emp.status === 'idle'));

                                    const isHighlighted = Boolean(
                                      (selectedAgentFilter &&
                                        slot.agentName.toLowerCase() ===
                                          selectedAgentFilter.toLowerCase()) ||
                                        (highlightedLink &&
                                          (slot.agentName.toLowerCase() ===
                                            highlightedLink.from.toLowerCase() ||
                                            slot.agentName.toLowerCase() ===
                                              highlightedLink.to.toLowerCase())),
                                    );
                                    const targetColIdx =
                                      slot.targets.length > 0
                                        ? findColumnIndex(slot.targets[0])
                                        : -1;
                                    const isTargetHere =
                                      !isActiveHere && targetColIdx === aIdx;

                                    if (isActiveHere) {
                                      const st = PHASE_STYLES[slot.phase];
                                      const connectTop =
                                        prevSlot &&
                                        prevSlot.agentIdx === aIdx &&
                                        prevSlot.phase === slot.phase;
                                      const connectBottom =
                                        nextSlot &&
                                        nextSlot.agentIdx === aIdx &&
                                        nextSlot.phase === slot.phase;
                                      const handoffHint =
                                        slot.targets.length > 0
                                          ? `➔ @${slot.targets[0]}`
                                          : '';

                                      return (
                                        <div
                                          key={`${slot.id}-col-${col.key}`}
                                          style={{
                                            padding: `${connectTop ? 0 : 2}px 4px ${connectBottom ? 0 : 2}px 4px`,
                                            borderRight: '1px solid #232b44',
                                            display: 'flex',
                                            alignItems: 'stretch',
                                            minWidth: 0,
                                          }}
                                        >
                                          <button
                                            type="button"
                                            onMouseEnter={() =>
                                              setSelectedGanttBlock({
                                                agentName: slot.agentName,
                                                phase: slot.phase,
                                                time: slot.timeLabel,
                                                detail: handoffHint
                                                  ? `${handoffHint} • ${slot.detail}`
                                                  : slot.detail,
                                              })
                                            }
                                            onClick={() => {
                                              playSelectBlip();
                                              setSelectedGanttBlock({
                                                agentName: slot.agentName,
                                                phase: slot.phase,
                                                time: slot.timeLabel,
                                                detail: handoffHint
                                                  ? `${handoffHint} • ${slot.detail}`
                                                  : slot.detail,
                                              });
                                            }}
                                            title={`${slot.agentName} • ${phaseLabels[slot.phase]} (${slot.timeLabel}) ${handoffHint}: ${slot.detail}`}
                                            style={{
                                              width: '100%',
                                              background: st.bg,
                                              borderLeft: `3px solid ${isHighlighted ? '#ffd147' : st.color}`,
                                              borderRight: `1px solid ${isHighlighted ? '#ffd147' : st.border}`,
                                              borderTop: connectTop ? 'none' : `1px solid ${isHighlighted ? '#ffd147' : st.border}`,
                                              borderBottom: connectBottom ? 'none' : `1px solid ${isHighlighted ? '#ffd147' : st.border}`,
                                              boxShadow: isHighlighted
                                                ? '0 0 8px rgba(255, 209, 71, 0.45)'
                                                : undefined,
                                              color: st.color,
                                              fontSize: 9,
                                              fontWeight: 700,
                                              fontFamily: 'inherit',
                                              padding: '2px 4px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              gap: 3,
                                              overflow: 'hidden',
                                              whiteSpace: 'nowrap',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            <span
                                              style={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                              }}
                                            >
                                              {shortPhaseLabels[slot.phase]}
                                              {handoffHint ? ` ${handoffHint}` : ''}
                                            </span>
                                            <span
                                              style={{
                                                fontSize: 8,
                                                color: '#dce6ff',
                                                fontFamily: 'monospace',
                                                flexShrink: 0,
                                              }}
                                            >
                                              #{slot.seq}
                                            </span>
                                          </button>
                                        </div>
                                      );
                                    }

                                    if (isWaitingNow && emp) {
                                      const brk = PHASE_STYLES.break;
                                      return (
                                        <div
                                          key={`${slot.id}-col-${col.key}`}
                                          style={{
                                            padding: '2px 4px',
                                            borderRight: '1px solid #232b44',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minWidth: 0,
                                          }}
                                        >
                                          <span
                                            style={{
                                              width: '100%',
                                              textAlign: 'center',
                                              fontSize: 8,
                                              color: brk.color,
                                              background: brk.bg,
                                              border: `1px dashed ${brk.border}`,
                                              padding: '2px 3px',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {shortPhaseLabels.break}
                                          </span>
                                        </div>
                                      );
                                    }

                                    if (isTargetHere) {
                                      return (
                                        <div
                                          key={`${slot.id}-col-${col.key}`}
                                          style={{
                                            borderRight: '1px solid #232b44',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '2px 4px',
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: 9,
                                              color: '#ffd147',
                                              border: '1px dashed rgba(255, 209, 71, 0.5)',
                                              background: 'rgba(255, 209, 71, 0.08)',
                                              padding: '1px 5px',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {slot.agentIdx < aIdx ? '➔' : '⬅'} @{col.name}
                                          </span>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div
                                        key={`${slot.id}-col-${col.key}`}
                                        style={{
                                          borderRight: '1px solid #232b44',
                                          position: 'relative',
                                          display: 'flex',
                                          justifyContent: 'center',
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: 1,
                                            height: '100%',
                                            background: 'rgba(255, 255, 255, 0.06)',
                                          }}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Single-Line Selected Phase Detail Strip */}
                  {activeDetail && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        background: '#111625',
                        border: `1px solid ${PHASE_STYLES[activeDetail.phase].border}`,
                        fontSize: 11,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span style={{ color: '#9aa7c7', fontFamily: 'monospace', fontSize: 10 }}>
                        [{activeDetail.time}]
                      </span>
                      <span className="mention-chip">@{activeDetail.agentName}</span>
                      <span
                        className="pixel-badge"
                        style={{
                          color: PHASE_STYLES[activeDetail.phase].color,
                          background: PHASE_STYLES[activeDetail.phase].bg,
                          borderColor: PHASE_STYLES[activeDetail.phase].border,
                          fontSize: 9,
                        }}
                      >
                        {phaseLabels[activeDetail.phase]}
                      </span>
                      <span
                        style={{
                          color: '#dce6ff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {activeDetail.detail}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
