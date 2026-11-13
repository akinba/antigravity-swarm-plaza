import React, { useMemo, useState } from 'react';
import type {
  ActivityTimelineBucket,
  AgentResourceUsage,
  ModelBreakdownEntry,
  ModelFamily,
  PlazaFloor,
  PlazaSnapshot,
} from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

interface AnalyticsModalProps {
  floor: PlazaFloor | null;
  snapshot: PlazaSnapshot | null;
  onClose: () => void;
}

type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertFilter = 'all' | AlertSeverity;

interface SmartAlertGroup {
  key: string;
  severity: AlertSeverity;
  agentName: string;
  floorName?: string;
  reason: string;
  summary: string;
  timeLabel?: string;
  count: number;
  sortRank: number;
}

const SEVERITY_STYLE: Record<
  AlertSeverity,
  { icon: string; color: string; bg: string; border: string; rank: number }
> = {
  critical: {
    icon: '🔴',
    color: '#ff6b6b',
    bg: 'rgba(255, 107, 107, 0.12)',
    border: '#7a252c',
    rank: 3,
  },
  warning: {
    icon: '🟡',
    color: '#ffd147',
    bg: 'rgba(255, 209, 71, 0.10)',
    border: '#6f5a1d',
    rank: 2,
  },
  info: {
    icon: '🔵',
    color: '#3cd8ff',
    bg: 'rgba(60, 216, 255, 0.10)',
    border: '#1c5c75',
    rank: 1,
  },
};

const FAMILY_COLORS: Record<ModelFamily, string> = {
  argon: '#b07cff',
  hydrogen: '#3cd8ff',
  flash: '#ffd147',
  carbon: '#3be87a',
  pro: '#4f7cff',
  claude: '#e87a5d',
  gpt: '#2dd4bf',
  other: '#9aa7c7',
};

function formatCompactTokens(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val);
}

function classifyBoardMessage(
  rawText: string,
  kind: string,
  hasMentions: boolean,
): { severity: AlertSeverity; reason: string } {
  const clean = rawText.replace(/\s+/g, ' ').trim();
  const scrubbed = clean
    .replace(/\b0\s+(?:errors?|failed|failures?|warnings?)\b/gi, '')
    .replace(/\berrors?\s*[:=]\s*0\b/gi, '');

  if (
    kind === 'error' ||
    /\b(fatal|crash|panic|exception|kritik|çöktü)\b/i.test(scrubbed) ||
    (/\b(failed|failure|başarısız)\b/i.test(scrubbed) && !/\b(exit\s*0|passed)\b/i.test(clean))
  ) {
    return { severity: 'critical', reason: 'agent-error' };
  }
  if (
    kind === 'warning' ||
    /\b(warning|warn|retry|retrying|timeout|stalled|blocked|quota|uyarı|engel|zaman aşımı)\b/i.test(
      scrubbed,
    )
  ) {
    return { severity: 'warning', reason: 'agent-warning' };
  }
  if (/\b(pass|passed|done|exit\s*0|verified|tamamlandı|doğrulandı)\b|✅/i.test(clean)) {
    return { severity: 'info', reason: 'verified-output' };
  }
  return {
    severity: 'info',
    reason: hasMentions || clean.includes('@') ? 'board-handoff' : 'board-update',
  };
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  floor,
  snapshot,
  onClose,
}) => {
  const { locale, t } = useI18n();
  const [scope, setScope] = useState<'floor' | 'global'>(floor?.analytics ? 'floor' : 'global');
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');

  const estTag = locale === 'tr' ? '~Tahmini' : '~Est.';

  const timeline: ActivityTimelineBucket[] = useMemo(() => {
    if (scope === 'floor' && floor?.analytics?.timeline60m) {
      return floor.analytics.timeline60m;
    }
    return snapshot?.timeline60m ?? floor?.analytics?.timeline60m ?? [];
  }, [scope, floor, snapshot]);

  const models: ModelBreakdownEntry[] = useMemo(() => {
    if (scope === 'floor' && floor?.analytics?.modelBreakdown) {
      return floor.analytics.modelBreakdown;
    }
    return snapshot?.modelBreakdown ?? floor?.analytics?.modelBreakdown ?? [];
  }, [scope, floor, snapshot]);

  const completedTasks60m = useMemo(() => {
    if (scope === 'floor' && floor?.analytics) {
      return floor.analytics.completedTasks60m;
    }
    return timeline.reduce((sum, b) => sum + b.completedTasks, 0);
  }, [scope, floor, timeline]);

  const peakActive60m = useMemo(() => {
    if (scope === 'floor' && floor?.analytics) {
      return floor.analytics.peakActive60m;
    }
    return timeline.reduce((max, b) => Math.max(max, b.activeCount), 0);
  }, [scope, floor, timeline]);

  const totalErrors60m = useMemo(
    () => timeline.reduce((sum, b) => sum + b.errorCount, 0),
    [timeline],
  );

  const maxActive = useMemo(
    () => Math.max(1, ...timeline.map((b) => b.activeCount)),
    [timeline],
  );

  const maxCompleted = useMemo(
    () => Math.max(1, ...timeline.map((b) => b.completedTasks)),
    [timeline],
  );

  const totalModelAgents = useMemo(
    () => Math.max(1, models.reduce((sum, m) => sum + m.agentCount, 0)),
    [models],
  );

  const agentResources: AgentResourceUsage[] = useMemo(() => {
    if (scope === 'floor') {
      const list = floor?.analytics?.agentResources ?? [];
      return [...list].sort((a, b) => b.estimatedTokens - a.estimatedTokens);
    }
    const sourceFloors = snapshot?.floors?.length ? snapshot.floors : floor ? [floor] : [];
    const merged = new Map<string, AgentResourceUsage>();
    for (const f of sourceFloors) {
      for (const item of f.analytics?.agentResources ?? []) {
        const key = `${f.id}::${item.agentId}`;
        const existing = merged.get(key);
        if (existing) {
          existing.estimatedTokens += item.estimatedTokens;
          existing.estimatedCostUsd = Number(
            (existing.estimatedCostUsd + item.estimatedCostUsd).toFixed(4),
          );
          existing.completedTasks += item.completedTasks;
        } else {
          merged.set(key, { ...item });
        }
      }
    }
    return Array.from(merged.values()).sort((a, b) => b.estimatedTokens - a.estimatedTokens);
  }, [scope, floor, snapshot]);

  const totalEstimatedTokens = useMemo(() => {
    if (scope === 'floor' && floor?.analytics?.totalEstimatedTokens !== undefined) {
      return floor.analytics.totalEstimatedTokens;
    }
    if (scope === 'global' && snapshot?.floors?.length) {
      return snapshot.floors.reduce(
        (sum, f) =>
          sum +
          (f.analytics?.totalEstimatedTokens ??
            (f.analytics?.agentResources ?? []).reduce((s, r) => s + r.estimatedTokens, 0)),
        0,
      );
    }
    return agentResources.reduce((sum, r) => sum + r.estimatedTokens, 0);
  }, [scope, floor, snapshot, agentResources]);

  const totalEstimatedCostUsd = useMemo(() => {
    if (scope === 'floor' && floor?.analytics?.totalEstimatedCostUsd !== undefined) {
      return floor.analytics.totalEstimatedCostUsd;
    }
    if (scope === 'global' && snapshot?.floors?.length) {
      const sum = snapshot.floors.reduce(
        (acc, f) =>
          acc +
          (f.analytics?.totalEstimatedCostUsd ??
            (f.analytics?.agentResources ?? []).reduce((s, r) => s + r.estimatedCostUsd, 0)),
        0,
      );
      return Number(sum.toFixed(4));
    }
    return Number(agentResources.reduce((sum, r) => sum + r.estimatedCostUsd, 0).toFixed(4));
  }, [scope, floor, snapshot, agentResources]);

  const maxResourceTokens = useMemo(
    () => Math.max(1, ...agentResources.map((r) => r.estimatedTokens)),
    [agentResources],
  );

  const smartAlerts: SmartAlertGroup[] = useMemo(() => {
    const targetFloors =
      scope === 'floor' && floor
        ? [floor]
        : snapshot?.floors?.length
          ? snapshot.floors
          : floor
            ? [floor]
            : [];

    const grouped = new Map<string, SmartAlertGroup>();

    const upsert = (
      scopeKey: string,
      severity: AlertSeverity,
      agentName: string,
      reason: string,
      summary: string,
      count: number,
      sortRank: number,
      floorName?: string,
      timeLabel?: string,
    ) => {
      const normAgent = agentName.trim().replace(/^@/, '').toLowerCase() || 'swarm';
      const key = `${scopeKey}::${severity}::${normAgent}::${reason}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += count;
        if (sortRank >= existing.sortRank) {
          existing.sortRank = sortRank;
          existing.summary = summary;
          if (timeLabel) existing.timeLabel = timeLabel;
          if (floorName) existing.floorName = floorName;
        }
      } else {
        grouped.set(key, {
          key,
          severity,
          agentName: agentName.trim() || 'swarm',
          floorName,
          reason,
          summary,
          timeLabel,
          count,
          sortRank,
        });
      }
    };

    for (const f of targetFloors) {
      const floorTag = scope === 'global' ? f.companyName : undefined;

      for (const emp of f.employees ?? []) {
        const h = emp.health;
        const isCrit =
          emp.status === 'error' ||
          emp.toolActivity === 'error' ||
          h?.normalizedState === 'error' ||
          (h?.consecutiveErrors ?? 0) >= 2 ||
          (h !== undefined && h.hpScore < 45);

        if (isCrit) {
          const errTotal = Math.max(1, h?.errorCount || h?.consecutiveErrors || 1);
          const summary =
            locale === 'tr'
              ? `Kritik sağlık/hata durumu (HP ${h?.hpScore ?? 0}/100, Hata: ${errTotal})`
              : `Critical health/error state (HP ${h?.hpScore ?? 0}/100, Errors: ${errTotal})`;
          upsert(f.id, 'critical', emp.name, 'agent-error', summary, errTotal, 500, floorTag);
        } else if (h && (h.errorCount > 0 || h.retryCount > 0 || h.hpScore < 75)) {
          const warnCount = Math.max(1, h.retryCount + h.errorCount);
          const summary =
            locale === 'tr'
              ? `Tekrar deneme / düşen güvenilirlik (HP ${h.hpScore}/100, Retry: ${h.retryCount})`
              : `Retry / degraded reliability (HP ${h.hpScore}/100, Retry: ${h.retryCount})`;
          upsert(f.id, 'warning', emp.name, 'agent-warning', summary, warnCount, 400, floorTag);
        }

        if (h?.isVerifiedOutput) {
          const badge = h.verifiedLabel || t.rpgModal.verifiedBadgeLabel;
          const summary = `✅ ${badge} — HP ${h.hpScore}/100 (${h.successRatePct}%)`;
          upsert(f.id, 'info', emp.name, 'verified-output', summary, 1, 300, floorTag);
        }
      }

      for (const msg of f.boardMessages ?? []) {
        const cleanText = msg.text.replace(/\s+/g, ' ').trim();
        if (!cleanText) continue;
        const snippet = cleanText.length > 94 ? `${cleanText.slice(0, 91)}...` : cleanText;
        const { severity, reason } = classifyBoardMessage(
          cleanText,
          msg.kind,
          Boolean(msg.mentions && msg.mentions.length > 0),
        );
        const shortTime = msg.time ? msg.time.split(' ').pop() ?? msg.time : undefined;
        upsert(
          f.id,
          severity,
          msg.agent || 'swarm',
          reason,
          `#${msg.seq}: ${snippet}`,
          1,
          1000 + msg.seq,
          floorTag,
          shortTime,
        );
      }
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const rankDiff = SEVERITY_STYLE[b.severity].rank - SEVERITY_STYLE[a.severity].rank;
      if (rankDiff !== 0) return rankDiff;
      if (b.sortRank !== a.sortRank) return b.sortRank - a.sortRank;
      return b.count - a.count;
    });
  }, [scope, floor, snapshot, locale, t.rpgModal.verifiedBadgeLabel]);

  const alertCounts = useMemo(() => {
    const res: Record<AlertFilter, number> = { all: 0, critical: 0, warning: 0, info: 0 };
    for (const item of smartAlerts) {
      res.all += item.count;
      res[item.severity] += item.count;
    }
    return res;
  }, [smartAlerts]);

  const filteredAlerts = useMemo(
    () =>
      alertFilter === 'all'
        ? smartAlerts
        : smartAlerts.filter((item) => item.severity === alertFilter),
    [smartAlerts, alertFilter],
  );

  return (
    <div className="pixel-modal-backdrop" onClick={onClose}>
      <div
        className="pixel-panel pixel-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 14, gap: 12 }}
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
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="pixel-title" style={{ fontSize: 11, color: '#ffd147' }}>
              {t.analyticsModal.title}
            </span>
            {floor && (
              <span className="pixel-badge" style={{ color: '#3cd8ff' }}>
                {floor.companyName}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {floor && (
              <button
                type="button"
                className={`pixel-btn ${scope === 'floor' ? 'cyan' : ''}`}
                onClick={() => {
                  playSelectBlip();
                  setScope('floor');
                }}
              >
                {t.analyticsModal.scopeFloor}
              </button>
            )}
            <button
              type="button"
              className={`pixel-btn ${scope === 'global' ? 'cyan' : ''}`}
              onClick={() => {
                playSelectBlip();
                setScope('global');
              }}
            >
              {t.analyticsModal.scopeGlobal}
            </button>
            <button
              type="button"
              className="pixel-btn danger"
              onClick={() => {
                playSelectBlip();
                onClose();
              }}
            >
              {t.analyticsModal.close}
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            overflowY: 'auto',
            maxHeight: '72vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingRight: 2,
          }}
        >
          {/* KPI Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 10,
            }}
          >
            <div className="pixel-chart-card">
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {t.analyticsModal.completedTasks60m}
              </span>
              <span className="pixel-title" style={{ fontSize: 18, color: '#3be87a' }}>
                {completedTasks60m}
              </span>
            </div>
            <div className="pixel-chart-card">
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {t.analyticsModal.peakActive60m}
              </span>
              <span className="pixel-title" style={{ fontSize: 18, color: '#3cd8ff' }}>
                {peakActive60m}
              </span>
            </div>
            <div className="pixel-chart-card">
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {t.analyticsModal.errorsCount}
              </span>
              <span
                className="pixel-title"
                style={{ fontSize: 18, color: totalErrors60m > 0 ? '#ff5666' : '#9aa7c7' }}
              >
                {totalErrors60m}
              </span>
            </div>
          </div>

          {/* 60-Min Floor Activity Timeline */}
          <div className="pixel-chart-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span className="pixel-title" style={{ fontSize: 9, color: '#3cd8ff' }}>
                {t.analyticsModal.timelineTitle}
              </span>
              <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
                <span style={{ color: '#3cd8ff' }}>■ {t.analyticsModal.activeLegend}</span>
                <span style={{ color: '#ff5666' }}>▲ {t.analyticsModal.errorLegend}</span>
              </div>
            </div>

            {timeline.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: 12 }}>
                {t.analyticsModal.noTimeline}
              </div>
            ) : (
              <>
                <div className="pixel-spark-grid">
                  {timeline.map((bucket) => {
                    const pct = Math.round((bucket.activeCount / maxActive) * 100);
                    return (
                      <div
                        key={bucket.bucketStart}
                        className="pixel-spark-col"
                        title={`${bucket.label} — ${t.analyticsModal.activeLegend}: ${bucket.activeCount}, ${t.analyticsModal.completedLegend}: ${bucket.completedTasks}, ${t.analyticsModal.errorLegend}: ${bucket.errorCount}`}
                      >
                        {bucket.errorCount > 0 && (
                          <span style={{ fontSize: 8, color: '#ff5666', lineHeight: 1 }}>▲</span>
                        )}
                        <div
                          className="pixel-spark-bar"
                          style={{
                            height: `${Math.max(4, pct)}%`,
                            background:
                              bucket.errorCount > 0
                                ? '#ff5666'
                                : bucket.activeCount > 0
                                  ? '#3cd8ff'
                                  : '#242b42',
                            borderTop: '2px solid #9beaff',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 9,
                    color: 'var(--text-dim)',
                  }}
                >
                  <span>{timeline[0]?.label}</span>
                  <span>{timeline[Math.floor(timeline.length / 2)]?.label}</span>
                  <span>{timeline[timeline.length - 1]?.label}</span>
                </div>
              </>
            )}
          </div>

          {/* Task Completions Timeline */}
          {timeline.length > 0 && (
            <div className="pixel-chart-card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span className="pixel-title" style={{ fontSize: 9, color: '#3be87a' }}>
                  {t.analyticsModal.completedTitle}
                </span>
                <span style={{ fontSize: 10, color: '#ffd147' }}>
                  ■ {t.analyticsModal.completedLegend}: {completedTasks60m}
                </span>
              </div>
              <div className="pixel-spark-grid" style={{ height: 78 }}>
                {timeline.map((bucket) => {
                  const pct = Math.round((bucket.completedTasks / maxCompleted) * 100);
                  return (
                    <div
                      key={`comp-${bucket.bucketStart}`}
                      className="pixel-spark-col"
                      title={`${bucket.label}: ${bucket.completedTasks}`}
                    >
                      <div
                        className="pixel-spark-bar"
                        style={{
                          height: `${bucket.completedTasks > 0 ? Math.max(8, pct) : 4}%`,
                          background: bucket.completedTasks > 0 ? '#3be87a' : '#1e2438',
                          borderTop: bucket.completedTasks > 0 ? '2px solid #a8ffca' : undefined,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Model Distribution */}
          <div className="pixel-chart-card">
            <span className="pixel-title" style={{ fontSize: 9, color: '#b07cff' }}>
              {t.analyticsModal.modelDistTitle}
            </span>

            {models.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: 8 }}>
                {t.analyticsModal.noModels}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {models.map((entry) => {
                  const pct = Math.round((entry.agentCount / totalModelAgents) * 100);
                  const color = FAMILY_COLORS[entry.modelFamily] ?? FAMILY_COLORS.other;
                  return (
                    <div
                      key={`${entry.modelFamily}-${entry.modelId}`}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            className="pixel-badge"
                            style={{ color, borderColor: '#0a0c14' }}
                          >
                            {(t.modelFamilies[entry.modelFamily] ?? entry.modelFamily).toUpperCase()}
                          </span>
                          <span style={{ color: '#f4f6fc', fontWeight: 700 }}>{entry.modelId}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                          <span style={{ color: '#9aa7c7' }}>
                            {entry.agentCount} {t.analyticsModal.agentsUnit}
                          </span>
                          <span style={{ color: '#3be87a' }}>
                            {entry.activeCount} {t.analyticsModal.activeUnit}
                          </span>
                          <span style={{ color: '#ffd147' }}>
                            {formatCompactTokens(entry.totalTokens)} {t.analyticsModal.tokensUnit}
                          </span>
                        </div>
                      </div>
                      <div className="pixel-bar-track" style={{ height: 10 }}>
                        <div
                          className="pixel-bar-fill"
                          style={{ width: `${Math.max(4, pct)}%`, background: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Resource & Cost Monitor (~Estimated / ~Tahmini) */}
          <div className="pixel-chart-card" style={{ gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span className="pixel-title" style={{ fontSize: 9, color: '#ffd147' }}>
                💰 {t.analyticsModal.resourceMonitorTitle}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  className="pixel-badge"
                  style={{ color: '#3cd8ff', borderColor: '#1c5c75' }}
                  title={`${t.analyticsModal.estTokensLabel}: ~${totalEstimatedTokens.toLocaleString()} ${t.analyticsModal.tokensUnit} (${estTag})`}
                >
                  {t.analyticsModal.estTokensLabel}: ~{formatCompactTokens(totalEstimatedTokens)}{' '}
                  {t.analyticsModal.tokensUnit} ({estTag})
                </span>
                <span
                  className="pixel-badge"
                  style={{ color: '#ffd147', borderColor: '#6f5a1d', fontWeight: 700 }}
                >
                  {t.analyticsModal.estCostLabel}: ~${totalEstimatedCostUsd.toFixed(4)} {estTag}
                </span>
              </div>
            </div>

            {/* PDF Page 4 Prominent Estimated Disclaimer Strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '6px 10px',
                background: 'rgba(255, 209, 71, 0.10)',
                border: '2px solid #6f5a1d',
                color: '#ffe082',
                fontSize: 10,
                lineHeight: 1.35,
                flexWrap: 'wrap',
              }}
            >
              <span>ℹ️ {t.analyticsModal.estimatedDisclaimer}</span>
              <span
                className="pixel-badge"
                style={{ color: '#10131e', background: '#ffd147', fontWeight: 700 }}
              >
                {estTag}
              </span>
            </div>

            {agentResources.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: 8 }}>
                {t.analyticsModal.noModels}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {agentResources.map((res) => {
                  const pct = Math.round((res.estimatedTokens / maxResourceTokens) * 100);
                  const color = FAMILY_COLORS[res.modelFamily] ?? FAMILY_COLORS.other;
                  return (
                    <div
                      key={`${res.agentId}-${res.modelName}`}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ color: '#f4f6fc', fontWeight: 700 }}>
                            @{res.agentName}
                          </span>
                          <span
                            className="pixel-badge"
                            style={{ color, borderColor: '#0a0c14' }}
                          >
                            {(
                              t.modelFamilies[res.modelFamily] ?? res.modelFamily
                            ).toUpperCase()}
                          </span>
                          <span style={{ color: '#9aa7c7', fontSize: 10 }}>{res.modelName}</span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ color: '#3be87a' }}>
                            {t.analyticsModal.completedTasksCol}: {res.completedTasks}
                          </span>
                          <span style={{ color: '#3cd8ff' }}>
                            ~{formatCompactTokens(res.estimatedTokens)}{' '}
                            {t.analyticsModal.tokensUnit} ({estTag})
                          </span>
                          <span style={{ color: '#ffd147', fontWeight: 700 }}>
                            ~${res.estimatedCostUsd.toFixed(4)} ({estTag})
                          </span>
                        </div>
                      </div>

                      <div className="pixel-bar-track" style={{ height: 9 }}>
                        <div
                          className="pixel-bar-fill"
                          style={{ width: `${Math.max(4, pct)}%`, background: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compact Smart Alert Summary & Severity Filter Strip */}
          <div className="pixel-chart-card" style={{ gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pixel-title" style={{ fontSize: 9, color: '#3cd8ff' }}>
                  🔔 {t.alertModal.title}
                </span>
                <span className="pixel-badge" style={{ color: '#9aa7c7' }}>
                  {alertCounts.all}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`pixel-btn ${alertFilter === 'all' ? 'cyan' : ''}`}
                  style={{ fontSize: 9, padding: '3px 7px' }}
                  onClick={() => {
                    playSelectBlip();
                    setAlertFilter('all');
                  }}
                >
                  {t.alertModal.filterAll} ({alertCounts.all})
                </button>
                <button
                  type="button"
                  className={`pixel-btn ${alertFilter === 'critical' ? 'danger' : ''}`}
                  style={{
                    fontSize: 9,
                    padding: '3px 7px',
                    borderColor: alertFilter === 'critical' ? '#ff6b6b' : undefined,
                  }}
                  onClick={() => {
                    playSelectBlip();
                    setAlertFilter('critical');
                  }}
                >
                  🔴 {t.alertModal.filterCritical} ({alertCounts.critical})
                </button>
                <button
                  type="button"
                  className="pixel-btn"
                  style={{
                    fontSize: 9,
                    padding: '3px 7px',
                    color: alertFilter === 'warning' ? '#10131e' : '#ffd147',
                    background: alertFilter === 'warning' ? '#ffd147' : undefined,
                    borderColor: alertFilter === 'warning' ? '#ffe082' : undefined,
                  }}
                  onClick={() => {
                    playSelectBlip();
                    setAlertFilter('warning');
                  }}
                >
                  🟡 {t.alertModal.filterWarning} ({alertCounts.warning})
                </button>
                <button
                  type="button"
                  className={`pixel-btn ${alertFilter === 'info' ? 'cyan' : ''}`}
                  style={{ fontSize: 9, padding: '3px 7px' }}
                  onClick={() => {
                    playSelectBlip();
                    setAlertFilter('info');
                  }}
                >
                  🔵 {t.alertModal.filterInfo} ({alertCounts.info})
                </button>
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  padding: '10px 8px',
                  textAlign: 'center',
                  border: '2px dashed #22293e',
                }}
              >
                {t.alertModal.empty}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  maxHeight: 176,
                  overflowY: 'auto',
                  paddingRight: 2,
                }}
              >
                {filteredAlerts.map((group) => {
                  const meta = SEVERITY_STYLE[group.severity];
                  return (
                    <div
                      key={group.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '5px 8px',
                        background: meta.bg,
                        border: `2px solid ${meta.border}`,
                        fontSize: 11,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          minWidth: 0,
                          flex: '1 1 260px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>{meta.icon}</span>
                        <span
                          className="pixel-title"
                          style={{ fontSize: 9, color: meta.color }}
                        >
                          @{group.agentName.replace(/^@/, '')}
                        </span>
                        {group.floorName && (
                          <span className="pixel-badge" style={{ color: '#9aa7c7' }}>
                            {group.floorName}
                          </span>
                        )}
                        {group.count > 1 && (
                          <span
                            className="pixel-badge"
                            style={{
                              color: '#10131e',
                              background: meta.color,
                              fontWeight: 700,
                            }}
                          >
                            ×{group.count}
                          </span>
                        )}
                        <span
                          style={{
                            color: '#e4ecff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {group.summary}
                        </span>
                      </div>

                      {group.timeLabel && (
                        <span
                          style={{
                            fontSize: 10,
                            color: '#9aa7c7',
                            fontFamily: 'monospace',
                            flexShrink: 0,
                          }}
                        >
                          {group.timeLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
