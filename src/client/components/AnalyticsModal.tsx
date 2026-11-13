import React, { useMemo, useState } from 'react';
import type {
  ActivityTimelineBucket,
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

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  floor,
  snapshot,
  onClose,
}) => {
  const { t } = useI18n();
  const [scope, setScope] = useState<'floor' | 'global'>(floor?.analytics ? 'floor' : 'global');

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
        </div>
      </div>
    </div>
  );
};
