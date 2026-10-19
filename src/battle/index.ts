/**
 * 전투 화면 (P1 새 전투 화면, 21 계획). 프로토타입 v11 화면을 TypeScript로 옮기고 판은 PixiJS로 그림.
 * 메뉴·정산은 새 화면(src/screens)이 맡고, 여기는 전투·휴식·일시정지만. 새 화면은 window.__battle로 부름.
 */
import { deedOf } from '../data/guild';
import type { DiffName } from '../data/difficulty';
import { ENCOUNTERS, type EncounterKey } from '../data/encounters';
import { HERO_KEYS, HEROES, type HeroKey } from '../data/heroes';
import { PASSIVE_LEVEL, PASSIVE_NAME, SKILL_LEVEL, SKILLS, type SkillKey } from '../data/skills';
import { TALENT_DEF, type TalentKey } from '../data/talents';
import { AFFIXES } from '../data/affixes';
import { ABILITIES } from '../data/abilities';
import { artPlaces, ENCOUNTER_PLACE, floorArtName, PLACES, sceneArtName } from '../data/places';
import { art, cssUrl } from '../art';
import { autoHealer, create, DT, hexDist, knowsPassive, restCarry, setBeacon, skillUsesSpent, slotKey, step, talentReady, talentUsesSpent, use, useTalent, type Fight, type FightStats } from '../engine';
import { addMeter, meterHtml } from '../game/meter';
import type { BattleResult } from '../game/settle';
import { bossSvg, ratsArt } from './art';
import { addBubble, boardRenderer, bossPxfLoaded, fxAbility, fxNote, fxAllyHeal, fxCure, fxDamage, fxDeath, fxDebuff, fxDispel, fxGim, fxHeal, fxPxf, fxPxfCell, fxImpact, fxRevive, fxShake, fxShield, fxSpec, hit, initBoard, L, lensAt, pxfReady, render, resetBoardFx, resizeBoard, screenCenter, setBoardFaction, type BubbleKind } from './board';
import {
  $, applyLayout, ARROW, B, banner, DEFAULT_LAYOUT, dirSlot, GRID, LAYOUT_SKILLS, layoutCode, layoutLabel, layoutText, mmss, READ_ORDER, S, show, Snd,
  swipeDir, TAP_KEYS, tapKey, tapKeysOf, toast, clearToasts, ui, validLayout, vibe, type Pointer, type Run, type StartOptions,
} from './core';
import { guideHtml, guideModel } from './guide';
import { initBattleDialogs } from './dialogs';
import { createTalk } from './talk';
import { ALLY_PXF, BOSS_PXF, bossPxfOf, COMMON_PXF, PXF, pxfTargets, SKILL_PXF, type PxfKey } from './pxf';
import {
  bossFx, bossHealNum, fitBossTitle, LOCK_SVG, updateBossTitle, buildAux, buildGauges, buildStage, buildWheel, clearCoach, closeTip, coachCheck, coachUsed, dmgNum, missNum, guideOf, openSkillTip, openTalentTip, openTip, releaseTip, showPreview, hidePreview, keepPreview, previewKept, updatePreview, tipMatch,
  placeGiveUp, resetDmgNums, updateAux, updateCastbar, updateStage, updateWheel,
} from './hud';

const seed = () => (Math.random() * 1e9) | 0;
/** 파티원 말풍선 감독 (41) */
const talk = createTalk();
const curKey = () => S.run!.segs[S.run!.idx] as EncounterKey;
/** 처음부터 다시 (같은 파티, 같은 콘텐츠) */
function resetRun(): void {
  Object.assign(S.run!, { idx: 0, carry: null, time: 0, deaths: 0, restSec: 0, healed: 0, overheal: 0, dispels: 0, dispellable: 0, auto: S.auto, meter: [], cont: 0, partyStats: {} });
}

// ---------- 전투 시작 ----------
/**
 * guideSec: 이번 판 직전에 공략·휴식 화면을 본 시간 (처음부터 다시는 0).
 * 던전은 같은 파티로 구간을 이어 감. 마나·성언 게이지는 앞 구간(+휴식)에서 이어받고, 재사용 대기는 구간마다 새로 (23 4장).
 * 첫 판은 편성 화면 미리보기와 같은 시드 (시작 위치가 같게). 처음부터 다시·다음 구간은 새 시드
 */
function startBattle(guideSec = 0): void {
  dialogs.closeAll();
  setPauseInert(false);
  const R = S.run!;
  const sd = R.seed0 != null ? R.seed0 : seed(); R.seed0 = null;
  const F = create({
    encounter: curKey(), diff: S.diff as DiffName, gearStats: S.gearStats || undefined, seed: sd, party: S.party || undefined,
    carry: R.carry || undefined, level: S.level, heroLv: S.heroLv, stageLv: S.stageLv, hero: S.hero, talents: S.talents, specs: S.specs,
    affixes: S.affixes, bossMult: S.bossMult,
  });
  B.F = F;
  ui.talArmed = null; slotPress = null; auxPress = null;
  buildAux();
  // 전투 시작 카운트다운 3초 (19 4장 6번). 자동 힐러 구경은 바로 시작
  ui.pullLeft = S.auto ? 0 : 3; ui.pullShown = null;
  $('pull').hidden = !(ui.pullLeft > 0);
  talk.start(F, { seg: R.idx, segN: R.segs.length, cont: R.cont || 0, affix: !!S.affixes?.length, chal: !!S.chal, guildFirst: S.guildFirst }, performance.now());
  B.armed = null; B.paused = false; B.overShown = false; B.beacon = false; B.coreCell = false;
  Object.assign(ui, {
    guideSec, skillTips: 0, lowFlags: {}, tickSec: null, busterHint: false, swipes: {}, swipeCancel: 0, swipeEmpty: 0,
    vibedTel: new Set(), debSnd: {}, tapOff: [], lastTap: null, retarget: 0, pointer: null, selectedUnitId: null,
  });
  closeTip(); resetBoardFx(); resetDmgNums();
  const lag = $('bossLag'); lag.style.transition = 'none'; lag.style.width = '100%'; void lag.offsetWidth; lag.style.transition = '';
  $('controls').classList.toggle('wheel-left', S.hand === 'left');
  $('pause').hidden = true; hidePreview(); clearToasts();
  $('giveUp').hidden = true; $('stage').classList.remove('give-up');
  $('battle').classList.remove('over-win', 'over-lose'); $('banner').classList.remove('show');
  clearCoach();
  $('bossArt').innerHTML = bossSvg(F.enc.script, F.enc.key);
  // 인터미션 쥐떼 작은 그림 (29: mob-crypt-rats가 있을 때만)
  const adds = $('bossAdds') as HTMLImageElement; adds.hidden = true;
  if (F.enc.script === 'plague' && ratsArt()) adds.src = ratsArt(); else adds.removeAttribute('src');
  updateBossTitle();
  // 위치 줄은 「장소 · 난이도」만 (2026-10-16 Lim, hud.ts updateStage): 앞의 적 무리 이름은 비움
  $('encounterLabel').textContent = '';
  buildStage();
  $('battle').classList.toggle('compact', !!F.enc.big);
  setPlace(F.enc.key);
  show('battle');
  if (S.auto) toast('자동 힐러가 플레이 중 (기록 안 남김)');
  else if (R.idx === 0) toast(`칸을 탭하면 ${SKILLS[tapKey()].name}`);
  // 어픽스는 첫 구간 시작에 한 번 알림 (07 3장, 13 3-3)
  if (S.affixes && !R.idx && !R.cont) toast(`어픽스 ${S.affixes.map(k => AFFIXES[k].name).join(' · ')}`);
  // 사제 성언 게이지는 Lv 6부터. 다른 직업은 고유 시스템 글자·링을 처음부터 (25 7장)
  const words = F.hero !== 'priest' || knowsPassive(F, 'words');
  buildGauges(F);
  $('gauges').classList.toggle('locked', !words);
  $('controls').classList.toggle('nowords', !words);
  // 레벨이 모자라 잠긴 자원 그림도 어둡게 보이고 자물쇠 + 배우는 레벨 (2026-10-16 Lim, 휠의 잠긴 칸과 같은 표시)
  if (!words) $('gauges').insertAdjacentHTML('beforeend', `<span class="gauge-lock" role="img" aria-label="${PASSIVE_NAME.words} 잠김, Lv ${PASSIVE_LEVEL.words}에 배움"><span class="slot-lock" aria-hidden="true">${LOCK_SVG}</span><b>Lv ${PASSIVE_LEVEL.words}</b></span>`);
  $('controls').classList.toggle('paladin', F.hero === 'paladin');
  // 최종 고유 게이지와 잠금 상태가 정해진 뒤 한 번만 크기·터치 영역을 측정한다.
  layoutBattle();
}

/** 장소 그림 (28 2-3장): 진형 판 뒤 바닥, 보스 무대 뒤 풍경 (없으면 바닥) */
function setPlace(enc: EncounterKey): void {
  const place = ENCOUNTER_PLACE[enc] || 'rustfort', el = $('battle');
  // 새 장소는 그림이 올 때까지 같은 세력 장소 그림 (places.ts borrow)
  const ps = artPlaces(place), floor = ps.map(p => art(floorArtName(p))).find(Boolean) ?? '', scene = ps.map(p => art(sceneArtName(p))).find(Boolean) ?? '';
  el.dataset.place = place;
  setBoardFaction(PLACES[place].faction);
  el.style.setProperty('--floor', cssUrl(floor));
  el.style.setProperty('--stage-art', cssUrl(scene || floor));
  el.style.setProperty('--tone-a', PLACES[place].tone[0]);
  el.style.setProperty('--tone-b', PLACES[place].tone[1]);
  el.classList.toggle('has-floor', !!floor);
  el.classList.toggle('has-scene', !!scene);
}

function layoutBattle(): void {
  endSlot(true); endAux(true); endPointer(true);
  const F = B.F!, app = $('app');
  const H = app.clientHeight, W = app.clientWidth;
  const short = H < 630;
  $('battle').classList.toggle('short-battle', short);
  // 시안 20인 크기의 작은 보스 무대 (166): 10·20인 진형 판, 또는 높이가 모자란 화면
  $('battle').classList.toggle('stage-sm', !!F.enc.big || F.party.length >= 10 || H < 720);
  // 보스 무대 높이는 시안대로 내용이 정함 (5인 186 · 20인 166, 낮은 화면은 hud27.css에서 줄임)
  $('stage').style.minHeight = '';
  // 아이템 한 줄과 하단 장식 여백을 확보하고 남는 높이를 자원 그림에 배분한다.
  const controls = $('controls');
  controls.classList.add('compact-controls');
  $('battle').classList.add('compact-panel');
  controls.classList.toggle('paladin', F.hero === 'paladin');
  controls.classList.toggle('wheel-left', S.hand === 'left');
  // 채택 B안: 직업·보조 특성과 무관하게 자원·아이템·휠의 좌표를 유지한다.
  const ch = 229;
  // 특성 버튼은 왼쪽 묶음 안 예전 소비 아이템 자리 (2026-10-16 Lim, class-controls.css). 조작판 · 전투판 크기와 휠 좌표는 특성과 관계없이 그대로
  // 360px는 첨부 빨간 선의 중심(패널 폭 약24%)에 정렬하고, 390px는 별도 우측 보정을 유지한다.
  const resourceShift = Math.max(0, Math.min(10.1, (W - 320) * 10.1 / 40)) + Math.max(0, Math.min(13.9, (W - 360) * 13.9 / 30));
  controls.style.setProperty('--resource-inset', `${27.6 + resourceShift}px`);
  controls.style.setProperty('--wheel-inset', `${17 + Math.max(0, Math.min(12, (W - 360) * .4))}px`);
  $('wheel').setAttribute('aria-label', '치유 스킬 휠');
  controls.style.setProperty('--controls-scale', '1');
  $('controls').style.height = ch + 'px';
  // 사제 B안 휠 크기를 모든 직업과 보조 특성 조합에 공통 적용한다.
  const narrow = W < 360, sideWidth = narrow ? 120 : 96;
  buildWheel(Math.min(ch - 28, W * .565 + 10, W - sideWidth - (narrow ? 22 : 26)));
  // 시전 여부와 관계없이 판과 조작판 사이의 독립 행을 예약한다.
  $('controlsFrame').before($('castbar'));
  // 일시정지 중 부모가 바뀌어도 이전 직계 자식의 inert가 남지 않게 한다.
  $('castbar').inert = false;
  setPauseInert(!$('pause').hidden);
  if (F.hero === 'paladin') {
    $('core').setAttribute('role', 'button'); $('core').tabIndex = 0;
    $('core').setAttribute('aria-label', '마나 · 봉화 지정');
  } else if (HEROES[F.hero].core) { // 가운데 스킬 (79 6-1: 주술사 샘 토템 · 결계사 심판). 모양은 Codex 몫 (79 7장 2번), 지금은 봉화와 같은 자리 · 같은 강조
    const k = HEROES[F.hero].core!;
    $('core').setAttribute('role', 'button'); $('core').tabIndex = 0;
    $('core').setAttribute('aria-label', `마나 · ${SKILLS[k].name}`);
  }
  scaleControls();
  // 휠을 다시 만든 직후에도 장전·비활성 상태와 접근성 표시를 유지한다.
  updateWheel();
  fitBossTitle();
  placeGiveUp();
  resizeBoard();
}
/** 작은 패널의 버튼은 90%부터 축소하고 가로 공간은 끝까지 쓴다. 터치 44px과 간격 1px을 보장한다. */
function scaleControls(): void {
  const controls = $('controls'), frame = $('controlsFrame');
  let scale = 0.9;
  const measure = () => Array.from(controls.querySelectorAll<HTMLElement>('button, #core[role="button"]'))
    .map(el => ({ el, rect: el.getBoundingClientRect() }))
    .filter(({ el, rect }) => rect.width > 0 && rect.height > 0 && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden');
  const overlap = (targets: ReturnType<typeof measure>, gap = 0) => targets.some(({ rect: a }, i) =>
    targets.slice(i + 1).some(({ rect: b }) =>
      Math.abs(a.left + a.width / 2 - b.left - b.width / 2) < (Math.max(44, a.width) + Math.max(44, b.width)) / 2 + gap - .01
      && Math.abs(a.top + a.height / 2 - b.top - b.height / 2) < (Math.max(44, a.height) + Math.max(44, b.height)) / 2 + gap - .01));
  let targets: ReturnType<typeof measure>;
  do {
    controls.style.setProperty('--controls-scale', String(scale));
    controls.style.setProperty('--touch-min', `${44 / scale}px`);
    controls.style.width = `${frame.clientWidth / scale}px`;
    targets = measure();
    if (!overlap(targets, 1) || scale >= 1) break;
    scale = Math.min(1, +(scale + .005).toFixed(3));
  } while (true);
  frame.style.height = `${controls.offsetHeight * scale}px`;
  const visualMin = targets.length ? Math.min(...targets.flatMap(({ rect }) => [rect.width, rect.height])) : 0;
  for (const { el, rect } of targets) {
    el.dataset.hitWidth = String(Math.max(44, rect.width));
    el.dataset.hitHeight = String(Math.max(44, rect.height));
  }
  Object.assign(controls.dataset, { uiScale: String(scale), baseControlHeight: String(controls.offsetHeight), visualTouchMin: visualMin.toFixed(3),
    effectiveTouchMin: Math.max(44, visualMin).toFixed(3), hitAreasOverlap: String(overlap(targets)) });
}
new ResizeObserver(() => { if (B.F && !$('battle').hidden) resizeBoard(); }).observe($('boardWrap'));
window.addEventListener('resize', () => { if (B.F && !$('battle').hidden) layoutBattle(); });
document.fonts.ready.then(fitBossTitle);
document.fonts.addEventListener('loadingdone', fitBossTitle);

// ---------- 스킬 휠: 짧게 누르기 = 장전(또는 바로 사용), 잠긴 칸은 배우는 레벨 안내. 길게 누르기 = 스킬 설명 ----------
interface Press { id: number; el: HTMLElement; lp: boolean; timer?: ReturnType<typeof setTimeout> }
let slotPress: (Press & { slot: string | null; lock: SkillKey | null; core: boolean }) | null = null;
let auxPress: (Press & { key: TalentKey }) | null = null;
const live = () => !!B.F && !B.F.over && !B.paused;
// 판과 조작 버튼 사이에서도 먼저 누른 포인터만 입력을 소유한다.
const pointerBusy = () => !!(slotPress || auxPress || ui.pointer);
const ownsPress = (p: { id?: number } | null, e?: PointerEvent) => !!p && (!e || p.id === e.pointerId);
const outsidePress = (p: Press, e: PointerEvent) => {
  const r = p.el.getBoundingClientRect();
  const w = Math.max(r.width, Number(p.el.dataset.hitWidth) || 0), h = Math.max(r.height, Number(p.el.dataset.hitHeight) || 0);
  const dx = (w - r.width) / 2, dy = (h - r.height) / 2;
  return e.clientX < r.left - dx || e.clientX > r.right + dx || e.clientY < r.top - dy || e.clientY > r.bottom + dy;
};

$('wheel').addEventListener('pointerdown', ev => {
  const el = (ev.target as Element).closest<HTMLElement>('.slot[data-slot], .slot[data-lock], #core');
  if (!el) return;
  ev.preventDefault();
  if (!live() || ui.pullLeft > 0 || pointerBusy() || ev.button !== 0) return;
  try { el.setPointerCapture(ev.pointerId); } catch { /* 무시 */ }
  const P: typeof slotPress = { id: ev.pointerId, el, slot: el.dataset.slot || null, lock: (el.dataset.lock as SkillKey) || null, core: el.id === 'core', lp: false };
  if (!P.core) P.timer = setTimeout(() => {
    if (slotPress !== P || !B.F) return;
    P.lp = true; openSkillTip(P.slot ? slotKey(B.F, P.slot) : P.lock!, el); vibe(10);
  }, 450);
  slotPress = P;
});
function endSlot(cancelled: boolean, e?: PointerEvent): void {
  if (!ownsPress(slotPress, e)) return;
  const P = slotPress; slotPress = null;
  if (!P) return;
  clearTimeout(P.timer);
  if (P.lp) releaseTip();
  if (P.lp || cancelled || !live()) return;
  if (P.core) { pressCore(); return; }
  if (P.lock) { toast(`${SKILLS[P.lock].name}: Lv ${SKILL_LEVEL[P.lock]}에 배움`); Snd.play('error'); return; }
  pressSlot(P.slot!);
}
$('wheel').addEventListener('pointermove', e => { if (slotPress && ownsPress(slotPress, e) && outsidePress(slotPress, e)) endSlot(true, e); });
$('wheel').addEventListener('pointerup', e => endSlot(false, e));
$('wheel').addEventListener('pointercancel', e => endSlot(true, e));
$('wheel').addEventListener('lostpointercapture', e => endSlot(true, e));
$('wheel').addEventListener('contextmenu', e => e.preventDefault());

/**
 * 휠 가운데: 성기사는 봉화 지정 (누르고 칸 탭, 25 3장). 가운데 스킬이 있는 직업 (79 6-1)은 그 스킬:
 * 칸을 고르는 스킬 (주술사 샘 토템)은 누르고 칸 탭, 대상 없는 스킬 (결계사 심판)은 바로. 다른 직업은 아무 일 없음
 */
function pressCore(): void {
  const F = B.F;
  if (!F || !live() || ui.pullLeft > 0) return;
  const core = HEROES[F.hero].core;
  if (core) {
    const sk = SKILLS[core];
    if (F.level < SKILL_LEVEL[core]) { toast(`${sk.name}: Lv ${SKILL_LEVEL[core]}에 배움`); Snd.play('error'); return; }
    if ((F.cd[core] ?? 0) > 0) { toast(`${sk.name} 재사용 대기 ${Math.ceil(F.cd[core]!)}초`); Snd.play('error'); return; }
    B.armed = null; ui.talArmed = null; B.beacon = false;
    if (sk.target === 'cell') { B.coreCell = !B.coreCell; if (B.coreCell) toast(`${sk.name}: 세울 칸 선택`); vibe(8); return; }
    doUse(core, 0);
    return;
  }
  if (F.hero !== 'paladin') return;
  const lv = HEROES.paladin.system.lv;
  if (F.level < lv) { toast(`봉화: Lv ${lv}에 배움`); Snd.play('error'); return; }
  if (F.beaconCd > 0) { toast(`봉화 바꾸기 대기 ${Math.ceil(F.beaconCd)}초`); Snd.play('error'); return; }
  B.beacon = !B.beacon; B.armed = null; ui.talArmed = null;
  if (B.beacon) toast('봉화: 지킬 파티원 칸 선택');
  vibe(8);
}

function pressSlot(slot: string): void {
  const F = B.F;
  if (!F || !live() || ui.pullLeft > 0) return;
  const key = slotKey(F, slot);
  if (skillUsesSpent(F, key)) return;
  ui.talArmed = null; B.beacon = false; B.coreCell = false;
  // 대상 없는 스킬 · 되살리기 (환생: 탱커 먼저, 엔진 reviveTarget)는 누르면 바로 (2026-10-19 Lim 「버튼을 클릭하면 대상지정없이 살릴수 있게」)
  if (SKILLS[key].target === 'none' || SKILLS[key].target === 'dead') { doUse(key, 0); return; }
  B.armed = B.armed === slot ? null : slot;
  vibe(8);
}

// ---------- 특성 버튼 (소비 아이템 자리, 2026-10-16): 누르기 = 바로 (쉼터 등 칸 특성은 장전 → 칸 탭), 길게 누르기 = 설명 ----------
$('aux').addEventListener('pointerdown', e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-tal]');
  if (!b || !live() || ui.pullLeft > 0 || pointerBusy() || e.button !== 0) return;
  e.preventDefault();
  try { b.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  const P: NonNullable<typeof auxPress> = { id: e.pointerId, el: b, key: b.dataset.tal as TalentKey, lp: false };
  P.timer = setTimeout(() => { if (auxPress === P) { P.lp = true; openTalentTip(P.key, b); vibe(10); } }, 450);
  auxPress = P;
});
function endAux(cancelled: boolean, e?: PointerEvent): void {
  if (!ownsPress(auxPress, e)) return;
  const P = auxPress; auxPress = null;
  if (!P) return;
  clearTimeout(P.timer);
  if (P.lp) releaseTip();
  if (P.lp || cancelled || !live()) return;
  pressAux(P.key);
}
$('aux').addEventListener('pointermove', e => { if (auxPress && ownsPress(auxPress, e) && outsidePress(auxPress, e)) endAux(true, e); });
$('aux').addEventListener('pointerup', e => endAux(false, e));
$('aux').addEventListener('pointercancel', e => endAux(true, e));
$('aux').addEventListener('lostpointercapture', e => endAux(true, e));
$('aux').addEventListener('contextmenu', e => e.preventDefault());

// 키보드/보조 기술이 만드는 click은 pointer 경로와 한 번만 실행한다.
function assistiveClick(e: MouseEvent): boolean {
  const capabilities = (e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities;
  return e.detail === 0 && !('pointerType' in e && e.pointerType) && !capabilities?.firesTouchEvents;
}
$('wheel').addEventListener('click', e => {
  if (!assistiveClick(e) || !live() || ui.pullLeft > 0 || pointerBusy()) return;
  const el = (e.target as Element).closest<HTMLElement>('[data-slot],[data-lock],#core');
  if (!el) return;
  if (el.id === 'core') { pressCore(); return; }
  if (el.dataset.lock) { const k = el.dataset.lock as SkillKey; toast(`${SKILLS[k].name}: Lv ${SKILL_LEVEL[k]}에 배움`); return; }
  if (el.dataset.slot) pressSlot(el.dataset.slot);
});
$('wheel').addEventListener('keydown', e => {
  if ((e.target as HTMLElement).id === 'core' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (!pointerBusy()) pressCore(); }
});
$('aux').addEventListener('click', e => {
  const key = (e.target as Element).closest<HTMLElement>('[data-tal]')?.dataset.tal as TalentKey | undefined;
  if (assistiveClick(e) && key && live() && ui.pullLeft <= 0 && !pointerBusy()) pressAux(key);
});

function pressAux(key: TalentKey): void {
  const F = B.F!, def = TALENT_DEF[key];
  if (talentUsesSpent(F, key)) return;
  if (def.active!.cell) {
    const r = talentReady(F, key);
    if (!r.ok) { if (r.reason) toast(r.reason); Snd.play('error'); return; }
    ui.talArmed = ui.talArmed === key ? null : key; B.armed = null; B.beacon = false; B.coreCell = false;
    if (ui.talArmed) toast(`${def.name}: 빈 칸 선택`);
    vibe(8); return;
  }
  const res = useTalent(F, key);
  if (!res.ok) { if (res.reason) toast(res.reason); Snd.play('error'); return; }
  vibe(12);
}

// ---------- 보스 기술 예고 칸: 누르면 설명 팝업 ----------
$('queue').addEventListener('pointerdown', e => {
  if (!live()) return;
  const q = (e.target as Element).closest<HTMLElement>('.q');
  if (!q || !q.dataset.ic) { closeTip(); return; }
  if (tipMatch(q.dataset.ic, +q.dataset.imp!)) closeTip(); // 같은 칸을 다시 누르면 닫힘, 다른 칸이면 그 칸으로 옮김
  else openTip(q.dataset.ic, q);
});
$('queue').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const q = (e.target as Element).closest<HTMLElement>('.q');
  if (!live() || !q?.dataset.ic) return;
  e.preventDefault();
  if (tipMatch(q.dataset.ic, +q.dataset.imp!)) closeTip();
  else openTip(q.dataset.ic, q);
});
document.addEventListener('pointerdown', e => {
  if (ui.tip && !$('queue').contains(e.target as Node)) closeTip();
  if (previewKept()) hidePreview(); // 손을 뗀 뒤 남아 있던 파티원 상세창: 다음 터치에 닫고, 그 터치는 평소대로
}, true);

// ---------- 판 입력: 탭 = 기본 힐, 칸에서 8방향 쓸기 = 그 방향 스킬, 길게 누르기 = 정보 ----------
const cv = $('board') as HTMLCanvasElement;
function pt(e: PointerEvent) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
/**
 * 스킬을 걸 수 있는 칸: 파티원 또는 헤매는 영혼 (P-SOUL). 칸에 세우는 스킬 (주술사 샘 · 대지 토템)은 빈 칸도 (2026-10-16 Lim).
 * 대상 없는 스킬 (비구름 토템 · 공대 쿨기 · 차 한 잔 · 심판 등)도 빈 칸에서 쓸어 쓸 수 있음 (2026-10-18 Lim 「비구름도 빈칸에서 스와이프되게」, 효과는 칸과 상관없음).
 * 되살리기 (드루이드 환생, target 'dead')도 어느 칸에서나: 쓰러지면 칸이 비어 쓰러진 칸 · 빈 칸에서 쓸면 막혔음. 대상은 엔진이 탱커 먼저 고름 (reviveTarget)
 * (2026-10-19 Lim 「빈곳이든 파티원 칸이든 환생쪽으로 스와이프 하면 탱커 우선하여 살릴수 있게」)
 */
const ANY_CELL: ReadonlySet<string> = new Set(['cell', 'none', 'dead']);
const aimable = (F: Fight, idx: number, key?: SkillKey | null): boolean => (!!key && ANY_CELL.has(SKILLS[key].target) && !!F.cells[idx]) || !!F.cells[idx]?.unit || F.cells[idx]?.block === 'soul';
/** 쓸기 방향의 휠 스킬 */
const dirKey = (F: Fight, d: ReturnType<typeof swipeDir>): SkillKey | null => { const it = d ? dirSlot(d) : null; return it && it.key ? slotKey(F, it.key) : null; };
function doUse(key: SkillKey, idx: number): boolean {
  const F = B.F!;
  if (skillUsesSpent(F, key)) return false;
  const res = use(F, key, idx);
  if (F.cells[idx]?.unit) ui.selectedUnitId = F.cells[idx].unit!.id;
  if (!res.ok) { if (res.reason) toast(res.reason); Snd.play('error'); return false; }
  if (B.armed && slotKey(F, B.armed) === key) B.armed = null;
  if (B.armed && key === 'serenity') B.armed = null;
  if (SKILLS[key].cast > 0 && !res.queued && !res.same) Snd.play('cast');
  coachUsed(key);
  return true;
}
cv.addEventListener('pointerdown', e => {
  const F = B.F;
  if (!F || !live() || ui.pullLeft > 0 || pointerBusy() || e.button !== 0) return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  const p = pt(e);
  if (e.pointerType === 'touch') ui.touchSeen = true;
  const P: Pointer = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, idx: hit(p.x, p.y), lp: false, moved: false };
  const areaArmed = !!B.armed && SKILLS[slotKey(F, B.armed)].target === 'area';
  // 광역 장전 중에는 누른 채 범위를 보는 것이 기본 동작이라 길게 누르기 정보를 끔 (02 4-1 6번)
  if (!areaArmed) P.timer = setTimeout(() => {
    if (ui.pointer === P && !P.moved && P.idx >= 0 && B.F && B.F.cells[P.idx].unit) { P.lp = true; showPreview(P.idx); }
  }, 450);
  ui.pointer = P;
});
cv.addEventListener('pointermove', e => {
  const P = ui.pointer, F = B.F;
  if (!P || !F || !ownsPress(P, e)) return;
  const p = pt(e); P.x = p.x; P.y = p.y;
  if (Math.hypot(P.x - P.x0, P.y - P.y0) > 12) { P.moved = true; clearTimeout(P.timer); }
  // 장전한 스킬이 없을 때, 파티원 칸에서 시작한 쓸기는 방향 스킬 (쓰는 동안 휠과 칸에 미리 보여줌)
  const sd = !B.armed && P.idx >= 0 ? swipeDir(P.x - P.x0, P.y - P.y0) : null;
  const nd = sd && aimable(F, P.idx, dirKey(F, sd)) ? sd : null;
  if (nd !== P.dir) { P.dir = nd; if (nd) vibe(5); }
});
function endPointer(cancelled: boolean, e?: PointerEvent): void {
  if (!ownsPress(ui.pointer, e)) return;
  const P = ui.pointer; ui.pointer = null;
  if (!P) return;
  clearTimeout(P.timer);
  if (P.lp) { keepPreview(); return; } // 손을 떼도 상세창은 잠깐 남음 (다음 터치에 닫힘)
  const F = B.F;
  if (cancelled || !F || !live()) return;
  if (F.cells[P.idx]?.unit) ui.selectedUnitId = F.cells[P.idx].unit!.id;
  F.stats.taps++;
  if (B.coreCell) { // 가운데 스킬을 칸에 (샘 토템): 칸 탭 = 그 칸 (사람이 서 있어도 됨)
    B.coreCell = false;
    const core = HEROES[F.hero].core;
    if (P.idx < 0 || !core) { F.stats.emptyTaps++; return; }
    const res = use(F, core, P.idx);
    if (!res.ok) { if (res.reason) toast(res.reason); Snd.play('error'); return; }
    vibe(12); return;
  }
  if (B.beacon) { // 봉화 지정 중: 칸 탭 = 그 파티원
    const u = P.idx >= 0 ? F.cells[P.idx].unit : null;
    if (!u || !u.alive) { F.stats.emptyTaps++; return; }
    B.beacon = false;
    if (!setBeacon(F, u)) { Snd.play('error'); return; }
    Snd.play('chime'); vibe(12); return;
  }
  if (ui.talArmed) { // 쉼터 장전 중: 빈 칸 탭
    if (P.idx < 0) { F.stats.emptyTaps++; return; }
    const res = useTalent(F, ui.talArmed, P.idx);
    if (!res.ok) { if (res.reason) toast(res.reason); Snd.play('error'); return; }
    ui.talArmed = null; vibe(12); return;
  }
  const dx = P.x - P.x0, dy = P.y - P.y0;
  const key = B.armed ? slotKey(F, B.armed) : tapKey();
  const area = SKILLS[key].target === 'area';
  if (!B.armed && P.moved) {
    const d = swipeDir(dx, dy), it = d ? dirSlot(d) : null;
    if (!d) { ui.swipeCancel++; return; } // 쓸다가 제자리로 돌아오면 취소
    if (P.idx < 0 || !aimable(F, P.idx, dirKey(F, d))) { F.stats.missTaps++; return; }
    if (!it || !it.key) { toast('이 방향은 비어 있음'); ui.swipeEmpty++; return; }
    ui.swipes[d] = (ui.swipes[d] || 0) + 1;
    const sk = slotKey(F, it.key);
    if (doUse(sk, P.idx)) { vibe(8); coachUsed('swipe:' + sk); }
    return;
  }
  if (!area && P.moved && Math.hypot(dx, dy) > 30) return;
  const idx = area ? hit(P.x, P.y) : P.idx;
  if (idx < 0) { F.stats.missTaps++; return; }
  if (!aimable(F, idx, key)) { F.stats.emptyTaps++; return; }
  // 터치 정확도: 칸 중심에서 떨어진 정도(칸 크기 대비), 0.7초 안에 옆 칸으로 다시 지정 = 오탭 추정
  const c = screenCenter(idx), nowT = performance.now();
  ui.tapOff.push(Math.hypot(P.x - c.x, P.y - c.y) / (L.s * L.k));
  if (ui.lastTap && ui.lastTap.idx !== idx && nowT - ui.lastTap.t < 700 && hexDist(F.cells[ui.lastTap.idx], F.cells[idx]) === 1) ui.retarget++;
  ui.lastTap = { idx, t: nowT };
  if (F.enc.big && S.zoom) lensAt(idx, nowT);
  if (doUse(key, idx)) vibe(8);
}
cv.addEventListener('pointerup', e => endPointer(false, e));
cv.addEventListener('pointercancel', e => endPointer(true, e));
cv.addEventListener('lostpointercapture', e => endPointer(true, e));
cv.addEventListener('contextmenu', e => e.preventDefault());

// ---------- 전투 사건 → 소리·진동·알림·판 효과 ----------
/** 연쇄 치유가 다음 사람에게 튀어 보이는 간격 (ms): 이펙트에서 물줄기가 닿는 데 4장 (0.17초) */
const CHAIN_STEP_MS = 160;
function handleEvents(now: number): void {
  const F = B.F!;
  let healSnd = false, critSnd = false;
  // 스킬 PXF 이펙트 (battle/pxf.ts): 들어간 휠 스킬마다 대상 · 범위 · 파티 칸에. 그 칸의 이번 치유는 치유 빛 없이
  const plain = new Set<number>();
  // 연쇄 치유 (Lim 2026-10-16 「연쇄는 순차적으로 발동되게, 지금은 이펙트가 동시에 나온다」): 엔진은 한 틱에 모두 회복하지만
  // 판에서는 튄 순서대로 (첫 대상 → 튄 사람) CHAIN_STEP_MS씩 늦춰 이펙트 · 치유 숫자가 하나씩 이어서 터지게.
  // 물줄기는 앞 사람 (첫 대상은 나) 쪽에서 들어오게 돌려 그림 (이펙트 그림은 왼쪽에서 들어옴)
  const later = new Map<number, number>();
  let chained = 0, chainFrom: number = F.me.cell;
  for (const { key, uid, cell } of F.used?.splice(0) ?? []) {
    const fx = SKILL_PXF[key]?.fx;
    if (fx && cell != null) { fxPxfCell(cell, fx, now); continue; } // 사람 없는 칸에 세운 판 위 물건 (79 6-1)
    let wait = 0, rot: number | undefined;
    if (key === 'chainHeal') {
      const v = F.party.find(x => x.id === uid);
      wait = CHAIN_STEP_MS * chained++;
      if (v) {
        const a = screenCenter(chainFrom), b = screenCenter(v.cell);
        rot = v.cell === chainFrom ? -Math.PI / 2 - Math.PI : Math.atan2(a.y - b.y, a.x - b.x) - Math.PI; // 내가 첫 대상이면 위에서
        chainFrom = v.cell;
      }
    }
    if (fx) for (const v of pxfTargets(F, key, uid)) if (fxPxf(v, fx, now + wait, rot != null ? { rot } : undefined)) { plain.add(v.id); if (wait) later.set(v.id, wait); } // 못 그리면 공통 치유 빛 · 해제 빛을 대신
  }
  for (const ev of F.events) {
    const u = 'id' in ev ? F.party.find(x => x.id === ev.id) ?? F.souls.find(x => x.id === ev.id) : undefined;
    switch (ev.type) {
      case 'heal': {
        if (!u) break;
        fxHeal(u, ev.eff, ev.amt, ev.crit, now + (later.get(ev.id) ?? 0), plain.has(ev.id));
        if (ev.crit) critSnd = true; else healSnd = true;
        break;
      }
      case 'tick': if (u) fxHeal(u, ev.eff, ev.amt, ev.crit, now, true, true); break; // 지속 · 간접 회복: 직접 힐과 같은 숫자 · 같은 자리 (빛 · 소리 없음)
      case 'shield': if (u) fxShield(u, ev.amt, now); break; // 흡수 보호막: 같은 자리 파란 숫자
      case 'bark': break; // 말풍선은 아래 talk.frame이 상황에 맞는 대사로 (41)
      case 'sound':
        Snd.play(ev.name);
        if (ev.name === 'death') vibe(90, true);
        break;
      case 'dispel':
        if (u) fxDispel(u, now, ev.trap, undefined, !ev.trap && !ev.ally && plain.has(ev.id));
        if (!ev.trap && !ev.ally) vibe([12, 60, 12]);
        break;
      case 'cure': if (u) fxCure(u, ev.name, now); break; // 체력을 채워 쇠약·완치 표식이 사라짐 (얼음 갑옷은 녹음, 63 E)
      case 'revive': if (u) fxRevive(u, now, '부활', plain.has(ev.id)); break;
      case 'debuff': {
        const nm = ({ '질병': 'cough', '독': 'bubble', '마법': 'zap' } as Record<string, string>)[ev.dtype];
        if (nm && now - (ui.debSnd[nm] || 0) > 400) { ui.debSnd[nm] = now; Snd.play(nm); }
        if (u) fxDebuff(u, ev.dtype, now); // 디버프 걸림 그림 (44 E-1, 종류 색)
        break;
      }
      case 'impact': fxImpact(ev.kind, now); break; // 외침·등불 흔들기 … 떨어짐 (44 E-2 · 3)
      case 'hit': dmgNum(F.party.find(x => x.id === ev.uid), ev.amt, now, !!ev.crit); break;
      case 'miss': missNum(F.party.find(x => x.id === ev.uid)); break;
      case 'parry': if (u) fxNote(u, '막음', 0xcfd8e3, now); break; // 99 라
      case 'daze': if (u) fxNote(u, '멍', 0xb7b1c9, now); break; // 99 집중
      case 'death':
        if (u) fxDeath(u, now);
        if (u && !u.me) toast(`${u.nick} 쓰러짐`, 'bad');
        break;
      case 'msg': toast(ev.text); break;
      case 'phase': banner(ev.text, { tone: ev.text === '광폭화' ? 'danger' : undefined }); if (ev.text === '광폭화') { vibe([60, 80, 60, 80, 60], true); bossFx('rage'); } else vibe(200, true); break;
      case 'gauge': Snd.play('gauge'); toast(`성언: ${ev.which} 준비됨 · 휠에서 장전해 사용`, 'good'); break;
      case 'beacon': { const b = F.party.find(x => x.id === ev.id); if (b) fxRevive(b, now, '봉화 지정', true); break; } // 글자만: 영혼 불꽃 (부활 이펙트)은 빼고 봉화 그릇 · 고리 이펙트만 (2026-10-19 Lim 「봉화스킬에서 파란색 연출을 제거」)
      case 'mobDown': {
        toast(`${ev.name} 쓰러짐`, 'good'); updateBossTitle();
        // 판 위 적 처치 (37 4장 F-1): 감옥은 깨지고, 칸에 선 적은 연기로
        const a = F.mobs.find(m => m.id === ev.id)?.add;
        if (a?.hold != null) fxGim('jail-break', now, { id: a.on }); else if (a?.cell != null) fxGim('poof', now, { cell: a.cell });
        break;
      }
      case 'ability': { // 파티원 능력: 이름 글자 + 능력 종류 PXF 이펙트 (모든 효과 PXF 1단계)
        if (!u) break;
        if (ev.fumble) { fxNote(u, `${ev.name} 헛씀`, 0xb9b1a2, now); break; } // 99 다: 헛씀 (이펙트 없음)
        fxAbility(u, ev.name, now);
        const fx = u.ab && ALLY_PXF[ABILITIES[u.ab.key]?.kind];
        if (fx) fxPxf(u, fx, now);
        break;
      }
      case 'spec': if (u) fxSpec(u, ev.name, now); break; // 장비 특수능력이 켜짐 (42): 칸 위 금색 이름 + fx-proc · 마지막 숨 fx-endure (36 J)
      case 'aheal': if (u) fxAllyHeal(u, ev.amt, now); break;
      case 'dmg': if (u) fxDamage(u, ev.amt, now); break; // 받은 피해: 회복 숫자 자리에 빨간 숫자 (뒤집힌 축복도 이것, hurt 사건은 말풍선만)
      case 'bossHeal': bossHealNum(ev.amt); bossFx('mend'); break; // 치유하는 쫄
      // 기믹 연출 (37 4장 F-1): 칸·사람이 없으면 보스 그림 위
      case 'fx': if (ev.cell == null && ev.on == null && !ev.all) bossFx(ev.name); else fxGim(ev.name, now, { id: ev.on, cell: ev.cell, to: ev.to, all: ev.all }); break;
      case 'shake': if (u) { fxShake(u, now); vibe([20, 40, 20]); } break;
    }
  }
  for (const b of talk.frame(F, now, { pulling: ui.pullLeft > 0, paused: B.paused })) addBubble(b.id, b.text, now, b.life, b.kind, b); // b.emote · b.cheer (43 4장)
  if (critSnd) Snd.play('crit');
  else if (healSnd && now - ui.lastHealSnd > 90) { Snd.play('heal'); ui.lastHealSnd = now; }
  F.events.length = 0;
  // 심장 박동: 체력 30% 아래인 사람이 있으면 (가장 낮은 1명 기준, 하나만) (16 7-4)
  if (!F.over && !B.paused) {
    const alive = F.party.filter(x => x.alive);
    const low = alive.length ? alive.reduce((a, b) => (b.hp / b.max < a.hp / a.max ? b : a)) : null;
    if (low && low.hp / low.max < 0.3 && now - ui.lastHeart > 1100) { ui.lastHeart = now; Snd.play('heart'); }
  }
  // 위험 진동 (체력 30% 아래로 들어갈 때, 3초에 1번)
  for (const u of F.party) {
    const low = u.alive && u.hp / u.max < 0.3;
    if (low && !ui.lowFlags[u.id] && now - ui.lastLowVibe > 3000) { vibe(15); ui.lastLowVibe = now; }
    ui.lowFlags[u.id] = low;
  }
}

// ---------- 일시정지: 전투 전과 같은 공략 (지금 단계·지금 나오는 기술 표시) ----------
function setPause(v: boolean): void {
  const F = B.F;
  if (!F || F.over) return;
  B.paused = v; $('pause').hidden = !v;
  setPauseInert(v);
  if (!v) { $('pauseBtn').focus({ preventScroll: true }); return; }
  endSlot(true); endAux(true); endPointer(true);
  closeTip();
  const g = guideOf(F);
  const ph = g.phases.find(p => p.id === g.cur(F));
  $('pauseSub').textContent = `${mmss(F.t)} · ${ph ? ph.name : ''} · 보스 체력 ${Math.ceil((F.bossHp / F.bossMax) * 100)}%`;
  $('pauseGuide').innerHTML = guideHtml(g, F);
  $('pauseGuide').scrollTop = 0;
  ($('pauseAuto') as HTMLInputElement).checked = S.auto;
  $('resumeBtn').focus({ preventScroll: true });
}
function setPauseInert(value: boolean): void {
  for (const el of Array.from($('battle').children)) {
    if (el instanceof HTMLElement && el.id !== 'pause') el.inert = value;
  }
}
$('pause').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); setPause(false); }
  if (e.key !== 'Tab') return;
  const nodes = [...$('pause').querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')].filter(el => el.getClientRects().length);
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
});
$('pauseBtn').addEventListener('click', () => setPause(true));
// 개발 빌드: 일시정지에서 자동 치유 켜고 끄기 (설정에도 저장). 한 번이라도 켜진 판은 자동 힐러 판
$('pauseAuto').addEventListener('change', e => {
  S.auto = (e.target as HTMLInputElement).checked;
  if (S.auto && S.run) S.run.auto = true;
  S.onSetting?.('auto', S.auto);
});
$('resumeBtn').addEventListener('click', () => { Snd.init(); setPause(false); });
$('restartBtn').addEventListener('click', () => dialogs.confirm('restart'));
function quit(how: 'quit' | 'giveUp'): void {
  if (!B.F || B.F.over) return;
  closeTip(); B.paused = false; $('pause').hidden = true;
  setPauseInert(false);
  finish(how);
}
$('quitBtn').addEventListener('click', () => dialogs.confirm('quit'));
// 탱커가 모두 쓰러지면 나오는 포기 버튼 (2026-10-07 Lim): 전멸과 같은 실패로 셈 (일시정지의 「포기하고 나가기」는 보상 없음)
$('giveUp').addEventListener('click', () => dialogs.confirm('giveUp'));
const dialogs = initBattleDialogs({
  getFight: () => B.F, getPaused: () => B.paused, setPaused: v => { B.paused = v; },
  act: kind => { if (kind === 'restart') { resetRun(); startBattle(); } else quit(kind); },
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && B.F && !B.F.over && !$('battle').hidden) {
    // 확인 창을 연 때의 pause 복원이 앱 전환에 의한 일시정지를 덮어쓰지 않게 먼저 닫는다.
    dialogs.closeAll(); setPause(true);
  }
});

// ---------- 끝: 결과를 새 화면(정산)에 넘김. 던전은 구간 전체 합 ----------
/** end = 전투가 끝남(endSegment가 합산함) · quit = 일시정지에서 포기 · giveUp = 탱커 전멸 뒤 포기 버튼 (전멸로 셈) */
function finish(how: 'end' | 'quit' | 'giveUp'): void {
  dialogs.closeAll(); setPauseInert(false);
  const R = S.run!, f = B.F!, st = f.stats, quitted = how === 'quit', win = how === 'end' && f.over === 'win';
  const acc = tapAccuracy(), min = Math.max(1 / 60, f.t / 60);
  if (how !== 'end') { R.time += f.t; R.deaths += st.deaths; addStats(R, f, st); }
  const detail: [string, string][] = [
    ['마지막 전투', `${f.enc.name} ${mmss(f.t)}`],
  ];
  const dev: [string, string][] = [
    ['탭', `${st.taps}번 (분당 ${Math.round(st.taps / min)})`],
    ['칸 중심에서 벗어남', acc.n ? `평균 칸 크기의 ${acc.avg}%` : '-'],
    ['옆 칸 재지정 (오탭 추정)', `${ui.retarget}번 · 빈 칸 ${st.emptyTaps}번`],
    ['시전 취소 · 마나 부족', `${st.cancels}번 · ${st.manaFails}번`],
    ['쓸기 스킬', `${Object.values(ui.swipes).reduce((a, b) => a + b, 0)}번 · 취소 ${ui.swipeCancel} · 빈 방향 ${ui.swipeEmpty}`],
  ];
  const left = win ? undefined : { pct: Math.ceil((f.bossHp / f.bossMax) * 100), mobs: f.bodyHp };
  const result = {
    hero: f.hero,
    content: R.content, diff: S.diff, win, quit: quitted, reason: quitted ? '포기함' : how === 'giveUp' ? '탱커 전멸 뒤 포기' : f.reason,
    segIdx: R.idx, segN: R.segs.length, time: R.time, restSec: R.restSec, deaths: R.deaths,
    healed: R.healed, overheal: R.overheal, dispels: R.dispels, dispellable: R.dispellable,
    endMana: Math.floor(f.mana), minMana: Math.floor(st.minMana), auto: !!(S.auto || R.auto),
    party: partyResult(R, f),
    detail, dev, left, segNames: R.segs.map(k => ENCOUNTERS[k as EncounterKey].name), meter: R.meter.map(r => ({ ...r })),
    stage: S.stageLv, affixes: S.affixes?.slice(), chal: S.chal || undefined, limit: S.limit, cont: R.cont || undefined, giveUp: how === 'giveUp' || undefined,
  } as BattleResult;
  ui.lastResult = result;
  Snd.play(win ? 'win' : 'lose');
  B.F = null;
  S.onEnd?.(result);
}
/** 구간 기록을 던전 전체로 모아 둠 */
function addStats(R: Run, f: Fight, st: FightStats): void {
  R.healed += st.healed; R.overheal += st.overheal; R.dispels += st.dispels; R.dispellable += st.dispellable;
  addMeter(R.meter, f.party);
  collectPartyStats(R, f);
}
/** 결과의 파티원: 길드원 「한 일」 (딜 1등 · 강타 · 장판 · 쫄 · 끊기 · 자리 · 위기) */
function partyResult(R: Run, f: Fight): BattleResult['party'] {
  const people = f.party.filter(u => !u.me);
  const topNick = people.filter(u => u.role !== 'tank').reduce<{ nick: string; d: number } | null>((a, u) => { const d = R.partyStats?.[u.nick]?.dealt ?? u.dealt; return !a || d > a.d ? { nick: u.nick, d } : a; }, null)?.nick;
  return people.map(u => {
    const b = R.partyStats?.[u.nick], low = b?.low ?? u.low ?? 1;
    const deed = b?.did ? deedOf({ did: b.did, dealt: b.dealt, top: u.nick === topNick, low, alive: u.alive, role: u.role }) : undefined;
    return { nick: u.nick, pers: u.pers, role: u.role, alive: u.alive, got: Math.round(b?.got ?? u.got), gid: u.gid, low: Math.round(low * 1000) / 1000, ...(deed ? { deed } : {}) };
  });
}
/** 성장 행동 판단용 전투 기록을 던전 전체로 합산 */
function collectPartyStats(R: Run, f: Fight): void {
  const b = (R.partyStats ??= {});
  for (const u of f.party) {
    if (u.me || u.role === 'healer') continue;
    const low = u.low ?? 1, x = (b[u.nick] ??= { got: 0, low: 1, dealt: 0 });
    x.got += u.got; x.dealt += u.dealt;
    if (u.did) { const d = (x.did ??= { dodge: 0, move: 0, cut: 0, buster: 0, adds: 0 }); for (const k of Object.keys(d) as (keyof typeof d)[]) d[k] += u.did[k]; } // 길드원 「한 일」 (97)
    x.low = Math.min(x.low, low);
  }
}
function tapAccuracy() {
  const a = ui.tapOff;
  return { n: a.length, avg: a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) : null, far: a.filter(v => v > 0.6).length };
}
/** 한 판 기록 (테스트·플레이 기록용) */
function runData(f: Fight) {
  const st = f.stats, tot = st.healed + st.overheal, R = S.run!;
  return {
    at: new Date().toISOString(), encounter: f.enc.key, content: R.content, segment: R.idx, hero: f.hero,
    runSeconds: Math.round(R.time), restSeconds: Math.round(R.restSec), boss: f.enc.name, tier: f.enc.tier, diff: f.cfg.diff, gear: f.gear,
    result: f.over, reason: f.reason, seconds: Math.round(f.t), bossLeftPct: Math.ceil((f.bossHp / f.bossMax) * 100),
    deaths: st.deaths, partySize: f.party.length,
    healed: Math.round(st.healed), overhealPct: tot ? Math.round((st.overheal / tot) * 100) : 0,
    minMana: Math.floor(st.minMana), endMana: Math.floor(f.mana), dispels: st.dispels, dispellable: st.dispellable, trapPops: st.trapPops, queueLost: st.queueLost,
    casts: st.casts, taps: st.taps, missTaps: st.missTaps, retarget: ui.retarget, tapOffsetAvgPct: tapAccuracy().avg, tapFar: tapAccuracy().far,
    tapKey: S.tapKey, layout: layoutCode(S.layout), layoutChanged: layoutCode(S.layout) !== layoutCode(DEFAULT_LAYOUT), hand: S.hand, zoom: S.zoom, board: f.board,
    swipes: ui.swipes, swipeCancel: ui.swipeCancel, swipeEmpty: ui.swipeEmpty,
    emptyTaps: st.emptyTaps, cancels: st.cancels, manaFails: st.manaFails, hymnBroken: st.hymnBroken,
    guideSec: ui.guideSec, skillTips: ui.skillTips, // 전투 전 공략 화면을 본 초 · 전투 중 기술 설명 팝업을 연 횟수
    personalities: f.party.filter(u => u.pers).map(u => u.pers),
    dealt: f.party.filter(u => !u.me).map(u => [u.nick, Math.round(u.dealt)]),
    device: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1, touch: ui.touchSeen },
  };
}

// ---------- 구간 끝 · 휴식 (09 S07, 23 4장) ----------
function endSegment(): void {
  const R = S.run!, F = B.F!;
  R.time += F.t; R.deaths += F.stats.deaths; addStats(R, F, F.stats);
  const next = F.over === 'win' && R.idx < R.segs.length - 1;
  // 화면이 넘어가기 전 판에 결과 띠: 구간 처치 · 마지막 승리 · 전멸 (이유는 아래 줄). 지면 판을 잿빛으로
  if (F.over === 'win') banner(next ? '처치' : '승리', { tone: 'win', sub: next ? F.enc.name : R.name });
  else banner('전멸', { tone: 'lose', sub: F.reason });
  $('battle').classList.add(F.over === 'win' ? 'over-win' : 'over-lose');
  // 실패는 전투 상태를 2초 보여 준 뒤 정산. 이전 판의 타이머가 새 판을 종료하지 않게 한다.
  setTimeout(() => { if (B.F === F && F.over) { if (next) showRest(); else finish('end'); } }, F.over === 'lose' ? 2000 : 1200);
}
function showRest(): void {
  const R = S.run!, F = B.F!, segs = R.segs;
  closeTip();
  ui.restAt = performance.now(); ui.restMana = null;
  $('restSub').textContent = `${R.name} · ${F.enc.name} 끝 (${mmss(F.t)})`;
  // 구간 길: 점 (✓ 깸 · 번호) 아래 구간 이름, 다음 구간은 금빛
  $('restSteps').innerHTML = segs.map((k, i) => `<li class="${i <= R.idx ? 'done' : i === R.idx + 1 ? 'next' : ''}"><i aria-hidden="true">${i <= R.idx ? '✓' : i + 1}</i><span>${i <= R.idx ? '<span class="sr">끝: </span>' : ''}${ENCOUNTERS[k as EncounterKey].name}</span></li>`).join('');
  $('restMeter').innerHTML = meterHtml(addMeter([], F.party), F.t, { title: `딜미터기 · ${F.enc.name}`, heal: F.stats.healed });
  // 공략은 한 화면에 같이 두지 않고 「공략 보기」 시트로 (2026-10-13 Lim). 회복 안내 글도 뺌
  const g = guideOf(F, segs[R.idx + 1] as EncounterKey);
  g.tier = `다음 ${R.idx + 2}/${segs.length}`;
  $('restNext').innerHTML = `<h2 class="rest-h">다음 상대</h2>
    <div class="rest-foe"><span class="rest-art">${bossSvg(g.enc.script, g.enc.key)}</span>
      <span class="rest-id"><b>${g.enc.name}</b><span class="rest-tags"><i>${g.tier}</i><i class="diff">${g.diff}</i>${isFinite(g.enc.enrage) ? `<i class="enr">광폭화 ${mmss(g.enc.enrage)}</i>` : ''}</span></span>
      <button class="btn rest-gbtn" id="restGuideOpen" type="button" aria-haspopup="dialog">${REST_BOOK}<span>공략 보기</span></button></div>`;
  $('restGuide').innerHTML = guideHtml(g, null);
  restSheet(false);
  // 머리 뒤에 이번 장소 풍경 (전투 무대와 같은 그림)
  $('rest').style.setProperty('--rest-art', $('battle').style.getPropertyValue('--stage-art'));
  show('rest');
  $('restBody').scrollTop = 0;
  updateRest(ui.restAt);
}
const restSec = (now: number) => Math.max(0, (now - ui.restAt) / 1000);
function updateRest(now: number): void {
  const c = restCarry(B.F!, restSec(now));
  if (ui.restMana !== Math.floor(c.mana)) {
    ui.restMana = Math.floor(c.mana);
    $('restFill').style.width = `${c.mana}%`;
    $('restPct').textContent = `${ui.restMana}%`;
  }
  if (S.auto && c.mana >= 100) $('restGo').click(); // 자동 힐러 구경은 마나가 차면 바로 다음 구간
}
const REST_BOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/></svg>';
/** 휴식 공략 시트: 열면 맨 위부터 · 닫기에 포커스, 닫으면 「공략 보기」로 포커스 */
function restSheet(open: boolean): void {
  const el = $('restSheet');
  if (el.hidden === !open) return;
  el.hidden = !open;
  if (open) { $('restGuide').scrollTop = 0; $('restGuideClose').focus(); }
  else if (!$('rest').hidden) document.getElementById('restGuideOpen')?.focus();
}
$('rest').addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.closest('#restGuideOpen')) restSheet(true);
  else if (t.closest('#restGuideClose') || t.id === 'restSheet') restSheet(false);
});
$('rest').addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('restSheet').hidden) { e.preventDefault(); restSheet(false); }
});
$('restGo').addEventListener('click', () => {
  if ($('rest').hidden || !S.run || !B.F) return;
  restSheet(false);
  const sec = restSec(performance.now());
  S.run.carry = restCarry(B.F, sec);
  S.run.restSec += sec;
  S.run.idx++;
  Snd.init();
  startBattle(Math.round(sec));
});

// ---------- 루프 ----------
let last = performance.now(), acc = 0;
function updatePull(dt: number): void {
  ui.pullLeft = Math.max(0, ui.pullLeft - dt);
  const n = Math.ceil(ui.pullLeft);
  if (n !== ui.pullShown) {
    ui.pullShown = n;
    const el = $('pullNum'); el.textContent = String(n); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    if (n > 0) Snd.play('tick');
  }
  if (ui.pullLeft <= 0) { $('pull').hidden = true; acc = 0; Snd.play('buster'); banner('전투 시작!'); }
}
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const F = B.F;
  if (F && !$('battle').hidden) {
    if (!B.paused && !F.over) {
      if (ui.pullLeft > 0) updatePull(dt);
      else {
        coachCheck();
        if (ui.coach && !ui.coach.freeze && now > ui.coach.until) clearCoach();
        if (!(ui.coach && ui.coach.freeze)) {
          acc += dt;
          while (acc >= DT && !F.over) { if (S.auto) autoHealer(F); step(F); acc -= DT; }
        }
      }
    }
    handleEvents(now);
    updateStage(now); updateWheel(); updateAux(); updateCastbar(); updatePreview(now);
    render(now);
    if (F.over && !B.overShown) { B.overShown = true; endSegment(); }
  }
  if (!$('rest').hidden && B.F) updateRest(now);
  requestAnimationFrame(frame);
}

// ---------- 새 화면(src/screens)이 쓰는 입구 · 테스트용 조회 ----------
(window as unknown as { __proto: unknown }).__proto = {
  get F() { return B.F; }, center: (i: number) => screenCenter(i), guide: (enc: EncounterKey, diff: DiffName) => guideModel(enc, diff),
  run: () => (B.F ? runData(B.F) : null), get pullLeft() { return ui.pullLeft; }, get coach() { return ui.coach; }, get dungeon() { return S.run; }, get last() { return ui.lastResult; },
  get renderer() { return boardRenderer(); },
  /** 말풍선 띄우기 (화면 테스트: 판 크기마다 말하는 사람 칸에 붙는지) */
  say: (id: number, text: string, kind: BubbleKind = 'talk', life = 3000) => addBubble(id, text, performance.now(), life, kind),
  /** 스킬 PXF 이펙트 표 · 재생할 칸 (화면 테스트) */
  pxf: {
    skills: SKILL_PXF, targets: (key: SkillKey, uid: number) => (B.F ? pxfTargets(B.F, key, uid).map(u => u.id) : []),
    clip: (k: PxfKey) => PXF[k],
    common: COMMON_PXF, ally: (uid: number) => { const ab = B.F?.party.find(u => u.id === uid)?.ab; return ab ? ALLY_PXF[ABILITIES[ab.key].kind] ?? null : null; },
    /** 보스 판 전체 공격 (FX_LOOK wide 이름 → PXF) · 판 사각형 */
    boss: BOSS_PXF, rect: () => ({ left: L.left * L.k, right: L.right * L.k, top: L.top * L.k, bottom: L.bottom * L.k }),
    /** 띠를 읽어 뒀는지 (아니면 읽기 시작) · 이 전투에서 나올 수 있는 보스 판 전체 공격 · 지금 읽어 둔 것 */
    ready: (k: PxfKey) => pxfReady(k), bossWant: () => (B.F ? bossPxfOf(B.F.enc) : []), bossLoaded: () => bossPxfLoaded(),
  },
};
(window as unknown as { __battle: unknown }).__battle = {
  /** 전투 화면에서 바꾼 설정을 저장하게 새 화면에 알림 (일시정지의 자동 치유) */
  set onSetting(fn: typeof S.onSetting) { S.onSetting = fn; },
  start(o: StartOptions) {
    closeTip();
    S.diff = o.diff; S.gearStats = o.gearStats || null; S.party = o.party; S.onEnd = o.onEnd || null;
    S.run = { content: o.content, name: o.name, segs: o.segs.slice(), seed0: o.seed != null ? o.seed : null, coachDone: new Set() } as Run;
    S.level = o.level || 100;
    S.heroLv = o.heroLv; S.stageLv = o.stageLv;
    S.coach = o.coach || null;
    S.hero = o.hero && HERO_KEYS.includes(o.hero) ? o.hero : 'priest';
    S.talents = Array.isArray(o.talents) ? o.talents.slice() : undefined;
    S.specs = o.specs && Object.keys(o.specs).length ? { ...o.specs } : undefined;
    S.affixes = o.affixes?.length ? o.affixes.slice() : undefined; S.bossMult = o.bossMult; S.limit = o.limit; S.chal = o.chal || 0; S.guildFirst = !!o.guildFirst;
    applyLayout();
    resetRun();
    Snd.init();
    startBattle(0);
  },
  settings(s: { sound?: boolean; vibrate?: boolean; hand?: string; tapKey?: string; zoom?: boolean; auto?: boolean; layout?: unknown; hero?: string; compactSkills?: boolean; reducedEffects?: boolean }) {
    S.sound = !!s.sound; S.vibe = !!s.vibrate; S.hand = s.hand === 'left' ? 'left' : 'right';
    S.tapKey = s.tapKey && TAP_KEYS[s.tapKey] ? s.tapKey : 'heal';
    if (s.hero && HERO_KEYS.includes(s.hero as HeroKey)) S.hero = s.hero as HeroKey;
    S.zoom = s.zoom !== false; S.auto = !!s.auto;
    S.compactSkills = true;
    S.reducedEffects = !!s.reducedEffects || matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('battle').classList.toggle('reduced-effects', S.reducedEffects);
    if (S.auto && S.run) S.run.auto = true;
    S.layout = validLayout(s.layout) ? { ...s.layout } : { ...DEFAULT_LAYOUT };
    applyLayout();
    if (B.F && !$('battle').hidden) layoutBattle();
  },
  /** 전투 전 공략 (단계 레벨을 주면 그 레벨 숫자로) */
  guide: (encKey: EncounterKey, diff: DiffName, stageLv?: number, heroLv?: number) => guideHtml(guideModel(encKey, diff, stageLv, heroLv), null),
  bossSvg: (script: string, key?: string) => bossSvg(script, key),
  layout: { GRID, ARROW, READ_ORDER, DEFAULT_LAYOUT, LAYOUT_SKILLS, valid: validLayout, label: layoutLabel, text: layoutText },
  tapKeys: TAP_KEYS,
  tapKeysOf: (hero: string) => tapKeysOf(HERO_KEYS.includes(hero as HeroKey) ? (hero as HeroKey) : 'priest'),
  sound: (k: string) => { Snd.init(); Snd.play(k); },
};
void initBoard().catch(err => console.error('전투 판 준비 실패', err));
requestAnimationFrame(frame);
