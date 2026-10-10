/** 묶음 F1 (56 1장 · 2장 · 3-1 · 4-1 · 4-3 · 5장): 띄워 올리기 · 연쇄 번개 + 20인 ⑤ 숨결 우물, 10인 ⑬ 구름 우체국, 탐험 ㉑ 구름 양 목장, 던전 ⑰ 천둥 풍차 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/bosses';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { PLACE_KINDS } from '../src/data/equipment';
import { CONTENT_PLACE, PLACES } from '../src/data/places';
import { FEATURED, NAMED } from '../src/data/specials';
import { UNIQUES } from '../src/data/uniques';
import * as E from '../src/engine';
import { applyDebuff, chainFrom, land } from '../src/engine/bossParts';
import { damage, heal } from '../src/engine/core';
import { unitDps } from '../src/engine/units';
import type { FightEvent, Unit } from '../src/engine/types';

type F = ReturnType<typeof E.create>;
const quiet = (f: F) => { f.skills.forEach(s => { s.next = Infinity; }); f.party.forEach(u => { u.dps = 0; }); return f; };
/** sec초 흘리며 이벤트를 모음 */
const steps = (f: F, sec: number, seen: FightEvent[] = []) => {
  const end = f.t + sec;
  while (f.t < end - 1e-9 && !f.over) { E.step(f); seen.push(...f.events); f.events.length = 0; }
  return seen;
};
const skillOn = (f: F, key: string) => { const s = f.bs[key]; s.next = f.t; return s; };
const boss = (encounter: E.FightConfig['encounter'], mythic = false, hero: E.FightConfig['hero'] = 'priest') =>
  quiet(E.create({ encounter, diff: mythic ? '악몽' : '보통', seed: 3, hero }));
const tels = (f: F, key: string) => f.tels.filter(t => t.skill.key === key);
const unitsOf = (f: F, ids: number[]) => ids.map(id => f.party.find(u => u.id === id)!);
const msgs = (seen: FightEvent[]) => seen.flatMap(e => (e.type === 'msg' ? [e.text] : []));
/** 피해 배율을 걷어 낸 판 (방어력 · 특수능력 · 능력 없음): 연쇄 번개 피해를 그대로 잼 */
const bare = (f: F) => { f.armor = false; f.sp = null; f.abOn = false; f.dmgMult = 1; f.party.forEach(u => { u.ab = null; u.cls = null; }); return f; };
const near = (f: F, u: Unit) => f.party.filter(v => v !== u && v.alive && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
/** 나 · 탱커 아닌 이웃 (방어 보정이 같은 사람끼리 피해를 잼) */
const nearDps = (f: F, u: Unit) => near(f, u).filter(v => !v.me && v.role !== 'tank');
const WELL = [['well1', 'chulleong'], ['well2', 'puseok'], ['well3', 'huu']] as const;
const POST = [['post1', 'hwirik83'], ['post2', 'kkongkkong'], ['post3', 'buri']] as const;

describe('콘텐츠', () => {
  it('20인 ⑤ 숨결 우물: 칸마다 보스 하나, Lv 82 · 악몽 92, 36칸 판, 심연', () => {
    for (const [key, enc] of WELL) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 82, 20, { '악몽': 92 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc]).toMatchObject({ board: 'b36', big: true });
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('abyss');
    }
  });
  it('10인 ⑬ 구름 우체국: Lv 83 · 악몽 98, 25칸 판, 폭풍 깃털단', () => {
    for (const [key, enc] of POST) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 83, 10, { '악몽': 98 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc].board, enc).toBe('b25');
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('storm');
    }
  });
  it('탐험 ㉑ 구름 양 목장 Lv 84: 연쇄 번개 쉬운 판 (2번까지), 마법 디버프만', () => {
    const c = contentOf('ranch');
    expect([c.kind, c.unlockLv, c.size('보통')]).toEqual(['explore', 84, 3]);
    expect(c.fights('보통')).toEqual(['sheeptrash', 'boksul84']);
    expect(PLACES.ranch.faction).toBe('storm');
    expect(ENCOUNTERS.boksul84.debuffs).toEqual(['마법']);
    expect(BOSSES.boksul84.skills.find(s => s.key === 'bolt')!.effect).toMatchObject({ p: 'chain', jumps: 2 });
  });
  it('던전 ⑰ 천둥 풍차 Lv 85: 일반 → 복슬이 → 정예 (천둥 숫양 박치기는 끊을 수 있음) → 돌개', () => {
    const c = contentOf('windmill');
    expect([c.kind, c.unlockLv, c.size('보통')]).toEqual(['dungeon', 85, 5]);
    expect(c.fights('보통')).toEqual(['millstairs', 'boksul', 'millhouse', 'dolgae']);
    const ram = ENCOUNTERS.millhouse.mobs!.find(m => m.elite)!;
    expect(ram.name).toBe('천둥 숫양');
    expect(ram.attacks.find(a => a.key === 'ram')).toMatchObject({ to: 'all', cast: 2.5, cut: true });
    expect([ENCOUNTERS.boksul.board, ENCOUNTERS.dolgae.board]).toEqual(['b10', 'b10']);
  });
  it('드롭: 종류 · 자주 나오는 특수능력 · 이름 있는 장신구 4 · 고유 장비 5', () => {
    for (const k of ['well1', 'well2', 'well3', 'post1', 'post2', 'post3', 'ranch', 'windmill']) {
      expect(PLACE_KINDS[k]?.length, k).toBeGreaterThan(0);
      expect(FEATURED[k], k).toHaveLength(3);
    }
    expect(['well3', 'post3', 'ranch', 'windmill'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['breathFlask', 'postStamp', 'fleeceRing', 'millVane']);
    expect(['well1', 'well2', 'post1', 'post2', 'windmill'].map(p => UNIQUES.find(u => u.place === p)?.key))
      .toEqual(['bucketHood', 'mossRobe', 'courierPlume', 'ribbonGloves', 'vaneScepter']);
  });
});

describe('띄워 올리기 (P-LIFT)', () => {
  /** 휘리릭 속달 돌풍 예고까지 */
  function express(mythic = false) {
    const f = boss('hwirik83', mythic);
    skillOn(f, 'express');
    E.step(f); f.events.length = 0;
    return { f, t: tels(f, 'express')[0], us: unitsOf(f, tels(f, 'express')[0].units) };
  }
  it('예고 2.5초: 탱커 · 나 아닌 2명 (악몽 3명), 회오리가 뜨면 깃털 간지럼이 먼저 붙음', () => {
    const { t, us } = express();
    expect(t.impact - t.start).toBeCloseTo(2.5, 5);
    expect(us).toHaveLength(2);
    for (const u of us) {
      expect(u.role === 'tank' || u.me).toBe(false);
      expect(u.debuffs.map(d => [d.name, d.type])).toContainEqual(['깃털 간지럼', '저주']);
    }
    expect(express(true).us).toHaveLength(3);
  });
  it('떠 있는 동안: 새 힐 · 해제 · 대상 지정 · 보스 피해 · 디버프가 안 닿고 딜 0, 미리 건 지속 힐 · 지속 피해는 계속', () => {
    const { f, us: [a, b] } = express();
    a.debuffs = []; // a = 지속 힐만, b = 깃털 간지럼만
    for (const u of [a, b]) u.hp = u.max * 0.6;
    expect(E.use(f, 'renew', a.cell).ok).toBe(true);
    const seen = steps(f, 2.6);
    expect(msgs(seen).some(m => m.includes('하늘로'))).toBe(true);
    for (const u of [a, b]) {
      expect(u.lift).toBeTruthy();
      expect(E.living(f)).not.toContain(u);
      expect(E.canTarget(f, 'heal', u.cell)).toMatchObject({ ok: false, reason: expect.stringContaining('닿지 않음') });
      expect(E.use(f, 'flash', u.cell).ok).toBe(false);
      const hp = u.hp;
      expect(heal(f, u, 500, true)).toBe(0);
      damage(f, u, 500);
      expect(u.hp).toBe(hp);
      expect(applyDebuff(f, u, { name: '시험', type: '마법', left: 5, dot: 10 })).toBeNull();
      u.dps = 100;
      expect(unitDps(u, f)).toBe(0);
    }
    const [ha, hb] = [a.hp, b.hp];
    steps(f, 1.5);
    expect(a.hp).toBeGreaterThan(ha); // 소생은 계속 틱
    expect(b.hp).toBeLessThan(hb); // 깃털 간지럼도 계속 아픔
  });
  it('5초 뒤 제자리로 내려오며 낙하 피해, 내려오면 다시 힐이 닿음', () => {
    const { f, us: [a] } = express();
    a.debuffs = []; a.hp = a.max;
    const cell = a.cell;
    steps(f, 2.6);
    expect(a.lift).toBeTruthy();
    const seen = steps(f, 5);
    expect(a.lift).toBeNull();
    expect(a.cell).toBe(cell);
    expect(seen.some(e => e.type === 'fx' && e.name === 'land-puff' && e.on === a.id)).toBe(true);
    expect(a.hp).toBeLessThan(a.max);
    expect(E.canTarget(f, 'heal', a.cell).ok).toBe(true);
  });
  it('띄워 올려진 탱커는 보스가 못 때리고 다른 탱커를 침, 「탱커 없음」으로 세지 않음', () => {
    const f = boss('hwirik83');
    const [t1, t2] = f.party.filter(u => u.role === 'tank');
    t1.lift = { until: f.t + 30, fall: 0, aim: 'tank' };
    expect(E.aggroTarget(f)).toBe(t2);
    t2.alive = false; t2.hp = 0;
    steps(f, 13);
    expect(f.noTankAt).toBeNull();
    expect(f.enraged).toBeFalsy();
  });
  it('받침 위 사람이 띄워지면 받침이 비어 다른 사람이 대신 들어가고, 내려오면 가까운 빈 칸으로', () => {
    const f = boss('buri');
    f.phase = 2;
    skillOn(f, 'box');
    const seen = steps(f, 3.5);
    const pads = [...tels(f, 'box')[0].cells];
    const on = f.party.filter(u => u.padUntil != null && u.padUntil > f.t);
    expect(on.length).toBe(3);
    skillOn(f, 'padlift');
    steps(f, 0.05, seen);
    const up = unitsOf(f, tels(f, 'padlift')[0].units);
    expect(up.length).toBe(2);
    expect(up.every(u => on.includes(u))).toBe(true);
    const from = up.map(u => u.cell);
    steps(f, 2, seen);
    expect(up.every(u => u.lift && u.lift.land === 'free')).toBe(true);
    for (const c of from) expect(f.cells[c].unit && !f.cells[c].unit!.lift).toBeTruthy(); // 대신 들어간 사람
    steps(f, 3, seen); // 받침이 울림 (8초)
    expect(msgs(seen).some(m => m.includes('빈 발판'))).toBe(false);
    steps(f, 2, seen);
    for (const u of up) {
      expect(u.lift).toBeNull();
      expect(f.cells[u.cell].unit).toBe(u);
      expect(pads).not.toContain(u.cell);
    }
  });
  it('반송 돌풍 (내려앉을 곳이 없는 띄우기)도 받침 위 사람을 띄우면 받침을 비움', () => {
    const f = boss('buri');
    f.phase = 3;
    skillOn(f, 'box');
    steps(f, 3.5);
    const u = f.party.find(x => x.padUntil != null && x.padUntil > f.t)!;
    const c = u.cell;
    const rng = f.rng;
    f.rng = () => 0;
    skillOn(f, 'return');
    E.step(f); f.events.length = 0;
    f.rng = rng;
    const t = tels(f, 'return')[0];
    t.units = [u.id];
    steps(f, 2.6);
    expect(u.lift?.land).toBe('free');
    expect(f.cells[c].unit).not.toBe(u);
  });
  it('기우는 섬 (land random): 무작위 빈 칸에 내려앉음', () => {
    const f = boss('hwirik83');
    const u = f.party.find(x => x.role === 'ranged')!;
    f.cells[u.cell].unit = null;
    u.lift = { until: f.t, fall: 0, aim: 'party', land: 'random' };
    land(f, u);
    expect(u.lift).toBeNull();
    expect(f.cells[u.cell].unit).toBe(u);
    expect(f.party.filter(v => v.alive && v.cell === u.cell)).toEqual([u]);
  });
  it('내려오며 번개 (돌개바람): 내려오는 순간 그 사람에게서 연쇄 번개, 부리부리의 우표면 내려올 때 보호막', () => {
    const f = boss('dolgae');
    skillOn(f, 'gust');
    E.step(f); f.events.length = 0;
    const [u] = unitsOf(f, tels(f, 'gust')[0].units);
    const seen = steps(f, 2.5 + 5.1);
    expect(seen.some(e => e.type === 'fx' && e.name === 'chain-strike' && e.on === u.id)).toBe(true);
    // 부리부리의 우표 (56 6장)
    const g = quiet(E.create({ encounter: 'dolgae', diff: '보통', seed: 3, specs: { postStamp: 0.4 } }));
    skillOn(g, 'gust');
    E.step(g); g.events.length = 0;
    const [v] = unitsOf(g, tels(g, 'gust')[0].units);
    const out = steps(g, 2.5 + 5.1);
    expect(out.some(e => e.type === 'spec' && e.id === v.id && e.name === '부리부리의 우표')).toBe(true);
  });
  it('자동 힐러: 예고 동안 대상에게 해제 (지울 수 있으면) → 소생, 떠 있는 사람은 고르지 않음', () => {
    const f = boss('hwirik83');
    f.party.forEach(u => { u.hp = u.max; });
    skillOn(f, 'express');
    E.step(f); f.events.length = 0;
    const us = unitsOf(f, tels(f, 'express')[0].units);
    for (const u of us) u.debuffs = [];
    E.autoHealer(f);
    expect(f.cast?.key === 'renew' || us.some(u => u.hot > 0)).toBe(true);
    steps(f, 2.6);
    for (const u of us) u.hp = u.max * 0.3;
    for (let i = 0; i < 40; i++) { E.autoHealer(f); E.step(f); f.events.length = 0; if (f.cast) expect(us.map(u => u.id)).not.toContain(f.cast.uid); }
  });
});

describe('연쇄 번개 (P-CHAIN)', () => {
  /** 36칸 판에서 원거리 a와 그 이웃 b, b의 이웃 c (a 아닌)를 고름. 나머지는 모두 85% */
  function line(f: F) {
    bare(f);
    f.party.forEach(u => { u.hp = u.max * 0.85; });
    const a = f.party.find(u => u.role === 'ranged' && nearDps(f, u).some(b => nearDps(f, b).some(c => c !== u && !near(f, u).includes(c))))!;
    const b = nearDps(f, a).find(x => nearDps(f, x).some(c => c !== a && !near(f, a).includes(c)))!;
    const c = nearDps(f, b).find(x => x !== a && !near(f, a).includes(x))!;
    return { a, b, c };
  }
  it('맞은 사람 이웃 가운데 체력 비율이 가장 낮은 사람에게 튀고, 튈 때마다 +25%', () => {
    const f = boss('chulleong');
    const { a, b, c } = line(f);
    b.hp = b.max * 0.5; c.hp = c.max * 0.4;
    const hp = new Map(f.party.map(u => [u, u.hp]));
    chainFrom(f, a, 10, 2, 0.25, '시험');
    const lost = (u: Unit) => hp.get(u)! - u.hp;
    expect(lost(a)).toBeCloseTo(10, 5);
    expect(lost(b)).toBeCloseTo(12.5, 5);
    expect(lost(c)).toBeCloseTo(15.625, 5);
    expect(f.party.filter(u => lost(u) > 0)).toHaveLength(3); // 2번까지
    const bolts = f.events.flatMap(e => (e.type === 'fx' && e.name === 'chain-bolt' ? [[e.on, e.to]] : []));
    expect(bolts).toEqual([[a.id, b.id], [b.id, c.id]]);
  });
  it('튈 곳이 체력 90% 이상이거나 보호막이면 피뢰침: 절반만 받고 멈춤', () => {
    for (const rod of ['full', 'shield'] as const) {
      const f = boss('chulleong');
      const { a, b, c } = line(f);
      for (const v of near(f, a)) v.hp = v.max * 0.95;
      if (rod === 'shield') { b.hp = b.max * 0.5; b.shield = 5; } else b.hp = b.max * 0.92;
      c.hp = c.max * 0.3;
      expect(E.isRod(f, b), rod).toBe(true);
      const hb = b.hp, hc = c.hp;
      chainFrom(f, a, 10, 3, 0.25, '시험');
      expect(hb - b.hp, rod).toBeCloseTo(rod === 'shield' ? 12.5 / 2 * 0.6 : 12.5 / 2, 5);
      expect(c.hp, rod).toBe(hc);
      expect(f.events.some(e => e.type === 'fx' && e.name === 'chain-rod' && e.on === b.id), rod).toBe(true);
    }
  });
  it('이웃이 없으면 그 자리에서 멈춤, 떠 있는 사람에게는 안 튐', () => {
    const f = boss('chulleong');
    const { a, b } = line(f);
    for (const v of near(f, a)) v.lift = { until: f.t + 5, fall: 0, aim: 'party' };
    const hb = b.hp;
    chainFrom(f, a, 100, 3, 0.25, '시험');
    expect(b.hp).toBe(hb);
    expect(f.events.filter(e => e.type === 'fx' && e.name === 'chain-bolt')).toHaveLength(0);
  });
  it('복슬이 번개 털: 3초 예고 (악몽 2명), 맞으면 대상에게서 시작', () => {
    const f = boss('boksul');
    skillOn(f, 'bolt');
    E.step(f); f.events.length = 0;
    const t = tels(f, 'bolt')[0];
    expect(t.impact - t.start).toBeCloseTo(3, 5);
    expect(t.units).toHaveLength(1);
    const [u] = unitsOf(f, t.units);
    expect(u.role === 'tank' || u.me).toBe(false);
    const seen = steps(f, 3.1);
    expect(seen.some(e => e.type === 'fx' && e.name === 'chain-strike' && e.on === u.id)).toBe(true);
    const g = boss('boksul', true);
    skillOn(g, 'bolt');
    E.step(g);
    expect(tels(g, 'bolt')[0].units).toHaveLength(2);
  });
  it('예고: 번개 구름 아래 신중파는 이웃이 적은 칸으로 비킴', () => {
    const f = boss('boksul');
    for (const u of f.party) if (!u.me && u.role !== 'tank') { u.pers = '신중파'; u.p = { ...u.p, dist: 0 }; }
    const rng = f.rng;
    f.rng = () => 0;
    skillOn(f, 'bolt');
    E.step(f); f.events.length = 0;
    f.rng = rng;
    const [u] = unitsOf(f, tels(f, 'bolt')[0].units);
    expect(u.moving).toBeTruthy();
  });
  it('자동 힐러: 번개 구름 옆 90% 아래 가장 낮은 사람을 채움', () => {
    const f = boss('boksul');
    f.party.forEach(u => { u.hp = u.max; });
    skillOn(f, 'bolt');
    E.step(f); f.events.length = 0;
    const [u] = unitsOf(f, tels(f, 'bolt')[0].units);
    const v = near(f, u).find(x => !x.me)!;
    v.hp = v.max * 0.5;
    E.autoHealer(f);
    expect([f.cast?.uid, f.queued?.uid]).toContain(v.id);
  });
  it('복슬 양털 반지: 번개 구름이 뜬 아군의 이웃에게 하는 힐 +12%', () => {
    const run = (ring: boolean) => {
      const f = boss('boksul', false);
      if (ring) f.sp = E.create({ encounter: 'boksul', diff: '보통', seed: 3, specs: { fleeceRing: 0.12 } }).sp;
      skillOn(f, 'bolt');
      E.step(f); f.events.length = 0;
      const [u] = unitsOf(f, tels(f, 'bolt')[0].units);
      const v = near(f, u)[0];
      v.hp = v.max * 0.2;
      return heal(f, v, 200, true);
    };
    expect(run(true) / run(false)).toBeCloseTo(1.12, 2);
  });
});

describe('보스 데이터', () => {
  it('푸석이: 이끼 표식은 이끼 덮기 대상 먼저, 상한이 걸린 채로는 100%가 안 되어 표식이 남음', () => {
    const f = boss('puseok');
    skillOn(f, 'cover');
    steps(f, 0.05);
    const capped = f.party.filter(u => u.debuffs.some(d => d.name === '이끼 덮기'));
    expect(capped).toHaveLength(5);
    skillOn(f, 'mark');
    steps(f, 0.05);
    const marked = f.party.filter(u => u.debuffs.some(d => d.name === '이끼 표식'));
    expect(marked).toHaveLength(3);
    expect(marked.every(u => capped.includes(u) && !u.me)).toBe(true);
    const u = marked[0];
    u.hp = u.max * 0.5;
    heal(f, u, u.max * 2, true);
    expect(u.hp).toBeCloseTo(u.max * 0.7, 3);
    expect(u.debuffs.some(d => d.name === '이끼 표식')).toBe(true);
  });
  it('자동 힐러: 완치 표식이 있는 사람의 치유 상한을 먼저 지움', () => {
    const f = quiet(E.create({ encounter: 'puseok', diff: '보통', seed: 3, hero: 'priest', level: 82, heroLv: 82 }));
    skillOn(f, 'cover');
    steps(f, 0.05);
    const capped = f.party.filter(u => u.debuffs.some(d => d.name === '이끼 덮기'));
    const last = capped[capped.length - 1]; // 해제 후보 순서 맨 끝에만 표식
    const mark = BOSSES.puseok.skills.find(x => x.key === 'mark')!.effect!;
    if (mark.p === 'debuff') applyDebuff(f, last, mark.debuff);
    f.party.forEach(u => { u.hp = u === last ? u.max * 0.6 : u.max; });
    E.autoHealer(f);
    expect(f.cd.purify).toBeGreaterThan(0); // 정화 (즉시)
    expect(last.debuffs.some(d => d.name === '이끼 덮기')).toBe(false);
    expect(capped.filter(u => u !== last).every(u => u.debuffs.some(d => d.name === '이끼 덮기'))).toBe(true);
  });
  it('출렁이: 두레박 순서 4명 (악몽 5명), 순서가 시작되고 4초 뒤 우물 울림 (진동)', () => {
    const sk = (k: string) => BOSSES.chulleong.skills.find(s => s.key === k)!;
    const order = sk('order'), quake = sk('quake');
    expect((order.first ?? 0) + order.cast + 4).toBeCloseTo((quake.first ?? 0) + quake.cast, 5);
    expect(order.period).toBe(quake.period);
    expect(order.effect).toMatchObject({ p: 'order', n: 4, nMythic: 5 });
  });
  it('후우: 65% 날숨 (숨결 그릇 · 큰 날숨) → 35% 심장 박동, 넘친 치유를 숨결 그릇에 모음 (후우의 숨결 병 +25%)', () => {
    const f = boss('huu');
    f.bossHp = f.bossMax * 0.6;
    steps(f, 0.1);
    expect(f.phase).toBe(2);
    expect(f.bs.bowl.next).toBeGreaterThan(f.t);
    expect(f.bs.exhale.next).toBeGreaterThan(f.bs.bowl.next);
    const fill = (flask: boolean) => {
      const g = quiet(E.create({ encounter: 'huu', diff: '보통', seed: 3, specs: flask ? { breathFlask: 0.25 } : undefined }));
      g.phase = 2;
      skillOn(g, 'bowl');
      steps(g, 0.05);
      const u = g.party.find(x => !x.me)!;
      u.hp = u.max;
      heal(g, u, 1000, true);
      return g.vessel!.fill;
    };
    expect(fill(true) / fill(false)).toBeCloseTo(1.25, 2);
  });
  it('꽁꽁이: 리본 묶기 3초 뒤 쌍마다 한 사람만 띄움 (나 빼고)', () => {
    const f = boss('kkongkkong');
    skillOn(f, 'ribbon');
    steps(f, 0.05);
    const pairs = f.links.filter(l => l.kind === 'share');
    expect(pairs).toHaveLength(2);
    skillOn(f, 'parcel');
    steps(f, 0.05);
    const ids = tels(f, 'parcel')[0].units;
    expect(ids).toHaveLength(2);
    for (const l of pairs) expect([l.a, l.b].filter(id => ids.includes(id))).toHaveLength(1);
    expect(unitsOf(f, ids).some(u => u.me)).toBe(false);
  });
  it('풍차 날개 조각: 떠 있는 아군이 받는 지속 힐 +20%', () => {
    const run = (vane: boolean) => {
      const f = quiet(E.create({ encounter: 'hwirik83', diff: '보통', seed: 3, specs: vane ? { millVane: 0.2 } : undefined }));
      const u = f.party.find(x => x.role === 'ranged')!;
      u.hp = u.max * 0.3;
      expect(E.use(f, 'renew', u.cell).ok).toBe(true);
      u.lift = { until: f.t + 30, fall: 0, aim: 'party' };
      const h = u.hp;
      steps(f, 3.05);
      return u.hp - h;
    };
    expect(run(true) / run(false)).toBeCloseTo(1.2, 1);
  });
});
