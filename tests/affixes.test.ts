/** 어픽스 (32 난이도 어픽스, 13 3-3 주간 도전)·적 레벨 = 내 레벨 (32)·주간 도전 「모래시계 시련」 (13 3-2)·광고 이어하기 (15) */
import { describe, expect, it } from 'vitest';
import { diffAffixes, WEEKLY_AFFIXES } from '../src/data/affixes';
import { CHAL, CHAL_ROTA, chalLimit, chalMult } from '../src/data/challenge';
import { contentOf, stageOf } from '../src/data/content';
import { clearGold, clearXp, EXPLORE_REWARD } from '../src/data/progression';
import * as E from '../src/engine';
import { affDebuffEnd, affixTick, affHeal } from '../src/engine/affixes';
import { heal } from '../src/engine/core';
import { rollover } from '../src/game/economy';
import { runMode, weekAffixes } from '../src/game/runmode';
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
  it('적 레벨로 골드·경험치를 셈', () => {
    const s = save(52), m = runMode(s, contentOf('rustfort'), '어려움', { chal: 0 });
    s.daily.pub = 3; // 공개모집 보너스(×2)는 뺌
    expect(m).toMatchObject({ stage: 52, affixes: ['rage'], chal: 0 });
    const x = settle(s, result({ diff: '어려움', stage: m.stage, affixes: m.affixes }), rng, [], T0);
    expect(x.gold).toBe(clearGold(52, '어려움', 'S'));
    expect(x.xp).toBe(clearXp(52, '어려움', 'S', { win: true }));
  });
  it('어느 레벨이든 적 = 내 레벨 (단계 톱니 없음, 세기 × 0.95는 엔진, 34 1-2), 열림 레벨 아래로는 안 내려감', () => {
    const rf = contentOf('rustfort');
    for (const lv of [5, 9, 10, 29, 30, 49, 50, 100]) expect(runMode(save(lv), rf, '보통', { chal: 0 })).toMatchObject({ stage: lv, affixes: [] });
    // 열림 레벨 (녹슨 요새 Lv 5, 34 5-2) 아래로는 안 내려감
    for (const lv of [1, 2, 3]) expect(runMode(save(lv), rf, '보통', { chal: 0 }).stage).toBe(5);
    // 튜토리얼 전은 콘텐츠 기본 레벨 · 어픽스 없음
    const tut = save(40); tut.tut = 1;
    expect(runMode(tut, rf, '악몽', { chal: 0 })).toMatchObject({ stage: 5, affixes: [] });
  });
  it('레이드·탐험은 어픽스 없음. 열림 레벨 전에 들어가면 (개발 빌드) 열림 레벨', () => {
    expect(runMode(save(90), contentOf('abyss1'), '보통', { chal: 0 }).stage).toBe(90);
    expect(runMode(save(60), contentOf('abyss1'), '악몽', { chal: 0 })).toMatchObject({ stage: 60, affixes: [] });
    const dev = save(20); dev.settings.devUnlock = true;
    expect(runMode(dev, contentOf('abyss1'), '보통', { chal: 0 }).stage).toBe(35);
    expect(runMode(dev, contentOf('abyss1'), '악몽', { chal: 0 }).stage).toBe(50);
    expect(stageOf(contentOf('rustfort'), '보통')).toBe(5);
    const ex = contentOf('plateau');
    expect(runMode(save(60), ex, '악몽', { chal: 0 }).affixes).toEqual([]);
  });
  it('탐험은 튜토리얼 뒤 골드·경험치 ×0.35', () => {
    const ex = contentOf('plateau');
    const s = save(30); s.daily.pub = 3;
    const d = settle(s, result({ diff: '보통', stage: 28 }), rng, [], T0);
    const e = settle(s, result({ content: ex.key, diff: '보통', stage: 28 }), rng, [], T0);
    expect(e.gold).toBe(Math.round(d.gold * EXPLORE_REWARD));
    expect(e.xp).toBe(Math.round(clearXp(30, '보통', 'S', { win: true }) * EXPLORE_REWARD));
  });
});

describe('주간 도전 「모래시계 시련」 (13 3-2)', () => {
  it('주간 어픽스: 8주 순환, 같은 조합이 이어서 안 나오고 4주마다 축제, 메마름+서두름·불안정+서두름은 같이 안 나옴', () => {
    for (let i = 0; i < CHAL_ROTA.length; i++) {
      expect(CHAL_ROTA[i].join()).not.toBe(CHAL_ROTA[(i + 1) % CHAL_ROTA.length].join());
      expect(CHAL_ROTA[i].includes('festival')).toBe(i % 4 === 3);
      expect(CHAL_ROTA[i].includes('dry') && CHAL_ROTA[i].includes('haste')).toBe(false);
      expect(CHAL_ROTA[i].includes('unstable') && CHAL_ROTA[i].includes('haste')).toBe(false);
      for (const k of CHAL_ROTA[i]) expect(k === 'festival' || WEEKLY_AFFIXES.includes(k)).toBe(true);
    }
    expect(weekAffixes(T0)).toEqual(CHAL_ROTA[0]);
    expect(weekAffixes(new Date(2026, 9, 12, 5).getTime())).toEqual(CHAL_ROTA[0]);
    expect(weekAffixes(new Date(2026, 9, 12, 6).getTime())).toEqual(CHAL_ROTA[1]);
    expect(weekAffixes(new Date(2026, 9, 5 + 7 * 8, 12).getTime())).toEqual(CHAL_ROTA[0]);
  });

  it('단계마다 보스 체력 +2% · 피해 +4%, 제한시간 7분 + 단계마다 8초, 단계 레벨 = 내 레벨 (최소 20)', () => {
    expect(chalMult(1)).toEqual({ hp: 1, dmg: 1 });
    expect(chalMult(11).dmg).toBeCloseTo(1.4);
    expect(chalLimit(1)).toBe(420);
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

  it('축제 주간 골드 +20%', () => {
    const s = save();
    const a = settle(s, result({ stage: 30 }), rng, [], T0).gold;
    const b = settle(s, result({ stage: 30, affixes: ['festival', 'frenzy'] }), rng, [], T0).gold;
    expect(b).toBe(Math.round(a * 1.2));
  });
});

describe('광고 이어하기 (15 7장)', () => {
  it('이어 한 판은 등급 최대 B', () => {
    const s = save();
    expect(settle(s, result({ deaths: 0 }), rng, [], T0).grade).toBe('S');
    const x = settle(s, result({ deaths: 0, cont: 1 }), rng, [], T0);
    expect(x.grade).toBe('B');
    expect(x.cont).toBe(1);
    expect(settle(s, result({ deaths: 5, cont: 1 }), rng, [], T0).grade).toBe('C');
  });
});
