/**
 * S05 편성 (27 3-3, 시안 Party27). 2026-10-08 입장 화면(S04)을 여기로 합침: 전투 탭 「출전」 → 편성 → 출발.
 * 위: 이름 · 난이도 · 어픽스 + 「공략」(시트: 구간 노드 줄 · 보스별 공략 · 어픽스 · 아이템 힌트), 공개모집 · 길드파티(Lv 15, 02 9-2) 폴더 탭 (길드를 빼 두면 없음),
 * 경고 줄 (해제 못 함 · 장비 미달일 때만), 시작 위치 육각 미리보기 (역할 아이콘만), 파티원 줄 (누르면 상세 시트).
 * 아래 고정: 단축칸 한 줄 칩 (누르면 고르기 시트) · 다시 뽑기(광고 하루 2번 무료) · 출발 (악몽은 종 조각, 없으면 눌렀을 때 얻는 곳 + 상점). 지면 광고 이어하기 (15)
 */
import { CLASSES } from '../data/classes';
import { contentOf, isRaid } from '../data/content';
import { CHAL } from '../data/challenge';
import { AD_LIMIT, SHARD_MAX } from '../data/economy';
import { gearStatsOf } from '../data/equipment';
import { FEATURES } from '../data/features';
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
import { memDetailHtml, memRowHtml, ROLE_ICON } from './members';
import { battle, esc, fmt, go, itemChipsHtml, ROLE, screen } from './kit';
import { classEmblem, LOCK, uiIcon } from './art';
import { afxRows, afxTags, ARROW, BELL, BOOK, diffNote, flowHead, guides, timeline, warnings } from './brief';
import { markHtml } from './content';

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
    sheet = null; openRow = -1;
    render();
  },
});
let msg = '', gmsg = '';
/** 열린 시트: 단축칸 고르기 · 공략 · 파티원 상세 */
let sheet: 'slots' | 'guide' | 'mem' | null = null;
/** 상세 시트로 연 파티원 줄 */
let openRow = -1;

const BULB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>';

const firstEnc = () => ENCOUNTERS[contentOf(Flow.content).fights(Flow.diff)[0]];
/** 이번 판 적 레벨·어픽스 (적 = 내 레벨, 어픽스는 난이도 · 주간 도전, 32) */
const modeNow = () => runMode(G.save, contentOf(Flow.content), Flow.diff, { chal: Flow.chal });
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
 * 칸 = 역할 색 + 역할 아이콘 (이름은 줄에), 나는 금테 + 직업 문장. 상세 시트로 연 파티원 칸은 빛남. 높이는 화면 높이 따라 (flow27.css --bh)
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
  const hero = heroNow(), sel = sheet === 'mem' ? Flow.party![openRow]?.nick : undefined;
  const who: string[] = [];
  const cells = f.cells.map(c => {
    const u = c.unit;
    const pos = `left:${pc(c.px - HW * K - x0, W)};top:${pc(c.py - R * K - y0, H)};width:${pc(2 * HW * K, W)};height:${pc(2 * R * K, H)}`;
    if (!u) return `<span class="f-hex empty" style="${pos}"><span class="f-hx"></span></span>`;
    if (u.me) return `<span class="f-hex me" style="${pos}"><span class="f-hx">${classEmblem(hero, 'sm')}</span></span>`;
    who.push(`${ROLE[u.role].name} ${u.nick}`);
    return `<span class="f-hex${u.nick === sel ? ' on' : ''}" style="${pos}"><span class="f-hx" style="background:${ROLE[u.role].color}">${ROLE_ICON[u.role] || ''}</span></span>`;
  }).join('');
  return `<figure class="f-board"><div class="f-hexes${size}" role="img" aria-label="시작 위치 (자동 배치, 옮길 수 없음): 나, ${esc(who.join(', '))}" style="aspect-ratio:${W.toFixed(3)} / ${H.toFixed(3)};--ar:${(W / H).toFixed(3)};--bmax:${(W * 38).toFixed(0)}px">${cells}</div><figcaption class="cap">시작 위치 · 자동 배치</figcaption></figure>`;
}

/** 이번 보스에 맞는 소비 아이템 힌트 (공략 시트·단축칸 시트) */
function itemHint(): string {
  const segs = contentOf(Flow.content).fights(Flow.diff);
  return battle().itemHint(ENCOUNTERS[segs[segs.length - 1]].script).replace(/^💡\s*/, '');
}

/** 직업 없는 옛 파티 줄 (시뮬·옛 테스트용 파티) */
function plainRow(m: { role: string; nick: string; pers: keyof typeof PERS }): string {
  const p = PERS[m.pers];
  return `<li class="pcard f-mem"><span class="f-ri" style="background:${ROLE[m.role].color}">${ROLE_ICON[m.role] || ''}</span><div class="f-mt"><span class="f-l1"><b class="pnick">${esc(m.nick)}</b><span class="cap">${ROLE[m.role].name}</span><span class="f-sp"></span><span class="f-ps${p.star >= 3 ? ' hard' : ''}"><i style="background:${CATS[p.cat]}" aria-hidden="true">${p.ch}</i>${esc(m.pers)}${p.star >= 3 ? '<em aria-hidden="true">!</em>' : ''}</span></span></div></li>`;
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

/** 단축칸 한 줄 (27 3-3): 고른 아이템 칩 + 빈칸. 어느 칸이든 누르면 고르기 시트 */
function slotRow(slots: number, items: ItemKey[]): string {
  const stock = G.save.tut >= TUT.done ? G.save.bag : null;
  const chips = items.map(k => {
    const n = stock ? stock[k] || 0 : null;
    return `<button class="f-item${n === 0 ? ' zero' : ''}" type="button" data-slots>${battle().itemIcon(k)}<span>${ITEMS[k].short}</span>${n != null ? `<small><span class="sr">남은 </span>${n}</small>` : ''}</button>`;
  }).join('');
  const empty = Array.from({ length: Math.max(0, slots - items.length) }, () => '<button class="f-item empty" type="button" data-slots>빈칸</button>').join('');
  return `<div class="f-slots" role="group" aria-label="단축칸 ${slots}칸 (누르면 바꾸기)"><span class="cap f-slab" aria-hidden="true">단축칸</span>${chips}${empty}</div>`;
}

/** 아래에서 올라오는 시트 (열 때만 그림) */
const sheetBox = (cls: string, label: string, inner: string) =>
  `<div class="sheet-dim" data-shut></div><section class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><span class="grip"></span>${inner}<button class="btn2 f-shut" type="button" data-shut>닫기</button></section>`;

/** 단축칸 고르기 시트 (캐릭터 › 스킬의 단축칸과 같은 저장). 닫혀 있어도 그려 둠 (칸 수·아이템 설명) */
function slotSheetHtml(slots: number, items: ItemKey[]): string {
  const hid = sheet === 'slots' ? '' : ' hidden', ih = itemHint();
  return `<div class="sheet-dim" data-shut${hid}></div><section class="sheet f-isheet" role="dialog" aria-modal="true" aria-label="단축칸 고르기" tabindex="-1"${hid}><span class="grip"></span>
    <h2 class="h-rule">단축칸 ${slots}칸<span class="rule"></span><span class="cap">${slots < 4 ? `Lv ${slots === 2 ? 20 : 40}에 1칸 더` : '최대'}</span></h2>
    ${ih ? `<p class="f-ih">${BULB}<span>${esc(ih)}</span></p>` : ''}
    ${itemChipsHtml(items)}
    <p class="note${sheet === 'slots' && msg ? ' warn' : ''}">${sheet === 'slots' && msg ? esc(msg) : items.map(k => `<b>${ITEMS[k].short}</b> ${ITEMS[k].desc}`).join('<br>') || '빈 칸'}</p>
    <button class="btn2 f-shut" type="button" data-shut>닫기</button></section>`;
}

/** 공략 시트 (입장 화면의 구간·공략·어픽스를 옮김): 난이도 수치 · 어픽스 · 구간 노드 줄 · 보스별 공략 접기 (보스 하나면 노드 줄 없이 바로 기술) · 아이템 힌트 */
function guideSheetHtml(): string {
  const c = contentOf(Flow.content), segs = c.fights(Flow.diff), m = modeNow(), ih = itemHint();
  return sheetBox('f-gsheet', '공략', `<h2 class="h-rule">공략<span class="rule"></span><span class="cap">${esc(c.name)} ${Flow.diff} · ${c.size(Flow.diff)}인</span></h2>
    <p class="note f-dnote">${esc(diffNote(Flow.diff, isRaid(c)))}</p>
    ${afxRows(m.affixes, Flow.chal ? '이번 주' : Flow.diff)}
    ${segs.length > 1 ? timeline(segs) : ''}
    ${guides(segs, Flow.diff, m.stage)}
    ${ih ? `<p class="f-ih">${BULB}<span>${esc(ih)}</span></p>` : ''}`);
}

/** 파티원 상세 시트 (줄을 누르면): 능력 · 자질 · 직업 패시브 · 특성 · 성격 */
function memSheetHtml(stage: number): string {
  const m = Flow.party![openRow];
  if (!m?.cls) return '';
  return sheetBox('f-msheet', `${m.nick} 상세`, `<h2 class="h-rule">${esc(m.nick)}<span class="rule"></span><span class="cap">${CLASSES[m.cls].name} · Lv ${m.lv ?? stage}</span></h2>${memDetailHtml({ ...m, cls: m.cls })}`);
}

function render(): void {
  const c = contentOf(Flow.content);
  const { slots, items } = itemsNow();
  const cost = rerollCost(Flow.rerolls);
  const go2 = guildOpen(G.save);
  const guildTab = !go2.ok ? ` ${LOCK}${go2.why.replace('에 열림', '')}` : !G.save.guild.members.length ? ' · 길드원 없음' : '';
  const isGuild = Flow.mode === 'guild' && guildReady();
  const m = modeNow(), stage = m.stage, segs = c.fights(Flow.diff);
  const tutDone = G.save.tut >= TUT.done, adLeft = AD_LIMIT.reroll - G.save.daily.ads.reroll;
  // 악몽 = 출발할 때 종 조각 1개 (12 3-4). 없으면 출발이 흐려지고, 누르면 아래에 얻는 곳 + 상점
  const shardOn = tutDone && !Flow.chal && needsShard(Flow.diff), shards = G.save.wallet.shards, noShard = shardOn && !shards;
  const sub = Flow.chal ? `주간 도전 ${Flow.chal}단계` : `${Flow.diff}${m.affixes.length ? ` <span class="f-afxs">${afxTags(m.affixes)}</span>` : ''}`;
  const mark = Flow.chal ? `<span class="f-hg sm">${uiIcon('hourglass')}</span>` : markHtml(c, 'sm');
  const guideBtn = `<button class="f-gbtn" type="button" id="guideOpen" aria-haspopup="dialog">${BOOK}<span>공략</span></button>`;
  const rows = Flow.party!.map((p, i) => (p.cls
    ? memRowHtml({ ...p, cls: p.cls }, { attrs: `data-cls="${p.cls}" data-prow="${i}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on: sheet === 'mem' && openRow === i })
    : plainRow(p))).join('');
  s.el.innerHTML = `${flowHead(Flow.chal ? 's-entry' : 's-content', Flow.chal ? CHAL.name : c.name, sub, mark, guideBtn)}
    ${FEATURES.guild ? `<nav class="subtabs" role="tablist" aria-label="파티 모집"><button type="button" role="tab" data-mode="public" aria-selected="${!isGuild}">공개모집</button><button type="button" role="tab" data-mode="guild" aria-selected="${isGuild}"${guildReady() ? '' : ' disabled'}>길드파티${guildTab}</button></nav>` : ''}
    <div class="ns-body f-pty">
      ${G.save.tut === TUT.dungeon ? '<p class="coachtip">파티는 파티 찾기로 무작위로 들어옴. 마음에 안 들면 <b>다시 뽑기</b> (처음 한 번 무료). 보스 기술은 「공략」. 준비되면 「출발」.</p>' : ''}
      ${tutDone ? warnings(segs, Flow.diff, stage, { gear: !Flow.chal }) : ''}
      ${boardHtml()}
      ${isGuild ? guildPickHtml(stage) : `<section class="pn f-mems"><ul class="pcards">${rows}</ul></section>`}
      ${msg && !sheet && !noShard ? `<p class="note warn">${esc(msg)}</p>` : ''}
      ${tutDone && !isGuild && cost && adLeft > 0 ? `<button class="btn2 f-adrr" type="button" id="adReroll">광고 보고 무료로 다시 뽑기 · 오늘 ${adLeft}번</button>` : ''}
    </div>
    <footer class="ns-foot f-foot2">
      ${noShard && msg ? `<p class="f-warn ticket" role="alert"><span class="f-mark warn" aria-hidden="true">!</span><span class="v">종 조각이 없음 <span class="cap">상점에서 제작하거나 주간 임무로</span></span><button class="btn2" type="button" data-go="s-shop" data-arg="gold">상점</button></p>` : ''}
      ${slotRow(slots, items)}
      <div class="f-btns">
        <button class="f-rr" type="button" id="reroll"><span class="f-rrt">다시 뽑기</span>${cost ? `<small>${uiIcon('coin', 'in')}${fmt(cost)}</small>` : '<small class="free">무료 1회</small>'}</button>
        <button class="f-go" type="button" id="depart"${noShard ? ' aria-disabled="true"' : ''}>${shardOn ? BELL : ''}<span class="cta2"><span class="f-gt">출발</span>${shardOn ? `<small>${shards ? `종 조각 1개 씀 · ${shards}/${SHARD_MAX}` : '종 조각 없음'}</small>` : ''}</span>${ARROW}</button>
      </div>
    </footer>
    ${slotSheetHtml(slots, items)}
    ${sheet === 'guide' ? guideSheetHtml() : sheet === 'mem' ? memSheetHtml(stage) : ''}`;
  msg = '';
  if (sheet) s.el.querySelector<HTMLElement>('.sheet:not([hidden])')?.focus();
}

/** 시트 열기·닫기. 닫으면 연 버튼으로 초점을 돌려줌 */
let opener = '';
function openSheet(k: typeof sheet, from: string): void { sheet = k; opener = from; render(); }
function shut(): void {
  sheet = null; render();
  if (opener) s.el.querySelector<HTMLElement>(opener)?.focus();
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-shut]')) { shut(); return; }
  if (t.closest('#guideOpen')) { openSheet('guide', '#guideOpen'); return; }
  const md = t.closest<HTMLElement>('[data-mode]');
  if (md && !md.hasAttribute('disabled')) { Flow.mode = md.dataset.mode as 'public' | 'guild'; compose(); render(); return; }
  const gp = t.closest<HTMLElement>('[data-gpick]');
  if (gp) { const r = togglePick(G.save, firstEnc(), Flow.gpick, Number(gp.dataset.gpick)); Flow.gpick = r.pick; gmsg = r.msg; compose(); render(); gmsg = ''; return; }
  if (t.closest('#autoPick')) { G.save.guild.pick = []; Flow.gpick = autoPick(G.save, firstEnc()); compose(); render(); return; }
  const pr = t.closest<HTMLElement>('[data-prow]');
  if (pr) { openRow = Number(pr.dataset.prow); openSheet('mem', `[data-prow="${openRow}"]`); return; }
  if (t.closest('[data-slots]')) { openSheet('slots', '.f-slots [data-slots]'); return; }
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
  if (e.key === 'Escape' && sheet) { shut(); return; }
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
