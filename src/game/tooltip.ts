/**
 * 설명 팝업 모양 (2026-10-07 Lim: 첨부 이미지 형식).
 * 이름 → 정보 줄 (왼쪽·오른쪽) → 필요 조건 (빨강) → 설명 (금색, ~니다 문장) → 덧붙임 (흐림).
 * 정보 줄은 지금처럼 짧은 명사형, 설명만 문장. 전투 팝업(#tip)과 캐릭터 탭이 같이 씀
 */
import { healText, SKILL_INFO, SKILLS, type SkillKey } from '../data/skills';
import { t, tc } from '../i18n';

/** 스킬 · 특성 설명의 회복량 {n} → 「지능의 n% (지금 값)」을 지금 언어로 (data/skills healText는 번역을 모름, 121) */
export const healTextT = (desc: string, int?: number): string => healText(desc, int, p => t('지능의 {p}%', { p }));

export interface TipSpec {
  /** 이름 앞 아이콘 (HTML) */
  icon?: string;
  name: string;
  /** 이름 줄 오른쪽 (종류) */
  kind?: string;
  rows?: [string, string?][];
  req?: string;
  desc?: string;
  note?: string;
}

export function tipHtml(t: TipSpec): string {
  const rows = (t.rows || []).map(([l, r]) => `<div class="tt-row"><span>${l}</span>${r ? `<span>${r}</span>` : ''}</div>`).join('');
  return `<div class="tt"><div class="tt-name">${t.icon || ''}<b>${t.name}</b>${t.kind ? `<small>${t.kind}</small>` : ''}</div>${rows}`
    + `${t.req ? `<div class="tt-req">${t.req}</div>` : ''}${t.desc ? `<div class="tt-desc">${t.desc}</div>` : ''}${t.note ? `<div class="tt-note">${t.note}</div>` : ''}</div>`;
}

/** 시전 줄 왼쪽: 즉시 / N초 시전 / N초 정신 집중 */
export function castText(k: SkillKey): string {
  const sk = SKILLS[k];
  return sk.channel ? t('{n}초 정신 집중', { n: sk.channel }) : sk.cast ? t('{n}초 시전', { n: sk.cast }) : t('즉시');
}
export const cdText = (k: SkillKey) => (SKILLS[k].cd ? t('{n}초 재사용 대기시간', { n: SKILLS[k].cd }) : '');
export const costText = (k: SkillKey) => (SKILLS[k].cost ? t('마나 {n}%', { n: SKILLS[k].cost }) : t('마나 없음'));

/** 스킬: lockLv = 아직 못 배웠으면 배우는 레벨, int = 지금 지능 (설명에 지금 회복량, 34 1-2) */
export function skillTip(k: SkillKey, lockLv = 0, int?: number): TipSpec {
  const info = SKILL_INFO[k];
  return { name: t(SKILLS[k].name), kind: info && tc(info.kind, 'kind'), rows: [[costText(k)], [castText(k), cdText(k)]], req: lockLv ? t('레벨 {n} 필요', { n: lockLv }) : '', desc: info && healTextT(t(info.desc), int) };
}
