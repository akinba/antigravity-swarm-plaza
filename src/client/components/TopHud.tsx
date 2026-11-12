import React from 'react';
import type { PlazaFloor } from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

interface TopHudProps {
  floor: PlazaFloor | null;
  globalEcoScore: number;
  viewMode: 'plaza' | 'office';
  onChangeViewMode: (mode: 'plaza' | 'office') => void;
  demoMode: boolean;
  onToggleDemo: () => void;
  isNight: boolean;
  onToggleNight: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onOpenWhiteboard: () => void;
  onRerollLayout: () => void;
  onTriggerEvent: () => void;
  wsConnected: boolean;
}

export const TopHud: React.FC<TopHudProps> = ({
  floor,
  globalEcoScore,
  viewMode,
  onChangeViewMode,
  demoMode,
  onToggleDemo,
  isNight,
  onToggleNight,
  muted,
  onToggleMute,
  onOpenWhiteboard,
  onRerollLayout,
  onTriggerEvent,
  wsConnected,
}) => {
  const { locale, setLocale, t } = useI18n();

  const xpRatio = floor
    ? Math.min(100, Math.round((floor.companyXp / Math.max(1, floor.nextTierXp)) * 100))
    : 0;
  const ecoScore = floor ? floor.ecoScore : globalEcoScore;
  const ecoColor = ecoScore >= 75 ? '#3be87a' : ecoScore >= 45 ? '#ffbe3b' : '#ff5666';

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
      {/* Left: Brand & Floor Company Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`led-dot ${wsConnected ? 'green' : 'amber'}`} />
          <span className="pixel-title" style={{ fontSize: 11, color: '#ffd147' }}>
            {t.appTitle}
          </span>
          <span className="pixel-badge" style={{ color: wsConnected ? '#3be87a' : '#ffbe3b' }}>
            {wsConnected ? t.hud.wsConnected : t.hud.wsReconnecting}
          </span>
        </div>

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

            {/* Active / Waiting counters */}
            <span className="pixel-badge" style={{ color: '#3be87a' }}>
              ● {floor.activeCount} {t.hud.active}
            </span>
            <span className="pixel-badge" style={{ color: '#ffbe3b' }}>
              ◐ {floor.waitingCount} {t.hud.waiting}
            </span>
          </div>
        )}
      </div>

      {/* Right: Eco Score + Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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

        {/* Demo Mode */}
        <button
          type="button"
          className={`pixel-btn ${demoMode ? 'active' : ''}`}
          onClick={() => {
            playSelectBlip();
            onToggleDemo();
          }}
        >
          {demoMode ? t.hud.demoOn : t.hud.demoOff}
        </button>

        {/* Day / Night */}
        <button
          type="button"
          className="pixel-btn"
          onClick={() => {
            playSelectBlip();
            onToggleNight();
          }}
        >
          {isNight ? t.hud.nightMode : t.hud.dayMode}
        </button>

        {/* SFX Mute */}
        <button type="button" className="pixel-btn" onClick={onToggleMute}>
          {muted ? t.hud.soundOff : t.hud.soundOn}
        </button>

        {/* Language Switcher */}
        <button
          type="button"
          className="pixel-btn"
          onClick={() => {
            playSelectBlip();
            setLocale(locale === 'tr' ? 'en' : 'tr');
          }}
        >
          {locale === 'tr' ? 'TR | EN' : 'EN | TR'}
        </button>
      </div>
    </header>
  );
};
