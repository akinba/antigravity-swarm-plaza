import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OfficeEmployee, PlazaFloor, PlazaSnapshot } from '../shared/types';
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
import { AnalyticsModal } from './components/AnalyticsModal';
import { ElevatorPanel } from './components/ElevatorPanel';
import { TopHud } from './components/TopHud';
import { WhiteboardModal } from './components/WhiteboardModal';
import { OfficeCanvas } from './engine/OfficeCanvas';
import { PlazaTowerCanvas } from './engine/PlazaTowerCanvas';
import { useI18n } from './i18n/translations';

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
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<PlazaSnapshot | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'plaza' | 'office'>('office');
  const [isNight, setIsNight] = useState<boolean>(true);
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(() =>
    isNotificationsEnabled(),
  );
  const [followCam, setFollowCam] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const [selectedEmployee, setSelectedEmployee] = useState<OfficeEmployee | null>(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState<boolean>(false);
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

  // Initial /api/plaza fetch + WebSocket with auto-reconnect
  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const fetchInitial = async () => {
      try {
        const res = await fetch('/api/plaza');
        if (!res.ok) return;
        const data = (await res.json()) as PlazaSnapshot;
        if (!closed) applySnapshot(data);
      } catch {
        // WS will retry
      }
    };

    const connectWs = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;
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
    connectWs();

    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [applySnapshot]);

  const activeFloor: PlazaFloor | null = useMemo(() => {
    if (!snapshot || snapshot.floors.length === 0) return null;
    return (
      snapshot.floors.find((f) => f.id === selectedFloorId) || snapshot.floors[0] || null
    );
  }, [snapshot, selectedFloorId]);

  const handleToggleDemo = async () => {
    try {
      const res = await fetch('/api/demo/toggle', { method: 'POST' });
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
      const res = await fetch(`/api/floors/${encodeURIComponent(activeFloor.id)}/reroll`, {
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
      const res = await fetch(`/api/floors/${encodeURIComponent(activeFloor.id)}/event`, {
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
  };

  return (
    <div className="plaza-shell">
      <TopHud
        floor={activeFloor}
        globalEcoScore={snapshot?.globalEcoScore ?? 100}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        demoMode={snapshot?.demoMode ?? false}
        onToggleDemo={handleToggleDemo}
        isNight={isNight}
        onToggleNight={() => setIsNight((n) => !n)}
        muted={muted}
        onToggleMute={handleToggleMute}
        onOpenWhiteboard={() => setWhiteboardOpen(true)}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        followCam={followCam}
        onToggleFollowCam={handleToggleFollowCam}
        onExportPng={handleExportPng}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={handleToggleNotifications}
        onRerollLayout={handleRerollLayout}
        onTriggerEvent={handleTriggerEvent}
        wsConnected={wsConnected}
      />

      <main className="plaza-main">
        <ElevatorPanel
          floors={snapshot?.floors ?? []}
          selectedFloorId={activeFloor?.id ?? null}
          onSelectFloor={handleSelectFloorFromElevator}
        />

        <div className="plaza-viewport">
          {viewMode === 'plaza' ? (
            <PlazaTowerCanvas
              floors={snapshot?.floors ?? []}
              selectedFloorId={activeFloor?.id ?? null}
              isNight={isNight}
              onSelectFloor={handleSelectFloorFromTower}
            />
          ) : activeFloor ? (
            <OfficeCanvas
              floor={activeFloor}
              isNight={isNight}
              selectedEmployeeId={selectedEmployee?.id ?? null}
              onSelectEmployee={(emp) => setSelectedEmployee(emp)}
              onOpenWhiteboard={() => setWhiteboardOpen(true)}
              followCam={followCam}
              onFollowCamChange={setFollowCam}
              onRegisterExportPng={handleRegisterExportPng}
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
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}

      {whiteboardOpen && activeFloor && (
        <WhiteboardModal
          companyName={activeFloor.companyName}
          swarmTitle={activeFloor.swarmTitle}
          messages={activeFloor.boardMessages}
          swarmEdges={activeFloor.swarmEdges}
          onClose={() => setWhiteboardOpen(false)}
        />
      )}

      {analyticsOpen && (
        <AnalyticsModal
          floor={activeFloor}
          snapshot={snapshot}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}
    </div>
  );
};
