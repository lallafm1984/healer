/**
 * 길드 탭 (09 S12~S14, 02 9장, 17 8장). Lv 15에 열림.
 * 2026-10-18 Lim 「길드컨텐츠의 페이지부터 관련된 모든것의 ui를 다른컨텐츠와 일관성을 유지하면서 개선」:
 * 나무 게시판 · 양피지 쪽지 (30 시안 「길드 게시판」) 대신 상점 · 임무 · 편성과 같은 길드 홀 돌색 한 벌 (--gk-*, guild-hall.css).
 *  위 = 상점과 같은 하위 탭 (현황 · 길드원 · 영입) + 길드 홀 그림 머리 (ui-guild, 길드 이름 · Lv · 정원 · 명성),
 *  현황 = 길드원 (전투력 순 4명) · 주간 목표 · 영입 요약 카드 + 아래 붉은 「길드파티로 출전」,
 *  길드원 = 편성 화면과 같은 파티원 줄 → 누르면 아래 시트 (능력 · 자질 · 성격 · 육성 포인트 · 훈련 · 방출),
 *  영입 = 상점 상품 줄 같은 모집 공고 셋 · 지원자 · 인연 스카우트 (줄을 누르면 같은 시트, 「영입」 버튼).
 */
import { resourceBalance } from '../game/resources';
import { ABILITIES, STAR5, starFx } from '../data/abilities';
import { CLASSES } from '../data/classes';
import { APT_NAMES, aptOf, guildCap, pointCost, pointsAt, pointsUsed, POSTS, REROLL_GOLD, RESET_GOLD, SCOUT_GOLD, trainCost, type GuildMember, type PostTier } from '../data/guild';
import { GUILD_GOAL } from '../data/missions';
import { GUILD_LEVEL, MAX_LEVEL, xpToNext } from '../data/progression';
import { Flow } from '../game/flow';
import { capOf, guildOpen, hire, postRecruit, powerOf, release, rerollAbility, resetPoints, scoutHire, spendPoint, train } from '../game/guild';
import { commit, G, refreshDay } from '../game/state';
import { topLevel, type Scout } from '../platform/storage';
import { memDetailHtml, memRowHtml, type CardData } from './members';
import { esc, fmt, go, screen, topBar } from './kit';
import { currencyAmount, gameIcon, LOCK, uiIcon } from './art';
import { sheetDialog } from './dialog';

type Sub = 'home' | 'members' | 'recruit';
const SUBS: [Sub, string][] = [['home', '현황'], ['members', '길드원'], ['recruit', '영입']];
/** 열린 시트: 길드원 · 공고 지원자 · 인연 스카우트 */
type Sheet = { k: 'mem'; id: number } | { k: 'cand'; i: number } | { k: 'scout'; i: number } | null;
const st: { sub: Sub; sheet: Sheet; msg: string; ask: number | null } = { sub: 'home', sheet: null, msg: '', ask: null };

const s = screen('s-guild', '길드', { tab: 'guild', enter() { refreshDay(); st.sub = 'home'; st.sheet = null; st.msg = ''; st.ask = null; render(); } });
s.el.classList.add('g-hall');
const modal = sheetDialog(s.el, closeSheet);

/** 출전 문양 (길드 탭 깃발 그림이 없을 때), 오른쪽 화살표 */
const svg = (d: string, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const FLAG = svg('<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>');
const ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.4).replace('<svg', '<svg class="g-arrow"');
const goldCost = (value: number) => currencyAmount('gold', value);
/** 길드 그림 (2026-10-18 Codex): 모집 공고 · 인연 스카우트 · 명성. 없으면 선 아이콘 */
const IC = {
  post: () => gameIcon('guild-post', uiIcon('quest')),
  scout: () => gameIcon('guild-scout', uiIcon('hands')),
  fame: () => gameIcon('guild-fame', uiIcon('star')),
  flag: () => gameIcon('guild', FLAG, 'tab'),
};

const ptsLeft = (m: GuildMember) => Math.max(0, pointsAt(m.lv) - pointsUsed(m));
const memberById = (id: number) => G.save.guild.members.find(m => m.id === id);

/** 위: 하위 탭 (상점과 같은 .subtabs). 영입 = 공고 지원자 빨간 점 */
function tabs(): string {
  const g = G.save.guild, cap = capOf(G.save), cands = g.post?.cands.length || 0;
  const extra: Record<Sub, string> = {
    home: '',
    members: ` <small>${g.members.length}/${cap.cap}</small>`,
    recruit: cands ? `<i class="rdot" aria-label="지원자 ${cands}명"></i>` : '',
  };
  return `<nav class="subtabs" role="tablist" aria-label="길드 메뉴">${SUBS.map(([k, n]) => `<button type="button" role="tab" data-sub="${k}" aria-selected="${st.sub === k}">${n}${extra[k]}</button>`).join('')}</nav>`;
}

/** 길드 홀 그림 머리 (상점 선반 그림과 같은 .art-hero): 길드 이름 · 지금 하위 탭 · Lv · 정원 · 명성 */
function hero(title: string, stats = true): string {
  const g = G.save.guild, cap = capOf(G.save);
  return `<header class="art-hero guild-hero"><div class="ah-copy"><p class="eyebrow">${stats ? `길드 「${esc(g.name)}」` : '길드 홀'}</p><h2>${title}</h2></div>
    ${stats ? `<p class="gh-stats"><span>길드 Lv ${cap.lv}</span><span>정원 ${g.members.length}/${cap.cap}</span><span class="gh-fame">${IC.fame()}명성 ${fmt(g.fame)}</span></p>` : ''}</header>`;
}

/** 정원: 지금 단계 (몇 레벨에 몇 명) · 다음 단계 */
function capSteps(): { now: { lv: number; cap: number }; next: { lv: number; cap: number } | null } {
  const P = topLevel(G.save), cap = capOf(G.save).cap;
  let lv = P;
  while (lv > 1 && guildCap(lv - 1).cap === cap) lv--;
  let next: { lv: number; cap: number } | null = null;
  for (let l = P + 1; l <= MAX_LEVEL; l++) if (guildCap(l).cap > cap) { next = { lv: l, cap: guildCap(l).cap }; break; }
  return { now: { lv: Math.max(GUILD_LEVEL, lv), cap }, next };
}
const RULE = '길드원 레벨은 내 레벨까지, 길드 평균보다 낮으면 경험치 2배입니다.';

function render(): void {
  modal.beforeRender();
  const body = s.el.querySelector<HTMLElement>('.ns-body');
  const keep = body && body.dataset.view === st.sub ? body.scrollTop : 0;
  const open = guildOpen(G.save);
  if (!open.ok) {
    st.sheet = null;
    s.el.innerHTML = `${topBar({ settings: true })}<div class="ns-body guild g-lock">${hero('길드', false)}${lockHtml(open.why)}</div>`;
    modal.sync(null, []);
    return;
  }
  const view = st.sub === 'home' ? homeHtml() : st.sub === 'members' ? membersHtml() : recruitHtml();
  const sheet = sheetHtml();
  if (!sheet) st.sheet = null;
  const title = SUBS.find(([k]) => k === st.sub)![1];
  s.el.innerHTML = `${topBar({ settings: true })}${tabs()}
    <div class="ns-body guild g-${st.sub}">
      ${hero(title)}
      ${open.dev ? `<p class="note g-dev">개발 빌드: 레벨 잠금 무시로 열림 (원래 Lv ${GUILD_LEVEL})</p>` : ''}
      ${st.msg && !sheet ? `<p class="warnbox">${esc(st.msg)}</p>` : ''}
      ${view}
    </div>
    ${st.sub === 'home' ? `<footer class="ns-foot g-foot">${ctaHtml()}</footer>` : ''}
    ${sheet}`;
  const nb = s.el.querySelector<HTMLElement>('.ns-body');
  if (nb) { nb.dataset.view = st.sub; nb.scrollTop = keep; }
  modal.sync(st.sheet ? s.el.querySelector<HTMLElement>('.sheet') : null, st.sheet ? [sheetKey(st.sheet)] : []);
  st.msg = '';
}
const sheetKey = (x: NonNullable<Sheet>) => `${x.k}:${'id' in x ? x.id : x.i}`;

/** 잠김 (Lv 15 전 · 튜토리얼 중): 열리면 할 수 있는 것 셋 */
function lockHtml(why: string): string {
  const feat = (icon: string, name: string, line: string) => `<li class="srow g-feat"><span class="sic">${icon}</span><div><b>${name}</b><p class="note">${line}</p></div></li>`;
  return `<section class="panel g-lockp"><h4 class="lockline">${LOCK}${esc(why)}<small>지금 Lv ${topLevel(G.save)}</small></h4>
      <p class="note">길드원을 영입하고 키워서 직접 편성합니다.</p></section>
    <ul class="slist">
      ${feat(IC.post(), '영입', '골드 모집 공고 · 공개모집에서 잘 살려 준 파티원 스카우트')}
      ${feat(IC.fame(), '육성', '훈련으로 레벨, 육성 포인트로 자질과 능력 ★')}
      ${feat(IC.flag(), '길드파티', '길드원으로 편성해 출전 · 주간 목표로 명성')}
    </ul>`;
}

/** 길드원 줄 (편성 화면과 같은 memRowHtml): 오른쪽 = 전투력 · 남은 육성 포인트 */
function memberRow(m: GuildMember): string {
  const p = ptsLeft(m), on = st.sheet?.k === 'mem' && st.sheet.id === m.id;
  const side = `<span class="g-side"><b>${fmt(powerOf(m))}</b><small>전투력</small>${p ? `<i class="g-pts" aria-label="남은 육성 포인트 ${p}">+${p}</i>` : ''}</span>`;
  return memRowHtml({ ...m, apt: aptOf(m) }, { attrs: `data-mem="${m.id}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on, extra: side });
}
const byPower = () => G.save.guild.members.slice().sort((a, b) => powerOf(b) - powerOf(a));

// ---------- 현황 ----------
function homeHtml(): string {
  const g = G.save.guild, cap = capOf(G.save), n = g.members.length;
  const w = G.save.weekly.guild, need = GUILD_GOAL.need;
  const top = byPower().slice(0, 4);
  const mem = n
    ? `<section class="pn g-list"><ul class="pcards">${top.map(memberRow).join('')}</ul>
        ${n > top.length ? `<button class="g-more" type="button" data-sub="members">길드원 ${n}명 모두 보기 ${uiIcon('arrow')}</button>` : ''}</section>`
    : `<section class="panel g-empty"><p>아직 길드원 없음</p><p class="note">「영입」에서 골드 모집 공고를 내거나, 공개모집에서 잘 살려 준 파티원을 스카우트합니다.</p>
        <button class="btn" type="button" data-sub="recruit">영입하러 가기</button></section>`;
  const done = w.got || w.n >= need;
  const goal = `<section class="panel g-goal"><h4>주간 목표 <small>월요일 오전 6시 새로</small></h4>
      <div class="g-goalrow"><span class="sic">${IC.fame()}</span><div><b>길드파티로 클리어</b>
        <span class="bar" role="img" aria-label="${Math.min(w.n, need)} / ${need}"><i style="width:${Math.min(100, (w.n / need) * 100).toFixed(0)}%"></i></span></div>
        <small class="${done ? 'ok' : ''}">${w.got ? `달성 · 명성 +${GUILD_GOAL.fame} 받음` : `${Math.min(w.n, need)} / ${need} · 명성 +${GUILD_GOAL.fame}`}</small></div>
      ${w.n >= need && !w.got ? '<p class="note">임무 화면에서 명성을 받습니다.</p>' : ''}</section>`;
  const full = n >= cap.cap, minGold = Math.min(...Object.values(POSTS).map(p => p.gold)), sc = g.scouts[0];
  const recRow = (icon: string, name: string, line: string, act: string) => `<li class="srow g-recrow" role="button" tabindex="0" data-sub="recruit"><span class="sic">${icon}</span><div><b>${name}</b><p class="note">${line}</p></div><span class="g-go">${act}${uiIcon('arrow')}</span></li>`;
  const rec = `<h3 class="sec">영입 <small>정원 ${n}/${cap.cap}${full ? ' · 가득' : ''}</small></h3>
    <ul class="slist">
      ${g.post ? recRow(IC.post(), '모집 공고', `${POSTS[g.post.tier].name} 공고 · 지원자 ${g.post.cands.length}명 중 1명 영입`, '고르기')
        : recRow(IC.post(), '모집 공고', full ? '정원이 다 참' : `공고 없음 · ${goldCost(minGold)}부터`, full ? '보기' : '공고 내기')}
      ${recRow(IC.scout(), '인연 스카우트', sc ? `대기 ${g.scouts.length}명 · ${esc(sc.nick)} (${CLASSES[sc.cls].name})` : '대기 없음 · 공개모집 S · A 클리어 때 생김', '보기')}
    </ul>`;
  const cs = capSteps();
  return `<h3 class="sec">길드원 <small>${n}/${cap.cap} · 숫자 = 전투력 · 누르면 육성</small></h3>${mem}${goal}${rec}
    <p class="note g-rule">정원 Lv ${cs.now.lv}부터 ${cs.now.cap}명${cs.next ? ` · 다음 Lv ${cs.next.lv}에 ${cs.next.cap}명` : ' · 최대 정원'}. ${RULE}</p>`;
}

/** 아래 붉은 주 버튼 (전투 탭 「출전」과 같은 결): 길드원이 있으면 길드파티로 출전, 없으면 영입 */
function ctaHtml(): string {
  const n = G.save.guild.members.length, w = G.save.weekly.guild, need = GUILD_GOAL.need;
  return n
    ? `<button type="button" class="g-cta" id="guildGo"><span class="g-mk"><span>${IC.flag()}</span></span><span class="g-ct"><b>길드파티로 출전</b><small>주간 목표 ${Math.min(w.n, need)}/${need} · 모험 고르기</small></span>${ARROW}</button>`
    : `<button type="button" class="g-cta" id="guildGo" data-sub="recruit"><span class="g-mk"><span>${IC.flag()}</span></span><span class="g-ct"><b>영입하러 가기</b><small>길드원이 있어야 길드파티</small></span>${ARROW}</button>`;
}

// ---------- 길드원 ----------
function membersHtml(): string {
  const g = G.save.guild, cap = capOf(G.save);
  if (!g.members.length) return `<section class="panel g-empty"><p>아직 길드원 없음</p><p class="note">「영입」에서 골드 모집 공고를 내거나, 공개모집에서 잘 살려 준 파티원을 스카우트합니다.</p>
    <button class="btn" type="button" data-sub="recruit">영입하러 가기</button></section>`;
  const anyPts = g.members.some(m => ptsLeft(m) > 0);
  return `<h3 class="sec">길드원 <small>${g.members.length}/${cap.cap} · 전투력 순 (노란 숫자)</small></h3>
    <section class="pn g-list"><ul class="pcards">${byPower().map(memberRow).join('')}</ul></section>
    <p class="note g-rule">누르면 육성 · 훈련.${anyPts ? ' 초록 숫자 = 남은 육성 포인트.' : ''} ${RULE}</p>`;
}

// ---------- 영입 ----------
function recruitHtml(): string {
  const g = G.save.guild, cap = capOf(G.save), full = g.members.length >= cap.cap, gold = resourceBalance(G.save, 'gold');
  const tiers = Object.keys(POSTS) as PostTier[];
  const post = g.post;
  const tierRow = (t: PostTier) => `<li class="srow g-tier" data-tier="${t}"><span class="sic">${IC.post()}</span><div><b>${POSTS[t].name} 공고</b><p class="note">${esc(POSTS[t].desc)}</p></div>
    <div class="sbuy"><button class="btn mini primary" type="button" data-post="${t}"${full || gold < POSTS[t].gold ? ' disabled' : ''}>${goldCost(POSTS[t].gold)}</button></div></li>`;
  const status = full ? '정원이 다 찼습니다.' : post ? '새 공고를 내면 지금 지원자는 돌아갑니다.' : gold < POSTS.normal.gold ? `골드 부족 · 보유 ${fmt(gold)}` : '지원자 3명 중 1명 영입 · 영입은 추가 비용 없음';
  const candRow = (c: GuildMember, i: number) => memRowHtml({ ...c, apt: aptOf(c) }, {
    attrs: `data-cand="${i}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on: st.sheet?.k === 'cand' && st.sheet.i === i,
    extra: `<span class="g-side"><b>${fmt(powerOf(c))}</b><small>전투력</small><button class="btn mini primary" type="button" data-hire="${i}"${full ? ' disabled' : ''}>영입</button></span>`,
  });
  const scoutRow = (c: Scout, i: number) => memRowHtml({ ...c, apt: c.apt0 }, {
    attrs: `data-scoutrow="${i}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on: st.sheet?.k === 'scout' && st.sheet.i === i, note: `${esc(c.from)}에서`,
    extra: `<span class="g-side"><button class="btn mini primary" type="button" data-scout="${i}"${full || gold < SCOUT_GOLD ? ' disabled' : ''}>${goldCost(SCOUT_GOLD)}</button></span>`,
  });
  return `<h3 class="sec">골드 모집 공고 <small>정원 ${g.members.length}/${cap.cap}</small></h3>
    <ul class="slist">${tiers.map(tierRow).join('')}</ul>
    <p class="note g-status">${status}</p>
    ${post ? `<h3 class="sec">지원자 ${post.cands.length}명 <small>${POSTS[post.tier].name} 공고 · 1명만 영입 · 숫자 = 전투력 · 누르면 상세</small></h3>
      <section class="pn g-list"><ul class="pcards">${post.cands.map(candRow).join('')}</ul></section>` : ''}
    <h3 class="sec">인연 스카우트 <small>${goldCost(SCOUT_GOLD)} · 대기 ${g.scouts.length}명</small></h3>
    ${g.scouts.length ? `<section class="pn g-list"><ul class="pcards">${g.scouts.map(scoutRow).join('')}</ul></section>`
      : '<p class="note">공개모집으로 S · A 등급 클리어를 하면, 살아남은 파티원 중 내 힐을 가장 많이 받은 사람이 여기 남습니다.</p>'}`;
}

// ---------- 아래 시트 (편성 화면 파티원 시트와 같은 모양) ----------
function sheetBox(label: string, inner: string): string {
  return `<div class="sheet-dim" data-shut></div><section class="sheet g-msheet" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><span class="grip"></span>
    ${inner}${st.msg ? `<p class="warnbox g-smsg" role="status">${esc(st.msg)}</p>` : ''}<button class="btn2 f-shut" type="button" data-shut>닫기</button></section>`;
}
const sheetHead = (m: CardData) => `<h2 class="h-rule">${esc(m.nick)}<span class="rule"></span><span class="cap">${CLASSES[m.cls].name}${m.lv ? ` · Lv ${m.lv}` : ''}${m.power ? ` · 전투력 ${fmt(m.power)}` : ''}</span></h2>`;

function sheetHtml(): string {
  const x = st.sheet;
  if (!x) return '';
  const g = G.save.guild, full = g.members.length >= capOf(G.save).cap;
  if (x.k === 'cand') {
    const c = g.post?.cands[x.i];
    if (!c) return '';
    const d: CardData = { ...c, apt: aptOf(c), power: powerOf(c) };
    return sheetBox(`${c.nick} 상세`, `${sheetHead(d)}${memDetailHtml(d)}
      <button class="btn primary g-sact" type="button" data-hire="${x.i}"${full ? ' disabled' : ''}>영입<small>${full ? '정원 가득' : '추가 비용 없음'}</small></button>`);
  }
  if (x.k === 'scout') {
    const c = g.scouts[x.i];
    if (!c) return '';
    const gold = resourceBalance(G.save, 'gold');
    const d: CardData = { ...c, apt: c.apt0 };
    return sheetBox(`${c.nick} 상세`, `${sheetHead(d)}<p class="note">${esc(c.from)}에서 함께 싸운 파티원</p>${memDetailHtml(d)}
      <button class="btn primary g-sact" type="button" data-scout="${x.i}"${full || gold < SCOUT_GOLD ? ' disabled' : ''}>영입<small>${full ? '정원 가득' : goldCost(SCOUT_GOLD)}</small></button>`);
  }
  const m = memberById(x.id);
  if (!m) return '';
  return sheetBox(`${m.nick} 육성`, detailHtml(m));
}

/** 길드원 육성 (시트 안): 경험치 · 능력 · 자질 · 성격 → 육성 포인트 → 훈련 · 다시 뽑기 · 초기화 · 방출 */
function detailHtml(m: GuildMember): string {
  const a = ABILITIES[m.ab], apt = aptOf(m), pts = pointsAt(m.lv) - pointsUsed(m), pc = pointCost(m.lv);
  const fx = starFx(a, m.star);
  const need = xpToNext(m.lv), xpPct = isFinite(need) ? Math.min(100, (m.xp / need) * 100) : 100;
  const atCap = m.lv >= topLevel(G.save);
  const gold = resourceBalance(G.save, 'gold');
  const btn = (attr: string, label: string, sub: string, dis: boolean, cls = '') => `<button class="btn${cls ? ` ${cls}` : ''}" type="button" ${attr}${dis ? ' disabled' : ''}>${label}<small>${sub}</small></button>`;
  const d: CardData = { ...m, apt, power: powerOf(m) };
  return `${sheetHead(d)}
    <p class="g-xp"><span>경험치</span><span class="bar"><i style="width:${xpPct.toFixed(0)}%"></i></span><small>${fmt(m.xp)} / ${isFinite(need) ? fmt(need) : '최대'} · 출전 ${m.runs}번</small></p>
    ${memDetailHtml(d)}
    <p class="note">능력 ★${m.star}/5${m.star ? ` · 효과 ×${fx.eff.toFixed(2)}${fx.cd < 1 ? ` · 쿨 ×${fx.cd.toFixed(1)}` : ''}${fx.early ? ' · 조금 일찍 씀' : ''}` : ''}${m.star >= 5 ? ` · ★5: ${STAR5[a.kind]}` : ''} · 쓰는 때: ${esc(a.when)}</p>
    <h4 class="g-sh">육성 포인트 <small>남은 ${pts}점 · Lv 20부터 10레벨마다 1점 (최대 9)</small></h4>
    <div class="gbtns">
      ${[0, 1, 2].map(i => btn(`data-pt="${i}"`, `${APT_NAMES[i]} +1`, apt[i] >= 5 ? '최대' : goldCost(pc), !pts || apt[i] >= 5 || gold < pc)).join('')}
      ${btn('data-pt="star"', '능력 ★+1', m.star >= 5 ? '최대' : goldCost(pc), !pts || m.star >= 5 || gold < pc)}
    </div>
    <h4 class="g-sh">관리 <small>보유 ${goldCost(gold)}</small></h4>
    <div class="gbtns">
      ${btn('data-train', '훈련 +1 Lv', atCap ? '내 레벨까지' : goldCost(trainCost(m.lv)), atCap || gold < trainCost(m.lv), 'primary')}
      ${btn('data-reroll', '능력 다시 뽑기', goldCost(REROLL_GOLD), gold < REROLL_GOLD)}
      ${btn('data-reset', '포인트 초기화', goldCost(RESET_GOLD), !pointsUsed(m) || gold < RESET_GOLD)}
      ${btn('data-release', st.ask === m.id ? '한 번 더 누르면 방출' : '방출', st.ask === m.id ? '되돌릴 수 없음' : '길드에서 내보냄', false, st.ask === m.id ? 'danger' : 'ghost')}
    </div>`;
}

function openSheet(x: NonNullable<Sheet>, from: string): void {
  s.el.querySelector<HTMLElement>(from)?.focus({ preventScroll: true });
  st.sheet = x; st.ask = null; st.msg = ''; render();
}
function closeSheet(): void { st.sheet = null; st.ask = null; render(); }

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const save = G.save;
  if (t.closest('[data-shut]')) { closeSheet(); return; }
  // 「길드파티로 출전」: 전투 탭(모험 고르기) → 편성이 길드파티로 시작 (game/flow.ts)
  if (t.closest('#guildGo') && save.guild.members.length) { Flow.preferGuild = true; go('s-content'); return; }
  const post = t.closest<HTMLButtonElement>('[data-post]');
  if (post) { if (!post.disabled) { st.msg = postRecruit(save, post.dataset.post as PostTier, Math.random); commit(); render(); } return; }
  const h = t.closest<HTMLButtonElement>('[data-hire]');
  if (h) { if (!h.disabled) { const err = hire(save, Number(h.dataset.hire)); st.sheet = null; st.msg = err || '영입 완료 · 「길드원」에서 확인'; commit(); render(); } return; }
  const sc = t.closest<HTMLButtonElement>('[data-scout]');
  if (sc) { if (!sc.disabled) { const err = scoutHire(save, Number(sc.dataset.scout)); st.sheet = null; st.msg = err || '영입 완료 · 「길드원」에서 확인'; commit(); render(); } return; }
  const x = st.sheet;
  if (x?.k === 'mem' && t.closest('.g-msheet')) {
    const id = x.id;
    const pt = t.closest<HTMLButtonElement>('[data-pt]');
    if (pt) st.msg = spendPoint(save, id, pt.dataset.pt === 'star' ? 'star' : (Number(pt.dataset.pt) as 0 | 1 | 2));
    else if (t.closest('[data-train]')) st.msg = train(save, id);
    else if (t.closest('[data-reroll]')) { const before = memberById(id)?.ab; st.msg = rerollAbility(save, id, Math.random); const m = memberById(id); if (!st.msg && m) st.msg = `새 능력: ${ABILITIES[m.ab].name}${m.ab === before ? ' (같은 능력)' : ''}`; }
    else if (t.closest('[data-reset]')) st.msg = resetPoints(save, id);
    else if (t.closest('[data-release]')) {
      if (st.ask !== id) { st.ask = id; render(); return; }
      const m = memberById(id);
      release(save, id); st.sheet = null; st.ask = null;
      st.msg = m ? `${m.nick}(${CLASSES[m.cls].name}) 방출` : '';
    } else return;
    commit(); render(); return;
  }
  const sub = t.closest<HTMLElement>('[data-sub]');
  if (sub) { st.sub = sub.dataset.sub as Sub; st.sheet = null; st.ask = null; render(); s.el.querySelector<HTMLElement>('.ns-body')?.scrollTo({ top: 0 }); return; }
  const mem = t.closest<HTMLElement>('[data-mem]');
  if (mem) { openSheet({ k: 'mem', id: Number(mem.dataset.mem) }, `[data-mem="${mem.dataset.mem}"]`); return; }
  const cand = t.closest<HTMLElement>('[data-cand]');
  if (cand) { openSheet({ k: 'cand', i: Number(cand.dataset.cand) }, `[data-cand="${cand.dataset.cand}"]`); return; }
  const srow = t.closest<HTMLElement>('[data-scoutrow]');
  if (srow) openSheet({ k: 'scout', i: Number(srow.dataset.scoutrow) }, `[data-scoutrow="${srow.dataset.scoutrow}"]`);
});

// 누를 수 있는 줄 (role="button")은 Enter·Space로도, Esc = 시트 닫기
s.el.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  if (e.key === 'Escape' && st.sheet) { closeSheet(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && t.matches('[role="button"]:not(button)')) { e.preventDefault(); t.click(); }
});
