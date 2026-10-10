/** 묶음 C 반딧불 버섯숲 (48 1장 · 3장 · 4장): 탐험 ⑬~⑮, 던전 ⑪ ⑫, 10인 ⑤ 요정 축제 마당 · ⑥ 포자 동굴 정원 · ⑦ 버섯 여왕의 궁전 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES, type SkillEffect } from '../src/data/bosses';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, CONTENT_PLACE, FACTIONS, PLACES } from '../src/data/places';
import * as E from '../src/engine';
import { runOnce } from '../src/sim/balance';
import { damage, heal, living } from '../src/engine/core';
import { doDispel } from '../src/engine/heroes';

type F = ReturnType<typeof E.create>;
const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); return f; };
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const effectOf = (boss: keyof typeof BOSSES, key: string) => BOSSES[boss].skills.find(s => s.key === key)!.effect as SkillEffect;
const skillOn = (f: F, key: string) => { const s = f.bs[key]; s.next = f.t; return s; };
const HAT_NAMES = ['실크해트', '고깔모자', '왕관 모자'];
const RAIDS = [
  ['fest1', 'songi', 'fest', 51], ['fest2', 'pililli', 'fest', 51], ['fest3', 'ponga', 'fest', 51],
  ['cave1', 'mungge', 'sporecave', 55], ['cave2', 'gaegul', 'sporecave', 55], ['cave3', 'morak', 'sporecave', 55],
  ['palace1', 'bungbung', 'palace', 59], ['palace2', 'ppyong', 'palace', 59], ['palace3', 'amanita', 'palace', 59],
] as const;
const tanks = (f: F) => f.party.filter(u => u.role === 'tank');

describe('콘텐츠', () => {
  it('새 세력 버섯 요정단 (질병 + 마법) · 붉은 용 일가 (독 + 마법), 던전 ⑫는 옛 세력 늪의 부족', () => {
    expect(FACTIONS.fairy.dispel).toEqual(['질병', '마법']);
    expect(FACTIONS.dragon.dispel).toEqual(['독', '마법']);
    expect(PLACES[CONTENT_PLACE.lampway].faction).toBe('fairy');
    expect(PLACES[CONTENT_PLACE.teaparty].faction).toBe('fairy');
    expect(PLACES[CONTENT_PLACE.emberfoot].faction).toBe('dragon');
    expect(PLACES[CONTENT_PLACE.mossroot].faction).toBe('swamp');
    for (const k of ['rainbow', ...RAIDS.map(r => r[0])] as const) expect(PLACES[CONTENT_PLACE[k]].faction, k).toBe('fairy');
  });
  it('탐험 ⑭ 무지개 버섯밭 Lv 56: 꽃가루 들판 → 버섯 여왕 아마니타, 그림은 꼬마등 오솔길을 빌림', () => {
    const c = contentOf('rainbow');
    expect([c.kind, c.unlockLv, c.size('보통'), c.ready]).toEqual(['explore', 56, 3, true]);
    expect(c.fights('보통')).toEqual(['pollenfield', 'queen56']);
    expect(artPlaces(CONTENT_PLACE.rainbow).at(-1)).toBe('lampway');
  });
  it('10인 ⑤~⑦: 칸마다 보스 하나, 악몽은 열림 + 15, 이름 끝 한 낱말로 칸을 나눔, 그림은 레이드마다 같은 자리', () => {
    for (const [key, enc, art, lv] of RAIDS) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock, c.ready], key).toEqual(['raid', lv, 10, { '악몽': lv + 15 }, true]);
      expect(c.fights('악몽')).toEqual([enc]);
      expect(c.name.split(' ').length).toBeGreaterThanOrEqual(4);
      expect(artPlaces(CONTENT_PLACE[key]).at(-1)).toBe(art);
    }
    expect(contentOf('palace3').bosses).toEqual(['버섯 여왕 아마니타']);
  });
  it('레이드 보스는 모두 5 × 5 판 (25칸), 10인 · 탱커 둘, 광폭화 시간이 있음', () => {
    for (const [, enc] of RAIDS) {
      const f = E.create({ encounter: enc, diff: '보통', seed: 1 });
      expect(f.board, enc).toBe('b25');
      expect(f.party.length).toBe(10);
      expect(tanks(f).length).toBe(2);
      expect(ENCOUNTERS[enc].enrage, enc).toBeGreaterThan(300);
    }
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
  it('무지개 버섯밭 여왕: 숲 할아버지 묘목 (사람 칸), 채우면 보스가 받는 피해 +25%', () => {
    const f = quiet(E.create({ encounter: 'queen56', diff: '보통', seed: 2, level: 56 }));
    skillOn(f, 'sapling');
    steps(f, 0.1);
    expect(f.souls).toHaveLength(1);
    heal(f, f.souls[0], 1e6, true, true);
    E.step(f);
    expect(f.souls).toHaveLength(0);
    expect(f.expose?.vuln).toBeCloseTo(1.25);
    steps(f, 12.1);
    expect(f.expose).toBeNull();
  });
  it('자동 힐러, 보통이면 거의 다 깸 (장비 없음)', () => {
    for (const [dungeon, level] of [['lampway', 52], ['rainbow', 56], ['emberfoot', 60]] as const) {
      let wins = 0;
      for (let s = 1; s <= 20; s++) if (runOnce(contentOf(dungeon), '보통', 'priest', s).win) wins++; // 자동 밸런스 기준: 장비 없음 · 열린 특성 · 능력 1개 · 물약, 치유 배율 0.6 (34 1-6) 뒤로 특성 없는 사제는 높은 레벨에서 많이 짐 (레벨 = 열림 레벨)
      expect(wins, `${dungeon} Lv ${level}`).toBeGreaterThanOrEqual(19);
    }
  }, 20_000); // 자동 밸런스 기준 20판은 CI 기본 5초를 넘을 수 있음
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
    expect(got[0].debuffs.find(d => HAT_NAMES.includes(d.name))!.art).toMatch(/^icon-gim-hat-(invert|cap|full)$/);
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

describe('10인 레이드 보스', () => {
  it('송이: 요정 고리 1개 → 50% 아래 2개, 악몽 최대 3겹', () => {
    const f = quiet(E.create({ encounter: 'songi', diff: '보통', seed: 3 }));
    skillOn(f, 'ring');
    steps(f, 0.1);
    expect(f.zones.filter(z => z.ring)).toHaveLength(1);
    f.bossHp = f.bossMax * 0.49;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect([f.bs.ring.active(f), f.bs.ring2.active(f)]).toEqual([false, true]);
    expect(effectOf('songi', 'ring2')).toMatchObject({ n: 2, maxMythic: 3 });
  });
  it('삘릴리: 춤바람은 딜러 2명을 떨어뜨리고 (원거리 65%, 근접은 덜) 딜 0 · 못 움직임, 가득 차면 멈춤', () => {
    const f = quiet(E.create({ encounter: 'pililli', diff: '보통', seed: 4, tune: {} })); // 난이도 보정 (data/tune) 없이
    f.party.forEach(u => { u.hp = u.max; });
    skillOn(f, 'dance');
    steps(f, 0.1);
    const got = f.party.filter(u => u.debuffs.some(d => d.name === '춤바람'));
    expect(got).toHaveLength(2);
    for (const u of got) {
      expect(u.role).not.toBe('tank');
      expect(u.hp / u.max).toBeLessThan(u.role === 'melee' ? 0.8 : 0.7);
      expect(u.debuffs.find(d => d.name === '춤바람')).toMatchObject({ noDps: true, noMove: true, cureAt: 1 });
    }
    heal(f, got[0], got[0].max, true, true);
    steps(f, 0.1);
    expect(got[0].debuffs.some(d => d.name === '춤바람')).toBe(false);
    const m = quiet(E.create({ encounter: 'pililli', diff: '악몽', seed: 4 }));
    skillOn(m, 'dance'); skillOn(m, 'troupe');
    steps(m, 0.1);
    expect(m.party.filter(u => u.debuffs.some(d => d.name === '춤바람'))).toHaveLength(3);
    expect(m.mobs.filter(x => x.alive && x.name === '꽃가루 무용수')).toHaveLength(4);
  });
  it('퐁가: 포자 구름 안전 칸에 요정 고리 칸은 없음, 30% 아래 폭죽 통 3 · 구름 24초', () => {
    const f = quiet(E.create({ encounter: 'ponga', diff: '보통', seed: 5 }));
    skillOn(f, 'ring');
    steps(f, 0.1);
    const ringed = new Set(f.zones.filter(z => z.ring).flatMap(z => [...z.cells]));
    expect(ringed.size).toBe(2);
    skillOn(f, 'cloud');
    steps(f, 0.1);
    const t = f.tels.find(x => x.skill.name === '퐁! 포자 구름')!;
    expect([...(t.safe ?? [])].some(i => ringed.has(i))).toBe(false);
    f.bossHp = f.bossMax * 0.29;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect(f.bs.cloud.period).toBe(24);
    skillOn(f, 'keg3');
    steps(f, 0.1);
    expect(f.mobs.filter(m => m.alive && m.name === '폭죽 통')).toHaveLength(3);
  });
  it('뭉게: 솜뭉치 2명 → 50% 아래 3명, 무력화 게이지 선 70% (악몽 75%)', () => {
    expect(effectOf('mungge', 'stagger')).toMatchObject({ hp: 0.7, hpMythic: 0.75 });
    const f = quiet(E.create({ encounter: 'mungge', diff: '보통', seed: 6 }));
    skillOn(f, 'spore');
    steps(f, 0.1);
    expect(f.party.filter(u => u.debuffs.some(d => d.end?.p === 'pass'))).toHaveLength(2);
    f.bossHp = f.bossMax * 0.49;
    steps(f, 0.1);
    expect(f.bs.spore2.active(f)).toBe(true);
  });
  it('개굴: 혀로 끌려온 사람은 탱커와 연잎 사슬 (나눔형), 악몽은 둘 다 받는 피해 +10%', () => {
    for (const diff of ['보통', '악몽'] as const) {
      const f = quiet(E.create({ encounter: 'gaegul', diff, seed: 7 }));
      skillOn(f, 'tongue');
      steps(f, 2.2);
      const tied = f.party.filter(u => u.debuffs.some(d => d.name === '연잎 사슬'));
      expect(tied, diff).toHaveLength(2);
      expect(tied.filter(u => u.role === 'tank')).toHaveLength(1);
      expect(f.links[0].kind).toBe('share');
      expect(tied[0].debuffs.find(d => d.name === '연잎 사슬')!.vuln ?? 0).toBeCloseTo(diff === '악몽' ? 0.1 : 0);
      // 탱커가 맞은 피해는 탱커 방어력으로 줄인 뒤 반씩 (34 9-3): 끌려온 딜러도 탱커와 같은 양
      const tk = tied.find(u => u.role === 'tank')!, dd = tied.find(u => u.role !== 'tank')!;
      tk.hp = tk.max; dd.hp = dd.max;
      damage(f, tk, 300, false, 'tank');
      expect(dd.max - dd.hp).toBeCloseTo(tk.max - tk.hp);
      expect(tk.max - tk.hp).toBeCloseTo(150 * f.dmgMult * (1 + (diff === '악몽' ? 0.1 : 0)));
    }
  });
  it('모락: 버섯 화분이 보스를 치유 (3초마다 0.3%), 30% 아래 화분 3 · 0.45%', () => {
    const f = quiet(E.create({ encounter: 'morak', diff: '보통', seed: 8 }));
    skillOn(f, 'pots');
    steps(f, 0.1);
    expect(f.mobs.filter(m => m.alive && m.name === '버섯 화분')).toHaveLength(2);
    f.bossHp = f.bossMax * 0.5;
    steps(f, 3.05);
    expect(f.bossHp / f.bossMax).toBeCloseTo(0.5 + 2 * 0.003, 4);
    expect(effectOf('morak', 'pots3')).toMatchObject({ n: 3, add: { job: { pct: 0.0045 } } });
  });
  it('붕붕: 꿀벌 떼가 탱커 아닌 사람을 쏘고, 쏘인 사람은 90% 아래인 동안 벌침이 쌓임 (못 지움)', () => {
    const f = quiet(E.create({ encounter: 'bungbung', diff: '보통', seed: 9 }));
    f.party.forEach(u => { u.hp = u.max * 0.5; });
    skillOn(f, 'swarm');
    steps(f, 0.1);
    expect(f.mobs.filter(m => m.alive && m.name === '근위 꿀벌')).toHaveLength(5);
    steps(f, 2.1);
    const stung = f.party.filter(u => u.debuffs.some(d => d.name === '벌침'));
    expect(stung.length).toBeGreaterThan(0);
    expect(stung.every(u => u.role !== 'tank')).toBe(true);
    expect(stung.every(u => u.debuffs.filter(d => d.name === '벌침').length === 1)).toBe(true);
    expect(stung[0].debuffs.find(d => d.name === '벌침')).toMatchObject({ lock: true, cureAt: 0.9 });
    expect(effectOf('bungbung', 'swarmm')).toMatchObject({ add: { job: { debuff: { grow: { max: 7 } } } } });
  });
  it('뿅뿅: 거꾸로 마술은 차례 번호를 받은 사람 (나 빼고)에게 먼저', () => {
    const f = quiet(E.create({ encounter: 'ppyong', diff: '보통', seed: 10 }));
    skillOn(f, 'clap');
    steps(f, 0.1);
    const ids = f.order!.ids;
    expect(ids).toHaveLength(3);
    skillOn(f, 'flip');
    steps(f, 0.1);
    const flipped = f.party.filter(u => u.debuffs.some(d => d.name === '거꾸로 마술'));
    expect(flipped).toHaveLength(1);
    expect(flipped[0].me).toBe(false);
    if (ids.some(id => !f.party.find(u => u.id === id)!.me)) expect(ids).toContain(flipped[0].id);
    expect(effectOf('ppyong', 'clapm')).toMatchObject({ sec: 8 });
  });
  it('아마니타: 70% 숲 할아버지 나무 (사람 칸 큰 판, 질병 해제로 바로 깸) → 40% 영원한 축제 (10초마다 +5%)', () => {
    const f = E.create({ encounter: 'amanita', diff: '보통', seed: 11, hero: 'priest' });
    f.party.forEach(u => { u.dps = 0; });
    f.bossHp = f.bossMax * 0.69;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    f.skills.forEach(s => { s.next = Infinity; });
    skillOn(f, 'tree');
    steps(f, 0.1);
    expect(f.souls).toHaveLength(1);
    const tree = f.souls[0];
    const ref = f.party.filter(u => u.role !== 'tank' && !u.me);
    expect(tree.max).toBeCloseTo(2 * ref.reduce((a, u) => a + u.base, 0) / ref.length);
    expect(tree.hp / tree.max).toBeCloseTo(0.3);
    doDispel(f, tree);
    E.step(f);
    expect(f.souls).toHaveLength(0);
    expect(f.expose?.vuln).toBeCloseTo(1.25);
    f.bossHp = f.bossMax * 0.39;
    steps(f, 0.1);
    expect(f.phase).toBe(3);
    f.skills.forEach(s => { if (s.key !== 'party') s.next = Infinity; });
    const e0 = f.empower;
    f.invuln = true;
    steps(f, 10.5);
    expect(f.empower - e0).toBeCloseTo(0.05, 6);
    expect(living(f).length).toBeGreaterThan(0);
  });
  it('아마니타 악몽: 나무가 20%로 나오고 2페이즈에도 요정 고리', () => {
    const f = E.create({ encounter: 'amanita', diff: '악몽', seed: 12 });
    f.party.forEach(u => { u.dps = 0; });
    f.bossHp = f.bossMax * 0.69;
    steps(f, 0.1);
    f.skills.forEach(s => { s.next = Infinity; });
    skillOn(f, 'tree');
    steps(f, 0.1);
    expect(f.souls[0].hp / f.souls[0].max).toBeCloseTo(0.2);
    expect(f.bs.ringm.active(f)).toBe(true);
  });
});
