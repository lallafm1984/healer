/**
 * 길드 탭 (30 시안 「길드 C · 길드 게시판」, 09 S12~S14, 02 9장, 17 8장). Lv 15에 열림.
 * home = 길드 홀 벽 + 나무 게시판 + 양피지 쪽지 (길드원 · 모집 공고 · 주간 목표 · 인연 스카우트 · 정원 · 안내)
 *        + 나무 팻말 「길드원」「영입」 + 「길드파티로 출전」 (편성이 길드파티로 시작).
 * members = 길드원 목록 → 누르면 바로 아래에 상세 (훈련·육성 포인트·능력 다시 뽑기·초기화·방출).
 * recruit = 골드 모집 공고(후보 3명 중 1명) · 인연 스카우트.
 * 게시판·쪽지·도장 그림(ui-board · ui-note · ui-seal)이 오면 그 그림, 없으면 CSS 게시판 (guild30.css).
 */
import { art } from '../art';
import { ABILITIES, STAR5, starFx } from '../data/abilities';
import { CLASSES } from '../data/classes';
import { APT_NAMES, aptOf, guildCap, pointCost, pointsAt, pointsUsed, POSTS, REROLL_GOLD, RESET_GOLD, SCOUT_GOLD, trainCost, type GuildMember, type PostTier } from '../data/guild';
import { GUILD_GOAL } from '../data/missions';
import { GUILD_LEVEL, MAX_LEVEL, xpToNext } from '../data/progression';
import { Flow } from '../game/flow';
import { capOf, guildOpen, hire, postRecruit, powerOf, release, rerollAbility, resetPoints, scoutHire, spendPoint, train } from '../game/guild';
import { commit, G, refreshDay } from '../game/state';
import { cardHtml, ROLE_ICON } from './members';
import { esc, fmt, go, ROLE, screen, topBar } from './kit';
import { gameIcon, LOCK } from './art';

type Sub = 'home' | 'members' | 'recruit';
const st: { sub: Sub; sel: number | null; msg: string; ask: number | null } = { sub: 'home', sel: null, msg: '', ask: null };

const s = screen('s-guild', '길드', { tab: 'guild', enter() { refreshDay(); st.sub = 'home'; st.sel = null; st.msg = ''; st.ask = null; render(); } });
s.el.classList.add('g30');

/** 시안 선 아이콘: 깃발 (길드 탭 · 출전 문양), 오른쪽 화살표, 뒤로 */
const svg = (d: string, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const FLAG = svg('<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>');
const ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.4).replace('<svg', '<svg class="g-arrow"');
const BACK = svg('<path d="M19 12H5M11 6l-6 6 6 6"/>', 2.4);

/**
 * 정식 그림 (30 문서 3장): ui-board 게시판 나무틀 · ui-note 양피지가 있으면 .art = 9칸 늘리기(border-image)로 그림,
 * 없으면 CSS 게시판·쪽지 (game30.css). 길이가 제각각인 판·쪽지라 통째로 늘리지 않고 모서리를 지킨다
 */
const BOARD_ART = art('ui-board') ? ' art' : '';
const NOTE_ART = art('ui-note') ? ' art' : '';

/** 게시판 틀 (나무판 · 이름표 · 쇠 모서리). inner = 판 안쪽 */
function board(cls: string, plate: string, inner: string): string {
  return `<section class="g-board ${cls}${BOARD_ART}" aria-label="길드 게시판">${plate}
    ${BOARD_ART ? '' : '<span class="g-cb tl"></span><span class="g-cb tr"></span><span class="g-cb bl"></span><span class="g-cb br"></span>'}
    <div class="g-bd">${inner}</div></section>`;
}
/** 양피지 쪽지 (빨간 핀). attrs = 누를 수 있는 쪽지면 role·data */
const note = (cls: string, inner: string, attrs = '') => `<div class="g-note ${cls}${NOTE_ART}"${attrs}>${inner}</div>`;
/** 양피지 띠 (설명 한 줄) */
const memo = (text: string) => `<p class="g-memo${NOTE_ART}">${text}</p>`;
/** 밀랍 도장 버튼 (ui-seal이 오면 글자 앞 도장 그림) */
const seal = (attrs: string, label: string, icon = true) => `<button type="button" class="g-seal" ${attrs}>${icon ? gameIcon('seal', '', 'ui') : ''}<span>${label}</span></button>`;

/** 이름표: 「길드 이름」 + 길드 Lv · 정원 · 명성 */
function plate(): string {
  const g = G.save.guild, cap = capOf(G.save);
  return `<h2 class="g-plq"><b>「${esc(g.name)}」</b><small>길드 Lv ${cap.lv} · 정원 ${g.members.length}/${cap.cap} · 명성 ${fmt(g.fame)}</small></h2>`;
}

/** 위·아래 작은 안내: 개발 빌드 잠금 무시 · 방금 한 일 */
function notices(open: { dev: boolean }): string {
  return `${open.dev ? `<p class="g-dev">개발 빌드: 레벨 잠금 무시로 열림 (원래 Lv ${GUILD_LEVEL})</p>` : ''}${st.msg ? `<p class="warnbox">${esc(st.msg)}</p>` : ''}`;
}

function render(): void {
  const body = s.el.querySelector<HTMLElement>('.ns-body');
  const keep = body && body.dataset.view === st.sub ? body.scrollTop : 0;
  const open = guildOpen(G.save);
  if (!open.ok) {
    s.el.innerHTML = `${topBar({ settings: true })}<div class="ns-body g-home g-lock">
      ${board('g-hboard', '<h2 class="g-plq"><b>길드</b><small>길드 홀</small></h2>', `<div class="g-notes g-locknotes">${note('n-lock', `<h3 class="lockline">${LOCK}${esc(open.why)}</h3>
        <p>지금 Lv ${G.save.player.level}</p>
        <p class="m">길드원을 영입해 직접 편성합니다. 골드 모집 공고와 인연 스카우트로 모읍니다.</p>`)}</div>`)}
    </div>`;
    return;
  }
  s.el.innerHTML = `${topBar({ settings: true })}${st.sub === 'home' ? homeHtml(open) : subHtml(open)}`;
  const nb = s.el.querySelector<HTMLElement>('.ns-body');
  if (nb) { nb.dataset.view = st.sub; nb.scrollTop = keep; }
  st.msg = '';
}

// ---------- home: 길드 게시판 ----------
const ptsLeft = (m: GuildMember) => Math.max(0, pointsAt(m.lv) - pointsUsed(m));

/** 정원: 지금 단계 (몇 레벨에 몇 명) · 다음 단계 */
function capSteps(): { now: { lv: number; cap: number }; next: { lv: number; cap: number } | null } {
  const P = G.save.player.level, cap = capOf(G.save).cap;
  let lv = P;
  while (lv > 1 && guildCap(lv - 1).cap === cap) lv--;
  let next: { lv: number; cap: number } | null = null;
  for (let l = P + 1; l <= MAX_LEVEL; l++) if (guildCap(l).cap > cap) { next = { lv: l, cap: guildCap(l).cap }; break; }
  return { now: { lv: Math.max(GUILD_LEVEL, lv), cap }, next };
}

function homeHtml(open: { dev: boolean }): string {
  const g = G.save.guild, cap = capOf(G.save), n = g.members.length;
  const w = G.save.weekly.guild, need = GUILD_GOAL.need;
  const top = g.members.slice().sort((a, b) => powerOf(b) - powerOf(a)).slice(0, 4);
  const rows = top.map(m => {
    const c = CLASSES[m.cls], p = ptsLeft(m);
    return `<span class="g-mrow"><span class="ri" style="background:${ROLE[c.role].color}">${ROLE_ICON[c.role] || ''}</span><span class="g-mt"><b>${esc(m.nick)}</b><span>${c.name} · Lv ${m.lv}</span></span>${p ? `<i>+${p}</i>` : ''}</span>`;
  }).join('');
  const more = n - top.length;
  const anyPts = top.some(m => ptsLeft(m) > 0);
  const memNote = n
    ? note('n-mem', `<h3>길드원<small>${n}/${cap.cap} · 누르면 육성</small></h3>${rows}
        <p class="m">${more > 0 ? `외 ${more}명${anyPts ? ' · ' : ''}` : ''}${anyPts ? '초록 숫자 = 남은 육성 포인트' : more > 0 ? '' : '전투력 순'}</p>`, ' role="button" tabindex="0" data-sub="members"')
    : note('n-mem empty', `<h3>길드원<small>0/${cap.cap}</small></h3><p>아직 길드원 없음</p>
        <p class="m">「영입」에서 골드 모집 공고를 내거나, 공개모집에서 잘 살려 준 파티원을 스카우트</p>`, ' role="button" tabindex="0" data-sub="recruit"');
  const minGold = Math.min(...Object.values(POSTS).map(p => p.gold));
  const full = n >= cap.cap;
  const postNote = g.post
    ? note('n-post', `<h3>모집 공고</h3><p>${POSTS[g.post.tier].name} 공고</p><p class="m">지원자 ${g.post.cands.length}명 · 1명 영입</p>${seal('data-sub="recruit"', '보기')}`)
    : note('n-post', `<h3>모집 공고</h3><p>${full ? '정원이 다 참' : '공고 없음'}</p><p class="m">골드 ${fmt(minGold)}부터</p>${seal('data-sub="recruit"', full ? '보기' : '공고 내기', full)}`);
  const goalNote = note('n-goal', `<h3>주간 목표</h3><p>길드파티로 클리어</p>
    <span class="g-nbar"><i style="width:${Math.min(100, (w.n / need) * 100).toFixed(0)}%"></i></span>
    <p class="m">${w.got ? `달성 · 명성 +${GUILD_GOAL.fame} 받음` : w.n >= need ? `${need} / ${need} · 임무에서 명성 +${GUILD_GOAL.fame}` : `${w.n} / ${need} · 명성 +${GUILD_GOAL.fame}`}</p>`);
  const sc = g.scouts[0];
  const scoutNote = note('n-scout', `<h3>인연 스카우트</h3>${sc
    ? `<p>대기 ${g.scouts.length}명 · ${esc(sc.nick)} (${CLASSES[sc.cls].name})</p><p class="m">골드 ${fmt(SCOUT_GOLD)} · S·A 클리어에서</p>`
    : `<p>대기 없음</p><p class="m">공개모집 S·A 클리어 때 내 힐을 가장 많이 받은 파티원</p>`}`);
  const cs = capSteps();
  const capNote = note('n-cap', `<h3>정원</h3><p>Lv ${cs.now.lv} · ${cs.now.cap}명</p><p class="m">${cs.next ? `다음: Lv ${cs.next.lv} · ${cs.next.cap}명` : '최대 정원'}</p>`);
  const infoNote = note('n-info', '<h3>안내</h3><p class="m">길드원 레벨은 내 레벨까지. 길드 평균보다 낮으면 경험치 2배</p>');
  const cands = g.post?.cands.length || 0;
  const cta = n
    ? `<button type="button" class="g-cta" id="guildGo"><span class="g-mk"><span>${gameIcon('guild', FLAG, 'tab')}</span></span><span class="g-ct"><b>길드파티로 출전</b><small>주간 목표 ${Math.min(w.n, need)}/${need} · 모험 고르기</small></span>${ARROW}</button>`
    : `<button type="button" class="g-cta" id="guildGo" data-sub="recruit"><span class="g-mk"><span>${gameIcon('guild', FLAG, 'tab')}</span></span><span class="g-ct"><b>영입하러 가기</b><small>길드원이 있어야 길드파티</small></span>${ARROW}</button>`;
  return `<div class="ns-body g-home">
      ${st.msg ? `<p class="warnbox">${esc(st.msg)}</p>` : ''}
      ${board('g-hboard', plate(), `<div class="g-notes">${memNote}${postNote}${goalNote}${scoutNote}${capNote}${infoNote}</div>`)}
      <nav class="g-signs" aria-label="길드 메뉴">
        <button type="button" class="g-sign" data-sub="members">길드원 <small>${n}/${cap.cap}</small></button>
        <button type="button" class="g-sign" data-sub="recruit">영입${cands ? ` <small>지원자 ${cands}</small><span class="g-badge" aria-label="지원자 ${cands}명">${cands}</span>` : g.scouts.length ? ` <small>스카우트 ${g.scouts.length}</small>` : ''}</button>
      </nav>
      ${open.dev ? `<p class="g-dev">개발 빌드: 레벨 잠금 무시로 열림 (원래 Lv ${GUILD_LEVEL})</p>` : ''}
    </div>
    <div class="g-foot">${cta}</div>`;
}

// ---------- members · recruit: 게시판 안에 목록 ----------
function subHtml(open: { dev: boolean }): string {
  const g = G.save.guild, cap = capOf(G.save), cands = g.post?.cands.length || 0;
  const tab = (k: Sub, label: string, extra = '') => `<button type="button" class="g-sign${k === 'home' ? ' home' : ''}" role="tab" data-sub="${k}" aria-selected="${st.sub === k}">${label}${extra}</button>`;
  return `<div class="ns-body g-sub">
      <nav class="g-signs g-subnav" role="tablist" aria-label="길드 메뉴">
        ${tab('home', `${BACK}<span>게시판</span>`)}
        ${tab('members', '길드원', ` <small>${g.members.length}/${cap.cap}</small>`)}
        ${tab('recruit', '영입', cands ? `<span class="g-badge" aria-label="지원자 ${cands}명">${cands}</span>` : '')}
      </nav>
      ${notices(open)}
      ${board('g-sboard', plate(), st.sub === 'members' ? membersHtml() : recruitHtml())}
    </div>`;
}

function membersHtml(): string {
  const g = G.save.guild;
  if (!g.members.length) return `${note('g-paper', `<h3>길드원</h3><p>아직 길드원 없음</p><p class="m">「영입」에서 골드 모집 공고를 내거나, 공개모집에서 잘 살려 준 파티원을 스카우트</p>`)}
    <button class="btn primary" type="button" data-sub="recruit">영입하기</button>`;
  const list = g.members.slice().sort((a, b) => powerOf(b) - powerOf(a));
  return `<ul class="pcards gmembers">${list.map(m => cardHtml({ ...m, apt: aptOf(m), power: powerOf(m) }, { attrs: `data-mem="${m.id}" role="button" tabindex="0"`, cls: `tap${st.sel === m.id ? ' on' : ''}`, desc: false }) + (st.sel === m.id ? detailHtml(m) : '')).join('')}</ul>
    ${memo('누르면 육성·훈련. 길드원 레벨은 내 레벨까지, 길드 평균보다 낮으면 경험치 2배.')}`;
}

function detailHtml(m: GuildMember): string {
  const a = ABILITIES[m.ab], apt = aptOf(m), pts = pointsAt(m.lv) - pointsUsed(m), pc = pointCost(m.lv);
  const fx = starFx(a, m.star);
  const need = xpToNext(m.lv), xpPct = isFinite(need) ? Math.min(100, (m.xp / need) * 100) : 100;
  const atCap = m.lv >= G.save.player.level;
  const gold = G.save.player.gold;
  const btn = (attr: string, label: string, sub: string, dis: boolean, cls = '') => `<button class="btn${cls ? ` ${cls}` : ''}" type="button" ${attr}${dis ? ' disabled' : ''}>${label}<small>${sub}</small></button>`;
  return `<li class="panel mdetail">
    <p class="mxp">경험치 <span class="bar"><i style="width:${xpPct.toFixed(0)}%"></i></span> ${fmt(m.xp)} / ${isFinite(need) ? fmt(need) : '최대'} · 출전 ${m.runs}번</p>
    <p>${a.desc} <small class="mute">쓰는 때: ${esc(a.when)}</small></p>
    <p class="mute">능력 ★${m.star}/5${m.star ? ` · 효과 ×${fx.eff.toFixed(2)}${fx.cd < 1 ? ` · 쿨 ×${fx.cd.toFixed(1)}` : ''}${fx.early ? ' · 조금 일찍 씀' : ''}` : ''}${m.star >= 5 ? ` · ★5: ${STAR5[a.kind]}` : ''}</p>
    <h4>육성 포인트 <small>남은 ${pts}점 · Lv 20부터 10레벨마다 1점 (최대 9)</small></h4>
    <div class="gbtns">
      ${[0, 1, 2].map(i => btn(`data-pt="${i}"`, `${APT_NAMES[i]} +1`, apt[i] >= 5 ? '최대' : `🪙 ${fmt(pc)}`, !pts || apt[i] >= 5 || gold < pc)).join('')}
      ${btn('data-pt="star"', '능력 ★+1', m.star >= 5 ? '최대' : `🪙 ${fmt(pc)}`, !pts || m.star >= 5 || gold < pc)}
    </div>
    <div class="gbtns">
      ${btn('data-train', '훈련 +1 Lv', atCap ? '내 레벨까지' : `🪙 ${fmt(trainCost(m.lv))}`, atCap || gold < trainCost(m.lv), 'primary')}
      ${btn('data-reroll', '능력 다시 뽑기', `🪙 ${fmt(REROLL_GOLD)}`, gold < REROLL_GOLD)}
      ${btn('data-reset', '포인트 초기화', `🪙 ${fmt(RESET_GOLD)}`, !pointsUsed(m) || gold < RESET_GOLD)}
      ${btn('data-release', st.ask === m.id ? '한 번 더 누르면 방출' : '방출', st.ask === m.id ? '되돌릴 수 없음' : '길드에서 내보냄', false, st.ask === m.id ? 'danger' : 'ghost')}
    </div>
  </li>`;
}

function recruitHtml(): string {
  const g = G.save.guild, cap = capOf(G.save), full = g.members.length >= cap.cap, gold = G.save.player.gold;
  const tiers = Object.keys(POSTS) as PostTier[];
  const post = g.post;
  return `${note('g-paper g-posts', `<h3>골드 모집<small>정원 ${g.members.length}/${cap.cap}</small></h3>
      <div class="gbtns posts">${tiers.map(t => `<button class="btn" type="button" data-post="${t}"${full || gold < POSTS[t].gold ? ' disabled' : ''}>${POSTS[t].name} 공고<small>🪙 ${fmt(POSTS[t].gold)}</small></button>`).join('')}</div>
      <p class="m">${tiers.map(t => `<b>${POSTS[t].name}</b> ${POSTS[t].desc}`).join('<br>')}${full ? '<br>정원이 다 참 (Lv 35에 12명, Lv 70에 25명)' : ''}</p>`)}
    ${post ? `<h3 class="g-tag">지원자 ${post.cands.length}명 <small>${POSTS[post.tier].name} 공고 · 1명만 영입</small></h3>
      <ul class="pcards">${post.cands.map((c, i) => cardHtml({ ...c, apt: aptOf(c), power: powerOf(c) }, { cls: 'withbtn', extra: `<button class="btn mini primary" type="button" data-hire="${i}"${full ? ' disabled' : ''}>영입</button>` })).join('')}</ul>` : ''}
    <h3 class="g-tag">인연 스카우트 <small>🪙 ${SCOUT_GOLD}</small></h3>
    ${g.scouts.length ? `<ul class="pcards">${g.scouts.map((c, i) => cardHtml({ ...c, apt: c.apt0 }, { cls: 'withbtn', extra: `<button class="btn mini primary" type="button" data-scout="${i}"${full || gold < SCOUT_GOLD ? ' disabled' : ''}>영입</button>` }).replace('</small>', ` · ${esc(c.from)}에서</small>`)).join('')}</ul>`
      : memo('공개모집으로 S·A 등급 클리어를 하면, 살아남은 파티원 중 내 힐을 가장 많이 받은 사람이 호감도가 가득 차 여기 남음.')}`;
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const save = G.save;
  // 「길드파티로 출전」: 전투 탭(모험 고르기) → 입장 → 편성이 길드파티로 시작 (30, game/flow.ts)
  if (t.closest('#guildGo') && save.guild.members.length) { Flow.preferGuild = true; go('s-content'); return; }
  const sub = t.closest<HTMLElement>('[data-sub]');
  if (sub) { st.sub = sub.dataset.sub as Sub; st.sel = null; st.ask = null; render(); return; }
  const post = t.closest<HTMLElement>('[data-post]');
  if (post) { st.msg = postRecruit(save, post.dataset.post as PostTier, Math.random); commit(); render(); return; }
  const h = t.closest<HTMLElement>('[data-hire]');
  if (h) { const err = hire(save, Number(h.dataset.hire)); st.msg = err || '영입 완료 · 「길드원」에서 확인'; commit(); render(); return; }
  const sc = t.closest<HTMLElement>('[data-scout]');
  if (sc) { const err = scoutHire(save, Number(sc.dataset.scout)); st.msg = err || '영입 완료 · 「길드원」에서 확인'; commit(); render(); return; }
  const id = st.sel;
  if (id != null && t.closest('.mdetail')) {
    const pt = t.closest<HTMLElement>('[data-pt]');
    if (pt) st.msg = spendPoint(save, id, pt.dataset.pt === 'star' ? 'star' : (Number(pt.dataset.pt) as 0 | 1 | 2));
    else if (t.closest('[data-train]')) st.msg = train(save, id);
    else if (t.closest('[data-reroll]')) { const before = save.guild.members.find(m => m.id === id)?.ab; st.msg = rerollAbility(save, id, Math.random); const m = save.guild.members.find(x => x.id === id); if (!st.msg && m) st.msg = `새 능력: ${ABILITIES[m.ab].name}${m.ab === before ? ' (같은 능력)' : ''}`; }
    else if (t.closest('[data-reset]')) st.msg = resetPoints(save, id);
    else if (t.closest('[data-release]')) {
      if (st.ask !== id) { st.ask = id; render(); return; }
      const m = save.guild.members.find(x => x.id === id);
      release(save, id); st.sel = null; st.ask = null;
      st.msg = m ? `${m.nick}(${CLASSES[m.cls].name}) 방출` : '';
    } else return;
    commit(); render(); return;
  }
  const mem = t.closest<HTMLElement>('[data-mem]');
  if (mem) { const v = Number(mem.dataset.mem); st.sel = st.sel === v ? null : v; st.ask = null; render(); }
});

// 누를 수 있는 쪽지·카드 (role="button")는 Enter·Space로도
s.el.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  if ((e.key === 'Enter' || e.key === ' ') && t.matches('[role="button"]:not(button)')) { e.preventDefault(); t.click(); }
});
