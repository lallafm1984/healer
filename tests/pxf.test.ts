/** PXF 공방 스킬 이펙트 (Lim 2026-10-11): 휠 스킬이 들어가면 그 스킬의 픽셀 이펙트 (src/art/pxf/<이름>.pxf.json → fx-pxf-<이름>.png) */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEROES } from '../src/data/heroes';
import type { SkillKey } from '../src/data/skills';
import { PXF, pxfArtName, pxfDrawSize, pxfFrame, pxfMs, pxfTargets, SKILL_PXF, type PxfKey } from '../src/battle/pxf';
import * as E from '../src/engine';

const graph = (name: string) => JSON.parse(readFileSync(new URL(`../src/art/pxf/${name}.pxf.json`, import.meta.url), 'utf8'));
/** PNG 머리 (IHDR)의 가로 · 세로 */
const pngSize = (art: string) => {
  const b = readFileSync(new URL(`../src/art/${art}.png`, import.meta.url));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
const KEYS = Object.keys(PXF) as PxfKey[];
/** 아직 이펙트를 안 넣은 휠 스킬: 사제 8번째 칸은 스킬 스레드가 「빛의 전이」로 바꾸는 중 */
const LATER = new Set<SkillKey>(['dove']);

describe('PXF 이펙트 파일', () => {
  for (const k of KEYS) {
    it(`${k}: 게임 값이 그래프의 settings · game과 같고, 프레임 띠 · 타임라인 그림이 있음`, () => {
      const g = graph(k), c = PXF[k];
      expect(g.format).toBe('pxf.graph@1');
      expect({ size: c.size, frames: c.frames, fps: c.fps, loop: false }).toEqual({ size: g.settings.size, frames: g.settings.frames, fps: g.settings.fps, loop: g.settings.loop });
      expect({ impactFrame: c.impactFrame, logicalSize: c.logicalSize, referenceCell: c.referenceCell })
        .toEqual({ impactFrame: g.game.impactFrame, logicalSize: g.game.logicalSize, referenceCell: g.game.referenceCell ?? 62 });
      expect(g.game.pivot).toEqual([0.5, 0.5]); // 칸 가운데에 그림
      expect(c.blend).toBe('normal'); // Lim 2026-10-11: 원본 색이 잘 보이게 보통 섞기
      expect(pngSize(pxfArtName(k))).toEqual({ w: c.size * c.frames, h: c.size });
      expect(existsSync(new URL(`../src/art/pxf/${k}.timeline.png`, import.meta.url))).toBe(true); // 다시 굽는 원본
    });
  }

  it('맞는 순간이 첫 프레임, 끝까지 재생하고 사라짐', () => {
    const c = PXF['heal-dust'];
    expect(pxfFrame(c, 0)).toBe(2);
    expect(pxfFrame(c, 1000 / 24)).toBe(3);
    expect(pxfFrame(c, pxfMs(c) - 1)).toBe(23);
    expect(pxfFrame(c, pxfMs(c))).toBe(-1);
    expect(pxfMs(c)).toBeCloseTo((22 * 1000) / 24);
    expect(pxfDrawSize(c, 62)).toBe(64);
  });
});

describe('직업별 휠 스킬', () => {
  for (const hero of Object.values(HEROES)) {
    it(`${hero.name}: 휠 스킬마다 PXF 이펙트`, () => {
      const missing = Object.values(hero.slots).filter((k): k is SkillKey => !!k && !LATER.has(k) && !SKILL_PXF[k]);
      expect(missing).toEqual([]);
    });
  }
  it('스킬마다 다른 이펙트', () => {
    const fx = Object.values(SKILL_PXF).map(s => s!.fx);
    expect(new Set(fx).size).toBe(fx.length);
  });
});

describe('엔진: 스킬이 들어간 순간 (Fight.used)', () => {
  it('시전 스킬은 끝까지 들어간 틱에 한 번, 그 틱에 대상 치유 사건', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7 });
    const tank = f.party.find(u => u.role === 'tank')!;
    tank.hp = tank.max * 0.5;
    expect(E.use(f, 'heal', tank.cell).ok).toBe(true);
    expect(f.used ?? []).toEqual([]); // 시전 시작은 아님
    const hits: { healed: boolean }[] = [];
    for (let i = 0; i < 400; i++) {
      f.events.length = 0;
      E.step(f);
      for (const x of f.used?.splice(0) ?? []) {
        expect(x).toEqual({ key: 'heal', uid: tank.id });
        hits.push({ healed: f.events.some(e => e.type === 'heal' && e.id === tank.id) });
      }
    }
    expect(hits).toEqual([{ healed: true }]);
  });

  it('취소한 시전은 안 남음, 즉시 스킬은 쓰는 순간', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7 });
    const [a, b] = f.party.filter(u => u.role !== 'tank');
    E.use(f, 'heal', a.cell);
    E.step(f);
    E.use(f, 'renew', b.cell); // 다른 대상 → 치유 취소 후 소생
    expect(f.used).toEqual([{ key: 'renew', uid: b.id }]);
    f.used!.length = 0;
    for (let i = 0; i < 400; i++) E.step(f);
    expect(f.used ?? []).toEqual([]);
  });

  it('정신 집중 공대 쿨기는 시작할 때 한 번 (파티 전원 칸)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7, level: 20 });
    expect(E.use(f, 'hymn', f.me.cell).ok).toBe(true);
    expect(f.used).toEqual([{ key: 'hymn', uid: f.me.id }]);
    expect(pxfTargets(f, 'heal', f.me.id).map(u => u.id)).toEqual([f.me.id]);
  });

  it('범위 스킬은 대상과 붙어 있는 아군 칸마다', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7 });
    const u = f.party.find(x => x.role === 'tank')!;
    const near = E.living(f).filter(v => E.hexDist(f.cells[v.cell], f.cells[u.cell]) <= 1).map(v => v.id).sort();
    const s = SKILL_PXF.poh;
    if (s) expect(pxfTargets(f, 'poh', u.id).map(v => v.id).sort()).toEqual(near);
    expect(near.length).toBeGreaterThan(1);
  });

  it('기록은 비우지 않아도 끝없이 쌓이지 않음 (시뮬레이션)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 7 });
    for (let i = 0; i < 20000 && !f.over; i++) { E.autoHealer(f); E.step(f); f.events.length = 0; }
    expect((f.used ?? []).length).toBeLessThanOrEqual(32);
  });
});
