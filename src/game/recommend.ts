/**
 * 추천 편성 (93 7-1): 자리 수 안에서 점수가 높은 길드원. 점수 = 능력 ★ (FM) + 이 전투 공략 숙지 + 보스 특징에 맞는 직업 스킬 + 스킬 ★ − 레벨 모자람 − 다루기 어려운 성격 (버릇을 고친 만큼 덜).
 * 보스 특징은 시험 전투 하나 (engine create)의 기술 종류 · 끊기 · 적 · 해제 디버프에서 읽음 (전투마다 한 번, 캐시).
 */
import { ABILITIES, type AbilityDef } from '../data/abilities';
import { CLASSES } from '../data/classes';
import { ENCOUNTERS, type Encounter, type EncounterKey } from '../data/encounters';
import { abilityStars } from '../data/fm';
import { habitOf, starOfBond, type GuildMember } from '../data/guild';
import { PERS } from '../data/personalities';
import { create } from '../engine';
import { topLevel, type SaveData } from '../platform/storage';
import { bondOf, knowStages, slotsOf } from './guild';

export type Feature = 'buster' | 'adds' | 'cut' | 'zone' | 'aoe' | 'poison';
/** 칩 글 (「독 · 질병 → 독소 정화」) */
export const FEATURE_NAME: Record<Feature, string> = { buster: '강타', adds: '쫄', cut: '끊을 기술', zone: '장판', aoe: '광역', poison: '독 · 질병' };

const cache = new Map<string, Set<Feature>>();
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
export const REC = { know: 0.8, knowSeg: 0.2, fit: 1.2, star: 0.15, lvGap: 0.25, lvGapMax: 3, hard3: 1.2, hard2: 0.4 };

export interface RecScore { id: number; score: number; fits: Feature[]; know: number }
/** 길드원 하나의 점수. encs = 이 콘텐츠의 전투 (마지막 = 보스), stage = 장소 레벨 */
export function recScore(save: SaveData, m: GuildMember, encs: readonly EncounterKey[], stage: number): RecScore {
  const role = CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged';
  const feats = new Set(encs.flatMap(k => [...encFeatures(k)]));
  const a = ABILITIES[m.ab], fits = a ? abilityFeatures(a).filter(x => feats.has(x)) : [];
  const kn = knowStages(m, save), boss = encs[encs.length - 1], kb = boss ? kn[boss] ?? 0 : 0;
  const ks = encs.slice(0, -1).reduce((t, k) => t + (kn[k] ?? 0), 0) / Math.max(1, encs.length - 1);
  const star = starOfBond(bondOf(save, m.nick)), p = PERS[m.pers];
  // 버릇 (침착 · 판단)을 고친 만큼 성격 감점이 줄어듦: 버릇 1.2 → 다 · 1/3 → 0
  const hard = Math.max(0, Math.min(1, (habitOf(m.stats) - 1 / 3) / (1.2 - 1 / 3)));
  const score = abilityStars(m.stats, role) + REC.know * kb + REC.knowSeg * ks + (fits.length ? REC.fit : 0) + REC.star * star
    - REC.lvGap * Math.min(REC.lvGapMax / REC.lvGap, Math.max(0, Math.min(stage, topLevel(save)) - m.lv))
    - (p.star >= 3 ? REC.hard3 : p.star === 2 ? REC.hard2 : 0) * hard;
  return { id: m.id, score, fits, know: kb };
}

/** 추천 편성: 탱커 자리 · 딜러 자리를 점수 순으로 채움. why = 고른 이유 칩 (보스 특징 → 직업 스킬, 공략 숙지) 3개까지 */
export function recommendPick(save: SaveData, enc: Encounter, encs: readonly EncounterKey[], stage: number): { pick: number[]; why: string[] } {
  const sl = slotsOf(enc), ms = save.guild.members;
  const scored = ms.map(m => ({ m, s: recScore(save, m, encs, stage) })).sort((a, b) => b.s.score - a.s.score || b.m.lv - a.m.lv);
  const tanks = scored.filter(x => CLASSES[x.m.cls].role === 'tank').slice(0, sl.tank);
  const dps = scored.filter(x => CLASSES[x.m.cls].role !== 'tank').slice(0, sl.dps);
  const picked = [...tanks, ...dps];
  const why: string[] = [];
  const boss = encs[encs.length - 1];
  for (const x of picked.slice().sort((a, b) => b.s.know - a.s.know)) {
    if (x.s.know > 0 && boss && why.length < 1) why.push(`공략 숙지 ${x.s.know}단계 · ${x.m.nick}`);
  }
  const seen = new Set<Feature>();
  for (const x of picked) for (const f of x.s.fits) {
    if (seen.has(f) || why.length >= 3) continue;
    seen.add(f);
    why.push(`${FEATURE_NAME[f]} → ${ABILITIES[x.m.ab].name}`);
  }
  return { pick: picked.map(x => x.m.id), why };
}
