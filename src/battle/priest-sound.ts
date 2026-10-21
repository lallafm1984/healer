/** Priest spell voices. Read completion records before the visual layer consumes them. */
import type { SkillKey } from '../data/skills';
import type { TalentKey } from '../data/talents';
import type { Fight, FightEvent } from '../engine/types';
import type { CombatCue } from './combat-sound';

export const PRIEST_SKILL_SOUNDS: Partial<Record<SkillKey, string>> = {
  heal: 'heal-priest', flash: 'priest-flash', renew: 'renew-priest', poh: 'priest-prayer',
  purify: 'priest-purify', guardian: 'priest-guardian', hymn: 'hymn-priest',
  serenity: 'priest-serenity', relay: 'priest-relay',
};
export const PRIEST_TALENT_SOUNDS: Partial<Record<TalentKey, string>> = {
  miracle: 'priest-miracle', shelter: 'priest-shelter', zenith: 'priest-zenith', scatter: 'priest-scatter',
};
export const PRIEST_FEEDBACK_SOUNDS: Record<string, string> = {
  gauge: 'priest-ready', crit: 'priest-crit',
};
const RELAY_FX = new Set(['relay-land', 'relay-fly', 'relay-gone']);

export function priestSounds(f: Fight) {
  const cues = new Map<string, CombatCue>(), suppress = new Set<string>();
  let handlesHealing = false, allowCrit = false;
  if (f.hero !== 'priest') return { cues: [], suppress, handlesHealing, allowCrit, combatEvents: f.events };
  const explicit = new Set(f.events.flatMap(e => e.type === 'sound' ? [e.name] : []));
  const add = (name: string, vol = 1) => cues.set(name, { name, vol });
  for (const { key } of f.used ?? []) {
    const name = PRIEST_SKILL_SOUNDS[key];
    if (!name) continue;
    handlesHealing = true;
    if (key !== 'hymn') allowCrit = true;
    // Hymn's visual record (the note burst) repeats on each healing tick. Every note gets the hymn voice
    // (2026-10-21 Lim 「찬가 음표 이펙트가 뜰 때마다 찬가 효과음도」); the ticks are a little softer than the opening.
    if (key === 'hymn') { add(name, explicit.has('hymn') ? 1 : .85); suppress.add('hymn'); continue; }
    if (key === 'relay' && !explicit.has('renew')) add('priest-relay-hop', .65);
    else add(name);
    if (key === 'renew' || key === 'guardian' || key === 'relay') suppress.add('renew');
    if (key === 'serenity') { suppress.add('chime'); suppress.add('dispel'); }
    if (key === 'purify') suppress.add('dispel');
  }
  for (const event of f.events) {
    if (event.type === 'talent' && PRIEST_TALENT_SOUNDS[event.key]) {
      add(PRIEST_TALENT_SOUNDS[event.key]!);
      suppress.add('chime');
      if (event.key === 'miracle') suppress.add('gauge');
    }
    if (event.type === 'fx' && RELAY_FX.has(event.name) && !cues.has('priest-relay') && !cues.has('priest-relay-hop')) {
      add('priest-relay-hop', event.name === 'relay-gone' ? .35 : .65);
    }
  }
  // The same relay visual must not also emit the generic plucked magic-link cue.
  const combatEvents = f.events.filter((e: FightEvent) => e.type !== 'fx' || !RELAY_FX.has(e.name));
  return { cues: [...cues.values()], suppress, handlesHealing, allowCrit, combatEvents };
}
