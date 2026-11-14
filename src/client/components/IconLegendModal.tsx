import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playSelectBlip } from '../audio/retroSynth';
import {
  drawAgentHealthBadge,
  drawDeskVerifiedTrophy,
  drawMentionEnvelope,
  drawToolStatusBubble,
} from '../engine/officePropsSprites';
import { useI18n } from '../i18n/translations';

type LegendCategory = 'all' | 'tools' | 'status' | 'social' | 'health';

type LegendIconId =
  | 'reading'
  | 'writing'
  | 'testing'
  | 'searching'
  | 'toolError'
  | 'dotWorking'
  | 'dotWaiting'
  | 'dotError'
  | 'dotIdle'
  | 'bossBadge'
  | 'sleepZzz'
  | 'serverCli'
  | 'gamingStar'
  | 'loungeMusic'
  | 'errorSquare'
  | 'coffeeGift'
  | 'coffeeThanks'
  | 'heroTrophy'
  | 'cheering'
  | 'mentionEnvelope'
  | 'teleportRing'
  | 'hpBar'
  | 'verifiedPin'
  | 'errorLoopPin'
  | 'speechBubble';

interface LegendEntry {
  id: LegendIconId;
  category: Exclude<LegendCategory, 'all'>;
}

const LEGEND_ENTRIES: LegendEntry[] = [
  // Tools (5)
  { id: 'reading', category: 'tools' },
  { id: 'writing', category: 'tools' },
  { id: 'testing', category: 'tools' },
  { id: 'searching', category: 'tools' },
  { id: 'toolError', category: 'tools' },
  // Status & Activity (10)
  { id: 'dotWorking', category: 'status' },
  { id: 'dotWaiting', category: 'status' },
  { id: 'dotError', category: 'status' },
  { id: 'dotIdle', category: 'status' },
  { id: 'bossBadge', category: 'status' },
  { id: 'sleepZzz', category: 'status' },
  { id: 'serverCli', category: 'status' },
  { id: 'gamingStar', category: 'status' },
  { id: 'loungeMusic', category: 'status' },
  { id: 'errorSquare', category: 'status' },
  // Social & Comms (6)
  { id: 'coffeeGift', category: 'social' },
  { id: 'coffeeThanks', category: 'social' },
  { id: 'heroTrophy', category: 'social' },
  { id: 'cheering', category: 'social' },
  { id: 'mentionEnvelope', category: 'social' },
  { id: 'teleportRing', category: 'social' },
  // Health & Proof (4)
  { id: 'hpBar', category: 'health' },
  { id: 'verifiedPin', category: 'health' },
  { id: 'errorLoopPin', category: 'health' },
  { id: 'speechBubble', category: 'health' },
];

function drawLegendSwatch(ctx: CanvasRenderingContext2D, id: LegendIconId): void {
  ctx.clearRect(0, 0, 36, 36);
  ctx.imageSmoothingEnabled = false;

  switch (id) {
    case 'reading':
      drawToolStatusBubble(ctx, 'reading', 18, 25, 1.45, 0);
      break;
    case 'writing':
      drawToolStatusBubble(ctx, 'writing', 18, 25, 1.45, 0);
      break;
    case 'testing':
      drawToolStatusBubble(ctx, 'testing', 18, 25, 1.45, 0);
      break;
    case 'searching':
      drawToolStatusBubble(ctx, 'searching', 18, 25, 1.45, 0);
      break;
    case 'toolError':
      drawToolStatusBubble(ctx, 'error', 18, 25, 1.45, 0);
      break;
    case 'dotWorking':
    case 'dotWaiting':
    case 'dotError':
    case 'dotIdle': {
      const color =
        id === 'dotWorking'
          ? '#3be87a'
          : id === 'dotWaiting'
            ? '#ffbe3b'
            : id === 'dotError'
              ? '#ff5666'
              : '#8d96ad';
      ctx.fillStyle = 'rgba(13,16,28,0.92)';
      ctx.fillRect(6, 12, 24, 12);
      ctx.strokeStyle = '#3b496b';
      ctx.lineWidth = 1;
      ctx.strokeRect(6.5, 12.5, 23, 11);
      ctx.fillStyle = color;
      ctx.fillRect(10, 16, 4, 4);
      ctx.fillStyle = '#dce6ff';
      ctx.fillRect(16, 17, 10, 2);
      break;
    }
    case 'bossBadge':
      ctx.fillStyle = '#3b2d14';
      ctx.fillRect(5, 11, 26, 14);
      ctx.strokeStyle = '#ffd147';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(5.5, 11.5, 25, 13);
      ctx.fillStyle = '#ffd147';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★BOSS', 18, 18.5);
      break;
    case 'sleepZzz':
      ctx.fillStyle = '#9ee8ff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Zzz', 18, 19);
      break;
    case 'serverCli':
      ctx.fillStyle = '#3be87a';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('>_', 18, 14);
      ctx.fillStyle = '#5cf0ff';
      ctx.fillText('</>', 18, 25);
      break;
    case 'gamingStar':
      ctx.fillStyle = '#ffd147';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 14, 19);
      ctx.fillStyle = '#3cd8ff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('★', 24, 15);
      break;
    case 'loungeMusic':
      ctx.fillStyle = '#7ef3ff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♪', 18, 19);
      break;
    case 'errorSquare':
      ctx.fillStyle = '#ff5666';
      ctx.fillRect(10, 10, 16, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 18, 18.5);
      break;
    case 'coffeeGift':
      // Steaming white coffee mug
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(13, 15, 9, 10);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(22, 17, 3, 5);
      ctx.fillStyle = '#6f4e37';
      ctx.fillRect(14, 15, 7, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(15, 10, 2, 3);
      ctx.fillRect(19, 9, 2, 3);
      break;
    case 'coffeeThanks':
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❤️', 18, 19);
      break;
    case 'heroTrophy': {
      const colors = ['#ffd147', '#ff5666', '#3cd8ff', '#3be87a', '#b07cff', '#ffbe3b'];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        ctx.fillStyle = colors[i];
        ctx.fillRect(Math.round(18 + Math.cos(a) * 12), Math.round(18 + Math.sin(a) * 10), 3, 3);
      }
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏆', 18, 19);
      break;
    }
    case 'cheering':
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👏', 18, 19);
      break;
    case 'mentionEnvelope':
      drawMentionEnvelope(ctx, 18, 18, 1.5, 0.5, '#ffd147');
      break;
    case 'teleportRing':
      ctx.strokeStyle = '#3cd8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(18, 22, 10, 4.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#b07cff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(18, 8);
      ctx.lineTo(15, 17);
      ctx.lineTo(20, 17);
      ctx.lineTo(17, 25);
      ctx.stroke();
      break;
    case 'hpBar':
      drawAgentHealthBadge(ctx, 18, 14, 1.6, 0, 88, false, false);
      drawAgentHealthBadge(ctx, 18, 21, 1.6, 0, 52, false, false);
      drawAgentHealthBadge(ctx, 18, 28, 1.6, 0, 22, false, false);
      break;
    case 'verifiedPin':
      drawAgentHealthBadge(ctx, 13, 27, 1.4, 0, 100, true, false);
      drawDeskVerifiedTrophy(ctx, 29, 20, 1.35, 0.4);
      break;
    case 'errorLoopPin':
      drawAgentHealthBadge(ctx, 19, 21, 1.8, 0.2, 30, false, true);
      break;
    case 'speechBubble':
      ctx.fillStyle = '#fffdf2';
      ctx.fillRect(5, 8, 26, 14);
      ctx.strokeStyle = '#141824';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(5.5, 8.5, 25, 13);
      ctx.fillStyle = '#fffdf2';
      ctx.fillRect(14, 22, 4, 4);
      ctx.fillStyle = '#141824';
      ctx.fillRect(9, 13, 14, 2);
      ctx.fillRect(9, 17, 9, 2);
      break;
  }
}

const LegendIconSwatch: React.FC<{ id: LegendIconId }> = ({ id }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawLegendSwatch(ctx, id);
  }, [id]);

  return (
    <canvas
      ref={ref}
      width={36}
      height={36}
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        background: '#111524',
        border: '1px solid #2b3554',
        imageRendering: 'pixelated',
      }}
    />
  );
};

interface IconLegendModalProps {
  onClose: () => void;
}

export const IconLegendModal: React.FC<IconLegendModalProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [category, setCategory] = useState<LegendCategory>('all');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(
    () => (category === 'all' ? LEGEND_ENTRIES : LEGEND_ENTRIES.filter((e) => e.category === category)),
    [category],
  );

  const pills: Array<{ id: LegendCategory; label: string; count: number }> = [
    { id: 'all', label: t.legendModal.catAll, count: LEGEND_ENTRIES.length },
    { id: 'tools', label: t.legendModal.catTools, count: LEGEND_ENTRIES.filter((e) => e.category === 'tools').length },
    { id: 'status', label: t.legendModal.catStatus, count: LEGEND_ENTRIES.filter((e) => e.category === 'status').length },
    { id: 'social', label: t.legendModal.catSocial, count: LEGEND_ENTRIES.filter((e) => e.category === 'social').length },
    { id: 'health', label: t.legendModal.catHealth, count: LEGEND_ENTRIES.filter((e) => e.category === 'health').length },
  ];

  return (
    <div className="pixel-modal-backdrop" onClick={onClose}>
      <div
        className="pixel-panel pixel-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 14, gap: 10, maxWidth: 740, width: '94vw' }}
      >
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="pixel-title" style={{ fontSize: 11, color: '#ffd147' }}>
              {t.legendModal.title}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.legendModal.subtitle}</span>
          </div>
          <button
            type="button"
            className="pixel-btn"
            onClick={() => {
              playSelectBlip();
              onClose();
            }}
          >
            {t.legendModal.close}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pills.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pixel-btn ${category === p.id ? 'cyan' : ''}`}
              style={{ fontSize: 10, padding: '4px 8px' }}
              onClick={() => {
                playSelectBlip();
                setCategory(p.id);
              }}
            >
              {p.label} ({p.count})
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: 8,
            maxHeight: '62vh',
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {filtered.map((entry) => {
            const copy = t.legendModal.items[entry.id];
            return (
              <div
                key={entry.id}
                className="pixel-panel-inset"
                style={{
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <LegendIconSwatch id={entry.id} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#e8efff' }}>{copy.title}</span>
                  <span style={{ fontSize: 10, color: '#9aa7c7', lineHeight: 1.35 }}>{copy.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
