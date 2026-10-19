/** 어그로 (96 문서, engine/threat): 위협 · 뺏기 · 되찾기 · 딜 줄이기 · 레벨 차이 · 힐러 위협 · 어그로 흘림 */
import { describe, expect, it } from 'vitest';
import type { ClassKey } from '../src/data/classes';
import { fmFx, STAT_KEYS, type Stats } from '../src/data/fm';
import type { PersName } from '../src/data/personalities';
import { THREAT } from '../src/data/rules';
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

describe('능력치 · 성격 · 레벨', () => {
  it('되찾기까지: 반응 1 → 8초 · 10 → 6초 · 20 → 4초, 기술 숙련 20 = × 0.9, 4~8초', () => {
    const a = fight({ tank: { st: { react: 1 } } });
    expect(retakeDelay(a, who(a, '탱'))).toBeCloseTo(8);
    const f = fight();
    expect(retakeDelay(f, who(f, '탱'))).toBeCloseTo(6);
    const g = fight({ tank: { st: { react: 20 } } });
    expect(retakeDelay(g, who(g, '탱'))).toBeCloseTo(4);
    const h = fight({ tank: { st: { skill: 20 } } });
    expect(retakeDelay(h, who(h, '탱'))).toBeCloseTo(5.4);
    const k = fight({ tank: { st: { react: 1, skill: 1 } } });
    expect(retakeDelay(k, who(k, '탱'))).toBeCloseTo(THREAT.retakeMax);
    const m = fight({ tank: { st: { react: 20, skill: 20 } } });
    expect(retakeDelay(m, who(m, '탱'))).toBeCloseTo(THREAT.retakeMin);
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
