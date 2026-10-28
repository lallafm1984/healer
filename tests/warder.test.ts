/** 결계사 (79 5장): 스킬 · 인장 · 보호막 · 심판 (인원 보정) · 패시브 · 특성 30 · 직업 전용 특수능력 24 */
import { describe, expect, it } from 'vitest';
import type { EncounterKey } from '../src/data/encounters';
import { WARDER } from '../src/data/heroConst';
import { HEROES, heroSkills } from '../src/data/heroes';
import { SKILL_INFO, SKILLS } from '../src/data/skills';
import { SPEC_KEYS, SPECS } from '../src/data/specials';
import { TALENT_TIER, TALENT_TREES, TX, WARDER_TALENTS, type TalentKey } from '../src/data/talents';
import * as E from '../src/engine';
import { absorbLeft, giveAbsorb } from '../src/engine/abilities';
import { addDebuff, damage } from '../src/engine/core';
import { hasteOf } from '../src/engine/specials';
import { castOf, cdOf, costOf, useTalent } from '../src/engine/talents';
import { citadels, circleRange, judgeCount, judgeReady, sealed, veilOf } from '../src/engine/warder';

type F = ReturnType<typeof E.create>;
type U = F['party'][number];
const picks = (keys: TalentKey[]) => {
  const tree = TALENT_TREES.warder, p: (number | null)[] = tree.map(() => null);
  for (const k of keys) p[TALENT_TIER[k]] = tree[TALENT_TIER[k]].picks.findIndex(x => x.key === k);
  return p;
};
const fight = (keys: TalentKey[] = [], specs: Record<string, number> = {}, level = 100, encounter: EncounterKey = 'warden') => {
  const f = E.create({ encounter, diff: '보통', seed: 7, level, hero: 'warder', talents: picks(keys), specs });
  f.gear.crit = 0; f.gear.haste = 0;
  f.power = 1; f.dmgMult = 1; f.gear.heal = 1; f.manaCut = 1;
  f.skills.forEach(s => { s.next = Infinity; });
  for (const u of f.party) { u.p = { ...u.p, flee: 0 }; u.ab = null; u.base = u.max = 50000; u.hp = u.max; } // 저레벨 던전이라 체력이 작아 보호막 상한 (60%)에 걸리지 않게
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
/** 즉시 스킬: 누른 그 자리 (공통 재사용 대기 동안 보스가 막을 깎지 않게) */
const now = (f: F, key: Parameters<typeof E.use>[1], cell: number) => { const r = E.use(f, key, cell); expect(r.ok, r.reason).toBe(true); };
/** 피해 없이 흘려 보냄 */
const calm = (f: F, sec: number) => { f.dmgMult = 0; step(f, sec); f.dmgMult = 1; };
const healOn = (hs: { id: number; amt: number }[], u: U) => hs.filter(e => e.id === u.id).reduce((a, e) => a + e.amt, 0);
const others = (f: F) => f.party.filter(u => !u.me);
/** 탱커가 아닌 다른 아군 (보스 평타를 맞지 않음) */
const dps = (f: F) => others(f).filter(u => u.role !== 'tank');
const tank = (f: F) => f.party.find(u => u.role === 'tank')!;
const adj = (f: F, u: U) => f.party.filter(v => v !== u && v.alive && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
const withAdj = (f: F, n = 1) => others(f).find(u => adj(f, u).length >= n)!;
const hurt = (f: F, pct = 0.5) => { for (const u of f.party) u.hp = u.max * pct; };
const big = (u: U) => { u.base = u.max = 50000; u.hp = 100; };
const taken = (f: F, u: U) => { const h = u.hp; damage(f, u, 100, false, 'fixed'); return h - u.hp; };
const seal = (f: F, ...us: U[]) => { for (const u of us) u.seal = f.t + WARDER.seal.sec; };
const S = SKILLS.sealHeal.amt!, J = SKILLS.judgment.amt!;

describe('데이터 (79 5장)', () => {
  it('휠 8칸 (84: 가운데 버튼 · 빠른 인장 · 빛의 창을 없애고 빠른 힐 칸에 심판, 고유 칸에 결계 굳히기), 해제 마법 · 저주, 상점 해금, 켬', () => {
    expect(heroSkills('warder')).toEqual(['sealHeal', 'judgment', 'lightBarrier', 'wardCircle', 'wardCleanse', 'guardWard', 'lightVeil', 'wardHold']);
    expect(HEROES.warder.ready).toBe(true);
    expect(HEROES.warder.unlock).toMatchObject({ buy: true }); // 81: 상점 2,200원 (예전 Lv 60)
    expect(HEROES.warder.dispel).toEqual(['마법', '저주']);
  });
  it('특성 10단 × 3, 보조 버튼은 심판의 망치 · 성채 · 끝없는 심판', () => {
    expect(WARDER_TALENTS.map(t => t.lv)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    expect(WARDER_TALENTS.flatMap(t => t.picks).filter(p => p.active).map(p => p.key)).toEqual(['judgeHammer', 'citadel', 'endlessJudge']);
  });
  it('전용 특수능력 24종 (결계 01~24)', () => {
    const ds = SPEC_KEYS.map(k => SPECS[k]).filter(d => d.hero === 'warder');
    expect(ds.map(d => d.no)).toEqual(Array.from({ length: 24 }, (_, i) => `결계 ${String(i + 1).padStart(2, '0')}`));
  });
});

describe('스킬', () => {
  it('인장 치유 2.5초: 회복하고 15초 인장', () => {
    const f = fight(), u = others(f)[0];
    big(u);
    expect(castOf(f, 'sealHeal', u)).toBeCloseTo(SKILLS.sealHeal.cast, 6);
    expect(healOn(cast(f, 'sealHeal', u.cell), u)).toBe(S);
    expect(u.seal! - f.t).toBeGreaterThan(WARDER.seal.sec - 0.1);
    step(f, WARDER.seal.sec + 0.1);
    expect(sealed(f, u)).toBe(false);
  });
  it('빛의 막: 125 보호막 (10-19 300 → 150 · 10-28 → 125) + 인장, 같은 대상은 더해지되 최대 체력 60%까지', () => {
    const f = fight(), u = dps(f)[0];
    now(f, 'lightBarrier', u.cell);
    expect(absorbLeft(f, u)).toBe(SKILLS.lightBarrier.amt);
    expect(sealed(f, u)).toBe(true);
    const h = u.hp;
    damage(f, u, 100, false, 'fixed');
    expect(u.hp).toBe(h);
    expect(absorbLeft(f, u)).toBeCloseTo(SKILLS.lightBarrier.amt! - 100, 6);
    u.max = 200;
    f.cd.lightBarrier = 0; f.gcd = 0;
    now(f, 'lightBarrier', u.cell);
    expect(absorbLeft(f, u)).toBeCloseTo(200 * WARDER.shieldCap, 6);
  });
  it('결계 원: 붙어 있는 6칸 (10-19부터 20인도 1칸)에 100 보호막 + 인장', () => {
    const f = fight(), u = withAdj(f, 1);
    now(f, 'wardCircle', u.cell);
    for (const v of [u, ...adj(f, u)]) { expect(absorbLeft(f, v)).toBe(SKILLS.wardCircle.amt); expect(sealed(f, v)).toBe(true); }
    expect(circleRange(f)).toBe(1);
    expect(circleRange(fight([], {}, 100, 'choir'))).toBe(1 + WARDER.big.circle);
  });
  it('결계 정화: 마법 · 저주를 지움', () => {
    const f = fight(), u = others(f)[0];
    addDebuff(f, u, { name: '저주', type: '저주', left: 30 });
    cast(f, 'wardCleanse', u.cell);
    expect(u.debuffs).toHaveLength(0);
  });
  it('수호 결계 (82): 8초 동안 최대 체력 35% 보호막 + 인장 (받는 피해 감소는 없음)', () => {
    const f = fight(), u = tank(f);
    now(f, 'guardWard', u.cell);
    expect(absorbLeft(f, u)).toBeCloseTo(u.max * WARDER.guard.hp, 6);
    expect(sealed(f, u)).toBe(true);
    expect(u.redu).toBe(0);
    step(f, WARDER.guard.sec + 0.1);
    expect(absorbLeft(f, u)).toBe(0);
  });
  it('빛의 장막 (82): 파티 전원 12초 보호막 220 + 인장, 쓴 뒤 10초 표시', () => {
    const g = fight(), w = others(g)[0];
    now(g, 'lightVeil', w.cell);
    for (const v of E.living(g)) { expect(absorbLeft(g, v)).toBeCloseTo(SKILLS.lightVeil.amt!, 6); expect(sealed(g, v)).toBe(true); }
    expect(veilOf(g)).not.toBeNull();
    step(g, WARDER.veil.after + 0.1);
    expect(veilOf(g)).toBeNull();
    step(g, WARDER.veil.sec - WARDER.veil.after);
    expect(absorbLeft(g, w)).toBe(0);
  });
  it('결계 굳히기 (84, 빛의 창 대신): 내 보호막 남은 시간 +8초 · 두께 +30 · 인장 처음으로, 보호막 없는 아군은 그대로', () => {
    const f = fight(), [a, b, c] = others(f);
    for (const x of [a, b, c]) big(x);
    giveAbsorb(f, a, 200, 5, WARDER.shieldCap, true); giveAbsorb(f, b, 100, 10, WARDER.shieldCap, true);
    now(f, 'wardHold', 0);
    const ma = a.mods.find(m => m.k === 'absorb')!, mb = b.mods.find(m => m.k === 'absorb')!;
    expect(ma.until - f.t).toBeCloseTo(5 + WARDER.hold.ext, 6);
    expect(mb.until - f.t).toBeCloseTo(10 + WARDER.hold.ext, 6);
    expect(absorbLeft(f, a)).toBeCloseTo(200 + SKILLS.wardHold.amt!, 6);
    expect(sealed(f, a) && sealed(f, b)).toBe(true);
    expect(absorbLeft(f, c)).toBe(0);
    expect(sealed(f, c)).toBe(false);
    expect(SKILL_INFO.wardHold.desc).not.toMatch(/보스|피해를 줍니다/);
  });
  it('심판: 인장이 없으면 안 나감, 회복 인원은 3인 6 · 5인 3 · 10인 4 · 20인 6', () => {
    const f = fight();
    expect(judgeReady(f)).toBe(false);
    expect(E.use(f, 'judgment', 0).ok).toBe(false);
    expect(judgeCount(f)).toBe(WARDER.five.judge);
    expect(judgeCount(fight([], {}, 100, 'plague'))).toBe(WARDER.raid.judge);
    expect(judgeCount(fight([], {}, 100, 'choir'))).toBe(WARDER.big.judge);
    const g = fight(); g.party = g.party.slice(0, 3);
    expect(judgeCount(g)).toBe(WARDER.judge.n);
  });
  it('심판: 2초 시전 뒤 인장이 붙은 가장 다친 아군을 90씩 (2026-10-16 보스 공격 없음)', () => {
    const f = fight(); hurt(f, 0.5);
    const os = others(f);
    seal(f, ...os);
    os[0].hp = os[0].max * 0.2;
    const hs = cast(f, 'judgment', 0);
    expect(SKILL_INFO.judgment.desc).not.toMatch(/보스/);
    const got = os.filter(v => healOn(hs, v) > 0);
    expect(got).toHaveLength(Math.min(os.length, WARDER.five.judge));
    expect(healOn(hs, os[0])).toBe(J);
  });
});

describe('패시브', () => {
  it('깨진 막의 빛 (Lv 4): 내 보호막이 다 깨지면 80 회복', () => {
    const f = fight(), u = dps(f)[0];
    big(u); u.hp = 1000;
    now(f, 'lightBarrier', u.cell);
    f.events.length = 0;
    damage(f, u, SKILLS.lightBarrier.amt! + 50, false, 'fixed');
    expect(absorbLeft(f, u)).toBe(0);
    expect(healOn(healsOf(f), u)).toBe(WARDER.broken);
  });
  it('인장의 대가 (Lv 10): 심판이 4명 이상 회복하면 마나 2%', () => {
    const f = fight([], {}, 100, 'plague'); hurt(f, 0.5);
    seal(f, ...others(f));
    f.mana = 50;
    cast(f, 'judgment', 0);
    const m = f.mana;
    const g = fight([], {}, 9, 'plague'); hurt(g, 0.5);
    seal(g, ...others(g));
    g.mana = 50;
    cast(g, 'judgment', 0);
    expect(m - g.mana).toBeCloseTo(WARDER.price.mana, 1);
  });
});

describe('특성 (79 5-7)', () => {
  it('두꺼운 막 (탱커 +30%) · 가벼운 인장 −20% · 갈라지는 막 (붙은 1명 50% + 인장)', () => {
    const f = fight(['thickBarrier']), t = tank(f);
    now(f, 'lightBarrier', t.cell);
    expect(absorbLeft(f, t)).toBeCloseTo(SKILLS.lightBarrier.amt! * (1 + TX.thickBarrier), 6);
    expect(costOf(fight(['lightSeal']), 'sealHeal')).toBeCloseTo(costOf(fight(), 'sealHeal') * (1 - TX.lightSeal), 6);
    const g = fight(['splitBarrier']); hurt(g, 0.5);
    const u = withAdj(g, 1);
    now(g, 'lightBarrier', u.cell);
    const v = adj(g, u).find(x => absorbLeft(g, x) > 0)!;
    expect(absorbLeft(g, v)).toBeCloseTo(SKILLS.lightBarrier.amt! * TX.splitBarrier, 6);
    expect(sealed(g, v)).toBe(true);
  });
  it('막 위의 빛 +15% · 긴 인장 25초 · 맑은 결계 (붙은 칸 100)', () => {
    const f = fight(['lightOnBarrier']), u = others(f)[0];
    big(u); giveAbsorb(f, u, 50, 10, 1);
    expect(healOn(cast(f, 'sealHeal', u.cell), u)).toBe(Math.round(S * (1 + TX.lightOnBarrier)));
    const g = fight(['longSeal']), w = others(g)[0];
    cast(g, 'sealHeal', w.cell);
    expect(w.seal! - g.t).toBeGreaterThan(TX.longSeal - 2);
    const h = fight(['cleanWard']), x = withAdj(h, 1);
    addDebuff(h, x, { name: '마법', type: '마법', left: 30 });
    now(h, 'wardCleanse', x.cell);
    expect(adj(h, x).every(v => absorbLeft(h, v) === TX.cleanWard.amt)).toBe(true);
  });
  it('굳은 결계 보호막 50% (82) · 빠른 막 4초 · 번지는 인장 (붙은 1명)', () => {
    const f = fight(['firmWard']), t = tank(f);
    now(f, 'guardWard', t.cell);
    expect(absorbLeft(f, t)).toBeCloseTo(t.max * TX.firmWard, 6);
    expect(cdOf(fight(['quickBarrier']), 'lightBarrier')).toBe(TX.quickBarrier);
    const g = fight(['sealSpread']), u = withAdj(g, 1);
    cast(g, 'sealHeal', u.cell);
    expect(adj(g, u).filter(v => sealed(g, v))).toHaveLength(TX.sealSpread.n);
  });
  it('무거운 심판 (가장 낮은 1명 두 배) · 빠른 심판 1.5초 · 넓은 심판 8명', () => {
    const f = fight(['heavyJudge']); hurt(f, 0.5);
    const os = others(f);
    seal(f, ...os); os[1].hp = os[1].max * 0.1;
    expect(healOn(cast(f, 'judgment', 0), os[1])).toBe(J * TX.heavyJudge);
    expect(castOf(fight(['quickJudge']), 'judgment')).toBeCloseTo(TX.quickJudge, 6);
    expect(judgeCount(fight(['wideJudge']))).toBe(TX.wideJudge);
  });
  it('심판의 망치 (즉시) · 인장의 메아리 · 새 인장 60', () => {
    const f = fight(['judgeHammer']); hurt(f, 0.5);
    seal(f, ...others(f));
    expect(useTalent(f, 'judgeHammer').ok).toBe(true);
    expect(castOf(f, 'judgment')).toBe(0);
    const g = fight(['sealEcho']); hurt(g, 0.5);
    const w = others(g)[0];
    w.seal = g.t + 3; // 2초 시전이 끝날 때 남은 1초
    cast(g, 'judgment', 0);
    expect(w.seal! - g.t).toBeGreaterThan(WARDER.seal.sec - 0.1);
    const h = fight(['freshSeal']), x = others(h)[0];
    big(x);
    expect(healOn(cast(h, 'lightBarrier', x.cell), x)).toBe(TX.freshSeal.amt);
  });
  it('나를 위한 막 200 · 막의 숨 · 나눠 지는 짐', () => {
    const f = fight(['selfBarrier']);
    calm(f, 0.1);
    expect(absorbLeft(f, f.me)).toBe(TX.selfBarrier.amt);
    const g = fight(['sharedBurden']);
    for (const v of others(g).slice(0, 2)) giveAbsorb(g, v, 100, 30, 1);
    expect(taken(g, g.me)).toBeCloseTo(100 * (1 - 2 * TX.sharedBurden.step), 6);
  });
  it('막아서기 (30% 아래 200, 재발동 25초) · 미리 친 결계 · 마지막 결계', () => {
    const f = fight(['stepIn']), u = others(f)[0];
    u.hp = u.max * 0.2;
    calm(f, 0.1);
    expect(absorbLeft(f, u)).toBe(TX.stepIn.amt);
    const g = fight(['lastWard']), w = withAdj(g, 1);
    damage(g, w, w.hp + 1000, false, 'fixed');
    expect(w.alive).toBe(false);
    expect(adj(g, w).every(v => absorbLeft(g, v) === TX.lastWard.amt)).toBe(true);
  });
  it('두 겹 원 (가운데 두 배) · 아끼는 원 7% · 넓은 결계 2칸 −30%', () => {
    const f = fight(['doubleCircle']), u = withAdj(f, 1);
    now(f, 'wardCircle', u.cell);
    expect(absorbLeft(f, u)).toBe(SKILLS.wardCircle.amt! * TX.doubleCircle);
    expect(costOf(fight(['thriftCircle']), 'wardCircle')).toBeCloseTo(TX.thriftCircle.cost, 6);
    const g = fight(['wideWard']);
    expect(circleRange(g)).toBe(TX.wideWard.range);
    now(g, 'wardCircle', dps(g)[0].cell);
    expect(absorbLeft(g, dps(g)[0])).toBeCloseTo(SKILLS.wardCircle.amt! * (1 + TX.wideWard.amt), 6);
  });
  it('장막의 탱커 보호막 2배 · 함께 드는 짐: 장막 뒤 첫 심판은 인원 제한 없이 (82)', () => {
    const f = fight(['veilTank']), t = tank(f), d = dps(f)[0];
    now(f, 'lightVeil', t.cell);
    expect(absorbLeft(f, t)).toBeCloseTo(SKILLS.lightVeil.amt! * TX.veilTank, 6);
    expect(absorbLeft(f, d)).toBeCloseTo(SKILLS.lightVeil.amt!, 6);
    const g = fight(['sharedLoad']);
    const n0 = judgeCount(g);
    cast(g, 'lightVeil', others(g)[0].cell);
    expect(judgeCount(g)).toBe(g.party.length);
    hurt(g, 0.5);
    cast(g, 'judgment', g.me.cell);
    expect(judgeCount(g)).toBe(n0);
  });
  it('성채 (빈 칸 12초, 피해 −20%, 3초마다 보호막) · 굳힌 막의 숨 · 끝없는 심판 (마나 0, 1초)', () => {
    const f = fight(['citadel']);
    const u = dps(f).find(v => f.cells.some(c => !c.block && !c.unit && E.hexDist(c, f.cells[v.cell]) === 1))!;
    const empty = f.cells.find(c => !c.block && !c.unit && E.hexDist(c, f.cells[u.cell]) === 1)!;
    expect(useTalent(f, 'citadel', empty.i).ok).toBe(true);
    expect(citadels(f)).toHaveLength(1);
    calm(f, 0.1);
    expect(absorbLeft(f, u)).toBeGreaterThan(0);
    const h = u.hp; u.mods = []; damage(f, u, 100, false, 'fixed');
    expect(h - u.hp).toBeCloseTo(100 * (1 - TX.citadel.cut), 6);
    const g = fight(['repentTime']), [gb] = others(g); // 굳힌 막의 숨 (84): 결계 굳히기로 늘어난 아군 회복
    big(gb); gb.hp = gb.max * 0.5;
    giveAbsorb(g, gb, 200, 15, WARDER.shieldCap, true);
    const gh = gb.hp;
    now(g, 'wardHold', 0);
    expect(gb.hp - gh).toBeCloseTo(TX.repentTime.heal, 6);
    const k = fight(['endlessJudge']);
    expect(useTalent(k, 'endlessJudge').ok).toBe(true);
    expect(costOf(k, 'judgment')).toBe(0);
    expect(castOf(k, 'judgment')).toBeCloseTo(TX.endlessJudge.cast, 6);
  });
});

describe('직업 전용 특수능력 (79 5-8)', () => {
  const sp = (k: string, v = SPECS[k].val) => fight([], { [k]: v });
  it('깊은 인장 (심판 +) · 심판의 막 · 심판의 마나', () => {
    const f = sp('deepSeal'); hurt(f, 0.5);
    const os = others(f); seal(f, ...os);
    expect(healOn(cast(f, 'judgment', 0), os[0])).toBe(Math.round(J * (1 + SPECS.deepSeal.val)));
    const b = fight(['judgeHammer'], { judgeHit: SPECS.judgeHit.val }), bv = others(b)[0]; // 심판의 막 (2026-10-16 보스 피해 대신): 회복량의 비율만큼 보호막
    big(bv); seal(b, bv); useTalent(b, 'judgeHammer');
    now(b, 'judgment', 0);
    expect(absorbLeft(b, bv)).toBeCloseTo(J * SPECS.judgeHit.val, 3);
    const g = sp('judgeMana'); hurt(g, 0.5);
    seal(g, ...others(g)); g.mana = 50;
    const n = Math.min(others(g).length, WARDER.five.judge);
    const m0 = fight(); hurt(m0, 0.5); seal(m0, ...others(m0)); m0.mana = 50;
    cast(g, 'judgment', 0); cast(m0, 'judgment', 0);
    expect(g.mana - m0.mana).toBeCloseTo(n * SPECS.judgeMana.val, 2);
  });
  it('거울 막 · 막의 인장 · 더 밝은 깨짐', () => {
    const f = sp('mirrorBarrier'), u = dps(f)[0];
    big(u); u.hp = 1000;
    now(f, 'lightBarrier', u.cell);
    const v = adj(f, u).filter(x => x.alive).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    damage(f, u, 400, false, 'fixed');
    expect(absorbLeft(f, v)).toBeCloseTo(SKILLS.lightBarrier.amt! * SPECS.mirrorBarrier.val, 3); // 거울 막 (2026-10-16 보스에게 되돌림 대신): 붙은 가장 다친 아군에게
    const g = sp('barrierSeal'), w = dps(g)[0];
    big(w); w.hp = 1000;
    now(g, 'lightBarrier', w.cell);
    calm(g, 5);
    damage(g, w, 400, false, 'fixed');
    expect(w.seal! - g.t).toBeGreaterThan(WARDER.seal.sec - 0.1);
    const h = sp('brokenMore'), x = dps(h)[0];
    big(x); x.hp = 1000;
    now(h, 'lightBarrier', x.cell);
    h.events.length = 0;
    damage(h, x, 400, false, 'fixed');
    expect(healOn(healsOf(h), x)).toBe(Math.round(WARDER.broken * (1 + SPECS.brokenMore.val)));
  });
  it('서두른 굳히기 · 긴 수호 · 굳은 장막 · 서두른 인장 · 긴 장막', () => {
    expect(cdOf(sp('hastySpear'), 'wardHold')).toBeCloseTo(SKILLS.wardHold.cd! - SPECS.hastySpear.val, 6);
    const f = sp('longGuard'), t = tank(f);
    now(f, 'guardWard', t.cell);
    step(f, WARDER.guard.sec + 0.1);
    expect(absorbLeft(f, t)).toBeGreaterThan(0); // 긴 수호: 보호막 시간 +
    const g = sp('firmVeil'), w = others(g)[0];
    now(g, 'lightVeil', w.cell);
    expect(absorbLeft(g, w)).toBeCloseTo(SKILLS.lightVeil.amt! * (1 + SPECS.firmVeil.val), 6);
    expect(castOf(sp('sealHaste'), 'sealHeal')).toBeCloseTo(SKILLS.sealHeal.cast - SPECS.sealHaste.val, 6);
    const h = sp('longVeil'), x = others(h)[0];
    now(h, 'lightVeil', x.cell);
    step(h, WARDER.veil.sec + 0.1);
    expect(absorbLeft(h, x)).toBeGreaterThan(0); // 긴 장막: 보호막 시간 +
  });
  it('굳힌 뒤의 심판: 결계 굳히기 뒤 다음 심판 시전 −', () => {
    const f = sp('spearJudge'); hurt(f, 0.5);
    seal(f, ...others(f));
    now(f, 'wardHold', 0);
    expect(castOf(f, 'judgment')).toBeCloseTo(SKILLS.judgment.cast - SPECS.spearJudge.val, 6);
  });
  it('스킬 수치 (곧은 인장 · 가벼운 심판 · 두꺼운 원 · 촘촘한 막 · 두꺼운 굳히기 · 아끼는 막 · 귀환 · 원의 순환)', () => {
    const f = sp('steadySeal'), u = others(f)[0];
    big(u);
    expect(healOn(cast(f, 'sealHeal', u.cell), u)).toBe(Math.round(S * (1 + SPECS.steadySeal.val)));
    expect(costOf(sp('swiftSeal'), 'judgment')).toBeCloseTo(costOf(fight(), 'judgment') * (1 - SPECS.swiftSeal.val), 6);
    const h = sp('denseBarrier'), x = dps(h)[0];
    now(h, 'lightBarrier', x.cell);
    expect(absorbLeft(h, x)).toBeCloseTo(SKILLS.lightBarrier.amt! * (1 + SPECS.denseBarrier.val), 3);
    const k = sp('thickCircle'), y = dps(k)[0];
    now(k, 'wardCircle', y.cell);
    expect(absorbLeft(k, y)).toBeCloseTo(SKILLS.wardCircle.amt! * (1 + SPECS.thickCircle.val), 3);
    const m = sp('sharpSpear'), z = dps(m)[0];
    giveAbsorb(m, z, 100, 10, WARDER.shieldCap, true);
    now(m, 'wardHold', 0);
    expect(absorbLeft(m, z)).toBeCloseTo(100 + SKILLS.wardHold.amt! * (1 + SPECS.sharpSpear.val), 3);
    expect(costOf(sp('thriftBarrier'), 'lightBarrier')).toBeCloseTo(costOf(fight(), 'lightBarrier') * (1 - SPECS.thriftBarrier.val), 6);
    expect(cdOf(sp('guardReturn'), 'guardWard')).toBeCloseTo(SKILLS.guardWard.cd! * (1 - SPECS.guardReturn.val), 6);
    expect(cdOf(sp('veilReturn'), 'lightVeil')).toBeCloseTo(SKILLS.lightVeil.cd! * (1 - SPECS.veilReturn.val), 6);
    expect(cdOf(sp('circleCd'), 'wardCircle')).toBeCloseTo(SKILLS.wardCircle.cd! * (1 - SPECS.circleCd.val), 6);
  });
  it('인장 손길 · 맑은 인장 · 막의 서두름', () => {
    const f = sp('sealTouch'), u = others(f)[0];
    big(u); seal(f, u);
    expect(healOn(cast(f, 'sealHeal', u.cell), u)).toBe(Math.round(S * (1 + SPECS.sealTouch.val)));
    const g = sp('cleanSeal'), w = others(g)[0];
    addDebuff(g, w, { name: '마법', type: '마법', left: 30 });
    now(g, 'wardCleanse', w.cell);
    expect(sealed(g, w)).toBe(true);
    const h = sp('shieldHaste'), h0 = hasteOf(h);
    giveAbsorb(h, h.me, 100, 10, 1);
    expect(hasteOf(h) - h0).toBeCloseTo(SPECS.shieldHaste.val, 6);
  });
});
