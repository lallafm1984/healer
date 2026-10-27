/**
 * 어픽스 (32 2장 난이도 어픽스, 13 3-3 주간 도전 어픽스). 수치는 초안.
 * 2026-10-08 레벨 단계를 없애고 적 레벨을 내 레벨에 맞춤 (32): 단계가 주던 어픽스는 던전 난이도로 (지금과 같은 Lv 30·50부터). 불안정은 주간 도전 순환으로.
 */
import type { DiffName } from './difficulty';

export type AffixKey = 'rage' | 'plague' | 'unstable' | 'dry' | 'contagion' | 'haste' | 'chaos' | 'frenzy' | 'echo' | 'panic'
  // 110 (2026-10-22 Lim 「다양한 어픽스를 추가」): 힐러가 바꿔야 할 것이 저마다 다른 8개
  | 'grievous' | 'pulse' | 'necrotic' | 'drain' | 'chill' | 'tyrant' | 'quake' | 'spite'
  // 115 (2026-10-27 Lim 「더 늘릴만한 요소가 있는지 찾아보자」 → 추천 첫 묶음 8개): 비어 있던 손 (넘친 치유 · 시전 · 어그로 · 체력 선 · 쫄 · 해제 · 재사용 대기 · 제한시간)
  | 'overflow' | 'tremor' | 'skittish' | 'doom' | 'bolster' | 'blight' | 'chains' | 'peril';

export interface AffixDef { name: string; desc: string; tip: string }

export const AFFIXES: Record<AffixKey, AffixDef> = {
  rage: { name: '격노', desc: '보스 체력 30% 아래부터 보스 피해 +30%', tip: '막판 대비 공대 쿨기를 남겨 둠' },
  plague: { name: '역병', desc: '25초마다 2명에게 역병 독 (10초 지속 피해)', tip: '독을 못 지우는 직업은 지속 힐로 버티기' },
  unstable: { name: '불안정', desc: '30초마다 1명에게 함정 ⚠ (지우면 주변 폭발, 두면 그 사람만 피해)', tip: '지우지 말고 체력으로 버팀' },
  dry: { name: '메마름', desc: '받는 치유 -20%', tip: '효율 힐 위주, 마나 관리' },
  contagion: { name: '전염병', desc: '30초마다 무작위 2명에게 질병', tip: '해제 재사용 대기 배분' },
  haste: { name: '서두름', desc: '보스 기술 주기 -15%', tip: '미리 지속 힐 깔기' },
  chaos: { name: '혼돈의 바닥', desc: '장판 패턴마다 장판 +1곳', tip: '성격마다 피하는 차이가 크게 드러남' },
  frenzy: { name: '폭주하는 쫄', desc: '보스가 아닌 적 체력·피해 +30%', tip: '쫄에게 맞는 줄에 범위 힐' },
  echo: { name: '메아리', desc: '지운 디버프가 10% 확률로 옆 칸에 옮겨감', tip: '해제 타이밍' },
  panic: { name: '동요', desc: '파티원 체력 30% 아래가 되면 3초 패닉 (공격 안 함)', tip: '체력 30% 위로 유지' },
  grievous: { name: '깊은 상처', desc: '체력 90% 아래인 동안 2초마다 상처 1중첩 (최대 3, 지속 피해), 90%를 넘으면 사라짐', tip: '다친 사람을 끝까지 채움' },
  pulse: { name: '파동', desc: '25초마다 파티 전체 피해 (마법)', tip: '파동 전에 체력을 올려 둠 · 광역 힐' },
  necrotic: { name: '괴저', desc: '보스 평타를 맞은 탱커에게 괴저 1중첩 (받는 치유 −4%, 최대 5), 5초 안 맞으면 사라짐', tip: '탱커 치유가 줄어듦 · 보호막 · 생존기' },
  drain: { name: '고갈', desc: '내 마나 회복 −50%', tip: '싼 힐 위주 · 넘치는 치유 줄이기' },
  chill: { name: '한기', desc: '내 시전 시간 +15%', tip: '미리 시전 · 즉시 시전 기술' },
  tyrant: { name: '폭군', desc: '보스 체력 +15% · 보스 구간 피해 +10%', tip: '제한시간 · 공대 쿨기를 보스에' },
  quake: { name: '지진', desc: '20초마다 2명에게 지진 표시, 3초 뒤 그 사람과 옆 칸에 피해', tip: '표시가 뜬 사람과 옆 칸을 미리 채움' },
  spite: { name: '복수심', desc: '보스가 아닌 적이 쓰러질 때마다 파티 전체 4초 지속 피해 (겹치면 중첩)', tip: '졸개가 한꺼번에 쓰러질 때 광역 힐 준비' },
  overflow: { name: '넘침', desc: '넘친 치유의 절반이 그 사람에게 치유 흡수 막으로 남음 (최대 체력 20%까지, 해제 안 됨)', tip: '다 찬 사람에게 큰 힐 · 광역을 아낌' },
  tremor: { name: '진동', desc: '20초마다 진동 예고, 울리면 내가 시전 중인 힐이 끊기고 그 스킬이 3초 잠김 · 파티 전체 작은 피해', tip: '울리기 직전엔 시전을 시작하지 않음 · 즉시 · 지속 힐' },
  skittish: { name: '산만함', desc: '탱커 위협 −40%: 보스가 딜러를 자주 노림', tip: '어그로를 뺏긴 딜러를 채움' },
  doom: { name: '완치 선고', desc: '30초마다 탱커 아닌 1명이 피해와 함께 8초 표식, 체력을 가득 채우면 사라지고 못 채우면 큰 피해', tip: '표식이 뜬 사람을 끝까지 채움' },
  bolster: { name: '결속', desc: '보스가 아닌 적이 쓰러질 때마다 남은 적 체력 · 피해 +15% (겹침)', tip: '무리 끝으로 갈수록 탱커 힐을 늘림' },
  blight: { name: '옮겨붙는 역병', desc: '25초마다 1명에게 역병 (질병), 지우면 옆 칸 1명에게 더 세게 옮겨붙고 옆이 비면 사라짐, 그냥 두면 끝날 때 적 피해 +5%', tip: '옆에 아무도 없을 때 지움' },
  chains: { name: '시간의 족쇄', desc: '내 재사용 대기 +25% (해제 · 생존기 · 공대 쿨기 · 특성 버튼)', tip: '쿨기를 아끼고 위기 순서를 짬' },
  peril: { name: '도전자의 위기', desc: '파티원이 쓰러질 때마다 제한시간 −15초', tip: '살리는 것이 곧 시간' },
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

/**
 * 주간 도전에 붙는 순환 어픽스 (13 3-3 → 110 → 115). 불안정은 레벨 단계에서 옮겨 옴 (32).
 * 좋은 주 (축제 경험치 +20% · 풍요 골드 +30%)는 2026-10-27 Lim 「좋은 어픽스는 제거」로 없앰. 다시 넣지 않는다
 */
export const WEEKLY_AFFIXES: AffixKey[] = ['dry', 'contagion', 'haste', 'chaos', 'frenzy', 'echo', 'panic', 'unstable', 'grievous', 'pulse', 'necrotic', 'drain', 'chill', 'tyrant', 'quake', 'spite',
  'overflow', 'tremor', 'skittish', 'doom', 'bolster', 'blight', 'chains', 'peril'];
