import React, { useEffect, useRef, useState } from 'react';
import type { AgentDetailResponse, AgentLogEntry, FloorEventKind, OfficeEmployee } from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { drawEmployeePortrait, UNIFORM_COLORS } from '../engine/pixelSprites';
import { useI18n } from '../i18n/translations';
import { sidecarFetch } from '../sidecarBridge';
import { formatTokens, pctColor } from './QuotaPanel';

interface AgentRpgModalProps {
  employee: OfficeEmployee;
  activeEventKind?: FloorEventKind | null;
  onBack?: () => void;
  onClose: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export const AgentRpgModal: React.FC<AgentRpgModalProps> = ({
  employee,
  activeEventKind,
  onBack,
  onClose,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'profile' | 'logs'>('profile');
  const [liveEmp, setLiveEmp] = useState<OfficeEmployee>(employee);
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [dismissedErrorId, setDismissedErrorId] = useState<string | null>(null);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {onBack && (
              <button
                type="button"
                className="pixel-btn cyan"
                onClick={() => {
                  playSelectBlip();
                  onBack();
                }}
              >
                {t.rpgModal.backToList}
              </button>
            )}
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
            {(() => {
              const hasActiveErr =
                liveEmp.status === 'error' ||
                liveEmp.activity === 'error' ||
                liveEmp.toolActivity === 'error' ||
                (liveEmp.health?.consecutiveErrors ?? 0) > 0;
              const lastErr = liveEmp.lastError;
              const showLastErr = Boolean(lastErr && dismissedErrorId !== lastErr.id);
              if (!hasActiveErr && !showLastErr) return null;
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '8px 12px',
                    background: hasActiveErr
                      ? 'rgba(201, 42, 55, 0.18)'
                      : 'rgba(255, 209, 71, 0.10)',
                    border: `2px solid ${hasActiveErr ? '#ff5666' : '#ffd147'}`,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                      <span style={{ color: hasActiveErr ? '#ff6b6b' : '#ffd147', fontWeight: 700 }}>
                        {hasActiveErr
                          ? `⚠️ ${t.rpgModal.errorBannerTitle}`
                          : `🟡 ${t.stickyAlerts.lastErrorTitle} (${t.stickyAlerts.recovered})`}
                      </span>
                      {hasActiveErr && (
                        <span style={{ color: '#ffd1d6', fontSize: 11 }}>
                          • {Math.max(1, liveEmp.health?.consecutiveErrors ?? 0)} {t.rpgModal.consecutiveErrorsLabel}
                        </span>
                      )}
                      {liveEmp.health && (
                        <span
                          className="pixel-badge"
                          style={{ color: '#ff9aa4', background: '#2c1518', borderColor: '#7a252c' }}
                        >
                          HP {liveEmp.health.hpScore}/100
                        </span>
                      )}
                    </div>
                    {lastErr && (
                      <div style={{ fontSize: 11, color: '#e4ecff', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                        {lastErr.toolName || lastErr.target
                          ? `${[lastErr.toolName, lastErr.target].filter(Boolean).join(' · ')} — `
                          : ''}
                        {lastErr.message}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="pixel-btn"
                      style={{
                        background: hasActiveErr ? '#c92a37' : '#262113',
                        borderColor: hasActiveErr ? '#ff8a95' : '#ffd147',
                        color: '#ffffff',
                        fontSize: 10,
                        padding: '5px 10px',
                      }}
                      onClick={() => {
                        playSelectBlip();
                        setActiveTab('logs');
                      }}
                    >
                      {t.rpgModal.goToLogs}
                    </button>
                    {!hasActiveErr && lastErr && (
                      <button
                        type="button"
                        className="pixel-btn"
                        style={{ padding: '4px 7px', fontSize: 10 }}
                        onClick={() => {
                          playSelectBlip();
                          setDismissedErrorId(lastErr.id);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
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

            {/* Health & Reliability (HP) */}
            {liveEmp.health && (
              <div className="pixel-panel-inset" style={{ padding: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <span className="pixel-title" style={{ fontSize: 9, color: '#ffd147' }}>
                    {t.rpgModal.healthSectionTitle}
                  </span>
                  <span
                    className="pixel-badge"
                    style={{
                      color: liveEmp.health.isVerifiedOutput ? '#3be87a' : '#9aa7c7',
                      background: liveEmp.health.isVerifiedOutput ? '#13281d' : '#192030',
                      borderColor: liveEmp.health.isVerifiedOutput ? '#2d7a4f' : '#3b496b',
                    }}
                  >
                    {liveEmp.health.isVerifiedOutput
                      ? `✅ ${liveEmp.health.verifiedLabel || t.rpgModal.verifiedBadgeLabel}`
                      : t.rpgModal.unverifiedBadgeLabel}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    marginBottom: 6,
                  }}
                >
                  <span>
                    {t.rpgModal.hpLabel}:{' '}
                    <strong
                      style={{
                        color:
                          liveEmp.health.hpScore >= 70
                            ? '#3be87a'
                            : liveEmp.health.hpScore >= 40
                              ? '#ffbe3b'
                              : '#ff5666',
                      }}
                    >
                      {liveEmp.health.hpScore}/100
                    </strong>
                  </span>
                  <span>
                    {t.rpgModal.successRateLabel}: <strong>%{liveEmp.health.successRatePct}</strong>
                  </span>
                </div>

                <div className="pixel-bar-track" style={{ height: 12, marginBottom: 8 }}>
                  <div
                    className="pixel-bar-fill"
                    style={{
                      width: `${Math.max(0, Math.min(100, liveEmp.health.hpScore))}%`,
                      background:
                        liveEmp.health.hpScore >= 70
                          ? '#3be87a'
                          : liveEmp.health.hpScore >= 40
                            ? '#ffbe3b'
                            : '#ff5666',
                    }}
                  />
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {t.rpgModal.stepsErrorsLabel}:{' '}
                  <strong style={{ color: '#e4ecff' }}>
                    {liveEmp.health.totalSteps} / {liveEmp.health.errorCount}
                  </strong>{' '}
                  <span>(Retry: {liveEmp.health.retryCount})</span>
                </div>
              </div>
            )}

            {/* Token Economy */}
            <div className="pixel-panel-inset" style={{ padding: 12 }}>
              <div
                className="pixel-title"
                style={{ fontSize: 9, color: '#3cd8ff', marginBottom: 10 }}
              >
                {t.rpgModal.tokensTitle}
              </div>
              {liveEmp.contextLimitTokens && liveEmp.contextUsedTokens !== undefined && (() => {
                const limit = liveEmp.contextLimitTokens;
                const left = Math.max(0, limit - liveEmp.contextUsedTokens);
                const pct = Math.round((left / limit) * 100);
                const color = pctColor(pct);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 11 }}>
                    <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{t.quota.ctxTitle}</span>
                    <div className="pixel-bar-track" style={{ flex: 1, minWidth: 80 }}>
                      <div className="pixel-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span style={{ color, fontWeight: 700 }}>
                      {formatTokens(left)} / {formatTokens(limit)} {t.quota.ctxLeft} (%{pct})
                    </span>
                  </div>
                );
              })()}
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
              logs.map((entry) => {
                const isErrorEntry = entry.status?.toUpperCase() === 'ERROR';
                return (
                <div
                  key={`${entry.stepIndex}-${entry.timestamp}`}
                  style={{
                    padding: '8px 10px',
                    background: isErrorEntry ? 'rgba(201, 42, 55, 0.16)' : '#171c2b',
                    border: isErrorEntry ? '2px solid #ff5666' : '1px solid #2b3452',
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: isErrorEntry ? '#ff6b6b' : '#ffd147', fontWeight: 700 }}>
                      #{entry.stepIndex} {entry.toolName ? `• ${entry.toolName}` : `• ${entry.type}`}
                    </span>
                    <span
                      style={{
                        color: isErrorEntry ? '#ff6b6b' : 'var(--text-dim)',
                        fontWeight: isErrorEntry ? 700 : 400,
                        fontSize: 10,
                      }}
                    >
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
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
