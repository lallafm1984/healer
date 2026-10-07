/**
 * 전투 화면의 HTML 부분: 스킬 휠 · 단축칸 · 시전 막대 · 보스 무대(예고 대기열) · 설명 팝업 · 길게 누르기 정보 · 튜토리얼 안내 · 포기 버튼.
 * 매 프레임 바뀐 글자·클래스만 고침 (판은 board.ts가 캔버스에).
 */
import { CLASSES } from '../data/classes';
import { BEACON } from '../data/heroConst';
import { canDispel, HEROES } from '../data/heroes';
import { mobGrade } from '../data/encounters';
import type { ItemKey } from '../data/items';
import { ITEMS, POTION_CD } from '../data/items';
import { CATS } from '../data/personalities';
import { itemSlots } from '../data/progression';
import { SKILL_LEVEL, SKILLS, type SkillKey } from '../data/skills';
import { itemTip, skillTip, tipHtml } from '../game/tooltip';
import { TRAITS } from '../data/traits';
import { TALENT_DEF, type TalentKey } from '../data/talents';
import { activeOn, cdMax, costOf, knows, queue, slotKey, type Fight, type Unit } from '../engine';
import { ITEM_ICON } from './art';
import { center, L } from './board';
import { $, arrowOf, B, DIR_VEC, DIRS, ICON_COLOR, josa, mmss, ROLE, S, Snd, tapKey, toast, ui, vibe } from './core';
import { guideModel } from './guide';

const fight = () => B.F!;
const setText = (el: Element, t: string) => { if (el.textContent !== t) el.textContent = t; };

/** 지금 판의 공략 (단계 레벨까지 반영한 숫자) */
export const guideOf = (F: Fight, encKey = F.enc.key) => guideModel(encKey, F.cfg.diff, F.cfg.stageLv, F.cfg.heroLv);

/** 일반·정예 구간은 지금 잡는 적 이름과 등급을 같이 (HTML, 이름은 데이터라 그대로) */
export function bossTitle(): string {
  const F = fight(), m = F.mobs.find(x => x.alive);
  return m ? `${F.enc.name} · ${m.name}<small class="grade${m.elite ? ' elite' : ''}">${mobGrade(m)}</small>` : F.enc.name;
}

// ---------- 스킬 휠 ----------
export function buildWheel(D: number): void {
  const w = $('wheel'), F = B.F;
  w.style.width = w.style.height = D + 'px';
  const step = D / 3, b = step * 0.9, core = step * 1.0;
  let html = `<div id="core" style="left:${(D - core) / 2}px;top:${(D - core) / 2}px;width:${core}px;height:${core}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#2A2C48" stroke-width="6"/><circle id="ringP" cx="50" cy="50" r="46" fill="none" stroke="#F0C46A" stroke-width="6" stroke-linecap="round" stroke-dasharray="0 289"/><circle cx="50" cy="50" r="38" fill="none" stroke="#2A2C48" stroke-width="5"/><circle id="ringS" cx="50" cy="50" r="38" fill="none" stroke="#51C6C0" stroke-width="5" stroke-linecap="round" stroke-dasharray="0 239"/></svg><div id="manaNum">100<small>마나</small></div></div>`;
  DIRS.forEach((it, i) => {
    if (!it) return;
    const pos = `left:${(i % 3) * step + (step - b) / 2}px;top:${Math.floor(i / 3) * step + (step - b) / 2}px;width:${b}px;height:${b}px`;
    if (!it.key) { html += `<div class="slot empty" data-dir="${it.d}" style="${pos}"><span class="dir">${it.arrow}</span><span class="ct">비어 있음</span></div>`; return; }
    // 아직 안 배운 스킬: 이름과 배우는 레벨만 (누르면 안내). it.key = 휠 칸 → 지금 직업의 스킬
    const k = F ? slotKey(F, it.key) : (it.key as SkillKey);
    if (F && !knows(F, k)) { html += `<button class="slot locked" type="button" data-lock="${k}" data-dir="${it.d}" style="${pos}"><span class="dir">${it.arrow}</span><span><span class="nm">${SKILLS[k].short}</span><span class="ct">🔒 Lv ${SKILL_LEVEL[k]}</span></span></button>`; return; }
    html += `<button class="slot" type="button" data-slot="${it.key}" data-dir="${it.d}" style="${pos}"><span class="cd"></span><span class="dir">${it.arrow}</span><span><span class="nm"></span><span class="ct"></span></span><span class="cds"></span></button>`;
  });
  w.innerHTML = html;
}

export function updateWheel(): void {
  const F = fight(), aim = ui.pointer && ui.pointer.dir;
  for (const el of $('wheel').querySelectorAll<HTMLElement>('.slot')) {
    el.classList.toggle('aim', aim === el.dataset.dir);
    if (!el.dataset.slot) continue;
    const slot = el.dataset.slot!, key = slotKey(F, slot), sk = SKILLS[key];
    const cd = sk.cd ? F.cd[key] || 0 : 0, cost = costOf(F, key);
    setText(el.querySelector('.nm')!, sk.short);
    setText(el.querySelector('.ct')!, cost ? `${Math.round(cost * 10) / 10}%` : '무료');
    el.querySelector<HTMLElement>('.cd')!.style.setProperty('--p', cd > 0 ? `${Math.min(1, cd / cdMax(F, key)) * 100}%` : '0%');
    setText(el.querySelector('.cds')!, cd > 0 ? String(Math.ceil(cd)) : '');
    el.classList.toggle('off', cd > 0 || F.mana < cost);
    el.classList.toggle('cooling', cd > 0);
    el.classList.toggle('armed', B.armed === slot);
    el.classList.toggle('holy', key === 'serenity' || key === 'sanctify');
  }
  const mn = $('manaNum');
  setText(mn.firstChild as Element, String(Math.floor(F.mana)));
  mn.style.color = F.mana < 20 ? '#FF8A7A' : '#9FD3FF';
  // 휠 가운데 링 = 직업 고유 시스템 (25 7장): 사제 성언 게이지 두 개 / 드루이드 새싹 걸린 인원 / 성기사 신성한 힘 3칸
  const r = coreRing(F);
  $('ringP').setAttribute('stroke-dasharray', `${r.outer * 289} 289`);
  $('ringS').setAttribute('stroke-dasharray', `${r.inner * 239} 239`);
  setText($('gP'), r.a);
  setText($('gS'), r.b);
  $('core').classList.toggle('beacon', B.beacon);
}

const dispelName = (F: Fight) => { const n = SKILLS[HEROES[F.hero].slots.dispel!].name; return n + josa(n, '으로', '로'); };

/** 휠 위 고유 시스템 글자 (전투 시작 때 직업에 맞게) */
export function buildGauges(F: Fight): void {
  const g = $('gauges');
  g.innerHTML = F.hero === 'paladin' ? '<span>신성한 힘 <b id="gP">0/3</b></span><span>봉화 <b id="gS">없음</b></span>'
    : F.hero === 'druid' ? '<span>새싹 <b id="gP">0</b> / <b id="gS">0</b>명</span>'
    : '<span>평온 <b id="gP">0</b>%</span><span>신성화 <b id="gS">0</b>%</span>';
}

/** 가운데 링 두 개(0~1)와 그 아래 글자 둘 */
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
  popTip(tipHtml({ name: d.name, kind: '특성', rows: [['즉시', row]], desc: d.desc, note: a.cell ? '누른 뒤 빈 칸을 탭' : 'GCD·마나 없이 바로' }), el, null);
}

// ---------- 소비 아이템 단축칸 (19 2부): 2×2, 레벨에 따라 열린 칸 수가 다름 (18 2-2) ----------
const ITEM_SLOTS = 4;
const slotLv = (i: number) => [1, 20, 40].find(lv => itemSlots(lv) > i) ?? 40;
export function buildItems(): void {
  const keys = Object.keys(fight().items) as ItemKey[];
  let html = '';
  for (let i = 0; i < ITEM_SLOTS; i++) {
    const k = keys[i];
    if (i >= S.slots) { html += `<div class="item empty locked" aria-label="잠긴 칸 (Lv ${slotLv(i)})"><span class="nm">잠김<br>Lv ${slotLv(i)}</span></div>`; continue; }
    if (!k) { html += '<div class="item empty" aria-hidden="true"><span class="nm">빈 칸</span></div>'; continue; }
    html += `<button class="item" type="button" data-item="${k}" aria-label="${ITEMS[k].name}">${ITEM_ICON[k]}<span class="nm">${ITEMS[k].short}</span><span class="n"></span><span class="cd"></span><span class="cds"></span></button>`;
  }
  $('items').innerHTML = html;
}
export function updateItems(): void {
  const F = fight();
  for (const el of $('items').querySelectorAll<HTMLElement>('.item[data-item]')) {
    const key = el.dataset.item as ItemKey, it = ITEMS[key], left = F.items[key] || 0;
    const cd = it.kind === 'potion' && left > 0 ? F.potCd : 0;
    setText(el.querySelector('.n')!, `×${left}`);
    el.querySelector<HTMLElement>('.cd')!.style.setProperty('--p', cd > 0 ? `${(cd / POTION_CD) * 100}%` : '0%');
    setText(el.querySelector('.cds')!, cd > 0 ? String(Math.ceil(cd)) : '');
    el.classList.toggle('off', left <= 0 || cd > 0);
    el.classList.toggle('used', left <= 0);
    el.classList.toggle('armed', ui.itemArmed === key);
  }
}

// ---------- 시전 막대 ----------
export function updateCastbar(): void {
  const F = fight();
  let label: string, p = 0;
  if (F.cast) {
    const u = F.party.find(x => x.id === F.cast!.uid);
    label = `${SKILLS[F.cast.key].name} → ${u ? u.nick : ''}`;
    p = 1 - F.cast.left / F.cast.total;
  } else if (F.channel > 0) {
    const raid = SKILLS[HEROES[F.hero].slots.raid!];
    label = `${raid.name} (칸을 누르면 끊김)`;
    p = 1 - F.channel / (raid.channel || 4);
  } else if (B.beacon) {
    label = '봉화: 지킬 파티원 칸 선택';
  } else if (B.armed) {
    const k = slotKey(F, B.armed);
    label = `${SKILLS[k].name} 장전: ${SKILLS[k].target === 'area' ? '누른 채 범위를 보고 떼기' : '대상 칸 선택'}`;
  } else if (F.queued) {
    label = `다음: ${SKILLS[F.queued.key].name}`;
  } else {
    label = F.gcd > 0 ? '공통 재사용 대기' : `칸을 탭하면 ${SKILLS[tapKey()].name}`;
    p = F.gcd > 0 ? F.gcd / F.gcdBase : 0;
  }
  setText($('castLabel'), label);
  $('castFill').style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
  $('castFill').style.opacity = F.cast || F.channel > 0 ? '1' : '0.35';
}

// ---------- 파티원 공격 숫자 (2026-10-07 Lim: 합치지 않고 한 방씩) ----------
// 보스 그림 위에 한 방씩 떠오름. 칸이 모자라면 가장 오래된 숫자를 다시 씀 (20인은 많아서 겹치지 않게)
const DMG_POOL = 10;
const dmg = { els: [] as HTMLSpanElement[], i: 0, avg: 0, hurtAt: 0 };
export function resetDmgNums(): void {
  const box = $('dmgNums');
  if (!dmg.els.length) for (let k = 0; k < DMG_POOL; k++) { const s = document.createElement('span'); box.appendChild(s); dmg.els.push(s); }
  for (const s of dmg.els) s.className = '';
  dmg.avg = 0;
}
export function dmgNum(u: Unit | undefined, amt: number, now: number): void {
  if (!dmg.els.length) resetDmgNums();
  const el = dmg.els[dmg.i]; dmg.i = (dmg.i + 1) % DMG_POOL;
  const n = Math.max(1, Math.round(amt));
  dmg.avg = dmg.avg ? dmg.avg * 0.9 + amt * 0.1 : amt;
  el.textContent = String(n);
  el.className = `${u ? u.role : ''}${amt > dmg.avg * 1.6 ? ' big' : ''}`;
  el.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 44)}px`);
  void el.offsetWidth;
  el.classList.add('go');
  if (now - dmg.hurtAt > 160) { dmg.hurtAt = now; const a = $('bossArt'); a.classList.remove('hurt'); void a.offsetWidth; a.classList.add('hurt'); }
}

// ---------- 보스 무대 ----------
export function updateStage(now: number): void {
  const F = fight(), R = S.run!;
  const pct = F.bossHp / F.bossMax;
  $('bossFill').style.width = `${pct * 100}%`;
  $('bossLag').style.width = `${pct * 100}%`;
  setText($('bossHpText'), `${Math.ceil(F.bossHp).toLocaleString('ko-KR')} (${Math.ceil(pct * 100)}%)${F.invuln ? ' · 무적' : ''}`);
  let ph = F.phaseName ? `${F.enc.tier.split(' · ')[0]} · ${F.phaseName}` : `${F.enc.tier} · ${F.cfg.diff}`;
  if (R.segs.length > 1) {
    const left = F.mobs.filter(m => m.alive).length;
    ph = `${R.name} ${R.idx + 1}/${R.segs.length} · ${F.phaseName || (F.mobs.length ? `남은 적 ${left}` : F.cfg.diff)}`;
  }
  setText($('phase'), ph);
  setText($('timer'), F.enraged ? `${mmss(F.t)} · 광폭화!` : isFinite(F.enc.enrage) ? `${mmss(F.t)} / 광폭 ${mmss(F.enc.enrage)}` : mmss(F.t));
  if (now - ui.qAt > 90) {
    ui.qAt = now;
    const q = queue(F).map(it => ({ ...it, kind: it.kind as string | undefined }));
    if (F.phaseName === '인터미션' && F.interEnd) q.unshift({ name: '인터미션 끝', icon: '쥐떼', kind: 'inter', impact: F.interEnd, casting: false });
    $('queue').innerHTML = q.map((it, i) => {
      const sec = Math.max(0, it.impact - F.t), icon = it.icon || '';
      const bar = it.casting ? `<span class="bar" style="transform:scaleX(${Math.min(1, (F.t - it.start!) / (it.impact - it.start!))})"></span>` : '';
      return `<div class="q${i === 0 ? ' first' : ''}${it.casting ? ' casting' : ''}${tipMatch(icon, it.impact) ? ' tipon' : ''}" data-ic="${icon}" data-imp="${it.impact.toFixed(2)}"><span class="ic" style="background:${ICON_COLOR[icon] || '#BBB'}">${icon}</span><span class="tx"><span class="nm">${it.name}</span><span class="sec">${sec < 10 ? sec.toFixed(1) : Math.ceil(sec)}초</span></span>${bar}</div>`;
    }).join('');
    if (ui.tip) { const qe = $('queue').querySelector<HTMLElement>('.q.tipon'); if (qe) placeTip(qe); } // 대기열이 다시 그려져도 팝업은 밖에 있어 유지, 순서가 바뀌면 따라감
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
  popTip(tipHtml({ icon: `<span class="ic" style="background:${ICON_COLOR[ic] || '#BBB'}">${ic}</span>`, name: s.name, kind: F.mobs.length && !F.mobs.some(m => m.boss) ? '적 기술' : '보스 기술', rows: [[s.every]], desc: what }), qEl, { ic, imp: +qEl.dataset.imp! });
  ui.skillTips++;
  for (const q of $('queue').querySelectorAll<HTMLElement>('.q')) q.classList.toggle('tipon', tipMatch(q.dataset.ic!, +q.dataset.imp!));
}
export function openSkillTip(key: SkillKey, el: HTMLElement): void {
  const lock = B.F && !knows(B.F, key) ? SKILL_LEVEL[key] : 0;
  popTip(tipHtml(skillTip(key, lock)), el, { skill: key });
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
