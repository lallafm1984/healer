/** 묶음 D1 불꽃 봉우리 (51 1장 · 3장 · 4-1): 탐험 ⑯ 화산재 고갯길, 던전 ⑬ 용암 온천장 · ⑭ 용암 대장간, 10인 ⑧ 코볼트 보물 굴 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/bosses';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { artPlaces, CONTENT_PLACE, PLACES } from '../src/data/places';
import { PLACE_KINDS } from '../src/data/equipment';
import { FEATURED, NAMED } from '../src/data/specials';
import { UNIQUES } from '../src/data/uniques';
import * as E from '../src/engine';
import { runOnce } from '../src/sim/balance';
import { aggroTarget } from '../src/engine/bossParts';

type F = ReturnType<typeof E.create>;
const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); return f; };
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
const skillOn = (f: F, key: string) => { const s = f.bs[key]; s.next = f.t; return s; };
const boss = (encounter: E.FightConfig['encounter'], mythic = false) => quiet(E.create({ encounter, diff: mythic ? '악몽' : '보통', seed: 3 }));
const RAIDS = [['den1', 'kkojil'], ['den2', 'deolkeong'], ['den3', 'beonjjeok']] as const;

describe('콘텐츠', () => {
  it('탐험 ⑯ Lv 64 · 던전 ⑬ Lv 65 · ⑭ Lv 70, 대장간만 옛 세력 버려진 골렘 (해제 없음)', () => {
    const a = contentOf('ashpass'), b = contentOf('hotspring'), c = contentOf('forge');
    expect([a.kind, a.unlockLv, a.size('보통'), a.ready]).toEqual(['explore', 64, 3, true]);
    expect([b.kind, b.unlockLv, b.size('보통'), b.ready]).toEqual(['dungeon', 65, 5, true]);
    expect([c.kind, c.unlockLv, c.size('보통'), c.ready]).toEqual(['dungeon', 70, 5, true]);
    expect(a.fights('보통')).toEqual(['warmash', 'mungsil64']);
    expect(b.fights('보통')).toEqual(['steamroom', 'mungsil', 'lavabath', 'bulttung']);
    expect(c.fights('보통')).toEqual(['coldhearth', 'huggeun', 'anvilbridge', 'ttangttang']);
    expect([PLACES[CONTENT_PLACE.ashpass].faction, PLACES[CONTENT_PLACE.hotspring].faction, PLACES[CONTENT_PLACE.forge].faction]).toEqual(['dragon', 'dragon', 'golem']);
    expect(ENCOUNTERS.mungsil64.board).toBe('b7');
    // 그림이 오기 전: 용 일가는 불꽃 봉우리 기슭, 대장간은 녹슨 요새를 빌림 (52 1장)
    expect([artPlaces('ashpass'), artPlaces('hotspring'), artPlaces('forge')]).toEqual([['ashpass', 'emberfoot'], ['hotspring', 'emberfoot'], ['forge', 'rustfort']]);
  });
  it('10인 ⑧: 칸마다 보스 하나, Lv 63 · 악몽 78, 그림은 보물 굴 첫 칸', () => {
    for (const [key, enc] of RAIDS) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 63, 10, { '악몽': 78 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(artPlaces(CONTENT_PLACE[key])).toContain('den');
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('dragon');
    }
  });
  it('드롭: 종류 · 자주 나오는 특수능력 · 이름 있는 장신구 4 · 고유 장비 4', () => {
    for (const k of ['ashpass', 'hotspring', 'forge', 'den1', 'den2', 'den3']) {
      expect(PLACE_KINDS[k]?.length, k).toBeGreaterThan(0);
      expect(FEATURED[k], k).toHaveLength(3);
    }
    expect(['den3', 'ashpass', 'hotspring', 'forge'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['koboldWarrant', 'warmPebble', 'spaTowel', 'coldAnvil']);
    expect(['den1', 'den2', 'hotspring', 'forge'].map(p => UNIQUES.find(u => u.place === p)?.key)).toEqual(['kkojilCoat', 'cartGloves', 'sulkyPlume', 'anvilHelm']);
  });
});

describe('던전 보스', () => {
  it('뭉실: 김 서린 수건 8초 열기, 끝나는 순간 뜨거운 김. 악몽은 열기 동안 받는 치유 −15%', () => {
    const f = boss('mungsil');
    const sk = (k: string) => BOSSES.mungsil.skills.find(x => x.key === k)!;
    expect(sk('steam').first! + sk('steam').cast - sk('melt').first!).toBe(8);
    skillOn(f, 'melt');
    steps(f, 0.1);
    expect(f.melt).toMatchObject({ name: '김 서린 수건', rate: 0.25 });
    expect(f.party.some(u => u.debuffs.some(d => d.name === '김 서림'))).toBe(false);
    const m = boss('mungsil', true);
    skillOn(m, 'melt'); skillOn(m, 'meltm');
    steps(m, 0.1);
    expect(m.party.filter(u => u.alive).every(u => u.debuffs.some(d => d.name === '김 서림' && d.healCut === 0.15))).toBe(true);
  });
  it('불퉁이: 반짝이 내놔! 1명 → 40% 아래 2명 · 숨 20초. 악몽은 맞은 사람에게 그을음 (독)', () => {
    const f = boss('bulttung');
    expect(f.bs.greed1.target!(f)).toHaveLength(1);
    f.bossHp = f.bossMax * 0.39;
    steps(f, 2.1);
    expect(f.phase).toBe(2);
    expect(f.bs.greed2.target!(f)).toHaveLength(2);
    expect(f.bs.melt.period).toBe(20);
    const m = boss('bulttung', true);
    const tel = { units: [m.party.find(u => u.role === 'ranged')!.id] } as unknown as E.Telegraph;
    m.bs.greed1m.hit!(m, tel);
    expect(m.party.find(u => u.id === tel.units[0])!.debuffs.some(d => d.name === '그을음' && d.type === '독')).toBe(true);
  });
  it('후끈이: 달군 쇠 4중첩이면 근접 딜러가 6초 대신 맞음 (악몽 3중첩)', () => {
    for (const [mythic, n] of [[false, 4], [true, 3]] as const) {
      const f = boss('huggeun', mythic);
      const tk = f.party.find(u => u.role === 'tank')!;
      const s = f.bs[mythic ? 'ironm' : 'iron'];
      for (let i = 0; i < n; i++) { s.next = f.t; E.step(f); f.events.length = 0; }
      expect(aggroTarget(f)!.role, `${mythic}`).toBe('melee');
      expect(tk.debuffs.some(d => d.name === '달군 쇠')).toBe(false);
      steps(f, 6.1);
      expect(aggroTarget(f)).toBe(tk);
    }
  });
  it('땅땅: 반짝반짝 2명 · 담금질 (악몽 실패 딜체 80%) · 30% 아래 쇳물 바다 (가장자리)', () => {
    const f = boss('ttangttang'), m = boss('ttangttang', true);
    expect(f.bs.greed.target!(f)).toHaveLength(2);
    expect(f.bs.stagger.active(f)).toBe(true);
    expect(m.bs.staggerm.active(m)).toBe(true);
    expect(m.bs.stagger.active(m)).toBe(false);
    f.bossHp = f.bossMax * 0.29;
    steps(f, 2.1);
    expect(f.phase).toBe(2);
    expect(f.bs.stagger.period).toBe(30);
    expect(f.bs.sea.next).toBeLessThan(Infinity);
  });
});

describe('10인 ⑧', () => {
  it('꼬질: 곡괭이 자국 5중첩이면 부탱커가 가져감, 불씨 꼬마 용 2 → 50% 아래 3, 악몽은 터질 때 모두 독 연기', () => {
    const f = boss('kkojil');
    const [a, b] = f.party.filter(u => u.role === 'tank');
    for (let i = 0; i < 5; i++) { f.bs.pick.next = f.t; E.step(f); f.events.length = 0; }
    expect(aggroTarget(f)).toBe(b);
    expect(a.debuffs.find(d => d.name === '곡괭이 자국')?.stack).toBe(5);
    skillOn(f, 'whelp1');
    steps(f, 0.1);
    expect(f.mobs.filter(x => x.alive && x.name === '불씨 꼬마 용')).toHaveLength(2);
    const m = boss('kkojil', true);
    skillOn(m, 'whelp1m');
    steps(m, 8.2);
    expect(m.party.filter(u => u.alive).every(u => u.debuffs.some(d => d.name === '독 연기'))).toBe(true);
  });
  it('덜컹이: 금화 던지기 2명 + 무거운 주머니, 악몽만 돌아오는 수레', () => {
    const f = boss('deolkeong'), m = boss('deolkeong', true);
    expect(f.bs.coin.target!(f)).toHaveLength(2);
    expect(f.bs.cartm.active(f)).toBe(false);
    expect(m.bs.cartm.active(m)).toBe(true);
  });
  it('번쩍이: 금화 더미 · 쫄쫄이 부하 (사냥), 30% 아래 보물 비 · 내 거야! 3명', () => {
    const f = boss('beonjjeok');
    skillOn(f, 'hoard');
    steps(f, 0.1);
    expect(f.mobs.filter(x => x.alive && x.name === '금화 더미')).toHaveLength(1);
    f.bossHp = f.bossMax * 0.29;
    steps(f, 2.1);
    expect(f.phase).toBe(2);
    expect(f.bs.greed2.target!(f)).toHaveLength(3);
    expect(f.bs.rain.next).toBeLessThan(Infinity);
  });
});

describe('자동 힐러', () => {
  for (const [dungeon, level] of [['ashpass', 64], ['hotspring', 65], ['forge', 70]] as const) {
    it(`${dungeon} Lv ${level}: 보통이면 거의 다 깸 (장비 없음)`, () => {
      let wins = 0;
      for (let s = 1; s <= 20; s++) if (runOnce(contentOf(dungeon), '보통', 'priest', s).win) wins++; // 자동 밸런스 기준: 장비 없음 · 열린 특성 · 능력 1개 · 물약, 치유 배율 0.6 (34 1-6) 뒤로 특성 없는 사제는 높은 레벨에서 많이 짐 (레벨 = 열림 레벨)
      expect(wins).toBeGreaterThanOrEqual(19);
    }, 20_000); // 자동 밸런스 기준 20판은 CI 기본 5초를 넘을 수 있음
  }
});
