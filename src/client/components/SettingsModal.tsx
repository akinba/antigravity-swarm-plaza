import React from 'react';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  type AntiAliasingMode,
  type FpsLimitMode,
  type GraphicsPreset,
  type GraphicsSettings,
  type ResolutionScaleMode,
} from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

interface SettingsModalProps {
  graphicsSettings: GraphicsSettings;
  onChangeGraphics: (next: GraphicsSettings) => void;
  liveFps: number;
  followCam: boolean;
  onToggleFollowCam: () => void;
  isNight: boolean;
  onToggleNight: () => void;
  demoMode: boolean;
  onToggleDemo: () => void;
  muted: boolean;
  onToggleMute: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  onClose: () => void;
}

const PRESET_CONFIGS: Record<Exclude<GraphicsPreset, 'custom'>, GraphicsSettings> = {
  classic60: {
    preset: 'classic60',
    resolution: 'high',
    antiAliasing: 'crisp',
    fpsLimit: '60',
    staticCache: true,
  },
  balanced: {
    preset: 'balanced',
    resolution: 'medium',
    antiAliasing: 'crisp',
    fpsLimit: '30',
    staticCache: true,
  },
  eco: {
    preset: 'eco',
    resolution: 'medium',
    antiAliasing: 'crisp',
    fpsLimit: 'eco',
    staticCache: true,
  },
  ultra: {
    preset: 'ultra',
    resolution: 'native',
    antiAliasing: 'smooth',
    fpsLimit: 'unlimited',
    staticCache: true,
  },
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  graphicsSettings,
  onChangeGraphics,
  liveFps,
  followCam,
  onToggleFollowCam,
  isNight,
  onToggleNight,
  demoMode,
  onToggleDemo,
  muted,
  onToggleMute,
  notificationsEnabled,
  onToggleNotifications,
  onClose,
}) => {
  const { locale, setLocale, t } = useI18n();

  const applyPreset = (preset: Exclude<GraphicsPreset, 'custom'>) => {
    playSelectBlip();
    onChangeGraphics({ ...PRESET_CONFIGS[preset] });
  };

  const updateField = <K extends keyof Omit<GraphicsSettings, 'preset'>>(
    key: K,
    value: GraphicsSettings[K],
  ) => {
    playSelectBlip();
    onChangeGraphics({
      ...graphicsSettings,
      [key]: value,
      preset: 'custom',
    });
  };

  const presetButtons: Array<{ id: Exclude<GraphicsPreset, 'custom'>; label: string }> = [
    { id: 'classic60', label: t.settingsModal.presetClassic60 },
    { id: 'balanced', label: t.settingsModal.presetBalanced },
    { id: 'eco', label: t.settingsModal.presetEco },
    { id: 'ultra', label: t.settingsModal.presetUltra },
  ];

  const resolutionOptions: Array<{ id: ResolutionScaleMode; label: string }> = [
    { id: 'low', label: t.settingsModal.resLow },
    { id: 'medium', label: t.settingsModal.resMedium },
    { id: 'high', label: t.settingsModal.resHigh },
    { id: 'native', label: t.settingsModal.resNative },
  ];

  const aaOptions: Array<{ id: AntiAliasingMode; label: string }> = [
    { id: 'crisp', label: t.settingsModal.aaCrisp },
    { id: 'smooth', label: t.settingsModal.aaSmooth },
  ];

  const fpsOptions: Array<{ id: FpsLimitMode; label: string }> = [
    { id: 'eco', label: t.settingsModal.fpsEco },
    { id: '30', label: t.settingsModal.fps30 },
    { id: '60', label: t.settingsModal.fps60 },
    { id: 'unlimited', label: t.settingsModal.fpsUnlimited },
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="pixel-title" style={{ fontSize: 12, color: '#ffd147' }}>
              {t.settingsModal.title}
            </span>
            <span style={{ fontSize: 11, color: '#9aa7c7' }}>{t.settingsModal.subtitle}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="pixel-badge"
              style={{
                color: '#3be87a',
                background: '#13281d',
                borderColor: '#2d7a4f',
                fontFamily: 'monospace',
              }}
            >
              {t.settingsModal.liveFpsLabel}: {liveFps}
            </span>
            <button
              type="button"
              className="pixel-btn danger"
              onClick={() => {
                playSelectBlip();
                onClose();
              }}
            >
              {t.settingsModal.close}
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span className="pixel-title" style={{ fontSize: 9, color: '#3cd8ff' }}>
              {t.settingsModal.presetLabel}
            </span>
            {graphicsSettings.preset === 'custom' && (
              <span className="pixel-badge" style={{ color: '#ffd147', borderColor: '#786221' }}>
                {t.settingsModal.presetCustom}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {presetButtons.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pixel-btn ${graphicsSettings.preset === p.id ? 'gold' : ''}`}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Display & Performance */}
        <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pixel-title" style={{ fontSize: 9, color: '#ffd147' }}>
            {t.settingsModal.graphicsSection}
          </span>

          {/* Resolution */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#dce6ff' }}>{t.settingsModal.resolutionLabel}</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {resolutionOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`pixel-btn ${graphicsSettings.resolution === opt.id ? 'cyan' : ''}`}
                  style={{ fontSize: 10, padding: '4px 8px' }}
                  onClick={() => updateField('resolution', opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Anti-Aliasing */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#dce6ff' }}>{t.settingsModal.antiAliasingLabel}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {aaOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`pixel-btn ${graphicsSettings.antiAliasing === opt.id ? 'cyan' : ''}`}
                  style={{ fontSize: 10, padding: '4px 8px' }}
                  onClick={() => updateField('antiAliasing', opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* FPS Limit */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#dce6ff' }}>{t.settingsModal.fpsLimitLabel}</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {fpsOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`pixel-btn ${graphicsSettings.fpsLimit === opt.id ? 'cyan' : ''}`}
                  style={{ fontSize: 10, padding: '4px 8px' }}
                  onClick={() => updateField('fpsLimit', opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Static Cache */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#dce6ff' }}>{t.settingsModal.staticCacheLabel}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className={`pixel-btn ${graphicsSettings.staticCache ? 'active' : ''}`}
                style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={() => updateField('staticCache', true)}
              >
                {t.settingsModal.on}
              </button>
              <button
                type="button"
                className={`pixel-btn ${!graphicsSettings.staticCache ? 'danger' : ''}`}
                style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={() => updateField('staticCache', false)}
              >
                {t.settingsModal.off}
              </button>
            </div>
          </div>
        </div>

        {/* System & Environment */}
        <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="pixel-title" style={{ fontSize: 9, color: '#3be87a' }}>
            {t.settingsModal.systemSection}
          </span>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#dce6ff' }}>{t.settingsModal.followCamLabel}</span>
              <button
                type="button"
                className={`pixel-btn ${followCam ? 'active' : ''}`}
                style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={() => {
                  playSelectBlip();
                  onToggleFollowCam();
                }}
              >
                {followCam ? t.settingsModal.on : t.settingsModal.off}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#dce6ff' }}>{t.settingsModal.themeLabel}</span>
              <button
                type="button"
                className="pixel-btn"
                style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={() => {
                  playSelectBlip();
                  onToggleNight();
                }}
              >
                {isNight ? t.settingsModal.themeNight : t.settingsModal.themeDay}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#dce6ff' }}>{t.settingsModal.demoModeLabel}</span>
              <button
                type="button"
                className={`pixel-btn ${demoMode ? 'active' : ''}`}
                style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={() => {
                  playSelectBlip();
                  onToggleDemo();
                }}
              >
                {demoMode ? t.settingsModal.on : t.settingsModal.off}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#dce6ff' }}>{t.settingsModal.sfxLabel}</span>
              <button
                type="button"
                className={`pixel-btn ${!muted ? 'active' : ''}`}
                style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={onToggleMute}
              >
                {!muted ? t.settingsModal.on : t.settingsModal.off}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#dce6ff' }}>{t.settingsModal.notificationsLabel}</span>
              <button
                type="button"
                className={`pixel-btn ${notificationsEnabled ? 'active' : ''}`}
                style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={() => {
                  playSelectBlip();
                  onToggleNotifications();
                }}
              >
                {notificationsEnabled ? t.settingsModal.on : t.settingsModal.off}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#dce6ff' }}>{t.settingsModal.languageLabel}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className={`pixel-btn ${locale === 'tr' ? 'cyan' : ''}`}
                  style={{ fontSize: 10, padding: '4px 8px' }}
                  onClick={() => {
                    playSelectBlip();
                    setLocale('tr');
                  }}
                >
                  TR
                </button>
                <button
                  type="button"
                  className={`pixel-btn ${locale === 'en' ? 'cyan' : ''}`}
                  style={{ fontSize: 10, padding: '4px 8px' }}
                  onClick={() => {
                    playSelectBlip();
                    setLocale('en');
                  }}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button
            type="button"
            className="pixel-btn"
            onClick={() => {
              playSelectBlip();
              onChangeGraphics({ ...DEFAULT_GRAPHICS_SETTINGS });
            }}
          >
            {t.settingsModal.resetDefaults}
          </button>
          <button
            type="button"
            className="pixel-btn gold"
            onClick={() => {
              playSelectBlip();
              onClose();
            }}
          >
            {t.settingsModal.close}
          </button>
        </div>
      </div>
    </div>
  );
};
