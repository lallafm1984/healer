/** 묶음 E3 (54 1장 · 3-2 · 4-3 · 4-6): 10인 ⑫ 낮잠 피라미드, 20인 ④ 별빛 저수지, 탐험 ⑳ 바람개비 언덕, 던전 ⑯ 해시계 천문대 */
import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { LOOK_WORD, PLACE_KINDS } from '../src/data/equipment';
import { CONTENT_PLACE, FACTIONS, PLACES } from '../src/data/places';
import { FEATURED, NAMED } from '../src/data/specials';
import { UNIQUES } from '../src/data/uniques';
import * as E from '../src/engine';
import { unitDps } from '../src/engine/units';
import type { Unit } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); return f; };
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const skillOn = (f: F, key: string) => { const s = f.bs[key]; s.next = f.t; return s; };
const boss = (encounter: E.FightConfig['encounter'], mythic = false) => quiet(E.create({ encounter, diff: mythic ? '악몽' : '보통', seed: 3 }));
const tels = (f: F, key: string) => f.tels.filter(t => t.skill.key === key);
const PYRAMID = [['pyramid1', 'pokshin'], ['pyramid2', 'jjaekkak'], ['pyramid3', 'hapum']] as const;
const RESERVOIR = [['reservoir1', 'ttakttak'], ['reservoir2', 'jjirit'], ['reservoir3', 'doeul']] as const;
const KICK = Object.values(ABILITIES).find(a => a.fx.e === 'interrupt' && !a.trig.some(t => t.t === 'castAny'))!;
/** 끊기 담당 하나만 (성격 pers): 다른 사람은 능력 없음 */
function cutter(f: F, pers: Unit['pers']): Unit {
  f.abOn = true;
  for (const u of f.party) u.ab = null;
  const u = f.party.find(x => x.role !== 'tank' && !x.me)!;
  u.pers = pers;
  u.ab = { key: KICK.key, star: 5, ready: 0, uses: 0, fired: [], hist: [], lastCounter: 0 };
  return u;
}

describe('콘텐츠', () => {
  it('10인 ⑫ 낮잠 피라미드: 칸마다 보스 하나, Lv 79 · 악몽 94, 모래 왕국', () => {
    for (const [key, enc] of PYRAMID) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 79, 10, { '악몽': 94 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc].board, enc).toBe('b25');
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('sand');
    }
  });
  it('20인 ④ 별빛 저수지: Lv 79 · 악몽 89, 36칸 판, 심연', () => {
    for (const [key, enc] of RESERVOIR) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 79, 20, { '악몽': 89 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc]).toMatchObject({ board: 'b36', big: true });
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('abyss');
    }
  });
  it('탐험 ⑳ 바람개비 언덕 Lv 80: 다음 지역 폭풍 깃털단 첫 등장 (저주 · 마법, 세력 말 「깃털」)', () => {
    const c = contentOf('pinwheel');
    expect([c.kind, c.unlockLv, c.size('보통')]).toEqual(['explore', 80, 3]);
    expect(c.fights('보통')).toEqual(['windtrash', 'hwirik']);
    expect(PLACES.pinwheel.faction).toBe('storm');
    expect(FACTIONS.storm.dispel).toEqual(['저주', '마법']);
    expect(LOOK_WORD.storm).toBe('깃털');
    const hex = ENCOUNTERS.windtrash.mobs!.find(m => m.name === '폭풍 점술사')!.attacks.find(a => a.key === 'hex')!.effect!;
    expect(hex.p === 'cycle' && hex.debuffs.map(d => d.type)).toEqual(['저주', '마법']);
  });
  it('던전 ⑯ 해시계 천문대 Lv 80: 해바라기 언덕 (모든 유형), 일반 → 별바라기 → 정예 → 그늘지기', () => {
    const c = contentOf('observatory');
    expect([c.kind, c.unlockLv, c.size('보통')]).toEqual(['dungeon', 80, 5]);
    expect(c.fights('보통')).toEqual(['startrash', 'stargazer', 'sundialyard', 'geuneul']);
    expect(PLACES.observatory.faction).toBe('hill');
    expect(ENCOUNTERS.sundialyard.mobs!.some(m => m.elite)).toBe(true);
    expect([ENCOUNTERS.stargazer.board, ENCOUNTERS.geuneul.board]).toEqual(['b10', 'b10']);
  });
  it('드롭: 종류 · 자주 나오는 특수능력 · 이름 있는 장신구 4 · 고유 장비 5', () => {
    for (const k of ['pyramid1', 'pyramid2', 'pyramid3', 'reservoir1', 'reservoir2', 'reservoir3', 'pinwheel', 'observatory']) {
      expect(PLACE_KINDS[k]?.length, k).toBeGreaterThan(0);
      expect(FEATURED[k], k).toHaveLength(3);
    }
    expect(['pyramid3', 'reservoir3', 'pinwheel', 'observatory'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['nightcapTassel', 'echoDrop', 'pinwheelPin', 'starMap']);
    expect(['pyramid1', 'pyramid2', 'reservoir1', 'reservoir2', 'observatory'].map(p => UNIQUES.find(u => u.place === p)?.key))
      .toEqual(['pillowHabit', 'hourglassBracer', 'clawMace', 'sparkSleeve', 'sundialCrown']);
  });
});

describe('가짜 반격 틈 (별바라기, 반격 틈 × 신기루)', () => {
  /** 별빛 모으기 두 틈 (5초 간격) 중 첫 틈이 가짜 (fakeFirst) */
  function twoGaps(pers: Unit['pers'], fakeFirst: boolean, mythic = false) {
    const f = boss('stargazer', mythic);
    const u = cutter(f, pers);
    const s = skillOn(f, 'star');
    const rng = f.rng;
    let first = true; // 첫 굴림 = 첫 틈이 가짜인지, 그다음 (끊기 성공 굴림)은 늘 성공
    f.rng = () => (first ? ((first = false), fakeFirst ? 0.1 : 0.9) : 0);
    E.step(f); f.events.length = 0;
    f.rng = rng;
    return { f, u, s };
  }
  it('틈이 5초 간격으로 두 번, 하나만 가짜 (끝 1초에 걷힘)', () => {
    const f = boss('stargazer');
    for (const u of f.party) u.ab = null;
    const s = skillOn(f, 'star');
    const seen: boolean[] = [];
    for (let i = 0; i < 2; i++) {
      steps(f, i ? 5 : 0.05);
      const t = tels(f, 'star').at(-1)!;
      expect(t.veil).toBeCloseTo(t.impact - 1, 5);
      seen.push(!!t.fake);
    }
    expect(seen.filter(Boolean)).toHaveLength(1);
    expect(s.next).toBeGreaterThan(f.t + 20); // 두 번째 틈 뒤에는 원래 주기
  });
  it('성급한 끊기 담당은 첫 틈에 바로 끊음: 가짜면 능력만 쓰고 진짜를 놓쳐 별똥비 (전원)', () => {
    const { f, u } = twoGaps('딜 욕심쟁이', true);
    expect(u.ab!.ready).toBeGreaterThan(f.t); // 가짜 틈에 끊기를 써 버림
    expect(f.daze).toBeNull();
    f.party.forEach(x => { x.hp = x.max; });
    steps(f, 5 + 3.1);
    expect(f.daze).toBeNull();
    expect(f.party.filter(x => x.alive && x.hp < x.max).length).toBe(f.party.filter(x => x.alive).length); // 별똥비는 전원
  });
  it('성급해도 첫 틈이 진짜면 끊음 → 보스 4초 기절', () => {
    const { f } = twoGaps('딜 욕심쟁이', false);
    expect(f.daze).toMatchObject({ name: '기절' });
  });
  it('신중파는 걷힐 때까지 기다렸다 진짜만 끊음', () => {
    const { f, u } = twoGaps('신중파', true);
    expect(u.ab!.ready).toBeLessThanOrEqual(f.t); // 가짜 틈에는 안 씀
    steps(f, 5 + 2.05); // 둘째 틈 (진짜)이 걷힐 때
    expect(f.daze).toMatchObject({ name: '기절' });
    expect(tels(f, 'star')).toHaveLength(0);
  });
  it('악몽: 가짜 틈을 끊은 사람은 3초 기절 (딜 0)', () => {
    const { u } = twoGaps('딜 욕심쟁이', true, true);
    expect(u.debuffs.some(d => d.noDps && d.left > 2.5)).toBe(true);
  });
});

describe('10인 ⑫ 낮잠 피라미드', () => {
  it('폭신이: 베개 싸움 (무력화 15초) · 신기루 베개 두 곳 중 하나 진짜, 악몽은 세 곳 중 둘 진짜', () => {
    const f = boss('pokshin');
    f.party.forEach(u => { if (!u.me) u.dps = 20; });
    skillOn(f, 'fight');
    steps(f, 0.1);
    expect(f.stagger).toMatchObject({ name: '베개 싸움', hp: 0.7 });
    skillOn(f, 'pillow'); skillOn(f, 'pillowm');
    steps(f, 0.1);
    expect(tels(f, 'pillow').map(t => !!t.fake).sort()).toEqual([false, true]);
    expect(tels(f, 'pillowm')).toHaveLength(0);
    const g = boss('pokshin', true);
    skillOn(g, 'pillow'); skillOn(g, 'pillowm');
    steps(g, 0.1);
    const all = [...tels(g, 'pillow'), ...tels(g, 'pillowm')];
    expect([all.length, all.filter(t => t.fake).length]).toEqual([3, 1]);
  });
  it('째깍이: 큰 모래시계 (12초) 4초 뒤 작은 모래시계 (6초)가 겹치고, 작은 것이 먼저 자기 기록으로 되돌림', () => {
    const f = boss('jjaekkak');
    const u = f.party.find(x => x.role === 'ranged')!;
    skillOn(f, 'big');
    steps(f, 3.05);
    expect(f.glass).toHaveLength(1);
    u.hp = u.max * 0.6; // 큰 것 기록 = 가득, 작은 것 기록 = 60%에서 시간 재촉을 맞은 체력
    steps(f, 4);
    expect(f.glass).toHaveLength(2);
    const rec = f.glass.find(g => g.name === '작은 모래시계')!.rec.get(u.id)!;
    expect(rec).toBeLessThan(0.61);
    u.hp = u.max * 0.5; // 창 안 두 번째 재촉을 맞아도 살게
    steps(f, 6); // 작은 것이 되돌림 (큰 것 뒤집고 1초 뒤 시전 3초 → 뒤집은 지 6초)
    expect(f.glass).toHaveLength(1);
    expect(u.hp / u.max).toBeCloseTo(rec, 2);
    steps(f, 2); // 큰 것이 되돌림 (뒤집은 지 12초)
    expect(f.glass).toHaveLength(0);
    expect(u.hp / u.max).toBeCloseTo(1, 1);
  });
  it('째깍이 악몽: 작은 모래시계가 되돌릴 때 30% 아래인 사람은 더 아픔', () => {
    const run = (mythic: boolean) => {
      const f = boss('jjaekkak', mythic);
      const u = f.party.find(x => x.role === 'ranged')!;
      u.hp = u.max * 0.2;
      skillOn(f, 'small');
      steps(f, 3 + 6.05);
      return u.hp / u.max;
    };
    expect(run(false)).toBeCloseTo(0.2, 2);
    expect(run(true)).toBeLessThan(0.15);
  });
  it('하품호텝: 하품은 받는 치유 −30% · 딜 −20%', () => {
    const f = boss('hapum');
    const u = f.party.find(x => x.role === 'ranged')!;
    u.dps = 100;
    const d0 = unitDps(u, f);
    skillOn(f, 'yawn');
    steps(f, 0.1);
    const y = f.party.find(x => x.debuffs.some(d => d.name === '하품'))!;
    expect(y.debuffs.find(d => d.name === '하품')).toMatchObject({ type: '저주', healCut: 0.3, dpsCut: 0.2 });
    u.debuffs = u.debuffs.filter(d => d.name !== '하품');
    u.debuffs.push({ id: 991, name: '하품', type: '저주', left: 8, dpsCut: 0.2 });
    expect(unitDps(u, f)).toBeCloseTo(d0 * 0.8, 5);
  });
  it('하품호텝 신기루 모래 폭풍: 안전 칸이 양쪽 끝에 (한쪽은 가짜, 끝 2초에 걷힘), 파티원은 걷히기 전 가까운 쪽으로 갔다가 진짜로 옮김', () => {
    const f = boss('hapum');
    f.phase = 2;
    skillOn(f, 'storm');
    steps(f, 0.05);
    const [real, fake] = [tels(f, 'storm').find(t => !t.fake)!, tels(f, 'storm').find(t => t.fake)!];
    expect(fake).toBeTruthy();
    expect(real.veil).toBeCloseTo(real.impact - 2, 5);
    expect(real.safe!.size).toBe(10);
    expect(fake.safe!.size).toBe(10);
    const xs = (s: Set<number>) => [...s].map(i => f.cells[i].px);
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(Math.sign(avg(xs(real.safe!)) - avg(f.cells.map(c => c.px)))).toBe(-Math.sign(avg(xs(fake.safe!)) - avg(f.cells.map(c => c.px))));
    steps(f, 2.5); // 걷히기 전: 두 묶음 모두 안전해 보여서 양쪽으로 감
    const at = (u: Unit) => (u.moving ? u.moving.to : u.cell);
    const inSafe = (s: Set<number>) => f.party.filter(u => u.alive && s.has(at(u))).length;
    expect(inSafe(real.safe!) + inSafe(fake.safe!)).toBeGreaterThan(5);
    steps(f, 2.45 - 2.5 + 2.5); // 걷힌 뒤 (맞기 직전)
    expect(tels(f, 'storm').filter(t => t.fake)).toHaveLength(0);
    expect(inSafe(real.safe!)).toBeGreaterThan(inSafe(fake.safe!));
  });
  it('하품호텝: 70% 모래 폭풍 · 40% 왕의 모래시계, 악몽은 창 안에 왕홀 내려치기 한 번 더', () => {
    const f = E.create({ encounter: 'hapum', diff: '악몽', seed: 3 });
    f.bossHp = f.bossMax * 0.69; steps(f, 0.1);
    expect(f.phase).toBe(2);
    f.bossHp = f.bossMax * 0.39; steps(f, 0.1);
    expect(f.phase).toBe(3);
    const g = boss('hapum', true);
    g.phase = 3;
    skillOn(g, 'glass');
    steps(g, 3.05);
    expect(g.bs.busterm.next).toBeCloseTo(g.t + 1 - 0.05, 1);
  });
});

describe('20인 ④ 별빛 저수지', () => {
  it('딱딱이: 집게 감옥 3명 (집게 그림) · 큰 물결은 왼쪽부터 세로 줄을 훑고 못 피함, 악몽은 돌아옴', () => {
    const f = boss('ttakttak');
    skillOn(f, 'jail');
    steps(f, 0.1);
    const jails = f.mobs.filter(m => m.add?.job?.p === 'jail');
    expect(jails).toHaveLength(3);
    expect(jails[0].add!.art).toBe('mob-claw-jail');
    skillOn(f, 'wave');
    steps(f, 0.1);
    const t = tels(f, 'wave')[0];
    expect(t.skill.fixed).toBe(true);
    expect(f.cells[[...t.cells][0]].col).toBe(0);
    expect(boss('ttakttak', true).bs.wavem.active(boss('ttakttak', true))).toBe(true);
  });
  it('찌릿: 별빛 사슬 3쌍 (악몽 4쌍, 나눔형) · 찌릿 역류는 나에게 (스킬마다 중첩)', () => {
    for (const [mythic, n] of [[false, 3], [true, 4]] as const) {
      const f = boss('jjirit', mythic);
      skillOn(f, 'chain');
      steps(f, 0.1);
      expect(f.links.map(l => l.kind)).toEqual(Array(n).fill('share'));
    }
    const f = boss('jjirit');
    skillOn(f, 'recoil');
    steps(f, 0.1);
    expect(f.me.debuffs.find(d => d.name === '찌릿 역류')).toMatchObject({ count: true, stack: 0 });
  });
  it('되울림: 메아리 화살 4명 중 둘은 신기루 (악몽 5명 중 셋 진짜) · 65% 거꾸로 메아리 (창 안 파도 두 번) · 35% 심연의 물결', () => {
    for (const [mythic, real, all] of [[false, 2, 4], [true, 3, 5]] as const) {
      const f = boss('doeul', mythic);
      skillOn(f, 'arrow');
      steps(f, 0.1);
      const t = tels(f, 'arrow');
      expect(t.filter(x => !x.fake).flatMap(x => x.units)).toHaveLength(real);
      expect(t.flatMap(x => x.units)).toHaveLength(all);
    }
    const f = E.create({ encounter: 'doeul', diff: '보통', seed: 3 });
    f.bossHp = f.bossMax * 0.64; steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect(f.bs.glass.next).toBeLessThan(f.t + 5);
    f.bossHp = f.bossMax * 0.34; steps(f, 0.1);
    expect(f.phase).toBe(3);
  });
});

describe('탐험 ⑳ · 던전 ⑯', () => {
  it('휘리릭: 돌풍은 원거리를 끌고 옴', () => {
    const f = boss('hwirik');
    skillOn(f, 'gust');
    steps(f, 2.1);
    const p = f.party.find(u => u.pulled);
    expect(p?.role).toBe('ranged');
  });
  it('그늘지기: 뒤집는 순간 해 질 녘 표식 2명 (30% 아래 3명), 창 안에서 채운 표식은 되돌아가도 사라진 채', () => {
    const f = boss('geuneul');
    skillOn(f, 'glass');
    steps(f, 3.2);
    const marked = f.party.filter(u => u.debuffs.some(d => d.name === '해 질 녘 표식'));
    expect(marked).toHaveLength(2);
    const u = marked[0], hp0 = f.glass[0].rec.get(u.id)!;
    u.hp = u.max; steps(f, 0.1); // 창 안에서 100%
    expect(u.debuffs.some(d => d.name === '해 질 녘 표식')).toBe(false);
    steps(f, 8);
    expect(u.hp / u.max).toBeCloseTo(hp0, 1); // 체력만 되돌아감
    expect(u.debuffs.some(d => d.name === '해 질 녘 표식')).toBe(false);
    const g = E.create({ encounter: 'geuneul', diff: '보통', seed: 3 });
    g.bossHp = g.bossMax * 0.29; steps(g, 0.1);
    expect([g.phase, g.bs.glass.period]).toEqual([2, 24]);
    quiet(g);
    skillOn(g, 'glass');
    steps(g, 3.2);
    expect(g.party.filter(x => x.debuffs.some(d => d.name === '해 질 녘 표식'))).toHaveLength(3);
  });
});
