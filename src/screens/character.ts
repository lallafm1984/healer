/**
 * 캐릭터 탭 (Lim 2026-10-07): 내 사제 한 곳에 모음.
 * 장비(09 S10) · 스킬(설명, 휠 배치 09 S17, 칸 탭 기본 힐, 소비 아이템 단축칸) · 특성(06 6장, P1은 미리 보기)
 */
import { GRADE_STYLE, gearStatsOf, gearSummary, ITEM_GRADES, itemScore, SLOTS, slotName, type GearItem } from '../data/equipment';
import { ITEMS, type ItemKey } from '../data/items';
import { itemSlots, TALENT_LEVEL } from '../data/progression';
import { PASSIVE_DESC, PASSIVE_LEVEL, PASSIVE_NAME, SKILL_INFO, SKILL_LEVEL, SKILLS, type PassiveKey, type SkillKey } from '../data/skills';
import { TALENTS } from '../data/talents';
import type { TapKey } from '../platform/storage';
import { commit, equip, G, healerLevel, itemsNow, toggleItem } from '../game/state';
import { bellSvg } from './art';
import { battle, esc, josa, screen, topBar } from './kit';
import { pushSettings } from './settings';

type Sub = 'gear' | 'skill' | 'talent';
const SUBS: { key: Sub; name: string }[] = [{ key: 'gear', name: '장비' }, { key: 'skill', name: '스킬' }, { key: 'talent', name: '특성' }];
/** 힐러 기본 체력 (06 2장) */
const HEALER_HP = 550;

let sub: Sub = 'gear';
/** 휠에서 고른 자리: 보기 = 설명, 바꾸기 = 첫 번째로 누른 자리 */
let sel: string | null = null;
let swapping = false;
let msg = '';

const s = screen('s-char', '캐릭터', {
  tab: 'char',
  enter(arg) {
    if (SUBS.some(x => x.key === arg)) sub = arg as Sub;
    sel = null; swapping = false; msg = '';
    render();
  },
});

/** 지금 휠 배치 (저장이 없거나 틀리면 기본) */
export function layoutNow(): Record<string, string | null> {
  const L = battle().layout;
  return L.valid(G.save.settings.layout) ? { ...G.save.settings.layout! } : { ...L.DEFAULT_LAYOUT };
}

function render(): void {
  const body = sub === 'gear' ? gearHtml() : sub === 'skill' ? skillHtml() : talentHtml();
  s.el.innerHTML = `${topBar({ settings: true })}
    <nav class="subtabs" role="tablist">${SUBS.map(x => `<button type="button" role="tab" data-csub="${x.key}" aria-selected="${x.key === sub}">${x.name}</button>`).join('')}</nav>
    <div class="ns-body char char-${sub}">${sub === 'gear' ? heroHtml() : ''}${body}</div>`;
}

// ---------- 위: 내 사제 ----------
function heroHtml(): string {
  const st = gearStatsOf(G.save.gear.equipped);
  const stat = (k: string, v: string) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  return `<section class="chero">
      <div class="chero-top"><span class="chero-art">${bellSvg}</span>
        <div><b>성기사단 사제</b><small>정통 힐러 · 입문 ★☆☆ · 장비 ${esc(gearSummary(G.save.gear.equipped))}</small></div>
        <span class="chero-lv">Lv<b>${G.save.player.level}</b></span></div>
      <dl class="cstats">${stat('체력', String(HEALER_HP))}${stat('힐량', `×${st.heal.toFixed(2)}`)}${stat('치명타', `${Math.round(st.crit * 100)}%`)}${stat('가속', `${Math.round(st.haste * 100)}%`)}${stat('마나 재생', `×${st.regen.toFixed(2)}`)}</dl>
    </section>`;
}

// ---------- 장비 ----------
const tile = (it: GearItem | undefined, label: string) => it
  ? `<div class="gtile" style="--g:${GRADE_STYLE[it.grade].color}"><small>${label}</small><b>${esc(it.name)}</b><span>${it.grade}${it.plus ? ` +${it.plus}` : ''}</span></div>`
  : `<div class="gtile empty"><small>${label}</small><b>빈칸</b></div>`;

function gearHtml(): string {
  const eq = G.save.gear.equipped;
  const bag = [...G.save.gear.bag].sort((a, b) => ITEM_GRADES.indexOf(b.grade) - ITEM_GRADES.indexOf(a.grade) || a.slot.localeCompare(b.slot));
  return `<h3 class="sec">착용 <small>강화·분해·세트는 P2</small></h3>
    <div class="gslots">${SLOTS.map(x => tile(eq[x.key], x.name)).join('')}</div>
    <h3 class="sec">가방 <small>${bag.length}개</small></h3>
    ${bag.length ? `<ul class="bag">${bag.map(it => {
      const up = itemScore(it) > itemScore(eq[it.slot]);
      return `<li style="--g:${GRADE_STYLE[it.grade].color}"><span class="gdot">${it.grade[0]}</span><div><b>${esc(it.name)}</b><small>${slotName(it.slot)} · ${it.grade}${up ? ' · <em>더 좋음</em>' : ''}</small></div><button class="btn" type="button" data-equip="${it.id}">장착</button></li>`;
    }).join('')}</ul>` : '<p class="note">던전을 클리어하면 장비가 1개씩 나와요.</p>'}`;
}

// ---------- 스킬 ----------
const lockLv = (k: SkillKey) => (SKILL_LEVEL[k] > healerLevel() ? SKILL_LEVEL[k] : 0);

function meta(k: SkillKey): string {
  const sk = SKILLS[k];
  const parts = [sk.channel ? `${sk.channel}초 정신집중` : sk.cast ? `${sk.cast}초 시전` : '즉시', `마나 ${sk.cost}%`];
  if (sk.cd) parts.push(`쿨 ${sk.cd}초`);
  return parts.join(' · ');
}

/** 이 스킬이 휠 어디에 있는지 (성언은 바뀌는 조각 자리) */
function dirOf(k: SkillKey, lay: Record<string, string | null>): string | null {
  const base = k === 'serenity' ? 'heal' : k === 'sanctify' ? 'poh' : k;
  return Object.keys(lay).find(d => lay[d] === base) || null;
}

function skillCard(k: SkillKey, lay: Record<string, string | null>): string {
  const L = battle().layout, lock = lockLv(k), d = dirOf(k, lay);
  const tags = [d ? `휠 ${L.ARROW[d]}${k === 'serenity' ? ' 치유 자리' : k === 'sanctify' ? ' 기원 자리' : ''}` : '', G.save.settings.tapKey === k ? '칸 탭' : ''].filter(Boolean);
  return `<li class="skc${lock ? ' locked' : ''}${d && sel === d && !swapping ? ' on' : ''}" data-skill="${k}">
      <span class="skb${k === 'serenity' || k === 'sanctify' ? ' holy' : ''}">${SKILLS[k].short}</span>
      <div><p class="skn"><b>${SKILLS[k].name}</b><em>${SKILL_INFO[k].kind}</em>${lock ? `<i class="sklock">🔒 Lv ${lock}</i>` : tags.map(t => `<i>${t}</i>`).join('')}</p>
        <p class="skm">${meta(k)}</p><p class="skd">${esc(SKILL_INFO[k].desc)}</p></div></li>`;
}

const PASSIVE_SHORT: Record<PassiveKey, string> = { echo: '메아리', grace: '은총', words: '성언', symbol: '상징' };

function passiveCard(k: PassiveKey): string {
  const lock = PASSIVE_LEVEL[k] > healerLevel() ? PASSIVE_LEVEL[k] : 0;
  return `<li class="skc pas${lock ? ' locked' : ''}"><span class="skb">${PASSIVE_SHORT[k]}</span>
      <div><p class="skn"><b>${PASSIVE_NAME[k]}</b><em>패시브</em>${lock ? `<i class="sklock">🔒 Lv ${lock}</i>` : ''}</p><p class="skd">${esc(PASSIVE_DESC[k])}</p></div></li>`;
}

function wheelSide(lay: Record<string, string | null>): string {
  const L = battle().layout;
  const changed = JSON.stringify(L.READ_ORDER.map(d => lay[d] || null)) !== JSON.stringify(L.READ_ORDER.map(d => L.DEFAULT_LAYOUT[d] || null));
  if (swapping) {
    const w = sel ? (lay[sel] ? L.label(lay[sel]!) : '빈자리') : '';
    return `<p class="note">${sel ? `${L.ARROW[sel]} ${esc(w)}${josa(w, '과', '와')} 바꿀 자리를 누르세요.` : '두 자리를 차례로 누르면 서로 바뀌어요. 빈자리와도 바꿀 수 있어요.'}</p>
      <button class="btn" type="button" id="layReset"${changed ? '' : ' disabled'}>기본 배치로</button>
      <button class="btn primary" type="button" id="laySwap">다 바꿨어요</button>`;
  }
  const k = sel ? (lay[sel] as SkillKey | null) : null;
  const info = k ? `<div class="wdet"><b>${SKILLS[k].name}</b><small>${L.ARROW[sel!]} · ${SKILL_INFO[k].kind}${lockLv(k) ? ` · 🔒 Lv ${lockLv(k)}` : ''}</small><p class="skm">${meta(k)}</p><p>${esc(SKILL_INFO[k].desc)}</p></div>`
    : sel ? '<div class="wdet"><b>빈자리</b><p>특성 스킬이 들어갈 자리예요 (P2).</p></div>'
    : '<p class="note">자리를 누르면 설명이 나와요. 칸에서 그 방향으로 쓸면 그 스킬이 나가요.</p>';
  return `${info}<button class="btn" type="button" id="laySwap">배치 바꾸기</button>`;
}

function skillHtml(): string {
  const st = G.save.settings, L = battle().layout, lay = layoutNow(), lv = healerLevel();
  const tapLock = lockLv(st.tapKey as SkillKey);
  const { slots, items } = itemsNow();
  const nextSlotLv = [20, 40].find(x => itemSlots(x) > slots);
  const learned = (Object.keys(SKILL_LEVEL) as SkillKey[]).filter(k => !lockLv(k)).length;
  const chip = (k: TapKey) => { const lk = lockLv(k); return `<button class="chip" type="button" data-tap="${k}" aria-pressed="${st.tapKey === k}"${lk ? ' disabled' : ''}>${SKILLS[k].name}${lk ? ` <small>🔒 Lv ${lk}</small>` : ''}</button>`; };
  return `<section class="panel cwheel${swapping ? ' swapping' : ''}"><h2>스킬 휠 <small>${swapping ? '배치 바꾸는 중' : '칸에서 쓸 방향'}</small></h2>
      <div class="lwrap"><div class="lgrid">${L.GRID.map(d => {
        if (!d) return '<div class="lcore" aria-hidden="true">마나</div>';
        const k = lay[d] as SkillKey | null;
        const lock = k ? lockLv(k) : 0;
        const sub = lock ? `🔒 Lv ${lock}` : lv < PASSIVE_LEVEL.words ? '' : k === 'heal' ? '평온' : k === 'poh' ? '신성화' : '';
        return `<button class="lslot${k ? '' : ' empty'}${lock ? ' locked' : ''}" type="button" data-ldir="${d}" aria-pressed="${sel === d}" aria-label="${L.ARROW[d]} ${k ? L.label(k) : '비어 있음'}"><span class="dir">${L.ARROW[d]}</span><b>${k ? SKILLS[k].short : '비어 있음'}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
      }).join('')}</div>
      <div class="lside">${wheelSide(lay)}</div></div></section>
    <section class="panel"><h2>칸 탭 기본 힐</h2><div class="chips">${(Object.keys(battle().tapKeys) as TapKey[]).map(chip).join('')}</div>
      <p class="note">${esc(battle().tapKeys[st.tapKey])}${tapLock ? ` · Lv ${tapLock} 전까진 치유로 탭해요` : ''}</p></section>
    <section class="panel"><h2>단축칸 <small>소비 아이템 ${slots}칸${nextSlotLv ? ` · Lv ${nextSlotLv}에 ${itemSlots(nextSlotLv)}칸` : ''}</small></h2>
      <div class="chips items">${(Object.keys(ITEMS) as ItemKey[]).map(k => `<button class="chip ichip" type="button" data-item="${k}" aria-pressed="${items.includes(k)}">${battle().itemIcon(k)}${ITEMS[k].name}</button>`).join('')}</div>
      <p class="note${msg ? ' warn' : ''}">${msg || items.map(k => `${ITEMS[k].short}: ${ITEMS[k].desc}`).join(' · ') || '빈 칸이에요.'}</p></section>
    <h3 class="sec">스킬 <small>배운 것 ${learned} / ${Object.keys(SKILL_LEVEL).length}</small></h3>
    <ul class="sklist">${(['heal', 'flash', 'renew', 'purify', 'poh', 'guardian', 'hymn', 'serenity', 'sanctify'] as SkillKey[]).map(k => skillCard(k, lay)).join('')}</ul>
    <h3 class="sec">패시브</h3>
    <ul class="sklist">${(Object.keys(PASSIVE_LEVEL) as PassiveKey[]).map(passiveCard).join('')}</ul>`;
}

// ---------- 특성 (미리 보기) ----------
function talentHtml(): string {
  const lv = G.save.player.level;
  const open = TALENTS.filter(t => t.lv <= lv).length;
  const focus = Math.min(open, TALENTS.length - 1);
  return `<section class="panel"><h2>특성 <small>${open ? `${open}단 열림` : `🔒 Lv ${TALENT_LEVEL}에 열려요 (지금 Lv ${lv})`}</small></h2>
      <p>Lv 10부터 10레벨마다 한 단씩, 셋 중 하나를 골라요. 언제든 무료로 바꿀 수 있어요.</p>
      <p class="note">고르기와 효과는 P2에서 만들어요. 지금은 미리 보기예요.</p></section>
    <ol class="ttree">${TALENTS.map((t, i) => {
      const locked = t.lv > lv;
      return `<li class="tier${locked ? ' locked' : ''}"><details${i === focus ? ' open' : ''}><summary>
          <span class="tlv"><b>${i + 1}단</b><small>${locked ? '🔒 ' : ''}Lv ${t.lv}</small></span>
          <span class="tsum"><em>${t.theme}</em><span>${t.picks.map(p => p.name).join(' · ')}</span></span></summary>
        <div class="tpicks">${t.picks.map((p, j) => `<div class="tpick"><i>${'ABC'[j]}</i><div><b>${p.name}</b><p>${esc(p.desc)}</p></div></div>`).join('')}</div>
      </details></li>`;
    }).join('')}</ol>`;
}

// ---------- 누르기 ----------
s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const tab = t.closest<HTMLElement>('[data-csub]');
  if (tab) { sub = tab.dataset.csub as Sub; sel = null; swapping = false; msg = ''; render(); return; }
  const eq = t.closest<HTMLElement>('[data-equip]');
  if (eq) { equip(Number(eq.dataset.equip)); render(); return; }
  const it = t.closest<HTMLElement>('[data-item]');
  if (it) { msg = toggleItem(it.dataset.item as ItemKey); render(); return; }
  msg = '';
  const tap = t.closest<HTMLButtonElement>('[data-tap]');
  if (tap && !tap.disabled) { G.save.settings.tapKey = tap.dataset.tap as TapKey; commit(); pushSettings(); render(); return; }
  const l = t.closest<HTMLElement>('[data-ldir]');
  if (l) {
    const d = l.dataset.ldir!;
    if (!swapping || !sel) sel = sel === d && !swapping ? null : d;
    else if (sel === d) sel = null;
    else { const lay = layoutNow(); [lay[sel], lay[d]] = [lay[d], lay[sel]]; G.save.settings.layout = lay; sel = null; commit(); pushSettings(); }
    render(); return;
  }
  if (t.closest('#laySwap')) { swapping = !swapping; sel = null; render(); return; }
  if (t.closest('#layReset')) { G.save.settings.layout = null; sel = null; commit(); pushSettings(); render(); }
});
