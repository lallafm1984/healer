/**
 * 결과 화면 「다음 탐험 · 던전 · 레이드」 (2026-10-13 Lim): 이긴 판 뒤에 갈 곳 하나.
 * 탐험 · 던전은 초반 순차 레벨링 (기획 70: 쉬움 · 보통 첫 클리어 = 다음 장소 레벨)과 같은 길로
 *   쉬움을 깼는데 보통을 아직 안 깼으면 같은 장소 보통 → 아니면 같은 분류의 다음 장소 (레벨 순, 들어갈 수 있는 곳).
 *   다음 장소는 아직 안 깬 가장 낮은 열린 난이도, 다 깼으면 지금 난이도 (열렸으면).
 *   다음 장소가 아직 레벨로 잠겼으면 같은 장소의 다음 난이도 (열렸을 때).
 * 레이드 (파밍)는 같은 분류의 다음 장소를 지금 난이도로 (안 열렸으면 가장 낮은 열린 난이도) → 없으면 같은 장소 다음 난이도.
 * 갈 곳이 없으면 null (버튼 없음)
 */
import { adventureContents, adventureTabOf } from '../data/adventure-regions';
import { ALL_DIFFS, contentOf, isLeveling, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { G, lockOf } from './state';

export interface NextRun { content: ContentKey; diff: DiffName; }

const open = (c: ContentDef, d: DiffName) => c.ready && !c.hidden && !lockOf(c).locked && !lockOf(c, d).locked;
const cleared = (c: ContentDef, d: DiffName) => !!G.save.clears[c.key]?.[d];

/** 이 장소에서 갈 난이도: 아직 안 깬 가장 낮은 열린 난이도 → 지금 난이도 → 가장 높은 열린 난이도 */
function diffAt(c: ContentDef, now: DiffName): DiffName | null {
  const ds = ALL_DIFFS.filter(d => open(c, d));
  if (!ds.length) return null;
  if (!isLeveling(c)) return ds.includes(now) ? now : ds[0];
  return ds.find(d => !cleared(c, d)) ?? (ds.includes(now) ? now : ds[ds.length - 1]);
}

export function nextRun(key: ContentKey, now: DiffName): NextRun | null {
  const c = contentOf(key);
  if (c.hidden) return null;
  const lvl = isLeveling(c), i = ALL_DIFFS.indexOf(now), up = ALL_DIFFS[i + 1];
  if (lvl && now === '쉬움' && open(c, '보통') && !cleared(c, '보통')) return { content: key, diff: '보통' };
  const list = adventureContents(adventureTabOf(c)), at = list.findIndex(x => x.key === key);
  for (const n of list.slice(at + 1)) {
    if (!n.ready || lockOf(n).locked) continue;
    const d = diffAt(n, now);
    if (d) return { content: n.key, diff: d };
  }
  return up && open(c, up) ? { content: key, diff: up } : null;
}
