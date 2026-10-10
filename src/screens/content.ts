/**
 * S03 모험 선택 = 전투 탭 루트 (27 3-1 → 30 시안 Battle30 「B 출정 관문」).
 * 위에서부터: 분류 4칸 (탐험 3인 · 던전 5인 · 10인 레이드 · 20인 레이드. 2026-10-09 Lim: 이벤트 탭을 빼고 레이드를 인원으로 나눔)
 * → 관문 = 아치 금테 안 장소 그림 (28 4장) · 세력 문양 이름표 · 추천 리본 · ‹ › · 정보 줄 (레이드는 이번 주 장비·악몽 열쇠, 13 3-4) · 해제 칩 · 보상 칸
 * → 장소 문양 줄 (고르기, 많으면 가로로 넘김. 던전이면 맨 앞에 주간 도전 고정 칸, 13 3-2) → 난이도 4칸 (별) → 「출전」 = 입장 화면으로.
 * 관문은 어느 분류든 같은 자리·같은 크기 (2026-10-08 Lim: 주간 도전 띠를 관문 위에서 장소 줄로 옮김).
 * 분류마다 마지막 고른 장소, 장소마다 마지막 고른 난이도를 기억 (모듈 변수, 저장 안 함).
 */
import { ALL_DIFFS, CONTENT, contentOf, dispelsOf, raidSize, stageOf, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { AFFIXES } from '../data/affixes';
import { CHAL } from '../data/challenge';
import { FIRST_CLEAR_CRYSTAL, SHARD_MAX } from '../data/economy';
import { avgScore, DROP_TABLE, GRADE_STYLE, ITEM_GRADES, LEGEND_LEVEL, RECOMMENDED } from '../data/equipment';
import { canDispel, DEB_COLOR, HEROES } from '../data/heroes';
import { FACTIONS, PLACES, type FactionKey } from '../data/places';
import { clearGold, EXPLORE_REWARD } from '../data/progression';
import { art, cssUrl } from '../art';
import { weekRemaining } from '../game/clock';
import { raidLootOpen } from '../game/economy';
import { Flow } from '../game/flow';
import { chalGate, runMode, weekAffixes } from '../game/runmode';
import { firstDungeonNow, G, heroNow, lockOf, otherHeroFor } from '../game/state';
import { TUT } from '../game/tutorial';
import { esc, fmt, go, josa, previous, screen, topBar } from './kit';
import { factionMark, gameIcon, LOCK, placeArt } from './art';
import { afxTags } from './brief';

/** 선 아이콘 (시안 Battle30 임시 선그림, 정식 그림이 오면 gameIcon이 바꿈) */
const line = (d: string, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  explore: line('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  dungeon: line('<path d="M4 21V8l3-2 3 2V5h4v3l3-2 3 2v13"/><path d="M10 21v-5a2 2 0 0 1 4 0v5"/>'),
  raid: line('<path d="M6.5 16v-4.5a5.5 5.5 0 0 1 11 0V16l1.5 2h-14z"/><path d="M10 20.5h4"/>'),
  hourglass: line('<path d="M7 3h10M7 21h10M8 3v2c0 3 4 5 4 7s-4 4-4 7v2M16 3v2c0 3-4 5-4 7s4 4 4 7v2"/>', 2.2),
  gear: line('<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12 7l5 5"/>'),
  gold: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="#E8B23A" stroke="#7A5418" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#B9831F" stroke-width="1.6"/></svg>',
  crystal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12l3 5-9 11L3 9z" fill="#7FC8FF" stroke="#1E4A7A" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 9h18M9 4l3 16 3-16" fill="none" stroke="#1E4A7A" stroke-width="1.2"/></svg>',
};
const PREV = line('<path d="M15 6l-6 6 6 6"/>', 2.6);
const NEXT = line('<path d="M9 6l6 6-6 6"/>', 2.6);
const ARROW = '<svg class="g-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** 분류 탭. 레이드는 인원(10·20인)으로 나눔 (콘텐츠 종류는 그대로 raid) */
type Tab = 'explore' | 'dungeon' | 'raid10' | 'raid20';
const KINDS: { kind: Tab; name: string; icon: keyof typeof ICON }[] = [
  { kind: 'explore', name: '탐험', icon: 'explore' },
  { kind: 'dungeon', name: '던전', icon: 'dungeon' },
  { kind: 'raid10', name: '10인 레이드', icon: 'raid' },
  { kind: 'raid20', name: '20인 레이드', icon: 'raid' },
];
/** 탭 그림. 20인 레이드는 icon-raid20이 오면 그것, 없으면 10인과 같은 탑 (그림 요청 33 RS-4 · 40) */
const catIcon = (k: (typeof KINDS)[number]) => (k.kind === 'raid20' && art('icon-raid20') ? gameIcon('raid20', '') : gameIcon(k.icon, ICON[k.icon]));
/** 그 장소가 들어가는 탭 */
const tabOf = (c: ContentDef): Tab => (c.kind === 'raid' ? (raidSize(c) === 20 ? 'raid20' : 'raid10') : c.kind === 'explore' ? 'explore' : 'dungeon');
/** 장소 문양 줄의 짧은 이름 (칸이 좁아서. 관문 이름표엔 전체 이름) */
const SHORT: Partial<Record<ContentKey, string>> = { crypt: '지하묘지', manor: '장원', abyss1: '탑 1층', abyss2: '탑 2층', abyss3: '탑 3층', abyss4: '탑 4층', abyss5: '탑 꼭대기', cathedral1: '대성당 1구역', gull1: '항구 부두', gull2: '항구 주방', gull3: '항구 등대', queen1: '여왕호 갑판', queen2: '여왕호 창고', queen3: '여왕호 뱃머리', isle1: '요새 동굴', isle2: '요새 망루', isle3: '요새 꼭대기',
  fest1: '축제 어귀', fest2: '축제 무대', fest3: '축제 모닥불', cave1: '동굴 이끼굴', cave2: '동굴 연못', cave3: '동굴 뿌리방', palace1: '궁전 정원', palace2: '궁전 연회장', palace3: '궁전 왕좌',
  den1: '굴 갱도', den2: '굴 수레길', den3: '굴 보물방', nest1: '둥지 알둥지', nest2: '둥지 다리', nest3: '둥지 보물더미',
  cathedral2: '대성당 회랑', cathedral3: '대성당 오르간', cathedral4: '대성당 성소',
  bazaar1: '시장 입구', bazaar2: '시장 골목', bazaar3: '시장 성문', abbey1: '수도원 연못', abbey2: '수도원 서고', abbey3: '수도원 제단',
  dusk1: '노을 분수', dusk2: '노을 보물고', dusk3: '노을 옥좌', rootwood1: '숲 입구', rootwood2: '숲 온실', rootwood3: '숲 심장뿌리',
  pyramid1: '피라미드 복도', pyramid2: '피라미드 시계방', pyramid3: '피라미드 침실', reservoir1: '저수지 수문', reservoir2: '저수지 다리', reservoir3: '저수지 거울호수',
  well1: '우물 도르래', well2: '우물 이끼벽', well3: '우물 바닥', post1: '우체국 접수대', post2: '우체국 분류실', post3: '우체국 옥상',
  crystal1: '뿌리굴 갈림길', crystal2: '뿌리굴 수정밭', crystal3: '뿌리굴 거울방', fort1: '성채 성문', fort2: '성채 무기고', fort3: '성채 꼭대기',
  shadow1: '성벽 성문', shadow2: '성벽 성벽길', shadow3: '성벽 망루',
  maze1: '미궁 입구', maze2: '미궁 회랑', maze3: '미궁 중심', camp1: '진영 막사', camp2: '진영 훈련장', camp3: '진영 지휘소',
  coast1: '해안 선착장', coast2: '해안 물길', coast3: '해안 소용돌이' };

/** 마지막으로 고른 분류 (27 3-1) */
let tab: Tab = 'dungeon';
/** 분류마다 마지막 고른 장소 */
const pick: Partial<Record<Tab, ContentKey>> = {};
/** 장소마다 마지막 고른 난이도 */
const diffPick: Partial<Record<ContentKey, DiffName>> = {};
/** 지금 그려져 있는 분류 (장소 줄 넘김 위치를 이어 갈지) */
let drawnTab: Tab | null = null;
/** 다음 그리기에서 고른 장소를 줄 가운데로 (‹ ›) */
let centerNext = false;

const listOf = (k: Tab) => CONTENT.filter(c => !c.hidden && tabOf(c) === k);
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

/** 레이드: 이번 주 장비 받음 (보스마다 난이도별 주 1회) · 악몽 열쇠 (악몽 입장권). 정보 줄 오른쪽에 붙여서 관문 높이를 다른 분류와 맞춤 */
function lootLine(c: ContentDef): string {
  if (c.kind !== 'raid' || G.save.tut < TUT.done) return '';
  const got = ALL_DIFFS.map(d => !raidLootOpen(G.save, c.key, d));
  const dots = `<span class="b-loot" role="img" aria-label="이번 주 장비 ${ALL_DIFFS.map((d, i) => `${d} ${got[i] ? '받음' : '아직'}`).join(', ')}" title="이번 주 장비: 쉬움 · 보통 · 어려움 · 악몽">${got.map(g => `<i${g ? ' class="got"' : ''}></i>`).join('')}</span>`;
  return `<span class="b-lootrow"><span class="cap" aria-hidden="true">장비</span>${dots}<span class="cap"><span class="sr">악몽 </span>열쇠 ${G.save.wallet.shards}/${SHARD_MAX}</span></span>`;
}

/**
 * 추천 리본 (27 3-1): 내 레벨·장비로 「보통 이상 처음 깨기 좋은」 장소 1곳.
 * 콘텐츠마다 아직 안 깬 가장 낮은 난이도(보통부터)를 보고, 레벨이 열림 레벨 이상이고 권장 장비를 채우면 후보. 열림 레벨이 가장 높은 것 (같으면 탐험보다 던전·레이드)
 */
function recommended(): ContentKey | null {
  const lv = G.save.player.level, mine = avgScore(G.save.gear.equipped);
  let best: { k: ContentKey; s: number } | null = null;
  for (const c of CONTENT) {
    if (c.hidden || !c.ready || lockOf(c).locked) continue;
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

/** 지금 고른 장소: 기억한 것 → 추천 → 들어갈 수 있는 첫 장소 → 첫 장소 (장소가 없는 분류면 null) */
function current(): ContentDef | null {
  const list = listOf(tab);
  if (!list.length) return null;
  const rec = recommended();
  const c = list.find(x => x.key === pick[tab]) || list.find(x => x.key === rec) || list.find(x => !isOff(x)) || list[0];
  pick[tab] = c.key;
  return c;
}

/** 고른 난이도: 기억한 것 → (첫 던전 녹슨 요새는 쉬움, 09 4장) → 아직 안 깬 가장 낮은 난이도 (보통부터) → 다 깼으면 열린 가장 높은 난이도 */
function diffOf(c: ContentDef): DiffName {
  const m = diffPick[c.key];
  if (m && !diffLocked(c, m).locked) return m;
  if (c.key === 'rustfort' && firstDungeonNow()) return '쉬움';
  const rec = G.save.clears[c.key] || {};
  let last: DiffName = '보통';
  for (const d of ['보통', '어려움', '악몽'] as DiffName[]) {
    if (diffLocked(c, d).locked) break;
    if (!rec[d]) return d;
    last = d;
  }
  return last;
}

/**
 * 분류 4칸: 아이콘 + 이름 + 인원 (다 잠겼으면 자물쇠 Lv, 장소가 없으면 준비 중).
 * 레이드는 칸이 좁아서 「10인 / 레이드」처럼 인원을 위 줄에 (잠겼으면 아래 줄이 자물쇠 Lv)
 */
function cats(): string {
  return `<nav class="b-cats" role="tablist" aria-label="콘텐츠 분류">${KINDS.map(k => {
    const list = listOf(k.kind);
    const sizes = [...new Set(list.map(c => c.size('보통')))].sort((a, b) => a - b);
    const lv = Math.min(...list.map(c => c.unlockLv));
    const lock = list.length > 0 && list.every(c => lockOf(c).locked);
    const raid = k.icon === 'raid', [top, cap] = raid ? k.name.split(' ') : [k.name, `${sizes.join('·')}인`];
    const sub = !list.length ? '준비 중' : lock ? `${LOCK}Lv ${lv}` : cap;
    const label = `${k.name}${!list.length ? ' · 준비 중' : lock ? ` · Lv ${lv}에 열림` : raid ? '' : ` · ${cap}`}`;
    return `<button type="button" class="b-cat" role="tab" data-ctab="${k.kind}" aria-selected="${k.kind === tab}" aria-label="${label}"><span class="b-ci">${catIcon(k)}</span><span aria-hidden="true"><b>${top}</b><small>${sub}</small></span></button>`;
  }).join('')}</nav>`;
}

/**
 * 주간 도전 칸 (13 3-2): 던전 장소 줄 맨 앞에 고정 (넘기지 않음) + 금빛 구분선. 누르면 고르기가 아니라 바로 도전 입장.
 * 보이는 건 모래시계 · 남은 날 꼬리표 · 「주간 도전」만, 어픽스·최고 단계는 입장 화면에서 (화면 읽기엔 다 넣음). 잠기면 잠긴 장소 칸처럼
 */
function chalCell(): string {
  if (G.save.tut < TUT.done) return '';
  const g = chalGate(G.save), aff = weekAffixes(), best = G.save.weekly.chalBest, left = `${weekRemaining()} 남음`;
  const tag = g.ok ? left.replace(' 남음', '') : `${LOCK}Lv ${g.lv}`;
  const sr = ` 「${esc(CHAL.name)}」 · ${aff.map(k => AFFIXES[k].name).join(', ')} · ${g.ok ? `${g.dev ? '개발 빌드 · ' : ''}최고 ${best ? `${best}단` : '없음'} · ${left}` : `Lv ${g.lv}에 열림`}`;
  return `<button class="b-chal${g.ok ? '' : ' off'}" type="button" data-chal${g.ok ? '' : ' aria-disabled="true"'}>
    <span class="b-hg">${gameIcon('challenge', ICON.hourglass)}</span><span class="b-tg">${tag}</span><small>주간 도전</small><span class="sr">${sr}</span>
  </button><i class="b-div" aria-hidden="true"></i>`;
}

/** 보상 칸 (정산 계산과 같음, stage = 적 레벨 = 내 레벨): 장비 등급 범위 · 골드 (A 등급) · 첫 클리어 크리스탈 + 전설 확률 */
function rewards(c: ContentDef, d: DiffName, stage: number): string {
  const lv = G.save.player.level, table = DROP_TABLE[d];
  const lo = table.findIndex(p => p > 0);
  let hi = table.reduce((m, p, i) => (p > 0 ? i : m), 0);
  // 전설은 Lv 50부터 (그 전엔 영웅으로 나옴)
  if (ITEM_GRADES[hi] === '전설' && lv < LEGEND_LEVEL) hi = ITEM_GRADES.indexOf('영웅');
  const gLo = ITEM_GRADES[lo], gHi = ITEM_GRADES[hi];
  const range = lo >= hi ? gHi : `${gLo}~${gHi}`;
  const gold = Math.round(clearGold(stage, d, 'A', raidSize(c)) * (c.kind === 'explore' && G.save.tut >= TUT.done ? EXPLORE_REWARD : 1));
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
  // 적 레벨 = 내 레벨, 어픽스는 난이도 (32, 2026-10-08)
  const m = runMode(G.save, c, d, { chal: 0 });
  const [region, side] = c.place.split(' · ');
  // 다른 직업으로는 들어갈 수 있으면 자물쇠 대신 그 직업 (34 4장 1번)
  const other = lk.locked ? otherHeroFor(lk.lv) : null;
  const status = !c.ready ? '준비 중' : other ? `${HEROES[other.hero].name}${josa(HEROES[other.hero].name, '으로', '로')} 열림 · Lv ${other.lv}` : lk.locked ? `${LOCK}Lv ${lk.lv}에 열림` : '';
  const art = pa.url
    ? `<img class="b-art${pa.scene ? '' : ' floor'}" src="${pa.url}" alt="${esc(pl.name)}" decoding="async" draggable="false">`
    : `<span class="b-art none" style="--t0:${pl.tone[0]};--t1:${pl.tone[1]}"></span>`;
  return `<section class="b-gate${status ? ' off' : ''}" aria-label="출전할 곳 · ${esc(c.name)}">
    ${art}
    <div class="b-gt"><span class="b-gm" style="--rim:${FACTIONS[f].mark.rim}">${factionMark(f, 'md')}</span><span class="b-gn"><b>${esc(c.name)}</b>${side ? `<small>${esc(side)}</small>` : ''}</span></div>
    ${c.key === recommended() ? '<span class="b-rib">추천</span>' : ''}
    ${many ? `<button type="button" class="b-arw prev" data-step="-1" aria-label="이전 장소">${PREV}</button><button type="button" class="b-arw next" data-step="1" aria-label="다음 장소">${NEXT}</button>` : ''}
    ${status ? `<span class="b-st">${status}</span>` : ''}
    <div class="b-gb">
      <span class="b-row"><span class="b-inf">${esc(region)} · ${c.size(d)}인 · 보스 ${c.bosses.length}</span>${c.ready && !lk.locked ? lootLine(c) : ''}</span>
      <span class="b-row"><span class="cap">해제</span>${dispelChips(c)}${c.ready && m.affixes.length ? `<span class="b-afx" aria-label="${d} 어픽스">${afxTags(m.affixes)}</span>` : ''}</span>
      ${c.ready && lk.dev ? `<span class="f-dev">Lv ${lk.lv} 해금 · 개발 빌드라 열림</span>` : ''}
      ${c.ready ? rewards(c, d, m.stage) : ''}
    </div>
  </section>`;
}

/**
 * 장소 문양 줄: 그 분류의 장소들 (누르면 관문이 바뀜). 준비 중 = 회색 + 「준비」, 잠김 = 자물쇠, 추천 = 빨간 「추천」.
 * 다 들어가면 가운데, 넘치면 가로로 넘김 (칸 너비는 sizePlaces: 늘 반 칸이 걸쳐 보여서 더 있는 걸 알 수 있음). lead = 맨 앞 고정 칸 (던전 = 주간 도전)
 */
function places(list: ContentDef[], cur: ContentDef, lead = ''): string {
  const rec = recommended();
  return `<nav class="b-places${lead ? ' lead' : ''}" aria-label="장소">${lead}<div class="b-plr">${list.map(x => {
    const lk = lockOf(x), on = x.key === cur.key;
    const st = !x.ready ? ' off' : lk.locked ? ' lock' : '';
    const tag = !x.ready ? '<span class="b-tg">준비</span>' : lk.locked ? `<span class="b-tg">${LOCK}Lv ${lk.lv}</span>` : x.key === rec ? '<span class="b-tg rec">추천</span>' : '';
    const label = `${x.name}${!x.ready ? ' · 준비 중' : lk.locked ? ` · Lv ${lk.lv}에 열림` : x.key === rec ? ' · 추천' : ''}`;
    return `<button type="button" class="b-pl${on ? ' on' : ''}${st}" data-content="${x.key}" aria-pressed="${on}" aria-label="${esc(label)}"><span class="b-r">${factionMark(factionOf(x), 'md')}</span>${tag}<small>${esc(SHORT[x.key] || x.name)}</small></button>`;
  }).join('')}</div></nav>`;
}

/** 칸 너비: 보이는 폭에 「n칸 반」이 들어가게 (58~64px). 넘칠 때 마지막 칸이 딱 맞게 끝나서 더 있는 줄 모르는 일을 막음 */
function sizePlaces(): void {
  const sc = s.el.querySelector<HTMLElement>('.b-plr');
  if (!sc) return;
  const vis = sc.clientWidth - parseFloat(getComputedStyle(sc).paddingLeft);
  const w = Math.min(64, Math.max(58, vis / (Math.floor(vis / 64) + 0.5) - 4));
  (sc.parentElement as HTMLElement).style.setProperty('--pl-w', `${w.toFixed(1)}px`);
}

/** 장소 줄 양끝 흐림: 그쪽으로 더 넘길 칸이 있을 때만 (l · r) */
function placeFade(sc: HTMLElement): void {
  const max = sc.scrollWidth - sc.clientWidth;
  (sc.parentElement as HTMLElement).dataset.more = `${sc.scrollLeft > 2 ? 'l' : ''}${sc.scrollLeft < max - 2 ? 'r' : ''}`;
}

/**
 * 장소 줄 넘김 위치. from = 다시 그리기 전 위치 (null = 들어올 때·분류를 바꿀 때 → 고른 칸을 바로 가운데로).
 * center = ‹ ›로 넘김 → 고른 칸을 가운데로 부드럽게. 아니면 (줄에서 직접 누름·난이도) 자리 그대로, 반쯤 가려진 칸만 다 보이게
 */
function scrollPlaces(from: number | null, center: boolean): void {
  const sc = s.el.querySelector<HTMLElement>('.b-plr');
  if (!sc) return;
  sizePlaces();
  const it = sc.querySelector<HTMLElement>('.b-pl.on'), max = sc.scrollWidth - sc.clientWidth;
  const clamp = (x: number) => Math.max(0, Math.min(max, x));
  if (from !== null) sc.scrollLeft = from;
  if (it && max > 0) {
    const mid = clamp(it.offsetLeft - (sc.clientWidth - it.offsetWidth) / 2);
    const pad = 12, l = it.offsetLeft - pad, r = it.offsetLeft + it.offsetWidth + pad - sc.clientWidth;
    const to = from === null || center ? mid : l < from ? clamp(l) : r > from ? clamp(r) : from;
    if (from === null) sc.scrollLeft = to;
    else if (Math.abs(to - from) > 1) sc.scrollTo({ left: to, behavior: 'smooth' });
  }
  placeFade(sc);
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
  const sub = !c ? '준비 중' : !c.ready ? `${c.name} · 준비 중` : lk!.locked ? `${c.name} · Lv ${lk!.lv}에 열림` : `${c.name} · ${d}`;
  const mk = c ? factionMark(factionOf(c), 'md') : '';
  return `<button type="button" class="g-cta" id="contentGo"${ok ? '' : ' disabled'}><span class="g-mk">${mk}</span><span class="g-ct"><b>출전</b><small>${esc(sub)}</small></span>${ARROW}</button>`;
}

const s = screen('s-content', '모험 선택', {
  tab: 'battle',
  // arg = 열 분류 (로비: 주간 도전 → dungeon, 첨탑 → raid10). 없으면 마지막 고른 분류
  enter(arg) {
    if (KINDS.some(t => t.kind === arg)) tab = arg as Tab;
    // 편성에서 돌아오면 그 장소·난이도가 골라진 채로 (로비 「바로 출전」으로 갔다 와도. 주간 도전은 따로)
    if (previous === 's-party' && !Flow.chal && G.save.tut >= TUT.done) {
      const c = contentOf(Flow.content);
      if (!c.hidden) { tab = tabOf(c); pick[tab] = c.key; diffPick[c.key] = Flow.diff; }
    }
    // 첫 던전 안내 차례면 녹슨 요새를 짚어 줌 (분류를 골라 들어왔거나 편성에서 돌아오면 그대로)
    else if (!arg && firstDungeonNow()) { tab = 'dungeon'; pick.dungeon = 'rustfort'; }
    render(false);
  },
});

/** keep = 화면 안에서 다시 그림 (스크롤·포커스 유지) */
function render(keep = true): void {
  const body = s.el.querySelector<HTMLElement>('.b-body');
  const top = keep && body ? body.scrollTop : 0;
  // 장소 줄 위치: 같은 분류 안에서 다시 그리면 이어서 (분류가 바뀌면 처음부터)
  const plr = s.el.querySelector<HTMLElement>('.b-plr');
  const plFrom = keep && plr && drawnTab === tab ? plr.scrollLeft : null;
  const plCenter = centerNext;
  drawnTab = tab; centerNext = false;
  const a = document.activeElement as HTMLElement | null;
  const focus = keep && a && s.el.contains(a) ? ['data-ctab', 'data-content', 'data-step', 'data-diff'].filter(n => a.hasAttribute(n)).map(n => `[${n}="${a.getAttribute(n)}"]`)[0] || (a.id ? `#${a.id}` : '') : '';

  const list = listOf(tab), c = current(), d = c ? diffOf(c) : '보통';
  const tut = tab === 'dungeon' && c?.key === 'rustfort' && firstDungeonNow();
  const tip = tut ? '<p class="coachtip b-tip"><b>녹슨 요새</b> 쉬움으로 출전. 일반·정예 구간 둘, 보스 둘을 이어서 진행</p>' : '';
  s.el.style.setProperty('--b-bg', c ? cssUrl(placeArt(c.key).url) : 'none');
  s.el.innerHTML = `${topBar({ settings: true })}
    <div class="ns-body b-body">${tip}${cats()}${c ? gate(c, d, list.length > 1) + places(list, c, tab === 'dungeon' ? chalCell() : '') + diffs(c, d) : ''}</div>
    <footer class="b-foot">${cta(c, d)}</footer>`;
  if (tut) s.el.querySelector('#contentGo')?.classList.add('hi-pulse');
  const nb = s.el.querySelector<HTMLElement>('.b-body');
  if (nb) nb.scrollTop = top;
  scrollPlaces(plFrom, plCenter);
  if (focus) s.el.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
}

// 화면 크기가 바뀌면 (회전 등) 칸 너비·흐림 다시
addEventListener('resize', () => {
  const sc = s.el.querySelector<HTMLElement>('.b-plr');
  if (!s.el.hidden && sc) { sizePlaces(); placeFade(sc); }
});

// 장소 줄을 넘길 때 양끝 흐림 다시 계산 (scroll은 거품이 안 올라와서 capture)
s.el.addEventListener('scroll', e => {
  const t = e.target as HTMLElement;
  if (t.classList?.contains('b-plr')) placeFade(t);
}, { capture: true, passive: true });

s.el.addEventListener('click', e => {
  const el = e.target as HTMLElement;
  const t = el.closest<HTMLElement>('[data-ctab]');
  if (t) { tab = t.dataset.ctab as Tab; render(); return; }
  const ch = el.closest<HTMLElement>('[data-chal]');
  if (ch) {
    if (ch.getAttribute('aria-disabled') === 'true') return;
    Flow.content = CHAL.content; Flow.diff = CHAL.diff; Flow.chal = G.save.chalOpen;
    go('s-entry'); return;
  }
  const p = el.closest<HTMLElement>('[data-content]');
  if (p) { pick[tab] = p.dataset.content as ContentKey; render(); return; }
  const st = el.closest<HTMLElement>('[data-step]');
  if (st) {
    const list = listOf(tab), c = current();
    if (c && list.length > 1) pick[tab] = list[(list.indexOf(c) + Number(st.dataset.step) + list.length) % list.length].key;
    centerNext = true;
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
    Flow.content = c.key; Flow.diff = d; Flow.chal = 0;
    if (G.save.tut >= TUT.done) diffPick[c.key] = d;
    // 입장 화면 없이 바로 편성 (2026-10-08): 난이도는 여기서만 고름, 공략은 편성의 시트
    Flow.party = null; Flow.rerolls = 0;
    go('s-party');
  }
});
