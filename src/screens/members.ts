/** 파티원·길드원 카드 조각 (편성 S05, 길드 S12~S14): 직업 · 능력(직업 스킬 + LV) · 능력치 · 성격 (17 11장) */
import { ABILITIES } from '../data/abilities';
import { CLASSES, type ClassKey } from '../data/classes';
import { CATS, PERS, type PersName } from '../data/personalities';
import { abilityStars, GROW_TYPES, growthOf, ROLE_CORE, STAT_GROUPS, STAT_HELP, STAT_NAMES, statsAt, type StatKey, type Stats } from '../data/fm';
import { memberSkillLevel, type GuildMember } from '../data/guild';
import { xpToNext } from '../data/progression';
import { classGlyphSvg } from './class-icons';
import { ratingStarsHtml } from './member-icons';
import { uiIcon } from './art';
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
 * 레벨 (`.f-lv`)은 테 두른 칩으로 크게, 스킬 LV (`.skill-level`)는 테 없이 작은 글자 (2026-10-28 Lim 「스킬레벨이 더 강조되어 일반 레벨로 보인다 … 바꾸자」).
 */
export function memRowHtml(m: CardData, o: { attrs?: string; cls?: string; extra?: string; tag?: string; gold?: string; on?: boolean } = {}): string {
  const c = CLASSES[m.cls], p = PERS[m.pers], a = m.ab ? ABILITIES[m.ab] : null;
  const ab = a
    ? `<span class="skill-name"><b style="color:${SKILL_COLOR}">${esc(a.name)}</b></span>${m.star ? `<span class="skill-level">LV ${m.star}</span>` : ''}`
    : '';
  return `<li class="pcard f-mem${o.cls ? ` ${o.cls}` : ''}${o.on ? ' on' : ''}" ${o.attrs || ''}><span class="f-ri" style="background:${ROLE[c.role].color}">${classIcon(m.cls)}</span>
    <div class="f-mt"><span class="f-l1"><b class="pnick">${esc(m.nick)}</b><span class="cap">${c.name}${m.lv ? ` <b class="f-lv">Lv ${m.lv}</b>` : ''}</span><span class="f-sp"></span><span class="f-ps" style="--pers-color:${CATS[p.cat]}">${esc(m.pers)}</span></span>
    <span class="f-l2"><span class="f-ab">${ab}</span>${o.tag ? `<small class="f-tag">${o.tag}</small>` : ''}${o.gold ? `<small class="f-tag gold">${o.gold}</small>` : ''}${m.fm ? `<span class="f-fm">능력 <b>${fmStars(m)}</b></span>` : ''}</span></div>${o.extra || ''}</li>`;
}

/** 파티원 상세: 능력 별 · 능력치 · 스킬 · 성격 */
export function memDetailHtml(m: CardData): string {
  const role = CLASSES[m.cls].role as 'tank' | 'melee' | 'ranged';
  const g = m.fm ? growthOf(m.nick, role) : null, gt = g ? GROW_TYPES.find(x => x.type === g.type)! : null; // 성장 결 (103): 크는 모양 한 마디
  return `<div class="f-det">${m.fm ? `<p class="pfm">능력 <b>${fmStars(m)}</b>${gt ? `<small class="pfm-grow" title="${gt.desc}">${gt.type}</small>` : ''}</p>${statsHtml(shownStats(m), role, m.lastStatGains)}` : ''}${abHtml(m.ab, m.star || 0)}
    ${personalityHtml(m.pers)}</div>`;
}


// ---------- 길드원 상세 (길드 탭 · 편성 길드파티가 같은 시트, 2026-10-28 Lim 「이름이나 아이콘을 누르면 능력치 팝업」) ----------
/** 길드원 · 지원자 줄 · 시트에 넘길 사람 (저장 능력치 그대로) */
export const memberCard = (m: Pick<GuildMember, 'nick' | 'cls' | 'pers' | 'ab' | 'lv' | 'stats' | 'lastStatGains' | 'skillFloor'>, member = false): CardData => ({ nick: m.nick, cls: m.cls, pers: m.pers, ab: m.ab, lv: m.lv, star: memberSkillLevel(m), fm: { stats: m.stats }, grown: true, lastStatGains: member ? m.lastStatGains : undefined, member });
/** 길드 막대 (경험치 · 할 일, guild-hall.css .g-bar) */
export const gBar = (pct: number, label: string) => `<span class="g-bar" role="img" aria-label="${label}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(0)}%"></i></span>`;
/** 시트 머리: 닉네임 · 직업 · Lv. help = 길드원 상세만 ⓘ (능력치 설명 팝업) */
export const memberSheetHead = (m: CardData, help = false) => `<h2 class="h-rule">${esc(m.nick)}<span class="rule"></span><span class="cap">${CLASSES[m.cls].name}${m.lv ? ` · Lv ${m.lv}` : ''}</span>${help ? `<button type="button" class="g-info" data-stathelp aria-haspopup="dialog" aria-label="능력치 설명">${uiIcon('info')}</button>` : ''}</h2>`;
/**
 * 길드원 상세 몸: 머리 ⓘ → 레벨 경험치 막대 → 능력치 · 직업 스킬 · 성격. 길드 탭은 이 아래에 골드 지원 · 내보내기.
 * 막대 아래 초록 줄 「직전 레벨업 두 배 · 회피 +1 …」은 없다 (2026-10-28 Lim 「녹색의 직전 레벨업 두배 텍스트 제거」, 오른 칸은 능력치 표 화살표). 다시 넣지 않는다
 */
export function memberInfoHtml(m: GuildMember): string {
  const need = xpToNext(m.lv), xpPct = isFinite(need) ? Math.min(100, (m.xp / need) * 100) : 100;
  const d = memberCard(m, true);
  return `${memberSheetHead(d, true)}
    <div class="g-meters">
      <p class="g-meter"><span class="k">Lv ${m.lv}</span>${gBar(xpPct, `경험치 ${Math.floor(xpPct)}%`)}<small>${isFinite(need) ? `${Math.floor(xpPct)}%` : '최대'}</small></p></div>
    ${memDetailHtml(d)}`;
}
/** 길드원 상세 ⓘ → 능력치 12칸 한 줄 설명 (fm.ts STAT_HELP). 세 묶음 = 상세 능력치 칸과 같은 신체 · 기술 · 정신. 닫기 = [data-shut] */
export function statHelpPopupHtml(): string {
  const groups = STAT_GROUPS.map(g => `<section class="g-card g-stat-card" aria-label="${g.name}"><h4>${g.name}</h4><ul class="g-rows">${g.keys.map(k => `<li class="g-row g-stat-row"><b>${STAT_NAMES[k]}</b><span>${STAT_HELP[k]}</span></li>`).join('')}</ul></section>`).join('');
  return `<button type="button" class="sheet-dim g-action-dim" data-shut aria-label="능력치 설명 닫기" tabindex="-1"></button>
    <section class="sheet g-action-confirm g-stat-help" role="dialog" aria-modal="true" aria-labelledby="guildStatTitle">
      <h3 id="guildStatTitle">능력치</h3>
      ${groups}
      <div class="g-action-buttons g-one"><button type="button" data-shut>닫기</button></div>
    </section>`;
}
