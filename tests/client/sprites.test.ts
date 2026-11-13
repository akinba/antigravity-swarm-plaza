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
import type { FloorEventKind, ModelFamily, OfficeEmployee } from '../../src/shared/types';

interface RecordedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function createMockCanvasContext(): {
  ctx: CanvasRenderingContext2D;
  rects: RecordedRect[];
} {
  const rects: RecordedRect[] = [];
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
    save: noop,
    restore: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    ellipse: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    clearRect: noop,
    strokeRect: noop,
    fillText: noop,
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillRect: (x: number, y: number, w: number, h: number) => {
      rects.push({ x, y, w, h });
    },
  };
  return {
    ctx: mock as unknown as CanvasRenderingContext2D,
    rects,
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
});
