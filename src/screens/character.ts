/**
 * 캐릭터 탭 (27 4장 기능, 31 시안 CharGear31 · CharSkill31 · CharTalent31 · CharClass31 — 30 로비·전투·길드와 같은 테마). 캐릭터 그림 없음.
 * 위 = 공통 위 줄(topBar) + 하위 탭 4칸 [장비][스킬][특성][직업] (전투 탭 분류 칸 모양, 아이콘 + 이름).
 * 장비: 무기고(ui-char) · 좌우 장비 칸 6개 · 중앙 능력치 · 바로 펼친 인벤토리(필터·정렬·좋음/나쁨 화살표)
 *       + 아래 시트(아이템 탭 → 상세 (옵션마다 지금 장비와 차이 · 그 장비 범위) · 장착·잠금·판매 · 능력치 출처 · 도감). 91: 강화 없음 (디아2식)
 * 스킬: [설명 보기 | 배치 바꾸기] · 마법진 위 휠 3×3 금테 메달 · 양피지 설명 · 칸 탭 기본 힐 · 스킬 줄 목록
 * 특성: 프리셋 · 특성 노드 · 고르기 시트 / 직업: 일곱 직업 비교 목록 · 상태 표시 · 소개와 스킬 카드 상세
 * 그림(item- · skill- · stat- · icon-skills · icon-talent · ui-magic-circle)은 gameIcon으로 감쌈: 파일이 오면 그 그림, 없으면 선 아이콘·CSS.
 */
import { resourceBalance } from '../game/resources';
import { GRADE_STYLE, ITEM_GRADES, itemScore, itemStats, LEGEND, lineValue, optFill, optionsOf, qualityOf, rerollCost, rollFill, sellGold, SLOTS, slotName, STAT_KEYS, STATS, isPointStat, toPoints, type GearItem, type GearLine, type ItemGrade, type SlotKey, type StatKey } from '../data/equipment';
import { ALL_HERO_KEYS, HERO_KEYS, heroSkills, HEROES, skillAt, slotIdOf, type HeroKey } from '../data/heroes';
import { TALENT_LEVEL } from '../data/progression';
import { JOB_PRICE, jobProductId } from '../data/economy';
import { healText, PASSIVE_DESC, PASSIVE_LEVEL, PASSIVE_NAME, SKILL_INFO, SKILL_LEVEL, SKILLS, type PassiveKey, type SkillKey, type SlotName } from '../data/skills';
import { TALENT_TREES, type TalentKey } from '../data/talents';
import { type TapKey } from '../platform/storage';
import { FACTIONS } from '../data/places';
import { DEX_ALL, DEX_STEP, DEX_TABS, dexDue, dexKeys, type DexTab } from '../data/dex';
import { betterSlots, codexRows, dexRows, specRows, statParts, talentsLeft } from '../game/charinfo';
import { codexKeys, NAMED, SPEC_GROUPS, SPEC_KEYS, SPEC_TITLES, SPECS, specText, specValue, type CodexGroup, type SpecGroup, type SpecLine } from '../data/specials';
import {
  claimDex, commit, equip, findItem, G, healerLevel, heroSave, heroStatus, isNewGear, markGearOpened, newGearCount, pickReroll, pickTalent, reroll, rerollOpen, sell,
  setTalentPreset, switchHero, switchOpen, TALENT_PRESETS, talentPreset, toggleLock, type RerollKind,
} from '../game/state';
import { Flow } from '../game/flow';
import type { Settlement } from '../game/settle';
import { art } from '../art';
import { classEmblem, currencyAmount, fxArt, gameIcon, gearArt, gearIcon, LOCK, trinketArt, uiIcon } from './art';
import { battle, current, go, esc, fmt, josa, refreshTabs, screen, topBar } from './kit';
import { pushSettings } from './settings';
import { sheetDialog } from './dialog';

type Sub = 'gear' | 'skill' | 'talent' | 'hero';
const SUBS: { key: Sub; name: string }[] = [{ key: 'gear', name: '장비' }, { key: 'skill', name: '스킬' }, { key: 'talent', name: '특성' }, { key: 'hero', name: '직업' }];

/** 장비 상세는 인벤토리로 복귀, 특수능력 도감은 장비 도감으로 복귀한다. */
type Sheet = { k: 'item'; id: number; inventoryIndex?: number } | { k: 'codex' } | { k: 'dex' } | { k: 'stats' } | { k: 'hero'; hero: HeroKey } | { k: 'talent'; i: number; j: number } | null;
/** 도감에서 펼친 묶음 */
let codexG: CodexGroup = 'heal';
/** 장비 도감에서 펼친 묶음 */
let dexT: DexTab = 'kind';
/** 장비 상세의 재설정 모드 (34 6-8): 줄마다 ↻ 버튼. rrAlt = Lv 60 둘째 후보 (시트를 닫으면 사라짐) */
let rrOn = false;
let rrAlt: { id: number; kind: RerollKind; i: number; alt: GearLine | SpecLine } | null = null;

let sub: Sub = 'gear';
/** 휠에서 고른 자리: 보기 = 설명, 바꾸기 = 첫 번째로 누른 자리 */
let sel: string | null = null;
let swapping = false;
let msg = '';
let sheet: Sheet = null;
/** 판매 확인 (91, 예전 분해): 확인 전에는 재화와 장비를 변경하지 않는다. */
let pending: { kind: 'sell'; id: number } | null = null;
/** 지난번에 그린 시트 (같은 시트를 다시 그릴 땐 올라오는 움직임 없이) */
let sheetKey = '';
/** 다른 화면에서는 장비 정보를 읽기 전용으로 표시한다. 배경 화면은 유지한다. */
let itemOverlay: { origin: string; previousSub: Sub; onClose: () => void } | null = null;

const s = screen('s-char', '캐릭터', {
  tab: 'char',
  enter(arg) {
    if (itemOverlay) sub = itemOverlay.previousSub;
    itemOverlay = null; s.el.classList.remove('c7-item-overlay');
    if (SUBS.some(x => x.key === arg)) sub = arg as Sub;
    sel = null; swapping = false; msg = ''; sheet = null; pending = null; skOpen = null; rrOn = false; rrAlt = null;
    render(false);
  },
});
const modal = sheetDialog(s.el, closeSheet);

/** 보상 카드 등에서 여는 읽기 전용 상세. 캐릭터 탭의 정보/스타일을 공유하고 조작 버튼은 제외한다. */
export function openItemDetail(id: number, onClose: () => void): boolean {
  if (itemOverlay && s.el.hidden) { sub = itemOverlay.previousSub; itemOverlay = null; }
  if (!findItem(id) || current === s.el.id || itemOverlay) return false;
  itemOverlay = { origin: current, previousSub: sub, onClose };
  sub = 'gear'; sheet = { k: 'item', id }; pending = null; msg = ''; sheetKey = '';
  rrOn = false; rrAlt = null;
  s.el.classList.add('c7-item-overlay'); s.el.hidden = false;
  render(false);
  return true;
}

/** 지금 휠 배치 (저장이 없거나 틀리면 기본) */
export function layoutNow(): Record<string, string | null> {
  const L = battle().layout;
  return L.valid(G.save.settings.layout) ? { ...G.save.settings.layout! } : { ...L.DEFAULT_LAYOUT };
}

/** 지금 직업 (화면 표시용) */
const hero = (): HeroKey => G.save.hero;
/** 휠 칸 이름 → 지금 직업의 스킬. 빈 방향은 8번째 칸 (고유 스킬이 있는 직업) */
const skillOfDir = (lay: Record<string, string | null>, d: string): SkillKey | null => skillAt(hero(), lay[d] || 'unique');
const fill = '<span class="c7-fill"></span>';

/** 선 아이콘 (24 칸, 테마 색을 따름) */
const line = (d: string, w = 2) => `<svg class="c7-li" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const BOOK = '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/>';
const TREE = '<path d="M12 5v5M12 10l-5 4M12 10l5 4M7 14v4M17 14v4"/><circle cx="12" cy="3.5" r="1.8"/><circle cx="7" cy="19.5" r="1.8"/><circle cx="17" cy="19.5" r="1.8"/>';

function render(keep = true, resetInventory = false): void {
  modal.beforeRender();
  // 화면 이동이나 판매로 대상이 사라지면 모달만 정리하고 원래 화면에 돌아간다.
  if (itemOverlay && (current !== itemOverlay.origin || !sheet || sheet.k !== 'item' || !findItem(sheet.id))) {
    const context = itemOverlay;
    itemOverlay = null; sub = context.previousSub; sheet = null; pending = null; sheetKey = '';
    s.el.hidden = true; s.el.classList.remove('c7-item-overlay'); s.el.innerHTML = '';
    modal.sync(null, []);
    if (current === context.origin) context.onClose();
    return;
  }
  const old = s.el.querySelector<HTMLElement>('.ns-body');
  const top = keep && old ? old.scrollTop : 0;
  const inventoryTop = keep && !resetInventory ? s.el.querySelector<HTMLElement>('.c7-bags')?.scrollTop ?? 0 : 0;
  // 장비 상세를 열면 그 장비의 새것 점을 끔 (2026-10-17 Lim). 위 정보창 초상 · 장비 탭 점은 이 그리기에서,
  // 하단 「캐릭터」 탭 점은 켜짐이 바뀔 때만 다시 그림 (상세 · 추천 장착 · 판매 · 특성)
  if (sheet?.k === 'item') markGearOpened(sheet.id);
  const dotNow = newGearCount() > 0 || talentsLeft() > 0;
  if (dotNow !== tabDot) { tabDot = dotNow; refreshTabs(); }
  twinkleN = 0;
  // 시트가 가리키던 것이 없어졌으면 (판매한 장비 등) 시트도 닫음
  const sh = sheetHtml();
  if (!sh) { sheet = null; pending = null; }
  const body = itemOverlay ? '' : sub === 'gear' ? gearHtml() : sub === 'skill' ? skillHtml() : sub === 'hero' ? heroListHtml() : talentHtml();
  const key = sheet ? JSON.stringify(sheet) : '';
  const still = !!key && key === sheetKey;
  sheetKey = key;
  // 화면 바탕(무기고 그림)의 밝기·흐림이 하위 탭마다 다름 (char31.css #s-char[data-sub])
  s.el.dataset.sub = sub;
  s.el.innerHTML = itemOverlay ? `${sh}${confirmHtml()}` : `${topBar({ settings: true })}${tabsHtml()}
    <div class="ns-body c7-body c7-${sub}">${body}</div>${sh}${confirmHtml()}`;
  if (still) s.el.querySelector('.sheet')?.classList.add('still');
  if (sub === 'skill') fitDesc();
  const nb = s.el.querySelector<HTMLElement>('.ns-body');
  if (nb && top) nb.scrollTop = top;
  placeTalentSheet();
  const inventory = s.el.querySelector<HTMLElement>('.c7-bags');
  bagWatch?.disconnect();
  if (inventory) { fillBags(); bagWatch?.observe(inventory); inventory.scrollTop = inventoryTop; }
  const path = !sheet || sheet.k === 'talent' ? []
    : sheet.k === 'item' ? [`item:${sheet.id}`] : sheet.k === 'codex' ? ['dex', 'codex'] : [sheet.k];
  if (pending) path.push(`confirm:${pending.kind}`);
  modal.sync(path.length ? s.el.querySelector<HTMLElement>(pending ? '.c7-confirm' : '.sheet') : null, path);
}

/** 하위 탭 4칸: 새 장비 = 장비 빨간 점, 남은 특성 = 특성 빨간 점 */
function tabsHtml(): string {
  const dot = (k: Sub) => ((k === 'gear' && newGearCount()) || (k === 'talent' && talentsLeft()) ? '<span class="rdot" aria-hidden="true"></span>' : '');
  const ic: Record<Sub, string> = {
    gear: gameIcon('gear', uiIcon('weapon')),
    skill: gameIcon('skills', line(BOOK, 1.9)),
    talent: gameIcon('talent', line(TREE, 1.9)),
    hero: classEmblem(hero(), 'sm'),
  };
  return `<nav class="c7-tabs" role="tablist" aria-label="캐릭터 하위 탭">${SUBS.map(x => `<button type="button" class="c7-tab" role="tab" data-csub="${x.key}" aria-selected="${x.key === sub}"><span class="c7-tic">${ic[x.key]}</span><b>${x.name}</b>${dot(x.key)}</button>`).join('')}</nav>`;
}

function sheetHtml(): string {
  if (!sheet) return '';
  const g = sub === 'gear';
  if (sheet.k === 'item') return g ? itemSheet(sheet.id) : '';
  if (sheet.k === 'codex') return g ? codexSheet() : '';
  if (sheet.k === 'dex') return g ? dexSheet() : '';
  if (sheet.k === 'stats') return g ? statsSheet() : '';
  if (sheet.k === 'hero') return sub === 'hero' ? heroSheet(sheet.hero) : '';
  return sub === 'talent' ? talentSheet(sheet.i, sheet.j) : '';
}

// ---------- 장비 (27 4-2 · 4-3, 시안 CharGear31) ----------
type BagFilter = 'all' | 'weapon' | 'armor' | 'acc';
const FILTERS: { key: BagFilter; name: string; ok: (it: GearItem) => boolean }[] = [
  { key: 'all', name: '전체', ok: () => true },
  { key: 'weapon', name: '무기', ok: it => it.slot === 'weapon' },
  { key: 'armor', name: '방어구', ok: it => it.slot === 'head' || it.slot === 'chest' || it.slot === 'hands' },
  { key: 'acc', name: '장신구', ok: it => it.slot === 'ring' || it.slot === 'neck' },
];
type BagSort = 'score' | 'grade' | 'new';
const slotIdx = (it: GearItem) => SLOTS.findIndex(x => x.key === it.slot);
const gradeIdx = (it: GearItem) => ITEM_GRADES.indexOf(it.grade);
/** 정렬 버튼을 누를 때마다 점수 → 등급 → 새것 */
const SORTS: Record<BagSort, { name: string; next: BagSort; cmp: (a: GearItem, b: GearItem) => number }> = {
  score: { name: '점수순', next: 'grade', cmp: (a, b) => itemScore(b, G.save.player.level) - itemScore(a, G.save.player.level) || slotIdx(a) - slotIdx(b) || b.id - a.id },
  grade: { name: '등급순', next: 'new', cmp: (a, b) => gradeIdx(b) - gradeIdx(a) || slotIdx(a) - slotIdx(b) || itemScore(b, G.save.player.level) - itemScore(a, G.save.player.level) },
  new: { name: '새것순', next: 'score', cmp: (a, b) => b.id - a.id },
};
let bagFilter: BagFilter = 'all';
let bagSort: BagSort = 'score';

/**
 * 새 장비 반짝 (2026-10-17 Lim 「반짝하는 걸로 바꾸고 퀄리티를 올려줘」, 예전 50 E fx-look-shimmer 대각선 쓸기 대신):
 * 새 장비가 가방 칸 · 장비 칸에 처음 보일 때 (앱을 켠 동안 칸마다 한 번) 장비 그림 모양 위로 빛이 비스듬히 지나가고,
 * Codex 별빛 (fx-gear-twinkle)이 오른쪽 위에서 크게 · 왼쪽 아래에서 작게 반짝. 칸마다 조금씩 늦게 (차례로 반짝).
 * 시각 효과 줄이기면 움직임 없이 오른쪽 위 작은 별빛만 (새것인 동안). 시트가 열려 있으면 없음
 */
const twinkled = new Set<string>();
/** 하단 「캐릭터」 탭에 마지막으로 그린 빨간 점 */
let tabDot = false;
/** 이번 그리기에서 반짝인 칸 수 (차례로 늦게) */
let twinkleN = 0;
/** 이번 방문에 장착한 장비 (장비 칸 반짝용) */
let wornNow = 0;
function newFx(it: GearItem, at: 'b' | 's'): string {
  const star = art('fx-gear-twinkle');
  if (sheet || !star) return '';
  if (G.save.settings.reducedEffects) return at === 'b' && isNewGear(it) ? `<span class="c7-twk calm" aria-hidden="true"><img class="c7-twk-a" src="${star}" alt=""></span>` : '';
  const k = `${at}${it.id}`;
  if (twinkled.has(k) || !(isNewGear(it) || (at === 's' && wornNow === it.id))) return '';
  twinkled.add(k);
  const ia = gearArt(it), d = (Math.min(twinkleN++, 10) * 0.09).toFixed(2);
  return `<span class="c7-twk" style="--d:${d}s${ia ? `;--ia:url('${ia}')` : ''}" aria-hidden="true">${ia ? '<i class="c7-twk-sheen"></i>' : ''}<i class="c7-twk-glow"></i><img class="c7-twk-a" src="${star}" alt=""><img class="c7-twk-b" src="${star}" alt=""></span>`;
}

/** 이름 글자 색 (등급 색을 밝게, 시안 CharGear27) */
const GRADE_INK: Record<ItemGrade, string> = { '일반': '#E4E0D8', '고급': '#8BEA9C', '희귀': '#8DBEFF', '영웅': '#D7A6FF', '전설': '#FFE680' };
/** 등급 색 · 글자 색, 세력 생김새면 세력 색 (안쪽 테두리, 34 6-10 ②) */
const gvars = (it: GearItem) => `--g:${GRADE_STYLE[it.grade].color};--gi:${GRADE_INK[it.grade]}${it.look ? `;--lk:${FACTIONS[it.look].color}` : ''}`;
/** 품질 (91): 희귀 이상 굴림 평균 130% 「정교한」 · 145% 「완벽한」. 이름 앞 작은 말 (성능은 굴림 그대로) */
const qualityTxt = (it: GearItem) => { const q = qualityOf(it); return q ? `${q} ` : ''; };
const qualityTag = (it: GearItem) => { const q = qualityOf(it); return q ? `<span class="c7-q" data-q="${q}">${q}</span> ` : ''; };
/** 비율 → 퍼센트: 소수 둘째 자리 이하를 버리고 한 자리 고정. 부동소수점 경계 오차만 보정한다. */
const pc = (x: number) => (Math.sign(x) * Math.trunc((Math.abs(x) + Number.EPSILON) * 1000) / 10).toFixed(1);
/** 옵션 값 글자 (2026-10-13 Lim): 지능 · 체력은 수치 (정수, 천 단위 쉼표), 치명타 · 가속 · 정신력 · 인내는 고정 % */
const optTxt = (k: StatKey, v: number, lv: number) => (isPointStat(k) ? fmt(Math.round(toPoints(k, v, lv))) : `${pc(v)}%`);
/** 장비 그림 (36 4-2 · 4-3): 이름 있는 장신구 → 종류 → 부위 (item-<부위>) → 부위 선 아이콘. 빈칸은 부위 그림 */
const itemIc = (x: SlotKey | Parameters<typeof gearIcon>[0]) => gearIcon(typeof x === 'string' ? { slot: x } : x);

/** 능력치 그림 (stat-<이름>). 없으면 선 아이콘 */
const STAT_LINE = {
  hp: line('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>', 2.2),
  heal: line('<path d="M12 5v14M5 12h14"/>', 2.4),
  crit: line('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"/>'),
  haste: line('<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l3 2M10 3h4"/>', 2.2),
  regen: line('<path d="M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z"/>', 2.2),
  stamina: line('<path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6z"/>', 2.2),
};
const statIc = (k: keyof typeof STAT_LINE) => gameIcon(k, STAT_LINE[k], 'stat');

/** ① 장비 칸 (시안 .slot): 칸 바탕 = 등급 색 (2026-10-16 Lim, 등급 글자 칩 없음 · 등급은 접근 가능한 이름에) · 더 좋은 장비 초록 ↑ · 빈칸은 가방 개수 (91: 강화 +n 없음) */
/** 특수능력 묶음 표식 (36 I `spec-*`): 그림이 있으면 그림, 없으면 묶음 글자. trinket = 도감 고유 칸의 이름 있는 장신구 키 (36 4-3 그림, 없으면 글자) */
const specBadge = (g: CodexGroup, label: string, trinket?: string) => {
  if (g !== 'named') return gameIcon(SPEC_GROUPS[g].icon.replace(/^spec-/, ''), label, 'spec');
  const u = trinketArt(trinket);
  return u ? `<img class="g-ic" src="${u}" alt="" decoding="async" draggable="false">` : label;
};

/** 특수능력 점 (34 10장): 한 줄 = 점 하나 (고유 효과 포함), 지금 직업에 안 맞는 직업 전용은 회색 */
function specDots(it: GearItem): string {
  const rows = specRows(it);
  if (!rows.length) return '';
  return `<i class="c7-dots" aria-hidden="true">${rows.map(r => `<i${/전용$/.test(r.off) ? ' class="off"' : ''}></i>`).join('')}</i>`;
}
const specLabel = (it: GearItem) => { const n = specRows(it).length; return n ? ` · 특수능력 ${n}줄` : ''; };

function slotHtml(key: SlotKey, better: SlotKey[]): string {
  const it = G.save.gear.equipped[key], name = slotName(key);
  const up = better.includes(key) ? '<i class="c7-better" aria-hidden="true">↑</i>' : '';
  if (!it) {
    const n = G.save.gear.bag.filter(x => x.slot === key).length;
    return `<button type="button" class="gtile c7-slot empty" data-gslot="${key}"${n ? '' : ' disabled'} aria-label="${name} 빈칸${n ? ` · 가방에 ${n}개` : ''}">
        <span class="c7-sq">${itemIc(key)}${up}</span><b>${name}</b></button>`;
  }
  return `<button type="button" class="gtile c7-slot" data-gitem="${it.id}" style="${gvars(it)}" aria-label="${name} · ${esc(qualityTxt(it) + it.name)} · ${it.grade}${specLabel(it)}${it.lock ? ' · 잠김' : ''}${up ? ' · 가방에 더 좋은 장비' : ''}">
      <span class="c7-sq${it.grade === LEGEND ? ' lg' : ''}">${itemIc(it)}${newFx(it, 's')}${specDots(it)}${up}</span>
      <b>${it.lock ? LOCK : ''}${name}</b></button>`;
}

/**
 * ② 가운데 능력치 판 (Lim 2026-10-11 「장비 점수 대신 능력치를 가운데에」): 장비 슬롯과 상단을 맞춘 금테 판에 6줄
 * 체력 · 지능 · 치명타 · 가속 · 정신력 · 인내의 합계. 상세 시트에서 각 능력치의 역할을 표시.
 */
function statsHtml(): string {
  const p = statParts();
  const row = (ic: string, k: string, v: string) => `<span class="c7-stat"><span class="c7-si">${ic}</span><small>${k}</small><b>${v}</b></span>`;
  const crit = pc(p.crit.total), haste = pc(p.haste.total), spirit = pc(p.spirit.total), endure = pc(p.endure.total);
  return `<button type="button" class="c7-stats" data-sheet="stats" aria-label="능력치 상세 보기">
      <span class="c7-sh">능력치</span>
      <span class="c7-sgrid">${row(statIc('hp'), '체력', fmt(p.hp.total))}${row(statIc('heal'), '지능', fmt(p.int.total))}${row(statIc('crit'), '치명타', `${crit}%`)}${row(statIc('haste'), '가속', `${haste}%`)}${row(statIc('regen'), '정신력', `${spirit}%`)}${row(statIc('stamina'), '인내', `${endure}%`)}</span>
      <span class="c7-shint">상세 보기 <img src="${art('a2-chevron')}" alt="" aria-hidden="true"></span></button>`;
}

function gearHtml(): string {
  const better = betterSlots();
  const col = (keys: SlotKey[]) => `<div class="c7-col">${keys.map(k => slotHtml(k, better)).join('')}</div>`;
  const keys = SLOTS.map(x => x.key);
  return `<section class="c7-stage" aria-label="착용 장비 · 능력치">
      ${col(keys.slice(0, 3))}
      <div class="c7-mid">${statsHtml()}</div>
      ${col(keys.slice(3))}</section>
    ${inventoryHtml()}`;
}

/** 가방 칸: 장비 그림 + 등급 색 + 새 점. 지금 장비와의 ▲▼ 비교 배지는 없음 (2026-10-17 Lim 「인벤토리에서 아이템 강함 아이콘을 모두 제거」, 비교는 상세 시트 옵션 줄에서) */
function bagCell(it: GearItem): string {
  const nw = isNewGear(it);
  const label = `${it.grade} ${slotName(it.slot)} · ${qualityTxt(it)}${it.name}${it.lv != null ? ` · Lv ${it.lv}` : ''}${specLabel(it)}${nw ? ' · 새것' : ''}${it.lock ? ' · 잠김' : ''}`;
  return `<button type="button" class="c7-bag${it.lock ? ' lock' : ''}${it.grade === LEGEND ? ' lg' : ''}" data-gitem="${it.id}" style="${gvars(it)}" aria-label="${esc(label)}">${itemIc(it)}${newFx(it, 'b')}${specDots(it)}${nw ? '<span class="nw" aria-hidden="true"></span>' : ''}${it.lock ? `<span class="lk">${uiIcon('lock')}</span>` : ''}</button>`;
}

const grip = '<span class="grip" aria-hidden="true"></span>';
const dim = '<div class="sheet-dim" data-sheetx></div>';
const updn = (v: number, unit = '') => (v > 0 ? `<span class="c7-up">▲${v}${unit}</span>` : v < 0 ? `<span class="c7-dn">▼${-v}${unit}</span>` : '<span class="cap">같음</span>');

/**
 * 장비 아래에 항상 보이는 5열 인벤토리. 아이템을 누르면 상세에서 장착·판매한다.
 * 위쪽(착용 장비·능력치)은 움직이지 않고 이 목록만 스크롤 (Lim 2026-10-12): 머리 두 줄 = [인벤토리 · 개수 · 재료] [분류 4칸 · 정렬],
 * 목록은 하단 메뉴 바로 위까지 남은 높이를 다 씀 (최소 3줄). 빈칸은 보이는 줄까지 fillBags가 채움
 */
const EMPTY_CELL = '<span class="c7-bag-empty" aria-hidden="true"></span>';
function inventoryHtml(): string {
  const all = G.save.gear.bag;
  const f = FILTERS.find(x => x.key === bagFilter) || FILTERS[0];
  const list = all.filter(f.ok).sort(SORTS[bagSort].cmp);
  // 가방이나 선택한 분류가 비어 있으면 안내 문구 없이 빈 칸만 표시.
  const used = list.length;
  const emptySlots = EMPTY_CELL.repeat(Math.max(15, Math.ceil(used / 5) * 5) - used);
  // 장비 도감 · 특수능력 도감으로 가는 길 (34 6-10 ④ 「가방 → 도감」, 받을 보상이 있으면 「!」). 2026-10-13 장비 화면 정리에서 빠져 도감 보상 (골드)을 받을 길이 없었음 (QA 2026-10-17)
  const due = dexDue(G.save.gear.dex.length, G.save.gear.dexPaid).steps;
  return `<section class="c7-inventory" aria-label="인벤토리">
      <header class="c7-inventory-head"><h3 id="gearInventoryTitle" tabindex="-1">인벤토리</h3><span class="c7-inventory-count">${all.length}개</span><span class="cap gmats">${goldHave()}</span><button type="button" class="btn2 c7-dexb" data-dex aria-label="도감${due ? ' · 받을 보상 있음' : ''}">${gameIcon('dex', '')}도감${due ? '<span class="g-badge" aria-hidden="true">!</span>' : ''}</button></header>
      <div class="c7-inventory-tools"><div class="c7-fcs" role="group" aria-label="인벤토리 분류">${FILTERS.map(x => `<button type="button" class="c7-fc" data-bfilter="${x.key}" aria-pressed="${bagFilter === x.key}">${x.name}</button>`).join('')}</div><button type="button" class="btn2 c7-sort" data-bsort aria-label="정렬: ${SORTS[bagSort].name}"${all.length ? '' : ' disabled'}>${SORTS[bagSort].name} ▾</button></div>
      ${msg && !sheet ? `<p class="note warn c7-msg" role="status">${esc(msg)}</p>` : ''}
      <div class="c7-bags" role="region" aria-label="인벤토리 아이템" tabindex="0">${list.map(bagCell).join('')}${emptySlots}</div></section>`;
}

/** 목록 창이 3줄보다 길면 (키 큰 화면) 아이템이 적어도 창 아래가 비지 않게, 보이는 줄 끝까지 빈칸을 채움. 창 크기가 바뀔 때마다 (bagWatch) */
function fillBags(): void {
  const list = s.el.querySelector<HTMLElement>('.c7-bags'), cell = list?.querySelector<HTMLElement>('.c7-bag, .c7-bag-empty');
  if (!list || !cell || !list.clientHeight) return;
  const cs = getComputedStyle(list), gap = parseFloat(cs.rowGap) || 0;
  const rows = Math.ceil((list.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) + gap) / (cell.offsetHeight + gap) - 0.05);
  const used = list.querySelectorAll('.c7-bag').length;
  const empties = list.querySelectorAll('.c7-bag-empty'), want = Math.max(15, Math.ceil(used / 5) * 5, rows * 5) - used;
  if (want > empties.length) list.insertAdjacentHTML('beforeend', EMPTY_CELL.repeat(want - empties.length));
  for (let i = empties.length - 1; i >= want; i--) empties[i].remove();
}
const bagWatch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fillBags);

/** 묶음들에서 얻은 칸 수 */
const codexHave = (gs: readonly CodexGroup[]) => gs.reduce((a, g) => a + codexKeys(g).filter(k => G.save.gear.codex.includes(k)).length, 0);
const SPEC_GROUP_KEYS = Object.keys(SPEC_GROUPS) as SpecGroup[];

/** 지난 판에 처음 얻은 칸: 칸 표식 위에서 그림이 칸마다 한 번 (판마다). 효과 줄이기면 없음 */
function freshOnce(pick: (x: Settlement) => readonly string[] | undefined, fx: string, cls: string): (key: string) => string {
  let shown: { of: object; keys: Set<string> } | null = null;
  return key => {
    const x = Flow.settle;
    if (!x || !pick(x)?.includes(key) || G.save.settings.reducedEffects) return '';
    if (shown?.of !== x) shown = { of: x, keys: new Set() };
    if (shown.keys.has(key)) return '';
    shown.keys.add(key);
    return fxArt(fx, cls);
  };
}
/** 특수능력 도감 (42 1-6): fx-spec-new 터짐 (36 4-6) */
const freshFx = freshOnce(x => x.newSpecs, 'fx-spec-new', 'c7-spnew');
/** 장비 도감 (34 6-10 ④): fx-dex-fill 도장 (50 E) */
const dexFillFx = freshOnce(x => x.newDex, 'fx-dex-fill', 'c7-dexfill');
/** 「보상 받기」를 누른 뒤 한 번: 보상 줄에서 fx-dex-reward가 위로 (50 E) */
let dexPop = false;

/** 특수능력 도감 시트 (42 1-6): 묶음 칩 (얻은 수/전체) · 칸 목록 (얻은 것 = 이름 · 효과, 아닌 것 = 「?」 + 나오는 곳) · 받은 칭호 */
function codexSheet(): string {
  const groups: CodexGroup[] = [...SPEC_GROUP_KEYS, 'named'];
  const label = (g: CodexGroup) => (g === 'named' ? '고유' : SPEC_GROUPS[g].name);
  const rows = codexRows(codexG);
  const have = rows.filter(r => r.got).length, title = SPEC_TITLES[codexG], done = G.save.decos.includes(title);
  const titles = groups.map(g => SPEC_TITLES[g]).filter(t => G.save.decos.includes(t));
  return `${dim}<section class="sheet c7-bsheet c7-codex" role="dialog" aria-label="특수능력 도감">${grip}
      <div class="c7-row"><h3 class="h-rule">특수능력 도감</h3><span class="cap">${codexHave(SPEC_GROUP_KEYS)}/${SPEC_KEYS.length} · 고유 ${codexHave(['named'])}/${NAMED.length}</span></div>
      <div class="c7-fcs" role="group" aria-label="도감 묶음">${groups.map(g => `<button type="button" class="c7-fc" data-codexg="${g}" aria-pressed="${codexG === g}">${label(g)} <small>${codexHave([g])}/${codexKeys(g).length}</small></button>`).join('')}</div>
      <p class="cap c7-ctitle">${done ? `칭호 「${esc(title)}」 받음` : `다 모으면 칭호 「${esc(title)}」 (${have}/${rows.length})`}</p>
      <div class="c7-clist">${rows.map(r => `<div class="c7-spec${r.got ? '' : ' unk'}" data-g="${codexG}"><span class="c7-spg">${specBadge(codexG, label(codexG), r.key)}${r.got ? freshFx(r.key) : ''}</span><span class="c7-spt"><b>${r.got ? esc(r.name) : '?'}</b><span class="cap">${esc(r.got ? r.text : r.hint)}</span></span></div>`).join('')}</div>
      <div class="c7-bagf">${titles.length ? `<span class="cap">받은 칭호 ${titles.map(t => `「${esc(t)}」`).join(' ')}</span>` : '<span class="cap">효과는 영웅 장비 최대값</span>'}${fill}<button type="button" class="btn2" data-dex>장비 도감</button><button type="button" class="btn2" data-sheetx>닫기</button></div></section>`;
}

/** 장비 도감 시트 (34 6-10 ④): 묶음 칩 (얻은 수/전체) · 보상 (10칸마다) · 칸 목록 (얻은 것 = 이름 · 설명, 아닌 것 = 「?」 + 나오는 곳) · 칭호 */
function dexSheet(): string {
  const have = G.save.gear.dex, all = DEX_ALL().length, due = dexDue(have.length, G.save.gear.dexPaid);
  const tab = DEX_TABS.find(t => t.key === dexT)!, rows = dexRows(dexT), got = rows.filter(r => r.got).length, done = G.save.decos.includes(tab.title);
  const next = (Math.floor(have.length / DEX_STEP) + 1) * DEX_STEP;
  const reward = due.steps
    ? `<button type="button" class="btn2 hot" data-dexclaim>보상 받기 ${currencyAmount('gold', due.gold)}</button>`
    : `<span class="cap">${next <= all ? `${next}칸을 채우면 골드 (지금 ${have.length})` : '보상을 모두 받았습니다'}</span>`;
  const count = (t: DexTab) => dexKeys(t).filter(k => have.includes(k)).length;
  const pop = dexPop && !G.save.settings.reducedEffects ? fxArt('fx-dex-reward', 'c7-dexpop') : '';
  dexPop = false;
  // 도감 그림 (50 D icon-dex · icon-dex-<묶음> · icon-dex-reward): 없으면 글자만
  return `${dim}<section class="sheet c7-bsheet c7-codex c7-dex" role="dialog" aria-label="장비 도감">${grip}
      <div class="c7-row"><h3 class="h-rule">${gameIcon('dex', '')}장비 도감</h3><span class="cap">${have.length}/${all}</span></div>
      <div class="c7-fcs" role="group" aria-label="도감 묶음">${DEX_TABS.map(t => `<button type="button" class="c7-fc" data-dext="${t.key}" aria-pressed="${dexT === t.key}">${gameIcon(`dex-${t.key}`, '')}${t.name} <small>${count(t.key)}/${dexKeys(t.key).length}</small></button>`).join('')}</div>
      <div class="c7-dexr">${gameIcon('dex-reward', '')}${reward}${pop}</div>
      ${msg ? `<p class="note c7-msg">${esc(msg)}</p>` : ''}
      <p class="cap c7-ctitle">${done ? `칭호 「${esc(tab.title)}」 받음` : `다 모으면 칭호 「${esc(tab.title)}」 (${got}/${rows.length})`}</p>
      <div class="c7-clist">${rows.map(r => `<div class="c7-spec c7-dexc${r.got ? '' : ' unk'}"${r.look ? ` style="--look:${FACTIONS[r.look].color}"` : ''}><span class="c7-spg">${itemIc(r.got ? r : r.slot)}${r.got ? dexFillFx(r.key) : ''}</span><span class="c7-spt"><b>${r.got ? esc(r.name) : '?'}</b><span class="cap">${esc(r.got ? r.text : r.hint)}</span></span></div>`).join('')}</div>
      <div class="c7-bagf"><span class="cap">처음 얻으면 칸이 채워짐 · 능력치 보너스 없음</span>${fill}<button type="button" class="btn2" data-codex>특수능력 ${codexHave(SPEC_GROUP_KEYS)}/${SPEC_KEYS.length}</button><button type="button" class="btn2" data-sheetx>닫기</button></div></section>`;
}

/** 장비 상세 시트 (27 4-3, 시안 GearSheet27): 지금 장비와 비교 ▲▼ · 그 장비 범위 · 잠금 · 판매 · 장착 */
/** 재설정 ↻ 버튼 (재설정 모드일 때만) */
const rrBtn = (kind: RerollKind, i: number, name: string) => (rrOn ? `<button type="button" class="c7-rr" data-rr="${kind}:${i}" aria-label="${esc(name)} 다시 굴림">↻</button>` : '');
/** 재설정 비용 줄 (34 6-8): 무작위 옵션 한 줄 · 특수능력 한 줄 (3배) 중 그 장비에 있는 줄만, 가진 골드 (91). 희귀까지는 특수능력이 없어 옵션만 */
function rrCostHtml(it: GearItem): string {
  const have = resourceBalance(G.save, 'gold');
  const parts: [string, number][] = [];
  if (it.lines.length) parts.push(['옵션', rerollCost(it, false).gold]);
  if (it.specs?.length) parts.push(['특수능력', rerollCost(it, true).gold]);
  const last = parts.length - 1;
  return `<p class="cap c7-rrcost">한 줄 다시 굴림 · ${parts.map(([name, gold], i) => `${name} ${currencyAmount('gold', gold, i === last && isFinite(have) ? { have } : {})}`).join(' · ')}</p>`;
}
/** 가진 골드 (인벤토리 머리). 개발 빌드 골드 무제한이면 ∞ */
function goldHave(): string {
  const have = resourceBalance(G.save, 'gold');
  return currencyAmount('gold', isFinite(have) ? have : '∞');
}
/** Lv 60 재설정 둘째 후보: 「이걸로」 누르면 바꿈 */
function rrAltHtml(it: GearItem, kind: RerollKind): string {
  if (!rrAlt || rrAlt.id !== it.id || rrAlt.kind !== kind) return '';
  let txt: string;
  if (kind === 'line') { const l = rrAlt.alt as GearLine, lv = G.save.player.level; txt = `${STATS[l.stat].name} +${optTxt(l.stat, lineValue(it, l, lv), lv)}`; }
  else { const l = rrAlt.alt as SpecLine, d = SPECS[l.key]; txt = `${d.name} · ${specText(d, specValue(l.key, it.grade, l.roll))}`; }
  return `<div class="c7-rralt"><span class="cap">다른 후보</span><b>${esc(txt)}</b><button type="button" class="btn2" data-rrpick>이걸로</button></div>`;
}

function itemSheet(id: number): string {
  const it = findItem(id);
  if (!it) return '';
  const readOnly = !!itemOverlay;
  const eq = G.save.gear.equipped, worn = eq[it.slot]?.id === it.id, cur = worn ? null : eq[it.slot] ?? null;
  const lv = G.save.player.level, a = itemStats(it, lv), b = itemStats(cur, lv);
  // 아이템 레벨 (2026-10-13): 지능 · 체력 수치가 아이템 레벨을 따름
  const sub2 = [it.grade, slotName(it.slot), it.lv != null ? `Lv\u00a0${it.lv}` : '', worn ? '착용 중' : '미장착'].filter(Boolean).join(' · ');
  // 지금 장비와 차이: 지능 · 체력은 수치 (10 아래는 소수 한 자리), 나머지는 퍼센트 포인트 (소수 한 자리)
  const d1 = (k: StatKey) => {
    if (!isPointStat(k)) return Number(pc(a[k] - b[k]));
    const x = toPoints(k, a[k] - b[k], lv);
    return Math.abs(x) >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
  };
  const row = (k: string, v: string, right: string, cls = '') => `<div class="c7-cmp${cls}"><span>${k}</span><b>${v}</b>${right}</div>`;
  // 옵션 줄 (Lim 2026-10-11): 왼쪽 = 능력치 · 값, 오른쪽 = 지금 장비와 차이 ▲▼ (착용 중이면 비움). 재설정 모드면 무작위 옵션 오른쪽에 굴림 막대 + ↻.
  // 값 아래 작은 글자 = 이 장비에서 그 줄이 나올 수 있는 범위 (91 디아2식: 굴림 50% ~ 160%), 굴림 막대 = (굴림 − 50%) ÷ 110%
  const opts = optionsOf(it, lv), has = new Set(opts.map(o => o.stat));
  const own = opts.map(o => {
    const l = o.line != null ? it.lines[o.line] : null;
    const right = rrOn && l ? `<span class="c7-roll" role="img" aria-label="굴림 ${Math.round(l.roll * 100)}%"><i style="width:${Math.round(optFill(l.roll) * 100)}%"></i></span>${rrBtn('line', o.line!, STATS[o.stat].name)}` : worn || rrOn ? '' : d1(o.stat) === 0 ? '<span class="c7-same" aria-label="같음">—</span>' : updn(d1(o.stat));
    const range = `${optTxt(o.stat, o.lo, lv)}~${optTxt(o.stat, o.hi, lv)}`;
    return row(STATS[o.stat].name, `+${optTxt(o.stat, o.v, lv)}<small class="c7-rng" aria-label="범위 ${range}">${range}</small>`, right);
  }).join('');
  // 지금 장비에만 있는 능력치: 빠지는 만큼 ▼ 한 줄로
  const lost = worn || rrOn ? [] : STAT_KEYS.filter(k => !has.has(k) && b[k] > 0);
  const lostHtml = lost.length ? `<p class="c7-lost"><span class="cap">빠지는 옵션</span>${lost.map(k => `<span>${STATS[k].name} ${updn(d1(k))}</span>`).join('')}</p>` : '';
  const cmpCap = worn ? '' : cur ? '착용 장비 대비' : '빈 장비칸 대비';
  // 특수능력 (42 1-3 · 1-5): 묶음 표식 · 이름 · 효과 · 굴림 막대, 꺼진 줄은 회색 + 이유. 전설은 「고유 능력」 (Lim 2026-10-11 「전설에만 고유 능력」)
  const sp = specRows(it), legend = it.grade === LEGEND;
  const spec = sp.length ? `<div class="c7-cmpw${legend ? ' c7-legend' : ''}"><h3 class="h-rule c7-h3">${legend ? (sp.length > 1 ? '고유 능력 · 특수능력' : '고유 능력') : '특수능력'}<span class="rule"></span></h3>${sp.map(s => `<div class="c7-spec${s.off ? ' off' : ''}" data-g="${s.group}"><span class="c7-spg">${specBadge(s.group, s.badge)}</span><span class="c7-spt"><b>${esc(s.name)}${SPECS[s.key]?.hero ? ` <small>${HEROES[SPECS[s.key].hero!].name} 전용</small>` : ''}</b><span class="cap">${esc(s.text.replace(/^내가 거는 보호막 /, '보호막 '))}</span></span>${s.off ? `<span class="cap c7-spoff">${/전용$/.test(s.off) ? '비활성' : s.off}</span>` : rrOn && s.roll != null ? `<span class="c7-roll" role="img" aria-label="굴림 ${Math.round(s.roll * 100)}%"><i style="width:${Math.round(rollFill(s.roll) * 100)}%"></i></span>` : ''}${s.i != null ? rrBtn('spec', s.i, s.name) : ''}</div>`).join('')}${rrAltHtml(it, 'spec')}</div>` : '';
  return `${dim}<section class="sheet c7-gsheet" role="dialog" aria-labelledby="gearSheetTitle" style="${gvars(it)}">
      <div class="c7-dialog-head"><h3 id="gearSheetTitle">장비 상세</h3><button type="button" class="btn2 c7-dialog-close" data-sheetx aria-label="장비 상세 닫기">닫기</button></div>
      <div class="c7-ghead"><span class="c7-gic">${itemIc(it)}</span>
        <span class="c7-gname"><b>${qualityTag(it)}${esc(it.name)}</b><span class="cap">${sub2}</span></span></div>
      <div class="c7-cmpw c7-opts"><h3 class="h-rule c7-h3">능력치<span class="rule"></span><span class="cap">${rrOn ? '재설정할 줄의 ↻' : cmpCap}</span>${!readOnly && rerollOpen() && (it.lines.length || it.specs?.length) ? `<button type="button" class="btn2 c7-rrb" data-rrmode aria-pressed="${rrOn}">재설정</button>` : ''}</h3>${rrOn ? rrCostHtml(it) : ''}${own}${lostHtml}${rrAltHtml(it, 'line')}</div>
      ${spec}
      ${readOnly ? '' : `${msg ? `<p class="note warn c7-msg">${esc(msg)}</p>` : ''}
      <div class="c7-sbtns">
        <button type="button" class="c7-sb c7-lockb" data-lock="${it.id}" aria-pressed="${!!it.lock}">${uiIcon('lock')}<small>${it.lock ? '잠김' : '잠금'}</small></button>
        <button type="button" class="c7-sb c7-salvb" data-sell1="${it.id}"${worn || it.lock ? ' disabled' : ''}>판매<small>${worn ? '착용 중' : it.lock ? '잠김' : currencyAmount('gold', sellGold(it))}</small></button>
        <button type="button" class="c7-cta" data-equip="${it.id}"${worn ? ' disabled' : ''}>${worn ? '착용 중' : '장착'}</button>
      </div>`}</section>`;
}

/** 판매 확인창 (91, 예전 분해 확인). 판매한 장비는 되돌릴 수 없음 */
function confirmHtml(): string {
  if (!pending) return '';
  const it = findItem(pending.id);
  if (!it) return '';
  return `<button type="button" class="sheet-dim c7-confirm-dim" data-confirmcancel aria-label="확인 취소" tabindex="-1"></button>
    <section class="sheet c7-confirm still" role="dialog" aria-labelledby="gearConfirmTitle" aria-describedby="gearConfirmDesc">
      <h3 id="gearConfirmTitle">장비 판매</h3>
      <div class="c7-confirm-item" style="${gvars(it)}"><span class="c7-confirm-icon">${itemIc(it)}</span><b>${qualityTag(it)}${esc(it.name)}</b></div>
      <div class="c7-confirm-cost"><span>받는 골드</span><div>${currencyAmount('gold', sellGold(it))}</div></div><p id="gearConfirmDesc">판매한 장비는 되돌릴 수 없습니다.</p>
      <div class="c7-confirm-actions"><button type="button" data-confirmcancel>취소</button><button type="button" class="hot" data-confirmgo>판매하기</button></div>
    </section>`;
}

/** 확인창에서만 실행한다. 실행 전에 대상을 다시 확인하고, 중복 클릭은 무시한다. */
function confirmAction(): void {
  const action = pending;
  if (!action) return;
  const it = findItem(action.id);
  pending = null;
  if (!it || sheet?.k !== 'item' || sheet.id !== action.id) { render(); return; }
  const visibleIds = Array.from(s.el.querySelectorAll<HTMLElement>('.c7-inventory [data-gitem]')).map(el => Number(el.dataset.gitem));
  const index = visibleIds.indexOf(action.id), next = visibleIds[index + 1] ?? visibleIds[index - 1];
  const r = sell([action.id]);
  msg = r.n ? `판매: 골드 +${fmt(r.gold)}` : '';
  if (r.n) { sheet = null; rrOn = false; rrAlt = null; }
  render();
  if (r.n) {
    const target = s.el.querySelector<HTMLElement>(`.c7-inventory [data-gitem="${next}"]`) || s.el.querySelector<HTMLElement>('#gearInventoryTitle');
    target?.focus({ preventScroll: true });
  }
}

/** 능력치 상세: 실제 총합과 전투에서의 역할. */
function statsSheet(): string {
  const p = statParts();
  const row = (k: string, v: string, desc: string) => `<div class="c7-src"><span>${k}</span><b>${v}</b><span class="cap">${desc}</span></div>`;
  return `${dim}<section class="sheet c7-ssheet" role="dialog" aria-label="능력치 상세">${grip}
      <h3 class="h-rule">능력치 상세<span class="rule"></span></h3>
      <div class="c7-srcs">
        ${row('체력', fmt(p.hp.total), '내가 버틸 수 있는 최대 생명력')}
        ${row('지능', fmt(p.int.total), '치유 스킬의 회복량 증가')}
        ${row('치명타', `${pc(p.crit.total)}%`, '치유가 더 강하게 발동할 확률')}
        ${row('가속', `${pc(p.haste.total)}%`, '시전 시간과 공통 대기시간 단축')}
        ${row('정신력', `${pc(p.spirit.total)}%`, '마나 자동 회복 속도 증가')}
        ${row('인내', `${pc(p.endure.total)}%`, '내가 받는 피해 감소')}
      </div>
      <button type="button" class="c7-cta" data-sheetx>닫기</button></section>`;
}

// ---------- 스킬 (27 4-4, 시안 CharSkill31) ----------
const lockLv = (k: SkillKey) => (SKILL_LEVEL[k] > healerLevel() ? SKILL_LEVEL[k] : 0);
/** 펼친 줄 (스킬 키 · words · pas) */
let skOpen: string | null = null;

/** 스킬 선 아이콘 (skill-<키> 그림이 없을 때). 사제 = 시안 CharSkill31. 79 직업 4종은 그림 (80 3장)이 올 때까지 같은 칸 사제 선 아이콘 (SLOT_LINE) */
const SKILL_LINE: Partial<Record<SkillKey, string>> = {
  heal: '<path d="M12 5v14M5 12h14"/>',
  flash: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  renew: '<path d="M12 21v-9"/><path d="M12 12c-4 0-6-3-6-7 4 0 6 3 6 7z"/><path d="M12 14c3 0 5-2 5-5-3 0-5 2-5 5z"/>',
  poh: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="5" r="1.6"/><circle cx="18" cy="15.5" r="1.6"/><circle cx="6" cy="15.5" r="1.6"/>',
  purify: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z"/>',
  guardian: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 11c1.5-2 4.5-2 6 0"/>',
  hymn: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  serenity: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  relay: '<path d="M20 8.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 1 1 9 0zM11 13 3.5 20.5M9.5 10.5 5 15M13.5 14.5 9 19"/>',
  sprout: '<path d="M12 21v-8"/><path d="M12 13c-3.5 0-5.5-2.5-5.5-6 3.5 0 5.5 2.5 5.5 6zM12 13c3.5 0 5.5-2.5 5.5-6-3.5 0-5.5 2.5-5.5 6z"/>',
  growth: '<path d="M8 21c0-5 8-5 8-10S8 6 12 3"/><path d="M16 11c2 0 3.5-1 4-3-2 0-3.5 1-4 3zM9 15c-2 0-3.5-1-4-3 2 0 3.5 1 4 3z"/>',
  bloom: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C10 6 10.5 3.5 12 3c1.5.5 2 3 0 6.5zM14.5 12c3.5-2 6-1.5 6.5 0-.5 1.5-3 2-6.5 0zM12 14.5c2 3.5 1.5 6 0 6.5-1.5-.5-2-3 0-6.5zM9.5 12C6 14 3.5 13.5 3 12c.5-1.5 3-2 6.5 0z"/>',
  wildflower: '<circle cx="6" cy="9" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 11v9M12 8v12M18 11v9M3 20h18"/>',
  natureCleanse: '<path d="M5 19C-1 8 10 3 21 3c0 11-5 20-16 16Z"/><path d="M5 19l10-10"/>',
  bark: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5c-3 1-4 4-3 7M15 8c1 2 1 5-1 7M9 17c2 1 4 1 6-1"/>',
  quietwood: '<path d="M6 20v-4M12 20v-6M18 20v-4"/><path d="M3.5 16 6 10l2.5 6zM9 14l3-8 3 8zM15.5 16 18 10l2.5 6z"/>',
  rebirth: '<path d="M12 21a5 5 0 0 1-5-5c0-3 2.5-4.5 5-9 2.5 4.5 5 6 5 9a5 5 0 0 1-5 5z"/><path d="M12 21c-1.4 0-2.5-1-2.5-2.5S12 15 12 15s2.5 2 2.5 3.5S13.4 21 12 21z"/>',
  holyLight: '<path d="M7 21v-9a1.5 1.5 0 0 1 3 0V5a1.5 1.5 0 0 1 3 0v6V4.5a1.5 1.5 0 0 1 3 0V12V8a1.5 1.5 0 0 1 3 0v7c0 3.5-2.5 6-6 6z"/>',
  beacon: '<path d="M12 2c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7z"/><path d="M8 14h8l-1 8H9z"/>',
  oath: '<path d="M6 4h12v13l-6 4-6-4z"/><path d="M9 10l2 2 4-4"/>',
  lightWave: '<path d="M2 11c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4 2.5 4 5 4M2 18c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4 2.5 4 5 4"/>',
  handCleanse: '<path d="M7 21v-8a1.5 1.5 0 0 1 3 0V7a1.5 1.5 0 0 1 3 0v5V7a1.5 1.5 0 0 1 3 0v8c0 3.5-2.5 6-6 6z"/><path d="M19 2l.7 1.8 1.8.7-1.8.7L19 7l-.7-1.8-1.8-.7 1.8-.7z"/>',
  sacrifice: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M12 15s-3-1.8-3-4a1.6 1.6 0 0 1 3-1 1.6 1.6 0 0 1 3 1c0 2.2-3 4-3 4z"/>',
  sanctuary: '<path d="M4 18a8 8 0 0 1 16 0z"/><path d="M2 18h20M12 7V3"/>',
  handGuard: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M10 15v-4.5a1 1 0 0 1 2 0V9a1 1 0 0 1 2 0v6"/>',
};
/** 선 아이콘이 없는 스킬: 같은 휠 칸의 사제 스킬 선 아이콘 (가운데 스킬은 고유 칸) */
const SLOT_LINE: Record<SlotName, SkillKey> = { basic: 'heal', fast: 'flash', hot: 'renew', aoe: 'poh', dispel: 'purify', ext: 'guardian', raid: 'hymn', unique: 'relay' };
/** 스킬 그림 (skill-<키>, 없으면 선 아이콘) */
const skillIc = (k: SkillKey) => gameIcon(k, line(SKILL_LINE[k] ?? SKILL_LINE[SLOT_LINE[SKILLS[k].slot]]!), 'skill');

/** 시전 글자 (시안: 시전 1.8초 / 즉시 / 4초 정신 집중) */
const castShort = (k: SkillKey) => { const sk = SKILLS[k]; return sk.channel ? `${sk.channel}초 정신 집중` : sk.cast ? `시전 ${sk.cast}초` : '즉시'; };
const costShort = (k: SkillKey) => { const sk = SKILLS[k]; return sk.cost ? `마나 ${sk.cost}%` : sk.power ? `신성한 힘 ${sk.powerAll ? '전부' : sk.power}` : '마나 0'; };
/** 휠 칸 아래 작은 글자: 마나 % (성기사 힘 스킬은 힘) */
const costTiny = (k: SkillKey) => { const sk = SKILLS[k]; return sk.cost ? `${sk.cost}%` : sk.power ? `힘 ${sk.powerAll ? '전부' : sk.power}` : ''; };

/** 이 스킬이 휠 어디에 있는지 (8번째 칸은 빈 방향) */
function dirOf(k: SkillKey, lay: Record<string, string | null>): string | null {
  const id = slotIdOf(k);
  return Object.keys(lay).find(d => (lay[d] || 'unique') === id) || null;
}

/** 휠 칸 = 금테 메달 (방향 화살표 · 스킬 그림 · 짧은 이름 · 마나 %), 가운데 = 파란 마나 구슬 */
function wheelCell(d: string | null, lay: Record<string, string | null>): string {
  const L = battle().layout;
  if (!d) return '<span class="c7-wh core" aria-hidden="true"><span><b>100</b><small>마나</small></span></span>';
  const k = skillOfDir(lay, d), lock = k ? lockLv(k) : 0, on = sel === d;
  if (!k) return `<button type="button" class="lslot c7-wh empty" data-ldir="${d}" aria-pressed="${on}" aria-label="${L.ARROW[d]} 비어 있음"><b>비어 있음</b></button>`;
  const tiny = lock ? `${LOCK}Lv ${lock}` : costTiny(k);
  return `<button type="button" class="lslot c7-wh${lock ? ' locked' : ''}" data-ldir="${d}" aria-pressed="${on}" aria-label="${L.ARROW[d]} ${SKILLS[k].name}${lock ? ` · Lv ${lock}에 배움` : ''}"><i class="c7-ar">${L.ARROW[d]}</i><span class="c7-si">${skillIc(k)}</span><b>${SKILLS[k].short}</b>${tiny ? `<small>${tiny}</small>` : ''}</button>`;
}

/** 휠 아래 양피지 설명 (높이 고정): 보기 = 고른 칸 설명, 바꾸기 = 안내 + 기본 배치로 */
function descBox(lay: Record<string, string | null>): string {
  const L = battle().layout, h = hero();
  if (swapping) {
    const changed = JSON.stringify(L.READ_ORDER.map(d => lay[d] || null)) !== JSON.stringify(L.READ_ORDER.map(d => L.DEFAULT_LAYOUT[d] || null));
    const k = sel ? skillOfDir(lay, sel) : null, w = sel ? (k ? SKILLS[k].name : '빈자리') : '';
    return `<section class="c7-sdesc c7-parch swap" aria-live="polite"><h3>배치 바꾸기<small>${sel ? `${L.ARROW[sel]} ${esc(w)}${josa(w, '과', '와')} 바꿀 자리 선택` : '두 자리를 차례로 누르면 서로 바뀜'}</small></h3>
        <p class="c7-sdt">빈자리와도 바꿀 수 있습니다.</p>
        <div class="c7-sdb"><button class="g-seal" type="button" id="layReset"${changed ? '' : ' disabled'}>기본 배치로</button></div></section>`;
  }
  const k = sel ? skillOfDir(lay, sel) : null;
  if (!sel) return `<section class="c7-sdesc c7-parch" aria-live="polite"><h3>스킬 휠<small>칸을 누르면 설명</small></h3>
      <p class="c7-sdt">전투에서 칸을 그 방향으로 쓸면 그 스킬을 씁니다. 칸을 탭하면 칸 탭 기본 힐을 씁니다.</p></section>`;
  if (!k) return `<section class="c7-sdesc c7-parch" aria-live="polite"><h3>비어 있음<small>휠 ${L.ARROW[sel]}</small></h3>
      <p class="c7-sdt">빈 자리입니다. 배치 바꾸기로 다른 스킬을 이 자리로 옮길 수 있습니다.</p></section>`;
  const lock = lockLv(k), sk = SKILLS[k];
  const meta = [costShort(k), castShort(k), sk.cd ? `재사용 ${sk.cd}초` : '', `Lv ${SKILL_LEVEL[k]}`].filter(Boolean).join(' · ');
  return `<section class="c7-sdesc c7-parch" aria-live="polite"><h3>${sk.name}<small>${meta}</small></h3>
      <p class="c7-sdt">${esc(skDesc(k))}</p>
      <p class="m c7-sdm">${descHint(k, sel, h)}${lock ? ` ${LOCK}Lv ${lock}에 배웁니다.` : ''}</p></section>`;
}
/** 스킬 설명: 회복량은 「지능의 n% (지금 값)」 (34 1-2) */
const skDesc = (k: SkillKey) => healText(SKILL_INFO[k].desc, statParts().int.total);
/** 설명 아래 한 줄: 종류 · 쓰는 방향 · 칸 탭 */
const descHint = (k: SkillKey, d: string, h: HeroKey) => `${SKILL_INFO[k].kind} · 휠에서 ${battle().layout.ARROW[d]} 쪽으로 쓸면 씁니다.${skillAt(h, G.save.settings.tapKey) === k ? ' 칸 탭 기본 힐입니다.' : ''}`;

let measure: CanvasRenderingContext2D | null = null;
/**
 * 양피지 설명 높이 고정 (27 4-4: 눌러도 아래가 흔들리지 않게). 이 직업 휠 스킬 설명·안내 줄 중 가장 긴 것이 들어가는 높이.
 * 설명 두 줄 + 안내 한 줄 = 시안 112px, 한 줄 늘 때마다 19px. 폭은 기기마다 달라서 글자 폭을 재서 줄 수를 셈
 */
function fitDesc(): void {
  const box = s.el.querySelector<HTMLElement>('.c7-sdesc'), txt = box?.querySelector<HTMLElement>('.c7-sdt');
  if (!box || !txt) return;
  const w = txt.clientWidth;
  measure ||= document.createElement('canvas').getContext('2d');
  if (!measure || w <= 0) return;
  const cs = getComputedStyle(txt);
  // 낱말 단위로 줄이 바뀌어(keep-all) 끝에 남는 자리만큼 넉넉히 1.1배
  const lines = (t: string, font: string) => { measure!.font = font; return Math.ceil((measure!.measureText(t).width * 1.1) / w); };
  const ks = heroSkills(hero()).filter(k => k !== 'serenity');
  const body = Math.max(2, ...ks.map(k => lines(skDesc(k), `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`)));
  const small = `400 12px ${cs.fontFamily}`;
  const hint = Math.max(1, ...ks.map(k => lines(`${descHint(k, 'NE', hero())} 칸 탭 기본 힐입니다. Lv 15에 배웁니다.`, small)));
  box.style.height = `${112 + (body - 2) * 19 + (hint - 1) * 17}px`;
}

/** 패시브 목록 (사제: 평온 게이지 포함 4개, 다른 직업: 고유 시스템 + 패시브) */
function passivesOf(h: HeroKey): { name: string; lv: number; desc: string; kind: string }[] {
  if (h === 'priest') return (['echo', 'grace', 'symbol', 'words'] as PassiveKey[]).map(x => ({ name: PASSIVE_NAME[x], lv: PASSIVE_LEVEL[x], desc: PASSIVE_DESC[x], kind: x === 'words' ? '고유 시스템' : '패시브' }));
  return [{ ...HEROES[h].system, kind: '고유 시스템' }, ...HEROES[h].passives.map(p => ({ ...p, kind: '패시브' }))];
}

function skillRows(lay: Record<string, string | null>): string {
  const L = battle().layout, h = hero(), lv = healerLevel();
  const rows = heroSkills(h).filter(k => k !== 'serenity').map(k => {
    const lock = lockLv(k), d = dirOf(k, lay), open = skOpen === k, sk = SKILLS[k];
    const meta = [SKILL_INFO[k].kind, castShort(k), costShort(k), sk.cd ? `${sk.cd}초` : ''].filter(Boolean).join(' · ');
    return `<button type="button" class="c7-sk${lock ? ' locked' : ''}${d && sel === d && !swapping ? ' on' : ''}" data-skill="${k}" aria-expanded="${open}">
        <span class="c7-ski">${skillIc(k)}</span><span class="c7-skn"><b>${sk.name}</b><span>${lock ? `${LOCK}Lv ${lock}에 배움 · ` : ''}${meta}</span></span><span class="c7-dir">${d ? L.ARROW[d] : ''}</span></button>
      ${open ? `<p class="c7-skd">${esc(skDesc(k))}</p>` : ''}`;
  });
  if (h === 'priest') {
    const lock = lv < PASSIVE_LEVEL.words ? PASSIVE_LEVEL.words : 0, open = skOpen === 'words';
    rows.push(`<button type="button" class="c7-sk holy${lock ? ' locked' : ''}" data-skrow="words" aria-expanded="${open}"><span class="c7-ski">${skillIc('serenity')}</span><span class="c7-skn"><b>${SKILLS.serenity.name}</b><span>${lock ? `${LOCK}Lv ${lock}에 배움 · ` : ''}평온 게이지 100%에서 치유 칸이 바뀜 · 마나 0</span></span><span class="c7-dir"></span></button>
      ${open ? `<p class="c7-skd"><b>${SKILLS.serenity.name}</b> ${esc(skDesc('serenity'))}</p>` : ''}`);
  }
  const pas = passivesOf(h), open = skOpen === 'pas';
  rows.push(`<button type="button" class="c7-sk pas" data-skrow="pas" aria-expanded="${open}"><span class="c7-ski">${line('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5"/>')}</span><span class="c7-skn"><b>패시브 ${pas.length}</b><span>${pas.map(p => p.name).join(' · ')}</span></span><span class="c7-dir">${open ? '▴' : '▾'}</span></button>
    ${open ? `<ul class="c7-pas">${pas.map(p => `<li class="${p.lv > lv ? 'locked' : ''}"><b>${p.name}</b><span class="cap">${p.kind} · ${p.lv > lv ? `${LOCK}Lv ${p.lv}에 배움` : `Lv ${p.lv}`}</span><p>${esc(healText(p.desc, statParts().int.total))}</p></li>`).join('')}</ul>` : ''}`);
  return rows.join('');
}

function skillHtml(): string {
  const st = G.save.settings, L = battle().layout, lay = layoutNow(), h = hero();
  const tapSkill = (skillAt(h, st.tapKey) && SKILLS[skillAt(h, st.tapKey)!].target === 'ally' ? skillAt(h, st.tapKey) : null) || skillAt(h, 'heal')!, basic = skillAt(h, 'heal')!;
  const tapLock = lockLv(tapSkill);
  const taps = (Object.keys(battle().tapKeys) as TapKey[]).filter(t => SKILLS[skillAt(h, t)!].target === 'ally').map(t => { // 아군에게 거는 스킬만 (2026-10-16: 주술사 · 결계사 빠른 힐 칸이 샘 토템 · 심판)
    const k = skillAt(h, t)!, lk = lockLv(k);
    return `<button type="button" data-tap="${t}" aria-pressed="${st.tapKey === t}"${lk ? ` disabled title="Lv ${lk}에 배움"` : ''}>${lk ? LOCK : ''}${SKILLS[k].name}</button>`;
  }).join('');
  return `<div class="c7-mode" role="group" aria-label="휠 보기 방식"><button type="button" data-smode="view" aria-pressed="${!swapping}">설명 보기</button><button type="button" data-smode="swap" aria-pressed="${swapping}">배치 바꾸기</button></div>
    <div class="c7-wwrap"><span class="c7-mcircle" aria-hidden="true">${gameIcon('magic-circle', '', 'ui')}</span><div class="c7-wheel${swapping ? ' swapping' : ''}">${L.GRID.map(d => wheelCell(d, lay)).join('')}</div></div>
    ${descBox(lay)}
    <section class="c7-sec"><h2 class="c7-h">칸 탭 기본 힐<span class="rule"></span></h2><div class="c7-taps" role="group" aria-label="칸 탭 기본 힐">${taps}</div>
      ${tapLock ? `<p class="c7-hnote">Lv ${tapLock} 전까진 ${SKILLS[basic].name}${josa(SKILLS[basic].name, '으로', '로')} 탭</p>` : ''}</section>
    <section class="c7-sklist">${skillRows(lay)}</section>`;
}

// ---------- 특성: 어두운 특성판 · 금빛 그림 노드 · 직업별 프리셋 ----------
/**
 * 특성 그림: 정식 그림 `talent-<키>` (78 그림 요청)가 있으면 그것, 없으면 효과에 대응하는 그 직업 스킬 그림 (임시). 저장 키와 단·선택지 순서는 그대로 둔다.
 * 사제 특성은 예전부터 다른 직업 스킬 그림을 빌려 쓰던 것 (78 2장 B에서 정식 그림 요청)
 */
const TALENT_ART: Record<TalentKey, SkillKey> = {
  longBreath: 'renew', lightTouch: 'flash', wideCircle: 'poh',
  brink: 'heal', washed: 'purify', practiced: 'holyLight',
  overflow: 'bloom', hopRenew: 'growth', breather: 'quietwood',
  fullHeart: 'serenity', spreadSerenity: 'serenity', echoWord: 'hymn',
  miracle: 'flash', savedWord: 'oath', cleansingWord: 'natureCleanse',
  repay: 'sacrifice', twoGuard: 'guardian', firmWill: 'handGuard',
  calmHymn: 'hymn', shelter: 'sanctuary', grief: 'sacrifice',
  doublePoh: 'poh', shareRenew: 'renew', quickHymn: 'lightWave',
  twoShields: 'handGuard', focusOne: 'holyLight', hymnTail: 'hymn',
  zenith: 'serenity', scatter: 'lightWave', endless: 'serenity',
  // 드루이드 (77 2장)
  longSprout: 'sprout', sproutGrowth: 'growth', branchGrowth: 'growth',
  firmStem: 'bark', earlySprout: 'sprout', washRain: 'natureCleanse',
  deepGrowth: 'growth', growthBreath: 'bloom', mossBed: 'wildflower',
  twinSprout: 'sprout', colonyAll: 'wildflower', wideRoots: 'quietwood',
  springRain: 'quietwood', quickSprout: 'sprout', cleanFlower: 'natureCleanse',
  treeBody: 'bark', nearGrove: 'bark', secondSpring: 'rebirth',
  rescueSprout: 'sprout', watchSprout: 'growth', fallenFlower: 'bloom',
  rebloomField: 'wildflower', flowerTrail: 'wildflower', seedScatter: 'bloom',
  guardianGrove: 'bark', overflowSap: 'growth', greenField: 'quietwood',
  forestMemory: 'quietwood', oldTree: 'rebirth', wakeForest: 'wildflower',
  // 성기사 (77 3장)
  swiftLight: 'holyLight', devotionPath: 'oath', shareOath: 'oath',
  heavyStrike: 'holyLight', steadyHeart: 'holyLight', twinHands: 'holyLight',
  guardOath: 'oath', calmBreath: 'oath', waveEcho: 'lightWave',
  beaconWeight: 'sacrifice', beaconBreath: 'holyLight', beaconDrift: 'lightWave',
  resolveFill: 'oath', freeLight: 'holyLight', waveCleanse: 'handCleanse',
  lightArmor: 'handGuard', vowGuard: 'sacrifice', rescueHand: 'handGuard',
  quickHand: 'holyLight', steadyLight: 'sanctuary', martyr: 'sacrifice',
  fullWave: 'lightWave', freeWave: 'lightWave', wideSanctuary: 'sanctuary',
  tankLight: 'handGuard', beaconRing: 'lightWave', waveMarch: 'lightWave',
  dawnVow: 'oath', endlessLight: 'lightWave', allKnight: 'sanctuary',
  // 주술사 (79 2-7, 바탕 스킬 = 80 4장)
  quickRipple: 'ripple', calmShower: 'ripple', splitDrop: 'droplet',
  stoneDrop: 'droplet', rippleChain: 'ripple', sprayShower: 'ripple',
  rootTotem: 'earthTotem', dropChain: 'chainHeal', washSpread: 'washing',
  keeperSpring: 'springTotem', springBreath: 'springTotem', twinSpring: 'springTotem',
  waterShield: 'springTotem', totemCall: 'springTotem', freshSpring: 'springTotem',
  earthGrace: 'earthTotem', letFlow: 'droplet', springSelf: 'springTotem',
  rapids: 'ripple', alertTotem: 'springTotem', lastSpring: 'springTotem',
  returnChain: 'chainHeal', overflowChain: 'chainHeal', longChain: 'chainHeal',
  twinEarth: 'earthTotem', rainBreath: 'rainTotem', stormChain: 'chainHeal',
  waterSpirit: 'chainHeal', endlessChain: 'chainHeal', seaSeat: 'springTotem',
  heavyPalm: 'vitalPalm', lightPalm: 'vitalPalm', palmSplash: 'vitalPalm',
  embrace: 'mistWrap', mistThrift: 'wanderMist', chiWave: 'clearChi',
  stayMist: 'wanderMist', longMist: 'wanderMist', farMist: 'wanderMist',
  focusBeat: 'vitalPalm', wideBeat: 'vitalPalm', sevenBeat: 'vitalPalm',
  steadyMind: 'tea', thousandHands: 'vitalPalm', beatSpread: 'vitalPalm',
  ironBody: 'soothe', mistBody: 'wanderMist', windAgain: 'reviveWind',
  urgentPalm: 'vitalPalm', crisisBreath: 'mistBreath', scatterMist: 'wanderMist',
  mistPillar: 'mistBreath', thriftBreath: 'mistBreath', gatherMist: 'wanderMist',
  windKnot: 'reviveWind', calmWind: 'reviveWind', mistPath: 'reviveWind',
  chiBurst: 'vitalPalm', endlessBeat: 'vitalPalm', mistStorm: 'wanderMist',
  brightStar: 'starHeal', smallTwinkle: 'twinkle', scatterTwinkle: 'twinkle',
  etchedMark: 'starMark', markBreath: 'starMark', linkedMark: 'starMark',
  brightPolaris: 'polaris', quickLink: 'starfall', clearNight: 'starfall',
  onePoint: 'polaris', threeShards: 'starHeal', fifthStar: 'starfall',
  risingPolaris: 'polaris', fallingNight: 'starfall', secondStarfall: 'starfall',
  unfading: 'starSleep', calmHands: 'starfall', starCrowd: 'starHeal',
  prophecy: 'starMark', foreseen: 'starHeal', fallingStar: 'twinkle',
  gatherLight: 'starfall', thriftFall: 'starfall', wideSky: 'starfall',
  tankMemory: 'starMemory', thriftMemory: 'starMemory', longMemory: 'starMemory',
  supernova: 'polaris', starPath: 'starfall', milkyWay: 'starHeal',
  thickBarrier: 'lightBarrier', lightSeal: 'sealHeal', splitBarrier: 'lightBarrier',
  lightOnBarrier: 'lightBarrier', longSeal: 'sealHeal', cleanWard: 'wardCleanse',
  firmWard: 'guardWard', quickBarrier: 'lightBarrier', sealSpread: 'sealHeal',
  heavyJudge: 'judgment', quickJudge: 'judgment', wideJudge: 'judgment',
  judgeHammer: 'judgment', sealEcho: 'sealHeal', freshSeal: 'sealHeal',
  selfBarrier: 'lightBarrier', barrierBreath: 'lightBarrier', sharedBurden: 'guardWard',
  stepIn: 'lightBarrier', preWard: 'wardCircle', lastWard: 'wardCircle',
  doubleCircle: 'wardCircle', thriftCircle: 'wardCircle', wideWard: 'wardCircle',
  veilTank: 'lightVeil', veilBreath: 'lightVeil', sharedLoad: 'lightVeil',
  citadel: 'lightVeil', repentTime: 'judgment', endlessJudge: 'judgment',
};
const talentIcon = (key: TalentKey) => gameIcon(key, skillIc(TALENT_ART[key]), 'talent');

function talentHtml(): string {
  const lv = healerLevel(), h = hero(), tree = TALENT_TREES[h];
  const mine = heroSave(h).talents || [], pre = talentPreset(h);
  const open = tree.filter(t => t.lv <= lv).length;
  const picked = tree.filter((t, i) => t.lv <= lv && mine[i] != null).length;
  const left = open - picked;
  const head = open ? `${open}단 열림 · ${picked}개 고름 · ${left ? `<b>${left}개 남음</b>` : '남은 단 없음'}` : `${LOCK}Lv ${TALENT_LEVEL}에 열림 (지금 Lv ${lv})`;
  const presets = Array.from({ length: TALENT_PRESETS }, (_, i) => `<button type="button" class="c7-pre" data-preset="${i}" aria-pressed="${pre === i}" aria-label="프리셋 ${i + 1}">${i + 1}</button>`).join('');
  const focus = sheet?.k === 'talent' ? sheet : null;
  const rows = tree.map((t, i) => {
    const locked = t.lv > lv, cur = mine[i] ?? null, pending = !locked && cur == null;
    const nodes = t.picks.map((p, j) => {
      const selected = cur === j;
      const icon = `<span class="c7-tn${p.active ? ' active' : ''}" data-rank="${selected ? '1' : '0'}/1">${talentIcon(p.key)}${locked ? `<i class="c7-tlock">${uiIcon('lock')}</i>` : selected ? '<i class="c7-tck">✓</i>' : ''}</span><small>${p.name}</small>`;
      return locked
        ? `<span class="c7-pk off" aria-label="${p.name} · Lv ${t.lv}에 열림">${icon}</span>`
        : `<button type="button" class="c7-pk${focus && focus.i === i && focus.j === j ? ' focus' : ''}" data-tcell="${i}:${j}" aria-pressed="${selected}" aria-label="${p.name}${selected ? ' · 선택됨' : ''}">${icon}</button>`;
    }).join('');
    return `<div class="c7-tier${locked ? ' locked' : ''}${pending ? ' pending' : ''}" data-tier="${i}"><span class="c7-tl"><b>Lv ${t.lv}</b><em>${locked ? '잠김' : pending ? '하나 선택' : '선택 완료'}</em></span><span class="c7-tnodes">${nodes}</span></div>`;
  }).join('');
  return `<header class="c7-talent-title">${classEmblem(h)}<div><h2>${HEROES[h].name} 특성</h2></div><b>Lv ${lv}</b></header>
    <div class="c7-tsum"><p><span>${head}</span><small>언제든 무료로 변경</small></p><span class="c7-preset-wrap"><small>프리셋</small><span class="c7-pres" role="group" aria-label="프리셋">${presets}</span></span></div>
    <section class="c7-tiers" aria-label="특성 나무">${rows}</section>`;
}

/**
 * 특성 설명 창 (탭 막대 위, 어둡게 하지 않음). 고른 특성이면 「풀기」 = pickTalent 다시 누름과 같음.
 * 2026-10-16 Lim: 입장 팝업 (#160)과 같은 돌 카드 · 황동 테 · 금빛 주 버튼 + 돌색 「닫기」, 「이 단에서 한 가지 선택 · 변경 비용 없음」 글은 없앰
 */
function talentSheet(i: number, j: number): string {
  const h = hero(), t = TALENT_TREES[h][i], p = t?.picks[j];
  if (!p || t.lv > healerLevel()) return '';
  const chosen = (heroSave(h).talents || [])[i] === j;
  return `<section class="sheet c7-tsheet" role="dialog" aria-label="특성 설명">
      <header class="c7-tp-head"><span class="c7-tp-ic${p.active ? ' active' : ''}">${talentIcon(p.key)}</span>
        <span class="c7-tp-tt"><b>${p.name}</b><span class="c7-tp-tags"><i>Lv ${t.lv}</i><i>${p.active ? '사용 효과' : '지속 효과'}</i>${chosen ? '<i class="on">선택 중</i>' : ''}</span></span></header>
      <p class="c7-tp-desc">${esc(healText(p.desc, statParts().int.total))}</p>
      ${p.active ? '<p class="c7-tp-note">전투 화면 아래 특성 버튼으로 나옵니다.</p>' : ''}
      <footer class="c7-tp-btns"><button type="button" class="c7-tp-btn c7-tclose" data-sheetx aria-label="특성 설명 닫기">닫기</button>
        <button type="button" class="c7-tp-btn${chosen ? '' : ' primary'}" data-talent="${i}:${j}">${chosen ? '풀기' : '고르기'}</button></footer></section>`;
}

/**
 * 특성 설명 창은 목록에 여백을 붙이지 않음 (2026-10-16 Lim 「맨 아래에서 누르면 더 스크롤된다」), 스크롤도 건드리지 않음.
 * 아래 자리가 누른 단 (세 선택지)을 가리면 하위 탭 바로 아래로, 그래도 가리면 (화면 가운데 단 · 긴 설명) 하위 탭을 덮는 자리까지. 덜 가리는 쪽
 */
function placeTalentSheet(): void {
  if (sheet?.k !== 'talent') return;
  const sh = s.el.querySelector<HTMLElement>('.c7-tsheet'), nodes = s.el.querySelector<HTMLElement>(`[data-tier="${sheet.i}"] .c7-tnodes`);
  const tabs = s.el.querySelector<HTMLElement>('.c7-tabs');
  if (!sh || !nodes || !tabs) return;
  const t = nodes.getBoundingClientRect(), h = sh.offsetHeight;
  // 올라오는 움직임 (translate) 중이라 세로 이동만큼 뺀 자리
  const low = sh.getBoundingClientRect().top - new DOMMatrixReadOnly(getComputedStyle(sh).transform).m42;
  const tb = tabs.getBoundingClientRect();
  const over = (top: number) => Math.max(0, Math.min(t.bottom, top + h) - Math.max(t.top, top));
  const top = [tb.bottom + 8, tb.top].reduce((a, b) => (over(b) < over(a) ? b : a));
  if (over(top) >= over(low)) return;
  sh.classList.add('top');
  sh.style.top = `${top}px`;
}

// ---------- 직업: 선택 시안 1 (2026-10-14), 일곱 직업을 한 목록에서 비교 ----------
/** 직업 한 줄 플레이 방식. 아직 켜지 않은 79 직업은 「곧 열림」 칸에 이 줄만 (출시일·가격·해금 레벨은 표시하지 않는다) */
const HERO_STYLE: Record<HeroKey, string> = {
  priest: '균형 치유 · 성언', druid: '지속 치유 · 군락', paladin: '탱커 보호 · 봉화',
  shaman: '토템 · 연쇄 치유', monk: '연속 치유 · 안개', astrologer: '별자리 · 집중 치유', warder: '보호막 · 공격 치유',
};
/** 아직 켜지 않은 직업 (직업 PR마다 ready로 켬, 79 6-2) */
const upcomingHeroes = () => ALL_HERO_KEYS.filter(k => !HEROES[k].ready);
/** 잠긴 직업 글: 드루이드 · 성기사 = 「Lv N 해금」, 상점 직업 = 값 (81) */
const lockWord = (k: HeroKey) => (HEROES[k].unlock.buy ? JOB_PRICE : `Lv ${HEROES[k].unlock.lv} 해금`);
function heroRow(k: HeroKey): string {
  const h = HEROES[k], st = heroStatus(k), open = switchOpen();
  const word = st.state === 'now' ? '현재 직업' : st.state === 'locked' ? lockWord(k) : open.ok ? '전환 가능' : open.why;
  const state = st.state === 'open' && !open.ok ? 'unavailable' : st.state === 'locked' && st.buy ? 'locked buy' : st.state;
  // 상점 직업은 누르면 상점 그 상품으로 (81, Lim 「판매 캐릭터 누르면 상점으로 이동」)
  return `<li><button type="button" class="c7-hc c7-job-row ${state}" data-hcard="${k}"${st.buy ? '' : ' aria-haspopup="dialog"'}${st.state === 'now' ? ' aria-current="true"' : ''} aria-label="${h.name} · ${HERO_STYLE[k]} · ${st.buy ? `상점 ${word} · 상점으로` : word}">
    ${classEmblem(k, 'lg')}<span class="c7-job-copy"><b>${h.name}</b><small>${HERO_STYLE[k]}</small></span>
    <span class="c7-job-state">${word}${st.buy ? uiIcon('arrow') : st.state === 'locked' ? uiIcon('lock') : st.state === 'now' ? '' : uiIcon('arrow')}</span></button></li>`;
}

/** 직업 선택용 요약. 수치·상세 효과는 스킬 탭에서 확인한다. */
const HERO_INTRO: Record<HeroKey, string> = {
  priest: '치유를 쌓아 강력한 성언으로 파티를 구하는 힐러입니다.',
  druid: '미리 걸어 둔 지속 치유로 파티를 지키는 힐러입니다.',
  paladin: '봉화와 보호 기술로 탱커를 끝까지 지키는 힐러입니다.',
  shaman: '토템을 칸에 세우고, 연쇄 치유를 다친 사람 사이로 흘려보내는 힐러입니다.',
  monk: '짧은 손바닥을 박자에 맞춰 이어 치며 안개를 띄워 두는 힐러입니다.',
  astrologer: '별 조각을 모아 별자리 시전으로 한 번에 터뜨려 큰 피해를 받아 내는 힐러입니다.',
  warder: '보호막과 인장을 미리 깔고, 심판으로 한꺼번에 치유하는 힐러입니다.',
};
const SKILL_BRIEF: Record<SkillKey, string> = {
  heal: '한 명의 체력을 크게 회복', flash: '위급한 아군을 빠르게 회복',
  renew: '시간에 걸쳐 꾸준히 회복', poh: '주변 아군을 함께 회복',
  purify: '마법·질병 해제', guardian: '치명적인 피해에서 보호',
  hymn: '파티 전체를 지속 회복', relay: '아군 사이를 옮겨 가며 회복',
  serenity: '한 명을 즉시 크게 회복',
  sprout: '시간에 걸쳐 꾸준히 회복', growth: '빠른 회복과 지속 치유',
  bloom: '남은 지속 치유를 즉시 회복', wildflower: '주변 아군을 함께 회복',
  natureCleanse: '마법·저주·독 해제', bark: '받는 피해 감소',
  quietwood: '파티 전원에게 새싹 심기', rebirth: '쓰러진 아군 부활',
  holyLight: '체력 회복과 신성한 힘 충전', beacon: '봉화 대상 지정',
  oath: '신성한 힘으로 지속 치유', lightWave: '신성한 힘으로 주변 회복',
  handCleanse: '마법·독·질병 해제', sacrifice: '아군의 피해를 대신 받음',
  sanctuary: '주변 아군 보호와 지속 치유', handGuard: '물리 피해 차단 · 공격 불가',
  ripple: '회복하고 옆 아군에게 튐',
  droplet: '시간에 걸쳐 회복 · 연쇄 다리', washing: '마법·저주 해제',
  chainHeal: '다친 아군 사이를 튀며 회복', earthTotem: '토템 둘레 받는 피해 감소',
  rainTotem: '파티 전체를 지속 회복', spiritLink: '붙은 아군 체력 나눠 맞추기',
  springTotem: '고른 아군 칸 둘레를 지속 회복',
  vitalPalm: '짧은 즉시 회복 · 기 리듬', mistWrap: '리듬만큼 커지는 즉시 회복',
  wanderMist: '옮겨 다니는 지속 치유', clearChi: '마법·질병 해제',
  mistBreath: '주변 아군을 즉시 회복', soothe: '받는 피해 감소',
  reviveWind: '파티 전체 회복과 해제', tea: '마나와 기 리듬 회복',
  starHeal: '한 명 회복과 별 조각', twinkle: '즉시 회복과 별 조각',
  starMark: '지속 치유 · 다음 힐 강화', clearStar: '마법·독 해제',
  starfall: '별 조각을 써서 범위 회복', starSleep: '잠깐 모든 피해 차단 · 공격 불가',
  starMemory: '별 조각을 써서 받은 피해 되감기', polaris: '별 조각을 써서 한 명 크게 회복',
  sealHeal: '한 명 회복과 인장',
  lightBarrier: '보호막과 인장', wardCleanse: '마법·저주 해제',
  wardCircle: '주변 아군 보호막과 인장', guardWard: '큰 보호막과 인장',
  lightVeil: '파티 전원 보호막과 인장', wardHold: '내 보호막 시간 늘리기와 인장',
  judgment: '인장 붙은 아군을 한꺼번에 회복',
};

function heroDetail(k: HeroKey): string {
  return `<div class="c7-job-scroll"><header class="c7-job-intro">
    ${classEmblem(k, 'xl')}<h2 id="jobDetailTitle">${HEROES[k].name}</h2>
    <p id="jobDetailIntro">${HERO_INTRO[k]}</p></header>
    <section class="c7-job-skills" aria-labelledby="jobSkillsTitle"><h3 id="jobSkillsTitle">스킬</h3>
      <ul class="c7-job-skill-grid">${heroSkills(k).map(sk => `<li class="c7-job-skill" data-job-skill="${sk}">
        <span class="c7-job-skill-icon" aria-hidden="true">${skillIc(sk)}</span><div><h4>${SKILLS[sk].name}</h4><p>${SKILL_BRIEF[sk]}</p></div></li>`).join('')}</ul>
    </section></div>`;
}

function heroListHtml(): string {
  return `<section class="c7-jobs" aria-labelledby="jobListTitle">
    <header class="c7-jobs-head"><div><h2 id="jobListTitle">직업 선택</h2><span>${ALL_HERO_KEYS.length}종</span></div><p>레벨·장비 유지 · 무료 전환 · 4종은 상점</p></header>
    <ul class="c7-job-list" aria-label="직업 고르기">${HERO_KEYS.map(heroRow).join('')}</ul>
    ${upcomingHeroes().length ? `<ul class="c7-job-list c7-jobs-upcoming" aria-label="곧 열림">${upcomingHeroes().map(k => { const n = HEROES[k].name; return `<li class="c7-job-row upcoming" aria-label="${n} · ${HERO_STYLE[k]} · 곧 열림">${classEmblem(k, 'lg')}<span class="c7-job-copy"><b>${n}</b><small>${HERO_STYLE[k]}</small></span><span class="c7-job-state">곧 열림${uiIcon('lock')}</span></li>`; }).join('')}</ul>` : ''}
  </section>`;
}

/** 시안 3: 중앙 문장·짧은 소개·2열 스킬 카드. 전환 규칙은 기존 상태 모듈을 사용한다. */
function heroSheet(k: HeroKey): string {
  const h = HEROES[k], st = heroStatus(k), open = switchOpen();
  const available = (st.state === 'open' || st.state === 'quest') && open.ok;
  const label = st.state === 'now' ? '현재 직업' : st.state === 'locked' ? lockWord(k) : !open.ok ? open.why : `${h.name}${josa(h.name, '으로', '로')} 전환`;
  return `<div class="sheet-dim" data-sheetx></div><section class="sheet c7-job-sheet" data-hdet="${k}" aria-labelledby="jobDetailTitle" aria-describedby="jobDetailIntro">
    <button type="button" class="c7-dialog-close" data-sheetx aria-label="직업 상세 닫기">닫기</button>
    ${heroDetail(k)}<footer class="c7-job-footer">${msg ? `<p class="c7-msg" role="status">${esc(msg)}</p>` : ''}
      <button type="button" class="c7-hcta"${available ? ` data-hero="${k}"` : ' disabled'}>${esc(label)}</button>
    </footer></section>`;
}

// ---------- 누르기 ----------
/** 장비·능력치·도감 시트는 펼쳐진 인벤토리로 돌아가며 스크롤과 포커스를 유지한다. */
function closeSheet(): void {
  if (pending) { pending = null; render(); return; }
  const talentReturn = sheet?.k === 'talent' ? `${sheet.i}:${sheet.j}` : null;
  const closingItem = sheet?.k === 'item' ? sheet : null;
  const inventoryReturn = closingItem && !G.save.gear.bag.some(it => it.id === closingItem.id) ? closingItem.inventoryIndex : undefined;
  rrOn = false; rrAlt = null;
  sheet = sheet?.k === 'codex' ? { k: 'dex' } : null;
  msg = ''; render();
  if (talentReturn) focusTalentControl(`[data-tcell="${talentReturn}"]`);
  if (inventoryReturn !== undefined) {
    const cells = s.el.querySelectorAll<HTMLElement>('.c7-inventory [data-gitem]');
    const target = cells[Math.min(inventoryReturn, cells.length - 1)] || s.el.querySelector<HTMLElement>('#gearInventoryTitle');
    target?.focus({ preventScroll: true });
  }
}

/** 특성은 비모달 시트. DOM을 다시 그려도 키보드 작업 위치는 이어 준다. */
function focusTalentControl(selector: string): void {
  s.el.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
}

/** 처리했으면 true (그렸음) */
function onClick(t: HTMLElement): boolean {
  if (itemOverlay) {
    if (t.closest('[data-sheetx]')) closeSheet();
    return true;
  }
  if (pending) {
    if (t.closest('[data-confirmgo]')) confirmAction();
    else if (t.closest('[data-confirmcancel], [data-sheetx]')) closeSheet();
    return true;
  }
  const tab = t.closest<HTMLElement>('[data-csub]');
  if (tab) { go('s-char', tab.dataset.csub); return true; }
  if (t.closest('[data-sheetx]')) { closeSheet(); return true; }

  // ---- 장비 ----
  const gi = t.closest<HTMLElement>('[data-gitem]');
  if (gi) {
    const inventoryIndex = Array.from(s.el.querySelectorAll('.c7-inventory [data-gitem]')).indexOf(gi);
    sheet = { k: 'item', id: Number(gi.dataset.gitem), ...(inventoryIndex >= 0 ? { inventoryIndex } : {}) };
    msg = ''; rrOn = false; rrAlt = null;
    render(); return true;
  }
  const gs = t.closest<HTMLButtonElement>('[data-gslot]');
  if (gs) {
    const best = G.save.gear.bag.filter(x => x.slot === gs.dataset.gslot).sort(SORTS.score.cmp)[0];
    if (best) { sheet = { k: 'item', id: best.id }; msg = ''; render(); }
    return true;
  }
  if (t.closest('[data-sheet="stats"]')) { sheet = { k: 'stats' }; msg = ''; render(); return true; }
  const lk = t.closest<HTMLElement>('[data-lock]');
  if (lk) { toggleLock(Number(lk.dataset.lock)); msg = ''; render(); return true; }
  const eq = t.closest<HTMLElement>('[data-equip]');
  if (eq) { wornNow = Number(eq.dataset.equip); equip(wornNow); msg = ''; render(); return true; }
  const s1 = t.closest<HTMLButtonElement>('[data-sell1]');
  if (s1) {
    if (s1.disabled) return true;
    const it = findItem(Number(s1.dataset.sell1));
    if (it) pending = { kind: 'sell', id: it.id };
    render();
    return true;
  }
  if (t.closest('[data-rrmode]')) { rrOn = !rrOn; rrAlt = null; msg = ''; render(); return true; }
  const rb = t.closest<HTMLElement>('[data-rr]');
  if (rb && sheet?.k === 'item') {
    const [kind, n] = rb.dataset.rr!.split(':') as [RerollKind, string], i = Number(n);
    const res = reroll(sheet.id, kind, i);
    msg = res.err; rrAlt = res.alt ? { id: sheet.id, kind, i, alt: res.alt } : null;
    render(); return true;
  }
  if (t.closest('[data-rrpick]') && rrAlt) { pickReroll(rrAlt.id, rrAlt.kind, rrAlt.i, rrAlt.alt); rrAlt = null; msg = ''; render(); return true; }
  if (t.closest('[data-codex]')) { sheet = { k: 'codex' }; msg = ''; render(); return true; }
  if (t.closest('[data-dex]')) { sheet = { k: 'dex' }; msg = ''; render(); return true; }
  const dt = t.closest<HTMLElement>('[data-dext]');
  if (dt) { dexT = dt.dataset.dext as DexTab; render(); return true; }
  if (t.closest('[data-dexclaim]')) {
    const got = claimDex();
    msg = got.steps ? `도감 보상: 골드 ${fmt(got.gold)}` : '';
    dexPop = got.steps > 0;
    render(); return true;
  }
  const cg = t.closest<HTMLElement>('[data-codexg]');
  if (cg) { codexG = cg.dataset.codexg as CodexGroup; render(); return true; }
  const bf = t.closest<HTMLElement>('[data-bfilter]');
  if (bf) { bagFilter = bf.dataset.bfilter as BagFilter; render(true, true); s.el.querySelector<HTMLElement>(`[data-bfilter="${bagFilter}"]`)?.focus({ preventScroll: true }); return true; }
  if (t.closest('[data-bsort]')) { bagSort = SORTS[bagSort].next; render(true, true); s.el.querySelector<HTMLElement>('[data-bsort]')?.focus({ preventScroll: true }); return true; }
  // ---- 특성 ----
  const tc = t.closest<HTMLElement>('[data-tcell]');
  if (tc) {
    const [i, j] = tc.dataset.tcell!.split(':').map(Number);
    sheet = sheet?.k === 'talent' && sheet.i === i && sheet.j === j ? null : { k: 'talent', i, j };
    render();
    focusTalentControl(sheet ? `.c7-tsheet [data-talent="${i}:${j}"]` : `[data-tcell="${i}:${j}"]`);
    return true;
  }
  const tb = t.closest<HTMLElement>('[data-talent]');
  if (tb) {
    const [i, j] = tb.dataset.talent!.split(':').map(Number);
    if (pickTalent(i, j)) sheet = null;
    render(); focusTalentControl(`[data-tcell="${i}:${j}"]`); return true;
  }
  const pr = t.closest<HTMLElement>('[data-preset]');
  if (pr) {
    const preset = Number(pr.dataset.preset);
    setTalentPreset(preset); sheet = null; render();
    focusTalentControl(`[data-preset="${preset}"]`); return true;
  }

  // ---- 직업 ----
  const hb = t.closest<HTMLButtonElement>('[data-hero]');
  if (hb) {
    if (hb.disabled) return true;
    const k = hb.dataset.hero as HeroKey;
    msg = switchHero(k) ? '' : '바꿀 수 없음';
    if (!msg) { pushSettings(); go('s-char', 'hero'); return true; }
    render(); return true;
  }
  const hc = t.closest<HTMLElement>('[data-hcard]');
  if (hc) {
    const k = hc.dataset.hcard as HeroKey;
    if (heroStatus(k).buy) { go('s-shop', `cash:${jobProductId(k)}`); return true; }
    if (HERO_KEYS.includes(k)) { sheet = { k: 'hero', hero: k }; msg = ''; render(); }
    return true;
  }

  // ---- 스킬 ----
  const sm = t.closest<HTMLElement>('[data-smode]');
  if (sm) { swapping = sm.dataset.smode === 'swap'; sel = null; render(); return true; }
  const tap = t.closest<HTMLButtonElement>('[data-tap]');
  if (tap) { if (!tap.disabled) { G.save.settings.tapKey = tap.dataset.tap as TapKey; commit(); pushSettings(); msg = ''; render(); } return true; }
  const sk = t.closest<HTMLElement>('[data-skill], [data-skrow]');
  if (sk) { const key = sk.dataset.skill || sk.dataset.skrow!; skOpen = skOpen === key ? null : key; render(); return true; }
  const l = t.closest<HTMLElement>('[data-ldir]');
  if (l) {
    const d = l.dataset.ldir!;
    if (!swapping || !sel) sel = sel === d && !swapping ? null : d;
    else if (sel === d) sel = null;
    else { const lay = layoutNow(); [lay[sel], lay[d]] = [lay[d], lay[sel]]; G.save.settings.layout = lay; sel = null; commit(); pushSettings(); }
    render(); return true;
  }
  if (t.closest('#layReset')) { G.save.settings.layout = null; sel = null; commit(); pushSettings(); render(); return true; }
  return false;
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  // 특성 시트는 어둡게 하지 않으니, 시트 밖을 누르면 닫고 그 누름도 그대로 처리
  let dirty = false;
  if (sheet?.k === 'talent' && !t.closest('.sheet, [data-tcell]')) { sheet = null; dirty = true; }
  if (!onClick(t) && dirty) render();
});

// 시트를 아래로 밀면 닫힘 (버튼 위에서 시작한 건 빼고)
let dragY: number | null = null;
s.el.addEventListener('pointerdown', e => {
  const t = e.target as HTMLElement, sh = t.closest<HTMLElement>('.sheet');
  dragY = sh && sh.scrollTop <= 0 && !t.closest('button') ? e.clientY : null;
});
s.el.addEventListener('pointerup', e => {
  if (dragY != null && sheet && e.clientY - dragY > 60) closeSheet();
  dragY = null;
});

/**
 * 인벤토리는 아이템·빈칸 위에서 끌어도 스크롤 (Lim 2026-10-11). 손가락·마우스 모두 직접 움직임 (.c7-bags는 touch-action: none).
 * 장비 탭 본문은 화면에 딱 맞아 (Lim 2026-10-12, a2-character-compact.css) 대상 폰에서는 목록만 움직임.
 * 무대 최소로도 안 들어가는 낮은 화면(320×640)만 바깥 화면(.ns-body)이 넘침: 위로 끌면 목록 아랫줄이 하단 메뉴에 가려 있는 동안은 바깥 화면부터,
 * 다 보이면 목록, 목록 끝이면 다시 바깥 화면. 아래로 끌면 목록 먼저, 목록 맨 위면 바깥 화면.
 * 8px 넘게 끌었으면 누름(상세 열기)은 무시, 손가락은 놓은 뒤 조금 미끄러짐
 */
const INV_SLOP = 8;
let inv: { id: number; y: number; t: number; v: number; moved: boolean; touch: boolean } | null = null;
let invSwallow = false, invFling = 0;
function scrollInv(dy: number): boolean {
  const list = s.el.querySelector<HTMLElement>('.c7-bags'), body = s.el.querySelector<HTMLElement>('.ns-body');
  if (!list) return false;
  const a = list.scrollTop, b = body?.scrollTop ?? 0;
  const by = (el: HTMLElement, d: number) => { const was = el.scrollTop; el.scrollTop = was + d; return el.scrollTop - was; };
  let rest = dy;
  if (body && rest > 0) {
    const tabs = document.getElementById('tabs')?.getBoundingClientRect();
    const hidden = list.getBoundingClientRect().bottom - Math.min(body.getBoundingClientRect().bottom, tabs && tabs.height ? tabs.top : Infinity);
    if (hidden > 0.5) rest -= by(body, Math.min(rest, hidden));
  }
  rest -= by(list, rest);
  if (body && Math.abs(rest) >= 1) by(body, rest);
  return list.scrollTop !== a || (body?.scrollTop ?? 0) !== b;
}
function stopFling(): void { cancelAnimationFrame(invFling); invFling = 0; }
s.el.addEventListener('pointerdown', e => {
  stopFling(); invSwallow = false;
  if (!(e.target as HTMLElement).closest('.c7-bags') || (e.pointerType === 'mouse' && e.button !== 0)) return;
  inv = { id: e.pointerId, y: e.clientY, t: e.timeStamp, v: 0, moved: false, touch: e.pointerType !== 'mouse' };
});
s.el.addEventListener('pointermove', e => {
  if (!inv || e.pointerId !== inv.id) return;
  const dy = inv.y - e.clientY;
  if (!inv.moved) {
    if (Math.abs(dy) < INV_SLOP) return;
    inv.moved = true;
    (e.target as HTMLElement).closest<HTMLElement>('.c7-bags')?.setPointerCapture?.(e.pointerId);
  }
  const dt = Math.max(1, e.timeStamp - inv.t);
  scrollInv(dy);
  inv.v = 0.8 * (dy / dt) + 0.2 * inv.v;
  inv.y = e.clientY; inv.t = e.timeStamp;
});
const endInv = (e: PointerEvent) => {
  if (!inv || e.pointerId !== inv.id) return;
  const { moved, touch } = inv;
  let v = e.timeStamp - inv.t > 80 ? 0 : inv.v;
  inv = null;
  if (!moved) return;
  invSwallow = true;
  if (!touch || Math.abs(v) < 0.05 || G.save.settings.reducedEffects) return;
  let last = performance.now();
  const step = (now: number) => {
    const dt = Math.min(32, now - last); last = now;
    v *= Math.pow(0.95, dt / 16);
    invFling = Math.abs(v) >= 0.02 && scrollInv(v * dt) ? requestAnimationFrame(step) : 0;
  };
  invFling = requestAnimationFrame(step);
};
s.el.addEventListener('pointerup', endInv);
s.el.addEventListener('pointercancel', endInv);
// 끈 뒤에 오는 누름은 상세를 열지 않음 (잡고 있던 칸 · 목록 어디서든)
s.el.addEventListener('click', e => { if (invSwallow) { invSwallow = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
s.el.addEventListener('wheel', stopFling, { passive: true });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet && !s.el.hidden) closeSheet(); });
