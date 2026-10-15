/** 힐러 장비 등급 이름과 시뮬 프리셋 (08 4-2, 34 6장). 장비 한 개의 모양은 data/equipment */
import { ITEM_GRADES, ROLL_MIN, SLOTS, presetStats, statsToGear, type ItemGrade } from './equipment';
import type { HeroKey } from './heroes';
import { SPECS, SPEC_KEYS, specTotals, specValue } from './specials';

export type GradeName = '없음' | '일반' | '고급' | '희귀' | '영웅' | '전설';

export type GearId = 'none' | 'adv0' | 'rare5' | 'epic5';

export interface GearPreset {
  label: string;
  /** 6부위 공통 등급 */
  g: GradeName;
  /** 강화 단계 */
  u: number;
}

export const GEARS: Record<GearId, GearPreset> = {
  none: { label: '장비 없음', g: '없음', u: 0 },
  adv0: { label: '고급 +0', g: '고급', u: 0 },
  rare5: { label: '희귀 +5', g: '희귀', u: 5 },
  epic5: { label: '영웅 +5', g: '영웅', u: 5 },
};

/**
 * 프리셋의 대표 특수능력 (42 1-7 「시뮬 장비 프리셋에 등급별 대표 특수능력 조합」): 부위마다 줄 수 기댓값만큼, 흔한 공통 특수능력,
 * 굴림은 가운데 값. 고급은 20%로 1줄이라 6부위 ≈ 1줄, 희귀 · 영웅은 부위마다 1줄. 직업 전용 · 이름 있는 장신구는 넣지 않음.
 */
export const GEAR_SPECS: Record<GearId, readonly string[]> = {
  none: [],
  adv0: ['warmTouch'],
  rare5: ['wideEmbrace', 'brimming', 'sturdyBack', 'pouch', 'cheerFlag', 'springSip'],
  epic5: ['wideEmbrace', 'brimming', 'sturdyBack', 'pouch', 'cheerFlag', 'springSip'],
};
/** 프리셋 특수능력 값 (전투 시작 specs). 장비 없음이면 빈 값 */
export function presetSpecs(id: GearId, hero: HeroKey): Record<string, number> {
  const { g } = GEARS[id];
  if (g === '없음') return {};
  const mid = (ROLL_MIN + 1) / 2;
  return specTotals(GEAR_SPECS[id].map(key => ({ key, v: specValue(key, g, mid) })), hero);
}

/**
 * 직업 전용 특수능력 프리셋 (79 「전용장비 밸런스」, 72 · 42 2-9): 대표 특수능력 줄 (GEAR_SPECS와 같은 줄 수)을 그 직업 전용 특수능력으로 바꾼 것.
 * 부위마다 그 부위 · 등급에 나오는 그 직업 전용 하나를 시드로 고름 (가운데 굴림). 직업마다 이 프리셋 − 대표 프리셋 클리어율 = 전용 장비 이득 폭
 */
export function classSpecs(id: GearId, hero: HeroKey, seed: number): Record<string, number> {
  const { g } = GEARS[id];
  if (g === '없음') return {};
  const grade = g as ItemGrade, gi = ITEM_GRADES.indexOf(grade), mid = (ROLL_MIN + 1) / 2, n = GEAR_SPECS[id].length;
  let a = (Math.imul(seed, 0x9e3779b1) ^ 0x7f4a7c15) >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const lines: { key: string; v: number }[] = [], used = new Set<string>();
  const start = Math.floor(rnd() * SLOTS.length);
  for (let i = 0; i < n; i++) {
    const slot = SLOTS[(start + i) % SLOTS.length].key;
    const pool = SPEC_KEYS.filter(k => SPECS[k].hero === hero && SPECS[k].slots.includes(slot) && ITEM_GRADES.indexOf(SPECS[k].min) <= gi && !used.has(k));
    if (!pool.length) continue;
    const key = pool[Math.floor(rnd() * pool.length)];
    used.add(key);
    lines.push({ key, v: specValue(key, grade, mid) });
  }
  return specTotals(lines, hero);
}

export interface GearStats {
  /** 치유 회복량 배율 (1 + 지능) */
  heal: number;
  /** 마나 재생 배율 (1 + 정신력) */
  regen: number;
  haste: number;
  /** 장비 치명타 몫. 기본 치명타는 엔진이 더함 (data/rules baseCrit) */
  crit: number;
  /** 내 최대 체력 + 비율 (34 6-5 방어구 주 능력치 · 체력 옵션). 옛 설정엔 없음 = 0 */
  hp?: number;
  /** 내가 받는 피해 − 비율 (인내, 상한 30%). 옛 설정엔 없음 = 0 */
  endure?: number;
}

/** 프로토타입 엔진의 등급별 [힐량 보정, 보조 능력치 개수] (08 4-2, sim gear_stats). 일치 테스트(proto)에서만 */
const PROTO_GRADE: Record<GradeName, readonly [number, number]> = {
  '없음': [0, 0], '일반': [0.02, 0], '고급': [0.04, 1], '희귀': [0.06, 2], '영웅': [0.08, 3], '전설': [0.10, 3],
};
/** 프로토타입 엔진의 프리셋 능력치 (34 6장 이전 장비 계산, 일치 테스트용) */
export function protoGearStats(id: GearId): GearStats {
  const { g, u } = GEARS[id];
  const [h, s] = PROTO_GRADE[g];
  const n = (6 * s) / 3;
  return { heal: g === '없음' ? 1 : 1 + 6 * (h + 0.005 * u), regen: 1 + 0.03 * n, haste: 0.02 * n, crit: 0.02 * n };
}

/** 프리셋 능력치: 6부위 모두 그 등급 · 강화의 기댓값 장비 (data/equipment presetStats). ilv = 아이템 레벨 (그 장소 적 레벨, % 옵션 배율) */
export function gearStats(id: GearId, ilv?: number): GearStats {
  const { g, u } = GEARS[id];
  if (g === '없음') return { heal: 1, regen: 1, haste: 0, crit: 0, hp: 0, endure: 0 };
  return statsToGear(presetStats(g, u, ilv));
}
