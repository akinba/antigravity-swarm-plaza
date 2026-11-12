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
