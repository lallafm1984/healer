/** 묶음 E2 (54 1장 · 4-2 · 4-5): 10인 ⑪ 노을 궁전, 탐험 ⑲ 낙타 대상로, 20인 ③ 빛뿌리 숲 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { PLACE_KINDS } from '../src/data/equipment';
import { artPlaces, CONTENT_PLACE, PLACES } from '../src/data/places';
import { FEATURED, NAMED } from '../src/data/specials';
import { UNIQUES } from '../src/data/uniques';
import * as E from '../src/engine';

type F = ReturnType<typeof E.create>;
const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); return f; };
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const skillOn = (f: F, key: string) => { const s = f.bs[key]; s.next = f.t; return s; };
const boss = (encounter: E.FightConfig['encounter'], mythic = false) => quiet(E.create({ encounter, diff: mythic ? '악몽' : '보통', seed: 3 }));
const tels = (f: F, key: string) => f.tels.filter(t => t.skill.key === key);
const DUSK = [['dusk1', 'solsol'], ['dusk2', 'eonggeum'], ['dusk3', 'sarasha']] as const;
const ROOTWOOD = [['rootwood1', 'ttubeok'], ['rootwood2', 'toktok'], ['rootwood3', 'kungkung']] as const;

describe('콘텐츠', () => {
  it('10인 ⑪ 노을 궁전: 칸마다 보스 하나, Lv 75 · 악몽 90, 보물고 · 옥좌는 분수 그림을 빌림', () => {
    for (const [key, enc] of DUSK) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 75, 10, { '악몽': 90 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('sand');
      expect(artPlaces(CONTENT_PLACE[key]).at(-1)).toBe('dusk');
    }
  });
  it('탐험 ⑲ 낙타 대상로 Lv 76 (모래 왕국, 질병만), 폭신이 예습판', () => {
    const c = contentOf('caravan');
    expect([c.kind, c.unlockLv, c.size('보통'), c.ready]).toEqual(['explore', 76, 3, true]);
    expect(c.fights('보통')).toEqual(['dunetrash', 'pokshin76']);
    expect(PLACES.caravan.faction).toBe('sand');
    expect(ENCOUNTERS.pokshin76.board).toBe('b7');
    const wrap = ENCOUNTERS.dunetrash.mobs!.find(m => m.name === '붕대 시종')!.attacks.find(a => a.key === 'wrap')!.effect!;
    expect(wrap.p === 'cycle' && wrap.debuffs.map(d => d.type)).toEqual(['질병']);
  });
  it('20인 ③ 빛뿌리 숲: Lv 76 · 악몽 86, 36칸 판, 심연', () => {
    for (const [key, enc] of ROOTWOOD) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 76, 20, { '악몽': 86 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc]).toMatchObject({ board: 'b36', big: true });
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('abyss');
    }
  });
  it('드롭: 종류 · 자주 나오는 특수능력 · 이름 있는 장신구 3 · 고유 장비 4', () => {
    for (const k of ['dusk1', 'dusk2', 'dusk3', 'caravan', 'rootwood1', 'rootwood2', 'rootwood3']) {
      expect(PLACE_KINDS[k]?.length, k).toBeGreaterThan(0);
      expect(FEATURED[k], k).toHaveLength(3);
    }
    expect(['dusk3', 'caravan', 'rootwood3'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['featherBrooch', 'camelYarn', 'heartShard']);
    expect(['dusk1', 'dusk2', 'rootwood1', 'rootwood2'].map(p => UNIQUES.find(u => u.place === p)?.key)).toEqual(['sandWreath', 'shellHelm', 'rootGauntlet', 'seedHabit']);
  });
});

describe('10인 ⑪ 노을 궁전', () => {
  it('솔솔 · 살살: 몸통 둘, 모래 사슬 2쌍 (악몽 3쌍), 모래시계 창 안에서는 사슬이 안 끊기고 되돌린 뒤 그대로', () => {
    for (const [mythic, pairs] of [[false, 2], [true, 3]] as const) {
      const f = boss('solsol', mythic);
      expect(f.mobs.filter(m => m.boss).map(m => m.name)).toEqual(['솔솔', '살살']);
      skillOn(f, 'chain');
      steps(f, 0.1);
      expect(f.links, `${mythic}`).toHaveLength(pairs);
    }
    // 창 안: 짝의 체력이 40%p 벌어져도 안 끊김 → 되돌린 뒤 (뒤집을 때 둘 다 가득) 그대로 (창 안 따끔 모래에 쓰러지지 않게 50%)
    const f = boss('solsol');
    skillOn(f, 'glass');
    steps(f, 3.05);
    expect(f.glass).toHaveLength(1);
    skillOn(f, 'chain');
    steps(f, 1.5);
    const l = f.links[0], a = f.party.find(u => u.id === l.a)!, b = f.party.find(u => u.id === l.b)!;
    a.hp = a.max * 0.9; b.hp = b.max * 0.5;
    steps(f, 1);
    expect(f.links).toContain(l);
    steps(f, 5.6);
    expect(f.glass).toHaveLength(0);
    expect(f.links).toContain(l);
    expect(a.hp / a.max).toBeCloseTo(b.hp / b.max, 1);
    // 창 밖에서는 같은 차이에 바로 끊어짐
    const g = boss('solsol');
    skillOn(g, 'chain');
    steps(g, 2);
    const m = g.links[0], c = g.party.find(u => u.id === m.a)!, d = g.party.find(u => u.id === m.b)!;
    c.hp = c.max * 0.9; d.hp = d.max * 0.5;
    steps(g, 0.2);
    expect(g.links).not.toContain(m);
  });
  it('솔솔 · 살살: 모래시계를 뒤집으면 창 안에 따끔 모래 두 번 (3명씩)', () => {
    const f = boss('solsol');
    skillOn(f, 'glass');
    steps(f, 3.05);
    const at = f.glass[0].until - 8;
    expect(f.bs.sting2.next).toBeCloseTo(at + 1.5, 1);
    expect(f.bs.sting3.next).toBeCloseTo(at + 4.5, 1);
    steps(f, 1.6);
    expect(f.party.filter(u => u.debuffs.some(x => x.name === '따끔 모래'))).toHaveLength(3);
  });
  it('엉금이: 등껍질 박치기는 두 탱커에게 예고 (하나는 신기루), 악몽은 두 탱커 모두 진짜', () => {
    const f = boss('eonggeum');
    skillOn(f, 'ram');
    steps(f, 0.1);
    const t = tels(f, 'ram');
    expect(t).toHaveLength(2);
    expect(t.filter(x => x.fake)).toHaveLength(1);
    expect(t.flatMap(x => x.units).map(id => f.party.find(u => u.id === id)!.role)).toEqual(['tank', 'tank']);
    const g = boss('eonggeum', true);
    skillOn(g, 'ramm'); skillOn(g, 'ramm2');
    steps(g, 0.1);
    const both = [...tels(g, 'ramm'), ...tels(g, 'ramm2')];
    expect(both.filter(x => x.fake)).toHaveLength(0);
    expect(new Set(both.flatMap(x => x.units)).size).toBe(2);
    skillOn(g, 'ram');
    steps(g, 0.1);
    expect(tels(g, 'ram')).toHaveLength(0); // 악몽이 아닐 때 기술
  });
  it('엉금이: 등껍질 4중첩이면 탱커 교대, 모래 늪 두 곳', () => {
    const f = boss('eonggeum');
    const t0 = E.aggroTarget(f)!;
    for (let i = 0; i < 4; i++) { skillOn(f, 'shell'); steps(f, 0.1); }
    expect(E.aggroTarget(f)).not.toBe(t0);
    expect(E.aggroTarget(f)!.role).toBe('tank');
    skillOn(f, 'bog0'); skillOn(f, 'bog1');
    steps(f, 0.1);
    expect(f.tels.filter(t => t.skill.key.startsWith('bog'))).toHaveLength(2);
  });
  it('사라샤: 70% 거꾸로 궁전 (모래시계 · 창 안 2초 · 6초 회오리 · 붕대 시녀), 40% 노을 폭풍 (악몽은 여왕의 눈길)', () => {
    const f = boss('sarasha');
    expect([f.phase, f.phaseName]).toEqual([1, '1페이즈 · 여왕의 시험']);
    f.bossHp = f.bossMax * 0.69;
    steps(f, 0.1);
    expect([f.phase, f.phaseName]).toEqual([2, '2페이즈 · 거꾸로 궁전']);
    steps(f, 4 + 3.05);
    expect(f.glass).toHaveLength(1);
    const at = f.glass[0].until - 8;
    steps(f, 0.6);
    expect(tels(f, 'whirl')[0].impact - at).toBeCloseTo(2, 1);
    steps(f, 6.5);
    expect(f.mobs.filter(m => m.alive && m.name === '붕대 시녀')).toHaveLength(2);
    f.bossHp = f.bossMax * 0.39;
    steps(f, 1);
    expect(f.phase).toBe(3);
    expect(f.bs.sigh.next).toBeLessThan(Infinity);
    expect(f.party.some(u => u.debuffs.some(d => d.name === '여왕의 눈길'))).toBe(false);
    const g = boss('sarasha', true);
    g.bossHp = g.bossMax * 0.69; steps(g, 0.1);
    g.bossHp = g.bossMax * 0.39; steps(g, 1);
    const eyed = g.party.filter(u => u.alive && u.debuffs.some(d => d.name === '여왕의 눈길' && d.healCut === 0.2 && d.lock));
    expect(eyed).toHaveLength(g.party.filter(u => u.alive).length);
  });
});

describe('낙타 대상로 · 20인 ③ 빛뿌리 숲', () => {
  it('폭신이 탐험판: 신기루 베개는 장판 두 곳 (하나는 가짜), 코골이 진동', () => {
    const f = boss('pokshin76');
    skillOn(f, 'pillow');
    steps(f, 0.1);
    const t = tels(f, 'pillow');
    expect(t).toHaveLength(2);
    expect(t.filter(x => x.fake)).toHaveLength(1);
    expect(f.bs.snore.quake).toBe(true);
  });
  it('뚜벅이: 뿌리 끌어당기기는 뒷줄 3명 (악몽 4명)을 한꺼번에 끌어옴', () => {
    for (const [mythic, n] of [[false, 3], [true, 4]] as const) {
      const f = boss('ttubeok', mythic);
      skillOn(f, 'pull');
      steps(f, 2.1);
      expect(f.party.filter(u => u.pulled), `${mythic}`).toHaveLength(n);
    }
  });
  it('톡톡: 빛 씨앗 셋 (악몽 넷)이 10초 뒤 터지는 폭탄, 가시 덩굴 6명 (90% 위면 풀림)', () => {
    for (const [mythic, n] of [[false, 3], [true, 4]] as const) {
      const f = boss('toktok', mythic);
      skillOn(f, 'seeds');
      steps(f, 0.1);
      const seeds = f.mobs.filter(m => m.alive && m.name === '빛 씨앗');
      expect(seeds, `${mythic}`).toHaveLength(n);
      expect(seeds[0].add!.job).toMatchObject({ p: 'bomb', sec: 10 });
    }
    const f = boss('toktok');
    for (const u of f.party) u.hp = u.max * 0.5;
    skillOn(f, 'thorn');
    steps(f, 0.1);
    expect(f.party.filter(u => u.debuffs.some(d => d.name === '가시 덩굴' && d.cureAt === 0.9))).toHaveLength(6);
  });
  it('쿵쿵: 부푼 씨앗 4명 → 65% 뒤집힌 박동 4명 (악몽 6명) · 뿌리 덩굴 셋 → 35% 심장 박동', () => {
    const f = boss('kungkung');
    skillOn(f, 'swell');
    steps(f, 0.1);
    expect(f.party.filter(u => u.debuffs.some(d => d.name === '부푼 씨앗' && d.swell))).toHaveLength(4);
    for (const [mythic, n] of [[false, 4], [true, 6]] as const) {
      const g = boss('kungkung', mythic);
      g.bossHp = g.bossMax * 0.64;
      steps(g, 0.1);
      expect([g.phase, g.phaseName]).toEqual([2, '2페이즈 · 뒤집힌 박동']);
      steps(g, 8.1);
      expect(g.party.filter(u => u.debuffs.some(d => d.end?.p === 'flip')), `${mythic}`).toHaveLength(n);
      expect(g.mobs.filter(m => m.alive && m.name === '뿌리 덩굴')).toHaveLength(3);
    }
    f.bossHp = f.bossMax * 0.34;
    steps(f, 0.1);
    f.bossHp = f.bossMax * 0.34;
    steps(f, 0.1);
    expect(f.phase).toBe(3);
    expect(f.bs.beat.next).toBeLessThan(Infinity);
  });
});
