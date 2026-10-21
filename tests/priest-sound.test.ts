import { describe, expect, it } from 'vitest';
import { create, use, useTalent } from '../src/engine';
import { addDebuff, damage } from '../src/engine/core';
import { healerTick } from '../src/engine/healer';
import { TALENTS } from '../src/data/talents';
import type { SkillKey } from '../src/data/skills';
import { priestSounds, PRIEST_SKILL_SOUNDS } from '../src/battle/priest-sound';
import { combatSounds } from '../src/battle/combat-sound';

const fight = () => {
  const f = create({ encounter: 'warden', diff: '쉬움', seed: 7, level: 100, hero: 'priest' });
  f.gear.crit = 0; f.events.length = 0; f.used = [];
  return f;
};

describe('사제 전체 스킬 효과음', () => {
  it.each(Object.entries(PRIEST_SKILL_SOUNDS))('%s의 실제 성공 이벤트가 전용 소리로 연결된다', (key, sound) => {
    const f = fight(), u = f.party.find(u => !u.me)!;
    u.hp = u.max * .4;
    if (key === 'purify') addDebuff(f, u, { name: '시험', type: '마법', left: 20 });
    if (key === 'serenity') f.g.p = 100;
    f.events.length = 0;
    expect(use(f, key as SkillKey, u.cell).ok).toBe(true);
    if (f.cast) expect(priestSounds(f).cues).toEqual([]); // 아직 시전 중
    for (let i = 0; f.cast && i < 200; i++) { f.t += .05; healerTick(f); }
    expect(f.cast).toBeNull();
    const plan = priestSounds(f);
    expect(plan.cues.map(c => c.name)).toEqual([sound]);
    expect(plan.handlesHealing).toBe(true);
    expect(f.used?.length).toBeGreaterThan(0); // 시각 효과 기록은 소비하지 않는다
  });

  it('실패한 정화와 취소한 시전은 완료음을 내지 않는다', () => {
    const f = fight(), u = f.party[0];
    expect(use(f, 'purify', u.cell).ok).toBe(false);
    expect(priestSounds(f).cues).toEqual([]);
    expect(use(f, 'heal', u.cell).ok).toBe(true);
    f.cast = null;
    healerTick(f);
    expect(priestSounds(f).cues).toEqual([]);
  });

  it('찬가는 시작에 한 번 울리고 광역 회복 틱에서는 반복하지 않는다', () => {
    const f = fight();
    expect(use(f, 'hymn', f.me.cell).ok).toBe(true);
    expect(priestSounds(f).cues.map(c => c.name)).toEqual(['hymn-priest']);
    f.events.length = 0; f.used = [];
    f.party.forEach(u => { u.hp = u.max * .3; });
    f.chTick = .99; healerTick(f);
    const tick = priestSounds(f);
    expect(f.events.some(e => e.type === 'heal')).toBe(true);
    expect(tick.cues).toEqual([]);
    expect(tick.handlesHealing).toBe(true);
    expect(tick.allowCrit).toBe(false);
  });

  it('빛의 전이는 시전과 이동을 구분하고 공통 링크음을 겹치지 않는다', () => {
    const f = fight(), u = f.party.find(u => !u.me)!;
    use(f, 'relay', u.cell);
    const cast = priestSounds(f);
    expect(cast.cues.map(c => c.name)).toEqual(['priest-relay']);
    expect(combatSounds(f, cast.combatEvents).map(c => c.name)).not.toContain('magic-link');
    f.events.length = 0; f.used = [];
    u.hp = u.max*.8;
    damage(f, u, 10);
    const hop = priestSounds(f);
    expect(hop.cues.map(c => c.name)).toEqual(['priest-relay-hop']);
    expect(combatSounds(f, hop.combatEvents).map(c => c.name)).not.toContain('magic-link');
  });

  it.each(['miracle', 'shelter', 'zenith', 'scatter'] as const)('%s 버튼 특성은 전용 발동음 하나를 낸다', key => {
    const talents = TALENTS.map(t => { const i = t.picks.findIndex(p => p.key === key); return i < 0 ? null : i; });
    const f = create({ encounter: 'warden', diff: '쉬움', seed: 7, level: 100, hero: 'priest', talents });
    f.events.length = 0;
    const cell = f.cells.findIndex(c => !c.unit);
    expect(useTalent(f, key, cell).ok).toBe(true);
    const plan = priestSounds(f);
    expect(plan.cues.map(c => c.name)).toEqual([`priest-${key}`]);
    expect(plan.suppress.has('chime')).toBe(true);
    if (key === 'miracle') expect(plan.suppress.has('gauge')).toBe(true);
  });

  it('수호 영혼의 생명 구출은 보호 시전과 다른 소리를 낸다', () => {
    const f = fight(), u = f.party.find(u => !u.me)!;
    u.guardian = 10; u.hp = 1;
    damage(f, u, u.max*10);
    expect(u.alive).toBe(true);
    expect(u.hp).toBeCloseTo(u.max*.4);
    expect(f.events).toContainEqual({ type: 'sound', name: 'priest-rescue' });
  });

  it('다른 직업과 지속 회복은 전용음을 추가하지 않는다', () => {
    const f = fight();
    f.events.push({ type: 'tick', id: f.me.id, amt: 5, eff: 5, crit: true });
    expect(priestSounds(f).cues).toEqual([]);
    f.hero = 'druid'; f.used = [{ key: 'heal', uid: f.me.id }];
    expect(priestSounds(f)).toMatchObject({ cues: [], handlesHealing: false });
  });
});
