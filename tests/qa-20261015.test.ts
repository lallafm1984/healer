/** 일곱 직업 QA (2026-10-15)에서 고친 것: 성역 숨은 지속 힐 보너스 · 힐러 보호막 시간 · 단단한 껍데기 · 상한 · 헌신의 길 · 별 조각 레벨 · 빛의 장막 시간 */
import { describe, expect, it } from 'vitest';
import { BARK, WARDER } from '../src/data/heroConst';
import type { HeroKey } from '../src/data/heroes';
import { SPECS, specTotals, specValue } from '../src/data/specials';
import { TALENT_TIER, TALENT_TREES, type TalentKey } from '../src/data/talents';
import * as E from '../src/engine';
import { absorbLeft, giveAbsorb } from '../src/engine/abilities';
import { gainShard } from '../src/engine/astro';
import { hotMult } from '../src/engine/units';

const picks = (hero: HeroKey, keys: TalentKey[]) => {
  const tree = TALENT_TREES[hero], p: (number | null)[] = tree.map(() => null);
  for (const k of keys) p[TALENT_TIER[k]] = tree[TALENT_TIER[k]].picks.findIndex(x => x.key === k);
  return p;
};
const fight = (hero: HeroKey, o: { level?: number; specs?: Record<string, number>; talents?: TalentKey[] } = {}) => {
  const f = E.create({ encounter: 'warden', diff: '보통', seed: 7, level: o.level ?? 60, hero, talents: picks(hero, o.talents ?? []), specs: o.specs });
  f.skills.forEach(s => { s.next = Infinity; });
  for (const u of f.party) { u.base = u.max = 50000; u.hp = u.max; }
  return f;
};

describe('QA 2026-10-15', () => {
  it('빛의 성역 (받는 피해 −20%)은 나무껍질로 잡히지 않음: 성기사 지속 힐 배율 그대로, 드루이드 나무껍질은 +20%', () => {
    const f = fight('paladin'), u = f.party.find(x => x.role === 'tank')!;
    u.redu = 5; u.reduCut = 0.2; // 성역 안과 같은 상태 (SANCTUARY.cut)
    expect(hotMult(f, u, { key: 'oath' })).toBe(1);
    const d = fight('druid'), v = d.party.find(x => x.role === 'tank')!;
    v.redu = 5; v.reduCut = BARK.cut;
    expect(hotMult(d, v, { key: 'bloom' })).toBeCloseTo(1 + BARK.hot);
  });

  it('힐러 보호막: 짧은 막을 더해도 긴 막의 남은 시간이 줄지 않음, 단단한 껍데기가 붙음', () => {
    const f = fight('warder'), u = f.party.find(x => x.role === 'tank')!;
    giveAbsorb(f, u, 300, 15, WARDER.shieldCap);
    giveAbsorb(f, u, 100, 4, WARDER.shieldCap);
    const m = u.mods.find(x => x.k === 'absorb')!;
    expect(m.until - f.t).toBeCloseTo(15);
    expect(absorbLeft(f, u)).toBeCloseTo(400);
    const g = fight('warder', { specs: { hardShell: 0.15 } }), w = g.party.find(x => x.role === 'tank')!;
    expect(giveAbsorb(g, w, 100, 10, WARDER.shieldCap)).toBeCloseTo(115);
  });

  it('받는 피해 감소 · 확률 · 재사용 특수능력은 여러 부위 · 전설로도 상한까지만', () => {
    const legend = (k: string) => specValue(k, '전설', 1) * 1.5;
    expect(specTotals([{ key: 'deepSoothe', v: legend('deepSoothe') }, { key: 'deepSoothe', v: legend('deepSoothe') }, { key: 'deepSoothe', v: legend('deepSoothe') }], 'monk').deepSoothe).toBe(SPECS.deepSoothe.cap);
    expect(specTotals([{ key: 'thickBark', v: 0.1 }, { key: 'thickBark', v: 0.1 }, { key: 'thickBark', v: 0.1 }], 'druid').thickBark).toBe(0.2);
    expect(specTotals([{ key: 'pohEcho', v: 0.5 }, { key: 'pohEcho', v: 0.5 }], 'priest').pohEcho).toBe(0.6);
    expect(specTotals([{ key: 'hastyDrop', v: legend('hastyDrop') }], 'shaman').hastyDrop).toBe(2);
  });

  it('헌신의 길 (Lv 5 단): 패시브 헌신 (Lv 10) 전에도 신성한 힘 2칸으로 마나', () => {
    const f = fight('paladin', { level: 8, talents: ['devotionPath'] }), t = f.party.find(x => x.role === 'tank')!;
    f.power3 = 2; f.mana = 50;
    expect(E.use(f, 'oath', t.cell).ok).toBe(true);
    expect(f.mana).toBeGreaterThan(50);
  });

  it('별 조각은 고유 시스템 레벨 (Lv 6)부터', () => {
    const lo = fight('astrologer', { level: 5 }), hi = fight('astrologer', { level: 6 });
    gainShard(lo, 1); gainShard(hi, 1);
    expect(lo.shards).toBe(0);
    expect(hi.shards).toBe(1);
  });

  it('빛의 장막 보호막도 길어진 노래만큼 오래감', () => {
    const f = fight('warder', { specs: { longSong: 1 } });
    expect(E.use(f, 'lightVeil', f.me.cell).ok).toBe(true);
    const u = f.party.find(x => x.role === 'tank')!, m = u.mods.find(x => x.k === 'absorb')!;
    expect(m.until - f.t).toBeCloseTo(WARDER.veil.sec + 1);
  });
});
