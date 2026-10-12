/** 파티원·길드원 카드 조각 (편성 S05, 길드 S12~S14): 직업 · 능력(직업 스킬, 등급 색 + ★) · 자질 · 성격 (17 11장). 직업 패시브 · 특성은 2026-10-12에 뺌 */
import { ABILITIES, AB_GRADE, AB_KIND } from '../data/abilities';
import { CLASSES, type ClassKey } from '../data/classes';
import { APT_NAMES } from '../data/guild';
import { CATS, PERS, type PersName } from '../data/personalities';
import { art } from '../art';
import { esc, ROLE } from './kit';

/** 능력 한 줄: 종류 아이콘 + 이름 + ★ + 등급 + 효과 (+ 쓰는 때) */
export function abHtml(key: string | undefined, star = 0, when = true): string {
  const a = key ? ABILITIES[key] : null;
  if (!a) return '';
  const g = AB_GRADE[a.grade];
  return `<p class="pab" style="--gc:${g.color}"><b>${AB_KIND[a.kind].icon} ${esc(a.name)}${star ? ` <span class="star">${'★'.repeat(star)}</span>` : ''}</b><i>${g.name}</i> ${esc(a.desc)}${when ? ` <small>· ${esc(a.when)}</small>` : ''}</p>`;
}

/** 자질 ●●●○○ 세 줄을 한 줄로 */
export function aptHtml(apt: [number, number, number]): string {
  return `<p class="papt">${apt.map((n, i) => `${APT_NAMES[i]} <span>${'●'.repeat(n)}${'○'.repeat(5 - n)}</span>`).join(' · ')}</p>`;
}

export interface CardData {
  nick: string;
  cls: ClassKey;
  pers: PersName;
  lv?: number;
  ab?: string;
  star?: number;
  apt?: [number, number, number];
  power?: number;
}

/** 역할 아이콘 (27 시안 Party27): 탱커 방패 · 근접 칼 · 원거리 화살 */
const roleSvg = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ROLE_ICON: Record<string, string> = {
  tank: roleSvg('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>'),
  melee: roleSvg('<path d="M5 19L19 5M15 5h4v4M8 16l-3 3"/>'),
  ranged: roleSvg('<path d="M4 12h16M14 6l6 6-6 6"/>'),
};

/** 직업별 기존 그림을 우선 쓰고, 그림이 없는 직업은 서로 다른 무기 문장으로 구분한다. */
const CLASS_PATH: Record<ClassKey, string> = {
  warrior: '<path d="M3 5l5-2 5 2v5c0 4-5 7-5 7s-5-3-5-7zM15 16l6-12v8l-4 5M13 15l6 3M15 17l-2 4"/>',
  paladin: '<path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM12 7v10M8 11h8"/>',
  rogue: '<path d="M4 3l7 8-3 3-4-6zM20 3l-7 8 3 3 4-6zM5 12l6 5M19 12l-6 5M8 15l-4 6M16 15l4 6"/>',
  berserker: '<path d="M12 3v19M11 5C8 2 4 4 3 8c3-1 5 1 8 1M13 5c3-3 7-1 8 3-3-1-5 1-8 1M9 20h6"/>',
  swordsman: '<path d="M12 2l3 5-1 9h-4L9 7zM6 16h12M12 16v6M9 22h6M12 6v7"/>',
  mage: '<path d="M7 22l8-15M12 3l5-1 4 4-5 4-4-3zM3 5h4M5 3v4M18 14h4M20 12v4"/>',
  archer: '<path d="M6 3c14 4 14 14 0 18l5-9zM3 12h18M18 9l3 3-3 3"/>',
  hunter: '<path d="M4 6c2 9 14 9 16 0M4 6l8 12 8-12M12 3v19M9 6l3-3 3 3M8 18h8"/>',
};
export function classIcon(cls: ClassKey): string {
  const img = art(`class-${cls}`) || art(`emblem-${cls}`);
  const inner = img ? `<img src="${img}" alt="" decoding="async" draggable="false">` : roleSvg(CLASS_PATH[cls]);
  return `<span class="f-class-icon" data-class-icon="${cls}" role="img" aria-label="${CLASSES[cls].name}">${inner}</span>`;
}

/**
 * 파티원 줄 (27 3-3 편성, 2026-10-08 줄임): 역할 칸 · 닉네임 · 직업 · Lv · 성격 칩 / 능력 「이름」. 설명은 누르면 시트 (memDetailHtml).
 * 성격은 분류색 바탕에 전체 이름만 표시한다. 다루기 ★ 개수는 상세 시트에 둔다.
 */
export function memRowHtml(m: CardData, o: { attrs?: string; cls?: string; extra?: string; note?: string; on?: boolean } = {}): string {
  const c = CLASSES[m.cls], p = PERS[m.pers], a = m.ab ? ABILITIES[m.ab] : null;
  const ab = a
    ? `「<b style="color:${AB_GRADE[a.grade].color}">${esc(a.name)}</b>」${m.star ? `<span class="f-star"> ${'★'.repeat(m.star)}</span>` : ''}`
    : '';
  const hard = p.star >= 3;
  return `<li class="pcard f-mem${o.cls ? ` ${o.cls}` : ''}${o.on ? ' on' : ''}" ${o.attrs || ''}><span class="f-ri" style="background:${ROLE[c.role].color}">${classIcon(m.cls)}</span>
    <div class="f-mt"><span class="f-l1"><b class="pnick">${esc(m.nick)}</b><span class="cap">${c.name}${m.lv ? ` · Lv ${m.lv}` : ''}${o.note ? ` · ${o.note}` : ''}</span><span class="f-sp"></span><span class="f-ps${hard ? ' hard' : ''}" style="--pers-color:${CATS[p.cat]}">${hard ? '<span class="sr">다루기 어려움 </span>' : ''}${esc(m.pers)}</span></span>
    <span class="f-l2"><span class="f-ab">${ab}</span></span></div>${o.extra || ''}</li>`;
}

/** 파티원 상세 (편성의 줄을 누르면 시트): 능력 · 자질 · 성격 (다루기 ★) */
export function memDetailHtml(m: CardData): string {
  const p = PERS[m.pers];
  return `<div class="f-det">${abHtml(m.ab, m.star || 0)}${m.apt ? aptHtml(m.apt) : ''}
    <p><b class="f-ps" style="--pers-color:${CATS[p.cat]}">${esc(m.pers)}</b> <span class="f-star"><span class="sr">다루기 난이도 </span>${'★'.repeat(p.star)}</span> · ${esc(p.desc)}</p></div>`;
}

/** 카드 본문 (역할 원 + 글). extra = 오른쪽 끝 버튼 등 */
export function cardHtml(m: CardData, o: { attrs?: string; extra?: string; cls?: string; desc?: boolean } = {}): string {
  const c = CLASSES[m.cls], p = PERS[m.pers];
  return `<li class="pcard${o.cls ? ` ${o.cls}` : ''}" ${o.attrs || ''}><span class="prole two" style="background:${ROLE[c.role].color}">${c.short}</span>
    <div><b class="pnick">${esc(m.nick)}</b><small>${c.name} · ${ROLE[c.role].name}${m.lv ? ` · Lv ${m.lv}` : ''}${m.power ? ` · 전투력 ${m.power.toLocaleString('ko-KR')}` : ''}</small>
    ${abHtml(m.ab, m.star || 0, o.desc !== false)}${m.apt ? aptHtml(m.apt) : ''}
    <p><span class="f-ps" style="--pers-color:${CATS[p.cat]}">${esc(m.pers)}</span> <span class="star">${'★'.repeat(p.star)}</span>${o.desc !== false ? ` · ${esc(p.desc)}` : ''}</p></div>${o.extra || ''}</li>`;
}
