/** 주술사 (79 2장): 스킬 · 토템 칸 · 패시브 · 특성 30 · 직업 전용 특수능력 24 */
import { describe, expect, it } from 'vitest';
import { SHAMAN } from '../src/data/heroConst';
import { HEROES, heroSkills } from '../src/data/heroes';
import { SKILLS } from '../src/data/skills';
import { SPEC_KEYS, SPECS } from '../src/data/specials';
import { SHAMAN_TALENTS, TALENT_TIER, TALENT_TREES, TX, type TalentKey } from '../src/data/talents';
import * as E from '../src/engine';
import { absorbLeft } from '../src/engine/abilities';
import { addDebuff, damage } from '../src/engine/core';
import { putHot } from '../src/engine/heroes';
import { chainPath, springPulse } from '../src/engine/shaman';
import { hasteOf } from '../src/engine/specials';
import { castOf, cdOf, costOf, talentReady, useTalent } from '../src/engine/talents';
import { placeTotem, totemsOf } from '../src/engine/totems';

type F = ReturnType<typeof E.create>;
type U = F['party'][number];
const picks = (keys: TalentKey[]) => {
  const tree = TALENT_TREES.shaman, p: (number | null)[] = tree.map(() => null);
  for (const k of keys) p[TALENT_TIER[k]] = tree[TALENT_TIER[k]].picks.findIndex(x => x.key === k);
  return p;
};
const fight = (keys: TalentKey[] = [], specs: Record<string, number> = {}, enc: 'warden' | 'plague' = 'plague') => {
  const f = E.create({ encounter: enc, diff: '보통', seed: 7, level: 100, hero: 'shaman', talents: picks(keys), specs });
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
const others = (f: F) => f.party.filter(u => !u.me);
const adj = (f: F, u: U) => f.party.filter(v => v !== u && v.alive && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
const withAdj = (f: F, n = 1) => others(f).find(u => adj(f, u).length >= n)!;
const hurt = (f: F, pct = 0.5) => { for (const u of f.party) u.hp = u.max * pct; };
const taken = (f: F, u: U) => { const h = u.hp; damage(f, u, 100, false, 'fixed'); return h - u.hp; };
const drop = (u: U) => u.hots.find(h => h.key === 'droplet');
const emptyCell = (f: F) => f.cells.find(c => !c.unit && !c.block)!.i;
/** 수치 (79 2-11 간격 검사로 고친 값을 따라감) */
const R = SKILLS.ripple.amt!, D = SKILLS.droplet.amt!, C = SKILLS.chainHeal.amt!, SP = SKILLS.springTotem.amt!, RT = SKILLS.rainTotem.amt!;
const DEEP = 1 + SHAMAN.deep.heal, DEC = SHAMAN.chain.decay;

describe('데이터 (79 2장)', () => {
  it('휠 8칸 (2026-10-16 가운데 버튼을 없애고 소나기 자리에 샘 토템), 해제 마법 · 저주, 상점 해금, 켬', () => {
    expect(heroSkills('shaman')).toEqual(['ripple', 'springTotem', 'droplet', 'chainHeal', 'washing', 'earthTotem', 'rainTotem', 'spiritLink']);
    expect(HEROES.shaman.core).toBeUndefined();
    expect(HEROES.shaman.ready).toBe(true);
    expect(HEROES.shaman.unlock).toMatchObject({ buy: true }); // 81: 상점 2,200원 (예전 Lv 30)
    expect(SKILLS.springTotem).toMatchObject({ slot: 'fast', target: 'cell', cost: 4, cd: 10 });
    expect(SKILLS.springTotem.core).toBeUndefined();
  });
  it('특성 10단 × 3, 보조 버튼은 토템 부르기 · 물의 정령 · 바다의 자리', () => {
    expect(SHAMAN_TALENTS.map(t => t.lv)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    const act = SHAMAN_TALENTS.flatMap(t => t.picks).filter(p => p.active).map(p => p.key);
    expect(act).toEqual(['totemCall', 'waterSpirit', 'seaSeat']);
  });
  it('전용 특수능력 24종 (주술 01~24)', () => {
    const ds = SPEC_KEYS.map(k => SPECS[k]).filter(d => d.hero === 'shaman');
    expect(ds.map(d => d.no)).toEqual(Array.from({ length: 24 }, (_, i) => `주술 ${String(i + 1).padStart(2, '0')}`));
  });
});

describe('스킬', () => {
  it('잔물결, 깊은 물: 체력 50% 아래 대상 직접 힐 +', () => {
    const f = fight(), u = others(f)[0];
    u.base = u.max = 5000; u.hp = u.max * 0.9;
    expect(cast(f, 'ripple', u.cell).find(e => e.id === u.id)!.amt).toBe(R);
    u.hp = u.max * 0.3;
    expect(cast(f, 'ripple', u.cell).find(e => e.id === u.id)!.amt).toBe(Math.round(R * DEEP));
  });
  it('잔물결 (82): 붙어 있는 가장 다친 아군에게 40% 한 번 튐, 다친 아군이 없으면 안 튐', () => {
    const f = fight(), u = withAdj(f, 2), [a, b] = adj(f, u);
    for (const x of f.party) { x.base = x.max = 5000; x.hp = x.max; }
    u.hp = u.max * 0.9; a.hp = a.max * 0.6; b.hp = b.max * 0.8;
    const hs = cast(f, 'ripple', u.cell);
    expect(hs.find(e => e.id === a.id)!.amt).toBe(Math.round(R * SHAMAN.ripple.bounce));
    expect(hs.some(e => e.id === b.id)).toBe(false);
    a.hp = a.max; b.hp = b.max; u.hp = u.max * 0.9;
    expect(cast(f, 'ripple', u.cell).filter(e => e.id !== u.id)).toEqual([]);
  });
  it('물방울: 12초 · 3초마다, 재사용', () => {
    const f = fight(), u = others(f)[0];
    cast(f, 'droplet', u.cell);
    expect(drop(u)).toMatchObject({ every: 3, rest: D });
    expect(cdOf(f, 'droplet')).toBe(SKILLS.droplet.cd);
  });
  it('연쇄 치유: 튈 때마다 25% 줄고, 붙은 다친 아군 중 가장 낮은 쪽으로, 4명까지', () => {
    const f = fight(); hurt(f, 0.2);
    const u = withAdj(f, 2), path = chainPath(f, u);
    expect(path.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < path.length; i++) expect(E.hexDist(f.cells[path[i].cell], f.cells[path[i - 1].cell])).toBe(1);
    const hs = cast(f, 'chainHeal', u.cell);
    const amts = path.map(v => hs.find(e => e.id === v.id)!.amt);
    expect(amts).toEqual([1, DEC, DEC ** 2, DEC ** 3].slice(0, path.length).map(x => Math.round(C * x * DEEP)));
  });
  it('연쇄 치유: 다 찬 사람에게는 안 튀고, 물방울이 걸린 아군에게는 2칸 거리까지', () => {
    const f = fight();
    for (const u of f.party) u.hp = u.max;
    const u = withAdj(f, 1);
    u.hp = u.max * 0.5;
    expect(chainPath(f, u)).toEqual([u]);
    const far = others(f).find(v => E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 2)!;
    far.hp = far.max * 0.5;
    expect(chainPath(f, u)).toEqual([u]);
    putHot(far, 'droplet', { sec: 12, every: 3, total: 210 });
    expect(chainPath(f, u)).toContain(far);
  });
  it('밀려오는 물: 연쇄가 4명에게 닿으면 마나 1.5%', () => {
    const f = fight(); hurt(f, 0.2);
    const u = withAdj(f, 3);
    const n = chainPath(f, u).length;
    const m0 = f.mana;
    cast(f, 'chainHeal', u.cell);
    const spent = SKILLS.chainHeal.cost;
    expect(f.mana - (m0 - spent)).toBeCloseTo(n >= 4 ? 1.5 + f.R.regen * f.gear.regen * f.enc.manaCoef * (f.t) : 0, 0);
  });
  it('대지 토템: 대상 칸에 서고 (움직여도 그 칸), 칸과 붙은 6칸 받는 피해 −15%', () => {
    const f = fight(), u = withAdj(f, 1), v = adj(f, u)[0];
    const far = others(f).find(x => E.hexDist(f.cells[x.cell], f.cells[u.cell]) >= 2)!;
    cast(f, 'earthTotem', u.cell);
    expect(totemsOf(f, 'earth')[0].cell).toBe(u.cell);
    expect(taken(f, u)).toBeCloseTo(85, 6);
    expect(taken(f, v)).toBeCloseTo(85, 6);
    expect(taken(f, far)).toBeCloseTo(100, 6);
  });
  it('샘 · 대지 토템: 빈 칸에도 세움 (2026-10-16 Lim), 무너진 바닥은 안 됨', () => {
    const f = fight(), free = f.cells.filter(c => !c.unit && !c.block && f.party.some(v => v.alive && E.hexDist(f.cells[v.cell], c) === 1)).map(c => c.i);
    expect(SKILLS.earthTotem.target).toBe('cell');
    expect(SKILLS.springTotem.target).toBe('cell');
    cast(f, 'earthTotem', free[0]);
    expect(totemsOf(f, 'earth')[0].cell).toBe(free[0]);
    const nb = f.party.find(v => v.alive && E.hexDist(f.cells[v.cell], f.cells[free[0]]) === 1)!;
    expect(taken(f, nb)).toBeCloseTo(85, 6); // 빈 칸 토템도 붙은 칸 아군을 지킴
    cast(f, 'springTotem', free[1]);
    expect(totemsOf(f, 'spring')[0].cell).toBe(free[1]);
    const hole = f.cells.find(c => !c.unit && !c.block && !free.slice(0, 2).includes(c.i))!;
    hole.block = 'hole';
    expect(E.canTarget(f, 'earthTotem', hole.i).ok).toBe(false);
  });
  it('비구름 토템: 채널 아님, 10초 동안 2초마다 전원 (5번)', () => {
    const f = fight(); hurt(f, 0.2);
    const u = others(f)[0];
    u.base = u.max = 5000; u.hp = 100;
    const h0 = u.hp;
    E.use(f, 'rainTotem', 0);
    expect(f.channel).toBe(0);
    step(f, 10.1);
    expect(u.hp - h0).toBeCloseTo(RT * 5, 0);
    step(f, 4);
    expect(u.hp - h0).toBeCloseTo(RT * 5, 0);
  });
  it('영혼 잇기: 대상과 붙은 아군 체력 비율을 평균으로, 6초 받는 피해 −10%', () => {
    const f = fight(), u = withAdj(f, 2), vs = [u, ...adj(f, u)];
    vs.forEach((v, i) => { v.hp = v.max * (i === 0 ? 0.2 : 0.8); });
    const r = vs.reduce((a, v) => a + v.hp / v.max, 0) / vs.length;
    cast(f, 'spiritLink', u.cell);
    for (const v of vs) expect(v.hp / v.max).toBeCloseTo(r, 6);
    expect(taken(f, u)).toBeCloseTo(90, 6);
    step(f, 6.1);
    expect(taken(f, u)).toBeCloseTo(100, 6);
  });
});

describe('토템 칸 (79 2-3)', () => {
  it('샘 토템: 15초 동안 3초마다 칸과 붙은 6칸 아군 (5번), 다시 세우면 앞의 것은 사라짐', () => {
    const f = fight(); hurt(f, 0.2);
    const u = withAdj(f, 1), v = adj(f, u)[0];
    v.base = v.max = 5000; v.hp = 100;
    const h0 = v.hp;
    E.use(f, 'springTotem', u.cell);
    step(f, 15.1);
    expect(v.hp - h0).toBeCloseTo(SP * 5, 0);
    expect(totemsOf(f, 'spring')).toHaveLength(0);
    E.use(f, 'springTotem', u.cell); step(f, 10.1);
    E.use(f, 'springTotem', v.cell); step(f, 0.1);
    expect(totemsOf(f, 'spring').map(t => t.cell)).toEqual([v.cell]);
  });
  it('장판이 깔리면 깨짐', () => {
    const f = fight(), c = emptyCell(f);
    E.use(f, 'springTotem', c); step(f, 0.1);
    f.zones.push({ id: 1, cells: new Set([c]), end: f.t + 5, dps: 0 });
    step(f, 0.1);
    expect(totemsOf(f, 'spring')).toHaveLength(0);
  });
});

describe('특성 (79 2-7)', () => {
  it('빠른 잔물결 −0.3초 · 잔잔한 물결 마나 −20% · 샘의 숨 4 → 2% · 긴 사슬 +2%p', () => {
    expect(castOf(fight(['quickRipple']), 'ripple')).toBeCloseTo(SKILLS.ripple.cast - 0.3, 6);
    expect(costOf(fight(['calmShower']), 'ripple')).toBeCloseTo(SKILLS.ripple.cost * 0.8, 6);
    expect(costOf(fight(['springBreath']), 'springTotem')).toBeCloseTo(2, 6);
    expect(costOf(fight(['longChain']), 'chainHeal')).toBeCloseTo(12, 6);
  });
  it('갈라지는 물방울: 붙은 다친 아군 1명에게 50%', () => {
    const f = fight(['splitDrop']); hurt(f, 0.5);
    const u = withAdj(f, 1);
    cast(f, 'droplet', u.cell);
    expect(adj(f, u).some(v => drop(v)?.rest === D * 0.5)).toBe(true);
  });
  it('돌 물방울: 물방울이 걸린 아군 −5%', () => {
    const f = fight(['stoneDrop']), u = others(f)[0];
    expect(taken(f, u)).toBeCloseTo(100, 6);
    cast(f, 'droplet', u.cell);
    expect(taken(f, u)).toBeCloseTo(95, 6);
  });
  it('잔물결 이음: 물방울 대상에게 잔물결 → +3초 (회복량도)', () => {
    const f = fight(['rippleChain']), u = others(f)[0];
    cast(f, 'droplet', u.cell);
    const h = drop(u)!, rest = h.rest, left = h.left;
    cast(f, 'ripple', u.cell);
    expect(h.left).toBeCloseTo(left - (f.t - f.t) + 3 - castOf(f, 'ripple') - 0, 0);
    expect(h.rest).toBeGreaterThan(rest - 60);
  });
  it('흩뿌리는 물결: 잔물결이 처음 튄 아군 말고 붙은 다친 아군 1명에게 35% 한 번 더', () => {
    const f = fight(['sprayShower']); hurt(f, 0.5);
    const u = withAdj(f, 2), [v, w] = adj(f, u).sort((a, b) => a.hp / a.max - b.hp / b.max);
    v.hp = v.max * 0.3; w.hp = w.max * 0.45;
    const hs = cast(f, 'ripple', u.cell);
    expect(hs.find(e => e.id === v.id)!.amt).toBe(Math.round(R * SHAMAN.ripple.bounce * DEEP));
    expect(hs.find(e => e.id === w.id)!.amt).toBe(Math.round(R * 0.35 * DEEP));
  });
  it('뿌리 내린 토템: 토템 칸 −30%, 둘레 −15%', () => {
    const f = fight(['rootTotem']), u = withAdj(f, 1), v = adj(f, u)[0];
    cast(f, 'earthTotem', u.cell);
    expect(taken(f, u)).toBeCloseTo(70, 6);
    expect(taken(f, v)).toBeCloseTo(85, 6);
  });
  it('물방울 사슬: 물방울이 걸린 아군에게 튈 때는 안 줆 · 끝없는 사슬 10%만 줆', () => {
    const f = fight(['dropChain']); hurt(f, 0.2);
    const u = withAdj(f, 1), path0 = chainPath(f, u);
    for (const v of path0.slice(1)) putHot(v, 'droplet', { sec: 99, every: 99, total: 1 });
    const path = chainPath(f, u), hs = cast(f, 'chainHeal', u.cell);
    if (path.length > 1) expect(hs.find(e => e.id === path[1].id)!.amt).toBe(Math.round(C * DEEP));
    const g = fight(['endlessChain']); hurt(g, 0.2);
    const w = withAdj(g, 1), p2 = chainPath(g, w), h2 = cast(g, 'chainHeal', w.cell);
    if (p2.length > 1) expect(h2.find(e => e.id === p2[1].id)!.amt).toBe(Math.round(C * 0.9 * DEEP));
  });
  it('번지는 씻김: 붙은 아군 1명의 같은 종류 디버프도', () => {
    const f = fight(['washSpread']), u = withAdj(f, 1), v = adj(f, u)[0];
    addDebuff(f, u, { name: '저주 1', type: '저주', left: 30 });
    addDebuff(f, v, { name: '저주 2', type: '저주', left: 30 });
    cast(f, 'washing', u.cell);
    expect(u.debuffs).toHaveLength(0);
    expect(v.debuffs).toHaveLength(0);
  });
  it('샘지기: 토템 칸에 선 아군 2배 · 넓은 샘: 2칸 거리 · 70%', () => {
    const f = fight(['keeperSpring']); hurt(f, 0.2);
    const u = withAdj(f, 1), v = adj(f, u)[0];
    placeTotem(f, 'spring', u.cell, 15, { tick: 3 });
    const a = u.hp, b = v.hp;
    springPulse(f, f.totems[0]);
    expect(u.hp - a).toBeCloseTo(Math.min(SP * 2, u.max - a), 6);
    expect(v.hp - b).toBeCloseTo(Math.min(SP, v.max - b), 6);
    const g = fight(['freshSpring']); hurt(g, 0.2);
    const w = withAdj(g, 1), far = others(g).find(x => E.hexDist(g.cells[x.cell], g.cells[w.cell]) === 2)!;
    placeTotem(g, 'spring', w.cell, 15, { tick: 3 });
    const c = far.hp;
    springPulse(g, g.totems[0]);
    expect(far.hp - c).toBeCloseTo(SP * 0.7, 6);
  });
  it('두 개의 샘: 2개까지 서고 셋째는 가장 오래된 것을 바꿈', () => {
    const f = fight(['twinSpring']), cs = f.cells.filter(c => !c.block).map(c => c.i);
    for (const c of cs.slice(0, 3)) { f.cd.springTotem = 0; f.gcd = 0; E.use(f, 'springTotem', c); step(f, 0.05); }
    expect(totemsOf(f, 'spring').map(t => t.cell)).toEqual(cs.slice(1, 3));
  });
  it('물의 방패: 가득 찬 아군을 샘이 회복하면 그만큼 보호막', () => {
    const f = fight(['waterShield']), u = others(f)[0];
    u.hp = u.max;
    placeTotem(f, 'spring', u.cell, 15, { tick: 3 });
    springPulse(f, f.totems[0]);
    expect(absorbLeft(f, u)).toBeCloseTo(Math.min(SP, TX.waterShield.max), 6);
  });
  it('토템 부르기: 나중에 세운 토템은 고른 칸, 앞 토템은 바로 옆 칸으로 (한 칸에 하나, 남은 시간 그대로)', () => {
    const f = fight(['totemCall']), cs = f.cells.filter(c => !c.block).map(c => c.i);
    expect(talentReady(f, 'totemCall').ok).toBe(false);
    placeTotem(f, 'spring', cs[0], 15); placeTotem(f, 'earth', cs[1], 10);
    const until = f.totems.map(t => t.until);
    expect(useTalent(f, 'totemCall', cs[2]).ok).toBe(true);
    const [spring, earth] = f.totems;
    expect(earth.cell).toBe(cs[2]);
    expect(E.hexDist(f.cells[spring.cell], f.cells[cs[2]])).toBe(1);
    expect(f.totems.map(t => t.until)).toEqual(until);
  });
  it('한 칸에 토템 하나: 토템이 선 칸에 새로 세우면 앞 토템은 그림 · 효과 모두 없어짐 (2026-10-16 Lim)', () => {
    const f = fight(), u = withAdj(f, 1);
    cast(f, 'springTotem', u.cell);
    cast(f, 'earthTotem', u.cell);
    expect(f.totems.map(t => [t.kind, t.cell])).toEqual([['earth', u.cell]]);
    f.cd = {};
    cast(f, 'springTotem', u.cell);
    expect(f.totems.map(t => [t.kind, t.cell])).toEqual([['spring', u.cell]]);
    expect(taken(f, u)).toBeCloseTo(100, 6); // 대지 토템 효과도 끝남
  });
  it('대지의 품: 내가 토템 범위 안이면 −20%', () => {
    const f = fight(['earthGrace']), me = f.me;
    expect(taken(f, me)).toBeCloseTo(100, 6);
    placeTotem(f, 'spring', me.cell, 15);
    expect(taken(f, me)).toBeCloseTo(80, 6);
  });
  it('흘려보내기: 내 체력 40% 아래면 물방울이 걸리고 바로 한 번, 45초에 한 번', () => {
    const f = fight(['letFlow']), me = f.me;
    me.hp = me.max * 0.3;
    step(f, 0.1);
    expect(drop(me)).toBeTruthy();
    expect(drop(me)!.rest).toBeCloseTo(D * 0.75, 6);
  });
  it('나를 지키는 샘: 죽을 피해 → 샘이 깨지고 30%로 버팀, 1회', () => {
    const f = fight(['springSelf']), me = f.me;
    placeTotem(f, 'spring', emptyCell(f), 15);
    damage(f, me, me.hp + 10, false, 'fixed');
    expect(me.alive).toBe(true);
    expect(me.hp).toBeCloseTo(me.max * 0.3, 6);
    expect(totemsOf(f, 'spring')).toHaveLength(0);
  });
  it('급류: 체력 35% 아래 대상 잔물결 +30% (2026-10-16 소나기에서 옮김)', () => {
    const f = fight(['rapids']), u = others(f)[0];
    u.hp = u.max * 0.3;
    u.base = u.max = 5000; u.hp = u.max * 0.3;
    expect(cast(f, 'ripple', u.cell).find(e => e.id === u.id)!.amt).toBe(Math.round(R * 1.3 * DEEP));
  });
  it('경계하는 토템: 광역 예고가 뜨면 샘이 바로 한 번 (10초에 한 번)', () => {
    const f = fight(['alertTotem']); hurt(f, 0.2);
    const u = withAdj(f, 1);
    placeTotem(f, 'spring', u.cell, 15, { tick: 3 });
    const h0 = u.hp;
    f.tels.push({ id: f.nextId++, skill: f.skills[0], kind: 'aoe', start: f.t, impact: f.t + 9, units: [], cells: new Set() });
    step(f, 0.1);
    expect(u.hp - h0).toBeCloseTo(SP, 0);
  });
  it('마지막 샘: 파티원이 쓰러지면 그 칸에 샘 (지금 샘은 사라짐)', () => {
    const f = fight(['lastSpring']), cs = f.cells.filter(c => !c.block).map(c => c.i), u = others(f)[0], cell = u.cell;
    placeTotem(f, 'spring', cs[cs.length - 1], 15);
    damage(f, u, u.hp + 10, false, 'fixed');
    expect(totemsOf(f, 'spring').map(t => t.cell)).toEqual([cell]);
  });
  it('되돌아오는 사슬: 끝나면 첫 대상에게 50%', () => {
    const f = fight(['returnChain']); hurt(f, 0.2);
    const u = withAdj(f, 1), hs = cast(f, 'chainHeal', u.cell).filter(e => e.id === u.id);
    expect(hs[0].amt).toBe(Math.round(C * DEEP));
    expect([Math.round(C * 0.5), Math.round(C * 0.5 * DEEP)]).toContain(hs[1].amt);
  });
  it('넘치는 사슬: 넘친 양을 다음 대상에', () => {
    const f = fight(['overflowChain']); hurt(f, 0.2);
    const u = withAdj(f, 1);
    u.hp = u.max - 20;
    const path = chainPath(f, u);
    if (path.length > 1) { const hs = cast(f, 'chainHeal', path[0].cell); expect(hs.find(e => e.id === path[1].id)!.amt).toBeGreaterThan(Math.round(240 * 1.12)); }
  });
  it('긴 사슬 6명 · 두 대지: 2번 모아 둠 · 판 위 2개', () => {
    const f = fight(['longChain']); hurt(f, 0.2);
    expect(chainPath(f, withAdj(f, 1)).length).toBeLessThanOrEqual(6);
    const g = fight(['twinEarth']), a = others(g)[0], b = others(g)[1];
    cast(g, 'earthTotem', a.cell);
    expect(g.cd.earthTotem).toBe(0);
    cast(g, 'earthTotem', b.cell);
    expect(g.cd.earthTotem).toBeGreaterThan(80);
    expect(totemsOf(g, 'earth')).toHaveLength(2);
  });
  it('비의 숨: 비구름 동안 마나 −50% · 폭풍 사슬: 비구름 동안 연쇄 즉시', () => {
    const f = fight(['rainBreath']);
    E.use(f, 'rainTotem', 0);
    expect(costOf(f, 'ripple')).toBeCloseTo(SKILLS.ripple.cost * 0.5, 6);
    const g = fight(['stormChain']);
    expect(castOf(g, 'chainHeal')).toBeGreaterThan(0);
    E.use(g, 'rainTotem', 0);
    expect(castOf(g, 'chainHeal')).toBe(0);
  });
  it('물의 정령: 20초 동안 잔물결이 붙은 다친 아군 2명에게 75% · 56%', () => {
    const f = fight(['waterSpirit']); hurt(f, 0.8);
    const u = withAdj(f, 2);
    expect(useTalent(f, 'waterSpirit').ok).toBe(true);
    const hs = cast(f, 'ripple', u.cell).filter(e => e.id !== u.id).map(e => e.amt).sort((a, b) => b - a);
    expect(hs.slice(0, 2)).toEqual([Math.round(R * 0.75), Math.round(R * 0.56)]);
  });
  it('바다의 자리: 빈 칸에 15초 · 2초마다 2칸 거리 40, 장판에도 안 깨짐', () => {
    const f = fight(['seaSeat']); hurt(f, 0.2);
    const c = emptyCell(f);
    expect(useTalent(f, 'seaSeat', c).ok).toBe(true);
    f.zones.push({ id: 1, cells: new Set([c]), end: f.t + 30, dps: 0 });
    const near = others(f).find(v => E.hexDist(f.cells[v.cell], f.cells[c]) <= 2)!, h0 = near.hp;
    step(f, 2.05);
    expect(near.hp - h0).toBeCloseTo(40, 0);
    expect(totemsOf(f, 'sea')).toHaveLength(1);
  });
});

describe('직업 전용 특수능력 (79 2-8)', () => {
  const sp = (k: string, v = SPECS[k].val) => fight([], { [k]: v });
  it('깊은 샘 · 마르지 않는 샘 +6초', () => {
    const f = sp('deepSpring'); hurt(f, 0.2);
    const u = others(f)[0], h0 = u.hp;
    placeTotem(f, 'spring', u.cell, 15);
    springPulse(f, f.totems[0]);
    expect(u.hp - h0).toBeCloseTo(Math.min(SP * (1 + SPECS.deepSpring.val), u.max - h0), 6);
    const g = sp('tallSpring');
    E.use(g, 'springTotem', emptyCell(g));
    expect(totemsOf(g, 'spring')[0].until - g.t).toBeCloseTo(21, 0);
  });
  it('물웅덩이: 물방울이 끝까지 가면 그 칸 6초 받는 피해 −10%', () => {
    const f = sp('puddle'), u = others(f)[0];
    putHot(u, 'droplet', { sec: 3, every: 3, total: 10 });
    step(f, 3.1);
    expect(taken(f, u)).toBeCloseTo(90, 6);
  });
  it('서두른 물방울 −1초 (84) · 서두른 샘 −1.5초 · 비구름 시간 +2초 · 가속 +10%', () => {
    expect(cdOf(sp('hastyDrop'), 'droplet')).toBeCloseTo(SKILLS.droplet.cd! - SPECS.hastyDrop.val, 6);
    expect(cdOf(sp('quickShower'), 'springTotem')).toBeCloseTo(SKILLS.springTotem.cd! - 1.5, 6);
    const f = sp('longRain');
    E.use(f, 'rainTotem', 0);
    expect(f.sham!.rainUntil - f.t).toBeCloseTo(12, 6);
    const g = sp('rainHaste'), h0 = hasteOf(g);
    E.use(g, 'rainTotem', 0);
    expect(hasteOf(g) - h0).toBeCloseTo(0.1, 6);
  });
  it('굳은 대지 +10%p · 깊은 이음 +10%p', () => {
    const f = sp('hardEarth'), u = others(f)[0];
    cast(f, 'earthTotem', u.cell);
    expect(taken(f, u)).toBeCloseTo(75, 6);
    const g = sp('deepLink'), w = withAdj(g, 1);
    cast(g, 'spiritLink', w.cell);
    expect(taken(g, w)).toBeCloseTo(80, 6);
  });
  it('샘 긷기: 샘이 3명 이상 회복하면 마나', () => {
    const f = sp('springDraw'); hurt(f, 0.2);
    const u = withAdj(f, 2);
    placeTotem(f, 'spring', u.cell, 15);
    f.mana = 50;
    springPulse(f, f.totems[0]);
    expect(f.mana).toBeCloseTo(50 + SPECS.springDraw.val, 6);
  });
  it('토템 곁: 토템 범위 안 아군 직접 힐 +', () => {
    const f = sp('totemSide'), u = others(f)[0];
    u.hp = u.max * 0.9;
    placeTotem(f, 'earth', u.cell, 10);
    expect(cast(f, 'ripple', u.cell).find(e => e.id === u.id)!.amt).toBe(Math.round(R * (1 + SPECS.totemSide.val)));
  });
  it('사슬 끝 물방울 · 씻김 물방울: 절반 물방울', () => {
    const f = sp('chainDrop'); hurt(f, 0.2);
    const u = withAdj(f, 1), path = chainPath(f, u);
    cast(f, 'chainHeal', u.cell);
    if (path.length > 1) expect(drop(path[path.length - 1])?.rest).toBe(D * 0.5);
    const g = sp('washDrop'), w = others(g)[0];
    addDebuff(g, w, { name: '마법', type: '마법', left: 30 });
    cast(g, 'washing', w.cell);
    expect(drop(w)?.rest).toBe(D * 0.5);
  });
  it('토템의 마지막 물: 샘이 깨질 때 한 번 더', () => {
    const f = sp('totemMend'); hurt(f, 0.2);
    const u = others(f)[0], h0 = u.hp;
    placeTotem(f, 'spring', u.cell, 15, { tick: 3 });
    f.zones.push({ id: 1, cells: new Set([u.cell]), end: f.t + 5, dps: 0 });
    step(f, 0.05);
    expect(u.hp - h0).toBeCloseTo(Math.min(SP, u.max - h0), 0);
  });
  it('대지의 울림: 확률로 붙은 칸에 샘도 (마나 없이, 한 칸에 토템 하나)', () => {
    const f = sp('earthEcho', 1), u = others(f)[0];
    cast(f, 'earthTotem', u.cell);
    expect(totemsOf(f, 'earth').map(t => t.cell)).toEqual([u.cell]);
    const sp0 = totemsOf(f, 'spring');
    expect(sp0.length).toBe(1);
    expect(E.hexDist(f.cells[sp0[0].cell], f.cells[u.cell])).toBe(1);
  });
});
