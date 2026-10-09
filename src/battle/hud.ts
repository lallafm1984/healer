/**
 * 전투 화면의 HTML 부분: 스킬 휠 · 단축칸 · 시전 막대 · 보스 무대(예고 대기열) · 설명 팝업 · 길게 누르기 정보 · 튜토리얼 안내 · 포기 버튼.
 * 매 프레임 바뀐 글자·클래스만 고침 (판은 board.ts가 캔버스에).
 */
import { ABILITIES, AB_KIND } from '../data/abilities';
import { NO_TANK_SEC } from '../data/armor';
import { CLASSES } from '../data/classes';
import { BEACON } from '../data/heroConst';
import { canDispel, HEROES } from '../data/heroes';
import { mobGrade } from '../data/encounters';
import type { ItemKey } from '../data/items';
import { ITEMS, POTION_CD } from '../data/items';
import { CATS } from '../data/personalities';
import { ITEM_SLOT_LV, itemSlots } from '../data/progression';
import { INT_BASE } from '../data/rules';
import { healText, SKILL_LEVEL, SKILLS, type SkillKey } from '../data/skills';
import { itemTip, skillTip, tipHtml } from '../game/tooltip';
import { TRAITS } from '../data/traits';
import { TALENT_DEF, type TalentKey } from '../data/talents';
import { activeOn, bossTaken, cdMax, costOf, knows, queue, slotKey, type Fight, type Unit } from '../engine';
import { art, cssUrl } from '../art';
import { ITEM_ICON, skillMark } from './art';
import { center, L } from './board';
import { $, arrowOf, B, DIR_VEC, DIRS, josa, mmss, ROLE, S, Snd, tapKey, toast, ui, vibe, type Dir } from './core';
import { guideModel } from './guide';
import { manaMeter } from './mana-meter';

const fight = () => B.F!;
const setText = (el: Element, t: string) => { if (el.textContent !== t) el.textContent = t; };

/** 지금 판의 공략 (단계 레벨까지 반영한 숫자) */
export const guideOf = (F: Fight, encKey = F.enc.key) => guideModel(encKey, F.cfg.diff, F.cfg.stageLv, F.cfg.heroLv);

/** 일반·정예 구간은 지금 잡는 적 이름과 등급을 같이 (HTML, 이름은 데이터라 그대로) */
export function bossTitle(): string {
  const F = fight(), m = F.mobs.find(x => x.alive && !x.add); // 쫄(P-ADD)은 이름 줄에 안 씀
  return m ? `<span class="boss-title-text">${m.name}</span><small class="grade${m.elite ? ' elite' : ''}">${mobGrade(m)}</small>` : F.enc.name;
}

// ---------- 스킬 휠 (시안: 청동 3px 링 · 방사 그라데이션 칸, 가운데 = 마나 링) ----------
/** 휠 칸 방향 화살표 (시안의 금색 선 화살표) */
const DIR_PATH: Record<Dir, string> = {
  N: 'M12 20V4M6 10l6-6 6 6', NE: 'M6 18L18 6M10 6h8v8', E: 'M4 12h16M14 6l6 6-6 6', SE: 'M6 6l12 12M18 10v8h-8',
  S: 'M12 4v16M6 14l6 6 6-6', SW: 'M18 6L6 18M6 10v8h8', W: 'M20 12H4M10 6l-6 6 6 6', NW: 'M18 18L6 6M14 6H6v8',
};
const dirSvg = (d: Dir) => `<svg class="dir" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${DIR_PATH[d]}"/></svg>`;
const LOCK_SVG = '<svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

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
    html += `<button class="slot" type="button" data-slot="${it.key}" data-dir="${it.d}" style="${pos}"><span class="cd"></span><span class="in">${dirSvg(it.d)}<span class="nm"></span><span class="ct"></span><span class="cds"></span></span></button>`;
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
  if (!w) return '';
  return F.t < w.until ? ` · 주시 중 ${Math.ceil(w.until - F.t)}` : ` · 주시 ${Math.min(99, Math.floor((w.fill / w.max) * 100))}%`;
}

/** 보스 체력바 아래 게이지: 무력화 = 파랑 · 빛 그릇 = 연두 (채울수록 좋음), 주시 = 호박색 (차면 나를 노림) */
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
    const lk = F.lock[key], cdv = sk.cd ? F.cd[key] || 0 : 0, cd = Math.max(cdv, lk?.left ?? 0), cost = costOf(F, key); // 진동 잠김도 재사용 대기처럼
    const lowMana = F.mana < cost, lowPower = !!sk.power && F.power3 < (sk.powerAll ? 1 : sk.power);
    const resource = sk.power ? `힘 ${sk.powerAll ? '1~3' : sk.power}` : cost ? `마나 ${Math.round(cost * 10) / 10}%` : '마나 0';
    setText(el.querySelector('.nm')!, sk.short);
    // 일반·축소는 같은 내용과 순서를 사용한다. 패널 바깥 배율만 바뀐다.
    const visibleCost = sk.power ? (sk.powerAll ? '힘1+' : `힘${sk.power}`) : `${Math.round(cost * 10) / 10}%`;
    setText(el.querySelector('.ct')!, visibleCost);
    el.querySelector<HTMLElement>('.cd')!.style.setProperty('--p', cd > 0 ? `${Math.min(1, cd / (lk && lk.left >= cdv ? lk.total : cdMax(F, key))) * 100}%` : '0%');
    setText(el.querySelector('.cds')!, cd > 0 ? `${Math.ceil(cd)}초` : '');
    const label = `${sk.name}, ${lk ? `진동으로 잠김 ${Math.ceil(cd)}초` : cd > 0 ? `재사용 대기 ${Math.ceil(cd)}초` : resource}${lowMana ? ', 마나 부족' : lowPower ? ', 신성한 힘 부족' : ''}${B.armed === slot ? ', 선택됨. 대상 선택 또는 다시 눌러 취소' : ''}`;
    if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
    el.setAttribute('aria-pressed', String(B.armed === slot));
    el.classList.toggle('off', cd > 0 || lowMana || lowPower);
    el.classList.toggle('resource-low', lowMana || lowPower);
    el.classList.toggle('cooling', cd > 0);
    el.classList.toggle('armed', B.armed === slot);
    el.classList.toggle('holy', key === 'serenity' || key === 'sanctify');
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
  // 직업 고유 시스템 = 단축칸 아래 작은 막대 2줄 (시안 20인): 사제 평온·신성화 / 드루이드 새싹 걸린 인원 / 성기사 신성한 힘 · 봉화
  const r = coreRing(F);
  const gaugeLabels = $('gauges').querySelectorAll<HTMLElement>('.gl');
  if (F.hero === 'paladin' && gaugeLabels[0]) setText(gaugeLabels[0], '신성한 힘');
  $('gauges').setAttribute('aria-label', F.hero === 'paladin' ? `신성한 힘 ${r.a}, 봉화 ${r.b}`
    : F.hero === 'druid' ? `새싹 ${r.a}명 / ${r.b}명` : `평온 ${r.a}%, 신성화 ${r.b}%`);
  setText($('gP'), r.a);
  setText($('gS'), r.b);
  setBar($('gPb'), r.outer);
  setBar($('gSb'), r.inner);
}
function setBar(el: HTMLElement | null, v: number): void {
  if (!el) return;
  const w = `${Math.round(Math.max(0, Math.min(1, v)) * 1000) / 10}%`;
  if (el.style.width !== w) el.style.width = w;
}

const dispelName = (F: Fight) => { const n = SKILLS[HEROES[F.hero].slots.dispel!].name; return n + josa(n, '으로', '로'); };

/** 고유 시스템 막대 한 줄: 이름 · 막대 · 값 (시안 20인 평온·신성화) */
const gaugeRow = (label: string, bar: string, val: string, tone: string) => `<div class="gr ${tone}"><span class="gl">${label}</span><span class="gt"><i id="${bar}"></i></span><span class="gv">${val}</span></div>`;
/** 단축칸 아래 고유 시스템 막대 (전투 시작 때 직업에 맞게) */
export function buildGauges(F: Fight): void {
  const g = $('gauges');
  g.innerHTML = F.hero === 'paladin' ? gaugeRow('신성한 힘', 'gPb', '<b id="gP">0/3</b>', 'gold') + gaugeRow('봉화', 'gSb', '<b id="gS">없음</b>', 'calm')
    // 드루이드: 새싹이 걸린 인원 / 살아 있는 인원 (막대 하나)
    : F.hero === 'druid' ? gaugeRow('새싹', 'gPb', '<b id="gP">0</b>/<b id="gS">0</b>', 'leaf') + '<i id="gSb" hidden></i>'
    : gaugeRow('평온', 'gPb', '<b id="gP">0</b>%', 'calm') + gaugeRow('신성화', 'gSb', '<b id="gS">0</b>%', 'gold');
}

/** 고유 시스템 막대 두 개(0~1)와 값 글자 둘 */
function coreRing(F: Fight): { outer: number; inner: number; a: string; b: string } {
  if (F.hero === 'paladin') {
    const cd = F.beaconCd > 0 ? Math.ceil(F.beaconCd) : 0;
    const sys = HEROES.paladin.system.lv;
    const nick = F.beacon == null ? '' : F.party.find(u => u.id === F.beacon)?.nick || '';
    return { outer: F.power3 / 3, inner: cd ? 1 - F.beaconCd / BEACON.cd : 0, a: `${F.power3}/3`, b: F.level < sys ? `Lv ${sys}` : !nick ? '없음' : cd ? `${nick} ${cd}초` : nick };
  }
  if (F.hero === 'druid') {
    const live = F.party.filter(u => u.alive), n = live.filter(u => u.hots.some(h => h.key === 'sprout')).length;
    return { outer: live.length ? n / live.length : 0, inner: 0, a: String(n), b: String(live.length) };
  }
  // 아껴 둔 말씀 (특성)이면 200까지 모임: 링은 100에서 가득, 숫자는 그대로
  return { outer: Math.min(1, F.g.p / 100), inner: Math.min(1, F.g.s / 100), a: String(Math.floor(F.g.p)), b: String(Math.floor(F.g.s)) };
}

// ---------- 특성 보조 버튼 (06 9장 2번: 휠 밖 버튼, 단축칸 위) ----------
export function buildAux(): void {
  const keys = Object.keys(fight().tx.act) as TalentKey[];
  $('aux').hidden = !keys.length;
  $('controls').classList.toggle('hasaux', keys.length > 0); // 보조 버튼 자리: 아래 안내 글은 뺌
  $('aux').innerHTML = keys.map(k => `<button class="aux" type="button" data-tal="${k}" aria-label="${TALENT_DEF[k].name}"><span class="nm">${TALENT_DEF[k].active!.short}</span><span class="cd"></span><span class="cds"></span></button>`).join('');
}
export function updateAux(): void {
  const F = fight();
  for (const el of $('aux').querySelectorAll<HTMLElement>('.aux[data-tal]')) {
    const k = el.dataset.tal as TalentKey, a = F.tx.act[k], def = TALENT_DEF[k].active!;
    if (!a) continue;
    const on = activeOn(F, k), spent = !!def.once && a.used;
    el.querySelector<HTMLElement>('.cd')!.style.setProperty('--p', !on && a.cd > 0 ? `${(a.cd / def.cd) * 100}%` : '0%');
    setText(el.querySelector('.cds')!, on ? String(Math.ceil(a.left)) : a.cd > 0 ? String(Math.ceil(a.cd)) : spent ? '✓' : '');
    el.classList.toggle('on', on);
    el.classList.toggle('off', !on && (a.cd > 0 || spent));
    el.classList.toggle('armed', ui.talArmed === k);
  }
}
export function openTalentTip(k: TalentKey, el: HTMLElement): void {
  const d = TALENT_DEF[k], a = d.active!;
  const row = a.once ? '전투당 1회' : `${a.dur}초 · 재사용 대기 ${a.cd}초`;
  const F = fight();
  popTip(tipHtml({ name: d.name, kind: '특성', rows: [['즉시', row]], desc: healText(d.desc, INT_BASE * F.power * F.gear.heal), note: a.cell ? '누른 뒤 빈 칸을 탭' : 'GCD·마나 없이 바로' }), el, null);
}

// ---------- 소비 아이템 단축칸 (19 2부): 2×2, 레벨에 따라 열린 칸 수가 다름 (18 2-2) ----------
const ITEM_SLOTS = 4;
const slotLv = (i: number) => ITEM_SLOT_LV.find(lv => itemSlots(lv) > i) ?? ITEM_SLOT_LV[2];
export function buildItems(): void {
  const keys = Object.keys(fight().items) as ItemKey[];
  let html = '';
  for (let i = 0; i < ITEM_SLOTS; i++) {
    const k = keys[i];
    // 시안: 잠긴 칸 = 평평한 어두운 칸 + 자물쇠 + Lv, 아이템 칸 = 네모 청동 테 + 그림 + 이름 + 오른쪽 아래 개수
    if (i >= S.slots) { html += `<div class="item empty locked" role="img" aria-label="잠긴 칸 (Lv ${slotLv(i)})">${LOCK_SVG}<span class="nm">Lv ${slotLv(i)}</span></div>`; continue; }
    if (!k) {
      const emptyArt = art('skill-heal');
      html += `<div class="item empty" aria-hidden="true">${emptyArt ? `<img class="item-art empty-slot-art" src="${emptyArt}" alt="" aria-hidden="true" decoding="async" draggable="false">` : ''}<span class="nm">빈 칸</span></div>`;
      continue;
    }
    const painted = art(`ui-sunforged-potion-${k}`);
    const icon = painted ? `<img class="item-art" src="${painted}" alt="" aria-hidden="true" decoding="async" draggable="false">` : ITEM_ICON[k];
    html += `<button class="item" type="button" data-item="${k}" aria-label="${ITEMS[k].name}">${icon}<span class="nm">${ITEMS[k].short}</span><span class="n"></span><span class="cd"></span><span class="cds"></span></button>`;
  }
  $('items').innerHTML = html;
}
export function updateItems(): void {
  const F = fight();
  for (const el of $('items').querySelectorAll<HTMLElement>('.item[data-item]')) {
    const key = el.dataset.item as ItemKey, it = ITEMS[key], left = F.items[key] || 0;
    const cd = it.kind === 'potion' && left > 0 ? F.potCd : 0;
    setText(el.querySelector('.n')!, String(left));
    const label = `${it.name} ${left}개`;
    if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
    el.querySelector<HTMLElement>('.cd')!.style.setProperty('--p', cd > 0 ? `${(cd / POTION_CD) * 100}%` : '0%');
    setText(el.querySelector('.cds')!, cd > 0 ? String(Math.ceil(cd)) : '');
    el.classList.toggle('off', left <= 0 || cd > 0);
    el.classList.toggle('used', left <= 0);
    el.classList.toggle('armed', ui.itemArmed === key);
  }
}

// ---------- 시전 막대 (시안: 화면 폭 막대 안에 「스킬 → 대상」 · 남은 초, 채움 끝에 밝은 선) ----------
export function updateCastbar(): void {
  const F = fight();
  let label: string, detail = '', p = 0, left = '';
  if (F.cast) {
    const u = F.party.find(x => x.id === F.cast!.uid);
    label = `${SKILLS[F.cast.key].short} → ${u ? u.nick : ''}`;
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
    label = `${SKILLS[k].name} 장전: ${SKILLS[k].target === 'area' ? '누른 채 범위를 보고 떼기' : '대상 칸 선택'}`;
  } else if (F.queued) {
    label = `다음: ${SKILLS[F.queued.key].name}`;
  } else {
    const selected = F.party.find(u => u.id === ui.selectedUnitId);
    if (selected) {
      const hp = `${Math.ceil(selected.hp)}/${Math.ceil(selected.max)} (${Math.ceil(selected.hp / selected.max * 100)}%)`;
      const types = [...new Set(selected.debuffs.map(d => d.type))];
      label = `${selected.nick} · ${selected.alive ? `HP ${hp}` : '쓰러짐'}${types.length ? ` · ${types.join('/')}` : ''}`;
      detail = `${selected.nick}, ${selected.alive ? `체력 ${hp}` : '쓰러짐'}. ${selected.debuffs.length ? selected.debuffs.map(d => `${d.name} (${d.type}), ${Math.ceil(d.left)}초${d.stack ? `, ${d.stack}중첩` : ''}, ${!canDispel(F.hero, d.type) ? '해제 불가' : d.trap ? '해제 주의: 옆 칸으로 전파' : '해제 가능'}`).join('. ') : '디버프 없음'}`;
    } else label = F.gcd > 0 ? '공통 재사용 대기' : `칸을 탭하면 ${SKILLS[tapKey()].name}`;
    p = F.gcd > 0 ? F.gcd / F.gcdBase : 0;
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
}

// ---------- 파티원 공격 숫자 (2026-10-07 Lim: 합치지 않고 한 방씩) ----------
// 한 방씩 유지하되 동시 표시를 서로 겹치지 않는 세 줄로 제한한다.
const DMG_POOL = 3;
const dmg = { els: [] as HTMLSpanElement[], i: 0, avg: 0, hurtAt: 0 };
export function resetDmgNums(): void {
  const box = $('dmgNums');
  if (!dmg.els.length) for (let k = 0; k < DMG_POOL; k++) { const s = document.createElement('span'); s.style.setProperty('--row', String(k)); box.appendChild(s); dmg.els.push(s); }
  for (const s of dmg.els) s.className = '';
  dmg.avg = 0; dmg.i = 0; dmg.hurtAt = 0;
}
export function dmgNum(u: Unit | undefined, amt: number, now: number): void {
  if (S.reducedEffects) return;
  if (!dmg.els.length) resetDmgNums();
  const el = dmg.els[dmg.i]; dmg.i = (dmg.i + 1) % DMG_POOL;
  const n = Math.max(1, Math.round(amt));
  dmg.avg = dmg.avg ? dmg.avg * 0.9 + amt * 0.1 : amt;
  el.textContent = String(n);
  el.className = `${u ? u.role : ''}${amt > dmg.avg * 1.6 ? ' big' : ''}`;
  void el.offsetWidth;
  el.classList.add('go');
  if (now - dmg.hurtAt > 160) { dmg.hurtAt = now; const a = $('bossArt'); a.classList.remove('hurt'); void a.offsetWidth; a.classList.add('hurt'); }
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
/** 곧 떨어지는 칸 (빨강): 시전 중이거나 이 초 이하 */
const QSOON = 5;
/** 예고 전용 이름. 긴 정식 이름은 설명·접근성 이름에 유지한다. */
const QSHORT: Record<string, string> = {
  '고철 휘두르기': '휘두', '쇳조각 비': '쇳비', '내려찍기': '강타', '증기 분출': '분출', '증기 폭발': '폭발',
  '녹물 웅덩이': '녹물', '썩은 숨결': '숨결', '독침': '독침', '역병 파동': '파동', '전염': '전염', '역병 폭풍': '폭풍',
  '지휘봉': '지휘', '크레센도': '크레', '포르테': '포르', '독창': '독창', '인터미션 끝': '복귀',
  '고철 폭주': '폭주', '증기 폭주': '폭주', '역병 폭주': '폭주', '대합창': '합창',
};
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

/**
 * 판마다 한 번: 보스 체력 막대의 페이즈 눈금, 던전 구간 진행 ●●○○ (보스 이름 줄 오른쪽).
 * 눈금 = 공략의 「체력 N%」 페이즈 + 지휘자처럼 마지막에 나오는 보스 적의 시작점
 */
export function buildStage(): void {
  const F = fight(), R = S.run!;
  const ticks = new Set<number>();
  for (const p of guideOf(F).phases) { const m = /^체력 (\d+)%/.exec(p.at); if (m && +m[1] > 0 && +m[1] < 100) ticks.add(+m[1] / 100); }
  const total = F.mobs.reduce((a, m) => a + m.max, 0), boss = F.mobs.filter(m => m.boss).reduce((a, m) => a + m.max, 0);
  if (total > 0 && boss > 0 && boss < total) ticks.add(boss / total);
  $('bossTicks').innerHTML = [...ticks].map(v => `<i style="left:${(v * 100).toFixed(1)}%"></i>`).join('');
  const dots = $('segDots'), n = R.segs.length;
  dots.hidden = n < 2;
  dots.setAttribute('role', 'img');
  dots.setAttribute('aria-label', `던전 구간 ${R.idx + 1}/${n}`);
  dots.innerHTML = n < 2 ? '' : R.segs.map((_, i) => `<i class="${i < R.idx ? 'done' : i === R.idx ? 'cur' : ''}"></i>`).join('');
}

export function updateStage(now: number): void {
  const F = fight(), R = S.run!;
  $('battle').classList.toggle('reduced-effects', S.reducedEffects);
  const pct = F.bossHp / F.bossMax;
  setBar($('bossFill'), pct);
  setBar($('bossLag'), pct);
  bossAura(F);
  setText($('bossHpText'), `${Math.ceil(F.bossHp).toLocaleString('ko-KR')} · ${Math.ceil(pct * 100)}%${F.invuln ? ' · 무적' : F.daze ? ` · ${F.daze.name ?? '멍함'} ${Math.ceil(F.daze.until - F.t)}` : F.mobs.length && bossTaken(F) < 1 ? ' · 보호막' : ''}${F.empower ? ` · 강해짐 +${Math.round(F.empower * 100)}%` : ''}${F.weak ? ` · 약해짐 ${Math.ceil(F.weak.until - F.t)}` : ''}${watchText(F)}`);
  bossGauge(F);
  // 위치 줄 (시안 「녹슨 요새 4/4 · 보통」): 던전 = 이름 n/전체 · 페이즈·남은 적·난이도, 한 판 = 등급 · 페이즈·난이도
  let ph = F.phaseName ? `${F.enc.tier.split(' · ')[0]} · ${F.phaseName}` : `${F.enc.tier} · ${F.cfg.diff}`;
  if (R.segs.length > 1) {
    const left = F.mobs.filter(m => m.alive && !m.add).length;
    ph = `${R.name} ${R.idx + 1}/${R.segs.length} · ${F.phaseName || (F.bodyHp ? `남은 적 ${left}` : F.cfg.diff)}`;
  }
  setText($('phase'), ph);
  const adds = $('bossAdds'), ratsOn = F.rats.length > 0 && adds.hasAttribute('src');
  if (adds.hidden === ratsOn) adds.hidden = !ratsOn;
  // 시간 줄 (시안 「0:42 · 광폭까지 3:48」). 탱커 공백 (35 6-4)이면 광폭까지 남은 초를 빨갛게
  const noTank = F.noTankAt != null && !F.enraged ? Math.max(0, Math.ceil(NO_TANK_SEC - (F.t - F.noTankAt))) : null;
  if (S.limit) {
    // 주간 도전 (13 3-2): 던전 전체 제한시간 (휴식 뺀 전투 시간 합)
    const used = R.time + F.t;
    setText($('timer'), `${mmss(used)} / ${mmss(S.limit)}${F.enraged ? ' · 광폭화!' : noTank != null ? ` · 탱커 없음 ${noTank}` : ''}`);
    $('timer').classList.toggle('over', used > S.limit);
  } else setText($('timer'), F.enraged ? `${mmss(F.t)} · 광폭화!` : noTank != null ? `${mmss(F.t)} · 탱커 없음 · 광폭까지 ${mmss(noTank)}` : isFinite(F.enc.enrage) ? `${mmss(F.t)} · 광폭까지 ${mmss(Math.ceil(F.enc.enrage - F.t))}` : mmss(F.t));
  $('timer').classList.toggle('enraged', F.enraged || noTank != null);
  if (now - ui.qAt > 90) {
    ui.qAt = now;
    const q = queue(F).map(it => ({ ...it, kind: it.kind as string | undefined }));
    if (F.phaseName === '인터미션' && F.interEnd) q.unshift({ name: '인터미션 끝', icon: '쥐떼', kind: 'inter', impact: F.interEnd, casting: false });
    q.splice(3);
    const queueEl = $('queue');
    let cards = Array.from(queueEl.querySelectorAll<HTMLElement>('.q'));
    let refocus: HTMLElement | undefined;
    // 같은 기술·발동 시각의 대기열은 DOM을 유지: 카운트다운 때문에 포커스를 다시 만들지 않는다.
    const changed = queueEl.children.length !== 3 || cards.length !== q.length || q.some((it, i) => cards[i]?.dataset.ic !== (it.icon || '') || cards[i]?.dataset.imp !== it.impact.toFixed(2));
    if (changed) {
      const focused = document.activeElement instanceof HTMLElement && queueEl.contains(document.activeElement) ? { ...document.activeElement.dataset } : null;
      // 예고 칸 3개를 늘 표시 (27 3-4): 기술이 없으면 빈 테두리 칸
      queueEl.innerHTML = q.map(it => `<button type="button" class="q" data-ic="${it.icon || ''}" data-imp="${it.impact.toFixed(2)}" data-kind="${it.kind || ''}"><span class="fill"></span><span class="ic">${qIcon(it.kind)}</span><span class="tx"><span class="nm"></span><span class="kd">${qKind(it.kind).name}</span></span><span class="sec"><b class="sec-num"></b><small>초</small></span></button>`).join('')
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
      setText(el.querySelector('.nm')!, QSHORT[it.name || ''] || it.icon || it.name || '기술');
      setText(el.querySelector('.sec-num')!, String(Math.ceil(sec)));
      const label = `${it.name || '기술'}, ${qKind(it.kind).name}, ${Math.ceil(sec)}초 뒤${it.casting ? ', 시전 중' : ''}. 기술 설명`;
      if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      setBar(el.querySelector<HTMLElement>('.fill'), sec / QWIN);
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
    if (firstBuster && !ui.busterHint && !S.auto) { ui.busterHint = true; toast(`${firstBuster.skill.name}: 탱커에게 ${Math.round(firstBuster.skill.dmg! * F.dmgMult)} 피해. 미리 채우거나 수호 영혼`); }
  }
  $('battle').classList.toggle('aoe', F.tels.some(t => t.kind === 'aoe'));
  // 탱커가 모두 쓰러지면 아래에 포기 버튼 (2026-10-07 Lim). 전투는 파티 전멸까지 계속
  const down = !F.over && F.party.some(u => u.role === 'tank') && !F.party.some(u => u.role === 'tank' && u.alive);
  if ($('giveUp').hidden === down) { $('giveUp').hidden = !down; $('hint').hidden = down; }
  $('controls').classList.toggle('tank-down', down);
}

// ---------- 설명 팝업 (보스 기술 · 스킬 · 아이템 같은 모양) ----------
// 예고 칸을 누르면 그 기술이 무엇인지 한 줄로. 게임은 멈추지 않음. 같은 칸 다시 누르기 / 다른 곳 누르기 / 4초 뒤 닫힘.
// 팝업은 pointer-events: none 이라 아래 판 터치·쓸기를 막지 않음
const TIP_MS = 4000;
/** 같은 기술이 대기열에 두 번 있을 수 있어, 누른 그 회차를 맞을 시각(impact)으로 따라감 */
export const tipMatch = (ic: string, imp: number) => !!ui.tip && ui.tip.ic === ic && Math.abs(imp - (ui.tip.imp ?? -1e9)) < 0.2;
function popTip(html: string, el: HTMLElement, tip: typeof ui.tip): void {
  const t = $('tip');
  t.innerHTML = html; t.hidden = false;
  ui.tip = tip;
  placeTip(el);
  clearTimeout(ui.tipTimer);
  ui.tipTimer = setTimeout(closeTip, TIP_MS);
}
export function openTip(ic: string, qEl: HTMLElement): void {
  const F = fight(), s = guideOf(F).skills.find(x => x.ic === ic);
  if (!s) { closeTip(); return; }
  const [what] = s.tip(F);
  popTip(tipHtml({ icon: `<span class="ic qk">${qIcon(qEl.dataset.kind)}</span>`, name: s.name, kind: F.enc.script === 'trash' ? '적 기술' : '보스 기술', rows: [[s.every]], desc: what }), qEl, { ic, imp: +qEl.dataset.imp! });
  ui.skillTips++;
  for (const q of $('queue').querySelectorAll<HTMLElement>('.q')) q.classList.toggle('tipon', tipMatch(q.dataset.ic!, +q.dataset.imp!));
}
export function openSkillTip(key: SkillKey, el: HTMLElement): void {
  const lock = B.F && !knows(B.F, key) ? SKILL_LEVEL[key] : 0;
  popTip(tipHtml(skillTip(key, lock, B.F ? INT_BASE * B.F.power * B.F.gear.heal : undefined)), el, { skill: key });
}
export function openItemTip(key: ItemKey, el: HTMLElement): void {
  popTip(tipHtml(itemTip(key, `<span class="iic">${ITEM_ICON[key]}</span>`, fight().items[key] || 0)), el, { item: key });
  ui.itemTips++;
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
export function showPreview(idx: number): void {
  const F = fight(), u = F.cells[idx].unit!;
  const lines: string[] = [];
  const cls = u.cls ? CLASSES[u.cls] : null;
  lines.push(`<b>${u.nick}</b> · ${cls ? `${cls.name} · ` : ''}${ROLE[u.role].name}${u.me ? ` (${HEROES[F.hero].name})` : ''}`);
  if (cls) lines.push(`<div class="cpas"><b>${cls.passive}</b> ${cls.passiveDesc}</div>`);
  if (u.ab) {
    const ab = ABILITIES[u.ab.key];
    const left = ab.cd > 0 ? Math.max(0, u.ab.ready - F.t) : 0;
    const state = ab.cd === 0 && !ab.each ? '상시' : ab.cd < 0 ? (u.ab.uses ? '사용함' : '1회 준비') : left > 0.05 ? `${Math.ceil(left)}초 뒤` : '준비';
    lines.push(`<div class="cpas ab"><b>${AB_KIND[ab.kind].icon} ${ab.name}${u.ab.star ? ` ${'★'.repeat(u.ab.star)}` : ''}</b> ${ab.desc} <small>(${state})</small></div>`);
  }
  for (const k of u.traits) lines.push(`<div class="cpas trait"><b>${TRAITS[k].name}</b> ${TRAITS[k].desc}</div>`);
  if (u.p.ch && u.p.cat) lines.push(`<div class="pers"><i style="background:${CATS[u.p.cat]}">${u.p.ch}</i>${u.pers}: ${u.p.desc}</div>`);
  lines.push(`<div>체력 ${Math.ceil(u.hp)} / ${Math.round(u.max)}${u.max < u.base ? ` (최대 체력 -${Math.round((1 - u.max / u.base) * 100)}%)` : ''}</div>`);
  const items: string[] = [];
  const hero = HEROES[F.hero];
  for (const d of u.debuffs) items.push(`${d.name} (${d.type}${d.stack ? ` ${d.stack}중첩` : ''}, ${Math.ceil(d.left)}초)${!canDispel(F.hero, d.type) ? ` · ${hero.name} 해제 불가` : d.trap ? ' · 해제하면 옆 칸으로 퍼짐' : ` · ${dispelName(F)} 해제`}`);
  if (u.hot > 0) items.push(`소생 ${Math.ceil(u.hot)}초`);
  for (const h of u.hots) items.push(`${h.name} ${Math.ceil(h.left)}초 (남은 회복 ${Math.round(h.rest)})`);
  if (F.beacon === u.id) items.push('봉화: 다른 사람에게 한 직접 힐의 40%가 함께 들어감');
  if (u.redu > 0 && !u.immune) items.push(`받는 피해 -${Math.round(u.reduCut * 100)}% ${Math.ceil(u.redu)}초`);
  if (u.sacr > 0) items.push(`희생 ${Math.ceil(u.sacr)}초 (받는 피해 30%를 내가 대신)`);
  if (u.immune > 0) items.push(`보호의 손 ${Math.ceil(u.immune)}초 (물리 피해 무시, 딜 멈춤)`);
  if (u.guardian > 0) items.push(`수호 영혼 ${Math.ceil(u.guardian)}초`);
  if (u.shield > 0) items.push(`보호 두루마리 ${Math.ceil(u.shield)}초 (받는 피해 -40%)`);
  if (u.bulwark > 0) items.push(`${TRAITS.bulwark.name} ${Math.ceil(u.bulwark)}초 (받는 피해 -50%)`);
  if (!u.alive) items.push('쓰러짐');
  if (items.length) lines.push(`<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>`);
  $('preview').innerHTML = lines.join('');
  $('preview').classList.toggle('low', center(idx).y < L.H / 2);
  $('preview').hidden = false;
  vibe(10);
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
  dungeon: [
    { when: f => f.enc.script === 'trash' && f.t >= 1, freeze: false, text: '던전은 일반·정예 구간과 보스를 이어서 진행. 구간 사이엔 쉬면서 마나 회복' },
    { when: f => !!firstTel(f, 'aoe'), text: '<b>광역 예고</b>! 맞기 전에 <b>소생</b>을 걸어 두면 덜 아픔. 위쪽 예고 칸을 누르면 설명' },
    { when: f => f.mana < 30 && Object.keys(f.items).length > 0, text: '마나 부족. 왼쪽 <b>단축칸</b>의 물약 누르기' },
    { when: f => f.zones.length > 0, freeze: false, text: '바닥 장판은 파티원이 알아서 피함. 못 피한 사람을 채우기' },
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
  const c = center(u.cell), v = DIR_VEC[d.d], len = Math.max(44, L.s * 1.3);
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
  coachEl.classList.toggle('top', !!u && center(u.cell).y > L.H / 2);
  coachEl.hidden = false;
  if (st.slot) $('wheel').querySelector(`.slot[data-slot="${st.slot}"]`)?.classList.add('coach-hi');
  Snd.play('tick'); vibe(15);
}
export function clearCoach(): void {
  ui.coach = null; coachEl.hidden = true; swipeEl.hidden = true; swipeEl.innerHTML = '';
  $('wheel').querySelectorAll('.coach-hi').forEach(el => el.classList.remove('coach-hi'));
}
/** 안내가 바란 스킬을 쓰면 다음으로 */
export function coachUsed(key: string): void { if (ui.coach && ui.coach.need && ui.coach.need === key) clearCoach(); }
