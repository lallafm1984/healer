/**
 * 6직업 기술 소리 (2026-10-22 Lim 「사제 말고 6직업은 사제를 베이스로 참고해서 직업군 사운드를 모두 만들자」).
 * 사제 (priest-sound.ts)처럼 스킬이 실제로 들어간 기록 (Fight.used)마다 그 직업 · 그 스킬 소리를 내고, 같은 사건에 엔진이 낸 공통 소리
 * (renew · hymn · chime · dispel)와 공통 치유음은 대신함. 한 화면에 같은 스킬이 여럿 (연쇄 · 광역 대상마다)이면 한 번.
 * 소리 문장 · 파일 이름 · 재사용 시간 단계는 scripts/sfx/class.mjs (heal · renew · hymn-<직업>도 여기, sounds.mjs가 가져다 씀)
 */
import type { HeroKey } from '../data/heroes';
import type { SkillKey } from '../data/skills';
import type { TalentKey } from '../data/talents';
import type { Fight } from '../engine/types';
import type { CombatCue } from './combat-sound';
import { CLASS_SKILL_SOUNDS, CLASS_TALENT_SOUNDS } from './class-sound-table';

export { CLASS_SKILL_SOUNDS, CLASS_TALENT_SOUNDS };

/** 직업 기술 소리가 대신하는 엔진 공통 소리 */
const REPLACED = ['renew', 'hymn', 'chime', 'dispel'];

export function classSounds(f: Fight) {
  const cues = new Map<string, CombatCue>(), suppress = new Set<string>();
  let handlesHealing = false;
  const skills = CLASS_SKILL_SOUNDS[f.hero as HeroKey], talents = CLASS_TALENT_SOUNDS[f.hero as HeroKey];
  for (const { key } of f.used ?? []) {
    const name = skills?.[key as SkillKey];
    if (!name) continue;
    handlesHealing = true;
    cues.set(name, { name, vol: 1 });
    for (const s of REPLACED) suppress.add(s);
  }
  for (const e of f.events) {
    const name = e.type === 'talent' ? talents?.[e.key as TalentKey] : undefined;
    if (!name) continue;
    cues.set(name, { name, vol: 1 });
    suppress.add('chime');
  }
  return { cues: [...cues.values()], suppress, handlesHealing, allowCrit: true, combatEvents: f.events };
}
