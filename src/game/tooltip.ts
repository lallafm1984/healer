/**
 * 설명 팝업 모양 (2026-10-07 Lim: 첨부 이미지 형식).
 * 이름 → 정보 줄 (왼쪽·오른쪽) → 필요 조건 (빨강) → 설명 (금색, ~니다 문장) → 덧붙임 (흐림).
 * 정보 줄은 지금처럼 짧은 명사형, 설명만 문장. 전투 팝업(#tip)과 캐릭터 탭이 같이 씀
 */
import { ITEMS, POTION_CD, type ItemKey } from '../data/items';
import { SKILL_INFO, SKILLS, type SkillKey } from '../data/skills';

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
  return sk.channel ? `${sk.channel}초 정신 집중` : sk.cast ? `${sk.cast}초 시전` : '즉시';
}
export const cdText = (k: SkillKey) => (SKILLS[k].cd ? `${SKILLS[k].cd}초 재사용 대기시간` : '');
export const costText = (k: SkillKey) => (SKILLS[k].cost ? `마나 ${SKILLS[k].cost}%` : '마나 없음');

/** 스킬: lockLv = 아직 못 배웠으면 배우는 레벨 */
export function skillTip(k: SkillKey, lockLv = 0): TipSpec {
  const info = SKILL_INFO[k];
  return { name: SKILLS[k].name, kind: info?.kind, rows: [[costText(k)], [castText(k), cdText(k)]], req: lockLv ? `레벨 ${lockLv} 필요` : '', desc: info?.desc };
}

/** 소비 아이템: left = 이번 전투에 남은 횟수 (전투 밖이면 없음) */
export function itemTip(k: ItemKey, icon = '', left?: number): TipSpec {
  const it = ITEMS[k], potion = it.kind === 'potion';
  return {
    icon, name: it.name, kind: potion ? '물약' : '두루마리',
    rows: [['즉시', potion ? `${POTION_CD}초 재사용 대기시간` : ''], [`전투당 ${it.uses}회 사용 가능`, left != null ? `남은 ${left}회` : '']],
    desc: it.desc, note: potion ? `${it.tip} 물약끼리 재사용 대기시간을 같이 씁니다.` : it.tip,
  };
}
