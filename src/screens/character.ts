/**
 * 캐릭터 탭 (27 4장 기능, 31 시안 CharGear31 · CharSkill31 · CharTalent31 · CharClass31 — 30 로비·전투·길드와 같은 테마). 캐릭터 그림 없음.
 * 위 = 공통 위 줄(topBar) + 하위 탭 4칸 [장비][스킬][특성][직업] (전투 탭 분류 칸 모양, 아이콘 + 이름).
 * 장비: 무기고(ui-char) 받침대 위 큰 직업 문장 + 이름표(장비 점수) · 좌우 장비 칸 6개 · 능력치 판 · 가방 / 추천 장착 / 분해
 *       + 아래 시트(장비 상세·비교·강화·잠금 · 가방(필터·정렬·분해) · 능력치 출처 · 추천 장착 확인)
 * 스킬: [설명 보기 | 배치 바꾸기] · 마법진 위 휠 3×3 금테 메달 · 양피지 설명 · 칸 탭 기본 힐 나무 팻말 · 단축칸 · 스킬 줄 목록
 * 특성: 요약 · 프리셋 1·2·3 · 나무판에 단마다 메달 3개 + 고른 길(금빛 선) · 고르기 시트 / 직업: 천 깃발 · 곧 열림 · 양피지 상세 · 바꾸기
 * 그림(item- · skill- · stat- · icon-skills · icon-talent · ui-magic-circle)은 gameIcon으로 감쌈: 파일이 오면 그 그림, 없으면 선 아이콘·CSS.
 */
import { enhanceCost, fixedOf, GRADE_STYLE, ITEM_GRADES, itemScore, itemStats, enhanceForecast, kindOf, lineValue, mainOf, MAX_PLUS, rerollCost, rollFill, salvageOf, SLOTS, slotName, STAT_KEYS, STATS, type GearItem, type GearLine, type ItemGrade, type SlotKey } from '../data/equipment';
import { DEB_COLOR, HERO_KEYS, HERO_SWITCH_LV, heroSkills, HEROES, skillAt, slotIdOf, UPDATE_HEROES, type HeroKey } from '../data/heroes';
import { ITEMS, type ItemKey } from '../data/items';
import { ITEM_SLOT_LV, itemSlots, TALENT_LEVEL } from '../data/progression';
import { healText, PASSIVE_DESC, PASSIVE_LEVEL, PASSIVE_NAME, SKILL_INFO, SKILL_LEVEL, SKILLS, type PassiveKey, type SkillKey } from '../data/skills';
import { TALENTS, type TalentKey } from '../data/talents';
import { heroLevelOf, type TapKey } from '../platform/storage';
import { betterSlots, codexRows, gearAvg, gearScore, isBetter, scoreOf, specRows, statParts, talentsLeft } from '../game/charinfo';
import { codexKeys, NAMED, SPEC_GROUPS, SPEC_KEYS, SPEC_TITLES, SPECS, specText, specValue, type CodexGroup, type SpecGroup, type SpecLine } from '../data/specials';
import {
  bestGearPlan, commit, enhanceLack, enhanceMsg, enhanceTry, equip, equipBest, findItem, G, healerLevel, heroSave, heroStatus, itemsNow, lowGradeIds, pickReroll, pickTalent, reroll, rerollOpen, salvage,
  setTalentPreset, switchHero, switchOpen, TALENT_PRESETS, talentPreset, toggleItem, toggleLock, type EnhanceOutcome, type RerollKind,
} from '../game/state';
import { TUT } from '../game/tutorial';
import { Flow } from '../game/flow';
import { classEmblem, fxArt, gameIcon, gearIcon, LOCK, trinketArt, uiIcon } from './art';
import { battle, esc, fmt, itemChipsHtml, josa, screen, topBar, useIcon } from './kit';
import { pushSettings } from './settings';
import { sheetDialog } from './dialog';

type Sub = 'gear' | 'skill' | 'talent' | 'hero';
const SUBS: { key: Sub; name: string }[] = [{ key: 'gear', name: '장비' }, { key: 'skill', name: '스킬' }, { key: 'talent', name: '특성' }, { key: 'hero', name: '직업' }];

/** 아래에서 올라오는 시트: 장비 상세(back = 가방에서 열어서 닫으면 가방으로) · 가방 · 특수능력 도감(닫으면 가방으로) · 능력치 출처 · 추천 장착 확인 · 단축칸 고르기 · 특성 설명 */
type Sheet = { k: 'item'; id: number; back?: boolean } | { k: 'bag' } | { k: 'codex' } | { k: 'stats' } | { k: 'rec' } | { k: 'items' } | { k: 'talent'; i: number; j: number } | null;
/** 도감에서 펼친 묶음 */
let codexG: CodexGroup = 'heal';
/** 장비 상세의 재설정 모드 (34 6-8): 줄마다 ↻ 버튼. rrAlt = Lv 60 둘째 후보 (시트를 닫으면 사라짐) */
let rrOn = false;
/** 강화 연출 (34 7장): 결과는 누른 순간 저장됨, 연출은 보여 주기만. 아무 데나 누르면 끝 (누른 버튼은 그대로 동작) */
let efx: (EnhanceOutcome & { quick: boolean }) | null = null;
let efxTimer: ReturnType<typeof setTimeout> | undefined;
/** 목표까지 강화 (34 7-3): 목표 · 떨어지면 멈춤 (기본 켬) · 도는 중 · 시도 수 · 멈춘 까닭 */
let auto: { id: number; target: number; stopDrop: boolean; run: boolean; n: number; why: string } | null = null;
let rrAlt: { id: number; kind: RerollKind; i: number; alt: GearLine | SpecLine } | null = null;

let sub: Sub = 'gear';
/** 휠에서 고른 자리: 보기 = 설명, 바꾸기 = 첫 번째로 누른 자리 */
let sel: string | null = null;
let swapping = false;
let msg = '';
let sheet: Sheet = null;
/** 지난번에 그린 시트 (같은 시트를 다시 그릴 땐 올라오는 움직임 없이) */
let sheetKey = '';

const s = screen('s-char', '캐릭터', {
  tab: 'char',
  enter(arg) {
    if (SUBS.some(x => x.key === arg)) sub = arg as Sub;
    sel = null; swapping = false; msg = ''; sheet = null; salv = null; salvAsk = false; skOpen = null; hskOpen = null; hsel = null; seenMarked = false; rrOn = false; rrAlt = null; auto = null; efx = null;
    render(false);
  },
});
const modal = sheetDialog(s.el, closeSheet);

/** 지금 휠 배치 (저장이 없거나 틀리면 기본) */
export function layoutNow(): Record<string, string | null> {
  const L = battle().layout;
  return L.valid(G.save.settings.layout) ? { ...G.save.settings.layout! } : { ...L.DEFAULT_LAYOUT };
}

/** 지금 직업 (화면 표시용) */
const hero = (): HeroKey => G.save.hero;
/** 휠 칸 이름 → 지금 직업의 스킬. 빈 방향은 8번째 칸 (고유 스킬이 있는 직업) */
const skillOfDir = (lay: Record<string, string | null>, d: string): SkillKey | null => skillAt(hero(), lay[d] || 'unique');
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const fill = '<span class="c7-fill"></span>';

/** 선 아이콘 (24 칸, 테마 색을 따름) */
const line = (d: string, w = 2) => `<svg class="c7-li" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const BOOK = '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/>';
const TREE = '<path d="M12 5v5M12 10l-5 4M12 10l5 4M7 14v4M17 14v4"/><circle cx="12" cy="3.5" r="1.8"/><circle cx="7" cy="19.5" r="1.8"/><circle cx="17" cy="19.5" r="1.8"/>';
const UP = line('<path d="M12 19V5M6 11l6-6 6 6"/>', 2.4);

function render(keep = true): void {
  modal.beforeRender();
  const old = s.el.querySelector<HTMLElement>('.ns-body');
  const top = keep && old ? old.scrollTop : 0;
  if (sub === 'gear') markSeen();
  // 시트가 가리키던 것이 없어졌으면 (분해한 장비 등) 시트도 닫음
  const sh = sheetHtml();
  if (!sh) sheet = null;
  const body = sub === 'gear' ? gearHtml() : sub === 'skill' ? skillHtml() : sub === 'hero' ? heroListHtml() : talentHtml();
  const key = sheet ? JSON.stringify(sheet) : '';
  const still = !!key && key === sheetKey;
  sheetKey = key;
  // 화면 바탕(무기고 그림)의 밝기·흐림이 하위 탭마다 다름 (char31.css #s-char[data-sub])
  s.el.dataset.sub = sub;
  s.el.innerHTML = `${topBar({ settings: true })}${tabsHtml()}
    <div class="ns-body c7-body c7-${sub}${sheet?.k === 'talent' ? ' c7-tsheet-on' : ''}">${body}</div>${sh}`;
  if (still) s.el.querySelector('.sheet')?.classList.add('still');
  if (sub === 'skill') fitDesc();
  if (sub === 'talent') watchTree();
  const nb = s.el.querySelector<HTMLElement>('.ns-body');
  if (nb && top) nb.scrollTop = top;
  const path = !sheet || sheet.k === 'talent' ? []
    : sheet.k === 'item' ? [...(sheet.back ? ['bag'] : []), `item:${sheet.id}`] : sheet.k === 'codex' ? ['bag', 'codex'] : [sheet.k];
  modal.sync(path.length ? s.el.querySelector<HTMLElement>('.sheet') : null, path);
}

/** 하위 탭 4칸 (전투 탭 분류 칸 모양): 더 좋은 장비 = 장비 빨간 점, 남은 특성 = 특성 빨간 점 */
function tabsHtml(): string {
  const dot = (k: Sub) => ((k === 'gear' && betterSlots().length) || (k === 'talent' && talentsLeft()) ? '<span class="rdot" aria-hidden="true"></span>' : '');
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
  if (sheet.k === 'bag') return g ? bagSheet() : '';
  if (sheet.k === 'codex') return g ? codexSheet() : '';
  if (sheet.k === 'stats') return g ? statsSheet() : '';
  if (sheet.k === 'rec') return g ? recSheet() : '';
  if (sheet.k === 'items') return sub === 'skill' ? itemsSheet() : '';
  return sub === 'talent' ? talentSheet(sheet.i, sheet.j) : '';
}

// ---------- 장비 (27 4-2 · 4-3, 시안 CharGear31) ----------
/** 분해 고르는 중이면 고른 id들 */
let salv: Set<number> | null = null;
/** 분해 확인 (한 번 더 누르면 분해) */
let salvAsk = false;
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
  score: { name: '점수순', next: 'grade', cmp: (a, b) => itemScore(b) - itemScore(a) || slotIdx(a) - slotIdx(b) || b.id - a.id },
  grade: { name: '등급순', next: 'new', cmp: (a, b) => gradeIdx(b) - gradeIdx(a) || slotIdx(a) - slotIdx(b) || b.plus - a.plus },
  new: { name: '새것순', next: 'score', cmp: (a, b) => b.id - a.id },
};
let bagFilter: BagFilter = 'all';
let bagSort: BagSort = 'score';

/** 이번에 들어오기 전까지 본 장비 id (이보다 크면 새것 점). 장비 탭을 처음 그릴 때 저장의 seen을 올림 */
let seenAt = Infinity;
let seenMarked = false;
function markSeen(): void {
  if (seenMarked) return;
  seenMarked = true;
  const g = G.save.gear;
  seenAt = g.seen ?? 0;
  const top = Math.max(0, ...g.bag.map(x => x.id), ...SLOTS.map(x => g.equipped[x.key]?.id ?? 0));
  if (top > seenAt) { g.seen = top; commit(); }
}
const isNew = (it: GearItem) => it.id > seenAt;

/** 이름 글자 색 (등급 색을 밝게, 시안 CharGear27) */
const GRADE_INK: Record<ItemGrade, string> = { '일반': '#E4E0D8', '고급': '#8BEA9C', '희귀': '#8DBEFF', '영웅': '#D7A6FF', '전설': '#FFC07A' };
const gvars = (it: GearItem) => `--g:${GRADE_STYLE[it.grade].color};--gi:${GRADE_INK[it.grade]}`;
const plusTxt = (it: GearItem) => (it.plus ? ` +${it.plus}` : '');
/** 비율 → 퍼센트 글자 (소수 한 자리, .0은 뺌): 0.085 → 8.5 */
const pc = (x: number) => String(Math.round(x * 1000) / 10);
/** 장비 그림 (36 4-2 · 4-3): 이름 있는 장신구 → 종류 → 부위 (item-<부위>) → 부위 선 아이콘. 빈칸은 부위 그림 */
const itemIc = (x: SlotKey | GearItem) => gearIcon(typeof x === 'string' ? { slot: x } : x);

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

/** ① 장비 칸 (시안 .slot): 등급 색 테두리·빛 · 등급 글자 칩 · 강화 +n · 더 좋은 장비 초록 ↑ · 빈칸 점선 + 가방 개수 */
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
        <span class="c7-sq">${itemIc(key)}${up}</span><b>${name}</b><small${n ? ' class="ok"' : ''}>${n ? `가방에 ${n}개` : '빈칸'}</small></button>`;
  }
  return `<button type="button" class="gtile c7-slot" data-gitem="${it.id}" style="${gvars(it)}" aria-label="${name} · ${esc(it.name)}${plusTxt(it)} · ${it.grade}${specLabel(it)}${it.lock ? ' · 잠김' : ''}${up ? ' · 가방에 더 좋은 장비' : ''}">
      <span class="c7-sq${it.plus >= MAX_PLUS ? ' max' : ''}">${itemIc(it)}<i class="c7-gl">${it.grade[0]}</i>${it.plus ? `<i class="c7-pl">+${it.plus}</i>` : ''}${specDots(it)}${up}</span>
      <b>${it.lock ? LOCK : ''}${name}</b><small>${esc(kindOf(it).name)}</small></button>`;
}

/** ② 받침대 위 이름표: 장비 점수 · 평균 등급 */
function plaqueHtml(): string {
  const avg = gearAvg(), worn = SLOTS.some(x => G.save.gear.equipped[x.key]);
  const avgTxt = avg.grade ? `<b style="color:${GRADE_INK[avg.grade]}">${avg.grade}</b>${avg.plus ? ` +${avg.plus}` : ''} 평균` : worn ? '일반 미만 평균' : '장비 없음';
  return `<div class="c7-plq"><span class="c7-psc">장비 점수 <b>${fmt(gearScore())}</b></span><small>${avgTxt}</small></div>`;
}

/** ③ 능력치 판 6칸 (34 1-2 · 10장): 체력 · 지능 · 치명타 / 가속 · 정신력 · 인내. 초록 = 장비 몫. 누르면 출처 시트 */
function statsHtml(): string {
  const p = statParts();
  const stat = (ic: string, k: string, v: string, add = '') => `<span class="c7-stat"><span class="c7-si">${ic}</span><span class="c7-sv"><small>${k}</small><b>${v}${add ? `<i>${add}</i>` : ''}</b></span></span>`;
  const pc0 = (x: number) => Math.round(x * 100);
  const crit = pc0(p.crit.total), critG = pc0(p.crit.gear), haste = pc0(p.haste.total), spirit = pc0(p.spirit.total), endure = pc0(p.endure.total);
  return `<button type="button" class="c7-stats" data-sheet="stats" aria-label="능력치 · 누르면 출처">
      <span class="c7-sh">능력치<span class="rule"></span><small>초록 = 장비 몫</small></span>
      <span class="c7-sgrid">${stat(statIc('hp'), '체력', fmt(p.hp.total), p.hp.gear ? `+${fmt(p.hp.gear)}` : '')}${stat(statIc('heal'), '지능', fmt(p.int.total), p.int.gear ? `+${fmt(p.int.gear)}` : '')}${stat(statIc('crit'), '치명타', `${crit}%`, critG ? `+${critG}` : '')}
        ${stat(statIc('haste'), '가속', `${haste}%`, haste ? `+${haste}` : '')}${stat(statIc('regen'), '정신력', `+${spirit}%`, spirit ? `+${spirit}` : '')}${stat(statIc('stamina'), '인내', `${endure}%`, endure ? `+${endure}` : '')}</span></button>`;
}

function gearHtml(): string {
  const better = betterSlots(), plan = bestGearPlan(), all = G.save.gear.bag;
  const col = (keys: SlotKey[]) => `<div class="c7-col">${keys.map(k => slotHtml(k, better)).join('')}</div>`;
  const keys = SLOTS.map(x => x.key);
  return `<section class="c7-stage" aria-label="착용 장비">
      ${col(keys.slice(0, 3))}
      <div class="c7-mid"><span class="c7-bigem">${classEmblem(hero(), 'xl')}</span>${plaqueHtml()}</div>
      ${col(keys.slice(3))}</section>
    ${msg && !sheet ? `<p class="note warn c7-msg">${esc(msg)}</p>` : ''}
    ${statsHtml()}
    <div class="c7-acts">
      <button type="button" class="g-sign c7-bagb" data-bag aria-label="가방 ${all.length}개${better.length ? ` · 더 좋은 장비 ${better.length}부위` : ''}">가방 <small>${all.length}</small>${better.length ? `<span class="g-badge">${better.length}</span>` : ''}</button>
      <button type="button" class="c7-recb" data-rec${plan.length ? '' : ' disabled'}>${UP}추천 장착</button>
      <button type="button" class="g-sign" data-salvbag${all.length ? '' : ' disabled'}>분해</button>
    </div>`;
}

/** 가방 칸: 장비 그림 + 등급 색 + +N + ↑(지금 장비보다 좋음) + 새 점 */
function bagCell(it: GearItem): string {
  const up = isBetter(it), on = !!salv?.has(it.id), nw = isNew(it);
  const label = `${it.grade} ${slotName(it.slot)} · ${it.name}${plusTxt(it)}${specLabel(it)}${up ? ' · 더 좋음' : ''}${nw ? ' · 새것' : ''}${it.lock ? ' · 잠김' : ''}`;
  return `<button type="button" class="c7-bag${on ? ' on' : ''}${it.lock ? ' lock' : ''}" data-gitem="${it.id}" style="${gvars(it)}" aria-label="${esc(label)}"${salv ? ` aria-pressed="${on}"` : ''}>${itemIc(it)}${it.plus ? `<em>+${it.plus}</em>` : ''}${specDots(it)}${up ? '<span class="up">↑</span>' : ''}${nw ? '<span class="nw"></span>' : ''}${it.lock ? `<span class="lk">${uiIcon('lock')}</span>` : ''}${on ? '<span class="ck">✓</span>' : ''}</button>`;
}

const grip = '<span class="grip" aria-hidden="true"></span>';
const dim = '<div class="sheet-dim" data-sheetx></div>';
const updn = (v: number, unit = '') => (v > 0 ? `<span class="c7-up">▲${v}${unit}</span>` : v < 0 ? `<span class="c7-dn">▼${-v}${unit}</span>` : '<span class="cap">같음</span>');

/** 가방 시트: 필터 · 정렬 · 5열 격자 · 분해 고르기 (두 번 눌러 분해) · 재료 */
function bagSheet(): string {
  const m = G.save.mats, all = G.save.gear.bag;
  const f = FILTERS.find(x => x.key === bagFilter) || FILTERS[0];
  const list = all.filter(f.ok).sort(SORTS[bagSort].cmp);
  const picked = salv ? all.filter(it => salv!.has(it.id)) : [];
  const sum = picked.reduce((a, it) => { const v = salvageOf(it); return { gold: a.gold + v.gold, stone: a.stone + v.stone, refined: a.refined + v.refined }; }, { gold: 0, stone: 0, refined: 0 });
  const salvBar = salv ? `<div class="c7-salv">
      <button class="btn2" type="button" data-salvall>일반·고급 모두</button>
      <button class="btn2 hot" type="button" data-salvgo${picked.length ? '' : ' disabled'}>${salvAsk ? '한 번 더 누르면 분해' : `${picked.length}개 분해`}</button>
      <button class="btn2" type="button" data-salvx>취소</button>
      <span class="cap">${picked.length ? `골드 ${fmt(sum.gold)} · 강화석 ${sum.stone}${sum.refined ? ` · 정제 강화석 ${sum.refined}` : ''}` : '분해할 장비 선택 · 잠긴 장비 제외'}</span></div>` : '';
  const grid = !all.length ? '<p class="cap c7-bempty">던전을 클리어하면 장비 1개씩 획득</p>'
    : !list.length ? '<p class="cap c7-bempty">이 분류 장비 없음</p>'
    : `<div class="c7-bags${salv ? ' picking' : ''}">${list.map(bagCell).join('')}</div>`;
  return `${dim}<section class="sheet c7-bsheet c7-bagsec" role="dialog" aria-label="가방">${grip}
      <div class="c7-row"><h3 class="h-rule">가방</h3><span class="cap">${all.length}개</span>${fill}${all.length ? `<button type="button" class="btn2 c7-sort" data-bsort aria-label="정렬: ${SORTS[bagSort].name}">${SORTS[bagSort].name} ▾</button>` : ''}</div>
      ${all.length ? `<div class="c7-fcs" role="group" aria-label="가방 분류">${FILTERS.map(x => `<button type="button" class="c7-fc" data-bfilter="${x.key}" aria-pressed="${bagFilter === x.key}">${x.name}</button>`).join('')}</div>` : ''}
      ${msg ? `<p class="note warn c7-msg">${esc(msg)}</p>` : ''}
      ${salvBar}${grid}
      <div class="c7-bagf">${all.length && !salv ? '<button type="button" class="btn2" data-salvon>분해 고르기</button>' : ''}<span class="cap gmats">강화석 ${fmt(m.stone)} · 정제 강화석 ${fmt(m.refined)}</span>${fill}${salv ? '' : `<button type="button" class="btn2" data-codex>도감 ${codexHave(SPEC_GROUP_KEYS)}/${SPEC_KEYS.length}</button>`}<button type="button" class="btn2" data-sheetx>닫기</button></div></section>`;
}

/** 묶음들에서 얻은 칸 수 */
const codexHave = (gs: readonly CodexGroup[]) => gs.reduce((a, g) => a + codexKeys(g).filter(k => G.save.gear.codex.includes(k)).length, 0);
const SPEC_GROUP_KEYS = Object.keys(SPEC_GROUPS) as SpecGroup[];

/** 지난 판에 처음 얻은 특수능력 (42 1-6): 도감 표식 위에서 fx-spec-new가 칸마다 한 번 터짐 (36 4-6). 효과 줄이기면 없음 */
let freshShown: { of: object; keys: Set<string> } | null = null;
function freshFx(key: string): string {
  const x = Flow.settle;
  if (!x?.newSpecs?.includes(key) || G.save.settings.reducedEffects) return '';
  if (freshShown?.of !== x) freshShown = { of: x, keys: new Set() };
  if (freshShown.keys.has(key)) return '';
  freshShown.keys.add(key);
  return fxArt('fx-spec-new', 'c7-spnew');
}

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
      <div class="c7-bagf">${titles.length ? `<span class="cap">받은 칭호 ${titles.map(t => `「${esc(t)}」`).join(' ')}</span>` : '<span class="cap">효과는 영웅 장비 최대값</span>'}${fill}<button type="button" class="btn2" data-sheetx>닫기</button></div></section>`;
}

/** 장비 상세 시트 (27 4-3, 시안 GearSheet27): 지금 장비와 비교 ▲▼ · 강화 · 잠금 · 분해 · 장착(착용 중이면 강화) */
/** 재설정 ↻ 버튼 (재설정 모드일 때만) */
const rrBtn = (kind: RerollKind, i: number, name: string) => (rrOn ? `<button type="button" class="c7-rr" data-rr="${kind}:${i}" aria-label="${esc(name)} 다시 굴림">↻</button>` : '');
/** 재설정 비용 줄 (34 6-8): 옵션 한 줄 · 특수능력 한 줄 (3배), 가진 정제 강화석 · 각성 값이 사라진다는 경고 */
function rrCostHtml(it: GearItem): string {
  const a = rerollCost(it, false), b = rerollCost(it, true);
  const up = (it.lines ?? []).some(l => l.up) ? ' · 각성으로 오른 값은 재설정하면 사라집니다' : '';
  return `<p class="cap c7-rrcost">한 줄 다시 굴림 · 옵션 골드 ${fmt(a.gold)} + 정제 강화석 ${a.refined} · 특수능력 골드 ${fmt(b.gold)} + 정제 강화석 ${b.refined} (가진 것 ${fmt(G.save.mats.refined)})${up}</p>`;
}
/** Lv 60 재설정 둘째 후보: 「이걸로」 누르면 바꿈 */
function rrAltHtml(it: GearItem, kind: RerollKind): string {
  if (!rrAlt || rrAlt.id !== it.id || rrAlt.kind !== kind) return '';
  let txt: string;
  if (kind === 'line') { const l = rrAlt.alt as GearLine; txt = `${STATS[l.stat].name} +${pc(lineValue(it, l))}%`; }
  else { const l = rrAlt.alt as SpecLine, d = SPECS[l.key]; txt = `${d.name} · ${specText(d, specValue(l.key, it.grade, l.roll))}`; }
  return `<div class="c7-rralt"><span class="cap">다른 후보</span><b>${esc(txt)}</b><button type="button" class="btn2" data-rrpick>이걸로</button></div>`;
}

/** 목표까지 강화 판 (34 7-3): 목표 칩 · 평균 예상 · 떨어지면 멈춤 · 시작 / 도는 중 · 멈춤 / 끝난 까닭 */
function autoHtml(it: GearItem): string {
  if (!auto || auto.id !== it.id) return '';
  if (auto.run) return `<div class="c7-auto run" role="status"><b>+${auto.target}까지 강화 중 · ${auto.n}번째</b><span class="c7-fill"></span><button type="button" class="btn2" data-autostop>멈춤</button></div>`;
  const tg = Math.max(auto.target, it.plus + 1);
  const chips = Array.from({ length: MAX_PLUS - it.plus }, (_, k) => it.plus + 1 + k).map(n => `<button type="button" class="c7-fc" data-autot="${n}" aria-pressed="${n === tg}">+${n}</button>`).join('');
  const e = enhanceForecast(it, tg), r1 = (x: number) => (x >= 10 ? fmt(Math.round(x)) : String(Math.round(x * 10) / 10));
  const est = `평균 ${r1(e.tries)}번 · 골드 약 ${fmt(Math.round(e.gold / 10) * 10)}${e.stone ? ` · 강화석 약 ${r1(e.stone)}` : ''}${e.refined ? ` · 정제 강화석 약 ${r1(e.refined)}` : ''}`;
  return `<div class="c7-auto">
      ${auto.why ? `<p class="note c7-autowhy">${esc(auto.why)} · ${auto.n}번 시도</p>` : ''}
      <div class="c7-fcs" role="group" aria-label="목표 단계">${chips}</div>
      <p class="cap">${est}</p>
      <div class="c7-autof"><label class="toggle"><input type="checkbox" data-autodrop${auto.stopDrop ? ' checked' : ''}> 떨어지면 멈춤</label><span class="c7-fill"></span><button type="button" class="btn2" data-autox>닫기</button><button type="button" class="btn2 hot" data-autogo>+${tg}까지 시작</button></div></div>`;
}

/** 강화 한 번 눌렀을 때: 저장은 끝났고 연출만 (각성은 룰렛 0.9초 + 멈춘 줄 번쩍 0.6초 더) */
function playFx(o: EnhanceOutcome, quick: boolean): void {
  efx = { ...o, quick };
  clearTimeout(efxTimer);
  efxTimer = setTimeout(endFx, (quick ? 500 : 1500) + (o.awaken != null ? 1500 : 0));
  vibe(o.ok ? [15] : [30, 40, 30]);
}
function endFx(): void {
  clearTimeout(efxTimer);
  if (!efx) return;
  efx = null;
  if (auto?.run) autoStep();
  else render();
}
/** 목표까지 강화 한 단계: 목표 · 재료 부족 · (떨어지면 멈춤) 떨어짐이면 멈춤. 각성 단계는 긴 연출로 룰렛을 보여 줌 */
function autoStep(): void {
  if (!auto?.run) { render(); return; }
  // 화면을 떠났거나 시트를 닫았으면 멈춤 (보이지 않는 데서 강화하지 않음)
  if (s.el.hidden || sheet?.k !== 'item' || sheet.id !== auto.id) { auto = null; efx = null; return; }
  const it = findItem(auto.id);
  const stop = (why: string) => { auto!.run = false; auto!.why = why; render(); };
  if (!it) { auto = null; render(); return; }
  if (it.plus >= auto.target) return stop(`+${auto.target} 도달`);
  const lack = enhanceLack(it);
  if (lack) return stop(lack);
  const o = enhanceTry(auto.id);
  if (typeof o === 'string') return stop(o);
  auto.n++;
  msg = enhanceMsg(o);
  if (!o.ok && o.to < o.from && auto.stopDrop) auto.run = false, auto.why = `+${o.from} → +${o.to} 떨어져서 멈춤`;
  else if (o.to >= auto.target) auto.run = false, auto.why = `+${auto.target} 도달`;
  playFx(o, o.awaken == null);
  render();
}
const vibe = (p: number[]) => { if (G.save.settings.vibrate && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(p); };

function itemSheet(id: number): string {
  const it = findItem(id);
  if (!it) return '';
  const eq = G.save.gear.equipped, worn = eq[it.slot]?.id === it.id, cur = worn ? null : eq[it.slot] ?? null;
  const sc = scoreOf(it), a = itemStats(it), b = itemStats(cur);
  const sub2 = [slotName(it.slot), esc(kindOf(it).name), it.grade, worn ? '착용 중' : isNew(it) ? '새로 얻음' : '', it.lock ? '잠김' : ''].filter(Boolean).join(' · ');
  // 비교 줄: 퍼센트 포인트 (소수 한 자리)
  const d1 = (x: number, y: number) => Math.round((x - y) * 1000) / 10;
  const row = (k: string, v: string, diff: string, cls = '') => `<div class="c7-cmp${cls}"><span>${k}</span><b>${v}</b>${diff}</div>`;
  // 옵션 각성 룰렛 (34 7-2): 추가 옵션 줄이 차례로 빛나다 각성한 줄에서 멈춤
  const aw = efx && efx.id === it.id && efx.awaken != null ? efx.awaken : null;
  const lineCls = (i: number) => (aw == null ? '' : ` roul${i === aw ? ' aw' : ''}`);
  // 연출 그림 (36 4-4 G · 4-6 J)은 효과 줄이기면 빼고 CSS 연출만
  const calm = !!G.save.settings.reducedEffects;
  // 이 장비의 줄 (34 10장): 주 능력치 · 고정 옵션 (종류) · 추가 옵션 (굴림 막대)
  const fx = fixedOf(it);
  const own = [
    ...mainOf(it).map(x => row(STATS[x.stat].name, `+${pc(x.v)}%`, '<span class="cap">주 능력치</span>')),
    row(STATS[fx.stat].name, `+${pc(fx.v)}%`, `<span class="cap">${esc(kindOf(it).name)} 고정</span>`),
    ...(it.lines ?? []).map((l, i) => row(STATS[l.stat].name, `+${pc(lineValue(it, l))}%`, `<span class="c7-roll" role="img" aria-label="굴림 ${Math.round(l.roll * 100)}%"><i style="width:${Math.round(rollFill(l.roll) * 100)}%"></i></span>${l.up ? '<span class="c7-awt">각성</span>' : ''}${rrBtn('line', i, STATS[l.stat].name)}${i === aw && !calm ? fxArt('fx-awaken', 'c7-fxawk') : ''}`, lineCls(i))),
  ].join('');
  // 특수능력 (42 1-3 · 1-5): 묶음 표식 · 이름 · 효과 · 굴림 막대, 꺼진 줄은 회색 + 이유
  const sp = specRows(it);
  const spec = sp.length ? `<div class="c7-cmpw"><h3 class="h-rule c7-h3">특수능력<span class="rule"></span><span class="cap">${sp.length}줄</span></h3>${sp.map(s => `<div class="c7-spec${s.off ? ' off' : ''}" data-g="${s.group}"><span class="c7-spg">${specBadge(s.group, s.badge)}</span><span class="c7-spt"><b>${esc(s.name)}</b><span class="cap">${esc(s.text)}</span></span>${s.off ? `<span class="cap c7-spoff">${s.off}</span>` : s.roll != null ? `<span class="c7-roll" role="img" aria-label="굴림 ${Math.round(s.roll * 100)}%"><i style="width:${Math.round(rollFill(s.roll) * 100)}%"></i></span>` : ''}${s.i != null ? rrBtn('spec', s.i, s.name) : ''}</div>`).join('')}${rrAltHtml(it, 'spec')}</div>` : '';
  // 지금 장비와 비교: 둘 중 하나라도 있는 능력치만
  const cmp = STAT_KEYS.filter(k => a[k] || b[k]).map(k => row(STATS[k].name, `+${pc(a[k])}%`, updn(d1(a[k], b[k])))).join('');
  const c = enhanceCost(it), m = G.save.mats, gold = G.save.player.gold;
  const can = !!c && gold >= c.gold && m.stone >= c.stone && m.refined >= c.refined;
  const lack = c && !can ? (gold < c.gold ? '골드 부족' : m.stone < c.stone ? '강화석 부족' : '정제 강화석 부족') : '';
  const costTxt = c ? [`골드 ${fmt(c.gold)}`, c.stone ? `강화석 ${c.stone} (가진 것 ${fmt(m.stone)})` : '', c.refined ? `정제 강화석 ${c.refined} (가진 것 ${fmt(m.refined)})` : ''].filter(Boolean).join(' · ') : '더 올릴 수 없음';
  const sv = salvageOf(it);
  const cmpCap = worn ? '착용 중' : cur ? `${esc(cur.name)}${plusTxt(cur)}` : '빈칸';
  // 강화 연출 (34 7장): 성공 = 번쩍 + 「+6」, 떨어짐 = 흔들림 + 「+5 → +4」, 그대로 = 「실패 · +1 그대로」. 짧게 = 0.5초
  const f = efx && efx.id === it.id ? efx : null;
  const fxCls = f ? ` fx ${f.ok ? 'fx-ok' : f.to < f.from ? 'fx-drop' : 'fx-fail'}${f.quick ? ' fx-quick' : ''}${f.awaken != null ? ' fx-aw' : ''}` : '';
  const fxRes = f ? `<b class="c7-fxres" aria-live="polite">${f.ok ? `+${f.to}` : f.to < f.from ? `+${f.from} → +${f.to}` : `실패 · +${f.from} 그대로`}</b>` : '';
  // 망치 (0.4 · 0.7 · 1.0초, 짧게면 없음) · 불꽃 (CSS 반짝이 자리에 그림) · 실패하면 금 간 조각 (36 4-4 G)
  const fxOn = f ? `<span class="c7-fxring" aria-hidden="true"></span><span class="c7-fxspark" aria-hidden="true">${calm ? '' : fxArt('fx-enhance-spark', 'c7-fxspi')}</span>${f.quick || calm ? '' : fxArt('fx-enhance-hammer', 'c7-fxham')}${f.ok || calm ? '' : fxArt('fx-enhance-crack', 'c7-fxcrk')}` : '';
  const max10 = it.plus >= MAX_PLUS ? ' max' : '';
  return `${dim}<section class="sheet c7-gsheet${fxCls}" role="dialog" aria-labelledby="gearSheetTitle" aria-describedby="gearSheetSave" style="${gvars(it)}">${grip}
      <div class="c7-dialog-head"><h3 id="gearSheetTitle">장비 상세</h3><button type="button" class="btn2 c7-dialog-close" data-sheetx aria-label="장비 상세 닫기">닫기</button></div>
      <div class="c7-ghead"><span class="c7-gic${max10}">${itemIc(it)}<span class="c7-gl">${it.grade[0]}</span>${fxOn}${fxRes}</span>
        <span class="c7-gname"><b>${esc(it.name)}${it.plus ? ` <i>+${it.plus}</i>` : ''}</b><span class="cap">${sub2}</span></span>
        <span class="c7-gscore"><span class="cap">점수</span><b>${sc}</b>${worn ? '' : updn(sc - scoreOf(cur))}</span></div>
      <div class="c7-cmpw"><h3 class="h-rule c7-h3">옵션<span class="rule"></span><span class="cap">${it.lines?.length ?? 0}줄 추가</span>${rerollOpen() ? `<button type="button" class="btn2 c7-rrb" data-rrmode aria-pressed="${rrOn}">재설정</button>` : ''}</h3>${rrOn ? rrCostHtml(it) : ''}${own}${rrAltHtml(it, 'line')}</div>
      ${spec}
      ${worn ? '' : `<div class="c7-cmpw"><h3 class="h-rule c7-h3">지금 장비와 비교<span class="rule"></span><span class="cap">${cmpCap}</span></h3>${cmp}</div>`}
      <div class="c7-enh"><span><b>${c ? `강화 +${it.plus} → +${c.to}` : `최대 강화 +${MAX_PLUS}`}</b><span class="cap">${costTxt}</span>${c ? `<span class="cap c7-rate">성공 ${Math.round(c.rate * 100)}%${c.rate >= 1 ? '' : c.fail < it.plus ? ` · <em class="c7-lack">실패하면 +${c.fail}${c.fail % 10 === 3 || c.fail % 10 === 6 || c.fail % 10 === 0 ? '으로' : '로'} 떨어짐</em>` : ' · 실패해도 그대로'}</span>` : ''}</span><span class="cap${lack ? ' c7-lack' : ''}">${worn ? lack : c ? '장착 뒤 강화 추천' : ''}</span>${worn && c && !(auto && auto.id === it.id) ? '<button type="button" class="btn2 c7-autob" data-autoopen>목표까지</button>' : ''}</div>
      ${autoHtml(it)}
      <p class="note c7-save-note" id="gearSheetSave">장착·강화·잠금은 즉시 저장됩니다.</p>
      ${msg ? `<p class="note warn c7-msg">${esc(msg)}</p>` : ''}
      <div class="c7-sbtns">
        <button type="button" class="c7-sb c7-lockb" data-lock="${it.id}" aria-pressed="${!!it.lock}">${uiIcon('lock')}<small>${it.lock ? '잠김' : '잠금'}</small></button>
        <button type="button" class="c7-sb c7-salvb" data-salv1="${it.id}"${worn || it.lock ? ' disabled' : ''}>분해<small>${worn ? '착용 중' : it.lock ? '잠김' : `강화석 +${sv.stone}`}</small></button>
        ${worn ? `<button type="button" class="c7-cta" data-enh="${it.id}"${can && !auto?.run ? '' : ' disabled'}>${c ? '강화' : '최대 강화'}</button>` : `<button type="button" class="c7-cta" data-equip="${it.id}">장착</button>`}
      </div></section>`;
}

/** 능력치 출처 시트: 기본 · 레벨 · 장비 · 특성 몫 */
function statsSheet(): string {
  const p = statParts(), pc0 = (x: number) => Math.round(x * 100);
  const crit = pc0(p.crit.total), haste = pc0(p.haste.total), spirit = pc0(p.spirit.total);
  // 정점 수련 (34 2-2): Lv 51부터 레벨 몫 옆에 작게
  const apexTxt = p.apex > 0 ? ` (수련 +${(p.apex * 100).toFixed(1)}%)` : '';
  const row = (k: string, v: string, parts: string[]) => `<div class="c7-src"><span>${k}</span><b>${v}</b><span class="cap">${parts.filter(Boolean).join(' · ')}</span></div>`;
  return `${dim}<section class="sheet c7-ssheet" role="dialog" aria-label="능력치 출처">${grip}
      <h3 class="h-rule">능력치 출처<span class="rule"></span><span class="cap">레벨 · 장비 · 특성</span></h3>
      <div class="c7-srcs">
        ${row('체력', fmt(p.hp.total), [`기본 ${fmt(p.hp.base)}`, `레벨 +${fmt(p.hp.level)}${apexTxt}`, `장비 +${fmt(p.hp.gear)}`])}
        ${row('지능', fmt(p.int.total), [`기본 ${fmt(p.int.base)}`, `레벨 +${fmt(p.int.level)}${apexTxt}`, `장비 +${fmt(p.int.gear)}`])}
        ${row('치명타', `${crit}%`, [`기본 ${pc0(p.crit.base)}%`, `장비 +${pc0(p.crit.gear)}%`])}
        ${row('가속', `${haste}%`, [`장비 +${haste}%`, `최대 ${pc0(p.haste.cap)}%`])}
        ${row('정신력', `+${spirit}%`, [`장비 +${spirit}%`, `마나 재생 초당 ${(p.spirit.regen * (1 + p.spirit.total)).toFixed(2)}%`])}
        ${row('인내', `${pc0(p.endure.total)}%`, ['받는 피해 감소', `장비 +${pc0(p.endure.gear)}%`])}
        ${row('특성', '0', ['상시 능력치 몫 없음'])}
      </div>
      <p class="note">지능은 치유 회복량입니다. 스킬 회복량은 지능의 비율입니다. 가속은 시전과 GCD를 함께 줄입니다. 인내는 내가 받는 피해를 줄입니다. 고른 특성은 전투 중 조건이 맞으면 켜집니다.</p>
      <button type="button" class="c7-cta" data-sheetx>닫기</button></section>`;
}

/** 추천 장착 확인 시트: 바뀌는 칸을 먼저 보여 주고 「바꾸기」 */
function recSheet(): string {
  const plan = bestGearPlan();
  if (!plan.length) return '';
  const now = gearScore(), after = now + plan.reduce((a, p) => a + scoreOf(p.next) - scoreOf(p.now), 0);
  const rows = plan.map(p => `<div class="c7-cmp c7-rec"><span>${slotName(p.slot)}</span><b><s>${p.now ? `${esc(p.now.name)}${plusTxt(p.now)}` : '빈칸'}</s> → <em style="color:${GRADE_INK[p.next.grade]}">${esc(p.next.name)}${plusTxt(p.next)}</em></b>${updn(scoreOf(p.next) - scoreOf(p.now))}</div>`).join('');
  return `${dim}<section class="sheet c7-rsheet" role="dialog" aria-label="추천 장착">${grip}
      <h3 class="h-rule">추천 장착<span class="rule"></span><span class="cap">장비 점수 ${fmt(now)} → ${fmt(after)}</span></h3>
      <p class="note">부위마다 점수가 가장 높은 장비. 바뀌는 칸 ${plan.length}개</p>
      <div class="c7-cmpw">${rows}</div>
      <div class="c7-sbtns"><button type="button" class="c7-sb c7-wide" data-sheetx>취소</button><button type="button" class="c7-cta" data-recgo>바꾸기</button></div></section>`;
}

// ---------- 스킬 (27 4-4, 시안 CharSkill31) ----------
const lockLv = (k: SkillKey) => (SKILL_LEVEL[k] > healerLevel() ? SKILL_LEVEL[k] : 0);
/** 펼친 줄 (스킬 키 · words · pas) */
let skOpen: string | null = null;

/** 스킬 선 아이콘 (skill-<키> 그림이 없을 때). 사제 = 시안 CharSkill31 */
const SKILL_LINE: Record<SkillKey, string> = {
  heal: '<path d="M12 5v14M5 12h14"/>',
  flash: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  renew: '<path d="M12 21v-9"/><path d="M12 12c-4 0-6-3-6-7 4 0 6 3 6 7z"/><path d="M12 14c3 0 5-2 5-5-3 0-5 2-5 5z"/>',
  poh: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="5" r="1.6"/><circle cx="18" cy="15.5" r="1.6"/><circle cx="6" cy="15.5" r="1.6"/>',
  purify: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z"/>',
  guardian: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 11c1.5-2 4.5-2 6 0"/>',
  hymn: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  serenity: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  sanctify: '<ellipse cx="12" cy="17" rx="9" ry="3.5"/><ellipse cx="12" cy="17" rx="4.5" ry="1.6"/><path d="M12 3v9M8.5 6.5 12 3l3.5 3.5"/>',
  sprout: '<path d="M12 21v-8"/><path d="M12 13c-3.5 0-5.5-2.5-5.5-6 3.5 0 5.5 2.5 5.5 6zM12 13c3.5 0 5.5-2.5 5.5-6-3.5 0-5.5 2.5-5.5 6z"/>',
  growth: '<path d="M8 21c0-5 8-5 8-10S8 6 12 3"/><path d="M16 11c2 0 3.5-1 4-3-2 0-3.5 1-4 3zM9 15c-2 0-3.5-1-4-3 2 0 3.5 1 4 3z"/>',
  bloom: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C10 6 10.5 3.5 12 3c1.5.5 2 3 0 6.5zM14.5 12c3.5-2 6-1.5 6.5 0-.5 1.5-3 2-6.5 0zM12 14.5c2 3.5 1.5 6 0 6.5-1.5-.5-2-3 0-6.5zM9.5 12C6 14 3.5 13.5 3 12c.5-1.5 3-2 6.5 0z"/>',
  wildflower: '<circle cx="6" cy="9" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 11v9M12 8v12M18 11v9M3 20h18"/>',
  natureCleanse: '<path d="M5 19C-1 8 10 3 21 3c0 11-5 20-16 16Z"/><path d="M5 19l10-10"/>',
  bark: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5c-3 1-4 4-3 7M15 8c1 2 1 5-1 7M9 17c2 1 4 1 6-1"/>',
  quietwood: '<path d="M6 20v-4M12 20v-6M18 20v-4"/><path d="M3.5 16 6 10l2.5 6zM9 14l3-8 3 8zM15.5 16 18 10l2.5 6z"/>',
  rebirth: '<path d="M12 21a5 5 0 0 1-5-5c0-3 2.5-4.5 5-9 2.5 4.5 5 6 5 9a5 5 0 0 1-5 5z"/><path d="M12 21c-1.4 0-2.5-1-2.5-2.5S12 15 12 15s2.5 2 2.5 3.5S13.4 21 12 21z"/>',
  holyLight: '<path d="M7 21v-9a1.5 1.5 0 0 1 3 0V5a1.5 1.5 0 0 1 3 0v6V4.5a1.5 1.5 0 0 1 3 0V12V8a1.5 1.5 0 0 1 3 0v7c0 3.5-2.5 6-6 6z"/>',
  holyStrike: '<path d="M14 3l7 7-3 3-7-7z"/><path d="M11.5 9.5 4 17l3 3 7.5-7.5"/>',
  oath: '<path d="M6 4h12v13l-6 4-6-4z"/><path d="M9 10l2 2 4-4"/>',
  lightWave: '<path d="M2 11c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4 2.5 4 5 4M2 18c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4 2.5 4 5 4"/>',
  handCleanse: '<path d="M7 21v-8a1.5 1.5 0 0 1 3 0V7a1.5 1.5 0 0 1 3 0v5V7a1.5 1.5 0 0 1 3 0v8c0 3.5-2.5 6-6 6z"/><path d="M19 2l.7 1.8 1.8.7-1.8.7L19 7l-.7-1.8-1.8-.7 1.8-.7z"/>',
  sacrifice: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M12 15s-3-1.8-3-4a1.6 1.6 0 0 1 3-1 1.6 1.6 0 0 1 3 1c0 2.2-3 4-3 4z"/>',
  sanctuary: '<path d="M4 18a8 8 0 0 1 16 0z"/><path d="M2 18h20M12 7V3"/>',
  handGuard: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M10 15v-4.5a1 1 0 0 1 2 0V9a1 1 0 0 1 2 0v6"/>',
};
/** 스킬 그림 (skill-<키>, 없으면 선 아이콘) */
const skillIc = (k: SkillKey) => gameIcon(k, line(SKILL_LINE[k]), 'skill');

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
      <p class="c7-sdt">특성 스킬 자리 (P2). 배치 바꾸기로 다른 스킬과 바꿀 수 있습니다.</p></section>`;
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
  const ks = heroSkills(hero()).filter(k => k !== 'serenity' && k !== 'sanctify');
  const body = Math.max(2, ...ks.map(k => lines(skDesc(k), `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`)));
  const small = `400 12px ${cs.fontFamily}`;
  const hint = Math.max(1, ...ks.map(k => lines(`${descHint(k, 'NE', hero())} 칸 탭 기본 힐입니다. Lv 15에 배웁니다.`, small)));
  box.style.height = `${112 + (body - 2) * 19 + (hint - 1) * 17}px`;
}

/** 패시브 목록 (사제: 성언 게이지 포함 4개, 다른 직업: 고유 시스템 + 패시브) */
function passivesOf(h: HeroKey): { name: string; lv: number; desc: string; kind: string }[] {
  if (h === 'priest') return (['echo', 'grace', 'symbol', 'words'] as PassiveKey[]).map(x => ({ name: PASSIVE_NAME[x], lv: PASSIVE_LEVEL[x], desc: PASSIVE_DESC[x], kind: x === 'words' ? '고유 시스템' : '패시브' }));
  return [{ ...HEROES[h].system, kind: '고유 시스템' }, ...HEROES[h].passives.map(p => ({ ...p, kind: '패시브' }))];
}

function skillRows(lay: Record<string, string | null>): string {
  const L = battle().layout, h = hero(), lv = healerLevel();
  const rows = heroSkills(h).filter(k => k !== 'serenity' && k !== 'sanctify').map(k => {
    const lock = lockLv(k), d = dirOf(k, lay), open = skOpen === k, sk = SKILLS[k];
    const meta = [SKILL_INFO[k].kind, castShort(k), costShort(k), sk.cd ? `${sk.cd}초` : ''].filter(Boolean).join(' · ');
    return `<button type="button" class="c7-sk${lock ? ' locked' : ''}${d && sel === d && !swapping ? ' on' : ''}" data-skill="${k}" aria-expanded="${open}">
        <span class="c7-ski">${skillIc(k)}</span><span class="c7-skn"><b>${sk.name}</b><span>${lock ? `${LOCK}Lv ${lock}에 배움 · ` : ''}${meta}</span></span><span class="c7-dir">${d ? L.ARROW[d] : ''}</span></button>
      ${open ? `<p class="c7-skd">${esc(skDesc(k))}</p>` : ''}`;
  });
  if (h === 'priest') {
    const lock = lv < PASSIVE_LEVEL.words ? PASSIVE_LEVEL.words : 0, open = skOpen === 'words';
    rows.push(`<button type="button" class="c7-sk holy${lock ? ' locked' : ''}" data-skrow="words" aria-expanded="${open}"><span class="c7-ski">${skillIc('serenity')}</span><span class="c7-skn"><b>${SKILLS.serenity.name} · ${SKILLS.sanctify.name}</b><span>${lock ? `${LOCK}Lv ${lock}에 배움 · ` : ''}게이지 100%에서 휠 조각이 바뀜 · 마나 0</span></span><span class="c7-dir"></span></button>
      ${open ? `<p class="c7-skd"><b>${SKILLS.serenity.name}</b> ${esc(skDesc('serenity'))}<br><b>${SKILLS.sanctify.name}</b> ${esc(skDesc('sanctify'))}</p>` : ''}`);
  }
  const pas = passivesOf(h), open = skOpen === 'pas';
  rows.push(`<button type="button" class="c7-sk pas" data-skrow="pas" aria-expanded="${open}"><span class="c7-ski">${line('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5"/>')}</span><span class="c7-skn"><b>패시브 ${pas.length}</b><span>${pas.map(p => p.name).join(' · ')}</span></span><span class="c7-dir">${open ? '▴' : '▾'}</span></button>
    ${open ? `<ul class="c7-pas">${pas.map(p => `<li class="${p.lv > lv ? 'locked' : ''}"><b>${p.name}</b><span class="cap">${p.kind} · ${p.lv > lv ? `${LOCK}Lv ${p.lv}에 배움` : `Lv ${p.lv}`}</span><p>${esc(p.desc)}</p></li>`).join('')}</ul>` : ''}`);
  return rows.join('');
}

function skillHtml(): string {
  const st = G.save.settings, L = battle().layout, lay = layoutNow(), h = hero();
  const tapSkill = skillAt(h, st.tapKey) || skillAt(h, 'heal')!, basic = skillAt(h, 'heal')!;
  const tapLock = lockLv(tapSkill);
  const { slots, items } = itemsNow();
  const nextSlotLv = ITEM_SLOT_LV.find(x => itemSlots(x) > slots);
  const stock = G.save.tut >= TUT.done ? G.save.bag : null;
  const taps = (Object.keys(battle().tapKeys) as TapKey[]).map(t => {
    const k = skillAt(h, t)!, lk = lockLv(k);
    return `<button type="button" data-tap="${t}" aria-pressed="${st.tapKey === t}"${lk ? ` disabled title="Lv ${lk}에 배움"` : ''}>${lk ? LOCK : ''}${SKILLS[k].name}</button>`;
  }).join('');
  const cells = Array.from({ length: slots }, (_, i) => {
    const k = items[i];
    if (!k) return `<button type="button" class="c7-item empty" data-islot="${i}">빈 칸 +</button>`;
    const n = stock ? stock[k] || 0 : null;
    return `<button type="button" class="c7-item" data-islot="${i}" aria-label="${ITEMS[k].name}${n != null ? ` ${n}개` : ''} · 바꾸기">${useIcon(k)}<span>${ITEMS[k].short}${n != null ? ` ×${n}` : ''}</span></button>`;
  }).join('');
  return `<div class="c7-mode" role="group" aria-label="휠 보기 방식"><button type="button" data-smode="view" aria-pressed="${!swapping}">설명 보기</button><button type="button" data-smode="swap" aria-pressed="${swapping}">배치 바꾸기</button></div>
    <div class="c7-wwrap"><span class="c7-mcircle" aria-hidden="true">${gameIcon('magic-circle', '', 'ui')}</span><div class="c7-wheel${swapping ? ' swapping' : ''}">${L.GRID.map(d => wheelCell(d, lay)).join('')}</div></div>
    ${descBox(lay)}
    <section class="c7-sec"><h2 class="c7-h">칸 탭 기본 힐<span class="rule"></span></h2><div class="c7-taps" role="group" aria-label="칸 탭 기본 힐">${taps}</div>
      ${tapLock ? `<p class="c7-hnote">Lv ${tapLock} 전까진 ${SKILLS[basic].name}${josa(SKILLS[basic].name, '으로', '로')} 탭</p>` : ''}</section>
    <section class="c7-sec"><h2 class="c7-h">단축칸<span class="rule"></span><small>${slots}칸 · 편성과 같음${nextSlotLv ? ` · Lv ${nextSlotLv}에 ${itemSlots(nextSlotLv)}칸` : ''}</small></h2>
      <div class="c7-items" style="--n:${Math.max(slots, 2)}">${cells}</div></section>
    <section class="c7-sklist">${skillRows(lay)}</section>`;
}

/** 단축칸 고르기 시트 (편성 화면과 같은 칩) */
function itemsSheet(): string {
  const { slots, items } = itemsNow();
  return `${dim}<section class="sheet c7-isheet" role="dialog" aria-label="단축칸 고르기">${grip}
      <h3 class="h-rule">단축칸<span class="rule"></span><span class="cap">${items.length} / ${slots}칸 · 누르면 넣기·빼기</span></h3>
      ${itemChipsHtml(items)}
      <p class="note${msg ? ' warn' : ''}">${msg ? esc(msg) : items.map(k => `<b>${ITEMS[k].short}</b> ${esc(ITEMS[k].desc)}`).join('<br>') || '빈 칸'}</p>
      <button type="button" class="c7-cta" data-sheetx>닫기</button></section>`;
}

// ---------- 특성 (27 4-5, 시안 CharTalent31): 나무판 · 단마다 메달 3개 · 고른 길(금빛 선) · 프리셋 3벌 · 칸을 누르면 아래 시트 ----------
/** 특성 선 아이콘 (특성 그림은 아직 없음, 31 0장). 앞 4단 = 시안 CharTalent31 */
const TALENT_LINE: Record<TalentKey, string> = {
  longBreath: '<path d="M3 9c3 0 3-3 6-3s3 3 6 3 3-3 6-3M3 15c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/>',
  lightTouch: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  wideCircle: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  brink: '<path d="M4 20l6-8 4 4 6-10"/>',
  washed: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/>',
  practiced: '<path d="M12 5v14M5 12h14"/>',
  overflow: '<path d="M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z"/>',
  hopRenew: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  breather: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l3 2"/>',
  fullHeart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  spreadSerenity: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5" stroke-dasharray="2 3"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 4"/>',
  echoWord: '<path d="M6.5 16v-4.5a5.5 5.5 0 0 1 11 0V16l1.5 2h-14z"/><path d="M10 20.5h4"/>',
  miracle: '<path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M19 17l.6 1.4 1.4.6-1.4.6L19 21l-.6-1.4-1.4-.6 1.4-.6z"/>',
  savedWord: '<path d="M7 3h10v18l-5-4-5 4z"/>',
  cleansingWord: '<path d="M12 3c3 4 5 6.6 5 9.5a5 5 0 0 1-10 0C7 9.6 9 7 12 3z"/><path d="M19 3l.6 1.4 1.4.6-1.4.6L19 7l-.6-1.4-1.4-.6 1.4-.6z"/>',
  repay: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4h4"/><path d="M12 15.5s-2.5-1.5-2.5-3.3a1.3 1.3 0 0 1 2.5-.8 1.3 1.3 0 0 1 2.5.8c0 1.8-2.5 3.3-2.5 3.3z"/>',
  twoGuard: '<path d="M9 3l5 2v4c0 3.5-2 6-5 7.5C6 15 4 12.5 4 9V5z"/><path d="M15.5 8.2 20 10v4c0 3.5-2 6-5 7.5-1.2-.6-2.2-1.3-3-2.2"/>',
  firmWill: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M12 8v6"/>',
  calmHymn: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  shelter: '<path d="M3 20 12 4l9 16z"/><path d="M9.5 20l2.5-5 2.5 5"/>',
  grief: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M12 7.4 10.5 11l3 2-1.5 3"/>',
  doublePoh: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  shareRenew: '<path d="M12 21v-7M12 14l-5-5M12 14l5-5"/><path d="M7 9c-2 0-3-1.5-3-3.5 2 0 3 1.5 3 3.5zM17 9c2 0 3-1.5 3-3.5-2 0-3 1.5-3 3.5z"/>',
  quickHymn: '<path d="M4 6l7 6-7 6zM13 6l7 6-7 6z"/>',
  twoShields: '<rect x="2.5" y="9" width="9" height="6" rx="3"/><rect x="12.5" y="9" width="9" height="6" rx="3"/>',
  focusOne: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  hymnTail: '<path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 7V4M5.6 10.6 4.2 9.2M18.4 10.6l1.4-1.4"/>',
  zenith: '<path d="M4 19l8-14 8 14z"/><path d="M9 19l3-5 3 5"/>',
  scatter: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M5 19l2.5-2.5M16.5 7.5 19 5"/>',
  endless: '<path d="M6 9a3 3 0 1 0 0 6c3 0 9-6 12-6a3 3 0 1 1 0 6c-3 0-9-6-12-6z"/>',
};

function talentHtml(): string {
  const lv = healerLevel(), h = hero();
  // 직업마다 특성 트리가 따로 (25 6장). 지금 만든 건 사제 트리뿐
  if (h !== 'priest') return `<section class="c7-tiers c7-tprep"><h2 class="c7-h">특성<span class="rule"></span><small>${HEROES[h].name}</small></h2>
      <p class="c7-hnote">${HEROES[h].name} 특성 트리는 준비 중. 사제 특성을 먼저 만든 뒤 같은 틀로 추가</p></section>`;
  const mine = heroSave('priest').talents || [], pre = talentPreset('priest');
  const open = TALENTS.filter(t => t.lv <= lv).length;
  const picked = TALENTS.filter((t, i) => t.lv <= lv && mine[i] != null).length;
  const left = open - picked;
  const head = open ? `${open}단 열림 · ${picked}개 고름 · ${left ? `<b>${left}개 남음</b>` : '남은 단 없음'}` : `${LOCK}Lv ${TALENT_LEVEL}에 열림 (지금 Lv ${lv})`;
  const presets = Array.from({ length: TALENT_PRESETS }, (_, i) => `<button type="button" class="c7-pre" data-preset="${i}" aria-pressed="${pre === i}" aria-label="프리셋 ${i + 1}">${i + 1}</button>`).join('');
  const focus = sheet?.k === 'talent' ? sheet : null;
  const rows = TALENTS.map((t, i) => {
    const locked = t.lv > lv, cur = mine[i] ?? null, pending = !locked && cur == null;
    const nodes = t.picks.map((p, j) => (locked
      ? `<span class="c7-pk off"><span class="c7-tn">${uiIcon('lock')}</span><small>${p.name}</small></span>`
      : `<button type="button" class="c7-pk${focus && focus.i === i && focus.j === j ? ' focus' : ''}" data-tcell="${i}:${j}" aria-pressed="${cur === j}"><span class="c7-tn">${line(TALENT_LINE[p.key])}${cur === j ? '<i class="c7-tck">✓</i>' : ''}</span> <small>${p.name}</small></button>`)).join('');
    return `<div class="c7-tier${locked ? ' locked' : ''}${pending ? ' pending' : ''}" data-tier="${i}"><span class="c7-tl"><b>Lv ${t.lv}</b><small>${t.theme}${pending ? ' · 고르기' : ''}</small></span><span class="c7-tnodes">${nodes}</span></div>`;
  }).join('');
  return `<div class="c7-tsum"><p><span>${head}</span><small>언제든 무료로 바꿈 · 직업마다 따로 저장</small></p><span class="c7-pres" role="group" aria-label="프리셋">${presets}</span></div>
    <section class="c7-tiers" aria-label="특성 나무">${rows}<svg class="c7-tpath" aria-hidden="true"></svg></section>`;
}

/**
 * 고른 길 (시안: 고른 메달끼리 금빛 선, 고른 단 다음의 고를 단 메달 3개엔 점선). 메달 자리는 화면 폭·글자 줄바꿈에 따라
 * 바뀌어서 그린 뒤에 재서 그림. 나무판 크기가 바뀌면(글꼴이 늦게 와서 줄이 바뀌는 등) 다시 그림
 */
function drawTree(): void {
  const box = s.el.querySelector<HTMLElement>('.c7-tiers'), svg = box?.querySelector<SVGSVGElement>('.c7-tpath');
  if (!box || !svg) return;
  const r0 = box.getBoundingClientRect();
  const at = (i: number, j: number) => {
    const el = box.querySelector(`[data-tcell="${i}:${j}"] .c7-tn`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return `${Math.round(r.left - r0.left + r.width / 2)} ${Math.round(r.top - r0.top + r.height / 2)}`;
  };
  const mine = heroSave('priest').talents || [], lv = healerLevel();
  let solid = '', dash = '';
  TALENTS.forEach((t, i) => {
    const nt = TALENTS[i + 1], a = mine[i] != null && t.lv <= lv ? at(i, mine[i]!) : null;
    if (!a || !nt || nt.lv > lv) return;
    if (mine[i + 1] != null) { const b = at(i + 1, mine[i + 1]!); if (b) solid += `M${a}L${b}`; }
    else for (let j = 0; j < 3; j++) { const b = at(i + 1, j); if (b) dash += `M${a}L${b}`; }
  });
  svg.setAttribute('viewBox', `0 0 ${Math.round(r0.width)} ${Math.round(r0.height)}`);
  svg.innerHTML = `${solid ? `<path class="s" d="${solid}"/>` : ''}${dash ? `<path class="d" d="${dash}"/>` : ''}`;
}
const treeWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(() => drawTree()) : null;
function watchTree(): void {
  drawTree();
  treeWatch?.disconnect();
  const box = s.el.querySelector('.c7-tiers');
  if (box) treeWatch?.observe(box);
}

/** 특성 설명 시트 (탭 막대 위, 어둡게 하지 않음). 고른 특성이면 「풀기」 = pickTalent 다시 누름과 같음 */
function talentSheet(i: number, j: number): string {
  const t = TALENTS[i], p = t?.picks[j];
  if (!p || hero() !== 'priest' || t.lv > healerLevel()) return '';
  const cur = (heroSave('priest').talents || [])[i] ?? null;
  return `<section class="sheet c7-tsheet" role="dialog" aria-label="특성 설명">
      <span class="c7-tsi">${line(TALENT_LINE[p.key])}</span>
      <span class="c7-tst"><span class="c7-tsh"><b>${p.name}</b><span class="cap">Lv ${t.lv} · ${t.theme}${p.active ? ' · 보조 버튼' : ''}</span></span>
        <span class="c7-tsd">${esc(healText(p.desc, statParts().int.total))}</span>${p.active ? '<span class="cap">보조 버튼 특성은 전투 화면 단축칸 위에 버튼으로 나옴</span>' : ''}</span>
      <button type="button" class="c7-cta c7-tgo" data-talent="${i}:${j}">${cur === j ? '풀기' : '고르기'}</button></section>`;
}

// ---------- 직업 (27 4-6, 시안 CharClass31): 금빛 막대에 걸린 천 깃발 · 곧 열림 · 양피지 상세 · 바꾸기 ----------
/** 스킬 목록을 펼친 직업 */
let hskOpen: HeroKey | null = null;
/** 고른 깃발 (null = 지금 직업) */
let hsel: HeroKey | null = null;
/** 업데이트 직업 이름 → 문장 키 (art.ts EMBLEM) */
const UPDATE_EMBLEM: Record<string, string> = { '주술사': 'shaman', '수도사': 'monk', '점성술사': 'astrologer', '결계사': 'warder' };
/** 깃발 천 색 (사제 남색 · 드루이드 초록 · 성기사 진홍) */
const CLOTH: Record<HeroKey, string> = {
  priest: 'linear-gradient(#2E3A5C, #1C2338)',
  druid: 'linear-gradient(#2F5236, #1A2E1E)',
  paladin: 'linear-gradient(#6A2A1E, #3A1410)',
};

/** 깃발 꼬리표: 지금·열린 직업은 그 직업 레벨 (34 3-1: 직업 레벨은 직업 목록에만), 잠긴 직업은 해금 레벨 */
function heroBanner(k: HeroKey, pick: HeroKey): string {
  const h = HEROES[k], st = heroStatus(k), lv = heroLevelOf(G.save, k);
  const cs = st.state === 'now' ? `<span class="c7-cs now">지금 Lv ${lv}</span>`
    : st.state === 'locked' ? `<span class="c7-cs">Lv ${h.unlock.lv} 해금</span>`
    : st.state === 'quest' && st.need ? `<span class="c7-cs">퀘스트 ${st.quest}/${st.need}</span>`
    : `<span class="c7-cs">Lv ${lv}</span>`;
  const word = st.state === 'now' ? `지금 직업 · Lv ${lv}` : st.state === 'locked' ? `Lv ${h.unlock.lv}에 열림` : st.state === 'quest' ? `직업 퀘스트 ${st.quest}/${st.need}` : `Lv ${lv}`;
  return `<button type="button" class="c7-hc c7-bnr${st.state === 'now' ? ' now' : ''}${st.state === 'locked' ? ' locked' : ''}${k === pick ? ' sel' : ''}" data-hcard="${k}" aria-pressed="${k === pick}" aria-label="${h.name} · 난이도 ${h.star} · ${word}" style="--c:${CLOTH[k]}">
      <span class="c7-rod"></span><span class="c7-cloth"><span class="c7-cem">${classEmblem(k, 'lg')}</span><b>${h.name}</b><span class="c7-stars">${stars(h.star)}</span>${cs}</span>${st.state === 'locked' ? `<span class="c7-lkic">${uiIcon('lock')}</span>` : ''}</button>`;
}

/** 고른 직업 상세 = 양피지 (이름 · 별 · 한 줄 설명 · 해제 · 고유 · 스킬/패시브 · 직업 퀘스트) + 아래 진홍 버튼 */
function heroDetail(k: HeroKey): string {
  const h = HEROES[k], st = heroStatus(k), open = switchOpen(), q = h.unlock.quest, hs = heroSave(k);
  const chips = h.dispel.map(t => `<span class="dsp" style="--c:${DEB_COLOR[t]}">${t}</span>`).join('');
  // 스킬 = 휠 스킬 수 (사제 성언 둘은 휠 조각이 바뀌는 것이라 빼고 셈), 패시브 = 고유 시스템 포함 (스킬 탭 「패시브 N」과 같은 수)
  const pas = passivesOf(k), nSk = heroSkills(k).filter(x => x !== 'serenity' && x !== 'sanctify').length;
  const ex = hskOpen === k;
  const list = ex ? `<ul class="c7-pas">${heroSkills(k).map(sk => `<li><b>${SKILLS[sk].name}</b><span class="cap">${SKILL_INFO[sk].kind} · Lv ${SKILL_LEVEL[sk]}</span><p>${esc(healText(SKILL_INFO[sk].desc))}</p></li>`).join('')}${pas.map(p => `<li><b>${p.name}</b><span class="cap">${p.kind} · Lv ${p.lv}</span><p>${esc(p.desc)}</p></li>`).join('')}</ul>` : '';
  const quest = q && st.need && st.state !== 'open' && !hs.unlocked ? `<div class="c7-hq hq"><p><b>직업 퀘스트 「${q.name}」</b><br>${esc(q.text)}</p><strong>${st.quest} / ${st.need}</strong></div>` : '';
  const notes = [
    st.state === 'now' ? `직업 레벨 Lv ${heroLevelOf(G.save, k)} · 이 직업으로 이긴 판 ${fmt(hs.wins)}` : '',
    st.state === 'locked' ? `${LOCK}${esc(h.unlock.how)}` : '',
    st.dev ? `Lv ${h.unlock.lv} 해금, 개발 빌드라 열림` : '',
  ].filter(Boolean).map(t => `<p class="m">${t}</p>`).join('');
  const intro = open.ok ? '' : `<p class="m c7-intro">직업 바꾸기 ${LOCK}${esc(open.why)} (Lv ${HERO_SWITCH_LV})</p>`;
  let cta = '';
  if (st.state === 'quest' || st.state === 'open') cta = `<button type="button" class="c7-hcta" data-hero="${k}"${open.ok ? '' : ' disabled'}>${h.name}${josa(h.name, '으로', '로')} ${st.state === 'quest' ? '바꾸고 퀘스트' : '바꾸기'}</button>`;
  else if (st.state === 'locked') cta = `<button type="button" class="c7-hcta" disabled>${LOCK}${esc(h.unlock.how)}</button>`;
  return `<section class="c7-hdet c7-parch" data-hdet="${k}"><h3>${h.name}<span class="c7-hst" aria-label="난이도 ${h.star}">${stars(h.star)}</span></h3>
      <p>${esc(h.line)}</p>
      <div class="c7-hchips"><span>해제</span>${chips}<span class="c7-sys">고유 「${h.system.name}」 Lv ${h.system.lv}</span></div>
      <p class="m c7-hm"><button type="button" class="c7-hsk" data-hsk="${k}" aria-expanded="${ex}">스킬 ${nSk} · 패시브 ${pas.length} ${ex ? '▴' : '▾'}</button><span>장비·골드는 같이 씀, 레벨은 직업마다</span></p>
      ${list}${quest}${notes}${intro}</section>${cta}`;
}

function heroListHtml(): string {
  const pick = hsel && HERO_KEYS.includes(hsel) ? hsel : hero();
  return `<div class="c7-bnrs" role="group" aria-label="직업 고르기">${HERO_KEYS.map(k => heroBanner(k, pick)).join('')}</div>
    <div class="c7-soon" role="group" aria-label="곧 열림 · 시즌마다 1종 · 골드 60,000 또는 크리스탈 1,500"><span class="c7-soont">곧 열림</span>${UPDATE_HEROES.map(n => `<span class="c7-upc">${classEmblem(UPDATE_EMBLEM[n] || 'priest', 'md')}<small>${n}</small></span>`).join('')}</div>
    ${msg ? `<p class="note warn c7-msg">${esc(msg)}</p>` : ''}
    ${heroDetail(pick)}`;
}

// ---------- 누르기 ----------
/** 시트 닫기: 가방에서 연 장비 상세는 가방으로 돌아감, 가방을 닫으면 분해 고르기도 끝 */
function closeSheet(): void {
  if (sheet?.k === 'bag') { salv = null; salvAsk = false; }
  rrOn = false; rrAlt = null; auto = null; efx = null; clearTimeout(efxTimer);
  sheet = (sheet?.k === 'item' && sheet.back) || sheet?.k === 'codex' ? { k: 'bag' } : null;
  msg = ''; render();
}

/** 처리했으면 true (그렸음) */
function onClick(t: HTMLElement): boolean {
  // 강화 연출 중 아무 데나 누르면 연출 끝 (누른 것은 그대로 처리, 34 7-3)
  if (efx && !t.closest('[data-enh], [data-autostop]')) endFx();
  const tab = t.closest<HTMLElement>('[data-csub]');
  if (tab) { auto = null; efx = null; sub = tab.dataset.csub as Sub; sel = null; swapping = false; msg = ''; sheet = null; salv = null; salvAsk = false; skOpen = null; hskOpen = null; hsel = null; render(false); return true; }
  if (t.closest('[data-sheetx]')) { closeSheet(); return true; }

  // ---- 장비 ----
  const gi = t.closest<HTMLElement>('[data-gitem]');
  if (gi) {
    const id = Number(gi.dataset.gitem), inBag = gi.classList.contains('c7-bag');
    if (salv && inBag) {
      if (findItem(id)?.lock) msg = '잠긴 장비는 분해 안 됨';
      else { if (salv.has(id)) salv.delete(id); else salv.add(id); msg = ''; }
      salvAsk = false;
    } else { sheet = { k: 'item', id, ...(inBag ? { back: true } : {}) }; msg = ''; rrOn = false; rrAlt = null; auto = null; }
    render(); return true;
  }
  const gs = t.closest<HTMLButtonElement>('[data-gslot]');
  if (gs) {
    const best = G.save.gear.bag.filter(x => x.slot === gs.dataset.gslot).sort(SORTS.score.cmp)[0];
    if (best) { sheet = { k: 'item', id: best.id }; msg = ''; render(); }
    return true;
  }
  if (t.closest('[data-sheet="stats"]')) { sheet = { k: 'stats' }; msg = ''; render(); return true; }
  if (t.closest('[data-bag]')) { sheet = { k: 'bag' }; salv = null; salvAsk = false; msg = ''; render(); return true; }
  const sb = t.closest<HTMLButtonElement>('[data-salvbag]');
  if (sb) { if (!sb.disabled) { sheet = { k: 'bag' }; salv = new Set(); salvAsk = false; msg = ''; render(); } return true; }
  const rec = t.closest<HTMLButtonElement>('[data-rec]');
  if (rec) { if (!rec.disabled) { sheet = { k: 'rec' }; msg = ''; render(); } return true; }
  if (t.closest('[data-recgo]')) { const n = equipBest(); sheet = null; msg = n ? `추천 장착: ${n}부위 바꿈` : ''; render(); return true; }
  const lk = t.closest<HTMLElement>('[data-lock]');
  if (lk) { toggleLock(Number(lk.dataset.lock)); msg = ''; render(); return true; }
  const eq = t.closest<HTMLElement>('[data-equip]');
  if (eq) { equip(Number(eq.dataset.equip)); msg = ''; render(); return true; }
  const en = t.closest<HTMLButtonElement>('[data-enh]');
  if (en) {
    if (en.disabled) return true;
    const o = enhanceTry(Number(en.dataset.enh));
    if (typeof o === 'string') msg = o;
    else { msg = enhanceMsg(o); playFx(o, !!G.save.settings.quickEnhance || !!G.save.settings.reducedEffects); }
    render(); return true;
  }
  if (t.closest('[data-autoopen]') && sheet?.k === 'item') { const it = findItem(sheet.id); if (it) auto = { id: it.id, target: [3, 6, 9, MAX_PLUS].find(n => n > it.plus) ?? MAX_PLUS, stopDrop: true, run: false, n: 0, why: '' }; render(); return true; }
  const at = t.closest<HTMLElement>('[data-autot]');
  if (at && auto) { auto.target = Number(at.dataset.autot); auto.why = ''; render(); return true; }
  if (t.closest('[data-autox]')) { auto = null; render(); return true; }
  if (t.closest('[data-autogo]') && auto) { auto.run = true; auto.n = 0; auto.why = ''; autoStep(); return true; }
  const ad = t.closest<HTMLInputElement>('input[data-autodrop]');
  if (ad && auto) { auto.stopDrop = ad.checked; return true; }
  if (t.closest('[data-autostop]') && auto) { auto.run = false; auto.why = '멈춤'; render(); return true; }
  const s1 = t.closest<HTMLButtonElement>('[data-salv1]');
  if (s1) {
    if (s1.disabled) return true;
    const r = salvage([Number(s1.dataset.salv1)]);
    msg = r.n ? `분해: 골드 +${fmt(r.gold)} · 강화석 +${r.stone}${r.refined ? ` · 정제 강화석 +${r.refined}` : ''}` : '';
    sheet = sheet?.k === 'item' && sheet.back ? { k: 'bag' } : null; render(); return true;
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
  const cg = t.closest<HTMLElement>('[data-codexg]');
  if (cg) { codexG = cg.dataset.codexg as CodexGroup; render(); return true; }
  const bf = t.closest<HTMLElement>('[data-bfilter]');
  if (bf) { bagFilter = bf.dataset.bfilter as BagFilter; render(); return true; }
  if (t.closest('[data-bsort]')) { bagSort = SORTS[bagSort].next; render(); return true; }
  if (t.closest('[data-salvon]')) { salv = new Set(); salvAsk = false; msg = ''; render(); return true; }
  if (t.closest('[data-salvx]')) { salv = null; salvAsk = false; msg = ''; render(); return true; }
  if (t.closest('[data-salvall]') && salv) { for (const id of lowGradeIds()) salv.add(id); salvAsk = false; render(); return true; }
  const go = t.closest<HTMLButtonElement>('[data-salvgo]');
  if (go && salv) {
    if (go.disabled) return true;
    if (!salvAsk) { salvAsk = true; render(); return true; }
    const r = salvage([...salv]);
    msg = `${r.n}개 분해: 골드 +${fmt(r.gold)} · 강화석 +${r.stone}${r.refined ? ` · 정제 강화석 +${r.refined}` : ''}`;
    salv = null; salvAsk = false; render(); return true;
  }

  // ---- 특성 ----
  const tc = t.closest<HTMLElement>('[data-tcell]');
  if (tc) {
    const [i, j] = tc.dataset.tcell!.split(':').map(Number);
    sheet = sheet?.k === 'talent' && sheet.i === i && sheet.j === j ? null : { k: 'talent', i, j };
    render(); return true;
  }
  const tb = t.closest<HTMLElement>('[data-talent]');
  if (tb) {
    const [i, j] = tb.dataset.talent!.split(':').map(Number);
    if (pickTalent(i, j)) sheet = null;
    render(); return true;
  }
  const pr = t.closest<HTMLElement>('[data-preset]');
  if (pr) { setTalentPreset(Number(pr.dataset.preset)); sheet = null; render(); return true; }

  // ---- 직업 ----
  const hk = t.closest<HTMLElement>('[data-hsk]');
  if (hk) { const k = hk.dataset.hsk as HeroKey; hskOpen = hskOpen === k ? null : k; render(); return true; }
  const hb = t.closest<HTMLButtonElement>('[data-hero]');
  if (hb) {
    if (hb.disabled) return true;
    const k = hb.dataset.hero as HeroKey;
    msg = switchHero(k) ? '' : '바꿀 수 없음';
    if (!msg) { pushSettings(); sel = null; swapping = false; hskOpen = null; hsel = k; }
    render(); return true;
  }
  const hc = t.closest<HTMLElement>('[data-hcard]');
  if (hc) { const k = hc.dataset.hcard as HeroKey; if (k !== (hsel || hero())) { hsel = k; hskOpen = null; msg = ''; render(); } return true; }

  // ---- 스킬 ----
  const sm = t.closest<HTMLElement>('[data-smode]');
  if (sm) { swapping = sm.dataset.smode === 'swap'; sel = null; render(); return true; }
  if (t.closest('[data-islot]')) { sheet = { k: 'items' }; msg = ''; render(); return true; }
  const it = t.closest<HTMLElement>('[data-item]');
  if (it) { msg = toggleItem(it.dataset.item as ItemKey); render(); return true; }
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet && !s.el.hidden) closeSheet(); });
