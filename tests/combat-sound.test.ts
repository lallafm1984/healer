import { describe, expect, it } from 'vitest';
import { create } from '../src/engine';
import { combatSounds, FX_SOUND } from '../src/battle/combat-sound';
import type { FightEvent } from '../src/engine/types';
import { dmgMods } from '../src/engine/abilities';

describe('전투 소리 누락과 중복', () => {
  const fight = () => create({ encounter: 'warden', diff: '쉬움', seed: 4 });
  it('파티원 공격·피격·막음·빗나감을 구분한다', () => {
    const f = fight(), u = f.party.find(u => !u.me)!;
    const events: FightEvent[] = [
      { type: 'hit', uid: u.id, amt: 20 },
      { type: 'dmg', id: u.id, amt: 20 },
      { type: 'parry', id: u.id },
      { type: 'miss', uid: u.id },
    ];
    const names = combatSounds(f, events).map(s => s.name);
    expect(names).toContain('ally-hurt');
    expect(names).toContain('parry');
    expect(names).toContain('attack-miss');
    expect(names.some(n => n.startsWith('attack-') && n !== 'attack-miss')).toBe(true);
  });
  it('직업별 공격을 따로 재생하면 공통 공격을 겹치지 않고 다른 피격음은 유지한다', () => {
    const f = fight(), u = f.party[0];
    expect(combatSounds(f, [
      { type: 'hit', uid: u.id, amt: 20 },
      { type: 'dmg', id: u.id, amt: 20 },
    ], { partyAttacks: false }).map(s => s.name)).toEqual(['ally-hurt']);
  });
  it('광역 피격과 다수 보호막은 틱마다 소리 하나로 합친다', () => {
    const f = fight();
    const events: FightEvent[] = f.party.flatMap(u => [
      { type: 'dmg' as const, id: u.id, amt: 50 },
      { type: 'shield' as const, id: u.id, amt: 20 },
    ]);
    expect(combatSounds(f, events).map(s => s.name).sort()).toEqual(['ally-hurt', 'shield']);
  });
  it('폭발·광폭화의 기존 소리와 기믹 소리를 중복하지 않는다', () => {
    const f = fight();
    expect(combatSounds(f, [
      { type: 'sound', name: 'burst' }, { type: 'fx', name: 'explode' },
      { type: 'phase', text: '광폭화' }, { type: 'fx', name: 'rage' },
    ])).toEqual([]);
  });
  it('지속 회복 틱은 조용하고 실패한 능력은 성공 소리를 내지 않는다', () => {
    const f = fight(), u = f.party[0];
    expect(combatSounds(f, [{ type: 'tick', id: u.id, amt: 1, eff: 1, crit: false }])).toEqual([]);
    expect(combatSounds(f, [{ type: 'ability', id: u.id, name: '실패', fumble: true }]).map(s => s.name)).toEqual(['status-stagger']);
  });
  it('연계 해제도 들리며 이미 해제 소리가 있는 직접 스킬과 중복하지 않는다', () => {
    const f = fight(), id = f.party[0].id;
    expect(combatSounds(f, [{ type: 'dispel', id, trap: false }]).map(s => s.name)).toEqual(['dispel']);
    expect(combatSounds(f, [{ type: 'dispel', id }, { type: 'sound', name: 'dispel' }])).toEqual([]);
  });
  it('모든 기믹 연출은 명시적인 소리 방향이 있다', () => {
    expect(Object.keys(FX_SOUND).length).toBeGreaterThan(50);
    expect(Object.values(FX_SOUND).every(Boolean)).toBe(true);
  });
  it('보호막이 피해를 전부 흡수해도 방어 소리를 내고 피해 계산은 유지한다', () => {
    const f = fight(), u = f.party[0];
    u.mods = [{ k: 'absorb', v: 100, until: f.t + 10, src: 'test' }];
    f.events.length = 0;
    expect(dmgMods(f, u, 30, false)).toBe(0);
    expect(u.mods[0].v).toBe(70);
    expect(f.events).toContainEqual({ type: 'sound', name: 'shield' });
  });
});
