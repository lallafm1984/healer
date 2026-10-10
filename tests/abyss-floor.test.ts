/**
 * 묶음 G1 (59 1장 · 3-1 · 4-1 · 4-2 · 5장 · 6장): 새 부품 어둠물 밀물 (P-TIDE) · 빌린 생명 (P-DEBT),
 * 10인 ⑮ 그림자 미궁 (그믐 · 실타래 · 밤그늘), 20인 ⑧ 그림자 진영 (질풍 · 우레발 · 칠흑), 탐험 ㉓ 유령 마차길 · 던전 ⑲ 가라앉은 무도회장 (세레나 · 발렌)
 */
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/bosses';
import { contentOf } from '../src/data/content';
import { ENCOUNTERS } from '../src/data/encounters';
import { PLACE_KINDS } from '../src/data/equipment';
import { CONTENT_PLACE, FACTIONS, PLACES } from '../src/data/places';
import { FEATURED, NAMED } from '../src/data/specials';
import { UNIQUES } from '../src/data/uniques';
import * as E from '../src/engine';
import { applyDebuff } from '../src/engine/bossParts';
import { heal, onDebuffEnd } from '../src/engine/core';
import { specReveal } from '../src/engine/specials';
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
const MAZE = [['maze1', 'geumeum'], ['maze2', 'silta'], ['maze3', 'bamgeuneul']] as const;
const CAMP = [['camp1', 'jilpung'], ['camp2', 'ureobal'], ['camp3', 'chilheuk']] as const;
/** 어둠물 밀물을 바로 띄워 잠기게 함 (예고 3초 + 파티원이 비킴) */
const flood = (f: F, key = 'tide') => { skillOn(f, key); return steps(f, 3.1); };
/** 못 움직이게 묶음 (장판을 안 피함) */
const stay = (f: F, u: Unit) => { u.moving = null; applyDebuff(f, u, { name: '묶임', type: '물리', left: 60, lock: true, noMove: true }); };
/** u를 그 칸 (빈 칸)으로 옮김 */
const put = (f: F, u: Unit, i: number) => { u.moving = null; u.cell = i; };
const freeIn = (f: F, cells: Iterable<number>) => [...cells].filter(i => !f.cells[i].block && !f.party.some(v => v.alive && v.cell === i));
/** 받은 치유 (치유 배율 · 장비가 곱해진 양) */
const got = (f: F, u: Unit, amt: number) => { u.hp = u.max * 0.2; const h0 = u.hp; heal(f, u, amt, true); return u.hp - h0; };

describe('콘텐츠', () => {
  it('10인 ⑮ 그림자 미궁: Lv 91 · 악몽 100, 25칸 판, 심연의 정예 (전 유형)', () => {
    for (const [key, enc] of MAZE) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 91, 10, { '악몽': 100 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc].board, enc).toBe('b25');
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('deep');
    }
    expect(FACTIONS.deep).toMatchObject({ name: '심연의 정예', color: '#8A7CFF', dispel: ['질병', '독', '저주', '마법'] });
  });
  it('20인 ⑧ 그림자 진영: Lv 91 · 악몽 100, 36칸 판, 심연의 정예', () => {
    for (const [key, enc] of CAMP) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 91, 20, { '악몽': 100 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc]).toMatchObject({ board: 'b36', big: true });
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('deep');
    }
  });
  it('탐험 ㉓ 유령 마차길 (Lv 92) · 던전 ⑲ 가라앉은 무도회장 (Lv 95): 옛 세력 몰락한 귀족가 (저주)', () => {
    const a = contentOf('carriage'), b = contentOf('ballroom');
    expect([a.kind, a.unlockLv, a.fights('보통')]).toEqual(['explore', 92, ['carriagetrash', 'serena92']]);
    expect([b.kind, b.unlockLv, b.fights('보통')]).toEqual(['dungeon', 95, ['ballhall', 'serena', 'balcony', 'valen']]);
    for (const k of ['carriage', 'ballroom'] as const) expect(PLACES[CONTENT_PLACE[k]].faction).toBe('noble');
    expect([ENCOUNTERS.serena92.board, ENCOUNTERS.serena.board, ENCOUNTERS.valen.board]).toEqual(['b7', 'b10', 'b10']);
  });
  it('드롭: 레이드 칸마다 종류 1 · 자주 나오는 특수능력 3, 이름 있는 장신구 4, 고유 장비 5', () => {
    for (const [k] of [...MAZE, ...CAMP]) {
      expect(PLACE_KINDS[k], k).toHaveLength(1);
      expect(FEATURED[k], k).toHaveLength(3);
    }
    expect([PLACE_KINDS.carriage, PLACE_KINDS.ballroom].map(k => k.length)).toEqual([2, 3]);
    expect(['maze3', 'camp3', 'carriage', 'ballroom'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['mazeMap', 'knightBanner', 'wetGlove', 'wetScore']);
    expect(['maze1', 'maze2', 'camp1', 'camp2', 'ballroom'].map(p => UNIQUES.find(u => u.place === p)?.key)).toEqual(['tollHelm', 'webGloves', 'galeLance', 'hornSleeve', 'valenRapier']);
  });
});

describe('어둠물 밀물 (P-TIDE)', () => {
  it('판 아래 줄이 잠김: 탐험 7칸 1줄 = 2칸, 던전 10칸 2줄 = 7칸 (끝나지 않는 왈츠), 20인은 줄 수 그대로', () => {
    const a = boss('serena92');
    const ta = skillOn(a, 'tide'); steps(a, 0.05);
    expect(tels(a, 'tide')[0].cells).toHaveLength(2);
    expect(ta.tide).toBe(true);
    const b = boss('valen');
    b.bossHp = b.bossMax * 0.39; E.step(b);
    expect(b.phase).toBe(2);
    skillOn(b, 'tide2'); steps(b, 0.05);
    const cells = tels(b, 'tide2')[0].cells;
    expect(cells).toHaveLength(7);
    expect(Math.min(...[...cells].map(i => b.cells[i].row))).toBe(b.rows - 2);
  });
  it('잠긴 사람은 받는 치유 절반 (지속 힐 · 광역 힐도), 물이 빠지면 그대로', () => {
    const f = boss('serena');
    flood(f);
    const z = f.zones.find(x => x.tide)!;
    expect(z).toBeTruthy();
    const u = f.party.find(x => !x.me && x.role !== 'tank')!;
    const home = u.cell;
    put(f, u, freeIn(f, z.cells)[0]);
    expect(E.submerged(f, u)).toBe(true);
    const sunk = got(f, u, 100);
    put(f, u, home);
    expect(E.submerged(f, u)).toBe(false);
    expect(sunk / got(f, u, 100)).toBeCloseTo(1 - E.TIDE_CUT, 6);
    put(f, u, freeIn(f, z.cells)[0]);
    steps(f, 8.2);
    expect(f.zones.some(x => x.tide)).toBe(false);
    expect(sunk / got(f, u, 100)).toBeCloseTo(1 - E.TIDE_CUT, 6);
  });
  it('파티원은 예고가 뜨면 위쪽 빈 칸으로 비킴 (빈 칸이 남으면 아무도 안 잠김, 탱커는 그대로)', () => {
    const f = boss('serena');
    flood(f);
    const z = f.zones.find(x => x.tide)!;
    for (const u of f.party.filter(x => x.alive && x.role !== 'tank' && !x.me)) expect(z.cells.has(u.cell), u.nick).toBe(false);
  });
  it('뒤집힌 축복 × 어둠물: 거꾸로 건배가 걸린 사람이 잠겨 있으면 치유가 두 배 피해 (발렌)', () => {
    const run = (submerge: boolean) => {
      const f = boss('valen');
      const u = f.party.find(x => !x.me && x.role !== 'tank')!;
      applyDebuff(f, u, (skill('valen', 'toast').effect as { debuff: DebuffDef }).debuff);
      if (submerge) { flood(f); const z = f.zones.find(x => x.tide)!; put(f, u, freeIn(f, z.cells)[0]); }
      u.hp = u.max * 0.8;
      const h0 = u.hp;
      heal(f, u, 100, true);
      return h0 - u.hp;
    };
    const dry = run(false), sunk = run(true);
    expect(dry).toBeGreaterThan(0);
    expect(sunk / dry).toBeCloseTo(2, 1);
  });
  it('마부의 젖은 장갑: 잠긴 아군에게 하는 힐 +12%, 세레나의 젖은 악보: 물이 빠지면 잠겨 있던 아군 회복', () => {
    const run = (specs?: E.FightConfig['specs']) => {
      const f = boss('serena', false, specs);
      flood(f);
      const z = f.zones.find(x => x.tide)!;
      const u = f.party.find(x => !x.me && x.role !== 'tank')!;
      put(f, u, freeIn(f, z.cells)[0]);
      stay(f, u);
      const amt = got(f, u, 100);
      u.hp = u.max * 0.2;
      const seen = steps(f, 8.2);
      return { amt, seen, u };
    };
    const base = run(), glove = run({ wetGlove: 0.12 }), score = run({ wetScore: 0.2 });
    expect(glove.amt / base.amt).toBeCloseTo(1.12, 2);
    expect(score.seen.some(e => e.type === 'spec' && e.name === '세레나의 젖은 악보')).toBe(true);
    expect(base.seen.some(e => e.type === 'spec')).toBe(false);
    expect(score.u.hp).toBeGreaterThan(base.u.hp);
  });
});

describe('빌린 생명 (P-DEBT)', () => {
  it('체력을 가득 채우고 채운 만큼 (최소 30%)이 빚, 초마다 10%씩 불어나고 10초 뒤 남은 빚만큼 피해 (고정), 해제 안 됨', () => {
    const f = boss('geumeum');
    const u = f.party.find(x => !x.me && x.role !== 'tank')!;
    u.hp = u.max * 0.4;
    skillOn(f, 'toll'); steps(f, 0.05);
    const loaned = f.party.filter(x => debtOf(x));
    expect(loaned).toHaveLength(2);
    expect(loaned.some(x => x.me || x.role === 'tank')).toBe(false);
    for (const x of loaned) {
      expect(x.hp).toBeCloseTo(x.max, 6);
      expect(debtOf(x)!.debtLeft!).toBeGreaterThanOrEqual(x.max * 0.3 - 1e-6);
      expect(debtOf(x)!.lock).toBe(true);
    }
    const v = loaned[0], d0 = debtOf(v)!.debtLeft!;
    steps(f, 1);
    expect(debtOf(v)!.debtLeft! / d0).toBeCloseTo(1.1, 1);
    const left = () => debtOf(v)?.debtLeft ?? 0;
    steps(f, 8.5);
    const due = left(), hp0 = v.hp;
    expect(due).toBeGreaterThan(d0 * 2);
    const seen = steps(f, 1);
    expect(debtOf(v)).toBeUndefined();
    expect(seen.some(e => e.type === 'fx' && e.name === 'debt-collect' && e.on === v.id)).toBe(true);
    expect(hp0 - v.hp).toBeGreaterThan(due * 0.9);
  });
  it('넘친 치유가 빚을 갚음 (넘친 1 = 빚 1), 다 갚으면 사라지고 피해 없음', () => {
    const f = boss('geumeum');
    skillOn(f, 'toll'); steps(f, 0.05);
    const v = f.party.find(x => debtOf(x))!;
    const owed = debtOf(v)!.debtLeft!, o0 = f.stats.overheal;
    heal(f, v, 50, true);
    expect(owed - debtOf(v)!.debtLeft!).toBeCloseTo(f.stats.overheal - o0, 6);
    const seen: FightEvent[] = [];
    heal(f, v, owed * 20, true); seen.push(...f.events); f.events.length = 0;
    expect(debtOf(v)).toBeUndefined();
    expect(seen.some(e => e.type === 'fx' && e.name === 'debt-pay')).toBe(true);
    const hp = v.hp;
    steps(f, 11);
    expect(v.hp).toBeGreaterThanOrEqual(hp - 1);
  });
  it('실타래: 그물 사슬 쌍마다 한 명에게 사슬 대출, 짝을 힐해도 반이 넘어가 넘친 몫이 빚을 갚음', () => {
    for (const [mythic, pairs] of [[false, 2], [true, 3]] as const) {
      const f = boss('silta', mythic);
      skillOn(f, 'web'); steps(f, 0.05);
      expect(f.links).toHaveLength(pairs);
      skillOn(f, 'loan'); steps(f, 0.05);
      for (const l of f.links) {
        const two = [l.a, l.b].map(id => f.party.find(u => u.id === id)!);
        expect(two.filter(u => debtOf(u)).length, `${two.map(u => u.nick)}`).toBeLessThanOrEqual(1);
      }
      expect(f.party.filter(u => debtOf(u)).length).toBeGreaterThanOrEqual(pairs - (f.links.some(l => [l.a, l.b].some(id => f.party.find(u => u.id === id)!.me)) ? 1 : 0));
    }
    const f = boss('silta');
    skillOn(f, 'web'); steps(f, 0.05);
    skillOn(f, 'loan'); steps(f, 0.05);
    const l = f.links.find(x => [x.a, x.b].some(id => debtOf(f.party.find(u => u.id === id)!)))!;
    const [a, b] = [l.a, l.b].map(id => f.party.find(u => u.id === id)!);
    const debtor = debtOf(a) ? a : b, mate = debtor === a ? b : a;
    mate.hp = mate.max * 0.5;
    const owed = debtOf(debtor)!.debtLeft!;
    heal(f, mate, 400, true);
    expect(debtOf(debtor)?.debtLeft ?? 0).toBeLessThan(owed - 1);
  });
  it('밤그늘: 미로 덫은 빚진 사람에게 먼저, 덫이 터지면 (지워도) 남은 빚도 함께 거둬 감', () => {
    const f = boss('bamgeuneul');
    skillOn(f, 'loan'); steps(f, 0.05);
    skillOn(f, 'trap'); steps(f, 0.05);
    const v = f.party.find(u => u.debuffs.some(d => d.name === '미로 덫'))!;
    expect(debtOf(v)).toBeTruthy();
    const owed = debtOf(v)!.debtLeft!, hp0 = v.hp;
    const trap = v.debuffs.find(d => d.name === '미로 덫')!;
    v.debuffs = v.debuffs.filter(d => d !== trap);
    onDebuffEnd(f, v, trap, true);
    expect(debtOf(v)).toBeUndefined();
    expect(hp0 - v.hp).toBeGreaterThan(owed * 0.9);
  });
  it('밤그늘: 그림자 감옥에 갇힌 동안 빚이 멈추고 시간도 안 흐름', () => {
    const f = boss('bamgeuneul');
    skillOn(f, 'loan'); steps(f, 0.05);
    const v = f.party.find(u => debtOf(u))!;
    const d = debtOf(v)!, owed = d.debtLeft!, left = d.left;
    v.debuffs.push({ name: '그림자 감옥', type: '물리', left: 30, lock: true, jail: 1 } as never);
    steps(f, 3);
    expect(d.debtLeft!).toBeCloseTo(owed, 3);
    expect(d.left).toBeCloseTo(left, 3);
  });
  it('밤그늘의 미궁 지도: 빚진 아군에게 하는 힐 +20%', () => {
    const run = (specs?: E.FightConfig['specs']) => {
      const f = boss('bamgeuneul', false, specs);
      skillOn(f, 'loan'); steps(f, 0.05);
      const v = f.party.find(u => debtOf(u))!;
      const owed = debtOf(v)!.debtLeft!;
      heal(f, v, 200, true);
      return owed - (debtOf(v)?.debtLeft ?? 0);
    };
    expect(run({ mazeMap: 0.2 }) / run()).toBeCloseTo(1.2, 1);
  });
  it('자동 힐러: 빚이 체력의 60%를 넘거나 4초 안에 걷힐 사람에게 직접 힐해서 갚음', () => {
    const f = boss('geumeum');
    f.mana = 100;
    skillOn(f, 'toll'); steps(f, 0.05);
    const debtors = f.party.filter(u => debtOf(u));
    const sum = () => debtors.reduce((s, u) => s + (debtOf(u)?.debtLeft ?? 0), 0);
    const s0 = sum();
    for (let i = 0; i < 190; i++) { E.autoHealer(f); E.step(f); f.events.length = 0; }
    expect(sum()).toBeLessThan(s0 * 1.5);
  });
});

describe('그림자 진영 · 무도회장', () => {
  it('질풍: 기병 돌격은 못 피하는 줄 (악몽 2줄), 돌격 뒤 가장자리 칸이 무너짐 (최대 6)', () => {
    expect(skill('jilpung', 'charge0')).toMatchObject({ fixed: true, cells: { p: 'line' } });
    expect(skill('jilpung', 'charge0b').when).toEqual({ mythic: true });
    const f = boss('jilpung');
    for (let i = 0; i < 8; i++) { skillOn(f, 'trample'); steps(f, 0.05); }
    expect(f.cells.filter(c => c.block === 'hole')).toHaveLength(6);
  });
  it('우레발: 발 구르기 진동은 뿔 들이받기 3.5초 뒤 (두 번에 한 번), 악몽은 그 뒤 4초 받는 치유 −15%', () => {
    const b = skill('ureobal', 'buster'), st = skill('ureobal', 'stomp'), m = skill('ureobal', 'stompm');
    expect(st.first! + st.cast - (b.first! + b.cast)).toBeCloseTo(3.5);
    expect(st.period).toBe(b.period * 2); // 뿔 들이받기 두 번에 한 번
    expect(m.when).toEqual({ mythic: true });
    expect(m.first!).toBeGreaterThan(st.first! + st.cast);
  });
  it('칠흑: 35% 아래 마지막 진형 (차례 ①②③) + 차례 번개는 아직 힐을 못 받은 다음 번호에게', () => {
    const f = boss('chilheuk');
    f.bossHp = f.bossMax * 0.64; E.step(f);
    expect(f.phase).toBe(2);
    f.bossHp = f.bossMax * 0.34; E.step(f);
    expect(f.phase).toBe(3);
    skillOn(f, 'order'); steps(f, 0.05);
    expect(f.order?.ids).toHaveLength(3);
    const ids = f.order!.ids;
    f.order!.i = 1;
    skillOn(f, 'orderbolt'); steps(f, 0.05);
    const me = f.party.find(u => u.me)!;
    const want = ids.slice(1).find(id => id !== me.id);
    expect(tels(f, 'orderbolt')[0].units).toEqual([want]);
  });
  it('칠흑의 기사단 휘장: 신기루 번개의 가짜 구름이 걷히면 진짜 구름 대상 이웃 가운데 낮은 2명 보호막', () => {
    const run = (specs?: E.FightConfig['specs']) => {
      const f = boss('chilheuk', false, specs);
      skillOn(f, 'bolt'); steps(f, 0.05);
      const real = tels(f, 'bolt').find(t => !t.fake)!, fakes = tels(f, 'bolt').filter(t => t.fake);
      expect(fakes.length).toBe(1);
      const u = f.party.find(w => w.id === real.units[0])!;
      const spots = f.cells.filter(c => !c.block && E.hexDist(c, f.cells[u.cell]) === 1 && !f.party.some(v => v.alive && v.cell === c.i));
      const others = f.party.filter(w => w !== u && !w.me && w.role !== 'tank' && E.hexDist(f.cells[w.cell], f.cells[u.cell]) > 1).slice(0, 3);
      others.forEach((w, i) => { if (spots[i]) put(f, w, spots[i].i); w.hp = w.max * (0.3 + i * 0.1); });
      f.tels = f.tels.filter(t => !t.fake);
      if (f.sp) specReveal(f, fakes);
      const shielded = f.party.filter(w => w.mods.some(m => m.src === 'knightBanner')).map(w => w.id);
      return { seen: f.events, shielded, low2: others.slice(0, 2).map(w => w.id) };
    };
    const on = run({ knightBanner: 0.3 }), off = run();
    expect(on.seen.some(e => e.type === 'spec' && e.name === '칠흑의 기사단 휘장')).toBe(true);
    expect(on.shielded.sort()).toEqual(on.low2.sort());
    expect(off.seen.some(e => e.type === 'spec')).toBe(false);
  });
  it('세레나: 악몽은 박자 밀물 10초 (보통 8초)', () => {
    expect(skill('serena', 'tide').dur).toBe(8);
    expect(skill('serena', 'tidem')).toMatchObject({ dur: 10, when: { mythic: true }, hidden: true });
  });
});
