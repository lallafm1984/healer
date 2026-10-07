import type { BoardId } from '../data/boards';
import type { ClassKey } from '../data/classes';
import type { Difficulty, DiffName } from '../data/difficulty';
import type { Encounter, EncounterKey } from '../data/encounters';
import type { GearId, GearStats } from '../data/gear';
import type { ItemKey } from '../data/items';
import type { Personality, PersName } from '../data/personalities';
import type { HeroKey } from '../data/heroes';
import type { SkillKey } from '../data/skills';
import type { TraitKey } from '../data/traits';

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
  diedAt: number;
  me: boolean;
}

export interface RosterEntry {
  role: Exclude<Role, 'healer'>;
  pers: PersName;
  nick: string;
  /** 직업 (17). 없으면 역할 기본 체력·딜 */
  cls?: ClassKey;
  /** 특성 (02 5-2-1) */
  traits?: TraitKey[];
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
}

export interface Zone {
  id: number;
  cells: Set<number>;
  end: number;
  dps: number;
}

export type FightEvent =
  | { type: 'bark'; id: number; text: string }
  | { type: 'heal'; id: number; amt: number; eff: number; crit: boolean; item?: boolean }
  | { type: 'sound'; name: string }
  | { type: 'msg'; text: string }
  | { type: 'death'; id: number }
  | { type: 'debuff'; id: number; dtype: string }
  | { type: 'phase'; text: string }
  | { type: 'impact'; kind?: TelKind }
  | { type: 'dispel'; id: number; trap?: boolean; item?: boolean }
  | { type: 'gauge'; which: string }
  | { type: 'beacon'; id: number }
  | { type: 'revive'; id: number }
  | { type: 'item'; key: ItemKey; note: string }
  /** 파티원 공격 한 방 (uid = 때린 파티원) */
  | { type: 'hit'; uid: number; amt: number }
  | { type: 'mobDown'; id: number; name: string }
  | { type: 'over'; result: FightResult };

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
  hp: number;
  max: number;
  alive: boolean;
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
}

export interface Fight {
  board: BoardId;
  cfg: FightConfig;
  enc: Encounter;
  diff: Difficulty;
  rng: () => number;
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
  /** 단계 배율 (lvPower(stageLv)): 파티원·적 체력·피해·딜 */
  scale: number;
  /** 힐러 레벨 배율 (lvPower(heroLv)): 힐량·내 체력 */
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
  skills: BossSkill[];
  tels: Telegraph[];
  zones: Zone[];
  events: FightEvent[];
  phase: number;
  phaseName: string;
  invuln: boolean;
  enraged: boolean;
  rats: number[];
  items: Partial<Record<ItemKey, number>>;
  potCd: number;
  medit: number;
  itemLog: { key: ItemKey; t: number }[];
  stats: FightStats;
  nextId: number;
  party: Unit[];
  me: Unit;
  // 보스 스크립트 상태
  zoneSkill?: BossSkill;
  pulse?: BossSkill;
  contagion?: BossSkill;
  storm?: BossSkill;
  stormSide?: boolean;
  interEnd?: number;
}

/** 스킬·아이템 사용 결과 */
export interface ActionResult {
  ok: boolean;
  reason?: string;
  same?: boolean;
  queued?: boolean;
  u?: Unit;
}
