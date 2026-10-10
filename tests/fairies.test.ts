/** 묶음 C 반딧불 버섯숲 (48 1장 · 3장): 탐험 ⑬ 꼬마등 오솔길 · ⑮ 불꽃 봉우리 기슭, 던전 ⑪ 끝없는 다과회 · ⑫ 이끼 뿌리 사원 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES, type SkillEffect } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, CONTENT_PLACE, FACTIONS, PLACES } from '../src/data/places';
import * as E from '../src/engine';

type F = ReturnType<typeof E.create>;
const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); return f; };
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const effectOf = (boss: keyof typeof BOSSES, key: string) => BOSSES[boss].skills.find(s => s.key === key)!.effect as SkillEffect;
const skillOn = (f: F, key: string) => { const s = f.bs[key]; s.next = f.t; return s; };
const HAT_NAMES = ['실크해트', '고깔모자', '왕관 모자'];

describe('콘텐츠', () => {
  it('새 세력 버섯 요정단 (질병 + 마법) · 붉은 용 일가 (독 + 마법), 던전 ⑫는 옛 세력 늪의 부족', () => {
    expect(FACTIONS.fairy.dispel).toEqual(['질병', '마법']);
    expect(FACTIONS.dragon.dispel).toEqual(['독', '마법']);
    expect(PLACES[CONTENT_PLACE.lampway].faction).toBe('fairy');
    expect(PLACES[CONTENT_PLACE.teaparty].faction).toBe('fairy');
    expect(PLACES[CONTENT_PLACE.emberfoot].faction).toBe('dragon');
    expect(PLACES[CONTENT_PLACE.mossroot].faction).toBe('swamp');
  });
  it('탐험 ⑬ Lv 52 · ⑮ Lv 60: 3인, 일반 → 보스, 7칸 판', () => {
    const a = contentOf('lampway'), b = contentOf('emberfoot');
    expect([a.kind, a.unlockLv, a.size('보통'), a.ready]).toEqual(['explore', 52, 3, true]);
    expect([b.kind, b.unlockLv, b.size('보통'), b.ready]).toEqual(['explore', 60, 3, true]);
    expect(a.fights('보통')).toEqual(['capway', 'sippy52']);
    expect(b.fights('보통')).toEqual(['hotgravel', 'kobold60']);
    expect([ENCOUNTERS.sippy52.board, ENCOUNTERS.kobold60.board]).toEqual(['b7', 'b7']);
  });
  it('던전 ⑪ Lv 55 · ⑫ Lv 60: 5인, 일반 → 보스 → 정예 → 최종, 그림은 같은 세력을 빌림', () => {
    const a = contentOf('teaparty'), b = contentOf('mossroot');
    expect([a.kind, a.unlockLv, a.size('보통'), a.ready]).toEqual(['dungeon', 55, 5, true]);
    expect([b.kind, b.unlockLv, b.size('보통'), b.ready]).toEqual(['dungeon', 60, 5, true]);
    expect(a.fights('보통')).toEqual(['sugarstair', 'sippy', 'cuptower', 'hatter']);
    expect(b.fights('보통')).toEqual(['wetstair', 'uga', 'turtlebridge', 'shellgod']);
    expect(a.bosses.at(-1)).toBe('모자 장수 해롱');
    expect(artPlaces(CONTENT_PLACE.teaparty).at(-1)).toBe('lampway');
    expect(artPlaces(CONTENT_PLACE.mossroot).at(-1)).toBe('swamp');
  });
});

describe('탐험', () => {
  it('꼬마등 오솔길 홀짝이: 포자 솜뭉치 1명 (질병, 지우면 넘어감)', () => {
    const f = quiet(E.create({ encounter: 'sippy52', diff: '보통', seed: 2, level: 52 }));
    skillOn(f, 'spore');
    steps(f, 0.1);
    const d = f.party.flatMap(u => u.debuffs).filter(x => x.name === '포자 솜뭉치');
    expect(d).toHaveLength(1);
    expect([d[0].type, d[0].end?.p]).toEqual(['질병', 'pass']);
    expect(d[0].absorbLeft).toBeGreaterThan(0);
  });
  it('불꽃 봉우리 꼬질: 불씨 꼬마 용 (쫓아오는 자폭 쫄) · 독 연기', () => {
    const f = quiet(E.create({ encounter: 'kobold60', diff: '보통', seed: 2, level: 60 }));
    skillOn(f, 'whelp'); skillOn(f, 'smoke');
    steps(f, 0.1);
    expect(f.mobs.filter(m => m.alive && m.name === '불씨 꼬마 용')).toHaveLength(1);
    expect(f.party.some(u => u.debuffs.some(d => d.name === '독 연기' && d.type === '독'))).toBe(true);
  });
  it('자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    for (const [dungeon, level] of [['lampway', 52], ['emberfoot', 60]] as const) {
      let wins = 0;
      for (let s = 1; s <= 20; s++) if (E.simulateDungeon({ dungeon, diff: '보통', seed: s, level, gear: 'none' }).win) wins++;
      expect(wins, dungeon).toBeGreaterThanOrEqual(19);
    }
  });
});

describe('던전 보스', () => {
  it('홀짝이 50%: 솜뭉치 2명, 악몽은 막 딜체 55%', () => {
    const f = E.create({ encounter: 'sippy', diff: '보통', seed: 3 });
    f.party.forEach(u => { u.dps = 0; });
    f.bossHp = f.bossMax * 0.49;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect([f.bs.spore1.active(f), f.bs.spore2.active(f), f.bs.spore2m.active(f)]).toEqual([false, true, false]);
    const n = effectOf('sippy', 'spore2') as { debuff: { absorb: number } }, m = effectOf('sippy', 'spore2m') as { debuff: { absorb: number } };
    expect(m.debuff.absorb / n.debuff.absorb).toBeCloseTo(55 / 40);
  });
  it('해롱: 모자 씌우기는 탱커 · 나 아닌 1명에게 세 모자 중 하나 (모자 그림), 35% 아래 2명 · 진동 15초', () => {
    const f = quiet(E.create({ encounter: 'hatter', diff: '보통', seed: 4 }));
    skillOn(f, 'hats');
    steps(f, 0.1);
    const got = f.party.filter(u => u.debuffs.some(d => HAT_NAMES.includes(d.name)));
    expect(got).toHaveLength(1);
    expect(got[0].role).not.toBe('tank');
    expect(got[0].debuffs.find(d => HAT_NAMES.includes(d.name))!.art).toMatch(/^icon-hat-/);
    f.bossHp = f.bossMax * 0.34;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect(f.bs.quake.period).toBe(15);
    expect([f.bs.hats2.active(f), f.bs.hats2m.active(f)]).toEqual([true, false]);
  });
  it('우가: 독버섯 고리가 탱커 아닌 사람 발밑에, 50% 아래 고리 2개 · 악몽 최대 3겹', () => {
    const f = quiet(E.create({ encounter: 'uga', diff: '보통', seed: 5 }));
    skillOn(f, 'ring');
    steps(f, 0.1);
    const z = f.zones.filter(x => x.ring);
    expect(z).toHaveLength(1);
    expect(z[0].ring!.max).toBe(2);
    f.bossHp = f.bossMax * 0.49;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect(f.bs.ring2.active(f)).toBe(true);
    const m = quiet(E.create({ encounter: 'uga', diff: '악몽', seed: 5 }));
    skillOn(m, 'ring');
    steps(m, 0.1);
    expect(m.zones.find(x => x.ring)!.ring!.max).toBe(3);
  });
  it('등딱지: 늪물은 독 (사제가 못 지움), 무력화 게이지 선 70% (악몽 80%), 40% 아래 늪물 3명 · 무력화 28초', () => {
    expect(effectOf('shellgod', 'stagger')).toMatchObject({ p: 'stagger', hp: 0.7, hpMythic: 0.8 });
    const f = E.create({ encounter: 'shellgod', diff: '보통', seed: 6 });
    f.party.forEach(u => { u.dps = 0; });
    f.bossHp = f.bossMax * 0.39;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect(f.bs.stagger.period).toBe(28);
    expect(f.bs.spit2.active(f)).toBe(true);
    expect(ENCOUNTERS.shellgod.debuffs).toContain('독');
  });
});
