/** 102 레벨별 능력치 균형 · 광폭화 배율 · 빗나감 대사 (2026-10-19 Lim) */
import { describe, expect, it } from 'vitest';
import type { ClassKey } from '../src/data/classes';
import { ENCOUNTERS, ENRAGE_MULT } from '../src/data/encounters';
import { lvStat, LV_STAT, statsAt, STAT_KEYS, type Stats } from '../src/data/fm';
import type { PersName } from '../src/data/personalities';
import { STAT_ACT } from '../src/data/rules';
import * as E from '../src/engine';
import type { RosterEntry } from '../src/engine/types';

const flat = (v: number, more: Partial<Stats> = {}): Stats => ({ ...(Object.fromEntries(STAT_KEYS.map(k => [k, v])) as Stats), ...more });
const R = (role: RosterEntry['role'], cls: ClassKey, nick: string, st: Partial<Stats> = {}, lv?: number): RosterEntry =>
  ({ role, cls, pers: '사교형' as PersName, nick, ab: role === 'tank' ? `${cls}.taunt` : role === 'melee' ? 'rogue.kick' : 'mage.blink', fm: { stats: flat(10, st), off: 0, steady: 15 }, ...(lv ? { lv, pub: true } : {}) });

describe('레벨 몫 (Lim 「레벨에 따른 능력치 벨런스」)', () => {
  it('Lv 1 +0 · 50 +2.5 · 100 +5, 100 넘어도 +5', () => {
    expect(lvStat(1)).toBe(0);
    expect(lvStat(50)).toBeCloseTo((LV_STAT * 49) / 99, 9);
    expect(lvStat(100)).toBe(LV_STAT);
    expect(lvStat(130)).toBe(LV_STAT);
    expect(lvStat(undefined)).toBe(0);
  });
  it('전투: 공개모집 파티원의 능력치 = 타고난 값 + 그날 흔들림 + 레벨 몫 (Lv 100 평균 10 → 15)', () => {
    const party = [R('tank', 'warrior', '탱', {}, 100), R('melee', 'rogue', '근', {}, 1), R('ranged', 'mage', '마', {}, 50), R('ranged', 'archer', '궁')];
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, stageLv: 100, heroLv: 100, party });
    const by = (n: string) => f.party.find(u => u.nick === n)!;
    expect(by('탱').fmStats!.react).toBeCloseTo(15, 9);
    expect(by('근').fmStats!.react).toBeCloseTo(10, 9);
    expect(by('마').fmStats!.react).toBeCloseTo(10 + lvStat(50), 9);
    expect(by('궁').fmStats!.react).toBeCloseTo(10, 9); // 레벨이 없는 사람 (옛 파티 · 시험)은 그대로
    expect(by('탱').fm!.react).toBeCloseTo(by('근').fm!.react, 9); // 102 B안: 예전 효과 (fmFx 딜 · 체력 · 반응 …)에는 레벨 몫을 안 넣음
    expect(by('탱').fm!.dps).toBeCloseTo(by('근').fm!.dps, 9);
  });
  it('화면 숫자는 저장 값 + 레벨 몫 (반올림 · 20까지)', () => {
    const st = flat(10, { atk: 18 });
    expect(statsAt(st, 100).react).toBe(15);
    expect(statsAt(st, 100).atk).toBe(20);
    expect(statsAt(st, 1)).toEqual(st);
  });
});

describe('광폭화 배율 (Lim 「광폭화 시간을 전체적으로 늘려주고」)', () => {
  it('모든 전투의 광폭화 × 1.25 (5초 반올림): 녹슨 문지기 270 → 340 · 역병 군주 390 → 490', () => {
    expect(ENRAGE_MULT).toBe(1.25);
    expect(ENCOUNTERS.warden.enrage).toBe(340);
    expect(ENCOUNTERS.plague.enrage).toBe(490);
    for (const e of Object.values(ENCOUNTERS)) if (Number.isFinite(e.enrage)) expect(e.enrage % 5, e.key).toBe(0);
  });
});

describe('빗나감 대사 (Lim 「빗나갈때의 대사가 너무 자주나온다」)', () => {
  it('같은 사람은 30초에 한 번까지, 빗나감 글 (사건)은 그대로', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 3, stageLv: 30, heroLv: 30, party: [R('tank', 'warrior', '탱'), R('melee', 'rogue', '근', { skill: 1 }), R('ranged', 'mage', '마', { skill: 1 }), R('ranged', 'archer', '궁', { skill: 1 })] });
    f.skills.forEach(s => { s.next = Infinity; });
    f.bossHp = f.bossMax = 1e9;
    const said = new Map<number, number[]>();
    let miss = 0;
    while (f.t < 300) {
      E.step(f);
      for (const ev of f.events) { if (ev.type === 'miss') miss++; if (ev.type === 'bark' && ev.sit === 'whiff') said.set(ev.id, [...(said.get(ev.id) ?? []), f.t]); }
      f.events.length = 0;
    }
    expect(miss).toBeGreaterThan(40);
    const all = [...said.values()].flat();
    expect(all.length).toBeLessThan(miss * STAT_ACT.whiffTalk * 2);
    for (const ts of said.values()) for (let i = 1; i < ts.length; i++) expect(ts[i] - ts[i - 1]).toBeGreaterThanOrEqual(STAT_ACT.whiffGap - 1e-6);
  });
});
