/**
 * S03 모험 선택 = 전투 탭 루트 (27 3-1 → 30 시안 Battle30 「B 출정 관문」).
 * 분류 4칸 → 작은 장소 풍경/권장 레벨 → 지역 선택 팝업 → 난이도 → 출전.
 * 장면 안 보상 아이콘을 누르면 그 보상의 확률만 표시. 주간 도전은 던전 분류 바로 아래 독립 버튼.
 * 지역/장소/난이도와 지역 줄의 가로 위치를 기억한다 (모듈 변수, 저장 안 함). 장소·화면 세로 스크롤은 없다.
 */
import { adventureContents, adventureRegionOf, adventureRegions, adventureTabOf, type AdventureRegionKey, type AdventureTab } from '../data/adventure-regions';
import { ALL_DIFFS, CONTENT, contentOf, isLeveling, raidSize, stageOf, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { AFFIXES } from '../data/affixes';
import { CHAL } from '../data/challenge';
import { FIRST_CLEAR_CRYSTAL, SHARD_MAX } from '../data/economy';
import { avgScore, clearMats, GRADE_STYLE, ITEM_GRADES, RECOMMENDED, type ItemGrade } from '../data/equipment';
import { gearGradeOdds } from '../data/reward-preview';
import { HEROES } from '../data/heroes';
import { FACTIONS, PLACES, type FactionKey } from '../data/places';
import { clearGold, EXPLORE_REWARD } from '../data/progression';
import { art, cssUrl } from '../art';
import { weekRemaining } from '../game/clock';
import { meritFor, raidLootOpen } from '../game/economy';
import { Flow } from '../game/flow';
import { chalGate, runMode, weekAffixes } from '../game/runmode';
import { firstDungeonNow, G, lockOf, otherHeroFor, refreshDay } from '../game/state';
import { TUT } from '../game/tutorial';
import { esc, fmt, go, previous, screen, topBar } from './kit';
import { currencyIcon, factionMark, gameIcon, LOCK, placeArt, type CurrencyIconKey } from './art';
import { sheetDialog } from './dialog';

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
/** 마지막으로 고른 분류 (27 3-1) */
let tab: Tab = 'dungeon';
/** 분류마다 마지막 고른 장소 */
const pick: Partial<Record<Tab, ContentKey>> = {};
/** 지역은 탭마다 기억하고, 지역 안의 마지막 장소도 따로 기억한다. */
const regionPick: Partial<Record<Tab, AdventureRegionKey>> = {};
const regionContentPick: Record<string, ContentKey> = {};
/** 장소마다 마지막 고른 난이도 */
const diffPick: Partial<Record<ContentKey, DiffName>> = {};
/** 지금 그려져 있는 분류 (장소 줄 넘김 위치를 이어 갈지) */
let drawnTab: Tab | null = null;
let drawnPageSize = 0;
let drawnViewport = '';
/** 장소 팝업의 지역·페이지. 선택을 확정하기 전에는 출전 상태를 바꾸지 않는다. */
let placeModalRegion: AdventureRegionKey | null = null;
let placePage = 0;
/** 확률 안내는 작고 독립적인 popover이며 출전 선택을 바꾸지 않는다. */
let rewardKey: string | null = null;
/** 다음 그리기에서 고른 지역을 가로 줄 가운데로 (‹ › · 화면 크기 변화) */
let centerNext = false;

/** CSS가 화면 비율에 맞춰 정하는 팝업 칸 수. 기본 6, 작은 커버 화면 2, 펼친 화면 8. */
function placePageSize(): number {
  const size = Number.parseInt(getComputedStyle(s.el).getPropertyValue('--b-page-size'), 10);
  return Number.isFinite(size) && size > 0 ? size : 6;
}
const viewportStamp = () => `${s.el.clientWidth}/${s.el.clientHeight}/${innerWidth}/${innerHeight}/${visualViewport?.width}/${visualViewport?.height}`;

// 열림 레벨 순 (같으면 원래 순서). 새 장소가 레벨 사이사이에 끼게 (62)
const listOf = adventureContents;
const factionOf = (c: ContentDef): FactionKey => PLACES[placeArt(c.key).place].faction;
/** 준비 중이거나 레벨이 모자라 못 들어가는 장소 */
const isOff = (c: ContentDef) => !c.ready || lockOf(c).locked;
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

/** 레이드: 이번 주 장비 받음 (보스마다 난이도별 주 1회) · 악몽 열쇠 (악몽 입장권). 정보 줄 오른쪽에 붙여서 관문 높이를 다른 분류와 맞춤 */
function lootLine(c: ContentDef): string {
  if (c.kind !== 'raid' || G.save.tut < TUT.done) return '';
  const got = ALL_DIFFS.map(d => !raidLootOpen(G.save, c.key, d));
  const dots = `<span class="b-loot" role="img" aria-label="이번 주 장비 ${ALL_DIFFS.map((d, i) => `${d} ${got[i] ? '받음' : '아직'}`).join(', ')}" title="이번 주 장비: 쉬움 · 보통 · 어려움 · 악몽">${got.map(g => `<i${g ? ' class="got"' : ''}></i>`).join('')}</span>`;
  return `<span class="b-lootrow"><span class="cap" aria-hidden="true">장비</span>${dots}<span class="cap"><span class="sr">악몽 </span>열쇠 ${G.save.wallet.shards}/${SHARD_MAX}</span></span>`;
}

/**
 * 추천 리본 (27 3-1): 내 레벨·장비로 「처음 깨기 좋은」 장소 1곳.
 * 콘텐츠마다 아직 안 깬 가장 낮은 열린 난이도를 봄 (탐험 · 던전은 쉬움부터 사슬, 레이드는 보통부터).
 * 탐험 · 던전은 내 레벨 +1 이하, 레이드는 레벨이 되고 권장 장비를 채우면 후보.
 * 적 레벨이 가장 높은 것 (같으면 탐험보다 던전·레이드)
 */
function recommended(): ContentKey | null {
  const lv = G.save.player.level, mine = avgScore(G.save.gear.equipped);
  let best: { k: ContentKey; s: number } | null = null;
  for (const c of CONTENT) {
    if (c.hidden || !c.ready || lockOf(c).locked) continue;
    const rec = G.save.clears[c.key] || {}, lvl = isLeveling(c);
    for (const d of (lvl ? ALL_DIFFS : ['보통', '어려움', '악몽']) as DiffName[]) {
      if (rec[d]) continue;
      const st = stageOf(c, d), r = RECOMMENDED[d];
      if (lockOf(c, d).locked || (lvl ? st > lv + 1 : lv < st) || (r && mine < r.score)) break;
      const sc = st * 10 + (c.kind === 'explore' ? 0 : 1);
      if (!best || sc > best.s) best = { k: c.key, s: sc };
      break;
    }
  }
  return best ? best.k : null;
}

/** 지금 고른 장소: 기억한 것 → 추천 → 들어갈 수 있는 첫 장소 → 첫 장소 (장소가 없는 분류면 null) */
function current(): ContentDef | null {
  const all = listOf(tab);
  if (!all.length) return null;
  const remembered = all.find(x => x.key === pick[tab]);
  const initial = remembered || all.find(x => x.key === recommended()) || all.find(x => !isOff(x)) || all[0];
  const region = regionPick[tab] || adventureRegionOf(initial).key;
  const list = listOf(tab, region);
  const c = list.find(x => x.key === regionContentPick[`${tab}:${region}`])
    || list.find(x => x.key === initial.key) || list.find(x => !isOff(x)) || list[0] || initial;
  selectContent(c);
  return c;
}

function selectContent(c: ContentDef): void {
  pick[tab] = c.key;
  const region = adventureRegionOf(c).key;
  regionPick[tab] = region;
  regionContentPick[`${tab}:${region}`] = c.key;
}

/**
 * 고른 난이도: 기억한 것 → (첫 던전 녹슨 요새는 쉬움, 09 4장) → 아직 안 깬 가장 낮은 열린 난이도 (탐험 · 던전은 쉬움부터, 레이드는 보통부터)
 * → 다 깼으면 열린 가장 높은 난이도
 */
function diffOf(c: ContentDef): DiffName {
  const m = diffPick[c.key];
  if (m && !diffLocked(c, m).locked) return m;
  if (c.key === 'rustfort' && firstDungeonNow()) return '쉬움';
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
    return `<button type="button" class="b-cat" role="tab" data-ctab="${k.kind}" aria-selected="${k.kind === tab}" aria-label="${label}"><span class="b-ci">${catIcon(k)}</span><span aria-hidden="true"><b>${top}</b><small>${sub}</small></span></button>`;
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
  const odds = gearGradeOdds(d, raid, G.save.player.level);
  const lootOpen = !play || !raid || raidLootOpen(G.save, c.key, d);
  const maxGrade = [...ITEM_GRADES].reverse().find(g => odds[g] > 0) ?? ITEM_GRADES[0];
  const items: SceneReward[] = [{
    key: 'gear', name: '장비 등급별 확률', label: lootOpen ? maxGrade : '수령 완료', icon: gameIcon('gear', ICON.gear),
    color: GRADE_STYLE[maxGrade].color, probability: lootOpen ? 1 : 0, maxGrade,
    gradeOdds: Object.fromEntries(ITEM_GRADES.map(g => [g, lootOpen ? odds[g] : 0])) as Record<ItemGrade, number>,
    basis: lootOpen ? '장비 1개 · A 평가 · 보너스 제외' : '이번 주 장비 수령 완료',
  }];
  const currency = (key: CurrencyIconKey, name: string, amount: number, color: string, basis = '클리어 시', probability = 1) => {
    items.push({ key, name, label: fmt(amount), icon: currencyIcon(key), color, probability, basis });
  };
  const stage = runMode(G.save, c, d, { chal: 0 }).stage;
  const gold = Math.round(clearGold(stage, d, 'A', raid) * (play && c.kind === 'explore' ? EXPLORE_REWARD : 1));
  currency('gold', '골드', gold, '#DDB563', '클리어 시 · A 평가 · 보너스 제외');
  if (play && !G.save.clears[c.key]?.[d]) currency('crystal', '크리스탈', FIRST_CLEAR_CRYSTAL, '#7BCBF0', '첫 클리어 시');
  const mats = clearMats(d, raid);
  if (mats.stone) currency('stone', '강화석', mats.stone, '#C3B899');
  if (mats.refined) currency('refined', '정제 강화석', mats.refined, '#A6DEF0');
  if (play && raid) {
    const merit = meritFor(G.save, raid, d);
    currency('merit', '공훈', merit, '#E6BA6F', merit ? '클리어 시' : '이번 주 공훈 한도 도달', merit ? 1 : 0);
  }
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

/** 작은 풍경 미리보기. 장소와 권장 레벨만 크게 표시한다. */
function gate(c: ContentDef, d: DiffName, many: boolean): string {
  const pa = placeArt(c.key), lk = lockOf(c), pl = PLACES[pa.place];
  const other = lk.locked ? otherHeroFor(lk.lv) : null;
  const status = !c.ready ? '준비 중' : other ? `${HEROES[other.hero].name} Lv ${other.lv}로 입장 가능` : lk.locked ? `Lv ${lk.lv}에 열림` : '';
  const scene = pa.url ? `<img class="b-art${pa.scene ? '' : ' floor'}" src="${pa.url}" alt="${esc(pl.name)}" decoding="async" draggable="false">` : '';
  return `<section class="b-gate${status ? ' off' : ''}" aria-label="출전할 곳 · ${esc(c.name)}">
    ${scene}<div class="b-gate-shade"></div>
    <div class="b-gt"><span class="b-gn"><small>${esc(adventureRegionOf(c).name)}</small><b>${esc(c.name)}</b></span></div>
    <div class="b-level" aria-label="권장 레벨 ${stageOf(c, d)}"><span>권장 레벨</span><strong><small>Lv.</small> ${stageOf(c, d)}</strong></div>
    ${many ? `<button type="button" class="b-arw prev" data-step="-1" aria-label="이전 장소">${PREV}</button><button type="button" class="b-arw next" data-step="1" aria-label="다음 장소">${NEXT}</button>` : ''}
    <button type="button" class="b-current-places" data-current-places aria-haspopup="dialog">장소 변경</button>
    ${status ? `<span class="b-st">${status}</span>` : ''}
    ${rewards(c, d)}
  </section>`;
}

/** 지역은 장소 선택 팝업을 연다. 팝업에서 고르기 전까지는 현재 지역 표시를 유지한다. */
function regions(c: ContentDef): string {
  const selected = adventureRegionOf(c).key;
  return `<section class="b-region-section" aria-labelledby="bRegionTitle">
    <div class="b-section-title"><h2 id="bRegionTitle">지역 선택</h2></div>
    <nav class="b-regions" aria-label="지역">${adventureRegions(tab).map(region => {
      const list = listOf(tab, region.key), on = region.key === selected;
      const scene = placeArt(region.representative).url;
      const locked = list.every(x => isOff(x));
      return `<button type="button" class="b-region${on ? ' on' : ''}" data-region="${region.key}" aria-pressed="${on}" aria-haspopup="dialog" aria-label="${esc(region.name)} · ${list.length}곳${locked ? ` · Lv ${list[0].unlockLv}부터` : ''}">
        <img src="${scene}" alt="" loading="lazy" decoding="async"><span class="b-region-name">${esc(region.shortName)}</span><small>${locked ? `Lv ${list[0].unlockLv}` : `${list.length}곳`}</small></button>`;
    }).join('')}</nav>
  </section>`;
}

function places(list: ContentDef[], selected: ContentKey | null, page: number, size: number): string {
  const region = adventureRegionOf(list[0]), name = KINDS.find(k => k.kind === tab)!.name;
  const pages = Math.max(1, Math.ceil(list.length / size)), visible = list.slice(page * size, (page + 1) * size);
  return `<section class="b-place-section" aria-labelledby="bPlaceTitle" data-page="${page + 1}" data-pages="${pages}" data-page-size="${size}" data-total="${list.length}"><div class="b-section-title"><h2 id="bPlaceTitle">${esc(region.shortName)} <span>· ${name} · ${list.length}곳</span></h2>
    <div class="b-place-pager b-place-pages" role="group" aria-label="장소 페이지">
      <button type="button" data-place-page="-1" aria-label="이전 장소 페이지"${page === 0 ? ' disabled' : ''}>${PREV}</button>
      <span class="b-page-count" aria-live="polite" aria-label="장소 목록 ${pages}쪽 중 ${page + 1}쪽">${page + 1} / ${pages}</span>
      <button type="button" data-place-page="1" aria-label="다음 장소 페이지"${page === pages - 1 ? ' disabled' : ''}>${NEXT}</button>
    </div></div>
    <nav class="b-places" aria-label="${esc(region.name)}의 장소"><div class="b-plr">${visible.map(x => {
      const lk = lockOf(x), on = x.key === selected, pa = placeArt(x.key);
      const status = !x.ready ? '준비 중' : lk.locked ? `Lv ${lk.lv}에 열림` : `권장 Lv ${stageOf(x, diffOf(x))}`;
      const progress = ALL_DIFFS.map(diff => {
        const record = G.save.clears[x.key]?.[diff];
        // 승리 때만 기록을 만들며, 기존 난이도 해금·첫 클리어도 기록 존재로 판정한다.
        const cleared = !!record;
        const stars = Number.isFinite(record?.stars) ? Math.max(0, Math.min(3, Math.floor(record!.stars))) : 0;
        return { diff, cleared, stars, label: cleared ? `${diff} 클리어 · 별 ${stars}개` : `${diff} 미클리어` };
      });
      return `<button type="button" class="b-pl${on ? ' on' : ''}${lk.locked || !x.ready ? ' lock' : ''}" data-content="${x.key}" aria-pressed="${on}" aria-label="${esc(x.name)} · ${status} · ${progress.map(p => p.label).join(' · ')}">
        <span class="b-place-visual"><img class="b-place-thumb" src="${pa.url}" alt="" loading="lazy" decoding="async"><span class="b-place-copy"><b>${esc(x.name)}</b><small>${lk.locked ? LOCK : ''}${status}</small></span></span>
        <span class="b-place-progress" role="group" aria-label="난이도별 클리어 기록">${progress.map(p => `<span class="b-place-result${p.cleared ? ' cleared' : ''}" data-clear-diff="${p.diff}" data-cleared="${p.cleared}" data-stars="${p.stars}" aria-label="${p.label}"><small>${p.diff}</small><span class="b-place-result-stars" aria-hidden="true">${p.cleared ? p.stars ? '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : '✓ 0' : '미완료'}</span></span>`).join('')}</span></button>`;
    }).join('')}</div></nav>
  </section>`;
}

/** 난이도 4칸: 이름 + 별. 그 난이도만 잠겼으면 자물쇠 Lv, 앞 난이도를 못 깼으면 자물쇠 「쉬움 깨기」 (61 1-1). 준비 중 장소는 못 고름 */
function diffs(c: ContentDef, d: DiffName): string {
  return `<div class="b-df" role="group" aria-label="난이도">${ALL_DIFFS.map(x => {
    const l = diffLocked(c, x), dis = !c.ready || l.locked, on = c.ready && x === d;
    const sub = !c.ready || !l.locked ? stars(c, x) : l.need ? `${LOCK}${l.need} 깨기<span class="sr">면 열림</span>` : `${LOCK}Lv ${l.lv}`;
    return `<button type="button" class="b-dc${on ? ' on' : ''}" data-diff="${x}" aria-pressed="${on}"${dis ? ' disabled' : ''}>${x}<small>${sub}</small></button>`;
  }).join('')}</div>`;
}

/** 출전 (30 공통 .g-cta): 세력 문양 + 「출전」 + 장소 · 난이도. 못 들어가는 곳은 막힘 */
function cta(c: ContentDef | null, d: DiffName): string {
  const lk = c ? lockOf(c, d) : null;
  const ok = !!c && c.ready && !lk!.locked;
  const sub = !c ? '준비 중' : !c.ready ? `${c.name} · 준비 중` : lk!.locked ? (lk!.need && !lockOf(c).locked ? `${c.name} · ${lk!.need}부터 깨기` : `${c.name} · Lv ${lk!.lv}에 열림`) : `${c.name} · ${d}`;
  const mk = c ? factionMark(factionOf(c), 'md') : '';
  return `<button type="button" class="g-cta" id="contentGo"${ok ? '' : ' disabled'}><span class="g-mk">${mk}</span><span class="g-ct"><b>출전</b><small>${esc(sub)}</small></span>${ARROW}</button>`;
}

const s = screen('s-content', '모험 선택', {
  tab: 'battle',
  // arg = 열 분류 (로비: 주간 도전 → dungeon, 첨탑 → raid10). 없으면 마지막 고른 분류
  enter(arg) {
    placeModalRegion = null; rewardKey = null;
    if (KINDS.some(t => t.kind === arg)) tab = arg as Tab;
    // 편성에서 돌아오면 그 장소·난이도가 골라진 채로 (로비 「바로 출전」으로 갔다 와도. 주간 도전은 따로)
    if (previous === 's-party' && !Flow.chal && G.save.tut >= TUT.done) {
      const c = contentOf(Flow.content);
      if (!c.hidden) { tab = tabOf(c); selectContent(c); diffPick[c.key] = Flow.diff; }
    }
    // 첫 던전 안내 차례면 녹슨 요새를 짚어 줌 (분류를 골라 들어왔거나 편성에서 돌아오면 그대로)
    else if (!arg && firstDungeonNow()) { tab = 'dungeon'; selectContent(contentOf('rustfort')); }
    render(false);
  },
});
const placesDialog = sheetDialog(s.el, () => closePlaces());

/** keep = 화면 안에서 다시 그림 (지역 가로 위치·포커스 유지). */
function render(keep = true): void {
  // 정산과 같은 주간 상태로 장비 수령·공훈 잔여량을 표시한다.
  refreshDay();
  // 지역 줄 위치: 같은 분류 안에서 다시 그리면 이어서 (분류가 바뀌면 고른 지역 가운데)
  const plr = s.el.querySelector<HTMLElement>('.b-regions');
  const plFrom = keep && plr && drawnTab === tab ? plr.scrollLeft : null;
  const c = current(), region = c ? adventureRegionOf(c).key : null;
  const list = c ? listOf(tab, adventureRegionOf(c).key) : [], d = c ? diffOf(c) : '보통';
  const rewardFrom = keep && s.el.dataset.selectedContent === c?.key && s.el.dataset.selectedDiff === d
    ? s.el.querySelector<HTMLElement>('.b-scene-reward-list')?.scrollLeft ?? 0 : 0;
  const plCenter = centerNext;
  drawnTab = tab; drawnPageSize = placePageSize(); drawnViewport = viewportStamp(); centerNext = false;
  const a = document.activeElement as HTMLElement | null;
  const focus = keep && a && s.el.contains(a) ? ['data-ctab', 'data-region', 'data-current-places', 'data-content', 'data-step', 'data-place-page', 'data-diff', 'data-reward'].filter(n => a.hasAttribute(n)).map(n => `[${n}="${a.getAttribute(n)}"]`)[0] || (a.id ? `#${a.id}` : '') : '';

  const tut = tab === 'dungeon' && c?.key === 'rustfort' && firstDungeonNow();
  const tip = tut ? '<p class="coachtip b-tip"><b>녹슨 요새</b> 쉬움으로 출전. 일반·정예 구간 둘, 보스 둘을 이어서 진행</p>' : '';
  s.el.style.setProperty('--b-bg', c ? cssUrl(placeArt(c.key).url) : 'none');
  s.el.dataset.selectedContent = c?.key ?? '';
  s.el.dataset.selectedRegion = region ?? '';
  s.el.dataset.selectedDiff = d;
  s.el.innerHTML = `${topBar({ settings: true })}
    <div class="ns-body b-body">${tip}${cats()}${tab === 'dungeon' && c ? chalCell() : ''}${c ? gate(c, d, list.length > 1) + regions(c) + `<section class="b-difficulty"><div class="b-section-title"><h2>난이도</h2></div>${diffs(c, d)}</section>` : ''}</div>
    <footer class="b-foot">${cta(c, d)}</footer>`;
  if (tut) s.el.querySelector('#contentGo')?.classList.add('hi-pulse');
  const rewardRow = s.el.querySelector<HTMLElement>('.b-scene-reward-list');
  if (rewardRow) rewardRow.scrollLeft = rewardFrom;
  const regionRow = s.el.querySelector<HTMLElement>('.b-regions');
  if (regionRow) {
    if (plFrom !== null) regionRow.scrollLeft = plFrom;
    if (plFrom === null || plCenter) {
      const selected = regionRow.querySelector<HTMLElement>('.b-region.on');
      if (selected) regionRow.scrollLeft = selected.offsetLeft - regionRow.offsetLeft - (regionRow.clientWidth - selected.offsetWidth) / 2;
    }
  }
  if (focus) {
    const target = s.el.querySelector<HTMLButtonElement>(focus);
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else if (focus.startsWith('[data-place-page')) s.el.querySelector<HTMLElement>('[data-place-page]:not(:disabled)')?.focus({ preventScroll: true });
  }
}

/** 장소 팝업은 별도로 그려서 뒤에 있는 선택·난이도·출전 버튼을 그대로 둔다. */
function renderPlaces(revealSelected = false): void {
  if (!placeModalRegion) return;
  const region = placeModalRegion, list = listOf(tab, region), selected = current()?.key ?? null;
  if (!list.length) return;
  const size = placePageSize();
  if (revealSelected) {
    const anchor = list.findIndex(x => x.key === selected);
    const remembered = list.findIndex(x => x.key === regionContentPick[`${tab}:${region}`]);
    placePage = Math.floor(Math.max(0, anchor >= 0 ? anchor : remembered) / size);
  }
  placePage = Math.max(0, Math.min(placePage, Math.ceil(list.length / size) - 1));
  placesDialog.beforeRender();
  s.el.querySelector('.b-place-modalwrap')?.remove();
  s.el.insertAdjacentHTML('beforeend', `<div class="b-place-modalwrap" data-place-close>
    <div class="b-place-modal" role="dialog" aria-modal="true" aria-labelledby="bPlaceModalTitle" data-modal-region="${region}" tabindex="-1">
      <div class="b-place-modal-head"><h2 id="bPlaceModalTitle">장소 선택</h2><button type="button" class="b-place-modal-close" data-place-close aria-label="장소 선택 닫기">×</button></div>
      ${places(list, selected, placePage, size)}
    </div></div>`);
  placesDialog.sync(s.el.querySelector<HTMLElement>('.b-place-modal'), [`places:${region}`]);
  drawnPageSize = size; drawnViewport = viewportStamp();
}

function openPlaces(region: AdventureRegionKey): void {
  if (!listOf(tab, region).length) return;
  placeModalRegion = region;
  renderPlaces(true);
}

function closePlaces(): void {
  const wrap = s.el.querySelector('.b-place-modalwrap');
  if (!wrap) return;
  placesDialog.beforeRender();
  wrap.remove();
  placeModalRegion = null;
  placesDialog.sync(null, []);
  refreshPageLayout();
}

/** 접기·펼치기와 화면 회전 중 팝업은 유지하고 선택한 장소를 새 칸 수에 맞춰 보여 준다. */
function refreshPageLayout(): void {
  if (s.el.hidden || !s.el.isConnected) return;
  if (rewardKey) { positionRewardChance(); return; }
  if (drawnViewport === viewportStamp() && drawnPageSize === placePageSize()) return;
  if (placeModalRegion) { renderPlaces(true); return; }
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
  if (changed.day || changed.week || changed.season || changed.banked || changed.fixed) {
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
  const chance = reward.gradeOdds
    ? `<dl class="b-grade-chances" aria-label="등급별 획득 확률">${[...ITEM_GRADES].reverse().map(g => {
      const p = reward.gradeOdds![g];
      return `<div class="b-grade-chance${p ? '' : ' unavailable'}" data-grade="${g}" data-probability="${p}" style="--grade-color:${GRADE_STYLE[g].color}"><dt>${g}</dt><dd>${percent(p)}%</dd></div>`;
    }).join('')}</dl>`
    : `<strong>${percent(reward.probability)}%</strong>`;
  s.el.insertAdjacentHTML('beforeend', `<div class="b-reward-chance" id="bRewardChance" role="dialog" aria-modal="false" aria-labelledby="bRewardChanceTitle" tabindex="-1" data-reward-key="${key}">
    <button type="button" data-reward-close aria-label="확률 안내 닫기">×</button>
    <b id="bRewardChanceTitle">${esc(reward.name)}</b>${chance}<small>${esc(reward.basis)}</small>
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
  if (s.el.querySelector('.b-place-modalwrap')) {
    if (el.closest('[data-place-close]') && (el.closest('.b-place-modal-close') || !el.closest('.b-place-modal'))) { closePlaces(); return; }
    const chosen = el.closest<HTMLElement>('[data-content]');
    if (chosen) {
      const key = chosen.dataset.content as ContentKey;
      closePlaces();
      selectContent(contentOf(key));
      centerNext = true;
      render(); return;
    }
    const pageButton = el.closest<HTMLButtonElement>('[data-place-page]');
    if (pageButton && !pageButton.disabled) { placePage += Number(pageButton.dataset.placePage); renderPlaces(); }
    return;
  }
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
  const rg = el.closest<HTMLElement>('[data-region]');
  if (rg) { openPlaces(rg.dataset.region as AdventureRegionKey); return; }
  if (el.closest('[data-current-places]')) {
    const c = current();
    if (c) openPlaces(adventureRegionOf(c).key);
    return;
  }
  const ch = el.closest<HTMLElement>('[data-chal]');
  if (ch) {
    if (ch.getAttribute('aria-disabled') === 'true') return;
    Flow.content = CHAL.content; Flow.diff = CHAL.diff; Flow.chal = G.save.chalOpen;
    go('s-entry'); return;
  }
  const st = el.closest<HTMLElement>('[data-step]');
  if (st) {
    const c = current(), list = c ? listOf(tab, adventureRegionOf(c).key) : [];
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
    if (!c) return;
    const d = diffOf(c);
    Flow.content = c.key; Flow.diff = d; Flow.chal = 0;
    if (G.save.tut >= TUT.done) diffPick[c.key] = d;
    // 입장 화면 없이 바로 편성 (2026-10-08): 난이도는 여기서만 고름, 공략은 편성의 시트
    Flow.party = null; Flow.rerolls = 0;
    go('s-party');
  }
});
