/**
 * 길드 탭 (길드 v2 `93` · FM `97`, 사슬 4번). Lv 30 (GUILD_LEVEL)에 결성 이야기로 열림.
 * 2026-10-19 선택 시안 1: 현황은 구분선 목록, 영입은 모집 공고 지원자 비교 목록.
 * #233 공통 디자인 유지 (상점 · 편성과 같은 길드 홀 돌색, guild-hall.css): 위 = 하위 탭 (현황 · 길드원 · 영입) + 길드 홀 그림 머리 (이름 · Lv · 정원 · 명성).
 * 2026-10-19 Lim 「길드컨테츠 ui 디자인이 형편없다 … 필요한 정보만 텍스트」 → C안. 같은 날 추가 요청으로 기록과 스킬 뽑기 제거:
 *  현황 = 오늘의 부탁 · 주간 할 일을 바로 표시. 영입 = 모집 공고 하나 (전 직업 무작위). 명성 지원자는 2026-10-20 Lim 「길드원 모집은 새공고만 있게, 명성에따른 지원은 없다」로 없앰.
 *  길드원 = 판 하나 (편성과 같은 파티원 줄) → 아래 시트 (레벨 경험치 막대 · 능력치 · 후원 · 보내기).
 *  공통 부품: 판 (.g-card 머리 = 그림 · 제목 · 숫자), 줄 (.g-row), 숫자 칸 (.g-tiles), 알약 (.g-pill).
 *  도움말 ⓘ는 길드원 상세 하나뿐: 누르면 능력치 12칸 한 줄 설명 팝업 (2026-10-28 Lim 「길드에서 도움말 i 아이콘은 모두 제거. 단 길드원 상세 팝업에서의 도움말은 남겨주고 누르면 팝업으로 능력치별 설명을 간략하게」).
 * 육성 포인트 · 훈련 · 자질 · 전투력 숫자 · 인연 스카우트는 없앰 (97: 크는 길은 출전 경험뿐).
 */
import { resourceBalance } from '../game/resources';
import { locale, nickOf, t } from '../i18n';
import { CLASSES } from '../data/classes';
import { CONTENT } from '../data/content';
import { EXPED, hireGold, REQ, POST, SPONSOR, sponsorGold, type GuildMember } from '../data/guild';
import { GUILD_GOAL } from '../data/missions';
import { GUILD_LEVEL } from '../data/progression';
import { Flow } from '../game/flow';
import { claimExped } from '../game/economy';
import { realOpen } from '../game/guide';
import { expedReady, jobsDot, refreshExped, refreshReqs } from '../game/guildjobs';
import { abilityStars } from '../data/fm';
import { adRefreshPost, capOf, foundGuild, postAdWait, postNew, refreshPost, restSponsor, sponsor, sponsorRest, sponsorWhy, full, guildOpen, hire, release } from '../game/guild';
import { noticeModal, showRewarded } from '../platform/ads';
import { notify } from './toast';
import { commit, G, refreshDay } from '../game/state';
import { topLevel } from '../platform/storage';
import { gBar, memberCard, memberInfoHtml, memberSheetHead, memDetailHtml, memRowHtml, statHelpPopupHtml } from './members';
import { esc, fmt, go, goingBack, screen, topBar } from './kit';
import { currencyAmount, departureArrow, gameIcon, LOCK, uiIcon } from './art';
import { sheetDialog } from './dialog';
import { sfx } from '../sfx';
import { showReward } from './reward-pop';

type Sub = 'home' | 'members' | 'recruit';
const SUBS: [Sub, string][] = [['home', '현황'], ['members', '길드원'], ['recruit', '영입']];
/** 열린 시트: 길드원 · 공고 지원자 */
type Sheet = { k: 'mem'; id: number } | { k: 'cand'; i: number } | null;
type MemberAction = { kind: 'sponsor' | 'release'; id: number };
/** help = 길드원 상세 ⓘ → 능력치 설명 팝업 */
const st: { sub: Sub; sheet: Sheet; ask: MemberAction | null; help: boolean } = { sub: 'home', sheet: null, ask: null, help: false };
type MemberRole = 'tank' | 'melee' | 'ranged' | 'any';
type MemberSort = 'level' | 'ability' | 'name';
const MEMBER_SORTS: { key: MemberSort; label: string }[] = [
  { key: 'level', label: '레벨순' }, { key: 'ability', label: '능력순' }, { key: 'name', label: '이름순' },
];
const memberView: { role: MemberRole; sort: MemberSort } = { role: 'any', sort: 'level' };
let postReplace = false;

const s = screen('s-guild', '길드', { tab: 'guild', enter() { refreshDay(); if (G.save.guild.founded) { refreshReqs(G.save, realOpen, Math.random); refreshExped(G.save, realOpen); refreshPost(G.save, Math.random); commit(); } if (!goingBack()) { st.sub = 'home'; memberView.role = 'any'; } st.sheet = null; st.ask = null; st.help = false; postReplace = false; render(); } });
s.el.classList.add('g-hall');
// 「새로 뽑기」 쿨타임 글: 영입 탭이 보이는 동안 분 단위로 고치고, 다 되면 다시 그림
setInterval(() => {
  const b = s.el.querySelector<HTMLButtonElement>('[data-post="ad"]');
  if (!b?.disabled || !s.el.getClientRects().length) return;
  const w = postAdWait(G.save);
  if (w > 0) b.textContent = adWaitText(w); else if (!st.sheet && !postReplace) render();
}, 15_000);
const modal = sheetDialog(s.el, closeSheet);

/** 출전 문양 (길드 탭 깃발 그림이 없을 때), 오른쪽 화살표 */
const svg = (d: string, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const FLAG = svg('<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>');
const goldCost = (value: number) => currencyAmount('gold', value);
/** 길드 그림 (2026-10-18 Codex): 모집 공고 · 명성. 없으면 선 아이콘 */
const IC = {
  req: () => gameIcon('request', uiIcon('quest')),
  chest: () => gameIcon('expedition-chest', ''),
  post: () => gameIcon('guild-post', uiIcon('quest')),
  fame: () => gameIcon('guild-fame', uiIcon('star')),
  flag: () => gameIcon('guild', FLAG, 'tab'),
  // 2026-10-19 길드 화면 정리 (Codex): 길드원 · 할 일 · 후원 · 보내기
  members: () => gameIcon('guild-members', uiIcon('guild')),
  goal: () => gameIcon('guild-goal', uiIcon('star')),
  sponsor: () => gameIcon('guild-sponsor', uiIcon('hands')),
  release: () => gameIcon('guild-release', uiIcon('arrow')),
};
const ROLE_PICK: [MemberRole, string][] = [['tank', '탱커'], ['melee', '근접'], ['ranged', '원거리'], ['any', '아무나']];

const memberById = (id: number) => G.save.guild.members.find(m => m.id === id);
/** 줄 · 시트에 넘길 사람 (members.ts, 편성 길드파티와 같음) */
const card = memberCard;

/** 위: 하위 탭 (상점과 같은 .subtabs). 영입 = 지원자 빨간 점 */
function tabs(): string {
  const g = G.save.guild, cands = g.post?.cands.length || 0;
  const extra: Record<Sub, string> = {
    home: '',
    members: '',
    recruit: postNew(G.save) && cands ? `<i class="rdot" aria-label="${t('새 지원자 {n}명', { n: cands })}"></i>` : '',
  };
  return `<nav class="subtabs" role="tablist" aria-label="${t('길드 메뉴')}">${SUBS.map(([k, n]) => `<button type="button" role="tab" data-sub="${k}" aria-selected="${st.sub === k}">${t(n)}${extra[k]}</button>`).join('')}</nav>`;
}

/**
 * 길드 홀 그림 머리 (상점 선반 그림과 같은 .art-hero): 깃발 · 길드 Lv · 정원 / 명성 막대 (2026-10-19 Lim 「명성을 길드레벨의 경험치 개념으로 하여 ui도 경험치 바처럼」, 103):
 * 위 정보창 경험치 막대처럼 굵은 막대 하나, 안 글자 「명성 84 / 120」 (이 레벨에서 쌓인 것 / 필요량), Lv 30이면 가득 · MAX. 하위 탭 이름은 탭에만.
 * 길드 이름 (해바라기 원정대)은 없다 (2026-10-28 Lim 「길드명은 딱히 필요하지 않는것 같다」): 이름 자리에 길드 Lv, 아래 줄은 명성 막대만. 다시 넣지 않는다
 */
function hero(title: string, stats = true): string {
  const g = G.save.guild, cap = capOf(G.save);
  const pct = cap.need ? Math.min(100, (cap.have / cap.need) * 100) : 100, txt = cap.need ? t('명성 {a} / {b}', { a: fmt(cap.have), b: fmt(cap.need) }) : 'MAX';
  const bar = `<span class="gh-xp" role="img" aria-label="${t('길드 Lv {n}', { n: cap.lv })} · ${cap.need ? t('명성 {a} / {b}', { a: fmt(cap.have), b: fmt(cap.need) }) : t('최고 레벨')}"><i style="width:${pct.toFixed(1)}%"></i><small aria-hidden="true">${txt}</small></span>`;
  return `<header class="art-hero guild-hero${stats ? ' guild-identity' : ''}"><div class="ah-copy">${stats ? '' : `<p class="eyebrow">${t('길드 홀')}</p>`}<h2>${stats ? `${gameIcon('guild-flag', '')}<span>${t('길드 Lv')} <b>${cap.lv}</b></span>` : title}</h2></div>
    ${stats ? `<div class="gh-stats"><span class="gh-cap"><span>${t('정원')} </span><b>${g.members.length}/${cap.cap}</b></span><span class="gh-xprow">${bar}</span></div>` : ''}</header>`;
}

function render(): void {
  const active = document.activeElement instanceof HTMLElement && s.el.contains(document.activeElement) ? document.activeElement : null;
  const focusAttrs = active ? [...active.attributes].filter(a => a.name.startsWith('data-')) : [];
  const focusSelector = active?.id ? `#${CSS.escape(active.id)}` : focusAttrs.length ? active!.tagName.toLowerCase() + focusAttrs.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') : '';
  modal.beforeRender();
  const body = s.el.querySelector<HTMLElement>('.ns-body');
  const keep = body && body.dataset.view === st.sub ? body.scrollTop : 0;
  const open = guildOpen(G.save);
  if (!open.ok || !G.save.guild.founded) {
    st.sheet = null; st.ask = null; postReplace = false;
    s.el.innerHTML = `${topBar({ settings: true })}<div class="ns-body guild g-lock">${hero(t('길드'), false)}${open.ok ? foundHtml() : lockHtml(open.why)}</div>`;
    modal.sync(null, []);
    return;
  }
  const hasCta = st.sub === 'home';
  const seenPost = G.save.guild.post;
  if (st.sub === 'recruit' && seenPost && !seenPost.seen) { seenPost.seen = true; commit(); } // 그날 공고를 봄: 빨간 점 끔
  const view = st.sub === 'home' ? homeHtml() : st.sub === 'members' ? membersHtml() : recruitHtml();
  const sheet = sheetHtml();
  if (!sheet) { st.sheet = null; st.ask = null; }
  s.el.innerHTML = `${topBar({ settings: true })}${tabs()}
    <div class="ns-body guild g-${st.sub}${hasCta ? ' g-with-cta' : ''}">
      ${hero('')}
      ${open.dev ? `<p class="note g-dev">개발 빌드: 레벨 잠금 무시로 열림 (원래 Lv ${GUILD_LEVEL})</p>` : ''}
      ${view}
    </div>
    ${hasCta ? `<footer class="ns-foot g-foot">${ctaHtml()}</footer>` : ''}
    ${sheet}${memberConfirmHtml()}${statHelpHtml()}${postConfirmHtml()}`;
  const nb = s.el.querySelector<HTMLElement>('.ns-body');
  if (nb) { nb.dataset.view = st.sub; nb.scrollTop = keep; }
  modal.sync(postReplace ? s.el.querySelector<HTMLElement>('.g-post-confirm') : st.sheet ? s.el.querySelector<HTMLElement>(st.ask || st.help ? '.g-action-confirm' : '.g-msheet') : null,
    postReplace ? ['confirm:post'] : st.sheet ? [sheetKey(st.sheet), ...(st.ask ? [`confirm:${st.ask.kind}`] : st.help ? ['help:stats'] : [])] : []);
  if (!st.sheet && !postReplace && focusSelector && active?.closest('.ns-body, .subtabs')) s.el.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
}
const sheetKey = (x: NonNullable<Sheet>) => `${x.k}:${'id' in x ? x.id : 'nick' in x ? x.nick : x.i}`;

/** 잠김 (Lv 30 전 · 튜토리얼 중): 열리면 할 수 있는 것 셋 */
function lockHtml(why: string): string {
  const feat = (icon: string, name: string, line: string) => `<li class="g-row g-feat"><span class="g-ri">${icon}</span><div class="g-rm"><b>${name}</b><span class="g-sub wrap">${line}</span></div></li>`;
  return `<section class="g-card g-lockp"><header class="g-hd lockline"><span class="g-hi">${LOCK}</span><h3>${esc(/^Lv \d+에 열림$/.test(why) ? t('Lv {n}에 열림', { n: why.replace(/\D/g, '') }) : t(why))}</h3><span class="g-meta">${t('지금 Lv {n}', { n: topLevel(G.save) })}</span></header>
    <ul class="g-rows">
      ${feat(IC.post(), t('영입'), t('모집 공고'))}
      ${feat(IC.flag(), t('길드파티'), t('함께 출전할수록 레벨 · 능력치가 오름'))}
    </ul></section>`;
}

/** 결성 이야기 (93 4-1): 열렸는데 아직 결성 전 (결성은 보통 Lv 30 판 결과에서 저절로). 길드원 없이 결성, 영입은 모집 공고로 (Lim 10-21) */
function foundHtml(): string {
  return `<section class="panel g-story"><p class="g-story-line">${t('나만의 원정대를 꾸릴 때다.')}</p><p class="g-story-line">${t('공고를 내면 동료가 찾아온다.')}</p>
    <button class="btn primary" type="button" id="found">${t('원정대 만들기')}</button></section>`;
}

/** 길드원 줄: 레벨 · 스킬 LV · 능력 ★ (편성 줄과 같은 memRowHtml) */
function memberRow(m: GuildMember): string {
  const on = st.sheet?.k === 'mem' && st.sheet.id === m.id;
  return memRowHtml(card(m, true), { attrs: `data-mem="${m.id}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on, gold: m.boost ? `${IC.sponsor()}${m.boost}<span class="sr">${t('판 후원')}</span>` : '' });
}
const memberAbility = (m: GuildMember) => abilityStars(m.stats, CLASSES[m.cls].role as Exclude<MemberRole, 'any'>, m.lv);
const sortedMembers = () => G.save.guild.members
  .filter(m => memberView.role === 'any' || CLASSES[m.cls].role === memberView.role)
  .sort((a, b) => {
    if (memberView.sort === 'name') return nickOf(a.nick).localeCompare(nickOf(b.nick), locale()) || a.id - b.id;
    if (memberView.sort === 'ability') return memberAbility(b) - memberAbility(a) || b.lv - a.lv || a.id - b.id;
    return b.lv - a.lv || a.id - b.id;
  });

// ---------- 공통 부품 (2026-10-19 Lim 「길드컨텐츠 ui 디자인이 형편없다 … 필요한 정보만 텍스트표시 및 너무많은 텍스트를 정리」) ----------
// 판 = 카드 하나: 머리 (그림 · 제목 · 숫자) + 몸 (줄 · 숫자 칸 · 알약). 판 · 묶음의 ⓘ 설명은 없앰 (2026-10-28 Lim, 다시 넣지 않는다)
interface Sec { key: string; icon: string; title: string; meta?: string; body: string; sum?: string; dot?: boolean; flat?: boolean }
function secHtml(x: Sec): string {
  return `<section class="g-card${x.flat ? ' g-flat' : ''}" data-sec="${x.key}" id="guild-panel-${x.key}">${x.flat ? '' : `<header class="g-hd"><span class="g-hi">${x.icon}</span><h3>${x.title}</h3>${x.meta ? `<span class="g-meta">${x.meta}</span>` : ''}</header>`}${x.body}</section>`;
}
/** 보상 · 상태 알약: 그림 + 짧은 글 (그림 뜻은 읽어 주는 글로) */
const pill = (ic: string, t: string, cls = '', sr = '') => `<span class="g-pill${cls ? ` ${cls}` : ''}">${ic}${sr ? `<span class="sr">${sr} </span>` : ''}${t}</span>`;
const famePill = (n: number) => pill(IC.fame(), `+${n}`, 'fame', t('명성'));
const okPill = (t: string) => pill('', `✓ ${t}`, 'ok');
const bar = gBar;
const placeName = (k: string) => esc(t(CONTENT.find(c => c.key === k)?.name ?? k));

// ---------- 현황 ----------
function homeHtml(): string {
  const g = G.save.guild;
  // 결성 카드 (한 번): 길드원 없이 결성, 첫 동료는 모집 공고로 (Lim 10-21 「자동 영입 제거」)
  const story = g.storySeen ? '' : `<section class="panel g-story"><p class="g-story-line">${t('원정대 깃발을 세웠다.')}</p><p class="g-story-line">${t('공고를 내면 동료가 찾아온다.')}</p>
      <p class="g-story-name"><b>${t('길드 결성')}</b></p><button class="btn2" type="button" id="storyOk">${t('모집 공고 보기')}</button></section>`;
  return `${story}${secHtml(todoSec())}`;
}

/** 할 일: 주간 목표 · 주간 원정 · 부탁 쪽지 (93 8장). 한 줄에 그림 · 이름 · 숫자 · 보상 알약 */
function todoSec(): Sec {
  const g = G.save.guild, w = G.save.weekly.guild, need = GUILD_GOAL.need, n = Math.min(w.n, need);
  const goal = `<li class="g-row g-goal"><span class="g-ri">${IC.fame()}</span><div class="g-rm"><b>${t('주간 목표')}</b><span class="g-sub">${t('길드파티 클리어')}</span>${bar((n / need) * 100, t('길드파티 클리어 {a} / {b}', { a: n, b: need }))}</div>
    <span class="g-rs"><b class="g-num">${n}<small> / ${need}</small></b>${w.got ? okPill(t('받음')) : w.n >= need ? `<button class="btn mini primary" type="button" id="goalGo">${t('보상 확인')}</button>` : famePill(GUILD_GOAL.fame)}</span></li>`;
  const ex = g.exped.list, xd = ex.filter(x => x.done).length;
  const places = ex.map(x => {
    const c = CONTENT.find(c => c.key === x.content);
    const action = x.done ? `<span class="g-place g-place-complete" aria-label="${t('{p} 완료', { p: placeName(x.content) })}">${okPill(t('완료'))}</span>`
      : `<button type="button" class="btn mini primary g-place" data-goto="${esc(x.content)}" data-gdiff="보통" aria-label="${t('{p} 보통 입장', { p: placeName(x.content) })}">${t('입장')}</button>`;
    return `<li class="g-exrow${x.done ? ' done' : ''}"><div class="g-place-copy"><b>${placeName(x.content)}</b><span>${c ? `${t('{n}인', { n: c.size('보통') })} · ` : ''}${t('보통 이상')}</span></div>${action}</li>`;
  }).join('');
  const few = !g.members.length; // 원정 = 길드파티 (길드원만, 2026-10-28 Lim): 길드원 1명부터
  const exped = ex.length ? `<li class="g-row g-exped"><span class="g-ri">${IC.chest()}</span><div class="g-rm"><b>${t('주간 원정')}</b><span class="g-sub">${few ? t('길드원 영입 뒤 도전') : t('{n}곳 클리어', { n: ex.length })}</span>${bar((xd / ex.length) * 100, t('주간 원정 {a} / {b}', { a: xd, b: ex.length }))}</div>
    <span class="g-rs"><b class="g-num">${xd}<small> / ${ex.length}</small></b>${expedReady(G.save) ? `<button class="btn mini primary" type="button" id="expedChest">${t('상자 받기')}</button>` : g.exped.got ? okPill(t('받음')) : famePill(EXPED.fame)}</span></li>
    <li class="g-exped-places" id="guild-exped-places"><ul class="g-places" aria-label="${t('주간 원정 장소')}">${places}</ul></li>` : '';
  const reqs = g.reqs.list.map(q => `<li class="g-row g-job${q.done ? ' done' : ''}"><span class="g-ri">${IC.req()}</span><div class="g-rm"><div class="g-job-title"><b>${esc(nickOf(q.nick))}</b>${q.done ? '' : `<span class="g-rewards">${pill('', t('경험치 ×{n}', { n: REQ.xpMult }), 'xp', esc(nickOf(q.nick)))}</span>`}</div><span class="g-sub wrap">${placeName(q.content)} · ${t('{d} 이상', { d: esc(t(q.diff)) })}</span></div>
    <span class="g-rs">${q.done ? `<span class="g-rewards">${okPill(t('완료'))}</span>` : `<button class="btn mini primary" type="button" data-goto="${esc(q.content)}" data-gdiff="${esc(q.diff)}" data-gneed="${esc(q.nick)}" aria-label="${t('{n} 부탁 · {p} 장소 보기', { n: esc(nickOf(q.nick)), p: placeName(q.content) })}">${t('장소 보기')}</button>`}</span></li>`).join('');
  const left = (w.got ? 0 : 1) + (ex.length && !g.exped.got ? 1 : 0) + g.reqs.list.filter(q => !q.done).length;
  return {
    key: 'todo', flat: true, icon: IC.goal(), title: t('할 일'), meta: left ? t('{n}개 남음', { n: left }) : t('완료'), sum: w.n >= need && !w.got || expedReady(G.save) ? t('보상 받기') : left ? t('{n}개 남음', { n: left }) : t('완료'), dot: jobsDot(G.save) || (w.n >= need && !w.got), body: `<h3 class="g-job-group">${t('오늘의 부탁')}<span class="g-group-meta"><small>${t('{a}/{b} 완료', { a: g.reqs.list.filter(q => q.done).length, b: g.reqs.list.length })}</small></span></h3><ul class="g-rows">${reqs || `<li class="g-empty0">${g.members.length ? t('새 부탁 없음') : t('길드원 영입 뒤 부탁 도착')}</li>`}</ul><h3 class="g-job-group">${t('이번 주')}</h3><ul class="g-rows">${goal}${exped}</ul>`,
  };
}

/** 길드원: 역할 필터와 레벨 → 능력 → 이름 순환 정렬. 저장된 편성은 바꾸지 않는다. */
function membersSec(): Sec {
  const n = G.save.guild.members.length, rows = sortedMembers();
  const sortIndex = MEMBER_SORTS.findIndex(x => x.key === memberView.sort);
  const sort = MEMBER_SORTS[sortIndex], nextSort = MEMBER_SORTS[(sortIndex + 1) % MEMBER_SORTS.length];
  const sortButton = `<button type="button" class="btn2 g-sort" id="guildMemberSort" aria-label="${t('{a} · 누르면 {b}', { a: t(sort.label), b: t(nextSort.label) })}" title="${t('레벨순 → 능력순 → 이름순')}">${svg('<path d="M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4"/>')}<span>${t(sort.label)}</span></button>`;
  const rs = restSponsor(G.save), gold = resourceBalance(G.save, 'gold');
  const filters = `<div class="g-member-tools"><div class="g-chips" role="group" aria-label="${t('길드원 역할')}">${[['any', '전체'], ...ROLE_PICK.filter(([k]) => k !== 'any')].map(([k, nm]) => `<button type="button" class="g-chip" data-mrole="${k}" aria-pressed="${memberView.role === k}">${t(nm)} <small>${G.save.guild.members.filter(m => k === 'any' || CLASSES[m.cls].role === k).length}</small></button>`).join('')}</div></div>`;
  const sp = rs.ids.length ? `<div class="g-act"><span class="g-ri sm">${IC.sponsor()}</span><span class="g-actt">${t('쉬는 길드원 <b>{n}</b>명', { n: rs.ids.length })}</span>
      <button class="btn mini g-rest" type="button" id="sponsorRest"${gold < rs.gold ? ' disabled' : ''}>${t('모두 후원 {g}', { g: goldCost(rs.gold) })}</button></div>` : '';
  return {
    key: 'mem', icon: IC.members(), title: t('길드원'), meta: sortButton, sum: `${n} / ${capOf(G.save).cap}`,
    body: `${filters}${sp}<ul class="pcards g-list">${rows.map(memberRow).join('') || `<li class="g-empty0">${n ? t('이 역할의 길드원 없음') : t('영입 탭에서 첫 동료 모집')}</li>`}</ul>`,
  };
}

/** 아래 붉은 주 버튼 (전투 탭 「출전」과 같은 결). 길드원이 없으면 영입으로 (자동 영입 없음, Lim 10-21) */
function ctaHtml(): string {
  const none = !G.save.guild.members.length;
  return `<button type="button" class="g-cta" id="${none ? 'guildRecruit' : 'guildGo'}"><span class="g-mk" aria-hidden="true"><span>${none ? IC.post() : IC.flag()}</span></span><span class="g-ct"><b>${none ? t('모집 공고로 영입') : t('길드파티로 출전')}</b></span>${departureArrow()}</button>`;
}

// ---------- 길드원 ----------
function membersHtml(): string {
  return secHtml(membersSec());
}

// ---------- 영입 ----------
/** 광고로 새로 뽑기까지 남은 시간 글 (1시간 쿨타임, 분 단위 올림) */
const adWaitText = (ms: number) => t('{n}분 뒤', { n: Math.max(1, Math.ceil(ms / 60000)) });
/**
 * 모집 공고: 무료, 매일 오전 6시 새 지원자 3명 (Lv 1 ~ 내 레벨), 「새로 뽑기」 = 보상형 광고 한 번 → 5명, 1시간에 한 번.
 * 지원자 줄 = 영입 골드 (hireGold = 레벨 × 능력 배율, 2026-10-28 Lim). 희귀 · 스킬 등급 표시는 없음
 */
function recruitHtml(): string {
  const g = G.save.guild, cap = capOf(G.save), isFull = full(G.save), my = topLevel(G.save);
  const candRow = (c: GuildMember, i: number) => memRowHtml(card(c), {
    attrs: `data-cand="${i}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on: st.sheet?.k === 'cand' && st.sheet.i === i,
    gold: `${goldCost(hireGold(c))}<span class="sr">${t('영입 골드')}</span>`,
  });
  const post = g.post, cands = post?.cands ?? [], room = Math.max(0, cap.cap - g.members.length), roomTxt = room ? t('남은 자리 {n}명', { n: room }) : t('정원 가득'); // 105 QA: 「모두 영입 가능」이 정원과 안 맞았음
  const list = cands.length ? `<ul class="pcards g-list g-candidates">${cands.map((c, i) => candRow(c, i)).join('')}</ul>` : `<p class="g-empty0">${t('내일 새 지원자 {n}명', { n: POST.cands })}<small>${t('오전 6시 · {r}', { r: roomTxt })}</small></p>`;
  const wait = postAdWait(G.save);
  const postSec: Sec = {
    key: 'post', flat: true, icon: IC.post(), title: t(POST.name), dot: postNew(G.save),
    body: `<div class="g-post-offer"><div class="g-post-copy"><div class="g-offer-title"><h3>${t('지원자 {n}명', { n: cands.length })}<small> · ${roomTxt}</small></h3></div><p class="g-post-summary">${t('매일 새 {n}명 · Lv 1~{lv}', { n: POST.cands, lv: my })}</p></div>
      <div class="g-post-action"><button class="btn mini primary" type="button" data-post="ad" aria-describedby="guild-post-ad"${cands.length ? ' aria-haspopup="dialog"' : ''}${wait ? ' disabled' : ''}>${wait ? adWaitText(wait) : t('새로 뽑기')}</button><small id="guild-post-ad">${wait ? t('다시 뽑기까지') : t('광고 보고 {n}명', { n: POST.adCands })}</small></div></div>
      ${list}`,
  };

  return `${isFull ? `<p class="warnbox g-full">${t('정원 {a} / {b} 가득', { a: g.members.length, b: cap.cap })}<small>${t('길드 레벨을 올리면 정원이 늘어납니다.')}</small></p>` : ''}${secHtml(postSec)}`;
}

// ---------- 아래 시트 (편성 화면 파티원 시트와 같은 모양) ----------
function sheetBox(label: string, inner: string, footer = `<button class="btn2 f-shut" type="button" data-shut>${t('닫기')}</button>`): string {
  return `<div class="sheet-dim" data-shut></div><section class="sheet g-msheet" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><span class="grip"></span>
    ${inner}${footer}</section>`;
}
const sheetHead = memberSheetHead;

function sheetHtml(): string {
  const x = st.sheet;
  if (!x) return '';
  const g = G.save.guild, isFull = full(G.save);
  if (x.k === 'cand') {
    const c = g.post?.cands[x.i];
    if (!c) return '';
    const d = card(c), cost = hireGold(c), gold = resourceBalance(G.save, 'gold'), short = gold < cost;
    const limit = isFull ? t('정원 가득') : short ? t('골드 {n} 부족', { n: fmt(cost - gold) }) : '';
    return sheetBox(t('{n} 상세', { n: nickOf(c.nick) }), `${sheetHead(d)}${memDetailHtml(d)}`,
      `<footer class="g-hire-footer">${limit ? `<p class="g-hire-limit">${limit}</p>` : ''}<div class="g-hire-actions"><button class="btn2" type="button" data-shut>${t('닫기')}</button><button class="btn mini primary g-hire-btn" type="button" data-hire="${x.i}"${isFull || short ? ' disabled' : ''}>${t('영입')}<small>${goldCost(cost)}</small></button></div></footer>`);
  }
  const m = memberById(x.id);
  if (!m) return '';
  return sheetBox(t('{n} 상세', { n: nickOf(m.nick) }), detailHtml(m));
}

/** 길드원 상세 (시트 안): 머리 ⓘ · 레벨 경험치 막대 · 능력치 · 직업 스킬 · 성격 (members.ts, 편성 길드파티와 같음) → 골드 지원 · 내보내기 */
function detailHtml(m: GuildMember): string {
  const gold = resourceBalance(G.save, 'gold');
  const sw = sponsorWhy(G.save, m), sg = sponsorGold(m.lv);
  const act = (attr: string, ic: string, label: string, sub: string, dis: boolean) => `<button class="btn" type="button" ${attr}${dis ? ' disabled' : ''}><span class="g-ai">${ic}</span><b>${label}</b><small>${sub}</small></button>`;
  return `${memberInfoHtml(m)}
    <div class="g-acts">
      ${act('data-sponsor aria-haspopup="dialog"', IC.sponsor(), m.boost > 0 ? t('지원 중') : t('골드 지원'), m.boost > 0 ? t('{n}판 남음', { n: m.boost }) : sw || goldCost(sg), !!sw || gold < sg)}
      ${act('data-release aria-haspopup="dialog"', IC.release(), t('내보내기'), t('길드에서 제외'), false)}
    </div>`;
}

/** 상세 위의 확인창: 확인하기 전에는 골드와 길드원 상태를 바꾸지 않는다. */
function memberConfirmHtml(): string {
  const action = st.ask, m = action && memberById(action.id);
  if (!action || !m || st.sheet?.k !== 'mem' || st.sheet.id !== m.id) { st.ask = null; return ''; }
  const support = action.kind === 'sponsor';
  const disabled = support ? !!sponsorWhy(G.save, m) || resourceBalance(G.save, 'gold') < sponsorGold(m.lv) : false;
  return `<button type="button" class="sheet-dim g-action-dim" data-shut aria-label="${t('확인 취소')}" tabindex="-1"></button>
    <section class="sheet g-action-confirm" role="dialog" aria-modal="true" aria-labelledby="guildConfirmTitle" aria-describedby="guildConfirmDesc">
      <h3 id="guildConfirmTitle">${support ? t('골드 지원') : t('내보내기')}</h3>
      <div class="g-action-member"><b>${esc(nickOf(m.nick))}</b><span>${t(CLASSES[m.cls].name)} · Lv ${m.lv}</span></div>
      <p id="guildConfirmDesc">${support ? t('전투에 참여하지 않아도 출전과 같은 경험치를 받습니다. 후원하시겠습니까?') : t('길드에서 내보냅니다.')}</p>
      ${support ? `<div class="g-action-cost"><span>${t('{n}판 지원', { n: SPONSOR.runs })}</span>${goldCost(sponsorGold(m.lv))}</div>` : ''}
      <div class="g-action-buttons"><button type="button" data-shut>${t('취소')}</button><button type="button" class="${support ? 'primary' : 'danger'}" data-gconfirm${disabled ? ' disabled' : ''}>${t('확인')}</button></div>
    </section>`;
}

/** 길드원 상세 ⓘ → 능력치 12칸 한 줄 설명 (members.ts, 편성 길드파티와 같음) */
function statHelpHtml(): string {
  if (!st.help || st.sheet?.k !== 'mem' || st.ask) { st.help = false; return ''; }
  return statHelpPopupHtml();
}

/** 새로 뽑기도 공통 확인 팝업 (지원자가 남아 있을 때만): 확인 전에는 기존 지원자를 유지한다. 확인 → 보상형 광고 → 5명 */
function postConfirmHtml(): string {
  const post = G.save.guild.post;
  if (!postReplace || !post?.cands.length) { postReplace = false; return ''; }
  const disabled = postAdWait(G.save) > 0;
  return `<button type="button" class="sheet-dim g-action-dim" data-shut aria-label="${t('새로 뽑기 취소')}" tabindex="-1"></button>
    <section class="sheet g-action-confirm g-post-confirm" role="dialog" aria-modal="true" aria-labelledby="guildPostTitle" aria-describedby="guildPostDesc">
      <h3 id="guildPostTitle">${t('새로 뽑기')}</h3>
      <p id="guildPostDesc">${t('현재 지원자 {a}명이 돌아갑니다.<br>새 지원자 {b}명을 받으시겠습니까?', { a: post.cands.length, b: POST.adCands })}</p>
      <div class="g-action-cost"><span>${t('보상형 광고 1회')}</span><b>${t('{n}명', { n: POST.adCands })}</b></div>
      <div class="g-action-buttons"><button type="button" id="cancelPost" data-shut>${t('취소')}</button><button type="button" class="primary" data-confirm-post="ad"${disabled ? ' disabled' : ''}>${t('확인')}</button></div>
    </section>`;
}
/** 보상형 광고 → 지원자 5명. 광고를 끝까지 안 보면 그대로 */
async function adRefresh(): Promise<void> {
  const ok = await showRewarded(t('새 지원자 {n}명', { n: POST.adCands }));
  const err = ok ? adRefreshPost(G.save, Math.random) : '';
  if (ok) {
    sfx(err ? 'deny' : 'guild-recruit');
    commit(); // 새 지원자는 목록에 바로 보임 (「새 지원자 N명 도착」 줄은 2026-10-28 Lim 「제거」)
  }
  render();
  if (err) void noticeModal(t('새로 뽑기'), esc(err));
}

function confirmMemberAction(): void {
  const action = st.ask;
  let err = '', done = '';
  st.ask = null;
  if (!action || st.sheet?.k !== 'mem' || st.sheet.id !== action.id) return;
  const m = memberById(action.id);
  if (m) {
    if (action.kind === 'sponsor') { err = sponsor(G.save, m.id); sfx(err ? 'deny' : 'gold-spend'); done = err ? '' : t('골드 지원 · {n}판 남음', { n: m.boost }); }
    else if (release(G.save, m.id)) {
      sfx('guild-release');
      st.sheet = null;
      done = t('{n}({c}) 길드에서 내보냈습니다.', { n: nickOf(m.nick), c: t(CLASSES[m.cls].name) });
    }
    commit();
  }
  render();
  if (err) void noticeModal(t('골드 지원'), esc(err)); else notify(done);
}

function openSheet(x: NonNullable<Sheet>, from: string): void {
  s.el.querySelector<HTMLElement>(from)?.focus({ preventScroll: true });
  st.sheet = x; st.ask = null; st.help = false; render();
}
function closeSheet(): void {
  if (postReplace) postReplace = false;
  else if (st.ask) st.ask = null;
  else if (st.help) st.help = false;
  else st.sheet = null;
  render();
}

s.el.addEventListener('click', e => {
  const el = e.target as HTMLElement;
  const save = G.save;
  if (el.closest('[data-shut]')) { closeSheet(); return; }
  const confirm = el.closest<HTMLButtonElement>('[data-gconfirm]');
  if (confirm) { if (!confirm.disabled) confirmMemberAction(); return; }
  const confirmPost = el.closest<HTMLButtonElement>('[data-confirm-post]');
  if (confirmPost) {
    if (postReplace && !confirmPost.disabled) {
      postReplace = false;
      render(); void adRefresh();
    }
    return;
  }
  if (st.ask || st.help || postReplace) return;
  const dest = el.closest<HTMLButtonElement>('[data-goto]');
  if (dest) {
    const c = CONTENT.find(c => c.key === dest.dataset.goto);
    const diff = dest.dataset.gdiff;
    if (c && (diff === '쉬움' || diff === '보통' || diff === '어려움' || diff === '악몽')) { Flow.preferGuild = true; Flow.needNick = dest.dataset.gneed; go('s-content', { content: c.key, diff }); }
    return;
  }
  const mr = el.closest<HTMLButtonElement>('[data-mrole]');
  if (mr) { memberView.role = mr.dataset.mrole as MemberRole; render(); return; }
  if (el.closest('#guildMemberSort')) {
    const i = MEMBER_SORTS.findIndex(x => x.key === memberView.sort);
    memberView.sort = MEMBER_SORTS[(i + 1) % MEMBER_SORTS.length].key;
    render(); return;
  }
  if (el.closest('#goalGo')) { go('s-missions'); return; }
  if (el.closest('#found')) { const ok = foundGuild(save, Math.random); sfx(ok ? 'guild-levelup' : 'deny'); if (ok) { refreshReqs(save, realOpen, Math.random); refreshExped(save, realOpen); } commit(); render(); return; } // 할 일도 탭에 들어올 때처럼
  if (el.closest('#sponsorRest')) { const n = restSponsor(save).ids.length, err = sponsorRest(save); sfx(err ? 'deny' : 'gold-spend'); commit(); render(); if (err) void noticeModal(t('후원'), esc(err)); else notify(t('쉬는 길드원 {n}명 후원 · 한 사람 {r}판', { n, r: SPONSOR.runs })); return; }
  if (el.closest('#storyOk')) { save.guild.storySeen = true; commit(); st.sub = 'recruit'; render(); s.el.querySelector<HTMLElement>('.ns-body')?.scrollTo({ top: 0 }); return; }
  if (el.closest('#guildRecruit')) { st.sub = 'recruit'; render(); s.el.querySelector<HTMLElement>('.ns-body')?.scrollTo({ top: 0 }); return; }
  // 「길드파티로 출전」: 전투 탭(모험 고르기) → 편성이 길드파티로 시작 (game/flow.ts)
  if (el.closest('#guildGo') && save.guild.members.length) { Flow.preferGuild = true; go('s-content'); return; }
  if (el.closest('#expedChest')) { // 받은 뒤 지난 주 목록이면 바로 새 주 원정 (105 QA 3), 받은 것은 보상 창 (reward-pop, 2026-10-24 Lim 시안 A)
    const r = claimExped(save, Math.random); sfx(typeof r === 'string' ? 'deny' : 'chest-open'); if (typeof r !== 'string') refreshExped(save, realOpen);
    commit(); render();
    if (typeof r === 'string') void noticeModal(t('원정 상자'), esc(r)); else showReward({ title: t('원정 상자'), gold: r.gold, items: r.items });
    return;
  }
  const post = el.closest<HTMLButtonElement>('[data-post]');
  if (post) {
    if (!post.disabled) {
      if (save.guild.post?.cands.length) { postReplace = true; render(); return; }
      void adRefresh();
    }
    return;
  }
  const h = el.closest<HTMLButtonElement>('[data-hire]');
  if (h) { if (!h.disabled) { const err = hire(save, Number(h.dataset.hire)); sfx(err ? 'deny' : 'guild-recruit'); st.sheet = null; commit(); render(); if (err) void noticeModal(t('영입'), esc(err)); else notify(t('영입 완료 · 「길드원」에서 확인')); } return; }
  const x = st.sheet;
  if (x?.k === 'mem' && el.closest('.g-msheet')) {
    if (el.closest('[data-stathelp]')) { st.help = true; render(); return; } // 길드원 상세 ⓘ = 능력치 설명 팝업
    const button = el.closest<HTMLButtonElement>('[data-sponsor], [data-release]');
    if (button && !button.disabled) { st.ask = { kind: button.hasAttribute('data-sponsor') ? 'sponsor' : 'release', id: x.id }; render(); }
    return;
  }
  const sub = el.closest<HTMLElement>('[data-sub]');
  if (sub) { st.sub = sub.dataset.sub as Sub; st.sheet = null; st.ask = null; st.help = false; postReplace = false; render(); s.el.querySelector<HTMLElement>('.ns-body')?.scrollTo({ top: 0 }); return; }
  const mem = el.closest<HTMLElement>('[data-mem]');
  if (mem) { openSheet({ k: 'mem', id: Number(mem.dataset.mem) }, `[data-mem="${mem.dataset.mem}"]`); return; }
  const cand = el.closest<HTMLElement>('[data-cand]');
  if (cand) openSheet({ k: 'cand', i: Number(cand.dataset.cand) }, `[data-cand="${cand.dataset.cand}"]`);
});

// 누를 수 있는 줄 (role="button")은 Enter·Space로도, Esc = 시트 닫기
s.el.addEventListener('keydown', e => {
  const el = e.target as HTMLElement;
  if (e.key === 'Escape' && (st.sheet || postReplace)) { e.preventDefault(); closeSheet(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && el.matches('[role="button"]:not(button)')) { e.preventDefault(); el.click(); }
});
