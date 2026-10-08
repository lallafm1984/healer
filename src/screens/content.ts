/**
 * S03 모험 선택 = 전투 탭 루트 (27 3-1 → 30 시안 Battle30 「B 출정 관문」).
 * 위에서부터: 분류 4칸 (탐험 3인 · 던전 5인 · 레이드 10·20인 · 이벤트) → 던전이면 주간 도전 띠 (13 3-2)
 * → 관문 = 아치 금테 안 장소 그림 (28 4장) · 세력 문양 이름표 · 추천 리본 · ‹ › · 정보 줄 · 해제 칩 · 보상 칸 (레이드는 이번 주 장비·종 조각, 13 3-4)
 * → 장소 문양 줄 (고르기) → 난이도 4칸 (별) → 「출전」 = 입장 화면으로.
 * 분류마다 마지막 고른 장소, 장소마다 마지막 고른 난이도를 기억 (모듈 변수, 저장 안 함).
 */
import { ALL_DIFFS, CONTENT, contentOf, dispelsOf, raidSize, stageOf, type ContentDef, type ContentKey, type ContentKind } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { AFFIXES } from '../data/affixes';
import { CHAL } from '../data/challenge';
import { FIRST_CLEAR_CRYSTAL, SHARD_MAX } from '../data/economy';
import { avgScore, DROP_TABLE, GRADE_STYLE, ITEM_GRADES, LEGEND_LEVEL, RECOMMENDED } from '../data/equipment';
import { canDispel, DEB_COLOR } from '../data/heroes';
import { FACTIONS, PLACES, type FactionKey } from '../data/places';
import { clearGold } from '../data/progression';
import { cssUrl } from '../art';
import { RESET_HOUR, weekKey } from '../game/clock';
import { raidLootOpen } from '../game/economy';
import { Flow } from '../game/flow';
import { chalGate, weekAffixes } from '../game/runmode';
import { G, heroNow, lockOf } from '../game/state';
import { TUT } from '../game/tutorial';
import { esc, fmt, go, previous, screen, topBar } from './kit';
import { factionMark, gameIcon, LOCK, placeArt } from './art';

/** 선 아이콘 (시안 Battle30 임시 선그림, 정식 그림이 오면 gameIcon이 바꿈) */
const line = (d: string, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  explore: line('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  dungeon: line('<path d="M4 21V8l3-2 3 2V5h4v3l3-2 3 2v13"/><path d="M10 21v-5a2 2 0 0 1 4 0v5"/>'),
  raid: line('<path d="M6.5 16v-4.5a5.5 5.5 0 0 1 11 0V16l1.5 2h-14z"/><path d="M10 20.5h4"/>'),
  event: line('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"/>'),
  hourglass: line('<path d="M7 3h10M7 21h10M8 3v2c0 3 4 5 4 7s-4 4-4 7v2M16 3v2c0 3-4 5-4 7s4 4 4 7v2"/>', 2.2),
  gear: line('<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12 7l5 5"/>'),
  gold: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="#E8B23A" stroke="#7A5418" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#B9831F" stroke-width="1.6"/></svg>',
  crystal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12l3 5-9 11L3 9z" fill="#7FC8FF" stroke="#1E4A7A" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 9h18M9 4l3 16 3-16" fill="none" stroke="#1E4A7A" stroke-width="1.2"/></svg>',
};
const PREV = line('<path d="M15 6l-6 6 6 6"/>', 2.6);
const NEXT = line('<path d="M9 6l6 6-6 6"/>', 2.6);
const CHEV = '<svg class="f-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const ARROW = '<svg class="g-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

const KINDS: { kind: ContentKind; name: string }[] = [
  { kind: 'explore', name: '탐험' },
  { kind: 'dungeon', name: '던전' },
  { kind: 'raid', name: '레이드' },
  { kind: 'event', name: '이벤트' },
];
/** 장소 문양 줄의 짧은 이름 (칸이 좁아서. 관문 이름표엔 전체 이름) */
const SHORT: Partial<Record<ContentKey, string>> = { crypt: '지하묘지', manor: '장원', abyss1: '종탑 1층', cathedral1: '대성당 1구역' };

/** 마지막으로 고른 분류 (27 3-1) */
let tab: ContentKind = 'dungeon';
/** 분류마다 마지막 고른 장소 */
const pick: Partial<Record<ContentKind, ContentKey>> = {};
/** 장소마다 마지막 고른 난이도 */
const diffPick: Partial<Record<ContentKey, DiffName>> = {};

const listOf = (k: ContentKind) => CONTENT.filter(c => c.kind === k && !c.hidden);
const factionOf = (c: ContentDef): FactionKey => PLACES[placeArt(c.key).place].faction;
/** 준비 중이거나 레벨이 모자라 못 들어가는 장소 */
const isOff = (c: ContentDef) => !c.ready || lockOf(c).locked;
/** 그 난이도만 따로 잠김 (10인 악몽 Lv 50 등). 장소 자체가 잠긴 건 보상 보기로 고를 수 있게 둠 */
function diffLocked(c: ContentDef, d: DiffName): { locked: boolean; lv: number } {
  const l = lockOf(c, d);
  return { locked: l.locked && l.lv > c.unlockLv, lv: l.lv };
}

/** 세력 문양 (색 = 시안 Parts27 문양 색). 입장 화면 머리도 씀 */
export function markHtml(c: ContentDef, size: 'sm' | 'md' | 'lg' = 'lg'): string {
  const f = factionOf(c), m = FACTIONS[f].mark;
  return `<span class="f-em${m.dark ? ' dark' : ''}" style="--rim:${m.rim};--glyph:${m.glyph}">${factionMark(f, size)}</span>`;
}

/** 해제 칩 (27 3-1): 그 콘텐츠에 나오는 디버프 유형. 지금 직업이 못 푸는 유형은 빗금 + 「못 풂」, 물리만이면 「없음 · 물리」 */
function dispelChips(c: ContentDef): string {
  const types = dispelsOf(c), h = heroNow();
  if (!types.length) return '<span class="dsp none">없음 · 물리</span>';
  return types.map(t => {
    const ok = canDispel(h, t);
    return `<span class="dsp${ok ? '' : ' cant'}" style="--c:${DEB_COLOR[t] || '#888'}">${t}${ok ? '' : ' · 못 풂'}</span>`;
  }).join('');
}

/** 그 난이도 최고 별 (★☆ 3칸) */
function stars(c: ContentDef, d: DiffName): string {
  const n = G.save.clears[c.key]?.[d]?.stars || 0;
  return `<span class="sr">별 ${n}개</span><span aria-hidden="true">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</span>`;
}

/** 레이드: 이번 주 장비 받음 (보스마다 난이도별 주 1회) · 종 조각 (악몽 입장권) */
function lootLine(c: ContentDef): string {
  if (c.kind !== 'raid' || G.save.tut < TUT.done) return '';
  const got = ALL_DIFFS.map(d => !raidLootOpen(G.save, c.key, d));
  const dots = `<span class="b-loot" role="img" aria-label="${ALL_DIFFS.map((d, i) => `${d} ${got[i] ? '받음' : '아직'}`).join(', ')}" title="쉬움 · 보통 · 어려움 · 악몽">${got.map(g => `<i${g ? ' class="got"' : ''}></i>`).join('')}</span>`;
  return `<span class="b-row b-lootrow"><span class="cap">이번 주 장비</span>${dots}<span class="f-sp"></span><span class="cap">종 조각 ${G.save.wallet.shards}/${SHARD_MAX}</span></span>`;
}

/**
 * 추천 리본 (27 3-1): 내 레벨·장비로 「보통 이상 처음 깨기 좋은」 장소 1곳.
 * 콘텐츠마다 아직 안 깬 가장 낮은 난이도(보통부터)를 보고, 레벨이 단계 이상이고 권장 장비를 채우면 후보. 단계가 가장 높은 것 (같으면 탐험보다 던전·레이드)
 */
function recommended(): ContentKey | null {
  const lv = G.save.player.level, mine = avgScore(G.save.gear.equipped);
  let best: { k: ContentKey; s: number } | null = null;
  for (const c of CONTENT) {
    if (c.hidden || !c.ready || c.kind === 'event' || lockOf(c).locked) continue;
    const rec = G.save.clears[c.key] || {};
    for (const d of ['보통', '어려움', '악몽'] as DiffName[]) {
      if (rec[d]) continue;
      const st = stageOf(c, d), r = RECOMMENDED[d];
      if (lockOf(c, d).locked || lv < st || (r && mine < r.score)) break;
      const sc = st * 10 + (c.kind === 'explore' ? 0 : 1);
      if (!best || sc > best.s) best = { k: c.key, s: sc };
      break;
    }
  }
  return best ? best.k : null;
}

/** 지금 고른 장소: 기억한 것 → 추천 → 들어갈 수 있는 첫 장소 → 첫 장소 (이벤트처럼 없으면 null) */
function current(): ContentDef | null {
  const list = listOf(tab);
  if (!list.length) return null;
  const rec = recommended();
  const c = list.find(x => x.key === pick[tab]) || list.find(x => x.key === rec) || list.find(x => !isOff(x)) || list[0];
  pick[tab] = c.key;
  return c;
}

/** 고른 난이도: 기억한 것 → (튜토리얼 첫 던전은 쉬움, 09 4장) → 아직 안 깬 가장 낮은 난이도 (보통부터) → 다 깼으면 열린 가장 높은 난이도 */
function diffOf(c: ContentDef): DiffName {
  const m = diffPick[c.key];
  if (m && !diffLocked(c, m).locked) return m;
  if (G.save.tut === TUT.dungeon && c.key === 'rustfort') return '쉬움';
  const rec = G.save.clears[c.key] || {};
  let last: DiffName = '보통';
  for (const d of ['보통', '어려움', '악몽'] as DiffName[]) {
    if (diffLocked(c, d).locked) break;
    if (!rec[d]) return d;
    last = d;
  }
  return last;
}

/** 주간 도전이 바뀌기까지 (월요일 오전 6시, 13 1장) */
function weekLeft(now = Date.now()): string {
  const [y, m, d] = weekKey(now).split('-').map(Number);
  const ms = new Date(y, m - 1, d + 7, RESET_HOUR).getTime() - now, day = 864e5;
  return ms >= day ? `${Math.floor(ms / day)}일 남음` : `${Math.max(1, Math.ceil(ms / 36e5))}시간 남음`;
}

/** 분류 4칸: 아이콘 + 이름 + 인원 (레이드가 다 잠겼으면 자물쇠 Lv, 장소가 없으면 준비 중) */
function cats(): string {
  return `<nav class="b-cats" role="tablist" aria-label="콘텐츠 분류">${KINDS.map(k => {
    const list = listOf(k.kind);
    const sizes = [...new Set(list.map(c => c.size('보통')))].sort((a, b) => a - b);
    const lv = Math.min(...list.map(c => c.unlockLv));
    const sub = !list.length ? '준비 중' : list.every(c => lockOf(c).locked) ? `${LOCK}Lv ${lv}` : `${sizes.join('·')}인`;
    return `<button type="button" class="b-cat" role="tab" data-ctab="${k.kind}" aria-selected="${k.kind === tab}"><span class="b-ci">${gameIcon(k.kind, ICON[k.kind])}</span><span><b>${k.name}</b><small>${sub}</small></span></button>`;
  }).join('')}</nav>`;
}

/** 주간 도전 띠 (13 3-2): 던전 칸 맨 위. 모래시계 · 이번 주 어픽스 · 최고 단계 · 남은 날 (좁으면 들어가는 어픽스만) */
function chalCard(): string {
  if (G.save.tut < TUT.done) return '';
  const g = chalGate(G.save), aff = weekAffixes(), best = G.save.weekly.chalBest, left = weekLeft();
  return `<button class="b-chal${g.ok ? '' : ' off'}" type="button" data-chal${g.ok ? '' : ' aria-disabled="true"'}>
    <span class="b-hg">${gameIcon('challenge', ICON.hourglass)}</span>
    <b>주간 도전<span class="sr"> 「${esc(CHAL.name)}」</span></b>
    <span class="b-afx">${aff.map(k => `<span class="f-afx${AFFIXES[k].good ? ' good' : ''}">${AFFIXES[k].name}</span>`).join('')}</span>
    <span class="f-sp"></span>
    ${g.ok ? `<span class="cap b-cc">${g.dev ? '개발 빌드 · ' : ''}최고 ${best ? `${best}단` : '없음'} · ${left.replace(' 남음', '')}<span class="sr"> 남음</span></span>${CHEV}` : `<span class="b-lk">${LOCK}Lv ${g.lv}</span>`}
  </button>`;
}

/** 보상 칸 (입장 화면 보상 계산과 같음): 장비 등급 범위 · 골드 (A 등급) · 첫 클리어 크리스탈 + 전설 확률 */
function rewards(c: ContentDef, d: DiffName): string {
  const lv = G.save.player.level, table = DROP_TABLE[d];
  const lo = table.findIndex(p => p > 0);
  let hi = table.reduce((m, p, i) => (p > 0 ? i : m), 0);
  // 전설은 Lv 50부터 (그 전엔 영웅으로 나옴)
  if (ITEM_GRADES[hi] === '전설' && lv < LEGEND_LEVEL) hi = ITEM_GRADES.indexOf('영웅');
  const gLo = ITEM_GRADES[lo], gHi = ITEM_GRADES[hi];
  const range = lo >= hi ? gHi : `${gLo}~${gHi}`;
  const gold = clearGold(stageOf(c, d), d, 'A', raidSize(c));
  const first = G.save.tut >= TUT.done && !G.save.clears[c.key]?.[d];
  const leg = table[ITEM_GRADES.indexOf('전설')];
  const legTxt = !leg ? '' : lv < LEGEND_LEVEL ? `전설 Lv ${LEGEND_LEVEL}부터` : `전설 ${Math.round(leg * 100)}%`;
  const cell = (rc: string, icon: string, label: string, extra = '') =>
    `<span class="b-rw" style="--rc:${rc}"><span class="b-rb">${icon}${extra}</span><small>${label}</small></span>`;
  return `<div class="b-rws" role="group" aria-label="${d} 보상">
    ${cell(GRADE_STYLE[gHi].color, gameIcon('gear', ICON.gear), `<span class="sr">장비 </span>${range}`)}
    ${cell('#C9A35C', gameIcon('gold', ICON.gold), `<span class="sr">골드 </span>${fmt(gold)}`)}
    ${first ? cell('#6FA9D8', gameIcon('crystal', ICON.crystal), `<span class="sr">크리스탈 </span>${FIRST_CLEAR_CRYSTAL}`, '<em>처음</em>') : ''}
    <span class="cap b-leg">${legTxt}</span>
  </div>`;
}

/** 관문: 아치 금테 안 장소 그림 + 이름표 · 추천 · ‹ › · 정보 · 해제 · 보상 */
function gate(c: ContentDef, d: DiffName, many: boolean): string {
  const pa = placeArt(c.key), f = factionOf(c), lk = lockOf(c), pl = PLACES[pa.place];
  const [region, side] = c.place.split(' · ');
  const status = !c.ready ? '준비 중' : lk.locked ? `${LOCK}Lv ${lk.lv}에 열림` : '';
  const art = pa.url
    ? `<img class="b-art${pa.scene ? '' : ' floor'}" src="${pa.url}" alt="${esc(pl.name)}" decoding="async" draggable="false">`
    : `<span class="b-art none" style="--t0:${pl.tone[0]};--t1:${pl.tone[1]}"></span>`;
  return `<section class="b-gate${status ? ' off' : ''}${c.kind === 'raid' ? ' raid' : ''}" aria-label="출전할 곳 · ${esc(c.name)}">
    ${art}
    <div class="b-gt"><span class="b-gm" style="--rim:${FACTIONS[f].mark.rim}">${factionMark(f, 'md')}</span><span class="b-gn"><b>${esc(c.name)}</b><small>단계 Lv ${stageOf(c, d)}${side ? ` · ${esc(side)}` : ''}</small></span></div>
    ${c.key === recommended() ? '<span class="b-rib">추천</span>' : ''}
    ${many ? `<button type="button" class="b-arw prev" data-step="-1" aria-label="이전 장소">${PREV}</button><button type="button" class="b-arw next" data-step="1" aria-label="다음 장소">${NEXT}</button>` : ''}
    ${status ? `<span class="b-st">${status}</span>` : ''}
    <div class="b-gb">
      <span class="b-inf">${esc(region)} · ${c.size(d)}인 · 보스 ${c.bosses.length}</span>
      <span class="b-row"><span class="cap">해제</span>${dispelChips(c)}</span>
      ${c.ready && lk.dev ? `<span class="f-dev">Lv ${lk.lv} 해금 · 개발 빌드라 열림</span>` : ''}
      ${c.ready ? rewards(c, d) : ''}
      ${c.ready && !lk.locked ? lootLine(c) : ''}
    </div>
  </section>`;
}

/** 장소 문양 줄: 그 분류의 장소들 (누르면 관문이 바뀜). 준비 중 = 회색 + 「준비」, 잠김 = 자물쇠 */
function places(list: ContentDef[], cur: ContentDef): string {
  return `<nav class="b-places" aria-label="장소">${list.map(x => {
    const lk = lockOf(x), on = x.key === cur.key;
    const st = !x.ready ? ' off' : lk.locked ? ' lock' : '';
    const tag = !x.ready ? '<span class="b-tg">준비</span>' : lk.locked ? `<span class="b-tg">${LOCK}Lv ${lk.lv}</span>` : '';
    const label = `${x.name}${!x.ready ? ' · 준비 중' : lk.locked ? ` · Lv ${lk.lv}에 열림` : ''}`;
    return `<button type="button" class="b-pl${on ? ' on' : ''}${st}" data-content="${x.key}" aria-pressed="${on}" aria-label="${esc(label)}"><span class="b-r">${factionMark(factionOf(x), 'md')}</span>${tag}<small>${esc(SHORT[x.key] || x.name)}</small></button>`;
  }).join('')}</nav>`;
}

/** 난이도 4칸: 이름 + 별. 그 난이도만 잠겼으면 자물쇠 Lv, 준비 중 장소는 못 고름 */
function diffs(c: ContentDef, d: DiffName): string {
  return `<div class="b-df" role="group" aria-label="난이도">${ALL_DIFFS.map(x => {
    const l = diffLocked(c, x), dis = !c.ready || l.locked, on = c.ready && x === d;
    return `<button type="button" class="b-dc${on ? ' on' : ''}" data-diff="${x}" aria-pressed="${on}"${dis ? ' disabled' : ''}>${x}<small>${c.ready && l.locked ? `${LOCK}Lv ${l.lv}` : stars(c, x)}</small></button>`;
  }).join('')}</div>`;
}

/** 출전 (30 공통 .g-cta): 세력 문양 + 「출전」 + 장소 · 난이도. 못 들어가는 곳은 막힘 */
function cta(c: ContentDef | null, d: DiffName): string {
  const lk = c ? lockOf(c, d) : null;
  const ok = !!c && c.ready && !lk!.locked;
  const sub = !c ? '이벤트 준비 중' : !c.ready ? `${c.name} · 준비 중` : lk!.locked ? `${c.name} · Lv ${lk!.lv}에 열림` : `${c.name} · ${d}`;
  const mk = c ? factionMark(factionOf(c), 'md') : `<span>${line('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"/>')}</span>`;
  return `<button type="button" class="g-cta" id="contentGo"${ok ? '' : ' disabled'}><span class="g-mk">${mk}</span><span class="g-ct"><b>출전</b><small>${esc(sub)}</small></span>${ARROW}</button>`;
}

const s = screen('s-content', '모험 선택', {
  tab: 'battle',
  // arg = 열 분류 (로비: 주간 도전 → dungeon, 레이드 → raid). 없으면 마지막 고른 분류
  enter(arg) {
    if (KINDS.some(t => t.kind === arg)) tab = arg as ContentKind;
    // 입장 화면에서 돌아오면 거기서 바꾼 난이도까지 기억 (주간 도전은 따로)
    if (previous === 's-entry' && !Flow.chal && G.save.tut >= TUT.done) {
      const c = contentOf(Flow.content);
      if (!c.hidden) { tab = c.kind; pick[c.kind] = c.key; diffPick[c.key] = Flow.diff; }
    }
    if (G.save.tut === TUT.dungeon) { tab = 'dungeon'; pick.dungeon = 'rustfort'; }
    render(false);
  },
});

/** keep = 화면 안에서 다시 그림 (스크롤·포커스 유지) */
function render(keep = true): void {
  const body = s.el.querySelector<HTMLElement>('.b-body');
  const top = keep && body ? body.scrollTop : 0;
  const a = document.activeElement as HTMLElement | null;
  const focus = keep && a && s.el.contains(a) ? ['data-ctab', 'data-content', 'data-step', 'data-diff'].filter(n => a.hasAttribute(n)).map(n => `[${n}="${a.getAttribute(n)}"]`)[0] || (a.id ? `#${a.id}` : '') : '';

  const list = listOf(tab), c = current(), d = c ? diffOf(c) : '보통';
  const tut = G.save.tut === TUT.dungeon && tab === 'dungeon';
  const tip = tut ? '<p class="coachtip b-tip"><b>녹슨 요새</b> 쉬움으로 출전. 일반·정예 구간 둘, 보스 둘을 이어서 진행</p>' : '';
  const empty = `<section class="b-gate b-empty" aria-label="이벤트"><span class="b-ei">${gameIcon('event', ICON.event)}</span><b>이벤트 준비 중</b><span class="cap">시즌 이벤트가 열리면 여기에 나옵니다.</span></section>`;
  s.el.style.setProperty('--b-bg', c ? cssUrl(placeArt(c.key).url) : 'none');
  s.el.innerHTML = `${topBar({ settings: true })}
    <div class="ns-body b-body">${tip}${cats()}${tab === 'dungeon' ? chalCard() : ''}${c ? gate(c, d, list.length > 1) + places(list, c) + diffs(c, d) : empty}</div>
    <footer class="b-foot">${cta(c, d)}</footer>`;
  if (tut) s.el.querySelector('#contentGo')?.classList.add('hi-pulse');
  const nb = s.el.querySelector<HTMLElement>('.b-body');
  if (nb) nb.scrollTop = top;
  if (focus) s.el.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
}

s.el.addEventListener('click', e => {
  const el = e.target as HTMLElement;
  const t = el.closest<HTMLElement>('[data-ctab]');
  if (t) { tab = t.dataset.ctab as ContentKind; render(); return; }
  const ch = el.closest<HTMLElement>('[data-chal]');
  if (ch) {
    if (ch.getAttribute('aria-disabled') === 'true') return;
    Flow.content = CHAL.content; Flow.diff = CHAL.diff; Flow.tier = 0; Flow.chal = G.save.chalOpen;
    go('s-entry'); return;
  }
  const p = el.closest<HTMLElement>('[data-content]');
  if (p) { pick[tab] = p.dataset.content as ContentKey; render(); return; }
  const st = el.closest<HTMLElement>('[data-step]');
  if (st) {
    const list = listOf(tab), c = current();
    if (c && list.length > 1) pick[tab] = list[(list.indexOf(c) + Number(st.dataset.step) + list.length) % list.length].key;
    render(); return;
  }
  const df = el.closest<HTMLButtonElement>('[data-diff]');
  if (df) {
    const c = current();
    if (c && !df.disabled) diffPick[c.key] = df.dataset.diff as DiffName;
    render(); return;
  }
  const g = el.closest<HTMLButtonElement>('#contentGo');
  if (g && !g.disabled) {
    const c = current();
    if (!c) return;
    const d = diffOf(c);
    Flow.content = c.key; Flow.diff = d; Flow.tier = 0; Flow.chal = 0;
    if (G.save.tut >= TUT.done) diffPick[c.key] = d;
    go('s-entry');
  }
});
