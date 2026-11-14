import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  type GraphicsSettings,
  type OfficeEmployee,
  type PlazaFloor,
  type PlazaSnapshot,
} from '../shared/types';
import {
  initAudioUnlock,
  isMuted,
  isNotificationsEnabled,
  playAlertJingle,
  playEventJingle,
  playLevelUp,
  playMentionChime,
  playSelectBlip,
  requestNotificationPermission,
  sendAgentAlertNotification,
  setNotificationsEnabled,
  toggleMuted,
} from './audio/retroSynth';
import { AgentRpgModal } from './components/AgentRpgModal';
import { AlertHistoryModal, type AlertHistoryEntry } from './components/AlertHistoryModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { ElevatorPanel } from './components/ElevatorPanel';
import { IconLegendModal } from './components/IconLegendModal';
import { SettingsModal } from './components/SettingsModal';
import { TopHud } from './components/TopHud';
import { WhiteboardModal } from './components/WhiteboardModal';
import { OfficeCanvas } from './engine/OfficeCanvas';
import { PlazaTowerCanvas } from './engine/PlazaTowerCanvas';
import { buildSidecarWsUrl, isPluginScheme, sidecarFetch } from './sidecarBridge';
import { localizeSnapshot, useI18n } from './i18n/translations';

const GRAPHICS_STORAGE_KEY = 'swarm_plaza_graphics_settings_v1';

function loadGraphicsSettings(): GraphicsSettings {
  try {
    const raw = window.localStorage.getItem(GRAPHICS_STORAGE_KEY);
    if (!raw) return DEFAULT_GRAPHICS_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GraphicsSettings>;
    return {
      ...DEFAULT_GRAPHICS_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_GRAPHICS_SETTINGS;
  }
}

function pickInitialFloorId(snap: PlazaSnapshot): string | null {
  if (snap.activeProjectFloorId) {
    const exists = snap.floors.some((f) => f.id === snap.activeProjectFloorId);
    if (exists) return snap.activeProjectFloorId;
  }
  if (snap.floors.length === 0) return null;
  const sorted = [...snap.floors].sort((a, b) => {
    if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
    return b.employees.length - a.employees.length;
  });
  return sorted[0].id;
}

export const App: React.FC = () => {
  const { t, locale } = useI18n();
  const [snapshot, setSnapshot] = useState<PlazaSnapshot | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'plaza' | 'office'>('office');
  const [isNight, setIsNight] = useState<boolean>(true);
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(() =>
    isNotificationsEnabled(),
  );
  const [followCam, setFollowCam] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [liveFps, setLiveFps] = useState<number>(60);
  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings>(loadGraphicsSettings);

  useEffect(() => {
    try {
      window.localStorage.setItem(GRAPHICS_STORAGE_KEY, JSON.stringify(graphicsSettings));
    } catch {
      // ignore storage quota errors
    }
  }, [graphicsSettings]);
  const [rpgOpenedFromWhiteboard, setRpgOpenedFromWhiteboard] = useState<boolean>(false);
  const [whiteboardInitialTab, setWhiteboardInitialTab] = useState<
    'feed' | 'personnel' | 'tasks' | 'gantt'
  >('feed');
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const [selectedEmployee, setSelectedEmployee] = useState<OfficeEmployee | null>(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState<boolean>(false);
  const [alertsOpen, setAlertsOpen] = useState<boolean>(false);
  const [legendOpen, setLegendOpen] = useState<boolean>(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '?' && !(e.shiftKey && e.key === '/')) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      setLegendOpen((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const [isCompactPane, setIsCompactPane] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 760 : false,
  );
  const [isElevatorOpen, setIsElevatorOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 760 : true,
  );

  useEffect(() => {
    const onResize = () => {
      const compact = window.innerWidth < 760;
      setIsCompactPane((prev) => {
        if (prev !== compact) {
          setIsElevatorOpen(!compact);
        }
        return compact;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [analyticsOpen, setAnalyticsOpen] = useState<boolean>(false);

  const exportPngRef = useRef<(() => void) | null>(null);
  const prevBoardSeqRef = useRef<Map<string, number>>(new Map());
  const prevTierRef = useRef<Map<string, number>>(new Map());
  const prevEventIdRef = useRef<Map<string, string | null>>(new Map());
  const prevErrorAgentsRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    return initAudioUnlock();
  }, []);

  const applySnapshot = useCallback(
    (next: PlazaSnapshot) => {
      const nextErrorIds = new Set<string>();
      const newlyErroredNames: string[] = [];

      for (const fl of next.floors) {
        for (const emp of fl.employees) {
          if (emp.status === 'error' || emp.toolActivity === 'error') {
            nextErrorIds.add(emp.id);
            if (hasInitializedRef.current && !prevErrorAgentsRef.current.has(emp.id)) {
              newlyErroredNames.push(emp.name);
            }
          }
        }
      }
      prevErrorAgentsRef.current = nextErrorIds;

      if (hasInitializedRef.current) {
        let shouldChime = false;
        let shouldLevelUp = false;
        let shouldEventJingle = false;
        const shouldAlert = newlyErroredNames.length > 0;

        for (const fl of next.floors) {
          const lastSeq = fl.boardMessages.length
            ? fl.boardMessages[fl.boardMessages.length - 1].seq
            : 0;
          const prevSeq = prevBoardSeqRef.current.get(fl.id) ?? lastSeq;
          if (lastSeq > prevSeq) {
            shouldChime = true;
          }
          prevBoardSeqRef.current.set(fl.id, lastSeq);

          const prevTier = prevTierRef.current.get(fl.id) ?? fl.tier;
          if (fl.tier > prevTier) {
            shouldLevelUp = true;
          }
          prevTierRef.current.set(fl.id, fl.tier);

          const nextEventId = fl.activeEvent?.id ?? null;
          const prevEventId = prevEventIdRef.current.get(fl.id) ?? null;
          if (nextEventId && nextEventId !== prevEventId) {
            shouldEventJingle = true;
          }
          prevEventIdRef.current.set(fl.id, nextEventId);
        }

        if (shouldAlert) {
          playAlertJingle();
          sendAgentAlertNotification(
            t.notifications.agentAlertTitle,
            `${newlyErroredNames.join(', ')} ${t.notifications.agentStallOrError}`,
          );
        } else if (shouldLevelUp) {
          playLevelUp();
        } else if (shouldEventJingle) {
          playEventJingle();
        } else if (shouldChime) {
          playMentionChime();
        }
      } else {
        for (const fl of next.floors) {
          const lastSeq = fl.boardMessages.length
            ? fl.boardMessages[fl.boardMessages.length - 1].seq
            : 0;
          prevBoardSeqRef.current.set(fl.id, lastSeq);
          prevTierRef.current.set(fl.id, fl.tier);
          prevEventIdRef.current.set(fl.id, fl.activeEvent?.id ?? null);
        }
        hasInitializedRef.current = true;
      }

      setSnapshot(next);
      setSelectedFloorId((curr) => {
        if (curr && next.floors.some((f) => f.id === curr)) return curr;
        return pickInitialFloorId(next);
      });
    },
    [t.notifications.agentAlertTitle, t.notifications.agentStallOrError],
  );

  // Initial /api/plaza fetch + WebSocket (or 1500ms HTTP polling under plugin:// scheme)
  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pollTimer: number | null = null;
    let inFlight = false;

    const fetchInitial = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await sidecarFetch('/api/plaza');
        if (!res.ok) return;
        const data = (await res.json()) as PlazaSnapshot;
        if (!closed) {
          applySnapshot(data);
          if (isPluginScheme()) setWsConnected(true);
        }
      } catch {
        if (!closed && isPluginScheme()) setWsConnected(false);
      } finally {
        inFlight = false;
      }
    };

    const connectWs = () => {
      if (closed) return;
      const wsUrl = buildSidecarWsUrl();
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!closed) setWsConnected(true);
      };

      ws.onmessage = (evt) => {
        if (closed) return;
        try {
          const payload = JSON.parse(evt.data) as
            | PlazaSnapshot
            | { type?: string; data?: PlazaSnapshot };
          const snap =
            'floors' in payload
              ? payload
              : payload.data && 'floors' in payload.data
                ? payload.data
                : null;
          if (snap) applySnapshot(snap);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (closed) return;
        setWsConnected(false);
        reconnectTimer = window.setTimeout(connectWs, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    fetchInitial();
    if (isPluginScheme()) {
      pollTimer = window.setInterval(fetchInitial, 1500);
    } else {
      connectWs();
    }

    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (pollTimer !== null) window.clearInterval(pollTimer);
      ws?.close();
    };
  }, [applySnapshot]);

  const localizedSnapshot = useMemo(
    () => (snapshot ? localizeSnapshot(snapshot, locale) : null),
    [snapshot, locale],
  );

  const activeFloor: PlazaFloor | null = useMemo(() => {
    if (!localizedSnapshot || localizedSnapshot.floors.length === 0) return null;
    return (
      localizedSnapshot.floors.find((f) => f.id === selectedFloorId) ||
      localizedSnapshot.floors[0] ||
      null
    );
  }, [localizedSnapshot, selectedFloorId]);

  const handleToggleDemo = async () => {
    try {
      const res = await sidecarFetch('/api/demo/toggle', { method: 'POST' });
      if (!res.ok) return;
      const data = (await res.json()) as PlazaSnapshot | { snapshot?: PlazaSnapshot };
      const snap = 'floors' in data ? data : data.snapshot;
      if (snap) {
        applySnapshot(snap);
        const demoFloor = snap.floors.find((f) => f.isDemo);
        if (snap.demoMode && demoFloor) {
          setSelectedFloorId(demoFloor.id);
          setViewMode('office');
        }
      }
    } catch {
      // ignore
    }
  };

  const handleToggleMute = () => {
    const nextMuted = toggleMuted();
    setMutedState(nextMuted);
    if (!nextMuted) {
      playSelectBlip();
    }
  };

  const handleToggleNotifications = async () => {
    const next = !notificationsEnabled;
    if (next) {
      await requestNotificationPermission();
    }
    setNotificationsEnabled(next);
    setNotificationsEnabledState(next);
  };

  const handleToggleFollowCam = () => {
    setFollowCam((curr) => {
      const next = !curr;
      if (next && !selectedEmployee && activeFloor && activeFloor.employees.length > 0) {
        const preferred =
          activeFloor.employees.find((e) => e.status === 'working') ?? activeFloor.employees[0];
        if (preferred) setSelectedEmployee(preferred);
      }
      return next;
    });
  };

  const handleRegisterExportPng = useCallback((fn: (() => void) | null) => {
    exportPngRef.current = fn;
  }, []);

  const handleExportPng = () => {
    exportPngRef.current?.();
  };

  const handleRerollLayout = async () => {
    if (!activeFloor) return;
    try {
      const res = await sidecarFetch(`/api/floors/${encodeURIComponent(activeFloor.id)}/reroll`, {
        method: 'POST',
      });
      if (!res.ok) return;
      const data = (await res.json()) as PlazaSnapshot | { snapshot?: PlazaSnapshot };
      const snap = 'floors' in data ? data : data.snapshot;
      if (snap) applySnapshot(snap);
    } catch {
      // ignore
    }
  };

  const handleTriggerEvent = async () => {
    if (!activeFloor) return;
    playEventJingle();
    try {
      const res = await sidecarFetch(`/api/floors/${encodeURIComponent(activeFloor.id)}/event`, {
        method: 'POST',
      });
      if (!res.ok) return;
      const data = (await res.json()) as PlazaSnapshot | { snapshot?: PlazaSnapshot };
      const snap = 'floors' in data ? data : data.snapshot;
      if (snap) applySnapshot(snap);
    } catch {
      // ignore
    }
  };

  const handleSelectFloorFromTower = (floorId: string) => {
    setSelectedFloorId(floorId);
    setViewMode('office');
    setSelectedEmployee(null);
  };

  const handleSelectFloorFromElevator = (floorId: string) => {
    setSelectedFloorId(floorId);
    setViewMode('office');
    setSelectedEmployee(null);
    if (isCompactPane) {
      setIsElevatorOpen(false);
    }
  };

const STICKY_ALERTS_STORAGE_KEY = 'swarm_plaza_sticky_alerts_v1';

interface StickyAlertItem extends AlertHistoryEntry {
  bannerDismissed: boolean;
}

function loadStickyAlerts(): StickyAlertItem[] {
  try {
    const raw =
      typeof window !== 'undefined' ? window.localStorage.getItem(STICKY_ALERTS_STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.slice(0, 50) as StickyAlertItem[]) : [];
  } catch {
    return [];
  }
}

  const [stickyAlerts, setStickyAlerts] = useState<StickyAlertItem[]>(loadStickyAlerts);
  const stickyBaselineDoneRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STICKY_ALERTS_STORAGE_KEY, JSON.stringify(stickyAlerts.slice(0, 50)));
      }
    } catch {
      // ignore storage quota errors
    }
  }, [stickyAlerts]);

  useEffect(() => {
    if (!localizedSnapshot) return;
    const isColdStart = !stickyBaselineDoneRef.current;
    stickyBaselineDoneRef.current = true;
    const floors = localizedSnapshot.floors ?? [];
    const now = Date.now();

    setStickyAlerts((prev) => {
      const byId = new Map<string, StickyAlertItem>(prev.map((a) => [a.id, a]));
      let changed = false;

      for (const fl of floors) {
        for (const emp of fl.employees) {
          const consecutiveErrors = emp.health?.consecutiveErrors ?? 0;
          const normState = emp.health?.normalizedState;
          const isActivelyErrored =
            emp.status === 'error' ||
            emp.activity === 'error' ||
            emp.toolActivity === 'error' ||
            consecutiveErrors > 0 ||
            normState === 'error';

          if (emp.lastError) {
            const le = emp.lastError;
            const resolved = le.resolved && !isActivelyErrored;
            const ts = Date.parse(le.timestamp) || now;
            const existing = byId.get(le.id);
            if (existing) {
              if (existing.resolved !== resolved || existing.message !== le.message) {
                byId.set(le.id, {
                  ...existing,
                  resolved,
                  severity: resolved ? 'warning' : 'critical',
                  message: le.message,
                  toolName: le.toolName,
                  target: le.target,
                  timestamp: ts,
                });
                changed = true;
              }
            } else {
              const silentColdStart = isColdStart && resolved;
              byId.set(le.id, {
                id: le.id,
                agentName: emp.name,
                floorName: fl.companyName,
                severity: resolved ? 'warning' : 'critical',
                reason: 'error',
                message: le.message,
                toolName: le.toolName,
                target: le.target,
                timestamp: ts,
                count: Math.max(1, consecutiveErrors || 1),
                resolved,
                acknowledged: silentColdStart,
                bannerDismissed: silentColdStart,
              });
              changed = true;
            }
          } else if (isActivelyErrored) {
            const activeId = `emp-err-${fl.id}-${emp.id}`;
            const existing = byId.get(activeId);
            const msg =
              emp.speechBubble ||
              emp.currentTarget ||
              emp.currentTool ||
              `${normState ?? emp.status} (${Math.max(1, consecutiveErrors)})`;
            if (existing) {
              if (existing.resolved || existing.message !== msg) {
                byId.set(activeId, {
                  ...existing,
                  resolved: false,
                  severity: 'critical',
                  message: msg,
                  timestamp: now,
                  count: Math.max(1, consecutiveErrors),
                });
                changed = true;
              }
            } else {
              byId.set(activeId, {
                id: activeId,
                agentName: emp.name,
                floorName: fl.companyName,
                severity: 'critical',
                reason: normState ?? emp.status,
                message: msg,
                timestamp: now,
                count: Math.max(1, consecutiveErrors),
                resolved: false,
                acknowledged: false,
                bannerDismissed: false,
              });
              changed = true;
            }
          }
        }
      }

      if (!changed) return prev;
      return Array.from(byId.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
    });
  }, [localizedSnapshot]);

  const unreadAlertCount = useMemo(
    () => stickyAlerts.filter((a) => !a.acknowledged).length,
    [stickyAlerts],
  );
  const bannerAlerts = useMemo(
    () => stickyAlerts.filter((a) => !a.bannerDismissed),
    [stickyAlerts],
  );
  const topBannerAlert = bannerAlerts[0] ?? null;

  const isModalOpen = Boolean(
    whiteboardOpen || analyticsOpen || settingsOpen || alertsOpen || legendOpen || selectedEmployee,
  );

  return (
    <div className="plaza-shell">
      <TopHud
        floor={activeFloor}
        quotaPools={localizedSnapshot?.quotaPools}
        globalEcoScore={localizedSnapshot?.globalEcoScore ?? 100}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        onOpenWhiteboard={() => setWhiteboardOpen(true)}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onExportPng={handleExportPng}
        onRerollLayout={handleRerollLayout}
        onTriggerEvent={handleTriggerEvent}
        wsConnected={wsConnected}
        isCompactPane={isCompactPane}
        isElevatorOpen={isElevatorOpen}
        onToggleElevator={() => setIsElevatorOpen((open) => !open)}
        alertCount={unreadAlertCount}
        historyAlertCount={stickyAlerts.length}
        onOpenAlerts={() => setAlertsOpen(true)}
        onOpenLegend={() => setLegendOpen(true)}
      />

      {topBannerAlert && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            padding: '7px 12px',
            background: topBannerAlert.resolved ? '#262113' : '#351318',
            borderBottom: `2px solid ${topBannerAlert.resolved ? '#ffd147' : '#ff5666'}`,
            fontSize: 11,
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 220 }}>
            <span style={{ fontWeight: 700, color: topBannerAlert.resolved ? '#ffd147' : '#ff6b6b' }}>
              {topBannerAlert.resolved ? t.stickyAlerts.recovered : t.stickyAlerts.activeError}
            </span>
            <span className="pixel-title" style={{ fontSize: 9, color: '#3cd8ff' }}>
              @{topBannerAlert.agentName}
            </span>
            <span style={{ color: '#e4ecff', fontFamily: 'monospace', wordBreak: 'break-word' }}>
              {topBannerAlert.toolName || topBannerAlert.target
                ? `${[topBannerAlert.toolName, topBannerAlert.target].filter(Boolean).join(' · ')} — `
                : ''}
              {topBannerAlert.message}
            </span>
            {bannerAlerts.length > 1 && (
              <span className="pixel-badge" style={{ color: '#ffd147', borderColor: '#786221' }}>
                {t.stickyAlerts.otherErrors.replace('{n}', String(bannerAlerts.length - 1))}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="pixel-btn cyan"
              style={{ fontSize: 9, padding: '4px 8px' }}
              onClick={() => {
                playSelectBlip();
                setStickyAlerts((prev) =>
                  prev.map((a) =>
                    a.id === topBannerAlert.id
                      ? { ...a, acknowledged: true, bannerDismissed: true }
                      : a,
                  ),
                );
                const targetName = topBannerAlert.agentName.toLowerCase();
                const candidate =
                  activeFloor?.employees.find((e) => e.name.toLowerCase() === targetName) ??
                  localizedSnapshot?.floors
                    .flatMap((f) => f.employees)
                    .find((e) => e.name.toLowerCase() === targetName) ??
                  null;
                if (candidate) {
                  setRpgOpenedFromWhiteboard(false);
                  setSelectedEmployee(candidate);
                } else {
                  setAlertsOpen(true);
                }
              }}
            >
              {t.stickyAlerts.viewError}
            </button>
            <button
              type="button"
              className="pixel-btn"
              style={{ fontSize: 9, padding: '4px 8px' }}
              onClick={() => {
                playSelectBlip();
                setAlertsOpen(true);
              }}
            >
              {t.stickyAlerts.allAlerts} ({stickyAlerts.length})
            </button>
            <button
              type="button"
              className="pixel-btn"
              style={{ fontSize: 9, padding: '4px 8px', color: '#ff9aa4' }}
              onClick={() => {
                playSelectBlip();
                setStickyAlerts((prev) => prev.map((a) => ({ ...a, bannerDismissed: true })));
              }}
            >
              {t.stickyAlerts.dismissBanner}
            </button>
          </div>
        </div>
      )}

      <main className="plaza-main">
        {isElevatorOpen && (
          <ElevatorPanel
            floors={localizedSnapshot?.floors ?? []}
            selectedFloorId={activeFloor?.id ?? null}
            onSelectFloor={handleSelectFloorFromElevator}
            isOverlay={isCompactPane}
            onClose={() => setIsElevatorOpen(false)}
          />
        )}

        <div className="plaza-viewport">
          {viewMode === 'plaza' ? (
            <PlazaTowerCanvas
              floors={localizedSnapshot?.floors ?? []}
              selectedFloorId={activeFloor?.id ?? null}
              isNight={isNight}
              isOverlayOpen={isModalOpen}
              graphicsSettings={graphicsSettings}
              onFpsSample={setLiveFps}
              onSelectFloor={handleSelectFloorFromTower}
            />
          ) : activeFloor ? (
            <OfficeCanvas
              floor={activeFloor}
              isNight={isNight}
              isOverlayOpen={isModalOpen}
              graphicsSettings={graphicsSettings}
              onFpsSample={setLiveFps}
              selectedEmployeeId={selectedEmployee?.id ?? null}
              onSelectEmployee={(emp) => setSelectedEmployee(emp)}
              onOpenWhiteboard={() => setWhiteboardOpen(true)}
              followCam={followCam}
              onFollowCamChange={setFollowCam}
              onRegisterExportPng={handleRegisterExportPng}
              onOpenLegend={() => setLegendOpen(true)}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-dim)',
              }}
            >
              Loading Antigravity Swarm Plaza...
            </div>
          )}
        </div>
      </main>

      {selectedEmployee && (
        <AgentRpgModal
          employee={
            activeFloor?.employees.find((e) => e.id === selectedEmployee.id) ??
            selectedEmployee
          }
          activeEventKind={activeFloor?.activeEvent?.kind ?? null}
          onBack={
            rpgOpenedFromWhiteboard
              ? () => {
                  setSelectedEmployee(null);
                  setRpgOpenedFromWhiteboard(false);
                  setWhiteboardInitialTab('personnel');
                  setWhiteboardOpen(true);
                }
              : undefined
          }
          onClose={() => {
            setSelectedEmployee(null);
            setRpgOpenedFromWhiteboard(false);
          }}
        />
      )}

      {whiteboardOpen && activeFloor && (
        <WhiteboardModal
          companyName={activeFloor.companyName}
          swarmTitle={activeFloor.swarmTitle}
          messages={activeFloor.boardMessages}
          swarmEdges={activeFloor.swarmEdges}
          taskNodes={activeFloor.taskNodes}
          employees={activeFloor.employees}
          recentlyLeftEmployees={activeFloor.recentlyLeftEmployees}
          agentResources={activeFloor.analytics?.agentResources}
          activeEventKind={activeFloor.activeEvent?.kind ?? null}
          initialTab={whiteboardInitialTab}
          onSelectEmployee={(emp) => {
            setWhiteboardOpen(false);
            setRpgOpenedFromWhiteboard(true);
            setSelectedEmployee(emp);
          }}
          onClose={() => {
            setWhiteboardOpen(false);
            setWhiteboardInitialTab('feed');
          }}
        />
      )}

      {analyticsOpen && (
        <AnalyticsModal
          floor={activeFloor}
          snapshot={localizedSnapshot}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          graphicsSettings={graphicsSettings}
          onChangeGraphics={setGraphicsSettings}
          liveFps={liveFps}
          followCam={followCam}
          onToggleFollowCam={handleToggleFollowCam}
          isNight={isNight}
          onToggleNight={() => setIsNight((n) => !n)}
          demoMode={localizedSnapshot?.demoMode ?? false}
          onToggleDemo={handleToggleDemo}
          muted={muted}
          onToggleMute={handleToggleMute}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={handleToggleNotifications}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {alertsOpen && (
        <AlertHistoryModal
          alerts={stickyAlerts}
          onInspectAgent={(agentName) => {
            const targetName = agentName.toLowerCase();
            setStickyAlerts((prev) =>
              prev.map((a) =>
                a.agentName.toLowerCase() === targetName
                  ? { ...a, acknowledged: true, bannerDismissed: true }
                  : a,
              ),
            );
            const candidate =
              activeFloor?.employees.find((e) => e.name.toLowerCase() === targetName) ??
              localizedSnapshot?.floors
                .flatMap((f) => f.employees)
                .find((e) => e.name.toLowerCase() === targetName) ??
              null;
            setAlertsOpen(false);
            if (candidate) {
              setRpgOpenedFromWhiteboard(false);
              setSelectedEmployee(candidate);
            }
          }}
          onMarkAllRead={() => {
            setStickyAlerts((prev) =>
              prev.map((a) => ({ ...a, acknowledged: true, bannerDismissed: true })),
            );
          }}
          onDeleteAlert={(id) => {
            setStickyAlerts((prev) => prev.filter((a) => a.id !== id));
          }}
          onClear={() => setStickyAlerts([])}
          onClose={() => setAlertsOpen(false)}
        />
      )}

      {legendOpen && <IconLegendModal onClose={() => setLegendOpen(false)} />}
    </div>
  );
};
