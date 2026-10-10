/** 묶음 B 짠물 해적단 (46 1장 · 4장): 탐험 ⑨ ⑪ · 10인 ② 갈매기 항구 · ③ 짠물 여왕호 · ④ 보물섬 요새 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES, type DebuffDef, type SkillEffect } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, CONTENT_PLACE, FACTIONS, PLACES } from '../src/data/places';
import * as E from '../src/engine';
import { aggroTarget, applyDebuff } from '../src/engine/bossParts';
import { heal, living } from '../src/engine/core';

type F = ReturnType<typeof E.create>;
const RAIDS = [
  ['gull1', 'crab', 'gull', 39], ['gull2', 'cook', 'gull', 39], ['gull3', 'morel', 'gull', 39],
  ['queen1', 'gunner', 'queen', 43], ['queen2', 'octo', 'queen', 43], ['queen3', 'seawitch', 'queen', 43],
  ['isle1', 'mimic', 'isle', 47], ['isle2', 'parrot', 'isle', 47], ['isle3', 'goldbeard', 'isle', 47],
] as const;
const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); return f; };
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const tanks = (f: F) => f.party.filter(u => u.role === 'tank');
const effectOf = (boss: keyof typeof BOSSES, key: string) => BOSSES[boss].skills.find(s => s.key === key)!.effect as SkillEffect;
const skillOn = (f: F, key: string) => { const s = f.bs[key]; s.next = f.t; return s; };

describe('콘텐츠', () => {
  it('새 세력 짠물 해적단: 해제 독 + 저주, 해적단 장소는 모두 이 세력', () => {
    expect(FACTIONS.pirate.dispel).toEqual(['독', '저주']);
    for (const k of ['shellbeach', 'wreck', ...RAIDS.map(r => r[0])] as const) expect(PLACES[CONTENT_PLACE[k]].faction, k).toBe('pirate');
  });
  it('탐험 ⑨ 조개껍데기 해변 Lv 36 · ⑪ 난파선 모래톱 Lv 44: 3인, 일반 → 보스, 그림은 해변을 빌림', () => {
    const a = contentOf('shellbeach'), b = contentOf('wreck');
    expect([a.kind, a.unlockLv, a.size('보통'), a.ready]).toEqual(['explore', 36, 3, true]);
    expect([b.kind, b.unlockLv, b.size('보통'), b.ready]).toEqual(['explore', 44, 3, true]);
    expect(a.fights('보통')).toEqual(['gullsand', 'crab36']);
    expect(b.fights('보통')).toEqual(['wreckage', 'goldbeard44']);
    expect(ENCOUNTERS.crab36.board).toBe('b7');
    expect(artPlaces(CONTENT_PLACE.wreck).at(-1)).toBe('shellbeach');
  });
  it('10인 ②~④: 칸마다 보스 하나, 악몽은 열림 + 15, 이름 끝 한 낱말로 칸을 나눔, 그림은 레이드마다 같은 자리', () => {
    for (const [key, enc, art, lv] of RAIDS) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock, c.ready], key).toEqual(['raid', lv, 10, { '악몽': lv + 15 }, true]);
      expect(c.fights('악몽')).toEqual([enc]);
      expect(c.name.split(' ').length).toBeGreaterThanOrEqual(3);
      expect(artPlaces(CONTENT_PLACE[key]).at(-1)).toBe(art);
    }
    expect(contentOf('isle3').bosses).toEqual(['해적 선장 금빛수염']);
  });
  it('모두 6열 × 6줄 판, 10인 · 탱커 둘, 광폭화 시간이 있음', () => {
    for (const [, enc] of RAIDS) {
      const f = E.create({ encounter: enc, diff: '보통', seed: 1 });
      expect(f.board, enc).toBe('b36');
      expect(f.party.length).toBe(10);
      expect(tanks(f).length).toBe(2);
      expect(ENCOUNTERS[enc].enrage, enc).toBeGreaterThan(300);
    }
  });
});

describe('탐험 예습', () => {
  it('조개껍데기 해변 집게발 갑판장: 독 거품 1명, 3중첩까지', () => {
    const f = quiet(E.create({ encounter: 'crab36', diff: '보통', seed: 2, level: 36 }));
    skillOn(f, 'bubble');
    steps(f, 11);
    const d = f.party.flatMap(u => u.debuffs).filter(x => x.name === '독 거품');
    expect(d).toHaveLength(1);
    expect(d[0].stack).toBe(3);
  });
  it('난파선 모래톱 금빛수염: 동전 뒤집기 1명 (저주, 10초)', () => {
    const f = quiet(E.create({ encounter: 'goldbeard44', diff: '보통', seed: 2, level: 44 }));
    skillOn(f, 'coin');
    steps(f, 0.1);
    const d = f.party.flatMap(u => u.debuffs).filter(x => x.name === '동전 뒤집기');
    expect(d).toHaveLength(1);
    expect([d[0].type, d[0].end?.p]).toEqual(['저주', 'flip']);
  });
  it('자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    for (const [dungeon, level] of [['shellbeach', 36], ['wreck', 44]] as const) {
      let wins = 0;
      for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon, diff: '보통', seed: s, level, gear: 'none' }).win) wins++;
      expect(wins, dungeon).toBeGreaterThanOrEqual(19);
    }
  });
});

describe('10인 레이드 보스', () => {
  it('탱커 교대 자국: 맞은 탱커에게 3중첩이면 다른 탱커가 보스를 가져감', () => {
    const f = quiet(E.create({ encounter: 'crab', diff: '보통', seed: 3 }));
    const [a, b] = tanks(f), eff = effectOf('crab', 'buster') as { debuff: DebuffDef };
    expect(aggroTarget(f)).toBe(a);
    for (let i = 0; i < 2; i++) applyDebuff(f, a, eff.debuff);
    expect(aggroTarget(f)).toBe(a);
    applyDebuff(f, a, eff.debuff);
    expect(aggroTarget(f)).toBe(b);
  });
  it('집게발 갑판장 50%: 독 거품 3명 · 집게 10초, 악몽은 거품 5중첩', () => {
    const f = E.create({ encounter: 'crab', diff: '보통', seed: 3 });
    f.bossHp = f.bossMax * 0.49;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect(f.bs.buster.period).toBe(10);
    expect([f.bs.bubble1.active(f), f.bs.bubble2.active(f), f.bs.bubble2m.active(f)]).toEqual([false, true, false]);
    expect(effectOf('crab', 'bubble2m')).toMatchObject({ n: 3, debuff: { swell: { max: 5 }, left: 20 } });
  });
  it('해적 요리사: 그물에 묶인 등대지기 (보통 25초, 악몽 20초), 가득 채우면 보스 피해 −25%', () => {
    for (const [diff, sec] of [['보통', 25], ['악몽', 20]] as const) {
      const f = quiet(E.create({ encounter: 'cook', diff, seed: 4 }));
      skillOn(f, diff === '악몽' ? 'keeper2' : 'keeper');
      steps(f, 0.1);
      expect(f.souls, diff).toHaveLength(1);
      expect(f.souls[0].soul!.name).toBe('등대지기 할아버지');
      expect(f.souls[0].soul!.until - f.t).toBeCloseTo(sec - 0.1, 0);
      const m0 = f.dmgMult;
      heal(f, f.souls[0], 1e6, true, true);
      E.step(f);
      expect(f.souls).toHaveLength(0);
      expect(f.dmgMult / m0).toBeCloseTo(0.75);
    }
  });
  it('해적 요리사 30%: 주방 보조 바다코끼리 2마리', () => {
    const f = quiet(E.create({ encounter: 'cook', diff: '보통', seed: 4 }));
    f.bossHp = f.bossMax * 0.29;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    skillOn(f, 'helper2');
    steps(f, 0.1);
    expect(f.mobs.filter(m => m.alive && m.name === '주방 보조 바다코끼리')).toHaveLength(2);
  });
  it('포수장 쾅쾅 40%: 옆구리 포격이 두 줄', () => {
    const f = E.create({ encounter: 'gunner', diff: '보통', seed: 5 });
    f.party.forEach(u => { u.dps = 0; });
    f.bossHp = f.bossMax * 0.39;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    f.skills.forEach(s => { s.next = Infinity; });
    skillOn(f, 'broadside0'); skillOn(f, 'broadside0b');
    steps(f, 0.1);
    expect(f.tels.filter(t => t.skill.name === '옆구리 포격')).toHaveLength(2);
  });
  it('바다 마녀: 소금물 저주는 사슬에 묶인 사람에게 먼저 (치유 상한)', () => {
    const f = quiet(E.create({ encounter: 'seawitch', diff: '보통', seed: 6 }));
    skillOn(f, 'chain');
    steps(f, 0.1);
    const tied = f.party.filter(u => u.debuffs.some(d => d.link));
    expect(tied.length).toBeGreaterThanOrEqual(2);
    skillOn(f, 'brine');
    steps(f, 0.1);
    const got = f.party.filter(u => u.debuffs.some(d => d.cap != null && d.type === '저주'));
    expect(got.length).toBeGreaterThan(0);
    expect(got.every(u => tied.includes(u))).toBe(true);
  });
  it('금빛수염: 60% 선원 3명 → 30% 보물 지키기 (10초마다 보스 +5%)', () => {
    const f = E.create({ encounter: 'goldbeard', diff: '보통', seed: 7 });
    f.party.forEach(u => { u.dps = 0; });
    f.bossHp = f.bossMax * 0.59;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    f.skills.forEach(s => { s.next = Infinity; });
    skillOn(f, 'crew');
    steps(f, 0.1);
    expect(f.mobs.filter(m => m.alive && m.name === '갑판 청소부')).toHaveLength(3);
    f.bossHp = f.bossMax * 0.29;
    steps(f, 0.1);
    expect(f.phase).toBe(3);
    const e0 = f.empower;
    f.invuln = true;
    f.skills.forEach(s => { if (s.key !== 'treasure') s.next = Infinity; });
    steps(f, 10.5);
    expect(f.empower - e0).toBeCloseTo(0.05, 6);
    expect(living(f).length).toBeGreaterThan(0);
  });
});
