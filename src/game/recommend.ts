/**
 * 추천 편성 (93 7-1): 자리 수 안에서 점수가 높은 길드원. 점수 = 능력 ★ (FM) + 보스 특징에 맞는 직업 스킬 + 스킬 ★ − 레벨 모자람 − 다루기 어려운 성격 (버릇을 고친 만큼 덜).
 * 보스 특징은 시험 전투 하나 (engine create)의 기술 종류 · 끊기 · 적 · 해제 디버프에서 읽음 (전투마다 한 번, 캐시).
 */
import { ABILITIES, type AbilityDef } from '../data/abilities';
import { BOSSES } from '../data/bosses';
import { CLASSES } from '../data/classes';
import { ENCOUNTERS, type Encounter, type EncounterKey } from '../data/encounters';
import { abilityStars } from '../data/fm';
import { habitOf, memberSkillLevel, type GuildMember } from '../data/guild';
import { PERS } from '../data/personalities';
import { create } from '../engine';
import { topLevel, type SaveData } from '../platform/storage';
import { shapePick } from './guild';

export type Feature = 'buster' | 'adds' | 'cut' | 'zone' | 'aoe' | 'poison';
/** 칩 글 (「독 · 질병 → 독소 정화」) */
export const FEATURE_NAME: Record<Feature, string> = { buster: '강타', adds: '쫄', cut: '끊을 기술', zone: '장판', aoe: '광역', poison: '독 · 질병' };

const cache = new Map<string, Set<Feature>>();
/** 보스 전투에 쫄 (P-ADD: 쫄 · 감옥)이 나오는 전투. 쫄 피해 능력 (소용돌이 · 칼날폭풍 …)은 일반 · 정예 구간 적 · 몸통을 안 쳐서 이 전투에만 맞음 */
const addsCache = new Map<string, boolean>();
function hasAdds(key: EncounterKey): boolean {
  let v = addsCache.get(key);
  if (v == null) {
    const e = ENCOUNTERS[key];
    v = e.script !== 'trash' && /"p":"(adds|jail)"/.test(JSON.stringify(BOSSES[e.script] ?? {}));
    addsCache.set(key, v);
  }
  return v;
}
/** 그 전투에 있는 것 (보스 기술 종류 · 끊기 ✋ · 판 위 적 · 독 · 질병) */
export function encFeatures(key: EncounterKey): Set<Feature> {
  let s = cache.get(key);
  if (s) return s;
  s = new Set<Feature>();
  const e = ENCOUNTERS[key];
  const f = create({ encounter: key, diff: '보통', seed: 1, stageLv: 30 });
  for (const k of f.skills) {
    if (k.kind === 'buster') s.add('buster');
    if (k.kind === 'aoe') s.add('aoe');
    if (k.kind === 'zone') s.add('zone');
    if (k.cut) s.add('cut');
    if (k.mob != null || /adds|heads|summon/.test(k.key)) s.add('adds');
  }
  if (e.mobs || f.mobs.length) s.add('adds');
  if (e.debuffs?.some(d => d === '독' || d === '질병')) s.add('poison');
  cache.set(key, s);
  return s;
}

/** 이 직업 스킬이 맞서는 특징 (쓰는 때 · 효과) */
export function abilityFeatures(a: AbilityDef): Feature[] {
  const out = new Set<Feature>();
  for (const t of a.trig) {
    if (t.t === 'buster' || t.t === 'targeted' || t.t === 'lethal') out.add('buster');
    else if (t.t === 'addsHit' || t.t === 'adds') out.add('adds');
    else if (t.t === 'cast' || t.t === 'castAny') out.add('cut');
    else if (t.t === 'zone' || t.t === 'zoneAny' || t.t === 'zone3' || t.t === 'zoneNear' || t.t === 'moved') out.add('zone');
    else if (t.t === 'aoe') out.add('aoe');
  }
  if (a.fx.e === 'cleanse') out.add('poison');
  return [...out];
}

/** 점수 무게 (93 7-1) */
export const REC = { fit: 1.2, star: 0.15, lvGap: 0.25, lvGapMax: 3, hard3: 1.2, hard2: 0.4 };

export interface RecScore { id: number; score: number; fits: Feature[] }
/** 길드원 하나의 점수. encs = 이 콘텐츠의 전투 (마지막 = 보스), stage = 장소 레벨 */
export function recScore(save: SaveData, m: GuildMember, encs: readonly EncounterKey[], stage: number): RecScore {
  const role = CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged';
  const feats = new Set(encs.flatMap(k => [...encFeatures(k)]));
  const a = ABILITIES[m.ab], fits = a ? abilityFeatures(a).filter(x => feats.has(x) && (x !== 'adds' || a.fx.e !== 'hitAdds' || encs.some(hasAdds))) : [];
  const star = memberSkillLevel(m), p = PERS[m.pers];
  // 버릇 (침착 · 판단)을 고친 만큼 성격 감점이 줄어듦: 버릇 1.2 → 다 · 1/3 → 0
  const hard = Math.max(0, Math.min(1, (habitOf(m.stats) - 1 / 3) / (1.2 - 1 / 3)));
  const score = abilityStars(m.stats, role, m.lv) + (fits.length ? REC.fit : 0) + REC.star * star
    - REC.lvGap * Math.min(REC.lvGapMax / REC.lvGap, Math.max(0, Math.min(stage, topLevel(save)) - m.lv))
    - (p.star >= 3 ? REC.hard3 : p.star === 2 ? REC.hard2 : 0) * hard;
  return { id: m.id, score, fits };
}

/** 추천 편성: 탱커 자리 · 딜러 자리를 점수 순으로 채우고, 남은 자리는 남은 길드원 점수 순 (빈 칸보다 나음). why = 고른 이유 칩 (보스 특징 → 직업 스킬) 3개까지 */
export function recommendPick(save: SaveData, enc: Encounter, encs: readonly EncounterKey[], stage: number): { pick: number[]; why: string[] } {
  const ms = save.guild.members;
  const scored = ms.map(m => ({ m, s: recScore(save, m, encs, stage) })).sort((a, b) => b.s.score - a.s.score || b.m.lv - a.m.lv);
  const shaped = shapePick(scored, x => CLASSES[x.m.cls].role === 'tank', enc);
  const picked = [...shaped.filter(x => CLASSES[x.m.cls].role === 'tank'), ...shaped.filter(x => CLASSES[x.m.cls].role !== 'tank')];
  const why: string[] = [];
  const seen = new Set<Feature>();
  for (const x of picked) for (const f of x.s.fits) {
    if (seen.has(f) || why.length >= 3) continue;
    seen.add(f);
    why.push(`${FEATURE_NAME[f]} → ${ABILITIES[x.m.ab].name}`);
  }
  return { pick: picked.map(x => x.m.id), why };
}
