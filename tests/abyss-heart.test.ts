/**
 * 묶음 G3 (59 1장 · 3-2 · 4-4 · 6장): 20인 ⑩ 심연의 심장 (얽힘: 빌린 생명 × 생명 사슬 · 되살아난 군주: 세력 기믹 다시 보기 · 심연의 심장: 퍼지는 박동 · 크게 뛰기 · 번개 쐐기),
 * 탐험 ㉕ 새벽 호숫길 (심장 조각) · 던전 ⑳ 멈춘 심장 속 (녹슬음 · 마지막 그림자: 지우면 빚)
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/bosses';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { PLACE_KINDS } from '../src/data/equipment';
import { CONTENT_PLACE, PLACES } from '../src/data/places';
import { FEATURED, NAMED } from '../src/data/specials';
import { UNIQUES } from '../src/data/uniques';
import * as E from '../src/engine';
import { applyDebuff } from '../src/engine/bossParts';
import { hasAbsorb, heal, onDebuffEnd } from '../src/engine/core';
import { hasteOf, healSpec } from '../src/engine/specials';
import { ENDING } from '../src/data/story';
import type { DebuffDef } from '../src/data/bosses';
import type { FightEvent, Unit } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); return f; };
const steps = (f: F, sec: number, seen: FightEvent[] = []) => {
  const end = f.t + sec;
  while (f.t < end - 1e-9 && !f.over) { E.step(f); seen.push(...f.events); f.events.length = 0; }
  return seen;
};
const skillOn = (f: F, key: string) => { const s = f.bs[key]; s.next = f.t; return s; };
const boss = (encounter: E.FightConfig['encounter'], mythic = false, specs?: E.FightConfig['specs']) =>
  quiet(E.create({ encounter, diff: mythic ? '악몽' : '보통', seed: 3, hero: 'priest', specs }));
const tels = (f: F, key: string) => f.tels.filter(t => t.skill.key === key);
const skill = (b: keyof typeof BOSSES, key: string) => BOSSES[b].skills.find(s => s.key === key)!;
const debtOf = (u: Unit) => u.debuffs.find(d => d.debt);
const HEART = [['heart1', 'eongkim'], ['heart2', 'revlord'], ['heart3', 'abyssheart']] as const;
const toPhase = (f: F, hp: number) => { f.bossHp = f.bossMax * hp; E.step(f); f.events.length = 0; };
const owe = (f: F, b: keyof typeof BOSSES, key = 'loan') => {
  const u = f.party.find(x => !x.me && x.role !== 'tank' && !debtOf(x))!;
  u.hp = u.max * 0.5;
  applyDebuff(f, u, (skill(b, key).effect as { debuff: DebuffDef }).debuff);
  return u;
};

describe('콘텐츠', () => {
  it('20인 ⑩ 심연의 심장: Lv 97 · 악몽 100, 36칸 판, 심연의 정예', () => {
    for (const [key, enc] of HEART) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 97, 20, { '악몽': 100 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc]).toMatchObject({ board: 'b36', big: true });
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('deep');
    }
  });
  it('탐험 ㉕ 새벽 호숫길 · 던전 ⑳ 멈춘 심장 속 (Lv 100)', () => {
    const d = contentOf('dawn'), h = contentOf('heartcrack');
    expect([d.kind, d.unlockLv, d.fights('보통')]).toEqual(['explore', 100, ['dawntrash', 'heartshard100']]);
    expect([h.kind, h.unlockLv, h.fights('보통')]).toEqual(['dungeon', 100, ['cracktrash', 'nokseul', 'coolroot', 'lastshade']]);
    expect(ENCOUNTERS.heartshard100.board).toBe('b7');
    expect([ENCOUNTERS.nokseul.board, ENCOUNTERS.lastshade.board]).toEqual(['b10', 'b10']);
  });
  it('드롭: 레이드 칸마다 종류 1 · 탐험 2 · 던전 3, 이름 있는 장신구 3, 고유 장비 3', () => {
    for (const [k] of HEART) {
      expect(PLACE_KINDS[k], k).toHaveLength(1);
      expect(FEATURED[k], k).toHaveLength(3);
    }
    expect([PLACE_KINDS.dawn.length, PLACE_KINDS.heartcrack.length]).toEqual([2, 3]);
    expect(['heart3', 'dawn', 'heartcrack'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['stillHeart', 'dawnPebble', 'shadowScale']);
    expect(['heart1', 'heart2', 'heartcrack'].map(p => UNIQUES.find(u => u.place === p)?.key)).toEqual(['tangleGauntlet', 'lordCrown', 'scaleRobe']);
  });
  it('엔딩 글: 심장을 처음 멈추면 한 장, 앱 글은 「~요」로 끝나지 않음', () => {
    expect(ENDING.length).toBeGreaterThanOrEqual(3);
    expect(ENDING.every(t => !/요[.!]?$/.test(t))).toBe(true);
    expect(ENDING.join(' ')).toContain('햇살 축제');
  });
});

describe('심연의 심장: 퍼지는 박동', () => {
  it('세 겹이 판을 빠짐없이 나눔 (가운데 → 바깥), 0.5초 차이', () => {
    const f = boss('abyssheart');
    expect(f.bs.pulse0.pulse).toBe(true);
    const t0 = f.t;
    ['pulse0', 'pulse1', 'pulse2'].forEach((k, i) => { f.bs[k].next = t0 + i * 0.5; });
    steps(f, 1.05);
    const ts = ['pulse0', 'pulse1', 'pulse2'].map(k => tels(f, k)[0]);
    expect(Math.abs(ts[1].impact - ts[0].impact - 0.5)).toBeLessThanOrEqual(E.DT + 1e-9);
    expect(Math.abs(ts[2].impact - ts[1].impact - 0.5)).toBeLessThanOrEqual(E.DT + 1e-9);
    const open = f.cells.filter(c => !c.block).map(c => c.i);
    const all = ts.flatMap(t => [...t.cells]);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort((a, b) => a - b)).toEqual(open);
    const mid = (i: number) => Math.hypot(f.cells[i].px - (Math.min(...f.cells.map(c => c.px)) + Math.max(...f.cells.map(c => c.px))) / 2, 0);
    expect(Math.min(...[...ts[0].cells].map(mid))).toBeLessThanOrEqual(Math.min(...[...ts[2].cells].map(mid)));
  });
  it('겹 칸에 선 사람 모두 맞음 (못 피함) + 박동 이펙트', () => {
    const f = boss('abyssheart');
    ['pulse0', 'pulse1', 'pulse2'].forEach(k => skillOn(f, k));
    const hp = f.party.map(u => u.hp);
    const seen = steps(f, 2.2);
    expect(f.party.every((u, i) => u.hp < hp[i])).toBe(true);
    expect(seen.filter(e => e.type === 'fx' && e.name === 'pulse-ring').length).toBe(f.cells.filter(c => !c.block).length);
  });
  it('2페이즈: 빚진 사람이 박동에 맞으면 남은 빚 +20%', () => {
    const f = boss('abyssheart');
    toPhase(f, 0.6);
    expect(f.phase).toBe(2);
    const u = owe(f, 'abyssheart');
    ['pulse0', 'pulse1', 'pulse2'].forEach(k => skillOn(f, k));
    steps(f, 0.05);
    const imp = tels(f, 'pulse0')[0].impact;
    steps(f, imp - f.t - E.DT * 1.5);
    const d0 = debtOf(u)!.debtLeft!;
    steps(f, E.DT * 3);
    expect(debtOf(u)!.debtLeft! / d0).toBeCloseTo(1.2 * (1 + 0.05 * E.DT * 3), 2);
  });
  it('첫 햇살 조약돌: 박동에 맞은 아군에게 하는 다음 직접 힐 +15% (한 번)', () => {
    const f = boss('abyssheart', false, { dawnPebble: 0.15 });
    ['pulse0', 'pulse1', 'pulse2'].forEach(k => skillOn(f, k));
    steps(f, 2.2);
    const u = f.party.find(x => x.alive && !x.me)!;
    expect(u.pulsed).toBe(true);
    const a = healSpec(f, u, true), b = healSpec(f, u, true);
    expect(a - b).toBeCloseTo(0.15, 6);
    expect(u.pulsed).toBe(false);
  });
});

describe('심연의 심장: 크게 뛰기 (시전 불가)', () => {
  it('시전 중인 힐이 끊기고 시전 스킬이 2초 (악몽 3초) 잠김, 즉시 스킬은 됨', () => {
    for (const [mythic, sec] of [[false, 2], [true, 3]] as const) {
      const f = boss('abyssheart', mythic);
      toPhase(f, 0.6);
      const u = f.party.find(x => x.role === 'melee')!;
      u.hp = u.max * 0.5;
      const s = skillOn(f, 'beat'); steps(f, 0.05);
      expect(s.quake).toBe(true);
      steps(f, 2.5 - 0.3);
      f.gcd = 0;
      expect(E.use(f, 'heal', u.cell).ok).toBe(true);
      steps(f, 0.4);
      expect(f.cast).toBeNull();
      expect(f.lock.heal?.total).toBe(sec);
      f.gcd = 0;
      expect(E.use(f, 'heal', u.cell).ok).toBe(false);
      expect(E.use(f, 'renew', u.cell).ok, `mythic ${mythic}`).toBe(true);
      steps(f, sec + 0.1);
      expect(f.lock.heal).toBeUndefined();
    }
  });
  it('멈춘 심장 조각: 시전 불가가 끝나면 2초 동안 가속 +30%', () => {
    const f = boss('abyssheart', false, { stillHeart: 0.3 });
    toPhase(f, 0.6);
    const h0 = hasteOf(f);
    skillOn(f, 'beat'); steps(f, 2.5 + 0.05);
    expect(hasteOf(f)).toBeCloseTo(h0, 6); // 잠긴 동안은 그대로
    steps(f, 2);
    expect(hasteOf(f)).toBeCloseTo(h0 + 0.3, 6);
    steps(f, 2.3);
    expect(hasteOf(f)).toBeCloseTo(h0, 6);
  });
  it('자동 힐러: 크게 뛰기 예고 동안은 새 시전을 시작하지 않음', () => {
    const f = boss('abyssheart');
    toPhase(f, 0.6);
    f.mana = 100;
    for (const v of f.party) v.hp = v.max * 0.6;
    skillOn(f, 'beat'); steps(f, 0.05);
    for (let i = 0; i < 20; i++) { E.autoHealer(f); E.step(f); f.events.length = 0; }
    expect(f.cast).toBeNull();
  });
});

describe('심연의 심장: 페이즈 · 번개 쐐기', () => {
  it('65% 생명 대출 2명 (크게 뛰기는 빚을 거둔 뒤) · 35% 빨라지는 박동 · 해일 박자 2줄 · 10% 번개 쐐기 (공대 딜 크게, 연쇄 번개 셋)', () => {
    const f = boss('abyssheart');
    toPhase(f, 0.6);
    expect(f.bs.beat.next - f.bs.loan.next).toBeGreaterThanOrEqual(10); // 빚 10초가 끝난 뒤 예고
    expect(f.bs.beat.period).toBe(f.bs.loan.period);
    skillOn(f, 'loan'); steps(f, 0.05);
    expect(f.party.filter(u => debtOf(u)).length).toBe(2);
    toPhase(f, 0.3);
    expect(f.phase).toBe(3);
    expect([f.bs.fast0.next, f.bs.fast1.next, f.bs.fast2.next].map(t => t - f.bs.fast0.next)).toEqual([0, 0.5, 1]);
    expect(f.bs.pulse0.active(f)).toBe(false);
    skillOn(f, 'surge'); steps(f, 3.1);
    expect(f.zones.find(z => z.tide)!.cells.size).toBe(12);
    toPhase(f, 0.08);
    expect(f.phase).toBe(4);
    expect(f.cheer?.mult).toBeCloseTo(4, 6);
    const seen = steps(f, 8.5);
    expect(seen.filter(e => e.type === 'fx' && e.name === 'wedge')).toHaveLength(3);
  });
});

describe('얽힘: 빌린 생명 × 생명 사슬', () => {
  it('뿌리 매듭 2쌍 (악몽 3쌍), 뿌리 대출은 쌍마다 한 명', () => {
    for (const [mythic, n] of [[false, 2], [true, 3]] as const) {
      const f = boss('eongkim', mythic);
      skillOn(f, 'knot'); steps(f, 0.05);
      expect(f.links.length, `mythic ${mythic}`).toBe(n);
      skillOn(f, 'rootloan'); steps(f, 0.05);
      const owed = f.party.filter(u => debtOf(u));
      expect(owed).toHaveLength(n);
      for (const l of f.links) expect(owed.filter(u => l.a === u.id || l.b === u.id), `mythic ${mythic}`).toHaveLength(1);
    }
  });
});

describe('되살아난 심연의 군주: 세력 기믹 다시 보기', () => {
  it('체력 20%마다 구간이 바뀌고 그 구간 기믹만 (악몽은 앞 구간 기믹이 하나 더 남음)', () => {
    const at = (f: F, k: string) => f.bs[k].active(f);
    const f = boss('revlord'), m = boss('revlord', true);
    expect([at(f, 'gold'), at(f, 'goldm'), at(m, 'gold'), at(m, 'goldm')]).toEqual([true, false, false, true]);
    for (const [hp, ph] of [[0.75, 2], [0.55, 3], [0.35, 4], [0.15, 5]] as const) { toPhase(f, hp); toPhase(m, hp); expect([f.phase, m.phase]).toEqual([ph, ph]); if (ph === 2) {
      expect([at(f, 'gold'), at(f, 'ring'), at(m, 'goldm'), at(m, 'ringm')]).toEqual([false, true, true, true]);
    } }
    expect([at(f, 'glass'), at(f, 'lift'), at(m, 'glassm'), at(m, 'liftm'), at(m, 'meltm')]).toEqual([false, true, true, true, false]);
  });
  it('모래시계를 뒤집으면 신기루 칼날이 창 안에', () => {
    const f = boss('revlord');
    toPhase(f, 0.75); toPhase(f, 0.55); toPhase(f, 0.35);
    skillOn(f, 'glass'); steps(f, 3.1);
    expect(f.bs.blade.next).toBeLessThanOrEqual(f.t + 1);
  });
});

describe('멈춘 심장 속', () => {
  const trapped = (f: F) => {
    skillOn(f, 'trap'); steps(f, 0.05);
    const u = f.party.find(x => x.debuffs.some(d => d.name === '그림자 덫'))!;
    return { u, d: u.debuffs.find(d => d.name === '그림자 덫')! };
  };
  it('마지막 그림자 그림자 덫: 두면 그 사람만 딜체 45%', () => {
    const f = boss('lastshade');
    const { u } = trapped(f);
    const hp = u.hp;
    steps(f, 8.1);
    expect(hp - u.hp).toBeGreaterThan(0);
    expect(f.party.some(v => v !== u && debtOf(v))).toBe(false);
  });
  it('지우면 터지지 않고 이웃 칸 2명에게 덫 대출 (빚 최소 25%)', () => {
    const f = boss('lastshade');
    const { u, d } = trapped(f);
    const hp = u.hp;
    const near = f.party.filter(v => v.alive && v !== u && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
    u.debuffs.splice(u.debuffs.indexOf(d), 1);
    onDebuffEnd(f, u, d, true);
    expect(u.hp).toBe(hp);
    const got = f.party.filter(v => debtOf(v));
    expect(got).toHaveLength(Math.min(2, near.length));
    expect(got.every(v => near.includes(v) && debtOf(v)!.name === '덫 대출' && v.hp === v.max)).toBe(true);
    expect(got.every(v => debtOf(v)!.debtLeft! >= v.max * 0.25 - 1e-6)).toBe(true);
  });
  it('악몽 마지막 그림자: 빚이 초마다 12% (보통 10%)', () => {
    const grow = (mythic: boolean) => {
      const f = boss('lastshade', mythic);
      const u = owe(f, 'lastshade');
      const d0 = debtOf(u)!.debtLeft!;
      steps(f, 1);
      return Math.log(debtOf(u)!.debtLeft! / d0);
    };
    expect(grow(true) / grow(false)).toBeCloseTo(1.2, 1);
  });
  it('40% 아래 다시 뛰어라: 밀물 2줄 · 생명 대출 2명', () => {
    const f = boss('lastshade');
    toPhase(f, 0.35);
    expect(f.phase).toBe(2);
    skillOn(f, 'loan2'); steps(f, 0.05);
    expect(f.party.filter(u => debtOf(u))).toHaveLength(2);
    skillOn(f, 'tide2'); steps(f, 3.1);
    expect(f.zones.find(z => z.tide)!.cells.size).toBe(f.cells.filter(c => !c.block && c.row >= f.rows - 2).length);
  });
  it('마지막 그림자의 저울: 빚을 다 갚으면 그 아군 보호막', () => {
    const f = boss('nokseul', false, { shadowScale: 0.4 });
    skillOn(f, 'loan'); steps(f, 0.05);
    const u = f.party.find(x => debtOf(x))!;
    expect(hasAbsorb(f, u)).toBe(false);
    heal(f, u, debtOf(u)!.debtLeft! * 20, true);
    expect(debtOf(u)).toBeUndefined();
    expect(hasAbsorb(f, u)).toBe(true);
  });
});
