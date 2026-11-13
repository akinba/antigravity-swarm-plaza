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

interface WhiteboardModalProps {
  companyName: string;
  swarmTitle?: string;
  messages: SwarmBoardMessage[];
  swarmEdges?: SwarmMentionEdge[];
  taskNodes?: SwarmTaskNode[];
  employees?: OfficeEmployee[];
  agentResources?: AgentResourceUsage[];
  activeEventKind?: FloorEventKind | null;
  onSelectEmployee?: (employee: OfficeEmployee) => void;
  onClose: () => void;
}

function formatCompactTokens(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return String(val);
}

const EmployeePortraitCanvas: React.FC<{
  employee: OfficeEmployee;
  activeEventKind?: FloorEventKind | null;
  size?: number;
}> = ({ employee, activeEventKind, size = 64 }) => {
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
};

type WorkPhase = 'coding' | 'analysis' | 'testing' | 'coord' | 'break';

const PHASE_STYLES: Record<WorkPhase, { color: string; bg: string; border: string; icon: string }> = {
  coding: { color: '#00e5ff', bg: 'rgba(0, 229, 255, 0.16)', border: '#0097a7', icon: '💻' },
  analysis: { color: '#b388ff', bg: 'rgba(179, 136, 255, 0.16)', border: '#6c49b8', icon: '🔍' },
  testing: { color: '#00e676', bg: 'rgba(0, 230, 118, 0.16)', border: '#1b8a4b', icon: '🧪' },
  coord: { color: '#ffd54f', bg: 'rgba(255, 213, 79, 0.16)', border: '#9c7818', icon: '📊' },
  break: { color: '#78909c', bg: 'rgba(120, 144, 156, 0.16)', border: '#4b5d66', icon: '☕' },
};

function classifyWorkPhase(text: string, emp?: OfficeEmployee): WorkPhase {
  const lower = text.toLowerCase();
  if (emp && (emp.activity === 'coffee' || emp.activity === 'gaming' || emp.activity === 'lounging' || emp.activity === 'sleeping' || emp.activity === 'watercooler')) {
    return 'break';
  }
  if (/(test|pass|exit 0|typecheck|verify|doğrula|screenshot|preview|grill|audit)/i.test(lower)) {
    return 'testing';
  }
  if (/(analiz|analy|inspect|investigat|keşif|read|audit|review|check|incele)/i.test(lower)) {
    return 'analysis';
  }
  if (/(plan|wave|assign|görev|brief|present|sunum|coordinator|boss|stage|commit|push)/i.test(lower) || emp?.isCoordinator) {
    return 'coord';
  }
  if (/(edit|implement|build|fix|add|ekle|kod|refactor|modal|sprite|canvas|ts|tsx|css)/i.test(lower) || emp?.status === 'working') {
    return 'coding';
  }
  return emp?.status === 'waiting' || emp?.status === 'idle' ? 'break' : 'coding';
}

function summarizeSnippet(text: string, maxLen = 72): string {
  const cleaned = text.replace(/@[a-zA-Z0-9_-]+/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '...';
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned;
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
  employees = [],
  agentResources = [],
  activeEventKind = null,
  onSelectEmployee,
  onClose,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'feed' | 'personnel' | 'tasks' | 'gantt'>('feed');
  const [selectedGanttBlock, setSelectedGanttBlock] = useState<{
    agentName: string;
    phase: WorkPhase;
    time: string;
    detail: string;
  } | null>(null);
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
            {t.whiteboardModal.personnelTab} ({employees.length})
          </button>
          <button
            type="button"
            className={`pixel-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => {
              playSelectBlip();
              setActiveTab('tasks');
            }}
          >
            {t.whiteboardModal.taskFlowTab} ({filteredTaskNodes.length})
          </button>
          <button
            type="button"
            className={`pixel-tab ${activeTab === 'gantt' ? 'active' : ''}`}
            onClick={() => {
              playSelectBlip();
              setActiveTab('gantt');
            }}
          >
            {t.whiteboardModal.ganttTab}
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
                                {emp.health?.isVerifiedOutput && (
                                  <span
                                    className="pixel-badge"
                                    style={{
                                      color: '#3be87a',
                                      background: '#13281d',
                                      borderColor: '#2d7a4f',
                                    }}
                                  >
                                    ✅ {emp.health.verifiedLabel || t.rpgModal.verifiedBadgeLabel}
                                  </span>
                                )}
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

        {activeTab === 'tasks' && (
          <div
            className="pixel-panel-inset"
            style={{
              padding: 12,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              maxHeight: 460,
            }}
          >
            {edges.length > 0 && (
              <div
                style={{
                  background: '#0d1019',
                  border: '2px solid #07080d',
                  padding: 6,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <svg
                  viewBox="0 0 640 280"
                  style={{ width: '100%', maxWidth: 640, height: 220 }}
                  shapeRendering="crispEdges"
                >
                  <defs>
                    <marker
                      id="swarm-arrow"
                      markerWidth="6"
                      markerHeight="6"
                      refX="5"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0,0 6,3 0,6" fill="#ffd147" />
                    </marker>
                  </defs>

                  {edges.map((edge) => {
                    const fromPos = nodePosMap.get(edge.from);
                    const toPos = nodePosMap.get(edge.to);
                    if (!fromPos || !toPos) return null;
                    const dx = toPos.x - fromPos.x;
                    const dy = toPos.y - fromPos.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    const pad = 34;
                    const x1 = fromPos.x + (dx / dist) * pad;
                    const y1 = fromPos.y + (dy / dist) * pad;
                    const x2 = toPos.x - (dx / dist) * pad;
                    const y2 = toPos.y - (dy / dist) * pad;
                    const nx = -dy / dist;
                    const ny = dx / dist;
                    const mx = (x1 + x2) / 2 + nx * 10;
                    const my = (y1 + y2) / 2 + ny * 10;
                    return (
                      <g key={`${edge.from}->${edge.to}`}>
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#8a63ff"
                          strokeWidth={Math.min(4, 1 + edge.count * 0.6)}
                          strokeDasharray={edge.count > 2 ? undefined : '4 2'}
                          markerEnd="url(#swarm-arrow)"
                        />
                        <rect
                          x={mx - 9}
                          y={my - 8}
                          width={18}
                          height={15}
                          fill="#171c2b"
                          stroke="#ffd147"
                          strokeWidth={1}
                        />
                        <text
                          x={mx}
                          y={my + 3}
                          textAnchor="middle"
                          fill="#ffd147"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {edge.count}
                        </text>
                      </g>
                    );
                  })}

                  {graphNodes.map((node) => {
                    const isCoord = node.name === 'coordinator';
                    const isAll = node.name === 'all';
                    const fill = isCoord ? '#3b2d14' : isAll ? '#2c1f4a' : '#182b3b';
                    const stroke = isCoord ? '#ffd147' : isAll ? '#b07cff' : '#3cd8ff';
                    const label = isCoord
                      ? '★ BOSS'
                      : node.name.length > 13
                        ? `${node.name.slice(0, 12)}…`
                        : node.name;
                    return (
                      <g key={node.name} transform={`translate(${node.x}, ${node.y})`}>
                        <rect
                          x={-48}
                          y={-13}
                          width={96}
                          height={26}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={2}
                        />
                        <text
                          x={0}
                          y={4}
                          textAnchor="middle"
                          fill="#f4f6fc"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
            {filteredTaskNodes.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 12, textAlign: 'center' }}>
                {t.whiteboardModal.noTasksYet}
              </div>
            ) : (
              filteredTaskNodes.map((node) => {
                const statusMeta: Record<
                  SwarmTaskStatus,
                  { icon: string; label: string; color: string; bg: string; border: string }
                > = {
                  verified: {
                    icon: '✅',
                    label: t.whiteboardModal.taskStatusVerified,
                    color: '#3be87a',
                    bg: '#13281d',
                    border: '#2d7a4f',
                  },
                  running: {
                    icon: '⚡',
                    label: t.whiteboardModal.taskStatusRunning,
                    color: '#3cd8ff',
                    bg: '#132233',
                    border: '#28648a',
                  },
                  pending: {
                    icon: '⏳',
                    label: t.whiteboardModal.taskStatusPending,
                    color: '#ffd147',
                    bg: '#262113',
                    border: '#786221',
                  },
                  blocked: {
                    icon: '⚠️',
                    label: t.whiteboardModal.taskStatusBlocked,
                    color: '#ff6b6b',
                    bg: '#2c1518',
                    border: '#802b32',
                  },
                  completed: {
                    icon: '✔',
                    label: t.whiteboardModal.taskStatusCompleted,
                    color: '#9aa7c7',
                    bg: '#192030',
                    border: '#3b496b',
                  },
                };
                const st = statusMeta[node.status];
                return (
                  <div
                    key={node.id}
                    style={{
                      padding: '10px 12px',
                      background: '#171c2b',
                      border: `2px solid ${st.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {/* Top row: status + title + updatedAt */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          className="pixel-badge"
                          style={{
                            color: st.color,
                            background: st.bg,
                            borderColor: st.border,
                          }}
                        >
                          {st.icon} {st.label}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 12, color: '#e8efff' }}>
                          {node.title}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                        {node.updatedAt}
                        {node.durationSec !== undefined ? ` • ${node.durationSec}s` : ''}
                      </span>
                    </div>

                    {/* Owner & DAG / Handoff flow */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        fontSize: 11,
                      }}
                    >
                      <span style={{ color: 'var(--text-dim)' }}>{t.whiteboardModal.taskOwnerLabel}:</span>
                      <span className="mention-chip">@{node.ownerName}</span>
                      {node.ownerRole && (
                        <span className="pixel-badge" style={{ color: '#9aa7c7' }}>
                          {node.ownerRole}
                        </span>
                      )}

                      {node.parentTaskId && (
                        <span className="pixel-badge" style={{ color: '#b07cff' }}>
                          ↳ {node.parentTaskId}
                        </span>
                      )}
                      {node.dependsOnTaskIds.length > 0 && (
                        <span className="pixel-badge" style={{ color: '#9aa7c7' }}>
                          ← {node.dependsOnTaskIds.join(', ')}
                        </span>
                      )}

                      {node.handoffTargetNames.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text-dim)' }}>
                            {t.whiteboardModal.taskHandoffLabel}:
                          </span>
                          <span style={{ color: '#3cd8ff' }}>@{node.ownerName}</span>
                          <span style={{ color: '#ffd147', fontWeight: 700 }}>➔</span>
                          {node.handoffTargetNames.map((target) => (
                            <span key={target} className="mention-chip">
                              @{target}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>

                    {/* Verification proof & evidence badges */}
                    {(node.verifiedKeyword || node.evidenceBadges.length > 0) && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          fontSize: 10,
                        }}
                      >
                        <span style={{ color: 'var(--text-dim)' }}>{t.whiteboardModal.taskProofLabel}:</span>
                        {node.verifiedKeyword && (
                          <span
                            className="pixel-badge"
                            style={{ color: '#ffd147', background: '#252116', borderColor: '#786221' }}
                          >
                            ✅ {node.verifiedKeyword}
                          </span>
                        )}
                        {node.evidenceBadges.map((badge, idx) => (
                          <span
                            key={`${badge}-${idx}`}
                            className="pixel-badge"
                            style={{ color: '#3be87a', background: '#13281d', borderColor: '#2b6b45' }}
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'gantt' && (
          <div
            className="pixel-panel-inset"
            style={{
              padding: 10,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 490,
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
              const shortPhaseLabels: Record<WorkPhase, string> = {
                coding: '💻 Kod',
                analysis: '🔍 Analiz',
                testing: '🧪 Test',
                coord: '📊 Plan',
                break: '☕ Mola',
              };

              const orderedMsgs = [...messages].sort((a, b) => a.seq - b.seq);
              const windowMsgs = orderedMsgs.slice(-14);
              const totalSlots = Math.max(1, windowMsgs.length);

              interface TimeBlock {
                agentName: string;
                phase: WorkPhase;
                startIdx: number;
                endIdx: number;
                time: string;
                detail: string;
              }

              let defaultBlock: TimeBlock | null = null;

              const swimlanes = employees.map((emp) => {
                const empKey = emp.name.toLowerCase();
                const blocks: TimeBlock[] = [];

                windowMsgs.forEach((m, idx) => {
                  const agentLow = m.agent.toLowerCase();
                  const isMine =
                    agentLow === empKey || (emp.isCoordinator && agentLow === 'coordinator');
                  if (!isMine) return;
                  const phase = classifyWorkPhase(m.text, undefined);
                  const detail = summarizeSnippet(m.text, 110);
                  const prev = blocks[blocks.length - 1];
                  if (prev && prev.phase === phase && idx <= prev.endIdx + 1) {
                    prev.endIdx = idx;
                    prev.time = m.time;
                    prev.detail = detail;
                  } else {
                    blocks.push({
                      agentName: emp.name,
                      phase,
                      startIdx: idx,
                      endIdx: idx,
                      time: m.time,
                      detail,
                    });
                  }
                });

                if (blocks.length === 0) {
                  const curPhase = classifyWorkPhase(emp.speechBubble || emp.roleTitle, emp);
                  blocks.push({
                    agentName: emp.name,
                    phase: curPhase,
                    startIdx: emp.status === 'working' ? Math.max(0, totalSlots - 2) : 0,
                    endIdx: totalSlots - 1,
                    time: 'NOW',
                    detail: emp.speechBubble || emp.roleTitle,
                  });
                }

                const lastB = blocks[blocks.length - 1];
                if (lastB) defaultBlock = lastB;
                return { emp, blocks };
              });

              const activeDetail = selectedGanttBlock ?? defaultBlock;

              const handoffSteps: Array<{
                id: string;
                seq: number;
                time: string;
                fromName: string;
                fromPhase: WorkPhase;
                fromText: string;
                toNames: string[];
                toPhase: WorkPhase;
              }> = [];

              for (let i = 0; i < windowMsgs.length - 1; i++) {
                const cur = windowMsgs[i];
                const nxt = windowMsgs[i + 1];
                const curTargets = (cur.mentions ?? []).filter((m) =>
                  validSceneAgents ? validSceneAgents.has(m.toLowerCase()) : true,
                );
                if (cur.agent.toLowerCase() !== nxt.agent.toLowerCase()) {
                  const fromEmp = employees.find(
                    (e) =>
                      e.name.toLowerCase() === cur.agent.toLowerCase() ||
                      (e.isCoordinator && cur.agent.toLowerCase() === 'coordinator'),
                  );
                  const toEmp = employees.find(
                    (e) =>
                      e.name.toLowerCase() === nxt.agent.toLowerCase() ||
                      (e.isCoordinator && nxt.agent.toLowerCase() === 'coordinator'),
                  );
                  handoffSteps.push({
                    id: `${cur.seq}-${nxt.seq}`,
                    seq: cur.seq,
                    time: cur.time.slice(11, 16) || cur.time,
                    fromName: cur.agent,
                    fromPhase: classifyWorkPhase(cur.text, fromEmp),
                    fromText: summarizeSnippet(cur.text, 56),
                    toNames: curTargets.length > 0 ? curTargets.slice(0, 2) : [nxt.agent],
                    toPhase: classifyWorkPhase(nxt.text, toEmp),
                  });
                }
              }

              const compactHandoffs = handoffSteps.slice(-5).reverse();

              return (
                <>
                  {/* Header & Legend */}
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
                    </div>
                  </div>

                  {/* Time Axis */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '148px 1fr',
                      gap: 8,
                      padding: '0 6px',
                      fontSize: 9,
                      color: 'var(--text-dim)',
                      fontFamily: 'monospace',
                    }}
                  >
                    <span>AGENT</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span style={{ color: '#3be87a', fontWeight: 700 }}>NOW ●</span>
                    </div>
                  </div>

                  {/* Waterfall Swimlanes (100% width, zero horizontal scroll) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                    {swimlanes.map(({ emp, blocks }) => {
                      const statusColor =
                        emp.status === 'working'
                          ? '#3be87a'
                          : emp.status === 'error'
                            ? '#ff5666'
                            : '#ffbe3b';
                      return (
                        <div
                          key={`gantt-${emp.id}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '148px 1fr',
                            gap: 8,
                            padding: '4px 6px',
                            background: '#171c2b',
                            border: '1px solid #2d3654',
                            alignItems: 'center',
                            width: '100%',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <EmployeePortraitCanvas
                              employee={emp}
                              activeEventKind={activeEventKind}
                              size={28}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div
                                className="pixel-title"
                                style={{
                                  fontSize: 9,
                                  color: '#f4f6fc',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {emp.name}
                              </div>
                              <div style={{ fontSize: 8, color: statusColor }}>
                                ● {t.statuses[emp.status]}
                              </div>
                            </div>
                          </div>

                          {/* Time-aligned track */}
                          <div
                            style={{
                              position: 'relative',
                              height: 28,
                              width: '100%',
                              background: 'rgba(120, 144, 156, 0.08)',
                              border: '1px solid #232b44',
                              overflow: 'hidden',
                            }}
                          >
                            {[25, 50, 75].map((pct) => (
                              <div
                                key={pct}
                                style={{
                                  position: 'absolute',
                                  left: `${pct}%`,
                                  top: 0,
                                  bottom: 0,
                                  width: 1,
                                  background: 'rgba(255,255,255,0.06)',
                                  pointerEvents: 'none',
                                }}
                              />
                            ))}

                            {blocks.map((blk, idx) => {
                              const st = PHASE_STYLES[blk.phase];
                              const leftPct = (blk.startIdx / totalSlots) * 100;
                              const rawWidthPct =
                                ((blk.endIdx - blk.startIdx + 1) / totalSlots) * 100;
                              const widthPct = Math.min(100 - leftPct, Math.max(7, rawWidthPct));
                              return (
                                <button
                                  key={`${emp.id}-blk-${idx}`}
                                  type="button"
                                  onMouseEnter={() => setSelectedGanttBlock(blk)}
                                  onClick={() => {
                                    playSelectBlip();
                                    setSelectedGanttBlock(blk);
                                  }}
                                  title={`${blk.agentName} • ${phaseLabels[blk.phase]} (${blk.time}): ${blk.detail}`}
                                  style={{
                                    position: 'absolute',
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    top: 3,
                                    bottom: 3,
                                    background: st.bg,
                                    border: `1px solid ${st.border}`,
                                    color: st.color,
                                    fontSize: 9,
                                    fontWeight: 700,
                                    fontFamily: 'inherit',
                                    padding: '0 4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {shortPhaseLabels[blk.phase]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

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

                  {/* Compact Sequential Workflow Chain */}
                  <div
                    style={{
                      padding: '6px 8px',
                      background: '#131929',
                      border: '2px solid #2b3554',
                    }}
                  >
                    <div
                      className="pixel-title"
                      style={{ fontSize: 9, color: '#3cd8ff', marginBottom: 6 }}
                    >
                      {t.whiteboardModal.ganttSequenceTitle}
                    </div>
                    {compactHandoffs.length === 0 ? (
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        {t.whiteboardModal.noTasksYet}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {compactHandoffs.map((step) => (
                          <div
                            key={step.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              background: '#171c2b',
                              border: '1px solid #2d3654',
                              fontSize: 10,
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: 9 }}>
                              #{step.seq} [{step.time}]
                            </span>
                            <span className="mention-chip">@{step.fromName}</span>
                            <span style={{ color: PHASE_STYLES[step.fromPhase].color, fontSize: 9 }}>
                              ({shortPhaseLabels[step.fromPhase]})
                            </span>
                            <span style={{ color: '#ffd147', fontWeight: 700 }}>➔</span>
                            {step.toNames.map((n) => (
                              <span key={n} className="mention-chip">
                                @{n}
                              </span>
                            ))}
                            <span style={{ color: PHASE_STYLES[step.toPhase].color, fontSize: 9 }}>
                              ({shortPhaseLabels[step.toPhase]})
                            </span>
                            <span
                              style={{
                                color: '#9aa7c7',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {step.fromText}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
