/** 파티원·길드원 카드 조각 (편성 S05, 길드 S12~S14): 직업 · 능력(직업 스킬, 등급 색 + ★) · 능력치 (97, 인연 안개) · 인연 하트 · 성격 (17 11장) */
import { ABILITIES, AB_GRADE, AB_KIND } from '../data/abilities';
import { CLASSES, type ClassKey } from '../data/classes';
import { bondName } from '../data/guild';
import { CATS, PERS, type PersName } from '../data/personalities';
import { abilityStars, ROLE_CORE, seedOf, STAT_GROUPS, STAT_NAMES, starText, type Stats } from '../data/fm';
import { classGlyphSvg } from './class-icons';
import { esc, ROLE } from './kit';

/** 능력 한 줄: 종류 아이콘 + 이름 + ★ + 등급 + 효과 (+ 쓰는 때) */
export function abHtml(key: string | undefined, star = 0, when = true): string {
  const a = key ? ABILITIES[key] : null;
  if (!a) return '';
  const g = AB_GRADE[a.grade];
  return `<p class="pab" style="--gc:${g.color}"><b>${AB_KIND[a.kind].icon} ${esc(a.name)}${star ? ` <span class="star">${'★'.repeat(star)}</span>` : ''}</b><i>${g.name}</i> ${esc(a.desc)}${when ? ` <small>· ${esc(a.when)}</small>` : ''}</p>`;
}

/**
 * 능력치 세 묶음 × 네 줄 (97 「숫자와 보이는 법」): 1~5 회색 · 6~10 흰색 · 11~15 초록 · 16~20 금빛, 역할 핵심 넷은 굵게.
 * 인연 안개 (FM 스카우트): exact = 길드원 숫자 · range = 친구 「11~14」 (참 값이 들어 있는 너비 4, 사람 · 칸마다 고정)
 */
export function statsHtml(nick: string, stats: Stats, role: 'tank' | 'melee' | 'ranged', fog: 'exact' | 'range'): string {
  const band = (v: number) => (v >= 16 ? 'b4' : v >= 11 ? 'b3' : v >= 6 ? 'b2' : 'b1');
  const cell = (k: keyof Stats) => {
    const v = stats[k], core = ROLE_CORE[role].includes(k);
    let txt = String(v), lab = `${STAT_NAMES[k]} ${v}`, shown = v;
    if (fog === 'range') { const lo = Math.max(1, Math.min(17, v - (seedOf(`fog:${nick}:${k}`) % 4))); txt = `${lo}~${lo + 3}`; lab = `${STAT_NAMES[k]} ${lo}에서 ${lo + 3}`; shown = lo + 2; } // 색도 범위 가운데로 (참 값이 새지 않게)
    return `<li class="${core ? 'core ' : ''}${band(shown)}" aria-label="${lab}${core ? ', 역할 핵심' : ''}"><span>${STAT_NAMES[k]}</span><b>${txt}</b></li>`;
  };
  return `<div class="fm-grid${fog === 'range' ? ' fog' : ''}">${STAT_GROUPS.map(g => `<section><h5>${g.name}</h5><ul>${g.keys.map(cell).join('')}</ul></section>`).join('')}</div>`;
}

/** 인연 하트 (93 3-3): 아는 사이 = 빈 하트 · 친구 · 길드원 = 하트 (+ 인연 Lv) · 단짝 = 금빛 하트. 그림 (icon-bond-*)은 6번 PR */
export function bondHtml(lv: number, member = false): string {
  if (lv <= 0) return '';
  const cls = lv >= 12 ? 'gold' : lv >= 2 ? 'red' : 'line';
  const name = lv >= 12 || member ? bondName(lv) : lv >= 2 ? '친구' : '아는 사이'; // 길드 밖 사람은 인연 Lv가 높아도 「친구」
  return `<span class="bond ${cls}" role="img" aria-label="인연 ${name}${lv >= 3 ? ` Lv ${lv}` : ''}">${lv >= 2 ? '♥' : '♡'}${lv >= 3 ? `<small>${lv}</small>` : ''}</span>`;
}

export interface CardData {
  nick: string;
  cls: ClassKey;
  pers: PersName;
  lv?: number;
  ab?: string;
  star?: number;
  /** 능력치 (97 FM). 있으면 능력 ★ */
  fm?: { stats: Stats };
  /** 인연 Lv (93 3-3). 있으면 하트 · 안개 (0~1 = 능력 ★만 · 2 이상 친구 = 범위 · 길드원 = 숫자) */
  bond?: number;
  /** 내 길드원 (능력치 숫자) */
  member?: boolean;
}

/** 능력 ★ 글 (97 FM): 역할 핵심에 무게를 둔 능력치 합. 능력치가 없는 사람 (길드원 · 옛 파티)은 빈 글 */
const fmStars = (m: CardData): string => (m.fm ? starText(abilityStars(m.fm.stats, CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged')) : '');

/** 역할 아이콘 (27 시안 Party27): 탱커 방패 · 근접 칼 · 원거리 화살 */
const roleSvg = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ROLE_ICON: Record<string, string> = {
  tank: roleSvg('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>'),
  melee: roleSvg('<path d="M5 19L19 5M15 5h4v4M8 16l-3 3"/>'),
  ranged: roleSvg('<path d="M4 12h16M14 6l6 6-6 6"/>'),
};

/**
 * 파티원 직업 아이콘 (편성 칸·줄): 전투 칸과 같은 한 벌 (class-icons.ts, 크림색 몸 + 검은 테).
 * 2026-10-12 Lim 「직업 아이콘이 이상하다」로 8직업 같은 모양 → 2026-10-13 Lim 「인게임에서도 동일하게, 인게임 디자인 모양으로」 다시 그림.
 */
export function classIcon(cls: ClassKey): string {
  return `<span class="f-class-icon" data-class-icon="${cls}" role="img" aria-label="${CLASSES[cls].name}">${classGlyphSvg(cls)}</span>`;
}

/**
 * 파티원 줄 (27 3-3 편성, 2026-10-08 줄임): 역할 칸 · 닉네임 · 직업 · Lv · 성격 칩 / 직업 스킬 「이름」 · 오른쪽 끝 능력 ★ (97, 공개모집). 설명은 누르면 시트 (memDetailHtml).
 * 성격은 분류색 바탕에 전체 이름만 표시한다. 다루기 ★ 개수는 상세 시트에 둔다.
 */
export function memRowHtml(m: CardData, o: { attrs?: string; cls?: string; extra?: string; note?: string; tag?: string; on?: boolean } = {}): string {
  const c = CLASSES[m.cls], p = PERS[m.pers], a = m.ab ? ABILITIES[m.ab] : null;
  const ab = a
    ? `「<b style="color:${AB_GRADE[a.grade].color}">${esc(a.name)}</b>」${m.star ? `<span class="f-star"> ${'★'.repeat(m.star)}</span>` : ''}`
    : '';
  const hard = p.star >= 3;
  return `<li class="pcard f-mem${o.cls ? ` ${o.cls}` : ''}${o.on ? ' on' : ''}" ${o.attrs || ''}><span class="f-ri" style="background:${ROLE[c.role].color}">${classIcon(m.cls)}</span>
    <div class="f-mt"><span class="f-l1"><b class="pnick">${esc(m.nick)}</b>${m.bond ? bondHtml(m.bond, m.member) : ''}<span class="cap">${c.name}${m.lv ? ` · Lv ${m.lv}` : ''}${o.note ? ` · ${o.note}` : ''}</span><span class="f-sp"></span><span class="f-ps${hard ? ' hard' : ''}" style="--pers-color:${CATS[p.cat]}">${hard ? '<span class="sr">다루기 어려움 </span>' : ''}${esc(m.pers)}</span></span>
    <span class="f-l2"><span class="f-ab">${ab}</span>${o.tag ? `<small class="f-tag">${o.tag}</small>` : ''}${m.fm ? `<span class="f-fm">능력 <b>${fmStars(m)}</b></span>` : ''}</span></div>${o.extra || ''}</li>`;
}

/** 파티원 상세 (편성 · 길드 줄을 누르면 시트): 능력 ★ · (인연에 따라) 능력치 · 직업 스킬 · 성격 (다루기 ★) */
export function memDetailHtml(m: CardData): string {
  const p = PERS[m.pers], b = m.bond ?? 0, role = CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged';
  const fog = m.member ? 'exact' : b >= 2 ? 'range' : null;
  const how = m.member ? '' : b >= 2 ? '<small>친구: 범위만 · 길드에 들어오면 숫자</small>' : '<small>친구가 되면 능력치가 보임</small>';
  return `<div class="f-det">${m.fm ? `<p class="pfm">능력 <b>${fmStars(m)}</b>${m.bond != null ? how : ''}</p>${fog ? statsHtml(m.nick, m.fm.stats, role, fog) : ''}` : ''}${abHtml(m.ab, m.star || 0)}
    <p><b class="f-ps" style="--pers-color:${CATS[p.cat]}">${esc(m.pers)}</b> <span class="f-star"><span class="sr">다루기 난이도 </span>${'★'.repeat(p.star)}</span> · ${esc(p.desc)}</p></div>`;
}

/** 카드 본문 (역할 원 + 글). extra = 오른쪽 끝 버튼 등 */
export function cardHtml(m: CardData, o: { attrs?: string; extra?: string; cls?: string; desc?: boolean } = {}): string {
  const c = CLASSES[m.cls], p = PERS[m.pers];
  return `<li class="pcard${o.cls ? ` ${o.cls}` : ''}" ${o.attrs || ''}><span class="prole two" style="background:${ROLE[c.role].color}">${c.short}</span>
    <div><b class="pnick">${esc(m.nick)}</b><small>${c.name} · ${ROLE[c.role].name}${m.lv ? ` · Lv ${m.lv}` : ''}</small>
    ${abHtml(m.ab, m.star || 0, o.desc !== false)}
    <p><span class="f-ps" style="--pers-color:${CATS[p.cat]}">${esc(m.pers)}</span> <span class="star">${'★'.repeat(p.star)}</span>${o.desc !== false ? ` · ${esc(p.desc)}` : ''}</p></div>${o.extra || ''}</li>`;
}
