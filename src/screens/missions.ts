/**
 * S22 일일·주간 임무 (09, 13). 로비 「오늘의 임무」에서 들어옴.
 * 일일 5개 + 완료 상자 (놓친 날 2일까지), 주간 3개 (클리어 골드 1.75판), 길드 주간 목표 (길드를 빼 두면 없음), 주간 도전 월요일 상자.
 * 화면 (2026-10-22 Lim 「주간이 끝나면 임무 화면도 동일하게 시안을 만들어서 디자인 하자」 → 「b시안으로 해줘」 · 「상점과 행상인과 비슷한 느낌으로 일관성있게」):
 * 상점 · 행상인과 같은 그림 머리 (ui-mission 임무 게시판) + 길드 탭 (일일 · 주간) + 머리 달린 판 · 줄 · 알약 · ⓘ (guild-hall.css). 규칙 글은 ⓘ 안에만
 */
import { AD_LIMIT } from '../data/economy';
import { adsFree } from '../game/stamina';
import { CHEST_REWARD, GUILD_GOAL, WEEKLY_LV } from '../data/missions';
import { FEATURES } from '../data/features';
import { GUILD_LEVEL } from '../data/progression';
import { hhmm, untilReset, weekRemaining } from '../game/clock';
import { chalChestOf, chestState, claimChalChest, claimChest, claimGuildGoal, claimMission, missionDef, missionGold, missionReady, runGold, swapMission } from '../game/economy';
import { commit, G, refreshDay } from '../game/state';
import { topLevel } from '../platform/storage';
import { showRewarded } from '../platform/ads';
import { esc, screen, topBar } from './kit';
import { gainText } from './shop';
import { currencyAmount, gameIcon, uiIcon } from './art';
import { art } from '../art';
import './missions.css';
import { sfx } from '../sfx';

/** tip = 열린 ⓘ (길드 화면과 같음) */
const st = { msg: '', tab: 'daily' as 'daily' | 'weekly', tip: null as string | null };
const s = screen('s-missions', '임무', { enter() { refreshDay(); st.msg = ''; st.tab = 'daily'; st.tip = null; render(); } });

/** 임무 그림 (2026-10-22 Lim 임무 시안): 있는 그림을 빌려 씀. 이름 · 보상 · 진행은 그림이 아니라 실제 임무 값 */
const MISSION_ART: Record<string, string> = {
  clear3: 'icon-a2-swords', pub2: 'icon-guild-members', dispel10: 'skill-purify',
  overheal: 'skill-renew', nodeath: 'skill-guardian', mana20: 'spec-mana',
  clumsy: 'icon-guild-members', sell2: 'icon-forge', guild2: 'icon-guild-flag',
  w_raid3: 'icon-raid', w_hard5: 'icon-a2-swords', w_dclear15: 'icon-a2-swords',
  w_chal5: 'icon-challenge', w_chest5: 'icon-chest',
};
const missionImage = (key: string) => art(MISSION_ART[key] ?? 'icon-mission') || art('icon-mission');

// ---------- 길드 부품 (guild-hall.css: 판 .g-card · 줄 .g-row · 알약 .g-pill · ⓘ) ----------
const infoBtn = (key: string, label: string) => `<button type="button" class="g-info" data-tip="${key}" aria-expanded="${st.tip === key}" aria-label="${esc(label)} 설명">${uiIcon('info')}</button>`;
/** 판: 머리 = 그림 · 제목 · 숫자 · ⓘ, ⓘ를 누르면 머리 아래 규칙 글 */
function card(o: { key: string; icon: string; title: string; meta?: string; tip: string; body: string }): string {
  return `<section class="g-card" data-sec="${o.key}"><header class="g-hd"><span class="g-hi">${o.icon}</span><h3>${o.title}</h3>${o.meta ? `<span class="g-meta">${o.meta}</span>` : ''}${infoBtn(o.key, o.title)}</header>${st.tip === o.key ? `<div class="g-tip" role="note">${o.tip}</div>` : ''}${o.body}</section>`;
}
const pill = (html: string, cls = '') => `<span class="g-pill${cls ? ` ${cls}` : ''}">${html}</span>`;
const okPill = (t: string) => pill(`✓ ${t}`, 'ok');
const bar = (pct: number, label: string) => `<span class="g-bar" role="img" aria-label="${esc(label)}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(0)}%"></i></span>`;
const img = (src: string) => `<img class="g-ic" src="${src}" alt="" decoding="async">`;
const gradeTxt = (gs: string[]) => [...new Set(gs)].map(g => `${g}${gs.filter(x => x === g).length > 1 ? ` ${gs.filter(x => x === g).length}` : ''}`).join(' · ');

/** 임무 줄 = 길드 줄: 그림 · 이름 + 막대 · 숫자 / 오른쪽 골드 알약 위, 받기 · 교체 · 받음 아래 */
function row(kind: 'daily' | 'weekly', i: number): string {
  const m = (kind === 'daily' ? G.save.daily : G.save.weekly).missions[i], d = missionDef(m.key);
  const value = Math.min(m.n, d.need), ready = missionReady(m) && !m.got;
  const act = m.got ? okPill('받음')
    : ready ? `<button class="btn mini primary" type="button" data-claim="${kind}" data-i="${i}" aria-label="${esc(d.text)} 보상 받기">받기</button>`
      : kind === 'daily' && !G.save.daily.swapped ? `<button class="btn mini" type="button" data-swap="${i}" aria-label="${esc(d.text)} 교체">교체</button>` : '';
  return `<li class="g-row mrow${m.got ? ' got' : ''}${ready ? ' ready' : ''}"><span class="g-ri">${img(missionImage(m.key))}</span>
    <div class="g-rm"><b>${esc(d.text)}</b><span class="m-prog">${bar((value / d.need) * 100, `${d.text} ${value} / ${d.need}`)}<small>${value} / ${d.need}</small></span></div>
    <span class="g-rs m-rs"><span class="mission-reward g-pill fame">${currencyAmount('gold', missionGold(G.save, kind))}</span>${act}</span></li>`;
}

/** 그림 머리 (상점 · 행상인 머리와 같은 .art-hero): 작은 글 「임무 게시판」 · 제목 / 오른쪽 알약 = 새 임무까지 남은 시간 (행상인 보유 골드 자리) */
function hero(title: string, left: string): string {
  return `<header class="art-hero m-hero"><div class="ah-copy"><p class="eyebrow">임무 게시판</p><h2>${title}</h2></div><p class="m-left"><small>새 임무</small><b>${left}</b></p></header>`;
}

function render(): void {
  const save = G.save, d = save.daily, w = save.weekly, lv = topLevel(save);
  const ch = chestState(save), gotN = d.missions.filter(m => m.got).length, weeklyN = w.missions.filter(m => m.got).length;
  const g = w.guild, run = runGold(lv), chal = save.chalChest ? chalChestOf(save.chalChest, save.player.level) : null;
  const adLeft = AD_LIMIT.chest - d.ads.chest, mem = adsFree(save), weeklyOn = lv >= WEEKLY_LV;

  // ---------- 일일: 완료 상자 판 · 오늘의 임무 판 ----------
  const chestBtns = `${ch.today || ch.banked ? `<button class="btn mini primary" type="button" id="chest">${ch.today ? '열기' : '놓친 날 열기'}</button>` : d.chest ? okPill('받음') : ''}${d.chest && !d.chest2 ? `<button class="btn mini" type="button" id="chest2"${adLeft > 0 || mem ? '' : ' disabled'}>${mem ? '한 번 더' : '광고 한 번 더'}</button>` : ''}`;
  // 제목 · 받은 수는 판 머리에, 줄에는 보상 알약 · 막대 · 버튼만
  const chestRow = `<li class="g-row m-chest"><span class="g-ri">${gameIcon('chest', '')}</span><div class="g-rm"><span class="g-rewards">${pill(currencyAmount('gold', run * CHEST_REWARD.runs), 'fame')}${pill(`${img(art('item-chest-vestment'))}장비 1`)}</span>${bar((gotN / d.missions.length) * 100, `보상 받은 임무 ${gotN} / ${d.missions.length}`)}${ch.banked ? `<span class="g-sub">놓친 날 상자 ${ch.banked}개</span>` : ''}</div>
      ${chestBtns ? `<span class="g-rs m-rs">${chestBtns}</span>` : ''}</li>`;
  const daily = `${hero('오늘의 임무', hhmm(untilReset()))}
    ${card({ key: 'chest', icon: gameIcon('chest', ''), title: '완료 상자', meta: `${gotN}<small> / ${d.missions.length}</small>`, body: `<ul class="g-rows">${chestRow}</ul>`,
      tip: `<p>오늘의 임무 ${d.missions.length}개 보상을 모두 받으면 열립니다. 열지 못한 상자는 2일까지 남습니다.</p><p>연 뒤에는 ${mem ? '광고 없이' : '광고를 보고'} 한 번 더 열 수 있습니다.</p>` })}
    ${card({ key: 'day', icon: gameIcon('mission', ''), title: '오늘의 임무', body: `<ul class="g-rows mlist">${d.missions.map((_, i) => row('daily', i)).join('')}</ul>`,
      tip: '<p>매일 오전 6시에 새 임무가 옵니다. 진행 중인 임무 하나를 그날 한 번 다른 임무로 바꿀 수 있습니다.</p>' })}`;

  // ---------- 주간: 주간 임무 판 · 이번 주 보상 판 (길드 주간 목표 · 주간 도전 상자) ----------
  const guildRow = FEATURES.guild && lv >= GUILD_LEVEL ? `<li class="g-row m-goal"><span class="g-ri">${gameIcon('guild-goal', '')}</span><div class="g-rm"><b>길드 주간 목표</b><span class="g-sub">길드파티로 클리어</span>${bar((g.n / GUILD_GOAL.need) * 100, `길드파티 클리어 ${g.n} / ${GUILD_GOAL.need}`)}</div>
      <span class="g-rs m-rs"><b class="g-num">${Math.min(g.n, GUILD_GOAL.need)}<small> / ${GUILD_GOAL.need}</small></b>${g.got ? okPill('받음') : g.n >= GUILD_GOAL.need ? '<button class="btn mini primary" type="button" id="guildGoal">받기</button>' : pill(`${gameIcon('guild-fame', '')}+${GUILD_GOAL.fame}`, 'fame')}</span></li>` : '';
  const chalRow = chal ? `<li class="g-row m-chal"><span class="g-ri">${gameIcon('challenge', '')}</span><div class="g-rm"><b>주간 도전 상자</b><span class="g-sub">지난주 최고 ${save.chalChest}단계</span><span class="g-rewards">${chal.grades.length ? pill(gradeTxt(chal.grades)) : ''}${pill(currencyAmount('gold', chal.gold), 'fame')}</span></div>
      <span class="g-rs m-rs"><button class="btn mini primary" type="button" id="chalChest">열기</button></span></li>` : '';
  const weekly = `${hero('이번 주 임무', weekRemaining())}
    ${card({ key: 'week', icon: gameIcon('mission', ''), title: '주간 임무', meta: weeklyOn ? `${weeklyN}<small> / ${w.missions.length}</small>` : '', tip: '<p>월요일 오전 6시에 새 임무 3개가 옵니다. 주간 임무는 바꿀 수 없습니다.</p>',
      body: weeklyOn ? `<ul class="g-rows mlist">${w.missions.map((_, i) => row('weekly', i)).join('')}</ul>` : `<p class="g-empty0">주간 임무는 Lv ${WEEKLY_LV}부터</p>` })}
    ${guildRow || chalRow ? card({ key: 'box', icon: gameIcon('expedition-chest', ''), title: '이번 주 보상', body: `<ul class="g-rows">${guildRow}${chalRow}</ul>`,
      tip: '<p><b>길드 주간 목표</b>길드파티 (자리 절반 이상이 길드원)로 클리어하면 셉니다. 다 채우면 명성을 받습니다.</p><p><b>주간 도전 상자</b>지난주 주간 도전 최고 단계로 받습니다.</p>' }) : ''}`;

  const panel = (tab: 'daily' | 'weekly', html: string) => `<div id="mission-${tab}" class="m-panel" role="tabpanel" aria-labelledby="mission-tab-${tab}"${st.tab === tab ? '' : ' hidden'}>${html}</div>`;
  s.el.innerHTML = `${topBar({ back: 's-lobby', title: '임무' })}
    <nav class="subtabs" role="tablist" aria-label="임무 기간">${(['daily', 'weekly'] as const).map(tab => `<button type="button" role="tab" id="mission-tab-${tab}" data-mission-tab="${tab}" aria-selected="${st.tab === tab}" aria-controls="mission-${tab}" tabindex="${st.tab === tab ? 0 : -1}">${tab === 'daily' ? '일일' : '주간'}</button>`).join('')}</nav>
    <div class="ns-body missions">${st.msg ? `<p class="warnbox" role="status">${esc(st.msg)}</p>` : ''}${panel('daily', daily)}${panel('weekly', weekly)}</div>`;
  st.msg = '';
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

s.el.addEventListener('click', async e => {
  const t = e.target as HTMLElement, save = G.save;
  const ib = t.closest<HTMLElement>('[data-tip]');
  if (ib) { st.tip = st.tip === ib.dataset.tip ? null : ib.dataset.tip!; render(); return; }
  const tab = t.closest<HTMLElement>('[data-mission-tab]');
  if (tab) { st.tab = tab.dataset.missionTab as 'daily' | 'weekly'; st.tip = null; render(); s.el.querySelector<HTMLElement>(`#mission-tab-${st.tab}`)?.focus(); return; }
  const c = t.closest<HTMLElement>('[data-claim]');
  if (c) { const r = claimMission(save, c.dataset.claim as 'daily' | 'weekly', Number(c.dataset.i)); got(r, 'mission-claim'); st.msg = typeof r === 'string' ? r : gainText(r); commit(); render(); return; }
  const sw = t.closest<HTMLElement>('[data-swap]');
  if (sw) { st.msg = swapMission(save, Number(sw.dataset.swap), Math.random) || '임무 교체'; commit(); render(); return; }
  if (t.closest('#chest')) { const r = claimChest(save, Math.random); got(r, 'chest-open'); st.msg = typeof r === 'string' ? r : `완료 상자: ${gainText(r)}`; commit(); render(); return; }
  if (t.closest('#chest2')) {
    const mem = adsFree(save);
    if (!mem && save.daily.ads.chest >= AD_LIMIT.chest) return;
    if (!(await showRewarded('완료 상자 한 번 더', mem))) return;
    if (!mem) save.daily.ads.chest++;
    const r = claimChest(save, Math.random, true);
    got(r, 'chest-open');
    st.msg = typeof r === 'string' ? r : `한 번 더: ${gainText(r)}`; commit(); render(); return;
  }
  if (t.closest('#guildGoal')) { const err = claimGuildGoal(save); got(err || {}, 'mission-claim'); st.msg = err || `길드 주간 목표 · 명성 +${GUILD_GOAL.fame}`; commit(); render(); return; }
  if (t.closest('#chalChest')) { const r = claimChalChest(save, Math.random); got(r, 'chest-open'); st.msg = typeof r === 'string' ? r : `주간 도전 상자: ${gainText(r)}`; commit(); render(); }
});
