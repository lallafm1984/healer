/**
 * 전투판 칸 테두리 · 표식 그림 이름 (2026-10-16 Lim 「원형으로 표시하던 것들은 알기 쉽게 이미지화」, 89 문서 · QA · 디자이너 검수).
 * fx-edge-* = 육각 여섯 변에 한 장씩 붙이는 가로 띠 (그림 위 = 칸 바깥쪽), fx-ring-* = 둥근 고리. 그리기는 board.ts edgeRing · roundRing
 */
import type { Unit } from '../engine';

export const DEBUFF_EDGE: Record<string, string> = { 독: 'fx-edge-poison', 마법: 'fx-edge-magic', 저주: 'fx-edge-curse', 질병: 'fx-edge-disease' };
/** 칸 위 기믹 디버프 (배지 왼쪽 작은 그림, 2026-10-16 QA: 글자가 「저주 30」뿐이라 할 일이 반대인 기믹끼리 같아 보였음). 넘어가는 포자는 칸 위 솜뭉치 그림이 따로 있어 뺌 */
export const GIM_ICON: [(d: Unit['debuffs'][number]) => boolean, string][] = [
  [d => !!d.charm, 'icon-gim-charm'], [d => d.cap != null, 'icon-gim-cap'], [d => (d.debtLeft ?? 0) > 0 || !!d.debt, 'icon-gim-debt'],
  [d => !!d.swell, 'icon-gim-swell'], [d => d.end?.p === 'flip', 'icon-gim-flip'],
  [d => !!d.trap, 'icon-gim-burst'], [d => d.cureAt != null && d.cureAt < 1, 'icon-gim-full'],
];
export const MARK_ART = [...Object.values(DEBUFF_EDGE), 'fx-edge-buster', 'fx-edge-flame', 'fx-edge-glass', 'fx-edge-plate', 'fx-edge-bark', 'fx-edge-mist', 'fx-edge-spark', 'fx-edge-ember', 'fx-edge-threat',
  'fx-link-chain', 'fx-ring-guardian', 'fx-ring-beacon', 'icon-gim-focus', 'icon-gim-invert', 'icon-gim-link'];
