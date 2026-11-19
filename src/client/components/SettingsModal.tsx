import React, { useEffect, useState } from 'react';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  type AntiAliasingMode,
  type CloudProviderId,
  type ConnectedAccountInfo,
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
export const CUSTOM_BASE_URL_STORAGE_KEY = 'swarm_plaza_custom_base_url';

export function loadStoredCustomBaseUrl(): string {
  try {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(CUSTOM_BASE_URL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveStoredCustomBaseUrl(url: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (url.trim()) {
      localStorage.setItem(CUSTOM_BASE_URL_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(CUSTOM_BASE_URL_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export const CLOUD_PROVIDER_TABS: Array<{ id: CloudProviderId; label: string; icon: string }> = [
  { id: 'gemini', label: 'Gemini', icon: '✨' },
  { id: 'openai', label: 'OpenAI', icon: '⚡' },
  { id: 'anthropic', label: 'Anthropic', icon: '🧠' },
  { id: 'openrouter', label: 'OpenRouter', icon: '🌐' },
  { id: 'deepseek', label: 'DeepSeek', icon: '🐋' },
  { id: 'groq', label: 'Groq', icon: '⚡' },
  { id: 'xai', label: 'xAI Grok', icon: '✖' },
  { id: 'mistral', label: 'Mistral', icon: '🌬' },
  { id: 'copilot', label: 'GitHub Copilot', icon: '🐙' },
  { id: 'custom', label: 'Custom URL', icon: '🔧' },
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
  initialTab?: 'graphics' | 'models' | 'accounts';
  onAccountsChanged?: () => void;
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
  initialTab = 'graphics',
  onAccountsChanged,
  onClose,
}) => {
  const { locale, setLocale, t } = useI18n();
  const [activeTab, setActiveTab] = useState<'graphics' | 'models' | 'accounts'>(initialTab);
  const [googleAccount, setGoogleAccount] = useState<ConnectedAccountInfo | null>(null);
  const [githubAccount, setGithubAccount] = useState<ConnectedAccountInfo | null>(null);
  const [googleClientIdDraft, setGoogleClientIdDraft] = useState('');
  const [googleClientSecretDraft, setGoogleClientSecretDraft] = useState('');
  const [githubClientIdDraft, setGithubClientIdDraft] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [deviceFlow, setDeviceFlow] = useState<{
    userCode: string;
    verificationUri: string;
    deviceCode: string;
    interval: number;
  } | null>(null);
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
  const [customBaseUrl, setCustomBaseUrl] = useState(() => loadStoredCustomBaseUrl());

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

  const handleFetchCloudModels = async (
    provider: CloudProviderId = activeCloudProvider,
    skipAutoSave = false,
  ) => {
    if (!skipAutoSave && provider === activeCloudProvider && cloudKeyDraft.trim()) {
      await handleSaveCloudKey(cloudKeyDraft.trim());
      return;
    }
    playSelectBlip();
    setFetchingCloudModels(true);
    setCloudModelsError(null);
    try {
      const baseUrlQuery =
        provider === 'custom' && customBaseUrl.trim()
          ? `&baseUrl=${encodeURIComponent(customBaseUrl.trim())}`
          : '';
      const res = await fetch(
        `/api/providers/models?provider=${encodeURIComponent(provider)}${baseUrlQuery}`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        models?: ProviderModelInfo[];
        error?: string;
      };
      if (res.ok && data.ok && Array.isArray(data.models)) {
        onChangeProviderModels({ ...providerModels, [provider]: data.models });
      } else {
        setCloudModelsError(data.error || `Failed to fetch ${provider} models`);
      }
    } catch (err) {
      setCloudModelsError(
        err instanceof Error ? err.message : `Failed to fetch ${provider} models`,
      );
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

  const fetchAccountsStatus = async () => {
    try {
      const res = await fetch('/api/auth/accounts');
      if (!res.ok) return;
      const data = (await res.json()) as {
        google?: ConnectedAccountInfo;
        github?: ConnectedAccountInfo;
      };
      if (data.google) setGoogleAccount(data.google);
      if (data.github) setGithubAccount(data.github);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (activeTab !== 'accounts') return;
    void fetchAccountsStatus();
    const onMsg = (ev: MessageEvent) => {
      if (ev.data && typeof ev.data === 'object' && ev.data.type === 'swarm_auth_complete') {
        void fetchAccountsStatus().then(() => onAccountsChanged?.());
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [activeTab]);

  useEffect(() => {
    if (!deviceFlow) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch('/api/auth/github/device/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceCode: deviceFlow.deviceCode,
            clientId: githubClientIdDraft.trim() || undefined,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          status?: 'pending' | 'connected' | 'error';
          account?: ConnectedAccountInfo;
          error?: string;
        };
        if (data.status === 'connected') {
          setDeviceFlow(null);
          if (data.account) setGithubAccount(data.account);
          onAccountsChanged?.();
        } else if (data.status === 'error') {
          setDeviceFlow(null);
          setAccountError(data.error || 'GitHub Device Flow failed');
        }
      } catch {
        // retry on next interval
      }
    }, Math.max(3, deviceFlow.interval || 5) * 1000);
    return () => window.clearInterval(timer);
  }, [deviceFlow, githubClientIdDraft]);

  const handleSaveGoogleClient = async () => {
    playSelectBlip();
    setAccountBusy(true);
    setAccountError(null);
    setAccountNotice(null);
    try {
      const res = await fetch('/api/auth/google/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: googleClientIdDraft.trim(),
          clientSecret: googleClientSecretDraft.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAccountError(data.error || `HTTP ${res.status}`);
        return;
      }
      setAccountNotice(t.settingsModal.geminiKeySaved);
      await fetchAccountsStatus();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Failed to save Google client');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleStartGoogleSignIn = async () => {
    playSelectBlip();
    setAccountBusy(true);
    setAccountError(null);
    try {
      const res = await fetch('/api/auth/google/start');
      const data = (await res.json()) as { ok?: boolean; authUrl?: string; error?: string };
      if (!res.ok || !data.authUrl) {
        setAccountError(data.error || `HTTP ${res.status}`);
        return;
      }
      window.open(data.authUrl, 'swarm_google_auth', 'width=540,height=680');
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Failed to start Google sign-in');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleImportGhCli = async () => {
    playSelectBlip();
    setAccountBusy(true);
    setAccountError(null);
    try {
      const res = await fetch('/api/auth/github/import-gh', { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; account?: ConnectedAccountInfo; error?: string };
      if (!res.ok || !data.ok) {
        setAccountError(data.error || `HTTP ${res.status}`);
        return;
      }
      if (data.account) setGithubAccount(data.account);
      onAccountsChanged?.();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Failed to import gh CLI session');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleStartGitHubDevice = async () => {
    playSelectBlip();
    setAccountBusy(true);
    setAccountError(null);
    try {
      const res = await fetch('/api/auth/github/device/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: githubClientIdDraft.trim() || undefined }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        userCode?: string;
        verificationUri?: string;
        deviceCode?: string;
        interval?: number;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.userCode || !data.deviceCode) {
        setAccountError(data.error || `HTTP ${res.status}`);
        return;
      }
      setDeviceFlow({
        userCode: data.userCode,
        verificationUri: data.verificationUri || 'https://github.com/login/device',
        deviceCode: data.deviceCode,
        interval: data.interval || 5,
      });
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Failed to start Device Flow');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDisconnectAccount = async (provider: 'google' | 'github') => {
    playSelectBlip();
    setAccountBusy(true);
    setAccountError(null);
    try {
      await fetch(`/api/auth/accounts/${provider}`, { method: 'DELETE' });
      await fetchAccountsStatus();
      onAccountsChanged?.();
    } finally {
      setAccountBusy(false);
    }
  };

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
        body: JSON.stringify({
          provider: targetProvider,
          apiKey,
          ...(targetProvider === 'custom' && customBaseUrl.trim()
            ? { baseUrl: customBaseUrl.trim() }
            : {}),
        }),
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
          await handleFetchCloudModels(targetProvider, true);
        }
      } else {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setCloudModelsError(
          errData.error || `Failed to save ${targetProvider} key (HTTP ${res.status})`,
        );
      }
    } catch (err) {
      setCloudModelsError(
        err instanceof Error ? err.message : `Failed to save ${targetProvider} key`,
      );
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
          <button
            type="button"
            className={`pixel-btn ${activeTab === 'accounts' ? 'cyan' : ''}`}
            style={{ fontSize: 10, padding: '6px 12px' }}
            onClick={() => {
              playSelectBlip();
              setActiveTab('accounts');
            }}
          >
            {t.settingsModal.tabAccounts}
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

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 4,
                }}
              >
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
                  disabled={
                    fetchingCloudModels ||
                    cloudKeySaving ||
                    (activeCloudProvider === 'custom'
                      ? !customBaseUrl.trim()
                      : activeCloudProvider !== 'copilot' &&
                        !activeKeyStatus.configured &&
                        !cloudKeyDraft.trim())
                  }
                  onClick={() => void handleFetchCloudModels(activeCloudProvider)}
                >
                  {fetchingCloudModels
                    ? t.settingsModal.fetchingModelsBtn
                    : t.settingsModal.fetchGeminiModelsBtn}
                </button>
              </div>

              {activeCloudProvider === 'custom' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#dce6ff', minWidth: 96 }}>
                    {t.settingsModal.customBaseUrlLabel}
                  </span>
                  <input
                    type="text"
                    value={customBaseUrl}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCustomBaseUrl(next);
                      saveStoredCustomBaseUrl(next);
                    }}
                    placeholder={t.settingsModal.customBaseUrlPlaceholder}
                    aria-label={t.settingsModal.customBaseUrlLabel}
                    className="retro-dock-select"
                    style={{ flex: 1, minWidth: 200, maxWidth: 'none', cursor: 'text' }}
                  />
                </div>
              )}

              {activeCloudProvider === 'gemini' && (
                <div style={{ fontSize: 10, color: '#9ee8ff' }}>
                  ✨ {t.settingsModal.geminiFormatsHint}
                </div>
              )}

              {activeCloudProvider === 'copilot' && (
                <div style={{ fontSize: 10, color: '#9ee8ff' }}>
                  🐙 {t.settingsModal.copilotSdkHint}
                </div>
              )}

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

              {activeCloudModels.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    maxHeight: 68,
                    overflowY: 'auto',
                    paddingTop: 2,
                  }}
                >
                  {activeCloudModels.map((m) => (
                    <span
                      key={m.id}
                      className="pixel-badge"
                      style={{ fontSize: 9, color: '#dce6ff' }}
                      title={m.description || m.id}
                    >
                      {m.displayName || m.id}
                    </span>
                  ))}
                </div>
              )}
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

        {activeTab === 'accounts' && (
          <>
            {accountError && (
              <div className="pixel-panel-inset" style={{ padding: '6px 10px', color: 'var(--accent-amber)', fontSize: 11 }}>
                ⚠ {accountError}
              </div>
            )}

            {/* Google Account */}
            <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span className="pixel-title" style={{ fontSize: 9, color: '#3cd8ff' }}>
                  {t.settingsModal.accountsGoogleTitle}
                </span>
                <span className="pixel-badge" style={{ fontSize: 9, color: googleAccount?.connected ? '#3be87a' : 'var(--text-dim)' }}>
                  {googleAccount?.connected
                    ? `✓ ${googleAccount.email || t.settingsModal.connectedBadge}`
                    : t.settingsModal.notConnectedBadge}
                </span>
              </div>

              <div style={{ fontSize: 10, color: '#9aa7c7', lineHeight: 1.4 }}>
                {t.settingsModal.accountsGoogleGuide}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  value={googleClientIdDraft}
                  onChange={(e) => setGoogleClientIdDraft(e.target.value)}
                  placeholder={t.settingsModal.googleClientIdPlaceholder}
                  className="retro-dock-select"
                  style={{ flex: 1, minWidth: 180, maxWidth: 'none', cursor: 'text' }}
                />
                <input
                  type="password"
                  value={googleClientSecretDraft}
                  onChange={(e) => setGoogleClientSecretDraft(e.target.value)}
                  placeholder={t.settingsModal.googleClientSecretPlaceholder}
                  className="retro-dock-select"
                  style={{ flex: 1, minWidth: 150, maxWidth: 'none', cursor: 'text' }}
                />
                <button
                  type="button"
                  className="pixel-btn cyan"
                  style={{ fontSize: 9, padding: '5px 10px' }}
                  disabled={accountBusy || !googleClientIdDraft.trim()}
                  onClick={() => void handleSaveGoogleClient()}
                >
                  {t.settingsModal.saveClientBtn}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="pixel-btn active"
                  style={{ fontSize: 9, padding: '5px 12px' }}
                  disabled={accountBusy}
                  onClick={() => void handleStartGoogleSignIn()}
                >
                  🔵 {t.settingsModal.signInGoogleBtn}
                </button>
                {googleAccount?.connected && (
                  <button
                    type="button"
                    className="pixel-btn danger"
                    style={{ fontSize: 9, padding: '5px 10px' }}
                    disabled={accountBusy}
                    onClick={() => void handleDisconnectAccount('google')}
                  >
                    {t.settingsModal.disconnectBtn}
                  </button>
                )}
                {accountNotice && (
                  <span style={{ fontSize: 10, color: '#3be87a' }}>{accountNotice}</span>
                )}
              </div>
            </div>

            {/* GitHub Account */}
            <div className="pixel-panel-inset" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span className="pixel-title" style={{ fontSize: 9, color: '#ffd147' }}>
                  {t.settingsModal.accountsGithubTitle}
                </span>
                <span className="pixel-badge" style={{ fontSize: 9, color: githubAccount?.connected ? '#3be87a' : 'var(--text-dim)' }}>
                  {githubAccount?.connected
                    ? `✓ @${githubAccount.username || t.settingsModal.connectedBadge}`
                    : t.settingsModal.notConnectedBadge}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="pixel-btn active"
                  style={{ fontSize: 9, padding: '5px 10px' }}
                  disabled={accountBusy}
                  onClick={() => void handleImportGhCli()}
                >
                  🐙 {t.settingsModal.importGhCliBtn}
                </button>
                {githubAccount?.connected && (
                  <button
                    type="button"
                    className="pixel-btn danger"
                    style={{ fontSize: 9, padding: '5px 10px' }}
                    disabled={accountBusy}
                    onClick={() => void handleDisconnectAccount('github')}
                  >
                    {t.settingsModal.disconnectBtn}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  value={githubClientIdDraft}
                  onChange={(e) => setGithubClientIdDraft(e.target.value)}
                  placeholder={t.settingsModal.githubClientIdPlaceholder}
                  className="retro-dock-select"
                  style={{ flex: 1, minWidth: 190, maxWidth: 'none', cursor: 'text' }}
                />
                <button
                  type="button"
                  className="pixel-btn cyan"
                  style={{ fontSize: 9, padding: '5px 10px' }}
                  disabled={accountBusy}
                  onClick={() => void handleStartGitHubDevice()}
                >
                  {t.settingsModal.githubDeviceBtn}
                </button>
              </div>

              {deviceFlow && (
                <div className="retro-dock-diff-row" style={{ flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#9ee8ff' }}>{t.settingsModal.githubDeviceStep}</span>
                    <span className="pixel-badge" style={{ fontSize: 11, color: '#ffd147', fontWeight: 700 }}>
                      {deviceFlow.userCode}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.settingsModal.githubDeviceWaiting}</span>
                  </div>
                  <a
                    href={deviceFlow.verificationUri}
                    target="_blank"
                    rel="noreferrer"
                    className="pixel-btn cyan"
                    style={{ fontSize: 9, padding: '3px 8px', textDecoration: 'none' }}
                  >
                    {t.settingsModal.githubDeviceOpen}
                  </a>
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
