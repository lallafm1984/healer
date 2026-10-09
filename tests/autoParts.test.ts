/** 자동 힐러의 기믹 대응 (38 0-5, 35 3장 표의 「힐러 판단」): 부품마다 자동 힐러가 알맞게 고르는지 */
import { describe, expect, it, vi } from 'vitest';
import type { AddDef, SkillEffect } from '../src/data/bosses';
import type { EncounterKey } from '../src/data/encounters';
import { HERO_KEYS, type HeroKey } from '../src/data/heroes';
import * as E from '../src/engine';
import { autoHealer } from '../src/engine/auto';
import { runEffect } from '../src/engine/bossParts';
import { addDebuff, cellOf, unitById } from '../src/engine/core';
import type { BossSkill, Fight, Unit } from '../src/engine';

// 자동 힐러가 쓴 스킬을 기록 (healer.use를 감쌈)
const calls = vi.hoisted(() => [] as { key: string; cell: number }[]);
vi.mock('../src/engine/healer', async importOriginal => {
  const m = await importOriginal<typeof import('../src/engine/healer')>();
  return { ...m, use: (f: Fight, key: Parameters<typeof m.use>[1], cell: number) => { calls.push({ key, cell }); return m.use(f, key, cell); } };
});

const quiet = (f: Fight) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); };
const make = (hero: HeroKey = 'priest', encounter: EncounterKey = 'warden') => { const f = E.create({ encounter, diff: '보통', seed: 1, hero, level: 40, heroLv: 40 }); quiet(f); return f; };
const dealers = (f: Fight) => f.party.filter(u => u.role === 'melee' || u.role === 'ranged');
const tanksHot = (f: Fight) => f.party.filter(u => u.role === 'tank').forEach(u => { u.hot = 9; });
const run = (f: Fight, e: SkillEffect) => runEffect(f, {} as BossSkill, e);
const add = (f: Fight, a: AddDef) => run(f, { p: 'adds', n: 1, add: a });
/** 자동 힐러 한 번: 처음 쓴 스킬과 대상 */
const act = (f: Fight): { key: string; who: Unit | null } | null => {
  calls.length = 0;
  autoHealer(f);
  const c = calls[0];
  return c ? { key: c.key, who: f.cells[c.cell]?.unit ?? null } : null;
};
const auto = (f: Fight, sec: number) => { const end = f.t + sec; while (!f.over && f.t < end - 1e-9) { autoHealer(f); E.step(f); f.events.length = 0; } };

describe('뒤집힌 축복 (P-INVERT)', () => {
  for (const hero of HERO_KEYS) {
    it(`${hero}: 걸린 사람은 가장 낮아도 단일·지속·광역 어느 힐도 안 들어감`, () => {
      const f = make(hero);
      for (const u of f.party) u.hp = u.max * 0.6;
      const v = dealers(f)[0];
      v.hp = v.max * 0.2;
      addDebuff(f, v, { name: '뒤집힌 축복', type: '마법', left: 30, lock: true, invert: true });
      auto(f, 10);
      expect(f.stats.inverted ?? 0).toBe(0);
      expect(v.hp).toBeCloseTo(v.max * 0.2);
      expect(f.party.filter(u => u !== v).some(u => u.hp > u.max * 0.6)).toBe(true); // 다른 사람은 채움
    });
  }
  it('지울 수 있으면 다른 해제보다 먼저 지움 (힐을 막으니까)', () => {
    const f = make();
    const [a, b] = dealers(f);
    addDebuff(f, a, { name: '병', type: '질병', left: 30 });
    addDebuff(f, b, { name: '뒤집힌 축복', type: '마법', left: 30, invert: true });
    expect(act(f)).toEqual({ key: 'purify', who: b });
  });
});

describe('차례 (P-ORDER)', () => {
  for (const hero of HERO_KEYS) {
    it(`${hero}: 위급한 사람이 없으면 번호 순서대로 단일 힐 → 성공해서 보스 멍함`, () => {
      const f = make(hero);
      run(f, { p: 'order', n: 3, sec: 12, wrong: 50, miss: 50, daze: { sec: 4, vuln: 1.2 } });
      expect(f.order?.ids).toHaveLength(3);
      while (f.order && f.t < 12) auto(f, 0.1);
      expect(f.order).toBeNull();
      expect(f.daze).not.toBeNull(); // 성공 (시간이 다 되면 멍함 없이 끝)
      expect(f.t).toBeLessThan(8);
    });
  }
});

describe('탱커처럼 계속 맞는 딜러: 끌려옴 (P-PULL) · 갇힘 (P-JAIL)', () => {
  it('끌려온 딜러에게 탱커처럼 지속 힐', () => {
    const f = make();
    tanksHot(f);
    const v = dealers(f)[1];
    v.hp = v.max * 0.9;
    expect(act(f)).toBeNull(); // 끌려오기 전엔 90%라 손대지 않음
    v.pulled = { until: f.t + 6, cell: v.cell, dmg: 40 };
    expect(act(f)).toEqual({ key: 'renew', who: v });
  });
  it('갇힌 딜러에게 지속 힐 (감옥은 해제가 안 되니 버티게)', () => {
    const f = make('priest', 'plague');
    quiet(f);
    tanksHot(f);
    run(f, { p: 'jail', n: 1, name: '감옥', short: '옥', hp: 0.02, dot: 20 });
    const v = f.party.find(u => u.debuffs.some(d => d.jail))!;
    expect(v).toBeDefined();
    expect(act(f)).toEqual({ key: 'renew', who: v });
  });
});

describe('곧 크게 맞을 사람: 자폭 쫄 (P-FIXATE) · 큰 쫄 강타 (P-ELITE)', () => {
  it('자폭 쫄이 두 칸 안이면 노린 사람을 더 낮은 사람보다 먼저 채움', () => {
    const f = make();
    for (const u of f.party) u.hp = u.max * 0.7;
    add(f, { name: '자폭 쫄', short: '폭', hp: 0.01, dmg: 0, every: 2, job: { p: 'fixate', every: 2, dmg: 300, splash: 100, from: 2 } });
    const m = f.mobs.find(x => x.add?.job?.p === 'fixate')!;
    const v = f.party.find(u => u.id === m.add!.on)!;
    v.hp = v.max * 0.85;
    expect(act(f)).toEqual({ key: 'flash', who: v });
  });
  it('큰 쫄이 강타를 예고하면 맞을 부탱커를 미리 채움', () => {
    const f = make('priest', 'plague');
    quiet(f);
    add(f, { name: '큰 쫄', short: '큰', hp: 0.05, dmg: 0, every: 99, job: { p: 'smash', every: 8, warn: 3, dmg: 500 } });
    const m = f.mobs.find(x => x.add?.job?.p === 'smash')!;
    const v = f.party.find(u => u.id === m.add!.on)!;
    expect(v.role).toBe('tank');
    tanksHot(f);
    v.hp = v.max * 0.8;
    m.add!.warned = true;
    expect(act(f)).toEqual({ key: 'flash', who: v });
  });
});

describe('체력 선 (P-WOUND · P-FULL)', () => {
  it('채우면 풀리는 사람을 더 낮은 사람보다 먼저 선 위로', () => {
    const f = make();
    tanksHot(f);
    const [a, b] = dealers(f);
    a.hp = a.max * 0.85;
    b.hp = b.max * 0.65;
    addDebuff(f, a, { name: '쇠약', type: '질병', left: 20, lock: true, cureAt: 0.9, grow: { every: 3, dot: 6, max: 5 } });
    expect(act(f)).toEqual({ key: 'heal', who: a });
  });
});

describe('곧 모두가 맞음: 폭탄 (P-BOMB) · 쫄 떼 파열 (P-SWARM · P-BURST)', () => {
  it('폭탄이 3초 안에 터지면 지속 힐을 미리 깔아 둠', () => {
    const f = make();
    tanksHot(f);
    expect(act(f)).toBeNull();
    add(f, { name: '폭탄', short: '탄', hp: 0.02, dmg: 0, every: 0, job: { p: 'bomb', sec: 2.5, dmg: 200 } });
    const r = act(f);
    expect(r?.key).toBe('renew');
    expect(r?.who?.role).not.toBe('tank');
  });
  it('파열을 거는 쫄 떼가 거의 다 잡히면 지속 힐을 미리', () => {
    const f = make();
    tanksHot(f);
    add(f, { name: '해골', short: '해', hp: 0.02, dmg: 0, every: 0, cleave: true, down: { p: 'burst', debuff: { name: '파열', type: '물리', left: 6, dot: 10, stackMax: 5 } } });
    expect(act(f)).toBeNull();
    const m = f.mobs.find(x => x.add?.cleave)!;
    m.hp = m.max * 0.2;
    expect(act(f)?.key).toBe('renew');
  });
});

describe('보호막 수정 (P-PYLON) · 판 위 적이 있을 때 해제 순서', () => {
  it('보호막 수정이 서 있으면 마나를 아껴 80%는 그냥 둠', () => {
    const f = make();
    tanksHot(f);
    const v = dealers(f)[0];
    v.hp = v.max * 0.8;
    expect(act(f)).toEqual({ key: 'heal', who: v });
    f.cast = null; f.gcd = 0;
    add(f, { name: '보호막 수정', short: '수', hp: 0.05, dmg: 0, every: 0, job: { p: 'pylon', cut: 0.9 } });
    expect(act(f)).toBeNull();
  });
  it('판에 적이 있으면 딜러의 딜 0 디버프(침묵)를 먼저 지움, 없으면 순서대로', () => {
    const pick = (adds: boolean) => {
      const f = make();
      const [a, b] = dealers(f);
      addDebuff(f, a, { name: '마력 화상', type: '마법', left: 30 });
      addDebuff(f, b, { name: '침묵', type: '마법', left: 30, noDps: true });
      if (adds) add(f, { name: '치유 쫄', short: '치', hp: 0.05, dmg: 0, every: 0, job: { p: 'mend', every: 5, pct: 0.02 } });
      const r = act(f);
      return r?.key === 'purify' ? (r.who === a ? 'a' : r.who === b ? 'b' : '?') : r?.key;
    };
    expect(pick(false)).toBe('a');
    expect(pick(true)).toBe('b');
  });
});

// ---------- 보스 부품 7~10 (서리 마탑 · 깨진 신전 · 마나 갈취 · 매혹 · 옮겨붙음 · 영혼 · 사슬 · 넘치는 빛) ----------
const reset = (f: Fight) => { f.cast = null; f.gcd = 0; f.queued = null; };
const skill = (f: Fight, s: Partial<BossSkill>) => f.skills.push({ key: 'x', next: Infinity, period: 30, cast: 2, active: () => true, st: {}, ...s } as BossSkill);

describe('헤매는 영혼 (P-SOUL)', () => {
  const soul: SkillEffect = { p: 'soul', name: '오염된 늪 정령', short: '정령', hp: 0.25, sec: 12, win: { text: '정화의 물', heal: { pct: 0.15, sec: 8 } }, fail: { text: '오염 분출', dmg: 50, near: true } };
  for (const hero of HERO_KEYS) {
    it(`${hero}: 위급한 사람이 없으면 영혼을 시간 안에 채워 축복을 받음`, () => {
      const f = make(hero);
      run(f, soul);
      expect(f.souls).toHaveLength(1);
      while (f.souls.length && f.t < 12) auto(f, 0.1);
      expect(f.souls).toHaveLength(0);
      expect(f.bless).not.toBeNull(); // 채움 (못 채우면 축복 없이 벌)
    });
  }
  it('유형이 맞으면 해제로 바로 (사제 마법)', () => {
    const f = make();
    run(f, { ...soul, type: '마법' });
    const c = f.souls[0].cell;
    calls.length = 0;
    autoHealer(f);
    expect(calls[0]).toEqual({ key: 'purify', cell: c });
  });
  it('위급한 사람이 있으면 그 사람이 먼저', () => {
    const f = make();
    run(f, soul);
    const v = dealers(f)[0];
    v.hp = v.max * 0.3;
    expect(act(f)?.who).toBe(v);
  });
});

describe('생명 사슬 균형형 (P-LINK)', () => {
  it('체력 차이가 끊기는 선에 가까우면 더 낮은 다른 사람보다 사슬의 낮은 쪽을 먼저', () => {
    const f = make();
    tanksHot(f);
    run(f, { p: 'link', kind: 'balance', name: '저주 실', sec: 12, gap: 0.3, dmg: 100 });
    const l = f.links[0], a = unitById(f, l.a)!, b = unitById(f, l.b)!;
    const other = dealers(f).find(u => u !== a && u !== b)!;
    a.hp = a.max * 0.95; b.hp = b.max * 0.6; other.hp = other.max * 0.5;
    expect(act(f)?.who).toBe(b);
    reset(f);
    f.links = [];
    expect(act(f)?.who).toBe(other); // 사슬이 없으면 가장 낮은 사람
  });
});

describe('넘치는 빛 (P-OVER)', () => {
  it('그릇형: 모두 가득 차 있어도 넘치게 힐해서 전원 보호막', () => {
    const f = make();
    tanksHot(f);
    f.me.hot = 9;
    expect(act(f)).toBeNull();
    run(f, { p: 'vessel', name: '빛 그릇', need: 0.5, sec: 15, shield: 6 });
    while (f.vessel && f.t < 15) auto(f, 0.1);
    expect(f.vessel).toBeNull();
    expect(f.t).toBeLessThan(15); // 시간이 다 돼서 사라진 게 아니라 채움
    expect(f.party.filter(u => u.alive).every(u => u.shield > 0)).toBe(true);
  });
  it('과부하형: 표식 대상은 모자란 양이 힐 한 번보다 적으면 두고, 많이 빠지면 채움', () => {
    const f = E.create({ encounter: 'warden', diff: '보통', seed: 1, hero: 'priest', level: 40, heroLv: 40, stageLv: 40 });
    quiet(f);
    tanksHot(f);
    const [a, b] = dealers(f);
    addDebuff(f, a, { name: '넘치는 빛', type: '마법', left: 20, lock: true, over: 1 });
    a.hp = a.max * 0.78; b.hp = b.max * 0.82;
    expect(act(f)?.who).toBe(b);
    reset(f);
    a.hp = a.max * 0.4;
    expect(act(f)?.who).toBe(a);
  });
});

describe('매혹 (P-CHARM)', () => {
  const charm = { name: '매혹', type: '저주', left: 8, noDps: true, charm: { every: 1, dmg: 10, heal: 1, free: 0.5 } };
  it('못 지우면 매혹된 사람은 두고 다른 사람을 힐 (사제)', () => {
    const f = make();
    tanksHot(f);
    const [a, b] = dealers(f);
    addDebuff(f, a, charm);
    a.hp = a.max * 0.55; b.hp = b.max * 0.7;
    expect(act(f)?.who).toBe(b);
  });
  it('지울 수 있으면 바로 지움 (드루이드 저주)', () => {
    const f = make('druid');
    const [a, b] = dealers(f);
    addDebuff(f, b, { name: '독', type: '독', left: 30 });
    addDebuff(f, a, charm);
    expect(act(f)).toEqual({ key: 'natureCleanse', who: a });
  });
});

describe('나에게 걸리는 표식: 마력 역류 (P-RECOIL) · 마나 갈취 (P-DRAIN)', () => {
  it('역류는 다른 해제보다 먼저 나를 지움 (일찍 지울수록 적게 터짐)', () => {
    const f = make();
    addDebuff(f, dealers(f)[0], { name: '병', type: '질병', left: 30 });
    addDebuff(f, f.me, { name: '마력 역류', type: '마법', left: 10, count: true, end: { p: 'stackHit', dmg: 50 } });
    expect(act(f)).toEqual({ key: 'purify', who: f.me });
  });
  it('역류를 못 지우면 채우기 힐을 줄임', () => {
    const f = make();
    tanksHot(f);
    const v = dealers(f)[0];
    v.hp = v.max * 0.68;
    expect(act(f)?.key).toBe('heal');
    reset(f);
    addDebuff(f, f.me, { name: '마력 역류', type: '마법', left: 10, lock: true, count: true, end: { p: 'stackHit', dmg: 50 } });
    expect(act(f)).toBeNull();
  });
  it('마나 갈취 표식은 다른 해제보다 먼저', () => {
    const f = make();
    addDebuff(f, dealers(f)[0], { name: '병', type: '질병', left: 30 });
    addDebuff(f, f.me, { name: '마나 갈취', type: '마법', left: 10, drain: 2 });
    expect(act(f)).toEqual({ key: 'purify', who: f.me });
  });
});

describe('옮겨붙음 (P-JUMP)', () => {
  it('이웃 칸에 아군이 있으면 안 지우고, 혼자면 지움', () => {
    const f = make();
    const v = dealers(f).find(u => f.party.some(w => w !== u && E.hexDist(cellOf(f, w), cellOf(f, u)) === 1))!;
    addDebuff(f, v, { name: '괴저 역병', type: '질병', left: 20, dot: 5, end: { p: 'jump', sec: 10, mult: 1.5, boost: 0.05 } });
    expect(act(f)?.key).not.toBe('purify');
    reset(f);
    for (const w of f.party) if (w !== v && E.hexDist(cellOf(f, w), cellOf(f, v)) === 1) w.alive = false;
    expect(act(f)).toEqual({ key: 'purify', who: v });
  });
});

describe('진동 (P-QUAKE)', () => {
  it('울리기 전에 시전이 안 끝나면 시전 힐 대신 즉시 지속 힐, 잠긴 스킬도 안 씀', () => {
    const f = make();
    tanksHot(f);
    const v = dealers(f)[0];
    v.hp = v.max * 0.6;
    expect(act(f)?.key).toBe('heal');
    reset(f);
    skill(f, { key: 'quake', next: f.t + 0.3, cast: 1, quake: true });
    expect(act(f)).toEqual({ key: 'renew', who: v });
    reset(f);
    f.skills.pop();
    v.hot = 0;
    f.lock.heal = { left: 3, total: 3 };
    expect(act(f)).toEqual({ key: 'renew', who: v });
  });
  it('드루이드: 생장(시전) 대신 새싹(즉시)', () => {
    const f = make('druid');
    const v = dealers(f)[0];
    v.hp = v.max * 0.4;
    skill(f, { key: 'quake', next: f.t + 0.3, cast: 1, quake: true });
    for (let i = 0; i < 3; i++) { const r = act(f); expect(r?.key).not.toBe('growth'); reset(f); }
  });
});

describe('받침 (P-TOWER) · 무력화 (P-STAGGER)', () => {
  it('받침에 들어간 사람을 더 낮은 사람보다 먼저 가득', () => {
    const f = make();
    tanksHot(f);
    const [a, b] = dealers(f);
    a.hp = a.max * 0.9; b.hp = b.max * 0.7;
    a.padUntil = f.t + 2;
    expect(act(f)).toEqual({ key: 'flash', who: a });
  });
  it('무력화 중에는 선에 가장 가까운 사람부터 선 위로 (게이지를 채울 사람을 늘림)', () => {
    const f = make();
    tanksHot(f);
    const [a, b] = dealers(f);
    a.hp = a.max * 0.66; b.hp = b.max * 0.6;
    expect(act(f)?.who).toBe(b);
    reset(f);
    f.stagger = { name: '힘 모으기', until: f.t + 10, fill: 0, need: 1e9, hp: 0.7, tank: 2, win: { sec: 8, vuln: 1.3 }, fail: { dmg: 100, lock: 3 } };
    expect(act(f)?.who).toBe(a);
  });
});

describe('주시 (P-AGGRO) · 반격 틈 (P-COUNTER)', () => {
  it('주시 게이지가 거의 차면 넘친 치유를 줄이고, 보스가 나를 노리면 나에게 지속 힐', () => {
    const f = make();
    tanksHot(f);
    const v = dealers(f)[0];
    v.hp = v.max * 0.8;
    f.watch = { fill: 900, max: 1000, rate: 1, until: 0, next: 0, sec: 6, every: 1.5, dmg: 100 };
    expect(act(f)).toBeNull();
    f.watch.fill = 0;
    f.watch.until = f.t + 6;
    expect(act(f)).toEqual({ key: 'renew', who: f.me });
  });
  it('반격 틈 기술이 있으면 끊기 능력자의 침묵을 먼저 지움', () => {
    const pick = (counter: boolean) => {
      const f = make();
      f.abOn = true;
      const [a, b] = dealers(f);
      b.ab = { key: 'rogue.kick', star: 1, ready: 0, uses: 0, fired: [], hist: [], lastCounter: 0 } as unknown as Unit['ab'];
      addDebuff(f, a, { name: '침묵', type: '마법', left: 30, noDps: true });
      addDebuff(f, b, { name: '침묵', type: '마법', left: 30, noDps: true });
      if (counter) skill(f, { key: 'counter', stunOnCut: 4, cut: true });
      const r = act(f);
      return r?.key === 'purify' ? (r.who === a ? 'a' : r.who === b ? 'b' : '?') : r?.key;
    };
    expect(pick(false)).toBe('a');
    expect(pick(true)).toBe('b');
  });
});
