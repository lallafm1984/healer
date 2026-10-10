/** 묶음 E1 (54 1장 · 3-1 · 4-1 · 4-4): 10인 ⑩ 노을 시장, 탐험 ⑱ 물밑 계단, 20인 ② 물밑 수도원, 던전 ⑮ 모래시계 궁전 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { LOOK_WORD, PLACE_KINDS } from '../src/data/equipment';
import { artPlaces, CONTENT_PLACE, FACTIONS, PLACES } from '../src/data/places';
import { FEATURED, NAMED } from '../src/data/specials';
import { UNIQUES } from '../src/data/uniques';
import * as E from '../src/engine';

type F = ReturnType<typeof E.create>;
const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); return f; };
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const skillOn = (f: F, key: string) => { const s = f.bs[key]; s.next = f.t; return s; };
const boss = (encounter: E.FightConfig['encounter'], mythic = false) => quiet(E.create({ encounter, diff: mythic ? '악몽' : '보통', seed: 3 }));
const tels = (f: F, key: string) => f.tels.filter(t => t.skill.key === key);
const BAZAAR = [['bazaar1', 'kkubeok'], ['bazaar2', 'hokdol'], ['bazaar3', 'nyanx']] as const;
const ABBEY = [['abbey1', 'heumul'], ['abbey2', 'bichumi'], ['abbey3', 'gipeun']] as const;

describe('콘텐츠', () => {
  it('모래 왕국: 질병 + 저주, 금모래 색, 세력 말 「노을」', () => {
    expect(FACTIONS.sand).toMatchObject({ name: '모래 왕국', color: '#E9C46A', dispel: ['질병', '저주'] });
    expect(LOOK_WORD.sand).toBe('노을');
  });
  it('10인 ⑩ 노을 시장: 칸마다 보스 하나, Lv 71 · 악몽 86, 골목 · 성문은 입구 그림을 빌림', () => {
    for (const [key, enc] of BAZAAR) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 71, 10, { '악몽': 86 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('sand');
      expect(artPlaces(CONTENT_PLACE[key])[artPlaces(CONTENT_PLACE[key]).length - 1]).toBe('bazaar');
    }
  });
  it('탐험 ⑱ 물밑 계단 Lv 72 (심연), 흐물이 예습판, 그림은 대성당을 빌림', () => {
    const c = contentOf('deepstairs');
    expect([c.kind, c.unlockLv, c.size('보통'), c.ready]).toEqual(['explore', 72, 3, true]);
    expect(c.fights('보통')).toEqual(['stairtrash', 'heumul72']);
    expect(artPlaces('deepstairs')).toEqual(['deepstairs', 'cathedral']);
    expect(ENCOUNTERS.heumul72.board).toBe('b7');
  });
  it('20인 ② 물밑 수도원: Lv 73 · 악몽 83, 36칸 판, 심연', () => {
    for (const [key, enc] of ABBEY) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 73, 20, { '악몽': 83 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc]).toMatchObject({ board: 'b36', big: true, manaCoef: enc === 'gipeun' ? 1.8 : 1.6 }); // 제단은 3페이즈 사제 마나 (치유 배율 0.6 뒤)
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('abyss');
    }
  });
  it('던전 ⑮ 모래시계 궁전 Lv 75: 일반 → 데굴이 → 정예 (붕대 시종 · 스핑크스 석상) → 둘둘이', () => {
    const c = contentOf('hourglass');
    expect([c.kind, c.unlockLv, c.size('보통')]).toEqual(['dungeon', 75, 5]);
    expect(c.fights('보통')).toEqual(['sandhall', 'degul', 'backgarden', 'dooldool']);
    const g = ENCOUNTERS.backgarden.mobs!;
    expect(g.map(m => m.name)).toEqual(['모래 병정', '붕대 시종', '스핑크스 석상']);
    expect(g[2].elite).toBe(true);
    const wrap = g[1].attacks.find(a => a.key === 'wrap')!.effect!;
    expect(wrap.p === 'cycle' && wrap.debuffs.map(d => d.type)).toEqual(['질병', '저주']);
  });
  it('드롭: 종류 · 자주 나오는 특수능력 · 이름 있는 장신구 4 · 고유 장비 5', () => {
    for (const k of ['bazaar1', 'bazaar2', 'bazaar3', 'deepstairs', 'abbey1', 'abbey2', 'abbey3', 'hourglass']) {
      expect(PLACE_KINDS[k]?.length, k).toBeGreaterThan(0);
      expect(FEATURED[k], k).toHaveLength(3);
    }
    expect(['bazaar3', 'deepstairs', 'abbey3', 'hourglass'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['riddleNote', 'jellyLight', 'prayerKnot', 'backSand']);
    expect(['bazaar1', 'bazaar2', 'abbey1', 'abbey2', 'hourglass'].map(p => UNIQUES.find(u => u.place === p)?.key))
      .toEqual(['drowsyHelm', 'spiceWraps', 'jellyVestment', 'mirrorWand', 'bandageGloves']);
  });
});

describe('10인 ⑩ 노을 시장', () => {
  it('꾸벅 · 끄덕: 몸통 둘, 신기루 창은 진짜 1 + 가짜 1 (악몽 진짜 2), 하나가 쓰러지면 남은 쪽 +30%', () => {
    for (const [mythic, real] of [[false, 1], [true, 2]] as const) {
      const f = boss('kkubeok', mythic);
      expect(f.mobs.filter(m => m.boss).map(m => m.name)).toEqual(['꾸벅', '끄덕']);
      skillOn(f, 'spear');
      steps(f, 0.1);
      const t = tels(f, 'spear');
      expect(t.find(x => !x.fake)!.units, `${mythic}`).toHaveLength(real);
      expect(t.find(x => x.fake)!.units).toHaveLength(1);
      expect(new Set(t.flatMap(x => x.units)).size).toBe(real + 1);
    }
    const f = boss('kkubeok');
    const e0 = f.empower;
    const first = f.mobs.find(m => m.boss)!;
    first.hp = 0; first.alive = false;
    steps(f, 0.2);
    expect(f.empower).toBeCloseTo(e0 + 0.3, 6);
  });
  it('혹돌이: 매운 재채기 (옮겨붙는 질병) 2명 · 악몽 3명, 신기루 짐더미는 장판 두 곳 (하나는 가짜)', () => {
    for (const [mythic, n] of [[false, 2], [true, 3]] as const) {
      const f = boss('hokdol', mythic);
      skillOn(f, 'sneeze');
      steps(f, 0.1);
      const hit = f.party.filter(u => u.debuffs.some(d => d.name === '매운 재채기' && d.end?.p === 'jump'));
      expect(hit, `${mythic}`).toHaveLength(n);
      expect(hit.some(u => u.role === 'tank' || u.me)).toBe(false);
    }
    const f = boss('hokdol');
    skillOn(f, 'pile');
    steps(f, 0.1);
    const t = tels(f, 'pile');
    expect(t).toHaveLength(2);
    expect(t.filter(x => x.fake)).toHaveLength(1);
    steps(f, 2.05);
    expect(tels(f, 'pile')).toHaveLength(1);
  });
  it('냥크스: 수수께끼 숫자 셋 + 신기루 숫자 (5초 뒤 걷힘), 40% 아래 숫자 넷, 신기루 꼬리는 광역 반이 가짜', () => {
    const f = boss('nyanx');
    skillOn(f, 'riddle');
    steps(f, 2.1);
    expect(f.order!.ids).toHaveLength(3);
    const fake = f.order!.fake!;
    expect(fake.num).toBeGreaterThanOrEqual(1);
    expect(f.order!.ids.includes(fake.id)).toBe(false);
    steps(f, 5);
    expect(f.order?.fake).toBeUndefined();
    const g = boss('nyanx');
    g.bossHp = g.bossMax * 0.39;
    steps(g, 0.1);
    expect(g.phase).toBe(2);
    expect(g.bs.riddle.active(g)).toBe(false);
    steps(g, 6.1);
    expect(g.order!.ids).toHaveLength(4);
    let fakes = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const h = quiet(E.create({ encounter: 'nyanx', diff: '보통', seed }));
      skillOn(h, 'tail');
      steps(h, 0.1);
      if (tels(h, 'tail')[0]?.fake) fakes++;
    }
    expect(fakes).toBeGreaterThan(8);
    expect(fakes).toBeLessThan(32);
  });
});

describe('물밑 계단 · 20인 ② 물밑 수도원', () => {
  it('흐물이: 빛 고리 탐험 1명 · 20인 3명 (악몽 5명), 물방울 진동', () => {
    for (const [enc, mythic, n] of [['heumul72', false, 1], ['heumul', false, 3], ['heumul', true, 5]] as const) {
      const f = boss(enc, mythic);
      skillOn(f, 'ring');
      steps(f, 0.1);
      expect(f.zones.filter(z => z.ring), `${enc} ${mythic}`).toHaveLength(n);
    }
    const f = boss('heumul');
    skillOn(f, 'tentacle');
    steps(f, 0.1);
    expect(f.party.filter(u => u.debuffs.some(d => d.name === '촉수 자국' && d.healCut === 0.2))).toHaveLength(5);
  });
  it('비추미: 거울 책장 표시 3명 (진짜 1 · 악몽 진짜 2 표시 4명), 조용히! 는 걷히기 0.5초 전에 맞음', () => {
    for (const [mythic, real, shown] of [[false, 1, 3], [true, 2, 4]] as const) {
      const f = boss('bichumi', mythic);
      skillOn(f, 'shelf');
      steps(f, 0.1);
      const t = tels(f, 'shelf');
      expect(t.find(x => !x.fake)!.units, `${mythic}`).toHaveLength(real);
      expect(new Set(t.flatMap(x => x.units)).size).toBe(shown);
    }
    const f = boss('bichumi');
    skillOn(f, 'shelf'); skillOn(f, 'hush');
    steps(f, 0.1);
    const shelf = tels(f, 'shelf').find(x => !x.fake)!, hush = tels(f, 'hush')[0];
    expect(shelf.veil! - hush.impact).toBeCloseTo(0.5, 6);
  });
  it('깊은잠: 잠의 표식 3명 12초 (악몽 10초) → 65% 깊은 물 장판 셋 · 가장자리 구멍 · 표식 4명 → 35% 심장 박동', () => {
    for (const [mythic, sec] of [[false, 12], [true, 10]] as const) {
      const f = boss('gipeun', mythic);
      skillOn(f, mythic ? 'markm' : 'mark');
      steps(f, 0.1);
      const marked = f.party.filter(u => u.debuffs.some(d => d.name === '잠의 표식'));
      expect(marked, `${mythic}`).toHaveLength(3);
      expect(marked[0].debuffs.find(d => d.name === '잠의 표식')!.left).toBeCloseTo(sec - 0.1, 0);
    }
    const f = boss('gipeun');
    f.bossHp = f.bossMax * 0.64;
    steps(f, 0.1);
    expect([f.phase, f.phaseName]).toEqual([2, '2페이즈 · 무너지는 제단']);
    steps(f, 3.1);
    expect(f.tels.filter(t => t.skill.key.startsWith('deep'))).toHaveLength(3);
    steps(f, 3.5);
    expect(f.cells.filter(c => c.block === 'hole')).toHaveLength(2);
    f.bossHp = f.bossMax * 0.34;
    steps(f, 0.1);
    expect(f.phase).toBe(3);
    expect(f.bs.beat.next).toBeLessThan(Infinity);
  });
});

describe('던전 ⑮ 모래시계 궁전', () => {
  it('데굴이: 모래시계를 뒤집으면 창 안 2초 · 6초에 데굴데굴, 8초 뒤 체력이 되돌아감 (악몽은 데굴데굴이 더 아픔)', () => {
    const hurt: number[] = [];
    for (const mythic of [false, true]) {
      const f = boss('degul', mythic);
      const u = f.party.find(x => x.role === 'ranged')!;
      u.base = u.max = 5000; u.hp = u.max * 0.9;
      skillOn(f, 'glass');
      steps(f, 3.05);
      expect(f.glass).toHaveLength(1);
      steps(f, 2.05);
      hurt.push(u.max * 0.9 - u.hp);
      expect(u.hp).toBeLessThan(u.max * 0.9);
      steps(f, 4);
      expect(u.hp).toBeLessThan(u.max * 0.9 - hurt[hurt.length - 1]);
      steps(f, 2.1);
      expect(f.glass).toHaveLength(0);
      expect(u.hp / u.max).toBeCloseTo(0.9, 6);
    }
    expect(hurt[1]).toBeGreaterThan(hurt[0]);
  });
  it('둘둘이: 칭칭 붕대 2명 (40% 아래 3명), 집사의 모래시계 창 3초에 조용히 하세요, 악몽은 붕대가 남은 사람 더 아픔', () => {
    const f = boss('dooldool');
    skillOn(f, 'wrap');
    steps(f, 0.1);
    const wrapped = f.party.filter(u => u.debuffs.some(d => d.name === '칭칭 붕대' && (d.absorbLeft ?? 0) > 0));
    expect(wrapped).toHaveLength(2);
    skillOn(f, 'glass');
    steps(f, 3.05);
    expect(f.glass).toHaveLength(1);
    steps(f, 1.5);
    const hush = f.tels.find(t => t.skill.key === 'hush')!;
    expect(hush.impact - f.glass[0].at).toBeCloseTo(3, 1);
    steps(f, 6.6);
    expect(wrapped.every(u => u.debuffs.some(d => d.name === '칭칭 붕대'))).toBe(true); // 되돌려도 붕대는 남음
    f.bossHp = f.bossMax * 0.39;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect(f.bs.glass.period).toBe(24);
    steps(f, 3.1);
    expect(f.party.filter(u => u.debuffs.some(d => d.name === '칭칭 붕대')).length).toBeGreaterThanOrEqual(3);
    for (const [mythic, more] of [[false, false], [true, true]] as const) {
      const g = boss('dooldool', mythic);
      skillOn(g, 'wrap');
      steps(g, 0.1);
      const w = g.party.find(u => u.debuffs.some(d => d.name === '칭칭 붕대'))!;
      skillOn(g, mythic ? 'glassm' : 'glass');
      steps(g, 3.05);
      w.hp = w.max;
      g.bs.hush.next = Infinity;
      g.tels = g.tels.filter(t => t.skill.key !== 'hush');
      const rec = g.glass[0].rec.get(w.id)!;
      steps(g, 8.1);
      expect(w.hp < rec * w.max - 1, `${mythic}`).toBe(more);
    }
  });
});
