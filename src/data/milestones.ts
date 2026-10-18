import { CONTENT, contentOf } from './content';
import { REROLL_LEVEL, REROLL_PICK_LEVEL } from './equipment';
import { FEATURES } from './features';
import { HEROES, type HeroKey } from './heroes';
import { MAX_LEVEL } from './progression';
import { SKILLS } from './skills';

/**
 * 레벨업 팝업에 보여 줄 "새로 열림" (18 2-2). live = 이 빌드에서 실제로 바뀌는 것.
 * 아직 안 만든 것은 live: false로 두고 레벨업 팝업에서 제외한다.
 */
export interface Milestone { text: string; live: boolean; hero?: HeroKey }
const BASE: Record<number, Milestone[]> = {
  5: [{ text: '특성 1단', live: true }],
  10: [{ text: '특성 2단', live: true }, { text: '주간 임무', live: true }, { text: '공개모집 직업 +6종', live: false }],
  15: [{ text: '특성 3단', live: true }, ...(FEATURES.guild ? [{ text: '길드 (원정대 결성 · 영입)', live: true }] : [])],
  20: [{ text: '직업 전환 · 드루이드 해금', live: true, hero: 'druid' }, { text: '특성 4단', live: true }, { text: '주간 도전 「모래시계 시련」', live: true }],
  25: [{ text: '특성 5단', live: true }],
  30: [{ text: '직업 전환 · 성기사 해금', live: true, hero: 'paladin' }, { text: '특성 6단', live: true }, { text: '어려움·악몽 던전에 어픽스 「격노」', live: true }],
  35: [{ text: '특성 7단', live: true }],
  40: [{ text: '특성 8단', live: true }],
  45: [{ text: '특성 9단', live: true }],
  50: [{ text: '특성 10단 (완성)', live: true }, { text: '악몽 던전에 어픽스 「역병」', live: true }, { text: '직업 칭호', live: false }],
  51: [{ text: '정점 수련 (레벨마다 지능·체력 +0.3%)', live: true }],
  100: [{ text: '직업 색 힐 이펙트 · 칭호', live: false }],
};
/**
 * 탐험 · 던전 열림 (34 5-2 열림 레벨 표)은 CONTENT에서 만들어 맨 앞에. 아직 안 만든 곳은 「준비 중」.
 * 레이드는 첫 10인 · 첫 20인과 그 악몽만, 레벨도 CONTENT를 따라감 (69 지역 순서 레벨)
 */
export const MILESTONES: Record<number, Milestone[]> = { ...BASE };
const addFirst = (lv: number, m: Milestone) => { MILESTONES[lv] = [m, ...(MILESTONES[lv] ?? [])]; };
const addLast = (lv: number, m: Milestone) => { MILESTONES[lv] = [...(MILESTONES[lv] ?? []), m]; };
// 장비 재설정 (#192)은 equipment 레벨을 따라감 (2026-10-18 해금 레벨 검토: 예전엔 Lv 50에 떴음)
addLast(REROLL_LEVEL, { text: '장비 재설정 (옵션 · 특수능력 한 줄)', live: true });
addLast(REROLL_PICK_LEVEL, { text: '장비 재설정 후보 2개 중 고르기', live: true });
const raid10 = contentOf('abyss1'), raid20 = contentOf('cathedral1');
addFirst(raid20.diffUnlock!['악몽']!, { text: '20인 레이드 악몽', live: true });
// 88: 영웅은 10인 레이드가 열리는 Lv 45부터 드물게 (레벨이 오를수록 늘어남), 전설 (노란색)은 Lv 100부터 20인 레이드에서 (equipment HERO_FROM · LEGEND_LEVEL)
addFirst(MAX_LEVEL, { text: '전설 장비 (노란색, 20인 레이드 어려움 · 악몽)', live: true });
addFirst(raid10.unlockLv, { text: '영웅 장비 (드물게, 레벨이 오를수록 늘어남)', live: true });
addFirst(raid20.unlockLv, { text: `20인 레이드 「가라앉은 대성당」`, live: true });
addFirst(raid10.diffUnlock!['악몽']!, { text: '10인 레이드 악몽', live: true });
addFirst(raid10.unlockLv, { text: '10인 레이드 「심연의 탑」', live: true });
for (const c of CONTENT) {
  if (c.hidden || c.kind === 'raid' || c.unlockLv <= 1) continue;
  const text = c.key === 'rustfort' ? `첫 던전 「${c.name}」` : `${c.kind === 'explore' ? '탐험' : '던전'} 「${c.name}」`;
  addFirst(c.unlockLv, { text, live: c.ready });
}

/** 공통 콘텐츠와 현재 직업의 실제 스킬 · 패시브 · 고유 시스템만 안내한다. */
export function milestonesAt(level: number, hero: HeroKey): Milestone[] {
  const def = HEROES[hero];
  const skills = Object.values(def.slots).flatMap(key => key && SKILLS[key].lv === level
    ? [{ text: `스킬 「${SKILLS[key].name}」`, live: true }] : []);
  const passives = def.passives.filter(p => p.lv === level).map(p => ({ text: `패시브 「${p.name}」`, live: true }));
  const system = def.system.lv === level ? [{ text: def.system.name, live: true }] : [];
  return [...(MILESTONES[level] ?? []).filter(m => !m.hero || m.hero === hero), ...skills, ...passives, ...system];
}

/** 여러 레벨을 한 번에 올려도 해당 직업의 실제 해금만 표시한다. */
export function levelUpMilestones(levels: number[], hero: HeroKey): (Milestone & { lv: number })[] {
  return levels.flatMap(lv => milestonesAt(lv, hero).filter(m => m.live).map(m => ({ ...m, lv })));
}

/** 다음 목표 (로비 「다음 목표」 카드): 지금 직업에 해당하는 다음 마일스톤. */
export function nextMilestone(level: number, hero: HeroKey): { level: number; items: Milestone[] } | null {
  for (let lv = level + 1; lv <= MAX_LEVEL; lv++) {
    const items = milestonesAt(lv, hero);
    if (items.length) return { level: lv, items };
  }
  return null;
}
