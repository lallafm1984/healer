/**
 * 어픽스 (32 2장 난이도 어픽스, 13 3-3 주간 도전 어픽스). 수치는 초안.
 * 2026-10-08 레벨 단계를 없애고 적 레벨을 내 레벨에 맞춤 (32): 단계가 주던 어픽스는 던전 난이도로 (지금과 같은 Lv 30·50부터). 불안정은 주간 도전 순환으로.
 */
import type { DiffName } from './difficulty';

export type AffixKey = 'rage' | 'plague' | 'unstable' | 'dry' | 'contagion' | 'haste' | 'chaos' | 'frenzy' | 'echo' | 'panic' | 'festival';

export interface AffixDef { name: string; desc: string; tip: string; good?: boolean }

export const AFFIXES: Record<AffixKey, AffixDef> = {
  rage: { name: '격노', desc: '보스 체력 30% 아래부터 보스 피해 +30%', tip: '막판 대비 공대 쿨기를 남겨 둠' },
  plague: { name: '역병', desc: '25초마다 2명에게 역병 독 (10초 지속 피해)', tip: '독을 못 지우는 직업은 해제 두루마리·지속 힐' },
  unstable: { name: '불안정', desc: '30초마다 1명에게 함정 ⚠ (지우면 주변 폭발, 두면 그 사람만 피해)', tip: '지우지 말고 체력으로 버팀' },
  dry: { name: '메마름', desc: '받는 치유 -20%', tip: '효율 힐 위주, 마나 관리' },
  contagion: { name: '전염병', desc: '30초마다 무작위 2명에게 질병', tip: '해제 재사용 대기 배분' },
  haste: { name: '서두름', desc: '보스 기술 주기 -15%', tip: '미리 지속 힐 깔기' },
  chaos: { name: '혼돈의 바닥', desc: '장판 패턴마다 장판 +1곳', tip: '성격마다 피하는 차이가 크게 드러남' },
  frenzy: { name: '폭주하는 쫄', desc: '보스가 아닌 적 체력·피해 +30%', tip: '쫄에게 맞는 줄에 범위 힐' },
  echo: { name: '메아리', desc: '지운 디버프가 10% 확률로 옆 칸에 옮겨감', tip: '해제 타이밍' },
  panic: { name: '동요', desc: '파티원 체력 30% 아래가 되면 3초 패닉 (공격 안 함)', tip: '체력 30% 위로 유지' },
  festival: { name: '축제 주간', desc: '골드 +20%', tip: '가볍게 즐기는 주', good: true },
};

/** 던전 난이도 어픽스 (32 2장): 쉬움·보통 없음. Lv 30부터 어려움·악몽 격노, Lv 50부터 악몽 역병 추가 (lv = 내 레벨) */
export const AFFIX_LV = { rage: 30, plague: 50 } as const;
export function diffAffixes(d: DiffName, lv: number): AffixKey[] {
  if (d !== '어려움' && d !== '악몽') return [];
  const out: AffixKey[] = [];
  if (lv >= AFFIX_LV.rage) out.push('rage');
  if (d === '악몽' && lv >= AFFIX_LV.plague) out.push('plague');
  return out;
}

/** 주간 도전에 붙는 순환 어픽스 (13 3-3) + 축제. 불안정은 레벨 단계에서 옮겨 옴 (32) */
export const WEEKLY_AFFIXES: AffixKey[] = ['dry', 'contagion', 'haste', 'chaos', 'frenzy', 'echo', 'panic', 'unstable'];
