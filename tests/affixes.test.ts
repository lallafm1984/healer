/** 어픽스 (32 난이도 어픽스, 13 3-3 주간 도전)·적 레벨 = 내 레벨 (32)·주간 도전 「모래시계 시련」 (13 3-2)·광고 이어하기 (15) */
import { describe, expect, it } from 'vitest';
import { diffAffixes, GOOD_AFFIXES, WEEKLY_AFFIXES } from '../src/data/affixes';
import { CHAL, CHAL_ROTA, chalLimit, chalMult, chalReward } from '../src/data/challenge';
import { ALL_DIFFS, contentOf, stageOf } from '../src/data/content';
import { clearGold, clearXp, EXPLORE_REWARD, restRun } from '../src/data/progression';
import * as E from '../src/engine';
import { affCast, affDebuffEnd, affixTick, affHeal, affMobDown, affNecrotic, affRegen, AFX } from '../src/engine/affixes';
import { castOf } from '../src/engine/talents';
import { heal } from '../src/engine/core';
import { rollover } from '../src/game/economy';
import { nextWeekAffixes, runMode, weekAffixes } from '../src/game/runmode';
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
    const f = mk(['spite'], 'gate');
    affMobDown(f, false);
    const live = f.party.filter(u => u.alive);
    for (const u of live) {
      const d = u.debuffs.find(x => x.name === '복수심')!;
      expect(d.left).toBe(AFX.spite.sec); expect(d.lock).toBe(true); expect(d.stack).toBe(1); expect(d.dot).toBeGreaterThan(0);
    }
    const u = live[0], d = u.debuffs.find(x => x.name === '복수심')!;
    d.left = 1; affMobDown(f, false); affMobDown(f, true);
    expect(d.stack).toBe(2); expect(d.left).toBe(AFX.spite.sec);
    expect(u.debuffs.filter(x => x.name === '복수심').length).toBe(1);
  });

  it('주간 도전 단계 보너스: 골드 · 경험치 × (1 + 3% × (단계 − 1)), 풍요 주간 골드 +30%', () => {
    expect(chalReward(1)).toBe(1);
    expect(chalReward(11)).toBeCloseTo(1.3);
    expect(chalReward(20)).toBeCloseTo(1.57);
    const s1 = save(), s2 = save(), s3 = save();
    const one = settle(s1, result({ stage: 30, chal: 1, limit: chalLimit(1), time: 300 }), rng, [], T0);
    const ten = settle(s2, result({ stage: 30, chal: 11, limit: chalLimit(11), time: 300 }), rng, [], T0);
    expect(ten.gold).toBe(restRun(clearGold(30, '보통', 'S') * chalReward(11)));
    expect(ten.xp).toBe(restRun(clearXp(30, '보통', 'S', { win: true }) * chalReward(11)));
    expect(ten.gold).toBeGreaterThan(one.gold);
    const b = settle(s3, result({ stage: 30, chal: 1, limit: chalLimit(1), time: 300, affixes: ['bounty', 'haste'] }), rng, [], T0);
    expect(b.gold).toBe(restRun(clearGold(30, '보통', 'S') * CHAL.bountyGold));
    expect(b.xp).toBe(one.xp);
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
  it('주간 어픽스: 16주 순환 (110), 같은 조합이 이어서 안 나오고 4주마다 좋은 주 (축제 · 풍요 번갈아), 16종 모두 나옴, 센 것끼리 · 메마름+서두름 · 불안정+서두름은 같이 안 나옴', () => {
    const heavy = ['tyrant', 'quake', 'frenzy', 'chaos'];
    for (let i = 0; i < CHAL_ROTA.length; i++) {
      expect(CHAL_ROTA[i].join()).not.toBe(CHAL_ROTA[(i + 1) % CHAL_ROTA.length].join());
      expect(CHAL_ROTA[i].some(k => GOOD_AFFIXES.includes(k))).toBe(i % 4 === 3);
      if (i % 4 === 3) expect(CHAL_ROTA[i][0]).toBe(i % 8 === 3 ? 'festival' : 'bounty');
      expect(CHAL_ROTA[i].includes('dry') && CHAL_ROTA[i].includes('haste')).toBe(false);
      expect(CHAL_ROTA[i].includes('unstable') && CHAL_ROTA[i].includes('haste')).toBe(false);
      expect(CHAL_ROTA[i].filter(k => heavy.includes(k)).length).toBeLessThan(2);
      for (const k of CHAL_ROTA[i]) expect(GOOD_AFFIXES.includes(k) || WEEKLY_AFFIXES.includes(k)).toBe(true);
    }
    for (const k of WEEKLY_AFFIXES) expect(CHAL_ROTA.some(w => w.includes(k)), k).toBe(true);
    // 바꾸는 주 (2026-10-19 주)는 예전 순서 그대로 (주 중간에 안 바뀜)
    expect(weekAffixes(new Date(2026, 9, 22, 12).getTime())).toEqual(['chaos', 'panic']);
    expect(weekAffixes(T0)).toEqual(CHAL_ROTA[0]);
    expect(weekAffixes(new Date(2026, 9, 12, 5).getTime())).toEqual(CHAL_ROTA[0]);
    expect(weekAffixes(new Date(2026, 9, 12, 6).getTime())).toEqual(CHAL_ROTA[1]);
    expect(weekAffixes(new Date(2026, 9, 5 + 7 * 16, 12).getTime())).toEqual(CHAL_ROTA[0]);
    expect(nextWeekAffixes(T0)).toEqual(CHAL_ROTA[1]);
  });

  it('단계마다 보스 체력 +2% · 피해 +10%, 제한시간 8분 + 단계마다 10초 (110), 단계 레벨 = 내 레벨 (최소 20)', () => {
    expect(chalMult(1)).toEqual({ hp: 1, dmg: 1 });
    expect(chalMult(11).dmg).toBeCloseTo(2);
    expect(chalLimit(1)).toBe(480);
    expect(chalLimit(20)).toBe(670);
    const m = runMode(save(45), contentOf(CHAL.content), CHAL.diff, { chal: 6 }, T0);
    expect(m).toMatchObject({ stage: 45, chal: 6, limit: chalLimit(6), affixes: CHAL_ROTA[0] });
    expect(runMode(save(5), contentOf(CHAL.content), CHAL.diff, { chal: 1 }, T0).stage).toBe(20);
    expect(runMode(save(), contentOf(CHAL.content), CHAL.diff, { chal: 99 }, T0).chal).toBe(CHAL.max);
  });

  it('제한시간 안에 깨면 기록·다음 단계, 넘기면 안 열림, 지면 단계 유지', () => {
    const s = save();
    const chal = (o: Partial<BattleResult>) => settle(s, result({ chal: s.chalOpen, limit: chalLimit(s.chalOpen), stage: 30, ...o }), rng, [], T0);
    let x = chal({ time: 400 });
    expect(x.chal).toMatchObject({ stage: 1, inTime: true, opened: true, best: 1 });
    expect(s.chalOpen).toBe(2);
    x = chal({ time: chalLimit(2) + 1 });
    expect(x.chal).toMatchObject({ stage: 2, inTime: false, opened: false });
    expect(s.chalOpen).toBe(2);
    x = chal({ win: false });
    expect(x.chal!.inTime).toBe(false);
    expect(s.chalOpen).toBe(2);
    expect(s.weekly.chalBest).toBe(1);
    // 주간 임무 「5단계 이상」은 제한시간 안 클리어만
    s.chalOpen = 5;
    chal({ time: 400 });
    expect(s.weekly.chalBest).toBe(5);
  });

  it('최고 단계는 월요일에 상자로, 열린 단계는 그대로', () => {
    const s = save();
    settle(s, result({ chal: 1, limit: chalLimit(1), time: 300 }), rng, [], T0);
    rollover(s, new Date(2026, 9, 12, 7).getTime(), rng);
    expect(s.chalChest).toBe(1);
    expect(s.weekly.chalBest).toBe(0);
    expect(s.chalOpen).toBe(2);
  });

  it('축제 주간 경험치 +20% (v16, 예전 골드 +20%. 91에서 골드를 되살려도 경험치 그대로)', () => {
    const a = settle(save(), result({ stage: 30 }), rng, [], T0);
    const b = settle(save(), result({ stage: 30, affixes: ['festival', 'frenzy'] }), rng, [], T0);
    expect(b.xp).toBe(restRun(clearXp(30, '보통', 'S', { win: true }) * 1.2));
    expect(a.xp).toBe(restRun(clearXp(30, '보통', 'S', { win: true })));
    expect(b.gold).toBe(a.gold);
  });
});

