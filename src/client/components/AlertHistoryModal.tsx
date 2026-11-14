import React, { useMemo, useState } from 'react';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertHistoryEntry {
  id: string;
  agentName: string;
  floorName?: string;
  severity: AlertSeverity;
  reason: string;
  message: string;
  timestamp: number;
  count?: number;
  resolved?: boolean;
  acknowledged?: boolean;
  toolName?: string;
  target?: string;
}

export interface AlertHistoryModalProps {
  alerts: AlertHistoryEntry[];
  onInspectAgent?: (agentName: string) => void;
  onMarkAllRead?: () => void;
  onDeleteAlert?: (id: string) => void;
  onClose: () => void;
  onClear?: () => void;
}

interface GroupedAlert {
  key: string;
  ids: string[];
  agentName: string;
  floorName?: string;
  severity: AlertSeverity;
  reason: string;
  message: string;
  lastSeen: number;
  count: number;
  resolved?: boolean;
  acknowledged?: boolean;
  toolName?: string;
  target?: string;
}

type SeverityFilter = 'all' | AlertSeverity;

const SEVERITY_META: Record<
  AlertSeverity,
  { icon: string; color: string; bg: string; border: string }
> = {
  critical: {
    icon: '🔴',
    color: '#ff6b6b',
    bg: 'rgba(255, 107, 107, 0.12)',
    border: '#7a252c',
  },
  warning: {
    icon: '🟡',
    color: '#ffd147',
    bg: 'rgba(255, 209, 71, 0.10)',
    border: '#6f5a1d',
  },
  info: {
    icon: '🔵',
    color: '#3cd8ff',
    bg: 'rgba(60, 216, 255, 0.10)',
    border: '#1c5c75',
  },
};

function formatLastSeen(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const AlertHistoryModal: React.FC<AlertHistoryModalProps> = ({
  alerts,
  onInspectAgent,
  onMarkAllRead,
  onDeleteAlert,
  onClose,
  onClear,
}) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const counts = useMemo(() => {
    const result: Record<SeverityFilter, number> = {
      all: 0,
      critical: 0,
      warning: 0,
      info: 0,
    };
    for (const item of alerts) {
      const n = item.count ?? 1;
      result.all += n;
      result[item.severity] += n;
    }
    return result;
  }, [alerts]);

  const groupedAlerts = useMemo<GroupedAlert[]>(() => {
    const map = new Map<string, GroupedAlert>();
    for (const item of alerts) {
      if (filter !== 'all' && item.severity !== filter) continue;
      const key = `${item.severity}::${item.agentName.trim()}::${item.reason.trim()}`;
      const increment = item.count ?? 1;
      const existing = map.get(key);
      if (existing) {
        existing.count += increment;
        existing.ids.push(item.id);
        if (item.resolved === false) existing.resolved = false;
        if (item.acknowledged === false) existing.acknowledged = false;
        if (item.timestamp >= existing.lastSeen) {
          existing.lastSeen = item.timestamp;
          existing.message = item.message;
          if (item.floorName) existing.floorName = item.floorName;
          if (item.toolName) existing.toolName = item.toolName;
          if (item.target) existing.target = item.target;
          if (item.resolved !== undefined) existing.resolved = item.resolved;
        }
      } else {
        map.set(key, {
          key,
          ids: [item.id],
          agentName: item.agentName,
          floorName: item.floorName,
          severity: item.severity,
          reason: item.reason,
          message: item.message,
          lastSeen: item.timestamp,
          count: increment,
          resolved: item.resolved,
          acknowledged: item.acknowledged,
          toolName: item.toolName,
          target: item.target,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  }, [alerts, filter]);

  const filterPills: Array<{ id: SeverityFilter; label: string; btnClass: string }> = [
    { id: 'all', label: t.alertModal.filterAll, btnClass: filter === 'all' ? 'cyan' : '' },
    {
      id: 'critical',
      label: `🔴 ${t.alertModal.filterCritical}`,
      btnClass: filter === 'critical' ? 'red' : '',
    },
    {
      id: 'warning',
      label: `🟡 ${t.alertModal.filterWarning}`,
      btnClass: filter === 'warning' ? 'amber' : '',
    },
    {
      id: 'info',
      label: `🔵 ${t.alertModal.filterInfo}`,
      btnClass: filter === 'info' ? 'cyan' : '',
    },
  ];

  return (
    <div className="pixel-modal-backdrop" onClick={onClose}>
      <div
        className="pixel-panel pixel-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 14, gap: 12, maxWidth: 680 }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pixel-title" style={{ fontSize: 11, color: '#ffd147' }}>
              {t.alertModal.title}
            </span>
            <span className="pixel-badge" style={{ color: '#9aa7c7' }}>
              {counts.all}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {onMarkAllRead && counts.all > 0 && (
              <button
                type="button"
                className="pixel-btn cyan"
                style={{ fontSize: 9, padding: '4px 8px' }}
                onClick={() => {
                  playSelectBlip();
                  onMarkAllRead();
                }}
              >
                {t.stickyAlerts.markAllRead}
              </button>
            )}
            {onClear && counts.all > 0 && (
              <button
                type="button"
                className="pixel-btn"
                onClick={() => {
                  playSelectBlip();
                  onClear();
                }}
              >
                CLR
              </button>
            )}
            <button
              type="button"
              className="pixel-btn red"
              onClick={() => {
                playSelectBlip();
                onClose();
              }}
            >
              {t.alertModal.close}
            </button>
          </div>
        </div>

        {/* Severity Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {filterPills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={`pixel-btn ${pill.btnClass}`}
              onClick={() => {
                playSelectBlip();
                setFilter(pill.id);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>{pill.label}</span>
              <span style={{ opacity: 0.85 }}>({counts[pill.id]})</span>
            </button>
          ))}
        </div>

        {/* Grouped Alert List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: '55vh',
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {groupedAlerts.length === 0 ? (
            <div
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                color: '#8f9bb8',
                fontSize: 12,
                border: '2px dashed #22293e',
              }}
            >
              {t.alertModal.empty}
            </div>
          ) : (
            groupedAlerts.map((group) => {
              const meta = SEVERITY_META[group.severity];
              return (
                <div
                  key={group.key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '8px 10px',
                    background: meta.bg,
                    border: `2px solid ${meta.border}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{meta.icon}</span>
                      <span
                        className="pixel-title"
                        style={{ fontSize: 10, color: meta.color }}
                      >
                        {group.agentName}
                      </span>
                      {group.floorName && (
                        <span className="pixel-badge" style={{ color: '#9aa7c7' }}>
                          {group.floorName}
                        </span>
                      )}
                      {group.resolved !== undefined && (
                        <span
                          className="pixel-badge"
                          style={{
                            color: group.resolved ? '#ffd147' : '#ff6b6b',
                            background: group.resolved ? '#262113' : '#2c1518',
                            borderColor: group.resolved ? '#786221' : '#7a252c',
                          }}
                        >
                          {group.resolved ? t.stickyAlerts.recovered : t.stickyAlerts.activeError}
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
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#9aa7c7', fontFamily: 'monospace' }}>
                        {formatLastSeen(group.lastSeen)}
                      </span>
                      {onInspectAgent && (
                        <button
                          type="button"
                          className="pixel-btn cyan"
                          style={{ padding: '3px 7px', fontSize: 9 }}
                          onClick={() => {
                            playSelectBlip();
                            onInspectAgent(group.agentName);
                          }}
                        >
                          🔍 {t.alertModal.inspectAgent}
                        </button>
                      )}
                      {onDeleteAlert && (
                        <button
                          type="button"
                          className="pixel-btn"
                          title={t.stickyAlerts.deleteRow}
                          style={{ padding: '3px 6px', fontSize: 9, color: '#ff8a95' }}
                          onClick={() => {
                            playSelectBlip();
                            for (const id of group.ids) onDeleteAlert(id);
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {(group.toolName || group.target) && (
                    <div style={{ fontSize: 10, color: '#ffd147', fontFamily: 'monospace' }}>
                      {[group.toolName, group.target].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#e4ecff', lineHeight: 1.35 }}>
                    {group.message}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
