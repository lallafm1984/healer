/**
 * 어픽스 (07 3장 레벨 단계 어픽스, 13 3-3 주간 도전 어픽스). 수치는 초안.
 * 레벨 단계 (07 3장): 같은 던전을 Lv 10 / 30 / 50 / 70 / 90 단계로 다시 연다. 30+ 격노, 50+ 역병, 70+ 불안정.
 * (단계마다 보스 패턴 1개 추가는 보스 기획 뒤로 미룸)
 */
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

/** 레벨 단계 (07 3장) */
export const LEVEL_TIERS = [10, 30, 50, 70, 90];
export function tierAffixes(tier: number): AffixKey[] {
  return tier >= 70 ? ['rage', 'plague', 'unstable'] : tier >= 50 ? ['rage', 'plague'] : tier >= 30 ? ['rage'] : [];
}

/** 주간 도전에만 붙는 순환 어픽스 8종 (13 3-3) */
export const WEEKLY_AFFIXES: AffixKey[] = ['dry', 'contagion', 'haste', 'chaos', 'frenzy', 'echo', 'panic'];
