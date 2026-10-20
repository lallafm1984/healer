/**
 * 결과 화면 「다음 탐험 · 던전 · 레이드」 (2026-10-13 Lim): 이긴 판 뒤에 갈 곳 하나.
 * 탐험 · 던전은 모험 길잡이 (86, game/guide)의 추천 가운데 방금 깬 칸이 아닌 첫 곳 (분류와 상관없이: 탐험 ↔ 던전을 오감).
 *   순차 레벨링 구간 (Lv 20까지)은 70 · 90의 길 그대로 (장소 Lv 1~9 같은 장소 보통 → 다음 장소 쉬움, 10~20 쉬움 → 보통 → 어려움 → 다음 장소).
 * 레이드 (파밍)는 같은 분류의 다음 장소를 지금 난이도로 (안 열렸으면 가장 낮은 열린 난이도) → 없으면 같은 장소 다음 난이도.
 * 악몽은 「다음」으로 고르지 않음 (2026-10-20 Lim 「게임 가이드에서 악몽 난이도는 추천을 안하는 방식으로」): 악몽 판 뒤면 다음 장소는 어려움까지에서, 같은 장소 다음 난이도도 악몽이면 없음.
 * 갈 곳이 없으면 null (버튼 없음)
 */
import { adventureContents, adventureTabOf } from '../data/adventure-regions';
import { ALL_DIFFS, contentOf, isLeveling, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { guideCtx, rankStages } from './guide';
import { G, lockOf } from './state';

export interface NextRun { content: ContentKey; diff: DiffName; }

const open = (c: ContentDef, d: DiffName) => c.ready && !c.hidden && !lockOf(c).locked && !lockOf(c, d).locked;
const cleared = (c: ContentDef, d: DiffName) => !!G.save.clears[c.key]?.[d];

/** 이 장소에서 갈 난이도 (악몽 빼고): 아직 안 깬 가장 낮은 열린 난이도 → 지금 난이도 → 가장 높은 열린 난이도 */
function diffAt(c: ContentDef, now: DiffName): DiffName | null {
  const ds = ALL_DIFFS.filter(d => d !== '악몽' && open(c, d));
  if (!ds.length) return null;
  const cap: DiffName = now === '악몽' ? '어려움' : now; // 악몽 판 뒤면 어려움까지
  if (!isLeveling(c)) return ds.includes(cap) ? cap : ds[0];
  return ds.find(d => !cleared(c, d)) ?? (ds.includes(cap) ? cap : ds[ds.length - 1]);
}

export function nextRun(key: ContentKey, now: DiffName): NextRun | null {
  const c = contentOf(key);
  if (c.hidden) return null;
  const lvl = isLeveling(c), i = ALL_DIFFS.indexOf(now), up = ALL_DIFFS[i + 1];
  if (lvl) {
    const g = rankStages(guideCtx()).find(x => x.content !== key || x.diff !== now);
    if (g) return g;
  }
  if (lvl && now === '쉬움' && open(c, '보통') && !cleared(c, '보통')) return { content: key, diff: '보통' };
  const list = adventureContents(adventureTabOf(c)), at = list.findIndex(x => x.key === key);
  for (const n of list.slice(at + 1)) {
    if (!n.ready || lockOf(n).locked) continue;
    const d = diffAt(n, now);
    if (d) return { content: n.key, diff: d };
  }
  return up && up !== '악몽' && open(c, up) ? { content: key, diff: up } : null;
}
