/** 파티원·길드원 카드 조각 (편성 S05, 길드 S12~S14): 직업 · 능력(등급 색 + ★) · 자질 · 성격 · 특성 (17 11장) */
import { ABILITIES, AB_GRADE, AB_KIND } from '../data/abilities';
import { CLASSES, type ClassKey } from '../data/classes';
import { APT_NAMES } from '../data/guild';
import { CATS, PERS, type PersName } from '../data/personalities';
import { TRAITS, type TraitKey } from '../data/traits';
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
  traits?: TraitKey[];
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

/**
 * 파티원 줄 (27 3-3 편성): 역할 칸 · 닉네임 · 직업 · Lv · 성격(색 글자 칸 + 이름) · ★ / 능력 「이름」 · 효과 + 특성 칩.
 * open = 아래에 상세 (능력·직업 패시브·특성·성격 설명). 닫혀 있어도 글은 줄 안에 있음 (읽기 프로그램·검색용)
 */
export function memRowHtml(m: CardData, o: { attrs?: string; cls?: string; extra?: string; open?: boolean; note?: string } = {}): string {
  const c = CLASSES[m.cls], p = PERS[m.pers], a = m.ab ? ABILITIES[m.ab] : null;
  const ab = a
    ? `능력 「<b style="color:${AB_GRADE[a.grade].color}">${esc(a.name)}</b>」${m.star ? `<span class="f-star"> ${'★'.repeat(m.star)}</span>` : ''} · ${esc(a.desc)}`
    : `직업 「${esc(c.passive)}」 · ${esc(c.passiveDesc)}`;
  const tr = (m.traits || []).map(k => `<span class="f-tr">${TRAITS[k].name}</span>`).join('');
  const det = `${abHtml(m.ab, m.star || 0)}${m.apt ? aptHtml(m.apt) : ''}<p class="ppas"><b>${c.passive}</b> ${esc(c.passiveDesc)}</p>
    ${(m.traits || []).map(k => `<p class="ppas ptrait"><b>특성 ${TRAITS[k].name}</b> ${esc(TRAITS[k].desc)}</p>`).join('')}
    <p><i class="pcat" style="background:${CATS[p.cat]}">${p.ch}</i>${esc(m.pers)} · ${esc(p.desc)}</p>`;
  return `<li class="pcard f-mem${o.cls ? ` ${o.cls}` : ''}" ${o.attrs || ''}><span class="f-ri" style="background:${ROLE[c.role].color}">${ROLE_ICON[c.role] || ''}</span>
    <div class="f-mt"><span class="f-l1"><b class="pnick">${esc(m.nick)}</b><span class="cap">${c.name}${m.lv ? ` · Lv ${m.lv}` : ''}${o.note ? ` · ${o.note}` : ''}</span><span class="f-sp"></span><span class="f-ps"><i style="background:${CATS[p.cat]}">${p.ch}</i>${esc(m.pers)}</span><span class="f-star">${'★'.repeat(p.star)}</span></span>
    <span class="f-l2"><span class="f-ab">${ab}</span>${tr}</span>
    <div class="f-det"${o.open ? '' : ' hidden'}>${det}</div></div>${o.extra || ''}</li>`;
}

/** 카드 본문 (역할 원 + 글). extra = 오른쪽 끝 버튼 등 */
export function cardHtml(m: CardData, o: { attrs?: string; extra?: string; cls?: string; desc?: boolean } = {}): string {
  const c = CLASSES[m.cls], p = PERS[m.pers];
  return `<li class="pcard${o.cls ? ` ${o.cls}` : ''}" ${o.attrs || ''}><span class="prole two" style="background:${ROLE[c.role].color}">${c.short}</span>
    <div><b class="pnick">${esc(m.nick)}</b><small>${c.name} · ${ROLE[c.role].name}${m.lv ? ` · Lv ${m.lv}` : ''}${m.power ? ` · 전투력 ${m.power.toLocaleString('ko-KR')}` : ''}</small>
    ${abHtml(m.ab, m.star || 0, o.desc !== false)}${m.apt ? aptHtml(m.apt) : ''}
    ${o.desc !== false ? `<p class="ppas"><b>${c.passive}</b> ${esc(c.passiveDesc)}</p>` : ''}
    ${(m.traits || []).map(k => `<p class="ppas ptrait"><b>특성 ${TRAITS[k].name}</b> ${o.desc !== false ? esc(TRAITS[k].desc) : ''}</p>`).join('')}
    <p><i class="pcat" style="background:${CATS[p.cat]}">${p.ch}</i>${esc(m.pers)} <span class="star">${'★'.repeat(p.star)}</span>${o.desc !== false ? ` · ${esc(p.desc)}` : ''}</p></div>${o.extra || ''}</li>`;
}
