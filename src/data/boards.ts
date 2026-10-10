import type { EncounterKey } from './encounters';

/** 파티창 육각 판 (02 3-1): 행마다 열 번호 (odd-r 배치) */
export type BoardId = 'b7' | 'b10' | 'b25' | 'b36' | 'b19';

export const BOARDS: Record<BoardId, number[][]> = {
  // 튜토리얼 2인 · 탐험 3인 (02 11장)
  b7: [[1, 2], [0, 1, 2], [1, 2]],
  // 던전 5인 = 3 · 4 · 3칸 3줄 (10칸, 프로토타입과 같은 판). 판 영역 좌우를 가득 채워 칸이 크게 (Lim 2026-10-10: 5인은 그전처럼 10칸)
  b10: [[1, 2, 3], [0, 1, 2, 3], [1, 2, 3]],
  // 레이드 10인 = 가로 5 × 세로 5 (25칸): 20인 판보다 칸이 약 1.2배 (Lim 2026-10-10: 10인은 20인보다 좀 더 커 보이게, 6×6보다 줄여)
  b25: Array.from({ length: 5 }, () => [0, 1, 2, 3, 4]),
  // 대규모 레이드 20인 = 가로 6 × 세로 6 (36칸, Lim 2026-10-09: 6줄로 일정하게)
  b36: Array.from({ length: 6 }, () => [0, 1, 2, 3, 4, 5]),
  // 10인 프로토타입 판. 엔진이 프로토타입과 같게 움직이는지 보는 parity 테스트에만 쓴다
  b19: [[1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2, 3], [1, 2, 3]],
};

/** parity 테스트(FightConfig.proto)에서 쓰는 프로토타입 판 */
export const PROTO_BOARDS: Partial<Record<EncounterKey, BoardId>> = { plague: 'b19' };
