import type { Facing } from './pathfinding';

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
  const z = zoom;

  if (kind === 'aquarium') {
    drawBox(ctx, cx, cy, 18, 9, 10, '#30384d', '#1e2433', '#131722', z);
    // Glass water tank
    const tx = cx - 15 * z;
    const ty = cy - 32 * z;
    const tw = 30 * z;
    const th = 20 * z;
    ctx.fillStyle = '#125a82';
    ctx.fillRect(Math.round(tx), Math.round(ty), Math.ceil(tw), Math.ceil(th));
    ctx.fillStyle = '#2596be';
    ctx.fillRect(Math.round(tx + 2 * z), Math.round(ty + 2 * z), Math.ceil(tw - 4 * z), Math.ceil(th - 4 * z));
    // Swimming pixel fish
    const fish1X = tx + (6 + ((Math.sin(timeSec * 1.6) * 0.5 + 0.5) * 14)) * z;
    const fish2X = tx + (20 - ((Math.cos(timeSec * 1.2) * 0.5 + 0.5) * 14)) * z;
    ctx.fillStyle = '#ff8a3d';
    ctx.fillRect(Math.round(fish1X), Math.round(ty + 7 * z), Math.ceil(5 * z), Math.ceil(3 * z));
    ctx.fillStyle = '#ffd147';
    ctx.fillRect(Math.round(fish2X), Math.round(ty + 13 * z), Math.ceil(4 * z), Math.ceil(3 * z));
    // Rising bubbles
    const bY = ty + (16 - ((timeSec * 9) % 12)) * z;
    ctx.fillStyle = '#d9f8ff';
    ctx.fillRect(Math.round(tx + 9 * z), Math.round(bY), Math.ceil(2 * z), Math.ceil(2 * z));
    ctx.fillRect(Math.round(tx + 21 * z), Math.round(bY + 2 * z), Math.ceil(2 * z), Math.ceil(2 * z));
    ctx.strokeStyle = '#0e121c';
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.strokeRect(Math.round(tx), Math.round(ty), Math.ceil(tw), Math.ceil(th));
    return true;
  }

  if (kind === 'ping_pong') {
    drawBox(ctx, cx, cy, 24, 12, 10, '#1f8a5b', '#145e3d', '#0d422b', z);
    // White court lines & net
    ctx.strokeStyle = '#f4f6fc';
    ctx.lineWidth = Math.max(1, 1.2 * z);
    ctx.beginPath();
    ctx.moveTo(cx - 12 * z, cy - 10 * z);
    ctx.lineTo(cx + 12 * z, cy - 10 * z);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(cx - 10 * z), Math.round(cy - 14 * z), Math.ceil(20 * z), Math.ceil(3 * z));
    // Bouncing ball
    const bx = cx + Math.sin(timeSec * 5) * 11 * z;
    const by = cy - 16 * z - Math.abs(Math.cos(timeSec * 5)) * 5 * z;
    ctx.fillStyle = '#ffbe3b';
    ctx.fillRect(Math.round(bx), Math.round(by), Math.ceil(3 * z), Math.ceil(3 * z));
    return true;
  }

  if (kind === 'bonsai') {
    drawBox(ctx, cx, cy, 10, 6, 6, '#3c4d6b', '#263247', '#192130', z);
    ctx.fillStyle = '#6e4228';
    ctx.fillRect(Math.round(cx - 2 * z), Math.round(cy - 18 * z), Math.ceil(4 * z), Math.ceil(11 * z));
    ctx.fillStyle = '#2fa857';
    ctx.fillRect(Math.round(cx - 9 * z), Math.round(cy - 24 * z), Math.ceil(12 * z), Math.ceil(7 * z));
    ctx.fillStyle = '#4be07a';
    ctx.fillRect(Math.round(cx - 2 * z), Math.round(cy - 29 * z), Math.ceil(11 * z), Math.ceil(6 * z));
    return true;
  }

  if (kind === 'glass_partition') {
    const px = cx - 16 * z;
    const py = cy - 28 * z;
    ctx.fillStyle = 'rgba(110, 210, 255, 0.28)';
    ctx.fillRect(Math.round(px), Math.round(py), Math.ceil(32 * z), Math.ceil(26 * z));
    ctx.strokeStyle = '#6ec8f5';
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.strokeRect(Math.round(px), Math.round(py), Math.ceil(32 * z), Math.ceil(26 * z));
    return true;
  }

  if (kind === 'wood_partition') {
    drawBox(ctx, cx, cy, 16, 4, 22, '#9c683e', '#754c2b', '#52341c', z);
    return true;
  }

  if (kind === 'elevator_doors') {
    // Brushed-steel elevator frame & animated sliding doors
    const fw = 36 * z;
    const fh = 48 * z;
    const fx = cx - fw / 2;
    const fy = cy - fh;
    ctx.fillStyle = '#4b556b';
    ctx.fillRect(Math.round(fx), Math.round(fy), Math.ceil(fw), Math.ceil(fh));
    ctx.strokeStyle = '#121622';
    ctx.lineWidth = Math.max(1.5, 2 * z);
    ctx.strokeRect(Math.round(fx), Math.round(fy), Math.ceil(fw), Math.ceil(fh));

    // Interior shaft when open
    ctx.fillStyle = '#182133';
    ctx.fillRect(Math.round(fx + 4 * z), Math.round(fy + 6 * z), Math.ceil(fw - 8 * z), Math.ceil(fh - 6 * z));

    const openPx = isOccupied ? 11 * z : 0;
    const doorW = (fw - 8 * z) / 2 - openPx;
    if (doorW > 1) {
      ctx.fillStyle = '#9aa6bd';
      ctx.fillRect(Math.round(fx + 4 * z), Math.round(fy + 6 * z), Math.ceil(doorW), Math.ceil(fh - 6 * z));
      ctx.fillRect(
        Math.round(fx + fw - 4 * z - doorW),
        Math.round(fy + 6 * z),
        Math.ceil(doorW),
        Math.ceil(fh - 6 * z),
      );
    }

    // Indicator LED above doors
    ctx.fillStyle = isOccupied ? '#3be87a' : '#ffbe3b';
    ctx.fillRect(Math.round(cx - 3 * z), Math.round(fy + 2 * z), Math.ceil(6 * z), Math.ceil(3 * z));
    return true;
  }

  return false;
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

  // Floor shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2 * z, 9 * z, 4 * z, 0, 0, Math.PI * 2);
  ctx.fill();

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
  ctx.fillRect(Math.round(cx - 7 * z), Math.round(baseY - 11 * z), Math.ceil(14 * z), Math.ceil(9 * z));
  ctx.fillStyle = '#fff3dc';
  ctx.fillRect(Math.round(cx - 3 * z), Math.round(baseY - 7 * z), Math.ceil(7 * z), Math.ceil(4 * z));

  // Head + floppy ears
  const headX = cx + dir * 4 * z;
  ctx.fillStyle = '#e08b3c';
  ctx.fillRect(Math.round(headX - 5 * z), Math.round(baseY - 19 * z), Math.ceil(10 * z), Math.ceil(9 * z));
  ctx.fillStyle = '#b5631e';
  ctx.fillRect(Math.round(headX - 5 * z), Math.round(baseY - 21 * z), Math.ceil(3 * z), Math.ceil(4 * z));
  ctx.fillRect(Math.round(headX + 2 * z), Math.round(baseY - 21 * z), Math.ceil(3 * z), Math.ceil(4 * z));

  // Nose & Eyes
  ctx.fillStyle = '#11131c';
  ctx.fillRect(Math.round(headX - 3 * z), Math.round(baseY - 16 * z), Math.ceil(2 * z), Math.ceil(2 * z));
  ctx.fillRect(Math.round(headX + 1 * z), Math.round(baseY - 16 * z), Math.ceil(2 * z), Math.ceil(2 * z));
  ctx.fillRect(Math.round(headX - 1 * z), Math.round(baseY - 13 * z), Math.ceil(2 * z), Math.ceil(2 * z));

  // Sparkle ♥ or ★
  ctx.font = `bold ${Math.max(8, Math.round(8 * z))}px "Silkscreen", monospace`;
  ctx.fillStyle = isZoomies ? '#ffd147' : '#ff7eb9';
  ctx.textAlign = 'center';
  ctx.fillText(isZoomies ? '★' : '♥', headX, baseY - 24 * z);

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
    ctx.fillRect(Math.round(mx), Math.round(my), Math.ceil(11 * z), Math.ceil(9 * z));
    ctx.fillStyle = isOccupied ? '#3cd8ff' : '#243147';
    ctx.fillRect(Math.round(mx + 2 * z), Math.round(my + 2 * z), Math.ceil(7 * z), Math.ceil(5 * z));
  } else if (kind === 'dev_desk') {
    // Subtle dual-monitor status LED bar
    ctx.fillStyle = isOccupied ? '#3be87a' : '#2a3954';
    ctx.fillRect(Math.round(cx - 13 * z), Math.round(cy - 24 * z), Math.ceil(6 * z), Math.ceil(1 * z));
    ctx.fillRect(Math.round(cx + 7 * z), Math.round(cy - 24 * z), Math.ceil(6 * z), Math.ceil(1 * z));
  }

  // Lv5+: Mini desk plant (left corner) & steaming mug (right corner)
  if (level >= 5) {
    // Mini pot + succulent
    ctx.fillStyle = '#a65c3a';
    ctx.fillRect(Math.round(cx - 19 * z), Math.round(cy - 13 * z), Math.ceil(5 * z), Math.ceil(4 * z));
    ctx.fillStyle = '#3be87a';
    ctx.fillRect(Math.round(cx - 20 * z), Math.round(cy - 17 * z), Math.ceil(7 * z), Math.ceil(4 * z));
    ctx.fillStyle = '#7efaa8';
    ctx.fillRect(Math.round(cx - 18 * z), Math.round(cy - 19 * z), Math.ceil(3 * z), Math.ceil(2 * z));

    // Coffee mug + animated steam
    ctx.fillStyle = '#f4f6fc';
    ctx.fillRect(Math.round(cx + 12 * z), Math.round(cy - 13 * z), Math.ceil(4 * z), Math.ceil(4 * z));
    ctx.fillStyle = '#73381d';
    ctx.fillRect(Math.round(cx + 13 * z), Math.round(cy - 13 * z), Math.ceil(2 * z), Math.ceil(1 * z));
    const steamY = cy - (15 + ((timeSec * 4) % 4)) * z;
    ctx.fillStyle = 'rgba(220, 240, 255, 0.7)';
    ctx.fillRect(Math.round(cx + 13 * z), Math.round(steamY), Math.ceil(2 * z), Math.ceil(2 * z));
  }

  // Lv8+: Gold mechanical keyboard & golden trophy
  if (level >= 8) {
    const shimmer = Math.sin(timeSec * 4) > 0.3 ? '#fff3a1' : '#ffd147';
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(Math.round(cx - 7 * z), Math.round(cy - 10 * z), Math.ceil(10 * z), Math.ceil(3 * z));
    ctx.fillStyle = shimmer;
    ctx.fillRect(Math.round(cx - 6 * z), Math.round(cy - 9 * z), Math.ceil(8 * z), Math.ceil(1 * z));

    // Golden trophy on desk corner
    ctx.fillStyle = '#8c6211';
    ctx.fillRect(Math.round(cx + 15 * z), Math.round(cy - 11 * z), Math.ceil(4 * z), Math.ceil(2 * z));
    ctx.fillStyle = '#ffd147';
    ctx.fillRect(Math.round(cx + 16 * z), Math.round(cy - 15 * z), Math.ceil(2 * z), Math.ceil(4 * z));
    ctx.fillRect(Math.round(cx + 14 * z), Math.round(cy - 18 * z), Math.ceil(6 * z), Math.ceil(3 * z));
    ctx.fillStyle = shimmer;
    ctx.fillRect(Math.round(cx + 15 * z), Math.round(cy - 18 * z), Math.ceil(2 * z), Math.ceil(2 * z));
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
  ctx.fillRect(Math.round(bx), Math.round(by), Math.ceil(size), Math.ceil(size));
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1, z);
  ctx.strokeRect(Math.round(bx), Math.round(by), Math.ceil(size), Math.ceil(size));

  // Tiny pointer tail
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(cx - 1.5 * z), Math.round(by + size), Math.ceil(3 * z), Math.ceil(2 * z));

  const ix = bx + 3 * z;
  const iy = by + 3 * z;
  ctx.fillStyle = accent;

  if (kind === 'reading') {
    // Open book icon
    ctx.fillRect(Math.round(ix), Math.round(iy + 1 * z), Math.ceil(4 * z), Math.ceil(7 * z));
    ctx.fillRect(Math.round(ix + 5 * z), Math.round(iy + 1 * z), Math.ceil(4 * z), Math.ceil(7 * z));
    ctx.fillStyle = '#0d101c';
    ctx.fillRect(Math.round(ix + 1 * z), Math.round(iy + 3 * z), Math.ceil(2 * z), Math.ceil(1 * z));
    ctx.fillRect(Math.round(ix + 6 * z), Math.round(iy + 3 * z), Math.ceil(2 * z), Math.ceil(1 * z));
  } else if (kind === 'writing') {
    // Pixel pencil / edit icon
    ctx.fillRect(Math.round(ix + 6 * z), Math.round(iy), Math.ceil(3 * z), Math.ceil(3 * z));
    ctx.fillRect(Math.round(ix + 3 * z), Math.round(iy + 3 * z), Math.ceil(3 * z), Math.ceil(3 * z));
    ctx.fillRect(Math.round(ix), Math.round(iy + 6 * z), Math.ceil(3 * z), Math.ceil(3 * z));
    ctx.fillStyle = '#ffd147';
    ctx.fillRect(Math.round(ix), Math.round(iy + 7 * z), Math.ceil(2 * z), Math.ceil(2 * z));
  } else if (kind === 'testing') {
    // Flask / beaker icon
    ctx.fillRect(Math.round(ix + 3 * z), Math.round(iy), Math.ceil(3 * z), Math.ceil(3 * z));
    ctx.fillRect(Math.round(ix + 1 * z), Math.round(iy + 3 * z), Math.ceil(7 * z), Math.ceil(5 * z));
    ctx.fillStyle = '#3be87a';
    ctx.fillRect(Math.round(ix + 2 * z), Math.round(iy + 5 * z), Math.ceil(5 * z), Math.ceil(2 * z));
  } else if (kind === 'searching') {
    // Magnifying glass icon
    ctx.fillRect(Math.round(ix + 1 * z), Math.round(iy), Math.ceil(5 * z), Math.ceil(5 * z));
    ctx.fillStyle = '#0d101c';
    ctx.fillRect(Math.round(ix + 2 * z), Math.round(iy + 1 * z), Math.ceil(3 * z), Math.ceil(3 * z));
    ctx.fillStyle = accent;
    ctx.fillRect(Math.round(ix + 5 * z), Math.round(iy + 5 * z), Math.ceil(3 * z), Math.ceil(3 * z));
  } else {
    // Error exclamation
    ctx.fillRect(Math.round(ix + 3.5 * z), Math.round(iy), Math.ceil(2 * z), Math.ceil(5 * z));
    ctx.fillRect(Math.round(ix + 3.5 * z), Math.round(iy + 7 * z), Math.ceil(2 * z), Math.ceil(2 * z));
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
    // Landing pulse ring
    const ringT = (progress - 0.85) / 0.15;
    ctx.strokeStyle = color;
    ctx.globalAlpha = Math.max(0, 1 - ringT);
    ctx.lineWidth = Math.max(1.5, 2 * z);
    ctx.beginPath();
    ctx.ellipse(x, y, (8 + ringT * 14) * z, (4 + ringT * 7) * z, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Pixel envelope body
  const ew = 12 * z;
  const eh = 8 * z;
  const ex = x - ew / 2;
  const ey = y - eh / 2;

  ctx.fillStyle = '#fffdf2';
  ctx.fillRect(Math.round(ex), Math.round(ey), Math.ceil(ew), Math.ceil(eh));
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1.2 * z);
  ctx.strokeRect(Math.round(ex), Math.round(ey), Math.ceil(ew), Math.ceil(eh));

  // Envelope V-flap
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(x, ey + eh * 0.55);
  ctx.lineTo(ex + ew, ey);
  ctx.strokeStyle = '#141824';
  ctx.lineWidth = Math.max(1, z);
  ctx.stroke();

  // Sparkle pixel
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - 1 * z), Math.round(ey - 4 * z), Math.ceil(2 * z), Math.ceil(2 * z));

  ctx.restore();
}
