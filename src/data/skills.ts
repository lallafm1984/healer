/**
 * 힐러 스킬 (사제 `06` 3장, 드루이드·성기사 `25` 3장).
 * 휠은 직업마다 같은 8칸 구조라, 스킬은 칸(slot)과 배우는 레벨(lv)을 데이터로 들고 있다 (`25` 2장).
 * cost = 최대 마나 대비 %, gp/gs = 사제 성언 게이지(평온/신성화) 충전량, power = 성기사 신성한 힘 소모
 */
import { INT_BASE } from './rules';

export type SkillKey =
  // 사제
  | 'heal' | 'flash' | 'renew' | 'poh' | 'purify' | 'guardian' | 'hymn' | 'serenity' | 'sanctify' | 'relay'
  // 드루이드
  | 'sprout' | 'growth' | 'bloom' | 'wildflower' | 'natureCleanse' | 'bark' | 'quietwood' | 'rebirth'
  // 성기사
  | 'holyLight' | 'holyStrike' | 'oath' | 'lightWave' | 'handCleanse' | 'sacrifice' | 'sanctuary' | 'handGuard'
  // 주술사 (79 2장, springTotem = 가운데 스킬)
  | 'ripple' | 'shower' | 'droplet' | 'washing' | 'chainHeal' | 'earthTotem' | 'rainTotem' | 'spiritLink' | 'springTotem'
  // 수도사 (79 3장)
  | 'vitalPalm' | 'mistWrap' | 'wanderMist' | 'clearChi' | 'mistBreath' | 'soothe' | 'reviveWind' | 'tea'
  // 점성술사 (79 4장)
  | 'starHeal' | 'twinkle' | 'starMark' | 'clearStar' | 'starfall' | 'starSleep' | 'starMemory' | 'polaris'
  // 결계사 (79 5장, judgment = 가운데 스킬)
  | 'sealHeal' | 'quickSeal' | 'lightBarrier' | 'wardCleanse' | 'wardCircle' | 'guardWard' | 'lightVeil' | 'lightSpear' | 'judgment';

/** 휠 8칸. unique = 8번째 칸 (직업 고유 스킬, Lv 15) */
export type SlotName = 'basic' | 'fast' | 'hot' | 'aoe' | 'dispel' | 'ext' | 'raid' | 'unique';
/** cell = 판 위 칸을 고름 (주술사 샘 토템, 79 6-1) */
export type SkillTarget = 'ally' | 'area' | 'none' | 'dead' | 'cell';

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
  /** 이 스킬의 GCD (초, 가속 전). 없으면 규칙 GCD (1.5). 0 = GCD를 안 쓰고 GCD · 시전 중에도 바로 나감 (수도사 차 한 잔, 79 6-1) */
  gcd?: number;
  /** 모으기 (점성술사 별자리 잇기, 79 4-3): 누르고 있는 동안 별이 모이고 떼면 발동. 마나 · 재사용은 뗄 때 */
  charge?: true;
  /** 휠 밖 가운데 버튼 스킬 (주술사 샘 토템 · 결계사 심판, 79 6-1). 휠 배치에는 안 들어감 */
  core?: true;
}

export const SKILLS: Record<SkillKey, SkillDef> = {
  // ---------- ① 사제 (06) ----------
  heal: { name: '치유', short: '치유', slot: 'basic', lv: 1, cast: 2.5, cost: 3, amt: 300, target: 'ally', gp: 20 },
  flash: { name: '순간 치유', short: '순간', slot: 'fast', lv: 1, cast: 1.5, cost: 6, amt: 250, target: 'ally', gp: 15 },
  renew: { name: '소생', short: '소생', slot: 'hot', lv: 2, cast: 0, cost: 3, target: 'ally', gp: 5, gs: 5 },
  poh: { name: '치유의 기원', short: '기원', slot: 'aoe', lv: 5, cast: 2.5, cost: 10, amt: 180, target: 'area', gs: 35 },
  purify: { name: '정화', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  guardian: { name: '수호 영혼', short: '수호', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 90, target: 'ally' },
  hymn: { name: '천상의 찬가', short: '찬가', slot: 'raid', lv: 12, cast: 0, channel: 4, cost: 15, cd: 180, target: 'none' },
  serenity: { name: '성언: 평온', short: '평온', slot: 'basic', lv: 6, cast: 0, cost: 0, amt: 600, target: 'ally' },
  sanctify: { name: '성언: 신성화', short: '신성화', slot: 'aoe', lv: 6, cast: 0, cost: 0, amt: 300, target: 'area' },
  // 8번째 칸 (Lim 2026-10-11 「슬롯 한자리가 빈다」): amt = 빛의 전이 회복 한 번. 횟수·지속·거리는 data/heroConst RELAY
  relay: { name: '빛의 전이', short: '전이', slot: 'unique', lv: 15, cast: 0, cost: 3, cd: 12, amt: 120, target: 'ally' },

  // ---------- ② 드루이드 (25 3장) ----------
  sprout: { name: '새싹', short: '새싹', slot: 'basic', lv: 1, cast: 0, cost: 2, amt: 280, target: 'ally' },
  growth: { name: '생장', short: '생장', slot: 'fast', lv: 1, cast: 2.0, cost: 3, amt: 220, target: 'ally' }, // 마나 4 → 3 (2026-10-14 직업 밸런스 검토: 장비 적은 초반 드루이드가 생장으로 마나가 바닥나 어려움 · 악몽 40~70%)
  bloom: { name: '피워 내기', short: '피움', slot: 'hot', lv: 2, cast: 0, cost: 3, cd: 12, target: 'ally' },
  wildflower: { name: '들꽃 군락', short: '들꽃', slot: 'aoe', lv: 5, cast: 2.0, cost: 10, cd: 10, amt: 160, target: 'area' },
  natureCleanse: { name: '자연 정화', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  bark: { name: '나무껍질', short: '껍질', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 60, target: 'ally' },
  quietwood: { name: '고요한 숲', short: '숲', slot: 'raid', lv: 12, cast: 0, channel: 4, cost: 15, cd: 180, target: 'none' },
  rebirth: { name: '환생', short: '환생', slot: 'unique', lv: 15, cast: 3.0, cost: 5, target: 'dead' },

  // ---------- ③ 성기사 (25 3장) ----------
  holyLight: { name: '빛의 손길', short: '손길', slot: 'basic', lv: 1, cast: 2.0, cost: 4, amt: 260, target: 'ally' },
  holyStrike: { name: '빛 일격', short: '일격', slot: 'fast', lv: 1, cast: 0, cost: 5, cd: 8, amt: 230, target: 'ally' }, // 재사용 6 → 8초 (73: 즉시 힐로 힐러가 잘 안 쓰러지던 것)
  oath: { name: '빛의 서약', short: '서약', slot: 'hot', lv: 2, cast: 0, cost: 0, amt: 160, target: 'ally', power: 1, powerAll: true },
  lightWave: { name: '빛의 파도', short: '파도', slot: 'aoe', lv: 5, cast: 0, cost: 5, amt: 220, target: 'area', power: 3 }, // 마나 0 → 5% (73)
  handCleanse: { name: '정화의 손', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  sacrifice: { name: '희생', short: '희생', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 90, target: 'ally' },
  sanctuary: { name: '빛의 성역', short: '성역', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, target: 'area' },
  handGuard: { name: '보호의 손', short: '보호', slot: 'unique', lv: 15, cast: 0, cost: 2, cd: 300, target: 'ally' },

  // ---------- ④ 주술사 (79 2장) ----------
  // 79 첫 안 300 · 3% / 250 · 6% / 210 · 재사용 6 / 320 / 80 / 30 → 간격 검사 (79 2-11, 세 직업 평균 ±5%p)로 고침: 사제 메아리 · 성언, 드루이드 싼 새싹, 성기사 봉화 같은 덤이 없어 기본 힐 효율을 올림
  ripple: { name: '잔물결', short: '물결', slot: 'basic', lv: 1, cast: 2.5, cost: 2.2, amt: 330, target: 'ally' },
  shower: { name: '소나기', short: '소나기', slot: 'fast', lv: 1, cast: 1.5, cost: 5, amt: 280, target: 'ally' },
  droplet: { name: '물방울', short: '방울', slot: 'hot', lv: 2, cast: 0, cost: 3, cd: 4, amt: 330, target: 'ally' },
  washing: { name: '씻김', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  chainHeal: { name: '연쇄 치유', short: '연쇄', slot: 'aoe', lv: 5, cast: 2.5, cost: 10, amt: 300, target: 'ally' },
  earthTotem: { name: '대지 토템', short: '대지', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 90, target: 'ally' },
  rainTotem: { name: '비구름 토템', short: '비구름', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, amt: 60, target: 'none' },
  spiritLink: { name: '영혼 잇기', short: '잇기', slot: 'unique', lv: 15, cast: 0, cost: 5, cd: 120, target: 'ally' },
  springTotem: { name: '샘 토템', short: '샘', slot: 'unique', core: true, lv: 6, cast: 0, cost: 4, cd: 10, amt: 60, target: 'cell' },

  // ---------- ⑤ 수도사 (79 3장) ----------
  vitalPalm: { name: '생기 손바닥', short: '손바닥', slot: 'basic', lv: 1, cast: 0, gcd: 1.0, cost: 1.5, amt: 130, target: 'ally' },
  mistWrap: { name: '안개 감싸기', short: '감싸기', slot: 'fast', lv: 1, cast: 1.5, cost: 5, amt: 230, target: 'ally' },
  wanderMist: { name: '떠도는 안개', short: '안개', slot: 'hot', lv: 2, cast: 0, cost: 2, cd: 6, amt: 270, target: 'ally' },
  clearChi: { name: '맑은 기운', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  mistBreath: { name: '안개 숨결', short: '숨결', slot: 'aoe', lv: 5, cast: 0, cost: 10, cd: 15, amt: 160, target: 'area' },
  soothe: { name: '누그러뜨림', short: '누그러', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 120, target: 'ally' },
  reviveWind: { name: '되살림 바람', short: '바람', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, amt: 350, target: 'none' },
  tea: { name: '차 한 잔', short: '차', slot: 'unique', lv: 15, cast: 0, gcd: 0, cost: 0, cd: 60, target: 'none' },

  // ---------- ⑥ 점성술사 (79 4장) ----------
  starHeal: { name: '별빛 치유', short: '별빛', slot: 'basic', lv: 1, cast: 2.0, cost: 3, amt: 270, target: 'ally' },
  twinkle: { name: '반짝임', short: '반짝', slot: 'fast', lv: 1, cast: 0, cost: 5, cd: 9, amt: 240, target: 'ally' },
  starMark: { name: '별자리 표식', short: '표식', slot: 'hot', lv: 2, cast: 0, cost: 3, amt: 120, target: 'ally' },
  clearStar: { name: '맑은 별빛', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  starfall: { name: '별비', short: '별비', slot: 'aoe', lv: 5, cast: 0, charge: true, cost: 12, cd: 12, target: 'area' },
  starSleep: { name: '별의 잠', short: '잠', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 120, target: 'ally' },
  starMemory: { name: '별의 기억', short: '기억', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, amt: 100, target: 'none' },
  polaris: { name: '북극성', short: '북극성', slot: 'unique', lv: 15, cast: 0, charge: true, cost: 8, cd: 30, target: 'ally' },

  // ---------- ⑦ 결계사 (79 5장) ----------
  sealHeal: { name: '인장 치유', short: '인장', slot: 'basic', lv: 1, cast: 2.5, cost: 3, amt: 260, target: 'ally' },
  quickSeal: { name: '빠른 인장', short: '빠른', slot: 'fast', lv: 1, cast: 1.5, cost: 6, amt: 220, target: 'ally' },
  lightBarrier: { name: '빛의 막', short: '막', slot: 'hot', lv: 2, cast: 0, cost: 4, cd: 6, amt: 300, target: 'ally' },
  wardCleanse: { name: '결계 정화', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  wardCircle: { name: '결계 원', short: '결계', slot: 'aoe', lv: 5, cast: 0, cost: 10, cd: 20, amt: 150, target: 'area' },
  guardWard: { name: '수호 결계', short: '수호', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 90, target: 'ally' },
  lightVeil: { name: '빛의 장막', short: '장막', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, target: 'area' },
  lightSpear: { name: '빛의 창', short: '창', slot: 'unique', lv: 15, cast: 0, cost: 3, cd: 12, amt: 160, target: 'none' },
  judgment: { name: '심판', short: '심판', slot: 'unique', core: true, lv: 6, cast: 2.0, cost: 6, amt: 140, target: 'none' },
};

/** 배우는 레벨 (06 7장) */
export const SKILL_LEVEL = Object.fromEntries((Object.keys(SKILLS) as SkillKey[]).map(k => [k, SKILLS[k].lv])) as Record<SkillKey, number>;

/** 사제 패시브 (06 5장): 메아리 치유 Lv 1, 빛의 은총 Lv 4, 성언 게이지 Lv 6, 상징 Lv 10 */
export const PASSIVE_LEVEL = { echo: 1, grace: 4, words: 6, symbol: 10 } as const;
export type PassiveKey = keyof typeof PASSIVE_LEVEL;
export const PASSIVE_NAME: Record<PassiveKey, string> = { echo: '메아리 치유', grace: '빛의 은총', words: '성언 게이지', symbol: '상징' };

/**
 * 설명 속 회복량 {n} (지능 300 기준 숫자) → 「지능의 n/300 %」 (34 1-2: 지능 = 치유 회복량, 스킬 회복량은 지능의 비율).
 * int(지금 지능)를 주면 지금 값을 괄호로: 「지능의 100% (1,414)」
 */
export function healText(desc: string, int?: number): string {
  return desc.replace(/\{(\d+)\}/g, (_, n: string) => {
    const r = Number(n) / INT_BASE;
    return `지능의 ${Math.round(r * 100)}%${int ? ` (${Math.round(int * r).toLocaleString('en-US')})` : ''}`;
  });
}

/** 사제 정화로 지울 수 있는 디버프 종류 (독은 안 됨). 직업마다 다른 목록은 data/heroes.ts */
export const DISPELLABLE: Record<string, boolean> = { '질병': true, '마법': true };

/** 캐릭터 → 스킬 설명 (06 3·4장). kind = 휠 조각 종류. desc = 설명 문장 (~니다, 2026-10-07 Lim). 회복량 {n}은 healText로 「지능의 n%」 */
export const SKILL_INFO: Record<SkillKey, { kind: string; desc: string }> = {
  heal: { kind: '기본 힐', desc: '대상의 체력을 {300} 회복합니다. 평온 게이지를 20% 채웁니다.' },
  flash: { kind: '빠른 힐', desc: '대상의 체력을 {250} 회복합니다. 평온 게이지를 15% 채웁니다.' },
  renew: { kind: '지속 힐', desc: '9초 동안 3초마다 대상의 체력을 회복합니다. 모두 {240}입니다. 두 게이지를 5%씩 채웁니다.' },
  poh: { kind: '광역 힐', desc: '대상과 붙어 있는 6칸의 아군 체력을 {180}씩 회복합니다. 신성화 게이지를 35% 채웁니다.' },
  purify: { kind: '해제', desc: '대상의 마법·질병 디버프를 1개 제거합니다. 독은 제거하지 못합니다.' },
  guardian: { kind: '외부 생존기', desc: '10초 동안 대상이 죽을 피해를 받으면 대신 최대 체력의 40%를 회복합니다. 한 번만 발동합니다.' },
  hymn: { kind: '공대 쿨기', desc: '4초 동안 1초마다 파티 전원의 체력을 {120}씩 회복합니다. 그동안 다른 행동을 할 수 없습니다.' },
  serenity: { kind: '성언', desc: '대상의 체력을 즉시 {600} 회복합니다. 평온 게이지 100%에서 쓰고, 마나를 쓰지 않습니다.' },
  sanctify: { kind: '성언', desc: '대상과 붙어 있는 6칸의 아군 체력을 즉시 {300}씩 회복합니다. 신성화 게이지 100%에서 쓰고, 마나를 쓰지 않습니다.' },
  relay: { kind: '고유', desc: '대상에게 빛을 깃들게 합니다. 빛이 깃든 아군이 피해를 받으면 체력을 {120} 회복하고, 빛은 바로 옆 칸에서 체력이 가장 낮은 다른 아군에게 옮겨 갑니다 (옆 칸에 아무도 없으면 그 자리에 남습니다). 3번 회복하거나 20초가 지나면 사라지고, 회복할 때마다 신성화 게이지를 4% 채웁니다.' },

  sprout: { kind: '기본 힐', desc: '12초 동안 3초마다 대상의 체력을 회복합니다. 모두 {280}입니다. 군락 범위에 들면 회복량이 늘어납니다.' },
  growth: { kind: '빠른 힐', desc: '대상의 체력을 즉시 {220} 회복하고, 6초 동안 {90}만큼 더 회복합니다.' },
  bloom: { kind: '지속 힐 거두기', desc: '대상의 지속 힐 하나를 거둬 남은 회복량의 150%를 즉시 회복합니다.' },
  wildflower: { kind: '광역 힐', desc: '대상과 붙어 있는 6칸을 7초 동안 모두 {160} 회복합니다. 처음이 크고 점점 작아집니다. 20인 레이드에서는 2칸 거리까지 닿습니다.' },
  natureCleanse: { kind: '해제', desc: '대상의 마법·저주·독 디버프를 1개 제거합니다.' },
  bark: { kind: '외부 생존기', desc: '12초 동안 대상이 받는 피해가 20% 줄고, 대상에게 걸린 내 지속 힐이 20% 강해집니다.' },
  quietwood: { kind: '공대 쿨기', desc: '4초 동안 1초마다 파티 전원의 체력을 {100}씩 회복하고, 걸린 지속 힐의 남은 시간을 2초 늘립니다.' },
  rebirth: { kind: '부활', desc: '쓰러진 파티원 1명을 체력 40%로 일으킵니다. 전투당 1회 쓸 수 있습니다.' },

  holyLight: { kind: '기본 힐', desc: '대상의 체력을 {260} 회복하고 신성한 힘을 1 모읍니다.' },
  holyStrike: { kind: '빠른 힐', desc: '대상의 체력을 {230} 회복하고 신성한 힘을 1 모읍니다.' },
  oath: { kind: '지속 힐', desc: '모은 신성한 힘 1칸마다 4초 동안 {160} 회복합니다. 3칸이면 12초 동안 {480}입니다.' },
  lightWave: { kind: '광역 힐', desc: '신성한 힘 3칸을 모두 써서 대상과 붙어 있는 칸 중 체력이 가장 낮은 4명을 각각 {220} 회복합니다. 봉화로는 옮겨 가지 않습니다.' },
  handCleanse: { kind: '해제', desc: '대상의 마법·독·질병 디버프를 1개 제거합니다.' },
  sacrifice: { kind: '외부 생존기', desc: '12초 동안 대상이 받는 피해의 30%를 내가 대신 받습니다.' },
  sanctuary: { kind: '공대 쿨기', desc: '대상 중심 7칸에 10초 동안 성역을 세웁니다. 안에 있으면 받는 피해가 20% 줄고 초당 {40}씩 회복합니다.' },
  handGuard: { kind: '보호', desc: '6초 동안 대상이 물리 피해를 받지 않습니다. 그동안 대상은 딜을 하지 못합니다.' },

  ripple: { kind: '기본 힐', desc: '대상의 체력을 {300} 회복합니다.' },
  shower: { kind: '빠른 힐', desc: '대상의 체력을 {250} 회복합니다.' },
  droplet: { kind: '지속 힐', desc: '12초 동안 3초마다 대상의 체력을 회복합니다. 모두 {330}입니다. 물방울이 걸린 아군에게는 연쇄 치유가 2칸 거리까지 튑니다.' },
  washing: { kind: '해제', desc: '대상의 마법·저주 디버프를 1개 제거합니다.' },
  chainHeal: { kind: '광역 힐', desc: '대상의 체력을 {300} 회복하고, 붙어 있는 다친 아군에게 튑니다. 체력 비율이 가장 낮은 아군에게 먼저 튀고, 튈 때마다 회복량이 25% 줄며, 모두 4명까지 닿습니다.' },
  earthTotem: { kind: '외부 생존기', desc: '대상이 선 칸에 대지 토템을 세웁니다. 10초 동안 그 칸과 붙어 있는 6칸의 아군이 받는 피해가 15% 줄어듭니다. 토템은 그 칸에 남고 대상을 따라가지 않습니다.' },
  rainTotem: { kind: '공대 쿨기', desc: '10초 동안 2초마다 파티 전원의 체력을 {60}씩 회복합니다. 비구름 토템은 하늘에 떠서 깨지지 않고, 그동안 다른 행동을 할 수 있습니다.' },
  spiritLink: { kind: '고유', desc: '대상과 붙어 있는 아군의 체력 비율을 모두의 평균으로 똑같이 맞춥니다. 그 뒤 6초 동안 그 아군들이 받는 피해가 10% 줄어듭니다.' },
  springTotem: { kind: '토템 칸', desc: '고른 칸에 샘 토템을 세웁니다. 15초 동안 3초마다 그 칸과 붙어 있는 6칸의 아군 체력을 {60}씩 회복합니다. 20인 레이드에서는 70%만 회복합니다.' },

  vitalPalm: { kind: '기본 힐', desc: '대상의 체력을 즉시 {130} 회복합니다. 다음 행동까지 1초만 기다립니다. 2.5초 안에 다시 치면 기 리듬이 오릅니다.' },
  mistWrap: { kind: '빠른 힐', desc: '대상의 체력을 {230} 회복하고, 떠도는 안개가 없으면 6초 동안 {90} 회복하는 안개를 겁니다.' },
  wanderMist: { kind: '지속 힐', desc: '18초 동안 3초마다 대상의 체력을 회복합니다. 모두 {270}입니다. 회복할 때 대상 체력이 가득 차 있으면 붙어 있는 아군 중 안개가 없고 가장 많이 다친 아군에게 옮겨 갑니다.' },
  clearChi: { kind: '해제', desc: '대상의 마법·질병 디버프를 1개 제거합니다.' },
  mistBreath: { kind: '광역 힐', desc: '대상과 붙어 있는 6칸의 아군 체력을 즉시 {160}씩 회복합니다. 안개가 걸린 아군은 50% 더 회복합니다.' },
  soothe: { kind: '외부 생존기', desc: '10초 동안 대상이 받는 피해가 40% 줄어듭니다.' },
  reviveWind: { kind: '공대 쿨기', desc: '파티 전원의 체력을 즉시 {350}씩 회복하고, 한 명마다 마법·질병 디버프를 1개씩 제거합니다. 함정 디버프와 해제가 막힌 디버프는 건드리지 않습니다.' },
  tea: { kind: '고유', desc: '마나를 5% 회복하고 기 리듬을 2 올립니다. 마나를 쓰지 않고, 다음 행동을 기다리지 않습니다.' },

  starHeal: { kind: '기본 힐', desc: '대상의 체력을 {270} 회복하고 별 조각을 1개 얻습니다 (최대 2개).' },
  twinkle: { kind: '빠른 힐', desc: '대상의 체력을 즉시 {240} 회복하고 별 조각을 1개 얻습니다.' },
  starMark: { kind: '지속 힐', desc: '8초 동안 대상의 체력을 모두 {120} 회복합니다. 표식이 있는 동안 내가 대상에게 하는 다음 직접 힐이 50% 늘어납니다 (한 번).' },
  clearStar: { kind: '해제', desc: '대상의 마법·독 디버프를 1개 제거합니다.' },
  starfall: { kind: '광역 힐', desc: '누르고 있는 동안 별이 모이고, 떼면 별이 쏟아집니다. 별 1개: 대상 {380}, 2개: 대상과 붙어 있는 6칸 {150}씩, 3개: 같은 범위 {220}씩, 4개: 2칸 거리 안 {150}씩.' },
  starSleep: { kind: '외부 생존기', desc: '4초 동안 대상을 별빛 속에 재웁니다. 그동안 피해도 회복도 받지 않고, 딜도 하지 않습니다.' },
  starMemory: { kind: '공대 쿨기', desc: '파티 전원이 최근 4초 동안 받은 피해의 50%를 회복합니다. 적어도 {100}씩 회복합니다.' },
  polaris: { kind: '고유', desc: '누르고 있는 동안 별이 모이고, 떼면 대상의 체력을 별 1~4개에 따라 {350} · {550} · {750} · {950} 회복합니다.' },

  sealHeal: { kind: '기본 힐', desc: '대상의 체력을 {260} 회복하고 15초 동안 인장을 붙입니다.' },
  quickSeal: { kind: '빠른 힐', desc: '대상의 체력을 {220} 회복하고 15초 동안 인장을 붙입니다.' },
  lightBarrier: { kind: '보호막', desc: '15초 동안 대상에게 {300}만큼 피해를 막는 보호막을 씌우고 인장을 붙입니다.' },
  wardCleanse: { kind: '해제', desc: '대상의 마법·저주 디버프를 1개 제거합니다.' },
  wardCircle: { kind: '광역 보호막', desc: '대상과 붙어 있는 6칸의 아군에게 10초 동안 {150}만큼 피해를 막는 보호막을 씌우고 인장을 붙입니다.' },
  guardWard: { kind: '외부 생존기', desc: '8초 동안 대상이 받는 피해가 40% 줄어듭니다.' },
  lightVeil: { kind: '공대 쿨기', desc: '대상 중심 2칸 거리 안에 10초 동안 빛의 장막을 칩니다. 안에 있는 아군이 받는 피해가 25% 줄어듭니다.' },
  lightSpear: { kind: '고유', desc: '보스에게 빛의 창을 던져 딜러 한 명의 1.5초 딜만큼 피해를 줍니다. 인장이 붙은 아군 중 체력이 가장 낮은 3명을 {160}씩 회복합니다.' },
  judgment: { kind: '심판', desc: '2초 동안 심판을 외칩니다. 보스에게 딜러 한 명의 1초 딜만큼 피해를 주고, 인장이 붙은 아군 중 체력이 가장 낮은 6명을 {140}씩 회복합니다.' },
};

/** 패시브 설명 (06 5장, 성언 게이지는 4장) */
export const PASSIVE_DESC: Record<PassiveKey, string> = {
  echo: '치유·순간 치유·평온 힐량의 15%를 4초에 걸쳐 추가로 회복합니다.',
  grace: '소생이 걸린 대상에게 하는 직접 힐이 10% 늘어납니다.',
  words: '힐을 할 때마다 평온·신성화 게이지가 찹니다. 100%가 되면 휠 조각이 성언으로 바뀝니다.',
  symbol: '전투마다 한 번, 마나가 30% 아래로 내려가면 5초 동안 마나 회복이 4배가 됩니다.',
};
