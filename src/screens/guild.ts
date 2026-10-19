/**
 * 길드 탭 (길드 v2 `93` · FM `97`, 사슬 4번). Lv 15에 결성 이야기로 열림.
 * #233 모양 그대로 (상점 · 편성과 같은 길드 홀 돌색, guild-hall.css): 위 = 하위 탭 (현황 · 길드원 · 영입) + 길드 홀 그림 머리 (이름 · Lv · 정원 · 명성).
 * 2026-10-19 Lim 「길드컨테츠 ui 디자인이 형편없다 … 필요한 정보만 텍스트」 → C안. 같은 날 추가 요청으로 기록과 스킬 뽑기 제거:
 *  현황 · 영입 = 그림 메뉴 (hub) + 고른 칸의 판 하나. 현황 = 할 일 · 시설 (처음 = 할 일), 영입 = 친구 초대 · 공고 (+ 지원자) · 명성 지원자 · 명부.
 *  길드원 = 판 하나 (편성과 같은 파티원 줄) → 아래 시트 (레벨 · 인연 막대 · 능력치 · 후원 · 보내기).
 *  공통 부품: 판 (.g-card 머리 = 그림 · 제목 · 숫자 · ⓘ), 줄 (.g-row), 숫자 칸 (.g-tiles), 알약 (.g-pill). 규칙 · 긴 설명은 ⓘ를 눌러야 보임.
 * 육성 포인트 · 훈련 · 자질 · 전투력 숫자 · 인연 스카우트는 없앰 (97: 크는 길은 출전 경험뿐).
 */
import { resourceBalance } from '../game/resources';
import { ABILITIES, STAR5, starFx } from '../data/abilities';
import { CLASSES, RECRUIT_CLASSES, type ClassKey } from '../data/classes';
import { CONTENT } from '../data/content';
import { PARTY_POOL, STORY_NICKS } from '../data/nicknames';
import { BOND_STEPS, bondLv, bondName, EXPED, FAC, FAC_GOLD, FAC_KEYS, FRIEND_LV, REQ, STORY, type FacKey, type StoryKey, POSTS, SPONSOR, sponsorGold, starOfBond, statCap, statPerLevel, statPot, type GuildMember, type PostKind, type PostRole } from '../data/guild';
import { GUILD_GOAL } from '../data/missions';
import { GUILD_LEVEL, xpToNext } from '../data/progression';
import { dayKey, daysBetween } from '../game/clock';
import { Flow } from '../game/flow';
import { claimExped } from '../game/economy';
import { guideCtx, rankStages, realOpen } from '../game/guide';
import { expedReady, jobsDot, refreshExped, refreshReqs } from '../game/guildjobs';
import { profileOf } from '../data/fm';
import { bondOf, bondPt, buildFac, capOf, facLv, facWhy, foundGuild, inviteStory, personOf, postCands, postCost, restSponsor, sponsor, sponsorRest, sponsorWhy, friendsOf, full, guildOpen, hire, hireApp, inviteFriend, postRecruit, refreshApps, release, worldLevel } from '../game/guild';
import { commit, G, refreshDay } from '../game/state';
import { topLevel } from '../platform/storage';
import { memDetailHtml, memRowHtml, type CardData } from './members';
import { bondIconSvg } from './member-icons';
import { esc, fmt, go, screen, topBar } from './kit';
import { currencyAmount, gameIcon, LOCK, uiIcon } from './art';
import { sheetDialog } from './dialog';

type Sub = 'home' | 'members' | 'recruit';
const SUBS: [Sub, string][] = [['home', '현황'], ['members', '길드원'], ['recruit', '영입']];
/** 열린 시트: 길드원 · 친구 · 공고 지원자 · 명성 지원자 */
type Sheet = { k: 'mem'; id: number } | { k: 'friend'; nick: string } | { k: 'cand'; i: number } | { k: 'app'; i: number } | null;
type MemberAction = { kind: 'sponsor' | 'release'; id: number };
/** tip = 펼친 ⓘ 설명 (판 키 · 'msheet'), pkind = 공고 종류, csel = 큰 그림 칸에서 고른 판 */
const st: { sub: Sub; sheet: Sheet; msg: string; ask: MemberAction | null; role: PostRole; cls: ClassKey; roster: boolean; rrole: PostRole; rfriend: boolean; tip: string | null; pkind: PostKind; csel: string } = { sub: 'home', sheet: null, msg: '', ask: null, role: 'any', cls: 'warrior', roster: false, rrole: 'any', rfriend: false, tip: null, pkind: 'normal', csel: '' };

const memberView: { role: PostRole; sort: 'level' | 'bond'; } = { role: 'any', sort: 'level' };
let postReplace = false;

const s = screen('s-guild', '길드', { tab: 'guild', enter() { refreshDay(); if (G.save.guild.founded) { refreshApps(G.save, Math.random); refreshReqs(G.save, rankStages(guideCtx()), Math.random); refreshExped(G.save, realOpen); commit(); } st.sub = 'home'; st.sheet = null; st.msg = ''; st.ask = null; st.tip = null; st.csel = ''; postReplace = false; render(); } });
s.el.classList.add('g-hall');
const modal = sheetDialog(s.el, closeSheet);

/** 출전 문양 (길드 탭 깃발 그림이 없을 때), 오른쪽 화살표 */
const svg = (d: string, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const FLAG = svg('<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>');
const ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.4).replace('<svg', '<svg class="g-arrow"');
const goldCost = (value: number) => currencyAmount('gold', value);
/** 길드 그림 (2026-10-18 Codex): 모집 공고 · 인연 (예전 스카우트 그림) · 명성. 없으면 선 아이콘 */
const IC = {
  req: () => gameIcon('request', uiIcon('quest')),
  chest: () => gameIcon('expedition-chest', ''),
  fac: (k: FacKey) => gameIcon(`hall-${k}`, uiIcon('guild')),
  post: () => gameIcon('guild-post', uiIcon('quest')),
  scout: () => gameIcon('guild-scout', uiIcon('hands')),
  fame: () => gameIcon('guild-fame', uiIcon('star')),
  flag: () => gameIcon('guild', FLAG, 'tab'),
  // 2026-10-19 길드 화면 정리 (Codex): 길드원 · 명부 · 할 일 · 후원 · 보내기
  members: () => gameIcon('guild-members', uiIcon('guild')),
  roster: () => gameIcon('guild-roster', uiIcon('quest')),
  goal: () => gameIcon('guild-goal', uiIcon('star')),
  sponsor: () => gameIcon('guild-sponsor', uiIcon('hands')),
  release: () => gameIcon('guild-release', uiIcon('arrow')),
  heart: () => bondIconSvg(3),
  heart3: () => bondIconSvg(12),
  swords: () => gameIcon('a2-swords', uiIcon('battle')),
};
const ROLE_PICK: [PostRole, string][] = [['tank', '탱커'], ['melee', '근접'], ['ranged', '원거리'], ['any', '아무나']];

const memberById = (id: number) => G.save.guild.members.find(m => m.id === id);
/** 줄 · 시트에 넘길 사람 (인연 Lv에 따라 안개) */
const card = (m: Pick<GuildMember, 'nick' | 'cls' | 'pers' | 'ab' | 'lv' | 'stats'>, bond: number, star = 0, member = false): CardData => ({ nick: m.nick, cls: m.cls, pers: m.pers, ab: m.ab, lv: m.lv, star, fm: { stats: m.stats }, bond, member });

/** 위: 하위 탭 (상점과 같은 .subtabs). 영입 = 지원자 빨간 점 */
function tabs(): string {
  const g = G.save.guild, cands = (g.post?.cands.length || 0) + g.apps.length;
  const extra: Record<Sub, string> = {
    home: '',
    members: '',
    recruit: cands ? `<i class="rdot" aria-label="지원자 ${cands}명"></i>` : '',
  };
  return `<nav class="subtabs" role="tablist" aria-label="길드 메뉴">${SUBS.map(([k, n]) => `<button type="button" role="tab" data-sub="${k}" aria-selected="${st.sub === k}">${n}${extra[k]}</button>`).join('')}</nav>`;
}

/** 시설 단계 합이 오를수록 길드 홀 머리에 소품이 하나씩 (93 6-3 · 11장, 합 1 · 4 · 7 · 10 · 13) */
function propsHtml(): string {
  const t = FAC_KEYS.reduce((a, k) => a + facLv(G.save, k), 0);
  return [1, 4, 7, 10, 13].map((at, i) => (t >= at ? gameIcon(`guild-prop-${i + 1}`, '', 'obj').replace('class="g-ic"', `class="g-ic gh-prop p${i + 1}"`) : '')).join('');
}
/** 길드 홀 그림 머리 (상점 선반 그림과 같은 .art-hero): 길드 이름 · Lv · 정원 · 명성 (다음 Lv까지 막대). 하위 탭 이름은 탭에만 */
function hero(title: string, stats = true): string {
  const g = G.save.guild, cap = capOf(G.save);
  const prev = cap.lv > 1 ? [0, 20, 60, 120, 200, 320, 480, 700, 1200, 2000][cap.lv - 1] : 0;
  const pct = cap.next ? Math.min(100, ((g.fame - prev) / (cap.next - prev)) * 100) : 100;
  return `<header class="art-hero guild-hero">${propsHtml()}<div class="ah-copy"><p class="eyebrow">${stats ? '길드' : '길드 홀'}</p><h2>${stats ? esc(g.name) : title}</h2></div>
    ${stats ? `<p class="gh-stats"><span class="gh-lv">${gameIcon('guild-flag', '')}길드 Lv ${cap.lv}</span><span>정원 ${g.members.length}/${cap.cap}</span><span class="gh-fame">${IC.fame()}명성 ${fmt(g.fame)}${cap.next ? `<small>/${fmt(cap.next)}</small>` : ''}</span></p>
      <span class="gh-bar" role="img" aria-label="다음 길드 Lv까지 ${Math.round(pct)}%"><i style="width:${pct.toFixed(0)}%"></i></span>` : ''}</header>`;
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
    st.sheet = null; st.ask = null;
    s.el.innerHTML = `${topBar({ settings: true })}<div class="ns-body guild g-lock">${hero('길드', false)}${open.ok ? foundHtml() : lockHtml(open.why)}</div>`;
    modal.sync(null, []);
    return;
  }
  const hasCta = st.sub === 'home' && (!st.csel || st.csel === 'todo');
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
    ${sheet}${memberConfirmHtml()}`;
  const nb = s.el.querySelector<HTMLElement>('.ns-body');
  if (nb) { nb.dataset.view = st.sub; nb.scrollTop = keep; }
  modal.sync(st.sheet ? s.el.querySelector<HTMLElement>(st.ask ? '.g-action-confirm' : '.g-msheet') : null,
    st.sheet ? [sheetKey(st.sheet), ...(st.ask ? [`confirm:${st.ask.kind}`] : [])] : []);
  if (!st.sheet && focusSelector && active?.closest('.ns-body, .subtabs')) s.el.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
  st.msg = '';
}
const sheetKey = (x: NonNullable<Sheet>) => `${x.k}:${'id' in x ? x.id : 'nick' in x ? x.nick : x.i}`;

/** 잠김 (Lv 15 전 · 튜토리얼 중): 열리면 할 수 있는 것 셋 */
function lockHtml(why: string): string {
  const feat = (icon: string, name: string, line: string) => `<li class="g-row g-feat"><span class="g-ri">${icon}</span><div class="g-rm"><b>${name}</b><span class="g-sub wrap">${line}</span></div></li>`;
  return `<section class="g-card g-lockp"><header class="g-hd lockline"><span class="g-hi">${LOCK}</span><h3>${esc(why)}</h3><span class="g-meta">지금 Lv ${topLevel(G.save)}</span></header>
    <ul class="g-rows">
      ${feat(IC.scout(), '인연', '함께 이길수록 쌓임 · 친구가 되면 초대')}
      ${feat(IC.post(), '영입', '모집 공고 · 명성 지원자')}
      ${feat(IC.flag(), '길드파티', '함께 출전할수록 레벨 · 능력치가 오름')}
    </ul></section>`;
}

/** 결성 이야기 (93 4-1): 열렸는데 아직 결성 전 (결성은 보통 Lv 15 판 결과에서 저절로) */
function foundHtml(): string {
  return `<section class="panel g-story"><p class="g-story-line">그동안 살려 준 모험가들이 모였다.</p><p class="g-story-line">「이 힐러 놓치면 안 돼.」</p>
    <p class="g-story-name"><b>${esc(G.save.guild.name)}</b> 결성</p>
    <button class="btn primary" type="button" id="found">원정대 만들기</button></section>`;
}

/** 길드원 줄: 하트 · 인연 Lv · 능력 ★ (편성 줄과 같은 memRowHtml) */
function memberRow(m: GuildMember): string {
  const on = st.sheet?.k === 'mem' && st.sheet.id === m.id, b = bondOf(G.save, m.nick);
  return memRowHtml(card(m, b, starOfBond(b), true), { attrs: `data-mem="${m.id}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on, gold: m.boost ? `${IC.sponsor()}${m.boost}<span class="sr">판 후원</span>` : '' });
}
const byLevel = () => G.save.guild.members.slice().filter(m => memberView.role === 'any' || CLASSES[m.cls].role === memberView.role).sort((a, b) => memberView.sort === 'bond' ? bondPt(G.save, b.nick) - bondPt(G.save, a.nick) || b.lv - a.lv : b.lv - a.lv || bondPt(G.save, b.nick) - bondPt(G.save, a.nick));

// ---------- 공통 부품 (2026-10-19 Lim 「길드컨텐츠 ui 디자인이 형편없다 … 필요한 정보만 텍스트표시 및 너무많은 텍스트를 정리」) ----------
// 판 = 카드 하나: 머리 (그림 · 제목 · 숫자 · ⓘ) + 몸 (줄 · 숫자 칸 · 알약). 규칙 · 긴 설명은 ⓘ를 눌러야 보임 (st.tip, 다시 누르면 닫힘).
interface Sec { key: string; icon: string; title: string; meta?: string; tip?: string; body: string; sum?: string; dot?: boolean }
const infoBtn = (key: string, label: string) => `<button type="button" class="g-info" data-tip="${key}" aria-expanded="${st.tip === key}" aria-label="${esc(label)} 설명">${uiIcon('info')}</button>`;
const tipBox = (key: string, html: string) => (st.tip === key ? `<div class="g-tip" role="note">${html}</div>` : '');
function secHtml(x: Sec): string {
  return `<section class="g-card" data-sec="${x.key}" id="guild-panel-${x.key}"><header class="g-hd"><span class="g-hi">${x.icon}</span><h3>${x.title}</h3>${x.meta ? `<span class="g-meta">${x.meta}</span>` : ''}${x.tip ? infoBtn(x.key, x.title) : ''}</header>${x.tip ? tipBox(x.key, x.tip) : ''}${x.body}</section>`;
}
/**
 * 그림 칸 + 고른 판 하나 (2026-10-19 Lim C안, 이후 기록 제거): 위에 칸 (그림 · 이름 · 요약 숫자 · 빨간 점),
 * 아래에 고른 칸의 판 하나만. 처음엔 첫 칸 (현황 = 할 일). 길드원 탭은 목록 하나라 칸 없이 판만
 */
function hub(secs: Sec[]): string {
  const cur = secs.find(x => x.key === st.csel) ?? secs[0];
  return `<ul class="g-hub n${secs.length}" role="tablist" aria-label="길드 판 고르기">${secs.map(x => `<li><button type="button" role="tab" class="g-hubt" data-csel="${x.key}" ${x === cur ? `aria-controls="guild-panel-${x.key}"` : ''} aria-selected="${x === cur}"><span class="g-hubi">${x.icon}</span><b>${x.title}</b><small>${x.sum ?? ''}</small>${x.dot ? '<i class="rdot" aria-label="새 소식"></i>' : ''}</button></li>`).join('')}</ul>${cur ? secHtml(cur) : ''}`;
}
/** 숫자 칸: [그림, 숫자, 이름] */
const tilesHtml = (xs: [string, string | number, string][]) => `<ul class="g-tiles">${xs.map(([ic, v, n]) => `<li><span class="g-ti">${ic}</span><b>${typeof v === 'number' ? fmt(v) : v}</b><small>${n}</small></li>`).join('')}</ul>`;
/** 보상 · 상태 알약: 그림 + 짧은 글 (그림 뜻은 읽어 주는 글로) */
const pill = (ic: string, t: string, cls = '', sr = '') => `<span class="g-pill${cls ? ` ${cls}` : ''}">${ic}${sr ? `<span class="sr">${sr} </span>` : ''}${t}</span>`;
const famePill = (n: number) => pill(IC.fame(), `+${n}`, 'fame', '명성');
const bondPill = (n: number) => pill(IC.heart(), `+${n}`, 'bond', '인연');
const okPill = (t: string) => pill('', `✓ ${t}`, 'ok');
const bar = (pct: number, label: string) => `<span class="g-bar" role="img" aria-label="${label}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(0)}%"></i></span>`;
const placeName = (k: string) => esc(CONTENT.find(c => c.key === k)?.name ?? k);

// ---------- 현황 ----------
function homeHtml(): string {
  const g = G.save.guild;
  const story = g.storySeen ? '' : `<section class="panel g-story"><p class="g-story-line">그동안 살려 준 모험가들이 모였다.</p><p class="g-story-line">「이 힐러 놓치면 안 돼.」</p>
      <p class="g-story-name"><b>${esc(g.name)}</b> 결성 · ${g.members.slice(0, 4).map(m => esc(m.nick)).join(' · ')}</p><button class="btn2" type="button" id="storyOk">확인</button></section>`;
  return `${story}${arriveHtml()}${hub([todoSec(), facSec()])}`;
}

/** 할 일: 주간 목표 · 주간 원정 · 부탁 쪽지 (93 8장). 한 줄에 그림 · 이름 · 숫자 · 보상 알약 */
function todoSec(): Sec {
  const g = G.save.guild, w = G.save.weekly.guild, need = GUILD_GOAL.need, n = Math.min(w.n, need);
  const goal = `<li class="g-row g-goal"><span class="g-ri">${IC.fame()}</span><div class="g-rm"><b>주간 목표</b><span class="g-sub">길드파티 클리어</span>${bar((n / need) * 100, `길드파티 클리어 ${n} / ${need}`)}</div>
    <span class="g-rs"><b class="g-num">${n}<small> / ${need}</small></b>${w.got ? okPill('받음') : w.n >= need ? '<button class="btn mini primary" type="button" id="goalGo">보상 확인</button>' : famePill(GUILD_GOAL.fame)}</span></li>`;
  const ex = g.exped.list, xd = ex.filter(x => x.done).length;
  const exped = ex.length ? `<li class="g-row g-exped"><span class="g-ri">${IC.chest()}</span><div class="g-rm"><b>주간 원정</b><span class="g-sub">길드파티 · 보통 이상</span><span class="g-places">${ex.map(x => `<button type="button" class="g-place g-exrow${x.done ? ' done' : ''}" data-goto="${esc(x.content)}" data-gdiff="보통" aria-label="${placeName(x.content)} 보통 장소 보기${x.done ? ' · 완료' : ''}">${x.done ? '✓ ' : ''}${placeName(x.content)}${x.done ? '' : ' ›'}</button>`).join('')}</span></div>
    <span class="g-rs"><b class="g-num">${xd}<small> / ${ex.length}</small></b>${expedReady(G.save) ? '<button class="btn mini primary" type="button" id="expedChest">상자 받기</button>' : g.exped.got ? okPill('받음') : famePill(EXPED.fame)}</span></li>` : '';
  const reqs = g.reqs.list.map(q => `<li class="g-row g-job${q.done ? ' done' : ''}"><span class="g-ri">${IC.req()}</span><div class="g-rm"><b>${esc(q.nick)}<small>부탁</small></b><span class="g-sub wrap">${placeName(q.content)} · ${esc(q.diff)} 이상</span><span class="g-rewards">${q.done ? okPill('완료') : `${bondPill(REQ.bond)}${famePill(REQ.fame)}`}</span></div>
    <span class="g-rs">${q.done ? '' : `<button class="btn2 mini" type="button" data-goto="${esc(q.content)}" data-gdiff="${esc(q.diff)}" aria-label="${esc(q.nick)} 부탁 · ${placeName(q.content)} 장소 보기">장소 보기</button>`}</span></li>`).join('');
  const left = (w.got ? 0 : 1) + (ex.length && !g.exped.got ? 1 : 0) + g.reqs.list.filter(q => !q.done).length;
  return {
    key: 'todo', icon: IC.goal(), title: '할 일', sum: w.n >= need && !w.got || expedReady(G.save) ? '보상 받기' : left ? `${left}개 남음` : '완료', dot: jobsDot(G.save) || (w.n >= need && !w.got), body: `<ul class="g-rows">${reqs}${goal}${exped}</ul>`,
    tip: `<p><b>주간 목표</b> 길드파티로 ${need}번 클리어하면 명성 +${GUILD_GOAL.fame}, 출전한 길드원 인연 +2. 보상은 임무 화면에서 받고, 월요일 오전 6시에 새로 시작합니다.</p>
      <p><b>주간 원정</b> 길드파티로 보통 이상을 깨면 칸마다 명성 +${EXPED.fame}. 셋 다 깨면 원정 상자 (클리어 골드 ${EXPED.chestGold}판 + 장비 1).</p>
      <p><b>부탁</b> 장소를 고른 뒤 편성에 부탁한 길드원을 넣고 그 장소를 그 난이도 이상으로 깨면 인연 +${REQ.bond} · 명성 +${REQ.fame}. 날마다 새로 오고, 놓쳐도 손해는 없습니다.</p>
      <p>길드파티 = 자리 절반 이상이 길드원.</p>`,
  };
}

/** 길드원 (레벨 순 모두 + 쉬는 길드원 모두 후원). 현황에는 안 둠 (2026-10-19 Lim 「길드원 메뉴는 중복된다」) */
function membersSec(): Sec {
  const n = G.save.guild.members.length, rows = byLevel();
  const rs = restSponsor(G.save), gold = resourceBalance(G.save, 'gold');
  const filters = `<div class="g-member-tools"><div class="g-chips" role="group" aria-label="길드원 역할">${[['any', '전체'], ...ROLE_PICK.filter(([k]) => k !== 'any')].map(([k, nm]) => `<button type="button" class="g-chip" data-mrole="${k}" aria-pressed="${memberView.role === k}">${nm} <small>${G.save.guild.members.filter(m => k === 'any' || CLASSES[m.cls].role === k).length}</small></button>`).join('')}</div></div>`;
  const sort = `<label class="g-sort"><span class="sr">정렬</span><select id="guildSort" aria-label="길드원 정렬"><option value="level"${memberView.sort === 'level' ? ' selected' : ''}>레벨순</option><option value="bond"${memberView.sort === 'bond' ? ' selected' : ''}>인연순</option></select></label>`;
  const sp = rs.ids.length ? `<div class="g-act"><span class="g-ri sm">${IC.sponsor()}</span><span class="g-actt">쉬는 길드원 <b>${rs.ids.length}</b>명</span>
      <button class="btn mini g-rest" type="button" id="sponsorRest"${gold < rs.gold ? ' disabled' : ''}>모두 후원 ${goldCost(rs.gold)}</button></div>` : '';
  return {
    key: 'mem', icon: IC.members(), title: '길드원', meta: sort, sum: `${n} / ${capOf(G.save).cap}`,
    body: `${filters}${sp}<ul class="pcards g-list">${rows.map(memberRow).join('') || '<li class="g-empty0">이 역할의 길드원 없음</li>'}</ul>`,
    tip: `<p>함께 이긴 판마다 레벨 경험치를 얻습니다 (내 레벨까지). 쉬는 길드원은 30%, 후원하면 출전만큼 받습니다.</p>
      <p>능력치는 레벨이 오를 때 오릅니다. 직업 스킬 레벨은 인연 Lv 4 · 6 · 8 · 10에서 오릅니다.</p>
      <p>하트 옆 숫자 = 인연 Lv. 줄을 누르면 능력치 · 골드 지원 · 내보내기.</p>`,
  };
}

/** 시설 (93 6-3): 셋을 나란히 (그림 · 이름 · 단계 눈금 · 골드 버튼). 효과는 ⓘ */
function facSec(): Sec {
  const gold = resourceBalance(G.save, 'gold');
  const pips = (lv: number) => `<span class="g-pips" role="img" aria-label="${lv} / 5단계">${[0, 1, 2, 3, 4].map(i => `<i${i < lv ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const tile = (k: FacKey) => {
    const lv = facLv(G.save, k), why = facWhy(G.save, k), c = FAC_GOLD[lv], f = FAC[k];
    const side = lv >= FAC_GOLD.length ? okPill('완성') : why ? `<small class="g-lockt">${LOCK}길드 Lv ${f.guildLv}</small>` : `<button class="btn mini primary" type="button" data-fac="${k}" aria-label="${f.name} ${lv + 1}단계 올리기 · 골드 ${fmt(c)}"${gold < c ? ' disabled' : ''}>올리기<small>${goldCost(c)}</small></button>`;
    return `<li class="g-fac"><span class="g-fi">${IC.fac(k)}</span><div class="g-fac-copy"><b>${f.name}<small>${lv} / 5단계</small></b>${pips(lv)}<span class="g-fac-effect">${lv < 5 ? '<em>다음</em> ' : ''}${esc(f.steps[Math.min(lv, 4)])}</span>${!why && lv < 5 && gold < c ? '<small class="g-short">골드 부족</small>' : ''}</div>${side}</li>`;
  };
  const eff = (k: FacKey) => { const lv = facLv(G.save, k), f = FAC[k]; return `<p><b>${f.name} ${lv}/5</b> ${lv ? esc(f.steps[lv - 1]) : '아직 없음'}${lv < 5 ? ` → 다음 ${esc(f.steps[lv])}` : ''}</p>`; };
  const t = FAC_KEYS.reduce((a, k) => a + facLv(G.save, k), 0);
  return {
    key: 'fac', icon: IC.fac('feast'), title: '시설', meta: goldCost(gold), sum: `${t} / 15`,
    body: `<ul class="g-facs">${FAC_KEYS.map(tile).join('')}</ul>`,
    tip: `${FAC_KEYS.map(eff).join('')}<p>골드로 1~5단계까지 올립니다. 단계 합이 오를수록 길드 홀이 꾸며집니다.</p>`,
  };
}

/** 아래 붉은 주 버튼 (전투 탭 「출전」과 같은 결) */
function ctaHtml(): string {
  const w = G.save.weekly.guild, need = GUILD_GOAL.need;
  return `<button type="button" class="g-cta" id="guildGo"><span class="g-mk"><span>${IC.flag()}</span></span><span class="g-ct"><b>길드파티로 출전</b><small>주간 목표 ${Math.min(w.n, need)} / ${need}</small></span>${ARROW}</button>`;
}

/** 스토리 동료 합류 카드 (93 4-4, 결성 이야기와 같은 틀) */
function arriveHtml(): string {
  const k = G.save.guild.storyCard;
  if (!k) return '';
  const st = STORY[k], a = ABILITIES[st.ab], wait = G.save.guild.storyWait.includes(k);
  return `<section class="panel g-story g-arrive"><p class="g-story-line">${esc(st.nick)} (${CLASSES[st.cls].name} · ${esc(st.pers)})${wait ? '이 원정대를 찾아왔다.' : '이 원정대에 들어왔다.'}</p>
    <p class="g-story-line">「${k === 'isle' ? '나도 원래 힐러였어. 이번엔 같이 버티자.' : '앞은 맡겨. 끝까지 베어 낸다.'}」</p>
    <p class="g-story-name">고유 스킬 <b>${esc(a?.name ?? '')}</b></p>
    ${wait ? `<p class="g-story-name">${pill('', '정원 가득 · 친구 초대에서 기다림', 'warn')}</p>` : ''}<button class="btn2" type="button" id="arriveOk">확인</button></section>`;
}

// ---------- 길드원 ----------
function membersHtml(): string {
  return secHtml(membersSec());
}

// ---------- 영입 ----------
/** 서버 유저 명부 (93 3-4): 만난 모험가 n/1000 · 친구 · 길드원 · 단짝, 펼치면 인연 순 (역할 · 친구만 거르기, 40명까지) */
const POOL_N = Object.values(PARTY_POOL).reduce((t, l) => t + l.length, 0);
function rosterSec(): Sec {
  const all = Object.entries(G.save.users), inG = new Set(G.save.guild.members.map(m => m.nick));
  const n = (f: (lv: number) => boolean) => all.filter(([, u]) => f(bondLv(u.pt))).length;
  const toggle = `<button class="g-more g-roster" type="button" id="roster" aria-expanded="${st.roster}">${st.roster ? '접기' : '펼치기'} ${uiIcon('arrow')}</button>`;
  const tiles = tilesHtml([[IC.heart(), friendsOf(G.save).length, '친구'], [IC.members(), inG.size, '길드원'], [IC.heart3(), n(l => l >= 12), '단짝']]);
  let list = '';
  if (st.roster) {
    const rows = all.map(([nick, u]) => ({ nick, u, p: personOf(nick) })).filter(x => x.p && !inG.has(x.nick) && !STORY_NICKS.includes(x.nick))
      .filter(x => (st.rrole === 'any' || CLASSES[x.p!.cls].role === st.rrole) && (!st.rfriend || bondLv(x.u.pt) >= FRIEND_LV))
      .sort((a, b) => b.u.pt - a.u.pt || b.u.wins - a.u.wins);
    const chips = ROLE_PICK.map(([k, nm]) => `<button type="button" class="g-chip" data-rrole="${k}" aria-pressed="${st.rrole === k}">${k === 'any' ? '모두' : nm}</button>`).join('')
      + `<button type="button" class="g-chip" id="rfriend" aria-pressed="${st.rfriend}">친구만</button>`;
    const row = (x: (typeof rows)[number]) => memRowHtml(card({ nick: x.nick, cls: x.p!.cls, pers: x.p!.pers, ab: x.p!.ab, lv: worldLevel(G.save, x.p!), stats: x.p!.fm.stats }, bondLv(x.u.pt)), {
      attrs: `data-friend="${esc(x.nick)}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', tag: `${IC.swords()}${x.u.wins}<span class="sr">판 함께 이김</span>`,
    });
    list = `<div class="g-chips g-pad" role="group" aria-label="명부 거르기">${chips}</div>
      <ul class="pcards g-list">${rows.slice(0, 40).map(row).join('') || '<li class="g-empty0">해당하는 모험가 없음</li>'}</ul>${rows.length > 40 ? `<p class="g-empty0">외 ${rows.length - 40}명</p>` : ''}`;
  }
  return {
    key: 'roster', icon: IC.roster(), title: '명부', meta: `${all.length}<small> / ${POOL_N}</small>`, sum: `${all.length}명`, body: `${tiles}${list}${toggle}`,
    tip: '<p>만난 모험가 모두. 친구는 초대할 수 있고 능력치가 범위로, 처음 보는 사람은 능력 ★만 보입니다.</p>',
  };
}

function recruitHtml(): string {
  const g = G.save.guild, cap = capOf(G.save), isFull = full(G.save), gold = resourceBalance(G.save, 'gold'), my = topLevel(G.save);
  const fr = friendsOf(G.save);
  const side = (attr: string, label: string) => `<span class="g-side"><button class="btn mini primary" type="button" ${attr}${isFull ? ' disabled' : ''}>${label}</button></span>`;
  const friendRow = (f: (typeof fr)[number]) => {
    const p = f.away ?? f.person!, lv = f.away ? f.away.lv : worldLevel(G.save, f.person!), stats = f.away ? f.away.stats : f.person!.fm.stats;
    return memRowHtml(card({ nick: f.nick, cls: p.cls, pers: p.pers, ab: p.ab, lv, stats }, bondOf(G.save, f.nick)), {
      attrs: `data-friend="${esc(f.nick)}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on: st.sheet?.k === 'friend' && st.sheet.nick === f.nick, tag: f.away ? '예전 길드원' : '',
      extra: side(`data-invite="${esc(f.nick)}"`, '초대'),
    });
  };
  const candRow = (c: GuildMember, i: number, k: 'cand' | 'app', note = '') => memRowHtml(card(c, bondOf(G.save, c.nick)), {
    attrs: `data-${k}="${i}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on: st.sheet?.k === k && st.sheet.i === i, tag: note,
    extra: side(`data-${k === 'cand' ? 'hire' : 'hireapp'}="${i}"`, '영입'),
  });
  const days = (until: string) => { const d = daysBetween(dayKey(), until) + 1; return d <= 1 ? '오늘까지' : `${d}일`; };
  const waitRows = g.storyWait.map(k => { const s = STORY[k], p = profileOf(s.nick, s.pers); return memRowHtml(card({ nick: s.nick, cls: s.cls, pers: s.pers, ab: s.ab, lv: topLevel(G.save), stats: { ...p.stats, ...s.boost } as GuildMember['stats'] }, 2), {
    tag: '초대 대기', extra: side(`data-istory="${k}"`, '초대') }); }).join('');
  const nf = fr.length + g.storyWait.length;
  const friendSec: Sec = {
    key: 'friend', icon: IC.scout(), title: '친구 초대', meta: pill('', '무료', 'free'), sum: `${nf}명`, dot: g.storyWait.length > 0,
    body: nf ? `<ul class="pcards g-list">${waitRows}${fr.map(friendRow).join('')}</ul>` : '<p class="g-empty0">초대할 친구 없음<br><small>공개모집에서 함께 이길수록 인연이 쌓입니다.</small></p>',
    tip: `<p>인연 ${bondName(FRIEND_LV)} 이상인 모험가를 무료로 부릅니다. 공개모집에서 함께 이기고 살려 줄수록 인연이 쌓입니다. 예전 길드원은 키운 그대로 돌아옵니다.</p>`,
  };
  // 공고: 모집 (역할) · 명문 (직업, 길드 Lv 4) 하나를 골라 버튼 하나로
  const elite = cap.lv >= POSTS.elite.guildLv, kind: PostKind = st.pkind === 'elite' && elite ? 'elite' : 'normal';
  const cost = postCost(G.save, kind), count = postCands(G.save, kind);
  const seg = `<div class="g-seg" role="group" aria-label="공고 종류">
      <button type="button" data-pkind="normal" aria-pressed="${kind === 'normal'}">모집 공고</button>
      <button type="button" data-pkind="elite" aria-pressed="${kind === 'elite'}"${elite ? '' : ' disabled'}>명문 공고${elite ? '' : `<small>${LOCK}길드 Lv ${POSTS.elite.guildLv}</small>`}</button></div>`;
  const chips = kind === 'elite'
    ? RECRUIT_CLASSES.map(k => `<button type="button" class="g-chip" data-pickcls="${k}" aria-pressed="${st.cls === k}">${CLASSES[k].name}</button>`).join('')
    : ROLE_PICK.map(([k, n]) => `<button type="button" class="g-chip" data-role="${k}" aria-pressed="${st.role === k}">${n}</button>`).join('');
  const facts = kind === 'elite'
    ? `${pill(IC.members(), `${postCands(G.save, 'elite')}명`, '', '지원자')}${pill('', '희귀 확률 ×2')}`
    : `${pill(IC.members(), `${postCands(G.save, 'normal')}명`, '', '지원자')}${pill('', `Lv ${Math.max(1, my - 5)}+`)}`;
  const post = g.post;
  const cands = post ? `<p class="g-subh">${IC.members()}<b>지원자 ${post.cands.length}명</b><small>${POSTS[post.kind].name} · 1명만 영입</small></p>
      <ul class="pcards g-list">${post.cands.map((c, i) => candRow(c, i, 'cand')).join('')}</ul>` : '';
  const postSec: Sec = {
    key: 'post', icon: IC.post(), title: '공고', meta: goldCost(gold), sum: post ? `${post.cands.length}명 대기` : '새 모집', dot: !!post?.cands.length,
    body: `${cands}<div class="g-body">${seg}<div class="g-chips${kind === 'elite' ? ' g-cls' : ''}" role="group" aria-label="${kind === 'elite' ? '직업' : '역할'}">${chips}</div>
      <div class="g-postgo"><span class="g-facts">${facts}${facLv(G.save, 'post') >= 3 ? pill('', '모집소 할인 20%', 'free') : ''}</span><button class="btn primary" type="button" data-post="${kind}"${isFull || gold < cost ? ' disabled' : ''}>${post ? '새 공고' : '공고 내기'}<small>${goldCost(cost)}</small></button></div>
      ${gold < cost ? `<p class="g-empty0">골드 ${fmt(cost - gold)} 부족</p>` : ''}
      ${postReplace && post ? `<div class="g-confirm" role="group" aria-label="새 공고 확인"><p>현재 지원자 ${post.cands.length}명이 돌아갑니다.</p><button class="btn2" type="button" id="cancelPost">취소</button><button class="btn primary" type="button" data-confirm-post="${kind}"${isFull || gold < cost ? ' disabled' : ''}>교체 · ${count}명 모집 ${goldCost(cost)}</button></div>` : ''}</div>`,
    tip: `<p><b>모집 공고</b> 역할을 고르면 지원자 ${postCands(G.save, 'normal')}명 (Lv ${Math.max(1, my - 5)} 이상).</p><p><b>명문 공고</b> 길드 Lv ${POSTS.elite.guildLv}부터. 직업을 고르면 지원자 ${postCands(G.save, 'elite')}명, 희귀 성격 · 좋은 스킬이 2배.</p><p>새 공고를 내면 지금 지원자는 돌아갑니다. 지원자 가운데 1명만 영입하고, 영입은 추가 비용이 없습니다. 처음 보는 사람은 능력 ★만 보입니다.</p>`,
  };

  const appSec: Sec | null = cap.lv >= 2 ? {
    key: 'app', icon: IC.fame(), title: '명성 지원자', meta: `${g.apps.length}명`, sum: `${g.apps.length}명`, dot: g.apps.length > 0,
    body: g.apps.length ? `<ul class="pcards g-list">${g.apps.map((a, i) => candRow(a.m, i, 'app', days(a.until))).join('')}</ul>` : '<p class="g-empty0">내일 새로 옴</p>',
    tip: '<p>길드 명성을 보고 날마다 새로 찾아옵니다. 머무는 기간은 이름 옆에 표시됩니다. 모집소를 올리면 더 오래 머뭅니다.</p>',
  } : null;
  return `${isFull ? `<p class="warnbox g-full">정원 ${g.members.length} / ${cap.cap} 가득<small>길드 레벨을 올리면 정원이 늘어납니다.</small></p>` : ''}${hub([friendSec, postSec, appSec, rosterSec()].filter((x): x is Sec => !!x))}`;
}

// ---------- 아래 시트 (편성 화면 파티원 시트와 같은 모양) ----------
function sheetBox(label: string, inner: string): string {
  return `<div class="sheet-dim" data-shut></div><section class="sheet g-msheet" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><span class="grip"></span>
    ${inner}${st.msg ? `<p class="warnbox g-smsg" role="status">${esc(st.msg)}</p>` : ''}<button class="btn2 f-shut" type="button" data-shut>닫기</button></section>`;
}
const sheetHead = (m: CardData, tip = '') => `<h2 class="h-rule">${esc(m.nick)}<span class="rule"></span><span class="cap">${CLASSES[m.cls].name}${m.lv ? ` · Lv ${m.lv}` : ''}</span>${tip ? infoBtn(tip, m.nick) : ''}</h2>`;

function sheetHtml(): string {
  const x = st.sheet;
  if (!x) return '';
  const g = G.save.guild, isFull = full(G.save);
  if (x.k === 'cand' || x.k === 'app') {
    const c = x.k === 'cand' ? g.post?.cands[x.i] : g.apps[x.i]?.m;
    if (!c) return '';
    const d = card(c, bondOf(G.save, c.nick));
    return sheetBox(`${c.nick} 상세`, `${sheetHead(d)}${memDetailHtml(d)}
      <button class="btn primary g-sact" type="button" data-${x.k === 'cand' ? 'hire' : 'hireapp'}="${x.i}"${isFull ? ' disabled' : ''}>영입<small>${isFull ? '정원 가득' : '추가 비용 없음'}</small></button>`);
  }
  if (x.k === 'friend') {
    // 친구 초대 줄 · 명부 줄 (93 3-4): 친구면 초대, 아니면 능력 ★만 (인연 안개)
    const f = friendsOf(G.save).find(y => y.nick === x.nick), person = personOf(x.nick);
    if (!f && !person) return '';
    const p = f?.away ?? f?.person ?? person!, lv = f?.away ? f.away.lv : worldLevel(G.save, f?.person ?? person!), stats = f?.away ? f.away.stats : (f?.person ?? person!).fm.stats;
    const d = card({ nick: x.nick, cls: p.cls, pers: p.pers, ab: p.ab, lv, stats }, bondOf(G.save, x.nick));
    return sheetBox(`${x.nick} 상세`, `${sheetHead(d)}${f?.away ? `<p class="g-chips">${pill('', '예전 길드원 · 키운 그대로')}</p>` : ''}${memDetailHtml(d)}
      <button class="btn primary g-sact" type="button" data-invite="${esc(x.nick)}"${!f || isFull ? ' disabled' : ''}>초대<small>${!f ? `인연 ${bondName(FRIEND_LV)}부터` : isFull ? '정원 가득' : '무료'}</small></button>`);
  }
  const m = memberById(x.id);
  if (!m) return '';
  return sheetBox(`${m.nick} 상세`, detailHtml(m));
}

/** 길드원 상세 (시트 안): 레벨 · 인연 막대 → 능력치 · 직업 스킬 · 성격 → 골드 지원 · 내보내기. 규칙은 ⓘ */
function detailHtml(m: GuildMember): string {
  const b = bondOf(G.save, m.nick), star = starOfBond(b), a = ABILITIES[m.ab];
  const need = xpToNext(m.lv), xpPct = isFinite(need) ? Math.min(100, (m.xp / need) * 100) : 100;
  const next = b >= 12 ? null : BOND_STEPS[b + 1], pt = bondPt(G.save, m.nick);
  const fx = a ? starFx(a, star) : null;
  const gold = resourceBalance(G.save, 'gold');
  const per = statPerLevel(m.learn), cap = statCap(m.lv), pot = statPot(m.learn), sw = sponsorWhy(G.save, m), sg = sponsorGold(m.lv);
  const d = card(m, b, star, true);
  const meters = `<div class="g-meters">
      <p class="g-meter"><span class="k">Lv ${m.lv}</span>${bar(xpPct, `경험치 ${Math.floor(xpPct)}%`)}<small>${isFinite(need) ? `${Math.floor(xpPct)}%` : '최대'}</small></p>
      <p class="g-meter"><span class="k">${bondIconSvg(b)}인연 ${b}</span>${bar(next ? (pt / next) * 100 : 100, `인연 ${Math.floor(pt)} / ${next ?? '최고'}`)}<small>${next ? `${fmt(Math.floor(pt))} / ${fmt(next)}` : '최고'}</small></p></div>`;
  const act = (attr: string, ic: string, label: string, sub: string, dis: boolean) => `<button class="btn" type="button" ${attr}${dis ? ' disabled' : ''}><span class="g-ai">${ic}</span><b>${label}</b><small>${sub}</small></button>`;
  return `${sheetHead(d, 'msheet')}
    ${tipBox('msheet', `<p><b>레벨</b> 함께 이긴 판마다 경험치 (내 레벨까지). 쉬는 판은 30%, 골드 지원 중에는 출전만큼 받습니다. 지원은 한 번에 ${SPONSOR.runs}판이며, 남은 횟수를 모두 쓰면 다시 지원할 수 있습니다.</p>
      <p><b>능력치</b> 레벨이 오를 때 오릅니다. 다음 한 칸까지 레벨 ${Math.max(1, Math.ceil((1 - m.sxp) / per - 1e-9))} · 상한 ${cap} · 칸마다 타고난 값에서 +${pot}까지.</p>
      ${a ? `<p><b>직업 스킬 LV ${star} / 5</b>${fx && star ? ` 효과 ×${fx.eff.toFixed(2)}${fx.cd < 1 ? ` · 쿨 ×${fx.cd.toFixed(1)}` : ''}.` : ''} 인연 Lv 4 · 6 · 8 · 10에서 오릅니다.${star >= 5 ? ` LV 5: ${STAR5[a.kind]}` : ''}</p>` : ''}
      <p><b>공략 숙지</b> 함께 이긴 전투마다 그 전투에서 반응 · 회피가 좋아집니다.</p>`)}
    ${meters}
    ${memDetailHtml(d)}
    <div class="g-acts">
      ${act('data-sponsor aria-haspopup="dialog"', IC.sponsor(), m.boost > 0 ? '지원 중' : '골드 지원', m.boost > 0 ? `${m.boost}판 남음` : sw || goldCost(sg), !!sw || gold < sg)}
      ${act('data-release aria-haspopup="dialog"', IC.release(), '내보내기', '친구 목록으로', !!m.story)}
    </div>`;
}

/** 상세 위의 확인창: 확인하기 전에는 골드와 길드원 상태를 바꾸지 않는다. */
function memberConfirmHtml(): string {
  const action = st.ask, m = action && memberById(action.id);
  if (!action || !m || st.sheet?.k !== 'mem' || st.sheet.id !== m.id) { st.ask = null; return ''; }
  const support = action.kind === 'sponsor';
  const disabled = support ? !!sponsorWhy(G.save, m) || resourceBalance(G.save, 'gold') < sponsorGold(m.lv) : !!m.story;
  return `<button type="button" class="sheet-dim g-action-dim" data-shut aria-label="확인 취소" tabindex="-1"></button>
    <section class="sheet g-action-confirm" role="dialog" aria-modal="true" aria-labelledby="guildConfirmTitle" aria-describedby="guildConfirmDesc">
      <h3 id="guildConfirmTitle">${support ? '골드 지원' : '내보내기'}</h3>
      <div class="g-action-member"><b>${esc(m.nick)}</b><span>${CLASSES[m.cls].name} · Lv ${m.lv}</span></div>
      <p id="guildConfirmDesc">${support ? '전투에 참여하지 않아도 경험치를 소량 획득합니다. 후원하시겠습니까?' : '길드에서 내보냅니다.'}</p>
      ${support ? `<div class="g-action-cost"><span>${SPONSOR.runs}판 지원</span>${goldCost(sponsorGold(m.lv))}</div>` : '<p class="g-action-note">친구 목록으로 이동하며 인연과 성장은 유지됩니다.</p>'}
      <div class="g-action-buttons"><button type="button" data-shut>취소</button><button type="button" class="${support ? 'primary' : 'danger'}" data-gconfirm${disabled ? ' disabled' : ''}>확인</button></div>
    </section>`;
}

function confirmMemberAction(): void {
  const action = st.ask;
  st.ask = null;
  if (!action || st.sheet?.k !== 'mem' || st.sheet.id !== action.id) return;
  const m = memberById(action.id);
  if (m) {
    if (action.kind === 'sponsor') st.msg = sponsor(G.save, m.id) || `골드 지원 · ${m.boost}판 남음`;
    else if (!m.story && release(G.save, m.id)) {
      st.sheet = null;
      st.msg = `${m.nick}(${CLASSES[m.cls].name}) 친구 목록으로 · 인연은 그대로`;
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
  if (st.ask) st.ask = null;
  else { st.sheet = null; st.tip = null; }
  render();
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const save = G.save;
  if (t.closest('[data-shut]')) { closeSheet(); return; }
  const confirm = t.closest<HTMLButtonElement>('[data-gconfirm]');
  if (confirm) { if (!confirm.disabled) confirmMemberAction(); return; }
  if (st.ask) return;
  const dest = t.closest<HTMLButtonElement>('[data-goto]');
  if (dest) {
    const c = CONTENT.find(c => c.key === dest.dataset.goto);
    const diff = dest.dataset.gdiff;
    if (c && (diff === '쉬움' || diff === '보통' || diff === '어려움' || diff === '악몽')) { Flow.preferGuild = true; go('s-content', { content: c.key, diff }); }
    return;
  }
  const mr = t.closest<HTMLButtonElement>('[data-mrole]');
  if (mr) { memberView.role = mr.dataset.mrole as PostRole; render(); return; }
  if (t.closest('#cancelPost')) { postReplace = false; render(); return; }
  // ⓘ 설명: 누르면 펼치고 다시 누르면 접음
  const tip = t.closest<HTMLElement>('[data-tip]');
  if (tip) { const k = tip.dataset.tip!; st.tip = st.tip === k ? null : k; render(); return; }
  const cs = t.closest<HTMLElement>('[data-csel]');
  if (cs) { st.csel = cs.dataset.csel!; st.tip = null; postReplace = false; render(); return; }
  const pk = t.closest<HTMLButtonElement>('[data-pkind]');
  if (pk) { if (!pk.disabled) { st.pkind = pk.dataset.pkind as PostKind; postReplace = false; render(); } return; }
  if (t.closest('#goalGo')) { go('s-missions'); return; }
  if (t.closest('#found')) { foundGuild(save); commit(); render(); return; }
  if (t.closest('#sponsorRest')) { const n = restSponsor(save).ids.length; st.msg = sponsorRest(save) || `쉬는 길드원 ${n}명 후원 · 한 사람 5판`; commit(); render(); return; }
  if (t.closest('#storyOk')) { save.guild.storySeen = true; commit(); render(); return; }
  // 「길드파티로 출전」: 전투 탭(모험 고르기) → 편성이 길드파티로 시작 (game/flow.ts)
  if (t.closest('#guildGo') && save.guild.members.length) { Flow.preferGuild = true; go('s-content'); return; }
  if (t.closest('#arriveOk')) { save.guild.storyCard = null; commit(); render(); return; }
  if (t.closest('#expedChest')) { const r = claimExped(save, Math.random, Date.now()); st.msg = typeof r === 'string' ? r : `원정 상자: 골드 ${fmt(r.gold ?? 0)} · 장비 ${r.items?.length ?? 0}`; commit(); render(); return; }
  const fc = t.closest<HTMLButtonElement>('[data-fac]');
  if (fc) { if (!fc.disabled) { const k = fc.dataset.fac as FacKey; st.msg = buildFac(save, k) || `${FAC[k].name} ${facLv(save, k)}단계`; commit(); render(); } return; }
  const is = t.closest<HTMLButtonElement>('[data-istory]');
  if (is) { if (!is.disabled) { st.msg = inviteStory(save, is.dataset.istory as StoryKey) || '초대 완료 · 「길드원」에서 확인'; commit(); render(); } return; }
  if (t.closest('#roster')) { st.roster = !st.roster; render(); return; }
  if (t.closest('#rfriend')) { st.rfriend = !st.rfriend; render(); return; }
  const rr = t.closest<HTMLElement>('[data-rrole]');
  if (rr) { st.rrole = rr.dataset.rrole as PostRole; render(); return; }
  const role = t.closest<HTMLElement>('[data-role]');
  if (role) { st.role = role.dataset.role as PostRole; render(); return; }
  const pc = t.closest<HTMLElement>('[data-pickcls]');
  if (pc) { st.cls = pc.dataset.pickcls as ClassKey; render(); return; }
  const post = t.closest<HTMLButtonElement>('[data-post], [data-confirm-post]');
  if (post) {
    if (!post.disabled) {
      if (save.guild.post && !post.dataset.confirmPost) { postReplace = true; render(); return; }
      const kind = (post.dataset.confirmPost ?? post.dataset.post) as PostKind;
      st.msg = postRecruit(save, kind, kind === 'elite' ? st.cls : st.role, Math.random);
      postReplace = false; commit(); render();
    }
    return;
  }
  const inv = t.closest<HTMLButtonElement>('[data-invite]');
  if (inv) { if (!inv.disabled) { const err = inviteFriend(save, inv.dataset.invite!); st.sheet = null; st.msg = err || '초대 완료 · 「길드원」에서 확인'; commit(); render(); } return; }
  const h = t.closest<HTMLButtonElement>('[data-hire]');
  if (h) { if (!h.disabled) { const err = hire(save, Number(h.dataset.hire)); st.sheet = null; st.msg = err || '영입 완료 · 「길드원」에서 확인'; commit(); render(); } return; }
  const ha = t.closest<HTMLButtonElement>('[data-hireapp]');
  if (ha) { if (!ha.disabled) { const err = hireApp(save, Number(ha.dataset.hireapp)); st.sheet = null; st.msg = err || '영입 완료 · 「길드원」에서 확인'; commit(); render(); } return; }
  const x = st.sheet;
  if (x?.k === 'mem' && t.closest('.g-msheet')) {
    const button = t.closest<HTMLButtonElement>('[data-sponsor], [data-release]');
    if (button && !button.disabled) { st.ask = { kind: button.hasAttribute('data-sponsor') ? 'sponsor' : 'release', id: x.id }; render(); }
    return;
  }
  const sub = t.closest<HTMLElement>('[data-sub]');
  if (sub) { st.sub = sub.dataset.sub as Sub; st.sheet = null; st.ask = null; st.tip = null; st.csel = ''; postReplace = false; render(); s.el.querySelector<HTMLElement>('.ns-body')?.scrollTo({ top: 0 }); return; }
  const mem = t.closest<HTMLElement>('[data-mem]');
  if (mem) { openSheet({ k: 'mem', id: Number(mem.dataset.mem) }, `[data-mem="${mem.dataset.mem}"]`); return; }
  const fr = t.closest<HTMLElement>('[data-friend]');
  if (fr) { openSheet({ k: 'friend', nick: fr.dataset.friend! }, `[data-friend="${fr.dataset.friend}"]`); return; }
  const cand = t.closest<HTMLElement>('[data-cand]');
  if (cand) { openSheet({ k: 'cand', i: Number(cand.dataset.cand) }, `[data-cand="${cand.dataset.cand}"]`); return; }
  const app = t.closest<HTMLElement>('[data-app]');
  if (app) openSheet({ k: 'app', i: Number(app.dataset.app) }, `[data-app="${app.dataset.app}"]`);
});

// 누를 수 있는 줄 (role="button")은 Enter·Space로도, Esc = 시트 닫기
s.el.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  if (e.key === 'Escape' && st.sheet) { closeSheet(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && t.matches('[role="button"]:not(button)')) { e.preventDefault(); t.click(); }
});

// 정렬은 현재 길드원 목록에만 적용하며 저장된 편성은 바꾸지 않는다.
s.el.addEventListener('change', e => {
  const el = e.target;
  if (el instanceof HTMLSelectElement && el.id === 'guildSort') { memberView.sort = el.value === 'bond' ? 'bond' : 'level'; render(); }
});
