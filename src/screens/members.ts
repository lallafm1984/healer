/** 파티원·길드원 카드 조각 (편성 S05, 길드 S12~S14): 직업 · 능력(직업 스킬 + LV) · 능력치 · 성격 (17 11장) */
import { ABILITIES } from '../data/abilities';
import { CLASSES, type ClassKey } from '../data/classes';
import { CATS, PERS, type PersName } from '../data/personalities';
import { abilityStars, GROW_TYPES, growthOf, ROLE_CORE, STAT_GROUPS, STAT_NAMES, statsAt, type StatKey, type Stats } from '../data/fm';
import { classGlyphSvg } from './class-icons';
import { ratingStarsHtml } from './member-icons';
import { esc, ROLE } from './kit';

/**
 * 스킬 글자색 하나 (2026-10-22 Lim 「스킬도 일반, 고급 같은 등급 제거」): 예전 등급 색 (일반 회색 · 고급 초록 · 희귀 파랑)과 「일반 · 고급 · 희귀」 글은 없앰.
 * 뽑기 확률 (AB_GRADE · 공고 희귀 3%)은 안쪽 그대로
 */
const SKILL_COLOR = '#E6D3A3';
/** 스킬 정보: 이름 · LV, 효과, 발동 조건을 각각 읽는다. */
export function abHtml(key: string | undefined, star = 0, when = true): string {
  const a = key ? ABILITIES[key] : null;
  if (!a) return '';
  return `<section class="member-trait pab" style="--trait-color:${SKILL_COLOR}" aria-label="직업 스킬">
    <div class="trait-heading"><span class="trait-label">스킬</span><b class="trait-title">${esc(a.name)}</b>${star ? `<span class="skill-level">LV ${star}</span>` : ''}</div>
    <p class="trait-description">${esc(a.desc)}</p>${when ? `<p class="trait-condition"><span>발동</span><span>${esc(a.when)}</span></p>` : ''}</section>`;
}

/** 성격은 이름과 효과 설명만 표시한다. */
function personalityHtml(name: PersName, desc = true): string {
  const p = PERS[name];
  return `<section class="member-trait personality" style="--trait-color:${CATS[p.cat]}" aria-label="성격">
    <div class="trait-heading"><span class="trait-label">성격</span><b class="trait-title">${esc(name)}</b></div>
    ${desc ? `<p class="trait-description">${esc(p.desc)}</p>` : ''}</section>`;
}

/**
 * 능력치 세 묶음 × 네 줄 (97 「숫자와 보이는 법」): 1~5 회색 · 6~10 흰색 · 11~15 초록 · 16~20 금빛, 역할 핵심 넷은 굵게.
 */
export function statsHtml(stats: Stats, role: 'tank' | 'melee' | 'ranged', lastStatGains: readonly StatKey[] = []): string {
  const gains = new Set(lastStatGains);
  const band = (v: number) => (v >= 16 ? 'b4' : v >= 11 ? 'b3' : v >= 6 ? 'b2' : 'b1');
  const cell = (k: keyof Stats) => {
    const v = stats[k], core = ROLE_CORE[role].includes(k);
    const txt = String(v), lab = `${STAT_NAMES[k]} ${v}`, shown = v;
    const up = gains.has(k), growth = up ? ', 직전 레벨업에서 상승' : '';
    const arrow = '<svg class="fm-up" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1L11 10H1Z"/></svg>';
    return `<li class="${core ? 'core ' : ''}${band(shown)}" aria-label="${lab}${core ? ', 역할 핵심' : ''}${growth}"><span>${STAT_NAMES[k]}</span><b>${gains.size ? `<span class="fm-growth-slot"${up ? ' title="직전 레벨업에서 상승"' : ''}>${up ? arrow : ''}</span>` : ''}${txt}</b></li>`;
  };
  return `<div class="fm-grid">${STAT_GROUPS.map(g => `<section><h5>${g.name}</h5><ul>${g.keys.map(cell).join('')}</ul></section>`).join('')}</div>`;
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
  /** 직전 레벨업에서 오른 항목. 정확한 능력치를 보는 길드원에게만 표시한다. */
  lastStatGains?: StatKey[];
  /** 내 길드원 (능력치 숫자) */
  member?: boolean;
  /** 능력치에 레벨업 점수가 이미 든 저장 값 (길드원 · 지원자 · 공고 후보, 104). 아니면 타고난 값 + 그 레벨까지 점수를 화면에서 더함 (공개모집) */
  grown?: boolean;
}

/** 화면 숫자: 저장 값 (grown) 또는 타고난 값 + 레벨업 점수 */
const shownStats = (m: CardData): Stats => (m.grown ? m.fm!.stats : statsAt(m.fm!.stats, { nick: m.nick, pers: m.pers, role: CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged', lv: m.lv }));

/** 능력 ★ 글 (97 FM): 역할 핵심에 무게를 둔 화면 능력치 합, 같은 레벨 대비 (104). 능력치가 없는 사람 (옛 파티)은 빈 글 */
const fmStars = (m: CardData): string => (m.fm ? ratingStarsHtml(abilityStars(shownStats(m), CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged', m.lv)) : '');

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
 * 파티원 줄: 역할 칸 · 닉네임 · 직업 · Lv · 성격 칩 / 직업 스킬 이름 · LV · 오른쪽 끝 능력 별.
 * 성격은 분류색 테두리와 전체 이름을 표시한다. 효과는 상세 시트에 둔다.
 */
export function memRowHtml(m: CardData, o: { attrs?: string; cls?: string; extra?: string; note?: string; tag?: string; gold?: string; on?: boolean } = {}): string {
  const c = CLASSES[m.cls], p = PERS[m.pers], a = m.ab ? ABILITIES[m.ab] : null;
  const ab = a
    ? `<span class="skill-name"><b style="color:${SKILL_COLOR}">${esc(a.name)}</b></span>${m.star ? `<span class="skill-level">LV ${m.star}</span>` : ''}`
    : '';
  return `<li class="pcard f-mem${o.cls ? ` ${o.cls}` : ''}${o.on ? ' on' : ''}" ${o.attrs || ''}><span class="f-ri" style="background:${ROLE[c.role].color}">${classIcon(m.cls)}</span>
    <div class="f-mt"><span class="f-l1"><b class="pnick">${esc(m.nick)}</b><span class="cap">${c.name}${m.lv ? ` · Lv ${m.lv}` : ''}${o.note ? ` · ${o.note}` : ''}</span><span class="f-sp"></span><span class="f-ps" style="--pers-color:${CATS[p.cat]}">${esc(m.pers)}</span></span>
    <span class="f-l2"><span class="f-ab">${ab}</span>${o.tag ? `<small class="f-tag">${o.tag}</small>` : ''}${o.gold ? `<small class="f-tag gold">${o.gold}</small>` : ''}${m.fm ? `<span class="f-fm">능력 <b>${fmStars(m)}</b></span>` : ''}</span></div>${o.extra || ''}</li>`;
}

/** 파티원 상세: 능력 별 · 능력치 · 스킬 · 성격 */
export function memDetailHtml(m: CardData): string {
  const role = CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged';
  const g = m.fm ? growthOf(m.nick, role) : null, gt = g ? GROW_TYPES.find(x => x.type === g.type)! : null; // 성장 결 (103): 크는 모양 한 마디
  return `<div class="f-det">${m.fm ? `<p class="pfm">능력 <b>${fmStars(m)}</b>${gt ? `<small class="pfm-grow" title="${gt.desc}">${gt.type}</small>` : ''}</p>${statsHtml(shownStats(m), role, m.lastStatGains)}` : ''}${abHtml(m.ab, m.star || 0)}
    ${personalityHtml(m.pers)}</div>`;
}

