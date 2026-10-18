/**
 * 인연 점수 (길드 v2 `93` 3-2, 사슬 3번): 이긴 판마다 파티원과 쌓이는 점수. 이번 PR은 기록만 (화면 없음, 길드가 꺼져 있어도).
 * 역할 차이 보정 (Lim 10-18 「탱커는 힐을 자주 받기 때문에 … 인연이라던지 더 유리한 면」): 사람 한 명이 판마다 얻는 점수가 역할과 상관없이 같게.
 * 문서 그대로 (가장 많이 받은 1명 · 20% 위험선)면 탱커가 이긴 판마다 2.5점, 딜러 1.1~1.4점이었다 (sim, 이긴 판 2,000판).
 * - 「내 힐이 유난히 크게 도운 사람」: 받은 내 치유 몫 (파티 합 = 1)이 그 역할 · 판 크기 평소의 상위 10% 이상인 사람 모두. 그래서 누구나 판마다 10%
 *   (「가장 많이 받은 1명」은 몫을 역할 평균 · 표준편차 · 백분위로 나눠도 탱커가 1.5~2배 자주 뽑혔다: 한 판 안의 몫이 서로 묶여 있어서)
 * - 생명의 은인 위험선을 역할마다 (탱커는 강타로 자주 내려가 낮게, 근접은 체력이 커서 높게): 판마다 은인이 나오는 비율이 역할끼리 5~6%로 같게
 * 결과 (sim): 이긴 판 한 번에 한 사람 평균 탱커 1.20 · 근접 1.18 · 원거리 1.20점 (S 등급 몫 빼고), 판 크기마다 ±5% 안
 */
import type { Role } from '../engine/types';

type R3 = Exclude<Role, 'healer'>;
export const BOND = {
  /** 함께 이김 · 유난히 크게 도움 · 생명의 은인 · S 등급 · 한 판에 한 사람 최대 */
  win: 1, helped: 1, saved: 2, s: 1, max: 5,
  /** 생명의 은인: 한 판에 몇 명까지 (위험했던 순서) */
  savedMax: 2,
  /** 생명의 은인 위험선 (가장 낮았던 체력 비율이 이 아래, 그 뒤 내 힐을 받고 끝까지 삶) */
  saveAt: { tank: 0.055, melee: 0.2, ranged: 0.075 } as Record<R3, number>,
  /** 유난히 크게 도움: 판 크기 (3 · 5 · 10 · 20인)마다 그 역할 한 사람이 받는 내 치유 몫의 상위 10% 선 (sim, 이긴 판) */
  helpTop: {
    3: { tank: 0.964, melee: 0.171, ranged: 0.248 },
    5: { tank: 0.79, melee: 0.125, ranged: 0.154 },
    10: { tank: 0.543, melee: 0.082, ranged: 0.093 },
    20: { tank: 0.44, melee: 0.045, ranged: 0.055 },
  } as Record<3 | 5 | 10 | 20, Record<R3, number>>,
};

/** 판 크기 → 표의 칸 (파티원 수 + 나) */
export const bondSize = (n: number): 3 | 5 | 10 | 20 => (n <= 3 ? 3 : n <= 5 ? 5 : n <= 10 ? 10 : 20);

/** 한 판의 파티원 (나 빼고): got = 받은 내 치유 (구간 합), low = 가장 낮았던 체력 비율, rescued = 그때 뒤로 내 힐을 받고 그 구간 끝까지 삶 */
export interface BondUnit { nick: string; role: R3; alive: boolean; got: number; low: number; rescued: boolean }

/** 생명의 은인인가: 역할 위험선 아래까지 갔다가 내 힐로 끝까지 삶 */
export const isRescue = (u: Pick<BondUnit, 'role' | 'low' | 'rescued' | 'alive'>): boolean => u.alive && u.rescued && u.low < BOND.saveAt[u.role];

/** 이긴 판 하나의 점수 (사람마다 0 ~ max), 유난히 크게 도운 사람들 · 생명의 은인들. size = 파티원 수 + 나 */
export function bondPoints(party: readonly BondUnit[], size: number, s: boolean): { pts: Map<string, number>; helped: string[]; saved: string[] } {
  const top = BOND.helpTop[bondSize(size)];
  const total = party.reduce((a, u) => a + u.got, 0);
  const helped = total > 0 ? party.filter(u => u.got / total >= top[u.role]).map(u => u.nick) : [];
  const saved = party.filter(isRescue).sort((a, b) => a.low - b.low).slice(0, BOND.savedMax).map(u => u.nick);
  const pts = new Map<string, number>();
  for (const u of party) {
    const p = BOND.win + (s ? BOND.s : 0) + (helped.includes(u.nick) ? BOND.helped : 0) + (saved.includes(u.nick) ? BOND.saved : 0);
    pts.set(u.nick, Math.min(BOND.max, p));
  }
  return { pts, helped, saved };
}
