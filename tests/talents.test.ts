/** 사제 특성 30개 (06 6장): 고른 특성만 켜지고, 하나씩 효과 확인 */
import { describe, expect, it } from 'vitest';
import { TALENT_TIER, TALENTS, talentKeys, type TalentKey } from '../src/data/talents';
import * as E from '../src/engine';
import { addDebuff, damage, heal } from '../src/engine/core';
import { castOf, cdOf, costOf, talentReady, useTalent } from '../src/engine/talents';
import { SKILLS } from '../src/data/skills';
import { dodgeRate } from '../src/engine/movement';

type F = ReturnType<typeof E.create>;
type U = F['party'][number];
/** 특성 이름 → 단마다 고른 칸 번호 */
const picks = (...keys: TalentKey[]) => {
  const p: (number | null)[] = TALENTS.map(() => null);
  for (const k of keys) p[TALENT_TIER[k]] = TALENTS[TALENT_TIER[k]].picks.findIndex(x => x.key === k);
  return p;
};
const fight = (keys: TalentKey[], o: { enc?: 'warden' | 'plague' | 'choir'; hero?: 'priest' | 'druid'; level?: number } = {}) => {
  const f = E.create({ encounter: o.enc ?? 'plague', diff: '보통', seed: 7, level: o.level ?? 100, hero: o.hero, talents: picks(...keys) });
  f.gear.crit = 0;
  f.power = 1; f.dmgMult = 1; f.gear.heal = 1; // 힐·피해를 기본 단위로 (레벨 배율 · 치유 배율 1, 34 1-2 · 1-6): 특성 효과만 봄
  f.skills.forEach(s => { s.next = Infinity; }); // 보스 기술은 끔
  return f;
};
const step = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
/** 스킬을 쓰고 시전이 끝날 때까지. 그동안 생긴 힐 이벤트를 돌려줌 */
const cast = (f: F, key: Parameters<typeof E.use>[1], u: U) => {
  const r = E.use(f, key, u.cell);
  expect(r.ok, r.reason).toBe(true);
  const heals: { id: number; amt: number }[] = [];
  const grab = () => { for (const e of f.events) if (e.type === 'heal') heals.push(e); f.events.length = 0; };
  grab();
  let n = 0;
  while ((f.cast || f.gcd > 0 || f.queued) && n++ < 200) { E.step(f); grab(); }
  return heals;
};
const tanks = (f: F) => f.party.filter(u => u.role === 'tank');
const others = (f: F) => f.party.filter(u => !u.me);
const adj = (f: F, u: U) => f.party.filter(v => v !== u && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
const hurt = (f: F, pct = 0.5) => { for (const u of f.party) u.hp = u.max * pct; };
/** 옆 칸에 아군이 있는 사람 */
const withAdj = (f: F, n = 1) => others(f).find(u => adj(f, u).length >= n)!;

describe('특성 켜기', () => {
  it('Lv에 따라 열린 단만 켜짐 (Lv 5마다 한 단, Lv 50 완성, 34 2-1)', () => {
    const p = picks('longBreath', 'brink', 'overflow', 'fullHeart');
    expect(talentKeys(p, 17)).toEqual(['longBreath', 'brink', 'overflow']);
    expect(talentKeys(p, 4)).toEqual([]);
    expect(TALENTS.map(t => t.lv)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    expect(talentKeys(undefined, 100)).toEqual([]);
  });
  it('특성 없음 = 상태 비어 있음, 사제 밖 직업은 특성을 넘겨도 무시', () => {
    expect(fight([]).tx.on).toEqual({});
    expect(fight(['longBreath'], { hero: 'druid' }).tx.on).toEqual({});
    expect(fight(['longBreath', 'zenith']).tx.act).toEqual({ zenith: { cd: 0, left: 0, used: false } });
  });
});

describe('기본 강화 (Lv 10~30)', () => {
  it('긴 숨결: 소생 12초', () => {
    const f = fight(['longBreath']), u = tanks(f)[0];
    cast(f, 'renew', u);
    expect(u.hot).toBeGreaterThan(12 - f.gcdBase - 0.1); // 기본 9초보다 김
  });
  it('가벼운 손끝: 순간 치유 마나 ×0.8', () => {
    expect(costOf(fight(['lightTouch']), 'flash')).toBeCloseTo(4.8, 9);
    expect(costOf(fight([]), 'flash')).toBe(6);
  });
  it('넓은 원: 기원 반경 2, 회복 ×0.8', () => {
    const f = fight(['wideCircle']); hurt(f, 0.1);
    const u = tanks(f)[0];
    const far = f.party.find(v => E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 2)!;
    const h = cast(f, 'poh', u);
    expect(h.find(e => e.id === u.id)!.amt).toBe(144);
    expect(h.some(e => e.id === far.id)).toBe(true);
  });
  it('벼랑 끝 손길: 30% 이하 대상 직접 힐 +25%', () => {
    const f = fight(['brink']); hurt(f, 0.25);
    expect(cast(f, 'flash', tanks(f)[0])[0].amt).toBe(Math.round(250 * 1.25));
    const g = fight(['brink']); hurt(g, 0.5);
    expect(cast(g, 'flash', tanks(g)[0])[0].amt).toBe(250);
  });
  it('씻어낸 자리: 정화에 성공하면 150 회복', () => {
    const f = fight(['washed']); hurt(f);
    const u = tanks(f)[0];
    addDebuff(f, u, { name: '저주', type: '마법', left: 20 });
    const h = cast(f, 'purify', u);
    expect(h.find(e => e.id === u.id)?.amt).toBe(150);
  });
  it('손에 익은 치유: 치유 시전 -0.3초', () => {
    const f = fight(['practiced']);
    expect(castOf(f, 'heal')).toBeCloseTo((SKILLS.heal.cast - 0.3) / (1 + f.gear.haste), 9);
  });
  it('흘러넘침: 치유로 넘친 힐량의 50%가 옆에서 가장 다친 아군에게', () => {
    const f = fight(['overflow']);
    const u = withAdj(f);
    for (const v of f.party) v.hp = v.max;
    const low = adj(f, u)[0]; low.hp = low.max * 0.3;
    const h = cast(f, 'heal', u);
    expect(h.find(e => e.id === low.id)?.amt).toBe(150);
  });
  it('옮겨 가는 소생: 끝나면 옆 아군에게 한 번만', () => {
    const f = fight(['hopRenew']);
    const u = withAdj(f);
    for (const v of f.party) v.hp = v.max * 0.95;
    const nb = adj(f, u); nb[0].hp = nb[0].max * 0.2;
    cast(f, 'renew', u);
    step(f, 9.2);
    expect(nb[0].hot).toBeGreaterThan(0);
    expect(nb[0].hotHop).toBe(true);
    step(f, 9.2);
    expect(f.party.filter(v => v.hot > 0).length).toBe(0);
  });
  it('숨 고르기: 3초 동안 아무것도 안 하면 마나 재생 2배', () => {
    const f = fight(['breather']), g = fight([]);
    f.mana = g.mana = 10;
    step(f, 4); step(g, 4);
    const a = f.mana, b = g.mana;
    step(f, 1); step(g, 1);
    expect(f.mana - a).toBeCloseTo((g.mana - b) * 2, 6);
  });
});

describe('성언 (Lv 40~50)', () => {
  it('충만한 마음: 게이지 30% 더', () => {
    const f = fight(['fullHeart']); hurt(f);
    cast(f, 'heal', tanks(f)[0]);
    expect(f.g.p).toBeCloseTo(26, 9);
  });
  it('번지는 평온: 옆 아군 2명에게 50%', () => {
    const f = fight(['spreadSerenity']); hurt(f, 0.1);
    const u = withAdj(f, 2);
    f.g.p = 100;
    const h = cast(f, E.slotKey(f, 'heal'), u);
    expect(h.filter(e => e.id !== u.id && e.amt === 300).length).toBe(2);
  });
  it('말씀의 여운: 성언 뒤 5초 마나 -50%', () => {
    const f = fight(['echoWord']); hurt(f);
    f.g.s = 100;
    cast(f, 'sanctify', tanks(f)[0]);
    expect(costOf(f, 'heal')).toBe(1.5);
    step(f, 5);
    expect(costOf(f, 'heal')).toBe(3);
  });
  it('기적의 순간: 두 게이지를 바로 100%, 전투당 1회', () => {
    const f = fight(['miracle']);
    expect(useTalent(f, 'miracle').ok).toBe(true);
    expect(f.g).toEqual({ p: 100, s: 100 });
    f.g = { p: 0, s: 0 };
    expect(useTalent(f, 'miracle').reason).toMatch(/전투당 1회/);
  });
  it('아껴 둔 말씀: 게이지 200까지, 성언을 쓰면 100만 줄어듦', () => {
    const f = fight(['savedWord']); hurt(f, 0.1);
    f.g.p = 190;
    cast(f, 'heal', tanks(f)[1]);
    expect(f.g.p).toBe(200);
    cast(f, E.slotKey(f, 'heal'), tanks(f)[0]);
    expect(f.g.p).toBe(100);
  });
  it('씻는 말씀: 평온이 독도 지움 (함정은 안 건드림)', () => {
    const f = fight(['cleansingWord']); hurt(f);
    const u = tanks(f)[0];
    addDebuff(f, u, { name: '독침', type: '독', left: 20, dot: 1 });
    addDebuff(f, u, { name: '함정', type: '마법', left: 20, trap: true });
    f.g.p = 100;
    cast(f, 'serenity', u);
    expect(u.debuffs.map(d => d.name)).toEqual(['함정']);
  });
});

describe('생존·위기 (Lv 60~70)', () => {
  it('은혜 갚기: 죽을 피해를 체력 50% 이상 파티원이 한 번 대신', () => {
    const f = fight(['repay']);
    const me = f.me;
    damage(f, me, me.hp + 50);
    expect(me.alive).toBe(true);
    expect(others(f).some(u => u.hp < u.max)).toBe(true);
    damage(f, me, me.hp + 50);
    expect(me.alive).toBe(false);
  });
  it('은혜 갚기 호감도: 공개모집은 내 힐을 가장 많이 받은 파티원, 길드원은 출전 수가 많은 사람이 먼저', () => {
    const f = fight(['repay']);
    const [a, b] = others(f);
    a.got = 500; b.got = 900;
    const ahp = a.hp, bhp = b.hp;
    damage(f, f.me, f.me.hp + 50);
    expect(b.hp).toBeLessThan(bhp);
    expect(a.hp).toBe(ahp);
    const g = fight(['repay']);
    const [c, d, e] = others(g);
    d.got = 99999; c.gid = 1; c.runs = 3; e.gid = 2; e.runs = 8;
    const ehp = e.hp;
    damage(g, g.me, g.me.hp + 50);
    expect(e.hp).toBeLessThan(ehp);
  });
  it('두 겹 수호: 2번 연달아, 충전 120초', () => {
    const f = fight(['twoGuard']);
    const [a, b] = tanks(f);
    cast(f, 'guardian', a);
    cast(f, 'guardian', b);
    expect(E.use(f, 'guardian', a.cell).ok).toBe(false);
    step(f, 116);
    expect(f.cd.guardian).toBeGreaterThan(0);
    step(f, 4);
    expect(f.cd.guardian).toBe(0);
    expect(f.tx.guard).toBe(1);
  });
  it('굳은 의지: 내가 받는 피해 -20%', () => {
    const f = fight(['firmWill']);
    const hp = f.me.hp;
    damage(f, f.me, 100);
    expect(hp - f.me.hp).toBeCloseTo(100 * f.dmgMult * 0.8, 6);
  });
  it('고요한 찬가: 찬가 동안 겁먹고 도망가지 않고 회피 +15%', () => {
    const f = fight(['calmHymn'], { enc: 'plague' });
    const u = others(f)[0];
    const before = dodgeRate(f, u);
    cast(f, 'hymn', u);
    expect(f.channel).toBeGreaterThan(0);
    expect(dodgeRate(f, u)).toBeCloseTo(Math.min(0.98, before + 0.15), 9);
    u.p = { ...u.p, flee: 0.5 }; u.hp = u.max * 0.2;
    step(f, 1);
    expect(u.fleeing).toBe(false);
  });
  it('쉼터: 빈 칸만, 도망가는 파티원이 그리로 가서 초당 30 회복', () => {
    const f = fight(['shelter'], { enc: 'plague' });
    const busy = f.party[0].cell;
    expect(useTalent(f, 'shelter', busy).ok).toBe(false);
    const empty = f.cells.find(c => !c.unit)!.i;
    expect(useTalent(f, 'shelter', empty).ok).toBe(true);
    expect(f.tx.shelter).toBe(empty);
    const u = others(f).find(x => x.role !== 'tank')!;
    u.p = { ...u.p, flee: 0.5, barks: ['도망!', '…'] }; u.hp = u.max * 0.2;
    step(f, 3);
    expect(u.cell).toBe(empty);
    const hp = u.hp;
    step(f, 1);
    expect(u.hp - hp).toBeGreaterThanOrEqual(29);
    step(f, 17);
    expect(f.tx.shelter).toBe(-1);
    expect(talentReady(f, 'shelter').reason).toMatch(/재사용 대기/);
  });
  it('쉼터: 신중파도 체력 40% 아래면 쉼터로, 쉼터가 없으면 그대로', () => {
    const f = fight(['shelter'], { enc: 'plague' });
    const u = others(f).find(x => x.role !== 'tank')!;
    u.pers = '신중파'; u.p = { barks: ['조심!'] }; u.hp = u.max * 0.35;
    step(f, 1);
    expect(u.fleeing).toBe(false);
    const empty = f.cells.find(c => !c.unit)!.i;
    useTalent(f, 'shelter', empty);
    step(f, 3);
    expect(u.cell).toBe(empty);
    expect(u.fleeing).toBe(true);
  });
  it('슬픔의 힘: 파티원이 쓰러지면 5초 동안 힐 +30%', () => {
    const f = fight(['grief']); hurt(f);
    const d = others(f)[3];
    damage(f, d, d.max * 10);
    expect(Math.round(heal(f, tanks(f)[0], 100, true))).toBe(130);
    step(f, 5.1); hurt(f);
    expect(Math.round(heal(f, tanks(f)[0], 100, true))).toBe(100);
  });
});

describe('범위·대규모 (Lv 80~90)', () => {
  it('두 번 퍼지는 기원: 2초 뒤 50%로 한 번 더', () => {
    const f = fight(['doublePoh']); hurt(f, 0.1);
    const u = tanks(f)[0];
    cast(f, 'poh', u);
    const hp = u.hp;
    step(f, 2.1);
    expect(u.hp - hp).toBeGreaterThanOrEqual(90);
  });
  it('나눠 주는 소생: 옆 아군 1명에게도', () => {
    const f = fight(['shareRenew']); hurt(f);
    const u = withAdj(f);
    cast(f, 'renew', u);
    expect(adj(f, u).filter(v => v.hot > 0).length).toBe(1);
  });
  it('빨라진 찬가: 재사용 대기 120초', () => {
    expect(cdOf(fight(['quickHymn']), 'hymn')).toBe(120);
  });
  it('두 방패의 끈: 탱커에게 한 직접 힐의 30%가 다른 탱커에게', () => {
    const f = fight(['twoShields']); hurt(f);
    const [a, b] = tanks(f);
    const h = cast(f, 'flash', a);
    expect(h.find(e => e.id === b.id)?.amt).toBe(75);
  });
  it('한 사람만 본다: 같은 대상 연속 치유 10%씩, 최대 50%', () => {
    const f = fight(['focusOne']); hurt(f, 0.01);
    const u = tanks(f)[0];
    u.max = 1e6; u.hp = 1;
    const amts = [];
    for (let i = 0; i < 7; i++) { f.mana = 100; amts.push(cast(f, 'flash', u)[0].amt); }
    expect(amts).toEqual([250, 275, 300, 325, 350, 375, 375]);
    f.mana = 100;
    expect(cast(f, 'flash', tanks(f)[1])[0].amt).toBe(250);
  });
  it('찬가의 끝자락: 끝까지 하면 전원 6초 지속 힐, 끊으면 없음', () => {
    const f = fight(['hymnTail']); hurt(f);
    cast(f, 'hymn', f.me);
    step(f, 4.1);
    expect(f.party.every(u => u.hots.some(h => h.key === 'hymn'))).toBe(true);
    const g = fight(['hymnTail']); hurt(g);
    cast(g, 'hymn', g.me);
    step(g, 1);
    cast(g, 'flash', tanks(g)[0]);
    step(g, 4);
    expect(g.party.some(u => u.hots.length)).toBe(false);
  });
});

describe('궁극 (Lv 100)', () => {
  it('기도의 정점: 20초 동안 시전 즉시, 마나 ×1.5', () => {
    const f = fight(['zenith']); hurt(f);
    expect(useTalent(f, 'zenith').ok).toBe(true);
    expect(castOf(f, 'heal')).toBe(0);
    expect(costOf(f, 'heal')).toBe(4.5);
    E.use(f, 'heal', tanks(f)[0].cell);
    expect(f.cast).toBe(null);
    step(f, 20.1);
    expect(castOf(f, 'heal')).toBeGreaterThan(0);
    expect(talentReady(f, 'zenith').reason).toMatch(/재사용 대기/);
  });
  it('흩날리는 빛: 30초 동안 직접 힐이 옆 2칸에 40%', () => {
    const f = fight(['scatter']); hurt(f, 0.1);
    const u = withAdj(f, 2);
    useTalent(f, 'scatter');
    const h = cast(f, 'flash', u);
    expect(h.filter(e => e.id !== u.id && e.amt === 100).length).toBe(2);
  });
  it('끊이지 않는 말씀: 게이지 50%에서 위력 50% 성언', () => {
    const f = fight(['endless']); hurt(f, 0.1);
    f.g.p = 60;
    expect(E.slotKey(f, 'heal')).toBe('serenity');
    expect(cast(f, 'serenity', tanks(f)[0])[0].amt).toBe(300);
    expect(f.g.p).toBe(0);
    expect(E.slotKey(fight([]), 'heal')).toBe('heal');
  });
});
