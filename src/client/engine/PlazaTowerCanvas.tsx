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
        skyGrad.addColorStop(0, '#070b1a');
        skyGrad.addColorStop(0.55, '#111836');
        skyGrad.addColorStop(1, '#1d274d');
      } else {
        skyGrad.addColorStop(0, '#327fd9');
        skyGrad.addColorStop(0.6, '#6abdf5');
        skyGrad.addColorStop(1, '#b6e3ff');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Sun or Moon + Stars / Clouds
      if (night) {
        for (let i = 0; i < 52; i++) {
          const sx = (i * 197 + 43) % Math.max(1, w);
          const sy = (i * 89 + 29) % Math.max(1, Math.floor(h * 0.65));
          const bright = Math.sin(timeSec * 2.5 + i) > 0.2 ? 3 : 2;
          ctx.fillStyle = i % 5 === 0 ? '#9ee8ff' : '#fff8cf';
          ctx.fillRect(sx, sy, bright, bright);
        }
        const mx = w - 110;
        const my = 72;
        ctx.fillStyle = 'rgba(255, 243, 176, 0.14)';
        ctx.fillRect(mx - 26, my - 26, 52, 52);
        ctx.fillStyle = '#fff3b0';
        ctx.fillRect(mx - 18, my - 18, 36, 36);
        ctx.fillStyle = '#0c1229';
        ctx.fillRect(mx - 6, my - 14, 18, 22);
      } else {
        const sunX = w - 110;
        const sunY = 74;
        ctx.fillStyle = 'rgba(255, 230, 77, 0.22)';
        ctx.fillRect(sunX - 28, sunY - 28, 56, 56);
        ctx.fillStyle = '#ffe64d';
        ctx.fillRect(sunX - 20, sunY - 20, 40, 40);
        ctx.fillStyle = '#fff59e';
        ctx.fillRect(sunX - 14, sunY - 14, 28, 28);

        for (let c = 0; c < 6; c++) {
          const speed = 10 + c * 3.5;
          const cx = ((c * 240 + timeSec * speed) % (w + 180)) - 90;
          const cy = 54 + (c % 3) * 48;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.fillRect(Math.round(cx), cy, 72, 18);
          ctx.fillRect(Math.round(cx + 12), cy - 10, 44, 12);
          ctx.fillStyle = 'rgba(210, 232, 255, 0.65)';
          ctx.fillRect(Math.round(cx + 4), cy + 14, 64, 4);
        }
      }

      // 2. Multi-Layered Panoramic City Skyline
      const groundY = h - 48;
      const farBuildings = [
        { x: 0.01, bw: 62, bh: 175 },
        { x: 0.08, bw: 54, bh: 130 },
        { x: 0.16, bw: 70, bh: 225 },
        { x: 0.25, bw: 48, bh: 115 },
        { x: 0.70, bw: 58, bh: 145 },
        { x: 0.78, bw: 76, bh: 235 },
        { x: 0.87, bw: 62, bh: 185 },
        { x: 0.94, bw: 66, bh: 135 },
      ];
      farBuildings.forEach((b) => {
        const bx = Math.round(b.x * w);
        const by = groundY - b.bh;
        ctx.fillStyle = night ? '#0e1326' : '#6382ab';
        ctx.fillRect(bx, by, b.bw, b.bh);
        ctx.fillStyle = night ? '#151c36' : '#7797bf';
        ctx.fillRect(bx + 3, by + 3, b.bw - 6, 4);
      });

      const nearBuildings = [
        { x: 0.04, bw: 58, bh: 140 },
        { x: 0.12, bw: 72, bh: 198 },
        { x: 0.20, bw: 52, bh: 112 },
        { x: 0.74, bw: 66, bh: 178 },
        { x: 0.82, bw: 80, bh: 218 },
        { x: 0.91, bw: 64, bh: 146 },
      ];
      nearBuildings.forEach((b, idx) => {
        const bx = Math.round(b.x * w);
        const by = groundY - b.bh;
        ctx.fillStyle = night ? '#131930' : '#4a6891';
        ctx.fillRect(bx, by, b.bw, b.bh);
        ctx.fillStyle = night ? '#1f284a' : '#5e7fa8';
        ctx.fillRect(bx + 4, by + 4, b.bw - 8, 6);
        // Rooftop spire on alternating buildings
        if (idx % 2 === 1) {
          ctx.fillStyle = night ? '#273157' : '#3d577a';
          ctx.fillRect(bx + Math.floor(b.bw / 2) - 2, by - 14, 4, 14);
        }
        if (night) {
          for (let wy = by + 18; wy < groundY - 16; wy += 16) {
            for (let wx = bx + 10; wx < bx + b.bw - 12; wx += 13) {
              const lit = (wx + wy + idx * 7) % 5 !== 0;
              ctx.fillStyle = lit ? '#ffcf56' : '#1b223d';
              ctx.fillRect(wx, wy, 6, 8);
            }
          }
        }
      });

      // Street / Plaza Sidewalk, Curbs, Street Lamps & Trees
      ctx.fillStyle = night ? '#141926' : '#343c4d';
      ctx.fillRect(0, groundY, w, 48);
      ctx.fillStyle = night ? '#262f45' : '#5b6882';
      ctx.fillRect(0, groundY, w, 6);
      ctx.fillStyle = night ? '#35415e' : '#7483a1';
      for (let px = 0; px < w; px += 28) {
        ctx.fillRect(px, groundY + 1, 24, 2);
      }

      // 3. Draw Central 2.5D Curtain-Wall Plaza Skyscraper
      const towerW = Math.min(440, Math.max(300, w * 0.44));
      const sideDepth = 36;
      const floorH = 68;
      const lobbyPlinthH = 22;
      const towerX = Math.round((w - towerW - sideDepth) / 2);
      const baseFloorY = groundY - lobbyPlinthH + scrollRef.current;

      // Curbside trees & street lamps flanking the Plaza Tower
      const streetProps = [towerX - 58, towerX + towerW + sideDepth + 34];
      for (const lx of streetProps) {
        if (lx < 16 || lx > w - 16) continue;
        // Street lamp post
        ctx.fillStyle = '#252c3d';
        ctx.fillRect(lx, groundY - 38, 3, 38);
        ctx.fillRect(lx - 4, groundY - 40, 11, 3);
        ctx.fillStyle = night ? '#ffe680' : '#d5e4f5';
        ctx.fillRect(lx - 2, groundY - 37, 7, 4);
        if (night) {
          ctx.fillStyle = 'rgba(255, 224, 112, 0.16)';
          ctx.beginPath();
          ctx.moveTo(lx - 2, groundY - 33);
          ctx.lineTo(lx + 5, groundY - 33);
          ctx.lineTo(lx + 18, groundY);
          ctx.lineTo(lx - 15, groundY);
          ctx.closePath();
          ctx.fill();
        }
      }
      const treePositions = [towerX - 92, towerX + towerW + sideDepth + 68];
      for (const tx of treePositions) {
        if (tx < 20 || tx > w - 20) continue;
        ctx.fillStyle = '#4d3320';
        ctx.fillRect(tx - 2, groundY - 16, 5, 16);
        ctx.fillStyle = night ? '#1c4d39' : '#2d8a5e';
        ctx.fillRect(tx - 10, groundY - 30, 21, 16);
        ctx.fillStyle = night ? '#25664b' : '#3eb87a';
        ctx.fillRect(tx - 7, groundY - 35, 15, 8);
      }

      // Double-Height Illuminated Glass Entrance Lobby Plinth at ground level
      if (list.length > 0) {
        ctx.fillStyle = night ? '#182033' : '#2b3954';
        ctx.fillRect(towerX, baseFloorY, towerW, lobbyPlinthH);
        // 2.5D right side of lobby
        ctx.beginPath();
        ctx.moveTo(towerX + towerW, baseFloorY);
        ctx.lineTo(towerX + towerW + sideDepth, baseFloorY - 14);
        ctx.lineTo(towerX + towerW + sideDepth, baseFloorY + lobbyPlinthH - 14);
        ctx.lineTo(towerX + towerW, baseFloorY + lobbyPlinthH);
        ctx.closePath();
        ctx.fillStyle = night ? '#111726' : '#212c42';
        ctx.fill();

        // Warm illuminated glass entrance canopy & revolving doors
        const doorW = 86;
        const doorX = Math.round(towerX + towerW / 2 - doorW / 2);
        ctx.fillStyle = '#5e6d8a';
        ctx.fillRect(doorX - 10, baseFloorY - 2, doorW + 20, 4);
        ctx.fillStyle = night ? '#ffdf78' : '#7fe3ff';
        ctx.fillRect(doorX, baseFloorY + 2, doorW, lobbyPlinthH - 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(doorX + 6, baseFloorY + 3, 12, lobbyPlinthH - 6);
        ctx.fillRect(doorX + doorW - 22, baseFloorY + 3, 12, lobbyPlinthH - 6);
        // Revolving door mullions
        ctx.fillStyle = '#1b2336';
        ctx.fillRect(doorX + Math.floor(doorW / 2) - 1, baseFloorY + 2, 2, lobbyPlinthH - 4);
        ctx.fillRect(doorX + 24, baseFloorY + 2, 2, lobbyPlinthH - 4);
        ctx.fillRect(doorX + doorW - 26, baseFloorY + 2, 2, lobbyPlinthH - 4);
      }

      const nextHitBoxes: FloorHitBox[] = [];

      // Rooftop Neon SWARM PLAZA Crown Sign & Blinking Red Beacon Mast
      const topY = baseFloorY - list.length * floorH;
      if (list.length > 0) {
        // Parapet & steel truss crown
        ctx.fillStyle = '#1b2233';
        ctx.fillRect(towerX + 10, topY - 28, towerW - 20, 28);
        ctx.fillStyle = '#2d3752';
        ctx.fillRect(towerX + 10, topY - 28, towerW - 20, 3);
        ctx.fillStyle = '#0e121c';
        ctx.fillRect(towerX + 22, topY - 22, towerW - 44, 18);

        // Neon border pulse
        const neonPulse = Math.sin(timeSec * 3.2) > -0.4;
        ctx.strokeStyle = neonPulse ? '#3cd8ff' : '#2587a8';
        ctx.lineWidth = 2;
        ctx.strokeRect(towerX + 22, topY - 22, towerW - 44, 18);

        // Tall antenna mast + blinking red beacon
        const mastX = Math.round(towerX + towerW / 2);
        ctx.fillStyle = '#2e3852';
        ctx.fillRect(mastX - 4, topY - 64, 8, 36);
        ctx.fillStyle = '#4c5b82';
        ctx.fillRect(mastX - 2, topY - 76, 4, 14);
        const beaconOn = Math.sin(timeSec * 4.5) > 0;
        if (beaconOn) {
          ctx.fillStyle = 'rgba(255, 64, 92, 0.28)';
          ctx.fillRect(mastX - 9, topY - 86, 18, 16);
        }
        ctx.fillStyle = beaconOn ? '#ff405c' : '#6e1a26';
        ctx.fillRect(mastX - 4, topY - 82, 8, 7);

        ctx.font = 'bold 10px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffd147';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SWARM PLAZA', mastX, topY - 13);
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

        // Main steel curtain-wall facade + spandrel band
        const facadeColor = floor.isDemo
          ? night
            ? '#2d2352'
            : '#47397d'
          : floor.floorNumber === 0
            ? night
              ? '#1e2942'
              : '#34496e'
            : night
              ? '#202a40'
              : '#3b4d6e';

        ctx.fillStyle = facadeColor;
        ctx.fillRect(towerX, fy, towerW, floorH);

        // Top steel spandrel band
        ctx.fillStyle = night ? '#151b2b' : '#2a3752';
        ctx.fillRect(towerX, fy, towerW, 28);
        ctx.fillStyle = night ? '#313d5c' : '#53688f';
        ctx.fillRect(towerX, fy, towerW, 2);

        // 2.5D Isometric right-side curtain wall with spandrel bands
        ctx.beginPath();
        ctx.moveTo(towerX + towerW, fy);
        ctx.lineTo(towerX + towerW + sideDepth, fy - 14);
        ctx.lineTo(towerX + towerW + sideDepth, fy + floorH - 14);
        ctx.lineTo(towerX + towerW, fy + floorH);
        ctx.closePath();
        ctx.fillStyle = night ? '#131926' : '#253147';
        ctx.fill();
        ctx.strokeStyle = '#0d1018';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Side-wall spandrel & glass bay stripes
        ctx.fillStyle = night ? 'rgba(100, 170, 255, 0.08)' : 'rgba(180, 225, 255, 0.16)';
        ctx.beginPath();
        ctx.moveTo(towerX + towerW + 6, fy + 28);
        ctx.lineTo(towerX + towerW + sideDepth - 6, fy + 16);
        ctx.lineTo(towerX + towerW + sideDepth - 6, fy + floorH - 18);
        ctx.lineTo(towerX + towerW + 6, fy + floorH - 6);
        ctx.closePath();
        ctx.fill();

        // Floor border & hover/selection highlight
        ctx.strokeStyle = isHovered ? '#3cd8ff' : isSelected ? '#ffd147' : '#0f131f';
        ctx.lineWidth = isHovered || isSelected ? 3 : 2;
        ctx.strokeRect(towerX, fy, towerW, floorH);

        // Floor number badge
        const floorCode = floor.isDemo
          ? tRef.current.elevator.penthouse
          : floor.floorNumber === 0
            ? tRef.current.elevator.lobby
            : `${tRef.current.elevator.floorPrefix}${floor.floorNumber}`;

        ctx.fillStyle = '#0e131f';
        ctx.fillRect(towerX + 8, fy + 5, 36, 19);
        ctx.font = 'bold 10px "Press Start 2P", monospace';
        ctx.fillStyle = floor.activeCount > 0 ? '#3be87a' : '#ffd147';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(floorCode, towerX + 26, fy + 15);

        // Company Name Sign
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#f4f6fc';
        ctx.textAlign = 'left';
        const label =
          floor.companyName.length > 22 ? `${floor.companyName.slice(0, 21)}…` : floor.companyName;
        ctx.fillText(label, towerX + 52, fy + 15);

        // Tier badge
        ctx.font = 'bold 8px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffbe3b';
        ctx.textAlign = 'right';
        ctx.fillText(`T${floor.tier}`, towerX + towerW - 10, fy + 15);

        // Glass Curtain-Wall Bays with Steel Mullions & Micro Interior Silhouettes
        const totalWindows = 8;
        const winW = Math.floor((towerW - 68) / totalWindows) - 4;
        const winH = 26;
        const winY = fy + 33;

        for (let wi = 0; wi < totalWindows; wi++) {
          const wx = towerX + 48 + wi * (winW + 4);
          const isActiveWin = wi < floor.activeCount;
          const isWaitingWin = !isActiveWin && wi < floor.activeCount + floor.waitingCount;

          let winColor = night ? '#111829' : '#243a5c';
          if (isActiveWin) {
            winColor = Math.sin(timeSec * 3 + wi) > -0.7 ? '#ffd65c' : '#ffbe3b';
          } else if (isWaitingWin) {
            winColor = '#2f5987';
          }

          ctx.fillStyle = winColor;
          ctx.fillRect(wx, winY, winW, winH);

          // Micro desk, glowing monitor & agent silhouette inside occupied windows
          if (isActiveWin || isWaitingWin) {
            // Desk silhouette
            ctx.fillStyle = isActiveWin ? '#704d1b' : '#1b314d';
            ctx.fillRect(wx + 3, winY + winH - 6, Math.max(4, winW - 6), 4);
            // Tiny glowing monitor
            ctx.fillStyle = isActiveWin ? '#7ef3ff' : '#4a76a8';
            ctx.fillRect(wx + 4, winY + winH - 12, Math.max(4, Math.floor(winW * 0.36)), 5);
            // Tiny agent silhouette
            ctx.fillStyle = isActiveWin ? '#1f263b' : '#162438';
            ctx.fillRect(wx + Math.floor(winW * 0.56), winY + winH - 14, Math.max(4, Math.floor(winW * 0.28)), 8);
            ctx.fillRect(wx + Math.floor(winW * 0.58), winY + winH - 18, Math.max(3, Math.floor(winW * 0.24)), 4);
          } else {
            // Diagonal curtain-wall sky reflection
            ctx.fillStyle = night ? 'rgba(110, 175, 255, 0.1)' : 'rgba(195, 232, 255, 0.24)';
            ctx.fillRect(wx + 2, winY + 3, Math.max(3, Math.floor(winW * 0.45)), 3);
            ctx.fillRect(wx + 5, winY + 8, Math.max(3, Math.floor(winW * 0.35)), 2);
          }

          // Steel mullion frame
          ctx.strokeStyle = '#0e131f';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(wx, winY, winW, winH);
          // Specular steel mullion rib between bays
          ctx.fillStyle = night ? '#323f5e' : '#657da6';
          ctx.fillRect(wx + winW + 1, winY - 2, 2, winH + 4);
        }
      });

      // 4. Polished Glass Elevator Shaft & Cab on the left
      if (list.length > 0) {
        const shaftX = towerX - 32;
        const shaftTop = topY;
        const shaftH = list.length * floorH + lobbyPlinthH;
        ctx.fillStyle = 'rgba(13, 19, 34, 0.88)';
        ctx.fillRect(shaftX, shaftTop, 26, shaftH);
        // Steel guide rails
        ctx.fillStyle = '#4c5c82';
        ctx.fillRect(shaftX + 4, shaftTop + 2, 2, shaftH - 4);
        ctx.fillRect(shaftX + 20, shaftTop + 2, 2, shaftH - 4);
        ctx.strokeStyle = '#394769';
        ctx.lineWidth = 2;
        ctx.strokeRect(shaftX, shaftTop, 26, shaftH);

        const travel = list.length > 1 ? Math.sin(timeSec * 0.55) * 0.5 + 0.5 : 0;
        const carY = shaftTop + (shaftH - 40) * (1 - travel);
        // Traveling steel cable
        ctx.fillStyle = '#6c7da3';
        ctx.fillRect(shaftX + 12, shaftTop, 2, Math.max(1, Math.round(carY - shaftTop)));
        // Cab body & warm interior glow
        ctx.fillStyle = '#5ee6ff';
        ctx.fillRect(shaftX + 3, carY, 20, 36);
        ctx.fillStyle = night ? '#fff0a8' : '#d6f8ff';
        ctx.fillRect(shaftX + 6, carY + 5, 14, 24);
        // Diagonal glass shine
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(shaftX + 6, carY + 6, 4, 20);
        // Top/bottom steel caps
        ctx.fillStyle = '#252e45';
        ctx.fillRect(shaftX + 3, carY, 20, 4);
        ctx.fillRect(shaftX + 3, carY + 32, 20, 4);
        ctx.strokeStyle = '#0e121c';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(shaftX + 3, carY, 20, 36);
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
