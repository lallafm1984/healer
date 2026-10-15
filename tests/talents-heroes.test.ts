/** 드루이드 · 성기사 특성 30개씩 (77): 고른 특성만 켜지고, 하나씩 실제 엔진 효과 확인 */
import { describe, expect, it } from 'vitest';
import { BEACON, HAND_GUARD, REBIRTH, SANCTUARY, WAVE } from '../src/data/heroConst';
import { SKILLS } from '../src/data/skills';
import { DRUID_TALENTS, PALADIN_TALENTS, TALENT_DEF, TALENT_HERO, TALENT_TIER, TALENT_TREES, talentKeys, TX, type TalentKey } from '../src/data/talents';
import * as E from '../src/engine';
import { addDebuff, damage } from '../src/engine/core';
import { HERO_KEYS } from '../src/data/heroes';
import { heroHeal } from '../src/engine/heroes';
import { dodgeRate } from '../src/engine/movement';
import { calmDodge, calmFor, castOf, cdOf, costOf, talentHot, talentReady, useTalent } from '../src/engine/talents';
import { colonyN, hotMult } from '../src/engine/units';

type F = ReturnType<typeof E.create>;
type U = F['party'][number];
type Hero = 'druid' | 'paladin';
/** 특성 이름 → 그 직업 트리에서 단마다 고른 칸 번호 */
const picks = (hero: Hero, keys: TalentKey[]) => {
  const tree = TALENT_TREES[hero], p: (number | null)[] = tree.map(() => null);
  for (const k of keys) p[TALENT_TIER[k]] = tree[TALENT_TIER[k]].picks.findIndex(x => x.key === k);
  return p;
};
const fight = (hero: Hero, keys: TalentKey[], enc: 'warden' | 'plague' | 'choir' = 'plague') => {
  const f = E.create({ encounter: enc, diff: '보통', seed: 7, level: 100, hero, talents: picks(hero, keys) });
  f.gear.crit = 0; f.gear.haste = 0;
  f.power = 1; f.dmgMult = 1; f.gear.heal = 1; f.manaCut = 1; // 힐 · 피해를 기본 단위로, 특성 효과만 봄
  f.skills.forEach(s => { s.next = Infinity; });
  for (const u of f.party) { u.p = { ...u.p, flee: 0 }; u.ab = null; } // 도망 · 파티원 능력 끔
  return f;
};
const druid = (keys: TalentKey[], enc?: 'warden' | 'plague' | 'choir') => fight('druid', keys, enc);
const paladin = (keys: TalentKey[], enc?: 'warden' | 'plague' | 'choir') => fight('paladin', keys, enc);
const step = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const cast = (f: F, key: Parameters<typeof E.use>[1], u: U) => {
  const r = E.use(f, key, u.cell);
  expect(r.ok, r.reason).toBe(true);
  let n = 0;
  while ((f.cast || f.gcd > 0 || f.queued) && n++ < 200) { E.step(f); f.events.length = 0; }
};
const tanks = (f: F) => f.party.filter(u => u.role === 'tank');
const others = (f: F) => f.party.filter(u => !u.me);
const adj = (f: F, u: U) => f.party.filter(v => v !== u && v.alive && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
const hurt = (f: F, pct = 0.5) => { for (const u of f.party) u.hp = u.max * pct; };
const withAdj = (f: F, n = 1) => others(f).find(u => adj(f, u).length >= n)!;
const sprouts = (u: U) => u.hots.filter(h => h.key === 'sprout');
/** 피해 100 (고정, 방어력 무시)으로 줄어든 체력 */
const taken = (f: F, u: U, magic = false) => { const h = u.hp; damage(f, u, 100, magic, 'fixed'); return h - u.hp; };

describe('트리 구조 (77 1장)', () => {
  it('세 직업 모두 10단 × 3택1, Lv 5부터 5레벨마다', () => {
    for (const tree of HERO_KEYS.map(h => TALENT_TREES[h])) { // 켠 직업 (79 직업은 직업 PR에서 30개)
      expect(tree.map(t => t.lv)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
      for (const t of tree) expect(t.picks.length).toBe(3);
    }
    const keys = Object.values(TALENT_TREES).flatMap(t => t.flatMap(x => x.picks.map(p => p.key)));
    expect(new Set(keys).size).toBe(keys.length); // 키는 직업끼리도 겹치지 않음
    expect(keys.length).toBe(30 * HERO_KEYS.length);
    expect(DRUID_TALENTS.flatMap(t => t.picks).every(p => TALENT_HERO[p.key] === 'druid')).toBe(true);
    expect(PALADIN_TALENTS.flatMap(t => t.picks).every(p => TALENT_HERO[p.key] === 'paladin')).toBe(true);
  });
  it('설명은 ~니다로 끝나고, 보조 버튼은 궁극 단 말고는 단마다 하나 이하', () => {
    for (const tree of [DRUID_TALENTS, PALADIN_TALENTS]) for (const t of tree) {
      for (const p of t.picks) expect(p.desc, p.name).toMatch(/니다\.$/);
      expect(t.picks.filter(p => p.active).length).toBeLessThanOrEqual(t.lv === 50 ? 2 : 1);
    }
  });
  it('같은 칸 번호도 직업 트리로 읽음, Lv에 따라 열린 단만', () => {
    const p = [0, 1, 2, 0, null, null, null, null, null, null];
    expect(talentKeys(p, 17, 'druid')).toEqual(['longSprout', 'earlySprout', 'mossBed']);
    expect(talentKeys(p, 20, 'paladin')).toEqual(['swiftLight', 'steadyHeart', 'waveEcho', 'beaconWeight']);
    expect(druid(['springRain']).tx.act).toEqual({ springRain: { cd: 0, left: 0, used: false } });
    expect(Object.keys(paladin([]).tx.on)).toEqual([]);
  });
});

describe('드루이드 기본 강화 (Lv 5~15)', () => {
  it('긴 새싹: +3초 · 모두 350 (틱 70 그대로)', () => {
    const f = druid(['longSprout']), u = tanks(f)[0];
    cast(f, 'sprout', u);
    expect(sprouts(u)[0].rest).toBeCloseTo(350, 6);
    expect(sprouts(u)[0].per).toBeCloseTo(70, 6);
    expect(sprouts(u)[0].left).toBeGreaterThan(12.4); // 기본 12초보다 김 (GCD만큼 지남)
  });
  it('단비: 새싹이 걸린 대상에게 생장 즉시 회복 +15%', () => {
    const go = (keys: TalentKey[]) => {
      const f = druid(keys), u = others(f).find(v => v.role !== 'tank')!;
      u.max = u.base = 1e6; u.hp = 1;
      cast(f, 'sprout', u); sprouts(u)[0].tick = 99; // 새싹 틱은 안 셈
      const a = u.hp;
      cast(f, 'growth', u);
      return u.hp - a - 0;
    };
    expect(go(['sproutGrowth']) / go([])).toBeCloseTo(1 + TX.sproutGrowth, 6);
  });
  it('곁가지 생장: 생장 즉시 회복의 35%가 옆 칸 가장 낮은 1명에게', () => {
    const f = druid(['branchGrowth']); hurt(f);
    const u = withAdj(f), v = adj(f, u)[0]; v.max = v.base = 1e6; v.hp = 1;
    const h = v.hp;
    cast(f, 'growth', u);
    expect(v.hp - h).toBeCloseTo(SKILLS.growth.amt! * TX.branchGrowth, 3);
  });

  it('단단한 줄기: 새싹이 걸린 탱커만 받는 피해 −8%', () => {
    const f = druid(['firmStem']), t = tanks(f)[0], d = others(f).find(u => u.role !== 'tank')!;
    expect(taken(f, t)).toBeCloseTo(100, 6);
    cast(f, 'sprout', t); cast(f, 'sprout', d);
    expect(taken(f, t)).toBeCloseTo(100 * (1 - TX.firmStem), 6);
    expect(taken(f, d)).toBeCloseTo(100, 6);
  });
  it('이른 새싹: 체력 90% 이상 대상이면 마나 없음, 회복량 +20%', () => {
    const f = druid(['earlySprout']), u = tanks(f)[0];
    u.hp = u.max;
    expect(costOf(f, 'sprout', u)).toBe(0);
    cast(f, 'sprout', u);
    expect(sprouts(u)[0].rest).toBeCloseTo(280 * (1 + TX.earlySprout.heal), 6);
    u.hp = u.max * 0.5;
    expect(costOf(f, 'sprout', u)).toBe(SKILLS.sprout.cost);
  });
  it('씻어 내는 비: 대상과 옆 칸 1명의 디버프를 하나씩', () => {
    const f = druid(['washRain']), u = withAdj(f), v = adj(f, u)[0];
    addDebuff(f, u, { name: '독침', type: '독', left: 20 });
    addDebuff(f, v, { name: '독침', type: '독', left: 20 });
    const h = [u.hp, v.hp]; u.hp = v.hp = 1; u.max = u.base = v.max = v.base = 1e6;
    cast(f, 'natureCleanse', u);
    expect(u.debuffs.length + v.debuffs.length).toBe(0);
    expect([u.hp - 1, v.hp - 1]).toEqual([TX.washRain.amt, TX.washRain.amt]);
    void h;
    const g = druid([]), a = withAdj(g), b = adj(g, a)[0];
    addDebuff(g, a, { name: '독침', type: '독', left: 20 }); addDebuff(g, b, { name: '독침', type: '독', left: 20 });
    cast(g, 'natureCleanse', a);
    expect(b.debuffs.length).toBe(1);
  });
  it('깊어지는 생장: 생장 지속 회복 8초 · 120', () => {
    const f = druid(['deepGrowth']), u = tanks(f)[0]; hurt(f, 0.1);
    cast(f, 'growth', u);
    const h = u.hots.find(x => x.key === 'growth')!;
    expect(h.rest).toBeCloseTo(TX.deepGrowth.amt, 6);
    expect(h.left).toBeGreaterThan(TX.deepGrowth.sec - 2.1);
  });
  it('생장의 숨: 생장 뒤 새싹 1번은 마나 없이', () => {
    const f = druid(['growthBreath']), u = tanks(f)[0]; hurt(f);
    cast(f, 'growth', u);
    expect(costOf(f, 'sprout', u)).toBe(0);
    const m = f.mana;
    cast(f, 'sprout', u);
    expect(f.mana).toBeGreaterThanOrEqual(m - 1e-9);
    expect(costOf(f, 'sprout', u)).toBe(SKILLS.sprout.cost);
  });
  it('이끼 자리: 새싹을 건 칸에서 지속 힐 +20%, 끝나면 없음', () => {
    const f = druid(['mossBed']), u = tanks(f)[0];
    cast(f, 'sprout', u);
    expect(talentHot(f, u, 'sprout')).toBeCloseTo(1 + TX.mossBed.hot, 9);
    const v = others(f).find(x => x !== u)!;
    expect(talentHot(f, v, 'sprout')).toBe(1);
    step(f, TX.mossBed.sec + 0.5);
    expect(talentHot(f, u, 'sprout')).toBe(1);
  });
});

describe('드루이드 군락 (Lv 20~25)', () => {
  it('두 겹 새싹: 2개까지 (겹쳐 건 것은 75%), 셋째는 덜 남은 것을 바꿈', () => {
    const f = druid(['twinSprout']), u = tanks(f)[0];
    cast(f, 'sprout', u); cast(f, 'sprout', u);
    expect(sprouts(u).length).toBe(2);
    expect(sprouts(u)[1].rest).toBeCloseTo(280 * TX.twinSprout, 6);
    cast(f, 'sprout', u);
    expect(sprouts(u).length).toBe(2);
    expect(sprouts(druid([]).party[0]).length).toBe(0);
  });
  it('번지는 군락: 칸마다 13%, 생장 지속 힐에도, 5인 이하 1칸 이상', () => {
    expect(colonyN(druid(['colonyAll'], 'warden'), tanks(druid(['colonyAll'], 'warden'))[0])).toBe(1);
    expect(colonyN(druid(['colonyAll']), tanks(druid(['colonyAll']))[0])).toBe(0); // 10인은 그대로
    const f = druid(['colonyAll']), g = druid([]);
    for (const x of [f, g]) { const u = withAdj(x); for (const v of adj(x, u)) cast(x, 'sprout', v); }
    const uf = withAdj(f), ug = withAdj(g), n = colonyN(f, uf);
    expect(hotMult(f, uf, { key: 'growth' })).toBeCloseTo(1 + n * (0.1 + TX.colonyAll), 9);
    expect(hotMult(f, uf, { key: 'sprout' })).toBeCloseTo(1 + n * (0.1 + TX.colonyAll), 9);
    expect(hotMult(g, ug, { key: 'growth' })).toBe(1);
  });
  it('뻗는 뿌리: 5인 이하는 옆에 새싹이 없어도 군락 2칸, 레이드는 2칸 거리까지 셈', () => {
    expect(colonyN(druid(['wideRoots'], 'warden'), tanks(druid(['wideRoots'], 'warden'))[0])).toBe(TX.wideRoots.min);
    const g = druid(['wideRoots'], 'choir'), u = tanks(g)[0];
    expect(colonyN(g, u)).toBe(0);
    const far = g.party.find(v => E.hexDist(g.cells[v.cell], g.cells[u.cell]) === 2)!;
    cast(g, 'sprout', far);
    expect(colonyN(g, u)).toBe(1);
  });
  it('봄비: 새싹이 없는 모든 아군에게, 전투당 1회', () => {
    const f = druid(['springRain']);
    expect(useTalent(f, 'springRain').ok).toBe(true);
    expect(f.party.every(u => sprouts(u).length === 1)).toBe(true);
    for (const u of f.party) u.hots = [];
    expect(useTalent(f, 'springRain').reason).toMatch(/전투당 1회/);
  });
  it('서두른 새싹: 2초마다, 시간 2/3, 회복량 그대로', () => {
    const f = druid(['quickSprout']), u = tanks(f)[0];
    cast(f, 'sprout', u);
    const h = sprouts(u)[0];
    expect(h.every).toBe(TX.quickSprout);
    expect(h.rest).toBeCloseTo(280, 6);
    expect(h.left).toBeLessThan(8.01);
  });
  it('맑은 새싹: 새싹을 걸면 디버프 1개도, 8초에 한 번', () => {
    const f = druid(['cleanFlower']), [u, v] = others(f);
    for (const x of [u, v]) addDebuff(f, x, { name: '저주 표식', type: '저주', left: 30 });
    cast(f, 'sprout', u);
    expect(u.debuffs.length).toBe(0);
    cast(f, 'sprout', v);
    expect(v.debuffs.length).toBe(1);
    step(f, TX.cleanFlower.cd);
    cast(f, 'sprout', v);
    expect(v.debuffs.length).toBe(0);
  });
});

describe('드루이드 생존 · 위기 (Lv 30~35)', () => {
  it('나무의 몸: 내 체력 40% 아래면 나무껍질 8초, 60초에 한 번', () => {
    const f = druid(['treeBody']);
    f.me.hp = f.me.max * 0.3;
    step(f, 0.2);
    expect(f.me.redu).toBeGreaterThan(7);
    expect(f.tx.treeCd).toBeGreaterThan(59);
  });
  it('곁의 숲: 옆 칸 아군 한 명마다 내가 받는 피해 −5%, 최대 15%', () => {
    const f = druid(['nearGrove']), n = adj(f, f.me).length;
    expect(taken(f, f.me)).toBeCloseTo(100 * (1 - Math.min(TX.nearGrove.max, TX.nearGrove.step * n)), 6);
    expect(n).toBeGreaterThan(0);
  });
  it('두 번째 봄: 환생 2번, 두 번째는 체력 25%', () => {
    const f = druid(['secondSpring']);
    const [a, b] = others(f).filter(u => u.role !== 'tank');
    damage(f, a, a.max * 5, false, 'fixed');
    cast(f, 'rebirth', a);
    expect(a.hp / a.max).toBeCloseTo(REBIRTH.hp, 6);
    expect(f.rebirthUsed).toBe(false);
    damage(f, b, b.max * 5, false, 'fixed');
    cast(f, 'rebirth', b);
    expect(b.hp / b.max).toBeCloseTo(TX.secondSpring.hp, 6);
    expect(f.rebirthUsed).toBe(true);
  });
  it('급한 새싹: 체력 40% 이하 대상은 첫 회복이 바로 2배', () => {
    const f = druid(['rescueSprout']), u = tanks(f)[0]; u.hp = u.max * 0.3;
    const h = u.hp;
    cast(f, 'sprout', u);
    expect(u.hp - h).toBeGreaterThanOrEqual(70 * TX.rescueSprout.mult - 1e-6);
    expect(sprouts(u)[0].rest).toBeCloseTo(210, 6);
  });
  it('경계의 싹: 광역 예고가 뜨면 새싹이 없는 낮은 2명에게 절반 새싹, 15초에 한 번', () => {
    const f = druid(['watchSprout']); hurt(f, 0.8);
    const low = others(f).slice(0, TX.watchSprout.n); for (const u of low) u.hp = u.max * 0.3;
    const sk = { name: '폭풍', icon: '', kind: 'aoe' } as never;
    f.tels.push({ id: f.nextId++, skill: sk, kind: 'aoe', start: f.t, impact: f.t + 3, units: [], cells: new Set() });
    step(f, 0.1);
    expect(low.every(u => sprouts(u)[0]?.rest === TX.watchSprout.amt)).toBe(true);
    expect(f.party.filter(u => sprouts(u).length).length).toBe(TX.watchSprout.n);
    f.tels.push({ id: f.nextId++, skill: sk, kind: 'aoe', start: f.t, impact: f.t + 3, units: [], cells: new Set() });
    step(f, 0.1);
    expect(f.party.filter(u => sprouts(u).length).length).toBe(TX.watchSprout.n); // 재발동 대기
  });
  it('남은 꽃: 파티원이 쓰러지면 그 칸 둘레 아군에게 지속 힐', () => {
    const f = druid(['fallenFlower']), u = withAdj(f, 2);
    damage(f, u, u.max * 5, false, 'fixed');
    const nb = adj(f, u);
    expect(nb.length).toBeGreaterThan(0);
    for (const v of nb) expect(v.hots.find(h => h.key === 'bloom')?.name).toBe('남은 꽃');
  });
});

describe('드루이드 범위 · 대규모 · 궁극 (Lv 40~50)', () => {
  it('다시 피는 들꽃: 7초 뒤 같은 자리에 25%', () => {
    const f = druid(['rebloomField']), u = tanks(f)[0];
    cast(f, 'wildflower', u);
    step(f, 7.2);
    expect(u.hots.find(h => h.key === 'wildflower')!.rest).toBeCloseTo(160 * TX.rebloomField, 1);
  });
  it('이어 피는 꽃: 들꽃이 닿은 새싹 +3초, 그만큼 회복량도', () => {
    const f = druid(['flowerTrail']), u = tanks(f)[0]; hurt(f, 0.1);
    cast(f, 'sprout', u); sprouts(u)[0].tick = 99; // 새싹 틱은 안 셈
    const r = sprouts(u)[0].rest, l = sprouts(u)[0].left;
    cast(f, 'wildflower', u);
    expect(sprouts(u)[0].rest).toBeCloseTo(r + (70 / 3) * TX.flowerTrail, 6);
    expect(sprouts(u)[0].left).toBeGreaterThan(l + TX.flowerTrail - 2.1);
  });
  it('흩날리는 꽃씨: 피워 낸 회복량의 30%가 옆 2명에게', () => {
    const f = druid(['seedScatter']); hurt(f, 0.1);
    const u = withAdj(f, 2);
    cast(f, 'sprout', u);
    const nb = adj(f, u), before = nb.map(v => v.hp), rest = sprouts(u)[0].rest;
    cast(f, 'bloom', u);
    const got = nb.map((v, i) => v.hp - before[i]).filter(x => x > 1e-6).sort((a, b) => b - a);
    expect(got.length).toBeGreaterThanOrEqual(2);
    expect(got[0]).toBeCloseTo(rest * 1.5 * TX.seedScatter.share, 0);
  });
  it('탱커의 숲: 탱커 새싹은 군락이 2칸 이상', () => {
    const f = druid(['guardianGrove']);
    expect(colonyN(f, tanks(f)[0])).toBe(2);
    expect(colonyN(druid([]), tanks(druid([]))[0])).toBe(0);
  });
  it('넘치는 수액: 지속 힐로 넘친 몫의 30%가 옆의 가장 다친 아군에게', () => {
    const f = druid(['overflowSap']), u = withAdj(f);
    for (const v of f.party) v.hp = v.max;
    const low = adj(f, u)[0]; low.hp = low.max * 0.2;
    cast(f, 'sprout', u);
    const h = low.hp;
    step(f, 3.1);
    expect(low.hp - h).toBeGreaterThan(70 * TX.overflowSap * 0.9);
  });
  it('푸른 들판: 파티 절반 이상에 새싹이면 새싹 +15%', () => {
    const f = druid(['greenField']), u = tanks(f)[0];
    expect(talentHot(f, u, 'sprout')).toBe(1);
    for (const v of f.party.slice(0, Math.ceil(f.party.length / 2))) cast(f, 'sprout', v);
    expect(talentHot(f, u, 'sprout')).toBeCloseTo(1 + TX.greenField.hot, 9);
    expect(talentHot(f, u, 'growth')).toBe(1);
  });
  it('숲의 기억: 15초 동안 건 새싹은 끝나면 한 번 더', () => {
    const f = druid(['forestMemory']), u = tanks(f)[0]; hurt(f, 0.1);
    expect(useTalent(f, 'forestMemory').ok).toBe(true);
    cast(f, 'sprout', u);
    step(f, 12.2);
    expect(sprouts(u).length).toBe(1);
    expect(sprouts(u)[0].again).toBeFalsy();
    step(f, 12.2);
    expect(sprouts(u).length).toBe(0);
  });
  it('한 그루의 고목: 다른 아군 새싹을 거둬 가장 낮은 사람을 2배로', () => {
    const f = druid(['oldTree']); hurt(f, 0.9);
    const low = others(f)[0]; low.max = low.base = 1e6; low.hp = 1;
    const rest = others(f).filter(u => u !== low).slice(0, 3);
    expect(talentReady(f, 'oldTree').ok).toBe(false);
    for (const v of rest) cast(f, 'sprout', v);
    const sum = rest.reduce((a, v) => a + sprouts(v)[0].rest, 0);
    expect(useTalent(f, 'oldTree').ok).toBe(true);
    expect(low.hp - 1).toBeCloseTo(sum * TX.oldTree.mult, 3);
    expect(rest.every(v => !sprouts(v).length)).toBe(true);
    expect(cdOf(f, 'sprout')).toBe(0);
  });
  it('깨어나는 숲: 들꽃이 닿은 새싹이 바로 한 번 더 회복 (남은 회복량 그대로)', () => {
    const f = druid(['wakeForest']), u = tanks(f)[0];
    u.max = u.base = 1e6; u.hp = 1;
    cast(f, 'sprout', u); sprouts(u)[0].tick = 99; // 새싹 틱은 안 셈
    u.hots = u.hots.filter(x => x.key === 'sprout');
    const r = sprouts(u)[0].rest, h = u.hp;
    E.use(f, 'wildflower', u.cell);
    let n = 0; while (f.cast && n++ < 200) { E.step(f); f.events.length = 0; }
    expect(sprouts(u)[0].rest).toBeCloseTo(r, 6);
    expect(u.hp - h).toBeGreaterThanOrEqual(70 - 1e-6); // 들꽃 첫 틱 전 (1.75초 뒤)이라 새싹 한 틱만
  });
});

describe('성기사 기본 강화 (Lv 5~15)', () => {
  it('곧은 손길: 빛의 손길 시전 −0.3초', () => {
    expect(castOf(paladin(['swiftLight']), 'holyLight')).toBeCloseTo(SKILLS.holyLight.cast - TX.swiftLight, 9);
  });
  it('헌신의 길: 신성한 힘 2칸부터, 마나 3%', () => {
    const f = paladin(['devotionPath']), g = paladin([]);
    for (const x of [f, g]) { hurt(x); x.power3 = 2; x.mana = 50; cast(x, 'oath', tanks(x)[0]); }
    expect(f.mana - g.mana).toBeCloseTo(TX.devotionPath.mana, 6); // 기본 헌신은 3칸부터
  });
  it('나눠 주는 서약: 옆 칸 가장 낮은 1명에게 절반', () => {
    const f = paladin(['shareOath']); hurt(f);
    const u = withAdj(f), v = adj(f, u)[0]; v.hp = v.max * 0.2;
    f.power3 = 3; cast(f, 'oath', u);
    expect(v.hots.find(h => h.key === 'oath')!.rest).toBeCloseTo(480 * TX.shareOath, 6);
  });
  it('무거운 손길: 빛의 손길이 잃은 체력 1%마다 1%, 최대 50% (2026-10-16 빛 일격에서 옮김)', () => {
    const f = paladin(['heavyStrike']), d = others(f).find(u => u.role !== 'tank')!;
    d.max = d.base = 1e6; d.hp = d.max * 0.5;
    const h = d.hp;
    cast(f, 'holyLight', d);
    expect(d.hp - h).toBeCloseTo(SKILLS.holyLight.amt! * (1 + Math.min(TX.heavyStrike.max, 0.5 * TX.heavyStrike.per)), 3);
  });
  it('곧은 마음: 봉화 대상에게 직접 힐 마나 −25%', () => {
    const f = paladin(['steadyHeart']), b = f.party.find(u => u.id === f.beacon)!, d = others(f).find(u => u.id !== f.beacon)!;
    expect(costOf(f, 'holyLight', b)).toBeCloseTo(SKILLS.holyLight.cost * 0.75, 9);
    expect(costOf(f, 'holyLight', d)).toBe(SKILLS.holyLight.cost);
  });
  it('두 손의 빛: 빛의 손길 30%가 옆 칸 가장 낮은 1명에게', () => {
    const f = paladin(['twinHands']); hurt(f);
    const u = others(f).find(u => u.role !== 'tank' && adj(f, u).some(v => v.id !== f.beacon))!;
    const v = adj(f, u).filter(v => v.id !== f.beacon)[0]; v.hp = v.max * 0.1;
    const h = v.hp;
    cast(f, 'holyLight', u);
    expect(v.hp - h).toBeCloseTo(260 * TX.twinHands * (v.role === 'tank' ? 1 : 1), 3);
  });
  it('굳은 서약: 빛의 서약이 걸린 아군 받는 피해 −10%', () => {
    const f = paladin(['guardOath']), u = tanks(f)[0];
    expect(taken(f, u)).toBeCloseTo(100, 6);
    f.power3 = 1; cast(f, 'oath', u);
    expect(taken(f, u)).toBeCloseTo(100 * (1 - TX.guardOath), 6);
  });
  it('고른 호흡: 신성한 힘 1칸마다 마나 재생 +15%', () => {
    const f = paladin(['calmBreath']), g = paladin([]);
    for (const x of [f, g]) { x.mana = 10; x.power3 = 3; }
    step(f, 1); step(g, 1);
    expect((f.mana - 10) / (g.mana - 10)).toBeCloseTo(1 + TX.calmBreath * 3, 6);
  });
  it('파도의 여운: 빛의 파도로 회복한 아군에게 지속 힐', () => {
    const f = paladin(['waveEcho']); hurt(f);
    f.power3 = 3; cast(f, 'lightWave', tanks(f)[0]);
    const n = f.party.filter(u => u.hots.some(h => h.key === 'lightWave' && h.name === '파도의 여운')).length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(WAVE.max);
  });
});

describe('성기사 봉화 · 신성한 힘 (Lv 20~25)', () => {
  it('빛의 무게: 봉화 대상 받는 피해 −10%', () => {
    const f = paladin(['beaconWeight']), b = f.party.find(u => u.id === f.beacon)!, d = tanks(f).find(u => u !== b)!;
    expect(taken(f, b)).toBeCloseTo(100 * (1 - TX.beaconWeight), 6);
    expect(taken(f, d)).toBeCloseTo(100, 6);
  });
  it('봉화의 숨: 봉화 몫이 들어갈 때마다 마나', () => {
    const f = paladin(['beaconBreath']); hurt(f);
    const b = f.party.find(u => u.id === f.beacon)!, d = others(f).find(u => u !== b)!;
    f.mana = 50;
    heroHeal(f, d, 100); heroHeal(f, d, 100);
    expect(f.mana).toBeCloseTo(50 + TX.beaconBreath.mana * 2, 6);
    heroHeal(f, b, 100); // 봉화 대상에게 직접은 몫 없음
    expect(f.mana).toBeCloseTo(50 + TX.beaconBreath.mana * 2, 6);
  });
  it('번지는 봉화: 봉화 대상이 90% 이상이면 그 옆의 가장 다친 아군에게', () => {
    const f = paladin(['beaconDrift']); hurt(f);
    const b = f.party.find(u => u.id === f.beacon)!; b.hp = b.max;
    const v = adj(f, b)[0]; v.hp = v.max * 0.1;
    const d = others(f).find(u => u !== b && u !== v)!;
    const h = v.hp;
    heroHeal(f, d, 100);
    expect(v.hp - h).toBeGreaterThan(100 * BEACON.raid10 * 0.99);
  });
  it('가득 찬 빛: 힘을 가득 채우고 10초 동안 서약 · 파도 +30%, 재사용 대기 60초', () => {
    const f = paladin(['resolveFill']); hurt(f);
    expect(useTalent(f, 'resolveFill').ok).toBe(true);
    expect(f.power3).toBe(3);
    const u = tanks(f)[0];
    cast(f, 'oath', u);
    expect(u.hots.find(h => h.key === 'oath')!.rest).toBeCloseTo(480 * (1 + TX.resolveFill.heal), 6);
    expect(useTalent(f, 'resolveFill').reason).toMatch(/효과 중|재사용 대기/);
    step(f, TX.resolveFill.sec + 0.2);
    f.power3 = 1; cast(f, 'oath', u);
    expect(u.hots.find(h => h.key === 'oath')!.rest).toBeCloseTo(160, 6);
    expect(useTalent(f, 'resolveFill').reason).toMatch(/재사용 대기/);
  });
  it('모아 둔 빛: 힘이 가득 차면 다음 빛의 손길 마나 없음', () => {
    const f = paladin(['freeLight']); hurt(f);
    const u = tanks(f)[0];
    f.power3 = 2;
    cast(f, 'holyLight', u);
    expect(f.power3).toBe(3);
    expect(costOf(f, 'holyLight', u)).toBe(0);
    const m = f.mana;
    cast(f, 'holyLight', u);
    expect(f.mana).toBeGreaterThanOrEqual(m - 1e-9);
    expect(costOf(f, 'holyLight', u)).toBe(SKILLS.holyLight.cost);
  });
  it('빛의 길: 빛의 파도가 회복한 아군 1명의 디버프 1개', () => {
    const f = paladin(['waveCleanse']); hurt(f);
    const u = tanks(f)[0]; u.hp = u.max * 0.1;
    addDebuff(f, u, { name: '역병', type: '질병', left: 20 });
    f.power3 = 3; cast(f, 'lightWave', u);
    expect(u.debuffs.length).toBe(0);
  });
});

describe('성기사 생존 · 위기 (Lv 30~35)', () => {
  it('빛의 갑옷: 신성한 힘 1칸마다 내가 받는 피해 −5%', () => {
    const f = paladin(['lightArmor']);
    f.power3 = 3;
    expect(taken(f, f.me)).toBeCloseTo(100 * (1 - TX.lightArmor * 3), 6);
    f.power3 = 0;
    expect(taken(f, f.me)).toBeCloseTo(100, 6);
  });
  it('지키는 맹세: 희생을 건 아군 받는 피해 −10% 더', () => {
    const f = paladin(['vowGuard']), g = paladin([]);
    const go = (x: F) => { const u = tanks(x)[0]; cast(x, 'sacrifice', u); return taken(x, u); };
    expect(go(f) / go(g)).toBeCloseTo(1 - TX.vowGuard, 6);
  });
  it('구원의 손: 보호의 손 동안 마법 피해 절반, 끝나면 회복', () => {
    const f = paladin(['rescueHand']), u = others(f).find(u => u.role !== 'tank')!;
    u.max = u.base = 1e6; u.hp = u.max * 0.5;
    cast(f, 'handGuard', u);
    expect(taken(f, u, true)).toBeCloseTo(100 * TX.rescueHand.magic, 6);
    const h = u.hp;
    step(f, HAND_GUARD.sec + 0.2);
    expect(u.hp - h).toBeCloseTo(TX.rescueHand.amt, 3);
  });
  it('다급한 손: 체력 35% 이하 대상에게 빛의 손길 시전 절반', () => {
    const f = paladin(['quickHand']), u = tanks(f)[0];
    u.hp = u.max * 0.3;
    expect(castOf(f, 'holyLight', u)).toBeCloseTo(SKILLS.holyLight.cast * TX.quickHand.cast, 9);
    u.hp = u.max * 0.5;
    expect(castOf(f, 'holyLight', u)).toBeCloseTo(SKILLS.holyLight.cast, 9);
  });
  it('흔들림 없는 빛: 성역 안에서 도망가지 않고 장판 회피 +15%', () => {
    const f = paladin(['steadyLight']), g = paladin([]);
    for (const x of [f, g]) cast(x, 'sanctuary', tanks(x)[0]);
    const u = tanks(f)[0], v = tanks(g)[0];
    expect(calmFor(f, u)).toBe(true);
    expect(calmFor(g, v)).toBe(false);
    expect(calmDodge(f, u)).toBeCloseTo(TX.steadyLight, 9);
    expect(calmDodge(g, v)).toBe(0);
    expect(dodgeRate(f, u)).toBeGreaterThan(dodgeRate(g, v));
  });
  it('순교의 빛: 파티원이 쓰러지면 힘이 가득, 6초 동안 서약 +50%', () => {
    const f = paladin(['martyr']); hurt(f);
    const d = others(f).find(u => u.role !== 'tank')!;
    damage(f, d, d.max * 5, false, 'fixed');
    expect(f.power3).toBe(3);
    const u = tanks(f)[0];
    cast(f, 'oath', u);
    expect(u.hots.find(h => h.key === 'oath')!.rest).toBeCloseTo(480 * (1 + TX.martyr.oath), 6);
  });
});

describe('성기사 범위 · 대규모 · 궁극 (Lv 40~50)', () => {
  it('밀려오는 파도: 5명까지, 회복량 +10%', () => {
    const f = paladin(['fullWave'], 'choir'); hurt(f, 0.3);
    const near = (u: U) => f.party.filter(v => E.hexDist(f.cells[v.cell], f.cells[u.cell]) <= 1);
    const c = f.party.reduce((a, b) => (near(b).length > near(a).length ? b : a));
    for (const u of f.party) u.got = 0;
    f.power3 = 3; cast(f, 'lightWave', c);
    expect(f.party.filter(u => u.got > 0).length).toBe(Math.min(TX.fullWave.n, near(c).length));
    expect(near(c).length).toBeGreaterThan(WAVE.max);
  });
  it('가벼운 파도 · 넓은 성역', () => {
    expect(costOf(paladin(['freeWave']), 'lightWave')).toBe(0);
    expect(costOf(paladin([]), 'lightWave')).toBe(SKILLS.lightWave.cost);
    const f = paladin(['wideSanctuary'], 'choir'), g = paladin([], 'choir');
    for (const x of [f, g]) cast(x, 'sanctuary', tanks(x)[0]);
    expect(f.sanctuary!.cells.size).toBeGreaterThan(g.sanctuary!.cells.size);
    expect(f.sanctuary!.hps).toBeCloseTo(SANCTUARY.hps * (1 - TX.wideSanctuary), 9);
  });
  it('탱커의 빛: 굳건한 손이 25%로', () => {
    const f = paladin(['tankLight']), t = tanks(f).find(u => u.id !== f.beacon)!;
    t.max = t.base = 1e6; t.hp = 1;
    heroHeal(f, t, 100, false);
    expect(t.hp - 1).toBeCloseTo(100 * (1 + TX.tankLight), 6);
  });
  it('빛의 울림: 봉화 대상에게 직접 힐하면 붙은 아군에게 25%', () => {
    const f = paladin(['beaconRing']); hurt(f, 0.3);
    const b = f.party.find(u => u.id === f.beacon)!, nb = adj(f, b);
    const before = nb.map(v => v.hp);
    heroHeal(f, b, 100);
    nb.forEach((v, i) => expect(v.hp - before[i]).toBeCloseTo(100 * 1.1 * TX.beaconRing, 6)); // 봉화 대상 탱커 = 굳건한 손 +10%
  });
  it('빛의 행진: 빛의 파도 뒤 힘 1칸', () => {
    const f = paladin(['waveMarch']); hurt(f);
    f.power3 = 3; cast(f, 'lightWave', tanks(f)[0]);
    expect(f.power3).toBe(1);
  });
  it('새벽의 맹세: 20초 동안 힘 2칸씩', () => {
    const f = paladin(['dawnVow']); hurt(f);
    expect(useTalent(f, 'dawnVow').ok).toBe(true);
    cast(f, 'holyLight', tanks(f)[0]);
    expect(f.power3).toBe(TX.dawnVow.gain);
    f.power3 = 3; const u = tanks(f)[0]; cast(f, 'oath', u);
    expect(u.hots.find(h => h.key === 'oath')!.rest).toBeCloseTo(480 * (1 + TX.dawnVow.heal), 6);
    expect(talentReady(f, 'dawnVow').ok).toBe(false);
  });
  it('끝없는 빛: 빛의 파도가 2칸만 씀, 위력 그대로', () => {
    const f = paladin(['endlessLight']), g = paladin([]);
    for (const x of [f, g]) { hurt(x, 0.1); x.power3 = 2; }
    expect(E.canTarget(g, 'lightWave', tanks(g)[0].cell).ok).toBe(false);
    const u = tanks(f)[0]; u.max = u.base = 1e6; u.hp = 1;
    cast(f, 'lightWave', u);
    expect(u.hp - 1).toBeCloseTo(SKILLS.lightWave.amt! * (u.role === 'tank' ? 1.1 : 1), 6);
    expect(f.power3).toBe(0);
    f.power3 = 3; cast(f, 'lightWave', u);
    expect(f.power3).toBe(1);
  });
  it('모두의 기사: 봉화 몫이 봉화 대상과 그 옆에서 가장 다친 2명에게 70%씩', () => {
    const f = paladin(['allKnight']); hurt(f, 0.9);
    const b = f.party.find(u => u.id === f.beacon)!;
    const pool = [b, ...adj(f, b)];
    pool.forEach((v, i) => { v.hp = v.max * (0.2 + i * 0.1); });
    const d = others(f).find(u => !pool.includes(u))!;
    const before = new Map(f.party.map(u => [u.id, u.hp]));
    heroHeal(f, d, 100);
    const got = pool.filter(v => v.hp > before.get(v.id)! + 1e-9);
    expect(got.map(v => v.id)).toEqual(pool.slice(0, TX.allKnight.n).map(v => v.id));
    for (const v of got) expect(v.hp - before.get(v.id)!).toBeCloseTo(100 * (d.role === 'tank' ? 1.1 : 1) * BEACON.raid10 * TX.allKnight.share, 6);
  });
});

describe('설명 문장 수치', () => {
  it('보조 버튼 특성의 재사용 대기 · 지속은 설명과 같음', () => {
    for (const k of ['forestMemory', 'oldTree', 'dawnVow'] as TalentKey[]) {
      const a = TALENT_DEF[k].active!;
      expect(TALENT_DEF[k].desc).toContain(`${a.cd}초`);
    }
  });
  it('자동 힐러가 보조 버튼 특성을 씀 (드루이드 · 성기사)', () => {
    const run = (hero: Hero, keys: TalentKey[]) => {
      const f = E.create({ encounter: 'plague', diff: '보통', seed: 3, level: 100, hero, talents: picks(hero, keys) });
      for (let i = 0; i < 6000 && !f.over; i++) { E.autoHealer(f); E.step(f); f.events.length = 0; }
      return f;
    };
    expect(run('druid', ['springRain', 'forestMemory']).tx.act.springRain!.used).toBe(true);
    expect(run('paladin', ['resolveFill', 'dawnVow']).tx.act.dawnVow!.used).toBe(true);
  });
});
