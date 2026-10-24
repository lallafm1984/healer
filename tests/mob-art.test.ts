/** 일반 · 정예 구간 초상 교대 (2026-10-25 Lim C안) · 얼굴 · 이름 다양화 (같은 날 「이미지를 추가해서 적얼굴과 이름을 다양화하자」) */
import { describe, expect, it } from 'vitest';
import { art } from '../src/art';
import { mobArt, mobLook } from '../src/battle/art';
import { ENCOUNTERS } from '../src/data/encounters';
import { MOB_LOOKS, mobLookOf } from '../src/data/mob-looks';
import type { Mob } from '../src/engine/types';

const trash = Object.values(ENCOUNTERS).filter(e => e.mobs);
const kinds = new Set(trash.flatMap(e => e.mobs!.map(m => m.name)));
/** 구간 하나의 적 (엔진 initTrash 차례: 데이터 순서대로 count마리) */
const packOf = (mobs: { name: string; count: number }[]): Mob[] => mobs.flatMap(d => Array.from({ length: d.count }, () => d.name))
  .map((name, id) => ({ id, name, elite: false, hp: 1, max: 1, alive: true }));

describe('구간 적 그림 · 얼굴', () => {
  it('일반 · 정예 구간의 모든 적 이름이 그림을 가짐', () => {
    expect([...kinds].filter(n => !mobArt(n))).toEqual([]);
    expect(kinds.size).toBeGreaterThan(50);
  });

  it('얼굴 표는 구간 적 종류에만, 그림 파일이 있고 이름이 겹치지 않음', () => {
    const names = Object.values(MOB_LOOKS).flat().map(l => l.name);
    expect(Object.keys(MOB_LOOKS).filter(k => !kinds.has(k))).toEqual([]);
    expect(Object.values(MOB_LOOKS).flat().filter(l => l.art && !art(l.art)).map(l => l.art)).toEqual([]);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter(n => kinds.has(n))).toEqual([]);
  });

  it('같은 무리 안에서는 모든 적의 이름 · 얼굴이 다름', () => {
    for (const e of trash) {
      const pack = packOf(e.mobs!), f = { mobs: pack };
      const looks = pack.map(m => mobLook(f, m));
      expect(new Set(looks.map(l => l.name)).size, e.key).toBe(pack.length);
      expect(new Set(looks.map(l => l.src)).size, e.key).toBe(pack.length);
    }
  });

  it('첫째는 종류 이름 그대로, 둘째부터 표 차례로', () => {
    expect(mobLookOf('고철 졸개', 0).name).toBe('고철 졸개');
    expect(mobLookOf('고철 졸개', 1).name).toBe('톱니 졸개');
    expect(mobLookOf('고철 졸개', 2).name).toBe('사슬 졸개');
    expect(mobLookOf('없는 적', 3).name).toBe('없는 적');
  });
});
