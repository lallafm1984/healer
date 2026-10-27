/** 특수능력이 붙는 장비 (42 1장 · 3장): 등급별 줄 수 · 부위 · 최소 등급 · 직업 전용 · 자주 나오는 것 · 이름 있는 장신구 · 저장 */
import { describe, expect, it } from 'vitest';
import {
  FEATURED_WEIGHT, ITEM_GRADES, itemName, itemScore, KIND_WEIGHT, KINDS, makeItem, makeLegend, PLACE_KINDS, rollItem, rollSpecs, SLOTS, SPEC_LINES, specsOf,
  type GearItem, type ItemGrade, type SlotKey,
} from '../src/data/equipment';
import { FEATURED, NAMED, namedOf, namedsFor, SPECS } from '../src/data/specials';
import { CONTENT, contentOf, type ContentKey } from '../src/data/content';
import { rngFrom } from '../src/engine/rng';
import { migrate, newSave, SAVE_VERSION } from '../src/platform/storage';
import { GEAR_SPECS, GEARS, presetSpecs, type GearId } from '../src/data/gear';
import { uniquesFor } from '../src/data/uniques';

const gi = (g: ItemGrade) => ITEM_GRADES.indexOf(g);
const many = (n: number, f: (r: () => number, i: number) => GearItem) => {
  const r = rngFrom(42);
  return Array.from({ length: n }, (_, i) => f(r, i));
};

describe('드롭 줄 수 · 부위 · 등급', () => {
  it('특수능력은 영웅부터 (88, Lim): 일반 · 고급 · 희귀 0줄 · 영웅 1줄 · 전설은 고유 능력 1줄 (굴림 없이 최대 × 1.5) + 특수능력 1줄', () => {
    expect(SPEC_LINES).toEqual({ '일반': 0, '고급': 0, '희귀': 0, '영웅': 1, '전설': 1 });
    for (const g of ITEM_GRADES) for (const it of many(300, (r, i) => makeItem(r, SLOTS[i % 6].key, g, i))) {
      expect(it.specs!.length).toBe(SPEC_LINES[g] + (g === '전설' ? 1 : 0));
      expect(new Set(it.specs!.map(l => SPECS[l.key].group)).size).toBe(it.specs!.length);
      expect(it.specs!.filter(l => l.legend).length).toBe(g === '전설' ? 1 : 0);
      if (g === '전설') expect(it.specs![0]).toMatchObject({ roll: 1, legend: true });
    }
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
    const a: GearItem = { id: 1, slot: 'ring', kind: 'ring', grade: '영웅', name: '', lines: [], specs: [] };
    expect(itemScore({ ...a, specs: [{ key: 'warmTouch', roll: 1 }] }, 30)).toBeGreaterThan(itemScore(a, 30));
  });
});

describe('이름 있는 장신구 (42 3장, Lim 2026-10-11 「전설에만 고유 능력」)', () => {
  it('전설 (88): 그 20인 구역의 고유 장비 · 이름 있는 장신구가 고르게, 고유 효과가 고유 능력 + 특수능력 1줄, 이름은 장신구 이름', () => {
    const cog = NAMED.find(n => n.key === 'rustyCog')!;
    const pool = SLOTS.reduce((n, s) => n + uniquesFor(cog.place, s.key).length + namedsFor(cog.place, s.key).length, 0);
    const its = many(3000, (r, i) => makeLegend(r, i, { place: cog.place })!);
    expect(its.every(it => it.grade === '전설' && (!!it.named || !!it.unique))).toBe(true);
    const named = its.filter(it => it.named === 'rustyCog');
    expect(named.length / its.length).toBeGreaterThan(0.7 / pool);
    expect(named.length / its.length).toBeLessThan(1.3 / pool);
    for (const it of named) {
      expect(it.slot).toBe(cog.slot);
      expect(it.name).toBe('녹슨 톱니');
      expect(itemName(it)).toBe('녹슨 톱니');
      expect(it.specs).toHaveLength(1);
      expect(it.specs![0].legend).toBeUndefined();
    }
  });
  it('전설이 아니면 · 20인 구역이 아니면 안 나옴', () => {
    const cog = NAMED.find(n => n.key === 'rustyCog')!;
    for (const g of ITEM_GRADES) expect(many(500, (r, i) => makeItem(r, cog.slot, g, i, undefined, { place: cog.place })).some(it => it.named || it.unique)).toBe(false);
    expect(makeLegend(rngFrom(1), 1, { place: 'marsh' })).toBeNull();
    expect(namedOf('rustyCog')!.slot).toBe(cog.slot);
  });
  it('떨어지는 장소는 모두 있는 장소 (20인 구역, 같은 부위가 여럿이면 그중 하나)', () => {
    for (const n of NAMED) {
      const c = contentOf(n.place as ContentKey);
      expect(c.ready, n.key).toBe(true);
      expect(c.name.startsWith(n.placeName) || n.placeName === c.name, n.key).toBe(true);
      expect(namedsFor(n.place, n.slot)).toContain(n);
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
    const rows = Object.entries(PLACE_KINDS).filter(([place]) => !contentOf(place as ContentKey).anchor).map(([place, ks]) => ({ place, lv: contentOf(place as ContentKey).unlockLv, combo: [...ks].sort().join() })); // 보충 장소 (113)는 원본 표 그대로
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
  it('등급 (88, Lim 「초반에는 희귀까지만 · 중반부터 희박하게 영웅 · 전설은 100레벨부터」)', () => {
    const DS = ['쉬움', '보통', '어려움', '악몽'] as const;
    const top = (diff: (typeof DS)[number], raid: 0 | 10 | 20, lv: number) => {
      const its = many(3000, (r, i) => rollItem(r, diff, 'S', lv, i, { place: 'cathedral1', raid, bonus: true, tierLv: lv }));
      return ITEM_GRADES[Math.max(...its.map(it => gi(it.grade)))];
    };
    // Lv 44까지는 어디서든 희귀까지 (탐험 · 던전 쉬움은 고급까지)
    expect(DS.map(d => top(d, 0, 44))).toEqual(['고급', '희귀', '희귀', '희귀']);
    expect(DS.map(d => top(d, 10, 44))).toEqual(['희귀', '희귀', '희귀', '희귀']);
    // Lv 100: 영웅 (탐험 · 던전 쉬움은 없음), 전설은 레이드 어려움 · 악몽 (10인은 20인의 절반, 2026-10-22 Lim)
    expect(DS.map(d => top(d, 0, 100))).toEqual(['희귀', '영웅', '영웅', '영웅']);
    expect(DS.map(d => top(d, 10, 100))).toEqual(['영웅', '영웅', '전설', '전설']);
    expect(DS.map(d => top(d, 20, 100))).toEqual(['영웅', '영웅', '전설', '전설']);
    expect(top('악몽', 20, 99)).toBe('영웅');
    // 영웅은 레벨이 오를수록 늘어남 (10인 악몽)
    const epic = (lv: number) => many(4000, (r, i) => rollItem(r, '악몽', 'B', lv, i, { raid: 10, tierLv: lv })).filter(it => it.grade === '영웅').length;
    const [e50, e75, e100] = [epic(50), epic(75), epic(100)];
    expect(e50).toBeGreaterThan(0);
    expect(e50).toBeLessThan(4000 * 0.05);
    expect(e75).toBeGreaterThan(e50 * 2);
    expect(e100).toBeGreaterThan(e75 * 1.3);
    // 20인 전설은 그 구역의 고유 장비 · 이름 있는 장신구
    const lg = many(3000, (r, i) => rollItem(r, '악몽', 'S', 100, i, { place: 'cathedral1', raid: 20, bonus: true })).filter(it => it.grade === '전설');
    expect(lg.length).toBeGreaterThan(0);
    expect(lg.every(it => !!it.unique || !!it.named)).toBe(true);
  });
});

describe('착용 장비 → 전투 특수능력 값 (42 1-3 · 1-5)', () => {
  const item = (id: number, slot: SlotKey, specs: GearItem['specs'], named?: string): GearItem => ({ id, slot, kind: slot, grade: '영웅', name: '', lines: [], specs, named });
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
  it('장비 없음 · 고급 · 희귀는 빈 값 (88: 특수능력은 영웅부터), 영웅은 부위마다 1줄 (공통 특수능력, 그 부위 · 등급에 나오는 것)', () => {
    expect(presetSpecs('none', 'priest')).toEqual({});
    expect(presetSpecs('adv0', 'priest')).toEqual({});
    expect(presetSpecs('rare5', 'priest')).toEqual({});
    expect(GEAR_SPECS.adv0.length + GEAR_SPECS.rare5.length).toBe(0);
    expect(GEAR_SPECS.epic5.length).toBe(SLOTS.length);
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
    expect(presetSpecs('epic5', 'druid').wideEmbrace).toBeCloseTo(0.06 * 1 * 0.8);
  });
});

describe('저장 (42 1-6)', () => {
  it('옛 장비(특수능력 줄 없음)는 id로 굴림: 몇 번 읽어도 같음', () => {
    const old = { v: 7, hero: 'priest', nextId: 9, gear: { equipped: { weapon: { id: 3, slot: 'weapon', kind: 'staff', grade: '전설', plus: 2, name: 'x', lines: [] } }, bag: [{ id: 5, slot: 'ring', kind: 'ring', grade: '희귀', plus: 0, name: 'y', lines: [] }], seen: 4 } };
    const a = migrate(JSON.parse(JSON.stringify(old))), b = migrate(JSON.parse(JSON.stringify(old)));
    expect(a.gear.equipped.weapon!.specs).toMatchObject([{ roll: 1, legend: true }]); // 전설은 고유 능력 한 줄
    expect(a.gear.bag[0].specs!.length).toBe(0); // 88: 희귀는 특수능력 없음
    expect(a.gear).toEqual(b.gear);
    expect(migrate(JSON.parse(JSON.stringify(a))).gear).toEqual(a.gear);
    expect('codex' in a.gear).toBe(false); // v31: 도감 없앰
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
    expect(migrate(JSON.parse(JSON.stringify({ ...o, v: SAVE_VERSION, gear: { ...o.gear, bag: a } }))).gear.bag).toEqual(a); // 이미 바뀐 장비는 그대로 (v17: 굴림을 또 나누지 않음)
    const [un, nm, leg, legNm] = a;
    expect(un.unique).toBeUndefined();
    expect(un.specs).toEqual([{ key: 'shieldFriend', roll: 1 }]); // 고정 특수능력이 보통 특수능력 한 줄로
    expect(un).toMatchObject({ kind: 'gauntlet', look: 'abyss', name: '성스러운 별밤 건틀릿' }); // 91: 강화 단계는 지움. 생김새는 고유 장비 자리 (61 3-4: 가라앉은 대성당 1구역 = 심연) 세력
    expect(un.lines.map(l => l.stat)).toEqual(['haste', 'spirit']); // 영웅 손 = 주 옵션 + 종류 옵션 + 무작위 2줄: 종류 옵션(인내)과 겹친 줄 · 넘친 줄은 빠짐
    expect(nm.named).toBeUndefined();
    expect(nm.specs).toHaveLength(1);
    expect(leg.specs).toEqual([{ key: 'warmTouch', roll: 1, legend: true }]);
    expect(leg.lines).toHaveLength(4); // 88: 전설 옵션 5줄 (반지 = 종류 1 + 무작위 4)
    expect(legNm).toMatchObject({ named: 'rustyCog', specs: [{ key: 'warmTouch', roll: 0.8 }], name: '녹슨 톱니' }); // 88: 고유 능력 + 특수능력 1줄
  });
});
