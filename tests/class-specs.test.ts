/** 직업 전용 특수능력 72종 (42 2-9, 2026-10-14 직업마다 8종 더): 데이터 · 고급부터 부위마다 고를 거리 · 엔진 훅 */
import { describe, expect, it } from 'vitest';
import { ITEM_GRADES, makeItem, SLOTS } from '../src/data/equipment';
import { HERO_KEYS, heroSkills } from '../src/data/heroes';
import { RELAY } from '../src/data/heroConst';
import { SKILLS } from '../src/data/skills';
import { SPEC_KEYS, SPECS, specTotals } from '../src/data/specials';
import * as E from '../src/engine';
import { addDebuff } from '../src/engine/core';
import { putHot } from '../src/engine/heroes';
import { hasteOf, intAmt } from '../src/engine/specials';
import { rngFrom } from '../src/engine/rng';
import { exchangeMerit, rollover } from '../src/game/economy';
import { G, lowGradeIds } from '../src/game/state';
import { heroSaveOf, newSave } from '../src/platform/storage';

type F = ReturnType<typeof E.create>;
type U = F['party'][number];
type Hero = 'priest' | 'druid' | 'paladin';
const fight = (specs: Record<string, number> = {}, hero?: Hero) => {
  const f = E.create({ encounter: 'plague', diff: '보통', seed: 7, level: 100, hero, specs });
  f.gear.crit = 0;
  f.power = 1; f.dmgMult = 1; f.gear.heal = 1;
  f.skills.forEach(s => { s.next = Infinity; });
  return f;
};
const pair = (k: string, v: number, hero?: Hero): [F, F] => [fight({ [k]: v }, hero), fight({}, hero)];
const both = (fs: F[], fn: (f: F) => void) => fs.forEach(fn);
const step = (f: F, sec: number) => { const end = f.t + sec; while (f.t < end - 1e-9 && !f.over) { E.step(f); f.events.length = 0; } };
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
const amtOn = (f: F, key: Parameters<typeof E.use>[1], u: U) => cast(f, key, u).find(e => e.id === u.id)!.amt;
const tank = (f: F) => f.party.filter(u => u.role === 'tank')[0];
const dealer = (f: F) => f.party.filter(u => u.role === 'melee' || u.role === 'ranged')[0];
const adj = (f: F, u: U) => f.party.filter(v => v !== u && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
const withAdj = (f: F, n = 1) => f.party.find(u => !u.me && adj(f, u).length >= n)!;
const hurt = (f: F, pct = 0.5) => { for (const u of f.party) u.hp = u.max * pct; };
const big = (f: F) => { for (const u of f.party) { u.base = u.max = 1e5; u.hp = 1e4; } };
const sprout = (u: U) => u.hots.find(h => h.key === 'sprout');
/** 긴 간격 표시용 지속 힐 (틱이 안 나오게) */
const mark = (u: U, key: 'sprout' | 'wildflower') => putHot(u, key, { sec: 99, every: 99, total: 1 });

describe('데이터', () => {
  it('공통 94 + 켠 직업마다 24, 직업 전용은 그 직업 스킬만 말함', () => {
    expect(SPEC_KEYS.length).toBe(94 + 24 * HERO_KEYS.length);
    for (const h of HERO_KEYS) {
      const ds = SPEC_KEYS.map(k => SPECS[k]).filter(d => d.hero === h);
      expect(ds).toHaveLength(24);
      // 스킬 하나만 바꾸는 효과는 글에 그 스킬 이름이 그대로 (「성스러운 빛」처럼 없는 이름이 나오지 않게)
      for (const d of ds.filter(x => x.skillMod)) {
        expect(heroSkills(h)).toContain(d.skillMod!.key);
        expect(d.text).toContain(SKILLS[d.skillMod!.key].name);
      }
    }
  });
  it('고급부터 부위마다 직업 전용이 3종 이상, 희귀는 5종 이상 (70%가 직업 전용이라 한두 개만 반복되지 않게)', () => {
    for (const h of HERO_KEYS) for (const s of SLOTS) {
      const n = (g: (typeof ITEM_GRADES)[number]) => SPEC_KEYS.filter(k => SPECS[k].hero === h && SPECS[k].slots.includes(s.key) && ITEM_GRADES.indexOf(SPECS[k].min) <= ITEM_GRADES.indexOf(g)).length;
      expect(n('고급'), `${h} ${s.key} 고급`).toBeGreaterThanOrEqual(3);
      expect(n('희귀'), `${h} ${s.key} 희귀`).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('사제 17~24', () => {
  it('성언의 은혜: 성언을 쓰면 마나 회복', () => {
    const [a, b] = pair('graceWord', 1.5); both([a, b], f => { hurt(f); f.mana = 50; f.g.p = 100; cast(f, 'serenity', tank(f)); });
    expect(a.mana - b.mana).toBeCloseTo(1.5, 6);
  });
  it('번지는 울림: 평온을 쓰면 신성화 게이지 +, 신성화를 쓰면 평온 게이지 +', () => {
    const [a, b] = pair('crossWord', 0.15); both([a, b], f => { hurt(f); f.g.p = 100; cast(f, 'serenity', tank(f)); });
    expect(a.g.s - b.g.s).toBeCloseTo(15, 6);
    both([a, b], f => { f.g.s = 100; f.g.p = 0; cast(f, 'sanctify', tank(f)); });
    expect(a.g.p - b.g.p).toBeCloseTo(15, 6);
  });
  it('소생의 매듭: 소생이 끝까지 가면 대상이 지능 비율만큼 회복 (덮어쓰면 안 나옴)', () => {
    const [a, b] = pair('renewKnot', 0.25); both([a, b], f => { big(f); cast(f, 'renew', tank(f)); step(f, 10); });
    expect(tank(a).got - tank(b).got).toBeCloseTo(intAmt(a, 0.25), 6);
    const c = fight({ renewKnot: 0.25 }); big(c);
    cast(c, 'renew', tank(c)); step(c, 5); const got = tank(c).got;
    tank(c).hot = 0; step(c, 5); // 끝나기 전에 사라진 소생 (회복 없음)
    expect(tank(c).got).toBe(got);
  });
  it('맑은 기도: 정화로 지우면 평온 게이지 +', () => {
    const [a, b] = pair('clearPrayer', 0.15);
    both([a, b], f => { addDebuff(f, tank(f), { name: '저주', type: '마법', left: 20 }); cast(f, 'purify', tank(f)); });
    expect(a.g.p - b.g.p).toBeCloseTo(15, 6);
  });
  it('모두의 기도: 치유의 기원이 4명 이상 회복하면 신성화 게이지 +', () => {
    const [a, b] = pair('groupPrayer', 0.12);
    both([a, b], f => { hurt(f); cast(f, 'poh', withAdj(f, 3)); });
    expect(a.g.s - b.g.s).toBeCloseTo(12, 6);
  });
  it('빛의 발자국: 빛의 전이 옮겨 가는 횟수 +1', () => {
    const [a, b] = pair('relayStep', 1);
    both([a, b], f => cast(f, 'relay', tank(f)));
    expect(a.relay!.left).toBe(RELAY.hops + 1);
    expect(b.relay!.left).toBe(RELAY.hops);
  });
  it('영혼의 등불: 수호 영혼이 걸린 아군에게 하는 힐 +', () => {
    const [a, b] = pair('guardianLight', 0.15); both([a, b], f => { hurt(f); cast(f, 'guardian', tank(f)); });
    expect(amtOn(a, 'flash', tank(a)) / amtOn(b, 'flash', tank(b))).toBeCloseTo(1.15, 2);
  });
});

describe('드루이드 17~24', () => {
  it('이슬 맺힘: 새싹이 끝까지 가면 마나 회복', () => {
    const [a, b] = pair('dewDrop', 0.2, 'druid'); both([a, b], f => { big(f); f.mana = 50; cast(f, 'sprout', tank(f)); step(f, 12.2); });
    expect(a.mana - b.mana).toBeCloseTo(0.2, 6);
  });
  it('깊은 뿌리: 지속 힐이 2개 이상 걸린 아군에게 하는 직접 힐 +', () => {
    const [a, b] = pair('deepRoots', 0.08, 'druid'); both([a, b], f => { hurt(f); mark(tank(f), 'sprout'); mark(tank(f), 'wildflower'); });
    expect(amtOn(a, 'growth', tank(a)) / amtOn(b, 'growth', tank(b))).toBeCloseTo(1.08, 2);
  });
  it('꽃가루: 피워 내기를 쓰면 새싹이 없는 옆 칸 1명에게 절반 새싹', () => {
    const [a, b] = pair('pollen', 1, 'druid');
    const go = (f: F) => { hurt(f); const u = withAdj(f); putHot(u, 'sprout', { sec: 12, every: 3, total: 280 }); cast(f, 'bloom', u); return adj(f, u).map(sprout).find(Boolean); };
    const h = go(a)!;
    expect(h.hop).toBe(true);
    expect(h.rest).toBeCloseTo(140, 6);
    expect(go(b)).toBeUndefined();
  });
  it('껍질 아래 새순: 나무껍질을 건 대상에게 새싹도', () => {
    const [a, b] = pair('barkSprout', 1, 'druid'); both([a, b], f => cast(f, 'bark', tank(f)));
    expect(sprout(tank(a))!.rest).toBeCloseTo(SKILLS.sprout.amt!, 6);
    expect(sprout(tank(b))).toBeUndefined();
  });
  it('잎새 정화: 자연 정화로 지우면 대상에게 절반 새싹 (지울 게 없으면 안 나옴)', () => {
    const [a, b] = pair('leafCleanse', 1, 'druid');
    both([a, b], f => { addDebuff(f, tank(f), { name: '독침', type: '독', left: 20 }); cast(f, 'natureCleanse', tank(f)); });
    expect(sprout(tank(a))!.hop).toBe(true);
    expect(sprout(tank(b))).toBeUndefined();
    const c = fight({ leafCleanse: 1 }, 'druid');
    E.use(c, 'natureCleanse', dealer(c).cell);
    expect(sprout(dealer(c))).toBeUndefined();
  });
  it('퍼지는 새싹: 새싹을 걸면 확률로 새싹이 없는 옆 칸 1명에게도', () => {
    const [a, b] = pair('sproutWind', 0.12, 'druid'); a.rng = () => 0;
    const go = (f: F) => { hurt(f); const u = withAdj(f); cast(f, 'sprout', u); return adj(f, u).map(sprout).find(Boolean); };
    expect(go(a)!.hop).toBeFalsy();
    expect(go(b)).toBeUndefined();
  });
  it('피어나는 숨: 피워 내기를 쓰면 마나 회복', () => {
    const [a, b] = pair('bloomBreath', 1, 'druid');
    both([a, b], f => { hurt(f); f.mana = 50; putHot(tank(f), 'sprout', { sec: 12, every: 3, total: 280 }); cast(f, 'bloom', tank(f)); });
    expect(a.mana - b.mana).toBeCloseTo(1, 6);
  });
});

describe('성기사 17~24', () => {
  it('봉화지기: 봉화 대상에게 하는 직접 힐 +', () => {
    const [a, b] = pair('beaconKeeper', 0.08, 'paladin'); both([a, b], f => hurt(f));
    const bc = (f: F) => f.party.find(u => u.id === f.beacon)!;
    expect(amtOn(a, 'holyLight', bc(a)) / amtOn(b, 'holyLight', bc(b))).toBeCloseTo(1.08, 2);
  });
  it('흘러넘친 빛: 신성한 힘이 가득 찬 채로 쓰는 빛의 손길 회복량 + (가득 차지 않으면 그대로)', () => {
    const [a, b] = pair('fullPower', 0.1, 'paladin'); both([a, b], f => { hurt(f); f.power3 = 3; });
    expect(amtOn(a, 'holyLight', dealer(a)) / amtOn(b, 'holyLight', dealer(b))).toBeCloseTo(1.1, 2);
    const [c, d] = pair('fullPower', 0.1, 'paladin'); both([c, d], f => { hurt(f); f.power3 = 1; });
    expect(amtOn(c, 'holyLight', dealer(c)) / amtOn(d, 'holyLight', dealer(d))).toBeCloseTo(1, 6);
  });
  it('차오르는 힘: 빛의 손길이 확률로 신성한 힘 1칸 더', () => {
    const [a, b] = pair('risingPower', 0.25, 'paladin'); a.rng = () => 0;
    both([a, b], f => { hurt(f); cast(f, 'holyLight', dealer(f)); });
    expect(a.power3).toBe(2);
    expect(b.power3).toBe(1);
  });
  it('일격의 메아리: 빛 일격이 치명타면 신성한 힘 1칸 더', () => {
    const [a, b] = pair('strikeEcho', 1, 'paladin');
    both([a, b], f => { hurt(f); f.gear.crit = 1; cast(f, 'holyStrike', dealer(f)); });
    expect(a.power3).toBe(2);
    expect(b.power3).toBe(1);
  });
  it('서약의 숨: 빛의 서약을 3칸으로 쓰면 마나 회복 (1칸이면 없음)', () => {
    const [a, b] = pair('oathBreath', 1.5, 'paladin'); both([a, b], f => { hurt(f); f.mana = 50; f.power3 = 3; cast(f, 'oath', tank(f)); });
    expect(a.mana - b.mana).toBeCloseTo(1.5, 6);
    const [c, d] = pair('oathBreath', 1.5, 'paladin'); both([c, d], f => { hurt(f); f.mana = 50; f.power3 = 1; cast(f, 'oath', tank(f)); });
    expect(c.mana - d.mana).toBeCloseTo(0, 6);
  });
  it('정화의 손길: 정화의 손으로 지우면 신성한 힘 +1칸', () => {
    const [a, b] = pair('cleansePower', 1, 'paladin');
    both([a, b], f => { addDebuff(f, tank(f), { name: '독침', type: '독', left: 20 }); cast(f, 'handCleanse', tank(f)); });
    expect(a.power3).toBe(1);
    expect(b.power3).toBe(0);
  });
  it('희생의 빛: 희생 중인 아군에게 하는 힐 +', () => {
    const [a, b] = pair('sacrificeLight', 0.15, 'paladin'); both([a, b], f => { hurt(f); cast(f, 'sacrifice', dealer(f)); });
    expect(amtOn(a, 'holyLight', dealer(a)) / amtOn(b, 'holyLight', dealer(b))).toBeCloseTo(1.15, 2);
  });
  it('밝은 결의: 신성한 힘 3칸을 한 번에 쓰면 6초 동안 가속 +', () => {
    const [a, b] = pair('dawnResolve', 0.1, 'paladin'); both([a, b], f => { hurt(f); f.power3 = 3; cast(f, 'lightWave', tank(f)); });
    expect(hasteOf(a) - hasteOf(b)).toBeCloseTo(0.1, 9);
    step(a, 6); step(b, 6);
    expect(hasteOf(a)).toBeCloseTo(hasteOf(b), 9);
  });
});

describe('다른 직업이면 꺼짐', () => {
  it('직업 전용은 그 직업이 아니면 전투에 넘기는 값에서 빠짐', () => {
    for (const k of SPEC_KEYS.filter(x => SPECS[x].hero)) for (const h of HERO_KEYS) {
      const on = specTotals([{ key: k, v: SPECS[k].val }], h);
      expect(k in on, `${k} ${h}`).toBe(h === SPECS[k].hero);
    }
  });
});

describe('드롭 출처와 가방 (72)', () => {
  const now = new Date(2026, 9, 14, 12).getTime();
  const fresh = (hero: Hero) => {
    G.save = newSave(now); G.save.tut = 3; G.save.player = { level: 60, xp: 0, gold: 0 };
    G.save.hero = hero; rollover(G.save, now, () => 0.5);
  };
  it('공훈 교환도 지금 직업 전용 약 70% (다른 직업 전용은 안 나옴)', () => {
    fresh('druid');
    const r = rngFrom(31); let job = 0;
    for (let i = 0; i < 600; i++) {
      G.save.wallet.merit = 1e6;
      const it = exchangeMerit(G.save, SLOTS[i % SLOTS.length].key, r);
      if (typeof it === 'string') throw new Error(it);
      const hs = (it.specs ?? []).map(l => SPECS[l.key]?.hero).filter(Boolean);
      expect(hs.every(h => h === 'druid')).toBe(true);
      job += hs.length;
    }
    expect(job / 600).toBeGreaterThan(0.64); expect(job / 600).toBeLessThan(0.76);
  });
  it('「일반·고급 모두」 분해 고르기는 다른 직업 착용 조합에 든 장비를 뺌', () => {
    fresh('priest');
    const a = makeItem(() => 0.5, 'weapon', '고급', 1), b = makeItem(() => 0.5, 'head', '일반', 2);
    G.save.gear.bag.push(a, b);
    heroSaveOf(G.save, 'druid').loadout = { weapon: 1 };
    expect(lowGradeIds()).toEqual([2]);
  });
});
