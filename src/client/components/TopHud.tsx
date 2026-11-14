import React, { useState } from 'react';
import type { PlazaFloor, QuotaPoolStatus } from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';
import { computeHudQuota, pctColor } from './QuotaPanel';

interface TopHudProps {
  floor: PlazaFloor | null;
  quotaPools?: QuotaPoolStatus[];
  globalEcoScore: number;
  viewMode: 'plaza' | 'office';
  onChangeViewMode: (mode: 'plaza' | 'office') => void;
  onOpenWhiteboard: () => void;
  onOpenAnalytics: () => void;
  onOpenSettings: () => void;
  onExportPng: () => void;
  onRerollLayout: () => void;
  onTriggerEvent: () => void;
  wsConnected: boolean;
  isCompactPane: boolean;
  isElevatorOpen: boolean;
  onToggleElevator: () => void;
  alertCount?: number;
  historyAlertCount?: number;
  onOpenAlerts?: () => void;
  onOpenLegend?: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  floor,
  quotaPools,
  globalEcoScore,
  viewMode,
  onChangeViewMode,
  onOpenWhiteboard,
  onOpenAnalytics,
  onOpenSettings,
  onExportPng,
  onRerollLayout,
  onTriggerEvent,
  wsConnected,
  isCompactPane,
  isElevatorOpen,
  onToggleElevator,
  alertCount = 0,
  historyAlertCount = 0,
  onOpenAlerts,
  onOpenLegend,
}) => {
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);

  const xpRatio = floor
    ? Math.min(100, Math.round((floor.companyXp / Math.max(1, floor.nextTierXp)) * 100))
    : 0;
  const ecoScore = floor ? floor.ecoScore : globalEcoScore;
  const quotaInfo = computeHudQuota(quotaPools, floor?.employees);
  const quotaBadge = quotaInfo ? (
    <button
      type="button"
      className="pixel-badge"
      title={`${t.quota.hudTooltip} • ${quotaInfo.detail}`}
      onClick={() => {
        playSelectBlip();
        onOpenAnalytics();
      }}
      style={{
        color: pctColor(quotaInfo.pct),
        borderColor: pctColor(quotaInfo.pct),
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: '2px 6px',
      }}
    >
      🔋 {quotaInfo.kind === 'quota' ? t.quota.hudQuota : t.quota.hudCtx} %{quotaInfo.pct}
      {quotaInfo.resetsMin !== undefined ? ` · ↻ ${quotaInfo.resetsMin}m` : ''}
    </button>
  ) : null;
  const ecoColor = ecoScore >= 75 ? '#3be87a' : ecoScore >= 45 ? '#ffbe3b' : '#ff5666';

  const floorCode = floor
    ? floor.isDemo
      ? t.elevator.penthouse
      : floor.floorNumber === 0
        ? t.elevator.lobby
        : `${t.elevator.floorPrefix}${floor.floorNumber}`
    : t.elevator.title;

  if (isCompactPane) {
    return (
      <header
        className="pixel-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '6px 8px',
          zIndex: 25,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            flexWrap: 'nowrap',
            minHeight: 34,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span className={`led-dot ${wsConnected ? 'green' : 'amber'}`} />
            <button
              type="button"
              className={`pixel-btn ${isElevatorOpen ? 'gold' : ''}`}
              style={{ padding: '4px 7px', fontSize: 8 }}
              onClick={() => {
                playSelectBlip();
                onToggleElevator();
              }}
            >
              🏢 {floorCode} ▾
            </button>

            {floor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="pixel-badge" style={{ color: '#3be87a', padding: '2px 5px' }}>
                  ●{floor.activeCount}
                </span>
                <span className="pixel-badge" style={{ color: '#ffbe3b', padding: '2px 5px' }}>
                  ◐{floor.waitingCount}
                </span>
                {(floor.offDutyCount ?? 0) > 0 && (
                  <span className="pixel-badge" style={{ color: '#9aa7c7', padding: '2px 5px' }}>
                    🏠{floor.offDutyCount}
                  </span>
                )}
                {quotaBadge}
                {(alertCount > 0 || historyAlertCount > 0) && onOpenAlerts && (
                  <button
                    type="button"
                    className="pixel-badge"
                    title={alertCount > 0 ? t.hud.errorAlertsBadge : t.hud.historyAlertsBadge}
                    onClick={() => {
                      playSelectBlip();
                      onOpenAlerts();
                    }}
                    style={
                      alertCount > 0
                        ? {
                            color: '#ffffff',
                            background: '#c92a37',
                            borderColor: '#ff6b6b',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            padding: '2px 6px',
                            boxShadow: '0 0 8px rgba(255, 86, 102, 0.55)',
                          }
                        : {
                            color: '#9aa7c7',
                            background: '#171c2b',
                            borderColor: '#3b496b',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            padding: '2px 6px',
                          }
                    }
                  >
                    {alertCount > 0 ? `! ${alertCount}` : `🔔 ${historyAlertCount}`}
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className="pixel-btn cyan"
              style={{ padding: '4px 7px', fontSize: 8 }}
              onClick={() => {
                playSelectBlip();
                onChangeViewMode(viewMode === 'office' ? 'plaza' : 'office');
              }}
            >
              {viewMode === 'office' ? t.hud.viewPlaza : t.hud.viewOffice}
            </button>

            <button
              type="button"
              className="pixel-btn gold"
              style={{ padding: '4px 7px', fontSize: 8 }}
              onClick={() => {
                playSelectBlip();
                onOpenWhiteboard();
              }}
            >
              📋
            </button>

            <button
              type="button"
              className="pixel-btn cyan"
              style={{ padding: '4px 7px', fontSize: 8 }}
              onClick={() => {
                playSelectBlip();
                onOpenAnalytics();
              }}
            >
              📊
            </button>

            <button
              type="button"
              className={`pixel-btn ${moreOpen ? 'cyan' : ''}`}
              style={{ padding: '4px 7px', fontSize: 9 }}
              onClick={() => {
                playSelectBlip();
                setMoreOpen((v) => !v);
              }}
            >
              ⋯
            </button>
          </div>
        </div>

        {moreOpen && (
          <div
            className="pixel-panel-inset"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
              padding: '6px 8px',
            }}
          >
            {floor && (
              <>
                <button
                  type="button"
                  className="pixel-btn"
                  style={{ padding: '4px 7px', fontSize: 8 }}
                  onClick={() => {
                    playSelectBlip();
                    onRerollLayout();
                  }}
                >
                  {t.hud.rerollLayout}
                </button>
                <button
                  type="button"
                  className="pixel-btn cyan"
                  style={{ padding: '4px 7px', fontSize: 8 }}
                  onClick={onTriggerEvent}
                >
                  {t.hud.triggerEvent}
                </button>
              </>
            )}
            {onOpenLegend && (
              <button
                type="button"
                className="pixel-btn"
                style={{ padding: '4px 7px', fontSize: 8 }}
                onClick={() => {
                  playSelectBlip();
                  setMoreOpen(false);
                  onOpenLegend();
                }}
              >
                {t.hud.legendShort}
              </button>
            )}
            <button
              type="button"
              className="pixel-btn gold"
              style={{ padding: '4px 7px', fontSize: 8 }}
              onClick={() => {
                playSelectBlip();
                setMoreOpen(false);
                onOpenSettings();
              }}
            >
              {t.hud.settings}
            </button>
          </div>
        )}
      </header>
    );
  }

  return (
    <header
      className="pixel-panel"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '8px 14px',
        zIndex: 20,
      }}
    >
      {/* Left: Brand, Elevator Toggle & Floor Company Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`led-dot ${wsConnected ? 'green' : 'amber'}`} />
          <span className="pixel-title" style={{ fontSize: 11, color: '#ffd147' }}>
            {t.appTitle}
          </span>
          <span className="pixel-badge" style={{ color: wsConnected ? '#3be87a' : '#ffbe3b' }}>
            {wsConnected ? t.hud.wsConnected : t.hud.wsReconnecting}
          </span>
        </div>

        <button
          type="button"
          className={`pixel-btn ${isElevatorOpen ? 'gold' : ''}`}
          onClick={() => {
            playSelectBlip();
            onToggleElevator();
          }}
        >
          🏢 {floorCode} ▾
        </button>

        {floor && (
          <div
            className="pixel-panel-inset"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 10px',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 12, color: '#3cd8ff' }}>
              {floor.companyName}
            </span>
            <span className="pixel-badge" style={{ color: '#ffd147' }}>
              T{floor.tier} • {t.companyTiers[floor.tier]}
            </span>

            {/* Company XP Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.hud.xpLabel}</span>
              <div className="pixel-bar-track" style={{ width: 76 }}>
                <div
                  className="pixel-bar-fill"
                  style={{ width: `${xpRatio}%`, background: '#b07cff' }}
                />
              </div>
              <span style={{ fontSize: 10, color: '#e2d1ff' }}>{floor.companyXp}</span>
            </div>

            {/* Active / Waiting / Off-Duty counters */}
            <span className="pixel-badge" style={{ color: '#3be87a' }}>
              ● {floor.activeCount} {t.hud.active}
            </span>
            <span className="pixel-badge" style={{ color: '#ffbe3b' }}>
              ◐ {floor.waitingCount} {t.hud.waiting}
            </span>
            {(floor.offDutyCount ?? 0) > 0 && (
              <span className="pixel-badge" style={{ color: '#9aa7c7' }}>
                🏠 {floor.offDutyCount} {t.hud.offDuty}
              </span>
            )}
            {(alertCount > 0 || historyAlertCount > 0) && onOpenAlerts && (
              <button
                type="button"
                className="pixel-badge"
                title={alertCount > 0 ? t.hud.errorAlertsBadge : t.hud.historyAlertsBadge}
                onClick={() => {
                  playSelectBlip();
                  onOpenAlerts();
                }}
                style={
                  alertCount > 0
                    ? {
                        color: '#ffffff',
                        background: '#c92a37',
                        borderColor: '#ff6b6b',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        padding: '2px 7px',
                        boxShadow: '0 0 8px rgba(255, 86, 102, 0.55)',
                      }
                    : {
                        color: '#9aa7c7',
                        background: '#171c2b',
                        borderColor: '#3b496b',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        padding: '2px 7px',
                      }
                }
              >
                {alertCount > 0 ? `! ${alertCount}` : `🔔 ${historyAlertCount}`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Eco Score + Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Remaining Quota / Context Battery */}
        {quotaBadge}

        {/* Pure-Gemini Eco/Quota Score */}
        <div
          className="pixel-panel-inset"
          title={t.hud.ecoTooltip}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}
        >
          <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-pixel)' }}>
            {t.hud.ecoScore}
          </span>
          <div className="pixel-bar-track" style={{ width: 62 }}>
            <div
              className="pixel-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, ecoScore))}%`, background: ecoColor }}
            />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: ecoColor }}>{ecoScore}%</span>
        </div>

        {/* View Switch */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className={`pixel-btn ${viewMode === 'plaza' ? 'cyan' : ''}`}
            onClick={() => {
              playSelectBlip();
              onChangeViewMode('plaza');
            }}
          >
            {t.hud.viewPlaza}
          </button>
          <button
            type="button"
            className={`pixel-btn ${viewMode === 'office' ? 'cyan' : ''}`}
            onClick={() => {
              playSelectBlip();
              onChangeViewMode('office');
            }}
          >
            {t.hud.viewOffice}
          </button>
        </div>

        {/* Swarm Board */}
        <button
          type="button"
          className="pixel-btn gold"
          onClick={() => {
            playSelectBlip();
            onOpenWhiteboard();
          }}
        >
          {t.hud.swarmBoard}
        </button>

        {/* Analytics Modal */}
        <button
          type="button"
          className="pixel-btn cyan"
          onClick={() => {
            playSelectBlip();
            onOpenAnalytics();
          }}
        >
          {t.hud.analytics}
        </button>

        {/* Office PNG Snapshot */}
        {viewMode === 'office' && floor && (
          <button
            type="button"
            className="pixel-btn"
            onClick={() => {
              playSelectBlip();
              onExportPng();
            }}
          >
            {t.hud.snapshotPng}
          </button>
        )}

        {/* Reroll Layout & Trigger Event */}
        {floor && (
          <>
            <button
              type="button"
              className="pixel-btn"
              onClick={() => {
                playSelectBlip();
                onRerollLayout();
              }}
            >
              {t.hud.rerollLayout}
            </button>
            <button
              type="button"
              className="pixel-btn cyan"
              onClick={onTriggerEvent}
            >
              {t.hud.triggerEvent}
            </button>
          </>
        )}

        {/* Icon Legend */}
        {onOpenLegend && (
          <button
            type="button"
            className="pixel-btn"
            onClick={() => {
              playSelectBlip();
              onOpenLegend();
            }}
          >
            {t.hud.legendShort}
          </button>
        )}

        {/* Settings */}
        <button
          type="button"
          className="pixel-btn gold"
          onClick={() => {
            playSelectBlip();
            onOpenSettings();
          }}
        >
          {t.hud.settings}
        </button>
      </div>
    </header>
  );
};
