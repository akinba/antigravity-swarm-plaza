import type { ModelFamily, OfficeEmployee, OfficeZone } from '../../shared/types';
import { TILE_H, TILE_W } from './isoMath';
import type { Facing } from './pathfinding';

export interface Palette {
  skin: string;
  skinShadow: string;
  hair: string;
  hairHighlight: string;
}

const SKIN_PALETTES: Array<{ skin: string; skinShadow: string }> = [
  { skin: '#fbdcc4', skinShadow: '#dfb08c' },
  { skin: '#f1c29b', skinShadow: '#cc9366' },
  { skin: '#d89b6e', skinShadow: '#b17148' },
  { skin: '#a86b43', skinShadow: '#7f4c2c' },
  { skin: '#6e4229', skinShadow: '#4d2b18' },
];

const HAIR_PALETTES: Array<{ hair: string; hairHighlight: string }> = [
  { hair: '#231b19', hairHighlight: '#473834' },
  { hair: '#5a351f', hairHighlight: '#835132' },
  { hair: '#c98838', hairHighlight: '#ebb463' },
  { hair: '#b63e2e', hairHighlight: '#e06350' },
  { hair: '#384b78', hairHighlight: '#5f78b3' },
  { hair: '#8d96ad', hairHighlight: '#bec6db' },
];

export const UNIFORM_COLORS: Record<
  ModelFamily,
  { main: string; dark: string; trim: string; badge: string }
> = {
  argon: { main: '#6f3cc4', dark: '#472185', trim: '#ffd147', badge: 'ARGON' },
  hydrogen: { main: '#1e90b8', dark: '#115873', trim: '#7ef3ff', badge: 'HYDRO' },
  flash: { main: '#1fa368', dark: '#11633f', trim: '#ffe64d', badge: 'FLASH' },
  carbon: { main: '#b82e43', dark: '#751827', trim: '#f2f5ff', badge: 'CARBON' },
  other: { main: '#4654a3', dark: '#2a336b', trim: '#b7c4ff', badge: 'AGENT' },
};

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getEmployeePalette(employeeId: string): Palette {
  const h = hashString(employeeId);
  const skin = SKIN_PALETTES[h % SKIN_PALETTES.length];
  const hair = HAIR_PALETTES[(h >>> 4) % HAIR_PALETTES.length];
  return { ...skin, ...hair };
}

/** Draws a 2:1 isometric diamond tile centered at (cx, cy) top-center vertex? No, centered at (cx, cy) */
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

export function drawFloorTile(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  gx: number,
  gy: number,
  zone: OfficeZone,
  zoom: number,
  isNight: boolean,
): void {
  const hw = (TILE_W / 2) * zoom;
  const hh = (TILE_H / 2) * zoom;
  const checker = (gx + gy) % 2 === 0;

  let fill = '#3b4259';
  let stroke = '#282d3d';

  if (zone === 'DESK_ARCHITECT' || zone === 'COFFEE_LOUNGE') {
    fill = checker ? (isNight ? '#63452f' : '#a87849') : isNight ? '#563b28' : '#996c40';
    stroke = isNight ? '#362316' : '#6e4b2b';
  } else if (zone === 'DESK_CODING' || zone === 'DESK_QA') {
    fill = checker ? (isNight ? '#4b4658' : '#cfc6b4') : isNight ? '#433e50' : '#c4baa6';
    stroke = isNight ? '#332f3d' : '#a89e8c';
  } else if (zone === 'SERVER_RACK') {
    fill = checker ? '#1b2233' : '#161c2b';
    stroke = '#293954';
  } else if (zone === 'WAR_ROOM') {
    fill = checker ? (isNight ? '#1e3152' : '#2e4f82') : isNight ? '#192945' : '#284573';
    stroke = isNight ? '#2c4673' : '#4a73b0';
  }

  isoDiamondPath(ctx, cx, cy, hw, hh);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1, zoom);
  ctx.strokeStyle = stroke;
  ctx.stroke();

  // Subtle wood plank / server grid accent
  if (zone === 'DESK_ARCHITECT' || zone === 'COFFEE_LOUNGE') {
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.45, cy - hh * 0.05);
    ctx.lineTo(cx + hw * 0.45, cy + hh * 0.05);
    ctx.strokeStyle = isNight ? 'rgba(0,0,0,0.22)' : 'rgba(60,30,10,0.22)';
    ctx.stroke();
  } else if (zone === 'SERVER_RACK') {
    ctx.fillStyle = '#254263';
    ctx.fillRect(Math.round(cx - 2 * zoom), Math.round(cy - 1 * zoom), Math.ceil(4 * zoom), Math.ceil(2 * zoom));
  }
}

export function drawBackWalls(
  ctx: CanvasRenderingContext2D,
  topVertexX: number,
  topVertexY: number,
  gridW: number,
  gridH: number,
  zoom: number,
  isNight: boolean,
  timeSec: number,
): void {
  const hw = (TILE_W / 2) * zoom;
  const hh = (TILE_H / 2) * zoom;
  const wallH = 68 * zoom;

  // Left-top wall (along gx = 0, gy from 0..gridH)
  const leftEndX = topVertexX - gridH * hw;
  const leftEndY = topVertexY + gridH * hh;

  // Right-top wall (along gy = 0, gx from 0..gridW)
  const rightEndX = topVertexX + gridW * hw;
  const rightEndY = topVertexY + gridW * hh;

  // Draw left wall face
  ctx.beginPath();
  ctx.moveTo(topVertexX, topVertexY);
  ctx.lineTo(leftEndX, leftEndY);
  ctx.lineTo(leftEndX, leftEndY - wallH);
  ctx.lineTo(topVertexX, topVertexY - wallH);
  ctx.closePath();
  ctx.fillStyle = isNight ? '#23293d' : '#3a4563';
  ctx.fill();
  ctx.strokeStyle = '#121521';
  ctx.lineWidth = Math.max(1.5, 1.5 * zoom);
  ctx.stroke();

  // Draw right wall face
  ctx.beginPath();
  ctx.moveTo(topVertexX, topVertexY);
  ctx.lineTo(rightEndX, rightEndY);
  ctx.lineTo(rightEndX, rightEndY - wallH);
  ctx.lineTo(topVertexX, topVertexY - wallH);
  ctx.closePath();
  ctx.fillStyle = isNight ? '#1d2233' : '#303954';
  ctx.fill();
  ctx.strokeStyle = '#121521';
  ctx.stroke();

  // Baseboard trim
  ctx.beginPath();
  ctx.moveTo(leftEndX, leftEndY - 6 * zoom);
  ctx.lineTo(topVertexX, topVertexY - 6 * zoom);
  ctx.lineTo(rightEndX, rightEndY - 6 * zoom);
  ctx.strokeStyle = '#5c6b94';
  ctx.lineWidth = Math.max(2, 3 * zoom);
  ctx.stroke();

  // Panoramic Windows on Left Wall (3 windows) & Right Wall (3 windows)
  const drawWindow = (
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    tStart: number,
    tEnd: number,
  ) => {
    const x1 = p1x + (p2x - p1x) * tStart;
    const y1 = p1y + (p2y - p1y) * tStart;
    const x2 = p1x + (p2x - p1x) * tEnd;
    const y2 = p1y + (p2y - p1y) * tEnd;
    const wTop = 54 * zoom;
    const wBot = 18 * zoom;

    ctx.beginPath();
    ctx.moveTo(x1, y1 - wBot);
    ctx.lineTo(x2, y2 - wBot);
    ctx.lineTo(x2, y2 - wTop);
    ctx.lineTo(x1, y1 - wTop);
    ctx.closePath();

    ctx.fillStyle = isNight ? '#0c1630' : '#78c5f5';
    ctx.fill();

    // Stars or clouds inside window
    ctx.save();
    ctx.clip();
    if (isNight) {
      ctx.fillStyle = '#fff8c9';
      for (let i = 0; i < 4; i++) {
        const sx = x1 + (x2 - x1) * ((i * 0.27 + 0.15) % 0.9);
        const sy = y1 + (y2 - y1) * ((i * 0.27 + 0.15) % 0.9) - wBot - (10 + i * 7) * zoom;
        const twinkle = Math.sin(timeSec * 3 + i * 2) > 0 ? 2 * zoom : 1 * zoom;
        ctx.fillRect(Math.round(sx), Math.round(sy), Math.ceil(twinkle), Math.ceil(twinkle));
      }
    } else {
      ctx.fillStyle = '#ffffff';
      const drift = ((timeSec * 8) % 20) - 10;
      const cx = (x1 + x2) / 2 + drift * zoom * 0.4;
      const cy = (y1 + y2) / 2 - 36 * zoom;
      ctx.fillRect(Math.round(cx - 8 * zoom), Math.round(cy), Math.ceil(16 * zoom), Math.ceil(5 * zoom));
    }
    ctx.restore();

    ctx.strokeStyle = '#181d2b';
    ctx.lineWidth = Math.max(1.5, 2 * zoom);
    ctx.stroke();
  };

  drawWindow(topVertexX, topVertexY, leftEndX, leftEndY, 0.12, 0.34);
  drawWindow(topVertexX, topVertexY, leftEndX, leftEndY, 0.44, 0.66);
  drawWindow(topVertexX, topVertexY, leftEndX, leftEndY, 0.76, 0.92);

  drawWindow(topVertexX, topVertexY, rightEndX, rightEndY, 0.12, 0.32);
  drawWindow(topVertexX, topVertexY, rightEndX, rightEndY, 0.64, 0.88);
}

/** Draws an isometric pixel box centered on floor tile (cx, cy) */
function drawIsoBox(
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
): void {
  const hw = w * zoom;
  const hh = d * zoom;
  const hz = h * zoom;

  // Top face
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

  // Left face
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy - hz);
  ctx.lineTo(cx, cy + hh - hz);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();
  ctx.stroke();

  // Right face
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy - hz);
  ctx.lineTo(cx, cy + hh - hz);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx + hw, cy);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
  ctx.stroke();
}

export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cx: number,
  cy: number,
  zoom: number,
  timeSec: number,
  isOccupied: boolean,
  isHovered: boolean,
  whiteboardLabel: string,
): void {
  const z = zoom;
  ctx.save();

  if (kind === 'exec_desk') {
    drawIsoBox(ctx, cx, cy, 24, 12, 14, '#9c5230', '#73381d', '#542611', z);
    // Laptop + Mousepad & Keyboard + Gold nameplate
    drawIsoBox(ctx, cx, cy - 14 * z, 9, 5, 6, '#364366', '#212940', '#161b2b', z);
    ctx.fillStyle = '#5cf0ff';
    ctx.fillRect(Math.round(cx - 4 * z), Math.round(cy - 22 * z), Math.ceil(8 * z), Math.ceil(5 * z));
    ctx.fillStyle = '#1d2230';
    ctx.fillRect(Math.round(cx - 7 * z), Math.round(cy - 11 * z), Math.ceil(9 * z), Math.ceil(3 * z));
    ctx.fillStyle = '#ffd147';
    ctx.fillRect(Math.round(cx - 5 * z), Math.round(cy - 6 * z), Math.ceil(10 * z), Math.ceil(3 * z));
  } else if (kind === 'dev_desk') {
    drawIsoBox(ctx, cx, cy, 22, 11, 13, '#d4b48c', '#a38560', '#7d6344', z);
    // Dual monitors
    const screenColor = isOccupied
      ? Math.sin(timeSec * 8) > 0
        ? '#3be87a'
        : '#3cd8ff'
      : '#1b263b';
    ctx.fillStyle = '#141824';
    ctx.fillRect(Math.round(cx - 12 * z), Math.round(cy - 28 * z), Math.ceil(11 * z), Math.ceil(10 * z));
    ctx.fillRect(Math.round(cx + 1 * z), Math.round(cy - 28 * z), Math.ceil(11 * z), Math.ceil(10 * z));
    ctx.fillStyle = screenColor;
    ctx.fillRect(Math.round(cx - 10 * z), Math.round(cy - 26 * z), Math.ceil(7 * z), Math.ceil(6 * z));
    ctx.fillRect(Math.round(cx + 3 * z), Math.round(cy - 26 * z), Math.ceil(7 * z), Math.ceil(6 * z));
    // Mechanical keyboard + mousepad
    ctx.fillStyle = '#1b202e';
    ctx.fillRect(Math.round(cx - 8 * z), Math.round(cy - 12 * z), Math.ceil(11 * z), Math.ceil(3 * z));
    ctx.fillStyle = '#3cd8ff';
    ctx.fillRect(Math.round(cx - 7 * z), Math.round(cy - 11 * z), Math.ceil(9 * z), Math.ceil(1 * z));
    ctx.fillStyle = '#2a3347';
    ctx.fillRect(Math.round(cx + 5 * z), Math.round(cy - 12 * z), Math.ceil(5 * z), Math.ceil(4 * z));
  } else if (kind === 'qa_desk') {
    drawIsoBox(ctx, cx, cy, 20, 10, 13, '#cbb59a', '#9c8870', '#756450', z);
    ctx.fillStyle = '#141824';
    ctx.fillRect(Math.round(cx - 7 * z), Math.round(cy - 27 * z), Math.ceil(14 * z), Math.ceil(10 * z));
    ctx.fillStyle = isOccupied ? '#ffbe3b' : '#243147';
    ctx.fillRect(Math.round(cx - 5 * z), Math.round(cy - 25 * z), Math.ceil(10 * z), Math.ceil(6 * z));
    // Keyboard + mousepad
    ctx.fillStyle = '#1b202e';
    ctx.fillRect(Math.round(cx - 6 * z), Math.round(cy - 12 * z), Math.ceil(10 * z), Math.ceil(3 * z));
    ctx.fillStyle = '#2a3347';
    ctx.fillRect(Math.round(cx + 5 * z), Math.round(cy - 12 * z), Math.ceil(4 * z), Math.ceil(4 * z));
  } else if (kind === 'desk_chair') {
    // Ergonomic office swivel chair
    drawIsoBox(ctx, cx, cy, 9, 5, 5, '#2b3347', '#1a202e', '#11151f', z);
    drawIsoBox(ctx, cx - 2 * z, cy - 5 * z, 7, 3, 9, '#394561', '#232b3d', '#161b26', z);
  } else if (kind === 'meeting_chair') {
    // Royal-blue conference chair
    drawIsoBox(ctx, cx, cy, 9, 5, 5, '#3b5998', '#263c6b', '#19294a', z);
    drawIsoBox(ctx, cx - 2 * z, cy - 5 * z, 7, 3, 8, '#4a6eb8', '#2e4a85', '#1d315c', z);
  } else if (kind === 'bookshelf') {
    drawIsoBox(ctx, cx, cy, 16, 8, 30, '#8c5a32', '#663f20', '#472b14', z);
    const bookColors = ['#ff5666', '#3cd8ff', '#ffd147', '#3be87a', '#b07cff'];
    for (let r = 0; r < 3; r++) {
      const sy = cy - (24 - r * 7) * z;
      for (let b = 0; b < 4; b++) {
        ctx.fillStyle = bookColors[(r + b) % bookColors.length];
        ctx.fillRect(Math.round(cx - (10 - b * 4) * z), Math.round(sy), Math.ceil(3 * z), Math.ceil(5 * z));
      }
    }
  } else if (kind === 'filing_cabinet') {
    drawIsoBox(ctx, cx, cy, 12, 8, 22, '#7d889e', '#566073', '#3b4252', z);
    ctx.fillStyle = '#c9d2e3';
    ctx.fillRect(Math.round(cx - 6 * z), Math.round(cy - 16 * z), Math.ceil(5 * z), Math.ceil(2 * z));
    ctx.fillRect(Math.round(cx - 6 * z), Math.round(cy - 9 * z), Math.ceil(5 * z), Math.ceil(2 * z));
  } else if (kind === 'water_cooler') {
    drawIsoBox(ctx, cx, cy, 9, 6, 16, '#dbe4f0', '#a6b3c7', '#7b8799', z);
    drawIsoBox(ctx, cx, cy - 16 * z, 6, 4, 11, '#66d2ff', '#3bb2eb', '#2287bd', z);
    ctx.fillStyle = '#ff5666';
    ctx.fillRect(Math.round(cx - 4 * z), Math.round(cy - 13 * z), Math.ceil(2 * z), Math.ceil(2 * z));
    ctx.fillStyle = '#3cd8ff';
    ctx.fillRect(Math.round(cx - 1 * z), Math.round(cy - 13 * z), Math.ceil(2 * z), Math.ceil(2 * z));
  } else if (kind === 'office_plant') {
    drawIsoBox(ctx, cx, cy, 8, 5, 7, '#a65c3a', '#7d4126', '#592d19', z);
    ctx.fillStyle = '#2fa857';
    ctx.fillRect(Math.round(cx - 7 * z), Math.round(cy - 20 * z), Math.ceil(14 * z), Math.ceil(11 * z));
    ctx.fillStyle = '#4be07a';
    ctx.fillRect(Math.round(cx - 4 * z), Math.round(cy - 25 * z), Math.ceil(8 * z), Math.ceil(7 * z));
  } else if (kind === 'war_table') {
    drawIsoBox(ctx, cx, cy, 22, 12, 11, '#7a8ca8', '#526075', '#3b4554', z);
    // Sticky notes on table
    ctx.fillStyle = '#ffe159';
    ctx.fillRect(Math.round(cx - 6 * z), Math.round(cy - 14 * z), Math.ceil(5 * z), Math.ceil(4 * z));
    ctx.fillStyle = '#ff7eb9';
    ctx.fillRect(Math.round(cx + 2 * z), Math.round(cy - 12 * z), Math.ceil(5 * z), Math.ceil(4 * z));
  } else if (kind === 'whiteboard_l' || kind === 'whiteboard_r') {
    // Illuminated Presentation Screen
    drawIsoBox(ctx, cx, cy, 22, 6, 4, '#454e66', '#2c3345', '#1e2330', z);
    const bx = cx - 21 * z;
    const by = cy - 45 * z;
    const bw = 42 * z;
    const bh = 32 * z;

    if (isHovered || isOccupied) {
      ctx.fillStyle = isHovered ? '#ffe64d' : 'rgba(60, 216, 255, 0.55)';
      ctx.fillRect(Math.round(bx - 2 * z), Math.round(by - 2 * z), Math.ceil(bw + 4 * z), Math.ceil(bh + 4 * z));
    }
    ctx.fillStyle = '#1a2030';
    ctx.fillRect(Math.round(bx), Math.round(by), Math.ceil(bw), Math.ceil(bh));
    ctx.fillStyle = isOccupied ? '#f7fbff' : '#e6eefc';
    ctx.fillRect(Math.round(bx + 2 * z), Math.round(by + 2 * z), Math.ceil(bw - 4 * z), Math.ceil(bh - 4 * z));

    if (kind === 'whiteboard_l') {
      // Bar charts on left screen
      ctx.fillStyle = '#3cd8ff';
      ctx.fillRect(Math.round(bx + 6 * z), Math.round(by + 16 * z), Math.ceil(5 * z), Math.ceil(11 * z));
      ctx.fillStyle = '#3be87a';
      ctx.fillRect(Math.round(bx + 13 * z), Math.round(by + 11 * z), Math.ceil(5 * z), Math.ceil(16 * z));
      ctx.fillStyle = '#ffbe3b';
      ctx.fillRect(Math.round(bx + 20 * z), Math.round(by + 14 * z), Math.ceil(5 * z), Math.ceil(13 * z));
      ctx.fillStyle = '#ff5666';
      ctx.fillRect(Math.round(bx + 27 * z), Math.round(by + 8 * z), Math.ceil(5 * z), Math.ceil(19 * z));
      ctx.fillStyle = '#252b3b';
      ctx.fillRect(Math.round(bx + 5 * z), Math.round(by + 5 * z), Math.ceil(22 * z), Math.ceil(2 * z));

      ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Silkscreen", monospace`;
      ctx.fillStyle = isHovered ? '#ffe64d' : '#9ee8ff';
      ctx.textAlign = 'center';
      ctx.fillText(whiteboardLabel, cx + 14 * z, by - 5 * z);
    } else {
      // Architecture nodes + slide bullets on right screen
      ctx.fillStyle = '#b07cff';
      ctx.fillRect(Math.round(bx + 6 * z), Math.round(by + 6 * z), Math.ceil(9 * z), Math.ceil(6 * z));
      ctx.fillStyle = '#3cd8ff';
      ctx.fillRect(Math.round(bx + 23 * z), Math.round(by + 6 * z), Math.ceil(9 * z), Math.ceil(6 * z));
      ctx.fillStyle = '#394666';
      ctx.fillRect(Math.round(bx + 15 * z), Math.round(by + 8 * z), Math.ceil(8 * z), Math.ceil(2 * z));
      ctx.fillRect(Math.round(bx + 6 * z), Math.round(by + 17 * z), Math.ceil(26 * z), Math.ceil(2 * z));
      ctx.fillRect(Math.round(bx + 6 * z), Math.round(by + 22 * z), Math.ceil(20 * z), Math.ceil(2 * z));
    }
  } else if (kind === 'server_rack') {
    drawIsoBox(ctx, cx, cy, 16, 10, 38, '#364159', '#1e2536', '#141824', z);
    // Blinking LEDs
    const leds = ['#3be87a', '#ffbe3b', '#ff5666'];
    for (let row = 0; row < 5; row++) {
      const ly = cy - (32 - row * 6) * z;
      ctx.fillStyle = '#0c0f17';
      ctx.fillRect(Math.round(cx - 10 * z), Math.round(ly), Math.ceil(8 * z), Math.ceil(3 * z));
      const blink = Math.floor(timeSec * 4 + row * 1.7) % 3;
      ctx.fillStyle = leds[(row + blink) % leds.length];
      ctx.fillRect(Math.round(cx - 9 * z), Math.round(ly + 1 * z), Math.ceil(2 * z), Math.ceil(2 * z));
      ctx.fillStyle = '#3cd8ff';
      ctx.fillRect(Math.round(cx - 5 * z), Math.round(ly + 1 * z), Math.ceil(2 * z), Math.ceil(2 * z));
    }
  } else if (kind === 'coffee_machine') {
    drawIsoBox(ctx, cx, cy, 16, 10, 14, '#7a543e', '#573a29', '#3d281c', z);
    drawIsoBox(ctx, cx, cy - 14 * z, 9, 7, 14, '#c7cedb', '#8d96a8', '#606878', z);
    ctx.fillStyle = '#ff5666';
    ctx.fillRect(Math.round(cx - 3 * z), Math.round(cy - 23 * z), Math.ceil(3 * z), Math.ceil(3 * z));
    ctx.fillStyle = '#3be87a';
    ctx.fillRect(Math.round(cx + 1 * z), Math.round(cy - 23 * z), Math.ceil(3 * z), Math.ceil(3 * z));
  } else if (kind === 'sofa_l' || kind === 'sofa_r') {
    drawIsoBox(ctx, cx, cy, 20, 11, 10, '#c44558', '#8f2c3b', '#661d28', z);
    drawIsoBox(ctx, cx - 4 * z, cy - 10 * z, 16, 4, 9, '#d9576a', '#a33747', '#782330', z);
  } else if (kind === 'armchair') {
    drawIsoBox(ctx, cx, cy, 15, 10, 9, '#b84b68', '#853048', '#5e1f31', z);
    drawIsoBox(ctx, cx - 3 * z, cy - 9 * z, 12, 4, 8, '#cf5d7b', '#993c55', '#6e273a', z);
  } else if (kind === 'gaming_seat') {
    // Cozy beanbag / gaming pouf
    drawIsoBox(ctx, cx, cy, 13, 8, 7, '#3f6ad8', '#2a499e', '#1c326e', z);
    drawIsoBox(ctx, cx, cy - 6 * z, 9, 5, 3, '#5c88f5', '#3f6ad8', '#2a499e', z);
  } else if (kind === 'lounge_table') {
    drawIsoBox(ctx, cx, cy, 15, 9, 8, '#a8744f', '#7d5235', '#593923', z);
    ctx.fillStyle = '#fff5e0';
    ctx.fillRect(Math.round(cx - 4 * z), Math.round(cy - 11 * z), Math.ceil(4 * z), Math.ceil(3 * z));
    ctx.fillStyle = '#ffe64d';
    ctx.fillRect(Math.round(cx + 2 * z), Math.round(cy - 10 * z), Math.ceil(3 * z), Math.ceil(3 * z));
  } else if (kind === 'tv_console') {
    // Media stand + console box with glowing LEDs
    drawIsoBox(ctx, cx, cy, 22, 9, 10, '#363e54', '#232938', '#161a24', z);
    drawIsoBox(ctx, cx, cy - 10 * z, 11, 5, 4, '#1b1f2b', '#10131c', '#090b10', z);
    ctx.fillStyle = isOccupied ? '#3be87a' : '#ff5666';
    ctx.fillRect(Math.round(cx - 5 * z), Math.round(cy - 12 * z), Math.ceil(3 * z), Math.ceil(2 * z));
    ctx.fillStyle = '#3cd8ff';
    ctx.fillRect(Math.round(cx), Math.round(cy - 12 * z), Math.ceil(3 * z), Math.ceil(2 * z));

    // Widescreen Pixel TV
    const tvX = cx - 22 * z;
    const tvY = cy - 42 * z;
    const tvW = 44 * z;
    const tvH = 26 * z;
    ctx.fillStyle = '#12151f';
    ctx.fillRect(Math.round(tvX), Math.round(tvY), Math.ceil(tvW), Math.ceil(tvH));
    ctx.fillStyle = isOccupied ? '#131d38' : '#1b2233';
    ctx.fillRect(Math.round(tvX + 2 * z), Math.round(tvY + 2 * z), Math.ceil(tvW - 4 * z), Math.ceil(tvH - 4 * z));

    if (isOccupied) {
      // Vibrant 2-player retro game animation (P1/P2 health bars + two pixel fighters/racers)
      ctx.fillStyle = '#3cd8ff';
      ctx.fillRect(Math.round(tvX + 4 * z), Math.round(tvY + 4 * z), Math.ceil(14 * z), Math.ceil(2 * z));
      ctx.fillStyle = '#ff5666';
      ctx.fillRect(Math.round(tvX + tvW - 18 * z), Math.round(tvY + 4 * z), Math.ceil(14 * z), Math.ceil(2 * z));

      const hop1 = Math.abs(Math.sin(timeSec * 8)) * 4 * z;
      const hop2 = Math.abs(Math.cos(timeSec * 7)) * 4 * z;
      ctx.fillStyle = '#3be87a';
      ctx.fillRect(Math.round(tvX + 10 * z), Math.round(tvY + 15 * z - hop1), Math.ceil(6 * z), Math.ceil(6 * z));
      ctx.fillStyle = '#ffd147';
      ctx.fillRect(Math.round(tvX + 28 * z), Math.round(tvY + 15 * z - hop2), Math.ceil(6 * z), Math.ceil(6 * z));

      // Projectile spark
      const projX = tvX + (17 + ((timeSec * 30) % 10)) * z;
      ctx.fillStyle = '#ff7eb9';
      ctx.fillRect(Math.round(projX), Math.round(tvY + 13 * z), Math.ceil(3 * z), Math.ceil(3 * z));
    } else {
      // Calm standby screen
      ctx.fillStyle = '#2d3954';
      ctx.fillRect(Math.round(tvX + 12 * z), Math.round(tvY + 12 * z), Math.ceil(20 * z), Math.ceil(3 * z));
    }
  } else if (kind === 'prop_plant') {
    drawIsoBox(ctx, cx, cy, 9, 5, 8, '#a65c3a', '#7d4126', '#592d19', z);
    ctx.fillStyle = '#2fa857';
    ctx.fillRect(Math.round(cx - 8 * z), Math.round(cy - 22 * z), Math.ceil(16 * z), Math.ceil(12 * z));
    ctx.fillStyle = '#4be07a';
    ctx.fillRect(Math.round(cx - 5 * z), Math.round(cy - 27 * z), Math.ceil(10 * z), Math.ceil(8 * z));
  } else if (kind === 'prop_trophy') {
    drawIsoBox(ctx, cx, cy, 10, 6, 12, '#694228', '#4a2d1b', '#331e11', z);
    ctx.fillStyle = '#ffd147';
    ctx.fillRect(Math.round(cx - 5 * z), Math.round(cy - 24 * z), Math.ceil(10 * z), Math.ceil(8 * z));
    ctx.fillRect(Math.round(cx - 2 * z), Math.round(cy - 16 * z), Math.ceil(4 * z), Math.ceil(4 * z));
  } else if (kind === 'prop_arcade') {
    drawIsoBox(ctx, cx, cy, 14, 9, 28, '#3f3075', '#271c4f', '#191136', z);
    ctx.fillStyle = Math.sin(timeSec * 6) > 0 ? '#ff5666' : '#3cd8ff';
    ctx.fillRect(Math.round(cx - 6 * z), Math.round(cy - 25 * z), Math.ceil(10 * z), Math.ceil(9 * z));
  } else if (kind === 'prop_hologram') {
    drawIsoBox(ctx, cx, cy, 16, 9, 10, '#2c4159', '#1c2a3b', '#121c29', z);
    const pulse = Math.sin(timeSec * 4) * 2 * z;
    ctx.fillStyle = 'rgba(60, 216, 255, 0.72)';
    ctx.fillRect(Math.round(cx - 6 * z), Math.round(cy - 26 * z + pulse), Math.ceil(12 * z), Math.ceil(10 * z));
    ctx.fillStyle = '#b7f3ff';
    ctx.fillRect(Math.round(cx - 3 * z), Math.round(cy - 23 * z + pulse), Math.ceil(6 * z), Math.ceil(4 * z));
  }

  ctx.restore();
}

export function drawEmployeeSprite(
  ctx: CanvasRenderingContext2D,
  emp: OfficeEmployee,
  cx: number,
  cy: number,
  zoom: number,
  facing: Facing,
  isWalking: boolean,
  walkPhase: number,
  timeSec: number,
  isHovered: boolean,
  isSelected: boolean,
): void {
  const z = zoom;
  const palette = getEmployeePalette(emp.id);
  const uniform = UNIFORM_COLORS[emp.modelFamily] || UNIFORM_COLORS.other;

  const bob = isWalking ? Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 3 * z : 0;
  const legSwing = isWalking ? Math.sin(walkPhase * Math.PI * 2) * 3 * z : 0;
  const dirFlip = facing === 'SW' || facing === 'NW' ? -1 : 1;

  ctx.save();

  // Floor shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2 * z, 11 * z, 5 * z, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hover or selection ring
  if (isHovered || isSelected) {
    ctx.strokeStyle = isSelected ? '#ffd147' : '#3cd8ff';
    ctx.lineWidth = Math.max(2, 2 * z);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2 * z, 13 * z, 6 * z, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const isPresenting = !isWalking && (emp.activity === 'presenting' || Boolean(emp.isPresenter));
  const seated =
    !isWalking &&
    !isPresenting &&
    (emp.activity === 'coding' ||
      emp.activity === 'reading' ||
      emp.activity === 'searching' ||
      emp.activity === 'thinking' ||
      emp.activity === 'meeting' ||
      emp.activity === 'lounging' ||
      emp.activity === 'sleeping' ||
      emp.activity === 'gaming');
  const seatOffsetY = seated ? 4 * z : 0;
  const baseY = cy - bob + seatOffsetY;

  // Legs (2-frame walk animation, or bent seated legs on cushion)
  ctx.fillStyle = '#1b2030';
  if (seated) {
    ctx.fillRect(Math.round(cx - 6 * z), Math.round(baseY - 6 * z), Math.ceil(5 * z), Math.ceil(5 * z));
    ctx.fillRect(Math.round(cx + 1 * z), Math.round(baseY - 6 * z), Math.ceil(5 * z), Math.ceil(5 * z));
  } else {
    ctx.fillRect(
      Math.round(cx - 5 * z),
      Math.round(baseY - 8 * z + legSwing),
      Math.ceil(4 * z),
      Math.ceil(8 * z),
    );
    ctx.fillRect(
      Math.round(cx + 1 * z),
      Math.round(baseY - 8 * z - legSwing),
      Math.ceil(4 * z),
      Math.ceil(8 * z),
    );
  }

  // Torso (Model Uniform)
  ctx.fillStyle = uniform.dark;
  ctx.fillRect(Math.round(cx - 7 * z), Math.round(baseY - 21 * z), Math.ceil(14 * z), Math.ceil(14 * z));
  ctx.fillStyle = uniform.main;
  ctx.fillRect(Math.round(cx - 6 * z), Math.round(baseY - 20 * z), Math.ceil(12 * z), Math.ceil(12 * z));

  // Uniform trim / tie / stripe
  ctx.fillStyle = uniform.trim;
  ctx.fillRect(Math.round(cx - 1 * z), Math.round(baseY - 19 * z), Math.ceil(2 * z), Math.ceil(8 * z));

  // Arms: shoulders stay 100% LEVEL and STILL (zero shoulder-shrug seesaw!)
  ctx.fillStyle = uniform.main;
  ctx.fillRect(
    Math.round(cx - 10 * z),
    Math.round(baseY - 19 * z),
    Math.ceil(3 * z),
    Math.ceil(9 * z),
  );
  ctx.fillRect(
    Math.round(cx + 7 * z),
    Math.round(baseY - 19 * z),
    Math.ceil(3 * z),
    Math.ceil(9 * z),
  );

  // Activity props & hand animations
  if (!isWalking) {
    if (emp.activity === 'coding' || emp.activity === 'terminal') {
      // Forearms resting forward at keyboard height with subtle 1px finger taps
      const tapL = Math.sin(timeSec * 18) > 0 ? 1 * z : 0;
      const tapR = Math.cos(timeSec * 18) > 0 ? 1 * z : 0;
      ctx.fillStyle = palette.skin;
      ctx.fillRect(Math.round(cx - 8 * z), Math.round(baseY - 13 * z + tapL), Math.ceil(4 * z), Math.ceil(3 * z));
      ctx.fillRect(Math.round(cx + 4 * z), Math.round(baseY - 13 * z + tapR), Math.ceil(4 * z), Math.ceil(3 * z));

      // Floating code glyphs near monitor
      const glyphY = ((timeSec * 10) % 10) * z;
      ctx.font = `bold ${Math.max(7, Math.round(7 * z))}px "JetBrains Mono", monospace`;
      ctx.fillStyle = 'rgba(60, 216, 255, 0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(Math.floor(timeSec * 2) % 2 === 0 ? '</>' : '{}', cx + 11 * z, baseY - 38 * z - glyphY);
    } else if (isPresenting) {
      // Standing presenter holding an angled pixel pointer stick toward the Presentation Screen
      const sweep = Math.sin(timeSec * 2.5) * 3 * z;
      ctx.strokeStyle = '#ffd147';
      ctx.lineWidth = Math.max(1.5, 2 * z);
      ctx.beginPath();
      ctx.moveTo(cx - 8 * z, baseY - 14 * z);
      ctx.lineTo(cx - 22 * z, baseY - 28 * z + sweep);
      ctx.stroke();
      ctx.fillStyle = '#ff5666';
      ctx.fillRect(Math.round(cx - 23 * z), Math.round(baseY - 29 * z + sweep), Math.ceil(3 * z), Math.ceil(3 * z));
    } else if (emp.activity === 'reading' || emp.activity === 'searching') {
      ctx.fillStyle = '#f5ecd7';
      ctx.fillRect(
        Math.round(cx + (dirFlip > 0 ? 4 : -10) * z),
        Math.round(baseY - 15 * z),
        Math.ceil(6 * z),
        Math.ceil(5 * z),
      );
    } else if (emp.activity === 'coffee') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(cx + 7 * z), Math.round(baseY - 14 * z), Math.ceil(4 * z), Math.ceil(5 * z));
      const steam = (timeSec * 10) % 6;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(
        Math.round(cx + 8 * z),
        Math.round(baseY - (17 + steam) * z),
        Math.ceil(2 * z),
        Math.ceil(2 * z),
      );
    } else if (emp.activity === 'gaming') {
      // Pixel Gamepad controller held forward with colored buttons
      const thumbJitter = Math.sin(timeSec * 16) > 0 ? 0.5 * z : 0;
      ctx.fillStyle = '#1b1f2b';
      ctx.fillRect(Math.round(cx - 5 * z), Math.round(baseY - 14 * z + thumbJitter), Math.ceil(10 * z), Math.ceil(5 * z));
      ctx.fillStyle = '#3cd8ff';
      ctx.fillRect(Math.round(cx - 4 * z), Math.round(baseY - 13 * z + thumbJitter), Math.ceil(2 * z), Math.ceil(2 * z));
      ctx.fillStyle = '#ff5666';
      ctx.fillRect(Math.round(cx + 2 * z), Math.round(baseY - 13 * z + thumbJitter), Math.ceil(2 * z), Math.ceil(2 * z));
      ctx.fillStyle = '#ffd147';
      ctx.fillRect(Math.round(cx), Math.round(baseY - 12 * z + thumbJitter), Math.ceil(2 * z), Math.ceil(2 * z));
    }
  }

  // Head (Chibi/Habbo proportions)
  ctx.fillStyle = palette.skinShadow;
  ctx.fillRect(Math.round(cx - 7 * z), Math.round(baseY - 35 * z), Math.ceil(14 * z), Math.ceil(14 * z));
  ctx.fillStyle = palette.skin;
  ctx.fillRect(Math.round(cx - 6 * z), Math.round(baseY - 34 * z), Math.ceil(12 * z), Math.ceil(12 * z));

  // Eyes (unless sleeping)
  if (emp.activity === 'sleeping') {
    ctx.fillStyle = '#231b19';
    ctx.fillRect(Math.round(cx - 4 * z), Math.round(baseY - 27 * z), Math.ceil(3 * z), Math.ceil(1 * z));
    ctx.fillRect(Math.round(cx + 1 * z), Math.round(baseY - 27 * z), Math.ceil(3 * z), Math.ceil(1 * z));
  } else {
    ctx.fillStyle = '#11131c';
    const eyeShift = dirFlip > 0 ? 1 : -1;
    ctx.fillRect(
      Math.round(cx + (-3 + eyeShift) * z),
      Math.round(baseY - 28 * z),
      Math.ceil(2 * z),
      Math.ceil(3 * z),
    );
    ctx.fillRect(
      Math.round(cx + (2 + eyeShift) * z),
      Math.round(baseY - 28 * z),
      Math.ceil(2 * z),
      Math.ceil(3 * z),
    );
  }

  // Hair
  ctx.fillStyle = palette.hair;
  ctx.fillRect(Math.round(cx - 7 * z), Math.round(baseY - 37 * z), Math.ceil(14 * z), Math.ceil(6 * z));
  ctx.fillStyle = palette.hairHighlight;
  ctx.fillRect(Math.round(cx - 5 * z), Math.round(baseY - 36 * z), Math.ceil(6 * z), Math.ceil(2 * z));

  // Model-specific headgear
  if (emp.modelFamily === 'argon' || emp.isCoordinator) {
    // Gold crown
    ctx.fillStyle = '#ffd147';
    ctx.fillRect(Math.round(cx - 5 * z), Math.round(baseY - 41 * z), Math.ceil(10 * z), Math.ceil(4 * z));
    ctx.fillRect(Math.round(cx - 5 * z), Math.round(baseY - 43 * z), Math.ceil(2 * z), Math.ceil(2 * z));
    ctx.fillRect(Math.round(cx - 1 * z), Math.round(baseY - 43 * z), Math.ceil(2 * z), Math.ceil(2 * z));
    ctx.fillRect(Math.round(cx + 3 * z), Math.round(baseY - 43 * z), Math.ceil(2 * z), Math.ceil(2 * z));
  } else if (emp.modelFamily === 'hydrogen') {
    // Cyan headphones
    ctx.fillStyle = '#3cd8ff';
    ctx.fillRect(Math.round(cx - 8 * z), Math.round(baseY - 32 * z), Math.ceil(2 * z), Math.ceil(7 * z));
    ctx.fillRect(Math.round(cx + 6 * z), Math.round(baseY - 32 * z), Math.ceil(2 * z), Math.ceil(7 * z));
  } else if (emp.modelFamily === 'flash') {
    // Emerald-yellow speed visor
    ctx.fillStyle = '#ffe64d';
    ctx.fillRect(Math.round(cx - 5 * z), Math.round(baseY - 30 * z), Math.ceil(10 * z), Math.ceil(3 * z));
  }

  // Floating Zzz, ♪ lounging sparkle, gaming excitement ★, or Error !
  if (emp.activity === 'gaming') {
    const bounce = Math.abs(Math.sin(timeSec * 6)) * 5 * z;
    ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Press Start 2P", monospace`;
    ctx.fillStyle = Math.sin(timeSec * 8) > 0 ? '#ffd147' : '#3cd8ff';
    ctx.textAlign = 'center';
    ctx.fillText('★', cx + 11 * z, baseY - 37 * z - bounce);
  } else if (emp.activity === 'lounging') {
    const floatY = ((timeSec * 10) % 8) * z;
    ctx.font = `bold ${Math.max(9, Math.round(9 * z))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#7ef3ff';
    ctx.textAlign = 'center';
    ctx.fillText('♪', cx + 10 * z, baseY - 37 * z - floatY);
  } else if (emp.activity === 'sleeping' || emp.status === 'waiting') {
    const floatY = ((timeSec * 12) % 10) * z;
    ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#9ee8ff';
    ctx.textAlign = 'center';
    ctx.fillText('Zzz', cx + 10 * z, baseY - 38 * z - floatY);
  } else if (emp.status === 'error' || emp.activity === 'error') {
    ctx.fillStyle = '#ff5666';
    ctx.fillRect(Math.round(cx - 5 * z), Math.round(baseY - 52 * z), Math.ceil(10 * z), Math.ceil(10 * z));
    ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('!', cx, baseY - 44 * z);
  }

  // Overhead Role Tag + Status Dot
  const tagText = emp.name.length > 14 ? `${emp.name.slice(0, 13)}…` : emp.name;
  ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "JetBrains Mono", monospace`;
  const textW = ctx.measureText(tagText).width;
  const pillW = textW + 16 * z;
  const pillH = 14 * z;
  const pillX = cx - pillW / 2;
  const pillY = baseY - 56 * z;

  ctx.fillStyle = 'rgba(12, 15, 25, 0.86)';
  ctx.fillRect(Math.round(pillX), Math.round(pillY), Math.ceil(pillW), Math.ceil(pillH));
  ctx.strokeStyle = isHovered ? '#3cd8ff' : '#4a5780';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(pillX), Math.round(pillY), Math.ceil(pillW), Math.ceil(pillH));

  // Status dot
  const dotColor =
    emp.status === 'working'
      ? '#3be87a'
      : emp.status === 'error'
        ? '#ff5666'
        : emp.status === 'waiting'
          ? '#ffbe3b'
          : '#8d96ad';
  ctx.fillStyle = dotColor;
  ctx.fillRect(Math.round(pillX + 4 * z), Math.round(pillY + 4 * z), Math.ceil(5 * z), Math.ceil(5 * z));

  ctx.fillStyle = '#f4f6fc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagText, pillX + 11 * z, pillY + pillH / 2 + 0.5);

  // Overhead Speech Bubble
  if (emp.speechBubble) {
    const bubbleText =
      emp.speechBubble.length > 26 ? `${emp.speechBubble.slice(0, 25)}…` : emp.speechBubble;
    ctx.font = `${Math.max(8, Math.round(8 * z))}px "JetBrains Mono", monospace`;
    const bw = ctx.measureText(bubbleText).width + 12 * z;
    const bh = 15 * z;
    const bx = cx - bw / 2;
    const by = pillY - bh - 6 * z;

    ctx.fillStyle = '#fffdf2';
    ctx.fillRect(Math.round(bx), Math.round(by), Math.ceil(bw), Math.ceil(bh));
    ctx.strokeStyle = '#11131c';
    ctx.strokeRect(Math.round(bx), Math.round(by), Math.ceil(bw), Math.ceil(bh));

    // Little tail
    ctx.fillStyle = '#fffdf2';
    ctx.fillRect(Math.round(cx - 2 * z), Math.round(by + bh), Math.ceil(4 * z), Math.ceil(3 * z));

    ctx.fillStyle = '#141824';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubbleText, cx, by + bh / 2 + 0.5);
  }

  ctx.restore();
}

/**
 * Renders a crisp zoomed-in pixel portrait of an employee for AgentRpgModal.
 */
export function drawEmployeePortrait(
  ctx: CanvasRenderingContext2D,
  emp: OfficeEmployee,
  size: number,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  const uniform = UNIFORM_COLORS[emp.modelFamily] || UNIFORM_COLORS.other;
  const palette = getEmployeePalette(emp.id);

  // Background gradient
  ctx.fillStyle = '#181e30';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = uniform.dark;
  ctx.fillRect(0, Math.floor(size * 0.7), size, Math.ceil(size * 0.3));

  const scale = size / 32;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * scale), Math.round(y * scale), Math.ceil(w * scale), Math.ceil(h * scale));
  };

  // Shoulders / Uniform
  px(6, 21, 20, 11, uniform.dark);
  px(8, 22, 16, 10, uniform.main);
  px(15, 22, 2, 8, uniform.trim);

  // Head
  px(9, 8, 14, 14, palette.skinShadow);
  px(10, 9, 12, 12, palette.skin);

  // Hair
  px(9, 6, 14, 5, palette.hair);
  px(11, 7, 6, 2, palette.hairHighlight);

  // Eyes
  px(12, 14, 2, 3, '#11131c');
  px(18, 14, 2, 3, '#11131c');

  // Headgear
  if (emp.modelFamily === 'argon' || emp.isCoordinator) {
    px(10, 3, 12, 3, '#ffd147');
    px(10, 1, 2, 2, '#ffd147');
    px(15, 1, 2, 2, '#ffd147');
    px(20, 1, 2, 2, '#ffd147');
  } else if (emp.modelFamily === 'hydrogen') {
    px(8, 10, 2, 7, '#3cd8ff');
    px(22, 10, 2, 7, '#3cd8ff');
  } else if (emp.modelFamily === 'flash') {
    px(10, 12, 12, 3, '#ffe64d');
  }
}
