/** 능력치 기반 전투 행동 (99): (가) 장판 반응 흔들림 · 못 피한 모양 */
import { describe, expect, it } from 'vitest';
import type { ClassKey } from '../src/data/classes';
import { clumsy, STAT_KEYS, wobOf, type Stats } from '../src/data/fm';
import type { PersName } from '../src/data/personalities';
import { STAT_ACT, THREAT } from '../src/data/rules';
import * as E from '../src/engine';
import { hexDist } from '../src/engine/board';
import { doReact, scheduleReaction } from '../src/engine/movement';
import { threatDps } from '../src/engine/threat';
import type { RosterEntry, Telegraph, Unit } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const flat = (v: number, more: Partial<Stats> = {}): Stats => ({ ...(Object.fromEntries(STAT_KEYS.map(k => [k, v])) as Stats), ...more });
const R = (role: RosterEntry['role'], cls: ClassKey, pers: PersName, nick: string, st: Partial<Stats> = {}, steady = 10): RosterEntry =>
  ({ role, cls, pers, nick, ab: role === 'tank' ? `${cls}.taunt` : role === 'melee' ? 'rogue.kick' : 'mage.blink', fm: { stats: flat(10, st), off: 0, steady } });
const fight = (o: { st?: Partial<Stats>; steady?: number; seed?: number; tank?: Partial<Stats>; tankSteady?: number } = {}): F => {
  const f = E.create({
    encounter: 'warden', diff: '보통', seed: o.seed ?? 1, stageLv: 30, heroLv: 30,
    party: [R('tank', 'warrior', '사교형', '탱', o.tank, o.tankSteady), R('melee', 'rogue', '사교형', '근', o.st, o.steady), R('ranged', 'mage', '사교형', '마'), R('ranged', 'archer', '사교형', '궁')],
  });
  f.skills.forEach(s => { s.next = Infinity; });
  return f;
};
const who = (f: F, nick: string) => f.party.find(u => u.nick === nick)!;
let telId = 9000;
/** 그 사람 칸 + 둘레 칸을 덮는 장판 예고 (터지기까지 2초) */
function zoneTel(f: F, u: Unit): Telegraph {
  const at = f.cells[u.cell];
  const cells = new Set(f.cells.filter(c => hexDist(c, at) <= 1).map(c => c.i));
  const tel = { id: telId++, kind: 'zone', cells, impact: f.t + 2, skill: { key: 'test', name: '시험 장판', kind: 'zone' } } as unknown as Telegraph;
  f.tels.push(tel);
  return tel;
}
/** 같은 사람 · 같은 판에서 예고 n개에 대한 반응 시간 */
function reactTimes(f: F, u: Unit, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) { u.react = null; const tel = zoneTel(f, u); scheduleReaction(f, tel, u); out.push(u.react!.at - f.t); f.tels = f.tels.filter(t => t !== tel); }
  return out;
}
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

describe('(가) 예고 반응 흔들림', () => {
  it('꾸준함이 15보다 낮으면 예고마다 반응 시간이 다름 (평균은 예전 값 그대로)', () => {
    const f = fight({ steady: 5 }), u = who(f, '근');
    const ts = reactTimes(f, u, 400);
    const base = (() => { const w = u.wob; u.wob = undefined; const t = reactTimes(f, u, 3); u.wob = w; return t; })();
    expect(new Set(base.map(t => t.toFixed(6))).size).toBe(1); // 흔들림 없으면 늘 같음 (예전)
    expect(Math.max(...ts) / Math.min(...ts)).toBeGreaterThan(1.5);
    expect(mean(ts) / base[0]).toBeGreaterThan(0.95);
    expect(mean(ts) / base[0]).toBeLessThan(1.05);
  });

  it('기준점 15 (Lim 「평균 15정도에서 지금처럼」): 꾸준함 15 이상은 예전처럼 늘 같음, 낮을수록 더 흔들림', () => {
    expect(wobOf(1)).toBeCloseTo(1.6); expect(wobOf(15)).toBe(0); expect(wobOf(20)).toBe(0); expect(wobOf(10)).toBeCloseTo(1.6 * 5 / 14);
    const spread = (steady: number) => { const f = fight({ steady }), ts = reactTimes(f, who(f, '근'), 300); return Math.max(...ts) - Math.min(...ts); };
    expect(spread(15)).toBeCloseTo(0, 6);
    expect(spread(20)).toBeCloseTo(0, 6);
    expect(spread(15)).toBeLessThan(spread(10));
    expect(spread(10)).toBeLessThan(spread(1));
  });

  it('같은 예고에 파티원마다 움직이기 시작하는 때가 다름 (예전엔 성격이 같으면 0.1초 안에 다 같이)', () => {
    const f = fight({ steady: 8 }), us = f.party.filter(u => !u.me);
    const all = new Set<number>();
    for (const u of us) all.add(u.cell);
    const cells = new Set(f.cells.map(c => c.i)); // 판 전체 장판
    const tel = { id: telId++, kind: 'zone', cells, impact: f.t + 3, skill: { key: 'test', name: '시험', kind: 'zone' } } as unknown as Telegraph;
    const starts = us.map(u => { u.react = null; scheduleReaction(f, tel, u); return u.react!.at; });
    expect(Math.max(...starts) - Math.min(...starts)).toBeGreaterThan(0.05);
  });
});

describe('(가) 못 피한 모양', () => {
  /** 못 피하게 (회피 확률 바닥) 해 두고 n번 반응시켜 모양을 셈 */
  function shapes(st: Partial<Stats>, n: number) {
    let late = 0, wrong = 0, freeze = 0;
    for (let i = 0; i < n; i++) {
      const f = fight({ st, seed: 100 + i }), u = who(f, '근');
      u.senseDodge = -2; // 성공 5%
      const tel = zoneTel(f, u);
      u.react = { at: f.t, tel: tel.id };
      const cell0 = u.cell;
      doReact(f, u);
      if (u.react?.late) late++;
      else if (u.moving && tel.cells.has(u.moving.to)) wrong++;
      else if (!u.moving && u.cell === cell0) freeze++;
    }
    return { late, wrong, freeze };
  }
  it('반응이 낮으면 늦게 피함이 많고, 판단이 낮으면 엉뚱한 쪽이 많음 (못 피할 확률은 그대로)', () => {
    const slow = shapes({ react: 1 }, 300), quick = shapes({ react: 20 }, 300);
    expect(slow.late).toBeGreaterThan(quick.late * 1.6);
    const dull = shapes({ judgment: 1 }, 300), sharp = shapes({ judgment: 20 }, 300);
    expect(dull.wrong).toBeGreaterThan(sharp.wrong * 2);
    const avg = shapes({}, 400), tot = avg.late + avg.wrong + avg.freeze, want = STAT_ACT.late * clumsy(10) * (1 - clumsy(10));
    expect(avg.late / tot).toBeGreaterThan(want - 0.06);
    expect(avg.late / tot).toBeLessThan(want + 0.06);
    const par = shapes({ react: 15, judgment: 15 }, 200);
    expect(par.late + par.wrong).toBe(0); // 15 이상 = 예전처럼 멈칫만
  });

  it('Codex 검토 반영 1: 반응 빠름 + 판단 나쁨 = 먼저 엉뚱한 쪽, 반응 느림 + 판단 좋음 = 늦어도 맞는 칸, 둘 다 낮으면 멈칫', () => {
    const quickDull = shapes({ react: 15, judgment: 1 }, 200), slowSharp = shapes({ react: 1, judgment: 15 }, 200), both = shapes({ react: 1, judgment: 1 }, 200);
    expect(quickDull.late).toBe(0); expect(quickDull.wrong).toBeGreaterThan(50);
    expect(slowSharp.wrong).toBe(0); expect(slowSharp.late).toBeGreaterThan(70);
    expect(both.late + both.wrong).toBe(0); expect(both.freeze).toBeGreaterThan(150);
  });

  it('늦게 피함: 터질 때는 그 칸에 있다가 (맞음) 터진 뒤 안전한 칸으로 뛰어나옴', () => {
    for (let s = 1; s < 60; s++) {
      const f = fight({ st: { react: 1 }, seed: 500 + s }), u = who(f, '근');
      u.senseDodge = -2;
      const tel = zoneTel(f, u);
      u.react = { at: f.t, tel: tel.id };
      doReact(f, u);
      if (!u.react?.late) continue;
      expect(u.react.at).toBeGreaterThan(tel.impact);
      expect(u.moving).toBeNull();
      f.t = u.react.at;
      doReact(f, u);
      expect(u.moving && !tel.cells.has(u.moving.to)).toBe(true);
      return;
    }
    throw new Error('늦게 피함이 한 번도 안 나옴');
  });

  it('능력치가 없는 사람 (튜토리얼 · 옛 파티)은 예전처럼 멈칫만', () => {
    let other = 0;
    for (let i = 0; i < 100; i++) {
      const f = fight({ seed: 900 + i }), u = who(f, '근');
      u.wob = undefined; u.senseDodge = -2;
      const tel = zoneTel(f, u);
      u.react = { at: f.t, tel: tel.id };
      doReact(f, u);
      if (u.react?.late || (u.moving && tel.cells.has(u.moving.to))) other++;
    }
    expect(other).toBe(0);
  });
});

describe('(나) 탱커 자리', () => {
  const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
  const front = (f: F, u: Unit) => f.cells[u.moving ? u.moving.to : u.cell].row < f.R.pos!.tankRows;
  it('전투 시작: 위치 잡기가 낮으면 둘째 줄에서 시작하는 일이 잦고 (그동안 적이 다른 사람을 침), 15 이상은 늘 1열', () => {
    let lost = 0, lostPar = 0;
    for (let i = 0; i < 200; i++) {
      const f = fight({ seed: 2000 + i, tank: { position: 1 } }), tk = who(f, '탱');
      if (!front(f, tk)) { lost++; expect(tk.lostUntil).toBeGreaterThan(0); }
      const g = fight({ seed: 2000 + i, tank: { position: 15 } });
      if (!front(g, who(g, '탱'))) lostPar++;
    }
    expect(lost / 200).toBeGreaterThan(STAT_ACT.tankStart - 0.12);
    expect(lostPar).toBe(0);
  });
  it('시작 자리를 못 찾은 탱커: 머뭇거리는 동안 적이 다른 파티원을 노리고 (loose), 끝나면 1열로 나감', () => {
    for (let i = 0; i < 100; i++) {
      const f = fight({ seed: 3000 + i, tank: { position: 1, react: 1 } }), tk = who(f, '탱');
      if (front(f, tk)) continue;
      steps(f, 0.2);
      expect(f.loose?.id).not.toBe(tk.id);
      expect(f.loose).not.toBeNull();
      steps(f, (tk.lostUntil ?? 0) + 2.5 - f.t);
      expect(front(f, tk)).toBe(true);
      return;
    }
    throw new Error('시작 자리를 못 찾은 판이 없음');
  });
  it('1열이 비면: 위치 잡기 · 반응이 낮으면 머뭇거리고 (「?」), 15 이상은 바로 1열로', () => {
    const lostFor = (st: Partial<Stats>) => {
      const f = fight({ seed: 7, tank: st }), tk = who(f, '탱');
      if (!front(f, tk)) steps(f, 6); // 시작 자리를 못 찾았으면 먼저 1열로
      const p = f.R.pos!, back = f.cells.find(c => !c.unit && !c.block && c.row === p.tankRows)!;
      f.cells[tk.cell].unit = null; back.unit = tk; tk.cell = back.i; tk.home = back.i; tk.homeAt = null; tk.lostUntil = undefined;
      const t0 = f.t;
      for (let k = 0; k < 200 && !front(f, tk); k++) steps(f, 0.05);
      return f.t - t0;
    };
    const slow = lostFor({ position: 1, react: 1, judgment: 15 }), par = lostFor({ position: 15, react: 15 });
    expect(par).toBeLessThan(0.5);
    expect(slow).toBeGreaterThan(par + 0.6);
  });
});

describe('(다) 딜 · 직업 스킬', () => {
  /** 근접 (도적) 한 사람의 n초 동안 한 방 · 빗나감 · 세게 */
  function swings(st: Partial<Stats>, sec: number, seed = 1) {
    const f = fight({ st, seed }), u = who(f, '근');
    f.bossHp = f.bossMax = 1e9;
    let hit = 0, miss = 0, crit = 0;
    const end = f.t + sec;
    while (f.t < end && !f.over) {
      E.step(f);
      for (const ev of f.events) {
        if (ev.type === 'hit' && ev.uid === u.id) { hit++; if (ev.crit) crit++; }
        if (ev.type === 'miss' && ev.uid === u.id) miss++;
      }
      f.events.length = 0;
    }
    return { hit, miss, crit };
  }
  it('기술 숙련이 15보다 낮으면 한 방이 빗나감 (1 = 15%), 15 이상은 늘 들어감', () => {
    const lo = swings({ skill: 1, focus: 15 }, 400), par = swings({ skill: 15, focus: 15 }, 200); // 집중 15: 「멍」 빗나감 빼고
    expect(lo.miss / (lo.hit + lo.miss)).toBeGreaterThan(STAT_ACT.miss - 0.05);
    expect(lo.miss / (lo.hit + lo.miss)).toBeLessThan(STAT_ACT.miss + 0.05);
    expect(par.miss).toBe(0);
  });
  it('공격이 15 넘으면 가끔 세게 (20 = 8% × 1.5), 15 이하는 없음', () => {
    const hi = swings({ atk: 20 }, 400), par = swings({ atk: 15 }, 200);
    expect(hi.crit / hi.hit).toBeGreaterThan(STAT_ACT.crit - 0.04);
    expect(par.crit).toBe(0);
  });
  /** 궁수 정조준 (쿨마다, t ≥ 1초): 처음 쓴 때 · 헛씀 */
  function firstUse(st: Partial<Stats>, seed: number) {
    const f = E.create({
      encounter: 'warden', diff: '보통', seed, stageLv: 30, heroLv: 30,
      party: [R('tank', 'warrior', '사교형', '탱'), R('melee', 'rogue', '사교형', '근'), R('ranged', 'mage', '사교형', '마'), { ...R('ranged', 'archer', '사교형', '궁', st), ab: 'archer.aimedShot' }],
    });
    f.skills.forEach(s => { s.next = Infinity; });
    const u = who(f, '궁');
    while (f.t < 12 && !f.over) {
      E.step(f);
      for (const ev of f.events) if (ev.type === 'ability' && ev.id === u.id) return { t: f.t, fumble: !!ev.fumble };
      f.events.length = 0;
    }
    return { t: Infinity, fumble: false };
  }
  it('판단이 15보다 낮으면 쓸 때가 돼도 늦게 씀 (1 = 평균 1.2초), 15 이상은 바로 (0.2초 판단 주기)', () => {
    const late = Array.from({ length: 60 }, (_, i) => firstUse({ judgment: 1 }, 40 + i).t), now = Array.from({ length: 30 }, (_, i) => firstUse({ judgment: 15 }, 40 + i).t);
    expect(Math.max(...now)).toBeLessThan(1.3);
    expect(mean(late)).toBeGreaterThan(mean(now) + 0.6);
  });
  it('기술 숙련이 15보다 낮으면 가끔 헛씀 (재사용만 돎, 1 = 12%), 15 이상은 없음', () => {
    const lo = Array.from({ length: 300 }, (_, i) => firstUse({ skill: 1, judgment: 15 }, 400 + i)).filter(x => x.fumble).length;
    const par = Array.from({ length: 100 }, (_, i) => firstUse({ skill: 15, judgment: 15 }, 400 + i)).filter(x => x.fumble).length;
    expect(lo / 300).toBeGreaterThan(STAT_ACT.fumble - 0.06);
    expect(par).toBe(0);
  });
});

describe('(다) 탱커 딜', () => {
  it('공격 20 탱커는 서툰 딜러 (공격 · 기술 숙련 1 사냥꾼)보다 딜을 더 넣음, 공격 15 이하 탱커는 예전 그대로', () => {
    const f = E.create({
      encounter: 'warden', diff: '보통', seed: 11, stageLv: 30, heroLv: 30,
      party: [R('tank', 'warrior', '사교형', '탱', { atk: 20 }), R('melee', 'rogue', '사교형', '근'), R('ranged', 'hunter', '사교형', '사', { atk: 1, skill: 1 }), R('ranged', 'archer', '사교형', '궁')],
    });
    f.skills.forEach(s => { s.next = Infinity; });
    f.bossHp = f.bossMax = 1e9;
    const end = f.t + 120;
    while (f.t < end && !f.over) { E.step(f); f.events.length = 0; }
    expect(who(f, '탱').dealt).toBeGreaterThan(who(f, '사').dealt);
    const g = fight({ tank: { atk: 15 } }), h = fight({ tank: { atk: 10 } });
    expect(who(g, '탱').dps).toBeCloseTo(who(h, '탱').dps * (1.075 / 1), 1); // 공격 15 = 예전 배율 (fmFx 1 → 1.15 사이) 그대로, 새 보너스 없음
  });
});

describe('(마) 어그로 상황', () => {
  const run = (o: { rogue: Partial<Stats>; tank?: Partial<Stats>; seed: number; sec?: number }) => {
    const f = E.create({
      encounter: 'warden', diff: '악몽', seed: o.seed, stageLv: 30, heroLv: 30,
      party: [R('tank', 'warrior', '사교형', '탱', o.tank ?? { skill: 15, react: 15, position: 15, focus: 15 }, 15), R('melee', 'rogue', '사교형', '근', o.rogue, 15), R('ranged', 'mage', '사교형', '마', {}, 15), R('ranged', 'archer', '사교형', '궁', {}, 15)],
    });
    f.skills.forEach(s => { s.next = Infinity; });
    f.bossHp = f.bossMax = 1e9;
    const end = f.t + (o.sec ?? 90);
    while (f.t < end && !f.over) { E.step(f); f.events.length = 0; }
    return f;
  };
  it('압도적으로 센 딜러 (공격 20, 판단 1 = 딜을 안 줄임)는 괜찮은 탱커 (15)에게서도 어그로를 뺏고, 공격 15 딜러는 덜 뺏음', () => {
    let strong = 0, plain = 0;
    for (let s = 1; s <= 6; s++) {
      strong += run({ rogue: { atk: 20, judgment: 1 }, seed: s }).stats.steals ?? 0;
      plain += run({ rogue: { atk: 15, judgment: 1 }, seed: s }).stats.steals ?? 0;
    }
    expect(strong).toBeGreaterThan(0);
    expect(strong).toBeGreaterThan(plain);
  });
  /** 근접 딜러가 보스를 뺏은 상태로 두고, 뺏은 뒤 딜 배율을 시간마다 */
  function afterSteal(st: Partial<Stats>) {
    const f = fight({ st, steady: 15 }), tk = who(f, '탱'), u = who(f, '근');
    for (let i = 0; i < 200; i++) { E.step(f); f.events.length = 0; }
    const t = f.thr!;
    for (let i = 0; i < 40 && !t.steal; i++) { t.v.set(u.id, (t.v.get(tk.id) ?? 1) * 3); E.step(f); f.events.length = 0; }
    expect(t.steal?.id).toBe(u.id);
    t.retakeAt = f.t + 20; // 되찾기는 멀리 (배율만 봄)
    const out: number[] = [];
    for (const dt of [0.5, 1.5, 2.5, 4, 8]) { const at = t.steal!.at + 1 + dt; while (f.t < at) { E.step(f); f.events.length = 0; } out.push(threatDps(f, u)); }
    return { out, steal: t.steal! };
  }
  it('뺏은 뒤: 판단 · 침착 20 = 되찾을 때까지 멈춤, 15 = 예전 (2초 멈춤 → 25% 줄임), 1 = 계속 그대로 때림 (되찾기도 늦음)', () => {
    const hi = afterSteal({ judgment: 20, composure: 20 }), par = afterSteal({ judgment: 15, composure: 15 }), lo = afterSteal({ judgment: 1, composure: 1 });
    expect(hi.out.every(x => x === 0)).toBe(true);
    expect(par.out[0]).toBe(0);
    expect(par.out[4]).toBeCloseTo(1 - THREAT.ease);
    expect(lo.out.every(x => x === 1 || x === 0)).toBe(true); // 판단 · 침착 1: 계속 때리다가 당황하면 잠깐 끊김 (아래)
    expect(lo.out.slice(1).every(x => x === 1)).toBe(true);
  });
  /** Codex 검토 반영 1: 뺏는 순간 (사건 · 대사 · 칸) 과 그 뒤 딜 배율 */
  function stealCase(st: Partial<Stats>, ab = 'rogue.kick', seed = 1) {
    const f = E.create({
      encounter: 'warden', diff: '보통', seed, stageLv: 30, heroLv: 30,
      party: [R('tank', 'warrior', '사교형', '탱', {}, 15), { ...R('melee', 'rogue', '사교형', '근', st, 15), ab }, R('ranged', 'mage', '사교형', '마'), R('ranged', 'archer', '사교형', '궁')],
    });
    f.skills.forEach(s => { s.next = Infinity; });
    const tk = who(f, '탱'), u = who(f, '근'), t = f.thr!;
    for (let i = 0; i < 200; i++) { E.step(f); f.events.length = 0; }
    const cell0 = u.cell, sits: string[] = [];
    let used = false;
    for (let i = 0; i < 40 && !t.steal; i++) {
      t.v.set(u.id, (t.v.get(tk.id) ?? 1) * 3); E.step(f);
      for (const ev of f.events) { if (ev.type === 'bark' && ev.id === u.id && ev.sit) sits.push(ev.sit); if (ev.type === 'ability' && ev.id === u.id && !ev.fumble) used = true; }
      f.events.length = 0;
    }
    expect(t.steal?.id).toBe(u.id);
    const s0 = t.steal!, at0 = s0.at, moved = (u.moving?.to ?? u.cell) !== cell0, hesit = (u.hesitUntil ?? 0) - at0, lost = (u.lostUntil ?? 0) > f.t;
    t.retakeAt = f.t + 20;
    const dps = (dt: number) => { while (f.t < at0 + dt) { E.step(f); f.events.length = 0; } return threatDps(f, u); };
    return { s0, sits, used, moved, hesit, lost, dps };
  }
  it('Codex 검토 반영 1: 판단 = 고르기 · 침착 = 해내기 — 네 모양 (멈추고 생존기 · 당황해 한 대 더 · 차분히 계속 · 끊기고 자리 잃음)', () => {
    // 판단 ↑ 침착 ↑: 멈추고 기다리며 방어 생존기를 켬
    const hh = stealCase({ judgment: 20, composure: 20 }, 'rogue.evasion');
    expect(hh.used).toBe(true); expect(hh.sits).toContain('aggroHold'); expect(hh.dps(1)).toBe(0); expect(hh.dps(6)).toBe(0);
    // 판단 ↑ 침착 ↓: 멈추기로 했지만 한 대 더 (멈춤이 늦음) · 장판 반응 머뭇거림
    const hl = stealCase({ judgment: 20, composure: 1 });
    expect(hl.sits).toContain('aggroPanic'); expect(hl.hesit).toBeCloseTo(STAT_ACT.hesit, 1);
    expect(hl.s0.stopAt - hl.s0.at).toBeCloseTo(THREAT.calm[0] + STAT_ACT.panicHit, 1);
    expect(hl.dps(2.5)).toBe(1); expect(hl.dps(4)).toBe(0);
    // 판단 ↓ 침착 ↑: 차분히 계속 때림 (끊김 · 자리 잃음 없음)
    const lh = stealCase({ judgment: 1, composure: 20 });
    expect(lh.sits).toContain('aggroIgnore'); expect(lh.moved || lh.lost).toBe(false); expect(lh.dps(0.3)).toBe(1); expect(lh.dps(3)).toBe(1);
    // 판단 ↓ 침착 ↓: 딜이 끊기고 옆 칸으로 밀려남 (「?」), 끊김이 끝나면 다시 그대로 때림
    const ll = stealCase({ judgment: 1, composure: 1 });
    expect(ll.sits).toContain('aggroLost'); expect(ll.moved).toBe(true); expect(ll.lost).toBe(true);
    expect(ll.dps(0.5)).toBe(0); expect(ll.dps(STAT_ACT.breakSec + 0.3)).toBe(1);
    // 15 = 예전 그대로 (생존기 · 당황 · 자리 잃음 없음)
    const par = stealCase({ judgment: 15, composure: 15 }, 'rogue.evasion');
    expect(par.used).toBe(false); expect(par.hesit).toBeLessThanOrEqual(0); expect(par.moved || par.lost).toBe(false); expect(par.sits).toContain('aggroSteal');
  });
});

describe('(라) 방어 · 회피 · 나머지', () => {
  /** 전사 방어 태세 (체력 40% 아래): 체력을 h로 두고 1초 안에 쓰나 */
  function usesAt(st: Partial<Stats>, h: number, seed = 5) {
    const f = E.create({
      encounter: 'warden', diff: '보통', seed, stageLv: 30, heroLv: 30,
      party: [{ ...R('tank', 'warrior', '사교형', '탱', st, 15), ab: 'warrior.defStance' }, R('melee', 'rogue', '사교형', '근'), R('ranged', 'mage', '사교형', '마'), R('ranged', 'archer', '사교형', '궁')],
    });
    f.skills.forEach(s => { s.next = Infinity; });
    const tk = who(f, '탱');
    for (let i = 0; i < 40; i++) { E.step(f); f.events.length = 0; }
    tk.hp = tk.max * h;
    for (let i = 0; i < 20; i++) { E.step(f); for (const ev of f.events) if (ev.type === 'ability' && ev.id === tk.id) return true; f.events.length = 0; tk.hp = tk.max * h; }
    return false;
  }
  it('생존기: 판단이 15보다 낮으면 체력 기준이 낮아져 늦게 씀 (판단 1 = −6%p), 15 이상은 예전 기준', () => {
    expect(usesAt({ judgment: 15, skill: 15 }, 0.37)).toBe(true);
    expect(usesAt({ judgment: 1, skill: 15 }, 0.37)).toBe(false); // 40% − 6%p · 판단 −4.5%p (예전) 아래라 아직 안 씀
  });
  it('평타 막기: 방어 · 발놀림 20이면 가끔 반만 맞음 (「막음」), 15 이하는 없음', () => {
    const count = (st: Partial<Stats>) => {
      const f = E.create({ encounter: 'warden', diff: '보통', seed: 9, stageLv: 30, heroLv: 30, party: [R('tank', 'warrior', '사교형', '탱', st, 15), R('melee', 'rogue', '사교형', '근'), R('ranged', 'mage', '사교형', '마'), R('ranged', 'archer', '사교형', '궁')] });
      let n = 0;
      while (f.t < 120 && !f.over) { E.step(f); n += f.events.filter(e => e.type === 'parry').length; f.events.length = 0; who(f, '탱').hp = who(f, '탱').max; }
      return n;
    };
    expect(count({ armor: 20, agility: 20 })).toBeGreaterThan(0);
    expect(count({ armor: 15, agility: 15 })).toBe(0);
  });
  it('피하기 확률 · 이동: 회피 · 발놀림이 15보다 낮으면 덜 피하고 느림, 15는 예전 값', async () => {
    const { dodgeRate, moveTo } = await import('../src/engine/movement');
    const f1 = fight({ st: { evade: 1, agility: 1 } }), f15 = fight({ st: { evade: 15, agility: 15 } }), f20 = fight({ st: { evade: 20 } });
    const a = dodgeRate(f1, who(f1, '근')), b = dodgeRate(f15, who(f15, '근')), c = dodgeRate(f20, who(f20, '근'));
    expect(b - a).toBeGreaterThan(STAT_ACT.evadeLow + 0.04); // 새 층 −8%p + 예전 회피 차이
    expect(c).toBeGreaterThan(b);
    const go = (f: F) => { const u = who(f, '근'), c2 = f.cells.find(x => !x.unit && !x.block && hexDist(x, f.cells[u.cell]) === 1)!; moveTo(f, u, c2); return u.moving!.total; };
    expect(go(f1) / go(f15)).toBeGreaterThan(1 + STAT_ACT.slowMove);
  });
});

describe('Codex 검토 반영: 버그', () => {
  it('A: 못 피한 뒤 다시 움직이는 때는 세 모양 모두 같은 침착 식 (늦게 피함 · 엉뚱한 쪽이 멈칫보다 먼저 벗어나지 않음)', () => {
    const late: number[] = [], wrong: number[] = [], freeze: number[] = [];
    for (let i = 0; i < 600; i++) {
      const f = fight({ st: i % 3 === 0 ? { react: 1, judgment: 15 } : i % 3 === 1 ? { react: 15, judgment: 1 } : { react: 1, judgment: 1 }, seed: 7000 + i }), u = who(f, '근');
      u.senseDodge = -2;
      const tel = zoneTel(f, u);
      u.react = { at: f.t, tel: tel.id };
      const c0 = u.cell;
      doReact(f, u);
      if (u.react?.late) late.push(u.react.at - tel.impact);
      else if (u.moving && tel.cells.has(u.moving.to)) wrong.push(u.retryAt - tel.impact);
      else if (!u.moving && u.cell === c0) freeze.push(u.retryAt - tel.impact);
    }
    expect(late.length).toBeGreaterThan(30); expect(wrong.length).toBeGreaterThan(30); expect(freeze.length).toBeGreaterThan(30);
    expect(Math.min(...late)).toBeGreaterThanOrEqual(1.5 * 0.99); // 침착 10 (× 1)에서 가장 빨라도 1.5초
    expect(mean(late)).toBeGreaterThan(mean(freeze) - 0.25);
    expect(mean(wrong)).toBeGreaterThan(mean(freeze) - 0.25);
  });
  it('B: 예고 반응 생존기도 판단이 낮으면 늦게 쓰거나 놓치고, 15 이상은 예고가 뜨자마자', async () => {
    const { abOnTel } = await import('../src/engine/abilities');
    const shield = (judgment: number, seed: number, skill = 15, out?: { fumble: number }) => {
      const f = E.create({
        encounter: 'warden', diff: '보통', seed, stageLv: 30, heroLv: 30,
        party: [{ ...R('tank', 'warrior', '사교형', '탱', { judgment, skill }, 15), ab: 'warrior.shieldBlock' }, R('melee', 'rogue', '사교형', '근'), R('ranged', 'mage', '사교형', '마'), R('ranged', 'archer', '사교형', '궁')],
      });
      f.skills.forEach(s => { s.next = Infinity; });
      for (let i = 0; i < 40; i++) { E.step(f); f.events.length = 0; }
      const tk = who(f, '탱');
      const tel = { id: telId++, kind: 'buster', cells: new Set([tk.cell]), units: [tk.id], impact: f.t + 1.5, skill: { key: 't', name: '시험 강타', kind: 'buster', dmg: 10, hit: () => {} } } as unknown as Telegraph;
      f.tels.push(tel);
      const t0 = f.t;
      abOnTel(f, tel);
      let at = Infinity;
      for (let k = 0; k < 40 && at === Infinity; k++) { for (const ev of f.events) if (ev.type === 'ability' && ev.id === tk.id) { at = f.t - t0; if (out && (ev as { fumble?: boolean }).fumble) out.fumble++; } f.events.length = 0; if (f.t < tel.impact) E.step(f); else break; }
      return at;
    };
    const par = Array.from({ length: 30 }, (_, i) => shield(15, 50 + i)), slow = Array.from({ length: 60 }, (_, i) => shield(1, 50 + i));
    expect(par.every(t => t === 0)).toBe(true);
    expect(slow.filter(t => t === 0).length).toBe(0);
    expect(slow.some(t => t > 0 && t < Infinity)).toBe(true); // 늦게 씀
    expect(slow.some(t => t === Infinity)).toBe(true); // 놓침
    const o = { fumble: 0 };
    for (let i = 0; i < 80; i++) shield(15, 50 + i, 1, o);
    expect(o.fumble).toBeGreaterThan(0); // 예고 반응도 기술 숙련이 낮으면 헛씀
    const p = { fumble: 0 };
    for (let i = 0; i < 80; i++) shield(15, 50 + i, 15, p);
    expect(p.fumble).toBe(0);
  });
});

describe('집중 「멍」 (Lim 06:47 「능력치 하나하나 모두 의미있게」)', () => {
  /** 보스를 안 죽게 두고 sec초 돌리며 근접 딜러의 멍 · 빗나감 시각 */
  function long(st: Partial<Stats>, sec: number, seed = 1, setup?: (f: F, u: Unit) => void) {
    const f = fight({ st, seed }), u = who(f, '근');
    f.bossHp = f.bossMax = 1e9;
    setup?.(f, u);
    const daze: number[] = [], miss: number[] = [];
    while (f.t < sec && !f.over) {
      E.step(f);
      for (const ev of f.events) { if (ev.type === 'daze' && ev.id === u.id) daze.push(f.t); if (ev.type === 'miss' && ev.uid === u.id) miss.push(f.t); }
      f.events.length = 0;
    }
    return { f, u, daze, miss };
  }
  it('집중이 15보다 낮으면 긴 전투일수록 잠깐 멍함 (처음 20초는 없음), 15 이상은 없음', () => {
    let early = 0, late = 0, n = 0;
    for (let s = 1; s <= 8; s++) {
      const { daze } = long({ focus: 1 }, 260, s);
      expect(daze.every(t => t >= STAT_ACT.dazeFirst)).toBe(true);
      early += daze.filter(t => t < 80).length; late += daze.filter(t => t >= 200).length; n += daze.length;
    }
    expect(n).toBeGreaterThan(20);
    expect(late).toBeGreaterThan(early); // 같은 60초라도 뒤쪽이 더 잦음
    for (const focus of [15, 20]) expect(long({ focus }, 260, 3).daze.length).toBe(0);
  });
  it('멍한 동안: 새 장판 반응을 멍이 끝날 때까지 미루고, 한 방이 더 빗나감 (기술 숙련 15라도)', () => {
    const f = fight({ st: { focus: 1 } }), u = who(f, '근');
    for (let i = 0; i < 40; i++) { E.step(f); f.events.length = 0; }
    u.dazeNext = Infinity; u.dazeUntil = f.t + 1.5;
    const tel = zoneTel(f, u);
    const r0 = { at: f.t, tel: tel.id };
    u.react = r0;
    const end = u.dazeUntil;
    while (f.t < end - 1e-9) { E.step(f); f.events.length = 0; expect(u.moving).toBeNull(); expect(u.react).toBe(r0); }
    for (let i = 0; i < 3; i++) { E.step(f); f.events.length = 0; }
    expect(u.react).not.toBe(r0); // 멍이 끝나자 반응함
    const on = long({ focus: 15, skill: 15 }, 60, 2, (_f, v) => { v.dazeNext = Infinity; v.dazeUntil = Infinity; }).miss.length;
    const off = long({ focus: 15, skill: 15 }, 60, 2).miss.length;
    expect(off).toBe(0);
    expect(on).toBeGreaterThan(5);
  });
  it('탱커가 멍한 동안은 위협 쌓기가 집중 배율 (이동 · 강타 때처럼)', () => {
    const run = (dz: boolean) => {
      const f = fight({ tank: { focus: 1 }, seed: 4 }), tk = who(f, '탱');
      f.bossHp = f.bossMax = 1e9;
      for (let i = 0; i < 200; i++) { if (dz) { tk.dazeNext = Infinity; tk.dazeUntil = Infinity; } E.step(f); f.events.length = 0; }
      return f.thr!.v.get(tk.id) ?? 0;
    };
    expect(run(true)).toBeLessThan(run(false) * 0.8);
  });
});

describe('맷집 「휘청」 · 「버팀」 (Lim 06:47 「능력치 하나하나 모두 의미있게」)', () => {
  /** 근접 딜러 (또는 탱커)에게 최대 체력 40% 한 방을 n번 (맞을 때마다 체력 · 휘청을 되돌림) */
  async function bigHits(st: Partial<Stats>, n: number, nick = '근') {
    const { damage } = await import('../src/engine/core');
    const f = nick === '탱' ? fight({ tank: st }) : fight({ st }), u = who(f, nick);
    for (let i = 0; i < 40; i++) { E.step(f); f.events.length = 0; }
    let reel = 0, steady = 0;
    for (let i = 0; i < n; i++) {
      u.hp = u.max; u.staggerUntil = undefined; u.steadyAt = undefined;
      damage(f, u, (u.max * 0.4) / f.dmgMult, false, 'fixed');
      for (const ev of f.events) if (ev.type === 'stagger' && ev.id === u.id) { if (ev.steady) steady++; else reel++; }
      f.events.length = 0;
    }
    return { f, u, reel, steady };
  }
  it('맷집이 15보다 낮으면 큰 한 방 뒤 휘청 (1 = 70%), 15는 없음, 15 넘으면 휘청 대신 버팀', async () => {
    const lo = await bigHits({ tough: 1 }, 300), par = await bigHits({ tough: 15 }, 200), hi = await bigHits({ tough: 20 }, 200);
    expect(lo.reel / 300).toBeGreaterThan(STAT_ACT.stagger - 0.08); expect(lo.reel / 300).toBeLessThan(STAT_ACT.stagger + 0.08);
    expect(par.reel + par.steady).toBe(0);
    expect(hi.reel).toBe(0); expect(hi.steady).toBe(200);
  });
  it('작은 피해 · 틱 피해로는 휘청하지 않음', async () => {
    const { damage, dripDamage } = await import('../src/engine/core');
    const f = fight({ st: { tough: 1 } }), u = who(f, '근');
    for (let i = 0; i < 40; i++) { E.step(f); f.events.length = 0; }
    for (let i = 0; i < 100; i++) { u.hp = u.max; damage(f, u, (u.max * 0.2) / f.dmgMult, false, 'fixed'); dripDamage(f, u, (u.max * 0.4) / f.dmgMult, false, 'fixed'); }
    expect(f.events.some(ev => ev.type === 'stagger')).toBe(false);
  });
  it('휘청하는 동안: 딜 0 · 새 장판 반응을 미룸, 끝나면 그대로', async () => {
    const { unitDps } = await import('../src/engine/units');
    const f = fight({ st: { tough: 1 } }), u = who(f, '근');
    for (let i = 0; i < 40; i++) { E.step(f); f.events.length = 0; }
    const d0 = unitDps(u, f);
    u.staggerUntil = f.t + STAT_ACT.staggerSec;
    expect(d0).toBeGreaterThan(0); expect(unitDps(u, f)).toBe(0);
    const tel = zoneTel(f, u), r0 = { at: f.t, tel: tel.id };
    u.react = r0;
    while (f.t < u.staggerUntil - 1e-9) { E.step(f); f.events.length = 0; expect(u.react).toBe(r0); }
    for (let i = 0; i < 3; i++) { E.step(f); f.events.length = 0; }
    expect(u.react).not.toBe(r0);
  });
  it('맷집 20 탱커는 강타를 맞은 1초에도 위협을 그대로 쌓음 (버팀)', async () => {
    const run = async (tough: number) => {
      const { f, u } = await bigHits({ tough, focus: 1 }, 1, '탱');
      u.busterAt = f.t;
      const v0 = f.thr!.v.get(u.id) ?? 0;
      for (let i = 0; i < 10; i++) { E.step(f); f.events.length = 0; }
      return (f.thr!.v.get(u.id) ?? 0) - v0 * Math.pow(0.5, 10 * E.DT / THREAT.half);
    };
    expect(await run(20)).toBeGreaterThan(await run(15) * 1.3);
  });
});
