/**
 * S22 일일·주간 임무 (09, 13). 로비 「오늘의 임무」에서 들어옴.
 * 일일 5개 + 완료 상자 (놓친 날 2일까지), 주간 3개 (클리어 골드 1.75판), 길드 주간 목표 (길드를 빼 두면 없음), 주간 도전 월요일 상자.
 * 화면 (2026-10-22 Lim 「주간이 끝나면 임무 화면도 동일하게 시안을 만들어서 디자인 하자」 → 「b시안으로 해줘」 · 「상점과 행상인과 비슷한 느낌으로 일관성있게」):
 * 상점 · 행상인과 같은 그림 머리 (ui-mission 임무 게시판) + 길드 탭 (일일 · 주간) + 머리 달린 판 · 줄 · 알약 (guild-hall.css).
 * 2026-10-24 Lim 「교체 버튼 제거, 설명 버튼 제거, … 새 임무 항목도 제거」: 임무 교체 · 판 ⓘ · 머리 「새 임무」 알약은 없다
 */
import { AD_LIMIT } from '../data/economy';
import { t } from '../i18n';
import { CHEST_REWARD, GUILD_GOAL, WEEKLY_LV } from '../data/missions';
import { FEATURES } from '../data/features';
import { GUILD_LEVEL } from '../data/progression';
import { chalChestOf, chestState, claimChalChest, claimChest, claimGuildGoal, claimMission, missionDef, missionGold, missionReady, runGold, type Gain } from '../game/economy';
import { commit, G, refreshDay } from '../game/state';
import { topLevel } from '../platform/storage';
import { noticeModal, showRewarded } from '../platform/ads';
import { esc, screen, topBar } from './kit';
import { showReward } from './reward-pop';
import { currencyAmount, gameIcon } from './art';
import { art } from '../art';
import './missions.css';
import { sfx } from '../sfx';

const st = { tab: 'daily' as 'daily' | 'weekly' };
let chestAdPending = false;
const s = screen('s-missions', '임무', { enter() { refreshDay(); st.tab = 'daily'; render(); } });

/** 임무 그림 (2026-10-22 Lim 임무 시안): 있는 그림을 빌려 씀. 이름 · 보상 · 진행은 그림이 아니라 실제 임무 값 */
const MISSION_ART: Record<string, string> = {
  clear3: 'icon-a2-swords', pub2: 'icon-guild-members', dispel10: 'skill-purify',
  overheal: 'skill-renew', nodeath: 'skill-guardian', mana20: 'spec-mana',
  clumsy: 'icon-guild-members', sell2: 'icon-forge', guild2: 'icon-guild-flag',
  w_raid3: 'icon-raid', w_hard5: 'icon-a2-swords', w_dclear15: 'icon-a2-swords',
  w_chal5: 'icon-challenge', w_chest5: 'icon-chest',
};
const missionImage = (key: string) => art(MISSION_ART[key] ?? 'icon-mission') || art('icon-mission');

// ---------- 길드 부품 (guild-hall.css: 판 .g-card · 줄 .g-row · 알약 .g-pill) ----------
/** 판: 머리 = 그림 · 제목 · 숫자 (ⓘ 설명은 없음) */
function card(o: { key: string; icon: string; title: string; meta?: string; body: string }): string {
  return `<section class="g-card" data-sec="${o.key}"><header class="g-hd"><span class="g-hi">${o.icon}</span><h3>${o.title}</h3>${o.meta ? `<span class="g-meta">${o.meta}</span>` : ''}</header>${o.body}</section>`;
}
const pill = (html: string, cls = '') => `<span class="g-pill${cls ? ` ${cls}` : ''}">${html}</span>`;
const okPill = (t: string) => pill(`✓ ${t}`, 'ok');
const bar = (pct: number, label: string) => `<span class="g-bar" role="img" aria-label="${esc(label)}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(0)}%"></i></span>`;
const img = (src: string) => `<img class="g-ic" src="${src}" alt="" decoding="async">`;
const gradeTxt = (gs: string[]) => [...new Set(gs)].map(g => `${t(g)}${gs.filter(x => x === g).length > 1 ? ` ${gs.filter(x => x === g).length}` : ''}`).join(' · ');

/** 임무 줄 = 길드 줄: 그림 · 이름 + 막대 · 숫자 / 오른쪽 골드 알약 위, 받기 · 받음 아래 */
function row(kind: 'daily' | 'weekly', i: number): string {
  const m = (kind === 'daily' ? G.save.daily : G.save.weekly).missions[i], d = missionDef(m.key);
  const value = Math.min(m.n, d.need), ready = missionReady(m) && !m.got;
  const act = m.got ? okPill(t('받음'))
    : ready ? `<button class="btn mini primary" type="button" data-claim="${kind}" data-i="${i}" aria-label="${esc(t(d.text))} ${t('보상 받기')}">${t('받기')}</button>` : '';
  return `<li class="g-row mrow${m.got ? ' got' : ''}${ready ? ' ready' : ''}"><span class="g-ri">${img(missionImage(m.key))}</span>
    <div class="g-rm"><b>${esc(t(d.text))}</b><span class="m-prog">${bar((value / d.need) * 100, `${t(d.text)} ${value} / ${d.need}`)}<small>${value} / ${d.need}</small></span></div>
    <span class="g-rs m-rs"><span class="mission-reward g-pill fame">${currencyAmount('gold', missionGold(G.save, kind))}</span>${act}</span></li>`;
}

/** 그림 머리 (상점 · 행상인 머리와 같은 .art-hero): 작은 글 「임무 게시판」 · 제목 */
function hero(title: string): string {
  return `<header class="art-hero m-hero"><div class="ah-copy"><p class="eyebrow">${t('임무 게시판')}</p><h2>${title}</h2></div></header>`;
}

function render(): void {
  const save = G.save, d = save.daily, w = save.weekly, lv = topLevel(save);
  const ch = chestState(save), gotN = d.missions.filter(m => m.got).length, weeklyN = w.missions.filter(m => m.got).length;
  const g = w.guild, run = runGold(lv), chal = save.chalChest ? chalChestOf(save.chalChest, save.player.level) : null;
  const adLeft = AD_LIMIT.chest - d.ads.chest, weeklyOn = lv >= WEEKLY_LV;

  // ---------- 일일: 완료 상자 판 · 오늘의 임무 판 ----------
  const chestBtns = `${ch.today || ch.banked ? `<button class="btn mini primary" type="button" id="chest">${ch.today ? t('열기') : t('놓친 날 열기')}</button>` : d.chest ? okPill(t('받음')) : ''}${d.chest && !d.chest2 ? `<button class="btn mini" type="button" id="chest2"${adLeft > 0 ? '' : ' disabled'}>${t('광고 한 번 더')}</button>` : ''}`;
  // 제목 · 받은 수는 판 머리에, 줄에는 보상 알약 · 막대 · 버튼만
  const chestRow = `<li class="g-row m-chest"><span class="g-ri">${gameIcon('chest', '')}</span><div class="g-rm"><span class="g-rewards">${pill(currencyAmount('gold', run * CHEST_REWARD.runs), 'fame')}${pill(`${img(art('item-chest-vestment'))}${t('장비 1')}`)}</span>${bar((gotN / d.missions.length) * 100, t('보상 받은 임무 {a} / {b}', { a: gotN, b: d.missions.length }))}${ch.banked ? `<span class="g-sub">${t('놓친 날 상자 {n}개', { n: ch.banked })}</span>` : ''}</div>
      ${chestBtns ? `<span class="g-rs m-rs">${chestBtns}</span>` : ''}</li>`;
  const daily = `${hero(t('오늘의 임무'))}
    ${card({ key: 'chest', icon: gameIcon('chest', ''), title: t('완료 상자'), meta: `${gotN}<small> / ${d.missions.length}</small>`, body: `<ul class="g-rows">${chestRow}</ul>` })}
    ${card({ key: 'day', icon: gameIcon('mission', ''), title: t('오늘의 임무'), body: `<ul class="g-rows mlist">${d.missions.map((_, i) => row('daily', i)).join('')}</ul>` })}`;

  // ---------- 주간: 주간 임무 판 · 이번 주 보상 판 (길드 주간 목표 · 주간 도전 상자) ----------
  const guildRow = FEATURES.guild && (lv >= GUILD_LEVEL || G.save.guild.founded) ? `<li class="g-row m-goal"><span class="g-ri">${gameIcon('guild-goal', '')}</span><div class="g-rm"><b>${t('길드 주간 목표')}</b><span class="g-sub">${t('길드파티로 클리어')}</span>${bar((g.n / GUILD_GOAL.need) * 100, t('길드파티 클리어 {a} / {b}', { a: g.n, b: GUILD_GOAL.need }))}</div>
      <span class="g-rs m-rs"><b class="g-num">${Math.min(g.n, GUILD_GOAL.need)}<small> / ${GUILD_GOAL.need}</small></b>${g.got ? okPill(t('받음')) : g.n >= GUILD_GOAL.need ? `<button class="btn mini primary" type="button" id="guildGoal">${t('받기')}</button>` : pill(`${gameIcon('guild-fame', '')}+${GUILD_GOAL.fame}`, 'fame')}</span></li>` : '';
  const chalRow = chal ? `<li class="g-row m-chal"><span class="g-ri">${gameIcon('challenge', '')}</span><div class="g-rm"><b>${t('주간 도전 상자')}</b><span class="g-sub">${t('지난주 최고 {n}단계', { n: save.chalChest })}</span><span class="g-rewards">${chal.grades.length ? pill(gradeTxt(chal.grades)) : ''}${pill(currencyAmount('gold', chal.gold), 'fame')}</span></div>
      <span class="g-rs m-rs"><button class="btn mini primary" type="button" id="chalChest">${t('열기')}</button></span></li>` : '';
  const weekly = `${hero(t('이번 주 임무'))}
    ${card({ key: 'week', icon: gameIcon('mission', ''), title: t('주간 임무'), meta: weeklyOn ? `${weeklyN}<small> / ${w.missions.length}</small>` : '',
      body: weeklyOn ? `<ul class="g-rows mlist">${w.missions.map((_, i) => row('weekly', i)).join('')}</ul>` : `<p class="g-empty0">${t('주간 임무는 Lv {n}부터', { n: WEEKLY_LV })}</p>` })}
    ${guildRow || chalRow ? card({ key: 'box', icon: gameIcon('expedition-chest', ''), title: t('이번 주 보상'), body: `<ul class="g-rows">${guildRow}${chalRow}</ul>` }) : ''}`;

  const panel = (tab: 'daily' | 'weekly', html: string) => `<div id="mission-${tab}" class="m-panel" role="tabpanel" aria-labelledby="mission-tab-${tab}"${st.tab === tab ? '' : ' hidden'}>${html}</div>`;
  s.el.innerHTML = `${topBar({ back: 's-lobby', title: t('임무') })}
    <nav class="subtabs" role="tablist" aria-label="${t('임무 기간')}">${(['daily', 'weekly'] as const).map(tab => `<button type="button" role="tab" id="mission-tab-${tab}" data-mission-tab="${tab}" aria-selected="${st.tab === tab}" aria-controls="mission-${tab}" tabindex="${st.tab === tab ? 0 : -1}">${tab === 'daily' ? t('일일') : t('주간')}</button>`).join('')}</nav>
    <div class="ns-body missions">${panel('daily', daily)}${panel('weekly', weekly)}</div>`;
}

s.el.addEventListener('keydown', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-mission-tab]');
  if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  st.tab = e.key === 'Home' ? 'daily' : e.key === 'End' ? 'weekly' : st.tab === 'daily' ? 'weekly' : 'daily';
  render(); s.el.querySelector<HTMLElement>(`#mission-tab-${st.tab}`)?.focus();
});

/** 받기 소리 (107): 받았으면 그 소리, 못 받았으면 (글자 = 까닭) deny */
const got = (r: unknown, name: string) => sfx(typeof r === 'string' ? 'deny' : name);
/**
 * 받기 결과: 받았으면 보상 창 (reward-pop, 2026-10-24 Lim 시안 A), 못 받았으면 까닭 알림 창 (2026-10-28 Lim 「가운데 생기는 ui는 최대한 자제」, 예전 목록 위 띠).
 * 화면을 다시 그린 뒤 띄움
 */
function award(r: Gain | string, title: string): void {
  commit(); render();
  if (typeof r === 'string') void noticeModal(title, esc(t(r)));
  else showReward({ title, gold: r.gold, items: r.items });
}

s.el.addEventListener('click', async e => {
  const el = e.target as HTMLElement, save = G.save;
  const tab = el.closest<HTMLElement>('[data-mission-tab]');
  if (tab) { st.tab = tab.dataset.missionTab as 'daily' | 'weekly'; render(); s.el.querySelector<HTMLElement>(`#mission-tab-${st.tab}`)?.focus(); return; }
  const c = el.closest<HTMLElement>('[data-claim]');
  if (c) { const r = claimMission(save, c.dataset.claim as 'daily' | 'weekly', Number(c.dataset.i)); got(r, 'mission-claim'); award(r, t('임무 보상')); return; }
  if (el.closest('#chest')) { const r = claimChest(save, Math.random); got(r, 'chest-open'); award(r, t('완료 상자')); return; }
  if (el.closest('#chest2')) {
    if (chestAdPending || !save.daily.chest || save.daily.chest2 || save.daily.ads.chest >= AD_LIMIT.chest) return;
    const daily = save.daily;
    chestAdPending = true;
    try {
      const eligible = () => G.save === save && save.daily === daily && daily.chest && !daily.chest2 && daily.ads.chest < AD_LIMIT.chest;
      if (!(await showRewarded(t('완료 상자 한 번 더'), () => !s.el.hidden && eligible())) || !eligible()) return;
      const r = claimChest(save, Math.random, true);
      if (typeof r !== 'string') daily.ads.chest++;
      got(r, 'chest-open'); award(r, t('완료 상자 · 한 번 더'));
    } finally { chestAdPending = false; }
    return;
  }
  if (el.closest('#guildGoal')) {
    const err = claimGuildGoal(save); got(err || {}, 'mission-claim'); commit(); render();
    if (err) void noticeModal(t('길드 주간 목표'), esc(t(err))); else showReward({ title: t('길드 주간 목표'), fame: GUILD_GOAL.fame });
    return;
  }
  if (el.closest('#chalChest')) { const r = claimChalChest(save, Math.random); got(r, 'chest-open'); award(r, t('주간 도전 상자')); }
});
