/**
 * 캐릭터 탭 (Lim 2026-10-07): 내 힐러 한 곳에 모음.
 * 장비(09 S10) · 스킬(설명, 휠 배치 09 S17, 칸 탭 기본 힐, 소비 아이템 단축칸) · 특성(06 6장, 고르기) · 직업(25 7장: 직업 카드·목록·바꾸기)
 */
import { enhanceCost, GRADE_STYLE, gearStatsOf, gearSummary, ITEM_GRADES, itemScore, MAX_PLUS, salvageOf, SLOTS, slotName, type GearItem } from '../data/equipment';
import { GRADE } from '../data/gear';
import { SET_KEYS, setCounts, SETS } from '../data/sets';
import { canDispel, DEB_COLOR, HERO_KEYS, HERO_SWITCH_LV, heroSkills, HEROES, skillAt, slotIdOf, UPDATE_HEROES, type HeroKey } from '../data/heroes';
import { ITEMS, type ItemKey } from '../data/items';
import { itemSlots, lvPower, TALENT_LEVEL } from '../data/progression';
import { PASSIVE_DESC, PASSIVE_LEVEL, PASSIVE_NAME, SKILL_INFO, SKILL_LEVEL, SKILLS, type PassiveKey, type SkillKey } from '../data/skills';
import { TALENTS } from '../data/talents';
import { castText, cdText, costText, skillTip, tipHtml } from '../game/tooltip';
import type { TapKey } from '../platform/storage';
import { commit, enhance, equip, findItem, G, healerLevel, heroSave, heroStatus, itemsNow, pickTalent, salvage, switchHero, switchOpen, toggleItem } from '../game/state';
import { bellSvg } from './art';
import { battle, esc, fmt, itemChipsHtml, josa, screen, topBar } from './kit';
import { pushSettings } from './settings';

type Sub = 'gear' | 'skill' | 'talent' | 'hero';
const SUBS: { key: Sub; name: string }[] = [{ key: 'gear', name: '장비' }, { key: 'skill', name: '스킬' }, { key: 'talent', name: '특성' }, { key: 'hero', name: '직업' }];
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
    sel = null; swapping = false; msg = ''; tierOpen = null; gsel = null; salv = null; salvAsk = false;
    render();
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
const dots = (h: HeroKey) => Object.keys(DEB_COLOR).map(t => `<i class="ddot${canDispel(h, t) ? '' : ' off'}" style="--c:${DEB_COLOR[t]}" title="${t}">${t[0]}</i>`).join('');
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

function render(): void {
  const body = sub === 'gear' ? gearHtml() : sub === 'skill' ? skillHtml() : sub === 'hero' ? heroListHtml() : talentHtml();
  s.el.innerHTML = `${topBar({ settings: true })}
    <nav class="subtabs" role="tablist">${SUBS.map(x => `<button type="button" role="tab" data-csub="${x.key}" aria-selected="${x.key === sub}">${x.name}</button>`).join('')}</nav>
    <div class="ns-body char char-${sub}">${sub === 'gear' ? heroHtml() : ''}${body}</div>`;
}

// ---------- 위: 직업 카드 (25 7장) ----------
function heroHtml(): string {
  const st = gearStatsOf(G.save.gear.equipped);
  const lp = lvPower(G.save.player.level);
  const h = HEROES[hero()], open = switchOpen();
  const stat = (k: string, v: string) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  return `<section class="chero">
      <div class="chero-top"><span class="chero-art">${bellSvg}</span>
        <div><b>${h.name}</b><small>${stars(h.star)} · 해제 <span class="ddots">${dots(h.key)}</span> · 장비 ${esc(gearSummary(G.save.gear.equipped))}</small></div>
        <span class="chero-lv">Lv<b>${G.save.player.level}</b></span></div>
      <dl class="cstats">${stat('체력', fmt(Math.round(HEALER_HP * lp)))}${stat('힐량', `×${(st.heal * lp).toFixed(2)}`)}${stat('치명타', `${Math.round(st.crit * 100)}%`)}${stat('가속', `${Math.round(st.haste * 100)}%`)}${stat('마나 재생', `×${st.regen.toFixed(2)}`)}</dl>
      <button class="btn" type="button" data-csub="hero"${open.ok ? '' : ' disabled'}>직업 바꾸기${open.ok ? '' : ` <small>🔒 ${esc(open.why)}</small>`}</button>
    </section>`;
}

// ---------- 직업 목록 (25 7장): 카드마다 고유 시스템·해제·스킬, 해금 상태와 바꾸기 ----------
function heroCard(k: HeroKey): string {
  const h = HEROES[k], st = heroStatus(k), open = switchOpen(), q = h.unlock.quest, wins = heroSave(k).wins;
  const questLine = q && st.need && st.state !== 'open' && !heroSave(k).unlocked ? `<p class="hq">직업 퀘스트 「${q.name}」: ${esc(q.text)} <b>${st.quest} / ${st.need}</b></p>` : '';
  let foot = '';
  if (st.state === 'now') foot = `<p class="note">지금 직업 · 이 직업으로 이긴 판 ${wins}</p>`;
  else if (st.state === 'locked') foot = `<p class="note">🔒 ${esc(h.unlock.how)}</p>`;
  else foot = `<button class="btn primary" type="button" data-hero="${k}"${open.ok ? '' : ' disabled'}>${st.state === 'quest' ? '바꾸고 퀘스트 하기' : '이 직업으로 바꾸기'}</button>${st.dev ? `<p class="note">Lv ${h.unlock.lv} 해금, 개발 빌드라 열림</p>` : ''}`;
  const skills = heroSkills(k).map(sk => `<li><b>${SKILLS[sk].name}</b><em>${SKILL_INFO[sk].kind} · Lv ${SKILL_LEVEL[sk]}</em><p>${esc(SKILL_INFO[sk].desc)}</p></li>`).join('');
  const pas = (k === 'priest' ? (Object.keys(PASSIVE_LEVEL) as PassiveKey[]).filter(x => x !== 'words').map(x => ({ name: PASSIVE_NAME[x], lv: PASSIVE_LEVEL[x], desc: PASSIVE_DESC[x] })) : h.passives)
    .map(p => `<li><b>${p.name}</b><em>패시브 · Lv ${p.lv}</em><p>${esc(p.desc)}</p></li>`).join('');
  return `<section class="hcard${st.state === 'now' ? ' now' : ''}${st.state === 'locked' ? ' locked' : ''}" data-hcard="${k}">
      <div class="hc-top"><div><b>${h.name}</b><small>${stars(h.star)}</small></div><span class="ddots">${dots(k)}</span></div>
      <p class="hc-line">${esc(h.line)}</p>
      <p class="hc-sys"><b>${h.system.name}</b> <em>Lv ${h.system.lv}</em> ${esc(h.system.desc)}</p>
      ${questLine}${foot}
      <details><summary>스킬 ${heroSkills(k).length} · 패시브</summary><ul class="hc-skills">${skills}${pas}</ul></details>
    </section>`;
}

function heroListHtml(): string {
  const open = switchOpen();
  return `<p class="note">${open.ok ? '전투 밖에서 언제든 무료로 바꿈. 레벨·장비·골드는 같이 쓰고, 휠 배치·칸 탭은 직업마다 따로' : `직업 바꾸기 🔒 ${esc(open.why)} (Lv ${HERO_SWITCH_LV})`}</p>
    ${msg ? `<p class="note warn">${esc(msg)}</p>` : ''}
    ${HERO_KEYS.map(heroCard).join('')}
    <section class="hcard locked"><div class="hc-top"><div><b>업데이트 직업</b><small>${UPDATE_HEROES.join(' · ')}</small></div></div>
      <p class="hc-line">출시 뒤 시즌마다 1종. 골드 60,000 또는 크리스탈 1,500</p></section>`;
}

// ---------- 장비 (09 S10·S11): 착용·세트·상세(강화)·가방(장착·분해) ----------
/** 상세를 연 장비 id */
let gsel: number | null = null;
/** 분해 고르는 중이면 고른 id들 */
let salv: Set<number> | null = null;
/** 분해 확인 (한 번 더 누르면 분해) */
let salvAsk = false;

const plusTxt = (it: GearItem) => (it.plus ? ` +${it.plus}` : '');
const tile = (it: GearItem | undefined, label: string) => it
  ? `<button class="gtile${gsel === it.id ? ' sel' : ''}" type="button" data-gitem="${it.id}" style="--g:${GRADE_STYLE[it.grade].color}"><small>${label}${it.set ? ' · 세트' : ''}</small><b>${esc(it.name)}</b><span>${it.grade}${plusTxt(it)}</span></button>`
  : `<div class="gtile empty"><small>${label}</small><b>빈칸</b></div>`;

/** 착용 세트 진행 (2/4) */
function setHtml(): string {
  const eq = G.save.gear.equipped, n = setCounts(Object.values(eq));
  const keys = SET_KEYS.filter(k => n[k]);
  if (!keys.length) return '<p class="note">세트: 없음 · 희귀 이상 던전 장비, 영웅 이상 레이드 장비에서 나옴</p>';
  return keys.map(k => {
    const d = SETS[k], c = n[k]!;
    return `<div class="gset"><b>${d.name} ${c}/4</b><small>${d.style}</small>
      <p class="${c >= 2 ? 'on' : ''}">${c >= 2 ? '✓' : '○'} 2세트: ${esc(d.two.desc)}</p>
      <p class="${c >= 4 ? 'on' : ''}">${c >= 4 ? '✓' : '○'} 4세트: ${esc(d.four.desc)}</p></div>`;
  }).join('');
}

/** 고른 장비 상세·강화 (S11) */
function detailHtml(): string {
  const it = gsel == null ? null : findItem(gsel);
  if (!it) return '';
  const worn = G.save.gear.equipped[it.slot]?.id === it.id;
  const c = enhanceCost(it), m = G.save.mats, gold = G.save.player.gold;
  const [h] = GRADE[it.grade];
  const set = it.set ? SETS[it.set] : null;
  const costTxt = c ? [`골드 ${fmt(c.gold)}`, c.stone ? `강화석 ${c.stone}` : '', c.refined ? `정제 강화석 ${c.refined}` : ''].filter(Boolean).join(' · ') : '';
  const can = !!c && gold >= c.gold && m.stone >= c.stone && m.refined >= c.refined;
  const sv = salvageOf(it);
  return `<section class="panel gdetail" style="--g:${GRADE_STYLE[it.grade].color}">
      <h2>${esc(it.name)}<small>${slotName(it.slot)} · ${it.grade}${plusTxt(it)}${worn ? ' · 착용 중' : ''}</small></h2>
      <p>힐량 +${((h + 0.005 * it.plus) * 100).toFixed(1)}% · 보조 능력치 ${GRADE[it.grade][1]}개</p>
      ${set ? `<p class="note">세트 「${set.name}」 (${set.slots.map(slotName).join('·')})<br>2세트: ${esc(set.two.desc)}<br>4세트: ${esc(set.four.desc)}</p>` : ''}
      <div class="gbtns">${c ? `<button class="btn primary" type="button" data-enh="${it.id}"${can ? '' : ' disabled'}>강화 +${c.to}<small>${costTxt}</small></button>` : `<button class="btn" type="button" disabled>최대 강화 +${MAX_PLUS}</button>`}
        ${worn ? '' : `<button class="btn" type="button" data-equip="${it.id}">장착</button><button class="btn" type="button" data-salv1="${it.id}">분해<small>골드 ${fmt(sv.gold)} · 강화석 ${sv.stone}${sv.refined ? ` · 정제 ${sv.refined}` : ''}</small></button>`}</div>
    </section>`;
}

function gearHtml(): string {
  const eq = G.save.gear.equipped, m = G.save.mats;
  const bag = [...G.save.gear.bag].sort((a, b) => ITEM_GRADES.indexOf(b.grade) - ITEM_GRADES.indexOf(a.grade) || a.slot.localeCompare(b.slot) || b.plus - a.plus);
  const picked = salv ? bag.filter(it => salv!.has(it.id)) : [];
  const sum = picked.reduce((a, it) => { const v = salvageOf(it); return { gold: a.gold + v.gold, stone: a.stone + v.stone, refined: a.refined + v.refined }; }, { gold: 0, stone: 0, refined: 0 });
  const salvBar = salv ? `<div class="salvbar">
      <button class="btn" type="button" data-salvall>일반·고급 모두</button>
      <button class="btn primary" type="button" data-salvgo${picked.length ? '' : ' disabled'}>${salvAsk ? '한 번 더 누르면 분해' : `${picked.length}개 분해`}<small>골드 ${fmt(sum.gold)} · 강화석 ${sum.stone}${sum.refined ? ` · 정제 ${sum.refined}` : ''}</small></button>
      <button class="btn" type="button" data-salvx>취소</button></div>` : '';
  return `<h3 class="sec">착용 <small>누르면 상세·강화</small></h3>
    <div class="gslots">${SLOTS.map(x => tile(eq[x.key], x.name)).join('')}</div>
    ${msg ? `<p class="note warn">${esc(msg)}</p>` : ''}
    ${detailHtml()}
    <p class="gmats">강화석 <b>${fmt(m.stone)}</b> · 정제 강화석 <b>${fmt(m.refined)}</b></p>
    ${setHtml()}
    <h3 class="sec">가방 <small>${bag.length}개</small>${bag.length && !salv ? '<button class="btn mini" type="button" data-salvon>분해 선택</button>' : ''}</h3>
    ${salvBar}
    ${bag.length ? `<ul class="bag${salv ? ' picking' : ''}">${bag.map(it => {
      const up = itemScore(it) > itemScore(eq[it.slot]);
      const on = !!salv && salv.has(it.id);
      const right = salv ? `<span class="pick${on ? ' on' : ''}">${on ? '✓' : ''}</span>` : `<button class="btn" type="button" data-equip="${it.id}">장착</button>`;
      return `<li data-gitem="${it.id}" class="${gsel === it.id ? 'sel' : ''}${on ? ' on' : ''}" style="--g:${GRADE_STYLE[it.grade].color}"><span class="gdot">${it.grade[0]}</span><div><b>${esc(it.name)}${plusTxt(it)}</b><small>${slotName(it.slot)} · ${it.grade}${it.set ? ' · 세트' : ''}${up ? ' · <em>더 좋음</em>' : ''}</small></div>${right}</li>`;
    }).join('')}</ul>` : '<p class="note">던전을 클리어하면 장비 1개씩 획득</p>'}`;
}

// ---------- 스킬 ----------
const lockLv = (k: SkillKey) => (SKILL_LEVEL[k] > healerLevel() ? SKILL_LEVEL[k] : 0);

/** 정보 줄: 시전 · 마나 · 재사용 대기시간 (설명 팝업과 같은 말) */
function meta(k: SkillKey): string {
  return [castText(k), costText(k), cdText(k)].filter(Boolean).join(' · ');
}

/** 이 스킬이 휠 어디에 있는지 (성언은 바뀌는 조각 자리, 8번째 칸은 빈 방향) */
function dirOf(k: SkillKey, lay: Record<string, string | null>): string | null {
  const id = slotIdOf(k);
  return Object.keys(lay).find(d => (lay[d] || 'unique') === id) || null;
}

function skillCard(k: SkillKey, lay: Record<string, string | null>): string {
  const L = battle().layout, lock = lockLv(k), d = dirOf(k, lay);
  const tags = [d ? `휠 ${L.ARROW[d]}${k === 'serenity' ? ' 치유 자리' : k === 'sanctify' ? ' 기원 자리' : ''}` : '', skillAt(hero(), G.save.settings.tapKey) === k ? '칸 탭' : ''].filter(Boolean);
  return `<li class="skc${lock ? ' locked' : ''}${d && sel === d && !swapping ? ' on' : ''}" data-skill="${k}">
      <span class="skb${k === 'serenity' || k === 'sanctify' ? ' holy' : ''}">${SKILLS[k].short}</span>
      <div><p class="skn"><b>${SKILLS[k].name}</b><em>${SKILL_INFO[k].kind}</em>${lock ? `<i class="sklock">🔒 Lv ${lock}</i>` : tags.map(t => `<i>${t}</i>`).join('')}</p>
        <p class="skm">${meta(k)}</p><p class="skd">${esc(SKILL_INFO[k].desc)}</p></div></li>`;
}

const PASSIVE_SHORT: Record<PassiveKey, string> = { echo: '메아리', grace: '은총', words: '성언', symbol: '상징' };

/** 사제 밖 직업의 패시브·고유 시스템 카드 */
function heroPassiveCard(p: { name: string; lv: number; desc: string }, kind: string): string {
  const lock = p.lv > healerLevel() ? p.lv : 0;
  return `<li class="skc pas${lock ? ' locked' : ''}"><span class="skb">${p.name.slice(0, 2)}</span>
      <div><p class="skn"><b>${p.name}</b><em>${kind}</em>${lock ? `<i class="sklock">🔒 Lv ${lock}</i>` : ''}</p><p class="skd">${esc(p.desc)}</p></div></li>`;
}

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
    return `<p class="note">${sel ? `${L.ARROW[sel]} ${esc(w)}${josa(w, '과', '와')} 바꿀 자리 선택` : '두 자리를 차례로 누르면 서로 바뀜. 빈자리와도 교체 가능'}</p>
      <button class="btn" type="button" id="layReset"${changed ? '' : ' disabled'}>기본 배치로</button>
      <button class="btn primary" type="button" id="laySwap">바꾸기 끝</button>`;
  }
  const k = sel ? skillOfDir(lay, sel) : null;
  const info = k ? `<div class="wdet">${tipHtml({ ...skillTip(k, lockLv(k)), kind: `${L.ARROW[sel!]} · ${SKILL_INFO[k].kind}` })}</div>`
    : sel ? '<div class="wdet"><b>빈자리</b><p>특성 스킬 자리 (P2)</p></div>'
    : '<p class="note">자리를 누르면 설명. 칸에서 그 방향으로 쓸면 그 스킬 사용</p>';
  return `${info}<button class="btn" type="button" id="laySwap">배치 바꾸기</button>`;
}

function skillHtml(): string {
  const st = G.save.settings, L = battle().layout, lay = layoutNow(), lv = healerLevel(), h = hero();
  const tapSkill = skillAt(h, st.tapKey) || skillAt(h, 'heal')!, basic = skillAt(h, 'heal')!;
  const tapLock = lockLv(tapSkill);
  const tapText = battle().tapKeysOf(h);
  const { slots, items } = itemsNow();
  const nextSlotLv = [20, 40].find(x => itemSlots(x) > slots);
  const list = heroSkills(h);
  const learned = list.filter(k => !lockLv(k)).length;
  const chip = (t: TapKey) => { const k = skillAt(h, t)!, lk = lockLv(k); return `<button class="chip" type="button" data-tap="${t}" aria-pressed="${st.tapKey === t}"${lk ? ' disabled' : ''}>${SKILLS[k].name}${lk ? ` <small>🔒 Lv ${lk}</small>` : ''}</button>`; };
  const pas = h === 'priest' ? (Object.keys(PASSIVE_LEVEL) as PassiveKey[]).map(passiveCard).join('')
    : [heroPassiveCard(HEROES[h].system, '고유 시스템'), ...HEROES[h].passives.map(p => heroPassiveCard(p, '패시브'))].join('');
  return `<section class="panel cwheel${swapping ? ' swapping' : ''}"><h2>스킬 휠 <small>${swapping ? '배치 바꾸는 중' : '칸에서 쓸 방향'}</small></h2>
      <div class="lwrap"><div class="lgrid">${L.GRID.map(d => {
        if (!d) return '<div class="lcore" aria-hidden="true">마나</div>';
        const k = skillOfDir(lay, d);
        const lock = k ? lockLv(k) : 0;
        const sub = lock ? `🔒 Lv ${lock}` : h !== 'priest' || lv < PASSIVE_LEVEL.words ? '' : k === 'heal' ? '평온' : k === 'poh' ? '신성화' : '';
        return `<button class="lslot${k ? '' : ' empty'}${lock ? ' locked' : ''}" type="button" data-ldir="${d}" aria-pressed="${sel === d}" aria-label="${L.ARROW[d]} ${k ? (h === 'priest' ? L.label(k) : SKILLS[k].name) : '비어 있음'}"><span class="dir">${L.ARROW[d]}</span><b>${k ? SKILLS[k].short : '비어 있음'}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
      }).join('')}</div>
      <div class="lside">${wheelSide(lay)}</div></div></section>
    <section class="panel"><h2>칸 탭 기본 힐</h2><div class="chips">${(Object.keys(battle().tapKeys) as TapKey[]).map(chip).join('')}</div>
      <p class="note">${esc(tapText[st.tapKey] || '')}${tapLock ? ` · Lv ${tapLock} 전까진 ${SKILLS[basic].name}로 탭` : ''}</p></section>
    <section class="panel"><h2>단축칸 <small>소비 아이템 ${slots}칸${nextSlotLv ? ` · Lv ${nextSlotLv}에 ${itemSlots(nextSlotLv)}칸` : ''}</small></h2>
      ${itemChipsHtml(items)}
      <p class="note${msg ? ' warn' : ''}">${msg || items.map(k => `<b>${ITEMS[k].short}</b> ${ITEMS[k].desc}`).join('<br>') || '빈 칸'}</p></section>
    <h3 class="sec">${HEROES[h].name} 스킬 <small>배운 것 ${learned} / ${list.length}</small></h3>
    <ul class="sklist">${list.map(k => skillCard(k, lay)).join('')}</ul>
    <h3 class="sec">패시브</h3>
    <ul class="sklist">${pas}</ul>`;
}

// ---------- 특성 (06 6장): 단마다 셋 중 하나, 언제든 무료로 바꿈 ----------
/** 마지막으로 연 단 (고른 뒤에도 펼친 채로) */
let tierOpen: number | null = null;

function talentHtml(): string {
  const lv = healerLevel();
  // 직업마다 특성 트리가 따로 (25 6장). 지금 만든 건 사제 트리뿐
  if (hero() !== 'priest') return `<section class="panel"><h2>특성 <small>${HEROES[hero()].name}</small></h2>
      <p>${HEROES[hero()].name} 특성 트리는 준비 중. 사제 특성을 먼저 만든 뒤 같은 틀로 추가</p></section>`;
  const mine = heroSave('priest').talents || [];
  const open = TALENTS.filter(t => t.lv <= lv).length;
  const picked = TALENTS.filter((t, i) => t.lv <= lv && mine[i] != null).length;
  const firstEmpty = TALENTS.findIndex((t, i) => t.lv <= lv && mine[i] == null);
  const focus = tierOpen ?? (firstEmpty >= 0 ? firstEmpty : Math.min(open, TALENTS.length - 1));
  const head = open ? `${picked} / ${open}단 고름` : `🔒 Lv ${TALENT_LEVEL}에 열림 (지금 Lv ${lv})`;
  return `<section class="panel"><h2>특성 <small>${head}</small></h2>
      <p>Lv 10부터 10레벨마다 한 단씩 열림. 단마다 셋 중 하나를 고르고, 언제든 무료로 변경. 고른 특성을 다시 누르면 해제</p>
      ${open > picked ? `<p class="note warn">고르지 않은 단 ${open - picked}개</p>` : ''}
      <p class="note">보조 버튼 특성은 전투 화면 단축칸 위에 버튼으로 나옴</p></section>
    <ol class="ttree">${TALENTS.map((t, i) => {
      const locked = t.lv > lv, cur = mine[i] ?? null;
      const sum = locked ? t.picks.map(p => p.name).join(' · ') : cur != null && t.picks[cur] ? `✓ ${t.picks[cur].name}` : '고르지 않음';
      return `<li class="tier${locked ? ' locked' : ''}${!locked && cur == null ? ' empty' : ''}"><details${i === focus ? ' open' : ''}><summary>
          <span class="tlv"><b>${i + 1}단</b><small>${locked ? '🔒 ' : ''}Lv ${t.lv}</small></span>
          <span class="tsum"><em>${t.theme}</em><span>${sum}</span></span></summary>
        <div class="tpicks">${t.picks.map((p, j) => `<button class="tpick" type="button" data-talent="${i}:${j}" aria-pressed="${cur === j}"${locked ? ' disabled' : ''}><i>${cur === j ? '✓' : 'ABC'[j]}</i><div><b>${p.name}${p.active ? ' <span class="ttag">보조 버튼</span>' : ''}</b><p>${esc(p.desc)}</p></div></button>`).join('')}</div>
      </details></li>`;
    }).join('')}</ol>`;
}

// ---------- 누르기 ----------
s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const tab = t.closest<HTMLElement>('[data-csub]');
  if (tab) { if ((tab as HTMLButtonElement).disabled) return; sub = tab.dataset.csub as Sub; sel = null; swapping = false; msg = ''; gsel = null; salv = null; salvAsk = false; render(); return; }
  const tb = t.closest<HTMLButtonElement>('[data-talent]');
  if (tb && !tb.disabled) {
    const [i, j] = tb.dataset.talent!.split(':').map(Number);
    if (pickTalent(i, j)) { tierOpen = i; render(); }
    return;
  }
  const hb = t.closest<HTMLButtonElement>('[data-hero]');
  if (hb && !hb.disabled) {
    const k = hb.dataset.hero as HeroKey;
    msg = switchHero(k) ? '' : '바꿀 수 없음';
    if (!msg) { pushSettings(); sub = 'gear'; sel = null; swapping = false; }
    render(); return;
  }
  const eq = t.closest<HTMLElement>('[data-equip]');
  if (eq) { equip(Number(eq.dataset.equip)); msg = ''; render(); return; }
  const en = t.closest<HTMLButtonElement>('[data-enh]');
  if (en) { if (!en.disabled) { msg = enhance(Number(en.dataset.enh)); render(); } return; }
  if (t.closest('[data-salvon]')) { salv = new Set(); salvAsk = false; gsel = null; msg = ''; render(); return; }
  if (t.closest('[data-salvx]')) { salv = null; salvAsk = false; render(); return; }
  if (t.closest('[data-salvall]') && salv) { for (const it of G.save.gear.bag) if (it.grade === '일반' || it.grade === '고급') salv.add(it.id); salvAsk = false; render(); return; }
  const go = t.closest<HTMLButtonElement>('[data-salvgo]');
  if (go && salv) {
    if (go.disabled) return;
    if (!salvAsk) { salvAsk = true; render(); return; }
    const r = salvage([...salv]);
    msg = `${r.n}개 분해: 골드 +${fmt(r.gold)} · 강화석 +${r.stone}${r.refined ? ` · 정제 강화석 +${r.refined}` : ''}`;
    salv = null; salvAsk = false; render(); return;
  }
  const s1 = t.closest<HTMLElement>('[data-salv1]');
  if (s1) {
    const r = salvage([Number(s1.dataset.salv1)]);
    msg = r.n ? `분해: 골드 +${fmt(r.gold)} · 강화석 +${r.stone}${r.refined ? ` · 정제 강화석 +${r.refined}` : ''}` : '';
    gsel = null; render(); return;
  }
  const gi = t.closest<HTMLElement>('[data-gitem]');
  if (gi) {
    const id = Number(gi.dataset.gitem);
    if (salv && gi.tagName === 'LI') { if (salv.has(id)) salv.delete(id); else salv.add(id); salvAsk = false; }
    else { gsel = gsel === id ? null : id; msg = ''; }
    render(); return;
  }
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
