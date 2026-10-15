/**
 * 힐러 스킬 (사제 `06` 3장, 드루이드·성기사 `25` 3장).
 * 휠은 직업마다 같은 8칸 구조라, 스킬은 칸(slot)과 배우는 레벨(lv)을 데이터로 들고 있다 (`25` 2장).
 * cost = 최대 마나 대비 %, gp = 사제 평온 게이지 충전량 (82: 성언 게이지는 평온 하나), power = 성기사 신성한 힘 소모
 */
import { INT_BASE } from './rules';

export type SkillKey =
  // 사제
  | 'heal' | 'flash' | 'renew' | 'poh' | 'purify' | 'guardian' | 'hymn' | 'serenity' | 'relay'
  // 드루이드
  | 'sprout' | 'growth' | 'bloom' | 'wildflower' | 'natureCleanse' | 'bark' | 'quietwood' | 'rebirth'
  // 성기사
  | 'holyLight' | 'beacon' | 'oath' | 'lightWave' | 'handCleanse' | 'sacrifice' | 'sanctuary' | 'handGuard'
  // 주술사 (79 2장, springTotem = 가운데 스킬)
  | 'ripple' | 'droplet' | 'washing' | 'chainHeal' | 'earthTotem' | 'rainTotem' | 'spiritLink' | 'springTotem'
  // 수도사 (79 3장)
  | 'vitalPalm' | 'mistWrap' | 'wanderMist' | 'clearChi' | 'mistBreath' | 'soothe' | 'reviveWind' | 'tea'
  // 점성술사 (79 4장)
  | 'starHeal' | 'twinkle' | 'starMark' | 'clearStar' | 'starfall' | 'starSleep' | 'starMemory' | 'polaris'
  // 결계사 (79 5장, judgment = 가운데 스킬)
  | 'sealHeal' | 'lightBarrier' | 'wardCleanse' | 'wardCircle' | 'guardWard' | 'lightVeil' | 'wardHold' | 'judgment';

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
  /** 성기사: 쓰는 신성한 힘 (최대 3) */
  power?: number;
  /** 성기사 빛의 서약처럼 힘을 쓸 수 있는 만큼 쓰는 스킬 */
  powerAll?: boolean;
  /** 이 스킬의 GCD (초, 가속 전). 없으면 규칙 GCD (1.5). 0 = GCD를 안 쓰고 GCD · 시전 중에도 바로 나감 (수도사 차 한 잔, 79 6-1) */
  gcd?: number;
  /** 휠 밖 가운데 버튼 스킬 (79 6-1). 2026-10-16 Lim 「가운데 버튼 기획을 제거」로 어느 스킬도 쓰지 않음 (샘 토템 · 심판은 빠른 힐 칸으로) */
  core?: true;
}

export const SKILLS: Record<SkillKey, SkillDef> = {
  // ---------- ① 사제 (06) ----------
  heal: { name: '치유', short: '치유', slot: 'basic', lv: 1, cast: 2.5, cost: 3, amt: 300, target: 'ally', gp: 20 },
  flash: { name: '순간 치유', short: '순간', slot: 'fast', lv: 1, cast: 1.5, cost: 6, amt: 250, target: 'ally', gp: 15 },
  renew: { name: '소생', short: '소생', slot: 'hot', lv: 2, cast: 0, cost: 3, target: 'ally', gp: 5 },
  poh: { name: '치유의 기원', short: '기원', slot: 'aoe', lv: 5, cast: 2.5, cost: 10, amt: 180, target: 'area', gp: 30 }, // 82: 신성화 게이지 35 → 평온 게이지 30 (신성화 몫을 평온 700과 함께 메움, 밸런스)
  purify: { name: '정화', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  guardian: { name: '수호 영혼', short: '수호', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 90, target: 'ally' },
  hymn: { name: '천상의 찬가', short: '찬가', slot: 'raid', lv: 12, cast: 0, channel: 4, cost: 15, cd: 180, target: 'none' },
  serenity: { name: '성언: 평온', short: '평온', slot: 'basic', lv: 6, cast: 0, cost: 0, amt: 700, target: 'ally' }, // 82: 600 → 700 (신성화를 없앤 몫, 밸런스)
  // 8번째 칸 (Lim 2026-10-11 「슬롯 한자리가 빈다」): amt = 빛의 전이 회복 한 번. 횟수·지속·거리는 data/heroConst RELAY
  relay: { name: '빛의 전이', short: '전이', slot: 'unique', lv: 15, cast: 0, cost: 3, cd: 12, amt: 120, target: 'ally' },

  // ---------- ② 드루이드 (25 3장) ----------
  sprout: { name: '새싹', short: '새싹', slot: 'basic', lv: 1, cast: 0, cost: 2, amt: 280, target: 'ally' },
  growth: { name: '생장', short: '생장', slot: 'fast', lv: 1, cast: 2.0, cost: 3, amt: 220, target: 'ally' }, // 마나 4 → 3 (2026-10-14 직업 밸런스 검토: 장비 적은 초반 드루이드가 생장으로 마나가 바닥나 어려움 · 악몽 40~70%)
  bloom: { name: '피워 내기', short: '피움', slot: 'hot', lv: 2, cast: 0, cost: 3, cd: 12, target: 'ally' },
  wildflower: { name: '들꽃 군락', short: '들꽃', slot: 'aoe', lv: 5, cast: 2.0, cost: 10, cd: 10, amt: 160, target: 'area' },
  natureCleanse: { name: '자연 정화', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  bark: { name: '나무껍질', short: '껍질', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 60, target: 'ally' },
  quietwood: { name: '고요한 숲', short: '숲', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, target: 'none' }, // 82: 4초 정신 집중 (찬가와 같은 모양) → 즉시 전원 새싹 · 지속 힐 연장 (QUIETWOOD)
  rebirth: { name: '환생', short: '환생', slot: 'unique', lv: 15, cast: 3.0, cost: 5, target: 'dead' },

  // ---------- ③ 성기사 (25 3장) ----------
  holyLight: { name: '빛의 손길', short: '손길', slot: 'basic', lv: 1, cast: 2.0, cost: 4, amt: 260, target: 'ally' },
  beacon: { name: '봉화', short: '봉화', slot: 'fast', lv: 6, cast: 0, cost: 3, cd: 10, amt: 160, target: 'ally' }, // 2026-10-16 Lim 「성기사는 봉화 지정스킬을 만들고 빛일격 스킬을 제거하자」 · 「봉화 스킬에 부가적인것도 추가해서 단순하게 만들지 말자」 · 「너무 좋다. 신성한 힘 1 증가 제거」: 지정 + 즉시 회복 + 피해 감소. cd = heroConst BEACON.cd
  oath: { name: '빛의 서약', short: '서약', slot: 'hot', lv: 2, cast: 0, cost: 0, amt: 160, target: 'ally', power: 1, powerAll: true },
  lightWave: { name: '빛의 파도', short: '파도', slot: 'aoe', lv: 5, cast: 0, cost: 5, amt: 220, target: 'area', power: 3 }, // 마나 0 → 5% (73)
  handCleanse: { name: '정화의 손', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  sacrifice: { name: '희생', short: '희생', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 90, target: 'ally' },
  sanctuary: { name: '빛의 성역', short: '성역', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, target: 'area' },
  handGuard: { name: '보호의 손', short: '보호', slot: 'unique', lv: 15, cast: 0, cost: 2, cd: 300, target: 'ally' },

  // ---------- ④ 주술사 (79 2장) ----------
  // 79 첫 안 300 · 3% / 250 · 6% / 210 · 재사용 6 / 320 / 80 / 30 → 간격 검사 (79 2-11, 세 직업 평균 ±5%p)로 고침: 사제 메아리 · 성언, 드루이드 싼 새싹, 성기사 봉화 같은 덤이 없어 기본 힐 효율을 올림
  ripple: { name: '잔물결', short: '물결', slot: 'basic', lv: 1, cast: 2.5, cost: 2.2, amt: 280, target: 'ally' }, // 82: 330 → 280 + 한 번 튐 30% (SHAMAN.ripple, 밸런스)
  droplet: { name: '물방울', short: '방울', slot: 'hot', lv: 2, cast: 0, cost: 3, cd: 4, amt: 330, target: 'ally' },
  washing: { name: '씻김', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  chainHeal: { name: '연쇄 치유', short: '연쇄', slot: 'aoe', lv: 5, cast: 2.5, cost: 10, amt: 300, target: 'ally' },
  earthTotem: { name: '대지 토템', short: '대지', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 90, target: 'ally' },
  rainTotem: { name: '비구름 토템', short: '비구름', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, amt: 60, target: 'none' },
  spiritLink: { name: '영혼 잇기', short: '잇기', slot: 'unique', lv: 15, cast: 0, cost: 5, cd: 120, target: 'ally' },
  springTotem: { name: '샘 토템', short: '샘', slot: 'fast', lv: 6, cast: 0, cost: 4, cd: 10, amt: 60, target: 'cell' },

  // ---------- ⑤ 수도사 (79 3장) ----------
  vitalPalm: { name: '생기 손바닥', short: '손바닥', slot: 'basic', lv: 1, cast: 0, gcd: 1.0, cost: 1.5, amt: 85, target: 'ally' }, // 79 3-11: 130 → 85 (밸런스)
  mistWrap: { name: '안개 감싸기', short: '감싸기', slot: 'fast', lv: 1, cast: 0, cost: 5, cd: 10, amt: 140, target: 'ally' }, // 82: 1.5초 시전 230 (생장과 같은 모양) → 즉시 · 리듬 비례 (MONK.wrap). GCD 1초로는 +5~12%p라 규칙 GCD (밸런스)
  wanderMist: { name: '떠도는 안개', short: '안개', slot: 'hot', lv: 2, cast: 0, cost: 2, cd: 6, amt: 270, target: 'ally' },
  clearChi: { name: '맑은 기운', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  mistBreath: { name: '안개 숨결', short: '숨결', slot: 'aoe', lv: 5, cast: 0, cost: 10, cd: 15, amt: 160, target: 'area' },
  soothe: { name: '누그러뜨림', short: '누그러', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 120, target: 'ally' },
  reviveWind: { name: '되살림 바람', short: '바람', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, amt: 350, target: 'none' },
  tea: { name: '차 한 잔', short: '차', slot: 'unique', lv: 15, cast: 0, gcd: 0, cost: 0, cd: 60, target: 'none' },

  // ---------- ⑥ 점성술사 (79 4장) ----------
  starHeal: { name: '별빛 치유', short: '별빛', slot: 'basic', lv: 1, cast: 2.0, cost: 2.0, amt: 280, target: 'ally' }, // 79 4-11: 270 · 3% → 320 · 2.2%, 83 (힐량 내림): 280 · 2%
  twinkle: { name: '반짝임', short: '반짝', slot: 'fast', lv: 1, cast: 0, cost: 4, cd: 9, amt: 240, target: 'ally' }, // 마나 5 → 4 (79 4-11)
  starMark: { name: '별자리 표식', short: '표식', slot: 'hot', lv: 2, cast: 0, cost: 1.5, amt: 160, target: 'ally' }, // 120 · 3% → 160 · 1.5% (79 4-11)
  clearStar: { name: '맑은 별빛', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  starfall: { name: '별비', short: '별비', slot: 'aoe', lv: 5, cast: 1.5, cost: 10, cd: 8, target: 'area' }, // 83: 모으기 → 시전 (별 = 1 + 조각) 1.5초. 힐량을 내린 몫은 마나 12 → 10% · 재사용 12 → 8초로
  starSleep: { name: '별의 잠', short: '잠', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 120, target: 'ally' },
  starMemory: { name: '별의 기억', short: '기억', slot: 'raid', lv: 12, cast: 1.5, cost: 15, cd: 180, amt: 100, target: 'none' }, // 82: 즉시 (최근 4초) → 별 1개마다 2초, 83: 모으기 → 시전
  polaris: { name: '북극성', short: '북극성', slot: 'unique', lv: 15, cast: 1.5, cost: 5, cd: 12, target: 'ally' }, // 마나 8 → 5% · 재사용 30 → 20초 (79 4-11), 83: 모으기 → 시전, 힐량을 내린 몫은 재사용 20 → 12초로

  // ---------- ⑦ 결계사 (79 5장) ----------
  sealHeal: { name: '인장 치유', short: '인장', slot: 'basic', lv: 1, cast: 2.5, cost: 2.2, amt: 350, target: 'ally' }, // 79 5-11: 260 · 3% → 350 · 2.2% (밸런스)
  lightBarrier: { name: '빛의 막', short: '막', slot: 'hot', lv: 2, cast: 0, cost: 3, cd: 6, amt: 300, target: 'ally' }, // 마나 4 → 3% (79 5-11)
  wardCleanse: { name: '결계 정화', short: '정화', slot: 'dispel', lv: 3, cast: 0, cost: 4, cd: 4, target: 'ally' },
  wardCircle: { name: '결계 원', short: '결계', slot: 'aoe', lv: 5, cast: 0, cost: 10, cd: 20, amt: 100, target: 'area' }, // 150 → 100 (79 5-11)
  guardWard: { name: '수호 결계', short: '수호', slot: 'ext', lv: 8, cast: 0, cost: 2, cd: 90, target: 'ally' }, // 82: 받는 피해 −40% (누그러뜨림과 같음) → 큰 보호막 (WARDER.guard)
  lightVeil: { name: '빛의 장막', short: '장막', slot: 'raid', lv: 12, cast: 0, cost: 15, cd: 180, amt: 130, target: 'none' }, // 82: 범위 피해 −25% (성역과 비슷) → 전원 보호막 + 인장
  wardHold: { name: '결계 굳히기', short: '굳히기', slot: 'unique', lv: 15, cast: 0, cost: 3, cd: 15, amt: 30, target: 'none' }, // 2026-10-16 Lim 「결계사의 창 스킬은 변경하자 (주인공은 공격스킬을 넣지 않는다)」 → 「막 옮기기 말고 보호막 지속시간을 늘려주는 스킬」: 빛의 창 (보스 공격 + 인장 3명 160) 대신. amt = 늘린 보호막마다 더하는 두께
  judgment: { name: '심판', short: '심판', slot: 'fast', lv: 6, cast: 2.0, cost: 6, amt: 90, target: 'none' }, // 140 → 90 (79 5-11)
};

/** 배우는 레벨 (06 7장) */
export const SKILL_LEVEL = Object.fromEntries((Object.keys(SKILLS) as SkillKey[]).map(k => [k, SKILLS[k].lv])) as Record<SkillKey, number>;

/** 사제 패시브 (06 5장): 메아리 치유 Lv 1, 빛의 은총 Lv 4, 평온 게이지 Lv 6, 상징 Lv 10 */
export const PASSIVE_LEVEL = { echo: 1, grace: 4, words: 6, symbol: 10 } as const;
export type PassiveKey = keyof typeof PASSIVE_LEVEL;
export const PASSIVE_NAME: Record<PassiveKey, string> = { echo: '메아리 치유', grace: '빛의 은총', words: '평온 게이지', symbol: '상징' };

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

/** 캐릭터 → 스킬 설명 (06 3·4장). kind = 휠 조각 종류 (82: 직업마다 자기 말, 사제만 교과서 이름). desc = 설명 문장 (~니다, 2026-10-07 Lim). 회복량 {n}은 healText로 「지능의 n%」 */
export const SKILL_INFO: Record<SkillKey, { kind: string; desc: string }> = {
  heal: { kind: '기본 힐', desc: '대상의 체력을 {300} 회복합니다. 평온 게이지를 20% 채웁니다.' },
  flash: { kind: '빠른 힐', desc: '대상의 체력을 {250} 회복합니다. 평온 게이지를 15% 채웁니다.' },
  renew: { kind: '지속 힐', desc: '9초 동안 3초마다 대상의 체력을 회복합니다. 모두 {240}입니다. 평온 게이지를 5% 채웁니다.' },
  poh: { kind: '광역 힐', desc: '대상과 붙어 있는 6칸의 아군 체력을 {180}씩 회복합니다. 평온 게이지를 30% 채웁니다.' },
  purify: { kind: '해제', desc: '대상의 마법·질병 디버프를 1개 제거합니다. 독은 제거하지 못합니다.' },
  guardian: { kind: '외부 생존기', desc: '10초 동안 대상이 죽을 피해를 받으면 대신 최대 체력의 40%를 회복합니다. 한 번만 발동합니다.' },
  hymn: { kind: '공대 쿨기', desc: '4초 동안 1초마다 파티 전원의 체력을 {120}씩 회복합니다. 그동안 다른 스킬을 쓰면 찬가가 끊깁니다.' },
  serenity: { kind: '성언', desc: '대상의 체력을 즉시 {700} 회복합니다. 평온 게이지 100%에서 쓰고, 마나를 쓰지 않습니다.' },
  relay: { kind: '옮겨 다니는 힐', desc: '대상에게 빛을 깃들게 합니다. 빛이 깃든 아군이 피해를 받으면 체력을 {120} 회복하고, 빛은 바로 옆 칸에서 체력이 가장 낮은 다른 아군에게 옮겨 갑니다 (옆 칸에 아무도 없으면 그 자리에 남습니다). 3번 회복하거나 20초가 지나면 사라지고, 회복할 때마다 평온 게이지를 4% 채웁니다.' },

  sprout: { kind: '심기', desc: '12초 동안 3초마다 대상의 체력을 회복합니다. 모두 {280}입니다. 군락 범위에 들면 회복량이 늘어납니다.' },
  growth: { kind: '심기 + 힐', desc: '대상의 체력을 즉시 {220} 회복하고, 6초 동안 {90}만큼 더 회복합니다.' },
  bloom: { kind: '거두기', desc: '대상의 지속 힐 하나를 거둬 남은 회복량의 150%를 즉시 회복합니다.' },
  wildflower: { kind: '광역 심기', desc: '대상과 붙어 있는 6칸을 7초 동안 모두 {160} 회복합니다. 처음이 크고 점점 작아집니다. 20인 레이드에서는 2칸 거리까지 닿습니다.' },
  natureCleanse: { kind: '해제', desc: '대상의 마법·저주·독 디버프를 1개 제거합니다.' },
  bark: { kind: '생존기', desc: '12초 동안 대상이 받는 피해가 20% 줄고, 대상에게 걸린 내 지속 힐이 20% 강해집니다.' },
  quietwood: { kind: '전원 심기', desc: '파티 전원에게 새싹을 심습니다. 이미 새싹이 있는 아군은 그대로 둡니다. 걸린 지속 힐은 모두 그 자리에서 한 번 더 회복하고 6초 늘어나며, 늘어난 만큼 더 회복합니다.' },
  rebirth: { kind: '부활', desc: '쓰러진 파티원 1명을 체력 40%로 일으킵니다. 전투당 1회 쓸 수 있습니다.' },

  holyLight: { kind: '힘 모으기', desc: '대상의 체력을 {260} 회복하고 신성한 힘을 1 모읍니다.' },
  beacon: { kind: '봉화 지정', desc: '대상을 봉화로 지정하고 체력을 {160} 회복합니다. 대상은 6초 동안 받는 피해가 10% 줄어듭니다. 봉화 대상에게는 다른 사람에게 한 빛의 손길 회복량의 40% (10인 레이드 30%, 20인 레이드 25%)가 함께 들어갑니다.' },
  oath: { kind: '힘 쓰기 · 지속', desc: '모은 신성한 힘 1칸마다 4초 동안 {160} 회복합니다. 3칸이면 12초 동안 {480}입니다.' },
  lightWave: { kind: '힘 쓰기 · 광역', desc: '신성한 힘 3칸을 모두 써서 대상과 붙어 있는 칸 중 체력이 가장 낮은 4명을 각각 {220} 회복합니다. 봉화로는 옮겨 가지 않습니다.' },
  handCleanse: { kind: '해제', desc: '대상의 마법·독·질병 디버프를 1개 제거합니다.' },
  sacrifice: { kind: '대신 맞기', desc: '12초 동안 대상이 받는 피해의 30%를 내가 대신 받습니다.' },
  sanctuary: { kind: '범위 쿨기', desc: '대상 중심 7칸에 10초 동안 성역을 세웁니다. 안에 있으면 받는 피해가 20% 줄고 초당 {40}씩 회복합니다.' },
  handGuard: { kind: '탱커 보호', desc: '6초 동안 대상이 물리 피해를 받지 않습니다. 그동안 대상은 딜을 하지 못합니다.' },

  ripple: { kind: '튀는 힐', desc: '대상의 체력을 {280} 회복하고, 붙어 있는 다친 아군 중 체력 비율이 가장 낮은 1명에게 튀어 {84} 회복합니다. 물방울이 걸린 아군에게는 2칸 거리까지 튑니다.' },
  droplet: { kind: '다리 · 지속 힐', desc: '12초 동안 3초마다 대상의 체력을 회복합니다. 모두 {330}입니다. 물방울이 걸린 아군에게는 연쇄 치유가 2칸 거리까지 튑니다.' },
  washing: { kind: '해제', desc: '대상의 마법·저주 디버프를 1개 제거합니다.' },
  chainHeal: { kind: '튀는 광역', desc: '대상의 체력을 {300} 회복하고, 붙어 있는 다친 아군에게 튑니다. 체력 비율이 가장 낮은 아군에게 먼저 튀고, 튈 때마다 회복량이 25% 줄며, 모두 4명까지 닿습니다.' },
  earthTotem: { kind: '토템', desc: '대상이 선 칸에 대지 토템을 세웁니다. 10초 동안 그 칸과 붙어 있는 6칸의 아군이 받는 피해가 15% 줄어듭니다. 토템은 그 칸에 남고 대상을 따라가지 않습니다.' },
  rainTotem: { kind: '토템 · 공대 쿨기', desc: '10초 동안 2초마다 파티 전원의 체력을 {60}씩 회복합니다. 비구름 토템은 하늘에 떠서 깨지지 않고, 그동안 다른 행동을 할 수 있습니다.' },
  spiritLink: { kind: '체력 나누기', desc: '대상과 붙어 있는 아군의 체력 비율을 모두의 평균으로 똑같이 맞춥니다. 그 뒤 6초 동안 그 아군들이 받는 피해가 10% 줄어듭니다.' },
  springTotem: { kind: '토템 칸', desc: '고른 아군 칸에 샘 토템을 세웁니다. 15초 동안 3초마다 그 칸과 붙어 있는 6칸의 아군 체력을 {60}씩 회복합니다. 20인 레이드에서는 70%만 회복합니다.' },

  vitalPalm: { kind: '연타', desc: '대상의 체력을 즉시 {85} 회복합니다. 다음 행동까지 1초만 기다립니다. 2.5초 안에 다시 치면 기 리듬이 오릅니다.' },
  mistWrap: { kind: '리듬 마무리', desc: '대상의 체력을 즉시 {140} 회복합니다. 기 리듬 1마다 12% 더 회복하고, 리듬은 끊기지 않고 이어집니다. 떠도는 안개가 없으면 6초 동안 {90} 회복하는 안개를 겁니다.' },
  wanderMist: { kind: '옮겨 다니는 지속 힐', desc: '18초 동안 3초마다 대상의 체력을 회복합니다. 모두 {270}입니다. 회복할 때 대상 체력이 가득 차 있으면 붙어 있는 아군 중 안개가 없고 가장 많이 다친 아군에게 옮겨 갑니다.' },
  clearChi: { kind: '해제', desc: '대상의 마법·질병 디버프를 1개 제거합니다.' },
  mistBreath: { kind: '즉시 광역', desc: '대상과 붙어 있는 6칸의 아군 체력을 즉시 {160}씩 회복합니다. 안개가 걸린 아군은 50% 더 회복합니다. 20인 레이드에서는 2칸 거리까지 닿습니다.' },
  soothe: { kind: '생존기', desc: '10초 동안 대상이 받는 피해가 40% 줄어듭니다.' },
  reviveWind: { kind: '공대 쿨기 · 해제', desc: '파티 전원의 체력을 즉시 {350}씩 회복하고, 한 명마다 마법·질병 디버프를 1개씩 제거합니다. 함정 디버프와 해제가 막힌 디버프는 건드리지 않습니다.' },
  tea: { kind: '마나', desc: '마나를 5% 회복하고 기 리듬을 2 올립니다. 마나를 쓰지 않고, 다음 행동을 기다리지 않습니다.' },

  starHeal: { kind: '조각 모으기', desc: '대상의 체력을 {280} 회복하고 별 조각을 1개 얻습니다 (최대 3개).' },
  twinkle: { kind: '조각 모으기 · 즉시', desc: '대상의 체력을 즉시 {240} 회복하고 별 조각을 1개 얻습니다.' },
  starMark: { kind: '표식', desc: '8초 동안 대상의 체력을 모두 {160} 회복합니다. 표식이 있는 동안 내가 대상에게 하는 다음 직접 힐이 50% 늘어납니다 (한 번).' },
  clearStar: { kind: '해제', desc: '대상의 마법·독 디버프를 1개 제거합니다.' },
  starfall: { kind: '별자리 · 광역', desc: '시전이 끝나면 모은 별 조각을 모두 써서 별 1 + 조각개가 쏟아집니다. 별 1개: 대상 {300}, 2개: 대상과 붙어 있는 6칸 {150}씩, 3개: 같은 범위 {220}씩, 4개: 2칸 거리 안 {150}씩. 조각 3개를 다 쓰면 15% 더 회복합니다.' },
  starSleep: { kind: '잠재우기', desc: '4초 동안 대상을 별빛 속에 재웁니다. 그동안 피해도 회복도 받지 않고, 딜도 하지 않습니다.' },
  starMemory: { kind: '별자리 · 되감기', desc: '시전이 끝나면 모은 별 조각을 모두 써서 파티 전원이 받은 피해를 되감습니다. 별 (1 + 조각) 1개마다 2초씩, 별 4개면 최근 8초 동안 받은 피해의 50%를 회복합니다. 적어도 {100}씩 회복합니다.' },
  polaris: { kind: '별자리 · 한 명', desc: '시전이 끝나면 모은 별 조각을 모두 써서 대상의 체력을 별 (1 + 조각) 1~4개에 따라 {280} · {380} · {480} · {580} 회복합니다. 조각 3개를 다 쓰면 15% 더 회복합니다.' },

  sealHeal: { kind: '인장 힐', desc: '대상의 체력을 {350} 회복하고 15초 동안 인장을 붙입니다.' },
  lightBarrier: { kind: '보호막', desc: '15초 동안 대상에게 {300}만큼 피해를 막는 보호막을 씌우고 인장을 붙입니다.' },
  wardCleanse: { kind: '해제', desc: '대상의 마법·저주 디버프를 1개 제거합니다.' },
  wardCircle: { kind: '광역 보호막', desc: '대상과 붙어 있는 6칸의 아군에게 10초 동안 {100}만큼 피해를 막는 보호막을 씌우고 인장을 붙입니다. 20인 레이드에서는 2칸 거리까지 닿습니다.' },
  guardWard: { kind: '큰 보호막', desc: '8초 동안 대상에게 최대 체력의 30%만큼 피해를 막는 보호막을 씌우고 인장을 붙입니다.' },
  lightVeil: { kind: '전원 보호막', desc: '파티 전원에게 12초 동안 {130}만큼 피해를 막는 보호막을 씌우고 인장을 붙입니다.' },
  wardHold: { kind: '보호막 늘리기', desc: '내가 씌운 보호막의 남은 시간을 모두 8초 늘리고, 그 보호막을 {30}씩 두껍게 합니다. 보호막이 늘어난 아군은 인장도 처음 시간으로 돌아갑니다.' },
  judgment: { kind: '인장 터뜨리기', desc: '2초 동안 심판을 외칩니다. 인장이 붙은 아군 중 체력이 가장 낮은 6명 (5인 던전 3명, 10인 레이드 4명)을 {90}씩 회복합니다.' },
};

/** 패시브 설명 (06 5장, 평온 게이지는 4장 · 82) */
export const PASSIVE_DESC: Record<PassiveKey, string> = {
  echo: '치유·순간 치유·평온 힐량의 15%를 4초에 걸쳐 추가로 회복합니다.',
  grace: '소생이 걸린 대상에게 하는 치유 · 순간 치유가 10% 늘어납니다.',
  words: '치유 · 순간 치유 · 소생 · 치유의 기원 · 빛의 전이로 평온 게이지가 찹니다. 100%가 되면 치유 칸이 성언: 평온으로 바뀝니다.',
  symbol: '전투마다 한 번, 마나가 30% 아래로 내려가면 5초 동안 마나 회복이 4배가 됩니다.',
};
