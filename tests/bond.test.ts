/** 인연 기록 (93 3-2, 사슬 3번): 점수 규칙 · 역할 차이 보정 · 판 기록 · 저장 v18 */
import { describe, expect, it } from 'vitest';
import { BOND, bondPoints, isRescue, type BondUnit } from '../src/data/bond';
import * as E from '../src/engine';
import { damage, heal } from '../src/engine/core';
import { recordBond } from '../src/game/bond';
import type { BattleResult } from '../src/game/settle';
import { settle } from '../src/game/settle';
import { TUT } from '../src/game/tutorial';
import { migrate, newSave, SAVE_VERSION } from '../src/platform/storage';

const U = (nick: string, role: BondUnit['role'], got: number, o: Partial<BondUnit> = {}): BondUnit => ({ nick, role, got, alive: true, low: 0.9, rescued: false, ...o });

describe('점수 규칙', () => {
  it('함께 이김 +1, S 등급 +1, 한 사람 최대 5', () => {
    const p = [U('탱', 'tank', 700), U('근', 'melee', 100), U('마', 'ranged', 100), U('궁', 'ranged', 100)];
    expect([...bondPoints(p, 5, false).pts.values()].every(v => v >= BOND.win)).toBe(true);
    const s = bondPoints(p, 5, true).pts;
    expect(s.get('근')).toBe(BOND.win + BOND.s);
    const all = bondPoints([U('a', 'tank', 1000, { low: 0.01, rescued: true })], 3, true).pts.get('a');
    expect(all).toBe(BOND.max);
  });

  it('유난히 크게 도움: 그 역할 · 판 크기 상위 10% 선을 넘은 사람 모두 (탱커는 몫이 커도 선도 높음)', () => {
    // 5인: 탱커 몫 70% (평소) · 근접 몫 20% (평소의 상위 10% 넘음)
    const p = [U('탱', 'tank', 700), U('근', 'melee', 200), U('마', 'ranged', 50), U('궁', 'ranged', 50)];
    const r = bondPoints(p, 5, false);
    expect(r.helped).toEqual(['근']);
    expect(r.pts.get('근')).toBe(BOND.win + BOND.helped);
    expect(r.pts.get('탱')).toBe(BOND.win);
    // 탱커가 거의 다 받으면 탱커도
    expect(bondPoints([U('탱', 'tank', 950), U('근', 'melee', 20), U('마', 'ranged', 15), U('궁', 'ranged', 15)], 5, false).helped).toEqual(['탱']);
  });

  it('생명의 은인: 역할 위험선 아래에서 내 힐을 받고 끝까지 삶, 위험했던 순서로 2명까지 +2', () => {
    expect(isRescue({ role: 'tank', low: 0.08, rescued: true, alive: true })).toBe(false); // 탱커 선은 낮음
    expect(isRescue({ role: 'tank', low: 0.05, rescued: true, alive: true })).toBe(true);
    expect(isRescue({ role: 'melee', low: 0.15, rescued: true, alive: true })).toBe(true);
    expect(isRescue({ role: 'ranged', low: 0.05, rescued: true, alive: false })).toBe(false);
    expect(isRescue({ role: 'ranged', low: 0.05, rescued: false, alive: true })).toBe(false);
    const p = [U('a', 'melee', 1, { low: 0.1, rescued: true }), U('b', 'melee', 1, { low: 0.05, rescued: true }), U('c', 'ranged', 1, { low: 0.02, rescued: true })];
    expect(bondPoints(p, 5, false).saved).toEqual(['c', 'b']);
  });
});

describe('엔진: 가장 낮았던 체력 · 그때까지 받은 치유', () => {
  it('맞으면 가장 낮은 비율과 그 순간의 받은 치유를 적음', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, party: E.recruitParty('warden', 1, { abilities: true }) });
    const u = f.party.find(x => x.role === 'melee')!;
    heal(f, u, 10, true);
    damage(f, u, u.max * 0.3, false, 'fixed');
    const low = u.low!;
    expect(low).toBeLessThan(1);
    expect(u.gotLow).toBe(u.got);
    heal(f, u, 50, true);
    expect(u.got).toBeGreaterThan(u.gotLow!);
    expect(u.low).toBe(low);
  });
});

const result = (o: Partial<BattleResult> = {}): BattleResult => ({
  content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 0, segN: 1, time: 100, restSec: 0, deaths: 0, healed: 1000, overheal: 100,
  dispels: 0, dispellable: 0, endMana: 50, minMana: 30, auto: false, detail: [],
  party: [
    { nick: '방패든양', pers: '신중파', role: 'tank', alive: true, got: 700, low: 0.5 },
    { nick: '칼날', pers: '사교형', role: 'melee', alive: true, got: 250, low: 0.04, rescued: true },
    { nick: '불꽃', pers: '사교형', role: 'ranged', alive: true, got: 30, low: 0.9 },
    { nick: '화살', pers: '사교형', role: 'ranged', alive: false, got: 20, low: 0 },
  ],
  meter: [{ nick: '불꽃', role: 'ranged', cls: 'mage', dmg: 900 }, { nick: '칼날', role: 'melee', cls: 'rogue', dmg: 500 }],
  ...o,
}) as BattleResult;

describe('판 기록', () => {
  it('이긴 판: 만남 · 함께 이김 · 점수 · 살려 준 횟수 · 딜 1등', () => {
    const s = newSave(1); s.tut = TUT.done;
    const g = recordBond(s, result(), false);
    expect(s.users['칼날']).toMatchObject({ met: 1, wins: 1, saved: 1 });
    expect(s.users['칼날'].pt).toBe(BOND.win + BOND.helped + BOND.saved);
    expect(s.users['불꽃']).toMatchObject({ pt: BOND.win, mvp: 1 });
    expect(s.users['화살'].pt).toBe(BOND.win); // 쓰러졌어도 함께 이김
    expect(g.find(x => x.nick === '칼날')).toMatchObject({ helped: true, saved: true });
  });

  it('진 판 · 포기한 판은 만남만 (점수 그대로)', () => {
    const s = newSave(1); s.tut = TUT.done;
    recordBond(s, result({ win: false }), false);
    recordBond(s, result({ quit: true }), false);
    expect(s.users['칼날']).toMatchObject({ met: 2, wins: 0, pt: 0 });
  });

  it('정산: 튜토리얼 판은 안 셈, 끝난 뒤는 셈 (S 등급이면 +1)', () => {
    const t = newSave(1);
    settle(t, result(), () => 0.5, [], 1);
    expect(t.users).toEqual({});
    const s = newSave(1); s.tut = TUT.done;
    const st = settle(s, result(), () => 0.5, [], 1);
    expect(st.bond.length).toBe(4);
    expect(s.users['불꽃'].pt).toBe(BOND.win + (st.grade === 'S' ? BOND.s : 0));
  });
});

describe('저장 v18', () => {
  it('옛 저장은 빈 명부, 이상한 칸은 0 · 꼴이 아닌 사람은 버림', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(18);
    const old = { ...newSave(1), v: 17 } as Record<string, unknown>;
    delete old.users;
    const m = migrate(old);
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.users).toEqual({});
    const odd = migrate({ ...newSave(1), users: { 칼날: { pt: 5, met: '3', wins: -1, saved: 2.7 }, 이상: 7 } });
    expect(odd.users).toEqual({ 칼날: { pt: 5, met: 0, wins: 0, saved: 2, mvp: 0 } });
  });
});
