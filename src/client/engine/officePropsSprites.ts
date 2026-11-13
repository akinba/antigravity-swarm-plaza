import type { OfficeZone } from '../../shared/types';
import { TILE_H, TILE_W } from './isoMath';
import type { ThemePalette } from './officeLayouts';
import type { Facing } from './pathfinding';

export type CustomPropKind =
  | 'phone_booth'
  | 'snack_vending'
  | 'arcade_cabinet'
  | 'library_table'
  | '3d_printer'
  | 'aquarium'
  | 'ping_pong'
  | 'bonsai'
  | 'elevator_doors';

export type FurnitureKind =
  | 'desk'
  | 'exec_desk'
  | 'dev_desk'
  | 'qa_desk'
  | 'chair'
  | 'desk_chair'
  | 'meeting_chair'
  | 'gaming_seat'
  | 'sofa'
  | 'sofa_l'
  | 'sofa_r'
  | 'armchair'
  | 'coffee_table'
  | 'lounge_table'
  | 'war_table'
  | 'tv_console'
  | 'coffee_machine'
  | 'watercooler'
  | 'water_cooler'
  | 'pizza_table'
  | 'plant'
  | 'office_plant'
  | 'bookshelf'
  | 'filing_cabinet'
  | 'server_rack'
  | 'whiteboard'
  | 'whiteboard_l'
  | 'whiteboard_r'
  | 'glass_partition'
  | 'glass_partition_x'
  | 'wood_partition'
  | 'wood_partition_x'
  | 'prop_plant'
  | 'prop_trophy'
  | 'prop_arcade'
  | 'prop_hologram'
  | (string & {});

const DEFAULT_THEME_PALETTE: ThemePalette = {
  id: 0,
  nameTr: 'Bal Meşe & Kum',
  nameEn: 'Honey Oak & Sand',
  woodDay: ['#a87849', '#996c40', '#6e4b2b'],
  woodNight: ['#63452f', '#563b28', '#362316'],
  carpetDay: ['#cfc6b4', '#c4baa6', '#a89e8c'],
  carpetNight: ['#4b4658', '#433e50', '#332f3d'],
  confDay: ['#2e4f82', '#284573', '#4a73b0'],
  confNight: ['#1e3152', '#192945', '#2c4673'],
};

const MODEL_ACCENT_COLORS: Record<string, string> = {
  argon: '#b88cff',
  hydrogen: '#5cf0ff',
  flash: '#3be87a',
  carbon: '#ff6b81',
  pro: '#ffd147',
  claude: '#ff9e66',
  gpt: '#5ef2b8',
  other: '#9db4ff',
};

function pxRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.ceil(w)),
    Math.max(1, Math.ceil(h)),
  );
}

function pxStrokeRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.strokeRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.ceil(w)),
    Math.max(1, Math.ceil(h)),
  );
}

function drawFloorShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  zoom: number,
  alpha = 0.26,
): void {
  const hw = rx * zoom;
  const hh = ry * zoom;
  ctx.fillStyle = `rgba(8, 11, 20, ${alpha})`;
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1.5 * zoom, Math.max(1, hw), Math.max(1, hh), 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh + 1.5 * zoom);
    ctx.lineTo(cx + hw, cy + 1.5 * zoom);
    ctx.lineTo(cx, cy + hh + 1.5 * zoom);
    ctx.lineTo(cx - hw, cy + 1.5 * zoom);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  d: number,
  h: number,
  topColor: string,
  leftColor: string,
  rightColor: string,
  zoom: number,
  bevelHighlight = 'rgba(255, 255, 255, 0.2)',
): void {
  const hw = w * zoom;
  const hh = d * zoom;
  const hz = h * zoom;

  ctx.beginPath();
  ctx.moveTo(cx, cy - hh - hz);
  ctx.lineTo(cx + hw, cy - hz);
  ctx.lineTo(cx, cy + hh - hz);
  ctx.lineTo(cx - hw, cy - hz);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.strokeStyle = '#11131c';
  ctx.lineWidth = Math.max(1, zoom);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - hw, cy - hz);
  ctx.lineTo(cx, cy + hh - hz);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + hw, cy - hz);
  ctx.lineTo(cx, cy + hh - hz);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx + hw, cy);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
  ctx.stroke();

  // Subtle 2.5D top-front bevel edge highlight
  if (bevelHighlight) {
    ctx.beginPath();
    ctx.moveTo(cx - hw + 1 * zoom, cy - hz + 0.5 * zoom);
    ctx.lineTo(cx, cy + hh - hz - 0.8 * zoom);
    ctx.lineTo(cx + hw - 1 * zoom, cy - hz + 0.5 * zoom);
    ctx.strokeStyle = bevelHighlight;
    ctx.lineWidth = Math.max(1, 0.9 * zoom);
    ctx.stroke();
  }
}

function isoDiamondPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

/**
 * Renders high-craft 2.5D architectural floor tiles across all office zones:
 * - Desk zones (`DESK_ARCHITECT`, `DESK_CODING`, `DESK_QA`): beveled staggered wood parquet with grain & joints
 * - `COFFEE_LOUNGE`: framed woven plush carpet tiles with tactile bouclé weave
 * - `SERVER_RACK`: perforated raised metal panels, corner rivets & night under-floor cyan fiber glow
 * - `WAR_ROOM`: polished anthracite/cobalt stone slabs with diagonal specular veins
 * - `ELEVATOR` & `(0, 6..7)`: honed natural stone tiles with brushed steel elevator threshold
 */
export function drawEnhancedFloorTile(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  sx: number,
  sy: number,
  zoom: number,
  zone: OfficeZone,
  palette: ThemePalette = DEFAULT_THEME_PALETTE,
  night = false,
  timeSec = 0,
): void {
  const z = zoom;
  const hw = (TILE_W / 2) * z;
  const hh = (TILE_H / 2) * z;
  const checker = (gx + gy) % 2 === 0;
  const pal = palette ?? DEFAULT_THEME_PALETTE;

  ctx.save();

  if (zone === 'DESK_ARCHITECT' || zone === 'DESK_CODING' || zone === 'DESK_QA') {
    // Staggered beveled hardwood parquet planks
    const wood = night ? pal.woodNight : pal.woodDay;
    const fill = checker ? wood[0] : wood[1];
    const joint = wood[2];

    isoDiamondPath(ctx, sx, sy, hw, hh);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, z);
    ctx.strokeStyle = joint;
    ctx.stroke();

    // Top-left & top-right subtle bevel highlight
    ctx.beginPath();
    ctx.moveTo(sx - hw + 2 * z, sy);
    ctx.lineTo(sx, sy - hh + 1 * z);
    ctx.lineTo(sx + hw - 2 * z, sy);
    ctx.strokeStyle = night ? 'rgba(255, 224, 180, 0.10)' : 'rgba(255, 245, 220, 0.24)';
    ctx.lineWidth = Math.max(1, 0.9 * z);
    ctx.stroke();

    // Longitudinal parquet plank seams (2:1 NW->SE axis) + staggered cross-joint
    ctx.strokeStyle = night ? 'rgba(18, 10, 5, 0.36)' : 'rgba(65, 34, 12, 0.28)';
    ctx.lineWidth = Math.max(1, 0.85 * z);
    ctx.beginPath();
    ctx.moveTo(sx - hw * 0.5, sy - hh * 0.5);
    ctx.lineTo(sx + hw * 0.5, sy + hh * 0.5);
    ctx.moveTo(sx - hw * 0.72, sy - hh * 0.14);
    ctx.lineTo(sx + hw * 0.18, sy + hh * 0.76);
    ctx.moveTo(sx - hw * 0.18, sy - hh * 0.76);
    ctx.lineTo(sx + hw * 0.72, sy + hh * 0.14);
    ctx.stroke();

    // Staggered cross-plank joint & wood grain dowel accent
    const shift = ((gx * 3 + gy * 2) % 3) - 1;
    const jx = sx + shift * 5 * z;
    const jy = sy + shift * 2.5 * z;
    ctx.beginPath();
    ctx.moveTo(jx - 5 * z, jy + 2.5 * z);
    ctx.lineTo(jx + 5 * z, jy - 2.5 * z);
    ctx.stroke();

    ctx.fillStyle = zone === 'DESK_ARCHITECT'
      ? night ? 'rgba(255, 209, 115, 0.16)' : 'rgba(255, 236, 179, 0.28)'
      : night ? 'rgba(0, 0, 0, 0.20)' : 'rgba(82, 45, 18, 0.20)';
    pxRect(ctx, sx - 4 * z, sy - 1 * z, 3 * z, 1.2 * z);
    pxRect(ctx, sx + 2 * z, sy + 1 * z, 2.5 * z, 1.2 * z);
  } else if (zone === 'COFFEE_LOUNGE') {
    // Framed woven plush lounge carpet tiles
    const carpet = night ? pal.carpetNight : pal.carpetDay;
    const outerFill = checker ? carpet[0] : carpet[1];
    const borderStroke = carpet[2];

    isoDiamondPath(ctx, sx, sy, hw, hh);
    ctx.fillStyle = outerFill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, z);
    ctx.strokeStyle = borderStroke;
    ctx.stroke();

    // Inner woven plush inset frame
    isoDiamondPath(ctx, sx, sy, hw * 0.78, hh * 0.78);
    ctx.fillStyle = checker ? carpet[1] : carpet[0];
    ctx.fill();
    ctx.strokeStyle = night ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.26)';
    ctx.lineWidth = Math.max(1, 0.8 * z);
    ctx.stroke();

    // Tactile bouclé carpet weave tufts
    ctx.fillStyle = night ? 'rgba(20, 16, 28, 0.28)' : 'rgba(92, 74, 58, 0.18)';
    pxRect(ctx, sx - 7 * z, sy - 1 * z, 2 * z, 1.2 * z);
    pxRect(ctx, sx - 1 * z, sy - 4 * z, 2 * z, 1.2 * z);
    pxRect(ctx, sx + 5 * z, sy - 1 * z, 2 * z, 1.2 * z);
    pxRect(ctx, sx - 1 * z, sy + 3 * z, 2 * z, 1.2 * z);
  } else if (zone === 'SERVER_RACK') {
    // Perforated raised-access metal floor panels + corner rivets + night cyan underglow
    const panelFill = checker ? '#1c2436' : '#161d2c';
    isoDiamondPath(ctx, sx, sy, hw, hh);
    ctx.fillStyle = panelFill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.1 * z);
    ctx.strokeStyle = '#2d3f5e';
    ctx.stroke();

    // Beveled metallic inner rim
    isoDiamondPath(ctx, sx, sy, hw * 0.86, hh * 0.86);
    ctx.strokeStyle = 'rgba(130, 175, 230, 0.16)';
    ctx.lineWidth = Math.max(1, 0.8 * z);
    ctx.stroke();

    // 4 corner rivets
    ctx.fillStyle = '#5d7499';
    pxRect(ctx, sx - 1 * z, sy - hh + 3.5 * z, 1.6 * z, 1.4 * z);
    pxRect(ctx, sx - 1 * z, sy + hh - 5 * z, 1.6 * z, 1.4 * z);
    pxRect(ctx, sx - hw + 6.5 * z, sy - 0.7 * z, 1.6 * z, 1.4 * z);
    pxRect(ctx, sx + hw - 8.2 * z, sy - 0.7 * z, 1.6 * z, 1.4 * z);

    // Perforated airflow grille + night under-floor cyan cable glow
    const glowPulse = 0.22 + 0.1 * Math.sin(timeSec * 2.4 + gx * 0.7 + gy * 0.5);
    ctx.fillStyle = night ? `rgba(60, 216, 255, ${glowPulse.toFixed(3)})` : '#263a57';
    pxRect(ctx, sx - 6 * z, sy - 2 * z, 3.5 * z, 1.4 * z);
    pxRect(ctx, sx - 1 * z, sy - 2 * z, 3.5 * z, 1.4 * z);
    pxRect(ctx, sx + 4 * z, sy - 2 * z, 3.5 * z, 1.4 * z);
    pxRect(ctx, sx - 3.5 * z, sy + 1.2 * z, 3.5 * z, 1.4 * z);
    pxRect(ctx, sx + 1.5 * z, sy + 1.2 * z, 3.5 * z, 1.4 * z);
  } else if (zone === 'WAR_ROOM') {
    // Polished anthracite/cobalt marble stone tiles with diagonal specular sheen
    const conf = night ? pal.confNight : pal.confDay;
    isoDiamondPath(ctx, sx, sy, hw, hh);
    ctx.fillStyle = checker ? conf[0] : conf[1];
    ctx.fill();
    ctx.lineWidth = Math.max(1, z);
    ctx.strokeStyle = conf[2];
    ctx.stroke();

    // Diagonal polished stone specular reflection lines
    ctx.strokeStyle = night ? 'rgba(170, 214, 255, 0.16)' : 'rgba(235, 246, 255, 0.26)';
    ctx.lineWidth = Math.max(1, 0.95 * z);
    ctx.beginPath();
    ctx.moveTo(sx - 10 * z, sy + 2 * z);
    ctx.lineTo(sx + 4 * z, sy - 5 * z);
    ctx.moveTo(sx - 2 * z, sy + 5 * z);
    ctx.lineTo(sx + 10 * z, sy - 1 * z);
    ctx.stroke();

    // Subtle stone mineral fleck
    ctx.fillStyle = night ? 'rgba(140, 195, 255, 0.18)' : 'rgba(255, 255, 255, 0.22)';
    pxRect(ctx, sx - 3 * z, sy - 1.5 * z, 2.5 * z, 1.2 * z);
    pxRect(ctx, sx + 3 * z, sy + 1.2 * z, 2 * z, 1.2 * z);
  } else {
    // ELEVATOR & natural honed stone corridor tiles + brushed metal threshold on (0, 6..7)
    const stoneFill = night
      ? checker ? '#252c3f' : '#1f2536'
      : checker ? '#414a63' : '#384057';
    const groutStroke = night ? '#151926' : '#262c3d';

    isoDiamondPath(ctx, sx, sy, hw, hh);
    ctx.fillStyle = stoneFill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.1 * z);
    ctx.strokeStyle = groutStroke;
    ctx.stroke();

    // Recessed inner stone bevel
    isoDiamondPath(ctx, sx, sy, hw * 0.88, hh * 0.88);
    ctx.strokeStyle = night ? 'rgba(160, 182, 224, 0.10)' : 'rgba(220, 232, 255, 0.18)';
    ctx.lineWidth = Math.max(1, 0.8 * z);
    ctx.stroke();

    if (gx === 0 && (gy === 6 || gy === 7)) {
      // Brushed stainless-steel elevator sill & safety guide LEDs along left wall edge
      ctx.beginPath();
      ctx.moveTo(sx, sy - hh + 1 * z);
      ctx.lineTo(sx - hw + 2 * z, sy);
      ctx.lineTo(sx - hw + 9 * z, sy + 3.5 * z);
      ctx.lineTo(sx + 7 * z, sy - hh + 4.5 * z);
      ctx.closePath();
      ctx.fillStyle = night ? '#5f6f8f' : '#8d9dba';
      ctx.fill();
      ctx.strokeStyle = '#1b2130';
      ctx.lineWidth = Math.max(1, 0.9 * z);
      ctx.stroke();

      ctx.fillStyle = Math.sin(timeSec * 3) > 0 ? '#5cf0ff' : '#ffd147';
      pxRect(ctx, sx - 12 * z, sy - 5 * z, 2.2 * z, 1.5 * z);
      pxRect(ctx, sx - 20 * z, sy - 1 * z, 2.2 * z, 1.5 * z);
    } else {
      ctx.fillStyle = night ? 'rgba(180, 198, 235, 0.12)' : 'rgba(255, 255, 255, 0.16)';
      pxRect(ctx, sx - 2 * z, sy - 1 * z, 3 * z, 1.2 * z);
    }
  }

  ctx.restore();
}

/**
 * Renders architectural 2.5D back walls featuring darkened sculpted baseboards,
 * vertical acoustic wood-slat feature bays, recessed ceiling LED cove lighting,
 * and deep parallax cityscape panoramic windows with brushed aluminum mullions.
 */
export function drawEnhancedBackWalls(
  ctx: CanvasRenderingContext2D,
  topVertexX: number,
  topVertexY: number,
  gridW: number,
  gridH: number,
  zoom: number,
  night = false,
  timeSec = 0,
  palette?: ThemePalette,
): void {
  const z = zoom;
  const hw = (TILE_W / 2) * z;
  const hh = (TILE_H / 2) * z;
  const wallH = 68 * z;
  const pal = palette ?? DEFAULT_THEME_PALETTE;

  const leftEndX = topVertexX - gridH * hw;
  const leftEndY = topVertexY + gridH * hh;
  const rightEndX = topVertexX + gridW * hw;
  const rightEndY = topVertexY + gridW * hh;

  ctx.save();

  // 1. Primary left & right architectural wall planes
  ctx.beginPath();
  ctx.moveTo(topVertexX, topVertexY);
  ctx.lineTo(leftEndX, leftEndY);
  ctx.lineTo(leftEndX, leftEndY - wallH);
  ctx.lineTo(topVertexX, topVertexY - wallH);
  ctx.closePath();
  ctx.fillStyle = night ? '#22283c' : '#3d4969';
  ctx.fill();
  ctx.strokeStyle = '#111521';
  ctx.lineWidth = Math.max(1.4, 1.5 * z);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(topVertexX, topVertexY);
  ctx.lineTo(rightEndX, rightEndY);
  ctx.lineTo(rightEndX, rightEndY - wallH);
  ctx.lineTo(topVertexX, topVertexY - wallH);
  ctx.closePath();
  ctx.fillStyle = night ? '#1b2032' : '#323c59';
  ctx.fill();
  ctx.strokeStyle = '#111521';
  ctx.stroke();

  // Corner pilaster seam & top coping cap
  ctx.beginPath();
  ctx.moveTo(topVertexX, topVertexY);
  ctx.lineTo(topVertexX, topVertexY - wallH);
  ctx.strokeStyle = night ? '#364161' : '#586891';
  ctx.lineWidth = Math.max(1.2, 2 * z);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(leftEndX, leftEndY - wallH);
  ctx.lineTo(topVertexX, topVertexY - wallH);
  ctx.lineTo(rightEndX, rightEndY - wallH);
  ctx.strokeStyle = night ? '#48567a' : '#7385b0';
  ctx.lineWidth = Math.max(1.5, 2.6 * z);
  ctx.stroke();

  // Helper to draw an isometric wall quad along wall segment (p1 -> p2)
  const fillWallSegment = (
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    tStart: number,
    tEnd: number,
    hBot: number,
    hTop: number,
    fill: string,
    stroke?: string,
  ) => {
    const x1 = p1x + (p2x - p1x) * tStart;
    const y1 = p1y + (p2y - p1y) * tStart;
    const x2 = p1x + (p2x - p1x) * tEnd;
    const y2 = p1y + (p2y - p1y) * tEnd;
    ctx.beginPath();
    ctx.moveTo(x1, y1 - hBot);
    ctx.lineTo(x2, y2 - hBot);
    ctx.lineTo(x2, y2 - hTop);
    ctx.lineTo(x1, y1 - hTop);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1, 1.2 * z);
      ctx.stroke();
    }
  };

  // 2. Vertical acoustic wood-slat feature panels between window bays (leaving left elevator bay clear)
  const drawAcousticPanel = (
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    tStart: number,
    tEnd: number,
    isRightSide: boolean,
  ) => {
    const wood = night ? pal.woodNight : pal.woodDay;
    const panelBg = isRightSide ? wood[1] : wood[0];
    fillWallSegment(p1x, p1y, p2x, p2y, tStart, tEnd, 9 * z, 58 * z, panelBg, '#171c2b');

    const slats = 5;
    ctx.strokeStyle = wood[2];
    ctx.lineWidth = Math.max(1, 1.15 * z);
    for (let i = 1; i <= slats; i++) {
      const u = tStart + ((tEnd - tStart) * i) / (slats + 1);
      const sx = p1x + (p2x - p1x) * u;
      const sy = p1y + (p2y - p1y) * u;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 10 * z);
      ctx.lineTo(sx, sy - 57 * z);
      ctx.stroke();
    }

    // Brushed brass/steel accent badge on acoustic panel
    const midX = p1x + (p2x - p1x) * ((tStart + tEnd) * 0.5);
    const midY = p1y + (p2y - p1y) * ((tStart + tEnd) * 0.5);
    ctx.fillStyle = night ? '#8d9dba' : '#c9d6ed';
    pxRect(ctx, midX - 2 * z, midY - 56 * z, 4 * z, 1.5 * z);
  };

  // Left wall acoustic bays (0.02..0.08, 0.735..0.775) — 0.34..0.54 stays open for (0,6) elevator portal
  drawAcousticPanel(topVertexX, topVertexY, leftEndX, leftEndY, 0.02, 0.085, false);
  drawAcousticPanel(topVertexX, topVertexY, leftEndX, leftEndY, 0.735, 0.775, false);
  // Right wall acoustic bays (0.02..0.09, 0.335..0.415, 0.615..0.675, 0.90..0.97)
  drawAcousticPanel(topVertexX, topVertexY, rightEndX, rightEndY, 0.02, 0.09, true);
  drawAcousticPanel(topVertexX, topVertexY, rightEndX, rightEndY, 0.335, 0.405, true);
  drawAcousticPanel(topVertexX, topVertexY, rightEndX, rightEndY, 0.615, 0.675, true);
  drawAcousticPanel(topVertexX, topVertexY, rightEndX, rightEndY, 0.9, 0.97, true);

  // 3. Darkened sculpted baseboard profile (süpürgelik) + top metallic shadow-gap trim
  fillWallSegment(topVertexX, topVertexY, leftEndX, leftEndY, 0, 1, 0, 7.5 * z, night ? '#121624' : '#1d2438');
  fillWallSegment(topVertexX, topVertexY, rightEndX, rightEndY, 0, 1, 0, 7.5 * z, night ? '#0f1320' : '#181e30');
  ctx.beginPath();
  ctx.moveTo(leftEndX, leftEndY - 7.8 * z);
  ctx.lineTo(topVertexX, topVertexY - 7.8 * z);
  ctx.lineTo(rightEndX, rightEndY - 7.8 * z);
  ctx.strokeStyle = night ? '#3c4a6e' : '#6476a1';
  ctx.lineWidth = Math.max(1.2, 1.8 * z);
  ctx.stroke();

  // 4. Ceiling recessed LED cove light strip & soft upper wall wash
  const ledGlow = night ? 'rgba(92, 228, 255, 0.22)' : 'rgba(240, 250, 255, 0.18)';
  fillWallSegment(topVertexX, topVertexY, leftEndX, leftEndY, 0.01, 0.99, 59 * z, 65.5 * z, ledGlow);
  fillWallSegment(topVertexX, topVertexY, rightEndX, rightEndY, 0.01, 0.99, 59 * z, 65.5 * z, ledGlow);

  ctx.beginPath();
  ctx.moveTo(leftEndX, leftEndY - 64 * z);
  ctx.lineTo(topVertexX, topVertexY - 64 * z);
  ctx.lineTo(rightEndX, rightEndY - 64 * z);
  ctx.strokeStyle = night ? '#6ce6ff' : '#eef8ff';
  ctx.lineWidth = Math.max(1.3, 2 * z);
  ctx.stroke();

  // 5. Deep Panoramic Cityscape Windows
  const drawPanoramicWindow = (
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    tStart: number,
    tEnd: number,
    seed: number,
  ) => {
    const x1 = p1x + (p2x - p1x) * tStart;
    const y1 = p1y + (p2y - p1y) * tStart;
    const x2 = p1x + (p2x - p1x) * tEnd;
    const y2 = p1y + (p2y - p1y) * tEnd;
    const wBot = 16 * z;
    const wTop = 55 * z;

    // Outer recessed aluminum casing
    ctx.beginPath();
    ctx.moveTo(x1, y1 - wBot);
    ctx.lineTo(x2, y2 - wBot);
    ctx.lineTo(x2, y2 - wTop);
    ctx.lineTo(x1, y1 - wTop);
    ctx.closePath();
    ctx.fillStyle = night ? '#0a1228' : '#6dbdf2';
    ctx.fill();

    ctx.save();
    if (typeof ctx.clip === 'function') {
      ctx.clip();
    }

    const minX = Math.min(x1, x2);
    const spanX = Math.max(8 * z, Math.abs(x2 - x1));
    const midY = (y1 + y2) * 0.5;

    // Horizon atmospheric band
    ctx.fillStyle = night ? '#1b1d47' : '#a6dcff';
    pxRect(ctx, minX, midY - 34 * z, spanX, 20 * z);
    if (night) {
      // Subtle neon dusk horizon band
      ctx.fillStyle = 'rgba(184, 92, 255, 0.24)';
      pxRect(ctx, minX, midY - 25 * z, spanX, 8 * z);
    }

    // Moon & twinkling stars (night) OR drifting cumulus clouds (day)
    if (night) {
      if (seed % 2 === 0) {
        const mx = minX + spanX * 0.72;
        const my = midY - 46 * z;
        ctx.fillStyle = '#fff5c0';
        pxRect(ctx, mx, my, 4.5 * z, 4.5 * z);
        ctx.fillStyle = '#0a1228';
        pxRect(ctx, mx + 1.8 * z, my, 3 * z, 3 * z);
      }
      for (let s = 0; s < 5; s++) {
        const u = ((s * 0.21 + seed * 0.13) % 0.84) + 0.08;
        const sx = x1 + (x2 - x1) * u;
        const sy = y1 + (y2 - y1) * u - wBot - (22 + ((s * 5 + seed * 3) % 14)) * z;
        const tw = Math.sin(timeSec * 2.8 + s * 1.9 + seed) > 0.15 ? 1.8 * z : 1 * z;
        ctx.fillStyle = s % 3 === 0 ? '#9ee8ff' : '#fff8cf';
        pxRect(ctx, sx, sy, tw, tw);
      }
    } else {
      const drift = (((timeSec * 4.5 + seed * 7) % 24) - 12) * 0.35 * z;
      const cx1 = minX + spanX * 0.34 + drift;
      const cy1 = midY - 43 * z;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      pxRect(ctx, cx1, cy1, 13 * z, 3.5 * z);
      pxRect(ctx, cx1 + 3 * z, cy1 - 2 * z, 7 * z, 2.5 * z);
    }

    // Far parallax skyscraper silhouettes
    const farColor = night ? '#152242' : '#538ec2';
    for (let b = 0; b < 5; b++) {
      const bx = minX + (spanX * b) / 5;
      const bw = spanX / 5 + 1.5 * z;
      const bh = (12 + ((b * 7 + seed * 5) % 13)) * z;
      const u = (b + 0.5) / 5;
      const baseLineY = y1 + (y2 - y1) * (x1 < x2 ? u : 1 - u) - wBot + 4 * z;
      ctx.fillStyle = farColor;
      pxRect(ctx, bx, baseLineY - bh, bw, bh + 8 * z);
    }

    // Near parallax skyscrapers + lit micro-windows
    const nearColor = night ? '#0d1529' : '#3b6a9c';
    for (let b = 0; b < 4; b++) {
      const bx = minX + spanX * (0.06 + b * 0.24);
      const bw = Math.max(4 * z, spanX * 0.18);
      const bh = (9 + ((b * 9 + seed * 4) % 14)) * z;
      const u = 0.12 + b * 0.24;
      const baseLineY = y1 + (y2 - y1) * (x1 < x2 ? u : 1 - u) - wBot + 5 * z;
      ctx.fillStyle = nearColor;
      pxRect(ctx, bx, baseLineY - bh, bw, bh + 8 * z);

      // Rooftop antenna spire on tallest tower
      if ((b + seed) % 3 === 0) {
        pxRect(ctx, bx + bw * 0.45, baseLineY - bh - 4 * z, 1.2 * z, 4 * z);
      }

      // Micro-windows inside near tower
      const winColor = night
        ? (b + seed) % 2 === 0 ? '#ffd97d' : '#63e2ff'
        : 'rgba(220, 244, 255, 0.55)';
      ctx.fillStyle = winColor;
      for (let wy = 3; wy < bh - 3 * z; wy += 4 * z) {
        pxRect(ctx, bx + 1.5 * z, baseLineY - bh + wy, 1.4 * z, 1.4 * z);
        if (bw > 6 * z) {
          pxRect(ctx, bx + bw - 3.2 * z, baseLineY - bh + wy, 1.4 * z, 1.4 * z);
        }
      }
    }

    // Diagonal double-glazed curtain-wall sky reflections
    ctx.strokeStyle = night ? 'rgba(155, 224, 255, 0.16)' : 'rgba(255, 255, 255, 0.34)';
    ctx.lineWidth = Math.max(1, 1.3 * z);
    ctx.beginPath();
    ctx.moveTo(x1 + (x2 - x1) * 0.18, y1 + (y2 - y1) * 0.18 - wBot - 4 * z);
    ctx.lineTo(x1 + (x2 - x1) * 0.34, y1 + (y2 - y1) * 0.34 - wTop + 5 * z);
    ctx.moveTo(x1 + (x2 - x1) * 0.62, y1 + (y2 - y1) * 0.62 - wBot - 5 * z);
    ctx.lineTo(x1 + (x2 - x1) * 0.76, y1 + (y2 - y1) * 0.76 - wTop + 6 * z);
    ctx.stroke();

    ctx.restore();

    // Brushed aluminum mullions & structural window frame + bottom sill bevel
    const midMx = (x1 + x2) * 0.5;
    const midMy = (y1 + y2) * 0.5;
    ctx.strokeStyle = night ? '#516282' : '#8b9ec2';
    ctx.lineWidth = Math.max(1, 1.4 * z);
    ctx.beginPath();
    ctx.moveTo(midMx, midMy - wBot);
    ctx.lineTo(midMx, midMy - wTop);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, y1 - wBot);
    ctx.lineTo(x2, y2 - wBot);
    ctx.lineTo(x2, y2 - wTop);
    ctx.lineTo(x1, y1 - wTop);
    ctx.closePath();
    ctx.strokeStyle = '#141926';
    ctx.lineWidth = Math.max(1.5, 2.1 * z);
    ctx.stroke();

    // Aluminum sill highlight
    ctx.beginPath();
    ctx.moveTo(x1, y1 - wBot + 1 * z);
    ctx.lineTo(x2, y2 - wBot + 1 * z);
    ctx.strokeStyle = night ? '#6a7ca1' : '#b2c2e0';
    ctx.lineWidth = Math.max(1, 1.4 * z);
    ctx.stroke();
  };

  // 3 Left Wall panoramic windows (leaving 0.33..0.54 open for the elevator portal)
  drawPanoramicWindow(topVertexX, topVertexY, leftEndX, leftEndY, 0.1, 0.32, 1);
  drawPanoramicWindow(topVertexX, topVertexY, leftEndX, leftEndY, 0.55, 0.725, 2);
  drawPanoramicWindow(topVertexX, topVertexY, leftEndX, leftEndY, 0.785, 0.95, 3);

  // 3 Right Wall panoramic windows
  drawPanoramicWindow(topVertexX, topVertexY, rightEndX, rightEndY, 0.105, 0.32, 4);
  drawPanoramicWindow(topVertexX, topVertexY, rightEndX, rightEndY, 0.42, 0.60, 5);
  drawPanoramicWindow(topVertexX, topVertexY, rightEndX, rightEndY, 0.69, 0.885, 6);

  ctx.restore();
}

function drawCustomOrPartitionProp(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cx: number,
  cy: number,
  z: number,
  timeSec: number,
  isOccupied: boolean,
  night = false,
): boolean {
  if (kind === 'aquarium') {
    drawFloorShadow(ctx, cx, cy, 20, 10, z, 0.28);
    drawBox(ctx, cx, cy, 18, 9, 10, '#343e57', '#212838', '#141924', z);
    const tx = cx - 15 * z;
    const ty = cy - 32 * z;
    const tw = 30 * z;
    const th = 20 * z;
    if (night) {
      ctx.fillStyle = 'rgba(37, 174, 224, 0.18)';
      pxRect(ctx, tx - 2 * z, ty - 2 * z, tw + 4 * z, th + 4 * z);
    }
    ctx.fillStyle = '#125a82';
    pxRect(ctx, tx, ty, tw, th);
    ctx.fillStyle = '#2596be';
    pxRect(ctx, tx + 2 * z, ty + 2 * z, tw - 4 * z, th - 4 * z);
    // Coral & aquatic plants
    ctx.fillStyle = '#29bf72';
    pxRect(ctx, tx + 4 * z, ty + 12 * z, 2.5 * z, 6 * z);
    ctx.fillStyle = '#ff6b8b';
    pxRect(ctx, tx + 23 * z, ty + 13 * z, 3 * z, 5 * z);
    // Swimming pixel fish
    const fish1X = tx + (6 + (Math.sin(timeSec * 1.6) * 0.5 + 0.5) * 14) * z;
    const fish2X = tx + (20 - (Math.cos(timeSec * 1.2) * 0.5 + 0.5) * 14) * z;
    ctx.fillStyle = '#ff8a3d';
    pxRect(ctx, fish1X, ty + 7 * z, 5 * z, 3 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, fish2X, ty + 13 * z, 4 * z, 3 * z);
    // Rising bubbles
    const bY = ty + (16 - ((timeSec * 9) % 12)) * z;
    ctx.fillStyle = '#d9f8ff';
    pxRect(ctx, tx + 9 * z, bY, 2 * z, 2 * z);
    pxRect(ctx, tx + 21 * z, bY + 2 * z, 2 * z, 2 * z);
    ctx.strokeStyle = '#0e121c';
    ctx.lineWidth = Math.max(1, 1.5 * z);
    pxStrokeRect(ctx, tx, ty, tw, th);
    return true;
  }

  if (kind === 'ping_pong') {
    drawFloorShadow(ctx, cx, cy, 25, 13, z, 0.28);
    drawBox(ctx, cx, cy, 24, 12, 10, '#1f8a5b', '#145e3d', '#0d422b', z);
    ctx.strokeStyle = '#f4f6fc';
    ctx.lineWidth = Math.max(1, 1.2 * z);
    ctx.beginPath();
    ctx.moveTo(cx - 12 * z, cy - 10 * z);
    ctx.lineTo(cx + 12 * z, cy - 10 * z);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    pxRect(ctx, cx - 10 * z, cy - 14 * z, 20 * z, 3 * z);
    const bx = cx + Math.sin(timeSec * 5) * 11 * z;
    const by = cy - 16 * z - Math.abs(Math.cos(timeSec * 5)) * 5 * z;
    ctx.fillStyle = '#ffbe3b';
    pxRect(ctx, bx, by, 3 * z, 3 * z);
    return true;
  }

  if (kind === 'bonsai') {
    drawFloorShadow(ctx, cx, cy, 11, 6.5, z, 0.24);
    drawBox(ctx, cx, cy, 10, 6, 6, '#3e5273', '#27354d', '#192233', z);
    ctx.fillStyle = '#6e4228';
    pxRect(ctx, cx - 2 * z, cy - 18 * z, 4 * z, 11 * z);
    ctx.fillStyle = '#238244';
    pxRect(ctx, cx - 10 * z, cy - 23 * z, 13 * z, 6 * z);
    ctx.fillStyle = '#2fa857';
    pxRect(ctx, cx - 8 * z, cy - 25 * z, 12 * z, 6 * z);
    ctx.fillStyle = '#4be07a';
    pxRect(ctx, cx - 2 * z, cy - 29 * z, 11 * z, 5.5 * z);
    return true;
  }

  if (kind === 'glass_partition' || kind === 'glass_partition_x') {
    // Architectural glass partition with aluminum floor/ceiling tracks & frosted privacy band
    const isX = kind === 'glass_partition_x';
    const x1 = isX ? cx - 18 * z : cx + 18 * z;
    const y1 = cy - 9 * z;
    const x2 = isX ? cx + 18 * z : cx - 18 * z;
    const y2 = cy + 9 * z;
    const wallH = 31 * z;

    // Brushed aluminum floor U-channel track
    ctx.strokeStyle = '#5c6e8f';
    ctx.lineWidth = Math.max(2, 3.2 * z);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Translucent tempered glass pane
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 - wallH);
    ctx.lineTo(x1, y1 - wallH);
    ctx.closePath();
    ctx.fillStyle = night ? 'rgba(110, 208, 255, 0.26)' : 'rgba(140, 226, 255, 0.34)';
    ctx.fill();

    // Frosted sandblasted middle privacy stripe (kumlama şeridi)
    ctx.beginPath();
    ctx.moveTo(x1, y1 - 11 * z);
    ctx.lineTo(x2, y2 - 11 * z);
    ctx.lineTo(x2, y2 - 18 * z);
    ctx.lineTo(x1, y1 - 18 * z);
    ctx.closePath();
    ctx.fillStyle = night ? 'rgba(195, 236, 255, 0.24)' : 'rgba(232, 250, 255, 0.42)';
    ctx.fill();

    // Anodized aluminum outer posts & top rail
    ctx.strokeStyle = '#9bb0d4';
    ctx.lineWidth = Math.max(1.2, 1.9 * z);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1, y1 - wallH);
    ctx.lineTo(x2, y2 - wallH);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Center mullion, specular diagonal sheen & stainless floor clamp pixel
    ctx.strokeStyle = 'rgba(225, 248, 255, 0.72)';
    ctx.lineWidth = Math.max(1, 1.1 * z);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - wallH);
    ctx.moveTo(cx - 10 * z, cy - 6 * z);
    ctx.lineTo(cx - 2 * z, cy - 23 * z);
    ctx.moveTo(cx + 4 * z, cy - 11 * z);
    ctx.lineTo(cx + 10 * z, cy - 25 * z);
    ctx.stroke();

    ctx.fillStyle = '#c6d4ed';
    pxRect(ctx, cx - 1 * z, cy - wallH - 0.5 * z, 2 * z, 1.5 * z);
    return true;
  }

  if (kind === 'wood_partition' || kind === 'wood_partition_x') {
    const isX = kind === 'wood_partition_x';
    const x1 = isX ? cx - 18 * z : cx + 18 * z;
    const y1 = cy - 9 * z;
    const x2 = isX ? cx + 18 * z : cx - 18 * z;
    const y2 = cy + 9 * z;
    const wallH = 27 * z;

    ctx.strokeStyle = '#1b2130';
    ctx.lineWidth = Math.max(2, 3 * z);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 - wallH);
    ctx.lineTo(x1, y1 - wallH);
    ctx.closePath();
    ctx.fillStyle = isX ? '#825532' : '#9c683e';
    ctx.fill();

    ctx.strokeStyle = '#4f3119';
    ctx.lineWidth = Math.max(1, 1.3 * z);
    for (let i = 1; i <= 5; i++) {
      const t = i / 6;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 2 * z);
      ctx.lineTo(sx, sy - wallH + 2 * z);
      ctx.stroke();
    }

    ctx.strokeStyle = '#2d354a';
    ctx.lineWidth = Math.max(1.2, 1.9 * z);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1, y1 - wallH);
    ctx.lineTo(x2, y2 - wallH);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = '#b88356';
    pxRect(ctx, cx - 1 * z, cy - wallH, 2 * z, 1.4 * z);
    return true;
  }

  if (kind === 'elevator_doors') {
    const w1x = cx + 4 * z;
    const w1y = cy - 18 * z;
    const w2x = cx - 36 * z;
    const w2y = cy + 2 * z;
    const dx = 4 * z;
    const dy = 2 * z;
    const p1x = w1x + dx;
    const p1y = w1y + dy;
    const p2x = w2x + dx;
    const p2y = w2y + dy;
    const fh = 52 * z;

    const fillIsoQuad = (
      u1: number,
      u2: number,
      hBot: number,
      hTop: number,
      fill: string,
      stroke?: string,
    ) => {
      const xA = p1x + (p2x - p1x) * u1;
      const yA = p1y + (p2y - p1y) * u1;
      const xB = p1x + (p2x - p1x) * u2;
      const yB = p1y + (p2y - p1y) * u2;
      ctx.beginPath();
      ctx.moveTo(xA, yA - hBot);
      ctx.lineTo(xB, yB - hBot);
      ctx.lineTo(xB, yB - hTop);
      ctx.lineTo(xA, yA - hTop);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(1, 1.4 * z);
        ctx.stroke();
      }
    };

    ctx.beginPath();
    ctx.moveTo(w1x, w1y - fh);
    ctx.lineTo(w2x, w2y - fh);
    ctx.lineTo(p2x, p2y - fh);
    ctx.lineTo(p1x, p1y - fh);
    ctx.closePath();
    ctx.fillStyle = '#6c7a96';
    ctx.fill();
    ctx.strokeStyle = '#121622';
    ctx.lineWidth = Math.max(1, 1.4 * z);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w1x, w1y);
    ctx.lineTo(p1x, p1y);
    ctx.lineTo(p1x, p1y - fh);
    ctx.lineTo(w1x, w1y - fh);
    ctx.closePath();
    ctx.fillStyle = '#384154';
    ctx.fill();
    ctx.stroke();

    fillIsoQuad(0, 1, 0, fh, '#4b556b', '#121622');
    fillIsoQuad(0.1, 0.9, 2 * z, 41 * z, '#141c2e', '#0d121f');
    if (isOccupied) {
      fillIsoQuad(0.14, 0.86, 37 * z, 40.5 * z, 'rgba(255, 230, 140, 0.48)');
      fillIsoQuad(0.48, 0.52, 3 * z, 37 * z, '#25324d');
    }

    const openU = isOccupied ? 0.28 : 0;
    const panelSpan = 0.4 - openU;
    if (panelSpan > 0.03) {
      fillIsoQuad(0.1, 0.1 + panelSpan, 2 * z, 41 * z, '#9aa6bd', '#1b2233');
      fillIsoQuad(0.13, 0.1 + panelSpan * 0.55, 5 * z, 38 * z, '#b8c5de');
      fillIsoQuad(0.9 - panelSpan, 0.9, 2 * z, 41 * z, '#8c98b0', '#1b2233');
      fillIsoQuad(0.9 - panelSpan * 0.65, 0.87, 5 * z, 38 * z, '#a6b3cc');
    }

    fillIsoQuad(0.12, 0.88, 43 * z, 49 * z, '#1e2536', '#121622');
    const ledColor = isOccupied ? '#3be87a' : '#ffbe3b';
    fillIsoQuad(0.38, 0.62, 44.5 * z, 47.5 * z, ledColor);
    fillIsoQuad(0, 1, 0, 2.2 * z, '#7c8aa6', '#121622');

    // Call button plate beside right door jamb
    ctx.fillStyle = '#c6d2e8';
    pxRect(ctx, p1x - 2 * z, p1y - 24 * z, 2 * z, 4 * z);
    return true;
  }

  if (kind === 'phone_booth') {
    drawFloorShadow(ctx, cx, cy, 19, 11, z, 0.3);
    drawBox(ctx, cx, cy, 17, 10, 3, '#7a4e2d', '#59371e', '#3d2412', z);
    drawBox(ctx, cx - 1 * z, cy - 3 * z, 15, 9, 34, '#ad7344', '#85552e', '#5c391d', z);

    const rx = cx - 8 * z;
    const ry = cy - 33 * z;
    const rw = 16 * z;
    const rh = 28 * z;
    if (night) {
      ctx.fillStyle = 'rgba(255, 198, 92, 0.14)';
      pxRect(ctx, rx - 2 * z, ry - 1 * z, rw + 4 * z, rh + 3 * z);
    }
    ctx.fillStyle = '#362822';
    pxRect(ctx, rx, ry, rw, rh);

    const glowAlpha = ((night ? 0.42 : 0.33) + 0.06 * Math.sin(timeSec * 2.2)).toFixed(3);
    ctx.fillStyle = `rgba(255, 198, 92, ${glowAlpha})`;
    pxRect(ctx, rx + 1 * z, ry + 1 * z, rw - 2 * z, rh - 2 * z);

    // Ribbed acoustic felt back panels + mini stool silhouette
    ctx.fillStyle = '#6e4b33';
    for (let i = 0; i < 3; i++) {
      pxRect(ctx, cx - (5 - i * 4) * z, cy - 29 * z, 2 * z, 14 * z);
    }
    ctx.fillStyle = '#262d3d';
    pxRect(ctx, cx - 3 * z, cy - 10 * z, 5 * z, 4 * z);

    // Floating warm wood call shelf + laptop accent + ceiling LED bar
    ctx.fillStyle = '#d49359';
    pxRect(ctx, cx - 6 * z, cy - 15 * z, 12 * z, 2.5 * z);
    ctx.fillStyle = '#8f5c30';
    pxRect(ctx, cx - 6 * z, cy - 12.5 * z, 12 * z, 1.5 * z);
    ctx.fillStyle = '#fff0a8';
    pxRect(ctx, cx - 5 * z, cy - 32 * z, 10 * z, 2 * z);

    // Tempered glass door pane + crisp reflections + anodized frame
    ctx.fillStyle = 'rgba(140, 226, 255, 0.28)';
    pxRect(ctx, rx, ry, rw, rh);

    ctx.strokeStyle = 'rgba(232, 250, 255, 0.75)';
    ctx.lineWidth = Math.max(1, 1.15 * z);
    ctx.beginPath();
    ctx.moveTo(cx - 5 * z, cy - 10 * z);
    ctx.lineTo(cx + 2 * z, cy - 28 * z);
    ctx.moveTo(cx, cy - 9 * z);
    ctx.lineTo(cx + 5 * z, cy - 21 * z);
    ctx.stroke();

    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth = Math.max(1, 1.6 * z);
    pxStrokeRect(ctx, rx, ry, rw, rh);

    ctx.fillStyle = '#dce7fa';
    pxRect(ctx, cx + 4.2 * z, cy - 21 * z, 1.8 * z, 7 * z);

    drawBox(ctx, cx - 1 * z, cy - 37 * z, 16, 9.5, 3, '#414c66', '#283042', '#181d29', z);
    ctx.fillStyle = isOccupied ? '#ff5666' : '#3be87a';
    pxRect(ctx, cx - 2 * z, cy - 38 * z, 4 * z, 1.8 * z);
    return true;
  }

  if (kind === 'snack_vending') {
    drawFloorShadow(ctx, cx, cy, 18, 11, z, 0.3);
    drawBox(ctx, cx, cy, 16, 10, 36, '#3d4b6e', '#27324a', '#181f30', z);

    if (night) {
      ctx.fillStyle = 'rgba(255, 138, 76, 0.14)';
      pxRect(ctx, cx - 12 * z, cy - 35 * z, 24 * z, 26 * z);
    }

    // Illuminated retro marquee header
    ctx.fillStyle = '#121726';
    pxRect(ctx, cx - 11 * z, cy - 34 * z, 22 * z, 5 * z);
    ctx.fillStyle = '#ff6b4a';
    pxRect(ctx, cx - 10 * z, cy - 33 * z, 20 * z, 3 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx - 8 * z, cy - 32.5 * z, 5 * z, 2 * z);
    ctx.fillStyle = '#fff5d6';
    pxRect(ctx, cx - 1 * z, cy - 32.5 * z, 7 * z, 2 * z);

    // Backlit glass display window + 3 stocked snack/soda rows
    const wx = cx - 11 * z;
    const wy = cy - 28 * z;
    const ww = 15 * z;
    const wh = 18 * z;
    ctx.fillStyle = '#162942';
    pxRect(ctx, wx, wy, ww, wh);
    ctx.fillStyle = '#244166';
    pxRect(ctx, wx + 1 * z, wy + 1 * z, ww - 2 * z, wh - 2 * z);

    const snackColors = ['#ff5666', '#3cd8ff', '#ffd147', '#3be87a', '#b07cff', '#ff8a3d'];
    for (let row = 0; row < 3; row++) {
      const sy = cy - (26.5 - row * 5.3) * z;
      for (let col = 0; col < 4; col++) {
        ctx.fillStyle = snackColors[(row * 2 + col) % snackColors.length];
        pxRect(ctx, cx - (9.5 - col * 3.1) * z, sy, 2.2 * z, 3.4 * z);
      }
      ctx.fillStyle = '#8496b5';
      pxRect(ctx, cx - 10 * z, sy + 3.4 * z, 13 * z, 1.2 * z);
    }

    // Diagonal glass reflection on vending window
    ctx.strokeStyle = 'rgba(220, 246, 255, 0.55)';
    ctx.lineWidth = Math.max(1, z);
    ctx.beginPath();
    ctx.moveTo(wx + 2 * z, wy + wh - 2 * z);
    ctx.lineTo(wx + 8 * z, wy + 2 * z);
    ctx.stroke();

    ctx.strokeStyle = '#7cd7ff';
    ctx.lineWidth = Math.max(1, 1.2 * z);
    pxStrokeRect(ctx, wx, wy, ww, wh);

    // Contactless card reader & keypad column
    ctx.fillStyle = '#111624';
    pxRect(ctx, cx + 5 * z, cy - 28 * z, 6 * z, 18 * z);
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, cx + 6.5 * z, cy - 26 * z, 3 * z, 3 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx + 6.5 * z, cy - 21.5 * z, 3 * z, 1.5 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, cx + 6.5 * z, cy - 19 * z, 3 * z, 1.5 * z);
    ctx.fillStyle = '#ff7b3b';
    pxRect(ctx, cx + 6.5 * z, cy - 15.5 * z, 3 * z, 2 * z);

    // Dispenser flap tray
    ctx.fillStyle = '#0d111c';
    pxRect(ctx, cx - 10 * z, cy - 8.5 * z, 16 * z, 5 * z);
    ctx.fillStyle = '#7a8bab';
    pxRect(ctx, cx - 9 * z, cy - 8 * z, 14 * z, 1.5 * z);
    return true;
  }

  if (kind === 'arcade_cabinet') {
    drawFloorShadow(ctx, cx, cy, 17, 11, z, 0.3);
    drawBox(ctx, cx, cy, 15, 10, 17, '#3d2970', '#291b4d', '#1b1133', z);
    ctx.fillStyle = '#ff4d94';
    pxRect(ctx, cx - 11.5 * z, cy - 13 * z, 2 * z, 9 * z);
    ctx.fillStyle = '#121624';
    pxRect(ctx, cx - 4 * z, cy - 11 * z, 8 * z, 7 * z);
    ctx.fillStyle = '#ff7b3b';
    pxRect(ctx, cx - 2.5 * z, cy - 9 * z, 1.8 * z, 2.5 * z);
    pxRect(ctx, cx + 0.8 * z, cy - 9 * z, 1.8 * z, 2.5 * z);

    drawBox(ctx, cx - 1 * z, cy - 17 * z, 14, 9, 17, '#513791', '#362466', '#221642', z);
    ctx.fillStyle = '#ff3d7f';
    pxRect(ctx, cx - 10 * z, cy - 35 * z, 18 * z, 4 * z);
    ctx.fillStyle = '#ffe14d';
    pxRect(ctx, cx - 7 * z, cy - 34 * z, 12 * z, 2 * z);

    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.5);
    ctx.fillStyle = `rgba(60, 216, 255, ${((night ? 0.24 : 0.15) + pulse * 0.14).toFixed(3)})`;
    pxRect(ctx, cx - 10.5 * z, cy - 31.5 * z, 19 * z, 14 * z);
    ctx.fillStyle = '#0e1220';
    pxRect(ctx, cx - 9 * z, cy - 30 * z, 16 * z, 11 * z);
    ctx.fillStyle = pulse > 0.5 ? '#1b3e70' : '#132c52';
    pxRect(ctx, cx - 7.5 * z, cy - 28.5 * z, 13 * z, 8 * z);

    const shipX = cx + (-5.5 + (Math.sin(timeSec * 3.8) * 0.5 + 0.5) * 7.5) * z;
    const laserY = cy - (23.5 + ((timeSec * 9) % 4)) * z;
    ctx.fillStyle = '#ff5666';
    pxRect(ctx, cx - 2.5 * z, cy - 27.2 * z, 3 * z, 2 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, shipX + 1 * z, laserY, 1.5 * z, 2 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, shipX, cy - 22.5 * z, 3.5 * z, 2 * z);
    // CRT corner glint
    ctx.fillStyle = 'rgba(220, 248, 255, 0.45)';
    pxRect(ctx, cx - 6.8 * z, cy - 28 * z, 2.5 * z, 1.2 * z);

    drawBox(ctx, cx + 1.5 * z, cy - 16 * z, 13, 8, 3, '#27365e', '#1a2442', '#10172b', z);
    ctx.fillStyle = '#dce5f7';
    pxRect(ctx, cx - 5 * z, cy - 20.5 * z, 1.5 * z, 2.5 * z);
    ctx.fillStyle = '#ff3b5c';
    pxRect(ctx, cx - 5.8 * z, cy - 22.2 * z, 3 * z, 2.2 * z);
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, cx + 0.5 * z, cy - 20 * z, 2 * z, 1.5 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx + 3.2 * z, cy - 20.5 * z, 2 * z, 1.5 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, cx + 5.8 * z, cy - 19.5 * z, 2 * z, 1.5 * z);
    return true;
  }

  if (kind === 'library_table') {
    drawFloorShadow(ctx, cx, cy, 22, 12, z, 0.28);
    drawBox(ctx, cx, cy, 14, 8, 6, '#5e3b22', '#452a17', '#2e1b0e', z);
    drawBox(ctx, cx, cy - 6 * z, 21, 11, 4, '#ab7042', '#80522d', '#59371d', z);

    // Stacked colorful hardcovers
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, cx - 12 * z, cy - 13 * z, 8 * z, 2.2 * z);
    ctx.fillStyle = '#f7f2e4';
    pxRect(ctx, cx - 11 * z, cy - 12.5 * z, 6 * z, 1.2 * z);
    ctx.fillStyle = '#ff5666';
    pxRect(ctx, cx - 11.5 * z, cy - 15.2 * z, 7.5 * z, 2.2 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx - 11 * z, cy - 17.2 * z, 6.5 * z, 2 * z);

    // Open reading book
    ctx.fillStyle = '#6b3fa0';
    pxRect(ctx, cx - 3 * z, cy - 12 * z, 8 * z, 3.5 * z);
    ctx.fillStyle = '#fffdf2';
    pxRect(ctx, cx - 2.3 * z, cy - 11.5 * z, 3 * z, 2.5 * z);
    pxRect(ctx, cx + 1.2 * z, cy - 11.5 * z, 3 * z, 2.5 * z);

    // Ceramic coffee mug + steam
    ctx.fillStyle = '#f4f6fc';
    pxRect(ctx, cx + 7 * z, cy - 13.5 * z, 3.8 * z, 3.8 * z);
    ctx.fillStyle = '#6e381d';
    pxRect(ctx, cx + 7.8 * z, cy - 13.5 * z, 2.2 * z, 1.2 * z);
    const steamY = cy - (15.5 + ((timeSec * 3.2) % 3.5)) * z;
    ctx.fillStyle = 'rgba(230, 244, 255, 0.65)';
    pxRect(ctx, cx + 8.2 * z, steamY, 1.6 * z, 1.8 * z);

    // Classic brass & emerald banker lamp + warm reading pool
    ctx.fillStyle = night ? 'rgba(255, 226, 128, 0.46)' : 'rgba(255, 230, 138, 0.34)';
    pxRect(ctx, cx + 0.5 * z, cy - 15.5 * z, 10 * z, 4.5 * z);
    ctx.fillStyle = '#d4a638';
    pxRect(ctx, cx + 3.5 * z, cy - 13 * z, 4.5 * z, 1.8 * z);
    ctx.fillStyle = '#9c761c';
    pxRect(ctx, cx + 5 * z, cy - 20.5 * z, 1.8 * z, 7.5 * z);
    ctx.fillStyle = '#fff2a6';
    pxRect(ctx, cx + 2.5 * z, cy - 21 * z, 6.8 * z, 1.5 * z);
    ctx.fillStyle = '#1b9e56';
    pxRect(ctx, cx + 2 * z, cy - 24.2 * z, 7.8 * z, 3.5 * z);
    ctx.fillStyle = '#4be08a';
    pxRect(ctx, cx + 3 * z, cy - 23.6 * z, 5.5 * z, 1.5 * z);
    return true;
  }

  if (kind === '3d_printer') {
    drawFloorShadow(ctx, cx, cy, 18, 11, z, 0.3);
    drawBox(ctx, cx, cy, 16, 10, 12, '#38435c', '#252c3d', '#171c28', z);
    ctx.fillStyle = '#192030';
    pxRect(ctx, cx - 8 * z, cy - 8 * z, 7 * z, 4 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, cx - 7 * z, cy - 6.5 * z, 2 * z, 1.5 * z);
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, cx - 4 * z, cy - 6.5 * z, 2 * z, 1.5 * z);

    drawBox(ctx, cx, cy - 12 * z, 13, 8, 3, '#576785', '#3b465c', '#272f3d', z);
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, cx - 6.5 * z, cy - 16.5 * z, 13 * z, 1.8 * z);
    ctx.fillStyle = night ? 'rgba(84, 214, 255, 0.24)' : 'rgba(84, 214, 255, 0.16)';
    pxRect(ctx, cx - 9 * z, cy - 31 * z, 18 * z, 15 * z);

    // Holo-cube geometric print inside enclosure
    drawBox(ctx, cx, cy - 16 * z, 4.5, 3, 5.5, '#7ef3ff', '#3cd8ff', '#1e8eb8', z);

    // Gantry frame, top bridge & filament spool
    ctx.fillStyle = '#92a3c2';
    pxRect(ctx, cx - 9.5 * z, cy - 32 * z, 2.2 * z, 16.5 * z);
    pxRect(ctx, cx + 7.3 * z, cy - 32 * z, 2.2 * z, 16.5 * z);
    ctx.fillStyle = '#6f809e';
    pxRect(ctx, cx - 10 * z, cy - 33.5 * z, 20 * z, 2.5 * z);
    ctx.fillStyle = '#ff853d';
    pxRect(ctx, cx - 3 * z, cy - 38 * z, 6 * z, 4.5 * z);
    ctx.fillStyle = '#1a2030';
    pxRect(ctx, cx - 1.5 * z, cy - 36.8 * z, 3 * z, 2 * z);

    // Animated X-axis crossbar & glowing nozzle
    const travelX = Math.sin(timeSec * 4.2) * 4.5 * z;
    const barY = cy - (24 + Math.sin(timeSec * 1.8) * 1.5) * z;
    ctx.fillStyle = '#4c5973';
    pxRect(ctx, cx - 8 * z, barY, 16 * z, 1.8 * z);
    ctx.fillStyle = '#1e2536';
    pxRect(ctx, cx + travelX - 2 * z, barY - 1 * z, 4 * z, 3.8 * z);
    ctx.fillStyle = Math.sin(timeSec * 12) > 0 ? '#ffd147' : '#5cf0ff';
    pxRect(ctx, cx + travelX - 1 * z, barY + 2.5 * z, 2 * z, 2 * z);
    return true;
  }

  return false;
}

export function drawExtraFurnitureProp(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cx: number,
  cy: number,
  zoom: number,
  timeSec: number,
  isOccupied: boolean,
): boolean {
  return drawCustomOrPartitionProp(ctx, kind, cx, cy, zoom, timeSec, isOccupied, false);
}

/**
 * Renders high-craft 2.5D office furniture, tech racks, smartboards, partitions,
 * hospitality stations, and all 5 custom mini-room fixtures.
 */
export function drawEnhancedFurniture(
  ctx: CanvasRenderingContext2D,
  kind: FurnitureKind | CustomPropKind,
  sx: number,
  sy: number,
  zoom: number,
  timeSec: number,
  night = false,
  isOccupied = false,
  occupierModelFamily = 'pro',
  isHovered = false,
  whiteboardLabel = 'SWARM BOARD',
  deskLevel = 1,
): void {
  const z = zoom;
  const cx = sx;
  const cy = sy;
  const modelAccent = MODEL_ACCENT_COLORS[occupierModelFamily] ?? '#5cf0ff';

  ctx.save();

  if (drawCustomOrPartitionProp(ctx, kind, cx, cy, z, timeSec, isOccupied, night)) {
    ctx.restore();
    return;
  }

  if (kind === 'desk' || kind === 'dev_desk' || kind === 'qa_desk' || kind === 'exec_desk') {
    const isExec = kind === 'exec_desk';
    const isQa = kind === 'qa_desk';
    const w = isExec ? 24 : isQa ? 21 : 22;
    const d = isExec ? 12 : isQa ? 10.5 : 11;

    drawFloorShadow(ctx, cx, cy, w + 2, d + 1.5, z, 0.3);

    // Recessed dark modesty front skirt & steel legs underneath beveled desktop
    drawBox(ctx, cx, cy, w - 2, d - 1.5, 7, '#252c3d', '#1d2333', '#141824', z, '');
    // Thick beveled wood desktop slab (kept at total height 10*z so seated faces stay unobstructed)
    const topCol = isExec ? '#a35632' : isQa ? '#cfba9e' : '#d8b890';
    const leftCol = isExec ? '#7a3c1f' : isQa ? '#a18c73' : '#a88963';
    const rightCol = isExec ? '#592913' : isQa ? '#786652' : '#806647';
    drawBox(
      ctx,
      cx,
      cy - 7 * z,
      w,
      d,
      3.2,
      topCol,
      leftCol,
      rightCol,
      z,
      'rgba(255, 248, 228, 0.32)',
    );

    // Cable management grommet & rear cable channel spine
    ctx.fillStyle = '#181d2b';
    pxRect(ctx, cx - 3 * z, cy - 14.5 * z, 6 * z, 2 * z);
    ctx.fillStyle = '#2d364d';
    pxRect(ctx, cx - 1 * z, cy - 13 * z, 2 * z, 3 * z);

    // Extended dark desk mat / mousepad + mechanical keyboard + mouse
    ctx.fillStyle = '#202738';
    pxRect(ctx, cx - 9.5 * z, cy - 10.5 * z, 15.5 * z, 4 * z);
    ctx.fillStyle = '#121622';
    pxRect(ctx, cx - 8 * z, cy - 10 * z, 10 * z, 2.8 * z);
    ctx.fillStyle = isOccupied ? modelAccent : '#4a5878';
    pxRect(ctx, cx - 7 * z, cy - 9.3 * z, 8 * z, 1 * z);
    ctx.fillStyle = '#cbd5e8';
    pxRect(ctx, cx + 3.5 * z, cy - 9.8 * z, 1.8 * z, 2.2 * z);

    // Ceramic coffee mug on desk corner
    ctx.fillStyle = isExec ? '#ffd147' : '#f2f5fc';
    pxRect(ctx, cx + 8.5 * z, cy - 12 * z, 3.2 * z, 3.2 * z);
    ctx.fillStyle = '#6e381d';
    pxRect(ctx, cx + 9.1 * z, cy - 12 * z, 2 * z, 1 * z);

    if (isExec) {
      // Executive command monitor + golden desk blotter trim
      ctx.fillStyle = '#ffd147';
      pxRect(ctx, cx - 5 * z, cy - 6.2 * z, 10 * z, 1.5 * z);
      drawBox(ctx, cx + 6 * z, cy - 10.2 * z, 7.5, 4, 5.5, '#344163', '#202840', '#151a2b', z);
      ctx.fillStyle = isOccupied ? modelAccent : '#5cf0ff';
      pxRect(ctx, cx + 2.5 * z, cy - 17.5 * z, 7.5 * z, 4.5 * z);
    } else if (isQa) {
      // Dual-bezel QA diagnostic monitor + syntax/test bars
      if (night && isOccupied) {
        ctx.fillStyle = 'rgba(255, 190, 59, 0.16)';
        pxRect(ctx, cx + 2 * z, cy - 25 * z, 15 * z, 12 * z);
      }
      ctx.fillStyle = '#121622';
      pxRect(ctx, cx + 3.5 * z, cy - 23.5 * z, 12.5 * z, 9.5 * z);
      ctx.fillStyle = isOccupied ? '#1c2b42' : '#1b2336';
      pxRect(ctx, cx + 5 * z, cy - 22 * z, 9.5 * z, 6.5 * z);
      ctx.fillStyle = isOccupied ? '#3be87a' : '#3a4b6e';
      pxRect(ctx, cx + 6 * z, cy - 20.8 * z, 6.5 * z, 1.4 * z);
      ctx.fillStyle = isOccupied ? '#ffbe3b' : '#2e3c59';
      pxRect(ctx, cx + 6 * z, cy - 18.6 * z, 5 * z, 1.4 * z);
    } else {
      // Dual angled widescreen coding monitors with syntax-highlighted pixel code lines
      if (night && isOccupied) {
        ctx.fillStyle = 'rgba(60, 216, 255, 0.15)';
        pxRect(ctx, cx - 17 * z, cy - 25 * z, 34 * z, 12 * z);
      }
      // Monitor stands
      ctx.fillStyle = '#252d40';
      pxRect(ctx, cx - 11 * z, cy - 14.5 * z, 2.2 * z, 2.5 * z);
      pxRect(ctx, cx + 8.8 * z, cy - 14.5 * z, 2.2 * z, 2.5 * z);

      // Left & right monitor bezels
      ctx.fillStyle = '#111521';
      pxRect(ctx, cx - 15.5 * z, cy - 23.5 * z, 11 * z, 9.5 * z);
      pxRect(ctx, cx + 4.5 * z, cy - 23.5 * z, 11 * z, 9.5 * z);

      // Screen backgrounds
      const screenBg = isOccupied ? '#132038' : '#1a2234';
      ctx.fillStyle = screenBg;
      pxRect(ctx, cx - 14 * z, cy - 22 * z, 8 * z, 6.5 * z);
      pxRect(ctx, cx + 6 * z, cy - 22 * z, 8 * z, 6.5 * z);

      // Syntax-highlighted code lines
      const pulse = Math.sin(timeSec * 7) > 0;
      ctx.fillStyle = isOccupied ? modelAccent : '#334463';
      pxRect(ctx, cx - 13.2 * z, cy - 21 * z, 5.5 * z, 1.2 * z);
      ctx.fillStyle = isOccupied ? (pulse ? '#3be87a' : '#3cd8ff') : '#293752';
      pxRect(ctx, cx - 12.5 * z, cy - 19.2 * z, 4.5 * z, 1.2 * z);
      ctx.fillStyle = isOccupied ? '#ffd147' : '#293752';
      pxRect(ctx, cx - 13.2 * z, cy - 17.4 * z, 6 * z, 1.1 * z);

      ctx.fillStyle = isOccupied ? '#ff7eb9' : '#334463';
      pxRect(ctx, cx + 6.8 * z, cy - 21 * z, 5 * z, 1.2 * z);
      ctx.fillStyle = isOccupied ? (pulse ? '#3cd8ff' : '#3be87a') : '#293752';
      pxRect(ctx, cx + 7.4 * z, cy - 19.2 * z, 5.5 * z, 1.2 * z);
      ctx.fillStyle = isOccupied ? modelAccent : '#293752';
      pxRect(ctx, cx + 6.8 * z, cy - 17.4 * z, 4 * z, 1.1 * z);
    }

    drawDeskEvolutionExtras(
      ctx,
      kind === 'desk' ? 'dev_desk' : kind,
      cx,
      cy,
      z,
      timeSec,
      isOccupied,
      deskLevel,
    );
  } else if (kind === 'chair' || kind === 'desk_chair' || kind === 'meeting_chair') {
    // 5-star caster wheel base + pneumatic piston + ergonomic lumbar backrest & cushion
    const isMeeting = kind === 'meeting_chair';
    drawFloorShadow(ctx, cx, cy, 10, 5.5, z, 0.26);

    // 5-star base arms & tiny caster wheels
    ctx.strokeStyle = '#6c7a96';
    ctx.lineWidth = Math.max(1, 1.3 * z);
    const spokes = [
      [-6.5, 1.2],
      [6.5, 1.2],
      [-4.2, 3.2],
      [4.2, 3.2],
      [0, -2.5],
    ];
    for (const [dx, dy] of spokes) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 1 * z);
      ctx.lineTo(cx + dx * z, cy + dy * z);
      ctx.stroke();
      ctx.fillStyle = '#121520';
      pxRect(ctx, cx + dx * z - 0.8 * z, cy + dy * z, 1.8 * z, 1.5 * z);
    }

    // Pneumatic gas-lift cylinder piston
    ctx.fillStyle = '#9aa8c4';
    pxRect(ctx, cx - 1.2 * z, cy - 4.5 * z, 2.4 * z, 3.8 * z);

    // Contoured seat cushion & armrests
    if (isMeeting) {
      drawBox(ctx, cx, cy - 3.5 * z, 9.5, 5.2, 3.2, '#4164ad', '#2b4478', '#1c2d52', z);
      drawBox(ctx, cx - 2 * z, cy - 6.8 * z, 7.5, 3.2, 8.5, '#5278c7', '#345191', '#213666', z);
      ctx.fillStyle = '#b8c7e6';
      pxRect(ctx, cx - 4 * z, cy - 15.8 * z, 4 * z, 1.2 * z);
    } else {
      drawBox(ctx, cx, cy - 3.5 * z, 9.5, 5.2, 3.2, '#323c54', '#202738', '#141824', z);
      // Ergonomic side armrests
      ctx.fillStyle = '#1b2130';
      pxRect(ctx, cx - 7.5 * z, cy - 9.5 * z, 1.8 * z, 3.5 * z);
      pxRect(ctx, cx + 5.5 * z, cy - 9.5 * z, 1.8 * z, 3.5 * z);
      // Lumbar-supported backrest
      drawBox(ctx, cx - 2 * z, cy - 6.8 * z, 7.5, 3.2, 9, '#414f6e', '#29334a', '#192030', z);
      ctx.fillStyle = '#5c6f96';
      pxRect(ctx, cx - 5 * z, cy - 12 * z, 5.5 * z, 1.6 * z);
    }
  } else if (kind === 'gaming_seat') {
    drawFloorShadow(ctx, cx, cy, 14, 8.5, z, 0.26);
    drawBox(ctx, cx, cy, 13, 8, 7, '#3f6ad8', '#2a499e', '#1c326e', z);
    drawBox(ctx, cx - 1 * z, cy - 6.5 * z, 9.5, 5.2, 4, '#5c88f5', '#3f6ad8', '#2a499e', z);
    ctx.fillStyle = '#8cb0ff';
    pxRect(ctx, cx - 4 * z, cy - 9.5 * z, 6 * z, 1.4 * z);
  } else if (kind === 'sofa' || kind === 'sofa_l' || kind === 'sofa_r' || kind === 'armchair') {
    const isArm = kind === 'armchair';
    const w = isArm ? 15.5 : 20.5;
    const d = isArm ? 10 : 11;
    drawFloorShadow(ctx, cx, cy, w + 1.5, d + 1.5, z, 0.28);

    // Tapered oak feet
    ctx.fillStyle = '#6e4526';
    pxRect(ctx, cx - (w - 4) * z, cy + 1 * z, 2 * z, 2.2 * z);
    pxRect(ctx, cx + (w - 6) * z, cy + 1 * z, 2 * z, 2.2 * z);

    // Plush seat deck, side bolsters & tufted backrest
    const topC = isArm ? '#c25170' : '#cc4b5e';
    const leftC = isArm ? '#8f344d' : '#963040';
    const rightC = isArm ? '#662235' : '#6b1f2b';
    drawBox(ctx, cx, cy - 1 * z, w, d, 8.5, topC, leftC, rightC, z);
    // Side armrests
    drawBox(ctx, cx - (w - 4.5) * z, cy - 5 * z, 4, d * 0.72, 5.5, '#d96277', '#a1384a', '#732331', z);
    drawBox(ctx, cx + (w - 5.5) * z, cy - 3 * z, 4, d * 0.72, 5.5, '#d96277', '#a1384a', '#732331', z);
    // Tufted high backrest
    drawBox(ctx, cx - 3.5 * z, cy - 9.5 * z, w - 4, 4.2, 9, '#de6276', '#a83a4c', '#7a2533', z);

    // Button-tuft dimples & accent throw cushion
    ctx.fillStyle = '#611b27';
    pxRect(ctx, cx - 7 * z, cy - 14.5 * z, 1.6 * z, 1.6 * z);
    pxRect(ctx, cx - 1.5 * z, cy - 13.5 * z, 1.6 * z, 1.6 * z);
    if (!isArm) {
      pxRect(ctx, cx + 4 * z, cy - 12.5 * z, 1.6 * z, 1.6 * z);
      ctx.fillStyle = '#ffd166';
      pxRect(ctx, cx + 5 * z, cy - 12 * z, 4.5 * z, 4 * z);
    }
  } else if (kind === 'coffee_table' || kind === 'lounge_table') {
    drawFloorShadow(ctx, cx, cy, 17, 10, z, 0.26);
    // Walnut base shelf & smoked-glass inset top
    drawBox(ctx, cx, cy, 15.5, 9.2, 8, '#ad7851', '#805536', '#593923', z);
    ctx.fillStyle = 'rgba(34, 54, 79, 0.72)';
    pxRect(ctx, cx - 7.5 * z, cy - 11.5 * z, 15 * z, 5 * z);

    if (isOccupied) {
      // Hot open pepperoni pizza box
      ctx.fillStyle = '#f5ead6';
      pxRect(ctx, cx - 8 * z, cy - 15 * z, 16 * z, 10 * z);
      ctx.fillStyle = '#f7be45';
      pxRect(ctx, cx - 6 * z, cy - 13 * z, 12 * z, 6 * z);
      ctx.fillStyle = '#d93838';
      pxRect(ctx, cx - 4 * z, cy - 12 * z, 2 * z, 2 * z);
      pxRect(ctx, cx + 1 * z, cy - 10 * z, 2 * z, 2 * z);
      pxRect(ctx, cx + 3 * z, cy - 12 * z, 2 * z, 2 * z);
    } else {
      // Wireless dual gamepads & coasters on coffee table
      ctx.fillStyle = '#1b2234';
      pxRect(ctx, cx - 6 * z, cy - 11 * z, 5 * z, 2.8 * z);
      ctx.fillStyle = '#3cd8ff';
      pxRect(ctx, cx - 2.5 * z, cy - 10.4 * z, 1.2 * z, 1.2 * z);
      ctx.fillStyle = '#f0f4fc';
      pxRect(ctx, cx + 1.5 * z, cy - 10.8 * z, 5 * z, 2.8 * z);
      ctx.fillStyle = '#ff5666';
      pxRect(ctx, cx + 5 * z, cy - 10.2 * z, 1.2 * z, 1.2 * z);
    }
  } else if (kind === 'pizza_table') {
    drawFloorShadow(ctx, cx, cy, 19, 11, z, 0.28);
    drawBox(ctx, cx, cy, 18, 10, 11, '#b57d52', '#875a38', '#5e3d24', z);
    // Stacked pizzeria boxes + open steaming pepperoni pie
    ctx.fillStyle = '#f5ead6';
    pxRect(ctx, cx - 11 * z, cy - 17 * z, 9 * z, 5 * z);
    ctx.fillStyle = '#d93838';
    pxRect(ctx, cx - 10 * z, cy - 15.5 * z, 7 * z, 1.4 * z);
    ctx.fillStyle = '#f7be45';
    pxRect(ctx, cx + 0.5 * z, cy - 16 * z, 9.5 * z, 5.5 * z);
    ctx.fillStyle = '#d93838';
    pxRect(ctx, cx + 2 * z, cy - 15 * z, 2 * z, 2 * z);
    pxRect(ctx, cx + 6 * z, cy - 13.5 * z, 2 * z, 2 * z);
    const wispY = cy - (18 + ((timeSec * 4) % 4)) * z;
    ctx.fillStyle = 'rgba(255, 245, 220, 0.65)';
    pxRect(ctx, cx + 4.5 * z, wispY, 1.6 * z, 2 * z);
  } else if (kind === 'tv_console') {
    drawFloorShadow(ctx, cx, cy, 24, 10.5, z, 0.3);
    // Slatted media credenza + next-gen game console unit
    drawBox(ctx, cx, cy, 22, 9, 10, '#3a435c', '#252c3d', '#161a24', z);
    ctx.fillStyle = '#8c5c38';
    pxRect(ctx, cx - 14 * z, cy - 7 * z, 10 * z, 4 * z);
    pxRect(ctx, cx + 4 * z, cy - 7 * z, 10 * z, 4 * z);
    drawBox(ctx, cx, cy - 10 * z, 11, 5, 4, '#1b1f2b', '#10131c', '#090b10', z);
    ctx.fillStyle = isOccupied ? '#3be87a' : '#ff5666';
    pxRect(ctx, cx - 5 * z, cy - 12 * z, 3 * z, 2 * z);
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, cx, cy - 12 * z, 3 * z, 2 * z);

    // Ultra-thin bezel widescreen TV + ambient bias glow
    const tvX = cx - 22 * z;
    const tvY = cy - 42 * z;
    const tvW = 44 * z;
    const tvH = 26 * z;
    if (night || isOccupied) {
      ctx.fillStyle = isOccupied ? 'rgba(60, 216, 255, 0.18)' : 'rgba(110, 150, 255, 0.12)';
      pxRect(ctx, tvX - 2 * z, tvY - 2 * z, tvW + 4 * z, tvH + 4 * z);
    }
    ctx.fillStyle = '#0f131d';
    pxRect(ctx, tvX, tvY, tvW, tvH);
    ctx.fillStyle = isOccupied ? '#13203d' : '#192133';
    pxRect(ctx, tvX + 2 * z, tvY + 2 * z, tvW - 4 * z, tvH - 4 * z);

    if (isOccupied) {
      ctx.fillStyle = '#3cd8ff';
      pxRect(ctx, tvX + 4 * z, tvY + 4 * z, 14 * z, 2 * z);
      ctx.fillStyle = '#ff5666';
      pxRect(ctx, tvX + tvW - 18 * z, tvY + 4 * z, 14 * z, 2 * z);

      const hop1 = Math.abs(Math.sin(timeSec * 8)) * 4 * z;
      const hop2 = Math.abs(Math.cos(timeSec * 7)) * 4 * z;
      ctx.fillStyle = '#3be87a';
      pxRect(ctx, tvX + 10 * z, tvY + 15 * z - hop1, 6 * z, 6 * z);
      ctx.fillStyle = '#ffd147';
      pxRect(ctx, tvX + 28 * z, tvY + 15 * z - hop2, 6 * z, 6 * z);

      const projX = tvX + (17 + ((timeSec * 30) % 10)) * z;
      ctx.fillStyle = '#ff7eb9';
      pxRect(ctx, projX, tvY + 13 * z, 3 * z, 3 * z);
    } else {
      ctx.fillStyle = '#2d3c5c';
      pxRect(ctx, tvX + 12 * z, tvY + 11 * z, 20 * z, 2.5 * z);
      ctx.fillStyle = '#3cd8ff';
      pxRect(ctx, tvX + 17 * z, tvY + 15 * z, 10 * z, 1.5 * z);
    }
  } else if (kind === 'coffee_machine') {
    drawFloorShadow(ctx, cx, cy, 18, 11, z, 0.28);
    // Walnut espresso bar cabinet + chrome commercial dual-group espresso machine
    drawBox(ctx, cx, cy, 16, 10, 14, '#805840', '#5c3d2b', '#3d281c', z);
    drawBox(ctx, cx, cy - 14 * z, 10, 7, 14, '#d4dceb', '#9aa4b8', '#687185', z);
    // Pressure gauge, group head, white espresso cup & rising steam
    ctx.fillStyle = '#181e2e';
    pxRect(ctx, cx - 5 * z, cy - 20 * z, 10 * z, 4 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx - 1 * z, cy - 25 * z, 2.5 * z, 2.5 * z);
    ctx.fillStyle = '#ff5666';
    pxRect(ctx, cx - 5 * z, cy - 25 * z, 2.5 * z, 2 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, cx + 3 * z, cy - 25 * z, 2.5 * z, 2 * z);
    ctx.fillStyle = '#ffffff';
    pxRect(ctx, cx - 1.5 * z, cy - 18 * z, 3 * z, 2.8 * z);
    const steamY = cy - (29.5 + ((timeSec * 4) % 4)) * z;
    ctx.fillStyle = 'rgba(232, 245, 255, 0.7)';
    pxRect(ctx, cx - 1 * z, steamY, 2 * z, 2 * z);
  } else if (kind === 'watercooler' || kind === 'water_cooler') {
    drawFloorShadow(ctx, cx, cy, 11, 7, z, 0.25);
    drawBox(ctx, cx, cy, 9.5, 6.2, 16, '#e1eaf5', '#aab7cc', '#7b8799', z);
    drawBox(ctx, cx, cy - 16 * z, 6.2, 4.2, 11.5, '#70d8ff', '#3eb7f0', '#2287bd', z);
    // Hot & cold taps + rising water bubble inside bottle
    ctx.fillStyle = '#ff5666';
    pxRect(ctx, cx - 4 * z, cy - 13 * z, 2 * z, 2 * z);
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, cx - 1 * z, cy - 13 * z, 2 * z, 2 * z);
    const bubY = cy - (19 + ((timeSec * 6) % 7)) * z;
    ctx.fillStyle = '#e6fbff';
    pxRect(ctx, cx - 1 * z, bubY, 1.8 * z, 1.8 * z);
  } else if (kind === 'plant' || kind === 'office_plant' || kind === 'prop_plant') {
    drawFloorShadow(ctx, cx, cy, 10, 6, z, 0.24);
    // Glazed ceramic pot + terracotta rim + layered Monstera/Ficus foliage
    drawBox(ctx, cx, cy, 8.5, 5.5, 8, '#d8e0ed', '#a5b1c4', '#768296', z);
    ctx.fillStyle = '#3b2618';
    pxRect(ctx, cx - 5 * z, cy - 8.5 * z, 10 * z, 1.8 * z);
    ctx.fillStyle = '#6b4226';
    pxRect(ctx, cx - 1.5 * z, cy - 15 * z, 3 * z, 7 * z);
    ctx.fillStyle = '#1e7d42';
    pxRect(ctx, cx - 9 * z, cy - 20 * z, 18 * z, 8 * z);
    ctx.fillStyle = '#2fa857';
    pxRect(ctx, cx - 7.5 * z, cy - 24 * z, 15 * z, 9 * z);
    ctx.fillStyle = '#52e381';
    pxRect(ctx, cx - 4.5 * z, cy - 28 * z, 9 * z, 6 * z);
  } else if (kind === 'server_rack') {
    drawFloorShadow(ctx, cx, cy, 18, 11.5, z, 0.32);
    if (night) {
      ctx.fillStyle = 'rgba(60, 216, 255, 0.16)';
      pxRect(ctx, cx - 14 * z, cy - 4 * z, 28 * z, 8 * z);
    }
    drawBox(ctx, cx, cy, 16, 10, 38, '#3a4661', '#20283b', '#141824', z);

    // Smoked-glass front server door + blinking blade bays
    const leds = ['#3be87a', '#ffbe3b', '#ff5666'];
    for (let row = 0; row < 5; row++) {
      const ly = cy - (33 - row * 6) * z;
      ctx.fillStyle = '#0c0f17';
      pxRect(ctx, cx - 10.5 * z, ly, 9.5 * z, 3.4 * z);
      const blink = Math.floor(timeSec * 4 + row * 1.7) % 3;
      ctx.fillStyle = leds[(row + blink) % leds.length];
      pxRect(ctx, cx - 9.5 * z, ly + 0.9 * z, 2 * z, 1.8 * z);
      ctx.fillStyle = '#3cd8ff';
      pxRect(ctx, cx - 5.5 * z, ly + 0.9 * z, 2.2 * z, 1.8 * z);
    }
    // Smoked glass door sheen
    ctx.fillStyle = 'rgba(135, 214, 255, 0.12)';
    pxRect(ctx, cx - 11 * z, cy - 35 * z, 10.5 * z, 30 * z);
    ctx.strokeStyle = 'rgba(210, 242, 255, 0.38)';
    ctx.lineWidth = Math.max(1, z);
    ctx.beginPath();
    ctx.moveTo(cx - 9.5 * z, cy - 9 * z);
    ctx.lineTo(cx - 2.5 * z, cy - 31 * z);
    ctx.stroke();
  } else if (kind === 'whiteboard' || kind === 'whiteboard_l' || kind === 'whiteboard_r') {
    const isSingle = kind === 'whiteboard';
    drawFloorShadow(ctx, cx, cy, 17, 7, z, 0.24);
    drawBox(ctx, cx, cy, 16, 6, 4, '#4b5570', '#30384b', '#1e2330', z);

    const bx = (isSingle ? -22 : -16.5) * z;
    const by = -42 * z;
    const bw = (isSingle ? 44 : 33) * z;
    const bh = 30 * z;

    const hasTransform =
      typeof ctx.translate === 'function' && typeof ctx.transform === 'function';

    ctx.save();
    if (hasTransform) {
      ctx.translate(cx, cy);
      ctx.transform(1, 0.5, 0, 1, 0, 0);
    }
    const ox = hasTransform ? 0 : cx;
    const oy = hasTransform ? 0 : cy;

    if (isHovered || isOccupied || night) {
      ctx.fillStyle = isHovered
        ? '#ffe64d'
        : isOccupied
          ? 'rgba(60, 216, 255, 0.52)'
          : 'rgba(60, 216, 255, 0.18)';
      pxRect(ctx, ox + bx - 1.5 * z, oy + by - 2 * z, bw + 3 * z, bh + 4 * z);
    }

    // Brushed aluminum bezel + bright smartboard canvas
    ctx.fillStyle = '#8b9bb8';
    pxRect(ctx, ox + bx, oy + by, bw, bh);
    ctx.fillStyle = '#1b2233';
    pxRect(ctx, ox + bx + 1 * z, oy + by + 1 * z, bw - 2 * z, bh - 2 * z);
    ctx.fillStyle = isOccupied ? '#f8fbff' : '#eaf1fc';
    pxRect(ctx, ox + bx + 2 * z, oy + by + 2.2 * z, bw - 4 * z, bh - 5 * z);

    // Aluminum marker tray + red/blue/green markers
    ctx.fillStyle = '#6c7c99';
    pxRect(ctx, ox + bx + 3 * z, oy + by + bh - 2.5 * z, bw - 6 * z, 2 * z);
    ctx.fillStyle = '#ff5666';
    pxRect(ctx, ox + bx + 6 * z, oy + by + bh - 3 * z, 3.5 * z, 1.2 * z);
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, ox + bx + 11 * z, oy + by + bh - 3 * z, 3.5 * z, 1.2 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, ox + bx + 16 * z, oy + by + bh - 3 * z, 3.5 * z, 1.2 * z);

    if (kind === 'whiteboard_l' || isSingle) {
      // Flowchart nodes + bar metrics + sticky post-it notes
      ctx.fillStyle = '#3cd8ff';
      pxRect(ctx, ox + bx + 4 * z, oy + by + 15 * z, 4 * z, 9 * z);
      ctx.fillStyle = '#3be87a';
      pxRect(ctx, ox + bx + 9.5 * z, oy + by + 10 * z, 4 * z, 14 * z);
      ctx.fillStyle = '#ffbe3b';
      pxRect(ctx, ox + bx + 15 * z, oy + by + 13 * z, 4 * z, 11 * z);
      ctx.fillStyle = '#ffe159';
      pxRect(ctx, ox + bx + 21.5 * z, oy + by + 6 * z, 4.5 * z, 4.5 * z);
      ctx.fillStyle = '#ff7eb9';
      pxRect(ctx, ox + bx + 21.5 * z, oy + by + 12 * z, 4.5 * z, 4.5 * z);
      ctx.fillStyle = '#252b3b';
      pxRect(ctx, ox + bx + 4 * z, oy + by + 5 * z, 15 * z, 2 * z);

      if (whiteboardLabel && typeof ctx.fillText === 'function') {
        ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Silkscreen", monospace`;
        ctx.fillStyle = isHovered ? '#ffe64d' : '#9ee8ff';
        ctx.textAlign = 'center';
        ctx.fillText(whiteboardLabel, ox + (isSingle ? 0 : 16 * z), oy + by - 5 * z);
      }
    } else {
      // Architecture flowchart diagram + post-it note on right board
      ctx.fillStyle = '#b07cff';
      pxRect(ctx, ox + bx + 4 * z, oy + by + 6 * z, 8 * z, 5.5 * z);
      ctx.fillStyle = '#3cd8ff';
      pxRect(ctx, ox + bx + 19 * z, oy + by + 6 * z, 8 * z, 5.5 * z);
      ctx.fillStyle = '#394666';
      pxRect(ctx, ox + bx + 12 * z, oy + by + 8 * z, 7 * z, 1.8 * z);
      pxRect(ctx, ox + bx + 4 * z, oy + by + 15.5 * z, 21 * z, 1.8 * z);
      pxRect(ctx, ox + bx + 4 * z, oy + by + 20 * z, 15 * z, 1.8 * z);
      ctx.fillStyle = '#7efaa8';
      pxRect(ctx, ox + bx + 22 * z, oy + by + 18 * z, 4.5 * z, 4.5 * z);
    }
    ctx.restore();
  } else if (kind === 'war_table') {
    drawFloorShadow(ctx, cx, cy, 24, 13, z, 0.28);
    drawBox(ctx, cx, cy, 22, 12, 11, '#8497b5', '#58677d', '#3b4554', z);
    // Center AV connectivity hatch + post-it notes
    ctx.fillStyle = '#242c3d';
    pxRect(ctx, cx - 4 * z, cy - 12 * z, 8 * z, 2.5 * z);
    ctx.fillStyle = '#ffe159';
    pxRect(ctx, cx - 9 * z, cy - 14 * z, 4.5 * z, 3.5 * z);
    ctx.fillStyle = '#ff7eb9';
    pxRect(ctx, cx + 5 * z, cy - 13 * z, 4.5 * z, 3.5 * z);
  } else if (kind === 'bookshelf') {
    drawFloorShadow(ctx, cx, cy, 18, 9.5, z, 0.28);
    drawBox(ctx, cx, cy, 16, 8, 30, '#946037', '#6b4322', '#472b14', z);
    const bookColors = ['#ff5666', '#3cd8ff', '#ffd147', '#3be87a', '#b07cff'];
    for (let r = 0; r < 3; r++) {
      const syRow = cy - (24.5 - r * 7) * z;
      for (let b = 0; b < 4; b++) {
        ctx.fillStyle = bookColors[(r + b) % bookColors.length];
        pxRect(ctx, cx - (10 - b * 4) * z, syRow, 3 * z, 5 * z);
      }
    }
  } else if (kind === 'filing_cabinet') {
    drawFloorShadow(ctx, cx, cy, 14, 9, z, 0.26);
    drawBox(ctx, cx, cy, 12, 8, 22, '#8692ab', '#5d677d', '#3b4252', z);
    ctx.fillStyle = '#dce4f5';
    pxRect(ctx, cx - 6 * z, cy - 16.5 * z, 5.5 * z, 2 * z);
    pxRect(ctx, cx - 6 * z, cy - 9.5 * z, 5.5 * z, 2 * z);
  } else if (kind === 'prop_trophy') {
    drawFloorShadow(ctx, cx, cy, 11, 7, z, 0.25);
    drawBox(ctx, cx, cy, 10, 6, 12, '#73492c', '#52321d', '#331e11', z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx - 5 * z, cy - 24 * z, 10 * z, 8 * z);
    pxRect(ctx, cx - 2 * z, cy - 16 * z, 4 * z, 4 * z);
    ctx.fillStyle = '#fff5b8';
    pxRect(ctx, cx - 3 * z, cy - 22.5 * z, 3 * z, 3 * z);
  } else if (kind === 'prop_arcade') {
    drawCustomOrPartitionProp(ctx, 'arcade_cabinet', cx, cy, z, timeSec, isOccupied, night);
  } else if (kind === 'prop_hologram') {
    drawFloorShadow(ctx, cx, cy, 18, 10, z, 0.28);
    drawBox(ctx, cx, cy, 16, 9, 10, '#314863', '#1f2f42', '#121c29', z);
    const pulse = Math.sin(timeSec * 4) * 2 * z;
    ctx.fillStyle = 'rgba(60, 216, 255, 0.72)';
    pxRect(ctx, cx - 6 * z, cy - 26 * z + pulse, 12 * z, 10 * z);
    ctx.fillStyle = '#c4f6ff';
    pxRect(ctx, cx - 3 * z, cy - 23 * z + pulse, 6 * z, 4 * z);
  }

  ctx.restore();
}

export function drawOfficeDog(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  facing: Facing,
  timeSec: number,
  isZoomies: boolean,
): void {
  const z = zoom;
  const dir = facing === 'SW' || facing === 'NW' ? -1 : 1;
  const hop = isZoomies ? Math.abs(Math.sin(timeSec * 14)) * 4 * z : 0;
  const baseY = cy - hop;

  ctx.save();

  drawFloorShadow(ctx, cx, cy, 9, 4, z, 0.32);

  // Wagging tail
  const wag = Math.sin(timeSec * (isZoomies ? 16 : 7)) * 3 * z;
  ctx.strokeStyle = '#e08b3c';
  ctx.lineWidth = Math.max(2, 2.5 * z);
  ctx.beginPath();
  ctx.moveTo(cx - dir * 6 * z, baseY - 7 * z);
  ctx.lineTo(cx - dir * 10 * z, baseY - 12 * z + wag);
  ctx.stroke();

  // Corgi / Golden Dog body
  ctx.fillStyle = '#e08b3c';
  pxRect(ctx, cx - 7 * z, baseY - 11 * z, 14 * z, 9 * z);
  ctx.fillStyle = '#fff3dc';
  pxRect(ctx, cx - 3 * z, baseY - 7 * z, 7 * z, 4 * z);

  // Head + floppy ears
  const headX = cx + dir * 4 * z;
  ctx.fillStyle = '#e08b3c';
  pxRect(ctx, headX - 5 * z, baseY - 19 * z, 10 * z, 9 * z);
  ctx.fillStyle = '#b5631e';
  pxRect(ctx, headX - 5 * z, baseY - 21 * z, 3 * z, 4 * z);
  pxRect(ctx, headX + 2 * z, baseY - 21 * z, 3 * z, 4 * z);

  // Nose & Eyes
  ctx.fillStyle = '#11131c';
  pxRect(ctx, headX - 3 * z, baseY - 16 * z, 2 * z, 2 * z);
  pxRect(ctx, headX + 1 * z, baseY - 16 * z, 2 * z, 2 * z);
  pxRect(ctx, headX - 1 * z, baseY - 13 * z, 2 * z, 2 * z);

  // Sparkle ♥ or ★
  if (typeof ctx.fillText === 'function') {
    ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Silkscreen", monospace`;
    ctx.fillStyle = isZoomies ? '#ffd147' : '#ff7eb9';
    ctx.textAlign = 'center';
    ctx.fillText(isZoomies ? '★' : '♥', headX, baseY - 24 * z);
  }

  ctx.restore();
}

export type ToolBubbleKind = 'reading' | 'writing' | 'testing' | 'searching' | 'error';

/**
 * Draws XP/level-based desk upgrades on top of dev_desk, qa_desk, or exec_desk:
 * - Lv3+: Dual monitor upgrade
 * - Lv5+: Desk succulent plant & steaming coffee mug
 * - Lv8+: Gold mechanical keyboard & golden trophy
 */
export function drawDeskEvolutionExtras(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cx: number,
  cy: number,
  zoom: number,
  timeSec: number,
  isOccupied: boolean,
  level: number,
): void {
  if (level < 3) return;
  const z = zoom;

  // Lv3+: Dual monitor (qa_desk & exec_desk get a second left monitor; dev_desk gets an ultrawide top bar)
  if (kind === 'qa_desk' || kind === 'exec_desk') {
    const mx = kind === 'exec_desk' ? cx - 15 * z : cx - 13 * z;
    const my = cy - 23 * z;
    ctx.fillStyle = '#141824';
    pxRect(ctx, mx, my, 11 * z, 9 * z);
    ctx.fillStyle = isOccupied ? '#3cd8ff' : '#243147';
    pxRect(ctx, mx + 2 * z, my + 2 * z, 7 * z, 5 * z);
  } else if (kind === 'dev_desk') {
    ctx.fillStyle = isOccupied ? '#3be87a' : '#2a3954';
    pxRect(ctx, cx - 13 * z, cy - 24.5 * z, 6 * z, 1.2 * z);
    pxRect(ctx, cx + 7 * z, cy - 24.5 * z, 6 * z, 1.2 * z);
  }

  // Lv5+: Mini desk plant (left corner) & steaming mug (right corner)
  if (level >= 5) {
    ctx.fillStyle = '#a65c3a';
    pxRect(ctx, cx - 19 * z, cy - 13 * z, 5 * z, 4 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, cx - 20 * z, cy - 17 * z, 7 * z, 4 * z);
    ctx.fillStyle = '#7efaa8';
    pxRect(ctx, cx - 18 * z, cy - 19 * z, 3 * z, 2 * z);

    ctx.fillStyle = '#f4f6fc';
    pxRect(ctx, cx + 12 * z, cy - 13 * z, 4 * z, 4 * z);
    ctx.fillStyle = '#73381d';
    pxRect(ctx, cx + 13 * z, cy - 13 * z, 2 * z, 1 * z);
    const steamY = cy - (15 + ((timeSec * 4) % 4)) * z;
    ctx.fillStyle = 'rgba(220, 240, 255, 0.7)';
    pxRect(ctx, cx + 13 * z, steamY, 2 * z, 2 * z);
  }

  // Lv8+: Gold mechanical keyboard & golden trophy
  if (level >= 8) {
    const shimmer = Math.sin(timeSec * 4) > 0.3 ? '#fff3a1' : '#ffd147';
    ctx.fillStyle = '#b8860b';
    pxRect(ctx, cx - 7 * z, cy - 10 * z, 10 * z, 3 * z);
    ctx.fillStyle = shimmer;
    pxRect(ctx, cx - 6 * z, cy - 9 * z, 8 * z, 1 * z);

    ctx.fillStyle = '#8c6211';
    pxRect(ctx, cx + 15 * z, cy - 11 * z, 4 * z, 2 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx + 16 * z, cy - 15 * z, 2 * z, 4 * z);
    pxRect(ctx, cx + 14 * z, cy - 18 * z, 6 * z, 3 * z);
    ctx.fillStyle = shimmer;
    pxRect(ctx, cx + 15 * z, cy - 18 * z, 2 * z, 2 * z);
  }
}

/**
 * Draws a compact pixel-art tool activity icon bubble above a working/errored agent.
 */
export function drawToolStatusBubble(
  ctx: CanvasRenderingContext2D,
  kind: ToolBubbleKind,
  cx: number,
  cy: number,
  zoom: number,
  timeSec: number,
): void {
  const z = zoom;
  const bob = Math.sin(timeSec * 5) * 1.5 * z;
  const bx = cx - 8 * z;
  const by = cy - 14 * z + bob;
  const size = 15 * z;

  const accentMap: Record<ToolBubbleKind, string> = {
    reading: '#3cd8ff',
    writing: '#3be87a',
    testing: '#ffd147',
    searching: '#b07cff',
    error: '#ff5666',
  };
  const accent = accentMap[kind];

  ctx.save();
  ctx.fillStyle = 'rgba(13, 16, 28, 0.94)';
  pxRect(ctx, bx, by, size, size);
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1, z);
  pxStrokeRect(ctx, bx, by, size, size);

  // Tiny pointer tail
  ctx.fillStyle = accent;
  pxRect(ctx, cx - 1.5 * z, by + size, 3 * z, 2 * z);

  const ix = bx + 3 * z;
  const iy = by + 3 * z;
  ctx.fillStyle = accent;

  if (kind === 'reading') {
    pxRect(ctx, ix, iy + 1 * z, 4 * z, 7 * z);
    pxRect(ctx, ix + 5 * z, iy + 1 * z, 4 * z, 7 * z);
    ctx.fillStyle = '#0d101c';
    pxRect(ctx, ix + 1 * z, iy + 3 * z, 2 * z, 1 * z);
    pxRect(ctx, ix + 6 * z, iy + 3 * z, 2 * z, 1 * z);
  } else if (kind === 'writing') {
    pxRect(ctx, ix + 6 * z, iy, 3 * z, 3 * z);
    pxRect(ctx, ix + 3 * z, iy + 3 * z, 3 * z, 3 * z);
    pxRect(ctx, ix, iy + 6 * z, 3 * z, 3 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, ix, iy + 7 * z, 2 * z, 2 * z);
  } else if (kind === 'testing') {
    pxRect(ctx, ix + 3 * z, iy, 3 * z, 3 * z);
    pxRect(ctx, ix + 1 * z, iy + 3 * z, 7 * z, 5 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, ix + 2 * z, iy + 5 * z, 5 * z, 2 * z);
  } else if (kind === 'searching') {
    pxRect(ctx, ix + 1 * z, iy, 5 * z, 5 * z);
    ctx.fillStyle = '#0d101c';
    pxRect(ctx, ix + 2 * z, iy + 1 * z, 3 * z, 3 * z);
    ctx.fillStyle = accent;
    pxRect(ctx, ix + 5 * z, iy + 5 * z, 3 * z, 3 * z);
  } else {
    pxRect(ctx, ix + 3.5 * z, iy, 2 * z, 5 * z);
    pxRect(ctx, ix + 3.5 * z, iy + 7 * z, 2 * z, 2 * z);
  }

  ctx.restore();
}

/**
 * Draws an arcing pixel-art @mention envelope signal between two agents on the floor.
 */
export function drawMentionEnvelope(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  progress: number,
  color: string,
): void {
  const z = zoom;
  ctx.save();

  if (progress > 0.85) {
    const ringT = (progress - 0.85) / 0.15;
    ctx.strokeStyle = color;
    ctx.globalAlpha = Math.max(0, 1 - ringT);
    ctx.lineWidth = Math.max(1.5, 2 * z);
    if (typeof ctx.ellipse === 'function') {
      ctx.beginPath();
      ctx.ellipse(x, y, (8 + ringT * 14) * z, (4 + ringT * 7) * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const ew = 12 * z;
  const eh = 8 * z;
  const ex = x - ew / 2;
  const ey = y - eh / 2;

  ctx.fillStyle = '#fffdf2';
  pxRect(ctx, ex, ey, ew, eh);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1.2 * z);
  pxStrokeRect(ctx, ex, ey, ew, eh);

  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(x, ey + eh * 0.55);
  ctx.lineTo(ex + ew, ey);
  ctx.strokeStyle = '#141824';
  ctx.lineWidth = Math.max(1, z);
  ctx.stroke();

  ctx.fillStyle = color;
  pxRect(ctx, x - 1 * z, ey - 4 * z, 2 * z, 2 * z);

  ctx.restore();
}

/**
 * Draws a gleaming miniature golden verified trophy & emerald seal on the upper-left
 * corner of a desk when its assigned agent has verified task output (`isVerifiedOutput`).
 */
export function drawDeskVerifiedTrophy(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  zoom: number,
  timeSec: number,
): void {
  const z = zoom;
  const tx = sx - 13.5 * z;
  const ty = sy - 10.5 * z;
  const shimmer = Math.sin(timeSec * 3.6) > 0.25;

  ctx.save();

  // Warm golden reflection pool on desktop surface
  ctx.fillStyle = 'rgba(255, 214, 74, 0.22)';
  pxRect(ctx, tx - 3.2 * z, ty - 1.2 * z, 6.4 * z, 2.2 * z);

  // Obsidian & brass micro-pedestal
  ctx.fillStyle = '#181e2e';
  pxRect(ctx, tx - 2.4 * z, ty - 1.8 * z, 4.8 * z, 1.6 * z);
  ctx.fillStyle = '#9c6d14';
  pxRect(ctx, tx - 1.8 * z, ty - 2.8 * z, 3.6 * z, 1.1 * z);

  // Trophy stem & cup handles
  ctx.fillStyle = '#d9a121';
  pxRect(ctx, tx - 0.8 * z, ty - 4.8 * z, 1.6 * z, 2.1 * z);
  pxRect(ctx, tx - 3.2 * z, ty - 7.4 * z, 1 * z, 1.8 * z);
  pxRect(ctx, tx + 2.2 * z, ty - 7.4 * z, 1 * z, 1.8 * z);

  // Golden cup bowl + specular highlight + emerald verified core pixel
  ctx.fillStyle = '#ffd147';
  pxRect(ctx, tx - 2.2 * z, ty - 8 * z, 4.4 * z, 3.2 * z);
  ctx.fillStyle = shimmer ? '#fffbe0' : '#ffe885';
  pxRect(ctx, tx - 1.5 * z, ty - 7.6 * z, 1.8 * z, 1.3 * z);
  ctx.fillStyle = '#3be87a';
  pxRect(ctx, tx - 0.7 * z, ty - 6.4 * z, 1.4 * z, 1.3 * z);

  // Subtle periodic glint pixel above cup rim
  if (shimmer) {
    ctx.fillStyle = '#fff9c7';
    pxRect(ctx, tx + 1.8 * z, ty - 9.6 * z, 1.2 * z, 1.2 * z);
  }

  ctx.restore();
}

/**
 * Draws a passive, ultra-clean overhead micro HP bar (`12*z x 2*z`) alongside
 * subtle verified (gold/emerald) and error-loop (amber/crimson) pixel pips.
 */
export function drawAgentHealthBadge(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  zoom: number,
  timeSec: number,
  hpScore: number,
  isVerified: boolean,
  hasErrorLoop: boolean,
): void {
  const z = zoom;
  const clampedHp = Math.max(0, Math.min(100, Number.isFinite(hpScore) ? hpScore : 100));
  const barW = 12 * z;
  const barH = 2 * z;
  const bx = sx - barW * 0.5;
  const by = sy - barH * 0.5;

  ctx.save();

  // Crisp dark backing frame & depleted bar track
  ctx.fillStyle = 'rgba(12, 16, 28, 0.9)';
  pxRect(ctx, bx - 1 * z, by - 1 * z, barW + 2 * z, barH + 2 * z);
  ctx.fillStyle = '#20293d';
  pxRect(ctx, bx, by, barW, barH);

  // Active HP fill bar
  if (clampedHp > 0) {
    const fillW = (clampedHp / 100) * barW;
    ctx.fillStyle =
      clampedHp >= 70 ? '#3be87a' : clampedHp >= 40 ? '#ffbe3b' : '#ff5666';
    pxRect(ctx, bx, by, fillW, barH);
  }

  // Verified output micro-pip on right (gold rim + emerald check core)
  if (isVerified) {
    const vx = bx + barW + 1.6 * z;
    ctx.fillStyle = 'rgba(12, 16, 28, 0.92)';
    pxRect(ctx, vx - 0.6 * z, by - 1 * z, 3.6 * z, 4 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, vx, by - 0.4 * z, 2.4 * z, 2.8 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, vx + 0.6 * z, by + 0.2 * z, 1.2 * z, 1.6 * z);
  }

  // Error-loop warning micro-pip on left (amber/crimson pulse)
  if (hasErrorLoop) {
    const wx = bx - 4 * z;
    ctx.fillStyle = 'rgba(12, 16, 28, 0.92)';
    pxRect(ctx, wx - 0.6 * z, by - 1 * z, 3.6 * z, 4 * z);
    ctx.fillStyle = Math.sin(timeSec * 4.5) > 0 ? '#ff5666' : '#ffbe3b';
    pxRect(ctx, wx, by - 0.4 * z, 2.4 * z, 2.8 * z);
  }

  ctx.restore();
}
