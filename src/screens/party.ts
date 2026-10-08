/**
 * S05 편성 (27 3-3, 시안 Party27): 공개모집 · 길드파티(Lv 15, 02 9-2) 폴더 탭, 시작 위치 육각 미리보기, 파티원 줄 (누르면 상세),
 * 이번 파티 힌트, 단축칸 한 줄 칩 (+ = 고르기 시트), 아래 다시 뽑기(광고 하루 2번 무료) · 출발. 지면 광고 이어하기 (15)
 */
import { CLASSES } from '../data/classes';
import { contentOf } from '../data/content';
import { AD_LIMIT } from '../data/economy';
import { gearStatsOf } from '../data/equipment';
import { ENCOUNTERS } from '../data/encounters';
import { ITEMS, type ItemKey } from '../data/items';
import { CATS, PERS } from '../data/personalities';
import { aptOf } from '../data/guild';
import { create, recruitParty } from '../engine';
import { Flow, newSeed, rerollCost } from '../game/flow';
import { autoPick, guildOpen, guildRoster, powerOf, slotsOf, togglePick } from '../game/guild';
import { isMember, needsShard, spendShard } from '../game/economy';
import { runMode } from '../game/runmode';
import { askModal, showRewarded } from '../platform/ads';
import type { BattleResult } from '../game/settle';
import { settle } from '../game/settle';
import { commit, G, healerLevel, heroNow, itemsNow, talentsNow, toggleItem } from '../game/state';
import { TUT } from '../game/tutorial';
import { memRowHtml, ROLE_ICON } from './members';
import { battle, esc, fmt, go, itemChipsHtml, ROLE, screen } from './kit';
import { classEmblem, LOCK, uiIcon } from './art';
import { ARROW, flowHead } from './entry';

const s = screen('s-party', '파티 편성', {
  enter() {
    if (!Flow.party) {
      roll();
      // 길드원이 있으면 지난번 길드파티 편성으로 시작 (09 S05). 길드 탭 「길드파티로 출전」이면 길드파티로 (30)
      Flow.mode = guildReady() && (G.save.guild.pick.length || Flow.preferGuild) ? 'guild' : 'public';
      Flow.preferGuild = false;
      Flow.gpick = guildReady() ? autoPick(G.save, firstEnc()) : [];
      compose();
    }
    sheet = false; openRow = -1;
    render();
  },
});
let msg = '', gmsg = '';
/** 단축칸 고르기 시트가 열렸는지 */
let sheet = false;
/** 상세를 펼친 파티원 줄 */
let openRow = -1;

const BULB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>';

const firstEnc = () => ENCOUNTERS[contentOf(Flow.content).fights(Flow.diff)[0]];
/** 이번 판 단계 레벨·어픽스 (던전 레벨 단계, 주간 도전) */
const modeNow = () => runMode(G.save, contentOf(Flow.content), Flow.diff, { tier: Flow.tier, chal: Flow.chal });
const guildReady = () => guildOpen(G.save).ok && G.save.guild.members.length > 0;

function roll(): void {
  const segs = contentOf(Flow.content).fights(Flow.diff);
  Flow.seed = newSeed();
  openRow = -1;
  // 공개모집 파티원도 능력 1개 (17 3장). 튜토리얼 파티는 능력 없음
  Flow.pub = recruitParty(segs[0], Flow.seed, { abilities: G.save.tut >= TUT.done });
}

/** 전투에 넘길 파티: 공개모집 그대로, 또는 고른 길드원 + 빈자리는 공개모집 */
function compose(): void {
  Flow.party = Flow.mode === 'guild' && guildReady() ? guildRoster(G.save, Flow.gpick, Flow.pub!, firstEnc()) : Flow.pub!.slice();
}

/**
 * 시작 위치 미리보기 (시안 육각 칸): 첫 전투를 같은 시드로 만들어 칸 배치를 그림 (실제 전투도 이 시드로 시작).
 * 칸 = 역할 색 + 역할 아이콘 + 닉네임, 나는 금테 + 직업 문장
 */
function boardHtml(): string {
  const segs = contentOf(Flow.content).fights(Flow.diff);
  const f = create({ encounter: segs[0], diff: Flow.diff, seed: Flow.seed, party: Flow.party! });
  const R = 1, HW = Math.sqrt(3) / 2, K = 0.95;
  const xs = f.cells.map(c => c.px), ys = f.cells.map(c => c.py);
  const x0 = Math.min(...xs) - HW, y0 = Math.min(...ys) - R;
  const W = Math.max(...xs) + HW - x0, H = Math.max(...ys) + R - y0;
  const pc = (v: number, t: number) => `${((v / t) * 100).toFixed(2)}%`;
  const size = f.cells.length > 19 ? ' big' : f.cells.length > 10 ? ' mid' : '';
  const hero = heroNow();
  const cells = f.cells.map(c => {
    const u = c.unit;
    const pos = `left:${pc(c.px - HW * K - x0, W)};top:${pc(c.py - R * K - y0, H)};width:${pc(2 * HW * K, W)};height:${pc(2 * R * K, H)}`;
    if (!u) return `<span class="f-hex" style="${pos}"><span class="f-hx empty"></span></span>`;
    if (u.me) return `<span class="f-hex me" style="${pos}"><span class="f-hx">${classEmblem(hero, 'sm')}<b>나</b></span></span>`;
    return `<span class="f-hex" style="${pos}"><span class="f-hx" style="background:${ROLE[u.role].color}">${ROLE_ICON[u.role] || ''}<b>${esc(u.nick)}</b></span></span>`;
  }).join('');
  const maxW = Math.min(W * 38, (186 * W) / H); // 5인 = 시안처럼 높이 약 186px
  return `<figure class="f-board"><div class="f-hexes${size}" role="img" aria-label="시작 위치 미리보기" style="aspect-ratio:${W.toFixed(3)} / ${H.toFixed(3)};max-width:${maxW.toFixed(0)}px">${cells}</div><figcaption class="cap">시작 위치 · 자동 배치 (옮길 수 없음)</figcaption></figure>`;
}

function hints(): string[] {
  const out: string[] = [];
  const segs = contentOf(Flow.content).fights(Flow.diff);
  const boss = ENCOUNTERS[segs[segs.length - 1]];
  const hard = Flow.party!.filter(m => PERS[m.pers].star === 3);
  for (const m of hard) out.push(`${m.nick}(${m.pers}): ${PERS[m.pers].desc}`);
  const ih = battle().itemHint(boss.script).replace(/^💡\s*/, '');
  if (ih) out.push(ih);
  return out;
}

/** 직업 없는 옛 파티 줄 (시뮬·옛 테스트용 파티) */
function plainRow(m: { role: string; nick: string; pers: keyof typeof PERS }): string {
  const p = PERS[m.pers];
  return `<li class="pcard f-mem"><span class="f-ri" style="background:${ROLE[m.role].color}">${ROLE_ICON[m.role] || ''}</span><div class="f-mt"><span class="f-l1"><b class="pnick">${esc(m.nick)}</b><span class="cap">${ROLE[m.role].name}</span><span class="f-sp"></span><span class="f-ps"><i style="background:${CATS[p.cat]}">${p.ch}</i>${esc(m.pers)}</span><span class="f-star">${'★'.repeat(p.star)}</span></span></div></li>`;
}

/** 길드파티 편성 (02 9-2): 길드원 눌러서 넣고 빼기, 빈자리는 공개모집으로 채움 */
function guildPickHtml(stage: number): string {
  const enc = firstEnc(), sl = slotsOf(enc), ms = G.save.guild.members;
  const picked = Flow.gpick.map(id => ms.find(m => m.id === id)).filter(Boolean);
  const tanks = picked.filter(m => CLASSES[m!.cls].role === 'tank').length;
  const fill = Flow.party!.filter(e => e.gid == null);
  const list = ms.slice().sort((a, b) => (Flow.gpick.includes(b.id) ? 1 : 0) - (Flow.gpick.includes(a.id) ? 1 : 0) || powerOf(b) - powerOf(a));
  const under = picked.filter(m => m!.lv < stage).length;
  return `<p class="pickhead"><b>길드원 ${picked.length}/${sl.tank + sl.dps}</b><small>탱커 ${tanks}/${sl.tank} · 딜러 ${picked.length - tanks}/${sl.dps}${fill.length ? ` · 빈자리 ${fill.length} = 공개모집` : ''}</small><button class="btn2" type="button" id="autoPick">자동 편성</button></p>
    ${gmsg ? `<p class="warnbox">${esc(gmsg)}</p>` : ''}
    ${under ? `<p class="warnbox">권장 레벨(Lv ${stage})보다 낮은 길드원 ${under}명: 체력·딜이 낮음</p>` : ''}
    <section class="pn f-mems"><ul class="pcards">${list.map(m => {
      const on = Flow.gpick.includes(m.id);
      return memRowHtml({ ...m, apt: aptOf(m) }, { attrs: `data-gpick="${m.id}" role="button" tabindex="0" aria-pressed="${on}"`, cls: `tap${on ? ' picked' : ''}`, extra: `<span class="pick${on ? ' on' : ''}" aria-hidden="true">${on ? '✓' : ''}</span>` });
    }).join('')}
    ${fill.map(m => (m.cls ? memRowHtml({ ...m, cls: m.cls, lv: stage }, { cls: 'fill', note: '공개모집 보충' }) : plainRow(m))).join('')}</ul></section>`;
}

/** 단축칸 한 줄 (27 3-3): 고른 아이템 칩 + 빈칸 + 「+」. 누르면 고르기 시트 */
function slotRow(slots: number, items: ItemKey[]): string {
  const stock = G.save.tut >= TUT.done ? G.save.bag : null;
  const chips = items.map(k => {
    const n = stock ? stock[k] || 0 : null;
    return `<button class="f-item${n === 0 ? ' zero' : ''}" type="button" data-slots>${battle().itemIcon(k)}${ITEMS[k].short}${n != null ? ` ×${n}` : ''}</button>`;
  }).join('');
  const empty = Array.from({ length: Math.max(0, slots - items.length) }, () => '<button class="f-item empty" type="button" data-slots>빈칸</button>').join('');
  return `<div class="f-slots"><span class="cap f-slab">단축칸</span>${chips}${empty}<button class="f-item plus" type="button" data-slots aria-label="단축칸 ${slots}칸 바꾸기">+</button></div>`;
}

/** 단축칸 고르기 시트 (캐릭터 › 스킬의 단축칸과 같은 저장) */
function sheetHtml(slots: number, items: ItemKey[]): string {
  const hid = sheet ? '' : ' hidden';
  return `<div class="sheet-dim" data-shut${hid}></div><section class="sheet f-isheet" role="dialog" aria-label="단축칸 고르기"${hid}><span class="grip"></span>
    <h2 class="h-rule">단축칸 ${slots}칸<span class="rule"></span><span class="cap">${slots < 4 ? `Lv ${slots === 2 ? 20 : 40}에 1칸 더` : '최대'}</span></h2>
    ${itemChipsHtml(items)}
    <p class="note${sheet && msg ? ' warn' : ''}">${sheet && msg ? esc(msg) : items.map(k => `<b>${ITEMS[k].short}</b> ${ITEMS[k].desc}`).join('<br>') || '빈 칸'}</p>
    <button class="btn2" type="button" data-shut>닫기</button></section>`;
}

function render(): void {
  const c = contentOf(Flow.content);
  const { slots, items } = itemsNow();
  const cost = rerollCost(Flow.rerolls);
  const go2 = guildOpen(G.save);
  const guildTab = !go2.ok ? ` ${LOCK}${go2.why.replace('에 열림', '')}` : !G.save.guild.members.length ? ' · 길드원 없음' : '';
  const isGuild = Flow.mode === 'guild' && guildReady();
  const stage = modeNow().stage;
  const hs = hints();
  const tutDone = G.save.tut >= TUT.done, adLeft = AD_LIMIT.reroll - G.save.daily.ads.reroll;
  const cap = Flow.chal ? `주간 도전 ${Flow.chal}단계 · Lv ${stage}` : `${esc(c.name)} · ${Flow.diff} · Lv ${stage}`;
  const rows = Flow.party!.map((m, i) => (m.cls
    ? memRowHtml({ ...m, cls: m.cls, lv: stage }, { attrs: `data-cls="${m.cls}" data-prow="${i}" role="button" tabindex="0" aria-expanded="${openRow === i}"`, cls: 'tap', open: openRow === i })
    : plainRow(m))).join('');
  s.el.innerHTML = `${flowHead('s-entry', '편성', [cap])}
    <nav class="subtabs" role="tablist" aria-label="파티 모집"><button type="button" role="tab" data-mode="public" aria-selected="${!isGuild}">공개모집</button><button type="button" role="tab" data-mode="guild" aria-selected="${isGuild}"${guildReady() ? '' : ' disabled'}>길드파티${guildTab}</button></nav>
    <div class="ns-body f-pty">
      ${G.save.tut === TUT.dungeon ? '<p class="coachtip">파티는 파티 찾기로 무작위로 들어옴. 마음에 안 들면 <b>다시 뽑기</b> (처음 한 번 무료). 준비되면 「출발」.</p>' : ''}
      ${boardHtml()}
      ${isGuild ? guildPickHtml(stage) : `<section class="pn f-mems"><ul class="pcards">${rows}</ul></section>`}
      ${hs.length ? `<section class="pn f-hint hint" aria-label="이번 파티 힌트">${hs.map(h => `<p>${BULB}<span>${esc(h)}</span></p>`).join('')}</section>` : ''}
      ${slotRow(slots, items)}
      ${msg && !sheet ? `<p class="note warn">${esc(msg)}</p>` : ''}
      ${tutDone && !isGuild && cost && adLeft > 0 ? `<button class="btn2 f-adrr" type="button" id="adReroll">광고 보고 무료로 다시 뽑기 · 오늘 ${adLeft}번</button>` : ''}
    </div>
    <footer class="ns-foot f-foot2">
      <button class="f-rr" type="button" id="reroll"><span class="f-rrt">다시 뽑기</span>${cost ? `<small>${uiIcon('coin', 'in')}${fmt(cost)}</small>` : '<small class="free">무료 1회</small>'}</button>
      <button class="f-go" type="button" id="depart"><span class="f-gt">출발</span>${ARROW}</button>
    </footer>
    ${sheetHtml(slots, items)}`;
  msg = '';
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const md = t.closest<HTMLElement>('[data-mode]');
  if (md && !md.hasAttribute('disabled')) { Flow.mode = md.dataset.mode as 'public' | 'guild'; compose(); render(); return; }
  const gp = t.closest<HTMLElement>('[data-gpick]');
  if (gp) { const r = togglePick(G.save, firstEnc(), Flow.gpick, Number(gp.dataset.gpick)); Flow.gpick = r.pick; gmsg = r.msg; compose(); render(); gmsg = ''; return; }
  if (t.closest('#autoPick')) { G.save.guild.pick = []; Flow.gpick = autoPick(G.save, firstEnc()); compose(); render(); return; }
  const pr = t.closest<HTMLElement>('[data-prow]');
  if (pr) { const i = Number(pr.dataset.prow); openRow = openRow === i ? -1 : i; render(); return; }
  if (t.closest('[data-slots]')) { sheet = true; render(); return; }
  if (t.closest('[data-shut]')) { sheet = false; render(); return; }
  const it = t.closest<HTMLElement>('[data-item]');
  if (it) {
    msg = toggleItem(it.dataset.item as ItemKey);
    render(); return;
  }
  if (t.closest('#reroll')) {
    const cost = rerollCost(Flow.rerolls);
    if (G.save.player.gold < cost) { msg = `골드 부족 (골드 ${fmt(cost)} 필요)`; render(); return; }
    G.save.player.gold -= cost; Flow.rerolls++; commit();
    roll(); compose(); render(); return;
  }
  if (t.closest('#adReroll')) { void adReroll(); return; }
  if (t.closest('#depart')) { msg = depart(); if (msg) render(); }
});

// 줄을 키보드로: Enter·Space = 누르기, Esc = 시트 닫기
s.el.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheet) { sheet = false; render(); return; }
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-prow], [data-gpick]');
  if (row && row === e.target) { e.preventDefault(); row.click(); }
});

/** 광고 다시 뽑기 (15 7장): 하루 2번, 골드 대신 */
async function adReroll(): Promise<void> {
  const save = G.save, mem = isMember(save);
  if (save.daily.ads.reroll >= AD_LIMIT.reroll) return;
  if (!(await showRewarded('파티 다시 뽑기 (무료)', mem))) return;
  save.daily.ads.reroll++; commit();
  roll(); compose(); render();
}

/** 지면 광고 보고 진 구간부터 다시 (15 7장): 하루 3번, 등급 최대 B. 주간 도전·자동 힐러 판·스스로 포기한 판은 안 물어봄 */
async function tryContinue(r: BattleResult): Promise<boolean> {
  const save = G.save;
  if (save.tut < TUT.done || r.win || r.quit || r.giveUp || r.auto || Flow.chal || save.daily.ads.cont >= AD_LIMIT.cont) return false;
  const mem = isMember(save), left = AD_LIMIT.cont - save.daily.ads.cont;
  const yes = await askModal(mem ? '이어하기' : '광고 보고 이어하기', `${esc(r.reason)}<br>진 구간부터 다시 (마나는 그 구간 시작 때로)<br>등급 최대 B · 오늘 ${left}번`, '정산으로', mem ? '이어하기' : '📺 이어하기');
  if (!yes || !(await showRewarded('이어하기', mem))) return false;
  save.daily.ads.cont++; commit();
  battle().resume();
  return true;
}

/** 출발. 악몽은 종 조각 1개 (12 3-4). 못 가면 이유를 돌려줌 */
export function depart(): string {
  const c = contentOf(Flow.content);
  const tutDone = G.save.tut >= TUT.done;
  if (tutDone && !Flow.chal && needsShard(Flow.diff)) { const err = spendShard(G.save); if (err) return err; commit(); }
  if (Flow.mode === 'guild' && guildReady()) { G.save.guild.pick = Flow.gpick.slice(); commit(); }
  // 튜토리얼 첫 던전이면 전투 중 안내 (02 11장 4·5번)
  const coach = Flow.coach ?? (G.save.tut === TUT.dungeon && c.key === 'rustfort' ? 'dungeon' : null);
  Flow.coach = null;
  const { slots, items } = itemsNow();
  const m = modeNow();
  battle().start({
    content: c.key, name: Flow.chal ? `도전 ${Flow.chal}단계` : c.name, segs: c.fights(Flow.diff), diff: Flow.diff, level: healerLevel(), heroLv: G.save.player.level, stageLv: m.stage, gearStats: gearStatsOf(G.save.gear.equipped),
    affixes: m.affixes, bossMult: m.bossMult, limit: m.limit, chal: m.chal || undefined,
    party: Flow.party!, items, slots, seed: Flow.seed, coach, hero: heroNow(), talents: talentsNow(),
    stock: tutDone ? { ...G.save.bag } : undefined,
    async onEnd(r) {
      if (await tryContinue(r)) return;
      Flow.result = r;
      Flow.settle = settle(G.save, r, Math.random, Flow.party!);
      commit();
      go('s-settle');
    },
  });
  return '';
}
