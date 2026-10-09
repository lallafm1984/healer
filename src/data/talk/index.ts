/**
 * 파티원 대사 모음 (41 문서). 상황 하나에 성격·직업·역할·공통 대사를 모아 두고, 누가 말하느냐에 따라 고른다.
 * 언제 누가 말하는지는 battle/talk.ts.
 */
import type { Role } from '../../engine/types';
import type { ClassKey } from '../classes';
import type { PersName } from '../personalities';
import { CLASS_LINES } from './classes';
import { COMMON_LINES } from './common';
import { LINES as attention } from './pers/attention';
import { LINES as bluff } from './pers/bluff';
import { LINES as careful } from './pers/careful';
import { LINES as clumsy } from './pers/clumsy';
import { LINES as coward } from './pers/coward';
import { LINES as grateful } from './pers/grateful';
import { LINES as greedy } from './pers/greedy';
import { LINES as loner } from './pers/loner';
import { LINES as social } from './pers/social';
import { LINES as stubborn } from './pers/stubborn';
import { ROLE_LINES } from './roles';
import type { TalkLines, TalkSit } from './sits';

export { SITS, SIT_KEYS, type BarkSit, type SitDef, type TalkLines, type TalkSit } from './sits';
export { CLASS_LINES, COMMON_LINES, ROLE_LINES };

export const PERS_LINES: Record<PersName, TalkLines> = {
  '신중파': careful, '딜 욕심쟁이': greedy, '고집불통': stubborn, '덜렁이': clumsy, '허세꾼': bluff,
  '외톨이': loner, '사교형': social, '관심종자': attention, '감사형': grateful, '겁쟁이': coward,
};

export interface Speaker { pers: PersName | null; cls: ClassKey | null; role: Role }

/** 대사 출처별 비중: 성격이 말투의 중심, 직업·역할은 가끔 섞임 */
const W = { pers: 0.65, cls: 0.2, role: 0.15 };
/** 탱커가 말하는 버스터·쫄은 탱커 1인칭 대사를 더 자주 */
const TANK_SITS: TalkSit[] = ['buster', 'busterOk', 'adds'];

/** 이 사람이 이 상황에서 쓸 대사 묶음과 비중. 성격·직업·역할 대사가 하나도 없으면 공통 대사 */
export function talkSources(sit: TalkSit, s: Speaker): { lines: readonly string[]; w: number }[] {
  const out: { lines: readonly string[]; w: number }[] = [];
  const add = (lines: readonly string[] | undefined, w: number) => { if (lines?.length) out.push({ lines, w }); };
  add(s.pers ? PERS_LINES[s.pers][sit] : undefined, W.pers);
  add(s.cls ? CLASS_LINES[s.cls][sit] : undefined, W.cls);
  if (s.role !== 'healer') add(ROLE_LINES[s.role][sit], s.role === 'tank' && TANK_SITS.includes(sit) ? 0.5 : W.role);
  if (!out.length) add(COMMON_LINES[sit], 1);
  return out;
}

/** 이 사람에게 이 상황 대사가 있는지 (성격·직업·역할 중 하나라도) */
export const hasOwnLines = (sit: TalkSit, s: Speaker): boolean =>
  !!((s.pers && PERS_LINES[s.pers][sit]?.length) || (s.cls && CLASS_LINES[s.cls][sit]?.length) || (s.role !== 'healer' && ROLE_LINES[s.role][sit]?.length));

/**
 * 대사 하나 고르기. ok = 쓸 수 있는 대사인지 (자리표시를 채울 수 없으면 false), used = 이번 전투에 이미 나온 대사 (되도록 피함).
 * 출처를 비중대로 고른 뒤 그 안에서 고름. 다 나왔으면 나온 것도 다시 씀
 */
export function pickLine(sit: TalkSit, s: Speaker, rand: () => number, used: Set<string>, ok: (t: string) => boolean = () => true): string | null {
  let src = talkSources(sit, s).map(x => ({ w: x.w, lines: x.lines.filter(ok) })).filter(x => x.lines.length);
  // 자리표시를 못 채워 쓸 대사가 없으면 공통 대사로
  if (!src.length) src = [{ w: 1, lines: (COMMON_LINES[sit] ?? []).filter(ok) }].filter(x => x.lines.length);
  if (!src.length) return null;
  const fresh = src.map(x => ({ w: x.w, lines: x.lines.filter(t => !used.has(t)) })).filter(x => x.lines.length);
  const pool = fresh.length ? fresh : src;
  let r = rand() * pool.reduce((a, x) => a + x.w, 0);
  let pick = pool[pool.length - 1];
  for (const x of pool) { r -= x.w; if (r <= 0) { pick = x; break; } }
  return pick.lines[Math.floor(rand() * pick.lines.length)] ?? null;
}

/** 대사 수 (문서·테스트용) */
export function lineCount(): { pers: number; cls: number; role: number; common: number; total: number } {
  const n = (l: TalkLines) => Object.values(l).reduce((a, x) => a + (x?.length ?? 0), 0);
  const pers = Object.values(PERS_LINES).reduce((a, l) => a + n(l), 0);
  const cls = Object.values(CLASS_LINES).reduce((a, l) => a + n(l), 0);
  const role = Object.values(ROLE_LINES).reduce((a, l) => a + n(l), 0);
  const common = n(COMMON_LINES);
  return { pers, cls, role, common, total: pers + cls + role + common };
}
