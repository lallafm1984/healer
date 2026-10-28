import { buildClassGauge, updateClassGauge } from './class-gauge';
import { classGaugeState } from './class-gauge-state';
import { talentCd, waveNeed } from '../engine/talents';
import { chalTime } from '../engine/affixes';
/**
 * 전투 화면의 HTML 부분: 스킬 휠 · 특성 버튼 · 시전 막대 · 보스 무대(예고 대기열) · 설명 팝업 · 길게 누르기 정보 · 튜토리얼 안내 · 포기 버튼.
 * 매 프레임 바뀐 글자·클래스만 고침 (판은 board.ts가 캔버스에).
 */
import { ABILITIES } from '../data/abilities';
import { NO_TANK_SEC } from '../data/armor';
import { CLASSES } from '../data/classes';
import { CONSTELLATION, starMax, starsNow } from '../engine/astro';
import { judgeReady } from '../engine/warder';
import { dispellable, HEROES } from '../data/heroes';
import { contentOf, type ContentKey } from '../data/content';
import { mobGrade } from '../data/encounters';
import { INT_BASE } from '../data/rules';
import { healText, SKILL_LEVEL, SKILLS, type SkillKey } from '../data/skills';
import { skillTip, tipHtml } from '../game/tooltip';
import { TALENT_DEF, type TalentKey } from '../data/talents';
import { activeOn, beaconShare, bossTaken, cdMax, costOf, knows, queue, skillUsesSpent, slotKey, talentSlots, talentUsesSpent, telDmg, type Fight, type Mob, type Unit } from '../engine';
import { art, cssUrl } from '../art';
import { encArt, mobLook, skillMark } from './art';
import { L, screenCenter } from './board';
import { $, alarm, arrowOf, B, DIR_VEC, DIRS, mmss, ROLE, S, Snd, tapKey, toast, ui, vibe, type Dir } from './core';
import { guideModel, iconColor } from './guide';
import { manaMeter } from './mana-meter';
import { debuffBrief, shieldTimerOf } from './party-display';
import { fightSkillArt, skillArtImg } from './skillArt';

const fight = () => B.F!;
const setText = (el: Element, t: string) => { if (el.textContent !== t) el.textContent = t; };

/** 오른쪽 벽 전광판의 세로 중심을 적 기술 예고 줄의 하단 테두리에 맞춘다. */
export function placeGiveUp(): void {
  const button = $('giveUp');
  if (button.hidden) return;
  const stage = $('stage').getBoundingClientRect(), queue = $('queue').getBoundingClientRect();
  const width = 90, height = 56;
  const top = queue.bottom - stage.top - height / 2;
  Object.assign(button.style, { width: `${width}px`, height: `${height}px`, top: `${top}px` });
}

/** 지금 판의 공략 (단계 레벨까지 반영한 숫자) */
export const guideOf = (F: Fight, encKey = F.enc.key) => guideModel(encKey, F.cfg.diff, F.cfg.stageLv, F.cfg.heroLv, F.cfg.variant ?? 0);

/** 일반·정예 구간은 지금 잡는 적 이름과 등급을 같이 (HTML, 이름은 데이터라 그대로) */
export function bossTitle(): string {
  const F = fight(), m = F.mobs.find(x => x.alive && !x.add); // 쫄(P-ADD)은 이름 줄에 안 씀
  const pack = trashPack(F), order = m && pack.length > 1 ? `<span class="vh">, ${pack.length}마리 중 ${pack.filter(x => !x.alive).length + 1}번째</span>` : '';
  return m ? `<span class="boss-title-text">${mobLook(F, m).name}</span><small class="grade${m.elite ? ' elite' : ''}">${mobGrade(m)}</small>${order}` : `<span class="boss-title-text">${F.enc.name}</span>`;
}

/**
 * 일반 · 정예 구간 초상 교대 (2026-10-25 Lim C안): 초상 · 체력 막대 = 지금 맞는 적 한 마리, 초상 오른쪽 아래에 기다리는 적 얼굴 (셋까지), 왼쪽 위에 「2 / 4」.
 * 쓰러지면 금빛이 번지고 다음 적 그림 · 새 막대로 바뀜. 엔진 (딜이 순서대로 한 마리에)은 그대로, 보이는 것만
 */
const trashPack = (F: Fight): Mob[] => (F.enc.script === 'trash' ? F.mobs.filter(m => !m.add) : []);
/** 지금 맞는 적 (bossTitle과 같은 적, 엔진 hitMobs 차례) */
const trashTarget = (F: Fight): Mob | undefined => trashPack(F).find(m => m.alive);
const DECK_MAX = 3;
let mobShown: number | null = null;
function updatePack(F: Fight, swap: boolean): void {
  const pack = trashPack(F), m = trashTarget(F), host = $('bossArt');
  const deck = host.querySelector<HTMLElement>(':scope > .mob-deck'), count = host.querySelector<HTMLElement>(':scope > .mob-count');
  if (!m || pack.length < 2) { deck?.remove(); count?.remove(); if (!m) return; }
  const src = mobLook(F, m).src, img = host.querySelector<HTMLImageElement>(':scope > img.boss-illustration');
  if (src && img && !img.src.endsWith(src)) img.src = src;
  else if (src && !img) host.querySelector(':scope > svg')?.replaceWith(Object.assign(document.createElement('img'), { className: 'boss-illustration', src, alt: '', decoding: 'async', draggable: false }));
  if (pack.length >= 2) {
    // 다음 적이 맨 위 · 맨 오른쪽, 그 뒤 적은 왼쪽 아래로 겹침 (시간 줄을 덮지 않게)
    const wait = pack.filter(x => x.alive && x !== m).slice(0, DECK_MAX);
    const d = deck ?? host.appendChild(Object.assign(document.createElement('div'), { className: 'mob-deck' }));
    d.replaceChildren(...wait.reverse().map(x => { const i = document.createElement('i'); i.style.backgroundImage = cssUrl(mobLook(F, x).src || encArt(F.enc.key, F.enc.script)); return i; }));
    const c = count ?? host.appendChild(Object.assign(document.createElement('b'), { className: 'mob-count' }));
    c.textContent = `${pack.filter(x => !x.alive).length + 1} / ${pack.length}`;
  }
  if (!swap) return;
  // 새 막대는 줄던 몫 (bossLag) 없이 가득에서 시작, 왼쪽부터 쓸어 채움 (회복처럼 안 보이게)
  const lag = $('bossLag'); lag.style.transition = 'none'; lag.style.width = '100%'; void lag.offsetWidth; lag.style.transition = '';
  if (S.reducedEffects) return;
  bossFx('mob-down');
  for (const el of [host.querySelector<HTMLElement>(':scope > img.boss-illustration'), $('bossFill'), host.querySelector<HTMLElement>(':scope > .mob-deck')]) {
    if (!el) continue;
    el.classList.remove('mob-in'); void el.offsetWidth; el.classList.add('mob-in');
  }
}

/** 긴 이름만 실제 남은 너비에 맞춰 축소한다. 등급 배지 크기와 이름 줄 높이는 유지한다. */
export function fitBossTitle(): void {
  const title = $('bossName').querySelector<HTMLElement>('.boss-title-text');
  if (!title || !title.getClientRects().length) return;
  title.style.removeProperty('font-size');
  let size = parseFloat(getComputedStyle(title).fontSize);
  // 짧은 이름으로 교체되거나 화면이 넓어지면 위에서 원래 CSS 크기로 복원한다.
  for (let i = 0; i < 3 && title.clientWidth > 0 && title.scrollWidth > title.clientWidth; i++) {
    size *= Math.max(1, title.clientWidth - 1) / title.scrollWidth;
    title.style.fontSize = `${size}px`;
  }
}

export function updateBossTitle(): void {
  $('bossName').innerHTML = bossTitle();
  fitBossTitle();
}

// ---------- 스킬 휠 (시안: 청동 3px 링 · 방사 그라데이션 칸, 가운데 = 마나 링) ----------
/** 휠 칸 방향 화살표 (시안의 금색 선 화살표) */
const DIR_PATH: Record<Dir, string> = {
  N: 'M12 20V4M6 10l6-6 6 6', NE: 'M6 18L18 6M10 6h8v8', E: 'M4 12h16M14 6l6 6-6 6', SE: 'M6 6l12 12M18 10v8h-8',
  S: 'M12 4v16M6 14l6 6 6-6', SW: 'M18 6L6 18M6 10v8h8', W: 'M20 12H4M10 6l-6 6 6 6', NW: 'M18 18L6 6M14 6H6v8',
};
const dirSvg = (d: Dir) => `<svg class="dir" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${DIR_PATH[d]}"/></svg>`;
export const LOCK_SVG = '<svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

export function buildWheel(D: number): void {
  const w = $('wheel'), F = B.F;
  w.style.width = w.style.height = D + 'px';
  // 시안 5인: 칸 68 · 가운데 72 (휠 폭 216 기준)
  const step = D / 3, b = step * 0.965, core = step * 0.98;
  w.style.setProperty('--slot', `${b}px`);
  let html = `<div id="core" style="left:${(D - core) / 2}px;top:${(D - core) / 2}px;width:${core}px;height:${core}px"><div class="core-in"><div id="manaNum">100<small>마나 %</small></div></div><div class="mana-meter" role="meter" aria-label="마나" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"></div></div>`;
  DIRS.forEach((it, i) => {
    if (!it) return;
    const pos = `left:${(i % 3) * step + (step - b) / 2}px;top:${Math.floor(i / 3) * step + (step - b) / 2}px;width:${b}px;height:${b}px`;
    if (!it.key) {
      html += `<div class="slot empty" data-dir="${it.d}" style="${pos}"><span class="ct">빈 칸</span></div>`;
      return;
    }
    // 아직 안 배운 스킬: 흐린 원화·이름·잠금·배우는 레벨 (누르면 안내). it.key = 휠 칸 → 지금 직업의 스킬
    const k = F ? slotKey(F, it.key) : (it.key as SkillKey);
    if (F && !knows(F, k)) {
      html += `<button class="slot locked" type="button" data-lock="${k}" data-dir="${it.d}" style="${pos}" aria-label="${SKILLS[k].name}, 잠김, Lv ${SKILL_LEVEL[k]}에 배움"><span class="in"><span class="slot-lock" aria-hidden="true">${LOCK_SVG}</span><span class="nm">${SKILLS[k].short}</span><span class="ct">Lv ${SKILL_LEVEL[k]}</span></span></button>`;
      return;
    }
    const wru = it.key === 'heal' || it.key === 'poh' ? art('fx-word-ready') : ''; // 성언 준비 별빛 고리 (그림이 있으면, 그림 요청 53)
    const wr = wru ? `<img class="wr-fx" src="${wru}" alt="" aria-hidden="true" decoding="async" draggable="false">` : '';
    html += `<button class="slot" type="button" data-slot="${it.key}" data-dir="${it.d}" style="${pos}"><span class="cd"></span><span class="in">${dirSvg(it.d)}<span class="nm"></span><span class="ct"></span><span class="cds"></span></span>${wr}</button>`;
  });
  w.innerHTML = html;
}

/** 휠 칸마다 지금 붙인 스킬 그림의 스킬 키 (성언처럼 칸의 스킬이 바뀌면 그림도 바꿈) */
const slotArt = new WeakMap<HTMLElement, SkillKey>();
/** 원화가 없을 때만 기능 실루엣을 사용한다. 축소 모드도 같은 이름·방향을 유지한다. */
function setSlotArt(el: HTMLElement, key: SkillKey): void {
  if (slotArt.get(el) === key) return;
  slotArt.set(el, key);
  el.querySelector('.sic')?.remove();
  el.querySelector('.skill-mark')?.remove();
  const url = art(`skill-${key}`);
  if (url) el.querySelector('.nm')?.insertAdjacentHTML('beforebegin', `<img class="sic" src="${url}" alt="" decoding="async" draggable="false">`);
  else el.querySelector('.nm')?.insertAdjacentHTML('beforebegin', skillMark(key));
}

/** 주시 (P-AGGRO, 35 4-4): 눈 게이지 % 또는 노리는 남은 초. 무력화 (P-STAGGER, 35 4-5): 힘 모으기 남은 초 */
function watchText(F: Fight): string {
  if (F.stagger) return ` · ${F.stagger.name} ${Math.ceil(F.stagger.until - F.t)}`;
  const v = F.vessel;
  if (v) return ` · ${v.name} ${Math.min(99, Math.floor((v.fill / v.need) * 100))}% ${Math.ceil(v.until - F.t)}`;
  const w = F.watch;
  if (!w) return ''; // 내 위협 (96)은 안 보임 (2026-10-19 Lim 「어그로 게이지는 보이지않게」, 엔진 셈은 그대로)
  return F.t < w.until ? ` · 주시 중 ${Math.ceil(w.until - F.t)}` : ` · 주시 ${Math.min(99, Math.floor((w.fill / w.max) * 100))}%`;
}

/** 보스 체력바 아래 게이지: 무력화 = 파랑 · 빛 그릇 = 연두 (못 채우면 깨지며 전원 피해), 주시 = 호박색 (차면 나를 노림). 내 위협 (96)은 안 보임 */
function bossGauge(F: Fight): void {
  const bar = $('bossFill').parentElement!;
  let g = bar.querySelector<HTMLElement>('#bossGauge');
  const st = F.stagger, ve = F.vessel, w = F.watch;
  const v = st ? st.fill / st.need : ve ? ve.fill / ve.need : w ? (F.t < w.until ? 1 : w.fill / w.max) : -1;
  if (v < 0) { if (g) g.hidden = true; return; }
  if (!g) { g = document.createElement('div'); g.id = 'bossGauge'; g.setAttribute('aria-hidden', 'true'); bar.appendChild(g); }
  g.hidden = false;
  g.classList.toggle('stagger', !!st);
  g.classList.toggle('vessel', !st && !!ve);
  const p = `${Math.max(0, Math.min(1, v)) * 100}%`;
  if (g.style.getPropertyValue('--g') !== p) g.style.setProperty('--g', p);
}

export function updateWheel(): void {
  const F = fight(), aim = ui.pointer && ui.pointer.dir;
  for (const el of $('wheel').querySelectorAll<HTMLElement>('.slot')) {
    el.classList.toggle('aim', aim === el.dataset.dir);
    if (el.dataset.lock) { setSlotArt(el, el.dataset.lock as SkillKey); continue; }
    if (!el.dataset.slot) continue;
    const slot = el.dataset.slot!, key = slotKey(F, slot), sk = SKILLS[key];
    setSlotArt(el, key);
    const spent = skillUsesSpent(F, key);
    if (spent && B.armed === slot) B.armed = null;
    const lk = F.lock[key], cdv = sk.cd ? F.cd[key] || 0 : 0, cd = Math.max(cdv, lk?.left ?? 0), cost = costOf(F, key); // 진동 잠김도 재사용 대기처럼
    const powerNeed=key==='lightWave'?waveNeed(F):sk.power;
    const lowMana = F.mana < cost, lowPower = !!sk.power && F.power3 < (sk.powerAll ? 1 : powerNeed!);
    const resource = sk.power ? `힘 ${sk.powerAll ? '1~3' : powerNeed}` : cost ? `마나 ${Math.round(cost * 10) / 10}%` : '마나 0';
    setText(el.querySelector('.nm')!, sk.short);
    // 일반·축소는 같은 내용과 순서를 사용한다. 패널 바깥 배율만 바뀐다.
    const visibleCost = sk.power ? (sk.powerAll ? '힘1+' : `힘${powerNeed}`) : `${Math.round(cost * 10) / 10}%`;
    setText(el.querySelector('.ct')!, spent ? '' : visibleCost);
    // 공통 재사용 대기: 자기 재사용 대기보다 길면 연한 부채꼴로 (시전 중에는 누르면 시전을 끊고 바로 나가므로 안 그림)
    const gcd = !spent && !F.cast && F.gcd > cd ? F.gcd / F.gcdBase : 0;
    el.querySelector<HTMLElement>('.cd')!.style.setProperty('--p', spent ? '100%' : cd > 0 && !gcd ? `${Math.min(1, cd / (lk && lk.left >= cdv ? lk.total : cdMax(F, key))) * 100}%` : gcd > 0 ? `${Math.min(1, gcd) * 100}%` : '0%');
    setText(el.querySelector('.cds')!, spent ? '사용 완료' : cd > 0 ? `${Math.ceil(cd)}초` : '');
    const label = `${sk.name}, ${spent ? '사용 완료, 전투당 사용 횟수 소진' : lk ? `진동으로 잠김 ${Math.ceil(cd)}초` : cd > 0 ? `재사용 대기 ${Math.ceil(cd)}초` : resource}${lowMana ? ', 마나 부족' : lowPower ? ', 신성한 힘 부족' : ''}${B.armed === slot ? ', 선택됨. 대상 선택 또는 다시 눌러 취소' : ''}`;
    if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
    el.setAttribute('aria-pressed', String(B.armed === slot));
    el.setAttribute('aria-disabled', String(spent));
    el.classList.toggle('spent', spent);
    el.classList.toggle('off', spent || cd > 0 || lowMana || lowPower);
    el.classList.toggle('resource-low', lowMana || lowPower);
    el.classList.toggle('cooling', spent || cd > 0);
    el.classList.toggle('gcd', gcd > 0);
    el.classList.toggle('armed', B.armed === slot);
    el.classList.toggle('holy', key === 'serenity');
  }
  $('wheel').classList.toggle('quake', F.tels.some(t => t.skill.quake)); // 진동 예고: 휠 테두리가 떨림 (35 4-4)
  // 휠 가운데 = 마나 링 (시안). 마나가 모자라면 링·숫자가 빨강 (27 3-4: 위기 신호를 마나 테두리로)
  const mn = $('manaNum'), core = $('core'), mana = manaMeter(F.mana);
  setText(mn.firstChild as Element, String(mana.percent));
  setText(mn.querySelector('small')!, '마나 %');
  if (core.style.getPropertyValue('--m') !== mana.fill) core.style.setProperty('--m', mana.fill);
  core.classList.toggle('low', mana.low);
  core.classList.toggle('mana-empty', mana.percent === 0);
  core.classList.toggle('mana-full', mana.percent === 100);
  const meter = core.querySelector('.mana-meter')!;
  if (meter.getAttribute('aria-valuenow') !== String(mana.percent)) meter.setAttribute('aria-valuenow', String(mana.percent));
  core.classList.toggle('beacon', B.beacon);
  updateClassGauge($('gauges'), classGaugeState(F));
  const coreOff = F.hero === 'warder' && F.level >= SKILL_LEVEL.judgment && !judgeReady(F);
  core.classList.toggle('core-off', coreOff);
  if (coreOff) core.setAttribute('aria-disabled', 'true'); else core.removeAttribute('aria-disabled');
}
function setBar(el: HTMLElement | null, v: number): void {
  if (!el) return;
  const w = `${Math.round(Math.max(0, Math.min(1, v)) * 1000) / 10}%`;
  if (el.style.width !== w) el.style.width = w;
}

/** 승인된 직업별 배경과 분할 게이지를 같은 전투 상태에 연결합니다. */
export function buildGauges(F: Fight): void {
  buildClassGauge($('gauges'), $('controls'), F.hero);
  updateClassGauge($('gauges'), classGaugeState(F));
}

// ---------- 특성 버튼 (06 9장 2번 · 2026-10-16 Lim: 소비 아이템을 없애고 그 자리에, 스킬 버튼과 같은 원형 · 재사용 대기 표시) ----------
// 고른 버튼 특성만 보임 (직업마다 최대 2개, 사제 · 수도사 3개). 장비 효과는 버튼을 만들지 않는다.
// 2026-10-16 Lim 「특성을 안 찍었을 때와 비활성화일 땐 가려 줘, 1개면 가운데, 스킬 자원 그림이 가득 차게」: 잠긴 단 · 안 고른 단은 칸을 두지 않고,
// 보이는 버튼이 없으면 자원 그림을 키움 (class-controls.css)
export function buildAux(): void {
  const keys = talentSlots(fight()).flatMap(s => (s.kind === 'tal' ? [s.key] : [])), aux = $('aux');
  aux.hidden = !keys.length;
  aux.dataset.n = String(keys.length);
  $('controls').classList.toggle('hasaux', keys.length > 0);
  aux.innerHTML = keys.map(k => {
    const pic = art(`talent-${k}`); // 특성 그림 (78). 없으면 이름만
    return `<button class="slot tal" type="button" data-tal="${k}" aria-label="${TALENT_DEF[k].name}"><span class="cd"></span><span class="in">${pic ? `<img class="sic" src="${pic}" alt="" decoding="async" draggable="false">` : ''}<span class="nm">${TALENT_DEF[k].active!.short}</span><span class="ct"></span><span class="cds"></span></span></button>`;
  }).join('');
}
/** 휠 스킬과 같은 표시: 재사용 대기 = 어두운 그림 + 부채꼴 + 남은 초, 효과 중 = 금빛 테 + 남은 초, 횟수 소진 = 사용 완료 */
export function updateAux(): void {
  const F = fight();
  for (const el of $('aux').querySelectorAll<HTMLElement>('[data-tal]')) {
    const k = el.dataset.tal as TalentKey, a = F.tx.act[k];
    if (!a) continue;
    const on = activeOn(F, k), spent = talentUsesSpent(F, k), cd = !spent && !on ? a.cd : 0;
    if (spent && ui.talArmed === k) ui.talArmed = null;
    el.querySelector<HTMLElement>('.cd')!.style.setProperty('--p', spent ? '100%' : cd > 0 ? `${Math.min(1, cd / talentCd(F, k)) * 100}%` : '0%');
    setText(el.querySelector('.ct')!, on ? `${Math.ceil(a.left)}초` : '');
    setText(el.querySelector('.cds')!, spent ? '사용 완료' : cd > 0 ? `${Math.ceil(cd)}초` : '');
    const label = `${TALENT_DEF[k].name}, ${spent ? '사용 완료, 전투당 사용 횟수 소진' : on ? `효과 중 ${Math.ceil(a.left)}초` : cd > 0 ? `재사용 대기 ${Math.ceil(cd)}초` : '사용 가능'}${ui.talArmed === k ? ', 선택됨. 칸 선택 또는 다시 눌러 취소' : ''}`;
    if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
    el.setAttribute('aria-pressed', String(ui.talArmed === k));
    el.setAttribute('aria-disabled', String(spent));
    el.classList.toggle('spent', spent);
    el.classList.toggle('on', on);
    el.classList.toggle('cooling', spent || cd > 0);
    el.classList.toggle('armed', ui.talArmed === k);
  }
}
export function openTalentTip(k: TalentKey, el: HTMLElement): void {
  const d = TALENT_DEF[k], a = d.active!;
  const row = a.once ? '전투당 1회' : `${a.dur}초 · 재사용 대기 ${a.cd}초`;
  const F = fight();
  popTip(tipHtml({ name: d.name, kind: '특성', rows: [['즉시', row]], desc: healText(d.desc, INT_BASE * F.power * F.gear.heal), note: a.cell ? '누른 뒤 빈 칸을 탭' : 'GCD·마나 없이 바로' }), el, { tal: k, held: true });
}

// ---------- 시전 막대 (시안: 화면 폭 막대 안에 「스킬 → 대상」 · 남은 초, 채움 끝에 밝은 선) ----------
export function updateCastbar(): void {
  const F = fight();
  let label: string, detail = '', p = 0, left = '';
  if (F.cast) {
    const u = F.party.find(x => x.id === F.cast!.uid);
    label = `${SKILLS[F.cast.key].short} → ${u ? u.nick : ''}`;
    if (F.hero === 'astrologer' && CONSTELLATION.has(F.cast.key)) label += ` · 별 ${starsNow(F)}${starsNow(F) >= starMax(F) ? ' · 가득' : ''}`; // 83: 별자리 시전 = 지금 조각으로 터질 별 수
    p = 1 - F.cast.left / F.cast.total;
    left = Math.max(0, F.cast.left).toFixed(1);
  } else if (F.channel > 0) {
    const raid = SKILLS[HEROES[F.hero].slots.raid!];
    label = `${raid.short} · 칸을 누르면 끊김`;
    p = 1 - F.channel / (raid.channel || 4);
    left = Math.max(0, F.channel).toFixed(1);
  } else if (B.beacon) {
    label = '봉화: 지킬 파티원 칸 선택';
  } else if (B.armed) {
    const k = slotKey(F, B.armed);
    label = `${SKILLS[k].name} 장전: ${SKILLS[k].target === 'area' ? '누른 채 범위를 보고 떼기' : SKILLS[k].target === 'cell' ? '세울 칸 선택 (빈 칸도)' : '대상 칸 선택'}`;
  } else if (F.queued) {
    label = `다음: ${SKILLS[F.queued.key].name}`;
    p = F.gcd > 0 ? F.gcd / F.gcdBase : 0;
    left = F.gcd > 0 ? F.gcd.toFixed(1) : '';
  } else if (F.gcd > 0) {
    // 공통 재사용 대기 (2026-10-10 Lim: 소생 같은 즉시 스킬 뒤에 안 보였음): 시전 막대 자리에 줄어드는 막대 + 남은 초
    label = '공통 재사용 대기';
    p = F.gcd / F.gcdBase;
    left = F.gcd.toFixed(1);
  } else {
    const selected = F.party.find(u => u.id === ui.selectedUnitId);
    if (selected) {
      const hp = `${Math.ceil(selected.hp)}/${Math.ceil(selected.max)} (${Math.ceil(selected.hp / selected.max * 100)}%)`;
      const types = [...new Set(selected.debuffs.map(d => d.type))];
      label = `${selected.nick} · ${selected.alive ? `HP ${hp}` : '쓰러짐'}${types.length ? ` · ${types.join('/')}` : ''}`;
      detail = `${selected.nick}, ${selected.alive ? `체력 ${hp}` : '쓰러짐'}. ${selected.debuffs.length ? selected.debuffs.map(d => `${d.name}${dispellable(d) ? ` (${d.type})` : ''}, ${Math.ceil(d.left)}초${d.stack ? `, ${d.stack}중첩` : ''}${debuffBrief(d) ? `, ${debuffBrief(d)}` : ''}`).join('. ') : '디버프 없음'}`;
    } else label = `칸을 탭하면 ${SKILLS[tapKey()].name}`;
  }
  const casting = !!F.cast || F.channel > 0;
  setText($('castLabel'), label);
  $('castLabel').title = detail || label;
  $('castLabel').setAttribute('aria-label', detail || label);
  setText($('castTime'), left);
  $('castbar').classList.toggle('is-casting', casting);
  $('castbar').classList.toggle('is-armed', !casting && (!!B.armed || B.beacon));
  $('castbar').classList.toggle('is-gcd', !casting && p > 0);
  setBar($('castFill'), p);
  // 전투 메시지가 시전 막대 자리를 덮는 동안 보일 얇은 진행 선 · 남은 초
  const note = $('toast'), cast = p.toFixed(3);
  if (cast !== noteCast) { noteCast = cast; note.style.setProperty('--cast', cast); $('alarm').style.setProperty('--cast', cast); } // 붉은 경고도 같은 선
  if (note.dataset.left !== left) { note.dataset.left = left; $('alarm').dataset.left = left; }
}
let noteCast = '';

// ---------- 파티원 공격 숫자 (2026-10-07 Lim: 합치지 않고 한 방씩) ----------
// 2026-10-13 Lim 「더 크게, 타격감 있게. 다른 UI를 가려도 됨」: 보스 초상 둘레 네 자리에서 크게 찍히고 튀었다가 떠오름 (자리 · 연출은 hit-feel.css)
const DMG_POOL = 4;
const dmg = { els: [] as HTMLSpanElement[], i: 0, avg: 0, hurtAt: 0 };
export function resetDmgNums(): void {
  const box = $('dmgNums');
  if (!dmg.els.length) for (let k = 0; k < DMG_POOL; k++) { const s = document.createElement('span'); s.style.setProperty('--row', String(k)); box.appendChild(s); dmg.els.push(s); }
  for (const s of dmg.els) s.className = '';
  dmg.avg = 0; dmg.i = 0; dmg.hurtAt = 0;
}
export function dmgNum(u: Unit | undefined, amt: number, now: number, crit = false): void {
  if (S.reducedEffects) return;
  if (!dmg.els.length) resetDmgNums();
  const el = dmg.els[dmg.i]; dmg.i = (dmg.i + 1) % DMG_POOL;
  const n = Math.max(1, Math.round(amt));
  dmg.avg = dmg.avg ? dmg.avg * 0.9 + amt * 0.1 : amt;
  el.textContent = String(n);
  el.className = `${u ? u.role : ''}${crit || amt > dmg.avg * 1.6 ? ' big' : ''}`;
  el.style.setProperty('--jx', `${Math.round(Math.random() * 12 - 6)}px`);
  void el.offsetWidth;
  el.classList.add('go');
  if (now - dmg.hurtAt > 160) { dmg.hurtAt = now; const a = $('bossArt'); a.classList.remove('hurt'); void a.offsetWidth; a.classList.add('hurt'); }
}

/** 능력치 (99 다): 파티원 한 방이 빗나감 = 보스 초상에 회색 「빗나감」 (숫자 자리 돌림판 그대로) */
export function missNum(u: Unit | undefined): void {
  if (S.reducedEffects) return;
  if (!dmg.els.length) resetDmgNums();
  const el = dmg.els[dmg.i]; dmg.i = (dmg.i + 1) % DMG_POOL;
  el.textContent = '빗나감';
  el.className = `miss${u ? ` ${u.role}` : ''}`;
  el.style.setProperty('--jx', `${Math.round(Math.random() * 12 - 6)}px`);
  void el.offsetWidth;
  el.classList.add('go');
}

/** 치유하는 쫄이 보스를 회복 (35 3-I): 보스 그림 옆 초록 +숫자 */
export function bossHealNum(amt: number): void {
  if (S.reducedEffects) return;
  if (!dmg.els.length) resetDmgNums();
  const el = dmg.els[dmg.i]; dmg.i = (dmg.i + 1) % DMG_POOL;
  el.textContent = `+${Math.max(1, Math.round(amt))}`;
  el.className = 'bossheal';
  void el.offsetWidth;
  el.classList.add('go');
}

/** 원형 초상 안에 겹치는 칸 (판마다 초상을 새로 그리므로 없으면 만듦) */
function bossLayer(cls: string): HTMLElement {
  const host = $('bossArt');
  let el = host.querySelector<HTMLElement>(`:scope > .${cls}`);
  if (!el) { el = document.createElement('div'); el.className = cls; host.appendChild(el); }
  return el;
}
/** 보스 그림 위 연출 (37 4장 F-1): 그림 fx-<이름>이 있으면 그 그림, 없으면 그 색 빛이 퍼졌다 사라짐 */
export function bossFx(name: string): void {
  if (S.reducedEffects) return;
  const box = bossLayer('bfx-box'), src = art(`fx-${name}`);
  const el = document.createElement(src ? 'img' : 'i');
  if (src) { const img = el as HTMLImageElement; img.src = src; img.alt = ''; img.decoding = 'async'; img.draggable = false; }
  el.className = `bfx bfx-${name}`;
  el.addEventListener('animationend', () => el.remove());
  box.appendChild(el);
  while (box.children.length > 4) box.firstElementChild!.remove();
}
/** 보스에 계속 붙는 표시: 보호막 수정이 지킴 (fx-crystal-shield) · 반격 틈 기술 시전 중 (fx-counter) */
function bossAura(F: Fight): void {
  const key = F.mobs.some(m => m.alive && m.add?.job?.p === 'pylon') ? 'crystal-shield' : F.tels.some(t => t.skill.stunOnCut != null) ? 'counter' : '';
  const el = bossLayer('baura');
  if ((el.dataset.k ?? '') === key) return;
  el.dataset.k = key;
  const src = key ? art(`fx-${key}`) : '';
  el.className = `baura${key ? ` ${key}` : ''}${src ? ' art' : ''}`;
  el.style.backgroundImage = src ? cssUrl(src) : '';
}

// ---------- 보스 무대 (27 3-4, 시안 MmoBattle5·20) ----------
/** 예고 칸 채움: 이만큼(초) 남았으면 가득. DBM 막대처럼 남은 시간만큼 줄어듦 */
const QWIN = 30;
/** 예고 칸 게이지 (2026-10-13 Lim 「잘 안 보인다」): 남은 시간 비율을 --p로, 칸 아래 밝은 막대로 그림 (hit-feel.css) */
function qGauge(el: HTMLElement, v: number): void {
  const p = String(Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000);
  if (el.style.getPropertyValue('--p') !== p) el.style.setProperty('--p', p);
}
/** 곧 떨어지는 칸 (빨강): 시전 중이거나 이 초 이하 */
const QSOON = 5;
/**
 * 예고 칸 이름 (2026-10-16): 칸에 들어가면 정식 이름, 넘치면 글자를 조금 줄여 보고, 그래도 넘치면 이 줄임말 → 기술 아이콘 글자.
 * 긴 정식 이름은 설명·접근성 이름에 유지한다.
 */
const QSHORT: Record<string, string> = {
  '고철 휘두르기': '휘두르기', '쇳조각 비': '쇳조각', '내려찍기': '강타', '증기 분출': '분출', '증기 폭발': '폭발',
  '녹물 웅덩이': '웅덩이', '썩은 숨결': '숨결', '역병 파동': '파동', '역병 폭풍': '폭풍',
  '인터미션 끝': '복귀', '고철 폭주': '폭주', '증기 폭주': '폭주', '역병 폭주': '폭주',
};
/** 이름 후보를 앞에서부터 보통 크기 → 조금 줄인 크기로 넣어 보고 처음 들어가는 것을 씀. 후보가 같으면 다시 재지 않음 */
function fitQName(nm: HTMLElement, names: string[]): void {
  const key = names.join('|');
  if (nm.dataset.names === key) return;
  nm.dataset.names = key;
  for (const n of names) for (const tight of [false, true]) {
    nm.classList.toggle('tight', tight); nm.textContent = n;
    if (nm.scrollWidth <= nm.clientWidth + 0.5) return;
  }
  nm.classList.remove('tight'); nm.textContent = names[names.length - 1];
}
/** 예고 칸 종류: 작은 글자 + 네모 아이콘 (시안: 버스터 = 방패에 번개, 광역 = 퍼지는 빛) */
const QKIND: Record<string, { name: string; path: string }> = {
  buster: { name: '버스터', path: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M13 6.5l-2.5 5h3.5l-2 5"/>' },
  aoe: { name: '광역', path: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>' },
  zone: { name: '장판', path: '<ellipse cx="12" cy="16.5" rx="8.5" ry="3.8"/><path d="M12 3.5v8M8.5 8.5l3.5 3.5 3.5-3.5"/>' },
  instant: { name: '디버프', path: '<path d="M12 3c4 5 6.5 8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 11 8 8 12 3z"/><path d="M9.5 14.5h5"/>' },
  inter: { name: '인터미션', path: '<path d="M7 3h10M7 21h10M8 3v2c0 3 4 5 4 7s-4 4-4 7v2M16 3v2c0 3-4 5-4 7s4 4 4 7v2"/>' },
};
const qKind = (k: string | undefined) => QKIND[k || ''] || QKIND.aoe;
/** 예고 칸·설명 팝업의 네모 아이콘 */
export const qIcon = (kind: string | undefined) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${qKind(kind).path}</svg>`;
/** 예고 칸 · 팝업 아이콘 칸: 기술 그림이 있으면 그림 + 종류 · 유형 색 테두리 (37 1장, 44 4장 D), 없으면 종류 SVG */
const qIc = (ic: string, kind: string | undefined, name: string, cls = 'ic') => {
  const img = skillArtImg(name);
  return img ? `<span class="${cls} art" style="border-color:${iconColor(ic, kind)}">${img}</span>` : `<span class="${cls}">${qIcon(kind)}</span>`;
};

/**
 * 판마다 한 번: 보스 체력 막대의 페이즈 눈금, 던전 구간 진행 ●●○○ (시간 줄 오른쪽).
 * 눈금 = 공략의 「체력 N%」 페이즈 + 지휘자처럼 마지막에 나오는 보스 적의 시작점
 */
export function buildStage(): void {
  const F = fight(), R = S.run!;
  const ticks = new Set<number>();
  for (const p of guideOf(F).phases) { const m = /^체력 (\d+)%/.exec(p.at); if (m && +m[1] > 0 && +m[1] < 100) ticks.add(+m[1] / 100); }
  const total = F.mobs.reduce((a, m) => a + m.max, 0), boss = F.mobs.filter(m => m.boss).reduce((a, m) => a + m.max, 0);
  if (total > 0 && boss > 0 && boss < total) ticks.add(boss / total);
  $('bossTicks').innerHTML = [...ticks].map(v => `<i style="left:${(v * 100).toFixed(1)}%"></i>`).join('');
  mobShown = null; // 초상 교대 (일반 · 정예 구간): 첫 적은 연출 없이
  const dots = $('segDots'), n = R.segs.length;
  dots.hidden = n < 2;
  dots.setAttribute('role', 'img');
  dots.setAttribute('aria-label', `던전 구간 ${R.idx + 1}/${n}`);
  dots.innerHTML = n < 2 ? '' : R.segs.map((_, i) => `<i class="${i < R.idx ? 'done' : i === R.idx ? 'cur' : ''}"></i>`).join('');
}

export function updateStage(now: number): void {
  const F = fight(), R = S.run!;
  $('battle').classList.toggle('reduced-effects', S.reducedEffects);
  const tm = trashTarget(F), hpNow = tm ? tm.hp : F.bossHp, pct = tm ? tm.hp / tm.max : F.bossHp / F.bossMax;
  if (tm && tm.id !== mobShown) { updatePack(F, mobShown != null); mobShown = tm.id; }
  else if (!tm && mobShown != null) { mobShown = null; updatePack(F, false); }
  setBar($('bossFill'), pct);
  setBar($('bossLag'), pct);
  bossAura(F);
  if (F.over === 'win' && F.bossHp <= 0) setText($('bossHpText'), '처치');
  else setText($('bossHpText'), `${Math.ceil(hpNow).toLocaleString('ko-KR')} · ${Math.ceil(pct * 100)}%${F.invuln ? ' · 무적' : F.daze ? ` · ${F.daze.name ?? '멍함'} ${Math.ceil(F.daze.until - F.t)}` : F.mobs.length && bossTaken(F) < 1 ? ' · 보호막' : ''}${F.empower ? ` · 강해짐 +${Math.round(F.empower * 100)}%` : ''}${F.weak ? ` · ${F.weak.cut < 0 ? '성남' : '약해짐'} ${Math.ceil(F.weak.until - F.t)}` : ''}${F.expose && F.expose.vuln < 1 ? ` · 단단해짐 ${Math.ceil(F.expose.until - F.t)}` : ''}${watchText(F)}`);
  bossGauge(F);
  // 위치 줄 (2026-10-16 Lim 「전체적으로 통일되게 장소명과 난이도만, 잘리지 않게」): 모든 전투 「장소 · 난이도」, 주간 도전은 「장소 · 도전 n단계」.
  // 구간 진행은 시간 줄 점, 페이즈는 큰 알림, 적 이름은 이름 줄이 보여 줌
  setText($('phase'), `${contentOf(R.content as ContentKey)?.name ?? R.name} · ${S.chal ? `도전 ${S.chal}단계` : F.cfg.diff}`);
  const adds = $('bossAdds'), ratsOn = F.rats.length > 0 && adds.hasAttribute('src');
  if (adds.hidden === ratsOn) adds.hidden = !ratsOn;
  // 시간 줄 (시안 「0:42 · 광폭까지 3:48」). 탱커 공백 (35 6-4)이면 광폭까지 남은 초를 빨갛게
  const noTank = F.noTankAt != null && !F.enraged ? Math.max(0, Math.ceil(NO_TANK_SEC - (F.t - F.noTankAt))) : null;
  if (S.limit) {
    // 주간 도전 (13 3-2): 던전 전체 제한시간 (휴식 뺀 전투 시간 합)
    const used = R.time + chalTime(F); // 도전자의 위기 (115): 쓰러질 때마다 더한 초
    setText($('timer'), `${mmss(used)} / ${mmss(S.limit)}${F.enraged ? ' · 광폭화!' : noTank != null ? ` · 탱커 없음 ${noTank}` : ''}`);
    $('timer').classList.toggle('over', used > S.limit);
  } else setText($('timer'), F.enraged ? `${mmss(F.t)} · 광폭화!` : noTank != null ? `${mmss(F.t)} · 탱커 없음 · 광폭까지 ${mmss(noTank)}` : isFinite(F.enc.enrage) ? `${mmss(F.t)} · 광폭까지 ${mmss(Math.ceil(F.enc.enrage - F.t))}` : mmss(F.t));
  $('timer').classList.toggle('enraged', F.enraged || noTank != null);
  // 탱커 앞줄 이탈 (위치 규칙, 2026-10-13 Lim): 적이 아무나 때리는 동안 메시지 자리에 붉은 경고 + 지금 맞는 사람
  const lo = !F.over && F.loose ? F.party.find(u => u.id === F.loose!.id && u.alive) : undefined;
  alarm(lo ? { title: '탱커가 맨 앞줄을 벗어남', text: `적이 아무나 공격 · 지금 ${lo.me ? '나' : lo.nick}` } : null);
  if (now - ui.qAt > 90) {
    ui.qAt = now;
    // art = 기술 아이콘 그림 이름 (37 1장 · 4장, 없으면 '' → 종류 SVG)
    // 전투가 끝나면 남은 예고는 비움 (빈 칸 3개)
    const q = queue(F).filter(() => !F.over).map(it => ({ ...it, kind: it.kind as string | undefined, art: it.skill ? fightSkillArt(F, it.skill) : '' }));
    if (!F.over && F.phaseName === '인터미션' && F.interEnd) q.unshift({ name: '인터미션 끝', icon: '쥐떼', kind: 'inter', impact: F.interEnd, casting: false, art: '' });
    q.splice(3);
    const queueEl = $('queue');
    let cards = Array.from(queueEl.querySelectorAll<HTMLElement>('.q'));
    let refocus: HTMLElement | undefined;
    // 같은 기술·발동 시각의 대기열은 DOM을 유지: 카운트다운 때문에 포커스를 다시 만들지 않는다.
    const changed = queueEl.children.length !== 3 || cards.length !== q.length || q.some((it, i) => cards[i]?.dataset.ic !== (it.icon || '') || cards[i]?.dataset.imp !== it.impact.toFixed(2) || cards[i]?.dataset.art !== it.art);
    if (changed) {
      const focused = document.activeElement instanceof HTMLElement && queueEl.contains(document.activeElement) ? { ...document.activeElement.dataset } : null;
      // 예고 칸 3개를 늘 표시 (27 3-4): 기술이 없으면 빈 테두리 칸. 칸 안 기술 아이콘은 뺌 (2026-10-13 Lim, 누르면 나오는 설명 팝업에는 있음)
      queueEl.innerHTML = q.map(it => `<button type="button" class="q" data-ic="${it.icon || ''}" data-imp="${it.impact.toFixed(2)}" data-kind="${it.kind || ''}" data-art="${it.art}"><span class="fill"></span><span class="tx"><span class="nm"></span><span class="kd">${qKind(it.kind).name}</span></span><span class="sec"><b class="sec-num"></b><small>초</small></span></button>`).join('')
        + '<span class="q-empty" aria-hidden="true"></span>'.repeat(3 - q.length);
      cards = Array.from(queueEl.querySelectorAll<HTMLElement>('.q'));
      // 순서가 바뀌었을 때만, 여전히 예고 중인 같은 기술로 포커스를 이어 준다.
      if (focused) refocus = cards.find(el => el.dataset.ic === focused.ic && el.dataset.imp === focused.imp);
    }
    // 곧 떨어지는 칸 = 빨강, 그 다음 칸 = 청동 (맨 앞이면 금테), 나머지 = 어둡게
    const firstCool = q.findIndex(it => !(it.casting || it.impact - F.t <= QSOON));
    q.forEach((it, i) => {
      const sec = Math.max(0, it.impact - F.t), icon = it.icon || '', hot = it.casting || sec <= QSOON;
      const el = cards[i], cls = `q${i === 0 ? ' first' : ''}${hot ? ' hot' : i === firstCool ? ' next' : ' later'}${it.casting ? ' casting' : ''}${tipMatch(icon, it.impact) ? ' tipon' : ''}`;
      if (el.className !== cls) el.className = cls;
      setText(el.querySelector('.sec-num')!, String(Math.ceil(sec)));
      // 남은 초를 먼저 넣고 잼 (새 칸은 초 글자가 비어 이름 자리가 넓게 재짐)
      const names = [...new Set([it.name, QSHORT[it.name || ''], it.icon].filter((n): n is string => !!n))];
      fitQName(el.querySelector<HTMLElement>('.nm')!, names.length ? names : ['기술']);
      const label = `${it.name || '기술'}, ${qKind(it.kind).name}, ${Math.ceil(sec)}초 뒤${it.casting ? ', 시전 중' : ''}. 기술 설명`;
      if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      qGauge(el.querySelector<HTMLElement>('.fill')!, sec / QWIN);
    });
    refocus?.focus({ preventScroll: true });
    if (ui.tip) { const qe = queueEl.querySelector<HTMLElement>('.q.tipon'); if (qe) placeTip(qe); } // 팝업은 대기열 밖에서 유지하고 순서가 바뀌면 따라감
    const big = q.filter(it => it.casting && (it.kind === 'buster' || it.kind === 'aoe')).sort((a, b) => a.impact - b.impact)[0];
    if (big) {
      const s = Math.ceil(big.impact - F.t);
      if (s !== ui.tickSec && s <= 3 && s >= 1) { ui.tickSec = s; Snd.play('tick'); }
    } else ui.tickSec = null;
    for (const tl of F.tels) if ((tl.kind === 'buster' || tl.kind === 'aoe') && tl.impact - F.t <= 1 && !ui.vibedTel.has(tl.id)) { ui.vibedTel.add(tl.id); vibe(40); }
    const firstBuster = F.tels.find(tl => tl.kind === 'buster' && tl.skill.dmg);
    if (firstBuster && !ui.busterHint && !S.auto) {
      // 숫자는 칸 위 강타 예고와 같은 엔진 계산 (telDmg, 체력 글자처럼 올림. 예전엔 기술 피해 × 배율이라 칸 위 「-1961」과 1 다르게 「1960」)
      const tgt = F.party.find(u => firstBuster.units.includes(u.id));
      const amt = tgt ? telDmg(F, firstBuster, tgt) : firstBuster.skill.dmg! * F.dmgMult;
      // 권하는 생존기는 그 직업의 외부 생존기 칸 (사제 수호 영혼 · 드루이드 나무껍질 …), 아직 안 배웠으면 미리 채우기만
      const ext = slotKey(F, 'guardian'), tip = knows(F, ext) ? `미리 채우거나 ${SKILLS[ext].name}` : '미리 채워 두기';
      ui.busterHint = true; toast(`${firstBuster.skill.name}: 탱커에게 ${Math.ceil(amt - 1e-6)} 피해. ${tip}`);
    }
  }
  $('battle').classList.toggle('aoe', F.tels.some(t => t.kind === 'aoe'));
  // 탱커 전멸 시 적 기술 예고 줄 하단에 오른쪽 벽 전광판을 펼친다. 전투는 계속.
  const down = !F.over && F.party.some(u => u.role === 'tank') && !F.party.some(u => u.role === 'tank' && u.alive);
  if ($('giveUp').hidden === down) {
    $('giveUp').hidden = !down; $('stage').classList.toggle('give-up', down); placeGiveUp();
  }
}

// ---------- 설명 팝업 (보스 기술 · 스킬 · 특성 같은 모양) ----------
// 예고 칸을 누르면 그 기술이 무엇인지 한 줄로. 게임은 멈추지 않음. 같은 칸 다시 누르기 / 다른 곳 누르기 / 4초 뒤 닫힘.
// 스킬 · 특성 버튼을 길게 눌러 연 팝업은 누르는 동안 유지, 손을 떼고 3초 뒤 또는 아무 곳이나 누르면 닫힘 (2026-10-16 Lim).
// 팝업은 pointer-events: none 이라 아래 판 터치·쓸기를 막지 않음
const TIP_MS = 4000, TIP_KEEP = 3000;
/** 같은 기술이 대기열에 두 번 있을 수 있어, 누른 그 회차를 맞을 시각(impact)으로 따라감 */
export const tipMatch = (ic: string, imp: number) => !!ui.tip && ui.tip.ic === ic && Math.abs(imp - (ui.tip.imp ?? -1e9)) < 0.2;
function popTip(html: string, el: HTMLElement, tip: NonNullable<typeof ui.tip>): void {
  const t = $('tip');
  t.innerHTML = html; t.hidden = false;
  ui.tip = tip;
  placeTip(el);
  clearTimeout(ui.tipTimer);
  if (!tip.held) ui.tipTimer = setTimeout(closeTip, TIP_MS);
}
/** 길게 눌러 연 스킬 · 특성 팝업에서 손을 뗐을 때: TIP_KEEP 뒤 닫힘 (그 전에 아무 곳이나 누르면 바로 닫힘) */
export function releaseTip(): void {
  if (!ui.tip?.held) return;
  ui.tip.held = false;
  clearTimeout(ui.tipTimer);
  ui.tipTimer = setTimeout(closeTip, TIP_KEEP);
}
export function openTip(ic: string, qEl: HTMLElement): void {
  const F = fight(), s = guideOf(F).skills.find(x => x.ic === ic);
  if (!s) { closeTip(); return; }
  const [what] = s.tip(F);
  popTip(tipHtml({ icon: qIc(ic, qEl.dataset.kind, qEl.dataset.art || '', 'ic qk'), name: s.name, kind: F.enc.script === 'trash' ? '적 기술' : '보스 기술', rows: [[s.every]], desc: what }), qEl, { ic, imp: +qEl.dataset.imp! });
  ui.skillTips++;
  for (const q of $('queue').querySelectorAll<HTMLElement>('.q')) q.classList.toggle('tipon', tipMatch(q.dataset.ic!, +q.dataset.imp!));
}
export function openSkillTip(key: SkillKey, el: HTMLElement): void {
  const lock = B.F && !knows(B.F, key) ? SKILL_LEVEL[key] : 0;
  popTip(tipHtml(skillTip(key, lock, B.F ? INT_BASE * B.F.power * B.F.gear.heal : undefined)), el, { skill: key, held: true });
}
export function closeTip(): void {
  clearTimeout(ui.tipTimer);
  ui.tip = null;
  $('tip').hidden = true;
  for (const q of $('queue').querySelectorAll('.q.tipon')) q.classList.remove('tipon');
}
/** 누른 칸 위쪽에 띄워 판 맨 윗줄(탱커 자리)을 가리지 않게. 자리가 없으면 아래로, 좌우는 화면 안으로 */
export function placeTip(el: HTMLElement): void {
  const tip = $('tip'), bat = $('battle').getBoundingClientRect(), r = el.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const cx = r.left + r.width / 2 - bat.left;
  const left = Math.max(8, Math.min(bat.width - w - 8, cx - w / 2));
  let top = r.top - bat.top - h - 8, below = false;
  if (top < 4) { top = r.bottom - bat.top + 8; below = true; }
  tip.style.left = `${Math.round(left)}px`; tip.style.top = `${Math.round(top)}px`;
  tip.style.setProperty('--ax', `${Math.round(Math.max(14, Math.min(w - 14, cx - left)))}px`);
  tip.classList.toggle('below', below);
}

// ---------- 길게 누르기: 파티원 정보 ----------
// 2026-10-11 Lim 「파티원을 꾹 누르면 상세창이 손가락에 가려진다」: 손가락(손)은 아래에서 오니 상세창은 늘 누른 칸 위쪽에.
// 판 위 공간이 모자라면 보스 무대 위까지 덮고, 그래도 모자라면 설명 문장을 접어 (.brief) 이름 · 체력 · 상태만 남김. 꼬리가 누른 칸을 가리킴.
// 손을 떼도 PREVIEW_KEEP 동안 남아 손가락 없이 읽을 수 있음. 다음 터치에 닫히고 그 터치는 평소대로 (index.ts). 떠 있는 동안 체력 · 남은 초는 실시간
const PREVIEW_KEEP = 5000, PREVIEW_GAP = 10;
/** uid = 보고 있는 파티원 · until = 손을 뗀 뒤 닫을 때 (누르는 중이면 0) · at = 마지막으로 다시 그린 때 */
const pv = { uid: -1, until: 0, at: 0 };
export function showPreview(idx: number): void {
  const u = fight().cells[idx].unit;
  if (!u) return;
  pv.uid = u.id; pv.until = 0; pv.at = performance.now();
  drawPreview(u);
  $('preview').hidden = false;
  placePreview(u);
  vibe(10);
}
/** 손을 뗐을 때: 잠깐 더 남김 */
export function keepPreview(): void { if (pv.uid >= 0) pv.until = performance.now() + PREVIEW_KEEP; }
export function hidePreview(): void { pv.uid = -1; pv.until = 0; $('preview').hidden = true; }
/** 손을 뗀 뒤 떠 있는 상세창 (다음 터치에 닫음) */
export const previewKept = (): boolean => pv.uid >= 0 && pv.until > 0;
/** 매 프레임: 0.25초마다 내용 · 자리를 새로, 시간이 지나면 닫음 */
export function updatePreview(now: number): void {
  if (pv.uid < 0) return;
  const u = B.F?.party.find(x => x.id === pv.uid);
  if (!u || (pv.until && now >= pv.until)) { hidePreview(); return; }
  if (now - pv.at < 250) return;
  pv.at = now;
  drawPreview(u);
  placePreview(u);
}
function drawPreview(u: Unit): void {
  const F = fight();
  const lines: string[] = [];
  const cls = u.cls ? CLASSES[u.cls] : null;
  const job = u.me ? HEROES[F.hero].name : cls?.name;
  lines.push(`<div class="ph"><div class="pnm"><b>${u.nick}</b><span class="pmeta">${job ? `${job} · ` : ''}${ROLE[u.role].name}</span></div><div class="php"><span class="pmeta">체력</span>${u.alive ? `<strong>${Math.ceil(u.hp).toLocaleString('ko-KR')} <small>/ ${Math.round(u.max).toLocaleString('ko-KR')}</small></strong>` : '<strong class="pdown">쓰러짐</strong>'}</div></div>`);
  if (u.max < u.base) lines.push(`<div class="pmax">최대 체력 -${Math.round((1 - u.max / u.base) * 100)}%</div>`);
  if (u.ab) {
    const ab = ABILITIES[u.ab.key];
    const left = ab.cd > 0 ? Math.max(0, u.ab.ready - F.t) : 0;
    const state = ab.cd === 0 && !ab.each ? '상시' : ab.cd < 0 ? (u.ab.uses ? '사용함' : '1회 준비') : left > 0.05 ? `${Math.ceil(left)}초 뒤` : '준비';
    lines.push(`<div class="cpas ab pv-section"><div class="pv-heading"><b>${ab.name}${u.ab.star ? ` ${'★'.repeat(u.ab.star)}` : ''}</b><small class="pv-state">${state}</small></div><div class="d">${ab.desc}</div></div>`);
  }
  if (u.p.ch && u.p.cat) lines.push(`<div class="pers pv-section"><div class="pv-heading"><b>${u.pers}</b><small class="pv-label">성격</small></div><div class="d">${u.p.desc}</div></div>`);
  const items: string[] = [];
  // 디버프마다 하는 일을 짧게 (debuffBrief). 직업별 해제 가능 · 불가 글은 쓰지 않는다 (2026-10-27 Lim 「"드루이드 해제 불가" 텍스트를 제거하고 간략하게 … 효과를 설명」)
  for (const d of u.debuffs) {
    // 종류 이름은 지울 수 있을 때만 (물리 · 해제 안 됨은 종류가 아무 뜻이 없음, 2026-10-28 Lim 「물리가 무슨 뜻인지 모른다」)
    const b = debuffBrief(d), kind = [dispellable(d) ? d.type : '', d.stack ? `${d.stack}중첩` : ''].filter(Boolean).join(' ');
    const paren = [kind, Number.isFinite(d.left) ? `${Math.ceil(d.left)}초` : ''].filter(Boolean).join(', '); // 끝없는 깊은 상처 (어픽스)는 초 없이
    items.push(`${d.name}${paren ? ` (${paren})` : ''}${b ? ` · ${b}` : ''}`);
  }
  if (u.hot > 0) items.push(`소생 ${Math.ceil(u.hot)}초`);
  for (const h of u.hots) items.push(`${h.name} ${Math.ceil(h.left)}초 (남은 회복 ${Math.round(h.rest)})`);
  { const sh = shieldTimerOf(u, F.t); if (sh) items.push(`보호막 ${Math.ceil(sh.left)}초 (남은 흡수 ${Math.round(sh.amt).toLocaleString('ko-KR')})`); }
  if (F.beacon === u.id) items.push(`봉화: 다른 사람에게 한 빛의 손길의 ${Math.round(beaconShare(F) * 100)}%가 함께 들어감`);
  if (u.redu > 0 && !u.immune) items.push(`받는 피해 -${Math.round(u.reduCut * 100)}% ${Math.ceil(u.redu)}초`);
  if (u.sacr > 0) items.push(`희생 ${Math.ceil(u.sacr)}초 (받는 피해 30%를 내가 대신)`);
  if (u.immune > 0) items.push(`보호의 손 ${Math.ceil(u.immune)}초 (물리 피해 무시, 딜 멈춤)`);
  if (u.guardian > 0) items.push(`수호 영혼 ${Math.ceil(u.guardian)}초`);
  for (const d of F.relays) if (d.id === u.id) items.push(`빛의 전이 ${Math.max(0, Math.ceil(d.until - F.t))}초 (피해를 받으면 회복하고 옆 사람에게, 남은 회복 ${d.left}번)`);
  for (const z of F.zones) if (z.tide && z.cells.has(u.cell)) items.push(`어둠물에 잠김 ${Math.ceil(z.end - F.t)}초 (받는 치유 −50%)`); // 어둠물 밀물 (59 5장)
  for (const d of u.debuffs) if ((d.debtLeft ?? 0) > 0) items.push(`남은 빚 ${Math.round(d.debtLeft!)} (넘친 치유가 갚음, ${Math.ceil(d.left)}초 뒤 남은 빚만큼 피해)`); // 빌린 생명
  for (const d of u.debuffs) if (d.staunchLeft != null) items.push(`남은 봉합 ${Math.max(0, Math.round(d.staunchLeft))} (실제로 회복할수록 출혈이 줄어듦, ${Math.ceil(d.left)}초)`); // 봉합 상처 (113 6.2)
  for (const z of F.zones) if (z.ring && z.cells.has(u.cell)) items.push(`${z.ring.name} 안 ${Math.ceil(z.end - F.t)}초 (${z.ring.n < z.ring.max ? `치유를 받으면 한 겹 자람, ${z.ring.n}/${z.ring.max}겹` : `다 자람 ${z.ring.max}겹`})`); // 요정 고리 (48 5장)
  if (u.shield > 0) items.push(`보호 ${Math.ceil(u.shield)}초 (받는 피해 -40%)`);
  for (const g of F.glass) { const g0 = g.rec.get(u.id); if (g0 != null && u.alive) items.push(`${g.name} ${Math.ceil(g.until - F.t)}초 뒤 체력 ${Math.round(g0 * 100)}%로 돌아감 (금빛 선)`); } // 모래시계 (54 5장)
  if (F.melt && F.t < F.melt.until && u.alive) items.push(`${F.melt.name} ${Math.ceil(F.melt.until - F.t)}초: 보호막 · 외부 생존기가 빨리 녹음`); // 녹는 보호막 (51 5장)
  if (items.length) lines.push(`<div class="pv-effects pv-section"><span class="pv-label">현재 효과</span><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul></div>`);
  const html = lines.join('');
  if ($('preview').innerHTML !== html) $('preview').innerHTML = html;
}
/** 누른 칸 위쪽에 붙임 (#battle 기준). 위 공간이 모자라면 .brief로 여백을 줄이고, 그래도 모자라면 위 끝에 붙임 */
function placePreview(u: Unit): void {
  const el = $('preview'), bat = $('battle').getBoundingClientRect(), cv = $('board').getBoundingClientRect();
  // 화면 좌표 (레이드 판을 5인 던전 모양으로 줄여 그리면 판 그림 좌표 × L.k)
  const c = u.cell >= 0 ? screenCenter(u.cell) : { x: L.W * L.k / 2, y: L.H * L.k / 2 };
  const cx = cv.left - bat.left + c.x, cellTop = cv.top - bat.top + c.y - L.s * L.k * 0.93;
  const room = cellTop - PREVIEW_GAP - 4;
  el.classList.remove('brief');
  if (el.offsetHeight > room) el.classList.add('brief');
  const top = Math.max(4, cellTop - PREVIEW_GAP - el.offsetHeight);
  el.style.top = `${Math.round(top)}px`;
  const left = el.offsetLeft;
  el.style.setProperty('--ax', `${Math.round(Math.max(16, Math.min(el.offsetWidth - 16, cx - left)))}px`);
  el.classList.toggle('noarrow', top + el.offsetHeight > cellTop); // 칸을 덮을 만큼 길면 꼬리 없음
}

// ---------- 튜토리얼 안내 (02 11장, 09 4장): 전투를 잠깐 멈추고 할 일 하나를 짚어 줌 ----------
// when = 띄울 때, at = 짚을 칸(파티원), slot = 짚을 휠 스킬, need = 끝내는 스킬 (없으면 「확인」), freeze = false면 멈추지 않고 4초 뒤 사라짐
interface CoachStep { when(f: Fight): boolean; text: string | ((f: Fight) => string); at?(f: Fight): Unit | undefined; slot?: SkillKey; need?: string; swipe?: SkillKey; freeze?: boolean }
const tankOf = (f: Fight) => f.party.find(u => u.role === 'tank' && u.alive);
const lowest = (f: Fight) => f.party.filter(u => u.alive).reduce((a, b) => (b.hp / b.max < a.hp / a.max ? b : a));
const firstTel = (f: Fight, kind: string) => f.tels.find(t => t.kind === kind && f.t - t.start < 0.5);
const COACH: Record<string, CoachStep[]> = {
  duo: [
    { when: f => { const u = tankOf(f); return f.t >= 6 || (!!u && u.hp / u.max < 0.92); }, text: '탱커가 맞는 중. <b>탱커 칸을 탭</b>하면 치유', at: tankOf, need: 'heal' },
    { when: f => (f.stats.casts.heal || 0) >= 1 && f.t >= 5, freeze: false, text: '좋아! 아래 막대가 차면 힐이 들어감. 체력이 줄 때마다 다시 탭' },
  ],
  explore: [
    { when: f => f.t >= 1 && knows(f, 'renew'), text: () => `새로 배운 <b>소생</b>: <b>탱커 칸을 누른 채 ${arrowOf('renew')} 쪽으로 쓸기</b>. 휠에서 소생이 있는 방향 = 쓰는 방향`, at: tankOf, slot: 'renew', need: 'swipe:renew', swipe: 'renew' },
    { when: f => { const u = lowest(f); return u.hp / u.max < 0.5; }, text: () => `체력이 확 줄었음. <b>순간 치유</b>: 칸에서 ${arrowOf('flash')} 쪽으로 쓸기, 또는 휠에서 누르고 칸을 탭 (마나 두 배)`, at: lowest, slot: 'flash', need: 'flash', swipe: 'flash' },
    { when: f => !!firstTel(f, 'buster'), text: '<b>강타 예고</b>: 위에 뜬 기술이 끝나면 탱커가 크게 맞음. 미리 채워 두기' },
    { when: f => !!firstTel(f, 'aoe'), text: '<b>광역 예고</b>: 모두 맞음. 맞고 나면 가장 낮은 사람부터 채우기' },
  ],
};
const swipeEl = document.createElement('div');
swipeEl.id = 'swipeHint'; swipeEl.hidden = true;
const coachEl = document.createElement('div');
coachEl.id = 'coach'; coachEl.hidden = true;
$('boardWrap').append(swipeEl, coachEl);
coachEl.addEventListener('click', e => { if ((e.target as Element).closest('[data-coach-ok]')) clearCoach(); });

/** 칸 가운데에서 쓸 방향으로 움직이는 손가락 화살표 (판 좌표 그대로) */
function swipeArrowHtml(u: Unit, key: SkillKey): string {
  const d = DIRS.find(x => x && x.key === key);
  if (!d) return '';
  const c = screenCenter(u.cell), v = DIR_VEC[d.d], len = Math.max(44, L.s * L.k * 1.3);
  const ang = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  return `<div class="sw" style="left:${Math.round(c.x)}px;top:${Math.round(c.y)}px;width:${Math.round(len)}px;transform:rotate(${ang}deg)"><i></i></div>`;
}
export function coachCheck(): void {
  const F = fight(), R = S.run!;
  if (!S.coach || S.auto || ui.coach) return;
  const steps = COACH[S.coach] || [], done = R.coachDone;
  const i = steps.findIndex((st, k) => !done.has(k) && st.when(F));
  if (i < 0) return;
  done.add(i);
  const st = steps[i];
  const u = st.at ? st.at(F) : undefined;
  ui.coach = { uid: u ? u.id : null, freeze: st.freeze !== false, until: st.freeze === false ? performance.now() + 4000 : 0, need: st.need, slot: st.slot, swipe: st.swipe };
  const text = typeof st.text === 'function' ? st.text(F) : st.text;
  const hint = st.swipe && u ? swipeArrowHtml(u, st.swipe) : ''; // 쓸기 안내: 짚은 칸에서 쓸 방향으로 화살표
  coachEl.innerHTML = `<p>${text}</p>${st.need || st.freeze === false ? '' : '<button class="btn primary" type="button" data-coach-ok>확인</button>'}`;
  swipeEl.innerHTML = hint; swipeEl.hidden = !hint;
  coachEl.hidden = false;
  placeCoach(F, u);
  $('banner').classList.remove('show'); // 「전투 시작!」 같은 큰 띠는 거둠 (안내와 함께 짚은 칸 체력을 가렸음)
  if (st.slot) $('wheel').querySelector(`.slot[data-slot="${st.slot}"]`)?.classList.add('coach-hi');
  Snd.play('tick'); vibe(15);
}
/**
 * 안내창 높이: 짚은 칸은 절대 가리지 않고, 그다음 내 칸 · 다른 파티원 칸을 가장 덜 가리는 자리 (같으면 아래쪽).
 * 예전엔 위 · 아래 둘 중 하나라 2 · 3인 판에서 내 칸 (체력)을 늘 가렸음
 */
function placeCoach(F: Fight, u: Unit | undefined): void {
  const wrapH = $('boardWrap').clientHeight, h = coachEl.offsetHeight, pad = 10, r = L.s * L.k * 0.95;
  const cells = F.party.map(p => ({ y: screenCenter(p.cell).y, w: u && p.id === u.id ? 1000 : p.me ? 4 : 1 }));
  let best = Math.max(pad, wrapH - pad - h), bestScore = Infinity;
  for (let top = Math.max(pad, wrapH - pad - h); top >= pad; top -= 4) {
    // 가린 높이 × 무게 + 아래에서 멀수록 조금 (같으면 아래쪽)
    const score = cells.reduce((sum, c) => sum + c.w * Math.max(0, Math.min(top + h, c.y + r) - Math.max(top, c.y - r)), 0) + (wrapH - pad - h - top) * 0.01;
    if (score < bestScore - 1e-6) { bestScore = score; best = top; }
  }
  coachEl.style.top = `${Math.round(best)}px`; coachEl.style.bottom = 'auto';
}
export function clearCoach(): void {
  ui.coach = null; coachEl.hidden = true; swipeEl.hidden = true; swipeEl.innerHTML = '';
  $('wheel').querySelectorAll('.coach-hi').forEach(el => el.classList.remove('coach-hi'));
}
/** 안내가 바란 스킬을 쓰면 다음으로 */
export function coachUsed(key: string): void { if (ui.coach && ui.coach.need && ui.coach.need === key) clearCoach(); }
