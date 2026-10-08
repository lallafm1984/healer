/**
 * S12 길드 홈 · S13 길드원 상세 · S14 영입 (09, 02 9장, 17 8장). Lv 15에 열림.
 * 길드원: 목록 → 누르면 바로 아래에 상세 (훈련·육성 포인트·능력 다시 뽑기·방출).
 * 영입: 골드 모집 공고(후보 3명 중 1명) · 인연 스카우트.
 */
import { ABILITIES, STAR5, starFx } from '../data/abilities';
import { CLASSES } from '../data/classes';
import { APT_NAMES, aptOf, pointCost, pointsAt, pointsUsed, POSTS, REROLL_GOLD, RESET_GOLD, SCOUT_GOLD, trainCost, type GuildMember, type PostTier } from '../data/guild';
import { GUILD_LEVEL, xpToNext } from '../data/progression';
import { capOf, guildOpen, hire, postRecruit, powerOf, release, rerollAbility, resetPoints, scoutHire, spendPoint, train } from '../game/guild';
import { commit, G } from '../game/state';
import { cardHtml } from './members';
import { esc, fmt, screen, topBar } from './kit';
import { LOCK, uiIcon } from './art';

type Sub = 'members' | 'recruit';
const st: { sub: Sub; sel: number | null; msg: string; ask: number | null } = { sub: 'members', sel: null, msg: '', ask: null };

const s = screen('s-guild', '길드', { tab: 'guild', enter() { st.sel = null; st.msg = ''; st.ask = null; render(); } });

function render(): void {
  const open = guildOpen(G.save);
  if (!open.ok) {
    s.el.innerHTML = `${topBar({ settings: true })}<div class="ns-body tabph"><h2 class="h">길드</h2><p class="lockline">${LOCK}${esc(open.why)} (지금 Lv ${G.save.player.level})</p>
      <p class="note">길드원을 영입해 직접 편성 (골드 모집·인연 스카우트)</p></div>`;
    return;
  }
  const g = G.save.guild, cap = capOf(G.save);
  s.el.innerHTML = `${topBar({ settings: true })}
    <nav class="subtabs" role="tablist">
      <button type="button" role="tab" data-sub="members" aria-selected="${st.sub === 'members'}">길드원 ${g.members.length}</button>
      <button type="button" role="tab" data-sub="recruit" aria-selected="${st.sub === 'recruit'}">영입${g.post ? ' ●' : ''}</button>
    </nav>
    <div class="ns-body guild">
      <header class="art-hero hall-hero"><span class="hh-crest">${uiIcon('bell')}</span><h2 class="ah-copy">「${esc(g.name)}」<small>길드 Lv ${cap.lv} · 정원 ${g.members.length}/${cap.cap} · 명성 ${fmt(g.fame)}</small></h2></header>
      ${open.dev ? `<p class="note">개발 빌드: 레벨 잠금 무시로 열림 (원래 Lv ${GUILD_LEVEL})</p>` : ''}
      ${st.msg ? `<p class="warnbox">${esc(st.msg)}</p>` : ''}
      ${st.sub === 'members' ? membersHtml() : recruitHtml()}
    </div>`;
  st.msg = '';
}

function membersHtml(): string {
  const g = G.save.guild;
  if (!g.members.length) return `<p class="note">아직 길드원 없음. 「영입」에서 골드 모집 공고를 내거나, 공개모집에서 잘 살려 준 파티원을 스카우트.</p>
    <button class="btn primary" type="button" data-sub="recruit">영입하기</button>`;
  const list = g.members.slice().sort((a, b) => powerOf(b) - powerOf(a));
  return `<ul class="pcards gmembers">${list.map(m => cardHtml({ ...m, apt: aptOf(m), power: powerOf(m) }, { attrs: `data-mem="${m.id}" role="button" tabindex="0"`, cls: `tap${st.sel === m.id ? ' on' : ''}`, desc: false }) + (st.sel === m.id ? detailHtml(m) : '')).join('')}</ul>
    <p class="note">누르면 육성·훈련. 길드원 레벨은 내 레벨까지, 길드 평균보다 낮으면 경험치 2배.</p>`;
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
  return `<h3 class="sec">골드 모집 <small>정원 ${g.members.length}/${cap.cap}</small></h3>
    <div class="gbtns posts">${tiers.map(t => `<button class="btn" type="button" data-post="${t}"${full || gold < POSTS[t].gold ? ' disabled' : ''}>${POSTS[t].name} 공고<small>🪙 ${fmt(POSTS[t].gold)}</small></button>`).join('')}</div>
    <p class="note">${tiers.map(t => `<b>${POSTS[t].name}</b> ${POSTS[t].desc}`).join('<br>')}${full ? '<br>정원이 다 참 (Lv 35에 12명, Lv 70에 25명)' : ''}</p>
    ${post ? `<h3 class="sec">지원자 ${post.cands.length}명 <small>${POSTS[post.tier].name} 공고 · 1명만 영입</small></h3>
      <ul class="pcards">${post.cands.map((c, i) => cardHtml({ ...c, apt: aptOf(c), power: powerOf(c) }, { cls: 'withbtn', extra: `<button class="btn mini primary" type="button" data-hire="${i}"${full ? ' disabled' : ''}>영입</button>` })).join('')}</ul>` : ''}
    <h3 class="sec">인연 스카우트 <small>🪙 ${SCOUT_GOLD}</small></h3>
    ${g.scouts.length ? `<ul class="pcards">${g.scouts.map((c, i) => cardHtml({ ...c, apt: c.apt0 }, { cls: 'withbtn', extra: `<button class="btn mini primary" type="button" data-scout="${i}"${full || gold < SCOUT_GOLD ? ' disabled' : ''}>영입</button>` }).replace('</small>', ` · ${esc(c.from)}에서</small>`)).join('')}</ul>`
      : '<p class="note">공개모집으로 S·A 등급 클리어를 하면, 살아남은 파티원 중 내 힐을 가장 많이 받은 사람이 호감도가 가득 차 여기 남음.</p>'}`;
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const save = G.save;
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
