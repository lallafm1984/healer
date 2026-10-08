/** 캐릭터 탭 다듬기 (27 4장): 장비 잠금 · 추천 장착 · 특성 프리셋 · 새것 점 저장 · 능력치 출처 */
import { beforeEach, describe, expect, it } from 'vitest';
import { gearStatsOf, itemStats, SLOTS, type GearItem } from '../src/data/equipment';
import { lvPower } from '../src/data/progression';
import { heroStats, statParts } from '../src/game/charinfo';
import {
  bestGearPlan, equipBest, G, lowGradeIds, pickTalent, salvage, setTalentPreset, talentPreset, talentsNow, toggleLock,
} from '../src/game/state';
import { load, migrate, newSave, save, type KV } from '../src/platform/storage';

const item = (o: Partial<GearItem> = {}): GearItem => ({ id: 1, slot: 'head', grade: '희귀', plus: 0, name: '', ...o });
const mem = (): KV & { data: Record<string, string> } => ({
  data: {},
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = v; },
});

describe('장비 잠금 (27 4-3)', () => {
  beforeEach(() => { G.save = newSave(1); });
  it('잠그면 분해에서 빠지고, 「일반·고급 모두」에도 안 들어감', () => {
    G.save.gear.bag = [item({ id: 1, grade: '일반' }), item({ id: 2, grade: '고급' }), item({ id: 3, grade: '희귀' })];
    expect(toggleLock(2)).toBe(true);
    expect(lowGradeIds()).toEqual([1]);
    const r = salvage([1, 2, 3]);
    expect(r.n).toBe(2);
    expect(G.save.gear.bag.map(x => x.id)).toEqual([2]);
  });
  it('다시 누르면 풀림 (저장에 lock 칸이 사라짐), 착용 장비도 잠글 수 있음', () => {
    G.save.gear.equipped.head = item({ id: 9 });
    expect(toggleLock(9)).toBe(true);
    expect(G.save.gear.equipped.head.lock).toBe(true);
    expect(toggleLock(9)).toBe(false);
    expect('lock' in G.save.gear.equipped.head).toBe(false);
    expect(toggleLock(404)).toBe(false);
  });
  it('잠금은 저장·읽기 뒤에도 남고, 옛 저장 장비(lock 없음)는 안 잠김', () => {
    const kv = mem();
    G.save.gear.bag = [item({ id: 5 }), item({ id: 6 })];
    toggleLock(5);
    save(G.save, kv);
    const s = load(kv);
    expect(s.gear.bag.find(x => x.id === 5)?.lock).toBe(true);
    expect(s.gear.bag.find(x => x.id === 6)?.lock).toBeUndefined();
  });
});

describe('추천 장착 (27 4-2)', () => {
  beforeEach(() => { G.save = newSave(1); });
  it('부위마다 점수가 가장 높은 장비, 바뀌는 부위만', () => {
    G.save.gear.equipped = { weapon: item({ id: 1, slot: 'weapon', grade: '희귀', plus: 5 }), head: item({ id: 2, slot: 'head', grade: '고급' }) };
    G.save.gear.bag = [
      item({ id: 3, slot: 'weapon', grade: '영웅' }), // 4.0 > 3.5
      item({ id: 4, slot: 'weapon', grade: '희귀', plus: 9 }), // 3.9
      item({ id: 5, slot: 'head', grade: '고급' }), // 같으면 지금 것
      item({ id: 6, slot: 'ring', grade: '일반' }), // 빈칸
      item({ id: 7, slot: 'ring', grade: '일반', set: 'belfry' }), // 같은 점수면 세트 먼저
    ];
    const plan = bestGearPlan();
    expect(plan.map(p => [p.slot, p.now?.id ?? null, p.next.id])).toEqual([['weapon', 1, 3], ['ring', null, 7]]);
  });
  it('한 번에 바꾸면 원래 끼던 건 가방으로, 다시 부르면 바꿀 것 없음', () => {
    G.save.gear.equipped = { weapon: item({ id: 1, slot: 'weapon', grade: '일반' }) };
    G.save.gear.bag = [item({ id: 2, slot: 'weapon', grade: '고급' }), item({ id: 3, slot: 'neck', grade: '희귀' })];
    expect(equipBest()).toBe(2);
    expect(G.save.gear.equipped.weapon?.id).toBe(2);
    expect(G.save.gear.equipped.neck?.id).toBe(3);
    expect(G.save.gear.bag.map(x => x.id)).toEqual([1]);
    expect(bestGearPlan()).toEqual([]);
    expect(equipBest()).toBe(0);
  });
});

describe('특성 프리셋 (27 4-5)', () => {
  beforeEach(() => { G.save = newSave(1); G.save.tut = 3; G.save.player.level = 100; });
  it('옛 저장(프리셋 없음)은 지금 고름이 프리셋 1', () => {
    G.save.heroes.priest = { layout: null, tapKey: 'heal', unlocked: true, quest: 0, wins: 0, talents: [0, 1] };
    expect(talentPreset()).toBe(0);
    expect(talentsNow()).toEqual([0, 1]);
  });
  it('바꾸면 지금 고름을 넣어 두고 고른 칸을 꺼냄, 돌아오면 그대로', () => {
    pickTalent(0, 0); pickTalent(1, 2);
    const first = [...talentsNow()!];
    expect(setTalentPreset(1)).toBe(true);
    expect(talentPreset()).toBe(1);
    expect(talentsNow()).toEqual([]);
    pickTalent(0, 1);
    expect(talentsNow()![0]).toBe(1);
    expect(setTalentPreset(0)).toBe(true);
    expect(talentsNow()).toEqual(first);
    expect(setTalentPreset(1)).toBe(true);
    expect(talentsNow()![0]).toBe(1);
  });
  it('고르면 지금 프리셋 칸에도 바로 들어감 (저장이 끊겨도 안 잃음)', () => {
    setTalentPreset(2);
    pickTalent(3, 1);
    const hs = G.save.heroes.priest!;
    expect(hs.presets![2][3]).toBe(1);
    expect(hs.presets![2]).toEqual(hs.talents);
  });
  it('같은 칸·범위 밖은 무시, 직업마다 따로', () => {
    expect(setTalentPreset(0)).toBe(false);
    expect(setTalentPreset(3)).toBe(false);
    expect(setTalentPreset(-1)).toBe(false);
    setTalentPreset(1);
    expect(talentPreset('druid')).toBe(0);
    expect(talentPreset('priest')).toBe(1);
  });
  it('프리셋은 저장·읽기 뒤에도 남음', () => {
    pickTalent(0, 2);
    setTalentPreset(1);
    const kv = mem();
    save(G.save, kv);
    const s = load(kv);
    expect(s.heroes.priest?.preset).toBe(1);
    expect(s.heroes.priest?.presets?.[0][0]).toBe(2);
  });
});

describe('새것 점 기준 (gear.seen)', () => {
  it('새 저장은 0, 저장해 둔 값은 그대로', () => {
    expect(newSave(1).gear.seen).toBe(0);
    const s = newSave(1); s.gear.seen = 7;
    expect(migrate(JSON.parse(JSON.stringify(s))).gear.seen).toBe(7);
  });
  it('옛 저장(seen 없음)은 지금 가진 장비를 다 본 것으로 (nextId - 1)', () => {
    const o = JSON.parse(JSON.stringify(newSave(1)));
    delete o.gear.seen;
    o.nextId = 12;
    expect(migrate(o).gear.seen).toBe(11);
  });
});

describe('능력치 판 · 출처 (27 4-2)', () => {
  beforeEach(() => { G.save = newSave(1); G.save.player.level = 40; });
  it('몫을 더하면 합계, 마나 재생엔 세트 효과도 (엔진과 같은 곱)', () => {
    G.save.gear.equipped = {
      weapon: item({ id: 1, slot: 'weapon', grade: '영웅', set: 'cathedral', plus: 3 }),
      chest: item({ id: 2, slot: 'chest', grade: '영웅', set: 'cathedral' }),
      head: item({ id: 3, slot: 'head', grade: '희귀' }),
    };
    const p = statParts(), st = gearStatsOf(G.save.gear.equipped), lp = lvPower(40);
    expect(p.hp.base + p.hp.level).toBe(p.hp.total);
    expect(p.heal.base + p.heal.level + p.heal.gear).toBeCloseTo(st.heal * lp);
    expect(p.crit.base + p.crit.gear).toBeCloseTo(st.crit);
    expect(p.regen.base + p.regen.gear + p.regen.set).toBeCloseTo(st.regen * 1.1);
    expect(heroStats().regen).toBeCloseTo(st.regen * 1.1);
  });
  it('장비 한 개 몫을 6부위 더하면 장비 능력치', () => {
    const eq = Object.fromEntries(SLOTS.map((s, i) => [s.key, item({ id: i + 1, slot: s.key, grade: (['일반', '고급', '희귀', '영웅', '전설', '희귀'] as const)[i], plus: i })]));
    const st = gearStatsOf(eq), sum = SLOTS.reduce((a, s) => { const x = itemStats(eq[s.key]); return { heal: a.heal + x.heal, crit: a.crit + x.crit, haste: a.haste + x.haste, regen: a.regen + x.regen }; }, { heal: 0, crit: 0, haste: 0, regen: 0 });
    expect(1 + sum.heal).toBeCloseTo(st.heal);
    expect(0.05 + sum.crit).toBeCloseTo(st.crit);
    expect(sum.haste).toBeCloseTo(st.haste);
    expect(1 + sum.regen).toBeCloseTo(st.regen);
    expect(itemStats(null)).toEqual({ heal: 0, crit: 0, haste: 0, regen: 0 });
  });
});
