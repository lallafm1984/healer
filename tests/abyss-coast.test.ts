/**
 * 묶음 G2 (59 1장 · 2장 · 4-3 · 6장): 20인 ⑨ 어둠물 해안 (잔물결: 물 위 섬 · 휘감이: 물로 끌어내림 · 검은물결: 빚 먼저, 그릇은 나중),
 * 탐험 ㉔ 어둠물 등불길 (녹슬음 · 함정 술사)
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
import { applyDebuff } from '../src/engine/bossParts';
import { heal } from '../src/engine/core';
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
const COAST = [['coast1', 'janmul'], ['coast2', 'hwigami'], ['coast3', 'geomeun']] as const;
const wetCells = (f: F) => new Set(f.zones.filter(z => z.tide).flatMap(z => [...z.cells]));

describe('콘텐츠', () => {
  it('20인 ⑨ 어둠물 해안: Lv 94 · 악몽 100, 36칸 판, 심연의 정예', () => {
    for (const [key, enc] of COAST) {
      const c = contentOf(key);
      expect([c.kind, c.unlockLv, c.size('보통'), c.diffUnlock], key).toEqual(['raid', 94, 20, { '악몽': 100 }]);
      expect(c.fights('보통')).toEqual([enc]);
      expect(ENCOUNTERS[enc]).toMatchObject({ board: 'b36', big: true });
      expect(PLACES[CONTENT_PLACE[key]].faction).toBe('deep');
    }
  });
  it('탐험 ㉔ 어둠물 등불길 (Lv 96): 꺼진 등불 길 → 그림자 대여상 녹슬음, 심연의 정예', () => {
    const c = contentOf('lantern');
    expect([c.kind, c.unlockLv, c.fights('보통')]).toEqual(['explore', 96, ['lanterntrash', 'nokseul96']]);
    expect(PLACES[CONTENT_PLACE.lantern].faction).toBe('deep');
    expect(ENCOUNTERS.nokseul96.board).toBe('b7');
  });
  it('함정 술사: 질병 → 독 → 함정 → 저주 → 마법 → 함정 차례로', () => {
    const hex = ENCOUNTERS.lanterntrash.mobs!.find(m => m.name === '함정 술사')!.attacks.find(a => a.key === 'hex')!;
    const ds = (hex.effect as { debuffs: DebuffDef[] }).debuffs;
    expect(ds.map(d => (d.trap ? '함정' : d.type))).toEqual(['질병', '독', '함정', '저주', '마법', '함정']);
  });
  it('드롭: 레이드 칸마다 종류 1 · 자주 나오는 특수능력 3, 이름 있는 장신구 2, 고유 장비 2', () => {
    for (const [k] of COAST) {
      expect(PLACE_KINDS[k], k).toHaveLength(1);
      expect(FEATURED[k], k).toHaveLength(3);
    }
    expect(PLACE_KINDS.lantern).toHaveLength(2);
    expect(['coast3', 'lantern'].map(p => NAMED.find(n => n.place === p)?.key)).toEqual(['moonBowl', 'debtLantern']);
    expect(['coast1', 'coast2'].map(p => UNIQUES.find(u => u.place === p)?.key)).toEqual(['oarStaff', 'eelVest']);
  });
});

describe('잔물결: 어둠물 × 피난처 (물 위 섬)', () => {
  it('큰 밀물: 아래 3줄 (18칸) 가운데 섬 3칸 (악몽 2칸)만 마름, 섬은 잠길 줄 안에', () => {
    for (const [mythic, isl] of [[false, 3], [true, 2]] as const) {
      const f = boss('janmul', mythic);
      const s = skillOn(f, 'big'); steps(f, 0.05);
      expect(s.tide).toBe(true);
      const t = tels(f, 'big')[0];
      expect(t.impact - t.start).toBeCloseTo(4, 6);
      const rows = f.cells.filter(c => !c.block && c.row >= f.rows - 3);
      expect(t.cells.size, `mythic ${mythic}`).toBe(rows.length - isl);
      expect([...t.cells].every(i => f.cells[i].row >= f.rows - 3)).toBe(true);
    }
  });
  it('물이 차오르면 섬 칸에 섬 연출, 섬과 위쪽 빈 칸으로 비킨 사람은 안 잠김', () => {
    const f = boss('janmul');
    skillOn(f, 'big');
    const seen = steps(f, 4.2);
    const isl = seen.filter(e => e.type === 'fx' && e.name === 'tide-island');
    expect(isl).toHaveLength(3);
    const wet = wetCells(f);
    expect(isl.every(e => e.type === 'fx' && e.cell != null && !wet.has(e.cell))).toBe(true);
    const dry = f.party.filter(u => u.alive && u.role !== 'tank' && !wet.has(u.cell));
    expect(dry.length).toBeGreaterThan(f.party.length / 2);
  });
});

describe('휘감이: 어둠물 × 끌어당김 (물로 끌어내림)', () => {
  it('밀물 동안 보스 가까운 3명 (악몽 4명)을 잠긴 칸으로 끌어내려 6초 묶음 + 피해', () => {
    for (const [mythic, n] of [[false, 3], [true, 4]] as const) {
      const f = boss('hwigami', mythic);
      skillOn(f, 'tide'); steps(f, 3.6);
      const s = skillOn(f, 'drag'); steps(f, 0.05);
      expect(s.drag).toBe(true);
      const t = tels(f, 'drag')[0];
      expect(t.units).toHaveLength(n);
      const us = t.units.map(id => f.party.find(u => u.id === id)!);
      expect(us.every(u => u.role !== 'tank' && !u.me)).toBe(true);
      const top = Math.max(...us.map(u => f.cells[u.cell].row));
      const others = f.party.filter(u => u.alive && u.role !== 'tank' && !u.me && !us.includes(u) && !wetCells(f).has(u.cell));
      expect(others.every(u => f.cells[u.cell].row >= top)).toBe(true); // 보스 가까운 줄부터
      const hp = us.map(u => u.hp);
      steps(f, 2.5 + 0.5);
      const wet = wetCells(f);
      us.forEach((u, i) => {
        expect(wet.has(u.cell), u.nick).toBe(true);
        expect(E.submerged(f, u)).toBe(true);
        expect(u.debuffs.some(d => d.name === '휘감김' && d.noMove)).toBe(true);
        expect(u.hp).toBeLessThan(hp[i]);
      });
      steps(f, 6);
      expect(us.every(u => !u.debuffs.some(d => d.name === '휘감김'))).toBe(true);
    }
  });
  it('밀물이 없으면 가장 아래 빈 칸으로', () => {
    const f = boss('hwigami');
    skillOn(f, 'drag'); steps(f, 0.05);
    const ids = tels(f, 'drag')[0].units;
    steps(f, 3);
    for (const id of ids) { const u = f.party.find(x => x.id === id)!; expect(f.cells[u.cell].row).toBeGreaterThanOrEqual(f.rows - 3); }
  });
  it('자동 힐러: 끌려갈 사람이 낮으면 예고 동안 먼저 채움', () => {
    const f = boss('hwigami');
    f.mana = 100;
    skillOn(f, 'drag'); steps(f, 0.05);
    const u = f.party.find(x => x.id === tels(f, 'drag')[0].units[0])!;
    for (const v of f.party) v.hp = v.max * 0.85;
    u.hp = u.max * 0.6;
    const h0 = u.hp;
    for (let i = 0; i < 40 && !f.cast && u.hot <= 0 && u.hp <= h0; i++) { E.autoHealer(f); if (!f.cast) { E.step(f); f.events.length = 0; } }
    expect(f.cast?.uid === u.id || u.hot > 0 || u.hp > h0).toBe(true);
  });
});

describe('검은물결: 빌린 생명 × 넘치는 빛 그릇', () => {
  const owe = (f: F) => {
    const u = f.party.find(x => !x.me && x.role !== 'tank')!;
    u.hp = u.max * 0.5;
    applyDebuff(f, u, (skill('geomeun', 'loan').effect as { debuff: DebuffDef }).debuff);
    return u;
  };
  it('빚진 사람에게 넘친 치유는 빚부터 갚고 남는 몫만 그릇에', () => {
    const f = boss('geomeun');
    skillOn(f, 'bowl'); steps(f, 0.05);
    expect(f.vessel?.name).toBe('달빛 그릇');
    const u = owe(f);
    heal(f, u, 20, true);
    expect(debtOf(u)).toBeTruthy();
    expect(f.vessel!.fill).toBeCloseTo(0, 6);
    const o0 = f.stats.overheal, d1 = debtOf(u)!.debtLeft!;
    heal(f, u, d1 * 20, true);
    expect(debtOf(u)).toBeUndefined();
    expect(f.vessel!.fill).toBeCloseTo(f.stats.overheal - o0 - d1, 6);
  });
  it('검은물결의 달빛 그릇: 그릇에 모이는 넘친 치유 +25%, 빚을 갚은 몫도 절반이 그릇에', () => {
    const run = (specs?: E.FightConfig['specs']) => {
      const f = boss('geomeun', false, specs);
      skillOn(f, 'bowl'); steps(f, 0.05);
      const u = owe(f);
      const owed = debtOf(u)!.debtLeft!, o0 = f.stats.overheal;
      heal(f, u, owed * 20, true);
      return { fill: f.vessel!.fill, owed, over: f.stats.overheal - o0 };
    };
    const a = run(), b = run({ moonBowl: 0.25 });
    expect(a.fill).toBeCloseTo(a.over - a.owed, 6);
    expect(b.fill).toBeCloseTo((b.over - b.owed) * 1.25 + b.owed / 2, 6);
  });
  it('2페이즈 생명 대출 4명 (악몽 5명) · 3페이즈 해일 아래 2줄 12초', () => {
    for (const [mythic, n] of [[false, 4], [true, 5]] as const) {
      const f = boss('geomeun', mythic);
      f.bossHp = f.bossMax * 0.6; E.step(f);
      expect(f.phase).toBe(2);
      skillOn(f, 'loan'); steps(f, 0.05);
      expect(f.party.filter(u => debtOf(u)).length, `mythic ${mythic}`).toBe(n);
    }
    const f = boss('geomeun');
    f.bossHp = f.bossMax * 0.6; E.step(f);
    f.bossHp = f.bossMax * 0.3; E.step(f);
    expect(f.phase).toBe(3);
    skillOn(f, 'surge'); steps(f, 3.1);
    const z = f.zones.find(x => x.tide)!;
    expect(z.cells.size).toBe(12);
    expect(z.end - f.t).toBeGreaterThan(11.5);
  });
});

describe('등불길', () => {
  it('꺼지지 않는 등불: 넘친 치유가 빚을 갚는 양 1.2배', () => {
    const run = (specs?: E.FightConfig['specs']) => {
      const f = boss('nokseul96', false, specs);
      skillOn(f, 'loan'); steps(f, 0.05);
      const u = f.party.find(x => debtOf(x))!;
      const d0 = debtOf(u)!.debtLeft!, o0 = f.stats.overheal;
      heal(f, u, 30, true);
      return (d0 - debtOf(u)!.debtLeft!) / (f.stats.overheal - o0);
    };
    expect(run()).toBeCloseTo(1, 6);
    expect(run({ debtLantern: 0.2 })).toBeCloseTo(1.2, 6);
  });
  it('녹슬음: 빚진 사람이 어둠물에 잠기면 빚이 두 배로 불어남', () => {
    const f = boss('nokseul96');
    skillOn(f, 'loan'); steps(f, 0.05);
    const u = f.party.find(x => debtOf(x))!;
    skillOn(f, 'tide'); steps(f, 3.1);
    const z = f.zones.find(x => x.tide)!;
    u.moving = null;
    applyDebuff(f, u, { name: '묶임', type: '물리', left: 60, lock: true, noMove: true });
    u.cell = f.cells.find(c => !c.block && !z.cells.has(c.i) && !f.party.some(v => v.alive && v.cell === c.i))!.i;
    const dry = debtOf(u)!.debtLeft!;
    steps(f, 1);
    const g1 = debtOf(u)!.debtLeft! / dry;
    u.cell = [...z.cells].find(i => !f.party.some(v => v.alive && v.cell === i))!;
    const wet = debtOf(u)!.debtLeft!;
    steps(f, 1);
    const g2 = debtOf(u)!.debtLeft! / wet;
    expect(Math.log(g2) / Math.log(g1)).toBeCloseTo(2, 1);
  });
});
