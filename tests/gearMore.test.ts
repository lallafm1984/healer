/** 장비 가짓수 늘리기 (34 6-10): 종류 30 · 겹 고정 옵션 · 세력 생김새 · 고유 무기 · 방어구 */
import { describe, expect, it } from 'vitest';
import {
  DUAL_SHARE, fixedOf, GRADE_MULT, hasLookArt, itemName, itemSpecs, itemStats, KINDS, kindsOf, LOOK_WORD, lookOf, LOOKS, makeItem, PLACE_KINDS, rerollLine, rollItem, SLOTS,
  SPEC_LINES, specKeysOf, STATS, type GearItem,
} from '../src/data/equipment';
import { UNIQUE_MULT, UNIQUES, uniqueFor, uniqueOf, uniqueValue } from '../src/data/uniques';
import { NAMED, SPECS, specValue } from '../src/data/specials';
import { CONTENT, contentOf, type ContentKey } from '../src/data/content';
import { FACTIONS, type FactionKey } from '../src/data/places';
import { rngFrom } from '../src/engine/rng';
import { migrate, newSave, noteDex } from '../src/platform/storage';
import { DEX_ALL, DEX_STEP, DEX_TABS, dexDue, dexKeys, dexKeysOf, dexReward, dexTabOf } from '../src/data/dex';
import { gearIcon, KIND_ART } from '../src/screens/art';

describe('종류 30 · 겹 고정 옵션 (34 6-10 ①)', () => {
  it('부위마다 5종, 키 · 이름이 겹치지 않고, 겹 옵션은 서로 다른 두 능력치', () => {
    expect(KINDS).toHaveLength(30);
    for (const s of SLOTS) expect(kindsOf(s.key), s.key).toHaveLength(5);
    expect(new Set(KINDS.map(k => k.key)).size).toBe(30);
    expect(new Set(KINDS.map(k => k.name)).size).toBe(30);
    for (const k of KINDS) {
      expect(k.fixed.length).toBeGreaterThanOrEqual(1);
      expect(k.fixed.length).toBeLessThanOrEqual(2);
      expect(new Set(k.fixed).size).toBe(k.fixed.length);
    }
    expect(KINDS.filter(k => k.fixed.length === 2)).toHaveLength(12);
  });
  it('겹 옵션은 각각 등급 최대값의 60%, 장신구는 강화로 둘 다 오름', () => {
    const base: GearItem = { id: 1, slot: 'hands', kind: 'bracer', grade: '영웅', plus: 5, name: '', lines: [] };
    const fx = fixedOf(base);
    expect(fx.map(x => x.stat)).toEqual(['int', 'haste']);
    expect(fx[0].v).toBeCloseTo(STATS.int.max * DUAL_SHARE);
    expect(fx[1].v).toBeCloseTo(STATS.haste.max * DUAL_SHARE);
    const ring: GearItem = { ...base, slot: 'ring', kind: 'twin', plus: 10 };
    const fr = fixedOf(ring);
    expect(fr[0].v).toBeCloseTo(STATS.crit.max * DUAL_SHARE * 1.8);
    expect(fr[1].v).toBeCloseTo(STATS.haste.max * DUAL_SHARE * 1.8);
    const st = itemStats({ ...base, grade: '희귀', plus: 0 });
    expect(st.haste).toBeCloseTo(STATS.haste.max * DUAL_SHARE * GRADE_MULT['희귀']);
  });
  it('추가 옵션 · 재설정은 두 고정 옵션과 겹치지 않음', () => {
    const r = rngFrom(11);
    for (let i = 0; i < 2000; i++) {
      const k = KINDS[i % KINDS.length], it = makeItem(r, k.slot, '전설', i, k.key);
      expect(it.kind).toBe(k.key);
      for (const l of it.lines) expect(k.fixed).not.toContain(l.stat);
      const nl = rerollLine(r, it, 0);
      expect(k.fixed).not.toContain(nl.stat);
    }
  });
  it('새 종류 14개가 모두 어느 장소에서 잘 나옴', () => {
    const listed = new Set(Object.values(PLACE_KINDS).flat());
    for (const k of KINDS) expect(listed.has(k.key), k.key).toBe(true);
  });
});

describe('세력 생김새 (34 6-10 ②)', () => {
  it('장소에서 나온 장비는 그 세력 생김새 · 이름에 세력 말, 장소 없는 장비는 그대로', () => {
    const r = rngFrom(3);
    for (let i = 0; i < 300; i++) {
      const it = rollItem(r, '보통', 'A', 30, i, { place: 'lampway' });
      if (it.named || it.unique) continue;
      expect(it.look).toBe('fairy');
      expect(it.name).toContain(` ${LOOK_WORD.fairy} `);
      expect(it.name).toBe(itemName(it));
    }
    const plain = makeItem(r, 'chest', '희귀', 1, 'robe');
    expect(plain.look).toBeUndefined();
    expect(plain.name).toBe('축복받은 로브');
    expect(itemName({ ...plain, look: 'pirate' })).toBe('축복받은 산호 로브');
  });
  it('세력마다 생김새 종류 2개 이상, 모두 30종 안, 세력 말이 겹치지 않음', () => {
    expect(new Set(Object.values(LOOK_WORD)).size).toBe(Object.keys(FACTIONS).length);
    for (const f of Object.keys(FACTIONS) as FactionKey[]) {
      expect(LOOKS[f].length, f).toBeGreaterThanOrEqual(2);
      for (const k of LOOKS[f]) expect(KINDS.some(x => x.key === k)).toBe(true);
    }
    const n = Object.values(LOOKS).reduce((a, l) => a + l.length, 0);
    expect(n).toBe(108); // 묶음 D1: 불꽃 (용) +6 · 톱니 (골렘) 사슬 조끼 +1 / D2: 불꽃 화관 · 성물 +2 · 별밤 (심연) 부적 · 사슬 조끼 · 관 · 지팡이 +4 / E1: 노을 (모래 왕국) +6 · 별밤 두건 · 완드 +2 / E2: 노을 +5 · 별밤 건틀릿 · 메이스 +2 / E3: 노을 +3 · 별밤 쌍가락지 · 홀 +2 · 해바라기 관 · 토시 · 옥 반지 +3 · 깃털 (폭풍 깃털단) +2
  });
  it('생김새 그림은 세력 장소에서 잘 나오는 종류만 (나머지는 테두리)', () => {
    expect(hasLookArt({ kind: 'jade', look: 'fairy' })).toBe(true);
    expect(hasLookArt({ kind: 'mace', look: 'fairy' })).toBe(false);
    expect(hasLookArt({ kind: 'jade' })).toBe(false);
    expect(lookOf('palace3')).toBe('fairy');
    expect(lookOf(undefined)).toBeUndefined();
  });
});

describe('고유 무기 · 방어구 (34 6-10 ③)', () => {
  it('50개 (묶음 D1 +4 · D2 +4 · E1 +5 · E2 +4 · E3 +5): 키 · 이름 겹침 없음, 종류는 그 부위, 특수능력은 그 부위에 나오는 직업 공용', () => {
    expect(UNIQUES).toHaveLength(50);
    expect(new Set(UNIQUES.map(u => u.key)).size).toBe(UNIQUES.length);
    expect(new Set(UNIQUES.map(u => u.name)).size).toBe(UNIQUES.length);
    expect(new Set(UNIQUES.map(u => u.place)).size).toBe(UNIQUES.length);
    for (const u of UNIQUES) {
      expect(kindsOf(u.slot).some(k => k.key === u.kind), u.key).toBe(true);
      const d = SPECS[u.spec];
      expect(d, u.spec).toBeTruthy();
      expect(d.slots, u.key).toContain(u.slot);
      expect(d.hero).toBeUndefined();
      expect(contentOf(u.place as ContentKey), u.place).toBeTruthy();
    }
  });
  it('던전마다 하나 (장신구와 다른 부위) · 레이드는 이름 있는 장신구가 없는 칸마다, 탐험은 없음', () => {
    const namedPlaces = new Set(NAMED.map(n => n.place));
    for (const u of UNIQUES) {
      const c = contentOf(u.place as ContentKey);
      expect(c.kind, u.place).not.toBe('explore');
      if (c.kind === 'raid') expect(namedPlaces.has(u.place), u.place).toBe(false);
    }
    for (const c of CONTENT) {
      if (!c.ready || c.hidden || c.kind === 'explore') continue;
      if (c.kind === 'dungeon' || !namedPlaces.has(c.key)) expect(UNIQUES.some(u => u.place === c.key), c.key).toBe(true);
    }
  });
  it('그 장소 그 부위 희귀 이상에서 나옴: 종류 고정, 고정 특수능력 1.5배 + 등급 줄 − 1, 생김새 없음', () => {
    const u = uniqueFor('watchtower', 'weapon')!;
    const r = rngFrom(9);
    const its = Array.from({ length: 400 }, (_, i) => makeItem(r, 'weapon', i % 2 ? '전설' : '희귀', i, undefined, { place: 'watchtower' }));
    const got = its.filter(it => it.unique);
    expect(got.length / its.length).toBeGreaterThan(0.15);
    expect(got.length / its.length).toBeLessThan(0.35);
    for (const it of got) {
      expect(it.unique).toBe(u.key);
      expect(it.kind).toBe(u.kind);
      expect(it.look).toBeUndefined();
      expect(it.name).toBe(u.name);
      expect(it.specs).toHaveLength(SPEC_LINES[it.grade] - 1);
      expect(it.specs!.some(l => SPECS[l.key].group === SPECS[u.spec].group)).toBe(false);
      const on = itemSpecs(it).find(x => x.key === u.spec)!;
      expect(on.v).toBeCloseTo(specValue(u.spec, it.grade, 1) * UNIQUE_MULT);
      expect(specKeysOf(it)).toContain(u.spec);
    }
    const low = Array.from({ length: 200 }, (_, i) => makeItem(r, 'weapon', '고급', i, undefined, { place: 'watchtower' }));
    expect(low.some(it => it.unique)).toBe(false);
    expect(uniqueValue(uniqueOf('magicCrown')!, '희귀')).toBe(SPECS.numberSense.val);
  });
  it('저장했다 불러도 생김새 · 고유 장비가 남음', () => {
    const s = newSave();
    const r = rngFrom(4);
    const a = makeItem(r, 'neck', '희귀', 101, 'amulet', { place: 'teaparty' });
    let b = makeItem(r, 'head', '희귀', 102, undefined, { place: 'temple' });
    for (let i = 0; !b.unique; i++) b = makeItem(r, 'head', '희귀', 102, undefined, { place: 'temple' });
    s.gear.bag.push(a, b);
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.gear.bag.find(x => x.id === 101)!.look).toBe(a.look);
    expect(back.gear.bag.find(x => x.id === 102)!.unique).toBe('guardianHelm');
    expect(back.gear.bag.find(x => x.id === 102)!.name).toBe('신전 수호상 투구');
  });
});

describe('장비 도감 (34 6-10 ④)', () => {
  it('칸 241 = 종류 30 + 세력 108 + 장신구 53 + 고유 50, 키가 겹치지 않음', () => {
    const all = DEX_ALL();
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(30 + 108 + NAMED.length + 50);
    for (const t of DEX_TABS) for (const k of dexKeys(t.key)) expect(dexTabOf(k)).toBe(t.key);
  });
  it('새 장비가 칸을 채움: 종류는 늘, 세력은 그림 있는 생김새만, 장신구 · 고유는 그 칸', () => {
    const s = newSave();
    const a: GearItem = { id: 1, slot: 'ring', kind: 'jade', grade: '일반', plus: 0, name: '', lines: [], look: 'fairy' };
    const b: GearItem = { id: 2, slot: 'weapon', kind: 'mace', grade: '일반', plus: 0, name: '', lines: [], look: 'fairy' };
    const c: GearItem = { id: 3, slot: 'head', kind: 'helm', grade: '희귀', plus: 0, name: '', lines: [], unique: 'guardianHelm' };
    expect(dexKeysOf(a)).toEqual(['k:jade', 'l:fairy:jade']);
    expect(dexKeysOf(b)).toEqual(['k:mace']);
    expect(noteDex(s, [a, b, c])).toEqual(['k:jade', 'l:fairy:jade', 'k:mace', 'k:helm', 'u:guardianHelm']);
    expect(noteDex(s, [a])).toEqual([]);
  });
  it('묶음을 다 채우면 칭호, 10칸마다 보상 (다섯 번째는 정제 강화석도)', () => {
    const s = newSave();
    noteDex(s, KINDS.map((k, i) => ({ id: i, slot: k.slot, kind: k.key, grade: '일반', plus: 0, name: '', lines: [] })));
    expect(s.decos).toContain('장비 감정사');
    expect(dexDue(9, 0).steps).toBe(0);
    expect(dexDue(30, 0)).toEqual({ gold: 1800, stone: 15, refined: 0, steps: 3 });
    expect(dexDue(52, 3)).toEqual({ gold: 1200, stone: 10, refined: 2, steps: 2 });
    expect(dexReward(DEX_STEP / DEX_STEP).gold).toBe(600);
  });
});

describe('장비 그림 이름 (50 5장)', () => {
  it('종류 30 모두 그림 이름이 있고 item-<부위>(-<종류>) 꼴', () => {
    for (const k of KINDS) expect(KIND_ART[k.key], k.key).toMatch(new RegExp(`^item-${k.slot}(-${k.key})?$`));
  });
  it('그림이 없는 고유 · 세력 생김새 · 새 종류는 부위 그림이나 선 아이콘으로 돌아감 (빈 칸이 아님)', () => {
    for (const it of [{ slot: 'hands' as const, kind: 'gauntlet', unique: 'boilerGauntlet' }, { slot: 'ring' as const, kind: 'stone', look: 'golem' as FactionKey }, { slot: 'neck' as const, kind: 'medal' }]) {
      expect(gearIcon(it), JSON.stringify(it)).toMatch(/<(img|svg)/);
    }
  });
});
