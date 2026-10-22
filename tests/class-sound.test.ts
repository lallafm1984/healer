/** 6직업 기술 소리 (2026-10-22 Lim 「사제를 베이스로 직업군 사운드를 모두」) · 바로 쓰는 보스 기술 소리 */
import { describe, expect, it } from 'vitest';
import { create, step, use } from '../src/engine';
import { HEROES, HERO_KEYS, type HeroKey } from '../src/data/heroes';
import { TALENT_DEF, TALENT_TREES } from '../src/data/talents';
import { classSounds, CLASS_SKILL_SOUNDS, CLASS_TALENT_SOUNDS } from '../src/battle/class-sound';
import { castSound } from '../src/battle/combat-sound';
import { BOSS_CAST_OWN, BOSS_CAST_SOUND } from '../src/battle/boss-themes';
import { BOSSES } from '../src/data/bosses';
import type { SkillKey } from '../src/data/skills';

const OTHERS = HERO_KEYS.filter(h => h !== 'priest') as HeroKey[];

describe('6직업 기술 · 특성 버튼 소리', () => {
  it.each(OTHERS)('%s: 휠의 기술 8개와 특성 버튼마다 서로 다른 소리 이름이 있다', hero => {
    const skills = [...new Set(Object.values(HEROES[hero].slots))] as SkillKey[];
    const names = skills.map(k => CLASS_SKILL_SOUNDS[hero]?.[k]);
    expect(names.every(Boolean), String(names)).toBe(true);
    expect(new Set(names).size).toBe(skills.length);
    const buttons = TALENT_TREES[hero].flatMap(t => t.picks.filter(p => TALENT_DEF[p.key]?.active).map(p => p.key));
    for (const k of buttons) expect(CLASS_TALENT_SOUNDS[hero]?.[k], k).toBeTruthy();
  });

  it.each(OTHERS)('%s: 기본 치유가 들어가면 그 직업 기본 소리가 나고 공통 치유음 · 엔진 공통 소리를 대신한다', hero => {
    const f = create({ encounter: 'warden', diff: '쉬움', seed: 7, level: 100, hero });
    const u = f.party.find(x => !x.me)!;
    u.hp = u.max * 0.4;
    f.events.length = 0; f.used = [];
    const key = HEROES[hero].slots.basic as SkillKey;
    expect(use(f, key, u.cell).ok).toBe(true);
    for (let i = 0; (f.cast || !f.used?.length) && i < 200; i++) step(f);
    const plan = classSounds(f);
    expect(plan.cues.map(c => c.name)).toContain(CLASS_SKILL_SOUNDS[hero]![key]);
    expect(plan.handlesHealing).toBe(true);
    expect(plan.suppress.has('renew')).toBe(true);
  });
});

describe('예고 없이 바로 쓰는 보스 기술', () => {
  it('보스가 바로 쓰는 기술을 쓰면 bossCast 사건이 나고, 주요 보스는 전용 소리 · 그 밖은 특성 소리로 고른다', () => {
    const f = create({ encounter: 'plague', diff: '보통', seed: 3, level: 100 });
    const seen = new Set<string>();
    for (let i = 0; i < 4000 && !f.over && seen.size === 0; i++) { step(f); for (const e of f.events) if (e.type === 'bossCast') seen.add(e.key); f.events.length = 0; }
    expect(seen.size).toBeGreaterThan(0);
    const key = [...seen][0], id = `${f.enc.script}:${key}`;
    expect(BOSS_CAST_OWN[id] ?? BOSS_CAST_SOUND[id]).toBeTruthy();
    expect(castSound(f.enc.script, key)).toBe(BOSS_CAST_OWN[id] ?? BOSS_CAST_SOUND[id]);
  });

  it('보이는 바로 쓰는 기술은 모두 특성 소리가 있다', () => {
    const missing = Object.entries(BOSSES).flatMap(([sc, d]) => d.skills.filter(s => (!s.kind || s.kind === 'instant') && !s.hidden && s.key !== 'auto').map(s => `${sc}:${s.key}`)).filter(id => !BOSS_CAST_SOUND[id]);
    expect(missing).toEqual([]);
  });
});
