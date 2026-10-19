import type { BoardId } from '../data/boards';
import type { ClassKey } from '../data/classes';
import type { Difficulty, DiffName } from '../data/difficulty';
import type { Encounter, EncounterKey } from '../data/encounters';
import type { GearId, GearStats } from '../data/gear';
import type { Personality, PersName } from '../data/personalities';
import type { Rules } from '../data/rules';
import type { HeroKey } from '../data/heroes';
import type { SkillKey } from '../data/skills';
import type { TalentKey } from '../data/talents';
import type { AffixKey } from '../data/affixes';
import type { AddDown, AddJob, DebuffDef, DebuffEnd, SoulFail, SoulWin } from '../data/bosses';
import type { AffixState } from './affixes';
import type { BarkSit } from '../data/talk/sits';
import type { PersState } from './persona';
import type { SpecRun } from './specials';
import type { ShamanState } from './shaman';
import type { MonkState } from './monk';
import type { AstroState } from './astro';
import type { WarderState } from './warder';

export type Role = 'tank' | 'melee' | 'ranged' | 'healer';

export interface Cell {
  i: number;
  col: number;
  row: number;
  /** 육각 축 좌표 (axial) */
  q: number;
  r: number;
  /** 화면 배치용 좌표 (칸 반지름 1 기준) */
  px: number;
  py: number;
  unit: Unit | null;
  /** 못 서는 칸: hole = 무너진 바닥 (P-HOLE), add = 쫄(토템)이 차지, soul = 헤매는 영혼 (P-SOUL, 칸 탭으로 힐) */
  block?: 'hole' | 'add' | 'soul';
}

export interface Debuff {
  id: number;
  name: string;
  type: string;
  left: number;
  stack?: number;
  /** 초당 피해 */
  dot?: number;
  /** 지우면 터지는 함정 디버프 */
  trap?: boolean;
  /** 해제로 안 지워짐 (data/bosses.ts DebuffDef) */
  lock?: boolean;
  /** 체력 비율이 이 값 이상이면 바로 사라짐 */
  cureAt?: number;
  /** cureAt 아래인 동안 쌓이는 중첩 (쇠약). growT = 다음 중첩까지 모은 시간 */
  grow?: { every: number; dot: number; max: number };
  growT?: number;
  /** 같은 디버프가 또 걸리면 중첩 (파열). 초당 피해 = dot × 중첩 */
  stackMax?: number;
  /** 걸려 있는 동안 최대 체력 −비율 (썩은 숨결·부패) */
  maxCut?: number;
  /** 딜 0 · 못 움직임 · 판 기술에 안 맞음 (data/bosses.ts DebuffDef) */
  noDps?: boolean;
  noMove?: boolean;
  hide?: boolean;
  /** 보스 체력이 bossAt − 최대 × untilBossLoss 아래가 되면 풀림 (삼키기) */
  untilBossLoss?: number;
  bossAt?: number;
  /** 걸린 동안 딜 −비율 (하품, data/bosses.ts DebuffDef) */
  dpsCut?: number;
  /** 받는 치유 −비율 (× 중첩) · 받는 치유가 피해로 (data/bosses.ts DebuffDef) */
  healCut?: number;
  invert?: boolean;
  /** 끝날 때 하는 일 (부품) */
  end?: DebuffEnd;
  /**
   * 빌린 생명 (P-DEBT, 59 5장): 걸릴 때 체력을 가득 채우고 채운 만큼 (최소 최대 체력 × min)이 빚. 빚은 초마다 grow씩 불어나고 (어둠물에 잠기면 2배),
   * 그 사람에게 넘친 치유가 빚을 갚음. 시간이 다 되면 남은 빚만큼 피해 (고정). debtLeft = 남은 빚 (체력 단위)
   */
  debt?: { min: number; grow: number; growMythic?: number };
  debtLeft?: number;
  /** 감옥 (P-JAIL): 시간으로 안 끝나고 감옥이 깨지면 풀림 */
  jail?: boolean;
  /** 마력 역류 (P-RECOIL): 내가 스킬을 쓸 때마다 1중첩 */
  count?: boolean;
  /** 마나 갈취 (P-DRAIN) · 매혹 (P-CHARM) (data/bosses.ts DebuffDef). charmAt = 다음에 이웃을 때리는 시각 */
  drain?: number;
  charm?: { every: number; dmg: number; heal: number; free: number };
  charmAt?: number;
  /** 넘치는 빛 과부하 (P-OVER): 이 사람에게 넘친 치유 × over만큼 이웃 칸 아군 피해 */
  over?: number;
  /** 지속 피해 × feed만큼 보스 회복 (젊음의 갈망) */
  feed?: number;
  /** 생명 사슬 (P-LINK): 사슬 반대쪽 파티원 id. 실제 판정은 Fight.links */
  link?: { to: number; kind: LinkKind };
  /** 받는 피해 +비율 × 중첩 · 이 중첩이면 탱커 교대 (P-SWAP, data/bosses.ts DebuffDef) */
  vuln?: number;
  swap?: number;
  /** 5인 대신 맞기: 탱커가 하나뿐일 때 swap 중첩이면 근접 딜러가 이 초만큼 보스를 받음 (달군 쇠, 51 3-2) */
  sub?: number;
  /** 치유 흡수 (P-ABSORB): 데이터 값 · 남은 막 (보스 피해 배율을 곱한 양) */
  absorb?: number;
  absorbLeft?: number;
  /** 부풀기 (P-SWELL): every초마다 1중첩 (최대 max). swellT = 다음 중첩까지 모은 시간 */
  swell?: { every: number; max: number };
  swellT?: number;
  /** 치유 상한 (P-CAP): 치유로는 최대 체력 × cap까지만 참 */
  cap?: number;
  /** 옮겨붙음 본판 (P-JUMP): 비켜 설지 이미 정함 */
  stepped?: boolean;
  /** 칸 위 그림 (모자 뽑기, data/bosses.ts DebuffDef) */
  art?: string;
}

/**
 * 지속 힐 (드루이드 새싹·들꽃, 성기사 빛의 서약). 사제 소생은 u.hot 그대로 (프로토타입 일치).
 * amts가 있으면 틱마다 그 값, 없으면 per. boost = 나무껍질 같은 배율
 */
export interface Hot {
  key: SkillKey;
  name: string;
  left: number;
  /** 다음 틱까지 남은 시간 */
  tick: number;
  every: number;
  per: number;
  amts?: number[];
  i: number;
  /** 남은 회복량 (피워 내기용) */
  rest: number;
  /** 옮겨 가는 새싹으로 옮겨 온 것 (다시 안 옮겨 감, 42 드루 02) */
  hop?: boolean;
  /** 숲의 기억 (77): 끝까지 가면 한 번 더 걸림 */
  again?: boolean;
  /** 수도사 떠도는 안개 (79 3-2): 이 틱 (f.k)에 옮겨 옴 (같은 틱에 시간을 두 번 안 뺌) · 옮겨 간 횟수 · 머무는 안개 (안 옮겨 감) */
  hopK?: number;
  hops?: number;
  stay?: boolean;
  /** 점성술사 별자리 표식 (79 4-2): 다음 직접 힐 보너스가 남아 있음 */
  bonus?: boolean;
}

/** 직접 힐 뒤 4초간 이어지는 잔향 회복 */
export interface Echo {
  left: number;
  rate: number;
}

export interface Move {
  from: number;
  to: number;
  left: number;
  total: number;
}

export interface Reaction {
  at: number;
  tel: number;
  wrong?: boolean;
  /** 예언가 (95): 이번엔 틀린 칸으로 감 · 점프광: 나를 안 노리는 예고에 뜀 */
  fore?: boolean;
  hop?: boolean;
  /** 능력치 (99): 늦게 피함 = 터진 뒤 이 칸들 (예고 칸)에서 뛰어나옴 */
  late?: Set<number>;
}

export interface Unit {
  id: number;
  role: Role;
  /** 직업 (17). null = 직업 없는 옛 파티 (프로토타입·시뮬 일치 테스트) */
  cls: ClassKey | null;
  /** 다음 공격에 넣을 딜 (공격 간격 동안 모음) */
  acc: number;
  /** 이번 전투에 넣은 딜 합 (딜미터기) */
  dealt: number;
  pers: PersName | null;
  p: Partial<Personality>;
  nick: string;
  base: number;
  max: number;
  hp: number;
  dps: number;
  alive: boolean;
  cell: number;
  home: number;
  hot: number;
  hotTick: number;
  /** 지속 힐 (사제 밖 직업) */
  hots: Hot[];
  /** 받는 피해 감소: 남은 시간과 감소율 (나무껍질·성역) */
  redu: number;
  reduCut: number;
  /** 희생: 이 사람이 받는 피해의 일부를 내가 대신 (남은 시간) */
  sacr: number;
  /** 보호의 손: 물리 피해 무시 (남은 시간). 그동안 딜 0 */
  immune: number;
  echo: Echo[];
  /** 사제 소생이 옮겨 간 것인지 (옮겨 가는 소생 특성: 한 번만) */
  hotHop?: boolean;
  guardian: number;
  shield: number;
  /** 초마다 조금씩 차는 회복 (healFlow)을 모으는 중: 1초가 지나면 숫자 하나 (tick 사건) */
  flow?: { amt: number; eff: number; t0: number };
  /** 틱마다 드는 피해 (dripDamage)를 FLOW_SEC씩 모으는 중 → dmg 사건 하나 (화면 빨간 숫자) */
  drip?: { amt: number; t0: number };
  debuffs: Debuff[];
  /** 퍼지는 박동에 맞음 (첫 햇살 조약돌: 다음 직접 힐 +15%, 59 6장). 그 장신구가 있을 때만 붙음 */
  pulsed?: boolean;
  moving: Move | null;
  react: Reaction | null;
  retryAt: number;
  mistakeUntil: number;
  wrongUntil: number;
  /** 능력치 (99 나): 탱커가 1열을 못 찾고 머뭇거리는 끝 (칸 위 「?」) · 엉뚱한 칸에 한 번 갔음 */
  lostUntil?: number;
  lostWrong?: boolean;
  /** 능력치 (99 마, Codex 검토 반영 1): 보스를 뺏고 당황해 장판 반응을 머뭇거리는 때까지 (침착 15 밑) */
  hesitUntil?: number;
  /** 능력치 (99 집중): 다음 「멍」 때 · 멍한 끝 (집중 15 밑, 긴 전투일수록 잦음) */
  dazeNext?: number;
  dazeUntil?: number;
  /** 99 빗나감 대사를 한 때 (같은 사람 whiffGap초에 한 번) */
  whiffAt?: number;
  /** 능력치 (99, Codex 검토 반영 4): 최근 실수 시각 · 수습 틈 끝 (그동안 새 실수 굴림 없음) */
  slips?: number[];
  regroupUntil?: number;
  /** 능력치 (99 맷집): 큰 한 방 뒤 휘청한 끝 (맷집 15 밑) · 버틴 때 (15 넘음, 탱커 강타 1초 위협) */
  staggerUntil?: number;
  steadyAt?: number;
  /** 능력치 (99 위치 잡기): 옆 사람의 옮겨붙음 · 부풀기를 이미 본 디버프 id (15 넘으면 먼저 떨어져 섬, 한 번만 굴림) */
  spreadSeen?: number;
  fleeing: boolean;
  sulking: boolean;
  /** 관심종자 삐짐: 이번 전투에 삐진 횟수 · 삐진 때 · 혼자 풀린 때 (SULK) */
  sulkN?: number;
  sulkFrom?: number;
  sulkOff?: number;
  lastHeal: number;
  thanks: number;
  flash: number;
  barkAt: number;
  ignoreZone: number;
  homeAt: number | null;
  /** 끌어당김 (P-PULL): 이 시각까지 cell에서 보스 평타를 탱커와 번갈아 맞음 (한 대 dmg) */
  pulled?: { until: number; cell: number; dmg: number } | null;
  /** 받침 (P-TOWER): 이 시각까지 발판에 머묾 (제자리로 안 돌아감) */
  padUntil?: number;
  /**
   * 띄워 올리기 (P-LIFT, 56 5장): until까지 하늘에 떠 있음 (새 힐 · 해제 · 보스 기술이 안 닿고 딜 0, 미리 건 지속 힐 · 지속 피해만).
   * fall = 내려올 때 피해 (aim 기준), chain = 내려오는 순간 이 사람에게서 연쇄 번개, land = random 무작위 빈 칸 · free 떠 있는 동안 칸을 비움 (같으면 제자리)
   */
  lift?: { until: number; fall: number; aim: 'tank' | 'party'; chain?: { dmg: number; jumps: number; grow: number; name: string }; land?: 'random' | 'free' } | null;
  /** 옮겨붙음을 들고 비켜 선 동안 (P-JUMP): 원래 자리로 안 돌아감 */
  awayUntil?: number;
  /** 헤매는 영혼 (P-SOUL): 파티원이 아닌 영혼 칸 (Fight.souls). 파티 목록에는 없음 */
  soul?: SoulState;
  diedAt: number;
  me: boolean;
  /** 파티원 특수 능력 (17). 없으면 null */
  ab: AbState | null;
  /** 능력이 건 효과 (받는 피해·딜·반응 …). 비어 있으면 아무 영향 없음 */
  mods: Mod[];
  /** 성격 상태 (75 문서, 새 20종만) */
  ps?: PersState;
  /** 능력치가 정한 전투 값 (97 FM, 공개모집 1000명). 없으면 예전 값 */
  fm?: import('../data/fm').FmFx;
  /** 그날 능력치 (꾸준함 흔들림을 더한 값, 어그로 96이 기술 숙련 · 집중 · 반응 · 판단 · 침착을 읽음) */
  fmStats?: import('../data/fm').Stats;
  /** 그 사람 레벨 (공개모집 자기 레벨 · 길드원 · 없으면 칸 레벨). 어그로 레벨 차이 */
  lv?: number;
  /** 어그로 (96): 뺏는 선 가까이 와서 딜을 줄인 동안 · 보스를 뺏었다 돌려준 뒤 조심하는 때까지 (딜 줄임, 다시 안 뺏음) */
  thrEase?: boolean;
  thrCool?: number;
  /** 강타 예고를 맞은 시각 (어그로: 탱커 집중) */
  busterAt?: number;
  /** 성장 행동을 판단할 때 쓸 이 전투의 최저 체력 비율 */
  low?: number;
  /** 길드원 「한 일」 (97): 장판을 피한 수 · 옮긴 수 · 끊은 수 · 맞은 강타 수 · 쫄에게 준 딜 */
  did?: { dodge: number; move: number; cut: number; buster: number; adds: number; help: number };
  /** 짝꿍 (95): 짝 (아군 id). 붙어 있으면 둘 다 회피 + */
  pairWith?: number;
  /** 칭찬왕 · 보은형 (95): 체력 25% 아래로 내려간 적 있음 (60% 위로 오면 살아남) */
  lowMark?: boolean;
  /** 응원단장이 응원해 줌: 이 시각까지 딜 +cheerUp */
  cheerUntil?: number;
  cheerUp?: number;
  /** 영웅이 대신 맞아 줌: until까지 받는 피해의 share를 id가 */
  coverBy?: { id: number; until: number; share: number };
  /** 이번 전투에서 내 힐로 회복한 양 (은혜 갚기) */
  got: number;
  /** 눈치 자질 (17 9-1): 반응 시간 배율, 회피 보정 */
  senseReact: number;
  senseDodge: number;
  /** 능력치 (99): 순간마다 들쭉날쭉한 폭 (꾸준함 1 · 10 · 20 = 1.6 · 1 · 0.35). 능력치가 없는 사람 (튜토리얼 · 프로토타입)은 없음 = 흔들림 없음 */
  wob?: number;
  /** 길드원이면 길드원 id */
  gid?: number;
  /** 결계사 인장 (79 5장): 이 시각까지 붙어 있음 */
  seal?: number;
  /** 점성술사 별의 잠 (79 4장): 이 시각까지 피해 · 회복 · 딜 없음 */
  sleep?: number;
  /** 최근 받은 피해 (점성술사 별의 기억, 79 4-2): 0.5초 칸 12개 (6초) 링버퍼 · 마지막으로 쓴 칸 번호. 점성술사 전투에서만 */
  dmgLog?: number[];
  dmgLogK?: number;
}

/** 능력 효과 종류: cut 받는 피해 감소 · mcut 마법 피해 감소 · vuln 받는 피해 증가 · imm 피해 무시 · dps 딜 · nodps 딜 0 · heal 받는 치유
 * react 반응 시간 감소 · move 이동 시간 감소 · dodge 장판 회피 · nofear 겁 없음 · stop 멈춤 · hp 최대 체력 · absorb 흡수막 · spell 마법 기술 막기
 * noheal 치유 안 받음 · ahot 초당 자기 회복 · share 받는 피해 일부를 by가 대신 */
export type ModKind = 'cut' | 'mcut' | 'vuln' | 'imm' | 'dps' | 'nodps' | 'heal' | 'react' | 'move' | 'dodge' | 'nofear' | 'stop' | 'hp' | 'absorb' | 'spell' | 'noheal' | 'ahot' | 'share' | 'storm';
export interface Mod { k: ModKind; v: number; until: number; src: string; by?: number }

/** 능력 상태 */
export interface AbState {
  key: string;
  star: number;
  /** 다시 쓸 수 있는 시각 */
  ready: number;
  uses: number;
  /** each 능력: 쓴 쓰는 때 번호 */
  fired: number[];
  /** 시간 되돌리기: 1초마다 체력 */
  hist: number[];
  /** 덜렁이: 회복 능력을 쓰는 체력 (무작위) */
  odd?: number;
  /** 능력치 (99 라): 이번 판 생존기 체력 기준 흔들림 (꾸준함) */
  gj?: number;
  /** 능력치 (99, Codex 검토 B): 예고 반응을 판단만큼 늦게 쓰려고 기다리는 중 (예고 id · 쓸 때 · 쓰는 때 번호 · 대상) */
  pend?: { tel: number; at: number; i: number; target?: number };
  /** 거합 반격 간격 */
  lastCounter: number;
  /** 이 능력으로 회복한 양 */
  healed?: number;
  /** 일섬 연격 (93 4-4): 이 시각에 옆 아군 딜 */
  after?: { at: number; v: number; sec: number; r: number };
}

export interface RosterEntry {
  role: Exclude<Role, 'healer'>;
  pers: PersName;
  nick: string;
  /** 직업 (17). 없으면 역할 기본 체력·딜 */
  cls?: ClassKey;
  /** 특수 능력 (17 5장, data/abilities.ts 키). 없으면 능력 없음 */
  ab?: string;
  /** 능력 강화 ★ (0~5) */
  star?: number;
  /** 길드원: 자기 레벨 (체력·딜 배율은 이 레벨로). 없으면 콘텐츠 단계 */
  lv?: number;
  /** 길드원 버릇 (93 13-1 · 97): 침착 · 판단이 정한 단점 배율 (반응이 느린 몫 · 회피 −). 없으면 1 */
  habit?: number;
  /** 길드원 id */
  gid?: number;
  /** 공개모집 (97 FM): lv가 그 사람 자기 레벨 (칸 레벨 상한 없음) */
  pub?: boolean;
  /** 능력치 12 (97 FM) · 이번 판 꾸준함 흔들림 (모든 칸에 더함) */
  fm?: { stats: import('../data/fm').Stats; off: number; steady?: number };
}

export type TelKind = 'buster' | 'aoe' | 'zone' | 'instant';

export interface BossSkill {
  key: string;
  /** 적 기술이면 그 적 id (쓰러지면 멈춤) */
  mob?: number;
  name?: string;
  icon?: string;
  kind?: TelKind;
  /** 대기열에 안 보이는 기술 (평타) */
  hidden?: boolean;
  next: number;
  period: number;
  cast: number;
  warn?: string;
  dmg?: number;
  dps?: number;
  dur?: number;
  active: (f: Fight) => boolean;
  /** cast 0 기술 */
  fire?: (f: Fight) => void;
  target?: (f: Fight) => number[];
  hit?: (f: Fight, tel: Telegraph) => void;
  cellsFor?: (f: Fight) => Set<number>;
  /** 끊기 가능 ✋ (17 7장): 보스당 1~2개, 작은 기술만 */
  cut?: boolean;
  /** 적 기술이 탱커가 아닌 사람을 때림 (도발·눈속임 판단) */
  other?: boolean;
  /** 흐르는 장판: 다음 열까지 초 (예고 = 이 시간) */
  flowEvery?: number;
  /** 장판 예고가 맞는 순간 한 번 피해 (피난처) */
  hitDmg?: number;
  /** 장판이 맞는 순간 그 칸 사람에게 디버프 (data SkillDef.hitDebuff) */
  hitDebuff?: DebuffDef;
  /** 장판이 맞는 순간 그 칸 가운데에 이펙트 (data SkillDef.hitFx, 용의 숨결) */
  hitFx?: FxName;
  /** 예고에 안전 칸을 붙임 (피난처) */
  safe?: boolean;
  /** 진동 (P-QUAKE): 예고 동안 휠 가장자리가 떨림. 크게 뛰기 (59 4-4)도 같음 */
  quake?: boolean;
  /** 퍼지는 박동 (59 4-4): 겹 칸 장판 (맞으면 칸마다 보랏빛 고리) */
  pulse?: boolean;
  /** 장판에 맞은 사람의 남은 빚 × (1 + hitDebt) */
  hitDebt?: number;
  /** 반격 틈 (P-COUNTER): 끊기면 보스가 이만큼 기절 */
  stunOnCut?: number;
  /** 받침 (P-TOWER): 예고 칸이 금빛 발판이고 파티원이 들어감 */
  pads?: boolean;
  /** 피할 수 없는 장판 예고 (줄 피해 P-ROW): 파티원이 안 비킴 */
  fixed?: boolean;
  /** 집결 분담 (P-SOAK): 예고 동안 가까운 파티원이 대상 옆으로 모임 */
  soak?: boolean;
  /** 보물 욕심 (P-GREED): 맞을 피해 (예고 칸에 금화 · 숫자) */
  greed?: number;
  /** 사냥 (P-HUNT): 맞는 순간 체력 비율이 가장 낮은 사람 (루비나의 진주, 51 6장) */
  hunt?: boolean;
  /** 신기루 (P-MIRAGE, 54 5장): 예고를 띄울 때 가짜 예고를 함께 (data/bosses SkillDef.mirage) */
  mirage?: { n?: number; nMythic?: number; chance?: number; reveal?: number };
  /** 모래시계 (P-GLASS): 이 기술이 맞으면 모래시계를 뒤집음 (자동 힐러가 예고 동안 모두 채움) */
  glass?: boolean;
  /** 가짜 반격 틈 (54 3-2): 틈이 gap초 간격으로 두 번, 하나는 신기루 (data SkillEffect counter.decoy) */
  decoy?: { gap: number; stunMythic?: number };
  /** 신기루 피난처 (54 4-3): 가짜 안전 칸 묶음 = 진짜와 반대쪽 끝 (맞는 칸을 돌려줌) */
  mirrorCells?: (f: Fight) => Set<number>;
  /** 띄워 올리기 (P-LIFT, 56 5장): 예고 칸에 회오리, 자동 힐러가 예고 동안 대상에게 지속 힐 · 해제를 먼저. pre = 예고가 뜰 때 대상에게 거는 디버프 */
  lift?: { pre?: DebuffDef };
  /** 연쇄 번개 (P-CHAIN, 56 5장): 예고 칸에 번개 구름, 자동 힐러가 예고 동안 대상 이웃을 90% 위로 */
  chain?: boolean;
  /** 어둠물 밀물 (P-TIDE, 59 5장): 잠길 줄 예고 (화면 물결), 맞으면 잠긴 칸 장판 (Zone.tide). 자동 힐러가 예고 동안 잠길 줄 사람을 채움 */
  tide?: boolean;
  /** 물로 끌어내림 (59 4-3 휘감이): 예고에 찍힌 사람이 잠긴 줄로 끌려감. 자동 힐러가 예고 동안 미리 채움 */
  drag?: boolean;
  /** 부품 상태 (장판 좌우 번갈아·성부 차례 등, engine/bossParts.ts) */
  st: Record<string, number | boolean>;
}

export interface Telegraph {
  id: number;
  skill: BossSkill;
  kind?: TelKind;
  start: number;
  impact: number;
  units: number[];
  cells: Set<number>;
  dps?: number;
  dur?: number;
  /** 흐르는 장판: 이 열이 맞으면 dir 쪽 다음 열을 every초 예고 */
  flow?: { col: number; dir: 1 | -1; every: number };
  /** 피난처: 안전 칸 (화면 금빛). cells = 맞는 칸 */
  safe?: Set<number>;
  /** 끌려온 칸의 받침이 울리는 예고 (P-PULL pad): 맞을 때 끌기 대신 받침 피해 */
  ring?: boolean;
  /** 신기루 (P-MIRAGE, 54 5장): 가짜가 걷히는 시각. 진짜 · 가짜 예고 모두에 붙음 (그 전에는 둘이 똑같이 보임) */
  veil?: number;
  /** 신기루 가짜: veil에 일렁이며 사라지고 맞지 않음. 화면 · 자동 힐러는 veil 전에 이 값을 보지 않음 */
  fake?: boolean;
  /** 가짜 반격 틈: 걷힐 때 신중파가 끊을지 이미 봄 */
  seen?: boolean;
  /** 99 방어: 이 강타에 자세를 못 잡은 사람 (그만큼 더 맞음, 예고 숫자도) */
  offGuard?: number[];
}

export interface Zone {
  id: number;
  cells: Set<number>;
  end: number;
  dps: number;
  /** 요정 고리 (P-GROW, 48 5장): 가운데 칸 · 자란 겹 수 · 최대 겹 · 자라는 간격 · 마지막으로 자란 시각 · 기술 이름 */
  ring?: { center: number; n: number; max: number; every: number; at: number; name: string };
  /** 어둠물 밀물 (P-TIDE, 59 5장): 잠긴 칸 (판 아래 줄). 선 사람은 받는 치유 × (1 − TIDE_CUT) */
  tide?: boolean;
}

export type FightEvent =
  /** 파티원 말풍선. sit = 상황 (41 문서, 프로토타입 규칙이면 없음) */
  | { type: 'bark'; id: number; text: string; sit?: BarkSit; ally?: number }
  /** 어그로 (96): 보스가 id를 봄 (from = 놓친 사람) */
  | { type: 'aggro'; id: number; from: number }
  | { type: 'heal'; id: number; amt: number; eff: number; crit: boolean }
  /**
   * 지속 · 간접 회복 (지속 힐 틱 · 토템 · 비구름 · 봉화 나눔 …, 직접 힐 아닌 heal): 화면은 직접 힐과 같은 숫자 · 같은 자리 (빛 · 소리는 없음).
   * 다 넘친 것 (eff 0)은 안 냄. 초마다 조금씩 차는 회복 (healFlow)은 1초씩 모아 한 번에
   */
  | { type: 'tick'; id: number; amt: number; eff: number; crit: boolean }
  /** 흡수 보호막을 씌움 (amt = 더해진 양): 화면은 회복 숫자와 같은 자리에 파란 숫자 */
  | { type: 'shield'; id: number; amt: number }
  | { type: 'sound'; name: string }
  | { type: 'msg'; text: string }
  | { type: 'death'; id: number }
  | { type: 'debuff'; id: number; dtype: string }
  | { type: 'phase'; text: string }
  | { type: 'impact'; kind?: TelKind }
  /** ally = 파티원 능력의 해제 (내 해제가 아님: 진동 · 해제 빛 없음) */
  | { type: 'dispel'; id: number; trap?: boolean; ally?: boolean }
  /** 체력 선 디버프가 채워져서 사라짐 (쇠약·완치 표식, 35 3-A) */
  | { type: 'cure'; id: number; name: string }
  | { type: 'gauge'; which: string }
  | { type: 'beacon'; id: number }
  | { type: 'revive'; id: number }
  /** 파티원 공격 한 방 (uid = 때린 파티원) */
  | { type: 'hit'; uid: number; amt: number; crit?: boolean }
  /** 능력치 (99 다): 파티원 한 방이 빗나감 (보스 초상에 회색 「빗나감」) */
  | { type: 'miss'; uid: number }
  | { type: 'daze'; id: number }
  | { type: 'offGuard'; id: number }
  | { type: 'clump'; id: number }
  | { type: 'alone'; id: number }
  | { type: 'stagger'; id: number; steady?: boolean }
  /** 능력치 (99 라): 보스 평타를 막아 반만 맞음 (칸 위 「막음」) */
  | { type: 'parry'; id: number }
  /** 뒤집힌 축복: 치유가 피해로 (말풍선 반응. 숫자는 dmg 사건) */
  | { type: 'hurt'; id: number; amt: number }
  /**
   * 파티원이 받은 피해 (체력이 실제로 준 양, 보호막에 다 막히면 안 냄): 화면은 회복 숫자 자리에 빨간 숫자 (2026-10-16 Lim 「피해를 입으면 빨간 숫자로」).
   * 장판 · 지속 피해처럼 틱마다 드는 피해 (dripDamage)는 1초씩 모아 하나로
   */
  | { type: 'dmg'; id: number; amt: number }
  | { type: 'shake'; id: number }
  /** 치유하는 쫄이 보스를 회복 */
  | { type: 'bossHeal'; amt: number; name: string }
  | { type: 'mobDown'; id: number; name: string }
  /** 파티원 능력 사용 (17 7장: 칸 위에 이름) */
  | { type: 'ability'; id: number; name: string; fumble?: boolean; weak?: '짧게' | '반만' | '약하게' }
  | { type: 'regroup'; id: number }
  /** 파티원 능력 회복 (연두색 숫자, 내 힐과 구분) */
  | { type: 'aheal'; id: number; amt: number }
  /** 기믹 순간 연출 (37 4장 F, 그림 fx-<name>). cell = 그 칸, on = 그 사람·영혼 (to = 날아가는 곳. id라 하지 않음: 'id' in ev 로 사람을 찾는 곳이 많음), all = 살아 있는 모두, 아무것도 없으면 보스 */
  | { type: 'fx'; name: FxName; cell?: number; on?: number; to?: number; all?: boolean }
  /** 장비 특수능력이 켜짐 (42: 칸 위에 이름, 발동 · 보호막) */
  | { type: 'spec'; id: number; name: string }
  /** 탱커 앞줄 이탈 (위치 규칙): 적이 노리는 사람이 바뀜. null = 탱커가 1열로 돌아옴 (사람이 아니라 'id' in ev 로 찾지 않게 on) */
  | { type: 'loose'; on: number | null }
  | { type: 'over'; result: FightResult };

/** 기믹 연출 이름 = 그림 fx-<이름> (37 4장 F-1) */
export type FxName = 'spawn' | 'explode' | 'slam' | 'warn' | 'shockwave' | 'crumble' | 'dizzy' | 'chain-break' | 'soul-purify' | 'splash'
  | 'link-snap' | 'bubble' | 'overflow' | 'fireball-green' | 'hearts' | 'hook' | 'rage' | 'recoil'
  | 'soak' | 'swap' | 'slow' | 'absorb' | 'cheer'
  /** 묶음 B 새 부품 (46 5장, 그림 37 G · 47 E): 부풀기 지워서 퐁 · 치유 상한 먹물 · 뒤집힘 금화. 두어서 터지면 explode */
  | 'swell-pop' | 'ink-splat' | 'coin-flip'
  /** 묶음 C 새 부품 (48 5장, 그림 49): 요정 고리가 깔리거나 자람 · 넘어가는 포자가 날아감 */
  | 'ring-grow' | 'spore-pass'
  /** 장비 특수능력 (36 J): 튀는 빛이 옆 칸으로 날아감 */
  | 'bounce'
  /** 묶음 C2 (48 4장, 그림 49): 모자가 씌워짐 · 춤바람 음표 · 꿀벌이 쏨 · 숲 할아버지가 깨어남 */
  | 'hat-drop' | 'dance' | 'bee-sting' | 'tree-wake'
  /** 묶음 D 새 부품 (51 5장, 그림 52): 보물 욕심 금화가 날아감 · 녹는 보호막 열기 · 알이 깨짐 */
  | 'greed-coin' | 'melt-heat' | 'egg-hatch' | 'dragon-breath' | 'door-open'
  /** 묶음 E 새 부품 (54 5장, 그림 55 E): 신기루가 걷힘 · 모래시계를 뒤집음 (보스) · 체력이 되감김 · 모래 폭풍 · 하품 · 심장 박동 */
  | 'mirage-shimmer' | 'hourglass-flip' | 'sand-rewind' | 'sandstorm' | 'yawn' | 'heartbeat'
  /** 묶음 F 새 부품 (56 5장, 그림 57 E): 회오리가 띄워 올림 · 구름에서 내려앉음 · 번개가 하늘에서 떨어짐 · 이웃으로 튐 (on → to) · 피뢰침에서 땅으로 빠짐 */
  | 'lift-swirl' | 'land-puff' | 'chain-strike' | 'chain-bolt' | 'chain-rod'
  /** 묶음 F2 우르릉 기우는 섬 (낮은 쪽으로 바람 · 구름이 쓸려 감, 판 전체) */
  | 'island-tilt'
  /** 묶음 G 새 부품 (59 5장, 그림 60 E): 어둠물이 차오름 · 빠짐 · 생명을 빌려줌 (보랏빛 손) · 빚을 갚음 (금빛 동전) · 남은 빚을 거둬 감 */
  | 'tide-rise' | 'tide-ebb' | 'debt-lend' | 'debt-pay' | 'debt-collect' | 'tide-island' | 'tide-drag' | 'pulse-ring' | 'wedge'
  /** 사제 빛의 전이: 깃듦 · 회복하고 다음 사람에게 옮겨 감 (on → to) · 사라짐 */
  | 'relay-land' | 'relay-fly' | 'relay-gone';

export type FightResult = 'win' | 'lose';

export interface FightConfig {
  encounter: EncounterKey;
  diff: DiffName;
  seed?: number;
  gear?: GearId;
  /** 실제 착용 장비로 계산한 능력치 (있으면 gear 프리셋 대신 씀) */
  gearStats?: GearStats;
  board?: BoardId;
  /** 없으면 시드로 공개모집 파티를 뽑음 */
  party?: RosterEntry[];
  /** 던전 앞 구간에서 이어받는 것 (23 4장) */
  carry?: Carry;
  /** 힐러 레벨: 이 레벨까지 배운 스킬·패시브만 씀 (06 7장). 없으면 전부 (시뮬·옛 테스트) */
  level?: number;
  /** 힐러 직업 (25). 없으면 사제 */
  hero?: HeroKey;
  /** 실제 힐러 레벨: 힐량·체력 배율 (lvPower). 단계보다 낮으면 단계로 봄. 없으면 단계와 같음 */
  heroLv?: number;
  /** 콘텐츠 단계 레벨: 파티원·적 체력·피해·딜 배율. 없으면 1 (배율 1) */
  stageLv?: number;
  /** 사제 특성: 단마다 고른 칸 번호 (06 6장). 없으면 특성 없음 */
  talents?: (number | null)[];
  /** 직업군 방어력 (34 9-2). false면 끔 = 프로토타입과 같음 (parity 테스트) */
  armor?: boolean;
  /** 프로토타입 규칙 (34 이전 숫자·시전·GCD, data/rules PROTO_RULES). 난이도 보정(tune)도 안 씀. parity 테스트 전용 */
  proto?: boolean;
  /** 어픽스 (32 난이도 어픽스, 13 3-3 주간 도전). 없으면 어픽스 없음 */
  affixes?: AffixKey[];
  /** 보스·적 체력·피해 배율 (주간 도전 단계, 13 3-2). 없으면 1 */
  bossMult?: { hp: number; dmg: number };
  /** 난이도 보정을 data/tune 대신 이 값으로 (자동 밸런스가 배율을 찾을 때, 38 0-6) */
  tune?: { dmg?: number; hp?: number };
  /** 장비 특수능력 (42): 켜지는 값 (data/specials specTotals). 없으면 특수능력 없음 = 옛 결과 그대로 */
  specs?: Record<string, number>;
}

/** 보조 버튼 특성 하나의 상태 */
export interface TalentAct {
  cd: number;
  left: number;
  used: boolean;
}

/** 사제 특성 상태 (06 6장). 특성이 없으면 on이 비어 있고 아무 효과 없음 */
export interface TalentState {
  on: Partial<Record<TalentKey, true>>;
  act: Partial<Record<TalentKey, TalentAct>>;
  /** 슬픔의 힘: 이 시각까지 힐 +30% */
  griefUntil: number;
  /** 말씀의 여운: 이 시각까지 마나 소모 -50% */
  echoUntil: number;
  /** 마지막으로 스킬을 쓴 시각 (숨 고르기) */
  lastAct: number;
  /** 한 사람만 본다: 이어서 치유한 대상과 횟수 */
  focus: { uid: number; n: number } | null;
  /** 두 겹 수호: 남은 충전, 다음 충전까지 */
  guard: number;
  guardRe: number;
  repayUsed: boolean;
  /** 쉼터 칸 (-1 = 없음) */
  shelter: number;
  /** 나중에 할 일: 두 번 퍼지는 기원 (기본), 다시 피는 들꽃 (wild, amt = 위력 배율), 구원의 손 (heal, uid에게 amt) */
  later: { at: number; cell: number; amt: number; r: number; kind?: 'wild' | 'heal'; uid?: number }[];
  /** 고른 특성이 하나라도 있음 (특성 한 틱) · 받는 피해 · 지속 힐 배율 · 쓰러질 때를 바꾸는 특성이 있음 (빠른 길, 77) */
  any: boolean;
  cut: boolean;
  hotm: boolean;
  death: boolean;
  /** 생장의 숨: 남은 공짜 새싹 */
  freeSprout: number;
  /** 이끼 자리: 이끼 칸 → 끝나는 시각 */
  moss: Map<number, number> | null;
  /** 맑은 새싹: 다음에 발동할 수 있는 시각 */
  cleanAt: number;
  /** 나무의 몸 · 경계의 싹 · 봉화의 숨 재발동 대기 (초) */
  treeCd: number;
  watchCd: number;
  breathCd: number;
  /** 경계의 싹: 이미 본 예고 id */
  telSeen: number;
  /** 이번 전투에 쓴 환생 수 (두 번째 봄) */
  rebirths: number;
  /** 모아 둔 빛: 다음 빛의 손길 마나 없음 */
  freeLight: boolean;
  /** 순교의 빛: 이 시각까지 빛의 서약 + */
  martyrUntil: number;
}

/** 던전 구간 사이에 이어지는 것: 마나(휴식 회복 뒤), 성언 게이지 */
export interface Carry {
  mana: number;
  g: { p: number };
}

/** 보스가 아닌 적 (23). 화면 이름은 일반·정예 */
export interface Mob {
  id: number;
  name: string;
  elite: boolean;
  /** 보스 전투의 보스 몸통 (유령 성가대 지휘자). 앞의 적을 다 잡아야 맞음 */
  boss?: boolean;
  hp: number;
  max: number;
  alive: boolean;
  /** 능력으로 기절·얼림: 이 시각까지 기술을 안 씀 */
  stun?: number;
  /** 일반 · 정예 구간 적이 쓰러질 때 (MobDef.down, 먼지 유령). downDone = 이미 했음 */
  down?: AddDown; downDone?: boolean;
  /** 보스 전투 중에 나온 쫄 (P-ADD): 맡은 사람(on)을 every초마다 때림. 보스 체력 합에는 안 들어감 */
  add?: {
    short: string; on: number; dmg: number; every: number; next: number; down?: AddDown; done?: boolean;
    /** 차지한 칸 · 오라 장판 id */
    cell?: number; zone?: number;
    /** 하는 일과 다음 시각 (치유하는 쫄 · 큰 쫄 강타 · 걸음) · 터지는 시각 (폭탄) */
    job?: AddJob; jobAt?: number;
    /** 감옥이 건 디버프 id (P-JAIL) · 흡수까지 남은 걸음 (P-MARCH) · 강타 예고 소리를 냈나 (P-ELITE) · 쫄 떼 (P-SWARM) */
    hold?: number; steps?: number; warned?: boolean; cleave?: boolean;
    /** 칸 그림 이름 (데이터 AddDef.art) */
    art?: string;
  };
}

export interface Cast {
  key: SkillKey;
  cell: number;
  uid: number;
  left: number;
  total: number;
}

export interface FightStats {
  /** 어그로 (96): 딜러가 뺏은 횟수 · 내가 (힐러) 뺏은 횟수 · 뺏긴 동안 보스에게 맞은 피해 */
  steals?: number;
  healerSteals?: number;
  /** 뺏은 사람이 되찾기 전에 쓰러진 횟수 (sim 보정용) */
  stealDeaths?: number;
  stealDmg?: number;
  healed: number;
  overheal: number;
  deaths: number;
  minMana: number;
  dispels: number;
  dispellable: number;
  trapPops: number;
  queueLost: number;
  casts: Partial<Record<SkillKey, number>>;
  taps: number;
  missTaps: number;
  emptyTaps: number;
  cancels: number;
  manaFails: number;
  hymnBroken: number;
  /** 파티원 능력 사용 횟수 · 능력 회복량 */
  abUses?: number;
  abHeal?: number;
  /** 뒤집힌 축복으로 피해가 된 치유량 */
  inverted?: number;
}

/** 판 위 물건 (79 6-1): 토템 · 샘 · 성채 · 초신성. 칸 위에 서지만 길을 막지 않음. tick = 다음 효과까지 남은 초, at = 세운 시각 */
export type TotemKind = 'spring' | 'earth' | 'sea' | 'mist' | 'citadel' | 'nova';
export interface Totem { kind: TotemKind; cell: number; until: number; tick: number; at: number; /** 세울 때 받은 시간 (초, 특성 · 특수능력으로 늘어난 길이 그대로. 토템 부르기가 이만큼 다시 채움). 없으면 until − at */ dur?: number; /** 깨지지 않음 (바다의 자리 · 초신성 등) */ firm?: boolean }

/**
 * 모으기 (점성술사 별자리 잇기, 79 4-3): key 스킬을 uid (범위면 cell 중심)에게 모으는 중.
 * t0 = 별이 모이기 시작하는 시각 (GCD 중에 누르면 GCD가 끝난 뒤), acc = 다음 별까지 모은 시간, stars = 지금 별 수, full = 마지막 별이 뜬 시각,
 * release = 시작 전에 뗌 (시작하자마자 터짐), autoAt = 자동 힐러가 뗄 시각
 */
/** 파티 전체에 걸린 능력 효과 */
export interface PartyAb {
  /** 위협의 외침: 보스 피해 감소 */
  weak: number;
  weakUntil: number;
  /** 도발·눈속임: 보스 아닌 적이 이 사람을 때림 */
  taunt: number;
  tauntUntil: number;
}

export interface Fight {
  board: BoardId;
  cfg: FightConfig;
  enc: Encounter;
  diff: Difficulty;
  rng: () => number;
  /** 장비 능력치. heal에는 치유 배율 (RULES.heal, 34 1-6)이 곱해져 있음 */
  gear: GearStats;
  cells: Cell[];
  rows: number;
  mythic: boolean;
  t: number;
  /** 틱 번호 */
  k: number;
  over: FightResult | null;
  reason: string;
  /** 난이도 피해 배율 × 단계 배율 */
  dmgMult: number;
  /** 단계 배율 (R.lv(stageLv) × 적 세기 0.95): 파티원·적 체력·피해·딜 */
  scale: number;
  /** 힐러 레벨 배율 (R.lv(heroLv)): 힐량·내 체력 */
  power: number;
  bossMax: number;
  /** 일반·정예 구간은 남은 적 체력 합 */
  bossHp: number;
  /** 일반·정예 구간이면 잡을 차례대로 */
  mobs: Mob[];
  mana: number;
  gcd: number;
  gcdBase: number;
  cast: Cast | null;
  channel: number;
  chTick: number;
  /** 예약한 스킬 (cell = 칸을 고르는 스킬의 칸, 79 6-1) */
  queued: { key: SkillKey; uid: number | null; cell?: number } | null;
  cd: Partial<Record<SkillKey, number>>;
  /** 성언 게이지 p = 평온 (82: 신성화 게이지는 없앰) */
  g: { p: number };
  symbolUsed: boolean;
  symbol: number;
  /** 힐러 레벨 (스킬·패시브 해금) */
  level: number;
  /** 힐러 직업 (25) */
  hero: HeroKey;
  /** 성기사 신성한 힘 (0~3) */
  power3: number;
  /** 성기사 봉화 대상 id */
  beacon: number | null;
  /** 성기사 봉화를 바꾼 뒤 남은 대기 */
  beaconCd: number;
  /** 드루이드 환생을 썼는지 (전투당 1회) */
  rebirthUsed: boolean;
  /** 성기사 빛의 성역: 칸과 끝나는 시각 · 가운데 칸 · 연 시각 (판 위 그림 board-sanctuary 자리) */
  sanctuary: { cells: Set<number>; end: number; hps?: number; cell?: number; at?: number } | null;
  /** 사제 빛의 전이 (8번째 칸): 빛이 깃든 사람 id · 남은 회복 · 사라지는 시각 · 이 시각까지 옮겨 가는 중 (아직 안 깃듦). 하나만 */
  relay: { id: number; left: number; until: number; flyUntil: number } | null;
  /** 판 위 물건 (주술사 토템 · 수도사 안개 샘 · 결계사 성채 · 점성술사 초신성, 79 6-1) */
  totems: Totem[];
  /** 주술사 상태 (비구름 · 물웅덩이 · 대지 충전 · 특성 재발동, engine/shaman) */
  sham?: ShamanState;
  /** 결계사 상태 (빛의 장막 · 특성 재발동 · 나를 위한 막, engine/warder) */
  warder?: WarderState;
  /** 점성술사 상태 (이번 별자리 조각 · 별의 길 · 두 번째 별비 · 특성 재발동, engine/astro) */
  astro?: AstroState;
  /** 수도사 상태 (고요한 호흡 · 특성 재발동, engine/monk) */
  monk?: MonkState;
  /** 수도사 기 리듬 (79 3-3): 리듬 · 이 시각까지 다음 손바닥이 없으면 내려감 */
  beat: number;
  beatUntil: number;
  /** 점성술사 별 조각 (79 4-3, 83: 모으기를 없애고 별자리 시전이 다 씀) */
  shards: number;
  /** 사제 특성 (06 6장) */
  tx: TalentState;
  /** 특성 단 마나 보정 배율 (열린 특성 단마다 −2%, 세 직업 공통 heroConst TIER_MANA). 프로토타입은 1 */
  manaCut: number;
  /** 능력을 가진 파티원이 있음 (없으면 능력 코드를 안 탐 = 프로토타입과 같음) */
  abOn: boolean;
  /** 새 성격 (75 · 95 문서)이 있는 전투: 없으면 성격 훅을 안 봄 */
  persOn?: boolean;
  /** 든든이 (95): 옆 아군 받는 피해를 줄이는 탱커들 (없으면 undefined) */
  sturdy?: Unit[];
  /** 95 2차: 큰형 · 샘쟁이 · 칭찬왕 목록, 살아남 보기, 분위기메이커 (이 시각까지 반응 ×moodReact), 칭찬 (파티 딜), 대타 (보스를 붙잡은 딜러) */
  mentors?: Unit[];
  envy?: Unit[];
  praisers?: Unit[];
  saveWatch?: boolean;
  mood?: number;
  moodReact?: number;
  praise?: { until: number; up: number };
  standIn?: { id: number; until: number };
  /** 99 협동 (Codex 검토 반영 3): 끊기 실패 뒤 대신 끊을 사람 · 그 기술 · 끊는 때 */
  cutRetry?: { id: number; skill: BossSkill; at: number };
  ab: PartyAb;
  /** 어픽스 (없으면 null = 프로토타입과 같음) */
  aff: AffixState | null;
  skills: BossSkill[];
  tels: Telegraph[];
  zones: Zone[];
  events: FightEvent[];
  /**
   * 화면 이펙트용 (PXF 스킬 이펙트, 2026-10-11): 휠 스킬이 대상에게 들어간 순간 (시전이 끝나 들어감 · 즉시 · 정신 집중 시작)마다 { 스킬, 대상 }.
   * 사건(events)이 아니라 따로 둬서 프로토타입 일치 비교에 안 섞임. 화면이 매 프레임 비우고, 안 비우는 시뮬레이션에서는 USED_MAX에서 멈춤
   */
  used?: { key: SkillKey; uid: number; /** 사람 없이 칸에만 (판 위 물건, uid -1) */ cell?: number }[];
  phase: number;
  phaseName: string;
  invuln: boolean;
  enraged: boolean;
  /** 직업군 방어력을 쓰는가 (cfg.armor) */
  armor: boolean;
  /** 전투 기본 규칙 (34 1장, cfg.proto면 프로토타입 규칙) */
  R: Rules;
  /** 레이드에서 탱커가 모두 쓰러진 시각 (35 6-4). 탱커가 일어나면 null */
  noTankAt: number | null;
  /** 보스 체력 = 몸통(보스가 아닌 적 포함) 체력 합 (일반·정예 구간, 유령 성가대). 쫄(add)은 빼고 셈 */
  bodyHp: boolean;
  rats: number[];
  stats: FightStats;
  nextId: number;
  party: Unit[];
  me: Unit;
  /** 보스 기술을 key로 (페이즈 흐름이 시작·주기를 바꿈, data/bosses.ts) */
  bs: Record<string, BossSkill>;
  /** 인터미션이 끝나는 시각 */
  interEnd?: number;
  /** 차례 (P-ORDER): 번호 순서의 파티원 id, 다음 차례 i, 끝나는 시각 */
  order: OrderState | null;
  /** 보스 멍함: until까지 새 기술을 안 쓰고 받는 피해 × vuln (차례 성공). name = 체력바에 보일 이름 (숨 고르기), 없으면 멍함 */
  daze: { until: number; vuln: number; name?: string } | null;
  /** 쉬움·보통 뒤집힌 축복 실수 방지: 이 디버프 칸을 한 번 눌렀음 (두 번째부터 힐이 나감) */
  invertTap: number | null;
  /** 무력화 (P-STAGGER): 게이지를 채울 끝 시각 · 모은 딜 / 끝 · 체력 기준 · 탱커 배율 · 성공/실패 */
  stagger: { name: string; until: number; fill: number; need: number; hp: number; tank: number; win: { sec: number; vuln: number }; fail: { dmg: number; lock: number } } | null;
  /** 진동 (P-QUAKE)으로 잠긴 스킬: 남은 초 / 처음 초 */
  lock: Partial<Record<SkillKey, { left: number; total: number }>>;
  /** 주시 (P-AGGRO): 눈 게이지 (넣은 치유량) / 가득 / 보스가 나를 노리는 끝 시각 / 다음 한 대 */
  /** 어그로 (96, engine/threat). null = 끈 판 */
  thr?: import('./threat').ThreatState | null;
  watch: { fill: number; max: number; rate: number; until: number; next: number; sec: number; every: number; dmg: number } | null;
  /** 걸어오는 쫄이 흡수되어 보스가 주는 피해가 커진 몫 (P-MARCH, 0.1 = +10%). 화면 표시용, 실제 배율은 dmgMult에 곱함 */
  empower: number;
  /** 헤매는 영혼 (P-SOUL): 판 빈 칸에 나온 영혼. 칸 탭으로 단일 힐을 받음 */
  souls: Unit[];
  /** 생명 사슬 (P-LINK): 이어진 두 파티원 */
  links: LinkState[];
  /** 넘치는 빛 그릇 (P-OVER): 넘친 치유를 모음 / 가득 / 끝 시각. 차면 전원 shield초 보호막 */
  vessel: { name: string; fill: number; need: number; until: number; shield: number } | null;
  /** 녹는 보호막 (P-MELT, 51 5장): until까지 흡수 보호막이 초마다 rate씩 녹고 보호막 · 외부 생존기 시간이 두 배로 줄어듦 */
  melt: { name: string; until: number; rate: number } | null;
  /** 모래시계 (P-GLASS, 54 5장): 겹치면 각자 자기 기록으로 (짧은 것이 먼저) */
  glass: GlassState[];
  /** 영혼 축복: until까지 받는 치유 × heal (정화의 물) */
  bless: { heal: number; until: number } | null;
  /** 영혼 축복: until까지 보스가 주는 피해 × (1 − cut). dmgMult에 곱했다가 끝나면 되돌림 */
  weak: { cut: number; until: number } | null;
  /** 영혼 축복: until까지 보스가 받는 피해 × vuln (숲 할아버지가 왕관을 흔듦, 48 4-3). 보스가 기술은 그대로 씀 (멍함과 다름) */
  expose: { vuln: number; until: number } | null;
  /** 장비 특수능력 (42, engine/specials). 없으면 null */
  sp: SpecRun | null;
  /** 보스를 잡은 탱커 id (탱커 교대 P-SWAP). null이면 줄 앞 탱커 */
  hold: number | null;
  /** 5인 대신 맞기 (DebuffDef.sub): 이 사람이 until까지 보스를 받음 (탱커 표식이 풀리는 동안) */
  sub: { id: number; until: number } | null;
  /** 탱커 앞줄 이탈 (위치 규칙, engine/position): 탱커가 1열에 없어서 적이 노리는 사람과 이탈한 시각. 탱커가 돌아오면 null */
  loose: { id: number; since: number } | null;
  /** 깨진 시간 (05 5-E): until까지 내 시전 시간 × mult */
  slow: { until: number; mult: number } | null;
  /** 전투의 함성 (05 6-D): until까지 파티원 딜 × mult */
  cheer: { until: number; mult: number } | null;
  /** 영원한 저녁 (05 6-G): 판의 체력 숫자를 숨김 */
  dark: boolean;
  /** 몸통을 고르게 깎음 (쌍둥이 여군주, data/bosses.ts BossDef.split) */
  split: boolean;
}

export type LinkKind = 'balance' | 'share';

/** 생명 사슬 (P-LINK): balance = 체력 비율 차이가 gap을 넘으면 끊어지며 둘 다 dmg, share = 받는 피해·치유를 반씩 나눔 */
export interface LinkState {
  name: string;
  kind: LinkKind;
  a: number;
  b: number;
  /** 걸린 시각 (2초는 안 끊어짐) · 끝 시각 */
  at: number;
  until: number;
  gap: number;
  dmg: number;
  aim: 'tank' | 'party';
}

/** 헤매는 영혼 (P-SOUL): 끝 시각 · 처음 초. cleansed = 해제로 바로 성공 */
export interface SoulState {
  name: string;
  short: string;
  until: number;
  total: number;
  cleansed?: boolean;
  win: SoulWin;
  fail: SoulFail;
  /** 칸 그림 이름 (데이터 soul.art) */
  art?: string;
}

export interface OrderState {
  name: string;
  ids: number[];
  i: number;
  until: number;
  wrong: number;
  miss: number;
  daze: { sec: number; vuln: number };
  /** 신기루 숫자 (54 4-1 냥크스): fake 칸에 num번째 번호가 하나 더 보이다가 until에 걷힘. 그 전에 그 사람에게 힐하면 틀림 */
  fake?: { id: number; num: number; until: number };
  /** 악몽: 틀리면 전원 이만큼 (마법) */
  wrongAll?: number;
}

/** 모래시계 (P-GLASS, 54 5장): 뒤집은 순간 살아 있는 파티원의 체력 비율 (id → 비율), until에 모두 그 비율로 */
export interface GlassState {
  name: string;
  at: number;
  until: number;
  rec: Map<number, number>;
  /** 되돌릴 때 치유 흡수 막이 남은 사람 이만큼 (악몽 둘둘이) */
  absorbHit?: number;
  /** 되돌릴 때 체력 비율이 below 아래인 사람 dmg 더 (악몽 째깍이). 악몽이 아니면 없음 */
  lowHit?: { below: number; dmg: number };
}

/** 스킬·아이템 사용 결과 */
export interface ActionResult {
  ok: boolean;
  reason?: string;
  same?: boolean;
  queued?: boolean;
  u?: Unit;
}
