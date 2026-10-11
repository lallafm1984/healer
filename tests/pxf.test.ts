/** PXF 공방 이펙트 시험 (Lim 2026-10-11): 사제 치유가 들어가면 치유 초록 반짝이 가루 (src/art/pxf/heal-dust.pxf.json) */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { landedPxf, PXF, pxfDrawSize, pxfFrame, pxfMs, SKILL_PXF } from '../src/battle/pxf';
import * as E from '../src/engine';

const graph = (name: string) => JSON.parse(readFileSync(new URL(`../src/art/pxf/${name}.pxf.json`, import.meta.url), 'utf8'));
/** PNG 머리 (IHDR)의 가로 · 세로 */
const pngSize = (art: string) => {
  const b = readFileSync(new URL(`../src/art/${art}.png`, import.meta.url));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

describe('PXF 이펙트', () => {
  it('게임 값이 그래프의 settings · game 블록과 같고, 프레임 띠가 프레임 수만큼 이어져 있음', () => {
    const g = graph('heal-dust'), c = PXF.healDust;
    expect(g.format).toBe('pxf.graph@1');
    expect({ size: c.size, frames: c.frames, fps: c.fps }).toEqual({ size: g.settings.size, frames: g.settings.frames, fps: g.settings.fps });
    expect({ impactFrame: c.impactFrame, logicalSize: c.logicalSize, referenceCell: c.referenceCell })
      .toEqual({ impactFrame: g.game.impactFrame, logicalSize: g.game.logicalSize, referenceCell: g.game.referenceCell });
    expect([g.game.blend, c.blend]).toEqual(['add', 'normal']); // Lim 2026-10-11: 원본 색이 잘 보이게 보통 섞기
    expect(g.game.pivot).toEqual([0.5, 0.5]); // 칸 가운데에 그림
    expect(pngSize(c.art)).toEqual({ w: c.size * c.frames, h: c.size });
  });

  it('치유가 들어간 순간이 맞는 프레임, 끝까지 재생하고 사라짐', () => {
    const c = PXF.healDust;
    expect(pxfFrame(c, 0)).toBe(2);
    expect(pxfFrame(c, 1000 / 24)).toBe(3);
    expect(pxfFrame(c, pxfMs(c) - 1)).toBe(23);
    expect(pxfFrame(c, pxfMs(c))).toBe(-1);
    expect(pxfMs(c)).toBeCloseTo((22 * 1000) / 24);
    expect(pxfDrawSize(c, 62)).toBe(64);
  });

  it('사제 치유만 PXF 이펙트를 씀 (시험)', () => {
    expect(SKILL_PXF).toEqual({ heal: 'healDust' });
  });

  it('치유 시전이 끝까지 들어간 틱에만 그 대상으로 잡히고, 같은 틱에 그 대상의 치유 사건이 있음', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7 });
    const tank = f.party.find(u => u.role === 'tank')!;
    tank.hp = tank.max * 0.5;
    expect(E.use(f, 'heal', tank.cell).ok).toBe(true);
    const hits: { t: number; landed: ReturnType<typeof landedPxf>; healed: boolean }[] = [];
    for (let i = 0; i < 400 && hits.length === 0; i++) {
      const before = f.cast;
      f.events.length = 0;
      E.step(f);
      const landed = landedPxf(before, f.cast);
      if (landed) hits.push({ t: f.t, landed, healed: f.events.some(e => e.type === 'heal' && e.id === tank.id) });
    }
    expect(hits).toHaveLength(1);
    expect(hits[0].landed).toEqual({ key: 'healDust', uid: tank.id });
    expect(hits[0].healed).toBe(true);
  });

  it('취소한 시전 · 다른 스킬은 안 잡힘', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7 });
    const [a, b] = f.party.filter(u => u.role !== 'tank');
    E.use(f, 'heal', a.cell);
    E.step(f);
    const healing = f.cast;
    expect(healing?.key).toBe('heal');
    E.use(f, 'flash', b.cell); // 다른 대상 → 치유 취소
    expect(landedPxf(healing, f.cast)).toBeNull();
    let seen = false;
    for (let i = 0; i < 400 && f.cast; i++) { const before = f.cast; E.step(f); if (landedPxf(before, f.cast)) seen = true; }
    expect(seen).toBe(false); // 순간 치유는 PXF 이펙트 없음
  });
});
