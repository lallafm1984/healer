/** 특수능력이 붙는 장비 (42 1장 · 3장): 등급별 줄 수 · 부위 · 최소 등급 · 직업 전용 · 자주 나오는 것 · 이름 있는 장신구 · 저장 · 도감 */
import { describe, expect, it } from 'vitest';
import {
  FEATURED_WEIGHT, ITEM_GRADES, itemName, itemScore, KIND_WEIGHT, KINDS, makeItem, NAMED_CHANCE, PLACE_KINDS, rollItem, rollSpecs, SLOTS, SPEC_ADV, SPEC_LINES, specKeysOf, specsOf,
  type GearItem, type ItemGrade, type SlotKey,
} from '../src/data/equipment';
import { codexKeys, FEATURED, NAMED, namedFor, SPEC_GROUPS, SPEC_KEYS, SPEC_TITLES, SPECS, type CodexGroup } from '../src/data/specials';
import { CONTENT, contentOf, type ContentKey } from '../src/data/content';
import { rngFrom } from '../src/engine/rng';
import { migrate, newSave, noteSpecs } from '../src/platform/storage';
import { exchangeMerit } from '../src/game/economy';
import { GEAR_SPECS, GEARS, presetSpecs, type GearId } from '../src/data/gear';

const gi = (g: ItemGrade) => ITEM_GRADES.indexOf(g);
const many = (n: number, f: (r: () => number, i: number) => GearItem) => {
  const r = rngFrom(42);
  return Array.from({ length: n }, (_, i) => f(r, i));
};

describe('드롭 줄 수 · 부위 · 등급', () => {
  it('일반 0줄 · 희귀 · 영웅 1줄 · 전설은 고유 능력 1줄 (굴림 없이 최대 × 1.5), 고급은 20% 안팎으로 1줄', () => {
    for (const g of ['일반', '희귀', '영웅', '전설'] as const) for (const it of many(300, (r, i) => makeItem(r, SLOTS[i % 6].key, g, i))) {
      expect(it.specs!.length).toBe(SPEC_LINES[g]);
      expect(new Set(it.specs!.map(l => SPECS[l.key].group)).size).toBe(it.specs!.length);
      expect(it.specs!.every(l => !!l.legend === (g === '전설'))).toBe(true);
      if (g === '전설') expect(it.specs![0].roll).toBe(1);
    }
    const adv = many(4000, (r, i) => makeItem(r, SLOTS[i % 6].key, '고급', i));
    expect(adv.every(it => it.specs!.length <= 1)).toBe(true);
    expect(adv.filter(it => it.specs!.length).length / adv.length).toBeCloseTo(SPEC_ADV, 1);
  });
  it('그 부위에 나오는 것 · 최소 등급 이하만, 값 고정이면 굴림 1, 아니면 0.6~1', () => {
    for (const it of many(3000, (r, i) => makeItem(r, SLOTS[i % 6].key, ITEM_GRADES[1 + (i % 4)], i))) for (const l of it.specs!) {
      const d = SPECS[l.key];
      expect(d.slots).toContain(it.slot);
      expect(gi(d.min)).toBeLessThanOrEqual(gi(it.grade));
      if (d.fixed) expect(l.roll).toBe(1);
      else { expect(l.roll).toBeGreaterThanOrEqual(0.6); expect(l.roll).toBeLessThanOrEqual(1); }
    }
  });
  it('직업 전용은 그 판 직업 것만, 직업을 모르면 안 나옴', () => {
    const none = many(3000, (r, i) => makeItem(r, SLOTS[i % 6].key, '전설', i));
    expect(none.some(it => it.specs!.some(l => SPECS[l.key].hero))).toBe(false);
    const dr = many(3000, (r, i) => makeItem(r, SLOTS[i % 6].key, '전설', i, undefined, { hero: 'druid' }));
    const hs = dr.flatMap(it => it.specs!.filter(l => SPECS[l.key].hero));
    expect(hs.length).toBeGreaterThan(50);
    expect(hs.every(l => SPECS[l.key].hero === 'druid')).toBe(true);
  });
  it('장소마다 자주 나오는 특수능력은 그 장소에서 훨씬 잘 나옴', () => {
    const count = (place?: string) => {
      const r = rngFrom(9);
      let n = 0;
      for (let i = 0; i < 6000; i++) n += rollSpecs(r, 'weapon', '영웅', 1, { place }).filter(l => l.key === FEATURED.plateau[0]).length;
      return n;
    };
    expect(FEATURED_WEIGHT).toBe(4);
    expect(count('plateau')).toBeGreaterThan(count() * 2.5);
  });
  it('자주 나오는 특수능력은 모두 있는 특수능력, 장소마다 3개', () => {
    for (const ks of Object.values(FEATURED)) {
      expect(ks.length).toBe(3);
      for (const k of ks) expect(SPECS[k]).toBeDefined();
    }
  });
  it('rollItem은 드롭 맥락을 넘김', () => {
    const its = many(2000, (r, i) => rollItem(r, '악몽', 'S', 60, i, { hero: 'paladin' }));
    expect(its.flatMap(it => it.specs!).filter(l => SPECS[l.key].hero).every(l => SPECS[l.key].hero === 'paladin')).toBe(true);
  });
  it('특수능력 줄은 장비 점수에 더해짐', () => {
    const a: GearItem = { id: 1, slot: 'ring', kind: 'ring', grade: '영웅', plus: 0, name: '', lines: [], specs: [] };
    expect(itemScore({ ...a, specs: [{ key: 'warmTouch', roll: 1 }] })).toBeGreaterThan(itemScore(a));
  });
});

describe('이름 있는 장신구 (42 3장, Lim 2026-10-11 「전설에만 고유 능력」)', () => {
  it('전설 · 그 장소 · 그 부위에서 25% 안팎, 고유 효과가 고유 능력 (다른 특수능력 없음), 이름은 장신구 이름', () => {
    const cog = NAMED.find(n => n.key === 'rustyCog')!;
    const its = many(4000, (r, i) => makeItem(r, cog.slot, '전설', i, undefined, { place: cog.place }));
    const named = its.filter(it => it.named);
    expect(named.length / its.length).toBeCloseTo(NAMED_CHANCE, 1);
    for (const it of named) {
      expect(it.named).toBe('rustyCog');
      expect(it.name).toBe('녹슨 톱니');
      expect(itemName(it)).toBe('녹슨 톱니');
      expect(it.specs).toEqual([]);
    }
    for (const it of its.filter(x => !x.named)) expect(it.specs).toMatchObject([{ roll: 1, legend: true }]);
  });
  it('전설이 아니면 · 다른 부위 · 다른 장소에서는 안 나옴', () => {
    const cog = NAMED.find(n => n.key === 'rustyCog')!;
    for (const g of ['일반', '고급', '희귀', '영웅'] as const) expect(many(1000, (r, i) => makeItem(r, cog.slot, g, i, undefined, { place: cog.place })).some(it => it.named)).toBe(false);
    expect(many(2000, (r, i) => makeItem(r, 'ring', '전설', i, undefined, { place: cog.place })).some(it => it.named)).toBe(false);
    expect(many(2000, (r, i) => makeItem(r, cog.slot, '전설', i, undefined, { place: 'marsh' })).some(it => it.named)).toBe(false);
  });
  it('장소마다 목걸이 · 반지 중 하나만, 떨어지는 장소는 모두 있는 장소', () => {
    for (const n of NAMED) {
      const c = contentOf(n.place as ContentKey);
      expect(c.ready, n.key).toBe(true);
      expect(c.name.startsWith(n.placeName) || n.placeName === c.name, n.key).toBe(true);
      expect(namedFor(n.place, n.slot)).toBe(n);
    }
  });
});

describe('장소마다 잘 나오는 장비 종류 (39 4장)', () => {
  it('있는 종류 · 있는 장소, 던전 3 · 탐험 2 · 레이드 층 1, 같은 레벨대 (열림 ±5, 48 6장) 같은 조합 없음', () => {
    const keys = new Set(KINDS.map(k => k.key));
    for (const [place, ks] of Object.entries(PLACE_KINDS)) {
      const c = contentOf(place as ContentKey);
      expect(ks.every(k => keys.has(k)), place).toBe(true);
      expect(ks.length, place).toBe(c.kind === 'dungeon' ? 3 : c.kind === 'explore' ? 2 : 1);
    }
    // 종류가 16가지라 레이드 칸 하나짜리 조합은 70곳 전체에서는 겹칠 수밖에 없음 → 열림 레벨이 5 안쪽인 장소끼리만 다르게
    const rows = Object.entries(PLACE_KINDS).map(([place, ks]) => ({ place, lv: contentOf(place as ContentKey).unlockLv, combo: [...ks].sort().join() }));
    for (const x of rows) for (const y of rows) if (x.place < y.place && Math.abs(x.lv - y.lv) <= 5) expect(x.combo, `${x.place} · ${y.place}`).not.toBe(y.combo);
    // 지금 열린 탐험 · 던전은 모두 표가 있음
    for (const c of CONTENT) if (c.ready && !c.hidden && (c.kind === 'explore' || c.kind === 'dungeon')) expect(PLACE_KINDS[c.key], c.key).toBeDefined();
  });
  it('그 장소 목록 종류가 KIND_WEIGHT배로 잘 나옴, 목록에 없는 종류도 나옴', () => {
    const its = many(8000, (r, i) => rollItem(r, '보통', 'B', 30, i, { place: 'plateau' }));
    const share = its.filter(it => PLACE_KINDS.plateau.includes(it.kind)).length / its.length;
    const n = PLACE_KINDS.plateau.length;
    expect(share).toBeCloseTo((KIND_WEIGHT * n) / (KINDS.length - n + KIND_WEIGHT * n), 1);
    expect(new Set(its.map(it => it.kind)).size).toBe(KINDS.length);
    for (const it of its) expect(KINDS.find(k => k.key === it.kind)!.slot).toBe(it.slot);
    // 장소 표가 없으면 부위 고르게 (옛 굴림)
    const old = many(6000, (r, i) => rollItem(r, '보통', 'B', 30, i));
    for (const s of SLOTS) expect(old.filter(it => it.slot === s.key).length / old.length).toBeCloseTo(1 / 6, 1);
  });
  it('등급 상한 (61 3장): 탐험 · 던전 쉬움 일반 · 보통 고급 · 어려움 희귀 · 악몽 영웅, 레이드 쉬움 · 보통 희귀 · 어려움 영웅, 전설은 20인 악몽만', () => {
    const top = (diff: '쉬움' | '보통' | '어려움' | '악몽', raid: 0 | 10 | 20) => {
      const its = many(3000, (r, i) => rollItem(r, diff, 'S', 100, i, { place: 'abyssedge', raid, bonus: true }));
      return ITEM_GRADES[Math.max(...its.map(it => gi(it.grade)))];
    };
    expect([top('쉬움', 0), top('보통', 0), top('어려움', 0), top('악몽', 0)]).toEqual(['일반', '고급', '희귀', '영웅']);
    expect([top('쉬움', 10), top('보통', 10), top('어려움', 10), top('악몽', 10)]).toEqual(['희귀', '희귀', '영웅', '영웅']);
    expect([top('쉬움', 20), top('보통', 20), top('어려움', 20), top('악몽', 20)]).toEqual(['희귀', '희귀', '영웅', '전설']);
    // 10인 악몽은 어려움보다 영웅이 잘 나옴
    const epic = (diff: '어려움' | '악몽') => many(3000, (r, i) => rollItem(r, diff, 'B', 100, i, { raid: 10 })).filter(it => it.grade === '영웅').length;
    expect(epic('악몽')).toBeGreaterThan(epic('어려움') * 1.5);
  });
});

describe('착용 장비 → 전투 특수능력 값 (42 1-3 · 1-5)', () => {
  const item = (id: number, slot: SlotKey, specs: GearItem['specs'], named?: string): GearItem => ({ id, slot, kind: slot, grade: '영웅', plus: 0, name: '', lines: [], specs, named });
  it('값은 더하고 (상한까지), 재사용 대기 · 고정 값은 가장 좋은 것 하나, 직업 전용은 그 직업일 때만', () => {
    const eq = {
      weapon: item(1, 'weapon', [{ key: 'warmTouch', roll: 1 }, { key: 'deepWord', roll: 1 }]),
      ring: item(2, 'ring', [{ key: 'warmTouch', roll: 0.5 }, { key: 'wishStar', roll: 0.6 }]),
      neck: item(3, 'neck', [{ key: 'wishStar', roll: 1 }], 'rustyCog'),
    };
    const pr = specsOf(eq, 'priest');
    expect(pr.warmTouch).toBeCloseTo(0.06 + 0.03);
    expect(pr.wishStar).toBeCloseTo(0.08);
    expect(pr.deepWord).toBeCloseTo(0.12);
    expect(pr.rustyCog).toBeCloseTo(0.15);
    expect(specsOf(eq, 'druid').deepWord).toBeUndefined();
  });
  it('장비가 없으면 빈 값', () => {
    expect(specsOf({}, 'priest')).toEqual({});
  });
});

describe('시뮬 프리셋 대표 특수능력 (42 1-7)', () => {
  it('장비 없음은 빈 값, 고급 1줄, 희귀 · 영웅은 부위마다 1줄 (공통 특수능력, 그 부위 · 등급에 나오는 것)', () => {
    expect(presetSpecs('none', 'priest')).toEqual({});
    expect(GEAR_SPECS.adv0.length).toBe(1);
    for (const id of ['rare5', 'epic5'] as GearId[]) expect(GEAR_SPECS[id].length).toBe(SLOTS.length);
    for (const id of Object.keys(GEARS) as GearId[]) {
      const g = GEARS[id].g;
      GEAR_SPECS[id].forEach((k, i) => {
        const d = SPECS[k];
        expect(d.hero).toBeUndefined();
        if (g !== '없음') expect(gi(d.min)).toBeLessThanOrEqual(gi(g));
        if (GEAR_SPECS[id].length === SLOTS.length) expect(d.slots).toContain(SLOTS[i].key);
      });
    }
  });
  it('값 = 그 등급 · 가운데 굴림, 등급이 오르면 커짐', () => {
    expect(presetSpecs('adv0', 'priest').warmTouch).toBeCloseTo(0.06 * 0.6 * 0.8);
    expect(presetSpecs('epic5', 'druid').wideEmbrace).toBeGreaterThan(presetSpecs('rare5', 'druid').wideEmbrace);
  });
});

describe('저장 · 도감 (42 1-6)', () => {
  it('옛 장비(특수능력 줄 없음)는 id로 굴림: 몇 번 읽어도 같고, 도감에 들어감', () => {
    const old = { v: 7, hero: 'priest', nextId: 9, gear: { equipped: { weapon: { id: 3, slot: 'weapon', kind: 'staff', grade: '전설', plus: 2, name: 'x', lines: [] } }, bag: [{ id: 5, slot: 'ring', kind: 'ring', grade: '희귀', plus: 0, name: 'y', lines: [] }], seen: 4 } };
    const a = migrate(JSON.parse(JSON.stringify(old))), b = migrate(JSON.parse(JSON.stringify(old)));
    expect(a.gear.equipped.weapon!.specs).toMatchObject([{ roll: 1, legend: true }]); // 전설은 고유 능력 한 줄
    expect(a.gear.bag[0].specs!.length).toBe(1);
    expect(a.gear).toEqual(b.gear);
    expect(migrate(JSON.parse(JSON.stringify(a))).gear).toEqual(a.gear);
    expect(a.gear.codex.sort()).toEqual([...new Set([...specKeysOf(a.gear.equipped.weapon!), ...specKeysOf(a.gear.bag[0])])].sort());
  });
  it('v9 (Lim 2026-10-11): 전설이 아닌 고유 장비 · 이름 있는 장신구는 보통 장비로, 전설은 고유 능력 한 줄, 몇 번 읽어도 같음', () => {
    const o = JSON.parse(JSON.stringify(newSave(1)));
    o.v = 8;
    o.gear.bag = [
      { id: 21, slot: 'hands', kind: 'gauntlet', grade: '영웅', plus: 1, name: '증기 보일러 건틀릿', lines: [{ stat: 'endure', roll: 0.7 }, { stat: 'haste', roll: 0.8 }, { stat: 'spirit', roll: 0.9 }, { stat: 'crit', roll: 0.6 }], specs: [{ key: 'warmTouch', roll: 0.8 }], unique: 'boilerGauntlet' },
      { id: 22, slot: 'neck', kind: 'beads', grade: '희귀', plus: 0, name: '녹슨 톱니', lines: [{ stat: 'int', roll: 0.7 }], specs: [], named: 'rustyCog' },
      { id: 23, slot: 'ring', kind: 'ring', grade: '전설', plus: 0, name: '', lines: [{ stat: 'int', roll: 0.7 }], specs: [{ key: 'warmTouch', roll: 0.8 }, { key: 'brimming', roll: 0.9 }] },
      { id: 24, slot: 'neck', kind: 'beads', grade: '전설', plus: 0, name: '녹슨 톱니', lines: [], specs: [{ key: 'warmTouch', roll: 0.8 }], named: 'rustyCog' },
    ];
    const a = migrate(JSON.parse(JSON.stringify(o))).gear.bag, b = migrate(JSON.parse(JSON.stringify(o))).gear.bag;
    expect(b).toEqual(a);
    expect(migrate(JSON.parse(JSON.stringify({ ...o, v: 9, gear: { ...o.gear, bag: a } }))).gear.bag).toEqual(a); // 이미 바뀐 장비는 그대로
    const [un, nm, leg, legNm] = a;
    expect(un.unique).toBeUndefined();
    expect(un.specs).toEqual([{ key: 'shieldFriend', roll: 1 }]); // 고정 특수능력이 보통 특수능력 한 줄로
    expect(un).toMatchObject({ kind: 'gauntlet', look: 'golem', name: '성스러운 톱니 건틀릿', plus: 1 });
    expect(un.lines.map(l => l.stat)).toEqual(['haste', 'spirit']); // 영웅 손 = 주 옵션 + 종류 옵션 + 무작위 2줄: 종류 옵션(인내)과 겹친 줄 · 넘친 줄은 빠짐
    expect(nm.named).toBeUndefined();
    expect(nm.specs).toHaveLength(1);
    expect(leg.specs).toEqual([{ key: 'warmTouch', roll: 1, legend: true }]);
    expect(leg.lines).toHaveLength(3);
    expect(legNm).toMatchObject({ named: 'rustyCog', specs: [], name: '녹슨 톱니' });
  });
  it('처음 얻은 특수능력만 새것으로 알려 줌', () => {
    const s = newSave(1);
    const it: GearItem = { id: 1, slot: 'neck', kind: 'neck', grade: '영웅', plus: 0, name: '', lines: [], specs: [{ key: 'warmTouch', roll: 1 }], named: 'rustyCog' };
    expect(noteSpecs(s, [it]).sort()).toEqual(['rustyCog', 'warmTouch']);
    expect(noteSpecs(s, [{ ...it, id: 2 }])).toEqual([]);
    expect(s.gear.codex.sort()).toEqual(['rustyCog', 'warmTouch']);
  });
  it('도감 묶음은 특수능력 118종 + 이름 있는 장신구, 묶음마다 칭호 하나', () => {
    const gs = [...Object.keys(SPEC_GROUPS), 'named'] as CodexGroup[];
    expect(gs.flatMap(codexKeys).length).toBe(SPEC_KEYS.length + NAMED.length);
    expect(new Set(gs.map(g => SPEC_TITLES[g])).size).toBe(gs.length);
  });
  it('묶음 하나를 다 모으면 칭호를 받음 (한 번만)', () => {
    const s = newSave(1);
    const keys = codexKeys('mana');
    const it = (id: number, ks: string[]): GearItem => ({ id, slot: 'ring', kind: 'ring', grade: '영웅', plus: 0, name: '', lines: [], specs: ks.map(key => ({ key, roll: 1 })) });
    noteSpecs(s, [it(1, keys.slice(0, -1))]);
    expect(s.decos).not.toContain(SPEC_TITLES.mana);
    noteSpecs(s, [it(2, keys.slice(-1))]);
    expect(s.decos.filter(d => d === SPEC_TITLES.mana).length).toBe(1);
    noteSpecs(s, [it(3, keys)]);
    expect(s.decos.filter(d => d === SPEC_TITLES.mana).length).toBe(1);
    noteSpecs(s, NAMED.map((n, i) => ({ ...it(10 + i, []), slot: n.slot, named: n.key })));
    expect(s.decos).toContain(SPEC_TITLES.named);
  });
  it('공훈 교환 장비도 직업 맞춤 굴림 · 도감에 적힘', () => {
    const s = newSave(1);
    s.hero = 'paladin'; s.wallet.merit = 10000;
    const r = rngFrom(3);
    for (let i = 0; i < 40; i++) {
      const it = exchangeMerit(s, 'weapon', r) as GearItem;
      expect(it.specs!.length).toBe(1);
      for (const l of it.specs!) expect([undefined, 'paladin']).toContain(SPECS[l.key].hero);
    }
    expect(s.gear.codex.length).toBeGreaterThan(5);
  });
});
