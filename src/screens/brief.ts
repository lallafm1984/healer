/**
 * 편성 화면·주간 도전 입장이 같이 쓰는 부품 (27 3-2·3-3, 2026-10-08 입장 화면을 편성에 합침):
 * 흐름 상단, 경고 줄 (미달일 때만), 공략 시트 (구간 노드 줄 + 보스별 공략 접기 + 어픽스).
 */
import type { ContentDef } from '../data/content';
import { DIFFS, MYTHIC, type DiffName } from '../data/difficulty';
import { ENCOUNTERS, segGrade, type EncounterKey } from '../data/encounters';
import { avgScore, gearSummary, GRADE_STYLE, ITEM_GRADES, RECOMMENDED } from '../data/equipment';
import { canDispel, DEB_COLOR, HEROES } from '../data/heroes';
import { AFFIXES, type AffixKey } from '../data/affixes';
import { G, heroNow, switchOpen } from '../game/state';
import { battle, esc } from './kit';
import { placeArt } from './art';

const svg = (d: string, sw = 2.2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const BACK = svg('<path d="M19 12H5M11 6l-6 6 6 6"/>');
export const ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>');
/** 종 조각 (악몽 입장권) */
export const BELL = svg('<path d="M6.5 16v-4.5a5.5 5.5 0 0 1 11 0V16l1.5 2h-14z"/><path d="M10 20.5h4"/>', 2);
/** 공략 (펼친 책) */
export const BOOK = svg('<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>', 2);
const CHEV = '<svg class="f-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

/** 흐름 화면 상단 (편성·주간 도전 입장, 시안 .hd): 뒤로 · (문양) · 제목 + 아래 작은 글 · 오른쪽 끝 (버튼 등) */
export function flowHead(back: string, title: string, sub: string, mark = '', right = ''): string {
  return `<header class="topbar f-hd"><button class="tb-back" type="button" data-go="${back}" aria-label="뒤로">${BACK}</button>${mark}<span class="f-tb"><b class="f-ttl">${esc(title)}</b><small class="cap f-hcap">${sub}</small></span><span class="f-sp"></span>${right}</header>`;
}

/** 상단 뒤에 장소 그림 (어둡게 깔림, 28 4장 입장 머리) */
export function cover(c: ContentDef, inner: string): string {
  const pa = placeArt(c.key);
  return `<div class="f-cover${pa.url ? ' art' : ''}"${pa.url ? ` style="--cv:url('${pa.url}')"` : ''}>${inner}</div>`;
}

/** 장비 점수 → 등급 + 강화 글 (itemScore = 등급 순위 + 강화/10, 평균이라 섞인 장비는 중간값) */
function gradeOf(score: number): string {
  const i = Math.floor(score + 1e-6) - 1;
  if (i < 0) return '';
  const g = ITEM_GRADES[Math.min(i, ITEM_GRADES.length - 1)], plus = Math.round((score - Math.min(i, ITEM_GRADES.length - 1) - 1) * 10);
  return `<b class="f-g" style="color:${GRADE_STYLE[g].color}">${g}</b>${plus > 0 ? ` +${plus}` : ''}`;
}
export function myGear(): string {
  const avg = avgScore(G.save.gear.equipped);
  return avg >= 1 ? gradeOf(avg) : avg > 0 ? esc(gearSummary(G.save.gear.equipped)) : '장비 없음';
}

/** 경고 한 줄 (! + 글 + 오른쪽 버튼) */
const warnRow = (cls: string, html: string, right = '') => `<p class="f-warn ${cls}"><span class="f-mark warn" aria-hidden="true">!</span><span class="v">${html}</span>${right}</p>`;

/**
 * 준비 확인 (27 3-2) → 미달·불가만 경고 줄로. 다 괜찮으면 빈 글 (상자 없음).
 * 해제: 이 콘텐츠의 디버프를 지금 직업이 못 지우면 + 직업 바꾸기 (25 7장). 장비: 권장 미달 (입장은 됨). 레벨: 단계보다 낮으면 (개발 빌드)
 */
export function warnings(segs: EncounterKey[], d: DiffName, stage: number, o: { gear?: boolean } = {}): string {
  const out: string[] = [];
  const types = [...new Set(segs.flatMap(k => ENCOUNTERS[k].debuffs || []))];
  const h = heroNow(), miss = types.filter(t => !canDispel(h, t));
  if (miss.length) {
    const chips = miss.map(t => `<span class="dsp" style="--c:${DEB_COLOR[t] || '#888'}">${t}</span>`).join('');
    const swap = switchOpen().ok ? '<button class="btn2" type="button" data-go="s-char" data-arg="hero">직업 바꾸기</button>' : '';
    out.push(warnRow('dispel', `${chips} 해제 못 함 <span class="cap">${HEROES[h].name}</span>`, swap));
  }
  const rec = RECOMMENDED[d];
  if (o.gear !== false && rec && avgScore(G.save.gear.equipped) < rec.score) out.push(warnRow('gear', `장비 권장 ${gradeOf(rec.score)} · 내 ${myGear()} <span class="cap">입장은 됨</span>`));
  const lv = G.save.player.level;
  if (lv < stage) out.push(warnRow('lv', `레벨 권장 ${stage} · 내 ${lv}`));
  return out.length ? `<div class="f-warns" role="status">${out.join('')}</div>` : '';
}

/** 구간 노드 줄: 일반·정예 ● · 보스 ◆ */
export function timeline(segs: EncounterKey[]): string {
  return `<ol class="segs f-tl" aria-label="구간 ${segs.length}개">${segs.map(k => {
    const e = ENCOUNTERS[k], g = segGrade(e);
    return `<li class="${e.script === 'trash' ? 'trash' : 'boss'}${g === '정예' ? ' elite' : ''}"><span class="f-ndw"><i class="f-nd"></i></span><span class="f-nl">${g === '보스' ? esc(e.name) : g}</span></li>`;
  }).join('')}</ol>`;
}

/** 구간별 공략 접기: 누르면 기술 목록 (전투 공략 데이터 그대로). 보스 하나뿐이면 접기 없이 기술 목록만 */
export function guides(segs: EncounterKey[], d: DiffName, stage: number): string {
  const lv = G.save.player.level;
  if (segs.length === 1) return `<div class="guides f-one">${battle().guide(segs[0], d, stage, lv)}</div>`;
  return `<div class="guides">${segs.map(k => {
    const html = battle().guide(k, d, stage, lv);
    const n = (html.match(/class="gs[ "]/g) || []).length, g = segGrade(ENCOUNTERS[k]);
    return `<details class="gdet f-acc"><summary>${CHEV}<span class="f-an">${esc(ENCOUNTERS[k].name)}</span><span class="f-sp"></span><span class="cap">${g === '보스' ? '' : `${g} · `}기술 ${n}</span></summary>${html}</details>`;
  }).join('')}</div>`;
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

export function diffNote(d: DiffName, raid: boolean): string {
  const x = DIFFS[d];
  let t = `받는 피해 ×${x.dmg} · 파티원 회피 ${Math.round(x.dodge * 100)}%`;
  if (d === '악몽') t += ` · 파티원 체력·딜 ×${MYTHIC.party} · 보스 체력 ×${MYTHIC.bossHp}${raid ? ' · 보스마다 악몽 전용 기술' : ''}`;
  return t;
}
