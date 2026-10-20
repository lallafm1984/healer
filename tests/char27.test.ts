/** 캐릭터 탭 다듬기 (27 4장): 장비 잠금 · 특성 프리셋 · 새것 점 저장 · 능력치 출처 */
import { beforeEach, describe, expect, it } from 'vitest';
import { gearStatsOf, itemStats, noStats, SLOTS, STAT_KEYS, type GearItem } from '../src/data/equipment';
import { lvPower } from '../src/data/progression';
import { RULES } from '../src/data/rules';
import { heroStats, statParts } from '../src/game/charinfo';
import {
  equip, G, isNewGear, markGearOpened, newGearCount, pickTalent, sell, setTalentPreset, talentPreset, talentsNow, toggleLock,
} from '../src/game/state';
import { load, migrate, newSave, save, type KV } from '../src/platform/storage';

const item = (o: Partial<GearItem> = {}): GearItem => ({ id: 1, slot: 'head', kind: '', grade: '희귀', name: '', lines: [], ...o });
const mem = (): KV & { data: Record<string, string> } => ({
  data: {},
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = v; },
});

describe('장비 잠금 (27 4-3)', () => {
  beforeEach(() => { G.save = newSave(1); });
  it('잠그면 판매에서 빠짐', () => {
    G.save.gear.bag = [item({ id: 1, grade: '일반' }), item({ id: 2, grade: '고급' }), item({ id: 3, grade: '희귀' })];
    expect(toggleLock(2)).toBe(true);
    const r = sell([1, 2, 3]);
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
  beforeEach(() => { G.save = newSave(1); });
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
  it('성능과 무관하게 새로 얻은 장비만 알리고, 상세를 연 장비만 하나씩 꺼짐 (2026-10-17 Lim)', () => {
    G.save.gear.seen = 2;
    G.save.gear.equipped.head = item({ id: 1, grade: '영웅' });
    const old = item({ id: 2, slot: 'ring', grade: '전설' });
    const a = item({ id: 3, grade: '일반' }), b = item({ id: 4, slot: 'weapon' });
    G.save.gear.bag = [old, a, b];
    expect(newGearCount()).toBe(2);
    expect(isNewGear(old)).toBe(false);
    expect(markGearOpened(3)).toBe(true);
    expect([isNewGear(a), isNewGear(b), newGearCount()]).toEqual([false, true, 1]);
    expect(G.save.gear.opened).toEqual([3]);
    expect(G.save.gear.seen).toBe(2);
    // 이미 연 장비 · 옛 장비 · 없는 장비는 그대로
    expect([markGearOpened(3), markGearOpened(2), markGearOpened(99)]).toEqual([false, false, false]);
    expect(G.save.gear.bag).toEqual([old, a, b]);
  });
  it('새것이 다 꺼지면 기준을 올리고 opened를 비움, 다음 획득부터 다시 알림', () => {
    G.save.gear.bag = [item({ id: 10, slot: 'weapon' }), item({ id: 11, slot: 'neck' })];
    G.save.gear.equipped.head = item({ id: 12 });
    markGearOpened(11);
    expect(G.save.gear.opened).toEqual([11]);
    markGearOpened(10);
    expect([G.save.gear.seen, G.save.gear.opened, newGearCount()]).toEqual([12, undefined, 0]);
    const kv = mem(); save(G.save, kv);
    expect(load(kv).gear.seen).toBe(12);
    G.save.gear.bag.push(item({ id: 13, slot: 'ring' }));
    expect(newGearCount()).toBe(1);
  });
  it('판 장비는 opened에서 빠지고, 장착한 장비는 본 것으로 (벗어도 새것 점이 다시 켜지지 않음)', () => {
    G.save.gear.bag = [item({ id: 20, slot: 'weapon' }), item({ id: 21, slot: 'neck' }), item({ id: 22, slot: 'ring' })];
    markGearOpened(20);
    G.save.gear.bag = G.save.gear.bag.filter(x => x.id !== 20);
    markGearOpened(21);
    expect(G.save.gear.opened).toEqual([21]);
    equip(22);
    expect([G.save.gear.seen, newGearCount()]).toEqual([22, 0]);
    G.save.gear.bag.push(G.save.gear.equipped.ring!); delete G.save.gear.equipped.ring;
    expect(newGearCount()).toBe(0);
  });
  it('저장 · 옛 저장: opened는 seen보다 큰 숫자만 남기고, 없으면 빈 것', () => {
    const s = newSave(1); s.gear.seen = 5;
    (s.gear as { opened?: unknown }).opened = [3, 7, 7, 'x', 9];
    const m = migrate(JSON.parse(JSON.stringify(s)));
    expect(m.gear.opened).toEqual([7, 9]);
    const o = JSON.parse(JSON.stringify(newSave(1))); o.v = 17;
    expect('opened' in migrate(o).gear).toBe(false);
  });
});

describe('능력치 판 · 출처 (27 4-2)', () => {
  beforeEach(() => { G.save = newSave(1); G.save.player.level = 40; });
  it('몫을 더하면 합계', () => {
    G.save.gear.equipped = {
      weapon: item({ id: 1, slot: 'weapon', grade: '영웅', fixedRolls: [1.3, 0.9] }),
      chest: item({ id: 2, slot: 'chest', grade: '영웅' }),
      head: item({ id: 3, slot: 'head', grade: '희귀' }),
    };
    const p = statParts(), st = gearStatsOf(G.save.gear.equipped, G.save.player.level), lp = lvPower(40);
    expect(p.hp.base + p.hp.level + p.hp.gear).toBe(p.hp.total);
    expect(p.hp.gear).toBeGreaterThan(0); // 방어구 주 능력치 체력 (34 6-5)
    expect(p.endure.total).toBeCloseTo(st.endure!);
    expect(p.hp.base).toBe(220); // Lv 1 = 550 ÷ 2.5 (34 1-2)
    expect(p.int.base).toBe(72); // 300 ÷ 2.5 × 치유 배율 0.6 (34 1-6)
    expect(p.int.base + p.int.level + p.int.gear).toBe(p.int.total);
    expect(p.int.total).toBe(Math.round(300 * RULES.heal * lp * st.heal));
    expect(p.crit.base).toBe(0); // 기본 치명 0% (34 1-2)
    expect(p.crit.base + p.crit.gear).toBeCloseTo(st.crit);
    expect(1 + p.spirit.total).toBeCloseTo(st.regen);
    expect(heroStats().regen).toBeCloseTo(st.regen);
  });
  it('장비 한 개 몫을 6부위 더하면 장비 능력치', () => {
    const eq = Object.fromEntries(SLOTS.map((s, i) => [s.key, item({ id: i + 1, slot: s.key, grade: (['일반', '고급', '희귀', '영웅', '전설', '희귀'] as const)[i], lv: 30 + i })]));
    const st = gearStatsOf(eq, 40), sum = noStats();
    for (const s of SLOTS) { const x = itemStats(eq[s.key], 40); for (const k of STAT_KEYS) sum[k] += x[k]; }
    expect(1 + sum.int).toBeCloseTo(st.heal);
    expect(sum.crit).toBeCloseTo(st.crit);
    expect(sum.haste).toBeCloseTo(st.haste);
    expect(1 + sum.spirit).toBeCloseTo(st.regen);
    expect(sum.hp).toBeCloseTo(st.hp!);
    expect(sum.endure).toBeCloseTo(st.endure!);
    expect(itemStats(null, 40)).toEqual(noStats());
  });
});
