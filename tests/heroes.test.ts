/** 힐러 직업 (25): 저장·직업 퀘스트·직업 바꾸기, 드루이드·성기사 고유 효과 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../src/data/encounters';
import { BEACON, DRUID_BIG, HAND_GUARD, SANCTUARY, TALENT_STANDIN } from '../src/data/heroConst';
import { HERO_KEYS, HEROES, heroSkills, skillAt, slotIdOf } from '../src/data/heroes';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
import { heroHeal, heroTick } from '../src/engine/heroes';
import { heroWin } from '../src/game/settle';
import { G, heroNow, heroStatus, switchHero, switchOpen } from '../src/game/state';
import { TUT } from '../src/game/tutorial';
import { migrate, newSave } from '../src/platform/storage';

type F = ReturnType<typeof E.create>;
const fight = (hero: 'priest' | 'druid' | 'paladin', level = 100) => {
  const f = E.create({ encounter: 'warden', diff: '보통', seed: 7, level, hero });
  f.gear.crit = 0;
  f.standin = null; // 기술 수치만 봄 (임시 특성 보정은 아래 따로)
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

describe('직업 퀘스트', () => {
  const at = (hero: 'priest' | 'druid' | 'paladin') => { const s = newSave(1); s.tut = TUT.done; s.hero = hero; return s; };
  it('튜토리얼 중엔 세지 않음', () => {
    const s = at('druid'); s.tut = TUT.dungeon;
    expect(heroWin(s, 'dungeon', 'rustfort', '보통')).toBeNull();
  });
  it('드루이드 「숲의 부름」: 녹슨 요새 보통 이상만, 1번이면 해금', () => {
    const s = at('druid');
    expect(heroWin(s, 'dungeon', 'rustfort', '쉬움')).toBeNull();
    expect(heroWin(s, 'raid', 'abyss1', '보통')).toBeNull();
    expect(heroWin(s, 'dungeon', 'rustfort', '어려움')).toEqual({ hero: 'druid', n: 1, need: 1, unlocked: true });
    expect(s.heroes.druid!.unlocked).toBe(true);
    expect(s.heroes.druid!.wins).toBe(3);
    expect(heroWin(s, 'dungeon', 'rustfort', '보통')).toBeNull(); // 이미 해금
  });
  it('성기사 「첫 맹세」: 녹슨 요새 어려움 이상만, 1번이면 해금 (2026-10-07 정식 조건)', () => {
    const s = at('paladin');
    expect(heroWin(s, 'dungeon', 'rustfort', '보통')).toBeNull();
    expect(s.heroes.paladin!.unlocked).toBeFalsy();
    expect(heroWin(s, 'dungeon', 'rustfort', '악몽')).toEqual({ hero: 'paladin', n: 1, need: 1, unlocked: true });
  });
  it('사제는 퀘스트 없이 판 수만 셈', () => {
    const s = at('priest');
    expect(heroWin(s, 'dungeon', 'rustfort', '보통')).toBeNull();
    expect(s.heroes.priest!.wins).toBe(1);
  });
});

describe('직업 바꾸기', () => {
  beforeEach(() => {
    G.save = newSave(1);
    G.save.tut = TUT.done;
    G.save.settings.devUnlock = false;
  });
  it('Lv 10 전엔 못 바꿈, 튜토리얼 중엔 사제로만', () => {
    G.save.player.level = 9;
    expect(switchOpen().ok).toBe(false);
    expect(switchHero('druid')).toBe(false);
    G.save.tut = TUT.dungeon; G.save.hero = 'druid';
    expect(heroNow()).toBe('priest');
  });
  it('Lv 10: 드루이드는 퀘스트 상태로 고를 수 있고, 성기사(Lv 20)는 잠김', () => {
    G.save.player.level = 10;
    expect(heroStatus('druid').state).toBe('quest');
    expect(heroStatus('paladin').state).toBe('locked');
    expect(switchHero('paladin')).toBe(false);
    expect(switchHero('druid')).toBe(true);
    expect(G.save.hero).toBe('druid');
    expect(heroStatus('druid').state).toBe('now');
  });
  it('휠 배치·칸 탭은 직업마다 따로', () => {
    G.save.player.level = 20;
    const lay = { NW: 'hymn', N: 'purify', NE: 'heal', W: 'renew', E: 'flash', SW: null, S: 'poh', SE: 'guardian' };
    G.save.settings.layout = lay; G.save.settings.tapKey = 'flash';
    switchHero('druid');
    expect(G.save.settings.layout).toBeNull();
    expect(G.save.settings.tapKey).toBe('heal');
    G.save.settings.tapKey = 'renew';
    switchHero('priest');
    expect(G.save.settings.layout).toEqual(lay);
    expect(G.save.settings.tapKey).toBe('flash');
    expect(G.save.heroes.druid!.tapKey).toBe('renew');
  });
  it('개발 빌드 「레벨 잠금 무시」면 Lv 1에서도 퀘스트 상태로 열림', () => {
    G.save.settings.devUnlock = true;
    expect(switchOpen()).toEqual({ ok: true, dev: true, why: '' });
    expect(heroStatus('paladin')).toMatchObject({ state: 'quest', dev: true });
  });
});

describe('휠 칸 이름 ↔ 직업 스킬', () => {
  it('모든 직업: 칸 이름으로 찾은 스킬이 다시 같은 칸 이름', () => {
    for (const h of HERO_KEYS) for (const k of heroSkills(h)) {
      expect(k === 'serenity' || k === 'sanctify' || skillAt(h, slotIdOf(k)) === k).toBe(true);
    }
  });
  it('8번째 칸은 사제만 비어 있음', () => {
    expect(skillAt('priest', 'unique')).toBeNull();
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
    damage(f, d, d.max * 5);
    expect(d.alive).toBe(false);
    const r = E.use(f, 'rebirth', d.cell);
    expect(r.ok).toBe(true);
    finish(f);
    expect(d.alive).toBe(true);
    expect(f.rebirthUsed).toBe(true);
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
    expect(d.immune).toBeGreaterThan(HAND_GUARD.sec - 1);
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
  it('난이도별 보스 보정: 역병 군주 어려움 피해 ×1.2, 보통은 그대로', () => {
    expect(ENCOUNTERS.plague.tune?.['보통']).toBeUndefined();
    expect(mk('priest', 35, 'plague', '어려움').dmgMult / mk('priest', 35, 'plague', '보통').dmgMult).toBeCloseTo(1.2 * 1.2);
  });
  it('임시 특성 보정: 드루이드·성기사만, 열린 특성 단마다', () => {
    expect(mk('priest', 100).standin).toBeNull();
    expect(mk('druid', 5).standin).toEqual({ heal: 1, mana: 1, guard: 1 });
    const s = mk('paladin', 35).standin!;
    expect(s.heal).toBeCloseTo(1 + TALENT_STANDIN.heal * 3);
    expect(s.mana).toBeCloseTo(1 - TALENT_STANDIN.mana * 3);
    expect(s.guard).toBeCloseTo(1 - TALENT_STANDIN.guard * 3);
  });
  it('들꽃 군락: 시전이 끝나면 재사용 대기 10초', () => {
    const f = mk('druid', 100); f.standin = null;
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
