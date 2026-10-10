/** 묶음 D2 (51 1장 · 4-2 · 4-3): 10인 ⑨ 어미 용의 둥지, 탐험 ⑰ 잠긴 호숫가, 20인 ① 가라앉은 대성당 2~4구역 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/bosses';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, CONTENT_PLACE, PLACES } from '../src/data/places';
import { PLACE_KINDS } from '../src/data/equipment';
import { FEATURED, NAMED } from '../src/data/specials';
import { UNIQUES } from '../src/data/uniques';
import * as E from '../src/engine';
import { aggroTarget } from '../src/engine/bossParts';

type F = ReturnType<typeof E.create>;
const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); return f; };
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const skillOn = (f: F, key: string) => { const s = f.bs[key]; s.next = f.t; return s; };
const boss = (encounter: E.FightConfig['encounter'], mythic = false) => quiet(E.create({ encounter, diff: mythic ? '악몽' : '보통', seed: 3 }));
const NEST = [['nest1', 'whelps'], ['nest2', 'dandani'], ['nest3', 'rubina']] as const;
const HALLS = [['cathedral2', 'knights'], ['cathedral3', 'uwoong'], ['cathedral4', 'ormal']] as const;

describe('콘텐츠', () => {
  it('탐험 ⑰ 잠긴 호숫가 Lv 68 (심연), 그림은 대성당을 빌림', () => {
    const c = contentOf('lakeshore');
    expect([c.kind, c.unlockLv, c.size('보통'), c.ready]).toEqual(['explore', 68, 3, true]);
    expect(c.fights('보통')).toEqual(['shoretrash', 'knights68']);
    expect(PLACES[CONTENT_PLACE.lakeshore].faction).toBe('abyss');
    expect(artPlaces('lakeshore')).toEqual(['lakeshore', 'cathedral']);
    expect(ENCOUNTERS.knights68.board).toBe('b7');
  });
  it('10인 ⑨: 칸마다 보스 하나, Lv 67 · 악몽 82, 그림은 둥지 첫 칸', () => {
    for (const [key, enc] of NEST) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 67, 10, { '악몽': 82 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(artPlaces(CONTENT_PLACE[key])).toContain('nest');
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('dragon');
    }
  });
  it('20인 ①: 1구역과 한 레이드 (2~4구역), Lv 70 · 악몽 80, 36칸 판', () => {
    for (const [key, enc] of HALLS) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 70, 20, { '악몽': 80 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc].board).toBe('b36');
      expect(artPlaces(CONTENT_PLACE[key])).toContain('cathedral');
    }
  });
  it('몸통이 있는 보스는 몸통 체력 합 = 전투 체력', () => {
    for (const e of Object.values(ENCOUNTERS)) {
      if (e.script === 'trash') continue;
      const bodies = BOSSES[e.script].bodies;
      if (bodies) expect(bodies.reduce((s, b) => s + b.hp, 0), e.key).toBe(e.hp);
    }
  });
  it('드롭: 종류 · 자주 나오는 특수능력 · 이름 있는 장신구 3 · 고유 장비 4', () => {
    for (const k of ['lakeshore', 'nest1', 'nest2', 'nest3', 'cathedral2', 'cathedral3', 'cathedral4']) {
      expect(PLACE_KINDS[k]?.length, k).toBeGreaterThan(0);
      expect(FEATURED[k], k).toHaveLength(3);
    }
    expect(['nest3', 'lakeshore', 'cathedral4'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['rubinaPearl', 'lakePebble', 'threeShards']);
    expect(['nest1', 'nest2', 'cathedral2', 'cathedral3'].map(p => UNIQUES.find(u => u.place === p)?.key)).toEqual(['eggScepter', 'scaleBracer', 'knightHelm', 'pipeCrown']);
  });
});

describe('10인 ⑨', () => {
  it('삼남매: 몸통 셋, 굴러온 알이 12초 안에 안 깨지면 새끼 용 (악몽 10초)', () => {
    for (const [mythic, sec] of [[false, 12], [true, 10]] as const) {
      const f = boss('whelps', mythic);
      expect(f.mobs.filter(m => m.boss).map(m => m.name)).toEqual(['화르', '르륵', '퐁퐁']);
      skillOn(f, mythic ? 'eggm' : 'egg');
      steps(f, 0.1);
      expect(f.mobs.filter(m => m.alive && m.name === '굴러온 알')).toHaveLength(1);
      steps(f, sec - 0.5);
      expect(f.mobs.some(m => m.alive && m.name === '새끼 용'), `${mythic}`).toBe(false);
      steps(f, 0.6);
      expect(f.mobs.filter(m => m.alive && m.name === '새끼 용'), `${mythic}`).toHaveLength(1);
      expect(f.mobs.some(m => m.alive && m.name === '굴러온 알')).toBe(false);
    }
  });
  it('단단이: 비늘 방패 돌진은 보스를 안 맞는 탱커, 악몽은 줄 불길 두 줄', () => {
    const f = boss('dandani'), m = boss('dandani', true);
    const off = f.party.find(u => u.role === 'tank' && u !== aggroTarget(f))!;
    expect(f.bs.charge.target!(f)).toEqual([off.id]);
    expect(f.bs.fire0b.active(f)).toBe(false);
    expect(m.bs.fire0b.active(m)).toBe(true);
  });
  it('루비나: 70% 날아오름 (녹는 보호막 · 새끼 용) → 40% 보물 지키기 (사냥 · 용의 숨결 두 줄), 악몽은 진주 반짝', () => {
    const f = boss('rubina');
    expect(f.bs.greed1.target!(f)).toHaveLength(2);
    f.bossHp = f.bossMax * 0.69;
    steps(f, 0.1);
    expect([f.phase, f.phaseName]).toEqual([2, '2페이즈 · 날아오름']);
    expect(f.bs.greed1.active(f)).toBe(false);
    steps(f, 3.1);
    expect(f.melt).toMatchObject({ name: '뜨거운 날갯짓' });
    f.bossHp = f.bossMax * 0.39;
    steps(f, 6.1);
    expect(f.phase).toBe(3);
    expect(f.tels.filter(t => t.skill.key.startsWith('breath')).length).toBe(2);
    expect(f.bs.hunt.next).toBeLessThan(Infinity);
    expect(f.party.some(u => u.debuffs.some(d => d.name === '진주 반짝'))).toBe(false);
    const m = boss('rubina', true);
    m.bossHp = m.bossMax * 0.69; steps(m, 0.1);
    m.bossHp = m.bossMax * 0.39; steps(m, 0.2);
    expect(m.party.filter(u => u.alive).every(u => u.debuffs.some(d => d.name === '진주 반짝' && d.healCut === 0.2))).toBe(true);
  });
});

describe('잠긴 호숫가 · 20인 ①', () => {
  it('호숫가 기사: 사슬 1쌍 (원거리 딜러와 나)', () => {
    const f = boss('knights68');
    skillOn(f, 'chain');
    steps(f, 0.1);
    expect(f.links).toHaveLength(1);
    expect(f.links[0].a !== f.links[0].b).toBe(true);
  });
  it('회랑 기사 셋: 사슬 3쌍 (악몽 4쌍), 기사가 쓰러질 때마다 남은 기사 +15%', () => {
    for (const [mythic, n] of [[false, 3], [true, 4]] as const) {
      const f = boss('knights', mythic);
      skillOn(f, 'chain');
      steps(f, 0.1);
      expect(f.links, `${mythic}`).toHaveLength(n);
      expect(f.party.filter(u => u.role === 'tank').some(u => u.debuffs.some(d => d.link))).toBe(false);
    }
    const f = boss('knights');
    const before = f.empower;
    const first = f.mobs.find(m => m.boss)!;
    first.hp = 0; first.alive = false;
    steps(f, 0.2);
    expect(f.empower).toBeCloseTo(before + 0.15, 6);
  });
  it('우웅이: 물빛 화음 6명 80%까지 (악몽 70%) · 불협화음 무력화', () => {
    for (const [mythic, cap] of [[false, 0.8], [true, 0.7]] as const) {
      const f = boss('uwoong', mythic);
      skillOn(f, mythic ? 'chordm' : 'chord');
      steps(f, 0.1);
      expect(f.party.filter(u => u.debuffs.some(d => d.name === '물빛 화음' && d.cap === cap)), `${mythic}`).toHaveLength(6);
    }
    const f = E.create({ encounter: 'uwoong', diff: '보통', seed: 3 });
    f.skills.forEach(s => { s.next = Infinity; });
    skillOn(f, 'stagger');
    E.step(f);
    expect(f.stagger).toMatchObject({ name: '불협화음', hp: 0.7 });
  });
  it('오르말: 65% 아래 문에 박힌 조각 셋 (사람 칸), 35% 아래 그림자 가시 2명. 악몽은 못 채운 조각마다 보스 +5%', () => {
    const f = boss('ormal');
    expect(f.bs.greed1.target!(f)).toHaveLength(3);
    f.bossHp = f.bossMax * 0.64;
    steps(f, 2.2);
    expect(f.phase).toBe(2);
    expect(f.souls.filter(u => u.alive && u.soul!.name === '탑 조각')).toHaveLength(3);
    const m = boss('ormal', true);
    m.bossHp = m.bossMax * 0.64;
    steps(m, 2.2);
    const shards = m.souls.filter(u => u.alive);
    expect(shards).toHaveLength(3);
    expect(shards[0].max).toBeGreaterThan(f.souls[0].max);
    const e0 = m.empower;
    steps(m, 20.1);
    expect(m.empower).toBeCloseTo(e0 + 0.15, 6);
    f.bossHp = f.bossMax * 0.34;
    steps(f, 0.1);
    expect(f.phase).toBe(3);
    const hunt = BOSSES.ormal.skills.find(s => s.key === 'hunt')!;
    expect(hunt.effect).toMatchObject({ p: 'hunt', n: 2 });
  });
});

describe('자동 힐러', () => {
  it('잠긴 호숫가 보통이면 거의 다 깸 (장비 없음)', () => {
    let wins = 0;
    for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon: 'lakeshore', diff: '보통', seed: s, level: 68, gear: 'none' }).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(19);
  });
});
