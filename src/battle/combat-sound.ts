/** Extra audible combat feedback. The engine stays deterministic; mixing belongs to the view. */
import { ABILITIES } from '../data/abilities';
import { SPECS } from '../data/specials';
import type { Fight, FightEvent, FxName, Telegraph, TelKind } from '../engine/types';
import { hasSfx } from '../sfx';
import { ABILITY_SOUND_OF, BOSS_CAST_OWN, BOSS_CAST_SOUND, BOSS_SKILL_OWN, BOSS_SKILL_SOUND } from './boss-themes';

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

/** 예고 없이 바로 쓰는 보스 기술 (bossCast): 주요 보스는 그 기술 전용 (bc-…), 그 밖은 특성 시전 소리 (boss-<특성>-cast), 없으면 공통 */
export function castSound(script: string, key: string): string {
  const id = `${script}:${key}`;
  for (const name of [BOSS_CAST_OWN[id], BOSS_CAST_SOUND[id]]) if (name && hasSfx(name)) return name;
  return 'boss-cast';
}
/** 장비 특수능력 (spec 사건은 이름만): 묶음마다 소리, 직업 전용 묶음은 그 직업 소리 */
const SPEC_BY_NAME = new Map(Object.values(SPECS).map(s => [s.name, s]));
export function specSound(name: string, hero: string): string {
  const s = SPEC_BY_NAME.get(name);
  const n = !s ? '' : s.group === 'hero' ? `spec-${s.hero ?? hero}` : `spec-${s.group}`;
  return n && hasSfx(n) ? n : 'proc';
}

/** 공통 착탄 소리 (특성 소리가 없을 때) */
const IMPACT: Partial<Record<TelKind, string>> = { buster: 'boss-impact', aoe: 'boss-wave', zone: 'boss-zone' };
/**
 * 보스 기술이 떨어질 때 소리 (2026-10-21 Lim 「보스별로 스킬의 특성을 이용하여 개별적으로 효과음」 → 3번 「특성별 + 주요 보스는 기술마다」):
 * 주요 보스 (레이드 · 던전 마지막 보스)는 그 기술만의 소리 (bs-<대본>-<기술>), 그 밖은 기술 특성 소리 (예: 불 광역 boss-fire-wave), 둘 다 없으면 공통 착탄
 */
export function impactSound(script: string, tl: Pick<Telegraph, 'kind' | 'skill'>): string | undefined {
  const id = `${script}:${tl.skill.key}`;
  for (const name of [BOSS_SKILL_OWN[id], BOSS_SKILL_SOUND[id]]) if (name && hasSfx(name)) return name;
  return tl.kind && IMPACT[tl.kind];
}
/** 이 보스의 기술 착탄 소리 (기술마다 impactSound가 고를 것, 전투를 시작할 때 이것만 미리 풂, sfx preloadSfx) */
export const bossSoundsFor = (script: string): string[] => [...new Set(
  Object.keys(BOSS_SKILL_SOUND).filter(id => id.startsWith(`${script}:`)).map(id => BOSS_SKILL_OWN[id] ?? BOSS_SKILL_SOUND[id]))];

/** Collapse an entire simulation frame to one cue per sound, including 20-person AoEs. */
/** impact = 이번에 떨어진 예고의 소리 (같은 종류 impact 사건 순서대로, battle/index.ts). 없으면 공통 착탄 */
export function combatSounds(f: Fight, events: readonly FightEvent[], options: { partyAttacks?: boolean; impact?: (kind: TelKind | undefined) => string | undefined } = {}): CombatCue[] {
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
      case 'impact': add(options.impact?.(e.kind) ?? (e.kind === 'buster' ? 'boss-impact' : e.kind === 'zone' ? 'boss-zone' : 'boss-wave')); break;
      case 'ability': {
        if (e.fumble) { add('status-stagger', 0.4); break; }
        const u = f.party.find(u => u.id === e.id);
        const own = u?.ab && ABILITY_SOUND_OF[u.ab.key]; // 파티원 능력마다 소리 (2026-10-22), 없으면 종류 소리
        const kind = u?.ab && ABILITIES[u.ab.key]?.kind;
        if (own && hasSfx(own)) add(own, 0.8);
        else if (kind) add(ABILITY_SOUND[kind], 0.7);
        break;
      }
      case 'daze': case 'offGuard': case 'stagger': add('status-stagger', 0.4); break;
      case 'regroup': add('ally-support', 0.4); break;
      case 'clump': add('ally-clump', 0.5); break; // 붙어 섬 (99 위치 잡기)
      case 'alone': add('ally-alone', 0.5); break; // 혼자 놂 (99 협동)
      case 'aggro': add('boss-aggro', 0.8); break; // 보스가 노리는 사람이 바뀜 (96)
      case 'shake': add('deny', 0.6); break; // 뒤집힌 축복 칸 첫 탭 거절
      case 'bossCast': add(castSound(f.enc.script, e.key)); break;
      case 'spec': add(specSound(e.name, f.hero), 0.8); break;
      case 'fx':
        if (e.name !== 'warn' || !['buster', 'aoe', 'zone'].some(n => existing.has(n))) add(FX_SOUND[e.name], 0.7);
        break;
      // Passive tick healing and social/position notices deliberately stay quiet.
    }
  }
  return [...cues.values()];
}
