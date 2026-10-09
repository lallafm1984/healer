import type { EncounterKey } from './encounters';

/** 파티창 육각 판 (02 3-1): 행마다 열 번호 (odd-r 배치) */
export type BoardId = 'b7' | 'b10' | 'b19' | 'b36';

export const BOARDS: Record<BoardId, number[][]> = {
  // 튜토리얼 2인 · 탐험 3인 (02 11장)
  b7: [[1, 2], [0, 1, 2], [1, 2]],
  // 보스전 판 = 가로 6 × 세로 6, 5인·10인·20인 모두 같은 판 (Lim 2026-10-09: 모든 보스전 6줄로 일정하게, 10인도 빈 곳 없이)
  b36: Array.from({ length: 6 }, () => [0, 1, 2, 3, 4, 5]),
  // 프로토타입 판 (5인 b10 · 10인 b19). 엔진이 프로토타입과 같게 움직이는지 보는 parity 테스트에만 쓴다
  b10: [[1, 2, 3], [0, 1, 2, 3], [1, 2, 3]],
  b19: [[1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2, 3], [1, 2, 3]],
};

/** parity 테스트(FightConfig.proto)에서 쓰는 프로토타입 판 */
export const PROTO_BOARDS: Partial<Record<EncounterKey, BoardId>> = { warden: 'b10', plague: 'b19' };
