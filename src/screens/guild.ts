/**
 * 길드 탭 (길드 v2 `93` · FM `97`, 사슬 4번). Lv 15에 결성 이야기로 열림.
 * 2026-10-19 선택 시안 1: 현황은 구분선 목록, 영입은 모집 공고 지원자 비교 목록.
 * #233 공통 디자인 유지 (상점 · 편성과 같은 길드 홀 돌색, guild-hall.css): 위 = 하위 탭 (현황 · 길드원 · 영입) + 길드 홀 그림 머리 (이름 · Lv · 정원 · 명성).
 * 2026-10-19 Lim 「길드컨테츠 ui 디자인이 형편없다 … 필요한 정보만 텍스트」 → C안. 같은 날 추가 요청으로 기록과 스킬 뽑기 제거:
 *  현황 = 오늘의 부탁 · 주간 할 일을 바로 표시. 영입 = 모집 공고 하나 (전 직업 무작위). 명성 지원자는 2026-10-20 Lim 「길드원 모집은 새공고만 있게, 명성에따른 지원은 없다」로 없앰.
 *  길드원 = 판 하나 (편성과 같은 파티원 줄) → 아래 시트 (레벨 경험치 막대 · 능력치 · 후원 · 보내기).
 *  공통 부품: 판 (.g-card 머리 = 그림 · 제목 · 숫자 · ⓘ), 줄 (.g-row), 숫자 칸 (.g-tiles), 알약 (.g-pill). 규칙 · 긴 설명은 ⓘ를 눌러야 보임.
 * 육성 포인트 · 훈련 · 자질 · 전투력 숫자 · 인연 스카우트는 없앰 (97: 크는 길은 출전 경험뿐).
 */
import { resourceBalance } from '../game/resources';
import { ABILITIES, STAR5, starFx } from '../data/abilities';
import { CLASSES } from '../data/classes';
import { CONTENT } from '../data/content';
import { EXPED, hireGold, REQ, POST, SPONSOR, sponsorGold, memberSkillLevel, statPerLevel, LV_DOUBLE, type GuildMember } from '../data/guild';
import { GUILD_GOAL } from '../data/missions';
import { GUILD_LEVEL, xpToNext } from '../data/progression';
import { Flow } from '../game/flow';
import { claimExped } from '../game/economy';
import { guideCtx, rankStages, realOpen } from '../game/guide';
import { expedReady, jobsDot, refreshExped, refreshReqs } from '../game/guildjobs';
import { abilityStars, STAT_NAMES } from '../data/fm';
import { adRefreshPost, capOf, foundGuild, postAdWait, postNew, refreshPost, restSponsor, sponsor, sponsorRest, sponsorWhy, full, guildOpen, hire, release } from '../game/guild';
import { adsFree } from '../game/stamina';
import { showRewarded } from '../platform/ads';
import { commit, G, refreshDay } from '../game/state';
import { topLevel } from '../platform/storage';
import { memDetailHtml, memRowHtml, type CardData } from './members';
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
/** tip = 펼친 설명 */
const st: { sub: Sub; sheet: Sheet; msg: string; ask: MemberAction | null; tip: string | null } = { sub: 'home', sheet: null, msg: '', ask: null, tip: null };
type MemberRole = 'tank' | 'melee' | 'ranged' | 'any';
type MemberSort = 'level' | 'ability' | 'name';
const MEMBER_SORTS: { key: MemberSort; label: string }[] = [
  { key: 'level', label: '레벨순' }, { key: 'ability', label: '능력순' }, { key: 'name', label: '이름순' },
];
const memberView: { role: MemberRole; sort: MemberSort } = { role: 'any', sort: 'level' };
let postReplace = false;

const s = screen('s-guild', '길드', { tab: 'guild', enter() { refreshDay(); if (G.save.guild.founded) { refreshReqs(G.save, rankStages(guideCtx()), Math.random); refreshExped(G.save, realOpen); refreshPost(G.save, Math.random); commit(); } if (!goingBack()) { st.sub = 'home'; memberView.role = 'any'; } st.sheet = null; st.msg = ''; st.ask = null; st.tip = null; postReplace = false; render(); } });
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
/** 줄 · 시트에 넘길 사람 */
const card = (m: Pick<GuildMember, 'nick' | 'cls' | 'pers' | 'ab' | 'lv' | 'stats' | 'lastStatGains' | 'skillFloor'>, member = false): CardData => ({ nick: m.nick, cls: m.cls, pers: m.pers, ab: m.ab, lv: m.lv, star: memberSkillLevel(m), fm: { stats: m.stats }, grown: true, lastStatGains: member ? m.lastStatGains : undefined, member });

/** 위: 하위 탭 (상점과 같은 .subtabs). 영입 = 지원자 빨간 점 */
function tabs(): string {
  const g = G.save.guild, cands = g.post?.cands.length || 0;
  const extra: Record<Sub, string> = {
    home: '',
    members: '',
    recruit: postNew(G.save) && cands ? `<i class="rdot" aria-label="새 지원자 ${cands}명"></i>` : '',
  };
  return `<nav class="subtabs" role="tablist" aria-label="길드 메뉴">${SUBS.map(([k, n]) => `<button type="button" role="tab" data-sub="${k}" aria-selected="${st.sub === k}">${n}${extra[k]}</button>`).join('')}</nav>`;
}

/**
 * 길드 홀 그림 머리 (상점 선반 그림과 같은 .art-hero): 길드 이름 · 정원 / 길드 Lv + 명성 막대 (2026-10-19 Lim 「명성을 길드레벨의 경험치 개념으로 하여 ui도 경험치 바처럼」, 103):
 * 위 정보창 경험치 막대처럼 굵은 막대 하나, 안 글자 「명성 84 / 120」 (이 레벨에서 쌓인 것 / 필요량), Lv 30이면 가득 · MAX. 하위 탭 이름은 탭에만
 */
function hero(title: string, stats = true): string {
  const g = G.save.guild, cap = capOf(G.save);
  const pct = cap.need ? Math.min(100, (cap.have / cap.need) * 100) : 100, txt = cap.need ? `명성 ${fmt(cap.have)} / ${fmt(cap.need)}` : 'MAX';
  const bar = `<span class="gh-xp" role="img" aria-label="길드 Lv ${cap.lv} · ${cap.need ? `명성 ${fmt(cap.have)} / ${fmt(cap.need)}` : '최고 레벨'}"><i style="width:${pct.toFixed(1)}%"></i><small aria-hidden="true">${txt}</small></span>`;
  return `<header class="art-hero guild-hero${stats ? ' guild-identity' : ''}"><div class="ah-copy">${stats ? '' : '<p class="eyebrow">길드 홀</p>'}<h2>${stats ? esc(g.name) : title}</h2></div>
    ${stats ? `<div class="gh-stats"><span class="gh-cap"><span>정원 </span><b>${g.members.length}/${cap.cap}</b></span><span class="gh-xprow"><span class="gh-lv">${gameIcon('guild-flag', '')}<span>길드 Lv <b>${cap.lv}</b></span></span>${bar}</span></div>` : ''}</header>`;
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
    s.el.innerHTML = `${topBar({ settings: true })}<div class="ns-body guild g-lock">${hero('길드', false)}${open.ok ? foundHtml() : lockHtml(open.why)}</div>`;
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
      ${st.msg && !sheet ? `<p class="warnbox" role="status">${esc(st.msg)}</p>` : ''}
      ${view}
    </div>
    ${hasCta ? `<footer class="ns-foot g-foot">${ctaHtml()}</footer>` : ''}
    ${sheet}${memberConfirmHtml()}${postConfirmHtml()}`;
  const nb = s.el.querySelector<HTMLElement>('.ns-body');
  if (nb) { nb.dataset.view = st.sub; nb.scrollTop = keep; }
  modal.sync(postReplace ? s.el.querySelector<HTMLElement>('.g-post-confirm') : st.sheet ? s.el.querySelector<HTMLElement>(st.ask ? '.g-action-confirm' : '.g-msheet') : null,
    postReplace ? ['confirm:post'] : st.sheet ? [sheetKey(st.sheet), ...(st.ask ? [`confirm:${st.ask.kind}`] : [])] : []);
  if (!st.sheet && !postReplace && focusSelector && active?.closest('.ns-body, .subtabs')) s.el.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
  st.msg = '';
}
const sheetKey = (x: NonNullable<Sheet>) => `${x.k}:${'id' in x ? x.id : 'nick' in x ? x.nick : x.i}`;

/** 잠김 (Lv 15 전 · 튜토리얼 중): 열리면 할 수 있는 것 셋 */
function lockHtml(why: string): string {
  const feat = (icon: string, name: string, line: string) => `<li class="g-row g-feat"><span class="g-ri">${icon}</span><div class="g-rm"><b>${name}</b><span class="g-sub wrap">${line}</span></div></li>`;
  return `<section class="g-card g-lockp"><header class="g-hd lockline"><span class="g-hi">${LOCK}</span><h3>${esc(why)}</h3><span class="g-meta">지금 Lv ${topLevel(G.save)}</span></header>
    <ul class="g-rows">
      ${feat(IC.post(), '영입', '모집 공고')}
      ${feat(IC.flag(), '길드파티', '함께 출전할수록 레벨 · 능력치가 오름')}
    </ul></section>`;
}

/** 결성 이야기 (93 4-1): 열렸는데 아직 결성 전 (결성은 보통 Lv 15 판 결과에서 저절로). 길드원 없이 결성, 영입은 모집 공고로 (Lim 10-21) */
function foundHtml(): string {
  return `<section class="panel g-story"><p class="g-story-line">나만의 원정대를 꾸릴 때다.</p><p class="g-story-line">공고를 내면 동료가 찾아온다.</p>
    <p class="g-story-name"><b>${esc(G.save.guild.name)}</b> 결성</p>
    <button class="btn primary" type="button" id="found">원정대 만들기</button></section>`;
}

/** 길드원 줄: 레벨 · 스킬 LV · 능력 ★ (편성 줄과 같은 memRowHtml) */
function memberRow(m: GuildMember): string {
  const on = st.sheet?.k === 'mem' && st.sheet.id === m.id;
  return memRowHtml(card(m, true), { attrs: `data-mem="${m.id}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on, gold: m.boost ? `${IC.sponsor()}${m.boost}<span class="sr">판 후원</span>` : '' });
}
const memberAbility = (m: GuildMember) => abilityStars(m.stats, CLASSES[m.cls].role as Exclude<MemberRole, 'any'>, m.lv);
const sortedMembers = () => G.save.guild.members
  .filter(m => memberView.role === 'any' || CLASSES[m.cls].role === memberView.role)
  .sort((a, b) => {
    if (memberView.sort === 'name') return a.nick.localeCompare(b.nick, 'ko') || a.id - b.id;
    if (memberView.sort === 'ability') return memberAbility(b) - memberAbility(a) || b.lv - a.lv || a.id - b.id;
    return b.lv - a.lv || a.id - b.id;
  });

// ---------- 공통 부품 (2026-10-19 Lim 「길드컨텐츠 ui 디자인이 형편없다 … 필요한 정보만 텍스트표시 및 너무많은 텍스트를 정리」) ----------
// 판 = 카드 하나: 머리 (그림 · 제목 · 숫자 · ⓘ) + 몸 (줄 · 숫자 칸 · 알약). 규칙 · 긴 설명은 ⓘ를 눌러야 보임 (st.tip, 다시 누르면 닫힘).
interface Sec { key: string; icon: string; title: string; meta?: string; tip?: string; body: string; sum?: string; dot?: boolean; flat?: boolean }
const infoBtn = (key: string, label: string) => `<button type="button" class="g-info" data-tip="${key}" aria-expanded="${st.tip === key}" aria-label="${esc(label)} 설명">${uiIcon('info')}</button>`;
const tipBox = (key: string, html: string) => (st.tip === key ? `<div class="g-tip" role="note">${html}</div>` : '');
function secHtml(x: Sec): string {
  return `<section class="g-card${x.flat ? ' g-flat' : ''}" data-sec="${x.key}" id="guild-panel-${x.key}">${x.flat ? '' : `<header class="g-hd"><span class="g-hi">${x.icon}</span><h3>${x.title}</h3>${x.meta ? `<span class="g-meta">${x.meta}</span>` : ''}${x.tip ? infoBtn(x.key, x.title) : ''}</header>`}${x.tip ? tipBox(x.key, x.tip) : ''}${x.body}</section>`;
}
/** 보상 · 상태 알약: 그림 + 짧은 글 (그림 뜻은 읽어 주는 글로) */
const pill = (ic: string, t: string, cls = '', sr = '') => `<span class="g-pill${cls ? ` ${cls}` : ''}">${ic}${sr ? `<span class="sr">${sr} </span>` : ''}${t}</span>`;
const famePill = (n: number) => pill(IC.fame(), `+${n}`, 'fame', '명성');
const okPill = (t: string) => pill('', `✓ ${t}`, 'ok');
const bar = (pct: number, label: string) => `<span class="g-bar" role="img" aria-label="${label}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(0)}%"></i></span>`;
const placeName = (k: string) => esc(CONTENT.find(c => c.key === k)?.name ?? k);

// ---------- 현황 ----------
function homeHtml(): string {
  const g = G.save.guild;
  // 결성 카드 (한 번): 길드원 없이 결성, 첫 동료는 모집 공고로 (Lim 10-21 「자동 영입 제거」)
  const story = g.storySeen ? '' : `<section class="panel g-story"><p class="g-story-line">원정대 깃발을 세웠다.</p><p class="g-story-line">공고를 내면 동료가 찾아온다.</p>
      <p class="g-story-name"><b>${esc(g.name)}</b> 결성</p><button class="btn2" type="button" id="storyOk">모집 공고 보기</button></section>`;
  return `${story}${secHtml(todoSec())}`;
}

/** 할 일: 주간 목표 · 주간 원정 · 부탁 쪽지 (93 8장). 한 줄에 그림 · 이름 · 숫자 · 보상 알약 */
function todoSec(): Sec {
  const g = G.save.guild, w = G.save.weekly.guild, need = GUILD_GOAL.need, n = Math.min(w.n, need);
  const goal = `<li class="g-row g-goal"><span class="g-ri">${IC.fame()}</span><div class="g-rm"><b>주간 목표</b><span class="g-sub">길드파티 클리어</span>${bar((n / need) * 100, `길드파티 클리어 ${n} / ${need}`)}</div>
    <span class="g-rs"><b class="g-num">${n}<small> / ${need}</small></b>${w.got ? okPill('받음') : w.n >= need ? '<button class="btn mini primary" type="button" id="goalGo">보상 확인</button>' : famePill(GUILD_GOAL.fame)}</span></li>`;
  const ex = g.exped.list, xd = ex.filter(x => x.done).length;
  const places = ex.map(x => {
    const c = CONTENT.find(c => c.key === x.content);
    const action = x.done ? `<span class="g-place g-place-complete" aria-label="${placeName(x.content)} 완료">${okPill('완료')}</span>`
      : `<button type="button" class="btn mini primary g-place" data-goto="${esc(x.content)}" data-gdiff="보통" aria-label="${placeName(x.content)} 보통 입장">입장</button>`;
    return `<li class="g-exrow${x.done ? ' done' : ''}"><div class="g-place-copy"><b>${placeName(x.content)}</b><span>${c ? `${c.size('보통')}인 · ` : ''}보통 이상</span></div>${action}</li>`;
  }).join('');
  const few = g.members.length < 2; // 원정 칸 (5인 이상)은 길드원 2명부터 길드파티
  const exped = ex.length ? `<li class="g-row g-exped"><span class="g-ri">${IC.chest()}</span><div class="g-rm"><b>주간 원정</b><span class="g-sub">${few ? '길드원 2명부터 도전' : `${ex.length}곳 클리어`}</span>${bar((xd / ex.length) * 100, `주간 원정 ${xd} / ${ex.length}`)}</div>
    <span class="g-rs"><b class="g-num">${xd}<small> / ${ex.length}</small></b>${expedReady(G.save) ? '<button class="btn mini primary" type="button" id="expedChest">상자 받기</button>' : g.exped.got ? okPill('받음') : famePill(EXPED.fame)}</span></li>
    <li class="g-exped-places" id="guild-exped-places"><ul class="g-places" aria-label="주간 원정 장소">${places}</ul></li>` : '';
  const reqs = g.reqs.list.map(q => `<li class="g-row g-job${q.done ? ' done' : ''}"><span class="g-ri">${IC.req()}</span><div class="g-rm"><div class="g-job-title"><b>${esc(q.nick)}</b>${q.done ? '' : `<span class="g-rewards">${pill('', `경험치 ×${REQ.xpMult}`, 'xp', esc(q.nick))}</span>`}</div><span class="g-sub wrap">${placeName(q.content)} · ${esc(q.diff)} 이상</span></div>
    <span class="g-rs">${q.done ? `<span class="g-rewards">${okPill('완료')}</span>` : `<button class="btn mini primary" type="button" data-goto="${esc(q.content)}" data-gdiff="${esc(q.diff)}" aria-label="${esc(q.nick)} 부탁 · ${placeName(q.content)} 장소 보기">장소 보기</button>`}</span></li>`).join('');
  const left = (w.got ? 0 : 1) + (ex.length && !g.exped.got ? 1 : 0) + g.reqs.list.filter(q => !q.done).length;
  return {
    key: 'todo', flat: true, icon: IC.goal(), title: '할 일', meta: left ? `${left}개 남음` : '완료', sum: w.n >= need && !w.got || expedReady(G.save) ? '보상 받기' : left ? `${left}개 남음` : '완료', dot: jobsDot(G.save) || (w.n >= need && !w.got), body: `<h3 class="g-job-group">오늘의 부탁<span class="g-group-meta"><small>${g.reqs.list.filter(q => q.done).length}/${g.reqs.list.length} 완료</small>${infoBtn('todo', '할 일')}</span></h3><ul class="g-rows">${reqs || `<li class="g-empty0">${g.members.length ? '새 부탁 없음' : '길드원 영입 뒤 부탁 도착'}</li>`}</ul><h3 class="g-job-group">이번 주</h3><ul class="g-rows">${goal}${exped}</ul>`,
    tip: `<p><b>주간 목표</b> 길드파티로 ${need}번 클리어하면 명성 +${GUILD_GOAL.fame}. 보상은 임무 화면에서 받고, 월요일 오전 6시에 새로 시작합니다.</p>
      <p><b>주간 원정</b> 길드파티로 보통 이상을 깨면 칸마다 명성 +${EXPED.fame}. 셋 다 깨면 원정 상자 (클리어 골드 ${EXPED.chestGold}판 + 장비 1).</p>
      <p><b>부탁</b> 장소를 고른 뒤 편성에 부탁한 길드원을 넣고 그 장소를 그 난이도 이상으로 깨면, 완료한 전투에서 부탁한 길드원의 경험치가 ${REQ.xpMult}배가 됩니다. 부탁마다 한 번 적용되며 날마다 새로 옵니다.</p>
      <p>길드파티 = 자리 절반 이상이 길드원.</p>`,
  };
}

/** 길드원: 역할 필터와 레벨 → 능력 → 이름 순환 정렬. 저장된 편성은 바꾸지 않는다. */
function membersSec(): Sec {
  const n = G.save.guild.members.length, rows = sortedMembers();
  const sortIndex = MEMBER_SORTS.findIndex(x => x.key === memberView.sort);
  const sort = MEMBER_SORTS[sortIndex], nextSort = MEMBER_SORTS[(sortIndex + 1) % MEMBER_SORTS.length];
  const sortButton = `<button type="button" class="btn2 g-sort" id="guildMemberSort" aria-label="${sort.label} · 누르면 ${nextSort.label}" title="레벨순 → 능력순 → 이름순">${svg('<path d="M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4"/>')}<span>${sort.label}</span></button>`;
  const rs = restSponsor(G.save), gold = resourceBalance(G.save, 'gold');
  const filters = `<div class="g-member-tools"><div class="g-chips" role="group" aria-label="길드원 역할">${[['any', '전체'], ...ROLE_PICK.filter(([k]) => k !== 'any')].map(([k, nm]) => `<button type="button" class="g-chip" data-mrole="${k}" aria-pressed="${memberView.role === k}">${nm} <small>${G.save.guild.members.filter(m => k === 'any' || CLASSES[m.cls].role === k).length}</small></button>`).join('')}</div></div>`;
  const sp = rs.ids.length ? `<div class="g-act"><span class="g-ri sm">${IC.sponsor()}</span><span class="g-actt">쉬는 길드원 <b>${rs.ids.length}</b>명</span>
      <button class="btn mini g-rest" type="button" id="sponsorRest"${gold < rs.gold ? ' disabled' : ''}>모두 후원 ${goldCost(rs.gold)}</button></div>` : '';
  return {
    key: 'mem', icon: IC.members(), title: '길드원', meta: sortButton, sum: `${n} / ${capOf(G.save).cap}`,
    body: `${filters}${sp}<ul class="pcards g-list">${rows.map(memberRow).join('') || `<li class="g-empty0">${n ? '이 역할의 길드원 없음' : '영입 탭에서 첫 동료 모집'}</li>`}</ul>`,
    tip: `<p>함께 이긴 판마다 레벨 경험치를 얻습니다 (내 레벨까지). 쉬는 길드원은 30%, 후원하면 출전만큼 받습니다.</p>
      <p>능력치는 레벨이 오를 때 오릅니다. 직업 스킬 레벨은 길드원 Lv 20 · 40 · 60 · 80에서 오릅니다.</p>
      <p>줄을 누르면 능력치 · 골드 지원 · 내보내기.</p>`,
  };
}

/** 아래 붉은 주 버튼 (전투 탭 「출전」과 같은 결). 길드원이 없으면 영입으로 (자동 영입 없음, Lim 10-21) */
function ctaHtml(): string {
  const none = !G.save.guild.members.length;
  return `<button type="button" class="g-cta" id="${none ? 'guildRecruit' : 'guildGo'}"><span class="g-mk" aria-hidden="true"><span>${none ? IC.post() : IC.flag()}</span></span><span class="g-ct"><b>${none ? '모집 공고로 영입' : '길드파티로 출전'}</b></span>${departureArrow()}</button>`;
}

// ---------- 길드원 ----------
function membersHtml(): string {
  return secHtml(membersSec());
}

// ---------- 영입 ----------
/** 광고로 새로 뽑기까지 남은 시간 글 (1시간 쿨타임, 분 단위 올림) */
const adWaitText = (ms: number) => `${Math.max(1, Math.ceil(ms / 60000))}분 뒤`;
/**
 * 모집 공고 (2026-10-22 Lim): 무료, 매일 오전 6시 새 지원자 3명 (Lv 1 ~ 내 레벨), 「새로 뽑기」 = 보상형 광고 한 번 (광고 제거면 바로) → 5명, 1시간에 한 번.
 * 지원자 줄 = 영입 골드 (hireGold = 지원자 Lv × POST.hirePer). 희귀 · 스킬 등급 표시는 없음
 */
function recruitHtml(): string {
  const g = G.save.guild, cap = capOf(G.save), isFull = full(G.save), my = topLevel(G.save);
  const candRow = (c: GuildMember, i: number) => memRowHtml(card(c), {
    attrs: `data-cand="${i}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on: st.sheet?.k === 'cand' && st.sheet.i === i,
    gold: `${goldCost(hireGold(c.lv))}<span class="sr">영입 골드</span>`,
  });
  const post = g.post, cands = post?.cands ?? [], room = Math.max(0, cap.cap - g.members.length), roomTxt = room ? `남은 자리 ${room}명` : '정원 가득'; // 105 QA: 「모두 영입 가능」이 정원과 안 맞았음
  const list = cands.length ? `<ul class="pcards g-list g-candidates">${cands.map((c, i) => candRow(c, i)).join('')}</ul>` : `<p class="g-empty0">내일 새 지원자 ${POST.cands}명<small>오전 6시 · ${roomTxt}</small></p>`;
  const wait = postAdWait(G.save), noads = adsFree(G.save);
  const postSec: Sec = {
    key: 'post', flat: true, icon: IC.post(), title: POST.name, dot: postNew(G.save),
    body: `<div class="g-post-offer"><div class="g-post-copy"><div class="g-offer-title"><h3>지원자 ${cands.length}명<small> · ${roomTxt}</small></h3>${infoBtn('post', POST.name)}</div><p class="g-post-summary">매일 새 ${POST.cands}명 · Lv 1~${my}</p></div>
      <div class="g-post-action"><button class="btn mini primary" type="button" data-post="ad" aria-describedby="guild-post-ad"${cands.length ? ' aria-haspopup="dialog"' : ''}${wait ? ' disabled' : ''}>${wait ? adWaitText(wait) : '새로 뽑기'}</button><small id="guild-post-ad">${wait ? '다시 뽑기까지' : `${noads ? '바로' : '광고 보고'} ${POST.adCands}명`}</small></div></div>
      ${list}`,
    tip: `<p>매일 오전 6시에 모든 직업에서 지원자 ${POST.cands}명이 새로 옵니다. 지원자 레벨은 Lv 1부터 내 레벨까지 무작위입니다.</p><p>「새로 뽑기」는 ${noads ? '광고 없이' : '광고를 한 번 보면'} 지원자 ${POST.adCands}명으로 바꿉니다. 1시간에 한 번 쓸 수 있습니다.</p><p>지원자를 누르면 능력치와 스킬을 보고 영입할 수 있습니다. 영입 골드는 지원자 Lv × ${POST.hirePer}입니다. 영입하지 않은 지원자는 다음 갱신까지 남습니다.</p>`,
  };

  return `${isFull ? `<p class="warnbox g-full">정원 ${g.members.length} / ${cap.cap} 가득<small>길드 레벨을 올리면 정원이 늘어납니다.</small></p>` : ''}${secHtml(postSec)}`;
}

// ---------- 아래 시트 (편성 화면 파티원 시트와 같은 모양) ----------
function sheetBox(label: string, inner: string, footer = '<button class="btn2 f-shut" type="button" data-shut>닫기</button>'): string {
  return `<div class="sheet-dim" data-shut></div><section class="sheet g-msheet" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><span class="grip"></span>
    ${inner}${st.msg ? `<p class="warnbox g-smsg" role="status">${esc(st.msg)}</p>` : ''}${footer}</section>`;
}
const sheetHead = (m: CardData, tip = '') => `<h2 class="h-rule">${esc(m.nick)}<span class="rule"></span><span class="cap">${CLASSES[m.cls].name}${m.lv ? ` · Lv ${m.lv}` : ''}</span>${tip ? infoBtn(tip, m.nick) : ''}</h2>`;

function sheetHtml(): string {
  const x = st.sheet;
  if (!x) return '';
  const g = G.save.guild, isFull = full(G.save);
  if (x.k === 'cand') {
    const c = g.post?.cands[x.i];
    if (!c) return '';
    const d = card(c), cost = hireGold(c.lv), gold = resourceBalance(G.save, 'gold'), short = gold < cost;
    const limit = isFull ? '정원 가득' : short ? `골드 ${fmt(cost - gold)} 부족` : '';
    return sheetBox(`${c.nick} 상세`, `${sheetHead(d)}${memDetailHtml(d)}`,
      `<footer class="g-hire-footer">${limit ? `<p class="g-hire-limit">${limit}</p>` : ''}<div class="g-hire-actions"><button class="btn2" type="button" data-shut>닫기</button><button class="btn mini primary g-hire-btn" type="button" data-hire="${x.i}"${isFull || short ? ' disabled' : ''}>영입<small>${goldCost(cost)}</small></button></div></footer>`);
  }
  const m = memberById(x.id);
  if (!m) return '';
  return sheetBox(`${m.nick} 상세`, detailHtml(m));
}

/** 길드원 상세 (시트 안): 레벨 경험치 막대 → 능력치 · 직업 스킬 · 성격 → 골드 지원 · 내보내기. 규칙은 ⓘ */
function detailHtml(m: GuildMember): string {
  const star = memberSkillLevel(m), a = ABILITIES[m.ab];
  const need = xpToNext(m.lv), xpPct = isFinite(need) ? Math.min(100, (m.xp / need) * 100) : 100;
  const fx = a ? starFx(a, star) : null;
  const gold = resourceBalance(G.save, 'gold');
  const per = statPerLevel(m.learn), sw = sponsorWhy(G.save, m), sg = sponsorGold(m.lv);
  const d = card(m, true);
  const meters = `<div class="g-meters">
      <p class="g-meter"><span class="k">Lv ${m.lv}</span>${bar(xpPct, `경험치 ${Math.floor(xpPct)}%`)}<small>${isFinite(need) ? `${Math.floor(xpPct)}%` : '최대'}</small></p>${m.lastDouble ? `<p class="g-dbl">직전 레벨업 두 배${m.lastDoubleStats?.length ? ` · ${m.lastDoubleStats.map(k => `${STAT_NAMES[k]} +1`).join(' · ')}` : ''}</p>` : ''}</div>`;
  const act = (attr: string, ic: string, label: string, sub: string, dis: boolean) => `<button class="btn" type="button" ${attr}${dis ? ' disabled' : ''}><span class="g-ai">${ic}</span><b>${label}</b><small>${sub}</small></button>`;
  return `${sheetHead(d, 'msheet')}
    ${tipBox('msheet', `<p><b>레벨</b> 함께 이긴 판마다 경험치 (내 레벨까지). 쉬는 판은 30%, 골드 지원 중에는 출전만큼 받습니다. 지원은 한 번에 ${SPONSOR.runs}판이며, 남은 횟수를 모두 쓰면 다시 지원할 수 있습니다.</p>
      <p><b>능력치</b> 레벨이 오를 때마다 오릅니다. 레벨 하나에 ${per.toFixed(2)}점 (${Math.round(LV_DOUBLE * 100)}% 확률로 두 배, 서로 다른 두 칸), 1점마다 한 칸 +1 (20까지). 최근 판에서 한 일과 가까운 칸이 더 잘 오릅니다.</p>
      ${a ? `<p><b>직업 스킬 LV ${star} / 5</b>${fx && star ? ` 효과 ×${fx.eff.toFixed(2)}${fx.cd < 1 ? ` · 쿨 ×${fx.cd.toFixed(1)}` : ''}.` : ''} 길드원 Lv 20 · 40 · 60 · 80에서 오릅니다.${star >= 5 ? ` LV 5: ${STAR5[a.kind]}` : ''}</p>` : ''}`)}
    ${meters}
    ${memDetailHtml(d)}
    <div class="g-acts">
      ${act('data-sponsor aria-haspopup="dialog"', IC.sponsor(), m.boost > 0 ? '지원 중' : '골드 지원', m.boost > 0 ? `${m.boost}판 남음` : sw || goldCost(sg), !!sw || gold < sg)}
      ${act('data-release aria-haspopup="dialog"', IC.release(), '내보내기', '길드에서 제외', false)}
    </div>`;
}

/** 상세 위의 확인창: 확인하기 전에는 골드와 길드원 상태를 바꾸지 않는다. */
function memberConfirmHtml(): string {
  const action = st.ask, m = action && memberById(action.id);
  if (!action || !m || st.sheet?.k !== 'mem' || st.sheet.id !== m.id) { st.ask = null; return ''; }
  const support = action.kind === 'sponsor';
  const disabled = support ? !!sponsorWhy(G.save, m) || resourceBalance(G.save, 'gold') < sponsorGold(m.lv) : false;
  return `<button type="button" class="sheet-dim g-action-dim" data-shut aria-label="확인 취소" tabindex="-1"></button>
    <section class="sheet g-action-confirm" role="dialog" aria-modal="true" aria-labelledby="guildConfirmTitle" aria-describedby="guildConfirmDesc">
      <h3 id="guildConfirmTitle">${support ? '골드 지원' : '내보내기'}</h3>
      <div class="g-action-member"><b>${esc(m.nick)}</b><span>${CLASSES[m.cls].name} · Lv ${m.lv}</span></div>
      <p id="guildConfirmDesc">${support ? '전투에 참여하지 않아도 출전과 같은 경험치를 받습니다. 후원하시겠습니까?' : '길드에서 내보냅니다.'}</p>
      ${support ? `<div class="g-action-cost"><span>${SPONSOR.runs}판 지원</span>${goldCost(sponsorGold(m.lv))}</div>` : ''}
      <div class="g-action-buttons"><button type="button" data-shut>취소</button><button type="button" class="${support ? 'primary' : 'danger'}" data-gconfirm${disabled ? ' disabled' : ''}>확인</button></div>
    </section>`;
}

/** 새로 뽑기도 공통 확인 팝업 (지원자가 남아 있을 때만): 확인 전에는 기존 지원자를 유지한다. 확인 → 보상형 광고 → 5명 */
function postConfirmHtml(): string {
  const post = G.save.guild.post;
  if (!postReplace || !post?.cands.length) { postReplace = false; return ''; }
  const noads = adsFree(G.save), disabled = postAdWait(G.save) > 0;
  return `<button type="button" class="sheet-dim g-action-dim" data-shut aria-label="새로 뽑기 취소" tabindex="-1"></button>
    <section class="sheet g-action-confirm g-post-confirm" role="dialog" aria-modal="true" aria-labelledby="guildPostTitle" aria-describedby="guildPostDesc">
      <h3 id="guildPostTitle">새로 뽑기</h3>
      <p id="guildPostDesc">현재 지원자 ${post.cands.length}명이 돌아갑니다.<br>새 지원자 ${POST.adCands}명을 받으시겠습니까?</p>
      <div class="g-action-cost"><span>${noads ? '광고 없이 바로' : '보상형 광고 1회'}</span><b>${POST.adCands}명</b></div>
      <div class="g-action-buttons"><button type="button" id="cancelPost" data-shut>취소</button><button type="button" class="primary" data-confirm-post="ad"${disabled ? ' disabled' : ''}>확인</button></div>
    </section>`;
}
/** 보상형 광고 (광고 제거면 바로) → 지원자 5명. 광고를 끝까지 안 보면 그대로 */
async function adRefresh(): Promise<void> {
  const ok = await showRewarded(`새 지원자 ${POST.adCands}명`, adsFree(G.save));
  if (ok) {
    const err = adRefreshPost(G.save, Math.random);
    sfx(err ? 'deny' : 'guild-recruit');
    st.msg = err || `새 지원자 ${POST.adCands}명 도착`;
    commit();
  }
  render();
}

function confirmMemberAction(): void {
  const action = st.ask;
  st.ask = null;
  if (!action || st.sheet?.k !== 'mem' || st.sheet.id !== action.id) return;
  const m = memberById(action.id);
  if (m) {
    if (action.kind === 'sponsor') { const err = sponsor(G.save, m.id); sfx(err ? 'deny' : 'gold-spend'); st.msg = err || `골드 지원 · ${m.boost}판 남음`; }
    else if (release(G.save, m.id)) {
      sfx('guild-release');
      st.sheet = null;
      st.msg = `${m.nick}(${CLASSES[m.cls].name}) 길드에서 내보냈습니다.`;
    }
    commit();
  }
  render();
}

function openSheet(x: NonNullable<Sheet>, from: string): void {
  s.el.querySelector<HTMLElement>(from)?.focus({ preventScroll: true });
  st.sheet = x; st.ask = null; st.msg = ''; st.tip = null; render();
}
function closeSheet(): void {
  if (postReplace) postReplace = false;
  else if (st.ask) st.ask = null;
  else { st.sheet = null; st.tip = null; }
  render();
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const save = G.save;
  if (t.closest('[data-shut]')) { closeSheet(); return; }
  const confirm = t.closest<HTMLButtonElement>('[data-gconfirm]');
  if (confirm) { if (!confirm.disabled) confirmMemberAction(); return; }
  const confirmPost = t.closest<HTMLButtonElement>('[data-confirm-post]');
  if (confirmPost) {
    if (postReplace && !confirmPost.disabled) {
      postReplace = false;
      render(); void adRefresh();
    }
    return;
  }
  if (st.ask || postReplace) return;
  const dest = t.closest<HTMLButtonElement>('[data-goto]');
  if (dest) {
    const c = CONTENT.find(c => c.key === dest.dataset.goto);
    const diff = dest.dataset.gdiff;
    if (c && (diff === '쉬움' || diff === '보통' || diff === '어려움' || diff === '악몽')) { Flow.preferGuild = true; go('s-content', { content: c.key, diff }); }
    return;
  }
  const mr = t.closest<HTMLButtonElement>('[data-mrole]');
  if (mr) { memberView.role = mr.dataset.mrole as MemberRole; render(); return; }
  if (t.closest('#guildMemberSort')) {
    const i = MEMBER_SORTS.findIndex(x => x.key === memberView.sort);
    memberView.sort = MEMBER_SORTS[(i + 1) % MEMBER_SORTS.length].key;
    render(); return;
  }
  // ⓘ 설명: 누르면 펼치고 다시 누르면 접음
  const tip = t.closest<HTMLElement>('[data-tip]');
  if (tip) { const k = tip.dataset.tip!; st.tip = st.tip === k ? null : k; render(); return; }
  if (t.closest('#goalGo')) { go('s-missions'); return; }
  if (t.closest('#found')) { const ok = foundGuild(save, Math.random); sfx(ok ? 'guild-levelup' : 'deny'); if (ok) { refreshReqs(save, rankStages(guideCtx()), Math.random); refreshExped(save, realOpen); } commit(); render(); return; } // 할 일도 탭에 들어올 때처럼
  if (t.closest('#sponsorRest')) { const n = restSponsor(save).ids.length, err = sponsorRest(save); sfx(err ? 'deny' : 'gold-spend'); st.msg = err || `쉬는 길드원 ${n}명 후원 · 한 사람 5판`; commit(); render(); return; }
  if (t.closest('#storyOk')) { save.guild.storySeen = true; commit(); st.sub = 'recruit'; st.tip = null; render(); s.el.querySelector<HTMLElement>('.ns-body')?.scrollTo({ top: 0 }); return; }
  if (t.closest('#guildRecruit')) { st.sub = 'recruit'; st.tip = null; render(); s.el.querySelector<HTMLElement>('.ns-body')?.scrollTo({ top: 0 }); return; }
  // 「길드파티로 출전」: 전투 탭(모험 고르기) → 편성이 길드파티로 시작 (game/flow.ts)
  if (t.closest('#guildGo') && save.guild.members.length) { Flow.preferGuild = true; go('s-content'); return; }
  if (t.closest('#expedChest')) { // 받은 뒤 지난 주 목록이면 바로 새 주 원정 (105 QA 3), 받은 것은 보상 창 (reward-pop, 2026-10-24 Lim 시안 A)
    const r = claimExped(save, Math.random); sfx(typeof r === 'string' ? 'deny' : 'chest-open'); if (typeof r !== 'string') refreshExped(save, realOpen);
    st.msg = typeof r === 'string' ? r : ''; commit(); render();
    if (typeof r !== 'string') showReward({ title: '원정 상자', gold: r.gold, items: r.items });
    return;
  }
  const post = t.closest<HTMLButtonElement>('[data-post]');
  if (post) {
    if (!post.disabled) {
      if (save.guild.post?.cands.length) { postReplace = true; render(); return; }
      void adRefresh();
    }
    return;
  }
  const h = t.closest<HTMLButtonElement>('[data-hire]');
  if (h) { if (!h.disabled) { const err = hire(save, Number(h.dataset.hire)); sfx(err ? 'deny' : 'guild-recruit'); st.sheet = null; st.msg = err || '영입 완료 · 「길드원」에서 확인'; commit(); render(); } return; }
  const x = st.sheet;
  if (x?.k === 'mem' && t.closest('.g-msheet')) {
    const button = t.closest<HTMLButtonElement>('[data-sponsor], [data-release]');
    if (button && !button.disabled) { st.ask = { kind: button.hasAttribute('data-sponsor') ? 'sponsor' : 'release', id: x.id }; render(); }
    return;
  }
  const sub = t.closest<HTMLElement>('[data-sub]');
  if (sub) { st.sub = sub.dataset.sub as Sub; st.sheet = null; st.ask = null; st.tip = null; postReplace = false; render(); s.el.querySelector<HTMLElement>('.ns-body')?.scrollTo({ top: 0 }); return; }
  const mem = t.closest<HTMLElement>('[data-mem]');
  if (mem) { openSheet({ k: 'mem', id: Number(mem.dataset.mem) }, `[data-mem="${mem.dataset.mem}"]`); return; }
  const cand = t.closest<HTMLElement>('[data-cand]');
  if (cand) openSheet({ k: 'cand', i: Number(cand.dataset.cand) }, `[data-cand="${cand.dataset.cand}"]`);
});

// 누를 수 있는 줄 (role="button")은 Enter·Space로도, Esc = 시트 닫기
s.el.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  if (e.key === 'Escape' && (st.sheet || postReplace)) { e.preventDefault(); closeSheet(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && t.matches('[role="button"]:not(button)')) { e.preventDefault(); t.click(); }
});
