import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PlazaFloor } from '../../shared/types';
import { playElevatorDing } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

interface PlazaTowerCanvasProps {
  floors: PlazaFloor[];
  selectedFloorId: string | null;
  isNight: boolean;
  onSelectFloor: (floorId: string) => void;
}

interface FloorHitBox {
  floor: PlazaFloor;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const PlazaTowerCanvas: React.FC<PlazaTowerCanvasProps> = ({
  floors,
  selectedFloorId,
  isNight,
  onSelectFloor,
}) => {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredFloorId, setHoveredFloorId] = useState<string | null>(null);
  const [scrollOffsetY, setScrollOffsetY] = useState(0);

  // Order floors bottom-to-top: lobby/lowest floorNumber at bottom, demo penthouse at top
  const orderedFloors = useMemo(() => {
    return [...floors].sort((a, b) => {
      if (a.isDemo && !b.isDemo) return 1;
      if (!a.isDemo && b.isDemo) return -1;
      return a.floorNumber - b.floorNumber;
    });
  }, [floors]);

  const orderedRef = useRef(orderedFloors);
  orderedRef.current = orderedFloors;

  const isNightRef = useRef(isNight);
  isNightRef.current = isNight;

  const hoveredRef = useRef(hoveredFloorId);
  hoveredRef.current = hoveredFloorId;

  const selectedRef = useRef(selectedFloorId);
  selectedRef.current = selectedFloorId;

  const scrollRef = useRef(scrollOffsetY);
  scrollRef.current = scrollOffsetY;

  const tRef = useRef(t);
  tRef.current = t;

  const hitBoxesRef = useRef<FloorHitBox[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let rafId = 0;

    const render = (now: number) => {
      const timeSec = now / 1000;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        rafId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafId = requestAnimationFrame(render);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      const night = isNightRef.current;
      const list = orderedRef.current;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;

      // 1. Dynamic Day / Night Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      if (night) {
        skyGrad.addColorStop(0, '#090d1f');
        skyGrad.addColorStop(0.65, '#151c3b');
        skyGrad.addColorStop(1, '#1f284f');
      } else {
        skyGrad.addColorStop(0, '#3c8ce7');
        skyGrad.addColorStop(0.65, '#72c2f7');
        skyGrad.addColorStop(1, '#b6e3ff');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Sun or Moon + Stars / Clouds
      if (night) {
        // Twinkling pixel stars
        for (let i = 0; i < 42; i++) {
          const sx = ((i * 197 + 43) % Math.max(1, w));
          const sy = ((i * 89 + 29) % Math.max(1, Math.floor(h * 0.65)));
          const bright = Math.sin(timeSec * 2.5 + i) > 0.2 ? 3 : 2;
          ctx.fillStyle = i % 5 === 0 ? '#9ee8ff' : '#fff8cf';
          ctx.fillRect(sx, sy, bright, bright);
        }
        // Pixel Moon
        const mx = w - 110;
        const my = 72;
        ctx.fillStyle = '#fff3b0';
        ctx.fillRect(mx - 18, my - 18, 36, 36);
        ctx.fillStyle = '#0f1530';
        ctx.fillRect(mx - 6, my - 14, 18, 22);
      } else {
        // Pixel Sun
        const sunX = w - 110;
        const sunY = 74;
        ctx.fillStyle = '#ffe64d';
        ctx.fillRect(sunX - 20, sunY - 20, 40, 40);
        ctx.fillStyle = '#fff59e';
        ctx.fillRect(sunX - 14, sunY - 14, 28, 28);

        // Drifting pixel clouds
        for (let c = 0; c < 5; c++) {
          const speed = 12 + c * 4;
          const cx = ((c * 240 + timeSec * speed) % (w + 160)) - 80;
          const cy = 58 + (c % 3) * 52;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(Math.round(cx), cy, 68, 18);
          ctx.fillRect(Math.round(cx + 12), cy - 10, 40, 12);
        }
      }

      // 2. Background City Skyline
      const groundY = h - 46;
      const buildings = [
        { x: 0.04, bw: 58, bh: 140 },
        { x: 0.11, bw: 72, bh: 210 },
        { x: 0.19, bw: 54, bh: 120 },
        { x: 0.74, bw: 66, bh: 190 },
        { x: 0.82, bw: 80, bh: 240 },
        { x: 0.91, bw: 64, bh: 150 },
      ];
      buildings.forEach((b, idx) => {
        const bx = Math.round(b.x * w);
        const by = groundY - b.bh;
        ctx.fillStyle = night ? '#11162b' : '#4f6d96';
        ctx.fillRect(bx, by, b.bw, b.bh);
        ctx.fillStyle = night ? '#1b2240' : '#6585b0';
        ctx.fillRect(bx + 4, by + 4, b.bw - 8, 6);
        if (night) {
          for (let wy = by + 18; wy < groundY - 16; wy += 18) {
            for (let wx = bx + 10; wx < bx + b.bw - 12; wx += 14) {
              const lit = ((wx + wy + idx * 7) % 5) !== 0;
              ctx.fillStyle = lit ? '#ffcf56' : '#1d2542';
              ctx.fillRect(wx, wy, 7, 9);
            }
          }
        }
      });

      // Street / Plaza Ground
      ctx.fillStyle = night ? '#161b29' : '#3a4254';
      ctx.fillRect(0, groundY, w, 46);
      ctx.fillStyle = '#5a6680';
      ctx.fillRect(0, groundY, w, 4);

      // 3. Draw Central Isometric-Styled Plaza Skyscraper
      const towerW = Math.min(440, Math.max(300, w * 0.44));
      const sideDepth = 34;
      const floorH = 68;
      const towerX = Math.round((w - towerW - sideDepth) / 2);
      const baseFloorY = groundY - 8 + scrollRef.current;

      const nextHitBoxes: FloorHitBox[] = [];

      // Rooftop antenna / sign above highest floor
      const topY = baseFloorY - list.length * floorH;
      if (list.length > 0) {
        ctx.fillStyle = '#252c40';
        ctx.fillRect(towerX + 20, topY - 22, towerW - 40, 22);
        ctx.fillStyle = '#121624';
        ctx.fillRect(towerX + towerW / 2 - 4, topY - 56, 8, 34);
        const beacon = Math.sin(timeSec * 4) > 0 ? '#ff5666' : '#851f2b';
        ctx.fillStyle = beacon;
        ctx.fillRect(towerX + towerW / 2 - 5, topY - 62, 10, 8);

        ctx.font = 'bold 10px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffd147';
        ctx.textAlign = 'center';
        ctx.fillText('ANTIGRAVITY PLAZA', towerX + towerW / 2, topY - 7);
      }

      list.forEach((floor, idx) => {
        const fy = baseFloorY - (idx + 1) * floorH;
        const isHovered = hoveredRef.current === floor.id;
        const isSelected = selectedRef.current === floor.id;

        nextHitBoxes.push({
          floor,
          x: towerX,
          y: fy,
          w: towerW + sideDepth,
          h: floorH,
        });

        // Main front facade
        const facadeColor = floor.isDemo
          ? night
            ? '#332859'
            : '#4c3c82'
          : floor.floorNumber === 0
            ? night
              ? '#24304a'
              : '#3c5078'
            : night
              ? '#273147'
              : '#425273';

        ctx.fillStyle = facadeColor;
        ctx.fillRect(towerX, fy, towerW, floorH);

        // 2.5D Isometric right-side wall
        ctx.beginPath();
        ctx.moveTo(towerX + towerW, fy);
        ctx.lineTo(towerX + towerW + sideDepth, fy - 14);
        ctx.lineTo(towerX + towerW + sideDepth, fy + floorH - 14);
        ctx.lineTo(towerX + towerW, fy + floorH);
        ctx.closePath();
        ctx.fillStyle = night ? '#171d2b' : '#2b364d';
        ctx.fill();
        ctx.strokeStyle = '#0d1018';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Floor border & highlight
        ctx.strokeStyle = isHovered ? '#3cd8ff' : isSelected ? '#ffd147' : '#101420';
        ctx.lineWidth = isHovered || isSelected ? 3 : 2;
        ctx.strokeRect(towerX, fy, towerW, floorH);

        // Floor number badge
        const floorCode = floor.isDemo
          ? tRef.current.elevator.penthouse
          : floor.floorNumber === 0
            ? tRef.current.elevator.lobby
            : `${tRef.current.elevator.floorPrefix}${floor.floorNumber}`;

        ctx.fillStyle = '#101420';
        ctx.fillRect(towerX + 8, fy + 8, 36, 20);
        ctx.font = 'bold 10px "Press Start 2P", monospace';
        ctx.fillStyle = floor.activeCount > 0 ? '#3be87a' : '#ffd147';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(floorCode, towerX + 26, fy + 19);

        // Company Name Sign
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#f4f6fc';
        ctx.textAlign = 'left';
        const label =
          floor.companyName.length > 22 ? `${floor.companyName.slice(0, 21)}…` : floor.companyName;
        ctx.fillText(label, towerX + 52, fy + 18);

        // Tier badge
        ctx.font = 'bold 8px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffbe3b';
        ctx.textAlign = 'right';
        ctx.fillText(`T${floor.tier}`, towerX + towerW - 10, fy + 18);

        // Windows row (proportional to activeCount & waitingCount)
        const totalWindows = 8;
        const winW = Math.floor((towerW - 72) / totalWindows) - 6;
        const winH = 22;
        const winY = fy + 34;

        for (let wi = 0; wi < totalWindows; wi++) {
          const wx = towerX + 52 + wi * (winW + 6);
          let winColor = night ? '#131929' : '#263959';
          if (wi < floor.activeCount) {
            // Warm glowing yellow window for active agents
            winColor = Math.sin(timeSec * 3 + wi) > -0.7 ? '#ffd65c' : '#ffbe3b';
          } else if (wi < floor.activeCount + floor.waitingCount) {
            // Cool dim blue window for waiting agents
            winColor = '#3a6ea5';
          }
          ctx.fillStyle = winColor;
          ctx.fillRect(wx, winY, winW, winH);
          ctx.strokeStyle = '#0e121c';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(wx, winY, winW, winH);
        }
      });

      // 4. Animated Glass Elevator Car on the left shaft
      if (list.length > 0) {
        const shaftX = towerX - 30;
        const shaftTop = topY;
        const shaftH = list.length * floorH;
        ctx.fillStyle = 'rgba(15, 21, 36, 0.85)';
        ctx.fillRect(shaftX, shaftTop, 24, shaftH);
        ctx.strokeStyle = '#394769';
        ctx.lineWidth = 2;
        ctx.strokeRect(shaftX, shaftTop, 24, shaftH);

        const travel = list.length > 1 ? (Math.sin(timeSec * 0.55) * 0.5 + 0.5) : 0;
        const carY = shaftTop + (shaftH - 38) * (1 - travel);
        ctx.fillStyle = '#5ee6ff';
        ctx.fillRect(shaftX + 3, carY, 18, 34);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(shaftX + 5, carY + 4, 4, 24);
        ctx.strokeStyle = '#0e121c';
        ctx.strokeRect(shaftX + 3, carY, 18, 34);
      }

      hitBoxesRef.current = nextHitBoxes;
      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;

    let found: string | null = null;
    for (const box of hitBoxesRef.current) {
      if (lx >= box.x && lx <= box.x + box.w && ly >= box.y && ly <= box.y + box.h) {
        found = box.floor.id;
        break;
      }
    }
    setHoveredFloorId(found);
  };

  const handleClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;

    for (const box of hitBoxesRef.current) {
      if (lx >= box.x && lx <= box.x + box.w && ly >= box.y && ly <= box.y + box.h) {
        playElevatorDing();
        onSelectFloor(box.floor.id);
        return;
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    setScrollOffsetY((prev) => Math.max(-400, Math.min(400, prev - e.deltaY * 0.35)));
  };

  const hoveredFloor = orderedFloors.find((f) => f.id === hoveredFloorId) || null;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handleClick}
        onWheel={handleWheel}
        style={{ display: 'block', cursor: hoveredFloorId ? 'pointer' : 'default' }}
      />

      {/* Top-left Plaza Header */}
      <div
        className="pixel-panel"
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          padding: '10px 14px',
          pointerEvents: 'none',
        }}
      >
        <div className="pixel-title" style={{ fontSize: 11, color: '#ffd147', marginBottom: 4 }}>
          {t.plaza.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t.plaza.subtitle}</div>
      </div>

      {/* Hover Tooltip */}
      {hoveredFloor && (
        <div
          className="pixel-panel"
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            pointerEvents: 'none',
          }}
        >
          <span className="pixel-title" style={{ fontSize: 10, color: '#3cd8ff' }}>
            {hoveredFloor.companyName}
          </span>
          <span className="pixel-badge" style={{ color: '#ffbe3b' }}>
            {t.companyTiers[hoveredFloor.tier]}
          </span>
          <span style={{ fontSize: 12, color: '#3be87a' }}>
            {hoveredFloor.activeCount} {t.hud.active}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {hoveredFloor.employees.length} {t.plaza.employees}
          </span>
        </div>
      )}
    </div>
  );
};
