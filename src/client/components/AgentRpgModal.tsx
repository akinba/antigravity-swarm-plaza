import React, { useEffect, useRef, useState } from 'react';
import type { AgentDetailResponse, AgentLogEntry, FloorEventKind, OfficeEmployee } from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { drawEmployeePortrait, UNIFORM_COLORS } from '../engine/pixelSprites';
import { useI18n } from '../i18n/translations';
import { sidecarFetch } from '../sidecarBridge';

interface AgentRpgModalProps {
  employee: OfficeEmployee;
  activeEventKind?: FloorEventKind | null;
  onClose: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export const AgentRpgModal: React.FC<AgentRpgModalProps> = ({ employee, activeEventKind, onClose }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'profile' | 'logs'>('profile');
  const [liveEmp, setLiveEmp] = useState<OfficeEmployee>(employee);
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const portraitRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLiveEmp(employee);
  }, [employee]);

  // Draw pixel portrait
  useEffect(() => {
    const canvas = portraitRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawEmployeePortrait(ctx, liveEmp, 96, activeEventKind ?? null);
  }, [liveEmp, activeEventKind]);

  // Poll /api/agents/:id/logs every 2s while modal is open
  useEffect(() => {
    let cancelled = false;

    const fetchLogs = async () => {
      try {
        const res = await sidecarFetch(`/api/agents/${encodeURIComponent(employee.id)}/logs`);
        if (!res.ok) return;
        const data = (await res.json()) as AgentDetailResponse;
        if (cancelled) return;
        if (data.employee) setLiveEmp(data.employee);
        if (Array.isArray(data.recentLogs)) setLogs(data.recentLogs);
      } catch {
        // ignore network errors during poll
      }
    };

    fetchLogs();
    const timer = window.setInterval(fetchLogs, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [employee.id]);

  const uniform = UNIFORM_COLORS[liveEmp.modelFamily] || UNIFORM_COLORS.other;
  const xpProgress = Math.min(100, liveEmp.xp % 100 || (liveEmp.xp > 0 ? 100 : 0));

  return (
    <div className="pixel-modal-backdrop" onClick={onClose}>
      <div
        className="pixel-panel pixel-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 14, gap: 12 }}
      >
        {/* Modal Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="pixel-badge"
              style={{ background: uniform.dark, color: uniform.trim, borderColor: uniform.trim }}
            >
              {uniform.badge}
            </span>
            <span className="pixel-title" style={{ fontSize: 12, color: '#ffd147' }}>
              {liveEmp.name}
            </span>
            {liveEmp.isCoordinator && (
              <span className="pixel-badge" style={{ color: '#ffd147', background: '#4a3510' }}>
                ★ {t.rpgModal.coordinatorBadge}
              </span>
            )}
          </div>

          <button
            type="button"
            className="pixel-btn danger"
            onClick={() => {
              playSelectBlip();
              onClose();
            }}
          >
            {t.rpgModal.close}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`pixel-btn ${activeTab === 'profile' ? 'cyan' : ''}`}
            onClick={() => {
              playSelectBlip();
              setActiveTab('profile');
            }}
          >
            {t.rpgModal.tabProfile}
          </button>
          <button
            type="button"
            className={`pixel-btn ${activeTab === 'logs' ? 'cyan' : ''}`}
            onClick={() => {
              playSelectBlip();
              setActiveTab('logs');
            }}
          >
            {t.rpgModal.tabLogs} ({logs.length})
          </button>
        </div>

        {/* Body */}
        {activeTab === 'profile' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {/* Pixel Portrait Frame */}
              <div
                className="pixel-panel-inset"
                style={{
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <canvas
                  ref={portraitRef}
                  width={96}
                  height={96}
                  style={{ width: 96, height: 96, border: '2px solid #07080d' }}
                />
                <span className="pixel-title" style={{ fontSize: 10, color: '#ffd147' }}>
                  LVL {liveEmp.level}
                </span>
              </div>

              {/* Stats Grid */}
              <div
                className="pixel-panel-inset"
                style={{
                  flex: 1,
                  minWidth: 260,
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))',
                  gap: 10,
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.rpgModal.role}</div>
                  <div style={{ fontWeight: 700 }}>{liveEmp.roleTitle}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.rpgModal.model}</div>
                  <div style={{ fontWeight: 700, color: '#3cd8ff' }}>{liveEmp.modelId}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.rpgModal.status}</div>
                  <div
                    style={{
                      fontWeight: 700,
                      color:
                        liveEmp.status === 'working'
                          ? '#3be87a'
                          : liveEmp.status === 'error'
                            ? '#ff5666'
                            : '#ffbe3b',
                    }}
                  >
                    {t.statuses[liveEmp.status]}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.rpgModal.zone}</div>
                  <div>{t.zones[liveEmp.zone]}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.rpgModal.activity}</div>
                  <div>{t.activities[liveEmp.activity]}</div>
                  {liveEmp.activity === 'gaming' && liveEmp.partnerName && (
                    <div style={{ marginTop: 4 }}>
                      <span
                        className="pixel-badge"
                        style={{ color: '#ffd147', background: '#263459', borderColor: '#3cd8ff' }}
                      >
                        P{liveEmp.playerSlot ?? 1} • {t.rpgModal.gamingWith}: {liveEmp.partnerName}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.rpgModal.workspace}</div>
                  <div>{liveEmp.workspaceMode}</div>
                </div>
              </div>
            </div>

            {/* XP & Steps Bar */}
            <div className="pixel-panel-inset" style={{ padding: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  marginBottom: 6,
                }}
              >
                <span>
                  {t.rpgModal.xp}: <strong>{liveEmp.xp}</strong>
                </span>
                <span>
                  {t.rpgModal.steps}: <strong>{liveEmp.stepCount}</strong>
                </span>
              </div>
              <div className="pixel-bar-track" style={{ height: 14 }}>
                <div
                  className="pixel-bar-fill"
                  style={{ width: `${xpProgress}%`, background: '#3be87a' }}
                />
              </div>
            </div>

            {/* Token Economy */}
            <div className="pixel-panel-inset" style={{ padding: 12 }}>
              <div
                className="pixel-title"
                style={{ fontSize: 9, color: '#3cd8ff', marginBottom: 10 }}
              >
                {t.rpgModal.tokensTitle}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {t.rpgModal.inputTokens}
                  </div>
                  <div style={{ fontWeight: 700 }}>{formatNumber(liveEmp.inputTokens)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {t.rpgModal.cacheReadTokens}
                  </div>
                  <div style={{ fontWeight: 700, color: '#3be87a' }}>
                    {formatNumber(liveEmp.cacheReadTokens)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {t.rpgModal.outputTokens}
                  </div>
                  <div style={{ fontWeight: 700, color: '#ffbe3b' }}>
                    {formatNumber(liveEmp.outputTokens)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="pixel-panel-inset"
            style={{
              flex: 1,
              minHeight: 260,
              maxHeight: 420,
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 11,
                color: 'var(--text-dim)',
                marginBottom: 4,
              }}
            >
              <span>{t.rpgModal.logsTitle}</span>
              <span className="pixel-badge" style={{ color: '#3be87a' }}>
                ● {t.rpgModal.logsRefreshing}
              </span>
            </div>

            {logs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 16, textAlign: 'center' }}>
                {t.rpgModal.noLogs}
              </div>
            ) : (
              logs.map((entry) => (
                <div
                  key={`${entry.stepIndex}-${entry.timestamp}`}
                  style={{
                    padding: '8px 10px',
                    background: '#171c2b',
                    border: '1px solid #2b3452',
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: '#ffd147', fontWeight: 700 }}>
                      #{entry.stepIndex} {entry.toolName ? `• ${entry.toolName}` : `• ${entry.type}`}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                      {entry.status} • {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {entry.targetSummary && (
                    <div style={{ color: '#3cd8ff', wordBreak: 'break-word' }}>
                      {entry.targetSummary}
                    </div>
                  )}
                  {entry.thoughtSnippet && (
                    <div style={{ color: '#cfd7eb', fontStyle: 'italic', wordBreak: 'break-word' }}>
                      {entry.thoughtSnippet}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
