/** 어그로 (96 문서, engine/threat): 위협 · 뺏기 · 되찾기 · 딜 줄이기 · 레벨 차이 · 힐러 위협 · 어그로 흘림 */
import { describe, expect, it } from 'vitest';
import type { ClassKey } from '../src/data/classes';
import { fmFx, STAT_KEYS, type Stats } from '../src/data/fm';
import type { PersName } from '../src/data/personalities';
import { STAT_ACT, THREAT } from '../src/data/rules';
import * as E from '../src/engine';
import { runEffect } from '../src/engine/bossParts';
import { heal } from '../src/engine/core';
import { aggroTarget } from '../src/engine/bosses';
import { bossTarget, easeAt, levelMult, retakeDelay, slipping, threatDps, threatTick } from '../src/engine/threat';
import type { BossSkill, RosterEntry } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const flat = (v: number, more: Partial<Stats> = {}): Stats => ({ ...(Object.fromEntries(STAT_KEYS.map(k => [k, v])) as Stats), ...more });
const R = (role: RosterEntry['role'], cls: ClassKey, pers: PersName, nick: string, o: { lv?: number; st?: Partial<Stats> } = {}): RosterEntry =>
  ({ role, cls, pers, nick, ab: role === 'tank' ? `${cls}.taunt` : role === 'melee' ? 'rogue.kick' : 'mage.blink', fm: { stats: flat(10, o.st), off: 0 }, ...(o.lv ? { lv: o.lv, pub: true } : {}) });
/** 5인: 탱커 · 도적 · 마법사 · 궁수, 보스 기술은 끔 (평타도). 칸 Lv 30 */
const fight = (o: { tank?: Parameters<typeof R>[4] & { pers?: PersName }; rogue?: Parameters<typeof R>[4] & { pers?: PersName }; diff?: '보통' | '악몽' } = {}): F => {
  const f = E.create({
    encounter: 'warden', diff: o.diff ?? '보통', seed: 1, stageLv: 30, heroLv: 30,
    party: [
      { ...R('tank', 'warrior', o.tank?.pers ?? '사교형', '탱', o.tank), ab: 'warrior.taunt' }, R('melee', 'rogue', o.rogue?.pers ?? '사교형', '근', o.rogue),
      R('ranged', 'mage', '사교형', '마'), { ...R('ranged', 'archer', '사교형', '궁'), ab: 'archer.rapid' },
    ],
  });
  f.skills.forEach(s => { s.next = Infinity; });
  return f;
};
const who = (f: F, nick: string) => f.party.find(u => u.nick === nick)!;
const steps = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
/** 탱커 위협 vT를 두고 그 사람 위협을 vT × r로 (레벨 같음) */
const setRatio = (f: F, nick: string, r: number) => { const t = f.thr!, tk = who(f, '탱'); t.v.set(who(f, nick).id, (t.v.get(tk.id) ?? 0) * r); };

describe('켜고 끄기', () => {
  it('파티원 능력이 있고 탱커가 있는 판만 (튜토리얼 · 옛 시드 파티 · 프로토타입은 끔)', () => {
    expect(fight().thr).toBeTruthy();
    expect(E.create({ encounter: 'warden', diff: '보통', seed: 1 }).thr).toBeNull(); // 시드 파티 (능력 없음)
    expect(E.create({ encounter: 'warden', diff: '보통', seed: 1, party: E.recruitParty('warden', 1) }).thr).toBeNull(); // 튜토리얼 파티
    expect(E.create({ encounter: 'warden', diff: '보통', seed: 1, party: E.recruitParty('warden', 1, { abilities: true }), proto: true }).thr).toBeNull();
  });

  it('탱커 위협은 딜러들이 준 딜의 평균 × K (보통 딜러 = 탱커의 1/K)', () => {
    const f = fight();
    steps(f, 20);
    const t = f.thr!, tk = who(f, '탱');
    const dealers = f.party.filter(u => u.role !== 'tank' && !u.me);
    const mean = dealers.reduce((a, u) => a + (t.v.get(u.id) ?? 0), 0) / dealers.length;
    expect((t.v.get(tk.id) ?? 0) / mean).toBeGreaterThan(THREAT.tank * 0.85);
    expect((t.v.get(tk.id) ?? 0) / mean).toBeLessThan(THREAT.tank * 1.15);
  });
});

describe('뺏기 · 되찾기', () => {
  it('선 (탱커 × 여유)을 dwell초 넘게 넘으면 보스가 그 딜러를 봄, 강타 예고 대상은 그대로 탱커', () => {
    const f = fight(), tk = who(f, '탱'), rg = who(f, '근');
    steps(f, 10);
    const L = THREAT.leeway['보통'];
    setRatio(f, '근', L * 1.3);
    threatTick(f);
    expect(f.thr!.steal).toBeNull(); // 아직 dwell 전
    for (let i = 0; i < Math.ceil(THREAT.dwell / E.DT) + 1; i++) { setRatio(f, '근', L * 1.3); threatTick(f); f.t += E.DT; }
    expect(f.thr!.steal?.id).toBe(rg.id);
    expect(bossTarget(f)).toBe(rg);
    expect(aggroTarget(f)).toBe(tk);
    expect(f.stats.steals).toBe(1);
  });

  it('뺏은 딜러는 자기 방어력으로 맞음 (Lim 2번 C: 근접 = 탱커가 받을 양의 5/3)', () => {
    const f = fight(), tk = who(f, '탱'), rg = who(f, '근');
    f.rng = () => 0.5;
    const hit = (u: typeof tk) => { const h0 = u.hp; runEffect(f, {} as BossSkill, { p: 'auto', dmg: 50 }); return h0 - u.hp; };
    const onTank = hit(tk);
    f.thr!.steal = { id: rg.id, at: f.t, stopAt: Infinity };
    const onRogue = hit(rg);
    expect(onRogue / onTank).toBeGreaterThan(1.4);
  });

  it('나를 보면 한 대 = 내 최대 체력 15% 안팎 (주시와 같은 방식)', () => {
    const f = fight(), me = f.me;
    f.rng = () => 0.5;
    f.thr!.steal = { id: me.id, at: f.t, stopAt: Infinity };
    const h0 = me.hp;
    runEffect(f, {} as BossSkill, { p: 'auto', dmg: 50 });
    expect((h0 - me.hp) / me.max).toBeGreaterThan(0.1);
    expect((h0 - me.hp) / me.max).toBeLessThanOrEqual(THREAT.healerHit + 1e-6);
  });

  it('침착: 뺏은 뒤 딜을 멈추기까지 (10 = 1초) · 2초 멈춘 뒤 줄여서 침, 탱커가 반응 시간 뒤 되찾음 (위협 = 뺏은 사람 × 1.1, 재사용 8초)', () => {
    const f = fight(), tk = who(f, '탱'), rg = who(f, '근');
    steps(f, 10);
    const t = f.thr!;
    t.steal = { id: rg.id, at: f.t, stopAt: f.t + 1 };
    t.retakeAt = f.t + retakeDelay(f, tk);
    expect(threatDps(f, rg)).toBe(1);
    f.t += 1;
    expect(threatDps(f, rg)).toBe(0);
    f.t += THREAT.stopSec; // 멈춘 뒤엔 되찾을 때까지 줄여서 침 (되찾기가 4~8초라 내내 멈추면 판 딜이 너무 빠짐)
    expect(threatDps(f, rg)).toBeCloseTo(1 - THREAT.ease);
    setRatio(f, '근', 2);
    f.t = t.retakeAt;
    const v = t.v.get(rg.id)!;
    threatTick(f);
    expect(t.steal).toBeNull();
    expect(t.v.get(tk.id)! / (v * Math.pow(0.5, E.DT / THREAT.half))).toBeCloseTo(THREAT.retakeMult, 1);
    expect(t.readyAt).toBeCloseTo(f.t + THREAT.retakeCd);
  });

  it('보스를 돌려준 딜러는 8초 동안 딜을 줄이고 다시 안 뺏음 (뺏고 멈추고 다시 뺏는 고리 없게)', () => {
    const f = fight(), rg = who(f, '근');
    steps(f, 10);
    f.thr!.steal = { id: rg.id, at: f.t, stopAt: f.t };
    f.thr!.retakeAt = f.t; // 탱커가 되찾음
    setRatio(f, '근', 0.5);
    threatTick(f);
    expect(f.thr!.steal).toBeNull();
    expect(rg.thrCool).toBeCloseTo(f.t + THREAT.cool);
    for (let i = 0; i < 40; i++) { setRatio(f, '근', THREAT.leeway['보통'] * 1.5); threatTick(f); f.t += E.DT; }
    expect(f.thr!.steal).toBeNull();
    expect(rg.thrEase).toBe(true);
  });

  it('되찾을 때까지는 위협이 식어도 보스가 그 사람을 봄 · 주황 띠도 그 사람 (2026-10-19 Lim 「바로 되찾아 온다」)', () => {
    const f = fight(), tk = who(f, '탱'), rg = who(f, '근');
    steps(f, 10);
    const t = f.thr!;
    t.steal = { id: rg.id, at: f.t, stopAt: f.t };
    t.retakeAt = f.t + retakeDelay(f, tk);
    for (let i = 0; i < 20; i++) { setRatio(f, '근', 0.3); threatTick(f); f.t += E.DT; }
    expect(t.steal?.id).toBe(rg.id);
    expect(bossTarget(f)?.id).toBe(rg.id);
    expect(t.warn).toContain(rg.id);
    f.t = t.retakeAt!;
    threatTick(f);
    expect(t.steal).toBeNull();
    expect(bossTarget(f)?.id).toBe(tk.id);
  });

  it('뺏은 딜러가 쓰러지면 보스가 바로 탱커에게', () => {
    const f = fight(), tk = who(f, '탱'), rg = who(f, '근');
    steps(f, 10);
    f.thr!.steal = { id: rg.id, at: f.t, stopAt: f.t };
    f.thr!.retakeAt = f.t + 6;
    rg.alive = false;
    threatTick(f);
    expect(f.thr!.steal).toBeNull();
    expect(bossTarget(f)?.id).toBe(tk.id);
  });
});

describe('되찾은 뒤 · 1열로 돌아온 뒤 (2026-10-27 Lim 「탱커가 1분가까이(거의 무한으로) 어그로를 못잡고 방황」)', () => {
  /** 탱커를 1열 밖 (row 1) 빈 칸 / 원래 칸으로 바로 옮김 */
  const moveTank = (f: F, cell: number) => { const tk = who(f, '탱'); f.cells[tk.cell].unit = null; f.cells[cell].unit = tk; tk.cell = cell; tk.home = cell; };

  it('되찾으면 탱커 위협 = 모두 가운데 가장 큰 위협 × 1.1 (뺏은 사람보다 센 딜러가 있어도), retakeLock초 동안은 아무도 못 뺏음', () => {
    const f = fight(), tk = who(f, '탱'), rg = who(f, '근'), mg = who(f, '마');
    steps(f, 10);
    const t = f.thr!;
    t.steal = { id: rg.id, at: f.t, stopAt: f.t };
    t.retakeAt = f.t;
    setRatio(f, '근', 1.2); setRatio(f, '마', 3);
    const vM = t.v.get(mg.id)!;
    threatTick(f);
    expect(t.steal).toBeNull();
    expect(t.v.get(tk.id)! / (vM * Math.pow(0.5, E.DT / THREAT.half))).toBeCloseTo(THREAT.retakeMult, 1);
    const end = f.t + THREAT.retakeLock - 0.1;
    while (f.t < end) { f.t += E.DT; setRatio(f, '마', THREAT.leeway['보통'] * 1.5); threatTick(f); expect(t.steal).toBeNull(); }
    for (let i = 0; i < 40 && !t.steal; i++) { f.t += E.DT; setRatio(f, '마', THREAT.leeway['보통'] * 1.5); threatTick(f); }
    expect(t.steal?.id).toBe(mg.id); // 잠금이 끝나면 다시 뺏을 수 있음
  });

  it('1열을 떠나 보스가 아무나 친 뒤 돌아오면 바로 잡음: 위협 = 가장 큰 위협 × 1.1 · retakeLock초 동안 못 뺏음', () => {
    const f = fight(), tk = who(f, '탱'), mg = who(f, '마');
    steps(f, 10);
    const t = f.thr!, home = tk.cell;
    moveTank(f, f.cells.find(c => c.row === 1 && !c.unit && !c.block)!.i);
    f.zones.push({ id: 9997, cells: new Set(f.cells.filter(c => c.row === 0).map(c => c.i)), end: Infinity, dps: 0 });
    steps(f, 1);
    expect(f.loose).not.toBeNull();
    f.zones = f.zones.filter(z => z.id !== 9997);
    moveTank(f, home);
    setRatio(f, '마', 3);
    const vM = t.v.get(mg.id)!;
    E.step(f); f.events.length = 0;
    expect(f.loose).toBeNull();
    expect(t.v.get(tk.id)!).toBeGreaterThan(vM * THREAT.retakeMult * 0.9);
    expect(t.lockUntil).toBeCloseTo(f.t + THREAT.retakeLock, 1);
    const end = f.t + THREAT.retakeLock - 0.2;
    while (f.t < end) { f.t += E.DT; setRatio(f, '마', THREAT.leeway['보통'] * 1.5); threatTick(f); expect(t.steal).toBeNull(); }
  });

  it('첫 도발: 뺏기기 시작하는 때 (start) 탱커가 되찾기처럼 잡음, 여는 기술이 센 딜러도 retakeLock초 동안 못 뺏음 (2026-10-27 Lim 「전투 시작하자마자 못 잡으면서 계속 반복」)', () => {
    const f = fight({ tank: { st: { skill: 20 } } }), tk = who(f, '탱'), rg = who(f, '근'); // 기술 숙련 20 = 첫 도발을 안 놓침
    const t = f.thr!;
    while (f.t < THREAT.start - E.DT) { E.step(f); f.events.length = 0; }
    expect(t.pulled).toBeFalsy();
    setRatio(f, '근', 3); // 여는 기술 한두 방으로 선을 크게 넘음
    const vR = t.v.get(rg.id)!;
    E.step(f); f.events.length = 0;
    expect(t.pulled).toBe(true);
    expect(t.v.get(tk.id)!).toBeGreaterThan(vR * THREAT.retakeMult * 0.9);
    expect(t.lockUntil).toBeCloseTo(f.t + THREAT.retakeLock, 1);
    const end = f.t + THREAT.retakeLock - 0.2;
    while (f.t < end) { f.t += E.DT; setRatio(f, '근', THREAT.leeway['보통'] * 1.5); threatTick(f); expect(t.steal).toBeNull(); }
  });

  it('첫 도발 놓침 (같은 날 Lim 「전투 시작부터 못 잡는경우도 있어야한다」): 기술 숙련 1 = 50% · 10 = 24% · 20 = 0, 놓치면 잠금 없이 위협 싸움', () => {
    const rate = (skill: number) => {
      let n = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const f = fight({ tank: { st: { skill } } });
        f.rng = E.rngFrom(seed);
        while (f.t < THREAT.start + E.DT && !f.thr!.pulled) { E.step(f); f.events.length = 0; }
        expect(f.thr!.pulled).toBe(true);
        if (f.thr!.pullMissed) { n++; expect(f.thr!.lockUntil).toBeUndefined(); }
      }
      return n / 200;
    };
    expect(STAT_ACT.pullMiss).toBe(0.5);
    expect(rate(20)).toBe(0);
    expect(rate(1)).toBeGreaterThan(0.38);
    expect(rate(1)).toBeLessThan(0.62);
    const r10 = rate(10);
    expect(r10).toBeGreaterThan(0.14);
    expect(r10).toBeLessThan(0.36);
  });

  it('판단 1 딜러가 뺏어 되찾기가 늦어져도 10초 안 (2026-10-25 Lim 「최대 10초」, 예전 × 1.5 = 15초까지)', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const f = fight({ tank: { st: { react: 1, skill: 1 } }, rogue: { st: { judgment: 1 } } }), rg = who(f, '근');
      f.rng = E.rngFrom(seed);
      steps(f, 10);
      const t = f.thr!;
      t.lockUntil = undefined; t.steal = null; t.retakeAt = null; t.readyAt = 0; t.over.clear();
      for (let i = 0; i < 40 && !t.steal; i++) { f.t += E.DT; setRatio(f, '근', 3); setRatio(f, '마', 0); setRatio(f, '궁', 0); threatTick(f); }
      expect(f.thr!.steal?.id).toBe(rg.id);
      expect(t.retakeAt! - f.t).toBeLessThanOrEqual(THREAT.retakeMax + 1e-9);
      expect(t.retakeAt! - f.t).toBeGreaterThanOrEqual(THREAT.retakeMin - 1e-9);
    }
  });
});

describe('능력치 · 성격 · 레벨', () => {
  it('되찾기까지 (2026-10-25 Lim): 반응 1 → 10초 · 10 → 6초 · 20 → 3초, 기술 숙련 1 · 20 = × 1.5 · × 0.5, 3~10초', () => {
    const a = fight({ tank: { st: { react: 1 } } });
    expect(retakeDelay(a, who(a, '탱'))).toBeCloseTo(10);
    const f = fight();
    expect(retakeDelay(f, who(f, '탱'))).toBeCloseTo(6);
    const g = fight({ tank: { st: { react: 20 } } });
    expect(retakeDelay(g, who(g, '탱'))).toBeCloseTo(3);
    const h = fight({ tank: { st: { skill: 20 } } });
    expect(retakeDelay(h, who(h, '탱'))).toBeCloseTo(3);
    const k = fight({ tank: { st: { react: 1, skill: 1 } } });
    expect(retakeDelay(k, who(k, '탱'))).toBeCloseTo(10);
    expect(THREAT.retakeMax).toBe(10);
    const m = fight({ tank: { st: { react: 20, skill: 20 } } });
    expect(retakeDelay(m, who(m, '탱'))).toBeCloseTo(3);
    expect(THREAT.retakeMin).toBe(3);
  });

  it('딜 줄이기 시작: 판단 1 → 안 줄임 · 10 → 85% · 20 → 70%, 딜 욕심쟁이 −5 · 신중파 +5 · 눈치백단 = 20', () => {
    const at = (o: NonNullable<Parameters<typeof fight>[0]>['rogue']) => { const f = fight({ rogue: o }); return easeAt(who(f, '근')); };
    expect(at({ st: { judgment: 1 } })).toBeGreaterThan(1);
    expect(at({})).toBeCloseTo(0.85);
    expect(at({ st: { judgment: 20 } })).toBeCloseTo(0.7);
    expect(at({ pers: '딜 욕심쟁이' })).toBeGreaterThan(0.85);
    expect(at({ pers: '신중파' })).toBeLessThan(0.85);
    expect(at({ pers: '눈치백단', st: { judgment: 3 } })).toBeCloseTo(0.7);
  });

  it('선 가까이 오면 딜 25% 줄임 (줄인 딜러 · 경고 테두리), 조금 내려가면 다시', () => {
    const f = fight(), rg = who(f, '근');
    steps(f, 10);
    const L = THREAT.leeway['보통'];
    setRatio(f, '근', L * 0.92);
    threatTick(f);
    expect(rg.thrEase).toBe(true);
    expect(threatDps(f, rg)).toBeCloseTo(1 - THREAT.ease);
    expect(f.thr!.warn).toContain(rg.id);
    setRatio(f, '근', L * 0.6);
    threatTick(f);
    expect(rg.thrEase).toBe(false);
  });

  it('레벨 차이: 탱커보다 1레벨 높을 때마다 위협 +4%, ×0.6 ~ ×2', () => {
    const f = fight({ tank: { lv: 30 }, rogue: { lv: 40 } });
    expect(levelMult(f, who(f, '근'), who(f, '탱'))).toBeCloseTo(1.4);
    const g = fight({ tank: { lv: 20 }, rogue: { lv: 60 } });
    expect(levelMult(g, who(g, '근'), who(g, '탱'))).toBe(THREAT.lvMax);
    const h = fight({ tank: { lv: 50 }, rogue: { lv: 30 } });
    expect(levelMult(h, who(h, '근'), who(h, '탱'))).toBe(THREAT.lvMin);
  });

  it('레벨이 훨씬 높은 딜러는 딜을 줄여도 뺏음 (악몽, 탱커보다 25레벨)', () => {
    const f = fight({ diff: '악몽', tank: { lv: 30 }, rogue: { lv: 55, st: { atk: 15 } } });
    steps(f, 60);
    expect(f.stats.steals ?? 0).toBeGreaterThan(0);
    const g = fight({ diff: '악몽' });
    steps(g, 60);
    expect(g.stats.steals ?? 0).toBe(0);
  });

  it('어그로 흘림: 딴생각 3초 동안 위협을 못 쌓음', () => {
    const f = fight({ tank: { pers: '어그로 흘림' } }), tk = who(f, '탱');
    steps(f, 15.2);
    expect(slipping(f, tk)).toBe(true);
    const v0 = f.thr!.v.get(tk.id)!;
    steps(f, 1);
    expect(f.thr!.v.get(tk.id)!).toBeLessThan(v0); // 반감만
  });

  it('주시가 있는 보스는 내 위협을 안 셈 (주시만)', () => {
    const f = fight();
    f.watch = { fill: 0, max: 1, rate: 1, until: 0, next: 0, sec: 6, every: 1.5, dmg: 1 };
    const h0 = f.thr!.heal;
    heal(f, who(f, '탱'), 100, true);
    expect(f.thr!.heal).toBe(h0);
  });
});

describe('능력치 효과는 유닛에 그대로', () => {
  it('fmStats = 능력치 + 그날 흔들림', () => {
    const f = fight({ tank: { st: { skill: 14 } } });
    expect(who(f, '탱').fmStats!.skill).toBe(14);
    expect(who(f, '탱').fm).toEqual(fmFx(flat(10, { skill: 14 }), 0));
  });
});

describe('고렙 어그로 대사 · 간격 (2026-10-19 Lim 「계속 어그로 뺏겨서 대사를 난발」)', () => {
  /** 보스를 뺏게 만든 순간의 대사 (사람 → 상황) */
  const stealBarks = (f: F, nick: string | 'me') => {
    const t = f.thr!, tk = who(f, '탱'), u = nick === 'me' ? f.me : who(f, nick);
    const out: { id: number; sit?: string; ally?: number }[] = [];
    for (const v of f.party) { v.aggroTalk = 0; v.aggroTalkAt = undefined; } // 앞선 경고 대사 간격 (10초) 없이 뺏는 순간만 봄
    for (let i = 0; i < 40 && !t.steal; i++) {
      if (nick === 'me') { t.heal = 1e9; t.taken = 1; } else t.v.set(u.id, (t.v.get(tk.id) ?? 1) * 3);
      E.step(f);
      for (const ev of f.events) if (ev.type === 'bark') out.push({ id: ev.id, sit: ev.sit, ally: (ev as { ally?: number }).ally });
      f.events.length = 0;
    }
    expect(t.steal?.id).toBe(u.id);
    return out;
  };
  it('힐러가 탱커보다 10레벨 넘게 높으면 탱커는 「고렙 힐러」 대사, 아니면 예전 「힐 어그로」', () => {
    const mk = (heroLv: number) => {
      const f = E.create({
        encounter: 'warden', diff: '보통', seed: 1, stageLv: 20, heroLv,
        party: [{ ...R('tank', 'warrior', '사교형', '탱', { lv: 20 }), ab: 'warrior.taunt' }, R('melee', 'rogue', '사교형', '근'), R('ranged', 'mage', '사교형', '마'), R('ranged', 'archer', '사교형', '궁')], // 딜러는 레벨업 점수 없이 (능력치 10, 먼저 뺏지 않게 · 104)
      });
      f.skills.forEach(s => { s.next = Infinity; });
      steps(f, 6);
      return stealBarks(f, 'me').filter(b => b.id === who(f, '탱').id).map(b => b.sit);
    };
    expect(mk(60)).toContain('aggroHealerHigh');
    expect(mk(22)).toContain('aggroHealer');
  });
  it('딜러가 탱커보다 10레벨 넘게 높으면 탱커 「고렙 딜러」 ({ally}) · 딜러 「고렙이라 뺏음」', () => {
    const f = fight({ tank: { lv: 30 }, rogue: { lv: 55, st: { judgment: 10, composure: 15 } } }), tk = who(f, '탱'), rg = who(f, '근');
    const b: { id: number; sit?: string; ally?: number }[] = [];
    while (!f.thr!.steal && f.t < 30) { // 레벨 차이 25라 저절로 뺏음 (처음부터 봄). 앞선 경고 대사 간격 (10초) 없이 뺏는 순간만 봄
      for (const v of f.party) { v.aggroTalk = 0; v.aggroTalkAt = undefined; }
      E.step(f);
      for (const ev of f.events) if (ev.type === 'bark') b.push({ id: ev.id, sit: ev.sit, ally: (ev as { ally?: number }).ally });
      f.events.length = 0;
    }
    expect(f.thr!.steal?.id).toBe(rg.id);
    expect(b.some(x => x.id === tk.id && x.sit === 'aggroDealerHigh' && x.ally === rg.id)).toBe(true);
    expect(b.filter(x => x.id === rg.id).map(x => x.sit)).toContain('aggroStealHigh');
  });
  it('한 탱커의 어그로 대사는 한 판에 첫 3번 뒤로는 드묾 (60초에 한 번 · 30%), 힐러가 뺏어도 「딜러 레벨 차이」 대사는 안 함', () => {
    const f = E.create({
      encounter: 'warden', diff: '보통', seed: 2, stageLv: 20, heroLv: 100,
      party: [{ ...R('tank', 'warrior', '사교형', '탱', { lv: 20 }), ab: 'warrior.taunt' }, R('melee', 'rogue', '사교형', '근', { lv: 20 }), R('ranged', 'mage', '사교형', '마', { lv: 20 }), R('ranged', 'archer', '사교형', '궁', { lv: 20 })],
    });
    f.skills.forEach(s => { s.next = Infinity; });
    f.bossHp = f.bossMax = 1e9;
    f.enraged = true; // 300초를 다 봄: 보스 빠르기 (data/pace)로 문지기 광폭화가 340 → 185초라 그 뒤 전멸하면 시간이 멈춤
    const tk = who(f, '탱'), said: { t: number; sit?: string }[] = [];
    while (f.t < 300 && !f.over) {
      f.thr!.heal = 1e9; f.thr!.taken = 1; // 힐러가 계속 뺏음
      E.step(f);
      for (const ev of f.events) if (ev.type === 'bark' && ev.id === tk.id && ev.sit?.startsWith('aggro')) said.push({ t: f.t, sit: ev.sit });
      f.events.length = 0;
    }
    expect(f.stats.healerSteals ?? 0).toBeGreaterThan(10);
    expect(said.length).toBeLessThanOrEqual(THREAT.talkFirst + Math.ceil(300 / THREAT.talkLate));
    for (let i = 1; i < said.length; i++) expect(said[i].t - said[i - 1].t).toBeGreaterThanOrEqual(THREAT.talkGap - 1e-6);
    expect(said.some(x => x.sit === 'aggroLevel')).toBe(false);
  });
});
