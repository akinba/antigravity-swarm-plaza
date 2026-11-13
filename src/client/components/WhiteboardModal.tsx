import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  SwarmBoardMessage,
  SwarmMentionEdge,
  SwarmTaskNode,
  SwarmTaskStatus,
} from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

interface WhiteboardModalProps {
  companyName: string;
  swarmTitle?: string;
  messages: SwarmBoardMessage[];
  swarmEdges?: SwarmMentionEdge[];
  taskNodes?: SwarmTaskNode[];
  onClose: () => void;
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
  onClose,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'feed' | 'graph' | 'tasks'>('feed');
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

  const edges = useMemo(() => {
    if (swarmEdges && swarmEdges.length > 0) {
      return [...swarmEdges].sort((a, b) => b.count - a.count || b.lastSeq - a.lastSeq);
    }
    return deriveEdgesFromMessages(messages);
  }, [swarmEdges, messages]);

  const graphNodes = useMemo(() => {
    const names = new Set<string>();
    for (const e of edges) {
      names.add(e.from);
      names.add(e.to);
    }
    const list = Array.from(names);
    const cx = 260;
    const cy = 115;
    const rx = 185;
    const ry = 82;
    return list.map((name, idx) => {
      const angle = (idx / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        name,
        x: list.length === 1 ? cx : Math.round(cx + Math.cos(angle) * rx),
        y: list.length === 1 ? cy : Math.round(cy + Math.sin(angle) * ry),
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
            className={`pixel-tab ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => {
              playSelectBlip();
              setActiveTab('graph');
            }}
          >
            {t.whiteboardModal.tabGraph} ({edges.length})
          </button>
          <button
            type="button"
            className={`pixel-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => {
              playSelectBlip();
              setActiveTab('tasks');
            }}
          >
            {t.whiteboardModal.taskFlowTab} ({taskNodes.length})
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

        {activeTab === 'feed' ? (
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
        ) : (
          /* @mention Interaction Graph & List */
          <div
            className="pixel-panel-inset"
            style={{
              flex: 1,
              minHeight: 280,
              maxHeight: 460,
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {edges.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 20, textAlign: 'center' }}>
                {t.whiteboardModal.noEdges}
              </div>
            ) : (
              <>
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
                    viewBox="0 0 520 230"
                    style={{ width: '100%', maxWidth: 560, height: 220 }}
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
                      const pad = 26;
                      const x1 = fromPos.x + (dx / dist) * pad;
                      const y1 = fromPos.y + (dy / dist) * pad;
                      const x2 = toPos.x - (dx / dist) * pad;
                      const y2 = toPos.y - (dy / dist) * pad;
                      const mx = (x1 + x2) / 2;
                      const my = (y1 + y2) / 2;
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

                {/* Edge List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {edges.map((edge) => (
                    <div
                      key={`list-${edge.from}->${edge.to}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '6px 10px',
                        background: '#171c2b',
                        border: '1px solid #2d3654',
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="pixel-badge" style={{ color: '#3cd8ff' }}>
                          {edge.from}
                        </span>
                        <span style={{ color: '#ffd147', fontWeight: 700 }}>→</span>
                        <span className="mention-chip">@{edge.to}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="pixel-badge" style={{ color: '#3be87a' }}>
                          {edge.count} {t.whiteboardModal.mentionsUnit}
                        </span>
                        <span className="pixel-badge" style={{ color: '#9aa7c7' }}>
                          {t.whiteboardModal.lastSeqPrefix}
                          {edge.lastSeq}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{edge.lastTime}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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
            {taskNodes.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 12, textAlign: 'center' }}>
                {t.whiteboardModal.noTasksYet}
              </div>
            ) : (
              taskNodes.map((node) => {
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
      </div>
    </div>
  );
};
