/** 수도사 (79 3장): 스킬 · 기 리듬 · 떠도는 안개 · 패시브 · 특성 30 · 직업 전용 특수능력 24 */
import { describe, expect, it } from 'vitest';
import { MONK } from '../src/data/heroConst';
import { HEROES, heroSkills } from '../src/data/heroes';
import { SKILLS } from '../src/data/skills';
import { SPEC_KEYS, SPECS } from '../src/data/specials';
import { MONK_TALENTS, TALENT_TIER, TALENT_TREES, TX, type TalentKey } from '../src/data/talents';
import * as E from '../src/engine';
import { addDebuff, damage } from '../src/engine/core';
import { gcdOf } from '../src/engine/healer';
import { breathRange, misted, mistSpec, putMist } from '../src/engine/monk';
import { hasteOf } from '../src/engine/specials';
import { cdOf, costOf, talentReady, useTalent } from '../src/engine/talents';
import { totemsOf } from '../src/engine/totems';

type F = ReturnType<typeof E.create>;
type U = F['party'][number];
const picks = (keys: TalentKey[]) => {
  const tree = TALENT_TREES.monk, p: (number | null)[] = tree.map(() => null);
  for (const k of keys) p[TALENT_TIER[k]] = tree[TALENT_TIER[k]].picks.findIndex(x => x.key === k);
  return p;
};
const fight = (keys: TalentKey[] = [], specs: Record<string, number> = {}, o: { enc?: 'warden' | 'plague' | 'choir'; level?: number } = {}) => {
  const f = E.create({ encounter: o.enc ?? 'plague', diff: '보통', seed: 7, level: o.level ?? 100, hero: 'monk', talents: picks(keys), specs });
  f.gear.crit = 0; f.gear.haste = 0;
  f.power = 1; f.dmgMult = 1; f.gear.heal = 1; f.manaCut = 1;
  f.skills.forEach(s => { s.next = Infinity; });
  for (const u of f.party) { u.p = { ...u.p, flee: 0 }; u.ab = null; }
  return f;
};
const step = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const healsOf = (f: F) => { const out: { id: number; amt: number }[] = []; for (const e of f.events) if (e.type === 'heal') out.push(e); return out; };
/** 스킬을 쓰고 시전 · GCD가 끝날 때까지, 그동안 나온 치유 사건 */
const cast = (f: F, key: Parameters<typeof E.use>[1], cell: number) => {
  const r = E.use(f, key, cell);
  expect(r.ok, r.reason).toBe(true);
  const heals = healsOf(f); f.events.length = 0;
  let n = 0;
  while ((f.cast || f.gcd > 0 || f.queued) && n++ < 200) { E.step(f); heals.push(...healsOf(f)); f.events.length = 0; }
  return heals;
};
const healOn = (hs: { id: number; amt: number }[], u: U) => hs.filter(e => e.id === u.id).reduce((a, e) => a + e.amt, 0);
const others = (f: F) => f.party.filter(u => !u.me);
const adj = (f: F, u: U) => f.party.filter(v => v !== u && v.alive && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
const withAdj = (f: F, n = 1) => others(f).find(u => adj(f, u).length >= n)!;
const hurt = (f: F, pct = 0.5) => { for (const u of f.party) u.hp = u.max * pct; };
const full = (f: F) => { for (const u of f.party) u.hp = u.max; };
const big = (u: U) => { u.base = u.max = 50000; u.hp = 100; };
const taken = (f: F, u: U) => { const h = u.hp; damage(f, u, 100, false, 'fixed'); return h - u.hp; };
const mistOf = (u: U) => u.hots.find(h => h.key === 'wanderMist');
/** 수치 (79 3-11 간격 검사로 고친 값을 따라감) */
const P = SKILLS.vitalPalm.amt!, STEP = MONK.beat.step, M = SKILLS.wanderMist.amt!, B = SKILLS.mistBreath.amt!;
const PER = (M * MONK.mist.tick) / MONK.mist.sec;

describe('데이터 (79 3장)', () => {
  it('휠 8칸 (가운데 버튼 스킬 없음), 해제 마법 · 질병, 상점 해금, 켬', () => {
    expect(heroSkills('monk')).toEqual(['vitalPalm', 'mistWrap', 'wanderMist', 'mistBreath', 'clearChi', 'soothe', 'reviveWind', 'tea']);
    expect(HEROES.monk.ready).toBe(true);
    expect(HEROES.monk.unlock).toMatchObject({ buy: true }); // 81: 상점 2,200원 (예전 Lv 40)
    expect(HEROES.monk.dispel).toEqual(['마법', '질병']);
    expect(SKILLS.vitalPalm).toMatchObject({ cast: 0, gcd: 1.0, cost: 1.5 });
    expect(SKILLS.tea).toMatchObject({ gcd: 0, cost: 0, cd: 60 });
  });
  it('특성 10단 × 3, 보조 버튼은 천 개의 손 · 모이는 안개 · 기 폭발 · 안개 폭풍', () => {
    expect(MONK_TALENTS.map(t => t.lv)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    const act = MONK_TALENTS.flatMap(t => t.picks).filter(p => p.active).map(p => p.key);
    expect(act).toEqual(['thousandHands', 'gatherMist', 'chiBurst', 'mistStorm']);
  });
  it('전용 특수능력 24종 (수도 01~24)', () => {
    const ds = SPEC_KEYS.map(k => SPECS[k]).filter(d => d.hero === 'monk');
    expect(ds.map(d => d.no)).toEqual(Array.from({ length: 24 }, (_, i) => `수도 ${String(i + 1).padStart(2, '0')}`));
  });
});

describe('기 리듬 (79 3-3)', () => {
  it('생기 손바닥: 즉시, 다음 행동 1초, 리듬 1마다 +6% (올린 뒤), 최대 5', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    const amts: number[] = [];
    for (let i = 0; i < 6; i++) {
      E.use(f, 'vitalPalm', u.cell);
      if (i === 0) expect(f.gcd).toBeCloseTo(gcdOf(f, 'vitalPalm'), 6);
      amts.push(healOn(healsOf(f), u)); f.events.length = 0;
      step(f, 1.0);
    }
    expect(gcdOf(f, 'vitalPalm')).toBeCloseTo(1.0, 6);
    expect(amts).toEqual([1, 2, 3, 4, 5, 5].map(b => Math.round(P * (1 + b * STEP))));
    expect(f.beat).toBe(5);
  });
  it('2.5초 안에 다음 손바닥이 없으면 0으로', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    cast(f, 'vitalPalm', u.cell); cast(f, 'vitalPalm', u.cell);
    expect(f.beat).toBe(2);
    step(f, 2.6);
    expect(f.beat).toBe(0);
  });
  it('Lv 6 전에는 리듬이 안 오름', () => {
    const f = fight([], {}, { level: 5 }), u = others(f)[0];
    big(u);
    expect(healOn(cast(f, 'vitalPalm', u.cell), u)).toBe(P);
    expect(f.beat).toBe(0);
  });
  it('리듬 3부터 떠도는 안개 재사용이 두 배로 빨리 돎', () => {
    const f = fight(), u = others(f)[0];
    cast(f, 'wanderMist', u.cell);
    const cd0 = f.cd.wanderMist!;
    f.beat = 3; f.beatUntil = f.t + 100;
    step(f, 1);
    expect(cd0 - f.cd.wanderMist!).toBeCloseTo(2, 1);
    f.beat = 2;
    step(f, 1);
    expect(cd0 - f.cd.wanderMist!).toBeCloseTo(3, 1);
  });
  it('차 한 잔: GCD 중에도 바로 (GCD 안 씀), 마나 +5%, 리듬 +2', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    E.use(f, 'vitalPalm', u.cell);
    const g = f.gcd;
    f.mana = 50;
    expect(E.use(f, 'tea', 0).ok).toBe(true);
    expect(f.gcd).toBe(g);
    expect(f.mana).toBeCloseTo(55, 6);
    expect(f.beat).toBe(3);
    expect(f.cd.tea).toBe(60);
  });
});

describe('떠도는 안개 (79 3-2)', () => {
  it('18초 동안 3초마다, 모두 270, 재사용 6초', () => {
    const f = fight(), u = others(f)[0];
    cast(f, 'wanderMist', u.cell);
    expect(mistOf(u)).toMatchObject({ every: 3, rest: M });
    expect(mistOf(u)!.per).toBeCloseTo(PER, 6);
    expect(cdOf(f, 'wanderMist')).toBe(6);
  });
  it('대상이 다 차 있으면 붙은 아군 중 안개가 없고 잃은 체력이 가장 큰 아군에게 그 틱째 옮겨 감', () => {
    const f = fight(); full(f);
    const u = withAdj(f, 2), [a, b] = adj(f, u);
    a.hp = a.max - 200; b.hp = b.max - 500;
    putMist(f, u);
    step(f, 3.01);
    expect(mistOf(u)).toBeUndefined();
    expect(mistOf(b)?.rest).toBeCloseTo(M - PER, 6);
    expect(b.hp).toBeCloseTo(b.max - 500 + PER, 6);
    expect(a.hp).toBe(a.max - 200);
  });
  it('옮길 곳이 없으면 그 틱은 넘침 (안개는 그대로)', () => {
    const f = fight(); full(f);
    const u = others(f)[0];
    putMist(f, u);
    step(f, 3.01);
    expect(mistOf(u)?.rest).toBeCloseTo(M - PER, 6);
    expect(f.stats.overheal).toBeGreaterThan(0);
  });
  it('안개 감싸기 (82): 즉시 + 안개가 없으면 6초 90 (있으면 그대로), 시전 없음 · 규칙 GCD', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    expect(healOn(cast(f, 'mistWrap', u.cell), u)).toBe(SKILLS.mistWrap.amt);
    expect(f.cast).toBe(null);
    expect(gcdOf(f, 'mistWrap')).toBeCloseTo(f.gcdBase, 6);
    expect(mistOf(u)!.left).toBeCloseTo(MONK.wrapMist.sec - gcdOf(f, 'mistWrap'), 6); // 걸고 다음 행동까지 기다린 만큼 지남
    expect(mistOf(u)!.rest).toBe(MONK.wrapMist.amt);
    putMist(f, u);
    f.cd.mistWrap = 0;
    cast(f, 'mistWrap', u.cell);
    expect(mistOf(u)!.rest).toBe(M);
  });
  it('안개 감싸기 (82): 기 리듬 1마다 12% 더, 제때 쓰면 박자를 이어 줌 · 늦으면 리듬이 먼저 끊김', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    f.beat = 5; f.beatUntil = f.t + 1;
    const t0 = f.t;
    expect(healOn(cast(f, 'mistWrap', u.cell), u)).toBeCloseTo(SKILLS.mistWrap.amt! * (1 + 5 * MONK.wrap.step), 6);
    expect(f.beat).toBe(5);
    expect(f.beatUntil).toBeCloseTo(t0 + MONK.beat.window, 6);
    const g = fight(), v = others(g)[0];
    big(v);
    g.beat = 5; g.beatUntil = g.t - 0.5;
    expect(healOn(cast(g, 'mistWrap', v.cell), v)).toBe(SKILLS.mistWrap.amt);
    expect(g.beat).toBe(0);
  });
  it('안개 숨결: 대상과 붙은 6칸, 안개가 걸린 아군 +50%, 20인은 2칸', () => {
    const f = fight(); hurt(f, 0.1);
    const u = withAdj(f, 2), [a, b] = adj(f, u);
    putMist(f, a);
    const hs = cast(f, 'mistBreath', u.cell);
    expect(healOn(hs, a)).toBe(Math.round(B * 1.5));
    expect(healOn(hs, b)).toBe(B);
    expect(breathRange(f)).toBe(1);
    expect(breathRange(fight([], {}, { enc: 'choir' }))).toBe(2);
  });
  it('스며드는 안개 (Lv 4): 안개가 걸린 아군 손바닥 +15%', () => {
    const f = fight(), u = others(f)[0];
    big(u); putMist(f, u);
    expect(healOn(cast(f, 'vitalPalm', u.cell), u)).toBe(Math.round(P * (1 + STEP) * (1 + MONK.seep)));
  });
});

describe('다른 스킬 · 패시브', () => {
  it('누그러뜨림: 10초 받는 피해 −40%', () => {
    const f = fight(), u = others(f)[0];
    cast(f, 'soothe', u.cell);
    expect(taken(f, u)).toBeCloseTo(60, 6);
    step(f, 10.1);
    expect(taken(f, u)).toBeCloseTo(100, 6);
  });
  it('되살림 바람: 전원 350 + 한 명마다 마법 · 질병 1개 (함정 · 해제 막힘은 건너뜀)', () => {
    const f = fight(); hurt(f, 0.1);
    const [a, b, c] = others(f);
    for (const u of [a, b, c]) u.base = u.max = 5000;
    hurt(f, 0.1);
    addDebuff(f, a, { name: '마법', type: '마법', left: 30 });
    addDebuff(f, b, { name: '함정', type: '마법', left: 30, trap: true });
    addDebuff(f, c, { name: '막힘', type: '질병', left: 30, lock: true });
    const hs = cast(f, 'reviveWind', 0);
    expect(healOn(hs, a)).toBe(SKILLS.reviveWind.amt);
    expect(a.debuffs).toHaveLength(0);
    expect(b.debuffs).toHaveLength(1);
    expect(c.debuffs).toHaveLength(1);
  });
  it('고요한 호흡 (Lv 10): 마나 30% 아래가 되면 10초 마나 −50%, 전투마다 한 번', () => {
    const f = fight();
    const c0 = costOf(f, 'mistWrap');
    f.mana = 29;
    step(f, 0.05);
    expect(costOf(f, 'mistWrap')).toBeCloseTo(c0 * 0.5, 6);
    step(f, 10.1);
    f.mana = 20;
    step(f, 0.05);
    expect(costOf(f, 'mistWrap')).toBeCloseTo(c0, 6);
  });
});

describe('특성 (79 3-7)', () => {
  it('묵직한 손바닥 탱커 +20% · 급한 손바닥 30% 아래 +40%', () => {
    const f = fight(['heavyPalm']), t = f.party.find(u => u.role === 'tank')!;
    big(t);
    expect(healOn(cast(f, 'vitalPalm', t.cell), t)).toBe(Math.round(P * (1 + STEP) * (1 + TX.heavyPalm)));
    const g = fight(['urgentPalm']), u = others(g).find(x => x.role !== 'tank')!;
    u.hp = u.max * 0.2;
    expect(healOn(cast(g, 'vitalPalm', u.cell), u)).toBe(Math.round(P * (1 + STEP) * (1 + TX.urgentPalm.heal)));
  });
  it('가벼운 손바닥 −25% · 아끼는 안개 1% · 아끼는 숨결 7% · 끝없는 박자 리듬 5 이상 −50%', () => {
    expect(costOf(fight(['lightPalm']), 'vitalPalm')).toBeCloseTo(SKILLS.vitalPalm.cost * 0.75, 6);
    expect(costOf(fight(['mistThrift']), 'wanderMist')).toBeCloseTo(1, 6);
    expect(costOf(fight(['thriftBreath']), 'mistBreath')).toBeCloseTo(7, 6);
    const f = fight(['endlessBeat']);
    f.beat = 5;
    expect(costOf(f, 'vitalPalm')).toBeCloseTo(SKILLS.vitalPalm.cost * 0.5, 6);
  });
  it('튀는 손바닥: 30%가 붙은 가장 다친 1명에게 · 퍼지는 박자: 리듬 5 이상이면 2명에게 40%', () => {
    const f = fight(['palmSplash']); full(f);
    const u = withAdj(f, 1), v = adj(f, u)[0];
    big(u); v.hp = v.max * 0.5;
    const hs = cast(f, 'vitalPalm', u.cell);
    expect(healOn(hs, v)).toBe(Math.round(P * (1 + STEP) * TX.palmSplash));
    const g = fight(['beatSpread']); full(g);
    const w = withAdj(g, 2), [a, b] = adj(g, w);
    big(w); a.hp = a.max * 0.5; b.hp = b.max * 0.5;
    g.beat = 4; g.beatUntil = g.t + 5;
    const hs2 = cast(g, 'vitalPalm', w.cell);
    const amt = P * (1 + 5 * STEP);
    expect(healOn(hs2, a)).toBe(Math.round(amt * TX.beatSpread.share));
    expect(healOn(hs2, b)).toBe(Math.round(amt * TX.beatSpread.share));
  });
  it('품어 주기: 감싸기 대상 6초 −10%', () => {
    const f = fight(['embrace']), u = others(f)[0];
    cast(f, 'mistWrap', u.cell);
    expect(taken(f, u)).toBeCloseTo(90, 6);
  });
  it('기의 물결: 해제하면 대상과 붙은 6칸 80', () => {
    const f = fight(['chiWave']); hurt(f, 0.1);
    const u = withAdj(f, 1), v = adj(f, u)[0];
    addDebuff(f, u, { name: '마법', type: '마법', left: 30 });
    const hs = cast(f, 'clearChi', u.cell);
    expect(healOn(hs, v)).toBe(TX.chiWave.amt);
  });
  it('머무는 안개: 안 옮겨 가고 +30% · 긴 안개 24초 (그만큼) · 멀리 가는 안개 2칸, 옮겨 간 틱 +20%', () => {
    expect(mistSpec(fight(['stayMist'])).total).toBeCloseTo(M * 1.3, 6);
    expect(mistSpec(fight(['longMist']))).toEqual({ sec: 24, total: M * 24 / 18 });
    const f = fight(['stayMist']); full(f);
    const u = withAdj(f, 1), v = adj(f, u)[0];
    v.hp = v.max * 0.5;
    putMist(f, u);
    step(f, 3.01);
    expect(mistOf(u)).toBeDefined();
    const g = fight(['farMist']); full(g);
    const w = others(g)[0], far = others(g).find(x => E.hexDist(g.cells[x.cell], g.cells[w.cell]) === 2)!;
    far.hp = far.max * 0.5;
    const h0 = far.hp;
    putMist(g, w);
    step(g, 3.01);
    expect(mistOf(far)).toBeDefined();
    expect(far.hp - h0).toBeCloseTo(PER * (1 + TX.farMist.step), 6);
  });
  it('한 점 리듬: 같은 대상 리듬마다 9% · 느슨한 박자 3.5초 · 일곱 박자 7', () => {
    const f = fight(['focusBeat']), u = others(f)[0];
    big(u);
    cast(f, 'vitalPalm', u.cell);
    expect(healOn(cast(f, 'vitalPalm', u.cell), u)).toBe(Math.round(P * (1 + 2 * TX.focusBeat)));
    const g = fight(['wideBeat']), w = others(g)[0];
    big(w); cast(g, 'vitalPalm', w.cell);
    step(g, 2.4);
    expect(g.beat).toBe(1);
    const h = fight(['sevenBeat']), x = others(h)[0];
    big(x);
    for (let i = 0; i < 8; i++) cast(h, 'vitalPalm', x.cell);
    expect(h.beat).toBe(7);
  });
  it('흔들림 없는 마음: 끊기면 절반 (내림) · 천 개의 손: GCD 0.5 · 리듬 안 내려감', () => {
    const f = fight(['steadyMind']), u = others(f)[0];
    big(u);
    for (let i = 0; i < 5; i++) cast(f, 'vitalPalm', u.cell);
    step(f, 2.6);
    expect(f.beat).toBe(2);
    const g = fight(['thousandHands']), w = others(g)[0];
    big(w);
    expect(useTalent(g, 'thousandHands').ok).toBe(true);
    cast(g, 'vitalPalm', w.cell);
    expect(gcdOf(g, 'vitalPalm')).toBeCloseTo(0.5, 6);
    step(g, 5);
    expect(g.beat).toBe(1);
  });
  it('강철 몸: 리듬마다 내가 받는 피해 −4% (최대 20%) · 안개 몸 · 다시 부는 바람', () => {
    const f = fight(['ironBody']);
    f.me.base = f.me.max = f.me.hp = 50000;
    f.beat = 3; f.beatUntil = f.t + 10;
    expect(taken(f, f.me)).toBeCloseTo(88, 6);
    const g = fight(['mistBody']);
    g.me.base = g.me.max = 50000; g.me.hp = g.me.max * 0.3;
    step(g, 0.05);
    expect(mistOf(g.me)).toBeDefined();
    expect(taken(g, g.me)).toBeCloseTo(70, 6);
    const h = fight(['windAgain']);
    h.me.hp = 10;
    damage(h, h.me, 1e6, false, 'fixed');
    expect(h.me.alive).toBe(true);
    expect(h.me.hp).toBeCloseTo(h.me.max * TX.windAgain.hp, 6);
  });
  it('흩어지는 안개: 파티원이 쓰러지면 그 칸과 붙은 아군 3명에게 9초 안개', () => {
    const f = fight(['scatterMist']);
    const u = withAdj(f, 1);
    damage(f, u, 1e7, false, 'fixed');
    expect(u.alive).toBe(false);
    const got = f.party.filter(v => mistOf(v));
    expect(got.length).toBeGreaterThan(0);
    expect(got.length).toBeLessThanOrEqual(3);
    expect(mistOf(got[0])!.left).toBeCloseTo(9, 6);
  });
  it('안개 기둥: 가운데 두 배 · 바람 매듭: 탱커 두 배 · 안개 길 · 잔잔한 바람', () => {
    const f = fight(['mistPillar']); hurt(f, 0.1);
    const u = others(f)[0];
    expect(healOn(cast(f, 'mistBreath', u.cell), u)).toBe(B * 2);
    const g = fight(['windKnot']); hurt(g, 0.1);
    const t = g.party.find(x => x.role === 'tank')!;
    t.base = t.max = 50000; t.hp = 100;
    expect(healOn(cast(g, 'reviveWind', 0), t)).toBe(SKILLS.reviveWind.amt! * 2);
    const k = fight(['mistPath']); hurt(k, 0.1);
    cast(k, 'reviveWind', 0);
    expect(k.party.filter(x => x.alive).every(x => mistOf(x))).toBe(true);
    const h = fight(['calmWind']);
    const c0 = costOf(h, 'mistWrap');
    cast(h, 'reviveWind', 0);
    expect(costOf(h, 'mistWrap')).toBeCloseTo(c0 * (1 - TX.calmWind.cost), 6);
  });
  it('위기의 숨결: 광역 예고가 뜨면 안개 숨결 재사용이 바로 끝남', () => {
    const f = fight(['crisisBreath']);
    f.cd.mistBreath = 10;
    f.tels.push({ id: 99, kind: 'aoe', impact: f.t + 3, cells: new Set(), units: [], skill: {} } as never);
    step(f, 0.05);
    expect(f.cd.mistBreath).toBe(0);
  });
  it('모이는 안개: 빈 칸에 8초 안개 샘, 붙은 아군 초당 20 · 안개가 걸린 것으로 침', () => {
    const f = fight(['gatherMist']); hurt(f, 0.1);
    const c = f.cells.find(x => !x.unit && !x.block && f.party.some(v => E.hexDist(f.cells[v.cell], x) === 1))!;
    const v = f.party.find(x => E.hexDist(f.cells[x.cell], c) === 1)!;
    expect(useTalent(f, 'gatherMist', c.i).ok).toBe(true);
    expect(totemsOf(f, 'mist')).toHaveLength(1);
    expect(misted(f, v)).toBe(true);
    const h0 = v.hp;
    step(f, 1);
    expect(v.hp - h0).toBeCloseTo(TX.gatherMist.hps, 0);
  });
  it('기 폭발: 고른 칸 중심 2칸, 리듬마다 +10%, 리듬 0 · 안개 폭풍: 1.5초마다', () => {
    const f = fight(['chiBurst']); hurt(f, 0.1);
    const u = others(f)[0];
    u.base = u.max = 50000; u.hp = 100;
    f.beat = 4; f.beatUntil = f.t + 10;
    const h0 = u.hp;
    expect(useTalent(f, 'chiBurst', u.cell).ok).toBe(true);
    expect(u.hp - h0).toBeCloseTo(TX.chiBurst.amt * 1.4, 6);
    expect(f.beat).toBe(0);
    const g = fight(['mistStorm']), w = others(g)[0];
    big(w);
    putMist(g, w);
    expect(talentReady(g, 'mistStorm').ok).toBe(true);
    useTalent(g, 'mistStorm');
    step(g, 0.05);
    expect(mistOf(w)!.every).toBe(TX.mistStorm.tick);
    const h1 = w.hp;
    step(g, 3);
    expect(w.hp - h1).toBeCloseTo(PER * 2, 0);
  });
});

describe('직업 전용 특수능력 (79 3-8)', () => {
  const sp = (k: string, v = SPECS[k].val) => fight([], { [k]: v });
  it('깊은 박자: 리듬마다 손바닥 + · 곧은 손바닥 +', () => {
    const f = sp('deepBeat'), u = others(f)[0];
    big(u);
    expect(healOn(cast(f, 'vitalPalm', u.cell), u)).toBe(Math.round(P * (1 + STEP + SPECS.deepBeat.val)));
    const g = sp('steadyPalm'), w = others(g)[0];
    big(w);
    expect(healOn(cast(g, 'vitalPalm', w.cell), w)).toBe(Math.round(P * (1 + STEP) * (1 + SPECS.steadyPalm.val)));
  });
  it('갈라지는 안개: 처음 옮겨 갈 때 둘로 · 옮겨 가며 치유: 한 틱 더', () => {
    const f = sp('twinMist'); full(f);
    const u = withAdj(f, 2), [a, b] = adj(f, u);
    a.hp = a.max * 0.5; b.hp = b.max * 0.5;
    putMist(f, u);
    step(f, 3.01);
    expect([a, b].filter(v => mistOf(v)).length).toBe(2);
    const g = sp('hopHeal'); full(g);
    const w = withAdj(g, 1), v = adj(g, w)[0];
    v.hp = v.max * 0.5;
    const h0 = v.hp;
    putMist(g, w);
    step(g, 3.01);
    expect(v.hp - h0).toBeCloseTo(PER * 2, 6);
  });
  it('서두른 안개 −2초 · 빠른 감싸기 재사용 −1.5초 (82) · 넓은 숨결 +1칸 · 깊은 누그러뜨림 +10%p', () => {
    expect(cdOf(sp('hastyMist'), 'wanderMist')).toBeCloseTo(4, 6);
    expect(cdOf(sp('quickWrap'), 'mistWrap')).toBeCloseTo(SKILLS.mistWrap.cd! - 1.5, 6);
    expect(breathRange(sp('wideBreath'))).toBe(2);
    const f = sp('deepSoothe'), u = others(f)[0];
    cast(f, 'soothe', u.cell);
    expect(taken(f, u)).toBeCloseTo(50, 6);
  });
  it('진한 차 +2% · 박자의 마나 (리듬 5가 되면) · 기의 정화 (해제하면 리듬 +1)', () => {
    const f = sp('strongTea');
    f.mana = 50;
    E.use(f, 'tea', 0);
    expect(f.mana).toBeCloseTo(57, 6);
    const g = sp('beatMana'), u = others(g)[0];
    big(u);
    g.beat = 4; g.beatUntil = g.t + 5; g.mana = 50;
    E.use(g, 'vitalPalm', u.cell);
    expect(g.mana).toBeCloseTo(50 - SKILLS.vitalPalm.cost + SPECS.beatMana.val, 6);
    const h = sp('chiCleanse'), w = others(h)[0];
    addDebuff(h, w, { name: '마법', type: '마법', left: 30 });
    E.use(h, 'clearChi', w.cell);
    expect(h.beat).toBe(1);
  });
  it('맑은 바람: 되살림 바람이 한 명마다 디버프 하나 더', () => {
    const f = sp('clearWind'), u = others(f)[0];
    addDebuff(f, u, { name: '마법', type: '마법', left: 30 });
    addDebuff(f, u, { name: '질병', type: '질병', left: 30 });
    E.use(f, 'reviveWind', 0);
    expect(u.debuffs).toHaveLength(0);
  });
  it('안개 손길: 안개가 걸린 아군 직접 힐 + · 박자의 서두름: 리듬마다 가속 · 손바닥 안개: 확률로 6초 안개', () => {
    const f = sp('mistTouch'), u = others(f)[0];
    big(u); putMist(f, u);
    expect(healOn(cast(f, 'mistWrap', u.cell), u)).toBe(Math.round(SKILLS.mistWrap.amt! * (1 + SPECS.mistTouch.val)));
    const g = sp('beatHaste'), h0 = hasteOf(g);
    g.beat = 4;
    expect(hasteOf(g) - h0).toBeCloseTo(4 * SPECS.beatHaste.val, 6);
    const h = sp('palmMist', 1), w = others(h)[0];
    big(w);
    cast(h, 'vitalPalm', w.cell);
    expect(mistOf(w)?.left).toBeCloseTo(6 - 1, 1);
  });
});
