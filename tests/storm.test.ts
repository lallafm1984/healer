/**
 * 묶음 F2 · F3 (56 1장 · 3-2 · 4-2 · 4-4 · 4-5 · 6장): 20인 ⑥ 수정 뿌리굴 (굴굴이 · 핑핑이 · 빛갈래), 10인 ⑭ 폭풍 성채 (둥둥이 · 쌩쌩이 · 우르릉),
 * 탐험 ㉒ 빗자루 정류장 · 던전 ⑱ 구름 마법학교 (퐁퐁이 · 뒤죽박죽), 20인 ⑦ 그림자 성벽 (쾅쾅이 · 슝슝이 · 어둑이)
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
import { applyDebuff, chainFrom, land } from '../src/engine/bossParts';
import { heal } from '../src/engine/core';
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
const unitsOf = (f: F, ids: number[]) => ids.map(id => f.party.find(u => u.id === id)!);
const skill = (b: keyof typeof BOSSES, key: string) => BOSSES[b].skills.find(s => s.key === key)!;
const near = (f: F, u: Unit) => f.party.filter(v => v !== u && v.alive && E.hexDist(f.cells[v.cell], f.cells[u.cell]) === 1);
const CRYSTAL = [['crystal1', 'gulgul'], ['crystal2', 'pingping'], ['crystal3', 'bitgallae']] as const;
const FORT = [['fort1', 'dungdung'], ['fort2', 'ssaengssaeng'], ['fort3', 'ureureung']] as const;

describe('콘텐츠', () => {
  it('20인 ⑥ 수정 뿌리굴: 칸마다 보스 하나, Lv 85 · 악몽 95, 36칸 판, 심연', () => {
    for (const [key, enc] of CRYSTAL) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 85, 20, { '악몽': 95 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc]).toMatchObject({ board: 'b36', big: true });
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('abyss');
    }
  });
  it('10인 ⑭ 폭풍 성채: Lv 87 · 악몽 100 (Lv 100까지), 25칸 판, 폭풍 깃털단', () => {
    for (const [key, enc] of FORT) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 87, 10, { '악몽': 100 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc].board, enc).toBe('b25');
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('storm');
    }
    expect(contentOf('post1').diffUnlock).toEqual({ '악몽': 98 }); // 다른 10인은 그대로 열림 + 15
  });
  it('드롭: 칸마다 종류 1 · 자주 나오는 특수능력 3, 이름 있는 장신구 2 (마지막 칸), 고유 장비 4', () => {
    for (const [k] of [...CRYSTAL, ...FORT]) {
      expect(PLACE_KINDS[k], k).toHaveLength(1);
      expect(FEATURED[k], k).toHaveLength(3);
    }
    expect(['crystal3', 'fort3'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['prism', 'stormWedge']);
    expect(['crystal1', 'crystal2', 'fort1', 'fort2'].map(p => UNIQUES.find(u => u.place === p)?.key)).toEqual(['crystalPick', 'pinwheelHabit', 'drumHelm', 'lanceWraps']);
  });
});

describe('20인 ⑥ 수정 뿌리굴', () => {
  it('굴굴이: 땅파기가 끝나면 가장자리 빈 칸 2개가 구멍 (최대 8), 수정 번개는 5번까지 튐', () => {
    const f = boss('gulgul');
    for (let i = 0; i < 5; i++) { skillOn(f, 'sink'); steps(f, 0.05); }
    expect(f.cells.filter(c => c.block === 'hole')).toHaveLength(8);
    const dig = skill('gulgul', 'dig0'), sink = skill('gulgul', 'sink');
    expect(sink.first!).toBeGreaterThan(dig.first! + dig.cast + 0.6 - 1e-9); // 세 곳 땅파기가 모두 끝난 뒤
    expect(sink.period).toBe(dig.period);
    expect(skill('gulgul', 'bolt').effect).toMatchObject({ p: 'chain', jumps: 5 });
  });
  it('핑핑이: 회오리는 탱커 · 나 아닌 4명 (악몽 5명), 떠 있는 동안에도 수정 가시가 쌓임 (힐로 못 지움)', () => {
    for (const [mythic, n] of [[false, 4], [true, 5]] as const) {
      const f = boss('pingping', mythic);
      skillOn(f, 'whirl');
      E.step(f); f.events.length = 0;
      const us = unitsOf(f, tels(f, 'whirl')[0].units);
      expect(us).toHaveLength(n);
      expect(us.some(u => u.me || u.role === 'tank')).toBe(false);
    }
    const f = boss('pingping');
    skillOn(f, 'thorn');
    steps(f, 0.05);
    const u = f.party.find(x => x.debuffs.some(d => d.name === '수정 가시') && !x.me)!;
    u.hp = u.max * 0.5;
    u.lift = { until: f.t + 30, fall: 0, aim: 'party' };
    steps(f, 6.1);
    expect(u.debuffs.find(d => d.name === '수정 가시')!.stack).toBeGreaterThanOrEqual(2);
    expect(heal(f, u, u.max, true)).toBe(0);
  });
  it('빛갈래: 65% 아래 2페이즈에 수정 욕심 (체력 비율 높은 3명 · 악몽 4명, 탱커 · 나 빼고), 35% 아래 3페이즈 프리즘 폭발', () => {
    for (const [mythic, n] of [[false, 3], [true, 4]] as const) {
      const f = boss('bitgallae', mythic);
      f.bossHp = f.bossMax * 0.64;
      E.step(f);
      expect(f.phase).toBe(2);
      expect(f.bs.greed.next - f.t).toBeCloseTo(4, 0);
      const dps = f.party.filter(u => !u.me && u.role !== 'tank');
      dps.forEach((u, i) => { u.hp = u.max * (0.5 + i * 0.02); });
      skillOn(f, 'greed');
      E.step(f); f.events.length = 0;
      const ids = tels(f, 'greed')[0].units;
      expect(ids.sort()).toEqual(dps.slice(-n).map(u => u.id).sort());
      f.bossHp = f.bossMax * 0.34;
      E.step(f);
      expect(f.phase).toBe(3);
      expect(f.bs.prism.next - f.t).toBeCloseTo(5, 0);
    }
  });
  it('빛갈래의 프리즘: 연쇄 번개가 피뢰침에서 멈추면 그 아군을 지능 50% 회복', () => {
    const run = (on: boolean) => {
      const f = boss('bitgallae', false, on ? { prism: 0.5 } : undefined);
      const u = f.party.find(x => x.role === 'ranged' && !x.me && near(f, x).length)!;
      for (const v of near(f, u)) { v.hp = v.max * 0.95; v.shield = 0; }
      const seen: FightEvent[] = [];
      chainFrom(f, u, 50, 4, 0.25, '갈래 번개');
      seen.push(...f.events);
      const rod = seen.find(e => e.type === 'fx' && e.name === 'chain-rod') as { on: number } | undefined;
      expect(rod).toBeTruthy();
      return { f, seen, rod: f.party.find(v => v.id === rod!.on)! };
    };
    const a = run(true), b = run(false);
    expect(a.seen.some(e => e.type === 'spec' && e.id === a.rod.id && e.name === '빛갈래의 프리즘')).toBe(true);
    expect(b.seen.some(e => e.type === 'spec')).toBe(false);
    expect(a.rod.hp).toBeGreaterThan(b.rod.hp);
  });
});

describe('10인 ⑭ 폭풍 성채', () => {
  it('둥둥이: 천둥 북 진동 1초 뒤 번개 북소리 (진동 잠김 1.5초 안), 주기가 같음, 악몽 3명', () => {
    const drum = skill('dungdung', 'drum'), roll = skill('dungdung', 'roll');
    expect(roll.first! + roll.cast - (drum.first! + drum.cast)).toBeCloseTo(1);
    expect(roll.period).toBe(drum.period);
    expect(drum.effect).toMatchObject({ p: 'quake', lock: 1.5 });
    const f = boss('dungdung', true);
    skillOn(f, 'roll');
    E.step(f); f.events.length = 0;
    expect(tels(f, 'roll')[0].units).toHaveLength(3);
  });
  it('쌩쌩이 하늘 던지기: 보스를 맞는 탱커가 4초 떠오르고 그동안 보스는 다른 탱커를 침, 내려오면 다시 그 탱커 · 낙하 피해', () => {
    const f = boss('ssaengssaeng');
    const t1 = E.aggroTarget(f)!;
    skillOn(f, 'throw');
    E.step(f); f.events.length = 0;
    expect(tels(f, 'throw')[0].units).toEqual([t1.id]);
    steps(f, 2.5);
    expect(t1.lift?.aim).toBe('tank');
    const t2 = E.aggroTarget(f)!;
    expect([t2.role, t2 === t1]).toEqual(['tank', false]);
    t1.hp = t1.max; t1.shield = 0;
    steps(f, 4.1);
    expect(t1.lift).toBeNull();
    expect(E.aggroTarget(f)).toBe(t1);
    expect(t1.hp).toBeLessThan(t1.max);
    expect(f.noTankAt).toBeNull();
  });
  it('쌩쌩이 악몽: 던진 탱커가 내려오기 직전 남은 탱커에게 창 찌르기 2중첩', () => {
    const th = skill('ssaengssaeng', 'throw'), m0 = skill('ssaengssaeng', 'jabm0');
    expect(m0.first!).toBeCloseTo(th.first! + th.cast + 4 - 0.3);
    expect(m0.period).toBe(th.period);
    const f = boss('ssaengssaeng', true);
    const t1 = E.aggroTarget(f)!;
    skillOn(f, 'throw');
    f.bs.jabm0.next = f.t + th.cast + 4 - 0.3;
    f.bs.jabm1.next = f.t + th.cast + 4 - 0.2;
    steps(f, th.cast + 4 + 0.2);
    const t2 = f.party.find(u => u.role === 'tank' && u !== t1)!;
    expect(t2.debuffs.find(d => d.name === '번개 창 찌르기')?.stack).toBe(2);
    expect(t1.debuffs.some(d => d.name === '번개 창 찌르기')).toBe(false);
  });
  it('우르릉: 70% 아래 섬 흔들기 (섬 돌풍 4초 뒤 기우는 섬, 주기 같음), 40% 아래 하늘 던지기 · 폭풍 함성', () => {
    const f = boss('ureureung');
    f.bossHp = f.bossMax * 0.69;
    E.step(f);
    expect(f.phase).toBe(2);
    expect(f.bs.tilt.next - f.bs.gust.next).toBeCloseTo(4);
    expect(skill('ureureung', 'gust').period).toBe(skill('ureureung', 'tilt').period);
    expect(skill('ureureung', 'tilt').cells).toMatchObject({ p: 'safe', at: 'side', n: 10 });
    f.bossHp = f.bossMax * 0.39;
    E.step(f);
    expect(f.phase).toBe(3);
    expect(f.bs.throw.next).toBeLessThan(Infinity);
    expect(f.bs.shout.next).toBeLessThan(Infinity);
  });
  it('섬 돌풍: 3명 (악몽 4명) 4초 → 무작위 빈 칸에 내려앉음, 기우는 섬의 낮은 쪽에 내려앉으면 그때 피함', () => {
    for (const [mythic, n] of [[false, 3], [true, 4]] as const) {
      const f = boss('ureureung', mythic);
      f.phase = 2;
      skillOn(f, 'gust');
      E.step(f); f.events.length = 0;
      expect(tels(f, 'gust')[0].units).toHaveLength(n);
      steps(f, 2.5);
      expect(unitsOf(f, tels(f, 'gust').length ? tels(f, 'gust')[0].units : f.party.filter(u => u.lift).map(u => u.id)).every(u => u.lift?.land === 'random')).toBe(true);
    }
    const f = boss('ureureung');
    f.phase = 2;
    skillOn(f, 'tilt');
    E.step(f); f.events.length = 0;
    const tel = tels(f, 'tilt')[0];
    const u = f.party.find(x => x.role === 'ranged' && !x.me)!;
    f.cells[u.cell].unit = null;
    u.react = null;
    const safe = f.cells.filter(c => !c.unit && !c.block && !tel.cells.has(c.i));
    safe.forEach(c => { c.block = 'hole'; }); // 안전한 빈 칸을 막아 낮은 쪽에 내려앉게
    u.lift = { until: f.t, fall: 0, aim: 'party', land: 'random' };
    land(f, u);
    safe.forEach(c => { c.block = undefined; });
    expect(tel.cells.has(u.cell)).toBe(true);
    expect((u.react as { tel: number } | null)?.tel).toBe(tel.id);
  });
  it('우르릉의 번개 쐐기: 다른 탱커가 띄워 올려진 동안 남은 탱커에게 하는 힐 +25%', () => {
    const run = (on: boolean, lifted: boolean) => {
      const f = boss('ureureung', false, on ? { stormWedge: 0.25 } : undefined);
      const [t1, t2] = f.party.filter(u => u.role === 'tank');
      if (lifted) t1.lift = { until: f.t + 30, fall: 0, aim: 'tank' };
      t2.hp = t2.max * 0.2;
      return heal(f, t2, 200, true);
    };
    expect(run(true, true) / run(false, true)).toBeCloseTo(1.25, 2);
    expect(run(true, false) / run(false, false)).toBeCloseTo(1, 2);
  });
});

const SHADOW = [['shadow1', 'kwangkwang'], ['shadow2', 'syungsyung'], ['shadow3', 'eodugi']] as const;

describe('F3 콘텐츠', () => {
  it('탐험 ㉒ 빗자루 정류장 Lv 88 · 던전 ⑱ 구름 마법학교 Lv 90: 옛 세력 폭주한 마도사 (마법만)', () => {
    const st = contentOf('station'), sc = contentOf('school');
    expect([st.kind, st.unlockLv, st.size('보통')]).toEqual(['explore', 88, 3]);
    expect(st.fights('보통')).toEqual(['platform', 'pongpong88']);
    expect([sc.kind, sc.unlockLv, sc.size('보통')]).toEqual(['dungeon', 90, 5]);
    expect(sc.fights('보통')).toEqual(['upsidehall', 'pongpong', 'boltlab', 'dwijuk']);
    for (const k of ['station', 'school'] as const) expect(PLACES[CONTENT_PLACE[k]].faction).toBe('mage');
    for (const k of ['pongpong88', 'pongpong', 'dwijuk'] as const) expect(ENCOUNTERS[k].debuffs).toEqual(['마법']);
    expect(ENCOUNTERS.boltlab.mobs!.find(m => m.elite)!.attacks.find(a => a.key === 'burst')).toMatchObject({ to: 'all', cut: true });
  });
  it('20인 ⑦ 그림자 성벽: Lv 88 · 악몽 98, 36칸 판, 심연', () => {
    for (const [key, enc] of SHADOW) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 88, 20, { '악몽': 98 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc]).toMatchObject({ board: 'b36', big: true });
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('abyss');
    }
  });
  it('드롭: 종류 (탐험 2 · 던전 3 · 레이드 칸 1) · 이름 있는 장신구 3 · 고유 장비 3', () => {
    expect([PLACE_KINDS.station, PLACE_KINDS.school].map(k => k.length)).toEqual([2, 3]);
    for (const [k] of SHADOW) expect([PLACE_KINDS[k].length, FEATURED[k].length], k).toEqual([1, 3]);
    expect(['station', 'shadow3', 'school'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['broomTicket', 'shadowVeil', 'diploma']);
    expect(['shadow1', 'shadow2', 'school'].map(p => UNIQUES.find(u => u.place === p)?.key)).toEqual(['shadowHammer', 'fletchSleeve', 'upsideVestment']);
  });
});

describe('던전 ⑱ 구름 마법학교 · 탐험 ㉒', () => {
  it('퐁퐁이 거품 플라스크: 넘친 치유가 차면 전원 보호막 (악몽 6초), 보호막이 있으면 실습 번개 피뢰침', () => {
    for (const [mythic, sec] of [[false, 8], [true, 6]] as const) {
      const f = boss('pongpong', mythic);
      skillOn(f, mythic ? 'flaskm' : 'flask');
      steps(f, 0.05);
      expect(f.vessel).toMatchObject({ name: '거품 플라스크' });
      f.vessel!.fill = f.vessel!.need;
      steps(f, 0.05);
      expect(f.vessel).toBeNull();
      expect(f.party.filter(u => u.alive).every(u => u.shield >= sec - 0.2)).toBe(true);
      const u = f.party.find(x => x.role === 'ranged' && !x.me && near(f, x).length)!;
      for (const v of near(f, u)) v.hp = v.max * 0.5; // 체력이 낮아도 보호막이면 피뢰침
      chainFrom(f, u, 50, 4, 0.25, '실습 번개');
      expect(f.events.filter(e => e.type === 'fx' && e.name === 'chain-bolt')).toHaveLength(1);
      expect(f.events.some(e => e.type === 'fx' && e.name === 'chain-rod')).toBe(true);
    }
    // 실습 번개는 플라스크가 모이는 12초가 끝난 뒤 떨어짐
    const fl = skill('pongpong', 'flask'), bolt = skill('pongpong', 'bolt');
    expect(bolt.first! + bolt.cast).toBeGreaterThan(fl.first! + 12);
    expect(bolt.period).toBe(fl.period);
    expect(skill('pongpong88', 'bolt').effect).toMatchObject({ p: 'chain', jumps: 2 });
  });
  it('빗자루 승차권: 넘치는 빛 그릇이 가득 차면 마나 2 회복', () => {
    const f = boss('pongpong', false, { broomTicket: 2 });
    f.mana = 50;
    skillOn(f, 'flask');
    steps(f, 0.05);
    f.vessel!.fill = f.vessel!.need;
    const seen = steps(f, 0.05);
    expect(f.mana).toBeGreaterThanOrEqual(52);
    expect(seen.some(e => e.type === 'spec' && e.name === '빗자루 승차권')).toBe(true);
  });
  it('뒤죽박죽: 공중 부양은 거꾸로 주문이 걸린 사람을 끝나기 직전에 띄워, 떠 있는 동안 뒤집힘', () => {
    const fl = skill('dwijuk', 'flip'), lv = skill('dwijuk', 'levit');
    const lift = (lv.effect as { sec: number }).sec, dur = (fl.effect as { debuff: { left: number } }).debuff.left;
    expect(fl.first! + dur).toBeGreaterThan(lv.first! + lv.cast);
    expect(fl.first! + dur).toBeLessThan(lv.first! + lv.cast + lift);
    expect(fl.period).toBe(lv.period);
    const f = boss('dwijuk');
    skillOn(f, 'flip');
    steps(f, 0.05);
    const flipped = f.party.filter(u => u.debuffs.some(d => d.name === '거꾸로 주문'));
    expect(flipped).toHaveLength(2);
    expect(flipped.some(u => u.me || u.role === 'tank')).toBe(false);
    flipped.forEach(u => { u.hp = u.max * 0.7; });
    steps(f, lv.first! - fl.first! - 0.05);
    skillOn(f, 'levit');
    E.step(f); f.events.length = 0;
    expect(tels(f, 'levit')[0].units.sort()).toEqual(flipped.map(u => u.id).sort());
    steps(f, lv.cast + 0.1);
    expect(flipped.every(u => u.lift)).toBe(true);
    steps(f, dur - (lv.first! - fl.first!) - lv.cast);
    for (const u of flipped) expect(u.hp / u.max).toBeCloseTo(0.3, 1); // 떠 있는 동안 70% → 30%
  });
  it('뒤죽박죽 30% 아래: 전교생 공중 부양 (거꾸로 주문 · 공중 부양 3명)', () => {
    const f = boss('dwijuk');
    f.bossHp = f.bossMax * 0.29;
    E.step(f);
    expect(f.phase).toBe(2);
    skillOn(f, 'flip2');
    steps(f, 0.05);
    expect(f.party.filter(u => u.debuffs.some(d => d.name === '거꾸로 주문'))).toHaveLength(3);
    skillOn(f, 'levit2');
    E.step(f);
    expect(tels(f, 'levit2')[0].units).toHaveLength(3);
  });
  it('뒤죽박죽 거꾸로 주문: 가장 낮아도 25% (가득 찬 사람이 뒤집혀도 낙하 피해에 바로 쓰러지지 않음), 자동 힐러는 공중 부양 예고에 찍힌 사람부터 지움', () => {
    expect((skill('dwijuk', 'flip').effect as { debuff: { end: { min: number } } }).debuff.end.min).toBe(0.25);
    const f = boss('dwijuk');
    skillOn(f, 'flip');
    steps(f, 0.05);
    const flipped = f.party.filter(u => u.debuffs.some(d => d.name === '거꾸로 주문'));
    flipped.forEach(u => { u.hp = u.max; });
    const tk = f.party.find(u => u.role === 'tank')!;
    tk.hp = tk.max * 0.3; // 탱커가 위급해도 띄우기 전 해제가 먼저
    skillOn(f, 'levit');
    E.step(f); f.events.length = 0;
    f.cd.purify = 0; f.gcd = 0; f.cast = null;
    E.autoHealer(f);
    expect(flipped.filter(u => u.debuffs.some(d => d.name === '거꾸로 주문'))).toHaveLength(1);
  });
  it('뒤죽박죽 졸업장: 뒤집힌 아군이 40~60%면 보호막', () => {
    const run = (r: number) => {
      const f = boss('dwijuk', false, { diploma: 0.5 });
      const u = f.party.find(x => x.role === 'ranged' && !x.me)!;
      u.hp = u.max * r;
      applyDebuff(f, u, { name: '거꾸로 주문', type: '마법', left: 0.05, end: { p: 'flip', min: 0.05 } });
      return steps(f, 0.2).some(e => e.type === 'spec' && e.id === u.id && e.name === '뒤죽박죽 졸업장');
    };
    expect([run(0.5), run(0.9)]).toEqual([true, false]);
  });
});

describe('20인 ⑦ 그림자 성벽', () => {
  it('쾅쾅이: 갈고리가 뒷줄 셋 (악몽 넷)을 탱커 곁으로 → 1초 뒤 망치 번개가 보스를 맞는 탱커에서 시작', () => {
    const hook = skill('kwangkwang', 'hook'), ham = skill('kwangkwang', 'hammer');
    expect(ham.first! + ham.cast).toBeGreaterThan(hook.first! + hook.cast);
    expect(ham.period).toBe(hook.period);
    expect(ham.target).toBe('tank');
    expect(ham.effect).toMatchObject({ p: 'chain', jumps: 5 });
    const f = boss('kwangkwang', true);
    skillOn(f, 'hook');
    E.step(f); f.events.length = 0;
    const us = unitsOf(f, tels(f, 'hook')[0].units);
    expect(us).toHaveLength(4);
    steps(f, hook.cast + 0.5);
    const tk = E.aggroTarget(f)!;
    expect(us.filter(u => E.hexDist(f.cells[u.cell], f.cells[tk.cell]) <= 2).length).toBeGreaterThanOrEqual(2);
  });
  it('슝슝이: 그림자 사슬 3쌍 (악몽 4쌍, 균형형) → 화살 바람이 짝마다 한 명을 띄움', () => {
    for (const [mythic, n] of [[false, 3], [true, 4]] as const) {
      const f = boss('syungsyung', mythic);
      skillOn(f, 'chain');
      steps(f, 0.05);
      expect(f.links.filter(l => l.kind === 'balance')).toHaveLength(n);
      skillOn(f, 'gust');
      E.step(f);
      const ids = tels(f, 'gust')[0].units;
      expect(ids).toHaveLength(n);
      for (const l of f.links) expect([l.a, l.b].filter(id => ids.includes(id))).toHaveLength(1);
    }
  });
  it('어둑이 그림자 번개: 구름 넷 중 진짜 둘 (악몽 다섯 중 셋), 가짜는 끝 1초 전에 걷힘', () => {
    for (const [mythic, real] of [[false, 2], [true, 3]] as const) {
      const f = boss('eodugi', mythic);
      skillOn(f, 'bolt');
      E.step(f);
      const ts = tels(f, 'bolt');
      expect(ts.filter(t => !t.fake).flatMap(t => t.units)).toHaveLength(real);
      expect(ts.filter(t => t.fake).flatMap(t => t.units)).toHaveLength(2);
    }
  });
  it('어둑이 그림자 돌풍: 모래시계를 뒤집는 순간 4명을 띄우고, 떠 있어도 적어 둔 체력으로 되돌아감, 되돌림 뒤에 내려옴', () => {
    const f = boss('eodugi');
    f.bossHp = f.bossMax * 0.64;
    E.step(f);
    expect(f.phase).toBe(2);
    f.party.forEach(u => { u.hp = u.max; });
    skillOn(f, 'glass');
    steps(f, 3.05);
    expect(f.glass).toHaveLength(1);
    const at = f.glass[0].at;
    E.step(f);
    const ids = tels(f, 'gust')[0].units;
    expect(ids).toHaveLength(4);
    steps(f, at + 2.6 - f.t);
    const up = unitsOf(f, ids);
    expect(up.every(u => u.lift)).toBe(true);
    up.forEach(u => { u.hp = u.max * 0.4; });
    steps(f, at + 8.2 - f.t);
    expect(f.glass).toHaveLength(0);
    for (const u of up) { expect(u.lift).toBeTruthy(); expect(u.hp / u.max).toBeCloseTo(1, 2); }
    steps(f, 0.5);
    expect(up.every(u => !u.lift && u.hp < u.max)).toBe(true); // 되돌림 뒤 낙하 피해
  });
  it('어둑이의 그림자 휘장: 띄워진 아군이 내려오면 가장 낮은 아군 1명에게 보호막', () => {
    const f = boss('eodugi', false, { shadowVeil: 0.5 });
    const u = f.party.find(x => x.role === 'ranged' && !x.me)!;
    const low = f.party.find(x => x.role === 'melee' && !x.me)!;
    f.party.forEach(x => { x.hp = x.max; });
    low.hp = low.max * 0.3;
    u.lift = { until: f.t, fall: 0, aim: 'party' };
    land(f, u);
    expect(f.events.some(e => e.type === 'spec' && e.id === low.id && e.name === '어둑이의 그림자 휘장')).toBe(true);
  });
});
