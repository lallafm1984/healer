/**
 * 힐러 스킬 (사제 `06` 3장, 드루이드·성기사 `25` 3장).
 * 휠은 직업마다 같은 8칸 구조라, 스킬은 칸(slot)과 배우는 레벨(lv)을 데이터로 들고 있다 (`25` 2장).
 * cost = 최대 마나 대비 %, gp/gs = 사제 성언 게이지(평온/신성화) 충전량, power = 성기사 신성한 힘 소모
 */
export type SkillKey =
  // 사제
  | 'heal' | 'flash' | 'renew' | 'poh' | 'purify' | 'guardian' | 'hymn' | 'serenity' | 'sanctify'
  // 드루이드
  | 'sprout' | 'growth' | 'bloom' | 'wildflower' | 'natureCleanse' | 'bark' | 'quietwood' | 'rebirth'
  // 성기사
  | 'holyLight' | 'holyStrike' | 'oath' | 'lightWave' | 'handCleanse' | 'sacrifice' | 'sanctuary' | 'handGuard';

/** 휠 8칸. unique = 8번째 칸 (직업 고유 스킬, Lv 15) */
export type SlotName = 'basic' | 'fast' | 'hot' | 'aoe' | 'dispel' | 'ext' | 'raid' | 'unique';
export type SkillTarget = 'ally' | 'area' | 'none' | 'dead';

export interface SkillDef {
  name: string;
  short: string;
  /** 휠에서 들어가는 칸 */
  slot: SlotName;
  /** 배우는 레벨 (06 7장: 직업마다 같은 순서) */
  lv: number;
  cast: number;
  cost: number;
  amt?: number;
  cd?: number;
  channel?: number;
  target: SkillTarget;
  gp?: number;
  gs?: number;
  /** 성기사: 쓰는 신성한 힘 (최대 3) */
  power?: number;
  /** 성기사 빛의 서약처럼 힘을 쓸 수 있는 만큼 쓰는 스킬 */
  powerAll?: boolean;
}

export const SKILLS: Record<SkillKey, SkillDef> = {
  // ---------- ① 사제 (06) ----------
  heal: { name: '치유', short: '치유', slot: 'basic', lv: 1, cast: 1.8, cost: 3, amt: 300, target: 'ally', gp: 20 },
  flash: { name: '순간 치유', short: '순간', slot: 'fast', lv: 1, cast: 1.0, cost: 6, amt: 250, target: 'ally', gp: 15 },
  renew: { name: '소생', short: '소생', slot: 'hot', lv: 2, cast: 0, cost: 3, target: 'ally', gp: 5, gs: 5 },
  poh: { name: '치유의 기원', short: '기원', slot: 'aoe', lv: 5, cast: 2.0, cost: 10, amt: 180, target: 'area', gs: 35 },
  purify: { name: '정화', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 8, target: 'ally' },
  guardian: { name: '수호 영혼', short: '수호', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 90, target: 'ally' },
  hymn: { name: '천상의 찬가', short: '찬가', slot: 'raid', lv: 12, cast: 0, channel: 4, cost: 15, cd: 180, target: 'none' },
  serenity: { name: '성언: 평온', short: '평온', slot: 'basic', lv: 6, cast: 0, cost: 0, amt: 600, target: 'ally' },
  sanctify: { name: '성언: 신성화', short: '신성화', slot: 'aoe', lv: 6, cast: 0, cost: 0, amt: 300, target: 'area' },

  // ---------- ② 드루이드 (25 3장) ----------
  sprout: { name: '새싹', short: '새싹', slot: 'basic', lv: 1, cast: 0, cost: 2, amt: 280, target: 'ally' },
  growth: { name: '생장', short: '생장', slot: 'fast', lv: 1, cast: 1.5, cost: 4, amt: 220, target: 'ally' },
  bloom: { name: '피워 내기', short: '피움', slot: 'hot', lv: 2, cast: 0, cost: 3, cd: 12, target: 'ally' },
  wildflower: { name: '들꽃 군락', short: '들꽃', slot: 'aoe', lv: 5, cast: 1.5, cost: 10, cd: 10, amt: 160, target: 'area' },
  natureCleanse: { name: '자연 정화', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 8, target: 'ally' },
  bark: { name: '나무껍질', short: '껍질', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 60, target: 'ally' },
  quietwood: { name: '고요한 숲', short: '숲', slot: 'raid', lv: 12, cast: 0, channel: 4, cost: 15, cd: 180, target: 'none' },
  rebirth: { name: '환생', short: '환생', slot: 'unique', lv: 15, cast: 2.0, cost: 5, target: 'dead' },

  // ---------- ③ 성기사 (25 3장) ----------
  holyLight: { name: '빛의 손길', short: '손길', slot: 'basic', lv: 1, cast: 1.5, cost: 4, amt: 260, target: 'ally' },
  holyStrike: { name: '빛 일격', short: '일격', slot: 'fast', lv: 1, cast: 0, cost: 5, cd: 6, amt: 230, target: 'ally' },
  oath: { name: '빛의 서약', short: '서약', slot: 'hot', lv: 2, cast: 0, cost: 0, amt: 160, target: 'ally', power: 1, powerAll: true },
  lightWave: { name: '빛의 파도', short: '파도', slot: 'aoe', lv: 5, cast: 0, cost: 0, amt: 220, target: 'area', power: 3 },
  handCleanse: { name: '정화의 손', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 8, target: 'ally' },
  sacrifice: { name: '희생', short: '희생', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 90, target: 'ally' },
  sanctuary: { name: '빛의 성역', short: '성역', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, target: 'area' },
  handGuard: { name: '보호의 손', short: '보호', slot: 'unique', lv: 15, cast: 0, cost: 2, cd: 300, target: 'ally' },
};

/** 배우는 레벨 (06 7장) */
export const SKILL_LEVEL = Object.fromEntries((Object.keys(SKILLS) as SkillKey[]).map(k => [k, SKILLS[k].lv])) as Record<SkillKey, number>;

/** 사제 패시브 (06 5장): 메아리 치유 Lv 1, 빛의 은총 Lv 4, 성언 게이지 Lv 6, 상징 Lv 10 */
export const PASSIVE_LEVEL = { echo: 1, grace: 4, words: 6, symbol: 10 } as const;
export type PassiveKey = keyof typeof PASSIVE_LEVEL;
export const PASSIVE_NAME: Record<PassiveKey, string> = { echo: '메아리 치유', grace: '빛의 은총', words: '성언 게이지', symbol: '상징' };

/** 사제 정화로 지울 수 있는 디버프 종류 (독은 안 됨). 직업마다 다른 목록은 data/heroes.ts */
export const DISPELLABLE: Record<string, boolean> = { '질병': true, '마법': true };

/** 캐릭터 → 스킬 설명 (06 3·4장). kind = 휠 조각 종류. desc = 설명 문장 (~니다, 2026-10-07 Lim) */
export const SKILL_INFO: Record<SkillKey, { kind: string; desc: string }> = {
  heal: { kind: '기본 힐', desc: '대상의 체력을 300 회복합니다. 평온 게이지를 20% 채웁니다.' },
  flash: { kind: '빠른 힐', desc: '대상의 체력을 250 회복합니다. 평온 게이지를 15% 채웁니다.' },
  renew: { kind: '지속 힐', desc: '9초 동안 3초마다 대상의 체력을 80씩, 총 240 회복합니다. 두 게이지를 5%씩 채웁니다.' },
  poh: { kind: '광역 힐', desc: '대상과 붙어 있는 6칸의 아군 체력을 180씩 회복합니다. 신성화 게이지를 35% 채웁니다.' },
  purify: { kind: '해제', desc: '대상의 마법·질병 디버프를 1개 제거합니다. 독은 제거하지 못합니다.' },
  guardian: { kind: '외부 생존기', desc: '10초 동안 대상이 죽을 피해를 받으면 대신 최대 체력의 40%를 회복합니다. 한 번만 발동합니다.' },
  hymn: { kind: '공대 쿨기', desc: '4초 동안 1초마다 파티 전원의 체력을 120씩, 총 480 회복합니다. 그동안 다른 행동을 할 수 없습니다.' },
  serenity: { kind: '성언', desc: '대상의 체력을 즉시 600 회복합니다. 평온 게이지 100%에서 쓰고, 마나를 쓰지 않습니다.' },
  sanctify: { kind: '성언', desc: '대상과 붙어 있는 6칸의 아군 체력을 즉시 300씩 회복합니다. 신성화 게이지 100%에서 쓰고, 마나를 쓰지 않습니다.' },

  sprout: { kind: '기본 힐', desc: '12초 동안 3초마다 대상의 체력을 70씩, 총 280 회복합니다. 군락 범위에 들면 회복량이 늘어납니다.' },
  growth: { kind: '빠른 힐', desc: '대상의 체력을 즉시 220 회복하고, 6초 동안 90을 더 회복합니다.' },
  bloom: { kind: '지속 힐 거두기', desc: '대상의 지속 힐 하나를 거둬 남은 회복량의 150%를 즉시 회복합니다.' },
  wildflower: { kind: '광역 힐', desc: '대상과 붙어 있는 6칸에 7초 동안 총 160을 회복합니다. 처음이 크고 점점 작아집니다. 20인 레이드에서는 2칸 거리까지 닿습니다.' },
  natureCleanse: { kind: '해제', desc: '대상의 마법·저주·독 디버프를 1개 제거합니다.' },
  bark: { kind: '외부 생존기', desc: '12초 동안 대상이 받는 피해가 20% 줄고, 대상에게 걸린 내 지속 힐이 20% 강해집니다.' },
  quietwood: { kind: '공대 쿨기', desc: '4초 동안 1초마다 파티 전원의 체력을 100씩 회복하고, 걸린 지속 힐의 남은 시간을 2초 늘립니다.' },
  rebirth: { kind: '부활', desc: '쓰러진 파티원 1명을 체력 40%로 일으킵니다. 전투당 1회 쓸 수 있습니다.' },

  holyLight: { kind: '기본 힐', desc: '대상의 체력을 260 회복하고 신성한 힘을 1 모읍니다.' },
  holyStrike: { kind: '빠른 힐', desc: '대상의 체력을 230 회복하고 신성한 힘을 1 모읍니다.' },
  oath: { kind: '지속 힐', desc: '모은 신성한 힘 1칸마다 4초 동안 총 160을 회복합니다. 3칸이면 12초 동안 480입니다.' },
  lightWave: { kind: '광역 힐', desc: '신성한 힘 3칸을 모두 써서 대상과 붙어 있는 6칸을 각각 220 회복합니다.' },
  handCleanse: { kind: '해제', desc: '대상의 마법·독·질병 디버프를 1개 제거합니다.' },
  sacrifice: { kind: '외부 생존기', desc: '12초 동안 대상이 받는 피해의 30%를 내가 대신 받습니다.' },
  sanctuary: { kind: '공대 쿨기', desc: '대상 중심 7칸에 10초 동안 성역을 세웁니다. 안에 있으면 받는 피해가 20% 줄고 초당 40을 회복합니다.' },
  handGuard: { kind: '보호', desc: '6초 동안 대상이 물리 피해를 받지 않습니다. 그동안 대상은 딜을 하지 못합니다.' },
};

/** 패시브 설명 (06 5장, 성언 게이지는 4장) */
export const PASSIVE_DESC: Record<PassiveKey, string> = {
  echo: '치유·순간 치유·평온 힐량의 15%를 4초에 걸쳐 추가로 회복합니다.',
  grace: '소생이 걸린 대상에게 하는 직접 힐이 10% 늘어납니다.',
  words: '힐을 할 때마다 평온·신성화 게이지가 찹니다. 100%가 되면 휠 조각이 성언으로 바뀝니다.',
  symbol: '전투마다 한 번, 마나가 30% 아래로 내려가면 5초 동안 마나 회복이 4배가 됩니다.',
};
