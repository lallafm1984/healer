/**
 * 전투 화면 (P1 새 전투 화면, 21 계획). 프로토타입 v11 화면을 TypeScript로 옮기고 판은 PixiJS로 그림.
 * 메뉴·정산은 새 화면(src/screens)이 맡고, 여기는 전투·휴식·일시정지만. 새 화면은 window.__battle로 부름.
 */
import type { DiffName } from '../data/difficulty';
import { REST_MANA_PER_SEC } from '../data/dungeons';
import { ENCOUNTERS, type EncounterKey } from '../data/encounters';
import { HERO_KEYS, HEROES, type HeroKey } from '../data/heroes';
import { ITEMS, type ItemKey } from '../data/items';
import { SKILL_LEVEL, SKILLS, type SkillKey } from '../data/skills';
import { autoHealer, create, DT, hexDist, itemReady, knowsPassive, restCarry, setBeacon, slotKey, step, use, useItem, type Fight, type FightStats } from '../engine';
import { addMeter, meterHtml } from '../game/meter';
import type { BattleResult } from '../game/settle';
import { bossSvg, ITEM_HINT, ITEM_ICON } from './art';
import { addBubble, boardRenderer, center, fxDeath, fxDispel, fxHeal, fxRevive, hit, initBoard, L, lensAt, render, resetBoardFx, resizeBoard } from './board';
import {
  $, applyLayout, ARROW, B, banner, DEFAULT_LAYOUT, dirSlot, GRID, LAYOUT_SKILLS, layoutCode, layoutLabel, layoutText, mmss, READ_ORDER, S, show, Snd,
  swipeDir, TAP_KEYS, tapKey, tapKeysOf, toast, ui, validLayout, vibe, type Pointer, type Run, type StartOptions,
} from './core';
import { guideHtml, guideModel } from './guide';
import {
  bossTitle, buildGauges, buildItems, buildWheel, clearCoach, closeTip, coachCheck, coachUsed, dmgNum, guideOf, openItemTip, openSkillTip, openTip, showPreview, tipMatch,
  resetDmgNums, updateCastbar, updateItems, updateStage, updateWheel,
} from './hud';

const seed = () => (Math.random() * 1e9) | 0;
const curKey = () => S.run!.segs[S.run!.idx] as EncounterKey;
/** 처음부터 다시 (같은 파티, 같은 콘텐츠) */
function resetRun(): void {
  Object.assign(S.run!, { idx: 0, carry: null, time: 0, deaths: 0, restSec: 0, healed: 0, overheal: 0, dispels: 0, dispellable: 0, itemLog: [], auto: S.auto, meter: [] });
}

// ---------- 전투 시작 ----------
/**
 * guideSec: 이번 판 직전에 공략·휴식 화면을 본 시간 (처음부터 다시는 0).
 * 던전은 같은 파티로 구간을 이어 감. 마나·성언 게이지는 앞 구간(+휴식)에서 이어받고, 아이템 횟수·재사용 대기는 구간마다 새로 (23 4장).
 * 첫 판은 편성 화면 미리보기와 같은 시드 (시작 위치가 같게). 처음부터 다시·다음 구간은 새 시드
 */
function startBattle(guideSec = 0): void {
  const R = S.run!;
  const sd = R.seed0 != null ? R.seed0 : seed(); R.seed0 = null;
  const F = create({
    encounter: curKey(), diff: S.diff as DiffName, gearStats: S.gearStats || undefined, seed: sd, party: S.party || undefined, items: S.items,
    carry: R.carry || undefined, level: S.level, heroLv: S.heroLv, stageLv: S.stageLv, hero: S.hero,
  });
  B.F = F;
  ui.itemArmed = null; itemPress = null; slotPress = null;
  buildItems();
  // 전투 시작 카운트다운 3초 (19 4장 6번). 자동 힐러 구경은 바로 시작
  ui.pullLeft = S.auto ? 0 : 3; ui.pullShown = null;
  $('pull').hidden = !(ui.pullLeft > 0);
  B.armed = null; B.paused = false; B.overShown = false; B.beacon = false;
  Object.assign(ui, {
    guideSec, skillTips: 0, lowFlags: {}, tickSec: null, busterHint: false, swipes: {}, swipeCancel: 0, swipeEmpty: 0,
    vibedTel: new Set(), debSnd: {}, tapOff: [], lastTap: null, retarget: 0, pointer: null,
  });
  closeTip(); resetBoardFx(); resetDmgNums();
  const lag = $('bossLag'); lag.style.transition = 'none'; lag.style.width = '100%'; void lag.offsetWidth; lag.style.transition = '';
  $('controls').classList.toggle('wheel-left', S.hand === 'left');
  $('pause').hidden = true; $('preview').hidden = true; $('toast').innerHTML = '';
  $('giveUp').hidden = true; $('hint').hidden = false;
  clearCoach();
  $('bossArt').innerHTML = bossSvg(F.enc.script);
  $('bossName').innerHTML = bossTitle();
  $('battle').classList.toggle('compact', !!F.enc.big);
  show('battle');
  layoutBattle();
  if (S.auto) toast('자동 힐러가 플레이 중 (기록 안 남김)');
  else if (R.idx === 0) toast(`칸을 탭하면 ${SKILLS[tapKey()].name}`);
  // 사제 성언 게이지는 Lv 6부터. 다른 직업은 고유 시스템 글자·링을 처음부터 (25 7장)
  const words = F.hero !== 'priest' || knowsPassive(F, 'words');
  buildGauges(F);
  $('gauges').classList.toggle('locked', !words);
  $('controls').classList.toggle('nowords', !words);
  $('controls').classList.toggle('paladin', F.hero === 'paladin');
}

function layoutBattle(): void {
  const F = B.F!, app = $('app');
  const H = app.clientHeight, W = app.clientWidth;
  $('stage').style.minHeight = Math.max(F.enc.big ? 96 : 110, Math.round(H * F.enc.stage)) + 'px';
  const ch = Math.round(Math.min(250, Math.max(186, H * 0.27)));
  $('controls').style.height = ch + 'px';
  buildWheel(Math.min(ch - 16, W * 0.6));
  resizeBoard();
}
new ResizeObserver(() => { if (B.F && !$('battle').hidden) resizeBoard(); }).observe($('boardWrap'));
window.addEventListener('resize', () => { if (B.F && !$('battle').hidden) layoutBattle(); });

// ---------- 스킬 휠: 짧게 누르기 = 장전(또는 바로 사용), 잠긴 칸은 배우는 레벨 안내. 길게 누르기 = 스킬 설명 ----------
interface Press { el: HTMLElement; lp: boolean; timer?: ReturnType<typeof setTimeout> }
let slotPress: (Press & { slot: string | null; lock: SkillKey | null }) | null = null;
let itemPress: (Press & { key: ItemKey }) | null = null;
const live = () => !!B.F && !B.F.over && !B.paused;

$('wheel').addEventListener('pointerdown', ev => {
  if ((ev.target as Element).closest('#core')) { ev.preventDefault(); pressCore(); return; }
  const el = (ev.target as Element).closest<HTMLElement>('.slot[data-slot], .slot[data-lock]');
  if (!el) return;
  ev.preventDefault();
  if (!live()) return;
  try { el.setPointerCapture(ev.pointerId); } catch { /* 무시 */ }
  const P: typeof slotPress = { el, slot: el.dataset.slot || null, lock: (el.dataset.lock as SkillKey) || null, lp: false };
  P.timer = setTimeout(() => {
    if (slotPress !== P || !B.F) return;
    P.lp = true; openSkillTip(P.slot ? slotKey(B.F, P.slot) : P.lock!, el); vibe(10);
  }, 450);
  slotPress = P;
});
function endSlot(cancelled: boolean): void {
  const P = slotPress; slotPress = null;
  if (!P) return;
  clearTimeout(P.timer);
  if (P.lp || cancelled || !live()) return;
  if (P.lock) { toast(`${SKILLS[P.lock].name}: Lv ${SKILL_LEVEL[P.lock]}에 배움`); Snd.play('error'); return; }
  pressSlot(P.slot!);
}
$('wheel').addEventListener('pointerup', () => endSlot(false));
$('wheel').addEventListener('pointercancel', () => endSlot(true));
$('wheel').addEventListener('contextmenu', e => e.preventDefault());

/** 휠 가운데: 성기사는 봉화 지정 (누르고 칸 탭, 25 3장). 다른 직업은 아무 일 없음 */
function pressCore(): void {
  const F = B.F;
  if (!F || !live() || ui.pullLeft > 0 || F.hero !== 'paladin') return;
  const lv = HEROES.paladin.system.lv;
  if (F.level < lv) { toast(`봉화: Lv ${lv}에 배움`); Snd.play('error'); return; }
  if (F.beaconCd > 0) { toast(`봉화 바꾸기 대기 ${Math.ceil(F.beaconCd)}초`); Snd.play('error'); return; }
  B.beacon = !B.beacon; B.armed = null; ui.itemArmed = null;
  if (B.beacon) toast('봉화: 지킬 파티원 칸 선택');
  vibe(8);
}

function pressSlot(slot: string): void {
  const F = B.F;
  if (!F || !live() || ui.pullLeft > 0) return;
  ui.itemArmed = null; B.beacon = false;
  const key = slotKey(F, slot);
  if (SKILLS[key].target === 'none') { doUse(key, 0); return; }
  B.armed = B.armed === slot ? null : slot;
  vibe(8);
}

// ---------- 소비 아이템: 누르기 = 나에게 바로 / 대상이 필요한 보호 두루마리는 장전 → 칸 탭. 길게 누르기 = 설명 ----------
$('items').addEventListener('pointerdown', e => {
  const b = (e.target as Element).closest<HTMLElement>('.item[data-item]');
  if (!b || !live() || ui.pullLeft > 0) return;
  e.preventDefault();
  try { b.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  const P: typeof itemPress = { el: b, key: b.dataset.item as ItemKey, lp: false };
  P.timer = setTimeout(() => { if (itemPress === P) { P.lp = true; openItemTip(P.key, b); vibe(10); } }, 450);
  itemPress = P;
});
function endItem(cancelled: boolean): void {
  const P = itemPress; itemPress = null;
  if (!P) return;
  clearTimeout(P.timer);
  if (P.lp || cancelled || !live()) return;
  pressItem(P.key);
}
$('items').addEventListener('pointerup', () => endItem(false));
$('items').addEventListener('pointercancel', () => endItem(true));
$('items').addEventListener('contextmenu', e => e.preventDefault());

function pressItem(key: ItemKey): void {
  const F = B.F!, it = ITEMS[key];
  if (it.target === 'ally') {
    const r = itemReady(F, key);
    if (!r.ok) { if (r.reason) toast(r.reason); Snd.play('error'); return; }
    ui.itemArmed = ui.itemArmed === key ? null : key; B.armed = null; B.beacon = false;
    if (ui.itemArmed) toast(`${it.name}: 지킬 파티원 칸 선택`);
    vibe(8); return;
  }
  const res = useItem(F, key);
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
document.addEventListener('pointerdown', e => { if (ui.tip && !$('queue').contains(e.target as Node)) closeTip(); }, true);

// ---------- 판 입력: 탭 = 기본 힐, 칸에서 8방향 쓸기 = 그 방향 스킬, 길게 누르기 = 정보 ----------
const cv = $('board') as HTMLCanvasElement;
function pt(e: PointerEvent) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function doUse(key: SkillKey, idx: number): boolean {
  const F = B.F!, res = use(F, key, idx);
  if (!res.ok) { if (res.reason) toast(res.reason); Snd.play('error'); return false; }
  if (B.armed && slotKey(F, B.armed) === key) B.armed = null;
  if (B.armed && (key === 'serenity' || key === 'sanctify')) B.armed = null;
  if (SKILLS[key].cast > 0 && !res.queued && !res.same) Snd.play('cast');
  coachUsed(key);
  return true;
}
cv.addEventListener('pointerdown', e => {
  const F = B.F;
  if (!F || !live() || ui.pullLeft > 0) return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  const p = pt(e);
  if (e.pointerType === 'touch') ui.touchSeen = true;
  const P: Pointer = { x0: p.x, y0: p.y, x: p.x, y: p.y, idx: hit(p.x, p.y), lp: false, moved: false };
  const areaArmed = !!B.armed && SKILLS[slotKey(F, B.armed)].target === 'area';
  // 광역 장전 중에는 누른 채 범위를 보는 것이 기본 동작이라 길게 누르기 정보를 끔 (02 4-1 6번)
  if (!areaArmed) P.timer = setTimeout(() => {
    if (ui.pointer === P && !P.moved && P.idx >= 0 && B.F && B.F.cells[P.idx].unit) { P.lp = true; showPreview(P.idx); }
  }, 450);
  ui.pointer = P;
});
cv.addEventListener('pointermove', e => {
  const P = ui.pointer, F = B.F;
  if (!P || !F) return;
  const p = pt(e); P.x = p.x; P.y = p.y;
  if (Math.hypot(P.x - P.x0, P.y - P.y0) > 12) { P.moved = true; clearTimeout(P.timer); }
  // 장전한 스킬이 없을 때, 파티원 칸에서 시작한 쓸기는 방향 스킬 (쓰는 동안 휠과 칸에 미리 보여줌)
  const nd = !B.armed && !ui.itemArmed && P.idx >= 0 && F.cells[P.idx].unit ? swipeDir(P.x - P.x0, P.y - P.y0) : null;
  if (nd !== P.dir) { P.dir = nd; if (nd) vibe(5); }
});
function endPointer(cancelled: boolean): void {
  const P = ui.pointer; ui.pointer = null;
  if (!P) return;
  clearTimeout(P.timer);
  if (P.lp) { $('preview').hidden = true; return; }
  const F = B.F;
  if (cancelled || !F || !live()) return;
  F.stats.taps++;
  if (B.beacon) { // 봉화 지정 중: 칸 탭 = 그 파티원
    const u = P.idx >= 0 ? F.cells[P.idx].unit : null;
    if (!u || !u.alive) { F.stats.emptyTaps++; return; }
    B.beacon = false;
    if (!setBeacon(F, u)) { Snd.play('error'); return; }
    Snd.play('bell'); vibe(12); return;
  }
  if (ui.itemArmed) { // 보호 두루마리 장전 중: 칸 탭 = 그 파티원에게
    if (P.idx < 0 || !F.cells[P.idx].unit) { F.stats.emptyTaps++; return; }
    const res = useItem(F, ui.itemArmed, P.idx);
    if (!res.ok) { if (res.reason) toast(res.reason); Snd.play('error'); return; }
    ui.itemArmed = null; vibe(8); return;
  }
  const dx = P.x - P.x0, dy = P.y - P.y0;
  const key = B.armed ? slotKey(F, B.armed) : tapKey();
  const area = SKILLS[key].target === 'area';
  if (!B.armed && P.moved) {
    const d = swipeDir(dx, dy), it = d ? dirSlot(d) : null;
    if (!d) { ui.swipeCancel++; return; } // 쓸다가 제자리로 돌아오면 취소
    if (P.idx < 0 || !F.cells[P.idx].unit) { F.stats.missTaps++; return; }
    if (!it || !it.key) { toast('이 방향은 비어 있음'); ui.swipeEmpty++; return; }
    ui.swipes[d] = (ui.swipes[d] || 0) + 1;
    const sk = slotKey(F, it.key);
    if (doUse(sk, P.idx)) { vibe(8); coachUsed('swipe:' + sk); }
    return;
  }
  if (!area && P.moved && Math.hypot(dx, dy) > 30) return;
  const idx = area ? hit(P.x, P.y) : P.idx;
  if (idx < 0) { F.stats.missTaps++; return; }
  if (!F.cells[idx].unit) { F.stats.emptyTaps++; return; }
  // 터치 정확도: 칸 중심에서 떨어진 정도(칸 크기 대비), 0.7초 안에 옆 칸으로 다시 지정 = 오탭 추정
  const c = center(idx), nowT = performance.now();
  ui.tapOff.push(Math.hypot(P.x - c.x, P.y - c.y) / L.s);
  if (ui.lastTap && ui.lastTap.idx !== idx && nowT - ui.lastTap.t < 700 && hexDist(F.cells[ui.lastTap.idx], F.cells[idx]) === 1) ui.retarget++;
  ui.lastTap = { idx, t: nowT };
  if (F.enc.big && S.zoom) lensAt(idx, nowT);
  if (doUse(key, idx)) vibe(8);
}
cv.addEventListener('pointerup', () => endPointer(false));
cv.addEventListener('pointercancel', () => endPointer(true));
cv.addEventListener('contextmenu', e => e.preventDefault());

// ---------- 전투 사건 → 소리·진동·알림·판 효과 ----------
function handleEvents(now: number): void {
  const F = B.F!;
  let healSnd = false, critSnd = false;
  for (const ev of F.events) {
    const u = 'id' in ev ? F.party.find(x => x.id === ev.id) : undefined;
    switch (ev.type) {
      case 'heal':
        if (!u) break;
        fxHeal(u, ev.eff, ev.amt, ev.crit, now);
        if (ev.crit) critSnd = true; else healSnd = true;
        break;
      case 'bark': if (ev.text) addBubble(ev.id, ev.text, now); break;
      case 'sound':
        Snd.play(ev.name);
        if (ev.name === 'death') vibe(90, true);
        break;
      case 'dispel':
        if (u) fxDispel(u, now);
        if (!ev.trap && !ev.item) vibe([12, 60, 12]);
        break;
      case 'item': {
        const it = ITEMS[ev.key];
        toast(`${it.name}${ev.note ? ` → ${ev.note}` : ''}`);
        Snd.play(it.kind === 'potion' ? 'potion' : 'scroll');
        const el = $('items').querySelector(`[data-item="${ev.key}"]`);
        if (el) { el.classList.remove('flash'); void (el as HTMLElement).offsetWidth; el.classList.add('flash'); }
        break;
      }
      case 'revive': if (u) fxRevive(u, now); break;
      case 'debuff': {
        const nm = ({ '질병': 'cough', '독': 'bubble', '마법': 'zap' } as Record<string, string>)[ev.dtype];
        if (nm && now - (ui.debSnd[nm] || 0) > 400) { ui.debSnd[nm] = now; Snd.play(nm); }
        break;
      }
      case 'hit': dmgNum(F.party.find(x => x.id === ev.uid), ev.amt, now); break;
      case 'death':
        if (u) fxDeath(u, now);
        if (u && !u.me) toast(`${u.nick} 쓰러짐`);
        break;
      case 'msg': toast(ev.text); break;
      case 'phase': banner(ev.text); if (ev.text === '광폭화') vibe([60, 80, 60, 80, 60], true); else vibe(200, true); break;
      case 'gauge': Snd.play('gauge'); toast(`성언: ${ev.which} 준비됨 · 휠에서 장전해 사용`); break;
      case 'beacon': { const b = F.party.find(x => x.id === ev.id); if (b) fxRevive(b, now); break; }
      case 'mobDown': toast(`${ev.name} 쓰러짐`); $('bossName').innerHTML = bossTitle(); break;
    }
  }
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
  if (!v) return;
  closeTip();
  const g = guideOf(F);
  const ph = g.phases.find(p => p.id === g.cur(F));
  $('pauseSub').textContent = `${mmss(F.t)} · ${ph ? ph.name : ''} · 보스 체력 ${Math.ceil((F.bossHp / F.bossMax) * 100)}%`;
  $('pauseGuide').innerHTML = guideHtml(g, F);
  $('pauseGuide').scrollTop = 0;
  ($('pauseAuto') as HTMLInputElement).checked = S.auto;
}
$('pauseBtn').addEventListener('click', () => setPause(true));
// 개발 빌드: 일시정지에서 자동 치유 켜고 끄기 (설정에도 저장). 한 번이라도 켜진 판은 자동 힐러 판
$('pauseAuto').addEventListener('change', e => {
  S.auto = (e.target as HTMLInputElement).checked;
  if (S.auto && S.run) S.run.auto = true;
  S.onSetting?.('auto', S.auto);
});
$('resumeBtn').addEventListener('click', () => { Snd.init(); setPause(false); });
$('restartBtn').addEventListener('click', () => { resetRun(); startBattle(); });
function quit(how: 'quit' | 'giveUp'): void {
  if (!B.F || B.F.over) return;
  closeTip(); B.paused = false; $('pause').hidden = true;
  finish(how);
}
$('quitBtn').addEventListener('click', () => quit('quit'));
// 탱커가 모두 쓰러지면 나오는 포기 버튼 (2026-10-07 Lim): 전멸과 같은 실패로 셈 (일시정지의 「포기하고 나가기」는 보상 없음)
$('giveUp').addEventListener('click', () => quit('giveUp'));
document.addEventListener('visibilitychange', () => { if (document.hidden && B.F && !B.F.over && !$('battle').hidden) setPause(true); });

// ---------- 끝: 결과를 새 화면(정산)에 넘김. 던전은 구간 전체 합 ----------
/** end = 전투가 끝남(endSegment가 합산함) · quit = 일시정지에서 포기 · giveUp = 탱커 전멸 뒤 포기 버튼 (전멸로 셈) */
function finish(how: 'end' | 'quit' | 'giveUp'): void {
  const R = S.run!, f = B.F!, st = f.stats, quitted = how === 'quit', win = how === 'end' && f.over === 'win';
  const acc = tapAccuracy(), min = Math.max(1 / 60, f.t / 60);
  if (how !== 'end') { R.time += f.t; R.deaths += st.deaths; addStats(R, f, st); }
  const detail: [string, string][] = [
    ['마지막 전투', `${f.enc.name} ${mmss(f.t)}`],
    ['탭', `${st.taps}번 (분당 ${Math.round(st.taps / min)})`],
    ['칸 중심에서 벗어남', acc.n ? `평균 칸 크기의 ${acc.avg}%` : '-'],
    ['옆 칸 재지정 (오탭 추정)', `${ui.retarget}번 · 빈 칸 ${st.emptyTaps}번`],
    ['시전 취소 · 마나 부족', `${st.cancels}번 · ${st.manaFails}번`],
    ['쓸기 스킬', `${Object.values(ui.swipes).reduce((a, b) => a + b, 0)}번 · 취소 ${ui.swipeCancel} · 빈 방향 ${ui.swipeEmpty}`],
    ['소비 아이템', R.itemLog.length ? R.itemLog.map(x => `${ITEMS[x.key].short} ${mmss(x.t)}`).join(' · ') : '안 씀'],
  ];
  if (!win) detail.unshift([f.mobs.length ? '적 남은 체력' : '보스 남은 체력', `${Math.ceil((f.bossHp / f.bossMax) * 100)}%`]);
  const result = {
    content: R.content, diff: S.diff, win, quit: quitted, reason: quitted ? '포기함' : how === 'giveUp' ? '탱커 전멸 뒤 포기' : f.reason,
    segIdx: R.idx, segN: R.segs.length, time: R.time, restSec: R.restSec, deaths: R.deaths,
    healed: R.healed, overheal: R.overheal, dispels: R.dispels, dispellable: R.dispellable,
    endMana: Math.floor(f.mana), minMana: Math.floor(st.minMana), auto: !!(S.auto || R.auto),
    party: f.party.filter(u => !u.me).map(u => ({ nick: u.nick, pers: u.pers, role: u.role, alive: u.alive })),
    detail, meter: R.meter.map(r => ({ ...r })),
  } as BattleResult;
  ui.lastResult = result;
  Snd.play(win ? 'win' : 'lose');
  B.F = null;
  S.onEnd?.(result);
}
/** 아이템은 구간마다 새로 받으니 쓴 기록은 던전 전체 시간으로 모아 둠 */
function addStats(R: Run, f: Fight, st: FightStats): void {
  R.healed += st.healed; R.overheal += st.overheal; R.dispels += st.dispels; R.dispellable += st.dispellable;
  R.itemLog.push(...f.itemLog.map(x => ({ key: x.key, t: R.time - f.t + x.t })));
  addMeter(R.meter, f.party);
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
    items: Object.keys(f.items), itemLog: f.itemLog, itemTips: ui.itemTips, itemDispels: st.itemDispels || 0, // 고른 단축칸 · 사용 시각 · 길게 눌러 설명 본 횟수
    personalities: f.party.filter(u => u.pers).map(u => u.pers),
    traits: f.party.flatMap(u => u.traits),
    dealt: f.party.filter(u => !u.me).map(u => [u.nick, Math.round(u.dealt)]),
    device: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1, touch: ui.touchSeen },
  };
}

// ---------- 구간 끝 · 휴식 (09 S07, 23 4장) ----------
function endSegment(): void {
  const R = S.run!, F = B.F!;
  R.time += F.t; R.deaths += F.stats.deaths; addStats(R, F, F.stats);
  const next = F.over === 'win' && R.idx < R.segs.length - 1;
  setTimeout(() => { if (B.F && B.F.over) { if (next) showRest(); else finish('end'); } }, 1200);
}
function showRest(): void {
  const R = S.run!, F = B.F!, segs = R.segs;
  closeTip();
  ui.restAt = performance.now(); ui.restMana = null;
  $('restSub').textContent = `${R.name} · ${F.enc.name} 끝 (${mmss(F.t)})`;
  $('restSteps').innerHTML = segs.map((k, i) => `<li class="${i <= R.idx ? 'done' : i === R.idx + 1 ? 'next' : ''}">${i <= R.idx ? '✓ ' : ''}${ENCOUNTERS[k as EncounterKey].name}</li>`).join('');
  const dead = F.party.filter(u => !u.alive && !u.me).length;
  $('restMeter').innerHTML = meterHtml(addMeter([], F.party), F.t, { title: `딜미터기 · ${F.enc.name}`, heal: F.stats.healed });
  $('restNote').textContent = `파티 체력 모두 회복${dead ? `. 쓰러진 ${dead}명도 일어남` : ''}. 마나는 쉬는 동안 초당 ${REST_MANA_PER_SEC}%씩 회복. 「계속」은 언제든 가능`;
  const g = guideOf(F, segs[R.idx + 1] as EncounterKey);
  g.tier = `다음 ${R.idx + 2}/${segs.length}`;
  $('restGuide').innerHTML = guideHtml(g, null);
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
$('restGo').addEventListener('click', () => {
  if ($('rest').hidden || !S.run || !B.F) return;
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
    updateStage(now); updateWheel(); updateItems(); updateCastbar();
    render(now);
    if (F.over && !B.overShown) { B.overShown = true; endSegment(); }
  }
  if (!$('rest').hidden && B.F) updateRest(now);
  requestAnimationFrame(frame);
}

// ---------- 새 화면(src/screens)이 쓰는 입구 · 테스트용 조회 ----------
(window as unknown as { __proto: unknown }).__proto = {
  get F() { return B.F; }, center: (i: number) => center(i), guide: (enc: EncounterKey, diff: DiffName) => guideModel(enc, diff),
  run: () => (B.F ? runData(B.F) : null), get pullLeft() { return ui.pullLeft; }, get coach() { return ui.coach; }, get dungeon() { return S.run; }, get last() { return ui.lastResult; },
  get renderer() { return boardRenderer(); },
};
(window as unknown as { __battle: unknown }).__battle = {
  /** 전투 화면에서 바꾼 설정을 저장하게 새 화면에 알림 (일시정지의 자동 치유) */
  set onSetting(fn: typeof S.onSetting) { S.onSetting = fn; },
  start(o: StartOptions) {
    closeTip();
    S.diff = o.diff; S.gearStats = o.gearStats || null; S.party = o.party; S.items = (o.items || []).slice(); S.slots = o.slots || 4; S.onEnd = o.onEnd || null;
    S.run = { content: o.content, name: o.name, segs: o.segs.slice(), seed0: o.seed != null ? o.seed : null, coachDone: new Set() } as Run;
    S.level = o.level || 100;
    S.heroLv = o.heroLv; S.stageLv = o.stageLv;
    S.coach = o.coach || null;
    S.hero = o.hero && HERO_KEYS.includes(o.hero) ? o.hero : 'priest';
    applyLayout();
    resetRun();
    Snd.init();
    startBattle(0);
  },
  settings(s: { sound?: boolean; vibrate?: boolean; hand?: string; tapKey?: string; zoom?: boolean; auto?: boolean; layout?: unknown; hero?: string }) {
    S.sound = !!s.sound; S.vibe = !!s.vibrate; S.hand = s.hand === 'left' ? 'left' : 'right';
    S.tapKey = s.tapKey && TAP_KEYS[s.tapKey] ? s.tapKey : 'heal';
    if (s.hero && HERO_KEYS.includes(s.hero as HeroKey)) S.hero = s.hero as HeroKey;
    S.zoom = s.zoom !== false; S.auto = !!s.auto;
    if (S.auto && S.run) S.run.auto = true;
    S.layout = validLayout(s.layout) ? { ...s.layout } : { ...DEFAULT_LAYOUT };
    applyLayout();
  },
  /** 전투 전 공략 (단계 레벨을 주면 그 레벨 숫자로) */
  guide: (encKey: EncounterKey, diff: DiffName, stageLv?: number, heroLv?: number) => guideHtml(guideModel(encKey, diff, stageLv, heroLv), null),
  bossSvg: (script: string) => bossSvg(script),
  itemIcon: (k: string) => ITEM_ICON[k as ItemKey] || '',
  itemHint: (script: string) => ITEM_HINT[script] || '',
  layout: { GRID, ARROW, READ_ORDER, DEFAULT_LAYOUT, LAYOUT_SKILLS, valid: validLayout, label: layoutLabel, text: layoutText },
  tapKeys: TAP_KEYS,
  tapKeysOf: (hero: string) => tapKeysOf(HERO_KEYS.includes(hero as HeroKey) ? (hero as HeroKey) : 'priest'),
  sound: (k: string) => { Snd.init(); Snd.play(k); },
};
void initBoard().catch(err => console.error('전투 판 준비 실패', err));
requestAnimationFrame(frame);
