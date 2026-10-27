/** 어픽스 (32 난이도 어픽스, 13 3-3 주간 도전)·적 레벨 = 내 레벨 (32)·주간 도전 「모래시계 시련」 (13 3-2)·광고 이어하기 (15) */
import { describe, expect, it } from 'vitest';
import { AFFIXES, diffAffixes, WEEKLY_AFFIXES, type AffixKey } from '../src/data/affixes';
import { CHAL, CHAL_ROTA, chalAffixes, chalHalf, chalLimit, chalMult, chalReward, chalShown } from '../src/data/challenge';
import { CHAL_DUN } from '../src/data/chal-dungeons';
import { ALL_DIFFS, CONTENT, contentOf, stageOf } from '../src/data/content';
import { clearGold, clearXp, EXPLORE_REWARD, restRun } from '../src/data/progression';
import * as E from '../src/engine';
import { affCast, affCd, affDeath, affDebuffEnd, affixTick, affHeal, affMobDown, affNecrotic, affOverflow, affRegen, affTankThreat, AFX, chalTime } from '../src/engine/affixes';
import { TALENT_DEF, type TalentKey } from '../src/data/talents';
import type { Telegraph } from '../src/engine/types';
import { castOf, cdOf, talentCd } from '../src/engine/talents';
import { damage, heal } from '../src/engine/core';
import { rollover } from '../src/game/economy';
import { chalContent, chalPool, nextWeekAffixes, pickChalContent, runMode, weekAffixes } from '../src/game/runmode';
import { settle, type BattleResult } from '../src/game/settle';
import { newSave, type SaveData } from '../src/platform/storage';

let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const T0 = new Date(2026, 9, 7, 12).getTime();

function save(level = 30): SaveData {
  const s = newSave(1);
  s.tut = 3; s.player.level = level;
  rollover(s, T0, rng);
  return s;
}
const result = (o: Partial<BattleResult> = {}): BattleResult => ({
  content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 4, time: 360, restSec: 30, deaths: 0,
  healed: 7000, overheal: 1000, dispels: 2, dispellable: 2, endMana: 40, minMana: 5, auto: false,
  party: [{ nick: '가', pers: '덜렁이', role: 'melee', alive: true }], detail: [], ...o,
});

describe('어픽스 전투 효과', () => {
  it('어픽스·배율이 없으면 f.aff = null이고 결과가 그대로 (프로토타입 일치)', () => {
    const a = E.simulate({ encounter: 'warden', diff: '보통', seed: 3, gear: 'adv0' });
    const b = E.simulate({ encounter: 'warden', diff: '보통', seed: 3, gear: 'adv0', affixes: [], bossMult: { hp: 1, dmg: 1 } });
    expect(b.aff).toBeNull();
    expect(b.t).toBe(a.t);
    expect(b.stats).toEqual(a.stats);
  });

  it('보스 배율 (주간 도전): 보스·잡몹 체력, 받는 피해', () => {
    const a = E.create({ encounter: 'warden', diff: '보통', seed: 1 });
    const b = E.create({ encounter: 'warden', diff: '보통', seed: 1, bossMult: { hp: 1.2, dmg: 1.4 } });
    expect(b.bossMax).toBeCloseTo(a.bossMax * 1.2);
    expect(b.dmgMult).toBeCloseTo(a.dmgMult * 1.4);
    const c = E.create({ encounter: 'gate', diff: '보통', seed: 1 }), d = E.create({ encounter: 'gate', diff: '보통', seed: 1, bossMult: { hp: 1.2, dmg: 1 } });
    expect(d.mobs[0].max).toBeCloseTo(c.mobs[0].max * 1.2);
  });

  it('서두름: 보스 기술 주기 -15%', () => {
    const a = E.create({ encounter: 'warden', diff: '보통', seed: 1 });
    const b = E.create({ encounter: 'warden', diff: '보통', seed: 1, affixes: ['haste'] });
    const i = a.skills.findIndex(s => !s.hidden && isFinite(s.period));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(b.skills[i].period).toBeCloseTo(a.skills[i].period * 0.85);
  });

  it('폭주하는 쫄: 보스 아닌 적 체력 +30%, 적 체력 합도', () => {
    const a = E.create({ encounter: 'gate', diff: '보통', seed: 1 });
    const b = E.create({ encounter: 'gate', diff: '보통', seed: 1, affixes: ['frenzy'] });
    expect(b.mobs[0].max).toBeCloseTo(a.mobs[0].max * 1.3);
    expect(b.bossMax).toBeCloseTo(a.bossMax * 1.3);
  });

  it('메마름: 받는 치유 -20%', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, affixes: ['dry'] });
    expect(affHeal(f)).toBe(0.8);
    const u = f.party.find(x => !x.me)!;
    u.hp = 1;
    expect(heal(f, u, 100, false, true)).toBeCloseTo(80);
  });

  it('격노: 보스 체력 30% 아래부터 피해 +30% (한 번만)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, affixes: ['rage'] });
    const m0 = f.dmgMult;
    affixTick(f);
    expect(f.dmgMult).toBe(m0);
    f.bossHp = f.bossMax * 0.29;
    affixTick(f); affixTick(f);
    expect(f.dmgMult).toBeCloseTo(m0 * 1.3);
  });

  it('역병: 15초부터 2명에게 역병 독 (힐러 빼고), 다음은 25초 뒤', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, affixes: ['plague'] });
    f.t = 15; affixTick(f);
    const got = f.party.filter(u => u.debuffs.some(d => d.name === '역병 독'));
    expect(got.length).toBe(2);
    expect(got.some(u => u.me)).toBe(false);
    expect(f.aff!.plagueAt).toBe(40);
  });

  it('불안정: 지우면 옆 칸에 피해, 두면 그 사람만 피해', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, affixes: ['unstable'] });
    f.t = 20; affixTick(f);
    const u = f.party.find(x => x.debuffs.some(d => d.name === '불안정'))!;
    const d = u.debuffs.find(x => x.name === '불안정')!;
    expect(d.trap).toBe(true);
    const before = new Map(f.party.map(x => [x.id, x.hp]));
    affDebuffEnd(f, u, d, true);
    expect(u.hp).toBe(before.get(u.id));
    expect(f.party.some(x => x !== u && x.hp < before.get(x.id)!)).toBe(true);
    const hp = u.hp;
    affDebuffEnd(f, u, d, false);
    expect(u.hp).toBeLessThan(hp);
  });

  it('전염병: 12초부터 2명에게 질병', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, affixes: ['contagion'] });
    f.t = 12; affixTick(f);
    expect(f.party.filter(u => u.debuffs.some(d => d.name === '전염병' && d.type === '질병')).length).toBe(2);
  });

  it('동요: 체력 30% 아래면 3초 공격 안 함, 15초에 한 번', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, affixes: ['panic'] });
    expect(f.abOn).toBe(true);
    const u = f.party.find(x => !x.me)!;
    u.hp = u.max * 0.2;
    affixTick(f);
    expect(u.mods.some(m => m.k === 'nodps' && m.src === 'panic')).toBe(true);
    u.mods = [];
    f.t = 5; affixTick(f);
    expect(u.mods.length).toBe(0);
  });

  it('메아리: 지운 디버프가 옆 칸으로 (확률 10%)', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, affixes: ['echo'] });
    f.rng = () => 0;
    const u = f.party.find(x => !x.me)!;
    affDebuffEnd(f, u, { id: 99, name: '시험 독', type: '독', left: 5, dot: 10 }, true);
    expect(f.party.some(x => x !== u && x.debuffs.some(d => d.name === '시험 독'))).toBe(true);
  });

  it('혼돈의 바닥: 장판 예고에 1곳 더', () => {
    const first = (affixes: never[] | ['chaos']) => {
      const f = E.create({ encounter: 'warden', diff: '보통', seed: 2, affixes });
      while (!f.over && f.t < 300) {
        E.autoHealer(f); E.step(f); f.events.length = 0;
        const z = f.tels.find(t => t.kind === 'zone');
        if (z) return z.cells.size;
      }
      return -1;
    };
    const a = first([]), b = first(['chaos']);
    expect(a).toBeGreaterThan(0);
    expect(b).toBe(a + 1);
  });
});

describe('새 어픽스 8개 (110, 2026-10-22 Lim 「다양한 어픽스를 추가」)', () => {
  const mk = (k: Parameters<typeof E.create>[0]['affixes'], encounter: 'warden' | 'gate' = 'warden') => E.create({ encounter, diff: '보통', seed: 1, affixes: k });

  it('깊은 상처: 90% 아래면 못 지우는 상처 (2초마다 중첩, 최대 3), 90% 넘으면 사라짐', () => {
    const f = mk(['grievous']), u = f.party.find(x => !x.me)!;
    u.hp = u.max * 0.5; affixTick(f);
    const d = u.debuffs.find(x => x.name === '깊은 상처')!;
    expect(d.lock).toBe(true); expect(d.cureAt).toBe(AFX.grievous.below); expect(d.grow!.max).toBe(3);
    affixTick(f);
    expect(u.debuffs.filter(x => x.name === '깊은 상처').length).toBe(1);
    expect(f.party.filter(x => x !== u && x.hp >= x.max * 0.9).every(x => !x.debuffs.some(y => y.name === '깊은 상처'))).toBe(true);
  });

  it('파동: 15초부터 25초마다 파티 전체 피해', () => {
    const f = mk(['pulse']);
    const before = f.party.map(u => u.hp);
    f.t = 14.9; affixTick(f);
    expect(f.party.map(u => u.hp)).toEqual(before);
    f.t = 15; affixTick(f);
    expect(f.party.every((u, i) => u.hp < before[i])).toBe(true);
    expect(f.aff!.pulseAt).toBe(40);
  });

  it('괴저: 보스 평타를 맞으면 받는 치유 −4% 중첩 (최대 5), 5초', () => {
    const f = mk(['necrotic']), tk = f.party.find(u => u.role === 'tank')!;
    for (let i = 0; i < 7; i++) affNecrotic(f, tk);
    const d = tk.debuffs.find(x => x.name === '괴저')!;
    expect(d.stack).toBe(5); expect(d.healCut).toBe(0.04); expect(d.left).toBe(5); expect(d.lock).toBe(true);
    tk.hp = 1;
    expect(heal(f, tk, 100, false, true)).toBeCloseTo(80);
  });

  it('고갈 · 한기: 내 마나 회복 −50%, 내 시전 시간 +15%', () => {
    expect(affRegen(mk(['drain']))).toBe(0.5);
    expect(affCast(mk(['chill']))).toBe(1.15);
    const a = mk([]), b = mk(['chill']);
    expect(castOf(b, 'heal')).toBeCloseTo(castOf(a, 'heal') * 1.15);
  });

  it('폭군: 보스 구간만 보스 체력 +15% · 피해 +10%, 졸개 구간은 그대로', () => {
    const a = mk([]), b = mk(['tyrant']);
    expect(b.bossMax).toBeCloseTo(a.bossMax * 1.15);
    expect(b.dmgMult).toBeCloseTo(a.dmgMult * 1.1);
    const c = mk([], 'gate'), d = mk(['tyrant'], 'gate');
    expect(d.bossMax).toBeCloseTo(c.bossMax);
  });

  it('지진: 10초부터 2명에게 표시, 끝나면 그 사람과 옆 칸 피해', () => {
    const f = mk(['quake']);
    f.t = 10; affixTick(f);
    const hit = f.party.filter(u => u.debuffs.some(d => d.name === '지진'));
    expect(hit.length).toBe(2);
    const u = hit[0], d = u.debuffs.find(x => x.name === '지진')!, hp = u.hp;
    affDebuffEnd(f, u, d, false);
    expect(hp - u.hp).toBeGreaterThan(0);
  });

  it('복수심: 보스가 아닌 적이 쓰러질 때마다 파티 전체 4초 지속 피해, 겹치면 중첩', () => {
    const f = mk(['spite'], 'gate'), mob = f.mobs[0];
    affMobDown(f, mob);
    const live = f.party.filter(u => u.alive);
    for (const u of live) {
      const d = u.debuffs.find(x => x.name === '복수심')!;
      expect(d.left).toBe(AFX.spite.sec); expect(d.lock).toBe(true); expect(d.stack).toBe(1); expect(d.dot).toBeGreaterThan(0);
    }
    const u = live[0], d = u.debuffs.find(x => x.name === '복수심')!;
    d.left = 1; affMobDown(f, mob); affMobDown(f, { ...mob, boss: true });
    expect(d.stack).toBe(2); expect(d.left).toBe(AFX.spite.sec);
    expect(u.debuffs.filter(x => x.name === '복수심').length).toBe(1);
  });

  it('주간 도전 골드 · 경험치 = 보통 던전의 반 × 단계 보너스 (1 + 3% × (단계 − 1)), 어픽스와 상관없음 (좋은 주는 115에서 없앰)', () => {
    expect(chalReward(1)).toBe(1);
    expect(chalReward(11)).toBeCloseTo(1.3);
    expect(chalReward(20)).toBeCloseTo(1.57);
    expect(CHAL.rewardCut).toBe(0.5);
    const s1 = save(), s2 = save(), s3 = save();
    const one = settle(s1, result({ stage: 30, chal: 1, limit: chalLimit(1, 'rustfort'), time: 300 }), rng, [], T0);
    const ten = settle(s2, result({ stage: 30, chal: 11, limit: chalLimit(11, 'rustfort'), time: 300 }), rng, [], T0);
    expect(one.gold).toBe(restRun(clearGold(30, '보통', 'S') * 0.5));
    expect(one.xp).toBe(restRun(clearXp(30, '보통', 'S', { win: true }) * 0.5));
    expect(ten.gold).toBe(restRun(clearGold(30, '보통', 'S') * 0.5 * chalReward(11)));
    expect(ten.xp).toBe(restRun(clearXp(30, '보통', 'S', { win: true }) * 0.5 * chalReward(11)));
    const b = settle(s3, result({ stage: 30, chal: 1, limit: chalLimit(1, 'rustfort'), time: 300, affixes: ['tyrant', 'haste'] }), rng, [], T0);
    expect(b.gold).toBe(one.gold);
    expect(b.xp).toBe(one.xp);
  });
});

describe('새 어픽스 8개 (115, 2026-10-27 Lim 「더 늘릴만한 요소가 있는지 찾아보자」 → 추천 첫 묶음)', () => {
  const mk = (k: Parameters<typeof E.create>[0]['affixes'], encounter: 'warden' | 'gate' = 'warden') => E.create({ encounter, diff: '보통', seed: 1, affixes: k });

  it('넘침: 넘친 치유의 절반이 그 사람에게 치유 흡수 막 (최대 체력 20%까지, 해제 안 됨), 다음 치유가 막부터 깎음', () => {
    const f = mk(['overflow']), u = f.party.find(x => !x.me && x.alive)!;
    u.hp = u.max;
    heal(f, u, 100, true, true);
    const d = u.debuffs.find(x => x.name === '넘침')!;
    expect(d.absorbLeft).toBeCloseTo(50); expect(d.lock).toBe(true); expect(d.left).toBe(AFX.overflow.sec);
    u.hp = u.max - 100;
    expect(heal(f, u, 30, true, true)).toBe(0);
    expect(d.absorbLeft).toBeCloseTo(20);
    affOverflow(f, u, 1e9);
    expect(d.absorbLeft).toBeCloseTo(u.max * AFX.overflow.cap);
    const g = mk([]), v = g.party.find(x => !x.me && x.alive)!;
    v.hp = v.max; heal(g, v, 100, true, true);
    expect(v.debuffs.some(x => x.name === '넘침')).toBe(false);
  });

  it('진동: 보스 · 졸개 구간 모두 진동 기술 (P-QUAKE, 12초부터 20초마다 2초 예고), 울리면 시전 중인 힐이 끊기고 3초 잠김', () => {
    for (const enc of ['warden', 'gate'] as const) {
      const f = mk(['tremor'], enc), s = f.skills.find(x => x.key === 'afx-tremor')!;
      expect(s).toBeTruthy();
      expect(s).toMatchObject({ next: AFX.tremor.first, period: AFX.tremor.every, cast: AFX.tremor.cast, quake: true, kind: 'aoe' });
    }
    const f = mk(['tremor']), s = f.skills.find(x => x.key === 'afx-tremor')!;
    f.cast = { key: 'heal', cell: f.me.cell, uid: f.me.id, left: 1, total: 2 };
    const hp = f.party.map(u => u.hp);
    s.hit!(f, { id: 0, skill: s, start: 0, impact: 0, units: [], cells: new Set() } as Telegraph);
    expect(f.cast).toBeNull();
    expect(f.lock.heal?.left).toBe(AFX.tremor.lock);
    expect(f.party.some((u, i) => u.hp < hp[i])).toBe(true);
    expect(mk([]).skills.some(x => x.key === 'afx-tremor')).toBe(false);
  });

  it('산만함: 탱커 위협 × 0.6', () => {
    expect(affTankThreat(mk(['skittish']))).toBe(0.6);
    expect(affTankThreat(mk(['tyrant']))).toBe(1);
  });

  it('완치 선고: 8초부터 30초마다 탱커 아닌 1명에게 피해 + 8초 표식 (가득 차면 사라짐, 시간이 다 되면 큰 피해)', () => {
    const f = mk(['doom']);
    f.t = AFX.doom.first - 0.1; affixTick(f);
    expect(f.party.some(u => u.debuffs.some(d => d.name === '완치 선고'))).toBe(false);
    f.t = AFX.doom.first; affixTick(f);
    const hit = f.party.filter(u => u.debuffs.some(d => d.name === '완치 선고'));
    expect(hit.length).toBe(1);
    const u = hit[0], d = u.debuffs.find(x => x.name === '완치 선고')!;
    expect(u.role).not.toBe('tank');
    expect(u.hp).toBeLessThan(u.max);
    expect(d).toMatchObject({ cureAt: 1, lock: true, left: AFX.doom.sec });
    expect(d.end).toMatchObject({ p: 'hit' });
    expect(f.aff!.doomAt).toBe(AFX.doom.first + AFX.doom.every);
  });

  it('결속: 보스가 아닌 적이 쓰러질 때마다 남은 적 체력 +15% (더해서 겹침), 졸개 구간 적 체력 합도', () => {
    const f = mk(['bolster'], 'gate'), [a, b, c] = f.mobs;
    expect(c).toBeTruthy();
    const max0 = b.max, sum0 = f.bossMax;
    a.alive = false; affMobDown(f, a);
    expect(b.max).toBeCloseTo(max0 * 1.15);
    expect(f.aff!.bolster[b.id]).toBe(1);
    expect(f.bossMax).toBeGreaterThan(sum0);
    const c1 = c.max / 1.15;
    b.alive = false; affMobDown(f, b);
    expect(c.max).toBeCloseTo(c1 * 1.3);
    expect(f.aff!.bolster[c.id]).toBe(2);
    expect(f.mobs.filter(m => m.alive && !m.boss).every(m => f.aff!.bolster[m.id] === 2)).toBe(true);
  });

  it('옮겨붙는 역병: 6초부터 25초마다 탱커 아닌 1명에게 질병 (지우면 옆 칸으로 옮겨붙음, 두면 끝날 때 적 피해 +5%)', () => {
    const f = mk(['blight']);
    f.t = AFX.blight.first; affixTick(f);
    const hit = f.party.filter(u => u.debuffs.some(d => d.name === '옮겨붙는 역병'));
    expect(hit.length).toBe(1);
    expect(hit[0].role).not.toBe('tank');
    const d = hit[0].debuffs.find(x => x.name === '옮겨붙는 역병')!;
    expect(d.type).toBe('질병'); expect(d.dot).toBeGreaterThan(0);
    expect(d.end).toMatchObject({ p: 'jump', mult: AFX.blight.mult, boost: AFX.blight.boost });
    expect(f.aff!.blightAt).toBe(AFX.blight.first + AFX.blight.every);
  });

  it('시간의 족쇄: 내 재사용 대기 +25% (스킬 · 특성 버튼)', () => {
    const a = mk([]), b = mk(['chains']);
    expect(affCd(b)).toBe(1.25);
    expect(cdOf(b, 'purify')).toBeCloseTo(cdOf(a, 'purify') * 1.25);
    expect(cdOf(b, 'guardian')).toBeCloseTo(cdOf(a, 'guardian') * 1.25);
    const k = (Object.keys(TALENT_DEF) as TalentKey[]).find(x => TALENT_DEF[x].active?.cd)!;
    expect(talentCd(b, k)).toBeCloseTo(TALENT_DEF[k].active!.cd * 1.25);
    expect(talentCd(a, k)).toBe(TALENT_DEF[k].active!.cd);
  });

  it('도전자의 위기: 파티원이 쓰러질 때마다 제한시간에 15초 (나는 빼고), 어픽스가 없으면 그대로', () => {
    const f = mk(['peril']), u = f.party.find(x => !x.me)!;
    f.t = 30;
    affDeath(f, u); affDeath(f, f.me);
    expect(f.aff!.lost).toBe(AFX.peril);
    expect(chalTime(f)).toBe(30 + AFX.peril);
    const g = mk([]); g.t = 30;
    expect(chalTime(g)).toBe(30);
    // 실제로 쓰러지면 (core damage)
    const h = mk(['peril']), v = h.party.find(x => !x.me && x.alive)!;
    damage(h, v, v.max * 50, false, 'fixed');
    expect(v.alive).toBe(false);
    expect(h.aff!.lost).toBe(AFX.peril);
  });
});

describe('적 레벨 = 내 레벨 − 2, 어픽스는 난이도 (32, 2026-10-08)', () => {
  it('쉬움·보통 없음. 어려움·악몽 Lv 30부터 격노, 악몽 Lv 50부터 역병. 불안정은 주간 도전으로', () => {
    for (const lv of [1, 29, 30, 50, 100]) {
      expect(diffAffixes('쉬움', lv)).toEqual([]);
      expect(diffAffixes('보통', lv)).toEqual([]);
    }
    expect(diffAffixes('어려움', 29)).toEqual([]);
    expect(diffAffixes('어려움', 30)).toEqual(['rage']);
    expect(diffAffixes('어려움', 80)).toEqual(['rage']);
    expect(diffAffixes('악몽', 29)).toEqual([]);
    expect(diffAffixes('악몽', 49)).toEqual(['rage']);
    expect(diffAffixes('악몽', 50)).toEqual(['rage', 'plague']);
    expect(WEEKLY_AFFIXES).toContain('unstable');
    expect(CHAL_ROTA.some(w => w.includes('unstable'))).toBe(true);
  });
  it('적 레벨로 골드·경험치를 셈, 어픽스도 적 레벨 기준', () => {
    const s = save(34), m = runMode(s, contentOf('snowlab'), '어려움', { chal: 0 });
    expect(m).toMatchObject({ stage: 34, affixes: ['rage'], chal: 0 });
    const x = settle(s, result({ content: 'snowlab', diff: '어려움', stage: m.stage, affixes: m.affixes }), rng, [], T0);
    expect(x.gold).toBe(restRun(clearGold(34, '어려움', 'S'))); // 휴식 판 = 예전의 2/3 (90, 2026-10-17)
    expect(x.xp).toBe(restRun(clearXp(34, '어려움', 'S', { win: true })));
    // 내 레벨이 높아도 녹슨 요새 어려움은 Lv 9 · 격노 없음
    expect(runMode(save(52), contentOf('rustfort'), '어려움', { chal: 0 })).toMatchObject({ stage: 9, affixes: [] });
  });
  it('탐험 · 던전 적 레벨 = 장소 레벨 + 난이도 (61 1-2), 내 레벨과 상관없음', () => {
    const rf = contentOf('rustfort');
    for (const lv of [1, 5, 10, 50, 100]) {
      expect(runMode(save(lv), rf, '쉬움', { chal: 0 }).stage).toBe(5);
      expect(runMode(save(lv), rf, '보통', { chal: 0 })).toMatchObject({ stage: 7, affixes: [] });
      expect(runMode(save(lv), rf, '어려움', { chal: 0 }).stage).toBe(9);
      expect(runMode(save(lv), rf, '악몽', { chal: 0 }).stage).toBe(11);
    }
    // Lv 100을 넘지 않음
    expect(runMode(save(100), contentOf('lantern'), '악몽', { chal: 0 }).stage).toBe(100);
    expect(runMode(save(100), contentOf('lantern'), '보통', { chal: 0 }).stage).toBe(98);
    // 튜토리얼 전도 같은 값 · 어픽스 없음
    const tut = save(40); tut.tut = 1;
    expect(runMode(tut, rf, '악몽', { chal: 0 })).toMatchObject({ stage: 11, affixes: [] });
  });
  it.each(['rustfort', 'plateau'] as const)('%s: 모든 난이도에서 장소 레벨이 낮아도 경험치 감산 없음', content => {
    const c = contentOf(content), kind = c.kind === 'explore' ? EXPLORE_REWARD : 1;
    for (const diff of ALL_DIFFS) {
      const low = save(52), same = save(52), high = save(52);
      const stage = runMode(low, c, diff, { chal: 0 }).stage;
      expect(stage).toBeLessThan(52 - 7);
      const rewards = [
        settle(low, result({ content, diff, stage }), rng, [], T0),
        settle(same, result({ content, diff, stage: 52 }), rng, [], T0),
        settle(high, result({ content, diff, stage: 70 }), rng, [], T0),
      ];
      const xp = restRun(clearXp(52, diff, 'S', { win: true }) * kind);
      expect(rewards.map(x => x.xp)).toEqual([xp, xp, xp]);
      expect(low.player.xp).toBe(xp);
    }
  });
  it('지면 경험치 없음 (2026-10-13 Lim), 포기도 무보상', () => {
    for (const content of ['rustfort', 'plateau'] as const) {
      const lost = settle(save(52), result({ content, win: false, stage: 1 }), rng, [], T0);
      expect(lost.xp).toBe(0);
      const quit = settle(save(52), result({ content, win: false, quit: true, stage: 1 }), rng, [], T0);
      expect(quit.xp).toBe(0);
    }
  });
  it('레이드 경험치 배율 유지', () => {
    const r = save(90); r.daily.pub = 3;
    const y = settle(r, result({ content: 'abyss1', diff: '보통', stage: 90, segIdx: 0, segN: 1 }), rng, [], T0);
    expect(y.xp).toBe(restRun(clearXp(90, '보통', 'S', { raid: 10, win: true })));
  });
  it('레이드·탐험은 어픽스 없음. 레이드 적 레벨은 장소 레벨에 고정 (2026-10-21 Lim, 예전엔 내 레벨), 열림 레벨 전에 들어가도 (개발 빌드) 열림 레벨', () => {
    expect(runMode(save(90), contentOf('abyss1'), '보통', { chal: 0 }).stage).toBe(45);
    expect(runMode(save(100), contentOf('abyss1'), '악몽', { chal: 0 })).toMatchObject({ stage: 60, affixes: [] });
    expect(runMode(save(85), contentOf('cathedral1'), '어려움', { chal: 0 }).stage).toBe(70);
    // 공개모집도 그 레이드 레벨 근처 (Lim 「레이드에서 공개모집 멤버는 해당 던전에 맞는 레벨대」): 내 Lv 60 · 80 · 100이어도 심연의 탑 1층 보통은 Lv 45 ± 3
    for (const [key, my] of [['abyss1', 60], ['abyss1', 100], ['cathedral1', 85]] as const) {
      const c = contentOf(key), st = runMode(save(my), c, '보통', { chal: 0 }).stage;
      for (let seed = 1; seed <= 5; seed++) for (const m of E.recruitParty(c.fights('보통')[0], seed, { abilities: true, myLv: my, stageLv: st })) expect(Math.abs(m.lv! - st), `${key} 내 Lv ${my} · ${m.nick} Lv ${m.lv}`).toBeLessThanOrEqual(3);
    }
    const dev = save(20); dev.settings.devUnlock = true;
    expect(runMode(dev, contentOf('abyss1'), '보통', { chal: 0 }).stage).toBe(45);
    expect(runMode(dev, contentOf('abyss1'), '악몽', { chal: 0 }).stage).toBe(60);
    expect(stageOf(contentOf('rustfort'), '보통')).toBe(7);
    const ex = contentOf('plateau');
    expect(runMode(save(60), ex, '악몽', { chal: 0 }).affixes).toEqual([]);
  });
  it('탐험은 튜토리얼 뒤 골드·경험치 ×0.35', () => {
    const ex = contentOf('plateau');
    const s = save(30);
    const d = settle(s, result({ diff: '보통', stage: 28 }), rng, [], T0);
    const e = settle(s, result({ content: ex.key, diff: '보통', stage: 28 }), rng, [], T0);
    expect(e.gold).toBe(Math.round(d.gold * EXPLORE_REWARD));
    expect(e.xp).toBe(restRun(clearXp(30, '보통', 'S', { win: true }) * EXPLORE_REWARD));
  });
});

describe('주간 도전 「모래시계 시련」 (13 3-2)', () => {
  it('주간 어픽스: 24주 순환 · 주마다 셋 (115), 24종이 칸마다 한 번씩, 이어지는 주에 같은 어픽스 없음, 같은 둘은 한 번만, 센 것 · 내 손 · 받는 치유는 한 주에 하나, 좋은 주 없음', () => {
    const heavy: AffixKey[] = ['tyrant', 'quake', 'frenzy', 'chaos', 'bolster', 'peril'];
    const hand: AffixKey[] = ['drain', 'chill', 'chains', 'tremor'], healCut: AffixKey[] = ['dry', 'necrotic', 'overflow'];
    const apart: AffixKey[][] = [['dry', 'haste'], ['unstable', 'haste'], ['tremor', 'chill'], ['spite', 'bolster'], ['skittish', 'panic']];
    expect(CHAL_ROTA.length).toBe(24);
    expect(WEEKLY_AFFIXES.length).toBe(24);
    expect(Object.keys(AFFIXES)).not.toContain('festival');
    expect(Object.keys(AFFIXES)).not.toContain('bounty');
    for (let p = 0; p < 3; p++) expect(new Set(CHAL_ROTA.map(w => w[p])).size, `칸 ${p}`).toBe(24);
    const pairs = new Set<string>();
    for (let i = 0; i < CHAL_ROTA.length; i++) {
      const w = CHAL_ROTA[i], nx = CHAL_ROTA[(i + 1) % CHAL_ROTA.length];
      expect(w.length).toBe(3);
      expect(new Set(w).size).toBe(3);
      expect(w.some(k => nx.includes(k)), `${i}주`).toBe(false);
      for (const k of w) expect(WEEKLY_AFFIXES).toContain(k);
      for (const g of [heavy, hand, healCut]) expect(w.filter(k => g.includes(k)).length, `${i}주 ${w}`).toBeLessThan(2);
      for (const a of apart) expect(a.every(k => w.includes(k)), `${i}주 ${a}`).toBe(false);
      for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
        const key = [w[a], w[b]].sort().join('+');
        expect(pairs.has(key), key).toBe(false);
        pairs.add(key);
      }
    }
    // 바꾸는 주 (2026-10-26 주): 예전 축제 + 폭군 → 폭군이 첫째 (1 ~ 9단계도 폭군 그대로)
    expect(weekAffixes(new Date(2026, 9, 28, 12).getTime())[0]).toBe('tyrant');
    expect(weekAffixes(T0)).toEqual(CHAL_ROTA[0]);
    expect(weekAffixes(new Date(2026, 9, 12, 5).getTime())).toEqual(CHAL_ROTA[0]);
    expect(weekAffixes(new Date(2026, 9, 12, 6).getTime())).toEqual(CHAL_ROTA[1]);
    expect(weekAffixes(new Date(2026, 9, 5 + 7 * 24, 12).getTime())).toEqual(CHAL_ROTA[0]);
    expect(nextWeekAffixes(T0)).toEqual(CHAL_ROTA[1]);
  });

  it('나안 (115): 1 ~ 9단계는 이번 주 어픽스 앞 둘, 10단계부터 셋째까지', () => {
    expect(CHAL.third).toBe(10);
    const w = CHAL_ROTA[5];
    expect(chalAffixes(w, 1)).toEqual(w.slice(0, 2));
    expect(chalAffixes(w, 9)).toEqual(w.slice(0, 2));
    expect(chalAffixes(w, 10)).toEqual(w);
    expect(chalAffixes(w, 20)).toEqual(w);
    const s = save(45), key = chalContent(s, T0);
    expect(runMode(s, contentOf(key), CHAL.diff, { chal: 9 }, T0).affixes).toEqual(CHAL_ROTA[0].slice(0, 2));
    expect(runMode(s, contentOf(key), CHAL.diff, { chal: 10 }, T0).affixes).toEqual(CHAL_ROTA[0]);
  });

  it('단계 세기: 체력 +2%/단계, 피해 = 던전 · 레벨의 깨기 반 배율 × 1.045^(단계 − 15), 제한시간은 던전 1단계 시간 기준 (110 2차)', () => {
    const lv = 60, half = chalHalf('manor', lv);
    expect(chalMult(1, 'manor', lv).hp).toBe(1);
    expect(chalMult(15, 'manor', lv).dmg).toBeCloseTo(half);
    expect(chalMult(16, 'manor', lv).dmg / chalMult(15, 'manor', lv).dmg).toBeCloseTo(CHAL.dmgRate);
    expect(chalShown(1)).toEqual({ hp: 0, dmg: 0 });
    expect(chalShown(11).hp).toBeCloseTo(0.2);
    // 깨기 반 배율은 점 (들어가는 레벨 · Lv 60 · Lv 100) 사이 로그 직선
    const p = CHAL_DUN.manor.p;
    expect(p.map(x => x[0])).toEqual([24, 60, 100]);
    expect(chalHalf('manor', 24)).toBeCloseTo(p[0][1]);
    expect(chalHalf('manor', 20)).toBeCloseTo(p[0][1]);
    expect(chalHalf('manor', 100)).toBeCloseTo(p[2][1]);
    expect(chalHalf('manor', 80)).toBeCloseTo(Math.sqrt(p[1][1] * p[2][1]));
    expect(CHAL_DUN.heartcrack.p.length).toBe(1);
    // 제한시간: 1단계 = 가운데 시간 × 1.2, 단계마다 늘어남, 5초 단위
    const t1 = CHAL_DUN.manor.t;
    expect(chalLimit(1, 'manor')).toBe(Math.round((t1 * 1.2) / 5) * 5);
    expect(chalLimit(20, 'manor')).toBeGreaterThan(chalLimit(1, 'manor'));
    expect(chalLimit(7, 'manor') % 5).toBe(0);
    const s45 = save(45), key = chalContent(s45, T0);
    const m = runMode(s45, contentOf(key), CHAL.diff, { chal: 6 }, T0);
    expect(m).toMatchObject({ stage: 45, chal: 6, limit: chalLimit(6, key), bossMult: chalMult(6, key, 45), affixes: CHAL_ROTA[0].slice(0, 2) });
    expect(runMode(save(5), contentOf('rustfort'), CHAL.diff, { chal: 1 }, T0).stage).toBe(20);
    expect(runMode(save(), contentOf('rustfort'), CHAL.diff, { chal: 99 }, T0).chal).toBe(CHAL.max);
  });

  it('주간 도전 던전: 주마다 내 레벨 이하 던전 가운데 하나, 한 주 동안 그대로, 지난주 것은 안 나옴 (110 2차)', () => {
    // 모든 던전에 표가 있음 (새 던전을 넣으면 npm run sim:chal -- --tune)
    for (const c of CONTENT.filter(x => x.kind === 'dungeon' && x.ready && !x.anchor)) expect(CHAL_DUN[c.key], c.key).toBeTruthy(); // 보충 장소 (113 4-3)는 주간 도전 후보 아님
    for (const lv of [1, 20, 45, 70, 100]) {
      const pool = chalPool(lv);
      expect(pool.length).toBeGreaterThan(1);
      for (const k of pool) expect(contentOf(k).unlockLv).toBeLessThanOrEqual(Math.max(CHAL.lv, lv));
    }
    expect(chalPool(20).length).toBeLessThan(chalPool(100).length);
    for (let i = 0; i < 30; i++) {
      const r = () => (i * 0.137) % 1, k = pickChalContent(45, r, 'manor');
      expect(k).not.toBe('manor');
      expect(contentOf(k).unlockLv).toBeLessThanOrEqual(45);
    }
    // 새 주 (rollover)에 고르고, 레벨이 올라도 그 주 동안 그대로
    const s = save(30), k = s.weekly.chal!;
    expect(chalPool(30)).toContain(k);
    s.player.level = 100;
    expect(chalContent(s, T0)).toBe(k);
    rollover(s, new Date(2026, 9, 12, 7).getTime(), rng);
    expect(s.weekly.chal).not.toBe(k);
    expect(chalPool(100)).toContain(s.weekly.chal);
    // 110 전 저장 (그 주 던전이 없음): 주 번호로 고정해 고르고 적어 둠
    const old = save(50); delete old.weekly.chal;
    const a = chalContent(old, T0);
    expect(old.weekly.chal).toBe(a);
    expect(chalPool(50)).toContain(a);
  });

  it('제한시간 안에 깨면 기록·다음 단계, 넘기면 안 열림, 지면 단계 유지', () => {
    const s = save();
    const chal = (o: Partial<BattleResult>) => settle(s, result({ chal: s.chalOpen, limit: chalLimit(s.chalOpen, 'rustfort'), stage: 30, ...o }), rng, [], T0);
    let x = chal({ time: chalLimit(1, 'rustfort') - 1 });
    expect(x.chal).toMatchObject({ stage: 1, inTime: true, opened: true, best: 1 });
    expect(s.chalOpen).toBe(2);
    x = chal({ time: chalLimit(2, 'rustfort') + 1 });
    expect(x.chal).toMatchObject({ stage: 2, inTime: false, opened: false });
    expect(s.chalOpen).toBe(2);
    x = chal({ win: false });
    expect(x.chal!.inTime).toBe(false);
    expect(s.chalOpen).toBe(2);
    expect(s.weekly.chalBest).toBe(1);
    // 주간 임무 「5단계 이상」은 제한시간 안 클리어만
    s.chalOpen = 5;
    chal({ time: chalLimit(5, 'rustfort') - 1 });
    expect(s.weekly.chalBest).toBe(5);
  });

  it('최고 단계는 월요일에 상자로, 열린 단계는 그대로', () => {
    const s = save();
    settle(s, result({ chal: 1, limit: chalLimit(1, 'rustfort'), time: chalLimit(1, 'rustfort') - 1 }), rng, [], T0);
    rollover(s, new Date(2026, 9, 12, 7).getTime(), rng);
    expect(s.chalChest).toBe(1);
    expect(s.weekly.chalBest).toBe(0);
    expect(s.chalOpen).toBe(2);
  });
});

