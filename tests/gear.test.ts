/** 장비 판매 · 드롭 · 옵션 (02 10장, 12 3장, 91 디아2식: 강화 없음 · 아이템 레벨 배율 · 넓은 굴림) */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  avgScore, equippedStats, gearStatsOf, ilvBonus, ilvMult, ilvP, ILV_P, pctLvMult, itemName, itemScore, itemStats, kindsOf, makeItem, OPT_ROLL, OPTION_LINES, optionsOf, RANDOM_BASE, randomLines, rollItem, rollOpt, SELL_GOLD, sellGold, SLOTS, STAT_KEYS, statsToGear, takenStats, STAT_POINT, isPointStat, toPoints, LINE_MULT, type GearItem,
} from '../src/data/equipment';
import { HEALER_HP } from '../src/game/charinfo';
import { INT_BASE, RULES } from '../src/data/rules';
import { apexOf, clearGold, EXPLORE_REWARD, lvPower, RAID_GOLD } from '../src/data/progression';
/** 레벨 세기 = 레벨 배율 × 정점 수련 (힐러 지능 · 체력과 같은 눈금) */
const str = (l: number) => lvPower(l) * apexOf(l);
import { gearStats } from '../src/data/gear';
import * as E from '../src/engine';
import { damage } from '../src/engine/core';
import { rngFrom } from '../src/engine/rng';
import { settle, type BattleResult } from '../src/game/settle';
import { G, sell } from '../src/game/state';
import { migrate, newSave } from '../src/platform/storage';
import { TUT } from '../src/game/tutorial';

const item = (o: Partial<GearItem> = {}): GearItem => ({ id: 1, slot: 'head', kind: '', grade: '희귀', name: '', lines: [], ...o });

describe('강화 없음 → 아이템 레벨 배율 (91, 예전 강화 몫)', () => {
  it('P = 예전 그 레벨 평균 강화를 매끈하게 한 값, 사이는 직선. 배율 = 1 + 0.08 × P', () => {
    expect(ILV_P).toEqual([[1, 0], [10, 1.8], [20, 2.3], [40, 5.0], [60, 5.2], [70, 5.8], [85, 6.7], [99, 6.8], [100, 8.5]]);
    expect([1, 10, 20, 40, 60, 70, 85, 99, 100, 130].map(l => Math.round(ilvBonus(l) * 100) / 100)).toEqual([1, 1.14, 1.18, 1.4, 1.42, 1.46, 1.54, 1.54, 1.68, 1.68]);
    expect(ilvP(15)).toBeCloseTo(2.05);
    expect(ilvP(30)).toBeCloseTo(3.65);
    expect(ilvBonus(undefined)).toBe(1);
    for (let l = 2; l <= 100; l++) expect(ilvP(l)).toBeGreaterThanOrEqual(ilvP(l - 1));
  });
  it('주 · 종류 · 무작위 옵션 모두 같은 배율, 특수능력은 그대로. 장비에 강화 단계 없음', () => {
    const it = makeItem(rngFrom(4), 'weapon', '영웅', 1, 'staff', { lv: 40 });
    expect(it).not.toHaveProperty('plus');
    const a = optionsOf(it, 40), b = optionsOf({ ...it, lv: undefined }, 40);
    // 아이템 레벨이 없으면 배율 1 (% 옵션 레벨 배율 · 지능 수치 배율도 1) → 같은 굴림의 Lv 40 장비는 % 옵션만 pctLvMult가 더 붙음
    for (let i = 0; i < a.length; i++) expect(a[i].v).toBeCloseTo(b[i].v * 1.4 * (isPointStat(a[i].stat) ? 1 : pctLvMult(40)));
  });
});

describe('판매 (91, 예전 분해 자리)', () => {
  beforeEach(() => { G.save = newSave(1); G.save.tut = TUT.done; });
  it('골드 = 등급 값 (#172 전 분해 골드 5 · 15 · 40 · 100 · 250) × (1 + 아이템 레벨 ÷ 10)', () => {
    expect(SELL_GOLD).toEqual({ '일반': 5, '고급': 15, '희귀': 40, '영웅': 100, '전설': 250 });
    expect(sellGold(item({ grade: '일반', lv: 1 }))).toBe(6);
    expect(sellGold(item({ grade: '희귀', lv: 40 }))).toBe(200);
    expect(sellGold(item({ grade: '전설', lv: 100 }))).toBe(2750);
  });
  it('가방 장비만 (착용 · 잠금 빼고), 여러 개 한 번에, 일일 임무 「장비 판매」 한 개마다', () => {
    G.save.gear.bag = [item({ id: 1, grade: '일반', lv: 10 }), item({ id: 2, grade: '고급', lv: 10 }), item({ id: 3, lock: true })];
    G.save.gear.equipped.head = item({ id: 9 });
    G.save.daily.missions = [{ key: 'sell2', n: 0, got: false }];
    const r = sell([1, 2, 3, 9]);
    expect(r).toEqual({ n: 2, gold: 10 + 30 });
    expect(G.save.gear.bag.map(x => x.id)).toEqual([3]);
    expect(G.save.gear.equipped.head?.id).toBe(9);
    expect(G.save.player.gold).toBe(40);
    expect(G.save.daily.missions[0].n).toBe(2);
  });
});

describe('세트 없음', () => {
  it('떨어지는 장비는 모두 등급 이름 장비, 세트 표시 없음', () => {
    let k = 11; const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const it = rollItem(r, '악몽', 'B', 60, i);
      expect(it.name).toBe(itemName(it));
      expect(Object.keys(it).sort()).toEqual(['fixedRolls', 'grade', 'id', 'kind', 'lines', 'name', 'slot', 'specs']);
    }
  });
  it('옛 저장의 세트 장비는 세트 표시를 빼고 등급 이름으로 (잠금은 그대로, v17: 강화 단계는 지움)', () => {
    const o = JSON.parse(JSON.stringify(newSave(1)));
    o.v = 16;
    o.gear.equipped = { head: { id: 1, slot: 'head', grade: '희귀', plus: 3, name: '새벽 순례자의 두건', set: 'dawn', lock: true }, weapon: { id: 2, slot: 'weapon', grade: '고급', plus: 0, name: '튼튼한 지팡이' } };
    o.gear.bag = [{ id: 3, slot: 'ring', grade: '영웅', plus: 0, name: '순례자의 반지', set: 'dawn' }];
    const g = migrate(o).gear;
    expect(g.equipped.head).toMatchObject({ id: 1, slot: 'head', kind: 'hood', grade: '희귀', name: '축복받은 두건', lock: true });
    expect(g.equipped.weapon).toMatchObject({ id: 2, slot: 'weapon', kind: 'staff', grade: '고급', name: '튼튼한 지팡이' });
    expect(g.bag).toMatchObject([{ id: 3, slot: 'ring', kind: 'ring', grade: '영웅', name: '성스러운 반지' }]);
    expect('set' in g.equipped.head! || 'set' in g.bag[0]).toBe(false);
    expect('plus' in g.equipped.head! || 'plus' in g.equipped.weapon! || 'plus' in g.bag[0]).toBe(false);
  });
});

describe('아이템 레벨 (2026-10-13 Lim 「장소 레벨 기준으로 장비의 성능을 달리 하자」)', () => {
  const staff = (lv?: number) => item({ slot: 'weapon', kind: 'staff', grade: '영웅', lv });
  // 영웅 줄 배율 (88: 1 → 1.25)
  const H = LINE_MULT['영웅'];
  it('지능 · 체력 = 지금 값 × 아이템 레벨 세기 ÷ 내 레벨 세기: 같은 레벨이면 그대로, 낮은 곳 장비는 레벨이 오를수록 약해짐', () => {
    // 91: 모든 옵션에 아이템 레벨 배율 (ilvBonus, 예전 강화 몫)이 더 붙음
    expect(itemStats(staff(100), 100).int).toBeCloseTo(0.12 * H * ilvBonus(100));
    expect(itemStats(staff(30), 30).int).toBeCloseTo(0.12 * H * ilvBonus(30));
    expect(itemStats(staff(), 100).int).toBeCloseTo(0.12 * H); // 아이템 레벨 없음 = 배율 1
    // 녹슨 고원 악몽 (적 Lv 7) 영웅 지팡이를 Lv 100이 끼면 약 1/10
    expect(ilvMult(7, 100)).toBeCloseTo(str(7) / str(100));
    expect(itemStats(staff(7), 100).int).toBeCloseTo(0.12 * H * ilvBonus(7) * str(7) / str(100));
    expect(itemStats(staff(7), 100).int).toBeLessThan(0.017 * H);
    expect(ilvMult(50, 100)).toBeGreaterThan(0.44); // Lv 50 장비를 Lv 100에서 = 약 45% (정점 수련 포함)
    expect(ilvMult(50, 100)).toBeLessThan(0.46);
    // 내 레벨보다 높은 곳 장비는 더 셈 (Lv 3에서 녹슨 고원 어려움 = 적 Lv 5)
    expect(itemStats(staff(5), 3).int).toBeGreaterThan(0.12 * H);
    // 지능 · 체력은 주 옵션 · 무작위 옵션 모두 같은 배율, 치명타 · 가속 · 정신력 · 인내는 내 레벨과 상관없는 % (Lim 「10%가 9%로 떨어지면 헷갈림」)
    const it = { ...staff(10), lines: [{ stat: 'spirit' as const, roll: 1 }, { stat: 'hp' as const, roll: 0.8 }] };
    const same = optionsOf(it, 10), low = optionsOf(it, 20);
    for (let i = 0; i < same.length; i++) expect(low[i].v).toBeCloseTo(same[i].v * (same[i].stat === 'int' || same[i].stat === 'hp' ? ilvMult(10, 20) : 1));
    // 2026-10-16 Lim 「레벨별로 모든 수치가 레벨에 맞게」: % 옵션은 아이템 레벨로 75~125% (그 장비에서는 레벨업해도 그대로)
    expect(itemStats(staff(7), 100).haste).toBeCloseTo(0.05 * 1.3 * H * pctLvMult(7) * ilvBonus(7));
    expect(itemStats(staff(7), 30).haste).toBeCloseTo(itemStats(staff(7), 100).haste);
    expect(itemStats(staff(100), 100).haste).toBeCloseTo(0.05 * 1.3 * H * 1.25 * ilvBonus(100));
    expect(itemStats(staff(1), 1).haste).toBeCloseTo(0.05 * 1.3 * H * 0.75);
    expect(itemStats(staff(50), 50).haste).toBeCloseTo(0.05 * 1.3 * H * ilvBonus(50), 2);
    expect(gearStatsOf({ weapon: staff(7) }, 100).heal).toBeLessThan(gearStatsOf({ weapon: staff(100) }, 100).heal);
  });
  it('옵션은 % 대신 수치 (Lim 「아이템 수치를 퍼센트가 아닌 수치로 하여 레벨별 아이템으로」): 장비마다 고정, 아이템 레벨이 높을수록 큼', () => {
    // 지능 단위 = 능력치 판 지능 눈금 (INT_BASE × 치유 배율), 체력 = 힐러 기본 체력
    expect(STAT_POINT.int).toBe(INT_BASE * RULES.heal);
    expect(STAT_POINT.hp).toBe(HEALER_HP);
    expect(isPointStat('int') && isPointStat('hp')).toBe(true);
    expect(['crit', 'haste', 'spirit', 'endure'].some(k => isPointStat(k as never))).toBe(false);
    const pts = (it: GearItem, lv: number) => toPoints('int', itemStats(it, lv).int, lv);
    // Lv 100 장소 영웅 지팡이 지능 ≈ 283 (정점 수련 포함), 녹슨 고원 악몽 것 ≈ 25. 내 레벨이 바뀌어도 수치는 그대로
    expect(Math.round(pts(staff(100), 100))).toBe(Math.round(0.12 * H * ilvBonus(100) * 180 * str(100)));
    expect(Math.round(pts(staff(7), 100))).toBe(Math.round(0.12 * H * ilvBonus(7) * 180 * str(7)));
    for (const lv of [1, 30, 100]) expect(pts(staff(7), lv)).toBeCloseTo(pts(staff(7), 7));
    expect(pts(staff(100), 100)).toBeGreaterThan(pts(staff(7), 100) * 9);
  });
  it('점수도 같은 배율 (추천 장착 · 더 좋은 장비 화살표 · 권장 장비)', () => {
    const lowHero = staff(7), adv = (lv: number) => item({ slot: 'weapon', kind: 'staff', grade: '고급', lv });
    expect(itemScore(lowHero, 7)).toBeGreaterThan(itemScore(adv(7), 7)); // 같은 레벨에선 등급이 높은 쪽
    expect(itemScore(lowHero, 50)).toBeLessThan(itemScore(adv(50), 50)); // Lv 50에선 그 레벨 고급이 Lv 7 영웅보다 좋음
    expect(avgScore({ weapon: staff(30) }, 30)).toBeCloseTo(itemScore(staff(30), 30) / SLOTS.length);
  });
  it('떨어질 때 아이템 레벨 = 그 판 적 레벨 (탐험 · 던전은 장소 Lv + 난이도), 상자 · 상점은 내 레벨', () => {
    expect(rollItem(rngFrom(3), '악몽', 'A', 3, 1, { place: 'plateau', lv: 7 }).lv).toBe(7);
    expect(makeItem(rngFrom(3), 'head', '희귀', 1, undefined, { lv: 42 }).lv).toBe(42);
    const s = newSave(1); s.tut = 3; s.player.level = 3;
    const x = settle(s, { content: 'plateau', diff: '어려움', win: true, quit: false, reason: '', segIdx: 1, segN: 2, time: 120, restSec: 10, deaths: 0, healed: 5000, overheal: 1000, dispels: 0, dispellable: 0, endMana: 20, minMana: 5, auto: false, party: [], detail: [] }, rngFrom(5));
    expect(x.items.length).toBe(1);
    expect(x.items[0].lv).toBe(5);
  });
  it('옛 저장 장비는 읽을 때 그 직업 레벨 (지금 성능 그대로)', () => {
    const s = newSave(1); s.player.level = 4;
    s.gear.equipped = { weapon: { id: 1, slot: 'weapon', kind: 'staff', grade: '고급', name: '', lines: [] } };
    s.gear.bag = [{ id: 2, slot: 'head', kind: 'hood', grade: '일반', name: '', lines: [] }];
    const m = migrate(JSON.parse(JSON.stringify(s)));
    expect(m.gear.equipped.weapon!.lv).toBe(4);
    expect(m.gear.bag[0].lv).toBe(4);
    expect(migrate(JSON.parse(JSON.stringify(m))).gear.equipped.weapon!.lv).toBe(4);
  });
});

describe('클리어 골드 (12 3-1, 91에서 되살림)', () => {
  const res = (o: Partial<BattleResult>): BattleResult => ({
    content: 'rustfort', diff: '보통', win: true, quit: false, reason: '', segIdx: 3, segN: 4, time: 360, restSec: 30, deaths: 0,
    healed: 7000, overheal: 1000, dispels: 0, dispellable: 0, endMana: 20, minMana: 5, auto: false, party: [], detail: [], ...o,
  });
  it('골드 = (50 + 10 × 적 레벨) × 난이도 × 등급, 레이드 10인 ×1.5 · 20인 ×2.2 (#172 전 그대로)', () => {
    expect(clearGold(23, '보통', 'A')).toBe(308);
    expect(clearGold(1, '보통', 'B')).toBe(60);
    expect(clearGold(35, '어려움', 'S', 10)).toBe(Math.round(400 * 1.3 * 1.2 * 1.5));
    expect(clearGold(70, '보통', 'A', 20)).toBe(Math.round(750 * 1.1 * 2.2));
    expect(RAID_GOLD).toEqual({ 10: 1.5, 20: 2.2 });
  });
  it('정산에 들어가고 저장됨, 지면 없음. 탐험은 × 0.35 (튜토리얼 뒤)', () => {
    const s = newSave(1);
    const x = settle(s, res({}), () => 0.5);
    expect(x.gold).toBe(clearGold(x.items[0].lv!, '보통', x.grade!));
    expect(s.player.gold).toBe(x.gold);
    const y = settle(s, res({ win: false }), () => 0.5);
    expect(y.gold).toBe(0);
    s.tut = TUT.done; s.player.level = 30;
    const z = settle(s, res({ content: 'cemetery' as BattleResult['content'], diff: '악몽' }), () => 0.5);
    expect(z.gold).toBe(Math.round(clearGold(z.items[0].lv!, '악몽', z.grade!) * EXPLORE_REWARD));
  });
});

describe('장비 종류 · 옵션 (34 6-2 ~ 6-5)', () => {
  it('옵션 줄 수 (Lim 2026-10-11, 88 전설 5): 일반 1 · 고급 2 · 희귀 3 · 영웅 4 · 전설 5, 특수능력 · 고유 능력 줄은 따로', () => {
    expect(OPTION_LINES).toEqual({ '일반': 1, '고급': 2, '희귀': 3, '영웅': 4, '전설': 5 });
    const r = rngFrom(5);
    for (let i = 0; i < 3000; i++) {
      const it = rollItem(r, '악몽', 'S', 60, i);
      expect(optionsOf(it, 30)).toHaveLength(OPTION_LINES[it.grade]);
    }
    expect(optionsOf(item({ slot: 'weapon', kind: 'staff', grade: '일반' }), 30).map(x => x.stat)).toEqual(['int']); // 일반 무기는 주 옵션만
    expect(optionsOf(item({ slot: 'ring', kind: 'twin', grade: '일반' }), 30).map(x => x.stat)).toEqual(['crit']); // 종류 옵션이 줄 수보다 많으면 앞 것만
  });
  it('뽑은 장비: 그 부위 종류, 남은 줄만큼 무작위 옵션 (서로 다르고 주 · 종류 옵션과도 다름), 주 · 종류 · 무작위 모두 굴림 50~160% (91)', () => {
    const r = rngFrom(5);
    for (let i = 0; i < 3000; i++) {
      const it = rollItem(r, '악몽', 'S', 60, i), ks = kindsOf(it.slot), k = ks.find(x => x.key === it.kind)!;
      expect(k).toBeTruthy();
      expect(it.lines).toHaveLength(randomLines(k, it.grade));
      expect(it.fixedRolls).toHaveLength(OPTION_LINES[it.grade] - it.lines.length);
      expect(new Set(it.lines.map(l => l.stat)).size).toBe(it.lines.length);
      expect(it.lines.some(l => takenStats(k).includes(l.stat))).toBe(false);
      for (const x of [...it.lines.map(l => l.roll), ...it.fixedRolls!]) { expect(x).toBeGreaterThanOrEqual(0.5); expect(x).toBeLessThanOrEqual(1.6); }
    }
  });
  it('옵션 굴림 r = 0.5 + 1.1 × u^1.2: 평균 100%, 120% 넘는 줄 약 31%, 145% 넘는 줄 약 12%', () => {
    const r = rngFrom(7), n = 200000;
    let sum = 0, over120 = 0, over145 = 0;
    for (let i = 0; i < n; i++) { const x = rollOpt(r); sum += x; if (x > 1.2) over120++; if (x > 1.45) over145++; }
    expect(OPT_ROLL).toEqual({ lo: 0.5, span: 1.1, pow: 1.2 });
    expect(sum / n).toBeCloseTo(1, 2);
    expect(over120 / n).toBeGreaterThan(0.29); expect(over120 / n).toBeLessThan(0.33);
    expect(over145 / n).toBeGreaterThan(0.1); expect(over145 / n).toBeLessThan(0.13);
  });
  it('값 = 기준값 × 굴림 (주 옵션 = 부위 값 × 등급 배율, 종류 옵션 = 그 줄 최대값, 무작위 옵션 = 최대값 × 0.8), 범위 = 굴림 50% ~ 160%', () => {
    const staff = item({ slot: 'weapon', kind: 'staff', grade: '영웅', fixedRolls: [1.5, 0.5] }), H = LINE_MULT['영웅'], R = LINE_MULT['희귀'];
    expect(itemStats(staff, 30).int).toBeCloseTo(0.12 * H * 1.5);
    expect(itemStats(staff, 30).haste).toBeCloseTo(0.05 * 1.3 * H * 0.5);
    expect(itemStats(staff, 30).hp).toBe(0);
    const l = itemStats({ ...staff, lines: [{ stat: 'crit', roll: 1.25 }] }, 30);
    expect(l.crit).toBeCloseTo(0.04 * 1.3 * H * RANDOM_BASE * 1.25);
    expect(RANDOM_BASE).toBe(0.8);
    // 굴림이 없는 (옛) 장비는 1 = 예전 고정값
    const robe = itemStats(item({ slot: 'chest', kind: 'robe', grade: '희귀' }), 30);
    expect(robe.hp).toBeCloseTo(0.18 * R);
    expect(robe.spirit).toBeCloseTo(0.08 * 1.3 * R);
    expect(robe.int).toBe(0);
    const o = optionsOf({ ...staff, lines: [{ stat: 'crit', roll: 1.25 }] }, 30);
    for (const x of o) { expect(x.lo).toBeCloseTo(x.v * 0.5 / x.roll); expect(x.hi).toBeCloseTo(x.v * 1.6 / x.roll); }
  });
  it('치명타 · 가속 · 인내는 합 상한까지, 지능은 45% 넘는 몫이 절반 (2026-10-12)', () => {
    const g = statsToGear({ int: 0.5, hp: 0.4, crit: 0.7, haste: 0.6, spirit: 0.3, endure: 0.45 });
    expect(g).toEqual({ heal: 1.475, regen: 1.3, crit: 0.5, haste: 0.5, hp: 0.4, endure: 0.3 });
  });
  it('시뮬 프리셋 희귀 (× 1.4, 예전 +5) = 아이템 레벨 40 희귀 6부위의 기댓값 (91: 강화 몫이 아이템 레벨 배율로)', () => {
    const r = rngFrom(9), n = 4000, sum = Object.fromEntries(STAT_KEYS.map(k => [k, 0])) as Record<string, number>;
    for (let i = 0; i < n; i++) {
      const eq = Object.fromEntries(SLOTS.map(s => [s.key, makeItem(r, s.key, '희귀', i, undefined, { lv: 40 })]));
      const st = equippedStats(eq, 40);
      for (const k of STAT_KEYS) sum[k] += st[k] / n;
    }
    // 지능은 45% 넘는 몫이 절반 (statsToGear) → 표본 합도 같은 변환으로 비교 (88: 희귀 줄 배율 1.15라 넘음)
    const p = gearStats('rare5', 40), q = statsToGear(sum as never);
    for (const k of ['heal', 'regen', 'crit', 'haste', 'hp', 'endure'] as const) expect(Math.abs(q[k]! - p[k]!), k).toBeLessThan(0.01);
  });
  it('전투: 체력은 내 최대 체력, 인내는 내가 받는 피해를 줄임', () => {
    const base = E.create({ encounter: 'warden', diff: '보통', seed: 1 });
    const geared = E.create({ encounter: 'warden', diff: '보통', seed: 1, gearStats: { ...gearStatsOf({}, 1), hp: 0.2, endure: 0.25 } });
    expect(geared.me.max).toBeCloseTo(base.me.max * 1.2);
    const hit = (f: typeof base) => { const before = f.me.hp; damage(f, f.me, 100, false, 'fixed'); return before - f.me.hp; };
    expect(hit(geared)).toBeCloseTo(hit(base) * 0.75);
  });
  it('옛 장비 이전: 그 부위 첫 종류 + 남은 줄만큼 무작위 옵션, 몇 번 불러도 같음', () => {
    const o = JSON.parse(JSON.stringify(newSave(1)));
    o.gear.bag = [{ id: 7, slot: 'neck', grade: '영웅', plus: 2, name: '성스러운 목걸이' }];
    const a = migrate(o).gear.bag[0], b = migrate(JSON.parse(JSON.stringify(o))).gear.bag[0];
    expect(a).toMatchObject({ kind: 'beads', name: '성스러운 구슬 목걸이' });
    expect(a).not.toHaveProperty('plus');
    expect(a.lines).toHaveLength(3);
    expect(b).toEqual(a);
    expect(migrate(JSON.parse(JSON.stringify({ ...o, gear: { ...o.gear, bag: [a] } }))).gear.bag[0]).toEqual(a); // 이미 바뀐 장비는 그대로
  });
});
