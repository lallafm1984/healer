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
