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
  | 'clover_desk'
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
  | 'sofa_m'
  | 'sofa_r'
  | 'armchair'
  | 'coffee_table'
  | 'exec_coffee_table'
  | 'lounge_table'
  | 'gaming_table'
  | 'war_table'
  | 'war_table_oval'
  | 'war_table_round'
  | 'war_table_rect'
  | 'war_table_u'
  | 'war_table_s'
  | 'war_table_part'
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
  | 'lounge_lamp'
  | 'floor_lamp'
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

function resolveFrontDisplayFacing(
  facing: ChairFacing | undefined,
  fallbackFront: 'SW' | 'SE' = 'SW',
): 'SW' | 'SE' {
  if (!facing) return fallbackFront;
  const up = String(facing).toUpperCase();
  if (up === 'SE' || up === 'E' || up === 'S') return 'SE';
  if (up === 'SW' || up === 'W' || up === 'NW') return 'SW';
  return fallbackFront;
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
  facing?: ChairFacing,
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
    const dir = resolveFrontDisplayFacing(facing, 'SW');
    const iso = createCardIsoPainter(ctx, cx, cy, z, dir);
    const sideSign = dir === 'SW' ? -1 : 1;

    // Soft floor contact shadow + leveling rubber feet
    iso.fillPoly(iso.boxPts(-7.6, 8.2, -10.2, 10.2), 0, 'rgba(7, 10, 20, 0.30)');
    for (const [lf, lr] of [
      [-5.8, -8.2],
      [-5.8, 8.2],
      [5.8, -8.2],
      [5.8, 8.2],
    ] as const) {
      const pf = iso.pt(lf, lr, 0);
      ctx.fillStyle = '#0e131f';
      pxRect(ctx, pf.x - 1.2 * z, pf.y - 1.4 * z, 2.4 * z, 1.4 * z);
    }

    if (night) {
      iso.fillPoly(iso.boxPts(6.6, 13.4, -9.2, 9.2), 0.05, 'rgba(92, 226, 255, 0.14)');
    }

    // Main brushed-graphite & anodized-slate refrigerated vending chassis
    iso.drawSlab(iso.boxPts(-6.8, 6.8, -9.6, 9.6), 1.0, 35.6, {
      top: '#3b4a6b',
      sideLit: '#2c3854',
      sideMid: '#212b42',
      sideDark: '#151c2d',
      rim: 'rgba(196, 220, 255, 0.22)',
      outline: '#0b101c',
    });

    // Side sheet-metal compressor louvers on the camera-visible lateral wall
    const rSide = sideSign * 9.66;
    for (let lv = 0; lv < 4; lv++) {
      const lh = 4.2 + lv * 2.0;
      iso.fillVertQuad(-4.6, rSide, 3.8, rSide, lh, lh + 0.9, '#101624');
    }

    const fFront = 6.88;

    // 1. Top backlit coral-amber & cyan "COLD DRINKS • SNACKS" LED marquee (2:1 isometric front quad)
    iso.fillVertQuad(fFront, -8.6, fFront, 8.6, 30.8, 34.4, '#101726', '#090d16', 0.7);
    iso.fillVertQuad(fFront + 0.04, -8.0, fFront + 0.04, 3.0, 31.4, 33.8, '#ff6b4a');
    iso.fillVertQuad(fFront + 0.08, -7.2, fFront + 0.08, -2.4, 32.0, 33.2, '#ffe380');
    iso.fillVertQuad(fFront + 0.08, -1.4, fFront + 0.08, 2.2, 32.0, 33.2, '#fff7e6');
    iso.fillVertQuad(fFront + 0.04, 3.6, fFront + 0.04, 8.0, 31.4, 33.8, '#00b4d8');
    iso.fillVertQuad(fFront + 0.08, 4.4, fFront + 0.08, 7.2, 32.1, 33.1, '#d6f8ff');

    // 2. Left refrigerated tempered-glass showcase window (4 illuminated shelves of cans & snacks)
    iso.fillVertQuad(fFront, -8.6, fFront, 3.4, 9.2, 29.8, '#0d1726', '#5ec8f8', 0.85);
    iso.fillVertQuad(
      fFront + 0.04,
      -8.0,
      fFront + 0.04,
      2.8,
      9.8,
      29.2,
      night ? '#284f78' : '#214266',
    );
    iso.fillVertQuad(fFront + 0.07, -7.6, fFront + 0.07, 2.4, 28.4, 29.1, '#e6fbff');

    const shelfHeights = [10.2, 14.8, 19.4, 24.0];
    const drinkAndSnackRows: ReadonlyArray<ReadonlyArray<string>> = [
      ['#e63946', '#00e5ff', '#3be87a', '#ff9f1c'],
      ['#00b4d8', '#ff4d6d', '#ffd166', '#9b5de5'],
      ['#ffbe3b', '#3be87a', '#ff5666', '#4cc9f0'],
      ['#f77f00', '#e040fb', '#ffd147', '#06d6a0'],
    ];

    for (let sIdx = 0; sIdx < shelfHeights.length; sIdx++) {
      const sh = shelfHeights[sIdx];
      const isCanRow = sIdx < 2;
      const rowCols = drinkAndSnackRows[sIdx];
      for (let c = 0; c < 4; c++) {
        const r0 = -7.4 + c * 2.55;
        const r1 = r0 + 1.85;
        const itemTop = sh + (isCanRow ? 3.3 : 3.0);
        iso.fillVertQuad(fFront + 0.09, r0, fFront + 0.09, r1, sh + 0.55, itemTop, rowCols[c]);
        if (isCanRow) {
          iso.fillVertQuad(fFront + 0.12, r0 + 0.15, fFront + 0.12, r1 - 0.15, itemTop - 0.55, itemTop, '#e8f1ff');
          const pLabel = iso.pt(fFront + 0.14, (r0 + r1) * 0.5, sh + 1.9);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
          pxRect(ctx, pLabel.x - 0.45 * z, pLabel.y - 0.8 * z, 0.9 * z, 1.4 * z);
        } else {
          iso.fillVertQuad(fFront + 0.12, r0, fFront + 0.12, r1, itemTop - 0.45, itemTop, '#fff3cf');
        }
      }
      iso.fillVertQuad(fFront + 0.14, -7.8, fFront + 0.14, 2.6, sh, sh + 0.58, '#8fa3c4');
    }

    // Tempered glass cyan tint + crisp diagonal specular reflection streaks
    iso.fillVertQuad(fFront + 0.16, -8.0, fFront + 0.16, 2.8, 9.8, 29.2, 'rgba(165, 236, 255, 0.14)');
    const gA1 = iso.pt(fFront + 0.18, -6.4, 11.2);
    const gB1 = iso.pt(fFront + 0.18, -1.2, 27.6);
    const gA2 = iso.pt(fFront + 0.18, -3.4, 11.2);
    const gB2 = iso.pt(fFront + 0.18, 1.4, 26.2);
    ctx.strokeStyle = 'rgba(232, 251, 255, 0.62)';
    ctx.lineWidth = Math.max(1, 1.05 * z);
    ctx.beginPath();
    ctx.moveTo(gA1.x, gA1.y);
    ctx.lineTo(gB1.x, gB1.y);
    ctx.moveTo(gA2.x, gA2.y);
    ctx.lineTo(gB2.x, gB2.y);
    ctx.stroke();

    // 3. Right smart touchscreen, selection keypad & contactless NFC tap-to-pay panel
    iso.fillVertQuad(fFront, 4.1, fFront, 8.6, 9.2, 29.8, '#0e1422', '#26334d', 0.75);
    iso.fillVertQuad(
      fFront + 0.06,
      4.7,
      fFront + 0.06,
      8.0,
      23.6,
      28.6,
      isOccupied ? '#5cf0ff' : '#28bce8',
    );
    iso.fillVertQuad(fFront + 0.1, 5.0, fFront + 0.1, 7.6, 26.8, 28.0, '#e8fbff');
    for (let kr = 0; kr < 3; kr++) {
      for (let kc = 0; kc < 2; kc++) {
        const pKey = iso.pt(fFront + 0.1, 5.2 + kc * 1.9, 21.8 - kr * 1.8);
        ctx.fillStyle = kr === 0 && kc === 0 && isOccupied ? '#3be87a' : '#9eb4d6';
        pxRect(ctx, pKey.x - 0.55 * z, pKey.y - 0.55 * z, 1.1 * z, 1.1 * z);
      }
    }
    iso.fillVertQuad(fFront + 0.08, 4.8, fFront + 0.08, 7.9, 13.0, 16.4, '#ffd147');
    const pNfcLed = iso.pt(fFront + 0.12, 6.35, 14.8);
    ctx.fillStyle = isOccupied ? '#3be87a' : '#00b4d8';
    pxRect(ctx, pNfcLed.x - 0.8 * z, pNfcLed.y - 0.8 * z, 1.6 * z, 1.6 * z);

    // 4. Deep recessed bottom push-flap drink pickup bin
    iso.fillVertQuad(fFront, -8.4, fFront, 3.4, 2.4, 7.8, '#080c14', '#2a3752', 0.75);
    iso.fillVertQuad(fFront + 0.06, -7.8, fFront + 0.06, 2.8, 5.8, 7.3, '#7b8eab');
    if (isOccupied) {
      const pCan = iso.pt(fFront + 0.12, -2.4, 3.9);
      ctx.fillStyle = '#e63946';
      pxRect(ctx, pCan.x - 1.4 * z, pCan.y - 1.1 * z, 2.8 * z, 2.1 * z);
      ctx.fillStyle = '#edf4ff';
      pxRect(ctx, pCan.x + 0.8 * z, pCan.y - 1.0 * z, 0.7 * z, 1.9 * z);
    }
    return true;
  }

  if (kind === 'arcade_cabinet' || kind === 'arcade') {
    const dir = resolveFrontDisplayFacing(facing, 'SW');
    const iso = createCardIsoPainter(ctx, cx, cy, z, dir);
    const rightGoesFront = dir === 'SE';
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.5);

    // 1. Ground shadow + dual Magenta/Cyan neon floor wash
    iso.fillPoly(iso.boxPts(-8.2, 10.6, -9.4, 9.4), 0, 'rgba(7, 10, 20, 0.32)');
    if (night || isOccupied) {
      iso.fillPoly(
        iso.boxPts(5.2, 13.0, -9.6, 9.6),
        0.04,
        `rgba(0, 229, 255, ${((night ? 0.18 : 0.10) + pulse * 0.06).toFixed(3)})`,
      );
      iso.fillPoly(
        iso.boxPts(-8.8, 4.0, -10.4, 10.4),
        0.03,
        `rgba(224, 64, 251, ${((night ? 0.15 : 0.08) + pulse * 0.05).toFixed(3)})`,
      );
    }

    const cabBasePal: IsoSlabPalette = {
      top: '#2f2259',
      sideLit: '#251a47',
      sideMid: '#1b1236',
      sideDark: '#120b24',
      rim: 'rgba(186, 148, 255, 0.20)',
      outline: '#090614',
    };
    const cabWingPal: IsoSlabPalette = {
      top: '#3f2c75',
      sideLit: '#32225e',
      sideMid: '#241845',
      sideDark: '#170f2e',
      rim: 'rgba(224, 64, 251, 0.28)',
      outline: '#090614',
    };

    // 2. Solid Lower Cabinet Pedestal (h = 0..14.6) + Welded Console Support Apron (h = 10.6..14.6 — ZERO floating panel!)
    iso.drawSlab(iso.boxPts(-7.6, 6.0, -8.4, 8.4), 0, 14.6, cabBasePal);
    iso.drawSlab(iso.boxPts(2.4, 9.4, -8.2, 8.2), 10.6, 14.6, {
      top: '#261b4a',
      sideLit: '#1f153d',
      sideMid: '#170f2e',
      sideDark: '#0f0921',
      outline: '#090614',
    });

    // Illuminated dual coin-op service door on lower front pedestal face
    iso.fillVertQuad(6.08, -4.4, 6.08, 4.4, 2.0, 10.2, '#0d111f', '#252f4a', 0.75);
    const pCoin1 = iso.pt(6.14, -1.8, 7.2);
    const pCoin2 = iso.pt(6.14, 1.8, 7.2);
    ctx.fillStyle = '#ff9238';
    pxRect(ctx, pCoin1.x - 0.9 * z, pCoin1.y - 1.2 * z, 1.8 * z, 2.2 * z);
    pxRect(ctx, pCoin2.x - 0.9 * z, pCoin2.y - 1.2 * z, 1.8 * z, 2.2 * z);
    ctx.fillStyle = '#ffe28a';
    pxRect(ctx, pCoin1.x - 0.5 * z, pCoin1.y - 0.8 * z, 1.0 * z, 1.0 * z);
    pxRect(ctx, pCoin2.x - 0.5 * z, pCoin2.y - 0.8 * z, 1.0 * z, 1.0 * z);

    // Isometric side-art space decal on the camera-visible lower flank
    const visSideR = (rightGoesFront ? 1 : -1) * 8.48;
    iso.fillVertQuad(-5.2, visSideR, 3.8, visSideR, 3.0, 12.6, '#141936', '#00e5ff', 0.7);
    iso.fillVertQuad(-3.6, visSideR, 2.2, visSideR, 7.6, 9.8, '#e040fb');
    iso.fillVertQuad(-2.2, visSideR, 1.0, visSideR, 5.0, 6.6, '#ffd147');

    // 3. Upper CRT Housing + Sculpted Side Cheeks + Recessed Angled CRT Screen (h = 17.2..31.4)
    const drawSideWing = (r0: number, r1: number, neonCol: string) => {
      iso.drawSlab(iso.boxPts(-7.6, 6.4, r0, r1), 17.2, 31.4, cabWingPal);
      iso.fillVertQuad(6.46, r0 + 0.15, 6.46, r1 - 0.15, 17.4, 31.2, neonCol);
    };
    const farWing: [number, number, string] = rightGoesFront
      ? [-8.6, -7.0, '#e040fb']
      : [7.0, 8.6, '#00e5ff'];
    const nearWing: [number, number, string] = rightGoesFront
      ? [7.0, 8.6, '#00e5ff']
      : [-8.6, -7.0, '#e040fb'];

    drawSideWing(farWing[0], farWing[1], farWing[2]);

    iso.drawSlab(iso.boxPts(-7.6, 3.8, -7.0, 7.0), 17.2, 31.0, {
      top: '#1f163d',
      sideLit: '#16102e',
      sideMid: '#100b22',
      sideDark: '#0a0717',
      outline: '#070510',
    });
    const fScreen = 3.88;
    iso.fillVertQuad(fScreen, -6.5, fScreen, 6.5, 18.4, 29.8, '#090d1a', '#263457', 0.8);
    iso.fillVertQuad(
      fScreen + 0.05,
      -5.8,
      fScreen + 0.05,
      5.8,
      19.2,
      29.0,
      pulse > 0.5 ? '#152f5e' : '#10244a',
    );
    const shipR = Math.sin(timeSec * 4.2) * 3.4;
    const laserH = 21.8 + ((timeSec * 11) % 5.2);
    iso.fillVertQuad(fScreen + 0.1, -2.2, fScreen + 0.1, 2.2, 26.2, 28.0, '#e040fb');
    iso.fillVertQuad(fScreen + 0.1, shipR - 1.3, fScreen + 0.1, shipR + 1.3, 20.0, 21.5, '#00e5ff');
    const pLaser = iso.pt(fScreen + 0.12, shipR, laserH);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, pLaser.x - 0.7 * z, pLaser.y - 1.2 * z, 1.4 * z, 2.2 * z);
    const pGlint = iso.pt(fScreen + 0.12, -4.2, 27.6);
    ctx.fillStyle = 'rgba(220, 248, 255, 0.55)';
    pxRect(ctx, pGlint.x - 1.4 * z, pGlint.y - 0.6 * z, 2.8 * z, 1.1 * z);

    // 4. Unified Integrated Control Deck (h = 14.6..17.2) resting solidly on pedestal + apron!
    iso.drawSlab(iso.boxPts(-7.6, 9.8, -8.6, 8.6), 14.6, 17.2, {
      top: '#243156',
      sideLit: '#1b2542',
      sideMid: '#141c33',
      sideDark: '#0d1224',
      rim: 'rgba(0, 229, 255, 0.34)',
      outline: '#080b17',
    });
    iso.fillVertQuad(9.86, -8.3, 9.86, 8.3, 15.6, 16.5, '#00e5ff');
    iso.fillPoly(iso.boxPts(4.0, 9.1, -7.4, 7.4), 17.26, '#13192e', '#384973', 0.7);

    // 1P (Red) & 2P (Cyan) ball-top joysticks + 6 RGB arcade microswitch buttons
    const joyTilt = isOccupied ? Math.sin(timeSec * 14) * 0.9 : 0;
    for (const [rJoy, ballCol, tiltMul] of [
      [-4.2, '#ff3b6b', 1],
      [1.8, '#00e5ff', -0.7],
    ] as const) {
      const pBase = iso.pt(6.6, rJoy, 17.3);
      const pBall = iso.pt(6.6 + joyTilt * 0.4 * tiltMul, rJoy + joyTilt * tiltMul, 19.6);
      ctx.fillStyle = '#0a0d17';
      pxRect(ctx, pBase.x - 1.4 * z, pBase.y - 0.7 * z, 2.8 * z, 1.4 * z);
      ctx.strokeStyle = '#dce6fa';
      ctx.lineWidth = Math.max(1, 1.25 * z);
      ctx.beginPath();
      ctx.moveTo(pBase.x, pBase.y - 0.2 * z);
      ctx.lineTo(pBall.x, pBall.y + 0.5 * z);
      ctx.stroke();
      ctx.fillStyle = ballCol;
      pxRect(ctx, pBall.x - 1.35 * z, pBall.y - 1.35 * z, 2.7 * z, 2.5 * z);
    }
    const btnSpecs: ReadonlyArray<[number, number, string]> = [
      [6.1, -1.6, '#ffd147'],
      [7.3, -1.6, '#00e5ff'],
      [6.7, -0.3, '#3be87a'],
      [6.1, 4.4, '#e040fb'],
      [7.3, 4.4, '#ffd147'],
      [6.7, 5.7, '#ff5666'],
    ];
    for (let bi = 0; bi < btnSpecs.length; bi++) {
      const [bf, br, bCol] = btnSpecs[bi];
      const press = isOccupied && ((Math.floor(timeSec * 12) + bi) % 3 === 0) ? -0.35 : 0;
      const pb = iso.pt(bf, br, 17.55 + press);
      ctx.fillStyle = bCol;
      pxRect(ctx, pb.x - 0.9 * z, pb.y - 0.65 * z, 1.8 * z, 1.3 * z);
    }

    drawSideWing(nearWing[0], nearWing[1], nearWing[2]);

    // 5. Overhanging Backlit Retro Marquee Canopy (h = 30.8..36.4)
    iso.drawSlab(iso.boxPts(-7.6, 8.0, -8.6, 8.6), 30.8, 36.4, cabWingPal);
    iso.fillVertQuad(8.08, -8.0, 8.08, 8.0, 31.3, 35.9, '#140b29', '#00e5ff', 0.75);
    iso.fillVertQuad(8.12, -7.3, 8.12, 7.3, 31.8, 35.4, '#e040fb');
    iso.fillVertQuad(8.16, -6.2, 8.16, 6.2, 32.3, 34.9, '#ffd147');
    iso.fillVertQuad(8.2, -3.8, 8.2, 3.8, 32.8, 34.4, '#fffef0');
    return true;
  }

  if (kind === 'library_table') {
    const dir = resolveFrontDisplayFacing(facing, 'SE');
    const iso = createCardIsoPainter(ctx, cx, cy, z, dir);

    iso.fillPoly(iso.boxPts(-8.8, 8.8, -12.2, 12.2), 0, 'rgba(7, 10, 20, 0.28)');
    iso.drawSlab(iso.boxPts(-5.2, 5.2, -7.8, 7.8), 0, 6.2, {
      top: '#6e4527',
      sideLit: '#5c381e',
      sideMid: '#472a15',
      sideDark: '#331d0d',
      outline: '#1a0d05',
    });
    iso.drawSlab(iso.boxPts(-7.8, 7.8, -11.4, 11.4), 6.2, 9.8, {
      top: '#b37746',
      sideLit: '#8f5c33',
      sideMid: '#704625',
      sideDark: '#523118',
      rim: 'rgba(255, 228, 196, 0.26)',
      outline: '#211107',
    });

    // Stacked colorful hardcover volumes on left side of reading table
    iso.drawSlab(iso.boxPts(-4.4, 1.8, -9.8, -4.4), 9.8, 11.5, {
      top: '#2e5ea6',
      sideLit: '#f5efe0',
      sideMid: '#234982',
      sideDark: '#17325c',
      outline: '#0d1b33',
    });
    iso.drawSlab(iso.boxPts(-3.8, 1.4, -9.2, -4.6), 11.5, 13.1, {
      top: '#c93b4b',
      sideLit: '#f7f2e4',
      sideMid: '#9e2b38',
      sideDark: '#731d27',
      outline: '#2b090e',
    });

    // Open hardcover book with cream pages in center
    iso.drawSlab(iso.boxPts(-1.8, 4.6, -2.8, 3.6), 9.8, 10.9, {
      top: '#247d58',
      sideLit: '#1c6345',
      sideMid: '#154d35',
      sideDark: '#0e3625',
      outline: '#081f15',
    });
    iso.fillPoly(iso.boxPts(-1.3, 4.1, -2.4, 0.3), 11.05, '#fffdf2', '#cbbda2', 0.65);
    iso.fillPoly(iso.boxPts(-1.3, 4.1, 0.5, 3.2), 11.05, '#f5ecd7', '#cbbda2', 0.65);

    // Classic brass & emerald green library banker's lamp
    if (night) {
      iso.fillPoly(iso.boxPts(-3.6, 5.8, 2.2, 10.4), 9.9, 'rgba(255, 220, 122, 0.28)');
    }
    const pLamp = iso.pt(-2.6, 7.2, 9.9);
    ctx.fillStyle = '#d9ab42';
    pxRect(ctx, pLamp.x - 2.0 * z, pLamp.y - 1.4 * z, 4.0 * z, 1.4 * z);
    ctx.fillStyle = '#9e781e';
    pxRect(ctx, pLamp.x - 0.8 * z, pLamp.y - 7.8 * z, 1.6 * z, 6.5 * z);
    if (night) {
      ctx.fillStyle = '#fff5b8';
      pxRect(ctx, pLamp.x - 2.6 * z, pLamp.y - 8.2 * z, 5.2 * z, 1.3 * z);
    }
    ctx.fillStyle = '#1b9e56';
    pxRect(ctx, pLamp.x - 3.4 * z, pLamp.y - 10.8 * z, 6.8 * z, 2.8 * z);
    ctx.fillStyle = night ? '#57eba1' : '#35bd73';
    pxRect(ctx, pLamp.x - 2.4 * z, pLamp.y - 10.2 * z, 4.8 * z, 1.2 * z);
    return true;
  }

  if (kind === '3d_printer') {
    const dir = resolveFrontDisplayFacing(facing, 'SW');
    const iso = createCardIsoPainter(ctx, cx, cy, z, dir);
    const rightGoesFront = dir === 'SE';

    // 1. Floor shadow + CNC gunmetal-aluminum lower electronics base (h = 0..11.2)
    iso.fillPoly(iso.boxPts(-8.4, 8.6, -8.8, 8.8), 0, 'rgba(7, 10, 20, 0.30)');
    iso.drawSlab(iso.boxPts(-7.4, 7.4, -8.2, 8.2), 0, 11.2, {
      top: '#3c4863',
      sideLit: '#2d374d',
      sideMid: '#21293b',
      sideDark: '#151b28',
      rim: 'rgba(196, 216, 248, 0.22)',
      outline: '#0b0f1a',
    });

    const fBase = 7.48;
    iso.fillVertQuad(fBase, -6.4, fBase, 2.2, 3.0, 8.8, '#0d1321', '#4a5c80', 0.75);
    iso.fillVertQuad(fBase + 0.05, -5.8, fBase + 0.05, 1.6, 3.8, 8.1, '#162c4a');
    iso.fillVertQuad(fBase + 0.09, -5.2, fBase + 0.09, -0.6, 4.4, 5.3, '#3be87a');
    const pTemp = iso.pt(fBase + 0.12, 0.4, 6.8);
    ctx.fillStyle = '#ff853d';
    pxRect(ctx, pTemp.x - 0.8 * z, pTemp.y - 0.8 * z, 1.6 * z, 1.4 * z);
    const pStatus = iso.pt(fBase + 0.12, 5.2, 6.0);
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, pStatus.x - 1.1 * z, pStatus.y - 0.7 * z, 2.2 * z, 1.4 * z);

    // 2. Enclosed CoreXY Chamber Rear Backplate & Heated PEI Plate (h = 11.2..29.0)
    iso.drawSlab(iso.boxPts(-7.2, -5.8, -8.0, 8.0), 11.2, 29.0, {
      top: '#283247',
      sideLit: '#1e2638',
      sideMid: '#161c2b',
      sideDark: '#101420',
      outline: '#090d16',
    });

    iso.drawSlab(iso.boxPts(-4.8, 4.8, -5.8, 5.8), 12.6, 13.9, {
      top: '#d49b35',
      sideLit: '#ad7b22',
      sideMid: '#875e16',
      sideDark: '#61420d',
      outline: '#2b1c04',
    });

    iso.drawSlab(iso.boxPts(-2.4, 2.4, -2.6, 2.6), 13.9, 20.2, {
      top: '#9ef9ff',
      sideLit: '#3cd8ff',
      sideMid: '#1ca3cc',
      sideDark: '#126e8f',
      outline: '#083b4f',
    });

    // Animated CoreXY carbon-rod X/Y gantry + direct-drive toolhead + hotend nozzle glow
    const headR = Math.sin(timeSec * 4.4) * 3.0;
    const headF = Math.cos(timeSec * 2.9) * 1.8;
    const gantryA = iso.pt(headF, -6.8, 23.6);
    const gantryB = iso.pt(headF, 6.8, 23.6);
    ctx.strokeStyle = '#92a4c4';
    ctx.lineWidth = Math.max(1.1, 1.5 * z);
    ctx.beginPath();
    ctx.moveTo(gantryA.x, gantryA.y);
    ctx.lineTo(gantryB.x, gantryB.y);
    ctx.stroke();

    iso.drawSlab(iso.boxPts(headF - 1.5, headF + 1.5, headR - 1.6, headR + 1.6), 21.4, 25.8, {
      top: '#2b354d',
      sideLit: '#ff7b3b',
      sideMid: '#1e2638',
      sideDark: '#121724',
      outline: '#080b12',
    });
    const pNozzle = iso.pt(headF + 0.4, headR, 20.8);
    ctx.fillStyle = Math.sin(timeSec * 14) > 0 ? '#ffd147' : '#5cf0ff';
    pxRect(ctx, pNozzle.x - 0.95 * z, pNozzle.y - 0.95 * z, 1.9 * z, 1.9 * z);

    // Corner anodized-silver CoreXY frame extrusions
    const pillarPal: IsoSlabPalette = {
      top: '#90a2c2',
      sideLit: '#798ba8',
      sideMid: '#5c6c87',
      sideDark: '#3f4c63',
      outline: '#121826',
    };
    const pillarCorners: Array<[number, number]> = [
      [-7.2, rightGoesFront ? -8.0 : 6.6],
      [5.8, rightGoesFront ? -8.0 : 6.6],
      [-7.2, rightGoesFront ? 6.6 : -8.0],
      [5.8, rightGoesFront ? 6.6 : -8.0],
    ];
    for (const [pf0, pr0] of pillarCorners) {
      iso.drawSlab(iso.boxPts(pf0, pf0 + 1.4, pr0, pr0 + 1.4), 11.2, 29.0, pillarPal);
    }

    // Translucent smoked-acrylic front chamber door + handle + side glass window
    const visR = (rightGoesFront ? 1 : -1) * 8.04;
    iso.fillVertQuad(-5.6, visR, 5.6, visR, 12.2, 28.4, 'rgba(130, 216, 255, 0.16)', '#4b5d7d', 0.7);
    const fDoor = 7.26;
    iso.fillVertQuad(
      fDoor,
      -6.6,
      fDoor,
      6.6,
      11.8,
      28.6,
      night ? 'rgba(116, 220, 255, 0.22)' : 'rgba(156, 232, 255, 0.20)',
      '#586b8f',
      0.85,
    );
    const pHandle = iso.pt(fDoor + 0.08, 4.8, 20.2);
    ctx.fillStyle = '#121826';
    pxRect(ctx, pHandle.x - 0.7 * z, pHandle.y - 2.6 * z, 1.4 * z, 5.2 * z);
    const dRefA = iso.pt(fDoor + 0.06, -4.4, 13.6);
    const dRefB = iso.pt(fDoor + 0.06, 1.8, 27.0);
    ctx.strokeStyle = 'rgba(235, 252, 255, 0.58)';
    ctx.lineWidth = Math.max(1, z);
    ctx.beginPath();
    ctx.moveTo(dRefA.x, dRefA.y);
    ctx.lineTo(dRefB.x, dRefB.y);
    ctx.stroke();

    // Upper CoreXY belt gantry crown
    iso.drawSlab(iso.boxPts(-7.4, 7.4, -8.2, 8.2), 29.0, 31.2, {
      top: '#526280',
      sideLit: '#3e4c66',
      sideMid: '#2e394f',
      sideDark: '#1d2536',
      outline: '#0b0f1a',
    });

    // 3. Top-mounted rotary PLA filament spool + PTFE Bowden feed tube (h = 31.4..37.0)
    iso.drawSlab(iso.boxPts(-3.6, 3.6, -1.7, -1.0), 31.4, 37.0, {
      top: '#232b3d',
      sideLit: '#1a2030',
      sideMid: '#131824',
      sideDark: '#0c0f17',
      outline: '#07090f',
    });
    iso.drawSlab(iso.boxPts(-3.1, 3.1, -1.0, 1.0), 31.9, 36.5, {
      top: '#ffa45c',
      sideLit: '#ff7b29',
      sideMid: '#d95d14',
      sideDark: '#9e3f08',
      outline: '#361402',
    });
    iso.drawSlab(iso.boxPts(-3.6, 3.6, 1.0, 1.7), 31.4, 37.0, {
      top: '#232b3d',
      sideLit: '#1a2030',
      sideMid: '#131824',
      sideDark: '#0c0f17',
      outline: '#07090f',
    });
    const pHub = iso.pt(0, 1.85, 34.2);
    ctx.fillStyle = '#92a4c4';
    pxRect(ctx, pHub.x - 0.9 * z, pHub.y - 0.9 * z, 1.8 * z, 1.8 * z);
    const pTubeStart = iso.pt(2.2, 0.2, 36.2);
    const pTubeEnd = iso.pt(headF, headR, 30.8);
    ctx.strokeStyle = 'rgba(240, 248, 255, 0.85)';
    ctx.lineWidth = Math.max(1, 1.15 * z);
    ctx.beginPath();
    ctx.moveTo(pTubeStart.x, pTubeStart.y);
    ctx.lineTo((pTubeStart.x + pTubeEnd.x) * 0.5, Math.min(pTubeStart.y, pTubeEnd.y) - 3.2 * z);
    ctx.lineTo(pTubeEnd.x, pTubeEnd.y);
    ctx.stroke();
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
  facing?: ChairFacing,
): boolean {
  return drawCustomOrPartitionProp(ctx, kind, cx, cy, zoom, timeSec, isOccupied, false, facing);
}

export type ChairFacing =
  | Facing
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'nw';
export type ChairVariant = 'task' | 'meeting' | 'exec' | 'gaming';

function normalizeChairFacing(facing: ChairFacing = 'SE'): Facing {
  const up = String(facing || 'SE').toUpperCase();
  if (
    up === 'N' ||
    up === 'NE' ||
    up === 'E' ||
    up === 'SE' ||
    up === 'S' ||
    up === 'SW' ||
    up === 'W' ||
    up === 'NW'
  ) {
    return up;
  }
  return 'SE';
}

function getChairIsoBasis(dir: Facing): {
  fwd: { x: number; y: number };
  lat: { x: number; y: number };
} {
  // Exact 2:1 isometric circle basis (|fwd|_iso = |lat|_iso = sqrt(2)) across all 8 facings.
  // Note: lat.y >= 0 so l < 0 is the far/left flank and l > 0 is the near/right flank.
  switch (dir) {
    case 'S':
      return { fwd: { x: 0, y: 0.7071 }, lat: { x: 1.4142, y: 0 } };
    case 'SE':
      return { fwd: { x: 1.0, y: 0.5 }, lat: { x: -1.0, y: 0.5 } };
    case 'E':
      return { fwd: { x: 1.4142, y: 0 }, lat: { x: 0, y: 0.7071 } };
    case 'NE':
      return { fwd: { x: 1.0, y: -0.5 }, lat: { x: 1.0, y: 0.5 } };
    case 'N':
      return { fwd: { x: 0, y: -0.7071 }, lat: { x: 1.4142, y: 0 } };
    case 'NW':
      return { fwd: { x: -1.0, y: -0.5 }, lat: { x: -1.0, y: 0.5 } };
    case 'W':
      return { fwd: { x: -1.4142, y: 0 }, lat: { x: 0, y: 0.7071 } };
    case 'SW':
      return { fwd: { x: -1.0, y: 0.5 }, lat: { x: 1.0, y: 0.5 } };
  }
}

function renderErgonomicChairPass(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  variant: ChairVariant,
  facing: ChairFacing,
  accentColor: string,
  foregroundOnly: boolean,
): void {
  const z = zoom;
  const dir = normalizeChairFacing(facing);
  const { fwd, lat } = getChairIsoBasis(dir);

  const isFacingFront = fwd.y > 0.05; // S, SE, SW
  const isSideFacing = Math.abs(fwd.y) <= 0.05; // E, W
  const isFacingRear = fwd.y < -0.05; // N, NE, NW

  if (foregroundOnly && isFacingFront) {
    return;
  }

  ctx.save();

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

  // Draws an oriented isometric 3D slab [f0..f1] x [l0..l1] x [h0..h1] across all 8 directions
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
    // 1. Visible front/rear face when fwd has a camera-facing/away component (S, SE, SW, N, NE, NW)
    if (Math.abs(fwd.y) > 0.05) {
      const fVis = fwd.y > 0 ? f1 : f0;
      drawQuad(
        pt(fVis, l0, h0),
        pt(fVis, l1, h0),
        pt(fVis, l1, h1),
        pt(fVis, l0, h1),
        fFaceCol,
        outline,
        0.8,
      );
    }
    // 2. Visible near lateral edge face when lat has a camera-facing component (SE, SW, NE, NW, E, W)
    if (lat.y > 0.05) {
      drawQuad(
        pt(f0, l1, h0),
        pt(f1, l1, h0),
        pt(f1, l1, h1),
        pt(f0, l1, h1),
        lFaceCol,
        outline,
        0.8,
      );
    }
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

  if (!foregroundOnly) {
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
  }

  // Helper: Slim L/T-shaped Armrest for side = -1 (far/left) or +1 (near/right)
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

      if (!isSideFacing) {
        // Horizontal ergonomic Y-lumbar support bridge across rear frame
        const lumL = pt(-5.4, -3.8, 12.0);
        const lumR = pt(-5.4, 3.8, 12.0);
        ctx.strokeStyle = '#4a5c7d';
        ctx.lineWidth = Math.max(0.95, 1.25 * z);
        ctx.beginPath();
        ctx.moveTo(lumL.x, lumL.y);
        ctx.lineTo(lumR.x, lumR.y);
        ctx.stroke();
      }
    };

    // When facing front (S/SE/SW) or pure side (E/W), draw the rear J-spine before the backrest slab
    if (!isFacingRear) {
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

    if (!isSideFacing) {
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
    } else {
      // Side profile (E/W): subtle ergonomic side trim rib along lateral backrest frame
      const sideRib0 = pt(-4.7, 4.32, 9.2);
      const sideRib1 = pt(-4.7, 4.32, topMainH - 0.6);
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = Math.max(0.8, 0.9 * z);
      ctx.beginPath();
      ctx.moveTo(sideRib0.x, sideRib0.y);
      ctx.lineTo(sideRib1.x, sideRib1.y);
      ctx.stroke();
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

    // When facing away from camera (N/NE/NW), the spine bar is on the camera-facing rear of the backrest!
    if (isFacingRear) {
      drawSpineAndLumbarBridge();
    }
  };

  if (foregroundOnly) {
    // 2nd-pass foreground overlay drawn at empDepth + 0.02 so seated agents sit INSIDE the chair!
    if (isSideFacing) {
      // Pure profile (E / W): near-camera lateral armrest wraps in front of seated hip/lap
      drawArmrest(1);
    } else if (dir === 'N') {
      // Pure rear (N): symmetric armrests + full rear backrest & J-spine cradle lower/mid back
      drawArmrest(-1);
      drawArmrest(1);
      drawSlimBackrest();
    } else {
      // Diagonal rear (NE / NW): near armrest + reclined backrest & rear spine wrap over lower/mid back
      drawArmrest(1);
      drawSlimBackrest();
    }
    ctx.restore();
    return;
  }

  // 4. True 8-Way Isometric Painter's Order Assembly (Base Chair Pass)
  if (dir === 'S') {
    drawSlimBackrest();
    drawSeatCushion();
    drawArmrest(-1);
    drawArmrest(1);
  } else if (isFacingFront) {
    // Facing SE or SW: Backrest (furthest) -> Far Armrest -> Seat Cushion -> Near Armrest (closest)
    drawSlimBackrest();
    drawArmrest(-1);
    drawSeatCushion();
    drawArmrest(1);
  } else if (isSideFacing) {
    // Facing E or W: Far Armrest -> Seat Cushion -> Side-Profile Backrest -> Near Armrest
    drawArmrest(-1);
    drawSeatCushion();
    drawSlimBackrest();
    drawArmrest(1);
  } else if (dir === 'N') {
    // Facing N: Seat Cushion -> Left & Right Armrests -> Full Rear Backrest + Spine
    drawSeatCushion();
    drawArmrest(-1);
    drawArmrest(1);
    drawSlimBackrest();
  } else {
    // Facing NE or NW: Far Armrest -> Seat Cushion -> Near Armrest -> Slim Reclined Backrest + Rear Spine
    drawArmrest(-1);
    drawSeatCushion();
    drawArmrest(1);
    drawSlimBackrest();
  }

  ctx.restore();
}

/**
 * Renders a realistic, wafer-slim ergonomic 2.5D isometric swivel office chair
 * across all 8 facings (`S`, `SE`, `E`, `NE`, `N`, `NW`, `W`, `SW`).
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
  renderErgonomicChairPass(ctx, cx, cy, zoom, variant, facing, accentColor, false);
}

/**
 * 2nd-pass foreground chair overlay (`empDepth + 0.02`) for seated agents facing
 * `N`, `NE`, `NW`, `E`, or `W`: wraps the reclined backrest, metallic J-spine,
 * and near-camera armrest cleanly in front of the seated agent's hip/lower back.
 */
export function drawChairForegroundBackrest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  variant: ChairVariant = 'task',
  facing: ChairFacing = 'SE',
  accentColor = '#5cf0ff',
): void {
  renderErgonomicChairPass(ctx, cx, cy, zoom, variant, facing, accentColor, true);
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
  const dir = normalizeChairFacing(facing);
  const isFront = dir === 'S' || dir === 'SE' || dir === 'SW' || dir === 'E' || dir === 'W';
  // Canonical x has backrest on left (-x) and gamer facing right (+x); flip for SW / NW / W
  const s = dir === 'SW' || dir === 'NW' || dir === 'W' ? -1 : 1;
  const xScale = dir === 'S' || dir === 'N' ? 0.88 : 1;
  const pal = BEANBAG_PALETTES[colorVariant] ?? BEANBAG_PALETTES.cyan;

  const p = (dx: number, dy: number) => ({
    x: cx + s * dx * xScale * z,
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

type CardFacing = 'NE' | 'SE' | 'SW' | 'NW';

function normalizeCardFacing(
  facing: ChairFacing | undefined,
  fallback: CardFacing = 'NE',
): CardFacing {
  if (!facing) return fallback;
  const up = String(facing).toUpperCase();
  if (up === 'NE' || up === 'N') return 'NE';
  if (up === 'NW') return 'NW';
  if (up === 'SW' || up === 'W') return 'SW';
  if (up === 'SE' || up === 'E' || up === 'S') return 'SE';
  return fallback;
}

function getCardIsoBasis(dir: CardFacing): {
  fwd: { x: number; y: number };
  right: { x: number; y: number };
} {
  // Exact 90°-rotatable 2:1 isometric desk/chair local axes:
  // +fwd points from the seated user across the desk; +right points to the user's right hand.
  // 32 units = 1 full isometric tile.
  switch (dir) {
    case 'NE':
      return { fwd: { x: 1, y: -0.5 }, right: { x: 1, y: 0.5 } };
    case 'SE':
      return { fwd: { x: 1, y: 0.5 }, right: { x: -1, y: 0.5 } };
    case 'SW':
      return { fwd: { x: -1, y: 0.5 }, right: { x: -1, y: -0.5 } };
    case 'NW':
      return { fwd: { x: -1, y: -0.5 }, right: { x: 1, y: -0.5 } };
  }
}

function createCardIsoPainter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  z: number,
  dir: CardFacing,
) {
  const { fwd, right } = getCardIsoBasis(dir);
  const pt = (f: number, r: number, h = 0) => ({
    x: cx + (f * fwd.x + r * right.x) * z,
    y: cy + (f * fwd.y + r * right.y) * z - h * z,
  });
  const floorY = (f: number, r: number) => cy + (f * fwd.y + r * right.y) * z;

  const fillPoly = (
    ptsFR: ReadonlyArray<{ f: number; r: number }>,
    h: number,
    fill: string,
    stroke?: string,
    lineW = 0.85,
  ) => {
    if (ptsFR.length < 3) return;
    const p0 = pt(ptsFR[0].f, ptsFR[0].r, h);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < ptsFR.length; i++) {
      const pi = pt(ptsFR[i].f, ptsFR[i].r, h);
      ctx.lineTo(pi.x, pi.y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.75, lineW * z);
      ctx.stroke();
    }
  };

  const fillVertQuad = (
    f0: number,
    r0: number,
    f1: number,
    r1: number,
    hBot: number,
    hTop: number,
    fill: string,
    stroke?: string,
    lineW = 0.8,
  ) => {
    const a = pt(f0, r0, hBot);
    const b = pt(f1, r1, hBot);
    const c = pt(f1, r1, hTop);
    const d = pt(f0, r0, hTop);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.7, lineW * z);
      ctx.stroke();
    }
  };

  const drawSlab = (
    rawPts: ReadonlyArray<{ f: number; r: number }>,
    hBot: number,
    hTop: number,
    pal: {
      top: string;
      sideLit: string;
      sideMid: string;
      sideDark: string;
      rim?: string;
      outline?: string;
    },
  ) => {
    if (rawPts.length < 3) return;
    const basePts = rawPts.map((p) => pt(p.f, p.r, 0));
    let area2 = 0;
    for (let i = 0; i < basePts.length; i++) {
      const j = (i + 1) % basePts.length;
      area2 += basePts[i].x * basePts[j].y - basePts[j].x * basePts[i].y;
    }
    const pts = area2 >= 0 ? [...rawPts] : [...rawPts].reverse();
    const scr0 = pts.map((p) => pt(p.f, p.r, 0));
    const outline = pal.outline ?? '#121622';

    const walls: Array<{
      depthY: number;
      aBot: { x: number; y: number };
      bBot: { x: number; y: number };
      bTop: { x: number; y: number };
      aTop: { x: number; y: number };
      col: string;
    }> = [];

    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const dx = scr0[j].x - scr0[i].x;
      const dy = scr0[j].y - scr0[i].y;
      const outX = dy;
      const outY = -dx;
      if (outY > -0.05 * z) {
        const len = Math.max(1e-4, Math.hypot(outX, outY));
        const nx = outX / len;
        const col = nx < -0.22 ? pal.sideLit : nx > 0.22 ? pal.sideDark : pal.sideMid;
        walls.push({
          depthY: (scr0[i].y + scr0[j].y) * 0.5,
          aBot: pt(pts[i].f, pts[i].r, hBot),
          bBot: pt(pts[j].f, pts[j].r, hBot),
          bTop: pt(pts[j].f, pts[j].r, hTop),
          aTop: pt(pts[i].f, pts[i].r, hTop),
          col,
        });
      }
    }

    walls.sort((a, b) => a.depthY - b.depthY);
    for (const w of walls) {
      ctx.beginPath();
      ctx.moveTo(w.aBot.x, w.aBot.y);
      ctx.lineTo(w.bBot.x, w.bBot.y);
      ctx.lineTo(w.bTop.x, w.bTop.y);
      ctx.lineTo(w.aTop.x, w.aTop.y);
      ctx.closePath();
      ctx.fillStyle = w.col;
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(0.75, 0.8 * z);
      ctx.stroke();
    }

    fillPoly(pts, hTop, pal.top, outline, 0.85);
    if (pal.rim) {
      fillPoly(pts, hTop, 'rgba(255, 250, 236, 0.03)', pal.rim, 0.7);
    }
  };

  const boxPts = (f0: number, f1: number, r0: number, r1: number) => [
    { f: f0, r: r0 },
    { f: f1, r: r0 },
    { f: f1, r: r1 },
    { f: f0, r: r1 },
  ];

  return { pt, floorY, fillPoly, fillVertQuad, drawSlab, boxPts };
}

function drawOrientedWorkstation(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cx: number,
  cy: number,
  z: number,
  timeSec: number,
  night: boolean,
  isOccupied: boolean,
  modelAccent: string,
  deskLevel: number,
  facing: ChairFacing | undefined,
): void {
  const isExec = kind === 'exec_desk';
  const isClover = kind === 'clover_desk';
  const isQa = kind === 'qa_desk';
  const dir = normalizeCardFacing(facing, isExec ? 'SE' : 'NE');
  const isMonitorFront = dir === 'NE' || dir === 'NW';
  const iso = createCardIsoPainter(ctx, cx, cy, z, dir);

  if (isExec) {
    // --- GRAND DOUBLE-PEDESTAL EXECUTIVE BOSS / COORDINATOR DESK ---
    const rMax = 19.4;
    const fUser = -13.2;
    const fFront = 12.6;
    const hTop = 11.6;
    const hBot = 8.2;

    // Floor contact shadow shaped to executive footprint
    iso.fillPoly(
      iso.boxPts(fUser - 1.2, fFront + 1.6, -rMax - 1.4, rMax + 1.4),
      0,
      'rgba(7, 10, 20, 0.30)',
    );

    const baseWood = night
      ? {
          top: '#5e2e18',
          sideLit: '#4f2513',
          sideMid: '#3d1c0d',
          sideDark: '#291107',
          outline: '#140904',
        }
      : {
          top: '#783b1f',
          sideLit: '#663018',
          sideMid: '#4f2411',
          sideDark: '#36170a',
          outline: '#1a0c05',
        };

    // Painter-sort twin mahogany drawer pedestals + recessed brass-trimmed coffered front modesty skirt
    const underParts: Array<{ y: number; draw: () => void }> = [
      {
        y: iso.floorY(-0.2, -14.2),
        draw: () => {
          iso.drawSlab(iso.boxPts(fUser + 1.4, fFront - 1.6, -17.8, -10.4), 0, hBot, baseWood);
          if (isMonitorFront) {
            const pPull = iso.pt(fUser + 1.35, -14.0, 5.0);
            ctx.fillStyle = '#e0b34c';
            pxRect(ctx, pPull.x - 1.5 * z, pPull.y - 0.6 * z, 3 * z, 1.1 * z);
          }
        },
      },
      {
        y: iso.floorY(-0.2, 14.2),
        draw: () => {
          iso.drawSlab(iso.boxPts(fUser + 1.4, fFront - 1.6, 10.4, 17.8), 0, hBot, baseWood);
          if (isMonitorFront) {
            const pPull = iso.pt(fUser + 1.35, 14.0, 5.0);
            ctx.fillStyle = '#e0b34c';
            pxRect(ctx, pPull.x - 1.5 * z, pPull.y - 0.6 * z, 3 * z, 1.1 * z);
          }
        },
      },
      {
        y: iso.floorY(fFront - 2.0, 0),
        draw: () => {
          // Recessed coffered modesty panel facing visitors (+f) + brushed-brass inlay moldings
          iso.drawSlab(iso.boxPts(fFront - 3.6, fFront - 1.4, -10.8, 10.8), 0.8, hBot, baseWood);
          if (!isMonitorFront) {
            // Visitor face (+f) is camera-visible when boss faces SE / SW!
            iso.fillVertQuad(
              fFront - 1.32,
              -9.6,
              fFront - 1.32,
              9.6,
              2.2,
              6.8,
              night ? '#2c1409' : '#3d1c0d',
              '#d9ab42',
              0.85,
            );
            iso.fillVertQuad(
              fFront - 1.28,
              -7.8,
              fFront - 1.28,
              7.8,
              4.2,
              4.8,
              '#e6ba56',
            );
          }
        },
      },
    ];
    underParts.sort((a, b) => a.y - b.y);
    for (const part of underParts) part.draw();

    // Sculpted overhanging royal-mahogany bullnose top with gently bowed visitor front edge
    const execTopPts = [
      { f: fUser, r: -rMax + 1.8 },
      { f: fUser + 1.6, r: -rMax },
      { f: fFront - 1.6, r: -rMax },
      { f: fFront, r: -rMax + 2.2 },
      { f: fFront + 1.2, r: -6.5 },
      { f: fFront + 1.4, r: 6.5 },
      { f: fFront, r: rMax - 2.2 },
      { f: fFront - 1.6, r: rMax },
      { f: fUser + 1.6, r: rMax },
      { f: fUser, r: rMax - 1.8 },
    ];
    iso.drawSlab(
      execTopPts,
      hBot,
      hTop,
      night
        ? {
            top: '#8c4526',
            sideLit: '#70351c',
            sideMid: '#572814',
            sideDark: '#3b190b',
            rim: 'rgba(255, 224, 168, 0.34)',
            outline: '#1a0c05',
          }
        : {
            top: '#ab5732',
            sideLit: '#8a4323',
            sideMid: '#6b3219',
            sideDark: '#4a210f',
            rim: 'rgba(255, 236, 194, 0.42)',
            outline: '#210f07',
          },
    );

    // Painter-sorted executive desktop appointments (keeps central r in [-7..+7] low so Coordinator's face is 100% clear!)
    const topItems: Array<{ y: number; draw: () => void }> = [];

    // 1. Stitched obsidian & gold executive leather blotter (deri sümen) + briefing sheet + gold pen
    topItems.push({
      y: iso.floorY(-6.8, 0),
      draw: () => {
        iso.fillPoly(iso.boxPts(-11.4, -2.4, -9.0, 9.0), hTop + 0.06, '#181d2c', '#d4a638', 0.85);
        iso.fillPoly(iso.boxPts(-8.8, -3.6, -5.2, 2.2), hTop + 0.12, '#f6f8ff');
        iso.fillPoly(iso.boxPts(-8.0, -7.0, -4.6, 0.8), hTop + 0.15, modelAccent);
        // Compact wireless executive keyboard & right-hand mouse on blotter
        iso.fillPoly(iso.boxPts(-10.2, -7.0, -4.2, 3.6), hTop + 0.16, '#0e121d');
        const pPen = iso.pt(-5.2, 6.4, hTop + 0.2);
        ctx.fillStyle = '#ffd147';
        pxRect(ctx, pPen.x - 1.6 * z, pPen.y - 1.2 * z, 3.2 * z, 1.3 * z);
        ctx.fillStyle = '#fff5b8';
        pxRect(ctx, pPen.x - 0.6 * z, pPen.y - 2.4 * z, 1.1 * z, 1.6 * z);
      },
    });

    // 2. Engraved Brushed-Brass CEO Nameplate (pirinç isimlik) along visitor front edge (+f)
    topItems.push({
      y: iso.floorY(9.8, 0),
      draw: () => {
        iso.drawSlab(iso.boxPts(8.8, 11.0, -5.4, 5.4), hTop, hTop + 2.2, {
          top: '#f2c963',
          sideLit: '#deb043',
          sideMid: '#c4952b',
          sideDark: '#8f6916',
          outline: '#302106',
        });
        if (!isMonitorFront) {
          iso.fillVertQuad(11.04, -4.2, 11.04, 4.2, hTop + 0.5, hTop + 1.6, '#261a06');
          iso.fillVertQuad(11.08, -2.8, 11.08, 2.8, hTop + 0.9, hTop + 1.3, '#ffe89e');
        }
        const pPlate = iso.pt(9.9, 0, hTop + 2.2);
        ctx.fillStyle = '#fff3b8';
        pxRect(ctx, pPlate.x - 2.2 * z, pPlate.y - 0.6 * z, 4.4 * z, 0.9 * z);
      },
    });

    // 3. Left-wing canted low-profile Executive Command Display (placed at r = -17..-8.2, completely outside face sightline!)
    topItems.push({
      y: iso.floorY(4.8, -12.8),
      draw: () => {
        const mPts = [
          { f: 6.8, r: -17.0 },
          { f: 8.0, r: -16.2 },
          { f: 4.2, r: -8.2 },
          { f: 3.0, r: -9.0 },
        ];
        // Brushed brass & gunmetal stand base
        iso.drawSlab(iso.boxPts(4.8, 6.8, -13.8, -11.4), hTop, hTop + 1.4, {
          top: '#c9a24b',
          sideLit: '#9e7c32',
          sideMid: '#785c20',
          sideDark: '#4f3b12',
          outline: '#1c1507',
        });
        const monTop = isMonitorFront ? hTop + 7.2 : hTop + 5.8;
        iso.drawSlab(mPts, hTop + 1.3, monTop, {
          top: '#2d364d',
          sideLit: '#232b3d',
          sideMid: '#181e2c',
          sideDark: '#0f131d',
          outline: '#090c14',
        });
        if (isMonitorFront) {
          iso.fillVertQuad(6.6, -16.2, 3.2, -9.4, hTop + 2.0, monTop - 0.7, '#121d33');
          iso.fillVertQuad(6.2, -15.4, 3.8, -10.6, monTop - 2.1, monTop - 1.2, modelAccent);
          iso.fillVertQuad(6.0, -15.0, 4.2, -11.4, hTop + 2.6, hTop + 3.4, '#ffd147');
        } else {
          // Luxury brushed-gold rear spine & Argon telemetry bar facing visitors
          iso.fillVertQuad(7.85, -15.8, 4.35, -8.8, hTop + 3.2, hTop + 4.0, '#d9ab42');
          iso.fillVertQuad(7.6, -15.3, 4.6, -9.3, hTop + 2.2, hTop + 2.8, modelAccent);
          // Warm screen bounce glow onto desk wing toward boss
          iso.fillPoly(
            iso.boxPts(0.4, 4.8, -16.2, -8.8),
            hTop + 0.05,
            isOccupied ? 'rgba(184, 140, 255, 0.20)' : 'rgba(92, 240, 255, 0.12)',
          );
        }
      },
    });

    // 4. Right-wing Classic Emerald-Glass & Brass Banker's Lamp (OFF in daytime, warm golden glow at night!)
    topItems.push({
      y: iso.floorY(5.6, 14.0),
      draw: () => {
        const pLamp = iso.pt(5.8, 14.2, hTop);
        if (night) {
          // Warm golden reading pool & downward light cone on mahogany surface at night
          iso.fillPoly(
            iso.boxPts(2.0, 9.2, 10.2, 17.8),
            hTop + 0.05,
            'rgba(255, 218, 108, 0.40)',
          );
          const pConeL = iso.pt(2.6, 10.8, hTop + 0.08);
          const pConeR = iso.pt(8.6, 17.2, hTop + 0.08);
          ctx.fillStyle = 'rgba(255, 214, 102, 0.16)';
          ctx.beginPath();
          ctx.moveTo(pLamp.x - 3.0 * z, pLamp.y - 7.2 * z);
          ctx.lineTo(pLamp.x + 3.0 * z, pLamp.y - 7.2 * z);
          ctx.lineTo(pConeR.x, pConeR.y);
          ctx.lineTo(pConeL.x, pConeL.y);
          ctx.closePath();
          ctx.fill();
        }
        // Brushed-brass stepped pedestal & stem
        ctx.fillStyle = night ? '#d4a638' : '#b88d2c';
        pxRect(ctx, pLamp.x - 2.4 * z, pLamp.y - 1.6 * z, 4.8 * z, 1.7 * z);
        ctx.fillStyle = night ? '#9c761c' : '#856318';
        pxRect(ctx, pLamp.x - 0.8 * z, pLamp.y - 6.8 * z, 1.6 * z, 5.4 * z);
        if (night) {
          // Lit warm incandescent bulb aperture + glowing emerald glass shade
          ctx.fillStyle = '#fff7bd';
          pxRect(ctx, pLamp.x - 3.2 * z, pLamp.y - 7.3 * z, 6.4 * z, 1.4 * z);
          ctx.fillStyle = '#24b866';
          pxRect(ctx, pLamp.x - 3.6 * z, pLamp.y - 9.9 * z, 7.2 * z, 2.8 * z);
          ctx.fillStyle = '#74f7ac';
          pxRect(ctx, pLamp.x - 2.4 * z, pLamp.y - 9.4 * z, 4.8 * z, 1.3 * z);
        } else {
          // Unlit daytime emerald glass shade & dark aperture (zero yellow glow)
          ctx.fillStyle = '#203028';
          pxRect(ctx, pLamp.x - 3.1 * z, pLamp.y - 7.2 * z, 6.2 * z, 1.2 * z);
          ctx.fillStyle = '#145c36';
          pxRect(ctx, pLamp.x - 3.6 * z, pLamp.y - 9.8 * z, 7.2 * z, 2.8 * z);
          ctx.fillStyle = '#228550';
          pxRect(ctx, pLamp.x - 2.4 * z, pLamp.y - 9.3 * z, 4.8 * z, 1.1 * z);
        }
      },
    });

    topItems.push({
      y: iso.floorY(-5.8, 12.2),
      draw: () => {
        const pCup = iso.pt(-5.8, 12.2, hTop);
        ctx.fillStyle = '#ffd147';
        pxRect(ctx, pCup.x - 2.1 * z, pCup.y - 1.0 * z, 4.2 * z, 1.1 * z);
        ctx.fillStyle = '#fffdf5';
        pxRect(ctx, pCup.x - 1.5 * z, pCup.y - 3.4 * z, 3.0 * z, 2.6 * z);
        ctx.fillStyle = '#6e381d';
        pxRect(ctx, pCup.x - 1.0 * z, pCup.y - 3.3 * z, 2.0 * z, 0.9 * z);
      },
    });

    topItems.sort((a, b) => a.y - b.y);
    for (const item of topItems) item.draw();

    drawDeskEvolutionExtras(ctx, 'exec_desk', cx, cy, z, timeSec, isOccupied, deskLevel, dir);
    return;
  }

  // --- 4-WAY WORKSTATIONS: 'desk' | 'dev_desk' | 'clover_desk' | 'qa_desk' ---
  const rHalf = isClover ? 15.5 : isQa ? 13.6 : 14.2;
  const fUser = isClover ? -12.2 : -12.6;
  const fBack = isClover ? 15.6 : isQa ? 11.0 : 11.6;
  const hBot = 7.8;
  const hTop = 11.2;

  iso.fillPoly(
    iso.boxPts(fUser - 0.8, fBack + 0.8, -rHalf - 0.8, rHalf + 0.8),
    0,
    'rgba(7, 10, 20, 0.27)',
  );

  // Under-desk steel frame legs & recessed modesty skirt
  const legPal = {
    top: '#313a4f',
    sideLit: '#293145',
    sideMid: '#1e2434',
    sideDark: '#131722',
    outline: '#0d1018',
  };
  const underParts: Array<{ y: number; draw: () => void }> = [
    {
      y: iso.floorY(0, -rHalf + 2.2),
      draw: () => {
        iso.drawSlab(
          iso.boxPts(fUser + 1.8, fBack - 1.6, -rHalf + 1.4, -rHalf + 3.2),
          0,
          hBot,
          legPal,
        );
      },
    },
    {
      y: iso.floorY(0, rHalf - 2.2),
      draw: () => {
        iso.drawSlab(
          iso.boxPts(fUser + 1.8, fBack - 1.6, rHalf - 3.2, rHalf - 1.4),
          0,
          hBot,
          legPal,
        );
      },
    },
    {
      y: iso.floorY(fBack - 2.4, 0),
      draw: () => {
        iso.drawSlab(
          iso.boxPts(fBack - 3.4, fBack - 1.5, -rHalf + 2.8, rHalf - 2.8),
          1.2,
          hBot,
          legPal,
        );
      },
    },
  ];
  underParts.sort((a, b) => a.y - b.y);
  for (const u of underParts) u.draw();

  // Desktop slab polygon: clover_desk has an ergonomic curved user pocket + seamless inner pod seam!
  const topPts = isClover
    ? [
        { f: fUser + 1.8, r: -rHalf },
        { f: fBack, r: -rHalf },
        { f: fBack, r: rHalf },
        { f: fUser + 1.8, r: rHalf },
        { f: fUser, r: rHalf - 2.4 },
        { f: fUser + 1.0, r: 5.2 },
        { f: fUser + 1.0, r: -5.2 },
        { f: fUser, r: -rHalf + 2.4 },
      ]
    : [
        { f: fUser + 1.0, r: -rHalf },
        { f: fBack - 0.8, r: -rHalf },
        { f: fBack, r: -rHalf + 0.8 },
        { f: fBack, r: rHalf - 0.8 },
        { f: fBack - 0.8, r: rHalf },
        { f: fUser + 1.0, r: rHalf },
        { f: fUser, r: rHalf - 1.2 },
        { f: fUser, r: -rHalf + 1.2 },
      ];

  const deskWood = isClover
    ? night
      ? {
          top: '#9e8667',
          sideLit: '#826d52',
          sideMid: '#66543e',
          sideDark: '#473a2a',
          rim: 'rgba(255, 244, 222, 0.30)',
          outline: '#1a1510',
        }
      : {
          top: '#dfc5a0',
          sideLit: '#b89c76',
          sideMid: '#917858',
          sideDark: '#6b573e',
          rim: 'rgba(255, 250, 236, 0.42)',
          outline: '#261e15',
        }
    : isQa
      ? night
        ? {
            top: '#94836e',
            sideLit: '#786957',
            sideMid: '#5c5042',
            sideDark: '#40372d',
            rim: 'rgba(255, 242, 224, 0.28)',
            outline: '#171410',
          }
        : {
            top: '#cfba9e',
            sideLit: '#a38e75',
            sideMid: '#7d6c58',
            sideDark: '#594c3d',
            rim: 'rgba(255, 248, 232, 0.36)',
            outline: '#241e18',
          }
      : night
        ? {
            top: '#9c8364',
            sideLit: '#80694f',
            sideMid: '#63503b',
            sideDark: '#453728',
            rim: 'rgba(255, 240, 214, 0.28)',
            outline: '#1a140e',
          }
        : {
            top: '#d8b890',
            sideLit: '#ad8e68',
            sideMid: '#856b4c',
            sideDark: '#5e4a33',
            rim: 'rgba(255, 248, 228, 0.38)',
            outline: '#241b12',
          };

  iso.drawSlab(topPts, hBot, hTop, deskWood);

  // Painter-sorted desktop accessories so both front (NE/NW) and rear (SE/SW) views layer cleanly
  const topItems: Array<{ y: number; draw: () => void }> = [];

  // Clover Pod Inner Frosted Acoustic Privacy Screen (fuses 3 or 4 CW/CCW petals into a central +/T hub!)
  if (isClover) {
    topItems.push({
      y: iso.floorY(fBack - 0.5, 0),
      draw: () => {
        const divH = hTop + 4.8;
        iso.fillVertQuad(
          fBack - 0.45,
          -rHalf + 1.0,
          fBack - 0.45,
          rHalf - 1.0,
          hTop + 0.2,
          divH,
          night ? 'rgba(96, 204, 245, 0.28)' : 'rgba(132, 224, 255, 0.42)',
          '#8ea4c8',
          0.85,
        );
        // Frosted sandblasted middle privacy band along the clover spine
        iso.fillVertQuad(
          fBack - 0.42,
          -rHalf + 1.6,
          fBack - 0.42,
          rHalf - 1.6,
          hTop + 1.8,
          hTop + 3.0,
          night ? 'rgba(195, 236, 255, 0.24)' : 'rgba(232, 250, 255, 0.46)',
        );
      },
    });
  }

  // Cable grommet near monitor spine
  const fMonBase = isClover ? 7.6 : 5.6;
  topItems.push({
    y: iso.floorY(fMonBase + 1.2, 0),
    draw: () => {
      iso.fillPoly(
        iso.boxPts(fMonBase + 0.5, fMonBase + 2.0, -2.4, 2.4),
        hTop + 0.04,
        '#181e2d',
      );
    },
  });

  // Extended anthracite desk mat + mechanical keyboard + right-hand mouse
  topItems.push({
    y: iso.floorY(-6.8, 0),
    draw: () => {
      iso.fillPoly(iso.boxPts(-10.2, -3.4, -8.6, 8.6), hTop + 0.05, '#202738');
      iso.fillPoly(iso.boxPts(-9.4, -5.6, -6.6, 2.8), hTop + 0.12, '#111521');
      iso.fillPoly(
        iso.boxPts(-8.6, -6.6, -5.8, 2.0),
        hTop + 0.18,
        isOccupied ? modelAccent : '#4a5878',
      );
      // Right-hand ergonomic mouse (always at +r = user's right hand!)
      iso.fillPoly(iso.boxPts(-8.4, -5.8, 4.4, 6.6), hTop + 0.15, '#cbd5e8');
      const pKey = iso.pt(-7.5, -1.8, hTop + 0.2);
      ctx.fillStyle = isOccupied ? modelAccent : '#4a5878';
      pxRect(ctx, pKey.x - 1.6 * z, pKey.y - 0.5 * z, 3.2 * z, 1.0 * z);
    },
  });

  // Ceramic coffee mug on user's left flank (-r)
  topItems.push({
    y: iso.floorY(-5.6, -10.8),
    draw: () => {
      const pMug = iso.pt(-5.6, -10.8, hTop);
      ctx.fillStyle = '#f2f5fc';
      pxRect(ctx, pMug.x - 1.5 * z, pMug.y - 3.0 * z, 3.0 * z, 3.0 * z);
      ctx.fillStyle = '#6e381d';
      pxRect(ctx, pMug.x - 1.0 * z, pMug.y - 3.0 * z, 2.0 * z, 1.0 * z);
    },
  });

  // 4-Way Articulated Architect Office Desk Lamp on right flank (+r = 12.2, OFF by day, warm amber glow by night!)
  const drawWorkstationLamp = (glowOverlayPass: boolean) => {
    const pBase = iso.pt(-1.6, 12.2, hTop);
    const pElbow = iso.pt(-0.6, 13.0, hTop + 6.0);
    const pHead = iso.pt(-3.8, 9.8, hTop + 8.8);

    if (glowOverlayPass) {
      if (!night) return;
      // Cast warm amber-gold reading pool & downward light cone OVER the desktop & mousepad!
      iso.fillPoly(
        iso.boxPts(-9.4, -0.6, 2.2, 12.6),
        hTop + 0.22,
        'rgba(255, 204, 88, 0.34)',
      );
      iso.fillPoly(
        iso.boxPts(-7.8, -2.2, 4.8, 11.2),
        hTop + 0.24,
        'rgba(255, 232, 142, 0.30)',
      );
      const cA = iso.pt(-8.4, 4.6, hTop + 0.22);
      const cB = iso.pt(-1.2, 11.8, hTop + 0.22);
      ctx.fillStyle = 'rgba(255, 214, 102, 0.22)';
      ctx.beginPath();
      ctx.moveTo(pHead.x - 2.6 * z, pHead.y + 0.9 * z);
      ctx.lineTo(pHead.x + 2.6 * z, pHead.y + 0.9 * z);
      ctx.lineTo(cB.x, cB.y);
      ctx.lineTo(cA.x, cA.y);
      ctx.closePath();
      ctx.fill();

      // Re-affirm crisp glowing bulb & warm shade rim above the light cone
      ctx.fillStyle = '#252e42';
      pxRect(ctx, pHead.x - 3.0 * z, pHead.y - 1.9 * z, 6.0 * z, 2.5 * z);
      ctx.fillStyle = '#4c5e82';
      pxRect(ctx, pHead.x - 2.0 * z, pHead.y - 2.9 * z, 4.0 * z, 1.3 * z);
      ctx.fillStyle = '#e6ba4c';
      pxRect(ctx, pHead.x - 0.8 * z, pHead.y - 3.6 * z, 1.6 * z, 0.9 * z);
      ctx.fillStyle = '#ffc947';
      pxRect(ctx, pHead.x - 2.6 * z, pHead.y + 0.4 * z, 5.2 * z, 1.2 * z);
      ctx.fillStyle = '#fff8cc';
      pxRect(ctx, pHead.x - 1.6 * z, pHead.y + 0.6 * z, 3.2 * z, 1.1 * z);
      return;
    }

    // Weighted gunmetal & brushed-brass circular desk base
    ctx.fillStyle = '#121724';
    pxRect(ctx, pBase.x - 2.5 * z, pBase.y - 1.3 * z, 5.0 * z, 1.6 * z);
    ctx.fillStyle = '#2d374d';
    pxRect(ctx, pBase.x - 2.0 * z, pBase.y - 1.8 * z, 4.0 * z, 1.2 * z);
    ctx.fillStyle = '#d4a638';
    pxRect(ctx, pBase.x - 0.9 * z, pBase.y - 2.4 * z, 1.8 * z, 1.0 * z);

    // 2-segment articulated Anglepoise swing arm + brass tension elbow joint
    ctx.strokeStyle = night ? '#7589b0' : '#4f5e7d';
    ctx.lineWidth = Math.max(1.2, 1.4 * z);
    ctx.beginPath();
    ctx.moveTo(pBase.x, pBase.y - 2.0 * z);
    ctx.lineTo(pElbow.x, pElbow.y);
    ctx.lineTo(pHead.x, pHead.y - 1.5 * z);
    ctx.stroke();
    ctx.fillStyle = '#e0b34c';
    pxRect(ctx, pElbow.x - 0.9 * z, pElbow.y - 0.9 * z, 1.8 * z, 1.8 * z);

    // Sculpted conical architect metal hood + bulb aperture (OFF in daytime, warm glowing filament at night)
    ctx.fillStyle = '#252e42';
    pxRect(ctx, pHead.x - 3.0 * z, pHead.y - 1.9 * z, 6.0 * z, 2.5 * z);
    ctx.fillStyle = night ? '#4c5e82' : '#37445e';
    pxRect(ctx, pHead.x - 2.0 * z, pHead.y - 2.9 * z, 4.0 * z, 1.3 * z);
    ctx.fillStyle = '#d9ab42';
    pxRect(ctx, pHead.x - 0.8 * z, pHead.y - 3.6 * z, 1.6 * z, 0.9 * z);

    if (night) {
      ctx.fillStyle = '#ffc947';
      pxRect(ctx, pHead.x - 2.6 * z, pHead.y + 0.4 * z, 5.2 * z, 1.2 * z);
      ctx.fillStyle = '#fff8cc';
      pxRect(ctx, pHead.x - 1.6 * z, pHead.y + 0.6 * z, 3.2 * z, 1.1 * z);
    } else {
      ctx.fillStyle = '#5a667d';
      pxRect(ctx, pHead.x - 2.3 * z, pHead.y + 0.4 * z, 4.6 * z, 1.0 * z);
    }
  };

  topItems.push({
    y: iso.floorY(-1.6, 12.2),
    draw: () => drawWorkstationLamp(false),
  });

  if (isQa) {
    // QA Diagnostic Widescreen Monitor + Companion Telemetry Tablet
    topItems.push({
      y: iso.floorY(fMonBase, -2.0),
      draw: () => {
        const mTop = isMonitorFront ? hTop + 8.6 : hTop + 6.0;
        // Stand foot
        iso.fillPoly(
          iso.boxPts(fMonBase - 0.6, fMonBase + 1.4, -4.4, -0.4),
          hTop + 0.08,
          '#252d40',
        );
        iso.drawSlab(
          iso.boxPts(fMonBase, fMonBase + 1.2, -8.8, 3.6),
          hTop + 1.2,
          mTop,
          {
            top: '#2a3347',
            sideLit: '#1e2536',
            sideMid: '#151a26',
            sideDark: '#0e121b',
            outline: '#090c14',
          },
        );
        if (isMonitorFront) {
          const fScr = fMonBase - 0.06;
          iso.fillVertQuad(fScr, -7.8, fScr, 2.6, hTop + 1.9, mTop - 0.7, isOccupied ? '#1c2b42' : '#1b2336');
          iso.fillVertQuad(
            fScr - 0.04,
            -6.8,
            fScr - 0.04,
            0.8,
            mTop - 2.3,
            mTop - 1.3,
            isOccupied ? '#3be87a' : '#3a4b6e',
          );
          iso.fillVertQuad(
            fScr - 0.04,
            -6.8,
            fScr - 0.04,
            -0.6,
            mTop - 4.1,
            mTop - 3.1,
            isOccupied ? '#ffbe3b' : '#2e3c59',
          );
        } else {
          // Sleek sculpted rear monitor shell + VESA spine + QA status LED bar
          const fRear = fMonBase + 1.25;
          iso.fillVertQuad(fRear, -3.2, fRear, -1.6, hTop + 0.2, hTop + 3.8, '#6e80a3');
          iso.fillVertQuad(
            fRear + 0.03,
            -6.0,
            fRear + 0.03,
            0.8,
            hTop + 3.8,
            hTop + 4.5,
            isOccupied ? '#3be87a' : '#475675',
          );
          if (isOccupied) {
            iso.fillPoly(
              iso.boxPts(fMonBase - 3.8, fMonBase - 0.2, -8.0, 3.0),
              hTop + 0.04,
              'rgba(59, 232, 122, 0.16)',
            );
          }
        }
      },
    });
    // Angled QA checklist tablet on +r side
    topItems.push({
      y: iso.floorY(fMonBase - 1.0, 7.6),
      draw: () => {
        iso.drawSlab(
          iso.boxPts(fMonBase - 1.8, fMonBase + 0.2, 5.2, 10.0),
          hTop + 0.2,
          hTop + 2.8,
          {
            top: isOccupied ? '#243854' : '#1b2336',
            sideLit: '#1c2333',
            sideMid: '#141926',
            sideDark: '#0d111a',
            outline: '#090c14',
          },
        );
        const pTab = iso.pt(fMonBase - 0.8, 7.6, hTop + 2.8);
        ctx.fillStyle = isOccupied ? '#ffbe3b' : '#3a4b6e';
        pxRect(ctx, pTab.x - 1.4 * z, pTab.y - 0.6 * z, 2.8 * z, 1.0 * z);
      },
    });
  } else {
    // Dual Canted Widescreen Coding Monitors (left wing r in [-11.6..-1.2], right wing r in [+1.2..+11.6], central sightline gap!)
    const pulse = Math.sin(timeSec * 7) > 0;
    const mTop = isMonitorFront ? hTop + 8.6 : hTop + 5.8;

    const addCodingMonitor = (isRight: boolean) => {
      const rOuter = isRight ? 11.4 : -11.4;
      const rInner = isRight ? 1.2 : -1.2;
      const fOuter = fMonBase - 1.4;
      const fInner = fMonBase + 0.8;
      const rLo = Math.min(rOuter, rInner);
      const rHi = Math.max(rOuter, rInner);
      const rMid = (rOuter + rInner) * 0.5;
      const fMid = (fOuter + fInner) * 0.5;

      topItems.push({
        y: iso.floorY(fMid, rMid),
        draw: () => {
          const mPts = isRight
            ? [
                { f: fInner, r: rInner },
                { f: fInner + 1.1, r: rInner },
                { f: fOuter + 1.1, r: rOuter },
                { f: fOuter, r: rOuter },
              ]
            : [
                { f: fOuter, r: rOuter },
                { f: fOuter + 1.1, r: rOuter },
                { f: fInner + 1.1, r: rInner },
                { f: fInner, r: rInner },
              ];

          iso.fillPoly(
            iso.boxPts(fMid - 0.4, fMid + 1.3, rMid - 1.4, rMid + 1.4),
            hTop + 0.08,
            '#252d40',
          );
          iso.drawSlab(mPts, hTop + 1.2, mTop, {
            top: '#2a3347',
            sideLit: '#1f2638',
            sideMid: '#151a26',
            sideDark: '#0d1019',
            outline: '#090c14',
          });

          const fA = isRight ? fInner : fOuter;
          const rA = isRight ? rInner + 0.7 : rOuter + 0.7;
          const fB = isRight ? fOuter : fInner;
          const rB = isRight ? rOuter - 0.7 : rInner - 0.7;

          if (isMonitorFront) {
            iso.fillVertQuad(
              fA - 0.06,
              rA,
              fB - 0.06,
              rB,
              hTop + 1.9,
              mTop - 0.7,
              isOccupied ? '#132038' : '#1a2234',
            );
            const c1 = isOccupied
              ? isRight
                ? '#ff7eb9'
                : modelAccent
              : '#334463';
            const c2 = isOccupied
              ? pulse
                ? isRight
                  ? '#3cd8ff'
                  : '#3be87a'
                : isRight
                  ? '#3be87a'
                  : '#3cd8ff'
              : '#293752';
            const c3 = isOccupied ? (isRight ? modelAccent : '#ffd147') : '#293752';
            const lerpF = (t: number) => fA + (fB - fA) * t - 0.1;
            const lerpR = (t: number) => rA + (rB - rA) * t;
            iso.fillVertQuad(lerpF(0.1), lerpR(0.1), lerpF(0.72), lerpR(0.72), mTop - 2.2, mTop - 1.3, c1);
            iso.fillVertQuad(lerpF(0.14), lerpR(0.14), lerpF(0.66), lerpR(0.66), mTop - 3.8, mTop - 2.9, c2);
            iso.fillVertQuad(lerpF(0.1), lerpR(0.1), lerpF(0.8), lerpR(0.8), mTop - 5.3, mTop - 4.5, c3);
          } else {
            // Low-profile sculpted rear monitor casing + brushed VESA arm + LED bar (zero occlusion of SE/SW faces!)
            const fRA = fA + 1.15;
            const fRB = fB + 1.15;
            const lerpRF = (t: number) => fRA + (fRB - fRA) * t;
            const lerpRR = (t: number) => rA + (rB - rA) * t;
            iso.fillVertQuad(
              lerpRF(0.42),
              lerpRR(0.42),
              lerpRF(0.58),
              lerpRR(0.58),
              hTop + 0.2,
              hTop + 3.6,
              '#7385a8',
            );
            iso.fillVertQuad(
              lerpRF(0.2),
              lerpRR(0.2),
              lerpRF(0.8),
              lerpRR(0.8),
              hTop + 3.6,
              hTop + 4.3,
              isOccupied ? modelAccent : '#455370',
            );
            if (isOccupied) {
              iso.fillPoly(
                iso.boxPts(fMid - 3.6, fMid - 0.3, rLo + 0.8, rHi - 0.8),
                hTop + 0.04,
                'rgba(60, 216, 255, 0.16)',
              );
            }
          }
        },
      });
    };

    addCodingMonitor(false);
    addCodingMonitor(true);
  }

  topItems.sort((a, b) => a.y - b.y);
  for (const item of topItems) item.draw();
  drawWorkstationLamp(true);

  drawDeskEvolutionExtras(
    ctx,
    kind === 'desk' || kind === 'clover_desk' ? 'dev_desk' : kind,
    cx,
    cy,
    z,
    timeSec,
    isOccupied,
    deskLevel,
    dir,
  );
}

type SofaModulePart = 'left' | 'mid' | 'right' | 'single';

interface IsoSlabPalette {
  top: string;
  sideLit: string;
  sideMid: string;
  sideDark: string;
  rim?: string;
  outline?: string;
}

interface UpholsteryColorTheme {
  name: string;
  seat: IsoSlabPalette;
  bolster: IsoSlabPalette;
  pillow: IsoSlabPalette;
  tuft: string;
  piping: string;
  welt: string;
}

const CLASSIC_BERRY_UPHOLSTERY: UpholsteryColorTheme = {
  name: 'classic_berry',
  seat: {
    top: '#c75472',
    sideLit: '#a13c57',
    sideMid: '#852e46',
    sideDark: '#611e31',
    rim: 'rgba(255, 214, 226, 0.26)',
    outline: '#240b13',
  },
  bolster: {
    top: '#de6480',
    sideLit: '#b3435d',
    sideMid: '#913248',
    sideDark: '#6b2133',
    rim: 'rgba(255, 224, 232, 0.30)',
    outline: '#240b13',
  },
  pillow: {
    top: '#ffd166',
    sideLit: '#e0ad3e',
    sideMid: '#ba8b25',
    sideDark: '#8c6514',
    outline: '#2e2005',
  },
  tuft: '#5c1828',
  piping: '#d9ab42',
  welt: 'rgba(255, 232, 240, 0.32)',
};

export const UPHOLSTERY_COLOR_THEMES: readonly UpholsteryColorTheme[] = [
  // 0: Emerald Velvet + Warm Ochre Gold Pillow
  {
    name: 'emerald_velvet',
    seat: {
      top: '#247d58',
      sideLit: '#1c6345',
      sideMid: '#154d35',
      sideDark: '#0e3625',
      rim: 'rgba(182, 245, 216, 0.28)',
      outline: '#081f15',
    },
    bolster: {
      top: '#2d9168',
      sideLit: '#21704f',
      sideMid: '#18573d',
      sideDark: '#103d2a',
      rim: 'rgba(198, 250, 226, 0.32)',
      outline: '#081f15',
    },
    pillow: {
      top: '#f4c553',
      sideLit: '#d4a135',
      sideMid: '#ad8022',
      sideDark: '#7d5a14',
      outline: '#2b1e05',
    },
    tuft: '#0b2e1f',
    piping: '#d9ab42',
    welt: 'rgba(202, 252, 228, 0.32)',
  },
  // 1: Royal Cobalt / Midnight Navy + Saffron Pillow
  {
    name: 'royal_cobalt',
    seat: {
      top: '#2e5ea6',
      sideLit: '#234982',
      sideMid: '#1a3866',
      sideDark: '#112647',
      rim: 'rgba(190, 218, 255, 0.28)',
      outline: '#091529',
    },
    bolster: {
      top: '#396fc0',
      sideLit: '#2b5596',
      sideMid: '#204275',
      sideDark: '#152d52',
      rim: 'rgba(206, 228, 255, 0.32)',
      outline: '#091529',
    },
    pillow: {
      top: '#f2b84b',
      sideLit: '#cf9630',
      sideMid: '#a8761f',
      sideDark: '#785212',
      outline: '#2b1c05',
    },
    tuft: '#0e2140',
    piping: '#e0b84c',
    welt: 'rgba(212, 232, 255, 0.32)',
  },
  // 2: Cognac / Tan Saddle Leather + Warm Ivory Linen Pillow
  {
    name: 'cognac_leather',
    seat: {
      top: '#b86835',
      sideLit: '#945026',
      sideMid: '#753d1b',
      sideDark: '#542a11',
      rim: 'rgba(255, 224, 194, 0.30)',
      outline: '#261105',
    },
    bolster: {
      top: '#cc7843',
      sideLit: '#a65c2e',
      sideMid: '#854721',
      sideDark: '#5e3115',
      rim: 'rgba(255, 232, 206, 0.34)',
      outline: '#261105',
    },
    pillow: {
      top: '#f2e8d5',
      sideLit: '#d4c6ad',
      sideMid: '#b3a389',
      sideDark: '#877962',
      outline: '#2e271d',
    },
    tuft: '#47210b',
    piping: '#e6c267',
    welt: 'rgba(255, 236, 212, 0.34)',
  },
  // 3: Saffron Mustard Velvet + Deep Slate Teal Pillow
  {
    name: 'mustard_velvet',
    seat: {
      top: '#c9932c',
      sideLit: '#a3741f',
      sideMid: '#825b16',
      sideDark: '#5e400e',
      rim: 'rgba(255, 238, 186, 0.30)',
      outline: '#261904',
    },
    bolster: {
      top: '#dea63b',
      sideLit: '#b58426',
      sideMid: '#91681b',
      sideDark: '#694a11',
      rim: 'rgba(255, 244, 204, 0.34)',
      outline: '#261904',
    },
    pillow: {
      top: '#2c5e6b',
      sideLit: '#204752',
      sideMid: '#17353d',
      sideDark: '#0f242b',
      outline: '#071317',
    },
    tuft: '#523609',
    piping: '#f5d77f',
    welt: 'rgba(255, 246, 208, 0.34)',
  },
  // 4: Plum Burgundy Velvet + Champagne Pillow
  {
    name: 'plum_burgundy',
    seat: {
      top: '#8a335c',
      sideLit: '#6e2548',
      sideMid: '#571b37',
      sideDark: '#3d1126',
      rim: 'rgba(255, 204, 228, 0.28)',
      outline: '#1f0713',
    },
    bolster: {
      top: '#a1406d',
      sideLit: '#802e54',
      sideMid: '#662242',
      sideDark: '#47162d',
      rim: 'rgba(255, 216, 235, 0.32)',
      outline: '#1f0713',
    },
    pillow: {
      top: '#f5dec4',
      sideLit: '#d6ba9c',
      sideMid: '#b59879',
      sideDark: '#8a7157',
      outline: '#2e2217',
    },
    tuft: '#360d20',
    piping: '#e0b44c',
    welt: 'rgba(255, 220, 238, 0.32)',
  },
  // 5: Petrol Teal + Terracotta Coral Pillow
  {
    name: 'petrol_teal',
    seat: {
      top: '#1f707a',
      sideLit: '#175760',
      sideMid: '#11434a',
      sideDark: '#0b2e33',
      rim: 'rgba(184, 242, 248, 0.28)',
      outline: '#061a1d',
    },
    bolster: {
      top: '#288490',
      sideLit: '#1e6770',
      sideMid: '#164f57',
      sideDark: '#0e373d',
      rim: 'rgba(202, 248, 252, 0.32)',
      outline: '#061a1d',
    },
    pillow: {
      top: '#e87a56',
      sideLit: '#c45e3d',
      sideMid: '#9e472b',
      sideDark: '#73311c',
      outline: '#290f07',
    },
    tuft: '#09282c',
    piping: '#deb148',
    welt: 'rgba(206, 250, 255, 0.32)',
  },
];

function resolveUpholsteryTheme(
  colorIndex: number | undefined,
  defaultClassicBerry: boolean,
): UpholsteryColorTheme {
  if (colorIndex === undefined || !Number.isFinite(colorIndex)) {
    return defaultClassicBerry ? CLASSIC_BERRY_UPHOLSTERY : UPHOLSTERY_COLOR_THEMES[0];
  }
  const len = UPHOLSTERY_COLOR_THEMES.length;
  const idx = ((Math.trunc(colorIndex) % len) + len) % len;
  return UPHOLSTERY_COLOR_THEMES[idx];
}

function drawDirectionalArmchair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  z: number,
  facing: ChairFacing | undefined,
  colorIndex?: number,
): void {
  const dir = normalizeCardFacing(facing, 'SE');
  const isFront = dir === 'SE' || dir === 'SW';
  const iso = createCardIsoPainter(ctx, cx, cy, z, dir);
  const theme = resolveUpholsteryTheme(colorIndex, true);

  // Soft floor contact shadow
  iso.fillPoly(iso.boxPts(-10.2, 8.6, -10.8, 10.8), 0, 'rgba(7, 10, 20, 0.28)');

  // 4 tapered warm-walnut legs + subtle brass ferrules
  for (const [lf, lr] of [
    [-7.8, -8.2],
    [-7.8, 8.2],
    [5.8, -8.2],
    [5.8, 8.2],
  ] as const) {
    const pLeg = iso.pt(lf, lr, 0);
    ctx.fillStyle = '#6e4526';
    pxRect(ctx, pLeg.x - 1.1 * z, pLeg.y - 2.4 * z, 2.2 * z, 1.8 * z);
    ctx.fillStyle = '#cfa23e';
    pxRect(ctx, pLeg.x - 0.9 * z, pLeg.y - 0.7 * z, 1.8 * z, 0.7 * z);
  }

  const seatPal = theme.seat;
  const bolsterPal = theme.bolster;

  const parts: Array<{ y: number; draw: () => void }> = [
    // Plush seat deck (deepened forward pocket so NE/NW seated guests nestle cleanly on the cushion)
    {
      y: iso.floorY(0.8, 0),
      draw: () => {
        iso.drawSlab(iso.boxPts(-7.0, 8.2, -7.8, 7.8), 2.0, 7.6, seatPal);
        if (isFront) {
          // Contrast lumbar accent pillow nestled against backrest
          iso.drawSlab(iso.boxPts(-5.4, -2.6, -4.4, 4.4), 7.6, 10.0, theme.pillow);
        }
      },
    },
    // Left rolled armrest
    {
      y: iso.floorY(-0.2, -8.4),
      draw: () => {
        iso.drawSlab(iso.boxPts(-8.6, 7.4, -10.0, -6.6), 2.4, 11.2, bolsterPal);
      },
    },
    // Right rolled armrest
    {
      y: iso.floorY(-0.2, 8.4),
      draw: () => {
        iso.drawSlab(iso.boxPts(-8.6, 7.4, 6.6, 10.0), 2.4, 11.2, bolsterPal);
      },
    },
    // Reclined button-tufted backrest at -f (tucked slightly back on NE/NW so seated spine sits cleanly in cushion)
    {
      y: iso.floorY(isFront ? -7.6 : -8.8, 0),
      draw: () => {
        const backF0 = isFront ? -9.6 : -10.6;
        const backF1 = isFront ? -5.6 : -6.8;
        const backTop = isFront ? 16.0 : 14.2;
        iso.drawSlab(iso.boxPts(backF0, backF1, -9.4, 9.4), 2.6, backTop, bolsterPal);
        if (isFront) {
          for (const tr of [-4.2, 0, 4.2]) {
            const pTuft = iso.pt(-5.55, tr, 12.6);
            ctx.fillStyle = theme.tuft;
            pxRect(ctx, pTuft.x - 0.8 * z, pTuft.y - 0.8 * z, 1.6 * z, 1.6 * z);
          }
        } else {
          // Tailored rear upholstery seam + brass piping strip when seen from behind (NE/NW)
          iso.fillVertQuad(backF0 - 0.06, -6.8, backF0 - 0.06, 6.8, 6.0, 6.7, theme.piping);
        }
      },
    },
  ];

  parts.sort((a, b) => a.y - b.y);
  for (const part of parts) part.draw();
}

/**
 * Renders a 4-way rotatable 2.5D modular sofa segment (`sofa_l`, `sofa_m`, `sofa_r`, or standalone `sofa`).
 * In `createCardIsoPainter`, `32` units along `right` equals 1 exact isometric tile (`r ∈ [-16, +16]`),
 * so `sofa_l + sofa_r` forms a seamless 2-seater loveseat and `sofa_l + sofa_m + sofa_r` forms a
 * seamless 3-seater grand couch with zero center-armrest collisions and crisp individual seat cushions.
 */
function drawDirectionalSofaPart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  z: number,
  facing: ChairFacing | undefined,
  part: SofaModulePart,
  colorIndex?: number,
): void {
  const dir = normalizeCardFacing(facing, 'NE');
  const isFront = dir === 'SE' || dir === 'SW';
  const rightGoesFront = dir === 'NE' || dir === 'SE';
  const hasLeftArm = part === 'left' || part === 'single';
  const hasRightArm = part === 'right' || part === 'single';
  const iso = createCardIsoPainter(ctx, cx, cy, z, dir);
  const theme = resolveUpholsteryTheme(colorIndex, false);

  const outerR0 = hasLeftArm ? -12.6 : -16.05;
  const outerR1 = hasRightArm ? 12.6 : 16.05;
  const backF0 = isFront ? -9.8 : -13.0;
  const backF1 = isFront ? -5.8 : -9.2;
  const frontF1 = isFront ? 8.4 : 9.8;

  // 1. Continuous soft floor contact shadow across modular seam
  iso.fillPoly(
    iso.boxPts(backF0 - 0.5, frontF1 + 0.6, hasLeftArm ? -13.4 : -16.05, hasRightArm ? 13.4 : 16.05),
    0,
    'rgba(7, 10, 20, 0.26)',
  );

  // 2. Tapered walnut legs + brushed-brass ferrules ONLY at outer ends (plus subtle center support on `mid`)
  const legCoords: Array<[number, number]> = [];
  if (hasLeftArm) {
    legCoords.push([backF0 + 2.2, -10.4], [frontF1 - 2.2, -10.4]);
  }
  if (hasRightArm) {
    legCoords.push([backF0 + 2.2, 10.4], [frontF1 - 2.2, 10.4]);
  }
  if (part === 'mid') {
    legCoords.push([backF0 + 2.4, 0], [frontF1 - 2.4, 0]);
  }
  for (const [lf, lr] of legCoords) {
    const pLeg = iso.pt(lf, lr, 0);
    ctx.fillStyle = '#6e4526';
    pxRect(ctx, pLeg.x - 1.15 * z, pLeg.y - 2.3 * z, 2.3 * z, 1.7 * z);
    ctx.fillStyle = '#d9ab42';
    pxRect(ctx, pLeg.x - 0.95 * z, pLeg.y - 0.7 * z, 1.9 * z, 0.7 * z);
  }

  // 3. Continuous warm-walnut architectural base rail tying 2-seater / 3-seater modules into one body
  const walnutPlinthPal: IsoSlabPalette = {
    top: '#7a4b2a',
    sideLit: '#693f22',
    sideMid: '#523019',
    sideDark: '#3b2110',
    rim: 'rgba(235, 194, 148, 0.20)',
    outline: '#1f1007',
  };
  iso.drawSlab(iso.boxPts(backF0 + 0.2, frontF1 - 0.2, outerR0, outerR1), 1.8, 3.4, walnutPlinthPal);

  // 4. Exact 3D BSP draw helpers (Backrest in f < backF1; Left Arm / Cushion / Right Arm in f >= backF1)
  const drawBackrest = () => {
    const backTop = isFront ? 16.0 : 13.6;
    iso.drawSlab(iso.boxPts(backF0, backF1, outerR0, outerR1), 3.4, backTop, theme.bolster);
    if (isFront) {
      const tuftRs =
        part === 'left'
          ? [-3.4, 7.6]
          : part === 'right'
            ? [-7.6, 3.4]
            : part === 'mid'
              ? [-6.0, 6.0]
              : [-4.2, 0, 4.2];
      for (const tr of tuftRs) {
        const pTuft = iso.pt(backF1 + 0.06, tr, 12.6);
        ctx.fillStyle = theme.tuft;
        pxRect(ctx, pTuft.x - 0.8 * z, pTuft.y - 0.8 * z, 1.6 * z, 1.6 * z);
      }
    } else {
      // Continuous tailored rear brass piping seam uniting all modules when seen from NE/NW
      const pipeR0 = hasLeftArm ? -10.2 : -16.05;
      const pipeR1 = hasRightArm ? 10.2 : 16.05;
      iso.fillVertQuad(backF0 - 0.06, pipeR0, backF0 - 0.06, pipeR1, 6.2, 6.9, theme.piping);
    }
  };

  const drawLeftArm = () => {
    if (!hasLeftArm) return;
    iso.drawSlab(iso.boxPts(backF1, frontF1 - 0.3, -12.6, -8.8), 3.4, 11.4, theme.bolster);
  };

  const drawRightArm = () => {
    if (!hasRightArm) return;
    iso.drawSlab(iso.boxPts(backF1, frontF1 - 0.3, 8.8, 12.6), 3.4, 11.4, theme.bolster);
  };

  const drawSeatCushionAndPillows = () => {
    const cushR0 = hasLeftArm ? -8.8 : -15.82;
    const cushR1 = hasRightArm ? 8.8 : 15.82;
    iso.drawSlab(iso.boxPts(backF1, frontF1, cushR0, cushR1), 3.4, 7.9, theme.seat);
    // Subtle plush crown highlight along front welt of each individual seat cushion
    iso.fillPoly(
      iso.boxPts(frontF1 - 1.3, frontF1 - 0.25, cushR0 + 0.8, cushR1 - 0.8),
      7.94,
      theme.welt,
    );

    // Designer contrast throw pillows at outer corners (plus front lumbar accent on `mid`)
    if (hasLeftArm && part !== 'single') {
      iso.drawSlab(iso.boxPts(backF1 + 0.2, backF1 + 4.4, -8.4, -3.6), 7.9, 11.1, theme.pillow);
    } else if (hasRightArm && part !== 'single') {
      iso.drawSlab(iso.boxPts(backF1 + 0.2, backF1 + 4.4, 3.6, 8.4), 7.9, 11.1, theme.pillow);
    } else if (part === 'single' && isFront) {
      iso.drawSlab(iso.boxPts(backF1 + 0.2, backF1 + 3.2, -4.4, 4.4), 7.9, 10.4, theme.pillow);
    } else if (part === 'mid' && isFront) {
      iso.drawSlab(iso.boxPts(backF1 + 0.2, backF1 + 2.8, -5.0, 5.0), 7.9, 10.2, theme.pillow);
    }
  };

  const drawDeckRow = () => {
    if (rightGoesFront) {
      drawLeftArm();
      drawSeatCushionAndPillows();
      drawRightArm();
    } else {
      drawRightArm();
      drawSeatCushionAndPillows();
      drawLeftArm();
    }
  };

  if (isFront) {
    drawBackrest();
    drawDeckRow();
  } else {
    drawDeckRow();
    drawBackrest();
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
  facing?: ChairFacing,
  colorIndex?: number,
): void {
  const z = zoom;
  const cx = sx;
  const cy = sy;
  const chairOrPropFacing: ChairFacing = facing ?? 'SE';
  const modelAccent = MODEL_ACCENT_COLORS[occupierModelFamily] ?? '#5cf0ff';

  ctx.save();

  if (drawCustomOrPartitionProp(ctx, kind, cx, cy, z, timeSec, isOccupied, night, facing)) {
    ctx.restore();
    return;
  }

  if (
    kind === 'desk' ||
    kind === 'dev_desk' ||
    kind === 'clover_desk' ||
    kind === 'qa_desk' ||
    kind === 'exec_desk'
  ) {
    drawOrientedWorkstation(
      ctx,
      kind,
      cx,
      cy,
      z,
      timeSec,
      night,
      isOccupied,
      modelAccent,
      deskLevel,
      facing,
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
    drawErgonomicOfficeChair(ctx, cx, cy, z, chairVariant, chairOrPropFacing, modelAccent);
  } else if (
    kind === 'gaming_seat' ||
    kind === 'beanbag' ||
    kind.startsWith('beanbag_') ||
    kind.startsWith('gaming_seat_')
  ) {
    const bagColor = resolveBeanbagColorVariant(ctx, kind, sx, sy, timeSec, colorIndex);
    drawPlushBeanbag(ctx, cx, cy, z, chairOrPropFacing, bagColor);
  } else if (kind === 'armchair') {
    drawDirectionalArmchair(ctx, cx, cy, z, facing, colorIndex);
  } else if (kind === 'lounge_lamp' || kind === 'floor_lamp') {
    // 2.5D Mid-Century Walnut & Brushed-Brass Standing Lounge Abajur (switched OFF by day, warm honey-peach glow at night!)
    drawFloorShadow(ctx, cx, cy, 8.4, 4.6, z, night ? 0.2 : 0.3);

    if (night) {
      // Cozy warm peach-amber carpet halo & dual downward/upward lampshade light cones
      if (typeof ctx.ellipse === 'function') {
        ctx.fillStyle = 'rgba(255, 188, 84, 0.22)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 0.4 * z, 15.5 * z, 7.8 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 216, 122, 0.18)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 9.2 * z, 4.6 * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Downward warm light cone onto lounge floor
      ctx.fillStyle = 'rgba(255, 198, 96, 0.15)';
      ctx.beginPath();
      ctx.moveTo(cx - 6.8 * z, cy - 20.6 * z);
      ctx.lineTo(cx + 6.8 * z, cy - 20.6 * z);
      ctx.lineTo(cx + 13.8 * z, cy - 0.5 * z);
      ctx.lineTo(cx - 13.8 * z, cy - 0.5 * z);
      ctx.closePath();
      ctx.fill();
      // Subtle upward ceiling-wash cone from top aperture
      ctx.fillStyle = 'rgba(255, 214, 128, 0.12)';
      ctx.beginPath();
      ctx.moveTo(cx - 4.4 * z, cy - 30.4 * z);
      ctx.lineTo(cx + 4.4 * z, cy - 30.4 * z);
      ctx.lineTo(cx + 8.0 * z, cy - 36.2 * z);
      ctx.lineTo(cx - 8.0 * z, cy - 36.2 * z);
      ctx.closePath();
      ctx.fill();
    }

    // Turned dark-walnut pedestal foot + brushed-brass collar & slender column
    drawBox(ctx, cx, cy - 0.2 * z, 6.2, 3.6, 1.8, '#8a5229', '#663a1b', '#45250f', z);
    ctx.fillStyle = '#d9ab42';
    pxRect(ctx, cx - 2.2 * z, cy - 2.8 * z, 4.4 * z, 1.1 * z);
    ctx.fillStyle = '#7a5a18';
    pxRect(ctx, cx - 1.1 * z, cy - 21.2 * z, 2.2 * z, 18.6 * z);
    ctx.fillStyle = night ? '#f0c356' : '#cfa13a';
    pxRect(ctx, cx - 0.7 * z, cy - 21.2 * z, 1.3 * z, 18.6 * z);
    // Delicate pull-chain switch & brass acorn bead hanging under shade
    ctx.fillStyle = '#b88d2c';
    pxRect(ctx, cx + 2.3 * z, cy - 20.6 * z, 0.7 * z, 3.2 * z);
    ctx.fillStyle = night ? '#ffe596' : '#d9ab42';
    pxRect(ctx, cx + 2.0 * z, cy - 17.6 * z, 1.3 * z, 1.3 * z);

    // Tapered pleated fabric drum-cone lampshade (cy - 30.4*z .. cy - 20.6*z)
    const shTopY = cy - 30.4 * z;
    const shBotY = cy - 20.6 * z;
    const topHW = 4.6 * z;
    const botHW = 7.4 * z;

    if (night) {
      // Glowing warm incandescent bulb peeking just below shade rim
      ctx.fillStyle = '#ffbe42';
      pxRect(ctx, cx - 2.2 * z, shBotY - 0.3 * z, 4.4 * z, 1.4 * z);
      ctx.fillStyle = '#fffbe0';
      pxRect(ctx, cx - 1.3 * z, shBotY - 0.1 * z, 2.6 * z, 1.0 * z);

      // Internally illuminated honey-peach & warm amber linen shade
      ctx.fillStyle = '#ffc966';
      ctx.beginPath();
      ctx.moveTo(cx - topHW, shTopY);
      ctx.lineTo(cx + topHW, shTopY);
      ctx.lineTo(cx + botHW, shBotY);
      ctx.lineTo(cx - botHW, shBotY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5c3310';
      ctx.lineWidth = Math.max(0.9, 1.0 * z);
      ctx.stroke();

      // Radiant center core panel (warm bulb transmission through linen)
      ctx.fillStyle = '#ffe5a3';
      ctx.beginPath();
      ctx.moveTo(cx - topHW * 0.48, shTopY + 0.7 * z);
      ctx.lineTo(cx + topHW * 0.48, shTopY + 0.7 * z);
      ctx.lineTo(cx + botHW * 0.48, shBotY - 0.7 * z);
      ctx.lineTo(cx - botHW * 0.48, shBotY - 0.7 * z);
      ctx.closePath();
      ctx.fill();

      // Warm toasted-amber top & bottom fabric binding trims + glowing top ring
      ctx.fillStyle = '#e69535';
      pxRect(ctx, cx - topHW, shTopY, topHW * 2, 1.0 * z);
      pxRect(ctx, cx - botHW + 0.4 * z, shBotY - 1.0 * z, (botHW - 0.4 * z) * 2, 1.0 * z);
      ctx.fillStyle = '#fff6c7';
      pxRect(ctx, cx - topHW * 0.62, shTopY - 0.6 * z, topHW * 1.24, 0.9 * z);
    } else {
      // Daytime switched-OFF natural oatmeal/cream woven linen shade (zero glow)
      ctx.fillStyle = '#cbc0ac';
      ctx.beginPath();
      ctx.moveTo(cx - topHW, shTopY);
      ctx.lineTo(cx + topHW, shTopY);
      ctx.lineTo(cx + botHW, shBotY);
      ctx.lineTo(cx - botHW, shBotY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#332c24';
      ctx.lineWidth = Math.max(0.9, 1.0 * z);
      ctx.stroke();

      // Left daylight sheen & right shaded fabric pleat
      ctx.fillStyle = '#dfd5c3';
      ctx.beginPath();
      ctx.moveTo(cx - topHW + 0.5 * z, shTopY + 0.7 * z);
      ctx.lineTo(cx - 0.4 * z, shTopY + 0.7 * z);
      ctx.lineTo(cx - 0.6 * z, shBotY - 0.7 * z);
      ctx.lineTo(cx - botHW + 0.7 * z, shBotY - 0.7 * z);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#afa38e';
      ctx.beginPath();
      ctx.moveTo(cx + 1.2 * z, shTopY + 0.7 * z);
      ctx.lineTo(cx + topHW - 0.5 * z, shTopY + 0.7 * z);
      ctx.lineTo(cx + botHW - 0.7 * z, shBotY - 0.7 * z);
      ctx.lineTo(cx + 1.6 * z, shBotY - 0.7 * z);
      ctx.closePath();
      ctx.fill();

      // Muted taupe fabric binding trims & dark unlit top ring
      ctx.fillStyle = '#8c7d68';
      pxRect(ctx, cx - topHW, shTopY, topHW * 2, 1.0 * z);
      pxRect(ctx, cx - botHW + 0.4 * z, shBotY - 1.0 * z, (botHW - 0.4 * z) * 2, 1.0 * z);
      ctx.fillStyle = '#52483c';
      pxRect(ctx, cx - topHW * 0.6, shTopY - 0.4 * z, topHW * 1.2, 0.8 * z);
    }
  } else if (
    kind === 'sofa' ||
    kind === 'sofa_l' ||
    kind === 'sofa_m' ||
    kind === 'sofa_r'
  ) {
    const sofaPart: SofaModulePart =
      kind === 'sofa_l'
        ? 'left'
        : kind === 'sofa_m'
          ? 'mid'
          : kind === 'sofa_r'
            ? 'right'
            : 'single';
    drawDirectionalSofaPart(ctx, cx, cy, z, facing, sofaPart, colorIndex);
  } else if (kind === 'exec_coffee_table') {
    // Luxury CEO Visitor Coffee Table (Walnut, Brushed Brass & Smoked Emperador Marble — never overwritten by gaming/pizza props!)
    drawFloorShadow(ctx, cx, cy, 17.5, 10.2, z, 0.3);

    // Brushed-brass & dark-walnut architectural legs + lower lookbook shelf
    ctx.fillStyle = '#b88b2e';
    pxRect(ctx, cx - 12.8 * z, cy - 5.2 * z, 1.8 * z, 6.4 * z);
    pxRect(ctx, cx + 11.0 * z, cy - 5.2 * z, 1.8 * z, 6.4 * z);
    pxRect(ctx, cx - 0.9 * z, cy + 1.2 * z, 1.8 * z, 4.0 * z);
    drawBox(ctx, cx, cy - 1.4 * z, 14.2, 8.0, 2.0, '#6e3a1f', '#4f2814', '#361a0c', z);

    // Leather-bound architectural folio on lower walnut shelf
    ctx.fillStyle = '#d9ab42';
    pxRect(ctx, cx - 4.8 * z, cy - 4.8 * z, 5.2 * z, 1.3 * z);
    ctx.fillStyle = '#f5efe2';
    pxRect(ctx, cx + 1.0 * z, cy - 4.6 * z, 4.4 * z, 1.2 * z);

    // Beveled walnut & smoked-bronze marble tabletop with brushed-gold rim
    drawBox(
      ctx,
      cx,
      cy - 6.4 * z,
      16.6,
      9.4,
      2.3,
      '#8f4926',
      '#693318',
      '#47210e',
      z,
      'rgba(245, 208, 107, 0.48)',
    );
    ctx.beginPath();
    ctx.moveTo(cx, cy - 15.0 * z);
    ctx.lineTo(cx + 13.0 * z, cy - 11.0 * z);
    ctx.lineTo(cx, cy - 7.0 * z);
    ctx.lineTo(cx - 13.0 * z, cy - 11.0 * z);
    ctx.closePath();
    ctx.fillStyle = '#241b18';
    ctx.fill();

    // Subtle marble gold/cream veining streak
    ctx.strokeStyle = 'rgba(242, 214, 150, 0.36)';
    ctx.lineWidth = Math.max(0.85, 1.0 * z);
    ctx.beginPath();
    ctx.moveTo(cx - 7.5 * z, cy - 10.6 * z);
    ctx.lineTo(cx - 1.2 * z, cy - 13.2 * z);
    ctx.moveTo(cx + 0.8 * z, cy - 9.4 * z);
    ctx.lineTo(cx + 6.4 * z, cy - 11.8 * z);
    ctx.stroke();

    // Brushed-brass hospitality tray + crystal water carafe + 2 porcelain visitor espresso cups
    ctx.fillStyle = '#d4a638';
    pxRect(ctx, cx - 5.6 * z, cy - 12.6 * z, 8.2 * z, 3.2 * z);
    ctx.fillStyle = '#1b1614';
    pxRect(ctx, cx - 4.8 * z, cy - 12.1 * z, 6.6 * z, 2.2 * z);
    // Crystal carafe
    ctx.fillStyle = '#9ee8ff';
    pxRect(ctx, cx - 1.6 * z, cy - 15.6 * z, 2.4 * z, 3.8 * z);
    ctx.fillStyle = '#e8fbff';
    pxRect(ctx, cx - 1.1 * z, cy - 16.4 * z, 1.4 * z, 1.2 * z);
    // Two facing guest porcelain espresso cups
    ctx.fillStyle = '#fffdf5';
    pxRect(ctx, cx - 4.4 * z, cy - 13.8 * z, 2.0 * z, 2.0 * z);
    pxRect(ctx, cx + 3.8 * z, cy - 12.4 * z, 2.0 * z, 2.0 * z);
    ctx.fillStyle = '#6e381d';
    pxRect(ctx, cx - 4.0 * z, cy - 13.7 * z, 1.2 * z, 0.7 * z);
    pxRect(ctx, cx + 4.2 * z, cy - 12.3 * z, 1.2 * z, 0.7 * z);
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
  } else if (kind === 'war_table_part') {
    // Multi-tile conference table collision extension: intentional balanced no-op (anchor draws unified table)
  } else if (
    kind === 'war_table' ||
    kind === 'war_table_oval' ||
    kind === 'war_table_round' ||
    kind === 'war_table_rect' ||
    kind === 'war_table_u' ||
    kind === 'war_table_s'
  ) {
    drawArchitecturalConferenceTable(ctx, kind, cx, cy, z, timeSec, night, isOccupied, modelAccent);
  } else if (kind === 'bookshelf') {
    const frontFace = resolveFrontDisplayFacing(facing, 'SW');
    const iso = createCardIsoPainter(ctx, cx, cy, z, frontFace);
    const slab = (
      f0: number,
      f1: number,
      r0: number,
      r1: number,
      h0: number,
      h1: number,
      top: string,
      sideLit: string,
      sideDark: string,
    ) => {
      iso.drawSlab(iso.boxPts(f0, f1, r0, r1), h0, h1, {
        top,
        sideLit,
        sideMid: sideLit,
        sideDark,
      });
    };
    drawFloorShadow(ctx, cx, cy, 21.5, 10.6, z, 0.3);

    // 1. Lower enclosed walnut credenza base + twin paneled cabinet doors & brass knobs
    slab(-3.8, 3.8, -13.2, 13.2, 0, 7.2, '#7d4d2b', '#5e381d', '#3e2310');
    iso.fillVertQuad(3.9, -11.8, 3.9, -0.6, 1.0, 6.2, '#6c4123');
    iso.fillVertQuad(3.9, 0.6, 3.9, 11.8, 1.0, 6.2, '#6c4123');
    iso.fillVertQuad(3.98, -10.9, 3.98, -1.4, 1.6, 5.6, '#523018');
    iso.fillVertQuad(3.98, 1.4, 3.98, 10.9, 1.6, 5.6, '#523018');
    // Polished brass cabinet knobs
    const knobL = iso.pt(4.06, -2.1, 3.8);
    const knobR = iso.pt(4.06, 2.1, 3.8);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, knobL.x - 0.5 * z, knobL.y - 0.5 * z, 1.0 * z, 1.0 * z);
    pxRect(ctx, knobR.x - 0.5 * z, knobR.y - 0.5 * z, 1.0 * z, 1.0 * z);

    // 2. Recessed dark espresso bookcase back cavity + outer walnut stiles
    slab(-3.8, 2.5, -12.0, 12.0, 7.2, 29.6, '#26150b', '#1d1008', '#150b05');
    slab(-3.8, 3.8, -13.2, -11.8, 7.2, 29.6, '#875430', '#633b1f', '#422612');
    slab(-3.8, 3.8, 11.8, 13.2, 7.2, 29.6, '#875430', '#633b1f', '#422612');

    // 3. Shelf 0 (h = 7.2..12.6): Heavy reference encyclopedias + horizontal folio stack
    const jacketPalette = [
      ['#c93b4b', '#942432'], // crimson leather
      ['#2b6cb0', '#1c4878'], // oxford blue
      ['#247d58', '#165239'], // emerald cloth
      ['#d49a2a', '#9c6e18'], // ochre buckram
      ['#7b3f8c', '#532761'], // plum folio
      ['#e8dcc4', '#bfb197'], // vellum cream
      ['#1f7a8c', '#134e59'], // slate teal
      ['#b85d28', '#823e17'], // russet calfskin
    ] as const;

    const drawShelfBook = (
      r0: number,
      r1: number,
      baseH: number,
      bookH: number,
      colorIdx: number,
      pulledOut = false,
    ) => {
      const [mainCol, darkCol] = jacketPalette[colorIdx % jacketPalette.length];
      const fFront = pulledOut ? 3.55 : 3.2;
      slab(0.2, fFront, r0, r1, baseH, baseH + bookH, '#f5ebd6', mainCol, darkCol);
      // Gold foil spine band near top
      iso.fillVertQuad(
        fFront + 0.06,
        r0 + 0.15,
        fFront + 0.06,
        r1 - 0.15,
        baseH + bookH - 1.1,
        baseH + bookH - 0.65,
        '#ffd147',
      );
    };

    // Shelf 0 books (left encyclopedia set + right horizontal art-book stack)
    drawShelfBook(-11.4, -9.6, 7.2, 4.9, 0);
    drawShelfBook(-9.5, -7.7, 7.2, 5.0, 1);
    drawShelfBook(-7.6, -5.8, 7.2, 4.7, 2);
    drawShelfBook(-5.7, -3.9, 7.2, 5.1, 5);
    drawShelfBook(-3.8, -2.0, 7.2, 4.8, 4);
    drawShelfBook(-1.9, -0.1, 7.2, 4.5, 7);
    // Horizontal stacked quarto volumes on right of Shelf 0
    slab(0.4, 3.3, 1.4, 10.6, 7.2, 8.7, '#2b6cb0', '#f5ebd6', '#1c4878');
    slab(0.6, 3.2, 2.2, 9.8, 8.7, 10.1, '#c93b4b', '#f5ebd6', '#942432');
    slab(0.8, 3.1, 3.0, 9.0, 10.1, 11.3, '#d49a2a', '#fff7e2', '#9c6e18');

    // Shelf plank 1 (h = 12.6..13.5)
    slab(-3.4, 3.65, -11.9, 11.9, 12.6, 13.5, '#915b34', '#6b4123', '#472a14');

    // 4. Shelf 1 (h = 13.5..18.2): Varied-height novels + angled leaning book & brass bookend
    drawShelfBook(-11.4, -9.7, 13.5, 4.2, 3);
    drawShelfBook(-9.6, -7.9, 13.5, 4.5, 4);
    drawShelfBook(-7.8, -6.1, 13.5, 3.9, 6);
    drawShelfBook(-6.0, -4.3, 13.5, 4.4, 0, isOccupied);
    drawShelfBook(-4.2, -2.5, 13.5, 4.1, 5);
    drawShelfBook(-2.4, -0.8, 13.5, 4.4, 2);
    // Angled leaning book resting toward right brass bookend
    const lb0 = iso.pt(3.25, -0.4, 13.5);
    const lb1 = iso.pt(3.25, 1.3, 13.5);
    const lb2 = iso.pt(3.25, 3.2, 17.5);
    const lb3 = iso.pt(3.25, 1.5, 17.7);
    ctx.beginPath();
    ctx.moveTo(lb0.x, lb0.y);
    ctx.lineTo(lb1.x, lb1.y);
    ctx.lineTo(lb2.x, lb2.y);
    ctx.lineTo(lb3.x, lb3.y);
    ctx.closePath();
    ctx.fillStyle = '#247d58';
    ctx.fill();
    slab(0.6, 3.2, 3.4, 4.5, 13.5, 15.8, '#ffe074', '#d49a2a', '#8c6214');
    drawShelfBook(5.8, 7.6, 13.5, 4.3, 1);
    drawShelfBook(7.7, 9.5, 13.5, 4.0, 7);
    drawShelfBook(9.6, 11.3, 13.5, 4.4, 3);

    // Shelf plank 2 (h = 18.2..19.1)
    slab(-3.4, 3.65, -11.9, 11.9, 18.2, 19.1, '#915b34', '#6b4123', '#472a14');

    // 5. Shelf 2 (h = 19.1..23.8): Dense colorful library row with center walnut divider
    drawShelfBook(-11.4, -9.7, 19.1, 4.3, 1);
    drawShelfBook(-9.6, -7.9, 19.1, 3.8, 5);
    drawShelfBook(-7.8, -6.1, 19.1, 4.4, 2);
    drawShelfBook(-6.0, -4.3, 19.1, 4.1, 7);
    drawShelfBook(-4.2, -2.5, 19.1, 4.5, 0);
    drawShelfBook(-2.4, -0.7, 19.1, 4.0, 3);
    slab(-2.8, 3.4, -0.5, 0.5, 19.1, 23.8, '#875430', '#633b1f', '#422612');
    drawShelfBook(0.8, 2.5, 19.1, 4.2, 6);
    drawShelfBook(2.6, 4.3, 19.1, 4.5, 3);
    drawShelfBook(4.4, 6.1, 19.1, 3.9, 4);
    drawShelfBook(6.2, 7.9, 19.1, 4.3, 1);
    drawShelfBook(8.0, 9.7, 19.1, 4.1, 2);
    drawShelfBook(9.8, 11.4, 19.1, 4.4, 5);

    // Shelf plank 3 (h = 23.8..24.7)
    slab(-3.4, 3.65, -11.9, 11.9, 23.8, 24.7, '#915b34', '#6b4123', '#472a14');

    // 6. Top Shelf 3 (h = 24.7..29.5): Curated leather editions + mini brass globe & succulent planter
    drawShelfBook(-11.3, -9.5, 24.7, 4.2, 4);
    drawShelfBook(-9.4, -7.6, 24.7, 4.5, 0);
    drawShelfBook(-7.5, -5.8, 24.7, 3.9, 3);
    drawShelfBook(-5.7, -3.9, 24.7, 4.3, 6);
    drawShelfBook(-3.8, -2.1, 24.7, 4.1, 1);
    // Mini brass stand + cyan-emerald globe on center-right
    slab(0.8, 2.8, 0.8, 3.6, 24.7, 25.5, '#ffd147', '#c48f24', '#7d5810');
    slab(0.9, 2.9, 1.0, 3.4, 25.5, 28.2, '#5cf0ff', '#249ea8', '#155d66');
    // Ceramic planter + lush green succulent on top right
    slab(0.8, 2.8, 6.8, 10.0, 24.7, 26.5, '#f2ead9', '#d4c8b2', '#9e927d');
    slab(0.9, 2.7, 7.2, 9.6, 26.5, 28.4, '#4ae88a', '#28b562', '#17753d');

    // 7. Overhanging architectural walnut crown cornice + warm brass trim fillet
    slab(-3.9, 4.05, -13.5, 13.5, 29.5, 30.0, '#ffd147', '#c48f24', '#855d12');
    slab(-4.2, 4.4, -13.9, 13.9, 30.0, 31.8, '#945d36', '#6e4324', '#472a15');

    if (isOccupied || night) {
      // Subtle warm library picture-light wash across upper cornice
      const washPt = iso.pt(4.45, 0, 29.8);
      ctx.fillStyle = isOccupied ? 'rgba(255, 218, 128, 0.34)' : 'rgba(255, 209, 112, 0.2)';
      pxRect(ctx, washPt.x - 5.5 * z, washPt.y - 0.6 * z, 11 * z, 1.4 * z);
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
    drawCustomOrPartitionProp(ctx, 'arcade_cabinet', cx, cy, z, timeSec, isOccupied, night, facing);
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

function drawArchitecturalConferenceTable(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cx: number,
  cy: number,
  z: number,
  timeSec: number,
  night: boolean,
  isOccupied: boolean,
  modelAccent: string,
): void {
  const isoPt = (dgx: number, dgy: number, h = 0) => ({
    x: cx + (dgx - dgy) * 32 * z,
    y: cy + (dgx + dgy) * 16 * z - h * z,
  });

  const fillIsoPoly = (
    ptsGrid: ReadonlyArray<{ dgx: number; dgy: number }>,
    h: number,
    fill: string,
    stroke?: string,
    lineW = 0.9,
  ) => {
    if (ptsGrid.length < 3) return;
    ctx.beginPath();
    const p0 = isoPt(ptsGrid[0].dgx, ptsGrid[0].dgy, h);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < ptsGrid.length; i++) {
      const pi = isoPt(ptsGrid[i].dgx, ptsGrid[i].dgy, h);
      ctx.lineTo(pi.x, pi.y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.8, lineW * z);
      ctx.stroke();
    }
  };

  const drawExtrudedSlab = (
    rawPts: ReadonlyArray<{ dgx: number; dgy: number }>,
    hBot: number,
    hTop: number,
    pal: {
      top: string;
      sideLit: string;
      sideMid: string;
      sideDark: string;
      rim: string;
      outline: string;
    },
  ) => {
    if (rawPts.length < 3) return;
    const basePts = rawPts.map((p) => isoPt(p.dgx, p.dgy, 0));
    let area2 = 0;
    for (let i = 0; i < basePts.length; i++) {
      const j = (i + 1) % basePts.length;
      area2 += basePts[i].x * basePts[j].y - basePts[j].x * basePts[i].y;
    }
    const pts = area2 >= 0 ? [...rawPts] : [...rawPts].reverse();
    const scr0 = pts.map((p) => isoPt(p.dgx, p.dgy, 0));

    // Collect camera-facing vertical bevel walls & sort back-to-front (handles U & S concavity seamlessly!)
    const walls: Array<{
      depthY: number;
      aBot: { x: number; y: number };
      bBot: { x: number; y: number };
      bTop: { x: number; y: number };
      aTop: { x: number; y: number };
      col: string;
    }> = [];

    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const dx = scr0[j].x - scr0[i].x;
      const dy = scr0[j].y - scr0[i].y;
      const outX = dy;
      const outY = -dx;
      if (outY > -0.05 * z) {
        const len = Math.max(1e-4, Math.hypot(outX, outY));
        const nx = outX / len;
        const col = nx < -0.22 ? pal.sideLit : nx > 0.22 ? pal.sideDark : pal.sideMid;
        walls.push({
          depthY: (scr0[i].y + scr0[j].y) * 0.5,
          aBot: isoPt(pts[i].dgx, pts[i].dgy, hBot),
          bBot: isoPt(pts[j].dgx, pts[j].dgy, hBot),
          bTop: isoPt(pts[j].dgx, pts[j].dgy, hTop),
          aTop: isoPt(pts[i].dgx, pts[i].dgy, hTop),
          col,
        });
      }
    }

    walls.sort((a, b) => a.depthY - b.depthY);
    for (const w of walls) {
      ctx.beginPath();
      ctx.moveTo(w.aBot.x, w.aBot.y);
      ctx.lineTo(w.bBot.x, w.bBot.y);
      ctx.lineTo(w.bTop.x, w.bTop.y);
      ctx.lineTo(w.aTop.x, w.aTop.y);
      ctx.closePath();
      ctx.fillStyle = w.col;
      ctx.fill();
      ctx.strokeStyle = pal.outline;
      ctx.lineWidth = Math.max(0.75, 0.8 * z);
      ctx.stroke();
    }

    // Unified seamless top surface + inner chamfer highlight
    fillIsoPoly(pts, hTop, pal.top, pal.outline, 0.9);
    fillIsoPoly(pts, hTop, 'rgba(255, 248, 232, 0.04)', pal.rim, 0.75);
  };

  const drawPedestalColumn = (dgx: number, dgy: number, radX = 0.17, radY = 0.17) => {
    const p = isoPt(dgx, dgy, 0);
    // Brushed gunmetal floor footplate + vertical column up to h = 7.6
    const footPts = [
      { dgx: dgx - radX * 1.25, dgy: dgy - radY * 1.25 },
      { dgx: dgx + radX * 1.25, dgy: dgy - radY * 1.25 },
      { dgx: dgx + radX * 1.25, dgy: dgy + radY * 1.25 },
      { dgx: dgx - radX * 1.25, dgy: dgy + radY * 1.25 },
    ];
    drawExtrudedSlab(footPts, 0, 1.2, {
      top: '#4a5670',
      sideLit: '#364057',
      sideMid: '#262e40',
      sideDark: '#171c29',
      rim: 'rgba(210, 226, 255, 0.25)',
      outline: '#0e121c',
    });
    const colPts = [
      { dgx: dgx - radX, dgy: dgy - radY },
      { dgx: dgx + radX, dgy: dgy - radY },
      { dgx: dgx + radX, dgy: dgy + radY },
      { dgx: dgx - radX, dgy: dgy + radY },
    ];
    drawExtrudedSlab(colPts, 1.2, 7.5, {
      top: '#2b344a',
      sideLit: '#354059',
      sideMid: '#232b3d',
      sideDark: '#151a26',
      rim: 'rgba(170, 194, 235, 0.18)',
      outline: '#0d111b',
    });
    // Subtle brushed-brass accent collar at base
    ctx.fillStyle = '#c9a24b';
    pxRect(ctx, p.x - 2.4 * z, p.y - 1.9 * z, 4.8 * z, 0.9 * z);
  };

  const drawSpeakerphone = (dgx: number, dgy: number, hTop: number) => {
    const sp = isoPt(dgx, dgy, hTop);
    const ledCol = isOccupied
      ? Math.sin(timeSec * 5) > 0
        ? '#3be87a'
        : modelAccent
      : '#3cd8ff';
    ctx.fillStyle = '#121724';
    pxRect(ctx, sp.x - 3.6 * z, sp.y - 1.8 * z, 7.2 * z, 3.2 * z);
    ctx.fillStyle = '#263147';
    pxRect(ctx, sp.x - 2.6 * z, sp.y - 2.3 * z, 5.2 * z, 2.2 * z);
    ctx.fillStyle = ledCol;
    pxRect(ctx, sp.x - 1.1 * z, sp.y - 1.5 * z, 2.2 * z, 1.0 * z);
  };

  const drawFolioAndCup = (
    dgx: number,
    dgy: number,
    hTop: number,
    accent: string,
    withCup = true,
  ) => {
    const fp = isoPt(dgx, dgy, hTop);
    // Leather meeting notepad + crisp white agenda sheet + accent header
    ctx.fillStyle = '#1b2233';
    pxRect(ctx, fp.x - 3.2 * z, fp.y - 1.8 * z, 6.2 * z, 3.6 * z);
    ctx.fillStyle = '#f4f7ff';
    pxRect(ctx, fp.x - 2.4 * z, fp.y - 1.3 * z, 4.6 * z, 2.6 * z);
    ctx.fillStyle = accent;
    pxRect(ctx, fp.x - 2.0 * z, fp.y - 0.9 * z, 3.2 * z, 0.8 * z);
    if (withCup) {
      ctx.fillStyle = '#ffffff';
      pxRect(ctx, fp.x + 3.8 * z, fp.y - 2.2 * z, 2.3 * z, 2.4 * z);
      ctx.fillStyle = '#6e381d';
      pxRect(ctx, fp.x + 4.2 * z, fp.y - 2.1 * z, 1.5 * z, 0.8 * z);
    }
  };

  const woodWalnut = night
    ? {
        top: '#8c5a35',
        sideLit: '#734727',
        sideMid: '#59351c',
        sideDark: '#3d2210',
        rim: 'rgba(255, 224, 182, 0.28)',
        outline: '#1a110b',
      }
    : {
        top: '#b5794a',
        sideLit: '#966038',
        sideMid: '#784a29',
        sideDark: '#54321a',
        rim: 'rgba(255, 238, 210, 0.36)',
        outline: '#24160d',
      };

  const woodTeak = night
    ? {
        top: '#966b43',
        sideLit: '#7a5534',
        sideMid: '#5e4026',
        sideDark: '#422b18',
        rim: 'rgba(255, 232, 196, 0.28)',
        outline: '#1c130c',
      }
    : {
        top: '#c4905e',
        sideLit: '#a37447',
        sideMid: '#825a35',
        sideDark: '#5e3f23',
        rim: 'rgba(255, 244, 220, 0.38)',
        outline: '#26190e',
      };

  const woodMaple = night
    ? {
        top: '#9e8260',
        sideLit: '#82694c',
        sideMid: '#665139',
        sideDark: '#473826',
        rim: 'rgba(255, 240, 214, 0.30)',
        outline: '#1c1610',
      }
    : {
        top: '#d4b38a',
        sideLit: '#b3936d',
        sideMid: '#8f7352',
        sideDark: '#695238',
        rim: 'rgba(255, 250, 235, 0.42)',
        outline: '#292015',
      };

  const hBot = 7.4;
  const hTop = 10.4;

  if (kind === 'war_table_oval') {
    // BP0: 2x1 Seamless Racetrack / Oval Executive Table spanning (0,0)..(1,0), center (+0.5, -0.03)
    const ovalPts: Array<{ dgx: number; dgy: number }> = [];
    const inlayPts: Array<{ dgx: number; dgy: number }> = [];
    const steps = 28;
    const cGx = 0.5;
    const cGy = -0.03;
    for (let i = 0; i < steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      // Superellipse exponent 0.84 creates a true architectural stadium/oval racetrack silhouette
      const sx = Math.sign(c) * Math.pow(Math.abs(c), 0.84);
      const sy = Math.sign(s) * Math.pow(Math.abs(s), 0.88);
      ovalPts.push({ dgx: cGx + 1.02 * sx, dgy: cGy + 0.43 * sy });
      inlayPts.push({ dgx: cGx + 0.56 * sx, dgy: cGy + 0.19 * sy });
    }
    fillIsoPoly(
      ovalPts.map((p) => ({ dgx: cGx + (p.dgx - cGx) * 1.05, dgy: cGy + (p.dgy - cGy) * 1.08 })),
      0,
      'rgba(7, 10, 20, 0.28)',
    );
    drawPedestalColumn(0.06, cGy, 0.16, 0.15);
    drawPedestalColumn(0.94, cGy, 0.16, 0.15);
    drawExtrudedSlab(ovalPts, hBot, hTop, woodWalnut);
    // Dark slate leather center racetrack inlay + brass pinstripe
    fillIsoPoly(inlayPts, hTop + 0.05, '#1d2536', '#c9a24b', 0.8);
    drawSpeakerphone(0.5, cGy, hTop + 0.1);
    drawFolioAndCup(-0.12, 0.18, hTop + 0.1, '#3cd8ff', true);
    drawFolioAndCup(0.82, 0.18, hTop + 0.1, '#ffd147', false);
    drawFolioAndCup(1.08, -0.18, hTop + 0.1, '#ff7eb9', true);
  } else if (kind === 'war_table_round') {
    // BP1: Grand Circular Collaboration Table centered at (+0.5, -0.03), proportioned to 7 radial seats
    const roundPts: Array<{ dgx: number; dgy: number }> = [];
    const hubPts: Array<{ dgx: number; dgy: number }> = [];
    const steps = 28;
    const cGx = 0.5;
    const cGy = -0.03;
    const rxOuter = 0.88;
    const ryOuter = 0.64;
    const rxHub = 0.31;
    const ryHub = 0.23;
    for (let i = 0; i < steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      roundPts.push({ dgx: cGx + rxOuter * Math.cos(th), dgy: cGy + ryOuter * Math.sin(th) });
      hubPts.push({ dgx: cGx + rxHub * Math.cos(th), dgy: cGy + ryHub * Math.sin(th) });
    }
    fillIsoPoly(
      roundPts.map((p) => ({ dgx: cGx + (p.dgx - cGx) * 1.06, dgy: cGy + (p.dgy - cGy) * 1.06 })),
      0,
      'rgba(7, 10, 20, 0.28)',
    );
    // Sculpted central drum pedestal
    drawPedestalColumn(cGx, cGy, 0.26, 0.24);
    drawExtrudedSlab(roundPts, hBot, hTop, woodTeak);

    // Subtle radial 8-segment veneer grain lines
    ctx.strokeStyle = 'rgba(72, 44, 22, 0.28)';
    ctx.lineWidth = Math.max(0.7, 0.8 * z);
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const pIn = isoPt(cGx + rxHub * Math.cos(ang), cGy + ryHub * Math.sin(ang), hTop + 0.04);
      const pOut = isoPt(
        cGx + (rxOuter - 0.05) * Math.cos(ang),
        cGy + (ryOuter - 0.05) * Math.sin(ang),
        hTop + 0.04,
      );
      ctx.beginPath();
      ctx.moveTo(pIn.x, pIn.y);
      ctx.lineTo(pOut.x, pOut.y);
      ctx.stroke();
    }

    // Recessed dark slate center AV turntable + 360° mic hub + radial folios
    fillIsoPoly(hubPts, hTop + 0.06, '#1b2334', '#d4ad55', 0.85);
    drawSpeakerphone(cGx, cGy, hTop + 0.12);
    drawFolioAndCup(cGx - 0.48, cGy + 0.14, hTop + 0.1, '#3cd8ff', false);
    drawFolioAndCup(cGx + 0.08, cGy + 0.38, hTop + 0.1, '#3be87a', true);
    drawFolioAndCup(cGx + 0.50, cGy - 0.12, hTop + 0.1, '#ffd147', true);
  } else if (kind === 'war_table_rect' || kind === 'war_table') {
    // BP2: 3x1 Executive Boatboard Rectangular Table spanning (0,0)..(2,0) (or compact single-anchor fallback for bare 'war_table')
    const isLong = kind === 'war_table_rect';
    const xMin = isLong ? -0.52 : -0.52;
    const xMax = isLong ? 2.48 : 0.52;
    const xMid = (xMin + xMax) * 0.5;
    const yBackEnd = -0.43;
    const yBackMid = isLong ? -0.50 : -0.47;
    const yFrontEnd = 0.36;
    const yFrontMid = isLong ? 0.42 : 0.40;
    const rectPts: Array<{ dgx: number; dgy: number }> = [
      { dgx: xMin, dgy: yBackEnd + 0.06 },
      { dgx: xMin + 0.08, dgy: yBackEnd },
      { dgx: xMid, dgy: yBackMid },
      { dgx: xMax - 0.08, dgy: yBackEnd },
      { dgx: xMax, dgy: yBackEnd + 0.06 },
      { dgx: xMax, dgy: yFrontEnd - 0.06 },
      { dgx: xMax - 0.08, dgy: yFrontEnd },
      { dgx: xMid, dgy: yFrontMid },
      { dgx: xMin + 0.08, dgy: yFrontEnd },
      { dgx: xMin, dgy: yFrontEnd - 0.06 },
    ];
    fillIsoPoly(
      rectPts.map((p) => ({ dgx: xMid + (p.dgx - xMid) * 1.03, dgy: p.dgy * 1.08 })),
      0,
      'rgba(7, 10, 20, 0.28)',
    );
    if (isLong) {
      drawPedestalColumn(0.20, -0.03, 0.18, 0.16);
      drawPedestalColumn(1.80, -0.03, 0.18, 0.16);
    } else {
      drawPedestalColumn(0, -0.03, 0.2, 0.18);
    }
    drawExtrudedSlab(rectPts, hBot, hTop, woodWalnut);

    // Recessed brushed-anthracite AV cable hatch spine
    const hatchHalf = isLong ? 0.88 : 0.26;
    const ySpine = -0.04;
    fillIsoPoly(
      [
        { dgx: xMid - hatchHalf, dgy: ySpine - 0.10 },
        { dgx: xMid + hatchHalf, dgy: ySpine - 0.10 },
        { dgx: xMid + hatchHalf, dgy: ySpine + 0.10 },
        { dgx: xMid - hatchHalf, dgy: ySpine + 0.10 },
      ],
      hTop + 0.05,
      '#1a2233',
      '#6d7f9e',
      0.75,
    );
    if (isLong) {
      drawSpeakerphone(0.46, ySpine, hTop + 0.1);
      drawSpeakerphone(1.52, ySpine, hTop + 0.1);
      drawFolioAndCup(0.02, 0.20, hTop + 0.1, '#3cd8ff', true);
      drawFolioAndCup(0.98, 0.22, hTop + 0.1, '#ffd147', false);
      drawFolioAndCup(1.92, 0.20, hTop + 0.1, '#3be87a', true);
      drawFolioAndCup(1.35, -0.28, hTop + 0.1, '#ff7eb9', false);
    } else {
      drawSpeakerphone(0, ySpine, hTop + 0.1);
      drawFolioAndCup(-0.22, 0.18, hTop + 0.1, '#ffd147', true);
    }
  } else if (kind === 'war_table_u') {
    // BP3: 5-Tile Architectural U-Shaped Strategy Table anchored at (9,3)=(0,0), open toward -dgy (NE SWARM BOARD)
    // Covers left wing (-1,-1)..(-1,0), base (-1,0)..(1,0), right wing (1,-1)..(1,0); tile (0,-1) stays 100% open!
    const uPts: Array<{ dgx: number; dgy: number }> = [
      { dgx: -1.46, dgy: -1.42 },
      { dgx: -0.58, dgy: -1.42 },
      { dgx: -0.58, dgy: -0.38 },
      { dgx: 0.58, dgy: -0.38 },
      { dgx: 0.58, dgy: -1.42 },
      { dgx: 1.44, dgy: -1.42 },
      { dgx: 1.44, dgy: 0.38 },
      { dgx: -1.46, dgy: 0.38 },
    ];
    fillIsoPoly(uPts, 0, 'rgba(7, 10, 20, 0.26)');
    drawPedestalColumn(-1.02, -1.06, 0.15, 0.15);
    drawPedestalColumn(-1.02, 0.0, 0.15, 0.15);
    drawPedestalColumn(0.0, 0.0, 0.16, 0.15);
    drawPedestalColumn(1.01, 0.0, 0.15, 0.15);
    drawPedestalColumn(1.01, -1.06, 0.15, 0.15);

    drawExtrudedSlab(uPts, hBot, hTop, woodTeak);

    // Continuous U-shaped dark leather conference blotter inlay along all 3 wings
    const uInlay: Array<{ dgx: number; dgy: number }> = [
      { dgx: -1.16, dgy: -1.22 },
      { dgx: -0.86, dgy: -1.22 },
      { dgx: -0.86, dgy: -0.14 },
      { dgx: 0.86, dgy: -0.14 },
      { dgx: 0.86, dgy: -1.22 },
      { dgx: 1.15, dgy: -1.22 },
      { dgx: 1.15, dgy: 0.14 },
      { dgx: -1.16, dgy: 0.14 },
    ];
    fillIsoPoly(uInlay, hTop + 0.05, '#1c2538', '#c9a24b', 0.75);

    // Delegate gooseneck microphones with glowing live indicator LEDs + folios
    const micPositions: Array<[number, number]> = [
      [-1.02, -0.96],
      [-1.02, -0.22],
      [-0.55, 0.02],
      [0.0, 0.02],
      [0.55, 0.02],
      [1.02, -0.22],
      [1.02, -0.96],
    ];
    const micLed = isOccupied ? '#3be87a' : '#3cd8ff';
    for (const [mgx, mgy] of micPositions) {
      const mp = isoPt(mgx, mgy, hTop + 0.1);
      ctx.fillStyle = '#101522';
      pxRect(ctx, mp.x - 1.4 * z, mp.y - 1.0 * z, 2.8 * z, 1.6 * z);
      ctx.fillStyle = micLed;
      pxRect(ctx, mp.x - 0.6 * z, mp.y - 2.4 * z, 1.2 * z, 1.4 * z);
    }
    drawFolioAndCup(-1.08, -0.62, hTop + 0.1, '#3cd8ff', false);
    drawFolioAndCup(0.0, 0.15, hTop + 0.1, '#ffd147', true);
    drawFolioAndCup(1.06, -0.62, hTop + 0.1, '#ff7eb9', true);
  } else if (kind === 'war_table_s') {
    // BP4: Sculpted Serpentine S-Wave Creative Studio Table spanning (0,0)..(1,0)
    // End-caps add +-halfW along tangent, so spine [-0.20, +1.18] + halfW=0.31 spans [-0.51, +1.49] cleanly inside chair ring
    const spineSamples = 18;
    const halfW = 0.31;
    const spine = (t: number) => {
      const dgx = -0.20 + 1.38 * t;
      const dgy = -0.04 + 0.16 * Math.sin(t * Math.PI * 2);
      const dgxDt = 1.38;
      const dgyDt = 0.16 * Math.PI * 2 * Math.cos(t * Math.PI * 2);
      const len = Math.hypot(dgxDt, dgyDt);
      return { dgx, dgy, nx: -dgyDt / len, ny: dgxDt / len };
    };

    const upperEdge: Array<{ dgx: number; dgy: number }> = [];
    const lowerEdge: Array<{ dgx: number; dgy: number }> = [];
    const ribbonUpper: Array<{ dgx: number; dgy: number }> = [];
    const ribbonLower: Array<{ dgx: number; dgy: number }> = [];
    for (let i = 0; i <= spineSamples; i++) {
      const s = spine(i / spineSamples);
      upperEdge.push({ dgx: s.dgx + s.nx * halfW, dgy: s.dgy + s.ny * halfW });
      lowerEdge.push({ dgx: s.dgx - s.nx * halfW, dgy: s.dgy - s.ny * halfW });
      ribbonUpper.push({ dgx: s.dgx + s.nx * 0.08, dgy: s.dgy + s.ny * 0.08 });
      ribbonLower.push({ dgx: s.dgx - s.nx * 0.08, dgy: s.dgy - s.ny * 0.08 });
    }

    // Smooth rounded end-caps at t = 1 and t = 0
    const sEnd = spine(1);
    const sStart = spine(0);
    const sPts: Array<{ dgx: number; dgy: number }> = [...upperEdge];
    for (let c = 1; c < 5; c++) {
      const a = (c / 5) * Math.PI;
      const tx = -sEnd.ny;
      const ty = sEnd.nx;
      sPts.push({
        dgx: sEnd.dgx + (Math.cos(a) * sEnd.nx + Math.sin(a) * tx) * halfW,
        dgy: sEnd.dgy + (Math.cos(a) * sEnd.ny + Math.sin(a) * ty) * halfW,
      });
    }
    for (let i = lowerEdge.length - 1; i >= 0; i--) {
      sPts.push(lowerEdge[i]);
    }
    for (let c = 1; c < 5; c++) {
      const a = (c / 5) * Math.PI;
      const tx = sStart.ny;
      const ty = -sStart.nx;
      sPts.push({
        dgx: sStart.dgx + (-Math.cos(a) * sStart.nx + Math.sin(a) * tx) * halfW,
        dgy: sStart.dgy + (-Math.cos(a) * sStart.ny + Math.sin(a) * ty) * halfW,
      });
    }

    fillIsoPoly(sPts, 0, 'rgba(7, 10, 20, 0.27)');
    const legA = spine(0.14);
    const legB = spine(0.5);
    const legC = spine(0.86);
    drawPedestalColumn(legA.dgx, legA.dgy, 0.14, 0.14);
    drawPedestalColumn(legB.dgx, legB.dgy, 0.15, 0.15);
    drawPedestalColumn(legC.dgx, legC.dgy, 0.14, 0.14);

    drawExtrudedSlab(sPts, hBot, hTop, woodMaple);

    // Sculpted S-curve indigo-slate inlay ribbon flowing down the center spine
    const ribbonPts = [...ribbonUpper, ...ribbonLower.reverse()];
    fillIsoPoly(ribbonPts, hTop + 0.05, '#22304a', '#5cf0ff', 0.7);

    drawSpeakerphone(legB.dgx, legB.dgy, hTop + 0.1);
    drawFolioAndCup(legA.dgx - 0.04, legA.dgy + 0.12, hTop + 0.1, '#e040fb', true);
    drawFolioAndCup(legC.dgx + 0.04, legC.dgy - 0.12, hTop + 0.1, '#00e5ff', true);
  }
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
  const dir = facing === 'SW' || facing === 'NW' || facing === 'W' ? -1 : 1;
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
 * Draws XP/level-based desk upgrades on top of dev_desk, clover_desk, qa_desk, or exec_desk
 * across all 4 cardinal/isometric orientations (`NE`, `NW`, `SE`, `SW`):
 * - Lv3+: Dual monitor / ultrawide telemetry upgrade
 * - Lv5+: Desk succulent plant & steaming coffee mug
 * - Lv8+: 24k-gold mechanical keyboard & golden trophy
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
  facing: ChairFacing = 'NE',
): void {
  if (level < 3) return;
  const z = zoom;
  const isExec = kind === 'exec_desk';
  const isQa = kind === 'qa_desk';
  const dir = normalizeCardFacing(facing, isExec ? 'SE' : 'NE');
  const isMonitorFront = dir === 'NE' || dir === 'NW';
  const iso = createCardIsoPainter(ctx, cx, cy, z, dir);
  const hTop = isExec ? 11.6 : 11.2;

  ctx.save();

  // Lv3+: Secondary companion display / monitor lightbar upgrade
  if (isQa) {
    const mTop = isMonitorFront ? hTop + 7.6 : hTop + 5.4;
    iso.drawSlab(iso.boxPts(4.8, 5.9, 4.4, 11.4), hTop + 1.1, mTop, {
      top: '#2a3347',
      sideLit: '#1e2536',
      sideMid: '#151a26',
      sideDark: '#0e121b',
      outline: '#090c14',
    });
    if (isMonitorFront) {
      iso.fillVertQuad(4.74, 5.2, 4.74, 10.6, hTop + 1.8, mTop - 0.7, isOccupied ? '#152840' : '#1b2336');
      iso.fillVertQuad(
        4.7,
        5.8,
        4.7,
        10.0,
        mTop - 2.2,
        mTop - 1.2,
        isOccupied ? '#3cd8ff' : '#2f415e',
      );
    } else {
      iso.fillVertQuad(5.96, 5.8, 5.96, 10.0, hTop + 3.2, hTop + 3.9, isOccupied ? '#3cd8ff' : '#475675');
    }
  } else if (isExec) {
    // Sleek low-profile brass-trimmed market ticker module on inner left wing (never enters central face sightline!)
    iso.drawSlab(iso.boxPts(2.4, 3.8, -16.8, -11.6), hTop, hTop + 2.4, {
      top: '#293247',
      sideLit: '#c9a24b',
      sideMid: '#1a2030',
      sideDark: '#101420',
      outline: '#090c14',
    });
    const pTick = iso.pt(3.1, -14.2, hTop + 2.45);
    ctx.fillStyle = isOccupied ? '#3cd8ff' : '#3a4c6e';
    pxRect(ctx, pTick.x - 1.8 * z, pTick.y - 0.5 * z, 3.6 * z, 0.9 * z);
  } else {
    // Ultrawide status lightbars perched atop both left & right coding monitors
    const barH = (isMonitorFront ? hTop + 8.6 : hTop + 5.8) + 0.08;
    const barCol = isOccupied ? '#3be87a' : '#2a3954';
    iso.fillPoly(iso.boxPts(4.8, 5.8, -9.8, -2.8), barH, barCol);
    iso.fillPoly(iso.boxPts(4.8, 5.8, 2.8, 9.8), barH, barCol);
  }

  // Lv5+: Mini terracotta succulent pot (-r corner) & warm rising steam wisps above mug
  if (level >= 5) {
    const pPlant = iso.pt(3.4, isExec ? -16.8 : -11.6, hTop);
    ctx.fillStyle = '#a65c3a';
    pxRect(ctx, pPlant.x - 2.1 * z, pPlant.y - 2.8 * z, 4.2 * z, 2.8 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, pPlant.x - 2.8 * z, pPlant.y - 5.6 * z, 5.6 * z, 3.0 * z);
    ctx.fillStyle = '#7efaa8';
    pxRect(ctx, pPlant.x - 1.4 * z, pPlant.y - 7.0 * z, 2.8 * z, 1.6 * z);

    const pMug = iso.pt(-5.6, isExec ? 12.2 : -10.8, hTop + 3.4);
    const steamDrift = ((timeSec * 4) % 3.6) * z;
    ctx.fillStyle = 'rgba(220, 240, 255, 0.72)';
    pxRect(ctx, pMug.x - 0.9 * z, pMug.y - 1.8 * z - steamDrift, 1.8 * z, 1.8 * z);
  }

  // Lv8+: Shimmering 24k-gold mechanical keyboard & golden prestige trophy (+r corner)
  if (level >= 8) {
    const shimmer = Math.sin(timeSec * 4) > 0.3 ? '#fff3a1' : '#ffd147';
    iso.fillPoly(
      iso.boxPts(isExec ? -10.2 : -9.4, isExec ? -7.0 : -5.6, -5.8, 3.0),
      hTop + 0.2,
      '#b8860b',
    );
    iso.fillPoly(
      iso.boxPts(isExec ? -9.5 : -8.6, isExec ? -7.6 : -6.6, -5.0, 2.2),
      hTop + 0.25,
      shimmer,
    );

    const pTrophy = iso.pt(2.6, isExec ? 16.4 : 11.2, hTop);
    ctx.fillStyle = '#8c6211';
    pxRect(ctx, pTrophy.x - 1.9 * z, pTrophy.y - 1.6 * z, 3.8 * z, 1.6 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, pTrophy.x - 0.9 * z, pTrophy.y - 4.4 * z, 1.8 * z, 2.9 * z);
    pxRect(ctx, pTrophy.x - 2.6 * z, pTrophy.y - 6.8 * z, 5.2 * z, 2.6 * z);
    ctx.fillStyle = shimmer;
    pxRect(ctx, pTrophy.x - 1.2 * z, pTrophy.y - 6.5 * z, 1.8 * z, 1.6 * z);
  }

  ctx.restore();
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
 * Draws a gleaming miniature golden verified trophy & emerald seal on the flank
 * corner of a desk when its assigned agent has verified task output (`isVerifiedOutput`),
 * rotating cleanly with `facing` (`NE` | `NW` | `SE` | `SW`).
 */
export function drawDeskVerifiedTrophy(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  zoom: number,
  timeSec: number,
  facing: ChairFacing = 'NE',
): void {
  const z = zoom;
  const dir = normalizeCardFacing(facing, 'NE');
  const { fwd, right } = getCardIsoBasis(dir);
  const fLocal = 0.6;
  const rLocal = -11.6;
  const hLocal = 11.4;
  const tx = sx + (fLocal * fwd.x + rLocal * right.x) * z;
  const ty = sy + (fLocal * fwd.y + rLocal * right.y - hLocal) * z;
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
    pxRect(ctx, vxOrWx(wx - 0.6 * z), by - 1 * z, 3.6 * z, 4 * z);
    ctx.fillStyle = Math.sin(timeSec * 4.5) > 0 ? '#ff5666' : '#ffbe3b';
    pxRect(ctx, wx, by - 0.4 * z, 2.4 * z, 2.8 * z);
  }

  ctx.restore();
}

function vxOrWx(v: number): number {
  return v;
}

/**
 * Draws an isometric royal-emerald casino felt mat, 3D draw deck, face-up discard pile,
 * poker chip stacks, 4 directional fanned mini-hands, and an animated dealt card
 * directly onto a War Room conference table or Coffee Lounge table surface.
 */
export function drawCardGameTableOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  timeSec: number,
  tableKind?: string,
): void {
  const z = zoom;
  const isWarTable = Boolean(tableKind && tableKind.startsWith('war_table'));
  // OfficeCanvas passes `y = tableScreenY - 6 * zoom`; subtracting ~4.2*z lands flush on both war_table (~9.2*z) & lounge_table (~11.2*z)
  const topY = y - (isWarTable ? 3.8 : 4.2) * z;
  const hw = (isWarTable ? 14.8 : 11.4) * z;
  const hh = (isWarTable ? 6.4 : 4.2) * z;
  const scale = isWarTable ? 1.18 : 0.94;

  const drawCardMini = (
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    faceUp: boolean,
    isRedPip: boolean,
  ) => {
    ctx.fillStyle = '#121826';
    pxRect(ctx, cx - 0.5 * z, cy - 0.5 * z, cw + 1 * z, ch + 1 * z);
    ctx.fillStyle = '#fffdf7';
    pxRect(ctx, cx, cy, cw, ch);
    if (faceUp) {
      ctx.fillStyle = isRedPip ? '#e63946' : '#182030';
      pxRect(
        ctx,
        cx + cw * 0.34,
        cy + ch * 0.28,
        Math.max(0.9 * z, cw * 0.32),
        Math.max(0.9 * z, ch * 0.42),
      );
    } else {
      ctx.fillStyle = '#c92a3e';
      pxRect(
        ctx,
        cx + 0.45 * z,
        cy + 0.45 * z,
        Math.max(0.8 * z, cw - 0.9 * z),
        Math.max(0.8 * z, ch - 0.9 * z),
      );
      ctx.fillStyle = '#ffd147';
      pxRect(ctx, cx + cw * 0.38, cy + ch * 0.35, 0.8 * z, 0.8 * z);
    }
  };

  const drawChipStack = (sx: number, sy: number, layers: string[]) => {
    ctx.fillStyle = 'rgba(8, 12, 20, 0.42)';
    pxRect(ctx, sx - 0.3 * z, sy + 0.5 * z, 2.6 * z, 1.4 * z);
    for (let i = 0; i < layers.length; i++) {
      const ly = sy - i * 0.75 * z;
      ctx.fillStyle = '#141a29';
      pxRect(ctx, sx - 0.35 * z, ly - 0.35 * z, 2.7 * z, 1.7 * z);
      ctx.fillStyle = layers[i];
      pxRect(ctx, sx, ly, 2.0 * z, 1.1 * z);
      ctx.fillStyle = '#fffdf7';
      pxRect(ctx, sx + 0.65 * z, ly + 0.25 * z, 0.7 * z, 0.55 * z);
    }
  };

  ctx.save();

  // 1. Subtle tabletop drop shadow beneath felt mat
  ctx.fillStyle = 'rgba(6, 12, 18, 0.34)';
  ctx.beginPath();
  ctx.moveTo(x, topY - hh - 0.6 * z);
  ctx.lineTo(x + hw + 1.4 * z, topY + 0.4 * z);
  ctx.lineTo(x, topY + hh + 1.4 * z);
  ctx.lineTo(x - hw - 1.4 * z, topY + 0.4 * z);
  ctx.closePath();
  ctx.fill();

  // 2. Beveled brass/gold outer frame + royal-emerald casino felt diamond
  ctx.fillStyle = '#b98d32';
  ctx.beginPath();
  ctx.moveTo(x, topY - hh - 0.7 * z);
  ctx.lineTo(x + hw + 1.0 * z, topY);
  ctx.lineTo(x, topY + hh + 0.7 * z);
  ctx.lineTo(x - hw - 1.0 * z, topY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#135c3b';
  ctx.beginPath();
  ctx.moveTo(x, topY - hh);
  ctx.lineTo(x + hw, topY);
  ctx.lineTo(x, topY + hh);
  ctx.lineTo(x - hw, topY);
  ctx.closePath();
  ctx.fill();

  // Lit inner felt sheen + gold pin-line diamond
  ctx.fillStyle = '#1b7a4f';
  ctx.beginPath();
  ctx.moveTo(x, topY - hh * 0.78);
  ctx.lineTo(x + hw * 0.78, topY);
  ctx.lineTo(x, topY + hh * 0.78);
  ctx.lineTo(x - hw * 0.78, topY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 214, 102, 0.55)';
  ctx.lineWidth = Math.max(1, 0.75 * z);
  ctx.beginPath();
  ctx.moveTo(x, topY - hh * 0.84);
  ctx.lineTo(x + hw * 0.84, topY);
  ctx.lineTo(x, topY + hh * 0.84);
  ctx.lineTo(x - hw * 0.84, topY);
  ctx.closePath();
  ctx.stroke();

  // 3. Central 3D Draw Deck Stack (left-center)
  const deckX = x - 3.4 * scale * z;
  const deckY = topY - 1.2 * scale * z;
  const cardW = 3.2 * scale * z;
  const cardH = 2.2 * scale * z;
  ctx.fillStyle = '#0e1422';
  pxRect(ctx, deckX - 0.5 * z, deckY - 0.4 * z, cardW + 1 * z, cardH + 2.1 * z);
  // Crisp white/silver stacked deck thickness
  ctx.fillStyle = '#cfd8ea';
  pxRect(ctx, deckX, deckY + 0.9 * z, cardW, cardH + 0.3 * z);
  ctx.fillStyle = '#eef3fc';
  pxRect(ctx, deckX, deckY + 0.45 * z, cardW, cardH);
  // Top crimson-and-gold card back
  drawCardMini(deckX, deckY - 0.35 * z, cardW, cardH, false, true);

  // 4. Face-Up Discard Pile (right-center, alternating suit color over time)
  const discX = x + 0.9 * scale * z;
  const discY = topY - 0.9 * scale * z;
  drawCardMini(discX - 0.45 * z, discY + 0.35 * z, cardW, cardH, true, false);
  const topDiscardRed = Math.floor(timeSec * 0.6) % 2 === 0;
  drawCardMini(discX + 0.25 * z, discY - 0.25 * z, cardW, cardH, true, topDiscardRed);

  // 5. Four directional mini fanned hands near NW, NE, SE, SW edges
  const handW = 2.3 * scale * z;
  const handH = 1.65 * scale * z;
  const seatHands: Array<{ dx: number; dy: number; faceUp: boolean; red: boolean }> = [
    { dx: -hw * 0.46, dy: -hh * 0.38, faceUp: false, red: true },
    { dx: hw * 0.34, dy: -hh * 0.4, faceUp: false, red: false },
    { dx: hw * 0.32, dy: hh * 0.26, faceUp: true, red: true },
    { dx: -hw * 0.48, dy: hh * 0.24, faceUp: true, red: false },
  ];
  for (const h of seatHands) {
    drawCardMini(x + h.dx - 0.7 * z, topY + h.dy + 0.2 * z, handW, handH, h.faceUp, !h.red);
    drawCardMini(x + h.dx + 0.6 * z, topY + h.dy - 0.2 * z, handW, handH, h.faceUp, h.red);
  }

  // 6. Stacked Poker Chips (crimson, cyan, gold)
  drawChipStack(x - hw * 0.56, topY - 0.3 * z, ['#e63946', '#e63946', '#ffd147']);
  drawChipStack(x + hw * 0.42, topY - 0.5 * z, ['#3cd8ff', '#ffd147']);

  // 7. Animated dealt card gliding smoothly from draw deck toward active player quadrant
  const dealCycle = ((timeSec * 0.85) % 4 + 4) % 4;
  const targetIdx = Math.floor(dealCycle);
  const frac = dealCycle - targetIdx;
  if (frac < 0.68) {
    const t = frac / 0.68;
    const ease = 1 - (1 - t) * (1 - t);
    const target = seatHands[targetIdx];
    const flyX = deckX + (x + target.dx - deckX) * ease;
    const flyY = deckY + (topY + target.dy - deckY) * ease - Math.sin(t * Math.PI) * 1.8 * z;
    drawCardMini(flyX, flyY, handW, handH, false, true);
  }

  ctx.restore();
}
