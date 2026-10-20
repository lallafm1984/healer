/**
 * 편성 화면·주간 도전 입장이 같이 쓰는 부품 (27 3-2·3-3, 2026-10-08 입장 화면을 편성에 합침):
 * 흐름 상단, 경고 줄 (미달일 때만), 공략 시트 (구간 노드 줄 + 보스별 공략 접기 + 어픽스).
 */
import type { DiffName } from '../data/difficulty';
import { ENCOUNTERS, segGrade, type EncounterKey } from '../data/encounters';
import { AFFIXES, type AffixKey } from '../data/affixes';
import { G } from '../game/state';
import { battle, esc } from './kit';

const svg = (d: string, sw = 2.2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const BACK = svg('<path d="M19 12H5M11 6l-6 6 6 6"/>');
/** 공략 (펼친 책) */
export const BOOK = svg('<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>', 2);

/** 흐름 화면 상단 (편성·주간 도전 입장, 시안 .hd): 뒤로 · (문양) · 제목 + 아래 작은 글 · 오른쪽 끝 (버튼 등) */
export function flowHead(back: string, title: string, sub: string, mark = '', right = ''): string {
  return `<header class="topbar f-hd"><button class="tb-back" type="button" data-go="${back}" aria-label="뒤로">${BACK}</button>${mark}<span class="f-tb"><b class="f-ttl">${esc(title)}</b><small class="cap f-hcap">${sub}</small></span><span class="f-sp"></span>${right}</header>`;
}

/** 경고 한 줄 (! + 글 + 오른쪽 버튼) */
const warnRow = (cls: string, html: string, right = '') => `<p class="f-warn ${cls}"><span class="f-mark warn" aria-hidden="true">!</span><span class="v">${html}</span>${right}</p>`;

/** 편성 안내는 권장 레벨 미달일 때 레벨만 표시합니다. */
export function recommendedLevel(stage: number): string {
  if (G.save.player.level >= stage) return '';
  return `<div class="f-warns" role="status">${warnRow('lv', '<span class="f-wl">권장 레벨</span>', `<b class="f-wn">Lv ${stage}</b>`)}</div>`;
}

/** 구간 노드 줄: 일반·정예 ● · 보스 ◆ */
export function timeline(segs: EncounterKey[]): string {
  return `<ol class="segs f-tl" aria-label="구간 ${segs.length}개">${segs.map(k => {
    const e = ENCOUNTERS[k], g = segGrade(e);
    return `<li class="${e.script === 'trash' ? 'trash' : 'boss'}${g === '정예' ? ' elite' : ''}"><span class="f-ndw"><i class="f-nd"></i></span><span class="f-nl">${g === '보스' ? esc(e.name) : g}</span></li>`;
  }).join('')}</ol>`;
}

/**
 * 공략 시트의 구간 길 (2026-10-12 공략 한눈에): 구간 노드 줄이 곧 탭. 누른 구간의 공략만 아래에 보임.
 * 일반·정예 ● · 보스 ◆, 고른 구간은 금빛 고리. sel = 처음 보이는 구간 (기본 = 마지막 보스)
 */
export function segTabs(segs: EncounterKey[], sel: number): string {
  return `<div class="f-route" role="tablist" aria-label="구간 ${segs.length}개">${segs.map((k, i) => {
    const e = ENCOUNTERS[k], g = segGrade(e), on = i === sel;
    return `<button type="button" role="tab" id="gtab${i}" class="f-rt ${e.script === 'trash' ? 'trash' : 'boss'}${g === '정예' ? ' elite' : ''}" data-gseg="${i}" aria-selected="${on}" aria-controls="gpane${i}" tabindex="${on ? 0 : -1}"><span class="f-ndw"><i class="f-nd"></i></span><span class="f-nl">${g === '보스' ? esc(e.name) : g}</span></button>`;
  }).join('')}</div>`;
}

/** 구간별 공략: 구간마다 한 판 (고른 구간만 보임). 보스 하나뿐이면 탭 없이 기술 목록만 */
export function guides(segs: EncounterKey[], d: DiffName, stage: number, sel = segs.length - 1): string {
  const lv = G.save.player.level;
  if (segs.length === 1) return `<div class="guides f-one">${battle().guide(segs[0], d, stage, lv)}</div>`;
  return `<div class="guides">${segs.map((k, i) => `<div class="gpane" role="tabpanel" id="gpane${i}" data-gpane="${i}" aria-labelledby="gtab${i}"${i === sel ? '' : ' hidden'}>${battle().guide(k, d, stage, lv)}</div>`).join('')}</div>`;
}

/** 어픽스 줄 (07 3장, 13 3-3): 빨간 이름 칸 + 설명 */
export function afxRows(keys: AffixKey[], label = ''): string {
  if (!keys.length) return '';
  return `<div class="afxlist">${keys.map(k => {
    const a = AFFIXES[k];
    return `<div class="f-afr"><span class="f-afx${a.good ? ' good' : ''}">${a.name}</span><span class="f-afd">${label ? `${label} · ` : ''}${esc(a.desc)}<small>${esc(a.tip)}</small></span></div>`;
  }).join('')}</div>`;
}

/** 어픽스 이름 칸만 (관문·편성 머리) */
export const afxTags = (keys: AffixKey[]) => keys.map(k => `<span class="f-afx${AFFIXES[k].good ? ' good' : ''}">${AFFIXES[k].name}</span>`).join('');
