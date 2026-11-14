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
  | 'elevator_doors'
  | 'gaming_neon_wall';

export type FurnitureKind =
  | 'desk'
  | 'exec_desk'
  | 'dev_desk'
  | 'qa_desk'
  | 'chair'
  | 'desk_chair'
  | 'swivel_chair'
  | 'exec_chair'
  | 'meeting_chair'
  | 'gaming_seat'
  | 'beanbag'
  | 'beanbag_cyan'
  | 'beanbag_purple'
  | 'beanbag_charcoal'
  | 'sofa'
  | 'sofa_l'
  | 'sofa_r'
  | 'armchair'
  | 'coffee_table'
  | 'lounge_table'
  | 'gaming_table'
  | 'war_table'
  | 'tv_console'
  | 'gaming_tv'
  | 'gaming_neon_wall'
  | 'neon_wall'
  | 'gaming_poster'
  | 'arcade'
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

  if (kind === 'arcade_cabinet' || kind === 'arcade') {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.5);
    drawFloorShadow(ctx, cx, cy, 17.5, 11.2, z, 0.32);

    // Ambient magenta + cyan neon wall/floor bloom behind cabinet
    ctx.fillStyle = `rgba(224, 64, 251, ${((night ? 0.22 : 0.12) + pulse * 0.08).toFixed(3)})`;
    pxRect(ctx, cx - 14 * z, cy - 36 * z, 13 * z, 33 * z);
    ctx.fillStyle = `rgba(0, 229, 255, ${((night ? 0.22 : 0.12) + pulse * 0.08).toFixed(3)})`;
    pxRect(ctx, cx + 1 * z, cy - 36 * z, 13 * z, 33 * z);

    // Lower matte-indigo cabinet base + coin door + pixel-art side game poster decal
    drawBox(ctx, cx, cy, 15, 10, 17, '#32245c', '#221842', '#150e2b', z);
    // Framed pixel-art side poster on left cabinet flank
    ctx.fillStyle = '#0d101c';
    pxRect(ctx, cx - 12.2 * z, cy - 14.2 * z, 6.2 * z, 10 * z);
    ctx.fillStyle = '#1b1d42';
    pxRect(ctx, cx - 11.4 * z, cy - 13.4 * z, 4.6 * z, 8.4 * z);
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, cx - 11.4 * z, cy - 8.2 * z, 4.6 * z, 2 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx - 10.2 * z, cy - 12.2 * z, 2.2 * z, 2.2 * z);
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, cx - 10.8 * z, cy - 6.6 * z, 3.4 * z, 1.2 * z);

    // Coin-op door with glowing amber coin slots
    ctx.fillStyle = '#101421';
    pxRect(ctx, cx - 3.2 * z, cy - 11 * z, 8 * z, 7 * z);
    ctx.fillStyle = '#ff8a3d';
    pxRect(ctx, cx - 1.8 * z, cy - 9 * z, 1.8 * z, 2.5 * z);
    pxRect(ctx, cx + 1.4 * z, cy - 9 * z, 1.8 * z, 2.5 * z);

    // Upper CRT housing + backlit marquee
    drawBox(ctx, cx - 1 * z, cy - 17 * z, 14, 9, 17, '#463080', '#2d1f57', '#1c1338', z);
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, cx - 10 * z, cy - 35.2 * z, 18 * z, 4.2 * z);
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, cx - 9.2 * z, cy - 34.6 * z, 16.4 * z, 1 * z);
    ctx.fillStyle = '#ffe14d';
    pxRect(ctx, cx - 7 * z, cy - 33.4 * z, 12 * z, 1.8 * z);

    // Vertical Magenta (#e040fb) & Cyan (#00e5ff) neon LED edge T-molding strips
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, cx - 11.8 * z, cy - 34.5 * z, 1.6 * z, 29.5 * z);
    ctx.fillStyle = '#ffb8ff';
    pxRect(ctx, cx - 11.3 * z, cy - 33.5 * z, 0.8 * z, 27.5 * z);
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, cx + 7.6 * z, cy - 34.5 * z, 1.6 * z, 18 * z);
    ctx.fillStyle = '#d4fcff';
    pxRect(ctx, cx + 8.0 * z, cy - 33.5 * z, 0.8 * z, 16 * z);

    // CRT screen & animated space shooter
    ctx.fillStyle = `rgba(0, 229, 255, ${((night ? 0.26 : 0.16) + pulse * 0.14).toFixed(3)})`;
    pxRect(ctx, cx - 10 * z, cy - 31 * z, 17.5 * z, 13.5 * z);
    ctx.fillStyle = '#0c101d';
    pxRect(ctx, cx - 9 * z, cy - 30 * z, 16 * z, 11 * z);
    ctx.fillStyle = pulse > 0.5 ? '#193869' : '#12284d';
    pxRect(ctx, cx - 7.5 * z, cy - 28.5 * z, 13 * z, 8 * z);

    const shipX = cx + (-5.5 + (Math.sin(timeSec * 3.8) * 0.5 + 0.5) * 7.5) * z;
    const laserY = cy - (23.5 + ((timeSec * 9) % 4)) * z;
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, cx - 2.5 * z, cy - 27.2 * z, 3.2 * z, 2 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, shipX + 1 * z, laserY, 1.5 * z, 2 * z);
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, shipX, cy - 22.5 * z, 3.5 * z, 2 * z);
    // CRT corner glint
    ctx.fillStyle = 'rgba(220, 248, 255, 0.45)';
    pxRect(ctx, cx - 6.8 * z, cy - 28 * z, 2.5 * z, 1.2 * z);

    // Control deck with ball-top joystick & RGB arcade buttons
    drawBox(ctx, cx + 1.5 * z, cy - 16 * z, 13, 8, 3, '#232e52', '#171f38', '#0e1426', z);
    ctx.fillStyle = '#dce5f7';
    pxRect(ctx, cx - 5 * z, cy - 20.5 * z, 1.5 * z, 2.5 * z);
    ctx.fillStyle = '#ff3b6b';
    pxRect(ctx, cx - 5.8 * z, cy - 22.2 * z, 3 * z, 2.2 * z);
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, cx + 0.5 * z, cy - 20 * z, 2 * z, 1.5 * z);
    ctx.fillStyle = '#e040fb';
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

  if (kind === 'gaming_neon_wall' || kind === 'neon_wall' || kind === 'gaming_poster') {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.6);
    drawFloorShadow(ctx, cx, cy, 18, 7.5, z, 0.28);

    // Matte-black slatted acoustic media accent panel
    drawBox(ctx, cx, cy, 17, 5.2, 36, '#232938', '#151924', '#0c0f17', z);
    ctx.fillStyle = '#0e111a';
    for (let i = 0; i < 6; i++) {
      pxRect(ctx, cx - (11.5 - i * 4.4) * z, cy - 33 * z, 1.4 * z, 28 * z);
    }

    // Soft dual-neon wall bloom (Magenta #e040fb + Cyan #00e5ff)
    ctx.fillStyle = `rgba(224, 64, 251, ${((night ? 0.28 : 0.16) + pulse * 0.08).toFixed(3)})`;
    pxRect(ctx, cx - 15.5 * z, cy - 38 * z, 15 * z, 34 * z);
    ctx.fillStyle = `rgba(0, 229, 255, ${((night ? 0.28 : 0.16) + pulse * 0.08).toFixed(3)})`;
    pxRect(ctx, cx + 0.5 * z, cy - 38 * z, 15 * z, 34 * z);

    // Vertical & horizontal glowing neon LED light tubes
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, cx - 13.8 * z, cy - 35.5 * z, 1.8 * z, 28 * z);
    pxRect(ctx, cx - 13.8 * z, cy - 36.2 * z, 12.5 * z, 1.6 * z);
    ctx.fillStyle = '#ffc4ff';
    pxRect(ctx, cx - 13.3 * z, cy - 34.5 * z, 0.8 * z, 26 * z);

    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, cx + 12 * z, cy - 35.5 * z, 1.8 * z, 28 * z);
    pxRect(ctx, cx + 1.2 * z, cy - 36.2 * z, 12.5 * z, 1.6 * z);
    ctx.fillStyle = '#d6fcff';
    pxRect(ctx, cx + 12.5 * z, cy - 34.5 * z, 0.8 * z, 26 * z);

    // Framed vibrant pixel-art retro game poster
    ctx.fillStyle = '#090b12';
    pxRect(ctx, cx - 9.2 * z, cy - 32.5 * z, 12.5 * z, 16.5 * z);
    ctx.fillStyle = '#171d3d';
    pxRect(ctx, cx - 8.2 * z, cy - 31.5 * z, 10.5 * z, 14.5 * z);
    // Synthwave sunset & grid inside poster
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, cx - 5.2 * z, cy - 28.5 * z, 4.5 * z, 4.2 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx - 4.5 * z, cy - 27.6 * z, 3.1 * z, 2 * z);
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, cx - 8.2 * z, cy - 22.8 * z, 10.5 * z, 1.2 * z);
    ctx.fillStyle = '#24184a';
    pxRect(ctx, cx - 8.2 * z, cy - 21.6 * z, 10.5 * z, 4.6 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, cx - 4.2 * z, cy - 20.5 * z, 2.6 * z, 2 * z);

    // Floating mini shelf + glowing golden '?' Question-Block collectible cube
    drawBox(ctx, cx + 6.8 * z, cy - 17.5 * z, 5.2, 3.2, 1.4, '#2f374d', '#1d2230', '#12151f', z);
    ctx.fillStyle = `rgba(255, 209, 71, ${(0.24 + pulse * 0.12).toFixed(3)})`;
    pxRect(ctx, cx + 3.2 * z, cy - 26.2 * z, 7.6 * z, 7.2 * z);
    // 2.5D pixel '?' block: bright front square + top bevel + right depth face
    const mqX = cx + 4.2 * z;
    const mqY = cy - 24.4 * z;
    ctx.fillStyle = '#ffe98a';
    pxRect(ctx, mqX + 0.8 * z, mqY - 1.1 * z, 4.8 * z, 1.2 * z);
    ctx.fillStyle = '#cc7a0a';
    pxRect(ctx, mqX + 4.8 * z, mqY - 0.6 * z, 1.3 * z, 4.8 * z);
    ctx.fillStyle = '#ffc42e';
    pxRect(ctx, mqX, mqY, 4.8 * z, 4.8 * z);
    ctx.fillStyle = '#ffffff';
    pxRect(ctx, mqX + 1.3 * z, mqY + 0.8 * z, 2.2 * z, 0.8 * z);
    pxRect(ctx, mqX + 2.6 * z, mqY + 1.5 * z, 0.9 * z, 1.1 * z);
    pxRect(ctx, mqX + 1.9 * z, mqY + 2.2 * z, 1.2 * z, 0.8 * z);
    pxRect(ctx, mqX + 1.9 * z, mqY + 3.4 * z, 0.9 * z, 0.8 * z);
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

export type ChairFacing = Facing | 'nw' | 'ne' | 'sw' | 'se';
export type ChairVariant = 'task' | 'meeting' | 'exec' | 'gaming';

/**
 * Renders a realistic, wafer-slim ergonomic 2.5D isometric swivel office chair:
 * 1. 5-star die-cast caster wheel base + gleaming pneumatic chrome cylinder + tilt housing
 * 2. Slim contoured waterfall seat cushion (~0.12 tile thickness, never a chunky block)
 * 3. Ultra-thin (~0.09 tile thickness) lumbar-supported mesh/leather backrest + tapered
 *    headrest + rear metallic J-spine bar (strictly non-cubic!)
 * 4. Left & right L/T-shaped padded armrests sorted in true isometric painter's depth order
 *    across all 4 facings (`nw`, `ne`, `sw`, `se`).
 */
export function drawErgonomicOfficeChair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  variant: ChairVariant = 'task',
  facing: ChairFacing = 'SE',
  accentColor = '#5cf0ff',
): void {
  const z = zoom;
  const dir = (facing || 'SE').toLowerCase() as 'nw' | 'ne' | 'sw' | 'se';

  // Forward unit step (direction the seated person faces) & orthogonal lateral step
  // Note: lat.y is always +0.5 so l < 0 is ALWAYS the far/background flank and l > 0 is ALWAYS the near/foreground flank.
  const fwd =
    dir === 'se'
      ? { x: 1.0, y: 0.5 }
      : dir === 'sw'
        ? { x: -1.0, y: 0.5 }
        : dir === 'ne'
          ? { x: 1.0, y: -0.5 }
          : { x: -1.0, y: -0.5 };

  const lat =
    dir === 'se' || dir === 'nw'
      ? { x: -1.0, y: 0.5 } // NE (-l) -> SW (+l)
      : { x: 1.0, y: 0.5 }; // NW (-l) -> SE (+l)

  const isFacingFront = fwd.y > 0; // 'se' or 'sw'

  const pt = (f: number, l: number, h: number) => ({
    x: cx + (f * fwd.x + l * lat.x) * z,
    y: cy + (f * fwd.y + l * lat.y - h) * z,
  });

  const drawQuad = (
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    fill: string,
    stroke?: string,
    lineW = 0.85,
  ) => {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.8, lineW * z);
      ctx.stroke();
    }
  };

  // Draws an oriented isometric 3D slab [f0..f1] x [l0..l1] x [h0..h1] with true thin-edge perspective
  const drawOrientedSlab = (
    f0: number,
    f1: number,
    l0: number,
    l1: number,
    h0: number,
    h1: number,
    topCol: string,
    fFaceCol: string,
    lFaceCol: string,
    outline = '#0f131f',
  ) => {
    const fVis = isFacingFront ? f1 : f0;
    // 1. Visible front/rear face (f = fVis)
    drawQuad(
      pt(fVis, l0, h0),
      pt(fVis, l1, h0),
      pt(fVis, l1, h1),
      pt(fVis, l0, h1),
      fFaceCol,
      outline,
      0.8,
    );
    // 2. Visible near lateral edge face (l = l1, since lat.y > 0)
    drawQuad(
      pt(f0, l1, h0),
      pt(f1, l1, h0),
      pt(f1, l1, h1),
      pt(f0, l1, h1),
      lFaceCol,
      outline,
      0.8,
    );
    // 3. Top face (h = h1)
    drawQuad(
      pt(f0, l0, h1),
      pt(f1, l0, h1),
      pt(f1, l1, h1),
      pt(f0, l1, h1),
      topCol,
      outline,
      0.8,
    );
  };

  // Palette per chair variant
  const pal =
    variant === 'exec'
      ? {
          seatTop: '#262b3d',
          seatFront: '#1b2030',
          seatSide: '#131724',
          frameOuter: '#171c2b',
          frameEdge: '#2e3852',
          meshInner: '#283044',
          meshRib: '#3c4866',
          headrestTop: '#323b54',
          trim: '#ffd147',
          armPad: '#2c344a',
          armStem: '#6d7f9e',
        }
      : variant === 'meeting'
        ? {
            seatTop: '#283c66',
            seatFront: '#1d2d4f',
            seatSide: '#142038',
            frameOuter: '#162036',
            frameEdge: '#324873',
            meshInner: '#2b4373',
            meshRib: '#41619e',
            headrestTop: '#8fa6cc',
            trim: '#9eb6de',
            armPad: '#212c45',
            armStem: '#7c90b3',
          }
        : variant === 'gaming'
          ? {
              seatTop: '#222b42',
              seatFront: '#181f33',
              seatSide: '#111626',
              frameOuter: '#151c2e',
              frameEdge: '#2c78c9',
              meshInner: '#1e2942',
              meshRib: '#3cd8ff',
              headrestTop: '#293859',
              trim: accentColor || '#3cd8ff',
              armPad: '#1e263b',
              armStem: '#3b4866',
            }
          : {
              // Standard ergonomic mesh office desk/task chair
              seatTop: '#273045',
              seatFront: '#1b2233',
              seatSide: '#121724',
              frameOuter: '#151b29',
              frameEdge: '#2c3752',
              meshInner: '#242f47',
              meshRib: '#3a4b6e',
              headrestTop: '#364361',
              trim: '#697d9e',
              armPad: '#232b3f',
              armStem: '#42506b',
            };

  // 1. Floor contact shadow
  drawFloorShadow(ctx, cx, cy + 0.5 * z, 9.2, 4.8, z, 0.25);

  // 2. 5-Star Swivel Caster Base & Dual-Wheel Rubber Casters
  const hubY = cy - 1.8 * z;
  const starAngles = [-2.55, -0.6, 0.48, 1.57, 2.66];
  for (const ang of starAngles) {
    const wx = cx + Math.cos(ang) * 7.2 * z;
    const wy = cy + Math.sin(ang) * 3.4 * z + 0.4 * z;

    // Dark wheel assembly touching floor
    ctx.fillStyle = '#0c0f17';
    pxRect(ctx, wx - 1.1 * z, wy - 0.3 * z, 2.2 * z, 1.7 * z);
    ctx.fillStyle = '#485673';
    pxRect(ctx, wx - 0.9 * z, wy - 0.9 * z, 1.8 * z, 0.9 * z);

    // Arched aluminum/nylon spoke leg from center hub down to caster hood
    ctx.strokeStyle = '#252e42';
    ctx.lineWidth = Math.max(1.2, 1.8 * z);
    ctx.beginPath();
    ctx.moveTo(cx, hubY);
    ctx.lineTo((cx + wx) * 0.5, (hubY + wy) * 0.5 - 0.6 * z);
    ctx.lineTo(wx, wy - 0.5 * z);
    ctx.stroke();

    // Brushed metallic top bevel along each star spoke
    ctx.strokeStyle = '#7e91b0';
    ctx.lineWidth = Math.max(0.8, 0.95 * z);
    ctx.beginPath();
    ctx.moveTo(cx, hubY - 0.4 * z);
    ctx.lineTo(wx * 0.88 + cx * 0.12, (wy - 0.8 * z) * 0.88 + hubY * 0.12);
    ctx.stroke();
  }

  // 3. Telescopic Pneumatic Chrome Gas-Lift Cylinder & Under-Seat Tilt Mechanism
  // Outer dark telescopic collar
  ctx.fillStyle = '#181e2d';
  pxRect(ctx, cx - 1.5 * z, cy - 3.8 * z, 3.0 * z, 2.3 * z);
  // Gleaming chrome inner hydraulic shaft + bright specular highlight
  ctx.fillStyle = '#7f93b3';
  pxRect(ctx, cx - 1.1 * z, cy - 6.4 * z, 2.2 * z, 2.8 * z);
  ctx.fillStyle = '#dce8ff';
  pxRect(ctx, cx - 0.4 * z, cy - 6.3 * z, 0.9 * z, 2.6 * z);

  // Compact dark under-seat tilt mechanism plate + height-adjust paddle lever
  drawOrientedSlab(-1.9, 1.6, -2.0, 2.0, 5.8, 6.9, '#1c2233', '#141926', '#0e121c');
  const leverTip = pt(0.2, 3.3, 6.1);
  const leverRoot = pt(0.2, 1.8, 6.3);
  ctx.strokeStyle = '#6c7e9c';
  ctx.lineWidth = Math.max(0.9, 1.0 * z);
  ctx.beginPath();
  ctx.moveTo(leverRoot.x, leverRoot.y);
  ctx.lineTo(leverTip.x, leverTip.y);
  ctx.stroke();

  // Helper: Slim L/T-shaped Armrest for side = -1 (far/background) or +1 (near/foreground)
  const drawArmrest = (side: -1 | 1) => {
    const lInner = side === -1 ? -5.6 : 4.5;
    const lOuter = side === -1 ? -4.5 : 5.6;
    const padInner = side === -1 ? -5.9 : 4.2;
    const padOuter = side === -1 ? -4.2 : 5.9;

    // Vertical L-support bracket rising from under seat side
    drawOrientedSlab(
      -1.2,
      0.1,
      lInner,
      lOuter,
      7.1,
      11.7,
      pal.armStem,
      '#1e2536',
      '#141926',
    );

    // Horizontal contoured polyurethane armrest top pad (T/L top bar)
    drawOrientedSlab(
      -2.4,
      2.5,
      padInner,
      padOuter,
      11.7,
      12.7,
      pal.armPad,
      '#192030',
      '#121724',
    );

    // Crisp soft-touch highlight along top of armrest pad
    const a0 = pt(-2.0, (padInner + padOuter) * 0.5, 12.75);
    const a1 = pt(2.1, (padInner + padOuter) * 0.5, 12.75);
    ctx.strokeStyle = 'rgba(190, 212, 248, 0.38)';
    ctx.lineWidth = Math.max(0.8, 0.9 * z);
    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y);
    ctx.lineTo(a1.x, a1.y);
    ctx.stroke();
  };

  // Helper: Slim Contoured Waterfall Seat Cushion (~1.7*z thin — never boxy!)
  const drawSeatCushion = () => {
    drawOrientedSlab(
      -4.3,
      4.7,
      -4.7,
      4.7,
      6.9,
      8.6,
      pal.seatTop,
      pal.seatFront,
      pal.seatSide,
    );

    // Subtle contoured thigh-bolster stitch seam & waterfall front bevel highlight
    const frontA = pt(4.25, -4.0, 8.65);
    const frontB = pt(4.25, 4.0, 8.65);
    ctx.strokeStyle = 'rgba(205, 224, 255, 0.26)';
    ctx.lineWidth = Math.max(0.8, 0.9 * z);
    ctx.beginPath();
    ctx.moveTo(frontA.x, frontA.y);
    ctx.lineTo(frontB.x, frontB.y);
    ctx.stroke();

    if (variant === 'gaming' || variant === 'exec') {
      // Subtle side bolster accent piping on seat cushion
      const pipeL0 = pt(-3.5, -4.1, 8.68);
      const pipeL1 = pt(3.8, -4.1, 8.68);
      const pipeR0 = pt(-3.5, 4.1, 8.68);
      const pipeR1 = pt(3.8, 4.1, 8.68);
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = Math.max(0.8, 0.95 * z);
      ctx.beginPath();
      ctx.moveTo(pipeL0.x, pipeL0.y);
      ctx.lineTo(pipeL1.x, pipeL1.y);
      ctx.moveTo(pipeR0.x, pipeR0.y);
      ctx.lineTo(pipeR1.x, pipeR1.y);
      ctx.stroke();
    }
  };

  // Helper: Wafer-Thin (~1.0*z thick!) Ergonomic Lumbar Backrest + Headrest + Metallic Spine Bar
  const drawSlimBackrest = () => {
    const drawSpineAndLumbarBridge = () => {
      // J-curved gunmetal/chrome spine arm connecting under-seat mechanism up the rear of backrest
      const sBase = pt(-2.2, 0, 6.4);
      const sElbow = pt(-5.45, 0, 8.2);
      const sMid = pt(-5.5, 0, 14.4);
      ctx.strokeStyle = '#263047';
      ctx.lineWidth = Math.max(1.3, 2.0 * z);
      ctx.beginPath();
      ctx.moveTo(sBase.x, sBase.y);
      ctx.lineTo(sElbow.x, sElbow.y);
      ctx.lineTo(sMid.x, sMid.y);
      ctx.stroke();

      ctx.strokeStyle = '#7b8fad';
      ctx.lineWidth = Math.max(0.8, 0.95 * z);
      ctx.beginPath();
      ctx.moveTo(sElbow.x, sElbow.y);
      ctx.lineTo(sMid.x, sMid.y);
      ctx.stroke();

      // Horizontal ergonomic Y-lumbar support bridge across rear frame
      const lumL = pt(-5.4, -3.8, 12.0);
      const lumR = pt(-5.4, 3.8, 12.0);
      ctx.strokeStyle = '#4a5c7d';
      ctx.lineWidth = Math.max(0.95, 1.25 * z);
      ctx.beginPath();
      ctx.moveTo(lumL.x, lumL.y);
      ctx.lineTo(lumR.x, lumR.y);
      ctx.stroke();
    };

    // When facing front (SE/SW), the spine is behind the backrest; draw it first
    if (isFacingFront) {
      drawSpineAndLumbarBridge();
    }

    // Main wafer-thin backrest frame: thickness f = [-5.2 .. -4.2] (ONLY 1.0 unit thin — never a cube!)
    const topMainH = variant === 'meeting' ? 16.6 : 17.4;
    drawOrientedSlab(
      -5.2,
      -4.2,
      -4.3,
      4.3,
      8.4,
      topMainH,
      pal.frameEdge,
      pal.frameOuter,
      '#101522',
    );

    // Breathable mesh / stitched leather inset panel on whichever face of backrest faces camera
    const meshF = isFacingFront ? -4.16 : -5.24;
    const mBot = 9.3;
    const mTop = topMainH - 0.8;
    drawQuad(
      pt(meshF, -3.4, mBot),
      pt(meshF, 3.4, mBot),
      pt(meshF, 3.4, mTop),
      pt(meshF, -3.4, mTop),
      pal.meshInner,
    );

    if (isFacingFront) {
      // Sculpted ergonomic lumbar support band + breathable horizontal mesh weave on front face
      drawQuad(
        pt(meshF + 0.03, -3.4, 10.8),
        pt(meshF + 0.03, 3.4, 10.8),
        pt(meshF + 0.03, 3.4, 12.4),
        pt(meshF + 0.03, -3.4, 12.4),
        'rgba(120, 152, 204, 0.18)',
      );

      ctx.strokeStyle = pal.meshRib;
      ctx.lineWidth = Math.max(0.8, 0.9 * z);
      const ribHeights =
        variant === 'meeting' ? [11.0, 13.0, 14.8] : [10.8, 12.5, 14.2, 15.8];
      for (const rh of ribHeights) {
        if (rh >= mTop) continue;
        const r0 = pt(meshF, -3.1, rh);
        const r1 = pt(meshF, 3.1, rh);
        ctx.beginPath();
        ctx.moveTo(r0.x, r0.y);
        ctx.lineTo(r1.x, r1.y);
        ctx.stroke();
      }
    }

    // Tapered upper shoulder / ergonomic headrest crown (slightly reclined to f = [-5.5 .. -4.4])
    if (variant === 'exec' || variant === 'gaming') {
      // Sculpted executive / racing headrest pillow with chrome neck pins
      const pinL0 = pt(-4.8, -1.8, topMainH);
      const pinL1 = pt(-5.0, -1.8, topMainH + 1.0);
      const pinR0 = pt(-4.8, 1.8, topMainH);
      const pinR1 = pt(-5.0, 1.8, topMainH + 1.0);
      ctx.strokeStyle = '#9fb3d4';
      ctx.lineWidth = Math.max(0.9, 1.1 * z);
      ctx.beginPath();
      ctx.moveTo(pinL0.x, pinL0.y);
      ctx.lineTo(pinL1.x, pinL1.y);
      ctx.moveTo(pinR0.x, pinR0.y);
      ctx.lineTo(pinR1.x, pinR1.y);
      ctx.stroke();

      drawOrientedSlab(
        -5.5,
        -4.4,
        -2.9,
        2.9,
        topMainH + 0.8,
        topMainH + 3.4,
        pal.headrestTop,
        pal.frameOuter,
        '#121724',
      );
    } else {
      // Sleek tapered upper arch / brushed top grip rail on task & meeting chairs
      drawOrientedSlab(
        -5.4,
        -4.3,
        -3.2,
        3.2,
        topMainH,
        topMainH + 1.8,
        pal.headrestTop,
        pal.frameOuter,
        '#121724',
      );
    }

    // Crisp top specular highlight along headrest/top rail
    const topRimH =
      variant === 'exec' || variant === 'gaming' ? topMainH + 3.45 : topMainH + 1.85;
    const h0 = pt(-4.9, -2.5, topRimH);
    const h1 = pt(-4.9, 2.5, topRimH);
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = Math.max(0.85, 1.0 * z);
    ctx.beginPath();
    ctx.moveTo(h0.x, h0.y);
    ctx.lineTo(h1.x, h1.y);
    ctx.stroke();

    // When facing away from camera (NE/NW), the spine bar is on the camera-facing rear of the backrest!
    if (!isFacingFront) {
      drawSpineAndLumbarBridge();
    }
  };

  // 4. True Isometric Painter's Order Assembly
  if (isFacingFront) {
    // Facing SE or SW: Backrest (furthest) -> Far Armrest -> Seat Cushion -> Near Armrest (closest)
    drawSlimBackrest();
    drawArmrest(-1);
    drawSeatCushion();
    drawArmrest(1);
  } else {
    // Facing NE or NW: Far Armrest -> Seat Cushion -> Near Armrest -> Slim Reclined Backrest + Rear Spine
    drawArmrest(-1);
    drawSeatCushion();
    drawArmrest(1);
    drawSlimBackrest();
  }
}

export type BeanbagColorVariant = 'cyan' | 'purple' | 'charcoal';

const BEANBAG_PALETTES: Record<
  BeanbagColorVariant,
  {
    shadowBelly: string;
    midLower: string;
    mainBody: string;
    upperLight: string;
    specular: string;
    hollowOuter: string;
    hollowDeep: string;
    seam: string;
    stitchGlint: string;
    outline: string;
    tagAccent: string;
  }
> = {
  // Reference Turquoise / Cyan (#189ab4)
  cyan: {
    shadowBelly: '#0b5061',
    midLower: '#12788f',
    mainBody: '#189ab4',
    upperLight: '#33bad6',
    specular: '#7be8fc',
    hollowOuter: '#0f667a',
    hollowDeep: '#084352',
    seam: '#0a4b5c',
    stitchGlint: '#62dcf2',
    outline: '#06313d',
    tagAccent: '#e040fb',
  },
  // Reference Neon Purple (#7b3fe4)
  purple: {
    shadowBelly: '#361475',
    midLower: '#5825b3',
    mainBody: '#7b3fe4',
    upperLight: '#9b66ff',
    specular: '#ccaaff',
    hollowOuter: '#4a1d99',
    hollowDeep: '#2e0f69',
    seam: '#351373',
    stitchGlint: '#b891ff',
    outline: '#200a4a',
    tagAccent: '#00e5ff',
  },
  // Reference Anthracite Dark Grey (#363c4a)
  charcoal: {
    shadowBelly: '#181c24',
    midLower: '#282e3b',
    mainBody: '#363c4a',
    upperLight: '#545f75',
    specular: '#8896b3',
    hollowOuter: '#212632',
    hollowDeep: '#13161e',
    seam: '#171b24',
    stitchGlint: '#6f7c99',
    outline: '#0d1017',
    tagAccent: '#00e5ff',
  },
};

const BEANBAG_ORDER: readonly BeanbagColorVariant[] = ['cyan', 'purple', 'charcoal'];

const beanbagFrameSeqMap = new WeakMap<
  CanvasRenderingContext2D,
  { timeSec: number; count: number; firstSx: number; firstSy: number }
>();

function resolveBeanbagColorVariant(
  ctx: CanvasRenderingContext2D,
  kind: string,
  sx: number,
  sy: number,
  timeSec: number,
  explicitIndex?: number,
): BeanbagColorVariant {
  const k = kind.toLowerCase();
  if (k.includes('cyan') || k.includes('turquoise') || k.endsWith('_0')) return 'cyan';
  if (k.includes('purple') || k.includes('violet') || k.endsWith('_1')) return 'purple';
  if (k.includes('charcoal') || k.includes('grey') || k.includes('gray') || k.endsWith('_2')) {
    return 'charcoal';
  }
  if (typeof explicitIndex === 'number' && Number.isFinite(explicitIndex)) {
    return BEANBAG_ORDER[Math.abs(Math.trunc(explicitIndex)) % 3];
  }

  // Per-(ctx, timeSec) render-order counter: 100% invariant to camera pan & zoom!
  const prev = beanbagFrameSeqMap.get(ctx);
  if (
    !prev ||
    prev.timeSec !== timeSec ||
    (prev.count > 0 && Math.abs(prev.firstSx - sx) < 0.5 && Math.abs(prev.firstSy - sy) < 0.5)
  ) {
    beanbagFrameSeqMap.set(ctx, { timeSec, count: 1, firstSx: sx, firstSy: sy });
    return BEANBAG_ORDER[0];
  }
  const idx = prev.count;
  prev.count += 1;
  return BEANBAG_ORDER[idx % 3];
}

/**
 * Renders a large, organic, slouchy 2.5D pear/teardrop lounge beanbag chair
 * with a sunken ergonomic center seating hollow, plump backrest lobe oriented
 * by `facing`, curved 6-panel gore stitch seams, compression creases, and woven tag.
 */
export function drawPlushBeanbag(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  facing: ChairFacing = 'SE',
  colorVariant: BeanbagColorVariant = 'cyan',
): void {
  const z = zoom;
  const dir = (facing || 'SE').toLowerCase() as 'nw' | 'ne' | 'sw' | 'se';
  const isFront = dir === 'se' || dir === 'sw';
  // Canonical x has backrest on left (-x) and gamer facing right (+x); flip for SW / NW
  const s = dir === 'sw' || dir === 'nw' ? -1 : 1;
  const pal = BEANBAG_PALETTES[colorVariant] ?? BEANBAG_PALETTES.cyan;

  const p = (dx: number, dy: number) => ({
    x: cx + s * dx * z,
    y: cy + dy * z,
  });

  const fillSmoothBlob = (
    pts: ReadonlyArray<{ x: number; y: number }>,
    fill: string,
    stroke?: string,
    lineW = 1.0,
  ) => {
    const n = pts.length;
    if (n < 3) return;
    const hasQuad = typeof ctx.quadraticCurveTo === 'function';
    const m0x = (pts[n - 1].x + pts[0].x) * 0.5;
    const m0y = (pts[n - 1].y + pts[0].y) * 0.5;
    ctx.beginPath();
    ctx.moveTo(m0x, m0y);
    for (let i = 0; i < n; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const mx = (curr.x + next.x) * 0.5;
      const my = (curr.y + next.y) * 0.5;
      if (hasQuad) {
        ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
      } else {
        const prevMx = i === 0 ? m0x : (pts[i - 1].x + curr.x) * 0.5;
        const prevMy = i === 0 ? m0y : (pts[i - 1].y + curr.y) * 0.5;
        for (let step = 1; step <= 3; step++) {
          const t = step / 3;
          const omt = 1 - t;
          ctx.lineTo(
            omt * omt * prevMx + 2 * omt * t * curr.x + t * t * mx,
            omt * omt * prevMy + 2 * omt * t * curr.y + t * t * my,
          );
        }
      }
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.85, lineW * z);
      ctx.stroke();
    }
  };

  const strokeSmoothCurve = (
    p0: { x: number; y: number },
    ctrl: { x: number; y: number },
    p1: { x: number; y: number },
    color: string,
    lineW = 0.95,
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, lineW * z);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    if (typeof ctx.quadraticCurveTo === 'function') {
      ctx.quadraticCurveTo(ctrl.x, ctrl.y, p1.x, p1.y);
    } else {
      ctx.lineTo(ctrl.x, ctrl.y);
      ctx.lineTo(p1.x, p1.y);
    }
    ctx.stroke();
  };

  // Soft wide elliptical floor contact shadow
  drawFloorShadow(ctx, cx, cy + 1.0 * z, 15.0, 8.6, z, 0.32);

  if (isFront) {
    // 1. Wide squished lower belly shadow base
    fillSmoothBlob(
      [
        p(-13.8, -5.2),
        p(-6.5, -11.4),
        p(6.4, -9.8),
        p(13.8, -4.4),
        p(12.6, 1.8),
        p(3.2, 4.3),
        p(-6.8, 3.8),
        p(-13.6, -0.2),
      ],
      pal.shadowBelly,
      pal.outline,
      1.05,
    );

    // 2. Plump pear/teardrop main silhouette rising into upper backrest lobe
    fillSmoothBlob(
      [
        p(-13.8, -4.8),
        p(-12.5, -11.8),
        p(-8.8, -17.6),
        p(-3.8, -18.0),
        p(1.8, -13.2),
        p(9.6, -10.4),
        p(13.6, -5.2),
        p(12.0, 0.8),
        p(2.8, 3.1),
        p(-7.2, 2.3),
      ],
      pal.midLower,
      pal.outline,
      1.0,
    );

    // 3. Lit upper microbead cushion volume
    fillSmoothBlob(
      [
        p(-12.4, -5.8),
        p(-11.4, -12.0),
        p(-8.2, -17.0),
        p(-3.8, -17.3),
        p(1.5, -12.8),
        p(9.0, -9.9),
        p(12.5, -5.6),
        p(10.2, -0.8),
        p(2.2, 1.1),
        p(-6.8, 0.3),
      ],
      pal.mainBody,
    );

    // 4. Upper teardrop backrest highlight & puffy front thigh bolster sheen
    fillSmoothBlob(
      [
        p(-10.4, -10.6),
        p(-8.4, -16.2),
        p(-4.4, -16.5),
        p(-1.6, -13.0),
        p(-5.8, -9.8),
      ],
      pal.upperLight,
    );
    fillSmoothBlob(
      [p(-8.4, -14.8), p(-6.2, -15.8), p(-4.8, -14.2), p(-6.8, -12.8)],
      pal.specular,
    );

    // 5. Deep sunken center ergonomic seating hollow + thigh-support roll
    fillSmoothBlob(
      [
        p(-3.8, -8.8),
        p(1.8, -10.4),
        p(8.0, -8.2),
        p(8.4, -4.8),
        p(2.2, -3.5),
        p(-3.6, -5.2),
      ],
      pal.hollowOuter,
    );
    fillSmoothBlob(
      [
        p(-1.6, -7.8),
        p(2.0, -8.6),
        p(5.5, -7.1),
        p(5.2, -5.4),
        p(1.4, -4.8),
        p(-1.8, -5.9),
      ],
      pal.hollowDeep,
    );
    // Puffy front knee-bolster highlight rim below hollow
    fillSmoothBlob(
      [p(-1.2, -3.4), p(4.5, -4.0), p(10.2, -4.6), p(9.6, -1.8), p(3.4, -0.8)],
      pal.upperLight,
    );

    // 6. Curved panel stitch seams & compression dimple wrinkles
    strokeSmoothCurve(p(-6.3, -17.2), p(-10.8, -8.8), p(-8.2, 2.2), pal.seam, 0.95);
    strokeSmoothCurve(p(-5.4, -17.0), p(-2.8, -13.2), p(-0.8, -8.6), pal.seam, 0.9);
    strokeSmoothCurve(p(5.2, -6.2), p(8.6, -6.4), p(11.6, -4.6), pal.seam, 0.85);
    strokeSmoothCurve(p(1.4, -5.0), p(2.2, -3.2), p(2.8, -1.2), pal.seam, 0.85);

    // Top carry-loop tab, topstitch glints & woven lounge brand tag (guaranteed positive pxRects)
    ctx.fillStyle = pal.midLower;
    pxRect(ctx, p(-6.9, -18.8).x - 1 * z, p(-6.9, -18.8).y, 2.2 * z, 1.5 * z);
    ctx.fillStyle = pal.stitchGlint;
    pxRect(ctx, p(-9.6, -9.2).x, p(-9.6, -9.2).y, 1.1 * z, 1.1 * z);
    pxRect(ctx, p(-9.2, -4.8).x, p(-9.2, -4.8).y, 1.1 * z, 1.1 * z);
    ctx.fillStyle = pal.tagAccent;
    pxRect(ctx, p(-12.2, -1.4).x - 1 * z, p(-12.2, -1.4).y, 2.2 * z, 1.4 * z);
  } else {
    // Facing NE or NW: gamer faces upper screen; plump pear backrest wraps around near-side flank
    // 1. Wide squished lower belly shadow base
    fillSmoothBlob(
      [
        p(-14.0, -2.8),
        p(-5.6, -10.6),
        p(6.8, -11.2),
        p(13.6, -6.0),
        p(12.4, 0.6),
        p(3.0, 4.2),
        p(-6.8, 4.6),
        p(-13.8, 1.4),
      ],
      pal.shadowBelly,
      pal.outline,
      1.05,
    );

    // 2. Plump 3/4 rear-side pear silhouette + wide front pouf cushion
    fillSmoothBlob(
      [
        p(-13.8, 0.8),
        p(-13.4, -7.8),
        p(-9.2, -14.8),
        p(-4.2, -15.2),
        p(1.8, -11.6),
        p(8.8, -11.0),
        p(13.5, -6.2),
        p(11.8, -0.2),
        p(2.8, 3.2),
        p(-6.8, 3.6),
      ],
      pal.midLower,
      pal.outline,
      1.0,
    );

    // 3. Main lit microbead body
    fillSmoothBlob(
      [
        p(-12.5, -0.4),
        p(-12.2, -8.0),
        p(-8.6, -14.2),
        p(-4.2, -14.6),
        p(1.6, -11.2),
        p(8.4, -10.5),
        p(12.4, -6.2),
        p(10.2, -1.2),
        p(2.2, 1.5),
        p(-6.6, 1.8),
      ],
      pal.mainBody,
    );

    // 4. Visible 3/4 sunken seating hollow on upper-forward pocket
    fillSmoothBlob(
      [
        p(-1.4, -9.8),
        p(4.2, -10.4),
        p(9.2, -8.2),
        p(8.4, -5.2),
        p(2.6, -4.6),
        p(-1.8, -6.8),
      ],
      pal.hollowOuter,
    );
    fillSmoothBlob(
      [p(0.6, -8.8), p(4.4, -9.0), p(6.8, -7.4), p(5.8, -5.8), p(1.6, -5.8)],
      pal.hollowDeep,
    );

    // 5. Plump near-side teardrop backrest bolster crown & soft sheen
    fillSmoothBlob(
      [
        p(-11.2, -5.2),
        p(-9.0, -13.6),
        p(-4.4, -14.0),
        p(-1.2, -9.2),
        p(-3.8, -2.4),
        p(-9.4, -1.2),
      ],
      pal.upperLight,
    );
    fillSmoothBlob(
      [p(-8.4, -12.4), p(-5.8, -13.2), p(-4.6, -11.2), p(-7.2, -10.2)],
      pal.specular,
    );

    // 6. Curved rear 6-panel gore stitch seams, top loop & woven brand tag
    strokeSmoothCurve(p(-6.6, -14.4), p(-10.8, -6.2), p(-8.8, 3.0), pal.seam, 0.95);
    strokeSmoothCurve(p(-5.6, -14.2), p(-4.2, -5.8), p(-2.2, 2.8), pal.seam, 0.95);
    strokeSmoothCurve(p(4.8, -6.0), p(8.2, -4.6), p(10.8, -1.6), pal.seam, 0.85);

    ctx.fillStyle = pal.midLower;
    pxRect(ctx, p(-6.8, -15.8).x - 1 * z, p(-6.8, -15.8).y, 2.2 * z, 1.5 * z);
    ctx.fillStyle = pal.stitchGlint;
    pxRect(ctx, p(-4.8, -7.6).x, p(-4.8, -7.6).y, 1.1 * z, 1.1 * z);
    pxRect(ctx, p(-3.8, -3.2).x, p(-3.8, -3.2).y, 1.1 * z, 1.1 * z);
    ctx.fillStyle = pal.tagAccent;
    pxRect(ctx, p(-12.4, 0.4).x - 1 * z, p(-12.4, 0.4).y, 2.2 * z, 1.4 * z);
  }
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
  facing: ChairFacing = 'SE',
  colorIndex?: number,
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
  } else if (
    kind === 'chair' ||
    kind === 'desk_chair' ||
    kind === 'swivel_chair' ||
    kind === 'exec_chair' ||
    kind === 'meeting_chair'
  ) {
    const chairVariant: ChairVariant =
      kind === 'exec_chair' ? 'exec' : kind === 'meeting_chair' ? 'meeting' : 'task';
    drawErgonomicOfficeChair(ctx, cx, cy, z, chairVariant, facing, modelAccent);
  } else if (
    kind === 'gaming_seat' ||
    kind === 'beanbag' ||
    kind.startsWith('beanbag_') ||
    kind.startsWith('gaming_seat_')
  ) {
    const bagColor = resolveBeanbagColorVariant(ctx, kind, sx, sy, timeSec, colorIndex);
    drawPlushBeanbag(ctx, cx, cy, z, facing, bagColor);
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
  } else if (kind === 'coffee_table' || kind === 'lounge_table' || kind === 'gaming_table') {
    drawFloorShadow(ctx, cx, cy, 18.2, 10.6, z, 0.3);

    // Modern matte-black steel legs & open lower magazine/accessory shelf
    ctx.fillStyle = '#0f121a';
    pxRect(ctx, cx - 13.5 * z, cy - 5.5 * z, 2 * z, 6.8 * z);
    pxRect(ctx, cx + 11.5 * z, cy - 5.5 * z, 2 * z, 6.8 * z);
    pxRect(ctx, cx - 1 * z, cy + 1.5 * z, 2.2 * z, 4.2 * z);
    drawBox(ctx, cx, cy - 1.4 * z, 15.2, 8.6, 2.2, '#222836', '#161b26', '#0d1018', z);

    // Artbooks / game magazines tucked on lower shelf
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, cx - 6.5 * z, cy - 5.2 * z, 5.5 * z, 1.4 * z);
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, cx + 1.2 * z, cy - 4.8 * z, 5 * z, 1.3 * z);

    // Glossy dark smoked-glass tabletop on matte-black bezel frame
    drawBox(
      ctx,
      cx,
      cy - 6.8 * z,
      17.4,
      9.8,
      2.1,
      '#151e30',
      '#121724',
      '#0b0e17',
      z,
      'rgba(130, 232, 255, 0.42)',
    );
    // Smoked-glass inner mirror tint + crisp diagonal glass specular streaks
    ctx.beginPath();
    ctx.moveTo(cx, cy - 15.8 * z);
    ctx.lineTo(cx + 14.2 * z, cy - 11.2 * z);
    ctx.lineTo(cx, cy - 6.6 * z);
    ctx.lineTo(cx - 14.2 * z, cy - 11.2 * z);
    ctx.closePath();
    ctx.fillStyle = 'rgba(18, 34, 56, 0.82)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(210, 248, 255, 0.45)';
    ctx.lineWidth = Math.max(0.9, 1.1 * z);
    ctx.beginPath();
    ctx.moveTo(cx - 8.5 * z, cy - 10.2 * z);
    ctx.lineTo(cx - 2.2 * z, cy - 13.8 * z);
    ctx.moveTo(cx - 4.8 * z, cy - 8.8 * z);
    ctx.lineTo(cx + 0.5 * z, cy - 11.8 * z);
    ctx.stroke();

    if (isOccupied) {
      // Hot open pepperoni pizza box (PIZZA_PARTY active)
      ctx.fillStyle = '#f5ead6';
      pxRect(ctx, cx - 8 * z, cy - 15.5 * z, 16 * z, 10 * z);
      ctx.fillStyle = '#f7be45';
      pxRect(ctx, cx - 6 * z, cy - 13.5 * z, 12 * z, 6 * z);
      ctx.fillStyle = '#d93838';
      pxRect(ctx, cx - 4 * z, cy - 12.5 * z, 2 * z, 2 * z);
      pxRect(ctx, cx + 1 * z, cy - 10.5 * z, 2 * z, 2 * z);
      pxRect(ctx, cx + 3 * z, cy - 12.5 * z, 2 * z, 2 * z);
    } else {
      // Ceramic rimmed snack/chips bowl heaped with golden tortilla crisps
      ctx.fillStyle = '#9aa8bf';
      pxRect(ctx, cx - 5.2 * z, cy - 12.0 * z, 6.2 * z, 2.8 * z);
      ctx.fillStyle = '#eef3fc';
      pxRect(ctx, cx - 5.8 * z, cy - 13.0 * z, 7.4 * z, 1.6 * z);
      ctx.fillStyle = '#f59f2a';
      pxRect(ctx, cx - 4.8 * z, cy - 14.4 * z, 5.4 * z, 1.8 * z);
      ctx.fillStyle = '#ffd147';
      pxRect(ctx, cx - 4.2 * z, cy - 15.2 * z, 2.2 * z, 1.6 * z);
      pxRect(ctx, cx - 1.6 * z, cy - 14.9 * z, 2.0 * z, 1.5 * z);
      ctx.fillStyle = '#ffe999';
      pxRect(ctx, cx - 2.8 * z, cy - 15.5 * z, 1.5 * z, 1.2 * z);

      // Sleek black TV remote + two-tone DualSense wireless gamepad on smoked glass
      ctx.fillStyle = '#0d1018';
      pxRect(ctx, cx + 2.2 * z, cy - 13.4 * z, 2.0 * z, 4.2 * z);
      ctx.fillStyle = '#ff4d6d';
      pxRect(ctx, cx + 2.7 * z, cy - 13.0 * z, 1.0 * z, 0.9 * z);

      ctx.fillStyle = '#f2f6ff';
      pxRect(ctx, cx + 5.2 * z, cy - 12.2 * z, 4.8 * z, 2.6 * z);
      ctx.fillStyle = '#1b2130';
      pxRect(ctx, cx + 6.3 * z, cy - 11.4 * z, 2.6 * z, 1.6 * z);
      ctx.fillStyle = '#00e5ff';
      pxRect(ctx, cx + 6.8 * z, cy - 12.0 * z, 1.6 * z, 0.8 * z);
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
  } else if (kind === 'tv_console' || kind === 'gaming_tv') {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.8);
    drawFloorShadow(ctx, cx, cy, 26, 11, z, 0.34);

    // 1. Dual Magenta (#e040fb) + Cyan (#00e5ff) Neon Ambilight Wall Halo & LED Strips
    const tvX = cx - 23 * z;
    const tvY = cy - 43.5 * z;
    const tvW = 46 * z;
    const tvH = 26 * z;
    const glowBase = night ? 0.26 : 0.16;
    ctx.fillStyle = `rgba(224, 64, 251, ${(glowBase + pulse * 0.07).toFixed(3)})`;
    pxRect(ctx, tvX - 3.5 * z, tvY - 2.5 * z, tvW * 0.54, tvH + 6 * z);
    ctx.fillStyle = `rgba(0, 229, 255, ${(glowBase + (1 - pulse) * 0.07).toFixed(3)})`;
    pxRect(ctx, cx - 1 * z, tvY - 2.5 * z, tvW * 0.54 + 3.5 * z, tvH + 6 * z);

    // Flanking vertical & crown neon light tubes behind TV
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, tvX - 2.4 * z, tvY + 1 * z, 1.5 * z, tvH - 2 * z);
    pxRect(ctx, tvX, tvY - 1.8 * z, tvW * 0.48, 1.3 * z);
    ctx.fillStyle = '#ffc4ff';
    pxRect(ctx, tvX - 2.0 * z, tvY + 2.5 * z, 0.8 * z, tvH - 5 * z);

    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, tvX + tvW + 0.9 * z, tvY + 1 * z, 1.5 * z, tvH - 2 * z);
    pxRect(ctx, cx + 1 * z, tvY - 1.8 * z, tvW * 0.48, 1.3 * z);
    ctx.fillStyle = '#d4fcff';
    pxRect(ctx, tvX + tvW + 1.2 * z, tvY + 2.5 * z, 0.8 * z, tvH - 5 * z);

    // 2. Wide Matte-Black Shelved Media Credenza
    drawBox(
      ctx,
      cx,
      cy,
      24.5,
      9.6,
      10.5,
      '#222734',
      '#151821',
      '#0c0e15',
      z,
      'rgba(185, 210, 255, 0.18)',
    );
    // Open recessed media cubby shelves (left & right bays)
    ctx.fillStyle = '#080a10';
    pxRect(ctx, cx - 16.5 * z, cy - 8.2 * z, 14.5 * z, 5.6 * z);
    pxRect(ctx, cx + 2 * z, cy - 8.2 * z, 14.5 * z, 5.6 * z);
    ctx.fillStyle = '#2a3142';
    pxRect(ctx, cx - 16.5 * z, cy - 5.2 * z, 14.5 * z, 1.1 * z);
    pxRect(ctx, cx + 2 * z, cy - 5.2 * z, 14.5 * z, 1.1 * z);

    // Left cubby: game case spines + retro 64-bit cartridge mini-console
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, cx - 15.5 * z, cy - 4.0 * z, 1.2 * z, 2.4 * z);
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, cx - 13.8 * z, cy - 4.0 * z, 1.2 * z, 2.4 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx - 12.1 * z, cy - 4.0 * z, 1.2 * z, 2.4 * z);
    ctx.fillStyle = '#32394d';
    pxRect(ctx, cx - 9.2 * z, cy - 7.8 * z, 5.8 * z, 2.2 * z);
    ctx.fillStyle = '#ff4d6d';
    pxRect(ctx, cx - 8.4 * z, cy - 7.1 * z, 1.1 * z, 0.9 * z);

    // Right cubby: DualSense twin charging dock with 2 wireless gamepads
    ctx.fillStyle = '#181d29';
    pxRect(ctx, cx + 4.2 * z, cy - 3.8 * z, 9.6 * z, 1.2 * z);
    ctx.fillStyle = '#f2f6ff';
    pxRect(ctx, cx + 4.6 * z, cy - 5.0 * z, 3.8 * z, 1.8 * z);
    ctx.fillStyle = '#283044';
    pxRect(ctx, cx + 9.4 * z, cy - 5.0 * z, 3.8 * z, 1.8 * z);
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, cx + 5.8 * z, cy - 4.8 * z, 1.4 * z, 0.8 * z);
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, cx + 10.6 * z, cy - 4.8 * z, 1.4 * z, 0.8 * z);

    // 3. Large Widescreen OLED Gaming TV + Pedestal & Soundbar
    ctx.fillStyle = '#252c3d';
    pxRect(ctx, cx - 2.2 * z, cy - 17.5 * z, 4.4 * z, 4.2 * z);
    // Matte-black Dolby soundbar centered on credenza
    drawBox(ctx, cx, cy - 11.2 * z, 10.5, 3.4, 2.2, '#1c212e', '#11141d', '#090b10', z);
    ctx.fillStyle = isOccupied ? '#3be87a' : '#00e5ff';
    pxRect(ctx, cx - 1.8 * z, cy - 12.6 * z, 1.6 * z, 0.9 * z);
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, cx + 0.4 * z, cy - 12.6 * z, 1.6 * z, 0.9 * z);

    // Ultra-thin OLED frame & vivid game screen
    ctx.fillStyle = '#0b0e16';
    pxRect(ctx, tvX, tvY, tvW, tvH);
    const scrX = tvX + 1.6 * z;
    const scrY = tvY + 1.6 * z;
    const scrW = tvW - 3.2 * z;
    const scrH = tvH - 3.2 * z;
    ctx.fillStyle = '#0e142b';
    pxRect(ctx, scrX, scrY, scrW, scrH);

    // Synthwave horizon band & perspective cyber-floor on screen
    ctx.fillStyle = '#2a164d';
    pxRect(ctx, scrX, scrY + scrH * 0.52, scrW, scrH * 0.2);
    ctx.fillStyle = '#e040fb';
    pxRect(ctx, scrX, scrY + scrH * 0.68, scrW, 1.1 * z);
    ctx.fillStyle = '#162247';
    pxRect(ctx, scrX, scrY + scrH * 0.72, scrW, scrH * 0.28);

    if (isOccupied) {
      // Live 2P cyber-fighter match: P1/P2 health bars + timer + animated fighters & energy blast
      ctx.fillStyle = '#00e5ff';
      pxRect(ctx, scrX + 2.5 * z, scrY + 2.2 * z, 15 * z, 2 * z);
      ctx.fillStyle = '#ffd147';
      pxRect(ctx, cx - 2 * z, scrY + 1.8 * z, 4 * z, 2.8 * z);
      ctx.fillStyle = '#ff4d8d';
      pxRect(ctx, scrX + scrW - 17.5 * z, scrY + 2.2 * z, 15 * z, 2 * z);

      const hop1 = Math.abs(Math.sin(timeSec * 8)) * 3.8 * z;
      const hop2 = Math.abs(Math.cos(timeSec * 7)) * 3.8 * z;
      // P1 fighter
      ctx.fillStyle = '#3be87a';
      pxRect(ctx, scrX + 8.5 * z, scrY + 12.5 * z - hop1, 5.2 * z, 6.2 * z);
      ctx.fillStyle = '#00e5ff';
      pxRect(ctx, scrX + 10.2 * z, scrY + 13.5 * z - hop1, 3.5 * z, 1.4 * z);
      // P2 fighter
      ctx.fillStyle = '#ffd147';
      pxRect(ctx, scrX + scrW - 13.7 * z, scrY + 12.5 * z - hop2, 5.2 * z, 6.2 * z);
      ctx.fillStyle = '#e040fb';
      pxRect(ctx, scrX + scrW - 13.7 * z, scrY + 13.5 * z - hop2, 3.2 * z, 1.4 * z);

      const projX = scrX + (15.5 + ((timeSec * 28) % 11)) * z;
      ctx.fillStyle = '#00e5ff';
      pxRect(ctx, projX, scrY + 12 * z, 3.6 * z, 2.8 * z);
      ctx.fillStyle = '#ffffff';
      pxRect(ctx, projX + 0.8 * z, scrY + 12.6 * z, 1.8 * z, 1.4 * z);
    } else {
      // Animated Retro 64-Pixel / PlayStation-Lounge 4-Symbol Emblem (△ ○ × □) & attract screen
      const bob = Math.sin(timeSec * 2.8) * 1.1 * z;
      // 1) Emerald Triangle (△)
      const triX = cx - 12.2 * z;
      const triY = scrY + 6.4 * z + bob;
      ctx.fillStyle = '#3be87a';
      pxRect(ctx, triX + 1.2 * z, triY, 1.2 * z, 1.0 * z);
      pxRect(ctx, triX + 0.5 * z, triY + 1.0 * z, 2.6 * z, 1.0 * z);
      pxRect(ctx, triX, triY + 2.0 * z, 3.6 * z, 1.0 * z);
      ctx.fillStyle = '#0e142b';
      pxRect(ctx, triX + 1.3 * z, triY + 1.3 * z, 1.0 * z, 0.8 * z);

      // 2) Coral Ring (○)
      const cirX = cx - 5.4 * z;
      const cirY = scrY + 5.6 * z - bob * 0.6;
      ctx.fillStyle = '#ff4d6d';
      pxRect(ctx, cirX + 0.6 * z, cirY, 2.4 * z, 3.6 * z);
      pxRect(ctx, cirX, cirY + 0.6 * z, 3.6 * z, 2.4 * z);
      ctx.fillStyle = '#0e142b';
      pxRect(ctx, cirX + 1.0 * z, cirY + 1.0 * z, 1.6 * z, 1.6 * z);

      // 3) Cyan Cross (×)
      const crsX = cx + 1.8 * z;
      const crsY = scrY + 5.6 * z + bob * 0.6;
      ctx.fillStyle = '#00e5ff';
      pxRect(ctx, crsX, crsY, 1.1 * z, 1.1 * z);
      pxRect(ctx, crsX + 2.3 * z, crsY, 1.1 * z, 1.1 * z);
      pxRect(ctx, crsX + 1.1 * z, crsY + 1.1 * z, 1.2 * z, 1.2 * z);
      pxRect(ctx, crsX, crsY + 2.3 * z, 1.1 * z, 1.1 * z);
      pxRect(ctx, crsX + 2.3 * z, crsY + 2.3 * z, 1.1 * z, 1.1 * z);

      // 4) Magenta Square (□)
      const sqX = cx + 8.6 * z;
      const sqY = scrY + 6.4 * z - bob;
      ctx.fillStyle = '#e040fb';
      pxRect(ctx, sqX, sqY, 3.5 * z, 3.5 * z);
      ctx.fillStyle = '#0e142b';
      pxRect(ctx, sqX + 1.0 * z, sqY + 1.0 * z, 1.5 * z, 1.5 * z);

      // Golden 64-bit title banner + pulsing "PRESS START" bar
      ctx.fillStyle = '#ffd147';
      pxRect(ctx, cx - 7.5 * z, scrY + 12.2 * z, 15 * z, 2.0 * z);
      ctx.fillStyle = pulse > 0.45 ? '#00e5ff' : '#9eb8ff';
      pxRect(ctx, cx - 4.5 * z, scrY + 18.0 * z, 9.0 * z, 1.4 * z);
    }

    // Crisp diagonal OLED glass reflection
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.26)';
    ctx.lineWidth = Math.max(0.9, 1.1 * z);
    ctx.beginPath();
    ctx.moveTo(scrX + 2 * z, scrY + 9 * z);
    ctx.lineTo(scrX + 9 * z, scrY + 2 * z);
    ctx.stroke();

    // 4. Left Corner of Credenza: Glowing 2.5D Golden '?' Question-Block Cube Lamp
    const qX = cx - 20.4 * z;
    const qY = cy - 17.6 * z;
    ctx.fillStyle = `rgba(255, 209, 71, ${(0.26 + pulse * 0.14).toFixed(3)})`;
    pxRect(ctx, qX - 2.2 * z, qY - 2.6 * z, 11.4 * z, 10.6 * z);
    // Lamp dark plinth base
    ctx.fillStyle = '#141824';
    pxRect(ctx, qX + 0.8 * z, qY + 6.4 * z, 5.6 * z, 1.2 * z);
    // 3D top gold bevel & shaded right cube face
    ctx.fillStyle = '#ffec99';
    ctx.beginPath();
    ctx.moveTo(qX, qY);
    ctx.lineTo(qX + 1.8 * z, qY - 1.5 * z);
    ctx.lineTo(qX + 8.2 * z, qY - 1.5 * z);
    ctx.lineTo(qX + 6.4 * z, qY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9780c';
    ctx.beginPath();
    ctx.moveTo(qX + 6.4 * z, qY);
    ctx.lineTo(qX + 8.2 * z, qY - 1.5 * z);
    ctx.lineTo(qX + 8.2 * z, qY + 4.9 * z);
    ctx.lineTo(qX + 6.4 * z, qY + 6.4 * z);
    ctx.closePath();
    ctx.fill();
    // Bright luminous golden front square
    ctx.fillStyle = '#ffc42e';
    pxRect(ctx, qX, qY, 6.4 * z, 6.4 * z);
    ctx.strokeStyle = '#6e3d04';
    ctx.lineWidth = Math.max(0.8, 0.9 * z);
    pxStrokeRect(ctx, qX, qY, 6.4 * z, 6.4 * z);
    // 4 corner rivets
    ctx.fillStyle = '#8f5106';
    pxRect(ctx, qX + 0.6 * z, qY + 0.6 * z, 0.8 * z, 0.8 * z);
    pxRect(ctx, qX + 5.0 * z, qY + 0.6 * z, 0.8 * z, 0.8 * z);
    pxRect(ctx, qX + 0.6 * z, qY + 5.0 * z, 0.8 * z, 0.8 * z);
    pxRect(ctx, qX + 5.0 * z, qY + 5.0 * z, 0.8 * z, 0.8 * z);
    // Crisp white '?' pixel glyph with amber drop shadow
    ctx.fillStyle = '#9e5a08';
    pxRect(ctx, qX + 2.1 * z, qY + 1.5 * z, 2.6 * z, 0.9 * z);
    pxRect(ctx, qX + 2.9 * z, qY + 4.7 * z, 1.0 * z, 0.9 * z);
    ctx.fillStyle = '#ffffff';
    pxRect(ctx, qX + 1.9 * z, qY + 1.2 * z, 2.6 * z, 0.9 * z);
    pxRect(ctx, qX + 3.6 * z, qY + 2.0 * z, 0.9 * z, 1.2 * z);
    pxRect(ctx, qX + 2.6 * z, qY + 2.9 * z, 1.6 * z, 0.9 * z);
    pxRect(ctx, qX + 2.7 * z, qY + 4.4 * z, 1.0 * z, 0.9 * z);

    // 5. Right Corner of Credenza: Sculpted Vertical White & Gloss-Black PS5 Console + Gamepad
    const psX = cx + 16.2 * z;
    const psY = cy - 11.0 * z;
    // Matte circular stand base
    ctx.fillStyle = '#10141f';
    pxRect(ctx, psX - 3.2 * z, psY - 1.2 * z, 6.4 * z, 1.4 * z);
    // Left flared pearl-white faceplate fin
    ctx.fillStyle = '#f4f7ff';
    pxRect(ctx, psX - 2.8 * z, psY - 11.6 * z, 1.7 * z, 10.6 * z);
    // Gloss-black curved center core
    ctx.fillStyle = '#0a0c12';
    pxRect(ctx, psX - 1.1 * z, psY - 10.8 * z, 2.2 * z, 9.8 * z);
    // Right shaded pearl-white faceplate fin
    ctx.fillStyle = '#cfd9ed';
    pxRect(ctx, psX + 1.1 * z, psY - 11.4 * z, 1.7 * z, 10.4 * z);
    // Glowing Cyan-Blue PS5 inner power LED strip
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, psX - 1.1 * z, psY - 10.4 * z, 0.7 * z, 6.2 * z);
    pxRect(ctx, psX + 0.4 * z, psY - 10.4 * z, 0.7 * z, 6.2 * z);

    // Companion white DualSense controller resting beside PS5
    ctx.fillStyle = '#f2f6ff';
    pxRect(ctx, psX - 7.2 * z, psY - 2.4 * z, 3.6 * z, 1.9 * z);
    ctx.fillStyle = '#181e2c';
    pxRect(ctx, psX - 6.3 * z, psY - 1.7 * z, 1.8 * z, 1.1 * z);
    ctx.fillStyle = '#00e5ff';
    pxRect(ctx, psX - 6.0 * z, psY - 2.2 * z, 1.2 * z, 0.7 * z);
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
