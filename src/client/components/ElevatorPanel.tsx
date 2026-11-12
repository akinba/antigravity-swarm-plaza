import React, { useMemo } from 'react';
import type { PlazaFloor } from '../../shared/types';
import { playElevatorDing } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

interface ElevatorPanelProps {
  floors: PlazaFloor[];
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
}

export const ElevatorPanel: React.FC<ElevatorPanelProps> = ({
  floors,
  selectedFloorId,
  onSelectFloor,
}) => {
  const { t } = useI18n();

  // Top-down order in elevator: Demo Penthouse at top, then highest floor down to Lobby (K0/L)
  const orderedFloors = useMemo(() => {
    return [...floors].sort((a, b) => {
      if (a.isDemo && !b.isDemo) return -1;
      if (!a.isDemo && b.isDemo) return 1;
      return b.floorNumber - a.floorNumber;
    });
  }, [floors]);

  return (
    <aside
      className="pixel-panel"
      style={{
        width: 230,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 15,
        flexShrink: 0,
      }}
    >
      <div
        className="pixel-panel-inset"
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid #0a0c14',
        }}
      >
        <span className="pixel-title" style={{ fontSize: 10, color: '#ffd147' }}>
          {t.elevator.title}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{floors.length}</span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {orderedFloors.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 12, textAlign: 'center' }}>
            {t.elevator.noFloors}
          </div>
        )}

        {orderedFloors.map((fl) => {
          const isSelected = fl.id === selectedFloorId;
          const floorCode = fl.isDemo
            ? t.elevator.penthouse
            : fl.floorNumber === 0
              ? t.elevator.lobby
              : `${t.elevator.floorPrefix}${fl.floorNumber}`;

          return (
            <button
              key={fl.id}
              type="button"
              onClick={() => {
                playElevatorDing();
                onSelectFloor(fl.id);
              }}
              className="pixel-panel-inset"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                cursor: 'pointer',
                color: 'var(--text-main)',
                background: isSelected ? '#283659' : 'var(--bg-inset)',
                borderColor: isSelected ? '#ffd147' : '#0a0c14',
                boxShadow: isSelected
                  ? 'inset 0 0 0 1px #ffd147, 0 2px 0 #07080d'
                  : 'inset 2px 2px 0 #07080d, inset -2px -2px 0 #2d3552',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span
                    className="pixel-badge"
                    style={{
                      color: isSelected ? '#ffd147' : '#3cd8ff',
                      minWidth: 30,
                      justifyContent: 'center',
                    }}
                  >
                    {floorCode}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fl.companyName}
                  </span>
                </div>

                <span
                  className={`led-dot ${
                    fl.activeCount > 0 ? 'green' : fl.waitingCount > 0 ? 'amber' : 'dim'
                  }`}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--text-dim)',
                }}
              >
                <span>T{fl.tier}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ color: '#3be87a' }}>
                    {t.elevator.activeAbbr}:{fl.activeCount}
                  </span>
                  <span style={{ color: '#ffbe3b' }}>
                    {t.elevator.waitingAbbr}:{fl.waitingCount}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
