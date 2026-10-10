/** 10인 심연의 탑 2층 ~ 꼭대기 (39 1-3, 묶음 A): 히드라 · 쌍둥이 여군주 · 오르벤 · 심연의 군주와 새 부품 */
import { describe, expect, it } from 'vitest';
import { contentOf } from '../src/data/content';
import { BOSSES, type DebuffDef, type SkillEffect } from '../src/data/bosses';
import { artPlaces, CONTENT_PLACE } from '../src/data/places';
import * as E from '../src/engine';
import { aggroTarget, applyDebuff, runEffect } from '../src/engine/bossParts';
import { damage, heal, living } from '../src/engine/core';
import { hexDist } from '../src/engine/board';
import { castOf } from '../src/engine/talents';
import { unitDps } from '../src/engine/units';
import { runOnce } from '../src/sim/balance';

type F = ReturnType<typeof E.create>;
type U = F['party'][number];
const FLOORS = [['abyss2', 'hydra'], ['abyss3', 'twins'], ['abyss4', 'orben'], ['abyss5', 'abysslord']] as const;
const fight = (encounter: (typeof FLOORS)[number][1], diff: '보통' | '악몽' = '보통', specs?: Record<string, number>) => {
  const f = E.create({ encounter, diff, seed: 7, level: 100, specs });
  f.dmgMult = 1; f.power = 1; f.gear.crit = 0;
  f.skills.forEach(s => { s.next = Infinity; }); // 보스 기술은 끔
  return f;
};
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
/** 그 시간 동안 나온 알림 글 */
const msgs = (f: F, sec: number) => {
  const out: string[] = [];
  const end = f.t + sec;
  while (f.t < end - 1e-9 && !f.over) { E.step(f); for (const e of f.events) if (e.type === 'msg') out.push(e.text); f.events.length = 0; }
  return out;
};
const debuffOf = (boss: keyof typeof BOSSES, key: string) => (BOSSES[boss].skills.find(s => s.key === key)!.effect as { debuff: DebuffDef }).debuff;
const effectOf = (boss: keyof typeof BOSSES, key: string) => BOSSES[boss].skills.find(s => s.key === key)!.effect as SkillEffect;
const tanks = (f: F) => f.party.filter(u => u.role === 'tank');
const lost = (u: U, fn: () => void) => { const h = u.hp; fn(); return h - u.hp; };
/** 체력을 크게 (한 방에 안 쓰러지게) */
const big = (f: F) => { for (const u of f.party) { u.base = u.max = 1e5; u.hp = 1e5; } };

describe('콘텐츠', () => {
  it('2층 ~ 꼭대기: 층마다 보스 하나, 10인 Lv 35 (악몽 Lv 50), 그림은 심연을 빌림', () => {
    for (const [key, enc] of FLOORS) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 35, 10, { '악몽': 50 }]);
      expect(c.fights('악몽')).toEqual([enc]);
      expect(artPlaces(CONTENT_PLACE[key]).at(-1)).toBe('abyss');
    }
    expect(contentOf('abyss5').name).toBe('심연의 탑 꼭대기');
  });
  it('모두 5 × 5 판 (25칸), 탱커 둘', () => {
    for (const [, enc] of FLOORS) {
      const f = E.create({ encounter: enc, diff: '보통', seed: 1 });
      expect(f.board, enc).toBe('b25');
      expect(f.party.length).toBe(10);
      expect(tanks(f).length).toBe(2);
    }
  });
});

describe('탱커 교대 (P-SWAP)', () => {
  it('가시: 받는 피해 +12% 중첩, 4중첩이면 다른 탱커가 보스를 받음', () => {
    const f = fight('twins');
    const [a, b] = tanks(f), thorn = debuffOf('twins', 'thorn');
    expect(aggroTarget(f)).toBe(a);
    a.hp = a.max;
    const base = lost(a, () => damage(f, a, 10, true, 'fixed'));
    for (let i = 0; i < 3; i++) applyDebuff(f, a, thorn);
    a.hp = a.max;
    expect(lost(a, () => damage(f, a, 10, true, 'fixed')) / base).toBeCloseTo(1.36, 6);
    expect(aggroTarget(f)).toBe(a);
    applyDebuff(f, a, thorn);
    expect(a.debuffs.find(d => d.name === '가시')!.stack).toBe(4);
    expect(aggroTarget(f)).toBe(b);
    expect(f.hold).toBe(b.id);
  });
  it('심연의 손길: 맞을 때마다 공허 1중첩, 3중첩이면 교대. 받은 탱커가 쓰러지면 남은 탱커에게', () => {
    const f = fight('abysslord');
    const [a, b] = tanks(f);
    big(f);
    for (let i = 0; i < 3; i++) runEffect(f, f.bs.buster, effectOf('abysslord', 'buster'), { units: [aggroTarget(f)!.id] } as never);
    expect(a.debuffs.find(d => d.name === '공허')!.stack).toBe(3);
    expect(aggroTarget(f)).toBe(b);
    b.alive = false; b.hp = 0;
    expect(aggroTarget(f)).toBe(a);
  });
  it('뒤바뀐 자매 (악몽): 두 탱커의 가시 중첩을 맞바꿈, 넘겨받은 쪽이 4중첩이면 교대', () => {
    const f = fight('twins', '악몽');
    const [a, b] = tanks(f), thorn = debuffOf('twins', 'thorn');
    applyDebuff(f, a, thorn);
    for (let i = 0; i < 3; i++) applyDebuff(f, b, thorn);
    runEffect(f, f.bs.trade, effectOf('twins', 'trade'));
    expect([a, b].map(u => u.debuffs.find(d => d.name === '가시')?.stack)).toEqual([3, 1]);
    applyDebuff(f, b, thorn); applyDebuff(f, b, thorn); applyDebuff(f, b, thorn); // b 4중첩 (a를 맞는 중이라 교대 없음)
    expect(aggroTarget(f)).toBe(a);
    runEffect(f, f.bs.trade, effectOf('twins', 'trade'));
    expect(aggroTarget(f)).toBe(b);
  });
});

describe('새 부품', () => {
  it('피의 서약 (집결 분담): 대상과 이웃 칸 아군이 나눠 받음, 혼자면 다 받음', () => {
    const solo = fight('twins'), group = fight('twins');
    big(solo); big(group);
    const pick = (f: F) => f.party.find(u => u.role !== 'tank' && !u.me && living(f).some(v => v !== u && hexDist(f.cells[v.cell], f.cells[u.cell]) === 1))!;
    const t1 = pick(solo), t2 = pick(group);
    expect(t1.id).toBe(t2.id);
    for (const v of living(solo)) if (v !== t1 && hexDist(solo.cells[v.cell], solo.cells[t1.cell]) === 1) { v.alive = false; v.hp = 0; }
    const near = living(group).filter(v => v !== t2 && hexDist(group.cells[v.cell], group.cells[t2.cell]) === 1).length;
    const tel = (u: U) => ({ units: [u.id] }) as never;
    const a = lost(t1, () => runEffect(solo, solo.bs.oath, effectOf('twins', 'oath'), tel(t1)));
    const b = lost(t2, () => runEffect(group, group.bs.oath, effectOf('twins', 'oath'), tel(t2)));
    expect(b * (near + 1)).toBeCloseTo(a, 4);
  });
  it('피의 서약 예고: 가까운 파티원이 대상 옆으로 모임', () => {
    const f = E.create({ encounter: 'twins', diff: '보통', seed: 3 });
    f.skills.forEach(s => { s.next = Infinity; });
    f.bs.oath.next = f.t;
    steps(f, 0.05);
    const tel = f.tels.find(t => t.skill === f.bs.oath)!;
    const t = f.party.find(u => u.id === tel.units[0])!;
    const near = () => living(f).filter(v => v !== t && hexDist(f.cells[v.cell], f.cells[t.cell]) === 1).length;
    const before = near();
    steps(f, tel.impact - f.t - 0.05);
    expect(near()).toBeGreaterThan(before);
  });
  it('치유 흡수 (얼어붙은 시간): 힐이 막부터 깎고, 다 채우면 막이 조용히 사라짐', () => {
    const f = fight('orben');
    const u = f.party.find(x => x.role === 'ranged')!, d = debuffOf('orben', 'freeze');
    applyDebuff(f, u, d);
    u.hp = u.max * 0.5;
    const left = u.debuffs.find(x => x.name === '얼어붙은 시간')!.absorbLeft!;
    expect(left).toBeCloseTo(d.absorb!, 6);
    expect(heal(f, u, left / 2, true, true)).toBe(0);
    expect(u.hp).toBeCloseTo(u.max * 0.5, 6);
    expect(heal(f, u, left / 2 + 10, true, true)).toBeCloseTo(10, 6);
    expect(u.debuffs.some(x => x.name === '얼어붙은 시간')).toBe(false);
  });
  it('치유 흡수: 시간 안에 못 채우면 막이 터져 아픔', () => {
    const f = fight('orben');
    const u = f.party.find(x => x.role === 'ranged')!;
    applyDebuff(f, u, debuffOf('orben', 'freeze'));
    expect(msgs(f, 12.2).some(t => t.startsWith('얼어붙은 시간:'))).toBe(true);
  });
  it('깨진 시간 (악몽): 3초 동안 내 시전 시간 2배', () => {
    const f = fight('orben', '악몽');
    const c0 = castOf(f, 'heal');
    runEffect(f, f.bs.broken, effectOf('orben', 'broken'));
    expect(castOf(f, 'heal')).toBeCloseTo(c0 * 2, 6);
    steps(f, 3.1);
    expect(castOf(f, 'heal')).toBeCloseTo(c0, 6);
  });
  it('줄 피해 (눈보라 세 줄): 그 줄 사람은 비키지 않음', () => {
    const f = E.create({ encounter: 'orben', diff: '보통', seed: 2 });
    f.bossHp = f.bossMax * 0.5;
    steps(f, 0.2);
    expect([f.phase, f.invuln]).toEqual([0, true]);
    const tel = f.tels.find(t => t.skill === f.bs.row1)!;
    expect(tel).toBeTruthy();
    expect(living(f).filter(u => tel.cells.has(u.cell)).length).toBeGreaterThan(0);
    expect(living(f).every(u => u.react?.tel !== tel.id)).toBe(true);
  });
  it('인터미션 (심연 감옥): 보스는 무적이어도 딜러가 감옥을 깸', () => {
    const f = E.create({ encounter: 'abysslord', diff: '보통', seed: 4 });
    f.bossHp = f.bossMax * 0.6;
    steps(f, 1.5);
    expect([f.phase, f.invuln]).toEqual([0, true]);
    const jails = f.mobs.filter(m => m.add?.job?.p === 'jail');
    expect(jails.length).toBe(2);
    const hp = f.bossHp;
    steps(f, 4);
    expect(f.bossHp).toBe(hp);
    expect(jails.some(m => m.hp < m.max)).toBe(true);
  });
  it('쌍둥이 여군주: 두 몸통을 고르게 깎고, 하나가 먼저 쓰러지면 상실의 분노 +30%', () => {
    const f = E.create({ encounter: 'twins', diff: '보통', seed: 5 });
    f.skills.forEach(s => { s.next = Infinity; });
    steps(f, 30);
    const [l, r] = f.mobs;
    expect(l.hp).toBeLessThan(l.max);
    expect(Math.abs(l.hp - r.hp) / l.max).toBeLessThan(0.05);
    l.hp = 0; l.alive = false;
    steps(f, 0.2);
    expect(f.empower).toBeCloseTo(0.3, 6);
  });
  it('심연의 군주 30%: 전투의 함성 (파티 딜 +30% 20초), 그 뒤로 주시 · 10초마다 보스 +5%', () => {
    const f = E.create({ encounter: 'abysslord', diff: '보통', seed: 6 });
    expect(f.watch).toBeNull();
    const u = f.party.find(x => x.role === 'melee')!, d0 = unitDps(u, f);
    f.phase = 2; f.bossHp = f.bossMax * 0.29;
    steps(f, 0.1);
    expect(f.phase).toBe(3);
    expect(unitDps(u, f) / d0).toBeCloseTo(1.3, 6);
    expect(f.cheer!.until - f.t).toBeGreaterThan(19.5);
    expect(f.watch).not.toBeNull();
    f.skills.forEach(s => { if (s !== f.bs.dusk) s.next = Infinity; });
    f.invuln = true; // 파티 딜로 끝나지 않게
    steps(f, 10.5);
    expect(f.empower).toBeCloseTo(0.05, 6);
  });
  it('악몽 10%: 영원한 저녁 (체력 숫자를 가림)', () => {
    const f = E.create({ encounter: 'abysslord', diff: '악몽', seed: 6 });
    f.phase = 3; f.bossHp = f.bossMax * 0.09;
    steps(f, 0.2);
    expect([f.phase, f.dark]).toEqual([4, true]);
    const g = E.create({ encounter: 'abysslord', diff: '어려움', seed: 6 });
    g.phase = 3; g.bossHp = g.bossMax * 0.09;
    steps(g, 0.2);
    expect([g.phase, g.dark]).toEqual([3, false]);
  });
  it('네 가지 메아리: 4명에게 질병 · 독 · 저주 · 마법 하나씩', () => {
    const f = fight('abysslord');
    runEffect(f, f.bs.echoes, effectOf('abysslord', 'echoes'));
    const types = f.party.flatMap(u => u.debuffs.filter(d => d.name.endsWith('메아리')).map(d => d.type));
    expect(types.sort()).toEqual(['독', '마법', '저주', '질병'].sort());
  });
});

describe('끊어진 사슬 (꼭대기 반지)', () => {
  it('내 체력이 50% 아래가 되면 8초 동안 내게 하는 힐 +30%', () => {
    const a = fight('abysslord', '보통', { brokenChain: 0.3 }), b = fight('abysslord');
    for (const f of [a, b]) { f.invuln = true; f.me.hp = f.me.max * 0.6; damage(f, f.me, f.me.max * 0.3, false, 'fixed'); }
    expect(a.me.hp).toBeLessThan(a.me.max * 0.5);
    expect(heal(a, a.me, 10, true) / heal(b, b.me, 10, true)).toBeCloseTo(1.3, 2);
    steps(a, 8.1); steps(b, 8.1);
    expect(heal(a, a.me, 10, true) / heal(b, b.me, 10, true)).toBeCloseTo(1, 2);
  });
});

describe('밸런스', () => {
  it.each(FLOORS)('%s: 보통이면 자동 사제가 거의 다 깸 (Lv 35, 장비 없음)', key => {
    let wins = 0;
    for (let s = 1; s <= 4; s++) if (runOnce(contentOf(key), '보통', 'priest', s).win) wins++;
    expect(wins).toBeGreaterThanOrEqual(3);
  });
});
