import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawEmployeePortrait,
  drawEmployeeSprite,
  getEmployeePalette,
  hashString,
  type FemaleHairStyle,
  type FemaleOutfitStyle,
  type MaleHairStyle,
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

    for (let i = 0; i < 200; i++) {
      const uuid = `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
      const p = getEmployeePalette(uuid);
      if (p.gender === 'female') {
        femaleCount += 1;
        femaleHairs.add(p.femaleHairStyle);
        femaleOutfits.add(p.femaleOutfit);
      } else {
        maleHairs.add(p.maleHairStyle);
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
  });

  it('renders drawEmployeeSprite and drawEmployeePortrait with positive fillRect dimensions', () => {
    const zooms = [0.75, 1.0, 2.0];
    const families: ModelFamily[] = ['argon', 'hydrogen', 'flash', 'carbon', 'pro'];
    const poses: Array<{ activity: OfficeEmployee['activity']; isWalking: boolean }> = [
      { activity: 'coding', isWalking: false },
      { activity: 'coffee', isWalking: true },
      { activity: 'presenting', isWalking: false },
    ];

    // Find representative IDs covering all female/male styles & outfits
    const sampleIds: string[] = [];
    const seenFemaleHair = new Set<string>();
    const seenMaleHair = new Set<string>();
    const seenOutfit = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const uuid = `a1b2c3d4-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
      const p = getEmployeePalette(uuid);
      if (p.gender === 'female' && (!seenFemaleHair.has(p.femaleHairStyle) || !seenOutfit.has(p.femaleOutfit))) {
        seenFemaleHair.add(p.femaleHairStyle);
        seenOutfit.add(p.femaleOutfit);
        sampleIds.push(uuid);
      } else if (p.gender === 'male' && !seenMaleHair.has(p.maleHairStyle)) {
        seenMaleHair.add(p.maleHairStyle);
        sampleIds.push(uuid);
      }
    }

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
              'SE',
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
  });

  it('renders STAR_WARS_PARTY, SUPERHERO_PARTY, and HALLOWEEN_PARTY across all 4 variants with positive fillRects', () => {
    const costumeEvents: FloorEventKind[] = [
      'STAR_WARS_PARTY',
      'SUPERHERO_PARTY',
      'HALLOWEEN_PARTY',
    ];
    const zooms = [0.75, 1.0, 2.0];

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
        const emp = makeEmployee(id, 'flash', 'coding');
        for (const zoom of zooms) {
          const { ctx, rects } = createMockCanvasContext();
          drawEmployeeSprite(ctx, emp, 180, 180, zoom, 'SE', false, 0, 1.2, false, false, 1, false, eventKind);
          assert.ok(rects.length > 0);
          for (const r of rects) {
            assert.ok(
              Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
              `Invalid costume sprite fillRect (${eventKind}, zoom=${zoom}): ${JSON.stringify(r)}`,
            );
          }
        }

        const { ctx: pCtx, rects: pRects } = createMockCanvasContext();
        drawEmployeePortrait(pCtx, emp, 96, eventKind);
        assert.ok(pRects.length > 0);
        for (const r of pRects) {
          assert.ok(
            Number.isFinite(r.x) && Number.isFinite(r.y) && r.w > 0 && r.h > 0,
            `Invalid costume portrait fillRect (${eventKind}): ${JSON.stringify(r)}`,
          );
        }
      }
    }
  });
});
