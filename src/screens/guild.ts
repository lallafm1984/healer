/**
 * 길드 탭 (길드 v2 `93` · FM `97`, 사슬 4번). Lv 15에 결성 이야기로 열림.
 * #233 모양 그대로 (상점 · 편성과 같은 길드 홀 돌색, guild-hall.css): 위 = 하위 탭 (현황 · 길드원 · 영입) + 길드 홀 그림 머리 (이름 · Lv · 정원 · 명성).
 *  현황 = 결성 이야기 (한 번) · 길드원 (레벨 순 4명) · 주간 목표 · 기록 · 영입 요약 + 아래 붉은 「길드파티로 출전」,
 *  길드원 = 편성과 같은 파티원 줄 → 아래 시트 (능력치 숫자 · 레벨 · 능력치 경험 · 직업 스킬 ★ · 스킬 다시 뽑기 · 보내기),
 *  영입 = 친구 초대 · 모집 공고 (역할) · 명문 공고 (직업, 길드 Lv 4) · 지원자 · 명성 지원자. 줄을 누르면 같은 시트 (인연 안개: 친구 = 범위, 처음 = 능력 ★만).
 * 육성 포인트 · 훈련 · 자질 · 전투력 숫자 · 인연 스카우트는 없앰 (97: 크는 길은 출전 경험뿐).
 */
import { resourceBalance } from '../game/resources';
import { ABILITIES, STAR5, starFx } from '../data/abilities';
import { CLASSES, RECRUIT_CLASSES, type ClassKey } from '../data/classes';
import { CONTENT, type ContentDef } from '../data/content';
import { PARTY_POOL, STORY_NICKS } from '../data/nicknames';
import { ENCOUNTERS, type EncounterKey } from '../data/encounters';
import { BOND_STEPS, bondLv, bondName, FRIEND_LV, POSTS, postGold, rerollGold, sponsorGold, starOfBond, statCap, statPerLevel, statPot, type GuildMember, type PostKind, type PostRole } from '../data/guild';
import { GUILD_GOAL } from '../data/missions';
import { GUILD_LEVEL, xpToNext } from '../data/progression';
import { dayKey, daysBetween } from '../game/clock';
import { Flow } from '../game/flow';
import { bondOf, bondPt, capOf, foundGuild, knowStages, personOf, restSponsor, sponsor, sponsorRest, sponsorWhy, friendsOf, full, guildOpen, hire, hireApp, inviteFriend, postRecruit, refreshApps, release, rerollAbility, worldLevel } from '../game/guild';
import { commit, G, refreshDay } from '../game/state';
import { topLevel } from '../platform/storage';
import { memDetailHtml, memRowHtml, type CardData } from './members';
import { esc, fmt, go, screen, topBar } from './kit';
import { currencyAmount, gameIcon, LOCK, uiIcon } from './art';
import { sheetDialog } from './dialog';

type Sub = 'home' | 'members' | 'recruit';
const SUBS: [Sub, string][] = [['home', '현황'], ['members', '길드원'], ['recruit', '영입']];
/** 열린 시트: 길드원 · 친구 · 공고 지원자 · 명성 지원자 */
type Sheet = { k: 'mem'; id: number } | { k: 'friend'; nick: string } | { k: 'cand'; i: number } | { k: 'app'; i: number } | null;
const st: { sub: Sub; sheet: Sheet; msg: string; ask: number | null; role: PostRole; cls: ClassKey; roster: boolean; rrole: PostRole; rfriend: boolean } = { sub: 'home', sheet: null, msg: '', ask: null, role: 'any', cls: 'warrior', roster: false, rrole: 'any', rfriend: false };

const s = screen('s-guild', '길드', { tab: 'guild', enter() { refreshDay(); if (G.save.guild.founded) { refreshApps(G.save, Math.random); commit(); } st.sub = 'home'; st.sheet = null; st.msg = ''; st.ask = null; render(); } });
s.el.classList.add('g-hall');
const modal = sheetDialog(s.el, closeSheet);

/** 출전 문양 (길드 탭 깃발 그림이 없을 때), 오른쪽 화살표 */
const svg = (d: string, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const FLAG = svg('<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>');
const ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.4).replace('<svg', '<svg class="g-arrow"');
const goldCost = (value: number) => currencyAmount('gold', value);
/** 길드 그림 (2026-10-18 Codex): 모집 공고 · 인연 (예전 스카우트 그림) · 명성. 없으면 선 아이콘 */
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const IC = {
  first: () => gameIcon('first-kill', uiIcon('star')),
  post: () => gameIcon('guild-post', uiIcon('quest')),
  scout: () => gameIcon('guild-scout', uiIcon('hands')),
  fame: () => gameIcon('guild-fame', uiIcon('star')),
  flag: () => gameIcon('guild', FLAG, 'tab'),
};
const ROLE_PICK: [PostRole, string][] = [['tank', '탱커'], ['melee', '근접'], ['ranged', '원거리'], ['any', '아무나']];

const memberById = (id: number) => G.save.guild.members.find(m => m.id === id);
/** 줄 · 시트에 넘길 사람 (인연 Lv에 따라 안개) */
const card = (m: Pick<GuildMember, 'nick' | 'cls' | 'pers' | 'ab' | 'lv' | 'stats'>, bond: number, star = 0, member = false): CardData => ({ nick: m.nick, cls: m.cls, pers: m.pers, ab: m.ab, lv: m.lv, star, fm: { stats: m.stats }, bond, member });

/** 위: 하위 탭 (상점과 같은 .subtabs). 영입 = 지원자 빨간 점 */
function tabs(): string {
  const g = G.save.guild, cap = capOf(G.save), cands = (g.post?.cands.length || 0) + g.apps.length;
  const extra: Record<Sub, string> = {
    home: '',
    members: ` <small>${g.members.length}/${cap.cap}</small>`,
    recruit: cands ? `<i class="rdot" aria-label="지원자 ${cands}명"></i>` : '',
  };
  return `<nav class="subtabs" role="tablist" aria-label="길드 메뉴">${SUBS.map(([k, n]) => `<button type="button" role="tab" data-sub="${k}" aria-selected="${st.sub === k}">${n}${extra[k]}</button>`).join('')}</nav>`;
}

/** 길드 홀 그림 머리 (상점 선반 그림과 같은 .art-hero): 길드 이름 · 지금 하위 탭 · Lv · 정원 · 명성 (다음 Lv까지 막대) */
function hero(title: string, stats = true): string {
  const g = G.save.guild, cap = capOf(G.save);
  const prev = cap.lv > 1 ? [0, 20, 60, 120, 200, 320, 480, 700, 1200, 2000][cap.lv - 1] : 0;
  const pct = cap.next ? Math.min(100, ((g.fame - prev) / (cap.next - prev)) * 100) : 100;
  return `<header class="art-hero guild-hero"><div class="ah-copy"><p class="eyebrow">${stats ? `길드 「${esc(g.name)}」` : '길드 홀'}</p><h2>${title}</h2></div>
    ${stats ? `<p class="gh-stats"><span class="gh-lv">${gameIcon('guild-flag', '')}길드 Lv ${cap.lv}</span><span>정원 ${g.members.length}/${cap.cap}</span><span class="gh-fame">${IC.fame()}명성 ${fmt(g.fame)}${cap.next ? `<small>/${fmt(cap.next)}</small>` : ''}</span></p>
      <span class="gh-bar" role="img" aria-label="다음 길드 Lv까지 ${Math.round(pct)}%"><i style="width:${pct.toFixed(0)}%"></i></span>` : ''}</header>`;
}

function render(): void {
  modal.beforeRender();
  const body = s.el.querySelector<HTMLElement>('.ns-body');
  const keep = body && body.dataset.view === st.sub ? body.scrollTop : 0;
  const open = guildOpen(G.save);
  if (!open.ok || !G.save.guild.founded) {
    st.sheet = null;
    s.el.innerHTML = `${topBar({ settings: true })}<div class="ns-body guild g-lock">${hero('길드', false)}${open.ok ? foundHtml() : lockHtml(open.why)}</div>`;
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
const sheetKey = (x: NonNullable<Sheet>) => `${x.k}:${'id' in x ? x.id : 'nick' in x ? x.nick : x.i}`;

/** 잠김 (Lv 15 전 · 튜토리얼 중): 열리면 할 수 있는 것 셋 */
function lockHtml(why: string): string {
  const feat = (icon: string, name: string, line: string) => `<li class="srow g-feat"><span class="sic">${icon}</span><div><b>${name}</b><p class="note">${line}</p></div></li>`;
  return `<section class="panel g-lockp"><h4 class="lockline">${LOCK}${esc(why)}<small>지금 Lv ${topLevel(G.save)}</small></h4>
      <p class="note">공개모집에서 살려 준 모험가들과 원정대를 만듭니다.</p></section>
    <ul class="slist">
      ${feat(IC.scout(), '인연', '함께 이길수록 쌓임 · 친구가 되면 초대')}
      ${feat(IC.post(), '영입', '모집 공고 · 명성 지원자')}
      ${feat(IC.flag(), '길드파티', '함께 출전할수록 레벨 · 능력치가 오름')}
    </ul>`;
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
  return memRowHtml(card(m, b, starOfBond(b), true), { attrs: `data-mem="${m.id}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on, gold: m.boost ? `후원 ${m.boost}` : '' });
}
const byLevel = () => G.save.guild.members.slice().sort((a, b) => b.lv - a.lv || bondPt(G.save, b.nick) - bondPt(G.save, a.nick));

// ---------- 현황 ----------
function homeHtml(): string {
  const g = G.save.guild, cap = capOf(G.save), n = g.members.length;
  const w = G.save.weekly.guild, need = GUILD_GOAL.need;
  const story = g.storySeen ? '' : `<section class="panel g-story"><p class="g-story-line">그동안 살려 준 모험가들이 모였다.</p><p class="g-story-line">「이 힐러 놓치면 안 돼.」</p>
      <p class="g-story-name"><b>${esc(g.name)}</b> 결성 · ${g.members.slice(0, 4).map(m => esc(m.nick)).join(' · ')}</p><button class="btn2" type="button" id="storyOk">확인</button></section>`;
  const top = byLevel().slice(0, 4);
  const mem = `<section class="pn g-list"><ul class="pcards">${top.map(memberRow).join('')}</ul>
        ${n > top.length ? `<button class="g-more" type="button" data-sub="members">길드원 ${n}명 모두 보기 ${uiIcon('arrow')}</button>` : ''}</section>`;
  const done = w.got || w.n >= need;
  const goal = `<section class="panel g-goal"><h4>주간 목표 <small>월요일 오전 6시 새로</small></h4>
      <div class="g-goalrow"><span class="sic">${IC.fame()}</span><div><b>길드파티로 클리어</b>
        <span class="bar" role="img" aria-label="${Math.min(w.n, need)} / ${need}"><i style="width:${Math.min(100, (w.n / need) * 100).toFixed(0)}%"></i></span></div>
        <small class="${done ? 'ok' : ''}">${w.got ? `달성 · 명성 +${GUILD_GOAL.fame} 받음` : `${Math.min(w.n, need)} / ${need} · 명성 +${GUILD_GOAL.fame} · 출전한 길드원 인연 +2`}</small></div>
      ${w.n >= need && !w.got ? '<p class="note">임무 화면에서 명성을 받습니다.</p>' : ''}</section>`;
  const users = Object.values(G.save.users), buddies = users.filter(u => u.pt >= BOND_STEPS[12]).length;
  const friends = friendsOf(G.save).length;
  const rec = `<section class="panel g-rec"><h4>기록</h4><ul class="g-recs">
      <li><b>${fmt(g.wins)}</b><small>길드파티 승리</small></li><li><b>${g.firsts.length}</b><small>길드 첫 처치</small></li>
      <li><b>${users.length}</b><small>만난 모험가</small></li><li><b>${friends}</b><small>친구</small></li><li><b>${buddies}</b><small>단짝</small></li></ul>
      ${firstsHtml()}${raidHtml()}</section>`;
  const recRow = (icon: string, name: string, line: string, act: string) => `<li class="srow g-recrow" role="button" tabindex="0" data-sub="recruit"><span class="sic">${icon}</span><div><b>${name}</b><p class="note">${line}</p></div><span class="g-go">${act}${uiIcon('arrow')}</span></li>`;
  const isFull = n >= cap.cap;
  const recs = `<h3 class="sec">영입 <small>정원 ${n}/${cap.cap}${isFull ? ' · 가득' : ''}</small></h3>
    <ul class="slist">
      ${recRow(IC.scout(), '친구 초대', friends ? `친구 ${friends}명 · 무료` : '공개모집에서 함께 이기면 친구가 생김', '보기')}
      ${g.post ? recRow(IC.post(), POSTS[g.post.kind].name, `지원자 ${g.post.cands.length}명 중 1명 영입`, '고르기') : recRow(IC.post(), '모집 공고', isFull ? '정원이 다 참' : `${goldCost(postGold('normal', topLevel(G.save)))} · 역할 고름`, isFull ? '보기' : '공고 내기')}
      ${cap.lv >= 2 ? recRow(IC.fame(), '명성 지원자', g.apps.length ? `${g.apps.length}명 대기` : '날마다 새로 · 사흘 머묾', '보기') : ''}
    </ul>`;
  return `${story}<h3 class="sec">길드원 <small>${n}/${cap.cap} · 레벨 순 · 누르면 능력치</small></h3>${mem}${goal}${rec}${recs}
    <p class="note g-rule">길드원은 함께 이긴 판마다 레벨 경험치와 능력치 경험을 얻습니다. 레벨은 내 레벨까지, 쉬는 길드원도 경험치 30%.</p>`;
}

/** 아래 붉은 주 버튼 (전투 탭 「출전」과 같은 결) */
function ctaHtml(): string {
  const w = G.save.weekly.guild, need = GUILD_GOAL.need;
  return `<button type="button" class="g-cta" id="guildGo"><span class="g-mk"><span>${IC.flag()}</span></span><span class="g-ct"><b>길드파티로 출전</b><small>주간 목표 ${Math.min(w.n, need)}/${need} · 모험 고르기</small></span>${ARROW}</button>`;
}

/** 서버 유저 명부 (93 3-4): 만난 모험가 n/1000 · 친구 · 길드원 · 단짝, 펼치면 인연 순 (역할 · 친구만 거르기, 40명까지) */
const POOL_N = Object.values(PARTY_POOL).reduce((t, l) => t + l.length, 0);
function rosterHtml(): string {
  const all = Object.entries(G.save.users), inG = new Set(G.save.guild.members.map(m => m.nick));
  const n = (f: (lv: number) => boolean) => all.filter(([, u]) => f(bondLv(u.pt))).length;
  const head = `<h3 class="sec">명부 <small>만난 모험가 ${all.length}/${POOL_N} · 친구 ${n(l => l >= FRIEND_LV)} · 길드원 ${inG.size} · 단짝 ${n(l => l >= 12)}</small></h3>`;
  const toggle = `<button class="g-more g-roster" type="button" id="roster" aria-expanded="${st.roster}">${st.roster ? '명부 접기' : '명부 펼치기'} ${uiIcon('arrow')}</button>`;
  if (!st.roster) return `${head}<section class="pn g-list">${toggle}</section>`;
  const rows = all.map(([nick, u]) => ({ nick, u, p: personOf(nick) })).filter(x => x.p && !inG.has(x.nick) && !STORY_NICKS.includes(x.nick))
    .filter(x => (st.rrole === 'any' || CLASSES[x.p!.cls].role === st.rrole) && (!st.rfriend || bondLv(x.u.pt) >= FRIEND_LV))
    .sort((a, b) => b.u.pt - a.u.pt || b.u.wins - a.u.wins);
  const chips = ROLE_PICK.map(([k, nm]) => `<button type="button" class="g-chip" data-rrole="${k}" aria-pressed="${st.rrole === k}">${k === 'any' ? '모두' : nm}</button>`).join('')
    + `<button type="button" class="g-chip" id="rfriend" aria-pressed="${st.rfriend}">친구만</button>`;
  const row = (x: (typeof rows)[number]) => memRowHtml(card({ nick: x.nick, cls: x.p!.cls, pers: x.p!.pers, ab: x.p!.ab, lv: worldLevel(G.save, x.p!), stats: x.p!.fm.stats }, bondLv(x.u.pt)), {
    attrs: `data-friend="${esc(x.nick)}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', tag: `이긴 판 ${x.u.wins}`,
  });
  return `${head}<div class="g-chips" role="group" aria-label="명부 거르기">${chips}</div>
    <section class="pn g-list"><ul class="pcards">${rows.slice(0, 40).map(row).join('') || '<li class="note g-r0">해당하는 모험가 없음</li>'}</ul>${rows.length > 40 ? `<p class="note g-rmore">외 ${rows.length - 40}명</p>` : ''}${toggle}</section>`;
}

/** 기록판 (93 9-3): 최근 길드 첫 처치 3개 (장소 · 난이도 · 날짜 · 걸린 시간 · 함께한 길드원 5명까지) */
function firstsHtml(): string {
  const log = G.save.guild.firstLog.slice(-3).reverse();
  if (!log.length) return '<p class="note g-first0">길드파티로 던전 · 레이드를 처음 깨면 여기에 남습니다.</p>';
  const row = (x: (typeof log)[number]) => {
    const [key, diff] = x.key.split('|'), c = CONTENT.find(y => y.key === key);
    const who = x.nicks.slice(0, 5).map(esc).join(' · ') + (x.nicks.length > 5 ? ` 외 ${x.nicks.length - 5}명` : '');
    return `<li class="g-first"><span class="sic">${IC.first()}</span><div><b>${esc(c?.name ?? key)} <small>${esc(diff)}</small></b><p class="note">${esc(x.day.slice(5).replace('-', '.'))} · ${mmss(x.sec)} · ${who}</p></div></li>`;
  };
  return `<h5 class="g-rech">길드 첫 처치 <small>최근</small></h5><ul class="g-firsts">${log.map(row).join('')}</ul>`;
}
/** 레이드 진척 (93 9-3): 10인 · 20인 × 난이도, 길드 첫 처치한 곳 수 (다 깨면 금빛) */
function raidHtml(): string {
  const raids = CONTENT.filter(c => c.kind === 'raid' && c.ready && !c.hidden), g = G.save.guild;
  const sizes = [10, 20].map(n => ({ n, list: raids.filter(c => c.size('보통') === n) })).filter(x => x.list.length);
  if (!sizes.length) return '';
  const DIFFS = ['쉬움', '보통', '어려움', '악몽'] as const;
  const cell = (list: ContentDef[], d: string) => { const k = list.filter(c => g.firsts.includes(`${c.key}|${d}`)).length; return `<td class="${k === list.length ? 'all' : k ? 'some' : ''}">${k}/${list.length}</td>`; };
  return `<h5 class="g-rech">레이드 진척 <small>길드 첫 처치</small></h5><table class="g-raid"><thead><tr><th></th>${DIFFS.map(d => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>${sizes.map(x => `<tr><th>${x.n}인</th>${DIFFS.map(d => cell(x.list, d)).join('')}</tr>`).join('')}</tbody></table>`;
}

// ---------- 길드원 ----------
function membersHtml(): string {
  const g = G.save.guild, cap = capOf(G.save);
  const rs = restSponsor(G.save), gold = resourceBalance(G.save, 'gold');
  return `<h3 class="sec">길드원 <small>${g.members.length}/${cap.cap} · 레벨 순 · ♥ 숫자 = 인연 Lv</small></h3>
    ${rs.ids.length ? `<button class="btn g-rest" type="button" id="sponsorRest"${gold < rs.gold ? ' disabled' : ''}>쉬는 길드원 모두 후원 ${rs.ids.length}명<small>${goldCost(rs.gold)} · 한 사람 5판</small></button>` : ''}
    <section class="pn g-list"><ul class="pcards">${byLevel().map(memberRow).join('')}</ul></section>
    <p class="note g-rule">누르면 능력치 · 후원 · 스킬 다시 뽑기 · 보내기. 후원하면 쉬는 판에도 출전만큼 경험치를 받습니다. 직업 스킬 ★는 인연 Lv 4 · 6 · 8 · 10에서 오릅니다.</p>`;
}

// ---------- 영입 ----------
function recruitHtml(): string {
  const g = G.save.guild, cap = capOf(G.save), isFull = full(G.save), gold = resourceBalance(G.save, 'gold'), my = topLevel(G.save);
  const fr = friendsOf(G.save);
  const friendRow = (f: (typeof fr)[number]) => {
    const p = f.away ?? f.person!, lv = f.away ? f.away.lv : worldLevel(G.save, f.person!), stats = f.away ? f.away.stats : f.person!.fm.stats;
    return memRowHtml(card({ nick: f.nick, cls: p.cls, pers: p.pers, ab: p.ab, lv, stats }, bondOf(G.save, f.nick)), {
      attrs: `data-friend="${esc(f.nick)}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on: st.sheet?.k === 'friend' && st.sheet.nick === f.nick, tag: f.away ? '예전 길드원' : '',
      extra: `<span class="g-side"><button class="btn mini primary" type="button" data-invite="${esc(f.nick)}"${isFull ? ' disabled' : ''}>초대</button></span>`,
    });
  };
  const elite = cap.lv >= POSTS.elite.guildLv;
  const ng = postGold('normal', my), eg = postGold('elite', my);
  const chips = ROLE_PICK.map(([k, n]) => `<button type="button" class="g-chip" data-role="${k}" aria-pressed="${st.role === k}">${n}</button>`).join('');
  const clsChips = RECRUIT_CLASSES.map(k => `<button type="button" class="g-chip" data-pickcls="${k}" aria-pressed="${st.cls === k}">${CLASSES[k].name}</button>`).join('');
  const post = g.post;
  const candRow = (c: GuildMember, i: number, k: 'cand' | 'app', note = '') => memRowHtml(card(c, bondOf(G.save, c.nick)), {
    attrs: `data-${k}="${i}" role="button" tabindex="0" aria-haspopup="dialog"`, cls: 'tap', on: st.sheet?.k === k && st.sheet.i === i, tag: note,
    extra: `<span class="g-side"><button class="btn mini primary" type="button" data-${k === 'cand' ? 'hire' : 'hireapp'}="${i}"${isFull ? ' disabled' : ''}>영입</button></span>`,
  });
  const days = (until: string) => { const d = daysBetween(dayKey(), until) + 1; return d <= 1 ? '오늘까지' : `${d}일 남음`; };
  return `<h3 class="sec">친구 초대 <small>무료 · 인연 ${bondName(FRIEND_LV)} 이상 · 정원 ${g.members.length}/${cap.cap}</small></h3>
    ${fr.length ? `<section class="pn g-list"><ul class="pcards">${fr.map(friendRow).join('')}</ul></section>` : '<p class="note">공개모집에서 함께 이기고 살려 줄수록 인연이 쌓여 친구가 됩니다.</p>'}
    ${rosterHtml()}
    <h3 class="sec">모집 공고 <small>지원자 ${POSTS.normal.cands}명 · Lv ${Math.max(1, my - 5)} 이상</small></h3>
    <div class="g-post"><div class="g-chips" role="group" aria-label="역할">${chips}</div>
      <button class="btn primary" type="button" data-post="normal"${isFull || gold < ng ? ' disabled' : ''}>공고 내기<small>${goldCost(ng)}</small></button></div>
    <h3 class="sec">명문 공고 <small>${elite ? `지원자 ${POSTS.elite.cands}명 · 직업 고름 · 희귀 성격 · 스킬 2배` : `${LOCK}길드 Lv ${POSTS.elite.guildLv}에 열림`}</small></h3>
    ${elite ? `<div class="g-post"><div class="g-chips" role="group" aria-label="직업">${clsChips}</div>
      <button class="btn primary" type="button" data-post="elite"${isFull || gold < eg ? ' disabled' : ''}>공고 내기<small>${goldCost(eg)}</small></button></div>` : ''}
    <p class="note g-status">${isFull ? '정원이 다 찼습니다.' : post ? '새 공고를 내면 지금 지원자는 돌아갑니다.' : `보유 ${fmt(gold)} 골드 · 영입은 추가 비용 없음`}</p>
    ${post ? `<h3 class="sec">지원자 ${post.cands.length}명 <small>${POSTS[post.kind].name} · 1명만 영입 · 처음 보는 사람은 능력 ★만</small></h3>
      <section class="pn g-list"><ul class="pcards">${post.cands.map((c, i) => candRow(c, i, 'cand')).join('')}</ul></section>` : ''}
    ${cap.lv >= 2 ? `<h3 class="sec">명성 지원자 <small>날마다 새로 · 사흘 머묾 · 레벨 상관없이</small></h3>
      ${g.apps.length ? `<section class="pn g-list"><ul class="pcards">${g.apps.map((a, i) => candRow(a.m, i, 'app', days(a.until))).join('')}</ul></section>` : '<p class="note">내일 다시 옵니다.</p>'}` : ''}`;
}

// ---------- 아래 시트 (편성 화면 파티원 시트와 같은 모양) ----------
function sheetBox(label: string, inner: string): string {
  return `<div class="sheet-dim" data-shut></div><section class="sheet g-msheet" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><span class="grip"></span>
    ${inner}${st.msg ? `<p class="warnbox g-smsg" role="status">${esc(st.msg)}</p>` : ''}<button class="btn2 f-shut" type="button" data-shut>닫기</button></section>`;
}
const sheetHead = (m: CardData) => `<h2 class="h-rule">${esc(m.nick)}<span class="rule"></span><span class="cap">${CLASSES[m.cls].name}${m.lv ? ` · Lv ${m.lv}` : ''}</span></h2>`;

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
    const u = G.save.users[x.nick];
    return sheetBox(`${x.nick} 상세`, `${sheetHead(d)}<p class="note">함께 이긴 판 ${u?.wins ?? 0} · 살려 준 횟수 ${u?.saved ?? 0} · 만난 판 ${u?.met ?? 0}${f?.away ? ' · 예전 길드원 (키운 그대로)' : ''}</p>${memDetailHtml(d)}
      ${f ? `<button class="btn primary g-sact" type="button" data-invite="${esc(x.nick)}"${isFull ? ' disabled' : ''}>초대<small>${isFull ? '정원 가득' : '무료'}</small></button>` : `<p class="note">친구 (인연 ${bondName(FRIEND_LV)})가 되면 초대 · 능력치 범위</p>`}`);
  }
  const m = memberById(x.id);
  if (!m) return '';
  return sheetBox(`${m.nick} 상세`, detailHtml(m));
}

/** 길드원 상세 (시트 안): 레벨 경험치 · 능력치 숫자 (역할 핵심 굵게) · 능력치 경험 · 직업 스킬 ★ (인연) · 성격 → 스킬 다시 뽑기 · 보내기 */
function detailHtml(m: GuildMember): string {
  const b = bondOf(G.save, m.nick), star = starOfBond(b), a = ABILITIES[m.ab];
  const need = xpToNext(m.lv), xpPct = isFinite(need) ? Math.min(100, (m.xp / need) * 100) : 100;
  const next = b >= 12 ? null : BOND_STEPS[b + 1], pt = bondPt(G.save, m.nick);
  const fx = a ? starFx(a, star) : null;
  const gold = resourceBalance(G.save, 'gold'), rg = rerollGold(topLevel(G.save));
  const per = statPerLevel(m.learn), cap = statCap(m.lv), pot = statPot(m.learn), sw = sponsorWhy(G.save, m), sg = sponsorGold(m.lv);
  const btn = (attr: string, label: string, sub: string, dis: boolean, cls = '') => `<button class="btn${cls ? ` ${cls}` : ''}" type="button" ${attr}${dis ? ' disabled' : ''}>${label}<small>${sub}</small></button>`;
  const d = card(m, b, star, true);
  return `${sheetHead(d)}
    <p class="g-xp"><span>경험치</span><span class="bar"><i style="width:${xpPct.toFixed(0)}%"></i></span><small>${fmt(m.xp)} / ${isFinite(need) ? fmt(need) : '최대'} · 출전 ${m.runs}번 · 내 레벨까지</small></p>
    <p class="g-xp"><span>인연</span><span class="bar"><i style="width:${next ? Math.min(100, (pt / next) * 100).toFixed(0) : 100}%"></i></span><small>${bondName(b)} Lv ${b} · ${next ? `다음 ${fmt(pt)} / ${fmt(next)}` : '최고'}</small></p>
    ${memDetailHtml(d)}
    <p class="note">능력치: 레벨업할 때 오름 · 다음 한 칸까지 레벨 ${Math.max(1, Math.ceil((1 - m.sxp) / per - 1e-9))} (학습력) · 상한 ${cap} (Lv에 따라) · 칸마다 타고난 값에서 +${pot}까지</p>
    ${knowHtml(m)}
    ${recordHtml(m)}
    ${a ? `<p class="note">직업 스킬 ★${star}/5${fx && star ? ` · 효과 ×${fx.eff.toFixed(2)}${fx.cd < 1 ? ` · 쿨 ×${fx.cd.toFixed(1)}` : ''}` : ''}${star >= 5 ? ` · ★5: ${STAR5[a.kind]}` : ' · 인연이 깊어지면 오름'} · 쓰는 때: ${esc(a.when)}</p>` : ''}
    <h4 class="g-sh">관리 <small>보유 ${goldCost(gold)}</small></h4>
    <div class="gbtns">
      ${btn('data-sponsor', '후원', sw ? sw : `${goldCost(sg)} · 5판`, !!sw || gold < sg, 'primary g-wide')}
      ${btn('data-reroll', '스킬 다시 뽑기', m.story ? '고유 스킬' : goldCost(rg), !!m.story || gold < rg)}
      ${btn('data-release', st.ask === m.id ? '한 번 더 누르면 보냄' : '보내기', st.ask === m.id ? (m.boost ? `후원 ${m.boost}판 남음 · 돌려주지 않음` : '인연은 그대로') : '친구 목록으로', !!m.story, st.ask === m.id ? 'danger' : 'ghost')}
    </div>
    <p class="note g-boost">${m.boost ? `후원 ${m.boost}판 남음 · 쉬는 판에도 출전만큼 경험치 (이긴 판마다 1판)` : '후원: 쉬는 판에도 출전만큼 경험치 (5판, 20판까지 쌓임)'}</p>`;
}

/** 길드원 기록 카드 (93 9-3): 함께 이긴 판 · 생명의 은인 · 딜 1등 · 가장 많이 함께 깬 곳 (숙지 점수) · 함께한 첫 판 */
function recordHtml(m: GuildMember): string {
  const u = G.save.users[m.nick];
  const top = Object.entries(m.know).sort((a, b) => b[1] - a[1])[0];
  const first = u?.first ? `${u.first.day.slice(5).replace('-', '.')} ${esc(CONTENT.find(c => c.key === u.first!.at)?.name ?? u.first.at)}` : '';
  return `<ul class="g-mrec"><li><b>${fmt(u?.wins ?? 0)}</b><small>함께 이긴 판</small></li><li><b>${fmt(u?.saved ?? 0)}</b><small>생명의 은인</small></li><li><b>${fmt(u?.mvp ?? 0)}</b><small>딜 1등</small></li></ul>
    <p class="note">${top ? `가장 많이 함께 깬 곳 ${esc(ENCOUNTERS[top[0] as EncounterKey]?.name ?? top[0])}` : '아직 함께 깬 곳 없음'}${first ? ` · 첫 판 ${first}` : ''}</p>`;
}

/** 공략 숙지 (93 5-4): 단계가 높은 전투 3개 + 그 밖 수 */
function knowHtml(m: GuildMember): string {
  const ks = Object.entries(knowStages(m)).sort((a, b) => b[1] - a[1] || (m.know[b[0]] ?? 0) - (m.know[a[0]] ?? 0));
  if (!ks.length) return '<p class="note g-know">공략 숙지 없음 · 함께 이긴 전투마다 그 전투에서 반응 · 회피가 좋아짐</p>';
  const top = ks.slice(0, 3).map(([k, s]) => `${esc(ENCOUNTERS[k as EncounterKey]?.name ?? k)} ${s}단계`).join(' · ');
  return `<p class="note g-know">공략 숙지 ${top}${ks.length > 3 ? ` 외 ${ks.length - 3}곳` : ''}</p>`;
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
  if (t.closest('#found')) { foundGuild(save); commit(); render(); return; }
  if (t.closest('#sponsorRest')) { const n = restSponsor(save).ids.length; st.msg = sponsorRest(save) || `쉬는 길드원 ${n}명 후원 · 한 사람 5판`; commit(); render(); return; }
  if (t.closest('#storyOk')) { save.guild.storySeen = true; commit(); render(); return; }
  // 「길드파티로 출전」: 전투 탭(모험 고르기) → 편성이 길드파티로 시작 (game/flow.ts)
  if (t.closest('#guildGo') && save.guild.members.length) { Flow.preferGuild = true; go('s-content'); return; }
  if (t.closest('#roster')) { st.roster = !st.roster; render(); return; }
  if (t.closest('#rfriend')) { st.rfriend = !st.rfriend; render(); return; }
  const rr = t.closest<HTMLElement>('[data-rrole]');
  if (rr) { st.rrole = rr.dataset.rrole as PostRole; render(); return; }
  const role = t.closest<HTMLElement>('[data-role]');
  if (role) { st.role = role.dataset.role as PostRole; render(); return; }
  const pc = t.closest<HTMLElement>('[data-pickcls]');
  if (pc) { st.cls = pc.dataset.pickcls as ClassKey; render(); return; }
  const post = t.closest<HTMLButtonElement>('[data-post]');
  if (post) { if (!post.disabled) { const kind = post.dataset.post as PostKind; st.msg = postRecruit(save, kind, kind === 'elite' ? st.cls : st.role, Math.random); commit(); render(); } return; }
  const inv = t.closest<HTMLButtonElement>('[data-invite]');
  if (inv) { if (!inv.disabled) { const err = inviteFriend(save, inv.dataset.invite!); st.sheet = null; st.msg = err || '초대 완료 · 「길드원」에서 확인'; commit(); render(); } return; }
  const h = t.closest<HTMLButtonElement>('[data-hire]');
  if (h) { if (!h.disabled) { const err = hire(save, Number(h.dataset.hire)); st.sheet = null; st.msg = err || '영입 완료 · 「길드원」에서 확인'; commit(); render(); } return; }
  const ha = t.closest<HTMLButtonElement>('[data-hireapp]');
  if (ha) { if (!ha.disabled) { const err = hireApp(save, Number(ha.dataset.hireapp)); st.sheet = null; st.msg = err || '영입 완료 · 「길드원」에서 확인'; commit(); render(); } return; }
  const x = st.sheet;
  if (x?.k === 'mem' && t.closest('.g-msheet')) {
    const id = x.id;
    if (t.closest('[data-sponsor]')) { const m = memberById(id); st.msg = sponsor(save, id) || `후원 · ${m?.boost ?? 0}판 남음`; }
    else if (t.closest('[data-reroll]')) { const before = memberById(id)?.ab; st.msg = rerollAbility(save, id, Math.random); const m = memberById(id); if (!st.msg && m) st.msg = `새 스킬: ${ABILITIES[m.ab].name}${m.ab === before ? ' (같은 스킬)' : ''}`; }
    else if (t.closest('[data-release]')) {
      if (st.ask !== id) { st.ask = id; render(); return; }
      const m = memberById(id);
      release(save, id); st.sheet = null; st.ask = null;
      st.msg = m ? `${m.nick}(${CLASSES[m.cls].name}) 친구 목록으로 · 인연은 그대로` : '';
    } else return;
    commit(); render(); return;
  }
  const sub = t.closest<HTMLElement>('[data-sub]');
  if (sub) { st.sub = sub.dataset.sub as Sub; st.sheet = null; st.ask = null; render(); s.el.querySelector<HTMLElement>('.ns-body')?.scrollTo({ top: 0 }); return; }
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
