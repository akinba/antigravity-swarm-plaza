import React, { useEffect, useState } from 'react';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  type AntiAliasingMode,
  type CloudProviderId,
  type FpsLimitMode,
  type GraphicsPreset,
  type GraphicsSettings,
  type LocalAgentConfig,
  type LocalProviderId,
  type ProviderModelInfo,
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

export const GEMINI_MODELS_STORAGE_KEY = 'swarm_plaza_gemini_models';
export const PROVIDER_MODELS_STORAGE_KEY = 'swarm_plaza_provider_models';

export const CLOUD_PROVIDER_TABS: Array<{ id: CloudProviderId; label: string; icon: string }> = [
  { id: 'gemini', label: 'Gemini', icon: '✨' },
  { id: 'openai', label: 'OpenAI', icon: '⚡' },
  { id: 'anthropic', label: 'Anthropic', icon: '🧠' },
  { id: 'openrouter', label: 'OpenRouter', icon: '🌐' },
  { id: 'copilot', label: 'GitHub Copilot', icon: '🐙' },
];

export function loadStoredProviderModels(): Partial<Record<CloudProviderId, ProviderModelInfo[]>> {
  try {
    const raw = localStorage.getItem(PROVIDER_MODELS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Partial<Record<CloudProviderId, ProviderModelInfo[]>>;
      }
    }
    // Migrate legacy Gemini-only storage if present
    const legacyRaw = localStorage.getItem(GEMINI_MODELS_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
        return {
          gemini: legacyParsed.map((m: { id: string; displayName?: string; description?: string }) => ({
            id: m.id,
            displayName: m.displayName || m.id,
            provider: 'gemini' as const,
            description: m.description,
          })),
        };
      }
    }
    return {};
  } catch {
    return {};
  }
}

export function saveStoredProviderModels(
  models: Partial<Record<CloudProviderId, ProviderModelInfo[]>>,
): void {
  try {
    localStorage.setItem(PROVIDER_MODELS_STORAGE_KEY, JSON.stringify(models));
  } catch {
    // ignore storage errors
  }
}

export function deriveMentionFromModel(model: string, provider: LocalProviderId = 'ollama'): string {
  const base = model.split(':')[0] ?? model;
  const cleaned = base.replace(/[^a-zA-Z0-9_.-]/g, '-').toLowerCase();
  return cleaned ? `local-${cleaned}` : `local-${provider}`;
}

interface SettingsModalProps {
  graphicsSettings: GraphicsSettings;
  onChangeGraphics: (next: GraphicsSettings) => void;
  localAgents: LocalAgentConfig[];
  onChangeLocalAgents: (next: LocalAgentConfig[]) => void;
  providerModels: Partial<Record<CloudProviderId, ProviderModelInfo[]>>;
  onChangeProviderModels: (next: Partial<Record<CloudProviderId, ProviderModelInfo[]>>) => void;
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
  providerModels,
  onChangeProviderModels,
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
  const [activeTab, setActiveTab] = useState<'graphics' | 'models'>('graphics');
  const [activeCloudProvider, setActiveCloudProvider] = useState<CloudProviderId>('gemini');
  const [keyStatuses, setKeyStatuses] = useState<
    Partial<Record<CloudProviderId, { configured: boolean; masked: string; source: 'env' | 'settings' | 'none' }>>
  >({});
  const [cloudKeyDraft, setCloudKeyDraft] = useState('');
  const [showCloudKey, setShowCloudKey] = useState(false);
  const [cloudKeySaving, setCloudKeySaving] = useState(false);
  const [cloudKeyNotice, setCloudKeyNotice] = useState<string | null>(null);
  const [fetchingCloudModels, setFetchingCloudModels] = useState(false);
  const [cloudModelsError, setCloudModelsError] = useState<string | null>(null);

  const [localProvider, setLocalProvider] = useState<LocalProviderId>('ollama');
  const [localUrl, setLocalUrl] = useState('http://localhost:11434');
  const [fetchedLocalModels, setFetchedLocalModels] = useState<ProviderModelInfo[]>([]);
  const [fetchingLocalModels, setFetchingLocalModels] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [modelDraft, setModelDraft] = useState('');

  const activeKeyStatus = keyStatuses[activeCloudProvider] ?? {
    configured: false,
    masked: '',
    source: 'none' as const,
  };
  const activeCloudModels = providerModels[activeCloudProvider] ?? [];

  const handleFetchCloudModels = async (provider: CloudProviderId = activeCloudProvider) => {
    playSelectBlip();
    setFetchingCloudModels(true);
    setCloudModelsError(null);
    try {
      const res = await fetch(`/api/providers/models?provider=${encodeURIComponent(provider)}`);
      const data = (await res.json()) as {
        ok?: boolean;
        models?: ProviderModelInfo[];
        error?: string;
      };
      if (data.ok && Array.isArray(data.models)) {
        onChangeProviderModels({ ...providerModels, [provider]: data.models });
      } else {
        setCloudModelsError(data.error || `Failed to fetch ${provider} models`);
      }
    } catch {
      setCloudModelsError(`Failed to fetch ${provider} models`);
    } finally {
      setFetchingCloudModels(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings/provider-key?provider=${encodeURIComponent(activeCloudProvider)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setKeyStatuses((prev) => ({
          ...prev,
          [activeCloudProvider]: {
            configured: Boolean(data.configured),
            masked: typeof data.masked === 'string' ? data.masked : '',
            source: data.source ?? 'none',
          },
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeCloudProvider]);

  const handleSaveCloudKey = async (apiKey: string) => {
    playSelectBlip();
    setCloudKeySaving(true);
    setCloudKeyNotice(null);
    setCloudModelsError(null);
    const targetProvider = activeCloudProvider;
    try {
      const res = await fetch('/api/settings/provider-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: targetProvider, apiKey }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          configured?: boolean;
          masked?: string;
          source?: 'env' | 'settings' | 'none';
        };
        setKeyStatuses((prev) => ({
          ...prev,
          [targetProvider]: {
            configured: Boolean(data.configured),
            masked: data.masked ?? '',
            source: data.source ?? 'none',
          },
        }));
        setCloudKeyDraft('');
        setCloudKeyNotice(t.settingsModal.geminiKeySaved);
        if (!apiKey) {
          onChangeProviderModels({ ...providerModels, [targetProvider]: [] });
        } else {
          await handleFetchCloudModels(targetProvider);
        }
      }
    } finally {
      setCloudKeySaving(false);
    }
  };

  const handleFetchLocalModels = async () => {
    playSelectBlip();
    setFetchingLocalModels(true);
    setLocalError(null);
    const defaultUrl =
      localProvider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434';
    try {
      const res = await fetch(
        `/api/providers/models?provider=${encodeURIComponent(localProvider)}&baseUrl=${encodeURIComponent(localUrl.trim() || defaultUrl)}`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        models?: ProviderModelInfo[];
        error?: string;
      };
      if (data.ok && Array.isArray(data.models) && data.models.length > 0) {
        setFetchedLocalModels(data.models);
        setModelDraft(data.models[0].id);
      } else {
        setFetchedLocalModels([]);
        setModelDraft('');
        setLocalError(data.error || t.settingsModal.localOfflineHint);
      }
    } catch {
      setFetchedLocalModels([]);
      setModelDraft('');
      setLocalError(t.settingsModal.localOfflineHint);
    } finally {
      setFetchingLocalModels(false);
    }
  };

  const handleAddLocalAgent = () => {
    const model = modelDraft.trim();
    if (!model) return;
    playSelectBlip();
    const defaultUrl =
      localProvider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434';
    const nextAgent: LocalAgentConfig = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Local ${model}`,
      mention: deriveMentionFromModel(model, localProvider),
      provider: localProvider,
      model,
      baseUrl: localUrl.trim() || defaultUrl,
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

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, borderBottom: '2px solid #0a0c14', paddingBottom: 8 }}>
          <button
            type="button"
            className={`pixel-btn ${activeTab === 'graphics' ? 'cyan' : ''}`}
            style={{ fontSize: 10, padding: '6px 12px' }}
            onClick={() => {
              playSelectBlip();
              setActiveTab('graphics');
            }}
          >
            {t.settingsModal.tabGraphicsSystem}
          </button>
          <button
            type="button"
            className={`pixel-btn ${activeTab === 'models' ? 'cyan' : ''}`}
            style={{ fontSize: 10, padding: '6px 12px' }}
            onClick={() => {
              playSelectBlip();
              setActiveTab('models');
            }}
          >
            {t.settingsModal.tabModelsAgents}
          </button>
        </div>

        {activeTab === 'graphics' && (
          <>
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
          </>
        )}

        {activeTab === 'models' && (
          <>
            {/* Cloud Providers (Gemini, OpenAI, Anthropic, OpenRouter, GitHub Copilot) */}
            <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span className="pixel-title" style={{ fontSize: 9, color: '#ffd147' }}>
                  {t.settingsModal.cloudProvidersSection}
                </span>
                <span
                  className="pixel-badge"
                  style={{
                    fontSize: 9,
                    color: activeKeyStatus.configured ? '#3be87a' : 'var(--text-dim)',
                  }}
                >
                  {activeKeyStatus.configured
                    ? `✓ ${activeKeyStatus.masked} (${activeKeyStatus.source})`
                    : t.settingsModal.geminiKeyNotConfigured}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CLOUD_PROVIDER_TABS.map((p) => {
                  const count = providerModels[p.id]?.length ?? 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`pixel-btn ${activeCloudProvider === p.id ? 'cyan' : ''}`}
                      style={{ fontSize: 9, padding: '4px 8px' }}
                      onClick={() => {
                        playSelectBlip();
                        setActiveCloudProvider(p.id);
                        setCloudKeyDraft('');
                        setCloudKeyNotice(null);
                        setCloudModelsError(null);
                      }}
                    >
                      {p.icon} {p.label}
                      {count > 0 ? ` (${count})` : ''}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type={showCloudKey ? 'text' : 'password'}
                  value={cloudKeyDraft}
                  onChange={(e) => setCloudKeyDraft(e.target.value)}
                  placeholder={t.settingsModal.providerKeyPlaceholder.replace(
                    '{provider}',
                    CLOUD_PROVIDER_TABS.find((p) => p.id === activeCloudProvider)?.label ?? activeCloudProvider,
                  )}
                  aria-label={t.settingsModal.cloudProvidersSection}
                  className="retro-dock-select"
                  style={{ flex: 1, minWidth: 190, maxWidth: 'none', cursor: 'text' }}
                />
                <button
                  type="button"
                  className="pixel-btn"
                  style={{ fontSize: 9, padding: '5px 8px' }}
                  onClick={() => {
                    playSelectBlip();
                    setShowCloudKey((prev) => !prev);
                  }}
                >
                  {showCloudKey ? t.settingsModal.geminiKeyHide : t.settingsModal.geminiKeyShow}
                </button>
                <button
                  type="button"
                  className="pixel-btn cyan"
                  style={{ fontSize: 9, padding: '5px 10px' }}
                  disabled={cloudKeySaving || !cloudKeyDraft.trim()}
                  onClick={() => void handleSaveCloudKey(cloudKeyDraft.trim())}
                >
                  {t.settingsModal.geminiKeySave}
                </button>
                <button
                  type="button"
                  className="pixel-btn danger"
                  style={{ fontSize: 9, padding: '5px 10px' }}
                  disabled={cloudKeySaving}
                  onClick={() => void handleSaveCloudKey('')}
                >
                  {t.settingsModal.geminiKeyClear}
                </button>
                <button
                  type="button"
                  className="pixel-btn active"
                  style={{ fontSize: 9, padding: '5px 10px' }}
                  disabled={fetchingCloudModels || !activeKeyStatus.configured}
                  onClick={() => void handleFetchCloudModels(activeCloudProvider)}
                >
                  {fetchingCloudModels
                    ? t.settingsModal.fetchingModelsBtn
                    : t.settingsModal.fetchGeminiModelsBtn}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {t.settingsModal.providerKeyHint}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {activeCloudModels.length > 0 && (
                    <span style={{ fontSize: 10, color: '#3cd8ff' }}>
                      {t.settingsModal.providerModelsCount
                        .replace('{n}', String(activeCloudModels.length))
                        .replace(
                          '{provider}',
                          CLOUD_PROVIDER_TABS.find((p) => p.id === activeCloudProvider)?.label ?? activeCloudProvider,
                        )}
                    </span>
                  )}
                  {cloudModelsError && (
                    <span style={{ fontSize: 10, color: 'var(--accent-amber)' }}>
                      ⚠ {cloudModelsError}
                    </span>
                  )}
                  {cloudKeyNotice && (
                    <span style={{ fontSize: 10, color: '#3be87a' }}>{cloudKeyNotice}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Local Agents (Ollama / LM Studio) */}
            <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span className="pixel-title" style={{ fontSize: 9, color: '#3cd8ff' }}>
                  {t.settingsModal.localAgentsMultiSection}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className={`pixel-btn ${localProvider === 'ollama' ? 'cyan' : ''}`}
                    style={{ fontSize: 9, padding: '3px 8px' }}
                    onClick={() => {
                      playSelectBlip();
                      setLocalProvider('ollama');
                      if (localUrl.trim() === 'http://localhost:1234') {
                        setLocalUrl('http://localhost:11434');
                      }
                      setFetchedLocalModels([]);
                      setModelDraft('');
                      setLocalError(null);
                    }}
                  >
                    🦙 Ollama
                  </button>
                  <button
                    type="button"
                    className={`pixel-btn ${localProvider === 'lmstudio' ? 'cyan' : ''}`}
                    style={{ fontSize: 9, padding: '3px 8px' }}
                    onClick={() => {
                      playSelectBlip();
                      setLocalProvider('lmstudio');
                      if (localUrl.trim() === 'http://localhost:11434') {
                        setLocalUrl('http://localhost:1234');
                      }
                      setFetchedLocalModels([]);
                      setModelDraft('');
                      setLocalError(null);
                    }}
                  >
                    💻 LM Studio
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  aria-label={t.settingsModal.localBaseUrlLabel}
                  className="retro-dock-select"
                  style={{ flex: 1, minWidth: 190, cursor: 'text' }}
                />
                <button
                  type="button"
                  className="pixel-btn cyan"
                  style={{ fontSize: 9, padding: '5px 10px' }}
                  disabled={fetchingLocalModels}
                  onClick={() => void handleFetchLocalModels()}
                >
                  {fetchingLocalModels ? t.settingsModal.fetchingModelsBtn : t.settingsModal.fetchModelsBtn}
                </button>
              </div>

              {localError && (
                <div style={{ fontSize: 10, color: 'var(--accent-amber)' }}>
                  ⚠ {localError}
                </div>
              )}

              {fetchedLocalModels.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    aria-label={t.settingsModal.ollamaModelLabel}
                    className="retro-dock-select"
                    style={{ flex: 1, minWidth: 190, maxWidth: 'none' }}
                    value={modelDraft}
                    onChange={(e) => setModelDraft(e.target.value)}
                  >
                    {fetchedLocalModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName || m.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="pixel-btn active"
                    style={{ fontSize: 9, padding: '5px 12px' }}
                    disabled={!modelDraft}
                    onClick={handleAddLocalAgent}
                  >
                    {t.settingsModal.addLocalAgentBtn}
                  </button>
                </div>
              )}

              {localAgents.length === 0 ? (
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {t.settingsModal.noLocalAgents}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {localAgents.map((agent) => (
                    <div key={agent.id} className="retro-dock-diff-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="pixel-badge" style={{ fontSize: 8, color: '#ffbe3b' }}>
                          {agent.provider === 'lmstudio' ? '💻 LM STUDIO' : '🦙 OLLAMA'}
                        </span>
                        <span style={{ color: '#3be87a' }}>{agent.name}</span>
                        <span className="pixel-badge" style={{ fontSize: 9, color: '#3cd8ff' }}>
                          @{agent.mention}
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
          </>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: activeTab === 'graphics' ? 'space-between' : 'flex-end', gap: 8 }}>
          {activeTab === 'graphics' && (
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
          )}
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
