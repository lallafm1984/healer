/** 힐러 직업 (25): 저장·직업 바꾸기 (v11 캐릭터, 68), 드루이드·성기사 고유 효과 */
import { beforeEach, describe, expect, it } from 'vitest';
import { TUNE } from '../src/data/tune';
import { BEACON, DRUID_BIG, HAND_GUARD, QUIETWOOD, SANCTUARY, TIER_MANA, WAVE } from '../src/data/heroConst';
import { HERO_KEYS, HEROES, heroSkills, skillAt, slotIdOf } from '../src/data/heroes';
import { SKILLS } from '../src/data/skills';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
import { heroApply, heroHeal, heroTick, putHot } from '../src/engine/heroes';
import { hotTick } from '../src/engine/units';
import { heroWin } from '../src/game/settle';
import { G, heroNow, heroStatus, makeChar, switchHero, switchOpen } from '../src/game/state';
import { TUT } from '../src/game/tutorial';
import { migrate, newSave } from '../src/platform/storage';

type F = ReturnType<typeof E.create>;
const fight = (hero: 'priest' | 'druid' | 'paladin', level = 100) => {
  const f = E.create({ encounter: 'warden', diff: '보통', seed: 7, level, hero });
  f.gear.crit = 0;
  return f;
};
const tank = (f: F) => f.party.find(u => u.role === 'tank')!;
const dps = (f: F) => f.party.find(u => u.role !== 'tank' && u !== f.me)!;
/** 시전이 끝날 때까지 (보스는 멈춘 채로 엔진만) */
const finish = (f: F) => { let n = 0; while ((f.cast || f.gcd > 0) && n++ < 200) { E.step(f); f.events.length = 0; } };

describe('직업 저장', () => {
  it('새 저장은 사제, 직업별 저장은 비어 있음', () => {
    const s = newSave(1);
    expect(s.hero).toBe('priest');
    expect(s.heroes).toEqual({});
  });
  it('v2 저장을 올리면 사제로, 모르는 직업 이름도 사제로', () => {
    expect(migrate({ v: 2, createdAt: 1, tut: 3 }).hero).toBe('priest');
    expect(migrate({ v: 3, createdAt: 1, hero: 'bard' }).hero).toBe('priest');
    expect(migrate({ v: 3, createdAt: 1, hero: 'druid', heroes: { druid: { layout: null, tapKey: 'flash', unlocked: true, quest: 1, wins: 4 } } }).heroes.druid!.wins).toBe(4);
  });
});

describe('직업 퀘스트는 없음 (68: 캐릭터 칸을 사서 만듦)', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = TUT.done;
    G.save.roster.slots = 2;
  });
  it('튜토리얼 중엔 이긴 판도 세지 않음', () => {
    G.save.tut = TUT.explore;
    expect(heroWin(G.save, 'dungeon', 'rustfort', '보통')).toBeNull();
    expect(G.save.heroes.priest?.wins ?? 0).toBe(0);
  });
  it('새 캐릭터는 만들 때 해금, 이긴 판만 셈', () => {
    expect(makeChar('druid')).toBe('');
    expect(G.save.heroes.druid!.unlocked).toBe(true);
    expect(heroWin(G.save, 'dungeon', 'rustfort', '어려움')).toBeNull();
    expect(G.save.heroes.druid!.wins).toBe(1);
  });
  it('드루이드 Lv 20 · 성기사 Lv 30 해금 (81)', () => {
    expect(HEROES.druid.unlock.lv).toBe(20);
    expect(HEROES.paladin.unlock.lv).toBe(30);
  });
});

describe('같은 캐릭터의 무료 직업 전환 (v12)', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = TUT.done;
    G.save.settings.devUnlock = false;
    G.save.roster.slots = 3;
  });
  it('튜토리얼 중엔 못 바꾸고 사제로만', () => {
    G.save.tut = TUT.explore;
    expect(switchOpen().ok).toBe(false);
    expect(switchHero('druid')).toBe(false);
    G.save.hero = 'druid';
    expect(heroNow()).toBe('priest');
  });
  it('레벨 해금 전에는 잠김, 기존에 사용하던 직업은 유지', () => {
    G.save.player.level = 1;
    expect(switchOpen().ok).toBe(true);
    expect(heroStatus('druid').state).toBe('locked');
    expect(switchHero('druid')).toBe(false);
    makeChar('druid');
    expect(heroStatus('druid').state).toBe('now');
    expect(heroStatus('priest').state).toBe('open');
    expect(heroStatus('paladin')).toEqual({ state: 'locked', dev: false, quest: 0, need: 0, buy: false });
    expect(switchHero('priest')).toBe(true);
    expect(G.save.hero).toBe('priest');
  });
  it('휠 배치·칸 탭은 직업마다 따로', () => {
    const lay = { NW: 'hymn', N: 'purify', NE: 'heal', W: 'renew', E: 'flash', SW: null, S: 'poh', SE: 'guardian' };
    G.save.settings.layout = lay; G.save.settings.tapKey = 'flash';
    G.save.player.level = 20;
    switchHero('druid');
    expect(G.save.settings.layout).toBeNull();
    expect(G.save.settings.tapKey).toBe('heal');
    G.save.settings.tapKey = 'renew';
    switchHero('priest');
    expect(G.save.settings.layout).toEqual(lay);
    expect(G.save.settings.tapKey).toBe('flash');
    switchHero('druid');
    expect(G.save.settings.tapKey).toBe('renew');
  });
});

describe('휠 칸 이름 ↔ 직업 스킬', () => {
  it('모든 직업: 칸 이름으로 찾은 스킬이 다시 같은 칸 이름', () => {
    for (const h of HERO_KEYS) for (const k of heroSkills(h)) {
      expect(k === 'serenity' || skillAt(h, slotIdOf(k)) === k).toBe(true);
    }
  });
  it('8번째 칸: 모든 직업이 채움 (사제 빛의 전이, Lim 2026-10-11)', () => {
    expect(skillAt('priest', 'unique')).toBe('relay');
    expect(skillAt('druid', 'unique')).toBe('rebirth');
    expect(skillAt('paladin', 'unique')).toBe('handGuard');
  });
});

describe('드루이드', () => {
  it('새싹은 12초 지속 힐, 다 끝나면 사라짐', () => {
    const f = fight('druid'), t = tank(f);
    expect(E.use(f, 'sprout', t.cell).ok).toBe(true);
    finish(f);
    expect(t.hots.map(h => h.key)).toContain('sprout');
    const t0 = f.t;
    while (f.t < t0 + 12.5 && !f.over) { E.step(f); f.events.length = 0; }
    expect(t.hots.some(h => h.key === 'sprout')).toBe(false);
  });
  it('들꽃 군락: 7초 안에 4번, 모두 160 (2026-10-14 검토: 2초 간격이라 7초에 마지막 15가 잘려 145)', () => {
    const f = fight('druid'), t = tank(f);
    t.max = 1e6; t.hp = 1;
    heroApply(f, 'wildflower', t);
    let got = 0;
    for (let i = 0; i < 71; i++) { const h0 = t.hp; hotTick(f, t, 0.1); got += t.hp - h0; }
    expect(t.hots.some(h => h.key === 'wildflower')).toBe(false);
    expect(got).toBeCloseTo(160 * f.gear.heal * f.power, 5);
  });
  it('고요한 숲 (82): 즉시, 걸린 지속 힐은 4초 늘고 늘어난 만큼 회복량도', () => {
    const f = fight('druid'), t = tank(f);
    t.max = 1e6; t.hp = 1;
    putHot(t, 'sprout', { sec: 12, every: 3, total: 280 });
    heroApply(f, 'quietwood', f.me);
    expect(f.channel).toBe(0);
    for (const u of f.party) if (u !== t) u.hots = []; // 옆 사람 새싹 (군락 +)은 빼고 늘어난 몫만
    let got = 0;
    for (let i = 1; i <= 250; i++) { const h0 = t.hp; hotTick(f, t, 0.1); got += t.hp - h0; }
    expect(t.hots.some(h => h.key === 'sprout')).toBe(false);
    expect(got).toBeCloseTo(((280 * (12 + QUIETWOOD.ext)) / 12) * f.gear.heal * f.power, 4);
  });
  it('고요한 숲 (82): 새싹이 없는 아군 모두에게 새싹, 있던 새싹은 그대로 두고 늘림', () => {
    const f = fight('druid'), t = tank(f);
    putHot(t, 'sprout', { sec: 12, every: 3, total: 280 });
    const before = t.hots.find(h => h.key === 'sprout')!;
    E.use(f, 'quietwood', 0);
    expect(E.living(f).every(u => u.hots.some(h => h.key === 'sprout'))).toBe(true);
    expect(t.hots.filter(h => h.key === 'sprout')).toEqual([before]);
    expect(before.left).toBeCloseTo(12 + QUIETWOOD.ext, 9);
  });
  it('피어남은 남은 지속 힐을 거두어 1.5배로 한 번에', () => {
    const f = fight('druid'), t = tank(f);
    E.use(f, 'sprout', t.cell);
    const rest = t.hots.find(h => h.key === 'sprout')!.rest;
    f.gcd = 0; t.hp = 1;
    expect(E.use(f, 'bloom', t.cell).ok).toBe(true);
    expect(t.hots.some(h => h.key === 'sprout')).toBe(false);
    expect(t.hp - 1).toBeCloseTo(rest * 1.5 * f.gear.heal * f.power, 5);
  });
  it('해제: 독은 지우고 질병은 못 지움', () => {
    expect(HEROES.druid.dispel).toContain('독');
    expect(HEROES.druid.dispel).not.toContain('질병');
  });
  it('환생: 쓰러진 파티원을 40% 체력으로, 전투당 한 번', () => {
    const f = fight('druid'), d = dps(f);
    expect(E.skillUsesSpent(f, 'rebirth')).toBe(false);
    damage(f, d, (d.max * 5) / f.dmgMult); // 레벨 · 난이도 피해 배율 (data/tune)과 상관없이 쓰러뜨림
    expect(d.alive).toBe(false);
    const r = E.use(f, 'rebirth', d.cell);
    expect(r.ok).toBe(true);
    expect(E.skillUsesSpent(f, 'rebirth')).toBe(false); // 시전 시작만으로는 소모하지 않음
    finish(f);
    expect(d.alive).toBe(true);
    expect(f.rebirthUsed).toBe(true);
    expect(E.skillUsesSpent(f, 'rebirth')).toBe(true);
    damage(f, d, (d.max * 5) / f.dmgMult);
    expect(E.use(f, 'rebirth', d.cell).ok).toBe(false);
    expect(E.skillUsesSpent(f, 'sprout')).toBe(false);
    expect(E.skillUsesSpent(fight('druid'), 'rebirth')).toBe(false); // 새 전투에서는 복구
  });
  it('환생 시전 취소 시에는 사용 횟수가 남는다', () => {
    const f = fight('druid'), d = dps(f);
    damage(f, d, (d.max * 5) / f.dmgMult);
    expect(E.use(f, 'rebirth', d.cell).ok).toBe(true);
    expect(E.use(f, 'sprout', tank(f).cell).ok).toBe(true);
    expect(f.cast).toBeNull();
    expect(E.skillUsesSpent(f, 'rebirth')).toBe(false);
    expect(E.canTarget(f, 'rebirth', d.cell).ok).toBe(true);
  });
});

describe('성기사', () => {
  it('봉화는 Lv 6부터, 시작하면 탱커에게', () => {
    expect(fight('paladin', 5).beacon).toBeNull();
    const f = fight('paladin');
    expect(f.beacon).toBe(tank(f).id);
  });
  it('다른 사람에게 한 직접 힐의 40%가 봉화 대상에게', () => {
    const f = fight('paladin'), t = tank(f), d = dps(f);
    t.hp = 100; d.hp = 100;
    const a = heroHeal(f, d, 100);
    expect(t.hp - 100).toBeCloseTo(a * BEACON.share, 5);
  });
  it('봉화 대상 자신에게 한 힐은 두 번 들어가지 않음', () => {
    const f = fight('paladin'), t = tank(f);
    t.hp = 100;
    const a = heroHeal(f, t, 100);
    expect(t.hp - 100).toBeCloseTo(a, 5);
  });
  it('봉화 몫: 5인까지 40%, 10인 레이드 30%, 20인 레이드 25% (73)', () => {
    const at = (encounter: 'warden' | 'plague' | 'choir') => E.beaconShare(E.create({ encounter, diff: '보통', seed: 7, level: 100, hero: 'paladin' }));
    expect([at('warden'), at('plague'), at('choir')]).toEqual([BEACON.share, BEACON.raid10, BEACON.raid20]);
    const f = E.create({ encounter: 'plague', diff: '보통', seed: 7, level: 100, hero: 'paladin' }); f.gear.crit = 0;
    const t = f.party.find(u => u.id === f.beacon)!, d = dps(f);
    t.hp = 100; d.hp = 100;
    const a = heroHeal(f, d, 100);
    expect(t.hp - 100).toBeCloseTo(a * BEACON.raid10, 5);
  });
  it('빛의 파도: 신성한 힘 3칸 + 마나 5%, 범위 안 가장 다친 4명만, 봉화로 안 옮김, 이펙트는 회복한 칸마다 (73)', () => {
    const f = E.create({ encounter: 'choir', diff: '보통', seed: 7, level: 100, hero: 'paladin' }); f.gear.crit = 0;
    f.skills.forEach(s => { s.next = Infinity; });
    const near = (u: (typeof f.party)[number]) => f.party.filter(v => E.hexDist(f.cells[v.cell], f.cells[u.cell]) <= 1);
    const c = f.party.find(u => near(u).length > WAVE.max)!;
    const pool = near(c);
    f.beacon = f.party.find(u => !pool.includes(u))!.id; // 봉화는 범위 밖 사람에게
    pool.forEach((v, i) => { v.hp = v.max * (0.3 + i * 0.05); });
    const bc = f.party.find(u => u.id === f.beacon)!; bc.hp = bc.max * 0.5;
    const hp0 = new Map(f.party.map(u => [u.id, u.hp])), bc0 = bc.hp;
    f.power3 = 3; f.mana = 50; f.used = [];
    expect(E.use(f, 'lightWave', c.cell).ok).toBe(true);
    expect(f.mana).toBeCloseTo(50 - SKILLS.lightWave.cost * f.manaCut + 2, 5); // 즉시 스킬이라 바로 · 헌신 (힘 3칸) +2
    const healed = f.party.filter(u => u.hp > hp0.get(u.id)! + 1e-9).map(u => u.id).sort();
    expect(healed).toEqual(pool.slice(0, WAVE.max).map(u => u.id).sort());
    expect(bc.hp).toBeLessThanOrEqual(bc0);
    expect(f.used!.filter(x => x.key === 'lightWave').map(x => x.uid).sort()).toEqual(healed);
  });
  it('봉화 스킬: 빠른 힐 칸, 마나 없이 · GCD 없이, 재사용 = 봉화 바꾸기 대기 (2026-10-16)', () => {
    expect(SKILLS.beacon.cd).toBe(BEACON.cd);
    expect(SKILLS.beacon.cost).toBe(0);
    expect(SKILLS.beacon.gcd).toBe(0);
    const f = fight('paladin'), d = dps(f), m0 = f.mana;
    expect(E.use(f, 'beacon', d.cell).ok).toBe(true);
    expect(f.beacon).toBe(d.id);
    expect(f.mana).toBe(m0);
    expect(f.gcd).toBe(0);
    expect(E.use(f, 'beacon', tank(f).cell).ok).toBe(false); // 바꾸기 대기
  });
  it('봉화 바꾸기는 10초 대기', () => {
    const f = fight('paladin'), d = dps(f);
    expect(E.setBeacon(f, d)).toBe(true);
    expect(E.setBeacon(f, tank(f))).toBe(false);
    expect(f.beaconCd).toBe(BEACON.cd);
  });
  it('빛의 서약은 신성한 힘을 다 써서 칸 수만큼 길게', () => {
    const f = fight('paladin'), t = tank(f);
    f.power3 = 3;
    E.use(f, 'oath', t.cell); finish(f);
    expect(f.power3).toBe(0);
    expect(t.hots.find(h => h.key === 'oath')!.left).toBeGreaterThan(8);
  });
  it('보호의 손: 물리 피해 무시, 마법 피해는 받음', () => {
    const f = fight('paladin'), d = dps(f);
    E.use(f, 'handGuard', d.cell); finish(f);
    expect(d.immune).toBeGreaterThan(HAND_GUARD.sec - f.gcdBase - 0.1);
    const hp = d.hp;
    damage(f, d, 200);
    expect(d.hp).toBe(hp);
    damage(f, d, 200, true);
    expect(d.hp).toBeLessThan(hp);
  });
  it('빛의 성역: 범위 안 파티원 초당 회복', () => {
    const f = fight('paladin'), t = tank(f);
    E.use(f, 'sanctuary', t.cell); finish(f);
    expect(f.sanctuary).not.toBeNull();
    t.hp = 100;
    heroTick(f, 1);
    expect(t.hp - 100).toBeCloseTo(SANCTUARY.hps * f.gear.heal * f.power, 5);
  });
});

describe('레이드 재조정 (2026-10-07: 특성·능력 포함 기준, 26 9-1)', () => {
  const mk = (hero: 'priest' | 'druid' | 'paladin', level: number, encounter: 'plague' | 'choir' = 'plague', diff: '보통' | '어려움' | '악몽' = '보통') =>
    E.create({ encounter, diff, seed: 7, level, hero });
  it('난이도별 보스 보정: 역병 군주 어려움은 난이도 ×1.2에 보정이 더 붙고, 보통은 그대로', () => {
    expect(TUNE.plague?.['보통']).toBeUndefined();
    const tn = TUNE.plague!['어려움']!.dmg!;
    expect(tn).toBeGreaterThan(1);
    expect(mk('priest', 35, 'plague', '어려움').dmgMult / mk('priest', 35, 'plague', '보통').dmgMult).toBeCloseTo(1.2 * tn);
  });
  it('특성 단 마나 보정: 세 직업 모두 열린 특성 단마다 −2%, 프로토타입은 그대로 (67 → 77)', () => {
    for (const h of ['priest', 'druid', 'paladin'] as const) {
      expect(mk(h, 100).manaCut).toBeCloseTo(1 - TIER_MANA * 10);
      expect(mk(h, 17).manaCut).toBeCloseTo(1 - TIER_MANA * 3);
      expect(mk(h, 4).manaCut).toBe(1);
    }
    expect(E.create({ encounter: 'plague', diff: '보통', seed: 7, level: 100, proto: true }).manaCut).toBe(1);
    expect(E.costOf(mk('priest', 100), 'heal')).toBeCloseTo(3 * (1 - TIER_MANA * 10));
    expect(E.costOf(mk('druid', 100), 'growth')).toBeCloseTo(3 * (1 - TIER_MANA * 10)); // 임시 보정 (단마다 −4%)은 없앰
  });
  it('자동 힐러 3인: 셋이 붙어 크게 다치면 광역 힐 (2026-10-14 검토: 3인은 문턱을 못 넘어 광역을 안 씀)', () => {
    for (const hero of ['priest', 'druid'] as const) {
      const f = E.create({ encounter: 'reedbank', diff: '보통', seed: 7, level: 100, hero });
      f.skills.forEach(s => { s.next = Infinity; }); f.tels = [];
      const [a, b, c] = f.party, near = f.cells.filter(x => !x.unit && !x.block && E.hexDist(x, f.cells[c.cell]) === 1 && E.hexDist(x, f.cells[b.cell]) <= 1)[0];
      if (E.hexDist(f.cells[a.cell], f.cells[c.cell]) > 1) { f.cells[a.cell].unit = null; a.cell = a.home = near.i; near.unit = a; } // 셋을 붙여 세움
      for (const u of f.party) u.hp = u.max * 0.4; // 순간 치유 선 (35%) 위
      f.cd.hymn = f.cd.quietwood = 999; f.g = { p: 0 }; f.gcd = 0;
      E.autoHealer(f);
      expect(f.cast?.key, hero).toBe(hero === 'priest' ? 'poh' : 'wildflower');
    }
  });
  it('들꽃 군락: 시전이 끝나면 재사용 대기 10초', () => {
    const f = mk('druid', 100);
    const u = f.party.find(x => x.role === 'tank')!;
    expect(E.use(f, 'wildflower', u.cell).ok).toBe(true);
    finish(f);
    expect(f.cd.wildflower).toBeGreaterThan(9);
    expect(E.use(f, 'wildflower', u.cell).ok).toBe(false);
  });
  it('드루이드 20인: 들꽃 군락 2칸, 10인은 1칸', () => {
    expect(E.areaRadius(mk('druid', 100, 'choir'), 'wildflower')).toBe(DRUID_BIG.wildRange);
    expect(E.areaRadius(mk('druid', 100, 'plague'), 'wildflower')).toBe(1);
  });
});
