/**
 * S03 모험 선택 = 전투 탭 루트 (27 3-1 → 30 시안 Battle30 「B 출정 관문」).
 * 분류 4칸 → 작은 장소 풍경/권장 레벨 → 장소 줄 → 난이도 → 출전.
 * 장소 줄 (2026-10-12 Lim: 지역 → 장소 팝업 없이 한 단계로): 그 분류의 장소를 열림 레벨 순서대로 바로 고름.
 * 레벨이 모자란 장소는 숨기고 레벨이 되면 보여 줌. 다 잠긴 분류는 다음에 열릴 한 곳만 잠긴 채로 보여 줌.
 * 장면 안 보상 아이콘을 누르면 그 보상의 확률만 표시. 주간 도전은 던전 분류 바로 아래 독립 버튼.
 * 분류마다 장소, 장소마다 난이도와 장소 줄의 가로 위치를 기억한다 (모듈 변수, 저장 안 함). 화면 세로 스크롤은 없다.
 * 모험 길잡이 (86): 추천 칸 (game/guide)이 바뀌었으면 들어올 때 그 분류 · 장소 · 난이도를 고른 채로. 분류 탭 점 · 장소 카드 「추천」 ·
 * 난이도 칸 적합도 (여유 · 적정 · 도전 · 위험)와 「추천」.
 */
import { adventureContents, adventureRegionOf, adventureTabOf, type AdventureTab } from '../data/adventure-regions';
import { ALL_DIFFS, contentOf, isLeveling, raidSize, stageOf, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { AFFIXES } from '../data/affixes';
import { CHAL } from '../data/challenge';
import { GRADE_STYLE, ITEM_GRADES, type ItemGrade } from '../data/equipment';
import { gearGradeOdds } from '../data/reward-preview';
import { HEROES } from '../data/heroes';
import { FACTIONS, PLACES, type FactionKey } from '../data/places';
import { clearGold, EXPLORE_DROP, EXPLORE_REWARD, restRun } from '../data/progression';
import { art, cssUrl } from '../art';
import { weekRemaining } from '../game/clock';
import { raidLootOpen } from '../game/economy';
import { restBase } from '../game/stamina';
import { Flow } from '../game/flow';
import { fitNow, fitShown, FIT_TEXT, guide, guideCtx, rankStages, recLevel, type Stage } from '../game/guide';
import { chalGate, runMode, weekAffixes } from '../game/runmode';
import { firstDungeonNow, G, heroNow, lockOf, otherHeroFor, refreshDay } from '../game/state';
import { TUT, tutLockedContent } from '../game/tutorial';
import { esc, fmt, freshEntry, go, goingBack, previous, screen, topBar } from './kit';
import { classEmblem, currencyIcon, departureArrow, factionMark, gameIcon, LOCK, placeArt, type CurrencyIconKey } from './art';
import { sortie } from './stamina';

/** 선 아이콘 (시안 Battle30 임시 선그림, 정식 그림이 오면 gameIcon이 바꿈) */
const line = (d: string, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  explore: line('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  dungeon: line('<path d="M4 21V8l3-2 3 2V5h4v3l3-2 3 2v13"/><path d="M10 21v-5a2 2 0 0 1 4 0v5"/>'),
  raid: line('<path d="M6.5 16v-4.5a5.5 5.5 0 0 1 11 0V16l1.5 2h-14z"/><path d="M10 20.5h4"/>'),
  hourglass: line('<path d="M7 3h10M7 21h10M8 3v2c0 3 4 5 4 7s-4 4-4 7v2M16 3v2c0 3-4 5-4 7s4 4 4 7v2"/>', 2.2),
  gear: line('<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12 7l5 5"/>'),
};
const PREV = line('<path d="M15 6l-6 6 6 6"/>', 2.6);
const NEXT = line('<path d="M9 6l6 6-6 6"/>', 2.6);

/** 분류 탭. 레이드는 인원(10·20인)으로 나눔 (콘텐츠 종류는 그대로 raid) */
type Tab = AdventureTab;
const KINDS: { kind: Tab; name: string; icon: keyof typeof ICON }[] = [
  { kind: 'explore', name: '탐험', icon: 'explore' },
  { kind: 'dungeon', name: '던전', icon: 'dungeon' },
  { kind: 'raid10', name: '10인 레이드', icon: 'raid' },
  { kind: 'raid20', name: '20인 레이드', icon: 'raid' },
];
/** 탭 그림. 20인 레이드는 icon-raid20이 오면 그것, 없으면 10인과 같은 탑 (그림 요청 33 RS-4 · 40) */
const catIcon = (k: (typeof KINDS)[number]) => (k.kind === 'raid20' && art('icon-raid20') ? gameIcon('raid20', '') : gameIcon(k.icon, ICON[k.icon]));
/** 그 장소가 들어가는 탭 */
const tabOf = adventureTabOf;
/**
 * 장소 카드의 짧은 이름 (카드가 좁아서 두 줄이 되면 오른쪽 위 Lv와 겹침. 관문 이름표·출전 버튼엔 전체 이름).
 * 레이드는 시설 이름을 줄이고 구역 이름은 그대로 (예전 장소 문양 줄의 짧은 이름)
 */
const SHORT: Partial<Record<ContentKey, string>> = {
  cultcamp: '교단 야영지', rosemaze: '장미 미로', icefish: '얼음 낚시터', emberfoot: '봉우리 기슭', oasis: '오아시스', stormmeadow: '번개 목초지',
  apothecary: '약품 제조실', reedvillage: '갈대 마을', lilypalace: '수련궁', granary: '곡물창고', smuggler: '밀수굴', smithy: '불꽃 공방',
  sandlibrary: '서기관 도서관', flightyard: '비행 훈련장', sunkrose: '장미 정원', ballroom: '무도회장',
  abyss1: '탑 1층', abyss2: '탑 2층', abyss3: '탑 3층', abyss4: '탑 4층', abyss5: '탑 꼭대기',
  gull1: '항구 부두', gull2: '항구 주방', gull3: '항구 등대', queen1: '여왕호 갑판', queen2: '여왕호 창고', queen3: '여왕호 뱃머리',
  isle1: '요새 동굴', isle2: '요새 망루', isle3: '요새 꼭대기', fest1: '축제 어귀', fest2: '축제 무대', fest3: '축제 모닥불',
  cave1: '동굴 이끼굴', cave2: '동굴 연못', cave3: '동굴 뿌리방', palace1: '궁전 정원', palace2: '궁전 연회장', palace3: '궁전 왕좌',
  den1: '굴 갱도', den2: '굴 수레길', den3: '굴 보물방', nest1: '둥지 알둥지', nest2: '둥지 다리', nest3: '둥지 보물더미',
  dusk1: '노을 분수', dusk2: '노을 보물고', dusk3: '노을 옥좌', pyramid1: '피라미드 복도', pyramid2: '피라미드 시계방', pyramid3: '피라미드 침실',
  post1: '우체국 접수대', post2: '우체국 분류실', post3: '우체국 옥상', fort1: '성채 성문', fort2: '성채 무기고', fort3: '성채 꼭대기',
  maze1: '미궁 입구', maze2: '미궁 회랑', maze3: '미궁 중심',
  cathedral1: '대성당 1구역', cathedral2: '대성당 회랑', cathedral3: '대성당 오르간', cathedral4: '대성당 성소',
  abbey1: '수도원 연못', abbey2: '수도원 서고', abbey3: '수도원 제단', rootwood1: '숲 입구', rootwood2: '숲 온실', rootwood3: '숲 심장뿌리',
  reservoir1: '저수지 수문', reservoir2: '저수지 다리', reservoir3: '저수지 거울호수', well1: '우물 도르래', well2: '우물 이끼벽', well3: '우물 바닥',
  crystal1: '뿌리굴 갈림길', crystal2: '뿌리굴 수정밭', crystal3: '뿌리굴 거울방', shadow1: '성벽 성문', shadow2: '성벽 성벽길', shadow3: '성벽 망루',
  camp1: '진영 막사', camp2: '진영 훈련장', camp3: '진영 지휘소', coast1: '해안 선착장', coast2: '해안 물길', coast3: '해안 소용돌이',
  heart1: '심장 뿌리다리', heart2: '심장문', heart3: '심실',
};
/** 지금 분류. 메뉴에 새로 들어오면 첫 칸 탐험 (2026-10-21 Lim 「항상 첫번째 탭」, 예전 27 3-1은 마지막으로 고른 분류) */
let tab: Tab = KINDS[0].kind;
/** 분류마다 마지막 고른 장소 */
const pick: Partial<Record<Tab, ContentKey>> = {};
/** 장소마다 마지막 고른 난이도 */
const diffPick: Partial<Record<ContentKey, DiffName>> = {};
/** 지금 그려져 있는 분류 (장소 줄 넘김 위치를 이어 갈지) */
let drawnTab: Tab | null = null;
let drawnViewport = '';
/** 확률 안내는 작고 독립적인 popover이며 출전 선택을 바꾸지 않는다. */
let rewardKey: string | null = null;
/** 다음 그리기에서 고른 장소를 가로 줄 가운데로 (‹ › · 화면 크기 변화) */
let centerNext = false;
/** 지금 그리는 추천 칸 (render마다 다시 셈) · 마지막으로 화면을 옮겨 준 추천 (같은 추천이면 고른 것을 그대로 둠) */
let gd: Stage | null = null;
let shownGuide = '';

const viewportStamp = () => `${s.el.clientWidth}/${s.el.clientHeight}/${innerWidth}/${innerHeight}/${visualViewport?.width}/${visualViewport?.height}`;

// 열림 레벨 순 (같으면 원래 순서). 새 장소가 레벨 사이사이에 끼게 (62)
const listOf = adventureContents;
const factionOf = (c: ContentDef): FactionKey => PLACES[placeArt(c.key).place].faction;
/** 준비 중이거나 레벨이 모자라 못 들어가는 장소 */
const isOff = (c: ContentDef) => !c.ready || lockOf(c).locked;
/** 장소 줄에 보이는 장소: 들어갈 수 있는 곳만 레벨 순. 하나도 없으면 다음에 열릴 한 곳 (잠긴 채로, 분류 화면이 비지 않게) */
function shownOf(t: Tab): ContentDef[] {
  const all = listOf(t), open = all.filter(c => !isOff(c));
  return open.length ? open : all.slice(0, 1);
}
/**
 * 그 난이도만 따로 잠김: 10인 악몽 Lv 50 등 · 탐험 · 던전은 앞 난이도를 아직 못 깸 (need, 61 1-1).
 * 장소 자체가 레벨로 잠긴 건 보상 보기로 고를 수 있게 둠
 */
function diffLocked(c: ContentDef, d: DiffName): { locked: boolean; lv: number; need: DiffName | null } {
  const l = lockOf(c, d);
  if (l.locked && !l.dev && G.save.player.level < l.lv && l.lv > c.unlockLv) return { locked: true, lv: l.lv, need: null };
  const chain = !!l.need && !lockOf(c).locked;
  return { locked: chain, lv: l.lv, need: chain ? l.need : null };
}

/** 세력 문양 (색 = 시안 Parts27 문양 색). 입장 화면 머리도 씀 */
export function markHtml(c: ContentDef, size: 'sm' | 'md' | 'lg' = 'lg'): string {
  const f = factionOf(c), m = FACTIONS[f].mark;
  return `<span class="f-em${m.dark ? ' dark' : ''}" style="--rim:${m.rim};--glyph:${m.glyph}">${factionMark(f, size)}</span>`;
}

/** 그 난이도 최고 별 (★☆ 3칸) */
function stars(c: ContentDef, d: DiffName): string {
  const n = G.save.clears[c.key]?.[d]?.stars || 0;
  return `<span class="sr">별 ${n}개</span><span aria-hidden="true">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</span>`;
}

/** 레이드: 이번 주 첫 클리어 보상 받음 (칸 = 보스 × 난이도, 2026-10-19 Lim 「주 첫 판만 크게」). 정보 줄 오른쪽에 붙여서 관문 높이를 다른 분류와 맞춤. 휴식은 전투 전에 안 보여 줌 (90 · 2026-10-17) */
function lootLine(c: ContentDef): string {
  if (c.kind !== 'raid' || G.save.tut < TUT.done) return '';
  const got = ALL_DIFFS.map(d => !raidLootOpen(G.save, c.key, d));
  const dots = `<span class="b-loot" role="img" aria-label="이번 주 첫 보상 ${ALL_DIFFS.map((d, i) => `${d} ${got[i] ? '받음' : '아직'}`).join(', ')}" title="이번 주 첫 클리어 보상: 쉬움 · 보통 · 어려움 · 악몽">${got.map(g => `<i${g ? ' class="got"' : ''}></i>`).join('')}</span>`;
  return `<span class="b-lootrow"><span class="cap" aria-hidden="true">주간</span>${dots}</span>`;
}

/** 지금 고른 장소 (장소 줄 안에서): 기억한 것 → 길잡이 추천 (86) → 첫 장소 (장소가 없는 분류면 null) */
function current(): ContentDef | null {
  const list = shownOf(tab);
  if (!list.length) return null;
  const c = list.find(x => x.key === pick[tab]) || list.find(x => x.key === gd?.content) || list[0];
  selectContent(c);
  return c;
}

function selectContent(c: ContentDef): void {
  pick[tab] = c.key;
}

/**
 * 고른 난이도: 기억한 것 → (첫 던전 녹슨 요새는 쉬움, 09 4장) → 길잡이가 이 장소에서 고르는 난이도 (86: 추천 칸이면 그 난이도, 아니면 이 장소의 적정 칸 가운데 길잡이 순서로 첫 칸)
 * → 아직 안 깬 가장 낮은 열린 난이도 (탐험 · 던전은 쉬움부터, 레이드는 보통부터) → 다 깼으면 열린 가장 높은 난이도
 */
function diffOf(c: ContentDef): DiffName {
  const m = diffPick[c.key];
  if (m && !diffLocked(c, m).locked) return m;
  if (c.key === 'rustfort' && firstDungeonNow()) return '쉬움';
  if (gd?.content === c.key) return gd.diff;
  const here = isLeveling(c) ? rankStages(guideCtx()).find(x => x.content === c.key && fitNow(c, x.diff) === '적정') : null;
  if (here && !diffLocked(c, here.diff).locked) return here.diff;
  const rec = G.save.clears[c.key] || {}, lvl = isLeveling(c);
  let last: DiffName = lvl ? '쉬움' : '보통';
  for (const d of (lvl ? ALL_DIFFS : ['보통', '어려움', '악몽']) as DiffName[]) {
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
    const rec = !!gd && k.kind !== tab && tabOf(contentOf(gd.content)) === k.kind;
    return `<button type="button" class="b-cat" role="tab" data-ctab="${k.kind}" aria-selected="${k.kind === tab}" aria-label="${label}${rec ? ' · 추천 있음' : ''}"><span class="b-ci">${catIcon(k)}</span><span class="b-cl" aria-hidden="true"><b>${top}</b><small>${sub}</small></span>${rec ? '<i class="b-rec-dot" aria-hidden="true"></i>' : ''}</button>`;
  }).join('')}</nav>`;
}

/**
 * 주간 도전: 던전 분류 아래 독립 진입. 작은 커버에서는 지역 줄 왼쪽에 고정한다. 누르면 바로 도전 입장.
 * 보이는 건 모래시계 · 남은 날 꼬리표 · 「주간 도전」만, 어픽스·최고 단계는 입장 화면에서 (화면 읽기엔 다 넣음). 잠기면 잠긴 장소 칸처럼
 */
function chalCell(): string {
  if (G.save.tut < TUT.done) return '';
  const g = chalGate(G.save), aff = weekAffixes(), best = G.save.weekly.chalBest, left = `${weekRemaining()} 남음`;
  const tag = g.ok ? left.replace(' 남음', '') : `${LOCK}Lv ${g.lv}`;
  const sr = ` 「${esc(CHAL.name)}」 · ${aff.map(k => AFFIXES[k].name).join(', ')} · ${g.ok ? `${g.dev ? '개발 빌드 · ' : ''}최고 ${best ? `${best}단` : '없음'} · ${left}` : `Lv ${g.lv}에 열림`}`;
  return `<button class="b-chal${g.ok ? '' : ' off'}" type="button" data-chal${g.ok ? '' : ' aria-disabled="true"'}>
    <span class="b-hg">${gameIcon('challenge', ICON.hourglass)}</span><span class="b-tg">${tag}</span><small>주간 도전</small><span class="b-weekly-arrow" aria-hidden="true">${NEXT}</span><span class="sr">${sr}</span>
  </button>`;
}

interface SceneReward {
  key: string;
  name: string;
  label: string;
  icon: string;
  color: string;
  probability: number;
  basis: string;
  maxGrade?: ItemGrade;
  gradeOdds?: Record<ItemGrade, number>;
}

/** 기본 A 평가 기준. 공개모집·주간 도전 보너스는 편성 전 확정되지 않으므로 제외한다. */
function rewardItems(c: ContentDef, d: DiffName): SceneReward[] {
  const raid = raidSize(c), play = G.save.tut >= TUT.done;
  // 등급대 · 영웅 레벨 (88 · 103): 탐험 · 던전은 장소 레벨, 레이드는 그 레이드 레벨 (settle dropLv, #296). 레이드 칸 주 첫 보상을 받았으면 다시 깬 판 표 (던전 표)
  const lootOpen = !play || !raid || raidLootOpen(G.save, c.key, d);
  const lv = G.save.player.level, odds = gearGradeOdds(d, raid, lv, 'A', false, raid ? stageOf(c, d) : c.stageLv, !lootOpen);
  const maxGrade = [...ITEM_GRADES].reverse().find(g => odds[g] > 0) ?? ITEM_GRADES[0];
  // 칸마다 최소 등급 (88 v0.2, Lim 「칸마다 난이도 및 레벨에 따라서 최소 등급」): 확률 창 아래 한 줄
  const minG = ITEM_GRADES.find(g => odds[g] > 0) ?? ITEM_GRADES[0];
  // 탐험은 판마다 장비 EXPLORE_DROP (103 「탐험만 줄임」, 튜토리얼 판은 언제나): 등급별 확률은 장비가 나왔을 때
  const dropP = play && c.kind === 'explore' ? EXPLORE_DROP : 1;
  const items: SceneReward[] = [{
    key: 'gear', name: '장비 등급별 확률', label: maxGrade, icon: gameIcon('gear', ICON.gear),
    color: GRADE_STYLE[maxGrade].color, probability: dropP, maxGrade,
    gradeOdds: odds,
    // 등급표 + 최소 등급 (2026-10-13 Lim: 「장비 1개 · 보너스 제외」 빼기). 레이드는 주 첫 클리어 · 다시 깬 판
    basis: `최소 ${minG}${dropP < 1 ? ` · 장비는 판마다 ${Math.round(dropP * 100)}%` : ''}${raid && play ? (lootOpen ? ' · 이번 주 첫 클리어' : ' · 다시 깬 판 (첫 보상은 받음)') : ''}`,
  }];
  const currency = (key: CurrencyIconKey, name: string, amount: number, color: string, basis = '클리어 시', probability = 1) => {
    items.push({ key, name, label: fmt(amount), icon: currencyIcon(key), color, probability, basis });
  };
  // 클리어 골드 (91, #172 전과 같은 칸): 이 판 적 레벨 · A 평가, 탐험은 EXPLORE_REWARD.
  // 기본 값 (90 · 2026-10-17 Lim): 휴식이 없을 때 받는 값 (휴식 판 restRun의 1/REST_BONUS). 휴식 보너스는 결과 화면에서만. 튜토리얼 판은 예전 값 그대로
  const stage = runMode(G.save, c, d, { chal: 0 }).stage;
  const raw = clearGold(stage, d, 'A', raid) * (play && c.kind === 'explore' ? EXPLORE_REWARD : 1);
  currency('gold', '골드', play ? restBase(restRun(raw)) : Math.round(raw), '#DDB563', '클리어 시 · A 평가');
  return items;
}

/** 장비는 최고 획득 가능 등급 색상의 아이콘 하나로 표시하고, 누르면 등급별 확률을 보여 준다. */
function rewards(c: ContentDef, d: DiffName): string {
  return `<section class="b-scene-rewards" aria-label="획득 보상">
    <div class="b-scene-rewards-heading"><b>획득 보상</b></div>
    <div class="b-scene-reward-list">${rewardItems(c, d).map(r => `<button type="button" class="b-scene-reward${r.probability ? '' : ' received'}" data-reward="${r.key}" data-probability="${r.probability}"${r.maxGrade ? ` data-max-grade="${r.maxGrade}"` : ''} style="--reward-color:${r.color}" aria-label="${esc(r.maxGrade ? `장비 · ${r.probability ? `최고 ${r.maxGrade}` : '이번 주 수령 완료'} · 등급별 확률 보기` : `${r.name} · 획득 확률 보기`)}" aria-haspopup="dialog" aria-expanded="false" aria-controls="bRewardChance">
      <span class="b-scene-reward-icon">${r.icon}</span><small>${r.label}</small></button>`).join('')}</div>
    ${lootLine(c)}
  </section>`;
}

/** 작은 풍경 미리보기. 장소와 권장 레벨 (92: 그 칸을 맞춘 플레이어 레벨, 순차 구간 장소는 길에서 들어가는 레벨)만 크게 표시한다. */
function gate(c: ContentDef, d: DiffName, many: boolean): string {
  const pa = placeArt(c.key), lk = lockOf(c), pl = PLACES[pa.place];
  const other = lk.locked ? otherHeroFor(lk.lv) : null;
  const status = !c.ready ? '준비 중' : other ? `${HEROES[other.hero].name} Lv ${other.lv}로 입장 가능` : lk.locked ? `Lv ${lk.lv}에 열림` : '';
  const scene = pa.url ? `<img class="b-art${pa.scene ? '' : ' floor'}" src="${pa.url}" alt="${esc(pl.name)}" decoding="async" draggable="false">` : '';
  return `<section class="b-gate${status ? ' off' : ''}" aria-label="출전할 곳 · ${esc(c.name)}">
    ${scene}<div class="b-gate-shade"></div>
    <div class="b-gt"><span class="b-gn">${adventureRegionOf(c).name === c.name ? '' : `<small>${esc(adventureRegionOf(c).name)}</small>`}<b>${esc(c.name)}</b></span></div>
    <div class="b-level" aria-label="권장 레벨 ${recLevel(c, d)}"><span>권장 레벨</span><strong><small>Lv.</small> ${recLevel(c, d)}</strong></div>
    ${many ? `<button type="button" class="b-arw prev" data-step="-1" aria-label="이전 장소">${PREV}</button><button type="button" class="b-arw next" data-step="1" aria-label="다음 장소">${NEXT}</button>` : ''}
    ${status ? `<span class="b-st">${lk.locked && !other ? LOCK : ''}${status}</span>` : ''}
    ${rewards(c, d)}
  </section>`;
}

/**
 * 장소 줄: 그 분류의 장소를 열림 레벨 순으로 (shownOf). 누르면 바로 그 장소 (팝업 없음).
 * 카드 모양은 예전 지역 카드 그대로 (b-region: 풍경 + 이름 + 오른쪽 위 열림 Lv)
 */
function placeRow(c: ContentDef): string {
  return `<section class="b-region-section" aria-labelledby="bRegionTitle">
    <div class="b-section-title"><h2 id="bRegionTitle">장소 선택</h2></div>
    <nav class="b-regions" aria-label="${esc(KINDS.find(k => k.kind === tab)!.name)} 장소">${shownOf(tab).map(x => {
      const on = x.key === c.key, off = isOff(x), rec = gd?.content === x.key;
      const label = `${x.name} · ${!x.ready ? '준비 중' : off ? `Lv ${lockOf(x).lv}에 열림` : `Lv ${x.unlockLv}`}${rec ? ` · 추천 ${gd!.diff}` : ''}`;
      return `<button type="button" class="b-region${on ? ' on' : ''}${rec ? ' rec' : ''}" data-content="${x.key}" aria-pressed="${on}" aria-label="${esc(label)}">
        <img src="${placeArt(x.key).url}" alt="" loading="lazy" decoding="async"><span class="b-region-name">${esc(SHORT[x.key] ?? x.name)}</span><small>Lv ${x.unlockLv}</small>${rec ? '<span class="b-rec" aria-hidden="true">추천</span>' : ''}</button>`;
    }).join('')}</nav>
  </section>`;
}

/**
 * 난이도 4칸: 이름 + 별. 그 난이도만 잠겼으면 자물쇠 Lv, 앞 난이도를 못 깼으면 자물쇠 「쉬움 깨기」 (61 1-1). 준비 중 장소는 못 고름.
 * 열린 칸 위 꼬리표 (86): 길잡이 추천 칸은 「추천」, 나머지는 적합도 (여유 · 적정 · 도전 · 위험, 내 레벨 · 장비 기준).
 * 지금 레벨로 못 들어가는 칸 (장소 · 난이도 레벨 잠금, 개발 빌드로 연 곳)은 꼬리표 없이 잠금 표시만 (fitShown)
 */
function diffs(c: ContentDef, d: DiffName): string {
  return `<div class="b-df" role="group" aria-label="난이도">${ALL_DIFFS.map(x => {
    const l = diffLocked(c, x), dis = !c.ready || l.locked, on = c.ready && x === d;
    const sub = !c.ready || !l.locked ? stars(c, x) : l.need ? `${LOCK}${l.need} 깨기<span class="sr">면 열림</span>` : `${LOCK}Lv ${l.lv}`;
    const fit = dis ? null : fitShown(c, x), rec = !dis && gd?.content === c.key && gd.diff === x;
    const tag = rec ? '<span class="b-fit rec" aria-hidden="true">추천</span>' : fit ? `<span class="b-fit" data-fit="${fit}" aria-hidden="true">${fit}</span>` : '';
    const sr = fit ? `<span class="sr"> · ${rec ? '추천 · ' : ''}${fit} (${FIT_TEXT[fit]})</span>` : '';
    return `<button type="button" class="b-dc${on ? ' on' : ''}" data-diff="${x}"${fit ? ` data-fit="${fit}"` : ''} aria-pressed="${on}"${dis ? ' disabled' : ''}>${x}<small>${sub}</small>${sr}${tag}</button>`;
  }).join('')}</div>`;
}

/** 출전: 내 직업 문장 + 「출전」 한 줄. 장소 · 난이도는 접근성 이름으로 제공한다. */
function cta(c: ContentDef | null, d: DiffName): string {
  const lk = c ? lockOf(c, d) : null, tutOff = !!c && tutLockedContent(G.save, c.key); // 튜토리얼 중엔 튜토리얼 판만 (103)
  const ok = !!c && c.ready && !lk!.locked && !tutOff;
  const sub = !c ? '준비 중' : !c.ready ? `${c.name} · 준비 중` : tutOff ? `${c.name} · 튜토리얼을 마치면 출전` : lk!.locked ? (lk!.need && !lockOf(c).locked ? `${c.name} · ${lk!.need}부터 깨기` : `${c.name} · Lv ${lk!.lv}에 열림`) : `${c.name} · ${d}`;
  const mk = classEmblem(heroNow(), 'md');
  // 휴식 (클리어 때 쓰는 몫)은 전투 전에 안 보여 줌 (90 · 2026-10-17 Lim: 출전 전 휴식 팝업 · 출발 버튼 휴식과 함께 없앰)
  return `<button type="button" class="g-cta" id="contentGo" aria-label="출전 · ${esc(sub)}"${ok ? '' : ' disabled'}><span class="g-mk" aria-hidden="true">${mk}</span><span class="g-ct"><b>출전</b></span>${departureArrow()}</button>`;
}

const s = screen('s-content', '모험 선택', {
  tab: 'battle',
  // arg = 열 분류 (로비: 주간 도전 → dungeon, 레이드 팻말 → raid10 · raid20) 또는 고를 장소 · 난이도 (로비 「출전」 · 다음 목표 · 길드 부탁).
  // 없으면 첫 분류 탐험 (2026-10-21 Lim 「각 메뉴에 들어갔을때 그전의 탭화면을 유지 하지 말고 항상 첫번째 탭」), 「←」로 돌아오면 보던 분류
  enter(arg) {
    rewardKey = null;
    const fresh = freshEntry();
    if (KINDS.some(t => t.kind === arg)) tab = arg as Tab;
    const to = arg && typeof arg === 'object' ? arg as Pick<typeof Flow, 'content' | 'diff'> : null;
    // 로비 「출전」 · 다음 목표: 바로 편성으로 가지 않고 그 장소 · 난이도를 골라 둔 이 화면 (2026-10-17 Lim 「바로 시작이 아닌 해당 화면으로」)
    if (to) {
      const c = contentOf(to.content), g = G.save.tut >= TUT.done ? guide() : null;
      tab = tabOf(c); selectContent(c); diffPick[c.key] = to.diff;
      shownGuide = g ? `${g.content}/${g.diff}` : '';
    }
    // 편성에서 「←」로 돌아오면 그 장소·난이도가 골라진 채로 (로비 「바로 출전」으로 갔다 와도. 주간 도전은 따로)
    else if (goingBack() && previous === 's-party' && !Flow.chal && G.save.tut >= TUT.done) {
      const c = contentOf(Flow.content);
      if (!c.hidden) { tab = tabOf(c); selectContent(c); diffPick[c.key] = Flow.diff; }
    }
    // 첫 던전 안내 차례면 녹슨 요새를 짚어 줌 (튜토리얼 안내라 첫 분류 규칙보다 먼저. 분류를 골라 들어왔거나 편성에서 돌아오면 그대로)
    else if (!arg && firstDungeonNow()) { tab = 'dungeon'; selectContent(contentOf('rustfort')); }
    // 새로 들어오면 탐험. 길잡이 추천이 지난번과 다르면 (레벨 업 · 클리어 · 장비) 그 분류에서 그 칸을 골라 둠 (86): 탐험이면 바로 보이고,
    // 다른 분류면 그 분류 칸의 금빛 점 · 누르면 그 칸 (로비 「출전」은 바로 그 칸으로). 같으면 분류마다 마지막에 고른 그대로
    else if (!arg && fresh) {
      tab = KINDS[0].kind;
      if (G.save.tut >= TUT.done) {
        const g = guide(), k = g ? `${g.content}/${g.diff}` : '';
        if (g && k !== shownGuide) {
          const c = contentOf(g.content);
          pick[tabOf(c)] = c.key; diffPick[c.key] = g.diff;
        }
        shownGuide = k;
      }
    }
    render(false);
  },
});

/** keep = 화면 안에서 다시 그림 (장소 줄 가로 위치·포커스 유지). */
function render(keep = true): void {
  // 정산과 같은 주간 상태로 장비 수령을 표시한다.
  refreshDay();
  // 장소 줄 위치: 같은 분류 안에서 다시 그리면 이어서 (분류가 바뀌면 고른 장소 가운데)
  const plr = s.el.querySelector<HTMLElement>('.b-regions');
  const plFrom = keep && plr && drawnTab === tab ? plr.scrollLeft : null;
  gd = G.save.tut >= TUT.done ? guide() : null;
  const c = current(), region = c ? adventureRegionOf(c).key : null;
  const list = shownOf(tab), d = c ? diffOf(c) : '보통';
  const rewardFrom = keep && s.el.dataset.selectedContent === c?.key && s.el.dataset.selectedDiff === d
    ? s.el.querySelector<HTMLElement>('.b-scene-reward-list')?.scrollLeft ?? 0 : 0;
  const plCenter = centerNext;
  drawnTab = tab; drawnViewport = viewportStamp(); centerNext = false;
  const a = document.activeElement as HTMLElement | null;
  const focus = keep && a && s.el.contains(a) ? ['data-ctab', 'data-content', 'data-step', 'data-diff', 'data-reward'].filter(n => a.hasAttribute(n)).map(n => `[${n}="${a.getAttribute(n)}"]`)[0] || (a.id ? `#${a.id}` : '') : '';

  s.el.style.setProperty('--b-bg', c ? cssUrl(placeArt(c.key).url) : 'none');
  s.el.dataset.selectedContent = c?.key ?? '';
  s.el.dataset.selectedRegion = region ?? '';
  s.el.dataset.selectedDiff = d;
  s.el.innerHTML = `${topBar({ settings: true })}
    <div class="ns-body b-body">${cats()}${tab === 'dungeon' && c ? chalCell() : ''}${c ? gate(c, d, list.length > 1) + placeRow(c) + `<section class="b-difficulty"><div class="b-section-title"><h2>난이도</h2></div>${diffs(c, d)}</section>` : ''}</div>
    <footer class="b-foot">${cta(c, d)}</footer>`;
  const rewardRow = s.el.querySelector<HTMLElement>('.b-scene-reward-list');
  if (rewardRow) rewardRow.scrollLeft = rewardFrom;
  const regionRow = s.el.querySelector<HTMLElement>('.b-regions');
  if (regionRow) {
    if (plFrom !== null) regionRow.scrollLeft = plFrom;
    if (plFrom === null || plCenter) {
      const selected = regionRow.querySelector<HTMLElement>('.b-region.on');
      // 화면 위치로 계산 (플립 커버처럼 줄이 주간 도전 오른쪽에 있어도 가운데로)
      const r = selected?.getBoundingClientRect(), row = regionRow.getBoundingClientRect();
      if (r) regionRow.scrollLeft += r.left - row.left - regionRow.clientLeft - (regionRow.clientWidth - r.width) / 2;
    }
  }
  if (focus) {
    const target = s.el.querySelector<HTMLButtonElement>(focus);
    if (target && !target.disabled) target.focus({ preventScroll: true });
  }
}

/** 접기·펼치기와 화면 회전: 다시 그려서 고른 장소를 장소 줄 가운데로. */
function refreshPageLayout(): void {
  if (s.el.hidden || !s.el.isConnected) return;
  if (rewardKey) { positionRewardChance(); return; }
  if (drawnViewport === viewportStamp()) return;
  centerNext = true;
  render();
}
let resizeFrame = 0;
function queuePageLayout(): void {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; refreshPageLayout(); });
}
addEventListener('resize', queuePageLayout);
visualViewport?.addEventListener('resize', queuePageLayout);
if (typeof ResizeObserver === 'function') new ResizeObserver(queuePageLayout).observe(s.el);

/** 확률 안내는 아이콘 가까이에 두며, 접기·펼치기 중에도 화면 안에 유지한다. */
function positionRewardChance(): void {
  const pop = s.el.querySelector<HTMLElement>('.b-reward-chance');
  const btn = rewardKey ? s.el.querySelector<HTMLElement>(`[data-reward="${rewardKey}"]`) : null;
  if (!pop || !btn) return;
  const r = btn.getBoundingClientRect(), box = s.el.getBoundingClientRect();
  const tabs = document.getElementById('tabs')?.getBoundingClientRect();
  const bottom = Math.min(box.bottom, innerHeight, tabs?.height && tabs.top > box.top ? tabs.top : Infinity);
  const height = Math.max(0, bottom - box.top);
  const w = Math.max(0, Math.min(230, box.width - 24));
  pop.style.width = `${w}px`;
  pop.style.maxHeight = `${Math.max(0, height - 16)}px`;
  pop.style.left = `${Math.max(12, Math.min(box.width - w - 12, r.left - box.left + (r.width - w) / 2))}px`;
  const h = pop.offsetHeight, above = r.top - box.top - h - 8;
  const top = above >= 8 ? above : r.bottom - box.top + 8;
  pop.style.top = `${Math.max(8, Math.min(height - h - 8, top))}px`;
}

function openRewardChance(key: string): void {
  // 화면을 켜 둔 채 주가 바뀌어도 아이콘과 확률 안내가 함께 갱신된다.
  const changed = refreshDay();
  if (changed.day || changed.week || changed.banked || changed.fixed) {
    closeRewardChance(false);
    render();
  }
  const c = current();
  if (!c) return;
  const reward = rewardItems(c, diffOf(c)).find(r => r.key === key);
  if (!reward) return;
  closeRewardChance(false);
  rewardKey = key;
  s.el.querySelector(`[data-reward="${key}"]`)?.setAttribute('aria-expanded', 'true');
  const percent = (p: number) => Number((p * 100).toFixed(2));
  // 장비는 나오는 등급만 (2026-10-13 Lim: 0% 등급은 안 보임). 높은 등급부터
  const grades = reward.gradeOdds ? [...ITEM_GRADES].reverse().filter(g => reward.gradeOdds![g] > 0) : [];
  const chance = reward.gradeOdds
    ? grades.length ? `<dl class="b-grade-chances" aria-label="등급별 획득 확률">${grades.map(g => {
      const p = reward.gradeOdds![g];
      return `<div class="b-grade-chance" data-grade="${g}" data-probability="${p}" style="--grade-color:${GRADE_STYLE[g].color}"><dt>${g}</dt><dd>${percent(p)}%</dd></div>`;
    }).join('')}</dl>` : ''
    : `<strong>${percent(reward.probability)}%</strong>`;
  s.el.insertAdjacentHTML('beforeend', `<div class="b-reward-chance" id="bRewardChance" role="dialog" aria-modal="false" aria-labelledby="bRewardChanceTitle" tabindex="-1" data-reward-key="${key}">
    <button type="button" data-reward-close aria-label="확률 안내 닫기">×</button>
    <b id="bRewardChanceTitle">${esc(reward.name)}</b>${chance}${reward.basis ? `<small>${esc(reward.basis)}</small>` : ''}
  </div>`);
  positionRewardChance();
  s.el.querySelector<HTMLElement>('.b-reward-chance')?.focus({ preventScroll: true });
}

function closeRewardChance(refocus = true): void {
  if (!rewardKey) return;
  const key = rewardKey;
  rewardKey = null;
  s.el.querySelector('.b-reward-chance')?.remove();
  const btn = s.el.querySelector<HTMLElement>(`[data-reward="${key}"]`);
  btn?.setAttribute('aria-expanded', 'false');
  if (refocus) { btn?.focus({ preventScroll: true }); refreshPageLayout(); }
}

// 작은 확률 안내는 배경을 막지 않는다. 다른 조작을 하면 닫고 그 조작을 그대로 이어 간다.
document.addEventListener('click', e => {
  if (!rewardKey || s.el.hidden) return;
  const target = e.target as Element;
  if (!target.closest('.b-reward-chance') && !target.closest('#s-content [data-reward]')) closeRewardChance(false);
}, true);
document.addEventListener('focusin', e => {
  if (!rewardKey || s.el.hidden) return;
  const target = e.target as Element;
  if (!target.closest('.b-reward-chance') && !target.closest('#s-content [data-reward]')) closeRewardChance(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && rewardKey && !s.el.hidden) { e.preventDefault(); e.stopImmediatePropagation(); closeRewardChance(); }
}, true);

s.el.addEventListener('click', e => {
  const el = e.target as HTMLElement;
  if (el.closest('[data-reward-close]')) { closeRewardChance(); return; }
  if (el.closest('.b-reward-chance')) return;
  const reward = el.closest<HTMLElement>('[data-reward]');
  if (reward) {
    const key = reward.dataset.reward!;
    if (rewardKey === key) closeRewardChance(); else openRewardChance(key);
    return;
  }
  const t = el.closest<HTMLElement>('[data-ctab]');
  if (t) { tab = t.dataset.ctab as Tab; render(); return; }
  const pl = el.closest<HTMLElement>('[data-content]');
  if (pl) { selectContent(contentOf(pl.dataset.content as ContentKey)); render(); return; }
  const ch = el.closest<HTMLElement>('[data-chal]');
  if (ch) {
    if (ch.getAttribute('aria-disabled') === 'true') return;
    Flow.content = CHAL.content; Flow.diff = CHAL.diff; Flow.chal = G.save.chalOpen;
    go('s-entry'); return;
  }
  const st = el.closest<HTMLElement>('[data-step]');
  if (st) {
    const c = current(), list = shownOf(tab);
    if (c && list.length > 1) selectContent(list[(list.indexOf(c) + Number(st.dataset.step) + list.length) % list.length]);
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
    if (!c || tutLockedContent(G.save, c.key)) return;
    const d = diffOf(c);
    Flow.content = c.key; Flow.diff = d; Flow.chal = 0;
    if (G.save.tut >= TUT.done) diffPick[c.key] = d;
    // 입장 화면 없이 바로 편성 (2026-10-08): 난이도는 여기서만 고름, 공략은 편성의 시트. 81 · 90: 입장 확인 → 편성
    sortie();
  }
});
