import React, { useEffect, useState } from 'react';
import type { FloorEventKind, PlazaFloor } from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

const EVENT_OPTIONS: FloorEventKind[] = [
  'CARD_GAME',
  'PIZZA_PARTY',
  'COFFEE_BREW',
  'HALLOWEEN_PARTY',
  'STAR_WARS_PARTY',
  'SUPERHERO_PARTY',
  'WATERCOOLER_GOSSIP',
  'SPRINT_CELEBRATION',
  'MASCOT_ZOOMIES',
];

interface EventCalendarModalProps {
  floor: PlazaFloor;
  onTriggerEvent: (kind?: FloorEventKind) => void;
  onScheduleEvent: (kind: FloorEventKind, delaySec: number) => void;
  onClose: () => void;
}

export const EventCalendarModal: React.FC<EventCalendarModalProps> = ({
  floor,
  onTriggerEvent,
  onScheduleEvent,
  onClose,
}) => {
  const { t } = useI18n();
  const [selectedKind, setSelectedKind] = useState<FloorEventKind>('CARD_GAME');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const scheduled = [...(floor.scheduledEvents ?? [])].sort(
    (a, b) => a.scheduledFor - b.scheduledFor,
  );
  const active = floor.activeEvent ?? null;
  const activeSecLeft = active ? Math.max(0, Math.ceil((active.expiresAt - nowMs) / 1000)) : 0;

  return (
    <div className="pixel-modal-backdrop" onClick={onClose}>
      <div
        className="pixel-panel pixel-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 14, gap: 12, maxWidth: 620, width: '94vw' }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            borderBottom: '2px solid #0a0c14',
            paddingBottom: 8,
          }}
        >
          <span className="pixel-title" style={{ fontSize: 11, color: '#ffd147' }}>
            {t.calendarModal.title}
          </span>
          <button
            type="button"
            className="pixel-btn"
            onClick={() => {
              playSelectBlip();
              onClose();
            }}
          >
            {t.calendarModal.close}
          </button>
        </div>

        {/* Active Event */}
        <div
          className="pixel-panel-inset"
          style={{
            padding: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
            borderColor: active ? '#3be87a' : '#2b3554',
          }}
        >
          <span style={{ fontSize: 10, color: '#9aa7c7', fontFamily: 'var(--font-pixel)' }}>
            {t.calendarModal.activeEventLabel}
          </span>
          {active ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="pixel-badge" style={{ color: '#3be87a', borderColor: '#3be87a' }}>
                {t.events[active.kind]}
              </span>
              {active.targetZone && (
                <span className="pixel-badge" style={{ color: '#3cd8ff' }}>
                  {active.targetZone === 'WAR_ROOM'
                    ? t.calendarModal.locationWarRoom
                    : t.calendarModal.locationLounge}
                </span>
              )}
              <span style={{ fontSize: 11, color: '#ffd147', fontFamily: 'monospace' }}>
                {activeSecLeft}s
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {t.calendarModal.noActiveEvent}
            </span>
          )}
        </div>

        {/* Scheduled Events */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#3cd8ff', fontFamily: 'var(--font-pixel)' }}>
            {t.calendarModal.scheduledTitle} ({scheduled.length})
          </span>
          {scheduled.length === 0 ? (
            <div
              className="pixel-panel-inset"
              style={{ padding: 12, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}
            >
              {t.calendarModal.noScheduled}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: '30vh',
                overflowY: 'auto',
              }}
            >
              {scheduled.map((ev) => {
                const sec = Math.max(0, Math.ceil((ev.scheduledFor - nowMs) / 1000));
                return (
                  <div
                    key={ev.id}
                    className="pixel-panel-inset"
                    style={{
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="pixel-badge" style={{ color: '#ffd147', borderColor: '#786221' }}>
                          {t.events[ev.kind]}
                        </span>
                        <span style={{ fontSize: 10, color: '#9aa7c7' }}>
                          {t.calendarModal.proposedBy}: <strong style={{ color: '#3cd8ff' }}>{ev.proposedByName}</strong>
                        </span>
                      </div>
                      {ev.announcementText && (
                        <span style={{ fontSize: 11, color: '#dce6ff' }}>{ev.announcementText}</span>
                      )}
                    </div>
                    <span
                      className="pixel-badge"
                      style={{
                        color: sec <= 5 ? '#3be87a' : '#ffd147',
                        fontFamily: 'monospace',
                      }}
                    >
                      {sec <= 0 ? t.calendarModal.startsNow : t.calendarModal.startsInSec.replace('{n}', String(sec))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Trigger Now & Schedule */}
        <div
          className="pixel-panel-inset"
          style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <span style={{ fontSize: 10, color: '#9aa7c7', fontFamily: 'var(--font-pixel)' }}>
            {t.calendarModal.scheduleLaterTitle} / {t.calendarModal.triggerNowTitle}
          </span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {EVENT_OPTIONS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={`pixel-btn ${selectedKind === kind ? 'cyan' : ''}`}
                style={{ fontSize: 9, padding: '4px 7px' }}
                onClick={() => {
                  playSelectBlip();
                  setSelectedKind(kind);
                }}
              >
                {t.events[kind]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
            <button
              type="button"
              className="pixel-btn gold"
              style={{ fontSize: 10, padding: '5px 10px' }}
              onClick={() => {
                onTriggerEvent(selectedKind);
              }}
            >
              ⚡ {t.calendarModal.triggerNowTitle}
            </button>
            {[
              { sec: 30, label: t.calendarModal.delay30s },
              { sec: 60, label: t.calendarModal.delay1m },
              { sec: 300, label: t.calendarModal.delay5m },
            ].map((opt) => (
              <button
                key={opt.sec}
                type="button"
                className="pixel-btn cyan"
                style={{ fontSize: 10, padding: '5px 9px' }}
                onClick={() => {
                  playSelectBlip();
                  onScheduleEvent(selectedKind, opt.sec);
                }}
              >
                📅 {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
