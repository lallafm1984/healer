/** 한 판의 흐름 (콘텐츠 선택 → (주간 도전만 입장) → 편성 → 전투 → 정산 → 보상) 사이에 넘기는 값 */
import type { ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import type { RosterEntry } from '../engine';
import type { CoachKey } from './tutorial';
import type { BattleResult, Settlement } from './settle';

export const Flow: {
  /** 출발부터 정산까지 유지 (구간 사이 휴식 포함). 직업·캐릭터 전환 금지 */
  running?: boolean;
  /** 이번 편성의 스테미너를 이미 냄 (81: 「출전」 팝업에서 내고 편성으로 감, 출발하면 끔) */
  paid?: boolean;
  content: ContentKey;
  diff: DiffName;
  /** 편성 화면에서 뽑은 공개모집 파티 (입장할 때마다 새로) */
  party: RosterEntry[] | null;
  /** 파티 배치·첫 전투 시드 (미리보기와 실제 시작 위치가 같게) */
  seed: number;
  /** 이번 입장에서 다시 뽑은 횟수 (1회 무료, 02 9장) */
  rerolls: number;
  result: BattleResult | null;
  settle: Settlement | null;
  /** 다음 출발에 띄울 튜토리얼 안내 (한 번 쓰면 비움) */
  coach: CoachKey | null;
  /** 편성 방식 (09 S05): 공개모집 · 길드파티 */
  mode: 'public' | 'guild';
  /** 공개모집으로 뽑은 파티 (길드파티 빈자리도 여기서 채움) */
  pub: RosterEntry[] | null;
  /** 길드파티로 고른 길드원 id */
  gpick: number[];
  /** 주간 도전 단계 (13 3-2, 0 = 도전 아님) */
  chal: number;
  /** 길드 탭 「길드파티로 출전」 (30): 다음 편성을 길드파티로 시작 */
  preferGuild: boolean;
} = { content: 'rustfort', diff: '보통', party: null, seed: 1, rerolls: 0, result: null, settle: null, coach: null, mode: 'public', pub: null, gpick: [], chal: 0, preferGuild: false };

export const newSeed = () => (Math.random() * 1e9) | 0;

