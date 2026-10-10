/**
 * 보스 데이터 (38 0-2): 보스 = 기술 목록 + 페이즈 흐름 + 광폭화. 엔진(engine/bosses.ts)은 이 표를 읽어 돌리기만 한다.
 * 기술이 하는 일·장판 모양·매 틱 도는 일은 이름 붙은 부품(p)으로 적는다. 새 보스는 부품을 골라 값만 적고,
 * 없는 부품만 engine/bossParts.ts에 더한다 (38 0-4).
 * 피해 수치는 맞을 대상이 실제로 받는 양 (35 1-2, 34 9-3): tank = 탱커 기준, 그 밖은 원거리·힐러 기준.
 */
import type { FxName, TelKind } from '../engine/types';
import { CLASSES } from './classes';
import { soaps, type ScriptKey } from './encounters';
import { SKILLS } from './skills';

/**
 * 수치 단위 (35 1-2, 38 0-3): 레벨 1 · 보통 기준 값. 엔진이 레벨(R.lv × R.enemy)·난이도·적 피해 배율을 곱하므로
 * 새 보스는 「탱체 50%」처럼 비율로 적으면 레벨과 상관없이 같은 느낌이 된다. 값은 엔진의 기본 파티원과 같음 (fight.ts makeParty)
 */
export const UNIT = { tank: 1000, dps: 600, me: 550, heal: SKILLS.heal.amt! };
/** 비율 → 데이터 값: U.tank(0.5) = 탱체 50% (탱커가 받는 양), U.dps(0.25) = 딜체 25% (원거리·힐러가 받는 양) */
export const U = {
  tank: (x: number) => Math.round(x * UNIT.tank),
  dps: (x: number) => Math.round(x * UNIT.dps),
  me: (x: number) => Math.round(x * UNIT.me),
  heal: (x: number) => Math.round(x * UNIT.heal),
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const roleDps = (role: 'tank' | 'melee' | 'ranged') => avg(Object.values(CLASSES).filter(c => c.role === role).map(c => c.dps * 10));
/**
 * 보스 체력 = 파티 딜 × 목표 시간 (35 1-2). 파티 딜은 레벨 1 공개모집 직업 평균 (이동·도망으로 빠지는 딜은 안 셈).
 * 시작값이고, 클리어율에 맞춘 최종값은 자동 밸런스(38 0-6)가 tune에 적는다
 */
export function bossHpFor(sec: number, comp: { tank: number; melee: number; ranged: number }): number {
  return Math.round((comp.tank * roleDps('tank') + comp.melee * roleDps('melee') + comp.ranged * roleDps('ranged')) * sec / 100) * 100;
}

/** 디버프가 끝날 때 (시간이 다 되거나 지워져서) 하는 일 */
export type DebuffEnd =
  /** 깎인 최대 체력을 되돌림 (썩은 숨결) */
  | { p: 'restoreMax' }
  /** 이웃 칸에 피해 + 독침 (전염, SPREAD) */
  | { p: 'spread' }
  /** 지우지 않고 끝나면 그 사람이 선 열 전체에 피해 (독창, 26 4-3). 지우면 그냥 사라짐 */
  | { p: 'colDmg'; dmg: number }
  /** 지우지 않고 끝나면 그 사람에게 피해 (완치 표식 P-FULL의 시간 끝) */
  | { p: 'hit'; dmg: number }
  /** 함정 (P-TRAP, 가문의 반지): 지우지 않고 끝나면 그 사람 dmg, 지우면 이웃 칸 아군 burst (마법) */
  | { p: 'trapHit'; dmg: number; burst: number }
  /** 터지는 마력 (P-TRAP, 불안정한 마력 · 서리 표식): 시간이 다 되거나 지우면 (바로) 이웃 칸 아군 dmg (마법) */
  | { p: 'blast'; dmg: number }
  /** 끝나거나 지워지면 그때까지 중첩 × dmg 피해 (마력 역류 P-RECOIL, 중첩 0이면 없음) */
  | { p: 'stackHit'; dmg: number }
  /**
   * 옮겨붙음 (P-JUMP): 지우면 이웃 칸 아군 1명에게 sec초로 옮겨붙고 초당 피해 × mult. 이웃 칸이 비어 있으면 그대로 사라짐.
   * 지우지 않고 시간이 다 되면 보스가 주는 피해 +boost (전투 끝까지 더해짐).
   * on: quake = 약한 판 (메아리, 39 3-2): 진동이 울릴 때 이웃 칸 아군 1명 (악몽 nMythic명까지 갈라져)에게 남은 시간 그대로 옮겨붙음.
   * 지우거나 시간이 다 되면 그냥 사라짐 (sec · boost는 안 씀)
   */
  | { p: 'jump'; sec: number; mult: number; boost: number; on?: 'quake'; nMythic?: number }
  /**
   * 부풀기 (P-SWELL, 46 5장): 지우면 이웃 칸 아군에게 중첩 × pop, 지우지 않고 시간이 다 되면 본인 중첩 × self + 이웃 칸 아군 중첩 × near.
   * 피해는 방어력 파티 기준 (마법). 중첩은 DebuffDef.swell이 쌓음
   */
  | { p: 'pop'; pop: number; self: number; near: number }
  /** 뒤집힘 저주 (P-FLIP, 46 5장): 지우지 않고 시간이 다 되면 체력 비율이 1 − 지금 비율로 (가장 낮아도 min, 기본 5%). 지우면 그냥 사라짐 */
  | { p: 'flip'; min?: number }
  /**
   * 넘어가는 포자 (P-PASS, 48 5장): absorb와 같이 적음. 지우면 남은 흡수 막이 체력 비율이 가장 높은 다른 아군에게 sec초로 넘어감
   * (넘어갈 사람이 없으면 사라짐). 지우지 않고 시간이 다 되면 남은 막만큼 그 사람 피해 (마법, 파티 기준)
   */
  | { p: 'pass'; sec: number };

/** 걸 디버프 (02 5-5 해제 유형) */
export interface DebuffDef {
  name: string;
  type: string;
  /** 지속 (초) */
  left: number;
  /** 초당 피해 */
  dot?: number;
  /** 지우면 터지는 함정 (지울 수 없음 표시) */
  trap?: boolean;
  /** 해제로 안 지워짐 (쇠약·완치 표식). 정화 두루마리도 못 지움 */
  lock?: boolean;
  /** 체력 비율이 이 값 이상이 되면 바로 사라짐 (P-WOUND 0.9, P-FULL 1). end는 안 함 */
  cureAt?: number;
  /** 체력이 cureAt 아래인 동안 every초마다 1중첩 (최대 max), 초당 피해 = 중첩 × dot (P-WOUND) */
  grow?: { every: number; dot: number; max: number };
  /** 같은 디버프가 또 걸리면 1중첩 더하고 지속은 처음으로 (최대 stackMax). 초당 피해 = dot × 중첩 (파열 P-BURST) */
  stackMax?: number;
  /** 걸려 있는 동안 최대 체력 −비율 (부패). 끝나면 end restoreMax로 돌아옴 */
  maxCut?: number;
  /** 딜 0 (얼림·침묵·삼킴) */
  noDps?: boolean;
  /** 움직이지 못함: 장판을 못 피하고 제자리 (얼림·삼킴) */
  noMove?: boolean;
  /** 판 기술(장판·피난처 한 방)에 안 맞음 (두꺼비 배 속, 35 4-2 삼키기) */
  hide?: boolean;
  /** 걸린 때보다 보스 체력이 이 비율(보스 최대 체력 기준)만큼 깎이면 풀림 (삼키기 4%). 풀릴 때 end는 안 함 */
  untilBossLoss?: number;
  /** 받는 치유 −비율. 중첩 디버프면 × 중첩 (얼룩진 장갑 0.5, 먼지 범벅 0.08 × 최대 5) */
  healCut?: number;
  /** 지속 피해 × feed만큼 보스 체력 회복 (젊음의 갈망 흡수, 35 4-3) */
  feed?: number;
  /** 받는 치유가 피해로 (뒤집힌 축복 P-INVERT): 들어올 치유량만큼 피해. 보호막·피해 감소·보호의 손은 통함 */
  invert?: boolean;
  /** 나(힐러)에게 걸린 동안 스킬을 쓸 때마다 1중첩 (마력 역류 P-RECOIL). 해제 스킬로 이 디버프를 지우는 그 한 번은 안 셈 */
  count?: boolean;
  /** 나(힐러)에게 걸린 동안 내 마나 초당 −drain (%p, 마나 갈취 P-DRAIN) */
  drain?: number;
  /**
   * 매혹 (P-CHARM): 걸린 사람이 딜을 멈추고 every초마다 이웃 칸 아군을 dmg로 때림 (물리). 이 사람에게 치유가 들어갈 때마다 지속 +heal초,
   * 체력이 free 아래가 되면 정신이 돌아옴 (풀림). noDps를 같이 적음
   */
  charm?: { every: number; dmg: number; heal: number; free: number };
  /** 넘치는 빛 과부하형 (P-OVER): 이 사람에게 넘친 치유 × over만큼 이웃 칸 아군 피해 (방어력 무시) → 정확히 채우기 */
  over?: number;
  /** 받는 피해 +비율 × 중첩 (가시 · 공허, 탱커 교대 P-SWAP) */
  vuln?: number;
  /** 부풀기 (P-SWELL): 1중첩으로 걸리고 every초마다 1중첩 (최대 max). 터지는 일은 end pop */
  swell?: { every: number; max: number };
  /** 치유 상한 (P-CAP): 걸린 동안 치유로는 체력이 최대 체력 × cap까지만 참 (넘는 몫은 넘친 치유). 이미 더 높으면 깎지 않음 */
  cap?: number;
  /** 보스를 맞는 탱커에게 이 중첩이 쌓이면 다른 탱커가 보스를 가져감 (탱커 교대 P-SWAP, 05 4-A · 6-A) */
  swap?: number;
  /** 탱커가 하나뿐인 5인: swap 중첩이면 근접 딜러 (없으면 원거리)가 이 초만큼 대신 맞고 탱커의 이 디버프가 풀림 (달군 쇠, 51 3-2) */
  sub?: number;
  /**
   * 치유 흡수 (P-ABSORB, 05 5-C · 6-C): 이 사람에게 들어오는 치유가 먼저 막을 깎음 (그동안 체력은 안 참). 막 = absorb × 보스 피해 배율.
   * 막을 다 깎으면 바로 사라짐 (end 안 함), 남은 채로 시간이 다 되면 end
   */
  absorb?: number;
  /** 걸릴 때 한 번 피해 (마법, 파티 기준): 완치 표식이 가득 찬 사람에게 걸려도 바로 풀리지 않게 체력을 떨어뜨림 (춤바람 · 완치 모자, 48) */
  drop?: number;
  /** 칸 위 그림 (모자 뽑기의 모자 셋, 그림 49). 그림이 없으면 안 그림 (디버프 배지 · 칸 색은 그대로) */
  art?: string;
  /** 걸릴 때 그 사람 칸에 이펙트 (모자 · 춤바람 · 벌침, 그림 49 E) */
  fx?: FxName;
  end?: DebuffEnd;
}

/** 쫄이 쓰러질 때 (P-BURST) */
export type AddDown =
  /** 살아 있는 모두에게 이 디버프 1중첩 (stackMax 디버프). 여럿이 한꺼번에 쓰러지면 겹침 (파열) */
  | { p: 'burst'; debuff: DebuffDef }
  /** 그 쫄이 때리던 사람에게 디버프 (뼈 먼지). 그 사람이 없으면 무작위 1명 */
  | { p: 'debuff'; debuff: DebuffDef };

/**
 * 판에 나오는 적 (P-ADD, 35 3-I): 보스가 부른 쫄·오브젝트. 판의 빈 칸 하나를 차지하고 (빈 칸은 1개 이상 남김, 모자라면 덜 나옴),
 * 딜러(근접·원거리)가 「먼저 잡기」 순서대로 한 마리씩 일점사한다. 탱커는 보스를 계속 때린다.
 * 때리는 쫄은 탱커가 2명이면 보스를 맞지 않는 탱커(부탱커)가 옆 칸으로 가서 끌고, 아니면 딜러 1명을 맡는다. every초마다 dmg (물리, 원거리 기준)
 */
export interface AddDef {
  name: string;
  /** 칸 이름표 글자 (한두 글자) */
  short: string;
  /** 칸 그림 (src/art의 mob-…, 37 4장 C). 없으면 하는 일에 맞는 공용 그림 (37 4장 E), 그것도 없으면 글자 */
  art?: string;
  /** 체력 = 보스 최대 체력 × hp */
  hp: number;
  /** 맡은 사람에게 every초마다 (0이면 안 때림: 토템·오브젝트) */
  dmg: number;
  every: number;
  down?: AddDown;
  /** 이웃 칸에 선 사람 초당 피해 (진흙 토템 독 오라, 파티원이 장판처럼 피함) */
  aura?: number;
  /** 나오는 칸: front = 보스가 때리는 사람(탱커) 가까이 (때리는 쫄 기본), back = 뒷줄, center = 가운데, edge = 가장자리, random (오브젝트 기본). 걸어오는 쫄은 back, 자폭 쫄은 노린 사람에게서 from칸 떨어진 곳 */
  at?: 'front' | 'back' | 'center' | 'edge' | 'random';
  /** 하는 일 (35 3-I) */
  job?: AddJob;
  /** 쫄 떼 (P-SWARM): 딜러 딜이 살아 있는 떼 모두에게 같이 들어감 (범위 딜). 일점사 대상만 남는 딜을 넘김 */
  cleave?: boolean;
}

/** 판 위 적이 하는 일. 딜러는 mend → bomb · hatch · hoard → jail → pylon → 그 밖 순서로, 같으면 먼저 나온 것부터 잡는다 */
export type AddJob =
  /** 치유하는 쫄 (P-MENDER): every초마다 보스 체력 pct 회복 */
  | { p: 'mend'; every: number; pct: number }
  /** 폭탄 (P-BOMB): sec초 안에 못 깨면 터져서 살아 있는 모두에게 dmg (마법). debuff = 터질 때 맞은 모두에게 (악몽 꼬질 독 연기, 51 4-1) */
  | { p: 'bomb'; sec: number; dmg: number; debuff?: DebuffDef }
  /** 보호막 수정 (P-PYLON): 서 있는 동안 보스가 받는 피해 −cut */
  | { p: 'pylon'; cut: number }
  /** 마나 갈취 쫄 (P-DRAIN): 살아 있는 동안 내 마나 초당 −pct (%p) */
  | { p: 'drain'; pct: number }
  /** 감옥 (P-JAIL): 기술 효과 jail이 만듦. 갇힌 사람 칸에 겹쳐 나오고, 깨지면 그 사람이 풀림 */
  | { p: 'jail' }
  /** 큰 쫄 (P-ELITE): every초마다 맡은 사람(부탱커)에게 warn초 예고 뒤 dmg (탱커 기준, 물리). 예고 동안 칸 위에 남은 초 */
  | { p: 'smash'; every: number; warn: number; dmg: number }
  /**
   * 걸어오는 쫄 (P-MARCH): 뒷줄에 나와 every초마다 한 줄씩 앞으로 (앞 칸이 막혀 있어도 걸음은 셈). 앞줄에서 한 번 더 걸으면
   * 보스에게 흡수 → 보스가 주는 피해 ×(1+boost), 전투 끝까지 겹침
   */
  | { p: 'march'; every: number; boost: number }
  /**
   * 자폭 쫄 (P-FIXATE): 탱커 아닌 1명(나 포함)을 노려 from칸 떨어진 곳(기본 3)에 나오고 every초마다 한 칸씩 다가감.
   * 붙은 채로 차례가 오면 터져 그 사람 dmg + 이웃 칸 splash (마법, 원거리 기준). 노린 사람이 쓰러지면 다른 사람을 노림
   */
  | { p: 'fixate'; every: number; dmg: number; splash: number; from?: number }
  /** 쏘는 쫄 (꿀벌 떼, 48 4-3): every초마다 탱커 아닌 무작위 1명 (나 포함)에게 dmg (물리, 원거리 기준) + debuff (벌침 쇠약). 맡은 사람을 때리지 않음 */
  | { p: 'sting'; every: number; dmg: number; debuff: DebuffDef }
  /** 부화하는 알 (51 5장 작은 조합 = 판 위 적 + 시간 제한): sec초 안에 딜러가 못 깨면 알이 깨지고 그 칸에서 add가 나옴 */
  | { p: 'hatch'; sec: number; add: AddDef }
  /** 금화 더미 (51 4-1 번쩍이): sec초 안에 딜러가 못 깨면 보스가 주워 보스가 주는 피해 +boost (전투 끝까지 겹침) */
  | { p: 'hoard'; sec: number; boost: number };

/** 기술이 맞을 때 하는 일 */
export type SkillEffect =
  /** 평타: 보스가 때릴 사람(탱커)에게 ±30% (전사 ±15%) */
  | { p: 'auto'; dmg: number }
  /** 탱커 버스터: 예고 때 고른 사람에게 skill.dmg (탱커 기준, 물리). debuff = 맞은 사람에게 (물어뜯기 독 · 공허 중첩) */
  | { p: 'tank'; debuff?: DebuffDef }
  /**
   * 전원 광역 (마법). phaseDmg = 그 페이즈에서는 이 피해. grow = 쓸 때마다 이만큼 더 커짐 (수정 핵 과열).
   * debuff = 맞은 사람 모두에게 (독안개 분출 독 중첩 · 그림자 파동 메아리)
   */
  | { p: 'all'; dmg: number; phaseDmg?: Partial<Record<number, number>>; grow?: number; debuff?: DebuffDef }
  /**
   * n명에게 디버프 (이미 같은 디버프가 있는 사람은 뺌). n = 'all'이면 살아 있는 모두. nMythic = 악몽 인원.
   * pick: random (기본) / lowest = 체력 비율이 가장 낮은 사람부터, 탱커 빼고 (사냥 P-HUNT) / tel = 예고 때 고른 사람 (skill.target, 삼키기) /
   * others = 탱커 · 나 빼고 무작위 (매혹 · 뒤집힌 축복) / me = 나 (마력 역류) / tank = 보스가 때리는 사람 (서리 손길) /
   * linked = 생명 사슬에 묶인 사람 먼저, 모자라면 탱커 · 나 빼고 무작위 (잠꼬대 저주 · 소금물 저주, 46 5장).
   * order = 차례 번호를 받은 사람 먼저 (나 빼고), 모자라면 탱커 · 나 빼고 무작위 (거꾸로 마술, 48 4-3).
   * burstAdjacent = 걸린 둘이 붙어 서 있으면 바로 터짐 (전염)
   */
  | { p: 'debuff'; n: number | 'all'; nMythic?: number; pick?: 'random' | 'lowest' | 'tel' | 'others' | 'me' | 'tank' | 'linked' | 'order'; debuff: DebuffDef; burstAdjacent?: boolean }
  /**
   * 최대 체력을 깎는 중첩 디버프 (썩은 숨결 · 썩은 축복 P-HPDOWN): 무작위 n명, 중첩마다 pct, max 중첩, 다시 걸리면 지속이 처음으로.
   * again = 이미 걸린 사람이 있으면 그 확률로 그중에서 고름 (썩은 축복 0.6). 지우면 최대 체력이 돌아옴 (end restoreMax)
   */
  | { p: 'rot'; n: number; debuff: DebuffDef; pct: number; max: number; again?: number }
  /**
   * 끌어당김 (P-PULL): 예고 때 고른 사람(target back)을 탱커 옆 앞줄 빈 칸으로 끌어옴. sec초 동안 보스 평타를 탱커와 번갈아 맞음
   * (끌려온 사람은 한 대에 dmg, 원거리 기준). 끌려온 칸을 벗어나면 (도망·장판 피하기) 바로 끝나고, 끝나면 제자리로 돌아감.
   * pad = 끌려온 칸에 금빛 받침 (망루 파수꾼, 39 3-1): sec초 끝에 울려 받침 위 사람 dmg, 비어 있으면 (도망 · 쓰러짐) 전원 empty (마법).
   * link = 끌려온 사람과 보스를 맞는 탱커를 sec초 나눔형 사슬로 이음 (연잎 사슬, 48 4-2). 악몽은 둘 다 받는 피해 +vulnMythic
   */
  | { p: 'pull'; sec: number; dmg: number; pad?: { dmg: number; empty: number }; link?: { name: string; vulnMythic?: number } }
  /** 사냥 (P-HUNT, 35 4-2 사냥 창): 맞는 순간 체력 비율이 가장 낮은 탱커 아닌 n명 (기본 1, 20인 그림자 가시 2 · 악몽 nMythic명)에게 dmg (물리, 원거리 기준) */
  | { p: 'hunt'; dmg: number; n?: number; nMythic?: number }
  /**
   * 보물 욕심 (P-GREED, 51 5장): 사냥의 반대. 예고 때 고른 사람 (target greed = 그 순간 체력 비율이 가장 높은 탱커 · 나 아닌 n명, 같으면 무작위)에게
   * dmg (물리, 원거리 기준). debuff = 맞은 사람에게 (무거운 주머니 · 그을음). 모두를 가득 채우면 누가 맞을지 모르니 가운데에 두기
   */
  | { p: 'greed'; dmg: number; debuff?: DebuffDef }
  /**
   * 녹는 보호막 (P-MELT, 51 5장): sec초 동안 열기. 흡수 보호막은 초마다 남은 양의 rate씩 녹고, 보호막 · 외부 생존기 (수호 영혼 · 나무껍질 · 희생)는
   * 남은 시간이 두 배로 빨리 줄어듦 → 미리 걸지 말고 큰 피해 직전에. 열기 끝에 오는 큰 피해는 따로 적은 광역 기술
   */
  | { p: 'melt'; sec: number; rate: number }
  /** 쫄 n마리 (P-ADD). 악몽은 nMythic */
  | { p: 'adds'; n: number; nMythic?: number; add: AddDef }
  /** 무너지는 바닥 (P-HOLE): 가장자리 빈 칸 n개가 끝까지 못 서는 칸이 됨 (전투 전체 max개까지). 빈 칸은 늘 1개 이상 남김 */
  | { p: 'hole'; n: number; max: number }
  /**
   * 차례 (P-ORDER): 탱커 아닌 n명(나 포함, 악몽 nMythic) 칸에 번호 ①②③. sec초 안에 번호 순서대로 단일 대상 힐(기본·빠른·지속 힐 칸)을
   * 한 번씩 넣으면 성공 → 보스 daze.sec초 멍함 (기술을 안 쓰고, 받는 피해 × daze.vuln). 순서가 틀리면 그 사람 wrong 피해 + 처음부터
   * (쉬움은 피해 없이 처음부터). 시간이 다 되면 아직 못 받은 사람마다 miss 피해. 받는 치유가 깎인 사람도 횟수로 셈.
   * fake = 신기루 숫자 (54 4-1 냥크스): 번호 없는 사람 하나에 ① 아닌 번호가 하나 더 보이다가 시작 at초 뒤 걷힘. 그 전에 가짜에게 힐하면 틀림.
   * wrongAll = 틀리면 전원 피해 (악몽)
   */
  | { p: 'order'; n: number; nMythic?: number; sec: number; wrong: number; miss: number; daze: { sec: number; vuln: number }; fake?: { at: number }; wrongAll?: number }
  /**
   * 감옥 (P-JAIL): 탱커·나 아닌 n명(악몽 nMythic)을 가둠 (딜 0 · 못 움직임 · 초당 dot, 해제 안 됨). 그 칸에 감옥(체력 = 보스 최대 × hp)이
   * 겹쳐 나오고 딜러가 일점사로 깨면 풀림. 갇힌 사람이 쓰러지면 감옥도 사라짐
   */
  | { p: 'jail'; n: number; nMythic?: number; name: string; short: string; hp: number; dot: number }
  /**
   * 진동 (P-QUAKE, 35 4-4): 맞는 순간 내가 시전 중인 힐(찬가 같은 채널 포함)이 끊기고 그 스킬이 lock초 잠김. 전원 dmg (마법).
   * 화면은 예고 동안 휠 가장자리가 떨림. 즉시 스킬·지속 힐은 안 끊김
   */
  | { p: 'quake'; dmg: number; lock: number }
  /** 숨 고르기 (35 4-4 탑주의 그림자): sec초 동안 보스가 기술을 쉼 (받는 피해는 그대로). clear 이름의 디버프가 모두에게서 사라짐 */
  | { p: 'rest'; sec: number; clear?: string }
  /** 그 이름의 디버프가 모두에게서 사라짐 (신전지기 유령: 천장 무너짐 뒤 먼지 범벅, 35 4-5) */
  | { p: 'clear'; name: string }
  /**
   * 무력화 (P-STAGGER, 35 4-5): sec초 동안 체력이 hp(악몽 hpMythic) 이상인 파티원의 딜만 게이지를 채움 (탱커는 tank배).
   * 게이지 끝 = 그 조건으로 파티 전원이 need초 때린 양. 채우면 win.sec초 「무방비」 (보스가 기술을 쉬고 받는 피해 × win.vuln).
   * 못 채우면 전원 fail.dmg (물리) + 시전 시간이 있는 내 스킬이 fail.lock초 잠김
   */
  | { p: 'stagger'; sec: number; need: number; hp: number; hpMythic?: number; tank: number; win: { sec: number; vuln: number }; fail: { dmg: number; lock: number } }
  /**
   * 반격 틈 (P-COUNTER, 35 4-5): 끊기 ✋ 능력이 있는 파티원이 시전 시작에 끊으면(능력 성공 확률) 보스가 stun초 기절.
   * 못 끊으면 맞을 때 앞줄(판 앞쪽 3분의 1)에 선 사람 모두 dmg (물리). 기술은 저절로 「끊기 가능」이 됨
   */
  | { p: 'counter'; stun: number; dmg: number }
  /**
   * 받침 (P-TOWER, 35 4-5): 예고 때 빈 칸 n개에 금빛 발판, 갈 수 있는 파티원(탱커·나·겁쟁이 빼고)이 발판으로 감.
   * 맞을 때 발판 위 사람은 dmg, 빈 발판 하나마다 전원 empty (마법)
   */
  | { p: 'tower'; n: number; dmg: number; empty: number }
  /**
   * 디버프를 차례로 돌려 가며 n명에게 (네 가지 청소약: 질병 → 독 → 저주 → 마법). each = 한 번에 n명이 하나씩 다른 디버프 (네 가지 메아리, 05 6-A).
   * random = 탱커 · 나 아닌 n명(악몽 nMythic)이 사람마다 목록에서 무작위 하나 (모자 뽑기, 48 5장)
   */
  | { p: 'cycle'; n: number; nMythic?: number; debuffs: DebuffDef[]; each?: boolean; random?: boolean }
  /**
   * 요정 고리 (P-GROW, 48 5장): 탱커 · 나 아닌 n명(악몽 nMythic)이 선 칸에 고리 장판 sec초 (초당 dps, 마법). 고리 안에 선 사람이 치유
   * (직접 · 지속 · 광역)를 받으면 한 겹 자람 (둘레 1칸씩, every초에 한 번, 최대 max겹 · 악몽 maxMythic). 파티원은 장판처럼 걸어 나옴
   */
  | { p: 'ring'; n: number; nMythic?: number; sec: number; dps: number; every: number; max: number; maxMythic?: number }
  /**
   * 헤매는 영혼 (P-SOUL, 35 3장): 빈 칸 하나에 파티원이 아닌 영혼 칸 (최대 체력 = 탱커·나 아닌 파티원 평균, hp 비율로 시작).
   * 칸 탭으로 단일 힐(기본·빠른·지속)만 들어감. sec초 안에 가득 채우면 win, 못 채우면 fail. type이 있으면 그 유형을 지우는 직업이
   * 영혼에 해제를 쓰면 바로 성공. 빈 칸이 1개뿐이면 안 나옴. size = 최대 체력 배율 (사람 칸 큰 판: 숲 할아버지 나무, 48 4-3), hpMythic = 악몽 시작 비율.
   * n = 한 번에 나오는 수 (문에 박힌 조각 셋, 51 4-3), sizeMythic = 악몽 최대 체력 배율
   */
  | { p: 'soul'; name: string; short: string; hp: number; hpMythic?: number; sec: number; type?: string; win: SoulWin; fail: SoulFail; art?: string; size?: number; sizeMythic?: number; n?: number }
  /**
   * 생명 사슬 (P-LINK, 35 3장): 두 사람을 sec초 잇는 사슬 (pick tanks = 두 탱커, 없으면 탱커 아닌 사람 둘. 나도 걸릴 수 있음).
   * balance = 두 사람 체력 비율 차이가 gap(기본 0.3)을 넘으면 끊어지며 둘 다 dmg (aim 기준, 기본 party).
   * share = 둘이 받는 피해·치유를 반씩 나눔 (방어력·받는 치유 효과는 각자). pairs = 한 번에 거는 쌍 수 (20인 물그림자 사슬 3쌍, 51 4-3), pairsMythic = 악몽
   */
  | { p: 'link'; kind: 'balance' | 'share'; name: string; sec: number; pick?: 'tanks' | 'others'; gap?: number; dmg?: number; aim?: 'tank' | 'party'; pairs?: number; pairsMythic?: number }
  /**
   * 넘치는 빛 그릇형 (P-OVER, 35 4-7): sec초 동안 넘친 치유가 그릇에 모임 (끝 = 파티 최대 체력 합 × need).
   * 가득 차면 전원 shield초 보호막 (받는 피해 −40%). 못 채우면 그냥 사라짐. 과부하형은 DebuffDef.over
   */
  | { p: 'vessel'; name: string; need: number; sec: number; shield: number }
  /**
   * 집결 분담 (P-SOAK, 05 4-A 피의 서약): 예고 때 고른 사람(target random)과 그 이웃 칸 아군이 dmg를 인원 수로 나눠 받음 (마법).
   * 예고 동안 가까운 파티원이 그 옆으로 모임 (외톨이 · 겁쟁이 · 탱커 · 나는 안 감). 혼자면 dmg 그대로
   */
  | { p: 'share'; dmg: number }
  /** 뒤바뀐 자매 (05 4-D): 두 탱커의 그 이름 디버프 (가시 중첩)를 맞바꿈. 바뀐 뒤 보스를 맞는 탱커가 swap 중첩이면 바로 교대 */
  | { p: 'trade'; name: string }
  /** 깨진 시간 (05 5-E): sec초 동안 내 시전 시간 × mult (이미 시전 중인 힐은 그대로) */
  | { p: 'slow'; sec: number; mult: number }
  /** 보스가 주는 피해 +boost, 전투 끝까지 더해짐 (소프트 광폭화 P-ENRAGE, 05 6-E) */
  | { p: 'empower'; boost: number }
  /** 예고 때 고른 사람 (target)에게 dmg (물리, 원거리 기준). debuff = 맞은 사람에게. 신기루 창 · 거울 책장 (54 4장) */
  | { p: 'strike'; dmg: number; debuff?: DebuffDef }
  /**
   * 모래시계 (P-GLASS, 54 5장): 뒤집는 순간 살아 있는 파티원의 체력 비율을 기록하고 sec초 뒤 모두 그 비율로 되돌림 (체력만, 그 사이 쓰러진 사람은 그대로).
   * then = 뒤집은 뒤 in초에 그 기술을 엶 (창 안 광역 데굴데굴. 그 기술은 first null · 긴 주기로 적어 한 번만 쓰게).
   * absorbHit = 되돌릴 때 치유 흡수 막이 남은 사람 이만큼 피해 (악몽 둘둘이)
   */
  | { p: 'glass'; sec: number; then?: { skill: string; in: number }[]; absorbHit?: number };

/** 영혼을 채웠을 때: cure 유형 디버프를 모두에게서 1개씩 지움 · 받는 치유 +heal 비율 · 보스가 주는 피해 −weak 비율 · 보스가 받는 피해 +vuln 비율 (sec초) */
export interface SoulWin {
  text: string;
  cure?: string;
  heal?: { pct: number; sec: number };
  weak?: { pct: number; sec: number };
  vuln?: { pct: number; sec: number };
  /** 채웠을 때 판 전체 이펙트 (숲 할아버지가 깨어남, 그림 49 E). 영혼 정화 이펙트는 늘 나옴 */
  fx?: FxName;
}

/** 영혼을 못 채웠을 때: dmg (마법), near = 영혼 이웃 칸만 (아니면 전원). debuff = 맞은 사람에게. boost = 보스가 주는 피해 +비율 (악몽 오르말, 51 4-3), fx = 판 전체 이펙트 (문이 열림) */
export interface SoulFail {
  text: string;
  dmg: number;
  near?: boolean;
  debuff?: DebuffDef;
  boost?: number;
  fx?: FxName;
}

/** 장판 칸 고르기 */
export type ZoneCells =
  /** 무작위 파티원 칸 둘레 1칸. 범위 밖 빈 칸이 범위 안 인원 이상 남는 곳만 (05 1-B: 던전에서 「피할 곳이 없어!」가 안 나오게) */
  | { p: 'around' }
  /** 판의 한 줄 묶음 (앞줄 · 가운데 · 뒷줄, 3분의 1씩): 등 뒤 인사 (P-ROW, 35 4-3)는 뒷줄 */
  | { p: 'line'; at: 'front' | 'mid' | 'back' }
  /** 판 바깥 1열: 줄마다 맨 왼쪽 또는 맨 오른쪽 칸, 쓸 때마다 좌우 번갈아 (역병 폭풍, 26 3-1) */
  | { p: 'edge' }
  /** 살아 있는 몸통(bodies 앞 n개)이 맡은 열 (몸통마다 per열)을 왼쪽부터 차례로. 악몽은 nMythic개 동시 (크레센도, 26 4-3) */
  | { p: 'bodyCols'; bodies: number; per: number; nMythic: number }
  /**
   * 흐르는 장판 (향로 연기, 35 4-1): 한쪽 끝 열에서 시작해 every초마다 한 열씩 옆으로. 다음 열은 every초 전에 예고되어 파티원이 미리 비킨다.
   * 열마다 장판은 skill.dur초 남음. from: left (기본) / right / alt = 쓸 때마다 번갈아.
   * fixed + hitDmg면 못 피하는 세로 줄 훑기 (보물 수레, 51 4-1): 열이 닿을 때 그 열에 선 사람 hitDmg
   */
  | { p: 'flow'; every: number; from?: 'left' | 'right' | 'alt' }
  /**
   * 피난처 (P-SAFE): 안전 칸을 뺀 모든 칸. 안전 칸 n개 (악몽 nMythic): edge = 판 가운데에서 먼 칸부터 (배치기),
   * center = 가운데에 가까운 칸부터 + tank면 탱커 칸도 (천장 무너짐). 화면은 안전 칸을 금빛으로. 던전은 안전 칸 ≥ 인원 (35 3-E)
   */
  | { p: 'safe'; at: 'edge' | 'center'; n: number; nMythic?: number; tank?: boolean };

/** 기술이 도는 조건. 타이머는 조건과 상관없이 흐르고, 조건이 안 맞으면 그 차례는 건너뜀 */
export interface SkillWhen {
  /** 이 페이즈에서만 (0 = 인터미션) */
  phase?: number[];
  /** 보스 체력 비율이 이 값 이하 */
  hpBelow?: number;
  /** 이 몸통(bodies 순번) 중 하나라도 살아 있을 때 */
  bodyAlive?: number[];
  /** 악몽에서만 (true) / 악몽이 아닐 때만 (false): 「악몽 변화」로 기술을 바꿀 때 (35 10장 1번) */
  mythic?: boolean;
}

export interface SkillDef {
  key: string;
  name?: string;
  /** 대기열 글자 두 개 (그림이 없을 때) */
  icon?: string;
  kind?: TelKind;
  /** 대기열에 안 보임 (평타) */
  hidden?: boolean;
  /** 첫 시각 (초). null = 페이즈 흐름의 start가 열 때까지 안 씀 */
  first: number | null;
  period: number;
  /** 예고 (초). 0이면 바로 */
  cast: number;
  /** 예고 소리 */
  warn?: string;
  /** 끊기 가능 ✋ (17 7장) */
  cut?: boolean;
  /** 버스터 피해 (탱커 기준) */
  dmg?: number;
  /** 장판 초당 피해 · 지속 (없으면 남는 장판 없음) */
  dps?: number;
  dur?: number;
  /** 장판 예고가 맞는 순간 그 칸에 선 사람 한 번 피해 (피난처 배치기·천장 무너짐) */
  hitDmg?: number;
  /** 장판 예고가 맞는 순간 그 칸에 선 사람에게 디버프 (줄 불길 불씨, 51 3-1) */
  hitDebuff?: DebuffDef;
  /** 장판 예고가 맞는 순간 그 칸 가운데에 이펙트 한 번 (용의 숨결, 그림 52 E) */
  hitFx?: FxName;
  /** 악몽 장판 피해 배율 (불협화음 0.7) */
  dpsMythic?: number;
  /** 피할 수 없는 장판 예고 (줄 피해 P-ROW, 05 3-A 산성 토사 · 5-B 눈보라 세 줄): 파티원이 안 비킴. 맞는 순간 그 칸 hitDmg → 미리 채우기 */
  fixed?: boolean;
  when?: SkillWhen;
  /**
   * 예고 때 맞을 사람을 고름: tank = 보스가 때릴 사람, back = 뒷줄부터 n명 (탱커·나 빼고, 끌어당김),
   * random = 탱커·나 빼고 무작위 n명 (피의 서약), greed = 체력 비율이 가장 높은 탱커·나 아닌 n명 (보물 욕심 P-GREED, 51 5장). 악몽은 nMythic.
   * offtank = 보스를 안 맞는 탱커 (없으면 보스가 때릴 사람, 비늘 방패 돌진 51 4-2)
   */
  target?: 'tank' | 'offtank' | { p: 'back' | 'random' | 'greed'; n: number; nMythic?: number };
  /** 맞을 때 (장판은 없음) */
  effect?: SkillEffect;
  /** 장판 칸 */
  cells?: ZoneCells;
  /**
   * 신기루 (P-MIRAGE, 54 5장): 예고를 띄울 때 가짜 예고 n개 (악몽 nMythic)를 함께 띄움. 사람을 고르는 기술은 다른 사람을 (탱커 기술은 다른 탱커),
   * 장판은 다른 칸을 고름. chance = 예고 자체가 그 확률로 가짜 (광역 반은 신기루). 가짜는 맞기 reveal초 전 (기본 1초)에 일렁이며 걷히고 아무 일도 안 함
   */
  mirage?: { n?: number; nMythic?: number; chance?: number; reveal?: number };
  /** 공략 「어떻게」 글 (없으면 효과 종류의 기본 글, battle/guide.ts dataGuide) */
  how?: string;
}

/** 페이즈 흐름 조건 (모두 맞아야) */
export interface FlowIf {
  phase?: number;
  hpBelow?: number;
  mythic?: boolean;
  /** 이 기술이 아직 안 열렸을 때만 (한 번만 열기) */
  idle?: string;
  /** 인터미션 시간이 끝남 */
  interOver?: boolean;
  /** 이 몸통이 모두 쓰러짐 */
  bodiesDead?: number[];
}

/** 페이즈가 바뀔 때 하는 일 (적은 순서대로) */
export type FlowDo =
  | { p: 'phase'; n: number; name: string }
  /** 화면 가운데 큰 글자 */
  | { p: 'text'; text: string }
  /** 기술을 sec초 뒤부터 */
  | { p: 'start'; skill: string; in: number }
  | { p: 'period'; skill: string; sec: number }
  /** 인터미션: 보스 무적 sec초 */
  | { p: 'inter'; sec: number }
  | { p: 'interEnd' }
  /** 쥐떼가 뒷줄 원거리 n명에게 붙음 (뒤 줄부터) */
  | { p: 'rats'; n: number }
  /** 디버프가 하나라도 있는 사람 모두에게 이 디버프 */
  | { p: 'debuffDebuffed'; debuff: DebuffDef }
  /** 보스가 주는 피해 +boost (상실의 분노, 05 4장) */
  | { p: 'empower'; boost: number; why: string }
  /** 전투의 함성 (05 6-D): sec초 동안 파티원 딜 +pct */
  | { p: 'cheer'; pct: number; sec: number }
  /** 영원한 저녁 (05 6-G): 판의 체력 숫자가 사라지고 채움 색만 보임 */
  | { p: 'dark' };

/** 매 틱 보스 쪽에서 도는 일 (위에서부터 차례로) */
export type FlowStep =
  | { p: 'when'; if: FlowIf; do: FlowDo[] }
  /** 쥐떼: 붙은 사람에게 초당 dps (물리) */
  | { p: 'rats'; phase: number; dps: number }
  /** 노래: 살아 있는 몸통(앞 bodies개)이 맡은 열 (몸통마다 per열)에 선 사람 초당 dps (마법) */
  | { p: 'song'; phase: number; bodies: number; per: number; dps: number };

export interface BossDef {
  /** 시작 페이즈 [번호, 이름]. 이름 '' = 페이즈 표시 없음 */
  phase: [number, string];
  /** 보스 전투 안의 적 몸통 (유령 성가대 성부·지휘자). hp는 enc.hp 기준이라 체력 배율이 그대로 붙음 */
  bodies?: { name: string; hp: number; elite?: boolean; boss?: boolean }[];
  /** 몸통을 고르게 깎음 (쌍둥이 여군주): 파티 딜이 체력이 많은 몸통부터. 딜 욕심쟁이만 적은 쪽을 침 */
  split?: boolean;
  skills: SkillDef[];
  flow?: FlowStep[];
  /** 광폭화: 시각(enc.enrage)이 되거나 레이드 탱커 공백 (35 6-4)이면 짧은 주기 전원 광역 */
  enrage: { name: string; period: number; dmg: number };
  /**
   * 주시 (P-AGGRO, 35 4-4): 내가 넣은 치유량(넘친 치유 포함)으로 눈 게이지가 참. 파티 최대 체력 합 × cap이 되면 sec초 동안
   * 보스가 every초마다 나를 dmg로 때림 (파티원 중 도발 능력이 있으면 tauntSec초). 끝나면 0부터. 악몽은 게이지가 mythicRate배 빨리 참.
   * from = 이 페이즈가 되어야 게이지가 생김 (심연의 군주 3페이즈)
   */
  watch?: { cap: number; sec: number; tauntSec?: number; every: number; dmg: number; mythicRate?: number; from?: number };
}

const AUTO = (dmg: number): SkillDef => ({ key: 'auto', hidden: true, first: 2, period: 2, cast: 0, effect: { p: 'auto', dmg } });
const BUSTER = (name: string, icon: string, first: number, period: number, dmg: number): SkillDef =>
  ({ key: 'buster', name, icon, kind: 'buster', first, period, cast: 2, warn: 'buster', dmg, target: 'tank', effect: { p: 'tank' } });
/** 탱커 교대 버스터 (P-TANK + P-SWAP, 46 4장): 12초마다 2초 예고, 맞은 탱커에게 받는 피해 +12% 자국 (20초), 3중첩이면 다른 탱커가 가져감 */
const SWAP_BUSTER = (name: string, icon: string, mark: string, dmg: number): SkillDef =>
  ({ key: 'buster', name, icon, kind: 'buster', first: 8, period: 12, cast: 2, warn: 'buster', dmg, target: 'tank',
    effect: { p: 'tank', debuff: { name: mark, type: '물리', left: 20, lock: true, stackMax: 3, vuln: 0.12, swap: 3 } } });
/** 독 거품 (P-SWELL, 46 4-1): left초, 4초마다 1중첩 (최대 max). 지우면 이웃 중첩 × 딜체 6%, 두면 본인 × 12% + 이웃 × 8%. x = 탐험판 배율 */
const bubble = (left: number, max: number, x = 1): DebuffDef =>
  ({ name: '독 거품', type: '독', left, swell: { every: 4, max }, end: { p: 'pop', pop: U.dps(0.06 * x), self: U.dps(0.12 * x), near: U.dps(0.08 * x) } });
const BUBBLE_HOW = '시간이 갈수록 거품이 커짐. 지우면 옆 칸 사람만 조금, 두면 본인과 옆 칸이 크게 터짐. 1~2중첩이고 옆이 비었을 때 지우기';
/** 독 거품 페이즈 · 악몽 변화 (페이즈마다 인원, 악몽은 5중첩 20초 · 중첩당 피해 80%: 못 지우는 사제도 5중첩을 버팀): 같은 타이머라 [페이즈, 인원] × 악몽 아님/악몽 */
const bubbles = (byPhase: [number, number][], first: number, period: number): SkillDef[] => byPhase.flatMap(([phase, n]) =>
  ([false, true] as const).map((mythic): SkillDef => ({
    key: `bubble${phase}${mythic ? 'm' : ''}`, name: '독 거품', icon: '거품', kind: 'instant', first, period, cast: 0, when: { phase: [phase], mythic }, how: BUBBLE_HOW,
    effect: { p: 'debuff', n, pick: 'others', debuff: mythic ? bubble(20, 5, 0.8) : bubble(16, 4) },
  })));
/**
 * 동전 뒤집기 (P-FLIP, 46 4-3): 10초 뒤 체력 비율이 뒤집힘 (가장 낮아도 5%), 지우면 사라짐.
 * 걸린 동안 초당 딜체 4%가 빠져 (10초에 40%) 힐을 멈추면 가득 찬 사람도 60%쯤 → 40%로 뒤집힘. 계속 채우면 5%까지 떨어짐
 */
const COIN: DebuffDef = { name: '동전 뒤집기', type: '저주', left: 10, dot: U.dps(0.04), end: { p: 'flip' } };
const COIN_HOW = '끝날 때 체력 비율이 뒤집힘 (90% → 10%). 걸린 동안 체력이 조금씩 빠지니 힐을 멈추고 두면 반쯤에서 뒤집힘. 저주를 지우는 직업은 지움';
const INK_HOW = '체력이 일정 비율까지만 참 (물통에 먹물 선). 상한까지는 채워 두고, 큰 피해가 오기 전에 보호막 · 해제';
/**
 * 포자 솜뭉치 (P-PASS, 48 3-1): 치유 흡수 막 딜체 40% + 초당 딜체 1%, 14초. 지우면 남은 막이 가장 건강한 다른 아군에게 (시간 처음부터),
 * 두면 끝날 때 남은 막만큼 피해. x = 배율 (탐험판 0.7, 악몽 막 55%)
 */
const spore = (x = 1): DebuffDef =>
  ({ name: '포자 솜뭉치', type: '질병', left: 14, dot: U.dps(0.01 * Math.min(1, x)), absorb: U.dps(0.4 * x), end: { p: 'pass', sec: 14 } });
const SPORE_HOW = '치유를 빨아들이는 솜뭉치. 지우면 체력 비율이 가장 높은 아군에게 넘어감. 붙은 사람이 낮으면 지워서 넘기고, 건강한 사람 몸에서 힐로 녹이기';
/** 모자 뽑기 (48 3-1 ②): 뒤집힌 축복 실크해트 · 치유 상한 고깔모자 · 완치 왕관 모자 (못 지움, 걸릴 때 딜체 30%를 떨어뜨림) */
const HAT_CROWN: DebuffDef = { name: '왕관 모자', type: '마법', left: 12, lock: true, cureAt: 1, drop: U.dps(0.3), end: { p: 'hit', dmg: U.dps(0.45) }, art: 'icon-gim-hat-full', fx: 'hat-drop' };
const HATS: DebuffDef[] = [
  { name: '실크해트', type: '마법', left: 8, invert: true, art: 'icon-gim-hat-invert', fx: 'hat-drop' },
  { name: '고깔모자', type: '마법', left: 12, cap: 0.7, art: 'icon-gim-hat-cap', fx: 'hat-drop' },
  HAT_CROWN,
];
/** 악몽: 왕관 모자가 끝나면 딜체 60% */
const HATS_MYTHIC: DebuffDef[] = [HATS[0], HATS[1], { ...HAT_CROWN, end: { p: 'hit', dmg: U.dps(0.6) } }];
const HAT_HOW = '모자가 셋 중 하나. 실크해트 = 힐하면 아픔 (힐 멈춤) · 고깔모자 = 70%까지만 참 (지우거나 보호막) · 왕관 모자 = 100%까지 채우면 벗겨짐 (못 지움, 진동 전에 몰아서)';
const RING_HOW = '고리 안에 선 사람이 치유를 받으면 고리가 자람. 파티원이 걸어 나올 때까지 힐을 미루고, 광역 힐은 고리를 피해서. 위급하면 예외';
/** 춤바람 (P-FULL + 딜 0, 48 4-1): 체력을 65%로 떨어뜨리고 12초 춤 (딜 0 · 못 움직임), 가득 차면 멈춤 · 해제 가능, 다 되면 어질어질 */
const DANCE: DebuffDef = { name: '춤바람', type: '마법', left: 12, noDps: true, noMove: true, cureAt: 1, drop: U.dps(0.41), end: { p: 'hit', dmg: U.dps(0.3) }, fx: 'dance' };
const DANCE_HOW = '체력을 35% 깎고 (근접은 덜) 12초 동안 춤만 춤 (딜 0 · 못 움직임). 가득 채우거나 지우면 바로 멈춤. 쫄이 나와 있으면 춤추는 딜러부터';
/** 녹는 보호막 (P-MELT, 51 5장) 공략 글 */
const MELT_HOW = '열기 동안 보호막 · 외부 생존기가 빨리 녹음. 미리 걸지 말고 큰 피해 예고가 거의 끝날 때. 지속 힐은 미리 깔기';
/** 보물 욕심 (P-GREED, 51 5장) 공략 글 */
const GREED_HOW = '예고 때 체력 비율이 가장 높은 사람이 맞음 (탱커 · 나 빼고). 모두를 가득 채우지 말고, 예고된 사람에게 직전 보호막 · 맞은 뒤 힐';
/**
 * 보물 욕심 기술 묶음: [페이즈, 인원]마다 (키 `${key}${페이즈}` · 악몽 `…m`). 첫 페이즈만 first, 나머지는 흐름 start로 엶.
 * debuff = 맞은 사람에게 (무거운 주머니), mythic = 악몽만 맞은 사람에게 (그을음 · 털린 주머니, 있으면 악몽 아님 / 악몽 두 개). 페이즈가 하나면 키에 페이즈를 안 붙임
 */
const greeds = (key: string, name: string, icon: string, first: number, period: number, cast: number, byPhase: readonly (readonly [number, number])[], dmg: number, debuff?: DebuffDef, mythic?: DebuffDef): SkillDef[] =>
  byPhase.flatMap(([phase, n], i) => (mythic ? [false, true] : [undefined]).map((m): SkillDef => ({
    key: `${key}${byPhase.length > 1 ? phase : ''}${m ? 'm' : ''}`, name, icon, kind: 'buster', first: i === 0 ? first : null, period, cast, warn: 'buster', how: GREED_HOW,
    when: byPhase.length > 1 || m != null ? { ...(byPhase.length > 1 ? { phase: [phase] } : {}), ...(m != null ? { mythic: m } : {}) } : undefined,
    target: { p: 'greed', n }, effect: { p: 'greed', dmg, debuff: m ? mythic : debuff },
  })));
/** 줄 불길 불씨 (51 3-1): 받는 치유 −25% */
const EMBER: DebuffDef = { name: '불씨', type: '마법', left: 6, healCut: 0.25 };
/** 악몽 불퉁이: 반짝이에 맞은 사람에게 그을음 (독) */
const SOOT: DebuffDef = { name: '그을음', type: '독', left: 10, dot: U.dps(0.02) };
/** 덜컹이 금화 던지기: 무거운 주머니 (받는 피해 +15%) */
const PURSE: DebuffDef = { name: '무거운 주머니', type: '물리', left: 8, lock: true, vuln: 0.15 };
/** 악몽 번쩍이: 털린 주머니 (받는 피해 +15%, 사냥까지 맞기 쉬움) */
const ROBBED: DebuffDef = { name: '털린 주머니', type: '물리', left: 6, lock: true, vuln: 0.15 };
/** 새끼 용 삼남매 (51 4-2): 몸통 셋, 체력은 encounters whelps hp를 셋으로 나눔 */
const WHELPS = ['화르', '르륵', '퐁퐁'];
const WHELP_HP = 7800;
/** 물그림자 기사 셋 (51 4-3): 몸통 셋, 체력은 encounters knights hp를 셋으로 나눔 */
const KNIGHTS = ['창 기사', '방패 기사', '검 기사'];
const KNIGHT_HP = 16500;
/** 그림자 손길 (51 4-3 오르말): 질병 · 독 · 저주 · 마법 중 사람마다 무작위 하나 */
const SHADOW_TOUCH: DebuffDef[] = [
  { name: '시드는 그림자', type: '질병', left: 12, maxCut: 0.08, end: { p: 'restoreMax' } },
  { name: '쓴 그림자', type: '독', left: 12, dot: U.dps(0.02) },
  { name: '무거운 그림자', type: '저주', left: 10, healCut: 0.4 },
  { name: '차가운 그림자', type: '마법', left: 8, dot: U.dps(0.02) },
];
/** 졸린 모래 병정 꾸벅 · 끄덕 (54 4-1): 몸통 둘, 체력은 encounters kkubeok hp를 둘로 나눔 */
const GUARDS = ['꾸벅', '끄덕'];
const GUARD_HP = 12000;
/** 모래 왕국 (54 0장) 해제 짝: 모래 기침 (질병, 초당 딜체 2%) · 천 년 졸음 (저주, 받는 치유 −30%) */
const SAND_COUGH: DebuffDef = { name: '모래 기침', type: '질병', left: 12, dot: U.dps(0.02) };
const SLEEPY: DebuffDef = { name: '천 년 졸음', type: '저주', left: 8, healCut: 0.3, fx: 'yawn' };
const SPRITES = ['솔솔', '살살']; const SPRITE_HP = 11650;
const SAND_CHAIN_HOW = '두 쌍 (악몽 세 쌍)이 이어짐. 짝끼리 체력 비율을 비슷하게. 모래시계 창 안에서는 안 끊기고, 되돌린 뒤 다시 재니 뒤집기 전에 짝을 맞춰 두기';
const MIRAGE_HOW = '표시 가운데 하나는 신기루 (끝 1초에 일렁이며 걷힘). 걷히기 전에는 지속 힐 · 작은 힐만, 걷히면 남은 진짜에게 바로 보호막 · 큰 힐';
const GLASS_HOW = '뒤집는 순간의 체력으로 8초 뒤 모두 되돌아감. 예고 3초 안에 모두 채우고, 창 안에서는 쓰러질 사람만 힐 (붕대 벗기기 · 해제는 남음)';
/** 벌침 (P-WOUND, 48 4-3): 꿀벌이 쏜 사람이 90% 아래인 동안 3초마다 1중첩 (중첩당 초당 딜체 1%), 못 지움 */
const sting = (max: number): DebuffDef => ({ name: '벌침', type: '물리', left: 20, lock: true, cureAt: 0.9, grow: { every: 3, dot: U.dps(0.01), max }, fx: 'bee-sting' });
/** 못 피하는 줄 피해 (P-ROW): 뒷줄 → 가운데 → 앞줄을 period초마다 번갈아. two = 2페이즈부터 다른 한 줄을 같이 (조건을 주면 그때: 악몽 단단이 { mythic: true }) */
const rows = (key: string, name: string, icon: string, first: number, period: number, dmg: number, two: boolean | SkillWhen): SkillDef[] => {
  const at = ['back', 'mid', 'front'] as const;
  const twoWhen = two === true ? { phase: [2] } : two || undefined;
  return [0, 1, 2].flatMap((i): SkillDef[] => {
    const one = (k: string, line: (typeof at)[number], when?: SkillWhen): SkillDef => ({
      key: k, name, icon, kind: 'zone', first: first + period * i, period: period * 3, cast: 3, warn: 'zone', fixed: true, hitDmg: dmg, cells: { p: 'line', at: line }, when,
      how: '그 줄에 선 사람이 맞음 (못 피함). 예고된 줄을 미리 채우기',
    });
    return twoWhen ? [one(`${key}${i}`, at[i]), one(`${key}${i}b`, at[(i + 1) % 3], twoWhen)] : [one(`${key}${i}`, at[i])];
  });
};

/** 유령 성가대 수치 (26 4-3, 보통 기준. 피해는 난이도·단계 배율을 곱함) */
export const CHOIR = {
  voices: ['높은 성부', '가운데 성부', '낮은 성부'], voiceHp: 4000, bossHp: 30000,
  auto: 70, baton: 600, song: 4, crescDps: 35, discord: 0.7, forte: 170, soloN: 3, soloSec: 6, soloDmg: 200,
};

/** 전염이 터질 때 (26 3-1): 이웃 칸에 피해 + 독침 */
export const SPREAD = { dmg: 150, debuff: { name: '독침', type: '독', left: 12, dot: 15 } satisfies DebuffDef };

/** 보스 기술 (05, 23, 26). 일반·정예 구간(trash)은 encounters.ts의 적 목록 */
export const BOSSES: Record<Exclude<ScriptKey, 'trash'>, BossDef> = {
  // 고철 경비병 (23 3장): 문지기를 순하게 줄인 첫 보스. 탱커 버스터 + 광역만
  scrap: {
    phase: [1, ''],
    skills: [
      AUTO(75),
      BUSTER('고철 휘두르기', '휘두', 10, 16, 450),
      { key: 'aoe', name: '쇳조각 비', icon: '쇳조', kind: 'aoe', first: 20, period: 22, cast: 3, warn: 'aoe', cut: true, effect: { p: 'all', dmg: 170 } },
    ],
    enrage: { name: '고철 폭주', period: 2, dmg: 150 },
  },
  // 뼈다귀 수집가 탐험판 (35 4-8, 탐험 ② 잿빛 공동묘지 Lv 3): 던전 ② 보스 (35 4-1)의 평타 · 갈고리 끌기 · 등불 흔들기만. 끌어당김 예습. 세기는 고철 순찰병보다 조금 위
  collector3: {
    phase: [1, ''],
    skills: [
      AUTO(80),
      { key: 'pull', name: '갈고리 끌기', icon: '끌기', kind: 'buster', first: 12, period: 22, cast: 2, warn: 'buster', target: { p: 'back', n: 1 }, effect: { p: 'pull', sec: 6, dmg: 260 } },
      { key: 'aoe', name: '등불 흔들기', icon: '등불', kind: 'aoe', first: 20, period: 24, cast: 3, warn: 'aoe', cut: true, effect: { p: 'all', dmg: 190 } },
    ],
    enrage: { name: '뼈다귀 폭주', period: 2, dmg: 150 },
  },
  // 늪 주술사 탐험판 (35 4-8, 탐험 ③ 늪지 어귀 Lv 8): 던전 ③ 보스 (35 4-2)의 평타 · 늪 거머리 · 조롱박 독침만. 완치 표식 예습 (채워서 떼어 냄)
  shaman8: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      { key: 'leech', name: '늪 거머리', icon: '거머', kind: 'instant', first: 8, period: 20, cast: 0,
        how: '가장 다친 사람에게 붙음. 해제 불가, 체력을 100%까지 채우면 떨어짐, 15초 두면 크게 아픔',
        effect: { p: 'debuff', n: 1, pick: 'lowest', debuff: { name: '늪 거머리', type: '독', left: 15, dot: 25, lock: true, cureAt: 1, end: { p: 'hit', dmg: 200 } } } },
      { key: 'dart', name: '조롱박 독침', icon: '독침', kind: 'instant', first: 14, period: 15, cast: 0, cut: true,
        effect: { p: 'debuff', n: 2, debuff: { name: '조롱박 독침', type: '독', left: 10, dot: 22 } } },
      { key: 'aoe', name: '독안개 숨', icon: '안개', kind: 'aoe', first: 22, period: 24, cast: 3, warn: 'aoe', cut: true, effect: { p: 'all', dmg: 170 } },
    ],
    enrage: { name: '늪의 분노', period: 2, dmg: 150 },
  },
  // 집사 유령 탐험판 (35 4-8, 탐험 ④ 백합 정원 Lv 13): 던전 ④ 보스 (35 4-3 ①)의 평타 · 은쟁반 · 차례대로 모시기 (①② 두 칸: 원거리 · 나). 차례 예습
  butler13: {
    phase: [1, ''],
    skills: [
      AUTO(80),
      BUSTER('은쟁반', '쟁반', 8, 18, 350),
      { key: 'order', name: '차례대로 모시기', icon: '차례', kind: 'instant', first: 15, period: 30, cast: 2,
        how: '번호 순서대로 직접 힐을 한 번씩. 빠른 힐로 순서를 빨리',
        effect: { p: 'order', n: 2, sec: 8, wrong: 130, miss: 105, daze: { sec: 4, vuln: 1.2 } } },
    ],
    enrage: { name: '접대 끝', period: 2, dmg: 160 },
  },
  // 뼈다귀 수집가 (35 4-1 ①, 던전 ② 역병 지하묘지): 끌어당김 처음 · 자루 쏟기 (되살아난 뼈, 쓰러지면 맡던 사람에게 부패). 목표 2:00 · 광폭화 2:45
  collector: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('갈고리 내려치기', '내려', 8, 18, U.tank(0.5)),
      { key: 'pull', name: '갈고리 끌기', icon: '끌기', kind: 'buster', first: 14, period: 25, cast: 2, warn: 'buster', target: { p: 'back', n: 1, nMythic: 2 },
        effect: { p: 'pull', sec: 6, dmg: U.dps(0.1) } },
      { key: 'adds', name: '자루 쏟기', icon: '자루', kind: 'instant', first: 20, period: 35, cast: 0,
        effect: { p: 'adds', n: 2, add: { name: '되살아난 뼈', short: '뼈', art: 'mob-risen-bones', hp: 0.04, dmg: U.dps(0.03), every: 2,
          down: { p: 'debuff', debuff: { name: '부패', type: '질병', left: 20, maxCut: 0.1, end: { p: 'restoreMax' } } } } } },
      { key: 'aoe', name: '등불 흔들기', icon: '등불', kind: 'aoe', first: 26, period: 30, cast: 3, warn: 'aoe', cut: true, effect: { p: 'all', dmg: U.dps(0.25) } },
    ],
    enrage: { name: '뼈다귀 폭주', period: 2, dmg: 200 },
  },
  // 역병 사제 말코어 (35 4-1 ②, 최종): 쇠약 처음 (50% 아래 병든 맥박). 썩은 축복은 두면 최대 체력이 줄어 90% 선을 넘기 쉬워짐. 목표 2:40 · 광폭화 3:30
  malchor: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      { key: 'bless', name: '썩은 축복', icon: '축복', kind: 'instant', first: 5, period: 10, cast: 0, when: { mythic: false },
        effect: { p: 'rot', n: 1, debuff: { name: '썩은 축복', type: '질병', left: 30, end: { p: 'restoreMax' } }, pct: 0.08, max: 4, again: 0.6 } },
      { key: 'bless2', name: '썩은 축복', icon: '축복', kind: 'instant', first: 5, period: 10, cast: 0, when: { mythic: true },
        effect: { p: 'rot', n: 2, debuff: { name: '썩은 축복', type: '질병', left: 30, end: { p: 'restoreMax' } }, pct: 0.08, max: 4, again: 0.6 } },
      { key: 'smoke', name: '향로 연기', icon: '연기', kind: 'zone', first: 12, period: 25, cast: 2.5, warn: 'zone', dps: U.dps(0.04), dur: 2, cells: { p: 'flow', every: 2 } },
      { key: 'aoe', name: '교단의 기도', icon: '기도', kind: 'aoe', first: 20, period: 28, cast: 3, warn: 'aoe', cut: true, effect: { p: 'all', dmg: U.dps(0.3) } },
      { key: 'pulse', name: '병든 맥박', icon: '맥박', kind: 'aoe', first: null, period: 40, cast: 3, warn: 'aoe',
        how: '해제 불가. 체력 90% 이상이면 바로 사라짐. 썩은 축복을 두면 최대 체력이 줄어 채우기 쉬움',
        effect: { p: 'debuff', n: 'all', debuff: { name: '쇠약', type: '질병', left: 20, lock: true, cureAt: 0.9, grow: { every: 3, dot: U.dps(0.01), max: 5 } } } },
    ],
    flow: [{ p: 'when', if: { idle: 'pulse', hpBelow: 0.5 }, do: [{ p: 'start', skill: 'pulse', in: 3 }, { p: 'text', text: '병든 맥박: 체력 90% 위로 채우면 나음' }] }],
    enrage: { name: '역병 폭주', period: 2, dmg: 220 },
  },
  // 마력 골렘 탐험판 (35 4-8, 탐험 ⑤ 눈보라 고개 Lv 18): 던전 ⑤ 보스 (35 4-4 ①)의 평타 · 룬 주먹 · 룬 진동만. 진동 예습 (울릴 때 새 시전 멈추기)
  golem18: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      BUSTER('룬 주먹', '주먹', 8, 16, 385),
      { key: 'quake', name: '룬 진동', icon: '진동', kind: 'aoe', first: 12, period: 15, cast: 2, warn: 'aoe', effect: { p: 'quake', dmg: 50, lock: 3 } },
    ],
    enrage: { name: '룬 폭주', period: 2, dmg: 170 },
  },
  // 신전 수호상 탐험판 (35 4-8, 탐험 ⑥ 해바라기 언덕길 Lv 23): 던전 ⑥ 보스 (35 4-5 ①)의 평타 · 돌가루 · 우르릉 힘 모으기만. 무력화 예습 (게이지는 파티 딜에 맞춰 3인으로)
  guardian23: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      { key: 'dust', name: '돌가루', icon: '돌가', kind: 'instant', first: 16, period: 22.5, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '돌가루', type: '마법', left: 6, noDps: true } } },
      { key: 'stagger', name: '우르릉 힘 모으기', icon: '우르', kind: 'instant', first: 20, period: 45, cast: 0,
        how: '10초 동안 체력 70% 이상인 파티원의 딜만 게이지를 채움. 광역 · 지속 힐로 전원을 70% 위로, 돌가루 (침묵)는 지우기',
        effect: { p: 'stagger', sec: 10, need: 7, hp: 0.7, hpMythic: 0.8, tank: 2, win: { sec: 8, vuln: 1.3 }, fail: { dmg: 275, lock: 3 } } },
    ],
    enrage: { name: '돌 폭주', period: 2, dmg: 180 },
  },
  // 늪 주술사 (35 4-2 ①, 던전 ③ 독안개 늪): 완치 표식 처음 (늪 거머리, 악몽 2명) · 진흙 토템 (독 오라). 목표 2:00 · 광폭화 2:45
  shaman: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.05)),
      { key: 'dart', name: '조롱박 독침', icon: '독침', kind: 'instant', first: 10, period: 15, cast: 0, cut: true,
        effect: { p: 'debuff', n: 2, debuff: { name: '조롱박 독침', type: '독', left: 10, dot: U.dps(0.025) } } },
      { key: 'leech', name: '늪 거머리', icon: '거머', kind: 'instant', first: 6, period: 20, cast: 0,
        how: '가장 다친 사람에게 붙음. 해제 불가, 체력을 100%까지 채우면 떨어짐, 15초 두면 크게 아픔',
        effect: { p: 'debuff', n: 1, nMythic: 2, pick: 'lowest', debuff: { name: '늪 거머리', type: '독', left: 15, dot: U.dps(0.03), lock: true, cureAt: 1, end: { p: 'hit', dmg: U.dps(0.2) } } } },
      { key: 'totem', name: '진흙 토템', icon: '토템', kind: 'instant', first: 18, period: 30, cast: 2,
        effect: { p: 'adds', n: 1, add: { name: '진흙 토템', short: '토템', art: 'mob-mud-totem', hp: 0.05, dmg: 0, every: 2, aura: U.dps(0.015), at: 'random' } } },
    ],
    enrage: { name: '늪의 분노', period: 2, dmg: 200 },
  },
  // 거대 두꺼비 부글이 (35 4-2 ②): 피난처 처음 (배치기) · 삼키기 (딜 0 · 위산, 힐은 들어감, 보스 4% 깎거나 8초면 뱉음). 목표 2:30 · 광폭화 3:15
  toad: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      BUSTER('혀 채찍', '혀채', 8, 16, U.tank(0.55)),
      { key: 'swallow', name: '삼키기', icon: '삼킴', kind: 'buster', first: 14, period: 30, cast: 2, warn: 'buster', target: { p: 'back', n: 1 },
        how: '삼켜진 사람은 딜 0 · 위산 피해. 힐은 들어가니 단일 힐로 버티게. 보스를 4% 깎거나 8초면 나옴',
        effect: { p: 'debuff', n: 1, pick: 'tel', debuff: { name: '삼키기', type: '물리', left: 8, dot: U.dps(0.05), lock: true, hide: true, noMove: true, noDps: true, untilBossLoss: 0.04 } } },
      { key: 'belly', name: '배치기', icon: '배치', kind: 'zone', first: 25, period: 35, cast: 4, warn: 'zone', hitDmg: U.dps(0.6), cells: { p: 'safe', at: 'edge', n: 6 },
        how: '파티원이 금빛 바깥 칸으로 피함. 늦는 사람 (칸 흔들림)에게 미리 보호막 · 지속 힐' },
      { key: 'aoe', name: '독 혹 터뜨리기', icon: '독혹', kind: 'aoe', first: 20, period: 28, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
      { key: 'boil', name: '독 혹', hidden: true, first: 23, period: 28, cast: 0,
        effect: { p: 'debuff', n: 'all', debuff: { name: '독 혹', type: '독', left: 8, dot: U.dps(0.015), stackMax: 3 } } },
    ],
    enrage: { name: '부글부글', period: 2, dmg: 220 },
  },
  // 늪 족장 세레스 (35 4-2 ③, 최종): 헤매는 영혼 (오염된 늪 정령, 악몽 2마리) · 사냥 창 처음 · 50% 아래 가라앉는 섬. 목표 3:00 · 광폭화 4:00
  seres: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('나무창 찌르기', '찌르', 8, 18, U.tank(0.5)),
      { key: 'hunt', name: '사냥 창', icon: '사냥', kind: 'instant', first: 12, period: 20, cast: 2, effect: { p: 'hunt', dmg: U.dps(0.45) } },
      { key: 'venom', name: '늪의 맹독', icon: '맹독', kind: 'instant', first: 6, period: 14, cast: 0, cut: true,
        effect: { p: 'debuff', n: 2, debuff: { name: '늪의 맹독', type: '독', left: 12, dot: U.dps(0.015), stackMax: 3 } } },
      ...(['spirit', 'spirit2'] as const).map((key, i): SkillDef => ({
        key, name: '오염된 늪 정령', icon: '정령', kind: 'instant', first: 25, period: 35, cast: 0, when: i ? { mythic: true } : undefined,
        effect: { p: 'soul', name: '오염된 늪 정령', short: '정령', art: 'mob-swamp-spirit', hp: 0.25, sec: 12, type: '독',
          win: { text: '정화의 물: 독 하나씩 지움 · 받는 치유 +15%', cure: '독', heal: { pct: 0.15, sec: 8 } },
          fail: { text: '오염 분출', dmg: U.dps(0.3), near: true, debuff: { name: '늪의 맹독', type: '독', left: 12, dot: U.dps(0.015), stackMax: 3 } } },
      })),
      { key: 'sink', name: '가라앉는 섬', icon: '섬', kind: 'instant', first: null, period: 30, cast: 2, effect: { p: 'hole', n: 1, max: 3 } },
    ],
    flow: [{ p: 'when', if: { idle: 'sink', hpBelow: 0.5 }, do: [{ p: 'start', skill: 'sink', in: 2 }, { p: 'text', text: '가라앉는 섬: 가장자리 칸이 늪에 잠김' }] }],
    enrage: { name: '족장의 분노', period: 2, dmg: 240 },
  },
  // 집사 유령 (35 4-3 ①, 던전 ④ 저주받은 장원): 차례 (①②③, 악몽 ④) · 촛불 · 등 뒤 인사 (뒷줄) · 얼룩진 장갑 ✋. 목표 2:15 · 광폭화 3:00
  butler: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('은쟁반', '쟁반', 8, 18, U.tank(0.5)),
      { key: 'order', name: '차례대로 모시기', icon: '차례', kind: 'instant', first: 15, period: 30, cast: 2,
        how: '번호 순서대로 직접 힐을 한 번씩. 빠른 힐로 순서를 빨리, 받는 치유가 깎인 사람도 횟수로 셈',
        effect: { p: 'order', n: 3, nMythic: 4, sec: 8, wrong: U.dps(0.3), miss: U.dps(0.25), daze: { sec: 4, vuln: 1.2 } } },
      { key: 'candle', name: '촛불', icon: '촛불', kind: 'zone', first: 10, period: 20, cast: 2.5, warn: 'zone', dps: U.dps(0.05), dur: 6, cells: { p: 'around' } },
      { key: 'bow', name: '등 뒤 인사', icon: '인사', kind: 'zone', first: 22, period: 25, cast: 3, warn: 'zone', hitDmg: U.dps(0.3), cells: { p: 'line', at: 'back' },
        how: '집사가 판 아래로 사라졌다가 뒷줄을 침. 파티원이 앞으로 비키니 늦는 사람을 채우기' },
      { key: 'glove', name: '얼룩진 장갑', icon: '장갑', kind: 'instant', first: 8, period: 18, cast: 0, cut: true,
        effect: { p: 'debuff', n: 1, debuff: { name: '얼룩진 장갑', type: '저주', left: 12, healCut: 0.5 } } },
    ],
    enrage: { name: '접대 끝', period: 2, dmg: 220 },
  },
  // 초상화 속 귀부인 (35 4-3 ②): 매혹 (힐하면 길어짐, 악몽 2명) · 저주 실 (균형형) · 초상화의 눈 ✋ · 50%에 액자로 (12초 무적, 빈 액자 2개). 목표 2:30 · 광폭화 3:15
  lady: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.05)),
      { key: 'charm', name: '매혹', icon: '매혹', kind: 'instant', first: 10, period: 25, cast: 2, when: { phase: [1, 2] },
        how: '매혹된 사람은 이웃을 때림. 힐하면 지배가 길어지니 저주를 못 지우면 그 사람 힐을 멈추고 이웃을 채우기 (체력 50% 아래면 풀림)',
        effect: { p: 'debuff', n: 1, nMythic: 2, pick: 'others', debuff: { name: '매혹', type: '저주', left: 8, noDps: true, charm: { every: 2, dmg: U.dps(0.1), heal: 1, free: 0.5 } } } },
      { key: 'thread', name: '저주 실', icon: '실', kind: 'instant', first: 22, period: 30, cast: 0, when: { phase: [1, 2] },
        effect: { p: 'link', kind: 'balance', name: '저주 실', sec: 12, gap: 0.3, dmg: U.dps(0.35) } },
      { key: 'aoe', name: '초상화의 눈', icon: '눈', kind: 'aoe', first: 16, period: 30, cast: 3, warn: 'aoe', cut: true, when: { phase: [1, 2] }, effect: { p: 'all', dmg: U.dps(0.2) } },
      { key: 'gaze', name: '초상화의 눈', hidden: true, first: 19, period: 30, cast: 0, when: { phase: [1, 2] },
        effect: { p: 'debuff', n: 'all', debuff: { name: '초상화의 눈', type: '저주', left: 4, healCut: 0.25 } } },
      { key: 'frames', name: '빈 액자', icon: '액자', kind: 'instant', first: null, period: 999, cast: 0, when: { phase: [0] },
        effect: { p: 'adds', n: 2, add: { name: '빈 액자', short: '액자', art: 'mob-empty-frame', hp: 0.03, dmg: 0, every: 2, at: 'random', job: { p: 'pylon', cut: 0.5 } } } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [
        { p: 'phase', n: 0, name: '액자로' }, { p: 'inter', sec: 12 }, { p: 'start', skill: 'frames', in: 0 }, { p: 'text', text: '액자로: 귀부인이 초상화로 돌아감. 빈 액자를 깨기' },
      ] },
      { p: 'when', if: { phase: 0, interOver: true }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'interEnd' }] },
    ],
    enrage: { name: '그림 밖으로', period: 2, dmg: 220 },
  },
  // 장원 주인 벨모어 경 (35 4-3 ③, 최종): 뒤집힌 축복 (받는 치유가 피해로) · 가문의 반지 ⚠ (지우면 이웃 칸 폭발) · 젊음의 갈망 ✋ (가장 낮은 사람에게서 흡수 → 보스 회복). 30%부터 축복 2명. 목표 3:00 · 광폭화 4:00
  belmore: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      BUSTER('지팡이 칼', '지팡', 8, 18, U.tank(0.6)),
      ...([[1, 1, 10, 20], [2, 2, null, 15]] as const).map(([ph, n, first, period]): SkillDef => ({
        key: ph === 1 ? 'invert' : 'invert2', name: '뒤집힌 축복', icon: '뒤집', kind: 'instant', first, period, cast: 0, when: { phase: [ph] },
        how: '받는 치유가 피해로. 지울 수 있으면 지우고, 못 지우면 그 사람에게 힐하지 말고 보호막 · 생존기',
        effect: { p: 'debuff', n, pick: 'others', debuff: { name: '뒤집힌 축복', type: '저주', left: 8, invert: true } },
      })),
      { key: 'ring', name: '가문의 반지', icon: '반지', kind: 'instant', first: 16, period: 22, cast: 0,
        how: '함정. 지우면 이웃 칸이 터지니 두고 그 사람을 채워 버티기',
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '가문의 반지', type: '저주', left: 10, trap: true, end: { p: 'trapHit', dmg: U.dps(0.4), burst: U.dps(0.3) } } } },
      { key: 'youth', name: '젊음의 갈망', icon: '갈망', kind: 'instant', first: 20, period: 25, cast: 3, cut: true,
        how: '체력 비율이 가장 낮은 사람에게서 빨아들여 보스가 회복. 예고 동안 낮은 사람을 채우기',
        effect: { p: 'debuff', n: 1, pick: 'lowest', debuff: { name: '젊음의 갈망', type: '물리', left: 4, dot: U.dps(0.08), lock: true, feed: 0.5 } } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.3 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'invert2', in: 2 }, { p: 'text', text: '무너지는 젊음: 뒤집힌 축복 2명' }] }],
    enrage: { name: '젊음의 폭주', period: 2, dmg: 240 },
  },
  // 마력 골렘 (35 4-4 ①, 던전 ⑤ 서리 마탑): 진동 처음 (악몽 2초 간격 두 번) · 얼음 룬 감옥 ✋ · 수정 핵 과열 (쓸 때마다 커짐). 목표 2:15 · 광폭화 3:00
  frostgolem: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      BUSTER('룬 주먹', '주먹', 19.5, 15, U.tank(0.48)), // 진동 (14 + 15k초) 사이 가운데에 맞음
      ...([['quake', 12, undefined], ['quake2', 14, true]] as const).map(([key, first, mythic]): SkillDef => ({
        key, name: '룬 진동', icon: '진동', kind: 'aoe', first, period: 15, cast: 2, warn: 'aoe', when: mythic ? { mythic: true } : undefined,
        effect: { p: 'quake', dmg: U.dps(0.12), lock: 3 },
      })),
      { key: 'jail', name: '얼음 룬 감옥', icon: '감옥', kind: 'instant', first: 8, period: 18, cast: 0, cut: true,
        effect: { p: 'debuff', n: 1, debuff: { name: '얼음 룬 감옥', type: '마법', left: 6, noDps: true, noMove: true } } },
      { key: 'core', name: '수정 핵 과열', icon: '과열', kind: 'aoe', first: 34, period: 60, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.35), grow: U.dps(0.1) } },
    ],
    enrage: { name: '룬 폭주', period: 2, dmg: 220 },
  },
  // 불안정한 마법사 (35 4-4 ②): 역류 처음 (내 스킬마다 중첩, 지우면 그때까지 터짐) · 불안정한 마력 ⚠ (두든 지우든 이웃 칸) · 얼음 파편 연사 (사냥) · 50% 폭주. 목표 2:30 · 광폭화 3:15
  mage: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.05)),
      { key: 'unstable', name: '불안정한 마력', icon: '마력', kind: 'instant', first: 10, period: 20, cast: 0,
        how: '함정. 8초 뒤 이웃 칸이 터지고 지우면 바로 터짐. 두고 이웃 칸 사람을 채우기',
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '불안정한 마력', type: '마법', left: 8, trap: true, end: { p: 'blast', dmg: U.dps(0.35) } } } },
      ...([['recoil', U.me(0.07), false], ['recoil2', U.me(0.09), true]] as const).map(([key, dmg, mythic]): SkillDef => ({
        key, name: '마력 역류', icon: '역류', kind: 'instant', first: 15, period: 30, cast: 0, when: { mythic },
        how: '내 스킬마다 1중첩, 끝날 때 중첩만큼 나에게 피해. 0~1중첩일 때 바로 지우기',
        effect: { p: 'debuff', n: 1, pick: 'me', debuff: { name: '마력 역류', type: '마법', left: 10, count: true, end: { p: 'stackHit', dmg } } },
      })),
      { key: 'shards', name: '얼음 파편 연사', icon: '파편', kind: 'instant', first: 20, period: 18, cast: 2, effect: { p: 'hunt', dmg: U.dps(0.35) } },
      ...(['storm', 'storm2'] as const).map((key, i): SkillDef => ({
        key, name: '폭주', icon: '폭주', kind: 'zone', first: null, period: 20, cast: 2.5, warn: 'zone', dps: U.dps(0.05), dur: 6, cells: { p: 'around' },
        ...(i ? { hidden: true } : {}),
      })),
    ],
    flow: [{ p: 'when', if: { idle: 'storm', hpBelow: 0.5 }, do: [
      { p: 'start', skill: 'storm', in: 2 }, { p: 'start', skill: 'storm2', in: 2.5 }, { p: 'period', skill: 'recoil', sec: 22 }, { p: 'period', skill: 'recoil2', sec: 22 },
      { p: 'text', text: '폭주: 서리 장판 두 곳, 역류가 잦아짐' },
    ] }],
    enrage: { name: '마력 폭발', period: 2, dmg: 220 },
  },
  // 탑주의 그림자 (35 4-4 ③, 최종): 주시 처음 (내 치유량으로 눈 게이지, 악몽 1.3배) · 서리 손길 (탱커 받는 치유 −10% 중첩, 숨 고르기에 사라짐) · 얼어붙는 바닥 → 얼음 기둥 · 침묵의 서리 / 서리 표식. 목표 3:00 · 광폭화 4:00
  shadow: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('서리 손길', '손길', 8, 14, U.tank(0.55)),
      { key: 'frost', name: '서리', hidden: true, first: 10, period: 14, cast: 0,
        effect: { p: 'debuff', n: 1, pick: 'tank', debuff: { name: '서리', type: '마법', left: 60, healCut: 0.1, stackMax: 5, lock: true } } },
      { key: 'rest', name: '숨 고르기', icon: '숨', kind: 'instant', first: 50, period: 50, cast: 0, effect: { p: 'rest', sec: 6, clear: '서리' } },
      { key: 'floor', name: '얼어붙는 바닥', icon: '바닥', kind: 'zone', first: 15, period: 30, cast: 2.5, warn: 'zone', dps: U.dps(0.05), dur: 6, cells: { p: 'around' } },
      { key: 'pillar', name: '얼음 기둥', icon: '기둥', kind: 'instant', first: 23.5, period: 30, cast: 0, effect: { p: 'hole', n: 1, max: 3 } },
      { key: 'silence', name: '침묵의 서리', icon: '침묵', kind: 'instant', first: 12, period: 32, cast: 0,
        effect: { p: 'debuff', n: 2, debuff: { name: '침묵의 서리', type: '마법', left: 6, noDps: true } } },
      { key: 'mark', name: '서리 표식', icon: '표식', kind: 'instant', first: 28, period: 32, cast: 0,
        how: '함정. 끝나거나 지우면 이웃 칸이 터짐. 두고 이웃 칸 사람을 채우기',
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '서리 표식', type: '마법', left: 8, trap: true, end: { p: 'blast', dmg: U.dps(0.3) } } } },
    ],
    watch: { cap: 1.5, sec: 6, tauntSec: 3, every: 1.5, dmg: U.me(0.15), mythicRate: 1.3 },
    enrage: { name: '서리 폭풍', period: 2, dmg: 240 },
  },
  // 신전지기 유령 탐험판 (35 4-8 ⑦, 탐험 ⑦ 무너진 순례길): 평타 · 제단 발판 1곳 · 네 가지 청소약 (받침 · 해제 4유형 예습). 수치는 던전판의 70%
  keeper28: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      { key: 'soap', name: '네 가지 청소약', icon: '청소', kind: 'instant', first: 6, period: 12, cast: 0,
        how: '질병 → 독 → 저주 → 마법 차례로 한 명씩. 지울 수 있는 유형은 지우고, 못 지우는 유형은 힐로 버티기',
        effect: { p: 'cycle', n: 1, debuffs: soaps(0.7) } },
      { key: 'pads', name: '제단 발판', icon: '발판', kind: 'aoe', first: 20, period: 30, cast: 2.5,
        how: '금빛 발판에 들어간 사람이 맞고, 빈 발판이면 전원이 맞음. 들어간 사람을 바로 채우기',
        effect: { p: 'tower', n: 1, dmg: U.dps(0.28), empty: U.dps(0.14) } },
    ],
    enrage: { name: '대청소', period: 2, dmg: 180 },
  },
  // 신전 수호상 (35 4-5 ①, 던전 ⑥ 깨진 신전): 무력화 (전원 70% 위, 악몽 80%) · 반격 틈 ✋ 처음 · 돌가루 (무력화 4초 전에 꼭). 목표 2:45 · 광폭화 3:45
  guardian: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.08)),
      BUSTER('돌 주먹', '주먹', 8, 18, U.tank(0.6)),
      { key: 'dust', name: '돌가루', icon: '돌가', kind: 'instant', first: 16, period: 22.5, cast: 0,
        effect: { p: 'debuff', n: 2, debuff: { name: '돌가루', type: '마법', left: 6, noDps: true } } },
      { key: 'stagger', name: '우르릉 힘 모으기', icon: '우르', kind: 'instant', first: 20, period: 45, cast: 0,
        how: '10초 동안 체력 70% 이상인 파티원의 딜만 게이지를 채움. 광역 · 지속 힐로 전원을 70% 위로, 돌가루 (침묵)는 지우기',
        effect: { p: 'stagger', sec: 10, need: 7, hp: 0.7, hpMythic: 0.8, tank: 2, win: { sec: 8, vuln: 1.3 }, fail: { dmg: U.dps(0.65), lock: 3 } } },
      { key: 'gleam', name: '수정 반짝임', icon: '반짝', kind: 'aoe', first: 37, period: 25, cast: 1.5,
        how: '반격 틈. 끊기 ✋ 능력자가 끊으면 보스가 기절, 못 끊으면 앞줄이 맞음. 끊기 담당의 침묵 · 기절부터 지우기',
        effect: { p: 'counter', stun: 4, dmg: U.dps(0.45) } },
    ],
    enrage: { name: '돌 폭주', period: 2, dmg: 240 },
  },
  // 신전지기 유령 (35 4-5 ②, 깨진 신전 최종): 받침 처음 (발판 2곳) · 네 가지 청소약 · 먼지 범벅 (천장 무너짐 뒤 사라짐) · 천장 무너짐 (가운데 피난처 + 탱커 칸, 악몽 1칸 줄임)
  // · 꼬마 오토의 기억 (50% 아래 영혼, 채우면 보스 피해 −25%). 목표 3:30 · 광폭화 4:45
  keeper: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      BUSTER('빗자루 휘두르기', '빗자', 8, 14, U.tank(0.55)),
      { key: 'grime', name: '먼지 범벅', hidden: true, first: 10, period: 14, cast: 0,
        effect: { p: 'debuff', n: 1, pick: 'tank', debuff: { name: '먼지 범벅', type: '물리', left: 60, healCut: 0.08, stackMax: 5, lock: true } } },
      { key: 'soap', name: '네 가지 청소약', icon: '청소', kind: 'instant', first: 6, period: 12, cast: 0,
        how: '질병 → 독 → 저주 → 마법 차례로 한 명씩. 지울 수 있는 유형은 지우고, 못 지우는 유형은 힐로 버티기',
        effect: { p: 'cycle', n: 1, debuffs: soaps() } },
      { key: 'pads', name: '제단 발판', icon: '발판', kind: 'aoe', first: 20, period: 30, cast: 2.5,
        how: '금빛 발판에 들어간 사람이 맞고, 빈 발판마다 전원이 맞음. 들어간 사람을 바로 채우기',
        effect: { p: 'tower', n: 2, dmg: U.dps(0.4), empty: U.dps(0.2) } },
      { key: 'roof', name: '천장 무너짐', icon: '천장', kind: 'zone', first: 42, period: 55, cast: 5, warn: 'zone', hitDmg: U.dps(0.85),
        cells: { p: 'safe', at: 'center', n: 5, nMythic: 4, tank: true },
        how: '파티원이 가운데 금빛 기둥 그늘로 모임. 늦을 사람 (칸 흔들림)을 미리 채우기' },
      { key: 'shake', name: '먼지 털기', hidden: true, first: 47.5, period: 55, cast: 0, effect: { p: 'clear', name: '먼지 범벅' } },
      { key: 'otto', name: '꼬마 오토의 기억', icon: '오토', kind: 'instant', first: null, period: 40, cast: 0,
        effect: { p: 'soul', name: '꼬마 오토의 기억', short: '오토', art: 'mob-keeper-child', hp: 0.3, sec: 10,
          win: { text: '오토가 기분이 풀림: 보스 피해 −25%', weak: { pct: 0.25, sec: 10 } },
          fail: { text: '투덜투덜 먼지바람', dmg: U.dps(0.15) } } },
    ],
    flow: [{ p: 'when', if: { idle: 'otto', hpBelow: 0.5 }, do: [{ p: 'start', skill: 'otto', in: 2 }, { p: 'text', text: '꼬마 오토의 기억: 영혼을 채우면 유령이 잠시 누그러짐' }] }],
    enrage: { name: '대청소', period: 2, dmg: 260 },
  },
  // 역병 군주 탐험판 (35 4-8 ⑧, 탐험 ⑧ 심연 가장자리): 평타 · 썩은 숨결 (질병) · 독침 · 전염 (함정: 떨어진 칸이 안전). 10인 1층 예습
  plague33: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      { key: 'breath', name: '썩은 숨결', icon: '숨결', kind: 'instant', first: 6, period: 12, cast: 0,
        effect: { p: 'rot', n: 1, debuff: { name: '썩은 숨결', type: '질병', left: 60, end: { p: 'restoreMax' } }, pct: 0.05, max: 4 } },
      { key: 'sting', name: '독침', icon: '독침', kind: 'instant', first: 10, period: 15, cast: 0,
        effect: { p: 'debuff', n: 1, debuff: { name: '독침', type: '독', left: 12, dot: 15 } } },
      { key: 'contagion', name: '전염', icon: '전염', kind: 'instant', first: 20, period: 24, cast: 0,
        how: '함정. 끝나거나 지우면 이웃 칸 사람에게 퍼짐. 떨어져 서 있을 때 지우거나 끝날 때까지 채우기',
        effect: { p: 'debuff', n: 1, debuff: { name: '전염', type: '질병', left: 8, trap: true, end: { p: 'spread' } } } },
    ],
    enrage: { name: '역병 폭발', period: 2, dmg: 190 },
  },
  // 망루 파수꾼 (39 3-1, 던전 ⑦ 무너진 망루): 끌어당김 × 받침 (끌려온 사람이 받침을 맡음, 겁쟁이가 도망치면 빈 받침 = 전원 피해) · 경고 함성 ✋.
  // 50% 아래 끌기 28 → 20초. 악몽은 끌기 2명 · 받침 2곳. 목표 2:45 · 광폭화 3:45
  sentinel: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      BUSTER('청동 망치', '망치', 8, 16, U.tank(0.55)),
      { key: 'chain', name: '갈고리 사슬', icon: '사슬', kind: 'buster', first: 14, period: 28, cast: 2, warn: 'buster', target: { p: 'back', n: 1, nMythic: 2 },
        how: '뒷줄 사람을 끌어와 그 칸에 받침. 6초 동안 평타를 탱커와 번갈아 맞고, 끝에 받침이 울림 (비어 있으면 전원 피해). 끌려온 사람을 끝까지 세워 두기',
        effect: { p: 'pull', sec: 6, dmg: U.dps(0.1), pad: { dmg: U.dps(0.3), empty: U.dps(0.25) } } },
      { key: 'shout', name: '경고 함성', icon: '함성', kind: 'aoe', first: 24, period: 30, cast: 3, warn: 'aoe', cut: true, effect: { p: 'all', dmg: U.dps(0.25) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'period', skill: 'chain', sec: 20 }, { p: 'text', text: '망루가 기운다: 갈고리 사슬이 잦아짐' }] }],
    enrage: { name: '망루 붕괴', period: 2, dmg: 260 },
  },
  // 금 간 공명 수정 (39 3-2, 무너진 망루 최종): 진동 × 옮겨붙음 약한 판 (메아리는 진동 때 이웃 1명에게 옮겨붙고 +50%, 해제하면 사라짐) · 어긋난 공명 ✋.
  // 40% 아래 진동 15 → 11초 · 메아리 2명. 악몽은 메아리가 이웃 2명까지 갈라짐. 목표 3:15 · 광폭화 4:30
  crystal: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('금 간 울림', '울림', 19.5, 15, U.tank(0.5)), // 진동 (14 + 15k초) 사이 가운데에 맞음
      ...([['echo', 1, 1, 6], ['echo2', 2, 2, null]] as const).map(([key, n, phase, first]): SkillDef => ({
        key, name: '메아리', icon: '메아', kind: 'instant', first, period: 20, cast: 0, when: { phase: [phase] },
        how: '진동이 울리면 이웃 칸 아군에게 옮겨붙고 세짐. 진동 직전에 지우거나, 못 지우면 옆 사람을 미리 채우기. 혼자 선 사람은 둠',
        effect: { p: 'debuff', n, pick: 'others', debuff: { name: '메아리', type: '저주', left: 20, dot: U.dps(0.02), end: { p: 'jump', sec: 20, mult: 1.5, boost: 0, on: 'quake', nMythic: 2 } } },
      })),
      { key: 'quake', name: '수정 진동', icon: '진동', kind: 'aoe', first: 12, period: 15, cast: 2, warn: 'aoe', effect: { p: 'quake', dmg: U.dps(0.12), lock: 3 } },
      { key: 'detune', name: '어긋난 공명', icon: '공명', kind: 'instant', first: 18, period: 22, cast: 2, cut: true,
        effect: { p: 'debuff', n: 2, pick: 'others', debuff: { name: '어긋난 공명', type: '마법', left: 6, noDps: true } } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'period', skill: 'quake', sec: 11 }, { p: 'start', skill: 'echo2', in: 2 }, { p: 'text', text: '마지막 울림: 진동이 잦아지고 메아리 2명' },
    ] }],
    enrage: { name: '공명 폭주', period: 2, dmg: 260 },
  },
  // ---------- 묶음 B 옛 세력 (46 3장 · 1-1): 던전 ⑧~⑩ 보스 6 · 탐험 ⑩ ⑫ 빌림 2 ----------
  // 수로 쥐왕 (46 3-1 ①, 던전 ⑧ 역병 수로): 사냥 × 파열 (쥐가 쓰러질 때 쌓인 파열로 모두 낮아진 순간 가장 낮은 사람을 문다). 50% 아래 쥐 4 · 사냥 9초.
  // 악몽은 사냥이 가장 낮은 둘. 목표 2:45 · 광폭화 3:45
  ratking: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('꼬리 채찍', '꼬리', 8, 15, U.tank(0.5)),
      ...([['rats', 3, 1], ['rats2', 4, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '쥐떼 부르기', icon: '쥐떼', kind: 'instant', first: 18, period: 30, cast: 0, when: { phase: [phase] },
        how: '쥐가 쓰러질 때마다 모두에게 쥐 파열이 쌓임. 쥐가 거의 다 잡힐 때 지속 힐을 미리, 그 뒤 사냥에 물릴 가장 낮은 사람부터',
        effect: { p: 'adds', n, add: { name: '수로 쥐', short: '쥐', art: 'mob-sewer-rat', hp: 0.015, dmg: U.dps(0.04), every: 2,
          down: { p: 'burst', debuff: { name: '쥐 파열', type: '질병', left: 4, dot: U.dps(0.01), stackMax: 5 } } } },
      })),
      { key: 'hunt', name: '약한 놈 물어!', icon: '사냥', kind: 'instant', first: 12, period: 12, cast: 2, effect: { p: 'hunt', dmg: U.dps(0.35), nMythic: 2 } },
      { key: 'cap', name: '병뚜껑 던지기', icon: '뚜껑', kind: 'instant', first: 8, period: 20, cast: 2, cut: true,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '병뚜껑', type: '질병', left: 10, dot: U.dps(0.02) } } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'period', skill: 'hunt', sec: 9 }, { p: 'text', text: '수로가 넘친다: 쥐 4마리, 사냥이 잦아짐' }] }],
    enrage: { name: '쥐떼 폭주', period: 2, dmg: 270 },
  },
  // 역병 운반자 (46 3-1 ②, 역병 수로 최종): 옮겨붙음 본판 (지우면 옆으로 ×1.5, 두면 보스 +3%) × 걸어오는 쫄 (닿으면 보스 +10%).
  // 35% 아래 축복 배달 2명. 악몽은 오물 통 2개씩. 목표 3:15 · 광폭화 4:30
  carrier: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('물통 내려치기', '물통', 8, 16, U.tank(0.55)),
      ...([['bless', 1, 1, 6], ['bless2', 2, 2, null]] as const).map(([key, n, phase, first]): SkillDef => ({
        key, name: '축복 배달', icon: '배달', kind: 'instant', first, period: 18, cast: 0, when: { phase: [phase] },
        how: '지우면 옆 칸 아군에게 옮겨붙어 세지고 (혼자면 사라짐), 두면 끝날 때 보스가 강해짐. 혼자 선 사람일 때 지우기',
        effect: { p: 'debuff', n, pick: 'others', debuff: { name: '축복 배달', type: '질병', left: 12, dot: U.dps(0.025), end: { p: 'jump', sec: 10, mult: 1.5, boost: 0.03 } } },
      })),
      { key: 'barrel', name: '오물 통 굴리기', icon: '오물', kind: 'instant', first: 14, period: 25, cast: 0,
        how: '뒷줄에서 한 줄씩 굴러옴. 보스에게 닿으면 보스가 끝까지 강해지니 딜러가 잡게 딜러를 살려 두기',
        effect: { p: 'adds', n: 1, nMythic: 2, add: { name: '오물 통', short: '통', art: 'mob-sludge-barrel', hp: 0.015, dmg: 0, every: 3, at: 'back', job: { p: 'march', every: 3, boost: 0.1 } } } },
      { key: 'aoe', name: '초록 물 쏟기', icon: '초록', kind: 'aoe', first: 22, period: 28, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.22) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.35 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'bless2', in: 2 }, { p: 'text', text: '마지막 배달: 축복 배달 2명' }] }],
    enrage: { name: '배달 폭주', period: 2, dmg: 270 },
  },
  // 서고 사서 (46 3-2 ①, 던전 ⑨ 얼음 서고): 마나 갈취 본판 (책이 살아 있는 동안 마나가 샘) × 차례. 40% 아래 책 3권. 악몽은 차례 4명. 목표 2:50 · 광폭화 4:00
  librarian: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('두꺼운 사전', '사전', 8, 16, U.tank(0.55)),
      ...([['books', 2, 1], ['books2', 3, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '마나 먹는 책', icon: '책', kind: 'instant', first: 16, period: 30, cast: 0, when: { phase: [phase] },
        how: '책이 살아 있는 동안 한 권마다 내 마나가 샘. 딜러가 빨리 잡게 딜러 침묵 (쉿!)부터 지우고, 마나가 바닥나기 전에 물약',
        effect: { p: 'adds', n, add: { name: '마나 먹는 책', short: '책', art: 'mob-drain-book', hp: 0.015, dmg: 0, every: 2, at: 'random', job: { p: 'drain', pct: 0.4 } } },
      })),
      { key: 'order', name: '제자리에 꽂기', icon: '꽂기', kind: 'instant', first: 24, period: 35, cast: 2,
        how: '번호 순서대로 직접 힐을 한 번씩. 빠른 힐로 짧게 (책이 살아 있으면 마나가 더 아까움)',
        effect: { p: 'order', n: 3, nMythic: 4, sec: 8, wrong: U.dps(0.2), miss: U.dps(0.25), daze: { sec: 4, vuln: 1.2 } } },
      { key: 'hush', name: '쉿!', icon: '쉿', kind: 'instant', first: 10, period: 22, cast: 2, cut: true,
        effect: { p: 'debuff', n: 2, pick: 'others', debuff: { name: '쉿!', type: '마법', left: 6, noDps: true } } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'text', text: '마감 시간: 마나 먹는 책 3권' }] }],
    enrage: { name: '서고 폐관', period: 2, dmg: 270 },
  },
  // 얼어붙은 대학자 (46 3-2 ②, 얼음 서고 최종): 역류 × 무너지는 바닥 · 내게 걸린 마법 둘 (역류 · 마나 얼음). 35% 아래 역류 20초. 악몽은 바닥 2곳. 목표 3:20 · 광폭화 4:30
  scholar: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('얼음 지팡이', '지팡', 8, 16, U.tank(0.55)),
      { key: 'recoil', name: '강의: 역류', icon: '역류', kind: 'instant', first: 15, period: 30, cast: 0,
        how: '내 스킬마다 1중첩, 끝날 때 중첩만큼 나에게 피해. 큰 힐 몇 번만, 0~1중첩일 때만 지우기',
        effect: { p: 'debuff', n: 1, pick: 'me', debuff: { name: '강의: 역류', type: '마법', left: 10, count: true, end: { p: 'stackHit', dmg: U.me(0.07) } } } },
      { key: 'ice', name: '마나 얼음', icon: '얼음', kind: 'instant', first: 9, period: 24, cast: 0,
        how: '내 마나가 초당 샘. 역류와 겹치면 마나 얼음을 지움',
        effect: { p: 'debuff', n: 1, pick: 'me', debuff: { name: '마나 얼음', type: '마법', left: 12, drain: 0.6 } } },
      ...([['floor', 12, undefined], ['floor2', 12.5, true]] as const).map(([key, first, mythic]): SkillDef => ({
        key, name: '바닥이 언다', icon: '바닥', kind: 'zone', first, period: 22, cast: 2.5, warn: 'zone', dps: U.dps(0.1), dur: 6, cells: { p: 'around' },
        when: mythic ? { mythic: true } : undefined, ...(mythic ? { hidden: true } : {}),
      })),
      { key: 'crack', name: '얼음 깨짐', icon: '깨짐', kind: 'instant', first: 20.5, period: 22, cast: 0, effect: { p: 'hole', n: 1, max: 6 } }, // 바닥이 언 뒤 가장자리가 구멍
      { key: 'aoe', name: '눈보라 강의', icon: '눈보', kind: 'aoe', first: 26, period: 26, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.22) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.35 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'period', skill: 'recoil', sec: 20 }, { p: 'text', text: '마지막 강의: 역류가 잦아짐' }] }],
    enrage: { name: '강의 폭주', period: 2, dmg: 280 },
  },
  // 백합 여사제 (46 3-3 ①, 던전 ⑩ 백합 납골당): 넘치는 빛 그릇형 (일부러 넘치게 → 전원 보호막) · 시든 백합 (받는 치유 −50%). 40% 아래 꽃잎 폭풍 38%.
  // 악몽은 꽃병 끝 30%. 목표 2:50 · 광폭화 4:00
  priestess: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('백합 지팡이', '지팡', 8, 16, U.tank(0.5)),
      ...([['vessel', 0.25, false], ['vessel2', 0.3, true]] as const).map(([key, need, mythic]): SkillDef => ({
        key, name: '백합 꽃병', icon: '꽃병', kind: 'instant', first: 14, period: 40, cast: 0, when: { mythic },
        how: '12초 동안 넘친 치유가 꽃병에 모임. 가득 차면 전원 보호막이라 곧 올 꽃잎 폭풍이 가벼움. 광역 힐 · 큰 힐을 일부러 넘치게',
        effect: { p: 'vessel', name: '백합 꽃병', need, sec: 12, shield: 10 },
      })),
      { key: 'storm', name: '꽃잎 폭풍', icon: '폭풍', kind: 'aoe', first: 25, period: 40, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.3), phaseDmg: { 2: U.dps(0.38) } } },
      { key: 'wilt', name: '시든 백합', icon: '시든', kind: 'instant', first: 8, period: 18, cast: 0,
        effect: { p: 'debuff', n: 2, debuff: { name: '시든 백합', type: '저주', left: 12, healCut: 0.5 } } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'text', text: '만개: 꽃잎 폭풍이 세짐' }] }],
    enrage: { name: '꽃잎 폭주', period: 2, dmg: 280 },
  },
  // 잠든 가주 (46 3-3 ②, 백합 납골당 최종): 사슬 나눔형 (한쪽만 힐해도 둘 다 참) × 뒤집힌 축복 (사슬 짝이 뒤집히면 짝에게 하는 힐도 절반이 피해).
  // 30% 아래 서약 2쌍. 악몽은 잠꼬대 저주 2명. 목표 3:30 · 광폭화 4:45
  sleeper: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('베개 휘두르기', '베개', 8, 16, U.tank(0.55)),
      ...([['oath', 1, 10], ['oath2', 2, 10.5]] as const).map(([key, phase, first]): SkillDef => ({
        key, name: '백 년 서약', icon: '서약', kind: 'instant', first, period: 30, cast: 0, when: phase === 1 ? undefined : { phase: [2] },
        how: '이어진 둘이 피해 · 치유를 반씩 나눔. 한쪽만 힐해도 둘 다 참',
        effect: { p: 'link', kind: 'share', name: '백 년 서약', sec: 20 },
      })),
      { key: 'murmur', name: '잠꼬대 저주', icon: '잠꼬', kind: 'instant', first: 15, period: 30, cast: 0,
        how: '받는 치유가 피해로. 사슬 짝에게 먼저 걸려서 짝에게 하는 힐도 절반이 피해. 짝 둘 다 힐을 멈추고 지울 수 있으면 지우기',
        effect: { p: 'debuff', n: 1, nMythic: 2, pick: 'linked', debuff: { name: '잠꼬대 저주', type: '저주', left: 6, invert: true } } },
      { key: 'aoe', name: '뒤척임', icon: '뒤척', kind: 'aoe', first: 20, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.24) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.3 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'text', text: '깨어남: 백 년 서약 2쌍' }] }],
    enrage: { name: '기상', period: 2, dmg: 290 },
  },
  // 서고 사서 탐험판 (46 1-1, 탐험 ⑩ 책갈피 설원 Lv 40): 평타 · 두꺼운 사전 · 마나 먹는 책 1권. 마나 갈취 예습 (던전 ⑨). 수치는 던전판의 70%
  librarian40: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      BUSTER('두꺼운 사전', '사전', 8, 16, 385),
      { key: 'books', name: '마나 먹는 책', icon: '책', kind: 'instant', first: 14, period: 30, cast: 0,
        how: '책이 살아 있는 동안 내 마나가 샘. 딜러가 잡을 때까지 마나를 아끼기',
        effect: { p: 'adds', n: 1, add: { name: '마나 먹는 책', short: '책', art: 'mob-drain-book', hp: 0.03, dmg: 0, every: 2, at: 'random', job: { p: 'drain', pct: 0.3 } } } },
    ],
    enrage: { name: '서고 폐관', period: 2, dmg: 190 },
  },
  // 백합 여사제 탐험판 (46 1-1, 탐험 ⑫ 장미 울타리 미로 Lv 48): 평타 · 백합 꽃병 (3인 맞춤) · 꽃잎 폭풍. 넘치는 빛 예습 (던전 ⑩)
  priestess48: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      { key: 'vessel', name: '백합 꽃병', icon: '꽃병', kind: 'instant', first: 12, period: 36, cast: 0,
        how: '12초 동안 넘친 치유가 꽃병에 모임. 가득 차면 전원 보호막. 일부러 넘치게 힐하기',
        effect: { p: 'vessel', name: '백합 꽃병', need: 0.25, sec: 12, shield: 10 } },
      { key: 'storm', name: '꽃잎 폭풍', icon: '폭풍', kind: 'aoe', first: 23, period: 36, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.21) } },
    ],
    enrage: { name: '꽃잎 폭주', period: 2, dmg: 195 },
  },
  // ---------- 묶음 B 짠물 해적단 (46 4장, 해제 독 + 저주: 사제는 힐로, 성기사는 독, 드루이드는 둘 다) ----------
  // 집게발 갑판장 탐험판 (46 1-1, 탐험 ⑨ 조개껍데기 해변 Lv 36): 평타 · 집게 조이기 · 독 거품 1명 (3중첩까지). 부풀기 예습 (10인 ②)
  crab36: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      BUSTER('집게 조이기', '집게', 8, 14, 350),
      { key: 'bubble', name: '독 거품', icon: '거품', kind: 'instant', first: 10, period: 20, cast: 0, how: BUBBLE_HOW,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: bubble(12, 3, 0.7) } },
    ],
    enrage: { name: '갑판 청소 끝', period: 2, dmg: 190 },
  },
  // 해적 선장 금빛수염 탐험판 (46 1-1, 탐험 ⑪ 난파선 모래톱 Lv 44): 평타 · 금도끼 · 동전 뒤집기 1명. 뒤집힘 저주 예습 (10인 ④)
  goldbeard44: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      BUSTER('금도끼', '도끼', 8, 16, 385),
      { key: 'coin', name: '동전 뒤집기', icon: '동전', kind: 'instant', first: 12, period: 25, cast: 0, how: COIN_HOW,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: COIN } },
    ],
    enrage: { name: '보물 사수', period: 2, dmg: 195 },
  },
  // 집게발 갑판장 (46 4-1 부두, 10인 ② 갈매기 항구): 부풀기 × 탱커 교대. 50% 아래 독 거품 3명 · 집게 10초. 악몽은 거품 5중첩 (20초). 목표 4:30 · 광폭화 6:00
  crab: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('집게 조이기', '집게', '집게 자국', U.tank(0.5)),
      ...bubbles([[1, 2], [2, 3]], 10, 20),
      { key: 'wave', name: '거품 파도', icon: '파도', kind: 'aoe', first: 20, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'period', skill: 'buster', sec: 10 }, { p: 'text', text: '껍데기 벗기: 독 거품 3명, 집게가 잦아짐' }] }],
    enrage: { name: '갑판 청소 끝', period: 3, dmg: 180 },
  },
  // 해적 요리사 왕솥 (46 4-1 주방): 등대지기 구하기 (사람 칸) × 큰 쫄 (주방 보조 바다코끼리). 30% 아래 보조 2마리. 악몽은 등대지기 20초. 목표 5:00 · 광폭화 6:30
  cook: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('국자 내려치기', '국자', 8, 16, U.tank(0.55)),
      ...([['helper', 1, 1], ['helper2', 2, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '주방 보조 부르기', icon: '보조', kind: 'instant', first: 20, period: 45, cast: 0, when: { phase: [phase] },
        how: '바다코끼리를 부탱커가 끌고, 10초마다 부탱커에게 국자 강타. 보스 국자와 겹치는 순간 두 탱커를 같이 채우기',
        effect: { p: 'adds', n, add: { name: '주방 보조 바다코끼리', short: '보조', art: 'mob-walrus-helper', hp: 0.04, dmg: 0, every: 0, at: 'front', job: { p: 'smash', every: 10, warn: 2, dmg: U.tank(0.5) } } },
      })),
      ...([['keeper', 25, false], ['keeper2', 20, true]] as const).map(([key, sec, mythic]): SkillDef => ({
        key, name: '그물에 묶인 등대지기', icon: '등대', kind: 'instant', first: 30, period: 50, cast: 0, when: { mythic },
        how: '등대지기 칸을 단일 힐로 가득 채우면 등대가 켜져 보스가 약해짐. 파티 힐을 잠깐 멈추고 투자할지',
        effect: { p: 'soul', name: '등대지기 할아버지', short: '등대', art: 'mob-lighthouse-keeper', hp: 0.3, sec,
          win: { text: '등대가 켜짐: 보스 피해 −25% · 받는 치유 +20%', weak: { pct: 0.25, sec: 15 }, heal: { pct: 0.2, sec: 15 } },
          fail: { text: '수프 넘침', dmg: U.dps(0.3) } },
      })),
      { key: 'soup', name: '끓어 넘치는 수프', icon: '수프', kind: 'zone', first: 15, period: 30, cast: 2.5, warn: 'zone', dps: U.dps(0.08), dur: 4, cells: { p: 'flow', every: 2, from: 'alt' } },
      { key: 'pepper', name: '매운 고추 가루', icon: '고추', kind: 'instant', first: 10, period: 20, cast: 0,
        effect: { p: 'debuff', n: 3, debuff: { name: '매운 고추 가루', type: '독', left: 10, dot: U.dps(0.02) } } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.3 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'text', text: '마지막 요리: 주방 보조 2마리' }] }],
    enrage: { name: '수프 폭발', period: 3, dmg: 180 },
  },
  // 부선장 갈고리 모렐 (46 4-1 등대, 10인 ② 최종): 피난처 × 부풀기 (큰 파도에 모이기 전에 거품을 터뜨림) · 갈고리 낚기. 30% 아래 큰 파도 30초.
  // 악몽은 독 거품 3명. 목표 5:30 · 광폭화 7:00
  morel: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('갈고리 베기', '갈고', '갈고리 상처', U.tank(0.5)),
      { key: 'pull', name: '갈고리 낚기', icon: '낚기', kind: 'buster', first: 14, period: 26, cast: 2, warn: 'buster', target: { p: 'back', n: 1 }, effect: { p: 'pull', sec: 6, dmg: U.dps(0.1) } },
      ...([['bubble', 2, false], ['bubble3', 3, true]] as const).map(([key, n, mythic]): SkillDef => ({
        key, name: '독 거품', icon: '거품', kind: 'instant', first: 10, period: 22, cast: 0, when: { mythic }, how: `${BUBBLE_HOW}. 큰 파도로 모이기 전에 터뜨려 두기`,
        effect: { p: 'debuff', n, pick: 'others', debuff: bubble(16, 4) },
      })),
      { key: 'wave', name: '큰 파도', icon: '파도', kind: 'zone', first: 35, period: 40, cast: 4.5, warn: 'zone', hitDmg: U.dps(0.7), cells: { p: 'safe', at: 'center', n: 6, tank: true },
        how: '파티원이 가운데 돛대 옆 금빛 칸으로 모임. 늦을 사람에게 미리 보호막, 거품은 모이기 전에 지우기' },
      { key: 'song', name: '해적의 노래', icon: '노래', kind: 'aoe', first: 22, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.3 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'period', skill: 'wave', sec: 30 }, { p: 'text', text: '「선장님 오신다!」: 큰 파도가 잦아짐' }] }],
    enrage: { name: '허세 폭발', period: 3, dmg: 190 },
  },
  // 포수장 쾅쾅 (46 4-2 갑판, 10인 ③ 짠물 여왕호): 줄 피해 (못 피함) × 자폭 쫄 (화약통) · 폭탄. 40% 아래 포격 두 줄. 악몽은 화약통 2개. 목표 4:45 · 광폭화 6:15
  gunner: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('꽂을대 찌르기', '꽂을', '화약 자국', U.tank(0.5)),
      ...rows('broadside', '옆구리 포격', '포격', 15, 20, U.dps(0.35), true),
      { key: 'barrel', name: '굴러오는 화약통', icon: '화약', kind: 'instant', first: 18, period: 25, cast: 0,
        how: '노린 사람에게 한 칸씩 굴러감. 붙으면 그 사람과 이웃이 크게 아프니 노린 사람을 미리 가득 채우기',
        effect: { p: 'adds', n: 1, nMythic: 2, add: { name: '굴러오는 화약통', short: '통', art: 'mob-powder-barrel', hp: 0.01, dmg: 0, every: 2, job: { p: 'fixate', every: 2, dmg: U.dps(0.6), splash: U.dps(0.2), from: 3 } } } },
      { key: 'keg', name: '불붙은 화약통', icon: '폭탄', kind: 'instant', first: 30, period: 35, cast: 0,
        how: '8초 안에 딜러가 못 깨면 전원이 아픔. 폭탄을 깰 딜러의 침묵 (안 들려!)부터 지우고, 못 깰 것 같으면 광역 선힐',
        effect: { p: 'adds', n: 2, add: { name: '불붙은 화약통', short: '폭', art: 'mob-lit-keg', hp: 0.012, dmg: 0, every: 0, job: { p: 'bomb', sec: 8, dmg: U.dps(0.3) } } } },
      { key: 'deaf', name: '안 들려!', icon: '귀막', kind: 'instant', first: 10, period: 22, cast: 2, cut: true,
        effect: { p: 'debuff', n: 2, pick: 'others', debuff: { name: '안 들려!', type: '저주', left: 8, noDps: true } } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'text', text: '일제 사격: 옆구리 포격 두 줄' }] }],
    enrage: { name: '전 포문 발사', period: 3, dmg: 180 },
  },
  // 문어 꾸물이 (46 4-2 창고): 치유 상한 (먹물) × 감옥 (꼭 껴안기) · 꿈틀 촉수. 40% 아래 먹물 4명 · 상한 50%. 악몽은 꼭 껴안기 2명. 목표 5:00 · 광폭화 6:30
  octo: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('촉수 후려치기', '촉수', '빨판 자국', U.tank(0.5)),
      ...([['ink', 3, 0.6, 1], ['ink2', 4, 0.5, 2]] as const).map(([key, n, cap, phase]): SkillDef => ({
        key, name: '먹물 뿜기', icon: '먹물', kind: 'instant', first: 10, period: 22, cast: 0, when: { phase: [phase] }, how: INK_HOW,
        effect: { p: 'debuff', n, pick: 'others', debuff: { name: '먹물', type: '독', left: 15, cap } },
      })),
      { key: 'hug', name: '꼭 껴안기', icon: '껴안', kind: 'instant', first: 20, period: 30, cast: 0,
        how: '갇힌 사람은 딜 0 · 초당 피해. 딜러가 감옥을 깰 때까지 단일 힐. 먹물이 걸린 사람이 갇히면 상한부터 지우기',
        effect: { p: 'jail', n: 1, nMythic: 2, name: '촉수 감옥', short: '촉수', hp: 0.02, dot: U.dps(0.03) } },
      { key: 'arms', name: '꿈틀 촉수', icon: '꿈틀', kind: 'instant', first: 25, period: 40, cast: 0,
        effect: { p: 'adds', n: 2, add: { name: '꿈틀 촉수', short: '촉수', art: 'mob-tentacle', hp: 0.015, dmg: U.dps(0.05), every: 2 } } },
      { key: 'wave', name: '먹물 파도', icon: '파도', kind: 'aoe', first: 24, period: 26, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.22) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'text', text: '신난 문어: 먹물 4명, 상한 50%' }] }],
    enrage: { name: '먹물 폭풍', period: 3, dmg: 180 },
  },
  // 바다 마녀 미역 할멈 (46 4-2 뱃머리, 10인 ③ 최종): 사슬 균형 × 치유 상한 (소금물 저주가 사슬 짝에게 먼저). 35% 아래 사슬 3쌍.
  // 악몽은 사슬 차이 25%p. 목표 5:45 · 광폭화 7:15
  seawitch: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('미역 채찍', '미역', '짠물 자국', U.tank(0.5)),
      ...([['chain', 1, false], ['chainB', 1, false], ['chainC', 2, false], ['chainM', 1, true], ['chainBM', 1, true], ['chainCM', 2, true]] as const).map(([key, phase, mythic]): SkillDef => ({
        key, name: '미역 사슬', icon: '사슬', kind: 'instant', first: 12, period: 30, cast: 0, when: phase === 1 ? { mythic } : { phase: [2], mythic },
        how: '두 사람 체력 비율 차이가 벌어지면 끊어지며 둘 다 아픔. 둘을 같이 채우기 (한쪽에 소금물 저주가 걸리면 다른 쪽을 너무 채우지 않기)',
        effect: { p: 'link', kind: 'balance', name: '미역 사슬', sec: 15, pick: 'others', gap: mythic ? 0.25 : 0.3, dmg: U.dps(0.35) },
      })),
      { key: 'brine', name: '소금물 저주', icon: '소금', kind: 'instant', first: 15, period: 30, cast: 0, how: INK_HOW,
        effect: { p: 'debuff', n: 2, pick: 'linked', debuff: { name: '소금물 저주', type: '저주', left: 12, cap: 0.6 } } },
      { key: 'tide', name: '밀물', icon: '밀물', kind: 'zone', first: 18, period: 24, cast: 3, warn: 'zone', dps: U.dps(0.08), dur: 8, cells: { p: 'line', at: 'back' } },
      { key: 'foam', name: '거품 점괘', icon: '점괘', kind: 'aoe', first: 22, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.24) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.35 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'text', text: '큰 물때: 미역 사슬 3쌍' }] }],
    enrage: { name: '대해일', period: 3, dmg: 190 },
  },
  // 보물 상자 덥석이 (46 4-3 동굴, 10인 ④ 보물섬 요새): 삼키기 × 마나 갈취 (금화 더미). 40% 아래 덥석 2명. 악몽은 금화 더미 3. 목표 4:45 · 광폭화 6:15
  mimic: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('뚜껑 쾅', '뚜껑', '뚜껑 자국', U.tank(0.5)),
      ...([['gulp', 1, 1], ['gulp2', 2, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '덥석!', icon: '덥석', kind: 'buster', first: 14, period: 30, cast: 2, warn: 'buster', target: { p: 'back', n }, when: { phase: [phase] },
        how: '삼켜진 사람은 딜 0 · 초당 피해, 보스를 4% 깎으면 나옴. 삼켜진 사람에게 지속 힐, 딜러를 살려 두기',
        effect: { p: 'debuff', n, pick: 'tel', debuff: { name: '덥석!', type: '물리', left: 10, dot: U.dps(0.03), lock: true, hide: true, noMove: true, noDps: true, untilBossLoss: 0.04 } },
      })),
      { key: 'gold', name: '금화 더미', icon: '금화', kind: 'instant', first: 19, period: 35, cast: 0,
        how: '금화 더미가 살아 있는 동안 한 개마다 내 마나가 샘. 마나 물약 · 아끼는 힐로 버티기',
        effect: { p: 'adds', n: 2, nMythic: 3, add: { name: '금화 더미', short: '금화', art: 'mob-gold-pile', hp: 0.015, dmg: 0, every: 2, at: 'random', job: { p: 'drain', pct: 0.4 } } } },
      { key: 'rain', name: '금화 비', icon: '금비', kind: 'aoe', first: 22, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.22) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'text', text: '배고픈 상자: 덥석 2명' }] }],
    enrage: { name: '금화 폭식', period: 3, dmg: 180 },
  },
  // 앵무새 대장 깍깍 (46 4-3 망루): 차례 × 느린 시전 (깃털 회오리가 차례 1초 앞). 40% 아래 차례 5명. 악몽은 회오리 시전 ×2.5. 목표 5:00 · 광폭화 6:30
  parrot: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('부리 쪼기', '부리', '깃털 자국', U.tank(0.5)),
      ...([['order', 4, 1], ['order2', 5, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '깍! 순서대로!', icon: '차례', kind: 'instant', first: 25, period: 35, cast: 0, when: { phase: [phase] },
        how: '번호 순서대로 직접 힐을 한 번씩. 깃털 회오리로 시전이 느린 동안이면 즉시 힐 · 빠른 힐로',
        effect: { p: 'order', n, sec: 10, wrong: U.dps(0.2), miss: U.dps(0.25), daze: { sec: 5, vuln: 1.2 } },
      })),
      ...([['gust', 2, false], ['gust2', 2.5, true]] as const).map(([key, mult, mythic]): SkillDef => ({
        key, name: '깃털 회오리', icon: '회오', kind: 'instant', first: 22, period: 35, cast: 2, warn: 'aoe', when: { mythic },
        how: '6초 동안 내 시전 시간이 느려짐. 곧 올 차례는 즉시 힐 · 빠른 힐로', effect: { p: 'slow', sec: 6, mult },
      })),
      { key: 'mimicry', name: '앵무새 흉내', icon: '흉내', kind: 'instant', first: 10, period: 20, cast: 0,
        effect: { p: 'debuff', n: 2, debuff: { name: '앵무새 흉내', type: '저주', left: 10, dot: U.dps(0.02), healCut: 0.25 } } },
      { key: 'flap', name: '날갯짓', icon: '날개', kind: 'aoe', first: 15, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.22) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'text', text: '「깍깍깍!」: 차례 5명' }] }],
    enrage: { name: '깃털 폭풍', period: 3, dmg: 180 },
  },
  // 해적 선장 금빛수염 (46 4-3 꼭대기, 10인 ④ 최종 · 해적단 수장): 뒤집힘 저주. 60% 「선원들, 덤벼!」 (갑판 청소부 · 금화 비) → 30% 「내 보물!」 (10초마다 보스 +5%,
  // 동전 뒤집기 18초). 악몽은 동전 뒤집기 3명. 목표 6:00 · 광폭화 7:30
  goldbeard: {
    phase: [1, '1페이즈'],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('금도끼', '도끼', '금도끼 자국', U.tank(0.55)),
      ...([['coin', 2, false], ['coin3', 3, true]] as const).map(([key, n, mythic]): SkillDef => ({
        key, name: '동전 뒤집기', icon: '동전', kind: 'instant', first: 12, period: 25, cast: 0, when: { mythic }, how: COIN_HOW,
        effect: { p: 'debuff', n, pick: 'others', debuff: COIN },
      })),
      ...rows('cannon', '보물 지도 포격', '포격', 16, 22, U.dps(0.3), false),
      { key: 'roar', name: '해적의 함성', icon: '함성', kind: 'aoe', first: 14, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.22) } },
      { key: 'crew', name: '선원들, 덤벼!', icon: '선원', kind: 'instant', first: null, period: 30, cast: 0, when: { phase: [2] },
        how: '갑판 청소부를 부탱커가 끌고 딜러가 잡음. 두 탱커를 같이 채우기',
        effect: { p: 'adds', n: 3, add: { name: '갑판 청소부', short: '청소', art: 'mob-deck-swab', hp: 0.02, dmg: U.dps(0.04), every: 2 } } },
      { key: 'goldrain', name: '금화 비', icon: '금비', kind: 'aoe', first: null, period: 30, cast: 3, warn: 'aoe', when: { phase: [2, 3] }, effect: { p: 'all', dmg: U.dps(0.18) } },
      { key: 'raincoin', name: '동전 뒤집기', icon: '동전', kind: 'instant', first: null, period: 30, cast: 0, when: { phase: [2, 3] }, how: COIN_HOW,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: COIN } },
      { key: 'treasure', name: '내 보물!', icon: '보물', kind: 'instant', first: null, period: 10, cast: 0, when: { phase: [3] },
        how: '10초마다 보스가 주는 피해 +5% (끝까지). 마나를 3페이즈에 남겨 두기', effect: { p: 'empower', boost: 0.05 } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.6 }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 선원들, 덤벼!' }, { p: 'start', skill: 'crew', in: 2 }, { p: 'start', skill: 'goldrain', in: 8 }, { p: 'start', skill: 'raincoin', in: 11 },
        { p: 'text', text: '선원들, 덤벼!: 갑판 청소부 3 · 금화 비에 동전 뒤집기 1명 더' },
      ] },
      { p: 'when', if: { phase: 2, hpBelow: 0.3 }, do: [
        { p: 'phase', n: 3, name: '3페이즈 · 내 보물!' }, { p: 'start', skill: 'treasure', in: 10 }, { p: 'period', skill: 'coin', sec: 18 }, { p: 'period', skill: 'coin3', sec: 18 },
        { p: 'text', text: '내 보물!: 10초마다 보스 피해 +5%, 동전 뒤집기가 잦아짐' },
      ] },
    ],
    enrage: { name: '보물 사수', period: 3, dmg: 200 },
  },
  // ---------- 묶음 C (48 3장 · 1-1): 버섯 요정단 (질병 + 마법: 드루이드는 질병을 힐로) · 늪의 부족 (독) · 붉은 용 일가 첫 얼굴 ----------
  // 찻잔 요정 홀짝이 탐험판 (48 1-1, 탐험 ⑬ 꼬마등 오솔길 Lv 52): 평타 · 찻잔 던지기 · 포자 솜뭉치 1명 (작게). 넘어가는 포자 예습 (던전 ⑪)
  sippy52: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      BUSTER('찻잔 던지기', '찻잔', 8, 15, 350),
      { key: 'spore', name: '포자 솜뭉치', icon: '솜', kind: 'instant', first: 10, period: 20, cast: 0, how: SPORE_HOW,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: spore(0.7) } },
    ],
    enrage: { name: '찻잔 폭주', period: 2, dmg: 190 },
  },
  // 찻잔 요정 홀짝이 (48 3-1 ①, 던전 ⑪ 끝없는 다과회): 넘어가는 포자 × 사냥 (막이 붙어 낮아진 사람을 문다 → 지워서 건강한 사람에게 넘김).
  // 50% 아래 솜뭉치 2명. 악몽은 막 딜체 55%. 목표 2:45 · 광폭화 3:45
  sippy: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('찻잔 던지기', '찻잔', 8, 15, U.tank(0.5)),
      ...([[1, 1], [2, 2]] as const).flatMap(([phase, n]) => ([false, true] as const).map((mythic): SkillDef => ({
        key: `spore${phase}${mythic ? 'm' : ''}`, name: '포자 솜뭉치', icon: '솜', kind: 'instant', first: 10, period: 16, cast: 0, when: { phase: [phase], mythic }, how: SPORE_HOW,
        effect: { p: 'debuff', n, pick: 'others', debuff: spore(mythic ? 55 / 40 : 1) },
      }))),
      { key: 'hunt', name: '한 잔 더!', icon: '한잔', kind: 'instant', first: 12, period: 12, cast: 2, effect: { p: 'hunt', dmg: U.dps(0.35) } },
      { key: 'aoe', name: '각설탕 비', icon: '설탕', kind: 'aoe', first: 20, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'text', text: '리필: 포자 솜뭉치 2명' }] }],
    enrage: { name: '찻잔 폭주', period: 2, dmg: 270 },
  },
  // 모자 장수 해롱 (48 3-1 ②, 끝없는 다과회 최종): 모자 뽑기 (뒤집힘 · 상한 · 완치 중 하나) × 진동 (완치 모자를 채우는 시전이 끊김).
  // 35% 아래 모자 2명 · 진동 15초. 악몽은 완치 모자가 끝나면 딜체 60%. 목표 3:15 · 광폭화 4:30
  hatter: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('지팡이 휘두르기', '지팡', 8, 16, U.tank(0.55)),
      ...([['hats', 1, 1], ['hats2', 2, 2]] as const).flatMap(([key, n, phase]) => ([false, true] as const).map((mythic): SkillDef => ({
        key: `${key}${mythic ? 'm' : ''}`, name: '모자 씌우기', icon: '모자', kind: 'instant', first: phase === 1 ? 10 : null, period: 14, cast: 0, when: { phase: [phase], mythic }, how: HAT_HOW,
        effect: { p: 'cycle', n, random: true, debuffs: mythic ? HATS_MYTHIC : HATS },
      }))),
      { key: 'quake', name: '늦었다, 늦었어!', icon: '늦었', kind: 'aoe', first: 12, period: 20, cast: 3, warn: 'aoe', effect: { p: 'quake', dmg: U.dps(0.1), lock: 3 } },
      { key: 'aoe', name: '자리 바꿔!', icon: '자리', kind: 'aoe', first: 22, period: 26, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.22) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.35 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'hats2', in: 2 }, { p: 'start', skill: 'hats2m', in: 2 }, { p: 'period', skill: 'quake', sec: 15 },
      { p: 'text', text: '티타임은 끝나지 않아: 모자 2명, 진동이 잦아짐' },
    ] }],
    enrage: { name: '티타임 폭주', period: 2, dmg: 270 },
  },
  // 버섯 가면 주술사 우가 (48 3-2 ①, 던전 ⑫ 이끼 뿌리 사원): 요정 고리 × 완치 표식 (거머리가 고리 안 사람에게 붙으면 걸어 나올 때까지 기다릴지).
  // 50% 아래 고리 2개. 악몽은 고리 최대 3겹. 목표 2:50 · 광폭화 3:50
  uga: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('가면 박치기', '가면', 8, 15, U.tank(0.5)),
      ...([['ring', 1, 1], ['ring2', 2, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '독버섯 고리', icon: '고리', kind: 'instant', first: phase === 1 ? 6 : null, period: 18, cast: 0, when: { phase: [phase] }, how: RING_HOW,
        effect: { p: 'ring', n, sec: 18, dps: U.dps(0.05), every: 2, max: 2, maxMythic: 3 },
      })),
      { key: 'leech', name: '거머리 붙이기', icon: '거머', kind: 'instant', first: 10, period: 20, cast: 0,
        how: '체력을 뚝 떨어뜨리고 붙음. 해제 불가, 100%까지 채우면 떨어짐. 고리 밖이면 바로 몰아서, 고리 안이면 걸어 나올 때를 봄',
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '거머리', type: '독', left: 12, lock: true, cureAt: 1, drop: U.dps(0.4), end: { p: 'hit', dmg: U.dps(0.45) } } } },
      { key: 'aoe', name: '북소리', icon: '북', kind: 'aoe', first: 20, period: 24, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'ring2', in: 2 }, { p: 'text', text: '신나는 춤: 독버섯 고리 2개' }] }],
    enrage: { name: '우가우가 축제', period: 2, dmg: 270 },
  },
  // 늪 거북 신 등딱지 (48 3-2 ②, 이끼 뿌리 사원 최종): 무력화 × 해제 못 하는 독 (사제는 독 걸린 사람을 힐로 70% 위에) · 등딱지 굴리기 (못 피하는 줄).
  // 40% 아래 늪물 3명 · 무력화 28초. 악몽은 게이지 선 80%. 목표 3:20 · 광폭화 4:40
  shellgod: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('등딱지 박치기', '박치', 8, 16, U.tank(0.55)),
      ...([['spit', 2, 1], ['spit2', 3, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '늪물 뿜기', icon: '늪물', kind: 'instant', first: phase === 1 ? 6 : null, period: 18, cast: 0, when: { phase: [phase] },
        effect: { p: 'debuff', n, pick: 'others', debuff: { name: '늪물', type: '독', left: 12, dot: U.dps(0.025) } },
      })),
      { key: 'stagger', name: '대지 흔들기', icon: '흔들', kind: 'instant', first: 20, period: 35, cast: 0,
        how: '6초 동안 체력 70% 이상인 파티원의 딜만 게이지를 채움. 늪물 걸린 사람을 지우거나 채워서 70% 위로',
        effect: { p: 'stagger', sec: 6, need: 4, hp: 0.7, hpMythic: 0.8, tank: 2, win: { sec: 6, vuln: 1.3 }, fail: { dmg: U.dps(0.45), lock: 3 } } },
      ...rows('roll', '등딱지 굴리기', '굴림', 16, 22, U.dps(0.3), false),
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'spit2', in: 2 }, { p: 'period', skill: 'stagger', sec: 28 }, { p: 'text', text: '깊은 하품: 늪물 3명, 무력화가 잦아짐' },
    ] }],
    enrage: { name: '늪의 분노', period: 2, dmg: 280 },
  },
  // 코볼트 보물 지킴이 꼬질 탐험판 (48 1-1, 탐험 ⑮ 불꽃 봉우리 기슭 Lv 60): 평타 · 곡괭이 내려치기 · 불씨 꼬마 용 (자폭 쫄) · 독 연기 1명. 붉은 용 일가 첫 얼굴 (D 10인 ⑧로 키움)
  kobold60: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      BUSTER('곡괭이 내려치기', '곡괭', 8, 15, 360),
      { key: 'whelp', name: '불씨 꼬마 용', icon: '불씨', kind: 'instant', first: 14, period: 24, cast: 0,
        how: '나 또는 원거리 딜러를 쫓아와 붙으면 터짐. 쫓기는 사람을 미리 채우기',
        effect: { p: 'adds', n: 1, add: { name: '불씨 꼬마 용', short: '불씨', art: 'mob-ember-whelp', hp: 0.03, dmg: 0, every: 2, job: { p: 'fixate', every: 2, dmg: 300, splash: 100, from: 3 } } } },
      { key: 'smoke', name: '독 연기', icon: '연기', kind: 'instant', first: 8, period: 18, cast: 0,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '독 연기', type: '독', left: 10, dot: 14 } } },
    ],
    enrage: { name: '보물 지킴이 화남', period: 2, dmg: 200 },
  },
  // 버섯 여왕 아마니타 탐험판 (48 1-1, 탐험 ⑭ 무지개 버섯밭 Lv 56): 평타 · 여왕의 홀 · 숲 할아버지 묘목 (작은 사람 칸). 10인 ⑦ 왕좌 예습
  queen56: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      BUSTER('여왕의 홀', '홀', 8, 15, 350),
      { key: 'sapling', name: '숲 할아버지 묘목', icon: '묘목', kind: 'instant', first: 14, period: 35, cast: 0,
        how: '묘목 칸을 단일 힐로 20초 안에 가득 채우면 보스가 받는 피해 +25%. 질병을 지우는 직업은 해제로 바로 깨움',
        effect: { p: 'soul', name: '숲 할아버지 묘목', short: '묘목', art: 'mob-grandpa-tree', hp: 0.4, sec: 20, type: '질병',
          win: { text: '묘목이 깨어남: 보스가 받는 피해 +25%', vuln: { pct: 0.25, sec: 12 }, fx: 'tree-wake' }, fail: { text: '꽃가루가 터짐', dmg: 120 } } },
    ],
    enrage: { name: '여왕님 화남', period: 2, dmg: 190 },
  },
  // ---------- 묶음 C 10인 ⑤~⑦ (48 4장, 버섯 요정단 · 해제 질병 + 마법): 탱커 교대 자국은 모두 3중첩 ----------
  // 버섯 경비대장 송이 (48 4-1 어귀, 10인 ⑤ 요정 축제 마당): 요정 고리 × 탱커 교대. 50% 아래 고리 2개. 악몽은 고리 최대 3겹. 목표 4:30 · 광폭화 6:00
  songi: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('포자 창 찌르기', '창', '포자 자국', U.tank(0.5)),
      ...([['ring', 1, 1], ['ring2', 2, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '요정 고리', icon: '고리', kind: 'instant', first: phase === 1 ? 6 : null, period: 18, cast: 0, when: { phase: [phase] }, how: RING_HOW,
        effect: { p: 'ring', n, sec: 20, dps: U.dps(0.05), every: 2, max: 2, maxMythic: 3 },
      })),
      { key: 'cough', name: '포자 기침', icon: '기침', kind: 'instant', first: 10, period: 20, cast: 0,
        effect: { p: 'debuff', n: 2, pick: 'others', debuff: { name: '포자 기침', type: '질병', left: 10, dot: U.dps(0.02) } } },
      { key: 'ticket', name: '입장권 검사', icon: '입장', kind: 'aoe', first: 20, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'ring2', in: 2 }, { p: 'text', text: '경비 교대!: 요정 고리 2개' }] }],
    enrage: { name: '입장 마감', period: 3, dmg: 180 },
  },
  // 요정 악단장 삘릴리 (48 4-1 무대): 춤바람 × 쫄 (꽃가루 무용단). 춤바람 24초 · 무용수 체력 0.8% · 35초 (48은 20초 · 2% · 30초, 딜이 너무 빠져 광폭화까지 감). 50% 아래 춤바람 3명. 악몽은 무용수 4 · 춤바람 처음부터 3명. 목표 4:40 · 광폭화 6:15
  pililli: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('박자 맞춰 때리기', '박자', '음표 자국', U.tank(0.5)),
      ...([['dance', 2, 1], ['dance2', 3, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '춤바람', icon: '춤', kind: 'instant', first: phase === 1 ? 12 : null, period: 24, cast: 0, when: { phase: [phase] }, how: DANCE_HOW,
        effect: { p: 'debuff', n, nMythic: 3, pick: 'others', debuff: DANCE },
      })),
      { key: 'troupe', name: '꽃가루 무용단', icon: '무용', kind: 'instant', first: 18, period: 35, cast: 0,
        how: '무용수를 부탱커가 끌고 딜러가 잡음. 춤추는 딜러는 못 잡으니 그 딜러부터 채우기',
        effect: { p: 'adds', n: 3, nMythic: 4, add: { name: '꽃가루 무용수', short: '무용', art: 'mob-pollen-dancer', hp: 0.008, dmg: U.dps(0.04), every: 2 } } },
      { key: 'band', name: '신나는 합주', icon: '합주', kind: 'aoe', first: 22, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'dance2', in: 2 }, { p: 'text', text: '앙코르!: 춤바람 3명' }] }],
    enrage: { name: '끝없는 앙코르', period: 3, dmg: 180 },
  },
  // 축제 대장 퐁가 (48 4-1 모닥불, 10인 ⑤ 최종): 피난처 × 요정 고리 (고리 칸에는 안전 칸이 안 생김) · 폭탄 (폭죽 통). 30% 아래 폭죽 통 3 · 포자 구름 24초.
  // 악몽은 고리 3명. 목표 5:00 · 광폭화 6:30
  ponga: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('갓 박치기', '박치', '포자 혹', U.tank(0.5)),
      { key: 'ring', name: '요정 고리', icon: '고리', kind: 'instant', first: 8, period: 22, cast: 0, how: `${RING_HOW}. 고리 칸에는 포자 구름 안전 칸이 안 생기니 키우지 않기`,
        effect: { p: 'ring', n: 2, nMythic: 3, sec: 20, dps: U.dps(0.05), every: 2, max: 2 } },
      { key: 'cloud', name: '퐁! 포자 구름', icon: '포자', kind: 'zone', first: 30, period: 30, cast: 4, warn: 'zone', hitDmg: U.dps(0.45), cells: { p: 'safe', at: 'edge', n: 12 },
        how: '파티원이 금빛 안전 칸으로 모임 (요정 고리 칸에는 안 생김). 늦을 사람에게 미리 지속 힐 · 보호막' },
      ...([['keg', 2, 1], ['keg3', 3, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '폭죽 통', icon: '폭죽', kind: 'instant', first: phase === 1 ? 20 : null, period: 28, cast: 0, when: { phase: [phase] },
        how: '8초 안에 딜러가 못 깨면 전원이 아픔. 춤 · 침묵에 걸린 딜러부터 풀고, 못 깰 것 같으면 광역 선힐',
        effect: { p: 'adds', n, add: { name: '폭죽 통', short: '폭죽', art: 'mob-firework-keg', hp: 0.015, dmg: 0, every: 0, job: { p: 'bomb', sec: 8, dmg: U.dps(0.25) } } },
      })),
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.3 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'keg3', in: 3 }, { p: 'period', skill: 'cloud', sec: 24 }, { p: 'text', text: '축제는 계속돼!: 폭죽 통 3, 포자 구름이 잦아짐' },
    ] }],
    enrage: { name: '대폭죽', period: 3, dmg: 190 },
  },
  // 이끼 골렘 뭉게 (48 4-2 이끼 굴, 10인 ⑥ 포자 동굴 정원): 무력화 × 넘어가는 포자 (막이 붙은 사람은 70% 위로 올리기 어려움). 50% 아래 솜뭉치 3명.
  // 악몽은 게이지 선 75%. 목표 4:40 · 광폭화 6:15
  mungge: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('이끼 주먹', '주먹', '이끼 자국', U.tank(0.55)),
      ...([['spore', 2, 1], ['spore2', 3, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '포자 솜뭉치', icon: '솜', kind: 'instant', first: phase === 1 ? 10 : null, period: 18, cast: 0, when: { phase: [phase] }, how: `${SPORE_HOW}. 웅크리기 전에 막을 정리해 모두 70% 위로`,
        effect: { p: 'debuff', n, pick: 'others', debuff: spore() },
      })),
      { key: 'stagger', name: '뭉게 웅크리기', icon: '웅크', kind: 'instant', first: 25, period: 32, cast: 0,
        how: '6초 동안 체력 70% 이상인 파티원의 딜만 게이지를 채움. 솜뭉치가 붙은 사람은 지워서 넘기거나 녹여서 70% 위로',
        effect: { p: 'stagger', sec: 6, need: 4, hp: 0.7, hpMythic: 0.75, tank: 2, win: { sec: 6, vuln: 1.3 }, fail: { dmg: U.dps(0.4), lock: 3 } } },
      { key: 'rain', name: '이끼 비', icon: '이끼', kind: 'aoe', first: 20, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'spore2', in: 2 }, { p: 'text', text: '이끼가 자란다: 솜뭉치 3명' }] }],
    enrage: { name: '이끼 폭주', period: 3, dmg: 180 },
  },
  // 개구리 사공 개굴 (48 4-2 연못): 끌어당김 × 사슬 나눔형 (끌려온 사람과 탱커가 피해 · 치유를 반씩). 40% 아래 혀 2명 (둘째는 부탱커와 사슬).
  // 악몽은 사슬로 묶인 둘이 받는 피해 +10%. 목표 4:40 · 광폭화 6:15
  gaegul: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('물갈퀴 철썩', '철썩', '연못 자국', U.tank(0.5)),
      ...([['tongue', 1, 1], ['tongue2', 2, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '혀 낚아채기', icon: '혀', kind: 'buster', first: phase === 1 ? 14 : null, period: 20, cast: 2, warn: 'buster', target: { p: 'back', n }, when: { phase: [phase] },
        how: '끌려온 사람은 탱커와 연잎 사슬로 피해 · 치유를 반씩 나눔. 끌려온 사람에게 단일 힐을 넣으면 탱커도 같이 참',
        effect: { p: 'pull', sec: 8, dmg: U.dps(0.1), link: { name: '연잎 사슬', vulnMythic: 0.1 } },
      })),
      { key: 'splash', name: '연잎 물보라', icon: '물보', kind: 'zone', first: 10, period: 16, cast: 2.5, warn: 'zone', dps: U.dps(0.04), dur: 8, cells: { p: 'around' } },
      { key: 'croak', name: '개굴개굴 합창', icon: '개굴', kind: 'aoe', first: 22, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.22) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'tongue2', in: 3 }, { p: 'text', text: '큰 물결: 혀 낚아채기 2명' }] }],
    enrage: { name: '연못 범람', period: 3, dmg: 180 },
  },
  // 포자 정원사 모락 할멈 (48 4-2 뿌리 방, 10인 ⑥ 최종): 치유하는 쫄 (버섯 화분) × 요정 고리. 30% 아래 화분 3 · 회복 0.45% (48은 0.6 → 0.9%, 보스가 다시 차서 절반으로).
  // 악몽은 고리 3명. 목표 5:00 · 광폭화 6:45
  morak: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('삽 내려치기', '삽', '흙 자국', U.tank(0.55)),
      ...([['pots', 2, 0.003, 1], ['pots3', 3, 0.0045, 2]] as const).map(([key, n, pct, phase]): SkillDef => ({
        key, name: '버섯 화분', icon: '화분', kind: 'instant', first: phase === 1 ? 15 : null, period: 30, cast: 0, when: { phase: [phase] },
        how: '화분이 살아 있는 동안 보스가 체력을 회복함. 화분을 깨는 딜러가 쓰러지면 보스가 다시 차니 딜러를 살려 두기',
        effect: { p: 'adds', n, add: { name: '버섯 화분', short: '화분', art: 'mob-mushroom-pot', hp: 0.015, dmg: 0, every: 0, at: 'random', job: { p: 'mend', every: 3, pct } } },
      })),
      { key: 'ring', name: '요정 고리', icon: '고리', kind: 'instant', first: 8, period: 22, cast: 0, how: RING_HOW,
        effect: { p: 'ring', n: 2, nMythic: 3, sec: 20, dps: U.dps(0.05), every: 2, max: 2 } },
      { key: 'water', name: '물뿌리개', icon: '물뿌', kind: 'instant', first: 12, period: 18, cast: 0,
        effect: { p: 'debuff', n: 2, pick: 'others', debuff: { name: '젖은 포자', type: '질병', left: 10, dot: U.dps(0.02) } } },
      { key: 'storm', name: '포자 폭풍', icon: '폭풍', kind: 'aoe', first: 22, period: 26, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.22) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.3 }, do: [{ p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'pots3', in: 3 }, { p: 'text', text: '다 자랐다!: 버섯 화분 3, 회복이 빨라짐' }] }],
    enrage: { name: '정원 폭주', period: 3, dmg: 190 },
  },
  // 꿀벌 근위대장 붕붕 (48 4-3 정원, 10인 ⑦ 버섯 여왕의 궁전): 쇠약 × 쫄 떼 (꿀벌이 쏜 사람은 90% 아래인 동안 벌침이 쌓임). 40% 아래 꿀벌 7.
  // 악몽은 벌침 최대 7중첩. 목표 4:40 · 광폭화 6:15
  bungbung: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('창 찌르기', '창', '꿀 자국', U.tank(0.5)),
      ...([['swarm', 5, 1], ['swarm2', 7, 2]] as const).flatMap(([key, n, phase]) => ([false, true] as const).map((mythic): SkillDef => ({
        key: `${key}${mythic ? 'm' : ''}`, name: '근위 꿀벌 떼', icon: '꿀벌', kind: 'instant', first: phase === 1 ? 12 : null, period: 30, cast: 0, when: { phase: [phase], mythic },
        how: '꿀벌은 딜러 범위 딜에 같이 맞음. 살아 있는 동안 2초마다 한 명을 쏘고, 쏘인 사람은 90% 아래인 동안 벌침이 쌓임. 여럿을 조금씩보다 한 명씩 90% 위로',
        effect: { p: 'adds', n, add: { name: '근위 꿀벌', short: '꿀벌', art: 'mob-guard-bee', hp: 0.008, dmg: 0, every: 2, at: 'random', cleave: true,
          job: { p: 'sting', every: 2, dmg: U.dps(0.03), debuff: sting(mythic ? 7 : 5) } } },
      }))),
      { key: 'wind', name: '날갯짓 바람', icon: '바람', kind: 'aoe', first: 20, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'swarm2', in: 3 }, { p: 'start', skill: 'swarm2m', in: 3 }, { p: 'text', text: '비상!: 근위 꿀벌 7마리' },
    ] }],
    enrage: { name: '벌집 비상', period: 3, dmg: 180 },
  },
  // 요정 마술사 뿅뿅 (48 4-3 연회장): 차례 × 뒤집힌 축복 (차례 번호 중 한 명에게 거꾸로 마술). 35% 아래 차례 4명 · 거꾸로 2명.
  // 악몽은 차례 제한 8초. 목표 4:50 · 광폭화 6:30
  ppyong: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('지팡이 뿅', '뿅', '별 자국', U.tank(0.5)),
      ...([['clap', 3, 1], ['clap2', 4, 2]] as const).flatMap(([key, n, phase]) => ([false, true] as const).map((mythic): SkillDef => ({
        key: `${key}${mythic ? 'm' : ''}`, name: '순서대로 박수', icon: '박수', kind: 'instant', first: phase === 1 ? 20 : null, period: 26, cast: 0, when: { phase: [phase], mythic },
        how: '번호 순서대로 직접 힐을 한 번씩. 거꾸로 마술이 걸린 번호는 힐하면 아프니 먼저 해제하고 이어 가기',
        effect: { p: 'order', n, sec: mythic ? 8 : 10, wrong: U.dps(0.25), miss: U.dps(0.3), daze: { sec: 5, vuln: 1.2 } },
      }))),
      ...([['flip', 1, 1], ['flip2', 2, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '거꾸로 마술', icon: '거꾸', kind: 'instant', first: phase === 1 ? 20.5 : null, period: 26, cast: 0, when: { phase: [phase] },
        how: '받는 치유가 피해로 (광역 힐도). 차례 번호에 걸리면 먼저 해제하고 그 번호를 힐',
        effect: { p: 'debuff', n, pick: 'order', debuff: { name: '거꾸로 마술', type: '마법', left: 8, invert: true } },
      })),
      { key: 'vanish', name: '사라지는 마술', icon: '사라', kind: 'aoe', first: 12, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.22) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.35 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'clap2', in: 3 }, { p: 'start', skill: 'clap2m', in: 3 }, { p: 'start', skill: 'flip2', in: 3.5 },
      { p: 'text', text: '피날레: 차례 4명, 거꾸로 마술 2명' },
    ] }],
    enrage: { name: '마술쇼 폭주', period: 3, dmg: 190 },
  },
  // 버섯 여왕 아마니타 (48 4-3 왕좌, 10인 ⑦ 최종 · 요정단 수장): 1페이즈 고리 · 포자 → 70% 「쉿, 할아버지는 주무셔」 (숲 할아버지 나무: 사람 칸 큰 판,
  // 가득 채우면 보스가 받는 피해 +25%) → 40% 「영원한 축제」 (고리 · 포자 · 춤바람, 10초마다 보스 +5%). 악몽은 나무 20%로 시작 · 2페이즈에도 고리. 목표 6:00 · 광폭화 7:30
  amanita: {
    phase: [1, '1페이즈'],
    skills: [
      AUTO(U.tank(0.06)),
      SWAP_BUSTER('여왕의 홀', '홀', '왕관 자국', U.tank(0.55)),
      { key: 'ring', name: '요정 고리', icon: '고리', kind: 'instant', first: 8, period: 22, cast: 0, when: { phase: [1, 3] }, how: RING_HOW,
        effect: { p: 'ring', n: 2, sec: 20, dps: U.dps(0.05), every: 2, max: 2 } },
      { key: 'ringm', name: '요정 고리', icon: '고리', kind: 'instant', first: null, period: 22, cast: 0, when: { phase: [2], mythic: true }, how: RING_HOW,
        effect: { p: 'ring', n: 2, sec: 20, dps: U.dps(0.05), every: 2, max: 2 } },
      { key: 'spore', name: '포자 솜뭉치', icon: '솜', kind: 'instant', first: 14, period: 20, cast: 0, when: { phase: [1, 3] }, how: SPORE_HOW,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: spore(45 / 40) } },
      { key: 'tree', name: '숲 할아버지 나무', icon: '나무', kind: 'instant', first: null, period: 50, cast: 0, when: { phase: [2] },
        how: '나무 칸을 단일 힐로 25초 안에 가득 채우면 할아버지가 깨어나 보스가 받는 피해 +25%. 질병을 지우는 직업은 해제로 바로 깨움. 그동안 파티는 지속 힐에 맡기기',
        effect: { p: 'soul', name: '숲 할아버지 나무', short: '나무', art: 'mob-grandpa-tree', hp: 0.3, hpMythic: 0.2, sec: 25, type: '질병', size: 2,
          win: { text: '할아버지가 깨어나 왕관을 흔듦: 보스가 받는 피해 +25%', vuln: { pct: 0.25, sec: 20 }, fx: 'tree-wake' }, fail: { text: '꽃가루 폭발', dmg: U.dps(0.4) } } },
      { key: 'waltz', name: '포자 왈츠', icon: '왈츠', kind: 'aoe', first: null, period: 20, cast: 3, warn: 'aoe', when: { phase: [2] }, effect: { p: 'all', dmg: U.dps(0.18) } },
      { key: 'dance', name: '춤바람', icon: '춤', kind: 'instant', first: null, period: 22, cast: 0, when: { phase: [3] }, how: DANCE_HOW,
        effect: { p: 'debuff', n: 2, pick: 'others', debuff: DANCE } },
      { key: 'party', name: '영원한 축제', icon: '축제', kind: 'instant', first: null, period: 10, cast: 0, when: { phase: [3] },
        how: '10초마다 보스가 주는 피해 +5% (끝까지). 마나를 3페이즈에 남겨 두기', effect: { p: 'empower', boost: 0.05 } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.7 }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 쉿, 할아버지는 주무셔' }, { p: 'start', skill: 'tree', in: 2 }, { p: 'start', skill: 'waltz', in: 8 }, { p: 'start', skill: 'ringm', in: 6 },
        { p: 'text', text: '쉿, 할아버지는 주무셔: 숲 할아버지 나무를 25초 안에 채우기' },
      ] },
      { p: 'when', if: { phase: 2, hpBelow: 0.4 }, do: [
        { p: 'phase', n: 3, name: '3페이즈 · 영원한 축제' }, { p: 'start', skill: 'party', in: 10 }, { p: 'start', skill: 'dance', in: 4 },
        { p: 'text', text: '영원한 축제: 10초마다 보스 피해 +5%, 춤바람' },
      ] },
    ],
    enrage: { name: '축제 폭주', period: 3, dmg: 200 },
  },
  // 녹슨 문지기 (05 1장): 40% 아래 녹물 웅덩이
  // ---------- 묶음 D1 (51 3장 · 4-1, 붉은 용 일가 · 해제 독 + 마법 / 용암 대장간은 버려진 골렘 · 해제 없음) ----------
  // 온천지기 코볼트 뭉실 탐험판 (51 1-1, 탐험 ⑯ 화산재 고갯길 Lv 64): 평타 · 수건 휘두르기 · 김 서린 수건 (작게) · 연기 퐁퐁 1명. 던전 ⑬ 예습
  mungsil64: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      BUSTER('수건 휘두르기', '수건', 8, 15, 340),
      { key: 'melt', name: '김 서린 수건', icon: '김', kind: 'instant', first: 14, period: 26, cast: 0, how: MELT_HOW, effect: { p: 'melt', sec: 6, rate: 0.2 } },
      { key: 'steam', name: '뜨거운 김', icon: '뜨김', kind: 'aoe', first: 17, period: 26, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: 110 } },
      { key: 'smoke', name: '연기 퐁퐁', icon: '연기', kind: 'instant', first: 8, period: 18, cast: 0,
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '연기 퐁퐁', type: '독', left: 10, dot: 14 } } },
    ],
    enrage: { name: '온천 폭주', period: 2, dmg: 200 },
  },
  // 온천지기 코볼트 뭉실 (51 3-1 ①, 던전 ⑬ 용암 온천장): 녹는 보호막 × 독. 김 서린 수건 끝 3초 전에 뜨거운 김 예고 (열기가 끝나는 순간 맞음).
  // 50% 아래 수건 ↻ 20초. 악몽은 김 동안 받는 치유 −15%. 목표 2:45 · 광폭화 3:45
  mungsil: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('수건 휘두르기', '수건', 8, 15, U.tank(0.45)),
      { key: 'melt', name: '김 서린 수건', icon: '김', kind: 'instant', first: 15, period: 25, cast: 0, how: MELT_HOW, effect: { p: 'melt', sec: 8, rate: 0.25 } },
      { key: 'meltm', name: '김 서림', icon: '김', kind: 'instant', hidden: true, first: 15, period: 25, cast: 0, when: { mythic: true },
        effect: { p: 'debuff', n: 'all', debuff: { name: '김 서림', type: '마법', left: 8, lock: true, healCut: 0.15 } } },
      { key: 'steam', name: '뜨거운 김', icon: '뜨김', kind: 'aoe', first: 20, period: 25, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.25) } },
      { key: 'smoke', name: '연기 퐁퐁', icon: '연기', kind: 'instant', first: 8, period: 14, cast: 0,
        effect: { p: 'debuff', n: 2, pick: 'others', debuff: { name: '연기 퐁퐁', type: '독', left: 12, dot: U.dps(0.02) } } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'period', skill: 'melt', sec: 20 }, { p: 'period', skill: 'meltm', sec: 20 }, { p: 'period', skill: 'steam', sec: 20 },
      { p: 'text', text: '입장료!: 김 서린 수건이 잦아짐' },
    ] }],
    enrage: { name: '온천 폭주', period: 2, dmg: 270 },
  },
  // 사춘기 용 불퉁이 (51 3-1 ②, 용암 온천장 최종): 녹는 보호막 × 보물 욕심 · 줄 불길 (불씨 = 받는 치유 −25%).
  // 40% 아래 반짝이 내놔! 2명 · 뜨끈한 숨 ↻ 20초. 악몽은 반짝이에 맞은 사람에게 그을음 (독). 목표 3:15 · 광폭화 4:30
  bulttung: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      BUSTER('꼬리 철썩', '꼬리', 8, 14, U.tank(0.5)),
      ...greeds('greed', '반짝이 내놔!', '반짝', 10, 12, 2.5, [[1, 1], [2, 2]], U.dps(0.45), undefined, SOOT),
      ...rows('fire', '줄 불길', '불길', 16, 18, U.dps(0.35), false).map((d): SkillDef => ({ ...d, hitDebuff: EMBER })),
      { key: 'melt', name: '뜨끈한 숨', icon: '숨', kind: 'instant', first: 20, period: 30, cast: 0, how: MELT_HOW, effect: { p: 'melt', sec: 6, rate: 0.25 } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'greed2', in: 2 }, { p: 'start', skill: 'greed2m', in: 2 }, { p: 'period', skill: 'melt', sec: 20 },
      { p: 'text', text: '다 컸다고!: 반짝이 내놔! 2명, 뜨끈한 숨이 잦아짐' },
    ] }],
    enrage: { name: '사춘기 폭발', period: 2, dmg: 280 },
  },
  // 풀무 골렘 후끈이 (51 3-2 ①, 던전 ⑭ 용암 대장간): 녹는 보호막 × 탱커 교대 (5인은 4중첩이면 근접 딜러가 6초 대신 맞음, DebuffDef.sub).
  // 풀무질 끝 3초 전에 불티 예고. 악몽은 3중첩에서 교대. 목표 3:00 · 광폭화 4:00
  huggeun: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      ...([false, true] as const).map((mythic): SkillDef => ({
        key: `iron${mythic ? 'm' : ''}`, name: '달군 쇠', icon: '쇠', kind: 'instant', first: 6, period: 6, cast: 0, when: { mythic },
        how: `탱커가 받는 피해가 쌓이다 ${mythic ? 3 : 4}중첩이면 근접 딜러가 6초 동안 보스를 대신 맞음. 그 딜러에게 미리 지속 힐 · 보호막`,
        effect: { p: 'debuff', n: 1, pick: 'tank', debuff: { name: '달군 쇠', type: '물리', left: 20, lock: true, stackMax: mythic ? 3 : 4, vuln: 0.15, swap: mythic ? 3 : 4, sub: 6 } },
      })),
      { key: 'melt', name: '풀무질', icon: '풀무', kind: 'instant', first: 14, period: 28, cast: 0, how: MELT_HOW, effect: { p: 'melt', sec: 10, rate: 0.2 } },
      { key: 'spark', name: '불티', icon: '불티', kind: 'aoe', first: 21, period: 28, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
      { key: 'splash', name: '쇳물 튀김', icon: '쇳물', kind: 'instant', first: 10, period: 16, cast: 0,
        effect: { p: 'debuff', n: 2, debuff: { name: '쇳물', type: '물리', left: 4, lock: true, drop: U.dps(0.25), dot: U.dps(0.03) } } },
    ],
    enrage: { name: '화로 폭주', period: 2, dmg: 280 },
  },
  // 모루 골렘 땅땅 (51 3-2 ②, 용암 대장간 최종): 보물 욕심 × 무력화 · 진동. 30% 아래 판 가장자리 쇳물 바다 · 담금질 ↻ 30초.
  // 악몽은 담금질 실패 딜체 80%. 목표 3:30 · 광폭화 5:00
  ttangttang: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.08)),
      { ...BUSTER('망치 내려치기', '망치', 8, 14, U.tank(0.55)), cast: 2.5 },
      ...greeds('greed', '반짝반짝 두드리기', '반짝', 12, 15, 2.5, [[1, 2]], U.dps(0.4)),
      ...([false, true] as const).map((mythic): SkillDef => ({
        key: `stagger${mythic ? 'm' : ''}`, name: '담금질', icon: '담금', kind: 'instant', first: 25, period: 40, cast: 0, when: { mythic },
        how: '12초 동안 체력 70% 이상인 파티원의 딜만 게이지를 채움. 반짝반짝에 맞은 딜러를 바로 70% 위로',
        effect: { p: 'stagger', sec: 12, need: 7, hp: 0.7, tank: 2, win: { sec: 8, vuln: 1.3 }, fail: { dmg: U.dps(mythic ? 0.8 : 0.6), lock: 3 } },
      })),
      { key: 'quake', name: '모루 울림', icon: '울림', kind: 'aoe', first: 18, period: 22, cast: 1.5, warn: 'aoe', effect: { p: 'quake', dmg: U.dps(0.15), lock: 3 } },
      { key: 'sea', name: '쇳물 바다', icon: '쇳물', kind: 'zone', first: null, period: 20, cast: 2.5, warn: 'zone', dps: U.dps(0.06), dur: 12, cells: { p: 'edge' }, when: { phase: [2] } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.3 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'sea', in: 2 }, { p: 'period', skill: 'stagger', sec: 30 }, { p: 'period', skill: 'staggerm', sec: 30 },
      { p: 'text', text: '쇳물 바다: 가장자리가 끓고 담금질이 잦아짐' },
    ] }],
    enrage: { name: '대장간 폭주', period: 2, dmg: 300 },
  },
  // ---------- 10인 ⑧ 코볼트 보물 굴 (51 4-1, Lv 63 · 악몽 78): 꼬질 (탐험 ⑮에서 키움) · 덜컹이 · 번쩍이 ----------
  // 코볼트 보물 지킴이 꼬질 (갱도): 자폭 쫄 (불씨 꼬마 용 폭탄) × 독 연기 · 곡괭이 자국 5중첩 탱커 교대. 50% 아래 꼬마 용 3.
  // 악몽은 꼬마 용이 터질 때 모두에게 독 연기. 목표 4:30 · 광폭화 6:00
  kkojil: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      { key: 'pick', name: '곡괭이 콕콕', icon: '곡괭', kind: 'instant', first: 5, period: 5, cast: 0, how: '5중첩이면 부탱커가 보스를 가져감. 교대한 탱커에게도 지속 힐',
        effect: { p: 'debuff', n: 1, pick: 'tank', debuff: { name: '곡괭이 자국', type: '물리', left: 20, lock: true, stackMax: 5, vuln: 0.12, swap: 5 } } },
      ...([[1, 2], [2, 3]] as const).flatMap(([phase, n]) => ([false, true] as const).map((mythic): SkillDef => ({
        key: `whelp${phase}${mythic ? 'm' : ''}`, name: '불씨 꼬마 용', icon: '불씨', kind: 'instant', first: phase === 1 ? 20 : null, period: 30, cast: 0, when: { phase: [phase], mythic },
        how: '8초 안에 딜러가 못 잡으면 터져서 모두 아픔. 못 잡을 것 같으면 광역 선힐',
        effect: { p: 'adds', n, add: { name: '불씨 꼬마 용', short: '불씨', art: 'mob-ember-whelp', hp: 0.012, dmg: 0, every: 0,
          job: { p: 'bomb', sec: 8, dmg: U.dps(0.2), debuff: mythic ? { name: '독 연기', type: '독', left: 8, dot: U.dps(0.015) } : undefined } } },
      }))),
      { key: 'smoke', name: '독 연기', icon: '연기', kind: 'instant', first: 10, period: 16, cast: 0,
        effect: { p: 'debuff', n: 3, pick: 'others', debuff: { name: '독 연기', type: '독', left: 12, dot: U.dps(0.02) } } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'whelp2', in: 3 }, { p: 'start', skill: 'whelp2m', in: 3 }, { p: 'text', text: '보물 지킴이 함성: 불씨 꼬마 용 3' },
    ] }],
    enrage: { name: '보물 지킴이 화남', period: 3, dmg: 180 },
  },
  // 코볼트 수레꾼 덜컹이 (수레길): 행진 (보물 수레가 세로 줄을 1초마다 한 줄씩 훑음, 못 피함) × 보물 욕심 (금화 던지기 + 무거운 주머니).
  // 악몽은 수레가 돌아오며 한 번 더 (왼쪽 → 오른쪽 → 왼쪽). 목표 4:30 · 광폭화 6:00
  deolkeong: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      ...([['cart', 15, 'left', undefined], ['cartm', 21, 'right', true]] as const).map(([key, first, from, mythic]): SkillDef => ({
        key, name: '보물 수레', icon: '수레', kind: 'zone', first, period: 24, cast: 3, warn: 'zone', fixed: true, hitDmg: U.dps(0.25), cells: { p: 'flow', every: 1, from },
        when: mythic ? { mythic } : undefined, how: '수레가 세로 줄을 한 줄씩 밀고 지나감 (못 피함). 다음 줄 사람을 미리 채우기',
      })),
      ...greeds('coin', '금화 던지기', '금화', 10, 12, 2, [[1, 2]], U.dps(0.35), PURSE),
      { key: 'wheel', name: '바퀴 자국', icon: '바퀴', kind: 'instant', first: 8, period: 18, cast: 0,
        effect: { p: 'debuff', n: 3, debuff: { name: '바퀴 자국', type: '마법', left: 8, healCut: 0.2, drop: U.dps(0.15) } } },
    ],
    enrage: { name: '수레 폭주', period: 3, dmg: 180 },
  },
  // 코볼트 대장 번쩍이 (보물방, 10인 ⑧ 최종): 보물 욕심 × 사냥 (모두를 가운데쯤) · 판 위 금화 더미 (15초 안에 못 깨면 보스 피해 +20%, 겹침).
  // 30% 아래 보물 비 · 내 거야! 3명. 악몽은 내 거야!에 맞은 사람이 6초 받는 피해 +15% (사냥까지 맞기 쉬움). 목표 5:00 · 광폭화 6:30
  beonjjeok: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      { ...BUSTER('왕관 박치기', '왕관', 8, 15, U.tank(0.5)), cast: 2.5 },
      ...greeds('greed', '내 거야!', '내거', 10, 13, 2.5, [[1, 2], [2, 3]], U.dps(0.4), undefined, ROBBED),
      { key: 'hunt', name: '쫄쫄이 부하', icon: '쫄쫄', kind: 'instant', first: 12, period: 11, cast: 2, effect: { p: 'hunt', dmg: U.dps(0.35) } },
      { key: 'hoard', name: '금화 더미', icon: '금화', kind: 'instant', first: 25, period: 35, cast: 0,
        how: '15초 안에 딜러가 못 깨면 번쩍이가 주워 보스 피해 +20% (겹침). 딜러를 살려 두기',
        effect: { p: 'adds', n: 1, add: { name: '금화 더미', short: '금화', art: 'mob-gold-pile', hp: 0.02, dmg: 0, every: 0, at: 'random', job: { p: 'hoard', sec: 15, boost: 0.2 } } } },
      { key: 'rain', name: '보물 비', icon: '보물', kind: 'aoe', first: null, period: 25, cast: 3, warn: 'aoe', when: { phase: [2] }, effect: { p: 'all', dmg: U.dps(0.25) } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.3 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'greed2', in: 2 }, { p: 'start', skill: 'greed2m', in: 2 }, { p: 'start', skill: 'rain', in: 5 },
      { p: 'text', text: '보물 비!: 내 거야! 3명' },
    ] }],
    enrage: { name: '대장님 화남', period: 3, dmg: 190 },
  },
  // ---------- 10인 ⑨ 어미 용의 둥지 (51 4-2, Lv 67 · 악몽 82): 삼남매 · 단단이 · 루비나 ----------
  // 새끼 용 삼남매 (알둥지): 몸통 셋 (고르게 깎음) · 부화하는 알 (12초 안에 못 깨면 새끼 용) × 녹는 보호막 (아기 불꽃 끝에 광역).
  // 악몽은 알 부화 10초. 목표 4:30 · 광폭화 6:00
  whelps: {
    phase: [1, ''],
    bodies: WHELPS.map(name => ({ name, hp: WHELP_HP, boss: true })),
    split: true,
    skills: [
      ...WHELPS.map((_, i): SkillDef => ({ ...AUTO(U.tank(0.04)), key: `auto${i}`, first: 2 + i * 0.6, when: { bodyAlive: [i] } })),
      ...([false, true] as const).map((mythic): SkillDef => ({
        key: `egg${mythic ? 'm' : ''}`, name: '굴러온 알', icon: '알', kind: 'instant', first: 12, period: 30, cast: 0, when: { mythic },
        how: `${mythic ? 10 : 12}초 안에 딜러가 알을 못 깨면 새끼 용이 나와 탱커를 때림. 알을 치는 동안 파티는 지속 힐로`,
        effect: { p: 'adds', n: 1, add: { name: '굴러온 알', short: '알', art: 'mob-egg', hp: 0.015, dmg: 0, every: 0, at: 'random',
          job: { p: 'hatch', sec: mythic ? 10 : 12, add: { name: '새끼 용', short: '새끼', art: 'mob-ember-whelp', hp: 0.04, dmg: U.tank(0.04), every: 2, at: 'front' } } } },
      })),
      { key: 'melt', name: '아기 불꽃', icon: '불꽃', kind: 'instant', first: 16, period: 26, cast: 0, how: MELT_HOW, effect: { p: 'melt', sec: 8, rate: 0.2 } },
      { key: 'boom', name: '불꽃 재채기', icon: '재채', kind: 'aoe', first: 21, period: 26, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.2) } },
      { key: 'snort', name: '콧김 퉤', icon: '콧김', kind: 'instant', first: 8, period: 15, cast: 0,
        effect: { p: 'debuff', n: 3, debuff: { name: '콧김', type: '마법', left: 8, healCut: 0.25, drop: U.dps(0.15) } } },
    ],
    enrage: { name: '삼남매 떼쓰기', period: 3, dmg: 180 },
  },
  // 용 비늘 경비대장 단단이 (다리): 탱커 교대 × 녹는 보호막 · 줄 불길 · 부탱커에게 비늘 방패 돌진. 악몽은 줄 불길 두 줄. 목표 4:50 · 광폭화 6:30
  dandani: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      { key: 'spear', name: '비늘 창', icon: '창', kind: 'instant', first: 6, period: 6, cast: 0, how: '4중첩이면 다른 탱커가 보스를 가져감. 열기 동안 교대가 겹치면 보호막 대신 힐로',
        effect: { p: 'debuff', n: 1, pick: 'tank', debuff: { name: '비늘 창', type: '물리', left: 20, lock: true, stackMax: 4, vuln: 0.15, swap: 4 } } },
      { key: 'melt', name: '다리 위 열기', icon: '열기', kind: 'instant', first: 15, period: 30, cast: 0, how: MELT_HOW, effect: { p: 'melt', sec: 10, rate: 0.25 } },
      ...rows('fire', '줄 불길', '불길', 12, 16, U.dps(0.35), { mythic: true }).map((d): SkillDef => ({ ...d, hitDebuff: EMBER, hitFx: 'dragon-breath' })),
      { key: 'charge', name: '비늘 방패 돌진', icon: '돌진', kind: 'buster', first: 20, period: 20, cast: 2, warn: 'buster', dmg: U.tank(0.45), target: 'offtank',
        how: '보스를 안 맞는 탱커가 맞음. 교대 직전이면 그 탱커에게 미리 보호막', effect: { p: 'tank' } },
    ],
    enrage: { name: '경비대장 화남', period: 3, dmg: 190 },
  },
  // 어미 용 루비나 (보물더미, 10인 ⑨ 최종 · 붉은 용 일가 수장): 1페이즈 보물 욕심 · 눈부심 → 70% 날아오름 (녹는 보호막 · 화산재 비 · 새끼 용) →
  // 40% 보물 지키기 (모두 + 사냥 · 용의 숨결 두 줄). 악몽은 3페이즈 시작에 진주 목걸이 반짝 (전원 받는 치유 −20%, 못 지움). 목표 6:00 · 광폭화 8:00
  rubina: {
    phase: [1, '1페이즈 · 낮잠 깸'],
    skills: [
      AUTO(U.tank(0.07)),
      { ...BUSTER('앞발 내려치기', '앞발', 8, 15, U.tank(0.55)), cast: 2.5 },
      ...greeds('greed', '내 보물 만지지 마!', '보물', 10, 12, 2.5, [[1, 2], [3, 2]], U.dps(0.4)),
      { key: 'showoff', name: '보물 자랑', icon: '자랑', kind: 'instant', first: 14, period: 18, cast: 0, when: { phase: [1, 3] },
        effect: { p: 'debuff', n: 3, debuff: { name: '눈부심', type: '마법', left: 8, healCut: 0.25 } } },
      { key: 'melt', name: '뜨거운 날갯짓', icon: '날개', kind: 'instant', first: null, period: 28, cast: 0, when: { phase: [2, 3] }, how: MELT_HOW, effect: { p: 'melt', sec: 10, rate: 0.25 } },
      { key: 'ash', name: '화산재 비', icon: '화산', kind: 'aoe', first: null, period: 20, cast: 3, warn: 'aoe', when: { phase: [2, 3] },
        effect: { p: 'all', dmg: U.dps(0.15), debuff: { name: '화산재', type: '독', left: 6, dot: U.dps(0.01) } } },
      { key: 'kids', name: '우리 애들!', icon: '애들', kind: 'instant', first: null, period: 40, cast: 0, when: { phase: [2, 3] }, how: '새끼 용 둘이 탱커를 때림. 딜러가 잡는 동안 부탱커에게 지속 힐',
        effect: { p: 'adds', n: 2, add: { name: '새끼 용', short: '새끼', art: 'mob-ember-whelp', hp: 0.02, dmg: U.tank(0.03), every: 2, at: 'front' } } },
      { key: 'hunt', name: '제일 약한 손님', icon: '손님', kind: 'instant', first: null, period: 13, cast: 2, when: { phase: [3] }, effect: { p: 'hunt', dmg: U.dps(0.3) } },
      ...[0, 1, 2].flatMap((i): SkillDef[] => (['', 'b'] as const).map((b): SkillDef => ({
        key: `breath${i}${b}`, name: '용의 숨결', icon: '숨결', kind: 'zone', first: null, period: 75, cast: 4, warn: 'zone', fixed: true, hitDmg: U.dps(0.3), hitFx: 'dragon-breath',
        cells: { p: 'line', at: (['back', 'mid', 'front'] as const)[(i + (b ? 1 : 0)) % 3] }, when: { phase: [3] }, ...(b ? { hidden: true } : {}),
        how: '가로 두 줄이 맞음 (못 피함). 예고된 두 줄을 미리 채우기',
      }))),
      { key: 'pearl', name: '진주 목걸이 반짝', icon: '진주', kind: 'instant', first: null, period: 9999, cast: 0, when: { phase: [3], mythic: true },
        how: '3페이즈 시작에 모두 8초 받는 치유 −20% (못 지움). 그 전에 모두를 채워 두기',
        effect: { p: 'debuff', n: 'all', debuff: { name: '진주 반짝', type: '마법', left: 8, lock: true, healCut: 0.2 } } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.7 }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 날아오름' }, { p: 'start', skill: 'melt', in: 3 }, { p: 'start', skill: 'ash', in: 8 }, { p: 'start', skill: 'kids', in: 5 },
        { p: 'text', text: '날아오름: 뜨거운 날갯짓 · 화산재 비 · 우리 애들!' },
      ] },
      { p: 'when', if: { phase: 2, hpBelow: 0.4 }, do: [
        { p: 'phase', n: 3, name: '3페이즈 · 보물 지키기' }, { p: 'start', skill: 'pearl', in: 0 }, { p: 'start', skill: 'greed3', in: 4 }, { p: 'start', skill: 'hunt', in: 6 },
        ...[0, 1, 2].flatMap((i): FlowDo[] => (['', 'b'] as const).map((b): FlowDo => ({ p: 'start', skill: `breath${i}${b}`, in: 6 + i * 25 }))),
        { p: 'text', text: '보물 지키기: 보물 욕심 · 사냥 · 용의 숨결 두 줄이 함께' },
      ] },
    ],
    enrage: { name: '어미 용의 분노', period: 3, dmg: 200 },
  },
  // ---------- 20인 ① 가라앉은 대성당 2 · 3 · 4구역 (51 4-3, Lv 70 · 악몽 80 · 심연 · 모든 유형) ----------
  // 물그림자 기사 셋 탐험판 (51 1-1, 탐험 ⑰ 잠긴 호숫가 Lv 68): 평타 · 물그림자 사슬 (균형형 1쌍 = 원거리 딜러와 나) · 물결 베기. 대성당 회랑 예습
  knights68: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      { key: 'chain', name: '물그림자 사슬', icon: '사슬', kind: 'instant', first: 10, period: 25, cast: 0, how: '이어진 둘의 체력 비율을 비슷하게. 30%p 넘게 벌어지면 끊어지며 둘 다 아픔',
        effect: { p: 'link', kind: 'balance', name: '물그림자 사슬', sec: 12, gap: 0.3, dmg: 160 } },
      { key: 'wave', name: '물결 베기', icon: '물결', kind: 'aoe', first: 15, period: 14, cast: 2.5, warn: 'aoe', effect: { p: 'all', dmg: 120 } },
    ],
    enrage: { name: '물그림자 폭주', period: 2, dmg: 200 },
  },
  // 물그림자 기사 셋 (회랑): 몸통 셋 (차례로 쓰러뜨림, 하나가 쓰러질 때마다 남은 기사 +15%) · 20인 생명 사슬 균형형 3쌍 × 끌어당김 · 물결 베기 (살아 있는 기사가 맡은 2열).
  // 악몽은 사슬 4쌍. 목표 4:30 · 광폭화 6:00
  knights: {
    phase: [1, ''],
    bodies: KNIGHTS.map(name => ({ name, hp: KNIGHT_HP, boss: true })),
    skills: [
      ...KNIGHTS.map((_, i): SkillDef => ({ ...AUTO(U.tank(0.04)), key: `auto${i}`, first: 2 + i * 0.6, when: { bodyAlive: [i] } })),
      { key: 'chain', name: '물그림자 사슬', icon: '사슬', kind: 'instant', first: 10, period: 25, cast: 0,
        how: '세 쌍 (악몽 네 쌍)이 이어짐. 짝끼리 체력 비율을 비슷하게, 끌려간 사람의 짝도 같이 채우기',
        effect: { p: 'link', kind: 'balance', name: '물그림자 사슬', sec: 15, pick: 'others', gap: 0.3, dmg: U.dps(0.4), pairs: 3, pairsMythic: 4 } },
      { key: 'wave', name: '물결 베기', icon: '물결', kind: 'zone', first: 14, period: 12, cast: 2.5, warn: 'zone', hitDmg: U.dps(0.3),
        cells: { p: 'bodyCols', bodies: 3, per: 2, nMythic: 1 }, how: '살아 있는 기사가 맡은 두 열을 벰. 파티원이 비키지 못하면 그 사람부터' },
      { key: 'pull', name: '깊은 물로', icon: '깊은', kind: 'buster', first: 18, period: 18, cast: 2, warn: 'buster', target: { p: 'back', n: 1 },
        how: '뒷줄 한 명이 끌려와 평타를 나눠 맞음. 사슬 짝이면 짝도 같이 채우기', effect: { p: 'pull', sec: 4, dmg: U.dps(0.12) } },
      ...KNIGHTS.map((_, i): SkillDef => ({ key: `oath${i}`, name: '셋이 하나로', icon: '하나', hidden: true, first: null, period: 9999, cast: 0,
        how: '기사가 쓰러질 때마다 남은 기사 피해 +15% (끝까지)', effect: { p: 'empower', boost: 0.15 } })),
    ],
    flow: KNIGHTS.map((_, i): FlowStep => ({ p: 'when', if: { idle: `oath${i}`, bodiesDead: [i] }, do: [{ p: 'start', skill: `oath${i}`, in: 0 }] })),
    enrage: { name: '기사단 돌격', period: 3, dmg: 200 },
  },
  // 물오르간 정령 우웅이 (오르간): 진동 × 치유 상한 · 20인 무력화 (불협화음 게이지를 모두 함께). 파이프 소리 (종 · 방울 아님).
  // 악몽은 물빛 화음 70%까지 (무력화 조건은 65%로 낮춰 상한에 걸린 사람도 채울 수 있게). 목표 4:50 · 광폭화 6:30
  uwoong: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      { key: 'quake', name: '낮은음 파동', icon: '파동', kind: 'aoe', first: 12, period: 20, cast: 1.5, warn: 'aoe', effect: { p: 'quake', dmg: U.dps(0.15), lock: 3 } },
      ...([false, true] as const).map((mythic): SkillDef => ({
        key: `chord${mythic ? 'm' : ''}`, name: '물빛 화음', icon: '화음', kind: 'instant', first: 8, period: 22, cast: 0, when: { mythic }, how: INK_HOW,
        effect: { p: 'debuff', n: 6, debuff: { name: '물빛 화음', type: '마법', left: 10, cap: mythic ? 0.7 : 0.8 } },
      })),
      { key: 'stagger', name: '불협화음', icon: '불협', kind: 'instant', first: 30, period: 45, cast: 0,
        how: '15초 동안 체력 70% (악몽 65%) 이상인 파티원의 딜만 게이지를 채움. 상한에 걸린 사람은 상한까지라도 채우기',
        effect: { p: 'stagger', sec: 15, need: 8, hp: 0.7, hpMythic: 0.65, tank: 2, win: { sec: 8, vuln: 1.3 }, fail: { dmg: U.dps(0.55), lock: 3 } } },
      { key: 'drops', name: '음표 물방울', icon: '음표', kind: 'instant', first: 6, period: 14, cast: 0,
        effect: { p: 'debuff', n: 4, debuff: { name: '젖은 음표', type: '물리', left: 2, lock: true, drop: U.dps(0.2) } } },
    ],
    enrage: { name: '오르간 폭주', period: 3, dmg: 200 },
  },
  // 문지기 그림자 오르말 (성소, 20인 ① 최종): 1페이즈 조각 욕심 · 그림자 손길 (유형 무작위) → 65% 문 두드리기 (문에 박힌 탑 조각 셋 = 사람 칸, 못 채우면 문이 한 칸 열림 ·
  // 차가운 심연 숨결) → 35% 문 아래로 (모두 + 심연의 물결 · 그림자 가시 2명). 악몽은 조각 체력 1.5배 · 못 채울 때마다 오르말 +5%. 목표 6:00 · 광폭화 8:00
  ormal: {
    phase: [1, '1페이즈 · 조각 빼앗기'],
    skills: [
      AUTO(U.tank(0.07)),
      { ...BUSTER('그림자 지팡이', '지팡', 8, 15, U.tank(0.55)), cast: 2.5 },
      ...greeds('greed', '조각 욕심', '욕심', 10, 12, 2.5, [[1, 3], [3, 3]], U.dps(0.4)),
      { key: 'touch', name: '그림자 손길', icon: '손길', kind: 'instant', first: 14, period: 16, cast: 0, when: { phase: [1, 3] },
        how: '4명에게 질병 · 독 · 저주 · 마법 중 하나씩 무작위. 지울 수 있는 것부터',
        effect: { p: 'cycle', n: 4, random: true, debuffs: SHADOW_TOUCH } },
      ...([false, true] as const).map((mythic): SkillDef => ({
        key: `shards${mythic ? 'm' : ''}`, name: '조각 지키기', icon: '조각', kind: 'instant', first: null, period: 30, cast: 0, when: { phase: [2], mythic },
        how: '문에 박힌 조각 셋을 20초 안에 단일 힐로 가득 채우기. 못 채운 조각마다 문이 한 칸 열려 모두 아픔. 그동안 파티는 지속 힐에 맡기기',
        effect: { p: 'soul', name: '탑 조각', short: '조각', art: 'mob-tower-shard', hp: 0.5, sec: 20, size: 1.5, sizeMythic: 2.25, n: 3,
          win: { text: '조각을 지켜 냄: 오르말이 받는 피해 +10%', vuln: { pct: 0.1, sec: 10 } },
          fail: { text: '문이 한 칸 열림', dmg: U.dps(0.3), fx: 'door-open', ...(mythic ? { boost: 0.05 } : {}) } },
      })),
      { key: 'melt', name: '차가운 심연 숨결', icon: '숨결', kind: 'instant', first: null, period: 28, cast: 0, when: { phase: [2, 3] }, how: MELT_HOW, effect: { p: 'melt', sec: 10, rate: 0.25 } },
      { key: 'wave', name: '심연의 물결', icon: '물결', kind: 'aoe', first: null, period: 20, cast: 3, warn: 'aoe', when: { phase: [3] }, effect: { p: 'all', dmg: U.dps(0.25) } },
      { key: 'hunt', name: '그림자 가시', icon: '가시', kind: 'instant', first: null, period: 11, cast: 2, when: { phase: [3] }, effect: { p: 'hunt', dmg: U.dps(0.35), n: 2 } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.65 }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 문 두드리기' }, { p: 'start', skill: 'shards', in: 2 }, { p: 'start', skill: 'shardsm', in: 2 }, { p: 'start', skill: 'melt', in: 6 },
        { p: 'text', text: '문 두드리기: 문에 박힌 조각 셋을 채우기' },
      ] },
      { p: 'when', if: { phase: 2, hpBelow: 0.35 }, do: [
        { p: 'phase', n: 3, name: '3페이즈 · 문 아래로' }, { p: 'start', skill: 'greed3', in: 4 }, { p: 'start', skill: 'wave', in: 8 }, { p: 'start', skill: 'hunt', in: 6 },
        { p: 'text', text: '문 아래로: 조각 욕심 · 그림자 가시 · 심연의 물결' },
      ] },
    ],
    enrage: { name: '심연의 문', period: 3, dmg: 220 },
  },
  // ---------- 묶음 E1 10인 ⑩ 노을 시장 (54 4-1, Lv 71 · 악몽 86 · 모래 왕국 · 질병 + 저주): 꾸벅 · 끄덕 · 혹돌이 · 냥크스 ----------
  // 졸린 모래 병정 꾸벅 · 끄덕 (입구): 몸통 둘 (고르게 깎음, 하나가 쓰러지면 남은 쪽 +30%) × 신기루 창 (신기루 쉬운 판, 진짜 1 + 가짜 1).
  // 악몽은 신기루 창 진짜 2 (표시 3명). 목표 4:30 · 광폭화 6:00
  kkubeok: {
    phase: [1, ''],
    bodies: GUARDS.map(name => ({ name, hp: GUARD_HP, boss: true })),
    split: true,
    skills: [
      ...GUARDS.map((_, i): SkillDef => ({ ...AUTO(U.tank(0.04)), key: `auto${i}`, first: 2 + i * 0.8, when: { bodyAlive: [i] } })),
      { key: 'spear', name: '신기루 창', icon: '창', kind: 'buster', first: 10, period: 14, cast: 2.5, warn: 'buster', target: { p: 'random', n: 1, nMythic: 2 }, mirage: { n: 1 },
        how: MIRAGE_HOW, effect: { p: 'strike', dmg: U.dps(0.45) } },
      { key: 'cough', name: '모래 기침', icon: '기침', kind: 'instant', first: 6, period: 16, cast: 0, effect: { p: 'debuff', n: 3, debuff: SAND_COUGH } },
      ...GUARDS.map((_, i): SkillDef => ({ key: `wake${i}`, name: '깜짝 기상', icon: '기상', hidden: true, first: null, period: 9999, cast: 0,
        how: '하나가 먼저 쓰러지면 남은 병정 피해 +30% (끝까지). 둘을 고르게 깎기', effect: { p: 'empower', boost: 0.3 } })),
    ],
    flow: GUARDS.map((_, i): FlowStep => ({ p: 'when', if: { idle: `wake${1 - i}`, bodiesDead: [i] }, do: [{ p: 'start', skill: `wake${1 - i}`, in: 0 }] })),
    enrage: { name: '병정 형제 깜짝 기상', period: 3, dmg: 190 },
  },
  // 향신료 낙타 상인 혹돌이 (골목): 옮겨붙는 질병 (매운 재채기, 지우면 이웃 칸으로 +50%) × 신기루 짐더미 (장판 진짜 1 + 가짜 1) · 흥정 실패 (저주).
  // 악몽은 매운 재채기 3명. 목표 4:30 · 광폭화 6:00
  hokdol: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('낙타 침 퉤', '침', 8, 15, U.tank(0.45)),
      { key: 'sneeze', name: '매운 재채기', icon: '재채', kind: 'instant', first: 6, period: 18, cast: 0,
        how: '지우면 옆 칸 아군에게 옮겨붙어 세지고 (혼자면 사라짐), 두면 끝날 때 보스가 조금 강해짐. 짐더미를 피해 흩어진 뒤 혼자 선 사람부터 지우기',
        effect: { p: 'debuff', n: 2, nMythic: 3, pick: 'others', debuff: { name: '매운 재채기', type: '질병', left: 12, dot: U.dps(0.025), end: { p: 'jump', sec: 12, mult: 1.5, boost: 0.02 } } } },
      { key: 'pile', name: '신기루 짐더미', icon: '짐', kind: 'zone', first: 12, period: 18, cast: 3, warn: 'zone', hitDmg: U.dps(0.4), cells: { p: 'around' }, mirage: { n: 1 },
        how: '두 곳 중 한 곳은 신기루 (끝 1초에 걷힘). 파티원이 알아서 피함. 못 피한 사람부터 채우기' },
      { key: 'haggle', name: '흥정 실패', icon: '흥정', kind: 'instant', first: 15, period: 20, cast: 0, effect: { p: 'debuff', n: 2, debuff: { name: '흥정 실패', type: '저주', left: 8, healCut: 0.25 } } },
    ],
    enrage: { name: '낙타 떼 돌진', period: 3, dmg: 190 },
  },
  // 수수께끼 고양이 냥크스 (성문, 10인 ⑩ 최종): 차례 × 신기루 (숫자 하나는 신기루 숫자, 시작 5초 뒤 걷힘) · 신기루 꼬리 (광역 반은 신기루) · 천 년 졸음.
  // 40% 아래 마지막 수수께끼 (진짜 4). 악몽은 틀리면 전원 딜체 15%. 목표 5:00 · 광폭화 6:30
  nyanx: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      { ...BUSTER('앞발', '앞발', 8, 15, U.tank(0.5)), cast: 2.5 },
      ...([['riddle', 3, 1], ['riddle2', 4, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '수수께끼', icon: '수수', kind: 'instant', first: phase === 1 ? 20 : null, period: 30, cast: 2, when: { phase: [phase] },
        how: '번호 순서대로 직접 힐을 한 번씩. 번호 하나는 신기루 숫자 (시작 5초 뒤 걷힘): ①부터 시작하고 겹친 숫자는 걷힐 때까지 기다리기',
        effect: { p: 'order', n, sec: 12, wrong: U.dps(0.25), miss: U.dps(0.4), daze: { sec: 5, vuln: 1.2 }, fake: { at: 5 }, wrongAll: U.dps(0.15) },
      })),
      { key: 'tail', name: '신기루 꼬리', icon: '꼬리', kind: 'aoe', first: 14, period: 20, cast: 3, warn: 'aoe', mirage: { chance: 0.5 },
        how: '반은 신기루 (끝 1초에 걷히면 아무 일도 없음). 걷히기 전에는 지속 힐만 깔고, 진짜면 맞은 뒤 광역 힐', effect: { p: 'all', dmg: U.dps(0.3) } },
      { key: 'sleepy', name: '천 년 졸음', icon: '졸음', kind: 'instant', first: 10, period: 18, cast: 0, effect: { p: 'debuff', n: 2, debuff: SLEEPY } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'riddle2', in: 4 }, { p: 'text', text: '마지막 수수께끼: 숫자 넷 + 신기루 숫자 하나' },
    ] }],
    enrage: { name: '고양이 심술', period: 3, dmg: 200 },
  },
  // ---------- 묶음 E1 20인 ② 물밑 수도원 (54 4-4, Lv 73 · 악몽 83 · 심연 · 모든 유형): 흐물이 · 비추미 · 깊은잠 ----------
  // 해파리 정원사 흐물이 탐험판 (54 1-1, 탐험 ⑱ 물밑 계단 Lv 72): 평타 · 빛 고리 (1명) · 물방울 진동. 20인 수도원 연못 예습
  heumul72: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      { key: 'ring', name: '빛 고리', icon: '고리', kind: 'instant', first: 8, period: 20, cast: 0, how: RING_HOW,
        effect: { p: 'ring', n: 1, sec: 18, dps: 15, every: 2, max: 2 } },
      { key: 'quake', name: '물방울 진동', icon: '진동', kind: 'aoe', first: 12, period: 20, cast: 1.5, warn: 'aoe', effect: { p: 'quake', dmg: 60, lock: 3 } },
    ],
    enrage: { name: '해파리 떼', period: 2, dmg: 200 },
  },
  // 해파리 정원사 흐물이 (연못): 20인 요정 고리 (3명, 악몽 5명) × 진동 · 촉수 쓰다듬기 (5명 · 마법 받는 치유 −20%). 목표 4:30 · 광폭화 6:00
  heumul: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      { key: 'ring', name: '빛 고리', icon: '고리', kind: 'instant', first: 8, period: 22, cast: 0, how: RING_HOW,
        effect: { p: 'ring', n: 3, nMythic: 5, sec: 20, dps: U.dps(0.03), every: 2, max: 2 } },
      { key: 'quake', name: '물방울 진동', icon: '진동', kind: 'aoe', first: 12, period: 20, cast: 1.5, warn: 'aoe', effect: { p: 'quake', dmg: U.dps(0.12), lock: 3 } },
      { key: 'tentacle', name: '촉수 쓰다듬기', icon: '촉수', kind: 'instant', first: 5, period: 14, cast: 0,
        effect: { p: 'debuff', n: 5, debuff: { name: '촉수 자국', type: '마법', left: 6, healCut: 0.2, drop: U.dps(0.18) } } },
    ],
    enrage: { name: '해파리 정원 폭주', period: 3, dmg: 200 },
  },
  // 거울 사서 비추미 (서고): 20인 신기루 (거울 책장 = 진짜 1 + 거울 둘) × 진동 (조용히! 는 걷히기 0.5초 전에 맞음) · 책 먼지 (질병) · 연체료 (저주).
  // 악몽은 거울 책장 진짜 2 (표시 4명). 목표 5:00 · 광폭화 6:30
  bichumi: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      { key: 'shelf', name: '거울 책장', icon: '책장', kind: 'buster', first: 10, period: 13, cast: 3, warn: 'buster', target: { p: 'random', n: 1, nMythic: 2 }, mirage: { n: 2 },
        how: '셋 가운데 둘은 거울 (끝 1초에 걷힘). 바로 앞에 진동이 와서 긴 시전은 끊김: 걷히면 즉시 스킬 · 보호막으로', effect: { p: 'strike', dmg: U.dps(0.6) } },
      { key: 'hush', name: '조용히!', icon: '쉿', kind: 'aoe', first: 10, period: 13, cast: 1.5, warn: 'aoe', effect: { p: 'quake', dmg: U.dps(0.1), lock: 3 } },
      { key: 'dust', name: '책 먼지', icon: '먼지', kind: 'instant', first: 6, period: 16, cast: 0, effect: { p: 'debuff', n: 4, debuff: { name: '책 먼지', type: '질병', left: 12, dot: U.dps(0.02) } } },
      { key: 'fine', name: '연체료', icon: '연체', kind: 'instant', first: 15, period: 20, cast: 0, effect: { p: 'debuff', n: 3, debuff: { name: '연체료', type: '저주', left: 8, healCut: 0.3 } } },
    ],
    enrage: { name: '도서관 대소동', period: 3, dmg: 210 },
  },
  // 심연 수도원장 깊은잠 (제단, 20인 ② 최종): 1페이즈 잠의 기도 (잠의 표식 3명 · 그림자 손길) → 65% 무너지는 제단 (깊은 물 장판 3곳, 끝난 뒤 가장자리 구멍 · 표식 4명)
  // → 35% 깨어나는 심장 (모두 + 심장 박동, 박동마다 +3%). 악몽은 표식 10초 (보통 12초, 치유 배율 0.6 뒤 54 4-4의 4 · 5명 · 10초에서 줄임). 목표 6:00 · 광폭화 8:00
  gipeun: {
    phase: [1, '1페이즈 · 잠의 기도'],
    skills: [
      AUTO(U.tank(0.07)),
      { ...BUSTER('지팡이 내려치기', '지팡', 8, 15, U.tank(0.55)), cast: 2.5 },
      ...([['mark', 3, [1]], ['mark2', 4, [2, 3]]] as const).flatMap(([key, n, phase]) => ([false, true] as const).map((mythic): SkillDef => ({
        key: `${key}${mythic ? 'm' : ''}`, name: '잠의 표식', icon: '표식', kind: 'instant', first: phase[0] === 1 ? 12 : null, period: 25, cast: 0, when: { phase: [...phase], mythic },
        how: `${n}명에게 표식. ${mythic ? 10 : 12}초 안에 100%까지 채우면 사라지고, 못 채우면 크게 아픔 (못 지움). 광역이 겹치기 전에 몰아서`,
        effect: { p: 'debuff', n, pick: 'others', debuff: { name: '잠의 표식', type: '마법', left: mythic ? 10 : 12, lock: true, cureAt: 1, drop: U.dps(0.25), end: { p: 'hit', dmg: U.dps(0.5) } } },
      }))),
      { key: 'touch', name: '그림자 손길', icon: '손길', kind: 'instant', first: 16, period: 16, cast: 0, when: { phase: [1, 3] },
        how: '4명에게 질병 · 독 · 저주 · 마법 중 하나씩 무작위. 지울 수 있는 것부터', effect: { p: 'cycle', n: 4, random: true, debuffs: SHADOW_TOUCH } },
      ...[0, 1, 2].map((i): SkillDef => ({
        key: `deep${i}`, name: '깊은 물 장판', icon: '깊은', kind: 'zone', first: null, period: 20, cast: 3, warn: 'zone', hitDmg: U.dps(0.25), cells: { p: 'around' }, when: { phase: [2, 3] },
        ...(i ? { hidden: true } : { how: '세 곳에 깊은 물. 파티원이 알아서 피하고, 끝나면 가장자리 칸이 구멍이 되어 판이 좁아짐. 못 피한 사람부터 채우기' }),
      })),
      { key: 'sink', name: '무너지는 제단', icon: '구멍', hidden: true, first: null, period: 20, cast: 0, when: { phase: [2, 3] }, effect: { p: 'hole', n: 2, max: 6 } },
      { key: 'beat', name: '심장 박동', icon: '박동', kind: 'aoe', first: null, period: 18, cast: 3, warn: 'aoe', when: { phase: [3] },
        how: '박동마다 조금씩 세짐. 지속 힐을 미리 깔고, 표식 대상을 먼저 채워 두기', effect: { p: 'all', dmg: U.dps(0.2), grow: U.dps(0.03) } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.65 }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 무너지는 제단' }, { p: 'start', skill: 'mark2', in: 6 }, { p: 'start', skill: 'mark2m', in: 6 },
        { p: 'start', skill: 'deep0', in: 3 }, { p: 'start', skill: 'deep1', in: 3 }, { p: 'start', skill: 'deep2', in: 3 }, { p: 'start', skill: 'sink', in: 6.5 },
        { p: 'text', text: '무너지는 제단: 깊은 물이 빠진 칸이 구멍이 됨, 표식 5명' },
      ] },
      { p: 'when', if: { phase: 2, hpBelow: 0.35 }, do: [
        { p: 'phase', n: 3, name: '3페이즈 · 깨어나는 심장' }, { p: 'start', skill: 'beat', in: 5 }, { p: 'start', skill: 'touch', in: 8 },
        { p: 'text', text: '깨어나는 심장: 심장 박동이 점점 세짐' },
      ] },
    ],
    enrage: { name: '심장이 깸', period: 3, dmg: 220 },
  },
  // ---------- 묶음 E1 던전 ⑮ 모래시계 궁전 (54 3-1, Lv 75 · 모래 왕국 · 질병 + 저주): 데굴이 · 둘둘이 ----------
  // 시간지기 풍뎅이 데굴이 (①): 모래시계 (새 부품, 8초 뒤 뒤집은 순간의 체력으로 모두 되돌림) × 창 안 데굴데굴 두 번 · 모래 기침 (질병).
  // 악몽은 창 안 데굴데굴 딜체 30 → 45%. 목표 3:00 · 광폭화 4:00
  degul: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      BUSTER('뿔 박치기', '뿔', 8, 14, U.tank(0.5)),
      { key: 'glass', name: '모래시계 뒤집기', icon: '모래', kind: 'aoe', first: 16, period: 30, cast: 3, warn: 'aoe', how: GLASS_HOW,
        effect: { p: 'glass', sec: 8, then: ['roll', 'rollm'].flatMap(k => [{ skill: k, in: 0.5 }, { skill: `${k}2`, in: 4.5 }]) } },
      ...(['roll', 'roll2', 'rollm', 'rollm2'] as const).map((key): SkillDef => ({
        key, name: '데굴데굴', icon: '데굴', kind: 'aoe', first: null, period: 9999, cast: 1.5, warn: 'aoe', when: { mythic: key.startsWith('rollm') },
        ...(key === 'roll2' || key === 'rollm2' ? { hidden: true } : { how: '모래시계 창 안에서 두 번. 맞은 피해는 창이 끝나면 되돌아가니 쓰러질 사람만 힐' }),
        effect: { p: 'all', dmg: U.dps(key.startsWith('rollm') ? 0.45 : 0.3) },
      })),
      { key: 'cough', name: '모래 기침', icon: '기침', kind: 'instant', first: 6, period: 15, cast: 0, effect: { p: 'debuff', n: 2, pick: 'others', debuff: SAND_COUGH } },
    ],
    enrage: { name: '기상 시간 초과', period: 2, dmg: 270 },
  },
  // 붕대 집사 둘둘이 (최종): 모래시계 × 치유 흡수 (칭칭 붕대는 되돌림 뒤에도 남음) · 창 안 조용히 하세요 · 천 년 졸음 (저주). 40% 아래 붕대 3명 · 모래시계 24초마다.
  // 악몽은 되돌릴 때 붕대가 남은 사람 딜체 20%. 목표 3:30 · 광폭화 5:00
  dooldool: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      { ...BUSTER('다리미 내려치기', '다리', 8, 15, U.tank(0.55)), cast: 2.5 },
      ...([['wrap', 2, 1], ['wrap2', 3, 2]] as const).map(([key, n, phase]): SkillDef => ({
        key, name: '칭칭 붕대', icon: '붕대', kind: 'instant', first: phase === 1 ? 10 : null, period: 16, cast: 0, when: { phase: [phase] },
        how: '힐을 먼저 빨아들이는 붕대. 붕대는 모래시계가 되돌려도 남으니 창 안에서도 붕대 벗기는 힐은 헛되지 않음',
        effect: { p: 'debuff', n, pick: 'others', debuff: { name: '칭칭 붕대', type: '물리', left: 16, lock: true, absorb: U.dps(0.3), dot: U.dps(0.01) } },
      })),
      ...([false, true] as const).map((mythic): SkillDef => ({
        key: `glass${mythic ? 'm' : ''}`, name: '집사의 모래시계', icon: '모래', kind: 'aoe', first: 18, period: 32, cast: 3, warn: 'aoe', when: { mythic }, how: GLASS_HOW,
        effect: { p: 'glass', sec: 8, then: [{ skill: 'hush', in: 1.5 }], ...(mythic ? { absorbHit: U.dps(0.2) } : {}) },
      })),
      { key: 'hush', name: '조용히 하세요', icon: '조용', kind: 'aoe', first: null, period: 9999, cast: 1.5, warn: 'aoe',
        how: '모래시계 창 안 3초에 맞음. 맞은 피해는 되돌아가니 쓰러질 사람만 힐', effect: { p: 'all', dmg: U.dps(0.35) } },
      { key: 'sleepy', name: '천 년 졸음', icon: '졸음', kind: 'instant', first: 12, period: 18, cast: 0, effect: { p: 'debuff', n: 2, debuff: SLEEPY } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.4 }, do: [
      { p: 'phase', n: 2, name: '' }, { p: 'start', skill: 'wrap2', in: 3 }, { p: 'period', skill: 'glass', sec: 24 }, { p: 'period', skill: 'glassm', sec: 24 },
      { p: 'text', text: '다림질 끝!: 붕대 3명, 모래시계가 잦아짐' },
    ] }],
    enrage: { name: '집사의 잔소리', period: 2, dmg: 270 },
  },
  // ---------- 묶음 E2 10인 ⑪ 노을 궁전 (54 4-2, Lv 75 · 악몽 90 · 모래 왕국 · 질병 + 저주): 솔솔 · 살살 · 엉금이 · 사라샤 ----------
  // 모래 정령 솔솔 · 살살 (분수): 몸통 둘 × 모래시계 × 생명 사슬 (창 안에서는 사슬이 안 끊기고 되돌린 뒤 다시 잼) · 따끔 모래 (창 안에 두 번 더) · 모래 기침.
  // 던전 ⑮보다 먼저 와도 되게 창 안 피해는 작게 (54 7장). 악몽은 모래 사슬 3쌍. 목표 4:30 · 광폭화 6:00
  solsol: {
    phase: [1, ''],
    bodies: SPRITES.map(name => ({ name, hp: SPRITE_HP, boss: true })),
    split: true,
    skills: [
      ...SPRITES.map((_, i): SkillDef => ({ ...AUTO(U.tank(0.04)), key: `auto${i}`, first: 2 + i * 0.8, when: { bodyAlive: [i] } })),
      { key: 'chain', name: '모래 사슬', icon: '사슬', kind: 'instant', first: 10, period: 25, cast: 0, how: SAND_CHAIN_HOW,
        effect: { p: 'link', kind: 'balance', name: '모래 사슬', sec: 12, pick: 'others', gap: 0.3, dmg: U.dps(0.35), pairs: 2, pairsMythic: 3 } },
      { key: 'glass', name: '분수 모래시계', icon: '모래', kind: 'aoe', first: 16, period: 30, cast: 3, warn: 'aoe', how: GLASS_HOW,
        effect: { p: 'glass', sec: 8, then: [{ skill: 'sting2', in: 1.5 }, { skill: 'sting3', in: 4.5 }] } },
      ...(['sting', 'sting2', 'sting3'] as const).map((key): SkillDef => ({
        key, name: '따끔 모래', icon: '따끔', kind: 'instant', first: key === 'sting' ? 7 : null, period: key === 'sting' ? 9 : 9999, cast: 0,
        ...(key === 'sting' ? { how: '무작위 3명이 따끔. 모래시계 창 안에서는 두 번 더 오지만 창이 끝나면 되돌아감' } : { hidden: true }),
        effect: { p: 'debuff', n: 3, debuff: { name: '따끔 모래', type: '물리', left: 2, lock: true, drop: U.dps(0.2) } },
      })),
      { key: 'cough', name: '모래 기침', icon: '기침', kind: 'instant', first: 5, period: 16, cast: 0, effect: { p: 'debuff', n: 2, debuff: SAND_COUGH } },
    ],
    enrage: { name: '모래 분수 폭주', period: 3, dmg: 200 },
  },
  // 보물고 거북 엉금이 (보물고): 탱커 교대 (등껍질 4중첩) × 신기루 버스터 (두 탱커에게 예고, 하나는 신기루) · 모래 늪 (2곳) · 보물 셈 (저주).
  // 악몽은 박치기가 두 탱커 모두 진짜. 목표 4:50 · 광폭화 6:30
  eonggeum: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      { key: 'shell', name: '등껍질 쌓기', icon: '껍질', kind: 'instant', first: 4, period: 6, cast: 0, how: '보스를 맞는 탱커가 받는 피해 +15%씩 (최대 4). 4중첩이면 다른 탱커가 가져감',
        effect: { p: 'debuff', n: 1, pick: 'tank', debuff: { name: '등껍질', type: '물리', left: 20, lock: true, stackMax: 4, vuln: 0.15, swap: 4 } } },
      { key: 'ram', name: '등껍질 박치기', icon: '박치', kind: 'buster', first: 10, period: 16, cast: 3, warn: 'buster', dmg: U.tank(0.55), target: 'tank', when: { mythic: false }, mirage: { n: 1 },
        how: '두 탱커에게 예고가 뜨지만 하나는 신기루 (끝 1초에 걷힘). 둘 다에 보호막을 쓰면 마나가 모자라니 걷히면 바로', effect: { p: 'tank' } },
      ...(['ramm', 'ramm2'] as const).map((key): SkillDef => ({
        key, name: '등껍질 박치기', icon: '박치', kind: 'buster', first: 10, period: 16, cast: 3, warn: 'buster', dmg: U.tank(0.55), target: key === 'ramm' ? 'tank' : 'offtank', when: { mythic: true },
        ...(key === 'ramm2' ? { hidden: true } : { how: '악몽: 두 탱커 모두 진짜. 예고가 뜨면 둘 다 채우고 보호막' }), effect: { p: 'tank' },
      })),
      ...[0, 1].map((i): SkillDef => ({
        key: `bog${i}`, name: '모래 늪', icon: '늪', kind: 'zone', first: 12 + i * 0.3, period: 18, cast: 2, warn: 'zone', hitDmg: U.dps(0.2), dps: U.dps(0.04), dur: 6, cells: { p: 'around' },
        ...(i ? { hidden: true } : { how: '두 곳에 모래 늪. 파티원이 알아서 비킴. 못 비킨 사람부터 채우기' }),
      })),
      { key: 'count', name: '보물 셈', icon: '셈', kind: 'instant', first: 15, period: 20, cast: 0, effect: { p: 'debuff', n: 2, debuff: { name: '보물 셈', type: '저주', left: 8, healCut: 0.3 } } },
    ],
    enrage: { name: '보물고 문 닫기', period: 3, dmg: 200 },
  },
  // 노을 여왕 사라샤 (옥좌, 10인 ⑪ 최종): 1페이즈 여왕의 시험 (신기루 바람 · 노을 부채질) → 70% 거꾸로 궁전 (여왕의 모래시계 · 창 안 모래 회오리 두 번 · 붕대 시녀)
  // → 40% 노을 폭풍 (모두 + 사막의 한숨). 악몽은 3페이즈 시작 때 여왕의 눈길 (모두 8초 받는 치유 −20%, 못 지움). 목표 6:00 · 광폭화 8:00
  sarasha: {
    phase: [1, '1페이즈 · 여왕의 시험'],
    skills: [
      AUTO(U.tank(0.07)),
      { ...BUSTER('부채 내려치기', '부채', 8, 15, U.tank(0.55)), cast: 2.5 },
      { key: 'wind', name: '신기루 바람', icon: '바람', kind: 'buster', first: 12, period: 13, cast: 3, warn: 'buster', target: { p: 'random', n: 1 }, mirage: { n: 1 }, when: { phase: [1, 3] },
        how: MIRAGE_HOW, effect: { p: 'strike', dmg: U.dps(0.45) } },
      { key: 'fan', name: '노을 부채질', icon: '부채', kind: 'instant', first: 16, period: 18, cast: 0, when: { phase: [1, 3] },
        effect: { p: 'debuff', n: 3, debuff: { name: '노을 부채질', type: '저주', left: 8, healCut: 0.3 } } },
      { key: 'glass', name: '여왕의 모래시계', icon: '모래', kind: 'aoe', first: null, period: 28, cast: 3, warn: 'aoe', when: { phase: [2, 3] }, how: GLASS_HOW,
        effect: { p: 'glass', sec: 8, then: [{ skill: 'whirl', in: 0.5 }, { skill: 'whirl2', in: 4.5 }] } },
      ...(['whirl', 'whirl2'] as const).map((key): SkillDef => ({
        key, name: '모래 회오리', icon: '회오', kind: 'aoe', first: null, period: 9999, cast: 1.5, warn: 'aoe',
        ...(key === 'whirl2' ? { hidden: true } : { how: '모래시계 창 안 2초 · 6초에 두 번. 맞은 피해는 창이 끝나면 되돌아가니 쓰러질 사람만 힐' }),
        effect: { p: 'all', dmg: U.dps(0.3) },
      })),
      { key: 'maids', name: '시녀 부르기', icon: '시녀', kind: 'instant', first: null, period: 40, cast: 0, when: { phase: [2, 3] }, how: '붕대 시녀 둘이 모래 기침 (질병)을 뿌림. 딜러가 잡는 동안 기침부터 지우기',
        effect: { p: 'adds', n: 2, add: { name: '붕대 시녀', short: '시녀', art: 'mob-bandage-servant', hp: 0.025, dmg: 0, every: 0, job: { p: 'sting', every: 6, dmg: U.dps(0.05), debuff: SAND_COUGH } } } },
      { key: 'sigh', name: '사막의 한숨', icon: '한숨', kind: 'aoe', first: null, period: 20, cast: 3, warn: 'aoe', when: { phase: [3] }, effect: { p: 'all', dmg: U.dps(0.2) } },
      { key: 'gaze', name: '여왕의 눈길', icon: '눈길', kind: 'instant', first: null, period: 9999, cast: 0, when: { mythic: true }, how: '악몽: 3페이즈 시작 때 모두 8초 동안 받는 치유 −20% (못 지움). 그 전에 모두 채워 두기',
        effect: { p: 'debuff', n: 'all', debuff: { name: '여왕의 눈길', type: '마법', left: 8, lock: true, healCut: 0.2 } } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.7 }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 거꾸로 궁전' }, { p: 'start', skill: 'glass', in: 4 }, { p: 'start', skill: 'maids', in: 10 },
        { p: 'text', text: '거꾸로 궁전: 여왕의 모래시계 · 붕대 시녀' },
      ] },
      { p: 'when', if: { phase: 2, hpBelow: 0.4 }, do: [
        { p: 'phase', n: 3, name: '3페이즈 · 노을 폭풍' }, { p: 'start', skill: 'gaze', in: 0.5 }, { p: 'start', skill: 'sigh', in: 6 },
        { p: 'text', text: '노을 폭풍: 신기루 · 모래시계 함께 + 사막의 한숨' },
      ] },
    ],
    enrage: { name: '노을 폭풍', period: 3, dmg: 210 },
  },
  // 베개 골렘 폭신이 탐험판 (54 1-1, 탐험 ⑲ 낙타 대상로 Lv 76): 평타 · 신기루 베개 (두 곳 중 한 곳만 진짜) · 코골이 진동. 10인 낮잠 피라미드 복도 예습
  pokshin76: {
    phase: [1, ''],
    skills: [
      AUTO(85),
      { key: 'pillow', name: '신기루 베개', icon: '베개', kind: 'zone', first: 8, period: 15, cast: 3, warn: 'zone', hitDmg: 120, cells: { p: 'around' }, mirage: { n: 1 },
        how: '두 곳 중 한 곳은 신기루 (끝 1초에 걷힘). 파티원이 알아서 피함. 못 피한 사람부터 채우기' },
      { key: 'snore', name: '코골이', icon: '코골', kind: 'aoe', first: 12, period: 20, cast: 1.5, warn: 'aoe', effect: { p: 'quake', dmg: 60, lock: 3 } },
    ],
    enrage: { name: '베개 폭탄', period: 2, dmg: 200 },
  },
  // ---------- 묶음 E2 20인 ③ 빛뿌리 숲 (54 4-5, Lv 76 · 악몽 86 · 심연 · 모든 유형): 뚜벅이 · 톡톡 · 쿵쿵 ----------
  // 뿌리 거인 뚜벅이 (입구): 탱커 교대 (뿌리 짓누르기 4중첩) × 20인 끌어당김 여럿 (뒷줄 3명, 악몽 4명) · 뿌리 솟기 (4곳). 목표 4:30 · 광폭화 6:00
  ttubeok: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      { key: 'press', name: '뿌리 짓누르기', icon: '짓눌', kind: 'instant', first: 4, period: 6, cast: 0, how: '보스를 맞는 탱커가 받는 피해 +15%씩 (최대 4). 4중첩이면 다른 탱커가 가져감',
        effect: { p: 'debuff', n: 1, pick: 'tank', debuff: { name: '뿌리 짓누르기', type: '물리', left: 20, lock: true, stackMax: 4, vuln: 0.15, swap: 4 } } },
      { key: 'pull', name: '뿌리 끌어당기기', icon: '끌기', kind: 'buster', first: 14, period: 20, cast: 2, warn: 'buster', target: { p: 'back', n: 3, nMythic: 4 },
        how: '뒷줄 셋 (악몽 넷)이 끌려와 4초 동안 평타를 나눠 맞음. 탱커 교대 직후면 더 아프니 끌려온 사람을 먼저', effect: { p: 'pull', sec: 4, dmg: U.dps(0.15) } },
      ...[0, 1, 2, 3].map((i): SkillDef => ({
        key: `rise${i}`, name: '뿌리 솟기', icon: '솟기', kind: 'zone', first: 9 + i * 0.2, period: 15, cast: 2, warn: 'zone', hitDmg: U.dps(0.25), cells: { p: 'around' },
        ...(i ? { hidden: true } : { how: '네 곳에서 뿌리가 솟음. 파티원이 알아서 비킴. 못 비킨 사람부터 채우기' }),
      })),
    ],
    enrage: { name: '뿌리 거인 행진', period: 3, dmg: 200 },
  },
  // 씨앗 할머니 톡톡 (온실): 20인 쇠약 (가시 덩굴 6명, 90% 아래인 동안 중첩) × 자폭 쫄 (빛 씨앗 셋, 악몽 넷: 10초 뒤 펑) · 꽃가루 (질병). 목표 5:00 · 광폭화 6:30
  toktok: {
    phase: [1, ''],
    skills: [
      AUTO(U.tank(0.07)),
      { key: 'seeds', name: '빛 씨앗', icon: '씨앗', kind: 'instant', first: 12, period: 30, cast: 0, how: '씨앗 셋 (악몽 넷)이 10초 뒤 펑 (모두 아픔). 딜러가 깨는 동안 가시 덩굴 대상을 90% 위로',
        effect: { p: 'adds', n: 3, nMythic: 4, add: { name: '빛 씨앗', short: '씨앗', art: 'mob-light-seed', hp: 0.008, dmg: 0, every: 0, job: { p: 'bomb', sec: 10, dmg: U.dps(0.2) } } } },
      { key: 'thorn', name: '가시 덩굴', icon: '가시', kind: 'instant', first: 7, period: 20, cast: 0, how: '6명에게 가시 덩굴. 90% 아래인 동안 3초마다 중첩 (못 지움). 씨앗이 터지기 전에 90% 위로',
        effect: { p: 'debuff', n: 6, debuff: { name: '가시 덩굴', type: '물리', left: 20, lock: true, cureAt: 0.9, grow: { every: 3, dot: U.dps(0.01), max: 5 } } } },
      { key: 'pollen', name: '꽃가루', icon: '꽃가', kind: 'instant', first: 5, period: 16, cast: 0, effect: { p: 'debuff', n: 4, debuff: { name: '꽃가루', type: '질병', left: 12, dot: U.dps(0.02) } } },
    ],
    enrage: { name: '온실 대폭발', period: 3, dmg: 210 },
  },
  // 심장의 뿌리 쿵쿵 (심장뿌리, 20인 ③ 최종): 1페이즈 뿌리 박동 (부푼 씨앗 4명) → 65% 뒤집힌 박동 (뒤집힘 저주 4명 · 뿌리 덩굴) → 35% 깨어나는 박동 (모두 + 심장 박동, 박동마다 +1.5%).
  // 20인 부풀기 × 뒤집힘. 악몽은 뒤집힘 저주 6명. 목표 6:00 · 광폭화 8:00. 54의 피해는 치유 0.6에서 너무 세서 저주 · 씨앗 · 덩굴 · 박동을 반으로 (tune.ts E2)
  kungkung: {
    phase: [1, '1페이즈 · 뿌리 박동'],
    skills: [
      AUTO(U.tank(0.07)),
      { ...BUSTER('뿌리 채찍', '채찍', 8, 15, U.tank(0.55)), cast: 2.5 },
      { key: 'swell', name: '부푼 씨앗', icon: '부푼', kind: 'instant', first: 10, period: 22, cast: 0,
        how: '시간이 갈수록 씨앗이 부풂. 지우면 옆 칸 사람만 조금, 두면 본인과 옆 칸이 크게 터짐. 1~2중첩이고 옆이 비었을 때 지우기',
        effect: { p: 'debuff', n: 4, pick: 'others', debuff: { name: '부푼 씨앗', type: '마법', left: 16, swell: { every: 4, max: 4 }, end: { p: 'pop', pop: U.dps(0.03), self: U.dps(0.06), near: U.dps(0.04) } } } },
      { key: 'flip', name: '뒤집힌 박동', icon: '뒤집', kind: 'instant', first: null, period: 24, cast: 0, when: { phase: [2, 3] },
        how: '끝날 때 체력 비율이 뒤집힘 (90% → 10%). 걸린 동안 체력이 조금씩 빠지니 40~60%에 두기. 저주를 지우는 직업은 지움',
        effect: { p: 'debuff', n: 4, nMythic: 6, pick: 'others', debuff: { name: '뒤집힌 박동', type: '저주', left: 10, dot: U.dps(0.02), end: { p: 'flip' } } } },
      { key: 'vines', name: '뿌리 덩굴', icon: '덩굴', kind: 'instant', first: null, period: 40, cast: 0, when: { phase: [2, 3] },
        effect: { p: 'adds', n: 3, add: { name: '뿌리 덩굴', short: '덩굴', art: 'mob-root-vine', hp: 0.02, dmg: U.dps(0.05), every: 2 } } },
      { key: 'beat', name: '심장 박동', icon: '박동', kind: 'aoe', first: null, period: 18, cast: 3, warn: 'aoe', when: { phase: [3] },
        how: '박동마다 조금씩 세짐. 지속 힐을 미리 깔고, 뒤집힘 대상은 가운데에 두기', effect: { p: 'all', dmg: U.dps(0.1), grow: U.dps(0.015) } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.65 }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 뒤집힌 박동' }, { p: 'start', skill: 'flip', in: 4 }, { p: 'start', skill: 'vines', in: 8 },
        { p: 'text', text: '뒤집힌 박동: 뒤집힘 저주 · 뿌리 덩굴' },
      ] },
      { p: 'when', if: { phase: 2, hpBelow: 0.35 }, do: [
        { p: 'phase', n: 3, name: '3페이즈 · 깨어나는 박동' }, { p: 'start', skill: 'beat', in: 5 },
        { p: 'text', text: '깨어나는 박동: 심장 박동이 점점 세짐' },
      ] },
    ],
    enrage: { name: '심장의 고동', period: 3, dmg: 220 },
  },
  warden: {
    phase: [1, ''],
    skills: [
      AUTO(70),
      BUSTER('내려찍기', '찍기', 12, 20, 600),
      { key: 'aoe', name: '증기 분출', icon: '증기', kind: 'aoe', first: 25, period: 30, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: 220 } },
      { key: 'zone', name: '녹물 웅덩이', icon: '장판', kind: 'zone', first: null, period: 20, cast: 2.5, dps: 60, dur: 8, warn: 'zone', cut: true, when: { hpBelow: 0.4 }, cells: { p: 'around' } },
    ],
    flow: [{ p: 'when', if: { idle: 'zone', hpBelow: 0.4 }, do: [{ p: 'start', skill: 'zone', in: 3 }, { p: 'text', text: '녹이 흘러내린다' }] }],
    enrage: { name: '증기 폭주', period: 2, dmg: 220 },
  },
  // 역병 군주 (05 2장, 10인 1층). 악몽 전용 (26 3-1): 전염 2명 동시 + 30% 아래 역병 폭풍
  plague: {
    phase: [1, '1페이즈'],
    skills: [
      AUTO(60),
      { key: 'breath', name: '썩은 숨결', icon: '숨결', kind: 'instant', first: 6, period: 12, cast: 0, when: { phase: [1, 2, 3] },
        effect: { p: 'rot', n: 2, debuff: { name: '썩은 숨결', type: '질병', left: 60, end: { p: 'restoreMax' } }, pct: 0.05, max: 4 } },
      { key: 'sting', name: '독침', icon: '독침', kind: 'instant', first: 10, period: 15, cast: 0, cut: true, when: { phase: [1] },
        effect: { p: 'debuff', n: 2, debuff: { name: '독침', type: '독', left: 12, dot: 15 } } },
      { key: 'aoe', name: '역병 파동', icon: '파동', kind: 'aoe', first: 27, period: 30, cast: 3, warn: 'aoe', when: { phase: [1, 2, 3] },
        effect: { p: 'all', dmg: 180, phaseDmg: { 1: 150 } } },
      { key: 'contagion', name: '전염', icon: '전염', kind: 'instant', first: null, period: 20, cast: 0, when: { phase: [2, 3] },
        effect: { p: 'debuff', n: 1, nMythic: 2, debuff: { name: '전염', type: '질병', left: 8, trap: true, end: { p: 'spread' } }, burstAdjacent: true } },
      { key: 'storm', name: '역병 폭풍', icon: '폭풍', kind: 'zone', first: null, period: 10, cast: 2.5, dps: 40, dur: 7.5, warn: 'zone', when: { phase: [3] }, cells: { p: 'edge' } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.6 }, do: [
        { p: 'phase', n: 0, name: '인터미션' }, { p: 'inter', sec: 25 }, { p: 'text', text: '인터미션: 쥐떼가 뒷줄 공격' },
        { p: 'rats', n: 3 }, { p: 'debuffDebuffed', debuff: { name: '독침', type: '독', left: 12, dot: 15 } },
      ] },
      { p: 'rats', phase: 0, dps: 30 },
      { p: 'when', if: { phase: 0, interOver: true }, do: [
        { p: 'phase', n: 2, name: '2페이즈' }, { p: 'interEnd' },
        { p: 'start', skill: 'contagion', in: 10 }, { p: 'start', skill: 'aoe', in: 22 }, { p: 'period', skill: 'aoe', sec: 25 },
        { p: 'text', text: '2페이즈: 전염은 해제하면 바로 퍼짐' },
      ] },
      { p: 'when', if: { mythic: true, phase: 2, hpBelow: 0.3 }, do: [
        { p: 'phase', n: 3, name: '3페이즈' }, { p: 'start', skill: 'storm', in: 1 }, { p: 'text', text: '3페이즈: 역병 폭풍이 판 바깥 1열을 번갈아 덮음' },
      ] },
    ],
    enrage: { name: '역병 폭주', period: 3, dmg: 180 },
  },
  // 늪의 어머니 히드라 (05 3장, 10인 2층 늪의 정원): 못 지우는 독 오라 (늪의 숨결) · 물어뜯기 독 · 뒷줄 산성 토사 (줄 피해, 못 피함) · 늪 머리 (부탱커가 끎, 쓰러지면 전원 파열 35 5장) ·
  // 늪 치유사 (35 3-I). 50% 아래 머리가 셋: 머리 25초 · 독안개 분출 · 숨결 두 겹. 악몽 늪에 잠김 (뒷줄 장판). 목표 5:10 · 광폭화 7:00
  hydra: {
    phase: [1, '1페이즈'],
    skills: [
      AUTO(U.tank(0.06)),
      { key: 'breath', name: '늪의 숨결', icon: '숨결', kind: 'instant', first: 1, period: 600, cast: 0,
        how: '전투 내내 모두에게 못 지우는 독. 지속 힐을 넓게 깔아 버티기',
        effect: { p: 'debuff', n: 'all', debuff: { name: '늪의 숨결', type: '독', left: 600, dot: U.dps(0.004), lock: true } } },
      { key: 'breath2', name: '짙은 늪 숨결', icon: '숨결', kind: 'instant', first: null, period: 600, cast: 0, when: { phase: [2] },
        effect: { p: 'debuff', n: 'all', debuff: { name: '짙은 늪 숨결', type: '독', left: 600, dot: U.dps(0.004), lock: true } } },
      { key: 'buster', name: '물어뜯기', icon: '물어', kind: 'buster', first: 8, period: 18, cast: 2, warn: 'buster', dmg: U.tank(0.45), target: 'tank',
        effect: { p: 'tank', debuff: { name: '물어뜯긴 독', type: '독', left: 10, dot: U.dps(0.01), stackMax: 3 } } },
      { key: 'acid', name: '산성 토사', icon: '토사', kind: 'zone', first: 15, period: 25, cast: 2.5, warn: 'zone', fixed: true, hitDmg: U.dps(0.22), cells: { p: 'line', at: 'back' } },
      ...([['heads', 1, 20, [1]], ['heads2', 1, null, [2]]] as const).map(([key, n, first, phase]): SkillDef => ({
        key, name: '머리 재생', icon: '머리', kind: 'instant', first, period: phase[0] === 1 ? 40 : 25, cast: 0, when: { phase: [...phase] },
        how: '늪 머리를 부탱커가 끌고 딜러가 잡음. 쓰러질 때 모두에게 늪 파열 (독, 겹침). 잡히기 직전에 광역 힐을 준비',
        effect: { p: 'adds', n, add: { name: '늪 머리', short: '머리', art: 'mob-swamp-head', hp: 0.02, dmg: U.dps(0.04), every: 2,
          down: { p: 'burst', debuff: { name: '늪 파열', type: '독', left: 4, dot: U.dps(0.01), stackMax: 5 } } } },
      })),
      { key: 'mender', name: '늪 치유사', icon: '치유', kind: 'instant', first: 45, period: 60, cast: 0,
        effect: { p: 'adds', n: 1, add: { name: '늪 치유사', short: '치유', art: 'mob-swamp-mender', hp: 0.015, dmg: 0, every: 0, job: { p: 'mend', every: 5, pct: 0.008 } } } },
      { key: 'spew', name: '독안개 분출', icon: '분출', kind: 'aoe', first: null, period: 30, cast: 3, warn: 'aoe', when: { phase: [2] },
        effect: { p: 'all', dmg: U.dps(0.17), debuff: { name: '독안개', type: '독', left: 10, dot: U.dps(0.007), stackMax: 3 } } },
      { key: 'sink', name: '늪에 잠김', icon: '잠김', kind: 'zone', first: 30, period: 30, cast: 3, warn: 'zone', dps: U.dps(0.04), dur: 10, when: { mythic: true }, cells: { p: 'line', at: 'back' } },
    ],
    flow: [{ p: 'when', if: { phase: 1, hpBelow: 0.5 }, do: [
      { p: 'phase', n: 2, name: '2페이즈 · 머리가 셋' }, { p: 'start', skill: 'heads2', in: 2 }, { p: 'start', skill: 'spew', in: 6 }, { p: 'start', skill: 'breath2', in: 1 },
      { p: 'text', text: '머리가 셋: 머리가 잦아지고 독안개 분출, 숨결이 두 겹' },
    ] }],
    enrage: { name: '늪의 분노', period: 3, dmg: 180 },
  },
  // 쌍둥이 여군주 릴리안 · 로제 (05 4장, 10인 3층 백합 회랑): 몸통 둘 (고르게 깎음, 하나가 먼저 쓰러지면 상실의 분노 +30%) · 가시 중첩 → 4중첩 탱커 교대 ·
  // 귀부인의 저주 (받는 치유 −50%) · 피의 서약 (집결 분담) · 쌍둥이 무도회 · 자매의 실 (두 탱커 균형, 35 5장). 60% 거울 저주, 20% 무도회 20초. 악몽 뒤바뀐 자매. 목표 5:50 · 광폭화 7:30
  twins: {
    phase: [1, '1페이즈'],
    bodies: [{ name: '릴리안', hp: 13000, boss: true }, { name: '로제', hp: 13000, boss: true }],
    split: true,
    skills: [
      AUTO(U.tank(0.06)),
      { key: 'thorn', name: '가시', icon: '가시', hidden: true, first: 4, period: 4, cast: 0,
        how: '보스를 맞는 탱커에게 4초마다 받는 피해 +12% 중첩. 4중첩이면 다른 탱커가 받아 감. 두 탱커 모두에게 지속 힐',
        effect: { p: 'debuff', n: 1, pick: 'tank', debuff: { name: '가시', type: '물리', left: 10, lock: true, stackMax: 4, vuln: 0.12, swap: 4 } } },
      { key: 'curse', name: '귀부인의 저주', icon: '저주', kind: 'instant', first: 8, period: 15, cast: 0, when: { phase: [1] },
        effect: { p: 'debuff', n: 2, debuff: { name: '귀부인의 저주', type: '저주', left: 15, healCut: 0.5 } } },
      { key: 'mirror', name: '거울 저주', icon: '거울', kind: 'instant', first: null, period: 15, cast: 0, when: { phase: [2, 3] },
        how: '지우면 이웃 칸 아군에게 옮겨감 (혼자 선 사람은 지우면 사라짐). 버티면 그냥 사라짐',
        effect: { p: 'debuff', n: 3, debuff: { name: '거울 저주', type: '저주', left: 15, healCut: 0.5, end: { p: 'jump', sec: 10, mult: 1, boost: 0 } } } },
      { key: 'oath', name: '피의 서약', icon: '서약', kind: 'buster', first: 20, period: 30, cast: 3, warn: 'buster', target: { p: 'random', n: 1 },
        effect: { p: 'share', dmg: U.dps(0.67) } },
      { key: 'dance', name: '쌍둥이 무도회', icon: '무도', kind: 'aoe', first: 30, period: 35, cast: 3, warn: 'aoe', effect: { p: 'all', dmg: U.dps(0.3) } },
      { key: 'thread', name: '자매의 실', icon: '실', kind: 'instant', first: 25, period: 40, cast: 0,
        effect: { p: 'link', kind: 'balance', name: '자매의 실', sec: 20, pick: 'tanks', gap: 0.3, dmg: U.tank(0.25), aim: 'tank' } },
      { key: 'trade', name: '뒤바뀐 자매', icon: '뒤바', kind: 'instant', first: 40, period: 40, cast: 2, when: { mythic: true }, effect: { p: 'trade', name: '가시' } },
      { key: 'grief', name: '상실의 분노', icon: '분노', hidden: true, first: null, period: 9999, cast: 0,
        how: '한쪽이 먼저 쓰러지면 남은 쪽 피해 +30% (끝까지)', effect: { p: 'empower', boost: 0.3 } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.6 }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 거울 저주' }, { p: 'start', skill: 'mirror', in: 3 }, { p: 'text', text: '거울 저주: 저주가 3명, 지우면 옆 사람에게 옮겨감' },
      ] },
      { p: 'when', if: { phase: 2, hpBelow: 0.2 }, do: [
        { p: 'phase', n: 3, name: '3페이즈 · 등을 맞댐' }, { p: 'period', skill: 'dance', sec: 20 }, { p: 'text', text: '등을 맞댐: 쌍둥이 무도회가 잦아짐' },
      ] },
      ...[0, 1].map((i): FlowStep => ({ p: 'when', if: { idle: 'grief', bodiesDead: [i] }, do: [{ p: 'start', skill: 'grief', in: 0 }] })),
    ],
    enrage: { name: '쌍둥이 광란', period: 3, dmg: 200 },
  },
  // 대마도사 오르벤 (05 5장, 10인 4층 서리 전망대): 서리 화살 · 얼음 족쇄 (지움) · 불안정한 마력 (지우면 안 됨, 같은 마법) · 서리 고리 · 서리 수정 3개 (35 3-I).
  // 55% 인터미션 「눈보라 세 줄」 (앞 → 가운데 → 뒷줄 줄 피해 두 바퀴). 2페이즈 마력 둘 (붙으면 같이 터짐) · 얼어붙은 시간 (치유 흡수) · 마력 역류 (35 5장). 악몽 깨진 시간. 목표 6:00 · 광폭화 7:30
  orben: {
    phase: [1, '1페이즈'],
    skills: [
      AUTO(U.tank(0.06)),
      BUSTER('서리 화살', '화살', 8, 16, U.tank(0.6)),
      { key: 'shackle', name: '얼음 족쇄', icon: '족쇄', kind: 'instant', first: 10, period: 18, cast: 0, when: { phase: [1, 2] },
        how: '딜 0 + 지속 피해. 지우면 바로 풀림 (불안정한 마력과 같은 마법이니 ⚠ 표시를 보고 고르기)',
        effect: { p: 'debuff', n: 2, debuff: { name: '얼음 족쇄', type: '마법', left: 10, dot: U.dps(0.02), noDps: true } } },
      ...([['mana', 1, 16, 1], ['mana2', 2, null, 2]] as const).map(([key, n, first, phase]): SkillDef => ({
        key, name: '불안정한 마력', icon: '마력', kind: 'instant', first, period: 22, cast: 0, when: { phase: [phase] },
        how: '함정. 8초 뒤 이웃 칸이 터지고 지우면 바로 터짐. 두고 이웃 칸 사람을 채우기',
        effect: { p: 'debuff', n, pick: 'others', burstAdjacent: n === 2, debuff: { name: '불안정한 마력', type: '마법', left: 8, trap: true, end: { p: 'blast', dmg: U.dps(0.42) } } },
      })),
      ...(['ring', 'ring2'] as const).map((key, i): SkillDef => ({
        key, name: '서리 고리', icon: '고리', kind: 'zone', first: 20 + i * 0.5, period: 20, cast: 2.5, warn: 'zone', dps: U.dps(0.12), dur: 6, when: { phase: [1, 2] }, cells: { p: 'around' },
        ...(i ? { hidden: true } : {}),
      })),
      { key: 'crystals', name: '서리 수정', icon: '수정', kind: 'instant', first: 30, period: 60, cast: 0, when: { phase: [1, 2] },
        effect: { p: 'adds', n: 3, add: { name: '서리 수정', short: '수정', art: 'mob-frost-crystal', hp: 0.015, dmg: 0, every: 0, at: 'random', job: { p: 'pylon', cut: 0.1 } } } },
      ...(['front', 'mid', 'back'] as const).map((at, i): SkillDef => ({
        key: `row${i + 1}`, name: '눈보라 세 줄', icon: '세줄', kind: 'zone', first: null, period: 12, cast: 3, warn: 'zone', fixed: true, hitDmg: U.dps(0.37),
        when: { phase: [0] }, cells: { p: 'line', at }, ...(i ? { hidden: true } : {}),
      })),
      { key: 'freeze', name: '얼어붙은 시간', icon: '시간', kind: 'instant', first: null, period: 25, cast: 0, when: { phase: [2] },
        how: '막이 다 깎일 때까지 힐이 막만 채움. 12초 안에 다 채우면 사라지고, 남으면 막이 터져 그 사람이 아픔',
        effect: { p: 'debuff', n: 1, pick: 'others', debuff: { name: '얼어붙은 시간', type: '마법', left: 12, lock: true, absorb: U.dps(0.83), end: { p: 'hit', dmg: U.dps(0.5) } } } },
      { key: 'recoil', name: '마력 역류', icon: '역류', kind: 'instant', first: null, period: 30, cast: 0, when: { phase: [2] },
        how: '내 스킬마다 1중첩, 끝날 때 중첩만큼 나에게 피해. 0~1중첩일 때 바로 지우기',
        effect: { p: 'debuff', n: 1, pick: 'me', debuff: { name: '마력 역류', type: '마법', left: 10, count: true, end: { p: 'stackHit', dmg: U.me(0.07) } } } },
      { key: 'broken', name: '깨진 시간', icon: '깨진', kind: 'instant', first: null, period: 20, cast: 2, warn: 'aoe', when: { phase: [2], mythic: true },
        how: '3초 동안 내 시전 시간 2배. 예고가 뜨면 즉시 스킬 · 지속 힐로 버티기', effect: { p: 'slow', sec: 3, mult: 2 } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.55 }, do: [
        { p: 'phase', n: 0, name: '인터미션 · 눈보라 세 줄' }, { p: 'inter', sec: 24 },
        { p: 'start', skill: 'row1', in: 0 }, { p: 'start', skill: 'row2', in: 4 }, { p: 'start', skill: 'row3', in: 8 },
        { p: 'text', text: '눈보라 세 줄: 앞줄 → 가운데 → 뒷줄, 맞기 전에 그 줄을 채우기' },
      ] },
      { p: 'when', if: { phase: 0, interOver: true }, do: [
        { p: 'phase', n: 2, name: '2페이즈' }, { p: 'interEnd' },
        { p: 'start', skill: 'mana2', in: 5 }, { p: 'start', skill: 'freeze', in: 10 }, { p: 'start', skill: 'recoil', in: 8 }, { p: 'start', skill: 'broken', in: 15 },
        { p: 'text', text: '2페이즈: 불안정한 마력 둘 · 얼어붙은 시간 (치유 흡수) · 마력 역류' },
      ] },
    ],
    enrage: { name: '마력 폭주', period: 3, dmg: 200 },
  },
  // 심연의 군주 (05 6장, 10인 꼭대기 첨탑, 최종): 심연의 손길 + 공허 3중첩 교대 · 그림자 파동 · 네 가지 메아리. 65% 인터미션 (심연 감옥 둘 · 조각 흡수 = 나를 노림).
  // 2페이즈 공허의 막 (탱커 치유 흡수) · 첨탑 붕괴. 30% 전투의 함성 (파티 딜 +30% 20초) → 3페이즈 10초마다 보스 +5% · 파동에 메아리 · 주시 (35 5장). 악몽 10% 영원한 저녁. 목표 7:00 · 광폭화 8:30
  abysslord: {
    phase: [1, '1페이즈 · 저녁이 온다'],
    skills: [
      AUTO(U.tank(0.06)),
      { key: 'buster', name: '심연의 손길', icon: '손길', kind: 'buster', first: 8, period: 12, cast: 2, warn: 'buster', dmg: U.tank(0.55), target: 'tank',
        effect: { p: 'tank', debuff: { name: '공허', type: '물리', left: 20, lock: true, stackMax: 3, vuln: 0.1, swap: 3 } } },
      { key: 'wave', name: '그림자 파동', icon: '파동', kind: 'aoe', first: 20, period: 25, cast: 3, warn: 'aoe', when: { phase: [1, 2] }, effect: { p: 'all', dmg: U.dps(0.28) } },
      { key: 'wave3', name: '그림자 파동', icon: '파동', kind: 'aoe', first: null, period: 20, cast: 3, warn: 'aoe', when: { phase: [3, 4] },
        effect: { p: 'all', dmg: U.dps(0.28), debuff: { name: '그림자 메아리', type: '마법', left: 10, dot: U.dps(0.015) } } },
      { key: 'echoes', name: '네 가지 메아리', icon: '메아', kind: 'instant', first: 12, period: 25, cast: 0, when: { phase: [1, 2, 3, 4] },
        how: '4명에게 질병 · 독 · 저주 · 마법 하나씩. 지울 수 있는 것부터',
        effect: { p: 'cycle', n: 4, each: true, debuffs: [
          { name: '역병의 메아리', type: '질병', left: 12, maxCut: 0.08, end: { p: 'restoreMax' } },
          { name: '늪의 메아리', type: '독', left: 12, dot: U.dps(0.02) },
          { name: '자매의 메아리', type: '저주', left: 10, healCut: 0.4 },
          { name: '서리의 메아리', type: '마법', left: 8, dot: U.dps(0.02), noDps: true },
        ] } },
      { key: 'jail', name: '심연 감옥', icon: '감옥', kind: 'instant', first: null, period: 99, cast: 0, when: { phase: [0] },
        effect: { p: 'jail', n: 2, name: '심연 감옥', short: '감옥', hp: 0.02, dot: U.dps(0.02) } },
      { key: 'shard', name: '조각 흡수', icon: '조각', kind: 'instant', first: null, period: 99, cast: 0, when: { phase: [0] },
        how: '인터미션 동안 나에게 지속 피해 (못 지움). 내 체력도 채우며 파티를 돌보기',
        effect: { p: 'debuff', n: 1, pick: 'me', debuff: { name: '조각 흡수', type: '마법', left: 20, dot: U.me(0.04), lock: true } } },
      { key: 'veil', name: '공허의 막', icon: '막', kind: 'instant', first: null, period: 24, cast: 0, when: { phase: [2, 3, 4] },
        how: '보스를 맞는 탱커에게 치유 흡수 막. 10초 안에 다 채우지 못하면 막이 터져 탱커가 크게 아픔',
        effect: { p: 'debuff', n: 1, pick: 'tank', debuff: { name: '공허의 막', type: '마법', left: 10, lock: true, absorb: U.tank(0.6), end: { p: 'hit', dmg: U.tank(0.5) } } } },
      { key: 'collapse', name: '첨탑 붕괴', icon: '붕괴', kind: 'zone', first: null, period: 18, cast: 2.5, warn: 'zone', dps: U.dps(0.07), dur: 8, when: { phase: [2, 3, 4] }, cells: { p: 'edge' } },
      { key: 'dusk', name: '짙어지는 저녁', icon: '저녁', hidden: true, first: null, period: 10, cast: 0, when: { phase: [3, 4] },
        how: '10초마다 보스 피해 +5% (끝까지 쌓임). 쿨기는 이 구간에', effect: { p: 'empower', boost: 0.05 } },
    ],
    flow: [
      { p: 'when', if: { phase: 1, hpBelow: 0.65 }, do: [
        { p: 'phase', n: 0, name: '인터미션 · 악몽 열쇠 강탈' }, { p: 'inter', sec: 20 }, { p: 'start', skill: 'jail', in: 1 }, { p: 'start', skill: 'shard', in: 2 },
        { p: 'text', text: '악몽 열쇠 강탈: 감옥 둘, 군주가 나를 노림' },
      ] },
      { p: 'when', if: { phase: 0, interOver: true }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 보랏빛 폭풍' }, { p: 'interEnd' }, { p: 'period', skill: 'wave', sec: 20 },
        { p: 'start', skill: 'veil', in: 6 }, { p: 'start', skill: 'collapse', in: 10 }, { p: 'text', text: '보랏빛 폭풍: 공허의 막 · 첨탑 붕괴' },
      ] },
      { p: 'when', if: { phase: 2, hpBelow: 0.3 }, do: [
        { p: 'phase', n: 3, name: '3페이즈 · 가라앉은 대성당' }, { p: 'cheer', pct: 0.3, sec: 20 }, { p: 'start', skill: 'wave3', in: 5 }, { p: 'start', skill: 'dusk', in: 10 },
        { p: 'text', text: '전투의 함성: 파티 딜 +30% · 이제 10초마다 보스가 강해지고 군주가 나를 지켜봄' },
      ] },
      { p: 'when', if: { mythic: true, phase: 3, hpBelow: 0.1 }, do: [
        { p: 'phase', n: 4, name: '4페이즈 · 영원한 저녁' }, { p: 'dark' }, { p: 'text', text: '영원한 저녁: 체력 숫자가 사라짐, 채움 색만 보고 힐' },
      ] },
    ],
    watch: { cap: 1.5, sec: 6, tauntSec: 3, every: 1.5, dmg: U.me(0.15), mythicRate: 1.3, from: 3 },
    enrage: { name: '영원한 밤', period: 3, dmg: 220 },
  },
  // 유령 성가대 (26 4-3): 20인 입문. 성가대원 셋이 맡은 2열에 노래, 다 잡으면 지휘자 2페이즈
  choir: {
    phase: [1, '1페이즈 · 세 성부'],
    bodies: [...CHOIR.voices.map(name => ({ name, hp: CHOIR.voiceHp, elite: true })), { name: '지휘자', hp: CHOIR.bossHp, elite: true, boss: true }],
    skills: [
      AUTO(CHOIR.auto),
      { key: 'baton', name: '지휘봉', icon: '지휘', kind: 'buster', first: 9, period: 18, cast: 2, warn: 'buster', dmg: CHOIR.baton, target: 'tank', effect: { p: 'tank' } },
      { key: 'crescendo', name: '크레센도', icon: '크레', kind: 'zone', first: 12, period: 15, cast: 3, dps: CHOIR.crescDps, dpsMythic: CHOIR.discord, dur: 5, warn: 'zone',
        when: { phase: [1], bodyAlive: [0, 1, 2] }, cells: { p: 'bodyCols', bodies: 3, per: 2, nMythic: 2 } },
      { key: 'forte', name: '포르테', icon: '포르', kind: 'aoe', first: null, period: 25, cast: 3, warn: 'aoe', when: { phase: [2] }, effect: { p: 'all', dmg: CHOIR.forte } },
      { key: 'solo', name: '독창', icon: '독창', kind: 'instant', first: null, period: 20, cast: 0, cut: true, when: { phase: [2] },
        effect: { p: 'debuff', n: CHOIR.soloN, debuff: { name: '독창', type: '마법', left: CHOIR.soloSec, end: { p: 'colDmg', dmg: CHOIR.soloDmg } } } },
    ],
    flow: [
      { p: 'song', phase: 1, bodies: 3, per: 2, dps: CHOIR.song },
      { p: 'when', if: { phase: 1, bodiesDead: [0, 1, 2] }, do: [
        { p: 'phase', n: 2, name: '2페이즈 · 마지막 악장' }, { p: 'start', skill: 'forte', in: 8 }, { p: 'start', skill: 'solo', in: 5 },
        { p: 'text', text: '2페이즈: 지휘자가 직접 지휘' },
      ] },
    ],
    enrage: { name: '대합창', period: 3, dmg: 200 },
  },
};

/** 기술 정의 찾기 (공략 화면 숫자) */
export const bossSkill = (key: Exclude<ScriptKey, 'trash'>, skill: string): SkillDef => BOSSES[key].skills.find(s => s.key === skill)!;
