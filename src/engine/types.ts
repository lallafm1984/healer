import type { BoardId } from '../data/boards';
import type { ClassKey } from '../data/classes';
import type { Difficulty, DiffName } from '../data/difficulty';
import type { Encounter, EncounterKey } from '../data/encounters';
import type { GearId, GearStats } from '../data/gear';
import type { ItemKey } from '../data/items';
import type { Personality, PersName } from '../data/personalities';
import type { Rules } from '../data/rules';
import type { HeroKey } from '../data/heroes';
import type { SkillKey } from '../data/skills';
import type { TalentKey } from '../data/talents';
import type { AffixKey } from '../data/affixes';
import type { AddDown, AddJob, DebuffDef, DebuffEnd, SoulFail, SoulWin } from '../data/bosses';
import type { AffixState } from './affixes';
import type { TraitKey } from '../data/traits';
import type { BarkSit } from '../data/talk/sits';
import type { SpecRun } from './specials';

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
  debt?: { min: number; grow: number };
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
}

export interface Unit {
  id: number;
  role: Role;
  /** 직업 (17). null = 직업 없는 옛 파티 (프로토타입·시뮬 일치 테스트) */
  cls: ClassKey | null;
  /** 궁수 조준: 안 움직이고 서 있은 시간 */
  aim: number;
  /** 검사 흐름: 남은 시간 */
  flow: number;
  /** 특성 (02 5-2-1) */
  traits: TraitKey[];
  /** 버팀목: 남은 시간 (받는 피해 감소) */
  bulwark: number;
  bulwarkUsed: boolean;
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
  debuffs: Debuff[];
  moving: Move | null;
  react: Reaction | null;
  retryAt: number;
  mistakeUntil: number;
  wrongUntil: number;
  fleeing: boolean;
  sulking: boolean;
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
  /** 내 힐로 회복한 양 (인연 스카우트, 12 1장) */
  got: number;
  /** 눈치 자질 (17 9-1): 반응 시간 배율, 회피 보정 */
  senseReact: number;
  senseDodge: number;
  /** 길드원이면 길드원 id */
  gid?: number;
  /** 길드원: 함께 출전한 수 (은혜 갚기 호감도) */
  runs: number;
}

/** 능력 효과 종류: cut 받는 피해 감소 · mcut 마법 피해 감소 · vuln 받는 피해 증가 · imm 피해 무시 · dps 딜 · nodps 딜 0 · heal 받는 치유
 * react 반응 시간 감소 · move 이동 시간 감소 · dodge 장판 회피 · nofear 겁 없음 · stop 멈춤 · hp 최대 체력 · absorb 흡수막 · spell 마법 기술 막기
 * noheal 치유 안 받음 · ahot 초당 자기 회복 · share 받는 피해 일부를 by가 대신 · aim 조준 유지 */
export type ModKind = 'cut' | 'mcut' | 'vuln' | 'imm' | 'dps' | 'nodps' | 'heal' | 'react' | 'move' | 'dodge' | 'nofear' | 'stop' | 'hp' | 'absorb' | 'spell' | 'noheal' | 'ahot' | 'share' | 'aim';
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
  /** 거합 반격 간격 */
  lastCounter: number;
  /** 이 능력으로 회복한 양 */
  healed?: number;
}

export interface RosterEntry {
  role: Exclude<Role, 'healer'>;
  pers: PersName;
  nick: string;
  /** 직업 (17). 없으면 역할 기본 체력·딜 */
  cls?: ClassKey;
  /** 특성 (02 5-2-1) */
  traits?: TraitKey[];
  /** 특수 능력 (17 5장, data/abilities.ts 키). 없으면 능력 없음 */
  ab?: string;
  /** 능력 강화 ★ (0~5) */
  star?: number;
  /** 길드원: 자기 레벨 (체력·딜 배율은 이 레벨로). 없으면 콘텐츠 단계 */
  lv?: number;
  /** 자질 공격·맷집·눈치 ●1~5 (17 9-1). 없으면 ●3 */
  apt?: [number, number, number];
  /** 길드원 id */
  gid?: number;
  /** 길드원: 함께 출전한 수 (은혜 갚기 호감도, 06 6장) */
  runs?: number;
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
  /** 진동 (P-QUAKE): 예고 동안 휠 가장자리가 떨림 */
  quake?: boolean;
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
  | { type: 'bark'; id: number; text: string; sit?: BarkSit }
  | { type: 'heal'; id: number; amt: number; eff: number; crit: boolean; item?: boolean }
  | { type: 'sound'; name: string }
  | { type: 'msg'; text: string }
  | { type: 'death'; id: number }
  | { type: 'debuff'; id: number; dtype: string }
  | { type: 'phase'; text: string }
  | { type: 'impact'; kind?: TelKind }
  | { type: 'dispel'; id: number; trap?: boolean; item?: boolean }
  /** 체력 선 디버프가 채워져서 사라짐 (쇠약·완치 표식, 35 3-A) */
  | { type: 'cure'; id: number; name: string }
  | { type: 'gauge'; which: string }
  | { type: 'beacon'; id: number }
  | { type: 'revive'; id: number }
  | { type: 'item'; key: ItemKey; note: string }
  /** 파티원 공격 한 방 (uid = 때린 파티원) */
  | { type: 'hit'; uid: number; amt: number }
  /** 뒤집힌 축복: 치유가 피해로 (빨간 숫자) · 실수 방지로 칸만 흔들림 */
  | { type: 'hurt'; id: number; amt: number }
  | { type: 'shake'; id: number }
  /** 치유하는 쫄이 보스를 회복 */
  | { type: 'bossHeal'; amt: number; name: string }
  | { type: 'mobDown'; id: number; name: string }
  /** 파티원 능력 사용 (17 7장: 칸 위에 이름) */
  | { type: 'ability'; id: number; name: string }
  /** 파티원 능력 회복 (연두색 숫자, 내 힐과 구분) */
  | { type: 'aheal'; id: number; amt: number }
  /** 기믹 순간 연출 (37 4장 F, 그림 fx-<name>). cell = 그 칸, on = 그 사람·영혼 (to = 날아가는 곳. id라 하지 않음: 'id' in ev 로 사람을 찾는 곳이 많음), all = 살아 있는 모두, 아무것도 없으면 보스 */
  | { type: 'fx'; name: FxName; cell?: number; on?: number; to?: number; all?: boolean }
  /** 장비 특수능력이 켜짐 (42: 칸 위에 이름, 발동 · 보호막) */
  | { type: 'spec'; id: number; name: string }
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
  | 'tide-rise' | 'tide-ebb' | 'debt-lend' | 'debt-pay' | 'debt-collect';

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
  /** 단축칸 (최대 4개) */
  items?: ItemKey[];
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
  /** 가방에 남은 소비 아이템 (19 11장). 없으면 제한 없음 */
  itemCap?: Partial<Record<ItemKey, number>>;
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
  /** 나중에 할 일 (두 번 퍼지는 기원) */
  later: { at: number; cell: number; amt: number; r: number }[];
}

/** 던전 구간 사이에 이어지는 것: 마나(휴식 회복 뒤), 성언 게이지 */
export interface Carry {
  mana: number;
  g: { p: number; s: number };
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
  itemDispels?: number;
  /** 파티원 능력 사용 횟수 · 능력 회복량 */
  abUses?: number;
  abHeal?: number;
  /** 뒤집힌 축복으로 피해가 된 치유량 */
  inverted?: number;
}

/** 파티 전체에 걸린 능력 효과 */
export interface PartyAb {
  /** 위협의 외침: 보스 피해 감소 */
  weak: number;
  weakUntil: number;
  /** 도발·눈속임: 보스 아닌 적이 이 사람을 때림 */
  taunt: number;
  tauntUntil: number;
  /** 칼날폭풍: 보스 아닌 적 초당 최대 체력 비율 피해 */
  addDot: { rate: number; until: number; by: number } | null;
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
  queued: { key: SkillKey; uid: number | null } | null;
  cd: Partial<Record<SkillKey, number>>;
  /** 성언 게이지 p = 평온, s = 신성화 */
  g: { p: number; s: number };
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
  /** 성기사 빛의 성역: 칸과 끝나는 시각 */
  sanctuary: { cells: Set<number>; end: number } | null;
  /** 사제 특성 (06 6장) */
  tx: TalentState;
  /** 특성 트리가 없는 직업의 임시 보정: 힐량 배율·마나 소모 배율·내가 받는 피해 배율 (data/heroConst TALENT_STANDIN). 사제는 null */
  standin: { heal: number; mana: number; guard: number } | null;
  /** 능력을 가진 파티원이 있음 (없으면 능력 코드를 안 탐 = 프로토타입과 같음) */
  abOn: boolean;
  ab: PartyAb;
  /** 어픽스 (없으면 null = 프로토타입과 같음) */
  aff: AffixState | null;
  skills: BossSkill[];
  tels: Telegraph[];
  zones: Zone[];
  events: FightEvent[];
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
  items: Partial<Record<ItemKey, number>>;
  potCd: number;
  medit: number;
  itemLog: { key: ItemKey; t: number }[];
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
