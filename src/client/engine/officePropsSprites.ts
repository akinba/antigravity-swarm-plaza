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

  if (kind === 'glass_partition' || kind === 'glass_partition_x') {
    // Thin 2.5D isometric glass wall panel (Y-axis: NE<->SW, X-axis: NW<->SE)
    const isX = kind === 'glass_partition_x';
    const x1 = isX ? cx - 18 * z : cx + 18 * z;
    const y1 = cy - 9 * z;
    const x2 = isX ? cx + 18 * z : cx - 18 * z;
    const y2 = cy + 9 * z;
    const wallH = 30 * z;

    // Aluminum floor track
    ctx.strokeStyle = '#4d5d7a';
    ctx.lineWidth = Math.max(2, 3 * z);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Translucent glass pane
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 - wallH);
    ctx.lineTo(x1, y1 - wallH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(130, 222, 255, 0.34)';
    ctx.fill();

    // Aluminum frame (posts + top rail)
    ctx.strokeStyle = '#7cd7ff';
    ctx.lineWidth = Math.max(1.2, 1.8 * z);
    ctx.stroke();

    // Center mullion & diagonal specular reflection
    ctx.strokeStyle = 'rgba(210, 245, 255, 0.75)';
    ctx.lineWidth = Math.max(1, 1.2 * z);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - wallH);
    ctx.moveTo(cx - 10 * z, cy - 6 * z);
    ctx.lineTo(cx - 2 * z, cy - 22 * z);
    ctx.moveTo(cx + 4 * z, cy - 11 * z);
    ctx.lineTo(cx + 10 * z, cy - 24 * z);
    ctx.stroke();
    return true;
  }

  if (kind === 'wood_partition' || kind === 'wood_partition_x') {
    // Thin 2.5D isometric wood-slat acoustic partition wall
    const isX = kind === 'wood_partition_x';
    const x1 = isX ? cx - 18 * z : cx + 18 * z;
    const y1 = cy - 9 * z;
    const x2 = isX ? cx + 18 * z : cx - 18 * z;
    const y2 = cy + 9 * z;
    const wallH = 26 * z;

    // Dark aluminum floor track
    ctx.strokeStyle = '#1f2536';
    ctx.lineWidth = Math.max(2, 3 * z);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Warm wood panel face
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 - wallH);
    ctx.lineTo(x1, y1 - wallH);
    ctx.closePath();
    ctx.fillStyle = isX ? '#7c512f' : '#94623a';
    ctx.fill();

    // Vertical acoustic wood slats
    ctx.strokeStyle = '#52341c';
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

    // Aluminum frame posts & top rail
    ctx.strokeStyle = '#2c3347';
    ctx.lineWidth = Math.max(1.2, 1.8 * z);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1, y1 - wallH);
    ctx.lineTo(x2, y2 - wallH);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    return true;
  }

  if (kind === 'elevator_doors') {
    // 2.5D isometric brushed-steel elevator portal flush against the left back wall (gx = 0, slope -2:1)
    // Wall base line for tile (0, 6) passes through top vertex (cx, cy - 16*z) and left vertex (cx - 32*z, cy).
    const w1x = cx + 4 * z;
    const w1y = cy - 18 * z;
    const w2x = cx - 36 * z;
    const w2y = cy + 2 * z;
    // Slight 3D frame protrusion into the room (+X iso direction: +2:+1)
    const dx = 4 * z;
    const dy = 2 * z;
    const p1x = w1x + dx;
    const p1y = w1y + dy;
    const p2x = w2x + dx;
    const p2y = w2y + dy;
    const fh = 52 * z;

    const fillIsoQuad = (u1: number, u2: number, hBot: number, hTop: number, fill: string, stroke?: string) => {
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

    // 1. 3D top & right-side depth bevels connecting frame back to the wall face
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

    // 2. Main brushed-steel outer portal frame
    fillIsoQuad(0, 1, 0, fh, '#4b556b', '#121622');

    // 3. Recessed dark elevator shaft interior (u: 0.10..0.90, h: 2*z..41*z)
    fillIsoQuad(0.1, 0.9, 2 * z, 41 * z, '#141c2e', '#0d121f');
    // Warm ceiling glow & guide rail inside shaft when doors open
    if (isOccupied) {
      fillIsoQuad(0.14, 0.86, 37 * z, 40.5 * z, 'rgba(255, 230, 140, 0.45)');
      fillIsoQuad(0.48, 0.52, 3 * z, 37 * z, '#25324d');
    }

    // 4. Animated sliding steel doors along the 2:1 isometric wall axis
    const openU = isOccupied ? 0.28 : 0;
    const panelSpan = 0.4 - openU;
    if (panelSpan > 0.03) {
      // Upper-right sliding door leaf
      fillIsoQuad(0.1, 0.1 + panelSpan, 2 * z, 41 * z, '#9aa6bd', '#1b2233');
      fillIsoQuad(0.13, 0.1 + panelSpan * 0.55, 5 * z, 38 * z, '#b4c0d9');
      // Lower-left sliding door leaf
      fillIsoQuad(0.9 - panelSpan, 0.9, 2 * z, 41 * z, '#8c98b0', '#1b2233');
      fillIsoQuad(0.9 - panelSpan * 0.65, 0.87, 5 * z, 38 * z, '#a6b3cc');
    }

    // 5. Transom header panel & isometric LED status indicator above doors
    fillIsoQuad(0.12, 0.88, 43 * z, 49 * z, '#1e2536', '#121622');
    const ledColor = isOccupied ? '#3be87a' : '#ffbe3b';
    fillIsoQuad(0.38, 0.62, 44.5 * z, 47.5 * z, ledColor);

    // 6. Stainless steel threshold sill
    fillIsoQuad(0, 1, 0, 2.2 * z, '#7c8aa6', '#121622');
    return true;
  }

  if (kind === 'phone_booth') {
    // Acoustic oak floor plinth & outer wood call-pod shell
    drawBox(ctx, cx, cy, 17, 10, 3, '#7a4e2d', '#59371e', '#3d2412', z);
    drawBox(ctx, cx - 1 * z, cy - 3 * z, 15, 9, 34, '#a86f40', '#82532d', '#5c391d', z);

    // Recessed acoustic felt interior + warm amber ceiling wash
    const rx = cx - 8 * z;
    const ry = cy - 33 * z;
    const rw = 16 * z;
    const rh = 28 * z;
    ctx.fillStyle = '#362822';
    pxRect(ctx, rx, ry, rw, rh);

    const glowAlpha = (0.32 + 0.06 * Math.sin(timeSec * 2.2)).toFixed(3);
    ctx.fillStyle = `rgba(255, 198, 92, ${glowAlpha})`;
    pxRect(ctx, rx + 1 * z, ry + 1 * z, rw - 2 * z, rh - 2 * z);

    // Vertical acoustic felt ribs along interior back wall
    ctx.fillStyle = '#6e4b33';
    for (let i = 0; i < 3; i++) {
      pxRect(ctx, cx - (5 - i * 4) * z, cy - 29 * z, 2 * z, 15 * z);
    }

    // Floating warm wood call shelf & ceiling LED light bar
    ctx.fillStyle = '#cf8e55';
    pxRect(ctx, cx - 6 * z, cy - 15 * z, 12 * z, 2.5 * z);
    ctx.fillStyle = '#8f5c30';
    pxRect(ctx, cx - 6 * z, cy - 12.5 * z, 12 * z, 1.5 * z);
    ctx.fillStyle = '#fff0a8';
    pxRect(ctx, cx - 5 * z, cy - 32 * z, 10 * z, 2 * z);

    // Crisp translucent glass door pane + specular reflections + aluminum frame
    ctx.fillStyle = 'rgba(140, 226, 255, 0.28)';
    pxRect(ctx, rx, ry, rw, rh);

    ctx.strokeStyle = 'rgba(225, 248, 255, 0.7)';
    ctx.lineWidth = Math.max(1, 1.1 * z);
    ctx.beginPath();
    ctx.moveTo(cx - 5 * z, cy - 10 * z);
    ctx.lineTo(cx + 2 * z, cy - 28 * z);
    ctx.moveTo(cx, cy - 9 * z);
    ctx.lineTo(cx + 5 * z, cy - 21 * z);
    ctx.stroke();

    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth = Math.max(1, 1.6 * z);
    pxStrokeRect(ctx, rx, ry, rw, rh);

    // Brushed steel door handle
    ctx.fillStyle = '#d8e3f5';
    pxRect(ctx, cx + 4.2 * z, cy - 21 * z, 1.8 * z, 7 * z);

    // Roof ventilation cap & occupancy LED
    drawBox(ctx, cx - 1 * z, cy - 37 * z, 16, 9.5, 3, '#3c465e', '#262d3d', '#181d29', z);
    ctx.fillStyle = isOccupied ? '#ff5666' : '#3be87a';
    pxRect(ctx, cx - 2 * z, cy - 38 * z, 4 * z, 1.8 * z);
    return true;
  }

  if (kind === 'snack_vending') {
    // Retro-modern illuminated vending cabinet
    drawBox(ctx, cx, cy, 16, 10, 36, '#394666', '#263047', '#181f30', z);

    // Glowing marquee header
    ctx.fillStyle = '#121726';
    pxRect(ctx, cx - 11 * z, cy - 34 * z, 22 * z, 5 * z);
    ctx.fillStyle = '#ff6b4a';
    pxRect(ctx, cx - 10 * z, cy - 33 * z, 20 * z, 3 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx - 8 * z, cy - 32.5 * z, 5 * z, 2 * z);
    ctx.fillStyle = '#fff5d6';
    pxRect(ctx, cx - 1 * z, cy - 32.5 * z, 7 * z, 2 * z);

    // Illuminated glass display window with 3 rows of colorful pixel cans/snacks
    const wx = cx - 11 * z;
    const wy = cy - 28 * z;
    const ww = 15 * z;
    const wh = 18 * z;
    ctx.fillStyle = '#162942';
    pxRect(ctx, wx, wy, ww, wh);
    ctx.fillStyle = '#223d61';
    pxRect(ctx, wx + 1 * z, wy + 1 * z, ww - 2 * z, wh - 2 * z);

    const snackColors = ['#ff5666', '#3cd8ff', '#ffd147', '#3be87a', '#b07cff', '#ff8a3d'];
    for (let row = 0; row < 3; row++) {
      const sy = cy - (26.5 - row * 5.3) * z;
      for (let col = 0; col < 4; col++) {
        ctx.fillStyle = snackColors[(row * 2 + col) % snackColors.length];
        pxRect(ctx, cx - (9.5 - col * 3.1) * z, sy, 2.2 * z, 3.4 * z);
      }
      ctx.fillStyle = '#7c8dab';
      pxRect(ctx, cx - 10 * z, sy + 3.4 * z, 13 * z, 1.2 * z);
    }

    ctx.strokeStyle = '#7cd7ff';
    ctx.lineWidth = Math.max(1, 1.2 * z);
    pxStrokeRect(ctx, wx, wy, ww, wh);

    // Right-side card reader & keypad column
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

    // Recessed bottom dispenser tray
    ctx.fillStyle = '#0d111c';
    pxRect(ctx, cx - 10 * z, cy - 8.5 * z, 16 * z, 5 * z);
    ctx.fillStyle = '#6f7f9e';
    pxRect(ctx, cx - 9 * z, cy - 8 * z, 14 * z, 1.5 * z);
    return true;
  }

  if (kind === 'arcade_cabinet') {
    // Lower arcade cabinet body + coin door
    drawBox(ctx, cx, cy, 15, 10, 17, '#3d2970', '#291b4d', '#1b1133', z);
    ctx.fillStyle = '#ff4d94';
    pxRect(ctx, cx - 11.5 * z, cy - 13 * z, 2 * z, 9 * z);
    ctx.fillStyle = '#121624';
    pxRect(ctx, cx - 4 * z, cy - 11 * z, 8 * z, 7 * z);
    ctx.fillStyle = '#ff7b3b';
    pxRect(ctx, cx - 2.5 * z, cy - 9 * z, 1.8 * z, 2.5 * z);
    pxRect(ctx, cx + 0.8 * z, cy - 9 * z, 1.8 * z, 2.5 * z);

    // Upper CRT monitor housing & glowing retro marquee banner
    drawBox(ctx, cx - 1 * z, cy - 17 * z, 14, 9, 17, '#4e358c', '#352363', '#221642', z);
    ctx.fillStyle = '#ff3d7f';
    pxRect(ctx, cx - 10 * z, cy - 35 * z, 18 * z, 4 * z);
    ctx.fillStyle = '#ffe14d';
    pxRect(ctx, cx - 7 * z, cy - 34 * z, 12 * z, 2 * z);

    // CRT bezel + animated phosphor screen glow
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.5);
    ctx.fillStyle = `rgba(60, 216, 255, ${(0.15 + pulse * 0.14).toFixed(3)})`;
    pxRect(ctx, cx - 10 * z, cy - 31 * z, 18 * z, 13 * z);
    ctx.fillStyle = '#0e1220';
    pxRect(ctx, cx - 9 * z, cy - 30 * z, 16 * z, 11 * z);
    ctx.fillStyle = pulse > 0.5 ? '#193a69' : '#132c52';
    pxRect(ctx, cx - 7.5 * z, cy - 28.5 * z, 13 * z, 8 * z);

    // Animated retro pixel starfighter & laser bolt
    const shipX = cx + (-5.5 + (Math.sin(timeSec * 3.8) * 0.5 + 0.5) * 7.5) * z;
    const laserY = cy - (23.5 + ((timeSec * 9) % 4)) * z;
    ctx.fillStyle = '#ff5666';
    pxRect(ctx, cx - 2.5 * z, cy - 27.2 * z, 3 * z, 2 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, shipX + 1 * z, laserY, 1.5 * z, 2 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, shipX, cy - 22.5 * z, 3.5 * z, 2 * z);

    // Angled control deck with joystick & colored arcade buttons
    drawBox(ctx, cx + 1.5 * z, cy - 16 * z, 13, 8, 3, '#253359', '#192340', '#10172b', z);
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
    // Cozy walnut reading table base & wide tabletop
    drawBox(ctx, cx, cy, 14, 8, 6, '#5e3b22', '#452a17', '#2e1b0e', z);
    drawBox(ctx, cx, cy - 6 * z, 21, 11, 4, '#a66d3f', '#7d502c', '#59371d', z);

    // Stacked colorful pixel books on left
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, cx - 12 * z, cy - 13 * z, 8 * z, 2.2 * z);
    ctx.fillStyle = '#f7f2e4';
    pxRect(ctx, cx - 11 * z, cy - 12.5 * z, 6 * z, 1.2 * z);
    ctx.fillStyle = '#ff5666';
    pxRect(ctx, cx - 11.5 * z, cy - 15.2 * z, 7.5 * z, 2.2 * z);
    ctx.fillStyle = '#ffd147';
    pxRect(ctx, cx - 11 * z, cy - 17.2 * z, 6.5 * z, 2 * z);

    // Open reading book in center
    ctx.fillStyle = '#6b3fa0';
    pxRect(ctx, cx - 3 * z, cy - 12 * z, 8 * z, 3.5 * z);
    ctx.fillStyle = '#fffdf2';
    pxRect(ctx, cx - 2.3 * z, cy - 11.5 * z, 3 * z, 2.5 * z);
    pxRect(ctx, cx + 1.2 * z, cy - 11.5 * z, 3 * z, 2.5 * z);

    // Ceramic coffee mug + gentle pixel steam
    ctx.fillStyle = '#f4f6fc';
    pxRect(ctx, cx + 7 * z, cy - 13.5 * z, 3.8 * z, 3.8 * z);
    ctx.fillStyle = '#6e381d';
    pxRect(ctx, cx + 7.8 * z, cy - 13.5 * z, 2.2 * z, 1.2 * z);
    const steamY = cy - (15.5 + ((timeSec * 3.2) % 3.5)) * z;
    ctx.fillStyle = 'rgba(230, 244, 255, 0.65)';
    pxRect(ctx, cx + 8.2 * z, steamY, 1.6 * z, 1.8 * z);

    // Classic brass & emerald-green shaded banker lamp + warm reading glow
    ctx.fillStyle = 'rgba(255, 230, 138, 0.34)';
    pxRect(ctx, cx + 1 * z, cy - 15 * z, 9 * z, 4 * z);
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
    // Maker-lab workbench pedestal + status LEDs
    drawBox(ctx, cx, cy, 16, 10, 12, '#364057', '#242b3b', '#171c28', z);
    ctx.fillStyle = '#192030';
    pxRect(ctx, cx - 8 * z, cy - 8 * z, 7 * z, 4 * z);
    ctx.fillStyle = '#3be87a';
    pxRect(ctx, cx - 7 * z, cy - 6.5 * z, 2 * z, 1.5 * z);
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, cx - 4 * z, cy - 6.5 * z, 2 * z, 1.5 * z);

    // Heated build bed & translucent holo-chamber
    drawBox(ctx, cx, cy - 12 * z, 13, 8, 3, '#53627d', '#3a4559', '#272f3d', z);
    ctx.fillStyle = '#3cd8ff';
    pxRect(ctx, cx - 6.5 * z, cy - 16.5 * z, 13 * z, 1.8 * z);
    ctx.fillStyle = 'rgba(84, 214, 255, 0.16)';
    pxRect(ctx, cx - 9 * z, cy - 31 * z, 18 * z, 15 * z);

    // Mini geometric holo-cube print inside chamber
    drawBox(ctx, cx, cy - 16 * z, 4.5, 3, 5.5, '#7ef3ff', '#3cd8ff', '#1e8eb8', z);

    // Metallic gantry pillars, top bridge & filament spool
    ctx.fillStyle = '#8b9bb8';
    pxRect(ctx, cx - 9.5 * z, cy - 32 * z, 2.2 * z, 16.5 * z);
    pxRect(ctx, cx + 7.3 * z, cy - 32 * z, 2.2 * z, 16.5 * z);
    ctx.fillStyle = '#6c7b96';
    pxRect(ctx, cx - 10 * z, cy - 33.5 * z, 20 * z, 2.5 * z);
    ctx.fillStyle = '#ff853d';
    pxRect(ctx, cx - 3 * z, cy - 38 * z, 6 * z, 4.5 * z);
    ctx.fillStyle = '#1a2030';
    pxRect(ctx, cx - 1.5 * z, cy - 36.8 * z, 3 * z, 2 * z);

    // Animated X-axis crossbar, extruder carriage & print glow
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
