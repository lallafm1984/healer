/**
 * 보스 데이터 (38 0-2): 보스 = 기술 목록 + 페이즈 흐름 + 광폭화. 엔진(engine/bosses.ts)은 이 표를 읽어 돌리기만 한다.
 * 기술이 하는 일·장판 모양·매 틱 도는 일은 이름 붙은 부품(p)으로 적는다. 새 보스는 부품을 골라 값만 적고,
 * 없는 부품만 engine/bossParts.ts에 더한다 (38 0-4).
 * 피해 수치는 맞을 대상이 실제로 받는 양 (35 1-2, 34 9-3): tank = 탱커 기준, 그 밖은 원거리·힐러 기준.
 */
import type { TelKind } from '../engine/types';
import { CLASSES } from './classes';
import type { ScriptKey } from './encounters';
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
  /** 끝나거나 지워지면 그때까지 중첩 × dmg 피해 (마력 역류 P-RECOIL, 중첩 0이면 없음) */
  | { p: 'stackHit'; dmg: number };

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
  /** 받는 치유가 피해로 (뒤집힌 축복 P-INVERT): 들어올 치유량만큼 피해. 보호막·피해 감소·보호의 손은 통함 */
  invert?: boolean;
  /** 나(힐러)에게 걸린 동안 스킬을 쓸 때마다 1중첩 (마력 역류 P-RECOIL). 해제 스킬로 이 디버프를 지우는 그 한 번은 안 셈 */
  count?: boolean;
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

/** 판 위 적이 하는 일. 딜러는 mend → bomb → jail → pylon → 그 밖 순서로, 같으면 먼저 나온 것부터 잡는다 */
export type AddJob =
  /** 치유하는 쫄 (P-MENDER): every초마다 보스 체력 pct 회복 */
  | { p: 'mend'; every: number; pct: number }
  /** 폭탄 (P-BOMB): sec초 안에 못 깨면 터져서 살아 있는 모두에게 dmg (마법) */
  | { p: 'bomb'; sec: number; dmg: number }
  /** 보호막 수정 (P-PYLON): 서 있는 동안 보스가 받는 피해 −cut */
  | { p: 'pylon'; cut: number }
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
  | { p: 'fixate'; every: number; dmg: number; splash: number; from?: number };

/** 기술이 맞을 때 하는 일 */
export type SkillEffect =
  /** 평타: 보스가 때릴 사람(탱커)에게 ±30% (전사 ±15%) */
  | { p: 'auto'; dmg: number }
  /** 탱커 버스터: 예고 때 고른 사람에게 skill.dmg (탱커 기준, 물리) */
  | { p: 'tank' }
  /** 전원 광역 (마법). phaseDmg = 그 페이즈에서는 이 피해. grow = 쓸 때마다 이만큼 더 커짐 (수정 핵 과열) */
  | { p: 'all'; dmg: number; phaseDmg?: Partial<Record<number, number>>; grow?: number }
  /**
   * n명에게 디버프 (이미 같은 디버프가 있는 사람은 뺌). n = 'all'이면 살아 있는 모두. nMythic = 악몽 인원.
   * pick: random (기본) / lowest = 체력 비율이 가장 낮은 사람부터, 탱커 빼고 (사냥 P-HUNT).
   * burstAdjacent = 걸린 둘이 붙어 서 있으면 바로 터짐 (전염)
   */
  | { p: 'debuff'; n: number | 'all'; nMythic?: number; pick?: 'random' | 'lowest'; debuff: DebuffDef; burstAdjacent?: boolean }
  /**
   * 최대 체력을 깎는 중첩 디버프 (썩은 숨결 · 썩은 축복 P-HPDOWN): 무작위 n명, 중첩마다 pct, max 중첩, 다시 걸리면 지속이 처음으로.
   * again = 이미 걸린 사람이 있으면 그 확률로 그중에서 고름 (썩은 축복 0.6). 지우면 최대 체력이 돌아옴 (end restoreMax)
   */
  | { p: 'rot'; n: number; debuff: DebuffDef; pct: number; max: number; again?: number }
  /**
   * 끌어당김 (P-PULL): 예고 때 고른 사람(target back)을 탱커 옆 앞줄 빈 칸으로 끌어옴. sec초 동안 보스 평타를 탱커와 번갈아 맞음
   * (끌려온 사람은 한 대에 dmg, 원거리 기준). 끌려온 칸을 벗어나면 (도망·장판 피하기) 바로 끝나고, 끝나면 제자리로 돌아감
   */
  | { p: 'pull'; sec: number; dmg: number }
  /** 쫄 n마리 (P-ADD). 악몽은 nMythic */
  | { p: 'adds'; n: number; nMythic?: number; add: AddDef }
  /** 무너지는 바닥 (P-HOLE): 가장자리 빈 칸 n개가 끝까지 못 서는 칸이 됨 (전투 전체 max개까지). 빈 칸은 늘 1개 이상 남김 */
  | { p: 'hole'; n: number; max: number }
  /**
   * 차례 (P-ORDER): 탱커 아닌 n명(나 포함, 악몽 nMythic) 칸에 번호 ①②③. sec초 안에 번호 순서대로 단일 대상 힐(기본·빠른·지속 힐 칸)을
   * 한 번씩 넣으면 성공 → 보스 daze.sec초 멍함 (기술을 안 쓰고, 받는 피해 × daze.vuln). 순서가 틀리면 그 사람 wrong 피해 + 처음부터
   * (쉬움은 피해 없이 처음부터). 시간이 다 되면 아직 못 받은 사람마다 miss 피해. 받는 치유가 깎인 사람도 횟수로 셈
   */
  | { p: 'order'; n: number; nMythic?: number; sec: number; wrong: number; miss: number; daze: { sec: number; vuln: number } }
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
  /** 디버프를 차례로 돌려 가며 n명에게 (네 가지 청소약: 질병 → 독 → 저주 → 마법) */
  | { p: 'cycle'; n: number; debuffs: DebuffDef[] };

/** 장판 칸 고르기 */
export type ZoneCells =
  /** 무작위 파티원 칸 둘레 1칸. 범위 밖 빈 칸이 범위 안 인원 이상 남는 곳만 (05 1-B: 던전에서 「피할 곳이 없어!」가 안 나오게) */
  | { p: 'around' }
  /** 판 바깥 1열: 줄마다 맨 왼쪽 또는 맨 오른쪽 칸, 쓸 때마다 좌우 번갈아 (역병 폭풍, 26 3-1) */
  | { p: 'edge' }
  /** 살아 있는 몸통(bodies 앞 n개)이 맡은 열 (몸통마다 per열)을 왼쪽부터 차례로. 악몽은 nMythic개 동시 (크레센도, 26 4-3) */
  | { p: 'bodyCols'; bodies: number; per: number; nMythic: number }
  /**
   * 흐르는 장판 (향로 연기, 35 4-1): 한쪽 끝 열에서 시작해 every초마다 한 열씩 옆으로. 다음 열은 every초 전에 예고되어 파티원이 미리 비킨다.
   * 열마다 장판은 skill.dur초 남음. from: left (기본) / right / alt = 쓸 때마다 번갈아
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
  /** 악몽 장판 피해 배율 (불협화음 0.7) */
  dpsMythic?: number;
  when?: SkillWhen;
  /** 예고 때 맞을 사람을 고름: tank = 보스가 때릴 사람, back = 뒷줄부터 n명 (탱커·나 빼고, 끌어당김). 악몽은 nMythic */
  target?: 'tank' | { p: 'back'; n: number; nMythic?: number };
  /** 맞을 때 (장판은 없음) */
  effect?: SkillEffect;
  /** 장판 칸 */
  cells?: ZoneCells;
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
  | { p: 'debuffDebuffed'; debuff: DebuffDef };

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
  /** 보스 전투 안의 적 몸통 (무음 성가대 성부·지휘자). hp는 enc.hp 기준이라 체력 배율이 그대로 붙음 */
  bodies?: { name: string; hp: number; elite?: boolean; boss?: boolean }[];
  skills: SkillDef[];
  flow?: FlowStep[];
  /** 광폭화: 시각(enc.enrage)이 되거나 레이드 탱커 공백 (35 6-4)이면 짧은 주기 전원 광역 */
  enrage: { name: string; period: number; dmg: number };
  /**
   * 주시 (P-AGGRO, 35 4-4): 내가 넣은 치유량(넘친 치유 포함)으로 눈 게이지가 참. 파티 최대 체력 합 × cap이 되면 sec초 동안
   * 보스가 every초마다 나를 dmg로 때림 (파티원 중 도발 능력이 있으면 tauntSec초). 끝나면 0부터. 악몽은 게이지가 mythicRate배 빨리 참
   */
  watch?: { cap: number; sec: number; tauntSec?: number; every: number; dmg: number; mythicRate?: number };
}

const AUTO = (dmg: number): SkillDef => ({ key: 'auto', hidden: true, first: 2, period: 2, cast: 0, effect: { p: 'auto', dmg } });
const BUSTER = (name: string, icon: string, first: number, period: number, dmg: number): SkillDef =>
  ({ key: 'buster', name, icon, kind: 'buster', first, period, cast: 2, warn: 'buster', dmg, target: 'tank', effect: { p: 'tank' } });

/** 무음 성가대 수치 (26 4-3, 보통 기준. 피해는 난이도·단계 배율을 곱함) */
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
  // 녹슨 문지기 (05 1장): 40% 아래 녹물 웅덩이
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
  // 무음 성가대 (26 4-3): 20인 입문. 성가대원 셋이 맡은 2열에 노래, 다 잡으면 지휘자 2페이즈
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
