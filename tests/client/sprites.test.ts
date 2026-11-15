import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawEmployeePortrait,
  drawEmployeeSprite,
  drawFurniture,
  getEmployeePalette,
  hashString,
  type FemaleHairStyle,
  type FemaleOutfitStyle,
  type MaleFacialHair,
  type MaleHairStyle,
  type MaleOutfitStyle,
} from '../../src/client/engine/pixelSprites';
import type { Facing } from '../../src/client/engine/pathfinding';
import {
  UPHOLSTERY_COLOR_THEMES,
  drawCardGameTableOverlay,
  drawChairForegroundBackrest,
  drawDeskVerifiedTrophy,
  drawEnhancedFurniture,
  drawErgonomicOfficeChair,
  type ChairVariant,
  type FurnitureKind,
} from '../../src/client/engine/officePropsSprites';
import type { FloorEventKind, ModelFamily, OfficeEmployee } from '../../src/shared/types';

interface RecordedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fillStyle: string;
}

function createMockCanvasContext(): {
  ctx: CanvasRenderingContext2D;
  rects: RecordedRect[];
  fills: string[];
  texts: string[];
  stats: { saves: number; restores: number; drawOps: number };
} {
  const rects: RecordedRect[] = [];
  const fills: string[] = [];
  const texts: string[] = [];
  const stats = { saves: 0, restores: 0, drawOps: 0 };
  const noop = () => {};
  const mock = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '10px monospace',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    save: () => {
      stats.saves += 1;
    },
    restore: () => {
      stats.restores += 1;
    },
    beginPath: noop,
    closePath: noop,
    clip: noop,
    translate: noop,
    transform: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    ellipse: noop,
    arc: noop,
    fill: () => {
      stats.drawOps += 1;
      fills.push(String(mock.fillStyle));
    },
    stroke: () => {
      stats.drawOps += 1;
    },
    clearRect: noop,
    strokeRect: () => {
      stats.drawOps += 1;
    },
    fillText: (text: string) => {
      stats.drawOps += 1;
      texts.push(String(text));
    },
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillRect: (x: number, y: number, w: number, h: number) => {
      stats.drawOps += 1;
      rects.push({ x, y, w, h, fillStyle: String(mock.fillStyle) });
    },
  };
  return {
    ctx: mock as unknown as CanvasRenderingContext2D,
    rects,
    fills,
    texts,
    stats,
  };
}

function makeEmployee(
  id: string,
  modelFamily: ModelFamily,
  activity: OfficeEmployee['activity'],
  gender?: 'female' | 'male',
): OfficeEmployee {
  return {
    id,
    name: `agent-${id}`,
    roleTitle: 'Engineer',
    isCoordinator: modelFamily === 'argon',
    modelId: `gemini-${modelFamily}`,
    modelFamily,
    workspaceMode: 'inherit',
    status: activity === 'sleeping' ? 'waiting' : 'working',
    zone: 'DESK_CODING',
    activity,
    xp: 250,
    level: 2,
    stepCount: 10,
    inputTokens: 1000,
    cacheReadTokens: 800,
    outputTokens: 200,
    lastActiveAt: '2026-11-13T18:00:00.000Z',
    ...(gender ? { gender } : {}),
  } as OfficeEmployee;
}

describe('pixelSprites gender, hair, outfit palettes & rendering', () => {
  it('getEmployeePalette is deterministic and respects genderOverride', () => {
    const a = getEmployeePalette('17dca7fe-c7fc-4789-ba4a-b7bf0f8a0fdf');
    const b = getEmployeePalette('17dca7fe-c7fc-4789-ba4a-b7bf0f8a0fdf');
    assert.deepEqual(a, b);

    const forcedFemale = getEmployeePalette('fixed-seed-01', 'female');
    const forcedMale = getEmployeePalette('fixed-seed-01', 'male');
    assert.equal(forcedFemale.gender, 'female');
    assert.equal(forcedMale.gender, 'male');
    assert.equal(forcedFemale.skin, forcedMale.skin);
    assert.equal(forcedFemale.hair, forcedMale.hair);
  });

  it('distributes gender (40%-60%) and covers all hair & outfit styles across 200 UUIDs', () => {
    let femaleCount = 0;
    const femaleHairs = new Set<FemaleHairStyle>();
    const maleHairs = new Set<MaleHairStyle>();
    const femaleOutfits = new Set<FemaleOutfitStyle>();
    const maleOutfits = new Set<MaleOutfitStyle>();
    const maleFacialHairs = new Set<MaleFacialHair>();
    const maleOutfitCounts = new Map<MaleOutfitStyle, number>();
    const maleFacialCounts = new Map<MaleFacialHair, number>();

    for (let i = 0; i < 200; i++) {
      const uuid = `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
      const p = getEmployeePalette(uuid);
      if (p.gender === 'female') {
        femaleCount += 1;
        femaleHairs.add(p.femaleHairStyle);
        femaleOutfits.add(p.femaleOutfit);
      } else {
        maleHairs.add(p.maleHairStyle);
        maleOutfits.add(p.maleOutfitStyle);
        maleFacialHairs.add(p.maleFacialHair);
        maleOutfitCounts.set(p.maleOutfitStyle, (maleOutfitCounts.get(p.maleOutfitStyle) ?? 0) + 1);
        maleFacialCounts.set(p.maleFacialHair, (maleFacialCounts.get(p.maleFacialHair) ?? 0) + 1);
      }
    }

    const femaleRatio = femaleCount / 200;
    assert.ok(
      femaleRatio >= 0.4 && femaleRatio <= 0.6,
      `Expected female ratio in [0.4, 0.6], got ${femaleRatio}`,
    );
    assert.deepEqual(
      [...femaleHairs].sort(),
      ['bob_cut', 'bun_updo', 'long_locks', 'ponytail'],
    );
    assert.deepEqual(
      [...maleHairs].sort(),
      ['curly_top', 'short_crop', 'side_part', 'spiky'],
    );
    assert.deepEqual([...femaleOutfits].sort(), ['skirt_blazer', 'tailored_suit']);
    assert.deepEqual([...maleOutfits].sort(), ['classic_suit', 'tech_hoodie', 'vest_ensemble']);
    assert.deepEqual([...maleFacialHairs].sort(), ['clean', 'light_stubble']);
    for (const style of ['classic_suit', 'tech_hoodie', 'vest_ensemble'] as const) {
      assert.ok((maleOutfitCounts.get(style) ?? 0) >= 1, `Missing maleOutfitStyle ${style}`);
    }
    for (const facial of ['clean', 'light_stubble'] as const) {
      assert.ok((maleFacialCounts.get(facial) ?? 0) >= 1, `Missing maleFacialHair ${facial}`);
    }
  });

  it('renders drawEmployeeSprite and drawEmployeePortrait with positive fillRect dimensions and graceful female proportions', () => {
    const zooms = [0.75, 1.0, 1.5, 2.0];
    const families: ModelFamily[] = [
      'argon',
      'hydrogen',
      'flash',
      'carbon',
      'pro',
      'claude',
      'gpt',
      'other',
    ];
    const poses: Array<{ activity: OfficeEmployee['activity']; isWalking: boolean }> = [
      { activity: 'coding', isWalking: false },
      { activity: 'coffee', isWalking: true },
      { activity: 'presenting', isWalking: false },
      { activity: 'sleeping', isWalking: false },
    ];

    // Cover all 8 (4 female hairstyles x 2 outfits) + all 4 male hairstyles
    const sampleIds: string[] = [];
    const seenFemaleCombo = new Set<string>();
    const seenMaleHair = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const uuid = `a1b2c3d4-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
      const p = getEmployeePalette(uuid);
      if (p.gender === 'female') {
        const key = `${p.femaleHairStyle}:${p.femaleOutfit}`;
        if (!seenFemaleCombo.has(key)) {
          seenFemaleCombo.add(key);
          sampleIds.push(uuid);
        }
      } else if (!seenMaleHair.has(p.maleHairStyle)) {
        seenMaleHair.add(p.maleHairStyle);
        sampleIds.push(uuid);
      }
    }
    assert.equal(seenFemaleCombo.size, 8);
    assert.equal(seenMaleHair.size, 4);

    for (const id of sampleIds) {
      for (const family of families) {
        for (const pose of poses) {
          for (const zoom of zooms) {
            const { ctx, rects } = createMockCanvasContext();
            const emp = makeEmployee(id, family, pose.activity);
            drawEmployeeSprite(
              ctx,
              emp,
              200,
              200,
              zoom,
              pose.isWalking ? 'SW' : 'SE',
              pose.isWalking,
              0.35,
              1.5,
              false,
              false,
              1,
              false,
            );
            assert.ok(rects.length > 0);
            for (const r of rects) {
              assert.ok(
                Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
                `Invalid sprite fillRect at zoom=${zoom}, family=${family}: ${JSON.stringify(r)}`,
              );
            }
          }
        }

        const { ctx: pCtx, rects: pRects } = createMockCanvasContext();
        const emp = makeEmployee(id, family, 'coding');
        drawEmployeePortrait(pCtx, emp, 96);
        assert.ok(pRects.length > 0);
        for (const r of pRects) {
          assert.ok(
            Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
            `Invalid portrait fillRect for family=${family}: ${JSON.stringify(r)}`,
          );
        }
      }
    }

    // Verify female shoulder/torso span is strictly slimmer than male in both 2.5D sprite & 32x32 portrait
    const bobId = sampleIds.find((id) => {
      const p = getEmployeePalette(id);
      return p.gender === 'female' && p.femaleHairStyle === 'bob_cut';
    })!;
    const { ctx: fSprCtx, rects: fSprRects } = createMockCanvasContext();
    const { ctx: mSprCtx, rects: mSprRects } = createMockCanvasContext();
    drawEmployeeSprite(
      fSprCtx,
      makeEmployee(bobId, 'pro', 'presenting', 'female'),
      200,
      200,
      1,
      'SE',
      false,
      0,
      0,
      false,
      false,
      1,
      false,
    );
    drawEmployeeSprite(
      mSprCtx,
      makeEmployee(bobId, 'pro', 'presenting', 'male'),
      200,
      200,
      1,
      'SE',
      false,
      0,
      0,
      false,
      false,
      1,
      false,
    );
    // Torso/arm band around y in [180..190] (baseY=200 -> baseY-20..baseY-10)
    const bandSpan = (rs: RecordedRect[]) => {
      const torsoBand = rs.filter((r) => r.y >= 180 && r.y <= 188 && r.w <= 20);
      const minX = Math.min(...torsoBand.map((r) => r.x));
      const maxX = Math.max(...torsoBand.map((r) => r.x + r.w));
      return maxX - minX;
    };
    assert.ok(
      bandSpan(fSprRects) < bandSpan(mSprRects),
      `Expected female torso/arm span (${bandSpan(fSprRects)}) < male (${bandSpan(mSprRects)})`,
    );

    const { ctx: fPortCtx, rects: fPortRects } = createMockCanvasContext();
    const { ctx: mPortCtx, rects: mPortRects } = createMockCanvasContext();
    drawEmployeePortrait(fPortCtx, makeEmployee(bobId, 'pro', 'coding', 'female'), 32);
    drawEmployeePortrait(mPortCtx, makeEmployee(bobId, 'pro', 'coding', 'male'), 32);
    // Exclude full-bleed 32px portrait background rects
    const shoulderWidth = (rs: RecordedRect[]) =>
      Math.max(...rs.filter((r) => r.w < 32 && r.y >= 21).map((r) => r.w));
    assert.ok(
      shoulderWidth(fPortRects) < shoulderWidth(mPortRects),
      `Expected female portrait shoulder width (${shoulderWidth(fPortRects)}) < male (${shoulderWidth(mPortRects)})`,
    );
  });

  it('renders STAR_WARS_PARTY, SUPERHERO_PARTY, and HALLOWEEN_PARTY across all 4 variants with positive fillRects', () => {
    const costumeEvents: FloorEventKind[] = [
      'STAR_WARS_PARTY',
      'SUPERHERO_PARTY',
      'HALLOWEEN_PARTY',
    ];
    const zooms = [0.75, 1.0, 2.0];
    const genders: Array<'female' | 'male'> = ['female', 'male'];

    // Pick 4 IDs covering costume variants 0, 1, 2, 3
    const variantIds = new Map<number, string>();
    for (let i = 0; i < 200 && variantIds.size < 4; i++) {
      const id = `costume-agent-${i}`;
      const variant = (hashString(id) >>> 12) & 3;
      if (!variantIds.has(variant)) variantIds.set(variant, id);
    }
    assert.equal(variantIds.size, 4);

    for (const eventKind of costumeEvents) {
      for (const [, id] of variantIds) {
        for (const gender of genders) {
          const emp = makeEmployee(id, 'flash', 'coding', gender);
          for (const zoom of zooms) {
            const { ctx, rects } = createMockCanvasContext();
            drawEmployeeSprite(ctx, emp, 180, 180, zoom, 'SE', false, 0, 1.2, false, false, 1, false, eventKind);
            assert.ok(rects.length > 0);
            for (const r of rects) {
              assert.ok(
                Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
                `Invalid costume sprite fillRect (${eventKind}, ${gender}, zoom=${zoom}): ${JSON.stringify(r)}`,
              );
            }
          }

          const { ctx: pCtx, rects: pRects } = createMockCanvasContext();
          drawEmployeePortrait(pCtx, emp, 96, eventKind);
          assert.ok(pRects.length > 0);
          for (const r of pRects) {
            assert.ok(
              Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
              `Invalid costume portrait fillRect (${eventKind}, ${gender}): ${JSON.stringify(r)}`,
            );
          }
        }
      }
    }
  });

  it('renders true 8-directional employee sprites (S, SE, E, NE, N, NW, W, SW) across poses with distinct front/side/back anatomy', () => {
    const allFacings: Facing[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
    const families: ModelFamily[] = [
      'argon',
      'hydrogen',
      'flash',
      'carbon',
      'pro',
      'claude',
      'gpt',
      'other',
    ];
    const zooms = [0.75, 1.0, 2.0];

    for (const gender of ['female', 'male'] as const) {
      for (const family of families) {
        for (const facing of allFacings) {
          for (const scenario of [
            { activity: 'meeting' as const, zone: 'WAR_ROOM' as const, walking: false, seated: true },
            { activity: 'coding' as const, zone: 'DESK_CODING' as const, walking: false, seated: true },
            { activity: 'coffee' as const, zone: 'COFFEE_LOUNGE' as const, walking: true, seated: false },
            { activity: 'terminal' as const, zone: 'SERVER_RACK' as const, walking: false, seated: false },
          ]) {
            for (const zoom of zooms) {
              const { ctx, rects } = createMockCanvasContext();
              const emp = {
                ...makeEmployee(`8dir-${gender}-${family}`, family, scenario.activity, gender),
                zone: scenario.zone,
              };
              drawEmployeeSprite(
                ctx,
                emp,
                200,
                200,
                zoom,
                facing,
                scenario.walking,
                0.3,
                1.25,
                false,
                false,
                1,
                false,
                null,
                scenario.seated,
              );
              assert.ok(rects.length > 15, `Expected rich rect count for ${gender}/${family}/${facing}`);
              for (const r of rects) {
                assert.ok(
                  Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
                  `Invalid 8-dir rect (${gender}, ${family}, ${facing}, zoom=${zoom}): ${JSON.stringify(r)}`,
                );
              }
            }
          }
        }
      }
    }

    // Anatomical verification:
    // 1. Pure North ('N') must NOT draw front rose-coral lips (#e56b88) or front yellow flash visor (#ffe64d),
    //    whereas South ('S') and East ('E') MUST draw them!
    const femFlash = makeEmployee('anat-fem-flash', 'flash', 'meeting', 'female');
    const runFacing = (f: Facing, empObj = femFlash) => {
      const { ctx, rects } = createMockCanvasContext();
      drawEmployeeSprite(ctx, empObj, 200, 200, 1, f, false, 0, 1, false, false, 1, false, null, true);
      return rects;
    };
    const southRects = runFacing('S');
    const eastRects = runFacing('E');
    const northRects = runFacing('N');

    assert.ok(southRects.some((r) => r.fillStyle === '#e56b88'), 'Expected lips on S view');
    assert.ok(eastRects.some((r) => r.fillStyle === '#e56b88'), 'Expected profile lips on E view');
    assert.ok(!northRects.some((r) => r.fillStyle === '#e56b88'), 'Pure N back view must have zero lips');
    assert.ok(southRects.some((r) => r.fillStyle === '#ffe64d'), 'Expected yellow visor lens on S view');
    assert.ok(eastRects.some((r) => r.fillStyle === '#ffe64d'), 'Expected side-wrap visor on E view');
    assert.ok(!northRects.some((r) => r.fillStyle === '#ffe64d'), 'Pure N back view must show strap, not front visor');

    // 2. Standing side profile ('E') torso/shoulder span is slimmer than front ('S') span
    const standMale = makeEmployee('anat-male-pro', 'pro', 'presenting', 'male');
    const { ctx: mSouthCtx, rects: mSouthRects } = createMockCanvasContext();
    const { ctx: mEastCtx, rects: mEastRects } = createMockCanvasContext();
    drawEmployeeSprite(mSouthCtx, standMale, 200, 200, 1, 'S', false, 0, 0, false, false, 1, false, null, false);
    drawEmployeeSprite(mEastCtx, standMale, 200, 200, 1, 'E', false, 0, 0, false, false, 1, false, null, false);
    const chestSpan = (rs: RecordedRect[]) => {
      const band = rs.filter((r) => r.y >= 180 && r.y <= 188 && r.w <= 20);
      return Math.max(...band.map((r) => r.x + r.w)) - Math.min(...band.map((r) => r.x));
    };
    assert.ok(
      chestSpan(mEastRects) < chestSpan(mSouthRects),
      `Expected E lateral profile torso span (${chestSpan(mEastRects)}) < S front span (${chestSpan(mSouthRects)})`,
    );
  });

  it('renders 8-directional ergonomic chairs and 2-pass foreground backrests with balanced save/restore', () => {
    const allFacings: Facing[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
    const variants: ChairVariant[] = ['task', 'meeting', 'exec', 'gaming'];

    for (const variant of variants) {
      for (const facing of allFacings) {
        const { ctx, stats } = createMockCanvasContext();
        drawErgonomicOfficeChair(ctx, 200, 200, 1.5, variant, facing, '#3cd8ff');
        assert.equal(stats.saves, stats.restores, `Unbalanced save/restore for chair ${variant}/${facing}`);
        assert.ok(stats.drawOps > 8, `Expected chair draw ops for ${variant}/${facing}`);

        const { ctx: fgCtx, stats: fgStats } = createMockCanvasContext();
        drawChairForegroundBackrest(fgCtx, 200, 200, 1.5, variant, facing, '#3cd8ff');
        assert.equal(
          fgStats.saves,
          fgStats.restores,
          `Unbalanced save/restore for foreground backrest ${variant}/${facing}`,
        );
        if (facing === 'S' || facing === 'SE' || facing === 'SW') {
          assert.equal(
            fgStats.drawOps,
            0,
            `Expected foreground backrest to be a no-op on ${facing}, got ${fgStats.drawOps}`,
          );
        } else {
          assert.ok(
            fgStats.drawOps > 0,
            `Expected foreground backrest geometry on ${facing} for ${variant}`,
          );
        }
      }
    }
  });

  it('renders all 5 architectural conference tables (oval, round, rect, u, s) and treats war_table_part as a balanced no-op', () => {
    const tableKinds: FurnitureKind[] = [
      'war_table',
      'war_table_oval',
      'war_table_round',
      'war_table_rect',
      'war_table_u',
      'war_table_s',
    ];

    for (const kind of tableKinds) {
      for (const zoom of [0.75, 1.0, 2.0]) {
        const { ctx, stats } = createMockCanvasContext();
        drawEnhancedFurniture(ctx, kind, 300, 240, zoom, 1.8, true);
        assert.equal(stats.saves, stats.restores, `Unbalanced save/restore for ${kind} at zoom=${zoom}`);
        assert.ok(stats.drawOps > 25, `Expected rich architectural geometry for ${kind}, got ${stats.drawOps}`);
      }
    }

    const { ctx: partCtx, stats: partStats } = createMockCanvasContext();
    drawEnhancedFurniture(partCtx, 'war_table_part', 300, 240, 1.5, 1.0, true);
    assert.equal(partStats.saves, partStats.restores, 'Unbalanced save/restore for war_table_part');
    assert.equal(partStats.drawOps, 0, 'war_table_part must draw zero primitives');
  });

  it('renders 4-way rotated workstations (dev_desk, clover_desk, qa_desk, exec_desk), directional armchairs, and exec_coffee_table cleanly across zoom/level/night', () => {
    const deskFacings: Facing[] = ['NE', 'NW', 'SE', 'SW'];
    const rotatedKinds: FurnitureKind[] = [
      'desk',
      'dev_desk',
      'clover_desk',
      'qa_desk',
      'exec_desk',
      'armchair',
    ];

    for (const kind of rotatedKinds) {
      const centersByFacing = new Map<Facing, { meanX: number; meanY: number }>();

      for (const facing of deskFacings) {
        for (const night of [false, true]) {
          for (const level of [1, 5, 8]) {
            for (const zoom of [0.75, 1.0, 2.0]) {
              const { ctx, rects, stats } = createMockCanvasContext();
              drawEnhancedFurniture(
                ctx,
                kind,
                300,
                240,
                zoom,
                1.6,
                night,
                true,
                kind === 'exec_desk' ? 'argon' : 'pro',
                false,
                'SWARM BOARD',
                level,
                facing,
              );
              assert.equal(
                stats.saves,
                stats.restores,
                `Unbalanced save/restore for ${kind}/${facing}/lv${level}/zoom${zoom}`,
              );
              assert.ok(
                stats.drawOps > 12,
                `Expected rich 2.5D geometry for ${kind}/${facing}, got ${stats.drawOps}`,
              );
              for (const r of rects) {
                assert.ok(
                  Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
                  `Invalid fillRect in ${kind}/${facing}/lv${level}/zoom${zoom}: ${JSON.stringify(r)}`,
                );
              }

              if (!night && level === 8 && zoom === 1.0 && rects.length > 0) {
                const meanX = rects.reduce((s, r) => s + r.x + r.w * 0.5, 0) / rects.length;
                const meanY = rects.reduce((s, r) => s + r.y + r.h * 0.5, 0) / rects.length;
                centersByFacing.set(facing, { meanX, meanY });
              }
            }
          }
        }
      }

      // Verify that opposite rotations (e.g. NE vs SW, SE vs NW) produce genuinely rotated geometry
      const cNE = centersByFacing.get('NE')!;
      const cSW = centersByFacing.get('SW')!;
      const cSE = centersByFacing.get('SE')!;
      const cNW = centersByFacing.get('NW')!;
      assert.ok(
        Math.hypot(cNE.meanX - cSW.meanX, cNE.meanY - cSW.meanY) > 0.5,
        `Expected rotated centroid difference between NE and SW for ${kind}`,
      );
      assert.ok(
        Math.hypot(cSE.meanX - cNW.meanX, cSE.meanY - cNW.meanY) > 0.5,
        `Expected rotated centroid difference between SE and NW for ${kind}`,
      );
    }

    // Executive marble/brass coffee table + rotated verified trophy + fallback drawFurniture
    for (const night of [false, true]) {
      const { ctx, rects, stats } = createMockCanvasContext();
      drawEnhancedFurniture(ctx, 'exec_coffee_table', 300, 240, 2.0, 1.4, night, true);
      assert.equal(stats.saves, stats.restores);
      assert.ok(stats.drawOps > 14);
      for (const r of rects) {
        assert.ok(r.w > 0 && r.h > 0);
      }
    }

    const trophyXs = new Set<number>();
    for (const facing of deskFacings) {
      const { ctx, rects, stats } = createMockCanvasContext();
      drawDeskVerifiedTrophy(ctx, 300, 240, 2.0, 1.2, facing);
      assert.equal(stats.saves, stats.restores);
      assert.ok(rects.length >= 6);
      trophyXs.add(Math.round(rects[0].x));
      for (const r of rects) {
        assert.ok(r.w > 0 && r.h > 0);
      }
    }
    assert.ok(trophyXs.size >= 2, 'Expected verified desk trophy position to rotate with desk facing');

    for (const fallbackKind of ['clover_desk', 'exec_coffee_table'] as const) {
      const { ctx, rects, stats } = createMockCanvasContext();
      drawFurniture(ctx, fallbackKind, 200, 200, 1.5, 1.0, true, false, 'SWARM BOARD', 5);
      assert.equal(stats.saves, stats.restores);
      assert.ok(rects.length > 0);
    }
  });

  it('renders drawCardGameTableOverlay, 8-directional card_game handheld cards, and standingGuest Boss Suite posture', () => {
    const allFacings: Facing[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
    const zooms = [0.75, 1.0, 2.0];

    // 1. Tabletop overlay across 5-arg default + War Room + Coffee Lounge table variants
    for (const tableKind of [undefined, 'war_table_oval', 'lounge_table'] as const) {
      for (const zoom of zooms) {
        for (const timeSec of [0.2, 1.45, 3.1]) {
          const { ctx, rects, stats } = createMockCanvasContext();
          drawCardGameTableOverlay(ctx, 280, 220, zoom, timeSec, tableKind);
          assert.equal(
            stats.saves,
            stats.restores,
            `Unbalanced save/restore for drawCardGameTableOverlay (${String(tableKind)}, zoom=${zoom})`,
          );
          assert.ok(stats.drawOps >= 25, `Expected rich card game table geometry, got ${stats.drawOps}`);
          assert.ok(
            rects.some((r) => r.fillStyle === '#fffdf7'),
            'Expected ivory playing card faces on card game table overlay',
          );
          assert.ok(
            rects.some((r) => r.fillStyle === '#c92a3e'),
            'Expected crimson deck card backs on card game table overlay',
          );
          for (const r of rects) {
            assert.ok(
              Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
              `Invalid fillRect in drawCardGameTableOverlay: ${JSON.stringify(r)}`,
            );
          }
        }
      }
    }

    // 2. 8-directional card_game employee sprites (seated & standing, female & male)
    for (const gender of ['female', 'male'] as const) {
      for (const facing of allFacings) {
        for (const zoom of zooms) {
          const { ctx, rects, stats } = createMockCanvasContext();
          const cardPlayer: OfficeEmployee = {
            ...makeEmployee(`card-${gender}-${facing}`, 'pro', 'card_game', gender),
            zone: 'WAR_ROOM',
          };
          drawEmployeeSprite(
            ctx,
            cardPlayer,
            200,
            200,
            zoom,
            facing,
            false,
            0,
            1.6,
            false,
            false,
            1,
            false,
            'CARD_GAME',
          );
          assert.equal(stats.saves, stats.restores);
          assert.ok(
            rects.some((r) => r.fillStyle === '#fffdf7'),
            `Expected handheld card ivory rect for ${gender}/${facing}`,
          );
          for (const r of rects) {
            assert.ok(
              Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
              `Invalid card_game sprite rect (${gender}/${facing}/zoom=${zoom}): ${JSON.stringify(r)}`,
            );
          }
        }
      }
    }

    // 3. Standing overflow Boss Suite guest (standingGuest: true) stands upright vs seated armchair guest
    const seatedGuest: OfficeEmployee = {
      ...makeEmployee('boss-guest-1', 'claude', 'meeting', 'female'),
      zone: 'DESK_ARCHITECT',
      standingGuest: false,
    };
    const standingGuest: OfficeEmployee = {
      ...makeEmployee('boss-guest-3', 'claude', 'meeting', 'female'),
      zone: 'DESK_ARCHITECT',
      standingGuest: true,
    };
    const { ctx: seatCtx, rects: seatRects } = createMockCanvasContext();
    const { ctx: standCtx, rects: standRects } = createMockCanvasContext();
    // Even if caller omits isSeatedOverride (or passes true), standingGuest: true forces standing posture
    drawEmployeeSprite(seatCtx, seatedGuest, 200, 200, 1.5, 'NW', false, 0, 1.0, false, false, 1, false);
    drawEmployeeSprite(standCtx, standingGuest, 200, 200, 1.5, 'NW', false, 0, 1.0, false, false, 1, false, null, true);

    const lowestShoeY = (rs: RecordedRect[]) => Math.max(...rs.map((r) => r.y + r.h));
    assert.ok(
      lowestShoeY(standRects) > lowestShoeY(seatRects) + 4,
      `Expected standingGuest shoes (${lowestShoeY(standRects)}) to plant on floor below seated armchair lap (${lowestShoeY(seatRects)})`,
    );
  });

  it('switches office desk lamps (dev_desk, clover_desk, qa_desk, exec_desk) and lounge_lamp OFF by day and ON with warm glow at night', () => {
    const deskFacings: Facing[] = ['NE', 'NW', 'SE', 'SW'];
    const deskKinds: FurnitureKind[] = ['dev_desk', 'clover_desk', 'qa_desk', 'exec_desk'];
    const zooms = [0.75, 1.0, 2.0];

    // 1. All 4 rotated desk types: unlit by day, warm glowing bulb (#fff8cc / #fff7bd) by night
    for (const kind of deskKinds) {
      for (const facing of deskFacings) {
        for (const zoom of zooms) {
          const { ctx: dayCtx, rects: dayRects, stats: dayStats } = createMockCanvasContext();
          const { ctx: nightCtx, rects: nightRects, stats: nightStats } = createMockCanvasContext();

          drawEnhancedFurniture(ctxWithMock(dayCtx), kind, 300, 240, zoom, 1.5, false, true, 'pro', false, '', 1, facing);
          drawEnhancedFurniture(ctxWithMock(nightCtx), kind, 300, 240, zoom, 1.5, true, true, 'pro', false, '', 1, facing);

          assert.equal(dayStats.saves, dayStats.restores);
          assert.equal(nightStats.saves, nightStats.restores);

          const bulbCol = kind === 'exec_desk' ? '#fff7bd' : '#fff8cc';
          assert.ok(
            !dayRects.some((r) => r.fillStyle === bulbCol),
            `Expected ${kind}/${facing} desk lamp bulb (${bulbCol}) to be OFF in daytime`,
          );
          assert.ok(
            nightRects.some((r) => r.fillStyle === bulbCol),
            `Expected ${kind}/${facing} desk lamp bulb (${bulbCol}) to be ON at night`,
          );
          assert.ok(
            nightStats.drawOps > dayStats.drawOps,
            `Expected ${kind}/${facing} to emit extra warm light-cone/pool drawOps at night (${nightStats.drawOps} vs ${dayStats.drawOps})`,
          );
          for (const r of [...dayRects, ...nightRects]) {
            assert.ok(r.w > 0 && r.h > 0 && Number.isFinite(r.x) && Number.isFinite(r.y));
          }
        }
      }
    }

    // 2. Lounge floor lamp ('lounge_lamp'): cream unlit linen shade by day, warm illuminated bulb/shade at night
    for (const zoom of zooms) {
      const { ctx: dayCtx, rects: dayRects, stats: dayStats } = createMockCanvasContext();
      const { ctx: nightCtx, rects: nightRects, stats: nightStats } = createMockCanvasContext();

      drawEnhancedFurniture(dayCtx, 'lounge_lamp', 280, 240, zoom, 1.2, false, false);
      drawEnhancedFurniture(nightCtx, 'lounge_lamp', 280, 240, zoom, 1.2, true, false);

      assert.equal(dayStats.saves, dayStats.restores);
      assert.equal(nightStats.saves, nightStats.restores);
      assert.ok(
        !dayRects.some((r) => r.fillStyle === '#fffbe0' || r.fillStyle === '#fff6c7'),
        'Expected lounge_lamp bulb/aperture glow to be OFF in daytime',
      );
      assert.ok(
        nightRects.some((r) => r.fillStyle === '#fffbe0') &&
          nightRects.some((r) => r.fillStyle === '#fff6c7'),
        'Expected lounge_lamp warm bulb & top aperture glow to be ON at night',
      );
      assert.ok(
        nightStats.drawOps > dayStats.drawOps,
        `Expected lounge_lamp night glow cones/halos (${nightStats.drawOps} > ${dayStats.drawOps})`,
      );
      for (const r of [...dayRects, ...nightRects]) {
        assert.ok(r.w > 0 && r.h > 0 && Number.isFinite(r.x) && Number.isFinite(r.y));
      }
    }

    // 3. Fallback drawFurniture supports lounge_lamp cleanly
    const { ctx: fbCtx, rects: fbRects, stats: fbStats } = createMockCanvasContext();
    drawFurniture(fbCtx, 'lounge_lamp', 200, 200, 1.5, 1.0, false, false, 'SWARM BOARD', 1);
    assert.equal(fbStats.saves, fbStats.restores);
    assert.ok(fbRects.length >= 2 && fbStats.drawOps >= 5);
  });

  it('renders modular 2-seater (sofa_l + sofa_r) and 3-seater (sofa_l + sofa_m + sofa_r) sofas across 4 facings and all 6 upholstery color themes', () => {
    assert.equal(UPHOLSTERY_COLOR_THEMES.length, 6);
    const sofaFacings: Facing[] = ['NE', 'NW', 'SE', 'SW'];
    const sofaKinds: FurnitureKind[] = ['sofa_l', 'sofa_m', 'sofa_r', 'sofa'];
    const zooms = [0.75, 1.0, 2.0];

    // 1. All 4 sofa module kinds across 4 facings and zoom levels have balanced save/restore and armless mid module
    for (const facing of sofaFacings) {
      for (const zoom of zooms) {
        const opsByKind = new Map<FurnitureKind, number>();
        for (const kind of sofaKinds) {
          const { ctx, rects, fills, stats } = createMockCanvasContext();
          drawEnhancedFurniture(ctx, kind, 300, 240, zoom, 1.2, false, false, 'pro', false, '', 1, facing, 0);
          assert.equal(stats.saves, stats.restores);
          assert.ok(stats.drawOps >= 10, `Expected rich 2.5D drawOps for ${kind}/${facing}`);
          assert.ok(!fills.includes('#cc4b5e'), 'Legacy broken pink sofa box color must not be used');
          for (const r of rects) {
            assert.ok(r.w > 0 && r.h > 0 && Number.isFinite(r.x) && Number.isFinite(r.y));
          }
          opsByKind.set(kind, stats.drawOps);
        }
        // Armless middle segment (sofa_m) omits outer armrest slab (and corner throw pillow on NE/NW)
        assert.ok(
          (opsByKind.get('sofa_m') ?? 0) < (opsByKind.get('sofa_l') ?? 0) &&
            (opsByKind.get('sofa_m') ?? 0) < (opsByKind.get('sofa_r') ?? 0),
          `Expected armless sofa_m (${opsByKind.get('sofa_m')}) to emit fewer drawOps than outer-armrest sofa_l (${opsByKind.get('sofa_l')}) / sofa_r (${opsByKind.get('sofa_r')}) on ${facing}`,
        );
      }
    }

    // 2. All 6 upholstery color indices (0..5) produce distinct seat & bolster colors on both sofas and lounge armchairs
    const seenSofaSeatTops = new Set<string>();
    const seenArmchairSeatTops = new Set<string>();
    for (let colorIdx = 0; colorIdx < 6; colorIdx++) {
      const expectedSeatTop = UPHOLSTERY_COLOR_THEMES[colorIdx].seat.top;
      const expectedBolsterTop = UPHOLSTERY_COLOR_THEMES[colorIdx].bolster.top;

      const { ctx: sCtx, fills: sFills } = createMockCanvasContext();
      drawEnhancedFurniture(sCtx, 'sofa_l', 300, 240, 1.5, 1.0, false, false, 'pro', false, '', 1, 'NE', colorIdx);
      assert.ok(sFills.includes(expectedSeatTop), `Expected sofa_l colorIndex=${colorIdx} to fill seat ${expectedSeatTop}`);
      assert.ok(sFills.includes(expectedBolsterTop), `Expected sofa_l colorIndex=${colorIdx} to fill bolster ${expectedBolsterTop}`);
      seenSofaSeatTops.add(expectedSeatTop);

      const { ctx: aCtx, fills: aFills } = createMockCanvasContext();
      drawEnhancedFurniture(aCtx, 'armchair', 300, 240, 1.5, 1.0, false, false, 'pro', false, '', 1, 'SE', colorIdx);
      assert.ok(aFills.includes(expectedSeatTop), `Expected armchair colorIndex=${colorIdx} to fill seat ${expectedSeatTop}`);
      seenArmchairSeatTops.add(expectedSeatTop);
    }
    assert.equal(seenSofaSeatTops.size, 6);
    assert.equal(seenArmchairSeatTops.size, 6);

    // 3. Armchair with undefined colorIndex preserves classic Boss Suite berry leather (#c75472)
    const { ctx: bossArmCtx, fills: bossArmFills } = createMockCanvasContext();
    drawEnhancedFurniture(bossArmCtx, 'armchair', 300, 240, 1.5, 1.0, false, false, 'pro', false, '', 1, 'NW', undefined);
    assert.ok(bossArmFills.includes('#c75472'), 'Expected Boss Suite armchair (colorIndex=undefined) to preserve classic berry leather');

    // 4. Fallback drawFurniture supports sofa_l, sofa_m, sofa_r, and sofa with armless sofa_m
    const fbOps = new Map<string, number>();
    for (const kind of ['sofa_l', 'sofa_m', 'sofa_r', 'sofa']) {
      const { ctx: fCtx, stats: fStats } = createMockCanvasContext();
      drawFurniture(fCtx, kind, 200, 200, 1.5, 1.0, false, false, 'SWARM BOARD', 1);
      assert.equal(fStats.saves, fStats.restores);
      fbOps.set(kind, fStats.drawOps);
    }
    assert.ok((fbOps.get('sofa_m') ?? 0) < (fbOps.get('sofa_l') ?? 0));
    assert.ok((fbOps.get('sofa_m') ?? 0) < (fbOps.get('sofa_r') ?? 0));
  });

  it('renders modernized 2.5D props (3d_printer, snack_vending, arcade_cabinet, bookshelf, library_table) and 8-directional arcade, vending, and book-reading break poses without Zzz', () => {
    // 1. Modernized 2.5D props across SW/SE facings, occupied/idle states, and zoom levels
    const propKinds: FurnitureKind[] = [
      '3d_printer',
      'snack_vending',
      'arcade_cabinet',
      'bookshelf',
      'library_table',
      'prop_arcade',
      'coffee_machine',
      'water_cooler',
      'prop_hologram',
    ];
    for (const kind of propKinds) {
      for (const facing of ['SW', 'SE', 'NE'] as const) {
        for (const isOccupied of [false, true]) {
          const { ctx, rects, fills, stats } = createMockCanvasContext();
          drawEnhancedFurniture(ctx, kind, 320, 260, 2.0, 1.4, true, isOccupied, 'pro', false, '', 1, facing);
          assert.equal(stats.saves, stats.restores, `Unbalanced save/restore for ${kind}`);
          assert.ok(fills.length >= 12, `Expected rich 2.5D isometric polygon planes for ${kind}, got ${fills.length}`);
          assert.ok(rects.length > 0, `Expected positive crisp pixel details for ${kind}`);
          assert.ok(
            rects.every((r) => r.w >= 1 && r.h >= 1),
            `Sub-pixel rect found in ${kind}`,
          );
        }
      }
    }

    // Verify signature material accents on CoreXY 3D printer, snack vending display, arcade cabinet, and walnut bookshelf
    const { ctx: prnCtx, fills: prnFills } = createMockCanvasContext();
    drawEnhancedFurniture(prnCtx, '3d_printer', 300, 250, 2.0, 1.2, false, true, 'pro', false, '', 1, 'SW');
    assert.ok(prnFills.includes('#d49b35'), 'Expected 3d_printer gold PEI build plate');
    assert.ok(prnFills.includes('#ffa45c'), 'Expected 3d_printer top PLA filament spool');

    const { ctx: vndCtx, fills: vndFills } = createMockCanvasContext();
    drawEnhancedFurniture(vndCtx, 'snack_vending', 300, 250, 2.0, 1.2, false, true, 'pro', false, '', 1, 'SW');
    assert.ok(vndFills.includes('#e63946') && vndFills.includes('#00b4d8'), 'Expected recognizable soda cans inside snack_vending');

    const { ctx: bksCtx, fills: bksFills } = createMockCanvasContext();
    drawEnhancedFurniture(bksCtx, 'bookshelf', 300, 250, 2.0, 1.2, false, false, 'pro', false, '', 1, 'SW');
    assert.ok(bksFills.includes('#f5ebd6') && bksFills.includes('#c93b4b'), 'Expected 2.5D hardcover spines & cream pages on bookshelf');

    // Verify coffee_machine bean hopper/crema, water_cooler hot/cold paddles + 19L carboy, and prop_hologram conical beam + 3D globe
    const { ctx: cofCtx, fills: cofFills } = createMockCanvasContext();
    drawEnhancedFurniture(cofCtx, 'coffee_machine', 300, 250, 2.0, 1.2, false, true, 'pro', false, '', 1, 'SW');
    assert.ok(cofFills.includes('#593219') && cofFills.includes('#c97a34'), 'Expected roasted coffee beans & espresso crema on coffee_machine');

    const { ctx: wtrCtx, fills: wtrFills } = createMockCanvasContext();
    drawEnhancedFurniture(wtrCtx, 'water_cooler', 300, 250, 2.0, 1.2, false, true, 'pro', false, '', 1, 'SW');
    assert.ok(wtrFills.includes('#ff4d5e') && wtrFills.includes('#00c8ff') && wtrFills.includes('#9ef3ff'), 'Expected hot/cold paddles & 19L water carboy on water_cooler');

    const { ctx: holCtx, fills: holFills } = createMockCanvasContext();
    drawEnhancedFurniture(holCtx, 'prop_hologram', 300, 250, 2.0, 1.2, false, true, 'pro', false, '', 1, 'SW');
    assert.ok(
      holFills.includes('rgba(0, 229, 255, 0.14)') && holFills.includes('rgba(0, 195, 255, 0.26)'),
      'Expected conical hologram beam & translucent 3D globe core on prop_hologram',
    );

    // 2. Break character poses across all 8 directions (even when status === 'waiting' on break!)
    const directions: Facing[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (const dir of directions) {
      // Standing arcade player: upright standing shoe baseline + 1UP/★ popup + NO Zzz
      const arcadeEmp: OfficeEmployee = {
        ...makeEmployee('arc-1', 'pro', 'arcade', 'male'),
        status: 'waiting',
        zone: 'COFFEE_LOUNGE',
      };
      const { ctx: arcCtx, rects: arcRects, texts: arcTexts } = createMockCanvasContext();
      drawEmployeeSprite(arcCtx, arcadeEmp, 200, 200, 2.0, dir, false, 0, 1.0, false, false);
      assert.ok(!arcTexts.includes('Zzz'), `Arcade break agent (${dir}) must not show Zzz`);
      assert.ok(arcTexts.includes('1UP') || arcTexts.includes('★'), `Expected 1UP/★ popup on arcade agent (${dir})`);
      // Standing shoes reach down to baseY (y + h === 200), unlike seated shoes which shift up
      assert.ok(
        arcRects.some((r) => r.y + r.h >= 199 && r.y <= 200),
        `Expected arcade agent (${dir}) to remain standing upright at baseY=200`,
      );

      // Standing vending drink break: upright + brushed aluminum soda can top (#e8f1ff) + fizz ✦ + NO Zzz
      const vendEmp: OfficeEmployee = {
        ...makeEmployee('vnd-2', 'flash', 'vending', 'female'),
        status: 'waiting',
        zone: 'COFFEE_LOUNGE',
      };
      const { ctx: vCtx, rects: vRects, texts: vTexts } = createMockCanvasContext();
      drawEmployeeSprite(vCtx, vendEmp, 200, 200, 2.0, dir, false, 0, 1.2, false, false);
      assert.ok(!vTexts.includes('Zzz'), `Vending break agent (${dir}) must not show Zzz`);
      assert.ok(vTexts.includes('✦'), `Expected chilled fizz sparkle ✦ on vending agent (${dir})`);
      assert.ok(
        vRects.some((r) => r.fillStyle === '#e8f1ff'),
        `Expected brushed aluminum soda can pull-tab rim (#e8f1ff) on vending agent (${dir})`,
      );

      // Seated lounge book reader: open hardcover book cream pages (#fffdf2) + literary ✦ + NO Zzz
      const readEmp: OfficeEmployee = {
        ...makeEmployee('read-3', 'argon', 'reading', 'female'),
        status: 'waiting',
        zone: 'COFFEE_LOUNGE',
      };
      const { ctx: rCtx, rects: rRects, texts: rTexts } = createMockCanvasContext();
      drawEmployeeSprite(rCtx, readEmp, 200, 200, 2.0, dir, false, 0, 1.5, false, false, 1, true, null, true);
      assert.ok(!rTexts.includes('Zzz'), `Reading armchair agent (${dir}) must not show Zzz`);
      assert.ok(rTexts.includes('✦'), `Expected literary sparkle ✦ on reading agent (${dir})`);
      assert.ok(
        rRects.some((r) => r.fillStyle === '#fffdf2'),
        `Expected open hardcover book cream pages (#fffdf2) on reading agent (${dir})`,
      );
    }
  });
});

function ctxWithMock(c: CanvasRenderingContext2D): CanvasRenderingContext2D {
  return c;
}
