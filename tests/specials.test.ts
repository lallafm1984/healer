/** 장비 특수능력 118종 + 이름 있는 장신구 16개 (42): 켜면 효과가 나고, 없으면 옛 결과 그대로 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NAMED, SPEC_GROUPS, SPEC_KEYS, SPECS, specText, specTotals, specValue } from '../src/data/specials';
import { SKILLS } from '../src/data/skills';
import * as E from '../src/engine';
import { addDebuff, damage, heal } from '../src/engine/core';
import { areaRadius, castOf, cdOf, costOf } from '../src/engine/talents';
import { critBonus, during, hasteOf, hotDone, intAmt, specBuster, specCut, specPhase, specTel } from '../src/engine/specials';
import { moveTo, scheduleReactions } from '../src/engine/movement';
import { reviveUnit } from '../src/engine/items';
import { orderHeal, runEffect } from '../src/engine/bossParts';
import type { BossSkill, Telegraph } from '../src/engine';
import { putHot } from '../src/engine/heroes';

type F = ReturnType<typeof E.create>;
type U = F['party'][number];
type Hero = 'priest' | 'druid' | 'paladin';
const fight = (specs: Record<string, number> = {}, hero?: Hero) => {
  const f = E.create({ encounter: 'plague', diff: '보통', seed: 7, level: 100, hero, specs });
  f.gear.crit = 0;
  f.power = 1; f.dmgMult = 1; // 힐·피해를 기본 단위로: 특수능력 효과만 봄
  f.skills.forEach(s => { s.next = Infinity; }); // 보스 기술은 끔
  return f;
};
/** 그 특수능력만 켠 전투와 아무것도 없는 전투 */
const pair = (k: string, v: number, hero?: Hero): [F, F] => [fight({ [k]: v }, hero), fight({}, hero)];
const step = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
/** 스킬을 쓰고 시전이 끝날 때까지. 그동안 생긴 힐 이벤트 */
const cast = (f: F, key: Parameters<typeof E.use>[1], u: U) => {
  const r = E.use(f, key, u.cell);
  expect(r.ok, r.reason).toBe(true);
  const heals: { id: number; amt: number }[] = [];
  const grab = () => { for (const e of f.events) if (e.type === 'heal') heals.push(e); f.events.length = 0; };
  grab();
  let n = 0;
  while ((f.cast || f.gcd > 0 || f.queued) && n++ < 200) { E.step(f); grab(); }
  return heals;
};
/** 그 대상에게 들어간 직접 힐 양 */
const amtOn = (f: F, key: Parameters<typeof E.use>[1], u: U) => cast(f, key, u).find(e => e.id === u.id)!.amt;
const tank = (f: F, i = 0) => f.party.filter(u => u.role === 'tank')[i];
const dealer = (f: F, i = 0) => f.party.filter(u => u.role === 'melee' || u.role === 'ranged')[i];
const adj = (f: F, u: U) => f.party.filter(v => v !== u && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
const withAdj = (f: F, n = 1) => f.party.find(u => !u.me && adj(f, u).length >= n)!;
const hurt = (f: F, pct = 0.5) => { for (const u of f.party) u.hp = u.max * pct; };
/** 체력을 크게 (지속 힐이 다 들어가도 안 차게) */
const big = (f: F) => { for (const u of f.party) { u.base = u.max = 1e5; u.hp = 1e4; } };
const both = (fs: F[], fn: (f: F) => void) => fs.forEach(fn);
/** a/b 비율 (같은 장면에서 특수능력 있음/없음) */
const ratio = (a: number, b: number) => a / b;
const lost = (f: F, u: U, fn: () => void) => { const h = u.hp; fn(); return h - u.hp; };
const absorb = (u: U) => u.mods.find(m => m.k === 'absorb')?.v ?? 0;
/** 이번 틱 그 대상의 직접 힐 양 (없으면 0) */
const healOn = (f: F, id: number) => { for (const e of f.events) if (e.type === 'heal' && e.id === id) return e.amt; return 0; };

describe('데이터', () => {
  it('공통 94 + 직업 전용 24 = 118종, 키는 겹치지 않음, 이름 있는 장신구 16개', () => {
    expect(SPEC_KEYS.length).toBe(118);
    expect(new Set(SPEC_KEYS).size).toBe(118);
    const by = (g: string) => SPEC_KEYS.filter(k => SPECS[k].group === g).length;
    expect(Object.keys(SPEC_GROUPS).map(by)).toEqual([16, 16, 14, 12, 10, 8, 10, 8, 24]);
    expect(SPEC_KEYS.filter(k => SPECS[k].hero).length).toBe(24);
    expect(NAMED.length).toBe(16);
    expect(new Set([...SPEC_KEYS, ...NAMED.map(n => n.key)]).size).toBe(134);
  });
  it('직업 전용은 영웅 이상, 효과 글에 값이 들어감', () => {
    for (const k of SPEC_KEYS) {
      const d = SPECS[k];
      if (d.hero) expect(['영웅', '전설']).toContain(d.min);
      expect(specText(d, d.val)).not.toContain('{v}');
    }
    expect(specText(SPECS.warmTouch, 0.06)).toBe('단일 힐 회복량 +6%');
    expect(specText(SPECS.cleanHands, 1.5)).toBe('해제 재사용 −1.5초');
  });
  it('값 = 영웅 최대값 × 등급 배율 × 굴림, 값 고정은 그대로 (42 1-2)', () => {
    expect(specValue('warmTouch', '영웅', 1)).toBeCloseTo(0.06, 9);
    expect(specValue('warmTouch', '고급', 0.6)).toBeCloseTo(0.06 * 0.6 * 0.6, 9);
    expect(specValue('warmTouch', '전설', 1)).toBeCloseTo(0.072, 9);
    expect(specValue('lastBreath', '희귀', 0.7)).toBe(1);
    expect(specValue('nope', '영웅', 1)).toBe(0);
  });
  it('같은 것은 더하고 상한까지, 발동 · 값 고정 · 이름 있는 장신구는 가장 큰 것 하나, 직업 전용은 그 직업만 (42 1-3 · 1-5)', () => {
    const t = specTotals([
      { key: 'warmTouch', v: 0.2 }, { key: 'warmTouch', v: 0.2 }, // 상한 0.3
      { key: 'edgeTouch', v: 0.1 }, { key: 'edgeTouch', v: 0.12 }, // 상한 없음 → 0.22
      { key: 'sunHandful', v: 0.1 }, { key: 'sunHandful', v: 0.12 }, // 발동 → 0.12
      { key: 'lastBreath', v: 1 }, { key: 'lastBreath', v: 1 },
      { key: 'rustyCog', v: 0.15 },
      { key: 'deepWord', v: 0.1 }, { key: 'wideGrove', v: 0.05 },
      { key: 'nope', v: 1 },
    ], 'priest');
    expect(t).toEqual({ warmTouch: 0.3, edgeTouch: 0.22, sunHandful: 0.12, lastBreath: 1, rustyCog: 0.15, deepWord: 0.1 });
    expect(specTotals([{ key: 'deepWord', v: 0.1 }], 'druid')).toEqual({});
  });
  it('특수능력이 없으면 상태도 없음 (옛 결과 그대로)', () => {
    expect(fight().sp).toBeNull();
    expect(fight({ warmTouch: 0 }).sp).toBeNull();
    expect(E.create({ encounter: 'plague', diff: '보통', seed: 7, specs: { warmTouch: 0.1 }, proto: true }).sp).toBeNull();
  });
  it('모든 특수능력이 엔진에 붙어 있음', () => {
    const dir = 'src/engine/';
    const src = readdirSync(dir).filter(n => n.endsWith('.ts')).map(n => readFileSync(dir + n, 'utf8')).join('\n');
    for (const k of [...SPEC_KEYS, ...NAMED.map(n => n.key)]) expect(src, k).toMatch(new RegExp(`\\b${k}\\b`));
  });
});

describe('2-1 치유', () => {
  it('따스한 손끝: 단일 힐 +', () => {
    const [a, b] = pair('warmTouch', 0.1); both([a, b], f => hurt(f));
    expect(ratio(amtOn(a, 'heal', tank(a)), amtOn(b, 'heal', tank(b)))).toBeCloseTo(1.1, 2);
  });
  it('넓은 품: 광역 힐 +, 단일 힐은 그대로', () => {
    const [a, b] = pair('wideEmbrace', 0.1); both([a, b], f => hurt(f));
    expect(ratio(amtOn(a, 'poh', tank(a)), amtOn(b, 'poh', tank(b)))).toBeCloseTo(1.1, 2);
    expect(ratio(amtOn(a, 'heal', tank(a)), amtOn(b, 'heal', tank(b)))).toBeCloseTo(1, 2);
  });
  it('오래 머무는 빛: 지속 힐 +', () => {
    const [a, b] = pair('lingerLight', 0.2); both([a, b], f => hurt(f, 0.1));
    both([a, b], f => { cast(f, 'renew', tank(f)); step(f, 10); });
    expect(ratio(tank(a).got, tank(b).got)).toBeCloseTo(1.2, 2);
  });
  it('방패지기의 벗: 탱커에게만 +', () => {
    const [a, b] = pair('shieldFriend', 0.1); both([a, b], f => hurt(f));
    expect(ratio(amtOn(a, 'heal', tank(a)), amtOn(b, 'heal', tank(b)))).toBeCloseTo(1.1, 2);
    expect(ratio(amtOn(a, 'heal', dealer(a)), amtOn(b, 'heal', dealer(b)))).toBeCloseTo(1, 2);
  });
  it('아슬아슬한 손길: 체력 35% 아래만 +', () => {
    const [a, b] = pair('edgeTouch', 0.15); both([a, b], f => hurt(f, 0.3));
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.15, 2);
    both([a, b], f => hurt(f, 0.5));
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1, 2);
  });
  it('첫 마디: 전투 시작 20초 동안만 +', () => {
    const [a, b] = pair('firstWord', 0.12); both([a, b], f => hurt(f));
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.12, 2);
    both([a, b], f => { f.t = 30; });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1, 2);
  });
  it('뒷심: 보스 체력 30% 아래에서 +', () => {
    const [a, b] = pair('secondWind', 0.08); both([a, b], f => { hurt(f); f.bossHp = f.bossMax * 0.2; });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.08, 2);
  });
  it('단골 손님: 같은 대상 두 번째부터 +', () => {
    const [a, b] = pair('regular', 0.1); both([a, b], f => hurt(f, 0.1));
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1, 2);
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.1, 2);
  });
  it('고루고루: 대상을 바꾸면 +', () => {
    const [a, b] = pair('evenly', 0.1); both([a, b], f => hurt(f, 0.1));
    amtOn(a, 'flash', tank(a)); amtOn(b, 'flash', tank(b));
    expect(ratio(amtOn(a, 'flash', tank(a, 1)), amtOn(b, 'flash', tank(b, 1)))).toBeCloseTo(1.1, 2);
    expect(ratio(amtOn(a, 'flash', tank(a, 1)), amtOn(b, 'flash', tank(b, 1)))).toBeCloseTo(1, 2);
  });
  it('다정한 치명타: 치명타 치유량 +', () => {
    const [a, b] = pair('kindCrit', 0.12); both([a, b], f => { hurt(f); f.gear.crit = 1; });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.12, 2);
  });
  it('튀는 빛: 직접 힐 치명타면 옆 칸 1명에게', () => {
    const [a, b] = pair('bounceLight', 0.3); both([a, b], f => { hurt(f); f.gear.crit = 1; });
    const ua = withAdj(a), ub = withAdj(b);
    expect(cast(a, 'flash', ua).some(e => e.id !== ua.id && e.amt === Math.round(250 * 1.5 * 0.3))).toBe(true);
    expect(cast(b, 'flash', ub).some(e => e.id !== ub.id)).toBe(false);
  });
  it('덧바름: 지속 힐이 걸린 대상에게 +', () => {
    const [a, b] = pair('layer', 0.08); both([a, b], f => { hurt(f); tank(f).hot = 9; });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.08, 2);
  });
  it('큰 그릇: 광역 힐이 4명 이상 맞으면 +', () => {
    const [a, b] = pair('bigBowl', 0.1); both([a, b], f => hurt(f));
    const ua = withAdj(a, 3), ub = withAdj(b, 3);
    expect(ratio(amtOn(a, 'poh', ua), amtOn(b, 'poh', ub))).toBeCloseTo(1.1, 2);
  });
  it('느긋한 손: 시전 2초 이상 힐만 + (치유 2.5초 +, 순간 치유 1.5초 그대로)', () => {
    const [a, b] = pair('slowHand', 0.08); both([a, b], f => hurt(f));
    expect(ratio(amtOn(a, 'heal', tank(a)), amtOn(b, 'heal', tank(b)))).toBeCloseTo(1.08, 2);
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1, 2);
  });
  it('빠른 응급: 즉시 시전 힐만 + (빛 일격 +, 빛의 손길 그대로)', () => {
    const [a, b] = pair('quickAid', 0.06, 'paladin'); both([a, b], f => hurt(f));
    expect(ratio(amtOn(a, 'holyStrike', dealer(a)), amtOn(b, 'holyStrike', dealer(b)))).toBeCloseTo(1.06, 2);
    expect(ratio(amtOn(a, 'holyLight', dealer(a)), amtOn(b, 'holyLight', dealer(b)))).toBeCloseTo(1, 2);
  });
  it('넘치는 정: 과치유가 체력이 가장 낮은 파티원에게', () => {
    const [a, b] = pair('overflowKind', 0.2);
    both([a, b], f => { for (const u of f.party) u.hp = u.max; dealer(f, 2).hp = dealer(f, 2).max * 0.3; });
    const ga = lost(a, dealer(a, 2), () => cast(a, 'flash', tank(a)));
    expect(-ga).toBeCloseTo(250 * 0.2, 0); // 메아리 치유의 과치유도 조금 옮겨 감
    expect(lost(b, dealer(b, 2), () => cast(b, 'flash', tank(b)))).toBe(0);
  });
});

describe('2-2 발동', () => {
  it('햇살 한 줌: 힐을 시전하면 확률로 가속 (재사용 대기 동안 다시 안 켜짐)', () => {
    const [a, b] = pair('sunHandful', 0.12); both([a, b], f => hurt(f));
    a.rng = () => 0;
    cast(a, 'flash', tank(a)); cast(b, 'flash', tank(b));
    expect(hasteOf(a) - hasteOf(b)).toBeCloseTo(0.12, 9);
    expect(a.events.some(e => e.type === 'spec') || a.sp!.until.sunHandful > a.t).toBe(true);
    step(a, 8.1);
    expect(hasteOf(a)).toBeCloseTo(hasteOf(b), 9);
    cast(a, 'flash', tank(a));
    expect(hasteOf(a)).toBeCloseTo(hasteOf(b), 9); // 20초 재사용 대기
  });
  it('별똥별 소원: 치명타 힐이 나면 6초 동안 치명타 +', () => {
    const [a] = pair('wishStar', 0.08); hurt(a); a.gear.crit = 1;
    cast(a, 'flash', tank(a));
    expect(critBonus(a)).toBeCloseTo(0.08, 9);
    step(a, 6.1);
    expect(critBonus(a)).toBe(0);
  });
  it('바람 탄 발걸음: 즉시 시전 3번 이어 쓰면 다음 시전 힐이 즉시', () => {
    const [a, b] = pair('windStep', 1); both([a, b], f => hurt(f));
    both([a, b], f => { for (let i = 0; i < 3; i++) cast(f, 'renew', dealer(f, i)); });
    expect(castOf(a, 'heal')).toBe(0);
    expect(castOf(b, 'heal')).toBeGreaterThan(0);
    E.use(a, 'heal', tank(a).cell);
    expect(a.cast).toBeNull();
    expect(a.sp!.free).toBe(false);
  });
  it('꿀벌의 춤: 직접 힐 5번마다 다음 힐 +', () => {
    const [a, b] = pair('beeDance', 0.4);
    const amts = (f: F) => Array.from({ length: 6 }, () => { hurt(f, 0.1); return amtOn(f, 'flash', tank(f)); });
    const x = amts(a), y = amts(b);
    expect(ratio(x[4], y[4])).toBeCloseTo(1, 2);
    expect(ratio(x[5], y[5])).toBeCloseTo(1.4, 2);
  });
  it('무지개 조각: 힐을 시전하면 확률로 10초 동안 회복량 +', () => {
    const [a, b] = pair('rainbow', 0.1); both([a, b], f => hurt(f));
    a.rng = () => 0;
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.1, 2);
  });
  it('기운 넘침: 마나 90% 위에서 +', () => {
    const [a, b] = pair('brimming', 0.06); both([a, b], f => hurt(f));
    expect(ratio(amtOn(a, 'heal', tank(a)), amtOn(b, 'heal', tank(b)))).toBeCloseTo(1.06, 2);
    both([a, b], f => { f.mana = 50; });
    expect(ratio(amtOn(a, 'heal', tank(a)), amtOn(b, 'heal', tank(b)))).toBeCloseTo(1, 2);
  });
  it('굳센 결의: 파티원이 쓰러지면 10초 동안 가속 (전투당 2번)', () => {
    const [a, b] = pair('resolve', 0.2);
    both([a, b], f => damage(f, dealer(f), 1e9, false, 'fixed'));
    expect(hasteOf(a) - hasteOf(b)).toBeCloseTo(0.2, 9);
    step(a, 10.1);
    damage(a, dealer(a, 1), 1e9, false, 'fixed'); damage(a, dealer(a, 2), 1e9, false, 'fixed');
    expect(a.sp!.used.resolve).toBe(2);
  });
  it('한 번 더: 공대 쿨기를 쓴 뒤 12초 동안 회복량 +', () => {
    const [a, b] = pair('encore', 0.1);
    both([a, b], f => { cast(f, 'hymn', tank(f)); step(f, 4.2); hurt(f); });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.1, 2);
  });
  it('반딧불 무리: 지속 힐 틱마다 확률로 지능 비율 즉시 회복', () => {
    const [a] = pair('fireflies', 0.25); hurt(a, 0.1);
    a.rng = () => 0;
    cast(a, 'renew', tank(a));
    let n = 0;
    while (a.t < 10) { E.step(a); n += a.events.filter(e => e.type === 'heal' && e.id === tank(a).id && e.amt === Math.round(0.25 * 300)).length; a.events.length = 0; }
    expect(n).toBe(3);
  });
  it('바쁜 손: 쉬지 않고 시전하면 가속이 오르고, 3초 쉬면 사라짐', () => {
    const [a, b] = pair('busyHands', 0.06); both([a, b], f => hurt(f, 0.1));
    for (let i = 0; i < 3; i++) { cast(a, 'heal', tank(a)); cast(b, 'heal', tank(b)); }
    expect(hasteOf(a)).toBeGreaterThan(hasteOf(b));
    step(a, 3.2);
    expect(hasteOf(a)).toBeCloseTo(hasteOf(b), 9);
  });
  it('금빛 메아리: 광역 힐이 치명타면 3초 뒤 같은 자리에 한 번 더', () => {
    const [a, b] = pair('goldEcho', 0.4); both([a, b], f => { hurt(f, 0.1); f.gear.crit = 1; });
    const ua = withAdj(a, 2), ub = withAdj(b, 2);
    cast(a, 'poh', ua); cast(b, 'poh', ub);
    const later = (f: F) => { let n = 0; while (f.t < 8) { E.step(f); n += f.events.filter(e => e.type === 'heal').length; f.events.length = 0; } return n; };
    expect(later(a)).toBeGreaterThan(2);
    expect(later(b)).toBe(0);
  });
  it('잔잔한 물결: 10초 동안 힐을 안 받은 대상에게 첫 힐만 +', () => {
    const [a, b] = pair('calmRipple', 0.2); both([a, b], f => { hurt(f, 0.1); f.t = 30; });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.2, 2);
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1, 2);
  });
  it('북소리: 보스 큰 기술 예고가 뜨면 4초 동안 가속 (장판은 아님)', () => {
    const [a, b] = pair('drumbeat', 0.15);
    specTel(a, { kind: 'zone' } as never);
    expect(hasteOf(a)).toBeCloseTo(hasteOf(b), 9);
    specTel(a, { kind: 'buster' } as never);
    expect(hasteOf(a) - hasteOf(b)).toBeCloseTo(0.15, 9);
  });
  it('해돋이: 보스 페이즈가 바뀌면 8초 동안 회복량 +', () => {
    const [a, b] = pair('sunrise', 0.15); both([a, b], f => hurt(f));
    specPhase(a);
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.15, 2);
  });
  it('용기의 노래: 탱커가 30% 아래로 내려가면 5초 동안 탱커 힐 +', () => {
    const [a, b] = pair('braveSong', 0.25);
    both([a, b], f => { hurt(f, 0.31); damage(f, tank(f), tank(f).max * 0.05, false, 'fixed'); });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.25, 2);
  });
  it('별자리: 서로 다른 스킬 4개를 이어 쓰면 6초 동안 회복량 +', () => {
    const [a, b] = pair('constellation', 0.15); both([a, b], f => hurt(f, 0.1));
    both([a, b], f => { cast(f, 'renew', dealer(f)); cast(f, 'flash', dealer(f)); cast(f, 'heal', dealer(f)); cast(f, 'poh', dealer(f)); });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.15, 2);
  });
});

describe('2-3 보호', () => {
  it('비눗방울: 직접 힐 과치유의 일부가 보호막', () => {
    const [a, b] = pair('bubble', 0.3); both([a, b], f => { tank(f).hp = tank(f).max; });
    cast(a, 'flash', tank(a)); cast(b, 'flash', tank(b));
    expect(absorb(tank(a))).toBeCloseTo(250 * 0.3, 4);
    expect(absorb(tank(b))).toBe(0);
    expect(lost(a, tank(a), () => damage(a, tank(a), 50, false, 'fixed'))).toBe(0);
  });
  it('깃털 이불: 체력 25% 아래 대상 직접 힐에 보호막 (대상마다 20초에 한 번)', () => {
    const [a] = pair('featherQuilt', 0.4); hurt(a, 0.2);
    cast(a, 'flash', tank(a));
    expect(absorb(tank(a))).toBeCloseTo(0.4 * 300, 4);
    tank(a).mods = []; hurt(a, 0.2);
    cast(a, 'flash', tank(a));
    expect(absorb(tank(a))).toBe(0);
  });
  it('든든한 등: 지속 힐이 걸린 탱커는 받는 피해 −', () => {
    const [a, b] = pair('sturdyBack', 0.05); both([a, b], f => { hurt(f); tank(f).hot = 9; });
    expect(lost(a, tank(a), () => damage(a, tank(a), 100, false, 'fixed'))).toBeCloseTo(95, 6);
    expect(lost(b, tank(b), () => damage(b, tank(b), 100, false, 'fixed'))).toBeCloseTo(100, 6);
  });
  it('마지막 버팀: 내 체력이 40% 아래로 내려가면 8초 동안 받는 피해 − (전투당 1번)', () => {
    const [a] = pair('lastStand', 0.25);
    damage(a, a.me, a.me.max * 0.65, false, 'fixed');
    expect(lost(a, a.me, () => damage(a, a.me, 40, false, 'fixed'))).toBeCloseTo(30, 6);
  });
  it('함께 버티기: 광역 힐을 맞은 파티원은 4초 동안 광역 피해 −', () => {
    const [a] = pair('holdTogether', 0.06); hurt(a);
    const u = withAdj(a, 2);
    cast(a, 'poh', u);
    expect(lost(a, u, () => damage(a, u, 100, true, 'fixed'))).toBeCloseTo(94, 6);
    expect(lost(a, u, () => damage(a, u, 100, false, 'fixed'))).toBeCloseTo(100, 6);
  });
  it('마지막 숨: 파티원이 쓰러질 피해를 받으면 체력 1로 버팀 (전투당 1번)', () => {
    const [a] = pair('lastBreath', 1);
    damage(a, dealer(a), 1e9, false, 'fixed');
    expect(dealer(a).alive).toBe(true);
    expect(dealer(a).hp).toBe(1);
    damage(a, dealer(a, 1), 1e9, false, 'fixed');
    expect(dealer(a, 1).alive).toBe(false);
  });
  it('수호의 깃: 생존기 효과 시간 +', () => {
    const [a, b] = pair('guardFeather', 0.25);
    both([a, b], f => cast(f, 'guardian', tank(f)));
    expect(tank(a).guardian - tank(b).guardian).toBeCloseTo(2.5, 6);
  });
  it('따뜻한 망토: 지속 피해 디버프가 걸린 아군에게 +', () => {
    const [a, b] = pair('warmCloak', 0.1); both([a, b], f => { hurt(f); addDebuff(f, tank(f), { name: '독', type: '독', left: 20, dot: 5 }); });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.1, 2);
  });
  it('일어서는 빛: 부활한 파티원 체력 +, 5초 동안 받는 피해 −30%', () => {
    const [a, b] = pair('risingLight', 0.2);
    both([a, b], f => { damage(f, dealer(f), 1e9, false, 'fixed'); reviveUnit(f, dealer(f), 0.3); });
    expect(dealer(a).hp / dealer(a).max).toBeCloseTo(0.5, 6);
    expect(dealer(b).hp / dealer(b).max).toBeCloseTo(0.3, 6);
    expect(lost(a, dealer(a), () => damage(a, dealer(a), 100, false, 'fixed'))).toBeCloseTo(70, 6);
  });
  it('단단한 껍데기: 내가 거는 보호막 +', () => {
    const a = fight({ bubble: 0.3, hardShell: 0.15 }), b = fight({ bubble: 0.3 });
    both([a, b], f => { tank(f).hp = tank(f).max; cast(f, 'flash', tank(f)); });
    expect(ratio(absorb(tank(a)), absorb(tank(b)))).toBeCloseTo(1.15, 6);
  });
  it('쌍둥이 방패: 생존기를 쓰면 옆 칸 1명에게도 절반 시간', () => {
    const [a, b] = pair('twinShield', 1);
    const ua = withAdj(a), ub = withAdj(b);
    cast(a, 'guardian', ua); cast(b, 'guardian', ub);
    expect(adj(a, ua).some(v => v.guardian > 3)).toBe(true); // 절반 5초 − 시전 뒤 GCD
    expect(adj(b, ub).some(v => v.guardian > 0)).toBe(false);
  });
  it('피난처 지도: 장판 예고 칸에 있는 아군에게 +', () => {
    const [a, b] = pair('shelterMap', 0.12); both([a, b], f => { hurt(f); f.tels.push({ kind: 'zone', cells: new Set([tank(f).cell]), impact: 99 } as never); });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.12, 2);
  });
  it('버팀목: 탱커가 2명이면 체력이 더 낮은 탱커가 받는 피해 −', () => {
    const [a] = pair('prop', 0.05);
    tank(a, 0).hp = tank(a, 0).max * 0.5; tank(a, 1).hp = tank(a, 1).max * 0.8;
    expect(lost(a, tank(a, 0), () => damage(a, tank(a, 0), 100, false, 'fixed'))).toBeCloseTo(95, 6);
    expect(lost(a, tank(a, 1), () => damage(a, tank(a, 1), 100, false, 'fixed'))).toBeCloseTo(100, 6);
  });
  it('별빛 장막: 체력 50% 아래 아군이 3명 이상이면 4초 동안 파티 전원 받는 피해 −', () => {
    const [a] = pair('starVeil', 0.08);
    for (let i = 0; i < 3; i++) dealer(a, i).hp = dealer(a, i).max * 0.4;
    step(a, 0.25);
    expect(a.party.filter(u => u.alive).every(u => u.mods.some(m => m.src === 'starVeil'))).toBe(true);
    expect(lost(a, tank(a), () => damage(a, tank(a), 100, false, 'fixed'))).toBeCloseTo(92, 6);
    step(a, 4.1);
    expect(tank(a).mods.length).toBe(0);
  });
});

describe('2-4 마나', () => {
  const gain = (f: F, from: number, sec: number) => { f.mana = from; const m = f.mana; step(f, sec); return f.mana - m; };
  it('샘물 한 모금: 마나 30% 아래에서 정신력 +', () => {
    const [a, b] = pair('springSip', 0.4);
    expect(ratio(gain(a, 10, 1), gain(b, 10, 1))).toBeCloseTo(1.4, 6);
    expect(ratio(gain(a, 50, 1), gain(b, 50, 1))).toBeCloseTo(1, 6);
  });
  it('아끼는 손: 체력 80% 위 대상 힐 마나 −', () => {
    const [a] = pair('thrifty', 0.2);
    tank(a).hp = tank(a).max; dealer(a).hp = dealer(a).max * 0.5;
    expect(costOf(a, 'heal', tank(a))).toBeCloseTo(3 * 0.8, 9);
    expect(costOf(a, 'heal', dealer(a))).toBe(3);
  });
  it('알뜰한 주머니: 즉시 시전 스킬 마나 − (공대 쿨기 빼고)', () => {
    const [a] = pair('pouch', 0.08);
    expect(costOf(a, 'renew')).toBeCloseTo(3 * 0.92, 9);
    expect(costOf(a, 'heal')).toBe(3);
    expect(costOf(a, 'hymn')).toBe(15);
  });
  it('깨달음: 치명타 힐이 나면 마나 회복', () => {
    const [a, b] = pair('insight', 0.6); both([a, b], f => { hurt(f); f.gear.crit = 1; f.mana = 50; cast(f, 'flash', tank(f)); });
    expect(a.mana - b.mana).toBeCloseTo(0.6, 6);
  });
  it('가벼운 숨: 과치유가 절반을 넘으면 마나 회복', () => {
    const [a, b] = pair('lightBreath', 0.3); both([a, b], f => { tank(f).hp = tank(f).max; f.mana = 50; cast(f, 'flash', tank(f)); });
    expect(a.mana - b.mana).toBeCloseTo(0.3, 6);
  });
  it('휴식의 차: 던전 구간 사이 휴식 마나 회복 +', () => {
    const [a, b] = pair('restTea', 0.5); both([a, b], f => { f.mana = 10; });
    expect(E.restCarry(a, 3).mana).toBeCloseTo(10 + 30 * 1.5, 6);
    expect(E.restCarry(b, 3).mana).toBeCloseTo(40, 6);
  });
  it('첫 잔: 전투 시작 15초 동안 마나 −', () => {
    const [a] = pair('firstCup', 0.3);
    expect(costOf(a, 'flash')).toBeCloseTo(6 * 0.7, 9);
    a.t = 20;
    expect(costOf(a, 'flash')).toBe(6);
  });
  it('해 질 녘: 보스 체력 20% 아래에서 마나 −', () => {
    const [a] = pair('dusk', 0.2); a.bossHp = a.bossMax * 0.1;
    expect(costOf(a, 'flash')).toBeCloseTo(6 * 0.8, 9);
  });
  it('물약 단골: 마나 물약 · 명상의 물약 회복량 +', () => {
    const [a, b] = pair('potionRegular', 0.3);
    both([a, b], f => { f.items = { mana: 1, medit: 1 }; f.mana = 10; E.useItem(f, 'mana'); });
    expect(a.mana).toBeCloseTo(10 + 39, 6);
    expect(b.mana).toBeCloseTo(40, 6);
    both([a, b], f => { f.potCd = 0; E.useItem(f, 'medit'); });
    expect(ratio(gain(a, 10, 1), gain(b, 10, 1))).toBeCloseTo((1 + 1.5 * 1.3) / 2.5, 6);
  });
  it('고요한 순간: 3초 동안 스킬을 안 쓰면 정신력 +', () => {
    const [a, b] = pair('stillMoment', 0.8);
    both([a, b], f => step(f, 4));
    expect(ratio(gain(a, 50, 1), gain(b, 50, 1))).toBeCloseTo(1.8, 6);
  });
  it('고마운 손: 해제를 하면 마나 회복', () => {
    const [a, b] = pair('thankHand', 0.8);
    both([a, b], f => { f.mana = 50; addDebuff(f, tank(f), { name: '저주', type: '마법', left: 20 }); cast(f, 'purify', tank(f)); });
    expect(a.mana - b.mana).toBeCloseTo(0.8, 6);
  });
  it('공대의 숨결: 공대 쿨기 마나 −', () => {
    const [a] = pair('raidBreath', 0.3);
    expect(costOf(a, 'hymn')).toBeCloseTo(15 * 0.7, 9);
  });
});

describe('2-5 해제', () => {
  const dispel = (f: F, u: U, d: Partial<Parameters<typeof addDebuff>[2]> = {}) => { addDebuff(f, u, { name: '저주', type: '마법', left: 20, ...d }); return cast(f, 'purify', u); };
  it('깨끗한 손: 해제 재사용 −초', () => {
    expect(cdOf(fight({ cleanHands: 1.5 }), 'purify')).toBeCloseTo(6.5, 9);
  });
  it('털어 내기: 해제한 대상 회복', () => {
    const [a] = pair('brushOff', 0.3); hurt(a);
    expect(dispel(a, tank(a)).find(e => e.id === tank(a).id)?.amt).toBe(Math.round(0.3 * 300));
  });
  it('두 번 털기: 확률로 재사용 대기 없이', () => {
    const [a, b] = pair('twiceBrush', 0.12);
    a.rng = () => 0;
    dispel(a, tank(a)); dispel(b, tank(b));
    expect(a.cd.purify).toBe(0);
    expect(b.cd.purify).toBeGreaterThan(0);
  });
  it('면역 향: 해제한 대상은 잠깐 같은 디버프에 안 걸림', () => {
    const [a, b] = pair('immuneIncense', 4);
    both([a, b], f => { dispel(f, tank(f)); addDebuff(f, tank(f), { name: '저주', type: '마법', left: 20 }); });
    expect(tank(a).debuffs.length).toBe(0);
    expect(tank(b).debuffs.length).toBe(1);
    step(a, 4.1);
    addDebuff(a, tank(a), { name: '저주', type: '마법', left: 20 });
    expect(tank(a).debuffs.length).toBe(1);
  });
  it('줄어드는 독기: 내가 지울 수 있는 디버프 지속 −', () => {
    const [a] = pair('fadingMiasma', 0.1);
    expect(addDebuff(a, tank(a), { name: '역병', type: '질병', left: 20 }).left).toBeCloseTo(18, 9);
    expect(addDebuff(a, tank(a), { name: '독침', type: '독', left: 20 }).left).toBe(20); // 사제는 독을 못 지움
  });
  it('함정 감지: 지우면 터지는 디버프의 터짐 피해 −', () => {
    const [a, b] = pair('trapSense', 0.3);
    const hit = (f: F) => { hurt(f, 0.9); const u = withAdj(f), v = adj(f, u)[0]; addDebuff(f, u, { name: '전염', type: '질병', left: 20, trap: true, end: { p: 'spread' } }); return lost(f, v, () => E.use(f, 'purify', u.cell)); };
    expect(ratio(hit(a), hit(b))).toBeCloseTo(0.7, 6);
  });
  it('감기약 · 해독초 · 마법 막이 · 저주 풀이: 그 종류 지속 피해 −', () => {
    for (const [k, type] of [['coldMedicine', '질병'], ['antidote', '독'], ['spellWard', '마법'], ['curseBreak', '저주']] as const) {
      const [a, b] = pair(k, 0.15);
      const dot = (f: F) => lost(f, tank(f), () => { addDebuff(f, tank(f), { name: 'x', type, left: 20, dot: 50 }); step(f, 1); });
      expect(ratio(dot(a), dot(b)), k).toBeCloseTo(0.85, 6);
    }
  });
});

describe('2-6 쿨기', () => {
  it('서두르는 별 · 생존기 단련: 재사용 −%', () => {
    expect(cdOf(fight({ hurryStar: 0.1 }), 'hymn')).toBeCloseTo(162, 9);
    expect(cdOf(fight({ survivalDrill: 0.1 }), 'guardian')).toBeCloseTo(81, 9);
  });
  it('길어진 노래: 공대 쿨기 효과 시간 +1초 (찬가 5번)', () => {
    const [a, b] = pair('longSong', 1); both([a, b], f => hurt(f, 0.1));
    const ticks = (f: F) => { E.use(f, 'hymn', tank(f).cell); let n = 0; while (f.t < 6) { E.step(f); n += f.events.filter(e => e.type === 'heal' && e.id === tank(f).id).length; f.events.length = 0; } return n; };
    expect(ticks(a)).toBe(5);
    expect(ticks(b)).toBe(4);
  });
  it('강한 합창: 공대 쿨기 회복량 +', () => {
    const [a] = pair('strongChorus', 0.12); hurt(a, 0.1);
    E.use(a, 'hymn', tank(a).cell);
    step(a, 0.5);
    let amt = 0;
    while (!amt) { E.step(a); amt = healOn(a, tank(a).id); a.events.length = 0; }
    expect(amt).toBe(Math.round(120 * 1.12));
  });
  it('되감기: 파티원이 쓰러지면 생존기 재사용 −', () => {
    const [a, b] = pair('rewind', 10);
    both([a, b], f => { f.cd.guardian = 50; damage(f, dealer(f), 1e9, false, 'fixed'); });
    expect(b.cd.guardian! - a.cd.guardian!).toBeCloseTo(10, 6);
  });
  it('위기의 직감: 파티 평균 체력 40% 아래면 공대 쿨기 2배 빨리', () => {
    const [a, b] = pair('crisisSense', 1);
    both([a, b], f => { hurt(f, 0.3); f.cd.hymn = 100; step(f, 1); });
    expect(100 - a.cd.hymn!).toBeCloseTo(2 * (100 - b.cd.hymn!), 6);
  });
  it('바쁜 하루: 해제를 하면 생존기 재사용 −', () => {
    const [a, b] = pair('busyDay', 2);
    both([a, b], f => { f.cd.guardian = 50; addDebuff(f, tank(f), { name: '저주', type: '마법', left: 20 }); cast(f, 'purify', tank(f)); });
    expect(b.cd.guardian! - a.cd.guardian!).toBeCloseTo(2, 6);
  });
  it('별의 시계: 공대 쿨기를 쓰면 해제 · 생존기 재사용 −', () => {
    const [a, b] = pair('starClock', 3);
    both([a, b], f => { f.cd.purify = 8; f.cd.guardian = 50; E.use(f, 'hymn', tank(f).cell); });
    expect(b.cd.purify! - a.cd.purify!).toBeCloseTo(3, 6);
    expect(b.cd.guardian! - a.cd.guardian!).toBeCloseTo(3, 6);
  });
});

describe('2-7 지원', () => {
  const dps = (f: F, u: U) => E.unitDps(u, f);
  it('응원 깃발: 체력 90% 위 딜러의 딜 +', () => {
    const [a, b] = pair('cheerFlag', 0.03);
    expect(ratio(dps(a, dealer(a)), dps(b, dealer(b)))).toBeCloseTo(1.03, 9);
    both([a, b], f => hurt(f));
    expect(ratio(dps(a, dealer(a)), dps(b, dealer(b)))).toBeCloseTo(1, 9);
  });
  it('든든한 밥심: 탱커 받는 피해 −', () => {
    const [a] = pair('heartyMeal', 0.03); hurt(a);
    expect(lost(a, tank(a), () => damage(a, tank(a), 100, false, 'fixed'))).toBeCloseTo(97, 6);
    expect(lost(a, dealer(a), () => damage(a, dealer(a), 100, false, 'fixed'))).toBeCloseTo(100, 6);
  });
  it('리듬 맞추기: 직접 힐을 받은 딜러는 6초 동안 딜 +', () => {
    const [a, b] = pair('rhythm', 0.04); both([a, b], f => { hurt(f); cast(f, 'flash', dealer(f)); });
    expect(ratio(dps(a, dealer(a)), dps(b, dealer(b)))).toBeCloseTo(1.04, 9);
  });
  it('사기 진작 · 활기찬 아침 · 끊기 박자: 파티 딜 +', () => {
    const [a, b] = pair('morale', 0.04); both([a, b], f => { hurt(f); f.bossHp = f.bossMax * 0.2; });
    expect(ratio(dps(a, tank(a)), dps(b, tank(b)))).toBeCloseTo(1.04, 9);
    const [c, d] = pair('brightMorning', 0.06); both([c, d], f => hurt(f));
    expect(ratio(dps(c, tank(c)), dps(d, tank(d)))).toBeCloseTo(1.06, 9);
    c.t = 20;
    expect(ratio(dps(c, tank(c)), dps(d, tank(d)))).toBeCloseTo(1, 9);
    const [g, h] = pair('cutBeat', 0.05); both([g, h], f => hurt(f));
    specCut(g);
    expect(ratio(dps(g, tank(g)), dps(h, tank(h)))).toBeCloseTo(1.05, 9);
  });
  it('앞장서기: 지속 힐이 걸린 탱커의 딜 +', () => {
    const [a, b] = pair('leadOn', 0.1); both([a, b], f => { hurt(f); tank(f).hot = 9; });
    expect(ratio(dps(a, tank(a)), dps(b, tank(b)))).toBeCloseTo(1.1, 9);
  });
  it('신나는 행진: 파티원 이동이 빨라짐', () => {
    const [a, b] = pair('march', 0.15);
    const t = (f: F) => { const u = dealer(f), c = f.cells.find(x => !x.unit && !x.block && E.hexDist(x, f.cells[u.cell]) === 1)!; moveTo(f, u, c); return u.moving!.left; };
    expect(ratio(t(a), t(b))).toBeCloseTo(0.85, 9);
  });
  it('정예 사냥꾼: 판 위 적이 있으면 파티 딜 +', () => {
    const [a, b] = pair('eliteHunter', 0.08); both([a, b], f => { hurt(f); f.mobs.push({ id: 999, name: '쫄', elite: false, hp: 100, max: 100, alive: true, add: { short: '쫄', on: tank(f).id, dmg: 0, every: 1, next: Infinity } }); });
    expect(ratio(dps(a, dealer(a)), dps(b, dealer(b)))).toBeCloseTo(1.08, 9);
  });
  it('눈치 빠른 동료: 장판을 피하는 반응이 빨라짐', () => {
    const [a, b] = pair('quickPeer', 0.3);
    const at = (f: F) => { const u = dealer(f); scheduleReactions(f, { id: 1, cells: new Set([u.cell]), impact: 9 } as never); return u.react!.at; };
    expect(at(b) - at(a)).toBeCloseTo(0.3, 9);
  });
});

describe('2-8 기믹', () => {
  it('맑은 눈: 뒤집힌 축복으로 들어가는 피해 −', () => {
    const [a, b] = pair('clearEye', 0.4);
    const hit = (f: F) => { hurt(f); addDebuff(f, tank(f), { name: '뒤집힌 축복', type: '마법', left: 20, invert: true }); return lost(f, tank(f), () => heal(f, tank(f), 100, true)); };
    expect(ratio(hit(a), hit(b))).toBeCloseTo(0.6, 6);
  });
  it('숫자 감각: 차례를 성공하면 보스 멍함 +', () => {
    const [a, b] = pair('numberSense', 1);
    both([a, b], f => { f.order = { name: '차례', ids: [dealer(f).id], i: 0, until: f.t + 10, wrong: 0, miss: 0, daze: { sec: 3, vuln: 1.2 } }; orderHeal(f, dealer(f)); });
    expect(a.daze!.until - b.daze!.until).toBeCloseTo(1, 9);
  });
  it('사슬 끊는 손: 감옥 체력 −', () => {
    const [a, b] = pair('chainBreaker', 0.2);
    both([a, b], f => runEffect(f, { name: '감옥' } as never, { p: 'jail', n: 1, name: '감옥', short: '옥', hp: 0.05, dot: 0 }));
    expect(ratio(a.mobs.at(-1)!.hp, b.mobs.at(-1)!.hp)).toBeCloseTo(0.8, 9);
  });
  it('폭탄 해체반: 폭탄 · 자폭 쫄 터짐 피해 −', () => {
    const [a] = pair('bombSquad', 0.2); hurt(a);
    expect(lost(a, tank(a), () => during(a, 'bomb', () => damage(a, tank(a), 100, true, 'fixed')))).toBeCloseTo(80, 6);
    expect(lost(a, tank(a), () => damage(a, tank(a), 100, true, 'fixed'))).toBeCloseTo(100, 6);
  });
  it('수정 깨기: 보호막 수정 · 치유 쫄에게 주는 파티 딜 +', () => {
    const [a, b] = pair('crystalBreak', 0.2);
    const hit = (f: F) => {
      f.mobs.push({ id: 999, name: '수정', elite: false, hp: 1e9, max: 1e9, alive: true, add: { short: '수', on: tank(f).id, dmg: 0, every: 1, next: Infinity, job: { p: 'pylon', cut: 0.5 }, jobAt: Infinity } });
      step(f, 5);
      return 1e9 - f.mobs.at(-1)!.hp;
    };
    expect(ratio(hit(a), hit(b))).toBeCloseTo(1.2, 6);
  });
  it('무거운 발: 끌려간 아군이 받는 피해 −', () => {
    const [a] = pair('heavyFeet', 0.15); hurt(a);
    dealer(a).pulled = { until: 99, cell: dealer(a).cell, dmg: 0 };
    expect(lost(a, dealer(a), () => damage(a, dealer(a), 100, false, 'fixed'))).toBeCloseTo(85, 6);
  });
  it('상처 소독: 쇠약 중첩 피해 −', () => {
    const [a, b] = pair('woundClean', 0.2);
    const hit = (f: F) => lost(f, tank(f), () => { addDebuff(f, tank(f), { name: '쇠약', type: '물리', left: 20, stack: 3, grow: { every: 99, dot: 50, max: 5 } }); step(f, 1); });
    expect(ratio(hit(a), hit(b))).toBeCloseTo(0.8, 6);
  });
  it('받치는 손: 받는 치유 감소 디버프 효과 −', () => {
    const [a, b] = pair('holdingHand', 0.25); both([a, b], f => { hurt(f); addDebuff(f, tank(f), { name: '얼룩', type: '물리', left: 20, healCut: 0.5 }); });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo((1 - 0.5 * 0.75) / 0.5, 2);
  });
});

describe('2-9 직업 전용: 사제', () => {
  it('깊은 성언: 게이지 충전 +', () => {
    const [a] = pair('deepWord', 0.12); hurt(a);
    cast(a, 'heal', tank(a));
    expect(a.g.p).toBeCloseTo(20 * 1.12, 9);
  });
  it('평온의 여운: 평온 +, 넘친 양은 4초 지속 힐', () => {
    const [a, b] = pair('serenityEcho', 0.2); both([a, b], f => { hurt(f, 0.1); f.g.p = 100; });
    expect(ratio(amtOn(a, 'serenity', tank(a)), amtOn(b, 'serenity', tank(b)))).toBeCloseTo(1.2, 2);
    both([a, b], f => { f.g.p = 100; tank(f).hp = tank(f).max * 0.95; cast(f, 'serenity', tank(f)); });
    expect(tank(a).hots.some(h => h.key === 'serenity')).toBe(true);
    expect(tank(b).hots.length).toBe(0);
  });
  it('넓은 신성화: 신성화 범위 +1칸', () => {
    const [a, b] = pair('wideSanctify', 1); both([a, b], f => { hurt(f); f.g.s = 100; });
    const far = (f: F, u: U) => f.party.find(v => E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 2)!;
    const ua = tank(a), ub = tank(b);
    expect(cast(a, 'sanctify', ua).some(e => e.id === far(a, ua).id)).toBe(true);
    expect(cast(b, 'sanctify', ub).some(e => e.id === far(b, ub).id)).toBe(false);
  });
  it('짙은 소생: 소생 회복량 +', () => {
    const [a, b] = pair('quickRenew', 0.25); both([a, b], f => { hurt(f, 0.1); cast(f, 'renew', tank(f)); step(f, 10); });
    expect(ratio(tank(a).got, tank(b).got)).toBeCloseTo(1.25, 2);
  });
  it('기원의 메아리: 치유의 기원이 확률로 2초 뒤 절반 한 번 더', () => {
    const [a] = pair('pohEcho', 0.5); hurt(a, 0.1);
    a.rng = () => 0;
    const u = withAdj(a, 2);
    cast(a, 'poh', u);
    let amt = 0;
    while (a.t < 6 && !amt) { E.step(a); amt = healOn(a, u.id); a.events.length = 0; }
    expect(amt).toBe(Math.round(180 * 0.5));
  });
  it('깨어 있는 수호: 수호 영혼이 발동하면 대상 회복', () => {
    const [a, b] = pair('wakeGuard', 1);
    both([a, b], f => { cast(f, 'guardian', dealer(f)); damage(f, dealer(f), 1e9, false, 'fixed'); });
    expect(dealer(b).hp / dealer(b).max).toBeCloseTo(0.4, 9);
    expect(dealer(a).hp - dealer(b).hp).toBeCloseTo(Math.min(300, dealer(a).max * 0.6), 6);
  });
  it('찬가의 숨결: 찬가 마나 −50%, 끊기지 않고 끝나면 마나 회복', () => {
    const [a, b] = pair('hymnBreath', 3);
    expect(costOf(a, 'hymn')).toBe(7.5);
    both([a, b], f => { f.mana = 50; E.use(f, 'hymn', tank(f).cell); step(f, 4.5); });
    expect(a.mana - b.mana).toBeCloseTo(7.5 + 3, 6);
  });
  it('순간의 빛: 순간 치유 시전 −초', () => {
    const [a, b] = pair('flashLight', 0.3);
    expect(castOf(b, 'flash') - castOf(a, 'flash')).toBeCloseTo(0.3 / (1 + a.gear.haste), 9);
  });
});

describe('2-9 직업 전용: 드루이드', () => {
  it('넓은 군락: 군락 보너스 칸마다 +', () => {
    const [a, b] = pair('wideGrove', 0.05, 'druid');
    const go = (f: F) => { big(f); const u = withAdj(f, 2); for (const v of adj(f, u).slice(0, 2)) putHot(v, 'sprout', { sec: 99, every: 99, total: 1 }); cast(f, 'sprout', u); step(f, 13); return u.got; };
    expect(ratio(go(a), go(b))).toBeCloseTo((1 + 2 * 0.15) / 1.2, 2);
  });
  it('옮겨 가는 새싹: 새싹이 끝까지 가면 옆 칸 1명에게 절반 시간 새싹 (다시 안 옮겨 감)', () => {
    const [a, b] = pair('sproutHop', 1, 'druid');
    const go = (f: F) => { hurt(f, 0.1); const u = withAdj(f); cast(f, 'sprout', u); step(f, 12.2); return adj(f, u).find(v => v.hots.some(h => h.key === 'sprout')); };
    const v = go(a)!;
    expect(v.hots.find(h => h.key === 'sprout')!.hop).toBe(true);
    expect(go(b)).toBeUndefined();
  });
  it('서두른 꽃 · 들꽃 바다 · 굵은 껍질 · 새벽 이슬 · 빠른 환생', () => {
    expect(cdOf(fight({ hastyBloom: 3 }, 'druid'), 'bloom')).toBe(9);
    expect(areaRadius(fight({ flowerSea: 1 }, 'druid'), 'wildflower')).toBe(2);
    const g = fight({ thickBark: 0.1 }, 'druid');
    cast(g, 'bark', tank(g));
    expect(tank(g).reduCut).toBeCloseTo(0.3, 9);
    const [a, b] = pair('dawnDew', 0.3, 'druid');
    expect(castOf(b, 'growth') - castOf(a, 'growth')).toBeCloseTo(0.3 / (1 + a.gear.haste), 9);
    const [c, d] = pair('quickRebirth', 0.2, 'druid');
    expect(castOf(d, 'rebirth') - castOf(c, 'rebirth')).toBeCloseTo(1 / (1 + c.gear.haste), 9);
    damage(c, dealer(c), 1e9, false, 'fixed');
    E.use(c, 'rebirth', 0); step(c, 3);
    expect(dealer(c).hp / dealer(c).max).toBeCloseTo(0.6, 9);
  });
  it('굵은 껍질이어도 나무껍질의 지속 힐 +20%는 그대로', () => {
    const [a, b] = pair('thickBark', 0.1, 'druid');
    both([a, b], f => { hurt(f, 0.1); cast(f, 'bark', tank(f)); cast(f, 'sprout', tank(f)); step(f, 13); });
    expect(ratio(tank(a).got, tank(b).got)).toBeCloseTo(1, 6);
  });
  it('숲의 숨결: 고요한 숲 효과 시간 +1초', () => {
    const [a, b] = pair('forestBreath', 1, 'druid');
    both([a, b], f => E.use(f, 'quietwood', 0));
    expect(a.channel - b.channel).toBeCloseTo(1, 9);
  });
});

describe('2-9 직업 전용: 성기사', () => {
  it('큰 봉화: 봉화로 함께 들어가는 몫 +', () => {
    const [a, b] = pair('bigBeacon', 0.1, 'paladin');
    const go = (f: F) => { hurt(f, 0.1); const bc = f.party.find(u => u.id === f.beacon)!; return -lost(f, bc, () => cast(f, 'holyLight', dealer(f))); };
    expect(ratio(go(a), go(b))).toBeCloseTo(0.5 / 0.4, 6);
  });
  it('두 번째 봉화: 다른 탱커에게 절반', () => {
    const [a, b] = pair('secondBeacon', 1, 'paladin');
    const go = (f: F) => { hurt(f, 0.1); return -lost(f, tank(f, 1), () => cast(f, 'holyLight', dealer(f))); };
    expect(go(a)).toBeCloseTo(260 * 0.4 * 0.5 * a.standin!.heal, 6); // 특성 트리 없는 직업 임시 보정까지
    expect(go(b)).toBeCloseTo(0, 9);
  });
  it('연타 · 단단한 서약 · 넘치는 신성한 힘 · 퍼지는 파도 · 긴 성역', () => {
    expect(cdOf(fight({ combo: 1.5 }, 'paladin'), 'holyStrike')).toBe(4.5);
    const [a, b] = pair('firmOath', 0.15, 'paladin');
    both([a, b], f => { big(f); f.power3 = 3; cast(f, 'oath', tank(f)); step(f, 13); });
    expect(ratio(tank(a).got, tank(b).got)).toBeCloseTo(1.15, 2);
    const p = fight({ morePower: 1 }, 'paladin'); hurt(p); p.power3 = 3;
    cast(p, 'holyLight', tank(p));
    expect(p.power3).toBe(4);
    expect(E.heroRing(p).value).toBe('4/4');
    const [c, d] = pair('wideWave', 1, 'paladin'); both([c, d], f => { hurt(f); f.power3 = 3; });
    const far = (f: F, u: U) => f.party.find(v => E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 2)!;
    expect(cast(c, 'lightWave', tank(c)).some(e => e.id === far(c, tank(c)).id)).toBe(true);
    expect(cast(d, 'lightWave', tank(d)).some(e => e.id === far(d, tank(d)).id)).toBe(false);
    const s = fight({ longSanctuary: 2 }, 'paladin');
    E.use(s, 'sanctuary', tank(s).cell);
    expect(s.sanctuary!.end - s.t).toBeCloseTo(12, 6);
  });
  it('기도하는 희생: 나눠 받는 비율 +, 내가 받는 것은 −20%', () => {
    const [a] = pair('prayingSacrifice', 0.1, 'paladin'); hurt(a);
    cast(a, 'sacrifice', tank(a));
    const me = lost(a, a.me, () => { expect(lost(a, tank(a), () => damage(a, tank(a), 100, false, 'fixed'))).toBeCloseTo(60, 6); });
    expect(me).toBeCloseTo(40 * 0.8 * a.standin!.guard, 6); // 특성 트리 없는 직업 임시 보정까지
  });
});

describe('3 이름 있는 장신구', () => {
  it('녹슨 톱니: 치유를 시전하면 확률로 가속', () => {
    const [a, b] = pair('rustyCog', 0.15); hurt(a); a.rng = () => 0;
    cast(a, 'flash', tank(a));
    expect(hasteOf(a) - hasteOf(b)).toBeCloseTo(0.15, 9);
  });
  it('역병 향로: 해제하면 대상에게 보호막 (재사용 15초)', () => {
    const [a] = pair('plagueCenser', 0.6);
    addDebuff(a, tank(a), { name: '저주', type: '마법', left: 20 });
    cast(a, 'purify', tank(a));
    expect(absorb(tank(a))).toBeCloseTo(0.6 * 300, 4);
  });
  it('두꺼비 부적: 마나 30% 아래로 내려가면 12초 동안 정신력 + (전투당 1번)', () => {
    const [a, b] = pair('toadCharm', 0.6);
    both([a, b], f => { f.mana = 10; step(f, 0.1); });
    const g = (f: F) => { const m = f.mana; step(f, 1); return f.mana - m; };
    expect(ratio(g(a), g(b))).toBeCloseTo(1.6, 6);
    expect(a.sp!.used.toadCharm).toBe(1);
  });
  it('귀부인의 초상: 체력 30% 아래 아군 직접 힐 +', () => {
    const [a, b] = pair('ladyPortrait', 0.2); both([a, b], f => hurt(f, 0.25));
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.2, 2);
  });
  it('얼어붙은 모래시계: 공대 쿨기를 쓰면 15초 동안 마나 −', () => {
    const [a] = pair('frozenHourglass', 0.3);
    E.use(a, 'hymn', tank(a).cell); step(a, 4.5);
    expect(costOf(a, 'flash')).toBeCloseTo(6 * 0.7, 9);
    step(a, 11);
    expect(costOf(a, 'flash')).toBe(6);
  });
  it('신전 성수병: 광역 힐이 4명 이상 회복하면 6초 동안 치명타 +', () => {
    const [a] = pair('templeVial', 0.1); hurt(a);
    cast(a, 'poh', withAdj(a, 3));
    expect(critBonus(a)).toBeCloseTo(0.1, 9);
  });
  const buster = (f: F, u: U) => ({ kind: 'buster', units: [u.id] }) as unknown as Telegraph;
  it('고철 호루라기: 탱커가 버스터를 맞으면 3초 동안 탱커 힐 +, 탱커 아닌 사람이 맞으면 없음', () => {
    const [a, b] = pair('scrapWhistle', 0.25); both([a, b], f => hurt(f));
    specBuster(a, buster(a, dealer(a)));
    expect(a.sp!.until.scrapWhistle).toBeUndefined();
    specBuster(a, buster(a, tank(a)));
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.25, 2);
    expect(ratio(amtOn(a, 'flash', dealer(a)), amtOn(b, 'flash', dealer(b)))).toBeCloseTo(1, 6);
    step(a, 3); step(b, 3);
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1, 6);
  });
  it('묘지기 등불: 지속 힐이 끝까지 가면 마나 + (2초에 한 번)', () => {
    const [a, b] = pair('graveLantern', 1); both([a, b], f => { hurt(f); f.mana = 50; cast(f, 'renew', tank(f)); });
    both([a, b], f => step(f, 20));
    expect(a.mana - b.mana).toBeCloseTo(1, 6);
    const m = a.mana; hotDone(a); hotDone(a);
    expect(a.mana - m).toBeCloseTo(1, 9);
    step(a, 2); a.mana = 50; hotDone(a);
    expect(a.mana).toBeCloseTo(51, 9);
  });
  it('거머리 병: 아군을 100%까지 채우면 4초 동안 가속 + (재사용 10초)', () => {
    const [a, b] = pair('leechJar', 0.1);
    tank(a).hp = tank(a).max - 1;
    heal(a, tank(a), 50, true);
    expect(hasteOf(a) - hasteOf(b)).toBeCloseTo(0.1, 9);
    step(a, 4.1);
    expect(hasteOf(a) - hasteOf(b)).toBeCloseTo(0, 9);
    tank(a).hp = tank(a).max - 1; heal(a, tank(a), 50, true);
    expect(hasteOf(a) - hasteOf(b)).toBeCloseTo(0, 9);
  });
  it('백합 코사지: 4초 안에 서로 다른 3명에게 직접 힐하면 다음 직접 힐 마나 0 (한 번)', () => {
    const [a] = pair('lilyCorsage', 1); hurt(a);
    const ts = [tank(a), dealer(a), dealer(a, 1)];
    cast(a, 'renew', ts[0]); cast(a, 'renew', ts[0]); cast(a, 'renew', ts[1]);
    expect(costOf(a, 'flash', tank(a))).toBe(6);
    cast(a, 'renew', ts[2]);
    expect(costOf(a, 'flash', tank(a))).toBe(0);
    expect(costOf(a, 'poh')).toBe(10);
    const m = a.mana; cast(a, 'flash', tank(a));
    expect(a.mana).toBeGreaterThanOrEqual(m);
    expect(costOf(a, 'flash', tank(a))).toBe(6);
  });
  it('눈꽃 결정: 진동에 시전이 끊기면 마나 +', () => {
    const [a, b] = pair('snowCrystal', 3);
    both([a, b], f => { hurt(f); f.mana = 50; E.use(f, 'heal', tank(f).cell); E.step(f); runEffect(f, { name: '진동' } as BossSkill, { p: 'quake', dmg: 0, lock: 2 }); });
    expect(a.cast).toBeNull();
    expect(a.mana - b.mana).toBeCloseTo(3, 6);
  });
  it('순례자 부적: 파티 전원이 체력 70% 이상이면 정신력 +', () => {
    const [a, b] = pair('pilgrimCharm', 0.3);
    const g = (f: F) => { f.mana = 50; const m = f.mana; step(f, 1); return f.mana - m; };
    expect(ratio(g(a), g(b))).toBeCloseTo(1.3, 6);
    both([a, b], f => { dealer(f).hp = dealer(f).max * 0.6; });
    expect(ratio(g(a), g(b))).toBeCloseTo(1, 6);
  });
  it('닳은 묵주: 바로 앞과 다른 유형을 해제하면 해제 재사용 대기 −', () => {
    const [a, b] = pair('wornRosary', 2);
    const purify = (f: F, u: U, type: '마법' | '질병') => { addDebuff(f, u, { name: type, type, left: 30 }); cast(f, 'purify', u); };
    both([a, b], f => purify(f, tank(f), '마법'));
    expect(a.cd.purify).toBeCloseTo(b.cd.purify!, 6);
    both([a, b], f => step(f, 8.1));
    both([a, b], f => purify(f, dealer(f), '마법'));
    expect(a.cd.purify).toBeCloseTo(b.cd.purify!, 6);
    both([a, b], f => step(f, 8.1));
    both([a, b], f => purify(f, dealer(f), '질병'));
    expect(b.cd.purify! - a.cd.purify!).toBeCloseTo(2, 6);
  });
  it('검은 돌 부적: 옆 칸에 아군이 없는 아군 힐 +', () => {
    const [a, b] = pair('blackStone', 0.15); both([a, b], f => hurt(f));
    expect(ratio(amtOn(a, 'flash', withAdj(a)), amtOn(b, 'flash', withAdj(b)))).toBeCloseTo(1, 6);
    both([a, b], f => { const u = withAdj(f); for (const v of adj(f, u)) { v.alive = false; v.hp = 0; } f.party.find(x => x.id === u.id)!.hp = u.max * 0.5; });
    const lone = (f: F) => f.party.find(u => u.alive && !u.me && !adj(f, u).some(v => v.alive))!;
    expect(ratio(amtOn(a, 'flash', lone(a)), amtOn(b, 'flash', lone(b)))).toBeCloseTo(1.15, 2);
  });
  it('밧줄 매듭: 2초 안에 최대 체력 30% 넘게 잃으면 그 아군에게 보호막 (재사용 20초)', () => {
    const [a] = pair('ropeKnot', 0.5);
    const d = dealer(a), t = tank(a);
    damage(a, d, d.max * 0.2, false, 'fixed');
    expect(absorb(d)).toBe(0);
    step(a, 1);
    damage(a, d, d.max * 0.15, false, 'fixed');
    expect(absorb(d)).toBeCloseTo(Math.min(d.max * 0.5, 0.5 * 300), 4); // 보호막은 최대 체력 절반까지
    damage(a, t, t.max * 0.4, false, 'fixed');
    expect(absorb(t)).toBe(0);
  });
  it('군주의 향 주머니: 보이는 디버프가 2개 이상인 아군 힐 +', () => {
    const [a, b] = pair('lordIncense', 0.15); both([a, b], f => hurt(f));
    both([a, b], f => { addDebuff(f, tank(f), { name: '하나', type: '물리', left: 30 }); addDebuff(f, tank(f), { name: '숨은 것', type: '물리', left: 30, hide: true }); });
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1, 6);
    both([a, b], f => addDebuff(f, tank(f), { name: '둘', type: '물리', left: 30 }));
    expect(ratio(amtOn(a, 'flash', tank(a)), amtOn(b, 'flash', tank(b)))).toBeCloseTo(1.15, 2);
  });
});

describe('보호막 · 효과 시간', () => {
  it('보호막은 최대 체력 절반까지, 시간이 지나면 사라짐 (능력 파티원이 없어도)', () => {
    const f = fight({ bubble: 1 });
    expect(f.abOn).toBe(false);
    tank(f).hp = tank(f).max;
    for (let i = 0; i < 20; i++) { cast(f, 'flash', tank(f)); tank(f).hp = tank(f).max; }
    expect(absorb(tank(f))).toBeLessThanOrEqual(tank(f).max * 0.5 + 1e-6);
    step(f, 6.1);
    expect(tank(f).mods.length).toBe(0);
  });
  it('지능 비율은 장비 지능 · 레벨 배율을 따름', () => {
    const f = fight({ brushOff: 0.5 });
    f.gear.heal = 1.2; f.power = 2;
    expect(intAmt(f, 0.5)).toBeCloseTo(0.5 * 300 * 1.2 * 2, 9);
  });
  it('특수능력이 켜지면 칸 위에 이름 (spec 이벤트)', () => {
    const f = fight({ lastBreath: 1 });
    damage(f, dealer(f), 1e9, false, 'fixed');
    expect(f.events).toContainEqual({ type: 'spec', id: dealer(f).id, name: '마지막 숨' });
    expect(SKILLS.heal.cast).toBe(2.5);
  });
});
