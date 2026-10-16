/**
 * 강타 예고 숫자 (칸 위 「-N」) = 맞을 때 실제로 받는 피해 (2026-10-16 Lim 「탱커가 아닌 파티원이 예상 피해보다 많이 깎여 한방에 죽음」).
 * 탱커 강타는 탱커 기준 수치라 탱커가 아닌 사람에게 가면 직업군 방어력만큼 큼 (근접 5/3배 · 원거리 · 힐러 7/3배, 레이드 앞줄 원거리는 × 1.5 더).
 * 예전 숫자는 보스 배율 × 보호만 곱해서 그만큼 작게 보였음
 */
import { describe, expect, it } from 'vitest';
import { POS_RULES } from '../src/data/rules';
import * as E from '../src/engine';
import { BUSTER_TOGETHER, busterOn, telDmg } from '../src/engine/bossParts';
import type { EncounterKey } from '../src/data/encounters';
import type { Cell, Fight, Telegraph, Unit } from '../src/engine';

const quiet = (f: Fight) => f.skills.forEach(s => { s.next = Infinity; });
const tankBuster = (f: Fight) => f.skills.find(s => s.kind === 'buster' && s.dmg)!;
const telOn = (f: Fight, u: Unit, inSec = 2, s = tankBuster(f)): Telegraph =>
  ({ id: f.nextId++, skill: s, kind: 'buster', start: f.t, impact: f.t + inSec, units: [u.id], cells: new Set() });
/** 예고가 지금 떨어짐: 실제로 깎인 체력 */
const land = (f: Fight, t: Telegraph, u: Unit): number => { const hp = u.hp; t.impact = f.t; t.skill.hit!(f, t); return hp - u.hp; };
/** 죽지 않게 체력을 넉넉히 (체력 비율 조건은 그대로) */
const roomy = (u: Unit) => { const k = 1e4 / u.max; u.max *= k; u.base *= k; u.hp *= k; };
const place = (f: Fight, u: Unit, row: number) => {
  const c = f.cells.find(x => x.row === row && !x.unit && !x.block) as Cell;
  f.cells[u.cell].unit = null; c.unit = u; u.cell = c.i; u.home = c.i;
};
const by = (f: Fight, role: Unit['role']) => f.party.find(u => u.role === role && !u.me)!;

describe('강타 예고 숫자 = 실제 피해', () => {
  it.each<[string, EncounterKey]>([['5인 b10', 'scrap'], ['10인 히드라', 'hydra'], ['20인 b36', 'choir']])('%s: 탱커 · 근접 · 원거리 · 나 모두 예고 숫자만큼 깎임', (_, enc) => {
    const f = E.create({ encounter: enc, diff: '보통', seed: 1 });
    quiet(f);
    const s = tankBuster(f);
    for (const u of [by(f, 'tank'), by(f, 'melee'), by(f, 'ranged'), f.me]) {
      roomy(u);
      const t = telOn(f, u, 0);
      const shown = telDmg(f, t, u);
      expect(land(f, t, u)).toBeCloseTo(shown, 6);
    }
    // 직업군 방어력: 탱커 기준 수치가 근접 5/3배 · 원거리 7/3배 (예전 숫자는 탱커 값 그대로였음)
    const base = s.dmg! * f.dmgMult;
    expect(telDmg(f, telOn(f, by(f, 'tank'), 0), by(f, 'tank'))).toBeCloseTo(base, 6);
    expect(telDmg(f, telOn(f, by(f, 'melee'), 0), by(f, 'melee'))).toBeCloseTo(base * 5 / 3, 6);
  });

  it('레이드 앞줄 원거리: 직업군 방어력 7/3배 × 위치 1.5배까지 숫자에', () => {
    const f = E.create({ encounter: 'hydra', diff: '보통', seed: 1 });
    quiet(f);
    const r = by(f, 'ranged');
    roomy(r);
    place(f, r, 1);
    const t = telOn(f, r, 0), shown = telDmg(f, t, r);
    expect(shown).toBeCloseTo(tankBuster(f).dmg! * f.dmgMult * (7 / 3) * POS_RULES.rangedTaken, 6);
    expect(land(f, t, r)).toBeCloseTo(shown, 6);
  });

  it('받는 피해 증가 디버프 · 보호 · 피해 감소 · 능력 피해 증가도 같은 계산', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 2 });
    quiet(f);
    const u = by(f, 'melee');
    roomy(u);
    const cases: [string, () => void][] = [
      ['가시 (vuln 디버프)', () => { u.debuffs.push({ id: f.nextId++, name: '가시', type: '저주', left: 10, vuln: 0.25, stack: 2 }); }],
      ['보호 (−40%)', () => { u.shield = 5; }],
      ['피해 감소', () => { u.redu = 5; u.reduCut = 0.3; }],
      ['능력 피해 증가 (vuln mod)', () => { u.mods.push({ k: 'vuln', v: 0.2, until: f.t + 10, src: 'test' }); }],
      ['능력 피해 감소 (cut mod)', () => { u.mods.push({ k: 'cut', v: 0.15, until: f.t + 10, src: 'test' }); }],
    ];
    for (const [name, put] of cases) {
      put();
      const t = telOn(f, u, 0), shown = telDmg(f, t, u);
      expect(land(f, t, u), name).toBeCloseTo(shown, 6);
    }
  });

  it('맞기 전에 끝나는 보호 · 피해 감소는 숫자에서 안 줄임 (더 깎이지 않게)', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 3 });
    quiet(f);
    const u = by(f, 'ranged');
    const bare = telDmg(f, telOn(f, u, 2), u);
    u.shield = 1; u.redu = 1; u.reduCut = 0.3;
    u.mods.push({ k: 'cut', v: 0.5, until: f.t + 1, src: 'test' });
    expect(telDmg(f, telOn(f, u, 2), u)).toBeCloseTo(bare, 6); // 1초 뒤 끝나고 2초 뒤 맞음
    expect(telDmg(f, telOn(f, u, 0.5), u)).toBeCloseTo(bare * 0.6 * 0.7 * 0.5, 6); // 맞을 때까지 남음
  });

  it('탱커가 1열을 떠나 강타가 다른 사람에게 가도 예고 숫자만큼만 깎임 (실제 전투 흐름)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const f = E.create({ encounter: 'scrap', diff: '보통', seed });
      quiet(f);
      const tank = by(f, 'tank');
      place(f, tank, 1);
      f.zones.push({ id: 9999, cells: new Set(f.cells.filter(c => c.row === 0).map(c => c.i)), end: Infinity, dps: 0 }); // 1열을 막아 탱커가 못 돌아감
      for (let i = 0; i < 20 && !f.loose; i++) { E.step(f); f.events.length = 0; }
      const hit = f.party.find(u => u.id === f.loose?.id)!;
      expect(hit.role).not.toBe('tank');
      roomy(hit);
      tankBuster(f).next = f.t;
      E.step(f); f.events.length = 0;
      const tel = f.tels.find(t => t.kind === 'buster' && t.units.includes(hit.id))!;
      expect(tel).toBeTruthy();
      const shown = busterOn(f, hit)!.dmg, hp0 = hit.hp;
      while (f.tels.includes(tel)) { E.step(f); f.events.length = 0; }
      // 예고 동안 다른 피해는 없음 (기술을 모두 멈춤): 깎인 양 = 예고 숫자
      expect(hp0 - hit.hp).toBeCloseTo(shown, 4);
      expect(shown).toBeCloseTo(tankBuster(f).dmg! * f.dmgMult * (hit.role === 'melee' ? 5 / 3 : 7 / 3), 4);
    }
  });

  it('같이 떨어지는 강타는 더해서 하나의 숫자, 따로면 먼저 떨어지는 것만', () => {
    const f = E.create({ encounter: 'scrap', diff: '보통', seed: 1 });
    quiet(f);
    const u = by(f, 'tank'), one = telDmg(f, telOn(f, u, 2), u);
    f.tels.push(telOn(f, u, 2), telOn(f, u, 2 + BUSTER_TOGETHER / 2));
    expect(busterOn(f, u)!.dmg).toBeCloseTo(one * 2, 6);
    f.tels.push(telOn(f, u, 5));
    expect(busterOn(f, u)!.dmg).toBeCloseTo(one * 2, 6);
    f.tels = [];
    expect(busterOn(f, u)).toBeNull();
  });
});
