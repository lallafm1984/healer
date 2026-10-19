/** 102 레벨별 능력치 균형 · 광폭화 배율 · 빗나감 대사 (2026-10-19 Lim) */
import { describe, expect, it } from 'vitest';
import type { ClassKey } from '../src/data/classes';
import { ENCOUNTERS, ENRAGE_MULT } from '../src/data/encounters';
import { GROW_TYPES, growthOf, lvAdds, lvStat, LV_STAT, statsAt, STAT_KEYS, type Stats } from '../src/data/fm';
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
  const sum = (st: Stats) => STAT_KEYS.reduce((a, k) => a + st[k], 0);
  it('전투: 공개모집 파티원의 능력치 = 타고난 값 + 그날 흔들림 + 레벨 몫 (Lv 100은 12칸 합 +60 = 평균 10 → 15, 칸마다 다르게)', () => {
    const party = [R('tank', 'warrior', '탱', {}, 100), R('melee', 'rogue', '근', {}, 1), R('ranged', 'mage', '마', {}, 50), R('ranged', 'archer', '궁')];
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, stageLv: 100, heroLv: 100, party });
    const by = (n: string) => f.party.find(u => u.nick === n)!;
    expect(sum(by('탱').fmStats!)).toBeCloseTo(120 + 12 * LV_STAT, 6);
    expect(sum(by('근').fmStats!)).toBeCloseTo(120, 9);
    expect(sum(by('궁').fmStats!)).toBeCloseTo(120, 9); // 레벨이 없는 사람 (옛 파티 · 시험)은 그대로
    const tk = by('탱').fmStats!, vals = STAT_KEYS.map(k => tk[k]);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(3); // 칸마다 다름 (모두 +5가 아님)
    expect(by('탱').fm!.hp).toBeGreaterThan(by('근').fm!.hp); // 예전 효과 (fmFx)도 같은 값: 탱커 핵심 맷집이 오름
  });
  it('화면 숫자는 저장 값 + 레벨 몫 (반올림 · 20까지), 레벨이 없으면 그대로', () => {
    const st = flat(10, { atk: 18 }), who = { nick: '칼날검객', pers: '사교형' as PersName, role: 'melee' as const, lv: 100 };
    const at = statsAt(st, who);
    expect(Math.abs(sum(at) - (sum(st) + 12 * LV_STAT))).toBeLessThanOrEqual(6); // 반올림
    expect(STAT_KEYS.every(k => at[k] <= 20 && at[k] >= st[k])).toBe(true);
    expect(statsAt(st, { ...who, lv: 1 })).toEqual(st);
    expect(statsAt(st)).toEqual(st);
  });
});

describe('성장 결 (Lim 「고렙 파티원 … 좀더 개성있게」 → 「결 + 크는 모양」)', () => {
  const NICKS = Array.from({ length: 400 }, (_, i) => `시험${String.fromCharCode(0xac00 + i * 37)}`);
  it('크는 모양 넷이 정해진 몫대로 (특화 · 균형 30% · 대기만성 · 조숙 20%), 같은 닉네임은 늘 같음', () => {
    const n: Record<string, number> = {};
    for (const x of NICKS) n[growthOf(x, 'melee').type] = (n[growthOf(x, 'melee').type] ?? 0) + 1;
    for (const g of GROW_TYPES) expect(Math.abs(n[g.type] / NICKS.length - g.share)).toBeLessThan(0.08);
    expect(growthOf('칼날검객', 'melee')).toEqual(growthOf('칼날검객', 'melee'));
  });
  it('약점 칸은 안 오르고, 재능 칸 · 역할 핵심이 더 오름, 20을 넘지 않음', () => {
    let talent = 0, other = 0, tn = 0, on = 0;
    for (const x of NICKS) {
      const g = growthOf(x, 'tank'), add = lvAdds(x, '사교형', 'tank', 100, flat(10));
      for (const k of g.weak) expect(add[k]).toBe(0);
      for (const k of STAT_KEYS) { expect(10 + add[k]).toBeLessThanOrEqual(20 + 1e-9); if (g.talents.includes(k)) { talent += add[k]; tn++; } else if (!g.weak.includes(k)) { other += add[k]; on++; } }
      expect(STAT_KEYS.reduce((a, k) => a + add[k], 0)).toBeCloseTo(12 * LV_STAT, 6);
    }
    expect(talent / tn).toBeGreaterThan((other / on) * 1.5);
  });
  it('균형형은 고르게, 특화형은 몰려서 (가장 높은 칸 − 가장 낮은 칸)', () => {
    const spread = (type: string) => { const xs = NICKS.filter(x => growthOf(x, 'ranged').type === type).map(x => { const a = lvAdds(x, '감사형', 'ranged', 100, flat(10)), v = STAT_KEYS.map(k => a[k]); return Math.max(...v) - Math.min(...v); }); return xs.reduce((a, b) => a + b, 0) / xs.length; };
    expect(spread('특화형')).toBeGreaterThan(spread('균형형') * 1.8);
  });
  it('대기만성은 Lv 50에 덜 · Lv 100에 같게, 조숙형은 Lv 50에 더', () => {
    const at = (type: string, lv: number) => { const x = NICKS.find(n => growthOf(n, 'melee').type === type)!; const a = lvAdds(x, '사교형', 'melee', lv, flat(10)); return STAT_KEYS.reduce((s, k) => s + a[k], 0); };
    expect(at('대기만성', 50)).toBeLessThan(at('균형형', 50) - 5);
    expect(at('조숙형', 50)).toBeGreaterThan(at('균형형', 50) + 5);
    expect(at('대기만성', 100)).toBeCloseTo(at('조숙형', 100), 6);
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
