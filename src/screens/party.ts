/**
 * S05 편성 (27 3-3, 시안 Party27). 2026-10-08 입장 화면(S04)을 여기로 합침: 전투 탭 「출전」 → 편성 → 출발.
 * 위: 이름 · 난이도 · 어픽스 + 「공략」(시트: 구간 노드 줄 · 보스별 공략 · 어픽스), 공개모집 · 길드파티(Lv 15, 02 9-2) 폴더 탭 (길드를 빼 두면 없음),
 * 권장 레벨 안내 (미달일 때만), 시작 위치 육각 미리보기 (직업 아이콘), 파티원 줄 (누르면 상세 시트).
 * 아래 고정: 출발 (81 · 90: 「출전」 입장 확인을 거쳤으면 바로 전투. 안 거친 판이면 출발 때 팝업). 소비 아이템 단축칸은 2026-10-16 없앰.
 */
import { CLASSES } from '../data/classes';
import { contentOf, isRaid } from '../data/content';
import { CHAL } from '../data/challenge';
import { gearStatsOf, specsOf } from '../data/equipment';
import { FEATURES } from '../data/features';
import { ENCOUNTERS } from '../data/encounters';
import { CATS, PERS } from '../data/personalities';
import { create, recruitParty } from '../engine';
import { withBond } from '../game/bond';
import { recommendPick } from '../game/recommend';
import { Flow, newSeed } from '../game/flow';
import { autoPick, bondOf, guildNicks, guildOpen, guildRoster, isGuildParty, memberEntry, savePick, sizeKey, slotsOf, togglePick } from '../game/guild';
import { recLevel } from '../game/guide';
import { runMode } from '../game/runmode';
import { settle } from '../game/settle';
import { commit, firstDungeonNow, G, healerLevel, heroNow, talentsNow } from '../game/state';
import { TUT } from '../game/tutorial';
import { classIcon, memDetailHtml, memRowHtml, ROLE_ICON } from './members';
import { battle, esc, go, ROLE, screen } from './kit';
import { classEmblem, floorArtOf, gameIcon, LOCK, uiIcon } from './art';
import { afxRows, afxTags, ARROW, BOOK, flowHead, guides, recommendedLevel, segTabs } from './brief';
import { markHtml } from './content';
import { sheetDialog } from './dialog';

const s = screen('s-party', '파티 편성', {
  enter() {
    if (!Flow.party) {
      roll();
      // 길드원이 있으면 지난번 길드파티 편성으로 시작 (09 S05). 길드 탭 「길드파티로 출전」이면 길드파티로 (30)
      Flow.mode = guildReady() && ((G.save.guild.picks[sizeKey(firstEnc())]?.length ?? 0) || Flow.preferGuild) ? 'guild' : 'public';
      Flow.preferGuild = false;
      Flow.gpick = guildReady() ? autoPick(G.save, firstEnc()) : [];
      compose();
    }
    sheet = null; openRow = -1; recWhy = [];
    render(false);
  },
});
const modal = sheetDialog(s.el, shut);
let msg = '', gmsg = '';
/** 추천 편성 이유 칩 (누른 뒤, 손으로 바꾸면 지움) */
let recWhy: string[] = [];
/** 열린 시트: 공략 · 파티원 상세 */
let sheet: 'guide' | 'mem' | null = null;
/** 상세 시트로 연 파티원 줄 */
let openRow = -1;
/** 공략 시트에서 고른 구간 (-1 = 처음 열 때 마지막 구간) */
let gseg = -1;

const firstEnc = () => ENCOUNTERS[contentOf(Flow.content).fights(Flow.diff)[0]];
/** 이번 판 적 레벨·어픽스 (적 = 내 레벨, 어픽스는 난이도 · 주간 도전, 32) */
const modeNow = () => runMode(G.save, contentOf(Flow.content), Flow.diff, { chal: Flow.chal });
const guildReady = () => guildOpen(G.save).ok && G.save.guild.members.length > 0;

function roll(): void {
  const segs = contentOf(Flow.content).fights(Flow.diff);
  Flow.seed = newSeed();
  openRow = -1;
  // 공개모집 파티원도 능력 1개 (17 3장). 튜토리얼 파티는 능력 없음
  // 97 FM: 칸 레벨 ±1인 모험가. 길드원은 공개모집에 안 나옴 (93 7-2)
  Flow.pub = recruitParty(segs[0], Flow.seed, { abilities: G.save.tut >= TUT.done, myLv: G.save.player.level, stageLv: modeNow().stage, exclude: guildNicks(G.save) });
}

/** 전투에 넘길 파티: 공개모집 그대로, 또는 고른 길드원 + 빈자리는 공개모집 */
function compose(): void {
  const list = Flow.mode === 'guild' && guildReady() ? guildRoster(G.save, Flow.gpick, Flow.pub!, firstEnc(), Flow.seed) : Flow.pub!.slice();
  Flow.party = withBond(G.save, list); // 은혜 갚기 호감도 = 인연 점수 (공개모집도)
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
  // 위치판 뒤 = 첫 전투 판과 같은 장소 바닥 그림 (2026-10-16 손질: 맨바닥 위 칸만 떠 있던 것)
  const floor = floorArtOf(segs[0]);
  return `<figure class="f-board${floor ? ' has-floor' : ''}"${floor ? ` style="--floor:url('${floor}')"` : ''}><div class="f-hexes${size}" role="img" aria-label="시작 위치 (자동 배치, 옮길 수 없음): 나, ${esc(who.join(', '))}" style="aspect-ratio:${W.toFixed(3)} / ${H.toFixed(3)};--ar:${(W / H).toFixed(3)};--bmax:${(W * 38).toFixed(0)}px">${cells}</div></figure>`;
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
  const list = ms.slice().sort((a, b) => (Flow.gpick.includes(b.id) ? 1 : 0) - (Flow.gpick.includes(a.id) ? 1 : 0) || b.lv - a.lv);
  const under = picked.filter(m => m!.lv < stage).length;
  const encs = contentOf(Flow.content).fights(Flow.diff), boss = encs[encs.length - 1];
  return `<p class="pickhead"><b>길드원 ${picked.length}/${sl.tank + sl.dps}</b><small>탱커 ${tanks}/${sl.tank} · 딜러 ${picked.length - tanks}/${sl.dps}${fill.length ? ` · 빈자리 ${fill.length} = 공개모집` : ''}</small><button class="btn2" type="button" id="autoPick">추천 편성</button></p>
    ${recWhy.length ? `<p class="f-why" aria-label="추천 이유">${recWhy.map(w => `<span class="chip">${esc(w)}</span>`).join('')}</p>` : ''}
    ${gmsg ? `<p class="warnbox">${esc(gmsg)}</p>` : ''}
    ${under ? `<p class="warnbox">권장 레벨(Lv ${stage})보다 낮은 길드원 ${under}명: 체력·딜이 낮음</p>` : ''}
    <section class="pn f-mems"><ul class="pcards">${list.map(m => {
      const on = Flow.gpick.includes(m.id);
      const e = memberEntry(G.save, m, Flow.seed);
      const ks = e.know?.[boss] ?? 0; // 이 보스 공략 숙지 (93 7-1)
      return memRowHtml({ ...m, star: e.star, fm: { stats: m.stats }, bond: bondOf(G.save, m.nick), member: true }, { attrs: `data-gpick="${m.id}" role="button" tabindex="0" aria-pressed="${on}"`, cls: `tap${on ? ' picked' : ''}`, tag: ks ? `${gameIcon('know', '숙지 ')}${ks}<span class="sr">단계 공략 숙지</span>` : '', gold: m.boost ? `${gameIcon('guild-sponsor', '후원 ')}${m.boost}<span class="sr">판 후원</span>` : '', extra: `<span class="pick${on ? ' on' : ''}" aria-hidden="true">${on ? '✓' : ''}</span>` });
    }).join('')}
    ${fill.map(m => (m.cls ? memRowHtml({ ...m, cls: m.cls, lv: m.lv ?? stage, bond: bondOf(G.save, m.nick) }, { cls: 'fill', note: '공개모집 보충' }) : plainRow(m))).join('')}</ul></section>`;
}

/** 아래에서 올라오는 시트 (열 때만 그림) */
const sheetBox = (cls: string, label: string, inner: string) => {
  const close = '<button class="btn2 f-shut" type="button" data-shut>닫기</button>';
  const body = cls === 'f-gsheet' ? `<div class="f-sheet-body">${inner}</div><footer class="f-sheet-actions">${close}</footer>` : `${inner}${close}`;
  return `<div class="sheet-dim" data-shut></div><section class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><span class="grip"></span>${body}</section>`;
};

/**
 * 공략 시트 (2026-10-12 한눈에): 머리 (장소 · 난이도 · 인원) · 어픽스 · 구간 길 = 탭 (보스 하나면 탭 없이) · 고른 구간 공략.
 * 처음 열면 마지막 구간 (최종 보스). 난이도 수치 칸은 Lim 「빼기」 (2026-10-12 13:33)
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
  const lastStatGains = m.gid != null ? G.save.guild.members.find(g => g.id === m.gid)?.lastStatGains : undefined;
  return sheetBox('f-msheet', `${m.nick} 상세`, `<h2 class="h-rule">${esc(m.nick)}<span class="rule"></span><span class="cap">${CLASSES[m.cls].name} · Lv ${m.lv ?? stage}</span></h2>${memDetailHtml({ ...m, cls: m.cls, bond: bondOf(G.save, m.nick), member: m.gid != null, lastStatGains })}`);
}

function render(keepScroll = true): void {
  modal.beforeRender();
  const scroll = keepScroll ? s.el.querySelector<HTMLElement>('.ns-body')?.scrollTop || 0 : 0;
  const c = contentOf(Flow.content);
  const go2 = guildOpen(G.save);
  const guildTab = !go2.ok ? ` ${LOCK}${go2.why.replace('에 열림', '')}` : !G.save.guild.members.length ? ' · 길드원 없음' : '';
  const isGuild = Flow.mode === 'guild' && guildReady();
  const m = modeNow(), stage = m.stage;
  const tutDone = G.save.tut >= TUT.done;
  const sub = Flow.chal ? `주간 도전 ${Flow.chal}단계` : `${Flow.diff}${m.affixes.length ? ` <span class="f-afxs">${afxTags(m.affixes)}</span>` : ''}`;
  const mark = Flow.chal ? `<span class="f-hg sm">${uiIcon('hourglass')}</span>` : markHtml(c, 'sm');
  const guideBtn = `<button class="f-gbtn" type="button" id="guideOpen" aria-haspopup="dialog">${BOOK}<span>공략</span></button>`;
  const rows = Flow.party!.map((p, i) => (p.cls
    ? memRowHtml({ ...p, cls: p.cls, bond: tutDone ? bondOf(G.save, p.nick) : undefined }, { attrs: `data-cls="${p.cls}" data-prow="${i}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on: sheet === 'mem' && openRow === i })
    : plainRow(p))).join('');
  s.el.innerHTML = `${flowHead(Flow.chal ? 's-entry' : 's-content', Flow.chal ? CHAL.name : c.name, sub, mark, guideBtn)}
    ${FEATURES.guild ? `<nav class="subtabs" role="tablist" aria-label="파티 모집"><button type="button" role="tab" data-mode="public" aria-selected="${!isGuild}">공개모집</button><button type="button" role="tab" data-mode="guild" aria-selected="${isGuild}"${guildReady() ? '' : ' disabled'}>길드파티${guildTab}</button></nav>` : ''}
    <div class="ns-body f-pty">
      ${c.key === 'rustfort' && firstDungeonNow() ? '<p class="coachtip">보스 기술은 「공략」에서 확인한 뒤 「출발」.</p>' : ''}
      ${tutDone ? recommendedLevel(Flow.chal ? stage : recLevel(c, Flow.diff)) : ''}
      ${boardHtml()}
      ${isGuild ? guildPickHtml(stage) : `<section class="pn f-mems"><ul class="pcards">${rows}</ul></section>`}
      ${msg && !sheet ? `<p class="note warn">${esc(msg)}</p>` : ''}
    </div>
    <footer class="ns-foot f-foot2">
      <div class="f-btns">
        <button class="f-go" type="button" id="depart"><span class="cta2"><span class="f-gt">출발</span></span>${ARROW}</button>
      </div>
    </footer>
    ${sheet === 'guide' ? guideSheetHtml() : sheet === 'mem' ? memSheetHtml(stage) : ''}`;
  msg = '';
  const body = s.el.querySelector<HTMLElement>('.ns-body');
  if (body) body.scrollTop = scroll;
  modal.sync(sheet ? s.el.querySelector<HTMLElement>('.sheet:not([hidden])') : null, sheet ? [`${sheet}:${sheet === 'mem' ? openRow : ''}`] : []);
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
  if (gp) { const r = togglePick(G.save, firstEnc(), Flow.gpick, Number(gp.dataset.gpick)); Flow.gpick = r.pick; gmsg = r.msg; if (!r.msg) recWhy = []; compose(); render(); gmsg = ''; return; }
  if (t.closest('#autoPick')) { const r = recommendPick(G.save, firstEnc(), contentOf(Flow.content).fights(Flow.diff), modeNow().stage); Flow.gpick = r.pick; recWhy = r.why; compose(); render(); return; }
  const pr = t.closest<HTMLElement>('[data-prow]');
  if (pr) { openRow = Number(pr.dataset.prow); openSheet('mem', `[data-prow="${openRow}"]`); return; }
  // 출발 = 바로 전투 (90 · 2026-10-17 Lim: 출전 전 휴식 팝업 없앰, 전투 전에는 휴식 표시 없음)
  if (t.closest('#depart')) depart();
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

/** 출발: 편성 「출발」 · 결과 화면 「다시 도전」 · 주간 도전 다음 단계 (같은 파티로 바로). 튜토리얼 탐험도 이걸 부름. 휴식은 클리어할 때 씀 (90) */
export function depart(): string {
  const c = contentOf(Flow.content);
  if (Flow.mode === 'guild' && guildReady()) { savePick(G.save, firstEnc(), Flow.gpick); commit(); } // 규모마다 지난 편성 (93 7-1)
  const coach = Flow.coach;
  Flow.coach = null;
  const m = modeNow();
  Flow.running = true;
  battle().start({
    content: c.key, name: Flow.chal ? `도전 ${Flow.chal}단계` : c.name, segs: c.fights(Flow.diff), diff: Flow.diff, level: healerLevel(), heroLv: G.save.player.level, stageLv: m.stage, gearStats: gearStatsOf(G.save.gear.equipped, G.save.player.level),
    affixes: m.affixes, bossMult: m.bossMult, limit: m.limit, chal: m.chal || undefined,
    guildFirst: FEATURES.guild && isGuildParty(Flow.party!) && (c.kind === 'dungeon' || c.kind === 'raid') && !G.save.guild.firsts.includes(`${c.key}|${Flow.diff}`),
    party: Flow.party!, seed: Flow.seed, coach, hero: heroNow(), talents: talentsNow(), specs: specsOf(G.save.gear.equipped, heroNow()),
    onEnd(r) {
      Flow.result = r;
      Flow.settle = settle(G.save, r, Math.random, Flow.party!);
      Flow.running = false;
      commit();
      go('s-settle');
    },
  });
  return '';
}
