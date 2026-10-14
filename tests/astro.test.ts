/** 점성술사 (79 4장): 스킬 · 별자리 잇기 · 별 조각 · 표식 · 별의 잠 · 별의 기억 · 패시브 · 특성 30 · 직업 전용 특수능력 24 */
import { describe, expect, it } from 'vitest';
import { ASTRO } from '../src/data/heroConst';
import { HEROES, heroSkills } from '../src/data/heroes';
import { SKILLS } from '../src/data/skills';
import { SPEC_KEYS, SPECS } from '../src/data/specials';
import { ASTRO_TALENTS, TALENT_TIER, TALENT_TREES, TX, type TalentKey } from '../src/data/talents';
import * as E from '../src/engine';
import { addDebuff, damage, heal, unitById } from '../src/engine/core';
import { chargeRelease } from '../src/engine/healer';
import { chargeSpec } from '../src/engine/heroes';
import { asleep, fallSpec, memoryAmt, putMark, readMult } from '../src/engine/astro';
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
/** 모으기: 누르고 별이 want개 될 때까지 기다렸다 뗌 (want가 최대면 마지막 별 직후 = 완벽, late면 완벽 구간이 지난 뒤), 그 사이 치유 */
const charge = (f: F, key: 'starfall' | 'polaris', cell: number, want = 4, late = false) => {
  expect(E.use(f, key, cell).ok).toBe(true);
  f.events.length = 0;
  let n = 0;
  while (f.charge && f.charge.stars < want && n++ < 400) { E.step(f); f.events.length = 0; }
  if (late && f.charge && f.charge.full != null) step(f, 0.6);
  chargeRelease(f);
  return healsOf(f);
};
const healOn = (hs: { id: number; amt: number }[], u: U) => hs.filter(e => e.id === u.id).reduce((a, e) => a + e.amt, 0);
const others = (f: F) => f.party.filter(u => !u.me);
const adj = (f: F, u: U) => f.party.filter(v => v !== u && v.alive && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
const withAdj = (f: F, n = 1) => others(f).find(u => adj(f, u).length >= n)!;
const hurt = (f: F, pct = 0.5) => { for (const u of f.party) u.hp = u.max * pct; };
const big = (u: U) => { u.base = u.max = 50000; u.hp = 100; };
const taken = (f: F, u: U) => { const h = u.hp; damage(f, u, 100, false, 'fixed'); return h - u.hp; };
const markOf = (u: U) => u.hots.find(h => h.key === 'starMark');
const S = SKILLS.starHeal.amt!, T = SKILLS.twinkle.amt!, PERF = 1 + ASTRO.charge.perfectHeal;

describe('데이터 (79 4장)', () => {
  it('휠 8칸, 해제 마법 · 독, Lv 50 열림, 켬, 모으기 스킬 둘', () => {
    expect(heroSkills('astrologer')).toEqual(['starHeal', 'twinkle', 'starMark', 'starfall', 'clearStar', 'starSleep', 'starMemory', 'polaris']);
    expect(HEROES.astrologer.ready).toBe(true);
    expect(HEROES.astrologer.unlock.lv).toBe(50);
    expect(HEROES.astrologer.dispel).toEqual(['마법', '독']);
    expect(SKILLS.starfall.charge && SKILLS.polaris.charge).toBe(true);
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
  it('별비: 별 수마다 회복 · 범위 (1 대상 · 2 · 3 붙은 6칸 · 4 2칸 거리), 완벽 +15%', () => {
    const f = fight(); hurt(f, 0.05);
    for (const u of f.party) { u.base = u.max = 50000; u.hp = 100; }
    const u = withAdj(f, 1), v = adj(f, u)[0];
    expect([1, 2, 3, 4].map(n => fallSpec(f, n))).toEqual([{ amt: 380, r: 0 }, { amt: 150, r: 1 }, { amt: 220, r: 1 }, { amt: 150, r: 2 }]);
    const hs = charge(f, 'starfall', u.cell, 4);
    expect(healOn(hs, v)).toBe(Math.round(150 * PERF));
    const g = fight(); for (const x of g.party) { x.base = x.max = 50000; x.hp = 100; }
    const w = withAdj(g, 1), z = adj(g, w)[0];
    const hs2 = charge(g, 'starfall', w.cell, 1, true);
    expect(healOn(hs2, w)).toBe(380);
    expect(healOn(hs2, z)).toBe(0);
  });
  it('북극성: 별 1~4 = 350 · 550 · 750 · 950, 조각만큼 별을 단 채 시작, 재사용 · 마나는 뗄 때', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    f.shards = 2;
    const m0 = f.mana;
    expect(E.use(f, 'polaris', u.cell).ok).toBe(true);
    expect(f.charge!.stars).toBe(3);
    expect(f.mana).toBe(m0);
    let n = 0;
    while (f.charge!.stars < 4 && n++ < 100) E.step(f);
    f.events.length = 0;
    chargeRelease(f);
    expect(healOn(healsOf(f), u)).toBe(Math.round(950 * PERF));
    expect(f.cd.polaris).toBe(SKILLS.polaris.cd);
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
  it('별의 기억: 최근 4초 받은 피해의 50%, 적어도 100', () => {
    const f = fight(), u = others(f)[0];
    u.base = u.max = 50000; u.hp = 40000;
    damage(f, u, 4000, false, 'fixed');
    expect(memoryAmt(f, u)).toBeCloseTo(2000, 6);
    const v = others(f)[1];
    expect(memoryAmt(f, v)).toBe(SKILLS.starMemory.amt);
  });
  it('별 읽기 (Lv 4): 보스 예고가 찍힌 아군 힐 +15%', () => {
    const f = fight(), u = others(f)[0];
    expect(readMult(f, u)).toBe(1);
    f.tels.push({ id: 1, kind: 'aoe', impact: f.t + 3, cells: new Set([u.cell]), units: [], skill: {} } as never);
    expect(readMult(f, u)).toBeCloseTo(1 + ASTRO.read, 6);
  });
  it('별의 순환 (Lv 10): 완벽한 별자리마다 마나 2%', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    E.use(f, 'polaris', u.cell);
    let n = 0;
    while (f.charge!.stars < 4 && n++ < 100) E.step(f);
    f.mana = 50;
    chargeRelease(f);
    expect(f.mana).toBeCloseTo(50 - costOf(f, 'polaris') + ASTRO.cycle, 6);
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
  it('빠른 잇기 0.4초 · 다섯째 별 5개 · 내리는 밤 두 배 빨리 · 세 조각', () => {
    expect(chargeSpec(fight(['quickLink'])).step).toBeCloseTo(0.4, 6);
    expect(chargeSpec(fight(['fifthStar'])).max).toBe(5);
    const f = fight(['fallingNight']);
    useTalent(f, 'fallingNight');
    expect(chargeSpec(f).step).toBeCloseTo(0.25, 6);
    const g = fight(['threeShards']), u = others(g)[0];
    big(u);
    for (let i = 0; i < 4; i++) cast(g, 'starHeal', u.cell);
    expect(g.shards).toBe(3);
  });
  it('빛나는 북극성 · 한 점 · 떠오르는 북극성', () => {
    const f = fight(['brightPolaris']), u = others(f).find(x => x.role !== 'tank')!;
    big(u);
    const hs = charge(f, 'polaris', u.cell, 1, true);
    expect(healOn(hs, u)).toBe(Math.round(350 * (1 + TX.brightPolaris.heal)));
    const g = fight(['risingPolaris']), w = others(g)[0];
    big(w);
    charge(g, 'polaris', w.cell, 4);
    expect(g.cd.polaris).toBe(SKILLS.polaris.cd! - TX.risingPolaris);
  });
  it('맑은 밤: 별 2 · 3 범위 2칸, 회복 −20% · 넓은 하늘: 별 4 범위 3칸 −15% · 모이는 빛: 별 3 가운데 두 배', () => {
    expect(fallSpec(fight(['clearNight']), 3)).toEqual({ amt: 220 * 0.8, r: 2 });
    expect(fallSpec(fight(['wideSky']), 4)).toEqual({ amt: 150 * 0.85, r: 3 });
    const f = fight(['gatherLight']); for (const x of f.party) { x.base = x.max = 50000; x.hp = 100; }
    const u = withAdj(f, 1);
    const hs = charge(f, 'starfall', u.cell, 3, true);
    expect(healOn(hs, u)).toBe(Math.round(220 * 2));
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
  it('탱커의 기억 70% · 긴 기억 6초', () => {
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
    h.cd.starfall = 0;
    E.use(h, 'starfall', w.cell);
    expect(h.charge!.stars).toBe(4);
  });
});

describe('직업 전용 특수능력 (79 4-8)', () => {
  const sp = (k: string, v = SPECS[k].val) => fight([], { [k]: v });
  it('밝은 조각: 조각마다 다음 별자리 + · 쌍둥이 북극성', () => {
    const f = sp('brightShard'), u = others(f)[0];
    big(u); f.shards = 2;
    const hs = charge(f, 'polaris', u.cell, 4);
    expect(healOn(hs, u)).toBe(Math.round(950 * PERF * (1 + 2 * SPECS.brightShard.val)));
    const g = sp('twinPolaris'); hurt(g, 0.5);
    const w = withAdj(g, 1);
    big(w);
    const hs2 = charge(g, 'polaris', w.cell, 1, true);
    expect(adj(g, w).some(v => healOn(hs2, v) > 0)).toBe(true);
  });
  it('서두른 반짝임 −초 · 깊은 잠 +1초 · 완벽의 틈 +0.2초 · 오래 남는 표식 +4초', () => {
    expect(cdOf(sp('hastyTwinkle'), 'twinkle')).toBeCloseTo(SKILLS.twinkle.cd! - SPECS.hastyTwinkle.val, 6);
    const f = sp('deepSleep'), u = others(f)[0];
    const t0 = f.t;
    E.use(f, 'starSleep', u.cell);
    expect(u.sleep! - t0).toBeCloseTo(ASTRO.sleep.sec + 1, 6);
    expect(chargeSpec(sp('perfectWin')).perfect).toBeCloseTo(ASTRO.charge.perfect + SPECS.perfectWin.val, 6);
    const g = sp('markSec'), w = others(g)[0];
    putMark(g, w);
    expect(markOf(w)!.left).toBe(ASTRO.mark.sec + 4);
  });
  it('쏟아지는 별 · 조각의 마나 · 맑은 표식 · 옮겨 가는 표식', () => {
    const f = sp('shardMana'), u = others(f)[0];
    big(u); f.shards = 2; f.mana = 50;
    E.use(f, 'polaris', u.cell);
    expect(f.mana).toBeCloseTo(50 + 2 * SPECS.shardMana.val, 6);
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
  it('완벽의 서두름: 완벽 뒤 4초 가속 · 품고 온 조각: 전투 시작 조각 2', () => {
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
