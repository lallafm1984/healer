/**
 * S05 편성 (27 3-3, 시안 Party27). 2026-10-08 입장 화면(S04)을 여기로 합침: 전투 탭 「출전」 → 편성 → 출발.
 * 위: 이름 · 난이도 · 어픽스 + 「공략」(시트: 구간 노드 줄 · 보스별 공략 · 어픽스 · 아이템 힌트), 공개모집 · 길드파티(Lv 15, 02 9-2) 폴더 탭 (길드를 빼 두면 없음),
 * 경고 줄 (해제 못 함 · 권장 레벨 미달일 때만), 시작 위치 육각 미리보기 (직업 아이콘), 파티원 줄 (누르면 상세 시트).
 * 아래 고정: 위치가 저장되는 단축칸 4개 · 출발 (악몽은 악몽 열쇠, 없으면 눌렀을 때 얻는 곳 + 상점). 지면 광고 이어하기 (15)
 */
import { CLASSES } from '../data/classes';
import { contentOf, isRaid } from '../data/content';
import { CHAL } from '../data/challenge';
import { AD_LIMIT, SHARD_MAX } from '../data/economy';
import { gearStatsOf, specsOf } from '../data/equipment';
import { FEATURES } from '../data/features';
import { ENCOUNTERS } from '../data/encounters';
import { ITEMS, type ItemKey } from '../data/items';
import { ITEM_SLOT_COUNT, type ItemSlot } from '../data/item-loadout';
import { ITEM_SLOT_LV } from '../data/progression';
import { CATS, PERS } from '../data/personalities';
import { aptOf } from '../data/guild';
import { create, recruitParty } from '../engine';
import { Flow, newSeed } from '../game/flow';
import { autoPick, guildOpen, guildRoster, powerOf, slotsOf, togglePick } from '../game/guild';
import { isMember, needsShard, spendShard } from '../game/economy';
import { runMode } from '../game/runmode';
import { askModal, showRewarded } from '../platform/ads';
import type { BattleResult } from '../game/settle';
import { settle } from '../game/settle';
import { commit, firstDungeonNow, G, healerLevel, heroNow, itemsNow, setItemSlot, talentsNow } from '../game/state';
import { TUT } from '../game/tutorial';
import { classIcon, memDetailHtml, memRowHtml, ROLE_ICON } from './members';
import { battle, esc, go, ROLE, screen, useIcon } from './kit';
import { classEmblem, LOCK, uiIcon } from './art';
import { afxRows, afxTags, ARROW, BOOK, flowHead, guides, KEY, segTabs, warnings } from './brief';
import { markHtml } from './content';
import { sheetDialog } from './dialog';

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
    render(false);
  },
});
const modal = sheetDialog(s.el, shut);
let msg = '', gmsg = '';
/** 열린 시트: 단축칸 고르기 · 공략 · 파티원 상세 */
let sheet: 'slots' | 'guide' | 'mem' | null = null;
/** 상세 시트로 연 파티원 줄 */
let openRow = -1;
/** 공략 시트에서 고른 구간 (-1 = 처음 열 때 마지막 구간) */
let gseg = -1;
/** 고르기 시트를 연 정확한 단축칸. */
let openSlot = 0;

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
 * 칸 = 역할 색 + 직업 아이콘 (이름은 줄에), 나는 금테 + 직업 문장. 상세 시트로 연 파티원 칸은 빛남.
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
    who.push(`${u.cls ? CLASSES[u.cls].name : ROLE[u.role].name} ${u.nick}`);
    return `<span class="f-hex${u.nick === sel ? ' on' : ''}" style="${pos}"><span class="f-hx" style="background:${ROLE[u.role].color}">${u.cls ? classIcon(u.cls) : ROLE_ICON[u.role] || ''}</span></span>`;
  }).join('');
  return `<figure class="f-board"><div class="f-hexes${size}" role="img" aria-label="시작 위치 (자동 배치, 옮길 수 없음): 나, ${esc(who.join(', '))}" style="aspect-ratio:${W.toFixed(3)} / ${H.toFixed(3)};--ar:${(W / H).toFixed(3)};--bmax:${(W * 38).toFixed(0)}px">${cells}</div></figure>`;
}

/** 이번 보스에 맞는 소비 아이템 힌트 (단축칸 시트) */
function itemHint(): string {
  const segs = contentOf(Flow.content).fights(Flow.diff);
  return battle().itemHint(ENCOUNTERS[segs[segs.length - 1]].script).replace(/^💡\s*/, '');
}

/** 직업 없는 옛 파티 줄 (시뮬·옛 테스트용 파티) */
function plainRow(m: { role: string; nick: string; pers: keyof typeof PERS }): string {
  const p = PERS[m.pers];
  return `<li class="pcard f-mem"><span class="f-ri" style="background:${ROLE[m.role].color}">${ROLE_ICON[m.role] || ''}</span><div class="f-mt"><span class="f-l1"><b class="pnick">${esc(m.nick)}</b><span class="cap">${ROLE[m.role].name}</span><span class="f-sp"></span><span class="f-ps${p.star >= 3 ? ' hard' : ''}" style="--pers-color:${CATS[p.cat]}">${esc(m.pers)}</span></span></div></li>`;
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

/** 네 칸을 항상 표시한다. 빈칸과 잠긴 칸도 같은 위치에 남긴다. */
function slotRow(slots: number, loadout: ItemSlot[]): string {
  const stock = G.save.tut >= TUT.done ? G.save.bag : null;
  const chips = Array.from({ length: ITEM_SLOT_COUNT }, (_, i) => {
    const number = `<span class="f-slot-number" aria-hidden="true">${i + 1}</span>`;
    const k = loadout[i], attrs = `data-slot="${i}" data-slots="${i}"`;
    if (i >= slots) return `<button class="f-item locked" type="button" ${attrs} disabled aria-label="${i + 1}번 단축칸 · Lv ${ITEM_SLOT_LV[i - 1]}에 열림">${number}${LOCK}<span>잠김</span><small>Lv ${ITEM_SLOT_LV[i - 1]}</small></button>`;
    if (!k) return `<button class="f-item empty" type="button" ${attrs} aria-label="${i + 1}번 단축칸 · 빈칸 · 아이템 고르기" aria-haspopup="dialog">${number}<span>빈칸 +</span></button>`;
    const n = stock ? stock[k] || 0 : null;
    return `<button class="f-item${n === 0 ? ' zero' : ''}" type="button" ${attrs} data-slot-item="${k}" aria-label="${i + 1}번 단축칸 · ${ITEMS[k].name}${n != null ? ` · 보유 ${n}개` : ''} · 바꾸기" aria-haspopup="dialog">${number}${useIcon(k)}<span>${ITEMS[k].short}</span>${n != null ? `<small><span class="sr">남은 </span>${n}</small>` : ''}</button>`;
  }).join('');
  return `<div class="f-slots" role="group" aria-label="단축칸 4칸 중 ${slots}칸 열림">${chips}</div>`;
}

/** 아래에서 올라오는 시트 (열 때만 그림) */
const sheetBox = (cls: string, label: string, inner: string) => {
  const close = '<button class="btn2 f-shut" type="button" data-shut>닫기</button>';
  const body = cls === 'f-gsheet' ? `<div class="f-sheet-body">${inner}</div><footer class="f-sheet-actions">${close}</footer>` : `${inner}${close}`;
  return `<div class="sheet-dim" data-shut></div><section class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><span class="grip"></span>${body}</section>`;
};

/** 단축칸 고르기 시트 (캐릭터 › 스킬의 단축칸과 같은 저장). 닫혀 있어도 그려 둠 (칸 수·아이템 설명) */
function slotSheetHtml(loadout: ItemSlot[]): string {
  const hid = sheet === 'slots' ? '' : ' hidden', ih = itemHint();
  const stock = G.save.tut >= TUT.done ? G.save.bag : null;
  const options = (Object.keys(ITEMS) as ItemKey[]).map(k => {
    const it = ITEMS[k], at = loadout.indexOf(k), selected = at === openSlot, n = stock ? stock[k] || 0 : null;
    const status = selected ? '선택됨' : at >= 0 ? `${at + 1}번 칸${loadout[openSlot] ? '과 교체' : '에서 이동'}` : '이 칸에 지정';
    return `<button type="button" class="f-item-option${selected ? ' selected' : ''}${n === 0 ? ' zero' : ''}" data-item="${k}" aria-pressed="${selected}"><span class="f-item-art">${useIcon(k)}</span><span class="f-item-copy"><b>${it.name}</b><small class="f-item-stock">${n == null ? '튜토리얼 제공' : `보유 ${n}개`}</small><span class="f-item-desc">${esc(it.desc)}</span><em class="f-item-status">${status}</em></span></button>`;
  }).join('');
  return `<div class="sheet-dim" data-shut${hid}></div><section class="sheet f-isheet" role="dialog" aria-modal="true" aria-label="${openSlot + 1}번 단축칸 아이템" data-edit-slot="${openSlot}" tabindex="-1"${hid}><span class="grip"></span>
    <h2 class="h-rule">${openSlot + 1}번 단축칸 아이템<span class="rule"></span></h2>
    ${ih ? `<p class="f-ih">${BULB}<span>${esc(ih)}</span></p>` : ''}
    <div class="f-item-options">${options}</div>
    ${sheet === 'slots' && msg ? `<p class="note warn" role="status">${esc(msg)}</p>` : ''}
    <div class="f-item-actions"><button class="btn2" type="button" data-item-clear${loadout[openSlot] ? '' : ' disabled'}>이 칸 비우기</button><button class="btn2 f-shut" type="button" data-shut>닫기</button></div></section>`;
}

/**
 * 공략 시트 (2026-10-12 한눈에): 머리 (장소 · 난이도 · 인원) · 어픽스 · 구간 길 = 탭 (보스 하나면 탭 없이) · 고른 구간 공략.
 * 처음 열면 마지막 구간 (최종 보스). 난이도 수치 칸 · 아이템 힌트는 Lim 「빼기」 (2026-10-12 13:33, 아이템 힌트는 단축칸 시트에만)
 */
function guideSheetHtml(): string {
  const c = contentOf(Flow.content), segs = c.fights(Flow.diff), m = modeNow();
  const sel = gseg >= 0 && gseg < segs.length ? gseg : segs.length - 1;
  return sheetBox('f-gsheet', '공략', `<header class="f-gh"><h2 class="f-gt">${BOOK}<span>공략</span></h2><p class="f-gp"><b>${esc(c.name)}</b><span class="f-gc d">${Flow.diff}</span><span class="f-gc">${c.size(Flow.diff)}인</span></p></header>
    ${Flow.diff === '악몽' && isRaid(c) ? '<p class="f-dnote">보스마다 악몽 전용 기술</p>' : ''}
    ${afxRows(m.affixes, Flow.chal ? '이번 주' : Flow.diff)}
    ${segs.length > 1 ? segTabs(segs, sel) : ''}
    ${guides(segs, Flow.diff, m.stage, sel)}`);
}

/** 공략 시트 구간 탭 바꾸기: 다시 그리지 않고 판만 바꿈 (스크롤이 길 아래면 길 위치로) */
function pickSeg(i: number, focus = false): void {
  const root = s.el.querySelector<HTMLElement>('.f-gsheet');
  if (!root) return;
  gseg = i;
  root.querySelectorAll<HTMLElement>('[data-gseg]').forEach(b => { const on = Number(b.dataset.gseg) === i; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  root.querySelectorAll<HTMLElement>('[data-gpane]').forEach(p => { p.hidden = Number(p.dataset.gpane) !== i; });
  const body = root.querySelector<HTMLElement>('.f-sheet-body'), route = root.querySelector<HTMLElement>('.f-route');
  if (body && route && body.scrollTop > route.offsetTop) body.scrollTop = route.offsetTop;
}

/** 파티원 상세 시트 (줄을 누르면): 능력 · 자질 · 직업 패시브 · 특성 · 성격 */
function memSheetHtml(stage: number): string {
  const m = Flow.party![openRow];
  if (!m?.cls) return '';
  return sheetBox('f-msheet', `${m.nick} 상세`, `<h2 class="h-rule">${esc(m.nick)}<span class="rule"></span><span class="cap">${CLASSES[m.cls].name} · Lv ${m.lv ?? stage}</span></h2>${memDetailHtml({ ...m, cls: m.cls })}`);
}

function render(keepScroll = true): void {
  modal.beforeRender();
  const scroll = keepScroll ? s.el.querySelector<HTMLElement>('.ns-body')?.scrollTop || 0 : 0;
  const itemScroll = sheet === 'slots' ? s.el.querySelector<HTMLElement>('.f-item-options')?.scrollTop || 0 : 0;
  const c = contentOf(Flow.content);
  const { slots, loadout } = itemsNow();
  const go2 = guildOpen(G.save);
  const guildTab = !go2.ok ? ` ${LOCK}${go2.why.replace('에 열림', '')}` : !G.save.guild.members.length ? ' · 길드원 없음' : '';
  const isGuild = Flow.mode === 'guild' && guildReady();
  const m = modeNow(), stage = m.stage, segs = c.fights(Flow.diff);
  const tutDone = G.save.tut >= TUT.done;
  // 악몽 = 출발할 때 악몽 열쇠 1개 (12 3-4). 없으면 출발이 흐려지고, 누르면 아래에 얻는 곳 + 상점
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
      ${c.key === 'rustfort' && firstDungeonNow() ? '<p class="coachtip">보스 기술은 「공략」에서 확인. 단축칸을 준비하면 「출발」.</p>' : ''}
      ${tutDone ? warnings(segs, stage) : ''}
      ${boardHtml()}
      ${isGuild ? guildPickHtml(stage) : `<section class="pn f-mems"><ul class="pcards">${rows}</ul></section>`}
      ${msg && !sheet && !noShard ? `<p class="note warn">${esc(msg)}</p>` : ''}
    </div>
    <footer class="ns-foot f-foot2">
      ${noShard && msg ? `<p class="f-warn ticket" role="alert"><span class="f-mark warn" aria-hidden="true">!</span><span class="v">악몽 열쇠가 없음 <span class="cap">상점에서 제작하거나 주간 임무로</span></span><button class="btn2" type="button" data-go="s-shop" data-arg="gold">상점</button></p>` : ''}
      ${slotRow(slots, loadout)}
      <div class="f-btns">
        <button class="f-go" type="button" id="depart"${noShard ? ' aria-disabled="true"' : ''}>${shardOn ? KEY : ''}<span class="cta2"><span class="f-gt">출발</span>${shardOn ? `<small>${shards ? `악몽 열쇠 1개 씀 · ${shards}/${SHARD_MAX}` : '악몽 열쇠 없음'}</small>` : ''}</span>${ARROW}</button>
      </div>
    </footer>
    ${slotSheetHtml(loadout)}
    ${sheet === 'guide' ? guideSheetHtml() : sheet === 'mem' ? memSheetHtml(stage) : ''}`;
  msg = '';
  const body = s.el.querySelector<HTMLElement>('.ns-body');
  if (body) body.scrollTop = scroll;
  const itemList = s.el.querySelector<HTMLElement>('.f-item-options');
  if (itemList) itemList.scrollTop = itemScroll;
  modal.sync(sheet ? s.el.querySelector<HTMLElement>('.sheet:not([hidden])') : null, sheet ? [`${sheet}:${sheet === 'mem' ? openRow : sheet === 'slots' ? openSlot : ''}`] : []);
}

/** 시트 열기·닫기. 닫으면 연 버튼으로 초점을 돌려줌 */
function openSheet(k: typeof sheet, from: string): void {
  // Keyboard and pointer openings use the same non-scrolling return target.
  s.el.querySelector<HTMLElement>(from)?.focus({ preventScroll: true });
  sheet = k; render();
}
function shut(): void {
  sheet = null; render();
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-shut]')) { shut(); return; }
  if (t.closest('#guideOpen')) { gseg = -1; openSheet('guide', '#guideOpen'); return; }
  const gt = t.closest<HTMLElement>('[data-gseg]');
  if (gt) { pickSeg(Number(gt.dataset.gseg)); return; }
  const md = t.closest<HTMLElement>('[data-mode]');
  if (md && !md.hasAttribute('disabled')) { Flow.mode = md.dataset.mode as 'public' | 'guild'; compose(); render(); return; }
  const gp = t.closest<HTMLElement>('[data-gpick]');
  if (gp) { const r = togglePick(G.save, firstEnc(), Flow.gpick, Number(gp.dataset.gpick)); Flow.gpick = r.pick; gmsg = r.msg; compose(); render(); gmsg = ''; return; }
  if (t.closest('#autoPick')) { G.save.guild.pick = []; Flow.gpick = autoPick(G.save, firstEnc()); compose(); render(); return; }
  const pr = t.closest<HTMLElement>('[data-prow]');
  if (pr) { openRow = Number(pr.dataset.prow); openSheet('mem', `[data-prow="${openRow}"]`); return; }
  const slot = t.closest<HTMLButtonElement>('[data-slots]');
  if (slot && !slot.disabled) { openSlot = Number(slot.dataset.slot); openSheet('slots', `.f-slots [data-slot="${openSlot}"]`); return; }
  if (t.closest('[data-item-clear]')) { msg = setItemSlot(openSlot, null); render(); return; }
  const it = t.closest<HTMLElement>('[data-item]');
  if (it) {
    msg = setItemSlot(openSlot, it.dataset.item as ItemKey);
    render(); return;
  }
  if (t.closest('#depart')) { msg = depart(); if (msg) render(); }
});

// 줄을 키보드로: Enter·Space = 누르기, Esc = 시트 닫기
s.el.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheet) { shut(); return; }
  // 공략 구간 탭: ← → 로 옆 구간
  const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-gseg]');
  if (tab && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const n = s.el.querySelectorAll('[data-gseg]').length, i = Number(tab.dataset.gseg);
    e.preventDefault(); pickSeg((i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n, true); return;
  }
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-prow], [data-gpick]');
  if (row && row === e.target) { e.preventDefault(); row.click(); }
});

/** 지면 광고 보고 진 구간부터 다시 (15 7장): 하루 3번, 등급 최대 B. 주간 도전·자동 힐러 판·스스로 포기한 판은 안 물어봄 */
async function tryContinue(r: BattleResult): Promise<boolean> {
  const save = G.save;
  if (save.tut < TUT.done || r.win || r.quit || r.giveUp || r.auto || Flow.chal || save.daily.ads.cont >= AD_LIMIT.cont) return false;
  const mem = isMember(save), left = AD_LIMIT.cont - save.daily.ads.cont;
  const yes = await askModal(mem ? '이어하기' : '광고 보고 이어하기', `${esc(r.reason)}<br>진 구간부터 다시 (마나는 그 구간 시작 때로)<br>등급 최대 B · 오늘 ${left}번`, '정산으로', mem ? '이어하기' : `${uiIcon('ad', 'in')} 이어하기`);
  if (!yes || !(await showRewarded('이어하기', mem))) return false;
  save.daily.ads.cont++; commit();
  battle().resume();
  return true;
}

/** 출발. 악몽은 악몽 열쇠 1개 (12 3-4). 못 가면 이유를 돌려줌 */
export function depart(): string {
  const c = contentOf(Flow.content);
  const tutDone = G.save.tut >= TUT.done;
  if (tutDone && !Flow.chal && needsShard(Flow.diff)) { const err = spendShard(G.save); if (err) return err; commit(); }
  if (Flow.mode === 'guild' && guildReady()) { G.save.guild.pick = Flow.gpick.slice(); commit(); }
  // 튜토리얼 첫 던전이면 전투 중 안내 (02 11장 4·5번)
  const coach = Flow.coach ?? (c.key === 'rustfort' && firstDungeonNow() ? 'dungeon' : null);
  Flow.coach = null;
  const { slots, items, loadout } = itemsNow();
  const m = modeNow();
  battle().start({
    content: c.key, name: Flow.chal ? `도전 ${Flow.chal}단계` : c.name, segs: c.fights(Flow.diff), diff: Flow.diff, level: healerLevel(), heroLv: G.save.player.level, stageLv: m.stage, gearStats: gearStatsOf(G.save.gear.equipped),
    affixes: m.affixes, bossMult: m.bossMult, limit: m.limit, chal: m.chal || undefined,
    party: Flow.party!, items, itemLayout: loadout, slots, seed: Flow.seed, coach, hero: heroNow(), talents: talentsNow(), specs: specsOf(G.save.gear.equipped, heroNow()),
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
