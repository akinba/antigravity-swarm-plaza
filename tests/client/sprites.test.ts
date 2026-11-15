import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawEmployeePortrait,
  drawEmployeeSprite,
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
  drawChairForegroundBackrest,
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
  stats: { saves: number; restores: number; drawOps: number };
} {
  const rects: RecordedRect[] = [];
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
    },
    stroke: () => {
      stats.drawOps += 1;
    },
    clearRect: noop,
    strokeRect: () => {
      stats.drawOps += 1;
    },
    fillText: () => {
      stats.drawOps += 1;
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
});
