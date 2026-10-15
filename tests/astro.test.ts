/** 점성술사 (79 4장): 스킬 · 별자리 잇기 · 별 조각 · 표식 · 별의 잠 · 별의 기억 · 패시브 · 특성 30 · 직업 전용 특수능력 24 */
import { describe, expect, it } from 'vitest';
import { ASTRO } from '../src/data/heroConst';
import { HEROES, heroSkills } from '../src/data/heroes';
import { SKILLS } from '../src/data/skills';
import { SPEC_KEYS, SPECS } from '../src/data/specials';
import { ASTRO_TALENTS, TALENT_TIER, TALENT_TREES, TX, type TalentKey } from '../src/data/talents';
import * as E from '../src/engine';
import { addDebuff, damage, heal, unitById } from '../src/engine/core';
import { asleep, fallSpec, memoryAmt, putMark, readMult, shardMax, starMax, starsNow } from '../src/engine/astro';
import { aggroTarget } from '../src/engine/bossParts';
import { hasteOf } from '../src/engine/specials';
import { castOf, cdOf, costOf, useTalent } from '../src/engine/talents';
import { totemsOf } from '../src/engine/totems';

type F = ReturnType<typeof E.create>;
type U = F['party'][number];
const picks = (keys: TalentKey[]) => {
  const tree = TALENT_TREES.astrologer, p: (number | null)[] = tree.map(() => null);
  for (const k of keys) p[TALENT_TIER[k]] = tree[TALENT_TIER[k]].picks.findIndex(x => x.key === k);
  return p;
};
const fight = (keys: TalentKey[] = [], specs: Record<string, number> = {}, level = 100) => {
  const f = E.create({ encounter: 'plague', diff: '보통', seed: 7, level, hero: 'astrologer', talents: picks(keys), specs });
  f.gear.crit = 0; f.gear.haste = 0;
  f.power = 1; f.dmgMult = 1; f.gear.heal = 1; f.manaCut = 1;
  f.skills.forEach(s => { s.next = Infinity; });
  for (const u of f.party) { u.p = { ...u.p, flee: 0 }; u.ab = null; }
  return f;
};
const step = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const healsOf = (f: F) => { const out: { id: number; amt: number }[] = []; for (const e of f.events) if (e.type === 'heal') out.push(e); return out; };
const cast = (f: F, key: Parameters<typeof E.use>[1], cell: number) => {
  const r = E.use(f, key, cell);
  expect(r.ok, r.reason).toBe(true);
  const heals = healsOf(f); f.events.length = 0;
  let n = 0;
  while ((f.cast || f.gcd > 0 || f.queued) && n++ < 200) { E.step(f); heals.push(...healsOf(f)); f.events.length = 0; }
  return heals;
};
/** 별자리 시전 (83): 조각을 want − 1개로 두고 시전해 별 want개로 터뜨림 (want가 최대면 가득 찬 별자리), 그 사이 치유 */
const charge = (f: F, key: 'starfall' | 'polaris' | 'starMemory', cell: number, want = 4) => {
  f.shards = want - 1;
  return cast(f, key, cell);
};
const healOn = (hs: { id: number; amt: number }[], u: U) => hs.filter(e => e.id === u.id).reduce((a, e) => a + e.amt, 0);
const others = (f: F) => f.party.filter(u => !u.me);
const adj = (f: F, u: U) => f.party.filter(v => v !== u && v.alive && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
const withAdj = (f: F, n = 1) => others(f).find(u => adj(f, u).length >= n)!;
const hurt = (f: F, pct = 0.5) => { for (const u of f.party) u.hp = u.max * pct; };
const big = (u: U) => { u.base = u.max = 50000; u.hp = 100; };
const taken = (f: F, u: U) => { const h = u.hp; damage(f, u, 100, false, 'fixed'); return h - u.hp; };
const markOf = (u: U) => u.hots.find(h => h.key === 'starMark');
const S = SKILLS.starHeal.amt!, T = SKILLS.twinkle.amt!, PERF = 1 + ASTRO.star.fullHeal;

describe('데이터 (79 4장)', () => {
  it('휠 8칸, 해제 마법 · 독, 상점 해금, 켬, 별자리 시전 스킬 셋 (83: 모으기를 없앰)', () => {
    expect(heroSkills('astrologer')).toEqual(['starHeal', 'twinkle', 'starMark', 'starfall', 'clearStar', 'starSleep', 'starMemory', 'polaris']);
    expect(HEROES.astrologer.ready).toBe(true);
    expect(HEROES.astrologer.unlock).toMatchObject({ buy: true }); // 81: 상점 2,200원 (예전 Lv 50)
    expect(HEROES.astrologer.dispel).toEqual(['마법', '독']);
    expect([SKILLS.starfall.cast, SKILLS.polaris.cast, SKILLS.starMemory.cast].every(c => c > 0)).toBe(true);
    expect(ASTRO.shard.max).toBe(3);
  });
  it('특성 10단 × 3, 보조 버튼은 내리는 밤 · 초신성 · 은하수', () => {
    expect(ASTRO_TALENTS.map(t => t.lv)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    expect(ASTRO_TALENTS.flatMap(t => t.picks).filter(p => p.active).map(p => p.key)).toEqual(['fallingNight', 'supernova', 'milkyWay']);
  });
  it('전용 특수능력 24종 (점성 01~24)', () => {
    const ds = SPEC_KEYS.map(k => SPECS[k]).filter(d => d.hero === 'astrologer');
    expect(ds.map(d => d.no)).toEqual(Array.from({ length: 24 }, (_, i) => `점성 ${String(i + 1).padStart(2, '0')}`));
  });
});

describe('스킬', () => {
  it('별빛 치유 2초 · 조각 +1 (최대 2) · 반짝임 즉시 · 조각 +1', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    expect(castOf(f, 'starHeal')).toBe(2);
    expect(healOn(cast(f, 'starHeal', u.cell), u)).toBe(S);
    expect(f.shards).toBe(1);
    expect(healOn(cast(f, 'twinkle', u.cell), u)).toBe(T);
    cast(f, 'starHeal', u.cell);
    expect(f.shards).toBe(ASTRO.shard.max);
  });
  it('별자리 표식: 8초 · 2초마다, 다음 직접 힐 +50% 한 번 (지속 힐은 남음)', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    cast(f, 'starMark', u.cell);
    expect(markOf(u)).toMatchObject({ every: ASTRO.mark.tick, bonus: true });
    expect(markOf(u)!.rest).toBeCloseTo(SKILLS.starMark.amt!, 6);
    expect(healOn(cast(f, 'twinkle', u.cell), u)).toBe(Math.round(T * (1 + ASTRO.mark.next)));
    expect(markOf(u)?.bonus).toBe(false);
    expect(healOn(cast(f, 'starHeal', u.cell), u)).toBe(S);
  });
  it('별비: 별 수마다 회복 · 범위 (1 대상 · 2 · 3 붙은 6칸 · 4 2칸 거리), 가득 찬 별자리 +15%', () => {
    const f = fight(); hurt(f, 0.05);
    for (const u of f.party) { u.base = u.max = 50000; u.hp = 100; }
    const u = withAdj(f, 1), v = adj(f, u)[0];
    expect([1, 2, 3, 4].map(n => fallSpec(f, n))).toEqual([{ amt: ASTRO.fall.amt[0], r: 0 }, { amt: ASTRO.fall.amt[1], r: 1 }, { amt: ASTRO.fall.amt[2], r: 1 }, { amt: ASTRO.fall.amt[3], r: 2 }]);
    const hs = charge(f, 'starfall', u.cell, 4);
    expect(healOn(hs, v)).toBe(Math.round(ASTRO.fall.amt[3] * PERF));
    const g = fight(); for (const x of g.party) { x.base = x.max = 50000; x.hp = 100; }
    const w = withAdj(g, 1), z = adj(g, w)[0];
    const hs2 = charge(g, 'starfall', w.cell, 1);
    expect(healOn(hs2, w)).toBe(ASTRO.fall.amt[0]);
    expect(healOn(hs2, z)).toBe(0);
  });
  it('북극성 (83 시전): 별 1 + 조각 = ASTRO.polaris, 조각은 시전이 끝날 때 다 씀, 재사용 · 마나도 그때', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    f.shards = 3;
    const m0 = f.mana;
    expect(E.use(f, 'polaris', u.cell).ok).toBe(true);
    expect(f.cast?.key).toBe('polaris');
    expect(f.mana).toBe(m0);
    expect(f.shards).toBe(3);
    const hs = cast(f, 'twinkle', u.cell); // 시전 중 다른 스킬 = 시전 취소 (보통 시전과 같음)
    expect(hs.length).toBeGreaterThan(0);
    f.shards = 1; f.cd.twinkle = 0;
    const hs2 = charge(f, 'polaris', u.cell, 2);
    expect(healOn(hs2, u)).toBe(ASTRO.polaris[1]);
    expect(f.shards).toBe(0);
    expect(f.cd.polaris).toBe(SKILLS.polaris.cd);
    f.cd.polaris = 0;
    expect(healOn(charge(f, 'polaris', u.cell, 4), u)).toBe(Math.round(ASTRO.polaris[3] * PERF));
  });
  it('별의 잠: 4초 피해 · 회복 · 딜 없음, 탱커가 자면 보스가 다른 사람을 침', () => {
    const f = fight(), t = f.party.find(u => u.role === 'tank')!;
    cast(f, 'starSleep', t.cell);
    expect(asleep(f, t)).toBe(true);
    expect(taken(f, t)).toBe(0);
    expect(heal(f, t, 100, true)).toBe(0);
    expect(aggroTarget(f)?.id).not.toBe(t.id);
    step(f, 4.1);
    expect(asleep(f, t)).toBe(false);
    expect(taken(f, t)).toBeGreaterThan(0);
  });
  it('별의 기억: 별 2개 = 최근 4초 받은 피해의 65% (84), 적어도 100', () => {
    const f = fight(), u = others(f)[0];
    u.base = u.max = 50000; u.hp = 40000;
    damage(f, u, 4000, false, 'fixed');
    expect(memoryAmt(f, u)).toBeCloseTo(4000 * ASTRO.memory.share, 6);
    const v = others(f)[1];
    expect(memoryAmt(f, v)).toBe(SKILLS.starMemory.amt);
  });
  it('별의 기억 (82 모으기): 별 1개마다 2초씩 더 먼 피해를 되감음', () => {
    const f = fight(), u = others(f)[0];
    f.skills.forEach(k => { k.next = Infinity; }); f.tels = [];
    u.base = u.max = 50000; u.hp = 40000;
    damage(f, u, 4000, false, 'fixed');
    step(f, 5);
    damage(f, u, 1000, false, 'fixed');
    const k = ASTRO.memory.share;
    expect(memoryAmt(f, u, 1)).toBeCloseTo(1000 * k, 6); // 최근 2초
    expect(memoryAmt(f, u, 2)).toBeCloseTo(1000 * k, 6); // 최근 4초
    expect(memoryAmt(f, u, 3)).toBeCloseTo(5000 * k, 6); // 최근 6초 (5초 전 피해까지)
    expect(memoryAmt(f, u, 4)).toBeCloseTo(5000 * k, 6);
  });
  it('별의 기억 (82 · 83): 시전이 끝날 때 별 수만큼 · 가득 찬 별자리 +15% · 마나 · 재사용', () => {
    const f = fight(), u = others(f)[0];
    f.skills.forEach(k => { k.next = Infinity; }); f.tels = [];
    u.base = u.max = 50000; u.hp = 40000;
    damage(f, u, 4000, false, 'fixed');
    step(f, 1);
    const mana = f.mana;
    const hs = charge(f, 'starMemory', f.me.cell, 4);
    expect(healOn(hs, u)).toBeCloseTo(memoryAmt(f, u, 4) * PERF * f.gear.heal * f.power, 0);
    expect(f.cd.starMemory).toBe(SKILLS.starMemory.cd);
    expect(f.mana).toBeLessThan(mana);
  });
  it('별 읽기 (Lv 4): 보스 예고가 찍힌 아군 힐 +15%', () => {
    const f = fight(), u = others(f)[0];
    expect(readMult(f, u)).toBe(1);
    f.tels.push({ id: 1, kind: 'aoe', impact: f.t + 3, cells: new Set([u.cell]), units: [], skill: {} } as never);
    expect(readMult(f, u)).toBeCloseTo(1 + ASTRO.read, 6);
  });
  it('별의 순환 (Lv 10): 가득 찬 별자리마다 마나 3%', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    f.shards = shardMax(f);
    E.use(f, 'polaris', u.cell);
    f.mana = 50;
    let n = 0;
    while (f.cast && n++ < 400) E.step(f);
    expect(f.mana).toBeGreaterThan(50 - costOf(f, 'polaris') + ASTRO.cycle - 1e-6);
    expect(f.mana).toBeLessThan(50 - costOf(f, 'polaris') + ASTRO.cycle + 3); // 시전 동안 마나 재생만큼 더
  });
});

describe('특성 (79 4-7)', () => {
  it('밝은 별 −0.3초 · 작은 반짝임 −30% · 아끼는 별비 9% · 아끼는 기억 8%', () => {
    expect(castOf(fight(['brightStar']), 'starHeal')).toBeCloseTo(1.7, 6);
    expect(costOf(fight(['smallTwinkle']), 'twinkle')).toBeCloseTo(SKILLS.twinkle.cost * 0.7, 6);
    expect(costOf(fight(['thriftFall']), 'starfall')).toBeCloseTo(9, 6);
    expect(costOf(fight(['thriftMemory']), 'starMemory')).toBeCloseTo(8, 6);
  });
  it('새긴 표식 80% · 이어진 표식 · 표식의 숨', () => {
    const f = fight(['etchedMark']), u = others(f)[0];
    big(u); putMark(f, u);
    expect(healOn(cast(f, 'twinkle', u.cell), u)).toBe(Math.round(T * 1.8));
    const g = fight(['linkedMark']); hurt(g, 0.5);
    const w = withAdj(g, 1);
    cast(g, 'starMark', w.cell);
    expect(adj(g, w).some(v => markOf(v))).toBe(true);
  });
  it('빠른 잇기 −0.5초 · 다섯째 별 (조각 4 · 별 5) · 내리는 밤 별자리 즉시 · 넉넉한 조각 (반짝임 2개) (83)', () => {
    expect(castOf(fight(['quickLink']), 'starfall')).toBeCloseTo(SKILLS.starfall.cast - TX.quickLink, 6);
    expect(castOf(fight(['quickLink']), 'starHeal')).toBeCloseTo(SKILLS.starHeal.cast, 6);
    const e = fight(['fifthStar']);
    expect([shardMax(e), starMax(e)]).toEqual([4, 5]);
    const f = fight(['fallingNight']);
    useTalent(f, 'fallingNight');
    expect(['starfall', 'polaris', 'starMemory'].map(k => castOf(f, k as 'starfall'))).toEqual([0, 0, 0]);
    const g = fight(['threeShards']), u = others(g)[0];
    big(u);
    cast(g, 'twinkle', u.cell);
    expect(g.shards).toBe(TX.threeShards);
  });
  it('빛나는 북극성 · 한 점 · 떠오르는 북극성', () => {
    const f = fight(['brightPolaris']), u = others(f).find(x => x.role !== 'tank')!;
    big(u);
    const hs = charge(f, 'polaris', u.cell, 1);
    expect(healOn(hs, u)).toBe(Math.round(ASTRO.polaris[0] * (1 + TX.brightPolaris.heal)));
    const g = fight(['risingPolaris']), w = others(g)[0];
    big(w);
    charge(g, 'polaris', w.cell, 4);
    expect(g.cd.polaris).toBe(SKILLS.polaris.cd! - TX.risingPolaris);
  });
  it('맑은 밤: 별 2 · 3 범위 2칸, 회복 −20% · 넓은 하늘: 별 4 범위 3칸 −15% · 모이는 빛: 별 3 가운데 두 배', () => {
    expect(fallSpec(fight(['clearNight']), 3)).toEqual({ amt: ASTRO.fall.amt[2] * 0.8, r: 2 });
    expect(fallSpec(fight(['wideSky']), 4)).toEqual({ amt: ASTRO.fall.amt[3] * 0.85, r: 3 });
    const f = fight(['gatherLight']); for (const x of f.party) { x.base = x.max = 50000; x.hp = 100; }
    const u = withAdj(f, 1);
    const hs = charge(f, 'starfall', u.cell, 3);
    expect(healOn(hs, u)).toBe(Math.round(ASTRO.fall.amt[2] * 2));
  });
  it('지지 않는 별: 죽을 피해 → 별의 잠 (1회) · 차분한 손 · 별 무리', () => {
    const f = fight(['unfading']);
    f.me.base = f.me.max = 1000; f.me.hp = 100;
    damage(f, f.me, 5000, false, 'fixed');
    expect(f.me.alive).toBe(true);
    expect(asleep(f, f.me)).toBe(true);
    const g = fight(['calmHands']);
    g.me.base = g.me.max = g.me.hp = 50000;
    E.use(g, 'polaris', others(g)[0].cell);
    expect(taken(g, g.me)).toBeCloseTo(70, 6);
    const h = fight(['starCrowd']);
    h.me.base = h.me.max = h.me.hp = 50000;
    h.shards = 2;
    expect(taken(h, h.me)).toBeCloseTo(84, 6);
  });
  it('예언 · 내다본 손 · 떨어지는 별', () => {
    const f = fight(['prophecy']), t = f.party.find(u => u.role === 'tank')!;
    f.tels.push({ id: 5, kind: 'buster', impact: f.t + 3, cells: new Set([t.cell]), units: [t.id], skill: {} } as never);
    step(f, 0.05);
    expect(markOf(t)).toBeDefined();
    const g = fight(['foreseen']);
    g.tels.push({ id: 5, kind: 'aoe', impact: g.t + 3, cells: new Set(), units: [], skill: {} } as never);
    step(g, 0.05);
    expect(g.shards).toBe(TX.foreseen.n);
    const h = fight(['fallingStar']);
    h.cd.twinkle = 8;
    others(h)[0].hp = others(h)[0].max * 0.2;
    step(h, 0.05);
    expect(h.cd.twinkle).toBe(0);
  });
  it('탱커의 기억 70% · 긴 기억 별 1개마다 3초 (82)', () => {
    const f = fight(['tankMemory']), t = f.party.find(u => u.role === 'tank')!;
    t.base = t.max = 50000; t.hp = 40000;
    damage(f, t, 4000, false, 'fixed');
    expect(memoryAmt(f, t)).toBeCloseTo(2800, 6);
  });
  it('초신성: 빈 칸 3초 뒤 2칸 거리 400 · 은하수: 별빛 치유 즉시 · 조각 2 · 별의 길', () => {
    const f = fight(['supernova']); for (const x of f.party) { x.base = x.max = 50000; x.hp = 100; }
    const c = f.cells.find(x => !x.unit && !x.block && f.party.some(v => E.hexDist(f.cells[v.cell], x) === 1))!;
    const v = f.party.find(x => E.hexDist(f.cells[x.cell], c) === 1)!;
    expect(useTalent(f, 'supernova', c.i).ok).toBe(true);
    expect(totemsOf(f, 'nova')).toHaveLength(1);
    const h0 = v.hp;
    step(f, 3.1);
    expect(v.hp - h0).toBeCloseTo(TX.supernova.amt, 0);
    const g = fight(['milkyWay']), u = others(g)[0];
    big(u);
    useTalent(g, 'milkyWay');
    expect(castOf(g, 'starHeal')).toBe(0);
    cast(g, 'starHeal', u.cell);
    expect(g.shards).toBe(2);
    const h = fight(['starPath']), w = others(h)[0];
    big(w);
    charge(h, 'polaris', w.cell, 4);
    expect(h.shards).toBe(0);
    expect(starsNow(h)).toBe(4); // 별의 길: 조각이 없어도 다음 별자리는 가득
  });
});

describe('직업 전용 특수능력 (79 4-8)', () => {
  const sp = (k: string, v = SPECS[k].val) => fight([], { [k]: v });
  it('밝은 조각: 조각마다 다음 별자리 + · 쌍둥이 북극성', () => {
    const f = sp('brightShard'), u = others(f)[0];
    big(u);
    const hs = charge(f, 'polaris', u.cell, 4);
    expect(healOn(hs, u)).toBe(Math.round(ASTRO.polaris[3] * PERF * (1 + 3 * SPECS.brightShard.val)));
    const g = sp('twinPolaris'); hurt(g, 0.5);
    const w = withAdj(g, 1);
    big(w);
    const hs2 = charge(g, 'polaris', w.cell, 1);
    expect(adj(g, w).some(v => healOn(hs2, v) > 0)).toBe(true);
  });
  it('서두른 반짝임 −초 · 깊은 잠 +1초 · 빠른 별자리 −0.3초 (83) · 오래 남는 표식 +4초', () => {
    expect(cdOf(sp('hastyTwinkle'), 'twinkle')).toBeCloseTo(SKILLS.twinkle.cd! - SPECS.hastyTwinkle.val, 6);
    const f = sp('deepSleep'), u = others(f)[0];
    const t0 = f.t;
    E.use(f, 'starSleep', u.cell);
    expect(u.sleep! - t0).toBeCloseTo(ASTRO.sleep.sec + 1, 6);
    expect(castOf(sp('perfectWin'), 'polaris')).toBeCloseTo(SKILLS.polaris.cast - SPECS.perfectWin.val, 6);
    const g = sp('markSec'), w = others(g)[0];
    putMark(g, w);
    expect(markOf(w)!.left).toBe(ASTRO.mark.sec + 4);
  });
  it('쏟아지는 별 · 조각의 마나 · 맑은 표식 · 옮겨 가는 표식', () => {
    const [f, f0] = [sp('shardMana'), fight()];
    for (const x of [f, f0]) { const u = others(x)[0]; big(u); x.shards = 2; x.mana = 50; cast(x, 'polaris', u.cell); }
    expect(f.mana - f0.mana).toBeCloseTo(2 * SPECS.shardMana.val, 6); // 시전이 끝날 때 조각마다
    const g = sp('clearMark'), w = others(g)[0];
    addDebuff(g, w, { name: '독', type: '독', left: 30 });
    cast(g, 'clearStar', w.cell);
    expect(markOf(w)).toBeDefined();
    const h = sp('markEcho'); hurt(h, 0.5);
    const x = withAdj(h, 1);
    putMark(h, x);
    cast(h, 'twinkle', x.cell);
    expect(adj(h, x).some(v => markOf(v)?.bonus)).toBe(true);
  });
  it('가득 찬 별의 서두름: 가득 찬 별자리 뒤 4초 가속 · 품고 온 조각: 전투 시작 조각 2', () => {
    const f = sp('perfectHaste'), u = others(f)[0];
    big(u);
    const h0 = hasteOf(f);
    charge(f, 'polaris', u.cell, 4);
    expect(hasteOf(f) - h0).toBeCloseTo(SPECS.perfectHaste.val, 6);
    const g = sp('shardStart');
    step(g, 0.1);
    expect(g.shards).toBe(2);
    expect(unitById(g, g.me.id)).toBe(g.me);
  });
});
