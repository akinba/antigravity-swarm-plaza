import type { FloorEventKind, ModelFamily, OfficeEmployee, OfficeZone } from '../../shared/types';
import { TILE_H, TILE_W } from './isoMath';
import type { MascotKind, ThemePalette } from './officeLayouts';
import {
  drawDeskEvolutionExtras,
  drawExtraFurnitureProp,
  drawOfficeDog,
  drawToolStatusBubble,
  type ToolBubbleKind,
} from './officePropsSprites';
import type { Facing } from './pathfinding';

export type FemaleHairStyle = 'long_locks' | 'bob_cut' | 'ponytail' | 'bun_updo';
export type MaleHairStyle = 'short_crop' | 'side_part' | 'spiky' | 'curly_top';
export type FemaleOutfitStyle = 'skirt_blazer' | 'tailored_suit';
export type MaleOutfitStyle = 'classic_suit' | 'tech_hoodie' | 'vest_ensemble';
export type MaleFacialHair = 'clean' | 'light_stubble';

const FEMALE_HAIR_STYLES: FemaleHairStyle[] = ['long_locks', 'bob_cut', 'ponytail', 'bun_updo'];
const MALE_HAIR_STYLES: MaleHairStyle[] = ['short_crop', 'side_part', 'spiky', 'curly_top'];
const MALE_OUTFIT_STYLES: MaleOutfitStyle[] = ['classic_suit', 'tech_hoodie', 'vest_ensemble'];
const ACCESSORY_COLORS = ['#ff6b9d', '#ffd166', '#4dd4ff', '#c77dff'];

export interface Palette {
  skin: string;
  skinShadow: string;
  hair: string;
  hairHighlight: string;
  gender: 'female' | 'male';
  femaleHairStyle: FemaleHairStyle;
  maleHairStyle: MaleHairStyle;
  femaleOutfit: FemaleOutfitStyle;
  maleOutfitStyle: MaleOutfitStyle;
  maleFacialHair: MaleFacialHair;
  accessoryColor: string;
}

export type EmployeePalette = Palette;

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
  pro: { main: '#243b6b', dark: '#152342', trim: '#ffd147', badge: 'PRO' },
  claude: { main: '#c96b42', dark: '#874123', trim: '#fff1d6', badge: 'CLAUDE' },
  gpt: { main: '#167a73', dark: '#0d4a46', trim: '#7efaa8', badge: 'GPT' },
  other: { main: '#4654a3', dark: '#2a336b', trim: '#b7c4ff', badge: 'AGENT' },
};

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function getEmployeePalette(
  employeeId: string,
  genderOverride?: 'female' | 'male',
): Palette {
  const h = hashString(employeeId);
  const gender: 'female' | 'male' = genderOverride ?? ((h & 1) === 1 ? 'female' : 'male');
  const femaleHairStyle = FEMALE_HAIR_STYLES[(h >>> 1) & 3];
  const maleHairStyle = MALE_HAIR_STYLES[(h >>> 1) & 3];
  const femaleOutfit: FemaleOutfitStyle =
    ((h >>> 3) & 1) === 1 ? 'tailored_suit' : 'skirt_blazer';
  const skin = SKIN_PALETTES[(h >>> 4) % SKIN_PALETTES.length];
  const hair = HAIR_PALETTES[(h >>> 7) % HAIR_PALETTES.length];
  const accessoryColor = ACCESSORY_COLORS[(h >>> 10) % ACCESSORY_COLORS.length];
  const maleOutfitStyle = MALE_OUTFIT_STYLES[(h >>> 14) % MALE_OUTFIT_STYLES.length];
  const maleFacialHair: MaleFacialHair =
    ((h >>> 17) % 100) < 45 ? 'light_stubble' : 'clean';
  return {
    ...skin,
    ...hair,
    gender,
    femaleHairStyle,
    maleHairStyle,
    femaleOutfit,
    maleOutfitStyle,
    maleFacialHair,
    accessoryColor,
  };
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
  themePalette?: ThemePalette,
): void {
  const hw = (TILE_W / 2) * zoom;
  const hh = (TILE_H / 2) * zoom;
  const checker = (gx + gy) % 2 === 0;

  let fill = '#3b4259';
  let stroke = '#282d3d';

  if (zone === 'DESK_ARCHITECT' || zone === 'COFFEE_LOUNGE') {
    const pal = themePalette ? (isNight ? themePalette.woodNight : themePalette.woodDay) : null;
    fill = pal
      ? checker
        ? pal[0]
        : pal[1]
      : checker
        ? isNight
          ? '#63452f'
          : '#a87849'
        : isNight
          ? '#563b28'
          : '#996c40';
    stroke = pal ? pal[2] : isNight ? '#362316' : '#6e4b2b';
  } else if (zone === 'DESK_CODING' || zone === 'DESK_QA') {
    const pal = themePalette ? (isNight ? themePalette.carpetNight : themePalette.carpetDay) : null;
    fill = pal
      ? checker
        ? pal[0]
        : pal[1]
      : checker
        ? isNight
          ? '#4b4658'
          : '#cfc6b4'
        : isNight
          ? '#433e50'
          : '#c4baa6';
    stroke = pal ? pal[2] : isNight ? '#332f3d' : '#a89e8c';
  } else if (zone === 'SERVER_RACK') {
    fill = checker ? '#1b2233' : '#161c2b';
    stroke = '#293954';
  } else if (zone === 'WAR_ROOM') {
    const pal = themePalette ? (isNight ? themePalette.confNight : themePalette.confDay) : null;
    fill = pal
      ? checker
        ? pal[0]
        : pal[1]
      : checker
        ? isNight
          ? '#1e3152'
          : '#2e4f82'
        : isNight
          ? '#192945'
          : '#284573';
    stroke = pal ? pal[2] : isNight ? '#2c4673' : '#4a73b0';
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

  drawWindow(topVertexX, topVertexY, leftEndX, leftEndY, 0.1, 0.32);
  drawWindow(topVertexX, topVertexY, leftEndX, leftEndY, 0.55, 0.73);
  drawWindow(topVertexX, topVertexY, leftEndX, leftEndY, 0.78, 0.94);

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
  deskLevel = 1,
): void {
  const z = zoom;
  ctx.save();

  if (drawExtraFurnitureProp(ctx, kind, cx, cy, z, timeSec, isOccupied)) {
    ctx.restore();
    return;
  }

  if (kind === 'exec_desk') {
    // Low 10px executive desk so seated face/eyes are never occluded
    drawIsoBox(ctx, cx, cy, 24, 12, 10, '#9c5230', '#73381d', '#542611', z);
    drawIsoBox(ctx, cx + 6 * z, cy - 10 * z, 7, 4, 5, '#364366', '#212940', '#161b2b', z);
    ctx.fillStyle = '#5cf0ff';
    ctx.fillRect(Math.round(cx + 3 * z), Math.round(cy - 17 * z), Math.ceil(7 * z), Math.ceil(4 * z));
    ctx.fillStyle = '#1d2230';
    ctx.fillRect(Math.round(cx - 9 * z), Math.round(cy - 9 * z), Math.ceil(9 * z), Math.ceil(3 * z));
    ctx.fillStyle = '#ffd147';
    ctx.fillRect(Math.round(cx - 5 * z), Math.round(cy - 5 * z), Math.ceil(10 * z), Math.ceil(3 * z));
    drawDeskEvolutionExtras(ctx, kind, cx, cy, z, timeSec, isOccupied, deskLevel);
  } else if (kind === 'dev_desk' || kind === 'clover_desk') {
    // Low 10px desk with monitors angled toward side corners so seated face & hands stay visible
    drawIsoBox(ctx, cx, cy, 22, 11, 10, '#d4b48c', '#a38560', '#7d6344', z);
    const screenColor = isOccupied
      ? Math.sin(timeSec * 8) > 0
        ? '#3be87a'
        : '#3cd8ff'
      : '#1b263b';
    ctx.fillStyle = '#141824';
    ctx.fillRect(Math.round(cx - 15 * z), Math.round(cy - 23 * z), Math.ceil(10 * z), Math.ceil(9 * z));
    ctx.fillRect(Math.round(cx + 5 * z), Math.round(cy - 23 * z), Math.ceil(10 * z), Math.ceil(9 * z));
    ctx.fillStyle = screenColor;
    ctx.fillRect(Math.round(cx - 13 * z), Math.round(cy - 21 * z), Math.ceil(6 * z), Math.ceil(5 * z));
    ctx.fillRect(Math.round(cx + 7 * z), Math.round(cy - 21 * z), Math.ceil(6 * z), Math.ceil(5 * z));
    // Mechanical keyboard + mousepad
    ctx.fillStyle = '#1b202e';
    ctx.fillRect(Math.round(cx - 7 * z), Math.round(cy - 10 * z), Math.ceil(10 * z), Math.ceil(3 * z));
    ctx.fillStyle = '#3cd8ff';
    ctx.fillRect(Math.round(cx - 6 * z), Math.round(cy - 9 * z), Math.ceil(8 * z), Math.ceil(1 * z));
    ctx.fillStyle = '#2a3347';
    ctx.fillRect(Math.round(cx + 5 * z), Math.round(cy - 10 * z), Math.ceil(5 * z), Math.ceil(3 * z));
    drawDeskEvolutionExtras(ctx, 'dev_desk', cx, cy, z, timeSec, isOccupied, deskLevel);
  } else if (kind === 'exec_coffee_table') {
    drawIsoBox(ctx, cx, cy, 18, 9, 6, '#3d2a20', '#5e3c23', '#422815', z);
    ctx.fillStyle = '#d9af48';
    ctx.fillRect(Math.round(cx - 4 * z), Math.round(cy - 8 * z), Math.ceil(8 * z), Math.ceil(2 * z));
  } else if (kind === 'qa_desk') {
    drawIsoBox(ctx, cx, cy, 20, 10, 10, '#cbb59a', '#9c8870', '#756450', z);
    ctx.fillStyle = '#141824';
    ctx.fillRect(Math.round(cx + 4 * z), Math.round(cy - 23 * z), Math.ceil(12 * z), Math.ceil(9 * z));
    ctx.fillStyle = isOccupied ? '#ffbe3b' : '#243147';
    ctx.fillRect(Math.round(cx + 6 * z), Math.round(cy - 21 * z), Math.ceil(8 * z), Math.ceil(5 * z));
    ctx.fillStyle = '#1b202e';
    ctx.fillRect(Math.round(cx - 8 * z), Math.round(cy - 10 * z), Math.ceil(10 * z), Math.ceil(3 * z));
    ctx.fillStyle = '#2a3347';
    ctx.fillRect(Math.round(cx + 4 * z), Math.round(cy - 10 * z), Math.ceil(4 * z), Math.ceil(3 * z));
    drawDeskEvolutionExtras(ctx, kind, cx, cy, z, timeSec, isOccupied, deskLevel);
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
  } else if (kind === 'war_table_part') {
    // Multi-tile conference table collision extension: intentional no-op
  } else if (
    kind === 'war_table' ||
    kind === 'war_table_oval' ||
    kind === 'war_table_round' ||
    kind === 'war_table_rect' ||
    kind === 'war_table_u' ||
    kind === 'war_table_s'
  ) {
    const shiftX = kind === 'war_table_rect' ? 32 * z : kind === 'war_table' || kind === 'war_table_u' ? 0 : 16 * z;
    const shiftY = kind === 'war_table_rect' ? 16 * z : kind === 'war_table' || kind === 'war_table_u' ? 0 : 8 * z;
    drawIsoBox(ctx, cx + shiftX, cy + shiftY, 24, 12, 10.5, '#b5794a', '#784a29', '#54321a', z);
    ctx.fillStyle = '#ffe159';
    ctx.fillRect(Math.round(cx + shiftX - 6 * z), Math.round(cy + shiftY - 13.5 * z), Math.ceil(5 * z), Math.ceil(4 * z));
    ctx.fillStyle = '#ff7eb9';
    ctx.fillRect(Math.round(cx + shiftX + 2 * z), Math.round(cy + shiftY - 12 * z), Math.ceil(5 * z), Math.ceil(4 * z));
  } else if (kind === 'whiteboard_l' || kind === 'whiteboard_r') {
    // 2:1 X-axis isometric Illuminated Presentation Screen (whiteboard_l at gx, whiteboard_r at gx+1 join seamlessly)
    drawIsoBox(ctx, cx, cy, 16, 6, 4, '#454e66', '#2c3345', '#1e2330', z);
    ctx.save();
    ctx.translate(cx, cy);
    // Shear Y by +0.5 along X so horizontal rect coordinates project onto the NW->SE 2:1 isometric axis
    ctx.transform(1, 0.5, 0, 1, 0, 0);

    const bx = -16.5 * z;
    const by = -42 * z;
    const bw = 33 * z;
    const bh = 30 * z;

    if (isHovered || isOccupied) {
      ctx.fillStyle = isHovered ? '#ffe64d' : 'rgba(60, 216, 255, 0.55)';
      ctx.fillRect(Math.round(bx - 1.5 * z), Math.round(by - 2 * z), Math.ceil(bw + 3 * z), Math.ceil(bh + 4 * z));
    }
    ctx.fillStyle = '#1a2030';
    ctx.fillRect(Math.round(bx), Math.round(by), Math.ceil(bw), Math.ceil(bh));
    ctx.fillStyle = isOccupied ? '#f7fbff' : '#e6eefc';
    ctx.fillRect(Math.round(bx + 1.5 * z), Math.round(by + 2 * z), Math.ceil(bw - 3 * z), Math.ceil(bh - 4 * z));

    if (kind === 'whiteboard_l') {
      // Bar charts on left screen
      ctx.fillStyle = '#3cd8ff';
      ctx.fillRect(Math.round(bx + 4 * z), Math.round(by + 15 * z), Math.ceil(4 * z), Math.ceil(10 * z));
      ctx.fillStyle = '#3be87a';
      ctx.fillRect(Math.round(bx + 10 * z), Math.round(by + 10 * z), Math.ceil(4 * z), Math.ceil(15 * z));
      ctx.fillStyle = '#ffbe3b';
      ctx.fillRect(Math.round(bx + 16 * z), Math.round(by + 13 * z), Math.ceil(4 * z), Math.ceil(12 * z));
      ctx.fillStyle = '#ff5666';
      ctx.fillRect(Math.round(bx + 22 * z), Math.round(by + 7 * z), Math.ceil(4 * z), Math.ceil(18 * z));
      ctx.fillStyle = '#252b3b';
      ctx.fillRect(Math.round(bx + 4 * z), Math.round(by + 4 * z), Math.ceil(18 * z), Math.ceil(2 * z));

      ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Silkscreen", monospace`;
      ctx.fillStyle = isHovered ? '#ffe64d' : '#9ee8ff';
      ctx.textAlign = 'center';
      ctx.fillText(whiteboardLabel, 16 * z, by - 5 * z);
    } else {
      // Architecture nodes + slide bullets on right screen
      ctx.fillStyle = '#b07cff';
      ctx.fillRect(Math.round(bx + 4 * z), Math.round(by + 6 * z), Math.ceil(8 * z), Math.ceil(6 * z));
      ctx.fillStyle = '#3cd8ff';
      ctx.fillRect(Math.round(bx + 19 * z), Math.round(by + 6 * z), Math.ceil(8 * z), Math.ceil(6 * z));
      ctx.fillStyle = '#394666';
      ctx.fillRect(Math.round(bx + 12 * z), Math.round(by + 8 * z), Math.ceil(7 * z), Math.ceil(2 * z));
      ctx.fillRect(Math.round(bx + 4 * z), Math.round(by + 16 * z), Math.ceil(22 * z), Math.ceil(2 * z));
      ctx.fillRect(Math.round(bx + 4 * z), Math.round(by + 21 * z), Math.ceil(17 * z), Math.ceil(2 * z));
    }
    ctx.restore();
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
    if (isOccupied) {
      // Open pixel pepperoni pizza box on the lounge table
      ctx.fillStyle = '#f2e6d0';
      ctx.fillRect(Math.round(cx - 8 * z), Math.round(cy - 15 * z), Math.ceil(16 * z), Math.ceil(10 * z));
      ctx.fillStyle = '#f5b942';
      ctx.fillRect(Math.round(cx - 6 * z), Math.round(cy - 13 * z), Math.ceil(12 * z), Math.ceil(6 * z));
      ctx.fillStyle = '#d93838';
      ctx.fillRect(Math.round(cx - 4 * z), Math.round(cy - 12 * z), Math.ceil(2 * z), Math.ceil(2 * z));
      ctx.fillRect(Math.round(cx + 1 * z), Math.round(cy - 10 * z), Math.ceil(2 * z), Math.ceil(2 * z));
      ctx.fillRect(Math.round(cx + 3 * z), Math.round(cy - 12 * z), Math.ceil(2 * z), Math.ceil(2 * z));
    } else {
      ctx.fillStyle = '#fff5e0';
      ctx.fillRect(Math.round(cx - 4 * z), Math.round(cy - 11 * z), Math.ceil(4 * z), Math.ceil(3 * z));
      ctx.fillStyle = '#ffe64d';
      ctx.fillRect(Math.round(cx + 2 * z), Math.round(cy - 10 * z), Math.ceil(3 * z), Math.ceil(3 * z));
    }
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

function isCostumeEvent(kind?: FloorEventKind | null): kind is 'STAR_WARS_PARTY' | 'SUPERHERO_PARTY' | 'HALLOWEEN_PARTY' {
  return kind === 'STAR_WARS_PARTY' || kind === 'SUPERHERO_PARTY' || kind === 'HALLOWEEN_PARTY';
}

function hasEnclosingCostumeHelmet(
  eventKind?: FloorEventKind | null,
  variant = 0,
): boolean {
  if (!isCostumeEvent(eventKind)) return false;
  if (eventKind === 'STAR_WARS_PARTY') return variant === 1 || variant === 3;
  if (eventKind === 'SUPERHERO_PARTY') return variant === 2;
  return variant === 1 || variant === 3;
}

function suppressesTopChignon(
  eventKind?: FloorEventKind | null,
  variant = 0,
): boolean {
  if (!isCostumeEvent(eventKind)) return false;
  if (hasEnclosingCostumeHelmet(eventKind, variant)) return true;
  if (eventKind === 'STAR_WARS_PARTY') return variant === 0 || variant === 2;
  if (eventKind === 'SUPERHERO_PARTY') return variant === 0;
  return variant === 0;
}

function drawSpriteCostumeOverlay(
  rect: (x: number, y: number, w: number, h: number, color: string) => void,
  cx: number,
  baseY: number,
  z: number,
  dirFlip: number,
  variant: number,
  hairColor: string,
  eventKind: 'STAR_WARS_PARTY' | 'SUPERHERO_PARTY' | 'HALLOWEEN_PARTY',
  timeSec: number,
  isFemale = false,
  isPureBack = false,
): void {
  const saberSide = dirFlip > 0 ? 1 : -1;
  if (isFemale) {
    if (eventKind === 'STAR_WARS_PARTY') {
      if (variant === 0) {
        // Graceful Jedi hooded robe + hourglass cream tunic + lightsaber
        rect(cx - 6.5 * z, baseY - 19 * z, 13 * z, 11 * z, '#6b4226');
        rect(cx - 5 * z, baseY - 18.5 * z, 10 * z, 3.5 * z, '#e7d7b8');
        rect(cx - 4 * z, baseY - 15 * z, 8 * z, 3.5 * z, '#e7d7b8');
        rect(cx - 5.2 * z, baseY - 11.5 * z, 10.4 * z, 3.5 * z, '#e7d7b8');
        if (!isPureBack) {
          rect(cx - 1.5 * z, baseY - 18.5 * z, 3 * z, 3 * z, '#cbb692');
        }
        rect(cx - 4 * z, baseY - 14 * z, 8 * z, 1.6 * z, '#452814');
        rect(cx - 5.5 * z, baseY - 37.5 * z, 11 * z, 2 * z, '#6b4226');
        rect(cx - 6.8 * z, baseY - 36 * z, 13.6 * z, 4 * z, '#6b4226');
        if (!isPureBack) {
          rect(cx - 5.5 * z, baseY - 35 * z, 11 * z, 2 * z, '#452814');
        }
        const hiltX = cx + saberSide * 6.5 * z;
        rect(hiltX, baseY - 15 * z, 1.8 * z, 3.5 * z, '#b4bed4');
        const bladeColor = Math.sin(timeSec * 8) > 0 ? '#3cd8ff' : '#3be87a';
        rect(hiltX, baseY - 29 * z, 1.8 * z, 14 * z, bladeColor);
        rect(hiltX + 0.4 * z, baseY - 28 * z, 1 * z, 12 * z, '#ffffff');
      } else if (variant === 1) {
        // Sleek Sith Lady armor + flared obsidian cape + crimson lightsaber
        rect(cx - 6.8 * z, baseY - 19 * z, 13.6 * z, 12 * z, '#11131c');
        rect(cx - 2.2 * z, baseY - 22 * z, 4.4 * z, 4 * z, '#1d2232');
        rect(cx - 5 * z, baseY - 18.5 * z, 10 * z, 3.5 * z, '#1d2232');
        rect(cx - 4 * z, baseY - 15 * z, 8 * z, 4 * z, '#1d2232');
        rect(cx - 5.2 * z, baseY - 11 * z, 10.4 * z, 3 * z, '#161922');
        if (!isPureBack) {
          rect(cx - 2.5 * z, baseY - 17.5 * z, 5 * z, 3 * z, '#4a556e');
        }
        rect(cx - 4 * z, baseY - 13 * z, 8 * z, 1.2 * z, '#ff384c');
        rect(cx - 5.5 * z, baseY - 36.5 * z, 11 * z, 2 * z, '#161922');
        rect(cx - 6.5 * z, baseY - 35 * z, 13 * z, 11 * z, '#161922');
        rect(cx - 4.5 * z, baseY - 24 * z, 9 * z, 2.5 * z, '#11131c');
        rect(cx - 5.5 * z, baseY - 34.5 * z, 11 * z, 3 * z, '#2a3040');
        if (!isPureBack) {
          rect(cx - 4.2 * z, baseY - 29 * z, 3.2 * z, 1.8 * z, '#ff384c');
          rect(cx + 1 * z, baseY - 29 * z, 3.2 * z, 1.8 * z, '#ff384c');
        }
        const hiltX = cx + saberSide * 6.5 * z;
        rect(hiltX, baseY - 15 * z, 1.8 * z, 3.5 * z, '#9aa7c7');
        rect(hiltX, baseY - 30 * z, 1.8 * z, 15 * z, '#ff384c');
        rect(hiltX + 0.4 * z, baseY - 29 * z, 1 * z, 13 * z, '#ffb3bc');
      } else if (variant === 2) {
        // Princess Leia Rebel silk hourglass gown + sculpted twin buns + sleek visor
        rect(cx - 5 * z, baseY - 18.5 * z, 10 * z, 3.5 * z, '#f4f6fc');
        rect(cx - 4 * z, baseY - 15 * z, 8 * z, 3 * z, '#f4f6fc');
        rect(cx - 5 * z, baseY - 12 * z, 10 * z, 2 * z, '#e9edf7');
        rect(cx - 6 * z, baseY - 10 * z, 12 * z, 3.5 * z, '#f4f6fc');
        rect(cx - 4 * z, baseY - 13.5 * z, 8 * z, 1.5 * z, '#c9d2e8');
        rect(cx - 8.5 * z, baseY - 32.5 * z, 2.5 * z, 5.5 * z, hairColor);
        rect(cx + 6 * z, baseY - 32.5 * z, 2.5 * z, 5.5 * z, hairColor);
        if (!isPureBack) {
          rect(cx - 4.5 * z, baseY - 29.8 * z, 9 * z, 1.8 * z, '#ff9c3b');
        }
      } else {
        // Contoured Bo-Katan Mandalorian beskar armor + tapered T-visor helmet
        rect(cx - 2.2 * z, baseY - 22 * z, 4.4 * z, 4 * z, '#525d78');
        rect(cx - 5 * z, baseY - 18.5 * z, 10 * z, 3.5 * z, '#8f9bb8');
        rect(cx - 4 * z, baseY - 15 * z, 8 * z, 4 * z, '#7a87a3');
        rect(cx - 4 * z, baseY - 18 * z, 8 * z, 4.5 * z, '#b4bed4');
        rect(cx - 5 * z, baseY - 36 * z, 10 * z, 2 * z, '#b4bed4');
        rect(cx - 6 * z, baseY - 34.5 * z, 12 * z, 11 * z, '#b4bed4');
        rect(cx - 4.5 * z, baseY - 23.5 * z, 9 * z, 2 * z, '#8f9bb8');
        rect(cx - 5 * z, baseY - 34 * z, 10 * z, 2.5 * z, '#7a87a3');
        if (!isPureBack) {
          rect(cx - 4.5 * z, baseY - 29.8 * z, 9 * z, 2.2 * z, '#11131c');
          rect(cx - 1.2 * z, baseY - 28 * z, 2.4 * z, 5 * z, '#11131c');
        }
        rect(cx + 5.5 * z, baseY - 39 * z, 1.5 * z, 7 * z, '#ff9c3b');
      }
    } else if (eventKind === 'SUPERHERO_PARTY') {
      if (variant === 0) {
        // Batgirl scalloped cape + hourglass dark suit + yellow belt + eared cowl
        rect(cx - 6.8 * z, baseY - 19 * z, 13.6 * z, 11.5 * z, '#161a26');
        rect(cx - 5 * z, baseY - 18.5 * z, 10 * z, 3.5 * z, '#2c344a');
        rect(cx - 4 * z, baseY - 15 * z, 8 * z, 4 * z, '#2c344a');
        if (!isPureBack) {
          rect(cx - 2 * z, baseY - 17.5 * z, 4 * z, 1.8 * z, '#ffd147');
        }
        rect(cx - 4 * z, baseY - 12.5 * z, 8 * z, 1.5 * z, '#ffd147');
        rect(cx - 6 * z, baseY - 36 * z, 12 * z, 8.5 * z, '#1b2030');
        rect(cx - 5.8 * z, baseY - 39.5 * z, 2.2 * z, 3.8 * z, '#1b2030');
        rect(cx + 3.6 * z, baseY - 39.5 * z, 2.2 * z, 3.8 * z, '#1b2030');
        if (!isPureBack) {
          rect(cx - 3.8 * z, baseY - 29.2 * z, 2.8 * z, 1.6 * z, '#ffffff');
          rect(cx + 1 * z, baseY - 29.2 * z, 2.8 * z, 1.6 * z, '#ffffff');
        }
      } else if (variant === 1) {
        // Supergirl crimson cape + hourglass blue top + pleated crimson skirt + emblem
        rect(cx - 6.5 * z, baseY - 19 * z, 13 * z, 12 * z, '#d93838');
        if (!isPureBack) {
          rect(cx - 5 * z, baseY - 18.5 * z, 10 * z, 3.5 * z, '#2b62d9');
          rect(cx - 4 * z, baseY - 15 * z, 8 * z, 3.5 * z, '#2b62d9');
          rect(cx - 5.5 * z, baseY - 11.5 * z, 11 * z, 4 * z, '#d93838');
          rect(cx - 4 * z, baseY - 12 * z, 8 * z, 1.2 * z, '#ffd147');
          rect(cx - 2.5 * z, baseY - 18 * z, 5 * z, 3 * z, '#ffd147');
          rect(cx - 1 * z, baseY - 17.2 * z, 2 * z, 1.6 * z, '#d93838');
        }
      } else if (variant === 2) {
        // Sleek Iron Rescue crimson-gold hourglass armor + armored gorget + cyan arc reactor
        rect(cx - 2.2 * z, baseY - 22.5 * z, 4.4 * z, 4.5 * z, '#9e1f2c');
        rect(cx - 5 * z, baseY - 18.5 * z, 10 * z, 3.5 * z, '#c42838');
        rect(cx - 4 * z, baseY - 15 * z, 8 * z, 4.5 * z, '#c42838');
        rect(cx - 3.8 * z, baseY - 18 * z, 7.6 * z, 5 * z, '#ffd147');
        if (!isPureBack) {
          rect(cx - 1.8 * z, baseY - 17.5 * z, 3.6 * z, 3 * z, '#7ef3ff');
          rect(cx - 0.8 * z, baseY - 16.8 * z, 1.6 * z, 1.6 * z, '#ffffff');
        }
        rect(cx - 5 * z, baseY - 36 * z, 10 * z, 2 * z, '#c42838');
        rect(cx - 6 * z, baseY - 34.5 * z, 12 * z, 11 * z, '#c42838');
        if (!isPureBack) {
          rect(cx - 4.2 * z, baseY - 32.5 * z, 8.4 * z, 9.5 * z, '#ffd147');
          rect(cx - 3.8 * z, baseY - 29.2 * z, 2.8 * z, 1.6 * z, '#7ef3ff');
          rect(cx + 1 * z, baseY - 29.2 * z, 2.8 * z, 1.6 * z, '#7ef3ff');
        }
      } else {
        // Wonder Heroine gold tiara + domino mask + crimson-gold corset & skirt
        rect(cx - 4.8 * z, baseY - 18 * z, 9.6 * z, 2 * z, '#ffd147');
        rect(cx - 4 * z, baseY - 16 * z, 8 * z, 4 * z, '#b82e43');
        rect(cx - 5.5 * z, baseY - 12 * z, 11 * z, 4.5 * z, '#243b6b');
        rect(cx - 4.2 * z, baseY - 12.5 * z, 8.4 * z, 1.5 * z, '#ffd147');
        rect(cx - 5 * z, baseY - 35.8 * z, 10 * z, 2 * z, '#ffd147');
        if (!isPureBack) {
          rect(cx - 1 * z, baseY - 37 * z, 2 * z, 2 * z, '#ff5666');
          rect(cx - 4.8 * z, baseY - 29.8 * z, 9.6 * z, 2 * z, '#1b2030');
          rect(cx - 3.2 * z, baseY - 29.3 * z, 1.2 * z, 1 * z, '#ffffff');
          rect(cx + 2 * z, baseY - 29.3 * z, 1.2 * z, 1 * z, '#ffffff');
        }
      }
    } else {
      // HALLOWEEN_PARTY (female)
      if (variant === 0) {
        // Corseted velvet witch gown + flared A-line skirt + pointed witch hat
        rect(cx - 5 * z, baseY - 18.5 * z, 10 * z, 3.5 * z, '#1a1529');
        rect(cx - 4 * z, baseY - 15 * z, 8 * z, 3.5 * z, '#1a1529');
        rect(cx - 5 * z, baseY - 11.5 * z, 10 * z, 2 * z, '#241c38');
        rect(cx - 6 * z, baseY - 9.5 * z, 12 * z, 3 * z, '#1a1529');
        rect(cx - 4 * z, baseY - 13 * z, 8 * z, 1.5 * z, '#b07cff');
        rect(cx - 8.5 * z, baseY - 36.5 * z, 17 * z, 2.2 * z, '#241c38');
        rect(cx - 5.5 * z, baseY - 40 * z, 11 * z, 3.6 * z, '#241c38');
        rect(cx - 3.5 * z, baseY - 43.2 * z, 7 * z, 3.4 * z, '#241c38');
        rect(cx - 1.5 * z, baseY - 45.8 * z, 3 * z, 2.8 * z, '#241c38');
        rect(cx - 5.5 * z, baseY - 38.2 * z, 11 * z, 1.6 * z, '#b07cff');
      } else if (variant === 1) {
        // Cute rounded Jack-o'-Lantern head + cinched dark dress
        rect(cx - 2.2 * z, baseY - 22.5 * z, 4.4 * z, 4.5 * z, '#241c38');
        rect(cx - 5 * z, baseY - 18.5 * z, 10 * z, 3.5 * z, '#241c38');
        rect(cx - 4 * z, baseY - 15 * z, 8 * z, 3.5 * z, '#241c38');
        rect(cx - 5.5 * z, baseY - 11.5 * z, 11 * z, 4 * z, '#1a1529');
        rect(cx - 4 * z, baseY - 13 * z, 8 * z, 1.4 * z, '#ff7b1c');
        rect(cx - 6 * z, baseY - 35.5 * z, 12 * z, 1.5 * z, '#ff7b1c');
        rect(cx - 7 * z, baseY - 34 * z, 14 * z, 11 * z, '#ff7b1c');
        rect(cx - 5 * z, baseY - 33.5 * z, 10 * z, 10.5 * z, '#ff9838');
        rect(cx - 1.5 * z, baseY - 38 * z, 3 * z, 2.5 * z, '#3be87a');
        if (!isPureBack) {
          rect(cx - 3.8 * z, baseY - 29.5 * z, 2.8 * z, 2.5 * z, '#ffe64d');
          rect(cx + 1 * z, baseY - 29.5 * z, 2.8 * z, 2.5 * z, '#ffe64d');
          rect(cx - 3 * z, baseY - 25.2 * z, 6 * z, 1.6 * z, '#ffe64d');
        }
      } else if (variant === 2) {
        // Vampire Countess high crimson collar + velvet corset + dainty fangs
        rect(cx - 6.8 * z, baseY - 23.5 * z, 4.8 * z, 14.5 * z, '#161822');
        rect(cx + 2 * z, baseY - 23.5 * z, 4.8 * z, 14.5 * z, '#161822');
        rect(cx - 6.5 * z, baseY - 24.5 * z, 2.5 * z, 5.5 * z, '#b82e43');
        rect(cx + 4 * z, baseY - 24.5 * z, 2.5 * z, 5.5 * z, '#b82e43');
        if (!isPureBack) {
          rect(cx - 4 * z, baseY - 18 * z, 8 * z, 6.5 * z, '#d93838');
          rect(cx - 1 * z, baseY - 17.5 * z, 2 * z, 5 * z, '#161822');
          rect(cx - 1.1 * z + saberSide * 0.4 * z, baseY - 23.6 * z, 0.8 * z, 1 * z, '#ffffff');
          rect(cx + 0.6 * z + saberSide * 0.4 * z, baseY - 23.6 * z, 0.8 * z, 1 * z, '#ffffff');
        }
      } else {
        // Cute Ghost / Skeleton draped hourglass tunic & rounded hood
        rect(cx - 5 * z, baseY - 18.5 * z, 10 * z, 3.5 * z, '#eef2fc');
        rect(cx - 4 * z, baseY - 15 * z, 8 * z, 3.5 * z, '#eef2fc');
        rect(cx - 5.5 * z, baseY - 11.5 * z, 11 * z, 4 * z, '#eef2fc');
        rect(cx - 3 * z, baseY - 17.5 * z, 6 * z, 1.4 * z, '#cfd6e6');
        rect(cx - 2.5 * z, baseY - 14.5 * z, 5 * z, 1.4 * z, '#cfd6e6');
        rect(cx - 5.5 * z, baseY - 36 * z, 11 * z, 2 * z, '#eef2fc');
        rect(cx - 6.5 * z, baseY - 34.5 * z, 13 * z, 12 * z, '#eef2fc');
        if (!isPureBack) {
          rect(cx - 3.8 * z, baseY - 29.2 * z, 2.6 * z, 2.8 * z, '#1b2030');
          rect(cx + 1.2 * z, baseY - 29.2 * z, 2.6 * z, 2.8 * z, '#1b2030');
          rect(cx - 2.8 * z, baseY - 29 * z, 1 * z, 1 * z, '#ffffff');
          rect(cx + 2.2 * z, baseY - 29 * z, 1 * z, 1 * z, '#ffffff');
        }
      }
    }
    return;
  }

  if (eventKind === 'STAR_WARS_PARTY') {
    if (variant === 0) {
      // Athletic V-taper Jedi Master hooded cloak + robe sleeves + crossed martial tunic + lightsaber
      rect(cx - 7.8 * z, baseY - 19.6 * z, 15.6 * z, 11.6 * z, '#6b4226');
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.4 * z, '#6b4226');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.4 * z, '#6b4226');
      rect(cx - 8.2 * z, baseY - 15.6 * z, 2.4 * z, 3.8 * z, '#54321b');
      rect(cx + 5.8 * z, baseY - 15.6 * z, 2.4 * z, 3.8 * z, '#54321b');
      rect(cx - 6.6 * z, baseY - 19.2 * z, 13.2 * z, 3.8 * z, '#e7d7b8');
      rect(cx - 5.2 * z, baseY - 15.4 * z, 10.4 * z, 3.8 * z, '#e7d7b8');
      rect(cx - 6 * z, baseY - 11.6 * z, 12 * z, 3 * z, '#d8c5a2');
      if (!isPureBack) {
        rect(cx - 1.8 * z, baseY - 19.2 * z, 3.6 * z, 3.5 * z, '#cbb692');
      }
      rect(cx - 5.4 * z, baseY - 13.8 * z, 10.8 * z, 1.8 * z, '#452814');
      rect(cx - 1.2 * z, baseY - 13.8 * z, 2.4 * z, 1.8 * z, '#b4bed4');
      rect(cx - 6 * z, baseY - 38.2 * z, 12 * z, 2.4 * z, '#6b4226');
      rect(cx - 7.4 * z, baseY - 36.2 * z, 14.8 * z, 4.4 * z, '#6b4226');
      if (!isPureBack) {
        rect(cx - 6.2 * z, baseY - 35 * z, 12.4 * z, 2.2 * z, '#452814');
      }
      const hiltX = cx + saberSide * 8 * z;
      rect(hiltX, baseY - 15.5 * z, 2 * z, 4 * z, '#b4bed4');
      const bladeColor = Math.sin(timeSec * 8) > 0 ? '#3cd8ff' : '#3be87a';
      rect(hiltX, baseY - 29.5 * z, 2 * z, 14 * z, bladeColor);
      rect(hiltX + 0.5 * z, baseY - 28.5 * z, 1 * z, 12 * z, '#ffffff');
    } else if (variant === 1) {
      // Sculpted V-taper Darth Vader obsidian armor + armored arms + stepped dome helmet + crimson saber
      rect(cx - 8.2 * z, baseY - 19.6 * z, 16.4 * z, 12.5 * z, '#11131c');
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.4 * z, '#1d2232');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.4 * z, '#1d2232');
      rect(cx - 8 * z, baseY - 15.6 * z, 2 * z, 3.8 * z, '#161922');
      rect(cx + 6 * z, baseY - 15.6 * z, 2 * z, 3.8 * z, '#161922');
      rect(cx - 2.8 * z, baseY - 22.5 * z, 5.6 * z, 3.5 * z, '#1d2232');
      rect(cx - 6.8 * z, baseY - 19.2 * z, 13.6 * z, 4 * z, '#1d2232');
      rect(cx - 5.2 * z, baseY - 15.2 * z, 10.4 * z, 4 * z, '#1d2232');
      if (!isPureBack) {
        rect(cx - 3 * z, baseY - 18 * z, 6 * z, 3.6 * z, '#4a556e');
        rect(cx - 2.2 * z, baseY - 17.2 * z, 1.4 * z, 1.4 * z, '#ff384c');
        rect(cx + 0.8 * z, baseY - 17.2 * z, 1.4 * z, 1.4 * z, '#3cd8ff');
      }
      rect(cx - 5.2 * z, baseY - 12.8 * z, 10.4 * z, 1.4 * z, '#2a3040');
      rect(cx - 6 * z, baseY - 37 * z, 12 * z, 2.2 * z, '#161922');
      rect(cx - 7.4 * z, baseY - 35.2 * z, 14.8 * z, 11.5 * z, '#161922');
      rect(cx - 5.6 * z, baseY - 24 * z, 11.2 * z, 2.2 * z, '#11131c');
      rect(cx - 6.4 * z, baseY - 34.5 * z, 12.8 * z, 3.2 * z, '#2a3040');
      if (!isPureBack) {
        rect(cx - 4.6 * z, baseY - 29.2 * z, 3.6 * z, 2 * z, '#ff384c');
        rect(cx + 1 * z, baseY - 29.2 * z, 3.6 * z, 2 * z, '#ff384c');
        rect(cx - 2.4 * z, baseY - 25.6 * z, 4.8 * z, 2.4 * z, '#2a3040');
      }
      const hiltX = cx + saberSide * 8 * z;
      rect(hiltX, baseY - 15.5 * z, 2 * z, 4 * z, '#9aa7c7');
      rect(hiltX, baseY - 30.5 * z, 2 * z, 15 * z, '#ff384c');
      rect(hiltX + 0.5 * z, baseY - 29.5 * z, 1 * z, 13 * z, '#ffb3bc');
    } else if (variant === 2) {
      // Athletic Rebel Commander V-taper white tunic + sleeves + comms ear-pods + amber blast visor
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#f4f6fc');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#f4f6fc');
      rect(cx - 8 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#e9edf7');
      rect(cx + 6 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#e9edf7');
      rect(cx - 6.8 * z, baseY - 19.2 * z, 13.6 * z, 4 * z, '#f4f6fc');
      rect(cx - 5.4 * z, baseY - 15.2 * z, 10.8 * z, 4 * z, '#f4f6fc');
      rect(cx - 6 * z, baseY - 11.4 * z, 12 * z, 2.4 * z, '#e9edf7');
      if (!isPureBack) {
        rect(cx - 2 * z, baseY - 18.2 * z, 4 * z, 3.2 * z, '#dce4f7');
      }
      rect(cx - 5.4 * z, baseY - 13 * z, 10.8 * z, 1.6 * z, '#c9d2e8');
      rect(cx - 1.2 * z, baseY - 13 * z, 2.4 * z, 1.6 * z, '#ff9c3b');
      rect(cx - 8.6 * z, baseY - 32.5 * z, 2.4 * z, 5.5 * z, hairColor);
      rect(cx + 6.2 * z, baseY - 32.5 * z, 2.4 * z, 5.5 * z, hairColor);
      if (!isPureBack) {
        rect(cx - 5.2 * z, baseY - 30 * z, 10.4 * z, 2.2 * z, '#ff9c3b');
        rect(cx - 3.8 * z, baseY - 29.6 * z, 3 * z, 0.9 * z, '#ffe6a3');
      }
    } else {
      // Athletic Mandalorian beskar pauldrons + vambraces + V-taper chestplate + stepped T-visor dome
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#b4bed4');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#b4bed4');
      rect(cx - 8 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#596580');
      rect(cx + 6 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#596580');
      rect(cx - 2.8 * z, baseY - 22.5 * z, 5.6 * z, 3.5 * z, '#454e66');
      rect(cx - 6.8 * z, baseY - 19.2 * z, 13.6 * z, 4 * z, '#8f9bb8');
      rect(cx - 5.2 * z, baseY - 15.2 * z, 10.4 * z, 4 * z, '#7a87a3');
      rect(cx - 5 * z, baseY - 18.4 * z, 10 * z, 5 * z, '#b4bed4');
      rect(cx - 5.4 * z, baseY - 12.8 * z, 10.8 * z, 1.6 * z, '#593724');
      rect(cx - 5.8 * z, baseY - 36.6 * z, 11.6 * z, 2.2 * z, '#b4bed4');
      rect(cx - 6.8 * z, baseY - 34.8 * z, 13.6 * z, 11.2 * z, '#b4bed4');
      rect(cx - 5.2 * z, baseY - 23.8 * z, 10.4 * z, 1.8 * z, '#8f9bb8');
      rect(cx - 5.8 * z, baseY - 34.2 * z, 11.6 * z, 2.6 * z, '#7a87a3');
      if (!isPureBack) {
        rect(cx - 5 * z, baseY - 29.8 * z, 10 * z, 2.4 * z, '#11131c');
        rect(cx - 1.4 * z, baseY - 27.8 * z, 2.8 * z, 5.4 * z, '#11131c');
      }
      rect(cx + 6.2 * z, baseY - 39.5 * z, 1.6 * z, 7.5 * z, '#ff9c3b');
    }
  } else if (eventKind === 'SUPERHERO_PARTY') {
    if (variant === 0) {
      // Dark Knight V-taper kevlar armor + gauntlets + scalloped dark cape + gold utility belt + pointed cowl
      rect(cx - 8.2 * z, baseY - 19.6 * z, 16.4 * z, 12.4 * z, '#161a26');
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#2c344a');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#2c344a');
      rect(cx - 8 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#1b2030');
      rect(cx + 6 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#1b2030');
      rect(cx - 6.8 * z, baseY - 19.2 * z, 13.6 * z, 4 * z, '#2c344a');
      rect(cx - 5.2 * z, baseY - 15.2 * z, 10.4 * z, 4.2 * z, '#2c344a');
      if (!isPureBack) {
        rect(cx - 2.6 * z, baseY - 18 * z, 5.2 * z, 2 * z, '#ffd147');
      }
      rect(cx - 5.4 * z, baseY - 12.4 * z, 10.8 * z, 1.8 * z, '#ffd147');
      rect(cx - 6.8 * z, baseY - 37.2 * z, 13.6 * z, 10 * z, '#1b2030');
      rect(cx - 6.6 * z, baseY - 41.2 * z, 2.6 * z, 4.2 * z, '#1b2030');
      rect(cx + 4 * z, baseY - 41.2 * z, 2.6 * z, 4.2 * z, '#1b2030');
      if (!isPureBack) {
        rect(cx - 4.2 * z, baseY - 29.2 * z, 3 * z, 1.8 * z, '#ffffff');
        rect(cx + 1.2 * z, baseY - 29.2 * z, 3 * z, 1.8 * z, '#ffffff');
      }
    } else if (variant === 1) {
      // Heroic crimson cape + athletic V-taper royal-blue suit & sleeves + gold belt + diamond emblem
      rect(cx - 8 * z, baseY - 19.6 * z, 16 * z, 12.6 * z, '#d93838');
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#2b62d9');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#2b62d9');
      rect(cx - 8 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#2b62d9');
      rect(cx + 6 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#2b62d9');
      if (!isPureBack) {
        rect(cx - 6.8 * z, baseY - 19.2 * z, 13.6 * z, 4.2 * z, '#2b62d9');
        rect(cx - 5.2 * z, baseY - 15 * z, 10.4 * z, 4.2 * z, '#2b62d9');
        rect(cx - 5.2 * z, baseY - 12.2 * z, 10.4 * z, 1.4 * z, '#ffd147');
        rect(cx - 3 * z, baseY - 18.4 * z, 6 * z, 3.6 * z, '#ffd147');
        rect(cx - 1.2 * z, baseY - 17.4 * z, 2.4 * z, 1.8 * z, '#d93838');
      }
    } else if (variant === 2) {
      // V-taper crimson-gold Mark armor + armored gauntlets + glowing cyan arc reactor + faceplate helmet
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#c42838');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#c42838');
      rect(cx - 8 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#ffd147');
      rect(cx + 6 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#ffd147');
      rect(cx - 2.8 * z, baseY - 22.5 * z, 5.6 * z, 3.6 * z, '#9e1f2c');
      rect(cx - 6.8 * z, baseY - 19.2 * z, 13.6 * z, 4.2 * z, '#c42838');
      rect(cx - 5.2 * z, baseY - 15 * z, 10.4 * z, 4.4 * z, '#c42838');
      rect(cx - 4.8 * z, baseY - 18.4 * z, 9.6 * z, 5.6 * z, '#ffd147');
      if (!isPureBack) {
        rect(cx - 2 * z, baseY - 17.8 * z, 4 * z, 3.4 * z, '#7ef3ff');
        rect(cx - 1 * z, baseY - 17 * z, 2 * z, 1.8 * z, '#ffffff');
      }
      rect(cx - 5.8 * z, baseY - 36.6 * z, 11.6 * z, 2.2 * z, '#c42838');
      rect(cx - 6.8 * z, baseY - 34.8 * z, 13.6 * z, 11.2 * z, '#c42838');
      if (!isPureBack) {
        rect(cx - 4.8 * z, baseY - 32.8 * z, 9.6 * z, 9.6 * z, '#ffd147');
        rect(cx - 4.2 * z, baseY - 29.2 * z, 3 * z, 1.8 * z, '#7ef3ff');
        rect(cx + 1.2 * z, baseY - 29.2 * z, 3 * z, 1.8 * z, '#7ef3ff');
      }
    } else {
      // Heroic Champion V-taper crimson-gold cuirass + gold bracers + circlet + sleek domino mask
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3 * z, '#b82e43');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3 * z, '#b82e43');
      rect(cx - 8 * z, baseY - 14.4 * z, 2 * z, 2.2 * z, '#ffd147');
      rect(cx + 6 * z, baseY - 14.4 * z, 2 * z, 2.2 * z, '#ffd147');
      rect(cx - 6.8 * z, baseY - 19.2 * z, 13.6 * z, 4 * z, '#b82e43');
      rect(cx - 5.2 * z, baseY - 15.2 * z, 10.4 * z, 4.2 * z, '#b82e43');
      rect(cx - 5.6 * z, baseY - 18.8 * z, 11.2 * z, 2.4 * z, '#ffd147');
      rect(cx - 5.4 * z, baseY - 12.4 * z, 10.8 * z, 1.8 * z, '#ffd147');
      rect(cx - 5.8 * z, baseY - 36.2 * z, 11.6 * z, 2.2 * z, '#ffd147');
      if (!isPureBack) {
        rect(cx - 1 * z, baseY - 37.6 * z, 2 * z, 2 * z, '#ff5666');
        rect(cx - 5.4 * z, baseY - 30 * z, 10.8 * z, 2.4 * z, '#1b2030');
        rect(cx - 3.6 * z, baseY - 29.4 * z, 1.4 * z, 1 * z, '#ffffff');
        rect(cx + 2.2 * z, baseY - 29.4 * z, 1.4 * z, 1 * z, '#ffffff');
      }
    }
  } else {
    // HALLOWEEN_PARTY (male)
    if (variant === 0) {
      // Arcane Warlock V-taper dark robe + sleeves + purple sash + stepped pointed wizard hat
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.4 * z, '#1a1529');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.4 * z, '#1a1529');
      rect(cx - 8 * z, baseY - 15.6 * z, 2 * z, 3.8 * z, '#241c38');
      rect(cx + 6 * z, baseY - 15.6 * z, 2 * z, 3.8 * z, '#241c38');
      rect(cx - 6.8 * z, baseY - 19.2 * z, 13.6 * z, 4 * z, '#1a1529');
      rect(cx - 5.4 * z, baseY - 15.2 * z, 10.8 * z, 4 * z, '#1a1529');
      rect(cx - 6.2 * z, baseY - 11.4 * z, 12.4 * z, 2.8 * z, '#241c38');
      rect(cx - 5.4 * z, baseY - 13.2 * z, 10.8 * z, 1.6 * z, '#b07cff');
      rect(cx - 9.2 * z, baseY - 37 * z, 18.4 * z, 2.4 * z, '#241c38');
      rect(cx - 6 * z, baseY - 40.8 * z, 12 * z, 3.8 * z, '#241c38');
      rect(cx - 4 * z, baseY - 44.4 * z, 8 * z, 3.6 * z, '#241c38');
      rect(cx - 2 * z, baseY - 47.4 * z, 4 * z, 3 * z, '#241c38');
      rect(cx - 6 * z, baseY - 38.8 * z, 12 * z, 1.8 * z, '#b07cff');
    } else if (variant === 1) {
      // Sculpted ribbed Jack-o'-Lantern head + V-taper dark suit & sleeves
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#241c38');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#241c38');
      rect(cx - 8 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#1a1529');
      rect(cx + 6 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#1a1529');
      rect(cx - 2.8 * z, baseY - 22.5 * z, 5.6 * z, 3.5 * z, '#241c38');
      rect(cx - 6.8 * z, baseY - 19.2 * z, 13.6 * z, 4 * z, '#241c38');
      rect(cx - 5.2 * z, baseY - 15.2 * z, 10.4 * z, 4.2 * z, '#241c38');
      rect(cx - 5.2 * z, baseY - 13 * z, 10.4 * z, 1.4 * z, '#ff7b1c');
      rect(cx - 6.4 * z, baseY - 36 * z, 12.8 * z, 1.8 * z, '#ff7b1c');
      rect(cx - 7.6 * z, baseY - 34.4 * z, 15.2 * z, 11.4 * z, '#ff7b1c');
      rect(cx - 5.4 * z, baseY - 33.8 * z, 10.8 * z, 10.6 * z, '#ff9838');
      rect(cx - 1.8 * z, baseY - 38.6 * z, 3.6 * z, 2.6 * z, '#3be87a');
      if (!isPureBack) {
        rect(cx - 4.2 * z, baseY - 29.8 * z, 3 * z, 2.6 * z, '#ffe64d');
        rect(cx + 1.2 * z, baseY - 29.8 * z, 3 * z, 2.6 * z, '#ffe64d');
        rect(cx - 3.6 * z, baseY - 25.4 * z, 7.2 * z, 1.8 * z, '#ffe64d');
      }
    } else if (variant === 2) {
      // Count Vampire high crimson-lined cape collar + dark tailcoat sleeves + crimson waistcoat + fangs
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#161822');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#161822');
      rect(cx - 8 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#161822');
      rect(cx + 6 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#161822');
      rect(cx - 8.2 * z, baseY - 23.8 * z, 5.6 * z, 15 * z, '#161822');
      rect(cx + 2.6 * z, baseY - 23.8 * z, 5.6 * z, 15 * z, '#161822');
      rect(cx - 7.8 * z, baseY - 25 * z, 2.8 * z, 6 * z, '#b82e43');
      rect(cx + 5 * z, baseY - 25 * z, 2.8 * z, 6 * z, '#b82e43');
      if (!isPureBack) {
        rect(cx - 5 * z, baseY - 18.8 * z, 10 * z, 7.4 * z, '#d93838');
        rect(cx - 1.2 * z, baseY - 18.4 * z, 2.4 * z, 5 * z, '#161822');
        rect(cx - 0.8 * z, baseY - 16.8 * z, 1.6 * z, 1.2 * z, '#ffd147');
        rect(cx - 1.8 * z + saberSide * 0.4 * z, baseY - 24.4 * z, 1.1 * z, 1.5 * z, '#ffffff');
        rect(cx + 0.7 * z + saberSide * 0.4 * z, baseY - 24.4 * z, 1.1 * z, 1.5 * z, '#ffffff');
      }
    } else {
      // Spectral Phantom / Skeleton V-taper ribcage tunic + bone sleeves + rounded hood
      rect(cx - 9 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#eef2fc');
      rect(cx + 6 * z, baseY - 18.8 * z, 3 * z, 3.2 * z, '#eef2fc');
      rect(cx - 8 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#cfd6e6');
      rect(cx + 6 * z, baseY - 15.6 * z, 2 * z, 3.6 * z, '#cfd6e6');
      rect(cx - 6.8 * z, baseY - 19.2 * z, 13.6 * z, 4 * z, '#eef2fc');
      rect(cx - 5.4 * z, baseY - 15.2 * z, 10.8 * z, 4 * z, '#eef2fc');
      rect(cx - 6.2 * z, baseY - 11.4 * z, 12.4 * z, 2.8 * z, '#eef2fc');
      rect(cx - 3.8 * z, baseY - 18 * z, 7.6 * z, 1.5 * z, '#cfd6e6');
      rect(cx - 3.2 * z, baseY - 15 * z, 6.4 * z, 1.5 * z, '#cfd6e6');
      rect(cx - 6 * z, baseY - 36.4 * z, 12 * z, 2 * z, '#eef2fc');
      rect(cx - 7.2 * z, baseY - 34.8 * z, 14.4 * z, 12.2 * z, '#eef2fc');
      if (!isPureBack) {
        rect(cx - 4.2 * z, baseY - 29.4 * z, 3 * z, 3 * z, '#1b2030');
        rect(cx + 1.2 * z, baseY - 29.4 * z, 3 * z, 3 * z, '#1b2030');
        rect(cx - 3 * z, baseY - 29 * z, 1 * z, 1 * z, '#7ef3ff');
        rect(cx + 2.4 * z, baseY - 29 * z, 1 * z, 1 * z, '#7ef3ff');
      }
    }
  }
}

function drawPortraitCostumeOverlay(
  px: (x: number, y: number, w: number, h: number, color: string) => void,
  variant: number,
  hairColor: string,
  eventKind: 'STAR_WARS_PARTY' | 'SUPERHERO_PARTY' | 'HALLOWEEN_PARTY',
  isFemale = false,
): void {
  if (isFemale) {
    if (eventKind === 'STAR_WARS_PARTY') {
      if (variant === 0) {
        px(8, 23, 16, 9, '#6b4226');
        px(11, 23, 10, 9, '#e7d7b8');
        px(14, 23, 4, 3, '#cbb692');
        px(9, 5, 14, 4, '#6b4226');
        px(10, 7, 12, 2, '#452814');
        px(25, 8, 2, 18, '#3cd8ff');
        px(25, 26, 2, 5, '#b4bed4');
      } else if (variant === 1) {
        px(8, 23, 16, 9, '#11131c');
        px(11, 24, 10, 8, '#2a3040');
        px(9, 6, 14, 15, '#161922');
        px(10, 8, 12, 3, '#2a3040');
        px(11, 14, 4, 2, '#ff384c');
        px(17, 14, 4, 2, '#ff384c');
        px(25, 7, 2, 19, '#ff384c');
      } else if (variant === 2) {
        px(9, 24, 14, 8, '#f4f6fc');
        px(11, 23, 3, 2, '#f4f6fc');
        px(18, 23, 3, 2, '#f4f6fc');
        px(7, 11, 3, 6, hairColor);
        px(22, 11, 3, 6, hairColor);
        px(11, 13, 10, 2, '#ff9c3b');
      } else {
        px(9, 24, 14, 8, '#8f9bb8');
        px(11, 24, 10, 7, '#b4bed4');
        px(10, 6, 12, 15, '#b4bed4');
        px(11, 13, 10, 2, '#11131c');
        px(15, 15, 2, 5, '#11131c');
        px(22, 4, 2, 7, '#ff9c3b');
      }
    } else if (eventKind === 'SUPERHERO_PARTY') {
      if (variant === 0) {
        px(8, 23, 16, 9, '#161a26');
        px(10, 24, 12, 8, '#2c344a');
        px(14, 25, 4, 2, '#ffd147');
        px(10, 6, 12, 9, '#1b2030');
        px(10, 2, 2, 4, '#1b2030');
        px(20, 2, 2, 4, '#1b2030');
        px(12, 14, 3, 2, '#ffffff');
        px(17, 14, 3, 2, '#ffffff');
      } else if (variant === 1) {
        px(8, 23, 16, 9, '#d93838');
        px(10, 24, 12, 8, '#2b62d9');
        px(13, 25, 6, 3, '#ffd147');
        px(15, 26, 2, 1, '#d93838');
      } else if (variant === 2) {
        px(9, 24, 14, 8, '#c42838');
        px(14, 25, 4, 3, '#7ef3ff');
        px(10, 6, 12, 15, '#c42838');
        px(11, 10, 10, 10, '#ffd147');
        px(12, 14, 3, 2, '#7ef3ff');
        px(17, 14, 3, 2, '#7ef3ff');
      } else {
        px(9, 25, 14, 7, '#b82e43');
        px(10, 24, 12, 2, '#ffd147');
        px(11, 6, 10, 2, '#ffd147');
        px(15, 5, 2, 2, '#ff5666');
        px(11, 13, 10, 2, '#1b2030');
        px(13, 14, 1, 1, '#ffffff');
        px(19, 14, 1, 1, '#ffffff');
      }
    } else {
      // HALLOWEEN_PARTY (female)
      if (variant === 0) {
        px(9, 24, 14, 8, '#1a1529');
        px(13, 25, 6, 2, '#b07cff');
        px(6, 6, 20, 2, '#241c38');
        px(10, 2, 12, 4, '#241c38');
        px(13, 0, 6, 2, '#241c38');
        px(10, 5, 12, 1, '#b07cff');
      } else if (variant === 1) {
        px(9, 24, 14, 8, '#241c38');
        px(9, 7, 14, 14, '#ff7b1c');
        px(11, 8, 10, 12, '#ff9838');
        px(14, 4, 4, 3, '#3be87a');
        px(12, 13, 3, 2, '#ffe64d');
        px(17, 13, 3, 2, '#ffe64d');
        px(13, 17, 6, 2, '#ffe64d');
      } else if (variant === 2) {
        px(7, 18, 6, 14, '#161822');
        px(19, 18, 6, 14, '#161822');
        px(8, 16, 3, 7, '#b82e43');
        px(21, 16, 3, 7, '#b82e43');
        px(11, 24, 10, 8, '#d93838');
        px(14, 19, 1, 2, '#ffffff');
        px(17, 19, 1, 2, '#ffffff');
      } else {
        px(9, 23, 14, 9, '#eef2fc');
        px(12, 25, 8, 2, '#cfd6e6');
        px(9, 7, 14, 14, '#eef2fc');
        px(12, 13, 3, 3, '#1b2030');
        px(17, 13, 3, 3, '#1b2030');
        px(13, 13, 1, 1, '#ffffff');
        px(18, 13, 1, 1, '#ffffff');
      }
    }
    return;
  }

  if (eventKind === 'STAR_WARS_PARTY') {
    if (variant === 0) {
      px(6, 23, 20, 9, '#6b4226');
      px(9, 22, 14, 2, '#6b4226');
      px(10, 23, 12, 9, '#e7d7b8');
      px(14, 23, 4, 4, '#cbb692');
      px(9, 5, 14, 3, '#6b4226');
      px(8, 7, 16, 3, '#6b4226');
      px(9, 8, 14, 2, '#452814');
      px(26, 8, 2, 18, '#3cd8ff');
      px(26, 26, 2, 5, '#b4bed4');
    } else if (variant === 1) {
      px(6, 23, 20, 9, '#11131c');
      px(8, 24, 16, 8, '#1d2232');
      px(12, 25, 8, 5, '#4a556e');
      px(13, 26, 2, 2, '#ff384c');
      px(17, 26, 2, 2, '#3cd8ff');
      px(10, 5, 12, 2, '#161922');
      px(8, 7, 16, 14, '#161922');
      px(9, 8, 14, 3, '#2a3040');
      px(11, 13, 4, 2, '#ff384c');
      px(17, 13, 4, 2, '#ff384c');
      px(13, 17, 6, 3, '#2a3040');
      px(26, 7, 2, 19, '#ff384c');
    } else if (variant === 2) {
      px(7, 24, 18, 8, '#f4f6fc');
      px(9, 23, 14, 2, '#f4f6fc');
      px(13, 24, 6, 4, '#dce4f7');
      px(6, 11, 3, 6, hairColor);
      px(23, 11, 3, 6, hairColor);
      px(10, 13, 12, 2, '#ff9c3b');
      px(11, 13, 4, 1, '#ffe6a3');
    } else {
      px(7, 24, 18, 8, '#8f9bb8');
      px(9, 23, 14, 2, '#8f9bb8');
      px(10, 24, 12, 7, '#b4bed4');
      px(10, 5, 12, 2, '#b4bed4');
      px(9, 7, 14, 14, '#b4bed4');
      px(10, 8, 12, 2, '#7a87a3');
      px(10, 13, 12, 2, '#11131c');
      px(15, 15, 2, 6, '#11131c');
      px(23, 4, 2, 8, '#ff9c3b');
    }
  } else if (eventKind === 'SUPERHERO_PARTY') {
    if (variant === 0) {
      px(6, 23, 20, 9, '#161a26');
      px(8, 24, 16, 8, '#2c344a');
      px(13, 25, 6, 2, '#ffd147');
      px(9, 6, 14, 10, '#1b2030');
      px(9, 2, 3, 4, '#1b2030');
      px(20, 2, 3, 4, '#1b2030');
      px(11, 14, 4, 2, '#ffffff');
      px(17, 14, 4, 2, '#ffffff');
    } else if (variant === 1) {
      px(6, 23, 20, 9, '#d93838');
      px(7, 24, 18, 8, '#2b62d9');
      px(9, 23, 14, 2, '#2b62d9');
      px(13, 25, 6, 4, '#ffd147');
      px(15, 26, 2, 2, '#d93838');
    } else if (variant === 2) {
      px(7, 24, 18, 8, '#c42838');
      px(9, 23, 14, 2, '#c42838');
      px(11, 24, 10, 7, '#ffd147');
      px(14, 25, 4, 4, '#7ef3ff');
      px(15, 26, 2, 2, '#ffffff');
      px(10, 5, 12, 2, '#c42838');
      px(9, 7, 14, 14, '#c42838');
      px(11, 10, 10, 10, '#ffd147');
      px(11, 13, 4, 2, '#7ef3ff');
      px(17, 13, 4, 2, '#7ef3ff');
    } else {
      px(7, 24, 18, 8, '#b82e43');
      px(9, 23, 14, 2, '#ffd147');
      px(10, 6, 12, 2, '#ffd147');
      px(15, 5, 2, 2, '#ff5666');
      px(10, 13, 12, 2, '#1b2030');
      px(12, 14, 2, 1, '#ffffff');
      px(18, 14, 2, 1, '#ffffff');
    }
  } else {
    // HALLOWEEN_PARTY (male)
    if (variant === 0) {
      px(7, 23, 18, 9, '#1a1529');
      px(12, 25, 8, 2, '#b07cff');
      px(5, 6, 22, 2, '#241c38');
      px(9, 2, 14, 4, '#241c38');
      px(12, 0, 8, 2, '#241c38');
      px(9, 5, 14, 1, '#b07cff');
    } else if (variant === 1) {
      px(7, 24, 18, 8, '#241c38');
      px(10, 6, 12, 2, '#ff7b1c');
      px(8, 8, 16, 13, '#ff7b1c');
      px(10, 8, 12, 12, '#ff9838');
      px(14, 4, 4, 3, '#3be87a');
      px(11, 13, 3, 3, '#ffe64d');
      px(18, 13, 3, 3, '#ffe64d');
      px(12, 17, 8, 2, '#ffe64d');
    } else if (variant === 2) {
      px(5, 18, 7, 14, '#161822');
      px(20, 18, 7, 14, '#161822');
      px(6, 16, 4, 7, '#b82e43');
      px(22, 16, 4, 7, '#b82e43');
      px(10, 24, 12, 8, '#d93838');
      px(15, 25, 2, 2, '#ffd147');
      px(14, 18, 1, 2, '#ffffff');
      px(17, 18, 1, 2, '#ffffff');
    } else {
      px(7, 23, 18, 9, '#eef2fc');
      px(11, 25, 10, 2, '#cfd6e6');
      px(12, 28, 8, 2, '#cfd6e6');
      px(10, 6, 12, 2, '#eef2fc');
      px(8, 8, 16, 13, '#eef2fc');
      px(11, 13, 4, 3, '#1b2030');
      px(17, 13, 4, 3, '#1b2030');
      px(12, 14, 1, 1, '#7ef3ff');
      px(19, 14, 1, 1, '#7ef3ff');
    }
  }
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
  alpha = 1,
  showSpeechBubble = true,
  activeEventKind?: FloorEventKind | null,
  isSeatedOverride?: boolean,
): void {
  const z = zoom;
  const empGender = (emp as OfficeEmployee & { gender?: 'female' | 'male' }).gender;
  const palette = getEmployeePalette(emp.id, empGender);
  const uniform = UNIFORM_COLORS[emp.modelFamily] || UNIFORM_COLORS.other;

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.max(1, Math.ceil(w)),
      Math.max(1, Math.ceil(h)),
    );
  };

  const bob = isWalking ? Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 3 * z : 0;
  const legSwing = isWalking ? Math.sin(walkPhase * Math.PI * 2) * 3 * z : 0;

  const isPresenting = !isWalking && (emp.activity === 'presenting' || Boolean(emp.isPresenter));
  const act = emp.activity as string;
  const toolAct = (emp.toolActivity ?? '') as string;
  const isDeskZone =
    emp.zone === 'DESK_CODING' || emp.zone === 'DESK_QA' || emp.zone === 'DESK_ARCHITECT';
  const isStandingWorkZone = emp.zone === 'SERVER_RACK' || emp.zone === 'ELEVATOR';
  const isCodingLikeActivity =
    act === 'coding' ||
    act === 'terminal' ||
    act === 'typing' ||
    act === 'debugging' ||
    act === 'testing' ||
    act === 'writing' ||
    act === 'researching';
  const isStandingGuest = Boolean(emp.standingGuest);
  const autoSeated =
    !isWalking &&
    !isPresenting &&
    !isStandingWorkZone &&
    !isStandingGuest &&
    (isCodingLikeActivity ||
      act === 'reading' ||
      act === 'searching' ||
      act === 'thinking' ||
      act === 'meeting' ||
      act === 'lounging' ||
      act === 'sleeping' ||
      act === 'gaming' ||
      act === 'card_game' ||
      (isDeskZone && act !== 'going_home'));
  const seated =
    !isWalking &&
    !isStandingGuest &&
    (isSeatedOverride !== undefined ? isSeatedOverride : autoSeated);
  const isCodingPose =
    seated &&
    !isWalking &&
    (isCodingLikeActivity ||
      (isDeskZone && (act === 'reading' || act === 'searching' || act === 'thinking')));
  const isLaptopPose =
    !seated &&
    !isWalking &&
    !isPresenting &&
    !isStandingGuest &&
    (isCodingLikeActivity ||
      toolAct === 'terminal' ||
      toolAct === 'coding' ||
      toolAct === 'testing' ||
      toolAct === 'writing' ||
      (emp.zone === 'SERVER_RACK' &&
        (act === 'reading' || act === 'searching' || act === 'thinking' || act === 'error')));
  const hasScreenGlow = isCodingPose || isLaptopPose;

  // True 8-directional anatomical orientation (S, SE, E, NE, N, NW, W, SW) — zero forced front-flips!
  const effectiveFacing: Facing = facing;
  const viewMode: 'front' | 'front_diag' | 'side' | 'back_diag' | 'back' =
    effectiveFacing === 'S'
      ? 'front'
      : effectiveFacing === 'N'
        ? 'back'
        : effectiveFacing === 'E' || effectiveFacing === 'W'
          ? 'side'
          : effectiveFacing === 'NE' || effectiveFacing === 'NW'
            ? 'back_diag'
            : 'front_diag';
  const dirFlip: -1 | 1 =
    effectiveFacing === 'SW' || effectiveFacing === 'W' || effectiveFacing === 'NW' ? -1 : 1;
  const isFacingAway = viewMode === 'back_diag' || viewMode === 'back';
  const isSideProfile = viewMode === 'side';
  const isPureFront = viewMode === 'front';
  const isPureBack = viewMode === 'back';
  const dRect = (dx: number, y: number, w: number, h: number, color: string) => {
    rect(dirFlip > 0 ? cx + dx * z : cx - (dx + w) * z, y, w * z, h * z, color);
  };

  ctx.save();
  if (alpha < 1) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  }

  if (seated) {
    // Subtle dark contact shadow directly on the chair cushion (never floating over caster wheels!)
    const shadX =
      isPureFront || isPureBack
        ? cx
        : isSideProfile
          ? cx + dirFlip * 0.4 * z
          : cx + dirFlip * (isFacingAway ? 1.6 : 0.8) * z;
    const shadY = isPureBack
      ? cy - 9.0 * z
      : isFacingAway
        ? cy - 9.2 * z
        : cy - 8.4 * z;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(shadX, shadY, 5.2 * z, 2.2 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Standing / walking floor shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2 * z, 11 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hover or selection ring
  if (isHovered || isSelected) {
    ctx.strokeStyle = isSelected ? '#ffd147' : '#3cd8ff';
    ctx.lineWidth = Math.max(2, 2 * z);
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy + (seated ? 0.8 : 2) * z,
      (seated ? 11.5 : 13) * z,
      (seated ? 5.2 : 6) * z,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  const seatOffsetY = seated
    ? (isPureBack ? 0.5 : isFacingAway ? 1.0 : isSideProfile ? 0.3 : 0.2) * z
    : 0;
  const baseY = cy - bob + seatOffsetY;
  // Angle-aware seated focus lean so hips nestle inside the chair cushion & backrest across all 8 angles
  const leanX = seated
    ? isPureFront || isPureBack
      ? 0
      : isSideProfile
        ? dirFlip * (isCodingPose ? 0.4 : -0.6) * z
        : dirFlip * (isFacingAway ? (isCodingPose ? 2.5 : 1.8) : isCodingPose ? 1.6 : 0.8) * z
    : 0;
  const leanY = seated
    ? (isPureBack
        ? isCodingPose
          ? -1.5
          : -1.1
        : isFacingAway
          ? isCodingPose
            ? -1.4
            : -0.9
          : isSideProfile
            ? -0.2
            : isCodingPose
              ? 0.4
              : 0.1) * z
    : 0;
  const uX = cx + leanX;
  const uY = baseY + leanY;
  const uRect = (dx: number, y: number, w: number, h: number, color: string) => {
    rect(dirFlip > 0 ? uX + dx * z : uX - (dx + w) * z, y, w * z, h * z, color);
  };

  const costumeVariant = (hashString(emp.id) >>> 12) & 3;
  const enclosingHelmet = hasEnclosingCostumeHelmet(activeEventKind, costumeVariant);
  const hideTopChignon = suppressesTopChignon(activeEventKind, costumeVariant);
  const isLeiaCostume = activeEventKind === 'STAR_WARS_PARTY' && costumeVariant === 2;
  const fLegSwing = isWalking ? Math.sin(walkPhase * Math.PI * 2) * 2 * z : 0;
  const sideStride = isWalking ? Math.sin(walkPhase * Math.PI * 2) * 2.4 : 0;

  // 1. Back hair underlay for front/front-diagonal views (for side, back_diag & back, hair drapes over nape in step 5)
  if (palette.gender === 'female' && !enclosingHelmet && !isFacingAway && !isSideProfile) {
    if (palette.femaleHairStyle === 'long_locks') {
      // Rounded back crown + twin S-curve cascades tapering behind the slender waist
      rect(uX - 5.5 * z, uY - 35 * z, 11 * z, 13 * z, palette.hair);
      // Left S-curve cascade (3*z wave -> 2*z -> 1*z feathered tip)
      rect(uX - 7.5 * z, uY - 32.5 * z, 3 * z, 6 * z, palette.hair);
      rect(uX - 6.8 * z, uY - 26.5 * z, 3 * z, 5 * z, palette.hair);
      rect(uX - 7.6 * z, uY - 21.5 * z, 3 * z, 3.8 * z, palette.hair);
      rect(uX - 7 * z, uY - 17.7 * z, 2 * z, 2.2 * z, palette.hair);
      rect(uX - 6.4 * z, uY - 15.5 * z, 1.2 * z, 1.5 * z, palette.hair);
      rect(uX - 6.8 * z, uY - 31 * z, 1.2 * z, 4 * z, palette.hairHighlight);
      rect(uX - 7 * z, uY - 21 * z, 1.2 * z, 3 * z, palette.hairHighlight);
      // Right S-curve cascade (mirror)
      rect(uX + 4.5 * z, uY - 32.5 * z, 3 * z, 6 * z, palette.hair);
      rect(uX + 3.8 * z, uY - 26.5 * z, 3 * z, 5 * z, palette.hair);
      rect(uX + 4.6 * z, uY - 21.5 * z, 3 * z, 3.8 * z, palette.hair);
      rect(uX + 5 * z, uY - 17.7 * z, 2 * z, 2.2 * z, palette.hair);
      rect(uX + 5.2 * z, uY - 15.5 * z, 1.2 * z, 1.5 * z, palette.hair);
      rect(uX + 5.6 * z, uY - 31 * z, 1.2 * z, 4 * z, palette.hairHighlight);
      rect(uX + 5.8 * z, uY - 21 * z, 1.2 * z, 3 * z, palette.hairHighlight);
    } else if (palette.femaleHairStyle === 'bob_cut') {
      // Rounded French bob curving inward around the tapered jaw (leaving center neck clear)
      rect(uX - 6 * z, uY - 35 * z, 12 * z, 4 * z, palette.hair);
      rect(uX - 7.2 * z, uY - 31 * z, 14.4 * z, 6.5 * z, palette.hair);
      rect(uX - 6.2 * z, uY - 24.5 * z, 12.4 * z, 2 * z, palette.hair);
      rect(uX - 5.2 * z, uY - 22.8 * z, 2.4 * z, 1.5 * z, palette.hair);
      rect(uX + 2.8 * z, uY - 22.8 * z, 2.4 * z, 1.5 * z, palette.hair);
    } else if (palette.femaleHairStyle === 'ponytail') {
      // Smooth rounded cap + silk scrunchie + arched S-curve cascading ponytail with subtle sway
      rect(uX - 5.8 * z, uY - 35 * z, 11.6 * z, 9 * z, palette.hair);
      if (!isLeiaCostume) {
        const ts = isPureFront ? 1 : dirFlip > 0 ? -1 : 1;
        const ponySway =
          (isWalking ? Math.sin(walkPhase * Math.PI * 2) * 1.2 : Math.sin(timeSec * 2.5) * 0.5) * z;
        const scrunchX = ts < 0 ? uX - 7.4 * z : uX + 5.2 * z;
        rect(scrunchX, uY - 34.8 * z, 2.2 * z, 2.5 * z, palette.accessoryColor);
        rect(ts < 0 ? uX - 9.2 * z : uX + 6.7 * z, uY - 35.8 * z, 2.5 * z, 2.5 * z, palette.hair);
        rect(ts < 0 ? uX - 8.8 * z : uX + 7.1 * z, uY - 35.5 * z, 1.5 * z, 1.2 * z, palette.hairHighlight);
        rect(
          (ts < 0 ? uX - 10.5 * z : uX + 7.5 * z) + ponySway * 0.4,
          uY - 33.5 * z,
          3 * z,
          5.5 * z,
          palette.hair,
        );
        rect(
          (ts < 0 ? uX - 9.4 * z : uX + 8.3 * z) + ponySway * 0.4,
          uY - 32.5 * z,
          1.2 * z,
          4 * z,
          palette.hairHighlight,
        );
        rect(
          (ts < 0 ? uX - 9.8 * z : uX + 7.6 * z) + ponySway * 0.8,
          uY - 28 * z,
          2.2 * z,
          5.5 * z,
          palette.hair,
        );
        rect(
          (ts < 0 ? uX - 10.5 * z : uX + 9 * z) + ponySway,
          uY - 22.5 * z,
          1.5 * z,
          3.5 * z,
          palette.hair,
        );
      }
    } else if (palette.femaleHairStyle === 'bun_updo') {
      // Smooth rounded cap + sculpted ballet chignon (6*z base -> 4*z top dome) + pearl ribbon band
      rect(uX - 5.8 * z, uY - 35 * z, 11.6 * z, 8.5 * z, palette.hair);
      if (!hideTopChignon) {
        rect(uX - 3 * z, uY - 40 * z, 6 * z, 2 * z, palette.hair);
        rect(uX - 2 * z, uY - 41.2 * z, 4 * z, 1.5 * z, palette.hair);
        rect(uX - 1.5 * z, uY - 40.5 * z, 2.5 * z, 1.2 * z, palette.hairHighlight);
        rect(uX - 3.2 * z, uY - 38.2 * z, 6.4 * z, 1.2 * z, palette.accessoryColor);
        rect(uX - 2 * z, uY - 38.2 * z, 1 * z, 1 * z, '#fff8e7');
        rect(uX + 1 * z, uY - 38.2 * z, 1 * z, 1 * z, '#fff8e7');
      }
    }
  }

  // 2. Legs & Skirt / Trousers across all 8 angles (front, front_diag, side, back_diag, back)
  if (palette.gender === 'female' && palette.femaleOutfit === 'skirt_blazer') {
    if (seated) {
      if (isPureBack) {
        // Seated pure rear (N): symmetric skirt hips resting inside cushion; legs tucked forward away from camera
        rect(uX - 4 * z, uY - 12.2 * z, 8 * z, 1.6 * z, uniform.main);
        rect(uX - 4.6 * z, uY - 10.8 * z, 9.2 * z, 2.0 * z, uniform.dark);
        rect(uX - 3.8 * z, uY - 10.8 * z, 7.6 * z, 1.6 * z, uniform.main);
      } else if (isFacingAway) {
        // Seated skirt resting on cushion facing NE/NW: hip drape + forward lap tucked toward desk
        rect(uX - 4 * z, uY - 12.2 * z, 8 * z, 1.6 * z, uniform.main);
        rect(uX - 4.6 * z, uY - 10.8 * z, 9.2 * z, 2.2 * z, uniform.dark);
        rect(uX - 4 * z, uY - 10.8 * z, 8 * z, 1.8 * z, uniform.main);
        const lapX = dirFlip > 0 ? uX + 0.6 * z : uX - 6.8 * z;
        rect(lapX, uY - 11.2 * z, 6.2 * z, 2.1 * z, uniform.main);
        rect(lapX + (dirFlip > 0 ? 1.4 : 0.4) * z, uY - 9.4 * z, 4.4 * z, 1 * z, uniform.dark);
        const kneeX = dirFlip > 0 ? uX + 5.4 * z : uX - 7.4 * z;
        rect(kneeX, uY - 9.6 * z, 2 * z, 1.8 * z, palette.skin);
      } else if (isSideProfile) {
        // Pure 90° lateral profile seated (E / W): hip on cushion -> horizontal lap -> 90°-bent calves -> side Mary-Jane
        uRect(-3.4, uY - 12.2 * z, 5.4, 1.8, uniform.main);
        uRect(-3.2, uY - 10.6 * z, 8.2, 2.2, uniform.main);
        uRect(-2.6, uY - 8.8 * z, 7.8, 1.0, uniform.dark);
        uRect(1.2, uY - 10.4 * z, 0.9, 2.4, uniform.dark);
        // Far calf subtle offset + near calf vertical drop from knee
        uRect(3.2, uY - 8.2 * z, 1.8, 3.8, palette.skinShadow);
        uRect(3.8, uY - 7.9 * z, 2.0, 3.9, palette.skin);
        // Side-profile Mary-Jane shoe pointing in dirFlip direction
        uRect(3.5, uY - 4.2 * z, 3.4, 1.5, '#1b2030');
        uRect(4.5, uY - 4.2 * z, 1.4, 0.7, uniform.trim);
      } else {
        // Seated S (kneeShift = 0) or SE/SW: skirt draped horizontally across lap + 90°-bent calves & Mary-Janes
        const kneeShift = isPureFront ? 0 : dirFlip * 2.2 * z;
        rect(uX - 4 * z, uY - 12 * z, 8 * z, 1.5 * z, uniform.main);
        rect(uX - 4.6 * z + kneeShift * 0.4, uY - 10.6 * z, 9.2 * z, 1.8 * z, uniform.main);
        rect(uX - 4.8 * z + kneeShift * 0.85, uY - 9.2 * z, 9.6 * z, 2.1 * z, uniform.dark);
        rect(uX - 4.2 * z + kneeShift * 0.85, uY - 9.2 * z, 8.4 * z, 1.6 * z, uniform.main);
        rect(uX - 1.8 * z + kneeShift * 0.75, uY - 10 * z, 1 * z, 2.6 * z, uniform.dark);
        rect(uX + 1 * z + kneeShift * 0.75, uY - 10 * z, 1 * z, 2.6 * z, uniform.dark);
        const legLx = uX - 2.8 * z + kneeShift;
        const legRx = uX + 0.8 * z + kneeShift;
        rect(legLx, uY - 7.1 * z, 2 * z, 0.9 * z, palette.skinShadow);
        rect(legLx, uY - 6.3 * z, 2 * z, 2.1 * z, palette.skin);
        rect(legRx, uY - 7.1 * z, 2 * z, 0.9 * z, palette.skinShadow);
        rect(legRx, uY - 6.3 * z, 2 * z, 2.1 * z, palette.skin);
        rect(legLx - 0.1 * z, uY - 4.3 * z, 2.2 * z, 1.4 * z, '#1b2030');
        rect(legRx - 0.1 * z, uY - 4.3 * z, 2.2 * z, 1.4 * z, '#1b2030');
        rect(legLx, uY - 4.3 * z, 2 * z, 0.7 * z, uniform.trim);
        rect(legRx, uY - 4.3 * z, 2 * z, 0.7 * z, uniform.trim);
      }
    } else if (isSideProfile) {
      // Standing / walking 90° profile flared A-line skirt + horizontal stride legs + side Mary-Janes
      dRect(-2.8, baseY - 12 * z, 5.4, 1.5, uniform.main);
      dRect(-3.4, baseY - 10.5 * z, 6.6, 2, uniform.dark);
      dRect(-2.8, baseY - 10.5 * z, 5.6, 2, uniform.main);
      dRect(-4.0, baseY - 8.5 * z, 7.8, 2, uniform.dark);
      dRect(-3.3, baseY - 8.5 * z, 6.6, 1.5, uniform.main);
      dRect(-0.4, baseY - 10 * z, 0.9, 3.5, uniform.dark);
      // Far leg & near leg striding horizontally along x
      dRect(-1.1 - sideStride, baseY - 6.5 * z, 2, 5, palette.skinShadow);
      dRect(-1.3 - sideStride, baseY - 2 * z, 3.2, 2, '#141824');
      dRect(-0.7 + sideStride, baseY - 6.5 * z, 2, 5, palette.skin);
      dRect(-0.9 + sideStride, baseY - 2 * z, 3.2, 2, '#1b2030');
      dRect(0.3 + sideStride, baseY - 2 * z, 1.4, 0.8, uniform.trim);
    } else {
      // Standing/walking 3-step flared A-line skirt + slender calves + Mary-Janes (front/diag/back)
      rect(cx - 4 * z, baseY - 12 * z, 8 * z, 1.5 * z, uniform.main);
      rect(cx - 5 * z, baseY - 10.5 * z, 10 * z, 2 * z, uniform.dark);
      rect(cx - 4.2 * z, baseY - 10.5 * z, 8.4 * z, 2 * z, uniform.main);
      rect(cx - 6 * z, baseY - 8.5 * z, 12 * z, 2 * z, uniform.dark);
      rect(cx - 5.2 * z, baseY - 8.5 * z, 10.4 * z, 1.5 * z, uniform.main);
      rect(cx - 2.5 * z, baseY - 10 * z, 1 * z, 3.5 * z, uniform.dark);
      rect(cx + 1.5 * z, baseY - 10 * z, 1 * z, 3.5 * z, uniform.dark);
      rect(cx - 3 * z, baseY - 6.5 * z + fLegSwing, 2 * z, 5 * z, palette.skin);
      rect(cx - 3 * z, baseY - 6.5 * z + fLegSwing, 2 * z, 1 * z, palette.skinShadow);
      rect(cx + 1 * z, baseY - 6.5 * z - fLegSwing, 2 * z, 5 * z, palette.skin);
      rect(cx + 1 * z, baseY - 6.5 * z - fLegSwing, 2 * z, 1 * z, palette.skinShadow);
      rect(cx - 3.2 * z, baseY - 2 * z + fLegSwing, 2.2 * z, 2 * z, '#1b2030');
      rect(cx + 1 * z, baseY - 2 * z - fLegSwing, 2.2 * z, 2 * z, '#1b2030');
      if (!isFacingAway) {
        rect(cx - 3 * z, baseY - 2 * z + fLegSwing, 2 * z, 0.8 * z, uniform.trim);
        rect(cx + 1 * z, baseY - 2 * z - fLegSwing, 2 * z, 0.8 * z, uniform.trim);
      }
    }
  } else if (palette.gender === 'female' && palette.femaleOutfit === 'tailored_suit') {
    if (seated) {
      if (isPureBack) {
        rect(uX - 4.2 * z, uY - 11.8 * z, 8.4 * z, 2.4 * z, '#2c3550');
        rect(uX - 3.8 * z, uY - 11.6 * z, 7.6 * z, 1.8 * z, uniform.main);
      } else if (isFacingAway) {
        rect(uX - 4.2 * z, uY - 11.8 * z, 8.4 * z, 2.4 * z, '#2c3550');
        rect(uX - 3.8 * z, uY - 11.6 * z, 7.6 * z, 1.8 * z, uniform.main);
        const thighX = dirFlip > 0 ? uX + 0.6 * z : uX - 6.8 * z;
        rect(thighX, uY - 11 * z, 6.2 * z, 2.1 * z, '#364161');
        const kneeX = dirFlip > 0 ? uX + 5.2 * z : uX - 7.2 * z;
        rect(kneeX, uY - 9.4 * z, 2 * z, 1.8 * z, '#2c3550');
      } else if (isSideProfile) {
        // Pure 90° lateral profile seated tailored trousers + 90°-bent knee + side pump
        uRect(-3.4, uY - 12.0 * z, 5.4, 1.5, uniform.main);
        uRect(-3.4, uY - 10.8 * z, 8.6, 2.3, '#364161');
        uRect(-2.8, uY - 8.9 * z, 7.4, 0.8, '#2c3550');
        uRect(3.0, uY - 9.6 * z, 2.0, 4.2, '#2c3550');
        uRect(3.6, uY - 9.4 * z, 2.2, 4.4, '#364161');
        uRect(3.8, uY - 5.0 * z, 1.8, 0.9, palette.skin);
        uRect(3.5, uY - 4.2 * z, 3.4, 1.5, '#141824');
        uRect(4.5, uY - 4.2 * z, 1.4, 0.7, uniform.trim);
      } else {
        const kneeShift = isPureFront ? 0 : dirFlip * 2.2 * z;
        rect(uX - 4.4 * z, uY - 11.6 * z, 8.8 * z, 2 * z, uniform.main);
        rect(uX - 4.6 * z + kneeShift * 0.45, uY - 10 * z, 9.2 * z, 2.1 * z, '#2c3550');
        const legLx = uX - 2.8 * z + kneeShift;
        const legRx = uX + 0.8 * z + kneeShift;
        rect(legLx - 0.3 * z, uY - 9.2 * z, 2.6 * z, 1.8 * z, '#364161');
        rect(legRx - 0.3 * z, uY - 9.2 * z, 2.6 * z, 1.8 * z, '#364161');
        rect(legLx, uY - 7.4 * z, 2 * z, 2.5 * z, '#364161');
        rect(legRx, uY - 7.4 * z, 2 * z, 2.5 * z, '#364161');
        rect(legLx, uY - 5 * z, 2 * z, 0.8 * z, palette.skin);
        rect(legRx, uY - 5 * z, 2 * z, 0.8 * z, palette.skin);
        rect(legLx - 0.1 * z, uY - 4.3 * z, 2.2 * z, 1.4 * z, '#141824');
        rect(legRx - 0.1 * z, uY - 4.3 * z, 2.2 * z, 1.4 * z, '#141824');
        rect(legLx, uY - 4.3 * z, 2 * z, 0.7 * z, uniform.trim);
        rect(legRx, uY - 4.3 * z, 2 * z, 0.7 * z, uniform.trim);
      }
    } else if (isSideProfile) {
      dRect(-2.8, baseY - 12 * z, 5.4, 1.2, uniform.main);
      dRect(-3.0, baseY - 11 * z, 5.8, 2.0, '#2c3550');
      dRect(-1.3 - sideStride, baseY - 9 * z, 2.4, 6.2, '#2c3550');
      dRect(-1.3 - sideStride, baseY - 2.8 * z, 1.8, 0.9, palette.skinShadow);
      dRect(-1.5 - sideStride, baseY - 2 * z, 3.2, 2, '#0f131f');
      dRect(-0.9 + sideStride, baseY - 9 * z, 2.4, 6.2, '#364161');
      dRect(-0.7 + sideStride, baseY - 2.8 * z, 1.8, 0.9, palette.skin);
      dRect(-1.0 + sideStride, baseY - 2 * z, 3.3, 2, '#141824');
      dRect(0.4 + sideStride, baseY - 2 * z, 1.4, 0.8, uniform.trim);
    } else {
      rect(cx - 4 * z, baseY - 12 * z, 8 * z, 1 * z, uniform.main);
      rect(cx - 5 * z, baseY - 11 * z, 10 * z, 2 * z, '#2c3550');
      rect(cx - 4.8 * z, baseY - 11.5 * z, 4 * z, 1.8 * z, uniform.main);
      rect(cx + 0.8 * z, baseY - 11.5 * z, 4 * z, 1.8 * z, uniform.main);
      rect(cx - 3.6 * z, baseY - 9 * z + fLegSwing, 2.6 * z, 2.8 * z, '#364161');
      rect(cx + 1 * z, baseY - 9 * z - fLegSwing, 2.6 * z, 2.8 * z, '#364161');
      rect(cx - 3 * z, baseY - 6.5 * z + fLegSwing, 2 * z, 3.8 * z, '#364161');
      rect(cx + 1 * z, baseY - 6.5 * z - fLegSwing, 2 * z, 3.8 * z, '#364161');
      rect(cx - 3 * z, baseY - 2.8 * z + fLegSwing, 2 * z, 1 * z, palette.skin);
      rect(cx + 1 * z, baseY - 2.8 * z - fLegSwing, 2 * z, 1 * z, palette.skin);
      rect(cx - 3.2 * z, baseY - 2 * z + fLegSwing, 2.2 * z, 2 * z, '#141824');
      rect(cx + 1 * z, baseY - 2 * z - fLegSwing, 2.2 * z, 2 * z, '#141824');
      if (!isFacingAway) {
        rect(cx - 3 * z, baseY - 2 * z + fLegSwing, 2 * z, 0.8 * z, uniform.trim);
        rect(cx + 1 * z, baseY - 2 * z - fLegSwing, 2 * z, 0.8 * z, uniform.trim);
      }
    }
  } else {
    // Tailored male trousers across all 8 angles
    const isSneaker = palette.maleOutfitStyle === 'tech_hoodie';
    const trouserMain =
      palette.maleOutfitStyle === 'tech_hoodie'
        ? '#2b354f'
        : palette.maleOutfitStyle === 'vest_ensemble'
          ? '#2a3145'
          : '#22293d';
    const trouserDark =
      palette.maleOutfitStyle === 'tech_hoodie'
        ? '#1d2438'
        : palette.maleOutfitStyle === 'vest_ensemble'
          ? '#1b2030'
          : '#151a28';
    const beltColor =
      palette.maleOutfitStyle === 'vest_ensemble'
        ? '#4a2c18'
        : palette.maleOutfitStyle === 'tech_hoodie'
          ? '#181c29'
          : '#161924';
    const buckleColor = palette.maleOutfitStyle === 'tech_hoodie' ? '#9aa7c7' : '#ffd147';
    const mLegSwing = legSwing * 0.8;

    if (seated) {
      if (isPureBack) {
        // Seated pure rear (N): belt + rear belt-loop + seated pelvis inside chair cushion
        rect(uX - 4.8 * z, uY - 11.4 * z, 9.6 * z, 1.3 * z, beltColor);
        rect(uX - 0.6 * z, uY - 11.5 * z, 1.2 * z, 1.5 * z, trouserDark);
        rect(uX - 4.8 * z, uY - 10.2 * z, 9.6 * z, 2.0 * z, trouserDark);
        rect(uX - 4.2 * z, uY - 10 * z, 8.4 * z, 1.6 * z, trouserMain);
      } else if (isFacingAway) {
        // Seated male pelvis on chair cushion facing NE/NW + forward thigh tucked cleanly toward kneehole
        rect(uX - 4.8 * z, uY - 11.4 * z, 9.6 * z, 1.3 * z, beltColor);
        rect(uX - 4.8 * z, uY - 10.2 * z, 9.6 * z, 2.2 * z, trouserDark);
        rect(uX - 4.2 * z, uY - 10 * z, 8.4 * z, 1.8 * z, trouserMain);
        const thighX = dirFlip > 0 ? uX + 0.6 * z : uX - 7.4 * z;
        rect(thighX, uY - 10.8 * z, 6.8 * z, 2.3 * z, trouserMain);
        rect(thighX, uY - 8.8 * z, 6.6 * z, 0.9 * z, trouserDark);
        const kneeX = dirFlip > 0 ? uX + 5.4 * z : uX - 8 * z;
        rect(kneeX, uY - 9.2 * z, 2.6 * z, 1.8 * z, trouserDark);
      } else if (isSideProfile) {
        // Pure 90° lateral profile seated male (E / W): side belt -> horizontal thigh -> 90°-bent shin -> side Oxford/sneaker
        uRect(-3.8, uY - 11.5 * z, 6.6, 1.3, beltColor);
        uRect(2.0, uY - 11.5 * z, 1.0, 1.3, buckleColor);
        uRect(-3.8, uY - 10.2 * z, 9.4, 2.5, trouserMain);
        uRect(-3.2, uY - 8.1 * z, 8.2, 0.8, trouserDark);
        // Far shin shadow + near vertical trouser shin
        uRect(2.8, uY - 9.6 * z, 2.4, 4.6, trouserDark);
        uRect(3.4, uY - 9.4 * z, 2.8, 4.6, trouserMain);
        if (isSneaker) {
          uRect(3.2, uY - 4.8 * z, 4.2, 1.2, '#1e2436');
          uRect(4.4, uY - 4.6 * z, 1.6, 0.7, uniform.trim);
          uRect(3.2, uY - 3.8 * z, 4.2, 0.7, '#f2f5ff');
        } else {
          const vampCol = palette.maleOutfitStyle === 'vest_ensemble' ? '#382216' : '#2b1a12';
          const capCol = palette.maleOutfitStyle === 'vest_ensemble' ? '#5e3a24' : '#4d3020';
          uRect(3.2, uY - 4.8 * z, 4.2, 1.2, vampCol);
          uRect(5.6, uY - 4.7 * z, 1.8, 0.9, capCol);
          uRect(3.2, uY - 3.8 * z, 4.2, 0.7, '#11131c');
        }
      } else {
        // Seated S (kneeShift = 0) or SE/SW
        const kneeShift = isPureFront ? 0 : dirFlip * 2.4 * z;
        const buckShift = isPureFront ? 0 : dirFlip * 0.5 * z;
        rect(uX - 4.8 * z, uY - 11.4 * z, 9.6 * z, 1.3 * z, beltColor);
        rect(uX - 1 * z + buckShift, uY - 11.4 * z, 2 * z, 1.3 * z, buckleColor);
        rect(uX - 4.8 * z + kneeShift * 0.35, uY - 10.1 * z, 9.6 * z, 2.1 * z, trouserDark);
        const legLx = uX - 3.8 * z + kneeShift;
        const legRx = uX + 0.8 * z + kneeShift;
        rect(legLx - 0.4 * z, uY - 9.6 * z, 3.4 * z, 2.2 * z, trouserMain);
        rect(legRx - 0.2 * z, uY - 9.6 * z, 3.4 * z, 2.2 * z, trouserMain);
        rect(legLx, uY - 7.4 * z, 2.8 * z, 2.5 * z, trouserMain);
        rect(legRx, uY - 7.4 * z, 2.8 * z, 2.5 * z, trouserMain);
        rect(legLx + 1.8 * z, uY - 7.2 * z, 0.9 * z, 2.2 * z, trouserDark);
        rect(legRx + 0.9 * z, uY - 7.2 * z, 0.9 * z, 2.2 * z, trouserDark);
        const toeShift = isPureFront ? 0 : dirFlip * 0.3 * z;
        if (isSneaker) {
          rect(legLx - 0.2 * z + toeShift, uY - 4.9 * z, 3.2 * z, 1.2 * z, '#1e2436');
          rect(legRx - 0.2 * z + toeShift, uY - 4.9 * z, 3.2 * z, 1.2 * z, '#1e2436');
          rect(legLx - 0.2 * z + toeShift, uY - 3.9 * z, 3.2 * z, 0.7 * z, '#f2f5ff');
          rect(legRx - 0.2 * z + toeShift, uY - 3.9 * z, 3.2 * z, 0.7 * z, '#f2f5ff');
        } else {
          const vampCol = palette.maleOutfitStyle === 'vest_ensemble' ? '#382216' : '#2b1a12';
          const capCol = palette.maleOutfitStyle === 'vest_ensemble' ? '#5e3a24' : '#4d3020';
          rect(legLx - 0.2 * z + toeShift, uY - 4.9 * z, 3.2 * z, 1.2 * z, vampCol);
          rect(legRx - 0.2 * z + toeShift, uY - 4.9 * z, 3.2 * z, 1.2 * z, vampCol);
          rect(
            (isPureFront ? legLx + 0.6 * z : dirFlip > 0 ? legLx + 1.4 * z : legLx - 0.2 * z) + toeShift,
            uY - 4.8 * z,
            1.5 * z,
            0.9 * z,
            capCol,
          );
          rect(
            (isPureFront ? legRx + 0.6 * z : dirFlip > 0 ? legRx + 1.4 * z : legRx - 0.2 * z) + toeShift,
            uY - 4.8 * z,
            1.5 * z,
            0.9 * z,
            capCol,
          );
          rect(legLx - 0.2 * z + toeShift, uY - 3.9 * z, 3.2 * z, 0.7 * z, '#11131c');
          rect(legRx - 0.2 * z + toeShift, uY - 3.9 * z, 3.2 * z, 0.7 * z, '#11131c');
        }
      }
    } else if (isSideProfile) {
      // Standing / walking 90° side profile male belt, striding trousers & side-pointing shoes
      dRect(-3.4, baseY - 11.4 * z, 6.6, 1.4, beltColor);
      dRect(2.2, baseY - 11.4 * z, 1.1, 1.4, buckleColor);
      dRect(-3.4, baseY - 10 * z, 6.6, 1.8, trouserDark);
      // Far leg
      dRect(-1.8 - sideStride, baseY - 8.4 * z, 3.0, 5.8, trouserDark);
      dRect(-1.8 - sideStride, baseY - 2 * z, 4.0, 2.0, '#11131c');
      // Near leg
      dRect(-1.4 + sideStride, baseY - 8.4 * z, 3.2, 5.8, trouserMain);
      dRect(-0.2 + sideStride, baseY - 8.0 * z, 0.9, 5.0, trouserDark);
      dRect(-1.4 + sideStride, baseY - 2.7 * z, 2.8, 0.8, uniform.dark);
      if (isSneaker) {
        dRect(-1.4 + sideStride, baseY - 2 * z, 4.4, 1.4, '#1e2436');
        dRect(0.2 + sideStride, baseY - 1.8 * z, 1.6, 0.8, uniform.trim);
        dRect(-1.4 + sideStride, baseY - 0.8 * z, 4.4, 0.8, '#f2f5ff');
      } else {
        const vampCol = palette.maleOutfitStyle === 'vest_ensemble' ? '#382216' : '#2b1a12';
        const capCol = palette.maleOutfitStyle === 'vest_ensemble' ? '#5e3a24' : '#4d3020';
        dRect(-1.4 + sideStride, baseY - 2 * z, 4.4, 1.4, vampCol);
        dRect(1.2 + sideStride, baseY - 1.8 * z, 1.8, 1.0, capCol);
        dRect(-1.4 + sideStride, baseY - 0.8 * z, 4.4, 0.8, '#11131c');
      }
    } else {
      // Standing/walking front, diagonal, or rear male legs
      rect(cx - 5 * z, baseY - 11.4 * z, 10 * z, 1.4 * z, beltColor);
      if (isFacingAway) {
        rect(cx - 0.6 * z, baseY - 11.5 * z, 1.2 * z, 1.5 * z, trouserDark);
      } else {
        rect(cx - 1 * z, baseY - 11.4 * z, 2 * z, 1.4 * z, buckleColor);
      }
      rect(cx - 5 * z, baseY - 10 * z, 10 * z, 1.8 * z, trouserDark);
      rect(cx - 4.6 * z, baseY - 9.8 * z, 3.8 * z, 1.6 * z, trouserMain);
      rect(cx + 0.8 * z, baseY - 9.8 * z, 3.8 * z, 1.6 * z, trouserMain);
      rect(cx - 4.6 * z, baseY - 8.4 * z + mLegSwing, 3.6 * z, 3.2 * z, trouserMain);
      rect(cx + 1 * z, baseY - 8.4 * z - mLegSwing, 3.6 * z, 3.2 * z, trouserMain);
      rect(cx - 4 * z, baseY - 5.4 * z + mLegSwing, 3 * z, 2.8 * z, trouserMain);
      rect(cx + 1 * z, baseY - 5.4 * z - mLegSwing, 3 * z, 2.8 * z, trouserMain);
      rect(cx - 2 * z, baseY - 8 * z + mLegSwing, 1 * z, 5 * z, trouserDark);
      rect(cx + 1 * z, baseY - 8 * z - mLegSwing, 1 * z, 5 * z, trouserDark);
      rect(cx - 4.2 * z, baseY - 3.4 * z + mLegSwing, 3.2 * z, 0.8 * z, trouserDark);
      rect(cx + 1 * z, baseY - 3.4 * z - mLegSwing, 3.2 * z, 0.8 * z, trouserDark);
      rect(cx - 4 * z, baseY - 2.7 * z + mLegSwing, 3 * z, 0.8 * z, uniform.dark);
      rect(cx + 1 * z, baseY - 2.7 * z - mLegSwing, 3 * z, 0.8 * z, uniform.dark);
      if (isSneaker) {
        rect(cx - 4.4 * z, baseY - 2 * z + mLegSwing, 3.4 * z, 1.4 * z, '#1e2436');
        rect(cx + 1 * z, baseY - 2 * z - mLegSwing, 3.4 * z, 1.4 * z, '#1e2436');
        if (!isFacingAway) {
          rect(cx - 3.6 * z, baseY - 1.8 * z + mLegSwing, 1.6 * z, 0.8 * z, uniform.trim);
          rect(cx + 2 * z, baseY - 1.8 * z - mLegSwing, 1.6 * z, 0.8 * z, uniform.trim);
        }
        rect(cx - 4.4 * z, baseY - 0.8 * z + mLegSwing, 3.4 * z, 0.8 * z, '#f2f5ff');
        rect(cx + 1 * z, baseY - 0.8 * z - mLegSwing, 3.4 * z, 0.8 * z, '#f2f5ff');
      } else {
        const vampCol = palette.maleOutfitStyle === 'vest_ensemble' ? '#382216' : '#2b1a12';
        const capCol = palette.maleOutfitStyle === 'vest_ensemble' ? '#5e3a24' : '#4d3020';
        rect(cx - 4.4 * z, baseY - 2 * z + mLegSwing, 3.4 * z, 1.4 * z, vampCol);
        rect(cx + 1 * z, baseY - 2 * z - mLegSwing, 3.4 * z, 1.4 * z, vampCol);
        if (!isFacingAway) {
          rect(cx - 4.4 * z, baseY - 1.8 * z + mLegSwing, 1.6 * z, 1 * z, capCol);
          rect(cx + 2.8 * z, baseY - 1.8 * z - mLegSwing, 1.6 * z, 1 * z, capCol);
        }
        rect(cx - 4.4 * z, baseY - 0.8 * z + mLegSwing, 3.4 * z, 0.8 * z, '#11131c');
        rect(cx + 1 * z, baseY - 0.8 * z - mLegSwing, 3.4 * z, 0.8 * z, '#11131c');
      }
    }
  }

  // 3. Torso, Neck & Arms (Hourglass feminine silhouette vs Athletic V-Taper male silhouette across 8 angles)
  const typeWaveL = Math.sin(timeSec * 14);
  const typeWaveR = Math.sin(timeSec * 14 + Math.PI);
  const keyTapL = isCodingPose ? (typeWaveL > 0 ? 1.1 : -0.5) * z : 0;
  const keyTapR = isCodingPose ? (typeWaveR > 0 ? 1.1 : -0.5) * z : 0;

  if (palette.gender === 'female') {
    if (isSideProfile) {
      // Slender 3.2*z lateral neck positioned cleanly under profile jaw
      uRect(-1.8, uY - 22 * z, 3.2, 1, palette.skinShadow);
      uRect(-1.4, uY - 21 * z, 2.8, 2.5, palette.skin);
      // Lateral feminine hourglass blazer (6.4*z bust -> 5.2*z cinched waist) + silk lapel & pendant
      uRect(0.4, uY - 19.6 * z, 2.2, 1.4, '#f6f7fc');
      uRect(-3.0, uY - 19.4 * z, 5.6, 1.2, uniform.dark);
      uRect(-3.2, uY - 18.4 * z, 6.6, 3.5, uniform.dark);
      uRect(-2.6, uY - 18.4 * z, 5.6, 3.4, uniform.main);
      uRect(1.8, uY - 18.4 * z, 1.4, 2.4, '#f6f7fc');
      uRect(2.4, uY - 17.2 * z, 0.9, 0.9, uniform.trim);
      uRect(-2.6, uY - 15 * z, 5.2, 3, uniform.dark);
      uRect(-2.0, uY - 15 * z, 4.2, 2.5, uniform.main);
      uRect(-2.6, uY - 12.6 * z, 5.2, 0.8, uniform.dark);
      uRect(1.6, uY - 12.6 * z, 1.2, 0.8, uniform.trim);
    } else {
      // Slender 4*z neck between tapered chin and collar
      rect(uX - 2 * z, uY - 22 * z, 4 * z, 1 * z, palette.skinShadow);
      rect(uX - 2 * z, uY - 21 * z, 4 * z, 2.5 * z, palette.skin);

      if (isFacingAway) {
        // Rear / 3/4-Rear view of tailored feminine blazer & silk collar nape (N / NE / NW)
        rect(uX - 2.4 * z, uY - 19.8 * z, 4.8 * z, 1.1 * z, '#f6f7fc');
        rect(uX - 4 * z, uY - 19.3 * z, 8 * z, 1.2 * z, uniform.dark);
        rect(uX - 5 * z, uY - 18.4 * z, 10 * z, 3.6 * z, uniform.dark);
        rect(uX - 4.2 * z, uY - 18.4 * z, 8.4 * z, 3.5 * z, uniform.main);
        rect(uX - 4 * z, uY - 15 * z, 8 * z, 3 * z, uniform.dark);
        rect(uX - 3.3 * z, uY - 15 * z, 6.6 * z, 2.5 * z, uniform.main);
        // Tailored center back seam (symmetric at 0 on pure N; subtly rotated on NE/NW) + waist belt trim
        const seamShift = isPureBack ? 0 : -dirFlip * 0.6 * z;
        rect(uX - 0.5 * z + seamShift, uY - 18.4 * z, 1 * z, 5.8 * z, uniform.dark);
        rect(uX - 4 * z, uY - 12.6 * z, 8 * z, 0.8 * z, uniform.dark);
      } else {
        // Sloped 8*z top shoulder edge -> 10*z slim upper chest -> 8*z tapered hourglass waist (S / SE / SW)
        const frontShift = isPureFront ? 0 : dirFlip * 0.35 * z;
        rect(uX - 4 * z, uY - 19.5 * z, 8 * z, 1.2 * z, uniform.dark);
        rect(uX - 3.4 * z, uY - 19.3 * z, 6.8 * z, 1.2 * z, uniform.main);
        rect(uX - 5 * z, uY - 18.5 * z, 10 * z, 3.6 * z, uniform.dark);
        rect(uX - 4.2 * z, uY - 18.5 * z, 8.4 * z, 3.6 * z, uniform.main);
        // Tapered 8*z waist (uY - 15*z..uY - 12*z) + subtle waist belt/seam
        rect(uX - 4 * z, uY - 15 * z, 8 * z, 3 * z, uniform.dark);
        rect(uX - 3.2 * z, uY - 15 * z, 6.4 * z, 2.4 * z, uniform.main);
        rect(uX - 4 * z, uY - 12.6 * z, 8 * z, 0.8 * z, uniform.dark);
        rect(uX - 1 * z + frontShift, uY - 12.6 * z, 2 * z, 0.8 * z, uniform.trim);

        // Open collarbone V + silk V-neck blouse (#f6f7fc) + 1*z pendant necklace (uniform.trim)
        rect(uX - 1.4 * z + frontShift * 0.5, uY - 19.5 * z, 2.8 * z, 1.4 * z, palette.skin);
        rect(uX - 2.4 * z + frontShift, uY - 18.5 * z, 4.8 * z, 1.5 * z, '#f6f7fc');
        rect(uX - 1 * z + frontShift, uY - 18.8 * z, 2 * z, 1 * z, palette.skin);
        rect(uX - 1.5 * z + frontShift, uY - 17 * z, 3 * z, 2 * z, '#f6f7fc');
        rect(uX - 0.8 * z + frontShift, uY - 15 * z, 1.6 * z, 1.5 * z, '#f6f7fc');
        rect(uX - 0.5 * z + frontShift, uY - 17.6 * z, 1 * z, 1 * z, uniform.trim);
      }
    }

    // Female Arms & Hands across all 8 angles
    if (isSideProfile) {
      if (isCodingPose) {
        uRect(2.4, uY - 16.4 * z + keyTapL * 0.4, 4.8, 1.6, uniform.dark);
        uRect(6.8, uY - 16.5 * z + keyTapL, 2.4, 1.6, palette.skinShadow);
        uRect(-1.2, uY - 18 * z, 2.4, 3.2, uniform.main);
        uRect(-0.4, uY - 15.2 * z + keyTapR * 0.4, 6.8, 1.9, uniform.main);
        uRect(6, uY - 15.3 * z + keyTapR, 2.8, 1.8, palette.skin);
        if (typeWaveR > 0.55) {
          uRect(7.4, uY - 13.4 * z + keyTapR, 1.5, 0.9, '#3be87a');
        }
      } else if (seated) {
        // Seated lateral profile (E / W conference chair): 90°-bent arm reaching cleanly toward table
        uRect(-1.4, uY - 18 * z, 2.4, 3.6, uniform.main);
        uRect(-0.8, uY - 14.8 * z, 5.2, 1.9, uniform.main);
        uRect(3.8, uY - 14.7 * z, 0.8, 1.7, '#f6f7fc');
        if (emp.activity !== 'gaming') {
          uRect(4.4, uY - 14.6 * z, 2.4, 1.7, palette.skin);
        }
      } else if (isLaptopPose) {
        dRect(2.4, baseY - 14.2 * z, 3.6, 2, uniform.dark);
        dRect(-1.6, baseY - 18 * z, 2.4, 3.8, uniform.main);
      } else {
        const armSwing = -sideStride * 0.85;
        if (Math.abs(armSwing) > 0.35) {
          dRect(-0.8 - armSwing * 0.9, baseY - 17.8 * z, 2, 5.8, uniform.dark);
          dRect(-0.8 - armSwing * 0.9, baseY - 12 * z, 1.8, 1.5, palette.skinShadow);
        }
        dRect(-1.2 + armSwing * 0.5, baseY - 18 * z, 2.3, 3.6, uniform.main);
        dRect(-1 + armSwing, baseY - 14.5 * z, 2.1, 3.2, uniform.main);
        dRect(-0.9 + armSwing * 1.1, baseY - 11.4 * z, 2, 1.6, palette.skin);
      }
    } else if (isPureBack) {
      if (isCodingPose) {
        rect(uX - 6.4 * z, uY - 18.2 * z, 2.2 * z, 3.4 * z, uniform.main);
        rect(uX + 4.2 * z, uY - 18.2 * z, 2.2 * z, 3.4 * z, uniform.main);
        rect(uX - 6.8 * z, uY - 16.4 * z + keyTapL * 0.3, 2 * z, 2.2 * z, uniform.dark);
        rect(uX + 4.8 * z, uY - 16.4 * z + keyTapR * 0.3, 2 * z, 2.2 * z, uniform.dark);
      } else if (seated) {
        // Seated pure North (south-side conference chair): symmetric upper sleeves & forward-tucked elbows
        rect(uX - 6.4 * z, uY - 18 * z, 2.1 * z, 3.8 * z, uniform.main);
        rect(uX + 4.3 * z, uY - 18 * z, 2.1 * z, 3.8 * z, uniform.main);
        rect(uX - 6.6 * z, uY - 15.2 * z, 1.8 * z, 2 * z, uniform.dark);
        rect(uX + 4.8 * z, uY - 15.2 * z, 1.8 * z, 2 * z, uniform.dark);
      } else if (isLaptopPose) {
        rect(cx - 6.6 * z, baseY - 18.2 * z, 2.2 * z, 4 * z, uniform.main);
        rect(cx + 4.4 * z, baseY - 18.2 * z, 2.2 * z, 4 * z, uniform.main);
      } else {
        const armBob = legSwing * 0.3;
        rect(cx - 7 * z, baseY - 18 * z - armBob, 2 * z, 6.4 * z, uniform.main);
        rect(cx + 5 * z, baseY - 18 * z + armBob, 2 * z, 6.4 * z, uniform.main);
        rect(cx - 7 * z, baseY - 11.6 * z - armBob, 2 * z, 1.5 * z, palette.skinShadow);
        rect(cx + 5 * z, baseY - 11.6 * z + armBob, 2 * z, 1.5 * z, palette.skinShadow);
      }
    } else if (isCodingPose) {
      if (isFacingAway) {
        // Extended slender forearms & dainty hands reaching forward-up onto keyboard (NE/NW)
        const farArmX = dirFlip > 0 ? uX + 3.4 * z : uX - 9.2 * z;
        const farHandX = dirFlip > 0 ? uX + 8.6 * z : uX - 11.4 * z;
        rect(dirFlip > 0 ? uX + 2.4 * z : uX - 4.4 * z, uY - 18.4 * z, 2 * z, 2.4 * z, uniform.main);
        rect(farArmX, uY - 17.6 * z + keyTapL * 0.4, 5.8 * z, 1.9 * z, uniform.main);
        rect(farHandX, uY - 17.8 * z + keyTapL, 2.8 * z, 1.8 * z, palette.skin);

        // Near-side shoulder bicep + extended forearm reaching across to keyboard home row
        const nearBicepX = dirFlip > 0 ? uX - 4.2 * z : uX + 2 * z;
        const nearForeX = dirFlip > 0 ? uX - 2.2 * z : uX - 6.4 * z;
        const nearHandX = dirFlip > 0 ? uX + 6.2 * z : uX - 9 * z;
        rect(nearBicepX, uY - 17.8 * z, 2.2 * z, 3.2 * z, uniform.dark);
        rect(nearForeX, uY - 15.4 * z + keyTapR * 0.4, 8.6 * z, 1.9 * z, uniform.main);
        rect(nearHandX, uY - 15.6 * z + keyTapR, 2.8 * z, 1.8 * z, palette.skin);

        if (typeWaveL > 0.55) {
          rect(farHandX + (dirFlip > 0 ? 1.2 : 0) * z, uY - 15.9 * z + keyTapL, 1.5 * z, 0.9 * z, '#7ef3ff');
        }
        if (typeWaveR > 0.55) {
          rect(nearHandX + (dirFlip > 0 ? 1.2 : 0) * z, uY - 13.7 * z + keyTapR, 1.5 * z, 0.9 * z, '#3be87a');
        }
      } else if (isPureFront) {
        // Pure South coding: symmetric forearms typing forward
        rect(uX - 6.4 * z, uY - 18.2 * z, 2 * z, 3.2 * z, uniform.main);
        rect(uX + 4.4 * z, uY - 18.2 * z, 2 * z, 3.2 * z, uniform.main);
        rect(uX - 6 * z, uY - 15 * z + keyTapL * 0.4, 4.2 * z, 1.9 * z, uniform.main);
        rect(uX + 1.8 * z, uY - 15 * z + keyTapR * 0.4, 4.2 * z, 1.9 * z, uniform.main);
        rect(uX - 3.6 * z, uY - 14.6 * z + keyTapL, 2.6 * z, 1.8 * z, palette.skin);
        rect(uX + 1 * z, uY - 14.6 * z + keyTapR, 2.6 * z, 1.8 * z, palette.skin);
      } else {
        // Seated SE/SW coding: BOTH forearms & hands slope naturally forward-down onto the desk keyboard!
        rect(uX - 6.4 * z, uY - 18.2 * z, 2 * z, 3.8 * z, uniform.main);
        rect(uX + 4.4 * z, uY - 18.2 * z, 2 * z, 3.6 * z, uniform.main);
        const crossForeX = dirFlip > 0 ? uX - 6 * z : uX - 4.8 * z;
        const crossHandX = dirFlip > 0 ? uX + 4.2 * z : uX - 7.2 * z;
        const leadForeX = dirFlip > 0 ? uX + 4.2 * z : uX - 9.2 * z;
        const leadHandX = dirFlip > 0 ? uX + 8.2 * z : uX - 11.4 * z;
        rect(crossForeX, uY - 13.4 * z + keyTapL * 0.4, 10.8 * z, 1.9 * z, uniform.main);
        rect(leadForeX, uY - 14.4 * z + keyTapR * 0.4, 5 * z, 1.9 * z, uniform.main);
        rect(crossHandX, uY - 13.1 * z + keyTapL, 3 * z, 1.9 * z, palette.skin);
        rect(leadHandX, uY - 14.1 * z + keyTapR, 3.2 * z, 1.9 * z, palette.skin);
        if (typeWaveL > 0.55) {
          rect(crossHandX + (dirFlip > 0 ? 1.4 : 0) * z, uY - 11.1 * z + keyTapL, 1.6 * z, 0.9 * z, '#7ef3ff');
        }
        if (typeWaveR > 0.55) {
          rect(leadHandX + (dirFlip > 0 ? 1.6 : 0) * z, uY - 12.1 * z + keyTapR, 1.6 * z, 0.9 * z, '#3be87a');
        }
      }
    } else if (seated) {
      if (isFacingAway) {
        // Seated 3/4 rear (NE / NW conference chair): forearms reach forward toward conference table, never across spine!
        uRect(3.2, uY - 18 * z, 2, 2.8, uniform.main);
        uRect(3.8, uY - 16 * z, 4, 1.8, uniform.main);
        uRect(7.4, uY - 16 * z, 2.2, 1.6, palette.skin);
        uRect(-5.6, uY - 17.8 * z, 2.1, 3.6, uniform.dark);
        uRect(-4.6, uY - 15 * z, 3.4, 1.8, uniform.main);
      } else {
        // Relaxed seated front/3/4 posture (S / SE / SW meeting / lounge / gaming)
        rect(uX - 6.4 * z, uY - 18 * z, 2 * z, 3.6 * z, uniform.main);
        rect(uX + 4.4 * z, uY - 18 * z, 2 * z, 3.6 * z, uniform.main);
        rect(uX - 5.8 * z, uY - 14.6 * z, 3.2 * z, 1.8 * z, uniform.main);
        rect(uX + 2.6 * z, uY - 14.6 * z, 3.2 * z, 1.8 * z, uniform.main);
        if (emp.activity !== 'gaming') {
          rect(uX - 3.2 * z, uY - 14.4 * z, 2 * z, 1.6 * z, palette.skin);
          rect(uX + 1.2 * z, uY - 14.4 * z, 2 * z, 1.6 * z, palette.skin);
        }
      }
    } else if (isLaptopPose) {
      // Standing laptop posture: bent upper sleeves + supporting forearm cradling the open laptop deck
      dRect(-6.8, baseY - 18.2 * z, 2, 4, uniform.main);
      dRect(4.4, baseY - 18.2 * z, 2, 4.2, uniform.main);
      dRect(3.2, baseY - 14.2 * z, 3.4, 2.2, uniform.dark);
    } else {
      // Standing / walking slender 2*z arms
      const armBob = legSwing * 0.3;
      rect(cx - 7 * z, baseY - 18 * z - armBob, 2 * z, 6.5 * z, uniform.main);
      rect(cx + 5 * z, baseY - 18 * z + armBob, 2 * z, 6.5 * z, uniform.main);
      rect(cx - 7 * z, baseY - 11.5 * z - armBob, 2 * z, 1.6 * z, palette.skin);
      rect(cx + 5 * z, baseY - 11.5 * z + armBob, 2 * z, 1.6 * z, palette.skin);
    }

    // Front collarbone cascades for 'long_locks'
    if (
      palette.femaleHairStyle === 'long_locks' &&
      !enclosingHelmet &&
      !isCostumeEvent(activeEventKind)
    ) {
      if (isSideProfile) {
        uRect(0.8, uY - 21.8 * z, 1.8, 4.6, palette.hair);
        uRect(1.1, uY - 21 * z, 0.9, 2.2, palette.hairHighlight);
      } else if (!isFacingAway) {
        rect(uX - 5.2 * z, uY - 22 * z, 2 * z, 3.5 * z, palette.hair);
        rect(uX - 4.8 * z, uY - 18.5 * z, 1.2 * z, 2.5 * z, palette.hair);
        rect(uX - 4.8 * z, uY - 21 * z, 1 * z, 2 * z, palette.hairHighlight);
        rect(uX + 3.2 * z, uY - 22 * z, 2 * z, 3.5 * z, palette.hair);
        rect(uX + 3.6 * z, uY - 18.5 * z, 1.2 * z, 2.5 * z, palette.hair);
        rect(uX + 3.8 * z, uY - 21 * z, 1 * z, 2 * z, palette.hairHighlight);
      }
    }
  } else {
    const isVest = palette.maleOutfitStyle === 'vest_ensemble';
    const isHoodie = palette.maleOutfitStyle === 'tech_hoodie';
    const upperSleeveCol = isVest ? '#eef2fc' : uniform.main;
    const foreArmCol = isVest ? palette.skin : uniform.main;

    if (isSideProfile) {
      // Sturdy 4.4*z lateral neck
      uRect(-2.4, uY - 22.4 * z, 4.4, 2.8, palette.skinShadow);
      uRect(-1.6, uY - 21.4 * z, 3.4, 2, palette.skin);

      if (isHoodie) {
        uRect(-5.2, uY - 21 * z, 4.4, 2.8, uniform.dark);
        uRect(-4.6, uY - 20.4 * z, 3, 1.6, '#1b2234');
        uRect(-4, uY - 19.2 * z, 8.2, 3.4, uniform.dark);
        uRect(-3.2, uY - 19 * z, 6.8, 3.2, uniform.main);
        uRect(-3.6, uY - 15.8 * z, 7.2, 2.8, uniform.dark);
        uRect(-2.8, uY - 15.8 * z, 5.8, 2.6, uniform.main);
        uRect(-3.4, uY - 13 * z, 6.8, 1.8, uniform.dark);
        uRect(3.2, uY - 18.6 * z, 0.9, 6.6, '#9aa7c7');
        uRect(2.2, uY - 18.4 * z, 0.8, 2.6, uniform.trim);
      } else if (isVest) {
        uRect(-2.4, uY - 20.2 * z, 5.4, 1.4, '#f6f7fc');
        uRect(-4, uY - 19.2 * z, 8, 3.4, uniform.dark);
        uRect(-3.2, uY - 19 * z, 6.6, 3.2, uniform.main);
        uRect(-3.6, uY - 15.8 * z, 7.2, 2.8, uniform.dark);
        uRect(-2.8, uY - 15.8 * z, 5.8, 2.6, uniform.main);
        uRect(-3.4, uY - 13 * z, 6.8, 1.8, uniform.dark);
        uRect(2.6, uY - 19 * z, 1.4, 3.4, '#f6f7fc');
        uRect(3.2, uY - 18.8 * z, 1.1, 3.8, uniform.trim);
      } else {
        uRect(-2.4, uY - 20.2 * z, 5.4, 1.4, '#f6f7fc');
        uRect(-4, uY - 19.2 * z, 8.2, 3.4, uniform.dark);
        uRect(-3.2, uY - 19 * z, 6.8, 3.2, uniform.main);
        uRect(-3.6, uY - 15.8 * z, 7.2, 2.8, uniform.dark);
        uRect(-2.8, uY - 15.8 * z, 5.8, 2.6, uniform.main);
        uRect(-3.4, uY - 13 * z, 6.8, 1.8, uniform.dark);
        uRect(2.4, uY - 18.8 * z, 1.6, 3.6, '#f6f7fc');
        uRect(1.6, uY - 18.8 * z, 1.1, 3.8, uniform.dark);
        uRect(3.2, uY - 18.6 * z, 1.1, 4.6, uniform.trim);
      }
    } else {
      // Sturdy 5-6*z masculine neck between chiselled chin and shirt collar
      rect(uX - 3 * z, uY - 22.4 * z, 6 * z, 2.8 * z, palette.skinShadow);
      rect(uX - 2 * z, uY - 21.4 * z, 4 * z, 2 * z, palette.skin);

      if (isFacingAway) {
        // Rear / 3/4-Rear view of athletic V-taper male torso (N / NE / NW)
        const seamShift = isPureBack ? 0 : -dirFlip * 0.7 * z;
        if (isHoodie) {
          rect(uX - 6.6 * z, uY - 19.2 * z, 13.2 * z, 3.4 * z, uniform.dark);
          rect(uX - 5.8 * z, uY - 19 * z, 11.6 * z, 3.2 * z, uniform.main);
          rect(uX - 5.6 * z, uY - 15.8 * z, 11.2 * z, 2.6 * z, uniform.dark);
          rect(uX - 4.8 * z, uY - 15.8 * z, 9.6 * z, 2.6 * z, uniform.main);
          rect(uX - 4.8 * z, uY - 13.2 * z, 9.6 * z, 2 * z, uniform.dark);
          rect(uX - 4.6 * z, uY - 21 * z, 9.2 * z, 2.8 * z, uniform.dark);
          rect(uX - 3.6 * z, uY - 20.6 * z, 7.2 * z, 1.8 * z, '#1b2234');
        } else if (isVest) {
          rect(uX - 3.2 * z, uY - 20.4 * z, 6.4 * z, 1.4 * z, '#f6f7fc');
          rect(uX - 6.6 * z, uY - 19.2 * z, 13.2 * z, 3.2 * z, '#eef2fc');
          rect(uX - 5.4 * z, uY - 19 * z, 10.8 * z, 3.2 * z, uniform.dark);
          rect(uX - 4.6 * z, uY - 18.8 * z, 9.2 * z, 3 * z, uniform.main);
          rect(uX - 5.4 * z, uY - 15.8 * z, 10.8 * z, 2.6 * z, uniform.dark);
          rect(uX - 4.6 * z, uY - 15.8 * z, 9.2 * z, 2.6 * z, uniform.main);
          rect(uX - 4.8 * z, uY - 13.2 * z, 9.6 * z, 2 * z, uniform.dark);
          rect(uX - 3.2 * z + seamShift * 0.5, uY - 14.2 * z, 6.4 * z, 0.9 * z, '#141926');
          rect(uX - 0.8 * z + seamShift, uY - 14.3 * z, 1.6 * z, 1.1 * z, '#ffd147');
        } else {
          rect(uX - 3 * z, uY - 20.5 * z, 6 * z, 1.2 * z, '#f6f7fc');
          rect(uX - 5 * z, uY - 19.8 * z, 10 * z, 1.2 * z, uniform.dark);
          rect(uX - 6.6 * z, uY - 19.2 * z, 13.2 * z, 3.4 * z, uniform.dark);
          rect(uX - 5.8 * z, uY - 19 * z, 11.6 * z, 3.2 * z, uniform.main);
          rect(uX - 5.6 * z, uY - 15.8 * z, 11.2 * z, 2.6 * z, uniform.dark);
          rect(uX - 4.8 * z, uY - 15.8 * z, 9.6 * z, 2.6 * z, uniform.main);
          rect(uX - 4.8 * z, uY - 13.2 * z, 9.6 * z, 2 * z, uniform.dark);
          rect(uX - 0.5 * z + seamShift, uY - 18.8 * z, 1 * z, 6.8 * z, uniform.dark);
        }
      } else if (isHoodie) {
        const frontShift = isPureFront ? 0 : dirFlip * 0.4 * z;
        rect(uX - 5 * z, uY - 20.4 * z, 10 * z, 1.6 * z, uniform.dark);
        rect(uX - 7 * z, uY - 19.2 * z, 14 * z, 3.4 * z, uniform.dark);
        rect(uX - 6 * z, uY - 19 * z, 12 * z, 3.2 * z, uniform.main);
        rect(uX - 6 * z, uY - 15.8 * z, 12 * z, 2.6 * z, uniform.dark);
        rect(uX - 5 * z, uY - 15.8 * z, 10 * z, 2.6 * z, uniform.main);
        rect(uX - 5 * z, uY - 13.2 * z, 10 * z, 2 * z, uniform.dark);
        rect(uX - 4 * z, uY - 13.2 * z, 8 * z, 1.4 * z, uniform.main);
        rect(uX - 2 * z + frontShift, uY - 20 * z, 4 * z, 2 * z, '#1b2234');
        rect(uX - 2.4 * z + frontShift, uY - 20.2 * z, 1.2 * z, 1.2 * z, '#f4f6fc');
        rect(uX + 1.2 * z + frontShift, uY - 20.2 * z, 1.2 * z, 1.2 * z, '#f4f6fc');
        rect(uX - 2.4 * z + frontShift, uY - 18.4 * z, 0.9 * z, 2.6 * z, uniform.trim);
        rect(uX + 1.5 * z + frontShift, uY - 18.4 * z, 0.9 * z, 2.6 * z, uniform.trim);
        rect(uX - 0.5 * z + frontShift, uY - 18.4 * z, 1 * z, 7 * z, '#9aa7c7');
        rect(uX - 0.6 * z + frontShift, uY - 17 * z, 1.2 * z, 1 * z, '#ffffff');
        rect(uX - 4.2 * z, uY - 14.4 * z, 3 * z, 2 * z, uniform.dark);
        rect(uX + 1.2 * z, uY - 14.4 * z, 3 * z, 2 * z, uniform.dark);
      } else if (isVest) {
        const frontShift = isPureFront ? 0 : dirFlip * 0.4 * z;
        rect(uX - 5 * z, uY - 20.2 * z, 10 * z, 1.4 * z, '#dce4f7');
        rect(uX - 7 * z, uY - 19.2 * z, 14 * z, 3.4 * z, '#eef2fc');
        rect(uX - 5.6 * z, uY - 19.2 * z, 11.2 * z, 3.4 * z, uniform.dark);
        rect(uX - 4.8 * z, uY - 19 * z, 9.6 * z, 3.2 * z, uniform.main);
        rect(uX - 6 * z, uY - 15.8 * z, 12 * z, 2.6 * z, uniform.dark);
        rect(uX - 5 * z, uY - 15.8 * z, 10 * z, 2.6 * z, uniform.main);
        rect(uX - 5 * z, uY - 13.2 * z, 10 * z, 2 * z, uniform.dark);
        rect(uX - 4.2 * z, uY - 13.2 * z, 8.4 * z, 1.6 * z, uniform.main);
        rect(uX - 2.6 * z + frontShift, uY - 20.2 * z, 5.2 * z, 1.6 * z, '#f6f7fc');
        rect(uX - 1.8 * z + frontShift, uY - 18.6 * z, 3.6 * z, 2.8 * z, '#f6f7fc');
        rect(uX - 0.9 * z + frontShift, uY - 19.2 * z, 1.8 * z, 3.6 * z, uniform.trim);
        rect(uX - 0.5 * z + frontShift, uY - 15.2 * z, 1 * z, 0.8 * z, uniform.trim);
        rect(uX - 0.5 * z + frontShift, uY - 13.8 * z, 1 * z, 0.8 * z, uniform.trim);
        rect(uX - 0.5 * z + frontShift, uY - 12.4 * z, 1 * z, 0.8 * z, uniform.trim);
      } else {
        const frontShift = isPureFront ? 0 : dirFlip * 0.4 * z;
        rect(uX - 5 * z, uY - 20.2 * z, 10 * z, 1.4 * z, uniform.dark);
        rect(uX - 7 * z, uY - 19.2 * z, 14 * z, 3.4 * z, uniform.dark);
        rect(uX - 6 * z, uY - 19 * z, 12 * z, 3.2 * z, uniform.main);
        rect(uX - 6 * z, uY - 15.8 * z, 12 * z, 2.6 * z, uniform.dark);
        rect(uX - 5 * z, uY - 15.8 * z, 10 * z, 2.6 * z, uniform.main);
        rect(uX - 5 * z, uY - 13.2 * z, 10 * z, 2 * z, uniform.dark);
        rect(uX - 4.2 * z, uY - 13.2 * z, 8.4 * z, 1.6 * z, uniform.main);
        rect(uX - 2.6 * z + frontShift, uY - 20.2 * z, 5.2 * z, 1.6 * z, '#f6f7fc');
        rect(uX - 1.8 * z + frontShift, uY - 18.6 * z, 3.6 * z, 3.6 * z, '#f6f7fc');
        rect(uX - 1 * z + frontShift, uY - 15 * z, 2 * z, 1.6 * z, '#f6f7fc');
        rect(uX - 3 * z + frontShift, uY - 18.8 * z, 1.2 * z, 3.6 * z, uniform.dark);
        rect(uX + 1.8 * z + frontShift, uY - 18.8 * z, 1.2 * z, 3.6 * z, uniform.dark);
        rect(uX - 0.9 * z + frontShift, uY - 19.2 * z, 1.8 * z, 5.6 * z, uniform.trim);
        rect(uX - 1 * z + frontShift, uY - 16.4 * z, 2 * z, 0.8 * z, '#ffffff');
        rect(uX + 2.4 * z + frontShift * 0.5, uY - 17 * z, 1.6 * z, 0.9 * z, uniform.trim);
      }
    }

    // Male Arms & Hands across all 8 angles
    if (isSideProfile) {
      if (isCodingPose) {
        uRect(3, uY - 16.6 * z + keyTapL * 0.4, 5.2, 1.9, uniform.dark);
        uRect(7.8, uY - 16.7 * z + keyTapL, 2.8, 1.8, palette.skinShadow);
        uRect(-1.6, uY - 18.6 * z, 3, 3.6, upperSleeveCol);
        if (isVest) {
          uRect(-1.6, uY - 15.4 * z, 3, 1, '#cfd8ee');
        }
        uRect(-0.6, uY - 15.4 * z + keyTapR * 0.4, 7.6, 2.2, foreArmCol);
        if (!isVest && !isHoodie) {
          uRect(6.2, uY - 15.4 * z + keyTapR * 0.4, 0.9, 2.1, '#f6f7fc');
        }
        uRect(6.8, uY - 15.5 * z + keyTapR, 3.2, 2, palette.skin);
        if (typeWaveR > 0.55) {
          uRect(8.4, uY - 13.5 * z + keyTapR, 1.6, 0.9, '#3be87a');
        }
      } else if (seated) {
        // Seated lateral profile (E / W conference chair): 90°-bent arm reaching cleanly toward table
        uRect(-1.8, uY - 18.6 * z, 3, 3.8, upperSleeveCol);
        if (isVest) {
          uRect(-1.8, uY - 15.2 * z, 3, 1, '#cfd8ee');
        }
        uRect(-1, uY - 15.2 * z, 6, 2.2, foreArmCol);
        if (!isVest && !isHoodie) {
          uRect(4.4, uY - 15.1 * z, 0.9, 2, '#f6f7fc');
        }
        if (emp.activity !== 'gaming') {
          uRect(5.1, uY - 15 * z, 2.8, 1.9, palette.skin);
        }
      } else if (isLaptopPose) {
        dRect(3.2, baseY - 14.6 * z, 4, 2.2, uniform.dark);
        dRect(-1.8, baseY - 18.6 * z, 3, 4, upperSleeveCol);
      } else {
        const armSwing = -sideStride * 0.9;
        if (Math.abs(armSwing) > 0.35) {
          dRect(-1 - armSwing * 0.9, baseY - 18.4 * z, 2.4, 6.2, uniform.dark);
          dRect(-1 - armSwing * 0.9, baseY - 12.2 * z, 2, 1.6, palette.skinShadow);
        }
        dRect(-1.6 + armSwing * 0.5, baseY - 18.6 * z, 3, 3.6, upperSleeveCol);
        if (isVest) {
          dRect(-1.6 + armSwing * 0.6, baseY - 15.2 * z, 3, 1, '#cfd8ee');
        }
        dRect(-1.3 + armSwing, baseY - 15.2 * z, 2.5, 3.3, foreArmCol);
        if (!isVest && !isHoodie) {
          dRect(-1.3 + armSwing, baseY - 12.2 * z, 2.5, 0.8, '#f6f7fc');
        }
        dRect(-1.2 + armSwing * 1.1, baseY - 11.6 * z, 2.3, 1.8, palette.skin);
      }
    } else if (isPureBack) {
      if (isCodingPose) {
        rect(uX - 8.4 * z, uY - 18.6 * z, 2.8 * z, 3.6 * z, upperSleeveCol);
        rect(uX + 5.6 * z, uY - 18.6 * z, 2.8 * z, 3.6 * z, upperSleeveCol);
        rect(uX - 8.8 * z, uY - 16.6 * z + keyTapL * 0.3, 2.4 * z, 2.4 * z, foreArmCol);
        rect(uX + 6.4 * z, uY - 16.6 * z + keyTapR * 0.3, 2.4 * z, 2.4 * z, foreArmCol);
      } else if (seated) {
        // Seated pure North (south-side conference chair): symmetric upper sleeves & forward-tucked elbows
        rect(uX - 8.4 * z, uY - 18.6 * z, 2.6 * z, 3.8 * z, upperSleeveCol);
        rect(uX + 5.8 * z, uY - 18.6 * z, 2.6 * z, 3.8 * z, upperSleeveCol);
        rect(uX - 8.6 * z, uY - 15.4 * z, 2.2 * z, 2.2 * z, foreArmCol);
        rect(uX + 6.4 * z, uY - 15.4 * z, 2.2 * z, 2.2 * z, foreArmCol);
      } else if (isLaptopPose) {
        rect(cx - 8.6 * z, baseY - 18.8 * z, 2.8 * z, 4.2 * z, upperSleeveCol);
        rect(cx + 5.8 * z, baseY - 18.8 * z, 2.8 * z, 4.2 * z, upperSleeveCol);
      } else {
        const armBob = legSwing * 0.3;
        rect(cx - 9 * z, baseY - 18.8 * z - armBob, 3 * z, 3.2 * z, upperSleeveCol);
        rect(cx + 6 * z, baseY - 18.8 * z + armBob, 3 * z, 3.2 * z, upperSleeveCol);
        rect(cx - 8 * z, baseY - 15.6 * z - armBob, 2 * z, 3.6 * z, foreArmCol);
        rect(cx + 6 * z, baseY - 15.6 * z + armBob, 2 * z, 3.6 * z, foreArmCol);
        rect(cx - 8 * z, baseY - 12 * z - armBob, 2 * z, 1.8 * z, palette.skinShadow);
        rect(cx + 6 * z, baseY - 12 * z + armBob, 2 * z, 1.8 * z, palette.skinShadow);
      }
    } else if (isCodingPose) {
      if (isFacingAway) {
        // Extended forearms & hands reaching forward-up onto the mechanical keyboard (NE/NW)
        const farArmX = dirFlip > 0 ? uX + 4 * z : uX - 10.2 * z;
        const farHandX = dirFlip > 0 ? uX + 9.4 * z : uX - 12.6 * z;
        rect(dirFlip > 0 ? uX + 3.2 * z : uX - 6 * z, uY - 18.6 * z, 2.8 * z, 2.8 * z, upperSleeveCol);
        rect(farArmX, uY - 17.8 * z + keyTapL * 0.4, 6.2 * z, 2.2 * z, foreArmCol);
        if (!isVest && !isHoodie) {
          rect(
            dirFlip > 0 ? uX + 8.8 * z : uX - 10.2 * z,
            uY - 17.8 * z + keyTapL * 0.4,
            1 * z,
            2.1 * z,
            '#f6f7fc',
          );
        }
        rect(farHandX, uY - 18 * z + keyTapL, 3.2 * z, 2 * z, palette.skin);

        // Near-side bicep + extended forearm reaching across to home row
        const nearBicepX = dirFlip > 0 ? uX - 5.8 * z : uX + 3 * z;
        const nearForeX = dirFlip > 0 ? uX - 3.4 * z : uX - 6.6 * z;
        const nearHandX = dirFlip > 0 ? uX + 6.8 * z : uX - 10 * z;
        rect(nearBicepX, uY - 18.2 * z, 2.8 * z, 3.4 * z, upperSleeveCol);
        if (isVest) {
          rect(nearBicepX, uY - 15.2 * z, 2.8 * z, 1 * z, '#cfd8ee');
        }
        rect(nearForeX, uY - 15.4 * z + keyTapR * 0.4, 10 * z, 2.2 * z, foreArmCol);
        if (!isVest && !isHoodie) {
          rect(
            dirFlip > 0 ? uX + 6 * z : uX - 7 * z,
            uY - 15.4 * z + keyTapR * 0.4,
            1 * z,
            2.1 * z,
            '#f6f7fc',
          );
        }
        rect(nearHandX, uY - 15.6 * z + keyTapR, 3.2 * z, 2 * z, palette.skin);

        if (typeWaveL > 0.55) {
          rect(farHandX + (dirFlip > 0 ? 1.5 : 0) * z, uY - 15.9 * z + keyTapL, 1.6 * z, 0.9 * z, '#7ef3ff');
        }
        if (typeWaveR > 0.55) {
          rect(nearHandX + (dirFlip > 0 ? 1.5 : 0) * z, uY - 13.5 * z + keyTapR, 1.6 * z, 0.9 * z, '#3be87a');
        }
      } else if (isPureFront) {
        rect(uX - 8.4 * z, uY - 18.6 * z, 2.6 * z, 3.4 * z, upperSleeveCol);
        rect(uX + 5.8 * z, uY - 18.6 * z, 2.6 * z, 3.4 * z, upperSleeveCol);
        rect(uX - 7.8 * z, uY - 15.2 * z + keyTapL * 0.4, 5.2 * z, 2.1 * z, foreArmCol);
        rect(uX + 2.6 * z, uY - 15.2 * z + keyTapR * 0.4, 5.2 * z, 2.1 * z, foreArmCol);
        rect(uX - 4.4 * z, uY - 14.8 * z + keyTapL, 3 * z, 2 * z, palette.skin);
        rect(uX + 1.4 * z, uY - 14.8 * z + keyTapR, 3 * z, 2 * z, palette.skin);
      } else {
        // Seated SE/SW coding: BOTH forearms & hands slope naturally forward-down onto the desk keyboard!
        rect(uX - 8.4 * z, uY - 18.6 * z, 2.6 * z, 4.1 * z, upperSleeveCol);
        rect(uX + 5.8 * z, uY - 18.6 * z, 2.6 * z, 3.8 * z, upperSleeveCol);
        if (isVest) {
          rect(uX - 8.4 * z, uY - 14.8 * z, 2.6 * z, 0.9 * z, '#cfd8ee');
          rect(uX + 5.8 * z, uY - 15.0 * z, 2.6 * z, 0.9 * z, '#cfd8ee');
        }
        const crossForeX = dirFlip > 0 ? uX - 7.8 * z : uX - 5.4 * z;
        const crossHandX = dirFlip > 0 ? uX + 5 * z : uX - 8.4 * z;
        const leadForeX = dirFlip > 0 ? uX + 5.4 * z : uX - 10.4 * z;
        const leadHandX = dirFlip > 0 ? uX + 9.2 * z : uX - 12.6 * z;
        rect(crossForeX, uY - 13.5 * z + keyTapL * 0.4, 13.2 * z, 2.1 * z, foreArmCol);
        rect(leadForeX, uY - 14.6 * z + keyTapR * 0.4, 5 * z, 2.1 * z, foreArmCol);
        if (!isVest && !isHoodie) {
          rect(
            dirFlip > 0 ? crossHandX - 0.8 * z : crossHandX + 3.4 * z,
            uY - 13.4 * z + keyTapL * 0.4,
            0.9 * z,
            2 * z,
            '#f6f7fc',
          );
          rect(
            dirFlip > 0 ? leadHandX - 0.8 * z : leadHandX + 3.4 * z,
            uY - 14.5 * z + keyTapR * 0.4,
            0.9 * z,
            2 * z,
            '#f6f7fc',
          );
        }
        rect(crossHandX, uY - 13.2 * z + keyTapL, 3.4 * z, 2 * z, palette.skin);
        rect(leadHandX, uY - 14.3 * z + keyTapR, 3.4 * z, 2 * z, palette.skin);
        if (typeWaveL > 0.55) {
          rect(crossHandX + (dirFlip > 0 ? 1.6 : 0) * z, uY - 11.1 * z + keyTapL, 1.6 * z, 0.9 * z, '#7ef3ff');
        }
        if (typeWaveR > 0.55) {
          rect(leadHandX + (dirFlip > 0 ? 1.6 : 0) * z, uY - 12.2 * z + keyTapR, 1.6 * z, 0.9 * z, '#3be87a');
        }
      }
    } else if (seated) {
      if (isFacingAway) {
        // Seated 3/4 rear (NE / NW conference chair): forearms reach forward toward conference table!
        uRect(4.2, uY - 18.4 * z, 2.6, 3, upperSleeveCol);
        uRect(4.8, uY - 16.2 * z, 4.6, 2.1, foreArmCol);
        uRect(9, uY - 16.2 * z, 2.6, 1.9, palette.skin);
        uRect(-7.4, uY - 18.2 * z, 2.6, 3.6, upperSleeveCol);
        uRect(-6.4, uY - 15.2 * z, 4, 2, foreArmCol);
      } else {
        // Relaxed seated front/3/4 posture (S / SE / SW meeting / lounging / gaming)
        rect(uX - 8.6 * z, uY - 18.6 * z, 2.6 * z, 3.4 * z, upperSleeveCol);
        rect(uX + 6 * z, uY - 18.6 * z, 2.6 * z, 3.4 * z, upperSleeveCol);
        rect(uX - 7.8 * z, uY - 15.2 * z, 4.2 * z, 2 * z, foreArmCol);
        rect(uX + 3.6 * z, uY - 15.2 * z, 4.2 * z, 2 * z, foreArmCol);
        if (emp.activity !== 'gaming') {
          rect(uX - 4 * z, uY - 15 * z, 2.4 * z, 1.8 * z, palette.skin);
          rect(uX + 1.6 * z, uY - 15 * z, 2.4 * z, 1.8 * z, palette.skin);
        }
      }
    } else if (isLaptopPose) {
      // Standing laptop posture: athletic bent upper sleeves + supporting forearm under the aluminum laptop
      dRect(-8.8, baseY - 18.8 * z, 2.8, 4.2, upperSleeveCol);
      dRect(6, baseY - 18.8 * z, 2.8, 4.2, upperSleeveCol);
      if (isVest) {
        dRect(-8.8, baseY - 15.2 * z, 2.8, 1, '#cfd8ee');
        dRect(6, baseY - 15.2 * z, 2.8, 1, '#cfd8ee');
      }
      dRect(4.4, baseY - 14.6 * z, 4, 2.4, foreArmCol);
    } else {
      // Standing / walking athletic sleeves (18*z total span, 1*z waist daylight gap) + side hands
      const armBob = legSwing * 0.3;
      if (isHoodie) {
        rect(cx - 9 * z, baseY - 18.8 * z - armBob, 3 * z, 3.2 * z, uniform.main);
        rect(cx + 6 * z, baseY - 18.8 * z + armBob, 3 * z, 3.2 * z, uniform.main);
        rect(cx - 8 * z, baseY - 15.6 * z - armBob, 2 * z, 2.8 * z, uniform.main);
        rect(cx + 6 * z, baseY - 15.6 * z + armBob, 2 * z, 2.8 * z, uniform.main);
        rect(cx - 8 * z, baseY - 12.8 * z - armBob, 2 * z, 0.9 * z, uniform.dark);
        rect(cx + 6 * z, baseY - 12.8 * z + armBob, 2 * z, 0.9 * z, uniform.dark);
      } else if (isVest) {
        rect(cx - 9 * z, baseY - 18.8 * z - armBob, 3 * z, 3 * z, '#eef2fc');
        rect(cx + 6 * z, baseY - 18.8 * z + armBob, 3 * z, 3 * z, '#eef2fc');
        rect(cx - 9 * z, baseY - 16 * z - armBob, 3 * z, 1.1 * z, '#cfd8ee');
        rect(cx + 6 * z, baseY - 16 * z + armBob, 3 * z, 1.1 * z, '#cfd8ee');
        rect(cx - 8 * z, baseY - 14.9 * z - armBob, 2 * z, 3 * z, palette.skin);
        rect(cx + 6 * z, baseY - 14.9 * z + armBob, 2 * z, 3 * z, palette.skin);
        rect(cx - 8 * z, baseY - 14.9 * z - armBob, 0.8 * z, 3 * z, palette.skinShadow);
        rect(cx + 7.2 * z, baseY - 14.9 * z + armBob, 0.8 * z, 3 * z, palette.skinShadow);
      } else {
        rect(cx - 9 * z, baseY - 18.8 * z - armBob, 3 * z, 3.2 * z, uniform.main);
        rect(cx + 6 * z, baseY - 18.8 * z + armBob, 3 * z, 3.2 * z, uniform.main);
        rect(cx - 8 * z, baseY - 15.6 * z - armBob, 2 * z, 3 * z, uniform.main);
        rect(cx + 6 * z, baseY - 15.6 * z + armBob, 2 * z, 3 * z, uniform.main);
        rect(cx - 8 * z, baseY - 12.6 * z - armBob, 2 * z, 0.8 * z, '#f6f7fc');
        rect(cx + 6 * z, baseY - 12.6 * z + armBob, 2 * z, 0.8 * z, '#f6f7fc');
      }
      rect(cx - 8 * z, baseY - 11.9 * z - armBob, 2 * z, 1.8 * z, palette.skin);
      rect(cx + 6 * z, baseY - 11.9 * z + armBob, 2 * z, 1.8 * z, palette.skin);
    }
  }

  // Activity props & floating coding telemetry
  if (!isWalking) {
    const handSpanX = isSideProfile
      ? dirFlip > 0
        ? 4.2
        : -8.2
      : palette.gender === 'female'
        ? 5.5
        : 6.4;
    if (isCodingPose) {
      // Floating code glyphs near monitor side
      const glyphY = ((timeSec * 10) % 10) * z;
      ctx.font = `bold ${Math.max(7, Math.round(7 * z))}px "JetBrains Mono", monospace`;
      ctx.fillStyle = 'rgba(60, 216, 255, 0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(
        Math.floor(timeSec * 2) % 2 === 0 ? '</>' : '{}',
        uX + dirFlip * 11 * z,
        uY - 38 * z - glyphY,
      );
    } else if (isPresenting) {
      // Standing presenter holding an angled pixel pointer stick toward the Presentation Screen
      const sweep = Math.sin(timeSec * 2.5) * 3 * z;
      ctx.strokeStyle = '#ffd147';
      ctx.lineWidth = Math.max(1.5, 2 * z);
      ctx.beginPath();
      ctx.moveTo(cx - (palette.gender === 'female' ? 6.5 : 8) * z, baseY - 14 * z);
      ctx.lineTo(cx - 22 * z, baseY - 28 * z + sweep);
      ctx.stroke();
      ctx.fillStyle = '#ff5666';
      ctx.fillRect(Math.round(cx - 23 * z), Math.round(baseY - 29 * z + sweep), Math.ceil(3 * z), Math.ceil(3 * z));
    } else if (!isLaptopPose && !isPureBack && (emp.activity === 'reading' || emp.activity === 'searching')) {
      ctx.fillStyle = '#f5ecd7';
      ctx.fillRect(
        Math.round(uX + (dirFlip > 0 ? 3.5 : -9.5) * z),
        Math.round(uY - 15 * z),
        Math.ceil(6 * z),
        Math.ceil(5 * z),
      );
    } else if (emp.activity === 'coffee' || emp.socialReaction === 'coffee_gift') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(uX + handSpanX * z), Math.round(uY - 14 * z), Math.ceil(4 * z), Math.ceil(5 * z));
      const steam = (timeSec * 10) % 6;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(
        Math.round(uX + (handSpanX + 1) * z),
        Math.round(uY - (17 + steam) * z),
        Math.ceil(2 * z),
        Math.ceil(2 * z),
      );
    } else if (emp.activity === 'watercooler') {
      ctx.fillStyle = '#7ef3ff';
      ctx.fillRect(Math.round(uX + handSpanX * z), Math.round(uY - 14 * z), Math.ceil(4 * z), Math.ceil(5 * z));
      ctx.fillStyle = '#3cd8ff';
      ctx.fillRect(Math.round(uX + (handSpanX + 1) * z), Math.round(uY - 15 * z), Math.ceil(2 * z), Math.ceil(2 * z));
    } else if (emp.activity === 'pizza') {
      ctx.fillStyle = '#d98a36';
      ctx.fillRect(Math.round(uX + (handSpanX - 1) * z), Math.round(uY - 16 * z), Math.ceil(6 * z), Math.ceil(2 * z));
      ctx.fillStyle = '#ffd147';
      ctx.fillRect(Math.round(uX + handSpanX * z), Math.round(uY - 14 * z), Math.ceil(4 * z), Math.ceil(3 * z));
      ctx.fillStyle = '#d93838';
      ctx.fillRect(Math.round(uX + (handSpanX + 1) * z), Math.round(uY - 13 * z), Math.ceil(2 * z), Math.ceil(2 * z));
    } else if (emp.activity === 'gaming' && !isPureBack) {
      const thumbJitter = Math.sin(timeSec * 16) > 0 ? 0.5 * z : 0;
      const padX = isSideProfile ? (dirFlip > 0 ? uX + 2.5 * z : uX - 9.5 * z) : uX - 5 * z;
      const padW = isSideProfile ? 7 * z : 10 * z;
      ctx.fillStyle = '#1b1f2b';
      ctx.fillRect(Math.round(padX), Math.round(uY - 14 * z + thumbJitter), Math.ceil(padW), Math.ceil(5 * z));
      ctx.fillStyle = '#3cd8ff';
      ctx.fillRect(Math.round(padX + 1 * z), Math.round(uY - 13 * z + thumbJitter), Math.ceil(2 * z), Math.ceil(2 * z));
      ctx.fillStyle = '#ff5666';
      ctx.fillRect(
        Math.round(padX + padW - 3 * z),
        Math.round(uY - 13 * z + thumbJitter),
        Math.ceil(2 * z),
        Math.ceil(2 * z),
      );
    } else if (emp.activity === 'card_game') {
      // Handheld 3-card pixel fan across all 8 angles (front/side show crisp suit pips, rear shows crimson/gold backs)
      const cardSeed = hashString(emp.id);
      const cardBob = Math.sin(timeSec * 4.5 + (cardSeed & 7)) * 0.6 * z;
      const pickLift = Math.sin(timeSec * 3.2 + (cardSeed & 3)) > 0.55 ? -0.9 * z : 0;
      const drawSingleCard = (
        cxCard: number,
        cyCard: number,
        cw: number,
        ch: number,
        showFace: boolean,
        redSuit: boolean,
      ) => {
        rect(cxCard - 0.5 * z, cyCard - 0.5 * z, cw + 1 * z, ch + 1 * z, '#121826');
        rect(cxCard, cyCard, cw, ch, '#fffdf7');
        if (showFace) {
          rect(
            cxCard + 0.7 * z,
            cyCard + 0.8 * z,
            Math.max(1 * z, cw * 0.36),
            Math.max(1 * z, ch * 0.36),
            redSuit ? '#ff3b5c' : '#182030',
          );
          rect(
            cxCard + cw * 0.45,
            cyCard + ch * 0.52,
            Math.max(0.9 * z, cw * 0.32),
            Math.max(0.9 * z, ch * 0.3),
            redSuit ? '#ff3b5c' : '#182030',
          );
        } else {
          rect(cxCard + 0.5 * z, cyCard + 0.5 * z, Math.max(1 * z, cw - 1 * z), Math.max(1 * z, ch - 1 * z), '#c92a3e');
          rect(cxCard + cw * 0.36, cyCard + ch * 0.36, 0.9 * z, 0.9 * z, '#ffd147');
        }
      };

      if (isPureBack) {
        // Pure North ('N'): cards peek forward past right shoulder/elbow, never clipping through the spine
        drawSingleCard(uX + 5.6 * z, uY - 17.8 * z + cardBob, 2.8 * z, 3.8 * z, false, true);
        drawSingleCard(uX + 7.2 * z, uY - 17.2 * z + cardBob + pickLift, 2.8 * z, 3.8 * z, false, false);
      } else if (isFacingAway) {
        // 3/4 Rear ('NE' / 'NW'): crimson-and-gold card backs held in forward hand toward tabletop
        const baseX = dirFlip > 0 ? uX + 6.4 * z : uX - 12.6 * z;
        const baseYCard = uY - 18.6 * z + cardBob;
        drawSingleCard(baseX, baseYCard + 0.6 * z, 3.0 * z, 4.2 * z, false, true);
        drawSingleCard(baseX + 1.5 * z, baseYCard + pickLift, 3.0 * z, 4.2 * z, false, false);
        drawSingleCard(baseX + 3.0 * z, baseYCard + 0.5 * z, 3.0 * z, 4.2 * z, true, true);
      } else if (isSideProfile) {
        // Side profile ('E' / 'W'): stepped 3-card fan held out at 90°-bent table hand
        const baseX = dirFlip > 0 ? uX + 4.8 * z : uX - 11.4 * z;
        const baseYCard = uY - 17.6 * z + cardBob;
        drawSingleCard(baseX, baseYCard + 0.5 * z, 3.0 * z, 4.2 * z, true, false);
        drawSingleCard(baseX + 1.6 * z, baseYCard + pickLift, 3.0 * z, 4.2 * z, true, true);
        drawSingleCard(baseX + 3.2 * z, baseYCard + 0.6 * z, 3.0 * z, 4.2 * z, true, false);
      } else {
        // Front / 3/4 Front ('S' / 'SE' / 'SW'): clear 3-card ivory fan with red heart/diamond & dark spade pips
        const shiftX = isPureFront ? -3.4 * z : dirFlip > 0 ? 1.2 * z : -8.2 * z;
        const baseX = uX + shiftX;
        const baseYCard = uY - 17.2 * z + cardBob;
        drawSingleCard(baseX, baseYCard + 0.6 * z, 3.1 * z, 4.3 * z, true, true);
        drawSingleCard(baseX + 1.9 * z, baseYCard + pickLift, 3.1 * z, 4.3 * z, true, false);
        drawSingleCard(baseX + 3.8 * z, baseYCard + 0.6 * z, 3.1 * z, 4.3 * z, true, true);
      }
    }
  }

  // 4. Head, Expressive Face & Monitor Glow Reflection (True 8-Angle Anatomy: S, SE/SW, E/W, NE/NW, N)
  const fShift = isPureFront ? 0 : dirFlip * (hasScreenGlow ? 0.9 : 0.75) * z;
  const fEyeLx = uX - 3 * z + fShift;
  const fEyeRx = uX + 1 * z + fShift;
  const mShift = isPureFront ? 0 : dirFlip * (hasScreenGlow ? 0.9 : 0.75) * z;
  const mEyeLx = uX - 3.6 * z + mShift;
  const mEyeRx = uX + 1.6 * z + mShift;
  const codeGlowCyan = Math.sin(timeSec * 5) >= 0;

  if (isPureBack) {
    // Pure North Rear Head (N): 100% symmetric rear skull & nape with ZERO facial features!
    if (palette.gender === 'female') {
      rect(uX - 5 * z, uY - 35 * z, 10 * z, 1.6 * z, palette.skinShadow);
      rect(uX - 5.6 * z, uY - 33.8 * z, 11.2 * z, 9.4 * z, palette.skinShadow);
      rect(uX - 4.2 * z, uY - 24.6 * z, 8.4 * z, 1.6 * z, palette.skinShadow);
      if (!enclosingHelmet) {
        rect(uX - 6.4 * z, uY - 27.2 * z, 0.9 * z, 1 * z, '#fff2cc');
        rect(uX + 5.5 * z, uY - 27.2 * z, 0.9 * z, 1 * z, '#fff2cc');
      }
      if (isCodingPose) {
        rect(uX - 5.6 * z, uY - 33.4 * z, 1.2 * z, 7.6 * z, 'rgba(72, 232, 255, 0.2)');
        rect(uX + 4.4 * z, uY - 33.4 * z, 1.2 * z, 7.6 * z, 'rgba(72, 232, 255, 0.2)');
      }
    } else {
      rect(uX - 5.8 * z, uY - 35.2 * z, 11.6 * z, 1.6 * z, palette.skinShadow);
      rect(uX - 6.4 * z, uY - 33.8 * z, 12.8 * z, 8.2 * z, palette.skinShadow);
      rect(uX - 5.2 * z, uY - 25.8 * z, 10.4 * z, 2.4 * z, palette.skinShadow);
      rect(uX - 3.6 * z, uY - 25.2 * z, 7.2 * z, 2.4 * z, palette.skin);
      if (!enclosingHelmet) {
        rect(uX - 7.6 * z, uY - 29.6 * z, 1.2 * z, 2.4 * z, palette.skin);
        rect(uX + 6.4 * z, uY - 29.6 * z, 1.2 * z, 2.4 * z, palette.skin);
      }
      if (isCodingPose) {
        rect(uX - 6.4 * z, uY - 33.4 * z, 1.2 * z, 7.8 * z, 'rgba(72, 232, 255, 0.2)');
        rect(uX + 5.2 * z, uY - 33.4 * z, 1.2 * z, 7.8 * z, 'rgba(72, 232, 255, 0.2)');
      }
    }
  } else if (isSideProfile) {
    // True 90° Lateral Profile Head (E / W): narrower front-to-back skull + projecting profile nose + single profile eye
    if (palette.gender === 'female') {
      uRect(-4.2, uY - 35 * z, 8.2, 1.6, palette.skinShadow);
      uRect(-4.8, uY - 33.8 * z, 9.4, 9.4, palette.skinShadow);
      uRect(-2.8, uY - 24.4 * z, 7, 1.6, palette.skinShadow);
      uRect(-3.6, uY - 34.6 * z, 8, 1.6, palette.skin);
      uRect(-3.8, uY - 33.4 * z, 8.4, 9, palette.skin);
      uRect(-1.8, uY - 24.4 * z, 5.8, 1.5, palette.skin);
      // Projecting dainty profile nose
      uRect(4.4, uY - 28 * z, 1.3, 1.4, palette.skin);
      uRect(4.4, uY - 26.8 * z, 1.1, 0.7, palette.skinShadow);
      if (hasScreenGlow) {
        uRect(2.2, uY - 32.6 * z, 2.6, 8, 'rgba(72, 232, 255, 0.24)');
      }
      // Single lateral arched brow + single expressive profile eye + winged lash
      uRect(1.6, uY - 31.2 * z, 2.4, 0.9, palette.hair);
      if (emp.activity === 'sleeping') {
        uRect(1.6, uY - 28 * z, 2.4, 0.9, '#141622');
      } else {
        uRect(2, uY - 29.2 * z, 2, 2.9, '#161926');
        uRect(1.6, uY - 29.7 * z, 2.4, 0.9, '#141622');
        uRect(0.8, uY - 30.2 * z, 1, 1, '#141622');
        uRect(3.1, uY - 29.1 * z, 0.9, 0.9, '#ffffff');
        if (hasScreenGlow) {
          uRect(3.1, uY - 27.3 * z, 0.9, 0.8, codeGlowCyan ? '#7ef3ff' : '#6bffb8');
        }
      }
      uRect(1, uY - 26 * z, 2, 1, 'rgba(255, 130, 162, 0.44)');
      uRect(3.2, uY - 24.4 * z, 1.4, 0.9, '#e56b88');
    } else {
      uRect(-4.8, uY - 35.4 * z, 9.4, 1.6, palette.skinShadow);
      uRect(-5.4, uY - 34 * z, 10.6, 8.2, palette.skinShadow);
      uRect(-4, uY - 25.8 * z, 9, 2.4, palette.skinShadow);
      uRect(-1.4, uY - 23.8 * z, 6.2, 1.4, palette.skinShadow);
      uRect(-4.2, uY - 35 * z, 8.8, 1.6, palette.skin);
      uRect(-4.4, uY - 33.8 * z, 9.6, 8, palette.skin);
      uRect(-3, uY - 25.8 * z, 8, 2.2, palette.skin);
      uRect(-0.8, uY - 23.8 * z, 5.4, 1.2, palette.skin);
      // Projecting masculine profile nose bridge
      uRect(5, uY - 28.8 * z, 1.5, 2, palette.skin);
      uRect(5, uY - 26.9 * z, 1.3, 0.8, palette.skinShadow);
      if (hasScreenGlow) {
        uRect(2.8, uY - 33 * z, 2.6, 8.6, 'rgba(72, 232, 255, 0.24)');
      }
      uRect(1.8, uY - 31.3 * z, 2.8, 1.1, palette.hair);
      if (emp.activity === 'sleeping') {
        uRect(2, uY - 28.2 * z, 2.4, 1, '#161926');
      } else {
        uRect(2.4, uY - 29.4 * z, 2, 2.6, '#161926');
        uRect(3.5, uY - 29.3 * z, 0.9, 0.9, '#ffffff');
        if (hasScreenGlow) {
          uRect(3.5, uY - 27.8 * z, 0.9, 0.8, codeGlowCyan ? '#7ef3ff' : '#6bffb8');
        }
      }
      uRect(3.4, uY - 24.8 * z, 1.6, 0.8, palette.skinShadow);
      if (palette.maleFacialHair === 'light_stubble' && !enclosingHelmet) {
        uRect(-1.8, uY - 25.6 * z, 6.8, 1.8, 'rgba(28, 32, 46, 0.22)');
        uRect(3.4, uY - 25.8 * z, 1.6, 0.9, 'rgba(28, 32, 46, 0.22)');
      }
    }
  } else if (isFacingAway) {
    // 3/4 Over-the-Shoulder Rear-Profile Head (NE / NW): back skull + subtle outer rim cheek & focused outer eye
    if (palette.gender === 'female') {
      rect(uX - 5 * z, uY - 35 * z, 10 * z, 1.6 * z, palette.skinShadow);
      rect(uX - 5.6 * z, uY - 33.8 * z, 11.2 * z, 9.6 * z, palette.skinShadow);
      rect(uX - 4.4 * z, uY - 24.4 * z, 8.8 * z, 1.6 * z, palette.skinShadow);
      const profX = dirFlip > 0 ? uX + 1.4 * z : uX - 6 * z;
      rect(profX, uY - 33.6 * z, 4.6 * z, 9.2 * z, palette.skin);
      rect(dirFlip > 0 ? uX + 1 * z : uX - 4.6 * z, uY - 24.4 * z, 3.6 * z, 1.6 * z, palette.skin);
      if (isCodingPose) {
        const rimX = dirFlip > 0 ? uX + 4.2 * z : uX - 6.2 * z;
        rect(rimX, uY - 33.2 * z, 2 * z, 8.4 * z, 'rgba(72, 232, 255, 0.28)');
        rect(
          dirFlip > 0 ? uX + 5.3 * z : uX - 6.2 * z,
          uY - 31.8 * z,
          0.9 * z,
          5.6 * z,
          codeGlowCyan ? 'rgba(126, 243, 255, 0.55)' : 'rgba(98, 245, 168, 0.48)',
        );
      }
      const pEyeX = dirFlip > 0 ? uX + 3.8 * z : uX - 5.4 * z;
      rect(pEyeX, uY - 31.1 * z, 1.6 * z, 0.8 * z, palette.hair);
      if (emp.activity === 'sleeping') {
        rect(pEyeX, uY - 28 * z, 1.6 * z, 0.8 * z, '#141622');
      } else {
        rect(pEyeX, uY - 29.3 * z, 1.6 * z, 2.6 * z, '#161926');
        rect(pEyeX + (dirFlip > 0 ? 0.7 : 0) * z, uY - 29.2 * z, 0.8 * z, 0.8 * z, '#ffffff');
        if (isCodingPose) {
          rect(
            pEyeX + (dirFlip > 0 ? 0.7 : 0) * z,
            uY - 27.5 * z,
            0.8 * z,
            0.8 * z,
            codeGlowCyan ? '#7ef3ff' : '#6bffb8',
          );
        }
      }
    } else {
      rect(uX - 5.8 * z, uY - 35.2 * z, 11.6 * z, 1.6 * z, palette.skinShadow);
      rect(uX - 6.4 * z, uY - 33.8 * z, 12.8 * z, 8.2 * z, palette.skinShadow);
      rect(uX - 5.4 * z, uY - 25.8 * z, 10.8 * z, 2.4 * z, palette.skinShadow);
      const profX = dirFlip > 0 ? uX + 1.6 * z : uX - 6.6 * z;
      rect(profX, uY - 33.8 * z, 5 * z, 8.2 * z, palette.skin);
      rect(dirFlip > 0 ? uX + 1.2 * z : uX - 5.4 * z, uY - 25.8 * z, 4.2 * z, 2.4 * z, palette.skin);
      if (isCodingPose) {
        const rimX = dirFlip > 0 ? uX + 4.6 * z : uX - 6.8 * z;
        rect(rimX, uY - 33.4 * z, 2.2 * z, 8.8 * z, 'rgba(72, 232, 255, 0.28)');
        rect(
          dirFlip > 0 ? uX + 5.9 * z : uX - 6.8 * z,
          uY - 32 * z,
          0.9 * z,
          6 * z,
          codeGlowCyan ? 'rgba(126, 243, 255, 0.56)' : 'rgba(98, 245, 168, 0.48)',
        );
      }
      const pEyeX = dirFlip > 0 ? uX + 4.3 * z : uX - 5.9 * z;
      rect(pEyeX - 0.1 * z, uY - 31.2 * z, 1.9 * z, 1 * z, palette.hair);
      if (emp.activity === 'sleeping') {
        rect(pEyeX, uY - 28.2 * z, 1.6 * z, 0.9 * z, '#161926');
      } else {
        rect(pEyeX, uY - 29.4 * z, 1.6 * z, 2.4 * z, '#161926');
        rect(pEyeX + (dirFlip > 0 ? 0.8 : 0) * z, uY - 29.3 * z, 0.8 * z, 0.8 * z, '#ffffff');
        if (isCodingPose) {
          rect(
            pEyeX + (dirFlip > 0 ? 0.8 : 0) * z,
            uY - 27.8 * z,
            0.8 * z,
            0.8 * z,
            codeGlowCyan ? '#7ef3ff' : '#6bffb8',
          );
        }
      }
      if (palette.maleFacialHair === 'light_stubble' && !enclosingHelmet) {
        rect(dirFlip > 0 ? uX + 2.6 * z : uX - 5.8 * z, uY - 25.4 * z, 3.2 * z, 1.6 * z, 'rgba(28, 32, 46, 0.22)');
      }
    }
  } else if (palette.gender === 'female') {
    // Tapered oval chibi head (S symmetric front vs SE/SW 3/4 front)
    rect(uX - 5 * z, uY - 35 * z, 10 * z, 1.5 * z, palette.skinShadow);
    rect(uX - 6 * z, uY - 34 * z, 12 * z, 10 * z, palette.skinShadow);
    rect(uX - 5 * z, uY - 24.2 * z, 10 * z, 1.4 * z, palette.skinShadow);
    rect(uX - 3.4 * z, uY - 23 * z, 6.8 * z, 1.2 * z, palette.skinShadow);

    rect(uX - 5 * z, uY - 34.8 * z, 10 * z, 1.8 * z, palette.skin);
    rect(uX - 5.6 * z, uY - 33.8 * z, 11.2 * z, 9.6 * z, palette.skin);
    rect(uX - 4.6 * z, uY - 24.4 * z, 9.2 * z, 1.4 * z, palette.skin);
    rect(uX - 3 * z, uY - 23.1 * z, 6 * z, 1.1 * z, palette.skin);

    if (hasScreenGlow) {
      const glowFaceX = isPureFront ? uX - 4.2 * z : dirFlip > 0 ? uX + 0.4 * z : uX - 5.4 * z;
      const glowFaceW = isPureFront ? 8.4 * z : 5 * z;
      rect(glowFaceX, uY - 32.4 * z, glowFaceW, 7.6 * z, 'rgba(72, 232, 255, 0.22)');
      if (!isPureFront) {
        rect(
          dirFlip > 0 ? uX + 3.2 * z : uX - 5.4 * z,
          uY - 31.2 * z,
          2.2 * z,
          5.4 * z,
          codeGlowCyan ? 'rgba(126, 243, 255, 0.28)' : 'rgba(98, 245, 168, 0.24)',
        );
      }
    }

    if (!enclosingHelmet) {
      rect(uX - 6.6 * z, uY - 26.8 * z, 1 * z, 1 * z, '#fff2cc');
      rect(uX + 5.6 * z, uY - 26.8 * z, 1 * z, 1 * z, '#fff2cc');
    }

    rect(fEyeLx, uY - 31.2 * z, 2 * z, 0.9 * z, palette.hair);
    rect(fEyeRx, uY - 31.2 * z, 2 * z, 0.9 * z, palette.hair);

    if (emp.activity === 'sleeping') {
      rect(fEyeLx - 0.5 * z, uY - 27.8 * z, 2.5 * z, 0.9 * z, '#141622');
      rect(fEyeRx, uY - 27.8 * z, 2.5 * z, 0.9 * z, '#141622');
    } else {
      rect(fEyeLx, uY - 29.2 * z, 2 * z, 3 * z, '#161926');
      rect(fEyeRx, uY - 29.2 * z, 2 * z, 3 * z, '#161926');
      rect(fEyeLx, uY - 29.6 * z, 2 * z, 0.9 * z, '#141622');
      rect(fEyeRx, uY - 29.6 * z, 2 * z, 0.9 * z, '#141622');
      rect(fEyeLx - 1 * z, uY - 30.2 * z, 1 * z, 1 * z, '#141622');
      rect(fEyeRx + 2 * z, uY - 30.2 * z, 1 * z, 1 * z, '#141622');
      const catchOffset = isPureFront ? 0.6 * z : dirFlip > 0 ? 1 * z : 0;
      rect(fEyeLx + catchOffset, uY - 29.1 * z, 0.9 * z, 0.9 * z, '#ffffff');
      rect(fEyeRx + catchOffset, uY - 29.1 * z, 0.9 * z, 0.9 * z, '#ffffff');
      if (hasScreenGlow) {
        const glintCol = codeGlowCyan ? '#7ef3ff' : '#6bffb8';
        rect(fEyeLx + catchOffset, uY - 27.2 * z, 0.9 * z, 0.8 * z, glintCol);
        rect(fEyeRx + catchOffset, uY - 27.2 * z, 0.9 * z, 0.8 * z, glintCol);
      }
    }
    rect(fEyeLx - 1.2 * z, uY - 25.8 * z, 2 * z, 1 * z, 'rgba(255, 130, 162, 0.45)');
    rect(fEyeRx + 1.2 * z, uY - 25.8 * z, 2 * z, 1 * z, 'rgba(255, 130, 162, 0.45)');
    rect(uX - 1 * z + fShift, uY - 24.3 * z, 2 * z, 0.9 * z, '#e56b88');
  } else {
    // Structured masculine chibi head (S symmetric front vs SE/SW 3/4 front)
    rect(uX - 6 * z, uY - 35.4 * z, 12 * z, 1.6 * z, palette.skinShadow);
    rect(uX - 7 * z, uY - 34 * z, 14 * z, 8 * z, palette.skinShadow);
    rect(uX - 6 * z, uY - 26 * z, 12 * z, 2.2 * z, palette.skinShadow);
    rect(uX - 4 * z, uY - 23.8 * z, 8 * z, 1.6 * z, palette.skinShadow);

    rect(uX - 5 * z, uY - 35 * z, 10 * z, 1.6 * z, palette.skin);
    rect(uX - 6 * z, uY - 33.8 * z, 12 * z, 7.8 * z, palette.skin);
    rect(uX - 5 * z, uY - 26.2 * z, 10 * z, 2.4 * z, palette.skin);
    rect(uX - 3 * z, uY - 23.9 * z, 6 * z, 1.5 * z, palette.skin);

    if (hasScreenGlow) {
      const glowFaceX = isPureFront ? uX - 4.8 * z : dirFlip > 0 ? uX + 0.4 * z : uX - 6 * z;
      const glowFaceW = isPureFront ? 9.6 * z : 5.6 * z;
      rect(glowFaceX, uY - 32.8 * z, glowFaceW, 8.2 * z, 'rgba(72, 232, 255, 0.22)');
      if (!isPureFront) {
        rect(
          dirFlip > 0 ? uX + 3.6 * z : uX - 6 * z,
          uY - 31.6 * z,
          2.4 * z,
          5.8 * z,
          codeGlowCyan ? 'rgba(126, 243, 255, 0.28)' : 'rgba(98, 245, 168, 0.24)',
        );
      }
    }

    if (!enclosingHelmet) {
      rect(uX - 8 * z, uY - 29.6 * z, 1 * z, 2.4 * z, palette.skinShadow);
      rect(uX + 7 * z, uY - 29.6 * z, 1 * z, 2.4 * z, palette.skinShadow);
    }
    rect(uX - 5.6 * z, uY - 27 * z, 1 * z, 1.6 * z, palette.skinShadow);
    rect(uX + 4.6 * z, uY - 27 * z, 1 * z, 1.6 * z, palette.skinShadow);

    rect(mEyeLx - 0.4 * z, uY - 31.2 * z, 2.8 * z, 1.1 * z, palette.hair);
    rect(mEyeRx - 0.4 * z, uY - 31.2 * z, 2.8 * z, 1.1 * z, palette.hair);

    if (emp.activity === 'sleeping') {
      rect(mEyeLx - 0.3 * z, uY - 28 * z, 2.6 * z, 1 * z, '#161926');
      rect(mEyeRx - 0.3 * z, uY - 28 * z, 2.6 * z, 1 * z, '#161926');
    } else {
      rect(mEyeLx, uY - 29.4 * z, 2 * z, 2.6 * z, '#161926');
      rect(mEyeRx, uY - 29.4 * z, 2 * z, 2.6 * z, '#161926');
      const catchOffset = isPureFront ? 0.6 * z : dirFlip > 0 ? 1 * z : 0;
      rect(mEyeLx + catchOffset, uY - 29.3 * z, 0.9 * z, 0.9 * z, '#ffffff');
      rect(mEyeRx + catchOffset, uY - 29.3 * z, 0.9 * z, 0.9 * z, '#ffffff');
      if (hasScreenGlow) {
        const glintCol = codeGlowCyan ? '#7ef3ff' : '#6bffb8';
        rect(mEyeLx + catchOffset, uY - 27.7 * z, 0.9 * z, 0.8 * z, glintCol);
        rect(mEyeRx + catchOffset, uY - 27.7 * z, 0.9 * z, 0.8 * z, glintCol);
      }
    }

    rect(uX - 0.5 * z + mShift, uY - 26.8 * z, 1 * z, 1 * z, palette.skinShadow);
    rect(uX - 1.1 * z + mShift, uY - 24.6 * z, 2.2 * z, 0.8 * z, palette.skinShadow);

    if (palette.maleFacialHair === 'light_stubble' && !enclosingHelmet) {
      rect(uX - 1.8 * z + mShift, uY - 25.5 * z, 3.6 * z, 0.9 * z, 'rgba(28, 32, 46, 0.22)');
      rect(uX - 5 * z, uY - 25.8 * z, 1.6 * z, 2 * z, 'rgba(28, 32, 46, 0.22)');
      rect(uX + 3.4 * z, uY - 25.8 * z, 1.6 * z, 2 * z, 'rgba(28, 32, 46, 0.22)');
      rect(uX - 3.6 * z, uY - 23.9 * z, 7.2 * z, 1.3 * z, 'rgba(28, 32, 46, 0.22)');
    }
  }

  // 5. Hair Across All 8 Angles (Pure Back N, Lateral Side E/W, 3/4 Rear NE/NW, Front S/SE/SW)
  if (!enclosingHelmet) {
    if (isPureBack) {
      if (palette.gender === 'female') {
        rect(uX - 4.2 * z, uY - 38 * z, 8.4 * z, 1.5 * z, palette.hair);
        rect(uX - 5.6 * z, uY - 37 * z, 11.2 * z, 2 * z, palette.hair);
        rect(uX - 6.4 * z, uY - 35.5 * z, 12.8 * z, 11.4 * z, palette.hair);
        rect(uX - 3.2 * z, uY - 36.4 * z, 6.4 * z, 1.3 * z, palette.hairHighlight);

        if (palette.femaleHairStyle === 'long_locks') {
          rect(uX - 6 * z, uY - 24.4 * z, 12 * z, 6 * z, palette.hair);
          rect(uX - 5 * z, uY - 18.6 * z, 10 * z, 3.6 * z, palette.hair);
          rect(uX - 3.6 * z, uY - 23.6 * z, 1.5 * z, 6.8 * z, palette.hairHighlight);
          rect(uX + 2.1 * z, uY - 23.6 * z, 1.5 * z, 6.8 * z, palette.hairHighlight);
        } else if (palette.femaleHairStyle === 'bob_cut') {
          rect(uX - 6.6 * z, uY - 31.2 * z, 13.2 * z, 8.6 * z, palette.hair);
          rect(uX - 5.2 * z, uY - 22.8 * z, 10.4 * z, 1.2 * z, palette.hair);
          rect(uX - 3.8 * z, uY - 30.6 * z, 1.4 * z, 5.8 * z, palette.hairHighlight);
          rect(uX - 2 * z, uY - 32.2 * z, 4 * z, 1 * z, palette.accessoryColor);
        } else if (palette.femaleHairStyle === 'ponytail' && !isLeiaCostume) {
          const ponySway = Math.sin(timeSec * 2.5) * 0.5 * z;
          rect(uX - 1.8 * z, uY - 33.4 * z, 3.6 * z, 2.2 * z, palette.accessoryColor);
          rect(uX - 2.2 * z + ponySway * 0.5, uY - 31.2 * z, 4.4 * z, 6.4 * z, palette.hair);
          rect(uX - 1.5 * z + ponySway, uY - 24.8 * z, 3 * z, 5 * z, palette.hair);
          rect(uX - 0.6 * z + ponySway * 0.5, uY - 30.4 * z, 1.2 * z, 5.2 * z, palette.hairHighlight);
        } else if (palette.femaleHairStyle === 'bun_updo' && !hideTopChignon) {
          rect(uX - 3.2 * z, uY - 40.2 * z, 6.4 * z, 2.2 * z, palette.hair);
          rect(uX - 2.2 * z, uY - 41.4 * z, 4.4 * z, 1.5 * z, palette.hair);
          rect(uX - 1.2 * z, uY - 40.6 * z, 2.4 * z, 1 * z, palette.hairHighlight);
          rect(uX - 3.4 * z, uY - 38.2 * z, 6.8 * z, 1.2 * z, palette.accessoryColor);
        }
      } else {
        // Male pure North rear hair cap + clean barbershop nape fade
        rect(uX - 6.2 * z, uY - 34.4 * z, 12.4 * z, 6.6 * z, palette.hair);
        rect(uX - 5.2 * z, uY - 28 * z, 10.4 * z, 2.8 * z, palette.hair);
        rect(uX - 4.2 * z, uY - 25.2 * z, 8.4 * z, 1 * z, 'rgba(20, 24, 36, 0.32)');
        if (hideTopChignon) {
          rect(uX - 6.2 * z, uY - 35.8 * z, 12.4 * z, 2.2 * z, palette.hair);
        } else if (palette.maleHairStyle === 'spiky') {
          rect(uX - 6.6 * z, uY - 36.4 * z, 13.2 * z, 2.8 * z, palette.hair);
          rect(uX - 4.6 * z, uY - 39.8 * z, 2.8 * z, 3.4 * z, palette.hair);
          rect(uX - 1.4 * z, uY - 40.8 * z, 2.8 * z, 4.4 * z, palette.hair);
          rect(uX + 1.8 * z, uY - 39.6 * z, 2.8 * z, 3.2 * z, palette.hair);
          rect(uX - 0.6 * z, uY - 40 * z, 1.2 * z, 2.2 * z, palette.hairHighlight);
        } else if (palette.maleHairStyle === 'curly_top') {
          rect(uX - 7.2 * z, uY - 37 * z, 14.4 * z, 3.2 * z, palette.hair);
          rect(uX - 6 * z, uY - 39 * z, 12 * z, 2.4 * z, palette.hair);
          rect(uX - 4 * z, uY - 40.2 * z, 8 * z, 1.6 * z, palette.hair);
          rect(uX - 1.4 * z, uY - 39.2 * z, 2.8 * z, 1.2 * z, palette.hairHighlight);
        } else if (palette.maleHairStyle === 'side_part') {
          rect(uX - 6.4 * z, uY - 36.2 * z, 12.8 * z, 2.4 * z, palette.hair);
          rect(uX - 5.2 * z, uY - 38 * z, 10.4 * z, 2 * z, palette.hair);
          rect(uX - 2.2 * z, uY - 38 * z, 4.4 * z, 1.1 * z, palette.hairHighlight);
        } else {
          rect(uX - 6.2 * z, uY - 35.6 * z, 12.4 * z, 2 * z, palette.hair);
          rect(uX - 5.2 * z, uY - 37.2 * z, 10.4 * z, 1.8 * z, palette.hair);
          rect(uX - 3.8 * z, uY - 38.4 * z, 7.6 * z, 1.4 * z, palette.hair);
          rect(uX - 1.2 * z, uY - 37.6 * z, 2.4 * z, 1 * z, palette.hairHighlight);
        }
      }
    } else if (isSideProfile) {
      if (palette.gender === 'female') {
        // Lateral feminine crown + swept side bangs + back-of-skull hair + visible ear & stud
        uRect(-4.2, uY - 38 * z, 7.6, 1.5, palette.hair);
        uRect(-5.2, uY - 37 * z, 9.6, 2, palette.hair);
        uRect(-5.6, uY - 35.5 * z, 10.4, 2.4, palette.hair);
        uRect(-5.8, uY - 33.5 * z, 5.2, 10.2, palette.hair);
        uRect(1.2, uY - 33.6 * z, 3.8, 1.8, palette.hair);
        uRect(3, uY - 32.2 * z, 1.8, 1.1, palette.hair);
        uRect(-2.4, uY - 36.6 * z, 4.2, 1.2, palette.hairHighlight);
        // Lateral ear + gleaming stud
        uRect(-1, uY - 29 * z, 1.6, 2.4, palette.skin);
        uRect(-0.8, uY - 27 * z, 1, 1, '#fff2cc');

        if (palette.femaleHairStyle === 'long_locks') {
          uRect(-6.4, uY - 23.6 * z, 5.6, 6.4, palette.hair);
          uRect(-6.8, uY - 17.6 * z, 4.8, 3.2, palette.hair);
          uRect(-4.6, uY - 22.8 * z, 1.4, 6.2, palette.hairHighlight);
        } else if (palette.femaleHairStyle === 'bob_cut') {
          uRect(-5.8, uY - 31.5 * z, 5.4, 8.6, palette.hair);
          uRect(-2.2, uY - 25.4 * z, 3.2, 2.8, palette.hair);
          uRect(-4.2, uY - 30.8 * z, 1.2, 5.4, palette.hairHighlight);
          uRect(0.2, uY - 32.8 * z, 2.2, 1, palette.accessoryColor);
        } else if (palette.femaleHairStyle === 'ponytail' && !isLeiaCostume) {
          const ponySway = Math.sin(timeSec * 2.5) * 0.5 * z;
          uRect(-6.4, uY - 33.8 * z, 2.2, 2.4, palette.accessoryColor);
          uRect(-9.2, uY - 34.4 * z, 3.2, 3.2, palette.hair);
          uRect(-10, uY - 31.6 * z + ponySway * 0.5, 3, 5.6, palette.hair);
          uRect(-9.4, uY - 26.2 * z + ponySway, 2.2, 4.2, palette.hair);
          uRect(-8.8, uY - 33.6 * z, 1.4, 4.6, palette.hairHighlight);
        } else if (palette.femaleHairStyle === 'bun_updo' && !hideTopChignon) {
          uRect(-6.8, uY - 39.2 * z, 4.8, 3.6, palette.hair);
          uRect(-7.6, uY - 38.2 * z, 1.6, 2.2, palette.hair);
          uRect(-4.8, uY - 38.8 * z, 1.4, 3.2, palette.accessoryColor);
          uRect(0.8, uY - 32 * z, 1, 4, palette.hair);
        }
      } else {
        // Lateral masculine fade + sideburn + ear + profile crest
        uRect(-5.8, uY - 34.2 * z, 5.2, 6.8, palette.hair);
        uRect(-5.4, uY - 27.6 * z, 4.2, 2.8, palette.hair);
        uRect(0.1, uY - 32.4 * z, 1.1, 3.2, palette.hair);
        uRect(-1.4, uY - 29.6 * z, 1.6, 2.6, palette.skin);
        uRect(-1, uY - 29.1 * z, 0.8, 1.6, palette.skinShadow);

        if (hideTopChignon) {
          uRect(-5.4, uY - 35.8 * z, 10.4, 2.2, palette.hair);
        } else if (palette.maleHairStyle === 'side_part') {
          uRect(-5.4, uY - 36.2 * z, 10.6, 2.6, palette.hair);
          uRect(-4.2, uY - 38 * z, 9.6, 2, palette.hair);
          uRect(0.4, uY - 39.2 * z, 5.4, 1.6, palette.hair);
          uRect(3.2, uY - 34 * z, 2.6, 1.4, palette.hair);
          uRect(0.8, uY - 38.4 * z, 3.8, 1.2, palette.hairHighlight);
        } else if (palette.maleHairStyle === 'spiky') {
          uRect(-5.6, uY - 36.4 * z, 11, 2.8, palette.hair);
          uRect(-6.6, uY - 39 * z, 2.6, 2.8, palette.hair);
          uRect(-3.4, uY - 40.4 * z, 2.8, 4, palette.hair);
          uRect(0.2, uY - 41 * z, 3, 4.6, palette.hair);
          uRect(3.4, uY - 39.4 * z, 2.6, 3.2, palette.hair);
          uRect(0.8, uY - 40.2 * z, 1.4, 2.4, palette.hairHighlight);
        } else if (palette.maleHairStyle === 'curly_top') {
          uRect(-6.2, uY - 37 * z, 12, 3.2, palette.hair);
          uRect(-5, uY - 39 * z, 10.4, 2.4, palette.hair);
          uRect(-3, uY - 40.2 * z, 7.4, 1.6, palette.hair);
          uRect(3.4, uY - 34.2 * z, 2.4, 1.5, palette.hair);
          uRect(-0.8, uY - 39.2 * z, 2.6, 1.2, palette.hairHighlight);
        } else {
          uRect(-5.4, uY - 35.6 * z, 10.4, 2.2, palette.hair);
          uRect(-4.6, uY - 37.2 * z, 9.2, 2, palette.hair);
          uRect(-3.2, uY - 38.4 * z, 6.8, 1.4, palette.hair);
          uRect(3.4, uY - 33.8 * z, 1.6, 1, palette.hair);
          uRect(-0.6, uY - 37.6 * z, 2.2, 1, palette.hairHighlight);
        }
      }
    } else if (isFacingAway) {
      if (palette.gender === 'female') {
        rect(uX - 4 * z, uY - 38 * z, 8 * z, 1.5 * z, palette.hair);
        rect(uX - 5.5 * z, uY - 37 * z, 11 * z, 2 * z, palette.hair);
        rect(uX - 6.2 * z, uY - 35.5 * z, 12.4 * z, 2.6 * z, palette.hair);
        const backHairX = dirFlip > 0 ? uX - 6.2 * z : uX - 2.4 * z;
        rect(backHairX, uY - 33.4 * z, 8.6 * z, 10.6 * z, palette.hair);
        rect(backHairX + 1.8 * z, uY - 35.8 * z, 3.6 * z, 1.4 * z, palette.hairHighlight);
        const earX = dirFlip > 0 ? uX + 1.8 * z : uX - 3.2 * z;
        rect(earX, uY - 29 * z, 1.4 * z, 2.2 * z, palette.skin);
        rect(earX + 0.2 * z, uY - 27 * z, 1 * z, 1 * z, '#fff2cc');

        if (palette.femaleHairStyle === 'long_locks') {
          rect(uX - 5.4 * z, uY - 24 * z, 9.2 * z * (dirFlip > 0 ? 0.85 : 1), 5.5 * z, palette.hair);
          const waveX = dirFlip > 0 ? uX - 6.4 * z : uX - 2 * z;
          rect(waveX, uY - 23.5 * z, 7.8 * z, 6.2 * z, palette.hair);
          rect(waveX + 0.8 * z, uY - 17.5 * z, 6 * z, 2.4 * z, palette.hair);
          rect(waveX + 1.8 * z, uY - 22.5 * z, 1.4 * z, 4.8 * z, palette.hairHighlight);
          rect(waveX + 4.4 * z, uY - 21.5 * z, 1.4 * z, 4.2 * z, palette.hairHighlight);
        } else if (palette.femaleHairStyle === 'bob_cut') {
          const bobX = dirFlip > 0 ? uX - 6.6 * z : uX - 2.6 * z;
          rect(bobX, uY - 31 * z, 9.2 * z, 8.8 * z, palette.hair);
          rect(bobX + 1.2 * z, uY - 30.5 * z, 1.2 * z, 5.5 * z, palette.hairHighlight);
          rect(dirFlip > 0 ? uX + 0.4 * z : uX - 2.4 * z, uY - 32.8 * z, 2 * z, 1 * z, palette.accessoryColor);
        } else if (palette.femaleHairStyle === 'ponytail' && !isLeiaCostume) {
          const ponySway = Math.sin(timeSec * 2.5) * 0.5 * z;
          const scX = dirFlip > 0 ? uX - 4.2 * z : uX + 2 * z;
          rect(scX, uY - 33.2 * z, 2.4 * z, 2.2 * z, palette.accessoryColor);
          rect(scX - 0.4 * z + ponySway * 0.5, uY - 31.2 * z, 3.2 * z, 6.2 * z, palette.hair);
          rect(scX + 0.2 * z + ponySway, uY - 25.2 * z, 2.2 * z, 4.8 * z, palette.hair);
          rect(scX + 0.4 * z + ponySway * 0.5, uY - 30.4 * z, 1.2 * z, 4 * z, palette.hairHighlight);
        } else if (palette.femaleHairStyle === 'bun_updo' && !hideTopChignon) {
          rect(uX - 3 * z, uY - 40 * z, 6 * z, 2 * z, palette.hair);
          rect(uX - 2 * z, uY - 41.2 * z, 4 * z, 1.5 * z, palette.hair);
          rect(uX - 3.2 * z, uY - 38.2 * z, 6.4 * z, 1.2 * z, palette.accessoryColor);
        }
      } else {
        const backHairX = dirFlip > 0 ? uX - 6.8 * z : uX - 2.4 * z;
        rect(backHairX, uY - 34 * z, 9.2 * z, 6.8 * z, palette.hair);
        rect(backHairX + 0.6 * z, uY - 27.4 * z, 7.6 * z, 3.2 * z, palette.hair);
        const earX = dirFlip > 0 ? uX + 2 * z : uX - 3.4 * z;
        rect(earX, uY - 29.6 * z, 1.4 * z, 2.4 * z, palette.skin);
        rect(earX + (dirFlip > 0 ? 0 : 0.6) * z, uY - 29.2 * z, 0.7 * z, 1.6 * z, palette.skinShadow);

        if (hideTopChignon) {
          rect(uX - 6.2 * z, uY - 35.8 * z, 12.4 * z, 2.4 * z, palette.hair);
        } else if (palette.maleHairStyle === 'spiky') {
          rect(uX - 6.6 * z, uY - 36.4 * z, 13.2 * z, 2.8 * z, palette.hair);
          rect(uX - 4.4 * z, uY - 39.8 * z, 2.8 * z, 3.4 * z, palette.hair);
          rect(uX - 1.2 * z, uY - 40.8 * z, 3 * z, 4.4 * z, palette.hair);
          rect(uX + 2.4 * z, uY - 39.4 * z, 2.6 * z, 3 * z, palette.hair);
          rect(uX - 0.4 * z, uY - 40 * z, 1.4 * z, 2.2 * z, palette.hairHighlight);
        } else if (palette.maleHairStyle === 'curly_top') {
          rect(uX - 7.2 * z, uY - 37 * z, 14.4 * z, 3.2 * z, palette.hair);
          rect(uX - 6 * z, uY - 39 * z, 12 * z, 2.4 * z, palette.hair);
          rect(uX - 4 * z, uY - 40.2 * z, 8 * z, 1.6 * z, palette.hair);
          rect(uX - 1.4 * z, uY - 39.2 * z, 2.6 * z, 1.2 * z, palette.hairHighlight);
        } else if (palette.maleHairStyle === 'side_part') {
          rect(uX - 6.4 * z, uY - 36.2 * z, 12.8 * z, 2.6 * z, palette.hair);
          rect(uX - 5.2 * z, uY - 38 * z, 10.8 * z, 2 * z, palette.hair);
          rect(uX - 1.2 * z, uY - 38.2 * z, 4.6 * z, 1.2 * z, palette.hairHighlight);
        } else {
          rect(uX - 6.2 * z, uY - 35.6 * z, 12.4 * z, 2.2 * z, palette.hair);
          rect(uX - 5.4 * z, uY - 37.2 * z, 10.8 * z, 2 * z, palette.hair);
          rect(uX - 4 * z, uY - 38.4 * z, 8 * z, 1.4 * z, palette.hair);
          rect(uX - 1 * z, uY - 37.6 * z, 2.4 * z, 1 * z, palette.hairHighlight);
        }
      }
    } else if (palette.gender === 'female') {
      rect(uX - 4 * z, uY - 38 * z, 8 * z, 1.5 * z, palette.hair);
      rect(uX - 5.5 * z, uY - 37 * z, 11 * z, 2 * z, palette.hair);
      rect(uX - 6.4 * z, uY - 35.5 * z, 12.8 * z, 2.4 * z, palette.hair);
      rect(uX - 3.2 * z, uY - 36.8 * z, 4 * z, 1.2 * z, palette.hairHighlight);
      rect(uX + 1.5 * z, uY - 36.2 * z, 2 * z, 1 * z, palette.hairHighlight);

      if (palette.femaleHairStyle === 'long_locks') {
        rect(uX - 5.5 * z, uY - 33.5 * z, 5 * z, 1.8 * z, palette.hair);
        rect(uX - 2.8 * z, uY - 32.6 * z, 2.8 * z, 1.1 * z, palette.hair);
        rect(uX + 2 * z, uY - 33.5 * z, 3.6 * z, 1.6 * z, palette.hair);
        rect(uX - 6.6 * z, uY - 33.5 * z, 1.3 * z, 6.2 * z, palette.hair);
        rect(uX + 5.3 * z, uY - 33.5 * z, 1.3 * z, 6.2 * z, palette.hair);
      } else if (palette.femaleHairStyle === 'bob_cut') {
        rect(uX - 5.5 * z, uY - 33.5 * z, 5.2 * z, 1.8 * z, palette.hair);
        rect(uX - 2 * z, uY - 32.6 * z, 2.4 * z, 1 * z, palette.hair);
        rect(uX + 2.2 * z, uY - 33.5 * z, 3.4 * z, 1.6 * z, palette.hair);
        rect(uX - 6.8 * z, uY - 33.5 * z, 1.6 * z, 8.8 * z, palette.hair);
        rect(uX - 6 * z, uY - 24.8 * z, 1.8 * z, 2 * z, palette.hair);
        rect(uX - 4.8 * z, uY - 23 * z, 1.8 * z, 1.4 * z, palette.hair);
        rect(uX + 5.2 * z, uY - 33.5 * z, 1.6 * z, 8.8 * z, palette.hair);
        rect(uX + 4.2 * z, uY - 24.8 * z, 1.8 * z, 2 * z, palette.hair);
        rect(uX + 3 * z, uY - 23 * z, 1.8 * z, 1.4 * z, palette.hair);
        rect(uX - 6.4 * z, uY - 31.5 * z, 1 * z, 5 * z, palette.hairHighlight);
        rect(uX + 3.2 * z, uY - 33.2 * z, 2 * z, 1 * z, palette.accessoryColor);
      } else if (palette.femaleHairStyle === 'ponytail') {
        rect(uX - 5.2 * z, uY - 33.5 * z, 4.4 * z, 1.7 * z, palette.hair);
        rect(uX + 1.8 * z, uY - 33.5 * z, 3.6 * z, 1.6 * z, palette.hair);
        rect(uX - 6.4 * z, uY - 33.2 * z, 1.1 * z, 5 * z, palette.hair);
        rect(uX - 5.8 * z, uY - 28.5 * z, 1 * z, 1.6 * z, palette.hair);
        rect(uX + 5.3 * z, uY - 33.2 * z, 1.1 * z, 5 * z, palette.hair);
        rect(uX + 4.8 * z, uY - 28.5 * z, 1 * z, 1.6 * z, palette.hair);
      } else if (palette.femaleHairStyle === 'bun_updo') {
        rect(uX - 5.4 * z, uY - 33.5 * z, 3.8 * z, 1.6 * z, palette.hair);
        rect(uX + 1.6 * z, uY - 33.5 * z, 3.8 * z, 1.6 * z, palette.hair);
        rect(uX - 6.4 * z, uY - 33.2 * z, 1 * z, 4.8 * z, palette.hair);
        rect(uX - 5.8 * z, uY - 28.6 * z, 1 * z, 1.5 * z, palette.hair);
        rect(uX + 5.4 * z, uY - 33.2 * z, 1 * z, 4.8 * z, palette.hair);
        rect(uX + 4.8 * z, uY - 28.6 * z, 1 * z, 1.5 * z, palette.hair);
      }
    } else if (hideTopChignon) {
      rect(uX - 6.8 * z, uY - 34 * z, 1.2 * z, 3.8 * z, palette.hair);
      rect(uX + 5.6 * z, uY - 34 * z, 1.2 * z, 3.8 * z, palette.hair);
      rect(uX - 6.2 * z, uY - 35.8 * z, 12.4 * z, 2.4 * z, palette.hair);
      rect(uX - 4.6 * z, uY - 33.8 * z, 9.2 * z, 1.2 * z, palette.hair);
    } else if (palette.maleHairStyle === 'side_part') {
      rect(uX - 7 * z, uY - 34 * z, 1.2 * z, 4.2 * z, palette.hair);
      rect(uX + 5.8 * z, uY - 34 * z, 1.2 * z, 4.2 * z, palette.hair);
      rect(uX - 6.6 * z, uY - 36.2 * z, 13.2 * z, 2.6 * z, palette.hair);
      rect(uX - 5.4 * z, uY - 38 * z, 11.4 * z, 2 * z, palette.hair);
      rect(uX - 2 * z, uY - 39.2 * z, 7.2 * z, 1.5 * z, palette.hair);
      rect(uX - 6 * z, uY - 34 * z, 2 * z, 1.2 * z, palette.hair);
      rect(uX - 2.6 * z, uY - 34 * z, 7.2 * z, 1.6 * z, palette.hair);
      rect(uX + 1.2 * z, uY - 32.6 * z, 3.2 * z, 1 * z, palette.hair);
      rect(uX - 1.2 * z, uY - 38.4 * z, 4.8 * z, 1.2 * z, palette.hairHighlight);
      rect(uX + 1.6 * z, uY - 36.4 * z, 3.4 * z, 1.1 * z, palette.hairHighlight);
    } else if (palette.maleHairStyle === 'spiky') {
      rect(uX - 7 * z, uY - 34 * z, 1.2 * z, 4.4 * z, palette.hair);
      rect(uX + 5.8 * z, uY - 34 * z, 1.2 * z, 4.4 * z, palette.hair);
      rect(uX - 6.6 * z, uY - 36.4 * z, 13.2 * z, 2.8 * z, palette.hair);
      rect(uX - 4.8 * z, uY - 33.8 * z, 1.8 * z, 1.2 * z, palette.hair);
      rect(uX - 0.8 * z, uY - 33.8 * z, 1.8 * z, 1.3 * z, palette.hair);
      rect(uX + 3 * z, uY - 33.8 * z, 1.8 * z, 1.2 * z, palette.hair);
      rect(uX - 7.4 * z, uY - 38.2 * z, 2.4 * z, 2.2 * z, palette.hair);
      rect(uX - 7.8 * z, uY - 39.4 * z, 1.6 * z, 1.4 * z, palette.hair);
      rect(uX - 4.4 * z, uY - 39.6 * z, 2.8 * z, 3.2 * z, palette.hair);
      rect(uX - 4.8 * z, uY - 41 * z, 1.6 * z, 1.5 * z, palette.hair);
      rect(uX - 1.2 * z, uY - 40.6 * z, 3 * z, 4.2 * z, palette.hair);
      rect(uX - 0.6 * z, uY - 41.8 * z, 1.8 * z, 1.4 * z, palette.hair);
      rect(uX + 2.6 * z, uY - 39.4 * z, 2.8 * z, 3 * z, palette.hair);
      rect(uX + 4 * z, uY - 40.6 * z, 1.8 * z, 1.4 * z, palette.hair);
      rect(uX - 3.8 * z, uY - 39.2 * z, 1.2 * z, 2 * z, palette.hairHighlight);
      rect(uX - 0.4 * z, uY - 40.2 * z, 1.4 * z, 2.4 * z, palette.hairHighlight);
      rect(uX + 3.2 * z, uY - 39 * z, 1.2 * z, 1.8 * z, palette.hairHighlight);
    } else if (palette.maleHairStyle === 'curly_top') {
      rect(uX - 7 * z, uY - 33.8 * z, 1 * z, 3.2 * z, palette.hair);
      rect(uX + 6 * z, uY - 33.8 * z, 1 * z, 3.2 * z, palette.hair);
      rect(uX - 7.4 * z, uY - 37 * z, 14.8 * z, 3.2 * z, palette.hair);
      rect(uX - 6.2 * z, uY - 39 * z, 12.4 * z, 2.4 * z, palette.hair);
      rect(uX - 4.2 * z, uY - 40.2 * z, 8.4 * z, 1.6 * z, palette.hair);
      rect(uX - 5 * z, uY - 34 * z, 2.2 * z, 1.4 * z, palette.hair);
      rect(uX - 1.2 * z, uY - 34.2 * z, 2.4 * z, 1.6 * z, palette.hair);
      rect(uX + 2.8 * z, uY - 34 * z, 2.2 * z, 1.4 * z, palette.hair);
      rect(uX - 5.4 * z, uY - 38.4 * z, 2.2 * z, 1.2 * z, palette.hairHighlight);
      rect(uX - 1.4 * z, uY - 39.4 * z, 2.6 * z, 1.2 * z, palette.hairHighlight);
      rect(uX + 3 * z, uY - 38.2 * z, 2.2 * z, 1.2 * z, palette.hairHighlight);
      rect(uX - 2.6 * z, uY - 36.2 * z, 2 * z, 1 * z, palette.hairHighlight);
    } else {
      rect(uX - 7 * z, uY - 33.6 * z, 1 * z, 2.6 * z, palette.hair);
      rect(uX + 6 * z, uY - 33.6 * z, 1 * z, 2.6 * z, palette.hair);
      rect(uX - 6.2 * z, uY - 35.6 * z, 12.4 * z, 2.2 * z, palette.hair);
      rect(uX - 5.6 * z, uY - 37.2 * z, 11.2 * z, 2 * z, palette.hair);
      rect(uX - 4.2 * z, uY - 38.4 * z, 8.4 * z, 1.4 * z, palette.hair);
      rect(uX - 6.2 * z, uY - 33.6 * z, 1.6 * z, 1 * z, palette.hair);
      rect(uX + 4.6 * z, uY - 33.6 * z, 1.6 * z, 1 * z, palette.hair);
      rect(uX - 3.8 * z, uY - 37.4 * z, 2 * z, 1 * z, palette.hairHighlight);
      rect(uX - 0.6 * z, uY - 37.8 * z, 2 * z, 1 * z, palette.hairHighlight);
      rect(uX + 2.2 * z, uY - 37 * z, 2 * z, 1 * z, palette.hairHighlight);
    }
  }

  // 6. Model-specific headgear & accessories across all 8 angles
  if (isCostumeEvent(activeEventKind)) {
    drawSpriteCostumeOverlay(
      rect,
      uX,
      uY,
      z,
      dirFlip,
      costumeVariant,
      palette.hair,
      activeEventKind,
      timeSec,
      palette.gender === 'female',
      isPureBack,
    );
  } else if (emp.modelFamily === 'argon' || emp.isCoordinator) {
    // Gold crown (8-directional royal band & points)
    if (palette.gender === 'female') {
      const crownBaseY =
        palette.femaleHairStyle === 'bun_updo' && !isSideProfile ? uY - 42.6 * z : uY - 40.4 * z;
      const cw = isSideProfile ? 6.6 : 8;
      uRect(-cw / 2, crownBaseY, cw, 2.4, '#ffd147');
      uRect(-cw / 2, crownBaseY - 1.6 * z, 1.5, 1.6, '#ffd147');
      uRect(-0.8, crownBaseY - 2 * z, 1.6, 2, '#ffd147');
      uRect(cw / 2 - 1.5, crownBaseY - 1.6 * z, 1.5, 1.6, '#ffd147');
    } else {
      const mCrownY =
        palette.maleHairStyle === 'spiky' || palette.maleHairStyle === 'curly_top'
          ? uY - 43.6 * z
          : uY - 41.2 * z;
      const cw = isSideProfile ? 7.6 : 9.2;
      uRect(-cw / 2, mCrownY + 2 * z, cw, 0.9, '#9e680d');
      uRect(-cw / 2, mCrownY, cw, 2.2, '#ffd147');
      uRect(-cw / 2, mCrownY - 1.8 * z, 1.7, 1.8, '#ffd147');
      uRect(-0.9, mCrownY - 2.2 * z, 1.8, 2.2, '#ffd147');
      uRect(cw / 2 - 1.7, mCrownY - 1.8 * z, 1.7, 1.8, '#ffd147');
      if (!isPureBack) {
        uRect(isSideProfile ? cw / 2 - 1.4 : -0.6, mCrownY + 0.6 * z, 1.2, 1, '#ff5666');
      }
    }
  } else if (emp.modelFamily === 'hydrogen') {
    // Cyan studio headphones
    if (isSideProfile) {
      const bandTopY = palette.gender === 'female' ? uY - 38.4 * z : uY - 39.4 * z;
      uRect(-1.5, bandTopY, 2.2, 7.2, '#3cd8ff');
      uRect(-2.6, uY - 31.8 * z, 3.8, 5.6, '#3cd8ff');
      uRect(-1.6, uY - 30.8 * z, 1.8, 3.6, '#16263b');
      uRect(-1, uY - 29.4 * z, 0.9, 1, '#9ef8ff');
    } else if (palette.gender === 'female') {
      rect(uX - 5 * z, uY - 38.2 * z, 10 * z, 1 * z, '#3cd8ff');
      rect(uX - 7.4 * z, uY - 31.8 * z, 1.8 * z, 5.8 * z, '#3cd8ff');
      rect(uX + 5.6 * z, uY - 31.8 * z, 1.8 * z, 5.8 * z, '#3cd8ff');
    } else {
      rect(uX - 5.6 * z, uY - 39.2 * z, 11.2 * z, 1.1 * z, '#3cd8ff');
      rect(uX - 8.4 * z, uY - 32 * z, 2 * z, 6 * z, '#3cd8ff');
      rect(uX + 6.4 * z, uY - 32 * z, 2 * z, 6 * z, '#3cd8ff');
    }
  } else if (emp.modelFamily === 'flash') {
    // Emerald-yellow speed visor (rear strap on N, aerodynamic side wrap on E/W & NE/NW, full lens on S/SE/SW)
    if (isPureBack) {
      rect(uX - 5.8 * z, uY - 29.8 * z, 11.6 * z, 1.1 * z, '#bfa126');
    } else if (isSideProfile) {
      uRect(-0.6, uY - 30 * z, 6.2, 2.2, '#ffe64d');
      uRect(2.2, uY - 29.6 * z, 2.6, 0.9, hasScreenGlow ? '#9ef8ff' : '#fffbe0');
    } else if (isFacingAway) {
      const visX = dirFlip > 0 ? uX + 2 * z : uX - 6.6 * z;
      rect(visX, uY - 30 * z, 4.6 * z, 2.2 * z, '#ffe64d');
      rect(
        visX + (dirFlip > 0 ? 1.8 : 0.4) * z,
        uY - 29.6 * z,
        2 * z,
        0.9 * z,
        hasScreenGlow ? '#7ef3ff' : '#fffbe0',
      );
    } else if (palette.gender === 'female') {
      rect(uX - 4.5 * z + fShift * 0.5, uY - 29.8 * z, 9 * z, 2.2 * z, '#ffe64d');
      rect(
        uX - 3.2 * z + fShift * 0.5,
        uY - 29.5 * z,
        2.5 * z,
        0.9 * z,
        hasScreenGlow && codeGlowCyan ? '#9ef8ff' : '#fffbe0',
      );
    } else {
      rect(uX - 5.2 * z + mShift * 0.5, uY - 30 * z, 10.4 * z, 2.4 * z, '#ffe64d');
      rect(
        uX - 3.6 * z + mShift * 0.5,
        uY - 29.6 * z,
        3 * z,
        0.9 * z,
        hasScreenGlow && codeGlowCyan ? '#9ef8ff' : '#fffbe0',
      );
    }
  } else if (emp.modelFamily === 'carbon') {
    const lensTint = hasScreenGlow ? 'rgba(126, 243, 255, 0.42)' : 'rgba(126, 243, 255, 0.24)';
    if (isPureBack) {
      rect(uX - 6.8 * z, uY - 29.6 * z, 1 * z, 0.8 * z, '#7ef3ff');
      rect(uX + 5.8 * z, uY - 29.6 * z, 1 * z, 0.8 * z, '#7ef3ff');
    } else if (isSideProfile) {
      uRect(1.8, uY - 18.6 * z, 1.6, 4.4, '#f2f5ff');
      uRect(-0.8, uY - 29.8 * z, 5.6, 0.8, '#7ef3ff');
      uRect(2, uY - 29.3 * z, 2.8, 2.2, lensTint);
    } else if (isFacingAway) {
      const templeX = dirFlip > 0 ? uX + 1.8 * z : uX - 6.4 * z;
      rect(templeX, uY - 29.8 * z, 4.6 * z, 0.8 * z, '#7ef3ff');
      rect(dirFlip > 0 ? uX + 3.6 * z : uX - 6.4 * z, uY - 29.2 * z, 2.8 * z, 2.2 * z, lensTint);
    } else if (palette.gender === 'female') {
      const lapelH = hasScreenGlow ? 3.5 * z : 5.8 * z;
      rect(uX - 3.8 * z, uY - 18.5 * z, 1.8 * z, lapelH, '#f2f5ff');
      rect(uX + 2 * z, uY - 18.5 * z, 1.8 * z, lapelH, '#f2f5ff');
      rect(fEyeLx - 0.6 * z, uY - 29.8 * z, 3.2 * z, 0.8 * z, '#7ef3ff');
      rect(fEyeRx - 0.6 * z, uY - 29.8 * z, 3.2 * z, 0.8 * z, '#7ef3ff');
      rect(uX - 1 * z + fShift, uY - 29.4 * z, 2 * z, 0.8 * z, '#7ef3ff');
      rect(fEyeLx - 0.6 * z, uY - 29.2 * z, 3.2 * z, 2.2 * z, lensTint);
      rect(fEyeRx - 0.6 * z, uY - 29.2 * z, 3.2 * z, 2.2 * z, lensTint);
    } else {
      const lapelH = hasScreenGlow ? 3.8 * z : 6.4 * z;
      rect(uX - 4.4 * z, uY - 19 * z, 2 * z, lapelH, '#f2f5ff');
      rect(uX + 2.4 * z, uY - 19 * z, 2 * z, lapelH, '#f2f5ff');
      rect(mEyeLx - 0.6 * z, uY - 30 * z, 3.2 * z, 0.8 * z, '#7ef3ff');
      rect(mEyeRx - 0.6 * z, uY - 30 * z, 3.2 * z, 0.8 * z, '#7ef3ff');
      rect(uX - 1 * z + mShift, uY - 29.6 * z, 2 * z, 0.8 * z, '#7ef3ff');
      rect(mEyeLx - 0.6 * z, uY - 29.4 * z, 3.2 * z, 2.2 * z, lensTint);
      rect(mEyeRx - 0.6 * z, uY - 29.4 * z, 3.2 * z, 2.2 * z, lensTint);
    }
  } else if (emp.modelFamily === 'pro') {
    const proLensTint = hasScreenGlow
      ? codeGlowCyan
        ? 'rgba(118, 240, 255, 0.38)'
        : 'rgba(110, 245, 178, 0.34)'
      : 'rgba(230, 236, 255, 0.22)';
    if (isPureBack) {
      rect(uX - 6.8 * z, uY - 29.6 * z, 1 * z, 0.8 * z, '#e6ecff');
      rect(uX + 5.8 * z, uY - 29.6 * z, 1 * z, 0.8 * z, '#e6ecff');
    } else if (isSideProfile) {
      if (palette.gender === 'male' && palette.maleOutfitStyle !== 'tech_hoodie') {
        uRect(3.2, uY - 18.8 * z, 1.1, 4.2, '#ffd147');
      }
      uRect(-0.8, uY - 29.8 * z, 5.6, 0.8, '#e6ecff');
      uRect(2, uY - 29.3 * z, 2.8, 2.2, proLensTint);
    } else if (isFacingAway) {
      const templeX = dirFlip > 0 ? uX + 2 * z : uX - 6.4 * z;
      rect(templeX, uY - 29.8 * z, 4.4 * z, 0.8 * z, '#e6ecff');
      rect(dirFlip > 0 ? uX + 3.6 * z : uX - 6.4 * z, uY - 29.2 * z, 2.8 * z, 2.2 * z, proLensTint);
    } else if (palette.gender === 'male') {
      if (palette.maleOutfitStyle !== 'tech_hoodie') {
        rect(uX - 0.9 * z, uY - 19.2 * z, 1.8 * z, hasScreenGlow ? 4 * z : 5.4 * z, '#ffd147');
      }
      rect(mEyeLx - 0.6 * z, uY - 30 * z, 3.2 * z, 0.8 * z, '#e6ecff');
      rect(mEyeRx - 0.6 * z, uY - 30 * z, 3.2 * z, 0.8 * z, '#e6ecff');
      rect(uX - 1 * z + mShift, uY - 29.6 * z, 2 * z, 0.8 * z, '#ffd147');
      rect(mEyeLx - 0.6 * z, uY - 29.4 * z, 3.2 * z, 2.2 * z, proLensTint);
      rect(mEyeRx - 0.6 * z, uY - 29.4 * z, 3.2 * z, 2.2 * z, proLensTint);
    } else {
      rect(fEyeLx - 0.6 * z, uY - 29.8 * z, 3.2 * z, 0.8 * z, '#e6ecff');
      rect(fEyeRx - 0.6 * z, uY - 29.8 * z, 3.2 * z, 0.8 * z, '#e6ecff');
      rect(uX - 1 * z + fShift, uY - 29.4 * z, 2 * z, 0.8 * z, '#ffd147');
      rect(fEyeLx - 0.6 * z, uY - 29.2 * z, 3.2 * z, 2.2 * z, proLensTint);
      rect(fEyeRx - 0.6 * z, uY - 29.2 * z, 3.2 * z, 2.2 * z, proLensTint);
    }
  } else if (emp.modelFamily === 'claude') {
    const beretW = isSideProfile ? (palette.gender === 'female' ? 8.8 : 9.8) : palette.gender === 'female' ? 10.4 : 11.6;
    const beretY = palette.gender === 'female' ? uY - 39.8 * z : uY - 40.4 * z;
    if (!isFacingAway) {
      if (isSideProfile) {
        uRect(0.2, palette.gender === 'female' ? uY - 19.4 * z : uY - 20.2 * z, 2.8, 1.5, '#fff1d6');
      } else if (palette.gender === 'female') {
        rect(uX - 3 * z, uY - 19.2 * z, 6 * z, 1.4 * z, '#fff1d6');
      } else {
        rect(uX - 3.4 * z, uY - 20.2 * z, 6.8 * z, 1.6 * z, '#fff1d6');
      }
    }
    uRect(-beretW / 2, beretY, beretW, palette.gender === 'female' ? 3 : 3.2, '#e07a52');
    uRect(-0.8, beretY - 1.5 * z, 1.6, 1.5, '#fff1d6');
  } else if (emp.modelFamily === 'gpt') {
    if (isSideProfile) {
      uRect(-1.8, palette.gender === 'female' ? uY - 20.6 * z : uY - 21.2 * z, 4.2, 2, '#0d4a46');
      uRect(-1.8, uY - 31.6 * z, 2.8, 5.2, '#7efaa8');
      uRect(0.6, uY - 25.4 * z, 4.2, 1.2, '#7efaa8');
    } else if (isPureBack) {
      rect(uX - 2.8 * z, uY - 20.8 * z, 5.6 * z, 2 * z, '#0d4a46');
      rect(uX + (palette.gender === 'female' ? 5.2 : 6) * z, uY - 31.6 * z, 1.7 * z, 5.2 * z, '#7efaa8');
    } else if (palette.gender === 'female') {
      rect(uX - 2.2 * z, uY - 20.6 * z, 4.4 * z, 2 * z, '#0d4a46');
      rect(uX + dirFlip * 5 * z - 0.8 * z, uY - 31.5 * z, 1.6 * z, 5 * z, '#7efaa8');
      rect(dirFlip > 0 ? uX + 2 * z : uX - 5.8 * z, uY - 25 * z, 3.8 * z, 1.2 * z, '#7efaa8');
    } else {
      rect(uX - 3.2 * z, uY - 21.2 * z, 6.4 * z, 2.2 * z, '#0d4a46');
      rect(uX + dirFlip * 6 * z - 0.9 * z, uY - 31.6 * z, 1.8 * z, 5.4 * z, '#7efaa8');
      rect(dirFlip > 0 ? uX + 2.4 * z : uX - 6.8 * z, uY - 25.2 * z, 4.4 * z, 1.3 * z, '#7efaa8');
    }
  } else if (isSideProfile) {
    uRect(1.6, uY - 18.6 * z, 1.2, 3.4, '#b7c4ff');
    uRect(1.8, uY - 15.4 * z, 2, 2.2, '#ffd147');
  } else if (!isFacingAway) {
    if (palette.gender === 'female') {
      rect(uX - 0.8 * z, uY - 18.5 * z, 1.6 * z, 3.5 * z, '#b7c4ff');
      rect(uX - 1.6 * z, uY - 15.5 * z, 3.2 * z, 2.2 * z, '#ffd147');
    } else {
      rect(uX - 1 * z, uY - 19.2 * z, 2 * z, 4 * z, '#b7c4ff');
      rect(uX - 1.8 * z, uY - 15.6 * z, 3.6 * z, 2.4 * z, '#ffd147');
    }
  }

  // 6.5 Handheld Glowing Open Aluminum Laptop & Active Typing Hand (Standing DevOps / QA at SERVER_RACK across 8 angles)
  if (isLaptopPose) {
    const lapWave = Math.sin(timeSec * 12);
    const lapTapY = lapWave * 0.85 * z;
    const lapTapX = Math.cos(timeSec * 6) * 0.55;

    if (isPureBack) {
      // Pure North laptop pose: laptop held in front of chest — glowing terminal aura + peeking silver lid edge + CLI glyph
      rect(
        cx - 8.6 * z,
        baseY - 21.5 * z,
        17.2 * z,
        5.5 * z,
        codeGlowCyan ? 'rgba(92, 240, 255, 0.14)' : 'rgba(59, 232, 122, 0.13)',
      );
      rect(cx + 4.4 * z, baseY - 19.2 * z, 4.4 * z, 3.8 * z, '#cfd8dc');
      rect(cx + 4.8 * z, baseY - 18.6 * z, 3.6 * z, 2.6 * z, '#0d1526');
      rect(cx + 5.2 * z, baseY - 17.8 * z, 2.4 * z, 0.75 * z, '#3be87a');
      rect(cx + 5.2 * z, baseY - 16.7 * z, 1.8 * z, 0.75 * z, '#5cf0ff');
    } else {
      const lapDx = isSideProfile ? 2.4 : isFacingAway ? 1.4 : 0;
      const lapLift = isFacingAway ? 1.2 * z : 0;

      // Soft upward terminal glow cone illuminating chest & lower face
      dRect(
        2.6 + lapDx,
        baseY - 22 * z - lapLift,
        8.6,
        3.4,
        codeGlowCyan ? 'rgba(92, 240, 255, 0.13)' : 'rgba(59, 232, 122, 0.12)',
      );
      dRect(3.8 + lapDx, baseY - 19.8 * z - lapLift, 8.2, 6.8, 'rgba(60, 216, 255, 0.14)');

      // Open 3-stepped isometric aluminum display lid (#cfd8dc silver outer rim + #e8f0f5 specular + #455a64 bezel)
      dRect(5.2 + lapDx, baseY - 19.8 * z - lapLift, 6.8, 2.4, '#cfd8dc');
      dRect(5.4 + lapDx, baseY - 19.8 * z - lapLift, 6.4, 0.7, '#eef4f8');
      dRect(4.7 + lapDx, baseY - 17.5 * z - lapLift, 6.9, 2.4, '#cfd8dc');
      dRect(4.2 + lapDx, baseY - 15.2 * z - lapLift, 6.9, 2.6, '#cfd8dc');
      dRect(5.2 + lapDx, baseY - 19.1 * z - lapLift, 6.1, 2.1, '#455a64');
      dRect(4.7 + lapDx, baseY - 17.1 * z - lapLift, 6.2, 2.2, '#455a64');
      dRect(4.2 + lapDx, baseY - 15 * z - lapLift, 6.2, 2.4, '#455a64');

      // Glowing #0d1526 terminal screen + header bar + green (#3be87a) & cyan (#5cf0ff) CLI code lines
      dRect(5.5 + lapDx, baseY - 18.7 * z - lapLift, 5.4, 2, '#0d1526');
      dRect(5 + lapDx, baseY - 16.8 * z - lapLift, 5.4, 2, '#0d1526');
      dRect(4.6 + lapDx, baseY - 14.9 * z - lapLift, 5.4, 2, '#0d1526');
      dRect(5.5 + lapDx, baseY - 18.7 * z - lapLift, 5.4, 0.75, '#1c2d4f');
      dRect(5.8 + lapDx, baseY - 18.6 * z - lapLift, 0.8, 0.55, '#3be87a');
      dRect(5.7 + lapDx, baseY - 17.4 * z - lapLift, 3.8, 0.75, '#3be87a');
      const cliLineW = 2.6 + (Math.floor(timeSec * 6) % 3) * 0.8;
      dRect(5.3 + lapDx, baseY - 16.2 * z - lapLift, cliLineW, 0.75, '#5cf0ff');
      dRect(5 + lapDx, baseY - 15 * z - lapLift, 1.8, 0.75, '#3be87a');
      dRect(7.2 + lapDx, baseY - 15 * z - lapLift, 2.2, 0.75, '#5cf0ff');
      dRect(4.9 + lapDx, baseY - 13.8 * z - lapLift, 2, 0.75, '#3be87a');
      if (Math.floor(timeSec * 4) % 2 === 0) {
        dRect(7.2 + lapDx, baseY - 13.85 * z - lapLift, 0.9, 0.8, '#ffffff');
      }

      // Isometric 2-stepped anodized aluminum keyboard deck (#cfd8dc top + #455a64 bevel + #1b2432 chiclet keys)
      dRect(3.8 + lapDx, baseY - 12.9 * z - lapLift, 6.4, 0.9, '#263238');
      dRect(1.2 + lapDx, baseY - 13 * z - lapLift, 7.8, 1.2, '#cfd8dc');
      dRect(-1.4 + lapDx, baseY - 12.3 * z - lapLift, 8.8, 1.3, '#cfd8dc');
      dRect(-1.4 + lapDx, baseY - 11.1 * z - lapLift, 9, 0.9, '#455a64');
      dRect(7.4 + lapDx, baseY - 11.9 * z - lapLift, 1.8, 0.9, '#455a64');
      dRect(1.8 + lapDx, baseY - 11.8 * z - lapLift, 2.2, 0.65, '#90a4ae');
      dRect(-0.5 + lapDx, baseY - 12.7 * z - lapLift, 5.8, 1.05, '#1b2432');
      dRect(-0.1 + lapDx, baseY - 12.5 * z - lapLift, 1.4, 0.5, '#607d8b');
      dRect(1.7 + lapDx, baseY - 12.5 * z - lapLift, 1.6, 0.5, '#90a4ae');
      dRect(3.6 + lapDx, baseY - 12.6 * z - lapLift, 1.3, 0.5, '#607d8b');

      // Supporting palm & fingers cradling the underside of the aluminum laptop chassis
      dRect(2.6 + lapDx, baseY - 10.8 * z - lapLift, 3.2, 1.2, palette.skin);
      dRect(3 + lapDx, baseY - 11.2 * z - lapLift, 2.2, 0.6, palette.skinShadow);

      // Foreground forearm & active typing hand hovering over laptop keyboard
      const foreStartDx = isSideProfile ? -1.2 : palette.gender === 'female' ? -6.2 : -8.2;
      const foreWidth = 1.4 + lapDx - foreStartDx;
      if (palette.gender === 'female') {
        dRect(foreStartDx, baseY - 14.9 * z - lapLift + lapTapY * 0.35, foreWidth, 1.9, uniform.main);
        dRect(0.4 + lapDx, baseY - 14.8 * z - lapLift + lapTapY * 0.35, 0.8, 1.8, '#f6f7fc');
        dRect(1 + lapDx + lapTapX, baseY - 14.5 * z - lapLift + lapTapY, 2.8, 1.8, palette.skin);
      } else {
        const mIsHoodie = palette.maleOutfitStyle === 'tech_hoodie';
        const mIsVest = palette.maleOutfitStyle === 'vest_ensemble';
        if (mIsVest) {
          dRect(foreStartDx, baseY - 15.1 * z - lapLift + lapTapY * 0.25, 2, 2.1, '#eef2fc');
          dRect(foreStartDx + 1.8, baseY - 15.1 * z - lapLift + lapTapY * 0.3, 1.1, 2.1, '#cfd8ee');
          dRect(
            foreStartDx + 2.8,
            baseY - 15 * z - lapLift + lapTapY * 0.35,
            Math.max(2.4, foreWidth - 2.6),
            2,
            palette.skin,
          );
        } else {
          dRect(foreStartDx, baseY - 15.1 * z - lapLift + lapTapY * 0.35, foreWidth, 2.1, uniform.main);
          if (!mIsHoodie) {
            dRect(0.4 + lapDx, baseY - 15 * z - lapLift + lapTapY * 0.35, 0.9, 2, '#f6f7fc');
          }
        }
        dRect(1 + lapDx + lapTapX, baseY - 14.7 * z - lapLift + lapTapY, 3.2, 1.9, palette.skin);
      }

      if (lapWave > 0.45) {
        dRect(2 + lapDx + lapTapX, baseY - 12.8 * z - lapLift, 1.4, 0.8, codeGlowCyan ? '#5cf0ff' : '#3be87a');
      }
    }

    // Floating CLI / SSH terminal glyph rising gently above the open laptop screen
    const glyphY = ((timeSec * 10) % 10) * z;
    ctx.font = `bold ${Math.max(7, Math.round(7 * z))}px "JetBrains Mono", monospace`;
    ctx.fillStyle = codeGlowCyan ? 'rgba(92, 240, 255, 0.88)' : 'rgba(59, 232, 122, 0.88)';
    ctx.textAlign = 'center';
    ctx.fillText(
      Math.floor(timeSec * 2) % 2 === 0 ? '>_' : '</>',
      cx + dirFlip * 10.5 * z,
      baseY - 37 * z - glyphY,
    );
  }

  // Floating Zzz, ♪ lounging sparkle, gaming excitement ★, card suit ♠♥♦♣, or Error !
  if (emp.activity === 'gaming') {
    const bounce = Math.abs(Math.sin(timeSec * 6)) * 5 * z;
    ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Press Start 2P", monospace`;
    ctx.fillStyle = Math.sin(timeSec * 8) > 0 ? '#ffd147' : '#3cd8ff';
    ctx.textAlign = 'center';
    ctx.fillText('★', uX + 11 * z, uY - 37 * z - bounce);
  } else if (emp.activity === 'card_game') {
    const suitSeed = hashString(emp.id);
    const bounce = Math.abs(Math.sin(timeSec * 4.2 + (suitSeed & 3))) * 4 * z;
    const suitIdx = (Math.floor(timeSec * 1.4) + (suitSeed & 3)) & 3;
    const suits = ['♠', '♥', '♣', '♦'] as const;
    const isRedSuit = suitIdx === 1 || suitIdx === 3;
    const badgeX = uX + 9.5 * z;
    const badgeY = uY - 43 * z - bounce;
    rect(badgeX - 3.6 * z, badgeY - 4.6 * z, 7.2 * z, 8.6 * z, '#121826');
    rect(badgeX - 3.0 * z, badgeY - 4.0 * z, 6.0 * z, 7.4 * z, '#fffdf7');
    ctx.font = `bold ${Math.max(7, Math.round(7 * z))}px "JetBrains Mono", monospace`;
    ctx.fillStyle = isRedSuit ? '#e63946' : '#182030';
    ctx.textAlign = 'center';
    ctx.fillText(suits[suitIdx], badgeX, badgeY + 2 * z);
  } else if (emp.activity === 'lounging') {
    const floatY = ((timeSec * 10) % 8) * z;
    ctx.font = `bold ${Math.max(9, Math.round(9 * z))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#7ef3ff';
    ctx.textAlign = 'center';
    ctx.fillText('♪', uX + 10 * z, uY - 37 * z - floatY);
  } else if (emp.activity === 'sleeping' || emp.status === 'waiting') {
    const floatY = ((timeSec * 12) % 10) * z;
    ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#9ee8ff';
    ctx.textAlign = 'center';
    ctx.fillText('Zzz', uX + 10 * z, uY - 38 * z - floatY);
  } else if (emp.status === 'error' || emp.activity === 'error') {
    ctx.fillStyle = '#ff5666';
    ctx.fillRect(Math.round(uX - 5 * z), Math.round(uY - 52 * z), Math.ceil(10 * z), Math.ceil(10 * z));
    ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('!', uX, uY - 44 * z);
  }

  // Status dot color
  const dotColor =
    emp.status === 'working'
      ? '#3be87a'
      : emp.status === 'error'
        ? '#ff5666'
        : emp.status === 'waiting'
          ? '#ffbe3b'
          : '#8d96ad';

  const showNameTag = isHovered || isSelected;
  const pillY = uY - 56 * z;
  let pillX = uX;

  if (showNameTag) {
    // Overhead Role Tag + Status Dot (shown only on hover or selection)
    const rawName = emp.name.length > 14 ? `${emp.name.slice(0, 13)}…` : emp.name;
    const tagText = emp.isCoordinator ? `★ BOSS · ${rawName}` : rawName;
    ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "JetBrains Mono", monospace`;
    const textW = ctx.measureText(tagText).width;
    const pillW = textW + 16 * z;
    const pillH = 14 * z;
    pillX = uX - pillW / 2;

    ctx.fillStyle = 'rgba(12, 15, 25, 0.86)';
    ctx.fillRect(Math.round(pillX), Math.round(pillY), Math.ceil(pillW), Math.ceil(pillH));
    ctx.strokeStyle = isHovered ? '#3cd8ff' : emp.isCoordinator ? '#ffd147' : '#4a5780';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(pillX), Math.round(pillY), Math.ceil(pillW), Math.ceil(pillH));

    ctx.fillStyle = dotColor;
    ctx.fillRect(Math.round(pillX + 4 * z), Math.round(pillY + 4 * z), Math.ceil(5 * z), Math.ceil(5 * z));

    ctx.fillStyle = '#f4f6fc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, pillX + 11 * z, pillY + pillH / 2 + 0.5);
  } else {
    // Compact overhead status dot when not hovered/selected
    const dotSize = Math.max(4, Math.ceil(5 * z));
    const dx = Math.round(uX - dotSize / 2);
    const dy = Math.round(uY - 49.5 * z);
    ctx.fillStyle = '#0d101c';
    ctx.fillRect(dx - 1, dy - 1, dotSize + 2, dotSize + 2);
    ctx.fillStyle = dotColor;
    ctx.fillRect(dx, dy, dotSize, dotSize);
  }

  // Overhead Speech Bubble (shown on hover/select or for 4.5s after new bubble arrives)
  const hasVisibleBubble = Boolean(emp.speechBubble && showSpeechBubble);
  if (hasVisibleBubble && emp.speechBubble) {
    const bubbleText =
      emp.speechBubble.length > 26 ? `${emp.speechBubble.slice(0, 25)}…` : emp.speechBubble;
    ctx.font = `${Math.max(8, Math.round(8 * z))}px "JetBrains Mono", monospace`;
    const bw = ctx.measureText(bubbleText).width + 12 * z;
    const bh = 15 * z;
    const bx = uX - bw / 2;
    const anchorY = showNameTag ? pillY : uY - 50 * z;
    const by = anchorY - bh - 6 * z;

    ctx.fillStyle = '#fffdf2';
    ctx.fillRect(Math.round(bx), Math.round(by), Math.ceil(bw), Math.ceil(bh));
    ctx.strokeStyle = '#11131c';
    ctx.strokeRect(Math.round(bx), Math.round(by), Math.ceil(bw), Math.ceil(bh));

    // Little tail
    ctx.fillStyle = '#fffdf2';
    ctx.fillRect(Math.round(uX - 2 * z), Math.round(by + bh), Math.ceil(4 * z), Math.ceil(3 * z));

    ctx.fillStyle = '#141824';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubbleText, uX, by + bh / 2 + 0.5);
  }

  // Tool-based status icon bubble above working/errored agents
  const toolKind: ToolBubbleKind | null =
    emp.toolActivity && emp.toolActivity !== 'idle'
      ? emp.toolActivity
      : emp.status === 'error'
        ? 'error'
        : null;
  if (toolKind) {
    const toolX = hasVisibleBubble ? (showNameTag ? pillX - 10 * z : uX - 12 * z) : uX;
    const toolY = hasVisibleBubble
      ? (showNameTag ? pillY + 4 * z : uY - 46 * z)
      : (showNameTag ? pillY - 6 * z : uY - 52 * z);
    drawToolStatusBubble(ctx, toolKind, toolX, toolY, z, timeSec);
  }

  ctx.restore();
}

export const drawEmployee = drawEmployeeSprite;

/**
 * Renders a crisp zoomed-in pixel portrait of an employee for AgentRpgModal.
 */
export function drawEmployeePortrait(
  ctx: CanvasRenderingContext2D,
  emp: OfficeEmployee,
  size: number,
  activeEventKind?: FloorEventKind | null,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  const uniform = UNIFORM_COLORS[emp.modelFamily] || UNIFORM_COLORS.other;
  const empGender = (emp as OfficeEmployee & { gender?: 'female' | 'male' }).gender;
  const palette = getEmployeePalette(emp.id, empGender);

  // Background gradient
  ctx.fillStyle = '#181e30';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = uniform.dark;
  ctx.fillRect(0, Math.floor(size * 0.7), size, Math.ceil(size * 0.3));

  const scale = size / 32;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(x * scale),
      Math.round(y * scale),
      Math.max(1, Math.ceil(w * scale)),
      Math.max(1, Math.ceil(h * scale)),
    );
  };

  const costumeVariant = (hashString(emp.id) >>> 12) & 3;
  const enclosingHelmet = hasEnclosingCostumeHelmet(activeEventKind, costumeVariant);
  const hideTopChignon = suppressesTopChignon(activeEventKind, costumeVariant);
  const isLeiaCostume = activeEventKind === 'STAR_WARS_PARTY' && costumeVariant === 2;

  // 1. Back hair layer for female styles (drawn behind slender neck & sloped 14px shoulders)
  if (palette.gender === 'female' && !enclosingHelmet) {
    if (palette.femaleHairStyle === 'long_locks') {
      px(9, 8, 14, 14, palette.hair);
      // Left S-curve cascade tapering to feathered tip
      px(7, 10, 3, 6, palette.hair);
      px(8, 16, 3, 5, palette.hair);
      px(7, 21, 3, 5, palette.hair);
      px(8, 26, 2, 3, palette.hair);
      px(8, 29, 1, 2, palette.hair);
      px(8, 11, 1, 4, palette.hairHighlight);
      px(8, 22, 1, 3, palette.hairHighlight);
      // Right S-curve cascade (mirror)
      px(22, 10, 3, 6, palette.hair);
      px(21, 16, 3, 5, palette.hair);
      px(22, 21, 3, 5, palette.hair);
      px(22, 26, 2, 3, palette.hair);
      px(23, 29, 1, 2, palette.hair);
      px(23, 11, 1, 4, palette.hairHighlight);
      px(23, 22, 1, 3, palette.hairHighlight);
    } else if (palette.femaleHairStyle === 'bob_cut') {
      px(9, 8, 14, 4, palette.hair);
      px(8, 12, 16, 6, palette.hair);
      px(9, 18, 14, 2, palette.hair);
      px(10, 20, 3, 2, palette.hair);
      px(19, 20, 3, 2, palette.hair);
    } else if (palette.femaleHairStyle === 'ponytail') {
      px(9, 8, 14, 9, palette.hair);
      if (!isLeiaCostume) {
        px(7, 9, 2, 3, palette.accessoryColor);
        px(5, 8, 3, 3, palette.hair);
        px(6, 8, 1, 2, palette.hairHighlight);
        px(4, 11, 3, 6, palette.hair);
        px(5, 12, 1, 4, palette.hairHighlight);
        px(5, 17, 2, 5, palette.hair);
        px(4, 22, 2, 2, palette.hair);
        px(3, 23, 1, 2, palette.hair);
      }
    } else if (palette.femaleHairStyle === 'bun_updo') {
      px(9, 8, 14, 8, palette.hair);
      if (!hideTopChignon) {
        px(13, 4, 6, 2, palette.hair);
        px(14, 3, 4, 1, palette.hair);
        px(14, 4, 3, 1, palette.hairHighlight);
        px(13, 6, 6, 1, palette.accessoryColor);
        px(14, 6, 1, 1, '#fff8e7');
        px(17, 6, 1, 1, '#fff8e7');
      }
    }
  }

  // 2. Neck & Shoulders / Uniform
  if (palette.gender === 'female') {
    // Slender 4px neck (x: 14..17, y: 20..22) + sloped 14px feminine shoulders (x: 9..22)
    px(14, 20, 4, 2, palette.skinShadow);
    px(14, 22, 4, 2, palette.skin);
    px(11, 22, 3, 1, uniform.dark);
    px(18, 22, 3, 1, uniform.dark);
    px(10, 23, 12, 1, uniform.dark);
    px(11, 23, 10, 1, uniform.main);
    px(9, 24, 14, 8, uniform.dark);
    px(10, 24, 12, 8, uniform.main);
    px(9, 29, 2, 3, uniform.dark);
    px(21, 29, 2, 3, uniform.dark);
    // Open collarbone + silk V-neck blouse (#f6f7fc) & pendant (uniform.trim)
    px(14, 22, 4, 2, palette.skin);
    px(15, 24, 2, 1, palette.skin);
    px(12, 23, 2, 2, '#f6f7fc');
    px(18, 23, 2, 2, '#f6f7fc');
    px(13, 25, 6, 2, '#f6f7fc');
    px(14, 27, 4, 2, '#f6f7fc');
    px(15, 29, 2, 2, '#f6f7fc');
    px(15, 25, 2, 2, uniform.trim);

    // Front collarbone waves for 'long_locks'
    if (palette.femaleHairStyle === 'long_locks' && !enclosingHelmet && !isCostumeEvent(activeEventKind)) {
      px(10, 21, 2, 4, palette.hair);
      px(9, 25, 2, 3, palette.hair);
      px(10, 28, 1, 2, palette.hair);
      px(10, 22, 1, 3, palette.hairHighlight);
      px(20, 21, 2, 4, palette.hair);
      px(21, 25, 2, 3, palette.hair);
      px(21, 28, 1, 2, palette.hair);
      px(21, 22, 1, 3, palette.hairHighlight);
    }
  } else {
    // Sturdy 6px masculine neck (x: 13..18, y: 20..22) + sloped 18px athletic shoulders (x: 7..24)
    px(13, 20, 6, 3, palette.skinShadow);
    px(14, 21, 4, 2, palette.skin);

    if (palette.maleOutfitStyle === 'tech_hoodie') {
      px(10, 22, 12, 2, uniform.dark);
      px(9, 23, 14, 1, uniform.dark);
      px(7, 24, 18, 8, uniform.dark);
      px(8, 24, 16, 8, uniform.main);
      px(14, 22, 4, 3, '#1b2234');
      px(13, 22, 1, 2, '#f4f6fc');
      px(18, 22, 1, 2, '#f4f6fc');
      px(12, 24, 1, 5, uniform.trim);
      px(19, 24, 1, 5, uniform.trim);
      px(15, 25, 2, 7, '#9aa7c7');
      px(15, 26, 2, 1, '#ffffff');
    } else if (palette.maleOutfitStyle === 'vest_ensemble') {
      // Dress shirt shoulders (x: 7..24) + buttoned V-neck waistcoat + silk tie
      px(9, 23, 14, 1, '#dce4f7');
      px(7, 24, 18, 8, '#eef2fc');
      px(7, 29, 3, 2, '#cfd8ee');
      px(22, 29, 3, 2, '#cfd8ee');
      px(10, 23, 12, 9, uniform.dark);
      px(11, 24, 10, 8, uniform.main);
      px(12, 22, 8, 2, '#f6f7fc');
      px(14, 24, 4, 4, '#f6f7fc');
      px(15, 23, 2, 5, uniform.trim);
      px(15, 29, 2, 1, uniform.trim);
      px(15, 31, 2, 1, uniform.trim);
    } else {
      // 'classic_suit': 18px tailored blazer (x: 7..24) + shirt collar + notched lapels + silk tie & tie pin
      px(11, 22, 10, 1, uniform.dark);
      px(9, 23, 14, 1, uniform.dark);
      px(7, 24, 18, 8, uniform.dark);
      px(8, 24, 16, 8, uniform.main);
      px(12, 22, 8, 2, '#f6f7fc');
      px(14, 24, 4, 5, '#f6f7fc');
      px(12, 24, 2, 6, uniform.dark);
      px(18, 24, 2, 6, uniform.dark);
      px(15, 23, 2, 9, uniform.trim);
      px(15, 27, 2, 1, '#ffffff');
      px(19, 27, 2, 1, uniform.trim);
    }
  }

  // 3. Head & Expressive Face
  if (palette.gender === 'female') {
    // Tapered oval face: x: 10..21 cheeks -> x: 11..20 jaw -> x: 13..18 rounded chin at y=20
    px(11, 8, 10, 1, palette.skinShadow);
    px(10, 9, 12, 10, palette.skinShadow);
    px(11, 19, 10, 1, palette.skinShadow);
    px(13, 20, 6, 1, palette.skinShadow);

    px(11, 8, 10, 2, palette.skin);
    px(10, 9, 12, 9, palette.skin);
    px(11, 18, 10, 1, palette.skin);
    px(12, 19, 8, 1, palette.skin);
    px(13, 20, 6, 1, palette.skin);

    // 1x1 gleaming stud earrings
    if (!enclosingHelmet) {
      px(9, 16, 1, 1, '#fff2cc');
      px(22, 16, 1, 1, '#fff2cc');
    }

    // Soft arched brows + winged lashes + dark iris + 1x1 white catchlights + blush + 2x1 rose lips
    px(12, 12, 2, 1, palette.hair);
    px(18, 12, 2, 1, palette.hair);
    px(12, 14, 2, 3, '#161926');
    px(18, 14, 2, 3, '#161926');
    px(12, 14, 2, 1, '#141622');
    px(18, 14, 2, 1, '#141622');
    px(11, 14, 1, 1, '#141622');
    px(20, 14, 1, 1, '#141622');
    px(11, 13, 1, 1, '#141622');
    px(20, 13, 1, 1, '#141622');
    px(13, 14, 1, 1, '#ffffff');
    px(19, 14, 1, 1, '#ffffff');
    px(10, 17, 2, 1, 'rgba(255, 130, 162, 0.45)');
    px(20, 17, 2, 1, 'rgba(255, 130, 162, 0.45)');
    px(15, 18, 2, 1, '#e56b88');
  } else {
    // Angular masculine face: x: 10..21 top -> x: 9..22 brow/cheek -> x: 10..21 jaw -> x: 12..19 square chin at y=20
    px(10, 8, 12, 1, palette.skinShadow);
    px(9, 9, 14, 8, palette.skinShadow);
    px(10, 17, 12, 2, palette.skinShadow);
    px(11, 19, 10, 1, palette.skinShadow);
    px(12, 20, 8, 1, palette.skinShadow);

    px(10, 8, 12, 2, palette.skin);
    px(10, 9, 12, 8, palette.skin);
    px(11, 17, 10, 2, palette.skin);
    px(12, 19, 8, 1, palette.skin);
    px(13, 20, 6, 1, palette.skin);

    if (!enclosingHelmet) {
      px(8, 13, 1, 3, palette.skinShadow);
      px(23, 13, 1, 3, palette.skinShadow);
    }
    // Determined masculine brows + #161926 iris + 1x1 white catchlights + nose/mouth contour
    px(11, 12, 3, 1, palette.hair);
    px(18, 12, 3, 1, palette.hair);
    px(12, 14, 2, 3, '#161926');
    px(18, 14, 2, 3, '#161926');
    px(13, 14, 1, 1, '#ffffff');
    px(19, 14, 1, 1, '#ffffff');
    px(15, 16, 2, 1, palette.skinShadow);
    px(14, 18, 4, 1, palette.skinShadow);

    if (palette.maleFacialHair === 'light_stubble' && !enclosingHelmet) {
      px(14, 17, 4, 1, 'rgba(28, 32, 46, 0.22)');
      px(11, 17, 2, 2, 'rgba(28, 32, 46, 0.22)');
      px(19, 17, 2, 2, 'rgba(28, 32, 46, 0.22)');
      px(12, 19, 8, 1, 'rgba(28, 32, 46, 0.22)');
      px(13, 20, 6, 1, 'rgba(28, 32, 46, 0.22)');
    }
  }

  // 4. Front hair / sculpted crown dome / bangs / male styles
  if (palette.gender === 'female') {
    if (!enclosingHelmet) {
      px(12, 5, 8, 1, palette.hair);
      px(10, 6, 12, 2, palette.hair);
      px(9, 8, 14, 2, palette.hair);
      px(12, 6, 4, 1, palette.hairHighlight);
      px(17, 7, 2, 1, palette.hairHighlight);

      if (palette.femaleHairStyle === 'long_locks') {
        px(10, 9, 5, 2, palette.hair);
        px(14, 10, 3, 1, palette.hair);
        px(18, 9, 4, 2, palette.hair);
        px(9, 10, 1, 6, palette.hair);
        px(22, 10, 1, 6, palette.hair);
      } else if (palette.femaleHairStyle === 'bob_cut') {
        px(10, 9, 6, 2, palette.hair);
        px(15, 10, 2, 1, palette.hair);
        px(19, 9, 3, 2, palette.hair);
        px(9, 10, 2, 8, palette.hair);
        px(10, 18, 2, 2, palette.hair);
        px(11, 20, 2, 1, palette.hair);
        px(21, 10, 2, 8, palette.hair);
        px(20, 18, 2, 2, palette.hair);
        px(19, 20, 2, 1, palette.hair);
        px(9, 11, 1, 5, palette.hairHighlight);
        px(19, 9, 2, 1, palette.accessoryColor);
      } else if (palette.femaleHairStyle === 'ponytail') {
        px(10, 9, 5, 2, palette.hair);
        px(18, 9, 4, 2, palette.hair);
        px(9, 10, 1, 5, palette.hair);
        px(10, 14, 1, 2, palette.hair);
        px(22, 10, 1, 5, palette.hair);
        px(21, 14, 1, 2, palette.hair);
      } else if (palette.femaleHairStyle === 'bun_updo') {
        px(10, 9, 4, 2, palette.hair);
        px(18, 9, 4, 2, palette.hair);
        px(9, 10, 1, 5, palette.hair);
        px(10, 14, 1, 2, palette.hair);
        px(22, 10, 1, 5, palette.hair);
        px(21, 14, 1, 2, palette.hair);
      }
    }
  } else if (!enclosingHelmet) {
    if (hideTopChignon) {
      px(9, 9, 1, 5, palette.hair);
      px(22, 9, 1, 5, palette.hair);
      px(9, 7, 14, 3, palette.hair);
      px(11, 10, 10, 1, palette.hair);
    } else if (palette.maleHairStyle === 'side_part') {
      px(9, 9, 1, 5, palette.hair);
      px(22, 9, 1, 5, palette.hair);
      px(9, 7, 14, 3, palette.hair);
      px(10, 5, 12, 2, palette.hair);
      px(14, 4, 7, 1, palette.hair);
      px(10, 9, 2, 1, palette.hair);
      px(13, 9, 8, 2, palette.hair);
      px(17, 11, 3, 1, palette.hair);
      px(14, 5, 5, 1, palette.hairHighlight);
      px(17, 7, 4, 1, palette.hairHighlight);
    } else if (palette.maleHairStyle === 'spiky') {
      px(9, 9, 1, 5, palette.hair);
      px(22, 9, 1, 5, palette.hair);
      px(9, 7, 14, 3, palette.hair);
      px(11, 10, 2, 1, palette.hair);
      px(15, 10, 2, 1, palette.hair);
      px(19, 10, 2, 1, palette.hair);
      px(8, 5, 3, 2, palette.hair);
      px(7, 4, 2, 1, palette.hair);
      px(11, 4, 3, 3, palette.hair);
      px(11, 3, 2, 1, palette.hair);
      px(15, 3, 3, 4, palette.hair);
      px(16, 2, 2, 1, palette.hair);
      px(19, 4, 3, 3, palette.hair);
      px(21, 3, 2, 1, palette.hair);
      px(12, 4, 1, 2, palette.hairHighlight);
      px(16, 3, 1, 3, palette.hairHighlight);
      px(20, 4, 1, 2, palette.hairHighlight);
    } else if (palette.maleHairStyle === 'curly_top') {
      px(9, 9, 1, 4, palette.hair);
      px(22, 9, 1, 4, palette.hair);
      px(8, 6, 16, 3, palette.hair);
      px(9, 4, 14, 3, palette.hair);
      px(11, 3, 10, 2, palette.hair);
      px(10, 9, 3, 2, palette.hair);
      px(15, 9, 3, 2, palette.hair);
      px(19, 9, 3, 2, palette.hair);
      px(10, 5, 2, 1, palette.hairHighlight);
      px(15, 4, 3, 1, palette.hairHighlight);
      px(19, 6, 2, 1, palette.hairHighlight);
      px(13, 7, 2, 1, palette.hairHighlight);
    } else {
      // 'short_crop'
      px(9, 9, 1, 4, palette.hair);
      px(22, 9, 1, 4, palette.hair);
      px(9, 7, 14, 3, palette.hair);
      px(10, 6, 12, 2, palette.hair);
      px(11, 5, 10, 1, palette.hair);
      px(10, 10, 2, 1, palette.hair);
      px(20, 10, 2, 1, palette.hair);
      px(11, 6, 2, 1, palette.hairHighlight);
      px(15, 6, 2, 1, palette.hairHighlight);
      px(19, 7, 2, 1, palette.hairHighlight);
    }
  }

  // 5. Headgear & outfit accessories (or Costume Party overlay)
  if (isCostumeEvent(activeEventKind)) {
    drawPortraitCostumeOverlay(
      px,
      costumeVariant,
      palette.hair,
      activeEventKind,
      palette.gender === 'female',
    );
  } else if (emp.modelFamily === 'argon' || emp.isCoordinator) {
    if (palette.gender === 'female') {
      if (palette.femaleHairStyle === 'bun_updo') {
        px(11, 1, 10, 2, '#ffd147');
        px(11, 0, 2, 1, '#ffd147');
        px(15, 0, 2, 1, '#ffd147');
        px(19, 0, 2, 1, '#ffd147');
      } else {
        px(11, 3, 10, 2, '#ffd147');
        px(11, 1, 2, 2, '#ffd147');
        px(15, 1, 2, 2, '#ffd147');
        px(19, 1, 2, 2, '#ffd147');
      }
    } else if (palette.maleHairStyle === 'spiky' || palette.maleHairStyle === 'curly_top') {
      px(10, 2, 12, 1, '#9e680d');
      px(10, 1, 12, 1, '#ffd147');
      px(10, 0, 2, 1, '#ffd147');
      px(15, 0, 2, 1, '#ffd147');
      px(20, 0, 2, 1, '#ffd147');
    } else {
      px(10, 3, 12, 1, '#9e680d');
      px(10, 2, 12, 1, '#ffd147');
      px(10, 0, 2, 2, '#ffd147');
      px(15, 0, 2, 2, '#ffd147');
      px(20, 0, 2, 2, '#ffd147');
    }
  } else if (emp.modelFamily === 'hydrogen') {
    if (palette.gender === 'female') {
      px(11, 5, 10, 1, '#3cd8ff');
      px(8, 11, 2, 5, '#3cd8ff');
      px(22, 11, 2, 5, '#3cd8ff');
    } else {
      px(10, 4, 12, 1, '#3cd8ff');
      px(7, 11, 2, 6, '#3cd8ff');
      px(23, 11, 2, 6, '#3cd8ff');
    }
  } else if (emp.modelFamily === 'flash') {
    if (palette.gender === 'female') {
      px(11, 13, 10, 2, '#ffe64d');
      px(12, 13, 3, 1, '#fffbe0');
    } else {
      px(10, 13, 12, 2, '#ffe64d');
      px(11, 13, 4, 1, '#fffbe0');
    }
  } else if (emp.modelFamily === 'carbon') {
    if (palette.gender === 'female') {
      px(11, 24, 2, 8, '#f2f5ff');
      px(19, 24, 2, 8, '#f2f5ff');
      px(11, 13, 4, 1, '#7ef3ff');
      px(17, 13, 4, 1, '#7ef3ff');
      px(15, 14, 2, 1, '#7ef3ff');
      px(11, 14, 4, 2, 'rgba(126, 243, 255, 0.24)');
      px(17, 14, 4, 2, 'rgba(126, 243, 255, 0.24)');
    } else {
      px(10, 24, 3, 8, '#f2f5ff');
      px(19, 24, 3, 8, '#f2f5ff');
      px(11, 13, 4, 1, '#7ef3ff');
      px(17, 13, 4, 1, '#7ef3ff');
      px(15, 14, 2, 1, '#7ef3ff');
      px(11, 14, 4, 2, 'rgba(126, 243, 255, 0.24)');
      px(17, 14, 4, 2, 'rgba(126, 243, 255, 0.24)');
    }
  } else if (emp.modelFamily === 'pro') {
    if (palette.gender === 'male') {
      if (palette.maleOutfitStyle !== 'tech_hoodie') {
        px(15, 23, 2, 8, '#ffd147');
      }
      px(11, 13, 4, 1, '#e6ecff');
      px(17, 13, 4, 1, '#e6ecff');
      px(15, 14, 2, 1, '#ffd147');
      px(11, 14, 4, 2, 'rgba(230, 236, 255, 0.22)');
      px(17, 14, 4, 2, 'rgba(230, 236, 255, 0.22)');
    } else {
      px(11, 13, 4, 1, '#e6ecff');
      px(17, 13, 4, 1, '#e6ecff');
      px(15, 14, 2, 1, '#ffd147');
      px(11, 14, 4, 2, 'rgba(230, 236, 255, 0.22)');
      px(17, 14, 4, 2, 'rgba(230, 236, 255, 0.22)');
    }
  } else if (emp.modelFamily === 'claude') {
    if (palette.gender === 'female') {
      px(13, 23, 6, 1, '#fff1d6');
      px(10, 4, 12, 2, '#e07a52');
      px(15, 3, 2, 1, '#fff1d6');
    } else {
      px(12, 22, 8, 2, '#fff1d6');
      px(9, 3, 14, 3, '#e07a52');
      px(15, 2, 2, 1, '#fff1d6');
    }
  } else if (emp.modelFamily === 'gpt') {
    if (palette.gender === 'female') {
      px(14, 21, 4, 2, '#0d4a46');
      px(22, 11, 2, 5, '#7efaa8');
      px(18, 17, 4, 1, '#7efaa8');
    } else {
      px(13, 21, 6, 2, '#0d4a46');
      px(23, 11, 2, 5, '#7efaa8');
      px(18, 17, 5, 1, '#7efaa8');
    }
  } else {
    if (palette.gender === 'female') {
      px(15, 24, 2, 4, '#b7c4ff');
      px(14, 28, 4, 3, '#ffd147');
    } else {
      px(15, 23, 2, 5, '#b7c4ff');
      px(14, 28, 4, 3, '#ffd147');
    }
  }
}

export function drawMascotSprite(
  ctx: CanvasRenderingContext2D,
  kind: MascotKind,
  cx: number,
  cy: number,
  zoom: number,
  facing: Facing,
  timeSec: number,
  isZoomies: boolean,
): void {
  if (kind === 'none') return;
  if (kind === 'office_dog') {
    drawOfficeDog(ctx, cx, cy, zoom, facing, timeSec, isZoomies);
    return;
  }
  const z = zoom;
  const dir = facing === 'SW' || facing === 'NW' || facing === 'W' ? -1 : 1;
  ctx.save();

  // Floor shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2 * z, 9 * z, 4 * z, 0, 0, Math.PI * 2);
  ctx.fill();

  if (kind === 'robo_vac') {
    const hover = Math.sin(timeSec * (isZoomies ? 14 : 4)) * 1 * z;
    // Cylindrical pixel robot vacuum with cyan LED ring
    ctx.fillStyle = '#252c40';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2 * z + hover, 9 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a5780';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 4 * z + hover, 8 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isZoomies ? '#ffd147' : '#3cd8ff';
    ctx.fillRect(Math.round(cx - 3 * z), Math.round(cy - 5 * z + hover), Math.ceil(6 * z), Math.ceil(2 * z));
    // Clean sparkle
    if (Math.sin(timeSec * 6) > 0.2) {
      ctx.fillStyle = '#9ee8ff';
      ctx.fillRect(Math.round(cx + 8 * z), Math.round(cy - 10 * z), Math.ceil(2 * z), Math.ceil(2 * z));
    }
  } else {
    const isTuxedo = kind === 'tuxedo_cat';
    const bodyCol = isTuxedo ? '#1d2230' : '#d9843b';
    const accentCol = isTuxedo ? '#f4f6fc' : '#f2b16d';
    const hop = isZoomies ? Math.abs(Math.sin(timeSec * 14)) * 4 * z : 0;
    const baseY = cy - hop;

    // Animated swaying tail
    const tailWag = Math.sin(timeSec * (isZoomies ? 12 : 4)) * 3 * z;
    ctx.strokeStyle = bodyCol;
    ctx.lineWidth = Math.max(2, 2.5 * z);
    ctx.beginPath();
    ctx.moveTo(cx - dir * 5 * z, baseY - 6 * z);
    ctx.lineTo(cx - dir * 10 * z, baseY - 12 * z + tailWag);
    ctx.stroke();

    // Cat body
    ctx.fillStyle = bodyCol;
    ctx.fillRect(Math.round(cx - 6 * z), Math.round(baseY - 10 * z), Math.ceil(12 * z), Math.ceil(8 * z));
    ctx.fillStyle = accentCol;
    ctx.fillRect(Math.round(cx - 2 * z), Math.round(baseY - 7 * z), Math.ceil(5 * z), Math.ceil(4 * z));

    // Cat head + pointed ears
    const headX = cx + dir * 3 * z;
    ctx.fillStyle = bodyCol;
    ctx.fillRect(Math.round(headX - 5 * z), Math.round(baseY - 17 * z), Math.ceil(10 * z), Math.ceil(8 * z));
    ctx.fillRect(Math.round(headX - 5 * z), Math.round(baseY - 20 * z), Math.ceil(3 * z), Math.ceil(3 * z));
    ctx.fillRect(Math.round(headX + 2 * z), Math.round(baseY - 20 * z), Math.ceil(3 * z), Math.ceil(3 * z));

    // Eyes
    ctx.fillStyle = '#3be87a';
    ctx.fillRect(Math.round(headX - 3 * z), Math.round(baseY - 14 * z), Math.ceil(2 * z), Math.ceil(2 * z));
    ctx.fillRect(Math.round(headX + 1 * z), Math.round(baseY - 14 * z), Math.ceil(2 * z), Math.ceil(2 * z));

    // Sparkle ♥ or ★
    ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Silkscreen", monospace`;
    ctx.fillStyle = isZoomies ? '#ffd147' : '#ff7eb9';
    ctx.textAlign = 'center';
    ctx.fillText(isZoomies ? '★' : '♥', headX, baseY - 23 * z);
  }

  ctx.restore();
}
