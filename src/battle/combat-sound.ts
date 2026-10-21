/** Extra audible combat feedback. The engine stays deterministic; mixing belongs to the view. */
import { ABILITIES } from '../data/abilities';
import type { Fight, FightEvent, FxName } from '../engine/types';

export const FX_SOUND: Record<FxName, string> = {
  spawn: 'magic-grow', explode: 'burst', slam: 'boss-impact', warn: 'zone', shockwave: 'boss-wave',
  crumble: 'stone-break', dizzy: 'status-stagger', 'chain-break': 'stone-break', 'soul-purify': 'dispel',
  splash: 'magic-water', 'link-snap': 'magic-link', bubble: 'magic-water', overflow: 'magic-water',
  'fireball-green': 'magic-fire', hearts: 'ally-heal', hook: 'magic-link', rage: 'boss-enrage',
  recoil: 'parry', soak: 'magic-water', swap: 'magic-shift', slow: 'magic-dark', absorb: 'shield',
  cheer: 'ally-support', 'swell-pop': 'burst', 'ink-splat': 'magic-water', 'coin-flip': 'proc',
  'ring-grow': 'magic-grow', 'spore-pass': 'magic-grow', bounce: 'magic-link',
  'hat-drop': 'status-stagger', dance: 'magic-wind', 'bee-sting': 'attack-magic', 'tree-wake': 'magic-grow',
  'greed-coin': 'proc', 'melt-heat': 'magic-fire', 'egg-hatch': 'stone-break',
  'dragon-breath': 'magic-fire', 'door-open': 'stone-break', 'mirage-shimmer': 'magic-shift',
  'hourglass-flip': 'magic-shift', 'sand-rewind': 'magic-shift', sandstorm: 'magic-wind',
  yawn: 'status-stagger', heartbeat: 'heart', 'lift-swirl': 'magic-wind', 'land-puff': 'ally-hurt',
  'chain-strike': 'magic-lightning', 'chain-bolt': 'magic-lightning', 'chain-rod': 'magic-lightning',
  'island-tilt': 'stone-break', 'tide-rise': 'magic-water', 'tide-ebb': 'magic-water',
  'debt-lend': 'magic-dark', 'debt-pay': 'proc', 'debt-collect': 'magic-dark',
  'tide-island': 'magic-water', 'tide-drag': 'magic-water', 'pulse-ring': 'boss-wave',
  wedge: 'magic-lightning', 'relay-land': 'magic-link', 'relay-fly': 'magic-link', 'relay-gone': 'magic-link',
};
const ABILITY_SOUND = { def: 'shield', heal: 'ally-heal', sup: 'ally-support', ctl: 'ally-control', atk: 'attack-heavy' };
export interface CombatCue { name: string; vol: number }

/** Collapse an entire simulation frame to one cue per sound, including 20-person AoEs. */
export function combatSounds(f: Fight, events: readonly FightEvent[], options: { partyAttacks?: boolean } = {}): CombatCue[] {
  const existing = new Set(events.flatMap(e =>
    e.type === 'sound' ? [e.name] :
    e.type === 'phase' ? [e.text === '광폭화' ? 'boss-enrage' : 'boss-phase'] :
    e.type === 'revive' ? ['revive', 'chime'] : e.type === 'mobDown' ? ['stone-break'] : []));
  const cues = new Map<string, CombatCue>();
  const add = (name: string, vol = 1) => {
    if (!existing.has(name)) cues.set(name, { name, vol: Math.max(cues.get(name)?.vol ?? 0, vol) });
  };
  for (const e of events) {
    switch (e.type) {
      case 'hit': {
        if (options.partyAttacks === false) break; // The battle view already plays class-specific attacks.
        const u = f.party.find(u => u.id === e.uid);
        if (!u || e.amt <= 0) break;
        add(u.cls === 'mage' ? 'attack-magic' :
          u.cls === 'archer' || u.cls === 'hunter' ? 'attack-bow' :
          u.cls === 'berserker' || u.role === 'tank' ? 'attack-heavy' : 'attack-melee', e.crit ? 0.8 : 0.5);
        break;
      }
      case 'dmg': if (e.amt > 0) add('ally-hurt', 0.5); break;
      case 'miss': add('attack-miss', 0.4); break;
      case 'parry': add('parry', 0.7); break;
      case 'shield': if (e.amt > 0) add('shield', 0.5); break;
      case 'aheal': if (e.amt > 0) add('ally-heal', 0.5); break;
      case 'bossHeal': add('magic-dark', 0.7); break;
      case 'cure': add('dispel', 0.6); break;
      case 'dispel': add('dispel', 0.6); break;
      case 'impact': add(e.kind === 'buster' ? 'boss-impact' : e.kind === 'zone' ? 'stone-break' : 'boss-wave'); break;
      case 'ability': {
        if (e.fumble) { add('status-stagger', 0.4); break; }
        const u = f.party.find(u => u.id === e.id);
        const kind = u?.ab && ABILITIES[u.ab.key]?.kind;
        if (kind) add(ABILITY_SOUND[kind], 0.7);
        break;
      }
      case 'daze': case 'offGuard': case 'stagger': add('status-stagger', 0.4); break;
      case 'regroup': add('ally-support', 0.4); break;
      case 'fx':
        if (e.name !== 'warn' || !['buster', 'aoe', 'zone'].some(n => existing.has(n))) add(FX_SOUND[e.name], 0.7);
        break;
      // Passive tick healing and social/position notices deliberately stay quiet.
    }
  }
  return [...cues.values()];
}
