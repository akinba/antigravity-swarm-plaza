import React, { useEffect, useState } from 'react';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  type AntiAliasingMode,
  type FpsLimitMode,
  type GraphicsPreset,
  type GraphicsSettings,
  type LocalAgentConfig,
  type OllamaModelInfo,
  type ResolutionScaleMode,
} from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

export const LOCAL_AGENTS_STORAGE_KEY = 'swarm_plaza_local_agents';

export function loadStoredLocalAgents(): LocalAgentConfig[] {
  try {
    const raw = localStorage.getItem(LOCAL_AGENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalAgentConfig =>
        Boolean(item && typeof item.id === 'string' && typeof item.model === 'string'),
    );
  } catch {
    return [];
  }
}

export function saveStoredLocalAgents(agents: LocalAgentConfig[]): void {
  try {
    localStorage.setItem(LOCAL_AGENTS_STORAGE_KEY, JSON.stringify(agents));
  } catch {
    // ignore storage errors
  }
}

export function deriveMentionFromModel(model: string): string {
  const base = model.split(':')[0] ?? model;
  const cleaned = base.replace(/[^a-zA-Z0-9_.-]/g, '-').toLowerCase();
  return cleaned ? `local-${cleaned}` : 'local-ollama';
}

interface SettingsModalProps {
  graphicsSettings: GraphicsSettings;
  onChangeGraphics: (next: GraphicsSettings) => void;
  localAgents: LocalAgentConfig[];
  onChangeLocalAgents: (next: LocalAgentConfig[]) => void;
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
  localAgents,
  onChangeLocalAgents,
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
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [fetchedModels, setFetchedModels] = useState<OllamaModelInfo[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [modelDraft, setModelDraft] = useState('qwen2.5-coder:14b');
  const [agentNameDraft, setAgentNameDraft] = useState('Local Qwen 2.5 Coder');
  const [mentionDraft, setMentionDraft] = useState('local-qwen2.5-coder');
  const [geminiKeyStatus, setGeminiKeyStatus] = useState<{
    configured: boolean;
    masked: string;
    source: 'env' | 'settings' | 'none';
  }>({ configured: false, masked: '', source: 'none' });
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeySaving, setGeminiKeySaving] = useState(false);
  const [geminiKeyNotice, setGeminiKeyNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/gemini-key')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setGeminiKeyStatus({
          configured: Boolean(data.configured),
          masked: typeof data.masked === 'string' ? data.masked : '',
          source: data.source ?? 'none',
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveGeminiKey = async (apiKey: string) => {
    playSelectBlip();
    setGeminiKeySaving(true);
    setGeminiKeyNotice(null);
    try {
      const res = await fetch('/api/settings/gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          configured?: boolean;
          masked?: string;
          source?: 'env' | 'settings' | 'none';
        };
        setGeminiKeyStatus({
          configured: Boolean(data.configured),
          masked: data.masked ?? '',
          source: data.source ?? 'none',
        });
        setGeminiKeyDraft('');
        setGeminiKeyNotice(t.settingsModal.geminiKeySaved);
      }
    } finally {
      setGeminiKeySaving(false);
    }
  };

  const handleSelectModel = (modelName: string) => {
    setModelDraft(modelName);
    setAgentNameDraft(`Local ${modelName}`);
    setMentionDraft(deriveMentionFromModel(modelName));
  };

  const handleFetchOllamaModels = async () => {
    playSelectBlip();
    setFetchingModels(true);
    setOllamaError(null);
    try {
      const res = await fetch(
        `/api/ollama/models?baseUrl=${encodeURIComponent(ollamaUrl.trim() || 'http://localhost:11434')}`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        models?: OllamaModelInfo[];
        error?: string;
      };
      if (data.ok && Array.isArray(data.models) && data.models.length > 0) {
        setFetchedModels(data.models);
        handleSelectModel(data.models[0].name);
      } else {
        setFetchedModels([]);
        setOllamaError(data.error || t.settingsModal.ollamaOfflineHint);
      }
    } catch {
      setFetchedModels([]);
      setOllamaError(t.settingsModal.ollamaOfflineHint);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleAddLocalAgent = () => {
    const model = modelDraft.trim();
    if (!model) return;
    playSelectBlip();
    const cleanMention = (mentionDraft.trim() || deriveMentionFromModel(model)).replace(/^@/, '');
    const nextAgent: LocalAgentConfig = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: agentNameDraft.trim() || `Local ${model}`,
      mention: cleanMention,
      provider: 'ollama',
      model,
      baseUrl: ollamaUrl.trim() || 'http://localhost:11434',
      enabled: true,
    };
    onChangeLocalAgents([...localAgents, nextAgent]);
  };

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

        {/* Local Agents (Ollama) */}
        <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span className="pixel-title" style={{ fontSize: 9, color: '#3cd8ff' }}>
              {t.settingsModal.localAgentsSection}
            </span>
            <span className="pixel-badge" style={{ fontSize: 9, color: '#ffbe3b' }}>
              {t.settingsModal.localProviderLabel}: Ollama
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              aria-label={t.settingsModal.ollamaUrlLabel}
              className="retro-dock-select"
              style={{ flex: 1, minWidth: 190, cursor: 'text' }}
            />
            <button
              type="button"
              className="pixel-btn cyan"
              style={{ fontSize: 9, padding: '5px 10px' }}
              disabled={fetchingModels}
              onClick={() => void handleFetchOllamaModels()}
            >
              {fetchingModels ? t.settingsModal.fetchingModelsBtn : t.settingsModal.fetchModelsBtn}
            </button>
          </div>

          {ollamaError && (
            <div style={{ fontSize: 10, color: 'var(--accent-amber)' }}>
              ⚠ {ollamaError}
            </div>
          )}

          {fetchedModels.length > 0 && (
            <select
              aria-label={t.settingsModal.ollamaModelLabel}
              className="retro-dock-select"
              style={{ width: '100%', maxWidth: 'none' }}
              value={modelDraft}
              onChange={(e) => handleSelectModel(e.target.value)}
            >
              {fetchedModels.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                  {typeof m.size === 'number' ? ` (${(m.size / 1e9).toFixed(1)} GB)` : ''}
                </option>
              ))}
            </select>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 6 }}>
            <input
              type="text"
              value={modelDraft}
              onChange={(e) => setModelDraft(e.target.value)}
              placeholder={t.settingsModal.manualModelPlaceholder}
              aria-label={t.settingsModal.ollamaModelLabel}
              className="retro-dock-select"
              style={{ maxWidth: 'none', cursor: 'text' }}
            />
            <input
              type="text"
              value={agentNameDraft}
              onChange={(e) => setAgentNameDraft(e.target.value)}
              placeholder={t.settingsModal.agentNameLabel}
              aria-label={t.settingsModal.agentNameLabel}
              className="retro-dock-select"
              style={{ maxWidth: 'none', cursor: 'text' }}
            />
            <input
              type="text"
              value={mentionDraft}
              onChange={(e) => setMentionDraft(e.target.value)}
              placeholder={t.settingsModal.mentionLabel}
              aria-label={t.settingsModal.mentionLabel}
              className="retro-dock-select"
              style={{ maxWidth: 'none', cursor: 'text' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="pixel-btn active"
              style={{ fontSize: 9, padding: '5px 12px' }}
              onClick={handleAddLocalAgent}
            >
              {t.settingsModal.addLocalAgentBtn}
            </button>
          </div>

          {localAgents.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {t.settingsModal.noLocalAgents}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {localAgents.map((agent) => (
                <div key={agent.id} className="retro-dock-diff-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: '#3be87a' }}>{agent.name}</span>
                    <span className="pixel-badge" style={{ fontSize: 9, color: '#3cd8ff' }}>
                      @{agent.mention}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                      ollama:{agent.model}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pixel-btn danger"
                    style={{ fontSize: 8, padding: '2px 6px' }}
                    onClick={() => {
                      playSelectBlip();
                      onChangeLocalAgents(localAgents.filter((a) => a.id !== agent.id));
                    }}
                  >
                    {t.settingsModal.removeAgentBtn}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gemini API Key */}
        <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span className="pixel-title" style={{ fontSize: 9, color: '#ffd147' }}>
              {t.settingsModal.geminiKeySection}
            </span>
            <span
              className="pixel-badge"
              style={{
                fontSize: 9,
                color: geminiKeyStatus.configured ? '#3be87a' : 'var(--text-dim)',
              }}
            >
              {geminiKeyStatus.configured
                ? `✓ ${geminiKeyStatus.masked} (${geminiKeyStatus.source})`
                : t.settingsModal.geminiKeyNotConfigured}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type={showGeminiKey ? 'text' : 'password'}
              value={geminiKeyDraft}
              onChange={(e) => setGeminiKeyDraft(e.target.value)}
              placeholder={t.settingsModal.geminiKeyPlaceholder}
              aria-label={t.settingsModal.geminiKeySection}
              className="retro-dock-select"
              style={{ flex: 1, minWidth: 200, maxWidth: 'none', cursor: 'text' }}
            />
            <button
              type="button"
              className="pixel-btn"
              style={{ fontSize: 9, padding: '5px 8px' }}
              onClick={() => {
                playSelectBlip();
                setShowGeminiKey((prev) => !prev);
              }}
            >
              {showGeminiKey ? t.settingsModal.geminiKeyHide : t.settingsModal.geminiKeyShow}
            </button>
            <button
              type="button"
              className="pixel-btn cyan"
              style={{ fontSize: 9, padding: '5px 10px' }}
              disabled={geminiKeySaving || !geminiKeyDraft.trim()}
              onClick={() => void handleSaveGeminiKey(geminiKeyDraft.trim())}
            >
              {t.settingsModal.geminiKeySave}
            </button>
            <button
              type="button"
              className="pixel-btn danger"
              style={{ fontSize: 9, padding: '5px 10px' }}
              disabled={geminiKeySaving}
              onClick={() => void handleSaveGeminiKey('')}
            >
              {t.settingsModal.geminiKeyClear}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {t.settingsModal.geminiKeyHint}
            </span>
            {geminiKeyNotice && (
              <span style={{ fontSize: 10, color: '#3be87a' }}>{geminiKeyNotice}</span>
            )}
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
