/**
 * 캐릭터 탭 (27 4장, 시안 CharGear27 · GearSheet27 · CharSkill27 · CharTalent27 · CharClass27). 캐릭터 그림 없음.
 * 위 = 공통 머리 (직업 문장 · 이름 · Lv · 해제 · 장비 점수) + 폴더 탭 [장비][스킬][특성][직업].
 * 장비: 능력치 판 · 목록형 착용 6칸 · 추천 장착 · 세트 · 가방(필터·정렬·분해) + 아래 시트(상세·비교·강화·잠금)
 * 스킬: [설명 보기 | 배치 바꾸기] · 휠 3×3 · 고정 설명 칸 · 칸 탭 기본 힐 · 단축칸 · 스킬 줄 목록
 * 특성: 요약 · 프리셋 1·2·3 · 단마다 한 줄 · 고르기 시트 / 직업: 직업 카드 · 바꾸기 · 퀘스트 · 업데이트 직업
 */
import { enhanceCost, GRADE_STYLE, ITEM_GRADES, itemScore, itemStats, MAX_PLUS, salvageOf, SLOTS, slotName, type GearItem, type ItemGrade, type SlotKey } from '../data/equipment';
import { setCounts, SET_KEYS, SETS } from '../data/sets';
import { canDispel, DEB_COLOR, HERO_KEYS, HERO_SWITCH_LV, heroSkills, HEROES, skillAt, slotIdOf, UPDATE_HEROES, type HeroKey } from '../data/heroes';
import { ITEMS, type ItemKey } from '../data/items';
import { itemSlots, TALENT_LEVEL } from '../data/progression';
import { PASSIVE_DESC, PASSIVE_LEVEL, PASSIVE_NAME, SKILL_INFO, SKILL_LEVEL, SKILLS, type PassiveKey, type SkillKey } from '../data/skills';
import { TALENTS } from '../data/talents';
import type { TapKey } from '../platform/storage';
import { betterSlots, gearAvg, gearScore, isBetter, scoreOf, setNow, statParts, talentsLeft } from '../game/charinfo';
import {
  bestGearPlan, commit, enhance, equip, equipBest, findItem, G, healerLevel, heroSave, heroStatus, itemsNow, lowGradeIds, pickTalent, salvage,
  setTalentPreset, switchHero, switchOpen, TALENT_PRESETS, talentPreset, toggleItem, toggleLock,
} from '../game/state';
import { TUT } from '../game/tutorial';
import { classEmblem, LOCK, uiIcon } from './art';
import { battle, esc, fmt, itemChipsHtml, josa, screen, topBar } from './kit';
import { pushSettings } from './settings';

type Sub = 'gear' | 'skill' | 'talent' | 'hero';
const SUBS: { key: Sub; name: string }[] = [{ key: 'gear', name: '장비' }, { key: 'skill', name: '스킬' }, { key: 'talent', name: '특성' }, { key: 'hero', name: '직업' }];

/** 아래에서 올라오는 시트: 장비 상세 · 능력치 출처 · 추천 장착 확인 · 단축칸 고르기 · 특성 설명 */
type Sheet = { k: 'item'; id: number } | { k: 'stats' } | { k: 'rec' } | { k: 'items' } | { k: 'talent'; i: number; j: number } | null;

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
    sel = null; swapping = false; msg = ''; sheet = null; salv = null; salvAsk = false; skOpen = null; hskOpen = null; seenMarked = false;
    render(false);
  },
});

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

function render(keep = true): void {
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
  s.el.innerHTML = `${topBar({ settings: true })}${headHtml()}${tabsHtml()}
    <div class="ns-body c7-body c7-${sub}${sheet?.k === 'talent' ? ' c7-tsheet-on' : ''}">${body}</div>${sh}`;
  if (still) s.el.querySelector('.sheet')?.classList.add('still');
  if (sub === 'skill') fitDesc();
  const nb = s.el.querySelector<HTMLElement>('.ns-body');
  if (nb && top) nb.scrollTop = top;
}

// ---------- 공통 머리 (27 4-1) ----------
function headHtml(): string {
  const h = HEROES[hero()], full = sub === 'gear', score = fmt(gearScore());
  if (!full) {
    // 시안 CharSkill27·CharTalent27·CharClass27: 문장 44 · 이름 · Lv · 장비 점수 한 줄
    return `<div class="c7-head">${classEmblem(hero(), 'md')}<div class="c7-hmain"><div class="c7-hname"><b>${h.name}</b><span>Lv ${G.save.player.level}</span></div></div>
      <span class="cap c7-hscore1">장비 점수 <b>${score}</b></span></div>`;
  }
  // 해제 칩: 지울 수 있는 것 먼저, 못 지우는 유형은 .off
  const types = Object.keys(DEB_COLOR).sort((a, b) => Number(canDispel(hero(), b)) - Number(canDispel(hero(), a)));
  const chips = types.map(t => (canDispel(hero(), t) ? `<span class="dsp" style="--c:${DEB_COLOR[t]}">${t}</span>` : `<span class="dsp off">${t}</span>`)).join('');
  const avg = gearAvg(), worn = SLOTS.some(x => G.save.gear.equipped[x.key]);
  const avgTxt = avg.grade ? `<b style="color:${GRADE_STYLE[avg.grade].color}">${avg.grade}</b>${avg.plus ? ` +${avg.plus}` : ''} 평균` : worn ? '일반 미만 평균' : '장비 없음';
  return `<div class="c7-head full">${classEmblem(hero(), 'md')}
      <div class="c7-hmain"><div class="c7-hname"><b>${h.name}</b><span>Lv ${G.save.player.level}</span></div>
        <div class="c7-hdsp"><span class="cap">해제</span>${chips}</div></div>
      <div class="c7-hscore"><span class="cap">장비 점수</span><b>${score}</b><span class="cap">${avgTxt}</span></div></div>`;
}

/** 폴더 탭: 더 좋은 장비 = 장비 탭 빨간 점, 남은 특성 = 특성 탭 빨간 점 */
function tabsHtml(): string {
  const dot = (k: Sub) => ((k === 'gear' && betterSlots().length) || (k === 'talent' && talentsLeft()) ? '<span class="rdot" aria-hidden="true"></span>' : '');
  return `<nav class="subtabs" role="tablist" aria-label="캐릭터 하위 탭">${SUBS.map(x => `<button type="button" role="tab" data-csub="${x.key}" aria-selected="${x.key === sub}">${x.name}${dot(x.key)}</button>`).join('')}</nav>`;
}

function sheetHtml(): string {
  if (!sheet) return '';
  if (sheet.k === 'item') return itemSheet(sheet.id);
  if (sheet.k === 'stats') return statsSheet();
  if (sheet.k === 'rec') return recSheet();
  if (sheet.k === 'items') return sub === 'skill' ? itemsSheet() : '';
  return sub === 'talent' ? talentSheet(sheet.i, sheet.j) : '';
}

// ---------- 장비 (27 4-2 · 4-3) ----------
/** 분해 고르는 중이면 고른 id들 */
let salv: Set<number> | null = null;
/** 분해 확인 (한 번 더 누르면 분해) */
let salvAsk = false;
type BagFilter = 'all' | 'weapon' | 'armor' | 'acc' | 'set';
const FILTERS: { key: BagFilter; name: string; ok: (it: GearItem) => boolean }[] = [
  { key: 'all', name: '전체', ok: () => true },
  { key: 'weapon', name: '무기', ok: it => it.slot === 'weapon' },
  { key: 'armor', name: '방어구', ok: it => it.slot === 'head' || it.slot === 'chest' || it.slot === 'hands' },
  { key: 'acc', name: '장신구', ok: it => it.slot === 'ring' || it.slot === 'neck' },
  { key: 'set', name: '세트', ok: it => !!it.set },
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
/** 세트 이름 첫 낱말 (능력치 판 칸이 좁음): 새벽 순례자 → 새벽, 대성당의 빛 → 대성당 */
const setShort = (name: string) => name.split(' ')[0].replace(/의$/, '');

/** ① 능력치 판: 2열, 초록 = 장비 몫 (세트 포함). 누르면 출처 시트 */
function statsHtml(): string {
  const p = statParts(), set = setNow();
  const stat = (k: string, v: string, add = '') => `<span class="c7-stat"><span>${k}</span><b>${v}</b>${add ? `<em>${add}</em>` : ''}</span>`;
  const crit = Math.round(p.crit.total * 100), haste = Math.round(p.haste.total * 100), rg = p.regen.gear + p.regen.set;
  return `<button type="button" class="pn c7-stats" data-sheet="stats" aria-label="능력치 · 누르면 출처">
      <span class="h-rule">능력치<span class="rule"></span><span class="cap">초록 = 장비 몫 · 누르면 출처</span></span>
      <span class="c7-sgrid">${stat('체력', fmt(p.hp.total))}${stat('힐량', `×${p.heal.total.toFixed(2)}`, p.heal.gear >= 0.005 ? `+${p.heal.gear.toFixed(2)}` : '')}
        ${stat('치명타', `${crit}%`, crit > 5 ? `+${crit - 5}` : '')}${stat('가속', `${haste}%`, haste ? `+${haste}` : '')}
        ${stat('마나 재생', `×${p.regen.total.toFixed(2)}`, rg >= 0.005 ? `+${rg.toFixed(2)}` : '')}
        <span class="c7-stat"><span>세트</span><b class="sm${set ? '' : ' none'}">${set ? `${setShort(set.name)} ${set.n}/4` : '없음'}</b></span></span></button>`;
}

/** ② 착용 칸 = 목록형 타일 (부위 아이콘 + 등급 색 테두리 + 등급 첫 글자) */
function tileHtml(key: SlotKey, better: SlotKey[]): string {
  const it = G.save.gear.equipped[key], name = slotName(key);
  if (!it) {
    const n = G.save.gear.bag.filter(x => x.slot === key).length;
    return `<button type="button" class="gtile c7-tile empty" data-gslot="${key}"${n ? '' : ' disabled'} aria-label="${name} 빈칸${n ? ` · 가방에 ${n}개` : ''}">
        <span class="c7-sl">${uiIcon(key)}</span><span class="c7-tt"><b>${name} · 빈칸</b><span${n ? ' class="ok"' : ''}>${n ? `가방에 ${n}개 ↑` : '가방에 없음'}</span></span></button>`;
  }
  return `<button type="button" class="gtile c7-tile${it.set ? ' set' : ''}" data-gitem="${it.id}" style="${gvars(it)}" aria-label="${name} · ${esc(it.name)}${plusTxt(it)} · ${it.grade}${it.lock ? ' · 잠김' : ''}">
      <span class="c7-sl">${uiIcon(key)}<span class="c7-gl">${it.grade[0]}</span></span>
      <span class="c7-tt"><b>${it.lock ? LOCK : ''}<span>${esc(it.name)}</span>${it.plus ? `<i>+${it.plus}</i>` : ''}</b><span>${name} · 힐량 +${pc(itemStats(it).heal)}%${better.includes(key) ? ' <em>↑</em>' : ''}</span></span>
      ${it.set ? '<span class="c7-setdot" title="세트"></span>' : ''}</button>`;
}

/** ③ 세트: 진행 중인 세트마다 이름 + 칸 4개 + 2·4세트 효과 */
function setsHtml(): string {
  const n = setCounts(Object.values(G.save.gear.equipped));
  const keys = SET_KEYS.filter(k => n[k]);
  if (!keys.length) return '<p class="cap c7-noset">세트 없음 · 희귀 이상 던전 장비, 영웅 이상 레이드 장비에서 나옴</p>';
  return keys.map(k => {
    const d = SETS[k], c = n[k]!;
    return `<section class="pn c7-set" data-set="${k}">
        <div class="c7-seth"><h2 class="h-rule">${d.name}</h2><span class="c7-boxes" role="img" aria-label="${c}/4">${[0, 1, 2, 3].map(i => `<i class="${i < c ? 'on' : ''}"></i>`).join('')}</span><span class="sr">${c}/4</span>${fill}<span class="cap">${d.slots.map(slotName).join('·')}</span></div>
        <p class="${c >= 2 ? 'on' : ''}">${c >= 2 ? '✓' : '○'} 2세트 · ${esc(d.two.desc)}</p>
        <p class="${c >= 4 ? 'on' : ''}">${c >= 4 ? '✓' : '○'} 4세트 · ${esc(d.four.desc)}</p></section>`;
  }).join('');
}

/** ④ 가방 칸: 부위 아이콘 + 등급 색 + +N + ↑(지금 장비보다 좋음) + 새 점 */
function bagCell(it: GearItem): string {
  const up = isBetter(it), on = !!salv?.has(it.id), nw = isNew(it);
  const label = `${it.grade} ${slotName(it.slot)} · ${it.name}${plusTxt(it)}${up ? ' · 더 좋음' : ''}${nw ? ' · 새것' : ''}${it.lock ? ' · 잠김' : ''}`;
  return `<button type="button" class="c7-bag${on ? ' on' : ''}${it.lock ? ' lock' : ''}" data-gitem="${it.id}" style="${gvars(it)}" aria-label="${esc(label)}"${salv ? ` aria-pressed="${on}"` : ''}>${uiIcon(it.slot)}${it.plus ? `<em>+${it.plus}</em>` : ''}${up ? '<span class="up">↑</span>' : ''}${nw ? '<span class="nw"></span>' : ''}${it.lock ? `<span class="lk">${uiIcon('lock')}</span>` : ''}${on ? '<span class="ck">✓</span>' : ''}</button>`;
}

function gearHtml(): string {
  const m = G.save.mats, all = G.save.gear.bag, better = betterSlots(), plan = bestGearPlan();
  const f = FILTERS.find(x => x.key === bagFilter) || FILTERS[0];
  const list = all.filter(f.ok).sort(SORTS[bagSort].cmp);
  const picked = salv ? all.filter(it => salv!.has(it.id)) : [];
  const sum = picked.reduce((a, it) => { const v = salvageOf(it); return { gold: a.gold + v.gold, stone: a.stone + v.stone, refined: a.refined + v.refined }; }, { gold: 0, stone: 0, refined: 0 });
  const salvBar = salv ? `<div class="c7-salv">
      <button class="btn2" type="button" data-salvall>일반·고급 모두</button>
      <button class="btn2 hot" type="button" data-salvgo${picked.length ? '' : ' disabled'}>${salvAsk ? '한 번 더 누르면 분해' : `${picked.length}개 분해`}</button>
      <button class="btn2" type="button" data-salvx>취소</button>
      <span class="cap">${picked.length ? `골드 ${fmt(sum.gold)} · 강화석 ${sum.stone}${sum.refined ? ` · 정제 강화석 ${sum.refined}` : ''}` : '분해할 장비 선택 · 잠긴 장비 제외'}</span></div>` : '';
  const grid = !all.length ? '<p class="cap">던전을 클리어하면 장비 1개씩 획득</p>'
    : !list.length ? '<p class="cap">이 분류 장비 없음</p>'
    : `<div class="c7-bags${salv ? ' picking' : ''}">${list.map(bagCell).join('')}</div>`;
  return `${msg && !sheet ? `<p class="note warn c7-msg">${esc(msg)}</p>` : ''}
    ${statsHtml()}
    <section class="c7-sec"><div class="c7-row"><h2 class="h-rule grow">착용<span class="rule"></span></h2><button type="button" class="btn2${plan.length ? ' hot' : ''}" data-rec${plan.length ? '' : ' disabled'}>추천 장착</button></div>
      <div class="c7-tiles">${SLOTS.map(x => tileHtml(x.key, better)).join('')}</div></section>
    ${setsHtml()}
    <section class="c7-sec c7-bagsec"><div class="c7-row"><h2 class="h-rule">가방</h2><span class="cap">${all.length}개</span>${fill}${all.length ? `<button type="button" class="btn2 c7-sort" data-bsort aria-label="정렬: ${SORTS[bagSort].name}">${SORTS[bagSort].name} ▾</button>` : ''}</div>
      ${all.length ? `<div class="c7-fcs" role="group" aria-label="가방 분류">${FILTERS.map(x => `<button type="button" class="c7-fc" data-bfilter="${x.key}" aria-pressed="${bagFilter === x.key}">${x.name}</button>`).join('')}</div>` : ''}
      ${salvBar}${grid}
      <div class="c7-bagf">${all.length && !salv ? '<button type="button" class="btn2" data-salvon>분해 고르기</button>' : ''}<span class="cap gmats">강화석 ${fmt(m.stone)} · 정제 강화석 ${fmt(m.refined)}</span></div></section>`;
}

const grip = '<span class="grip" aria-hidden="true"></span>';
const dim = '<div class="sheet-dim" data-sheetx></div>';
const updn = (v: number, unit = '') => (v > 0 ? `<span class="c7-up">▲${v}${unit}</span>` : v < 0 ? `<span class="c7-dn">▼${-v}${unit}</span>` : '<span class="cap">같음</span>');

/** 장비 상세 시트 (27 4-3, 시안 GearSheet27): 지금 장비와 비교 ▲▼ · 강화 · 잠금 · 분해 · 장착(착용 중이면 강화) */
function itemSheet(id: number): string {
  const it = findItem(id);
  if (!it) return '';
  const eq = G.save.gear.equipped, worn = eq[it.slot]?.id === it.id, cur = worn ? null : eq[it.slot] ?? null;
  const sc = scoreOf(it), a = itemStats(it), b = itemStats(cur);
  const sub2 = [slotName(it.slot), it.grade, worn ? '착용 중' : isNew(it) ? '새로 얻음' : '', it.lock ? '잠김' : ''].filter(Boolean).join(' · ');
  // 비교 줄: 퍼센트 포인트 (소수 한 자리)
  const d1 = (x: number, y: number) => Math.round((x - y) * 1000) / 10;
  const row = (k: string, v: string, diff: string) => `<div class="c7-cmp"><span>${k}</span><b>${v}</b>${diff}</div>`;
  const n = setCounts(Object.values(eq));
  let setTxt = '없음', setDiff = '';
  if (it.set) {
    const c = n[it.set] || 0, name = SETS[it.set].name;
    setTxt = worn ? `${name} (착용 ${c}/4)` : cur?.set === it.set ? `${name} (착용 ${c}/4 그대로)` : `${name} (착용 ${c}/4 → ${c + 1}/4)`;
    if (!worn && cur?.set !== it.set) setDiff = '<span class="c7-up">▲</span>';
  } else if (cur?.set) {
    const c = n[cur.set] || 0;
    setTxt = `없음 (${SETS[cur.set].name} ${c}/4 → ${c - 1}/4)`;
    setDiff = '<span class="c7-dn">▼</span>';
  }
  const rows = worn
    ? row('힐량', `+${pc(a.heal)}%`, '') + row('치명타', `+${pc(a.crit)}%`, '') + row('가속', `+${pc(a.haste)}%`, '') + row('세트', setTxt, '')
    : row('힐량', `+${pc(a.heal)}%`, updn(d1(a.heal, b.heal))) + row('치명타', `+${pc(a.crit)}%`, updn(d1(a.crit, b.crit))) + row('가속', `+${pc(a.haste)}%`, updn(d1(a.haste, b.haste))) + row('세트', setTxt, setDiff);
  const c = enhanceCost(it), m = G.save.mats, gold = G.save.player.gold;
  const can = !!c && gold >= c.gold && m.stone >= c.stone && m.refined >= c.refined;
  const lack = c && !can ? (gold < c.gold ? '골드 부족' : m.stone < c.stone ? '강화석 부족' : '정제 강화석 부족') : '';
  const costTxt = c ? [`골드 ${fmt(c.gold)}`, c.stone ? `강화석 ${c.stone} (가진 것 ${fmt(m.stone)})` : '', c.refined ? `정제 강화석 ${c.refined} (가진 것 ${fmt(m.refined)})` : ''].filter(Boolean).join(' · ') : '더 올릴 수 없음';
  const sv = salvageOf(it);
  const cmpCap = worn ? '착용 중' : cur ? `${esc(cur.name)}${plusTxt(cur)}` : '빈칸';
  return `${dim}<section class="sheet c7-gsheet" role="dialog" aria-label="장비 상세" style="${gvars(it)}">${grip}
      <div class="c7-ghead"><span class="c7-gic">${uiIcon(it.slot)}<span class="c7-gl">${it.grade[0]}</span></span>
        <span class="c7-gname"><b>${esc(it.name)}${it.plus ? ` <i>+${it.plus}</i>` : ''}</b><span class="cap">${sub2}</span></span>
        <span class="c7-gscore"><span class="cap">점수</span><b>${sc}</b>${worn ? '' : updn(sc - scoreOf(cur))}</span></div>
      <div class="c7-cmpw"><h3 class="h-rule c7-h3">${worn ? '능력치' : '지금 장비와 비교'}<span class="rule"></span><span class="cap">${cmpCap}</span></h3>${rows}</div>
      <div class="c7-enh"><span><b>${c ? `강화 +${it.plus} → +${c.to}` : `최대 강화 +${MAX_PLUS}`}</b><span class="cap">${costTxt}</span></span><span class="cap${lack ? ' c7-lack' : ''}">${worn ? lack : c ? '장착 뒤 강화 추천' : ''}</span></div>
      ${msg ? `<p class="note warn c7-msg">${esc(msg)}</p>` : ''}
      <div class="c7-sbtns">
        <button type="button" class="c7-sb c7-lockb" data-lock="${it.id}" aria-pressed="${!!it.lock}">${uiIcon('lock')}<small>${it.lock ? '잠김' : '잠금'}</small></button>
        <button type="button" class="c7-sb c7-salvb" data-salv1="${it.id}"${worn || it.lock ? ' disabled' : ''}>분해<small>${worn ? '착용 중' : it.lock ? '잠김' : `강화석 +${sv.stone}`}</small></button>
        ${worn ? `<button type="button" class="c7-cta" data-enh="${it.id}"${can ? '' : ' disabled'}>${c ? '강화' : '최대 강화'}</button>` : `<button type="button" class="c7-cta" data-equip="${it.id}">장착</button>`}
      </div></section>`;
}

/** 능력치 출처 시트: 기본 · 레벨 · 장비 · 세트 · 특성 몫 */
function statsSheet(): string {
  const p = statParts(), crit = Math.round(p.crit.total * 100), haste = Math.round(p.haste.total * 100);
  const row = (k: string, v: string, parts: string[]) => `<div class="c7-src"><span>${k}</span><b>${v}</b><span class="cap">${parts.filter(Boolean).join(' · ')}</span></div>`;
  return `${dim}<section class="sheet c7-ssheet" role="dialog" aria-label="능력치 출처">${grip}
      <h3 class="h-rule">능력치 출처<span class="rule"></span><span class="cap">레벨 · 장비 · 세트 · 특성</span></h3>
      <div class="c7-srcs">
        ${row('체력', fmt(p.hp.total), [`기본 ${fmt(p.hp.base)}`, `레벨 +${fmt(p.hp.level)}`, '장비 0'])}
        ${row('힐량', `×${p.heal.total.toFixed(2)}`, ['기본 ×1.00', `레벨 +${p.heal.level.toFixed(2)}`, `장비 +${p.heal.gear.toFixed(2)}`])}
        ${row('치명타', `${crit}%`, ['기본 5%', `장비 +${crit - 5}%`])}
        ${row('가속', `${haste}%`, [`장비 +${haste}%`])}
        ${row('마나 재생', `×${p.regen.total.toFixed(2)}`, ['기본 ×1.00', `장비 +${p.regen.gear.toFixed(2)}`, `세트 +${p.regen.set.toFixed(2)}`])}
        ${row('특성', '0', ['상시 능력치 몫 없음'])}
      </div>
      <p class="note">레벨 배율 ×${p.lp.toFixed(2)} (Lv ${G.save.player.level}). 체력은 장비로 오르지 않습니다. 고른 특성은 전투 중 조건이 맞으면 켜집니다.</p>
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

// ---------- 스킬 (27 4-4, 시안 CharSkill27) ----------
const lockLv = (k: SkillKey) => (SKILL_LEVEL[k] > healerLevel() ? SKILL_LEVEL[k] : 0);
/** 펼친 줄 (스킬 키 · words · pas) */
let skOpen: string | null = null;

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

function wheelCell(d: string | null, lay: Record<string, string | null>): string {
  const L = battle().layout;
  if (!d) return '<span class="c7-wh core" aria-hidden="true"><b>100</b><span>마나</span></span>';
  const k = skillOfDir(lay, d), lock = k ? lockLv(k) : 0, on = sel === d;
  if (!k) return `<button type="button" class="lslot c7-wh empty" data-ldir="${d}" aria-pressed="${on}" aria-label="${L.ARROW[d]} 비어 있음"><i>비어 있음</i></button>`;
  const tiny = lock ? `${LOCK}Lv ${lock}` : costTiny(k);
  return `<button type="button" class="lslot c7-wh${lock ? ' locked' : ''}" data-ldir="${d}" aria-pressed="${on}" aria-label="${L.ARROW[d]} ${SKILLS[k].name}${lock ? ` · Lv ${lock}에 배움` : ''}"><i>${L.ARROW[d]}</i><b>${SKILLS[k].short}</b>${tiny ? `<span>${tiny}</span>` : ''}</button>`;
}

/** 휠 아래 설명 칸 (높이 고정): 보기 = 고른 칸 설명, 바꾸기 = 안내 + 기본 배치로 */
function descBox(lay: Record<string, string | null>): string {
  const L = battle().layout, h = hero();
  if (swapping) {
    const changed = JSON.stringify(L.READ_ORDER.map(d => lay[d] || null)) !== JSON.stringify(L.READ_ORDER.map(d => L.DEFAULT_LAYOUT[d] || null));
    const k = sel ? skillOfDir(lay, sel) : null, w = sel ? (k ? SKILLS[k].name : '빈자리') : '';
    return `<section class="pn gold c7-sdesc swap" aria-live="polite"><div class="c7-sdh"><b>배치 바꾸기</b><span class="cap">${sel ? `${L.ARROW[sel]} ${esc(w)}${josa(w, '과', '와')} 바꿀 자리 선택` : '두 자리를 차례로 누르면 서로 바뀜'}</span></div>
        <span class="c7-sdt">빈자리와도 바꿀 수 있습니다.</span>
        <div class="c7-sdb"><button class="btn2" type="button" id="layReset"${changed ? '' : ' disabled'}>기본 배치로</button></div></section>`;
  }
  const k = sel ? skillOfDir(lay, sel) : null;
  if (!sel) return `<section class="pn gold c7-sdesc" aria-live="polite"><div class="c7-sdh"><b>스킬 휠</b><span class="cap">칸을 누르면 설명</span></div>
      <span class="c7-sdt">전투에서 칸을 그 방향으로 쓸면 그 스킬을 씁니다. 칸을 탭하면 칸 탭 기본 힐을 씁니다.</span></section>`;
  if (!k) return `<section class="pn gold c7-sdesc" aria-live="polite"><div class="c7-sdh"><b>비어 있음</b><span class="cap">휠 ${L.ARROW[sel]}</span></div>
      <span class="c7-sdt">특성 스킬 자리 (P2). 배치 바꾸기로 다른 스킬과 바꿀 수 있습니다.</span></section>`;
  const lock = lockLv(k), sk = SKILLS[k];
  const tags = [SKILL_INFO[k].kind, `휠 ${L.ARROW[sel]}`, skillAt(h, G.save.settings.tapKey) === k ? '칸 탭' : '', lock ? `Lv ${lock}에 배움` : ''].filter(Boolean).join(' · ');
  return `<section class="pn gold c7-sdesc wdet" aria-live="polite"><div class="c7-sdh"><b>${sk.name}</b><span class="cap">${tags}</span></div>
      <span class="c7-sdm">${castShort(k)} · ${costShort(k)} · ${sk.cd ? `재사용 ${sk.cd}초` : '재사용 없음'}</span>
      <span class="c7-sdt">${esc(SKILL_INFO[k].desc)}</span></section>`;
}

let measure: CanvasRenderingContext2D | null = null;
/**
 * 설명 칸 높이 고정 (27 4-4: 눌러도 아래가 흔들리지 않게). 이 직업 휠 스킬 설명 중 가장 긴 것이 들어가는 높이.
 * 두 줄 = 시안 112px, 한 줄 늘 때마다 20px. 폭은 기기마다 달라서 글자 폭을 재서 줄 수를 셈
 */
function fitDesc(): void {
  const box = s.el.querySelector<HTMLElement>('.c7-sdesc'), txt = box?.querySelector<HTMLElement>('.c7-sdt');
  if (!box || !txt) return;
  const w = txt.clientWidth;
  measure ||= document.createElement('canvas').getContext('2d');
  if (!measure || w <= 0) return;
  const cs = getComputedStyle(txt);
  measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  // 낱말 단위로 줄이 바뀌어(keep-all) 끝에 남는 자리만큼 넉넉히 1.1배
  const lines = Math.max(2, ...heroSkills(hero()).filter(k => k !== 'serenity' && k !== 'sanctify').map(k => Math.ceil((measure!.measureText(SKILL_INFO[k].desc).width * 1.1) / w)));
  box.style.height = `${112 + (lines - 2) * 20}px`;
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
        <span class="c7-ski">${sk.short}</span><span class="c7-skn"><b>${sk.name}</b><span>${lock ? `${LOCK}Lv ${lock}에 배움 · ` : ''}${meta}</span></span><span class="c7-dir">${d ? L.ARROW[d] : ''}</span></button>
      ${open ? `<p class="c7-skd">${esc(SKILL_INFO[k].desc)}</p>` : ''}`;
  });
  if (h === 'priest') {
    const lock = lv < PASSIVE_LEVEL.words ? PASSIVE_LEVEL.words : 0, open = skOpen === 'words';
    rows.push(`<button type="button" class="c7-sk holy${lock ? ' locked' : ''}" data-skrow="words" aria-expanded="${open}"><span class="c7-ski">평온</span><span class="c7-skn"><b>${SKILLS.serenity.name} · ${SKILLS.sanctify.name}</b><span>${lock ? `${LOCK}Lv ${lock}에 배움 · ` : ''}게이지 100%에서 휠 조각이 바뀜 · 마나 0</span></span><span class="c7-dir"></span></button>
      ${open ? `<p class="c7-skd"><b>${SKILLS.serenity.name}</b> ${esc(SKILL_INFO.serenity.desc)}<br><b>${SKILLS.sanctify.name}</b> ${esc(SKILL_INFO.sanctify.desc)}</p>` : ''}`);
  }
  const pas = passivesOf(h), open = skOpen === 'pas';
  rows.push(`<button type="button" class="c7-sk pas" data-skrow="pas" aria-expanded="${open}"><span class="c7-ski">패시</span><span class="c7-skn"><b>패시브 ${pas.length}</b><span>${pas.map(p => p.name).join(' · ')}</span></span><span class="c7-dir">${open ? '▴' : '▾'}</span></button>
    ${open ? `<ul class="c7-pas">${pas.map(p => `<li class="${p.lv > lv ? 'locked' : ''}"><b>${p.name}</b><span class="cap">${p.kind} · ${p.lv > lv ? `${LOCK}Lv ${p.lv}에 배움` : `Lv ${p.lv}`}</span><p>${esc(p.desc)}</p></li>`).join('')}</ul>` : ''}`);
  return rows.join('');
}

function skillHtml(): string {
  const st = G.save.settings, L = battle().layout, lay = layoutNow(), h = hero();
  const tapSkill = skillAt(h, st.tapKey) || skillAt(h, 'heal')!, basic = skillAt(h, 'heal')!;
  const tapLock = lockLv(tapSkill);
  const { slots, items } = itemsNow();
  const nextSlotLv = [20, 40].find(x => itemSlots(x) > slots);
  const stock = G.save.tut >= TUT.done ? G.save.bag : null;
  const taps = (Object.keys(battle().tapKeys) as TapKey[]).map(t => {
    const k = skillAt(h, t)!, lk = lockLv(k);
    return `<button type="button" data-tap="${t}" aria-pressed="${st.tapKey === t}"${lk ? ` disabled title="Lv ${lk}에 배움"` : ''}>${lk ? LOCK : ''}${SKILLS[k].name}</button>`;
  }).join('');
  const cells = Array.from({ length: slots }, (_, i) => {
    const k = items[i];
    if (!k) return `<button type="button" class="c7-item empty" data-islot="${i}">빈 칸 +</button>`;
    const n = stock ? stock[k] || 0 : null;
    return `<button type="button" class="c7-item" data-islot="${i}" aria-label="${ITEMS[k].name}${n != null ? ` ${n}개` : ''} · 바꾸기">${battle().itemIcon(k)}<span>${ITEMS[k].short}${n != null ? ` ×${n}` : ''}</span></button>`;
  }).join('');
  return `<div class="seg c7-mode" role="group" aria-label="휠 보기 방식"><button type="button" data-smode="view" aria-pressed="${!swapping}">설명 보기</button><button type="button" data-smode="swap" aria-pressed="${swapping}">배치 바꾸기</button></div>
    <div class="c7-wheel${swapping ? ' swapping' : ''}">${L.GRID.map(d => wheelCell(d, lay)).join('')}</div>
    ${descBox(lay)}
    <section class="c7-sec"><h2 class="h-rule">칸 탭 기본 힐<span class="rule"></span></h2><div class="seg c7-taps" role="group" aria-label="칸 탭 기본 힐">${taps}</div>
      ${tapLock ? `<p class="note">Lv ${tapLock} 전까진 ${SKILLS[basic].name}${josa(SKILLS[basic].name, '으로', '로')} 탭</p>` : ''}</section>
    <section class="c7-sec"><h2 class="h-rule">단축칸<span class="rule"></span><span class="cap">${slots}칸 · 편성과 같음${nextSlotLv ? ` · Lv ${nextSlotLv}에 ${itemSlots(nextSlotLv)}칸` : ''}</span></h2>
      <div class="c7-items" style="--n:${Math.max(slots, 2)}">${cells}</div></section>
    <section class="pn c7-sklist">${skillRows(lay)}</section>`;
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

// ---------- 특성 (27 4-5, 시안 CharTalent27): 단마다 한 줄, 프리셋 3벌, 칸을 누르면 아래 시트 ----------
function talentHtml(): string {
  const lv = healerLevel(), h = hero();
  // 직업마다 특성 트리가 따로 (25 6장). 지금 만든 건 사제 트리뿐
  if (h !== 'priest') return `<section class="pn c7-tprep"><h2 class="h-rule">특성<span class="rule"></span><span class="cap">${HEROES[h].name}</span></h2>
      <p class="note">${HEROES[h].name} 특성 트리는 준비 중. 사제 특성을 먼저 만든 뒤 같은 틀로 추가</p></section>`;
  const mine = heroSave('priest').talents || [], pre = talentPreset('priest');
  const open = TALENTS.filter(t => t.lv <= lv).length;
  const picked = TALENTS.filter((t, i) => t.lv <= lv && mine[i] != null).length;
  const left = open - picked;
  const head = open ? `${open}단 열림 · ${picked}개 고름 · ${left ? `<b>${left}개 남음</b>` : '남은 단 없음'}` : `${LOCK}Lv ${TALENT_LEVEL}에 열림 (지금 Lv ${lv})`;
  const presets = Array.from({ length: TALENT_PRESETS }, (_, i) => `<button type="button" class="c7-pre" data-preset="${i}" aria-pressed="${pre === i}" aria-label="프리셋 ${i + 1}">${i + 1}</button>`).join('');
  const focus = sheet?.k === 'talent' ? sheet : null;
  const rows = TALENTS.map((t, i) => {
    const locked = t.lv > lv, cur = mine[i] ?? null, pending = !locked && cur == null;
    const body = locked ? `<span class="c7-tlock">${LOCK}${t.picks.map(p => p.name).join(' · ')}</span>`
      : `<span class="c7-tpicks">${t.picks.map((p, j) => `<button type="button" class="c7-pk${focus && focus.i === i && focus.j === j ? ' focus' : ''}" data-tcell="${i}:${j}" aria-pressed="${cur === j}">${cur === j ? '✓ ' : ''}${p.name}</button>`).join('')}</span>`;
    return `<div class="c7-tier${locked ? ' locked' : ''}${pending ? ' pending' : ''}" data-tier="${i}"><span class="c7-tl"><b>Lv ${t.lv}</b><span>${t.theme}</span></span>${body}</div>`;
  }).join('');
  return `<div class="c7-tsum"><span>${head}</span><span class="cap">프리셋</span>${presets}</div>
    <span class="cap c7-tnote">언제든 무료로 바꿈 · 직업마다 따로 저장</span>
    <section class="pn c7-tiers">${rows}</section>`;
}

/** 특성 설명 시트 (탭 막대 위, 어둡게 하지 않음). 고른 특성이면 「풀기」 = pickTalent 다시 누름과 같음 */
function talentSheet(i: number, j: number): string {
  const t = TALENTS[i], p = t?.picks[j];
  if (!p || hero() !== 'priest' || t.lv > healerLevel()) return '';
  const cur = (heroSave('priest').talents || [])[i] ?? null;
  return `<section class="sheet c7-tsheet" role="dialog" aria-label="특성 설명">
      <span class="c7-tst"><span class="c7-tsh"><b>${p.name}</b><span class="cap">Lv ${t.lv} · ${t.theme}${p.active ? ' · 보조 버튼' : ''}</span></span>
        <span class="c7-tsd">${esc(p.desc)}</span>${p.active ? '<span class="cap">보조 버튼 특성은 전투 화면 단축칸 위에 버튼으로 나옴</span>' : ''}</span>
      <button type="button" class="c7-cta c7-tgo" data-talent="${i}:${j}">${cur === j ? '풀기' : '고르기'}</button></section>`;
}

// ---------- 직업 (27 4-6, 시안 CharClass27): 카드마다 문장·해제·고유 시스템·스킬 접기, 해금 상태와 바꾸기 ----------
/** 스킬 목록을 펼친 직업 카드 */
let hskOpen: HeroKey | null = null;
/** 업데이트 직업 이름 → 문장 키 (art.ts EMBLEM) */
const UPDATE_EMBLEM: Record<string, string> = { '주술사': 'shaman', '수도사': 'monk', '점성술사': 'astrologer', '결계사': 'warder' };

function heroCard(k: HeroKey): string {
  const h = HEROES[k], st = heroStatus(k), open = switchOpen(), q = h.unlock.quest, hs = heroSave(k);
  const chips = h.dispel.map(t => `<span class="dsp" style="--c:${DEB_COLOR[t]}">${t}</span>`).join('');
  // 스킬 = 휠 스킬 수 (사제 성언 둘은 휠 조각이 바뀌는 것이라 빼고 셈), 패시브 = 고유 시스템 포함 (스킬 탭 「패시브 N」과 같은 수)
  const pas = passivesOf(k), nSk = heroSkills(k).filter(x => x !== 'serenity' && x !== 'sanctify').length;
  const ex = hskOpen === k;
  const skBtn = `<button type="button" class="c7-hsk" data-hsk="${k}" aria-expanded="${ex}">스킬 ${nSk} · 패시브 ${pas.length} ${ex ? '▴' : '▾'}</button>`;
  const quest = q && st.need && st.state !== 'open' && !hs.unlocked ? `<div class="c7-hl hq"><span>직업 퀘스트 「${q.name}」 · ${esc(q.text)}</span><b>${st.quest} / ${st.need}</b></div>` : '';
  let foot: string;
  if (st.state === 'now') foot = `<div class="c7-hl sb"><span class="cap">이 직업으로 이긴 판 ${fmt(hs.wins)}</span>${skBtn}</div>`;
  else if (st.state === 'locked') foot = `<div class="c7-hl sb">${skBtn}<span class="cap">${LOCK}${esc(h.unlock.how)}</span></div>`;
  else foot = `<div class="c7-hl sb">${skBtn}<button type="button" class="btn2${st.state === 'open' ? ' hot' : ''}" data-hero="${k}"${open.ok ? '' : ' disabled'}>${st.state === 'quest' ? '바꾸고 퀘스트 하기' : '이 직업으로 바꾸기'}</button></div>${st.dev ? `<span class="cap">Lv ${h.unlock.lv} 해금, 개발 빌드라 열림</span>` : ''}`;
  const list = ex ? `<ul class="c7-pas">${heroSkills(k).map(sk => `<li><b>${SKILLS[sk].name}</b><span class="cap">${SKILL_INFO[sk].kind} · Lv ${SKILL_LEVEL[sk]}</span><p>${esc(SKILL_INFO[sk].desc)}</p></li>`).join('')}${pas.map(p => `<li><b>${p.name}</b><span class="cap">${p.kind} · Lv ${p.lv}</span><p>${esc(p.desc)}</p></li>`).join('')}</ul>` : '';
  return `<section class="pn c7-hc${st.state === 'now' ? ' now' : ''}${st.state === 'locked' ? ' locked' : ''}" data-hcard="${k}">
      <div class="c7-hcr">${classEmblem(k, 'lg')}<span class="c7-hcn"><span class="c7-hcl"><span class="c7-hn">${h.name}</span><span class="c7-stars" aria-label="난이도 ${h.star}">${stars(h.star)}</span>${st.state === 'now' ? `${fill}<span class="c7-now">지금 직업</span>` : ''}</span><span class="c7-hline">${esc(h.line)}</span></span></div>
      <div class="c7-hl"><span class="cap">해제</span>${chips}<span class="cap c7-sys">고유 「${h.system.name}」 Lv ${h.system.lv}</span></div>
      ${quest}${foot}${list}</section>`;
}

function heroListHtml(): string {
  const open = switchOpen();
  return `<p class="c7-intro">${open.ok ? '전투 밖에서 언제든 무료로 바꿈. 레벨·장비·골드는 같이 쓰고, 휠 배치·특성은 직업마다 따로' : `직업 바꾸기 ${LOCK}${esc(open.why)} (Lv ${HERO_SWITCH_LV})`}</p>
    ${msg ? `<p class="note warn">${esc(msg)}</p>` : ''}
    ${HERO_KEYS.map(heroCard).join('')}
    <section class="pn c7-hc c7-upd"><div class="c7-hcl"><span class="c7-hn sm">업데이트 직업</span>${fill}<span class="cap">시즌마다 1종</span></div>
      <div class="c7-up4">${UPDATE_HEROES.map(n => `<span class="c7-upc">${classEmblem(UPDATE_EMBLEM[n] || 'priest', 'md')}${n}</span>`).join('')}</div>
      <span class="cap">골드 60,000 또는 크리스탈 1,500</span></section>`;
}

// ---------- 누르기 ----------
function closeSheet(): void { sheet = null; msg = ''; render(); }

/** 처리했으면 true (그렸음) */
function onClick(t: HTMLElement): boolean {
  const tab = t.closest<HTMLElement>('[data-csub]');
  if (tab) { sub = tab.dataset.csub as Sub; sel = null; swapping = false; msg = ''; sheet = null; salv = null; salvAsk = false; skOpen = null; hskOpen = null; render(false); return true; }
  if (t.closest('[data-sheetx]')) { closeSheet(); return true; }

  // ---- 장비 ----
  const gi = t.closest<HTMLElement>('[data-gitem]');
  if (gi) {
    const id = Number(gi.dataset.gitem);
    if (salv && gi.classList.contains('c7-bag')) {
      if (findItem(id)?.lock) msg = '잠긴 장비는 분해 안 됨';
      else { if (salv.has(id)) salv.delete(id); else salv.add(id); msg = ''; }
      salvAsk = false;
    } else { sheet = { k: 'item', id }; msg = ''; }
    render(); return true;
  }
  const gs = t.closest<HTMLButtonElement>('[data-gslot]');
  if (gs) {
    const best = G.save.gear.bag.filter(x => x.slot === gs.dataset.gslot).sort(SORTS.score.cmp)[0];
    if (best) { sheet = { k: 'item', id: best.id }; msg = ''; render(); }
    return true;
  }
  if (t.closest('[data-sheet="stats"]')) { sheet = { k: 'stats' }; msg = ''; render(); return true; }
  const rec = t.closest<HTMLButtonElement>('[data-rec]');
  if (rec) { if (!rec.disabled) { sheet = { k: 'rec' }; msg = ''; render(); } return true; }
  if (t.closest('[data-recgo]')) { const n = equipBest(); sheet = null; msg = n ? `추천 장착: ${n}부위 바꿈` : ''; render(); return true; }
  const lk = t.closest<HTMLElement>('[data-lock]');
  if (lk) { toggleLock(Number(lk.dataset.lock)); msg = ''; render(); return true; }
  const eq = t.closest<HTMLElement>('[data-equip]');
  if (eq) { equip(Number(eq.dataset.equip)); msg = ''; render(); return true; }
  const en = t.closest<HTMLButtonElement>('[data-enh]');
  if (en) { if (!en.disabled) { msg = enhance(Number(en.dataset.enh)); render(); } return true; }
  const s1 = t.closest<HTMLButtonElement>('[data-salv1]');
  if (s1) {
    if (s1.disabled) return true;
    const r = salvage([Number(s1.dataset.salv1)]);
    msg = r.n ? `분해: 골드 +${fmt(r.gold)} · 강화석 +${r.stone}${r.refined ? ` · 정제 강화석 +${r.refined}` : ''}` : '';
    sheet = null; render(); return true;
  }
  const bf = t.closest<HTMLElement>('[data-bfilter]');
  if (bf) { bagFilter = bf.dataset.bfilter as BagFilter; render(); return true; }
  if (t.closest('[data-bsort]')) { bagSort = SORTS[bagSort].next; render(); return true; }
  if (t.closest('[data-salvon]')) { salv = new Set(); salvAsk = false; sheet = null; msg = ''; render(); return true; }
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
    msg = switchHero(hb.dataset.hero as HeroKey) ? '' : '바꿀 수 없음';
    if (!msg) { pushSettings(); sel = null; swapping = false; hskOpen = null; }
    render(); return true;
  }

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
